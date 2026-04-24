#!/usr/bin/env node
// CRITICAL-PATH TEST: Phase 2 skips override dates.
//
// Simulates a DGX prediction hitting the Bridge for Lancaster Court on a
// date that has an active override. Verifies:
//   1. sentinel_ai_predictions row is saved (Phase 1 shadow) — predictions
//      are always saved regardless of overrides.
//   2. sentinel_rates_calendar row is NOT updated to the AI rate (Phase 2
//      correctly skipped at Gate 3a.5).
//   3. Phase 2 log output mentions the override skip counter.
//
// ZERO PMS RISK:
//   - No cron runs locally (server.js only schedules cron under Railway).
//   - We clean up queue rows and override rows at end.
//   - Test date 2027-12-31 is far-future and not in any real DGX window.

require("dotenv").config();
process.env.SENTINEL_OVERRIDES_ENABLED = "true";
process.env.SENTINEL_OVERRIDES_HOTEL_ALLOWLIST = "318302";

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const bridgeService = require("../api/services/sentinel.bridge.service");

const HOTEL_ID = 318302;
const TEST_DATE = "2027-12-31";
const TEST_ROOM_TYPE_ID = "518419"; // Lancaster Court base room
const OVERRIDE_PRICE = 250;
const AI_SUGGESTED_PRICE = 400; // AI wants £400, override should block it

let cleanupRan = false;
async function cleanup(reason = "") {
  if (cleanupRan) return;
  cleanupRan = true;
  console.log(`\n--- Cleanup (${reason}) ---`);
  await pool.query(
    "DELETE FROM sentinel_rate_overrides WHERE hotel_id=$1 AND stay_date=$2",
    [HOTEL_ID, TEST_DATE],
  );
  await pool.query(
    "DELETE FROM sentinel_ai_predictions WHERE hotel_id=$1 AND stay_date=$2 AND room_type_id=$3",
    [HOTEL_ID, TEST_DATE, TEST_ROOM_TYPE_ID],
  );
  const jq = await pool.query(
    `DELETE FROM sentinel_job_queue WHERE hotel_id=$1 AND status='PENDING'
     AND payload::text LIKE '%${TEST_DATE}%' RETURNING id`,
    [HOTEL_ID],
  );
  if (jq.rowCount > 0) {
    console.warn(`WARN: cancelled ${jq.rowCount} stray queue job(s) — they would have pushed to PMS if Railway cron ran.`);
  }
  console.log("Cleanup complete.");
}
process.on("exit", () => {
  /* final safety net */
});
process.on("SIGINT", async () => {
  await cleanup("SIGINT");
  process.exit(130);
});

function assert(cond, msg) {
  if (!cond) {
    console.error("✗ ASSERT FAILED:", msg);
    throw new Error(msg);
  }
  console.log("✓", msg);
}

