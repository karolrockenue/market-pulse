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
    `SELECT h.hotel_id, up.pms_credentials 
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
    const { hotel_id } = context;

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
      // Sanitize revenue
      const totalRev =
        parseFloat(String(r.total || 0).replace(/[^0-9.-]+/g, "")) || 0;
      const rStatus = r.status;
      const rSource = r.sourceName || r.source || "Direct";

      await pgPool.query(
        `INSERT INTO daily_bookings_record 
         (id, hotel_id, booking_date, check_in_date, revenue, status, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           revenue = EXCLUDED.revenue,
           check_in_date = EXCLUDED.check_in_date,
           updated_at = NOW()`,
        [
          reservationId,
          hotel_id,
          bookingDate,
          checkInDate,
          totalRev,
          rStatus,
          rSource,
        ]
      );
      console.log(
        `[Webhook] Ledger updated for Res ${reservationId} (${rStatus})`
      );
    } catch (ledgerErr) {
      console.error("[Webhook] Ledger Update Failed:", ledgerErr.message);
      // We do NOT stop execution; metrics might still need updating.
    }
    // ---------------------------------------------------------

    // 6. Determine Direction (Add or Subtract)
    let multiplier = 0;

    if (payload.event === "reservation/created") {
      multiplier = 1;
    } else if (payload.event === "reservation/status_changed") {
      const status = resData.data.status || "";
      console.log(`[Webhook] Status Changed to: ${status}`);

      if (["canceled", "no_show"].includes(status)) {
        multiplier = -1;
      } else {
        return finish(
          `Status is '${status}' (not a cancellation). No metric change needed.`
        );
      }
    }

    // 7. Calculate & SQL Update
    const rooms = [
      ...(resData.data.assigned || []),
      ...(resData.data.unassigned || []),
    ];
    console.log(
      `[Webhook] Processing ${rooms.length} rooms for hotel ${hotel_id} (Multiplier: ${multiplier})`
    );

    for (const room of rooms) {
      const checkIn = new Date(room.startDate);
      const checkOut = new Date(room.endDate);
      const totalRoomRevenue = parseFloat(room.roomTotal || room.total || 0);

      const diffTime = Math.abs(checkOut - checkIn);
      const numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const dailyRevenue = numNights > 0 ? totalRoomRevenue / numNights : 0;

      const revenueDelta = dailyRevenue * multiplier;
      const roomDelta = 1 * multiplier;

      for (
        let d = new Date(checkIn);
        d < checkOut;
        d.setDate(d.getDate() + 1)
      ) {
        const stayDateStr = d.toISOString().split("T")[0];

        // SQL: Note the 0::numeric casting for safety
        const updateQuery = `
                INSERT INTO daily_metrics_snapshots (hotel_id, stay_date, rooms_sold, gross_revenue)
                VALUES ($1, $2, GREATEST(0::numeric, $3), GREATEST(0::numeric, $4))
                ON CONFLICT (hotel_id, stay_date)
                DO UPDATE SET 
                    rooms_sold = GREATEST(0::numeric, COALESCE(daily_metrics_snapshots.rooms_sold, 0::numeric) + $5),
                    gross_revenue = GREATEST(0::numeric, COALESCE(daily_metrics_snapshots.gross_revenue, 0::numeric) + $6);
            `;

        await pgPool.query(updateQuery, [
          hotel_id,
          stayDateStr,
          Math.max(0, roomDelta),
          Math.max(0, revenueDelta),
          roomDelta,
          revenueDelta,
        ]);
      }
    }

    return finish(`Success. Metrics updated for Reservation ${reservationId}`);
  } catch (error) {
    console.error("[Webhook] FATAL Processing Error:", error);
    return finish(); // Always send 200 to stop retries, even on crash
  }
});

module.exports = router;
