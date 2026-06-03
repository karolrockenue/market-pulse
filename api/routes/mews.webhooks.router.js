/**
 * @file mews.webhooks.router.js
 * @brief Handles inbound Mews General Webhook events.
 *
 * Mounted at: /api/mews-webhooks
 *
 * Mews General Webhooks send a POST with:
 *   { EnterpriseId, IntegrationId, Events: [{ Discriminator, Value: { Id } }] }
 *
 * We process ServiceOrderUpdated events (= reservation changes) by:
 *   1. Looking up the hotel by EnterpriseId (= hotels.pms_property_id)
 *   2. Fetching full reservation details from Mews API
 *   3. Upserting daily_bookings_record + reservations (idempotent replace)
 *   4. Applying rooms_sold delta only if this event actually changes state
 *      (active-flag flip or date-range change) — idempotency tracked per
 *      reservation in mews_webhook_state.
 *
 * Revenue is NOT written by this handler — Mews fires multiple webhook events
 * per reservation lifecycle and rate amendments would drift gross_revenue
 * in ways that are painful to unwind. Revenue is sourced exclusively from
 * the periodic `daily-refresh` job which pulls authoritative figures from
 * Mews `services/getAvailability` + `orderItems/getAll`.
 */

const express = require("express");
const router = express.Router();
const pgPool = require("../utils/db");
const mewsAdapter = require("../adapters/mewsAdapter");
const mfRateSegment = require("../services/mfRateSegment");

// States that represent "this reservation currently holds inventory".
// services/getAvailability (the refresh-job truth source) counts all of
// these as unsellable, so the webhook path must too.
const ACTIVE_STATES = new Set(["Optional", "Confirmed", "Started", "Processed"]);

// ─── Helper: Find hotel context by Mews Enterprise ID ──────────────

async function getHotelByEnterpriseId(enterpriseId) {
  const result = await pgPool.query(
    `SELECT hotel_id, pms_credentials, total_rooms
     FROM hotels
     WHERE pms_property_id = $1 AND pms_type = 'mews'
     LIMIT 1`,
    [enterpriseId],
  );

  if (result.rows.length === 0) return null;
  return result.rows[0];
}

// ─── Helper: Fetch reservation details from Mews ───────────────────

async function fetchReservationDetails(credentials, reservationId, _serviceId) {
  // No ServiceIds filter — multi-service properties (Westbourne, Primrose) have
  // Mid-Stay / Long-Stay / Management reservations under non-onboarded service
  // IDs. Filtering by the single onboarded service silently dropped those
  // (Blueprint §11). Now we accept whatever Mews returns and capture the
  // actual ServiceId on the reservation row.
  const payload = {
    ReservationIds: [reservationId],
    Limitation: { Count: 1 },
  };

  const response = await mewsAdapter._callMewsApi(
    "reservations/getAll/2023-06-06",
    credentials,
    payload,
  );

  if (!response.Reservations || response.Reservations.length === 0) {
    return null;
  }

  return response.Reservations[0];
}

/**
 * Fetches the total revenue for a reservation from Mews order items.
 * Used only for the ledger/reservations tables (both upsert-replace,
 * so safe to refresh on every webhook). Not used for daily_metrics_snapshots.
 */
async function fetchReservationRevenue(credentials, reservationId) {
  try {
    const response = await mewsAdapter._callMewsApi(
      "orderItems/getAll",
      credentials,
      {
        ServiceOrderIds: [reservationId],
        Types: ["SpaceOrder"],
        AccountingStates: ["Open", "Closed"],
        Limitation: { Count: 1000 },
      },
    );

    let totalNet = 0;
    let totalGross = 0;

    const items = response.OrderItems || [];
    items.forEach((item) => {
      if (item.Amount) {
        if (typeof item.Amount.NetValue === "number")
          totalNet += item.Amount.NetValue;
        if (typeof item.Amount.GrossValue === "number")
          totalGross += item.Amount.GrossValue;
      }
    });

    return { totalNet, totalGross };
  } catch (err) {
    console.warn(
      `[Mews Webhook] Revenue fetch failed for ${reservationId}:`,
      err.message,
    );
    return { totalNet: 0, totalGross: 0 };
  }
}

// ─── Helper: Apply a room-count delta across a date range ─────────

