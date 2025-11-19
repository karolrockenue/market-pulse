/**
 * @file sentinel.router.js
 * @brief API router for the Sentinel AI Control Panel.
 * This router is "firewalled" and only interacts with sentinel.adapter.js.
 * All routes are protected by super_admin-only middleware.
 */
const express = require('express');
const router = express.Router();
const { requireAdminApi } = require('../utils/middleware'); // [MODIFIED] Allow Admin access
const sentinelAdapter = require('../adapters/sentinel.adapter.js');
const db = require('../utils/db'); // <-- [NEW] Import database connection

// Apply super_admin protection to all routes in this file
// Apply super_admin protection to all routes in this file
// Apply permissive Admin protection (Staff + Founders)
router.use(requireAdminApi);


/**
 * [NEW] GET /api/sentinel/pms-property-ids
 * Fetches a simple map of all Rockenue-managed hotels and their
 * external PMS Property IDs. This is used to "enrich" the
 * incomplete `allHotels` prop from App.tsx.
 */
router.get('/pms-property-ids', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT hotel_id, pms_property_id 
       FROM hotels 
       WHERE is_rockenue_managed = true`
    );

    // Convert the array [ {hotel_id: 1, pms_id: 100} ]
    // into an object { "1": "100" } for fast frontend lookup.
    const idMap = rows.reduce((acc, row) => {
      acc[row.hotel_id] = row.pms_property_id;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      message: 'PMS ID map fetched successfully.',
      data: idMap,
    });
  } catch (error) {
    console.error(`[Sentinel Router] get-pms-ids failed:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PMS property ID map.',
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/configs
 * Fetches ALL Sentinel configurations for all hotels.
 * Used by the main control panel to build its initial list.
 */
router.get('/configs', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM sentinel_configurations');
    
    res.status(200).json({
      success: true,
      message: 'All configurations fetched successfully.',
      data: rows, // Return the array of configs
    });
  } catch (error) {
    console.error(`[Sentinel Router] get-all-configs failed:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch all configurations.',
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
router.get('/get-rate-plans/:propertyId', async (req, res) => {
  const { propertyId } = req.params;

  try {
    console.log(`[Sentinel Router] Received get-rate-plans for ${propertyId}`);

    // Call the isolated, firewalled adapter function
    const result = await sentinelAdapter.getRatePlans(propertyId);

    res.status(200).json({
      success: true,
      message: 'Rate plans fetched successfully.',
      data: result,
    });
  } catch (error) {
    console.error('[Sentinel Router] get-rate-plans failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate plans.',
      error: error.message,
    });
  }
});

router.post('/test-post-rate', async (req, res) => {
  try {
    // The UI will now send 'rateId' instead of 'roomTypeId'
    const { propertyId, rateId, date, rate } = req.body;

    if (!propertyId || !rateId || !date || !rate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: propertyId, rateId, date, rate.',
      });
    }

    // Log the incoming request
    console.log(`[Sentinel Router] Received test-post-rate for rateID ${rateId}`);

    // Call the isolated, firewalled adapter function
    const result = await sentinelAdapter.postRate(
      propertyId,
      rateId,
      date,
      rate
    );

    res.status(200).json({
      success: true,
      message: 'Sentinel postRate test queued successfully.',
      data: result, // This will be the { jobReferenceID: "..." } object
    });
  } catch (error) {
    console.error('[Sentinel Router] test-post-rate failed:', error.message);
    // [New code block to replace with]

    res.status(500).json({
      success: false,
      message: 'Sentinel postRate test failed.',
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/job-status/:propertyId/:jobId
 * Fetches the status of an asynchronous job (e.g., postRate)
 * using the jobReferenceID.
 */
router.get('/job-status/:propertyId/:jobId', async (req, res) => {
  const { propertyId, jobId } = req.params;

  try {
    console.log(`[Sentinel Router] Received get-job-status for ${jobId} on property ${propertyId}`);

    // Call the isolated, firewalled adapter function
    const result = await sentinelAdapter.getJobStatus(propertyId, jobId);

    res.status(200).json({
      success: true,
      message: 'Job status fetched successfully.',
      data: result,
    });
  } catch (error) {
    console.error(`[Sentinel Router] get-job-status failed for ${jobId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job status.',
      error: error.message,
    });
  }
});

/**
 * [NEW] GET /api/sentinel/config/:hotelId
 * Fetches the complete Sentinel configuration for a single hotel
 * from our local database.
 */
