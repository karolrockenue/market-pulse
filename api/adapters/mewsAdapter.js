/**
 * @file mewsAdapter.js
 * @brief Core Mews PMS Adapter (Full Rewrite)
 *
 * ARCHITECTURE:
 * - ClientToken: from env (MEWS_CLIENT_TOKEN) — shared across all Mews properties
 * - AccessToken: from DB per hotel (hotels.pms_credentials.accessToken)
 * - API URL: from env (MEWS_API_URL) — defaults to demo
 *
 * This file handles:
 *   Phase 1: Configuration, services, resource categories, rates (onboarding)
 *   Phase 2: Occupancy + revenue metrics (daily-refresh)
 *
 * Sentinel-specific rate reads/writes live in mews.sentinel.adapter.js (Phase 3-4).
 */

const axios = require("axios");
const { fromZonedTime } = require("date-fns-tz");
const pgPool = require("../utils/db");

// ─── Environment ───────────────────────────────────────────────────
const MEWS_API_URL = process.env.MEWS_API_URL || "https://api.mews-demo.com";
const MEWS_CLIENT_TOKEN = process.env.MEWS_CLIENT_TOKEN;
const MEWS_CLIENT_NAME = "Rockenue MarketPulse 1.0.0";

// ─── Credential Helpers ────────────────────────────────────────────

/**
 * Fetches the per-hotel Mews credentials from the database.
 * Returns { clientToken, accessToken, client } ready for API calls.
 *
 * @param {number|string} hotelId - Internal DB hotel ID
 * @returns {Promise<{clientToken: string, accessToken: string, client: string}>}
 */
async function getCredentials(hotelId) {
  const result = await pgPool.query(
    `SELECT pms_credentials FROM hotels WHERE hotel_id = $1 AND pms_type = 'mews'`,
    [hotelId],
  );

  if (result.rows.length === 0) {
    throw new Error(`[Mews] No Mews hotel found with hotel_id ${hotelId}`);
  }

  const creds = result.rows[0].pms_credentials;
  if (!creds || !creds.accessToken) {
    throw new Error(
      `[Mews] Missing accessToken in pms_credentials for hotel ${hotelId}`,
    );
  }

  return {
    clientToken: MEWS_CLIENT_TOKEN,
    accessToken: creds.accessToken,
    client: MEWS_CLIENT_NAME,
  };
}

// ─── Core API Caller ───────────────────────────────────────────────

/**
 * Makes authenticated POST requests to the Mews Connector API.
 * All Mews endpoints are POST (even reads).
 *
 * @param {string} endpoint - e.g. 'configuration/get'
 * @param {object} credentials - { clientToken, accessToken, client }
 * @param {object} [data={}] - Additional request body fields
 * @returns {Promise<object>} - Parsed response data
 */
