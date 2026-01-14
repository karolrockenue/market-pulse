/**
 * @file sentinel.pricing.engine.js
 * @brief Pure Math Engine for Sentinel Pricing
 * * LOGIC SOURCES:
 * - Waterfall: web/src/features/sentinel/hooks/useRateGrid.ts (calculateSellRate)
 * - Differentials: api/routes/sentinel.router.js (POST /overrides)
 * - Guardrails: web/src/features/sentinel/hooks/useRateGrid.ts (loadRates)
 */

/**
 * Helper: Native date range check to avoid 'date-fns' backend dependency
 */
function isDateInRange(targetDate, start, end) {
  if (!targetDate || !start || !end) return false;
  const t = new Date(targetDate).getTime();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return t >= s && t <= e;
}

/**
 * 1. THE WATERFALL (OTA Sell-Rate Calculator)
 * Calculates the Final Sell Rate based on the Daisy-Chain model.
 * * Logic copied from useRateGrid.ts -> calculateSellRate
 * * @param {number} pmsRate - The live rate from the PMS (or manual base)
 * @param {object} context - { multiplier, campaigns, mobile, nonRef, country, geniusPct, date }
 */
function calculateSellRate(pmsRate, context) {
  // [SAFETY] Return null if input is invalid (never return 0)
  if (
    pmsRate === undefined ||
    pmsRate === null ||
    isNaN(pmsRate) ||
    pmsRate <= 0
  )
    return null;
  if (!context) return null;

  const {
    multiplier = 1.3,
    // [NEW] Tax Settings
    taxType = "inclusive", // 'inclusive' | 'exclusive'
    taxPercent = 0,
    campaigns = [],
    mobileActive = true,
    mobilePercent = 10,
    nonRefundableActive = true,
    nonRefundablePercent = 15,
    countryRateActive = false,
    countryRatePercent = 5,
    geniusPct = 0,
    date, // Date object or string
  } = context;

  const testDate = new Date(date);

  // Level 0: Base
  let currentRate = pmsRate * multiplier;

  // Level 1: Rate Plan Modifier (Non-Ref)
  if (nonRefundableActive) {
    currentRate = currentRate * (1 - Number(nonRefundablePercent) / 100);
  }

  // [NEW] Level 1.5: Tax Injection (USA / Exclusive Mode)
  // Applied AFTER hotel discounts (NonRef) but BEFORE OTA discounts (Genius)
  if (taxType === "exclusive" && taxPercent > 0) {
    currentRate = currentRate * (1 + Number(taxPercent) / 100);
  }

  // Check for "Deep Deal" (Exclusive)
  const deepDeal = campaigns.find(
    (c) =>
      ["black-friday", "limited-time"].includes(c.slug) &&
      isDateInRange(testDate, c.startDate, c.endDate) &&
      c.active
  );

  if (deepDeal) {
    // Exclusive Deal Logic
    currentRate = currentRate * (1 - Number(deepDeal.discount) / 100);
  } else {
    // Level 2: Sequential Discounts

    // A. Genius
    if (geniusPct > 0) {
      currentRate = currentRate * (1 - Number(geniusPct) / 100);
    }

    // B. Standard Campaigns
    const validStandard = campaigns.filter(
      (c) =>
        !["black-friday", "limited-time"].includes(c.slug) &&
        isDateInRange(testDate, c.startDate, c.endDate) &&
        c.active
    );

    if (validStandard.length > 0) {
      // Apply best discount only
      const best = validStandard.reduce((p, c) =>
        p.discount > c.discount ? p : c
      );
      currentRate = currentRate * (1 - Number(best.discount) / 100);
    }

    // C. Mobile Rate
    // Blocked if Deep Deal exists OR specific campaigns are active
    const isMobileBlocked =
      !!deepDeal ||
      validStandard.some((c) =>
        ["early-deal", "late-escape", "getaway-deal"].includes(c.slug)
      );

    if (mobileActive && !isMobileBlocked) {
      currentRate = currentRate * (1 - Number(mobilePercent) / 100);
    }

    // D. Country Rate
    if (countryRateActive) {
      currentRate = currentRate * (1 - Number(countryRatePercent) / 100);
    }
  }

  const final = parseFloat(currentRate.toFixed(2));
  // [SAFETY] Final check to ensure we never return negative or NaN
  return isNaN(final) || final <= 0 ? null : final;
}

/**
 * 2. DIFFERENTIAL ENGINE
 * Calculates derived room rates.
 * * Logic copied from sentinel.router.js -> POST /overrides
 * * @param {number} baseRate - The calculated rate for the Base Room
 * @param {string} targetRoomTypeId - The room type ID we are calculating for
 * @param {Array} roomDifferentials - Array of rules [{ roomTypeId, operator, value }]
 */
