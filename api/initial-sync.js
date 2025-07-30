// /api/initial-sync.js (Refactored for Bulk Insert with Transaction Control)
const fetch = require("node-fetch");
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const format = require("pg-format");

/**
 * The core logic for the initial sync process.
 * @param {string} propertyId The ID of the property to sync.
 */
async function runSync(propertyId) {
  if (!propertyId) {
    throw new Error("A propertyId is required to run the sync.");
  }

  console.log(`--- STARTING DEBUG SYNC for property: ${propertyId} ---`);

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

  const processedData = await cloudbedsAdapter.getHistoricalMetrics(
    accessToken,
    propertyId,
    startDate,
    endDate
  );

  // --- BREADCRUMB 1: Log a sample of the data received from Cloudbeds ---
  console.log(
    `[BREADCRUMB 1] Received ${
      Object.keys(processedData).length
    } records from Cloudbeds. Sample record:`,
    processedData[Object.keys(processedData)[0]]
  );

  const datesToUpdate = Object.keys(processedData);

  if (datesToUpdate.length > 0) {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");

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

      // --- BREADCRUMB 2: Log the first 500 characters of the query we are sending ---
      console.log(
        `[BREADCRUMB 2] Executing database query. Start of query: ${query.substring(
          0,
          500
        )}...`
      );

      const insertResult = await client.query(query);

      // --- BREADCRUMB 3: Log what the database reports back ---
      console.log(
        "[BREADCRUMB 3] Database query complete. Result rowCount:",
        insertResult.rowCount
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  console.log(
    `--- DEBUG SYNC COMPLETE for property ${propertyId}. Processed ${datesToUpdate.length} records. ---`
  );
  return datesToUpdate.length;
}

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
