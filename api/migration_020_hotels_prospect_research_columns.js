require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const before = (await client.query(`SELECT COUNT(*)::int AS n FROM hotels;`)).rows[0].n;

    await client.query(`
      ALTER TABLE hotels
        ADD COLUMN IF NOT EXISTS review_score NUMERIC(3,1),
        ADD COLUMN IF NOT EXISTS review_count INTEGER,
        ADD COLUMN IF NOT EXISTS preferred_status VARCHAR(20),
        ADD COLUMN IF NOT EXISTS search_page_depth INTEGER,
        ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;
    `);

    // preferred_status is a tri-state: NULL (not preferred), 'preferred', 'preferred_plus'
    await client.query(`
      ALTER TABLE hotels
        DROP CONSTRAINT IF EXISTS hotels_preferred_status_check;
    `);
    await client.query(`
      ALTER TABLE hotels
        ADD CONSTRAINT hotels_preferred_status_check
        CHECK (preferred_status IS NULL OR preferred_status IN ('preferred', 'preferred_plus'));
    `);

    // Partial index for ICP queries on prospects — covers golden-apple filter
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotels_prospect_icp
        ON hotels(review_score DESC NULLS LAST, review_count DESC NULLS LAST)
        WHERE prospect_status IS NOT NULL;
    `);

    const after = (await client.query(`SELECT COUNT(*)::int AS n FROM hotels;`)).rows[0].n;
    if (before !== after) {
      throw new Error(`Row count changed: ${before} → ${after}`);
    }

    await client.query('COMMIT');
    console.log(`[migration_020] Added 5 prospect research columns + 1 partial index to hotels (row count preserved: ${before} rows)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_020] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
