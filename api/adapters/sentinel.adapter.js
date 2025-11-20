/**
 * @file sentinel.adapter.js
 * @brief Sentinel AI Adapter (Production Bridge)
 * * REFACTOR STATUS: BRIDGE ACTIVE
 * This adapter now uses the main application's 'cloudbedsAdapter.js'
 * to fetch authentication tokens. It is no longer firewalled.
 * * It performs "Intelligent" read/writes:
 * - Rate Posting (Batch & Single)
 * - Real-time Rate Lookups
 * - Configuration Fact Syncing
 */

const axios = require('axios');
const { getAccessToken } = require('./cloudbedsAdapter'); // <-- The Bridge

// Cloudbeds API constants
const CLOUDBEDS_API_URL = 'https://api.cloudbeds.com/api/v1.1';

/**
 * Private Helper: Generates authenticated headers for Cloudbeds API.
 * Uses the Internal Hotel ID to get the Token from DB, and External ID for the Header.
 */
async function getHeaders(hotelId, pmsPropertyId) {
  if (!hotelId) throw new Error('Sentinel Adapter: hotelId (Internal) is required for authentication.');
  if (!pmsPropertyId) throw new Error('Sentinel Adapter: pmsPropertyId (External) is required for API routing.');

  // Borrow the token using the main adapter's logic
  const token = await getAccessToken(hotelId);

  return {
    'Authorization': `Bearer ${token}`,
    'X-PROPERTY-ID': pmsPropertyId,
    // Axios adds Content-Type automatically for objects/params
  };
}

/**
 * Posts a rate update to Cloudbeds (Single).
 * @param {number|string} hotelId - Internal DB ID (for Auth).
 * @param {string} pmsPropertyId - External Cloudbeds ID (for Routing).
 * @param {string} rateId - The ID of the rate plan to update.
 * @param {string} date - The date to update (YYYY-MM-DD).
 * @param {number} rate - The new rate to set.
 */
async function postRate(hotelId, pmsPropertyId, rateId, date, rate) {
  console.log(`[Sentinel] Posting rate for ${hotelId} (PMS: ${pmsPropertyId}): ${rate} on ${date}`);

  try {
    const headers = await getHeaders(hotelId, pmsPropertyId);
    const endpoint = `${CLOUDBEDS_API_URL}/putRate`; // v1.3

    const params = new URLSearchParams();
    params.append('rates[0][rateID]', rateId);
    params.append('rates[0][interval][0][startDate]', date);
    params.append('rates[0][interval][0][endDate]', date);
    params.append('rates[0][interval][0][rate]', rate);

    const response = await axios.post(endpoint, params, { headers });
    
    return response.data;

  } catch (error) {
    handleAxiosError(error, 'postRate');
  }
}

/**
 * Posts a BATCH of rate updates to Cloudbeds.
 * @param {number|string} hotelId - Internal DB ID.
 * @param {string} pmsPropertyId - External Cloudbeds ID.
 * @param {Array} ratesArray - Array of { rateId, date, rate }
 */
async function postRateBatch(hotelId, pmsPropertyId, ratesArray) {
  console.log(`[Sentinel] Batch posting ${ratesArray.length} rates for ${hotelId} (PMS: ${pmsPropertyId})`);

  if (!ratesArray || ratesArray.length === 0) {
    return { success: true, message: 'No rates to post.' };
  }

  try {
    const headers = await getHeaders(hotelId, pmsPropertyId);
    const endpoint = `${CLOUDBEDS_API_URL}/putRate`; // v1.3

    const params = new URLSearchParams();
    ratesArray.forEach((item, index) => {
      params.append(`rates[${index}][rateID]`, item.rateId);
      params.append(`rates[${index}][interval][0][startDate]`, item.date);
      params.append(`rates[${index}][interval][0][endDate]`, item.date);
      params.append(`rates[${index}][interval][0][rate]`, item.rate);
    });

    const response = await axios.post(endpoint, params, { headers });

    console.log(`[Sentinel] Batch Job ID: ${response.data.jobReferenceID}`);
    return response.data;

  } catch (error) {
    handleAxiosError(error, 'postRateBatch');
  }
}

