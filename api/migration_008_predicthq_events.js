/**
 * Migration: Create predicthq_events cache table
 *
 * Caches PredictHQ event data per city. Refreshed daily (24h TTL).
 * Run: node api/migration_008_predicthq_events.js
 */
require("dotenv").config();
const db = require("./utils/db");

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS predicthq_events (
        city_slug   TEXT PRIMARY KEY,
        place_id    TEXT,
        events      JSONB NOT NULL DEFAULT '[]',
        fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ predicthq_events table created");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
