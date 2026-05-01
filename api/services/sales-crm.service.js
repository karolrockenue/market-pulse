// Sales CRM service layer — used by sales.router.js endpoints AND by future agents.
// All functions accept an optional `dbClient` so callers can run inside a transaction.
const db = require("../utils/db");

const COMPANY_TYPES = ["management_co", "operating_co", "holding_co", "family_office", "unknown"];
const HOTEL_PEOPLE_ROLES = ["owner", "gm", "revenue_manager", "accountant", "asset_manager", "family_office", "reservations", "maintenance", "other"];
const PROSPECT_STATUSES = ["cold", "studied", "outreached", "in_conversation", "proposal", "signed", "live", "lost", "churned"];
const LOSS_REASON_CODES = ["price", "not_ready", "wrong_contact", "bad_fit", "competitor_won", "no_response", "other"];
// NB: pipeline UI uses 6 columns (cold/studied/outreached/in_conversation/proposal/lost). "signed" is a transient
// sub-state under proposal that auto-promotes to "live"; "live" + "churned" reflect managed-hotel reality.

const ACTIVITY_TYPES = [
  "email_sent", "email_received", "whatsapp_sent", "whatsapp_received",
  "call", "meeting", "study_generated", "note", "status_change",
  "prospect_scored", "agent_research", "task_linked",
];

const c = (passed) => passed || db;

// ─────────────────────────────────────────────
// ACTIVITIES — append-only timeline
// ─────────────────────────────────────────────
async function recordActivity({ hotel_id, type, actor, subject, body, artifact_url, metadata }, dbClient) {
  if (!hotel_id) throw new Error("recordActivity: hotel_id required");
  if (!type || !ACTIVITY_TYPES.includes(type)) {
    throw new Error(`recordActivity: invalid type "${type}". Allowed: ${ACTIVITY_TYPES.join(", ")}`);
  }
  const { rows } = await c(dbClient).query(`
    INSERT INTO hotel_activities (hotel_id, type, actor, subject, body, artifact_url, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, created_at
  `, [
    hotel_id, type, actor || null, subject || null, body || null,
    artifact_url || null, JSON.stringify(metadata || {}),
  ]);
  return rows[0];
}

