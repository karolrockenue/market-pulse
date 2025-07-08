// server.js (Final Corrected Version)
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

// --- NEW AUTHENTICATION MIDDLEWARE ---

// Middleware for API routes: returns a JSON 401 error if not logged in.
const requireApiLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Middleware for pages: redirects to /login if not logged in.
const requirePageLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
};

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
    const {
      CLOUDBEDS_CLIENT_ID,
      CLOUDBEDS_CLIENT_SECRET,
      CLOUDBEDS_PROPERTY_ID,
    } = process.env;
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
          "X-PROPERTY-ID": CLOUDBEDS_PROPERTY_ID,
        },
      }
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
        const insertQuery = `INSERT INTO user_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT (user_id, property_id) DO NOTHING;`;
        await pgPool.query(insertQuery, [userInfo.user_id, property.id]);
      }
    }
    req.session.userId = userInfo.user_id;
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

// Apply the requireApiLogin middleware to all API endpoints
app.get("/api/get-hotel-name", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/last-refresh-time", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/kpi-summary", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/metrics-from-db", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/competitor-metrics", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/my-properties", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/test-cloudbeds", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/test-database", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/get-all-hotels", requireApiLogin, async (req, res) => {
  /* ... */
});
app.get("/api/run-endpoint-tests", requireApiLogin, async (req, res) => {
  /* ... */
});
if (process.env.VERCEL_ENV !== "production") {
  app.get("/api/daily-refresh", requireApiLogin, dailyRefreshHandler);
  app.get("/api/initial-sync", requireApiLogin, initialSyncHandler);
}

// --- Static and fallback routes ---
const publicPath = path.join(process.cwd(), "public");

// Apply the requirePageLogin middleware to protected pages
app.get("/app/", requirePageLogin, (req, res) => {
  res.sendFile(path.join(publicPath, "app", "index.html"));
});

app.get("/admin/", requirePageLogin, (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

// Serve static assets AFTER protected page routes
app.use(express.static(publicPath));

// Public routes
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