async function _callMewsApi(endpoint, credentials, data = {}) {
  const url = `${MEWS_API_URL}/api/connector/v1/${endpoint}`;

  const body = {
    ClientToken: credentials.clientToken,
    AccessToken: credentials.accessToken,
    Client: credentials.client,
    ...data,
  };

  console.log(
    `[Mews Debug] ClientToken starts: ${body.ClientToken?.substring(0, 8)} | Endpoint: ${endpoint}`,
  );

  const MAX_RETRIES = 4;
  // Transient statuses worth retrying:
  //   429  rate limit · 408 request timeout · 401 stale token
  //   502/503/504 Cloudflare/edge transient · 520-524 Cloudflare-origin errors
  const RETRYABLE = new Set([429, 408, 401, 502, 503, 504, 520, 521, 522, 523, 524]);
  // Mews serializes writes per-rate. When a prior rates/updatePrice call is
  // still finalizing on their side, concurrent writes hit a 403 with the
  // body message "Conflicting operation is being performed at this time".
  // Retry with a longer backoff — Mews explicitly asks for "a few seconds".
  // Only this specific 403 is retried; auth/permission 403s still fail fast.
  const CONFLICT_RE = /conflicting operation/i;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const isNetErr = !error.response;
      const mewsMsg = error.response?.data?.Message || "";
      const isConflict = status === 403 && CONFLICT_RE.test(mewsMsg);

      if ((RETRYABLE.has(status) || isNetErr || isConflict) && attempt < MAX_RETRIES) {
        let retryAfter;
        if (status === 429) {
          retryAfter = parseInt(error.response.headers["retry-after"] || "5", 10);
        } else if (isConflict) {
          retryAfter = Math.min(30, 3 * Math.pow(2, attempt - 1)); // 3, 6, 12, 24
        } else {
          retryAfter = Math.min(30, Math.pow(2, attempt)); // 2, 4, 8, 16, capped at 30s
        }

        console.warn(
          `[Mews API] ${status || "network error"}${isConflict ? " (Conflicting operation)" : ""} on ${endpoint} — retry ${attempt}/${MAX_RETRIES} after ${retryAfter}s`,
        );

        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      // Build a concise error message (Cloudflare responds with ~8kb of HTML
      // that is useless in logs and poisons any UI toast).
      let errorMessage;
      if (error.response) {
        const raw = error.response.data;
        if (typeof raw === "string" && raw.includes("<html")) {
          errorMessage = `HTTP ${status} (HTML response, truncated)`;
        } else {
          try {
            errorMessage = JSON.stringify(raw).slice(0, 400);
          } catch {
            errorMessage = `HTTP ${status}`;
          }
        }
      } else {
        errorMessage = error.message;
      }

      const maskedAccess = credentials.accessToken
        ? `${credentials.accessToken.substring(0, 4)}...${credentials.accessToken.slice(-4)}`
        : "N/A";

      console.error("--- MEWS API CALL FAILED ---");
      console.error(`Endpoint: ${endpoint}`);
      console.error(`Access Token (Masked): ${maskedAccess}`);
      console.error(`Status: ${status || "No response"}`);
      console.error(`Error: ${errorMessage}`);
      console.error(`Attempt: ${attempt}/${MAX_RETRIES}`);
      console.error("----------------------------");

      throw new Error(`Mews API (${endpoint}) failed: ${errorMessage}`);
    }
  }
}

// ─── Timezone Helper ───────────────────────────────────────────────

/**
 * Converts a local date string (YYYY-MM-DD) to the UTC timestamp
 * that represents midnight in the given timezone.
 * Mews requires UTC timestamps for all date parameters.
 *
 * @param {string} dateString - e.g. '2026-01-15'
 * @param {string} timezone - IANA timezone, e.g. 'Europe/Budapest'
 * @returns {string} ISO 8601 UTC string, e.g. '2026-01-14T23:00:00.000Z'
 */
function toMewsUtc(dateString, timezone) {
  const localMidnight = `${dateString}T00:00:00`;
  const utcDate = fromZonedTime(localMidnight, timezone);
  return utcDate.toISOString();
}

/**
 * Inverse of toMewsUtc: takes a Mews UTC timestamp (or ISO string) and
 * returns the YYYY-MM-DD date it represents in the hotel's local timezone.
 *
 * IMPORTANT: do NOT use `new Date(utc).toISOString().split('T')[0]` — during
 * BST (or any non-UTC zone) a local-midnight timestamp like
 * `2026-04-16T23:00:00Z` resolves to the UTC date 2026-04-16, but the stay
 * night it represents in London is 2026-04-17. Every downstream consumer
 * that uses UTC-date slicing ends up with rows labelled one day off.
 *
 * @param {string} utcStr ISO-8601 UTC timestamp
 * @param {string} timezone IANA timezone, e.g. 'Europe/London'
 * @returns {string} 'YYYY-MM-DD' in the given timezone
 */
