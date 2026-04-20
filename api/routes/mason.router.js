/**
 * @file mason.router.js
 * @brief Reporting endpoints for the Mason & Fifth dashboard mockup.
 *
 * Mounted at: /api/mason
 *
 * Scoped to M&F hotels. Pulls per-service revenue on-demand from Mews —
 * no DB writes. Response is keyed by logical role (short/mid/long) so the
 * frontend is agnostic to per-hotel Mews service UUIDs.
 */

const express = require("express");
const router = express.Router();
const mewsAdapter = require("../adapters/mewsAdapter");
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// Mason & Fifth hotel IDs that grant access to this dashboard.
// Includes Belsize Park (318329) even though its service UUIDs aren't
// mapped yet — a Belsize-only user should still be able to open the page.
const MF_ACCESS_HOTEL_IDS = [318329, 318341, 318343];

/**
 * Grants access if the requesting user is admin/super_admin, OR has at least
 * one Mason & Fifth property linked in user_properties.
 */
async function requireMasonAccess(req, res, next) {
  const role = req.session?.role;
  if (role === "admin" || role === "super_admin") return next();

  // user_properties.user_id stores the cloudbeds_user_id (varchar), not the
  // internal integer users.user_id. Use cloudbedsId so invited users like
  // 'invited-mews-dph' actually match.
  const cloudbedsId = req.user?.cloudbedsId || req.session?.userId;
  if (!cloudbedsId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const { rows } = await pgPool.query(
      `SELECT 1 FROM user_properties
       WHERE user_id = $1 AND property_id = ANY($2::int[])
       LIMIT 1`,
      [String(cloudbedsId), MF_ACCESS_HOTEL_IDS],
    );
    if (rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No Mason & Fifth properties linked to your account" });
    }
    next();
  } catch (err) {
    console.error("[Mason] requireMasonAccess DB error:", err.message);
    res.status(500).json({ error: "Access check failed" });
  }
}

// Every Mason route requires a logged-in user with Mason access.
router.use(requireUserApi, requireMasonAccess);

// Per-hotel catalogue of Reservable services we care about.
// Mews assigns a unique UUID per hotel, even for identical logical services,
// so we map each hotel's Short/Mid/Long Stay IDs explicitly.
const MF_HOTELS = {
  318329: {
    name: "Mason & Fifth, Belsize Park",
    shortName: "Belsize Park",
    // Belsize only has a single "Accommodation" Reservable service in Mews,
    // not the Short/Mid/Long split used at the other properties. Mapped into
    // the "short" slot; mid/long are intentionally absent and render as £0.
    services: {
      short: "c6267c3b-144c-40e2-baf3-b3e00110df1b",
    },
  },
  318341: {
    name: "Mason & Fifth, Westbourne Park",
    shortName: "Westbourne Park",
    services: {
      short: "e810df20-baa7-4895-a964-b26b00b051b9",
      mid: "3990f059-4fd8-47b3-ad48-b37600b41a91",
      long: "72b82965-e525-4001-90d7-b26b00b26959",
    },
  },
  318343: {
    name: "Mason & Fifth, Primrose Hill",
    shortName: "Primrose Hill",
    services: {
      short: "b518b662-2504-4092-aa6a-b13400ade71e",
      mid: "b17bc567-1252-4532-8399-b37e00aad8fd",
      long: "270856f0-7b69-4425-a558-b14c0090c12d",
    },
  },
};

const ROLE_ORDER = ["short", "mid", "long"];

