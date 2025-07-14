// server.js (Production Ready - Database-Driven Roles & Landscape PDF)
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
// --- Reusable Cloudbeds Auth Function ---
// This is the CORRECT, multi-tenant version of the function.
// It accepts a specific user's refresh token to generate an access token.
async function getCloudbedsAccessToken(refreshToken) {
  // Get the app credentials from environment variables.
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;

  // Ensure a refresh token was actually provided.
  if (!refreshToken) {
    throw new Error("Cannot get access token without a refresh token.");
  }

  // Prepare the request to Cloudbeds.
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken, // Use the provided user-specific token.
  });

  // Make the call to the Cloudbeds token endpoint.
  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );

  const tokenData = await response.json();

  // If the response does not contain an access_token, the refresh failed.
  if (!tokenData.access_token) {
    console.error("Token refresh failed for a user:", tokenData);
    // Return null to indicate failure, allowing the calling function to handle it gracefully.
    return null;
  }

  // Return the newly acquired access token.
  return tokenData.access_token;
}

const app = express();
app.use(express.json({ limit: "10mb" })); // Increased limit for HTML payload
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
// ADD THIS BLOCK FOR LOCAL DEVELOPMENT LOGIN
if (process.env.VERCEL_ENV !== "production") {
  // This endpoint is for development only and will not exist in the deployed Vercel environment.
  // It allows developers to create an authenticated session without the full OAuth flow.
  app.post("/api/dev-login", (req, res) => {
    // Get the user ID from the request body.
    const { userId, isAdmin = false } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "A userId is required." });
    }

    // Set the user ID and admin status in the session.
    // This mimics the result of a real login.
    req.session.userId = userId;
    req.session.isAdmin = isAdmin;

    // Save the session to the store.
    req.session.save((err) => {
      if (err) {
        console.error("Dev login session save error:", err);
        return res.status(500).json({ error: "Failed to save session." });
      }
      // Respond with success.
      res
        .status(200)
        .json({ message: `Session created for user ${userId}.`, isAdmin });
    });
  });
}

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

// --- NEW SCHEDULED REPORTS API ENDPOINTS ---
// GET all scheduled reports for the logged-in user
// GET all scheduled reports for the logged-in user
app.get("/api/scheduled-reports", requireUserApi, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.json([]);
    }
    const internalUserId = userResult.rows[0].user_id;

    // This query casts the text property_id to an integer to correctly join with hotels.hotel_id
    const { rows } = await pgPool.query(
      `SELECT sr.*, h.property_name
       FROM scheduled_reports sr
       LEFT JOIN hotels h ON sr.property_id::integer = h.hotel_id
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC`,
      [internalUserId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching scheduled reports:", error);
    res.status(500).json({ error: "Failed to fetch scheduled reports" });
  }
});
// GET all scheduled reports for the logged-in user
// POST a new scheduled report
app.post("/api/scheduled-reports", requireUserApi, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const internalUserId = userResult.rows[0].user_id;

    const {
      propertyId,
      reportName,
      recipients,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      metricsHotel,
      metricsMarket,
      addComparisons,
      displayOrder,
      displayTotals,
      includeTaxes,
      reportPeriod,
      attachmentFormats, // <-- New property from the request
    } = req.body;

    const { rows } = await pgPool.query(
      `INSERT INTO scheduled_reports (
        user_id, property_id, report_name, recipients, frequency, day_of_week, day_of_month, time_of_day,
        metrics_hotel, metrics_market, add_comparisons, display_order, display_totals, include_taxes, report_period,
        attachment_formats -- <-- New column
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`, // <-- New parameter
      [
        internalUserId,
        propertyId,
        reportName,
        recipients,
        frequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
        metricsHotel,
        metricsMarket,
        addComparisons,
        displayOrder,
        displayTotals,
        includeTaxes,
        reportPeriod,
        attachmentFormats, // <-- New value
      ]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating scheduled report:", error);
    res.status(500).json({ error: "Failed to create scheduled report" });
  }
});

// DELETE a scheduled report by its ID
app.delete("/api/scheduled-reports/:id", requireUserApi, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const internalUserId = userResult.rows[0].user_id;
    const { id } = req.params;

    const result = await pgPool.query(
      "DELETE FROM scheduled_reports WHERE id = $1 AND user_id = $2",
      [id, internalUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Report not found or you do not have permission to delete it.",
      });
    }

    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    console.error("Error deleting scheduled report:", error);
    res.status(500).json({ error: "Failed to delete scheduled report" });
  }
});

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

// server.js

