/**
 * @file sentinel.service.js
 * @brief Sentinel Service Layer
 * Orchestrates Config, Pricing Engine, and Data Persistence.
 */

const db = require("../utils/db");
const pricingEngine = require("./sentinel.pricing.engine");
const sentinelAdapter = require("../adapters/sentinel.adapter"); // Needed for live rate lookup
/**
 * [FIXED] Fetch Daily Max Rates
 * Translates DB Date ('2025-01-01') -> Frontend Key ('0-1')
 */
async function getDailyMaxRates(hotelId, startDate, endDate) {
  const query = `
    SELECT stay_date, max_price 
    FROM sentinel_daily_max_rates 
    WHERE hotel_id = $1 
    ${startDate ? "AND stay_date >= $2" : ""}
    ${endDate ? "AND stay_date <= $3" : ""}
  `;

  const params = [hotelId];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);

  const { rows } = await db.query(query, params);

  const map = {};
  rows.forEach((r) => {
    // Convert SQL Date to JS Date
    const d = new Date(r.stay_date);
    // [SAFETY FIX] Force UTC to prevent "off-by-one" day errors
    const key = `${d.getUTCMonth()}-${d.getUTCDate()}`;
    map[key] = r.max_price;
  });
  return map;
}

/**
 * [FIXED] Save Daily Max Rates
 * Translates Frontend Key ('0-1') -> DB Date ('2025-01-01')
 */
