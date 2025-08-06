// /api/daily-refresh.js (Refactored for Direct DB Update)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const format = require("pg-format");

// /api/daily-refresh.js
// ...
module.exports = async (request, response) => {
  // ** REFACTORED LOGIC **
  // The job now fetches all connected properties directly, making it property-centric
  // instead of user-centric. This is more robust.
  console.log("Starting daily FORECAST refresh job for ALL PROPERTIES...");
  let totalRecordsUpdated = 0;

  try {
    // Step 1: Get a list of all unique, connected properties from the user_properties table.
    const propertiesResult = await pgPool.query(
      "SELECT DISTINCT property_id FROM user_properties WHERE status = 'connected'"
    );
    const connectedProperties = propertiesResult.rows;
    console.log(
      `Found ${connectedProperties.length} connected properties to process.`
    );

    // Step 2: Loop through each property directly.
    for (const prop of connectedProperties) {
      const propertyId = prop.property_id;
      console.log(`--- Processing property: ${propertyId} ---`);
      try {
        // Get the user_id associated with this property. We need this for the INSERT query.
        // We take the first one found, assuming any user linked to the property is valid for this purpose.
        const userResult = await pgPool.query(
          "SELECT user_id FROM user_properties WHERE property_id = $1 LIMIT 1",
          [propertyId]
        );

        if (userResult.rows.length === 0) {
          // If no user is linked, we can't get credentials. Log and skip.
          console.error(
            `-- Could not find a user for property ${propertyId}. Skipping. --`
          );
          continue; // Move to the next property in the loop
        }
        const cloudbedsUserId = userResult.rows[0].user_id;

        // Get a valid access token for the property using the adapter
        const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);

        // Fetch the upcoming metrics data from the Cloudbeds API
        const processedData = await cloudbedsAdapter.getUpcomingMetrics(
          accessToken,
          propertyId
        );

        const datesToUpdate = Object.keys(processedData);

        if (datesToUpdate.length > 0) {
          // Use a dedicated client for the transaction
          const client = await pgPool.connect();
          try {
            // Start the transaction
            // Start the database transaction
            await client.query("BEGIN");

            // Clear all existing metric snapshots for this property to ensure a clean import.
            // This prevents "duplicate key" errors if the sync is run more than once.
            console.log(
              `Clearing existing metric data for property ${propertyId}...`
            );
            await client.query(
              "DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1",
              [propertyId]
            );
            console.log("✅ Existing data cleared.");

            // Prepare the values for the bulk insert/update operation
            const bulkInsertValues = datesToUpdate.map((date) => {
              const metrics = processedData[date];
              return [
                date,
                propertyId,
                metrics.adr,
                metrics.occupancy,
                metrics.revpar,
                metrics.rooms_sold,
                metrics.capacity_count,
                metrics.room_revenue, // Using room_revenue for the total_revenue column
                cloudbedsUserId, // Use the user ID we fetched earlier
              ];
            });

            // Format the query to handle bulk insertion and update on conflict
            const query = format(
              `INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
               VALUES %L
               ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
                   adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
                   capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;`,
              bulkInsertValues
            );

            // Execute the query
            await client.query(query);
            // Commit the transaction
            await client.query("COMMIT");

            totalRecordsUpdated += datesToUpdate.length;
            console.log(
              `-- Successfully updated ${datesToUpdate.length} records for property ${propertyId}. --`
            );
          } catch (e) {
            // If any error occurs, roll back the transaction
            await client.query("ROLLBACK");
            throw e; // Re-throw the error to be caught by the outer catch block
          } finally {
            // Always release the client back to the pool
            client.release();
          }
        } else {
          console.log(
            `-- No new records to update for property ${propertyId}. --`
          );
        }
      } catch (propertyError) {
        // Catch any error for a specific property and log it, so the main job can continue
        console.error(
          `-- Failed to process property ${propertyId}. Error: --`,
          propertyError.message
        );
      }
    }

    // --- FINAL FIX: Update system_state table directly ---
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
    // Use the main pool for this simple query.
    await pgPool.query(systemStateQuery, ["last_successful_refresh", jobData]);
    console.log("System state updated successfully.");
    // --- END OF FIX ---
    // The response should reflect the new property-centric logic.
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
