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

function statusLabel(status) {
  const map = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  return map[status] || status;
}

// ── Email Notifications ──

async function sendTaskEmail(to, subject, headline, bodyText) {
  if (!to || !process.env.SENDGRID_API_KEY) return;
  try {
    const html = getMarketPulseEmailHTML(headline, bodyText, APP_URL, 'Open CRM');
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
      const hotel = task.hotel_name || 'No property';
      await sendTaskEmail(
        email,
        `New task assigned: ${task.title}`,
        'New Task Assigned to You',
        `
          Hi ${task.assignee},<br><br>
          <strong>${createdBy || 'Someone'}</strong> created a task and assigned it to you:<br><br>
          <strong style="font-size: 18px;">${task.title}</strong><br><br>
          <table style="font-size: 14px; color: #555;">
            <tr><td style="padding: 4px 16px 4px 0; font-weight: 600;">Property</td><td>${hotel}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0; font-weight: 600;">Priority</td><td>${task.priority}</td></tr>
            <tr><td style="padding: 4px 16px 4px 0; font-weight: 600;">Due</td><td>${task.due_date || 'No date set'}</td></tr>
          </table>
          ${task.description ? `<br><em style="color: #888;">${task.description.slice(0, 200)}${task.description.length > 200 ? '...' : ''}</em>` : ''}
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
          Hi ${task.assignee},<br><br>
          <strong>${updatedBy}</strong> assigned you a task:<br><br>
          <strong style="font-size: 18px;">CRM-${task.id}: ${task.title}</strong><br>
          <span style="color: #888;">Property: ${task.hotel_name || 'None'} &middot; Priority: ${task.priority} &middot; Due: ${task.due_date || 'No date'}</span>
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
      await sendTaskEmail(
        email,
        `Task status updated: ${task.title}`,
        'Task Status Changed',
        `
          Hi ${task.assignee},<br><br>
          <strong>${updatedBy}</strong> changed the status of your task:<br><br>
          <strong style="font-size: 18px;">CRM-${task.id}: ${task.title}</strong><br><br>
          <span style="font-size: 16px;">${statusLabel(oldStatus)} → <strong>${statusLabel(task.status)}</strong></span>
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
 * Comment added — notify assignee + Slack
 */
async function notifyCommentAdded(task, author, commentBody) {
  const event = `💬 *${author}* commented`;

  // Email assignee if someone else commented
  if (task.assignee && task.assignee !== author) {
    const email = await lookupEmail(task.assignee);
    if (email) {
      await sendTaskEmail(
        email,
        `New comment on: ${task.title}`,
        'New Comment on Your Task',
        `
          Hi ${task.assignee},<br><br>
          <strong>${author}</strong> commented on your task:<br><br>
          <strong>CRM-${task.id}: ${task.title}</strong><br><br>
          <div style="padding: 12px 16px; background: #f5f5f5; border-radius: 6px; border-left: 3px solid #39BDF8; color: #333; font-size: 14px; line-height: 1.6;">
            ${commentBody.slice(0, 500)}${commentBody.length > 500 ? '...' : ''}
          </div>
        `
      );
    }
  }

  sendSlack(
    `💬 ${author} commented on: ${task.title}`,
    slackTaskBlock(task, event)
  );
}

/**
 * Task overdue — notify assignee (called from cron)
 */
async function notifyTaskOverdue(task) {
  if (!task.assignee) return;
  const email = await lookupEmail(task.assignee);
  if (email) {
    await sendTaskEmail(
      email,
      `Overdue: ${task.title}`,
      'Task Overdue',
      `
        Hi ${task.assignee},<br><br>
        Your task is now <strong style="color: #ef4444;">overdue</strong>:<br><br>
        <strong style="font-size: 18px;">CRM-${task.id}: ${task.title}</strong><br>
        <span style="color: #888;">Due date was: ${task.due_date}</span>
      `
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
