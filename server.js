// server.js (Final Version with All Endpoints Implemented)
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const dailyRefreshHandler = require("./daily-refresh.js");
const initialSyncHandler = require("./initial-sync.js");

const app = express();
app.use(express.json());

app.set("trust proxy", 1);

const allowedOrigins = [
  "https://market-pulse.io",
  "https://www.market-pulse.io",
];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
};
app.use(cors(corsOptions));

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);
// Add this block to server.js

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res
      .status(500)
      .json({ error: "Admin password not configured on server." });
  }

  if (password === adminPassword) {
    // Note: We are not creating a full session here,
    // the admin panel uses sessionStorage on the frontend.
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid password." });
  }
});

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  } else {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }
};

app.get("/api/auth/cloudbeds", (req, res) => {
  const { CLOUDBEDS_CLIENT_ID } = process.env;

  const isProduction = process.env.VERCEL_ENV === "production";
  const redirectUri = isProduction
    ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
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
  res.redirect(authorizationUrl);
});

app.get("/api/auth/cloudbeds/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Error: No authorization code provided.");
  }

  try {
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
    if (!tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      throw new Error("Failed to get access token from Cloudbeds.");
    }
    const { access_token, refresh_token } = tokenData;

    const userInfoResponse = await fetch(
      "https://api.cloudbeds.com/api/v1.3/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userInfo = await userInfoResponse.json();

    const propertyInfoResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/me/properties",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
        },
      }
    );
    const propertyInfo = await propertyInfoResponse.json();
    const primaryPropertyId = propertyInfo[0].id;

    const query = `
            INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, access_token, refresh_token, cloudbeds_property_id, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
            ON CONFLICT (cloudbeds_user_id) DO UPDATE SET
                email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
                cloudbeds_property_id = EXCLUDED.cloudbeds_property_id, status = 'active';
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
    await pgPool.query(query, values);

    req.session.userId = userInfo.user_id;

    req.session.save((err) => {
      if (err) {
        console.error("CRITICAL: Error saving session before redirect:", err);
        return res
          .status(500)
          .send("An error occurred during authentication session save.");
      }
      res.redirect("/app/");
    });
  } catch (error) {
    console.error("CRITICAL ERROR in OAuth callback:", error);
    res
      .status(500)
      .send(`An error occurred during authentication: ${error.message}`);
  }
});

app.get("/api/get-hotel-name", isAuthenticated, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;

    const hotelResult = await pgPool.query(
      "SELECT property_name FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (hotelResult.rows.length === 0)
      return res.status(404).json({ error: "Hotel name not found." });
    res.json({ hotelName: hotelResult.rows[0].property_name });
  } catch (error) {
    console.error("Error in /api/get-hotel-name:", error);
    res.status(500).json({ error: "Failed to fetch hotel details" });
  }
});

app.get("/api/last-refresh-time", isAuthenticated, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT value FROM system_state WHERE key = 'last_successful_refresh'"
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Last refresh time not found." });
    res.json({ last_successful_run: result.rows[0].value.timestamp });
  } catch (error) {
    console.error("Error in /api/last-refresh-time:", error);
    res.status(500).json({ error: "Failed to fetch last refresh time" });
  }
});

app.get("/api/kpi-summary", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userResult = await pgPool.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
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
    const result = await pgPool.query(kpiQuery, [
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
    console.error("Error in /api/kpi-summary:", error);
    res.status(500).json({ error: "Failed to fetch KPI summary" });
  }
});

// --- NEWLY IMPLEMENTED ENDPOINTS ---

const getPeriod = (granularity) => {
  if (granularity === "monthly") return "date_trunc('month', stay_date)";
  if (granularity === "weekly") return "date_trunc('week', stay_date)";
  return "stay_date";
};

app.get("/api/metrics-from-db", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, granularity = "daily" } = req.query;
    const userResult = await pgPool.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;
    const period = getPeriod(granularity);

    const query = `
      SELECT
        ${period} as period,
        AVG(adr) as adr,
        AVG(occupancy_direct) as occupancy_direct,
        AVG(revpar) as revpar
      FROM daily_metrics_snapshots
      WHERE
        hotel_id = $1 AND
        cloudbeds_user_id = $2 AND
        stay_date >= $3 AND
        stay_date <= $4
      GROUP BY period
      ORDER BY period ASC;
    `;
    const result = await pgPool.query(query, [
      propertyId,
      req.session.userId,
      startDate,
      endDate,
    ]);
    res.json({ metrics: result.rows });
  } catch (error) {
    console.error("Error in /api/metrics-from-db:", error);
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  }
});

app.get("/api/competitor-metrics", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, granularity = "daily" } = req.query;
    const userResult = await pgPool.query(
      "SELECT cloudbeds_property_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found." });
    const propertyId = userResult.rows[0].cloudbeds_property_id;
    const period = getPeriod(granularity);

    const query = `
      SELECT
        ${period} as period,
        AVG(adr) as market_adr,
        AVG(occupancy_direct) as market_occupancy,
        AVG(revpar) as market_revpar,
        COUNT(DISTINCT hotel_id) as competitor_count,
        SUM(capacity_count) as total_capacity
      FROM daily_metrics_snapshots
      WHERE
        hotel_id != $1 AND
        cloudbeds_user_id = $2 AND
        stay_date >= $3 AND
        stay_date <= $4
      GROUP BY period
      ORDER BY period ASC;
    `;
    const result = await pgPool.query(query, [
      propertyId,
      req.session.userId,
      startDate,
      endDate,
    ]);
    const competitorCountResult = await pgPool.query(
      "SELECT COUNT(DISTINCT hotel_id) FROM daily_metrics_snapshots WHERE hotel_id != $1",
      [propertyId]
    );

    res.json({
      metrics: result.rows,
      competitorCount: competitorCountResult.rows[0]?.count || 0,
    });
  } catch (error) {
    console.error("Error in /api/competitor-metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  }
});

// --- Static and fallback routes  ---
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/app/", (req, res) => {
  res.sendFile(path.join(publicPath, "app", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
