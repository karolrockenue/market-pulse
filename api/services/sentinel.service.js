/**
 * @file sentinel.service.js
 * @brief Sentinel Service Layer
 * Orchestrates Config, Pricing Engine, and Data Persistence.
 */

const db = require("../utils/db");
const pricingEngine = require("./sentinel.pricing.engine");
const sentinelAdapter = require("../adapters/sentinel.adapter"); // Needed for live rate lookup
const pmsRegistry = require("../adapters/pmsRegistry"); // [MEWS] PMS-aware adapter routing
/**
 * [ENGINE] Fetch Daily Max Rates as ISO date map (YYYY-MM-DD keys).
 * Used by previewCalendar / recalculateRates so that
 * sentinel.pricing.engine.applyGuardrails can find the per-day cap.
 *
 * Distinct from getDailyMaxRates below, which returns the legacy
 * "monthIdx-day" shorthand for the Control Panel UI dialog.
 *
 * Bug history: previously the engine consumed the month-day map,
 * which made the daily cap silently invisible (the engine looked up
 * by ISO date and never matched), so every cap fell through to the
 * global guardrail_max — see Durrant House 2026-04-10 incident.
 */
async function getDailyMaxRatesIsoMap(hotelId, startDate, endDate) {
  const query = `
    SELECT to_char(stay_date, 'YYYY-MM-DD') AS date, max_price
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
    const v = parseFloat(r.max_price);
    if (!isNaN(v) && v > 0) map[r.date] = v;
  });
  return map;
}

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
 * Fetch Daily Min Rates (per-day floor overrides)
 * Returns { "YYYY-MM-DD": min_price }
 */
async function getDailyMinRates(hotelId, startDate, endDate) {
  const query = `
    SELECT to_char(stay_date, 'YYYY-MM-DD') as date, min_price
    FROM sentinel_daily_min_rates
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
    map[r.date] = parseFloat(r.min_price);
  });
  return map;
}

/**
 * Save Daily Min Rates (per-day floor overrides)
 * Accepts { "YYYY-MM-DD": price }
 */
