const express = require("express");
const router = express.Router();
const pgPool = require("../utils/db");
const { requireUserApi, requireAdminApi } = require("../utils/middleware");
const MetricsService = require("../services/metrics.service");
const MarketService = require("../services/market.service");
const { getBenchmarks } = require("../utils/benchmark.utils");
const {
  calculatePriceIndex,
  calculateMarketDemand,
  getMarketOutlook,
} = require("../utils/market-codex.utils");
const { calculatePacingStatus } = require("../utils/pacing.utils");
const {
  fetchShreejiReportData,
  generateShreejiReport,
} = require("../utils/report.generators");
const { format, subMonths, addMonths, parseISO } = require("date-fns");

// --- DASHBOARD & KPI ENDPOINTS ---

// --- DASHBOARD & KPI ENDPOINTS ---

// 0a. Last Refresh Time
router.get("/metadata/last-refresh", requireUserApi, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT value FROM system_state WHERE key = 'last_successful_refresh'"
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Not found" });
    res.json({ last_successful_run: result.rows[0].value.timestamp });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 0b. Sync Status
router.get(
  "/metadata/sync-status/:propertyId",
  requireUserApi,
  async (req, res) => {
    try {
      const { propertyId } = req.params;
      // Cache busting
      res.set({
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      });

      // Simple check: Does data exist for this hotel?
      const check = await pgPool.query(
        "SELECT 1 FROM daily_metrics_snapshots WHERE hotel_id = $1::integer LIMIT 1",
        [propertyId]
      );
      res.json({ isSyncComplete: check.rows.length > 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to check sync status" });
    }
  }
);

// 1. KPI Summary

router.get("/kpi-summary", requireUserApi, async (req, res) => {
  try {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });
    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // Note: We assume middleware or service handles detailed ACL in a full refactor,
    // but for now we rely on the Service to just fetch data.
    // TODO: Move 'competitorIds' resolution to a helper or Service to clean this up.

    // Quick CompSet Fetch (Inline for now, move to HotelService later)
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    if (competitorIds.length === 0) {
      const catRes = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (catRes.rows[0]?.category) {
        const autoComp = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [catRes.rows[0].category, propertyId]
        );
        competitorIds = autoComp.rows.map((r) => r.hotel_id);
      }
    }

    const data = await MetricsService.getKPISummary(
      propertyId,
      startDate,
      endDate,
      competitorIds
    );
    res.json(data);
  } catch (error) {
    console.error("Error in /kpi-summary:", error);
    res.status(500).json({ error: "Failed to fetch KPI summary" });
  }
});

// 2. Generic Metrics Range (formerly /metrics-from-db)
router.get("/range", requireUserApi, async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  try {
    const { startDate, endDate, granularity, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    const metrics = await MetricsService.getMetricsFromDB(
      propertyId,
      startDate,
      endDate,
      granularity
    );
    res.json({ metrics });
  } catch (error) {
    console.error("Error in /range:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// 3. Competitor Metrics
router.get("/competitors", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, granularity, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // Fetch CompSet (Inline for now)
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    if (competitorIds.length === 0) {
      const catRes = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (catRes.rows[0]?.category) {
        const autoComp = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [catRes.rows[0].category, propertyId]
        );
        competitorIds = autoComp.rows.map((r) => r.hotel_id);
      }
    }

    const data = await MetricsService.getCompetitorMetrics(
      competitorIds,
      startDate,
      endDate,
      granularity
    );
    // Add static source text as per original router
    data.source = "a comp set of local hotels in a similar quality class";
    res.json(data);
  } catch (error) {
    console.error("Error in /competitors:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  }
});

// 4. Market Ranking
router.get("/ranking", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // Fetch CompSet (Inline)
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    if (competitorIds.length === 0) {
      const catRes = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (catRes.rows[0]?.category) {
        const autoComp = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [catRes.rows[0].category, propertyId]
        );
        competitorIds = autoComp.rows.map((r) => r.hotel_id);
      }
    }

    if (competitorIds.length === 0) {
      return res.json({
        occupancy: { rank: 1, total: 1 },
        adr: { rank: 1, total: 1 },
        revpar: { rank: 1, total: 1 },
      });
    }

    const ranks = await MetricsService.getMarketRanking(
      propertyId,
      competitorIds,
      startDate,
      endDate
    );
    const totalHotels = competitorIds.length + 1;

    if (!ranks) {
      return res.json({
        occupancy: { rank: totalHotels, total: totalHotels },
        adr: { rank: totalHotels, total: totalHotels },
        revpar: { rank: totalHotels, total: totalHotels },
      });
    }

    res.json({
      occupancy: {
        rank: parseInt(ranks.occupancy_rank, 10),
        total: totalHotels,
      },
      adr: { rank: parseInt(ranks.adr_rank, 10), total: totalHotels },
      revpar: { rank: parseInt(ranks.revpar_rank, 10), total: totalHotels },
    });
  } catch (error) {
    console.error("Error in /ranking:", error);
    res.status(500).json({ error: "Failed to fetch market ranking." });
  }
});

