const express = require("express");
const router = express.Router();
const { requireAdminApi } = require("../utils/middleware");
const db = require("../utils/db");
const notifications = require("../utils/notification.service");

// All distribution/CRM endpoints are admin-only
router.use(requireAdminApi);

// ── Grid sync helper: link CRM tasks ↔ distribution grid ──
async function syncGridFromTask(hotelIds, channelTags, gridStatus) {
  if (!hotelIds || hotelIds.length === 0 || !channelTags || channelTags.length === 0) return;
  // Resolve channel names to IDs
  const { rows: channels } = await db.query(
    "SELECT id, name FROM distribution_channels WHERE name = ANY($1::text[])",
    [channelTags]
  );
  if (channels.length === 0) return;
  for (const hId of hotelIds) {
    for (const ch of channels) {
      await db.query(`
        INSERT INTO distribution_hotel_channels (hotel_id, channel_id, status, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (hotel_id, channel_id)
        DO UPDATE SET status = $3, suspension_reason = NULL, suspended_by = NULL, suspended_at = NULL, updated_at = NOW()
      `, [hId, ch.id, gridStatus]);
    }
  }
}

// ═══════════════════════════════════════════
// TEAM MEMBERS
// ═══════════════════════════════════════════

// GET /team — admin + super_admin users
router.get("/team", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT user_id, first_name, last_name, email, role
      FROM users
      WHERE role IN ('admin', 'super_admin')
      ORDER BY first_name ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error("GET /team error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// CRM TASKS
// ═══════════════════════════════════════════

// GET /tasks — list tasks with optional filters
router.get("/tasks", async (req, res) => {
  try {
    const { status, assignee, category, priority, hotel_id, channel_id } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
    if (assignee) { conditions.push(`t.assignee = $${idx++}`); params.push(assignee); }
    if (category) { conditions.push(`t.category = $${idx++}`); params.push(category); }
    if (priority) { conditions.push(`t.priority = $${idx++}`); params.push(priority); }
    if (hotel_id) { conditions.push(`t.hotel_id = $${idx++}`); params.push(hotel_id); }
    if (channel_id) { conditions.push(`t.channel_id = $${idx++}`); params.push(channel_id); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await db.query(`
      SELECT t.*,
        h.property_name AS hotel_name,
        dc.name AS channel_name,
        dc.slug AS channel_slug,
        COALESCE(sub.subtask_done, 0) AS subtask_done,
        COALESCE(sub.subtask_total, 0) AS subtask_total,
        COALESCE(cmt.comment_count, 0) AS comment_count,
        COALESCE(hn.hotel_names, '{}') AS hotel_names
      FROM crm_tasks t
      LEFT JOIN hotels h ON t.hotel_id = h.hotel_id
      LEFT JOIN distribution_channels dc ON t.channel_id = dc.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE done) AS subtask_done, COUNT(*) AS subtask_total
        FROM crm_task_subtasks WHERE task_id = t.id
      ) sub ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS comment_count
        FROM crm_task_comments WHERE task_id = t.id AND type = 'comment'
      ) cmt ON true
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(hh.property_name ORDER BY hh.property_name) AS hotel_names
        FROM hotels hh WHERE hh.hotel_id = ANY(t.hotel_ids)
      ) hn ON true
      ${where}
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        t.due_date ASC NULLS LAST
    `, params);

    res.json(rows);
  } catch (error) {
    console.error("GET /tasks error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /tasks/bulk — create multiple tasks (one per channel, same base fields)
router.post("/tasks/bulk", async (req, res) => {
  try {
    const { tasks: taskList } = req.body;
    if (!Array.isArray(taskList) || taskList.length === 0) {
      return res.status(400).json({ error: "tasks array is required." });
    }
    if (taskList.length > 20) {
      return res.status(400).json({ error: "Maximum 20 tasks per batch." });
    }

    const batchId = `batch-${Date.now()}`;
    const created = [];

    for (const t of taskList) {
      if (!t.title) continue;
      const resolvedHotelIds = t.hotel_ids && t.hotel_ids.length > 0 ? t.hotel_ids : (t.hotel_id ? [t.hotel_id] : []);
      const primaryHotelId = resolvedHotelIds[0] || null;

      const { rows } = await db.query(`
        INSERT INTO crm_tasks (title, description, hotel_id, hotel_ids, channel_id, assignee, priority, status, category, due_date, tags, created_by, notify_assignee)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [t.title, t.description || null, primaryHotelId, resolvedHotelIds, t.channel_id || null, t.assignee || null, t.priority || 'medium', t.status || 'todo', t.category || 'operations', t.due_date || null, t.tags || [], t.created_by || null, t.notify_assignee === true]);

      if (rows[0]) {
        await db.query(`
          INSERT INTO crm_task_comments (task_id, author, body, type)
          VALUES ($1, $2, $3, 'activity')
        `, [rows[0].id, t.created_by || 'System', `Created as part of batch (${taskList.length} tasks, ref: ${batchId})`]);

        const enriched = { ...rows[0] };
        if (resolvedHotelIds.length > 0) {
          const hResult = await db.query('SELECT property_name FROM hotels WHERE hotel_id = ANY($1::int[])', [resolvedHotelIds]);
          enriched.hotel_names = hResult.rows.map(r => r.property_name);
          enriched.hotel_name = enriched.hotel_names.join(', ');
        }
        notifications.notifyTaskCreated(enriched, t.created_by).catch(() => {});
        created.push(rows[0]);

        // Sync distribution grid: new task with channels → onboarding
        const cat = rows[0].category;
        if (resolvedHotelIds.length > 0 && t.tags && t.tags.length > 0 && (cat === 'distribution' || cat === 'onboarding')) {
          syncGridFromTask(resolvedHotelIds, t.tags, 'onboarding').catch(err => console.error('Grid sync error (bulk):', err));
        }
      }
    }

    res.status(201).json({ created: created.length, tasks: created, batch_id: batchId });
  } catch (error) {
    console.error("POST /tasks/bulk error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /tasks — create task
router.post("/tasks", async (req, res) => {
  try {
    const { title, description, hotel_id, hotel_ids, channel_id, assignee, priority, status, category, due_date, tags, created_by, notify_assignee } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required." });

    // Support both hotel_ids (array) and legacy hotel_id (single)
    const resolvedHotelIds = hotel_ids && hotel_ids.length > 0 ? hotel_ids : (hotel_id ? [hotel_id] : []);
    const primaryHotelId = resolvedHotelIds[0] || null;

    const { rows } = await db.query(`
      INSERT INTO crm_tasks (title, description, hotel_id, hotel_ids, channel_id, assignee, priority, status, category, due_date, tags, created_by, notify_assignee)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [title, description || null, primaryHotelId, resolvedHotelIds, channel_id || null, assignee || null, priority || 'medium', status || 'todo', category || 'operations', due_date || null, tags || [], created_by || null, notify_assignee === true]);

    // Auto-log creation activity
    if (rows[0]) {
      await db.query(`
        INSERT INTO crm_task_comments (task_id, author, body, type)
        VALUES ($1, $2, $3, 'activity')
      `, [rows[0].id, created_by || 'System', 'Created this task']);

      // Enrich with hotel names for notification
      const enriched = { ...rows[0] };
      if (resolvedHotelIds.length > 0) {
        const hResult = await db.query('SELECT property_name FROM hotels WHERE hotel_id = ANY($1::int[])', [resolvedHotelIds]);
        enriched.hotel_names = hResult.rows.map(r => r.property_name);
        enriched.hotel_name = enriched.hotel_names.join(', ');
      }
      notifications.notifyTaskCreated(enriched, created_by).catch(() => {});
    }

    // Sync distribution grid: new task with channels → onboarding
    if (rows[0] && resolvedHotelIds.length > 0 && tags && tags.length > 0) {
      const cat = rows[0].category;
      if (cat === 'distribution' || cat === 'onboarding') {
        syncGridFromTask(resolvedHotelIds, tags, 'onboarding').catch(err => console.error('Grid sync error (create):', err));
      }
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("POST /tasks error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /tasks/:id — update task
router.patch("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const updatedBy = fields.updated_by || 'System';
    delete fields.updated_by;

    // Fetch old task for activity logging
    const old = (await db.query("SELECT * FROM crm_tasks WHERE id = $1", [id])).rows[0];
    if (!old) return res.status(404).json({ error: "Task not found." });

    // Build dynamic SET clause
    const allowed = ['title', 'description', 'hotel_id', 'hotel_ids', 'channel_id', 'assignee', 'priority', 'status', 'category', 'due_date', 'tags', 'notify_assignee'];
    const sets = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(fields[key]);
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: "No fields to update." });

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const { rows } = await db.query(
      `UPDATE crm_tasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );

    // Auto-log activity for status/assignee changes
    if (fields.status && fields.status !== old.status) {
      await db.query(`
        INSERT INTO crm_task_comments (task_id, author, body, type)
        VALUES ($1, $2, $3, 'activity')
      `, [id, updatedBy, `Status changed from ${old.status} to ${fields.status}`]);
    }
    if (fields.assignee && fields.assignee !== old.assignee) {
      await db.query(`
        INSERT INTO crm_task_comments (task_id, author, body, type)
        VALUES ($1, $2, $3, 'activity')
      `, [id, updatedBy, `Assigned to ${fields.assignee}${old.assignee ? ` (was ${old.assignee})` : ''}`]);
    }
    if (fields.priority && fields.priority !== old.priority) {
      await db.query(`
        INSERT INTO crm_task_comments (task_id, author, body, type)
        VALUES ($1, $2, $3, 'activity')
      `, [id, updatedBy, `Priority changed from ${old.priority} to ${fields.priority}`]);
    }

    // Send notifications (fire-and-forget)
    const updated = rows[0];
    if (updated.hotel_ids && updated.hotel_ids.length > 0) {
      const hResult = await db.query('SELECT property_name FROM hotels WHERE hotel_id = ANY($1::int[])', [updated.hotel_ids]);
      updated.hotel_names = hResult.rows.map(r => r.property_name);
      updated.hotel_name = updated.hotel_names.join(', ');
    } else if (updated.hotel_id) {
      const h = (await db.query('SELECT property_name FROM hotels WHERE hotel_id = $1', [updated.hotel_id])).rows[0];
      updated.hotel_name = h?.property_name || null;
    }
    if (fields.assignee && fields.assignee !== old.assignee) {
      notifications.notifyTaskAssigned(updated, old.assignee, updatedBy).catch(() => {});
    }
    if (fields.status && fields.status !== old.status) {
      notifications.notifyStatusChanged(updated, old.status, updatedBy).catch(() => {});

      // Sync distribution grid on status transitions
      const hotelIds = updated.hotel_ids && updated.hotel_ids.length > 0 ? updated.hotel_ids : (updated.hotel_id ? [updated.hotel_id] : []);
      const taskTags = updated.tags || [];
      const cat = updated.category;
      if (hotelIds.length > 0 && taskTags.length > 0 && (cat === 'distribution' || cat === 'onboarding')) {
        if (fields.status === 'done') {
          syncGridFromTask(hotelIds, taskTags, 'live').catch(err => console.error('Grid sync error (done):', err));
        } else if (fields.status === 'todo' || fields.status === 'in_progress' || fields.status === 'review') {
          syncGridFromTask(hotelIds, taskTags, 'onboarding').catch(err => console.error('Grid sync error (reopen):', err));
        }
      }
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("PATCH /tasks/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /tasks/:id
router.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM crm_tasks WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE /tasks/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Task Comments ──

router.get("/tasks/:id/comments", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM crm_task_comments WHERE task_id = $1 ORDER BY created_at ASC",
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error("GET /tasks/:id/comments error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/tasks/:id/comments", async (req, res) => {
  try {
    const { author, body, type } = req.body;
    if (!body) return res.status(400).json({ error: "Body is required." });
    const { rows } = await db.query(`
      INSERT INTO crm_task_comments (task_id, author, body, type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, author || 'System', body, type || 'comment']);

    // Notify on user comments (not system activity)
    if ((type || 'comment') === 'comment') {
      const task = (await db.query(`
        SELECT t.*, h.property_name AS hotel_name
        FROM crm_tasks t LEFT JOIN hotels h ON t.hotel_id = h.hotel_id
        WHERE t.id = $1
      `, [req.params.id])).rows[0];
      if (task) {
        notifications.notifyCommentAdded(task, author || 'System', body).catch(() => {});
      }
    }

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("POST /tasks/:id/comments error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Task Subtasks ──

router.get("/tasks/:id/subtasks", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM crm_task_subtasks WHERE task_id = $1 ORDER BY sort_order ASC",
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    console.error("GET /tasks/:id/subtasks error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/tasks/:id/subtasks", async (req, res) => {
  try {
    const { text, sort_order } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required." });
    const { rows } = await db.query(`
      INSERT INTO crm_task_subtasks (task_id, text, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, text, sort_order || 0]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("POST /tasks/:id/subtasks error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/subtasks/:id", async (req, res) => {
  try {
    const { done, text } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (done !== undefined) { sets.push(`done = $${idx++}`); params.push(done); }
    if (text !== undefined) { sets.push(`text = $${idx++}`); params.push(text); }

    if (sets.length === 0) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE crm_task_subtasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "Subtask not found." });
    res.json(rows[0]);
  } catch (error) {
    console.error("PATCH /subtasks/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/subtasks/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM crm_task_subtasks WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE /subtasks/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════

// GET /channels — list all channels with contacts, notes, and properties connected
router.get("/channels", async (req, res) => {
  try {
    const { rows: channels } = await db.query(`
      SELECT dc.*,
        COALESCE(hc.properties_connected, 0) AS properties_connected
      FROM distribution_channels dc
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE status != 'none') AS properties_connected
        FROM distribution_hotel_channels WHERE channel_id = dc.id
      ) hc ON true
      ORDER BY dc.name ASC
    `);

    // Fetch contacts and notes for all channels in batch
    const channelIds = channels.map(c => c.id);
    if (channelIds.length > 0) {
      const { rows: contacts } = await db.query(
        "SELECT * FROM distribution_channel_contacts WHERE channel_id = ANY($1) ORDER BY id",
        [channelIds]
      );
      const { rows: notes } = await db.query(
        "SELECT * FROM distribution_channel_notes WHERE channel_id = ANY($1) ORDER BY created_at DESC",
        [channelIds]
      );

      for (const ch of channels) {
        ch.contacts = contacts.filter(c => c.channel_id === ch.id);
        ch.internal_notes = notes.filter(n => n.channel_id === ch.id);
      }
    }

    res.json(channels);
  } catch (error) {
    console.error("GET /channels error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /channels — create channel
router.post("/channels", async (req, res) => {
  try {
    const { name, slug, agreement_type, tier, integration_type, commission_pct, contract_expiry, notes, channel_type, payment_method } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required." });

    let channelSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // Ensure unique slug — append random suffix if collision
    const existing = await db.query("SELECT 1 FROM distribution_channels WHERE slug = $1", [channelSlug]);
    if (existing.rows.length > 0) {
      channelSlug = channelSlug + '-' + Date.now().toString(36).slice(-4);
    }
    const { rows } = await db.query(`
      INSERT INTO distribution_channels (name, slug, agreement_type, tier, integration_type, commission_pct, contract_expiry, notes, channel_type, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [name, channelSlug, agreement_type || 'individual', tier || 'experimental', integration_type || 'extranet', commission_pct ?? null, contract_expiry || null, notes || null, channel_type || null, payment_method || null]);

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("POST /channels error:", error);
    if (error.code === '23505') {
      return res.status(409).json({ error: "A channel with this name already exists." });
    }
    res.status(500).json({ error: error.message });
  }
});

// PATCH /channels/:id — update channel
router.patch("/channels/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'slug', 'agreement_type', 'tier', 'integration_type', 'commission_pct', 'contract_expiry', 'notes', 'channel_type', 'payment_method'];
    const sets = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: "No fields to update." });
    sets.push("updated_at = NOW()");
    params.push(id);

    const { rows } = await db.query(
      `UPDATE distribution_channels SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "Channel not found." });
    res.json(rows[0]);
  } catch (error) {
    console.error("PATCH /channels/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /channels/:id — wipes channel + its waterfall + per-hotel overrides
// + grid connection rows. Contacts, notes, and crm_tasks.channel_id cascade
// or null automatically via FKs. Wrapped in a transaction so a mid-delete
// failure leaves no partial state.
router.delete("/channels/:id", async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    await client.query("BEGIN");
    await client.query("DELETE FROM distribution_hotel_pricing_overrides WHERE channel_id = $1", [id]);
    await client.query("DELETE FROM distribution_channel_pricing WHERE channel_id = $1", [id]);
    await client.query("DELETE FROM distribution_hotel_channels WHERE channel_id = $1", [id]);
    await client.query("DELETE FROM distribution_channels WHERE id = $1", [id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("DELETE /channels/:id error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ── Channel Contacts ──

router.post("/channels/:id/contacts", async (req, res) => {
  try {
    const { name, role, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required." });
    const { rows } = await db.query(`
      INSERT INTO distribution_channel_contacts (channel_id, name, role, email, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.params.id, name, role || null, email || null, phone || null]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("POST /channels/:id/contacts error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/contacts/:id", async (req, res) => {
  try {
    const allowed = ['name', 'role', 'email', 'phone'];
    const sets = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: "No fields to update." });
    params.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE distribution_channel_contacts SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "Contact not found." });
    res.json(rows[0]);
  } catch (error) {
    console.error("PATCH /contacts/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/contacts/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM distribution_channel_contacts WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE /contacts/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ── Channel Notes ──

router.post("/channels/:id/notes", async (req, res) => {
  try {
    const { author, body } = req.body;
    if (!body) return res.status(400).json({ error: "Body is required." });
    const { rows } = await db.query(`
      INSERT INTO distribution_channel_notes (channel_id, author, body)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [req.params.id, author || 'System', body]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("POST /channels/:id/notes error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/notes/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM distribution_channel_notes WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE /notes/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// DISTRIBUTION GRID (Hotel × Channel)
// ═══════════════════════════════════════════

// GET /grid — full hotel×channel status matrix
router.get("/grid", async (req, res) => {
  try {
    // Get all managed hotels (rockenue_managed = true, not disconnected)
    const { rows: hotels } = await db.query(`
      SELECT hotel_id, property_name AS hotel_name FROM hotels
      WHERE is_rockenue_managed = true AND (is_disconnected IS NULL OR is_disconnected = false)
      ORDER BY property_name ASC
    `);

    // Get all channels
    const { rows: channels } = await db.query(
      "SELECT id, name, slug FROM distribution_channels ORDER BY id ASC"
    );

    // Get all grid cells
    const { rows: cells } = await db.query(
      "SELECT hotel_id, channel_id, status, suspension_reason, suspended_by, suspended_at FROM distribution_hotel_channels"
    );

    // Build grid map: { hotelId: { channelId: { status, suspension_reason, ... } } }
    const grid = {};
    for (const cell of cells) {
      if (!grid[cell.hotel_id]) grid[cell.hotel_id] = {};
      grid[cell.hotel_id][cell.channel_id] = {
        status: cell.status,
        suspension_reason: cell.suspension_reason,
        suspended_by: cell.suspended_by,
        suspended_at: cell.suspended_at,
      };
    }

    res.json({ hotels, channels, grid });
  } catch (error) {
    console.error("GET /grid error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /grid — update single cell status
router.patch("/grid", async (req, res) => {
  try {
    const { hotel_id, channel_id, status, suspension_reason, suspended_by } = req.body;
    if (!hotel_id || !channel_id || !status) {
      return res.status(400).json({ error: "hotel_id, channel_id, and status are required." });
    }

    const validStatuses = ['live', 'onboarding', 'suspended', 'none'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    if (status === 'suspended') {
      await db.query(`
        INSERT INTO distribution_hotel_channels (hotel_id, channel_id, status, suspension_reason, suspended_by, suspended_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (hotel_id, channel_id)
        DO UPDATE SET status = $3, suspension_reason = $4, suspended_by = $5, suspended_at = NOW(), updated_at = NOW()
      `, [hotel_id, channel_id, status, suspension_reason || null, suspended_by || null]);
    } else {
      await db.query(`
        INSERT INTO distribution_hotel_channels (hotel_id, channel_id, status, suspension_reason, suspended_by, suspended_at, updated_at)
        VALUES ($1, $2, $3, NULL, NULL, NULL, NOW())
        ON CONFLICT (hotel_id, channel_id)
        DO UPDATE SET status = $3, suspension_reason = NULL, suspended_by = NULL, suspended_at = NULL, updated_at = NOW()
      `, [hotel_id, channel_id, status]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("PATCH /grid error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// CHANNEL PRICING (Waterfall defaults + hotel overrides)
// ═══════════════════════════════════════════

// GET /pricing — all channel pricing defaults with their channel meta + override counts
router.get("/pricing", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        dc.id AS channel_id, dc.name, dc.slug,
        dc.agreement_type, dc.channel_type, dc.commission_pct, dc.payment_method,
        dc.contract_expiry, dc.notes,
        dcp.steps,
        COALESCE(ov.override_count, 0) AS override_count
      FROM distribution_channels dc
      LEFT JOIN distribution_channel_pricing dcp ON dcp.channel_id = dc.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS override_count FROM distribution_hotel_pricing_overrides WHERE channel_id = dc.id
      ) ov ON true
      WHERE dcp.steps IS NOT NULL
      ORDER BY dc.name ASC
    `);

    // Also fetch primary contact per channel
    for (const ch of rows) {
      const contact = (await db.query(
        "SELECT name, email FROM distribution_channel_contacts WHERE channel_id = $1 ORDER BY id LIMIT 1",
        [ch.channel_id]
      )).rows[0];
      ch.primary_contact = contact?.name || null;
      ch.contact_email = contact?.email || null;
    }

    res.json(rows);
  } catch (error) {
    console.error("GET /pricing error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /pricing/:channelId — single channel pricing with all hotel overrides
router.get("/pricing/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = (await db.query(`
      SELECT dc.*, dcp.steps
      FROM distribution_channels dc
      LEFT JOIN distribution_channel_pricing dcp ON dcp.channel_id = dc.id
      WHERE dc.id = $1
    `, [channelId])).rows[0];

    if (!channel) return res.status(404).json({ error: "Channel not found." });

    // Get primary contact
    const contact = (await db.query(
      "SELECT name, email FROM distribution_channel_contacts WHERE channel_id = $1 ORDER BY id LIMIT 1",
      [channelId]
    )).rows[0];
    channel.primary_contact = contact?.name || null;
    channel.contact_email = contact?.email || null;

    // Get all hotel overrides for this channel
    const { rows: overrides } = await db.query(`
      SELECT dhpo.hotel_id, h.property_name AS hotel_name, dhpo.overrides
      FROM distribution_hotel_pricing_overrides dhpo
      JOIN hotels h ON h.hotel_id = dhpo.hotel_id
      WHERE dhpo.channel_id = $1
      ORDER BY h.property_name ASC
    `, [channelId]);

    // Get all managed hotels
    const { rows: hotels } = await db.query(`
      SELECT hotel_id, property_name AS hotel_name FROM hotels
      WHERE is_rockenue_managed = true AND (is_disconnected IS NULL OR is_disconnected = false)
      ORDER BY property_name ASC
    `);

    res.json({ channel, overrides, hotels });
  } catch (error) {
    console.error("GET /pricing/:channelId error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /pricing/:channelId — update channel pricing defaults (waterfall steps)
router.patch("/pricing/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { steps } = req.body;
    if (!steps) return res.status(400).json({ error: "steps is required." });

    const { rows } = await db.query(`
      INSERT INTO distribution_channel_pricing (channel_id, steps, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (channel_id)
      DO UPDATE SET steps = $2, updated_at = NOW()
      RETURNING *
    `, [channelId, JSON.stringify(steps)]);

    res.json(rows[0]);
  } catch (error) {
    console.error("PATCH /pricing/:channelId error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /pricing/:channelId/override/:hotelId — set or update hotel override
router.put("/pricing/:channelId/override/:hotelId", async (req, res) => {
  try {
    const { channelId, hotelId } = req.params;
    const { overrides } = req.body;
    if (!overrides) return res.status(400).json({ error: "overrides is required." });

    const { rows } = await db.query(`
      INSERT INTO distribution_hotel_pricing_overrides (hotel_id, channel_id, overrides, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (hotel_id, channel_id)
      DO UPDATE SET overrides = $3, updated_at = NOW()
      RETURNING *
    `, [hotelId, channelId, JSON.stringify(overrides)]);

    res.json(rows[0]);
  } catch (error) {
    console.error("PUT /pricing override error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /pricing/:channelId/override/:hotelId — remove hotel override (revert to default)
router.delete("/pricing/:channelId/override/:hotelId", async (req, res) => {
  try {
    const { channelId, hotelId } = req.params;
    await db.query(
      "DELETE FROM distribution_hotel_pricing_overrides WHERE hotel_id = $1 AND channel_id = $2",
      [hotelId, channelId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("DELETE /pricing override error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