function utcToLocalDate(utcStr, timezone) {
  // 'en-CA' locale reliably formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcStr));
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 1: CONFIGURATION & ONBOARDING
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetches property configuration from Mews and maps to our canonical format.
 *
 * @param {object} credentials - { clientToken, accessToken, client }
 * @returns {Promise<object>} Standardized hotel details
 */
async function getHotelDetails(credentials) {
  const response = await _callMewsApi("configuration/get", credentials);
  const e = response.Enterprise;

  // Find default currency
  const defaultCurrency = e.Currencies
    ? e.Currencies.find((c) => c.IsDefault === true)
    : null;

  // Derive tax defaults from country
  const countryCode = e.Address?.CountryCode || null;
  let taxRate = null;
  let taxType = null;
  let taxName = null;
  if (countryCode === "GB") {
    taxRate = 0.20; taxType = "inclusive"; taxName = "VAT";
  } else if (countryCode === "US") {
    taxRate = 0.13; taxType = "inclusive"; taxName = "TAX";
  }

  return {
    id: e.Id,
    propertyName: e.Name,
    city: e.Address?.City || null,
    currencyCode: defaultCurrency ? defaultCurrency.Currency : null,
    latitude: e.Address?.Latitude || null,
    longitude: e.Address?.Longitude || null,
    timezone: e.TimeZoneIdentifier,
    address_1: e.Address?.Line1 || null,
    address_2: e.Address?.Line2 || null,
    zip_postal_code: e.Address?.PostalCode || null,
    country: countryCode,
    neighborhood: e.Address?.Line2 || e.Address?.SubdivisionCode || null,
    taxRate,
    taxType,
    taxName,
    pmsType: "mews",
  };
}

/**
 * Finds the Accommodation (Reservable) service ID.
 * This ID is required for availability, reservation, and rate queries.
 *
 * @param {object} credentials
 * @returns {Promise<string>} The Service UUID
 */
async function getAccommodationServiceId(credentials) {
  const response = await _callMewsApi("services/getAll", credentials);

  const reservable = response.Services.filter(
    (s) => s.Type === "Reservable" && s.IsActive === true,
  );

  // Log all candidates for debugging
  reservable.forEach((s) => {
    console.log(`[Mews] Service candidate: "${s.Name}" | StartTime: ${s.StartTime} | ID: ${s.Id}`);
  });

  if (reservable.length === 0) {
    throw new Error(
      "[Mews] Could not find an active Reservable service for this property.",
    );
  }

  // Prefer services that aren't archived/disabled, and prefer daily (midnight start) over mid-stay
  const service =
    reservable.find((s) => {
      const name = (s.Name || "").toLowerCase();
      return !name.includes("archive") && !name.includes("do not use");
    }) || reservable[0];

  console.log(`[Mews] Selected service: "${service.Name}" | StartTime: ${service.StartTime} | ID: ${service.Id}`);
  return service.Id;
}

/**
 * Fetches resource categories (= room types) for the property.
 * Uses the dedicated resourceCategories/getAll endpoint.
 *
 * @param {object} credentials
 * @param {string} serviceId - The Reservable service UUID
 * @returns {Promise<Array>} Array of { roomTypeID, roomTypeName, capacity }
 */
async function getResourceCategories(credentials, serviceId) {
  const response = await _callMewsApi(
    "resourceCategories/getAll",
    credentials,
    {
      ServiceIds: [serviceId],
      ActivityStates: ["Active"],
      Limitation: { Count: 1000 },
    },
  );

  const categories = response.ResourceCategories || [];

  if (categories.length === 0) {
    console.warn(
      "[Mews] No ResourceCategories returned from resourceCategories/getAll.",
    );
  }

  return categories.map((cat) => {
    // Names is a localized object like { "en-US": "Double Room" }
    // Pick the first available name
    const names = cat.Names || {};
    const name =
      names["en-US"] ||
      names["en"] ||
      Object.values(names)[0] ||
      cat.ShortNames?.["en-US"] ||
      "Unnamed";

    return {
      roomTypeID: cat.Id,
      roomTypeName: name,
      capacity: cat.Capacity || 0,
      _mewsRaw: {
        Id: cat.Id,
        Names: cat.Names,
        ShortNames: cat.ShortNames,
        Type: cat.Type,
        Capacity: cat.Capacity,
        ExtraCapacity: cat.ExtraCapacity,
        IsActive: cat.IsActive,
        Ordering: cat.Ordering,
      },
    };
  });
}

/**
 * Fetches the total number of bookable resources (rooms/spaces) for a service.
 * Uses services/getAvailability on a far-future date where no bookings exist,
 * so available count = total capacity.
 */
async function getResourceCount(credentials, serviceId, timezone) {
  // Pick a date ~11 months out where occupancy should be zero
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 11);
  const dateStr = futureDate.toISOString().split("T")[0];

  const availData = await _callMewsApi("services/getAvailability", credentials, {
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: toMewsUtc(dateStr, timezone),
    LastTimeUnitStartUtc: toMewsUtc(dateStr, timezone),
  });

  let totalCapacity = 0;
  const categories = availData.CategoryAvailabilities || [];
  categories.forEach((cat) => {
    totalCapacity += cat.Availabilities?.[0] || 0;
  });

  console.log(`[Mews] Resource count for service ${serviceId}: ${totalCapacity} spaces (from availability on ${dateStr})`);
  return totalCapacity;
}

/**
 * Fetches all rate plans for the accommodation service.
 * Maps to a shape compatible with our sentinel_configurations.pms_rate_plans.
 *
 * @param {object} credentials
 * @param {string} serviceId - The Reservable service UUID
 * @returns {Promise<Array>} Array of { rateID, ratePlanName, isBase, baseRateId, ... }
 */
