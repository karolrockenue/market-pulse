// server.js
require("dotenv").config();
const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const path = require("path");
const { Client } = require("pg");

const app = express();
app.use(express.json());

// Helper function for Cloudbeds API authentication
async function getCloudbedsAccessToken() {
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REFRESH_TOKEN,
  } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: CLOUDBEDS_REFRESH_TOKEN,
  });
  const tokenResponse = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error("Authentication failed");
  return tokenData.access_token;
}

// Endpoint for the live API dashboard query
app.post("/api/explore", async (req, res) => {
  try {
    const accessToken = await getCloudbedsAccessToken();
    const { CLOUDBEDS_PROPERTY_ID } = process.env;
    const insightsPayload = {
      ...req.body,
      property_ids: [parseInt(CLOUDBEDS_PROPERTY_ID)],
    };
    const apiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-PROPERTY-ID": CLOUDBEDS_PROPERTY_ID,
        },
        body: JSON.stringify(insightsPayload),
      }
    );
    const data = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(data.message || "API Error");
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Insights API Query Failed", message: error.message });
  }
});

// Endpoint to get hotel details from Cloudbeds API
app.get("/api/hotel-details", async (req, res) => {
  try {
    const accessToken = await getCloudbedsAccessToken();
    const { CLOUDBEDS_PROPERTY_ID } = process.env;
    const response = await fetch(
      `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${CLOUDBEDS_PROPERTY_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "API Error");
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch hotel details", message: error.message });
  }
});

// Endpoint to get metrics and currency symbol from the database
app.get("/api/metrics-from-db", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const ourHotelId = parseInt(process.env.CLOUDBEDS_PROPERTY_ID, 10);
  try {
    await client.connect();
    const { startDate, endDate, granularity = "daily" } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }

    const currencyQuery =
      "SELECT currency_symbol FROM hotels WHERE hotel_id = $1";
    const currencyResult = await client.query(currencyQuery, [ourHotelId]);
    const currencySymbol = currencyResult.rows[0]?.currency_symbol || "$";

    let metricsQuery;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;

    if (granularity === "daily") {
      metricsQuery = `
        SELECT
            TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
            adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3
        ORDER BY stay_date ASC;`;
    } else {
      metricsQuery = `
        SELECT
            TO_CHAR(${timeGroup}, 'YYYY-MM-DD') AS period,
            AVG(adr) as adr,
            AVG(occupancy_direct) as occupancy_direct,
            AVG(revpar) as revpar,
            SUM(rooms_sold) as rooms_sold,
            SUM(capacity_count) as capacity_count,
            SUM(total_revenue) as total_revenue
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3
        GROUP BY ${timeGroup}
        ORDER BY ${timeGroup} ASC;`;
    }
    const metricsResult = await client.query(metricsQuery, [
      ourHotelId,
      startDate,
      endDate,
    ]);

    res.json({
      metrics: metricsResult.rows,
      currencySymbol: currencySymbol,
    });
  } catch (error) {
    console.error("Error in /api/metrics-from-db:", error);
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  } finally {
    await client.end();
  }
});

// Endpoint for competitor metrics
app.get("/api/competitor-metrics", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const ourHotelId = parseInt(process.env.CLOUDBEDS_PROPERTY_ID, 10);
  try {
    await client.connect();
    const { startDate, endDate, granularity = "daily" } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }
    let query;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;
    if (granularity === "daily") {
      query = `
        SELECT
            TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
            AVG(adr) AS market_adr,
            AVG(occupancy_direct) AS market_occupancy,
            AVG(revpar) AS market_revpar,
            SUM(rooms_sold) AS market_rooms_sold,
            SUM(capacity_count) AS market_capacity
        FROM daily_metrics_snapshots
        WHERE hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3
        GROUP BY stay_date
        ORDER BY stay_date ASC;`;
    } else {
      query = `
        SELECT
            TO_CHAR(${timeGroup}, 'YYYY-MM-DD') AS period,
            AVG(adr) AS market_adr,
            AVG(occupancy_direct) AS market_occupancy,
            AVG(revpar) AS market_revpar,
            SUM(rooms_sold) AS market_rooms_sold,
            SUM(capacity_count) AS market_capacity
        FROM daily_metrics_snapshots
        WHERE hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3
        GROUP BY ${timeGroup}
        ORDER BY ${timeGroup} ASC;`;
    }
    const result = await client.query(query, [ourHotelId, startDate, endDate]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/competitor-metrics:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch competitor metrics from database" });
  } finally {
    await client.end();
  }
});

// Static and fallback routes
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
