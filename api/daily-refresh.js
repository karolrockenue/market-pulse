// /api/daily-refresh.js (Refactored for Direct DB Update)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
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
        // /api/daily-refresh.js

        // ... (previous code)

        for (const prop of userProperties) {
          const propertyId = prop.property_id;

          // ** THE FIX **
          // We are now calling the refactored getAccessToken function.
          // Instead of passing in a potentially incomplete credentials object, we pass
          // the definitive propertyId. The adapter will now handle finding the correct
          // credentials and refreshing the token, fixing the sync failure.
          const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);

          console.log(`-- Starting refresh for property: ${propertyId} --`);

          const processedData = await cloudbedsAdapter.getUpcomingMetrics(
            accessToken,
            propertyId
          );
          // ... (subsequent code)

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
                  metrics.adr,
                  metrics.occupancy,
                  metrics.revpar,
                  metrics.rooms_sold,
                  metrics.capacity_count,
                  // MODIFIED: Use room_revenue instead of total_revenue for the insert.
                  // The database column remains `total_revenue`, but the value is now from room_revenue.
                  metrics.room_revenue,
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
              totalRecordsUpdated += datesToUpdate.length;
              console.log(
                `-- Successfully updated ${datesToUpdate.length} records for property ${propertyId} using bulk insert. --`
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
        }
      } catch (userError) {
        console.error(
          `Failed to process user ${user.cloudbeds_user_id}. Error:`,
          userError.message
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
