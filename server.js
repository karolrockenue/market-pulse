// server.js (Production Ready - Database-Driven Roles)
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- Reusable Cloudbeds Auth Function ---
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
  if (!tokenData.access_token) {
    throw new Error("Cloudbeds authentication failed.");
  }
  return tokenData.access_token;
}

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

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      maxAge: 60 * 24 * 60 * 60 * 1000,
    },
  })
);

// --- AUTHENTICATION & ROLE-BASED MIDDLEWARE ---
const requireUserApi = (req, res, next) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  next();
};

const requireAdminApi = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res
      .status(403)
      .json({ error: "Forbidden: Administrator access required." });
  }
  next();
};

const requirePageLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/signin");
  }
  next();
};

// --- AUTHENTICATION ENDPOINTS ---
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res
        .status(500)
        .json({ error: "Could not log out, please try again." });
    }
    const cookieDomain =
      process.env.VERCEL_ENV === "production" ? ".market-pulse.io" : undefined;
    res.clearCookie("connect.sid", { domain: cookieDomain, path: "/" });
    res.status(200).json({ message: "Logged out successfully" });
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }
  try {
    const userResult = await pgPool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 15 * 60 * 1000);
    await pgPool.query(
      "INSERT INTO magic_login_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)",
      [token, user.user_id, expires_at]
    );
    const loginLink = `https://www.market-pulse.io/api/auth/magic-link-callback?token=${token}`;
    const msg = {
      to: user.email,
      from: "login@market-pulse.io",
      subject: "Your Market Pulse Login Link",
      html: `<p>Hello ${user.first_name},</p><p>Click the link below to log in to your Market Pulse dashboard. This link will expire in 15 minutes.</p><p><a href="${loginLink}">Log in to Market Pulse</a></p>`,
    };
    await sgMail.send(msg);
    res.status(200).json({ success: true, message: "Login link sent." });
  } catch (error) {
    console.error("Error during magic link login:", error);
    res.status(500).json({ error: "An internal error occurred." });
  }
});

app.get("/api/auth/magic-link-callback", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Invalid or missing login token.");
  }
  try {
    const tokenResult = await pgPool.query(
      "SELECT * FROM magic_login_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    if (tokenResult.rows.length === 0) {
      return res
        .status(400)
        .send(
          "Login link is invalid or has expired. Please request a new one."
        );
    }
    const validToken = tokenResult.rows[0];
    const internalUserId = validToken.user_id;

    const userResult = await pgPool.query(
      "SELECT cloudbeds_user_id, is_admin FROM users WHERE user_id = $1",
      [internalUserId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send("Could not find a matching user account.");
    }

    const user = userResult.rows[0];
    req.session.userId = user.cloudbeds_user_id;
    req.session.isAdmin = user.is_admin || false;

    await pgPool.query("DELETE FROM magic_login_tokens WHERE token = $1", [
      token,
    ]);

    req.session.save((err) => {
      if (err) {
        console.error("Session save error after magic link login:", err);
        return res.status(500).send("An error occurred during login.");
      }
      res.redirect("/app/");
    });
  } catch (error) {
    console.error("Error during magic link callback:", error);
    res.status(500).send("An internal error occurred.");
  }
});

app.get("/api/auth/session-info", (req, res) => {
  if (req.session.userId) {
    res.json({
      isLoggedIn: true,
      isAdmin: req.session.isAdmin || false,
    });
  } else {
    res.json({
      isLoggedIn: false,
      isAdmin: false,
    });
  }
});

