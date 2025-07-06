const fetch = require("node-fetch");
const { Client } = require("pg");

// Helper function to get a fresh Cloudbeds Access Token
async function getCloudbedsAccessToken() {
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REFRESH_TOKEN,
  } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: CLOUDBEDS_REFRESH_TOKEN,
  });
  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token)
    throw new Error("Failed to get Cloudbeds access token");
  return tokenData.access_token;
}

// Helper function to ensure we only save valid numbers to the DB
const sanitizeMetric = (metric) => {
  const num = parseFloat(metric);
  return isNaN(num) ? 0 : num;
};

// NEW: Helper function to process the multi-day response from the API
function processApiData(data) {
  const processed = {};
  if (!data.index || !data.records) return processed;

  for (let i = 0; i < data.index.length; i++) {
    const date = data.index[i][0].split("T")[0];
    processed[date] = {};
    for (const metric in data.records) {
      processed[date][metric] = data.records[metric][i];
    }
  }
  return processed;
}

// Main handler for the Vercel Serverless Function
module.exports = async (request, response) => {
  // MODIFIED: Updated log message for new functionality
  console.log("Starting daily FORECAST refresh job...");
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    // --- Step 1: Fetch latest metrics from Cloudbeds for the next 365 days ---
    console.log("Fetching access token...");
    const accessToken = await getCloudbedsAccessToken();
    const { CLOUDBEDS_PROPERTY_ID } = process.env;

    // MODIFIED: Calculate date range from today to +365 days
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 365);
    const startDate = today.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];

    console.log(`Fetching forecast data from ${startDate} to ${endDate}`);

    const columnsToRequest = [
      "adr",
      "occupancy",
      "revpar",
      "rooms_sold",
      "capacity_count",
      "total_revenue",
    ].map((col) => ({ cdf: { column: col }, metrics: ["sum"] }));

    // MODIFIED: Update payload to fetch a date range
    const insightsPayload = {
      property_ids: [parseInt(CLOUDBEDS_PROPERTY_ID)],
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
          "X-PROPERTY-ID": CLOUDBEDS_PROPERTY_ID,
        },
        body: JSON.stringify(insightsPayload),
      }
    );

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `Cloudbeds API Error: ${apiResponse.status} ${errorText}`
      );
    }

    const apiData = await apiResponse.json();
    const processedData = processApiData(apiData);
    const datesToUpdate = Object.keys(processedData);

    if (datesToUpdate.length === 0) {
      console.log("API returned success but with no data to process.");
      return response
        .status(200)
        .json({ status: "Success", message: "No data to process." });
    }

    // --- Step 2: Connect to the database and loop through each day to update it ---
    console.log(
      `Connecting to database to update/insert ${datesToUpdate.length} records...`
    );
    await client.connect();

    const insertQuery = `
      INSERT INTO daily_metrics_snapshots (
          hotel_id, stay_date, adr, occupancy_direct, revpar,
          rooms_sold, capacity_count, total_revenue
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (hotel_id, stay_date) DO UPDATE SET
        adr = EXCLUDED.adr,
        occupancy_direct = EXCLUDED.occupancy_direct,
        revpar = EXCLUDED.revpar,
        rooms_sold = EXCLUDED.rooms_sold,
        capacity_count = EXCLUDED.capacity_count,
        total_revenue = EXCLUDED.total_revenue;
    `;

    // MODIFIED: Loop through each day returned from the API and run the query
    for (const date of datesToUpdate) {
      const metrics = processedData[date];
      const values = [
        CLOUDBEDS_PROPERTY_ID,
        date,
        sanitizeMetric(metrics.adr),
        sanitizeMetric(metrics.occupancy),
        sanitizeMetric(metrics.revpar),
        sanitizeMetric(metrics.rooms_sold),
        sanitizeMetric(metrics.capacity_count),
        sanitizeMetric(metrics.total_revenue),
      ];
      await client.query(insertQuery, values);
    }

    console.log("Database forecast update complete.");

    response
      .status(200)
      .json({ status: "Success", recordsUpdated: datesToUpdate.length });
  } catch (error) {
    console.error("CRON JOB FAILED:", error);
    response.status(500).json({ status: "Failure", error: error.message });
  } finally {
    if (client) {
      await client.end();
      console.log("Database connection closed.");
    }
  }
};
