/**
 * @file mason.service.js
 * @brief Reporting helpers for the Mason & Fifth Sales Flash + Pacing Flash.
 *
 * Layered on top of mewsAdapter.getRevenueByAccountingCategoryByMonth (the
 * canonical consumed-revenue filter — Blueprint §13). All revenue reads use
 * that single function so the digitised reports tie penny-perfect to Mews's
 * Order Items Report just like the Mason Dashboard does.
 *
 * v1 scope (locked 2026-05-08): Westbourne (318341) + Primrose (318343).
 * Belsize Park is excluded — opens mid-May 2026, no LY data.
 *
 * STLY (Same Time Last Year) and LPR (Last Pacing Report) are deferred to a
 * separate workstream. Those rows return null and the UI hides them.
 */

const mewsAdapter = require("../adapters/mewsAdapter");
const pgPool = require("../utils/db");

const ROLES = ["short", "mid", "long"];

// Lead-time tiers used by the Sales Flash LS new-deals table and the booking
// pulse breakdown. Matches Mason's spreadsheet bucketing exactly.
const LEAD_TIME_TIERS = [
  { key: "0_3m", label: "1-3 Month", minDays: 0, maxDays: 89 },
  { key: "3_6m", label: "3-6 Month", minDays: 90, maxDays: 179 },
  { key: "6_9m", label: "6-9 Month", minDays: 180, maxDays: 269 },
  { key: "9plus_m", label: "9+ Month", minDays: 270, maxDays: null },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthKey(year, monthIdx0) {
  return `${year}-${pad2(monthIdx0 + 1)}`;
}

function shiftYear(monthKeyStr, deltaYears) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return `${y + deltaYears}-${pad2(m)}`;
}

function startOfMonth(monthKeyStr) {
  return `${monthKeyStr}-01`;
}

function endOfMonth(monthKeyStr) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKeyStr}-${pad2(last)}`;
}

function daysInMonth(monthKeyStr) {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Per-service revenue + nights + ADR + occupancy share, plus blended
 * property-wide totals, for each month in [monthFrom, monthTo].
 *
 * Revenue/nights from Mews orderItems (consumed scope). Occupancy from
 * daily_metrics_snapshots (property-wide rooms_sold ÷ capacity_count).
 * The two sources are intentionally different — Long Stay's per-service
 * "nights" are monthly billing units, not actual occupied nights, so
 * service-level occ share is a soft signal; the headline blended occ is
 * the truth.
 */
async function getMonthlyKpis(hotelId, monthFrom, monthTo, accountingCategories) {
  const allowedAccCatIds = ROLES.flatMap((r) => accountingCategories[r] || []);
  const accCatIdToRole = {};
  for (const role of ROLES) {
    for (const id of accountingCategories[role] || []) {
      accCatIdToRole[id] = role;
    }
  }

  const startDate = startOfMonth(monthFrom);
  const endDate = endOfMonth(monthTo);

  const result = await mewsAdapter.getRevenueByAccountingCategoryByMonth(
    hotelId,
    startDate,
    endDate,
    allowedAccCatIds,
  );

  // Property-wide occupancy + room nights from daily_metrics_snapshots
  // (property-wide rooms_sold per Blueprint §10 — already accounts for
  // cross-service blocks via Mews's services/getAvailability).
  const occRows = await pgPool.query(
    `SELECT
        TO_CHAR(stay_date, 'YYYY-MM') AS month_key,
        SUM(rooms_sold)::numeric AS total_room_nights,
        SUM(capacity_count)::numeric AS total_capacity,
        AVG(capacity_count)::numeric AS avg_capacity
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1
        AND stay_date BETWEEN $2 AND $3
      GROUP BY 1
      ORDER BY 1`,
    [hotelId, startDate, endDate],
  );
  const occByMonth = new Map(occRows.rows.map((r) => [r.month_key, r]));

  // Build month list inclusive
  const months = [];
  let cursor = monthFrom;
  while (cursor <= monthTo) {
    months.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, 1));
    cursor = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}`;
  }

  const rows = months.map((mk) => {
    const byRole = {};
    let totalRev = 0;
    let totalServiceNights = 0;
    for (const role of ROLES) {
      const accCatIds = accountingCategories[role] || [];
      let net = 0;
      let nights = 0;
      for (const accCatId of accCatIds) {
        const bucket = result.byAccountingCategoryMonth[accCatId]?.[mk];
        if (!bucket) continue;
        net += bucket.net;
        nights += bucket.nights;
      }
      byRole[role] = {
        revenue: net,
        nights,
        adr: nights > 0 ? net / nights : null,
        configured: accCatIds.length > 0,
      };
      totalRev += net;
      totalServiceNights += nights;
    }

    const occRow = occByMonth.get(mk);
    const totalRoomNights = occRow ? Number(occRow.total_room_nights) : 0;
    const totalCapacity = occRow ? Number(occRow.total_capacity) : 0;
    const occupancy = totalCapacity > 0 ? (totalRoomNights / totalCapacity) * 100 : null;
    const blendedAdr = totalRoomNights > 0 ? totalRev / totalRoomNights : null;
    const revpar = totalCapacity > 0 ? totalRev / totalCapacity : null;

    return {
      monthKey: mk,
      byRole,
      total: {
        revenue: totalRev,
        roomNights: totalRoomNights,
        capacity: totalCapacity,
        occupancy,
        adr: blendedAdr,
        revpar,
      },
    };
  });

  return { months: rows, accCatIdToRole };
}

