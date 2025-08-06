// /api/daily-refresh.js (Refactored for Direct DB Update)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const format = require("pg-format");
// /api/daily-refresh.js
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const format = require("pg-format");

module.exports = async (request, response) => {
  // This is the new property-centric logic.
  console.log("Starting daily FORECAST refresh job for ALL PROPERTIES...");
  let totalRecordsUpdated = 0;

  try {
    // Get a list of all unique, connected properties.
    const propertiesResult = await pgPool.query(
      "SELECT DISTINCT property_id FROM user_properties WHERE status = 'connected'"
    );
    const connectedProperties = propertiesResult.rows;
    console.log(
      `Found ${connectedProperties.length} connected properties to process.`
    );

    // Loop through each property.
    for (const prop of connectedProperties) {
      const propertyId = prop.property_id;
      console.log(`--- Processing property: ${propertyId} ---`);

      try {
        // Find the user who holds the credentials for this property.
        const userResult = await pgPool.query(
          "SELECT user_id FROM user_properties WHERE property_id = $1 AND pms_credentials IS NOT NULL LIMIT 1",
          [propertyId]
        );

        if (userResult.rows.length === 0) {
          throw new Error(
            `Could not find a user with credentials for property ${propertyId}`
          );
        }
        const cloudbedsUserId = userResult.rows[0].user_id;

        // Get the access token using our robust function.
        const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);

        // Fetch the upcoming metrics data.
        const processedData = await cloudbedsAdapter.getUpcomingMetrics(
          accessToken,
          propertyId
        );

        const datesToUpdate = Object.keys(processedData);

        if (datesToUpdate.length > 0) {
          // Map data for bulk insertion, using the cloudbedsUserId we just found.
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
              metrics.room_revenue || 0,
              cloudbedsUserId,
            ];
          });

          const client = await pgPool.connect();
          try {
            await client.query("BEGIN");
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
            totalRecordsUpdated += datesToUpdate.length;
            console.log(
              `-- Successfully updated ${datesToUpdate.length} records for property ${propertyId}. --`
            );
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        } else {
          console.log(
            `-- No new records to update for property ${propertyId}. --`
          );
        }
      } catch (propertyError) {
        // If one property fails, log the error and continue to the next.
        console.error(
          `Failed to process property ${propertyId}. Error:`,
          propertyError.message
        );
      }
    }

    // Update the system status timestamp after all properties are attempted.
    console.log(
      "✅ Daily refresh job complete. Updating system_state table..."
    );
    const jobData = { timestamp: new Date().toISOString() };
    const systemStateQuery = `
      INSERT INTO system_state (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key)
      DO UPDATE SET value = $2;
    `;
    await pgPool.query(systemStateQuery, ["last_successful_refresh", jobData]);
    console.log("System state updated successfully.");

    response.status(200).json({
      status: "Success",
      processedProperties: connectedProperties.length,
      totalRecordsUpdated: totalRecordsUpdated,
    });
  } catch (error) {
    console.error("CRON JOB FAILED:", error);
    response.status(500).json({ status: "Failure", error: error.message });
  }
};
