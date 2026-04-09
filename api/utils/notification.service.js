// File: api/utils/notification.service.js
// Unified CRM notification dispatcher — email (SendGrid) + Slack (webhook)

const { sendEmail } = require('./email.utils');
const { getMarketPulseEmailHTML } = require('./emailTemplates');
const db = require('./db');
const logger = require('./logger');

const SLACK_WEBHOOK_URL = process.env.SLACK_CRM_WEBHOOK_URL;
const APP_URL = process.env.BASE_URL || 'https://www.market-pulse.io';

// ── Helpers ──

async function lookupEmail(firstName) {
  if (!firstName) return null;
  try {
    const { rows } = await db.query(
      `SELECT email FROM users WHERE first_name = $1 AND role IN ('admin', 'super_admin') LIMIT 1`,
      [firstName]
    );
    return rows[0]?.email || null;
  } catch (err) {
    logger.error({ err, firstName }, 'notification: failed to look up email');
    return null;
  }
}

function priorityEmoji(priority) {
  const map = { urgent: '🔴', high: '🟠', medium: '🔵', low: '⚪' };
  return map[priority] || '⚪';
}

function priorityBadgeColor(priority) {
  const map = { urgent: '#ef4444', high: '#f97316', medium: '#3b82f6', low: '#94a3b8' };
  return map[priority] || '#94a3b8';
}

function priorityBadge(priority) {
  const color = priorityBadgeColor(priority);
  const label = (priority || 'low').charAt(0).toUpperCase() + (priority || 'low').slice(1);
  return `<span style="display: inline-block; font-size: 11px; font-weight: 700; color: #fff; background: ${color}; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>`;
}

function metaRow(label, value) {
  return `<span style="color: #94a3b8;">${label}</span><br><span style="font-weight: 500; color: #334155;">${value}</span>`;
}

function taskCard(task, extra) {
  const hotel = task.hotel_name || 'No property';
  const due = task.due_date || 'No date set';
  return `
    <div style="height: 1px; background: #e2e8f0; margin: 16px 0 20px;"></div>
    <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 16px; line-height: 1.4;">CRM-${task.id}: ${task.title}</p>
    <table border="0" cellpadding="0" cellspacing="0" style="font-size: 13px; color: #475569; margin-bottom: 16px;">
      <tr>
        <td style="padding: 0 24px 6px 0;">${metaRow('Property', hotel)}</td>
        <td style="padding: 0 24px 6px 0;">${metaRow('Priority', priorityBadge(task.priority))}</td>
        <td style="padding: 0 0 6px 0;">${metaRow('Due', due)}</td>
      </tr>
    </table>
    ${extra || ''}
  `;
}

function statusLabel(status) {
  const map = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  return map[status] || status;
}

// ── Email Notifications ──

async function sendTaskEmail(to, subject, headline, bodyText) {
  if (!to || !process.env.SENDGRID_API_KEY) return;
  try {
    const html = getMarketPulseEmailHTML(headline, bodyText, `${APP_URL}?view=crm`, 'Open CRM');
    await sendEmail({ to, subject, html });
  } catch (err) {
    logger.error({ err, to, subject }, 'notification: email send failed');
  }
}

// ── Slack Notifications ──

async function sendSlack(text, blocks) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    const body = blocks ? { text, blocks } : { text };
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn({ status: res.status, url: SLACK_WEBHOOK_URL }, 'notification: slack webhook non-200');
    }
  } catch (err) {
    logger.error({ err }, 'notification: slack send failed');
  }
}

function slackTaskBlock(task, event) {
  const hotel = task.hotel_name || 'No property';
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${priorityEmoji(task.priority)} *CRM-${task.id}: ${task.title}*\n${event}`,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Property:* ${hotel}` },
        { type: 'mrkdwn', text: `*Assignee:* ${task.assignee || 'Unassigned'}` },
        { type: 'mrkdwn', text: `*Due:* ${task.due_date || 'No date'}` },
      ],
    },
    { type: 'divider' },
  ];
}

// ── Public API ──

/**
 * Task created — notify assignee + Slack
 */
