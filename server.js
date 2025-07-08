require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());
app.set("trust proxy", 1);

// --- CORS Configuration ---
const allowedOrigins = [
  "https://market-pulse.io",
  "https://www.market-pulse.io",
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error("CORS policy does not allow access"), false);
    }
    return callback(null, true);
  },
  credentials: true,
};
app.use(cors(corsOptions));

// --- Create ONE Database Pool for the entire application ---
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon DB connections from Vercel
  },
});

// --- Configure the Persistent Session Store using the Pool ---
app.use(
  session({
    store: new pgSession({
      pool: pgPool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.VERCEL_ENV === "production",
      httpOnly: true,
      sameSite: "none",
      domain:
        process.env.VERCEL_ENV === "production"
          ? ".market-pulse.io"
          : undefined,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// --- Middleware ---
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
};

// --- OAuth & Auth Routes ---
app.get("/api/auth/cloudbeds", (req, res) => {
  const { CLOUDBEDS_CLIENT_ID } = process.env;
  const isProduction = process.env.VERCEL_ENV === "production";
  const redirectUri = isProduction
    ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
    : process.env.CLOUDBEDS_REDIRECT_URI;
  const scopes =
    "read:user read:hotel read:guest read:reservation read:room read:rate read:currency read:taxesAndFees read:dataInsightsGuests read:dataInsightsOccupancy read:dataInsightsReservations";
  const params = new URLSearchParams({
    client_id: CLOUDBEDS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
  });
  const authorizationUrl = `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`;
  res.redirect(authorizationUrl);
});

app.get("/api/auth/cloudbeds/callback", async (req, res) => {
  const { code } = req.query;
  if (!code)
    return res.status(400).send("Error: No authorization code provided.");
  let client;
  try {
    client = await pgPool.connect();
    const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
    const isProduction = process.env.VERCEL_ENV === "production";
    const redirectUri = isProduction
      ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
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
    if (!tokenData.access_token)
      throw new Error("Failed to get access token from Cloudbeds.");
    const { access_token, refresh_token } = tokenData;
    const userInfoResponse = await fetch(
      "https://api.cloudbeds.com/api/v1.3/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userInfo = await userInfoResponse.json();
    const propertyInfoResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/me/properties",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const propertyInfo = await propertyInfoResponse.json();
    const primaryPropertyId = propertyInfo[0].id;
    const query = `INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, access_token, refresh_token, cloudbeds_property_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') ON CONFLICT (cloudbeds_user_id) DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, cloudbeds_property_id = EXCLUDED.cloudbeds_property_id, status = 'active';`;
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
    req.session.userId = userInfo.user_id;
    res.redirect("/app/");
  } catch (error) {
    console.error("CRITICAL ERROR in OAuth callback:", error);
    res
      .status(500)
      .send(`An error occurred during authentication: ${error.message}`);
  } finally {
    if (client) client.release();
  }
});

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (password === adminPassword) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false, error: "Unauthorized" });
  }
});

// --- REFACTORED Application Endpoints ---

