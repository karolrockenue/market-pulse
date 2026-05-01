const express = require("express");
const router = express.Router();
const { requireAdminApi } = require("../utils/middleware");
const db = require("../utils/db");
const salesCrm = require("../services/sales-crm.service");

// All Sales endpoints are admin-only
router.use(requireAdminApi);

// ─────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────
router.get("/_health", (req, res) => {
  res.json({ ok: true, router: "sales" });
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const CH_REGEX = /^[A-Z0-9]{6,20}$/;

function normalizeChNumber(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!CH_REGEX.test(cleaned)) return undefined; // sentinel for "invalid"
  return cleaned;
}

function asInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ═══════════════════════════════════════════════════
// COMPANIES
// ═══════════════════════════════════════════════════

// GET /companies — list (with hotel count)
router.get("/companies", async (req, res) => {
  try {
    const { q, has_ch_number } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;

    if (q) { conditions.push(`LOWER(c.name) LIKE LOWER($${i++})`); params.push(`%${q}%`); }
    if (has_ch_number === "true") conditions.push("c.companies_house_number IS NOT NULL");
    if (has_ch_number === "false") conditions.push("c.companies_house_number IS NULL");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await db.query(`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM hotels h WHERE h.company_id = c.id) AS hotel_count,
        p.full_name AS primary_contact_name
      FROM companies c
      LEFT JOIN people p ON p.id = c.primary_contact_id
      ${where}
      ORDER BY c.name ASC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error("GET /companies error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /companies/:id — detail with hotels + primary contact
router.get("/companies/:id", async (req, res) => {
  try {
    const id = asInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "invalid id" });

    const { rows: companyRows } = await db.query(`
      SELECT c.*, p.full_name AS primary_contact_name, p.email AS primary_contact_email
      FROM companies c
      LEFT JOIN people p ON p.id = c.primary_contact_id
      WHERE c.id = $1
    `, [id]);
    if (companyRows.length === 0) return res.status(404).json({ error: "company not found" });

    const { rows: hotels } = await db.query(`
      SELECT hotel_id, property_name, city, prospect_status, prospect_score, is_rockenue_managed
      FROM hotels WHERE company_id = $1
      ORDER BY property_name ASC
    `, [id]);

    res.json({ ...companyRows[0], hotels });
  } catch (err) {
    console.error("GET /companies/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /companies — create
router.post("/companies", async (req, res) => {
  try {
    const { name, companies_house_number, company_type, website, notes, primary_contact_id } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
    if (name.length > 255) return res.status(400).json({ error: "name max 255 chars" });

    let ch = null;
    if (companies_house_number) {
      ch = normalizeChNumber(companies_house_number);
      if (ch === undefined) return res.status(400).json({ error: "invalid companies_house_number — expected 6–20 alphanumerics" });
    }

    if (company_type && !salesCrm.COMPANY_TYPES.includes(company_type)) {
      return res.status(400).json({ error: `invalid company_type. Allowed: ${salesCrm.COMPANY_TYPES.join(", ")}` });
    }

    // Dedup: case-insensitive name
    const { rows: dup } = await db.query(`SELECT * FROM companies WHERE LOWER(name) = LOWER($1)`, [name]);
    if (dup.length) return res.status(409).json({ error: "company name already exists", existing: dup[0] });

    if (ch) {
      const { rows: dupCh } = await db.query(`SELECT * FROM companies WHERE companies_house_number = $1`, [ch]);
      if (dupCh.length) return res.status(409).json({ error: "Companies House number already used", existing: dupCh[0] });
    }

    const { rows } = await db.query(`
      INSERT INTO companies (name, companies_house_number, company_type, website, notes, primary_contact_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name.trim(), ch, company_type || null, website || null, notes || null, asInt(primary_contact_id)]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /companies error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /companies/:id — update
router.patch("/companies/:id", async (req, res) => {
  try {
    const id = asInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "invalid id" });

    const allowed = ["name", "companies_house_number", "company_type", "website", "notes", "primary_contact_id"];
    const updates = [];
    const params = [];
    let i = 1;

    for (const field of allowed) {
      if (!(field in (req.body || {}))) continue;
      let v = req.body[field];
      if (field === "companies_house_number" && v) {
        v = normalizeChNumber(v);
        if (v === undefined) return res.status(400).json({ error: "invalid companies_house_number" });
      }
      if (field === "company_type" && v && !salesCrm.COMPANY_TYPES.includes(v)) {
        return res.status(400).json({ error: `invalid company_type` });
      }
      if (field === "primary_contact_id") v = asInt(v);
      updates.push(`${field} = $${i++}`);
      params.push(v);
    }
    if (updates.length === 0) return res.status(400).json({ error: "no updatable fields provided" });
    params.push(id);

    const { rows } = await db.query(
      `UPDATE companies SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "company not found" });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "uniqueness violation", detail: err.detail });
    console.error("PATCH /companies/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /companies/:id — refuse if hotels reference, else hard delete
router.delete("/companies/:id", async (req, res) => {
  try {
    const id = asInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "invalid id" });

    const { rows: linked } = await db.query(
      `SELECT hotel_id, property_name FROM hotels WHERE company_id = $1`,
      [id]
    );
    if (linked.length) {
      return res.status(409).json({
        error: "company has linked hotels — unlink first",
        linked_hotels: linked,
      });
    }

    const { rowCount } = await db.query(`DELETE FROM companies WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: "company not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /companies/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// PEOPLE
// ═══════════════════════════════════════════════════

// GET /people — list with hotel count
router.get("/people", async (req, res) => {
  try {
    const { q, email } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;

    if (q) {
      conditions.push(`(LOWER(p.full_name) LIKE LOWER($${i}) OR LOWER(p.email) LIKE LOWER($${i}))`);
      params.push(`%${q}%`);
      i++;
    }
    if (email) { conditions.push(`LOWER(p.email) = LOWER($${i++})`); params.push(email); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await db.query(`
      SELECT p.*,
        (SELECT COUNT(*)::int FROM hotel_people hp WHERE hp.person_id = p.id) AS hotel_count
      FROM people p
      ${where}
      ORDER BY p.full_name ASC
    `, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /people error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /people/:id — detail with hotel_people relationships
router.get("/people/:id", async (req, res) => {
  try {
    const id = asInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "invalid id" });

    const { rows: person } = await db.query(`SELECT * FROM people WHERE id = $1`, [id]);
    if (person.length === 0) return res.status(404).json({ error: "person not found" });

    const { rows: hotels } = await db.query(`
      SELECT hp.role, hp.is_primary, hp.notes,
        h.hotel_id, h.property_name, h.city, h.prospect_status
      FROM hotel_people hp
      JOIN hotels h ON h.hotel_id = hp.hotel_id
      WHERE hp.person_id = $1
      ORDER BY h.property_name ASC
    `, [id]);

    const { rows: companies } = await db.query(
      `SELECT id, name, company_type FROM companies WHERE primary_contact_id = $1`,
      [id]
    );

    res.json({ ...person[0], hotels, companies });
  } catch (err) {
    console.error("GET /people/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /people — create
router.post("/people", async (req, res) => {
  try {
    const { full_name, email, phone, whatsapp, linkedin_url, job_title, notes } = req.body || {};
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: "full_name is required" });
    if (email && !email.includes("@")) return res.status(400).json({ error: "invalid email" });

    const { rows } = await db.query(`
      INSERT INTO people (full_name, email, phone, whatsapp, linkedin_url, job_title, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      full_name.trim(), email || null, phone || null, whatsapp || null,
      linkedin_url || null, job_title || null, notes || null,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "email or whatsapp already used", detail: err.detail });
    console.error("POST /people error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /people/:id
router.patch("/people/:id", async (req, res) => {
  try {
    const id = asInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "invalid id" });

    const allowed = ["full_name", "email", "phone", "whatsapp", "linkedin_url", "job_title", "notes"];
    const updates = [];
    const params = [];
    let i = 1;
    for (const field of allowed) {
      if (!(field in (req.body || {}))) continue;
      const v = req.body[field];
      if (field === "email" && v && !v.includes("@")) {
        return res.status(400).json({ error: "invalid email" });
      }
      updates.push(`${field} = $${i++}`);
      params.push(v);
    }
    if (updates.length === 0) return res.status(400).json({ error: "no updatable fields" });
    params.push(id);

    const { rows } = await db.query(
      `UPDATE people SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: "person not found" });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "uniqueness violation", detail: err.detail });
    console.error("PATCH /people/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /people/:id (cascades to hotel_people via FK; clears companies.primary_contact_id)
router.delete("/people/:id", async (req, res) => {
  try {
    const id = asInt(req.params.id);
    if (id === null) return res.status(400).json({ error: "invalid id" });
    const { rowCount } = await db.query(`DELETE FROM people WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: "person not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /people/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// HOTEL_PEOPLE — relationships per hotel
// ═══════════════════════════════════════════════════

// GET /hotels/:hotel_id/people
router.get("/hotels/:hotel_id/people", async (req, res) => {
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { rows } = await db.query(`
      SELECT hp.role, hp.is_primary, hp.notes, hp.created_at,
        p.id AS person_id, p.full_name, p.email, p.phone, p.whatsapp, p.job_title, p.linkedin_url
      FROM hotel_people hp
      JOIN people p ON p.id = hp.person_id
      WHERE hp.hotel_id = $1
      ORDER BY hp.is_primary DESC, p.full_name ASC
    `, [hotel_id]);
    res.json(rows);
  } catch (err) {
    console.error("GET /hotels/:hotel_id/people error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /hotels/:hotel_id/people — link existing or create+link new
router.post("/hotels/:hotel_id/people", async (req, res) => {
  const client = await db.connect();
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { person_id, person, role, is_primary, notes } = req.body || {};
    if (!role) return res.status(400).json({ error: "role is required" });
    if (!salesCrm.HOTEL_PEOPLE_ROLES.includes(role)) {
      return res.status(400).json({ error: `invalid role. Allowed: ${salesCrm.HOTEL_PEOPLE_ROLES.join(", ")}` });
    }

    await client.query("BEGIN");

    // Resolve person — either existing (person_id) or inline create (person)
    let resolvedPersonId = asInt(person_id);
    if (!resolvedPersonId && person) {
      const created = await salesCrm.upsertPerson(person, client);
      resolvedPersonId = created.id;
    }
    if (!resolvedPersonId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "either person_id or person object required" });
    }

    const link = await salesCrm.linkHotelPerson(
      hotel_id, resolvedPersonId, role,
      { is_primary: !!is_primary, notes: notes || null },
      client
    );

    await client.query("COMMIT");
    res.status(201).json(link);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23503") return res.status(404).json({ error: "hotel or person not found", detail: err.detail });
    console.error("POST /hotels/:hotel_id/people error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /hotels/:hotel_id/people/:person_id/:role
router.patch("/hotels/:hotel_id/people/:person_id/:role", async (req, res) => {
  try {
    const hotel_id = asInt(req.params.hotel_id);
    const person_id = asInt(req.params.person_id);
    const role = req.params.role;
    if (hotel_id === null || person_id === null) return res.status(400).json({ error: "invalid ids" });
    if (!salesCrm.HOTEL_PEOPLE_ROLES.includes(role)) return res.status(400).json({ error: "invalid role" });

    const { is_primary, notes } = req.body || {};
    const updates = [];
    const params = [];
    let i = 1;
    if (is_primary !== undefined) { updates.push(`is_primary = $${i++}`); params.push(!!is_primary); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); params.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: "no updatable fields" });

    // If marking primary, demote other primaries first
    if (is_primary === true) {
      await db.query(
        `UPDATE hotel_people SET is_primary = FALSE WHERE hotel_id = $1 AND role = $2 AND is_primary = TRUE AND person_id <> $3`,
        [hotel_id, role, person_id]
      );
    }

    params.push(hotel_id, person_id, role);
    const { rows } = await db.query(`
      UPDATE hotel_people SET ${updates.join(", ")}
      WHERE hotel_id = $${i++} AND person_id = $${i++} AND role = $${i}
      RETURNING *
    `, params);
    if (rows.length === 0) return res.status(404).json({ error: "link not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("PATCH /hotels/:hotel_id/people/:person_id/:role error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /hotels/:hotel_id/people/:person_id/:role
router.delete("/hotels/:hotel_id/people/:person_id/:role", async (req, res) => {
  try {
    const hotel_id = asInt(req.params.hotel_id);
    const person_id = asInt(req.params.person_id);
    const role = req.params.role;
    if (hotel_id === null || person_id === null) return res.status(400).json({ error: "invalid ids" });

    const { rowCount } = await db.query(
      `DELETE FROM hotel_people WHERE hotel_id = $1 AND person_id = $2 AND role = $3`,
      [hotel_id, person_id, role]
    );
    if (rowCount === 0) return res.status(404).json({ error: "link not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /hotels/:hotel_id/people/:person_id/:role error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// HOTEL_ACTIVITIES — append-only timeline
// ═══════════════════════════════════════════════════

// GET /activities — cross-hotel feed (most recent across ALL hotels)
router.get("/activities", async (req, res) => {
  try {
    const { type, actor, before } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;
    if (type)   { conditions.push(`a.type = $${i++}`); params.push(type); }
    if (actor)  { conditions.push(`a.actor = $${i++}`); params.push(actor); }
    if (before) { conditions.push(`a.created_at < $${i++}`); params.push(before); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const lim = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const off = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    params.push(lim);
    params.push(off);

    const { rows } = await db.query(`
      SELECT a.id, a.hotel_id, a.type, a.actor, a.subject, a.body,
             a.artifact_url, a.metadata, a.created_at,
             h.property_name AS hotel_name
      FROM hotel_activities a
      LEFT JOIN hotels h ON h.hotel_id = a.hotel_id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${i++} OFFSET $${i}
    `, params);

    res.json(rows);
  } catch (err) {
    console.error("GET /activities error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /hotels/:hotel_id/activities — paginated, filterable
router.get("/hotels/:hotel_id/activities", async (req, res) => {
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { type, actor, limit = 50, before } = req.query;
    const conditions = ["hotel_id = $1"];
    const params = [hotel_id];
    let i = 2;
    if (type) { conditions.push(`type = $${i++}`); params.push(type); }
    if (actor) { conditions.push(`actor = $${i++}`); params.push(actor); }
    if (before) { conditions.push(`created_at < $${i++}`); params.push(before); }

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    params.push(lim);
    const { rows } = await db.query(`
      SELECT * FROM hotel_activities
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${i}
    `, params);

    res.json(rows);
  } catch (err) {
    console.error("GET /hotels/:hotel_id/activities error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /hotels/:hotel_id/activities — manual entry
router.post("/hotels/:hotel_id/activities", async (req, res) => {
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { type, actor, subject, body, artifact_url, metadata } = req.body || {};
    if (!type) return res.status(400).json({ error: "type is required" });
    if (!salesCrm.ACTIVITY_TYPES.includes(type)) {
      return res.status(400).json({ error: `invalid type. Allowed: ${salesCrm.ACTIVITY_TYPES.join(", ")}` });
    }

    const result = await salesCrm.recordActivity({
      hotel_id, type, actor, subject, body, artifact_url, metadata,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === "23503") return res.status(404).json({ error: "hotel not found" });
    console.error("POST /hotels/:hotel_id/activities error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// PROSPECTS — pipeline view of hotels
// ═══════════════════════════════════════════════════

// GET /prospects — list (hotels with prospect_status NOT NULL)
router.get("/prospects", async (req, res) => {
  try {
    const { status, owner, q } = req.query;
    const conditions = ["h.prospect_status IS NOT NULL"];
    const params = [];
    let i = 1;
    if (status) { conditions.push(`h.prospect_status = $${i++}`); params.push(status); }
    if (owner) { conditions.push(`h.prospect_owner = $${i++}`); params.push(owner); }
    if (q) {
      conditions.push(`(LOWER(h.property_name) LIKE LOWER($${i}) OR LOWER(h.city) LIKE LOWER($${i}))`);
      params.push(`%${q}%`);
      i++;
    }

    const { rows } = await db.query(`
      SELECT
        h.hotel_id, h.property_name, h.city,
        h.prospect_status, h.prospect_score, h.prospect_owner,
        h.last_agent_review_at, h.study_generated_at, h.study_artifact_url,
        h.booking_property_id, h.company_id,
        c.name AS company_name,
        (SELECT MAX(created_at) FROM hotel_activities a WHERE a.hotel_id = h.hotel_id) AS last_activity_at,
        (SELECT json_build_object('full_name', p.full_name, 'email', p.email, 'phone', p.phone)
           FROM hotel_people hp JOIN people p ON p.id = hp.person_id
           WHERE hp.hotel_id = h.hotel_id AND hp.is_primary = TRUE
           LIMIT 1) AS primary_person
      FROM hotels h
      LEFT JOIN companies c ON c.id = h.company_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY h.prospect_score DESC NULLS LAST, h.property_name ASC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error("GET /prospects error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /prospects/:hotel_id — single prospect detail
router.get("/prospects/:hotel_id", async (req, res) => {
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { rows: hotelRows } = await db.query(`
      SELECT h.*, c.name AS company_name, c.companies_house_number, c.company_type
      FROM hotels h
      LEFT JOIN companies c ON c.id = h.company_id
      WHERE h.hotel_id = $1
    `, [hotel_id]);
    if (hotelRows.length === 0) return res.status(404).json({ error: "hotel not found" });

    const { rows: people } = await db.query(`
      SELECT hp.role, hp.is_primary,
        p.id AS person_id, p.full_name, p.email, p.phone, p.whatsapp, p.job_title
      FROM hotel_people hp JOIN people p ON p.id = hp.person_id
      WHERE hp.hotel_id = $1
      ORDER BY hp.is_primary DESC, p.full_name ASC
    `, [hotel_id]);

    const { rows: activities } = await db.query(`
      SELECT * FROM hotel_activities WHERE hotel_id = $1
      ORDER BY created_at DESC LIMIT 50
    `, [hotel_id]);

    const { rows: lossRows } = await db.query(
      `SELECT * FROM loss_reasons WHERE hotel_id = $1`, [hotel_id]
    );

    res.json({
      ...hotelRows[0],
      people,
      activities,
      loss_reason: lossRows[0] || null,
    });
  } catch (err) {
    console.error("GET /prospects/:hotel_id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /prospects/:hotel_id — update prospect_status / owner / study
router.patch("/prospects/:hotel_id", async (req, res) => {
  const client = await db.connect();
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { prospect_status, prospect_owner, study_artifact_url, study_generated_at, prospect_score, company_id, actor, reason } = req.body || {};

    await client.query("BEGIN");

    if (prospect_status !== undefined) {
      if (!salesCrm.PROSPECT_STATUSES.includes(prospect_status)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "invalid prospect_status" });
      }
      await salesCrm.updateProspectStatus(hotel_id, prospect_status, { actor: actor || "user", reason }, client);
    }

    const otherUpdates = [];
    const params = [];
    let i = 1;
    if (prospect_owner !== undefined) { otherUpdates.push(`prospect_owner = $${i++}`); params.push(prospect_owner); }
    if (study_artifact_url !== undefined) { otherUpdates.push(`study_artifact_url = $${i++}`); params.push(study_artifact_url); }
    if (study_generated_at !== undefined) { otherUpdates.push(`study_generated_at = $${i++}`); params.push(study_generated_at); }
    if (prospect_score !== undefined) { otherUpdates.push(`prospect_score = $${i++}`); params.push(prospect_score); }
    if (company_id !== undefined) { otherUpdates.push(`company_id = $${i++}`); params.push(asInt(company_id)); }

    if (otherUpdates.length) {
      params.push(hotel_id);
      await client.query(
        `UPDATE hotels SET ${otherUpdates.join(", ")} WHERE hotel_id = $${i}`,
        params
      );
    }

    const { rows } = await client.query(
      `SELECT * FROM hotels WHERE hotel_id = $1`, [hotel_id]
    );
    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH /prospects/:hotel_id error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /prospects/:hotel_id/lose — set status=lost + insert loss reason
router.post("/prospects/:hotel_id/lose", async (req, res) => {
  const client = await db.connect();
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { reason_code, competitor_name, notes, recorded_by } = req.body || {};
    if (!reason_code) return res.status(400).json({ error: "reason_code is required" });
    if (!salesCrm.LOSS_REASON_CODES.includes(reason_code)) {
      return res.status(400).json({
        error: `invalid reason_code "${reason_code}". Allowed: ${salesCrm.LOSS_REASON_CODES.join(", ")}`,
      });
    }

    await client.query("BEGIN");
    await client.query(`
      INSERT INTO loss_reasons (hotel_id, reason_code, competitor_name, notes, recorded_by)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (hotel_id) DO UPDATE SET
        reason_code = EXCLUDED.reason_code,
        competitor_name = EXCLUDED.competitor_name,
        notes = EXCLUDED.notes,
        recorded_at = NOW(),
        recorded_by = EXCLUDED.recorded_by
    `, [hotel_id, reason_code, competitor_name || null, notes || null, recorded_by || null]);

    await salesCrm.updateProspectStatus(hotel_id, "lost", {
      actor: recorded_by || "user",
      reason: `${reason_code}${competitor_name ? ` (${competitor_name})` : ""}`,
    }, client);

    await client.query("COMMIT");
    res.json({ ok: true, hotel_id, reason_code });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /prospects/:hotel_id/lose error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /prospects/:hotel_id/reopen — clear loss + reset to chosen earlier stage
router.post("/prospects/:hotel_id/reopen", async (req, res) => {
  const client = await db.connect();
  try {
    const hotel_id = asInt(req.params.hotel_id);
    if (hotel_id === null) return res.status(400).json({ error: "invalid hotel_id" });

    const { new_status = "studied", actor } = req.body || {};
    if (!salesCrm.PROSPECT_STATUSES.includes(new_status)) {
      return res.status(400).json({ error: "invalid new_status" });
    }

    await client.query("BEGIN");
    await client.query(`DELETE FROM loss_reasons WHERE hotel_id = $1`, [hotel_id]);
    await salesCrm.updateProspectStatus(hotel_id, new_status, {
      actor: actor || "user",
      reason: "reopened from lost",
    }, client);
    await client.query("COMMIT");
    res.json({ ok: true, hotel_id, prospect_status: new_status });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /prospects/:hotel_id/reopen error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════
// LOSS REASONS — aggregated stats
// ═══════════════════════════════════════════════════

router.get("/loss-reasons", async (req, res) => {
  try {
    const { rows: byReason } = await db.query(`
      SELECT reason_code, COUNT(*)::int AS n
      FROM loss_reasons GROUP BY reason_code ORDER BY n DESC
    `);
    const { rows: byCompetitor } = await db.query(`
      SELECT competitor_name, COUNT(*)::int AS n
      FROM loss_reasons WHERE competitor_name IS NOT NULL
      GROUP BY competitor_name ORDER BY n DESC
    `);
    const { rows: list } = await db.query(`
      SELECT lr.*, h.property_name, h.city
      FROM loss_reasons lr
      JOIN hotels h ON h.hotel_id = lr.hotel_id
      ORDER BY lr.recorded_at DESC
      LIMIT 200
    `);
    res.json({ by_reason: byReason, by_competitor: byCompetitor, list });
  } catch (err) {
    console.error("GET /loss-reasons error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