// 5. Dashboard Chart
router.get("/chart", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, propertyId, granularity = "daily" } = req.query;
    if (!propertyId || !startDate || !endDate)
      return res
        .status(400)
        .json({ error: "propertyId, startDate, and endDate are required." });

    // Fetch CompSet (Inline)
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    if (competitorIds.length === 0) {
      const catRes = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (catRes.rows[0]?.category) {
        const autoComp = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [catRes.rows[0].category, propertyId]
        );
        competitorIds = autoComp.rows.map((r) => r.hotel_id);
      }
    }

    const data = await MetricsService.getDashboardChart(
      propertyId,
      competitorIds,
      startDate,
      endDate,
      granularity
    );
    res.json(data);
  } catch (error) {
    console.error("Error in /chart:", error);
    res.status(500).json({ error: "Failed to fetch dashboard chart data." });
  }
});

// 6. Dashboard Summary V2 (The Big One)
router.get("/summary", requireUserApi, async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  const { propertyId, city } = req.query;
  if (!propertyId || !city)
    return res.status(400).json({ error: "propertyId and city are required." });

  try {
    const today = new Date();
    const lastMonthDate = subMonths(today, 1);
    const nextMonthDate = addMonths(today, 1);
    const citySlug = city.toLowerCase();
    const currentYear = today.getFullYear();
    const lastYear = currentYear - 1;

    // CompSet (Inline)
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    if (competitorIds.length === 0) {
      const catRes = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (catRes.rows[0]?.category) {
        const autoComp = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [catRes.rows[0].category, propertyId]
        );
        competitorIds = autoComp.rows.map((r) => r.hotel_id);
      }
    }

    // [FIX] Removed raw SQL. Delegating to Service.

    const budgetSql = `
      SELECT budget_year, month, target_revenue_gross
      FROM hotel_budgets
      WHERE hotel_id = $1 AND (
          (budget_year = EXTRACT(YEAR FROM (CURRENT_DATE - INTERVAL '1 month'))::int AND month = EXTRACT(MONTH FROM (CURRENT_DATE - INTERVAL '1 month'))::int) OR
          (budget_year = EXTRACT(YEAR FROM CURRENT_DATE)::int AND month = EXTRACT(MONTH FROM CURRENT_DATE)::int) OR
          (budget_year = EXTRACT(YEAR FROM (CURRENT_DATE + INTERVAL '1 month'))::int AND month = EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::int)
      );
    `;

    const [
      snapshotRows,
      marketOutlook,
      forwardDemandResult,
      rankingRow,
      benchmarkLast,
      benchmarkCurrent,
      benchmarkNext,
      budgetResult,
      ytdTrendRows,
      physicalUnsoldRemaining,
      pickupRows,
    ] = await Promise.all([
      MetricsService.getDashboardSnapshot(propertyId),
      MarketService.getMarketOutlook(citySlug), // [FIX] Use MarketService
      MarketService.getForwardView(citySlug), // [FIX] Use MarketService
      MetricsService.getMarketRanking(
        propertyId,
        competitorIds,
        format(subMonths(today, 1), "yyyy-MM-dd"),
        format(today, "yyyy-MM-dd")
      ), // Ranking is roughly last month/current
      getBenchmarks(
        propertyId,
        format(lastMonthDate, "MMM"),
        format(lastMonthDate, "yyyy")
      ),
      getBenchmarks(propertyId, format(today, "MMM"), format(today, "yyyy")),
      getBenchmarks(
        propertyId,
        format(nextMonthDate, "MMM"),
        format(nextMonthDate, "yyyy")
      ),
      pgPool.query(budgetSql, [propertyId]),
      MetricsService.getYearOnYearMetrics(propertyId, lastYear, currentYear), // Reuse YTD Logic
      MetricsService.getPhysicalUnsold(propertyId),
      MetricsService.getPickupHistory(propertyId),
    ]);

    // --- Processing Logic (Copied from dashboard.router.js) ---

    // Process Budgets
    const budgetMap = new Map();
    budgetResult.rows.forEach((r) => {
      const key = `${r.budget_year}-${r.month.toString().padStart(2, "0")}`;
      budgetMap.set(key, parseFloat(r.target_revenue_gross));
    });

    // Process Pickup
    const pickupMap = new Map();
    pickupRows.forEach((r) =>
      pickupMap.set(r.period, parseInt(r.history_rooms_sold || 0, 10))
    );
    const calcPickup = (liveSold, periodKey) => {
      const historySold = pickupMap.get(periodKey);
      if (historySold === undefined) return null;
      return (liveSold || 0) - historySold;
    };

    // Process Snapshot
    const snapshotData = {};
    snapshotRows.forEach((r) => {
      snapshotData[r.period] = r;
    });
    const formatPeriodKey = (date) => format(date, "yyyy-MM");

    const lastMonth = snapshotData[formatPeriodKey(lastMonthDate)] || {};
    const currentMonth = snapshotData[formatPeriodKey(today)] || {};
    const nextMonth = snapshotData[formatPeriodKey(nextMonthDate)] || {};
    const lastMonthLY =
      snapshotData[formatPeriodKey(subMonths(today, 13))] || {};
    const currentMonthLY =
      snapshotData[formatPeriodKey(subMonths(today, 12))] || {};
    const nextMonthLY =
      snapshotData[formatPeriodKey(subMonths(today, 11))] || {};

    const calcYOY = (current, past) =>
      !current || !past ? 0 : ((current - past) / past) * 100;

    const lastMonthPacing = calculatePacingStatus({
      targetRev: budgetMap.get(formatPeriodKey(lastMonthDate)) || 0,
      actualRev: parseFloat(lastMonth.revenue || 0),
      capacityCount: parseFloat(lastMonth.capacity_count || 0),
      totalSoldRoomNights: parseFloat(lastMonth.total_sold_room_nights || 0),
      benchmarks: benchmarkLast,
      year: lastMonthDate.getFullYear(),
      monthIndex: lastMonthDate.getMonth(),
    });

    const currentMonthPacing = calculatePacingStatus({
      targetRev: budgetMap.get(formatPeriodKey(today)) || 0,
      actualRev: parseFloat(currentMonth.revenue || 0),
      capacityCount: parseFloat(currentMonth.capacity_count || 0),
      totalSoldRoomNights: parseFloat(currentMonth.total_sold_room_nights || 0),
      physicalUnsoldRemaining: physicalUnsoldRemaining,
      benchmarks: benchmarkCurrent,
      year: today.getFullYear(),
      monthIndex: today.getMonth(),
    });

    const nextMonthPacing = calculatePacingStatus({
      targetRev: budgetMap.get(formatPeriodKey(nextMonthDate)) || 0,
      actualRev: parseFloat(nextMonth.revenue || 0),
      capacityCount: parseFloat(nextMonth.capacity_count || 0),
      totalSoldRoomNights: parseFloat(nextMonth.total_sold_room_nights || 0),
      benchmarks: benchmarkNext,
      year: nextMonthDate.getFullYear(),
      monthIndex: nextMonthDate.getMonth(),
    });

    const snapshot = {
      lastMonth: {
        label: format(lastMonthDate, "MMMM '(Final)'"),
        revenue: parseFloat(lastMonth.revenue || 0),
        occupancy: parseFloat(lastMonth.occupancy || 0) * 100,
        adr: parseFloat(lastMonth.adr || 0),
        yoyChange: calcYOY(lastMonth.revenue, lastMonthLY.revenue),
        targetRevenue: budgetMap.get(formatPeriodKey(lastMonthDate)) || null,
        pacingStatus: lastMonthPacing,
      },
      currentMonth: {
        label: format(today, "MMMM '(MTD)'"),
        revenue: parseFloat(currentMonth.revenue || 0),
        occupancy: parseFloat(currentMonth.occupancy || 0) * 100,
        adr: parseFloat(currentMonth.adr || 0),
        yoyChange: calcYOY(currentMonth.revenue, currentMonthLY.revenue),
        targetRevenue: budgetMap.get(formatPeriodKey(today)) || null,
        pacingStatus: currentMonthPacing,
        pickup: calcPickup(
          parseFloat(currentMonth.total_sold_room_nights),
          formatPeriodKey(today)
        ),
      },
      nextMonth: {
        label: format(addMonths(today, 1), "MMMM '(OTB)'"),
        revenue: parseFloat(nextMonth.revenue || 0),
        occupancy: parseFloat(nextMonth.occupancy || 0) * 100,
        adr: parseFloat(nextMonth.adr || 0),
        yoyChange: calcYOY(nextMonth.revenue, nextMonthLY.revenue),
        targetRevenue:
          budgetMap.get(formatPeriodKey(addMonths(today, 1))) || null,
        pacingStatus: nextMonthPacing,
        pickup: calcPickup(
          parseFloat(nextMonth.total_sold_room_nights),
          formatPeriodKey(addMonths(today, 1))
        ),
      },
    };

    // Process Forward Demand
    // [FIX] Service returns already processed rows, no need to recalc
    const processedDemand = forwardDemandResult;
    const forwardDemandChartData = processedDemand.map((row) => ({
      date: format(parseISO(row.checkin_date), "MMM d"),
      marketDemand: row.market_demand_score,
      marketSupply: parseInt(row.total_results, 10),
    }));

    const validPatterns = processedDemand.filter(
      (r) => r.market_demand_score != null
    );
    const sortedByDemandDesc = [...validPatterns].sort(
      (a, b) => b.market_demand_score - a.market_demand_score
    );
    const sortedByDemandAsc = [...validPatterns].sort(
      (a, b) => a.market_demand_score - b.market_demand_score
    );
    const formatPatternRow = (row) => ({
      date: row.checkin_date,
      dayOfWeek: format(parseISO(row.checkin_date), "E"),
      availability: row.market_demand_score,
      supply: parseInt(row.total_results, 10),
    });
    const demandPatterns = {
      busiestDays: sortedByDemandDesc.slice(0, 5).map(formatPatternRow),
      quietestDays: sortedByDemandAsc.slice(0, 5).map(formatPatternRow),
    };

    // Process Ranking
    const totalHotels = competitorIds.length + 1;
    let rankings = {
      occupancy: { rank: "-", total: totalHotels },
      adr: { rank: "-", total: totalHotels },
      revpar: { rank: "-", total: totalHotels },
    };
    if (rankingRow) {
      rankings = {
        occupancy: {
          rank: parseInt(rankingRow.occupancy_rank, 10),
          total: totalHotels,
        },
        adr: { rank: parseInt(rankingRow.adr_rank, 10), total: totalHotels },
        revpar: {
          rank: parseInt(rankingRow.revpar_rank, 10),
          total: totalHotels,
        },
      };
    }

    // Process YTD Trend
    const ytdTrend = [];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const currentMonthIndex = today.getMonth();
    const ytdResultMap = new Map();
    ytdTrendRows.forEach((r) =>
      ytdResultMap.set(parseInt(r.month_number, 10), r)
    );

    for (let i = 0; i <= currentMonthIndex; i++) {
      const monthNum = i + 1;
      const row = ytdResultMap.get(monthNum);
      const isMTD = i === currentMonthIndex;
      let thisYear = 0;
      let lastYear = 0;
      if (row) {
        thisYear = parseFloat(row.y2_revenue);
        lastYear = parseFloat(row.y1_revenue);
      }
      let variance = 0;
      if (lastYear > 0) variance = ((thisYear - lastYear) / lastYear) * 100;
      else if (thisYear > 0) variance = 100;

      ytdTrend.push({
        month: monthNames[i],
        monthIndex: i,
        thisYear,
        lastYear,
        variance,
        isMTD,
      });
    }

    res.json({
      snapshot,
      marketOutlook,
      forwardDemandChartData,
      demandPatterns,
      rankings,
      ytdTrend,
      budgetBenchmark: benchmarkCurrent,
    });
  } catch (err) {
    console.error(`[API /summary] FAILED: propertyId=${propertyId}`, err);
    res.status(500).json({
      error: "Failed to fetch dashboard summary",
      details: err.message,
    });
  }
});