async function getRatePlans(credentials, serviceId) {
  const response = await _callMewsApi("rates/getAll", credentials, {
    ServiceIds: [serviceId],
    Extent: {
      Rates: true,
      RateGroups: true,
      RateRestrictions: false,
    },
  });

  const rates = response.Rates || [];

  return rates
    .filter((r) => r.IsActive && r.IsEnabled)
    .map((r) => ({
      rateID: r.Id,
      ratePlanName: r.Name || r.ShortName || "Unnamed Rate",
      isDerived: r.BaseRateId !== null,
      baseRateId: r.BaseRateId,
      isActive: r.IsActive,
      isEnabled: r.IsEnabled,
      isPublic: r.IsPublic,
      type: r.Type,
      externalIdentifier: r.ExternalIdentifier || null,
      // Preserve raw for debugging
      _mewsRaw: {
        Id: r.Id,
        Name: r.Name,
        BaseRateId: r.BaseRateId,
        GroupId: r.GroupId,
        ServiceId: r.ServiceId,
      },
    }));
}

/**
 * Builds the Mews-specific Rate ID Map for Sentinel.
 * In Mews, we need to find root rates (BaseRateId = null) for each resource category.
 *
 * For Cloudbeds: rate_id_map = { roomTypeID: rateID }
 * For Mews:     rate_id_map = { resourceCategoryId: rootRateId }
 *
 * Since Mews rates are not inherently per-category (a rate applies to ALL categories
 * unless category-specific pricing is set), the map stores the single root rate ID
 * that Sentinel will use for price updates.
 *
 * @param {Array} ratePlans - Output of getRatePlans()
 * @param {Array} resourceCategories - Output of getResourceCategories()
 * @returns {object} { [resourceCategoryId]: rootRateId }
 */
function buildMewsRateIdMap(ratePlans, resourceCategories) {
  // Find root rates (not derived from another rate)
  const rootRates = ratePlans.filter((r) => !r.isDerived);

  if (rootRates.length === 0) {
    console.warn("[Mews] No root rate plans found. Rate ID map will be empty.");
    return {};
  }

  // Prioritize: Public > Private, then by name keywords
  const bestRoot =
    rootRates.find((r) => {
      const name = (r.ratePlanName || "").toLowerCase();
      return (
        name.includes("base") ||
        name.includes("standard") ||
        name.includes("rack") ||
        name.includes("bar")
      );
    }) ||
    rootRates.find((r) => r.isPublic) ||
    rootRates[0];

  console.log(
    `[Mews] Selected root rate: "${bestRoot.ratePlanName}" (${bestRoot.rateID})`,
  );

  // Map every resource category to this root rate
  const rateIdMap = {};
  for (const cat of resourceCategories) {
    rateIdMap[cat.roomTypeID] = bestRoot.rateID;
  }

  return rateIdMap;
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE 2: METRICS (Occupancy + Revenue)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetches daily occupancy metrics for a date range.
 *
 * Uses services/getAvailability which returns TRUE sellable rooms per day,
 * accounting for ALL services (Short Stay, Mid Stay, etc.), out-of-order,
 * and maintenance blocks. Capacity is derived from a single far-future
 * availability probe (no bookings = all rooms available).
 *
 * occupied = capacity − available  (not reservation counting)
 *
 * This fixes multi-service properties (e.g. Westbourne Park) where rooms
 * blocked by a second Mews service were invisible to the old reservation-
 * counting approach, causing Sentinel to see ~50% when the hotel was 95% full.
 *
 * @param {object} credentials
 * @param {string} serviceId - Reservable service UUID
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string} timezone - IANA timezone
 * @param {number} [cachedCapacity] - Pre-probed capacity to skip redundant API call
 * @returns {Promise<Array>} Array of { date, occupied, available }
 */
