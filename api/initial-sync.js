// Add the fetch import back to the file.
const fetch = require("node-fetch");
// /api/initial-sync.js (Refactored to use Adapter)
// Use the shared, correctly configured database pool.
const pgPool = require("./utils/db");
// Import the adapter instead of node-fetch.
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");

// The getCloudbedsAccessToken and processApiDataForTable helpers are no longer needed here.

// --- MAIN HANDLER ---
module.exports = async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  const { propertyId } = request.body;
  if (!propertyId) {
    return response.status(400).json({ error: "A propertyId is required." });
  }

  console.log(`Starting 15-YEAR initial sync for property: ${propertyId}`);

  let totalRecordsUpdated = 0;

  try {
    // Fetch user and authentication details (this logic remains in the script).
    // Fetch user and property credentials from the new schema.
    const result = await pgPool.query(
      `SELECT u.cloudbeds_user_id, u.auth_mode, up.pms_credentials
   FROM users u 
   JOIN user_properties up ON u.cloudbeds_user_id = up.user_id 
   WHERE up.property_id = $1::integer LIMIT 1`,
      [propertyId]
    );

    if (result.rows.length === 0)
      throw new Error(
        `No active user or property link found for property ${propertyId}.`
      );

    const user = result.rows[0];
    const credentials = user.pms_credentials || {};
    let accessToken;

    if (user.auth_mode === "manual") {
      if (!credentials.api_key) {
        throw new Error(
          `Could not find api_key in pms_credentials for property ${propertyId}.`
        );
      }
      accessToken = credentials.api_key;
    } else {
      // This is for 'oauth' mode
      if (!credentials.refresh_token) {
        throw new Error(
          `Could not find refresh_token in pms_credentials for property ${propertyId}.`
        );
      }
      const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: CLOUDBEDS_CLIENT_ID,
        client_secret: CLOUDBEDS_CLIENT_SECRET,
        refresh_token: credentials.refresh_token,
      });
      const tokenRes = await fetch(
        "https://hotels.cloudbeds.com/api/v1.1/access_token",
        { method: "POST", body: params }
      );
      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
    }

    if (!accessToken)
      throw new Error(`Authentication failed for property ${propertyId}.`);

    // Define the 15-year date range.
    const today = new Date();
    const pastDate = new Date();
    pastDate.setFullYear(today.getFullYear() - 15);
    const futureDate = new Date();
    futureDate.setFullYear(today.getFullYear() + 1);
    const startDate = pastDate.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];
    console.log(`Sync script: Fetching data from ${startDate} to ${endDate}`);

    // --- REFACTORED LOGIC ---
    // All the complex API call and pagination logic is replaced by this single call.
    const processedData = await cloudbedsAdapter.getHistoricalMetrics(
      accessToken,
      propertyId,
      startDate,
      endDate
    );
    // --- END REFACTORED LOGIC ---

    const datesToUpdate = Object.keys(processedData);
    if (datesToUpdate.length > 0) {
      // The database saving logic remains the same.
      for (const date of datesToUpdate) {
        const metrics = processedData[date];
        const query = `
          INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
              adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
              capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;
        `;
        const values = [
          date,
          propertyId,
          metrics.adr || 0,
          metrics.occupancy || 0,
          metrics.revpar || 0,
          metrics.rooms_sold || 0,
          metrics.capacity_count || 0,
          metrics.total_revenue || 0,
          user.cloudbeds_user_id,
        ];
        await pgPool.query(query, values);
      }
      totalRecordsUpdated = datesToUpdate.length;
    }

    console.log(`✅ Initial sync job complete for property ${propertyId}.`);
    response.status(200).json({ success: true, totalRecordsUpdated });
  } catch (error) {
    console.error(
      `❌ A critical error occurred during the initial sync for property ${propertyId}:`,
      error
    );
    response.status(500).json({ success: false, error: error.message });
  }
};
