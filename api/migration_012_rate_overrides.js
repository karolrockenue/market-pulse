// Migration: Create sentinel_rate_overrides table.
// Date-level rate overrides keyed by (hotel_id, stay_date). Presence of a row
// is the signal that Sentinel must skip that date — overrides win over
// guardrails, LMF, freeze windows, and AI decisions.
// Only the base room is overridden; derived rooms always follow via
// differentials at push time. See claude/rate-override-implementation.md.
// To run: `node api/migration_012_rate_overrides.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sentinel_rate_overrides (
        hotel_id             INTEGER     NOT NULL,
        stay_date            DATE        NOT NULL,
        base_override_price  NUMERIC     NOT NULL CHECK (base_override_price > 0),
        set_by               INTEGER     REFERENCES users(user_id),
        set_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by           INTEGER     REFERENCES users(user_id),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (hotel_id, stay_date)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sentinel_rate_overrides_hotel_date
      ON sentinel_rate_overrides (hotel_id, stay_date);
    `);

    await client.query('COMMIT');
    console.log('Migration complete: sentinel_rate_overrides table created.');
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
