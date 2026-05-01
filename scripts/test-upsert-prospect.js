#!/usr/bin/env node
// Smoke test for upsertProspect (api/services/sales-crm.service.js).
// Runs everything inside a single transaction and ROLLBACKs at the end so
// no test data persists. Idempotent — safe to re-run.
//
//   node scripts/test-upsert-prospect.js
//
require("dotenv").config();
const pool = require("../api/utils/db");
const { upsertProspect } = require("../api/services/sales-crm.service");

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, detail) {
  if (cond) {
    console.log(`  ✅ ${name}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    fail++;
    failures.push(detail ? `${name} (${detail})` : name);
  }
}

(async () => {
  console.log("━".repeat(50));
  console.log("upsertProspect smoke test");
  console.log("━".repeat(50));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Test A: create with booking_property_id ──
    const a = await upsertProspect({
      booking_property_id: "TEST-UPSERT-1",
      name: "Test Manor",
      city: "London",
      key_count: 42,
      star_rating: 3, // accepted but not persisted (no column)
      prospect_score: 500,
    }, client);
    assert("A: created=true on first call", a.created === true, `created=${a.created}`);
    assert("A: row has hotel_id", typeof a.hotel_id === "number");
    assert("A: property_name persisted", a.property_name === "Test Manor");
    assert("A: city persisted", a.city === "London");
    assert("A: total_rooms = key_count", a.total_rooms === 42, `got ${a.total_rooms}`);
    assert("A: prospect_status defaulted to 'cold'", a.prospect_status === "cold");
    assert("A: is_rockenue_managed false", a.is_rockenue_managed === false);
    assert("A: management_group = 'Prospect'", a.management_group === "Prospect");
    const { rows: actA } = await client.query(
      "SELECT * FROM hotel_activities WHERE hotel_id = $1 ORDER BY created_at",
      [a.hotel_id]
    );
    assert("A: activity row written", actA.length === 1, `got ${actA.length}`);
    assert("A: activity type=agent_research", actA[0]?.type === "agent_research");
    assert("A: activity actor=agent:discovery", actA[0]?.actor === "agent:discovery");

    // ── Test B: same booking_property_id → no-op, no new activity ──
    const b = await upsertProspect({
      booking_property_id: "TEST-UPSERT-1",
      name: "Different Name (should be ignored)",
      city: "Manchester",
    }, client);
    assert("B: created=false on dedup hit", b.created === false);
    assert("B: same hotel_id as A", b.hotel_id === a.hotel_id);
    assert("B: name not overwritten on dedup", b.property_name === "Test Manor");
    const { rows: actB } = await client.query(
      "SELECT COUNT(*)::int AS n FROM hotel_activities WHERE hotel_id = $1",
      [a.hotel_id]
    );
    assert("B: no second activity row", actB[0].n === 1, `got ${actB[0].n}`);

    // ── Test C: name+city fallback (case-insensitive) ──
    const cRes = await upsertProspect({
      name: "test manor",
      city: "LONDON",
    }, client);
    assert("C: case-insensitive fallback finds same row", cRes.hotel_id === a.hotel_id);
    assert("C: created=false on fallback hit", cRes.created === false);

    // ── Test D: new identifiers → create ──
    const d = await upsertProspect({
      booking_property_id: "TEST-UPSERT-2",
      name: "Other Hotel",
      city: "Manchester",
    }, client);
    assert("D: created=true for new row", d.created === true);
    assert("D: different hotel_id from A", d.hotel_id !== a.hotel_id);

    // ── Test E: missing both signals → throws ──
    let threw = false;
    let errMsg = "";
    try {
      await upsertProspect({ name: "Lonely" }, client);
    } catch (err) {
      threw = true;
      errMsg = err.message;
    }
    assert(
      "E: throws when no dedup signal",
      threw && errMsg.includes("booking_property_id or (name + city)"),
      errMsg || "did not throw"
    );

    // ── Test F: invalid prospect_status → throws ──
    let threwF = false;
    let errMsgF = "";
    try {
      await upsertProspect({
        booking_property_id: "TEST-UPSERT-3",
        name: "Bad Status",
        city: "London",
        prospect_status: "totally_invalid",
      }, client);
    } catch (err) {
      threwF = true;
      errMsgF = err.message;
    }
    assert(
      "F: throws on invalid prospect_status",
      threwF && errMsgF.includes("invalid prospect_status"),
      errMsgF || "did not throw"
    );

    // Always ROLLBACK — leave no trace
    await client.query("ROLLBACK");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("FATAL:", err);
    fail++;
    failures.push(`FATAL: ${err.message}`);
  } finally {
    client.release();
  }

  console.log("━".repeat(50));
  console.log(`PASS: ${pass}    FAIL: ${fail}`);
  console.log("━".repeat(50));
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  -", f);
  }
  await pool.end();
  process.exit(fail ? 1 : 0);
})();
