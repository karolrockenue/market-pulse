#!/usr/bin/env node
/**
 * Hit Mews's rates/getPricing for each M&F hotel and compare what Mews is
 * actually serving vs what Sentinel pushed in the recent autopilot cycle.
 *
 * If they match → Mews has applied the new rates.
 * If they differ → Mews hasn't propagated yet, OR something Mews-side overwrote.
 */
require("dotenv").config();
const { Pool } = require("pg");
const mewsSentinelAdapter = require("../api/adapters/mews.sentinel.adapter");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const HOTELS = [
  {
    id: 318341,
    name: "Westbourne Park",
    base_room: "a82a1f07-d96b-43ee-b921-b26b00be661a",
  },
  {
    id: 318329,
    name: "Belsize Park",
    base_room: "b018accc-bf52-4241-8940-b3e00113b7b3",
  },
  {
    id: 318343,
    name: "Primrose Hill",
    base_room: "6db81534-06bc-47d5-ba8f-b17e010898c6",
  },
];

(async () => {
  for (const h of HOTELS) {
    console.log(`\n${"=".repeat(72)}\n${h.name} (${h.id}) — base room ${h.base_room.slice(0, 8)}…\n${"=".repeat(72)}`);

    // Fetch what Mews is actually serving for the next 60 days
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const endDate = new Date(today.getTime() + 60 * 86400000).toISOString().split("T")[0];

    let live;
    try {
      live = await mewsSentinelAdapter.getRates(
        h.id,
        null, // pmsPropertyId not used for Mews
        h.base_room,
        startDate,
        endDate,
      );
    } catch (e) {
      console.error(`  ❌ Mews fetch failed: ${e.message}`);
      continue;
    }

    const liveRows = live?.data?.roomRateDetailed || [];
    if (liveRows.length === 0) {
      console.log(`  ⚠ Mews returned zero rate rows`);
      continue;
    }

    // Build live map by date for the base room only
    const liveByDate = {};
    liveRows.forEach((r) => {
      if (String(r.roomTypeID) === String(h.base_room)) {
        liveByDate[r.date] = parseFloat(r.rate);
      }
    });

    // What we LAST pushed for this base room (from sentinel_job_queue, last 30 min)
    const pushed = await pool.query(
      `WITH x AS (
         SELECT j.created_at,
                r->>'date' AS d,
                (r->>'rate')::numeric AS rate
         FROM sentinel_job_queue j,
              jsonb_array_elements(j.payload->'rates') r
         WHERE j.hotel_id = $1
           AND j.created_at > NOW() - INTERVAL '30 minutes'
           AND r->>'categoryId' = $2
       )
       SELECT d, rate, created_at
       FROM (
         SELECT d, rate, created_at,
                ROW_NUMBER() OVER (PARTITION BY d ORDER BY created_at DESC) AS rn
         FROM x
       ) t WHERE rn = 1
       ORDER BY d ASC`,
      [h.id, h.base_room],
    );

    console.log(`  Live Mews rates for base room: ${Object.keys(liveByDate).length} dates`);
    console.log(`  Sentinel pushed (last 30 min):  ${pushed.rowCount} dates`);

    // Compare
    let matched = 0;
    let mismatch = 0;
    const samples = [];
    for (const row of pushed.rows) {
      const liveRate = liveByDate[row.d];
      const pushedRate = parseFloat(row.rate);
      if (liveRate === undefined) continue;
      // Mews returns gross rate; Sentinel pushes the gross rate too. Tolerance £0.50.
      if (Math.abs(liveRate - pushedRate) < 0.5) {
        matched++;
      } else {
        mismatch++;
        if (samples.length < 5) {
          samples.push({
            date: row.d,
            sentinel_pushed: pushedRate,
            mews_serving: liveRate,
            diff: (liveRate - pushedRate).toFixed(2),
          });
        }
      }
    }

    const total = matched + mismatch;
    const pct = total > 0 ? ((matched / total) * 100).toFixed(1) : "0.0";
    console.log(`  Match (within £0.50):           ${matched}/${total}  (${pct}%)`);

    if (mismatch === 0 && matched > 0) {
      console.log(`  ✅ Mews has applied every recently-pushed rate verbatim.`);
    } else if (mismatch > 0) {
      console.log(`  ⚠ ${mismatch} dates show drift between push and live serve. Samples:`);
      console.table(samples);
    }

    // Spot check: what is Mews currently showing for July 14 vs what we pushed
    console.log(`  Spot — 2026-07-14:`);
    const jul14Push = pushed.rows.find((r) => r.d === "2026-07-14");
    console.log(`    Sentinel pushed:  £${jul14Push?.rate ?? "n/a"}`);
    console.log(`    Mews now serves:  £${liveByDate["2026-07-14"] ?? "n/a"}`);
  }

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
