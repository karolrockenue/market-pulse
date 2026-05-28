require('dotenv').config();
const pool = require('./utils/db');

// Adds rate-based segment classification to reservations so the Sales Flash can
// split Short / Mid / Long by RATE GROUP instead of Mews service (Mews merged
// Mid into the Short service and split Long across an old monthly + new nightly
// service, so service-based classification mislabels them).
//   mews_rate_id  — the booked Mews RateId (raw, permanent truth)
//   rate_segment  — resolved 'short' | 'mid' | 'long' | 'exclude' (comp/mgmt)
// Resolution lives in scripts/backfill-mf-rate-segment.js (re-runnable).
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS mews_rate_id VARCHAR(64)
    `);
    await client.query(`
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS rate_segment VARCHAR(16)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_hotel_rate_segment
        ON reservations (hotel_id, rate_segment)
    `);

    await client.query('COMMIT');
    console.log('[migration_024] Added reservations.mews_rate_id + rate_segment');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_024] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