router.get('/config/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  
  try {
    const { rows } = await db.query(
      'SELECT * FROM sentinel_configurations WHERE hotel_id = $1',
      [hotelId]
    );

    if (rows.length === 0) {
      // This is not an error, it just means no config exists yet.
      // The frontend will use this null to show the "Enable" button.
      return res.status(200).json({
        success: true,
        message: 'No configuration found for this hotel.',
        data: null,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Configuration fetched successfully.',
      data: rows[0], // Return the full config object
    });
  } catch (error) {
    console.error(`[Sentinel Router] get-config failed for ${hotelId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration.',
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
// [MODIFIED] Route now takes IDs from the body, no params
router.post('/sync', async (req, res) => {
  const { hotelId, pmsPropertyId } = req.body; // <-- [NEW] Get both IDs
try {
    // [MODIFIED] Log both IDs
    console.log(`[Sentinel Router] Starting Facts Sync for hotelId: ${hotelId} (PMS ID: ${pmsPropertyId})`);
    
    // 1. Fetch all "Facts" from PMS in parallel
    const [roomTypesData, ratePlansData] = await Promise.all([
      // [MODIFIED] Pass the correct PMS ID to the adapter
      sentinelAdapter.getRoomTypes(pmsPropertyId),
      sentinelAdapter.getRatePlans(pmsPropertyId),
    ]);

    // 2. Save "Facts" to our database
    // We use INSERT...ON CONFLICT to create or update the row.
    // This is the core of the "Sync" logic:
    // - It creates the row if it doesn't exist (and enables Sentinel).
    // - It UPDATES the "Facts" if it does exist.
    // - It critically DOES NOT touch the "Rules" (guardrail_min, etc.).
    const { rows } = await db.query(
      `
      INSERT INTO sentinel_configurations (
        hotel_id, 
        pms_room_types, 
        pms_rate_plans, 
        sentinel_enabled, 
        last_pms_sync_at,
        config_drift
      )
      VALUES ($1, $2, $3, true, NOW(), false)
      ON CONFLICT (hotel_id) DO UPDATE 
      SET
        pms_room_types = EXCLUDED.pms_room_types,
        pms_rate_plans = EXCLUDED.pms_rate_plans,
        last_pms_sync_at = NOW(),
        config_drift = false,
        updated_at = NOW()
      RETURNING *;
      `,
      [hotelId, roomTypesData, ratePlansData]
    );

    console.log(`[Sentinel Router] Facts Sync complete for ${hotelId}`);
    res.status(200).json({
      success: true,
      message: 'PMS Facts sync complete.',
      data: rows[0],
    });
  } catch (error) {
    console.error(`[Sentinel Router] facts-sync failed for ${hotelId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to sync with PMS.',
      error: error.message,
    });
  }
});



/**
 * [MODIFIED] POST /api/sentinel/config/:hotelId
 * Saves the user's "Rules" and also (re)builds the
 * `rate_id_map` (e.g., {"roomTypeId_A": "rateId_1", "roomTypeId_B": "rateId_2"})
 */
router.post('/config/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  const {
    sentinel_enabled,
    // guardrail_min, <-- REMOVED
    guardrail_max,
    rate_freeze_period,
    base_room_type_id,
    room_differentials,
    last_minute_floor,
    monthly_aggression,
    monthly_min_rates
  } = req.body;

try {
    // 1. Fetch the "Facts"
    const factsRes = await db.query(
      `SELECT pms_room_types, pms_rate_plans FROM sentinel_configurations WHERE hotel_id = $1`,
      [hotelId]
    );

    // --- [START DEBUGGING LOG] ---
    console.log(`[DEBUG /config] Fetched facts for hotel ${hotelId}`);
    if (factsRes.rows.length === 0) {
      console.error(`[DEBUG /config] No config row found.`);
      return res.status(404).json({ success: false, message: 'Config row not found.' });
    }
    
    const pmsRoomTypesRaw = factsRes.rows[0].pms_room_types;
    const pmsRatePlansRaw = factsRes.rows[0].pms_rate_plans;

    console.log(`[DEBUG /config] pms_room_types (raw):`, JSON.stringify(pmsRoomTypesRaw, null, 2));
    console.log(`[DEBUG /config] pms_rate_plans (raw):`, JSON.stringify(pmsRatePlansRaw, null, 2));
    // --- [END DEBUGGING LOG] ---

    if (factsRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Config not found. Run "Sync with PMS" first.',
      });
    }

    const pmsRoomTypes = factsRes.rows[0].pms_room_types?.data || [];
    const pmsRatePlans = factsRes.rows[0].pms_rate_plans?.data || [];

    // 2. [NEW LOGIC] Build the full rate_id_map
    const rateIdMap = {};
    for (const room of pmsRoomTypes) {
      const roomTypeId = room.roomTypeID;
      let foundRateId = null;

      // Find the first non-derived rate for this room
      for (const rate of pmsRatePlans) {
        if (rate.roomTypeID == roomTypeId && rate.isDerived === false) {
          foundRateId = rate.rateID;
          break;
        }
      }

      if (foundRateId) {
        rateIdMap[roomTypeId] = foundRateId;
      } else {
        console.warn(`[Sentinel Router] No base rate (isDerived: false) found for roomTypeID ${roomTypeId}.`);
}
    }

    // --- [START DEBUGGING LOG] ---
    console.log(`[DEBUG /config] Finished building rateIdMap:`, JSON.stringify(rateIdMap, null, 2));
    // --- [END DEBUGGING LOG] ---

