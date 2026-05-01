require('dotenv').config();
const pool = require('../api/utils/db');

async function run() {
  try {
    // 1. All new tables exist
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN (
        'companies', 'people', 'hotel_people', 'hotel_activities', 'loss_reasons',
        'agent_state', 'sales_outreach_drafts', 'agent_run_log', 'agent_telegram_messages'
      )
      ORDER BY table_name;
    `)).rows.map(r => r.table_name);
    console.log('— New tables present —');
    console.log(`  ${tables.length}/9: ${tables.join(', ')}`);

    // 2. All new hotels columns
    const hotelCols = (await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hotels'
        AND column_name IN (
          'prospect_status', 'prospect_score', 'prospect_owner', 'company_id',
          'last_agent_review_at', 'study_generated_at', 'study_artifact_url',
          'booking_property_id'
        )
      ORDER BY column_name;
    `)).rows.map(r => r.column_name);
    console.log(`— hotels prospect columns: ${hotelCols.length}/8 —`);
    console.log(`  ${hotelCols.join(', ')}`);

    // 3. FK from companies → people
    const companiesFK = (await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'companies'::regclass AND contype = 'f';
    `)).rows;
    console.log('— companies FKs —');
    companiesFK.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

    // 4. FK from hotels.company_id → companies
    const hotelsFK = (await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'hotels'::regclass
        AND conname LIKE '%company%';
    `)).rows;
    console.log('— hotels.company_id FK —');
    hotelsFK.forEach(r => console.log(`  ${r.conname}: ${r.def}`));

    // 5. Total index count across new tables
    const idxCount = (await pool.query(`
      SELECT tablename, COUNT(*)::int AS n
      FROM pg_indexes
      WHERE tablename IN (
        'companies', 'people', 'hotel_people', 'hotel_activities', 'loss_reasons',
        'agent_state', 'sales_outreach_drafts', 'agent_run_log', 'agent_telegram_messages'
      )
      GROUP BY tablename
      ORDER BY tablename;
    `)).rows;
    console.log('— Index count per table —');
    console.table(idxCount);

    // 6. New indexes on hotels (prospect-related)
    const hotelsIdx = (await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'hotels'
        AND indexname IN (
          'idx_hotels_prospect_status', 'idx_hotels_prospect_score',
          'idx_hotels_company_id', 'uniq_hotels_booking_property_id'
        )
      ORDER BY indexname;
    `)).rows.map(r => r.indexname);
    console.log(`— New hotels indexes: ${hotelsIdx.length}/4 —`);
    console.log(`  ${hotelsIdx.join(', ')}`);

    // 7. Triggers (4 expected: companies, people, hotel_people, agent_state)
    const triggers = (await pool.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name LIKE 'trg_%_updated_at'
        AND event_object_table IN ('companies', 'people', 'hotel_people', 'agent_state');
    `)).rows;
    console.log(`— updated_at triggers: ${triggers.length}/4 —`);
    triggers.forEach(t => console.log(`  ${t.trigger_name} on ${t.event_object_table}`));

    // 8. Rows preserved on hotels
    const hotelsCnt = (await pool.query(`SELECT COUNT(*)::int AS n FROM hotels;`)).rows[0].n;
    console.log(`— hotels row count: ${hotelsCnt} (should be unchanged from before Stage A)`);

    console.log('\n✅ Stage A verification complete.');

  } catch (err) {
    console.error('❌ Verify failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
