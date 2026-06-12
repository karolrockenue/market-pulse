require('dotenv').config();
const pool = require('./utils/db');

// Amenity & Building Revenue for the Mason Sales Flash (Westbourne: Canal /
// Meadow / Grounding). Dom re-uploads the full "Ancillary Upload" sheet every
// Monday, so the unit of storage is the whole parsed payload per hotel —
// one JSONB row, fully replaced on each upload. Shape mirrors the frontend
// AmenityData: { months[], fyLabel, rows: [{ name, revenue[], budget[],
// revenueFY, budgetFY }] }.
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS mf_amenity_revenue (
        hotel_id     INTEGER PRIMARY KEY,
        data         JSONB   NOT NULL,
        uploaded_by  INTEGER,
        uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('[migration_027] Created mf_amenity_revenue');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_027] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