// 7. Daily Pickup (Live vs Snapshot) for Rate Manager
router.get("/pickup", requireUserApi, async (req, res) => {
  try {
    const { propertyId, startDate, endDate, days } = req.query;
    if (!propertyId || !startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "propertyId, startDate, and endDate are required." });
    }

    // Default to 1 day if not provided
    const lookbackDays = parseInt(days || "1", 10);

    // Logic: Find the latest snapshot that is ON or BEFORE (Today - X Days)
    // This handles cases where 'yesterday' might be missing but 'day before' exists.
    const query = `
      WITH target_snapshot AS (
        SELECT snapshot_date as s_date
        FROM pacing_snapshots
        WHERE hotel_id = $1
          AND snapshot_date <= CURRENT_DATE - ($4 || ' days')::interval
        ORDER BY snapshot_date DESC
        LIMIT 1
      )
      SELECT
        TO_CHAR(live.stay_date, 'YYYY-MM-DD') as date,
        (live.rooms_sold - COALESCE(hist.rooms_sold, 0)) AS pickup,
        (SELECT s_date FROM target_snapshot)::text as debug_snapshot_date
      FROM daily_metrics_snapshots live
      LEFT JOIN pacing_snapshots hist
        ON live.hotel_id = hist.hotel_id
        AND live.stay_date = hist.stay_date
        AND hist.snapshot_date = (SELECT s_date FROM target_snapshot)
      WHERE live.hotel_id = $1
        AND live.stay_date BETWEEN $2 AND $3
      ORDER BY live.stay_date ASC;
    `;

    const { rows } = await pgPool.query(query, [
      propertyId,
      startDate,
      endDate,
      lookbackDays,
    ]);
    res.json(rows);
  } catch (error) {
    console.error("Error in /pickup:", error);
    res.status(500).json({ error: "Failed to fetch pickup data" });
  }
});

