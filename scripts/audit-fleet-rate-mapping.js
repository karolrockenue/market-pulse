#!/usr/bin/env node
/**
 * Fleet-wide audit of sentinel_configurations.rate_id_map for silent misroutes.
 *
 * Triggered by Belsize+Primrose Mid Stay (BASE) flip incident (2026-05-07).
 * Substring matchers in buildMewsRateIdMap / buildRateIdMap can flip an existing
 * mapping if a new rate plan is added matching base|standard|rack|bar in name.
 *
 * For each rockenue-managed hotel:
 *   - Resolve every entry in rate_id_map to its rate plan name.
 *   - Flag any room whose mapped rate plan looks suspicious:
 *      - Mews: name doesn't start with "OTA " (and isn't an explicit allowlist match)
 *      - Cloudbeds: name contains "Net", "Package", "Agent", "Corp", "NonRef" (the
 *        original Cloudbeds matcher excludes these — but if a hotel was onboarded
 *        before that exclude list landed, it could be stuck on a toxic plan).
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MEWS_SUSPICIOUS_PATTERNS = [
  /\bmid stay\b/i,
  /\blong stay\b/i,
  /\bextended\b/i,
  /\bcorporate\b/i,
  /\bvoucher\b/i,
  /\bfriends?\b/i,
  /\bstaff\b/i,
  /\bagoda\b/i,
  /\bbooking\.?com\b/i,
  /\bexpedia\b/i,
  /\bairbnb\b/i,
  /\bgds\b/i,
  /\bhyper\s*guest\b/i,
  /\bpartner\b/i,
  /\bagent\b/i,
  /\bnon[-\s]?refundable\b/i,
  /\barchive/i,
  /\bdeactivated\b/i,
  /\bmanagement\b/i,
];

const CLOUDBEDS_TOXIC = [/net/i, /package/i, /agent/i, /corp/i, /nonref/i];

function classifyMewsPlan(name) {
  if (!name) return "unknown";
  // Acceptable: starts with "OTA " (case-insensitive), or "Standard"/"Rack" plans
  // for hotels that don't use OTA naming. Strict: prefer OTA prefix.
  if (/^\s*OTA\b/i.test(name)) return "ok";
  for (const pat of MEWS_SUSPICIOUS_PATTERNS) {
    if (pat.test(name)) return "suspicious";
  }
  return "review"; // doesn't start with OTA, doesn't trigger any blacklist — flag for human eyes
}

(async () => {
  const hotels = await pool.query(
    `SELECT h.hotel_id, h.property_name, h.pms_type, sc.base_room_type_id,
            sc.rate_id_map, sc.pms_rate_plans, sc.is_autopilot_enabled,
            sc.sentinel_enabled
     FROM hotels h
     JOIN sentinel_configurations sc USING (hotel_id)
     WHERE h.is_disconnected IS NOT TRUE
       AND sc.sentinel_enabled = true
     ORDER BY h.pms_type, h.hotel_id`,
  );

  const issues = [];
  for (const h of hotels.rows) {
    const ratePlans = h.pms_rate_plans?.data || [];
    const planById = {};
    ratePlans.forEach((rp) => {
      planById[String(rp.rateID)] = rp.ratePlanName || "(unnamed)";
    });

    const map = h.rate_id_map || {};
    const baseRateId = String(map[h.base_room_type_id] || "");
    const baseName = planById[baseRateId] || "(rate ID not found in pms_rate_plans!)";

    let status, severity;
    if (!baseRateId) {
      status = "no mapping for base room";
      severity = "RED";
    } else if (h.pms_type === "mews") {
      const cls = classifyMewsPlan(baseName);
      if (cls === "ok") { status = "ok (OTA prefix)"; severity = "OK"; }
      else if (cls === "suspicious") { status = `suspicious match: "${baseName}"`; severity = "RED"; }
      else { status = `non-OTA mapping: "${baseName}"`; severity = "AMBER"; }
    } else if (h.pms_type === "cloudbeds") {
      let toxic = false;
      for (const pat of CLOUDBEDS_TOXIC) {
        if (pat.test(baseName)) { toxic = true; break; }
      }
      status = toxic ? `cloudbeds toxic match: "${baseName}"` : `ok ("${baseName}")`;
      severity = toxic ? "RED" : "OK";
    } else {
      status = `unknown pms_type "${h.pms_type}", base plan "${baseName}"`;
      severity = "AMBER";
    }

    if (severity !== "OK") {
      issues.push({
        hotel_id: h.hotel_id,
        name: h.property_name,
        pms: h.pms_type,
        autopilot: h.is_autopilot_enabled,
        base_plan: baseName,
        base_rate_id: baseRateId,
        severity,
        status,
      });
    }
  }

  console.log(`\nAudited ${hotels.rowCount} active rockenue hotels.\n`);

  if (issues.length === 0) {
    console.log("✅ No suspicious mappings detected.");
  } else {
    const byPms = {};
    for (const i of issues) {
      byPms[i.pms] = byPms[i.pms] || [];
      byPms[i.pms].push(i);
    }
    for (const [pms, list] of Object.entries(byPms)) {
      console.log(`\n=== ${pms.toUpperCase()} (${list.length} flagged) ===`);
      console.table(
        list.map((i) => ({
          hotel_id: i.hotel_id,
          name: i.name,
          autopilot: i.autopilot,
          severity: i.severity,
          base_plan: i.base_plan,
          status: i.status,
        })),
      );
    }
  }

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
