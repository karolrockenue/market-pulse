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

  // Use a single database client for the entire operation
  const client = await pgPool.connect();
  try {
    // Get user and credential info
    const result = await client.query(
      `SELECT u.cloudbeds_user_id, up.pms_credentials
       FROM users u
       JOIN user_properties up ON u.cloudbeds_user_id = up.user_id
       WHERE up.property_id = $1::integer LIMIT 1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      throw new Error(`No user link found for property ${propertyId}.`);
    }
    // /initial-sync.js

    // ... (previous code)
    const user = result.rows[0];

    // ** THE FIX **
    // The original code was passing the entire credentials object to getAccessToken.
    // We now pass the definitive `propertyId` string, which allows our refactored
    // adapter function to work correctly.
    const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);

    // Start the database transaction
    // ... (subsequent code)

    // Start the database transaction
    await client.query("BEGIN");

    // Clear all existing metric snapshots for this property to ensure a clean import.
    // This prevents "duplicate key" errors if the sync is run more than once.
    console.log(`Clearing existing metric data for property ${propertyId}...`);
    await client.query(
      "DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1",
      [propertyId]
    );
    console.log("✅ Existing data cleared.");

    // --- NEW: Sync Hotel Info, Tax, and Neighborhood ---
    console.log(`Syncing hotel metadata for property ${propertyId}...`);
    // 1. Sync core details and tax info concurrently
    await Promise.all([
      cloudbedsAdapter.syncHotelDetailsToDb(accessToken, propertyId, client),
      cloudbedsAdapter.syncHotelTaxInfoToDb(accessToken, propertyId, client),
    ]);

    // 2. Sync neighborhood using the details we just saved
    const hotelRes = await client.query(
      "SELECT latitude, longitude FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    const coords = hotelRes.rows[0];
    if (coords && coords.latitude && coords.longitude) {
      const neighborhood = await cloudbedsAdapter.getNeighborhoodFromCoords(
        coords.latitude,
        coords.longitude
      );
      if (neighborhood) {
        await client.query(
          "UPDATE hotels SET neighborhood = $1 WHERE hotel_id = $2",
          [neighborhood, propertyId]
        );
      }
    }
    console.log("✅ Hotel metadata sync complete.");
    // --- END OF NEW LOGIC ---

    // --- Fetch historical and forecast metrics (existing logic) ---
    // --- Fetch historical and forecast metrics (Refactored to be monthly) ---
    // --- NEW: Fetch hotel's tax info before processing metrics ---
    const hotelInfoResult = await client.query(
      "SELECT tax_rate, tax_type FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    // Set defaults to prevent crashes if data is missing.
    const taxRate = hotelInfoResult.rows[0]?.tax_rate || 0;
    const pricingModel = hotelInfoResult.rows[0]?.tax_type || "inclusive";
    console.log(
      `✅ Hotel Info: Tax Rate=${taxRate}, Pricing Model=${pricingModel}`
    );

    // --- Fetch historical and forecast metrics ---
    let allProcessedData = {};
    const startYear = new Date().getFullYear() - 5;
    const endYear = new Date().getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      for (let month = 0; month < 12; month++) {
        const monthStartDate = new Date(Date.UTC(year, month, 1))
          .toISOString()
          .split("T")[0];
        const monthEndDate = new Date(Date.UTC(year, month + 1, 0))
          .toISOString()
          .split("T")[0];

        console.log(
          `Fetching metric data for ${year}-${String(month + 1).padStart(
            2,
            "0"
          )}...`
        );

        // Pass the new tax info to the adapter function.
        const monthlyData = await cloudbedsAdapter.getHistoricalMetrics(
          accessToken,
          propertyId,
          monthStartDate,
          monthEndDate,
          taxRate,
          pricingModel
        );

        allProcessedData = { ...allProcessedData, ...monthlyData };
      }
    }

    console.log("Fetching forecast data for the next 365 days...");
    // Pass the new tax info to the upcoming metrics function as well.
    const futureData = await cloudbedsAdapter.getUpcomingMetrics(
      accessToken,
      propertyId,
      taxRate,
      pricingModel
    );
    allProcessedData = { ...allProcessedData, ...futureData };
    // --- Save metrics to the database (existing logic) ---
    const datesToUpdate = Object.keys(allProcessedData);
    if (datesToUpdate.length > 0) {
      const bulkInsertValues = datesToUpdate.map((date) => {
        const metrics = allProcessedData[date];
        return [
          date,
          propertyId,
          metrics.rooms_sold || 0,
          metrics.capacity_count || 0,
          metrics.occupancy || 0,
          user.cloudbeds_user_id,
          // Old columns for backward compatibility
          metrics.adr || 0,
          metrics.revpar || 0,
          metrics.total_revenue || 0,
          // New columns
          metrics.net_revenue || 0,
          metrics.gross_revenue || 0,
          metrics.net_adr || 0,
          metrics.gross_adr || 0,
          metrics.net_revpar || 0,
          metrics.gross_revpar || 0,
        ];
      });
      const query = format(
        `INSERT INTO daily_metrics_snapshots (
          stay_date, hotel_id, rooms_sold, capacity_count, occupancy_direct, cloudbeds_user_id,
          -- Old columns for backward compatibility
          adr, revpar, total_room_revenue,
          -- New columns
          net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar
         )
         VALUES %L`,
        bulkInsertValues
      );
      await client.query(query);
    }

    // If all steps succeeded, commit the transaction
    await client.query("COMMIT");
    console.log(
      `✅ Initial sync job complete for property ${propertyId}. Synced metadata and ${datesToUpdate.length} metric records.`
    );
    return datesToUpdate.length;
  } catch (e) {
    // If any step fails, roll back all database changes
    await client.query("ROLLBACK");
    // Re-throw the error so it's logged by the wrapper function
    throw e;
  } finally {
    // Always release the database client back to the pool
    client.release();
  }
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