// --- REPORTING ENDPOINTS ---

// [NEW] Shreeji Report Preview
router.get("/reports/shreeji", requireUserApi, async (req, res) => {
  try {
    const { hotel_id, date } = req.query;
    if (!hotel_id || !date)
      return res.status(400).json({ error: "hotel_id and date are required." });

    const data = await fetchShreejiReportData(hotel_id, date);
    res.json(data);
  } catch (error) {
    console.error("Error fetching Shreeji report data:", error);
    res.status(500).json({ error: "Failed to generate report preview." });
  }
});

// [NEW] Shreeji Report Download
router.get("/reports/shreeji/download", requireUserApi, async (req, res) => {
  try {
    const { hotel_id, date } = req.query;
    if (!hotel_id || !date)
      return res.status(400).json({ error: "hotel_id and date are required." });

    const { pdfBuffer, fileName } = await generateShreejiReport(hotel_id, date);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error downloading Shreeji PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

router.get("/available-years", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "propertyId is required" });
    const years = await MetricsService.getAvailableYears(propertyId);
    res.json(years);
  } catch (error) {
    console.error("Error fetching available years:", error);
    res.status(500).json({ error: "Failed to fetch available years." });
  }
});

router.post("/reports/run", requireUserApi, async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  try {
    const {
      propertyId,
      startDate,
      endDate,
      granularity = "daily",
      metrics,
      includeTaxes = false,
    } = req.body;
    if (!propertyId || !startDate || !endDate || !metrics)
      return res
        .status(400)
        .json({ error: "Missing required report parameters." });

    // Fetch CompSet (Inline)
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    if (competitorIds.length === 0) {
      const catRes = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (catRes.rows[0]?.category) {
        const autoComp = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [catRes.rows[0].category, propertyId]
        );
        competitorIds = autoComp.rows.map((r) => r.hotel_id);
      }
    }

    const data = await MetricsService.runDynamicReport(
      propertyId,
      startDate,
      endDate,
      granularity,
      metrics,
      includeTaxes,
      competitorIds
    );
    res.json(data);
  } catch (error) {
    console.error("Error running performance report:", error);
    res.status(500).json({ error: "Failed to run report." });
  }
});

