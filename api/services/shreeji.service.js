/**
 * @file shreeji.service.js
 * @brief Data orchestrator for the Shreeji portfolio dashboard.
 *
 * Pulls the Shreeji hotel list dynamically (management_group = 'Shreeji'),
 * fetches performance metrics from daily_metrics_snapshots, and overlays
 * payment-split + ancillary item-level breakdown from the Cloudbeds Data
 * Insights API.
 *
 * Response is shaped to match what `ShreejiDashboard.tsx` was rendering with
 * mock data — the frontend swaps mock → fetched with no UI change.
 */

const pgPool = require("../utils/db");
const CloudbedsAdapter = require("../adapters/cloudbedsAdapter");

// ─── helpers ─────────────────────────────────────────────────────────────────

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve the five date ranges we report on for a given monthKey ("YYYY-MM").
 *  - mtd: 1st of monthKey to min(today, last-of-month).
 *  - stly: 1st to last-of (monthKey - 1yr). FULL prior-year month, not the
 *          partial same-day window. Reason: daily_metrics_snapshots for
 *          Shreeji 2024/2025 was rewritten from monthly accountant totals via
 *          scripts/rescale-shreeji-history.js — monthly aggregates are
 *          accurate but per-day distribution is unreliable (sub-month windows
 *          can show >100% occupancy where the rescale concentrated the total
 *          onto a few days). Full-month aggregation avoids that artefact.
 *  - last: 1st to last-of (monthKey - 1 month). Most recent CLOSED month.
 *  - lastLy: full prior-year version of `last` (e.g. last=Apr 2026 → lastLy=Apr 2025).
 *           Used both per-hotel and for the portfolio YoY tile.
 *  - pace: today+1 .. today+30 inclusive. Forward OTB / pickup window.
 */
function resolveRanges(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const mtdEnd = monthEnd < today ? monthEnd : today;

  // Full prior-year month (not same-day partial — see comment above).
  const stlyStart = new Date(Date.UTC(y - 1, m - 1, 1));
  const stlyEnd = new Date(Date.UTC(y - 1, m, 0));

  // "Last closed" is always the month before monthKey.
  const lastStart = new Date(Date.UTC(y, m - 2, 1));
  const lastEnd = new Date(Date.UTC(y, m - 1, 0));

  // Prior-year of last-closed-month, full calendar month.
  const lastLyStart = new Date(Date.UTC(y - 1, m - 2, 1));
  const lastLyEnd = new Date(Date.UTC(y - 1, m - 1, 0));

  const paceStart = new Date(today);
  paceStart.setUTCDate(today.getUTCDate() + 1);
  const paceEnd = new Date(today);
  paceEnd.setUTCDate(today.getUTCDate() + 30);

  return {
    monthStart,
    monthEnd,
    mtdEnd,
    stlyStart,
    stlyEnd,
    lastStart,
    lastEnd,
    lastLyStart,
    lastLyEnd,
    paceStart,
    paceEnd,
    today,
    daysElapsed: Math.max(
      1,
      Math.round((mtdEnd - monthStart) / 86_400_000) + 1,
    ),
  };
}

// ─── Shreeji hotel list ──────────────────────────────────────────────────────

// Sub-portfolio split provided by Sanchit (2026-05-18). SP = Sanchit's
// 5 hotels, NP = the other partner's 7. Any new Shreeji property defaults to
// neither bucket — add it explicitly when onboarded.
const SP_HOTEL_IDS = new Set([318311, 318312, 318313, 318314, 318291]);
const NP_HOTEL_IDS = new Set([318304, 318305, 318307, 318308, 318309, 318316, 318317]);

function filterByPortfolio(hotels, portfolio) {
  if (portfolio === "sp") return hotels.filter((h) => SP_HOTEL_IDS.has(h.hotelId));
  if (portfolio === "np") return hotels.filter((h) => NP_HOTEL_IDS.has(h.hotelId));
  return hotels;
}