async function applyRoomsDelta(hotelId, checkInDate, checkOutDate, delta) {
  if (delta === 0) return;
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const stayDateStr = d.toISOString().split("T")[0];
    try {
      await pgPool.query(
        `INSERT INTO daily_metrics_snapshots (hotel_id, stay_date, rooms_sold)
         VALUES ($1, $2, GREATEST(0::numeric, $3))
         ON CONFLICT (hotel_id, stay_date)
         DO UPDATE SET
           rooms_sold = GREATEST(0::numeric, COALESCE(daily_metrics_snapshots.rooms_sold, 0::numeric) + $3)`,
        [hotelId, stayDateStr, delta],
      );
    } catch (err) {
      console.error(
        `[Mews Webhook] rooms_sold delta failed for ${stayDateStr}:`,
        err.message,
      );
    }
  }
}

// ─── Main Webhook Handler ──────────────────────────────────────────

router.post("/", async (req, res) => {
  const payload = req.body || {};

  console.log("--- [MEWS WEBHOOK RECEIVED] ---");
  console.log(
    `Enterprise: ${payload.EnterpriseId || "N/A"} | Events: ${
      payload.Events?.length || 0
    }`,
  );

  // Respond 200 immediately — Mews requires response within 5 seconds.
  // All processing happens async after this.
  res.status(200).json({ success: true });

  // 1. Validate basic structure
  if (
    !payload.EnterpriseId ||
    !payload.Events ||
    !Array.isArray(payload.Events)
  ) {
    console.log("[Mews Webhook] Invalid payload structure. Skipping.");
    return;
  }

  // 2. Find the hotel
  const hotel = await getHotelByEnterpriseId(payload.EnterpriseId);
  if (!hotel) {
    console.warn(
      `[Mews Webhook] Orphan Event: Enterprise ${payload.EnterpriseId} not found in our system. Skipping.`,
    );
    return;
  }

  const { hotel_id, pms_credentials } = hotel;

  // 3. Build credentials for API calls
  let credentials;
  try {
    credentials = await mewsAdapter.getCredentials(hotel_id);
  } catch (credErr) {
    console.error(
      `[Mews Webhook] Failed to get credentials for hotel ${hotel_id}:`,
      credErr.message,
    );
    return;
  }

  // 4. Filter for ServiceOrderUpdated events (= reservation changes)
  const reservationEvents = payload.Events.filter(
    (e) => e.Discriminator === "ServiceOrderUpdated",
  );

  if (reservationEvents.length === 0) {
    console.log(
      `[Mews Webhook] No ServiceOrderUpdated events. Received: ${payload.Events.map((e) => e.Discriminator).join(", ")}`,
    );
    return;
  }

  console.log(
    `[Mews Webhook] Processing ${reservationEvents.length} reservation events for hotel ${hotel_id}`,
  );

  // 5. Process each reservation event
  for (const event of reservationEvents) {
    const reservationId = event.Value?.Id;
    if (!reservationId) {
      console.warn("[Mews Webhook] Event missing Value.Id. Skipping.");
      continue;
    }

    try {
      // 5a. Fetch full reservation details (scoped to onboarded service)
      const expectedServiceId = pms_credentials?.serviceId;
      const reservation = await fetchReservationDetails(
        credentials,
        reservationId,
        expectedServiceId,
      );

      if (!reservation) {
        console.warn(
          `[Mews Webhook] Reservation ${reservationId} not found in Mews. Skipping.`,
        );
        continue;
      }

      const state = reservation.State;
      const checkInUtc = reservation.ScheduledStartUtc;
      const checkOutUtc = reservation.ScheduledEndUtc;
      const createdUtc = reservation.CreatedUtc;

      console.log(
        `[Mews Webhook] Reservation ${reservationId}: State=${state}, CheckIn=${checkInUtc}, CheckOut=${checkOutUtc}`,
      );

      const checkInDate = new Date(checkInUtc).toISOString().split("T")[0];
      const checkOutDate = new Date(checkOutUtc).toISOString().split("T")[0];
      const bookingDate = createdUtc
        ? new Date(createdUtc).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      const startDate = new Date(checkInUtc);
      const endDate = new Date(checkOutUtc);
      const diffTime = Math.abs(endDate - startDate);
      const numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      const currentActive = ACTIVE_STATES.has(state);

      // 5b. Refresh the ledger + reservations tables. Both use ON CONFLICT
      // DO UPDATE SET = EXCLUDED so they are safe to call on every webhook.
      const revenue = await fetchReservationRevenue(credentials, reservationId);
      const totalRevenue = revenue.totalGross;
      const avgNightlyRate =
        numNights > 0
          ? Math.round((totalRevenue / numNights) * 100) / 100
          : totalRevenue;
      const rStatus = state.toLowerCase();
      const rSource = reservation.Origin || "Mews";

      // Resolve M&F rate_segment at booking time (short|mid|long|exclude).
      // Returns null for non-M&F hotels; never throws (mason-and-fifth.md §19.3).
      const rateSegment = await mfRateSegment.classifyReservation(
        hotel_id,
        credentials,
        reservation.RateId,
        reservation.ServiceId,
      );

      // Resolve room category (studio type) at booking time so the rate-by-
      // studio-category charts never go stale. Full Mews name (cleanCategory
      // strips the "(...)" suffix on read). null for non-M&F / unresolved.
      const roomCategory = await mfRateSegment.resolveRoomCategory(
        hotel_id,
        credentials,
        reservation.RequestedResourceCategoryId,
      );

      try {
        await pgPool.query(
          `INSERT INTO daily_bookings_record
           (id, hotel_id, booking_date, check_in_date, revenue, status, source, room_nights)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             revenue = EXCLUDED.revenue,
             check_in_date = EXCLUDED.check_in_date,
             room_nights = EXCLUDED.room_nights,
             updated_at = NOW()`,
          [
            reservationId,
            hotel_id,
            bookingDate,
            checkInDate,
            totalRevenue,
            rStatus,
            rSource,
            numNights,
          ],
        );

        await pgPool.query(
          `INSERT INTO reservations
           (id, hotel_id, guest_name, room_type, check_in, check_out, nights, source, avg_nightly_rate, total_rate, status, booking_date, mews_service_id, mews_rate_id, rate_segment)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id, hotel_id) DO UPDATE SET
             room_type = COALESCE(EXCLUDED.room_type, reservations.room_type),
             check_out = EXCLUDED.check_out,
             nights = EXCLUDED.nights,
             avg_nightly_rate = EXCLUDED.avg_nightly_rate,
             total_rate = EXCLUDED.total_rate,
             status = EXCLUDED.status,
             mews_service_id = EXCLUDED.mews_service_id,
             mews_rate_id = EXCLUDED.mews_rate_id,
             rate_segment = EXCLUDED.rate_segment,
             updated_at = NOW()`,
          [
            reservationId,
            hotel_id,
            null,
            roomCategory,
            checkInDate,
            checkOutDate,
            numNights,
            rSource,
            avgNightlyRate,
            totalRevenue,
            rStatus,
            bookingDate,
            reservation.ServiceId || null,
            reservation.RateId || null,
            rateSegment,
          ],
        );
      } catch (ledgerErr) {
        console.error(
          "[Mews Webhook] Ledger Update Failed:",
          ledgerErr.message,
        );
        // Continue — the metrics update below is still useful.
      }

      // 5c. Idempotent rooms_sold update via mews_webhook_state.
      // The table remembers what this reservation has already contributed.
      // We compute a delta vs prior state and apply it, then update the row.
      const priorResult = await pgPool.query(
        `SELECT last_applied_active, last_applied_check_in, last_applied_check_out
         FROM mews_webhook_state WHERE reservation_id = $1`,
        [reservationId],
      );
      const prior = priorResult.rows[0] || null;

      const priorActive = prior ? prior.last_applied_active : false;
      const priorCheckIn = prior
        ? new Date(prior.last_applied_check_in).toISOString().split("T")[0]
        : null;
      const priorCheckOut = prior
        ? new Date(prior.last_applied_check_out).toISOString().split("T")[0]
        : null;

      const datesUnchanged =
        prior &&
        priorCheckIn === checkInDate &&
        priorCheckOut === checkOutDate;

      if (prior && priorActive === currentActive && datesUnchanged) {
        // No material change. Still refresh updated_at so we can see traffic.
        await pgPool.query(
          `UPDATE mews_webhook_state SET updated_at = NOW() WHERE reservation_id = $1`,
          [reservationId],
        );
        console.log(
          `[Mews Webhook] ${reservationId}: no-op (state/dates unchanged).`,
        );
      } else {
        // Subtract whatever we added previously (if anything).
        if (prior && priorActive) {
          await applyRoomsDelta(hotel_id, priorCheckIn, priorCheckOut, -1);
        }
        // Add current contribution (if active).
        if (currentActive) {
          await applyRoomsDelta(hotel_id, checkInDate, checkOutDate, +1);
        }

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
          [reservationId, hotel_id, currentActive, checkInDate, checkOutDate],
        );

        console.log(
          `[Mews Webhook] ${reservationId}: applied delta (prior=${priorActive}/${priorCheckIn}→${priorCheckOut}, now=${currentActive}/${checkInDate}→${checkOutDate}).`,
        );
      }
    } catch (resErr) {
      console.error(
        `[Mews Webhook] Error processing reservation ${reservationId}:`,
        resErr.message,
      );
      // Continue with next event — don't let one failure stop the batch
    }
  }

  console.log(
    `[Mews Webhook] Processed ${reservationEvents.length} reservation events for hotel ${hotel_id}`,
  );
});

module.exports = router;
