// /api/adapters/cloudbedsAdapter.js
// This file houses all logic specific to interacting with the Cloudbeds API.

const fetch = require("node-fetch");
const pgPool = require("../utils/db");
/**
 * A private helper function to process raw API data for historical syncs.
 * @param {Array} allData - Raw data from all pages of the API response.
 * @param {number} taxRate - The hotel's tax rate (e.g., 0.20 for 20%).
 * @param {string} pricingModel - The hotel's pricing model ('inclusive' or 'exclusive').
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
function processApiDataForTable(allData, taxRate, pricingModel) {
  const aggregatedData = {};
  if (!allData || allData.length === 0) return aggregatedData;

  // Step 1: Aggregate the base numbers from the API response.
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      const date = page.index[i][0].split("T")[0];
      if (!aggregatedData[date]) {
        aggregatedData[date] = {
          rooms_sold: 0,
          capacity_count: 0,
          room_revenue: 0,
        };
      }
      aggregatedData[date].rooms_sold +=
        parseFloat(page.records.rooms_sold?.[i]) || 0;
      aggregatedData[date].capacity_count +=
        parseFloat(page.records.capacity_count?.[i]) || 0;
      aggregatedData[date].room_revenue +=
        parseFloat(page.records.room_revenue?.[i]) || 0;
    }
  }

  // Step 2: Perform all financial calculations for each day.
  for (const date in aggregatedData) {
    const metrics = aggregatedData[date];
    const rawRevenue = metrics.room_revenue;
    const roomsSold = metrics.rooms_sold;
    const capacityCount = metrics.capacity_count;

    // --- START DEBUG LOGGING ---
    console.log(`\n--- Debugging START for Date: ${date} ---`);
    console.log(
      `[DEBUG A] Inputs: rawRevenue=${rawRevenue}, taxRate=${taxRate} (type: ${typeof taxRate}), pricingModel=${pricingModel}`
    );

    const numericTaxRate = parseFloat(taxRate);
    console.log(`[DEBUG B] Parsed Tax Rate: numericTaxRate=${numericTaxRate}`);

    // REFACTORED: Correct tax calculation logic
    if (pricingModel === "exclusive") {
      // For 'exclusive' pricing, the API provides the net revenue.
      // We calculate gross by adding the tax. This logic is correct and remains unchanged.
      metrics.net_revenue = rawRevenue;
      metrics.gross_revenue = rawRevenue * (1 + numericTaxRate);
    } else {
      // THE FIX: For 'inclusive' pricing, the Cloudbeds API still sends net revenue.
      // The old logic incorrectly assumed this value was gross.
      // We now correctly assign the raw value to net_revenue and calculate gross by adding tax.
      metrics.net_revenue = rawRevenue;
      metrics.gross_revenue = rawRevenue * (1 + numericTaxRate);
    }
    console.log(
      `[DEBUG E] Assigned Metrics: net_revenue=${metrics.net_revenue}, gross_revenue=${metrics.gross_revenue}`
    );
    console.log(`--- Debugging END for Date: ${date} ---\n`);
    // --- END DEBUG LOGGING ---

    metrics.occupancy = capacityCount > 0 ? roomsSold / capacityCount : 0;
    metrics.gross_adr = roomsSold > 0 ? metrics.gross_revenue / roomsSold : 0;
    metrics.net_adr = roomsSold > 0 ? metrics.net_revenue / roomsSold : 0;
    metrics.gross_revpar = metrics.gross_adr * metrics.occupancy;
    metrics.net_revpar = metrics.net_adr * metrics.occupancy;
  }

  return aggregatedData;
}

/**
 * A private helper function to process raw API data for daily forecast syncs.
 * @param {Array} allData - An array of raw data pages from the API response.
 * @param {number} taxRate - The hotel's tax rate (e.g., 0.20 for 20%).
 * @param {string} pricingModel - The hotel's pricing model ('inclusive' or 'exclusive').
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
function processUpcomingApiData(allData, taxRate, pricingModel) {
  const aggregated = {};
  if (!allData || allData.length === 0) return aggregated;

  const sanitizeMetric = (metric) => {
    const num = parseFloat(metric);
    return isNaN(num) ? 0 : num;
  };

  // Step 1: Aggregate base numbers from the API.
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      const date = page.index[i][0].split("T")[0];
      if (!aggregated[date]) {
        aggregated[date] = {
          rooms_sold: 0,
          capacity_count: 0,
          room_revenue: 0, // This will hold the primary revenue figure.
        };
      }
      aggregated[date].rooms_sold += sanitizeMetric(
        page.records.rooms_sold?.[i]
      );
      aggregated[date].capacity_count += sanitizeMetric(
        page.records.capacity_count?.[i]
      );
      aggregated[date].room_revenue += sanitizeMetric(
        page.records.room_revenue?.[i]
      );
    }
  }

  // Step 2: Perform all financial calculations for each day.
  for (const date in aggregated) {
    const metrics = aggregated[date];
    const rawRevenue = metrics.room_revenue;
    const roomsSold = metrics.rooms_sold;
    const capacityCount = metrics.capacity_count;

    // Determine Net and Gross Revenue based on the hotel's pricing model.
    // Convert taxRate to a number to ensure correct math.
    const numericTaxRate = parseFloat(taxRate);

    // Convert taxRate to a number to ensure correct math.

    // Determine Net and Gross Revenue based on the hotel's pricing model.
    if (pricingModel === "exclusive") {
      // For 'exclusive' pricing, the API provides the net revenue.
      // We calculate gross by adding the tax. This logic remains correct.
      metrics.net_revenue = rawRevenue;
      metrics.gross_revenue = rawRevenue * (1 + numericTaxRate);
    } else {
      // THE FIX: For 'inclusive' pricing, the Cloudbeds API still sends net revenue.
      // The old logic incorrectly assumed this value was gross.
      // We now correctly assign the raw value to net_revenue and calculate gross by adding tax.
      metrics.net_revenue = rawRevenue;
      metrics.gross_revenue = rawRevenue * (1 + numericTaxRate);
    }

    // Calculate Occupancy.
    metrics.occupancy = capacityCount > 0 ? roomsSold / capacityCount : 0;

    // Calculate Net and Gross versions of ADR and RevPAR.
    metrics.gross_adr = roomsSold > 0 ? metrics.gross_revenue / roomsSold : 0;
    metrics.net_adr = roomsSold > 0 ? metrics.net_revenue / roomsSold : 0;
    metrics.gross_revpar = metrics.gross_adr * metrics.occupancy;
    metrics.net_revpar = metrics.net_adr * metrics.occupancy;
  }

  return aggregated;
}
/**
 * Gets a neighborhood name from geographic coordinates using the Nominatim API.
 * @param {number} latitude The latitude of the location.
 * @param {number} longitude The longitude of the location.
 * @returns {Promise<string|null>} The neighborhood name or null if not found.
 */