async function notifyTaskCreated(task, createdBy) {
  const event = `📋 New task created by *${createdBy || 'System'}*`;

  // Email to assignee (if not the creator)
  if (task.assignee && task.assignee !== createdBy) {
    const email = await lookupEmail(task.assignee);
    if (email) {
      const desc = task.description
        ? `<p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">${task.description.slice(0, 200)}${task.description.length > 200 ? '...' : ''}</p>`
        : '';
      await sendTaskEmail(
        email,
        `New task assigned: ${task.title}`,
        'Task Assigned to You',
        `
          <p style="font-size: 13px; color: #64748b; margin: 0;">from ${createdBy || 'System'}</p>
          ${taskCard(task, desc)}
        `
      );
    }
  }

  // Slack
  sendSlack(
    `${priorityEmoji(task.priority)} New task: ${task.title} (assigned to ${task.assignee || 'nobody'})`,
    slackTaskBlock(task, event)
  );
}

/**
 * Task assigned / reassigned — notify new assignee + Slack
 */
async function notifyTaskAssigned(task, oldAssignee, updatedBy) {
  const event = `👤 Assigned to *${task.assignee}*${oldAssignee ? ` (was ${oldAssignee})` : ''} by *${updatedBy}*`;

  // Email to new assignee (if not the updater)
  if (task.assignee && task.assignee !== updatedBy) {
    const email = await lookupEmail(task.assignee);
    if (email) {
      await sendTaskEmail(
        email,
        `Task assigned to you: ${task.title}`,
        'Task Assigned to You',
        `
          <p style="font-size: 13px; color: #64748b; margin: 0;">from ${updatedBy}${oldAssignee ? ` (was ${oldAssignee})` : ''}</p>
          ${taskCard(task)}
        `
      );
    }
  }

  sendSlack(
    `👤 ${task.title} assigned to ${task.assignee}`,
    slackTaskBlock(task, event)
  );
}

/**
 * Task status changed — notify assignee + Slack
 */
async function notifyStatusChanged(task, oldStatus, updatedBy) {
  const event = `🔄 Status: *${statusLabel(oldStatus)}* → *${statusLabel(task.status)}* by *${updatedBy}*`;

  // Email assignee if someone else changed it
  if (task.assignee && task.assignee !== updatedBy) {
    const email = await lookupEmail(task.assignee);
    if (email) {
      const statusChange = `
        <div style="display: inline-block; font-size: 14px; color: #475569; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; margin-top: 4px;">
          ${statusLabel(oldStatus)} &rarr; <strong style="color: #0f172a;">${statusLabel(task.status)}</strong>
        </div>
      `;
      await sendTaskEmail(
        email,
        `Task status updated: ${task.title}`,
        'Task Status Changed',
        `
          <p style="font-size: 13px; color: #64748b; margin: 0;">by ${updatedBy}</p>
          ${taskCard(task, statusChange)}
        `
      );
    }
  }

  sendSlack(
    `🔄 ${task.title}: ${statusLabel(oldStatus)} → ${statusLabel(task.status)}`,
    slackTaskBlock(task, event)
  );
}

/**
 * Comment added — email assignee only (no Slack)
 */
async function notifyCommentAdded(task, author, commentBody) {
  if (task.assignee && task.assignee !== author) {
    const email = await lookupEmail(task.assignee);
    if (email) {
      const comment = `
        <div style="padding: 14px 18px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #0f172a; color: #334155; font-size: 13px; line-height: 1.6; margin-top: 4px;">
          ${commentBody.slice(0, 500)}${commentBody.length > 500 ? '...' : ''}
        </div>
      `;
      await sendTaskEmail(
        email,
        `New comment on: ${task.title}`,
        'New Comment',
        `
          <p style="font-size: 13px; color: #64748b; margin: 0;">from ${author}</p>
          ${taskCard(task, comment)}
        `
      );
    }
  }
}

/**
 * Task overdue — notify assignee (called from cron)
 */
async function notifyTaskOverdue(task) {
  if (!task.assignee) return;
  const email = await lookupEmail(task.assignee);
  if (email) {
    const overdueBadge = `
      <div style="display: inline-block; font-size: 12px; font-weight: 700; color: #fff; background: #ef4444; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Overdue</div>
    `;
    await sendTaskEmail(
      email,
      `Overdue: ${task.title}`,
      'Task Overdue',
      `${taskCard(task, overdueBadge)}`
    );
  }

  sendSlack(
    `⚠️ Overdue: ${task.title} (assigned to ${task.assignee})`,
    slackTaskBlock(task, `⚠️ Task is *overdue* — due ${task.due_date}`)
  );
}

module.exports = {
  notifyTaskCreated,
  notifyTaskAssigned,
  notifyStatusChanged,
  notifyCommentAdded,
  notifyTaskOverdue,
};