/**
 * Final-Month-LY KPIs from daily_metrics_snapshots only. Used by the
 * Pacing Flash "Final Month LY" row and the Sales Flash "Prior Year"
 * column. Pulls 13 months back from the requested window so callers can
 * compute YoY for any month in scope.
 *
 * Note: gross/net revenue here comes from `daily_metrics_snapshots.gross_revenue`
 * which is Short-Stay-Service-only per §12. For Mason use cases this is the
 * legacy scope, NOT the consumed-AccCat-grouped scope. We surface it anyway
 * because it's the only source of LY data — when STLY backend lands the LY
 * row will switch to the AccCat-reconstruction model.
 */
async function getFinalLyKpis(hotelId, monthFrom, monthTo) {
  const { rows } = await pgPool.query(
    `SELECT
        TO_CHAR(stay_date, 'YYYY-MM') AS month_key,
        SUM(gross_revenue)::numeric AS gross_revenue,
        SUM(net_revenue)::numeric AS net_revenue,
        SUM(rooms_sold)::numeric AS room_nights,
        SUM(capacity_count)::numeric AS capacity,
        AVG(capacity_count)::numeric AS avg_capacity
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1
        AND stay_date BETWEEN $2 AND $3
      GROUP BY 1
      ORDER BY 1`,
    [hotelId, startOfMonth(monthFrom), endOfMonth(monthTo)],
  );
  const map = new Map();
  for (const r of rows) {
    const rev = Number(r.net_revenue) || Number(r.gross_revenue) || 0;
    const nights = Number(r.room_nights) || 0;
    const cap = Number(r.capacity) || 0;
    map.set(r.month_key, {
      revenue: rev,
      roomNights: nights,
      capacity: cap,
      occupancy: cap > 0 ? (nights / cap) * 100 : null,
      adr: nights > 0 ? rev / nights : null,
      revpar: cap > 0 ? rev / cap : null,
    });
  }
  return map;
}

/**
 * Simple v1 Forecast model per locked preference: for the current month,
 *   forecast = realized_to_date + (remaining_capacity × realized_occ × realized_ADR)
 * For future months the realized signal is zero and the formula degrades to
 * `forecast ≈ OTB`. Caller uses the OTB row for those — UI will surface a
 * one-line caveat. Replace with a proper pacing model once STLY lands.
 *
 * Returns null fields when there's no realized signal — caller renders "—".
 */