/**
 * Gets a neighborhood name from geographic coordinates using the Nominatim API.
 * @param {number} latitude The latitude of the location.
 * @param {number} longitude The longitude of the location.
 * @returns {Promise<string|null>} The neighborhood name or null if not found.
 */
async function getNeighborhoodFromCoords(latitude, longitude) {
  // Return null if coordinates are missing.
  if (!latitude || !longitude) return null;

  // --- FIX: Added the '&zoom=16' parameter to the URL ---
  // This tells the API to return a higher-level geographic area (like a suburb or district)
  // instead of the most specific one (like a tiny named block).
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=16`;

  try {
    const response = await fetch(url, {
      method: "GET",
      // It's good practice to set a User-Agent for public APIs.
      headers: { "User-Agent": "MarketPulseApp/1.0 (karol@rockvenue.com)" },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned status: ${response.status}`);
    }

    const data = await response.json();

    // --- FIX: Improved address parsing ---
    // This logic now checks for the desired address component in a specific, prioritized order
    // to get the most consistent and useful neighborhood name.
    return (
      data.address.suburb ||
      data.address.city_district ||
      data.address.neighbourhood ||
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
  endDate,
  taxRate,
  pricingModel
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
  return processApiDataForTable(allApiData, taxRate, pricingModel);
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
// /api/adapters/cloudbedsAdapter.js

async function getUpcomingMetrics(
  accessToken,
  propertyId,
  taxRate,
  pricingModel
) {
  // NEW: The start date is now set to 14 days in the past to recapture recent changes.
  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - 14);

  // NEW: The end date is set 365 days from today for the future forecast.
  const endDateObj = new Date();
  endDateObj.setDate(endDateObj.getDate() + 365);

  // Format the dates for the API request payload.
  const startDate = startDateObj.toISOString().split("T")[0];
  const endDate = endDateObj.toISOString().split("T")[0];

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
  return processUpcomingApiData(allApiData, taxRate, pricingModel);
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

/**
 * Exchanges an authorization code for a full token set.
 * This is the first step of the OAuth2 flow.
 * @param {string} code - The authorization code from the Cloudbeds redirect.
 * @returns {Promise<object>} The full token response object from Cloudbeds.
 */
async function exchangeCodeForToken(code) {
  // Get the necessary credentials and redirect URI from environment variables.
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REDIRECT_URI,
  } = process.env;

  // Determine the correct redirect URI based on the environment (production or local).
  const redirectUri =
    process.env.VERCEL_ENV === "production"
      ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
      : CLOUDBEDS_REDIRECT_URI;

  // Prepare the parameters for the token exchange API call.
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    redirect_uri: redirectUri,
    code: code,
  });

  // Make the POST request to the Cloudbeds access token endpoint.
  const tokenRes = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );

  const tokenData = await tokenRes.json();

  // If the response from Cloudbeds does not include an access token, something went wrong.
  if (!tokenData.access_token) {
    throw new Error(
      "Authorization code exchange failed. Response from Cloudbeds: " +
        JSON.stringify(tokenData)
    );
  }

  // Return the entire token object, which includes the access token, refresh token, and expiry time.
  return tokenData;
}

