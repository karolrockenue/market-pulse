// /api/utils/benchmark.utils.js
// [FINAL-FIX v4] This version abandons the L30D/SMLY logic
// and directly mimics the 'metrics-from-db' logic, which we
// proved is the source of truth (£46.46).

// Import required utilities
const db = require('./db'); // db.js is in the same /utils directory
const { parse, getYear, getMonth } = require('date-fns');

/**
 * Fetches the benchmark Occupancy and ADR for a given property and target month.
 *
 * [CRITICAL] This logic is now an exact match of the query in
 * 'dashboard.router.js' (GET /metrics-from-db) which you proved
 * is the correct source of truth.
 *
 * @param {number} propertyId - The hotel_id.
 * @param {string} month - The 3-letter month (e.g., 'Nov').
 * @param {string} year - The 4-digit year (e.g., '2025').
 * @returns {Promise<object>} A promise that resolves to the benchmark object.
 * e.g., { benchmarkOcc: 78.5, benchmarkAdr: 46.46, source: 'full-month-avg' }
 * @throws {Error} Throws an error if date parsing fails.
 */
async function getBenchmarks(propertyId, month, year) {
  console.log(`[getBenchmarks] Using correct 'metrics-from-db' logic for ${propertyId}, ${month} ${year}`);
  
  // --- 1. Define Defaults ---
  const defaultBenchmarks = {
    benchmarkOcc: 75.0, // Default 75%
    benchmarkAdr: 120.0, // Default £120
    source: 'default'
  };

  let targetDate;
  try {
    // Parse the date. e.g., "Nov 2025" -> 2025-11-01
    targetDate = parse(`${month} ${year}`, 'MMM yyyy', new Date());
  } catch (e) {
    console.error(`[getBenchmarks] Invalid date format: ${month} ${year}`);
    throw new Error(`Invalid month or year: ${month} ${year}`);
  }

  const targetYear = getYear(targetDate);
  const targetMonth = getMonth(targetDate) + 1; // date-fns getMonth is 0-indexed

  // --- 2. Calculate Benchmarks using the 'metrics-from-db' logic ---
  
  // This is the *exact* logic used by dashboard.router.js to get the £46.46 value.
  // It calculates the average for the *entire* month.
  
  // Query 1: Get Occupancy
  const occQuery = `
    SELECT (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS occ
    FROM daily_metrics_snapshots
    WHERE hotel_id = $1
      AND EXTRACT(YEAR FROM stay_date) = $2
      AND EXTRACT(MONTH FROM stay_date) = $3;
  `;
  
  // Query 2: Get ADR
  const adrQuery = `
    SELECT AVG(gross_adr) AS adr
    FROM daily_metrics_snapshots
    WHERE hotel_id = $1
      AND EXTRACT(YEAR FROM stay_date) = $2
      AND EXTRACT(MONTH FROM stay_date) = $3;
  `;

  try {
    const [occResult, adrResult] = await Promise.all([
      db.query(occQuery, [propertyId, targetYear, targetMonth]),
      db.query(adrQuery, [propertyId, targetYear, targetMonth])
    ]);

    const monthOcc = occResult.rows.length > 0 ? occResult.rows[0].occ : null;
    const monthAdr = adrResult.rows.length > 0 ? adrResult.rows[0].adr : null;

    // Use the full-month-average if it exists
    if (monthOcc != null) {
      console.log(`[getBenchmarks] Success: Occ ${monthOcc}, ADR ${monthAdr}`);
      return {
        benchmarkOcc: parseFloat(monthOcc),
        benchmarkAdr: monthAdr ? parseFloat(monthAdr) : defaultBenchmarks.benchmarkAdr,
        source: 'full-month-avg'
      };
    } else {
      // Fallback to defaults if the month has no data at all
      console.log(`[getBenchmarks] No data for month, using default.`);
      return defaultBenchmarks;
    }

  } catch (error) {
    console.error(`[getBenchmarks] Error querying full-month metrics:`, error);
    return defaultBenchmarks; // Return default on error
  }
}

// Export the function to be used by other routers
module.exports = {
  getBenchmarks
};