async function saveDailyMinRates(hotelId, ratesMap) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const [dateStr, price] of Object.entries(ratesMap)) {
      if (price === null || price === undefined || price === "") {
        // Delete the override to revert to monthly default
        await client.query(
          `DELETE FROM sentinel_daily_min_rates WHERE hotel_id = $1 AND stay_date = $2`,
          [hotelId, dateStr],
        );
        continue;
      }
      await client.query(
        `INSERT INTO sentinel_daily_min_rates (hotel_id, stay_date, min_price, is_manual_override, updated_at)
         VALUES ($1, $2, $3, TRUE, NOW())
         ON CONFLICT (hotel_id, stay_date)
         DO UPDATE SET min_price = EXCLUDED.min_price, is_manual_override = TRUE, updated_at = NOW()`,
        [hotelId, dateStr, price],
      );
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
  // 1. Fetch Config, Asset Settings, Daily Max/Min Rates, AND Override Map (SQL)
  // [FIX 2026-04-10] Use ISO-keyed daily-max map so applyGuardrails can find
  // it. The previous month-day map was silently invisible to the engine.
  // [OVERRIDE v1] Override map is overlaid in the day-build loop below so the
  // UI grid + recalc see the user-pinned price as the canonical "final" rate.
  const [config, assetRes, dailyMaxRates, dailyMinRates, overrideMap] = await Promise.all([
    getHotelConfig(hotelId),
    db.query(
      `SELECT * FROM rockenue_managed_assets WHERE market_pulse_hotel_id = $1`,
      [hotelId],
    ),
    getDailyMaxRatesIsoMap(hotelId, startDate, endDate),
    getDailyMinRates(hotelId, startDate, endDate),
    getRateOverrideMapForHotel(hotelId),
  ]);

  if (!config) throw new Error("Sentinel config not found");

  // [INJECTION] Overwrite the legacy JSON blob with the fresh SQL data
  // This ensures the pricing engine (applyGuardrails) uses the new table data.
  config.daily_max_rates = dailyMaxRates;
  config.daily_min_rates = dailyMinRates;
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
    pmsRegistry
      .getPmsType(hotelId)
      .then((pmsType) => {
        const adapter = pmsRegistry.getSentinelAdapter(pmsType);
        return adapter.getRates(
          hotelId,
          pmsPropertyId,
          baseRoomTypeId,
          startDate,
          endDate,
        );
      })
      .catch((err) => {
        console.error(`[Sentinel] Live rate fetch failed for hotel ${hotelId}:`, err.message);
        return { success: true, data: { roomRateDetailed: [] } };
      }),
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

  // [DEBUG] Temporary logging for hotel 318313
  if (String(hotelId) === '318313') {
    console.log(`[DEBUG 318313] pmsPropertyId=${pmsPropertyId}, baseRoomTypeId=${baseRoomTypeId}`);
    console.log(`[DEBUG 318313] liveRatesRes keys:`, liveRatesRes ? Object.keys(liveRatesRes) : 'null');
    console.log(`[DEBUG 318313] liveRatesRes.data keys:`, liveRatesRes?.data ? Object.keys(liveRatesRes.data) : 'null');
    console.log(`[DEBUG 318313] liveRatesList.length=${liveRatesList.length}`);
    if (liveRatesList.length > 0) {
      console.log(`[DEBUG 318313] sample entry:`, JSON.stringify(liveRatesList[0]));
    }
    console.log(`[DEBUG 318313] rate_id_map:`, JSON.stringify(config.rate_id_map));
  }

  // [CRITICAL FIX] Target the correct Rate Plan ID
  // Prevents "Net Rate" or "Package Rate" ingestion (The Death Spiral Fix).
  const targetRateId = config.rate_id_map?.[baseRoomTypeId];

  let debugFilteredRoom = 0, debugFilteredPlan = 0, debugFilteredNoRate = 0, debugAccepted = 0;
  liveRatesList.forEach((r) => {
    // 1. Filter by Room Type
    if (r.roomTypeID && String(r.roomTypeID) !== String(baseRoomTypeId)) { debugFilteredRoom++; return; }

    // 2. Filter by Rate Plan ID (if we have a map)
    // If the PMS returns multiple plans (Standard, Net, Package), we MUST pick the mapped one.
    if (
      targetRateId &&
      r.ratePlanID &&
      String(r.ratePlanID) !== String(targetRateId)
    ) {
      debugFilteredPlan++;
      return;
    }

    if (r.date && r.rate) { debugAccepted++; liveMap[r.date] = parseFloat(r.rate); }
    else { debugFilteredNoRate++; }
  });

  // [DEBUG] Temporary logging for hotel 318313
  if (String(hotelId) === '318313') {
    console.log(`[DEBUG 318313] targetRateId=${targetRateId}`);
    console.log(`[DEBUG 318313] filter results: accepted=${debugAccepted}, filteredByRoom=${debugFilteredRoom}, filteredByPlan=${debugFilteredPlan}, filteredNoRate=${debugFilteredNoRate}`);
    console.log(`[DEBUG 318313] liveMap size=${Object.keys(liveMap).length}`);
  }

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
    // [OVERRIDE v1] PMS Override wins over everything — engine, MANUAL, freeze.
    // The bridge's hourly re-push enforces this at PMS level; the UI grid and
    // recalculateRates both consume this finalRate, so they must see the same
    // truth as what's actually being shipped to the channel manager.
    const overridePrice = overrideMap[dateStr];
    const hasOverride = overridePrice !== undefined && overridePrice > 0;
    // If we have a Manual Override in DB, that takes precedence for the "Active" column
    const isManual = dbEntry && dbEntry.source.toUpperCase() === "MANUAL";
    const finalRate = hasOverride
      ? overridePrice
      : isManual
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
      monthlyMinDefault: guardrailResult.monthlyMinDefault || guardrailResult.minApplied,
      isDailyMinOverride: guardrailResult.isDailyMinOverride || false,
      isOverride: hasOverride,
      source: hasOverride
        ? "OVERRIDE"
        : isManual
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
    rate_id_map: userProvidedRateIdMap, // [NEW 2026-05-07] Explicit user choice from Control Panel
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

  // 1b. Sanitize: strip any differential that targets the base room
  const effectiveBase = base_room_type_id || currentConfig.base_room_type_id;
  if (room_differentials && Array.isArray(room_differentials) && effectiveBase) {
    const before = room_differentials.length;
    const cleaned = room_differentials.filter(
      (r) => String(r.roomTypeId) !== String(effectiveBase),
    );
    if (cleaned.length < before) {
      console.log(
        `[Sentinel] Stripped ${before - cleaned.length} self-referencing differential(s) for base room ${effectiveBase} (hotel ${hotelId})`,
      );
      room_differentials.length = 0;
      room_differentials.push(...cleaned);
    }
  }

  // 2. Resolve Rate ID Map — fill-only, never overwrite existing entries.
  // Substring matchers can silently flip an existing mapping if a new rate plan is added
  // that matches base|standard|rack|bar (e.g. "Mid Stay 29-59 (BASE)" flipped Belsize +
  // Primrose 2026-04/05 — see claude/rockenue/groups/mason-and-fifth.md). Existing entries
  // are sacred. The Control Panel rate-plan dropdown is the deliberate-edit path.
  const pmsRoomTypes = currentConfig.pms_room_types?.data || [];
  const pmsRatePlans = currentConfig.pms_rate_plans?.data || [];
  // Check if this is a Mews hotel — use hotels.pms_type (definitive) with UUID fallback
  const pmsTypeRes = await db.query(
    "SELECT pms_type FROM hotels WHERE hotel_id = $1",
    [hotelId],
  );
  const isMewsHotel =
    pmsTypeRes.rows[0]?.pms_type === "mews" ||
    (pmsRatePlans.length > 0 &&
      String(pmsRatePlans[0]?.rateID || "").includes("-"));

  // If the Control Panel sent an explicit rate_id_map, use it verbatim (deliberate user choice).
  // Otherwise: preserve existing entries and only fill NEW room keys from the matcher.
  const existingRateIdMap = currentConfig.rate_id_map || {};
  let rateIdMap;
  if (
    userProvidedRateIdMap &&
    typeof userProvidedRateIdMap === "object" &&
    !Array.isArray(userProvidedRateIdMap) &&
    Object.keys(userProvidedRateIdMap).length > 0
  ) {
    rateIdMap = userProvidedRateIdMap;
    console.log(
      `[Sentinel] Hotel ${hotelId}: rate_id_map set explicitly by user (${Object.keys(rateIdMap).length} entries)`,
    );
  } else {
    let candidateMap;
    if (isMewsHotel) {
      const mewsAdapter = require("../adapters/mewsAdapter");
      candidateMap = mewsAdapter.buildMewsRateIdMap(pmsRatePlans, pmsRoomTypes);
    } else {
      candidateMap = buildRateIdMap(pmsRoomTypes, pmsRatePlans);
    }
    // Existing entries win over candidates. Candidate fills only NEW room keys.
    rateIdMap = { ...candidateMap, ...existingRateIdMap };
    const addedRoomKeys = Object.keys(rateIdMap).filter((k) => existingRateIdMap[k] === undefined);
    console.log(
      `[Sentinel] Hotel ${hotelId}: rate_id_map preserved (${Object.keys(existingRateIdMap).length} existing, ${addedRoomKeys.length} added${addedRoomKeys.length ? ": " + addedRoomKeys.join(", ") : ""})`,
    );
  }

  // 2b. If monthly_min_rates changed, clear daily min overrides for affected months
  //     so the new monthly value takes effect (last-save-wins semantics)
  if (updates.monthly_min_rates) {
    const oldMonthly = currentConfig.monthly_min_rates || {};
    const newMonthly = monthly_min_rates;
    const monthToNumber = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    const changedMonths = [];
    for (const [mon, val] of Object.entries(newMonthly)) {
      if (String(val) !== String(oldMonthly[mon] || "0")) {
        changedMonths.push(monthToNumber[mon]);
      }
    }

    if (changedMonths.length > 0) {
      await db.query(
        `DELETE FROM sentinel_daily_min_rates
         WHERE hotel_id = $1
           AND EXTRACT(MONTH FROM stay_date) = ANY($2::int[])`,
        [hotelId, changedMonths],
      );
      console.log(
        `[Sentinel] Cleared daily min overrides for hotel ${hotelId}, months: ${changedMonths.join(", ")}`,
      );
    }
  }

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
// [FLOOD FIX 2026-04-26] Per-hotel debounce for recalculateRates. Prevents
// double-clicks of "Re-Push Rates" or rapid config saves from each firing a
// fresh full-year push. Park Hotel saw 4 distinct recalcs in ~3 hours today
// (12:27, 13:01, 14:01, 15:01) producing ~5,500 rates of redundant traffic.
// Window of 60s is short enough that legitimate user-initiated retries (e.g.
// after a transient PMS error) still go through, but tight enough to absorb
// thrash. In-memory map — survives only as long as the Node process; a
// Railway restart resets it (acceptable: the restart already broke any
// in-flight push, so rerunning recalc post-restart is correct behaviour).
const _recalcDebounceMap = new Map();
const RECALC_DEBOUNCE_MS = 60_000;

/**
 * Recalculate rates for a hotel and push to job queue.
 * Used by POST /recalculate endpoint and autopilot triggers.
 */
async function recalculateRates(hotelId, startDate, endDate) {
  // [FLOOD FIX 2026-04-26] Debounce rapid repeats per hotel.
  const debounceKey = String(hotelId);
  const lastRun = _recalcDebounceMap.get(debounceKey);
  const now = Date.now();
  if (lastRun && now - lastRun < RECALC_DEBOUNCE_MS) {
    const skippedAgoSec = Math.round((now - lastRun) / 1000);
    console.log(
      `[Sentinel] recalculateRates DEBOUNCED for hotel ${hotelId} (last run ${skippedAgoSec}s ago, window ${RECALC_DEBOUNCE_MS / 1000}s). Skipping.`,
    );
    return { totalQueued: 0, debounced: true, lastRunSecondsAgo: skippedAgoSec };
  }
  _recalcDebounceMap.set(debounceKey, now);

  const configRes = await db.query(
    "SELECT * FROM sentinel_configurations WHERE hotel_id = $1",
    [hotelId],
  );
  if (configRes.rows.length === 0) {
    throw new Error("Configuration not found.");
  }

  const config = configRes.rows[0];
  const baseRoomTypeId = config.base_room_type_id;
  const differentials = config.room_differentials || [];
  const pmsRoomTypes = config.pms_room_types?.data || [];

  if (!baseRoomTypeId) {
    throw new Error("Base Room Type not defined in configuration.");
  }

  // Detect Mews
  const pmsTypeRes = await db.query(
    "SELECT pms_type FROM hotels WHERE hotel_id = $1",
    [hotelId],
  );
  const isMewsHotel = pmsTypeRes.rows[0]?.pms_type === "mews";

  // Self-heal rate ID map — fill-only, never overwrite existing entries.
  // Substring matchers in buildRateIdMap / buildMewsRateIdMap will silently flip
  // an existing mapping if a new rate plan is added that matches base|standard|rack|bar
  // (e.g. "Mid Stay 29-59 (BASE)" flipped Belsize 2026-04-23 + Primrose 2026-05-06).
  // Existing entries are sacred. Only fill in keys for newly-added rooms.
  const pmsRatePlans = config.pms_rate_plans?.data || [];
  let candidateMap;
  if (isMewsHotel) {
    const mewsAdapter = require("../adapters/mewsAdapter");
    candidateMap = mewsAdapter.buildMewsRateIdMap(pmsRatePlans, pmsRoomTypes);
  } else {
    candidateMap = buildRateIdMap(pmsRoomTypes, pmsRatePlans);
  }
  const existingMap = config.rate_id_map || {};
  const filledMap = { ...candidateMap, ...existingMap };
  const addedKeys = Object.keys(filledMap).filter((k) => existingMap[k] === undefined);
  if (addedKeys.length > 0) {
    await db.query(
      `UPDATE sentinel_configurations SET rate_id_map = $1, updated_at = NOW() WHERE hotel_id = $2`,
      [JSON.stringify(filledMap), hotelId],
    );
    config.rate_id_map = filledMap;
    console.log(
      `[Sentinel] Hotel ${hotelId}: filled ${addedKeys.length} missing room mapping(s): ${addedKeys.join(", ")}`,
    );
  }

  // [ARCH 2026-05-07] DGX is the ONLY pricing engine. recalculateRates
  // reads the latest DGX prediction per stay_date for the BASE room, applies
  // guardrails (min / max / freeze), and queues PMS pushes. The JS waterfall
  // (calculateSellRate / previewCalendar) is a VIEW utility — it must NEVER
  // produce values that get pushed to PMS. See claude/sentinel-mews-rate-mapping-2026-05-07.md
  // for the incident that exposed the previous misuse.
  //
  // Dates without a DGX prediction are skipped — the next DGX cycle will
  // produce one and the natural Phase 2 flow will push it.

  // 1. Load latest DGX prediction per stay_date for the BASE room only.
  //    DGX only predicts the base room; derived rooms follow via differentials.
  const predictionsRes = await db.query(
    `SELECT DISTINCT ON (stay_date)
            to_char(stay_date,'YYYY-MM-DD') AS stay_date,
            suggested_rate
     FROM sentinel_ai_predictions
     WHERE hotel_id = $1
       AND room_type_id::text = $2
       AND stay_date BETWEEN $3 AND $4
     ORDER BY stay_date, created_at DESC`,
    [hotelId, baseRoomTypeId, startDate, endDate],
  );
  const predictionByDate = {};
  predictionsRes.rows.forEach((row) => {
    const r = parseFloat(row.suggested_rate);
    if (r > 0 && !isNaN(r)) predictionByDate[row.stay_date] = r;
  });

  if (Object.keys(predictionByDate).length === 0) {
    console.log(
      `[Sentinel] recalculateRates: no DGX predictions in range for hotel ${hotelId}. Nothing to push — DGX will produce on next cycle.`,
    );
    return { totalQueued: 0 };
  }

  // 2. Build guardrail-context (daily min/max + monthly_min_rates + LMF) so
  //    applyGuardrails can clamp predictions consistently with Phase 2.
  const dailyMaxIso = await getDailyMaxRatesIsoMap(hotelId, startDate, endDate);
  const dailyMinIso = await getDailyMinRates(hotelId, startDate, endDate);
  const guardrailConfig = {
    ...config,
    daily_max_rates: dailyMaxIso,
    daily_min_rates: dailyMinIso,
  };

  // 3. Override skip set — pinned dates are off-limits to recalc.
  const overrideDateSet = await getRateOverrideDateSet(hotelId);

  // 4. Fan out predictions across all room types (base + derived via differentials).
  const allOverrides = [];
  for (const room of pmsRoomTypes) {
    const roomTypeId = room.roomTypeID;
    const isBase = String(roomTypeId) === String(baseRoomTypeId);
    const diffRule = differentials.find(
      (r) => String(r.roomTypeId) === String(roomTypeId),
    );

    for (const [dateStr, predRate] of Object.entries(predictionByDate)) {
      if (overrideDateSet.has(dateStr)) continue;

      // Apply guardrails (min / max / freeze) to the DGX prediction.
      // applyGuardrails handles freeze internally — we pass null livePmsRate
      // because frozen dates fall back to resolvedMin which is correct here
      // (we don't want to re-push old PMS values during freeze).
      const guardrailResult = pricingEngine.applyGuardrails(
        predRate,
        null,
        guardrailConfig,
        dateStr,
      );
      if (guardrailResult.isFrozen) continue;

      let finalRate = parseFloat(guardrailResult.finalRate);
      if (isNaN(finalRate) || finalRate <= 0) continue;

      // Apply differential for non-base rooms
      if (!isBase && diffRule) {
        const val = parseFloat(diffRule.value);
        if (diffRule.operator === "+") finalRate *= 1 + val / 100;
        else if (diffRule.operator === "-") finalRate *= 1 - val / 100;
      }

      finalRate = Math.round(finalRate * 100) / 100;
      if (isNaN(finalRate) || finalRate <= 0) continue;

      allOverrides.push({
        date: dateStr,
        room_type_id: roomTypeId,
        rate: finalRate,
        categoryId: isMewsHotel ? roomTypeId : undefined,
      });
    }
  }

  // Write to calendar + queue
  const hotelRes = await db.query(
    "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
    [hotelId],
  );
  const pmsPropertyId = hotelRes.rows[0]?.pms_property_id;
  const rateIdMap = config.rate_id_map || {};
  const batchPayload = [];
  const calHotelIds = [];
  const calDates = [];
  const calRoomTypes = [];
  const calRates = [];

  for (const o of allOverrides) {
    const rateId = rateIdMap[o.room_type_id];
    if (!rateId) continue;

    batchPayload.push({
      rateId,
      date: o.date,
      rate: o.rate,
      categoryId: o.categoryId,
    });

    calHotelIds.push(hotelId);
    calDates.push(o.date);
    calRoomTypes.push(o.room_type_id);
    calRates.push(o.rate);
  }

  // Single UNNEST upsert instead of one INSERT per row. Previously this fired
  // ~2,500 parallel INSERTs via Promise.all, which saturated the pg pool
  // beyond its 10s checkout timeout and failed on big recalcs (hotel 318341
  // Westbourne, 365-day range, 2026-04-20).
  if (calHotelIds.length > 0) {
    // [OVERRIDE v1] Belt-and-braces NOT EXISTS guard — even if the in-memory
    // skip above misses (race window between override save and recalc), the
    // DB-level guard prevents overwriting an override cell with SENTINEL.
    await db.query(
      `INSERT INTO sentinel_rates_calendar (hotel_id, stay_date, room_type_id, rate, source, last_updated_at)
       SELECT t.hid, t.sdate, t.rid, t.rate, 'SENTINEL', NOW()
       FROM UNNEST($1::int[], $2::date[], $3::text[], $4::numeric[]) AS t(hid, sdate, rid, rate)
       WHERE NOT EXISTS (
         SELECT 1 FROM sentinel_rate_overrides o
         WHERE o.hotel_id = t.hid AND o.stay_date = t.sdate
       )
       ON CONFLICT (hotel_id, stay_date, room_type_id) DO UPDATE
       SET rate = EXCLUDED.rate, source = 'SENTINEL', last_updated_at = NOW()`,
      [calHotelIds, calDates, calRoomTypes, calRates],
    );
  }

  let totalQueued = 0;
  if (batchPayload.length > 0) {
    const CHUNK_SIZE = 30;
    for (let i = 0; i < batchPayload.length; i += CHUNK_SIZE) {
      const chunk = batchPayload.slice(i, i + CHUNK_SIZE);
      await db.query(
        `INSERT INTO sentinel_job_queue (hotel_id, payload, status) VALUES ($1, $2, 'PENDING')`,
        [hotelId, JSON.stringify({ pmsPropertyId, rates: chunk })],
      );
    }
    totalQueued = batchPayload.length;
  }

  console.log(
    `[Sentinel] Recalculate complete: ${totalQueued} rates queued for hotel ${hotelId}.`,
  );
  return { totalQueued };
}

/**
 * [OVERRIDE MODEL v1 — see claude/rate-override-implementation.md]
 *
 * Save (upsert) one or more PMS overrides for a hotel.
 * Writes to sentinel_rate_overrides (date-level, base-only), fans out
 * base × differentials to every derived room, and enqueues PMS push jobs.
 *
 * Rules enforced here:
 * - Past dates (stay_date < CURRENT_DATE) are rejected.
 * - Non-positive prices rejected (CHECK at DB level too).
 * - No guardrail clamp — override value goes through verbatim.
 * - Every save triggers an immediate PMS push for base + all derived rooms.
 *
 * @param {number} hotelId
 * @param {Array<{stayDate: string, price: number}>} overrides
 * @param {number|null} userId — the user performing the save (for audit).
 * @returns {Promise<{saved: number, queued: number, rejected: Array}>}
 */
async function saveRateOverrides(hotelId, overrides, userId = null) {
  if (!Array.isArray(overrides) || overrides.length === 0) {
    return { saved: 0, queued: 0, rejected: [] };
  }

  // 1. Load config + hotel metadata
  const config = await getHotelConfig(hotelId);
  if (!config) throw new Error(`No Sentinel configuration for hotel ${hotelId}`);

  const baseRoomTypeId = String(config.base_room_type_id || "");
  const rateIdMap = config.rate_id_map || {};
  const roomDifferentials = config.room_differentials || [];
  if (!baseRoomTypeId) throw new Error("base_room_type_id missing on config");
  if (!rateIdMap || Object.keys(rateIdMap).length === 0) {
    throw new Error("rate_id_map missing — please re-sync the hotel");
  }

  const hotelRes = await db.query(
    "SELECT pms_property_id, pms_type FROM hotels WHERE hotel_id = $1",
    [hotelId],
  );
  const pmsPropertyId = hotelRes.rows[0]?.pms_property_id;
  const isMews = hotelRes.rows[0]?.pms_type === "mews";
  if (!pmsPropertyId) throw new Error(`pms_property_id missing for hotel ${hotelId}`);

  // 2. Validate inputs
  const todayIso = new Date().toISOString().slice(0, 10);
  const validated = [];
  const rejected = [];
  for (const o of overrides) {
    const date = String(o.stayDate || "");
    const price = parseFloat(o.price);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      rejected.push({ date, price, reason: "invalid_date_format" });
      continue;
    }
    if (date < todayIso) {
      rejected.push({ date, price, reason: "past_date" });
      continue;
    }
    if (isNaN(price) || price <= 0) {
      rejected.push({ date, price, reason: "invalid_price" });
      continue;
    }
    validated.push({ date, price });
  }

  if (validated.length === 0) {
    return { saved: 0, queued: 0, rejected };
  }

  // 3. Upsert override rows + log history (old price diff)
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const datesArr = validated.map((v) => v.date);
    const pricesArr = validated.map((v) => v.price);

    const currentRatesRes = await client.query(
      `SELECT stay_date::text AS stay_date, rate
       FROM sentinel_rates_calendar
       WHERE hotel_id = $1 AND room_type_id = $2 AND stay_date = ANY($3::date[])`,
      [hotelId, baseRoomTypeId, datesArr],
    );
    const currentRateMap = {};
    currentRatesRes.rows.forEach((r) => {
      currentRateMap[r.stay_date.split("T")[0]] = parseFloat(r.rate);
    });

    await client.query(
      `INSERT INTO sentinel_rate_overrides
         (hotel_id, stay_date, base_override_price, set_by, updated_by, updated_at)
       SELECT $1::int, t.d::date, t.p::numeric, $2::int, $2::int, NOW()
       FROM UNNEST($3::date[], $4::numeric[]) AS t(d, p)
       ON CONFLICT (hotel_id, stay_date) DO UPDATE
       SET base_override_price = EXCLUDED.base_override_price,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
      [hotelId, userId, datesArr, pricesArr],
    );

    // History ledger (only on actual price change)
    for (const v of validated) {
      const oldRate = currentRateMap[v.date] ?? null;
      if (oldRate !== v.price) {
        await client.query(
          `INSERT INTO sentinel_price_history
             (hotel_id, room_type_id, stay_date, old_price, new_price, source, changed_by, created_at)
           VALUES ($1, $2, $3, $4, $5, 'OVERRIDE', $6, NOW())`,
          [hotelId, baseRoomTypeId, v.date, oldRate, v.price, userId],
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // 4. Fan out base × differentials into a PMS push payload
  const batchPayload = [];
  for (const v of validated) {
    const baseRateId = rateIdMap[baseRoomTypeId];
    if (baseRateId) {
      const entry = { rateId: baseRateId, date: v.date, rate: v.price };
      if (isMews) entry.categoryId = baseRoomTypeId;
      batchPayload.push(entry);
    }

    if (Array.isArray(roomDifferentials)) {
      for (const rule of roomDifferentials) {
        if (!rule || rule.value === undefined) continue;
        if (String(rule.roomTypeId) === baseRoomTypeId) continue;
        const derivedRateId = rateIdMap[rule.roomTypeId];
        if (!derivedRateId) continue;
        const derivedRate = pricingEngine.calculateDifferential(
          v.price,
          rule.roomTypeId,
          roomDifferentials,
        );
        if (derivedRate !== null && derivedRate > 0) {
          const entry = {
            rateId: derivedRateId,
            date: v.date,
            rate: derivedRate,
          };
          if (isMews) entry.categoryId = String(rule.roomTypeId);
          batchPayload.push(entry);
        }
      }
    }
  }

  // 5. Enqueue PMS push (chunked to 25 — Cloudbeds hard cap is 30)
  const BATCH_SIZE = 25;
  let queued = 0;
  for (let i = 0; i < batchPayload.length; i += BATCH_SIZE) {
    const chunk = batchPayload.slice(i, i + BATCH_SIZE);
    await db.query(
      `INSERT INTO sentinel_job_queue (hotel_id, payload, status) VALUES ($1, $2, 'PENDING')`,
      [hotelId, JSON.stringify({ pmsPropertyId, rates: chunk })],
    );
    queued += chunk.length;
  }

  console.log(
    `[Overrides] Saved: hotel=${hotelId} count=${validated.length} queued=${queued} rejected=${rejected.length}`,
  );

  return { saved: validated.length, queued, rejected };
}

/**
 * List overrides for a hotel in a date range.
 * @returns {Promise<Array<{stayDate, basePrice, setBy, setAt, updatedBy, updatedAt}>>}
 */
async function getRateOverrides(hotelId, startDate = null, endDate = null) {
  const params = [hotelId];
  let whereExtra = "";
  if (startDate) {
    params.push(startDate);
    whereExtra += ` AND stay_date >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    whereExtra += ` AND stay_date <= $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT stay_date::text AS stay_date, base_override_price,
            set_by, set_at, updated_by, updated_at
     FROM sentinel_rate_overrides
     WHERE hotel_id = $1${whereExtra}
     ORDER BY stay_date ASC`,
    params,
  );
  return rows.map((r) => ({
    stayDate: r.stay_date.split("T")[0],
    basePrice: parseFloat(r.base_override_price),
    setBy: r.set_by,
    setAt: r.set_at,
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  }));
}