async function saveDailyMaxRates(hotelId, ratesMap) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    for (const [key, price] of Object.entries(ratesMap)) {
      if (!price) continue; // Skip empty values

      // 1. Parse the Frontend Key ("0-1" -> Month 0, Day 1)
      const parts = key.split("-");
      // If it's already a full date (legacy data), handle gracefully, otherwise translate
      let dateStr = key;

      if (parts.length === 2) {
        const monthIdx = parseInt(parts[0], 10); // 0 = Jan
        const day = parseInt(parts[1], 10);
        // Use 2025 as the base year to match the UI's day-of-week logic
        const year = 2025;
        dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(
          day,
        ).padStart(2, "0")}`;
      }

      // 2. Insert into DB
      const query = `
        INSERT INTO sentinel_daily_max_rates (hotel_id, stay_date, max_price, is_manual_override, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW())
        ON CONFLICT (hotel_id, stay_date) 
        DO UPDATE SET
          max_price = EXCLUDED.max_price,
          is_manual_override = TRUE,
          updated_at = NOW();
      `;
      await client.query(query, [hotelId, dateStr, price]);
    }

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetches Sentinel Configuration for a hotel.
 */
async function getHotelConfig(hotelId) {
  const res = await db.query(
    "SELECT * FROM sentinel_configurations WHERE hotel_id = $1",
    [hotelId],
  );

  if (res.rows.length === 0) return null;
  const config = res.rows[0];

  // [FIX] Read Daily Max Rates from SQL Table and format for UI (MonthIdx-Day)
  const maxRatesRes = await db.query(
    "SELECT to_char(stay_date, 'YYYY-MM-DD') as date, max_price FROM sentinel_daily_max_rates WHERE hotel_id = $1",
    [hotelId],
  );

  const maxRatesMap = {};
  maxRatesRes.rows.forEach((r) => {
    // Parse "YYYY-MM-DD"
    const [y, m, d] = r.date.split("-").map(Number);
    // UI expects "MonthIndex-Day" (Jan = 0)
    const key = `${m - 1}-${d}`;
    maxRatesMap[key] = r.max_price;
  });

  config.daily_max_rates = maxRatesMap;
  return config;
}

/**
 * Core Logic: Build the Payload for Cloudbeds and Persist to DB.
 * Replaces the heavy logic in sentinel.router.js POST /overrides.
 * * @param {string} hotelId
 * @param {string} pmsPropertyId
 * @param {string} roomTypeId - The Base Room Type ID
 * @param {Array} overrides - [{ date: 'YYYY-MM-DD', rate: 100 }, ...]
 */
async function buildOverridePayload(
  hotelId,
  pmsPropertyId,
  roomTypeId,
  overrides,
  source = "MANUAL",
) {
  // 1. Load Configuration (Facts & Rules)
  const config = await getHotelConfig(hotelId);
  if (!config)
    throw new Error(`No Sentinel configuration found for hotel ${hotelId}`);

  const { rate_id_map: rateIdMap, room_differentials: roomDifferentials } =
    config;

  if (!rateIdMap)
    throw new Error("Rate ID Map is missing. Please re-sync the hotel.");

  const batchPayload = [];
  const dbUpdates = [];

  // --- NEW: FETCH OLD RATES FOR DIFFING ---
  // We need to know what we are overwriting to calculate velocity later.
  const datesToQuery = overrides.map((o) => o.date);
  const currentRatesRes = await db.query(
    `SELECT stay_date, rate FROM sentinel_rates_calendar 
     WHERE hotel_id = $1 AND room_type_id = $2 AND stay_date = ANY($3::date[])`,
    [hotelId, roomTypeId, datesToQuery],
  );

  const currentRateMap = {};
  currentRatesRes.rows.forEach((row) => {
    // Normalize date to YYYY-MM-DD string
    const dStr = new Date(row.stay_date).toISOString().split("T")[0];
    currentRateMap[dStr] = parseFloat(row.rate);
  });
  // ----------------------------------------

  // 2. Process Overrides
  for (const override of overrides) {
    const { date, rate } = override;
    const baseRate = parseFloat(rate);

    // [SAFETY] Block invalid rates at service entry.
    // Never allow 0, negative, or NaN to enter DB or Queue.
    if (isNaN(baseRate) || baseRate <= 0) {
      console.warn(
        `[Sentinel Service] Dropping invalid override: ${rate} for ${date}`,
      );
      continue;
    }

    // --- NEW: HISTORY LOGGING LOGIC ---
    const oldRate = currentRateMap[date] || null; // null if no previous rate existed

    // Only log if the price actually changed (or it's a new entry)
    if (oldRate !== baseRate) {
      dbUpdates.push(
        db.query(
          `INSERT INTO sentinel_price_history (hotel_id, room_type_id, stay_date, old_price, new_price, source, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [hotelId, roomTypeId, date, oldRate, baseRate, source],
        ),
      );
    }
    // ----------------------------------

    // A. Prepare DB Update (sentinel_rates_calendar)
    // [UPDATED] Now uses the dynamic 'source' argument instead of hardcoded 'Manual'
    dbUpdates.push(
      db.query(
        `INSERT INTO sentinel_rates_calendar (hotel_id, stay_date, room_type_id, rate, source, last_updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (hotel_id, stay_date, room_type_id) DO UPDATE
         SET rate = EXCLUDED.rate, source = EXCLUDED.source, last_updated_at = NOW()`,
        [hotelId, date, roomTypeId, baseRate, source],
      ),
    );

    // B. Update sentinel_configurations (Legacy JSON Patch - Optional but kept for compatibility)
    // Note: We might move away from this, but for now we keep it to match current logic.
    const jsonPatch = { [date]: baseRate };
    dbUpdates.push(
      db.query(
        `UPDATE sentinel_configurations SET rate_overrides = rate_overrides || $1 WHERE hotel_id = $2`,
        [JSON.stringify(jsonPatch), hotelId],
      ),
    );

    // C. Calculate Base Payload (Engine not needed for base, it's direct input)
    const baseRateId = rateIdMap[roomTypeId];
    if (baseRateId) {
      batchPayload.push({ rateId: baseRateId, date, rate: baseRate });
    }

    // D. Calculate Differentials (Derived Rooms)
    if (roomDifferentials && Array.isArray(roomDifferentials)) {
      for (const rule of roomDifferentials) {
        // Skip invalid rules or rules targeting the base room itself
        if (!rule || rule.value === undefined || rule.roomTypeId === roomTypeId)
          continue;

        const derivedRoomId = rule.roomTypeId;
        const derivedRateId = rateIdMap[derivedRoomId];

        if (derivedRateId) {
          // CALL THE ENGINE
          const derivedRate = pricingEngine.calculateDifferential(
            baseRate,
            derivedRoomId,
            roomDifferentials,
          );

          batchPayload.push({ rateId: derivedRateId, date, rate: derivedRate });
        }
      }
    }
  }

  // 3. Execute DB Writes
  await Promise.all(dbUpdates);

  return batchPayload;
}

/**
 * Generates a Preview Calendar.
 * Used by GET /preview-rate (and eventually the UI Grid).
 * * @param {object} params
 * @param {string} params.hotelId
 * @param {string} params.baseRoomTypeId
 * @param {string} params.startDate
 * @param {string} params.endDate
 */