async function getOccupancyMetrics(
  credentials,
  serviceId,
  startDate,
  endDate,
  timezone,
  cachedCapacity,
) {
  // 1. Get true availability for the requested date range
  const firstUtc = toMewsUtc(startDate, timezone);
  const lastUtc = toMewsUtc(endDate, timezone);
  console.log(`[Mews Availability] Service: ${serviceId} | First: ${firstUtc} | Last: ${lastUtc} | TZ: ${timezone}`);
  const availabilityData = await _callMewsApi(
    "services/getAvailability",
    credentials,
    {
      ServiceId: serviceId,
      FirstTimeUnitStartUtc: firstUtc,
      LastTimeUnitStartUtc: lastUtc,
    },
  );

  // 2. Get physical capacity (skip probe if caller already has it)
  let totalCapacity = cachedCapacity || 0;
  if (!totalCapacity) {
    const capacityProbeDate = "2027-12-01T00:00:00Z";
    const capacityProbeEnd = "2027-12-02T00:00:00Z";
    const capacityData = await _callMewsApi(
      "services/getAvailability",
      credentials,
      {
        ServiceId: serviceId,
        FirstTimeUnitStartUtc: capacityProbeDate,
        LastTimeUnitStartUtc: capacityProbeEnd,
      },
    );

    (capacityData.CategoryAvailabilities || []).forEach((cat) => {
      totalCapacity += cat.Availabilities?.[0] || 0;
    });
  }
  console.log(`[Mews Capacity] Total physical capacity: ${totalCapacity} rooms`);

  // 3. Build daily metrics from availability
  const dailyMetrics = {};
  const timeUnits = availabilityData.TimeUnitStartsUtc || [];

  timeUnits.forEach((utcStr, index) => {
    // Convert via hotel timezone — UTC-date slicing shifts every row off
    // by one day during BST (midnight local = 23:00 UTC prev day).
    const date = utcToLocalDate(utcStr, timezone);
    let availableRooms = 0;

    const categories = availabilityData.CategoryAvailabilities || [];
    categories.forEach((cat) => {
      availableRooms += cat.Availabilities?.[index] || 0;
    });

    // occupied = capacity − truly available (accounts for all services, OOO, blocks)
    const occupied = Math.max(0, totalCapacity - availableRooms);
    dailyMetrics[date] = { occupied, capacity: totalCapacity };
  });

  return Object.keys(dailyMetrics).map((date) => ({
    date,
    occupied: dailyMetrics[date].occupied,
    available: dailyMetrics[date].capacity,
  }));
}

/**
 * Fetches daily revenue metrics for a date range.
 *
 * @param {object} credentials
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string} timezone - IANA timezone
 * @returns {Promise<Array>} Array of { date, netRevenue, grossRevenue }
 */
async function getRevenueMetrics(credentials, serviceId, startDate, endDate, timezone) {
  let allOrderItems = [];
  let cursor = null;

  do {
    const payload = {
      ServiceIds: [serviceId],
      ConsumedUtc: {
        StartUtc: toMewsUtc(startDate, timezone),
        EndUtc: toMewsUtc(endDate, timezone),
      },
      Types: ["SpaceOrder"],
      AccountingStates: ["Open", "Closed"],
      Limitation: { Cursor: cursor, Count: 1000 },
    };

    const response = await _callMewsApi(
      "orderItems/getAll",
      credentials,
      payload,
    );

    if (response.OrderItems) {
      allOrderItems = allOrderItems.concat(response.OrderItems);
    }
    cursor = response.Cursor || null;
  } while (cursor);

  // Aggregate by day
  const dailyTotals = {};

  allOrderItems.forEach((item) => {
    const date = utcToLocalDate(item.ConsumedUtc, timezone);

    if (!dailyTotals[date]) {
      dailyTotals[date] = { netRevenue: 0, grossRevenue: 0 };
    }

    if (item.Amount) {
      if (typeof item.Amount.NetValue === "number") {
        dailyTotals[date].netRevenue += item.Amount.NetValue;
      }
      if (typeof item.Amount.GrossValue === "number") {
        dailyTotals[date].grossRevenue += item.Amount.GrossValue;
      }
    }
  });

  return Object.keys(dailyTotals).map((date) => ({
    date,
    netRevenue: dailyTotals[date].netRevenue,
    grossRevenue: dailyTotals[date].grossRevenue,
  }));
}

/**
 * Combined metrics fetch for daily-refresh.
 * Returns data in the same canonical format as cloudbedsAdapter.
 *
 * @param {object} credentials
 * @param {string} serviceId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {string} timezone
 * @param {number} [cachedCapacity] - Pre-probed capacity to skip redundant API call
 * @returns {Promise<object>} { [date]: { rooms_sold, capacity_count, net_revenue, gross_revenue, occupancy, ... } }
 */
