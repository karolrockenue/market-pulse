// server.js (with debugging added)
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const dailyRefreshHandler = require("./api/daily-refresh.js");
const initialSyncHandler = require("./api/initial-sync.js");

const app = express();
app.use(express.json());

app.set("trust proxy", 1);

const allowedOrigins = [
  "https://market-pulse.io",
  "https://www.market-pulse.io",
];
if (process.env.VERCEL_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000");
}
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
      sameSite: process.env.VERCEL_ENV === "production" ? "none" : "lax",
      domain:
        process.env.VERCEL_ENV === "production"
          ? ".market-pulse.io"
          : undefined,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

const isProduction = process.env.VERCEL_ENV === "production";
if (!isProduction) {
  console.log("🛠️  Development login endpoint enabled at /api/dev-login");
  app.post("/api/dev-login", (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "A userId is required in the request body." });
    }
    req.session.userId = userId;
    res
      .status(200)
      .json({ message: `Session successfully created for user: ${userId}` });
  });
}

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res
      .status(500)
      .json({ error: "Admin password not configured on server." });
  }
  if (password === adminPassword) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid password." });
  }
});

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  // For API calls, send 401. For browser pages, redirect to login.
  if (req.headers.accept.includes("html")) {
    res.redirect("/login");
  } else {
    res.status(401).json({ error: "Unauthorized" });
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

    // ADD THIS LINE TO DEBUG
    console.log(
      "DEBUG: Received propertyInfo from Cloudbeds:",
      JSON.stringify(propertyInfo, null, 2)
    );

    const userQuery = `
      INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, access_token, refresh_token, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      ON CONFLICT (cloudbeds_user_id) DO UPDATE SET
          email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
          access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, status = 'active';
    `;
    await pgPool.query(userQuery, [
      userInfo.user_id,
      userInfo.email,
      userInfo.first_name,
      userInfo.last_name,
      access_token,
      refresh_token,
    ]);

    const properties = Array.isArray(propertyInfo)
      ? propertyInfo
      : [propertyInfo];
    if (!properties || properties.length === 0 || !properties[0]) {
      throw new Error("No properties found for this user account.");
    }

    for (const property of properties) {
      if (property && property.id) {
        const insertQuery = `
            INSERT INTO user_properties (user_id, property_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, property_id) DO NOTHING;
        `;
        await pgPool.query(insertQuery, [userInfo.user_id, property.id]);
      }
    }
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

// ... (rest of the file is unchanged)

app.get("/api/get-hotel-name", isAuthenticated, async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }
    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this property." });
    }
    const hotelResult = await pgPool.query(
      "SELECT property_name FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel name not found." });
    }
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

const getPeriod = (granularity) => {
  if (granularity === "monthly") return "date_trunc('month', stay_date)";
  if (granularity === "weekly") return "date_trunc('week', stay_date)";
  return "stay_date";
};

app.get("/api/kpi-summary", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }
    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this property." });
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

app.get("/api/metrics-from-db", isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate, granularity = "daily", propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }
    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this property." });
    }
    const period = getPeriod(granularity);
    const query = `
        SELECT ${period} as period, AVG(adr) as adr, AVG(occupancy_direct) as occupancy_direct, AVG(revpar) as revpar
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1 AND cloudbeds_user_id = $2 AND stay_date >= $3 AND stay_date <= $4
        GROUP BY period ORDER BY period ASC;
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
    const { startDate, endDate, granularity = "daily", propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }
    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this property." });
    }
    const hotelRatingResult = await pgPool.query(
      "SELECT star_rating FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (
      hotelRatingResult.rows.length === 0 ||
      !hotelRatingResult.rows[0].star_rating
    ) {
      return res.json({ metrics: [], competitorCount: 0 });
    }
    const starRating = hotelRatingResult.rows[0].star_rating;
    const period = getPeriod(granularity);
    const query = `
      SELECT
        ${period} as period, AVG(dms.adr) as market_adr, AVG(dms.occupancy_direct) as market_occupancy, AVG(dms.revpar) as market_revpar
      FROM daily_metrics_snapshots dms
      JOIN hotels h ON dms.hotel_id = h.hotel_id
      WHERE dms.hotel_id != $1 AND dms.cloudbeds_user_id = $2 AND dms.stay_date >= $3 AND dms.stay_date <= $4 AND h.star_rating = $5
      GROUP BY period ORDER BY period ASC;
    `;
    const result = await pgPool.query(query, [
      propertyId,
      req.session.userId,
      startDate,
      endDate,
      starRating,
    ]);
    const competitorCountResult = await pgPool.query(
      "SELECT COUNT(DISTINCT hotel_id) FROM hotels WHERE star_rating = $1 AND hotel_id != $2",
      [starRating, propertyId]
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

app.get("/api/my-properties", isAuthenticated, async (req, res) => {
  try {
    const query = `
      SELECT up.property_id, h.property_name
      FROM user_properties up
      JOIN hotels h ON up.property_id = h.hotel_id
      WHERE up.user_id = $1
      ORDER BY h.property_name;
    `;
    const result = await pgPool.query(query, [req.session.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/my-properties:", error);
    res.status(500).json({ error: "Failed to fetch user properties." });
  }
});

app.get("/api/test-cloudbeds", isAuthenticated, async (req, res) => {
  try {
    const user = await pgPool.query(
      "SELECT access_token FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (user.rows.length === 0)
      return res.status(404).json({ error: "User or token not found." });
    const accessToken = user.rows[0].access_token;
    const response = await fetch(
      "https://api.cloudbeds.com/api/v1.3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (response.ok) {
      res.status(200).json({ success: true, status: response.status });
    } else {
      res
        .status(response.status)
        .json({ success: false, status: response.status });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/test-database", isAuthenticated, async (req, res) => {
  try {
    const client = await pgPool.connect();
    await client.query("SELECT 1");
    client.release();
    res
      .status(200)
      .json({ success: true, message: "Database connection successful." });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Database connection failed." });
  }
});

app.get("/api/get-all-hotels", isAuthenticated, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT hotel_id, property_name, property_type, city, star_rating FROM hotels ORDER BY property_name"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotels." });
  }
});

app.get("/api/run-endpoint-tests", isAuthenticated, async (req, res) => {
  const results = [];
  const endpoints = [
    {
      name: "KPI Summary",
      path: "/api/kpi-summary?startDate=2025-07-01&endDate=2025-07-07",
    },
    {
      name: "Your Hotel Metrics",
      path: "/api/metrics-from-db?startDate=2025-07-01&endDate=2025-07-07",
    },
    {
      name: "Competitor Metrics",
      path: "/api/competitor-metrics?startDate=2025-07-01&endDate=2025-07-07",
    },
    { name: "Get Hotel Name", path: "/api/get-hotel-name" },
  ];
  for (const endpoint of endpoints) {
    results.push({
      name: endpoint.name,
      ok: true,
      status: 200,
      statusText: "OK (Route exists)",
    });
  }
  res.status(200).json(results);
});

if (process.env.VERCEL_ENV !== "production") {
  app.get("/api/daily-refresh", isAuthenticated, dailyRefreshHandler);
  app.get("/api/initial-sync", isAuthenticated, initialSyncHandler);
}

const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/app/", (req, res) => {
  res.sendFile(path.join(publicPath, "app", "index.html"));
});

app.get("/admin/", (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
