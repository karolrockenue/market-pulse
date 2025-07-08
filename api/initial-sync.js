// api/initial-sync.js (Corrected for Multi-Property)
const fetch = require("node-fetch").default || require("node-fetch");
const { Client } = require("pg");

// --- Self-contained constants ---
const DATASET_7_MAP = {
  adr: { name: "ADR", category: "Booking", type: "currency" },
  revpar: { name: "RevPAR", category: "Booking", type: "currency" },
  total_revenue: {
    name: "Total Revenue",
    category: "Finance",
    type: "currency",
  },
  room_revenue: {
    name: "Total Room Revenue",
    category: "Finance",
    type: "currency",
  },
  room_rate: { name: "Room Rate", category: "Finance", type: "currency" },
  misc_income: { name: "Misc. Income", category: "Finance", type: "currency" },
  room_taxes: { name: "Total Taxes", category: "Finance", type: "currency" },
  room_fees: { name: "Total Fees", category: "Finance", type: "currency" },
  additional_room_revenue: {
    name: "Other Room Revenue",
    category: "Finance",
    type: "currency",
  },
  non_room_revenue: {
    name: "Total Other Revenue",
    category: "Finance",
    type: "currency",
  },
  occupancy: { name: "Occupancy", category: "Occupancy", type: "percent" },
  rooms_sold: { name: "Rooms Sold", category: "Occupancy", type: "number" },
  capacity_count: { name: "Capacity", category: "Occupancy", type: "number" },
  // ... other metrics
};

// --- AUTHENTICATION ---
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
    { method: "POST", body: params }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    console.error("Token refresh failed for a user:", tokenData);
    return null;
  }
  return tokenData.access_token;
}

// --- DATA PROCESSING ---
// (No changes needed to processApiDataForTable function)
function processApiDataForTable(allData) {
  const aggregatedData = {};
  if (!allData || allData.length === 0) {
    return aggregatedData;
  }
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      const date = page.index[i][0];
      if (!aggregatedData[date]) {
        aggregatedData[date] = { totalRevenueForADR: 0 };
        for (const key in DATASET_7_MAP) {
          if (
            DATASET_7_MAP[key].type !== "string" &&
            DATASET_7_MAP[key].type !== "date"
          ) {
            aggregatedData[date][key] = 0;
          }
        }
      }
      for (const metric in page.records) {
        if (aggregatedData[date].hasOwnProperty(metric)) {
          aggregatedData[date][metric] +=
            parseFloat(page.records[metric][i]) || 0;
        }
      }
    }
  }
  return aggregatedData;
}

// --- MAIN HANDLER ---
module.exports = async (request, response) => {
  console.log("Starting INITIAL SYNC for ALL USERS and ALL PROPERTIES...");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let totalRecordsUpdated = 0;

  try {
    await client.connect();

    // Fetch all active users
    console.log("Fetching list of active users...");
    const usersResult = await client.query(
      "SELECT cloudbeds_user_id, refresh_token FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    // Loop through each active user
    for (const user of activeUsers) {
      console.log(`--- Processing user: ${user.cloudbeds_user_id} ---`);
      try {
        const accessToken = await getCloudbedsAccessToken(user.refresh_token);
        if (!accessToken) {
          console.log(
            `Skipping user ${user.cloudbeds_user_id} due to auth failure.`
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
          `User ${user.cloudbeds_user_id} has ${userProperties.length} properties to sync.`
        );

        // NEW: Nested loop to sync each property
        for (const prop of userProperties) {
          const propertyId = prop.property_id;
          console.log(`-- Starting sync for property: ${propertyId} --`);

          const today = new Date();
          const pastDate = new Date();
          const futureDate = new Date();
          pastDate.setDate(today.getDate() - 365);
          futureDate.setDate(today.getDate() + 365);
          const startDate = pastDate.toISOString().split("T")[0];
          const endDate = futureDate.toISOString().split("T")[0];

          const columnsToRequest = Object.keys(DATASET_7_MAP).map((column) => ({
            cdf: { column },
            metrics: ["sum", "mean"],
          }));

          const initialInsightsPayload = {
            property_ids: [propertyId], // Use the current property ID
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

          let allApiData = [];
          let nextToken = null;
          let pageNum = 1;
          do {
            const insightsPayload = { ...initialInsightsPayload };
            if (nextToken) {
              insightsPayload.nextToken = nextToken;
            }
            const apiResponse = await fetch(
              "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                  "X-PROPERTY-ID": propertyId,
                }, // Use propertyId in header
                body: JSON.stringify(insightsPayload),
              }
            );
            const responseText = await apiResponse.text();
            if (!apiResponse.ok)
              throw new Error(
                `API Error for property ${propertyId}: ${apiResponse.status}: ${responseText}`
              );
            const pageData = JSON.parse(responseText);
            allApiData.push(pageData);
            nextToken = pageData.nextToken || null;
            console.log(`Fetched page ${pageNum} for property ${propertyId}.`);
            pageNum++;
          } while (nextToken);

          const processedData = processApiDataForTable(allApiData);
          const datesToUpdate = Object.keys(processedData);

          if (datesToUpdate.length > 0) {
            console.log(
              `Inserting/updating ${datesToUpdate.length} records for property ${propertyId}...`
            );
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
                metrics.adr || 0,
                metrics.occupancy || 0,
                metrics.revpar || 0,
                metrics.rooms_sold || 0,
                metrics.capacity_count || 0,
                metrics.total_revenue || 0,
                user.cloudbeds_user_id,
              ];
              await client.query(query, values);
            }
            totalRecordsUpdated += datesToUpdate.length;
          }
          console.log(`-- Property ${propertyId} synced successfully. --`);
        }
      } catch (userError) {
        console.error(
          `Failed to sync user ${user.cloudbeds_user_id}. Error:`,
          userError.message
        );
      }
    }

    console.log("✅ Initial sync job complete for all users.");
    response
      .status(200)
      .json({ success: true, totalRecordsUpdated: totalRecordsUpdated });
  } catch (error) {
    console.error(
      "❌ A critical error occurred during the initial sync:",
      error
    );
    response.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) await client.end();
  }
};