// 3. [MODIFIED] Update the database with all rules AND the new base_rate_id
    // [FIX] Manually stringify all JSONB-bound parameters to prevent pg driver errors
    const { rows } = await db.query(
      `
      UPDATE sentinel_configurations
      SET
        sentinel_enabled = $1,
        guardrail_max = $2,
        rate_freeze_period = $3,
        base_room_type_id = $4,
        room_differentials = $5,
        last_minute_floor = $6,
        monthly_aggression = $7,
        monthly_min_rates = $8,
        rate_id_map = $9,
        updated_at = NOW()
      WHERE hotel_id = $10
      RETURNING *;
      `,
      [
        sentinel_enabled,
        // guardrail_min, <-- REMOVED
        guardrail_max,
        rate_freeze_period,
        base_room_type_id,
        JSON.stringify(room_differentials || []),
        JSON.stringify(last_minute_floor || {}),
        JSON.stringify(monthly_aggression || {}),
        JSON.stringify(monthly_min_rates || {}),
        JSON.stringify(rateIdMap || {}),
        hotelId
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Configuration saved successfully. Rate ID Map rebuilt.',
      data: rows[0],
    });
  } catch (error) {
    console.error(`[Sentinel Router] save-config failed for ${hotelId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to save configuration.',
      error: error.message,
    });
  }
});

/**
 * [SHARED WORKER FUNCTION]
 * This runs the queue logic. We extract it so we can call it 
 * directly from the Producer without needing a network request.
 */
async function runBackgroundWorker() {
  console.log('[Sentinel Worker] Waking up...');
  
  // Use a fresh client for transaction handling
 const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Pending Jobs (FIFO)
    // SKIP LOCKED ensures multiple workers don't grab the same job
    const { rows: jobs } = await client.query(
      `SELECT id, payload FROM sentinel_job_queue 
       WHERE status = 'PENDING' 
       ORDER BY created_at ASC 
       LIMIT 5 
       FOR UPDATE SKIP LOCKED`
    );

    if (jobs.length === 0) {
      await client.query('COMMIT');
      // console.log('[Sentinel Worker] No pending jobs.'); 
      return;
    }

    console.log(`[Sentinel Worker] Processing ${jobs.length} jobs...`);

    // 2. Process Each Job
    for (const job of jobs) {
      const { pmsPropertyId, rates } = job.payload;

      try {
        // Call the Batch Adapter (Optimized API Call)
        await sentinelAdapter.postRateBatch(pmsPropertyId, rates);

        // Mark Complete
        await client.query(
          `UPDATE sentinel_job_queue SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
          [job.id]
        );

      } catch (err) {
        console.error(`[Sentinel Worker] Job ${job.id} Failed:`, err.message);
        
        // Mark Failed
        await client.query(
          `UPDATE sentinel_job_queue 
           SET status = 'FAILED', last_error = $2, updated_at = NOW() 
           WHERE id = $1`,
          [job.id, err.message]
        );

        // Create Notification for User
        await client.query(
          `INSERT INTO sentinel_notifications (type, title, message) VALUES ($1, $2, $3)`,
          ['ERROR', 'Rate Update Failed', `Failed to push ${rates.length} rates: ${err.message}`]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`[Sentinel Worker] Batch complete.`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Sentinel Worker] Critical Error:', error);
  } finally {
    client.release();
  }
}