function computeForecast(monthKey, otbRow, occRows /* daily snapshot rows */, todayDate) {
  const monthStart = `${monthKey}-01`;
  const monthEnd = endOfMonth(monthKey);

  // Future month: no realized signal, forecast = OTB
  if (todayDate < monthStart) {
    return { ...otbRow.total, isForward: true };
  }
  // Past month: forecast = realized (= OTB)
  if (todayDate > monthEnd) {
    return { ...otbRow.total, isPast: true };
  }

  // Current month: split into elapsed vs remaining
  const elapsedRows = occRows.filter((r) => r.stay_date <= todayDate);
  const remainingRows = occRows.filter((r) => r.stay_date > todayDate);

  const elapsedRoomNights = elapsedRows.reduce((s, r) => s + Number(r.rooms_sold || 0), 0);
  const elapsedCap = elapsedRows.reduce((s, r) => s + Number(r.capacity_count || 0), 0);
  const remainingCap = remainingRows.reduce((s, r) => s + Number(r.capacity_count || 0), 0);

  const realizedOcc = elapsedCap > 0 ? elapsedRoomNights / elapsedCap : 0;
  const totalRoomNights = otbRow.total.roomNights;
  const totalRevenue = otbRow.total.revenue;
  const realizedAdr = elapsedRoomNights > 0
    ? (totalRevenue * (elapsedRoomNights / Math.max(totalRoomNights, 1))) / elapsedRoomNights
    : (totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0);

  const projectedRoomNights = remainingCap * realizedOcc;
  const projectedRevenue = projectedRoomNights * realizedAdr;
  const realizedRevenueShare = elapsedRoomNights > 0
    ? totalRevenue * (elapsedRoomNights / Math.max(totalRoomNights, 1))
    : 0;
  const fcRevenue = realizedRevenueShare + projectedRevenue;
  const fcRoomNights = elapsedRoomNights + projectedRoomNights;
  const fcCapacity = elapsedCap + remainingCap;

  return {
    revenue: fcRevenue,
    roomNights: fcRoomNights,
    capacity: fcCapacity,
    occupancy: fcCapacity > 0 ? (fcRoomNights / fcCapacity) * 100 : null,
    adr: fcRoomNights > 0 ? fcRevenue / fcRoomNights : null,
    revpar: fcCapacity > 0 ? fcRevenue / fcCapacity : null,
    isCurrent: true,
  };
}

async function getDailyOccRows(hotelId, monthFrom, monthTo) {
  const { rows } = await pgPool.query(
    `SELECT stay_date::text AS stay_date, rooms_sold, capacity_count
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date BETWEEN $2 AND $3
      ORDER BY stay_date`,
    [hotelId, startOfMonth(monthFrom), endOfMonth(monthTo)],
  );
  return rows;
}

/**
 * 8-week (or N-week) booking pulse: bookings, cancellations, revenue picked
 * up, attributed to STAY MONTH (check-in month), bucketed by booking week
 * (created_at week, ISO Monday-anchored).
 *
 * NOTE on history depth: the `reservations` table is populated by the Mews
 * webhook handler; it only contains data from when the integration started
 * (~2026-04-10 for M&F). Older bookings can be backfilled via
 * scripts/backfill-reservations.js if the user needs deeper history.
 */
