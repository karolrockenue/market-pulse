// /api/initial-sync.js (Final Version: Targeted, 15-Year Sync)
const fetch = require("node-fetch").default || require("node-fetch");
const { Client } = require("pg");

// --- HELPER FUNCTIONS (No changes) ---
async function getCloudbedsAccessToken(refreshToken) {
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  if (!refreshToken)
    throw new Error("Cannot get access token without a refresh token.");
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

// This function now correctly calculates Occupancy and RevPAR instead of trusting the API.
function processApiDataForTable(allData) {
  const aggregatedData = {};
  if (!allData || allData.length === 0) return aggregatedData;

  // First, aggregate the raw sums from all pages of the API response.
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      const date = page.index[i][0];
      if (!aggregatedData[date]) {
        aggregatedData[date] = {
          rooms_sold: 0,
          capacity_count: 0,
          total_revenue: 0,
          // We need total room revenue to correctly calculate ADR
          room_revenue: 0,
        };
      }
      // Sum the core metrics needed for calculation.
      aggregatedData[date].rooms_sold +=
        parseFloat(page.records.rooms_sold?.[i]) || 0;
      aggregatedData[date].capacity_count +=
        parseFloat(page.records.capacity_count?.[i]) || 0;
      aggregatedData[date].total_revenue +=
        parseFloat(page.records.total_revenue?.[i]) || 0;
      aggregatedData[date].room_revenue +=
        parseFloat(page.records.room_revenue?.[i]) || 0;
    }
  }

  // Second, loop through the aggregated data to perform calculations for each day.
  for (const date in aggregatedData) {
    const metrics = aggregatedData[date];

    // Calculate ADR: Room Revenue / Rooms Sold
    if (metrics.rooms_sold > 0) {
      metrics.adr = metrics.room_revenue / metrics.rooms_sold;
    } else {
      metrics.adr = 0;
    }

    // Calculate Occupancy: Rooms Sold / Capacity
    if (metrics.capacity_count > 0) {
      metrics.occupancy = metrics.rooms_sold / metrics.capacity_count;
    } else {
      metrics.occupancy = 0;
    }

    // Calculate RevPAR: ADR * Occupancy
    metrics.revpar = metrics.adr * metrics.occupancy;
  }

  return aggregatedData;
}

// --- MAIN HANDLER ---
module.exports = async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }

  const { propertyId } = request.body;
  if (!propertyId) {
    return response.status(400).json({ error: "A propertyId is required." });
  }

  console.log(`Starting 15-YEAR initial sync for property: ${propertyId}`);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let totalRecordsUpdated = 0;

  try {
    await client.connect();

    // Also fetch the user's auth_mode to determine how to get a token.
    const userResult = await client.query(
      `SELECT u.cloudbeds_user_id, u.refresh_token, u.auth_mode 
   FROM users u 
   JOIN user_properties up ON u.cloudbeds_user_id = up.user_id 
   WHERE up.property_id = $1::integer LIMIT 1`,
      [propertyId]
    );

    if (userResult.rows.length === 0)
      throw new Error(`No active user found for property ${propertyId}.`);
    const user = userResult.rows[0];

    let accessToken;
    // Check the user's authentication mode.
    if (user.auth_mode === "manual") {
      // For pilot users, get the specific API key for this property.
      console.log(`User is in 'manual' mode. Fetching override API key.`);
      const keyResult = await client.query(
        "SELECT override_api_key FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [user.cloudbeds_user_id, propertyId]
      );
      if (keyResult.rows.length === 0 || !keyResult.rows[0].override_api_key) {
        throw new Error(
          `Could not find override_api_key for property ${propertyId}.`
        );
      }
      // The API key IS the access token for these users.
      accessToken = keyResult.rows[0].override_api_key;
    } else {
      // For standard OAuth users, use the refresh token as before.
      console.log(`User is in 'oauth' mode. Using refresh token.`);
      accessToken = await getCloudbedsAccessToken(user.refresh_token);
    }

    if (!accessToken)
      throw new Error(
        `Authentication failed for the user of property ${propertyId}. Mode: ${user.auth_mode}`
      );

    // Define a fixed 15-year historical range.
    const today = new Date();
    const pastDate = new Date();
    pastDate.setFullYear(today.getFullYear() - 15);
    const futureDate = new Date();
    futureDate.setFullYear(today.getFullYear() + 1);

    const startDate = pastDate.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];
    console.log(`Fetching data from ${startDate} to ${endDate}`);

    const columnsToRequest = [
      "adr",
      "revpar",
      "total_revenue",
      "room_revenue",
      "occupancy",
      "rooms_sold",
      "capacity_count",
    ].map((column) => ({ cdf: { column }, metrics: ["sum", "mean"] }));

    const initialInsightsPayload = {
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

    let allApiData = [];
    let nextToken = null;
    let pageNum = 1;
    do {
      const insightsPayload = { ...initialInsightsPayload };
      if (nextToken) insightsPayload.nextToken = nextToken;
      console.log(`Fetching page ${pageNum} for property ${propertyId}...`);
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
      const responseText = await apiResponse.text();
      if (!apiResponse.ok)
        throw new Error(
          `API Error on page ${pageNum}: ${apiResponse.status}: ${responseText}`
        );
      const pageData = JSON.parse(responseText);
      allApiData.push(pageData);
      nextToken = pageData.nextToken || null;
      pageNum++;
    } while (nextToken);

    const processedData = processApiDataForTable(allApiData);
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
      totalRecordsUpdated = datesToUpdate.length;
    }

    console.log(`✅ Initial sync job complete for property ${propertyId}.`);
    response.status(200).json({ success: true, totalRecordsUpdated });
  } catch (error) {
    console.error(
      `❌ A critical error occurred during the initial sync for property ${propertyId}:`,
      error
    );
    response.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) await client.end();
  }
};