// In-memory TTL cache. Revenue numbers move slowly, so a 10-min TTL
// is plenty for a reporting dashboard and makes reloads feel instant.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function cacheKey(hotelId, from, to) {
  return `${hotelId}|${from}|${to}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

/**
 * GET /api/mason/access
 *
 * Returns the M&F hotels the requesting user can view data for.
 * Used by the frontend to decide whether to show the "Mason Dashboard"
 * entry in the property dropdown. Any response reaching this handler has
 * already passed requireMasonAccess, so the list is guaranteed non-empty
 * for non-admins, and full for admins.
 */
router.get("/access", async (req, res) => {
  const role = req.session?.role;
  const isAdmin = role === "admin" || role === "super_admin";

  // Admins can see every M&F hotel we've mapped services for.
  if (isAdmin) {
    return res.json({
      hasAccess: true,
      role,
      hotels: Object.entries(MF_HOTELS).map(([id, meta]) => ({
        hotelId: Number(id),
        name: meta.name,
        shortName: meta.shortName,
      })),
    });
  }

  // Non-admins: filter to M&F hotels they actually own.
  try {
    const cloudbedsId = req.user?.cloudbedsId || req.session?.userId;
    const { rows } = await pgPool.query(
      `SELECT property_id FROM user_properties
       WHERE user_id = $1 AND property_id = ANY($2::int[])`,
      [String(cloudbedsId), MF_ACCESS_HOTEL_IDS],
    );
    const ownedIds = new Set(rows.map((r) => r.property_id));
    const hotels = Object.entries(MF_HOTELS)
      .filter(([id]) => ownedIds.has(Number(id)))
      .map(([id, meta]) => ({
        hotelId: Number(id),
        name: meta.name,
        shortName: meta.shortName,
      }));
    res.json({ hasAccess: true, role, hotels });
  } catch (err) {
    console.error("[Mason] /access failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/hotels
 *
 * Lists the properties supported by the Mason Dashboard mockup.
 */
router.get("/hotels", (_req, res) => {
  res.json({
    hotels: Object.entries(MF_HOTELS).map(([id, meta]) => ({
      hotelId: Number(id),
      name: meta.name,
      shortName: meta.shortName,
    })),
  });
});

/**
 * GET /api/mason/service-revenue?hotelId=318341&from=2026-01-01&to=2026-05-31
 *
 * Returns combined + per-service gross/net revenue grouped by month,
 * keyed by role (short/mid/long) so the frontend never handles UUIDs.
 */
router.get("/service-revenue", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  const from = req.query.from;
  const to = req.query.to;

  const hotel = MF_HOTELS[hotelId];
  if (!hotel) {
    return res.status(400).json({
      error: `hotelId must be one of: ${Object.keys(MF_HOTELS).join(", ")}`,
    });
  }
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
  }

  try {
    const key = cacheKey(hotelId, from, to);
    const bypass = req.query.refresh === "1";
    const cached = bypass ? null : getCached(key);
    if (cached) {
      return res.json({ ...cached.payload, cachedAt: cached.storedAt });
    }

    // Only request the service IDs that are actually defined for this hotel
    // (Belsize has only `short`, for example).
    const serviceIds = ROLE_ORDER
      .map((r) => hotel.services[r])
      .filter(Boolean);
    const idToRole = Object.fromEntries(
      ROLE_ORDER.filter((r) => hotel.services[r]).map((r) => [hotel.services[r], r]),
    );

    const t0 = Date.now();
    const result = await mewsAdapter.getServiceRevenueByMonth(
      hotelId,
      from,
      to,
      serviceIds,
    );
    const elapsedMs = Date.now() - t0;

    // Pivot into a month-first shape keyed by role. Unmapped roles (e.g. Mid
    // & Long at Belsize) yield zero buckets so the frontend render stays
    // uniform across properties.
    const monthly = result.months.map((month) => {
      const row = { month, services: {}, totalGross: 0, totalNet: 0 };
      for (const role of ROLE_ORDER) {
        const sid = hotel.services[role];
        const bucket = sid
          ? result.byServiceMonth[sid]?.[month] || {
              gross: 0,
              net: 0,
              items: 0,
              nights: 0,
            }
          : { gross: 0, net: 0, items: 0, nights: 0 };
        row.services[role] = {
          name: sid
            ? result.services.find((s) => s.id === sid)?.name || role
            : `${role} (not configured)`,
          gross: bucket.gross,
          net: bucket.net,
          items: bucket.items,
          nights: bucket.nights,
        };
        row.totalGross += bucket.gross;
        row.totalNet += bucket.net;
      }
      return row;
    });

    const payload = {
      hotelId,
      hotelName: hotel.name,
      from,
      to,
      timezone: result.timezone,
      monthly,
      itemsScanned: result.itemsScanned,
      elapsedMs,
      roles: ROLE_ORDER,
      idToRole,
    };
    cache.set(key, { storedAt: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error("[Mason] service-revenue failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