/**
 * [PRODUCER] POST /api/sentinel/overrides
 * 1. Saves rates to Queue.
 * 2. "Kicks" the worker internally (Reliable).
 * 3. Returns OK instantly.
 */
router.post('/overrides', async (req, res) => {
  const { hotelId, pmsPropertyId, roomTypeId, overrides } = req.body;
  console.log(`[Sentinel Producer] Received overrides for hotel ${hotelId}`);

  if (!hotelId || !pmsPropertyId || !roomTypeId || !overrides || !Array.isArray(overrides)) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    // 1. Get Config
    const configRes = await db.query(
      `SELECT rate_id_map, room_differentials FROM sentinel_configurations WHERE hotel_id = $1`,
      [hotelId]
    );
    
    if (configRes.rows.length === 0) throw new Error('No configuration found.');
    const { rate_id_map: rateIdMap, room_differentials: roomDifferentials } = configRes.rows[0];

    // 2. Prepare Payload
    const batchPayload = [];

    for (const override of overrides) {
      const { date, rate } = override;
      const baseRate = parseFloat(rate);

      // A. Update Local DB (Rule Book)
      const jsonPatch = { [date]: baseRate };
      await db.query(
        `UPDATE sentinel_configurations SET rate_overrides = rate_overrides || $1 WHERE hotel_id = $2`,
        [JSON.stringify(jsonPatch), hotelId]
      );

      // B. Update Calendar (Live State)
      await db.query(
        `INSERT INTO sentinel_rates_calendar (hotel_id, stay_date, room_type_id, rate, source, last_updated_at)
         VALUES ($1, $2, $3, $4, 'Manual', NOW())
         ON CONFLICT (hotel_id, stay_date, room_type_id) DO UPDATE
         SET rate = EXCLUDED.rate, source = EXCLUDED.source, last_updated_at = NOW()`,
        [hotelId, date, roomTypeId, baseRate]
      );

      // C. Calculate Payload (Base)
      const baseRateId = rateIdMap[roomTypeId];
      if (baseRateId) {
        batchPayload.push({ rateId: baseRateId, date, rate: baseRate });
      }

      // D. Calculate Payload (Differentials)
      if (roomDifferentials && Array.isArray(roomDifferentials)) {
        for (const rule of roomDifferentials) {
          if (!rule || rule.value === undefined || rule.roomTypeId === roomTypeId) continue;
          
          const diffRoomId = rule.roomTypeId;
          const diffRateId = rateIdMap[diffRoomId];
          if (diffRateId) {
            const value = parseFloat(rule.value);
            let newRate = rule.operator === '+' 
              ? baseRate * (1 + (value / 100))
              : baseRate * (1 - (value / 100));
            batchPayload.push({ rateId: diffRateId, date, rate: parseFloat(newRate.toFixed(2)) });
          }
        }
      }
    }
// 3. Insert into Job Queue (Chunked)
    // Cloudbeds has a strict limit of 30 items per API call.
    // We split the payload into chunks to ensure success.
    if (batchPayload.length > 0) {
      const CHUNK_SIZE = 30; 
      
      for (let i = 0; i < batchPayload.length; i += CHUNK_SIZE) {
        const chunk = batchPayload.slice(i, i + CHUNK_SIZE);
        
        await db.query(
          `INSERT INTO sentinel_job_queue (hotel_id, payload, status) VALUES ($1, $2, 'PENDING')`,
          [hotelId, JSON.stringify({ pmsPropertyId, rates: chunk })]
        );
      }

      const jobCount = Math.ceil(batchPayload.length / CHUNK_SIZE);
      console.log(`[Sentinel Producer] Queued ${batchPayload.length} rates across ${jobCount} jobs.`);
    }

    // 4. THE KICK (Internal Function Call)
    // This replaces the failed 'fetch' logic. 
    // setImmediate ensures it runs on the next tick, keeping the API response fast.
    setImmediate(() => {
      runBackgroundWorker().catch(err => console.error('Worker Background Error:', err));
    });

    // 5. Return Instantly
    res.status(200).json({ success: true, message: 'Updates queued.' });

  } catch (error) {
    console.error(`[Sentinel Producer] Failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * [MANUAL TRIGGER] POST /api/sentinel/process-queue
 * Useful for debugging or CRON jobs.
 */
router.post('/process-queue', async (req, res) => {
  await runBackgroundWorker(); 
  res.status(200).json({ success: true, message: 'Worker cycle complete.' });
});

/**
 * [NEW & SIMPLIFIED] GET /api/sentinel/rates/:hotelId/:roomTypeId
 * Fetches the 365-day rate calendar for a single room *only* from our
 * local sentinel_rates_calendar table.
 */
/**
 * [UPDATED] GET /api/sentinel/rates/:hotelId/:roomTypeId
 * Fetches 365-day calendar from DB + Live Cloudbeds Sync
 */
router.get('/rates/:hotelId/:roomTypeId', async (req, res) => {
  const { hotelId, roomTypeId } = req.params;
  console.log(`[Sentinel Router] Received get-rates for ${hotelId}/${roomTypeId}`);

  try {
    // 1. Define date range (Today to Today + 365 days)
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 365);

    const startDateStr = today.toISOString().split('T')[0];
    const endDateStr = future.toISOString().split('T')[0];

    // 2. Get PMS Property ID for the external call
    const hotelRes = await db.query('SELECT pms_property_id FROM hotels WHERE hotel_id = $1', [hotelId]);
    if (hotelRes.rows.length === 0) throw new Error('Hotel not found');
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
        [hotelId, roomTypeId, startDateStr]
      ),
      sentinelAdapter.getRates(pmsPropertyId, roomTypeId, startDateStr, endDateStr)
    ]);

    // 4. Create a Lookup Map for Live Rates
    // [FIXED] Target the 'roomRateDetailed' array found in the X-Ray logs
    let liveRatesList = [];
    
    if (pmsRes && pmsRes.data && Array.isArray(pmsRes.data.roomRateDetailed)) {
      liveRatesList = pmsRes.data.roomRateDetailed;
    } else {
      console.warn('[Sentinel Router] Warning: roomRateDetailed array not found in PMS response.');
    }

    const liveRateMap = {};
    liveRatesList.forEach(item => {
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
    dbRes.rows.forEach(row => {
      const dateStr = new Date(row.stay_date).toISOString().split('T')[0];
      dbMap[dateStr] = row;
    });

    // B. Create a Set of ALL unique dates (DB keys + Live keys)
    const allDates = new Set([
      ...Object.keys(dbMap),
      ...Object.keys(liveRateMap)
    ]);

    // C. Build the final array
    const savedRates = [];
    allDates.forEach(dateStr => {
      const dbRow = dbMap[dateStr];
      
      savedRates.push({
        date: dateStr,
        // If in DB, use DB rate. If not, 0 (Sentinel treats 0 as 'empty/default')
        rate: dbRow ? parseFloat(dbRow.rate) : 0, 
        // If in DB, use DB source. If not, default to 'AI' (or 'External' logic in frontend)
        source: dbRow ? dbRow.source : 'AI',
        // Always inject the live rate if we found one
        liveRate: liveRateMap[dateStr] || 0, 
      });
    });
    
    // 6. Send Response
    res.status(200).json({
      success: true,
      message: 'Rate calendar fetched (DB + Live Sync).',
      data: savedRates,
    });

  } catch (error) {
    // ... (Error handling remains the same)
    console.error(`[Sentinel Router] get-rates failed for ${hotelId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate calendar.',
      error: error.message,
    });
  }
});

