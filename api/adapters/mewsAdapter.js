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
    const requestBody = {
      ClientToken: credentials.clientToken,
      AccessToken: credentials.accessToken,
      Client: "Market Pulse 1.0.0",
      ...data,
    };
    const response = await axios.post(
      `${MEWS_API_BASE_URL}/api/connector/v1/${endpoint}`,
      requestBody
    );
    return response.data;
  } catch (error) {
    console.error(
      `Mews API Error calling [${endpoint}]:`,
      error.response ? error.response.data : error.message
    );
    throw new Error(`Failed to call Mews API endpoint: ${endpoint}.`);
  }
};

/**
 * [FINAL FIX] Returns a simple midnight UTC timestamp string as required by Mews API examples.
 * @param {string} dateString - A date in 'YYYY-MM-DD' format.
 * @returns {string} An ISO 8601 timestamp string for midnight UTC.
 */
const _getMewsUtcTimestamp = (dateString) => {
  return `${dateString}T00:00:00Z`;
};

/**
 * Fetches property configuration details from Mews and maps them to our canonical data model.
 * @param {object} credentials - The credentials for the property.
 * @returns {Promise<object>} A standardized hotel details object.
 */
const getHotelDetails = async (credentials) => {
  const response = await _callMewsApi("configuration/get", credentials);
  const { Enterprise } = response;
  const defaultCurrency = Enterprise.Currencies.find(
    (c) => c.IsDefault === true
  );
  const hotelDetails = {
    propertyName: Enterprise.Name,
    city: Enterprise.Address.City,
    currencyCode: defaultCurrency ? defaultCurrency.Currency : null,
    latitude: Enterprise.Address.Latitude,
    longitude: Enterprise.Address.Longitude,
    pmsType: "mews",
    rawResponse: response,
  };
  return hotelDetails;
};

/**
 * Fetches daily occupancy metrics for a date range using the Mews 'getAvailability' endpoint.
 * @param {object} credentials - The credentials for the property.
 * @param {string} startDate - The start date of the range, in 'YYYY-MM-DD' format.
 * @param {string} endDate - The end date of the range, in 'YYYY-MM-DD' format.
 * @param {string} timezone - The IANA timezone name for the hotel.
 * @returns {Promise<object>} An object containing the daily metrics and the raw API response.
 */
const getOccupancyMetrics = async (
  credentials,
  startDate,
  endDate,
  timezone
) => {
  // Add a timezone parameter to the function signature.
  const serviceId = "bd26d8db-86da-4f96-9efc-e5a4654a4a94";

  const availabilityPayload = {
    ServiceId: serviceId,
    // Pass the hotel's timezone to the timestamp generation function.
    FirstTimeUnitStartUtc: _getMewsUtcTimestamp(startDate, timezone),
    LastTimeUnitStartUtc: _getMewsUtcTimestamp(endDate, timezone),
    Metrics: ["Occupied", "ActiveResources"],
  };

  const response = await _callMewsApi(
    "services/getAvailability/2024-01-22",
    credentials,
    availabilityPayload
  );

  const dailyTotals = {};

  if (
    response.ResourceCategoryAvailabilities &&
    response.ResourceCategoryAvailabilities.length > 0
  ) {
    response.TimeUnitStartsUtc.forEach((utcDate) => {
      const date = new Date(utcDate).toISOString().split("T")[0];
      dailyTotals[date] = { occupied: 0, available: 0 };
    });
    response.ResourceCategoryAvailabilities.forEach((category) => {
      const occupiedValues = category.Metrics.Occupied;
      const availableValues = category.Metrics.ActiveResources;
      response.TimeUnitStartsUtc.forEach((utcDate, index) => {
        const date = new Date(utcDate).toISOString().split("T")[0];
        if (dailyTotals[date]) {
          dailyTotals[date].occupied += occupiedValues[index] || 0;
          dailyTotals[date].available += availableValues[index] || 0;
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
 * @param {string} timezone - The IANA timezone name for the hotel.
 * @returns {Promise<object>} An object containing the daily revenue metrics and the raw API response.
 */
const getRevenueMetrics = async (credentials, startDate, endDate, timezone) => {
  // Add a timezone parameter to the function signature.
  let allOrderItems = [];
  let cursor = null;

  do {
    const payload = {
      ConsumedUtc: {
        // Pass the hotel's timezone to the timestamp generation function.
        StartUtc: _getMewsUtcTimestamp(startDate, timezone),
        EndUtc: _getMewsUtcTimestamp(endDate, timezone),
      },
      Types: ["SpaceOrder"],
      AccountingStates: ["Open", "Closed"],
      Limitation: { Cursor: cursor, Count: 1000 },
    };

    const response = await _callMewsApi(
      "orderItems/getAll",
      credentials,
      payload
    );
    if (response.OrderItems) {
      allOrderItems = allOrderItems.concat(response.OrderItems);
    }
    cursor = response.Cursor;
  } while (cursor);

  const dailyTotals = {};
  allOrderItems.forEach((item) => {
    // The item's ConsumedUtc is already the correct UTC time. We just need to format it.
    const date = item.ConsumedUtc.split("T")[0];

    if (!dailyTotals[date]) {
      dailyTotals[date] = { totalNetRevenue: 0, totalGrossRevenue: 0 };
    }
    if (item.Amount) {
      if (typeof item.Amount.NetValue === "number") {
        dailyTotals[date].totalNetRevenue += item.Amount.NetValue;
      }
      if (typeof item.Amount.GrossValue === "number") {
        dailyTotals[date].totalGrossRevenue += item.Amount.GrossValue;
      }
    }
  });

  const results = Object.keys(dailyTotals).map((date) => ({
    date,
    netRevenue: dailyTotals[date].totalNetRevenue,
    grossRevenue: dailyTotals[date].totalGrossRevenue,
  }));

  return {
    dailyMetrics: results,
    rawItems: allOrderItems,
  };
};

module.exports = {
  getHotelDetails,
  getOccupancyMetrics,
  getRevenueMetrics,
};