async function getCombinedMetrics(
  credentials,
  serviceId,
  startDate,
  endDate,
  timezone,
  cachedCapacity,
) {
  const [occupancy, revenue] = await Promise.all([
    getOccupancyMetrics(credentials, serviceId, startDate, endDate, timezone, cachedCapacity),
    getRevenueMetrics(credentials, serviceId, startDate, endDate, timezone),
  ]);

  // Build revenue lookup
  const revMap = {};
  revenue.forEach((r) => {
    revMap[r.date] = r;
  });

  // Combine into canonical format (matches cloudbedsAdapter output)
  const result = {};

  occupancy.forEach((day) => {
    const rev = revMap[day.date] || { netRevenue: 0, grossRevenue: 0 };
    const roomsSold = day.occupied;
    const capacity = day.available;
    const netRev = rev.netRevenue;
    const grossRev = rev.grossRevenue;
    const occ = capacity > 0 ? roomsSold / capacity : 0;

    result[day.date] = {
      rooms_sold: roomsSold,
      capacity_count: capacity,
      net_revenue: netRev,
      gross_revenue: grossRev,
      occupancy: occ,
      gross_adr: roomsSold > 0 ? grossRev / roomsSold : 0,
      net_adr: roomsSold > 0 ? netRev / roomsSold : 0,
      gross_revpar: (roomsSold > 0 ? grossRev / roomsSold : 0) * occ,
      net_revpar: (roomsSold > 0 ? netRev / roomsSold : 0) * occ,
    };
  });

  return result;
}

/**
 * Probes total physical capacity for a Mews service by querying availability
 * on a far-future empty date. Returns the total room count.
 */
async function probeCapacity(credentials, serviceId) {
  const capacityData = await _callMewsApi(
    "services/getAvailability",
    credentials,
    {
      ServiceId: serviceId,
      FirstTimeUnitStartUtc: "2027-12-01T00:00:00Z",
      LastTimeUnitStartUtc: "2027-12-02T00:00:00Z",
    },
  );

  let total = 0;
  (capacityData.CategoryAvailabilities || []).forEach((cat) => {
    total += cat.Availabilities?.[0] || 0;
  });
  return total;
}

/**
 * Per-service revenue aggregation via orderItems/getAll.
 *
 * Pulls every order item consumed in [startDate, endDate] local time,
 * groups gross/net by ServiceId and by YYYY-MM. Used by the Mason Dashboard
 * (on-demand reporting across Short/Mid/Long Stay) — no DB writes.
 *
 * @param {number} hotelId
 * @param {string} startDate YYYY-MM-DD (hotel local)
 * @param {string} endDate   YYYY-MM-DD (hotel local, inclusive)
 * @param {string[]} [serviceIds] optional allowlist; if omitted returns all
 * @returns {Promise<{
 *   services: Array<{ id, name, type }>,
 *   byServiceMonth: Record<string, Record<string, { gross, net, nights }>>,
 *   months: string[]
 * }>}
 */
