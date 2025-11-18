/**
 * @file sentinel.router.js
 * @brief API router for the Sentinel AI Control Panel.
 * This router is "firewalled" and only interacts with sentinel.adapter.js.
 * All routes are protected by super_admin-only middleware.
 */
const express = require('express');
const router = express.Router();
const { requireSuperAdminOnly } = require('../utils/middleware');
const sentinelAdapter = require('../adapters/sentinel.adapter.js');
const db = require('../utils/db'); // <-- [NEW] Import database connection

// Apply super_admin protection to all routes in this file
// Apply super_admin protection to all routes in this file
router.use(requireSuperAdminOnly);


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
 * [UPGRADED] POST /api/sentinel/overrides
 * Handles "Submit Changes" and now calculates/pushes differentials
 * for all managed rooms.
 */
router.post('/overrides', async (req, res) => {
  const { hotelId, pmsPropertyId, roomTypeId, overrides } = req.body;
  console.log(`[Sentinel Router] Received post-overrides for base room ${hotelId}/${roomTypeId}`);

  if (!hotelId || !pmsPropertyId || !roomTypeId || !overrides || !Array.isArray(overrides)) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: hotelId, pmsPropertyId, roomTypeId, overrides array.',
    });
  }

try {
    // 1. [NEW LOGIC] Get the config (map and rules)
    const configRes = await db.query(
      `SELECT rate_id_map, room_differentials FROM sentinel_configurations WHERE hotel_id = $1`,
      [hotelId]
    );
    if (configRes.rows.length === 0) {
      throw new Error('No configuration found for this hotel.');
    }

 const { rate_id_map: rateIdMap, room_differentials: roomDifferentials } = configRes.rows[0];

    // --- [START DEBUGGING LOG] ---
    console.log(`[DEBUG /overrides] Fetched rate_id_map:`, JSON.stringify(rateIdMap, null, 2));
    console.log(`[DEBUG /overrides] Fetched room_differentials:`, JSON.stringify(roomDifferentials, null, 2));
    // --- [END DEBUGGING LOG] ---

    if (!rateIdMap || Object.keys(rateIdMap).length === 0) {
      console.warn(`[DEBUG /overrides] 'rate_id_map' is empty or missing. Aborting.`); // [DEBUG]
      throw new Error(`Config Error: 'rate_id_map' is empty. Please 'Save Changes' in Control Panel.`);
    }

    // 2. Process each date override
    for (const override of overrides) {
      const { date, rate } = override;
      const baseRate = parseFloat(rate);

      // 3a. "Padlock" the base rate
      const jsonPatch = { [date]: baseRate };
      await db.query(
        `UPDATE sentinel_configurations
         SET rate_overrides = rate_overrides || $1
         WHERE hotel_id = $2`,
        [JSON.stringify(jsonPatch), hotelId]
      );

      // 3b. "Update Live State" for the base room
      await db.query(
        `INSERT INTO sentinel_rates_calendar (hotel_id, stay_date, room_type_id, rate, source, last_updated_at)
         VALUES ($1, $2, $3, $4, 'Manual', NOW())
         ON CONFLICT (hotel_id, stay_date, room_type_id) DO UPDATE
         SET rate = EXCLUDED.rate, source = EXCLUDED.source, last_updated_at = NOW()`,
        [hotelId, date, roomTypeId, baseRate]
      );

      // 3c. [DIFFERENTIAL LOGIC] Push all rates to PMS

      // --- PUSH BASE RATE ---
      const baseRateId = rateIdMap[roomTypeId];
      if (!baseRateId) {
        console.warn(`[Sentinel Overrides] Skipping push for Base Room (${roomTypeId}): No 'rateID' found in map.`);
      } else {
        console.log(`[Sentinel Overrides] Pushing Base Rate: ${baseRate} for ${date} (RateID: ${baseRateId})`);
        await sentinelAdapter.postRate(pmsPropertyId, baseRateId, date, baseRate);
      }

      // --- PUSH DIFFERENTIAL RATES ---
      if (roomDifferentials && Array.isArray(roomDifferentials)) {
        for (const rule of roomDifferentials) {
          // [FIX] Add check to ensure rule and value exist
          if (!rule || rule.value === undefined || rule.value === null) {
            continue;
          }
          
          // [FIX #2] Skip this rule if it's for the Base Room
          // (we already pushed it)
          if (rule.roomTypeId === roomTypeId) {
            continue;
          }

     const diffRoomId = rule.roomTypeId;
          const diffRateId = rateIdMap[diffRoomId];

          if (!diffRateId) {
            // --- [DEBUGGING LOG] ---
            console.warn(`[DEBUG /overrides] SKIPPING differential room.
              - RoomTypeID: ${diffRoomId}
              - Rule: ${JSON.stringify(rule)}
              - Reason: No 'rateID' found in the rateIdMap for this room.
            `);
            // --- [END DEBUGGING LOG] ---
            continue;
          }
          // Calculate rate
          const value = parseFloat(rule.value);
          let newRate = baseRate;
          if (rule.operator === '+') {
            newRate = baseRate * (1 + (value / 100));
          } else {
            newRate = baseRate * (1 - (value / 100));
          }
          const finalRate = parseFloat(newRate.toFixed(2));

          console.log(`[Sentinel Overrides] Pushing Diff Rate: ${finalRate} for ${date} (Room: ${diffRoomId}, RateID: ${diffRateId})`);
          await sentinelAdapter.postRate(pmsPropertyId, diffRateId, date, finalRate);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Overrides and all differentials pushed successfully.',
    });

  } catch (error)
   {
    console.error(`[Sentinel Router] post-overrides failed:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to process overrides.',
      error: error.message,
    });
  }
});
// [Add this new, simpler version in its place]

/**
 * [NEW & SIMPLIFIED] GET /api/sentinel/rates/:hotelId/:roomTypeId
 * Fetches the 365-day rate calendar for a single room *only* from our
 * local sentinel_rates_calendar table.
 */
router.get('/rates/:hotelId/:roomTypeId', async (req, res) => {
  const { hotelId, roomTypeId } = req.params;
  console.log(`[Sentinel Router] Received get-rates for ${hotelId}/${roomTypeId} (DB ONLY)`);

  try {
    // 1. Define date range (today for 365 days)
    const today = new Date().toISOString().split('T')[0];
    
    // 2. Fetch "Saved" rates from our local database
    const { rows } = await db.query(
      `SELECT stay_date, rate, source 
       FROM sentinel_rates_calendar 
       WHERE hotel_id = $1 
         AND room_type_id = $2 
         AND stay_date >= $3
       ORDER BY stay_date ASC`,
      [hotelId, roomTypeId, today]
    );

    // 3. Process and format the data
    const savedRates = rows.map(row => ({
      date: new Date(row.stay_date).toISOString().split('T')[0],
      rate: parseFloat(row.rate),
      source: row.source,
      liveRate: 0, // [NEW] Send 0, as we are not checking the live API
    }));
    
    res.status(200).json({
      success: true,
      message: 'Rate calendar fetched from local DB successfully.',
      data: savedRates,
    });

  } catch (error) {
    console.error(`[Sentinel Router] get-rates (DB ONLY) failed for ${hotelId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rate calendar from database.',
      error: error.message,
    });
  }
});
// [Replace it with this corrected version]


module.exports = router;