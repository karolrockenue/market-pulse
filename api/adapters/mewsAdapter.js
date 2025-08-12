// Using 'axios' for making HTTP requests. Ensure it's installed in the project.
const axios = require("axios");

// Base URL for the Mews Demo environment
const MEWS_API_BASE_URL = "https://api.mews-demo.com";

/**
 * A private helper function to handle all API calls to the Mews Connector API.
 * @param {string} endpoint - The Mews API endpoint to call (e.g., 'configuration/get').
 * @param {object} credentials - The credentials for the property.
 * @param {string} credentials.clientToken - The client token for our application.
 * @param {string} credentials.accessToken - The access token for the specific property.
 * @param {object} [data={}] - Additional data for the request body.
 * @returns {Promise<object>} - The data from the API response.
 */
const _callMewsApi = async (endpoint, credentials, data = {}) => {
  try {
    // Prepare the request body with authentication tokens, as required by Mews.
    const requestBody = {
      ClientToken: credentials.clientToken,
      AccessToken: credentials.accessToken,
      Client: "Market Pulse 1.0.0", // As required by Mews API
      ...data,
    };

    // Make a POST request to the specified Mews endpoint
    const response = await axios.post(
      `${MEWS_API_BASE_URL}/api/connector/v1/${endpoint}`,
      requestBody
    );

    // Return the data part of the response
    return response.data;
  } catch (error) {
    // Log detailed error information for debugging
    console.error(
      `Mews API Error calling [${endpoint}]:`,
      error.response ? error.response.data : error.message
    );
    // Rethrow the error to be handled by the calling function
    throw new Error(`Failed to call Mews API endpoint: ${endpoint}.`);
  }
};

/**
 * Fetches property configuration details from Mews and maps them to our canonical data model.
 * @param {object} credentials - The credentials for the property.
 * @param {string} credentials.clientToken - The client token for our application.
 * @param {string} credentials.accessToken - The access token for the specific property.
 * @returns {Promise<object>} A standardized hotel details object.
 */
const getHotelDetails = async (credentials) => {
  // Call the Mews configuration endpoint
  const response = await _callMewsApi("configuration/get", credentials);

  const { Enterprise } = response;

  // Find the default currency
  const defaultCurrency = Enterprise.Currencies.find(
    (c) => c.IsDefault === true
  );

  // Transform the Mews response into our internal standard format
  const hotelDetails = {
    propertyName: Enterprise.Name,
    city: Enterprise.Address.City,
    currencyCode: defaultCurrency ? defaultCurrency.Currency : null,
    latitude: Enterprise.Address.Latitude,
    longitude: Enterprise.Address.Longitude,
    pmsType: "mews", // Set the PMS type
    rawResponse: response, // Optionally store the original response for debugging
  };

  return hotelDetails;
};
/**
 * Fetches daily occupancy metrics for a date range using the Mews 'getAvailability' endpoint.
 * This function includes a timezone correction for the 'Europe/Budapest' demo hotel.
 * @param {object} credentials - The credentials for the property.
 * @param {string} credentials.clientToken - The client token for our application.
 * @param {string} credentials.accessToken - The access token for the specific property.
 * @param {string} startDate - The start date of the range, in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end date of the range, in 'YYYY-MM-DD' format.
 * @returns {Promise<object>} An object containing the daily metrics and the raw API response.
 */
const getOccupancyMetrics = async (credentials, startDate, endDate) => {
  // NOTE: The ServiceId should be fetched and stored when a hotel is connected.
  const serviceId = "bd26d8db-86da-4f96-9efc-e5a4654a4a94";

  // This helper function calculates the correct UTC timestamp for the 'Europe/Budapest' timezone.
  // WARNING: This is for demonstration. A production solution must use a robust
  // date-time library (e.g., date-fns-tz) to handle all timezones and DST correctly.
  const getMewsUtcTimestamp = (dateString) => {
    const date = new Date(dateString);
    const month = date.getUTCMonth(); // 0-indexed (0=Jan, 9=Oct)
    const isDst = month > 2 && month < 10;
    const offsetString = isDst ? "+02:00" : "+01:00";
    const localTime = `${dateString}T00:00:00.000${offsetString}`;
    return new Date(localTime).toISOString();
  };

  const availabilityPayload = {
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: getMewsUtcTimestamp(startDate),
    LastTimeUnitStartUtc: getMewsUtcTimestamp(endDate),
    Metrics: ["Occupied", "ActiveResources"],
  };

  const response = await _callMewsApi(
    "services/getAvailability/2024-01-22",
    credentials,
    availabilityPayload
  );

  const dailyTotals = {};

  // --- FIX: Use the correct key 'ResourceCategoryAvailabilities' from the API response. ---
  if (
    response.ResourceCategoryAvailabilities &&
    response.ResourceCategoryAvailabilities.length > 0
  ) {
    // Use the top-level 'TimeUnitStartsUtc' for the date list.
    response.TimeUnitStartsUtc.forEach((utcDate) => {
      const date = new Date(utcDate).toISOString().split("T")[0];
      dailyTotals[date] = { occupied: 0, available: 0 };
    });

    // Iterate over each resource category returned by the API to sum up the metrics.
    response.ResourceCategoryAvailabilities.forEach((category) => {
      const occupiedValues = category.Metrics.Occupied;
      const availableValues = category.Metrics.ActiveResources;

      // Use the top-level dates array for consistent indexing.
      response.TimeUnitStartsUtc.forEach((utcDate, index) => {
        const date = new Date(utcDate).toISOString().split("T")[0];
        if (dailyTotals[date]) {
          dailyTotals[date].occupied += occupiedValues[index] || 0; // Add || 0 for safety
          dailyTotals[date].available += availableValues[index] || 0; // Add || 0 for safety
        }
      });
    });
  }

  const results = Object.keys(dailyTotals).map((date) => ({
    date,
    occupied: dailyTotals[date].occupied,
    available: dailyTotals[date].available,
  }));

  return {
    dailyMetrics: results,
    rawResponse: response,
  };
};