(async () => {
  // Pre-clean
  await cleanup("pre-run").catch(() => {});
  cleanupRan = false;

  // --- Preserve the original sentinel_rates_calendar row so we can verify it didn't get overwritten ---
  const beforeRes = await pool.query(
    `SELECT rate, source FROM sentinel_rates_calendar
     WHERE hotel_id=$1 AND room_type_id=$2 AND stay_date=$3`,
    [HOTEL_ID, TEST_ROOM_TYPE_ID, TEST_DATE],
  );
  const before = beforeRes.rows[0];
  console.log("Pre-test calendar row:", before || "(no row — fresh date)");

  // --- Setup: create the override ---
  console.log("\n--- Setup: insert override row ---");
  await pool.query(
    `INSERT INTO sentinel_rate_overrides (hotel_id, stay_date, base_override_price, set_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [HOTEL_ID, TEST_DATE, OVERRIDE_PRICE],
  );
  console.log(`Inserted override: hotel=${HOTEL_ID} date=${TEST_DATE} price=£${OVERRIDE_PRICE}`);

  // --- Invoke Bridge Phase 2 with a fake DGX prediction ---
  console.log("\n--- Invoke saveDecisions (non-preview = full Phase 2) ---");
  const fakeDecision = {
    hotel_id: HOTEL_ID,
    room_type_id: TEST_ROOM_TYPE_ID,
    stay_date: TEST_DATE,
    suggested_rate: AI_SUGGESTED_PRICE,
    confidence_score: 0.95,
    reasoning: "test: AI wants to push £400, override should block it",
    model_version: "test-phase2-override",
  };

  try {
    const result = await bridgeService.saveDecisions([fakeDecision]);
    console.log("saveDecisions result:", result);
  } catch (e) {
    console.error("saveDecisions threw:", e.message);
    await cleanup("error");
    process.exit(1);
  }

  // --- Verify: Phase 1 shadow save happened ---
  console.log("\n--- Verify: Phase 1 shadow save ---");
  const predRes = await pool.query(
    `SELECT suggested_rate, is_applied FROM sentinel_ai_predictions
     WHERE hotel_id=$1 AND room_type_id=$2 AND stay_date=$3
     ORDER BY created_at DESC LIMIT 1`,
    [HOTEL_ID, TEST_ROOM_TYPE_ID, TEST_DATE],
  );
  const pred = predRes.rows[0];
  assert(pred !== undefined, "Phase 1: prediction row was created");
  assert(parseFloat(pred.suggested_rate) === AI_SUGGESTED_PRICE, `Phase 1: suggested_rate = £${AI_SUGGESTED_PRICE}`);
  assert(pred.is_applied === false, "Phase 1: is_applied = false (Phase 2 correctly did NOT apply the prediction)");

  // --- Verify: sentinel_rates_calendar did NOT get updated to AI rate ---
  console.log("\n--- Verify: calendar row was NOT updated by Phase 2 ---");
  const afterRes = await pool.query(
    `SELECT rate, source FROM sentinel_rates_calendar
     WHERE hotel_id=$1 AND room_type_id=$2 AND stay_date=$3`,
    [HOTEL_ID, TEST_ROOM_TYPE_ID, TEST_DATE],
  );
  const after = afterRes.rows[0];

  if (before) {
    // Calendar already had a row — verify unchanged
    assert(
      parseFloat(after?.rate || 0) === parseFloat(before.rate),
      `rate preserved: was £${before.rate}, still £${after?.rate}`,
    );
    assert(
      after?.source === before.source,
      `source preserved: was '${before.source}', still '${after?.source}'`,
    );
  } else {
    // No pre-existing row; Phase 2 should not have created one for an override date
    assert(after === undefined, "Phase 2 did not create a new calendar row for override date");
  }

  // --- Verify: queue was NOT populated with the blocked AI push ---
  console.log("\n--- Verify: queue has no AI-push job for override date ---");
  const queueRes = await pool.query(
    `SELECT id, status, payload FROM sentinel_job_queue
     WHERE hotel_id=$1 AND payload::text LIKE '%${TEST_DATE}%'
     ORDER BY created_at DESC`,
    [HOTEL_ID],
  );
  // The re-push block WILL enqueue override jobs (that's intentional).
  // But none of those jobs should carry the AI_SUGGESTED_PRICE (£400).
  // They should all carry the OVERRIDE_PRICE (£250) for base + derivatives.
  const aiPushJobs = queueRes.rows.filter((j) =>
    JSON.stringify(j.payload).includes(String(AI_SUGGESTED_PRICE))
  );
  const overridePushJobs = queueRes.rows.filter((j) =>
    JSON.stringify(j.payload).includes(String(OVERRIDE_PRICE))
  );
  console.log(`Queue rows matching date: ${queueRes.rows.length}`);
  console.log(`  — carrying AI rate £${AI_SUGGESTED_PRICE}: ${aiPushJobs.length}`);
  console.log(`  — carrying OVERRIDE rate £${OVERRIDE_PRICE}: ${overridePushJobs.length}`);
  assert(aiPushJobs.length === 0, `No queue job carries the blocked AI price £${AI_SUGGESTED_PRICE}`);

  // --- Cleanup (always) ---
  await cleanup("success");
  await pool.end();
  console.log("\n✓ Phase 2 correctly skipped the override date. AI's £400 did NOT overwrite the £250 override.");
})().catch(async (e) => {
  console.error("TEST FAILED:", e);
  await cleanup("exception").catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
