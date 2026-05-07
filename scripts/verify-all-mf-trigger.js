#!/usr/bin/env node
/**
 * Unified verification across all 3 M&F hotels after a fresh autopilot trigger.
 * Checks for each:
 *   1. rate_id_map distinct rateIDs (must be the correct OTA BASE: Flexible per hotel)
 *   2. Fresh AI predictions in last 10 min
 *   3. New job queue entries — and what rateId did Phase 2 push to (CRITICAL)
 *   4. Heartbeat
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const HOTELS = [
  {
    id: 318341,
    name: "Westbourne Park",
    expected_rateId: "f1e85b02-5550-45ba-a749-b42100a4b37a",
    base_room: "a82a1f07-d96b-43ee-b921-b26b00be661a",
  },
  {
    id: 318329,
    name: "Belsize Park",
    expected_rateId: "df9a9345-90e4-4b1b-8f5b-b41100a7c319",
    base_room: "b018accc-bf52-4241-8940-b3e00113b7b3",
  },
  {
    id: 318343,
    name: "Primrose Hill",
    expected_rateId: "7866223e-308e-472d-bdad-b42800c4619e",
    base_room: "6db81534-06bc-47d5-ba8f-b17e010898c6",
  },
];

const MID_STAY_BASE_IDS = new Set([
  "8a37a572-ef8a-477e-ba03-b420007d7e8e", // Belsize Mid Stay (BASE)
  "98001db6-fe78-408d-a098-b441012b42cc", // Primrose Mid Stay (BASE)
]);

(async () => {
  const summary = [];

  for (const h of HOTELS) {
    console.log(`\n${"=".repeat(72)}\n${h.name} (${h.id})\n${"=".repeat(72)}`);

    // 1. rate_id_map state
    const cfg = await pool.query(
      `SELECT rate_id_map, is_autopilot_enabled
       FROM sentinel_configurations WHERE hotel_id = $1`,
      [h.id],
    );
    const map = cfg.rows[0].rate_id_map || {};
    const distinct = [...new Set(Object.values(map))];
    const mapOk = distinct.length === 1 && distinct[0] === h.expected_rateId;
    const flippedBack = distinct.some((d) => MID_STAY_BASE_IDS.has(d));
    console.log(`  autopilot:                ${cfg.rows[0].is_autopilot_enabled}`);
    console.log(`  rate_id_map distinct:     ${JSON.stringify(distinct)}`);
    console.log(`  ${mapOk ? "✅" : flippedBack ? "❌ FLIPPED BACK" : "⚠"} mapping`);

    // 2. Fresh predictions (last 10 min)
    const pred = await pool.query(
      `SELECT COUNT(*) AS n,
              MIN(suggested_rate) AS min_rate,
              MAX(suggested_rate) AS max_rate,
              MIN(stay_date)::text AS min_date,
              MAX(stay_date)::text AS max_date
       FROM sentinel_ai_predictions
       WHERE hotel_id = $1
         AND room_type_id::text = $2
         AND created_at > NOW() - INTERVAL '10 minutes'`,
      [h.id, h.base_room],
    );
    const pr = pred.rows[0];
    console.log(`  predictions (10 min):     ${pr.n}`);
    if (parseInt(pr.n) > 0) {
      console.log(`    rate range:             £${pr.min_rate} → £${pr.max_rate}`);
      console.log(`    date range:             ${pr.min_date} → ${pr.max_date}`);
    }

    // 3. Distinct rateIds pushed
    const pushed = await pool.query(
      `SELECT r->>'rateId' AS rateid,
              COUNT(*) AS rate_count,
              COUNT(DISTINCT r->>'date') AS dates,
              COUNT(DISTINCT r->>'categoryId') AS rooms,
              MIN((r->>'rate')::numeric) AS min_r,
              MAX((r->>'rate')::numeric) AS max_r,
              SUM(CASE WHEN j.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_rows,
              SUM(CASE WHEN j.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_rows
       FROM sentinel_job_queue j,
            jsonb_array_elements(j.payload->'rates') r
       WHERE j.hotel_id = $1
         AND j.created_at > NOW() - INTERVAL '10 minutes'
       GROUP BY r->>'rateId'`,
      [h.id],
    );
    const pushedTotal = pushed.rows.reduce((a, b) => a + parseInt(b.rate_count), 0);
    console.log(`  pushed rate-rows (10m):   ${pushedTotal}`);
    if (pushed.rowCount === 0) {
      console.log(`    ⚠ no jobs queued — DGX may have skipped (deadband / Gate 1)`);
    } else {
      pushed.rows.forEach((row) => {
        const verdict =
          row.rateid === h.expected_rateId
            ? "✅ correct OTA BASE: Flexible"
            : MID_STAY_BASE_IDS.has(row.rateid)
              ? "❌ MID STAY (BASE) — STILL MISROUTED"
              : "⚠ unexpected rate plan";
        console.log(
          `    rateId=${row.rateid.slice(0, 8)}…  count=${row.rate_count}  dates=${row.dates}  rooms=${row.rooms}  range=£${row.min_r}–£${row.max_r}  status: ${row.completed_rows}c/${row.failed_rows}f  → ${verdict}`,
        );
      });
    }

    // 4. Heartbeat
    const hb = await pool.query(
      `SELECT consecutive_failures, last_success_rates_count,
              EXTRACT(EPOCH FROM (NOW() - last_success_at))::int AS secs_since_success,
              SUBSTRING(last_failure_error FROM 1 FOR 80) AS last_failure_excerpt
       FROM sentinel_hotel_heartbeat WHERE hotel_id = $1`,
      [h.id],
    );
    const h0 = hb.rows[0] || {};
    const ago = h0.secs_since_success != null ? `${Math.floor(h0.secs_since_success / 60)}m ${h0.secs_since_success % 60}s ago` : "never";
    console.log(`  heartbeat: failures=${h0.consecutive_failures ?? "n/a"}  last_success: ${ago} (${h0.last_success_rates_count ?? "n/a"} rates)`);

    summary.push({
      hotel: h.name,
      mapOk,
      predictionsCount: parseInt(pr.n),
      pushedRows: pushedTotal,
      routedCorrectly: pushed.rows.every((row) => row.rateid === h.expected_rateId),
      heartbeatOk: (h0.consecutive_failures ?? 99) === 0,
    });
  }

  console.log(`\n${"=".repeat(72)}\nSUMMARY\n${"=".repeat(72)}`);
  console.table(summary);

  const allGood = summary.every(
    (s) => s.mapOk && s.routedCorrectly && s.heartbeatOk,
  );
  console.log(
    allGood
      ? "\n🎯 ALL THREE M&F HOTELS PUSHING TO OTA BASE: FLEXIBLE. FIX VERIFIED LIVE."
      : "\n⚠ At least one hotel needs attention — see details above.",
  );

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