async function getBookingPulse(hotelId, weeksBack = 8) {
  const today = new Date();
  // Monday of the current week
  const dow = today.getUTCDay() || 7; // Sun=0 → 7
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setUTCDate(today.getUTCDate() - (dow - 1));
  mondayThisWeek.setUTCHours(0, 0, 0, 0);
  const fromWeekStart = new Date(mondayThisWeek);
  fromWeekStart.setUTCDate(mondayThisWeek.getUTCDate() - weeksBack * 7);

  const { rows } = await pgPool.query(
    `SELECT
        TO_CHAR(date_trunc('week', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS week_start,
        TO_CHAR(check_in, 'YYYY-MM') AS stay_month,
        COUNT(*) AS bookings,
        COUNT(*) FILTER (WHERE status ILIKE '%cancel%') AS cancellations,
        SUM(COALESCE(total_rate, 0)) FILTER (WHERE status NOT ILIKE '%cancel%')::numeric AS revenue,
        SUM(COALESCE(nights, 0)) FILTER (WHERE status NOT ILIKE '%cancel%') AS room_nights
      FROM reservations
      WHERE hotel_id = $1
        AND created_at >= $2
      GROUP BY 1, 2
      ORDER BY 1, 2`,
    [hotelId, fromWeekStart.toISOString()],
  );

  return {
    rows: rows.map((r) => ({
      weekStart: r.week_start,
      stayMonth: r.stay_month,
      bookings: Number(r.bookings),
      cancellations: Number(r.cancellations),
      revenue: Number(r.revenue) || 0,
      roomNights: Number(r.room_nights) || 0,
    })),
    weeksBack,
    earliestReservationCapture: "2026-04-10",
  };
}

/**
 * Lead-time tiered weekly bookings — Sales Flash LS new-deals table and
 * SS weekly bookings table. SS = nights ≤ ~28 (short-stay heuristic),
 * MS/LS by nights bucket. Refines using the lead-time tiers above.
 *
 * `tier` derived from check_in − created_at (days). Booked nights bucket
 * derived from `nights`.
 */
