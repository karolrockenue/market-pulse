// api/routes/market.router.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// --- NEW TRENDS ENDPOINT ---
// --- NEW TRENDS ENDPOINT ---
router.get("/trends", requireUserApi, async (req, res) => {
  try {
    // --- 1. Get and Validate Filters from Frontend ---
    const { city, years } = req.query;
    const tierArray = req.query.tiers
      ? Array.isArray(req.query.tiers)
        ? req.query.tiers
        : [req.query.tiers]
      : null;

    if (!city || !years) {
      return res.status(400).json({ error: "City and years are required." });
    }

    // --- 2. Calculate Date Range from Years ---
    const yearArray = Array.isArray(years) ? years : [years];
    const minYear = Math.min(...yearArray.map((y) => parseInt(y)));
    const maxYear = Math.max(...yearArray.map((y) => parseInt(y)));
    const startDate = new Date(Date.UTC(minYear, 0, 1));
    const endDate = new Date(Date.UTC(maxYear, 11, 31));
    const totalDaysInPeriod =
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;

    // --- 3. Build the "Smart" SQL Query ---
    let queryParams = [city, startDate, endDate, totalDaysInPeriod];
    let tierFilterSql = "";

    if (tierArray && tierArray.length > 0) {
      queryParams.push(tierArray);
      tierFilterSql = `AND category = ANY($${queryParams.length}::text[])`;
    }

    const query = `
            WITH HotelsWithCompleteHistory AS (
                SELECT h.hotel_id
                FROM hotels h
                JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
                WHERE h.city = $1
                  ${tierFilterSql}
                  AND dms.stay_date >= $2 AND dms.stay_date <= $3
                GROUP BY h.hotel_id
                HAVING COUNT(DISTINCT dms.stay_date::date) >= $4
            )
            SELECT
                date_trunc('month', dms.stay_date) as period,
                h.category,
                AVG(dms.occupancy_direct) as occupancy,
                -- THE FIX: Use the new gross columns for consistency
                AVG(dms.gross_adr) as adr,
                AVG(dms.gross_revpar) as revpar
            FROM daily_metrics_snapshots dms
            JOIN hotels h ON dms.hotel_id = h.hotel_id
            WHERE dms.hotel_id IN (SELECT hotel_id FROM HotelsWithCompleteHistory)
              AND dms.stay_date >= $2 AND dms.stay_date <= $3
            GROUP BY period, h.category
            ORDER BY period, h.category ASC;
        `;

    // --- 4. Execute the Query and Return Data ---
    const result = await pgPool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/market/trends:", error);
    res.status(500).json({ error: "Failed to fetch market trends." });
  }
});
// --- NEW KPI ENDPOINT ---
// This endpoint calculates the rolling 365-day KPIs for a given city vs. the prior year.
// --- NEW KPI ENDPOINT ---
router.get("/kpis", requireUserApi, async (req, res) => {
  const { city } = req.query;
  if (!city) {
    return res.status(400).json({ error: "City is a required parameter." });
  }

  const today = new Date();
  const endDateCurrent = new Date(today);
  const startDateCurrent = new Date(new Date().setDate(today.getDate() - 364));
  const endDatePrior = new Date(new Date().setDate(today.getDate() - 365));
  const startDatePrior = new Date(new Date().setDate(today.getDate() - 729));

  const query = `
    WITH ValidatedHotels AS (
        SELECT hotel_id
        FROM hotels
        WHERE city = $1
          AND go_live_date IS NOT NULL
          AND go_live_date <= $4
    ),
    CurrentPeriodMetrics AS (
        SELECT
            -- THE FIX: Use the new gross columns
            AVG(gross_adr) as current_adr,
            AVG(occupancy_direct) as current_occupancy,
            AVG(gross_revpar) as current_revpar
        FROM daily_metrics_snapshots
        WHERE hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
          AND stay_date BETWEEN $2 AND $3
    ),
    PriorPeriodMetrics AS (
        SELECT
            -- THE FIX: Use the new gross columns
            AVG(gross_adr) as prior_adr,
            AVG(occupancy_direct) as prior_occupancy,
            AVG(gross_revpar) as prior_revpar
        FROM daily_metrics_snapshots
        WHERE hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
          AND stay_date BETWEEN $4 AND $5
    )
    SELECT cp.*, pp.*
    FROM CurrentPeriodMetrics cp, PriorPeriodMetrics pp;
  `;

  try {
    const result = await pgPool.query(query, [
      city,
      startDateCurrent,
      endDateCurrent,
      startDatePrior,
      endDatePrior,
    ]);
    if (result.rows.length === 0) {
      return res.json({
        current_adr: 0,
        current_occupancy: 0,
        current_revpar: 0,
        prior_adr: 0,
        prior_occupancy: 0,
        prior_revpar: 0,
      });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error in /api/market/kpis:", error);
    res.status(500).json({ error: "Failed to fetch market KPIs." });
  }
});

// --- NEW NEIGHBORHOODS ENDPOINT ---
// This endpoint aggregates key metrics for all neighborhoods within a given city.
// --- NEW NEIGHBORHOODS ENDPOINT ---
router.get("/neighborhoods", requireUserApi, async (req, res) => {
  const { city } = req.query;
  if (!city) {
    return res.status(400).json({ error: "City is a required parameter." });
  }

  const endDateCurrent = new Date();
  const startDateCurrent = new Date(
    new Date().setDate(endDateCurrent.getDate() - 364)
  );
  const endDatePrior = new Date(
    new Date().setDate(endDateCurrent.getDate() - 365)
  );
  const startDatePrior = new Date(
    new Date().setDate(endDateCurrent.getDate() - 729)
  );

  const query = `
    WITH DateRanges AS (
        SELECT $2::date AS current_start, $3::date AS current_end,
               $4::date AS prior_start, $5::date AS prior_end
    ),
    NeighborhoodMetricsCurrent AS (
        SELECT
            h.neighborhood,
            COUNT(DISTINCT h.hotel_id) as hotel_count,
            -- THE FIX: Use the new gross columns
            AVG(dms.gross_revpar) AS revpar,
            AVG(dms.gross_adr) AS adr,
            AVG(dms.occupancy_direct) AS occupancy
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges
        WHERE h.city = $1 AND h.go_live_date IS NOT NULL
          AND h.go_live_date <= DateRanges.current_start
          AND dms.stay_date BETWEEN DateRanges.current_start AND DateRanges.current_end
        GROUP BY h.neighborhood
    ),
    NeighborhoodMetricsPrior AS (
        SELECT
            h.neighborhood,
            -- THE FIX: Use the new gross_revpar column
            AVG(dms.gross_revpar) AS prior_revpar
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges
        WHERE h.city = $1 AND h.go_live_date IS NOT NULL
          AND h.go_live_date <= DateRanges.prior_start
          AND dms.stay_date BETWEEN DateRanges.prior_start AND DateRanges.prior_end
        GROUP BY h.neighborhood
    )
    SELECT
        nmc.neighborhood AS name, nmc.revpar, nmc.adr, nmc.occupancy, nmc.hotel_count,
        CASE
            WHEN nmp.prior_revpar > 0 THEN (nmc.revpar - nmp.prior_revpar) / nmp.prior_revpar * 100
            ELSE NULL
        END AS yoy
    FROM NeighborhoodMetricsCurrent nmc
    LEFT JOIN NeighborhoodMetricsPrior nmp ON nmc.neighborhood = nmp.neighborhood
    WHERE nmc.neighborhood IS NOT NULL
    ORDER BY nmc.revpar DESC;
  `;

  try {
    const result = await pgPool.query(query, [
      city,
      startDateCurrent,
      endDateCurrent,
      startDatePrior,
      endDatePrior,
    ]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/market/neighborhoods:", error);
    res.status(500).json({ error: "Failed to fetch neighborhood data." });
  }
});

// --- NEW AVAILABLE YEARS ENDPOINT ---
// This endpoint finds which years have complete data for a seasonality analysis.
router.get("/available-seasonality-years", requireUserApi, async (req, res) => {
  const { city } = req.query;
  if (!city) {
    return res.status(400).json({ error: "City is a required parameter." });
  }

  const query = `
    -- For each year, check if there is at least one hotel that was live
    -- for the entirety of that year.
    SELECT DISTINCT EXTRACT(YEAR FROM s.yr)::integer AS year
    FROM generate_series(
      '2022-01-01'::date,
      (CURRENT_DATE - INTERVAL '1 year'),
      '1 year'
    ) AS s(yr)
    WHERE EXISTS (
      SELECT 1
      FROM hotels h
      WHERE h.city = $1
        AND h.go_live_date IS NOT NULL
        -- The hotel must have been live on or before the first day of the year.
        AND h.go_live_date <= s.yr
    )
    ORDER BY year DESC;
  `;

  try {
    const result = await pgPool.query(query, [city]);
    // Return a simple array of years, e.g., [2024, 2023]
    res.json(result.rows.map((row) => row.year));
  } catch (error) {
    console.error("Error in /api/market/available-seasonality-years:", error);
    res.status(500).json({ error: "Failed to fetch available years." });
  }
});

// --- NEW SEASONALITY DATA ENDPOINT ---
// This endpoint provides the daily RevPAR data for the heatmap chart.
// --- NEW SEASONALITY DATA ENDPOINT ---
router.get("/seasonality", requireUserApi, async (req, res) => {
  const { city, year } = req.query;
  if (!city || !year) {
    return res.status(400).json({ error: "City and year are required." });
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const query = `
        WITH ValidatedHotels AS (
            SELECT hotel_id
            FROM hotels
            WHERE city = $1
              AND go_live_date IS NOT NULL
              AND go_live_date <= $2::date
        )
        SELECT
            stay_date::date AS date,
            -- THE FIX: Use the new gross_revpar column
            AVG(gross_revpar) AS value
        FROM daily_metrics_snapshots
        WHERE hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
          AND stay_date BETWEEN $2 AND $3
        GROUP BY stay_date
        ORDER BY stay_date ASC;
    `;

  try {
    const result = await pgPool.query(query, [city, startDate, endDate]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/market/seasonality:", error);
    res.status(500).json({ error: "Failed to fetch seasonality data." });
  }
});
module.exports = router;
