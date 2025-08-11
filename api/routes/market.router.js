// api/routes/market.router.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// --- NEW TRENDS ENDPOINT ---
router.get("/trends", requireUserApi, async (req, res) => {
  try {
    // --- 1. Get and Validate Filters from Frontend ---
    const { city, years } = req.query;
    // The 'tiers' filter is optional.
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
    // Calculate the total number of days required for a complete history.
    const totalDaysInPeriod =
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;

    // --- 3. Build the "Smart" SQL Query ---
    let queryParams = [city, startDate, endDate, totalDaysInPeriod];
    let tierFilterSql = "";

    // If 'tiers' were provided, add a clause to the query to filter by them.
    if (tierArray && tierArray.length > 0) {
      queryParams.push(tierArray);
      tierFilterSql = `AND category = ANY($${queryParams.length}::text[])`;
    }

    const query = `
            WITH HotelsWithCompleteHistory AS (
                -- Step 1: Find the IDs of hotels that have a complete data history for the period
                -- while also matching the city and optional tier filters.
                SELECT h.hotel_id
                FROM hotels h
                JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
                WHERE h.city = $1
                  ${tierFilterSql} -- Optional tier filter is applied here
                  AND dms.stay_date >= $2 AND dms.stay_date <= $3
                GROUP BY h.hotel_id
                HAVING COUNT(DISTINCT dms.stay_date::date) >= $4
            )
            -- Step 2: Now aggregate the data for each month and category,
            -- but ONLY using the hotels we validated in the CTE above.
            SELECT
                date_trunc('month', dms.stay_date) as period,
                h.category, -- Get category from the main hotels table
                AVG(dms.occupancy_direct) as occupancy,
                AVG(dms.adr) as adr,
                AVG(dms.revpar) as revpar
            FROM daily_metrics_snapshots dms
            -- Join hotels table to get the category
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
router.get("/kpis", requireUserApi, async (req, res) => {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "City is a required parameter." });
  }

  // Define the two date periods we need to compare.
  const today = new Date();
  const endDateCurrent = new Date(today);
  const startDateCurrent = new Date(new Date().setDate(today.getDate() - 364));
  const endDatePrior = new Date(new Date().setDate(today.getDate() - 365));
  const startDatePrior = new Date(new Date().setDate(today.getDate() - 729));

  const query = `
    WITH ValidatedHotels AS (
        -- Step 1: Find all hotels in the city that have a go_live_date
        -- and ensure that date is early enough for them to have a full prior-year history.
        SELECT hotel_id
        FROM hotels
        WHERE city = $1
          AND go_live_date IS NOT NULL
          AND go_live_date <= $4 -- ($4 is the start date of the prior period)
    ),
    CurrentPeriodMetrics AS (
        -- Step 2: Calculate metrics for the CURRENT period using only the validated hotels.
        SELECT
            AVG(adr) as current_adr,
            AVG(occupancy_direct) as current_occupancy,
            AVG(revpar) as current_revpar
        FROM daily_metrics_snapshots
        WHERE hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
          AND stay_date BETWEEN $2 AND $3
    ),
    PriorPeriodMetrics AS (
        -- Step 3: Calculate metrics for the PRIOR period for the same hotels.
        SELECT
            AVG(adr) as prior_adr,
            AVG(occupancy_direct) as prior_occupancy,
            AVG(revpar) as prior_revpar
        FROM daily_metrics_snapshots
        WHERE hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
          AND stay_date BETWEEN $4 AND $5
    )
    -- Step 4: Combine the two sets of metrics into a single result.
    SELECT
        cp.*,
        pp.*
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
router.get("/neighborhoods", requireUserApi, async (req, res) => {
  const { city } = req.query;
  if (!city) {
    return res.status(400).json({ error: "City is a required parameter." });
  }

  // Define the date ranges for the query.
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
        -- Define our two comparison periods
        SELECT
            $2::date AS current_start,
            $3::date AS current_end,
            $4::date AS prior_start,
            $5::date AS prior_end
    ),
    NeighborhoodMetricsCurrent AS (
        -- Step 1: Get current metrics for ALL neighborhoods with hotels live for at least the past year.
        SELECT
            h.neighborhood,
            COUNT(DISTINCT h.hotel_id) as hotel_count,
            AVG(dms.revpar) AS revpar,
            AVG(dms.adr) AS adr,
            AVG(dms.occupancy_direct) AS occupancy
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges
        WHERE h.city = $1
          AND h.go_live_date IS NOT NULL
          AND h.go_live_date <= DateRanges.current_start -- Ensure hotel was live for the whole current period
          AND dms.stay_date BETWEEN DateRanges.current_start AND DateRanges.current_end
        GROUP BY h.neighborhood
    ),
    NeighborhoodMetricsPrior AS (
        -- Step 2: Get prior year RevPAR ONLY for neighborhoods with hotels live for the full two-year period.
        SELECT
            h.neighborhood,
            AVG(dms.revpar) AS prior_revpar
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges
        WHERE h.city = $1
          AND h.go_live_date IS NOT NULL
          AND h.go_live_date <= DateRanges.prior_start -- Stricter check for prior-year data
          AND dms.stay_date BETWEEN DateRanges.prior_start AND DateRanges.prior_end
        GROUP BY h.neighborhood
    )
    -- Final SELECT: Join current data with prior data, calculating YoY only where possible.
    SELECT
        nmc.neighborhood AS name,
        nmc.revpar,
        nmc.adr,
        nmc.occupancy,
        nmc.hotel_count,
        -- If prior_revpar exists, calculate YoY. Otherwise, return NULL.
        CASE
            WHEN nmp.prior_revpar > 0 THEN (nmc.revpar - nmp.prior_revpar) / nmp.prior_revpar * 100
            ELSE NULL
        END AS yoy
    FROM NeighborhoodMetricsCurrent nmc
    -- A LEFT JOIN ensures we keep all neighborhoods from the current period, even if they have no prior data.
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
router.get("/seasonality", requireUserApi, async (req, res) => {
  const { city, year } = req.query;
  if (!city || !year) {
    return res.status(400).json({ error: "City and year are required." });
  }

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const query = `
        WITH ValidatedHotels AS (
            -- First, find all hotels in the city that were live for the ENTIRE requested year.
            SELECT hotel_id
            FROM hotels
            WHERE city = $1
              AND go_live_date IS NOT NULL
              AND go_live_date <= $2::date -- ($2 is the start date of the year)
        )
        -- Now, get the average daily RevPAR across those hotels for every day of the year.
        SELECT
            stay_date::date AS date,
            AVG(revpar) AS value
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
