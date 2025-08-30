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

    if (pricingModel === "exclusive") {
      const divisor = 1 + numericTaxRate;
      const calculatedGross = rawRevenue * divisor;
      console.log(
        `[DEBUG C - Exclusive] Divisor=${divisor}, Calculated Gross=${calculatedGross}`
      );
      metrics.net_revenue = rawRevenue;
      metrics.gross_revenue = calculatedGross;
    } else {
      const divisor = 1 + numericTaxRate;
      const calculatedNet = rawRevenue / divisor;
      console.log(
        `[DEBUG D - Inclusive] Divisor=${divisor}, Calculated Net=${calculatedNet}`
      );
      metrics.gross_revenue = rawRevenue;
      metrics.net_revenue = calculatedNet;
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
      metrics.net_revenue = rawRevenue;
      metrics.gross_revenue = rawRevenue * (1 + numericTaxRate);
    } else {
      // Default to 'inclusive' if the model is anything else.
      metrics.gross_revenue = rawRevenue;
      metrics.net_revenue = rawRevenue / (1 + numericTaxRate);
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
async function getUpcomingMetrics(
  accessToken,
  propertyId,
  taxRate,
  pricingModel
) {
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
      property_type, zip_postal_code, latitude, longitude, primary_language, pms_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      primary_language = EXCLUDED.primary_language,
      pms_type = EXCLUDED.pms_type;
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
    "cloudbeds", // Set the pms_type to 'cloudbeds'
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
async function setAppDisabled(accessToken, propertyId) {
  const url = "https://api.cloudbeds.com/api/v1.1/postAppState";

  const params = new URLSearchParams();
  params.append("propertyID", propertyId);
  // CORRECTED: Use the 'disabled' value as specified in the new documentation screenshot.
  params.append("app_state", "disabled");

  console.log(
    `[Adapter] Setting app_state to 'disabled' for property ${propertyId} in Cloudbeds.`
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-PROPERTY-ID": propertyId,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await response.json();

  // If the API call was not successful, we now throw an error.
  // This will be caught by the route handler, which will prevent the disconnection
  // from completing in our database. This makes the entire operation atomic.
  if (!response.ok || !data.success) {
    console.error(
      `[Adapter] Failed to disable app for property ${propertyId}. Response: ${JSON.stringify(
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
    `[Adapter] Successfully disabled app for property ${propertyId} in Cloudbeds.`
  );
}

module.exports = {
  getAccessToken,
  getNeighborhoodFromCoords,
  getHistoricalMetrics,
  getUpcomingMetrics,
  syncHotelDetailsToDb,
  syncHotelTaxInfoToDb,
  // This is the new function we are adding.
  setAppDisabled,
  // The following functions were already in the file but not exported.
  // Adding them here for consistency and to prevent future issues.
  exchangeCodeForToken,
  getUserInfo,
};