router.post("/reports/year-on-year", requireUserApi, async (req, res) => {
  res.set({ "Cache-Control": "no-store", Pragma: "no-cache", Expires: "0" });
  try {
    const { propertyId, year1, year2 } = req.body;
    if (!propertyId || !year1 || !year2)
      return res.status(400).json({ error: "Missing required parameters." });

    const rows = await MetricsService.getYearOnYearMetrics(
      propertyId,
      year1,
      year2
    );

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const fullYearData = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1;
      // Use loose comparison (==) to handle string vs number for month_number
      const row = rows.find((r) => r.month_number == monthIndex);

      const safeFloat = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };

      const safeInt = (val) => {
        const num = parseInt(val, 10);
        return isNaN(num) ? 0 : num;
      };

      if (row) {
        return {
          month: monthNames[i],
          year1: {
            occupancy: safeFloat(row.y1_occupancy),
            adr: safeFloat(row.y1_adr),
            revpar: safeFloat(row.y1_revpar),
            revenue: safeFloat(row.y1_revenue),
            roomsSold: safeInt(row.y1_rooms_sold),
          },
          year2: {
            occupancy: safeFloat(row.y2_occupancy),
            adr: safeFloat(row.y2_adr),
            revpar: safeFloat(row.y2_revpar),
            revenue: safeFloat(row.y2_revenue),
            roomsSold: safeInt(row.y2_rooms_sold),
          },
        };
      } else {
        return {
          month: monthNames[i],
          year1: { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 },
          year2: { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 },
        };
      }
    });
    res.json(fullYearData);
  } catch (error) {
    console.error(
      `[API ERROR] Year-on-Year report failed for property ${req.body?.propertyId}:`,
      error
    );
    res
      .status(500)
      .json({ error: "Failed to run report.", details: error.message });
  }
});

