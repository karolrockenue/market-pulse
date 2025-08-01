// /api/adapters/cloudbedsAdapter.js
// This file houses all logic specific to interacting with the Cloudbeds API.

const fetch = require("node-fetch");
const pgPool = require("../utils/db");

/**
 * A private helper function to process raw API data for historical syncs.
 * @param {Array} allData - Raw data from all pages of the API response.
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
function processApiDataForTable(allData) {
  // ... (existing code, no changes)
  const aggregatedData = {};
  if (!allData || allData.length === 0) return aggregatedData;
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      // Standardize the date format to YYYY-MM-DD to remove timezone ambiguity.
      const date = page.index[i][0].split("T")[0];
      if (!aggregatedData[date]) {
        aggregatedData[date] = {
          rooms_sold: 0,
          capacity_count: 0,
          total_revenue: 0,
          room_revenue: 0,
        };
      }
      aggregatedData[date].rooms_sold +=
        parseFloat(page.records.rooms_sold?.[i]) || 0;
      aggregatedData[date].capacity_count +=
        parseFloat(page.records.capacity_count?.[i]) || 0;
      aggregatedData[date].total_revenue +=
        parseFloat(page.records.total_revenue?.[i]) || 0;
      aggregatedData[date].room_revenue +=
        parseFloat(page.records.room_revenue?.[i]) || 0;
    }
  }
  for (const date in aggregatedData) {
    const metrics = aggregatedData[date];
    metrics.adr =
      metrics.rooms_sold > 0 ? metrics.room_revenue / metrics.rooms_sold : 0;
    metrics.occupancy =
      metrics.capacity_count > 0
        ? metrics.rooms_sold / metrics.capacity_count
        : 0;
    metrics.revpar = metrics.adr * metrics.occupancy;
  }
  return aggregatedData;
}

/**
 * NEW: A private helper function to process raw API data for daily forecast syncs.
 * @param {Object} data - Raw data from the API response.
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
/**
 * A private helper function to process raw API data for daily forecast syncs.
 * It now handles an array of paginated responses.
 * @param {Array} allData - An array of raw data pages from the API response.
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
function processUpcomingApiData(allData) {
  const aggregated = {};
  if (!allData || allData.length === 0) return aggregated;

  const sanitizeMetric = (metric) => {
    const num = parseFloat(metric);
    return isNaN(num) ? 0 : num;
  };

  // Iterate over each page of data from the API response array.
  for (const page of allData) {
    if (!page.index || !page.records) continue;

    for (let i = 0; i < page.index.length; i++) {
      const date = page.index[i][0].split("T")[0];
      if (!aggregated[date]) {
        aggregated[date] = {
          rooms_sold: 0,
          capacity_count: 0,
          total_revenue: 0,
          room_revenue: 0, // <-- ADDED: Initialize room_revenue
          total_revenue_for_adr: 0, // Used for a more accurate weighted ADR calculation
        };
      }
      const roomsSoldForRow = sanitizeMetric(page.records.rooms_sold?.[i]);
      aggregated[date].rooms_sold += roomsSoldForRow;
      aggregated[date].capacity_count += sanitizeMetric(
        page.records.capacity_count?.[i]
      );
      // ADDED: Aggregate the room_revenue from the API response.
      aggregated[date].room_revenue += sanitizeMetric(
        page.records.room_revenue?.[i]
      );
      // To calculate an accurate ADR for the day, we need to sum the (ADR * Rooms Sold) for each room type.
      aggregated[date].total_revenue_for_adr +=
        sanitizeMetric(page.records.adr?.[i]) * roomsSoldForRow;
    }
  }

  // Final calculations for ADR, Occupancy, and RevPAR after all data is aggregated.
  for (const date in aggregated) {
    const dayData = aggregated[date];
    dayData.adr =
      dayData.rooms_sold > 0
        ? dayData.total_revenue_for_adr / dayData.rooms_sold
        : 0;
    dayData.occupancy =
      dayData.capacity_count > 0
        ? dayData.rooms_sold / dayData.capacity_count
        : 0;
    dayData.revpar = dayData.adr * dayData.occupancy;
  }
  return aggregated;
}
/**
 * Gets a neighborhood name from geographic coordinates using the Nominatim API.
 * @param {number} latitude The latitude of the location.
 * @param {number} longitude The longitude of the location.
 * @returns {Promise<string|null>} The neighborhood name or null if not found.
 */