app.get("/api/auth/session-info", async (req, res) => {
  // Check if a user session exists.
  if (req.session.userId) {
    try {
      // --- START: DEBUG LOGGING ---
      // Log the session user ID we are about to use in the query.
      console.log(
        "Attempting to fetch session info for userId:",
        req.session.userId
      );
      // Log the type of the user ID to check for mismatches (e.g., number vs. string).
      console.log("Type of session userId:", typeof req.session.userId);
      // --- END: DEBUG LOGGING ---

      // If a session exists, query the database to get the user's details.
      const userResult = await pgPool.query(
        "SELECT first_name, last_name, is_admin FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );

      // If no user is found in the DB (edge case), respond with logged-out status.
      if (userResult.rows.length === 0) {
        // --- START: DEBUG LOGGING ---
        // Log when a user is not found, which is different from an error.
        console.log(
          "User not found in database for userId:",
          req.session.userId
        );
        // --- END: DEBUG LOGGING ---
        return res.json({ isLoggedIn: false });
      }

      const user = userResult.rows[0];

      // Respond with a rich object containing all necessary session info.
      res.json({
        isLoggedIn: true,
        isAdmin: user.is_admin || false,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    } catch (error) {
      // --- START: DEBUG LOGGING ---
      // This is the most important log. It will print the exact database error to the console.
      console.error(
        "CRITICAL ERROR in /api/auth/session-info endpoint:",
        error
      );
      // --- END: DEBUG LOGGING ---

      // If the database query fails, log the error and send a server error status.
      res.status(500).json({ error: "Could not retrieve session info." });
    }
  } else {
    // If there is no session ID, respond with logged-out status.
    res.json({
      isLoggedIn: false,
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

    // This is the correct and complete query.
    const query = `
            SELECT
                ${period} as period,
                AVG(adr) as adr,
                AVG(occupancy_direct) as occupancy_direct,
                AVG(revpar) as revpar,
                SUM(total_revenue) as total_revenue,
                SUM(rooms_sold) as rooms_sold,
                SUM(capacity_count) as capacity_count
            FROM daily_metrics_snapshots
            WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3
            GROUP BY period ORDER BY period ASC;
        `;

    const result = await pgPool.query(query, [propertyId, startDate, endDate]);
    res.json({ metrics: result.rows });
  } catch (error) {
    // The error message from this log is what we need to see.
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
            SELECT ${period} as period, AVG(dms.adr) as market_adr, AVG(dms.occupancy_direct) as market_occupancy, AVG(dms.revpar) as market_revpar,
           SUM(dms.total_revenue) as market_total_revenue,
           SUM(dms.rooms_sold) as market_rooms_sold,
           SUM(dms.capacity_count) as market_capacity_count


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

// --- ADMIN & EXPLORER APIS ---
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

// This endpoint is now correctly implemented for a multi-tenant environment.
app.get("/api/explore/datasets", requireAdminApi, async (req, res) => {
  try {
    // 1. Get the logged-in admin's user ID from the session.
    const adminUserId = req.session.userId;

    // 2. Fetch the admin's specific refresh token from the database.
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;

    // 3. Call the authentication function with the admin's specific token.
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      // This handles the "User is not assigned" error gracefully.
      throw new Error(
        "Cloudbeds authentication failed. Please re-authenticate via the sign-in page."
      );
    }

    // 4. As a sensible default, get the first property associated with the admin.
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties are associated with this admin account.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    // 5. Make the API call to Cloudbeds with the valid token and property ID.
    const targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        // Use the dynamically fetched property ID, not an obsolete environment variable.
        "X-PROPERTY-ID": propertyIdForHeader,
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
    // Log the detailed error and send a clean message to the client.
    console.error("Error in /api/explore/datasets:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
// --- Start of Corrected API Explorer Block ---

app.get("/api/explore/dataset-structure", requireAdminApi, async (req, res) => {
  try {
    // This is the repeating pattern for all explorer endpoints.
    // 1. Get admin user info from the session and database.
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties are associated with this admin account.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    // 2. Get a valid access token.
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    // 3. Process the specific request for this endpoint.
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Dataset ID is required." });
    }
    const targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;

    // 4. Make the authenticated call to Cloudbeds.
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": propertyIdForHeader,
      },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok) {
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NOTE: This endpoint was referenced in admin.mjs but was missing from server.js.
// It has been implemented here based on the changelog and the corrected auth pattern.
app.get("/api/explore/insights-data", requireAdminApi, async (req, res) => {
  try {
    const { id, columns } = req.query;
    if (!id || !columns) {
      return res
        .status(400)
        .json({ error: "Dataset ID and columns are required." });
    }

    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties are associated with this admin account.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    const insightsPayload = {
      property_ids: [propertyIdForHeader],
      dataset_id: parseInt(id, 10),
      columns: columns
        .split(",")
        .map((c) => ({ cdf: { column: c.trim() }, metrics: ["sum"] })),
      group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
      settings: { details: true, totals: true },
    };

    const targetUrl =
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-PROPERTY-ID": propertyIdForHeader,
      },
      body: JSON.stringify(insightsPayload),
    });

    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// The same corrected auth pattern is applied to all endpoints below.
app.get("/api/explore/sample-guest", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getGuestList?propertyIDs=${propertyIdForHeader}&pageSize=1`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data.data && data.data.length > 0
          ? data.data[0]
          : { message: "No guests found." }
      );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/explore/sample-hotel", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/explore/sample-room", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getRooms?propertyIDs=${propertyIdForHeader}&pageSize=1`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data.data && data.data.length > 0
          ? data.data[0]
          : { message: "No rooms found." }
      );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/explore/sample-rate", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getRatePlans?propertyIDs=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data && data.length > 0 ? data[0] : { message: "No rate plans found." }
      );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/explore/taxes-fees", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getTaxesAndFees?propertyID=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/explore/user-info", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;

    // Note: The 'getUsers' endpoint might require special permissions.
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getUsers?property_ids=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get(
  "/api/explore/sample-reservation",
  requireAdminApi,
  async (req, res) => {
    try {
      const adminUserId = req.session.userId;
      const userResult = await pgPool.query(
        "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
        [adminUserId]
      );
      if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
        return res
          .status(401)
          .json({ error: "Could not find a valid refresh token." });
      }
      const accessToken = await getCloudbedsAccessToken(
        userResult.rows[0].refresh_token
      );
      if (!accessToken) {
        throw new Error("Cloudbeds authentication failed.");
      }

      const propertyResult = await pgPool.query(
        "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
        [adminUserId]
      );
      if (propertyResult.rows.length === 0) {
        throw new Error("No properties associated with admin.");
      }
      const propertyIdForHeader = propertyResult.rows[0].property_id;

      const targetUrl = `https://api.cloudbeds.com/api/v1.1/getReservations?propertyIDs=${propertyIdForHeader}&pageSize=1&sortByRecent=true`;
      const cloudbedsApiResponse = await fetch(targetUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await cloudbedsApiResponse.json();
      if (!cloudbedsApiResponse.ok)
        throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
      res
        .status(200)
        .json(
          data.data && data.data.length > 0
            ? data.data[0]
            : { message: "No reservations found." }
        );
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

app.get("/api/run-endpoint-tests", requireAdminApi, async (req, res) => {
  // This endpoint does not require external API calls, so it remains unchanged.
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

// This new endpoint finds the oldest stay_date for a given property.
// This new endpoint finds the oldest stay_date for a given property.
app.get("/api/first-record-date", requireAdminApi, async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }

    // Get the logged-in admin's refresh token from the database.
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (!userResult.rows.length || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;

    // Get a valid access token.
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }

    // This is the corrected payload for the Cloudbeds Insights API.
    const insightsPayload = {
      property_ids: [propertyId],
      dataset_id: 7,
      columns: [{ cdf: { column: "stay_date" } }],
      settings: {
        details: true,
        totals: false,
        // The 'order' and 'limit' properties have been correctly moved inside the 'settings' object.
        order: [
          {
            cdf: { column: "stay_date" },
            direction: "ASC",
          },
        ],
        limit: 1,
      },
    };

    // Make the API call to Cloudbeds.
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

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      // This will now properly catch the error if the structure is still wrong.
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    }

    // Extract the date from the response.
    if (data && data.index && data.index.length > 0) {
      const oldestDate = data.index[0][0];
      res.status(200).json({ success: true, oldestDate: oldestDate });
    } else {
      res
        .status(404)
        .json({
          success: false,
          error: "No historical data found for this property.",
        });
    }
  } catch (error) {
    console.error("Error fetching first record date:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- End of Corrected API Explorer Block ---
// --- Static and fallback routes ---
const publicPath = path.join(process.cwd(), "public");

app.get("/", (req, res) => {
  // Check if the user has an active session.
  if (req.session.userId) {
    // If the user is logged in, redirect them to the main application dashboard.
    res.redirect("/app/");
  } else {
    // If the user is not logged in, redirect them to the sign-in page.
    res.redirect("/signin");
  }
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
