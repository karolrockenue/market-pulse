/**
 * @file shreeji.router.js
 * @brief Shreeji portfolio dashboard endpoints.
 *
 * Mounted at: /api/shreeji
 *
 * Access model mirrors Mason (mason.router.js): admin/super_admin always pass,
 * otherwise the requesting user must have at least one Shreeji hotel linked in
 * user_properties (i.e. Sanchit + any future Shreeji-staff invitees).
 */

const express = require("express");
const router = express.Router();
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");
const shreejiService = require("../services/shreeji.service");

// ── access middleware ───────────────────────────────────────────────────────

/**
 * Returns the live list of Shreeji hotel_ids straight from the hotels table
 * (management_group ILIKE 'shreeji', not disconnected). Cached in-process
 * for 5 minutes — adding a new Shreeji property doesn't require a redeploy.
 */
let shreejiIdsCache = { ids: null, at: 0 };
async function getShreejiHotelIds() {
  if (shreejiIdsCache.ids && Date.now() - shreejiIdsCache.at < 5 * 60_000) {
    return shreejiIdsCache.ids;
  }
  const { rows } = await pgPool.query(
    `SELECT hotel_id FROM hotels
      WHERE management_group ILIKE 'shreeji'
        AND COALESCE(is_disconnected, false) = false`,
  );
  const ids = rows.map((r) => r.hotel_id);
  shreejiIdsCache = { ids, at: Date.now() };
  return ids;
}

async function requireShreejiAccess(req, res, next) {
  const role = req.session?.role;
  if (role === "admin" || role === "super_admin") return next();

  const cloudbedsId = req.user?.cloudbedsId || req.session?.userId;
  if (!cloudbedsId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const shreejiIds = await getShreejiHotelIds();
    if (shreejiIds.length === 0) {
      return res
        .status(503)
        .json({ error: "No Shreeji hotels configured in management_group" });
    }
    const { rows } = await pgPool.query(
      `SELECT 1 FROM user_properties
        WHERE user_id = $1 AND property_id = ANY($2::int[])
        LIMIT 1`,
      [String(cloudbedsId), shreejiIds],
    );
    if (rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No Shreeji properties linked to your account" });
    }
    next();
  } catch (err) {
    console.error("[Shreeji] requireShreejiAccess DB error:", err.message);
    res.status(500).json({ error: "Access check failed" });
  }
}

router.use(requireUserApi, requireShreejiAccess);

// ── dashboard cache ─────────────────────────────────────────────────────────

// In-memory TTL cache, keyed by monthKey. Cloudbeds Data Insights calls take
// ~30-60s for a 12-hotel month, so we hold results for 10 minutes between
// refreshes. The frontend's Refresh button calls with ?fresh=1 to bypass.
const CACHE_TTL_MS = 10 * 60 * 1000;
const dashCache = new Map();

function readCache(key) {
  const e = dashCache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    dashCache.delete(key);
    return null;
  }
  return e.payload;
}

function writeCache(key, payload) {
  dashCache.set(key, { at: Date.now(), payload });
}

// ── routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/shreeji/access
 *
 * Light-weight access probe. Returns the Shreeji hotels the user can see —
 * used by the frontend to decide whether to show the dashboard menu entry.
 */
router.get("/access", async (req, res) => {
  const role = req.session?.role;
  const isAdmin = role === "admin" || role === "super_admin";
  try {
    const hotels = await shreejiService.getShreejiHotels();
    if (isAdmin) {
      return res.json({ hasAccess: true, role, hotels });
    }
    const cloudbedsId = req.user?.cloudbedsId || req.session?.userId;
    const ids = hotels.map((h) => h.hotelId);
    const { rows } = await pgPool.query(
      `SELECT property_id FROM user_properties
        WHERE user_id = $1 AND property_id = ANY($2::int[])`,
      [String(cloudbedsId), ids],
    );
    const owned = new Set(rows.map((r) => r.property_id));
    res.json({
      hasAccess: true,
      role,
      hotels: hotels.filter((h) => owned.has(h.hotelId)),
    });
  } catch (err) {
    console.error("[Shreeji] /access failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/shreeji/dashboard?monthKey=YYYY-MM&fresh=1&financials=0
 *
 * Defaults:
 *   monthKey   = current month (UTC)
 *   fresh      = unset → use cache
 *   financials = 1 (include Cloudbeds takings + ancillary)
 *
 * Pass `financials=0` for the fast DB-only paint (returns perf + pace but
 * leaves every hotel's takings/ancillary as null). Useful for an initial
 * skeleton render before the slow API calls land.
 */
router.get("/dashboard", async (req, res) => {
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthKey = (req.query.monthKey || defaultMonth).toString();
  const fresh = req.query.fresh === "1" || req.query.fresh === "true";
  const includeFinancials =
    req.query.financials !== "0" && req.query.financials !== "false";

  const portfolioRaw = (req.query.portfolio || "all").toString().toLowerCase();
  const portfolio = ["all", "sp", "np"].includes(portfolioRaw) ? portfolioRaw : "all";

  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: "monthKey must be YYYY-MM" });
  }

  const cacheKey = `${monthKey}|fin=${includeFinancials ? 1 : 0}|p=${portfolio}`;
  if (!fresh) {
    const cached = readCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
  }

  try {
    const payload = await shreejiService.getDashboard(monthKey, {
      includeFinancials,
      portfolio,
    });
    // Only cache full-fat (financials included) responses. Skeleton responses
    // are cheap to regenerate; caching them would let a "no financials" entry
    // mask a later "with financials" request for the same month.
    if (includeFinancials) writeCache(cacheKey, payload);
    res.json({ ...payload, cached: false });
  } catch (err) {
    console.error("[Shreeji] /dashboard failed:", err);
    res.status(500).json({ error: err.message || "Dashboard build failed" });
  }
});

module.exports = router;
