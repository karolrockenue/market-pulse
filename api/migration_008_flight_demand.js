// Migration: Create flight_demand_snapshots table
// Stores daily flight arrival/departure counts per airport, used as hotel demand signals.
// To run: `node api/migration_008_flight_demand.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS flight_demand_snapshots (
        airport_code    VARCHAR(10) NOT NULL,
        flight_date     DATE NOT NULL,
        arrival_count   INTEGER NOT NULL DEFAULT 0,
        departure_count INTEGER NOT NULL DEFAULT 0,
        fetched_at      TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (airport_code, flight_date)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flight_demand_date
      ON flight_demand_snapshots (flight_date);
    `);

    await client.query('COMMIT');
    console.log('Migration 008 complete: flight_demand_snapshots created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 008 failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

run();