/**
 * Fetches daily revenue metrics for a date range using the Mews 'orderItems/getAll' endpoint.
 * @param {object} credentials - The credentials for the property.
 * @param {string} startDate - The start date of the range, in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end date of the range, in 'YYYY-MM-DD' format.
 * @returns {Promise<object>} An object containing the daily revenue metrics and the raw API response.
 */
const getRevenueMetrics = async (credentials, startDate, endDate) => {
  // Use the same timezone helper from getOccupancyMetrics.
  const getMewsUtcTimestamp = (dateString) => {
    const date = new Date(dateString);
    const month = date.getUTCMonth(); // 0-indexed (0=Jan, 9=Oct)
    const isDst = month > 2 && month < 10;
    const offsetString = isDst ? "+02:00" : "+01:00";
    const localTime = `${dateString}T00:00:00.000${offsetString}`;
    return new Date(localTime).toISOString();
  };

  let allOrderItems = [];
  let cursor = null;

  // Use a do-while loop to handle pagination and fetch all order items.
  do {
    const payload = {
      // Filter by the consumption date range.
      ConsumedUtc: {
        StartUtc: getMewsUtcTimestamp(startDate),
        EndUtc: getMewsUtcTimestamp(endDate),
      },
      // IMPORTANT: Filter by Type to get only room revenue ('SpaceOrder').
      Types: ["SpaceOrder"],
      // BUG FIX #1: Add the AccountingStates filter to exclude canceled orders.
      // This tells the Mews API to only send items that are 'Open' or 'Closed'.
      // This is based on the documentation you provided.
      AccountingStates: ["Open", "Closed"],
      Limitation: {
        Cursor: cursor,
        Count: 1000, // Fetch up to 1000 items per page
      },
    };

    const response = await _callMewsApi(
      "orderItems/getAll",
      credentials,
      payload
    );

    if (response.OrderItems) {
      allOrderItems = allOrderItems.concat(response.OrderItems);
    }
    // Continue fetching pages as long as the API provides a new cursor.
    cursor = response.Cursor;
  } while (cursor);

  // Now process all the fetched order items to sum revenue by day.
  const dailyTotals = {};

  allOrderItems.forEach((item) => {
    // BUG FIX #2: Correct the date grouping for hotel's local timezone.
    // The ConsumedUtc is often late at night (e.g., 22:00Z), which is the previous
    // day in UTC but the correct day in the hotel's local time.
    // We add a 5-hour offset to the timestamp before extracting the date.
    // This pushes the date into the correct local calendar day.
    const consumedTime = new Date(item.ConsumedUtc);
    consumedTime.setHours(consumedTime.getHours() + 5);
    const date = consumedTime.toISOString().split("T")[0];

    // Initialize the totals for this day if they don't exist.
    if (!dailyTotals[date]) {
      dailyTotals[date] = { totalNetRevenue: 0, totalGrossRevenue: 0 };
    }

    // Add the NetValue and GrossValue of the item to the daily total.
    if (item.Amount) {
      if (typeof item.Amount.NetValue === "number") {
        dailyTotals[date].totalNetRevenue += item.Amount.NetValue;
      }
      if (typeof item.Amount.GrossValue === "number") {
        dailyTotals[date].totalGrossRevenue += item.Amount.GrossValue;
      }
    }
  });

  // Convert the dailyTotals object into an array for a cleaner return format.
  const results = Object.keys(dailyTotals).map((date) => ({
    date,
    netRevenue: dailyTotals[date].totalNetRevenue,
    grossRevenue: dailyTotals[date].totalGrossRevenue,
  }));

  return {
    dailyMetrics: results,
    rawItems: allOrderItems, // Return all raw items for debugging
  };
};

module.exports = {
  getHotelDetails,
  getOccupancyMetrics,
  getRevenueMetrics,
};