async function getLeadTimeTiers(hotelId, weeksBack = 8, serviceIds = null) {
  const today = new Date();
  const dow = today.getUTCDay() || 7;
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setUTCDate(today.getUTCDate() - (dow - 1));
  mondayThisWeek.setUTCHours(0, 0, 0, 0);
  const fromWeekStart = new Date(mondayThisWeek);
  fromWeekStart.setUTCDate(mondayThisWeek.getUTCDate() - weeksBack * 7);

  // 2026-04-13 cutoff: the reservations table started capture on 2026-04-10
  // and the backfill stamped all pre-existing reservations with `created_at`
  // clustered around that day, producing two synthetic "tsunami" weeks
  // (2026-03-30 + 2026-04-06) showing impossible booking volumes. Organic
  // booking data starts Mon 2026-04-13 11:00 local. Verified against Mason's
  // analyst spreadsheet — tsunami weeks not present there.
  //
  // 11:00 local cutoff: matches the convention used by Mews's Reservation
  // Report and Order Items Report (Blueprint §13.1). A reservation created
  // at 13/04 10:59 belongs to "week ending Mon 13/04"; one created at 11:00
  // belongs to "week starting Mon 13/04". Cutoff is in BST (UTC+1) for the
  // dates currently in scope; UTC equivalent = 10:00.
  const RESERVATION_CAPTURE_CUTOFF = "2026-04-13T10:00:00.000Z"; // 11:00 BST
  const effectiveFrom = fromWeekStart.toISOString() > RESERVATION_CAPTURE_CUTOFF
    ? fromWeekStart.toISOString()
    : RESERVATION_CAPTURE_CUTOFF;

  // Pull all reservations created since the effective cutoff. We do
  // service-id filtering in JS rather than SQL so we can also bucket the
  // mid / long tiers in the same scan.
  const { rows } = await pgPool.query(
    `SELECT
        TO_CHAR(date_trunc(
          'week',
          (created_at AT TIME ZONE 'Europe/London' - INTERVAL '11 hours')
        ), 'YYYY-MM-DD') AS week_start,
        (check_in - created_at::date) AS lead_days,
        nights,
        total_rate,
        avg_nightly_rate,
        status,
        mews_service_id
      FROM reservations
      WHERE hotel_id = $1
        AND created_at >= $2
      ORDER BY 1`,
    [hotelId, effectiveFrom],
  );

  // Resolve service-id sets per role (short / mid / long). serviceIds shape:
  // { short: [...], mid: [...], long: [...] } — passed in from the router.
  const shortSet = new Set(serviceIds?.short || []);
  const midSet   = new Set(serviceIds?.mid   || []);
  const longSet  = new Set(serviceIds?.long  || []);

  // Bucket each booking by tier and service classification
  const ssWeekly = new Map();   // weekStart -> { bookings, roomNights, revenue }
  const lsTierWeekly = new Map(); // tierKey -> weekStart -> count
  const tierTotals = {}; // tierKey -> { bookings, revenue, nights }
  for (const t of LEAD_TIME_TIERS) {
    lsTierWeekly.set(t.key, new Map());
    tierTotals[t.key] = { bookings: 0, revenue: 0, nights: 0 };
  }

  for (const r of rows) {
    const isCancelled = (r.status || "").toLowerCase().includes("cancel");
    const week = r.week_start;
    const nights = Number(r.nights) || 0;
    const totalRate = Number(r.total_rate) || 0;
    const adr = Number(r.avg_nightly_rate) || (nights > 0 ? totalRate / nights : 0);
    const sid = r.mews_service_id || null;

    // Short Stay = reservations under the Mews Short Stay Accommodation
    // service. Classification mirrors Mews exactly (ties to Mews Reservation
    // Report for any given created-window). Cancelled reservations excluded.
    // Verified 2026-05-11 against Mews's Apr 13-19 export.
    if (shortSet.has(sid) && !isCancelled) {
      if (!ssWeekly.has(week)) ssWeekly.set(week, { bookings: 0, roomNights: 0, revenue: 0, adrSum: 0, adrCount: 0 });
      const slot = ssWeekly.get(week);
      slot.bookings += 1;
      slot.roomNights += nights;
      slot.revenue += totalRate;
      if (adr > 0) {
        slot.adrSum += adr;
        slot.adrCount += 1;
      }
    }

    // Long-stay / mid-stay tier bucket — by lead time. Bucket on Mews
    // service first (Long Stay or Mid Stay services); fall back to the
    // `nights > 28` heuristic for hotels without service IDs configured.
    const isLongOrMid = serviceIds
      ? (longSet.has(sid) || midSet.has(sid))
      : nights > 28;
    if (isLongOrMid) {
      const leadDays = Number(r.lead_days) || 0;
      const tier = LEAD_TIME_TIERS.find(
        (t) => leadDays >= t.minDays && (t.maxDays === null || leadDays <= t.maxDays),
      );
      if (tier) {
        const m = lsTierWeekly.get(tier.key);
        m.set(week, (m.get(week) || 0) + 1);
        if (!isCancelled) {
          tierTotals[tier.key].bookings += 1;
          tierTotals[tier.key].revenue += totalRate;
          tierTotals[tier.key].nights += nights;
        }
      }
    }
  }

  return {
    ssWeekly: [...ssWeekly.entries()]
      .sort()
      .map(([weekStart, v]) => ({
        weekStart,
        bookings: v.bookings,
        roomNights: v.roomNights,
        revenue: v.revenue,
        avgAdr: v.adrCount > 0 ? v.adrSum / v.adrCount : null,
      })),
    lsTierWeekly: LEAD_TIME_TIERS.map((t) => ({
      tier: t.key,
      label: t.label,
      weekly: [...lsTierWeekly.get(t.key).entries()]
        .sort()
        .map(([weekStart, count]) => ({ weekStart, count })),
      total: tierTotals[t.key],
    })),
  };
}

/**
 * Weekly Unit Pacing — count of reservations active across each upcoming
 * week, split by service heuristic (SS / MS / LS / Offline / Vacant).
 *
 * Service heuristic from `nights`:
 *   nights ≤ 28 → SS
 *   28 < nights ≤ 90 → MS
 *   nights > 90 → LS
 * Offline = blocked_rooms_count + out_of_service_rooms_count from daily_metrics_snapshots.
 * Vacant = capacity − sum(occupied service breakdown) − offline.
 */