async function getNeighborhoodFromCoords(latitude, longitude) {
  // ... (existing code, no changes)
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "MarketPulseApp/1.0 (karol@rockvenue.com)" },
    });
    if (!response.ok) {
      throw new Error(`Nominatim API returned status: ${response.status}`);
    }
    const data = await response.json();
    return (
      data.address.neighbourhood ||
      data.address.suburb ||
      data.address.quarter ||
      null
    );
  } catch (error) {
    console.error("Error fetching neighborhood from Nominatim:", error);
    return null;
  }
}

/**
 * Fetches and processes historical metrics for a given property and date range.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to fetch data for.
 * @param {string} startDate - The start date in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end date in 'YYYY-MM-DD' format.
 * @returns {Promise<Object>} The processed data in our canonical format.
 */
async function getHistoricalMetrics(
  accessToken,
  propertyId,
  startDate,
  endDate
) {
  const columnsToRequest = [
    "adr",
    "revpar",
    "total_revenue",
    "room_revenue",
    "occupancy",
    "rooms_sold",
    "capacity_count",
  ].map((column) => ({ cdf: { column }, metrics: ["sum", "mean"] }));

  // This is the first request body we will send to the API.
  const initialInsightsPayload = {
    property_ids: [propertyId],
    dataset_id: 7,
    filters: {
      and: [
        {
          cdf: { column: "stay_date" },
          operator: "greater_than_or_equal",
          value: `${startDate}T00:00:00.000Z`,
        },
        {
          cdf: { column: "stay_date" },
          operator: "less_than_or_equal",
          value: `${endDate}T00:00:00.000Z`,
        },
      ],
    },
    columns: columnsToRequest,
    group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
    settings: { details: true, totals: false },
  };

  let allApiData = [];
  let nextToken = null;
  let pageNum = 1;

  console.log("--- STARTING HISTORICAL SYNC ---");
  console.log(
    `[DEBUG] Initial Payload for property ${propertyId}:`,
    JSON.stringify(initialInsightsPayload, null, 2)
  );

  do {
    const insightsPayload = { ...initialInsightsPayload };
    if (nextToken) {
      // If we have a nextToken from a previous page, we use it for the next request.
      insightsPayload.nextToken = nextToken;
      console.log(
        `[DEBUG] Fetching page ${pageNum} using nextToken: ${nextToken}`
      );
    } else {
      console.log(`[DEBUG] Fetching page ${pageNum} (first page).`);
    }

    const apiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-PROPERTY-ID": propertyId,
        },
        body: JSON.stringify(insightsPayload),
      }
    );

    const responseText = await apiResponse.text();
    if (!apiResponse.ok) {
      console.error(
        `[DEBUG] API Error on page ${pageNum}. Status: ${apiResponse.status}. Body: ${responseText}`
      );
      throw new Error(`API Error on page ${pageNum}: ${apiResponse.status}`);
    }

    const pageData = JSON.parse(responseText);

    // Log the summary of the data we received for this page.
    console.log(
      `[DEBUG] Page ${pageNum} response received. Record count: ${
        pageData.records?.rooms_sold?.length || 0
      }. Has nextToken: ${!!pageData.nextToken}`
    );

    allApiData.push(pageData);
    nextToken = pageData.nextToken || null;
    pageNum++;
  } while (nextToken);

  console.log("--- HISTORICAL SYNC COMPLETE ---");
  return processApiDataForTable(allApiData);
}

/**
 * NEW: Fetches and processes upcoming (forecast) metrics for the next 365 days.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to fetch data for.
 * @returns {Promise<Object>} The processed forecast data in our canonical format.
 */
/**
 * Fetches and processes upcoming (forecast) metrics for the next 365 days.
 * This function now correctly handles API pagination to retrieve all future data.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to fetch data for.
 * @returns {Promise<Object>} The processed forecast data in our canonical format.
 */