// /api/adapters/cloudbedsAdapter.js

// ... (previous code)

/**
 * NEW: A robust, centralized function to find the valid PMS credentials for a property.
 * This is the single source of truth for getting credentials.
 * @param {string} propertyId The ID of the property.
 * @returns {Promise<object>} The pms_credentials object.
 */
async function getCredentialsForProperty(propertyId) {
  // This query finds the user_properties record for the given property that contains
  // a non-null refresh_token. This correctly handles the scenario where an invited admin
  // has a link to a property, but the credentials belong to the original owner.
  const credsResult = await pgPool.query(
    `SELECT pms_credentials FROM user_properties WHERE property_id = $1 AND pms_credentials->>'refresh_token' IS NOT NULL LIMIT 1`,
    [propertyId]
  );

  const credentials = credsResult.rows[0]?.pms_credentials;

  // If no record is found, it means we have no way to authenticate for this property.
  if (!credentials || !credentials.refresh_token) {
    throw new Error(
      `Could not find valid credentials with a refresh_token for property ${propertyId}.`
    );
  }

  return credentials;
}

/**
 * REFACTORED: Gets a valid access token for a property.
 * It now takes a propertyId, uses the new centralized function to get credentials,
 * and then refreshes the token.
 * @param {string} propertyId The ID of the property to get a token for.
 * @returns {Promise<string>} A valid access token.
 */
async function getAccessToken(propertyId) {
  // Step 1: Get the correct credentials using our new centralized function.
  const credentials = await getCredentialsForProperty(propertyId);

  // Step 2: Use the refresh token from the credentials to get a new access token.
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: credentials.refresh_token,
  });

  const tokenRes = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(
      "Token refresh failed. Response from Cloudbeds: " +
        JSON.stringify(tokenData)
    );
  }

  // Return the new access token.
  return tokenData.access_token;
}

// ... (subsequent code)

/**
 * Fetches the profile information for the authenticated user.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @returns {Promise<object>} The user profile object from Cloudbeds.
 */
