/**
 * Migration: Create city_accommodation_pois cache table
 *
 * Run: node api/migration_003_city_accommodation_pois.js
 */
require("dotenv").config();
const db = require("./utils/db");

async function migrate() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS city_accommodation_pois (
        city_slug TEXT PRIMARY KEY,
        pois JSONB NOT NULL DEFAULT '[]',
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ city_accommodation_pois table created");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
}

migrate();
