require('dotenv').config();
const pool = require('./utils/db');

// Adds mews_service_id to reservations so the Sales Flash SS / MS / LS
// classification can mirror Mews exactly (by service), instead of using
// a nights-based heuristic. Backfill via
// scripts/backfill-mf-reservations-service-id.js.
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS mews_service_id VARCHAR(64)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_hotel_service
        ON reservations (hotel_id, mews_service_id)
    `);

    await client.query('COMMIT');
    console.log('[migration_023] Added reservations.mews_service_id');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_023] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
