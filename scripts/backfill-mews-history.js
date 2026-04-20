/**
 * One-shot backfill for Mews hotels.
 *
 * Purpose: re-fetch daily_metrics_snapshots for dates outside the 14-day
 * rolling refresh window, so historical occupancy/revenue reflects the
 * post-webhook-fix (2026-04-18) state.
 *
 * Usage:
 *   node scripts/backfill-mews-history.js                  # all Mews hotels, 2026-01-01 → today-15
 *   node scripts/backfill-mews-history.js 318343           # single hotel
 *   node scripts/backfill-mews-history.js 318343 2025-06-01 2026-04-05
 *
 * Safety:
 *  - Skips stay_dates inside hotels.locked_years.
 *  - UPSERT on (hotel_id, stay_date): existing rows get overwritten with fresh Mews truth.
 *  - No pacing_snapshots writes (historical backfill, not a daily snapshot).
 */

require('dotenv').config();
const format = require('pg-format');
const pool = require('../api/utils/db');
const mewsAdapter = require('../api/adapters/mewsAdapter');

const argHotelId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const argStart = process.argv[3] || '2026-01-01';
const argEnd = process.argv[4] || (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 15); // one day before daily-refresh's −14
  return d.toISOString().slice(0, 10);
})();

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function backfillHotel(client, hotel) {
  const { hotel_id, property_name, total_rooms, pms_credentials, locked_years } = hotel;
  const lockedSet = new Set((locked_years || []).map(String));
  const serviceId = pms_credentials?.serviceId;
  const tz = pms_credentials?.timezone || 'Europe/London';

  if (!serviceId) {
    console.log(`  [${hotel_id}] ${property_name}: no serviceId in pms_credentials, skipping.`);
    return;
  }

  const credentials = await mewsAdapter.getCredentials(hotel_id);
  console.log(`\n── ${property_name} (${hotel_id}) ${argStart} → ${argEnd} ──`);

  // Probe capacity once (same pattern as daily-refresh)
  const capacity = await mewsAdapter.probeCapacity(credentials, serviceId);
  console.log(`  capacity: ${capacity} rooms`);

  // 90-day chunks (Mews reservations endpoint caps at ~3 months)
  let cursorStart = argStart;
  const dataMap = {};
  while (cursorStart <= argEnd) {
    const chunkEnd = addDays(cursorStart, 89);
    const effectiveEnd = chunkEnd < argEnd ? chunkEnd : argEnd;
    process.stdout.write(`  chunk ${cursorStart} → ${effectiveEnd}… `);
    try {
      const chunk = await mewsAdapter.getCombinedMetrics(
        credentials,
        serviceId,
        cursorStart,
        effectiveEnd,
        tz,
        capacity,
      );
      Object.assign(dataMap, chunk);
      console.log(`ok (${Object.keys(chunk).length} days)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
    cursorStart = addDays(effectiveEnd, 1);
  }

  // Respect locked_years
  const allDates = Object.keys(dataMap);
  const filteredDates = allDates.filter((d) => !lockedSet.has(d.slice(0, 4)));
  const skipped = allDates.length - filteredDates.length;
  if (skipped > 0) {
    console.log(`  skipping ${skipped} rows inside locked_years ${[...lockedSet].join(', ')}`);
  }
  if (filteredDates.length === 0) {
    console.log('  nothing to write.');
    return;
  }

  // Find a cloudbeds_user_id for the legacy column (same as daily-refresh)
  const userResult = await client.query(
    'SELECT user_id FROM user_properties WHERE property_id = $1 LIMIT 1',
    [hotel_id],
  );
  const cloudbedsUserId = userResult.rows[0]?.user_id ?? null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const bulk = filteredDates.map((date) => {
    const m = dataMap[date];
    return [
      todayIso,
      date,
      hotel_id,
      m.rooms_sold || 0,
      total_rooms || m.capacity_count || 0,
      cloudbedsUserId,
      m.net_revenue || 0,
      m.gross_revenue || 0,
      m.net_adr || 0,
      m.gross_adr || 0,
      m.net_revpar || 0,
      m.gross_revpar || 0,
    ];
  });

  const query = format(
    `INSERT INTO daily_metrics_snapshots (snapshot_taken_date, stay_date, hotel_id, rooms_sold, capacity_count, cloudbeds_user_id, net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar)
     VALUES %L
     ON CONFLICT (hotel_id, stay_date) DO UPDATE SET
         snapshot_taken_date = EXCLUDED.snapshot_taken_date,
         rooms_sold = EXCLUDED.rooms_sold,
         capacity_count = EXCLUDED.capacity_count,
         cloudbeds_user_id = EXCLUDED.cloudbeds_user_id,
         net_revenue = EXCLUDED.net_revenue,
         gross_revenue = EXCLUDED.gross_revenue,
         net_adr = EXCLUDED.net_adr,
         gross_adr = EXCLUDED.gross_adr,
         net_revpar = EXCLUDED.net_revpar,
         gross_revpar = EXCLUDED.gross_revpar;`,
    bulk,
  );
  await client.query(query);
  console.log(`  wrote ${filteredDates.length} rows.`);
}

async function run() {
  const where = argHotelId
    ? 'WHERE hotel_id = $1 AND pms_type = $2'
    : 'WHERE pms_type = $1';
  const params = argHotelId ? [argHotelId, 'mews'] : ['mews'];
  const hotels = (await pool.query(
    `SELECT hotel_id, property_name, total_rooms, pms_credentials, locked_years
       FROM hotels ${where}
       ORDER BY hotel_id`,
    params,
  )).rows;

  if (hotels.length === 0) {
    console.log('No Mews hotels matched.');
    return;
  }

  console.log(`Backfilling ${hotels.length} Mews hotel(s): ${hotels.map((h) => h.hotel_id).join(', ')}`);
  const client = await pool.connect();
  try {
    for (const h of hotels) {
      try {
        await backfillHotel(client, h);
      } catch (err) {
        console.error(`  [${h.hotel_id}] hard fail: ${err.message}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
