/**
 * @file sentinel.service.js
 * @brief Sentinel Service Layer
 * Orchestrates Config, Pricing Engine, and Data Persistence.
 */

const db = require("../utils/db");
const pricingEngine = require("./sentinel.pricing.engine");
const sentinelAdapter = require("../adapters/sentinel.adapter"); // Needed for live rate lookup

/**
 * Fetches Sentinel Configuration for a hotel.
 */
async function getHotelConfig(hotelId) {
  const { rows } = await db.query(
    `SELECT * FROM sentinel_configurations WHERE hotel_id = $1`,
    [hotelId]
  );
  return rows[0] || null;
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
  overrides
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

  // 2. Process Overrides
  for (const override of overrides) {
    const { date, rate } = override;
    const baseRate = parseFloat(rate);

    // [SAFETY] Block invalid rates at service entry.
    // Never allow 0, negative, or NaN to enter DB or Queue.
    if (isNaN(baseRate) || baseRate <= 0) {
      console.warn(
        `[Sentinel Service] Dropping invalid override: ${rate} for ${date}`
      );
      continue;
    }

    // A. Prepare DB Update (sentinel_rates_calendar)
    // We defer the DB write to the caller or do it here in transaction?
    // Service layer usually handles the DB write for consistency.
    dbUpdates.push(
      db.query(
        `INSERT INTO sentinel_rates_calendar (hotel_id, stay_date, room_type_id, rate, source, last_updated_at)
         VALUES ($1, $2, $3, $4, 'Manual', NOW())
         ON CONFLICT (hotel_id, stay_date, room_type_id) DO UPDATE
         SET rate = EXCLUDED.rate, source = EXCLUDED.source, last_updated_at = NOW()`,
        [hotelId, date, roomTypeId, baseRate]
      )
    );

    // B. Update sentinel_configurations (Legacy JSON Patch - Optional but kept for compatibility)
    // Note: We might move away from this, but for now we keep it to match current logic.
    const jsonPatch = { [date]: baseRate };
    dbUpdates.push(
      db.query(
        `UPDATE sentinel_configurations SET rate_overrides = rate_overrides || $1 WHERE hotel_id = $2`,
        [JSON.stringify(jsonPatch), hotelId]
      )
    );

    // C. Calculate Base Payload (Engine not needed for base, it's direct input)
    const baseRateId = rateIdMap[roomTypeId];
    if (baseRateId) {
      batchPayload.push({ rateId: baseRateId, date, rate: baseRate });
    }

    // D. Calculate Differentials (Using Pricing Engine)
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
            roomDifferentials
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
  // 1. Fetch Config & Asset Settings
  const [config, assetRes] = await Promise.all([
    getHotelConfig(hotelId),
    db.query(
      `SELECT * FROM rockenue_managed_assets WHERE market_pulse_hotel_id = $1`,
      [hotelId]
    ),
  ]);

  if (!config) throw new Error("Sentinel config not found");
  const asset = assetRes.rows[0];

  // 2. Fetch Live Rates & Stored Overrides (Parallel)
  // We need PMS Property ID for live lookup
  const hotelRes = await db.query(
    "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
    [hotelId]
  );
  const pmsPropertyId = hotelRes.rows[0]?.pms_property_id;

  const [dbRatesRes, liveRatesRes] = await Promise.all([
    db.query(
      `SELECT stay_date, rate, source 
       FROM sentinel_rates_calendar 
       WHERE hotel_id = $1 AND room_type_id = $2 AND stay_date >= $3 AND stay_date <= $4`,
      [hotelId, baseRoomTypeId, startDate, endDate]
    ),
    sentinelAdapter.getRates(
      hotelId,
      pmsPropertyId,
      baseRoomTypeId,
      startDate,
      endDate
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

  liveRatesList.forEach((r) => {
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

  while (curr <= end) {
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
      dateStr
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
      suggestedRate: suggestedRate, // Raw AI calculation
      finalRate: finalRate, // Effective Rate (after guardrails/manual)
      isFrozen: guardrailResult.isFrozen,
      isFloorActive: guardrailResult.isFloorActive,
      guardrailMin: guardrailResult.minApplied,
      source: isManual ? "Manual" : guardrailResult.isFrozen ? "Frozen" : "AI",
    });

    curr.setDate(curr.getDate() + 1);
  }

  return days;
}

module.exports = {
  getHotelConfig,
  buildOverridePayload,
  previewCalendar,
};
