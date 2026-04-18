/**
 * One-shot pre-seed for mews_webhook_state.
 *
 * Populates the idempotency table so that the first post-deploy webhook
 * for any pre-existing reservation is recognised as "no change" and
 * does not double-count into daily_metrics_snapshots.rooms_sold.
 *
 * Fetches all reservations whose stay window overlaps
 * [today - 30d, today + 365d] for every Mews hotel, then upserts one
 * row per reservation reflecting current state + dates.
 *
 * Safe to re-run. Only writes to mews_webhook_state.
 *
 * Run: `node scripts/bootstrap-mews-webhook-state.js`
 */

require("dotenv").config();
const pgPool = require("../api/utils/db");
const mewsAdapter = require("../api/adapters/mewsAdapter");

const ACTIVE_STATES = new Set(["Optional", "Confirmed", "Started", "Processed"]);
const PAGE_SIZE = 1000;

async function fetchChunk(credentials, serviceId, fromIso, toIso) {
  const all = [];
  let cursor = null;
  while (true) {
    const payload = {
      ServiceIds: [serviceId],
      CollidingUtc: { StartUtc: fromIso, EndUtc: toIso },
      Extent: { Reservations: true },
      Limitation: cursor
        ? { Count: PAGE_SIZE, Cursor: cursor }
        : { Count: PAGE_SIZE },
    };

    const response = await mewsAdapter._callMewsApi(
      "reservations/getAll/2023-06-06",
      credentials,
      payload,
    );

    const batch = response.Reservations || [];
    all.push(...batch);

    if (batch.length < PAGE_SIZE) break;
    cursor = response.Cursor;
    if (!cursor) break;
  }
  return all;
}

async function fetchAllReservations(credentials, serviceId, fromDate, toDate) {
  // Mews caps CollidingUtc windows at ~3 months. Slide through in 80-day chunks.
  const CHUNK_DAYS = 80;
  const byId = new Map();
  let cursorDate = new Date(fromDate);
  while (cursorDate < toDate) {
    const chunkEnd = new Date(cursorDate);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + CHUNK_DAYS);
    const windowEnd = chunkEnd > toDate ? toDate : chunkEnd;
    const chunk = await fetchChunk(
      credentials,
      serviceId,
      cursorDate.toISOString(),
      windowEnd.toISOString(),
    );
    chunk.forEach((r) => {
      if (r.Id) byId.set(r.Id, r);
    });
    cursorDate = chunkEnd;
  }
  return Array.from(byId.values());
}

async function seedHotel(hotel) {
  const { hotel_id, property_name, pms_credentials } = hotel;
  const serviceId = pms_credentials?.serviceId;
  if (!serviceId) {
    console.warn(`[Seed] ${property_name}: no serviceId, skipping.`);
    return { inserted: 0, skipped: 0 };
  }

  const credentials = await mewsAdapter.getCredentials(hotel_id);

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 30);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 365);

  console.log(`[Seed] ${property_name}: fetching reservations ${from.toISOString().slice(0,10)} → ${to.toISOString().slice(0,10)} (80-day chunks)…`);
  const reservations = await fetchAllReservations(
    credentials,
    serviceId,
    from,
    to,
  );
  console.log(`[Seed] ${property_name}: ${reservations.length} reservations returned.`);

  let inserted = 0;
  let skipped = 0;

  for (const r of reservations) {
    const resId = r.Id;
    const state = r.State;
    const startUtc = r.ScheduledStartUtc;
    const endUtc = r.ScheduledEndUtc;

    if (!resId || !startUtc || !endUtc) {
      skipped++;
      continue;
    }

    const checkInDate = new Date(startUtc).toISOString().split("T")[0];
    const checkOutDate = new Date(endUtc).toISOString().split("T")[0];
    const active = ACTIVE_STATES.has(state);

    await pgPool.query(
      `INSERT INTO mews_webhook_state
       (reservation_id, hotel_id, last_applied_active, last_applied_check_in, last_applied_check_out, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (reservation_id) DO UPDATE SET
         hotel_id = EXCLUDED.hotel_id,
         last_applied_active = EXCLUDED.last_applied_active,
         last_applied_check_in = EXCLUDED.last_applied_check_in,
         last_applied_check_out = EXCLUDED.last_applied_check_out,
         updated_at = NOW()`,
      [resId, hotel_id, active, checkInDate, checkOutDate],
    );
    inserted++;
  }

  return { inserted, skipped };
}

async function run() {
  console.log("[Seed] Starting mews_webhook_state pre-seed…");

  const hotelsResult = await pgPool.query(
    `SELECT hotel_id, property_name, pms_credentials
     FROM hotels
     WHERE pms_type = 'mews' AND is_disconnected = false
     ORDER BY hotel_id`,
  );

  if (hotelsResult.rows.length === 0) {
    console.log("[Seed] No Mews hotels found. Exiting.");
    await pgPool.end();
    return;
  }

  let totalInserted = 0;
  for (const hotel of hotelsResult.rows) {
    try {
      const { inserted, skipped } = await seedHotel(hotel);
      console.log(`[Seed] ${hotel.property_name}: ${inserted} upserted, ${skipped} skipped.`);
      totalInserted += inserted;
    } catch (err) {
      console.error(`[Seed] ${hotel.property_name}: ERROR`, err.message);
    }
  }

  console.log(`[Seed] Done. Total upserted: ${totalInserted}`);
  await pgPool.end();
}

run().catch((err) => {
  console.error("[Seed] FATAL:", err);
  process.exit(1);
});