async function getUpcomingMetrics(accessToken, propertyId) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 365);
  const startDate = today.toISOString().split("T")[0];
  const endDate = futureDate.toISOString().split("T")[0];

  const columnsToRequest = [
    "adr",
    "occupancy",
    "revpar",
    "rooms_sold",
    "capacity_count",
    "total_revenue",
    "room_revenue",
  ].map((col) => ({ cdf: { column: col }, metrics: ["sum"] }));

  const initialInsightsPayload = {
    property_ids: [propertyId],
    dataset_id: 7,
    filters: {
      and: [
        {
          cdf: { column: "stay_date" },
          operator: "greater_than_or_equal",
          value: `${startDate}T00:00:00.000Z`,
        },
        {
          cdf: { column: "stay_date" },
          operator: "less_than_or_equal",
          value: `${endDate}T00:00:00.000Z`,
        },
      ],
    },
    columns: columnsToRequest,
    group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
    settings: { details: true, totals: false },
  };

  let allApiData = [];
  let nextToken = null;
  let pageNum = 1;

  console.log(`--- STARTING FORECAST SYNC for property ${propertyId} ---`);

  // This loop will continue as long as the API provides a 'nextToken', ensuring all pages are fetched.
  do {
    const insightsPayload = { ...initialInsightsPayload };
    if (nextToken) {
      insightsPayload.nextToken = nextToken;
      console.log(`[DEBUG] Fetching forecast page ${pageNum} using nextToken.`);
    } else {
      console.log(`[DEBUG] Fetching forecast page ${pageNum} (first page).`);
    }

    const apiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-PROPERTY-ID": propertyId,
        },
        body: JSON.stringify(insightsPayload),
      }
    );

    const responseText = await apiResponse.text();
    if (!apiResponse.ok) {
      console.error(
        `[DEBUG] Forecast API Error on page ${pageNum}. Status: ${apiResponse.status}. Body: ${responseText}`
      );
      throw new Error(
        `Forecast API Error on page ${pageNum}: ${apiResponse.status}`
      );
    }

    const pageData = JSON.parse(responseText);
    console.log(
      `[DEBUG] Forecast page ${pageNum} received. Record count: ${
        pageData.records?.rooms_sold?.length || 0
      }. Has nextToken: ${!!pageData.nextToken}`
    );

    allApiData.push(pageData);
    nextToken = pageData.nextToken || null; // Update the token for the next loop iteration.
    pageNum++;
  } while (nextToken);

  console.log("--- FORECAST SYNC COMPLETE ---");
  // Use the new helper function to process all the pages of raw forecast data.
  return processUpcomingApiData(allApiData);
}
// Export all public functions.
/**
 * Gets a valid access token for a given user and property, handling both
 * manual (API key) and OAuth (refresh token) authentication modes.
 * @param {object} credentials - The pms_credentials object from the database.
 * @param {string} auth_mode - The user's authentication mode ('manual' or 'oauth').
 * @returns {Promise<string>} A valid access token.
 */
/**
 * Gets a valid access token for a given user and property by using
 * the stored OAuth refresh token.
 * @param {object} credentials - The pms_credentials object from the database.
 * @returns {Promise<string>} A valid access token.
 */
async function getAccessToken(credentials = {}) {
  // This is the standard 'oauth' mode logic.
  // We first check if a refresh token exists in the credentials provided.
  if (!credentials.refresh_token) {
    throw new Error(
      "Authentication failed: No refresh_token found in credentials for the user."
    );
  }

  // Prepare the request to the Cloudbeds token endpoint.
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: credentials.refresh_token,
  });

  // Make the API call to get a new access token.
  const tokenRes = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );

  const tokenData = await tokenRes.json();

  // If the response from Cloudbeds does not include an access token, something is wrong.
  if (!tokenData.access_token) {
    throw new Error(
      "Token refresh failed. Response from Cloudbeds: " +
        JSON.stringify(tokenData)
    );
  }

  // Return the new access token.
  return tokenData.access_token;
}

// --- NEW FUNCTIONS MOVED FROM /api/utils/cloudbeds.js ---

/**
 * Fetches general details for a single hotel from the Cloudbeds API.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The ID of the property to get details for.
 * @returns {Promise<object|null>} The hotel details object or null on failure.
 */
async function getHotelDetails(accessToken, propertyId) {
  const url = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${propertyId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    console.error(`Failed to fetch details for property ${propertyId}:`, data);
    return null;
  }
  return data.data; // Return the nested 'data' object
}

