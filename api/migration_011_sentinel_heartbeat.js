// Migration: Create sentinel_hotel_heartbeat table.
// Records the last successful rate push and the last failure per hotel so the
// admin Sentinel Health page can render in a single lookup per hotel instead
// of scanning sentinel_job_queue.
// To run: `node api/migration_011_sentinel_heartbeat.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sentinel_hotel_heartbeat (
        hotel_id                    INTEGER PRIMARY KEY,
        last_success_at             TIMESTAMPTZ,
        last_success_rates_count    INTEGER,
        last_failure_at             TIMESTAMPTZ,
        last_failure_error          TEXT,
        last_failure_job_id         UUID,
        consecutive_failures        INTEGER NOT NULL DEFAULT 0,
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sentinel_hotel_heartbeat_last_success
      ON sentinel_hotel_heartbeat (last_success_at);
    `);

    await client.query('COMMIT');
    console.log('Migration complete: sentinel_hotel_heartbeat table created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
