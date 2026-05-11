/**
 * Backfill the new `reservations.mews_service_id` column for M&F hotels +
 * pull in any reservations that the existing single-service-filtered backfill
 * dropped (Mid Stay / Long Stay / Management). Property-wide fetch — no
 * ServiceIds filter, no nights cap, all states included.
 *
 * Usage:
 *   node scripts/backfill-mf-reservations-service-id.js                 # all 3 M&F hotels
 *   node scripts/backfill-mf-reservations-service-id.js 318341          # single hotel
 *   node scripts/backfill-mf-reservations-service-id.js 318341 2024-01-01 2026-05-11
 *
 * Why this exists: SS / MS / LS classification on the Sales Flash needs to
 * mirror Mews exactly (by service ID). Filtering by `nights <= 28` was a
 * heuristic and drifted ±10-15% vs Mews. With mews_service_id captured,
 * the panel ties to the unit.
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const mewsAdapter = require('../api/adapters/mewsAdapter');

const MF_HOTELS = [318329, 318341, 318343]; // Belsize, Westbourne, Primrose

const argHotelId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const argStart = process.argv[3] || '2024-01-01';
const argEnd = process.argv[4] || new Date().toISOString().slice(0, 10);

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function fetchReservations(credentials, fromIso, toIso) {
  const reservations = [];
  let cursor = null;
  do {
    const resp = await mewsAdapter._callMewsApi(
      'reservations/getAll/2023-06-06',
      credentials,
      {
        CreatedUtc: { StartUtc: `${fromIso}T00:00:00Z`, EndUtc: `${toIso}T00:00:00Z` },
        Limitation: { Count: 1000, Cursor: cursor },
      },
    );
    if (resp.Reservations) reservations.push(...resp.Reservations);
    cursor = resp.Cursor || null;
  } while (cursor);
  return reservations;
}

async function backfillHotel(hotelId) {
  const hotelRow = await pool.query(
    `SELECT property_name FROM hotels WHERE hotel_id = $1`,
    [hotelId],
  );
  if (hotelRow.rows.length === 0) {
    console.error(`  ✗ Hotel ${hotelId} not found`);
    return;
  }
  const name = hotelRow.rows[0].property_name;
  const credentials = await mewsAdapter.getCredentials(hotelId);

  console.log(`\n── ${name} (${hotelId}) ${argStart} → ${argEnd} ──`);

  // Chunk by 90 days (Mews's safe range for reservations/getAll filtered by CreatedUtc)
  let inserted = 0, updated = 0, total = 0;
  const serviceCounts = {};
  const statusCounts = {};

  let chunkStart = argStart;
  while (chunkStart < argEnd) {
    const chunkEnd = addDays(chunkStart, 89) > argEnd ? argEnd : addDays(chunkStart, 89);
    process.stdout.write(`  chunk ${chunkStart} → ${chunkEnd}… `);

    let chunkReservations;
    try {
      chunkReservations = await fetchReservations(credentials, chunkStart, chunkEnd);
    } catch (err) {
      console.log(`✗ ${err.message}`);
      chunkStart = addDays(chunkEnd, 1);
      continue;
    }

    for (const r of chunkReservations) {
      const checkIn = r.ScheduledStartUtc;
      const checkOut = r.ScheduledEndUtc;
      const createdUtc = r.CreatedUtc;
      const serviceId = r.ServiceId || null;
      const state = (r.State || '').toLowerCase();
      const origin = r.Origin || 'Mews';

      if (!checkIn || !checkOut || !createdUtc) continue;
      const checkInDate = checkIn.split('T')[0];
      const checkOutDate = checkOut.split('T')[0];
      const bookingDate = createdUtc.split('T')[0];
      const nights = Math.max(
        1,
        Math.ceil(Math.abs(new Date(checkOut) - new Date(checkIn)) / 86400000),
      );

      serviceCounts[serviceId || '(null)'] = (serviceCounts[serviceId || '(null)'] || 0) + 1;
      statusCounts[state] = (statusCounts[state] || 0) + 1;

      const result = await pool.query(
        `INSERT INTO reservations
            (id, hotel_id, check_in, check_out, nights, source, status, booking_date,
             mews_service_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id, hotel_id) DO UPDATE SET
            check_in = EXCLUDED.check_in,
            check_out = EXCLUDED.check_out,
            nights = EXCLUDED.nights,
            source = EXCLUDED.source,
            status = EXCLUDED.status,
            booking_date = EXCLUDED.booking_date,
            mews_service_id = EXCLUDED.mews_service_id,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted`,
        [r.Id, hotelId, checkInDate, checkOutDate, nights, origin, state, bookingDate,
         serviceId, createdUtc],
      );
      total++;
      if (result.rows[0].inserted) inserted++; else updated++;
    }

    console.log(`${chunkReservations.length} reservations`);
    chunkStart = addDays(chunkEnd, 1);
  }

  console.log(`  ✓ ${total} total — ${inserted} inserted, ${updated} updated`);
  console.log(`  Service IDs seen:`);
  Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]).forEach(([sid, n]) => {
    console.log(`    ${sid}: ${n}`);
  });
  console.log(`  Statuses: ${Object.entries(statusCounts).map(([s, n]) => `${s}=${n}`).join(', ')}`);
}

async function run() {
  const ids = argHotelId ? [argHotelId] : MF_HOTELS;
  console.log(`Backfilling mews_service_id for: ${ids.join(', ')}`);

  for (const id of ids) {
    try {
      await backfillHotel(id);
    } catch (err) {
      console.error(`  ✗ ${id} failed: ${err.message}`);
    }
  }

  await pool.end();
}

run();
