// /api/initial-sync.js (Refactored for Bulk Insert with Transaction Control)
const fetch = require("node-fetch");
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const format = require("pg-format");

/**
 * The core logic for the initial sync process.
 * @param {string} propertyId The ID of the property to sync.
 */
// /initial-sync.js

// This new function will fetch data in yearly chunks to avoid API limits.
async function runSync(propertyId) {
  if (!propertyId) {
    throw new Error("A propertyId is required to run the sync.");
  }
  console.log(`Starting 5-YEAR initial sync for property: ${propertyId}`);

  // Get user and credential info (this part is unchanged)
  const result = await pgPool.query(
    `SELECT u.cloudbeds_user_id, up.pms_credentials
     FROM users u
     JOIN user_properties up ON u.cloudbeds_user_id = up.user_id
     WHERE up.property_id = $1::integer LIMIT 1`,
    [propertyId]
  );
  if (result.rows.length === 0) {
    throw new Error(`No user link found for property ${propertyId}.`);
  }
  const user = result.rows[0];
  const accessToken = await cloudbedsAdapter.getAccessToken(
    user.pms_credentials
  );

  // --- NEW CHUNKING LOGIC ---
  let allProcessedData = {};
  const startYear = new Date().getFullYear() - 5;
  const endYear = new Date().getFullYear();

  // Loop from the start year to the current year.
  for (let year = startYear; year <= endYear; year++) {
    const yearStartDate = `${year}-01-01`;
    const yearEndDate = `${year}-12-31`;

    console.log(`Fetching data for ${year}...`);

    // Call the adapter for each one-year chunk.
    const yearlyData = await cloudbedsAdapter.getHistoricalMetrics(
      accessToken,
      propertyId,
      yearStartDate,
      yearEndDate
    );

    // Merge the results from this year into our main data object.
    allProcessedData = { ...allProcessedData, ...yearlyData };
  }
  // --- END OF NEW LOGIC ---

  const datesToUpdate = Object.keys(allProcessedData);

  if (datesToUpdate.length > 0) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const bulkInsertValues = datesToUpdate.map((date) => {
        const metrics = allProcessedData[date];
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
      const query = format(
        `INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
         VALUES %L
         ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
             adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
             capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;`,
        bulkInsertValues
      );
      await client.query(query);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  console.log(
    `✅ Initial sync job complete for property ${propertyId}. Updated ${datesToUpdate.length} records.`
  );
  return datesToUpdate.length;
}

// This wrapper is for when the file is called as a Vercel Serverless function.
const serverlessWrapper = async (request, response) => {
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

serverlessWrapper.runSync = runSync;
module.exports = serverlessWrapper;

// This block allows the script to be executed from the command line (remains unchanged).
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
