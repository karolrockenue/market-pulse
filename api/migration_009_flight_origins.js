// Migration: Add origins JSONB column to flight_demand_snapshots
// Stores per-date origin airport/country breakdown.
// To run: `node api/migration_009_flight_origins.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE flight_demand_snapshots
      ADD COLUMN IF NOT EXISTS origins JSONB DEFAULT '[]'::jsonb;
    `);

    await client.query('COMMIT');
    console.log('Migration 009 complete: origins column added to flight_demand_snapshots.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 009 failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

run();
