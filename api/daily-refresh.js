// /api/daily-refresh.js
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");

module.exports = async (request, response) => {
  console.log("Starting daily FORECAST refresh job for ALL USERS...");
  let totalRecordsUpdated = 0;

  try {
    // Simplified the query to remove the 'auth_mode' column.
    const usersResult = await pgPool.query(
      "SELECT cloudbeds_user_id FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    for (const user of activeUsers) {
      // Simplified the log message.
      console.log(`--- Processing user: ${user.cloudbeds_user_id} ---`);
      try {
        const propertiesResult = await pgPool.query(
          "SELECT property_id, pms_credentials FROM user_properties WHERE user_id = $1 AND status = 'connected'",
          [user.cloudbeds_user_id]
        );
        const userProperties = propertiesResult.rows;

        for (const prop of userProperties) {
          const propertyId = prop.property_id;

          // Simplified the call to getAccessToken, as it no longer needs auth_mode.
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
            for (const date of datesToUpdate) {
              const metrics = processedData[date];
              const query = `
                INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
                    adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
                    capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;
              `;
              const values = [
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
              await pgPool.query(query, values);
            }
            totalRecordsUpdated += datesToUpdate.length;
            console.log(
              `-- Successfully updated ${datesToUpdate.length} records for property ${propertyId}. --`
            );
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

    console.log("✅ Daily refresh job complete.");
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
