// /api/daily-refresh.js (Refactored for Multi-PMS Forecasting)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
// Import the mewsAdapter so we can use its functions.
const mewsAdapter = require("./adapters/mewsAdapter.js");
const format = require("pg-format");

module.exports = async (request, response) => {
  // ** REFACTORED LOGIC **
  // The job now fetches all connected properties directly, making it property-centric



  try {
    // More descriptive logging for the job's purpose.
console.log("Starting daily forecast refresh job for all properties...");
let totalRecordsUpdated = 0;
let allProperties = []; // Define here to ensure it's in scope

// Step 1: Get a list of all hotels and their essential info.
// This is more efficient as it's one query for all properties.
// It also fetches the pms_type and timezone needed for branching.
const propertiesClient = await pgPool.connect();
try {
const propertiesResult = await propertiesClient.query(
    "SELECT hotel_id, pms_property_id, property_name, pms_type, timezone, tax_rate, tax_type, total_rooms FROM hotels"
  );
  console.log("...Initial property fetch query complete.");
  allProperties = propertiesResult.rows;
} catch (e) {
  console.error("CRITICAL: Failed to fetch initial property list.", e.message);
  throw e; // Re-throw to be caught by main catch block
} finally {
  propertiesClient.release();
}
    console.log(`Found ${allProperties.length} properties to process.`);

    // Step 2: Loop through each property.
    for (const hotel of allProperties) {
  const {
        hotel_id,
        property_name,
        pms_type,
        timezone,
        tax_rate,
        tax_type,
        total_rooms, // <-- ADDED
      } = hotel;
      console.log(
        `--- Processing: ${property_name} (ID: ${hotel_id}, PMS: ${pms_type}) ---`
      );

      let processedData; // This will hold the forecast data from the adapter.

      // /api/daily-refresh.js

      // Branch logic based on the property's PMS type.
      if (pms_type === "cloudbeds") {
        try {
          // THE FIX: Determine the correct ID to use for the Cloudbeds API.
          // For new hotels, this will be pms_property_id.
          // For old hotels, it will fall back to hotel_id, which is correct for them.
          const cloudbedsApiId = hotel.pms_property_id || hotel.hotel_id;

          // getAccessToken correctly uses our internal hotel_id to find credentials.
          const accessToken = await cloudbedsAdapter.getAccessToken(hotel_id);
          const pricingModel = tax_type || "inclusive";

          // Call the Cloudbeds adapter with the correct ID for their API.
          processedData = await cloudbedsAdapter.getUpcomingMetrics(
            accessToken,
            cloudbedsApiId,
            tax_rate,
            pricingModel
          );
        } catch (err) {
          console.error(
            `-- Failed to fetch Cloudbeds data for ${property_name}. Error: --`,
            err.message
          );
          continue; // Skip to the next hotel.
        }
      } else if (pms_type === "mews") {
        try {
          // Get Mews credentials from the database.
          const credsResult = await pgPool.query(
            "SELECT pms_credentials FROM user_properties WHERE property_id = $1 LIMIT 1",
            [hotel_id]
          );
          const credentials = credsResult.rows[0]?.pms_credentials;
          if (!credentials) {
            throw new Error(
              `No Mews credentials found for property ${hotel_id}.`
            );
          }

          const dataMap = {};
          let currentStartDate = new Date();
          const finalEndDate = new Date();
          finalEndDate.setDate(currentStartDate.getDate() + 365);

          // Loop through the next 365 days in 90-day chunks to respect API limits.
          while (currentStartDate < finalEndDate) {
            let currentEndDate = new Date(currentStartDate);
            currentEndDate.setDate(currentEndDate.getDate() + 89); // Fetch in ~90 day chunks

            if (currentEndDate > finalEndDate) {
              currentEndDate = finalEndDate;
            }

            const startDateStr = currentStartDate.toISOString().split("T")[0];
            const endDateStr = currentEndDate.toISOString().split("T")[0];

            console.log(
              `-- Fetching Mews forecast chunk from ${startDateStr} to ${endDateStr}... --`
            );

            const [occupancyData, revenueData] = await Promise.all([
              mewsAdapter.getOccupancyMetrics(
                credentials,
                startDateStr,
                endDateStr,
                timezone
              ),
              mewsAdapter.getRevenueMetrics(
                credentials,
                startDateStr,
                endDateStr,
                timezone
              ),
            ]);

            // Merge the data from this chunk into our main dataMap.
            occupancyData.dailyMetrics.forEach((metric) => {
              dataMap[metric.date] = {
                ...dataMap[metric.date],
                rooms_sold: metric.occupied,
                capacity_count: metric.available,
              };
            });
            revenueData.dailyMetrics.forEach((metric) => {
              dataMap[metric.date] = {
                ...dataMap[metric.date],
                net_revenue: metric.netRevenue,
                gross_revenue: metric.grossRevenue,
              };
            });

            // Advance the start date for the next loop iteration.
            currentStartDate.setDate(currentStartDate.getDate() + 90);
          }

          // Calculate the final derived metrics for each day after all chunks are fetched.
          for (const date in dataMap) {
            const metrics = dataMap[date];
            metrics.occupancy =
              metrics.capacity_count > 0 && metrics.rooms_sold
                ? metrics.rooms_sold / metrics.capacity_count
                : 0;
            metrics.net_adr =
              metrics.rooms_sold > 0 && metrics.net_revenue
                ? metrics.net_revenue / metrics.rooms_sold
                : 0;
            metrics.gross_adr =
              metrics.rooms_sold > 0 && metrics.gross_revenue
                ? metrics.gross_revenue / metrics.rooms_sold
                : 0;
            metrics.net_revpar =
              metrics.capacity_count > 0 && metrics.net_revenue
                ? metrics.net_revenue / metrics.capacity_count
                : 0;
            metrics.gross_revpar =
              metrics.capacity_count > 0 && metrics.gross_revenue
                ? metrics.gross_revenue / metrics.capacity_count
                : 0;
          }

          processedData = dataMap;
        } catch (err) {
          console.error(
            `-- Failed to fetch Mews forecast for ${property_name}. Error: --`,
            err.message
          );
          continue;
        }
      } else {
        console.log(
          `-- Unknown PMS type '${pms_type}' for hotel ${property_name}. Skipping. --`
        );
        continue; // Skip unknown PMS types.
      }

      const datesToUpdate = Object.keys(processedData);

      if (datesToUpdate.length > 0) {
        const client = await pgPool.connect();
        try {
          await client.query("BEGIN");

          // Find a cloudbeds_user_id for the property, required by the legacy DB schema.
          // NOTE: This can be removed once cloudbeds_user_id is removed from the table.
          const userResult = await client.query(
            "SELECT user_id FROM user_properties WHERE property_id = $1 LIMIT 1",
            [hotel_id]
          );
          const cloudbedsUserId =
            userResult.rows.length > 0 ? userResult.rows[0].user_id : null;

          const bulkInsertValues = datesToUpdate.map((date) => {
            const metrics = processedData[date];
            // This data structure matches what both adapters will return.
            return [
              date,
              hotel_id,
              metrics.rooms_sold || 0,
    total_rooms || metrics.capacity_count || 0, // <-- REPLACED: Prioritizes static total_rooms
              cloudbedsUserId, // Legacy column
              metrics.net_revenue || 0,
              metrics.gross_revenue || 0,
              metrics.net_adr || 0,
              metrics.gross_adr || 0,
              metrics.net_revpar || 0,
              metrics.gross_revpar || 0,
            ];
          });

          // This single query works for both Cloudbeds and Mews data.
          // Note: occupancy_direct is no longer populated as it was a calculated field.
 const query = format(
            `INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, rooms_sold, capacity_count, cloudbeds_user_id, net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar)
             VALUES %L
             ON CONFLICT (hotel_id, stay_date) DO UPDATE SET
                 rooms_sold = EXCLUDED.rooms_sold,
                 capacity_count = EXCLUDED.capacity_count,
                 cloudbeds_user_id = EXCLUDED.cloudbeds_user_id,
                 net_revenue = EXCLUDED.net_revenue,
                 gross_revenue = EXCLUDED.gross_revenue,
                 net_adr = EXCLUDED.net_adr,
                 gross_adr = EXCLUDED.gross_adr,
                 net_revpar = EXCLUDED.net_revpar,
                 gross_revpar = EXCLUDED.gross_revpar;`,
            bulkInsertValues
          );

          await client.query(query);

          // --- PACING SNAPSHOT (HISTORIAN) ---
          // Archive the current future state for this hotel into the pacing_snapshots table.
          // This allows us to calculate pickup (today vs yesterday) later.
          const snapshotQuery = `
            INSERT INTO pacing_snapshots (hotel_id, snapshot_date, stay_date, rooms_sold, capacity_count, net_revenue, gross_revenue)
            SELECT hotel_id, CURRENT_DATE, stay_date, rooms_sold, capacity_count, net_revenue, gross_revenue
            FROM daily_metrics_snapshots
            WHERE hotel_id = $1
              AND stay_date >= CURRENT_DATE
              AND stay_date <= CURRENT_DATE + INTERVAL '365 days'
            ON CONFLICT (hotel_id, snapshot_date, stay_date) DO NOTHING;
          `;
          await client.query(snapshotQuery, [hotel_id]);

          await client.query("COMMIT");

          totalRecordsUpdated += datesToUpdate.length;
          console.log(
            `-- Successfully updated ${datesToUpdate.length} forecast records for ${property_name}. --`
          );
        } catch (e) {
          await client.query("ROLLBACK");
          console.error(
            `-- DB update failed for ${property_name}. Error: --`,
            e.message
          );
        } finally {
          client.release();
        }
      } else {
        console.log(
          `-- No new forecast records to update for ${property_name}. --`
        );
      }
    }

console.log(
  "✅ Daily forecast refresh job complete. Attempting to update system_state table..."
);
const jobData = { timestamp: new Date().toISOString() };
const stateClient = await pgPool.connect();
try {
  // --- GATELOG: About to update system_state ---
  console.log("GATELOG: Writing new timestamp to system_state...");

  // THE FIX: Corrected the key to match what the dashboard API endpoint reads.
  await stateClient.query(
    "INSERT INTO system_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2;",
    ["last_successful_refresh", jobData]
  );

  // --- GATELOG: Finished updating system_state ---
  console.log("GATELOG: Write to system_state complete.");
} catch (e) {
  console.error("CRITICAL: Failed to update system_state.", e.message);
  throw e; // Re-throw to be caught by main catch block
} finally {
  stateClient.release();
}

response.status(200).json({
      status: "Success",
      processedProperties: allProperties.length,
      totalRecordsUpdated: totalRecordsUpdated,
    });
  } catch (error) {
    console.error("CRON JOB FAILED:", error);
    response.status(500).json({ status: "Failure", error: error.message });
  }
};