async function getWeeklyUnitPacing(hotelId, weekStarts) {
  if (!weekStarts || weekStarts.length === 0) return [];

  const earliest = weekStarts[0];
  const lastWeek = weekStarts[weekStarts.length - 1];
  const latestEnd = new Date(lastWeek);
  latestEnd.setUTCDate(latestEnd.getUTCDate() + 6);
  const latestEndStr = latestEnd.toISOString().slice(0, 10);

  // Active reservations overlapping any week in window
  const { rows } = await pgPool.query(
    `SELECT
        check_in::text AS check_in,
        check_out::text AS check_out,
        nights,
        status
      FROM reservations
      WHERE hotel_id = $1
        AND check_in <= $3::date
        AND check_out >= $2::date
        AND status NOT ILIKE '%cancel%'`,
    [hotelId, earliest, latestEndStr],
  );

  // Daily snapshots for Offline + capacity per week
  const { rows: snaps } = await pgPool.query(
    `SELECT stay_date::text AS stay_date,
            blocked_rooms_count, out_of_service_rooms_count,
            capacity_count
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1
        AND stay_date BETWEEN $2 AND $3`,
    [hotelId, earliest, latestEndStr],
  );
  const snapByDate = new Map(snaps.map((s) => [s.stay_date, s]));

  const result = weekStarts.map((ws) => {
    const wsDate = new Date(ws + "T00:00:00Z");
    const weDate = new Date(wsDate);
    weDate.setUTCDate(wsDate.getUTCDate() + 6);

    let ssDays = 0, msDays = 0, lsDays = 0, offlineDays = 0, capacityDays = 0;
    for (let d = new Date(wsDate); d <= weDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const snap = snapByDate.get(ds);
      if (snap) {
        offlineDays += (snap.blocked_rooms_count || 0) + (snap.out_of_service_rooms_count || 0);
        capacityDays += (snap.capacity_count || 0);
      }
    }

    for (const r of rows) {
      const ci = new Date(r.check_in + "T00:00:00Z");
      const co = new Date(r.check_out + "T00:00:00Z");
      const overlapStart = ci > wsDate ? ci : wsDate;
      const overlapEnd = co < new Date(weDate.getTime() + 86400000) ? co : new Date(weDate.getTime() + 86400000);
      const overlapDays = Math.max(0, Math.round((overlapEnd - overlapStart) / 86400000));
      if (overlapDays === 0) continue;
      const n = Number(r.nights) || 0;
      if (n <= 28) ssDays += overlapDays;
      else if (n <= 90) msDays += overlapDays;
      else lsDays += overlapDays;
    }

    const sub = ssDays + msDays + lsDays;
    const vacant = Math.max(0, capacityDays - sub - offlineDays);

    // Convert "room-days" to "average rooms over the week" by dividing by 7
    const div = (x) => x / 7;
    const total = capacityDays / 7 || 1;
    return {
      weekStart: ws,
      shortStay: { rooms: div(ssDays), pct: ssDays / (capacityDays || 1) },
      midStay: { rooms: div(msDays), pct: msDays / (capacityDays || 1) },
      longStay: { rooms: div(lsDays), pct: lsDays / (capacityDays || 1) },
      offline: { rooms: div(offlineDays), pct: offlineDays / (capacityDays || 1) },
      vacant: { rooms: div(vacant), pct: vacant / (capacityDays || 1) },
      capacity: total,
    };
  });

  return result;
}

/**
 * In-house at month-end per service — count of reservations active on the
 * last day of the month, bucketed by stay length.
 */
