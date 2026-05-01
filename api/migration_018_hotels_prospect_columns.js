require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Snapshot row count before to verify no data is lost
    const before = (await client.query(`SELECT COUNT(*)::int AS n FROM hotels;`)).rows[0].n;

    // 1. Add prospect columns to hotels
    await client.query(`
      ALTER TABLE hotels
        ADD COLUMN IF NOT EXISTS prospect_status VARCHAR(30),
        ADD COLUMN IF NOT EXISTS prospect_score NUMERIC(8,2),
        ADD COLUMN IF NOT EXISTS prospect_owner VARCHAR(100),
        ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS last_agent_review_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS study_generated_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS study_artifact_url TEXT,
        ADD COLUMN IF NOT EXISTS booking_property_id VARCHAR(50);
    `);

    // 2. Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotels_prospect_status
        ON hotels(prospect_status)
        WHERE prospect_status IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotels_prospect_score
        ON hotels(prospect_score DESC NULLS LAST)
        WHERE prospect_status IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotels_company_id
        ON hotels(company_id)
        WHERE company_id IS NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotels_booking_property_id
        ON hotels(booking_property_id)
        WHERE booking_property_id IS NOT NULL;
    `);

    // Verify row count unchanged
    const after = (await client.query(`SELECT COUNT(*)::int AS n FROM hotels;`)).rows[0].n;
    if (before !== after) {
      throw new Error(`Row count changed: ${before} → ${after}`);
    }

    await client.query('COMMIT');
    console.log(`[migration_018] Added 8 prospect columns + 4 indexes to hotels (row count preserved: ${before} rows)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_018] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
