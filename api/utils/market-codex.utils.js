const pgPool = require('../utils/db'); // [NEW] Import the db pool

// This file is the "Logic Hub" for the Market Codex / Planning feature.
// It contains all the business-facing logic for normalizing and
// processing raw database data into the metrics required by the frontend.
//

/**
 * Normalizes a list of values to a 0-100 scale.
 * @param {number[]} values - An array of numbers.
 * @param {boolean} [invert=false] - If true, inverts the score (e.g., for supply -> demand).
 * @returns {number[]} - An array of scores (0-100).
 */
const normalize = (values, invert = false) => {
  const validValues = values.filter(v => typeof v === 'number' && isFinite(v));
  if (validValues.length === 0) {
    // Return array of nulls matching original length
    return values.map(() => null); 
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;

  // If range is 0, all valid numbers are the same.
  // Return 50 for all valid numbers (mid-point), null for invalid ones.
  if (range === 0) {
    return values.map(v => (typeof v === 'number' && isFinite(v) ? 50 : null));
  }

  return values.map(value => {
    if (typeof value !== 'number' || !isFinite(value)) {
      return null; // Don't score null or invalid data
    }
    
    const normalized = ((value - min) / range) * 100;
    
    // Invert the score if 'invert' is true
    // e.g., High Supply (100) -> Low Demand (0)
    return invert ? 100 - normalized : normalized;
  });
};

/**
 * Calculates the Market Price Index (MPSS) from raw database rows.
 *
 * @param {Object[]} db_rows - Array of rows from the DB.
 * @returns {Object[]} - The same array with an 'mpss' property added.
 */
const calculatePriceIndex = (db_rows) => {
  if (!db_rows || db_rows.length === 0) {
    return [];
  }
  
  // 1. Extract all weighted_avg_price values
  // The DB migration already calculated this, so we just read it.
// 1. Extract all weighted_avg_price values
  // The DB migration already calculated this, so we just read it.
  const prices = db_rows.map(row => parseFloat(row.weighted_avg_price));

  // 2. Normalize prices to a 0-100 scale (MPSS)
  const scores = normalize(prices, false); // false = don't invert

  // 3. Add the 'mpss' score back to the original objects
  return db_rows.map((row, index) => ({
    ...row,
    mpss: scores[index],
  }));
};

/**
 * Calculates the Market Demand Score from raw database rows.
 *
 * @param {Object[]} db_rows - Array of rows from the DB.
 * @returns {Object[]} - The same array with a 'market_demand_score' property added.
 */
/**
 * Calculates the Market Demand Score from raw database rows.
 *
 * [MODIFIED] This logic now calculates a BLENDED score, factoring in
 * both supply scarcity (inverse of total_results) and market price (mpss).
 *
 * This function MUST be run *after* calculatePriceIndex, as it
 * depends on the 'mpss' property.
 *
 * @param {Object[]} db_rows - Array of rows from the DB (MUST include 'mpss').
 * @returns {Object[]} - The same array with a 'market_demand_score' property added.
 */
const calculateMarketDemand = (db_rows) => {
  if (!db_rows || db_rows.length === 0) {
    return [];
  }

  // --- TUNING "KNOBS" ---
  // Adjust these weights to change the blend. They should add up to 1.0.
  //
  // WEIGHT_SUPPLY: How much "supply scarcity" (low availability) matters.
  // WEIGHT_PRICE:  How much "market price" (high WAP) matters.
  const WEIGHT_SUPPLY = 0.5; // e.g., 50%
  const WEIGHT_PRICE = 0.5;  // e.g., 50%
  // ------------------------

  // 1. Extract all total_results (total market supply)
  const supplyValues = db_rows.map(row => parseInt(row.total_results, 10));

  // 2. Normalize supply and INVERT it to create a "Supply Scarcity Score" (0-100)
  // High supply = 100 -> inverted to 0 (Low Scarcity)
  // Low supply  = 0   -> inverted to 100 (High Scarcity)
  const supplyScarcityScores = normalize(supplyValues, true); // true = invert

  // 3. Extract the pre-calculated Price Index Scores (0-100)
  // This assumes calculatePriceIndex has already been run.
  const priceIndexScores = db_rows.map(row => row.mpss);

  // 4. Add the new BLENDED 'market_demand_score' back to the original objects
  return db_rows.map((row, index) => {
    const supplyScore = supplyScarcityScores[index];
    const priceScore = priceIndexScores[index];

    let blendedScore = null;

    // We can only calculate a score if both inputs are valid numbers
    if (typeof supplyScore === 'number' && typeof priceScore === 'number') {
      blendedScore =
        (supplyScore * WEIGHT_SUPPLY) + (priceScore * WEIGHT_PRICE);
    }
    // Handle cases where one score is null (e.g., missing WAP data)
    // You could decide to use the single available score, or default to null.
    // For now, we default to null if either is missing.
    else if (typeof supplyScore === 'number' && priceScore === null) {
      // Option: Default to just the supply score
      // blendedScore = supplyScore;
    }
    else if (typeof priceScore === 'number' && supplyScore === null) {
      // Option: Default to just the price score
      // blendedScore = priceScore;
    }

    return {
      ...row,
      // Round the final score to a clean integer
      market_demand_score: blendedScore !== null ? Math.round(blendedScore) : null,
    };
  });
};
/**
 * Calculates the pace/delta between two sets of data (latest and past).
 *
 * @param {Object[]} latest_rows - Processed rows (with mpss/demand) from the latest scrape.
 * @param {Object[]} past_rows - Processed rows (with mpss/demand) from the N-day-ago scrape.
 * @returns {Object[]} - An array of objects with deltas (e.g., mpss_delta).
 */
/**
 * Calculates the pace/delta between two sets of data (latest and past).
 *
 * @param {Object[]} latest_rows - Processed rows (with mpss/demand) from the latest scrape.
 * @param {Object[]} past_rows - Processed rows (with mpss/demand) from the N-day-ago scrape.
 * @returns {Object[]} - An array of objects with deltas (e.g., mpss_delta).
 */
const calculatePace = (latest_rows, past_rows) => {
  // Create a quick-lookup map for the 'past' data
  const pastDataMap = new Map();
  for (const row of past_rows) {
    // Use ISO string of the date for a reliable key
    const dateKey = new Date(row.checkin_date).toISOString().split('T')[0];
    pastDataMap.set(dateKey, row);
  }

  // Map over the 'latest' data to build the final pace array
  return latest_rows.map(latestRow => {
    const dateKey = new Date(latestRow.checkin_date).toISOString().split('T')[0];
    const pastRow = pastDataMap.get(dateKey);

    // If there is no matching "past" data for this check-in date,
    // we can't calculate a delta.
    if (!pastRow) {
      return {
        checkin_date: latestRow.checkin_date,
        mpss_delta: null,
        market_demand_score_delta: null,
        total_results_delta: null,
        hotel_count_delta: null,
        total_results_percent_delta: null,
        wap_delta: null, // [NEW]
      };
    }

    // Helper to calculate delta (handles nulls)
    const getDelta = (latest, past) => {
      // [FIX] Parse values as floats, as they likely come from the DB as strings
      const latestNum = parseFloat(latest);
      const pastNum = parseFloat(past);

      if (!isNaN(latestNum) && !isNaN(pastNum)) {
        return latestNum - pastNum;
      }
      return null;
    };

    // [NEW] Helper to calculate percentage delta (handles nulls and divide-by-zero)
    const getPercentDelta = (latest, past) => {
      // [FIX] Parse values as integers, as they likely come from the DB as strings
      const latestNum = parseInt(latest, 10);
      const pastNum = parseInt(past, 10);

      // Check if both are valid numbers and past is not zero
      if (!isNaN(latestNum) && !isNaN(pastNum) && pastNum !== 0) {
        // Calculate (new - old) / old
        return ((latestNum - pastNum) / pastNum) * 100;
      }
      return null;
    };

    return {
      checkin_date: latestRow.checkin_date,
      
      // Calculate deltas for all key metrics
      mpss_delta: getDelta(latestRow.mpss, pastRow.mpss),
      market_demand_score_delta: getDelta(latestRow.market_demand_score, pastRow.market_demand_score),
      total_results_delta: getDelta(latestRow.total_results, pastRow.total_results),
      hotel_count_delta: getDelta(latestRow.hotel_count, pastRow.hotel_count),
      total_results_percent_delta: getPercentDelta(latestRow.total_results, pastRow.total_results),
      
      // [NEW] Add the Weighted Average Price (WAP) delta
      wap_delta: getDelta(latestRow.weighted_avg_price, pastRow.weighted_avg_price),
    };
});
};

/**
 * [NEW] Calculates the "Market Outlook" using the "Split-Half" methodology.
 * This is the single source of truth for the banner logic.
 * @param {string} citySlug - The city slug (e.g., 'london')
 * @param {Object} dbPool - The pgPool instance (defaults to imported pool)
 * @returns {Promise<Object>} - A promise that resolves to { status, metric }
 */
const getMarketOutlook = async (citySlug, dbPool = pgPool) => {
  const query = `
    WITH DateRange AS (
      SELECT MIN((scraped_at AT TIME ZONE 'UTC')::date) AS start_date,
             MAX((scraped_at AT TIME ZONE 'UTC')::date) AS end_date
      FROM market_availability_snapshots WHERE city_slug = $1
    ), Config AS (
      SELECT end_date, LEAST((end_date - start_date + 1), 30) AS total_window_days
      FROM DateRange
    ), Periods AS (
      SELECT
        FLOOR(total_window_days / 2) AS half_window_days,
        end_date AS recent_period_end,
        (end_date - (FLOOR(total_window_days / 2) - 1) * INTERVAL '1 day') AS recent_period_start,
        (end_date - FLOOR(total_window_days / 2) * INTERVAL '1 day') AS past_period_end,
        (end_date - (FLOOR(total_window_days / 2) * 2 - 1) * INTERVAL '1 day') AS past_period_start
      FROM Config
    ), Past_Forecast_Snapshots AS (
      SELECT AVG(total_results) AS avg_30day_supply, AVG(weighted_avg_price) AS avg_30day_wap
      FROM market_availability_snapshots, Periods p
      WHERE city_slug = $1
        AND (scraped_at AT TIME ZONE 'UTC')::date BETWEEN p.past_period_start AND p.past_period_end
        AND checkin_date BETWEEN (scraped_at AT TIME ZONE 'UTC')::date AND ((scraped_at AT TIME ZONE 'UTC')::date + INTERVAL '29 days')
      GROUP BY (scraped_at AT TIME ZONE 'UTC')::date
    ), Past_Outlook AS (
      SELECT AVG(avg_30day_supply) AS past_supply, AVG(avg_30day_wap) AS past_wap
      FROM Past_Forecast_Snapshots
    ), Recent_Forecast_Snapshots AS (
      SELECT AVG(total_results) AS avg_30day_supply, AVG(weighted_avg_price) AS avg_30day_wap
      FROM market_availability_snapshots, Periods p
      WHERE city_slug = $1
        AND (scraped_at AT TIME ZONE 'UTC')::date BETWEEN p.recent_period_start AND p.recent_period_end
        AND checkin_date BETWEEN (scraped_at AT TIME ZONE 'UTC')::date AND ((scraped_at AT TIME ZONE 'UTC')::date + INTERVAL '29 days')
      GROUP BY (scraped_at AT TIME ZONE 'UTC')::date
    ), Recent_Outlook AS (
      SELECT AVG(avg_30day_supply) AS recent_supply, AVG(avg_30day_wap) AS recent_wap
      FROM Recent_Forecast_Snapshots
    )
    SELECT p.half_window_days, po.past_supply, po.past_wap, ro.recent_supply, ro.recent_wap
    FROM Periods p, Past_Outlook po, Recent_Outlook ro;
  `;

  try {
    const { rows } = await dbPool.query(query, [citySlug.toLowerCase()]);

    if (!rows.length || !rows[0].recent_supply) {
      return { status: 'stable', metric: 'Data Populating' };
    }

    const data = rows[0];
    const pastSupply = parseFloat(data.past_supply);
    const recentSupply = parseFloat(data.recent_supply);
    const pastWap = parseFloat(data.past_wap);
    const recentWap = parseFloat(data.recent_wap);

    // Handle potential division by zero if pastSupply is 0
    const supplyDelta = (pastSupply !== 0) ? ((recentSupply - pastSupply) / pastSupply) * 100 : (recentSupply > 0 ? 100 : 0);
    const wapDelta = (pastWap !== 0) ? ((recentWap - pastWap) / pastWap) * 100 : (recentWap > 0 ? 100 : 0);
    const marketDemandDelta = -supplyDelta;

    let status = 'stable';
    let metric = '';

    // 1. Primary check: Market Demand
    if (marketDemandDelta > 1) {
      status = 'strengthening';
      metric = `+${marketDemandDelta.toFixed(1)}%`;
    } else if (marketDemandDelta < -1) {
      status = 'softening';
      metric = `${marketDemandDelta.toFixed(1)}%`;
    }
    // 2. Secondary check: Price
    else if (wapDelta > 1) {
      status = 'strengthening';
      metric = `+${wapDelta.toFixed(1)}%`;
    } else if (wapDelta < -1) {
      status = 'softening';
      metric = `${wapDelta.toFixed(1)}%`;
    }
    // 3. Both are stable
    else {
      status = 'stable';
      metric = `${marketDemandDelta > 0 ? '+' : ''}${marketDemandDelta.toFixed(1)}%`;
    }

    return { status, metric };

  } catch (err) {
    console.error('Error in getMarketOutlook:', err);
    return { status: 'stable', metric: 'Error' };
  }
};

module.exports = {
  calculatePriceIndex,
  calculateMarketDemand,
  calculatePace,
  getMarketOutlook, // [NEW] Export the new function
};