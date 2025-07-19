// api/daily-refresh.js (Refactored to use Adapter)
const pgPool = require("./utils/db");
const fetch = require("node-fetch"); // Still needed for OAuth token refresh
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js"); // Import the adapter

// The getCloudbedsAccessToken and aggregateForecastData helpers are removed from this file.

// Main handler for the Vercel Serverless Function
module.exports = async (request, response) => {
  console.log("Starting daily FORECAST refresh job for ALL USERS...");

  let totalRecordsUpdated = 0;

  try {
    const usersResult = await pgPool.query(
      "SELECT cloudbeds_user_id, refresh_token, auth_mode FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    for (const user of activeUsers) {
      console.log(
        `--- Processing user: ${user.cloudbeds_user_id} (Mode: ${user.auth_mode}) ---`
      );
      try {
        // Fetch all connected properties for the user, now including their credentials.
        const propertiesResult = await pgPool.query(
          "SELECT property_id, pms_credentials FROM user_properties WHERE user_id = $1 AND status = 'connected'",
          [user.cloudbeds_user_id]
        );
        const userProperties = propertiesResult.rows;

        for (const prop of userProperties) {
          const propertyId = prop.property_id;
          const credentials = prop.pms_credentials || {};
          let propertySpecificAccessToken;

          if (user.auth_mode === "manual") {
            if (credentials.api_key) {
              propertySpecificAccessToken = credentials.api_key;
            } else {
              console.log(
                `-- Skipping property ${propertyId}: No api_key found in pms_credentials. --`
              );
              continue;
            }
          } else {
            // This is for 'oauth' mode
            if (credentials.refresh_token) {
              const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } =
                process.env;
              const params = new URLSearchParams({
                grant_type: "refresh_token",
                client_id: CLOUDBEDS_CLIENT_ID,
                client_secret: CLOUDBEDS_CLIENT_SECRET,
                refresh_token: credentials.refresh_token,
              });
              const tokenRes = await fetch(
                "https://hotels.cloudbeds.com/api/v1.1/access_token",
                { method: "POST", body: params }
              );
              const tokenData = await tokenRes.json();
              propertySpecificAccessToken = tokenData.access_token;
            }

            if (!propertySpecificAccessToken) {
              console.log(
                `-- Skipping property ${propertyId} due to OAuth token refresh failure. --`
              );
              continue;
            }
          }

          console.log(`-- Starting refresh for property: ${propertyId} --`);

          // --- REFACTORED LOGIC ---
          // Replace the API call logic with a single call to the adapter.
          const processedData = await cloudbedsAdapter.getUpcomingMetrics(
            propertySpecificAccessToken,
            propertyId
          );
          // --- END REFACTORED LOGIC ---

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

    const updateTimestampQuery = `
      INSERT INTO system_state (key, value)
      VALUES ('last_successful_refresh', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `;
    await pgPool.query(updateTimestampQuery, [
      JSON.stringify({ timestamp: new Date().toISOString() }),
    ]);
    console.log("Successfully updated the last refresh timestamp.");

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
