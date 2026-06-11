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
const masonService = require("../services/mason.service");
const { buildSalesFlashPdfData } = require("../services/masonPdf.service");
const { generatePdfFromHtml } = require("../utils/pdf.utils");
const { buildSalesFlashXlsx } = require("../utils/masonXlsx");

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
// Per-hotel Mews service IDs. Used for service-based reservation
// classification (Sales Flash SS / MS / LS bookings panels). Discovered
// 2026-05-11 via reservations/getAll/2023-06-06 backfill — see
// scripts/backfill-mf-reservations-service-id.js. Source of truth for the
// reservations table's mews_service_id column.
const MF_SERVICE_IDS = {
  318329: {
    short: ["c6267c3b-144c-40e2-baf3-b3e00110df1b"],
  },
  318341: {
    // Mews migrated Long Stay onto a nightly service ~2026-05-20 (Dom's PDF:
    // "moving Long Stay into a nightly Service"). The old monthly service was
    // renamed "Long Stay Accommodation DO NOT USE" and long stays are draining
    // onto "LongStay Accommodation NEW". Roles are now the UNION of every
    // service of that stay-type so the migration is invisible on reports — a
    // long stay stays "long" whether it sits on the legacy, NEW or canonical
    // service. Re-verify with services/getAll if counts look off.
    // (Old/wrong mapping: long=72b82965, mid=3990f059 — 3990f059 is actually
    //  "LongStay Accommodation NEW", NOT Mid.)
    short: ["e810df20-baa7-4895-a964-b26b00b051b9"], // Short Stay Accommodation
    mid:   ["4d036740-d62c-41d8-bcb6-b2e400f348b3"], // Mid Stay Accommodation (currently unused → Mid ≈ 0)
    long: [
      "c65e3632-af72-4b7a-8f64-b26b00b23336", // Long Stay Accommodation (canonical, currently empty)
      "3990f059-4fd8-47b3-ad48-b37600b41a91", // LongStay Accommodation NEW (nightly, filling up)
      "72b82965-e525-4001-90d7-b26b00b26959", // Long Stay Accommodation DO NOT USE (legacy, draining)
    ],
    // Excluded: Management (38bdc698), Accommodation (c0ddfe17), Stay
    // (3e203f4e), TEST SINGLE SERVICE (094bdcd1), ARCHIVE Mid (e20b19b7).
  },
  318343: {
    short: ["b518b662-2504-4092-aa6a-b13400ade71e"],
    mid:   ["b17bc567-1252-4532-8399-b37e00aad8fd"],
    long:  ["270856f0-7b69-4425-a558-b14c0090c12d"],
  },
};

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
    serviceIds: MF_SERVICE_IDS[318329],
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
    serviceIds: MF_SERVICE_IDS[318341],
  },
  318343: {
    name: "Mason & Fifth, Primrose Hill",
    shortName: "Primrose Hill",
    accountingCategories: {
      short: ["92fa995e-8e72-40cf-9be8-b14b014a2e40"], // Accommodation Income – Short Stay
      mid: ["ed8aec0c-5399-4bde-957a-b38000bb48fe"],   // Accommodation Income – Mid Stay
      long: ["0885a203-9008-4254-a8d6-b39500c0fe2a"],  // Accommodation Income – Long Stay
    },
    serviceIds: MF_SERVICE_IDS[318343],
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

    // Actual occupied room-nights per service per month (date-derived) — the
    // ADR denominator used by the dashboard/sales-flash cards. Falls back to
    // SpaceOrder item count when serviceIds aren't mapped.
    const rnMap = hotel.serviceIds
      ? await masonService.getRoomNightsByMonthRole(hotelId, from.slice(0, 7), to.slice(0, 7), hotel.serviceIds)
      : null;

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
          // Actual occupied room-nights (date-derived) — preferred ADR
          // denominator; `nights` (SpaceOrder count) kept for back-compat.
          roomNights: rnMap ? (rnMap.get(month)?.[role] ?? 0) : nights,
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

// Sales Flash + Pacing Flash hotels. Belsize (318329) added 2026-05-20 per
// Dom's request now that it has opened — note it is Short-Stay-only (no Mid/
// Long services or AccCats yet) and has NO prior-year history, so Mid/Long
// lines render £0 and all Prior-Year / STLY columns stay blank by design.
const FLASH_HOTEL_IDS = new Set([318341, 318343, 318329]);

function pad2(n) { return String(n).padStart(2, "0"); }

function thisMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function shiftMonth(mk, delta) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * GET /api/mason/pacing?hotelId=318341&monthsBack=2&monthsForward=11
 *
 * Returns the 13-month grid for the Pacing Flash. STLY + LPR fields are null
 * (deferred). Forecast = OTB for forward months, simple split for current.
 */
router.get("/pacing", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({
      error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}`,
    });
  }
  const hotel = MF_HOTELS[hotelId];
  if (!hotel) return res.status(400).json({ error: "Hotel not configured" });

  const monthsBack = Math.max(0, parseInt(req.query.monthsBack || "2", 10));
  const monthsForward = Math.max(1, parseInt(req.query.monthsForward || "11", 10));
  const startKey = shiftMonth(thisMonthKey(), -monthsBack);
  const endKey = shiftMonth(thisMonthKey(), monthsForward);

  try {
    const otb = await masonService.getMonthlyKpis(
      hotelId,
      startKey,
      endKey,
      hotel.accountingCategories,
      hotel.serviceIds,
    );

    const lyMap = await masonService.getFinalLyKpis(
      hotelId,
      masonService.shiftYear(startKey, -1),
      masonService.shiftYear(endKey, -1),
    );

    const dailyOcc = await masonService.getDailyOccRows(hotelId, startKey, endKey);
    const today = masonService.todayIso();

    const grid = otb.months.map((row) => {
      const mk = row.monthKey;
      const monthStart = `${mk}-01`;
      const monthEnd = masonService.endOfMonth(mk);
      const monthDailyOcc = dailyOcc.filter(
        (r) => r.stay_date >= monthStart && r.stay_date <= monthEnd,
      );
      const finalLy = lyMap.get(masonService.shiftYear(mk, -1)) || null;
      const forecast = masonService.computeForecast(mk, row, monthDailyOcc, today);
      return {
        monthKey: mk,
        currentOTB: row,
        forecast,
        finalLY: finalLy,
        sameTimeLY: null, // deferred
        lastPacingReport: null, // deferred
      };
    });

    res.json({
      hotelId,
      hotelName: hotel.name,
      shortName: hotel.shortName,
      windowStart: startKey,
      windowEnd: endKey,
      asOf: today,
      grid,
      stlyAvailable: false,
      lprAvailable: false,
      notes: {
        stly: "Same-Time-LY reconstruction deferred to a separate workstream.",
        lpr: "Last Pacing Report needs weekly snapshots; renders blank until pacing_snapshots accrues.",
        forecast: "v1: realized + remaining-window pickup at realized ADR for current month; future months show booked OTB.",
      },
    });
  } catch (err) {
    console.error("[Mason] /pacing failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/occupancy-by-service?hotelId=318341&days=120
 *
 * Daily occupancy split by service (Long/Mid/Short + Other residual) for the
 * Sales Flash stacked occupancy chart. See mason.service.getDailyOccupancyByService.
 */
router.get("/occupancy-by-service", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({
      error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}`,
    });
  }
  const hotel = MF_HOTELS[hotelId];
  if (!hotel) return res.status(400).json({ error: "Hotel not configured" });
  const days = Math.min(540, Math.max(7, parseInt(req.query.days || "120", 10)));
  // Anchor on the 1st of the reporting month so the chart follows the picker +
  // shows the whole month (even past today). Falls back to today.
  const mk = /^\d{4}-\d{2}$/.test(req.query.monthKey || "") ? req.query.monthKey : null;
  const startDate = mk ? `${mk}-01` : null;
  try {
    const rows = await masonService.getDailyOccupancyByService(
      hotelId,
      hotel.serviceIds,
      days,
      startDate,
    );
    res.json({ hotelId, shortName: hotel.shortName, days, startDate, rows });
  } catch (err) {
    console.error("[Mason] /occupancy-by-service failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/booking-pulse?hotelId=318341&weeksBack=8
 */
router.get("/booking-pulse", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({
      error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}`,
    });
  }
  const weeksBack = Math.min(52, Math.max(1, parseInt(req.query.weeksBack || "8", 10)));
  try {
    const pulse = await masonService.getBookingPulse(hotelId, weeksBack);
    res.json({ hotelId, ...pulse });
  } catch (err) {
    console.error("[Mason] /booking-pulse failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/recent-activity?hotelId=318341
 *
 * Recent Bookings (last 7 days, sales ledger) restricted to Short-Stay
 * reservations (rate_segment='short'). Powers the Mason main dashboard's
 * Recent Bookings widget. Same row shape as /api/metrics/summary.recentActivity
 * so the shared RecentBookings component renders it unchanged.
 */
router.get("/recent-activity", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({
      error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}`,
    });
  }
  try {
    const rows = await masonService.getRecentActivity(hotelId);
    const recentActivity = rows.map((row) => ({
      date: row.date,
      dateStr: row.dateStr,
      bookings: parseInt(row.bookings || 0, 10),
      roomNights: parseInt(row.roomNights || 0, 10),
      revenue: parseFloat(row.revenue || 0),
      adr: parseFloat(row.adr || 0),
      isToday: row.isToday,
    }));
    res.json({ hotelId, recentActivity });
  } catch (err) {
    console.error("[Mason] /recent-activity failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/cards?hotelId=318341&monthKey=YYYY-MM
 *
 * Lightweight 3-month KPI cards (prior / reporting / next of the dropdown
 * month), from getMonthlyKpis over just that window so the top of the Sales
 * Flash loads fast and follows the month picker — decoupled from the heavy
 * /sales-flash assembly (which made the cards wait ~17s + risked rate limits).
 * Cached 10 min. Reporting-month card ties to the /sales-flash KPI rows.
 */
router.get("/cards", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({ error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}` });
  }
  const hotel = MF_HOTELS[hotelId];
  if (!hotel) return res.status(400).json({ error: "Hotel not configured" });
  const monthKey = req.query.monthKey || shiftMonth(thisMonthKey(), -1);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: "monthKey must be YYYY-MM" });
  }
  try {
    const key = cacheKey(hotelId, "cards", monthKey);
    const cached = req.query.refresh === "1" ? null : getCached(key);
    if (cached) return res.json({ ...cached.payload, cachedAt: cached.storedAt });

    const priorMK = shiftMonth(monthKey, -1);
    const nextMK = shiftMonth(monthKey, 1);
    const otb = await masonService.getMonthlyKpis(
      hotelId, priorMK, nextMK, hotel.accountingCategories, hotel.serviceIds,
    );
    const byMonth = new Map(otb.months.map((m) => [m.monthKey, m]));
    const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const cardTitle = (mk) => { const [y, m] = mk.split("-").map(Number); return `${MONTH_ABBR[m - 1]} ${y}`; };
    // The real-life current month (whichever of the 3 cards it lands on) gets
    // a live month-to-date occupancy figure — investor ask, rendered in gold.
    const currentMK = thisMonthKey();
    const mtdOccupancy = [priorMK, monthKey, nextMK].includes(currentMK)
      ? await masonService.getMtdOccupancy(hotelId, currentMK)
      : null;
    const cards = [
      { mk: priorMK, label: "prior month" },
      { mk: monthKey, label: "reporting month" },
      { mk: nextMK, label: "next · on the books" },
    ].map(({ mk, label }) => {
      const r = byMonth.get(mk);
      const cap = r?.total.capacity || 0;
      const occShare = (role) => (cap > 0 ? ((r?.byRole[role].nights ?? 0) / cap) * 100 : 0);
      return {
        title: cardTitle(mk),
        label,
        revenueBy: {
          short: r?.byRole.short.revenue ?? 0,
          mid: r?.byRole.mid.revenue ?? 0,
          long: r?.byRole.long.revenue ?? 0,
        },
        occupancy: r?.total.occupancy ?? 0,
        adr: r?.total.adr ?? 0,
        adrByService: {
          short: r?.byRole.short.adr ?? 0,
          mid: r?.byRole.mid.adr ?? 0,
          long: r?.byRole.long.adr ?? 0,
        },
        occByService: {
          short: occShare("short"),
          mid: occShare("mid"),
          long: occShare("long"),
        },
        isCurrentMonth: mk === currentMK,
        mtdOccupancy: mk === currentMK ? mtdOccupancy : null,
      };
    });
    const payload = { hotelId, monthKey, cards };
    cache.set(key, { storedAt: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error("[Mason] /cards failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/sales-flash?hotelId=318341&monthKey=YYYY-MM
 *
 * One-shot endpoint that assembles every block on the Sales Flash:
 * Current Month Summary, Annualised vs Budget, BOB & Business Done,
 * Pacing Report by service, Weekly Unit Pacing, SS Weekly + LS New Deals.
 *
 * Excludes ancillary blocks (Canal/Meadow/Grounding) — out of v1 scope.
 */
router.get("/sales-flash", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({
      error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}`,
    });
  }
  const hotel = MF_HOTELS[hotelId];
  if (!hotel) return res.status(400).json({ error: "Hotel not configured" });

  const monthKeyParam = req.query.monthKey || shiftMonth(thisMonthKey(), -1);
  if (!/^\d{4}-\d{2}$/.test(monthKeyParam)) {
    return res.status(400).json({ error: "monthKey must be YYYY-MM" });
  }

  // 10-min cache (this endpoint fires ~14-20 Mews calls; reloads otherwise 429).
  const cacheK = cacheKey(hotelId, "sales-flash", monthKeyParam);
  if (req.query.refresh !== "1") {
    const cached = getCached(cacheK);
    if (cached) return res.json({ ...cached.payload, cachedAt: cached.storedAt });
  }

  try {
    const currentMK = monthKeyParam;
    const priorMonthMK = shiftMonth(currentMK, -1);
    const priorYearMK = masonService.shiftYear(currentMK, -1);
    // Mason's fiscal year = Apr → Mar. For a reporting month in Jan/Feb/Mar,
    // FY started the previous April; for Apr+ months it starts that April.
    const [yearStr, monthStr] = currentMK.split("-");
    const reportYear = parseInt(yearStr, 10);
    const reportMonth = parseInt(monthStr, 10);
    const fyStartYear = reportMonth >= 4 ? reportYear : reportYear - 1;
    const fyStartMK = `${fyStartYear}-04`;
    const fyEndMK = `${fyStartYear + 1}-03`;

    // 1. KPIs across the FY window (Apr → Mar) plus priorMonth if it falls
    // before FY start. Future months return OTB (book-on-the-books for
    // forward stays) so the Annualised grid + Forward BOB populate. Single
    // Mews fetch covers all sections.
    const otbStart = priorMonthMK < fyStartMK ? priorMonthMK : fyStartMK;
    const otbEnd = fyEndMK;
    const otb = await masonService.getMonthlyKpis(
      hotelId,
      otbStart,
      otbEnd,
      hotel.accountingCategories,
      hotel.serviceIds,
    );
    const otbByMonth = new Map(otb.months.map((m) => [m.monthKey, m]));

    // 2. Final LY for the FY (used in Annualised grid + prior-year column)
    const lyMap = await masonService.getFinalLyKpis(
      hotelId,
      masonService.shiftYear(fyStartMK, -1),
      masonService.shiftYear(fyEndMK, -1),
    );

    // 3. Per-service budgets for FY
    const budgets = await masonService.getServiceBudgets(hotelId, fyStartYear);
    const hasBudgetData = Object.values(budgets).some((b) => b.hasData);

    // 4. Direct vs Indirect — current + prior month
    const [directShare, directSharePM] = await Promise.all([
      masonService.getDirectShareForMonth(hotelId, currentMK),
      masonService.getDirectShareForMonth(hotelId, priorMonthMK),
    ]);

    // 5. In-house at month-end across FY (12 months)
    const inHouseFY = await masonService.getInHouseAtMonthEnd(
      hotelId,
      fyStartMK,
      fyEndMK,
    );

    // 6. Lead-time tiers + SS weekly bookings (last 8 weeks)
    const tiers = await masonService.getLeadTimeTiers(hotelId, 8, hotel.serviceIds);

    // 7. Weekly unit pacing — next 5 weeks anchored on this Monday
    const today = new Date();
    const dow = today.getUTCDay() || 7;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - (dow - 1));
    monday.setUTCHours(0, 0, 0, 0);
    const weekStarts = [];
    for (let i = 0; i < 5; i++) {
      const w = new Date(monday);
      w.setUTCDate(monday.getUTCDate() + i * 7);
      weekStarts.push(w.toISOString().slice(0, 10));
    }
    const unitPacing = await masonService.getWeeklyUnitPacing(hotelId, weekStarts);
    // Full-month summary column for the selected reporting month (Dom's
    // request) — same breakdown averaged across the whole month.
    const unitPacingMonth = await masonService.getMonthlyUnitPacing(hotelId, currentMK);

    // ─── Current Month Summary block ───────────────────────────────
    const cur = otbByMonth.get(currentMK);
    const pm = otbByMonth.get(priorMonthMK);
    const py = lyMap.get(priorYearMK) || null;
    // Prior-year revenue split by service (Mason monthly-summary basis). null
    // when unavailable (Belsize / pre-history) → segment PY renders "—".
    const pySeg = await masonService.getSegmentRevenueActuals(hotelId, priorYearMK);
    // Prior-year KPI actuals + SS Direct/Indirect, hardcoded from Dom's file
    // (V3 decision). Authoritative for the PY columns; falls back to the
    // snapshot LY (`py`) for blended occ/ADR/RevPAR when the file lacks a
    // month/hotel, and leaves per-segment / source PY blank when absent.
    const pyKpi = await masonService.getKpiHistory(hotelId, priorYearMK);
    // Budget extras loaded from Dom's budget workbook (LS ADR + Direct/Indirect %
    // budget) — keyed by the CURRENT reporting month. WB/Primrose only; null for
    // Belsize (short-stay-only). See scripts/load-mf-budget-extras.js.
    const budgetKpi = await masonService.getKpiHistory(hotelId, currentMK);
    const budgetCur = budgets[currentMK];

    // Average Length of Stay (days) per service — reservations staying in the
    // month, current vs prior month vs prior year. Full-contract nights.
    const [alosCur, alosPM, alosPY] = await Promise.all([
      masonService.getAlosByService(hotelId, currentMK, hotel.serviceIds),
      masonService.getAlosByService(hotelId, priorMonthMK, hotel.serviceIds),
      masonService.getAlosByService(hotelId, priorYearMK, hotel.serviceIds),
    ]);
    const alos = {
      short: { actual: alosCur.short, priorMonth: alosPM.short, priorYear: alosPY.short },
      mid: { actual: alosCur.mid, priorMonth: alosPM.mid, priorYear: alosPY.mid },
      long: { actual: alosCur.long, priorMonth: alosPM.long, priorYear: alosPY.long },
    };

    // Lead Time (days from booking-create to check-in) per service — same
    // staying-in-month cohort as ALOS so the two tables read consistently.
    // Dom's V2 request. Sits directly below the ALOS table.
    const [ltCur, ltPM, ltPY] = await Promise.all([
      masonService.getLeadTimeByService(hotelId, currentMK, hotel.serviceIds),
      masonService.getLeadTimeByService(hotelId, priorMonthMK, hotel.serviceIds),
      masonService.getLeadTimeByService(hotelId, priorYearMK, hotel.serviceIds),
    ]);
    const leadTime = {
      short: { actual: ltCur.short, priorMonth: ltPM.short, priorYear: ltPY.short },
      mid: { actual: ltCur.mid, priorMonth: ltPM.mid, priorYear: ltPY.mid },
      long: { actual: ltCur.long, priorMonth: ltPM.long, priorYear: ltPY.long },
    };

    // Rate-by-studio-category + AMR-by-segment charts (current month). Anchor
    // the chart "All" bars to the KPI card ADRs. The card ADR is now the
    // per-booking consumed-in-month basis (getMonthlyKpis), so feed that ADR
    // through as the anchor ratio (net = adr × nights) rather than the AccCat
    // revenue line — otherwise the chart "All" bar drifts off the card again.
    const anchorFor = (b) => ({
      net: (b?.adr ?? 0) * (b?.nights ?? 0),
      nights: b?.nights ?? 0,
    });
    const rateCharts = await masonService.getRateBreakdowns(hotelId, currentMK, hotel.serviceIds, {
      short: anchorFor(cur?.byRole?.short),
      long: anchorFor(cur?.byRole?.long),
    });

    // Budget KPI derivations for the current month. Budget revenue is loaded;
    // budget room-nights + occupancy were added 2026-05-20 so we can derive
    // budgeted Occupancy / ADR / RevPAR. null when nights aren't loaded (e.g.
    // Belsize) so the UI renders "—".
    const bNights = budgetCur?.nights || { short: 0, mid: 0, long: 0 };
    const bRevShort = budgetCur?.short || 0;
    const bRevMid = budgetCur?.mid || 0;
    const bRevLong = budgetCur?.long || 0;
    const bTotRev = bRevShort + bRevMid + bRevLong;
    const bTotNights = (bNights.short || 0) + (bNights.mid || 0) + (bNights.long || 0);
    const curCapacity = cur?.total.capacity || 0; // rooms × days in month
    const hasBN = !!budgetCur?.hasNights;
    const budgetOccPct = hasBN && curCapacity > 0 ? (bTotNights / curCapacity) * 100 : null;
    const budgetAdrBlended = hasBN && bTotNights > 0 ? bTotRev / bTotNights : null;
    const budgetRevpar = budgetCur?.hasData && curCapacity > 0 ? bTotRev / curCapacity : null;
    const budgetAdrShort = hasBN && bNights.short > 0 ? bRevShort / bNights.short : null;
    const budgetAdrMid = hasBN && bNights.mid > 0 ? bRevMid / bNights.mid : null;

    const summary = {
      monthKey: currentMK,
      revenue: {
        short: {
          actual: cur?.byRole.short.revenue ?? 0,
          priorMonth: pm?.byRole.short.revenue ?? null,
          priorYear: pySeg ? pySeg.short : null, // Mason monthly-summary basis
          budget: hasBudgetData ? (budgetCur?.short ?? null) : null,
        },
        mid: {
          actual: cur?.byRole.mid.revenue ?? 0,
          priorMonth: pm?.byRole.mid.revenue ?? null,
          priorYear: pySeg ? pySeg.mid : null,
          budget: hasBudgetData ? (budgetCur?.mid ?? null) : null,
        },
        long: {
          actual: cur?.byRole.long.revenue ?? 0,
          priorMonth: pm?.byRole.long.revenue ?? null,
          priorYear: pySeg ? pySeg.long : null,
          budget: hasBudgetData ? (budgetCur?.long ?? null) : null,
        },
        totalAccom: {
          actual: cur?.total.revenue ?? 0,
          priorMonth: pm?.total.revenue ?? null,
          // Use the segment-summed PY total when available so the table foots;
          // else fall back to the property-wide snapshot total.
          priorYear: pySeg ? pySeg.total : (py ? py.revenue : null),
          budget: hasBudgetData
            ? ((budgetCur?.short || 0) + (budgetCur?.mid || 0) + (budgetCur?.long || 0))
            : null,
        },
      },
      kpis: {
        occupancy: {
          actual: cur?.total.occupancy ?? null,
          priorMonth: pm?.total.occupancy ?? null,
          priorYear: pyKpi?.occupancy ?? (py ? py.occupancy : null),
          budget: budgetOccPct,
        },
        adrBlended: {
          actual: cur?.total.adr ?? null,
          priorMonth: pm?.total.adr ?? null,
          priorYear: pyKpi?.adr_blended ?? (py ? py.adr : null),
          budget: budgetAdrBlended,
        },
        revpar: {
          actual: cur?.total.revpar ?? null,
          priorMonth: pm?.total.revpar ?? null,
          priorYear: pyKpi?.revpar_blended ?? (py ? py.revpar : null),
          budget: budgetRevpar,
        },
        adrShort: {
          actual: cur?.byRole.short.adr ?? null,
          priorMonth: pm?.byRole.short.adr ?? null,
          priorYear: pyKpi?.ss_adr ?? null, // hardcoded from Dom's file
          budget: budgetAdrShort,
        },
        adrMid: {
          actual: cur?.byRole.mid.adr ?? null,
          priorMonth: pm?.byRole.mid.adr ?? null,
          priorYear: pyKpi?.ms_adr ?? null,
          budget: budgetAdrMid,
        },
        // Long Stay ADR — now a true nightly ADR (net ÷ actual occupied
        // room-nights), since LS migrated to a nightly Mews service. Field name
        // kept as `amrLong` for back-compat; UI labels it "LS ADR".
        amrLong: {
          actual: cur?.byRole.long.adr ?? null,
          priorMonth: pm?.byRole.long.adr ?? null,
          priorYear: pyKpi?.ls_adr ?? null,
          budget: budgetKpi?.ls_adr_budget ?? null,
        },
        // Direct vs Indirect, Short Stays only (Dom V3). Prior-year hardcoded
        // from Dom's file (SS Direct/Indirect Booking %).
        direct: {
          actual: directShare ? directShare.directPct : null,
          priorMonth: directSharePM ? directSharePM.directPct : null,
          priorYear: pyKpi?.ss_direct_pct ?? null,
          budget: budgetKpi?.ss_direct_pct_budget ?? null,
        },
        indirect: {
          actual: directShare ? directShare.indirectPct : null,
          priorMonth: directSharePM ? directSharePM.indirectPct : null,
          priorYear: pyKpi?.ss_indirect_pct ?? null,
          budget: budgetKpi?.ss_indirect_pct_budget ?? null,
        },
      },
    };

    // ─── Annualised vs Budget grid (FY 12 months, Apr → Mar) ─────────
    const annualised = [];
    for (let i = 0; i < 12; i++) {
      const monthN = ((3 + i) % 12) + 1;            // 4,5,...,12,1,2,3
      const yearN = i < 9 ? fyStartYear : fyStartYear + 1;
      const mk = `${yearN}-${pad2(monthN)}`;
      const mRow = otbByMonth.get(mk);
      const bRow = budgets[mk];
      annualised.push({
        monthKey: mk,
        revenue: {
          short: mRow?.byRole.short.revenue ?? 0,
          mid: mRow?.byRole.mid.revenue ?? 0,
          long: mRow?.byRole.long.revenue ?? 0,
          total: mRow?.total.revenue ?? 0,
        },
        budget: hasBudgetData
          ? {
              short: bRow.short || 0,
              mid: bRow.mid || 0,
              long: bRow.long || 0,
              total: (bRow.short || 0) + (bRow.mid || 0) + (bRow.long || 0),
            }
          : null,
        occupancy: mRow?.total.occupancy ?? null,
      });
    }

    // ─── Pacing Report by service (FY 12 months) ──────────────────
    const pacing = ROLE_ORDER.map((role) => {
      return {
        role,
        months: annualised.map((a) => ({
          monthKey: a.monthKey,
          actualRevenue: a.revenue[role],
          actualNights: otbByMonth.get(a.monthKey)?.byRole[role].nights ?? 0,
          actualAdr: otbByMonth.get(a.monthKey)?.byRole[role].adr ?? null,
          budgetRevenue: hasBudgetData ? a.budget[role] : null,
        })),
      };
    });

    // ─── BOB & Business Done ──────────────────────────────────────
    // FY-to-date "Business Done" = sum of consumed revenue per service
    // for FY months that have already elapsed.
    const todayIsoStr = masonService.todayIso();
    const bob = { short: 0, mid: 0, long: 0, total: 0 };
    const businessDone = { short: 0, mid: 0, long: 0, total: 0 };
    // FYTD occupancy = capacity-weighted occupancy across wholly-elapsed FY
    // months (room-nights ÷ capacity), so it doesn't get diluted by forward OTB.
    let fytdNights = 0;
    let fytdCapacity = 0;
    for (const a of annualised) {
      if (`${a.monthKey}-31` < todayIsoStr) {
        // wholly past
        businessDone.short += a.revenue.short;
        businessDone.mid += a.revenue.mid;
        businessDone.long += a.revenue.long;
        businessDone.total += a.revenue.total;
        const mRow = otbByMonth.get(a.monthKey);
        fytdNights += mRow?.total.roomNights ?? 0;
        fytdCapacity += mRow?.total.capacity ?? 0;
      } else {
        bob.short += a.revenue.short;
        bob.mid += a.revenue.mid;
        bob.long += a.revenue.long;
        bob.total += a.revenue.total;
      }
    }
    const fytdOccupancy = fytdCapacity > 0 ? (fytdNights / fytdCapacity) * 100 : null;

    const payload = {
      hotelId,
      hotelName: hotel.name,
      shortName: hotel.shortName,
      monthKey: currentMK,
      asOf: todayIsoStr,
      hasBudgetData,
      summary,
      alos,
      leadTime,
      rateCharts,
      annualised,
      pacing,
      bob,
      businessDone,
      fytdOccupancy,
      inHouseFY,
      unitPacing,
      unitPacingMonth,
      ssWeekly: tiers.ssWeekly,
      msWeekly: tiers.msWeekly,
      lsWeekly: tiers.lsWeekly,
      allWeekly: tiers.allWeekly,
      lsTierWeekly: tiers.lsTierWeekly,
      notes: {
        ancillaries: "Canal / Meadow / Grounding revenue is out of v1 scope (mostly sourced outside Mews).",
        budgets: hasBudgetData
          ? null
          : "Per-service budgets not yet uploaded; Budget columns hidden.",
        longStayAdr: "Per-service ADR = revenue ÷ actual occupied room-nights (from reservation dates). Long Stay now shows a true nightly ADR following its migration to a nightly Mews service.",
      },
    };
    cache.set(cacheK, { storedAt: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error("[Mason] /sales-flash failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/mason/sales-flash/pdf?hotelId=&monthKey=YYYY-MM
 * Landscape-A4 PDF of the Sales Flash (light theme, M&F branded), rendered
 * server-side via Playwright from the same data the dashboard uses
 * (api/services/masonPdf.service.js → mason-sales-flash.template.html).
 */
router.get("/sales-flash/pdf", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  const hotel = MF_HOTELS[hotelId];
  if (!FLASH_HOTEL_IDS.has(hotelId) || !hotel) {
    return res.status(400).json({ error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}` });
  }
  const monthKey = req.query.monthKey || shiftMonth(thisMonthKey(), -1);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: "monthKey must be YYYY-MM" });
  }
  try {
    const data = await buildSalesFlashPdfData(hotelId, monthKey, hotel);
    const pdf = await generatePdfFromHtml("mason-sales-flash.template.html", data, {
      format: "A4", landscape: true, printBackground: true, scale: 1,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Sales-Flash-${hotel.shortName.replace(/\s+/g, "-")}-${monthKey}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("[Mason] /sales-flash/pdf failed:", err.message);
    res.status(500).json({ error: "PDF generation failed" });
  }
});

/**
 * GET /api/mason/sales-flash/xlsx?hotelId=&monthKey=YYYY-MM
 * Excel workbook of the Sales Flash (same data as the PDF), built with ExcelJS.
 */
router.get("/sales-flash/xlsx", async (req, res) => {
  const hotelId = parseInt(req.query.hotelId, 10);
  const hotel = MF_HOTELS[hotelId];
  if (!FLASH_HOTEL_IDS.has(hotelId) || !hotel) {
    return res.status(400).json({ error: `hotelId must be one of: ${[...FLASH_HOTEL_IDS].join(", ")}` });
  }
  const monthKey = req.query.monthKey || shiftMonth(thisMonthKey(), -1);
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return res.status(400).json({ error: "monthKey must be YYYY-MM" });
  }
  try {
    const data = await buildSalesFlashPdfData(hotelId, monthKey, hotel);
    const xlsx = await buildSalesFlashXlsx(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Sales-Flash-${hotel.shortName.replace(/\s+/g, "-")}-${monthKey}.xlsx"`);
    res.send(Buffer.from(xlsx));
  } catch (err) {
    console.error("[Mason] /sales-flash/xlsx failed:", err.message);
    res.status(500).json({ error: "Excel generation failed" });
  }
});

/**
 * GET /api/mason/budgets/:hotelId?year=2026
 * POST /api/mason/budgets/:hotelId — admin-only upload
 *   body: { year, rows: [{ month, service_role, budget_revenue_net }, ...] }
 */
router.get("/budgets/:hotelId", async (req, res) => {
  const hotelId = parseInt(req.params.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({ error: "Hotel not in flash scope" });
  }
  const year = parseInt(req.query.year || new Date().getUTCFullYear(), 10);
  try {
    const budgets = await masonService.getServiceBudgets(hotelId, year);
    res.json({ hotelId, year, budgets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/budgets/:hotelId", async (req, res) => {
  const role = req.session?.role;
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  const hotelId = parseInt(req.params.hotelId, 10);
  if (!FLASH_HOTEL_IDS.has(hotelId)) {
    return res.status(400).json({ error: "Hotel not in flash scope" });
  }
  const { year, rows } = req.body || {};
  if (!year || !Array.isArray(rows)) {
    return res.status(400).json({ error: "Body: { year, rows: [...] }" });
  }
  const userId = req.session?.userId;
  try {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      for (const r of rows) {
        const month = parseInt(r.month, 10);
        const role = (r.service_role || "").toLowerCase();
        const amt = Number(r.budget_revenue_net);
        if (!month || month < 1 || month > 12) continue;
        if (!["short", "mid", "long"].includes(role)) continue;
        if (!Number.isFinite(amt) || amt < 0) continue;
        await client.query(
          `INSERT INTO hotel_service_budgets
            (hotel_id, year, month, service_role, budget_revenue_net,
             budget_room_nights, budget_occupancy_pct, notes, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (hotel_id, year, month, service_role)
           DO UPDATE SET
             budget_revenue_net = EXCLUDED.budget_revenue_net,
             budget_room_nights = EXCLUDED.budget_room_nights,
             budget_occupancy_pct = EXCLUDED.budget_occupancy_pct,
             notes = EXCLUDED.notes,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
          [
            hotelId,
            year,
            month,
            role,
            amt,
            r.budget_room_nights ? parseInt(r.budget_room_nights, 10) : null,
            r.budget_occupancy_pct ? Number(r.budget_occupancy_pct) : null,
            r.notes || null,
            userId || null,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true, written: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
