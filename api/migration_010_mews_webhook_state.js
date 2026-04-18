// Migration: Create mews_webhook_state table for Mews webhook idempotency.
// Tracks what each reservation has already contributed to daily_metrics_snapshots.rooms_sold
// so repeat ServiceOrderUpdated events don't over-count.
// To run: `node api/migration_010_mews_webhook_state.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mews_webhook_state (
        reservation_id      VARCHAR(255) PRIMARY KEY,
        hotel_id            INTEGER NOT NULL,
        last_applied_active BOOLEAN NOT NULL,
        last_applied_check_in  DATE NOT NULL,
        last_applied_check_out DATE NOT NULL,
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mews_webhook_state_hotel
      ON mews_webhook_state (hotel_id);
    `);

    await client.query('COMMIT');
    console.log('Migration complete: mews_webhook_state table created.');
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