// ... existing imports and code ...

/**
 * [FIXED] GET /api/sentinel/notifications
 * Fetches the 20 most recent notifications.
 */
router.get('/notifications', async (req, res) => {
  try {
    // [FIX] robust query with safety limit
    const { rows } = await db.query(
      `SELECT * FROM sentinel_notifications 
       ORDER BY created_at DESC 
       LIMIT 20`
    );
    
    // [FIX] Return standard format strictly
    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('[Sentinel Router] Fetch notifications failed:', error.message);
    // Return empty list on error so UI doesn't break
    res.status(200).json({ success: false, data: [], error: error.message }); 
  }
});

/**
 * [FIXED] POST /api/sentinel/notifications/mark-read
 * Marks all notifications as read.
 */
router.post('/notifications/mark-read', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Mark specific IDs
      await db.query(
        `UPDATE sentinel_notifications SET is_read = TRUE WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    } else {
      // Mark ALL
      await db.query(`UPDATE sentinel_notifications SET is_read = TRUE WHERE is_read = FALSE`);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Sentinel Router] Mark read failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * [NEW] DELETE /api/sentinel/notifications/:id
 * Permanently deletes a notification.
 */
router.delete('/notifications/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM sentinel_notifications WHERE id = $1', [id]);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Sentinel Router] Delete notification failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;