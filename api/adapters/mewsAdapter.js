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
    // Check if the required environment variable is set.
    if (!process.env.MEWS_CLIENT_TOKEN) {
      throw new Error("MEWS_CLIENT_TOKEN environment variable is not set.");
    }

    // Prepare the request body.
    const requestBody = {
      // The ClientToken is now read from the secure environment variables.
      ClientToken: process.env.MEWS_CLIENT_TOKEN,
      // The AccessToken is still passed in per-property.
      AccessToken: credentials.accessToken,
      Client: "Market Pulse 1.0.0", // As required by Mews API
      ...data,
    };
    console.log(
      "DEBUG: Sending to Mews API:",
      JSON.stringify(requestBody, null, 2)
    );

    // Make a POST request to the specified Mews endpoint.
    const response = await axios.post(
      `${MEWS_API_BASE_URL}/api/connector/v1/${endpoint}`,
      requestBody
    );

    // Return the data part of the response.
    return response.data;
  } catch (error) {
    // Log detailed error information for debugging.
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
    pmsPropertyId: response.Enterprise.Id,
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
// replace with this
const getOccupancyMetrics = async (
  credentials,
  startDate,
  endDate,
  timezone = "Europe/Budapest"
) => {
  // --- PART 1: Get Total Room Capacity ---
  // We still call getAvailability, but only to get the total number of ActiveResources.
  const serviceId = await getAccommodationServiceId(credentials);
  const availabilityPayload = {
    ServiceId: serviceId,
    FirstTimeUnitStartUtc: _getUtcTimestampForMews(startDate, timezone),
    LastTimeUnitStartUtc: _getUtcTimestampForMews(endDate, timezone),
    Metrics: ["ActiveResources"], // We only need the total capacity from this endpoint.
  };
  const availabilityData = await _callMewsApi(
    "services/getAvailability/2024-01-22",
    credentials,
    availabilityPayload
  );

  // --- PART 2: Get Confirmed Reservations ---
  // We call reservations/getAll to get a list of confirmed bookings.
  const reservationsPayload = {
    CollidingUtc: {
      StartUtc: _getUtcTimestampForMews(startDate, timezone),
      EndUtc: _getUtcTimestampForMews(endDate, timezone),
    },
    States: ["Confirmed", "Started", "Processed"],
    Limitation: { Count: 1000 }, // Assuming we handle pagination later if needed.
  };
  const reservationData = await _callMewsApi(
    "reservations/getAll/2023-06-06",
    credentials,
    reservationsPayload
  );

  // --- PART 3: Process and Combine the Data ---
  const dailyMetrics = {};
  const { Reservations } = reservationData;

  // Initialize our results object with dates and total capacity.
  availabilityData.TimeUnitStartsUtc.forEach((utcDate) => {
    const date = new Date(utcDate).toISOString().split("T")[0];
    dailyMetrics[date] = {
      occupied: 0,
      available: 0,
    };
    // Sum the capacity from all resource categories for this date.
    availabilityData.ResourceCategoryAvailabilities.forEach((category) => {
      const index = availabilityData.TimeUnitStartsUtc.indexOf(utcDate);
      dailyMetrics[date].available +=
        category.Metrics.ActiveResources[index] || 0;
    });
  });

  // Loop through each reservation to count "occupied" rooms for each day.
  if (Reservations && Reservations.length > 0) {
    Reservations.forEach((res) => {
      const resStart = new Date(res.ScheduledStartUtc);
      const resEnd = new Date(res.ScheduledEndUtc);

      // Iterate through each day in our dailyMetrics object.
      for (const dateStr in dailyMetrics) {
        const currentDay = new Date(dateStr);
        // A reservation occupies a room on a given day if the day is
        // on or after the start date AND before the end date.
        if (currentDay >= resStart && currentDay < resEnd) {
          dailyMetrics[dateStr].occupied += 1;
        }
      }
    });
  }

  const results = Object.keys(dailyMetrics).map((date) => ({
    date,
    occupied: dailyMetrics[date].occupied,
    available: dailyMetrics[date].available,
  }));

  return { dailyMetrics: results }; // Return a cleaner response now.
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

// add this new function before module.exports
/**
 * [QUICK TEST] Fetches a raw list of reservations for a given date range.
 * @param {object} credentials The Mews API credentials.
 * @param {string} startDate The start date of the range in 'YYYY-MM-DD' format.
 * @param {string} endDate The end date of the range in 'YYYY-MM-DD' format.
 * @param {string} timezone The IANA timezone identifier.
 * @returns {Promise<object>} The raw response from the Mews API.
 */

// replace with this
module.exports = {
  getHotelDetails,
  getAccommodationServiceId,
  getOccupancyMetrics,
  getRevenueMetrics,
  // Add the new test function here
};
