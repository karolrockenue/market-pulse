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

// Per-hotel mapping from Mews AccountingCategoryId → logical role
// (short/mid/long). Mason flagged on 2026-04-29 that both his finance team
// and his Sales Flash classify revenue by **Accounting Category**, not by
// the booking-time Service. At Westbourne especially, very long Short-Stay
// reservations get reposted into the Long Stay accounting category; if we
// grouped by Service the Long Stay row would understate by ~£20k/month and
// Short Stay would overstate by the same amount. Grouping by Accounting
// Category mirrors what Mason sees in the Mews "Order Items Report" UI.
//
// AccCatIds were captured 2026-04-29 by enumerating distinct
// AccountingCategoryIds in each property's orderItems for May–Aug 2026.
// Names are cross-referenced from the user's Mews exports (the API token
// in this integration lacks `accountingCategories/getAll` permission).
//
// Categories not present in the role map are intentionally excluded from
// the dashboard total — that's the Mason rule: ignore everything outside
// Short/Mid/Long Accommodation Income, with the Westbourne exception that
// Canal – Breakfast Inclusive Rate folds into Short Stay.
const MF_HOTELS = {
  318329: {
    name: "Mason & Fifth, Belsize Park",
    shortName: "Belsize Park",
    // Belsize is a new property and currently posts everything to a single
    // Accommodation Income category. Mid/Long render as £0 until Mews adds
    // those categories — at which point we extend this map. The £151
    // category `fd51d09b...` is a tiny ancillary line we exclude.
    accountingCategories: {
      short: ["d30087d1-9400-4550-9838-b3e900b73224"],
    },
  },
  318341: {
    name: "Mason & Fifth, Westbourne Park",
    shortName: "Westbourne Park",
    // Short / Mid / Long map directly to Mews's "Accommodation Income"
    // AccCats with no folds. Canal – Breakfast Inclusive Rate previously
    // folded into Short (per Mason 2026-04-29) but was unfolded 2026-04-30
    // so the dashboard's Short line ties to Mews's "Accommodation Income -
    // Short Stay" line in the Order Items Report exactly. Verified against
    // Sep 2025, Dec 2025, Feb 2026, Mar 2026, May 2026 reports — all
    // tie to the penny on Short/Mid/Long.
    //
    // Intentionally excluded from any role: Canal Breakfast, all Canal F&B
    // (Food/Wine/Liquor/Beer/NA/Packages), Cleaning Fee, Security Deposits,
    // Management, Other Revenue, Retail, Service Charge, Gratuity. These
    // are non-accommodation revenue lines in Mews and don't roll into the
    // Mason Dashboard total.
    accountingCategories: {
      short: ["69d71bed-2cf8-4abe-b7df-b26b00b80ae0"], // Accommodation Income – Short Stay
      mid: ["09f3c399-8ca0-4418-93bb-b2e400f31f27"], // Accommodation Income – Mid Stay
      long: ["58dcdf67-55af-44b0-a847-b26b00b7ed18"], // Accommodation Income – Long Stay
    },
  },
  318343: {
    name: "Mason & Fifth, Primrose Hill",
    shortName: "Primrose Hill",
    accountingCategories: {
      short: ["92fa995e-8e72-40cf-9be8-b14b014a2e40"], // Accommodation Income – Short Stay
      mid: ["ed8aec0c-5399-4bde-957a-b38000bb48fe"],   // Accommodation Income – Mid Stay
      long: ["0885a203-9008-4254-a8d6-b39500c0fe2a"],  // Accommodation Income – Long Stay
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

    // Flatten the per-role AccCatId allowlist into a single set passed to
    // the adapter. Items in any other category (Cleaning Fee, Security
    // Deposits, Stay adjustment, Management, Retail, etc.) are excluded.
    const allowedAccCatIds = ROLE_ORDER
      .flatMap((r) => hotel.accountingCategories[r] || []);
    const accCatIdToRole = {};
    for (const role of ROLE_ORDER) {
      for (const id of hotel.accountingCategories[role] || []) {
        accCatIdToRole[id] = role;
      }
    }

    const t0 = Date.now();
    const result = await mewsAdapter.getRevenueByAccountingCategoryByMonth(
      hotelId,
      from,
      to,
      allowedAccCatIds,
    );
    const elapsedMs = Date.now() - t0;

    // Pivot into a month-first shape keyed by role. Multiple AccCatIds may
    // map to the same role (e.g. at Westbourne `short` is the union of
    // Accommodation Income – Short Stay + Canal Breakfast). Roles with no
    // configured categories at this property (e.g. Mid/Long at Belsize)
    // render as £0 so the frontend render stays uniform across properties.
    const monthly = result.months.map((month) => {
      const row = { month, services: {}, totalGross: 0, totalNet: 0 };
      for (const role of ROLE_ORDER) {
        const accCatIds = hotel.accountingCategories[role] || [];
        let gross = 0, net = 0, items = 0, nights = 0;
        for (const accCatId of accCatIds) {
          const bucket = result.byAccountingCategoryMonth[accCatId]?.[month];
          if (!bucket) continue;
          gross += bucket.gross;
          net += bucket.net;
          items += bucket.items;
          nights += bucket.nights;
        }
        row.services[role] = {
          name: accCatIds.length ? role : `${role} (not configured)`,
          gross,
          net,
          items,
          nights,
        };
        row.totalGross += gross;
        row.totalNet += net;
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
      accCatIdToRole,
      groupedBy: "accountingCategory",
    };
    cache.set(key, { storedAt: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error("[Mason] service-revenue failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
