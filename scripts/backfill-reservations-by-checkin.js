/**
 * Backfill the `reservations` table for a Cloudbeds hotel by check-in date range.
 *
 * Unlike scripts/backfill-reservations.js (which walks daily_bookings_record),
 * this pulls directly from Cloudbeds v1.3 getReservationsWithRateDetails,
 * so it can reach stays that never made it into the ledger (e.g. pre-webhook
 * history from when the hotel went live).
 *
 * Usage:
 *   node scripts/backfill-reservations-by-checkin.js <hotel_id> <checkInFrom> <checkInTo>
 *
 * Example:
 *   node scripts/backfill-reservations-by-checkin.js 318291 2025-08-01 2026-12-31
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const cloudbedsAdapter = require('../api/adapters/cloudbedsAdapter');

function dateOnly(value) {
  if (!value) return null;
  const s = String(value);
  return s.split(' ')[0].split('T')[0];
}

function computeNights(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const ms = Math.abs(end - start);
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function parseMoney(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function run(hotelId, checkInFrom, checkInTo) {
  const hotelRow = await pool.query(
    `SELECT hotel_id, pms_property_id, pms_type, property_name
       FROM hotels WHERE hotel_id = $1`,
    [hotelId]
  );
  if (hotelRow.rows.length === 0) throw new Error(`Hotel ${hotelId} not found`);
  const hotel = hotelRow.rows[0];
  if (hotel.pms_type !== 'cloudbeds') {
    throw new Error(`Hotel ${hotelId} is pms_type=${hotel.pms_type}, this script is Cloudbeds-only.`);
  }
  console.log(`\n[Backfill v2] ${hotel.property_name} (${hotelId}) — Cloudbeds property ${hotel.pms_property_id}`);
  console.log(`[Backfill v2] Check-in range: ${checkInFrom} → ${checkInTo}\n`);

  const accessToken = await cloudbedsAdapter.getAccessToken(hotelId);

  const reservations = await cloudbedsAdapter.getReservationsWithDetails(
    accessToken,
    hotel.pms_property_id,
    {
      checkInFrom,
      checkInTo,
      includeAllStatuses: 'true',
    }
  );

  console.log(`[Backfill v2] Cloudbeds returned ${reservations.length} reservations.\n`);
  if (reservations.length === 0) return;

  const sourcesSeen = new Map();
  const statusesSeen = new Map();
  let inserted = 0;
  let skipped = 0;

  for (const res of reservations) {
    try {
      const id = res.reservationID || res.id;
      if (!id) { skipped++; continue; }

      const startDate = dateOnly(res.reservationCheckIn || res.startDate);
      const endDate = dateOnly(res.reservationCheckOut || res.endDate);
      if (!startDate || !endDate) { skipped++; continue; }

      const nights = computeNights(startDate, endDate);
      const bookingDate = dateOnly(res.dateCreated) || startDate;
      const source = res.sourceName || res.source || 'Direct';
      const status = (res.status || 'confirmed').toLowerCase();
      const guestName = res.guestName || null;

      const rooms = [...(res.rooms || []), ...(res.assigned || []), ...(res.unassigned || [])];
      const roomType = rooms.length > 0
        ? (rooms[0].roomTypeName || rooms[0].roomName || null)
        : null;

      // Prefer the rate breakdown when available; fall back to `total` or `grandTotal`.
      let totalRev = parseMoney(res.total ?? res.grandTotal ?? res.balance);
      if (totalRev === 0 && Array.isArray(res.rooms)) {
        for (const r of res.rooms) {
          totalRev += parseMoney(r.roomTotal ?? r.subtotal);
        }
      }
      const avgRate = nights > 0 ? Math.round((totalRev / nights) * 100) / 100 : totalRev;

      await pool.query(
        `INSERT INTO reservations
           (id, hotel_id, guest_name, room_type, check_in, check_out, nights,
            source, avg_nightly_rate, total_rate, status, booking_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id, hotel_id) DO UPDATE SET
           guest_name       = COALESCE(EXCLUDED.guest_name, reservations.guest_name),
           room_type        = COALESCE(EXCLUDED.room_type, reservations.room_type),
           check_in         = EXCLUDED.check_in,
           check_out        = EXCLUDED.check_out,
           nights           = EXCLUDED.nights,
           source           = EXCLUDED.source,
           avg_nightly_rate = EXCLUDED.avg_nightly_rate,
           total_rate       = EXCLUDED.total_rate,
           status           = EXCLUDED.status,
           booking_date     = EXCLUDED.booking_date,
           updated_at       = NOW()`,
        [String(id), hotelId, guestName, roomType, startDate, endDate, nights,
         source, avgRate, totalRev, status, bookingDate]
      );

      inserted++;
      sourcesSeen.set(source, (sourcesSeen.get(source) || 0) + 1);
      statusesSeen.set(status, (statusesSeen.get(status) || 0) + 1);

      if (inserted % 100 === 0) {
        console.log(`[Backfill v2] ${inserted}/${reservations.length} upserted...`);
      }
    } catch (err) {
      console.error(`[Backfill v2] Row error: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n[Backfill v2] Done. Upserted: ${inserted}, Skipped: ${skipped}\n`);

  console.log('Sources seen:');
  console.table([...sourcesSeen.entries()].sort((a, b) => b[1] - a[1]).map(([source, n]) => ({ source, n })));
  console.log('Statuses seen:');
  console.table([...statusesSeen.entries()].sort((a, b) => b[1] - a[1]).map(([status, n]) => ({ status, n })));
}

module.exports = { run };

if (require.main === module) {
  const hotelId = parseInt(process.argv[2], 10);
  const checkInFrom = process.argv[3];
  const checkInTo = process.argv[4];

  if (!hotelId || !checkInFrom || !checkInTo) {
    console.error('Usage: node scripts/backfill-reservations-by-checkin.js <hotel_id> <checkInFrom> <checkInTo>');
    console.error('Example: node scripts/backfill-reservations-by-checkin.js 318291 2025-08-01 2026-12-31');
    process.exit(1);
  }

  run(hotelId, checkInFrom, checkInTo)
    .catch(err => { console.error('[Backfill v2] Fatal:', err); process.exitCode = 1; })
    .finally(() => pool.end());
}
