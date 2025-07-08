// -----------------------------------------------------------------------------
// server.js – Market Pulse (production‑ready)
// -----------------------------------------------------------------------------
// This version unifies the session cookie domain, hardens security headers, and
// stabilises the PostgreSQL connection pool so Cloudbeds OAuth works the same in
// localhost and on Vercel.
// -----------------------------------------------------------------------------

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const path = require("path");

// -----------------------------------------------------------------------------
// 1 · PostgreSQL connection pool (Neon / Supabase‑style SSL)
// -----------------------------------------------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  max: 5, // Neon free tier → max 10; keep some head‑room
  idleTimeoutMillis: 30_000, // close idle conns after 30 s (avoids Vercel cold‑start drops)
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("❌  PG idle client error", err);
});

// -----------------------------------------------------------------------------
// 2 · Express app + global middleware
// -----------------------------------------------------------------------------
const app = express();

app.set("trust proxy", 1); // behind Vercel’s edge proxy – required for Secure cookies

app.use(
  cors({
    origin: ["https://www.market-pulse.io", "https://market-pulse.io"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// -----------------------------------------------------------------------------
// 3 · Session handling – one cookie to rule them all
// -----------------------------------------------------------------------------
app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "session",
      pruneSessionInterval: false, // prune manually via cron – avoids idle disconnects
    }),
    name: "connect.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      domain: ".market-pulse.io", // 🔑 force *root* domain for every sub‑domain
      httpOnly: true,
      secure: true,
      sameSite: "lax", // OK for OAuth once redirect completes
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// -----------------------------------------------------------------------------
// 4 · Routes
// -----------------------------------------------------------------------------
// Health‑check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", at: new Date() })
);

// OAuth routes (example: ./routes/oauth.js should export a router)
try {
  const authRouter = require("./routes/oauth");
  app.use("/api/auth", authRouter);
} catch (err) {
  console.warn("⚠️  OAuth router not found – add routes/oauth.js");
}

// Protected example route – Requires a session
app.get("/api/user", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Not authenticated" });
  res.json({ user: req.session.user });
});

// -----------------------------------------------------------------------------
// 5 · Serve SPA (React/Vite build) in production
// -----------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  const staticDir = path.join(__dirname, "public");
  app.use(express.static(staticDir));

  app.get("*", (_, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// -----------------------------------------------------------------------------
// 6 · Local dev server
// -----------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () =>
    console.log(`🚀  Server listening at http://localhost:${PORT}`)
  );
}

module.exports = app;
