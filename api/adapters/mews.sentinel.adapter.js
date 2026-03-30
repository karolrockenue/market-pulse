/**
 * @file mews.sentinel.adapter.js
 * @brief Sentinel AI Adapter for Mews PMS
 *
 * Mirrors the interface of sentinel.adapter.js (Cloudbeds) but calls Mews endpoints.
 * This file is the ONLY place that knows how to read/write rates in Mews.
 *
 * Phase 3: getRates, getRoomTypes, getRatePlans (READ)
 * Phase 4: postRateBatch (WRITE)
 *
 * ARCHITECTURE:
 * - Uses mewsAdapter.getCredentials() for auth (ClientToken from env, AccessToken from DB)
 * - Uses mewsAdapter._callMewsApi() for all API calls
 * - Uses mewsAdapter.toMewsUtc() for timezone conversions
 * - Sentinel services call this via pmsRegistry.getSentinelAdapter('mews')
 */

const pgPool = require("../utils/db");
const mewsAdapter = require("./mewsAdapter");

// ─── Helper: Get hotel's stored config ─────────────────────────────

/**
 * Fetches the hotel's pms_credentials and pms_property_id from the DB.
 * Returns everything needed to make Mews API calls for this hotel.
 *
 * @param {number|string} hotelId - Internal DB hotel ID
 * @returns {Promise<{credentials: object, pmsPropertyId: string, serviceId: string, timezone: string}>}
 */
async function getHotelContext(hotelId) {
  const result = await pgPool.query(
    `SELECT pms_property_id, pms_credentials FROM hotels WHERE hotel_id = $1 AND pms_type = 'mews'`,
    [hotelId],
  );

  if (result.rows.length === 0) {
    throw new Error(
      `[Mews Sentinel] No Mews hotel found with hotel_id ${hotelId}`,
    );
  }

  const row = result.rows[0];
  const pmsCreds = row.pms_credentials;

  if (!pmsCreds || !pmsCreds.accessToken) {
    throw new Error(
      `[Mews Sentinel] Missing accessToken in pms_credentials for hotel ${hotelId}`,
    );
  }

  if (!pmsCreds.serviceId) {
    throw new Error(
      `[Mews Sentinel] Missing serviceId in pms_credentials for hotel ${hotelId}. Re-onboard the property.`,
    );
  }

  return {
    credentials: await mewsAdapter.getCredentials(hotelId),
    pmsPropertyId: row.pms_property_id,
    serviceId: pmsCreds.serviceId,
    timezone: pmsCreds.timezone || "UTC",
  };
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 3: READ OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetches live rates for a specific room type (resource category) over a date range.
 * This is the Mews equivalent of sentinel.adapter.getRates().
 *
 * Mews returns prices via rates/getPricing which gives:
 *   - BaseAmountPrices (base price per day)
 *   - CategoryPrices (price per category per day)
 *   - TimeUnitStartsUtc (dates array, parallel to prices)
 *
 * @param {number|string} hotelId - Internal DB hotel ID
 * @param {string} pmsPropertyId - Enterprise UUID (not used for Mews API calls, but kept for interface compat)
 * @param {string} roomTypeId - ResourceCategory UUID
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<object>} Cloudbeds-compatible response: { success: true, data: { roomRateDetailed: [...] } }
 */