async function getInHouseAtMonthEnd(hotelId, monthFrom, monthTo) {
  const startDate = startOfMonth(monthFrom);
  const endDate = endOfMonth(monthTo);

  // Iterate months client-side, query reservations once
  const { rows: allRes } = await pgPool.query(
    `SELECT check_in::text AS check_in, check_out::text AS check_out, nights, status
      FROM reservations
      WHERE hotel_id = $1
        AND check_in <= $3::date
        AND check_out >= $2::date
        AND status NOT ILIKE '%cancel%'`,
    [hotelId, startDate, endDate],
  );

  const months = [];
  let cursor = monthFrom;
  while (cursor <= monthTo) {
    months.push(cursor);
    const [y, m] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, 1));
    cursor = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}`;
  }

  return months.map((mk) => {
    const lastDay = endOfMonth(mk);
    let ss = 0, ms = 0, ls = 0;
    for (const r of allRes) {
      if (r.check_in > lastDay || r.check_out < lastDay) continue;
      const n = Number(r.nights) || 0;
      if (n <= 28) ss += 1;
      else if (n <= 90) ms += 1;
      else ls += 1;
    }
    return { monthKey: mk, short: ss, mid: ms, long: ls };
  });
}

/**
 * Per-service budgets for a year. Returns { [monthKey]: { short, mid, long } }
 * with zeroes for missing rows. Caller decides whether to render or hide
 * the Budget column based on whether ANY value is non-zero.
 */
async function getServiceBudgets(hotelId, fyStartYear) {
  // Mason's FY spans 2 calendar years: Apr fyStartYear → Mar (fyStartYear+1).
  // Pull both years, index by mk.
  const { rows } = await pgPool.query(
    `SELECT year, month, service_role, budget_revenue_net
      FROM hotel_service_budgets
      WHERE hotel_id = $1 AND year IN ($2, $3)`,
    [hotelId, fyStartYear, fyStartYear + 1],
  );
  const out = {};
  // Seed FY months: Apr..Dec of fyStartYear, then Jan..Mar of fyStartYear+1
  for (let i = 0; i < 12; i++) {
    const monthN = ((3 + i) % 12) + 1;
    const yearN = i < 9 ? fyStartYear : fyStartYear + 1;
    out[`${yearN}-${pad2(monthN)}`] = { short: 0, mid: 0, long: 0, hasData: false };
  }
  for (const r of rows) {
    const mk = `${r.year}-${pad2(r.month)}`;
    if (!out[mk]) continue;
    out[mk][r.service_role] = Number(r.budget_revenue_net) || 0;
    out[mk].hasData = true;
  }
  return out;
}

/**
 * Direct vs Indirect booking percentages from reservations.source.
 * Mews maps:
 *   Distributor  → Direct (Mews Booking Engine)
 *   Commander    → Direct (manual entry, treat as direct)
 *   ChannelManager → Indirect (any OTA via channel manager)
 *   anything else → Other
 */
async function getDirectShareForMonth(hotelId, monthKey) {
  const start = startOfMonth(monthKey);
  const end = endOfMonth(monthKey);
  const { rows } = await pgPool.query(
    `SELECT source,
            COUNT(*) AS bookings,
            SUM(COALESCE(total_rate, 0)) AS revenue,
            SUM(COALESCE(nights, 0)) AS room_nights
      FROM reservations
      WHERE hotel_id = $1
        AND check_in BETWEEN $2 AND $3
        AND status NOT ILIKE '%cancel%'
      GROUP BY source`,
    [hotelId, start, end],
  );
  let direct = 0, indirect = 0, other = 0, total = 0;
  for (const r of rows) {
    const rev = Number(r.revenue) || 0;
    total += rev;
    const src = (r.source || "").toLowerCase();
    if (src === "distributor" || src === "commander") direct += rev;
    else if (src === "channelmanager") indirect += rev;
    else other += rev;
  }
  if (total === 0) return null;
  return {
    directPct: direct / total,
    indirectPct: indirect / total,
    otherPct: other / total,
    revenueTotal: total,
  };
}

module.exports = {
  ROLES,
  LEAD_TIME_TIERS,
  monthKey,
  shiftYear,
  startOfMonth,
  endOfMonth,
  daysInMonth,
  todayIso,
  getMonthlyKpis,
  getFinalLyKpis,
  computeForecast,
  getDailyOccRows,
  getBookingPulse,
  getLeadTimeTiers,
  getWeeklyUnitPacing,
  getInHouseAtMonthEnd,
  getServiceBudgets,
  getDirectShareForMonth,
};
