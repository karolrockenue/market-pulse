const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const pgPool = require("../utils/db");
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");

/**
 * Helper: Find internal hotel_id and credentials by Cloudbeds Property ID
 */
async function getHotelContext(cloudbedsPropertyId) {
  // We look for ANY user_property entry that matches this Cloudbeds ID and has credentials.
  // We join with the hotels table to ensure we get the internal hotel_id correctly.
  const query = `
    SELECT h.hotel_id, up.pms_credentials
    FROM hotels h
    JOIN user_properties up ON h.hotel_id = up.property_id
    WHERE (h.pms_property_id = $1 OR h.pms_property_id IS NULL) -- Handle legacy mapping where pms_id might be null but mapped via user_prop
    AND up.pms_credentials IS NOT NULL
    LIMIT 1;
  `;

  // Try matching directly on the pms_property_id stored in hotels table first (most reliable)
  const result = await pgPool.query(
    `SELECT h.hotel_id, h.history_locked_until::text AS history_locked_until,
            h.tax_rate, h.pricing_model, h.total_rooms, up.pms_credentials
     FROM hotels h
     JOIN user_properties up ON h.hotel_id = up.property_id
     WHERE h.pms_property_id = $1
     AND up.pms_credentials IS NOT NULL
     LIMIT 1`,
    [cloudbedsPropertyId.toString()]
  );

  if (result.rows.length > 0) {
    return result.rows[0];
  }
  return null;
}

/**
 * Helper: Fetch full reservation details from Cloudbeds
 */
async function fetchReservationDetails(reservationId, accessToken, propertyId) {
  const url = `https://api.cloudbeds.com/api/v1.1/getReservation?propertyID=${propertyId}&reservationID=${reservationId}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-PROPERTY-ID": propertyId,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudbeds API Error: ${err}`);
  }

  return response.json();
}

