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
const adminRoutes = require("./api/routes/admin.router.js"); // NEW: Import admin router
const publicPath = path.join(process.cwd(), "public");
const userRoutes = require("./api/routes/users.router.js"); // Add this line

// --- EXPRESS APP INITIALIZATION ---
const app = express();
app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", 1);

// --- MIDDLEWARE SETUP (CORS, Session) ---
const allowedOrigins = [
  "https://market-pulse.io",
  "https://www.market-pulse.io",
];
if (process.env.VERCEL_ENV !== "production") {
  allowedOrigins.push("http://localhost:3000");
}
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
// server.js

// --- NEW: EXPLICITLY DEFINE AND LOG COOKIE CONFIG ---
// server.js

const cookieConfig = {
  secure: process.env.VERCEL_ENV === "production",
  httpOnly: true,
  sameSite: process.env.VERCEL_ENV === "production" ? "none" : "lax",
  maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
  // --- FIX: Explicitly set the parent domain for the cookie ---
  // This ensures the cookie is sent for both market-pulse.io and www.market-pulse.io
  domain:
    process.env.VERCEL_ENV === "production" ? ".market-pulse.io" : undefined,
};

console.log(
  "[BREADCRUMB 3 - server.js] Using session cookie configuration:",
  cookieConfig
);
// --- END NEW BLOCK ---

// server.js

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
    // Use the new config object
    cookie: cookieConfig,
  })
);

// Serve static files from the "public" directory.
// This must come BEFORE any of the page-serving routes.
app.use(express.static(path.join(process.cwd(), "public")));

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
app.use("/api", reportsRoutes);
app.use("/api/admin", adminRoutes); // FIX: Use a specific path for the admin router
app.use("/api/users", userRoutes); // Add this line

// --- STATIC AND FALLBACK ROUTES ---

app.get("/", (req, res) => {
  if (req.session.userId) {
    res.redirect("/app/");
  } else {
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

app.get("/app/settings.html", requirePageLogin, (req, res) => {
  res.sendFile(path.join(publicPath, "app", "settings.html"));
});

app.get("/admin/", (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