async function getUserInfo(accessToken) {
  // Make a GET request to the Cloudbeds userinfo endpoint.
  const response = await fetch("https://api.cloudbeds.com/api/v1.3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userInfo = await response.json();
  // If the request was not successful, throw an error.
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${JSON.stringify(userInfo)}`);
  }
  return userInfo;
}

/**
 * Fetches the list of properties associated with a user account.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} userId - The user's cloudbeds_user_id.
 * @returns {Promise<Array>} An array of property objects.
 */

// --- NEW FUNCTIONS MOVED FROM /api/utils/cloudbeds.js ---

/**
 * Fetches general details for a single hotel from the Cloudbeds API.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The ID of the property to get details for.
 * @returns {Promise<object|null>} The hotel details object or null on failure.
 */
// /api/adapters/cloudbedsAdapter.js

async function getHotelDetails(accessToken, propertyId) {
  const url = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${propertyId}`;
  const response = await fetch(url, {
    headers: {
      // Add the Authorization header with the Bearer token for authentication.
      Authorization: `Bearer ${accessToken}`,
      // CRITICAL FIX: Add the X-PROPERTY-ID header. Many Cloudbeds property-specific
      // endpoints require this header to be explicitly set, even if the ID is in the URL.
      "X-PROPERTY-ID": propertyId,
    },
  });
  const data = await response.json();
  // Check if the HTTP response was not OK, or if the API's own success flag is false.
  if (!response.ok || !data.success) {
    // Log the failure for debugging purposes.
    console.error(`Failed to fetch details for property ${propertyId}:`, data);
    // Return null to indicate failure without crashing the entire sync process.
    return null;
  }
  // If successful, return the nested 'data' object which contains the hotel details.
  return data.data;
}

/**
 * Fetches hotel details and saves them to our local database.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to sync.
 * @param {object} dbClient - An active pg database client for transactions.
 * @returns {Promise<void>}
 */
// /api/adapters/cloudbedsAdapter.js
// /api/adapters/cloudbedsAdapter.js

async function syncHotelDetailsToDb(accessToken, propertyId, dbClient) {
  console.log(
    `[Sync Function] Starting detail sync for Cloudbeds property ${propertyId}...`
  );
  const hotelDetails = await getHotelDetails(accessToken, propertyId);
  if (!hotelDetails) {
    console.error(`[Sync Function] Could not fetch details for ${propertyId}.`);
    return null;
  }

  // THE FIX: First, check if a hotel exists with this ID in EITHER the new or old column.
  // SAFETY: Never cast jumbo Cloudbeds IDs to integer. Only attempt integer comparison
  // if the input is clearly a small, 32-bit-safe integer (<= 10 digits).
  const existingHotelResult = await dbClient.query(
    `
  SELECT hotel_id
  FROM hotels
  WHERE pms_property_id = $1
     OR (
          $1 ~ '^[0-9]{1,10}$'       -- only try cast if it fits 32-bit int length
          AND hotel_id = ($1)::integer
        )
  `,
    [String(propertyId)] // ensure we always bind a string, not a JS number
  );

  const existingHotel = existingHotelResult.rows[0];

  const neighborhood = await getNeighborhoodFromCoords(
    hotelDetails.propertyAddress.propertyLatitude,
    hotelDetails.propertyAddress.propertyLongitude
  );

  let internalHotelId;

  if (existingHotel) {
    // --- UPDATE PATH ---
    // If the hotel already exists, UPDATE its record with the latest details.
    internalHotelId = existingHotel.hotel_id;
    console.log(
      `[Sync Function] Existing hotel found with internal ID ${internalHotelId}. Updating details...`
    );
    const updateQuery = `
      UPDATE hotels SET
        pms_property_id = $1, property_name = $2, city = $3, currency_code = $4,
        latitude = $5, longitude = $6, address_1 = $7, country = $8,
        zip_postal_code = $9, property_type = $10, neighborhood = $11, pms_type = 'cloudbeds'
      WHERE hotel_id = $12;
    `;
    await dbClient.query(updateQuery, [
      hotelDetails.propertyID,
      hotelDetails.propertyName,
      hotelDetails.propertyAddress.propertyCity,
      hotelDetails.propertyCurrency.currencyCode,
      hotelDetails.propertyAddress.propertyLatitude,
      hotelDetails.propertyAddress.propertyLongitude,
      hotelDetails.propertyAddress.propertyAddress1,
      hotelDetails.propertyAddress.propertyCountry,
      hotelDetails.propertyAddress.propertyZip,
      hotelDetails.propertyType,
      neighborhood,
      internalHotelId,
    ]);
  } else {
    // --- INSERT PATH ---
    // If no hotel is found, INSERT a new record.
    console.log(
      `[Sync Function] No existing hotel found. Creating new record...`
    );
    const insertQuery = `
      INSERT INTO hotels (
        pms_property_id, property_name, city, currency_code, pms_type, latitude, longitude,
        address_1, country, zip_postal_code, property_type, neighborhood, go_live_date
      )
      VALUES ($1, $2, $3, $4, 'cloudbeds', $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING hotel_id;
    `;
    const result = await dbClient.query(insertQuery, [
      hotelDetails.propertyID,
      hotelDetails.propertyName,
      hotelDetails.propertyAddress.propertyCity,
      hotelDetails.propertyCurrency.currencyCode,
      hotelDetails.propertyAddress.propertyLatitude,
      hotelDetails.propertyAddress.propertyLongitude,
      hotelDetails.propertyAddress.propertyAddress1,
      hotelDetails.propertyAddress.propertyCountry,
      hotelDetails.propertyAddress.propertyZip,
      hotelDetails.propertyType,
      neighborhood,
    ]);
    internalHotelId = result.rows[0].hotel_id;
  }

  console.log(
    `[Sync Function] Successfully synced details for property ${propertyId}. Internal hotel_id is ${internalHotelId}.`
  );
  return internalHotelId;
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

  // THE FIX: The WHERE clause is updated to check against the 'pms_property_id' column.
  // This ensures that we find the correct hotel record using the external ID
  // provided by the Cloudbeds API, which is the correct behavior for this function.
  // A fallback to check hotel_id is included to maintain compatibility with legacy hotels
  // where the internal and external IDs were the same.
  await dbClient.query(
    `UPDATE hotels 
     SET tax_rate = $1, tax_type = $2, tax_name = $3 
     WHERE pms_property_id = $4 OR hotel_id::text = $4`,
    [taxRate, taxType, taxName, propertyId]
  );
  console.log(
    `[Tax Sync] Successfully synced tax info for property ${propertyId}.`
  );
}

/**
 * Sets the application state to 'disabled' for a given property in Cloudbeds.
 * This is used when a user disconnects their property from our application.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The ID of the property to disable.
 * @returns {Promise<void>}
 */
/**
 * Sets the application state to 'disabled' for a given property in Cloudbeds.
 * This is used when a user disconnects their property from our application.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The ID of the property to disable.
 * @returns {Promise<void>}
 */
async function setAppDisabled(accessToken, internalPropertyId) {
  // THE FIX: Look up the original PMS ID from our database using the internal ID.
  const hotelResult = await pgPool.query(
    "SELECT pms_property_id, pms_type FROM hotels WHERE hotel_id = $1",
    [internalPropertyId]
  );

  if (hotelResult.rows.length === 0) {
    throw new Error(`Hotel with internal ID ${internalPropertyId} not found.`);
  }

  const hotel = hotelResult.rows[0];

  // This function is Cloudbeds-specific, so we ensure we're not accidentally running it for another PMS.
  if (hotel.pms_type !== "cloudbeds") {
    console.log(
      `[Adapter] Skipping app disable for non-Cloudbeds property ${internalPropertyId}.`
    );
    return;
  }

  // Use the correct, original Cloudbeds ID for the API call.
  const cloudbedsPropertyId = hotel.pms_property_id;

  const url = "https://api.cloudbeds.com/api/v1.1/postAppState";
  const params = new URLSearchParams();
  params.append("propertyID", cloudbedsPropertyId);
  params.append("app_state", "disabled");

  console.log(
    `[Adapter] Setting app_state to 'disabled' for Cloudbeds property ${cloudbedsPropertyId} (Internal ID: ${internalPropertyId}).`
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-PROPERTY-ID": cloudbedsPropertyId,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    console.error(
      `[Adapter] Failed to disable app for property ${cloudbedsPropertyId}. Response: ${JSON.stringify(
        data
      )}`
    );
    throw new Error(
      `Cloudbeds API Error: Failed to set app state to disabled. ${
        data.message || ""
      }`
    );
  }

  console.log(
    `[Adapter] Successfully disabled app for property ${cloudbedsPropertyId} in Cloudbeds.`
  );
}

