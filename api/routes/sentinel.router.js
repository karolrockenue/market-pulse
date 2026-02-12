/**
 * @file sentinel.router.js
 * @brief API router for the Sentinel AI Control Panel.
 * This router is "firewalled" and only interacts with sentinel.adapter.js.
 * All routes are protected by super_admin-only middleware.
 */
const express = require("express");
const router = express.Router();
const { requireAdminApi } = require("../utils/middleware"); // [MODIFIED] Allow Admin access
const sentinelAdapter = require("../adapters/sentinel.adapter.js");
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter.js"); // [Added for Export Feature]
const sentinelService = require("../services/sentinel.service.js"); // <-- NEW SERVICE IMPORT
const db = require("../utils/db"); // <-- [NEW] Import database connection

// =============================================================================
// 1. PUBLIC / CRON ROUTE (MUST be defined BEFORE requireAdminApi)
// =============================================================================

/**
 * [CRON WORKER] POST /api/sentinel/process-queue
 * Triggered by Vercel Cron every minute.
 * Bypasses Admin Auth but requires CRON_SECRET.
 */
router.all("/process-queue", async (req, res) => {
  // [SECURITY] Verify Vercel Cron Secret
  // Vercel automatically injects CRON_SECRET as an env var and sends it in the header.
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // Allow localhost for debugging, otherwise enforce Secret
  const isLocal =
    process.env.NODE_ENV === "development" ||
    req.hostname === "localhost" ||
    req.hostname === "127.0.0.1";

  if (!isLocal) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Sentinel] Unauthorized Cron Attempt blocked.");
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized Cron Trigger" });
    }
  }

  // Run the worker logic (waits up to 50s to drain queue)
  await runBackgroundWorker();

  // Respond only after work is done
  res.status(200).json({ success: true, message: "Worker cycle complete." });
});

// =============================================================================
// 2. ADMIN MIDDLEWARE (Protects all routes below this line)
// =============================================================================
router.use(requireAdminApi);
// ... existing imports ...
// [REPLACEMENT] Full "Export Reservations" Route
// Helper to prevent API Bans (Rate Limiter)

// Helper to prevent API Bans (Rate Limiter)
// Helper to prevent API Bans (Rate Limiter)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// [REMOVED] Local buildRateIdMap - logic moved to Sentinel Service

/**
 * [NEW] POST /api/sentinel/trigger-dgx
 * Proxies a request to the External NVIDIA DGX Spark Server.
 * Executes the Python Sentinel Logic for a specific hotel.
 */
