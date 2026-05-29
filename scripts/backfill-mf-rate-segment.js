/**
 * Backfill reservations.mews_rate_id + rate_segment for M&F hotels.
 *
 * Westbourne (318341): segment is resolved by RATE GROUP (Mews merged Mid into
 * the Short service + split Long across services, so service-based is wrong).
 * Primrose (318343) / Belsize (318329): still service-based (not migrated yet).
 *
 * rate_segment ∈ { short, mid, long, exclude }. "exclude" = comp / management
 * (kept out of every metric except Weekly Unit Pacing, where it folds into Short).
 *
 * Classification config + resolvers live in api/services/mfRateSegment.js (the
 * single source of truth shared with the live webhook path).
 *
 * Re-runnable. Re-run after Dom files new Mid rate plans (they auto-classify if
 * they land in a Mid group; otherwise add the group name to RATE_GROUP_SEGMENTS
 * in api/services/mfRateSegment.js).
 *
 *   node scripts/backfill-mf-rate-segment.js              # all 3 M&F hotels
 *   node scripts/backfill-mf-rate-segment.js 318341       # one hotel
 *   node scripts/backfill-mf-rate-segment.js 318341 2024-01-01 2026-05-28
 */
require('dotenv').config();
const pool = require('../api/utils/db');
const mewsAdapter = require('../api/adapters/mewsAdapter');
// Classification config + resolvers now live in one place so this historical
// backfill and the live webhook path (mews.webhooks.router.js) can never drift.
const {
  MF_HOTEL_IDS,
  buildRateSegmentMap,
  segmentFor,
} = require('../api/services/mfRateSegment');

const MF_HOTELS = MF_HOTEL_IDS;

const argHotelId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const argStart = process.argv[3] || '2024-01-01';
const argEnd = process.argv[4] || new Date().toISOString().slice(0, 10);

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function fetchReservations(credentials, fromIso, toIso) {
  const out = [];
  let cursor = null;
  do {
    const resp = await mewsAdapter._callMewsApi('reservations/getAll/2023-06-06', credentials, {
      CreatedUtc: { StartUtc: `${fromIso}T00:00:00Z`, EndUtc: `${toIso}T00:00:00Z` },
      Limitation: { Count: 1000, Cursor: cursor },
    });
    if (resp.Reservations) out.push(...resp.Reservations);
    cursor = resp.Cursor || null;
  } while (cursor);
  return out;
}

async function backfillHotel(hotelId) {
  const credentials = await mewsAdapter.getCredentials(hotelId);
  const rateSegMap = await buildRateSegmentMap(hotelId, credentials);
  const mode = rateSegMap ? `rate-group (${Object.keys(rateSegMap).length} rates mapped)` : 'service-based';
  console.log(`\n── ${hotelId} ${argStart} → ${argEnd} · ${mode} ──`);

  if (rateSegMap) {
    const segOfMap = {};
    for (const s of Object.values(rateSegMap)) segOfMap[s] = (segOfMap[s] || 0) + 1;
    console.log(`  rate→segment map: ${Object.entries(segOfMap).map(([s, n]) => `${s}=${n}`).join(', ')}`);
  }

  // Collect everything, then batch-upsert (per-row was ~15 min for 18k rows).
  const rows = [];
  let chunkStart = argStart;
  while (chunkStart < argEnd) {
    const chunkEnd = addDays(chunkStart, 89) > argEnd ? argEnd : addDays(chunkStart, 89);
    let chunk;
    try { chunk = await fetchReservations(credentials, chunkStart, chunkEnd); }
    catch (err) { console.log(`  chunk ${chunkStart} ✗ ${err.message}`); chunkStart = addDays(chunkEnd, 1); continue; }
    for (const r of chunk) {
      const checkIn = r.ScheduledStartUtc, checkOut = r.ScheduledEndUtc, createdUtc = r.CreatedUtc;
      if (!checkIn || !checkOut || !createdUtc) continue;
      const serviceId = r.ServiceId || null;
      const rateId = r.RateId || null;
      const seg = segmentFor(hotelId, rateId, serviceId, rateSegMap);
      const nights = Math.max(1, Math.ceil(Math.abs(new Date(checkOut) - new Date(checkIn)) / 86400000));
      rows.push([r.Id, hotelId, checkIn.split('T')[0], checkOut.split('T')[0], nights,
        r.Origin || 'Mews', (r.State || '').toLowerCase(), createdUtc.split('T')[0],
        serviceId, rateId, seg, createdUtc]);
    }
    chunkStart = addDays(chunkEnd, 1);
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const vals = [];
    const ph = slice.map((r, j) => {
      const o = j * 12;
      vals.push(...r);
      return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5},$${o+6},$${o+7},$${o+8},$${o+9},$${o+10},$${o+11},$${o+12})`;
    }).join(',');
    await pool.query(
      `INSERT INTO reservations
          (id, hotel_id, check_in, check_out, nights, source, status, booking_date,
           mews_service_id, mews_rate_id, rate_segment, created_at)
        VALUES ${ph}
        ON CONFLICT (id, hotel_id) DO UPDATE SET
          mews_service_id = EXCLUDED.mews_service_id,
          mews_rate_id    = EXCLUDED.mews_rate_id,
          rate_segment    = EXCLUDED.rate_segment,
          updated_at      = NOW()`,
      vals,
    );
    process.stdout.write(`\r  upserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');

  const split = await pool.query(
    `SELECT rate_segment, COUNT(*)::int n FROM reservations WHERE hotel_id=$1 GROUP BY 1 ORDER BY 2 DESC`,
    [hotelId],
  );
  console.log(`  ✓ ${rows.length} fetched · DB split: ${split.rows.map((r) => `${r.rate_segment || 'null'}=${r.n}`).join(', ')}`);
}

async function run() {
  const ids = argHotelId ? [argHotelId] : MF_HOTELS;
  console.log(`Backfilling rate_segment for: ${ids.join(', ')}`);
  for (const id of ids) {
    try { await backfillHotel(id); }
    catch (err) { console.error(`  ✗ ${id} failed: ${err.message}`); }
  }
  await pool.end();
}

run();