/**
 * Fetches hotel details and saves them to our local database.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to sync.
 * @param {object} dbClient - An active pg database client for transactions.
 * @returns {Promise<void>}
 */
async function syncHotelDetailsToDb(accessToken, propertyId, dbClient) {
  console.log(
    `[Sync Function] Starting detail sync for property ${propertyId}...`
  );

  const hotelDetails = await getHotelDetails(accessToken, propertyId);
  if (!hotelDetails) {
    console.error(`[Sync Function] Could not fetch details for ${propertyId}.`);
    return; // Do not throw error, to avoid breaking Promise.all
  }

  const query = `
    INSERT INTO hotels (
      hotel_id, property_name, city, address_1, country, currency_code,
      property_type, zip_postal_code, latitude, longitude, primary_language
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (hotel_id) DO UPDATE SET
      property_name = EXCLUDED.property_name,
      city = EXCLUDED.city,
      address_1 = EXCLUDED.address_1,
      country = EXCLUDED.country,
      currency_code = EXCLUDED.currency_code,
      property_type = EXCLUDED.property_type,
      zip_postal_code = EXCLUDED.zip_postal_code,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      primary_language = EXCLUDED.primary_language;
  `;
  const values = [
    hotelDetails.propertyID,
    hotelDetails.propertyName,
    hotelDetails.propertyAddress.propertyCity,
    hotelDetails.propertyAddress.propertyAddress1,
    hotelDetails.propertyAddress.propertyCountry,
    hotelDetails.propertyCurrency.currencyCode,
    hotelDetails.propertyType,
    hotelDetails.propertyAddress.propertyZip,
    hotelDetails.propertyAddress.propertyLatitude,
    hotelDetails.propertyAddress.propertyLongitude,
    hotelDetails.propertyPrimaryLanguage,
  ];

  await dbClient.query(query, values); // Use the provided dbClient
  console.log(
    `[Sync Function] Successfully synced details for property ${propertyId}.`
  );
}

/**
 * Fetches tax details and saves them to our local database.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to sync.
 * @param {object} dbClient - An active pg database client for transactions.
 * @returns {Promise<void>}
 */
async function syncHotelTaxInfoToDb(accessToken, propertyId, dbClient) {
  console.log(`[Tax Sync] Starting tax sync for property ${propertyId}...`);
  const url = `https://api.cloudbeds.com/api/v1.1/getTaxesAndFees?propertyID=${propertyId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const taxData = await response.json();

  if (
    !response.ok ||
    !taxData.success ||
    !taxData.data ||
    taxData.data.length === 0
  ) {
    console.warn(
      `[Tax Sync] No tax data found for property ${propertyId}. Skipping.`
    );
    return; // Fail gracefully
  }

  // --- FIX: Prioritize finding the 'inclusive' tax ---
  const primaryTax = taxData.data.find(
    (t) => t.inclusiveOrExclusive === "inclusive"
  );

  if (!primaryTax) {
    console.warn(
      `[Tax Sync] No INCLUSIVE tax found for property ${propertyId}.`
    );
    return; // Fail gracefully
  }

  const taxRate = parseFloat(primaryTax.amount) / 100;
  const taxType = primaryTax.inclusiveOrExclusive;
  const taxName = primaryTax.name || "Tax";

  if (isNaN(taxRate) || !taxType) {
    console.error(`[Tax Sync] Invalid tax data parsed for ${propertyId}.`);
    return; // Fail gracefully
  }

  await dbClient.query(
    // Use the provided dbClient
    `UPDATE hotels SET tax_rate = $1, tax_type = $2, tax_name = $3 WHERE hotel_id::text = $4`,
    [taxRate, taxType, taxName, propertyId]
  );
  console.log(
    `[Tax Sync] Successfully synced tax info for property ${propertyId}.`
  );
}

module.exports = {
  getAccessToken,
  getNeighborhoodFromCoords,
  getHistoricalMetrics,
  getUpcomingMetrics,
  // --- ADD THE NEWLY MOVED FUNCTIONS ---
  syncHotelDetailsToDb,
  syncHotelTaxInfoToDb,
};