async function previewCalendar({
  hotelId,
  baseRoomTypeId,
  startDate,
  endDate,
}) {
  // 1. Fetch Config, Asset Settings, AND Daily Max Rates (SQL)
  const [config, assetRes, dailyMaxRates] = await Promise.all([
    getHotelConfig(hotelId),
    db.query(
      `SELECT * FROM rockenue_managed_assets WHERE market_pulse_hotel_id = $1`,
      [hotelId],
    ),
    getDailyMaxRates(hotelId, startDate, endDate),
  ]);

  if (!config) throw new Error("Sentinel config not found");

  // [INJECTION] Overwrite the legacy JSON blob with the fresh SQL data
  // This ensures the pricing engine (applyGuardrails) uses the new table data.
  config.daily_max_rates = dailyMaxRates;
  const asset = assetRes.rows[0];

  // 2. Fetch Live Rates & Stored Overrides (Parallel)
  // We need PMS Property ID for live lookup
  const hotelRes = await db.query(
    "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
    [hotelId],
  );
  const pmsPropertyId = hotelRes.rows[0]?.pms_property_id;

  const [dbRatesRes, liveRatesRes] = await Promise.all([
    db.query(
      `SELECT stay_date, rate, source 
       FROM sentinel_rates_calendar 
       WHERE hotel_id = $1 AND room_type_id = $2 AND stay_date >= $3 AND stay_date <= $4`,
      [hotelId, baseRoomTypeId, startDate, endDate],
    ),
    sentinelAdapter.getRates(
      hotelId,
      pmsPropertyId,
      baseRoomTypeId,
      startDate,
      endDate,
    ),
  ]);

  // 3. Map Data
  const dbMap = {};
  dbRatesRes.rows.forEach((r) => {
    const d = new Date(r.stay_date).toISOString().split("T")[0];
    dbMap[d] = r;
  });

  // [FIXED] Robustly handle the Adapter response structure (unwrap .data)
  const liveMap = {};
  let liveRatesList = [];

  // Check if it's an Axios response (.data) or direct object
  if (
    liveRatesRes &&
    liveRatesRes.data &&
    Array.isArray(liveRatesRes.data.roomRateDetailed)
  ) {
    liveRatesList = liveRatesRes.data.roomRateDetailed;
  } else if (liveRatesRes && Array.isArray(liveRatesRes.roomRateDetailed)) {
    liveRatesList = liveRatesRes.roomRateDetailed;
  }

  // [CRITICAL FIX] Target the correct Rate Plan ID
  // Prevents "Net Rate" or "Package Rate" ingestion (The Death Spiral Fix).
  const targetRateId = config.rate_id_map?.[baseRoomTypeId];

  liveRatesList.forEach((r) => {
    // 1. Filter by Room Type
    if (r.roomTypeID && String(r.roomTypeID) !== String(baseRoomTypeId)) return;

    // 2. Filter by Rate Plan ID (if we have a map)
    // If the PMS returns multiple plans (Standard, Net, Package), we MUST pick the mapped one.
    if (
      targetRateId &&
      r.ratePlanID &&
      String(r.ratePlanID) !== String(targetRateId)
    ) {
      return;
    }

    if (r.date && r.rate) liveMap[r.date] = parseFloat(r.rate);
  });

  // 4. Build Context for Pricing Engine
  // Construct the 'CalculatorState' context from Asset Settings
  const calcSettings = asset?.calculator_settings || {};
  const pricingContext = {
    multiplier: asset?.strategic_multiplier
      ? parseFloat(asset.strategic_multiplier)
      : 1.3,
    // [NEW] Pass Tax Settings to Engine
    taxType: calcSettings.tax?.type || "inclusive",
    taxPercent: calcSettings.tax?.percent || 0,
    campaigns: calcSettings.campaigns || [],
    mobileActive: calcSettings.mobile?.active ?? true,
    mobilePercent: calcSettings.mobile?.percent ?? 10,
    nonRefundableActive: calcSettings.nonRef?.active ?? true,
    nonRefundablePercent: calcSettings.nonRef?.percent ?? 15,
    countryRateActive: calcSettings.country?.active ?? false,
    countryRatePercent: calcSettings.country?.percent ?? 5,
    geniusPct: asset?.genius_discount_pct || 0,
  };

  // 5. Generate Calendar Days
  const days = [];
  let curr = new Date(startDate);
  const end = new Date(endDate);

  // [SAFETY FIX] DST-Proof Loop
  // Ensure we compare purely based on the date string to avoid time-of-day drift.
  while (curr.toISOString().split("T")[0] <= end.toISOString().split("T")[0]) {
    const dateStr = curr.toISOString().split("T")[0];

    const dbEntry = dbMap[dateStr];
    // [SAFETY] Distinguish between "0" (Free) and "Null" (Missing/Not Set)
    const liveRate = liveMap[dateStr] !== undefined ? liveMap[dateStr] : null;

    // Determine Base: Manual Override > PMS Live
    // Note: useRateGrid logic uses PMS Live * Multiplier.
    // If Manual exists, that BECOMES the rate.

    // Step A: Calculate Suggested Sell Rate (The "AI" Price)
    // We pass the LIVE PMS rate to the engine to get the "Suggested" value
    const aiContext = { ...pricingContext, date: dateStr };
    const suggestedRate = pricingEngine.calculateSellRate(liveRate, aiContext);

    // Step B: Apply Guardrails
    // (We apply guardrails to the SUGGESTED rate)
    const guardrailResult = pricingEngine.applyGuardrails(
      suggestedRate,
      liveRate,
      config,
      dateStr,
    );

    // Step C: Determine Final Display Data
    // If we have a Manual Override in DB, that takes precedence for the "Active" column
    const isManual = dbEntry && dbEntry.source === "Manual";
    const finalRate = isManual
      ? parseFloat(dbEntry.rate)
      : guardrailResult.finalRate;

    days.push({
      date: dateStr,
      liveRate: liveRate,
      suggestedRate: suggestedRate,
      finalRate: finalRate,
      isFrozen: guardrailResult.isFrozen,
      isFloorActive: guardrailResult.isFloorActive,
      guardrailMin: guardrailResult.minApplied,
      source: isManual
        ? "MANUAL"
        : guardrailResult.isFrozen
          ? "Frozen"
          : dbEntry?.source || "SENTINEL",
    });

    // [CRITICAL FIX] Use UTC setters to avoid DST "Spring Forward" loops (23h days)
    // Old: curr.setDate(curr.getDate() + 1);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return days;
}

/**
 * [HELPER] Rebuild Rate ID Map (Smart Match)
 * Scans PMS Room Types & Rate Plans to find the correct "Base" Rate ID.
 * PRIORITY:
 * 1. Rate Plan Name contains "Base" or "Standard"
 * 2. First Non-Derived Rate Plan found (Fallback)
 */
/**
 * [FIXED] Robust Rate ID Map (Smart Match)
 * Scans PMS Room Types & Rate Plans to find the correct "Base" Rate ID.
 * PRIORITY:
 * 1. STRICT MATCH: "Base", "Standard", "Rack", "BAR"
 * 2. NEGATIVE MATCH: Avoid "Net", "Package", "NonRef", "Agent", "Corp"
 * 3. FALLBACK: First safest candidate.
 */
function buildRateIdMap(pmsRoomTypes, pmsRatePlans) {
  const rateIdMap = {};
  const roomTypes = pmsRoomTypes || [];
  const ratePlans = pmsRatePlans || [];

  for (const room of roomTypes) {
    const roomTypeId = room.roomTypeID;

    // Find ALL candidates for this room
    const candidates = ratePlans.filter(
      (r) =>
        String(r.roomTypeID) === String(roomTypeId) && r.isDerived == false,
    );

    if (candidates.length === 0) continue;

    // 1. Filter out "Toxic" Plans (Net, Package, Agent)
    const safeCandidates = candidates.filter((r) => {
      const n = (r.ratePlanName || "").toLowerCase();
      return (
        !n.includes("net") &&
        !n.includes("package") &&
        !n.includes("agent") &&
        !n.includes("corp") &&
        !n.includes("nonref")
      );
    });

    // If all candidates were toxic, use the original list (desperate fallback), else use safe list.
    const pool = safeCandidates.length > 0 ? safeCandidates : candidates;

    // 2. Look for Positive Keywords ("Base", "Standard", "Rack", "BAR")
    const bestMatch = pool.find((r) => {
      const name = (r.ratePlanName || "").toLowerCase();
      return (
        name.includes("base") ||
        name.includes("standard") ||
        name.includes("rack") ||
        name.includes("bar")
      );
    });

    if (bestMatch) {
      rateIdMap[roomTypeId] = bestMatch.rateID;
    } else {
      // 3. Fallback to the first "Safe" candidate
      rateIdMap[roomTypeId] = pool[0].rateID;
    }
  }
  return rateIdMap;
}
/**
 * Updates Sentinel Configuration (Facts & Rules).
 * Handles Daily Max Rates and rebuilding the Rate ID Map.
 */
async function updateConfig(hotelId, updates) {
  // --- DEBUG PROBE START ---
  console.log(`[DEBUG SERVICE] updateConfig called for ${hotelId}`);
  console.log(`[DEBUG SERVICE] Raw Updates:`, JSON.stringify(updates, null, 2));
  // --- DEBUG PROBE END ---

  const {
    sentinel_enabled,
    is_autopilot_enabled, // [NEW] Autonomy Switch
    guardrail_max,
    rate_freeze_period,
    base_room_type_id,
    room_differentials,
    last_minute_floor,
    monthly_aggression,
    monthly_min_rates,
    daily_max_rates,
    seasonality_profile,
    rules, // <--- 1. NEW FIELD EXTRACTED (Yield Strategy)
  } = updates;

  // 1. Fetch current config to ensure we have the Facts (for rebuilding map)
  const currentConfig = await getHotelConfig(hotelId);
  if (!currentConfig) {
    throw new Error('Config not found. Run "Sync with PMS" first.');
  }

  if (daily_max_rates && Object.keys(daily_max_rates).length > 0) {
    try {
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const [key, price] of Object.entries(daily_max_rates)) {
        const [mIdx, d] = key.split("-").map(Number);

        // [FIX] Dynamic Year Calculation
        // Always save for the current year AND the next year to ensure full 365+ day coverage.
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1];

        for (const year of years) {
          const isoDate = `${year}-${String(mIdx + 1).padStart(
            2,
            "0",
          )}-${String(d).padStart(2, "0")}`;

          // Construct ($1, $2, $3, NOW()), ($4, $5, $6, NOW()), ...
          values.push(
            `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, NOW())`,
          );
          params.push(hotelId, isoDate, price);
          paramIdx += 3;
        }
      }

      if (values.length > 0) {
        const query = `
          INSERT INTO sentinel_daily_max_rates (hotel_id, stay_date, max_price, updated_at)
          VALUES ${values.join(", ")}
          ON CONFLICT (hotel_id, stay_date) 
          DO UPDATE SET 
            max_price = EXCLUDED.max_price,
            updated_at = NOW()
        `;
        await db.query(query, params);
      }
    } catch (e) {
      console.error("Failed to save daily max rates (batch)", e);
    }
  }

  // 2. Rebuild Rate ID Map
  const pmsRoomTypes = currentConfig.pms_room_types?.data || [];
  const pmsRatePlans = currentConfig.pms_rate_plans?.data || [];
  const rateIdMap = buildRateIdMap(pmsRoomTypes, pmsRatePlans);

  // 3. Update Database (With Seasonality Profile & Rules)
  const { rows } = await db.query(
    `
    UPDATE sentinel_configurations
    SET
      sentinel_enabled = COALESCE($1, sentinel_enabled),
      guardrail_max = COALESCE($2, guardrail_max),
      rate_freeze_period = COALESCE($3, rate_freeze_period),
      base_room_type_id = COALESCE($4, base_room_type_id),
      room_differentials = COALESCE($5, room_differentials),
      last_minute_floor = COALESCE($6, last_minute_floor),
      monthly_aggression = COALESCE($7, monthly_aggression),
      monthly_min_rates = COALESCE($8, monthly_min_rates),
      rate_id_map = COALESCE($9, rate_id_map),
      daily_max_rates = COALESCE($10, daily_max_rates),
      seasonality_profile = COALESCE($12, seasonality_profile),
      rules = COALESCE($13, rules),
      is_autopilot_enabled = COALESCE($14, is_autopilot_enabled),
      updated_at = NOW()
    WHERE hotel_id = $11
    RETURNING *;
    `,
    [
      sentinel_enabled,
      guardrail_max,
      rate_freeze_period,
      base_room_type_id,
      updates.room_differentials ? JSON.stringify(room_differentials) : null,
      updates.last_minute_floor ? JSON.stringify(last_minute_floor) : null,
      updates.monthly_aggression ? JSON.stringify(monthly_aggression) : null,
      updates.monthly_min_rates ? JSON.stringify(monthly_min_rates) : null,
      JSON.stringify(rateIdMap),
      updates.daily_max_rates ? JSON.stringify(daily_max_rates) : null,
      hotelId,
      updates.seasonality_profile ? JSON.stringify(seasonality_profile) : null,
      updates.rules ? JSON.stringify(rules) : null,
      is_autopilot_enabled, // [NEW] $14
    ],
  );

  return rows[0];
}

