// replace with this
const axios = require("axios");
const dateFnsTz = require("date-fns-tz");
console.log("Inspecting date-fns-tz library:", dateFnsTz);

const MEWS_API_BASE_URL = "https://api.mews-demo.com";
/**
 * A private helper to correctly format timestamps for the Mews API.
 * It takes a date string (e.g., "2025-08-13") and a timezone (e.g., "Europe/Budapest")
 * and converts it to the exact UTC timestamp for the beginning of that day in that zone.
 * @param {string} dateString - The date in YYYY-MM-DD format.
 * @param {string} timezone - The IANA timezone identifier.
 * @returns {string} An ISO 8601 formatted string in UTC.
 */
// replace with this
const _getUtcTimestampForMews = (dateString, timezone) => {
  // Combine date with midnight time
  const localTime = `${dateString}T00:00:00`;
  // Use fromZonedTime, which correctly converts a wall-clock time
  // in a specific timezone into a standard UTC Date object.
  const utcDate = dateFnsTz.fromZonedTime(localTime, timezone);
  // Return in ISO format (e.g., "2025-08-12T22:00:00.000Z")
  return utcDate.toISOString();
};

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
    // replace with this
  } catch (error) {
    // Log detailed error information for debugging
    const errorMessage = error.response
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error(`Mews API Error calling [${endpoint}]:`, errorMessage);

    // Rethrow the error with the specific API message for better debugging upstream.
    throw new Error(`Mews API call to ${endpoint} failed: ${errorMessage}`);
  }
};

/**
 * Fetches property configuration details from Mews and maps them to our canonical data model.
 * @param {object} credentials - The credentials for the property.
 * @param {string} credentials.clientToken - The client token for our application.
 * @param {string} credentials.accessToken - The access token for the specific property.
 * @returns {Promise<object>} A standardized hotel details object.
 */
// replace with this
// replace with this
const getHotelDetails = async (credentials) => {
  // Call the Mews configuration endpoint
  const response = await _callMewsApi("configuration/get", credentials);

  // Find the default currency
  const defaultCurrency = response.Enterprise.Currencies.find(
    (c) => c.IsDefault === true
  );

  // Transform the Mews response into our internal standard format
  const hotelDetails = {
    propertyName: response.Enterprise.Name,
    city: response.Enterprise.Address.City,
    currencyCode: defaultCurrency ? defaultCurrency.Currency : null,
    latitude: response.Enterprise.Address.Latitude,
    longitude: response.Enterprise.Address.Longitude,
    timezone: response.Enterprise.TimeZoneIdentifier,
    // --- ADDING NEW FIELDS ---
    address_1: response.Enterprise.Address.Line1,
    zip_postal_code: response.Enterprise.Address.PostalCode,
    country: response.Enterprise.Address.CountryCode,
    // --- END NEW FIELDS ---
    pmsType: "mews",
    rawResponse: response,
  };

  return hotelDetails;
};

// add this new function
/**
 * Fetches all services for a property and finds the ID of the 'Accommodation' service.
 * @param {object} credentials - The credentials for the property.
 * @returns {Promise<string>} The ID of the accommodation service.
 * @throws Will throw an error if the accommodation service cannot be found.
 */
// replace with this
// replace with this
const getAccommodationServiceId = async (credentials) => {
  // Call the Mews services/getAll endpoint.
  const response = await _callMewsApi("services/getAll", credentials);

  // Find the service with the Type 'Reservable'. Based on the API response,
  // this is the service type that provides room availability and occupancy data.
  // replace with this
  const accommodationService = response.Services.find(
    (service) => service.Type === "Reservable" && service.IsActive === true
  );

  // If the service isn't found, we cannot proceed. Throw an error.
  if (!accommodationService) {
    // Corrected the error message to be more specific.
    throw new Error("Could not find a 'Reservable' service for this property.");
  }

  // Return the unique identifier of the accommodation service.
  return accommodationService.Id;
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
// replace with this
// replace with this
const getOccupancyMetrics = async (
  credentials,
  startDate,
  endDate,
  timezone = "Europe/Budapest"
) => {
  const serviceId = await getAccommodationServiceId(credentials);

  const availabilityPayload = {
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: _getUtcTimestampForMews(startDate, timezone),
    LastTimeUnitStartUtc: _getUtcTimestampForMews(endDate, timezone),
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
          dailyTotals[date].occupied +=
            (occupiedValues ? occupiedValues[index] : 0) || 0;
          dailyTotals[date].available +=
            (availableValues ? availableValues[index] : 0) || 0;
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
// replace with this
const getRevenueMetrics = async (
  credentials,
  startDate,
  endDate,
  timezone = "Europe/Budapest" // Add timezone parameter with a default for testing
) => {
  let allOrderItems = [];
  let cursor = null;

  // Use a do-while loop to handle pagination and fetch all order items.
  do {
    const payload = {
      // Filter by the consumption date range using the new robust helper.
      ConsumedUtc: {
        StartUtc: _getUtcTimestampForMews(startDate, timezone),
        EndUtc: _getUtcTimestampForMews(endDate, timezone),
      },
      Types: ["SpaceOrder"], // Get only room revenue.
      AccountingStates: ["Open", "Closed"], // Exclude canceled orders.
      Limitation: {
        Cursor: cursor,
        Count: 1000,
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
    cursor = response.Cursor;
  } while (cursor);

  // Process all fetched items to sum revenue by day.
  const dailyTotals = {};

  allOrderItems.forEach((item) => {
    // The ConsumedUtc timestamp is the start of the day in the hotel's local time,
    // but represented in UTC. We can safely convert this to an ISO string and
    // take the date part.
    const date = new Date(item.ConsumedUtc).toISOString().split("T")[0];

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

  // Convert the dailyTotals object into a clean array.
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

// replace with this
module.exports = {
  getHotelDetails,
  getAccommodationServiceId, // Add the new function here
  getOccupancyMetrics,
  getRevenueMetrics,
};
