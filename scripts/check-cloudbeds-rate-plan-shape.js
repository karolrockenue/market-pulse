#!/usr/bin/env node
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Pick 2 Cloudbeds hotels with active sentinel + non-empty maps
  const r = await pool.query(
    `SELECT h.hotel_id, h.property_name,
            sc.base_room_type_id, sc.rate_id_map,
            jsonb_array_length(COALESCE(sc.pms_rate_plans->'data','[]'::jsonb)) AS plan_count,
            jsonb_array_length(COALESCE(sc.pms_room_types->'data','[]'::jsonb)) AS room_count
     FROM hotels h
     JOIN sentinel_configurations sc USING (hotel_id)
     WHERE h.pms_type = 'cloudbeds' AND sc.sentinel_enabled = true
       AND h.is_disconnected IS NOT TRUE
       AND jsonb_array_length(COALESCE(sc.rate_id_map->'k','[]'::jsonb)) IS NOT NULL OR true
     ORDER BY h.hotel_id LIMIT 3`,
  );
  console.log("Sample Cloudbeds hotels:");
  console.table(r.rows);

  for (const h of r.rows) {
    console.log(`\n========== ${h.property_name} (${h.hotel_id}) ==========`);

    // First 3 rate plans — full shape
    const rp = await pool.query(
      `SELECT jsonb_array_elements(pms_rate_plans->'data') AS plan
       FROM sentinel_configurations WHERE hotel_id = $1 LIMIT 5`,
      [h.hotel_id],
    );
    console.log("\nFirst 3 rate plan entries (full shape):");
    rp.rows.slice(0, 3).forEach((row, i) => {
      console.log(`[${i}]`, JSON.stringify(row.plan, null, 2));
    });

    // First 2 room type entries
    const rt = await pool.query(
      `SELECT jsonb_array_elements(pms_room_types->'data') AS room
       FROM sentinel_configurations WHERE hotel_id = $1 LIMIT 5`,
      [h.hotel_id],
    );
    console.log("\nFirst 2 room type entries (full shape):");
    rt.rows.slice(0, 2).forEach((row, i) => {
      console.log(`[${i}]`, JSON.stringify(row.room, null, 2));
    });

    // Distinct keys present on rate plan objects
    const keys = await pool.query(
      `SELECT DISTINCT jsonb_object_keys(plan) AS k
       FROM (SELECT jsonb_array_elements(pms_rate_plans->'data') AS plan
             FROM sentinel_configurations WHERE hotel_id = $1) t
       ORDER BY k`,
      [h.hotel_id],
    );
    console.log("\nAll keys present in rate plan objects:", keys.rows.map(x => x.k).join(", "));

    // Show the existing rate_id_map and resolve
    console.log("\nrate_id_map in DB:", JSON.stringify(h.rate_id_map));
  }

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
