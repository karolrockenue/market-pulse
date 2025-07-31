// /api/daily-refresh.js (Refactored for Bulk Insert)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
// Import the pg-format library, which is needed for bulk inserts.
const format = require("pg-format");

module.exports = async (request, response) => {
  console.log("Starting daily FORECAST refresh job for ALL USERS...");
  let totalRecordsUpdated = 0;

  try {
    const usersResult = await pgPool.query(
      "SELECT cloudbeds_user_id FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    for (const user of activeUsers) {
      console.log(`--- Processing user: ${user.cloudbeds_user_id} ---`);
      try {
        const propertiesResult = await pgPool.query(
          "SELECT property_id, pms_credentials FROM user_properties WHERE user_id = $1 AND status = 'connected'",
          [user.cloudbeds_user_id]
        );
        const userProperties = propertiesResult.rows;

        for (const prop of userProperties) {
          const propertyId = prop.property_id;
          const accessToken = await cloudbedsAdapter.getAccessToken(
            prop.pms_credentials
          );

          console.log(`-- Starting refresh for property: ${propertyId} --`);

          const processedData = await cloudbedsAdapter.getUpcomingMetrics(
            accessToken,
            propertyId
          );

          const datesToUpdate = Object.keys(processedData);

          if (datesToUpdate.length > 0) {
            // --- START: Refactored Database Logic ---
            // Get a dedicated client from the pool to run a transaction.
            const client = await pgPool.connect();
            try {
              // Start the transaction.
              await client.query("BEGIN");

              // Map all the daily metrics into a single array of arrays for the bulk insert.
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
                  metrics.total_revenue,
                  user.cloudbeds_user_id,
                ];
              });

              // Create the single, formatted bulk-insert query.
              // This is far more efficient than sending hundreds of individual queries.
              const query = format(
                `INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
                 VALUES %L
                 ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
                     adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
                     capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;`,
                bulkInsertValues
              );

              // Execute the single query.
              await client.query(query);

              // Commit the transaction to save all changes.
              await client.query("COMMIT");

              totalRecordsUpdated += datesToUpdate.length;
              console.log(
                `-- Successfully updated ${datesToUpdate.length} records for property ${propertyId} using bulk insert. --`
              );
            } catch (e) {
              // If any error occurs, roll back the entire transaction.
              await client.query("ROLLBACK");
              // Re-throw the error to be caught by the outer catch block.
              throw e;
            } finally {
              // ALWAYS release the client back to the pool.
              client.release();
            }
            // --- END: Refactored Database Logic ---
          } else {
            console.log(
              `-- No new records to update for property ${propertyId}. --`
            );
          }
        }
      } catch (userError) {
        console.error(
          `Failed to process user ${user.cloudbeds_user_id}. Error:`,
          userError.message
        );
      }
    }
    console.log("✅ Daily refresh job complete. Recording success...");

    // --- ADDED ---
    // Make a "fire-and-forget" call to our new endpoint to record the successful run.
    // We don't use 'await' because we don't need to wait for the response before finishing this job.
    fetch(
      `${request.protocol}://${request.get("host")}/api/record-job-success`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass along the cookie to satisfy the requireAdminApi middleware.
          Cookie: request.headers.cookie,
        },
        body: JSON.stringify({ jobName: "last_successful_refresh" }),
      }
    ).catch((err) => {
      // Log an error if the call fails, but don't block the job's success response.
      console.error("Failed to record job success:", err);
    });
    // --- END ---

    // Send the final success response for the daily-refresh job itself.
    response.status(200).json({
      status: "Success",
      processedUsers: activeUsers.length,
      totalRecordsUpdated: totalRecordsUpdated,
    });
  } catch (error) {
    console.error("CRON JOB FAILED:", error);
    response.status(500).json({ status: "Failure", error: error.message });
  }
};
