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
    short: ["e810df20-baa7-4895-a964-b26b00b051b9"],
    mid:   ["3990f059-4fd8-47b3-ad48-b37600b41a91"],
    long:  ["72b82965-e525-4001-90d7-b26b00b26959"],
    // Excluded: Management (38bdc698) and ancillaries (e20b19b7, 094bdcd1).
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

// Sales Flash + Pacing Flash are scoped to hotels with a full role map.
// Belsize is excluded from v1 — opens mid-May 2026, no LY data.
const FLASH_HOTEL_IDS = new Set([318341, 318343]);

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

    // ─── Current Month Summary block ───────────────────────────────
    const cur = otbByMonth.get(currentMK);
    const pm = otbByMonth.get(priorMonthMK);
    const py = lyMap.get(priorYearMK) || null;
    const budgetCur = budgets[currentMK];

    const summary = {
      monthKey: currentMK,
      revenue: {
        short: {
          actual: cur?.byRole.short.revenue ?? 0,
          priorMonth: pm?.byRole.short.revenue ?? null,
          priorYear: null, // no per-service LY scope from snapshots
          budget: hasBudgetData ? (budgetCur?.short ?? null) : null,
        },
        mid: {
          actual: cur?.byRole.mid.revenue ?? 0,
          priorMonth: pm?.byRole.mid.revenue ?? null,
          priorYear: null,
          budget: hasBudgetData ? (budgetCur?.mid ?? null) : null,
        },
        long: {
          actual: cur?.byRole.long.revenue ?? 0,
          priorMonth: pm?.byRole.long.revenue ?? null,
          priorYear: null,
          budget: hasBudgetData ? (budgetCur?.long ?? null) : null,
        },
        totalAccom: {
          actual: cur?.total.revenue ?? 0,
          priorMonth: pm?.total.revenue ?? null,
          priorYear: py ? py.revenue : null,
          budget: hasBudgetData
            ? ((budgetCur?.short || 0) + (budgetCur?.mid || 0) + (budgetCur?.long || 0))
            : null,
        },
      },
      kpis: {
        occupancy: {
          actual: cur?.total.occupancy ?? null,
          priorMonth: pm?.total.occupancy ?? null,
          priorYear: py ? py.occupancy : null,
        },
        adrBlended: {
          actual: cur?.total.adr ?? null,
          priorMonth: pm?.total.adr ?? null,
          priorYear: py ? py.adr : null,
        },
        revpar: {
          actual: cur?.total.revpar ?? null,
          priorMonth: pm?.total.revpar ?? null,
          priorYear: py ? py.revpar : null,
        },
        adrShort: {
          actual: cur?.byRole.short.adr ?? null,
          priorMonth: pm?.byRole.short.adr ?? null,
          priorYear: null, // no per-service LY scope from snapshots
        },
        adrMid: {
          actual: cur?.byRole.mid.adr ?? null,
          priorMonth: pm?.byRole.mid.adr ?? null,
          priorYear: null,
        },
        // Long Stay ADR renamed to "Avg Monthly Charge" in the UI per §15.1.
        amrLong: {
          actual: cur?.byRole.long.adr ?? null,
          priorMonth: pm?.byRole.long.adr ?? null,
          priorYear: null,
        },
        directShareNet: {
          actual: directShare ? directShare.directPct : null,
          priorMonth: directSharePM ? directSharePM.directPct : null,
          priorYear: null,
        },
        indirectShareNet: {
          actual: directShare ? directShare.indirectPct : null,
          priorMonth: directSharePM ? directSharePM.indirectPct : null,
          priorYear: null,
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
    for (const a of annualised) {
      if (`${a.monthKey}-31` < todayIsoStr) {
        // wholly past
        businessDone.short += a.revenue.short;
        businessDone.mid += a.revenue.mid;
        businessDone.long += a.revenue.long;
        businessDone.total += a.revenue.total;
      } else {
        bob.short += a.revenue.short;
        bob.mid += a.revenue.mid;
        bob.long += a.revenue.long;
        bob.total += a.revenue.total;
      }
    }

    res.json({
      hotelId,
      hotelName: hotel.name,
      shortName: hotel.shortName,
      monthKey: currentMK,
      asOf: todayIsoStr,
      hasBudgetData,
      summary,
      annualised,
      pacing,
      bob,
      businessDone,
      inHouseFY,
      unitPacing,
      ssWeekly: tiers.ssWeekly,
      lsTierWeekly: tiers.lsTierWeekly,
      notes: {
        ancillaries: "Canal / Meadow / Grounding revenue is out of v1 scope (mostly sourced outside Mews).",
        budgets: hasBudgetData
          ? null
          : "Per-service budgets not yet uploaded; Budget columns hidden.",
        longStayAdr: "Long Stay ADR is renamed 'Avg Monthly Charge' — Mews bills LS in monthly units, not room-nights.",
      },
    });
  } catch (err) {
    console.error("[Mason] /sales-flash failed:", err.message);
    res.status(500).json({ error: err.message });
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
