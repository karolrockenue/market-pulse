require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Existing hotel_ids occupy ~230k–318k (PMS property IDs reused as PK).
    // Start the prospect sequence at 9_000_000 — well above any plausible
    // future PMS onboarding range, so prospect IDs and managed-hotel IDs
    // never collide.
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS hotels_prospect_id_seq
        START WITH 9000000
        MINVALUE 9000000
        INCREMENT BY 1;
    `);

    await client.query('COMMIT');
    console.log('[migration_021] Created hotels_prospect_id_seq (start=9000000)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_021] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
