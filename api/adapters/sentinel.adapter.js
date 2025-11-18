/**
 * @file sentinel.adapter.js
 * @brief Isolated adapter for Sentinel AI rate posting.
 * This adapter is "firewalled" and uses separate, developer-specific
 * credentials for certification and rate-pushing functionality.
 * It DOES NOT interact with the main cloudbedsAdapter.js.
 */

const axios = require('axios');

// Use 'axios' which is already imported for postRate


// Cloudbeds API endpoints
const CLOUDBEDS_API_URL = 'https://api.cloudbeds.com/api/v1.1';
const CLOUDBEDS_TOKEN_URL = 'https://hotels.cloudbeds.com/api/v1.1/access_token';

// Read the isolated Sentinel OAuth credentials from .env
const {
  SENTINEL_CLIENT_ID,
  SENTINEL_CLIENT_SECRET,
  SENTINEL_DEV_REFRESH_TOKEN
} = process.env;

/**
 * Retrieves an isolated Sentinel access token using its own OAuth credentials.
 * This function is "firewalled" and ONLY uses the SENTINEL_... .env variables.
 * It performs a "grant_type: refresh_token" flow.
 */
async function getSentinelAccessToken() {
  if (!SENTINEL_CLIENT_ID || !SENTINEL_CLIENT_SECRET || !SENTINEL_DEV_REFRESH_TOKEN) {
    console.error('[Sentinel] One or more Sentinel OAuth .env variables are not set.');
    throw new Error('Sentinel OAuth service is not configured.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: SENTINEL_CLIENT_ID,
    client_secret: SENTINEL_CLIENT_SECRET,
    refresh_token: SENTINEL_DEV_REFRESH_TOKEN,
  });

  try {
    const response = await axios.post(CLOUDBEDS_TOKEN_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const tokenData = response.data;
    if (!tokenData.access_token) {
      throw new Error('Token refresh succeeded but no access_token was returned.');
    }

    // NOTE: This flow does NOT update the refresh token in the .env file.
    // Cloudbeds refresh tokens are typically long-lived. If it expires,
    // we will need to manually repeat the auth flow.
    return tokenData.access_token;

  } catch (error) {
    const errorMsg = error.response ? error.response.data : error.message;
    console.error(`[Sentinel] Failed to refresh OAuth token:`, errorMsg);
    throw new Error(`Sentinel token refresh failed: ${errorMsg}`);
  }
}

/**
 * Posts a rate update to Cloudbeds for a specific property.
 * This is the primary function for Sentinel certification.
 * @param {string} propertyId - The Cloudbeds property ID.
 *Note: We will get this from the new 'Sentinel' dev account.
 * @param {string} roomTypeId - The ID of the room type to update.
 * @param {string} date - The date to update (YYYY-MM-DD).
 * @param {number} rate - The new rate to set.
 * @returns {Promise<object>} - The API response from Cloudbeds.
 */
/**
 * Posts a rate update to Cloudbeds for a specific property.
 * This is the primary function for Sentinel certification.
 * It uses the correct v1.3/putRate endpoint and sends Form Data.
 * @param {string} propertyId - The Cloudbeds property ID.
 * @param {string} rateId - The ID of the rate plan to update.
 * @param {string} date - The single date to update (YYYY-MM-DD).
 * @param {number} rate - The new rate to set.
 * @returns {Promise<object>} - The API response from Cloudbeds (e.g., { jobReferenceID: "..." }).
 */
async function postRate(propertyId, rateId, date, rate) {
  console.log(`[Sentinel] Attempting to post rate for rateID ${rateId} on ${date}`);

  try {
    // 1. Get the isolated Sentinel access token
    const accessToken = await getSentinelAccessToken();

    // 2. Define the API endpoint
    // This is the correct endpoint from the documentation.
    const endpoint = `${CLOUDBEDS_API_URL}/putRate`; // v1.1 is the base, /putRate is v1.3

    // 3. Build the Form Data payload
    // We must use URLSearchParams to send as 'application/x-www-form-urlencoded'
    // This matches the "Form Data" requirement for a nested object.
    const params = new URLSearchParams();
    params.append('rates[0][rateID]', rateId);
    params.append('rates[0][interval][0][startDate]', date);
    params.append('rates[0][interval][0][endDate]', date);
    params.append('rates[0][interval][0][rate]', rate);

    // 4. Make the API call
    const response = await axios.post(endpoint, params, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-PROPERTY-ID': propertyId,
        // Axios will automatically set 'Content-Type': 'application/x-www-form-urlencoded'
        // when we pass a URLSearchParams object.
      },
    });

    console.log(`[Sentinel] Successfully queued rate post for rateID ${rateId}.`);
    // Return the async job ID
    return response.data;

  } catch (error) {
    // ... (This is our existing, robust error handling, it's still good) ...
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      let errorMsg = 'Unknown error';

      if (contentType && contentType.includes('application/json')) {
        errorMsg = JSON.stringify(error.response.data);
      } else {
        const responseData = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : 'Non-string error body';
        errorMsg = `Non-JSON response (HTML Error Page?): ${responseData}...`;
      }
      console.error(`[Sentinel] Error in postRate for ${rateId}. Status: ${error.response.status}.`, errorMsg);
      throw new Error(`Sentinel postRate failed: ${errorMsg}`);
    } else if (error.request) {
      console.error('[Sentinel] Error in postRate: No response received.', error.request);
      throw new Error('Sentinel postRate failed: No response from server.');
    } else {
      console.error('[Sentinel] Error in postRate (Setup):', error.message);
      throw new Error(`Sentinel postRate failed (Setup): ${error.message}`);
    }
  }
}
/**
 * Fetches rate plans for a specific property.
 * This is used to find the 'rateID' needed for the postRate function.
 * @param {string} propertyId - The Cloudbeds property ID.
 * @returns {Promise<object>} - The API response from Cloudbeds (list of rate plans).
 */
