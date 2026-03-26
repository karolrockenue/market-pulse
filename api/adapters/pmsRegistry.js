/**
 * @file pmsRegistry.js
 * @brief PMS Adapter Registry
 *
 * Central router that returns the correct adapter module based on a hotel's pms_type.
 * This allows all upstream code (daily-refresh, sentinel router, etc.) to call
 * generic functions without knowing which PMS is connected.
 *
 * RULE: This file NEVER modifies existing adapters. It only imports and returns them.
 *
 * Usage:
 *   const { getAdapter, getSentinelAdapter } = require('../adapters/pmsRegistry');
 *   const adapter = getAdapter('mews');          // returns mewsAdapter module
 *   const sentinel = getSentinelAdapter('mews'); // returns mews.sentinel.adapter module
 */

const cloudbedsAdapter = require("./cloudbedsAdapter");
const mewsAdapter = require("./mewsAdapter");

// Sentinel adapters (Phase 3+)
const cloudbedsSentinelAdapter = require("./sentinel.adapter");
const mewsSentinelAdapter = require("./mews.sentinel.adapter");

/**
 * Returns the core PMS adapter for the given pms_type.
 * Core adapters handle: hotel details, metrics, onboarding data.
 *
 * @param {string} pmsType - 'cloudbeds' | 'mews'
 * @returns {object} The adapter module
 */
function getAdapter(pmsType) {
  switch (pmsType) {
    case "mews":
      return mewsAdapter;
    case "cloudbeds":
      return cloudbedsAdapter;
    default:
      throw new Error(`[PMS Registry] Unknown pms_type: '${pmsType}'`);
  }
}

/**
 * Returns the Sentinel-specific adapter for the given pms_type.
 * Sentinel adapters handle: rate reads, rate pushes, room types, rate plans.
 *
 * @param {string} pmsType - 'cloudbeds' | 'mews'
 * @returns {object} The sentinel adapter module
 */
function getSentinelAdapter(pmsType) {
  switch (pmsType) {
    case "mews":
      return mewsSentinelAdapter;
    case "cloudbeds":
      return cloudbedsSentinelAdapter;
    default:
      throw new Error(
        `[PMS Registry] Unknown pms_type for Sentinel: '${pmsType}'`,
      );
  }
}

/**
 * Looks up a hotel's pms_type from the database.
 * Convenience function so callers don't need to query the DB themselves.
 *
 * @param {number|string} hotelId - Internal DB hotel ID
 * @returns {Promise<string>} The pms_type ('cloudbeds' | 'mews')
 */
async function getPmsType(hotelId) {
  const pgPool = require("../utils/db");
  const result = await pgPool.query(
    "SELECT pms_type FROM hotels WHERE hotel_id = $1",
    [hotelId],
  );

  if (result.rows.length === 0) {
    throw new Error(`[PMS Registry] Hotel ${hotelId} not found.`);
  }

  const pmsType = result.rows[0].pms_type;
  if (!pmsType) {
    throw new Error(`[PMS Registry] Hotel ${hotelId} has no pms_type set.`);
  }

  return pmsType;
}

module.exports = {
  getAdapter,
  getSentinelAdapter,
  getPmsType,
};
