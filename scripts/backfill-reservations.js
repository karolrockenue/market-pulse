/**
 * Backfill reservations table from PMS APIs.
 *
 * Usage:
 *   node scripts/backfill-reservations.js <hotel_id> [days]
 *
 * Uses daily_bookings_record as the source of reservation IDs (filtered by booking_date),
 * then fetches full details from PMS for each reservation (guest name, room type, rates).
 * Default: last 14 days.
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const cloudbedsAdapter = require('../api/adapters/cloudbedsAdapter');

const DELAY_MS = 300; // delay between API calls to avoid rate limits

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfill(hotelId, days) {
  console.log(`\n[Backfill] Starting for hotel_id=${hotelId}, last ${days} days...`);

  // 1. Get hotel info
  const hotelResult = await pool.query(
    `SELECT hotel_id, pms_property_id, pms_type, property_name, pms_credentials FROM hotels WHERE hotel_id = $1`,
    [hotelId]
  );
  if (hotelResult.rows.length === 0) {
    console.error(`Hotel ${hotelId} not found.`);
    return;
  }
  const hotel = hotelResult.rows[0];
  console.log(`[Backfill] Hotel: ${hotel.property_name} (PMS: ${hotel.pms_type}, Property: ${hotel.pms_property_id})`);

  if (hotel.pms_type === 'mews') {
    await backfillMews(hotelId, hotel, days);
    return;
  }

  // 2. Get reservation IDs from daily_bookings_record (by booking_date)
  const ledgerResult = await pool.query(
    `SELECT id, revenue, room_nights, booking_date, check_in_date, status, source
     FROM daily_bookings_record
     WHERE hotel_id = $1 AND booking_date >= CURRENT_DATE - $2::int
     ORDER BY booking_date DESC`,
    [hotelId, days]
  );
  const ledgerRows = ledgerResult.rows;
  console.log(`[Backfill] Found ${ledgerRows.length} reservations in daily_bookings_record.`);

  if (ledgerRows.length === 0) {
    console.log('[Backfill] Nothing to backfill.');
    return;
  }

  // 3. Get access token
  let accessToken;
  try {
    accessToken = await cloudbedsAdapter.getAccessToken(hotelId);
  } catch (err) {
    console.error(`[Backfill] Failed to get access token: ${err.message}`);
    return;
  }

  // 4. Fetch each reservation from Cloudbeds for full details
  let inserted = 0;
  let skipped = 0;
  let apiErrors = 0;

  for (const ledger of ledgerRows) {
    try {
      // Fetch full reservation details from Cloudbeds v1.1
      let resData;
      try {
        resData = await cloudbedsAdapter.getReservation(accessToken, hotel.pms_property_id, ledger.id);
      } catch (apiErr) {
        // Token might have expired mid-run
        if (apiErrors < 3) {
          console.warn(`[Backfill] API error for ${ledger.id}: ${apiErr.message}. Retrying with fresh token...`);
          try {
            accessToken = await cloudbedsAdapter.getAccessToken(hotelId);
            resData = await cloudbedsAdapter.getReservation(accessToken, hotel.pms_property_id, ledger.id);
          } catch (retryErr) {
            console.error(`[Backfill] Retry failed for ${ledger.id}: ${retryErr.message}`);
            apiErrors++;
            skipped++;
            continue;
          }
        } else {
          console.error(`[Backfill] Too many API errors. Stopping.`);
          break;
        }
      }

      if (!resData) {
        skipped++;
        continue;
      }

      // v1.2 getReservation returns data directly or wrapped in { success, data }
      const r = resData.data || resData;
      const guestName = r.guestName || r.guestFirstName || null;
      const startDate = r.startDate;
      const endDate = r.endDate;
      if (!startDate || !endDate) { skipped++; continue; }

      const bookingDate = r.dateCreated ? r.dateCreated.split(' ')[0].split('T')[0] : ledger.booking_date;
      const source = r.sourceName || r.source || ledger.source || 'Direct';
      const status = r.status || ledger.status || 'confirmed';

      // Nights
      const start = new Date(startDate);
      const end = new Date(endDate);
      const nights = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;

      // Revenue from ledger (more reliable than API response)
      const totalRev = parseFloat(ledger.revenue) || parseFloat(String(r.total || 0).replace(/[^0-9.-]+/g, '')) || 0;
      const avgRate = nights > 0 ? Math.round((totalRev / nights) * 100) / 100 : totalRev;

      // Room type from assigned/unassigned rooms
      const rooms = [...(r.assigned || []), ...(r.unassigned || [])];
      const roomType = rooms.length > 0 ? (rooms[0].roomTypeName || rooms[0].roomName || null) : null;

      await pool.query(
        `INSERT INTO reservations
         (id, hotel_id, guest_name, room_type, check_in, check_out, nights, source, avg_nightly_rate, total_rate, status, booking_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id, hotel_id) DO UPDATE SET
           guest_name = EXCLUDED.guest_name,
           room_type = COALESCE(EXCLUDED.room_type, reservations.room_type),
           check_out = EXCLUDED.check_out,
           nights = EXCLUDED.nights,
           avg_nightly_rate = EXCLUDED.avg_nightly_rate,
           total_rate = EXCLUDED.total_rate,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [ledger.id, hotelId, guestName, roomType, startDate, endDate, nights, source, avgRate, totalRev, status, bookingDate]
      );
      inserted++;

      if (inserted % 25 === 0) {
        console.log(`[Backfill] Progress: ${inserted}/${ledgerRows.length}...`);
      }

      await sleep(DELAY_MS);
    } catch (err) {
      console.error(`[Backfill] Error processing ${ledger.id}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`[Backfill] Done. Inserted/updated: ${inserted}, Skipped: ${skipped}, API errors: ${apiErrors}`);
}

// --- Mews Backfill ---

const MAX_NIGHTS = 30; // Skip reservations longer than this (likely maintenance/house-use)

async function backfillMews(hotelId, hotel, days) {
  const mewsAdapter = require('../api/adapters/mewsAdapter');

  // 1. Get credentials
  let credentials;
  try {
    credentials = await mewsAdapter.getCredentials(hotelId);
  } catch (err) {
    console.error(`[Backfill/Mews] Failed to get credentials: ${err.message}`);
    return;
  }

  // 2. Fetch reservations created in the last N days
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  console.log(`[Backfill/Mews] Fetching reservations created since ${from.toISOString().split('T')[0]}...`);

  let allReservations = [];
  let cursor = null;

  do {
    const serviceId = hotel.pms_credentials?.serviceId;
    const payload = {
      CreatedUtc: {
        StartUtc: from.toISOString(),
        EndUtc: now.toISOString(),
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

  console.log(`[Backfill/Mews] Got ${allReservations.length} reservations from Mews (pre-filter).`);

  // Filter out Optional state and long-stays (maintenance/house-use blocks)
  allReservations = allReservations.filter(r => {
    if (r.State === 'Optional') return false;
    const checkIn = r.ScheduledStartUtc;
    const checkOut = r.ScheduledEndUtc;
    if (!checkIn || !checkOut) return false;
    const nights = Math.ceil(Math.abs(new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    if (nights > MAX_NIGHTS) return false;
    return true;
  });

  console.log(`[Backfill/Mews] ${allReservations.length} reservations after filtering (<=  ${MAX_NIGHTS} nights, non-optional).`);

  if (allReservations.length === 0) {
    console.log('[Backfill/Mews] Nothing to backfill.');
    return;
  }

  // 3. Resolve customer names in bulk
  const customerIds = [...new Set(allReservations.map(r => r.AccountId).filter(Boolean))];
  const customerMap = {};

  if (customerIds.length > 0) {
    console.log(`[Backfill/Mews] Resolving ${customerIds.length} customer names...`);
    try {
      for (let i = 0; i < customerIds.length; i += 1000) {
        const batch = customerIds.slice(i, i + 1000);
        const custResponse = await mewsAdapter._callMewsApi(
          'customers/getAll',
          credentials,
          { CustomerIds: batch, Limitation: { Count: 1000 } }
        );
        if (custResponse.Customers) {
          for (const c of custResponse.Customers) {
            customerMap[c.Id] = [c.FirstName, c.LastName].filter(Boolean).join(' ') || null;
          }
        }
      }
      console.log(`[Backfill/Mews] Resolved ${Object.keys(customerMap).length} customer names.`);
    } catch (err) {
      console.warn(`[Backfill/Mews] Customer lookup failed: ${err.message}. Continuing without names.`);
    }
  }

  // 4. Resolve resource categories (room types) in bulk
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
    console.log(`[Backfill/Mews] Resolved ${Object.keys(roomTypeMap).length} room types.`);
  } catch (err) {
    console.warn(`[Backfill/Mews] Room type lookup failed: ${err.message}. Continuing without types.`);
  }

  // 5. Fetch revenue from Mews orderItems/getAll in batches
  //    Mews allows up to 1000 ServiceOrderIds per call
  const revenueMap = {};
  const resIds = allReservations.map(r => r.Id);
  console.log(`[Backfill/Mews] Fetching revenue for ${resIds.length} reservations from Mews orderItems...`);

  const BATCH_SIZE = 50; // Small batches to stay within Mews 1000-item result limit
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
      console.warn(`[Backfill/Mews] orderItems batch ${i}-${i + batch.length} failed: ${err.message}`);
    }

    if ((i + BATCH_SIZE) % 250 === 0) {
      console.log(`[Backfill/Mews] Revenue progress: ${Math.min(i + BATCH_SIZE, resIds.length)}/${resIds.length}...`);
    }
  }

  const withRevenue = Object.values(revenueMap).filter(v => v > 0).length;
  console.log(`[Backfill/Mews] Revenue resolved for ${withRevenue}/${resIds.length} reservations.`);

  // 6. Upsert each reservation
  let inserted = 0;
  let skipped = 0;

  for (const res of allReservations) {
    try {
      const resId = res.Id;

      const checkIn = res.ScheduledStartUtc;
      const checkOut = res.ScheduledEndUtc;
      const checkInDate = new Date(checkIn).toISOString().split('T')[0];
      const checkOutDate = new Date(checkOut).toISOString().split('T')[0];
      const bookingDate = res.CreatedUtc
        ? new Date(res.CreatedUtc).toISOString().split('T')[0]
        : checkInDate;

      const nights = Math.ceil(Math.abs(new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)) || 1;

      const guestName = customerMap[res.AccountId] || null;
      const roomType = roomTypeMap[res.RequestedResourceCategoryId] || null;
      const source = res.Origin || 'Mews';
      const status = res.State.toLowerCase();

      // Revenue from Mews orderItems
      const totalRev = Math.round((revenueMap[resId] || 0) * 100) / 100;
      const avgRate = nights > 0 ? Math.round((totalRev / nights) * 100) / 100 : totalRev;

      await pool.query(
        `INSERT INTO reservations
         (id, hotel_id, guest_name, room_type, check_in, check_out, nights, source, avg_nightly_rate, total_rate, status, booking_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id, hotel_id) DO UPDATE SET
           guest_name = COALESCE(EXCLUDED.guest_name, reservations.guest_name),
           room_type = COALESCE(EXCLUDED.room_type, reservations.room_type),
           check_out = EXCLUDED.check_out,
           nights = EXCLUDED.nights,
           avg_nightly_rate = EXCLUDED.avg_nightly_rate,
           total_rate = EXCLUDED.total_rate,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [resId, hotelId, guestName, roomType, checkInDate, checkOutDate, nights, source, avgRate, totalRev, status, bookingDate]
      );
      inserted++;
    } catch (err) {
      console.error(`[Backfill/Mews] Error processing reservation: ${err.message}`);
      skipped++;
    }
  }

  console.log(`[Backfill/Mews] Done. Inserted/updated: ${inserted}, Skipped: ${skipped}`);
}

// --- Main ---
const hotelId = parseInt(process.argv[2]);
const days = parseInt(process.argv[3]) || 14;
if (!hotelId) {
  console.error('Usage: node scripts/backfill-reservations.js <hotel_id> [days]');
  process.exit(1);
}

backfill(hotelId, days)
  .catch((err) => console.error('[Backfill] Fatal error:', err))
  .finally(() => pool.end());
