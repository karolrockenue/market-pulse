// server.js (Final Refactored Version)
// This file now only handles server setup, middleware, and routing.
// All application logic has been moved to dedicated router files.

// --- CORE DEPENDENCIES ---
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const path = require("path");

// --- SHARED UTILITIES AND ROUTERS ---
const pgPool = require("./api/utils/db");
const { requirePageLogin } = require("./api/utils/middleware");
// [NEW] Import the daily-refresh job handler
// [WITH THIS]

// [NEW] Import all cron job handlers
const dailyRefreshHandler = require("./api/daily-refresh.js");
const sendScheduledReportsHandler = require("./api/send-scheduled-reports.js");
const syncRockenueAssetsHandler = require("./api/sync-rockenue-assets.js");
// Import all the router files.
const authRoutes = require("./api/routes/auth.router.js");
const adminRoutes = require("./api/routes/admin.router.js");
// Point to the React build output directory
// The React app is in the /web folder and builds to /web/build
// This path is relative to the Vercel serverless function root (process.cwd())
const publicPath = path.join(process.cwd(), "web", "build");
const userRoutes = require("./api/routes/users.router.js");
const supportRoutes = require("./api/routes/support.router.js");
const sentinelRoutes = require("./api/routes/sentinel.router.js"); // Sentinel module
const webhooksRoutes = require("./api/routes/webhooks.router.js"); // Webhooks module
const bridgeRoutes = require("./api/routes/bridge.router.js"); // Sentinel AI Bridge

// --- NEW DOMAIN ROUTERS (SESSION 1) ---
const metricsRoutes = require("./api/routes/metrics.router.js"); // Unified Metrics Engine
const hotelsRoutes = require("./api/routes/hotels.router.js"); // Unified Hotel/Config Engine
const marketRoutes = require("./api/routes/market.router.js"); // Unified Market/Planning Engine
// --- EXPRESS APP INITIALIZATION ---

// --- EXPRESS APP INITIALIZATION ---
const app = express();
app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", 1);

// --- STATIC ASSET SERVING ---
// Serve all static assets (JS, CSS, images) from the React build directory.
// This MUST come BEFORE any CORS or session middleware, as static files
// don't need authentication and should be served immediately.
app.use(express.static(publicPath));

// --- MIDDLEWARE SETUP (CORS, Session) ---
const allowedOrigins = [
  "https://market-pulse.io",
  "https://www.market-pulse.io",
];
if (process.env.VERCEL_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000");
}

// This is the new, more robust block to add
const corsOptions = {
  origin: function (origin, callback) {
    // 1. Allow local dev, Postman, mobile apps (no origin)
    if (!origin || origin.startsWith("http://localhost")) {
      callback(null, true);
      return;
    }

    // 2. Allow any Vercel preview deployment
    if (origin.endsWith(".vercel.app")) {
      callback(null, true);
      return;
    }

    // 3. Check if the origin starts with one of our allowed production domains
    // This handles cases like 'https://www.market-pulse.io'
    const isAllowedProduction = allowedOrigins.some((allowed) =>
      origin.startsWith(allowed)
    );

    if (isAllowedProduction) {
      callback(null, true);
      return;
    }

    // 4. If none of the above, reject it.
    console.error(`CORS Error: Origin ${origin} not allowed.`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));
// server.js

// --- NEW: EXPLICITLY DEFINE AND LOG COOKIE CONFIG ---
// server.js
// --- NEW: EXPLICITLY DEFINE AND LOG COOKIE CONFIG ---
const cookieConfig = {
  secure: process.env.VERCEL_ENV === "production",
  httpOnly: true,
  // [MODIFIED] Use 'lax' to ensure cookie survives the OAuth redirect
  sameSite: "lax",
  maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
  // [MODIFIED] Set to undefined so the cookie works on ANY domain (production OR Vercel preview)
  domain: undefined,

  // --- NEW: Add a custom serializer function ---
  serialize: (name, val) => {
    const parts = [`${name}=${val}`];
    parts.push(`Max-Age=${Math.floor(cookieConfig.maxAge / 1000)}`);
    parts.push(`Path=/`);
    if (cookieConfig.domain) {
      parts.push(`Domain=${cookieConfig.domain}`);
    }
    if (cookieConfig.sameSite) {
      parts.push(`SameSite=${cookieConfig.sameSite}`);
    }
    if (cookieConfig.secure) {
      parts.push(`Secure`);
    }
    if (cookieConfig.httpOnly) {
      parts.push(`HttpOnly`);
    }
    return parts.join("; ");
  },
};

// This log will run once when the server starts.
console.log(
  "[BREADCRUMB 0 - server.js] Using session cookie configuration:",
  cookieConfig
);

app.use(
  session({
    name: "connect.sid",
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
      // [MODIFIED] Match the config above
      sameSite: "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      // [MODIFIED] Set to undefined so the cookie works on ANY domain
      domain: undefined,
      path: "/",
    },
  })
);

