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
 * [FIX] A more robust, library-free timezone helper for European timezones.
 * It correctly calculates the start and end of DST.
 * @param {string} dateString - A date in 'YYYY-MM-DD' format.
 * @returns {string} An ISO 8601 timestamp string for midnight in the corrected timezone.
 */
const _getMewsUtcTimestamp = (dateString) => {
  const date = new Date(dateString + "T12:00:00Z"); // Use midday to avoid off-by-one date issues
  const year = date.getUTCFullYear();

  // In the EU, DST starts on the last Sunday of March and ends on the last Sunday of October.
  const dstStart = new Date(Date.UTC(year, 2, 31, 1)); // 1 AM on March 31st
  dstStart.setUTCDate(dstStart.getUTCDate() - dstStart.getUTCDay());

  const dstEnd = new Date(Date.UTC(year, 9, 31, 1)); // 1 AM on Oct 31st
  dstEnd.setUTCDate(dstEnd.getUTCDate() - dstEnd.getUTCDay());

  // Check if the given date falls within the DST period
  const isDst = date >= dstStart && date < dstEnd;

  // Apply the correct offset (+02:00 for summer/DST, +01:00 for winter)
  const offsetString = isDst ? "+02:00" : "+01:00";
  const localTime = `${dateString}T00:00:00.000${offsetString}`;

  return new Date(localTime).toISOString();
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
 * @returns {Promise<object>} An object containing the daily metrics and the raw API response.
 */
const getOccupancyMetrics = async (credentials, startDate, endDate) => {
  const serviceId = "bd26d8db-86da-4f96-9efc-e5a4654a4a94";

  const availabilityPayload = {
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: _getMewsUtcTimestamp(startDate), // Use new robust helper
    LastTimeUnitStartUtc: _getMewsUtcTimestamp(endDate), // Use new robust helper
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
 * @returns {Promise<object>} An object containing the daily revenue metrics and the raw API response.
 */
const getRevenueMetrics = async (credentials, startDate, endDate) => {
  let allOrderItems = [];
  let cursor = null;

  do {
    const payload = {
      ConsumedUtc: {
        StartUtc: _getMewsUtcTimestamp(startDate), // Use new robust helper
        EndUtc: _getMewsUtcTimestamp(endDate), // Use new robust helper
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
    const consumedTime = new Date(item.ConsumedUtc);
    consumedTime.setHours(consumedTime.getHours() + 5);
    const date = consumedTime.toISOString().split("T")[0];
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
