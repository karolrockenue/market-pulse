// Migration: Create sentinel_daily_min_rates table
// Mirrors sentinel_daily_max_rates for per-day minimum rate overrides.
// To run: `node api/migration_004_daily_min_rates.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sentinel_daily_min_rates (
        hotel_id      INTEGER NOT NULL,
        stay_date     DATE NOT NULL,
        min_price     NUMERIC NOT NULL,
        is_manual_override BOOLEAN DEFAULT TRUE,
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (hotel_id, stay_date)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_daily_min_rates_hotel
      ON sentinel_daily_min_rates (hotel_id, stay_date);
    `);

    await client.query('COMMIT');
    console.log('Migration complete: sentinel_daily_min_rates created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