app.get("/api/get-hotel-name", isAuthenticated, async (req, res) => {
  let client;
  try {
    client = await pgPool.connect();
    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;
    const hotelResult = await client.query(
      "SELECT property_name FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (hotelResult.rows.length === 0)
      return res.status(404).json({ error: "Hotel name not found." });
    res.json({ hotelName: hotelResult.rows[0].property_name });
  } catch (error) {
    console.error("Error fetching hotel name:", error);
    res.status(500).json({ error: "Failed to fetch hotel details" });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/last-refresh-time", isAuthenticated, async (req, res) => {
  let client;
  try {
    client = await pgPool.connect();
    const result = await client.query(
      "SELECT value FROM system_state WHERE key = 'last_successful_refresh'"
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Last refresh time not found." });
    res.json({ last_successful_run: result.rows[0].value.timestamp });
  } catch (error) {
    console.error("Error fetching last refresh time:", error);
    res.status(500).json({ error: "Failed to fetch last refresh time" });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/kpi-summary", isAuthenticated, async (req, res) => {
  let client;
  try {
    client = await pgPool.connect();
    const { startDate, endDate } = req.query;
    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;
    const kpiQuery = `SELECT (SUM(CASE WHEN hotel_id = $1 THEN total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN rooms_sold ELSE 0 END), 0)) AS your_adr, (SUM(CASE WHEN hotel_id = $1 THEN rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN capacity_count ELSE 0 END), 0)) AS your_occupancy, (SUM(CASE WHEN hotel_id = $1 THEN total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id = $1 THEN capacity_count ELSE 0 END), 0)) AS your_revpar, (SUM(CASE WHEN hotel_id != $1 THEN total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN rooms_sold ELSE 0 END), 0)) AS market_adr, (SUM(CASE WHEN hotel_id != $1 THEN rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN capacity_count ELSE 0 END), 0)) AS market_occupancy, (SUM(CASE WHEN hotel_id != $1 THEN total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN hotel_id != $1 THEN capacity_count ELSE 0 END), 0)) AS market_revpar FROM daily_metrics_snapshots WHERE stay_date >= $2 AND stay_date <= $3 AND cloudbeds_user_id = $4;`;
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
    console.error("Error fetching KPI summary:", error);
    res.status(500).json({ error: "Failed to fetch KPI summary" });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/metrics-from-db", isAuthenticated, async (req, res) => {
  let client;
  try {
    client = await pgPool.connect();
    const { startDate, endDate, granularity = "daily" } = req.query;
    if (!startDate || !endDate)
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });

    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    let metricsQuery;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;

    const baseWhereClause = `hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3 AND cloudbeds_user_id = $4`;
    if (granularity === "daily") {
      metricsQuery = `SELECT TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue FROM daily_metrics_snapshots WHERE ${baseWhereClause} ORDER BY stay_date ASC;`;
    } else {
      metricsQuery = `SELECT TO_CHAR(${timeGroup}, 'YYYY-MM-DD') AS period, (SUM(total_revenue) / NULLIF(SUM(rooms_sold), 0)) as adr, (SUM(rooms_sold)::NUMERIC / NULLIF(SUM(capacity_count), 0)) as occupancy_direct, (SUM(total_revenue)::NUMERIC / NULLIF(SUM(capacity_count), 0)) as revpar, SUM(rooms_sold) as rooms_sold, SUM(capacity_count) as capacity_count, SUM(total_revenue) as total_revenue FROM daily_metrics_snapshots WHERE ${baseWhereClause} GROUP BY ${timeGroup} ORDER BY ${timeGroup} ASC;`;
    }
    const metricsResult = await client.query(metricsQuery, [
      propertyId,
      startDate,
      endDate,
      req.session.userId,
    ]);
    res.json({ metrics: metricsResult.rows });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/competitor-metrics", isAuthenticated, async (req, res) => {
  let client;
  try {
    client = await pgPool.connect();
    const { startDate, endDate, granularity = "daily" } = req.query;
    if (!startDate || !endDate)
      return res
        .status(400)
        .json({ error: "startDate and endDate are required." });

    const userResult = await client.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    let query;
    let sqlGranularity = "day";
    if (granularity === "weekly") sqlGranularity = "week";
    if (granularity === "monthly") sqlGranularity = "month";
    const timeGroup = `DATE_TRUNC('${sqlGranularity}', stay_date)`;
    const baseWhereClause = `hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3`;

    if (granularity === "daily") {
      query = `SELECT TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date, AVG(adr) AS market_adr, AVG(occupancy_direct) AS market_occupancy, AVG(revpar) AS market_revpar, SUM(rooms_sold) AS market_rooms_sold, SUM(capacity_count) AS market_capacity FROM daily_metrics_snapshots WHERE ${baseWhereClause} GROUP BY stay_date ORDER BY stay_date ASC;`;
    } else {
      query = `SELECT TO_CHAR(${timeGroup}, 'YYYY-MM-DD') AS period, (SUM(total_revenue) / NULLIF(SUM(rooms_sold), 0)) AS market_adr, (SUM(rooms_sold)::NUMERIC / NULLIF(SUM(capacity_count), 0)) AS market_occupancy, (SUM(total_revenue)::NUMERIC / NULLIF(SUM(capacity_count), 0)) AS market_revpar, SUM(rooms_sold) AS market_rooms_sold, SUM(capacity_count) AS market_capacity FROM daily_metrics_snapshots WHERE ${baseWhereClause} GROUP BY ${timeGroup} ORDER BY ${timeGroup} ASC;`;
    }
    const result = await client.query(query, [propertyId, startDate, endDate]);
    res.json({ metrics: result.rows });
  } catch (error) {
    console.error("Error fetching competitor metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  } finally {
    if (client) client.release();
  }
});

// --- Static and fallback routes ---
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});
app.get("/app", (req, res) => {
  res.redirect("/app/");
});
app.get("/app/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});
app.get("/app/reports", (req, res) => {
  res.redirect("/app/reports/");
});
app.get("/app/reports/", (req, res) => {
  res.sendFile(path.join(publicPath, "reports.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