/**
 * NEW: Fetches a complete list of all physical rooms for a property.
 * This function handles pagination to ensure all rooms are retrieved.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The external PMS ID of the property.
 * @returns {Promise<Array>} - A flat array of room objects.
 */
/**
 * NEW & IMPROVED: Fetches a complete list of all physical rooms for a property.
 * This function now includes robust error handling for non-JSON API responses.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The external PMS ID of the property.
 * @returns {Promise<Array>} - A flat array of room objects.
 */
async function getRooms(accessToken, propertyId) {
  let allRooms = [];
  let pageNumber = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    // FINAL FIX: The correct endpoint is /getRooms. This replaces the incorrect /getRoomList.
    const url = `https://api.cloudbeds.com/api/v1.1/getRooms?propertyID=${propertyId}&pageNumber=${pageNumber}&pageSize=${pageSize}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": propertyId,
      },
    });

    // --- FIX: Robust Error Handling ---
    // First, check the Content-Type header to see if we got JSON.
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // If not JSON, read the body as text to see the HTML error page.
      const errorText = await response.text();
      throw new Error(
        `Cloudbeds API returned a non-JSON response (likely an auth error page). Status: ${
          response.status
        }. Body: ${errorText.substring(0, 500)}...`
      );
    }

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(
        `Failed to fetch rooms page ${pageNumber}. API Response: ${JSON.stringify(
          data
        )}`
      );
    }

    if (data.data && data.data.length > 0) {
      allRooms = allRooms.concat(data.data);
      pageNumber++;
    } else {
      hasMore = false;
    }
  }
  return allRooms;
}

/**
 * NEW & IMPROVED: Fetches a list of reservations for a property, with optional filters.
 * Includes robust error handling for non-JSON API responses.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The external PMS ID of the property.
 * @param {object} [filters={}] - An object of key-value pairs for URL query parameters.
 * @returns {Promise<Array>} - A flat array of reservation objects.
 */
async function getReservations(accessToken, propertyId, filters = {}) {
  let allReservations = [];
  let pageNumber = 1;
  const pageSize = 100;
  let hasMore = true;

  const filterParams = new URLSearchParams(filters).toString();

  while (hasMore) {
    const url = `https://api.cloudbeds.com/api/v1.1/getReservations?propertyID=${propertyId}&pageNumber=${pageNumber}&pageSize=${pageSize}&${filterParams}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": propertyId,
      },
    });

    // --- FIX: Robust Error Handling ---
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      throw new Error(
        `Cloudbeds API returned a non-JSON response on reservations call. Status: ${
          response.status
        }. Body: ${errorText.substring(0, 500)}...`
      );
    }

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        `Failed to fetch reservations page ${pageNumber}. API Response: ${JSON.stringify(
          data
        )}`
      );
    }

    if (data.data && data.data.length > 0) {
      allReservations = allReservations.concat(data.data);
      pageNumber++;
    } else {
      hasMore = false;
    }
  }
  return allReservations;
}

