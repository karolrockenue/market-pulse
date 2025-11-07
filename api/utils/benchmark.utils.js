// /api/utils/benchmark.utils.js
// [NEW v3] Implements L30D > SMLY > Default logic for benchmarks.

const db = require('./db');
const { parse, getYear, getMonth, subYears } = require('date-fns');

/**
 * [SINGLE SOURCE OF TRUTH]
 * Fetches the benchmark Occupancy and ADR for a given property and target month.
 *
 * This function implements the L30D > SMLY > Default priority:
 * 1. Try to get Last 30 Days (L30D) Occupancy and ADR.
 * 2. If L30D is unavailable, try to get Same Month Last Year (SMLY).
 * 3. If SMLY is also unavailable, return hard-coded defaults.
 *
 * @param {number} propertyId - The hotel_id.
 * @param {string} month - The 3-letter month (e.g., 'Nov'). (Unused, but kept for compatibility)
 * @param {string} year - The 4-digit year (e.g., '2025'). (Unused, but kept for compatibility)
 * @returns {Promise<object>} A promise that resolves to the benchmark object.
 * e.g., { benchmarkOcc: 78.5, benchmarkAdr: 150.0, source: 'L30D' }
 * @throws {Error} Throws an error if date parsing fails.
 */
async function getBenchmarks(propertyId, month, year) {
  
  // --- 1. Define Defaults ---
  const defaultBenchmarks = {
    benchmarkOcc: 75.0, // Default 75%
    benchmarkAdr: 120.0, // Default £120
    source: 'default'
  };

  try {
    // --- 2. Try L30D (Last 30 Days) First ---
    console.log(`[getBenchmarks] Attempting L30D for ${propertyId}`);
    const l30dQuery = `
      SELECT
        AVG(gross_adr) AS adr,
        (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS occ
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1
        AND stay_date BETWEEN (CURRENT_DATE - INTERVAL '30 days') AND (CURRENT_DATE - INTERVAL '1 day');
    `;
    
    const l30dResult = await db.query(l30dQuery, [propertyId]);
    const l30dOcc = l30dResult.rows.length > 0 ? l30dResult.rows[0].occ : null;
    const l30dAdr = l30dResult.rows.length > 0 ? l30dResult.rows[0].adr : null;

    if (l30dOcc != null && l30dOcc > 0 && l30dAdr != null && l30dAdr > 0) {
      console.log(`[getBenchmarks] Success (L30D): Occ ${l30dOcc}, ADR ${l30dAdr}`);
      return {
        benchmarkOcc: parseFloat(l30dOcc),
        benchmarkAdr: parseFloat(l30dAdr),
        source: 'L30D'
      };
    }

    // --- 3. Try SMLY (Same Month Last Year) as Fallback ---
    console.log(`[getBenchmarks] L30D failed or null, attempting SMLY for ${propertyId}, ${month} ${year}`);
    
    // Parse the target date to get SMLY
    const targetDate = parse(`${month} ${year}`, 'MMM yyyy', new Date());
    const smlyDate = subYears(targetDate, 1);
    const smlyYear = getYear(smlyDate);
    const smlyMonth = getMonth(smlyDate) + 1; // date-fns getMonth is 0-indexed

    const smlyQuery = `
      SELECT
        AVG(gross_adr) AS adr,
        (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS occ
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1
        AND EXTRACT(YEAR FROM stay_date) = $2
        AND EXTRACT(MONTH FROM stay_date) = $3;
    `;
    
    const smlyResult = await db.query(smlyQuery, [propertyId, smlyYear, smlyMonth]);
    const smlyOcc = smlyResult.rows.length > 0 ? smlyResult.rows[0].occ : null;
    const smlyAdr = smlyResult.rows.length > 0 ? smlyResult.rows[0].adr : null;

    if (smlyOcc != null && smlyOcc > 0 && smlyAdr != null && smlyAdr > 0) {
      console.log(`[getBenchmarks] Success (SMLY): Occ ${smlyOcc}, ADR ${smlyAdr}`);
      return {
        benchmarkOcc: parseFloat(smlyOcc),
        benchmarkAdr: parseFloat(smlyAdr),
        source: 'SMLY'
      };
    }

    // --- 4. Return Defaults ---
    console.log(`[getBenchmarks] L30D and SMLY failed, using default.`);
    return defaultBenchmarks;

  } catch (error) {
    console.error(`[getBenchmarks] Error querying benchmarks:`, error);
    return defaultBenchmarks; // Return default on any error
  }
}

// Export the function to be used by other routers
module.exports = {
  getBenchmarks
};