// POST /api/webhooks
router.post("/", async (req, res) => {
  const payload = req.body || {};
  console.log("--- [WEBHOOK RECEIVED] ---");
  // Log safely in case properties are undefined
  console.log(
    `Event: ${payload.event || "UNKNOWN"} | Res ID: ${
      payload.reservationID || "N/A"
    } | Property: ${payload.propertyID || "N/A"}`
  );

  // --- HELPER: Send 200 OK and exit ---
  // This ensures we NEVER leave Vercel hanging, preventing timeouts.
  const finish = (msg) => {
    if (msg) console.log(`[Webhook] ${msg}`);
    if (!res.headersSent) res.status(200).json({ success: true });
  };

  // 1. Filter for relevant events
  const allowedEvents = ["reservation/created", "reservation/status_changed"];

  if (!payload.event || !allowedEvents.includes(payload.event)) {
    return finish(`Skipping event type: ${payload.event}`);
  }

  // 2. Validate Payload Basics
  if (!payload.reservationID || !payload.propertyID) {
    return finish("Skipping invalid payload (Missing ID or PropertyID).");
  }

  try {
    const cloudbedsPropertyId = payload.propertyID;
    const reservationId = payload.reservationID;

    // 3. Context Lookup
    const context = await getHotelContext(cloudbedsPropertyId);
    if (!context) {
      // Changed to WARN: This is expected for hotels that haven't been onboarded yet.
      // We respond 200 to Cloudbeds so they stop retrying, but we don't spam our error logs.
      console.warn(
        `[Webhook] Orphan Event: Received webhook for Cloudbeds Property ${cloudbedsPropertyId}, but no connected user found. Skipping.`
      );
      return finish();
    }
    const {
      hotel_id,
      history_locked_until,
      tax_rate,
      pricing_model,
      total_rooms,
    } = context;

    // 4. Access Token
    let accessToken;
    try {
      accessToken = await cloudbedsAdapter.getAccessToken(hotel_id);
    } catch (tokenErr) {
      console.error(
        `[Webhook] ERROR: Failed to refresh/get access token for hotel ${hotel_id}:`,
        tokenErr.message
      );
      return finish();
    }

    // 5. Fetch Details
    console.log(`[Webhook] Fetching details for Res ID: ${reservationId}...`);
    let resData;
    try {
      resData = await fetchReservationDetails(
        reservationId,
        accessToken,
        cloudbedsPropertyId
      );
    } catch (fetchErr) {
      console.error(`[Webhook] API Fetch Error: ${fetchErr.message}`);
      return finish();
    }

    if (!resData.success) {
      console.error(
        `[Webhook] API returned success:false for Res ID: ${reservationId}`,
        resData
      );
      return finish();
    }

    // --- [NEW] Update Daily Bookings Record (Sales Ledger) ---
    // We do this BEFORE the metrics logic so the ledger is always accurate.
    try {
      const r = resData.data;
      // Safety: Cloudbeds usually sends "2024-01-01T12:00:00" or just "2024-01-01"
      const bookingDate = r.dateCreated
        ? r.dateCreated.split("T")[0]
        : new Date().toISOString().split("T")[0];

      const checkInDate = r.startDate;
      const checkOutDate = r.endDate; // Get End Date

      // Calculate Room Nights (Sales View)
      const start = new Date(checkInDate);
      const end = new Date(checkOutDate);
      const diffTime = Math.abs(end - start);
      const calculatedNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

      // Sanitize revenue
      const totalRev =
        parseFloat(String(r.total || 0).replace(/[^0-9.-]+/g, "")) || 0;
      const rStatus = r.status;
      const rSource = r.sourceName || r.source || "Direct";

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
          totalRev,
          rStatus,
          rSource,
          calculatedNights,
        ]
      );

      // --- Upsert into reservations table (detailed booking data) ---
      const guestName = r.guestName || r.guestFirstName || null;
      const allRooms = [...(r.assigned || []), ...(r.unassigned || [])];
      const roomType = allRooms.length > 0 ? (allRooms[0].roomTypeName || allRooms[0].roomName || null) : null;
      const avgNightlyRate = calculatedNights > 0 ? Math.round((totalRev / calculatedNights) * 100) / 100 : totalRev;

      await pgPool.query(
        `INSERT INTO reservations
         (id, hotel_id, guest_name, room_type, check_in, check_out, nights, source, avg_nightly_rate, total_rate, status, booking_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id, hotel_id) DO UPDATE SET
           guest_name = EXCLUDED.guest_name,
           room_type = EXCLUDED.room_type,
           check_out = EXCLUDED.check_out,
           nights = EXCLUDED.nights,
           avg_nightly_rate = EXCLUDED.avg_nightly_rate,
           total_rate = EXCLUDED.total_rate,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          reservationId,
          hotel_id,
          guestName,
          roomType,
          checkInDate,
          checkOutDate,
          calculatedNights,
          rSource,
          avgNightlyRate,
          totalRev,
          rStatus,
          bookingDate,
        ]
      );

      console.log(
        `[Webhook] Ledger + Reservations updated for Res ${reservationId} (${rStatus})`
      );
    } catch (ledgerErr) {
      console.error("[Webhook] Ledger Update Failed:", ledgerErr.message);
      // We do NOT stop execution; metrics might still need updating.
    }
    // ---------------------------------------------------------

    // 6. Authoritative metric resync (replaces the legacy ±1 incremental counter).
    //
    // The old counter nudged rooms_sold by +1/-1 per room-night on each event.
    // With no idempotency and an asymmetric cancel decrement it drifted between
    // nightly refreshes (over-counting sold -> under-reporting availability; the
    // Park Hotel 2026-06-15 incident). We now re-read the affected stay-dates'
    // metrics from the SAME authoritative source the nightly refresh uses
    // (Cloudbeds Insights, scoped to this reservation's nights) and SET them.
    // Because we SET rather than accumulate, the snapshot can never drift and
    // duplicate webhook deliveries are naturally idempotent.

    // Derive the affected stay-date window from the reservation's rooms,
    // falling back to reservation-level dates if room-level dates are absent.
    const rooms = [
      ...(resData.data.assigned || []),
      ...(resData.data.unassigned || []),
    ];
    const dateCandidates = [];
    for (const room of rooms) {
      if (room.startDate) dateCandidates.push(room.startDate.split("T")[0]);
      if (room.endDate) dateCandidates.push(room.endDate.split("T")[0]);
    }
    if (resData.data.startDate)
      dateCandidates.push(resData.data.startDate.split("T")[0]);
    if (resData.data.endDate)
      dateCandidates.push(resData.data.endDate.split("T")[0]);

    const validDates = dateCandidates.filter(Boolean).sort();
    if (validDates.length === 0) {
      return finish(
        `No stay dates on reservation ${reservationId}; nothing to resync.`
      );
    }
    const rangeStart = validDates[0];
    const rangeEnd = validDates[validDates.length - 1];

    // Fetch authoritative Insights metrics for ONLY this narrow window.
    let freshMetrics;
    try {
      freshMetrics = await cloudbedsAdapter.getUpcomingMetrics(
        accessToken,
        cloudbedsPropertyId,
        tax_rate || 0,
        pricing_model || "inclusive",
        rangeStart,
        rangeEnd
      );
    } catch (insightsErr) {
      // Never fall back to incremental math (that reintroduces drift). Skip the
      // metric update and let the nightly refresh reconcile. Log loudly.
      console.error(
        `[Webhook] Insights resync FAILED for hotel ${hotel_id} (${rangeStart}..${rangeEnd}): ${insightsErr.message}. Skipping metric update; nightly refresh will reconcile.`
      );
      return finish(
        `Ledger updated; metric resync deferred for ${reservationId}.`
      );
    }

    // Authoritative SET for each affected stay-date. Capacity mirrors the nightly
    // refresh (static total_rooms preferred); history-locked dates are skipped.
    const resyncDates = Object.keys(freshMetrics).filter(
      (d) => d >= rangeStart && d <= rangeEnd
    );
    let resyncedCount = 0;
    for (const stayDateStr of resyncDates) {
      if (history_locked_until && stayDateStr <= history_locked_until) {
        continue;
      }
      const m = freshMetrics[stayDateStr];
      const capacity = total_rooms || m.capacity_count || 0;

      await pgPool.query(
        `INSERT INTO daily_metrics_snapshots
           (hotel_id, stay_date, rooms_sold, capacity_count,
            net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (hotel_id, stay_date) DO UPDATE SET
             rooms_sold = EXCLUDED.rooms_sold,
             capacity_count = EXCLUDED.capacity_count,
             net_revenue = EXCLUDED.net_revenue,
             gross_revenue = EXCLUDED.gross_revenue,
             net_adr = EXCLUDED.net_adr,
             gross_adr = EXCLUDED.gross_adr,
             net_revpar = EXCLUDED.net_revpar,
             gross_revpar = EXCLUDED.gross_revpar;`,
        [
          hotel_id,
          stayDateStr,
          m.rooms_sold || 0,
          capacity,
          m.net_revenue || 0,
          m.gross_revenue || 0,
          m.net_adr || 0,
          m.gross_adr || 0,
          m.net_revpar || 0,
          m.gross_revpar || 0,
        ]
      );
      resyncedCount++;
    }

    return finish(
      `Authoritative resync complete for ${reservationId}: ${resyncedCount} stay-date(s) ${rangeStart}..${rangeEnd}.`
    );
  } catch (error) {
    console.error("[Webhook] FATAL Processing Error:", error);
    return finish(); // Always send 200 to stop retries, even on crash
  }
});

module.exports = router;