async function getServiceRevenueByMonth(hotelId, startDate, endDate, serviceIds = null) {
  const credentials = await getCredentials(hotelId);

  // Hotel timezone for correct month boundaries
  const hotelRow = await pgPool.query(
    `SELECT pms_credentials FROM hotels WHERE hotel_id = $1`,
    [hotelId],
  );
  const tz = hotelRow.rows[0]?.pms_credentials?.timezone || "Europe/London";

  // 1. Service catalogue
  const servicesResp = await _callMewsApi("services/getAll", credentials);
  const allServices = (servicesResp.Services || []).map((s) => ({
    id: s.Id,
    name: s.Name,
    type: s.Type,
    isActive: s.IsActive,
  }));
  const want = serviceIds
    ? new Set(serviceIds)
    : new Set(allServices.map((s) => s.id));

  // 2. orderItems window — Mews caps the interval at 3M1D, so split into
  //    <=90-day chunks. Each chunk is itself paginated via Cursor.
  const addDays = (isoDate, n) => {
    const d = new Date(isoDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const chunks = [];
  let cursorStart = startDate;
  while (cursorStart <= endDate) {
    const chunkEnd = addDays(cursorStart, 89); // 90-day window inclusive
    const effectiveEnd = chunkEnd < endDate ? chunkEnd : endDate;
    chunks.push({ from: cursorStart, to: effectiveEnd });
    cursorStart = addDays(effectiveEnd, 1);
  }

  // Pull each chunk in parallel. Pagination within a chunk stays sequential
  // (Mews only returns the next cursor from the prior response).
  const pullChunk = async (chunk) => {
    const startUtc = toMewsUtc(chunk.from, tz);
    const endUtc = toMewsUtc(addDays(chunk.to, 1), tz);
    const chunkItems = [];
    let cursor = null;
    let page = 0;
    do {
      const body = {
        ConsumedUtc: { StartUtc: startUtc, EndUtc: endUtc },
        AccountingStates: ["Open", "Closed"],
        Limitation: { Count: 1000, Cursor: cursor },
      };
      // Server-side ServiceId filter — massive payload reduction vs pulling
      // every service's items and filtering client-side.
      if (serviceIds && serviceIds.length > 0) {
        body.ServiceIds = serviceIds;
      }
      const resp = await _callMewsApi("orderItems/getAll", credentials, body);
      chunkItems.push(...(resp.OrderItems || []));
      cursor = resp.Cursor || null;
      page += 1;
      if (page > 100) break;
    } while (cursor);
    return chunkItems;
  };

  const chunkResults = await Promise.all(chunks.map(pullChunk));
  const items = chunkResults.flat();

  // 3. Group by ServiceId × YYYY-MM (local)
  const monthFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });

  const byServiceMonth = {};
  const monthSet = new Set();

  for (const it of items) {
    const sid = it.ServiceId;
    if (!sid || !want.has(sid)) continue;
    // Deposits are advance payments (balance-sheet liability), not earned
    // revenue. Mews's own accounting export buckets them as "Transaction",
    // not "Revenue". Including them dragged forward-looking months down by
    // the deposit balance — verified against Mason's Apr-only / Apr-May /
    // Mar-May exports for Primrose Hill (318343) on 2026-04-28.
    if (it.Type === "Deposit") continue;
    const consumed = it.ConsumedUtc || it.CreatedUtc;
    if (!consumed) continue;
    const dt = new Date(consumed);
    const parts = monthFmt.formatToParts(dt);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const monthKey = `${y}-${m}`;
    monthSet.add(monthKey);
    if (!byServiceMonth[sid]) byServiceMonth[sid] = {};
    if (!byServiceMonth[sid][monthKey]) {
      byServiceMonth[sid][monthKey] = { gross: 0, net: 0, items: 0, nights: 0 };
    }
    byServiceMonth[sid][monthKey].gross += it.Amount?.GrossValue || 0;
    byServiceMonth[sid][monthKey].net += it.Amount?.NetValue || 0;
    byServiceMonth[sid][monthKey].items += 1;
    // SpaceOrder = one billing unit of accommodation. Daily-TimeUnit services
    // (Short / Mid Stay) emit one per room-night; monthly-TimeUnit services
    // (Long Stay) emit one per month. Frontend must interpret accordingly.
    if (it.Type === "SpaceOrder") {
      byServiceMonth[sid][monthKey].nights += 1;
    }
  }

  const services = allServices.filter((s) => want.has(s.id));
  const months = [...monthSet].sort();

  return { services, byServiceMonth, months, itemsScanned: items.length, timezone: tz };
}

/**
 * Per-AccountingCategory revenue aggregation via orderItems/getAll.
 *
 * Mirrors getServiceRevenueByMonth but groups by AccountingCategoryId
 * instead of ServiceId. Used by the Mason Dashboard from 2026-04-29
 * onwards because Mason's finance team and Sales Flash both classify
 * revenue by accounting category, not by booking-time service. At
 * Westbourne in particular, very long Short-Stay reservations have their
 * nights reposted to the Long Stay accounting category — grouping by
 * Service mis-attributes that revenue. Grouping by Accounting Category
 * mirrors what Mason sees in the Mews "Order Items Report" UI.
 *
 * Deposits are skipped (same rule as getServiceRevenueByMonth): they're
 * a balance-sheet liability, not earned revenue.
 *
 * @param {number} hotelId
 * @param {string} startDate YYYY-MM-DD (hotel local)
 * @param {string} endDate   YYYY-MM-DD (hotel local, inclusive)
 * @param {string[]} [accountingCategoryIds] optional allowlist; if omitted
 *   returns every category present in window. The Mason router uses this
 *   to enforce the per-property allowlist (Short/Mid/Long Accommodation
 *   Income + Canal Breakfast at Westbourne).
 * @returns {Promise<{
 *   byAccountingCategoryMonth: Record<string, Record<string, { gross, net, items, nights }>>,
 *   months: string[],
 *   itemsScanned: number,
 *   timezone: string,
 * }>}
 */
