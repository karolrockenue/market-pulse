require('dotenv').config();
const pool = require('../api/utils/db');

async function run() {
  try {
    // 1. Columns
    const cols = (await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'companies'
      ORDER BY ordinal_position;
    `)).rows;
    console.log('— Columns —');
    console.table(cols);

    // 2. Indexes
    const idx = (await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'companies'
      ORDER BY indexname;
    `)).rows;
    console.log('— Indexes —');
    idx.forEach(r => console.log(`  ${r.indexname}: ${r.indexdef}`));

    // 3. Trigger
    const trg = (await pool.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'companies';
    `)).rows;
    console.log('— Triggers —');
    console.table(trg);

    // 4. set_updated_at function exists
    const fn = (await pool.query(`
      SELECT proname, prokind
      FROM pg_proc
      WHERE proname = 'set_updated_at';
    `)).rows;
    console.log('— Function set_updated_at —');
    console.table(fn);

    // 5. Row count (should be 0)
    const cnt = (await pool.query(`SELECT COUNT(*) FROM companies;`)).rows[0].count;
    console.log(`— Row count: ${cnt}`);

  } catch (err) {
    console.error('Verify failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