async function getRates(
  hotelId,
  pmsPropertyId,
  roomTypeId,
  startDate,
  endDate,
) {
  console.log(
    `[Mews Sentinel] Fetching Live Rates for hotel ${hotelId} (Room: ${roomTypeId})`,
  );

  const ctx = await getHotelContext(hotelId);

  // Find the root rate ID from sentinel_configurations.rate_id_map
  const configResult = await pgPool.query(
    "SELECT rate_id_map FROM sentinel_configurations WHERE hotel_id = $1",
    [hotelId],
  );
  const rateIdMap = configResult.rows[0]?.rate_id_map || {};
  const rateId = rateIdMap[roomTypeId];

  if (!rateId) {
    console.warn(
      `[Mews Sentinel] No rate mapping found for room ${roomTypeId} in hotel ${hotelId}`,
    );
    return { success: true, data: { roomRateDetailed: [] } };
  }

  // Mews getPricing supports max 367 days. Split if needed.
  const allRates = [];
  let chunkStart = new Date(startDate);
  const finalEnd = new Date(endDate);

  while (chunkStart <= finalEnd) {
    let chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + 364); // 365 days max per chunk
    if (chunkEnd > finalEnd) chunkEnd = finalEnd;

    const chunkStartStr = chunkStart.toISOString().split("T")[0];
    const chunkEndStr = chunkEnd.toISOString().split("T")[0];

    const pricingData = await mewsAdapter._callMewsApi(
      "rates/getPricing",
      ctx.credentials,
      {
        RateId: rateId,
        FirstTimeUnitStartUtc: mewsAdapter.toMewsUtc(
          chunkStartStr,
          ctx.timezone,
        ),
        LastTimeUnitStartUtc: mewsAdapter.toMewsUtc(chunkEndStr, ctx.timezone),
      },
    );

    const timeUnits = pricingData.TimeUnitStartsUtc || [];

    // Try to find category-specific pricing for this room type
    const categoryPricing = (pricingData.CategoryPrices || []).find(
      (cp) => cp.CategoryId === roomTypeId,
    );

    // Use category pricing if available, otherwise fall back to base prices
    const prices = categoryPricing
      ? categoryPricing.AmountPrices
      : pricingData.BaseAmountPrices || [];

    timeUnits.forEach((utcStr, index) => {
      const date = new Date(utcStr).toISOString().split("T")[0];
      const priceObj = prices[index];

      if (priceObj) {
        allRates.push({
          date,
          rate: priceObj.GrossValue || priceObj.NetValue || 0,
          netRate: priceObj.NetValue || 0,
          grossRate: priceObj.GrossValue || 0,
          roomTypeID: roomTypeId,
          ratePlanID: rateId,
        });
      }
    });

    // Advance to next chunk
    chunkStart = new Date(chunkEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }

  // Deduplicate by date (chunk boundaries can overlap due to timezone conversion)
  const seen = new Set();
  const dedupedRates = allRates.filter((r) => {
    if (seen.has(r.date)) return false;
    seen.add(r.date);
    return true;
  });

  // Return in Cloudbeds-compatible format so sentinel.service.previewCalendar works
  return {
    success: true,
    data: {
      roomRateDetailed: dedupedRates,
    },
  };
}

/**
 * Fetches room types (resource categories) for a Mews hotel.
 * Mews equivalent of sentinel.adapter.getRoomTypes().
 *
 * @param {number|string} hotelId
 * @param {string} pmsPropertyId - Not used for Mews, kept for interface compat
 * @returns {Promise<object>} Cloudbeds-compatible: { success: true, data: [...] }
 */
async function getRoomTypes(hotelId, pmsPropertyId) {
  console.log(`[Mews Sentinel] Fetching Room Types for hotel ${hotelId}`);

  const ctx = await getHotelContext(hotelId);
  const categories = await mewsAdapter.getResourceCategories(
    ctx.credentials,
    ctx.serviceId,
  );

  return {
    success: true,
    data: categories.map((cat) => ({
      roomTypeID: cat.roomTypeID,
      roomTypeName: cat.roomTypeName,
      maxGuests: cat.capacity,
    })),
  };
}

/**
 * Fetches rate plans for a Mews hotel.
 * Mews equivalent of sentinel.adapter.getRatePlans().
 *
 * @param {number|string} hotelId
 * @param {string} pmsPropertyId - Not used for Mews, kept for interface compat
 * @returns {Promise<object>} Cloudbeds-compatible: { success: true, data: [...] }
 */