async function getRevenueByAccountingCategoryByMonth(
  hotelId,
  startDate,
  endDate,
  accountingCategoryIds = null,
) {
  const credentials = await getCredentials(hotelId);

  const hotelRow = await pgPool.query(
    `SELECT pms_credentials FROM hotels WHERE hotel_id = $1`,
    [hotelId],
  );
  const tz = hotelRow.rows[0]?.pms_credentials?.timezone || "Europe/London";

  // Mews caps the orderItems window at 3M1D, so split into <=90-day chunks.
  const addDays = (isoDate, n) => {
    const d = new Date(isoDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const chunks = [];
  let cursorStart = startDate;
  while (cursorStart <= endDate) {
    const chunkEnd = addDays(cursorStart, 89);
    const effectiveEnd = chunkEnd < endDate ? chunkEnd : endDate;
    chunks.push({ from: cursorStart, to: effectiveEnd });
    cursorStart = addDays(effectiveEnd, 1);
  }

  // Note: Mews's orderItems/getAll has no AccountingCategoryIds filter, so
  // we have to pull all items in window and filter client-side. Server-side
  // ServiceIds filter would shrink the payload but doesn't apply here —
  // the whole point is that ServiceId and AccountingCategoryId can differ.
  const pullChunk = async (chunk) => {
    const startUtc = toMewsUtc(chunk.from, tz);
    const endUtc = toMewsUtc(addDays(chunk.to, 1), tz);
    const chunkItems = [];
    let cursor = null;
    let page = 0;
    do {
      const body = {
        ConsumedUtc: { StartUtc: startUtc, EndUtc: endUtc },
        AccountingStates: ["Open", "Closed"],
        Limitation: { Count: 1000, Cursor: cursor },
      };
      const resp = await _callMewsApi("orderItems/getAll", credentials, body);
      chunkItems.push(...(resp.OrderItems || []));
      cursor = resp.Cursor || null;
      page += 1;
      if (page > 100) break;
    } while (cursor);
    return chunkItems;
  };

  const chunkResults = await Promise.all(chunks.map(pullChunk));
  const items = chunkResults.flat();

  const want = accountingCategoryIds ? new Set(accountingCategoryIds) : null;

  const monthFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });

  const byAccountingCategoryMonth = {};
  const monthSet = new Set();

  for (const it of items) {
    // Same deposit-skip rule as getServiceRevenueByMonth (deposits are a
    // liability, not revenue — see Mason 2026-04-28 reconciliation).
    if (it.Type === "Deposit") continue;
    const accCatId = it.AccountingCategoryId;
    if (!accCatId) continue;
    if (want && !want.has(accCatId)) continue;
    const consumed = it.ConsumedUtc || it.CreatedUtc;
    if (!consumed) continue;
    const dt = new Date(consumed);
    const parts = monthFmt.formatToParts(dt);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const monthKey = `${y}-${m}`;
    monthSet.add(monthKey);
    if (!byAccountingCategoryMonth[accCatId]) byAccountingCategoryMonth[accCatId] = {};
    if (!byAccountingCategoryMonth[accCatId][monthKey]) {
      byAccountingCategoryMonth[accCatId][monthKey] = { gross: 0, net: 0, items: 0, nights: 0 };
    }
    byAccountingCategoryMonth[accCatId][monthKey].gross += it.Amount?.GrossValue || 0;
    byAccountingCategoryMonth[accCatId][monthKey].net += it.Amount?.NetValue || 0;
    byAccountingCategoryMonth[accCatId][monthKey].items += 1;
    if (it.Type === "SpaceOrder") {
      byAccountingCategoryMonth[accCatId][monthKey].nights += 1;
    }
  }

  const months = [...monthSet].sort();

  return {
    byAccountingCategoryMonth,
    months,
    itemsScanned: items.length,
    timezone: tz,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  // Internal helpers (exposed for onboarding router + other adapters)
  getCredentials,
  _callMewsApi,
  toMewsUtc,

  // Phase 1: Configuration
  getHotelDetails,
  getAccommodationServiceId,
  getResourceCategories,
  getResourceCount,
  getRatePlans,
  buildMewsRateIdMap,

  // Phase 2: Metrics
  getOccupancyMetrics,
  getRevenueMetrics,
  getCombinedMetrics,
  probeCapacity,

  // Reporting (Mason Dashboard)
  getServiceRevenueByMonth,
  getRevenueByAccountingCategoryByMonth,
};
