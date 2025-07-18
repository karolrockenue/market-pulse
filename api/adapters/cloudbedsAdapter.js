// /api/adapters/cloudbedsAdapter.js
// This file houses all logic specific to interacting with the Cloudbeds API.

const fetch = require("node-fetch");

/**
 * A private helper function to process raw API data for historical syncs.
 * @param {Array} allData - Raw data from all pages of the API response.
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
function processApiDataForTable(allData) {
  // ... (existing code, no changes)
  const aggregatedData = {};
  if (!allData || allData.length === 0) return aggregatedData;
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      // Standardize the date format to YYYY-MM-DD to remove timezone ambiguity.
      const date = page.index[i][0].split("T")[0];
      if (!aggregatedData[date]) {
        aggregatedData[date] = {
          rooms_sold: 0,
          capacity_count: 0,
          total_revenue: 0,
          room_revenue: 0,
        };
      }
      aggregatedData[date].rooms_sold +=
        parseFloat(page.records.rooms_sold?.[i]) || 0;
      aggregatedData[date].capacity_count +=
        parseFloat(page.records.capacity_count?.[i]) || 0;
      aggregatedData[date].total_revenue +=
        parseFloat(page.records.total_revenue?.[i]) || 0;
      aggregatedData[date].room_revenue +=
        parseFloat(page.records.room_revenue?.[i]) || 0;
    }
  }
  for (const date in aggregatedData) {
    const metrics = aggregatedData[date];
    metrics.adr =
      metrics.rooms_sold > 0 ? metrics.room_revenue / metrics.rooms_sold : 0;
    metrics.occupancy =
      metrics.capacity_count > 0
        ? metrics.rooms_sold / metrics.capacity_count
        : 0;
    metrics.revpar = metrics.adr * metrics.occupancy;
  }
  return aggregatedData;
}

/**
 * NEW: A private helper function to process raw API data for daily forecast syncs.
 * @param {Object} data - Raw data from the API response.
 * @returns {Object} - An object with dates as keys and calculated metrics as values.
 */
function aggregateForecastData(data) {
  const aggregated = {};
  if (!data.index || !data.records) return aggregated;
  const sanitizeMetric = (metric) => {
    const num = parseFloat(metric);
    return isNaN(num) ? 0 : num;
  };
  for (let i = 0; i < data.index.length; i++) {
    const date = data.index[i][0].split("T")[0];
    if (!aggregated[date]) {
      aggregated[date] = {
        rooms_sold: 0,
        capacity_count: 0,
        total_revenue: 0,
        total_revenue_for_adr: 0,
      };
    }
    const roomsSoldForRow = sanitizeMetric(data.records.rooms_sold?.[i]);
    aggregated[date].rooms_sold += roomsSoldForRow;
    aggregated[date].capacity_count += sanitizeMetric(
      data.records.capacity_count?.[i]
    );
    aggregated[date].total_revenue += sanitizeMetric(
      data.records.total_revenue?.[i]
    );
    aggregated[date].total_revenue_for_adr +=
      sanitizeMetric(data.records.adr?.[i]) * roomsSoldForRow;
  }
  for (const date in aggregated) {
    const dayData = aggregated[date];
    dayData.adr =
      dayData.rooms_sold > 0
        ? dayData.total_revenue_for_adr / dayData.rooms_sold
        : 0;
    dayData.occupancy =
      dayData.capacity_count > 0
        ? dayData.rooms_sold / dayData.capacity_count
        : 0;
    dayData.revpar = dayData.adr * dayData.occupancy;
  }
  return aggregated;
}

/**
 * Gets a neighborhood name from geographic coordinates using the Nominatim API.
 * @param {number} latitude The latitude of the location.
 * @param {number} longitude The longitude of the location.
 * @returns {Promise<string|null>} The neighborhood name or null if not found.
 */
async function getNeighborhoodFromCoords(latitude, longitude) {
  // ... (existing code, no changes)
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "MarketPulseApp/1.0 (karol@rockvenue.com)" },
    });
    if (!response.ok) {
      throw new Error(`Nominatim API returned status: ${response.status}`);
    }
    const data = await response.json();
    return (
      data.address.neighbourhood ||
      data.address.suburb ||
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
  endDate
) {
  // ... (existing code, no changes)
  const columnsToRequest = [
    "adr",
    "revpar",
    "total_revenue",
    "room_revenue",
    "occupancy",
    "rooms_sold",
    "capacity_count",
  ].map((column) => ({ cdf: { column }, metrics: ["sum", "mean"] }));
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
  do {
    const insightsPayload = { ...initialInsightsPayload };
    if (nextToken) insightsPayload.nextToken = nextToken;
    console.log(
      `Adapter: Fetching page ${pageNum} for property ${propertyId}...`
    );
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
    if (!apiResponse.ok)
      throw new Error(
        `API Error on page ${pageNum}: ${apiResponse.status}: ${responseText}`
      );
    const pageData = JSON.parse(responseText);
    allApiData.push(pageData);
    nextToken = pageData.nextToken || null;
    pageNum++;
  } while (nextToken);
  return processApiDataForTable(allApiData);
}

/**
 * NEW: Fetches and processes upcoming (forecast) metrics for the next 365 days.
 * @param {string} accessToken - A valid Cloudbeds access token or API key.
 * @param {string} propertyId - The ID of the property to fetch data for.
 * @returns {Promise<Object>} The processed forecast data in our canonical format.
 */
async function getUpcomingMetrics(accessToken, propertyId) {
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
  ].map((col) => ({ cdf: { column: col }, metrics: ["sum"] }));

  const insightsPayload = {
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

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    throw new Error(
      `API Error for property ${propertyId}: ${apiResponse.status} - ${errorText}`
    );
  }

  const apiData = await apiResponse.json();
  // Use the private helper to process the raw forecast data.
  return aggregateForecastData(apiData);
}

// Export all public functions.
module.exports = {
  getNeighborhoodFromCoords,
  getHistoricalMetrics,
  getUpcomingMetrics, // Export the new function
};
