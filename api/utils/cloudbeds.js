// /api/utils/cloudbeds.js
// A central place for all Cloudbeds API interactions.

const fetch = require("node-fetch");
const pgPool = require("./db");

/**
 * Fetches a new Cloudbeds access token using a refresh token.
 * Used for standard OAuth users.
 * @param {string} refreshToken - The user's OAuth refresh token.
 * @returns {Promise<string|null>} The new access token, or null if failed.
 */
async function getOAuthAccessToken(refreshToken) {
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  if (!refreshToken) {
    throw new Error("Cannot get access token without a refresh token.");
  }
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    console.error("OAuth token refresh failed:", tokenData);
    return null;
  }
  return tokenData.access_token;
}

/**
 * Fetches a new Cloudbeds access token using manual client credentials.
 * Used for pilot mode users.
 * @param {string} clientId - The pilot user's override client ID.
 * @param {string} clientSecret - The pilot user's override client secret.
 * @returns {Promise<object|null>} The token object { access_token, expires_in }, or null if failed.
 */

/**
 * Fetches the list of properties associated with an account.
 * @param {string} accessToken - A valid Cloudbeds access token.
 * @returns {Promise<Array|null>} An array of property objects, or null if failed.
 */
async function getPropertiesForUser(accessToken) {
  const response = await fetch(
    "https://api.cloudbeds.com/datainsights/v1.1/me/properties",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const properties = await response.json();
  if (!response.ok) {
    console.error("Failed to fetch properties:", properties);
    return null;
  }
  return Array.isArray(properties) ? properties : [properties];
}
// Add this new function to the file
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
  return data.data;
}
// api/utils/cloudbeds.js

/**
 * Fetches details for a single hotel from the Cloudbeds API and saves them
 * to our local database. This is the unified function for all onboarding.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to sync.
 * @returns {Promise<void>}
 */
async function syncHotelDetailsToDb(accessToken, propertyId) {
  console.log(
    `[Sync Function] Starting detail sync for property ${propertyId}...`
  );

  // 1. Fetch the details from Cloudbeds API
  const hotelDetails = await getHotelDetails(accessToken, propertyId);
  if (!hotelDetails) {
    console.error(
      `[Sync Function] Could not fetch details for property ${propertyId}. Aborting sync for this property.`
    );
    return;
  }

  // 2. Save the comprehensive details to our 'hotels' table.
  // This is the query we just perfected.
  await pgPool.query(
    `INSERT INTO hotels (
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
       primary_language = EXCLUDED.primary_language;`,
    [
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
    ]
  );
  console.log(
    `[Sync Function] Successfully synced details for property ${propertyId}.`
  );
}

// api/utils/cloudbeds.js

/**
 * Sets the application state for a given property. Used to "enable" a manually
 * connected pilot hotel.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to enable.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function setCloudbedsAppState(accessToken, propertyId) {
  console.log(
    `[App State] Setting app state to 'enabled' for property ${propertyId}...`
  );
  const targetUrl = "https://api.cloudbeds.com/api/v1.1/postAppState";

  // The payload for the API call.
  const payload = {
    propertyID: propertyId,
    app_state: "enabled",
  };

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseData = await response.json();

  // Check if the call was successful.
  if (!response.ok || !responseData.success) {
    console.error(
      `[App State] Failed to set app state for property ${propertyId}. Response:`,
      responseData
    );
    return false;
  }

  console.log(
    `[App State] Successfully enabled app for property ${propertyId}.`
  );
  return true;
}

// /api/utils/cloudbeds.js

/**
 * Fetches tax details for a property from Cloudbeds and saves the primary
 * tax info (rate and type) to our local database.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to sync tax info for.
 * @returns {Promise<void>}
 */
// api/utils/cloudbeds.js

async function syncHotelTaxInfoToDb(accessToken, propertyId) {
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
    return;
  }
  const primaryTax = taxData.data.find(
    (t) =>
      t.inclusiveOrExclusive === "inclusive" ||
      t.inclusiveOrExclusive === "exclusive"
  );
  if (!primaryTax) {
    console.warn(
      `[Tax Sync] No primary (inclusive/exclusive) tax found for property ${propertyId}.`
    );
    return;
  }

  // Get the rate, type, AND name from the tax object.
  const taxRate = parseFloat(primaryTax.amount) / 100;
  const taxType = primaryTax.inclusiveOrExclusive;
  const taxName = primaryTax.name || "Tax"; // Default to 'Tax' if no name is provided

  if (isNaN(taxRate) || !taxType) {
    console.error(
      `[Tax Sync] Invalid tax data parsed for property ${propertyId}. Aborting.`
    );
    return;
  }

  // Update the 'hotels' table with the new tax information, including the name.
  await pgPool.query(
    `UPDATE hotels SET tax_rate = $1, tax_type = $2, tax_name = $3 WHERE hotel_id::text = $4`,
    [taxRate, taxType, taxName, propertyId]
  );
  console.log(
    `[Tax Sync] Successfully synced tax info for property ${propertyId}.`
  );
}

// New function to get neighborhood from coordinates using Nominatim API
async function getNeighborhoodFromCoords(latitude, longitude) {
  // Construct the URL for the Nominatim reverse geocoding API
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        // IMPORTANT: Nominatim requires a custom User-Agent header that identifies our application.
        "User-Agent": "MarketPulseApp/1.0 (karol@rockvenue.com)",
      },
    });

    if (!response.ok) {
      // Handle non-successful responses from the API
      throw new Error(`Nominatim API returned status: ${response.status}`);
    }

    const data = await response.json();

    // Return the neighborhood, suburb, or quarter, whichever is available first.
    return (
      data.address.neighbourhood ||
      data.address.suburb ||
      data.address.quarter ||
      null
    );
  } catch (error) {
    // Log the error and return null if the API call fails
    console.error("Error fetching neighborhood from Nominatim:", error);
    return null;
  }
}
// api/utils/cloudbeds.js

// api/utils/cloudbeds.js

module.exports = {
  getOAuthAccessToken,
  getPropertiesForUser,
  getHotelDetails,
  syncHotelDetailsToDb,
  setCloudbedsAppState,
  syncHotelTaxInfoToDb, // Add our new function to the exports
  getNeighborhoodFromCoords, // Add the new function here
};
