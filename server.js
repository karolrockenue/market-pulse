// server.js (Routing Fix)
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const path = require("path");
const { Client } = require("pg");

const dailyRefreshHandler = require("./daily-refresh.js");
const initialSyncHandler = require("./initial-sync.js");

const app = express();
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

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

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
};

// --- V2.0 OAuth Endpoints ---
app.get("/api/auth/cloudbeds", (req, res) => {
  const { CLOUDBEDS_CLIENT_ID } = process.env;

  const isProduction = process.env.VERCEL_ENV === "production";
  const redirectUri = isProduction
    ? "https://market-pulse.io/api/auth/cloudbeds/callback"
    : process.env.CLOUDBEDS_REDIRECT_URI;

  if (!CLOUDBEDS_CLIENT_ID || !redirectUri) {
    console.error("OAuth environment variables not set!");
    return res.status(500).send("Server configuration error.");
  }

  const scopes = [
    "read:user",
    "read:hotel",
    "read:guest",
    "read:reservation",
    "read:room",
    "read:rate",
    "read:currency",
    "read:taxesAndFees",
    "read:dataInsightsGuests",
    "read:dataInsightsOccupancy",
    "read:dataInsightsReservations",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: CLOUDBEDS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
  });

  const authorizationUrl = `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`;
  console.log(`Redirecting to: ${authorizationUrl}`);
  res.redirect(authorizationUrl);
});

app.get("/api/auth/cloudbeds/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Error: No authorization code provided.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;

    const isProduction = process.env.VERCEL_ENV === "production";
    const redirectUri = isProduction
      ? "https://market-pulse.io/api/auth/cloudbeds/callback"
      : process.env.CLOUDBEDS_REDIRECT_URI;

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLOUDBEDS_CLIENT_ID,
      client_secret: CLOUDBEDS_CLIENT_SECRET,
      redirect_uri: redirectUri,
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
    const { access_token, refresh_token } = tokenData;

    const userInfoResponse = await fetch(
      "https://api.cloudbeds.com/api/v1.3/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch from /userinfo endpoint.");
    }
    const userInfo = await userInfoResponse.json();
    console.log("✅ Successfully fetched user info.");

    const propertyInfoResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/me/properties",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
        },
      }
    );
    if (!propertyInfoResponse.ok) {
      throw new Error("Failed to fetch property info from /me/properties.");
    }
    const propertyInfo = await propertyInfoResponse.json();
    if (!propertyInfo || propertyInfo.length === 0) {
      throw new Error("User has no properties assigned to their account.");
    }
    const primaryPropertyId = propertyInfo[0].id;
    console.log(`✅ Successfully fetched property ID: ${primaryPropertyId}`);

    await client.connect();
    const query = `
      INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, access_token, refresh_token, cloudbeds_property_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      ON CONFLICT (cloudbeds_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        cloudbeds_property_id = EXCLUDED.cloudbeds_property_id,
        status = 'active';
    `;
    const values = [
      userInfo.user_id,
      userInfo.email,
      userInfo.first_name,
      userInfo.last_name,
      access_token,
      refresh_token,
      primaryPropertyId,
    ];
    await client.query(query, values);
    console.log(`✅ User ${userInfo.user_id} saved to database.`);

    req.session.userId = userInfo.user_id;
    console.log(`✅ Session created for user ${req.session.userId}.`);

    res.redirect("/app/");
  } catch (error) {
    console.error("CRITICAL ERROR in OAuth callback:", error);
    res
      .status(500)
      .send(`An error occurred during authentication: ${error.message}`);
  } finally {
    if (client) await client.end();
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

// --- Main Application Endpoints (Now Fully User-Aware) ---
app.get("/api/get-hotel-name", isAuthenticated, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    const hotelResult = await client.query(
      "SELECT property_name FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel name not found." });
    }
    res.json({ hotelName: hotelResult.rows[0].property_name });
  } catch (error) {
    console.error("ERROR FETCHING HOTEL NAME:", error);
    res.status(500).json({ error: "Failed to fetch hotel details" });
  } finally {
    if (client) await client.end();
  }
});

app.get("/api/last-refresh-time", isAuthenticated, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT value FROM system_state WHERE key = 'last_successful_refresh'"
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Last refresh time not found." });
    }
    res.json({ last_successful_run: result.rows[0].value.timestamp });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch last refresh time" });
  } finally {
    if (client) await client.end();
  }
});

