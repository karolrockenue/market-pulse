require('dotenv').config();
const pool = require('./utils/db');

// Per-service budget table for the Mason Sales Flash digitisation.
// `hotel_budgets` is whole-hotel-per-month total; the Sales Flash needs
// budget broken out by service (short / mid / long, etc.).
// Empty until Mason supplies the FY26 budget file split by service.
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_service_budgets (
        hotel_id      INTEGER NOT NULL,
        year          INTEGER NOT NULL,
        month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        service_role  TEXT    NOT NULL,
        budget_revenue_net  NUMERIC(12, 2) NOT NULL DEFAULT 0,
        budget_room_nights  INTEGER,
        budget_occupancy_pct NUMERIC(5, 4),
        notes         TEXT,
        updated_by    INTEGER,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (hotel_id, year, month, service_role)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hsb_hotel_year
        ON hotel_service_budgets (hotel_id, year);
    `);

    await client.query('COMMIT');
    console.log('[migration_022] Created hotel_service_budgets');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_022] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
