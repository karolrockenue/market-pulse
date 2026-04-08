/**
 * Full history backfill for a Mews hotel.
 * Walks back in 90-day chunks (Mews 3-month API limit) with a breather between each.
 *
 * Usage:
 *   node scripts/backfill-mews-full-history.js <hotel_id> [start_date]
 *
 * Examples:
 *   node scripts/backfill-mews-full-history.js 318341 2025-01-01
 *   node scripts/backfill-mews-full-history.js 318341  # defaults to 12 months ago
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const mewsAdapter = require('../api/adapters/mewsAdapter');

const MAX_NIGHTS = 30;
const CHUNK_DAYS = 89; // stay under Mews 3M1D limit
const BREATHER_MS = 5000; // 5s pause between chunks

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillChunk(hotelId, hotel, fromDate, toDate) {
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];
  console.log(`\n[Chunk] ${fromStr} → ${toStr}`);

  let credentials;
  try {
    credentials = await mewsAdapter.getCredentials(hotelId);
  } catch (err) {
    console.error(`[Chunk] Failed to get credentials: ${err.message}`);
    return 0;
  }

  // 1. Fetch reservations
  let allReservations = [];
  let cursor = null;

  do {
    const serviceId = hotel.pms_credentials?.serviceId;
    const payload = {
      CreatedUtc: {
        StartUtc: fromDate.toISOString(),
        EndUtc: toDate.toISOString(),
      },
      Limitation: { Count: 1000, Cursor: cursor },
    };
    if (serviceId) {
      payload.ServiceIds = [serviceId];
    }

    const response = await mewsAdapter._callMewsApi(
      'reservations/getAll/2023-06-06',
      credentials,
      payload
    );

    if (response.Reservations) {
      allReservations = allReservations.concat(response.Reservations);
    }
    cursor = response.Cursor || null;
  } while (cursor);

  // Filter
  allReservations = allReservations.filter(r => {
    if (r.State === 'Optional') return false;
    const checkIn = r.ScheduledStartUtc;
    const checkOut = r.ScheduledEndUtc;
    if (!checkIn || !checkOut) return false;
    const nights = Math.ceil(Math.abs(new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    return nights <= MAX_NIGHTS;
  });

  console.log(`[Chunk] ${allReservations.length} reservations (filtered).`);
  if (allReservations.length === 0) return 0;

  // 2. Room types
  const roomTypeMap = {};
  try {
    const serviceId = hotel.pms_credentials?.serviceId;
    const catResponse = await mewsAdapter._callMewsApi(
      'resourceCategories/getAll',
      credentials,
      { ServiceIds: serviceId ? [serviceId] : undefined, Limitation: { Count: 1000 } }
    );
    if (catResponse.ResourceCategories) {
      for (const cat of catResponse.ResourceCategories) {
        roomTypeMap[cat.Id] = cat.Names?.['en-GB'] || cat.Names?.en || cat.Name || null;
      }
    }
  } catch (err) {
    console.warn(`[Chunk] Room type lookup failed: ${err.message}`);
  }

  // 3. Revenue
  const revenueMap = {};
  const resIds = allReservations.map(r => r.Id);
  const BATCH_SIZE = 50;

  for (let i = 0; i < resIds.length; i += BATCH_SIZE) {
    const batch = resIds.slice(i, i + BATCH_SIZE);
    try {
      let batchCursor = null;
      do {
        const response = await mewsAdapter._callMewsApi(
          'orderItems/getAll',
          credentials,
          {
            ServiceOrderIds: batch,
            Types: ['SpaceOrder'],
            AccountingStates: ['Open', 'Closed'],
            Limitation: { Count: 1000, Cursor: batchCursor },
          }
        );
        for (const item of (response.OrderItems || [])) {
          const orderId = item.ServiceOrderId;
          if (!orderId) continue;
          if (!revenueMap[orderId]) revenueMap[orderId] = 0;
          if (item.Amount && typeof item.Amount.GrossValue === 'number') {
            revenueMap[orderId] += item.Amount.GrossValue;
          }
        }
        batchCursor = response.Cursor || null;
      } while (batchCursor);
    } catch (err) {
      console.warn(`[Chunk] orderItems batch failed: ${err.message}`);
    }
  }

  // 4. Upsert
  let inserted = 0;
  for (const res of allReservations) {
    try {
      const checkIn = new Date(res.ScheduledStartUtc).toISOString().split('T')[0];
      const checkOut = new Date(res.ScheduledEndUtc).toISOString().split('T')[0];
      const bookingDate = res.CreatedUtc
        ? new Date(res.CreatedUtc).toISOString().split('T')[0]
        : checkIn;
      const nights = Math.ceil(Math.abs(new Date(res.ScheduledEndUtc) - new Date(res.ScheduledStartUtc)) / (1000 * 60 * 60 * 24)) || 1;
      const roomType = roomTypeMap[res.RequestedResourceCategoryId] || null;
      const source = res.Origin || 'Mews';
      const status = res.State.toLowerCase();
      const totalRev = Math.round((revenueMap[res.Id] || 0) * 100) / 100;
      const avgRate = nights > 0 ? Math.round((totalRev / nights) * 100) / 100 : totalRev;

      await pool.query(
        `INSERT INTO reservations
         (id, hotel_id, guest_name, room_type, check_in, check_out, nights, source, avg_nightly_rate, total_rate, status, booking_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id, hotel_id) DO UPDATE SET
           room_type = COALESCE(EXCLUDED.room_type, reservations.room_type),
           check_out = EXCLUDED.check_out,
           nights = EXCLUDED.nights,
           avg_nightly_rate = EXCLUDED.avg_nightly_rate,
           total_rate = EXCLUDED.total_rate,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [res.Id, hotelId, null, roomType, checkIn, checkOut, nights, source, avgRate, totalRev, status, bookingDate]
      );
      inserted++;
    } catch (err) {
      // skip duplicates / errors silently
    }
  }

  console.log(`[Chunk] Inserted/updated: ${inserted}`);
  return inserted;
}

async function main() {
  const hotelId = parseInt(process.argv[2]);
  if (!hotelId) {
    console.error('Usage: node scripts/backfill-mews-full-history.js <hotel_id> [start_date]');
    process.exit(1);
  }

  const startArg = process.argv[3];
  const startDate = startArg ? new Date(startArg) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const hotelResult = await pool.query(
    `SELECT hotel_id, pms_property_id, pms_type, property_name, pms_credentials FROM hotels WHERE hotel_id = $1`,
    [hotelId]
  );
  if (hotelResult.rows.length === 0) {
    console.error(`Hotel ${hotelId} not found.`);
    process.exit(1);
  }
  const hotel = hotelResult.rows[0];
  if (hotel.pms_type !== 'mews') {
    console.error(`Hotel ${hotelId} is not a Mews property (type: ${hotel.pms_type}).`);
    process.exit(1);
  }

  console.log(`[Backfill] ${hotel.property_name} — full history from ${startDate.toISOString().split('T')[0]} to today`);

  // Walk forward in CHUNK_DAYS chunks
  let totalInserted = 0;
  let chunkStart = new Date(startDate);
  let chunkNum = 0;

  while (chunkStart < now) {
    chunkNum++;
    const chunkEnd = new Date(Math.min(chunkStart.getTime() + CHUNK_DAYS * 24 * 60 * 60 * 1000, now.getTime()));

    const inserted = await backfillChunk(hotelId, hotel, chunkStart, chunkEnd);
    totalInserted += inserted;

    chunkStart = new Date(chunkEnd.getTime() + 1);

    if (chunkStart < now) {
      console.log(`[Breather] Pausing ${BREATHER_MS / 1000}s before next chunk...`);
      await sleep(BREATHER_MS);
    }
  }

  console.log(`\n[Backfill] Complete. ${chunkNum} chunks, ${totalInserted} total reservations inserted/updated.`);
}

main()
  .catch(err => console.error('[Backfill] Fatal:', err))
  .finally(() => pool.end());