/**
 * Delete overrides for specific dates. Those dates become AI-managed again
 * on the next DGX cycle. No PMS push is triggered on delete — Sentinel's
 * next hourly run will emit whatever rate it chooses.
 */
async function deleteRateOverrides(hotelId, dates, userId = null) {
  if (!Array.isArray(dates) || dates.length === 0) return { deleted: 0 };
  const res = await db.query(
    `DELETE FROM sentinel_rate_overrides
     WHERE hotel_id = $1 AND stay_date = ANY($2::date[])`,
    [hotelId, dates],
  );
  console.log(
    `[Overrides] Cleared: hotel=${hotelId} dates=${dates.length} user=${userId}`,
  );
  return { deleted: res.rowCount };
}

/**
 * Load an override date-set for a hotel over a range of stay_dates.
 * Used by bridge Phase 2 and the PMS-overlay paths to check
 * "does this date have an override?" in O(1).
 * @returns {Promise<Set<string>>} — Set of 'YYYY-MM-DD' strings.
 */
async function getRateOverrideDateSet(hotelId, stayDates = null) {
  let sql = `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d FROM sentinel_rate_overrides WHERE hotel_id = $1`;
  const params = [hotelId];
  if (Array.isArray(stayDates) && stayDates.length > 0) {
    params.push(stayDates);
    sql += ` AND stay_date = ANY($2::date[])`;
  }
  const { rows } = await db.query(sql, params);
  return new Set(rows.map((r) => r.d));
}

/**
 * Load a (hotel_id, date) → price map for multiple hotels. Used by the
 * hourly re-push pass in bridge Phase 2 (one query per fleet slice, not
 * per hotel). Dates are returned as 'YYYY-MM-DD' strings.
 */
async function getRateOverrideMapForHotel(hotelId) {
  const { rows } = await db.query(
    `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d, base_override_price
     FROM sentinel_rate_overrides
     WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE`,
    [hotelId],
  );
  const map = {};
  rows.forEach((r) => {
    map[r.d] = parseFloat(r.base_override_price);
  });
  return map;
}

module.exports = {
  getHotelConfig,
  updateConfig,
  previewCalendar,
  getDailyMaxRates,
  saveDailyMaxRates,
  getDailyMinRates,
  saveDailyMinRates,
  getPaceCurves,
  copyPaceCurves,
  getSentinelStatus,
  buildRateIdMap,
  getRecentJobBatches,
  recalculateRates,
  saveRateOverrides,
  getRateOverrides,
  deleteRateOverrides,
  getRateOverrideDateSet,
  getRateOverrideMapForHotel,
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
