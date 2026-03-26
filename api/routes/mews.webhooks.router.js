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
 *   3. Updating daily_metrics_snapshots and daily_bookings_record
 *
 * This parallels webhooks.router.js (Cloudbeds) but is completely independent.
 */

const express = require("express");
const router = express.Router();
const pgPool = require("../utils/db");
const mewsAdapter = require("../adapters/mewsAdapter");

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

async function fetchReservationDetails(credentials, reservationId) {
  const response = await mewsAdapter._callMewsApi(
    "reservations/getAll/2023-06-06",
    credentials,
    {
      ReservationIds: [reservationId],
      Limitation: { Count: 1 },
    },
  );

  if (!response.Reservations || response.Reservations.length === 0) {
    return null;
  }

  return response.Reservations[0];
}

/**
 * Fetches the total revenue for a reservation from Mews order items.
 * Returns { totalNet, totalGross } or { totalNet: 0, totalGross: 0 } on failure.
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
      // 5a. Fetch full reservation details
      const reservation = await fetchReservationDetails(
        credentials,
        reservationId,
      );

      if (!reservation) {
        console.warn(
          `[Mews Webhook] Reservation ${reservationId} not found in Mews. Skipping.`,
        );
        continue;
      }

      const state = reservation.State; // Confirmed, Started, Processed, Canceled
      const checkIn = reservation.ScheduledStartUtc;
      const checkOut = reservation.ScheduledEndUtc;
      const createdUtc = reservation.CreatedUtc;
      const cancelledUtc = reservation.CancelledUtc;

      console.log(
        `[Mews Webhook] Reservation ${reservationId}: State=${state}, CheckIn=${checkIn}, CheckOut=${checkOut}`,
      );

      // 5b. Determine direction (add or subtract)
      let multiplier = 0;

      if (
        state === "Confirmed" ||
        state === "Started" ||
        state === "Processed"
      ) {
        multiplier = 1;
      } else if (state === "Canceled") {
        multiplier = -1;
      } else {
        console.log(
          `[Mews Webhook] State '${state}' does not affect metrics. Skipping.`,
        );
        continue;
      }

      // 5c. Calculate room nights
      const startDate = new Date(checkIn);
      const endDate = new Date(checkOut);
      const diffTime = Math.abs(endDate - startDate);
      const numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      // 5c2. Fetch revenue for this reservation
      const revenue = await fetchReservationRevenue(credentials, reservationId);
      const totalRevenue = revenue.totalGross;
      const dailyRevenue = numNights > 0 ? totalRevenue / numNights : 0;

      console.log(
        `[Mews Webhook] Revenue: Gross=${totalRevenue.toFixed(2)}, Per Night=${dailyRevenue.toFixed(2)}`,
      );

      // 5d. Update daily_bookings_record (Sales Ledger)
      try {
        const bookingDate = createdUtc
          ? new Date(createdUtc).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];

        const checkInDate = new Date(checkIn).toISOString().split("T")[0];

        const rStatus = state.toLowerCase();
        const rSource = reservation.Origin || "Mews";

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

        console.log(
          `[Mews Webhook] Ledger updated for Res ${reservationId} (${rStatus}, Revenue: ${totalRevenue.toFixed(2)})`,
        );
      } catch (ledgerErr) {
        console.error(
          "[Mews Webhook] Ledger Update Failed:",
          ledgerErr.message,
        );
        // Continue — metrics update is more important
      }

      // 5e. Update daily_metrics_snapshots
      const roomDelta = 1 * multiplier;
      const revenueDelta = dailyRevenue * multiplier;

      for (
        let d = new Date(startDate);
        d < endDate;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        const stayDateStr = d.toISOString().split("T")[0];

        try {
          await pgPool.query(
            `INSERT INTO daily_metrics_snapshots (hotel_id, stay_date, rooms_sold, gross_revenue)
             VALUES ($1, $2, GREATEST(0::numeric, $3), GREATEST(0::numeric, $4))
             ON CONFLICT (hotel_id, stay_date)
             DO UPDATE SET 
               rooms_sold = GREATEST(0::numeric, COALESCE(daily_metrics_snapshots.rooms_sold, 0::numeric) + $5),
               gross_revenue = GREATEST(0::numeric, COALESCE(daily_metrics_snapshots.gross_revenue, 0::numeric) + $6)`,
            [
              hotel_id,
              stayDateStr,
              Math.max(0, roomDelta),
              Math.max(0, revenueDelta),
              roomDelta,
              revenueDelta,
            ],
          );
        } catch (metricsErr) {
          console.error(
            `[Mews Webhook] Metrics update failed for ${stayDateStr}:`,
            metricsErr.message,
          );
        }
      }

      console.log(
        `[Mews Webhook] Metrics updated: ${numNights} nights (multiplier: ${multiplier}) for Res ${reservationId}`,
      );
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
