// initial-sync.js (Multi-User Refactor)
const fetch = require("node-fetch").default || require("node-fetch");
const { Client } = require("pg");

// --- Self-contained constants to prevent module errors ---
const DATASET_7_MAP = {
  adr: { name: "ADR", category: "Booking", type: "currency" },
  revpar: { name: "RevPAR", category: "Booking", type: "currency" },
  adults_count: { name: "Adults", category: "Booking", type: "number" },
  children_count: { name: "Children", category: "Booking", type: "number" },
  room_guest_count: {
    name: "Room Guest Count",
    category: "Booking",
    type: "number",
  },
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
  mfd_occupancy: {
    name: "Adjusted Occupancy",
    category: "Occupancy",
    type: "percent",
  },
  rooms_sold: { name: "Rooms Sold", category: "Occupancy", type: "number" },
  capacity_count: { name: "Capacity", category: "Occupancy", type: "number" },
  blocked_room_count: {
    name: "Blocked Rooms",
    category: "Occupancy",
    type: "number",
  },
  out_of_service_count: {
    name: "Out of Service Rooms",
    category: "Occupancy",
    type: "number",
  },
};

// --- AUTHENTICATION (User-Specific) ---
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
      const adr = parseFloat(page.records.adr[i]) || 0;
      const roomsSold = parseInt(page.records.rooms_sold[i]) || 0;
      aggregatedData[date].totalRevenueForADR += adr * roomsSold;
    }
  }

  for (const date in aggregatedData) {
    const dayData = aggregatedData[date];
    if (dayData.rooms_sold > 0)
      dayData.adr = dayData.totalRevenueForADR / dayData.rooms_sold;
    if (dayData.capacity_count > 0)
      dayData.occupancy = dayData.rooms_sold / dayData.capacity_count;
  }

  return aggregatedData;
}

// --- MAIN HANDLER ---
module.exports = async (request, response) => {
  console.log("Starting INITIAL SYNC for ALL USERS...");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let totalRecordsUpdated = 0;

  try {
    await client.connect();

    // MODIFIED: Fetch all active users.
    console.log("Fetching list of active users...");
    const usersResult = await client.query(
      "SELECT cloudbeds_user_id, cloudbeds_property_id, refresh_token FROM users WHERE status = 'active'"
    );
    const activeUsers = usersResult.rows;
    console.log(`Found ${activeUsers.length} active user(s) to process.`);

    // MODIFIED: Loop through each active user.
    for (const user of activeUsers) {
      console.log(
        `--- Syncing initial data for user: ${user.cloudbeds_user_id} ---`
      );
      try {
        // MODIFIED: Get user-specific access token.
        const accessToken = await getCloudbedsAccessToken(user.refresh_token);
        if (!accessToken) {
          console.log(
            `Skipping user ${user.cloudbeds_user_id} due to auth failure.`
          );
          continue;
        }

        const today = new Date();
        const pastDate = new Date();
        const futureDate = new Date();
        pastDate.setDate(today.getDate() - 365);
        futureDate.setDate(today.getDate() + 365);
        const startDate = pastDate.toISOString().split("T")[0];
        const endDate = futureDate.toISOString().split("T")[0];
        console.log(
          `Date range for user ${user.cloudbeds_user_id}: ${startDate} to ${endDate}`
        );

        const columnsToRequest = Object.keys(DATASET_7_MAP)
          .filter((column) => {
            const type = DATASET_7_MAP[column].type;
            return ["currency", "number", "percent"].includes(type);
          })
          .map((column) => ({ cdf: { column }, metrics: ["sum", "mean"] }));

        const initialInsightsPayload = {
          // MODIFIED: Use user's property ID.
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

        let allApiData = [];
        let nextToken = null;
        let pageNum = 1;

        console.log(
          `Fetching paginated data for user ${user.cloudbeds_user_id}...`
        );
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
                // MODIFIED: Use user's property ID in header.
                "X-PROPERTY-ID": user.cloudbeds_property_id,
              },
              body: JSON.stringify(insightsPayload),
            }
          );

          const responseText = await apiResponse.text();
          if (!apiResponse.ok)
            throw new Error(
              `API Error for user ${user.cloudbeds_user_id}: ${apiResponse.status}: ${responseText}`
            );

          const pageData = JSON.parse(responseText);
          allApiData.push(pageData);
          nextToken = pageData.nextToken || null;
          console.log(
            `Fetched page ${pageNum} for user ${user.cloudbeds_user_id}.`
          );
          pageNum++;
        } while (nextToken);
        console.log(
          `✅ All ${pageNum - 1} pages fetched for user ${
            user.cloudbeds_user_id
          }.`
        );

        const processedData = processApiDataForTable(allApiData);
        const datesToUpdate = Object.keys(processedData);

        if (datesToUpdate.length > 0) {
          console.log(
            `Inserting/updating ${datesToUpdate.length} records for user ${user.cloudbeds_user_id}...`
          );
          for (const date of datesToUpdate) {
            const metrics = processedData[date];
            // MODIFIED: Include user's ID in the INSERT query.
            const query = `
                    INSERT INTO daily_metrics_snapshots (
                        snapshot_taken_date, stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count,
                        total_revenue, total_room_revenue, total_other_revenue, room_rate_total, taxes_total, fees_total, misc_income,
                        adults_count, children_count, room_guest_count, blocked_rooms_count, out_of_service_rooms_count, cloudbeds_user_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                    ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
                        adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
                        capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue, total_room_revenue = EXCLUDED.total_room_revenue,
                        total_other_revenue = EXCLUDED.total_other_revenue, room_rate_total = EXCLUDED.room_rate_total, taxes_total = EXCLUDED.taxes_total,
                        fees_total = EXCLUDED.fees_total, misc_income = EXCLUDED.misc_income, adults_count = EXCLUDED.adults_count,
                        children_count = EXCLUDED.children_count, room_guest_count = EXCLUDED.room_guest_count,
                        blocked_rooms_count = EXCLUDED.blocked_rooms_count, out_of_service_rooms_count = EXCLUDED.out_of_service_rooms_count;
                `;
            const values = [
              new Date(),
              date,
              user.cloudbeds_property_id,
              metrics.adr,
              metrics.occupancy,
              metrics.revpar,
              metrics.rooms_sold,
              metrics.capacity_count,
              metrics.total_revenue,
              metrics.room_revenue,
              metrics.non_room_revenue,
              metrics.room_rate,
              metrics.room_taxes,
              metrics.room_fees,
              metrics.misc_income,
              metrics.adults_count,
              metrics.children_count,
              metrics.room_guest_count,
              metrics.blocked_room_count,
              metrics.out_of_service_count,
              user.cloudbeds_user_id,
            ];
            await client.query(query, values);
          }
          totalRecordsUpdated += datesToUpdate.length;
        }
        console.log(
          `--- User ${user.cloudbeds_user_id} synced successfully. ---`
        );
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