/**
 * Fetches rate plans (Facts Sync).
 */
async function getRatePlans(hotelId, pmsPropertyId) {
  console.log(`[Sentinel] Fetching Rate Plans for ${hotelId}`);
  try {
    const headers = await getHeaders(hotelId, pmsPropertyId);
    const endpoint = `${CLOUDBEDS_API_URL}/getRatePlans`;

    // Use 90 day window to ensure we capture active plans
    const today = new Date().toISOString().split('T')[0];
    const future = new Date();
    future.setDate(new Date().getDate() + 90);
    const endDate = future.toISOString().split('T')[0];

    const params = new URLSearchParams({
      propertyIDs: pmsPropertyId,
      startDate: today,
      endDate: endDate,
    });

    const response = await axios.get(`${endpoint}?${params.toString()}`, { headers });
    return response.data;

  } catch (error) {
    handleAxiosError(error, 'getRatePlans');
  }
}

/**
 * Fetches room types (Facts Sync).
 */
async function getRoomTypes(hotelId, pmsPropertyId) {
  console.log(`[Sentinel] Fetching Room Types for ${hotelId}`);
  try {
    const headers = await getHeaders(hotelId, pmsPropertyId);
    const endpoint = `${CLOUDBEDS_API_URL}/getRoomTypes`;
    
    const response = await axios.get(endpoint, { headers });
    return response.data;

  } catch (error) {
    handleAxiosError(error, 'getRoomTypes');
  }
}

/**
 * Fetches live rates for a specific room (Rate Manager).
 */
async function getRates(hotelId, pmsPropertyId, roomTypeId, startDate, endDate) {
  console.log(`[Sentinel] Fetching Live Rates for ${hotelId} (Room: ${roomTypeId})`);
  try {
    const headers = await getHeaders(hotelId, pmsPropertyId);
    const endpoint = 'https://api.cloudbeds.com/api/v1.3/getRate';

    const params = new URLSearchParams({
      roomTypeID: roomTypeId,
      startDate: startDate,
      endDate: endDate,
      detailedRates: 'false'
    });

    const response = await axios.get(`${endpoint}?${params.toString()}`, { headers });
    return response.data;

  } catch (error) {
    handleAxiosError(error, 'getRates');
  }
}

/**
 * Checks Async Job Status.
 */
async function getJobStatus(hotelId, pmsPropertyId, jobId) {
  try {
    const headers = await getHeaders(hotelId, pmsPropertyId);
    const endpoint = `${CLOUDBEDS_API_URL}/getRateJobs`;
    const params = new URLSearchParams({ jobReferenceID: jobId });

    const response = await axios.get(`${endpoint}?${params.toString()}`, { headers });
    return response.data;

  } catch (error) {
    handleAxiosError(error, 'getJobStatus');
  }
}

/**
 * Standardized Error Handler for Axios
 */
function handleAxiosError(error, context) {
  if (error.response) {
    const data = error.response.data;
    const errorStr = typeof data === 'object' ? JSON.stringify(data) : data;
    console.error(`[Sentinel] ${context} API Error:`, errorStr);
    throw new Error(`Cloudbeds API (${context}): ${errorStr}`);
  } else if (error.request) {
    console.error(`[Sentinel] ${context} No Response:`, error.request);
    throw new Error(`Cloudbeds API (${context}): No response received.`);
  } else {
    console.error(`[Sentinel] ${context} Setup Error:`, error.message);
    throw new Error(`Sentinel Adapter (${context}): ${error.message}`);
  }
}

module.exports = {
  postRate,
  postRateBatch,
  getRatePlans,
  getRoomTypes,
  getRates,
  getJobStatus
};