app.get("/api/kpi-summary", isAuthenticated, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }

    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    const kpiQuery = `
      SELECT
        (SUM(CASE WHEN hotel_id = $1 THEN total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN rooms_sold ELSE 0 END), 0)) AS your_adr,
        (SUM(CASE WHEN hotel_id = $1 THEN rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN capacity_count ELSE 0 END), 0)) AS your_occupancy,
        (SUM(CASE WHEN hotel_id = $1 THEN total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN capacity_count ELSE 0 END), 0)) AS your_revpar,
        (SUM(CASE WHEN hotel_id != $1 THEN total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN rooms_sold ELSE 0 END), 0)) AS market_adr,
        (SUM(CASE WHEN hotel_id != $1 THEN rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN capacity_count ELSE 0 END), 0)) AS market_occupancy,
        (SUM(CASE WHEN hotel_id != $1 THEN total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN capacity_count ELSE 0 END), 0)) AS market_revpar
      FROM daily_metrics_snapshots
      WHERE stay_date >= $2 AND stay_date <= $3 AND cloudbeds_user_id = $4;
    `;
    const result = await client.query(kpiQuery, [
      propertyId,
      startDate,
      endDate,
      req.session.userId,
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

app.get("/api/metrics-from-db", isAuthenticated, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { startDate, endDate, granularity = "daily" } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }

    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    const currencyQuery =
      "SELECT currency_symbol FROM hotels WHERE hotel_id = $1";
    const currencyResult = await client.query(currencyQuery, [propertyId]);
    const currencySymbol = currencyResult.rows[0]?.currency_symbol || "$";

    let metricsQuery;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;

    const baseWhereClause = `hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3 AND cloudbeds_user_id = $4`;

    if (granularity === "daily") {
      metricsQuery = `
        SELECT
            TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
            adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue
        FROM daily_metrics_snapshots
        WHERE ${baseWhereClause}
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
        WHERE ${baseWhereClause}
        GROUP BY ${timeGroup} ORDER BY ${timeGroup} ASC;`;
    }
    const metricsResult = await client.query(metricsQuery, [
      propertyId,
      startDate,
      endDate,
      req.session.userId,
    ]);
    res.json({ metrics: metricsResult.rows, currencySymbol: currencySymbol });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  } finally {
    if (client) await client.end();
  }
});

app.get("/api/competitor-metrics", isAuthenticated, async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { startDate, endDate, granularity = "daily" } = req.query;
    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });
    }

    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    const countQuery = "SELECT COUNT(*) FROM hotels WHERE hotel_id != $1";
    const countResult = await client.query(countQuery, [propertyId]);
    const competitorCount = parseInt(countResult.rows[0].count, 10);

    const capacityQuery = `
        SELECT SUM(t.capacity_count) as total_capacity FROM (
            SELECT DISTINCT ON (hotel_id) hotel_id, capacity_count
            FROM daily_metrics_snapshots
            WHERE hotel_id != $1 ORDER BY hotel_id, stay_date DESC
        ) t;`;
    const capacityResult = await client.query(capacityQuery, [propertyId]);
    const totalCapacity =
      parseInt(capacityResult.rows[0].total_capacity, 10) || 0;

    let query;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;

    const baseWhereClause = `hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3`;

    if (granularity === "daily") {
      query = `
        SELECT
            TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
            AVG(adr) AS market_adr, AVG(occupancy_direct) AS market_occupancy,
            AVG(revpar) AS market_revpar, SUM(rooms_sold) AS market_rooms_sold,
            SUM(capacity_count) AS market_capacity
        FROM daily_metrics_snapshots
        WHERE ${baseWhereClause}
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
        WHERE ${baseWhereClause}
        GROUP BY ${timeGroup} ORDER BY ${timeGroup} ASC;`;
    }
    const result = await client.query(query, [propertyId, startDate, endDate]);
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

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/admin/", (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

// MODIFIED: Added a trailing slash to the route handler.
app.get("/app/", (req, res) => {
  res.sendFile(path.join(publicPath, "app", "index.html"));
});

app.get("/app/reports/", (req, res) => {
  res.sendFile(path.join(publicPath, "app", "reports.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