async function getShreejiHotels() {
  const { rows } = await pgPool.query(
    `SELECT hotel_id, property_name, pms_type, pms_property_id, total_rooms, tax_rate
       FROM hotels
      WHERE management_group ILIKE 'shreeji'
        AND COALESCE(is_disconnected, false) = false
      ORDER BY property_name`,
  );
  return rows.map((r) => ({
    hotelId: r.hotel_id,
    name: r.property_name,
    pmsType: r.pms_type,
    pmsPropertyId: r.pms_property_id,
    rooms: r.total_rooms || 0,
    taxRate: parseFloat(r.tax_rate || 0),
  }));
}

// ─── DB performance metrics ──────────────────────────────────────────────────

/**
 * Aggregate per-hotel revenue/rooms_sold/capacity over a date range.
 * Returns a Map<hotel_id, { revenue, roomsSold, capacity }>.
 */
async function getDbAggregates(hotelIds, startDate, endDate) {
  if (hotelIds.length === 0) return new Map();
  const { rows } = await pgPool.query(
    `SELECT hotel_id,
            COALESCE(SUM(gross_revenue), 0)::float AS revenue,
            COALESCE(SUM(rooms_sold), 0)::int     AS rooms_sold,
            COALESCE(SUM(capacity_count), 0)::int AS capacity
       FROM daily_metrics_snapshots
      WHERE hotel_id = ANY($1::int[])
        AND stay_date BETWEEN $2 AND $3
      GROUP BY hotel_id`,
    [hotelIds, ymd(startDate), ymd(endDate)],
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.hotel_id, {
      revenue: r.revenue,
      roomsSold: r.rooms_sold,
      capacity: r.capacity,
    });
  }
  return map;
}

function asPerf(agg) {
  if (!agg || agg.capacity === 0) {
    return { occ: 0, adr: 0, rev: 0, roomsSold: 0, capacity: 0 };
  }
  return {
    occ: agg.capacity > 0 ? agg.roomsSold / agg.capacity : 0,
    adr: agg.roomsSold > 0 ? agg.revenue / agg.roomsSold : 0,
    rev: agg.revenue,
    roomsSold: agg.roomsSold,
    capacity: agg.capacity,
  };
}

// ─── ancillary categorisation ────────────────────────────────────────────────

/**
 * Bucket a Cloudbeds extras line into one of five logical categories the UI
 * understands. Cloudbeds gives us `item_service_category` (free-text per
 * property) and `item_service_type` (the name of the SKU); we match on both,
 * case-insensitive, with category taking precedence.
 *
 * Categories are deliberately broad — Shreeji properties use varied add-on
 * taxonomy (e.g. some say "Beverages", some "Bar", some "Drinks"). When a
 * new SKU keyword appears that doesn't match, it falls into "other" rather
 * than getting silently dropped.
 */
const BAR_KEYWORDS = [
  "bar", "drink", "beverage", "soft drink", "softdrink",
  "wine", "beer", "spirit", "cola", "coke", "pepsi", "water",
  "juice", "tea", "coffee", "minibar", "mini bar", "mini-bar",
];
const BREAKFAST_KEYWORDS = ["breakfast", "brkfst", "morning meal", "continental", "english"];
const PARKING_KEYWORDS = ["parking", "car park", "garage"];
const LAUNDRY_KEYWORDS = ["laundry", "wash", "dry clean"];

function classifyExtra(label, category) {
  const txt = `${label || ""} ${category || ""}`.toLowerCase();
  if (BREAKFAST_KEYWORDS.some((k) => txt.includes(k))) return "breakfast";
  if (BAR_KEYWORDS.some((k) => txt.includes(k))) return "bar";
  if (PARKING_KEYWORDS.some((k) => txt.includes(k))) return "parking";
  if (LAUNDRY_KEYWORDS.some((k) => txt.includes(k))) return "laundry";
  return "other";
}

/**
 * Transform Cloudbeds `getMonthlyFinancials` output into the dashboard's
 * takings + ancillary shape. Tolerates missing fields — adapter sometimes
 * returns shorter objects on partial failure.
 */
