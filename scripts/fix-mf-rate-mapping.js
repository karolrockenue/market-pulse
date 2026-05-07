#!/usr/bin/env node
/**
 * Fix Belsize + Primrose rate_id_map silent misroute (2026-05-07).
 * Both hotels were pointing every room at "Mid Stay 29-59 (BASE)" because
 * buildMewsRateIdMap's substring matcher hit "BASE" in that plan name first.
 *
 * Westbourne is unaffected (verified via preflight).
 *
 * Order:
 *   1. Pause Belsize autopilot (14 days of pent-up rate moves shouldn't dump at once)
 *   2. UPDATE Belsize rate_id_map
 *   3. UPDATE Primrose rate_id_map
 *
 * All in a single transaction so a failure leaves no partial state.
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FIX = {
  belsize: {
    hotel_id: 318329,
    correct_rate_id: "df9a9345-90e4-4b1b-8f5b-b41100a7c319", // OTA BASE: Flexible
    pause_autopilot: true,
    rooms: [
      "0599dc4b-1edf-4c9a-85a2-b3e00113ecd8",
      "b018accc-bf52-4241-8940-b3e00113b7b3",
      "f53e867f-f3c7-49fe-93c8-b3e001146dc4",
      "f9e1a39b-5ce1-4631-9719-b3e001141ce3",
    ],
  },
  primrose: {
    hotel_id: 318343,
    correct_rate_id: "7866223e-308e-472d-bdad-b42800c4619e", // OTA BASE: Flexible
    pause_autopilot: false, // only ~1.5 days of misroute, no pent-up backlog
    rooms: [
      "13ebd14b-c1d9-423c-9411-b13400adf60f",
      "1d9573d8-64cf-41e0-ad29-b13400adf60f",
      "22f13054-3471-423f-9ec5-b13400adf60f",
      "452144dd-3da9-4196-bf07-b13400adf60f",
      "4a92ea95-b190-422f-90a6-b1e700a1fa5d",
      "6db81534-06bc-47d5-ba8f-b17e010898c6",
      "9d0b73aa-effc-4806-a37f-b13400adf60f",
    ],
  },
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [name, h] of Object.entries(FIX)) {
      const newMap = {};
      for (const room of h.rooms) newMap[room] = h.correct_rate_id;

      // Pre-state snapshot for audit log
      const before = await client.query(
        `SELECT rate_id_map, is_autopilot_enabled
         FROM sentinel_configurations WHERE hotel_id = $1`,
        [h.hotel_id],
      );
      console.log(`\n[${name} ${h.hotel_id}] BEFORE:`);
      console.log(`  autopilot: ${before.rows[0].is_autopilot_enabled}`);
      console.log(`  rate_id_map: ${JSON.stringify(before.rows[0].rate_id_map)}`);

      // Optional: pause autopilot
      if (h.pause_autopilot) {
        await client.query(
          `UPDATE sentinel_configurations SET is_autopilot_enabled = false, updated_at = NOW()
           WHERE hotel_id = $1`,
          [h.hotel_id],
        );
        console.log(`  → autopilot paused`);
      }

      // Update rate_id_map
      await client.query(
        `UPDATE sentinel_configurations SET rate_id_map = $1, updated_at = NOW()
         WHERE hotel_id = $2`,
        [JSON.stringify(newMap), h.hotel_id],
      );

      const after = await client.query(
        `SELECT rate_id_map, is_autopilot_enabled
         FROM sentinel_configurations WHERE hotel_id = $1`,
        [h.hotel_id],
      );
      console.log(`[${name} ${h.hotel_id}] AFTER:`);
      console.log(`  autopilot: ${after.rows[0].is_autopilot_enabled}`);
      console.log(`  rate_id_map: ${JSON.stringify(after.rows[0].rate_id_map)}`);
    }

    await client.query("COMMIT");
    console.log("\n✅ All updates committed.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("\n❌ Rolled back:", e.message);
    process.exit(1);
  } finally {
    client.release();
  }
  await pool.end();
})();
