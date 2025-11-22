
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
      "Authorization": `Bearer ${accessToken}`,
      "X-PROPERTY-ID": propertyId
    }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudbeds API Error: ${err}`);
  }

  return response.json();
}

// POST /api/webhooks
router.post("/", async (req, res) => {
  // 1. Always acknowledge receipt quickly (200 OK) to satisfy Cloudbeds.
  // We will process logic asynchronously or immediately after.
  res.status(200).json({ success: true });

  const payload = req.body;
  console.log("--- [WEBHOOK RECEIVED] ---");
  console.log(`Event: ${payload.event} | Res ID: ${payload.reservationID} | Property: ${payload.propertyID}`);


  // 2. Filter for relevant events
  // We handle 'created' (New Booking) and 'status_changed' (Cancellations)
  const allowedEvents = ['reservation/created', 'reservation/status_changed'];
  
  if (!allowedEvents.includes(payload.event)) {
    console.log(`[Webhook] Skipping event type: ${payload.event}`);
    return;
  }

  try {
    const cloudbedsPropertyId = payload.propertyID;
    const reservationId = payload.reservationID;

    // 3. Context Lookup
    const context = await getHotelContext(cloudbedsPropertyId);
    if (!context) {
      console.error(`[Webhook] ERROR: Could not find internal hotel_id or credentials for Cloudbeds ID: ${cloudbedsPropertyId}`);
      return;
    }


    const { hotel_id } = context;
    
    // Use the adapter to get a FRESH token (handles auto-refresh if expired)
    let accessToken;
    try {
        accessToken = await cloudbedsAdapter.getAccessToken(hotel_id);
    } catch (tokenErr) {
        console.error(`[Webhook] ERROR: Failed to refresh/get access token for hotel ${hotel_id}:`, tokenErr.message);
        return;
    }
    // 4. Fetch Details
    console.log(`[Webhook] Fetching details for Res ID: ${reservationId}...`);
    const resData = await fetchReservationDetails(reservationId, accessToken, cloudbedsPropertyId);
    
    if (!resData.success) {
      console.error(`[Webhook] API returned success:false for Res ID: ${reservationId}`, resData);
      return;
    }


    // 5. Determine Direction (Add or Subtract)
    // 'created' = Always Add
    // 'status_changed' = Check if 'canceled' or 'no_show' -> Subtract. Otherwise ignore.
    let multiplier = 0;
    
    if (payload.event === 'reservation/created') {
        multiplier = 1; // Add to metrics
    } else if (payload.event === 'reservation/status_changed') {
        const status = resData.data.status || '';
        console.log(`[Webhook] Status Changed to: ${status}`);
        
        if (['canceled', 'no_show'].includes(status)) {
            multiplier = -1; // Subtract from metrics
        } else {
            console.log(`[Webhook] Status is '${status}' (not a cancellation). No metric change needed.`);
            return;
        }
    }

    // 6. Calculate Metrics & Update DB
    const rooms = resData.data.rooms || [];
    console.log(`[Webhook] Processing ${rooms.length} rooms for hotel ${hotel_id} (Multiplier: ${multiplier})`);

    for (const room of rooms) {
        const checkIn = new Date(room.startDate);
        const checkOut = new Date(room.endDate);
        const totalRoomRevenue = parseFloat(room.total || 0);
        
        const diffTime = Math.abs(checkOut - checkIn);
        const numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const dailyRevenue = numNights > 0 ? (totalRoomRevenue / numNights) : 0;

        // Adjust values based on multiplier (Add or Subtract)
        const revenueDelta = dailyRevenue * multiplier;
        const roomDelta = 1 * multiplier;

        for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
            const stayDateStr = d.toISOString().split('T')[0];
            
            // SQL Upsert: 
            // Note: We assume the row exists if we are cancelling. 
            // If it's a new booking in far future, INSERT works.
      // SQL Upsert: 
            // Note: We assume the row exists if we are cancelling. 
            // If it's a new booking in far future, INSERT works.
            const updateQuery = `
                INSERT INTO daily_metrics_snapshots (hotel_id, stay_date, rooms_sold, gross_revenue)
                VALUES ($1, $2, GREATEST(0, $3), GREATEST(0, $4))
                ON CONFLICT (hotel_id, stay_date)
                DO UPDATE SET 
                    rooms_sold = GREATEST(0, COALESCE(daily_metrics_snapshots.rooms_sold, 0) + $5),
                    gross_revenue = GREATEST(0, COALESCE(daily_metrics_snapshots.gross_revenue, 0) + $6);
            `;
            
            // Params: 
            // $1: hotel_id
            // $2: stay_date
            // $3: Initial rooms (only if inserting new row, which only happens on 'created', so we use roomDelta)
            // $4: Initial rev
            // $5: roomDelta (Update value)
            // $6: revenueDelta (Update value)
            
            await pgPool.query(updateQuery, [
                hotel_id, 
                stayDateStr, 
                Math.max(0, roomDelta), // Initial insert value (sanitized)
                Math.max(0, revenueDelta), 
                roomDelta, 
                revenueDelta
            ]);
            
            console.log(`   -> Updated ${stayDateStr}: ${roomDelta > 0 ? '+' : ''}${roomDelta} Room, ${revenueDelta > 0 ? '+' : ''}$${revenueDelta.toFixed(2)} Rev`);
        }
    }

    console.log(`[Webhook] Success. Metrics updated for Reservation ${reservationId}`);

  } catch (error) {
    console.error("[Webhook] Processing Error:", error);
  }
});


// --- DEBUG ENDPOINT (TEMPORARY) ---
// GET /api/webhooks/debug?reservationID=...&propertyID=...
router.get("/debug", async (req, res) => {
  const { reservationID, propertyID } = req.query;
  const logs = [];

  try {
    logs.push(`Step 1: Starting Debug for Res ${reservationID}, Prop ${propertyID}`);

    // 1. Context Lookup
    const context = await getHotelContext(propertyID);
    if (!context) {
      logs.push("ERROR: getHotelContext returned null. Check pms_property_id mapping.");
      return res.json({ success: false, logs });
    }

    logs.push(`Step 2: Found Internal Hotel ID: ${context.hotel_id}`);

    let accessToken;
    try {
        accessToken = await cloudbedsAdapter.getAccessToken(context.hotel_id);
        logs.push("Step 3: Access Token retrieved via Adapter (Fresh).");
    } catch (tokenErr) {
        logs.push(`ERROR: Adapter failed to get token: ${tokenErr.message}`);
        return res.json({ success: false, logs });
    }

    // 2. Fetch Details
    logs.push("Step 4: Calling Cloudbeds API...");
    let resData;
    try {
      resData = await fetchReservationDetails(reservationID, accessToken, propertyID);
      logs.push(`Step 5: Cloudbeds API Success. Status: ${resData.status || 'OK'}`);
    } catch (apiErr) {
      logs.push(`ERROR: Cloudbeds API Failed: ${apiErr.message}`);
      return res.json({ success: false, logs });
    }

    // 3. Simulate Calculation
    const rooms = resData.data.rooms || [];
    logs.push(`Step 6: Found ${rooms.length} rooms in reservation.`);

    if (rooms.length === 0) {
        logs.push("WARNING: Reservation has 0 rooms? Check raw data.");
        logs.push(JSON.stringify(resData));
    }

    for (const room of rooms) {
        const checkIn = new Date(room.startDate);
        const checkOut = new Date(room.endDate);
        const totalRoomRevenue = parseFloat(room.total || 0);
        const diffTime = Math.abs(checkOut - checkIn);
        const numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dailyRevenue = numNights > 0 ? (totalRoomRevenue / numNights) : 0;
        
        logs.push(`   - Processing Room: ${checkIn.toISOString().split('T')[0]} to ${checkOut.toISOString().split('T')[0]} ($${dailyRevenue}/night)`);

        for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
            const stayDateStr = d.toISOString().split('T')[0];
            logs.push(`   - Attempting SQL Update for ${stayDateStr}...`);
            
             const updateQuery = `
                INSERT INTO daily_metrics_snapshots (hotel_id, stay_date, rooms_sold, gross_revenue)
                VALUES ($1, $2, 1, $3)
                ON CONFLICT (hotel_id, stay_date)
                DO UPDATE SET 
                    rooms_sold = GREATEST(0, COALESCE(daily_metrics_snapshots.rooms_sold, 0) + 1),
                    gross_revenue = GREATEST(0, COALESCE(daily_metrics_snapshots.gross_revenue, 0) + $3);
            `;
            
            await pgPool.query(updateQuery, [context.hotel_id, stayDateStr, dailyRevenue]);
            logs.push(`   - SQL Success for ${stayDateStr}`);
        }
    }

    res.json({ success: true, logs, raw_cloudbeds: resData });

  } catch (error) {
    logs.push(`FATAL ERROR: ${error.message}`);
    logs.push(error.stack);
    res.status(500).json({ success: false, logs });
  }
});

module.exports = router;