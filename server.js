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

// --- DEVELOPMENT ONLY LOGIN ---
if (process.env.VERCEL_ENV !== "production") {
  app.post("/api/dev-login", (req, res) => {
    const { userId, isAdmin = false } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "A userId is required." });
    }
    req.session.userId = userId;
    req.session.isAdmin = isAdmin;
    req.session.save((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to save session." });
      }
      res
        .status(200)
        .json({ message: `Session created for user ${userId}.`, isAdmin });
    });
  });
}

// --- API ROUTERS ---
// Mount all the dedicated routers to their respective paths.
app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", reportsRoutes);
app.use("/api", adminRoutes); // NEW: Use the admin router

// --- STATIC AND FALLBACK ROUTES ---
const publicPath = path.join(process.cwd(), "public");

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

app.get("/admin/", (req, res) => {
  res.sendFile(path.join(publicPath, "admin", "index.html"));
});

app.use(express.static(publicPath));

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