async function getPaceCurves(hotelId) {
  const query = `
    SELECT season_tier, curve_data 
    FROM sentinel_pace_curves 
    WHERE hotel_id = $1
  `;
  const { rows } = await db.query(query, [hotelId]);
  return rows;
}
module.exports = {
  getHotelConfig,
  updateConfig,
  buildOverridePayload,
  previewCalendar,
  getDailyMaxRates,
  saveDailyMaxRates,
  getPaceCurves,
  copyPaceCurves,
  getSentinelStatus,
  buildRateIdMap,
  getRecentJobBatches,
};
/**
 * [NEW] Get Sentinel Status (Last Run & Activity)
 */
/**
 * [NEW] Get Recent Job Batches
 * Groups queue items by minute to show "Push Events"
 */
async function getRecentJobBatches(hotelId) {
  const sql = `
      SELECT
          to_char(created_at, 'YYYY-MM-DD HH24:MI') as batch_key,
          COUNT(*) as days_count,
          MAX(created_at) as latest_timestamp
      FROM sentinel_job_queue
      WHERE hotel_id = $1
      GROUP BY batch_key
      ORDER BY latest_timestamp DESC
      LIMIT 3
  `;
  const { rows } = await db.query(sql, [hotelId]);
  return rows;
}

/**
 * [NEW] Get Sentinel Status (Last Run & Activity)
 */
