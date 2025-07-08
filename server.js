// server.js
require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
const { Client } = require("pg");

const dailyRefreshHandler = require("./daily-refresh.js");
const initialSyncHandler = require("./initial-sync.js");

const app = express();
app.use(express.json());

// --- V1 Authentication (to be phased out) ---
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

// --- V2.0 OAuth Endpoints ---
app.get("/api/auth/cloudbeds", (req, res) => {
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_REDIRECT_URI } = process.env;

  if (!CLOUDBEDS_CLIENT_ID || !CLOUDBEDS_REDIRECT_URI) {
    console.error("OAuth environment variables not set!");
    return res.status(500).send("Server configuration error.");
  }

  // Reverted to the minimal working scope combination
  const scopes = ["read:user", "read:hotel"];

  const params = new URLSearchParams({
    client_id: CLOUDBEDS_CLIENT_ID,
    redirect_uri: CLOUDBEDS_REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
  });

  const authorizationUrl = `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`;

  res.redirect(authorizationUrl);
});

// Reverted to the last fully working callback logic
app.get("/api/auth/cloudbeds/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Error: No authorization code provided.");
  }

  try {
    const {
      CLOUDBEDS_CLIENT_ID,
      CLOUDBEDS_CLIENT_SECRET,
      CLOUDBEDS_REDIRECT_URI,
    } = process.env;

    // 1. Exchange the code for an access token
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLOUDBEDS_CLIENT_ID,
      client_secret: CLOUDBEDS_CLIENT_SECRET,
      redirect_uri: CLOUDBEDS_REDIRECT_URI,
      code: code,
    });
    const tokenResponse = await fetch(
      "https://hotels.cloudbeds.com/api/v1.1/access_token",
      { method: "POST", body: tokenParams }
    );
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      throw new Error("Failed to get access token from Cloudbeds.");
    }

    console.log("✅ Access token received successfully.");

    // 2. Immediately redirect to the dashboard
    // This bypasses the failing user/property detail fetch step.
    res.redirect("/app");
  } catch (error) {
    console.error("CRITICAL ERROR in OAuth callback:", error);
    res.status(500).send("An error occurred during authentication.");
  }
});

// --- Admin Panel Endpoints ---
app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("CRITICAL: ADMIN_PASSWORD environment variable not set.");
    return res.status(500).json({ error: "Server configuration error." });
  }
  if (password === adminPassword) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
});

app.get("/api/daily-refresh", async (req, res) => {
  console.log("Manual trigger for daily-refresh initiated.");
  await dailyRefreshHandler(req, res);
});

app.get("/api/initial-sync", async (req, res) => {
  console.log("Manual trigger for initial-sync initiated.");
  await initialSyncHandler(req, res);
});

app.get("/api/run-endpoint-tests", async (req, res) => {
  const endpointsToTest = [
    { name: "Cloudbeds Connection", url: "/api/test-cloudbeds", method: "GET" },
    { name: "Database Connection", url: "/api/test-database", method: "GET" },
    { name: "Get Hotel Name", url: "/api/get-hotel-name", method: "GET" },
    { name: "Get Refresh Time", url: "/api/last-refresh-time", method: "GET" },
    {
      name: "KPI Summary",
      url: "/api/kpi-summary?startDate=2025-07-01&endDate=2025-07-07",
      method: "GET",
    },
    {
      name: "Your Hotel Metrics",
      url: "/api/metrics-from-db?startDate=2025-07-01&endDate=2025-07-07&granularity=daily",
      method: "GET",
    },
    {
      name: "Market Metrics",
      url: "/api/competitor-metrics?startDate=2025-07-01&endDate=2025-07-07&granularity=daily",
      method: "GET",
    },
  ];

  const results = [];
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  for (const endpoint of endpointsToTest) {
    try {
      const response = await fetch(baseUrl + endpoint.url, {
        method: endpoint.method,
      });
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        url: endpoint.url,
        status: "N/A",
        statusText: error.message,
        ok: false,
      });
    }
  }
  res.json(results);
});

app.get("/api/get-all-hotels", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT hotel_id, property_name, property_type, city FROM hotels ORDER BY hotel_id"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("ERROR FETCHING ALL HOTELS:", error);
    res.status(500).json({ error: "Failed to fetch hotel list." });
  } finally {
    if (client) await client.end();
  }
});

// --- Health Check Endpoints ---
app.get("/api/test-cloudbeds", async (req, res) => {
  try {
    await getCloudbedsAccessToken();
    res
      .status(200)
      .json({ success: true, message: "Cloudbeds API connection successful." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/test-database", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT NOW()"); // Simple query to test connection
    res
      .status(200)
      .json({ success: true, message: "Database connection successful." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) await client.end();
  }
});

// --- Main Application Endpoints ---
app.get("/api/get-hotel-name", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const ourHotelId = parseInt(process.env.CLOUDBEDS_PROPERTY_ID, 10);
  try {
    await client.connect();
    const query = "SELECT property_name FROM hotels WHERE hotel_id = $1";
    const result = await client.query(query, [ourHotelId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Hotel name not found." });
    }

    res.json({ hotelName: result.rows[0].property_name });
  } catch (error) {
    console.error("ERROR FETCHING HOTEL NAME:", error);
    res.status(500).json({ error: "Failed to fetch hotel details" });
  } finally {
    if (client) await client.end();
  }
});

app.get("/api/last-refresh-time", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const query =
      "SELECT value FROM system_state WHERE key = 'last_successful_refresh'";
    const result = await client.query(query);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Last refresh time not found." });
    }
    const timestamp = result.rows[0].value.timestamp;
    res.json({ last_successful_run: timestamp });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch last refresh time" });
  } finally {
    if (client) await client.end();
  }
});