// ─────────────────────────────────────────────
// COMPANIES — find-or-create, with light merge of empty fields
// ─────────────────────────────────────────────
async function upsertCompany({ name, companies_house_number, company_type, website, notes }, dbClient) {
  if (!name || !name.trim()) throw new Error("upsertCompany: name required");
  const ch = companies_house_number
    ? companies_house_number.replace(/\s+/g, "").toUpperCase()
    : null;

  // Find by CH number first (most specific)
  if (ch) {
    const { rows } = await c(dbClient).query(
      `SELECT * FROM companies WHERE companies_house_number = $1`,
      [ch]
    );
    if (rows.length) return rows[0];
  }

  // Find by case-insensitive name
  const { rows: byName } = await c(dbClient).query(
    `SELECT * FROM companies WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  if (byName.length) {
    const existing = byName[0];
    // Merge empty fields without overwriting non-null data
    const updates = [];
    const params = [];
    let i = 1;
    if (ch && !existing.companies_house_number) { updates.push(`companies_house_number = $${i++}`); params.push(ch); }
    if (company_type && !existing.company_type) { updates.push(`company_type = $${i++}`); params.push(company_type); }
    if (website && !existing.website) { updates.push(`website = $${i++}`); params.push(website); }
    if (updates.length) {
      params.push(existing.id);
      const { rows: updated } = await c(dbClient).query(
        `UPDATE companies SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
        params
      );
      return updated[0];
    }
    return existing;
  }

  // Create
  if (company_type && !COMPANY_TYPES.includes(company_type)) {
    throw new Error(`upsertCompany: invalid company_type "${company_type}"`);
  }
  const { rows: created } = await c(dbClient).query(`
    INSERT INTO companies (name, companies_house_number, company_type, website, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [name.trim(), ch, company_type || null, website || null, notes || null]);
  return created[0];
}

// ─────────────────────────────────────────────
// PEOPLE — find-or-create by email or whatsapp
// ─────────────────────────────────────────────
async function upsertPerson({ full_name, email, phone, whatsapp, linkedin_url, job_title, notes }, dbClient) {
  if (!full_name || !full_name.trim()) throw new Error("upsertPerson: full_name required");

  if (email) {
    const { rows } = await c(dbClient).query(
      `SELECT * FROM people WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    if (rows.length) return rows[0];
  }
  if (whatsapp) {
    const { rows } = await c(dbClient).query(
      `SELECT * FROM people WHERE whatsapp = $1`,
      [whatsapp]
    );
    if (rows.length) return rows[0];
  }

  const { rows: created } = await c(dbClient).query(`
    INSERT INTO people (full_name, email, phone, whatsapp, linkedin_url, job_title, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    full_name.trim(), email || null, phone || null, whatsapp || null,
    linkedin_url || null, job_title || null, notes || null,
  ]);
  return created[0];
}

// ─────────────────────────────────────────────
// HOTEL_PEOPLE — link with role + optional primary flag
// ─────────────────────────────────────────────
async function linkHotelPerson(hotel_id, person_id, role, { is_primary = false, notes = null } = {}, dbClient) {
  if (!HOTEL_PEOPLE_ROLES.includes(role)) {
    throw new Error(`linkHotelPerson: invalid role "${role}". Allowed: ${HOTEL_PEOPLE_ROLES.join(", ")}`);
  }
  // If marking primary, demote any other primary at same (hotel, role)
  if (is_primary) {
    await c(dbClient).query(
      `UPDATE hotel_people SET is_primary = FALSE WHERE hotel_id = $1 AND role = $2 AND is_primary = TRUE`,
      [hotel_id, role]
    );
  }
  const { rows } = await c(dbClient).query(`
    INSERT INTO hotel_people (hotel_id, person_id, role, is_primary, notes)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (hotel_id, person_id, role)
    DO UPDATE SET
      is_primary = EXCLUDED.is_primary,
      notes = COALESCE(EXCLUDED.notes, hotel_people.notes),
      updated_at = NOW()
    RETURNING *
  `, [hotel_id, person_id, role, is_primary, notes]);
  return rows[0];
}

// ─────────────────────────────────────────────
// PROSPECT STATUS — update + auto-write activity row
// ─────────────────────────────────────────────
async function updateProspectStatus(hotel_id, new_status, { actor = "system", reason = null } = {}, dbClient) {
  if (!PROSPECT_STATUSES.includes(new_status)) {
    throw new Error(`updateProspectStatus: invalid status "${new_status}". Allowed: ${PROSPECT_STATUSES.join(", ")}`);
  }
  const { rows: existing } = await c(dbClient).query(
    `SELECT prospect_status FROM hotels WHERE hotel_id = $1`,
    [hotel_id]
  );
  if (existing.length === 0) throw new Error(`hotel ${hotel_id} not found`);
  const old_status = existing[0].prospect_status;
  if (old_status === new_status) {
    return { changed: false, prospect_status: new_status };
  }
  await c(dbClient).query(
    `UPDATE hotels SET prospect_status = $1, last_agent_review_at = NOW() WHERE hotel_id = $2`,
    [new_status, hotel_id]
  );
  await recordActivity({
    hotel_id,
    type: "status_change",
    actor,
    subject: `Status: ${old_status || "(none)"} → ${new_status}`,
    body: reason || null,
    metadata: { old_status, new_status },
  }, dbClient);
  return { changed: true, prospect_status: new_status, previous: old_status };
}

// ─────────────────────────────────────────────
// PROSPECT — find-or-create a hotel row for the sales pipeline.
// Used by the Phase 1a discovery agent to upsert candidates from
// Booking.com search. Dedup primary: booking_property_id. Fallback:
// case-insensitive (property_name, city). Activity row written on
// real creation only — re-running is silent.
//
// star_rating is accepted for forward compatibility but is NOT
// persisted (no column on `hotels`). Add a column + migration if/when
// it matters.
// ─────────────────────────────────────────────
async function upsertProspect({
  booking_property_id,
  name,
  city,
  country,
  currency_code,
  key_count,
  star_rating, // eslint-disable-line no-unused-vars
  management_group,
  prospect_status,
  prospect_score,
  prospect_owner,
  pms_type,
  pms_property_id,
  notes,
  actor,
} = {}, dbClient) {
  if (!booking_property_id && !(name && city)) {
    throw new Error("upsertProspect: need booking_property_id or (name + city) for dedup");
  }
  if (prospect_status && !PROSPECT_STATUSES.includes(prospect_status)) {
    throw new Error(`upsertProspect: invalid prospect_status "${prospect_status}". Allowed: ${PROSPECT_STATUSES.join(", ")}`);
  }

  // 1. Primary dedup: booking_property_id
  if (booking_property_id) {
    const { rows } = await c(dbClient).query(
      `SELECT * FROM hotels WHERE booking_property_id = $1`,
      [booking_property_id]
    );
    if (rows.length) return { ...rows[0], created: false };
  }

  // 2. Fallback dedup: case-insensitive (name, city)
  if (name && city) {
    const { rows } = await c(dbClient).query(
      `SELECT * FROM hotels WHERE LOWER(property_name) = LOWER($1) AND LOWER(city) = LOWER($2)`,
      [name, city]
    );
    if (rows.length) return { ...rows[0], created: false };
  }

  // 3. Insert new row
  const { rows: created } = await c(dbClient).query(`
    INSERT INTO hotels (
      property_name, city, country, currency_code, total_rooms,
      booking_property_id, is_rockenue_managed, is_disconnected,
      management_group, pricing_model,
      pms_type, pms_property_id,
      prospect_status, prospect_score, prospect_owner,
      last_agent_review_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, false, false,
      $7, 'inclusive',
      $8, $9,
      $10, $11, $12,
      NOW()
    )
    RETURNING *
  `, [
    name || null,
    city || null,
    country || "GB",
    currency_code || "GBP",
    Number.isFinite(key_count) ? key_count : null,
    booking_property_id || null,
    management_group || "Prospect",
    pms_type || null,
    pms_property_id || null,
    prospect_status || "cold",
    Number.isFinite(prospect_score) ? prospect_score : null,
    prospect_owner || null,
  ]);

  await recordActivity({
    hotel_id: created[0].hotel_id,
    type: "agent_research",
    actor: actor || "agent:discovery",
    subject: "Discovered via agent",
    body: notes || null,
    metadata: {
      source: booking_property_id ? "booking.com" : "unknown",
      ...(booking_property_id ? { booking_property_id } : {}),
    },
  }, dbClient);

  return { ...created[0], created: true };
}

module.exports = {
  // Constants for validation in router / agents
  COMPANY_TYPES,
  HOTEL_PEOPLE_ROLES,
  PROSPECT_STATUSES,
  LOSS_REASON_CODES,
  ACTIVITY_TYPES,
  // Functions
  recordActivity,
  upsertCompany,
  upsertPerson,
  linkHotelPerson,
  updateProspectStatus,
  upsertProspect,
};
