#!/usr/bin/env node
// End-to-end test of the override data layer against Lancaster Court (318302).
//
// ZERO PMS RISK: this test bypasses saveRateOverrides' queue-enqueue step
// and INSERTs directly into sentinel_rate_overrides. That tests the
// read path (getRateOverrides / getRateOverrideDateSet / getRateOverrideMapForHotel
// / deleteRateOverrides) without ever writing to sentinel_job_queue. The
// full end-to-end push path is verified during canary deploy, not here.

require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const s = require("../api/services/sentinel.service");

const HOTEL_ID = 318302;
const TEST_DATE = "2027-12-31";
const TEST_PRICE = 250;

function log(title, val) {
  console.log(`\n=== ${title} ===`);
  if (Array.isArray(val)) console.table(val);
  else if (val && typeof val === "object") console.log(JSON.stringify(val, null, 2));
  else console.log(val);
}

function assert(cond, msg) {
  if (!cond) {
    console.error("✗ ASSERT FAILED:", msg);
    process.exit(1);
  }
  console.log("✓", msg);
}

(async () => {
  // Pre-clean
  await pool.query(
    "DELETE FROM sentinel_rate_overrides WHERE hotel_id=$1 AND stay_date=$2",
    [HOTEL_ID, TEST_DATE],
  );

  // --- 1. Direct INSERT (no queue) ---
  console.log("\n--- 1. Direct INSERT into sentinel_rate_overrides ---");
  await pool.query(
    `INSERT INTO sentinel_rate_overrides (hotel_id, stay_date, base_override_price, set_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [HOTEL_ID, TEST_DATE, TEST_PRICE],
  );
  console.log("Inserted test row.");

  // --- 2. getRateOverrides (range) ---
  console.log("\n--- 2. getRateOverrides(HOTEL_ID, TEST_DATE, TEST_DATE) ---");
  const list = await s.getRateOverrides(HOTEL_ID, TEST_DATE, TEST_DATE);
  log("Result", list);
  assert(list.length === 1, "returns exactly 1 row");
  assert(list[0].basePrice === TEST_PRICE, `basePrice = ${TEST_PRICE}`);
  assert(list[0].stayDate === TEST_DATE, `stayDate = ${TEST_DATE}`);

  // --- 3. getRateOverrides (no range) ---
  console.log("\n--- 3. getRateOverrides (all) ---");
  const all = await s.getRateOverrides(HOTEL_ID);
  log("Count", all.length);
  assert(all.length >= 1, "returns at least our test row");

  // --- 4. getRateOverrideDateSet ---
  console.log("\n--- 4. getRateOverrideDateSet ---");
  const set = await s.getRateOverrideDateSet(HOTEL_ID, [TEST_DATE]);
  log("Set contents", Array.from(set));
  assert(set.has(TEST_DATE), `set contains ${TEST_DATE}`);

  // --- 5. getRateOverrideMapForHotel ---
  console.log("\n--- 5. getRateOverrideMapForHotel ---");
  const map = await s.getRateOverrideMapForHotel(HOTEL_ID);
  log("Result", map);
  assert(map[TEST_DATE] === TEST_PRICE, `map[${TEST_DATE}] = ${TEST_PRICE}`);

  // --- 6. deleteRateOverrides ---
  console.log("\n--- 6. deleteRateOverrides ---");
  const del = await s.deleteRateOverrides(HOTEL_ID, [TEST_DATE], null);
  log("Result", del);
  assert(del.deleted === 1, "deleted === 1");

  // --- 7. Verify gone ---
  console.log("\n--- 7. Post-delete state ---");
  const finalList = await s.getRateOverrides(HOTEL_ID, TEST_DATE, TEST_DATE);
  log("Result", finalList);
  assert(finalList.length === 0, "row is gone");

  // --- 8. Validation tests on saveRateOverrides (inputs only, no real save) ---
  console.log("\n--- 8. saveRateOverrides input validation ---");

  // Past date — should reject, not insert
  const pastRes = await s.saveRateOverrides(
    HOTEL_ID,
    [{ stayDate: "2020-01-01", price: 100 }],
    null,
  );
  log("Past date result", pastRes);
  assert(pastRes.saved === 0, "past date: saved === 0");
  assert(pastRes.rejected.length === 1, "past date: rejected.length === 1");
  assert(pastRes.rejected[0].reason === "past_date", "past date: reason = past_date");

  // Negative price — should reject
  const negRes = await s.saveRateOverrides(
    HOTEL_ID,
    [{ stayDate: "2027-12-31", price: -5 }],
    null,
  );
  log("Negative price result", negRes);
  assert(negRes.saved === 0, "negative: saved === 0");
  assert(negRes.rejected[0].reason === "invalid_price", "negative: reason = invalid_price");

  // Bad date format
  const badDateRes = await s.saveRateOverrides(
    HOTEL_ID,
    [{ stayDate: "not-a-date", price: 100 }],
    null,
  );
  log("Bad date result", badDateRes);
  assert(badDateRes.rejected[0].reason === "invalid_date_format", "bad format: reason");

  // Empty array
  const emptyRes = await s.saveRateOverrides(HOTEL_ID, [], null);
  log("Empty array result", emptyRes);
  assert(emptyRes.saved === 0, "empty: saved === 0");

  // Final cleanup (in case any rejected input accidentally got through)
  await pool.query(
    "DELETE FROM sentinel_rate_overrides WHERE hotel_id=$1 AND stay_date=$2",
    [HOTEL_ID, TEST_DATE],
  );

  await pool.end();
  console.log("\n✓ All 15 assertions passed. Data layer verified.");
})().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