/**
 * Fetches rate plans for a specific property.
 * This is used to find the 'rateID' needed for the postRate function.
 * @param {string} propertyId - The Cloudbeds property ID.
 * @returns {Promise<object>} - The API response from Cloudbeds (list of rate plans).
 */
async function getRatePlans(propertyId) {
  console.log(`[Sentinel] Fetching rate plans for property ${propertyId}`);

  try {
    // 1. Get the isolated Sentinel access token
    const accessToken = await getSentinelAccessToken();

    // 2. Define the API endpoint and query parameters
    const endpoint = `${CLOUDBEDS_API_URL}/getRatePlans`; // v1.1 is base, /getRatePlans is v1.3

    // --- THIS IS THE FIX ---
    // Remove TypeScript type annotation (': Date')
    const formatDate = (date) => date.toISOString().split('T')[0];
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + 90);

    const params = new URLSearchParams({
      propertyIDs: propertyId,
      startDate: formatDate(today),
      endDate: formatDate(future),
    });
    // --- END OF FIX ---

    // 3. Make the API call
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-PROPERTY-ID': propertyId,
      },
    });

    console.log(`[Sentinel] Successfully fetched rate plans for ${propertyId}`);
    return response.data;

  } catch (error) {
    // ... (This is our existing, robust error handling) ...
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      let errorMsg = 'Unknown error';

      if (contentType && contentType.includes('application/json')) {
        errorMsg = JSON.stringify(error.response.data);
      } else {
        const responseData = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : 'Non-string error body';
        errorMsg = `Non-JSON response (HTML Error Page?): ${responseData}...`;
      }
      console.error(`[Sentinel] Error in getRatePlans for ${propertyId}. Status: ${error.response.status}.`, errorMsg);
      throw new Error(`Sentinel getRatePlans failed: ${errorMsg}`);
    } else if (error.request) {
      console.error('[Sentinel] Error in getRatePlans: No response received.', error.request);
      throw new Error('Sentinel getRatePlans failed: No response from server.');
    } else {
      console.error('[Sentinel] Error in getRatePlans (Setup):', error.message);
      throw new Error(`Sentinel getRatePlans failed (Setup): ${error.message}`);
    }
  }
}

/**
 * [NEW] Fetches the status of an asynchronous job from Cloudbeds.
 * This is used to diagnose the result of a postRate call.
 * @param {string} propertyId - The Cloudbeds property ID.
 * @param {string} jobId - The jobReferenceID returned from postRate.
 * @returns {Promise<object>} - The API response (e.g., job status, errors).
 */
async function getJobStatus(propertyId, jobId) {
  console.log(`[Sentinel] Fetching job status for ${jobId} on property ${propertyId}`);

  if (!jobId) {
    console.error('[Sentinel] getJobStatus called without a jobId.');
    throw new Error('Job ID is required to check status.');
  }

  try {
    // 1. Get the isolated Sentinel access token
    const accessToken = await getSentinelAccessToken();

    // 2. Define the API endpoint and query parameters
    const endpoint = `${CLOUDBEDS_API_URL}/getRateJobs`; // v1.3
    const params = new URLSearchParams({
      jobReferenceID: jobId,
    });

    // 3. Make the API call
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-PROPERTY-ID': propertyId,
      },
    });

    console.log(`[Sentinel] Successfully fetched job status for ${jobId}`);
    return response.data;

  } catch (error) {
    // ... (Reusing the same robust error handling pattern) ...
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      let errorMsg = 'Unknown error';

      if (contentType && contentType.includes('application/json')) {
        errorMsg = JSON.stringify(error.response.data);
      } else {
        const responseData = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : 'Non-string error body';
        errorMsg = `Non-JSON response (HTML Error Page?): ${responseData}...`;
      }
      console.error(`[Sentinel] Error in getJobStatus for ${jobId}. Status: ${error.response.status}.`, errorMsg);
      throw new Error(`Sentinel getJobStatus failed: ${errorMsg}`);
    } else if (error.request) {
      console.error(`[Sentinel] Error in getJobStatus for ${jobId}: No response received.`, error.request);
      throw new Error('Sentinel getJobStatus failed: No response from server.');
    } else {
      console.error(`[Sentinel] Error in getJobStatus for ${jobId} (Setup):`, error.message);
      throw new Error(`Sentinel getJobStatus failed (Setup): ${error.message}`);
    }
  }
}