app.get("/api/kpi-summary", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const ourHotelId = parseInt(process.env.CLOUDBEDS_PROPERTY_ID, 10);
  try {
    await client.connect();
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }
    const kpiQuery = `
      SELECT
        (SUM(CASE WHEN hotel_id = $1 THEN total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN rooms_sold ELSE 0 END), 0)) AS your_adr,
        (SUM(CASE WHEN hotel_id = $1 THEN rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN capacity_count ELSE 0 END), 0)) AS your_occupancy,
        (SUM(CASE WHEN hotel_id = $1 THEN total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN capacity_count ELSE 0 END), 0)) AS your_revpar,
        (SUM(CASE WHEN hotel_id != $1 THEN total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN rooms_sold ELSE 0 END), 0)) AS market_adr,
        (SUM(CASE WHEN hotel_id != $1 THEN rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN capacity_count ELSE 0 END), 0)) AS market_occupancy,
        (SUM(CASE WHEN hotel_id != $1 THEN total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN capacity_count ELSE 0 END), 0)) AS market_revpar
      FROM daily_metrics_snapshots
      WHERE stay_date >= $2 AND stay_date <= $3;
    `;
    const result = await client.query(kpiQuery, [
      ourHotelId,
      startDate,
      endDate,
    ]);
    const kpis = result.rows[0];
    res.json({
      yourHotel: {
        occupancy: kpis.your_occupancy,
        adr: kpis.your_adr,
        revpar: kpis.your_revpar,
      },
      market: {
        occupancy: kpis.market_occupancy,
        adr: kpis.market_adr,
        revpar: kpis.market_revpar,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KPI summary" });
  } finally {
    if (client) await client.end();
  }
});

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
            (SUM(total_revenue) / NULLIF(SUM(rooms_sold), 0)) as adr,
            (SUM(rooms_sold)::NUMERIC / NULLIF(SUM(capacity_count), 0)) as occupancy_direct,
            (SUM(total_revenue)::NUMERIC / NULLIF(SUM(capacity_count), 0)) as revpar,
            SUM(rooms_sold) as rooms_sold,
            SUM(capacity_count) as capacity_count,
            SUM(total_revenue) as total_revenue
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3
        GROUP BY ${timeGroup} ORDER BY ${timeGroup} ASC;`;
    }
    const metricsResult = await client.query(metricsQuery, [
      ourHotelId,
      startDate,
      endDate,
    ]);
    res.json({ metrics: metricsResult.rows, currencySymbol: currencySymbol });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  } finally {
    if (client) await client.end();
  }
});

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
    const countQuery = "SELECT COUNT(*) FROM hotels WHERE hotel_id != $1";
    const countResult = await client.query(countQuery, [ourHotelId]);
    const competitorCount = parseInt(countResult.rows[0].count, 10);
    const capacityQuery = `
        SELECT SUM(t.capacity_count) as total_capacity FROM (
            SELECT DISTINCT ON (hotel_id) hotel_id, capacity_count
            FROM daily_metrics_snapshots
            WHERE hotel_id != $1 ORDER BY hotel_id, stay_date DESC
        ) t;`;
    const capacityResult = await client.query(capacityQuery, [ourHotelId]);
    const totalCapacity =
      parseInt(capacityResult.rows[0].total_capacity, 10) || 0;
    let query;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;
    if (granularity === "daily") {
      query = `
        SELECT
            TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
            AVG(adr) AS market_adr, AVG(occupancy_direct) AS market_occupancy,
            AVG(revpar) AS market_revpar, SUM(rooms_sold) AS market_rooms_sold,
            SUM(capacity_count) AS market_capacity
        FROM daily_metrics_snapshots
        WHERE hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3
        GROUP BY stay_date ORDER BY stay_date ASC;`;
    } else {
      query = `
        SELECT
            TO_CHAR(${timeGroup}, 'YYYY-MM-DD') AS period,
            (SUM(total_revenue) / NULLIF(SUM(rooms_sold), 0)) AS market_adr,
            (SUM(rooms_sold)::NUMERIC / NULLIF(SUM(capacity_count), 0)) AS market_occupancy,
            (SUM(total_revenue)::NUMERIC / NULLIF(SUM(capacity_count), 0)) AS market_revpar,
            SUM(rooms_sold) AS market_rooms_sold,
            SUM(capacity_count) AS market_capacity
        FROM daily_metrics_snapshots
        WHERE hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3
        GROUP BY ${timeGroup} ORDER BY ${timeGroup} ASC;`;
    }
    const result = await client.query(query, [ourHotelId, startDate, endDate]);
    res.json({
      metrics: result.rows,
      competitorCount: competitorCount,
      totalCapacity: totalCapacity,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch competitor metrics from database" });
  } finally {
    if (client) await client.end();
  }
});

// --- Static and fallback routes ---
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

// Serve the main marketing page for the root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Serve the admin panel's HTML for any /admin path
app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

// Serve the main application's HTML for any /app path.
app.get("/app", (req, res) => {
  res.sendFile(path.join(publicPath, "app", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
