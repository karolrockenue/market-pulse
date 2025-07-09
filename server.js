// server.js (Production Ready - with API Explorer Fix)
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
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

const requireApiLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requirePageLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/signin");
  }
  next();
};

// --- AUTHENTICATION ROUTES ---
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
      "SELECT cloudbeds_user_id FROM users WHERE user_id = $1",
      [internalUserId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).send("Could not find a matching user account.");
    }
    req.session.userId = userResult.rows[0].cloudbeds_user_id;
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

app.post("/api/admin-login", (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res
      .status(500)
      .json({ error: "Admin password not configured on server." });
  }
  if (password === adminPassword) {
    req.session.userId = "admin";
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Failed to save session." });
      }
      res.status(200).json({ success: true });
    });
  } else {
    res.status(401).json({ error: "Invalid password." });
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
  res.redirect(
    `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`
  );
});

app.get("/api/auth/cloudbeds/callback", async (req, res) => {
  const { code } = req.query;
  if (!code)
    return res.status(400).send("Error: No authorization code provided.");
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

    await pgPool.query(
      `INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, access_token, refresh_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       ON CONFLICT (cloudbeds_user_id) DO UPDATE SET
       email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
       access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, status = 'active';`,
      [
        userInfo.user_id,
        userInfo.email,
        userInfo.first_name,
        userInfo.last_name,
        access_token,
        refresh_token,
      ]
    );

    const properties = Array.isArray(propertyInfo)
      ? propertyInfo
      : [propertyInfo];
    if (!properties || properties.length === 0 || !properties[0])
      throw new Error("No properties found for this user account.");

    for (const property of properties) {
      if (property && property.id) {
        await pgPool.query(
          `INSERT INTO hotels (hotel_id, property_name, city, star_rating) VALUES ($1, $2, $3, 2) ON CONFLICT (hotel_id) DO NOTHING;`,
          [property.id, property.name, property.city]
        );
        await pgPool.query(
          `INSERT INTO user_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT (user_id, property_id) DO NOTHING;`,
          [userInfo.user_id, property.id]
        );
      }
    }

    req.session.userId = userInfo.user_id;
    req.session.save((err) => {
      if (err)
        return res
          .status(500)
          .send("An error occurred during authentication session save.");
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
app.get("/api/get-hotel-name", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/last-refresh-time", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

const getPeriod = (granularity) => {
  if (granularity === "monthly") return "date_trunc('month', stay_date)";
  if (granularity === "weekly") return "date_trunc('week', stay_date)";
  return "stay_date";
};

app.get("/api/kpi-summary", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/metrics-from-db", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/competitor-metrics", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/my-properties", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/test-cloudbeds", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/test-database", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/get-all-hotels", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

app.get("/api/run-endpoint-tests", requireApiLogin, async (req, res) => {
  // ... existing code, no changes needed
});

// --- CORRECTED API DISCOVERY PROXY ---

// In-memory cache for the API discovery context
let apiDiscoveryContextCache = {
  token: null,
  propertyId: null,
  expiresAt: null,
};

// Helper function to get a valid token and property ID, using a cache
const getApiContextWithCache = async () => {
  const now = new Date();
  // If cache is still valid (e.g., within 4 minutes), return it.
  if (
    apiDiscoveryContextCache.token &&
    apiDiscoveryContextCache.expiresAt > now
  ) {
    return {
      accessToken: apiDiscoveryContextCache.token,
      propertyId: apiDiscoveryContextCache.propertyId,
    };
  }

  // If cache is invalid, fetch a new context
  const userResult = await pgPool.query(
    "SELECT cloudbeds_user_id, refresh_token FROM users WHERE status = 'active' AND refresh_token IS NOT NULL LIMIT 1"
  );
  if (userResult.rows.length === 0) {
    throw new Error(
      "No active user with a refresh token found for API discovery."
    );
  }
  const { cloudbeds_user_id, refresh_token } = userResult.rows[0];

  const propertyResult = await pgPool.query(
    "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
    [cloudbeds_user_id]
  );
  if (propertyResult.rows.length === 0) {
    throw new Error(
      "No property associated with the user found for API discovery."
    );
  }
  const propertyId = propertyResult.rows[0].property_id;

  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refresh_token,
  });

  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error("Could not refresh access token for API discovery.");
  }

  // Store the new context in the cache with a 4-minute expiry
  apiDiscoveryContextCache = {
    token: tokenData.access_token,
    propertyId: propertyId,
    expiresAt: new Date(now.getTime() + 4 * 60 * 1000),
  };

  return { accessToken: tokenData.access_token, propertyId: propertyId };
};

// All discovery routes now use the cached helper
app.get("/api/get-all-datasets", requireApiLogin, async (req, res) => {
  try {
    const { accessToken, propertyId } = await getApiContextWithCache();
    const apiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/datasets",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-PROPERTY-ID": propertyId,
        },
      }
    );
    const data = await apiResponse.json();
    if (!apiResponse.ok)
      throw new Error(data.message || "Failed to fetch datasets.");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/datasets/:id/multi-levels", requireApiLogin, async (req, res) => {
  try {
    const { accessToken, propertyId } = await getApiContextWithCache();
    const apiResponse = await fetch(
      `https://api.cloudbeds.com/datainsights/v1.1/datasets/${req.params.id}/multi-levels`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-PROPERTY-ID": propertyId,
        },
      }
    );
    const data = await apiResponse.json();
    // It's okay for this to return an error if a dataset has no multi-levels, so we check for specific error messages.
    if (
      !apiResponse.ok &&
      data.message !== "No multi-levels per dataset found."
    ) {
      throw new Error(data.message || "Failed to fetch multi-levels.");
    }
    // If no multi-levels, return an empty array to the frontend.
    res
      .status(200)
      .json(data.message === "No multi-levels per dataset found." ? [] : data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/datasets/:id/fields", requireApiLogin, async (req, res) => {
  try {
    const { accessToken, propertyId } = await getApiContextWithCache();
    const mlId = req.query.ml_id;
    const url = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${
      req.params.id
    }/fields${mlId ? `?ml_id=${mlId}` : ""}`;
    const apiResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": propertyId,
      },
    });
    const data = await apiResponse.json();
    if (!apiResponse.ok)
      throw new Error(data.message || "Failed to fetch fields.");
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

app.get("/admin/", requirePageLogin, (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

app.use(express.static(publicPath));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
