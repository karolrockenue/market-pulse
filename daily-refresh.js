// daily-refresh.js (Multi-User Refactor)
const fetch = require("node-fetch").default || require("node-fetch");
const { Client } = require("pg");

// MODIFIED: Now accepts a refresh_token to get a token for a specific user.
async function getCloudbedsAccessToken(refreshToken) {
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  if (!refreshToken) {
    throw new Error("Cannot get access token without a refresh token.");
  }
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    console.error("Token refresh failed for a user:", tokenData);
    // Return null instead of throwing an error to allow the loop to continue with other users.
    return null;
  }
  return tokenData.access_token;
}

const sanitizeMetric = (metric) => {
  const num = parseFloat(metric);
  return isNaN(num) ? 0 : num;
};

function aggregateForecastData(data) {
  const aggregated = {};
  if (!data.index || !data.records) return aggregated;

  for (let i = 0; i < data.index.length; i++) {
    const date = data.index[i][0].split("T")[0];
    if (!aggregated[date]) {
      aggregated[date] = {
        rooms_sold: 0,
        capacity_count: 0,
        total_revenue: 0,
        total_revenue_for_adr: 0,
      };
    }
    const roomsSoldForRow = sanitizeMetric(data.records.rooms_sold?.[i]);
    aggregated[date].rooms_sold += roomsSoldForRow;
    aggregated[date].capacity_count += sanitizeMetric(
      data.records.capacity_count?.[i]
    );
    aggregated[date].total_revenue += sanitizeMetric(
      data.records.total_revenue?.[i]
    );
    aggregated[date].total_revenue_for_adr +=
      sanitizeMetric(data.records.adr?.[i]) * roomsSoldForRow;
  }

  for (const date in aggregated) {
    const dayData = aggregated[date];
    if (dayData.rooms_sold > 0) {
      dayData.adr = dayData.total_revenue_for_adr / dayData.rooms_sold;
    } else {
      dayData.adr = 0;
    }
    if (dayData.capacity_count > 0) {
      dayData.occupancy = dayData.rooms_sold / dayData.capacity_count;
    } else {
      dayData.occupancy = 0;
    }
    dayData.revpar = dayData.adr * dayData.occupancy;
  }
  return aggregated;
}

// Main handler for the Vercel Serverless Function
module.exports = async (request, response) => {
  console.log("Starting daily FORECAST refresh job for ALL USERS...");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let totalRecordsUpdated = 0;

  try {
    await client.connect();

    // MODIFIED: Task 2.1 - Fetch all active users from the database.
    console.log("Fetching list of active users...");
    const usersResult = await client.query(
      "SELECT cloudbeds_user_id, cloudbeds_property_id, refresh_token FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    // MODIFIED: Task 2.2 - Loop through each active user.
    for (const user of activeUsers) {
      console.log(`--- Processing user: ${user.cloudbeds_user_id} ---`);
      try {
        // MODIFIED: Task 2.3 - Use the user's specific refresh token.
        const accessToken = await getCloudbedsAccessToken(user.refresh_token);
        if (!accessToken) {
          console.log(
            `Skipping user ${user.cloudbeds_user_id} due to authentication failure.`
          );
          continue; // Skip to the next user
        }

        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + 365);
        const startDate = today.toISOString().split("T")[0];
        const endDate = futureDate.toISOString().split("T")[0];

        const columnsToRequest = [
          "adr",
          "occupancy",
          "revpar",
          "rooms_sold",
          "capacity_count",
          "total_revenue",
        ].map((col) => ({ cdf: { column: col }, metrics: ["sum"] }));

        const insightsPayload = {
          // MODIFIED: Task 2.4 - Use the user's specific property ID.
          property_ids: [parseInt(user.cloudbeds_property_id, 10)],
          dataset_id: 7,
          filters: {
            and: [
              {
                cdf: { column: "stay_date" },
                operator: "greater_than_or_equal",
                value: `${startDate}T00:00:00.000Z`,
              },
              {
                cdf: { column: "stay_date" },
                operator: "less_than_or_equal",
                value: `${endDate}T00:00:00.000Z`,
              },
            ],
          },
          columns: columnsToRequest,
          group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
          settings: { details: true, totals: false },
        };

        const apiResponse = await fetch(
          "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              // MODIFIED: Task 2.4 - Use the user's specific property ID in the header.
              "X-PROPERTY-ID": user.cloudbeds_property_id,
            },
            body: JSON.stringify(insightsPayload),
          }
        );

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(
            `Cloudbeds API Error for user ${user.cloudbeds_user_id}: ${apiResponse.status} ${errorText}`
          );
        }

        const apiData = await apiResponse.json();
        const processedData = aggregateForecastData(apiData);
        const datesToUpdate = Object.keys(processedData);

        if (datesToUpdate.length > 0) {
          console.log(
            `Updating ${datesToUpdate.length} records for user ${user.cloudbeds_user_id}...`
          );
          // MODIFIED: Task 2.5 - Include the user's ID in the INSERT query.
          const insertQuery = `
            INSERT INTO daily_metrics_snapshots (
                hotel_id, stay_date, adr, occupancy_direct, revpar,
                rooms_sold, capacity_count, total_revenue, cloudbeds_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
              adr = EXCLUDED.adr,
              occupancy_direct = EXCLUDED.occupancy_direct,
              revpar = EXCLUDED.revpar,
              rooms_sold = EXCLUDED.rooms_sold,
              capacity_count = EXCLUDED.capacity_count,
              total_revenue = EXCLUDED.total_revenue;
          `;

          for (const date of datesToUpdate) {
            const metrics = processedData[date];
            const values = [
              user.cloudbeds_property_id, // hotel_id is the property_id
              date,
              sanitizeMetric(metrics.adr),
              sanitizeMetric(metrics.occupancy),
              sanitizeMetric(metrics.revpar),
              sanitizeMetric(metrics.rooms_sold),
              sanitizeMetric(metrics.capacity_count),
              sanitizeMetric(metrics.total_revenue),
              user.cloudbeds_user_id, // The new user ID column
            ];
            await client.query(insertQuery, values);
          }
          totalRecordsUpdated += datesToUpdate.length;
        }
        console.log(
          `--- User ${user.cloudbeds_user_id} processed successfully. ---`
        );
      } catch (userError) {
        console.error(
          `Failed to process user ${user.cloudbeds_user_id}. Error:`,
          userError.message
        );
        // Continue to the next user even if one fails.
      }
    }

    // Update the global timestamp after all users have been processed.
    const updateTimestampQuery = `
      INSERT INTO system_state (key, value)
      VALUES ('last_successful_refresh', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `;
    await client.query(updateTimestampQuery, [
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
  } finally {
    if (client) {
      await client.end();
      console.log("Database connection closed.");
    }
  }
};
