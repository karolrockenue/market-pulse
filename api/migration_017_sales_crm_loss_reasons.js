require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. loss_reasons — one per hotel (PK on hotel_id)
    await client.query(`
      CREATE TABLE IF NOT EXISTS loss_reasons (
        hotel_id INTEGER PRIMARY KEY REFERENCES hotels(hotel_id) ON DELETE CASCADE,
        reason_code VARCHAR(50) NOT NULL,
        competitor_name TEXT,
        notes TEXT,
        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        recorded_by VARCHAR(100)
      );
    `);

    // 2. Index for aggregate queries by reason
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_loss_reasons_code ON loss_reasons(reason_code);
    `);

    await client.query('COMMIT');
    console.log('[migration_017] Created loss_reasons table + reason_code index');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_017] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