router.post("/trigger-dgx", async (req, res) => {
  const { hotelId } = req.body;

  // Configuration: Set this in your Vercel/Node .env file
  // Example: https://dgx-spark.rockenue.com or http://123.45.67.89:5000
  const DGX_URL = process.env.DGX_API_URL || "http://localhost:5000";

  if (!hotelId) {
    return res.status(400).json({ success: false, message: "Missing hotelId" });
  }

  try {
    console.log(`[Sentinel] Triggering DGX AI for Hotel ${hotelId}...`);

    const response = await fetch(`${DGX_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotel_id: hotelId }),
    });

    if (!response.ok) {
      throw new Error(
        `DGX responded with ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(`[Sentinel] DGX Response:`, data);

    res.status(200).json({
      success: true,
      message: "DGX Analysis Complete",
      data: data,
    });
  } catch (error) {
    console.error("[Sentinel] DGX Trigger Failed:", error.message);
    res.status(502).json({
      success: false,
      message:
        "Failed to contact DGX Server. Ensure the Python script is running.",
      error: error.message,
    });
  }
});

/**
 * [NEW] POST /api/sentinel/recalculate
--- END ---
 * Triggers a full re-calculation of rates for ALL rooms based on:
 * 1. The Base Rate (AI Engine)
 * 2. The Configured Differentials
 * Pushes the result to the Job Queue.
 */
/**
 * [NEW] POST /api/sentinel/recalculate
 * Triggers a full re-calculation of rates for ALL rooms based on:
 * 1. The Base Rate (AI Engine)
 * 2. The Configured Differentials
 * Pushes the result to the Job Queue.
 * [UPDATED] With Deep Tracing to debug "0 updates" issue.
 */
router.post("/recalculate", async (req, res) => {
  const { hotelId, startDate, endDate } = req.body;

  if (!hotelId)
    return res.status(400).json({ success: false, message: "Missing hotelId" });

  // [CRITICAL SAFETY FIX]
  // Strictly enforce startDate and endDate. NEVER default to 365 days.
  // This prevents accidental "Mass Wipes" or full-year overwrites.
  if (!startDate || !endDate) {
    console.warn(
      `[Sentinel] Blocked Unsafe Recalculation Attempt for Hotel ${hotelId} (Missing Dates)`,
    );
    return res.status(400).json({
      success: false,
      message:
        "Safety Block: 'startDate' and 'endDate' are STRICTLY REQUIRED. Full-year wildcards are disabled.",
    });
  }

  try {
    console.log(
      `[Sentinel] Recalculate Triggered: Hotel ${hotelId} | Range: ${startDate} to ${endDate}`,
    );

    // 1. Fetch Configuration (Facts + Rules)
    const configRes = await db.query(
      "SELECT * FROM sentinel_configurations WHERE hotel_id = $1",
      [hotelId],
    );

    if (configRes.rows.length === 0) {
      throw new Error("Configuration not found. Please Sync with PMS first.");
    }

    const config = configRes.rows[0];
    const baseRoomTypeId = config.base_room_type_id;
    const differentials = config.room_differentials || [];
    const pmsRoomTypes = config.pms_room_types?.data || [];
    const pmsRatePlans = config.pms_rate_plans?.data || [];

    if (!baseRoomTypeId) {
      throw new Error("Base Room Type not defined in configuration.");
    }

    // --- SELF-HEALING MAP LOGIC (Corrects "Death Spiral" targeting) ---
    // Ensure we are targeting "Standard" plans, not "Net/Package" plans.
    const currentMap = config.rate_id_map || {};
    const freshMap = sentinelService.buildRateIdMap(pmsRoomTypes, pmsRatePlans);

    // If the map is empty, we cannot proceed safely.
    if (Object.keys(freshMap).length === 0) {
      throw new Error(
        "Critical: Unable to build a valid Rate ID Map. Check PMS Rate Plans.",
      );
    }

    let needsUpdate = false;
    if (JSON.stringify(currentMap) !== JSON.stringify(freshMap)) {
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(
        `[Sentinel] Healing Rate ID Map for Hotel ${hotelId} (Correcting Target Plans)...`,
      );
      await db.query(
        `UPDATE sentinel_configurations SET rate_id_map = $1, updated_at = NOW() WHERE hotel_id = $2`,
        [JSON.stringify(freshMap), hotelId],
      );
      // Update local config object so the rest of the function uses the new map
      config.rate_id_map = freshMap;
    }
    // ----------------------------

    // 2. Get Calculated Rates (Scoped strictly to requested range)
    // [FIX] Pass the specific startDate/endDate to previewCalendar, NOT the full year.
    const previewCalendar = await sentinelService.previewCalendar({
      hotelId,
      baseRoomTypeId,
      startDate: startDate,
      endDate: endDate,
    });

    // 3. Build Master Payload
    const allOverrides = [];

    // Loop through EVERY room type
    for (const room of pmsRoomTypes) {
      const roomTypeId = room.roomTypeID;
      let isBase = String(roomTypeId) === String(baseRoomTypeId);
      let diffRule = differentials.find(
        (r) => String(r.roomTypeId) === String(roomTypeId),
      );

      // For each day in the calendar...
      previewCalendar.forEach((day) => {
        // [FIX] Use 'finalRate' instead of 'rate'
        if (!day.finalRate || day.finalRate <= 0) return;

        let finalRate = parseFloat(day.finalRate);

        // Apply Differential
        if (!isBase && diffRule) {
          const val = parseFloat(diffRule.value);
          if (diffRule.operator === "+") {
            finalRate = finalRate * (1 + val / 100);
          } else if (diffRule.operator === "-") {
            finalRate = finalRate * (1 - val / 100);
          }
        }

        finalRate = Math.round(finalRate * 100) / 100;

        if (isNaN(finalRate) || finalRate <= 0) return;

        allOverrides.push({
          date: day.date,
          room_type_id: roomTypeId,
          rate: finalRate,
        });
      });
    }

    // --- DEBUG TRACE 1 ---
    console.log(
      `[Trace] Generated ${allOverrides.length} total overrides across ${pmsRoomTypes.length} rooms.`,
    );
    // ---------------------

    // 4. Send to Queue
    const hotelRes = await db.query(
      "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
      [hotelId],
    );
    const pmsPropertyId = hotelRes.rows[0]?.pms_property_id;
    console.log(`[Trace] Using PMS Property ID: ${pmsPropertyId}`);

    const overridesByRoom = {};
    allOverrides.forEach((o) => {
      if (!overridesByRoom[o.room_type_id])
        overridesByRoom[o.room_type_id] = [];
      overridesByRoom[o.room_type_id].push({ date: o.date, rate: o.rate });
    });

    let totalQueued = 0;
    let roomsProcessed = 0;

    for (const [rId, rates] of Object.entries(overridesByRoom)) {
      // --- DEBUG TRACE 2 ---
      console.log(
        `[Trace] Processing Room ${rId} with ${rates.length} rates...`,
      );
      // ---------------------

      // [FIX] Pass 'SENTINEL' as source so it shows up in Last Run stats
      const batchPayload = await sentinelService.buildOverridePayload(
        hotelId,
        pmsPropertyId,
        rId,
        rates,
        "SENTINEL",
      );

      // --- DEBUG TRACE 3 ---
      console.log(
        `[Trace] Service returned payload size: ${
          batchPayload ? batchPayload.length : "NULL/0"
        }`,
      );
      // ---------------------

      if (batchPayload && batchPayload.length > 0) {
        const CHUNK_SIZE = 30;
        for (let i = 0; i < batchPayload.length; i += CHUNK_SIZE) {
          const chunk = batchPayload.slice(i, i + CHUNK_SIZE);
          await db.query(
            `INSERT INTO sentinel_job_queue (hotel_id, payload, status) VALUES ($1, $2, 'PENDING')`,
            [hotelId, JSON.stringify({ pmsPropertyId, rates: chunk })],
          );
        }
        totalQueued += batchPayload.length;
        roomsProcessed++;
      }
    }

    // 5. [VERCEL OPTIMIZATION] Do not kick worker manually.
    // The Cron job will pick up the PENDING jobs within 60 seconds.
    res.status(200).json({
      success: true,
      message: `Recalculation queued. The background worker will process ${totalQueued} updates shortly.`,
    });
  } catch (error) {
    console.error("[Sentinel] Re-Push Failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post("/export-reservations", async (req, res) => {
  // If hotelId is sent, do that one. If NOT, do ALL managed hotels.
  const { hotelId, hotelIds } = req.body;

  const client = await db.connect();

  try {
    // 1. Determine which hotels to process
    let hotelsToProcess = [];

    if (Array.isArray(hotelIds) && hotelIds.length > 0) {
      // Explicit list of hotel IDs (sequential)
      const result = await client.query(
        `SELECT hotel_id, pms_property_id 
         FROM hotels 
         WHERE hotel_id = ANY($1::int[])
         ORDER BY hotel_id ASC`,
        [hotelIds.map((id) => parseInt(id, 10))],
      );
      hotelsToProcess = result.rows;
    } else {
      // All managed hotels
      const result = await client.query(
        "SELECT hotel_id, pms_property_id FROM hotels WHERE is_rockenue_managed = true ORDER BY hotel_id ASC",
      );
      hotelsToProcess = result.rows;
    }

    if (hotelsToProcess.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No hotels found to process." });
    }

    console.log(
      `[Export] Starting Batch Export for ${hotelsToProcess.length} hotels...`,
    );

    let totalInserted = 0;

    // 2. Loop through Hotels (One by One)
    for (const hotel of hotelsToProcess) {
      const currentHotelId = hotel.hotel_id;
      const pmsPropertyId = hotel.pms_property_id;

      console.log(
        `\n[Export] === Processing Hotel: ${currentHotelId} (PMS: ${pmsPropertyId}) ===`,
      );

      try {
        const accessToken =
          await cloudbedsAdapter.getAccessToken(currentHotelId);

        // Fetch reservations, then cap for verification
        const reservations = await cloudbedsAdapter.getReservations(
          accessToken,
          pmsPropertyId,
          { status: "confirmed,canceled,checked_in,checked_out" },
        );

        const limitedReservations = reservations; // use full list

        console.log(
          `[Export] Found ${reservations.length} reservations. Processing all of them...`,
        );

        // 3. Process Reservations with Smart Retries
        for (const summary of limitedReservations) {
          let attempts = 0;
          let success = false;

          while (attempts < 3 && !success) {
            try {
              attempts++;

              // Fetch Detail (Rate-limited to ~8/sec)
              const detailRes = await cloudbedsAdapter.getReservation(
                accessToken,
                pmsPropertyId,
                summary.reservationID,
              );

              // RATE LIMIT: wait 125ms → 8 requests/sec
              await sleep(125);

              // ================= DEBUG: ADULTS / CHILDREN RAW PAYLOAD =================
              if (
                detailRes.status === "confirmed" ||
                detailRes.status === "checked_in" ||
                detailRes.status === "canceled"
              ) {
                console.log("[DEBUG][ADULTS PAYLOAD]", {
                  reservationID: detailRes.reservationID,
                  status: detailRes.status,
                  adults_field: detailRes.adults,
                  children_field: detailRes.children,
                  assigned_units: detailRes.assigned?.map((u) => ({
                    adults: u.adults,
                    children: u.children,
                    roomTotal: u.roomTotal,
                  })),
                  unassigned_units: detailRes.unassigned?.map((u) => ({
                    adults: u.adults,
                    children: u.children,
                    roomTotal: u.roomTotal,
                  })),
                  legacy_rooms: detailRes.rooms?.map((u) => ({
                    adults: u.adults,
                    children: u.children,
                    roomTotal: u.roomTotal,
                  })),
                });
              }
              // =======================================================================

              // If we get here, the API call worked!
              success = true;

              if (!detailRes || !detailRes.reservationID) continue;

              // [DATA PROCESSING LOGIC]
              // 1. Universal Unit Fix
              // [DATA PROCESSING LOGIC]
              // DEBUG: dump cancellation-related fields for canceled reservations
              if (detailRes.status === "canceled") {
                console.log(
                  "[Export][DEBUG] Raw canceled reservation payload:",
                  {
                    reservationID: detailRes.reservationID,
                    status: detailRes.status,
                    dateCreated: detailRes.dateCreated,
                    dateCancelled: detailRes.dateCancelled,
                    dateCancelledUTC: detailRes.dateCancelledUTC,
                    dateCanceled: detailRes.dateCanceled,
                    date_canceled: detailRes.date_canceled,
                    cancellation_date: detailRes.cancellation_date,
                  },
                );
              }

              // 1. Universal Unit Fix
              const assigned = Array.isArray(detailRes.assigned)
                ? detailRes.assigned
                : [];
              const unassigned = Array.isArray(detailRes.unassigned)
                ? detailRes.unassigned
                : [];
              const legacyRooms = Array.isArray(detailRes.rooms)
                ? detailRes.rooms
                : [];
              const primaryUnit =
                assigned[0] || unassigned[0] || legacyRooms[0] || null;

              // 2. Calc Revenue
              let rawRevenue = detailRes.total;
              if (!rawRevenue || parseFloat(rawRevenue) === 0) {
                let sum = 0;
                [...assigned, ...unassigned, ...legacyRooms].forEach((r) => {
                  sum += parseFloat(r.roomTotal) || 0;
                });
                rawRevenue = sum;
              }
              const revenue =
                parseFloat(String(rawRevenue).replace(/[^0-9.-]+/g, "")) || 0;

              const occSource =
                assigned[0] || unassigned[0] || legacyRooms[0] || null;

              let finalAdults = 0;
              let childrenCount = 0;

              if (occSource) {
                finalAdults = parseInt(occSource.adults || 0, 10) || 0;
                childrenCount = parseInt(occSource.children || 0, 10) || 0;
              }

              // 4. Extract & normalize daily rates to { "YYYY-MM-DD": number }
              let dailyRatesJson = "{}";
              let roomTypeId = null;
              let ratePlanId = null;

              if (primaryUnit) {
                roomTypeId = primaryUnit.roomTypeID || null;
                ratePlanId =
                  primaryUnit.rateID || primaryUnit.ratePlanID || null;
                const ratesRaw =
                  primaryUnit.detailedRates || primaryUnit.dailyRates;

                if (Array.isArray(ratesRaw)) {
                  const map = {};
                  for (const r of ratesRaw) {
                    if (r.date && r.rate != null) {
                      map[r.date] =
                        parseFloat(String(r.rate).replace(/[^0-9.-]+/g, "")) ||
                        0;
                    }
                  }
                  dailyRatesJson = JSON.stringify(map);
                } else if (ratesRaw && typeof ratesRaw === "object") {
                  const map = {};
                  for (const [k, v] of Object.entries(ratesRaw)) {
                    map[k] =
                      parseFloat(String(v).replace(/[^0-9.-]+/g, "")) || 0;
                  }
                  dailyRatesJson = JSON.stringify(map);
                }
              }

              // 5. Cancellation + booking dates
              // Prefer explicit cancellation fields; fallback to dateModified/dateModifiedUTC
              const isCanceled =
                String(detailRes.status).toLowerCase() === "canceled";

              const cancelDate = isCanceled
                ? detailRes.dateCancelled ||
                  detailRes.dateCancelledUTC ||
                  detailRes.dateCanceled ||
                  detailRes.date_canceled ||
                  detailRes.cancellation_date ||
                  detailRes.dateModified || // fallback: modification timestamp
                  detailRes.dateModifiedUTC || // fallback: modification timestamp (UTC)
                  null
                : null;

              // DEBUG: log decision for canceled reservations
              if (isCanceled) {
                console.log("[Export][DEBUG] cancelDate decision:", {
                  reservationID: detailRes.reservationID,
                  status: detailRes.status,
                  cancelDate,
                  dateCancelled: detailRes.dateCancelled,
                  dateCancelledUTC: detailRes.dateCancelledUTC,
                  dateCanceled: detailRes.dateCanceled,
                  date_canceled: detailRes.date_canceled,
                  cancellation_date: detailRes.cancellation_date,
                  dateModified: detailRes.dateModified,
                  dateModifiedUTC: detailRes.dateModifiedUTC,
                });
              }

              const bookingDate = detailRes.dateCreated
                ? new Date(detailRes.dateCreated)
                : new Date();

              await client.query(
                `INSERT INTO reservations_export_staging (
      id,
      "hotelId",
      third_party_identifier,
      "reservationDateCreated",
      "checkInDate",
      "checkOutDate",
      "cancellationDate",
      status,
      "totalRate",
      currency_code,
      adults,
      children,
      rate_plan_id,
      "roomTypeId",
      "sourceName",
      "guestCountry",
      "detailedRoomRates",
      last_updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      status               = EXCLUDED.status,
      "totalRate"          = EXCLUDED."totalRate",
      currency_code        = EXCLUDED.currency_code,
      adults               = EXCLUDED.adults,
      children             = EXCLUDED.children,
      "checkInDate"        = EXCLUDED."checkInDate",
      "checkOutDate"       = EXCLUDED."checkOutDate",
      "cancellationDate"   = EXCLUDED."cancellationDate",
      "detailedRoomRates"  = EXCLUDED."detailedRoomRates",
      "roomTypeId"         = EXCLUDED."roomTypeId",
      rate_plan_id         = EXCLUDED.rate_plan_id,
      "sourceName"         = EXCLUDED."sourceName",
      "guestCountry"       = EXCLUDED."guestCountry",
      last_updated_at      = NOW()`,
                [
                  detailRes.reservationID, // id
                  String(currentHotelId), // hotelId
                  detailRes.thirdPartyIdentifier || null, // third_party_identifier
                  bookingDate, // reservationDateCreated
                  detailRes.startDate, // checkInDate
                  detailRes.endDate, // checkOutDate
                  cancelDate, // cancellationDate
                  detailRes.status, // status
                  revenue, // totalRate
                  "USD", // currency_code
                  finalAdults, // adults
                  childrenCount, // children
                  ratePlanId, // rate_plan_id
                  roomTypeId, // roomTypeId
                  detailRes.sourceName || detailRes.source || "Direct", // sourceName
                  detailRes.guestCountry || null, // guestCountry
                  dailyRatesJson, // detailedRoomRates
                ],
              );

              totalInserted++;
              // [DATA PROCESSING ENDS]
            } catch (err) {
              // ERROR HANDLER FOR RESERVATION
              const isTransient =
                err.message.includes("502") ||
                err.message.includes("503") ||
                err.message.includes("504") ||
                err.message.includes("429");

              if (isTransient) {
                console.warn(
                  `[Export] Transient Error (Limit/Hiccup) on Res ${summary.reservationID}. Retrying (${attempts}/3)...`,
                );
                await sleep(5000);
              } else {
                console.error(
                  `[Export] Failed Res ${summary.reservationID}: ${err.message}`,
                );
                break; // Don't retry logic errors
              }
            }
          }
        }
      } catch (hotelErr) {
        console.error(
          `[Export] CRITICAL ERROR processing Hotel ${currentHotelId}:`,
          hotelErr.message,
        );
        // Continue to next hotel
      }
    }

    res.status(200).json({
      success: true,
      message: `Batch Export Complete. Processed/Updated ${totalInserted} reservations across ${hotelsToProcess.length} hotels.`,
    });
  } catch (err) {
    console.error("[Export] Fatal Error:", err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

/**
 * [NEW] POST /api/sentinel/preview-rate
 * Generates a 365-day preview using the Canonical Pricing Engine.
 * Used by Rate Manager Grid to show "AI Suggested" vs "Live" vs "Guardrails".
 */
router.post("/preview-rate", async (req, res) => {
  try {
    const { hotelId, baseRoomTypeId, startDate, days } = req.body;

    if (!hotelId || !baseRoomTypeId || !startDate) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const numDays = parseInt(days) || 30;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + numDays);
    const endDateStr = end.toISOString().split("T")[0];

    const calendar = await sentinelService.previewCalendar({
      hotelId,
      baseRoomTypeId,
      startDate,
      endDate: endDateStr,
    });

    res.status(200).json({ success: true, data: calendar });
  } catch (error) {
    console.error("[Sentinel Router] preview-rate failed:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
/**
 * [NEW] GET /api/sentinel/pms-property-ids
 * Fetches a simple map of all Rockenue-managed hotels and their
 * external PMS Property IDs. This is used to "enrich" the
 * incomplete `allHotels` prop from App.tsx.
 */
router.get("/pms-property-ids", async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT hotel_id, pms_property_id 
       FROM hotels 
       WHERE is_rockenue_managed = true`,
    );

    // Convert the array [ {hotel_id: 1, pms_id: 100} ]
    // into an object { "1": "100" } for fast frontend lookup.
    const idMap = rows.reduce((acc, row) => {
      acc[row.hotel_id] = row.pms_property_id;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "PMS ID map fetched successfully.",
      data: idMap,
    });
  } catch (error) {
    console.error(`[Sentinel Router] get-pms-ids failed:`, error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PMS property ID map.",
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/configs
 * Fetches ALL Sentinel configurations for all hotels.
 * Used by the main control panel to build its initial list.
 */
router.get("/configs", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM sentinel_configurations");

    res.status(200).json({
      success: true,
      message: "All configurations fetched successfully.",
      data: rows, // Return the array of configs
    });
  } catch (error) {
    console.error(`[Sentinel Router] get-all-configs failed:`, error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all configurations.",
      error: error.message,
    });
  }
});

/**
 * POST /api/sentinel/test-post-rate
 * A test endpoint for the Sentinel AI Control Panel to verify
 * the certification (postRate) function.
 */

/**
 * GET /api/sentinel/get-rate-plans/:propertyId
 * Fetches the list of rate plans for a property so the user can
 * find the 'rateId' needed for testing.
 */
router.get("/get-rate-plans/:propertyId", async (req, res) => {
  const { propertyId } = req.params; // This is the External PMS ID

  try {
    console.log(`[Sentinel Router] Received get-rate-plans for ${propertyId}`);

    // [BRIDGE UPDATE] Lookup Internal ID
    const hotelRes = await db.query(
      "SELECT hotel_id FROM hotels WHERE pms_property_id = $1",
      [propertyId],
    );
    if (hotelRes.rows.length === 0)
      throw new Error("Hotel not found in database.");
    const hotelId = hotelRes.rows[0].hotel_id;

    // Pass BOTH IDs
    const result = await sentinelAdapter.getRatePlans(hotelId, propertyId);

    res.status(200).json({
      success: true,
      message: "Rate plans fetched successfully.",
      data: result,
    });
  } catch (error) {
    console.error("[Sentinel Router] get-rate-plans failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch rate plans.",
      error: error.message,
    });
  }
});

router.post("/test-post-rate", async (req, res) => {
  try {
    const { propertyId, rateId, date, rate } = req.body; // propertyId is External

    if (!propertyId || !rateId || !date || !rate) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    // [BRIDGE UPDATE] Lookup Internal ID
    const hotelRes = await db.query(
      "SELECT hotel_id FROM hotels WHERE pms_property_id = $1",
      [propertyId],
    );
    if (hotelRes.rows.length === 0)
      throw new Error("Hotel not found in database.");
    const hotelId = hotelRes.rows[0].hotel_id;

    // Pass BOTH IDs
    const result = await sentinelAdapter.postRate(
      hotelId,
      propertyId,
      rateId,
      date,
      rate,
    );

    res.status(200).json({
      success: true,
      message: "Sentinel postRate test queued successfully.",
      data: result, // This will be the { jobReferenceID: "..." } object
    });
  } catch (error) {
    console.error("[Sentinel Router] test-post-rate failed:", error.message);
    // [New code block to replace with]

    res.status(500).json({
      success: false,
      message: "Sentinel postRate test failed.",
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/job-status/:propertyId/:jobId
 * Fetches the status of an asynchronous job (e.g., postRate)
 * using the jobReferenceID.
 */
router.get("/job-status/:propertyId/:jobId", async (req, res) => {
  const { propertyId, jobId } = req.params;

  try {
    // [BRIDGE UPDATE] Lookup Internal ID
    const hotelRes = await db.query(
      "SELECT hotel_id FROM hotels WHERE pms_property_id = $1",
      [propertyId],
    );
    if (hotelRes.rows.length === 0)
      throw new Error("Hotel not found in database.");
    const hotelId = hotelRes.rows[0].hotel_id;

    // Pass BOTH IDs
    const result = await sentinelAdapter.getJobStatus(
      hotelId,
      propertyId,
      jobId,
    );

    res.status(200).json({
      success: true,
      message: "Job status fetched successfully.",
      data: result,
    });
  } catch (error) {
    console.error(
      `[Sentinel Router] get-job-status failed for ${jobId}:`,
      error.message,
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch job status.",
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/config/:hotelId
 * Fetches the complete Sentinel configuration for a single hotel
 * from our local database.
 */
router.get("/config/:hotelId", async (req, res) => {
  const { hotelId } = req.params;

  try {
    const { rows } = await db.query(
      "SELECT * FROM sentinel_configurations WHERE hotel_id = $1",
      [hotelId],
    );

    if (rows.length === 0) {
      // This is not an error, it just means no config exists yet.
      // The frontend will use this null to show the "Enable" button.
      return res.status(200).json({
        success: true,
        message: "No configuration found for this hotel.",
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: "Configuration fetched successfully.",
      data: rows[0], // Return the full config object
    });
  } catch (error) {
    console.error(
      `[Sentinel Router] get-config failed for ${hotelId}:`,
      error.message,
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch configuration.",
      error: error.message,
    });
  }
});

/**
 * [NEW] POST /api/sentinel/sync/:hotelId
 * Performs a "Facts Sync" from the PMS.
 * This fetches room types & rate plans and saves them to our DB.
 * It is called by the "Enable" toggle and the "Sync with PMS" button.
 * This is non-destructive and will not overwrite user "Rules".
 */
router.post("/sync", async (req, res) => {
  const { hotelId, pmsPropertyId } = req.body;
  try {
    console.log(
      `[Sentinel Router] Starting Full Sync for hotelId: ${hotelId} (PMS ID: ${pmsPropertyId})`,
    );

    // 1. Fetch Metadata ("Facts") from PMS
    const [roomTypesData, ratePlansData] = await Promise.all([
      sentinelAdapter.getRoomTypes(hotelId, pmsPropertyId),
      sentinelAdapter.getRatePlans(hotelId, pmsPropertyId),
    ]);

    const pmsRoomTypes = roomTypesData.data || [];
    const pmsRatePlans = ratePlansData.data || [];

    // 2. Build Rate Map (Use Service Logic)
    // 2. Build Rate Map (Use Service Logic)
    const rateIdMap = sentinelService.buildRateIdMap(
      pmsRoomTypes,
      pmsRatePlans,
    );

    // 3. Save Configuration to DB
    const { rows } = await db.query(
      `
      INSERT INTO sentinel_configurations (
        hotel_id, 
        pms_room_types, 
        pms_rate_plans, 
        rate_id_map,
        sentinel_enabled, 
        last_pms_sync_at,
        config_drift
      )
      VALUES ($1, $2, $3, $4, true, NOW(), false)
      ON CONFLICT (hotel_id) DO UPDATE 
      SET
        pms_room_types = EXCLUDED.pms_room_types,
        pms_rate_plans = EXCLUDED.pms_rate_plans,
        rate_id_map = EXCLUDED.rate_id_map,
        last_pms_sync_at = NOW(),
        config_drift = false,
        updated_at = NOW()
      RETURNING *;
      `,
      [hotelId, roomTypesData, ratePlansData, JSON.stringify(rateIdMap)],
    );

    const config = rows[0];

    // 4. [NEW] Hydrate Rate Calendar (Download 365 Days of Rates)
    // We need a Base Room to fetch rates. Use existing config OR default to first room.
    const baseRoomId =
      config.base_room_type_id ||
      (pmsRoomTypes.length > 0 ? pmsRoomTypes[0].roomTypeID : null);

    if (baseRoomId) {
      console.log(
        `[Sentinel Router] Hydrating Calendar for Base Room: ${baseRoomId}`,
      );
      const startDate = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      try {
        const liveRatesRes = await sentinelAdapter.getRates(
          hotelId,
          pmsPropertyId,
          baseRoomId,
          startDate,
          endDate,
        );

        let ratesList = [];
        if (
          liveRatesRes &&
          liveRatesRes.data &&
          Array.isArray(liveRatesRes.data.roomRateDetailed)
        ) {
          ratesList = liveRatesRes.data.roomRateDetailed;
        } else if (
          liveRatesRes &&
          Array.isArray(liveRatesRes.roomRateDetailed)
        ) {
          ratesList = liveRatesRes.roomRateDetailed;
        }

        if (ratesList.length > 0) {
          // Construct Batch Insert
          const rateValues = [];
          const rateParams = [];
          let pIdx = 1;

          for (const row of ratesList) {
            if (row.date && row.rate) {
              rateValues.push(
                `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${
                  pIdx + 3
                }, 'SYNC', NOW())`,
              );
              rateParams.push(hotelId, baseRoomId, row.date, row.rate);
              pIdx += 4;
            }
          }

          if (rateValues.length > 0) {
            const queryText = `
               INSERT INTO sentinel_rates_calendar (hotel_id, room_type_id, stay_date, rate, source, last_updated_at)
               VALUES ${rateValues.join(", ")}
               ON CONFLICT (hotel_id, room_type_id, stay_date) 
               DO UPDATE SET 
                 source = CASE 
                   WHEN sentinel_rates_calendar.rate = EXCLUDED.rate THEN sentinel_rates_calendar.source 
                   ELSE 'SYNC' 
                 END,
                 rate = EXCLUDED.rate, 
                 last_updated_at = NOW()
            `;
            await db.query(queryText, rateParams);
            console.log(
              `[Sentinel Router] Successfully hydrated ${rateValues.length} days.`,
            );
          }
        }
      } catch (hydrationError) {
        console.error(
          `[Sentinel Router] Hydration Warning (Sync continued):`,
          hydrationError.message,
        );
      }
    } else {
      console.warn("[Sentinel Router] No Base Room found; skipping hydration.");
    }

    res.status(200).json({
      success: true,
      message: "PMS Sync & Calendar Hydration complete.",
      data: config,
    });
  } catch (error) {
    console.error(
      `[Sentinel Router] Sync failed for ${hotelId}:`,
      error.message,
    );
    res.status(500).json({
      success: false,
      message: "Failed to sync with PMS.",
      error: error.message,
    });
  }
});

/**
 * [MODIFIED] POST /api/sentinel/config/:hotelId
 * Saves the user's "Rules" and also (re)builds the
 * `rate_id_map` (e.g., {"roomTypeId_A": "rateId_1", "roomTypeId_B": "rateId_2"})
 */
router.post("/config/:hotelId", async (req, res) => {
  const { hotelId } = req.params;

  try {
    // [REFACTOR] Delegate logic to Service
    const updatedConfig = await sentinelService.updateConfig(hotelId, req.body);

    res.status(200).json({
      success: true,
      message: "Configuration saved successfully.",
      data: updatedConfig,
    });
  } catch (error) {
    console.error(
      `[Sentinel Router] save-config failed for ${hotelId}:`,
      error.message,
    );
    res.status(500).json({
      success: false,
      message: "Failed to save configuration.",
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/max-rates/:hotelId
 * Fetches the daily max rates from the SQL table.
 */
router.get("/max-rates/:hotelId", async (req, res) => {
  const { hotelId } = req.params;
  try {
    const data = await sentinelService.getDailyMaxRates(hotelId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(`[Sentinel Router] get-max-rates failed:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * [NEW] GET /api/sentinel/pace-curves/:hotelId
 * Fetches the pace curves (season_tier + curve_data).
 */
// REPLACE
router.get("/pace-curves/:hotelId", async (req, res) => {
  const { hotelId } = req.params;
  try {
    const data = await sentinelService.getPaceCurves(hotelId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(`[Sentinel Router] get-pace-curves failed:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * [NEW] POST /api/sentinel/pace-curves/copy
 * Copies curves from one hotel to another.
 */
router.post("/pace-curves/copy", async (req, res) => {
  const { sourceHotelId, targetHotelId } = req.body;
  if (!sourceHotelId || !targetHotelId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing source or target hotel ID." });
  }

  try {
    await sentinelService.copyPaceCurves(sourceHotelId, targetHotelId);
    res
      .status(200)
      .json({ success: true, message: "Curves copied successfully." });
  } catch (error) {
    console.error(`[Sentinel Router] copy-pace-curves failed:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
/**
 * [NEW] POST /api/sentinel/max-rates/:hotelId
 * Saves manual overrides for max rates.
 */
router.post("/max-rates/:hotelId", async (req, res) => {
  const { hotelId } = req.params;
  const { rates } = req.body; // { "2026-01-01": "200" }
  try {
    await sentinelService.saveDailyMaxRates(hotelId, rates);
    res.status(200).json({ success: true, message: "Max rates saved." });
  } catch (error) {
    console.error(`[Sentinel Router] save-max-rates failed:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
/**
 * [SHARED WORKER FUNCTION - SERVERLESS OPTIMIZED]
 * loops for up to 50 seconds processing small batches.
 * Commits progress frequently so timeouts don't rollback work.
 */
async function runBackgroundWorker() {
  const MAX_RUNTIME_MS = 50000; // Run for max 50 seconds per trigger
  const startTime = Date.now();
  let batchesProcessed = 0;

  console.log("[Sentinel Worker] Starting Smart Drain Cycle...");

  const client = await db.connect();

  try {
    // LOOP: Keep fetching batches until time runs out or queue is empty
    while (Date.now() - startTime < MAX_RUNTIME_MS) {
      // A. Start Transaction for this BATCH
      await client.query("BEGIN");

      // B. Fetch 5 Jobs
      const { rows: jobs } = await client.query(
        `SELECT id, hotel_id, payload FROM sentinel_job_queue 
         WHERE status = 'PENDING' 
         ORDER BY created_at ASC 
         LIMIT 5 
         FOR UPDATE SKIP LOCKED`,
      );

      // C. Stop if empty
      if (jobs.length === 0) {
        await client.query("COMMIT");
        console.log("[Sentinel Worker] Queue Empty. Stopping.");
        break;
      }

      console.log(
        `[Sentinel Worker] Batch ${batchesProcessed + 1}: Processing ${
          jobs.length
        } jobs...`,
      );

      // D. Process Each Job
      for (const job of jobs) {
        const savepointName = `sp_${job.id.replace(/-/g, "_")}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          const { pmsPropertyId, rates } = job.payload;

          // Adapter Call
          const result = await sentinelAdapter.postRateBatch(
            job.hotel_id,
            pmsPropertyId,
            rates,
          );

          // Success Update
          if (
            result &&
            result.message === "All rates filtered out by safety checks."
          ) {
            await client.query(
              `UPDATE sentinel_job_queue SET status = 'SKIPPED', updated_at = NOW() WHERE id = $1`,
              [job.id],
            );
          } else {
            await client.query(
              `UPDATE sentinel_job_queue SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
              [job.id],
            );
          }
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        } catch (err) {
          // Failure Update
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          console.error(`[Sentinel Worker] Job ${job.id} Failed:`, err.message);
          const safeError = (err.message || "Unknown error").substring(0, 500);

          await client.query(
            `UPDATE sentinel_job_queue SET status = 'FAILED', last_error = $2, updated_at = NOW() WHERE id = $1`,
            [job.id, safeError],
          );
        }
      }

      // E. Commit this batch (Saves progress immediately)
      await client.query("COMMIT");
      batchesProcessed++;

      // Small breather to let Event Loop breathe
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `[Sentinel Worker] Cycle finished. Batches: ${batchesProcessed}. Time: ${
        Date.now() - startTime
      }ms`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Sentinel Worker] Critical Error:", error);
  } finally {
    client.release();
  }
}

/**
 * [PRODUCER] POST /api/sentinel/overrides
 * 1. Uses Sentinel Service to build payload (DB + engine).
 * 2. Saves rates to Queue.
 * 3. "Kicks" the worker internally (Reliable).
 * 4. Returns OK instantly.
 */
router.post("/overrides", async (req, res) => {
  // [UPDATED] Now accepts optional 'source' (e.g., "AI_APPROVED")
  const { hotelId, pmsPropertyId, roomTypeId, overrides, source } = req.body;

  // Default to 'MANUAL' if not provided
  const changeSource = source || "MANUAL";

  console.log(
    `[Sentinel Producer] Received overrides for hotel ${hotelId} (Source: ${changeSource})`,
  );

  if (
    !hotelId ||
    !pmsPropertyId ||
    !roomTypeId ||
    !overrides ||
    !Array.isArray(overrides)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields." });
  }

  try {
    // 1. Delegate all DB + pricing logic to Sentinel Service
    // [UPDATED] Pass 'changeSource' to service
    const batchPayload = await sentinelService.buildOverridePayload(
      hotelId,
      pmsPropertyId,
      roomTypeId,
      overrides,
      changeSource,
    );

    // 2. Insert into Job Queue (Chunked)
    // Cloudbeds has a strict limit of 30 items per API call.
    // We split the payload into chunks to ensure success.
    if (batchPayload && batchPayload.length > 0) {
      const CHUNK_SIZE = 30;

      for (let i = 0; i < batchPayload.length; i += CHUNK_SIZE) {
        const chunk = batchPayload.slice(i, i + CHUNK_SIZE);

        await db.query(
          `INSERT INTO sentinel_job_queue (hotel_id, payload, status) VALUES ($1, $2, 'PENDING')`,
          [hotelId, JSON.stringify({ pmsPropertyId, rates: chunk })],
        );
      }

      const jobCount = Math.ceil(batchPayload.length / CHUNK_SIZE);
      console.log(
        `[Sentinel Producer] Queued ${batchPayload.length} rates across ${jobCount} jobs.`,
      );
    }

    // 3. [VERCEL OPTIMIZATION] Return Instantly
    // The Cron job will pick up the PENDING jobs within 60 seconds.
    res.status(200).json({
      success: true,
      message: "Updates queued for background processing.",
    });
  } catch (error) {
    console.error(`[Sentinel Producer] Failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// [REMOVED] process-queue moved to top of file (Public Cron)

/**
 * [NEW & SIMPLIFIED] GET /api/sentinel/rates/:hotelId/:roomTypeId
 * Fetches the 365-day rate calendar for a single room *only* from our
 * local sentinel_rates_calendar table.
 */
/**
 * [UPDATED] GET /api/sentinel/rates/:hotelId/:roomTypeId
 * Fetches 365-day calendar from DB + Live Cloudbeds Sync
 */
router.get("/rates/:hotelId/:roomTypeId", async (req, res) => {
  const { hotelId, roomTypeId } = req.params;
  console.log(
    `[Sentinel Router] Received get-rates for ${hotelId}/${roomTypeId}`,
  );

  try {
    // 1. Define date range (Today to Today + 365 days)
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 365);

    const startDateStr = today.toISOString().split("T")[0];
    const endDateStr = future.toISOString().split("T")[0];

    // 2. Get PMS Property ID for the external call
    const hotelRes = await db.query(
      "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
      [hotelId],
    );
    if (hotelRes.rows.length === 0) throw new Error("Hotel not found");
    const pmsPropertyId = hotelRes.rows[0].pms_property_id;

    // 3. Run Queries in Parallel (DB + Live Cloudbeds)
    const [dbRes, pmsRes] = await Promise.all([
      db.query(
        `SELECT stay_date, rate, source 
         FROM sentinel_rates_calendar 
         WHERE hotel_id = $1 
           AND room_type_id = $2 
           AND stay_date >= $3
         ORDER BY stay_date ASC`,
        [hotelId, roomTypeId, startDateStr],
      ),
      // [BRIDGE UPDATE] Pass BOTH IDs
      sentinelAdapter.getRates(
        hotelId,
        pmsPropertyId,
        roomTypeId,
        startDateStr,
        endDateStr,
      ),
    ]);

    // 4. Create a Lookup Map for Live Rates
    // [FIXED] Target the 'roomRateDetailed' array found in the X-Ray logs
    let liveRatesList = [];

    if (pmsRes && pmsRes.data && Array.isArray(pmsRes.data.roomRateDetailed)) {
      liveRatesList = pmsRes.data.roomRateDetailed;
    } else {
      console.warn(
        "[Sentinel Router] Warning: roomRateDetailed array not found in PMS response.",
      );
    }

    const liveRateMap = {};
    liveRatesList.forEach((item) => {
      // The logs confirm keys are 'date' and 'rate'
      if (item.date && item.rate) {
        liveRateMap[item.date] = parseFloat(item.rate);
      }
    });
    // 5. [FIXED] Merge Data (Union of DB & Live)
    // We must combine dates from DB AND Cloudbeds to catch rates
    // that exist in Cloudbeds but haven't been touched in Sentinel yet.

    // A. Create a Map for easy DB lookup
    const dbMap = {};
    dbRes.rows.forEach((row) => {
      const dateStr = new Date(row.stay_date).toISOString().split("T")[0];
      dbMap[dateStr] = row;
    });

    // B. Create a Set of ALL unique dates (DB keys + Live keys)
    const allDates = new Set([
      ...Object.keys(dbMap),
      ...Object.keys(liveRateMap),
    ]);

    // C. Build the final array
    const savedRates = [];
    allDates.forEach((dateStr) => {
      const dbRow = dbMap[dateStr];

      savedRates.push({
        date: dateStr,
        // If in DB, use DB rate. If not, 0 (Sentinel treats 0 as 'empty/default')
        rate: dbRow ? parseFloat(dbRow.rate) : 0,
        // If in DB, use DB source. If not, default to 'AI' (or 'External' logic in frontend)
        source: dbRow ? dbRow.source : "AI",
        // Always inject the live rate if we found one
        liveRate: liveRateMap[dateStr] || 0,
      });
    });

    // 6. Send Response
    res.status(200).json({
      success: true,
      message: "Rate calendar fetched (DB + Live Sync).",
      data: savedRates,
    });
  } catch (error) {
    // ... (Error handling remains the same)
    console.error(
      `[Sentinel Router] get-rates failed for ${hotelId}:`,
      error.message,
    );
    res.status(500).json({
      success: false,
      message: "Failed to fetch rate calendar.",
      error: error.message,
    });
  }
});

// ... existing imports and code ...

/**
 * [FIXED] GET /api/sentinel/notifications
 * Fetches the 20 most recent notifications.
 */
router.get("/notifications", async (req, res) => {
  try {
    // [FIX] robust query with safety limit
    const { rows } = await db.query(
      `SELECT * FROM sentinel_notifications 
       ORDER BY created_at DESC 
       LIMIT 20`,
    );

    // [FIX] Return standard format strictly
    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error(
      "[Sentinel Router] Fetch notifications failed:",
      error.message,
    );
    // Return empty list on error so UI doesn't break
    res.status(200).json({ success: false, data: [], error: error.message });
  }
});

/**
 * [FIXED] POST /api/sentinel/notifications/mark-read
 * Marks all notifications as read.
 */
router.post("/notifications/mark-read", async (req, res) => {
  try {
    const { ids } = req.body;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Mark specific IDs
      await db.query(
        `UPDATE sentinel_notifications SET is_read = TRUE WHERE id = ANY($1::uuid[])`,
        [ids],
      );
    } else {
      // Mark ALL
      await db.query(
        `UPDATE sentinel_notifications SET is_read = TRUE WHERE is_read = FALSE`,
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[Sentinel Router] Mark read failed:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * [NEW] DELETE /api/sentinel/notifications/:id
 * Permanently deletes a notification.
 */
// REPLACE with:
router.delete("/notifications/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM sentinel_notifications WHERE id = $1", [id]);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(
      "[Sentinel Router] Delete notification failed:",
      error.message,
    );
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * [NEW] GET /api/sentinel/predictions/:hotelId
 * Fetches "Shadow Mode" AI predictions (not yet applied) for the grid.
 */
router.get("/predictions/:hotelId", async (req, res) => {
  const { hotelId } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT room_type_id, stay_date, suggested_rate, confidence_score 
       FROM sentinel_ai_predictions 
       WHERE hotel_id = $1 AND is_applied = FALSE
       ORDER BY stay_date ASC`,
      [hotelId],
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("[Sentinel Router] Fetch predictions failed:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * [NEW] GET /api/sentinel/status/:hotelId
 * Fetches the last run timestamp and activity stats.
 */
router.get("/status/:hotelId", async (req, res) => {
  const { hotelId } = req.params;
  try {
    const data = await sentinelService.getSentinelStatus(hotelId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(`[Sentinel Router] get-status failed:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * [NEW] GET /api/sentinel/recent-jobs/:hotelId
 * Fetches the last 3 batched job pushes.
 */
router.get("/recent-jobs/:hotelId", async (req, res) => {
  const { hotelId } = req.params;
  try {
    const data = await sentinelService.getRecentJobBatches(hotelId);
    res.status(200).json(data);
  } catch (error) {
    console.error(`[Sentinel Router] get-recent-jobs failed:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
