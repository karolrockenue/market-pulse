import fetch from "node-fetch";
import { Client } from "pg";

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
export default async function handler(request, response) {
  // Optional: Add a secret to verify the cron job call for security
  // if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return response.status(401).send('Unauthorized');
  // }

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

    console.log(`Fetching data for date: ${dateToFetch}`);

    // This is a hypothetical API call based on the project's needs.
    // You might need to adjust the endpoint or payload based on the actual Cloudbeds API.
    const apiResponse = await fetch(
      `https://api.cloudbeds.com/api/v1.1/getDailyFinancials?propertyID=${CLOUDBEDS_PROPERTY_ID}&date=${dateToFetch}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `Cloudbeds API Error: ${apiResponse.status} ${errorText}`
      );
    }

    const apiData = await apiResponse.json();
    if (!apiData.success || !apiData.data || apiData.data.length === 0) {
      console.log(
        "API returned success but with no data to process for the date."
      );
      return response
        .status(200)
        .json({ status: "Success", message: "No data to process." });
    }

    const metricsToInsert = apiData.data[0]; // Assuming the API returns an array with one object for the day

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
      metricsToInsert.adr,
      metricsToInsert.occupancy_direct,
      metricsToInsert.revpar,
      metricsToInsert.rooms_sold,
      metricsToInsert.capacity_count,
      metricsToInsert.total_revenue,
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
}