// --- [NEW] SECURE CRON JOB ENDPOINT ---
app.get("/api/cron/daily-refresh", (req, res) => {
  // Check for the secret key in the query parameters
  const { secret } = req.query;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    console.warn(
      "CRON JOB FAILED: Unauthorized attempt at /api/cron/daily-refresh"
    );
    return res.status(401).json({ error: "Unauthorized" });
  }

  // If secret is valid, run the handler.
  // We pass the 'req' and 'res' objects directly to it.
  // [WITH THIS]

  console.log("CRON JOB ACCEPTED: Running daily-refresh...");
  return dailyRefreshHandler(req, res);
});

// [NEW] SECURE CRON JOB ENDPOINT FOR SCHEDULED REPORTS
app.get("/api/send-scheduled-reports", (req, res) => {
  // NOTE: This job runs every 5 mins and does not need a secret.
  // It checks the DB for its own schedule.
  console.log("CRON JOB ACCEPTED: Running send-scheduled-reports...");
  return sendScheduledReportsHandler(req, res);
});

// [NEW] SECURE CRON JOB ENDPOINT FOR ROCKENUE ASSETS
app.get("/api/sync-rockenue-assets", (req, res) => {
  // NOTE: This job also does not need a secret as it's not parameterized.
  console.log("CRON JOB ACCEPTED: Running sync-rockenue-assets...");
  return syncRockenueAssetsHandler(req, res);
});

// --- DEVELOPMENT ONLY LOGIN ---
if (process.env.VERCEL_ENV !== "production") {
  app.post("/api/dev-login", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "An email is required." });
    }

    try {
      // --- FIX: Look up the user's ID and their role from the database ---
      const userResult = await pgPool.query(
        "SELECT cloudbeds_user_id, role FROM users WHERE email = $1",
        [email]
      );

      if (userResult.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "User with that email not found in the database." });
      }

      const user = userResult.rows[0];

      // --- FIX: Create the session using the new role system ---
      req.session.userId = user.cloudbeds_user_id;
      req.session.role = user.role; // Set the role from the database

      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ error: "Failed to save session." });
        }
        res.status(200).json({
          message: `Session created for user ${user.cloudbeds_user_id}.`,
          role: user.role, // Return the role in the response
        });
      });
    } catch (error) {
      console.error("Error during dev-login:", error);
      res.status(500).json({ error: "An internal server error occurred." });
    }
  });
}

// --- API ROUTERS ---
// Mount all the dedicated routers to their respective paths.

// 1. Core System Routers
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/support", supportRoutes);

// 2. Domain Engines (New Architecture)
app.use("/api/metrics", metricsRoutes); // KPI, Dashboard, Reports, Portfolio
app.use("/api/hotels", hotelsRoutes); // Config, Budgets, Assets, CompSets
app.use("/api/market", marketRoutes); // Trends, Pace, Scraper, Shadowfax

// 3. Operational Engines
app.use("/api/sentinel", sentinelRoutes); // AI Pricing
app.use("/api/webhooks", webhooksRoutes); // PMS Events
app.use("/api/bridge", bridgeRoutes); // Python AI Bridge
// --- STATIC AND FALLBACK ROUTES ---
// This must come AFTER all API routes

// Fallback route for Single Page Application (SPA)
// This catches all non-API GET requests (like /, /app, /reports)
// and serves the React app's index.html.
app.get("*", (req, res) => {
  // [FIX] Prevent "Soft 404" for missing assets.
  // If the request is looking for a file (e.g., .js, .css) but reached here,
  // it means express.static didn't find it. We must return 404, not HTML.
  if (
    req.path.match(
      /\.(js|css|png|jpg|jpeg|gif|ico|json|map|woff|woff2|ttf|svg)$/
    )
  ) {
    return res.status(404).send("Asset not found");
  }

  // Otherwise, it's a navigation request -> serve index.html
  const indexPath = path.join(publicPath, "index.html");

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error sending index.html:", err);
      res.status(500).send("Error serving the application.");
    }
  });
});

// --- SERVER START ---
// --- STATIC AND FALLBACK ROUTES ---
// This must come AFTER all API routes

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