app.get("/api/auth/cloudbeds", (req, res) => {
  const { CLOUDBEDS_CLIENT_ID } = process.env;
  const isProduction = process.env.VERCEL_ENV === "production";
  const redirectUri = isProduction
    ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
    : process.env.CLOUDBEDS_REDIRECT_URI;

  if (!CLOUDBEDS_CLIENT_ID || !redirectUri) {
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
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const propertyInfo = await propertyInfoResponse.json();

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
        const hotelInsertQuery = `
          INSERT INTO hotels (hotel_id, property_name, city, star_rating)
          VALUES ($1, $2, $3, 2)
          ON CONFLICT (hotel_id) DO NOTHING;
        `;
        await pgPool.query(hotelInsertQuery, [
          property.id,
          property.name,
          property.city,
        ]);
        const userPropertyLinkQuery = `INSERT INTO user_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT (user_id, property_id) DO NOTHING;`;
        await pgPool.query(userPropertyLinkQuery, [
          userInfo.user_id,
          property.id,
        ]);
      }
    }

    const userRoleResult = await pgPool.query(
      "SELECT is_admin FROM users WHERE cloudbeds_user_id = $1",
      [userInfo.user_id]
    );
    const isAdmin = userRoleResult.rows[0]?.is_admin || false;

    req.session.userId = userInfo.user_id;
    req.session.isAdmin = isAdmin;

    req.session.save((err) => {
      if (err) {
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

// --- DASHBOARD AND ADMIN APIs ---
app.get("/api/get-hotel-name", requireUserApi, async (req, res) => {
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

app.get("/api/last-refresh-time", requireUserApi, async (req, res) => {
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

app.get("/api/kpi-summary", requireUserApi, async (req, res) => {
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
    const hotelRatingResult = await pgPool.query(
      "SELECT star_rating FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (
      hotelRatingResult.rows.length === 0 ||
      !hotelRatingResult.rows[0].star_rating
    ) {
      return res.json({ yourHotel: {}, market: {} });
    }
    const starRating = hotelRatingResult.rows[0].star_rating;

    const kpiQuery = `
            SELECT
                (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END), 0)) AS your_adr,
                (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0)) AS your_occupancy,
                (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0)) AS your_revpar,
                (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END), 0)) AS market_adr,
                (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0)) AS market_occupancy,
                (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0)) AS market_revpar
            FROM daily_metrics_snapshots dms
            JOIN hotels h ON dms.hotel_id = h.hotel_id
            WHERE dms.stay_date >= $2 AND dms.stay_date <= $3 AND h.star_rating = $4;
        `;
    const result = await pgPool.query(kpiQuery, [
      propertyId,
      startDate,
      endDate,
      starRating,
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

app.get("/api/metrics-from-db", requireUserApi, async (req, res) => {
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
            WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3
            GROUP BY period ORDER BY period ASC;
        `;
    const result = await pgPool.query(query, [propertyId, startDate, endDate]);
    res.json({ metrics: result.rows });
  } catch (error) {
    console.error("Error in /api/metrics-from-db:", error);
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  }
});

app.get("/api/competitor-metrics", requireUserApi, async (req, res) => {
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
            SELECT ${period} as period, AVG(dms.adr) as market_adr, AVG(dms.occupancy_direct) as market_occupancy, AVG(dms.revpar) as market_revpar
            FROM daily_metrics_snapshots dms
            JOIN hotels h ON dms.hotel_id = h.hotel_id
            WHERE dms.hotel_id != $1 AND h.star_rating = $2 AND dms.stay_date >= $3 AND dms.stay_date <= $4
            GROUP BY period ORDER BY period ASC;
        `;
    const result = await pgPool.query(query, [
      propertyId,
      starRating,
      startDate,
      endDate,
    ]);
    const competitorCountResult = await pgPool.query(
      "SELECT COUNT(DISTINCT hotel_id) FROM hotels WHERE star_rating = $1 AND hotel_id != $2",
      [starRating, propertyId]
    );
    res.json({
      metrics: result.rows,
      competitorCount: parseInt(competitorCountResult.rows[0]?.count || 0, 10),
    });
  } catch (error) {
    console.error("Error in /api/competitor-metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  }
});

app.get("/api/my-properties", requireUserApi, async (req, res) => {
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

app.get("/api/test-cloudbeds", requireAdminApi, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      status: 200,
      message: "Admin connection test successful.",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/test-database", requireAdminApi, async (req, res) => {
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

app.get("/api/get-all-hotels", requireAdminApi, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT hotel_id, property_name, property_type, city, star_rating FROM hotels ORDER BY property_name"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotels." });
  }
});

// --- START: NEW API EXPLORER PROXY ---
app.get("/api/explore/datasets", requireAdminApi, async (req, res) => {
  console.log("[server.js] Admin API Explorer: Fetching datasets...");
  try {
    const accessToken = await getCloudbedsAccessToken();
    const targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
      },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok) {
      throw new Error(
        `Cloudbeds API responded with status ${
          cloudbedsApiResponse.status
        }: ${JSON.stringify(data)}`
      );
    }
    res.status(200).json(data);
  } catch (error) {
    console.error("[server.js] Admin API Explorer Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/explore/dataset-structure", requireAdminApi, async (req, res) => {
  console.log("[server.js] Admin API Explorer: Fetching dataset structure...");
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Dataset ID is required." });
    }
    const accessToken = await getCloudbedsAccessToken();
    const targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
      },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok) {
      throw new Error(
        `Cloudbeds API responded with status ${
          cloudbedsApiResponse.status
        }: ${JSON.stringify(data)}`
      );
    }
    res.status(200).json(data);
  } catch (error) {
    console.error("[server.js] Admin API Explorer Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add this new endpoint to handle the "Get Sample Guest" button
app.get("/api/explore/sample-guest", requireAdminApi, async (req, res) => {
  console.log("[server.js] Admin API Explorer: Fetching sample guest...");
  try {
    const accessToken = await getCloudbedsAccessToken();

    // This is the corrected URL for getGuestList from the documentation
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getGuestList?propertyIDs=${process.env.CLOUDBEDS_PROPERTY_ID}&pageSize=1`;

    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);

    // Return just the first guest from the list
    if (data.data && data.data.length > 0) {
      res.status(200).json(data.data[0]);
    } else {
      res.status(200).json({ message: "No guests found for this property." });
    }
  } catch (error) {
    console.error("[server.js] Admin API Explorer Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// New endpoint to get a sample of real data from the Insights API
// This is the final, most intelligent version of this endpoint.
app.get("/api/explore/insights-data", requireAdminApi, async (req, res) => {
  console.log("[server.js] Admin API Explorer: Fetching insights data...");
  try {
    const { id, columns } = req.query;
    if (!id) return res.status(400).json({ error: "Dataset ID is required." });
    if (!columns)
      return res.status(400).json({ error: "Column names are required." });

    const accessToken = await getCloudbedsAccessToken();

    // Step 1: Fetch the dataset's schema to learn the data types of all fields.
    const schemaUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;
    const schemaResponse = await fetch(schemaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
      },
    });
    const schemaData = await schemaResponse.json();
    if (!schemaResponse.ok)
      throw new Error(
        `Could not fetch dataset schema: ${JSON.stringify(schemaData)}`
      );

    // Create a simple map of column names to their data types (e.g., { "adr": "DynamicCurrency", "id": "Identifier" })
    const fieldTypeMap = new Map();
    if (schemaData.cdfs) {
      for (const category of schemaData.cdfs) {
        if (category.cdfs) {
          for (const field of category.cdfs) {
            fieldTypeMap.set(field.column, field.kind);
          }
        }
      }
    }

    // Step 2: Intelligently build the columns array for the data request.
    const requestedColumns = columns.split(",").map((colName) => {
      const trimmedColName = colName.trim();
      const kind = fieldTypeMap.get(trimmedColName);

      // Only add metrics for column types that support it (Numbers, Currencies).
      if (
        kind === "Number" ||
        kind === "Currency" ||
        kind === "DynamicCurrency" ||
        kind === "DynamicPercentage"
      ) {
        return { cdf: { column: trimmedColName }, metrics: ["sum", "mean"] };
      } else {
        // For Identifiers, Strings, Dates, etc., do NOT request metrics.
        return { cdf: { column: trimmedColName } };
      }
    });

    // Step 3: Build the final payload with the smart columns array.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateForFilter = yesterday.toISOString().split("T")[0];

    let filterColumn = id === "7" ? "stay_date" : "checkin_date";

    let insightsPayload = {
      property_ids: [parseInt(process.env.CLOUDBEDS_PROPERTY_ID)],
      dataset_id: parseInt(id),
      columns: requestedColumns,
      filters: {
        and: [
          {
            cdf: { column: filterColumn },
            operator: "equals",
            value: `${dateForFilter}T00:00:00.000Z`,
          },
        ],
      },
    };

    if (id === "7") {
      insightsPayload.group_rows = [
        { cdf: { column: "stay_date" }, modifier: "day" },
      ];
    }

    // Step 4: Make the final data request.
    const targetUrl =
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
      },
      body: JSON.stringify(insightsPayload),
    });

    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);

    res.status(200).json(data);
  } catch (error) {
    console.error("[server.js] Admin API Explorer Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Replace the old "/api/explore/sample-guest" endpoint with this one for Reservations.
// I have also updated the name to be more accurate.
app.get(
  "/api/explore/sample-reservation",
  requireAdminApi,
  async (req, res) => {
    console.log(
      "[server.js] Admin API Explorer: Fetching sample reservation..."
    );
    try {
      const accessToken = await getCloudbedsAccessToken();

      // This is the corrected URL and parameters from the documentation.
      const targetUrl = `https://api.cloudbeds.com/api/v1.1/getReservations?propertyIDs=${process.env.CLOUDBEDS_PROPERTY_ID}&pageSize=1&sortByRecent=true`;

      const cloudbedsApiResponse = await fetch(targetUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await cloudbedsApiResponse.json();
      if (!cloudbedsApiResponse.ok)
        throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);

      // Return just the first reservation from the list
      if (data.data && data.data.length > 0) {
        res.status(200).json(data.data[0]);
      } else {
        res
          .status(200)
          .json({ message: "No reservations found for this property." });
      }
    } catch (error) {
      console.error("[server.js] Admin API Explorer Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
// --- END: NEW API EXPLORER PROXY ---

app.get("/api/run-endpoint-tests", requireAdminApi, async (req, res) => {
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

// --- Static and fallback routes (Middleware order is corrected here) ---
const publicPath = path.join(process.cwd(), "public");

app.get("/", (req, res) => {
  res.redirect("/signin");
});

app.get("/signin", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

app.get("/app/", requirePageLogin, (req, res) => {
  res.sendFile(path.join(publicPath, "app", "index.html"));
});

app.get("/app/reports.html", requirePageLogin, (req, res) => {
  res.sendFile(path.join(publicPath, "app", "reports.html"));
});

app.get("/admin/", (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

app.use(express.static(publicPath));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