/**
 * [NEW] Fetches room types for a specific property.
 * This is the second "Fact" needed for the Sentinel config.
 * @param {string} propertyId - The Cloudbeds property ID.
 * @returns {Promise<object>} - The API response from Cloudbeds (list of room types).
 */
async function getRoomTypes(propertyId) {
  console.log(`[Sentinel] Fetching room types for property ${propertyId}`);

  try {
    // 1. Get the isolated Sentinel access token
    const accessToken = await getSentinelAccessToken();

    // 2. Define the API endpoint
    const endpoint = `${CLOUDBEDS_API_URL}/getRoomTypes`; // v1.1

    // 3. Make the API call
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-PROPERTY-ID': propertyId,
      },
    });

    console.log(`[Sentinel] Successfully fetched room types for ${propertyId}`);
    return response.data;

  } catch (error) {
    // ... (Reusing the same robust error handling pattern) ...
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      let errorMsg = 'Unknown error';

      if (contentType && contentType.includes('application/json')) {
        errorMsg = JSON.stringify(error.response.data);
      } else {
        const responseData = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : 'Non-string error body';
        errorMsg = `Non-JSON response (HTML Error Page?): ${responseData}...`;
      }
      console.error(`[Sentinel] Error in getRoomTypes for ${propertyId}. Status: ${error.response.status}.`, errorMsg);
      throw new Error(`Sentinel getRoomTypes failed: ${errorMsg}`);
    } else if (error.request) {
      console.error('[Sentinel] Error in getRoomTypes: No response received.', error.request);
      throw new Error('Sentinel getRoomTypes failed: No response from server.');
    } else {
// [Replace With]
      console.error('[Sentinel] Error in getRoomTypes (Setup):', error.message);
      throw new Error(`Sentinel getRoomTypes failed (Setup): ${error.message}`);
    }
  }
}

/**
 * [NEW] Fetches rates for a specific room type from Cloudbeds.
 * This is used by the Rate Manager to get the live "External" state
 * for certification and UI display.
 * @param {string} propertyId - The Cloudbeds property ID.
 * @param {string} roomTypeId - The ID of the room type to fetch rates for.
 * @param {string} startDate - The start date (YYYY-MM-DD).
 * @param {string} endDate - The end date (YYYY-MM-DD).
 * @returns {Promise<object>} - The API response from Cloudbeds (list of rates).
 */
async function getRates(propertyId, roomTypeId, startDate, endDate) {
  console.log(`[Sentinel] Fetching rates for room ${roomTypeId} on property ${propertyId}`);

  try {
    // 1. Get the isolated Sentinel access token
    const accessToken = await getSentinelAccessToken();

// [Replace With]
    // 2. Define the API endpoint and query parameters
    const endpoint = `${CLOUDBEDS_API_URL}/getRates`; // v1.1
    const params = new URLSearchParams({
      propertyIDs: propertyId, // [FIX] Add propertyIDs to the query string
      roomTypeID: roomTypeId,
      startDate: startDate,
      endDate: endDate,
    });
    // 3. Make the API call
    const response = await axios.get(`${endpoint}?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-PROPERTY-ID': propertyId,
      },
    });

    console.log(`[Sentinel] Successfully fetched rates for ${roomTypeId}`);
    return response.data;

  } catch (error) {
    // ... (Reusing the same robust error handling pattern) ...
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      let errorMsg = 'Unknown error';

      if (contentType && contentType.includes('application/json')) {
        errorMsg = JSON.stringify(error.response.data);
      } else {
        const responseData = typeof error.response.data === 'string'
          ? error.response.data.substring(0, 500)
          : 'Non-string error body';
        errorMsg = `Non-JSON response (HTML Error Page?): ${responseData}...`;
      }
      console.error(`[Sentinel] Error in getRates for ${roomTypeId}. Status: ${error.response.status}.`, errorMsg);
      throw new Error(`Sentinel getRates failed: ${errorMsg}`);
    } else if (error.request) {
      console.error(`[Sentinel] Error in getRates for ${roomTypeId}: No response received.`, error.request);
      throw new Error('Sentinel getRates failed: No response from server.');
    } else {
      console.error(`[Sentinel] Error in getRates for ${roomTypeId} (Setup):`, error.message);
      throw new Error(`Sentinel getRates failed (Setup): ${error.message}`);
    }
  }
}

module.exports = {
  postRate,
  getRatePlans,
  getJobStatus,
  getRoomTypes,
  getRates, // <-- [NEW] Export the new function
};

