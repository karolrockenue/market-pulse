// /api/initial-sync.js (Refactored for Bulk Insert)
const fetch = require("node-fetch");
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
// --- NEW: Import the pg-format library ---
const format = require("pg-format");

/**
 * The core logic for the initial sync process.
 * @param {string} propertyId The ID of the property to sync.
 */
async function runSync(propertyId) {
  if (!propertyId) {
    throw new Error("A propertyId is required to run the sync.");
  }

  console.log(`Starting 5-YEAR initial sync for property: ${propertyId}`);

  const result = await pgPool.query(
    `SELECT u.cloudbeds_user_id, u.auth_mode, up.pms_credentials
     FROM users u 
     JOIN user_properties up ON u.cloudbeds_user_id = up.user_id 
     WHERE up.property_id = $1::integer LIMIT 1`,
    [propertyId]
  );

  if (result.rows.length === 0) {
    throw new Error(
      `No active user or property link found for property ${propertyId}.`
    );
  }

  const user = result.rows[0];
  const accessToken = await cloudbedsAdapter.getAccessToken(
    user.pms_credentials,
    user.auth_mode
  );

  const today = new Date();
  const pastDate = new Date();
  pastDate.setFullYear(today.getFullYear() - 5);
  const futureDate = new Date();
  futureDate.setFullYear(today.getFullYear() + 1);
  const startDate = pastDate.toISOString().split("T")[0];
  const endDate = futureDate.toISOString().split("T")[0];
  console.log(`Sync script: Fetching data from ${startDate} to ${endDate}`);

  const processedData = await cloudbedsAdapter.getHistoricalMetrics(
    accessToken,
    propertyId,
    startDate,
    endDate
  );

  const datesToUpdate = Object.keys(processedData);
  if (datesToUpdate.length > 0) {
    // --- REFACTORED: The inefficient loop has been replaced by this bulk insert logic ---

    // 1. Map all the data into a single nested array for the bulk insert.
    const bulkInsertValues = datesToUpdate.map((date) => {
      const metrics = processedData[date];
      return [
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
    });

    // 2. Use pg-format to safely create a single, massive INSERT query.
    // The %L placeholder correctly formats the nested array into a VALUES list.
    const query = format(
      `
      INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
      VALUES %L
      ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
          adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
          capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;
    `,
      bulkInsertValues
    );

    // 3. Execute the single, highly efficient query.
    await pgPool.query(query);
  }

  console.log(
    `✅ Initial sync job complete for property ${propertyId}. Updated ${datesToUpdate.length} records.`
  );
  return datesToUpdate.length;
}

/**
 * This is the wrapper for when the script is called as a Vercel Serverless Function (e.g., by the manual button).
 */
module.exports = async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  const { propertyId } = request.body;

  try {
    const totalRecordsUpdated = await runSync(propertyId);
    response.status(200).json({ success: true, totalRecordsUpdated });
  } catch (error) {
    console.error(
      `❌ A critical error occurred during the initial sync for property ${propertyId}:`,
      error
    );
    response.status(500).json({ success: false, error: error.message });
  }
};

/**
 * This block allows the script to be executed directly from the command line (e.g., by our `spawn` command).
 */
if (require.main === module) {
  const propertyId = process.argv[2];
  runSync(propertyId)
    .then(() => {
      console.log("Script finished successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed with an error:", error);
      process.exit(1);
    });
}
