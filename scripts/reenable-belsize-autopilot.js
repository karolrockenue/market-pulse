#!/usr/bin/env node
/**
 * Re-enable Belsize autopilot after the rate-plan-routing fix.
 * Belsize was paused on 2026-05-07 ~11:30 UTC during the silent-flip recovery
 * to prevent 14 days of suppressed rate moves from dumping in one cycle.
 * With rate_id_map now corrected and the fill-only backend patch deployed,
 * autopilot can resume.
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const HOTEL_ID = 318329;

(async () => {
  const before = await pool.query(
    `SELECT is_autopilot_enabled, rate_id_map,
            to_char(updated_at,'YYYY-MM-DD HH24:MI:SS') AS upd
     FROM sentinel_configurations WHERE hotel_id = $1`,
    [HOTEL_ID],
  );
  console.log("BEFORE:");
  console.log(`  autopilot:  ${before.rows[0].is_autopilot_enabled}`);
  const map = before.rows[0].rate_id_map || {};
  const distinct = [...new Set(Object.values(map))];
  console.log(`  rate_id_map distinct rateIDs: ${JSON.stringify(distinct)}`);
  if (distinct.length !== 1 || distinct[0] !== "df9a9345-90e4-4b1b-8f5b-b41100a7c319") {
    console.error("\n❌ ABORT: rate_id_map is not pointing at OTA BASE: Flexible. Won't enable autopilot until fixed.");
    process.exit(1);
  }

  await pool.query(
    `UPDATE sentinel_configurations
     SET is_autopilot_enabled = true, updated_at = NOW()
     WHERE hotel_id = $1`,
    [HOTEL_ID],
  );

  const after = await pool.query(
    `SELECT is_autopilot_enabled,
            to_char(updated_at,'YYYY-MM-DD HH24:MI:SS') AS upd
     FROM sentinel_configurations WHERE hotel_id = $1`,
    [HOTEL_ID],
  );
  console.log("\nAFTER:");
  console.log(`  autopilot:  ${after.rows[0].is_autopilot_enabled}`);
  console.log(`  config updated_at: ${after.rows[0].upd}`);
  console.log("\n✅ Belsize autopilot re-enabled. Ready for DGX trigger.");

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