async function getRatePlans(hotelId, pmsPropertyId) {
  console.log(`[Mews Sentinel] Fetching Rate Plans for hotel ${hotelId}`);

  const ctx = await getHotelContext(hotelId);
  const plans = await mewsAdapter.getRatePlans(ctx.credentials, ctx.serviceId);

  return {
    success: true,
    data: plans.map((p) => ({
      rateID: p.rateID,
      ratePlanName: p.ratePlanName,
      roomTypeID: null, // Mews rates are not per-room-type, they apply to all categories
      isDerived: p.isDerived,
      isActive: p.isActive,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 4: WRITE OPERATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Posts a BATCH of rate updates to Mews.
 * Mews equivalent of sentinel.adapter.postRateBatch().
 *
 * Converts the Sentinel payload format [{rateId, date, rate}] into
 * Mews rates/updatePrice calls.
 *
 * Key differences from Cloudbeds:
 * - Mews groups updates by RateId (one API call per unique rate)
 * - Dates must be converted to UTC time unit starts
 * - Max 1000 PriceUpdates per call
 *
 * @param {number|string} hotelId - Internal DB hotel ID
 * @param {string} pmsPropertyId - Enterprise UUID (not used in API call)
 * @param {Array} ratesArray - Array of { rateId, date, rate }
 * @returns {Promise<object>} { success: true, message: string }
 */
async function postRateBatch(hotelId, pmsPropertyId, ratesArray) {
  console.log(
    `[Mews Sentinel] Batch posting ${ratesArray.length} rates for hotel ${hotelId}`,
  );

  if (!ratesArray || ratesArray.length === 0) {
    return { success: true, message: "No rates to post." };
  }

  const ctx = await getHotelContext(hotelId);

  // [SAFETY] Filter out invalid rates
  const safeRates = ratesArray.filter((item) => {
    const numRate = Number(item.rate);
    if (
      item.rate === undefined ||
      item.rate === null ||
      isNaN(numRate) ||
      numRate <= 0
    ) {
      console.warn(
        `[Mews Sentinel] SKIPPING invalid rate: Date ${item.date}, Rate ${item.rate}`,
      );
      return false;
    }
    return true;
  });

  if (safeRates.length === 0) {
    console.warn(
      "[Mews Sentinel] Batch empty after safety filtering. Nothing to send.",
    );
    return {
      success: true,
      message: "All rates filtered out by safety checks.",
    };
  }

  // Group by rateId (Mews requires one updatePrice call per Rate)
  const grouped = {};
  safeRates.forEach((item) => {
    if (!grouped[item.rateId]) {
      grouped[item.rateId] = [];
    }
    grouped[item.rateId].push(item);
  });

  let totalPushed = 0;

  for (const [rateId, items] of Object.entries(grouped)) {
    // Build PriceUpdates array for this rate
    // Each item becomes a single-day price update
    const priceUpdates = items.map((item) => {
      const utcStart = mewsAdapter.toMewsUtc(item.date, ctx.timezone);
      const update = {
        FirstTimeUnitStartUtc: utcStart,
        LastTimeUnitStartUtc: utcStart, // Same day = single time unit
        Value: Number(item.rate),
      };
      // If categoryId is provided (Mews per-category pricing), include it
      if (item.categoryId) {
        update.CategoryId = item.categoryId;
      }
      return update;
    });

    // Mews allows max 1000 PriceUpdates per call — chunk if needed
    const CHUNK_SIZE = 1000;

    for (let i = 0; i < priceUpdates.length; i += CHUNK_SIZE) {
      const chunk = priceUpdates.slice(i, i + CHUNK_SIZE);

      console.log(
        `[Mews Sentinel] Pushing ${chunk.length} price updates for Rate ${rateId}`,
      );

      console.log(
        `[Mews Debug] postRateBatch credentials:`,
        JSON.stringify({
          clientToken: ctx.credentials.clientToken?.substring(0, 8),
          accessToken: ctx.credentials.accessToken?.substring(0, 8),
          client: ctx.credentials.client,
        }),
      );
      await mewsAdapter._callMewsApi("rates/updatePrice", ctx.credentials, {
        RateId: rateId,
        PriceUpdates: chunk,
      });

      totalPushed += chunk.length;
    }
  }

  console.log(
    `[Mews Sentinel] Successfully pushed ${totalPushed} rate updates to Mews`,
  );

  return {
    success: true,
    message: `Pushed ${totalPushed} rates to Mews.`,
    totalPushed,
  };
}

/**
 * Posts a single rate update to Mews.
 * Convenience wrapper around postRateBatch for single updates.
 *
 * @param {number|string} hotelId
 * @param {string} pmsPropertyId
 * @param {string} rateId - The Mews Rate UUID
 * @param {string} date - YYYY-MM-DD
 * @param {number} rate - The price to set
 * @returns {Promise<object>}
 */
async function postRate(hotelId, pmsPropertyId, rateId, date, rate) {
  // [SAFETY] Validate
  if (rate === undefined || rate === null || isNaN(rate) || Number(rate) <= 0) {
    console.warn(
      `[Mews Sentinel] ABORTING postRate: Invalid rate value (${rate}) for ${date}`,
    );
    throw new Error(
      `Mews Sentinel Safety: Attempted to push invalid rate (${rate}) to PMS.`,
    );
  }

  return postRateBatch(hotelId, pmsPropertyId, [{ rateId, date, rate }]);
}

/**
 * Placeholder for job status check.
 * Mews rate updates are synchronous (no job queue on their side),
 * so this always returns success.
 *
 * @param {number|string} hotelId
 * @param {string} pmsPropertyId
 * @param {string} jobId
 * @returns {Promise<object>}
 */
async function getJobStatus(hotelId, pmsPropertyId, jobId) {
  // Mews rate updates are synchronous — no job polling needed
  return {
    success: true,
    message: "Mews rate updates are synchronous. No job status to check.",
  };
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORTS — Mirrors sentinel.adapter.js interface exactly
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Phase 3: Reads
  getRates,
  getRoomTypes,
  getRatePlans,

  // Phase 4: Writes
  postRate,
  postRateBatch,
  getJobStatus,
};
