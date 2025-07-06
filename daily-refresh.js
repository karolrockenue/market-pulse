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

// Main handler for the Vercel Serverless Function
module.exports = async (request, response) => {
  console.log("Starting daily data refresh job...");
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    // --- Step 1: Fetch latest metrics from Cloudbeds for yesterday ---
    console.log("Fetching access token...");
    const accessToken = await getCloudbedsAccessToken();
    const { CLOUDBEDS_PROPERTY_ID } = process.env;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateToFetch = yesterday.toISOString().split("T")[0];
    const dateForAPI = `${dateToFetch}T00:00:00.000Z`;

    console.log(`Fetching data for date: ${dateToFetch}`);

    // Define the columns we need from the Data Insights API
    const columnsToRequest = [
      "adr",
      "occupancy_direct",
      "revpar",
      "rooms_sold",
      "capacity_count",
      "total_revenue",
    ].map((col) => ({ cdf: { column: col }, metrics: ["sum"] }));

    // Construct the correct payload for the Data Insights API
    const insightsPayload = {
      property_ids: [parseInt(CLOUDBEDS_PROPERTY_ID)], // <-- FIX 1: Added property_ids
      dataset_id: 7,
      filters: {
        and: [
          {
            cdf: { column: "stay_date" },
            operator: "equals", // <-- FIX 2: Changed "equal" to "equals"
            value: dateForAPI,
          },
        ],
      },
      columns: columnsToRequest,
      settings: { details: true, totals: false },
    };

    // Use the correct Data Insights API endpoint
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
    if (!apiData.records || Object.keys(apiData.records).length === 0) {
      console.log(
        "API returned success but with no data to process for the date."
      );
      return response
        .status(200)
        .json({ status: "Success", message: "No data to process." });
    }

    const metricsToInsert = apiData.records;

    // --- Step 2: Connect to the database and insert/update data ---
    console.log("Connecting to database...");
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

    const values = [
      CLOUDBEDS_PROPERTY_ID,
      dateToFetch,
      metricsToInsert.adr ? metricsToInsert.adr[0] : 0,
      metricsToInsert.occupancy_direct
        ? metricsToInsert.occupancy_direct[0]
        : 0,
      metricsToInsert.revpar ? metricsToInsert.revpar[0] : 0,
      metricsToInsert.rooms_sold ? metricsToInsert.rooms_sold[0] : 0,
      metricsToInsert.capacity_count ? metricsToInsert.capacity_count[0] : 0,
      metricsToInsert.total_revenue ? metricsToInsert.total_revenue[0] : 0,
    ];

    await client.query(insertQuery, values);

    console.log("Database insertion/update complete.");

    response.status(200).json({ status: "Success", recordsInserted: 1 });
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
