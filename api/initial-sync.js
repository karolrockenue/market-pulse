require("dotenv").config();

// /api/initial-sync.js (Refactored for Multi-PMS Support)
const fetch = require("node-fetch");
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const mewsAdapter = require("./adapters/mewsAdapter.js"); // NEW: Require Mews adapter
const format = require("pg-format");

/**
 * The core logic for the initial sync process. Now supports Mews and Cloudbeds.
 * @param {string} propertyId The ID of the property to sync.
 */
async function runSync(propertyId) {
  if (!propertyId) {
    throw new Error("A propertyId is required to run the sync.");
  }
  console.log(`Starting 5-YEAR initial sync for property: ${propertyId}`);

  // Use a single database client for the entire operation
  const client = await pgPool.connect();
  try {
    // NEW: First, determine the PMS type for this property
    const hotelResult = await client.query(
      "SELECT pms_type FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );

    if (hotelResult.rows.length === 0) {
      throw new Error(`Hotel with ID ${propertyId} not found.`);
    }
    const pmsType = hotelResult.rows[0].pms_type;
    console.log(`Detected PMS Type: ${pmsType}`);

    // Start a transaction for the entire sync operation
    await client.query("BEGIN");

    // Clear all existing metric snapshots for this property to ensure a clean import.
    console.log(`Clearing existing metric data for property ${propertyId}...`);
    await client.query(
      "DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1",
      [propertyId]
    );
    console.log("✅ Existing data cleared.");

    // ==================================================================
    // CLOUDBEDS LOGIC PATH (Existing code, moved but unchanged)
    // ==================================================================
    if (pmsType === "cloudbeds") {
      console.log("--- Running Cloudbeds Sync ---");
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
      const user = result.rows[0];
      const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);

      // Sync metadata
      console.log(`Syncing hotel metadata for property ${propertyId}...`);
      await Promise.all([
        cloudbedsAdapter.syncHotelDetailsToDb(accessToken, propertyId, client),
        cloudbedsAdapter.syncHotelTaxInfoToDb(accessToken, propertyId, client),
      ]);
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

      // Fetch historical metrics
      const hotelInfoResult = await client.query(
        "SELECT tax_rate, tax_type FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      const taxRate = hotelInfoResult.rows[0]?.tax_rate || 0;
      const pricingModel = hotelInfoResult.rows[0]?.tax_type || "inclusive";

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
      const futureData = await cloudbedsAdapter.getUpcomingMetrics(
        accessToken,
        propertyId,
        taxRate,
        pricingModel
      );
      allProcessedData = { ...allProcessedData, ...futureData };

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
              net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar
            ) VALUES %L`,
          bulkInsertValues
        );
        await client.query(query);
      }
      console.log(
        `✅ Cloudbeds sync job complete for property ${propertyId}. Synced ${datesToUpdate.length} metric records.`
      );
    }
    // ==================================================================
    // MEWS LOGIC PATH (All new code)
    // ==================================================================
    // Replace with this:
    else if (pmsType === "mews") {
      console.log("--- Running Mews Sync ---");
      // Get Mews credentials from the DB
      const credsResult = await client.query(
        "SELECT pms_credentials FROM user_properties WHERE property_id = $1 LIMIT 1",
        [propertyId]
      );
      if (
        credsResult.rows.length === 0 ||
        !credsResult.rows[0].pms_credentials
      ) {
        throw new Error(
          `No Mews credentials found for property ${propertyId}.`
        );
      }
      const credentials = credsResult.rows[0].pms_credentials;

      // Sync hotel metadata from Mews
      console.log("Syncing hotel metadata from Mews...");
      const hotelDetails = await mewsAdapter.getHotelDetails(credentials);
      await client.query(
        `UPDATE hotels SET 
          property_name = $1, city = $2, currency_code = $3, latitude = $4, longitude = $5, pricing_model = 'gross'
         WHERE hotel_id = $6`,
        [
          hotelDetails.propertyName,
          hotelDetails.city,
          hotelDetails.currencyCode,
          hotelDetails.latitude,
          hotelDetails.longitude,
          propertyId,
        ]
      );
      console.log("✅ Hotel metadata sync complete.");

      // NEW: Fetch historical data in 90-day batches to respect API limits
      let allProcessedData = {};
      let currentStartDate = new Date();
      currentStartDate.setFullYear(currentStartDate.getFullYear() - 5); // Start 5 years ago
      const today = new Date();

      while (currentStartDate < today) {
        let currentEndDate = new Date(currentStartDate);
        currentEndDate.setDate(currentEndDate.getDate() + 89); // Set end of batch (90 days total)

        // Ensure the last batch doesn't go into the future
        if (currentEndDate > today) {
          currentEndDate = today;
        }

        const startDateStr = currentStartDate.toISOString().split("T")[0];
        const endDateStr = currentEndDate.toISOString().split("T")[0];

        console.log(
          `Fetching Mews data from ${startDateStr} to ${endDateStr}...`
        );

        // Fetch occupancy and revenue for the current batch
        const [occupancyData, revenueData] = await Promise.all([
          mewsAdapter.getOccupancyMetrics(
            credentials,
            startDateStr,
            endDateStr
          ),
          mewsAdapter.getRevenueMetrics(credentials, startDateStr, endDateStr),
        ]);

        // Combine the occupancy data into the main object
        occupancyData.dailyMetrics.forEach((metric) => {
          allProcessedData[metric.date] = {
            ...allProcessedData[metric.date],
            rooms_sold: metric.occupied,
            capacity_count: metric.available,
            occupancy:
              metric.available > 0 ? metric.occupied / metric.available : 0,
          };
        });
        // Combine the revenue data into the main object
        revenueData.dailyMetrics.forEach((metric) => {
          allProcessedData[metric.date] = {
            ...allProcessedData[metric.date],
            net_revenue: metric.netRevenue,
            gross_revenue: metric.grossRevenue,
          };
        });

        // Set the start date for the next loop iteration
        currentStartDate.setDate(currentStartDate.getDate() + 90);
      }

      console.log("✅ All historical data fetched.");

      // Insert all collected data into the database
      const datesToUpdate = Object.keys(allProcessedData);
      if (datesToUpdate.length > 0) {
        const bulkInsertValues = datesToUpdate.map((date) => {
          const metrics = allProcessedData[date];
          const net_adr =
            metrics.rooms_sold > 0
              ? metrics.net_revenue / metrics.rooms_sold
              : 0;
          const gross_adr =
            metrics.rooms_sold > 0
              ? metrics.gross_revenue / metrics.rooms_sold
              : 0;
          const net_revpar =
            metrics.capacity_count > 0
              ? metrics.net_revenue / metrics.capacity_count
              : 0;
          const gross_revpar =
            metrics.capacity_count > 0
              ? metrics.gross_revenue / metrics.capacity_count
              : 0;

          return [
            date,
            propertyId,
            metrics.rooms_sold || 0,
            metrics.capacity_count || 0,
            metrics.occupancy || 0,
            null,
            metrics.net_revenue || 0,
            metrics.gross_revenue || 0,
            net_adr,
            gross_adr,
            net_revpar,
            gross_revpar,
          ];
        });
        const query = format(
          `INSERT INTO daily_metrics_snapshots (
              stay_date, hotel_id, rooms_sold, capacity_count, occupancy_direct, cloudbeds_user_id,
              net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar
            ) VALUES %L`,
          bulkInsertValues
        );
        await client.query(query);
      }
      console.log(
        `✅ Mews sync job complete for property ${propertyId}. Synced ${datesToUpdate.length} metric records.`
      );
    }
    // If we get here, all steps for the specific PMS succeeded.
    await client.query("COMMIT");
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

// Wrapper and command-line execution logic remains unchanged...
const serverlessWrapper = async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }
  const { propertyId } = request.body;
  try {
    await runSync(propertyId);
    response.status(200).json({ success: true });
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
