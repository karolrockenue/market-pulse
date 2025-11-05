const express = require('express');
const router = express.Router();
const pool = require('../utils/db'); // Shared DB connection
const { requireUserApi } = require('../utils/middleware'); // Auth middleware
const {
  calculatePriceIndex,
  calculateMarketDemand,
  calculatePace,
} = require('../utils/market-codex.utils'); // The "Logic Hub"

// --- Apply user authentication to all routes in this file ---
router.use(requireUserApi);
router.get('/forward-view', async (req, res) => {
  // --- [FIX 1] ---
  // Use the 'city' query parameter sent from DemandPace.tsx.
  // We fall back to 'london' just in case.
  const citySlugFromQuery = req.query.city;
  const citySlug = citySlugFromQuery || 'london';



  try {
    // 1. SQL Query: Get the *latest full scrape* for the next 90 days.
// 1. SQL Query: Get the 90-day forward view.
    // [FIX] The logic is changed to find the *latest scrape for each check-in date*.
    // This is much more resilient and handles incomplete or staggered scrapes.
    const sql = `
      SELECT DISTINCT ON (checkin_date)
        checkin_date,
        total_results,
        weighted_avg_price, -- Pre-calculated by migration
        hotel_count         -- Pre-calculated by migration
      FROM market_availability_snapshots
      WHERE
        LOWER(city_slug) = LOWER($1)
        AND checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY
        checkin_date ASC, -- For each unique checkin_date...
        scraped_at DESC;  -- ...pick the one with the LATEST (DESC) scrape time.
    `;

 
    const { rows } = await pool.query(sql, [citySlug]);



    let processedRows = calculatePriceIndex(rows); // Adds 'mpss'
    processedRows = calculateMarketDemand(processedRows); // Adds 'market_demand_score'



    // 3. Respond: Send the final, processed JSON
    res.json(processedRows);
  } catch (err) {
    console.error('Error fetching /planning/forward-view:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
/*
 * GET /api/planning/market-trend
 * Calculates the "Market Outlook" using the correct "rolling forecast"
 * methodology.
 */
router.get('/market-trend', async (req, res) => {
  const city = req.query.city || 'london';

  // This query is now fully dynamic AND uses the correct "rolling forecast" logic.
  const query = `
    WITH DateRange AS (
      -- 1. Find the min/max dates of available scrape data
      SELECT
        MIN((scraped_at AT TIME ZONE 'UTC')::date) AS start_date,
        MAX((scraped_at AT TIME ZONE 'UTC')::date) AS end_date
      FROM market_availability_snapshots
      WHERE city_slug = $1
    ),
    Config AS (
      -- 2. Cap the total window at 30 days and get the half-window
      SELECT
        end_date,
        -- Cap at 30 days, or use available days if less
        LEAST((end_date - start_date + 1), 30) AS total_window_days
      FROM DateRange
    ),
    Periods AS (
      -- 3. Define the two periods to compare based on the half-window
      SELECT
        FLOOR(total_window_days / 2) AS half_window_days,
        end_date AS recent_period_end,
        (end_date - (FLOOR(total_window_days / 2) - 1) * INTERVAL '1 day') AS recent_period_start,
        (end_date - FLOOR(total_window_days / 2) * INTERVAL '1 day') AS past_period_end,
        (end_date - (FLOOR(total_window_days / 2) * 2 - 1) * INTERVAL '1 day') AS past_period_start
      FROM Config
    ),
    -- 4. [NEW] Calculate the "Past" outlook using the correct rolling 30-day forecast logic
    Past_Forecast_Snapshots AS (
      SELECT
        AVG(total_results) AS avg_30day_supply,
        AVG(weighted_avg_price) AS avg_30day_wap
      FROM market_availability_snapshots, Periods p
      WHERE
        city_slug = $1
        AND (scraped_at AT TIME ZONE 'UTC')::date BETWEEN p.past_period_start AND p.past_period_end
        -- Only look at the next 30 days for each scrape
        AND checkin_date BETWEEN (scraped_at AT TIME ZONE 'UTC')::date AND ((scraped_at AT TIME ZONE 'UTC')::date + INTERVAL '29 days')
      GROUP BY
        (scraped_at AT TIME ZONE 'UTC')::date
    ),
    Past_Outlook AS (
      -- 5. [NEW] Average the daily forecasts from the "Past" period
      SELECT
        AVG(avg_30day_supply) AS past_supply,
        AVG(avg_30day_wap) AS past_wap
      FROM Past_Forecast_Snapshots
    ),
    -- 6. [NEW] Calculate the "Recent" outlook
    Recent_Forecast_Snapshots AS (
      SELECT
        AVG(total_results) AS avg_30day_supply,
        AVG(weighted_avg_price) AS avg_30day_wap
      FROM market_availability_snapshots, Periods p
      WHERE
        city_slug = $1
        AND (scraped_at AT TIME ZONE 'UTC')::date BETWEEN p.recent_period_start AND p.recent_period_end
        AND checkin_date BETWEEN (scraped_at AT TIME ZONE 'UTC')::date AND ((scraped_at AT TIME ZONE 'UTC')::date + INTERVAL '29 days')
      GROUP BY
        (scraped_at AT TIME ZONE 'UTC')::date
    ),
    Recent_Outlook AS (
      -- 7. [NEW] Average the daily forecasts from the "Recent" period
      SELECT
        AVG(avg_30day_supply) AS recent_supply,
        AVG(avg_30day_wap) AS recent_wap
      FROM Recent_Forecast_Snapshots
    )
    -- 8. Final Select: Combine all results
    SELECT
      p.half_window_days,
      po.past_supply,
      po.past_wap,
      ro.recent_supply,
      ro.recent_wap
    FROM
      Periods p,
      Past_Outlook po,
      Recent_Outlook ro;
  `;

  try {
    const { rows } = await pool.query(query, [city.toLowerCase()]);

    if (!rows.length || !rows[0].recent_supply) {
      // Not enough data to compare
      return res.json({
        status: 'stable',
        metric: 'Data Populating',
        period: '',
      });
    }

    const data = rows[0];
    const pastSupply = parseFloat(data.past_supply);
    const recentSupply = parseFloat(data.recent_supply);
    const pastWap = parseFloat(data.past_wap);
    const recentWap = parseFloat(data.recent_wap);

    const supplyDelta = ((recentSupply - pastSupply) / pastSupply) * 100;
    const wapDelta = ((recentWap - pastWap) / pastWap) * 100;
    
// Per the changelog, Market Demand is the inverse of Supply change
    const marketDemandDelta = -supplyDelta; 

    let status = 'stable';
    let metric = '';
    let metric_name = 'market demand'; // Default to market demand

    // 1. Primary check: Market Demand (Supply Change)
    if (marketDemandDelta > 1) { // e.g., Supply *dropped* > 1%
      status = 'strengthening';
      metric = `+${marketDemandDelta.toFixed(1)}%`;
      metric_name = 'market demand';
    } else if (marketDemandDelta < -1) { // e.g., Supply *rose* > 1%
      status = 'softening';
      metric = `${marketDemandDelta.toFixed(1)}%`;
      metric_name = 'market demand';
    }
    // 2. Secondary check: Price (if Demand is stable)
    else if (wapDelta > 1) {
      status = 'strengthening';
      metric = `+${wapDelta.toFixed(1)}%`;
      metric_name = 'market price'; // Set to market price
    } else if (wapDelta < -1) {
      status = 'softening';
      metric = `${wapDelta.toFixed(1)}%`;
      metric_name = 'market price'; // Set to market price
    }
    // 3. Both are stable: Default to showing the Market Demand delta
    else {
      status = 'stable';
      metric = `${marketDemandDelta > 0 ? '+' : ''}${marketDemandDelta.toFixed(1)}%`;
      metric_name = 'market demand';
    }

    res.json({
      status,
      metric,

      // Include debug info for verification
      debug: {
        marketDemandDelta,
        supplyDelta,
        wapDelta,
        half_window_days: data.half_window_days,
        pastWap,
        recentWap,
        pastSupply,
        recentSupply,
      },
    });
  } catch (err) {
    console.error('Error in /api/planning/market-trend:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * == Endpoint 2: GET /api/planning/pace?period=7 ==
 *
 * Fetches the 90-day pace data by comparing the latest scrape
 * to a scrape 'period' days ago.
 *
 */
/**
 * == Endpoint 2: GET /api/planning/pace?city=London&period=7 ==
 *
 * [FIXED] This endpoint now uses the resilient two-query method
 * instead of the complex, error-prone single query.
 *
 */
router.get('/pace', async (req, res) => {
  // --- [FIX 1] ---
  // Use the 'city' query parameter and make it case-insensitive
  const citySlugFromQuery = req.query.city;
  const citySlug = citySlugFromQuery || 'london';
  const period = parseInt(req.query.period, 10) || 7;

  // --- [LOGGING 1] ---
  console.log(`[planning.router.js] /pace received request. city_slug: '${citySlug}', period: ${period} days`);

  try {
    // --- Query 1: Get LATEST data for all 90 days ---
    // (This is the same logic as /forward-view)
    const latestSql = `
      SELECT DISTINCT ON (checkin_date)
        checkin_date, total_results, weighted_avg_price, hotel_count
      FROM market_availability_snapshots
      WHERE
        LOWER(city_slug) = LOWER($1)
        AND checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY
        checkin_date ASC, scraped_at DESC;
    `;
    
    // --- [LOGGING 2] ---
    console.log('[planning.router.js] /pace: Executing query for LATEST data...');
    const { rows: latestRowsRaw } = await pool.query(latestSql, [citySlug]);
    console.log(`[planning.router.js] /pace: LATEST query returned ${latestRowsRaw.length} rows.`);

    // --- Query 2: Get PAST data for all 90 days ---
    const pastSql = `
      WITH TargetPastScrape AS (
        -- 1. Find the most recent date that a scrape ran, on or before N days ago
        SELECT MAX((scraped_at AT TIME ZONE 'UTC')::date) AS past_scrape_date
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND (scraped_at AT TIME ZONE 'UTC')::date <= (CURRENT_DATE - $2 * INTERVAL '1 day')
      )
      -- 2. Get the latest data for each check-in day *from that specific scrape date*
      SELECT DISTINCT ON (s.checkin_date)
        s.checkin_date, s.total_results, s.weighted_avg_price, s.hotel_count
      FROM market_availability_snapshots s, TargetPastScrape t
      WHERE LOWER(s.city_slug) = LOWER($1)
        AND s.checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        AND (s.scraped_at AT TIME ZONE 'UTC')::date = t.past_scrape_date
      ORDER BY s.checkin_date ASC, s.scraped_at DESC;
    `;

    // --- [LOGGING 3] ---
    console.log('[planning.router.js] /pace: Executing query for PAST data...');
    const { rows: pastRowsRaw } = await pool.query(pastSql, [citySlug, period]);
    console.log(`[planning.router.js] /pace: PAST query returned ${pastRowsRaw.length} rows.`);

    // 2. Process: Pass both sets to the "Logic Hub"
    console.log('[planning.router.js] /pace: Processing rows in Logic Hub...');
    let latestRowsProcessed = calculatePriceIndex(latestRowsRaw);
    latestRowsProcessed = calculateMarketDemand(latestRowsProcessed);

    let pastRowsProcessed = calculatePriceIndex(pastRowsRaw);
    pastRowsProcessed = calculateMarketDemand(pastRowsProcessed);

    // Now, pass the two processed arrays to the pace calculator
    const paceData = calculatePace(latestRowsProcessed, pastRowsProcessed);
    
    // --- [LOGGING 4] ---
    console.log(`[planning.router.js] /pace: Processing complete. Sending ${paceData.length} pace rows.`);

    // 3. Respond
    res.json(paceData);
  } catch (err) {
    console.error('Error fetching /planning/pace:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * == Endpoint 3: GET /api/planning/history?date=2026-01-01 ==
 *
 * Fetches the 30-day scrape history for a *single* check-in date.
 *
 */
router.get('/history', async (req, res) => {
  const citySlug = 'london'; // Hardcoded for now
  const { date } = req.query; // e.g., '2026-01-01'

  if (!date) {
    return res.status(400).json({ error: 'A valid "date" query parameter is required.' });
  }

  try {
    // 1. SQL Query: This is a simple, fast, indexed query.
    const sql = `
      SELECT
        scraped_at,
        total_results,
        weighted_avg_price,
        hotel_count
      FROM market_availability_snapshots
      WHERE city_slug = $1
        AND checkin_date = $2
      ORDER BY scraped_at DESC
      LIMIT 30;
    `;
    
    const { rows } = await pool.query(sql, [citySlug, date]);

    // 2. Process: Pass to logic hub (to get MPSS, etc.)
    let processedRows = calculatePriceIndex(rows);
    processedRows = calculateMarketDemand(processedRows);

    // 3. Respond
    res.json(processedRows.reverse()); // Reverse to show oldest-to-newest
  } catch (err) {
    console.error('Error fetching /planning/history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;