// Note: Scheduled report CRUD is left here to avoid stranding it, although conceptually 'configuration'.
router.get("/reports/scheduled", requireUserApi, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(401).json({ error: "User not found" });
    const internalUserId = userResult.rows[0].user_id;

    const { rows } = await pgPool.query(
      `SELECT sr.*, h.property_name FROM scheduled_reports sr LEFT JOIN hotels h ON (CASE WHEN sr.property_id ~ '^[0-9]+$' THEN sr.property_id::int ELSE NULL END) = h.hotel_id WHERE sr.user_id = $1 ORDER BY sr.created_at DESC`,
      [internalUserId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/reports/scheduled", requireUserApi, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(401).json({ error: "User not found" });
    const internalUserId = userResult.rows[0].user_id;

    const {
      propertyId,
      reportName,
      recipients,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      reportType,
      metricsHotel,
      metricsMarket,
      addComparisons,
      displayOrder,
      displayTotals,
      includeTaxes,
      reportPeriod,
      attachmentFormats,
    } = req.body;

    const safeReportType = reportType || "standard";
    const isShreeji = safeReportType === "shreeji";
    const safeMetricsHotel = isShreeji ? [] : metricsHotel;
    const safeMetricsMarket = isShreeji
      ? []
      : Array.isArray(metricsMarket)
      ? metricsMarket
      : [];
    const safeAddComparisons = isShreeji ? false : !!addComparisons;
    const safeDisplayOrder = isShreeji ? "metric" : displayOrder ?? "metric";
    const safeDisplayTotals = isShreeji ? false : displayTotals;
    const safeIncludeTaxes = isShreeji ? false : includeTaxes ?? true;
    const safeReportPeriod = isShreeji ? "daily" : reportPeriod ?? "daily";
    const safeAttachmentFormats = isShreeji ? [] : attachmentFormats ?? [];

    const result = await pgPool.query(
      `INSERT INTO scheduled_reports (user_id, property_id, report_name, recipients, frequency, day_of_week, day_of_month, time_of_day, metrics_hotel, metrics_market, add_comparisons, display_order, display_totals, include_taxes, report_period, attachment_formats, report_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        internalUserId,
        propertyId,
        reportName,
        Array.isArray(recipients) ? recipients.join(",") : recipients,
        frequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
        safeMetricsHotel,
        safeMetricsMarket,
        safeAddComparisons,
        safeDisplayOrder,
        safeDisplayTotals,
        safeIncludeTaxes,
        safeReportPeriod,
        safeAttachmentFormats,
        safeReportType,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/reports/scheduled/:id", requireUserApi, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0)
      return res.status(401).json({ error: "User not found" });
    const internalUserId = userResult.rows[0].user_id;

    const deleteResult = await pgPool.query(
      `DELETE FROM scheduled_reports WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, internalUserId]
    );
    if (deleteResult.rowCount === 0)
      return res.status(404).json({ error: "Scheduled report not found." });
    res.status(200).json({
      message: "Schedule deleted successfully.",
      id: deleteResult.rows[0].id,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete scheduled report." });
  }
});

// --- PORTFOLIO ANALYTICS (ADMIN) ---

router.get(
  "/portfolio/occupancy-problems",
  requireAdminApi,
  async (req, res) => {
    try {
      const { group, hotelId } = req.query;
      const data = await MetricsService.getPortfolioOccupancyProblemList(
        group,
        hotelId
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching portfolio occupancy problem list:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.get("/portfolio/pacing", requireAdminApi, async (req, res) => {
  try {
    const { group, hotelId } = req.query;
    const now = new Date();
    const currentMonthName = format(now, "MMM");
    const currentYear = format(now, "yyyy");

    // 1. Fetch raw data from Service
    const rows = await MetricsService.getPortfolioPacingData(group, hotelId);

    // 2. Post-process (Quadrant Logic)
    const results = await Promise.all(
      rows.map(async (row) => {
        const benchmarkData = await getBenchmarks(
          row.hotel_id,
          currentMonthName,
          currentYear
        );
        const benchmarkAdr = benchmarkData.benchmarkAdr;
        const benchmarkOcc = benchmarkData.benchmarkOcc / 100.0;

        const currentMonthShortfall =
          parseFloat(row.currentMonthTargetRevenue) -
          parseFloat(row.currentMonthOtbRevenue);
        const currentMonthRoomsLeftToSell =
          parseFloat(row.currentMonthPhysicalUnsold) * benchmarkOcc;
        let currentMonthRequiredADR = 0;
        if (currentMonthRoomsLeftToSell > 0 && currentMonthShortfall > 0) {
          currentMonthRequiredADR =
            currentMonthShortfall / currentMonthRoomsLeftToSell;
        } else if (currentMonthShortfall > 0) {
          currentMonthRequiredADR = 99999;
        }

        const nextMonthShortfall =
          parseFloat(row.nextMonthTargetRevenue) -
          parseFloat(row.nextMonthOtbRevenue);
        const nextMonthProjectedRooms =
          parseFloat(row.nextMonthCapacity) * benchmarkOcc;
        const nextMonthRoomsLeftToSell =
          nextMonthProjectedRooms - parseFloat(row.nextMonthOtbRooms);
        let nextMonthRequiredADR = 0;
        if (nextMonthRoomsLeftToSell > 0 && nextMonthShortfall > 0) {
          nextMonthRequiredADR = nextMonthShortfall / nextMonthRoomsLeftToSell;
        } else if (nextMonthShortfall > 0) {
          nextMonthRequiredADR = 99999;
        }

        const pacingDifficultyPercent =
          (benchmarkAdr > 0
            ? currentMonthRequiredADR / benchmarkAdr
            : currentMonthRequiredADR > 0
            ? 999
            : 1) * 100;
        let quadrant, currentMonthStatus;
        if (currentMonthRequiredADR === 99999) currentMonthStatus = "red";
        else if (pacingDifficultyPercent > 115) currentMonthStatus = "red";
        else if (pacingDifficultyPercent > 100) currentMonthStatus = "yellow";
        else currentMonthStatus = "green";

        const fwdOcc = parseFloat(row.forwardOccupancy);
        if (fwdOcc < 60 && currentMonthStatus === "red")
          quadrant = "Critical Risk";
        else if (fwdOcc >= 60 && currentMonthStatus === "red")
          quadrant = "Rate Strategy Risk";
        else if (
          fwdOcc < 60 &&
          (currentMonthStatus === "yellow" || currentMonthStatus === "green")
        )
          quadrant = "Fill Risk";
        else quadrant = "On Pace";

        let nextMonthStatus;
        const nextPacingDifficulty =
          (benchmarkAdr > 0
            ? nextMonthRequiredADR / benchmarkAdr
            : nextMonthRequiredADR > 0
            ? 999
            : 1) * 100;
        if (nextMonthRequiredADR === 99999) nextMonthStatus = "red";
        else if (nextPacingDifficulty > 115) nextMonthStatus = "red";
        else if (nextPacingDifficulty > 100) nextMonthStatus = "yellow";
        else nextMonthStatus = "green";

        return {
          hotelId: row.hotel_id,
          hotelName: row.property_name,
          forwardOccupancy: fwdOcc,
          pacingDifficultyPercent: isNaN(pacingDifficultyPercent)
            ? 100
            : pacingDifficultyPercent,
          quadrant: quadrant,
          currentMonthStatus,
          currentMonthShortfall,
          currentMonthRequiredADR,
          nextMonthStatus,
          nextMonthShortfall,
          nextMonthRequiredADR,
        };
      })
    );

    res.json(results);
  } catch (error) {
    console.error("Error fetching portfolio pacing overview:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/portfolio/matrix", requireAdminApi, async (req, res) => {
  try {
    const { group, hotelId } = req.query;
    const rows = await MetricsService.getPortfolioOccupancyMatrix(
      group,
      hotelId
    );

    // Post-process nested structure
    const hotelsMap = new Map();
    for (const row of rows) {
      if (!hotelsMap.has(row.hotel_id)) {
        hotelsMap.set(row.hotel_id, {
          id: row.hotel_id,
          name: row.property_name,
          city: row.city,
          group: row.group,
          totalRooms: row.total_rooms,
          occupancy: 0,
          riskLevel: "low",
          matrixData: [],
        });
      }
      const hotel = hotelsMap.get(row.hotel_id);
      hotel.matrixData.push({
        day: row.stay_date,
        occupancy: parseFloat(row.occupancy || 0),
        adr: parseFloat(row.adr || 0),
        available: row.capacity_count - row.rooms_sold,
      });
    }

    for (const hotel of hotelsMap.values()) {
      const first30Days = hotel.matrixData.slice(0, 30);
      if (first30Days.length > 0) {
        const avgOcc =
          first30Days.reduce((sum, day) => sum + day.occupancy, 0) /
          first30Days.length;
        hotel.occupancy = avgOcc;
        if (avgOcc < 45) hotel.riskLevel = "critical";
        else if (avgOcc < 60) hotel.riskLevel = "moderate";
        else hotel.riskLevel = "low";
      }
    }
    res.json(Array.from(hotelsMap.values()));
  } catch (error) {
    console.error("Error fetching portfolio occupancy matrix:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/portfolio/flowcast", requireAdminApi, async (req, res) => {
  try {
    const { group, hotelId } = req.query;
    const rows = await MetricsService.getPortfolioFlowcast(group, hotelId);

    const hotelsMap = new Map();

    for (const row of rows) {
      if (!hotelsMap.has(row.hotel_id)) {
        hotelsMap.set(row.hotel_id, {
          id: row.hotel_id,
          name: row.property_name,
          data: [],
        });
      }

      const hotel = hotelsMap.get(row.hotel_id);
      const roomsSold = parseInt(row.rooms_sold, 10);
      const capacity = parseInt(row.capacity_count, 10);
      const sold1d = parseInt(row.rooms_sold_1d_ago, 10);
      const sold2d = parseInt(row.rooms_sold_2d_ago, 10);

      // Avoid divide by zero
      const occupancy = capacity > 0 ? (roomsSold / capacity) * 100 : 0;

      // [FIX] Pickup Logic:
      // If sold1d is 0, it likely means the snapshot is missing, not that we had 0 rooms sold yesterday.
      // In that case, we set pickup to 0 to avoid massive false spikes.
      const pickup24hRaw = sold1d > 0 ? roomsSold - sold1d : 0;
      const pickup48hRaw = sold2d > 0 ? roomsSold - sold2d : 0;

      const pickup24h = capacity > 0 ? (pickup24hRaw / capacity) * 100 : 0;
      const pickup48h = capacity > 0 ? (pickup48hRaw / capacity) * 100 : 0;

      hotel.data.push({
        date: row.stay_date,
        occupancy,
        roomsSold, // [NEW] Pass raw numbers for correct header math
        capacity, // [NEW] Pass raw numbers for correct header math
        pickup24h,
        pickup48h,
        sentinelRate: parseFloat(row.sentinel_rate || 0),
      });
    }

    res.json(Array.from(hotelsMap.values()));
  } catch (error) {
    console.error("Error fetching portfolio flowcast:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