function reshapeFinancials(financials) {
  if (!financials) return { takings: null, ancillary: null };

  const t = financials.takings || {};
  const cardBreakdown = t.cardBreakdown || {};
  let visa = 0,
    mastercard = 0,
    amex = 0,
    otherCards = 0;
  for (const [label, amount] of Object.entries(cardBreakdown)) {
    const k = (label || "").toLowerCase();
    if (k.includes("visa")) visa += amount;
    else if (k.includes("master")) mastercard += amount;
    else if (k.includes("amex") || k.includes("american express")) amex += amount;
    else otherCards += amount;
  }
  const cash = t.cash || 0;
  const bank = t.bacs || 0;
  const total = cash + visa + mastercard + amex + otherCards + bank;

  const takings = {
    cash,
    visa,
    mastercard,
    amex,
    otherCards,
    bankTransfer: bank,
    total,
  };

  const ext = financials.extras || {};
  const breakdown = ext.breakdown || {};

  // Each category accumulates an items[] list. We don't have per-item
  // category metadata in extras.breakdown (only labels), so we re-classify
  // each label via classifyExtra (label, category=null). The adapter
  // collapses category info before returning — that's fine for now; the
  // keywords above are accurate enough for Shreeji's SKU naming.
  const buckets = {
    breakfast: { total: 0, items: [] },
    bar: { total: 0, items: [] },
    parking: { total: 0, items: [] },
    laundry: { total: 0, items: [] },
    other: { total: 0, items: [] },
  };

  for (const [label, info] of Object.entries(breakdown)) {
    const amount = info?.amount || 0;
    const qty = info?.quantity || 0;
    if (amount === 0 && qty === 0) continue;

    const bucket = classifyExtra(label, null);
    const unit = qty !== 0 ? amount / qty : amount;
    buckets[bucket].items.push({
      name: label,
      qty: Math.round(qty),
      unit: Number.isFinite(unit) ? +unit.toFixed(2) : 0,
      revenue: +amount.toFixed(2),
    });
    buckets[bucket].total += amount;
  }

  // Sort each bucket's items by revenue desc — biggest sellers first.
  for (const b of Object.values(buckets)) {
    b.items.sort((a, b) => b.revenue - a.revenue);
    b.total = +b.total.toFixed(2);
  }

  const grandTotal = Object.values(buckets).reduce((s, b) => s + b.total, 0);

  return {
    takings,
    ancillary: { ...buckets, grandTotal: +grandTotal.toFixed(2) },
  };
}

/**
 * Fetch takings + extras for one hotel + date range. Returns null on failure
 * (logged at warn). Designed to be called inside a Promise.all without taking
 * down the whole dashboard if one hotel's Cloudbeds session goes sour.
 */
async function fetchFinancialsForHotel(hotel, startDate, endDate) {
  if (hotel.pmsType !== "cloudbeds") {
    return { takings: null, ancillary: null };
  }
  try {
    const accessToken = await CloudbedsAdapter.getAccessToken(hotel.hotelId);
    const financials = await CloudbedsAdapter.getMonthlyFinancials(
      accessToken,
      hotel.pmsPropertyId,
      ymd(startDate),
      ymd(endDate),
      hotel.taxRate,
    );
    return reshapeFinancials(financials);
  } catch (err) {
    console.warn(
      `[Shreeji] Financials fetch failed for hotel ${hotel.hotelId} (${hotel.name}):`,
      err.message,
    );
    return {
      takings: null,
      ancillary: null,
      error: err.message?.slice(0, 200) || "fetch failed",
    };
  }
}

// ─── dashboard orchestrator ──────────────────────────────────────────────────

/**
 * Build the full dashboard payload for the given monthKey.
 *
 * @param {string} monthKey YYYY-MM
 * @param {object} opts
 *   - includeFinancials (default true): set false to skip Cloudbeds calls
 *     (fast DB-only path for the initial paint).
 */
