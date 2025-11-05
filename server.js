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

// Import all the router files.
const authRoutes = require("./api/routes/auth.router.js");
const dashboardRoutes = require("./api/routes/dashboard.router.js");
const reportsRoutes = require("./api/routes/reports.router.js");
const adminRoutes = require("./api/routes/admin.router.js");
// Point to the React build output directory
// The React app is in the /web folder and builds to /web/build
// This path is relative to the Vercel serverless function root (process.cwd())
const publicPath = path.join(process.cwd(), "web", "build");
const userRoutes = require("./api/routes/users.router.js");
const marketRouter = require("./api/routes/market.router.js");
const rockenueRoutes = require("./api/routes/rockenue.router.js");
const supportRoutes = require("./api/routes/support.router.js"); // [NEW] Import the support router
const budgetsRouter = require('./api/routes/budgets.router.js'); // [FIX] Corrected path relative to server.js
const portfolioRoutes = require("./api/routes/portfolio.router.js");

// [NEW] Import the planning router
const planningRoutes = require("./api/routes/planning.router.js");

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
    if (!origin || origin.startsWith('http://localhost')) {
      callback(null, true);
      return;
    }
    
    // 2. Allow any Vercel preview deployment
    if (origin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }

    // 3. Check if the origin starts with one of our allowed production domains
    // This handles cases like 'https://www.market-pulse.io'
    const isAllowedProduction = allowedOrigins.some(allowed => origin.startsWith(allowed));
    
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

// server.js

// server.js
// server.js

const cookieConfig = {
  secure: process.env.VERCEL_ENV === "production",
  httpOnly: true,
  sameSite: process.env.VERCEL_ENV === "production" ? "none" : "lax",
  maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
  domain:
    process.env.VERCEL_ENV === "production" ? ".market-pulse.io" : undefined,
  // --- NEW: Add a custom serializer function ---
  // This function manually builds the cookie string to ensure it is formatted correctly.
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

// server.js

app.use(
  session({
    // --- FIX: The name of the cookie is a top-level option ---
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
      // name is no longer here
      secure: process.env.VERCEL_ENV === "production",
      httpOnly: true,
      sameSite: process.env.VERCEL_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      domain:
        process.env.VERCEL_ENV === "production"
          ? ".market-pulse.io"
          : undefined,
      path: "/",
    },
  })
);

// /server.js
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
app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/admin", adminRoutes); // FIX: Use a specific path for the admin router
app.use("/api/users", userRoutes); // Add this line
app.use("/api/market", marketRouter);
app.use("/api/rockenue", rockenueRoutes);
app.use("/api/support", supportRoutes); // [NEW] Mount the support router
app.use('/api/budgets', budgetsRouter); // [NEW] Mount budgets router
app.use("/api/portfolio", portfolioRoutes);

// [NEW] Mount the planning router
app.use("/api/planning", planningRoutes);

// --- STATIC AND FALLBACK ROUTES ---
// This must come AFTER all API routes

// Fallback route for Single Page Application (SPA)
// This catches all non-API GET requests (like /, /app, /reports)
// and serves the React app's index.html. This is the fix for the
// "ENOENT: no such file or directory, stat '/var/task/index.html'" error.
app.get("*", (req, res) => {
  // We construct the path to the index.html inside our 'web/build' directory
  const indexPath = path.join(publicPath, "index.html");

  res.sendFile(indexPath, (err) => {
    if (err) {
      // If the file can't be sent (e.g., build failed, path is wrong)
      // log the error and send a 500 response.
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