async function getSentinelStatus(hotelId) {
  const client = await db.connect();
  try {
    // 1. Fetch timestamps from both History (Committed) and Predictions (Shadow/Thoughts)
    const [historyRes, predRes] = await Promise.all([
      client.query(
        `SELECT MAX(created_at) as last_run
         FROM sentinel_price_history
         WHERE hotel_id = $1 AND source IN ('AI', 'AI_APPROVED', 'SENTINEL', 'AUTO', 'AI_SUGGESTED')`,
        [hotelId],
      ),
      client.query(
        `SELECT MAX(created_at) as last_run
         FROM sentinel_ai_predictions
         WHERE hotel_id = $1`,
        [hotelId],
      ),
    ]);

    const historyDate = historyRes.rows[0]?.last_run
      ? new Date(historyRes.rows[0].last_run)
      : new Date(0);
    const predDate = predRes.rows[0]?.last_run
      ? new Date(predRes.rows[0].last_run)
      : new Date(0);

    // The "Last Run" is whichever is more recent
    const lastRun = historyDate > predDate ? historyDate : predDate;

    // 2. Changes in last 24h (Strictly Price Moves)
    const countRes = await client.query(
      `SELECT COUNT(*) as count
       FROM sentinel_price_history
       WHERE hotel_id = $1 
         AND source IN ('AI', 'AI_APPROVED', 'SENTINEL', 'AUTO', 'AI_SUGGESTED')
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [hotelId],
    );
    const count = parseInt(countRes.rows[0]?.count || 0);

    return {
      lastRun: lastRun.getTime() === 0 ? null : lastRun,
      changesLast24h: count,
    };
  } finally {
    client.release();
  }
}

/**
 * Copies Pace Curves from Source Hotel to Target Hotel.
 * Overwrites existing curves for the target.
 */
async function copyPaceCurves(sourceHotelId, targetHotelId) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify source has curves
    const checkRes = await client.query(
      `SELECT count(*) as count FROM sentinel_pace_curves WHERE hotel_id = $1`,
      [sourceHotelId],
    );
    if (parseInt(checkRes.rows[0].count) === 0) {
      throw new Error("Source hotel has no pace curves to copy.");
    }

    // 2. Delete existing curves for target
    await client.query(`DELETE FROM sentinel_pace_curves WHERE hotel_id = $1`, [
      targetHotelId,
    ]);

    // 3. Copy from source to target
    await client.query(
      `
      INSERT INTO sentinel_pace_curves (hotel_id, season_tier, curve_data, created_at)
      SELECT $1, season_tier, curve_data, NOW()
      FROM sentinel_pace_curves
      WHERE hotel_id = $2
    `,
      [targetHotelId, sourceHotelId],
    );

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
