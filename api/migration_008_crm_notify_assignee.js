require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE crm_tasks
        ADD COLUMN IF NOT EXISTS notify_assignee BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query('COMMIT');
    console.log('migration_008: crm_tasks.notify_assignee added (default FALSE).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('migration_008 failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = run;