/**
 * NEW: Fetches reservations with extra rate and source details.
 * This is the preferred endpoint for detailed reporting.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The external PMS ID of the property.
 * @param {object} [filters={}] - An object of key-value pairs for URL query parameters.
 * @returns {Promise<Array>} - A flat array of detailed reservation objects.
 */
async function getReservationsWithDetails(
  accessToken,
  propertyId,
  filters = {}
) {
  let allReservations = [];
  let pageNumber = 1;
  const pageSize = 100;
  let hasMore = true;

  // Add the crucial 'includeGuestsDetails' parameter automatically.
  const finalFilters = { ...filters, includeGuestsDetails: "true" };
  const filterParams = new URLSearchParams(finalFilters).toString();

  while (hasMore) {
    // Use the correct v1.3 endpoint as identified from the documentation.
    const url = `https://api.cloudbeds.com/api/v1.3/getReservationsWithRateDetails?propertyID=${propertyId}&pageNumber=${pageNumber}&pageSize=${pageSize}&${filterParams}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": propertyId,
      },
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text();
      throw new Error(
        `Cloudbeds API returned a non-JSON response. Status: ${
          response.status
        }. Body: ${errorText.substring(0, 500)}...`
      );
    }

    const data = await response.json();
    if (!response.ok || data.success === false) {
      // Some endpoints use `success: false`
      throw new Error(
        `Failed to fetch detailed reservations page ${pageNumber}. API Response: ${JSON.stringify(
          data
        )}`
      );
    }

    if (data.data && data.data.length > 0) {
      allReservations = allReservations.concat(data.data);
      pageNumber++;
    } else {
      hasMore = false;
    }
  }
  return allReservations;
}

/**
 * Fetches daily takings (payments) grouped by payment method for a specific day.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @param {string} propertyId - The external PMS ID of the property.
 * @param {string} date - The date to fetch takings for in 'YYYY-MM-DD' format.
 * @returns {Promise<Object>} - An object summarizing takings by payment method.
 */
async function getDailyTakings(accessToken, propertyId, date) {
  // NEW APPROACH: Request a simple list of transactions, not a summary.
  // This is a much simpler request that is less likely to fail.
  const insightsPayload = {
    property_ids: [propertyId],
    dataset_id: 1, // Financial dataset
    filters: {
      and: [
        {
          cdf: { column: "service_date" },
          operator: "equal",
          value: `${date}T00:00:00.000Z`,
        },
        {
          cdf: { column: "credit_amount" },
          operator: "greater_than",
          value: "0",
        },
      ],
    },
    // Request the two columns we need for each transaction. No aggregation.
    columns: [
      { cdf: { column: "payment_method" } },
      { cdf: { column: "credit_amount" } },
    ],
    settings: { details: true, totals: false }, // We only want the detailed list.
  };

  console.log(
    "[DEBUG] Sending new (simpler) Takings Payload:",
    JSON.stringify(insightsPayload, null, 2)
  );

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

  const data = await apiResponse.json();
  if (!apiResponse.ok) {
    console.error(`[Takings Sync] API Error:`, data);
    throw new Error(`Takings API Error: ${apiResponse.status}`);
  }

  // NEW PROCESSING LOGIC: We will manually sum the results ourselves.
  const takingsSummary = {};
  if (data.index && data.records) {
    for (let i = 0; i < data.index.length; i++) {
      // The payment method is the first item in the index array for each record.
      const paymentMethod = data.index[i][0] || "Unknown";
      // The credit amount is in the records object.
      const amount = parseFloat(data.records.credit_amount?.[i]) || 0;

      if (amount > 0 && paymentMethod !== "-") {
        // If we've seen this payment method before, add to it. Otherwise, initialize it.
        takingsSummary[paymentMethod] =
          (takingsSummary[paymentMethod] || 0) + amount;
      }
    }
  }

  return takingsSummary;
}

module.exports = {
  getAccessToken,
  getNeighborhoodFromCoords,
  getHistoricalMetrics,
  getUpcomingMetrics,
  syncHotelDetailsToDb,
  syncHotelTaxInfoToDb,
  setAppDisabled,
  exchangeCodeForToken,
  getUserInfo,
  getRooms,
  getReservations,
  getReservationsWithDetails,
  // Export our new function so other files can use it.
  getDailyTakings,
};
