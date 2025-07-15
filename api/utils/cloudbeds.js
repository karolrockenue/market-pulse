// /api/utils/cloudbeds.js
// A central place for all Cloudbeds API interactions.

const fetch = require("node-fetch");

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

module.exports = {
  getOAuthAccessToken,
  getManualAccessToken,
  getPropertiesForUser,
  getHotelDetails,
};