async function getDashboard(monthKey, { includeFinancials = true, portfolio = "all" } = {}) {
  const ranges = resolveRanges(monthKey);
  const allHotels = await getShreejiHotels();
  const hotels = filterByPortfolio(allHotels, portfolio);
  const hotelIds = hotels.map((h) => h.hotelId);

  // 5 parallel DB aggregates for the five time windows.
  const [mtdMap, stlyMap, lastMap, lastLyMap, paceMap] = await Promise.all([
    getDbAggregates(hotelIds, ranges.monthStart, ranges.mtdEnd),
    getDbAggregates(hotelIds, ranges.stlyStart, ranges.stlyEnd),
    getDbAggregates(hotelIds, ranges.lastStart, ranges.lastEnd),
    getDbAggregates(hotelIds, ranges.lastLyStart, ranges.lastLyEnd),
    getDbAggregates(hotelIds, ranges.paceStart, ranges.paceEnd),
  ]);

  // Pickup-7d: rooms picked up in last 7 days for stays in next 30 days.
  // Sourced from reservations.booking_date — same shape as Mason's
  // booking pulse. Best-effort: if reservations table is sparse, returns 0.
  const pickup7dMap = await getPickup7d(hotelIds, ranges);

  // Optionally fetch Cloudbeds financials in parallel.
  const financialsPromises = includeFinancials
    ? Promise.all(
        hotels.map((h) =>
          fetchFinancialsForHotel(h, ranges.monthStart, ranges.mtdEnd),
        ),
      )
    : Promise.resolve(hotels.map(() => ({ takings: null, ancillary: null })));

  const financialsArr = await financialsPromises;

  const hotelRows = hotels.map((h, i) => {
    const fin = financialsArr[i] || {};
    return {
      id: String(h.hotelId),
      name: h.name,
      rooms: h.rooms,
      pmsType: h.pmsType,
      mtd: asPerf(mtdMap.get(h.hotelId)),
      stly: asPerf(stlyMap.get(h.hotelId)),
      last: asPerf(lastMap.get(h.hotelId)),
      lastLy: asPerf(lastLyMap.get(h.hotelId)),
      pace: {
        ...asPerf(paceMap.get(h.hotelId)),
        pickup7d: pickup7dMap.get(h.hotelId) || 0,
      },
      takings: fin.takings,
      ancillary: fin.ancillary,
      financialsError: fin.error || null,
    };
  });

  // Portfolio totals.
  const sum = (arr, k) => arr.reduce((s, x) => s + (x || 0), 0);
  const totRooms = sum(hotelRows.map((h) => h.rooms));
  const totMtdRev = sum(hotelRows.map((h) => h.mtd.rev));
  const totLastRev = sum(hotelRows.map((h) => h.last.rev));
  const totLastLyRev = sum(hotelRows.map((h) => h.lastLy.rev));
  const totPaceRev = sum(hotelRows.map((h) => h.pace.rev));
  const totMtdSold = sum(hotelRows.map((h) => h.mtd.roomsSold));
  const totMtdCap = sum(hotelRows.map((h) => h.mtd.capacity));
  const totLastSold = sum(hotelRows.map((h) => h.last.roomsSold));
  const totLastCap = sum(hotelRows.map((h) => h.last.capacity));
  const totPaceSold = sum(hotelRows.map((h) => h.pace.roomsSold));
  const totPaceCap = sum(hotelRows.map((h) => h.pace.capacity));
  const totPickup7d = sum(hotelRows.map((h) => h.pace.pickup7d));

  // Like-for-like YoY: only count hotels that had data in the prior year so
  // newly-onboarded properties don't drag the % up.
  const ylMatched = hotelRows.filter((h) => h.lastLy.rev > 0);
  const ylMatchedLast = ylMatched.reduce((s, h) => s + h.last.rev, 0);
  const ylMatchedLastLy = ylMatched.reduce((s, h) => s + h.lastLy.rev, 0);

  // Takings + ancillary totals — only summed across hotels with non-null data.
  const tk = hotelRows
    .map((h) => h.takings)
    .filter(Boolean)
    .reduce(
      (acc, t) => ({
        cash: acc.cash + t.cash,
        visa: acc.visa + t.visa,
        mastercard: acc.mastercard + t.mastercard,
        amex: acc.amex + t.amex,
        otherCards: acc.otherCards + t.otherCards,
        bankTransfer: acc.bankTransfer + t.bankTransfer,
        total: acc.total + t.total,
      }),
      { cash: 0, visa: 0, mastercard: 0, amex: 0, otherCards: 0, bankTransfer: 0, total: 0 },
    );

  const anc = hotelRows
    .map((h) => h.ancillary)
    .filter(Boolean)
    .reduce(
      (acc, a) => ({
        breakfast: acc.breakfast + a.breakfast.total,
        bar: acc.bar + a.bar.total,
        parking: acc.parking + a.parking.total,
        laundry: acc.laundry + a.laundry.total,
        other: acc.other + a.other.total,
        grandTotal: acc.grandTotal + a.grandTotal,
      }),
      { breakfast: 0, bar: 0, parking: 0, laundry: 0, other: 0, grandTotal: 0 },
    );

  return {
    monthKey,
    portfolio,
    asOf: new Date().toISOString(),
    ranges: {
      mtd: { start: ymd(ranges.monthStart), end: ymd(ranges.mtdEnd) },
      stly: { start: ymd(ranges.stlyStart), end: ymd(ranges.stlyEnd) },
      last: { start: ymd(ranges.lastStart), end: ymd(ranges.lastEnd) },
      lastLy: { start: ymd(ranges.lastLyStart), end: ymd(ranges.lastLyEnd) },
      pace: { start: ymd(ranges.paceStart), end: ymd(ranges.paceEnd) },
    },
    daysElapsed: ranges.daysElapsed,
    hotels: hotelRows,
    totals: {
      rooms: totRooms,
      mtd: {
        rev: totMtdRev,
        occ: totMtdCap > 0 ? totMtdSold / totMtdCap : 0,
        adr: totMtdSold > 0 ? totMtdRev / totMtdSold : 0,
      },
      last: {
        rev: totLastRev,
        occ: totLastCap > 0 ? totLastSold / totLastCap : 0,
        adr: totLastSold > 0 ? totLastRev / totLastSold : 0,
      },
      lastLy: { rev: totLastLyRev },
      // Like-for-like YoY for the closed month — only hotels with prior-year
      // data are included so a new property's £0 doesn't inflate the %.
      yoy: {
        matchedHotels: ylMatched.length,
        unmatchedHotels: hotelRows.length - ylMatched.length,
        lastRev: ylMatchedLast,
        lastLyRev: ylMatchedLastLy,
        deltaPct:
          ylMatchedLastLy > 0
            ? ((ylMatchedLast - ylMatchedLastLy) / ylMatchedLastLy) * 100
            : null,
      },
      pace: {
        rev: totPaceRev,
        occ: totPaceCap > 0 ? totPaceSold / totPaceCap : 0,
        pickup7d: totPickup7d,
      },
      takings: tk,
      ancillary: anc,
    },
    includesFinancials: includeFinancials,
  };
}

/**
 * Count reservations created in the last 7 days for arrivals in the next 30.
 * Returns a Map<hotel_id, count>. Empty Map if `reservations` is sparse.
 */
async function getPickup7d(hotelIds, ranges) {
  if (hotelIds.length === 0) return new Map();
  try {
    const { rows } = await pgPool.query(
      `SELECT hotel_id, COUNT(*)::int AS picked_up
         FROM reservations
        WHERE hotel_id = ANY($1::int[])
          AND booking_date >= (CURRENT_DATE - INTERVAL '7 days')
          AND check_in BETWEEN $2 AND $3
          AND (status IS NULL OR status NOT ILIKE '%cancel%')
        GROUP BY hotel_id`,
      [hotelIds, ymd(ranges.paceStart), ymd(ranges.paceEnd)],
    );
    const map = new Map();
    for (const r of rows) map.set(r.hotel_id, r.picked_up);
    return map;
  } catch (err) {
    // reservations table may not exist in all environments — degrade quietly.
    console.warn("[Shreeji] pickup-7d query failed:", err.message);
    return new Map();
  }
}

module.exports = {
  getShreejiHotels,
  getDashboard,
};
