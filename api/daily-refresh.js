// /api/daily-refresh.js (Refactored for Multi-PMS Forecasting)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
// Import the mewsAdapter so we can use its functions.
const mewsAdapter = require("./adapters/mewsAdapter.js");
const format = require("pg-format");

module.exports = async (request, response) => {
  // ** REFACTORED LOGIC **
  // The job now fetches all connected properties directly, making it property-centric
  // instead of user-centric. This is more robust.
  console.log("Starting daily FORECAST refresh job for ALL PROPERTIES...");
  let totalRecordsUpdated = 0;

  try {
    // More descriptive logging for the job's purpose.
    console.log("Starting daily forecast refresh job for all properties...");
    let totalRecordsUpdated = 0;

    // Step 1: Get a list of all hotels and their essential info.
    // This is more efficient as it's one query for all properties.
    // It also fetches the pms_type and timezone needed for branching.
    const propertiesResult = await pgPool.query(
      "SELECT hotel_id, property_name, pms_type, timezone, tax_rate, tax_type FROM hotels"
    );
    const allProperties = propertiesResult.rows;
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
      } = hotel;
      console.log(
        `--- Processing: ${property_name} (ID: ${hotel_id}, PMS: ${pms_type}) ---`
      );

      let processedData; // This will hold the forecast data from the adapter.

      // Branch logic based on the property's PMS type.
      if (pms_type === "cloudbeds") {
        try {
          const accessToken = await cloudbedsAdapter.getAccessToken(hotel_id);
          const pricingModel = tax_type || "inclusive";

          // Call the Cloudbeds adapter to get the forecast data.
          processedData = await cloudbedsAdapter.getUpcomingMetrics(
            accessToken,
            hotel_id,
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
        // MEWS FORECAST LOGIC WILL BE ADDED HERE IN THE NEXT STEP
        console.log(
          `-- Mews property found. Forecast logic not yet implemented. Skipping for now. --`
        );
        continue; // Skip Mews properties for now.
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
              metrics.capacity_count || 0,
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

    // Update the system_state table to record that the job ran successfully.
    console.log(
      "✅ Daily forecast refresh job complete. Updating system_state table..."
    );
    const jobData = { timestamp: new Date().toISOString() };
    await pgPool.query(
      "INSERT INTO system_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2;",
      ["last_successful_forecast_refresh", jobData]
    );
    console.log("System state updated successfully.");

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
