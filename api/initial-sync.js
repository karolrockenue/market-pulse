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

function processApiDataForTable(allData) {
  const aggregatedData = {};
  if (!allData || allData.length === 0) return aggregatedData;
  for (const page of allData) {
    if (!page.index || !page.records) continue;
    for (let i = 0; i < page.index.length; i++) {
      const date = page.index[i][0];
      if (!aggregatedData[date]) aggregatedData[date] = {};
      for (const metric in page.records) {
        if (!aggregatedData[date][metric]) aggregatedData[date][metric] = 0;
        aggregatedData[date][metric] +=
          parseFloat(page.records[metric][i]) || 0;
      }
    }
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

    const userResult = await client.query(
      `SELECT u.cloudbeds_user_id, u.refresh_token FROM users u JOIN user_properties up ON u.user_id = up.user_id WHERE up.property_id = $1 LIMIT 1`,
      [propertyId]
    );

    if (userResult.rows.length === 0)
      throw new Error(`No active user found for property ${propertyId}.`);
    const user = userResult.rows[0];

    const accessToken = await getCloudbedsAccessToken(user.refresh_token);
    if (!accessToken)
      throw new Error(
        `Authentication failed for the user of property ${propertyId}.`
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
