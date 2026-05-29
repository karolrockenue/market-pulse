require('dotenv').config();
const pool = require('./utils/db');

// Adds the Weak Day Pricing config column to sentinel_configurations.
// Nullable JSONB, no default → existing rows stay NULL → feature is OFF for
// every hotel until explicitly enabled in the Control Panel. Purely additive.
async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const before = (
      await client.query(`SELECT COUNT(*)::int AS n FROM sentinel_configurations;`)
    ).rows[0].n;

    await client.query(`
      ALTER TABLE sentinel_configurations
        ADD COLUMN IF NOT EXISTS weak_day_pricing JSONB;
    `);

    const after = (
      await client.query(`SELECT COUNT(*)::int AS n FROM sentinel_configurations;`)
    ).rows[0].n;
    if (before !== after) {
      throw new Error(`Row count changed: ${before} → ${after}`);
    }

    await client.query('COMMIT');
    console.log(
      `[migration_025] Added weak_day_pricing JSONB column to sentinel_configurations (row count preserved: ${before} rows, all NULL = feature off)`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_025] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
