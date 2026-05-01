// Stage G — automated regression tests for the Sales CRM build.
// Covers: schema sanity, API contracts, auth gating, activity auto-logging,
// data-integrity invariants, AND no-regression on neighbouring modules.
//
// Usage:
//   1. Start a dev server: PORT=4321 node server.js
//   2. node scripts/test-sales-crm-stage-g.js [--port=4321]

require('dotenv').config();
const pool = require('../api/utils/db');

const PORT = (process.argv.find(a => a.startsWith('--port=')) || '--port=4321').split('=')[1];
const BASE = `http://localhost:${PORT}`;
const SECRET = process.env.INTERNAL_API_SECRET;
const HDRS = { 'x-internal-secret': SECRET, 'Content-Type': 'application/json' };

const failures = [];
const passes = [];

function assert(label, cond, detail = '') {
  if (cond) {
    passes.push(label);
    console.log(`  ✅ ${label}`);
  } else {
    failures.push({ label, detail });
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function fetchJSON(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { headers: HDRS, ...opts });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STAGE G — Sales CRM regression tests');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ════════════════════════════════
  // 1. SCHEMA SANITY
  // ════════════════════════════════
  console.log('[1] SCHEMA');
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('companies','people','hotel_people','hotel_activities','loss_reasons',
                         'agent_state','sales_outreach_drafts','agent_run_log','agent_telegram_messages')
  `);
  assert('all 9 Sales/agent tables exist', tables.length === 9, `got ${tables.length}`);

  const { rows: hotelCols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'hotels'
      AND column_name IN ('prospect_status','prospect_score','prospect_owner','company_id',
                          'last_agent_review_at','study_generated_at','study_artifact_url','booking_property_id')
  `);
  assert('all 8 prospect columns on hotels', hotelCols.length === 8, `got ${hotelCols.length}`);

  const { rows: triggers } = await pool.query(`
    SELECT event_object_table FROM information_schema.triggers
    WHERE trigger_name LIKE 'trg_%_updated_at'
  `);
  const triggerTables = triggers.map(t => t.event_object_table);
  for (const t of ['companies', 'people', 'hotel_people', 'agent_state']) {
    assert(`updated_at trigger on ${t}`, triggerTables.includes(t));
  }

  // ════════════════════════════════
  // 2. AUTH GATE
  // ════════════════════════════════
  console.log('\n[2] AUTH');
  const noAuth = await fetch(`${BASE}/api/sales/_health`).then(r => r.status);
  assert('GET /api/sales/_health without auth → 401', noAuth === 401, `got ${noAuth}`);

  const withAuth = await fetchJSON('/api/sales/_health');
  assert('GET /api/sales/_health with secret → 200 ok', withAuth.status === 200 && withAuth.body.ok === true);

  // ════════════════════════════════
  // 3. CORE READS
  // ════════════════════════════════
  console.log('\n[3] CORE READS');
  const companies = await fetchJSON('/api/sales/companies');
  assert('GET /companies → 200 array', companies.status === 200 && Array.isArray(companies.body));
  assert('companies has Vilenza Hotels', companies.body.some(c => c.name === 'Vilenza Hotels'));
  assert('companies has Shreeji Hospitality Group', companies.body.some(c => c.name === 'Shreeji Hospitality Group'));
  assert('companies has Mason & Fifth Ltd', companies.body.some(c => c.name === 'Mason & Fifth Ltd'));

  const prospects = await fetchJSON('/api/sales/prospects');
  assert('GET /prospects → 200 array', prospects.status === 200 && Array.isArray(prospects.body));
  assert('39+ prospects (39 managed live + 3 demo)', prospects.body.length >= 39, `got ${prospects.body.length}`);
  // Demo seed invariant: the 3 DEMO-prefixed prospects exist.
  // (Pin status-per-column was brittle — DnD legitimately moves cards.
  // Earlier asserts were drifting after every browser test. We now check
  // existence by booking_property_id, which the seed script owns.)
  const demos = prospects.body.filter(p => typeof p.booking_property_id === 'string' && p.booking_property_id.startsWith('DEMO-'));
  assert('demo seed: 3 DEMO-* prospects exist', demos.length === 3, `got ${demos.length}`);
  assert('demo seed: includes Bayswater Boutique',  demos.some(p => p.property_name === 'Bayswater Boutique'));
  assert('demo seed: includes Ellen Kensington',     demos.some(p => p.property_name === 'Ellen Kensington'));
  assert('demo seed: includes Greenwich Quay Hotel', demos.some(p => p.property_name === 'Greenwich Quay Hotel'));

  const ellen = prospects.body.find(p => p.property_name === 'Ellen Kensington');
  assert('Ellen Kensington has score', ellen?.prospect_score != null, `score=${ellen?.prospect_score}`);
  assert('Ellen Kensington has study URL', !!ellen?.study_artifact_url);

  // ════════════════════════════════
  // 4. CREATE/UPDATE/DELETE LIFECYCLE
  // ════════════════════════════════
  console.log('\n[4] CREATE/UPDATE/DELETE');
  // Cleanup any leftover from a prior run
  await pool.query(`DELETE FROM companies WHERE name = 'Stage G Test Co'`);

  const create = await fetchJSON('/api/sales/companies', {
    method: 'POST',
    body: JSON.stringify({ name: 'Stage G Test Co', companies_house_number: 'TESTG001' }),
  });
  assert('POST /companies → 201', create.status === 201, `got ${create.status}`);
  const newId = create.body.id;

  const dup = await fetchJSON('/api/sales/companies', {
    method: 'POST',
    body: JSON.stringify({ name: 'Stage G Test Co' }),
  });
  assert('POST duplicate → 409', dup.status === 409, `got ${dup.status}`);

  const badCh = await fetchJSON('/api/sales/companies', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad CH Co', companies_house_number: '!!!' }),
  });
  assert('POST invalid CH → 400', badCh.status === 400, `got ${badCh.status}`);

  const patch = await fetchJSON(`/api/sales/companies/${newId}`, {
    method: 'PATCH',
    body: JSON.stringify({ website: 'stageg.test' }),
  });
  assert('PATCH /companies/:id → 200', patch.status === 200 && patch.body.website === 'stageg.test');

  const del = await fetchJSON(`/api/sales/companies/${newId}`, { method: 'DELETE' });
  assert('DELETE /companies/:id → 200', del.status === 200);

  const get404 = await fetchJSON(`/api/sales/companies/${newId}`);
  assert('GET deleted → 404', get404.status === 404);

  // ════════════════════════════════
  // 5. ACTIVITY AUTO-LOGGING ON STATUS CHANGE
  // ════════════════════════════════
  console.log('\n[5] ACTIVITY AUTO-LOGGING');
  const ellenId = ellen?.hotel_id;
  if (ellenId) {
    // Ensure Ellen starts in 'studied' regardless of prior runs
    await pool.query(`UPDATE hotels SET prospect_status = 'studied' WHERE hotel_id = $1`, [ellenId]);

    const before = await fetchJSON(`/api/sales/hotels/${ellenId}/activities?type=status_change&limit=200`);
    const beforeCount = before.body.length;

    await fetchJSON(`/api/sales/prospects/${ellenId}`, {
      method: 'PATCH',
      body: JSON.stringify({ prospect_status: 'outreached', actor: 'StageG', reason: 'regression test' }),
    });

    const after = await fetchJSON(`/api/sales/hotels/${ellenId}/activities?type=status_change&limit=200`);
    assert(
      'status change → activity auto-logged',
      after.body.length === beforeCount + 1,
      `before=${beforeCount} after=${after.body.length}`
    );
    assert(
      'logged actor + status delta correct',
      after.body[0]?.actor === 'StageG' && after.body[0]?.metadata?.new_status === 'outreached'
    );

    // Restore
    await pool.query(`UPDATE hotels SET prospect_status = 'studied' WHERE hotel_id = $1`, [ellenId]);
  } else {
    assert('ellen prospect found for activity test', false, 'demo seed missing');
  }

  // ════════════════════════════════
  // 6. DATA-INTEGRITY INVARIANTS
  // ════════════════════════════════
  console.log('\n[6] DATA INTEGRITY');
  const { rows: orphanHotels } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM hotels h
    WHERE h.company_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = h.company_id)
  `);
  assert('no orphaned hotel.company_id refs', orphanHotels[0].n === 0, `${orphanHotels[0].n} orphans`);

  const { rows: vilenzaHotels } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM hotels h
    JOIN companies c ON c.id = h.company_id
    WHERE c.name = 'Vilenza Hotels'
  `);
  assert('Vilenza Hotels has 8 hotels', vilenzaHotels[0].n === 8, `got ${vilenzaHotels[0].n}`);

  const { rows: managedLive } = await pool.query(`
    SELECT COUNT(*)::int AS n FROM hotels
    WHERE is_rockenue_managed = true AND is_disconnected = false AND prospect_status = 'live'
  `);
  assert('managed live hotels marked prospect_status=live', managedLive[0].n === 39, `got ${managedLive[0].n}`);

  const { rows: dupePeople } = await pool.query(`
    SELECT full_name, COUNT(*)::int AS n FROM people GROUP BY full_name HAVING COUNT(*) > 1
  `);
  assert('no duplicate people by full_name', dupePeople.length === 0, `dupes: ${dupePeople.map(d => d.full_name).join(', ')}`);

  // ════════════════════════════════
  // 7. NEIGHBOURING MODULES UNAFFECTED
  // ════════════════════════════════
  console.log('\n[7] NO REGRESSIONS');
  const tasks = await fetchJSON('/api/distribution/tasks');
  assert('Task module (/api/distribution/tasks) still returns 200', tasks.status === 200 && Array.isArray(tasks.body));

  const channels = await fetchJSON('/api/distribution/channels');
  assert('Distribution channels still load', channels.status === 200 && Array.isArray(channels.body));

  const sentinelHealth = await fetchJSON('/api/sentinel/health/fleet/summary');
  assert(
    'Sentinel health endpoint reachable',
    sentinelHealth.status === 200 || sentinelHealth.status === 401 || sentinelHealth.status === 403,
    `got ${sentinelHealth.status}`
  );

  // ════════════════════════════════
  // SUMMARY
  // ════════════════════════════════
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`PASS: ${passes.length}    FAIL: ${failures.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ''}`));
    process.exitCode = 1;
  }

  await pool.end();
}

run().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