function calculateDifferential(baseRate, targetRoomTypeId, roomDifferentials) {
  // [SAFETY] Cascade protection: Invalid base immediately kills derived chain.
  if (
    baseRate === undefined ||
    baseRate === null ||
    isNaN(baseRate) ||
    baseRate <= 0
  ) {
    return null;
  }

  if (!roomDifferentials || !Array.isArray(roomDifferentials)) return baseRate;

  const rule = roomDifferentials.find((r) => r.roomTypeId === targetRoomTypeId);

  // If no rule, or rule is for base room itself, return base rate
  if (!rule || rule.value === undefined) return baseRate;

  const val = parseFloat(rule.value);
  // [SAFETY] If rule value is invalid (NaN), ignore rule and return base
  if (isNaN(val)) return baseRate;

  let newRate = baseRate;

  if (rule.operator === "+") {
    newRate = baseRate * (1 + val / 100);
  } else {
    newRate = baseRate * (1 - val / 100);
  }

  const final = parseFloat(newRate.toFixed(2));
  // [SAFETY] Return null if calculation fails, do not default to baseRate blindly
  return isNaN(final) || final <= 0 ? null : final;
}
/**
 * 3. GUARDRAILS & LOGIC
 * Applies Freeze, Min, Max, and LMF.
 * * Logic copied from useRateGrid.ts -> loadRates
 * * @param {number} suggestedRate - The AI calculated rate
 * @param {number} livePmsRate - The current rate in PMS
 * @param {object} config - { last_minute_floor, monthly_min_rates, rate_freeze_period, guardrail_max }
 * @param {string|Date} date - The date being calculated
 */
function applyGuardrails(suggestedRate, livePmsRate, config, date) {
  const targetDate = new Date(date);
  const today = new Date();

  // [FIX] Normalize dates using UTC components explicitly.
  // Using .getFullYear()/.getDate() is unsafe as it uses Local Server Time.
  const utcTarget = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate()
    )
  );

  // Normalize Today to UTC Midnight as well for accurate "Days Out" calculation
  const utcToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  // Calculate days from now (0 = today)
  const diffTime = Math.abs(utcTarget - utcToday);
  const daysFromNow = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const {
    last_minute_floor = {},
    monthly_min_rates = {},
    rate_freeze_period = "0",
    guardrail_max = "400",
  } = config;

  // A. MONTHLY MIN RATE (Calculated early for fallback usage)
  const monthNames = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const monthKey = monthNames[utcTarget.getUTCMonth()];
  const monthlyMin = parseFloat(monthly_min_rates[monthKey] || "0");

  // B. FREEZE LOGIC
  // If freezePeriod > 0, we freeze days 0 to N-1
  const freezeDays = parseInt(rate_freeze_period, 10);
  const isFrozen = freezeDays > 0 && daysFromNow < freezeDays;

  if (isFrozen) {
    // [CRITICAL FIX] If Live Rate is INVALID (<=0), DO NOT return 0.
    // Fallback to monthlyMin or suggestedRate to prevent accidental zero-out.
    if (!livePmsRate || isNaN(livePmsRate) || livePmsRate <= 0) {
      return {
        finalRate: monthlyMin > 0 ? monthlyMin : suggestedRate,
        isFrozen: true,
        reason: "FROZEN_FALLBACK",
      };
    }
    return {
      finalRate: livePmsRate,
      isFrozen: true,
      reason: "FROZEN",
    };
  }

  // B. LAST MINUTE FLOOR (LMF)
  const lmfEnabled = last_minute_floor.enabled || false;
  const lmfDays = parseInt(last_minute_floor.days || "0", 10);
  const lmfRate = parseFloat(last_minute_floor.rate || "0");
  const lmfDow = new Set(last_minute_floor.dow || []);

  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dowStr = dayNames[utcTarget.getUTCDay()];

  let effectiveRate = suggestedRate;
  let activeFloor = false;
  let activeMinToEnforce = monthlyMin; // Default to standard min

  if (lmfEnabled && daysFromNow <= lmfDays && lmfDow.has(dowStr)) {
    // [FIX] Priority Logic:
    // If LMF is active, it REPLACES the Monthly Minimum for this specific day.
    // This allows the rate to DROP below the standard min (e.g. 100) to the floor (e.g. 60).
    activeMinToEnforce = lmfRate;
    activeFloor = true;
  }

  // Apply the Determined Minimum (Either Standard Min OR LMF)
  if (effectiveRate < activeMinToEnforce) {
    effectiveRate = activeMinToEnforce;
  }

  // D. MAX RATE LOGIC (Daily Override > Global Max)
  const { daily_max_rates = {} } = config;

  let activeMax = parseFloat(guardrail_max); // Default to global
  // Normalize dateStr for lookup
  const dateStr = utcTarget.toISOString().split("T")[0];

  // Check for specific daily max
  if (daily_max_rates && daily_max_rates[dateStr]) {
    const dailyVal = parseFloat(daily_max_rates[dateStr]);
    if (!isNaN(dailyVal) && dailyVal > 0) {
      activeMax = dailyVal;
    }
  }

  // Apply Max
  if (activeMax > 0 && effectiveRate > activeMax) {
    effectiveRate = activeMax;
  }

  return {
    finalRate: parseFloat(effectiveRate.toFixed(2)),
    isFrozen: false,
    isFloorActive: activeFloor,
    minApplied: activeMinToEnforce, // [DEBUG] Shows which floor won
    maxApplied: activeMax,
    reason: "CALCULATED",
  };
}

module.exports = {
  calculateSellRate,
  calculateDifferential,
  applyGuardrails,
  isDateInRange,
};
