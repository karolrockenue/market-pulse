// api/daily-refresh.js (Corrected for Multi-Property)
const fetch = require("node-fetch").default || require("node-fetch");
const { Client } = require("pg");

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
  console.log(
    "Starting daily FORECAST refresh job for ALL USERS and ALL PROPERTIES..."
  );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let totalRecordsUpdated = 0;

  try {
    await client.connect();

    console.log("Fetching list of active users...");
    const usersResult = await client.query(
      "SELECT cloudbeds_user_id, refresh_token FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    for (const user of activeUsers) {
      console.log(`--- Processing user: ${user.cloudbeds_user_id} ---`);
      try {
        const accessToken = await getCloudbedsAccessToken(user.refresh_token);
        if (!accessToken) {
          console.log(
            `Skipping user ${user.cloudbeds_user_id} due to authentication failure.`
          );
          continue;
        }

        // NEW: Fetch all properties for the current user
        const propertiesResult = await client.query(
          "SELECT property_id FROM user_properties WHERE user_id = $1",
          [user.cloudbeds_user_id]
        );
        const userProperties = propertiesResult.rows;
        console.log(
          `User ${user.cloudbeds_user_id} has ${userProperties.length} properties to refresh.`
        );

        // NEW: Nested loop to refresh each property
        for (const prop of userProperties) {
          const propertyId = prop.property_id;
          console.log(`-- Starting refresh for property: ${propertyId} --`);

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
            property_ids: [propertyId],
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
                "X-PROPERTY-ID": propertyId,
              },
              body: JSON.stringify(insightsPayload),
            }
          );

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(
              `Cloudbeds API Error for property ${propertyId}: ${apiResponse.status} ${errorText}`
            );
          }

          const apiData = await apiResponse.json();
          const processedData = aggregateForecastData(apiData);
          const datesToUpdate = Object.keys(processedData);

          if (datesToUpdate.length > 0) {
            console.log(
              `Updating ${datesToUpdate.length} records for property ${propertyId}...`
            );
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
                propertyId,
                date,
                sanitizeMetric(metrics.adr),
                sanitizeMetric(metrics.occupancy),
                sanitizeMetric(metrics.revpar),
                sanitizeMetric(metrics.rooms_sold),
                sanitizeMetric(metrics.capacity_count),
                sanitizeMetric(metrics.total_revenue),
                user.cloudbeds_user_id,
              ];
              await client.query(insertQuery, values);
            }
            totalRecordsUpdated += datesToUpdate.length;
          }
          console.log(`-- Property ${propertyId} refreshed successfully. --`);
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
