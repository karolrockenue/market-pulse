// Sales CRM Stage F backfill — populates companies/people/hotel_people from existing hotels data.
// Idempotent: re-running is safe (find-or-create semantics).
//
// What it does:
//   1. Creates a company per non-Independent management_group (Shreeji, Vilenza, Mason & Fifth)
//   2. Creates one company per hotel in "Independent" bucket (each is its own operating entity)
//   3. Links hotels.company_id to the matching company
//   4. Inserts known owners (Minaz Asaria → Elysee, Robert Gabriele → The Melita)
//   5. Sets prospect_status='live' for managed live hotels, 'churned' for disconnected
//
// Hotels with NULL management_group (Archanes/Mykonos Market Watch, Durrant House, Park Hotel)
// are skipped — no clear company to link them to.

require('dotenv').config();
const pool = require('../api/utils/db');
const salesCrm = require('../api/services/sales-crm.service');

// ─────────────────────────────────────────────
// Group → company mapping (the non-independent buckets)
// ─────────────────────────────────────────────
const GROUP_COMPANIES = [
  { management_group: 'Shreeji',       company_name: 'Shreeji Hospitality Group', company_type: 'holding_co' },
  { management_group: 'Vilenza',       company_name: 'Vilenza Hotels',             company_type: 'management_co' },
  { management_group: 'Mason & Fifth', company_name: 'Mason & Fifth Ltd',          company_type: 'operating_co' },
];

// ─────────────────────────────────────────────
// Known people (Blueprint §6 + master plan memory)
// ─────────────────────────────────────────────
const KNOWN_PEOPLE = [
  { hotel_name: 'Elysee Hyde Park',     full_name: 'Minaz Asaria',     role: 'owner' },
  { hotel_name: 'The Melita, London',   full_name: 'Robert Gabriele',  role: 'asset_manager' },
];

(async () => {
  const client = await pool.connect();
  const summary = {
    companies_created: 0,
    companies_existing: 0,
    hotels_linked_to_company: 0,
    hotels_status_live: 0,
    hotels_status_churned: 0,
    hotels_skipped_no_group: [],
    people_created: 0,
    people_existing: 0,
    hotel_people_linked: 0,
    hotel_people_skipped: [],
  };

  try {
    await client.query('BEGIN');

    // ── 1. Group companies ─────────────────────
    const groupCompanyId = {}; // management_group -> company.id
    for (const grp of GROUP_COMPANIES) {
      const before = (await client.query(
        `SELECT id FROM companies WHERE LOWER(name) = LOWER($1)`,
        [grp.company_name]
      )).rows[0];
      const company = await salesCrm.upsertCompany({
        name: grp.company_name,
        company_type: grp.company_type,
      }, client);
      groupCompanyId[grp.management_group] = company.id;
      if (before) summary.companies_existing++;
      else summary.companies_created++;
    }

    // ── 2. Independent companies — one per hotel ──
    const { rows: independents } = await client.query(`
      SELECT hotel_id, property_name FROM hotels
      WHERE management_group = 'Independent' AND is_rockenue_managed = true
      ORDER BY property_name
    `);
    const independentCompanyId = {}; // hotel_id -> company.id
    for (const h of independents) {
      const before = (await client.query(
        `SELECT id FROM companies WHERE LOWER(name) = LOWER($1)`,
        [h.property_name]
      )).rows[0];
      const company = await salesCrm.upsertCompany({
        name: h.property_name,
        company_type: 'unknown',
        notes: 'Auto-backfill: independent property, exact operating entity unknown.',
      }, client);
      independentCompanyId[h.hotel_id] = company.id;
      if (before) summary.companies_existing++;
      else summary.companies_created++;
    }

    // ── 3. Link hotels.company_id ──────────────
    const { rows: managed } = await client.query(`
      SELECT hotel_id, property_name, management_group, is_disconnected
      FROM hotels
      WHERE is_rockenue_managed = true
    `);
    for (const h of managed) {
      let companyId = null;
      if (h.management_group === 'Independent') {
        companyId = independentCompanyId[h.hotel_id];
      } else if (h.management_group && groupCompanyId[h.management_group]) {
        companyId = groupCompanyId[h.management_group];
      } else {
        summary.hotels_skipped_no_group.push(h.property_name);
        continue;
      }
      await client.query(
        `UPDATE hotels SET company_id = $1 WHERE hotel_id = $2`,
        [companyId, h.hotel_id]
      );
      summary.hotels_linked_to_company++;
    }

    // ── 4. Known people ────────────────────────
    for (const known of KNOWN_PEOPLE) {
      const { rows: hotelRows } = await client.query(
        `SELECT hotel_id FROM hotels WHERE property_name = $1`,
        [known.hotel_name]
      );
      if (hotelRows.length === 0) {
        summary.hotel_people_skipped.push(`${known.full_name} → ${known.hotel_name} (hotel not found)`);
        continue;
      }
      const hotel_id = hotelRows[0].hotel_id;

      // upsertPerson dedupes only by email/whatsapp — for name-only known people we
      // must short-circuit explicitly or we'd create a duplicate on every re-run.
      const existing = (await client.query(
        `SELECT * FROM people WHERE LOWER(full_name) = LOWER($1)`,
        [known.full_name]
      )).rows[0];

      let person;
      if (existing) {
        person = existing;
        summary.people_existing++;
      } else {
        person = await salesCrm.upsertPerson({
          full_name: known.full_name,
          notes: 'Auto-backfill from Blueprint §6.',
        }, client);
        summary.people_created++;
      }

      await salesCrm.linkHotelPerson(
        hotel_id, person.id, known.role,
        { is_primary: true, notes: 'Auto-backfill' },
        client
      );
      summary.hotel_people_linked++;
    }

    // ── 5. prospect_status for managed hotels ──
    // 'live' for currently-active managed; 'churned' for disconnected
    const liveResult = await client.query(`
      UPDATE hotels SET prospect_status = 'live'
      WHERE is_rockenue_managed = true
        AND is_disconnected = false
        AND (prospect_status IS NULL OR prospect_status NOT IN ('live', 'churned'))
    `);
    summary.hotels_status_live = liveResult.rowCount;

    const churnedResult = await client.query(`
      UPDATE hotels SET prospect_status = 'churned'
      WHERE is_rockenue_managed = true
        AND is_disconnected = true
        AND (prospect_status IS NULL OR prospect_status <> 'churned')
    `);
    summary.hotels_status_churned = churnedResult.rowCount;

    await client.query('COMMIT');

    console.log('\n✅ Backfill complete.\n');
    console.table([
      ['companies_created', summary.companies_created],
      ['companies_existing (skipped)', summary.companies_existing],
      ['hotels linked to company', summary.hotels_linked_to_company],
      ['hotels skipped (no group)', summary.hotels_skipped_no_group.length],
      ['hotels → prospect_status=live', summary.hotels_status_live],
      ['hotels → prospect_status=churned', summary.hotels_status_churned],
      ['people_created', summary.people_created],
      ['people_existing (skipped)', summary.people_existing],
      ['hotel_people links', summary.hotel_people_linked],
    ].map(([k, v]) => ({ metric: k, value: v })));

    if (summary.hotels_skipped_no_group.length) {
      console.log('\nHotels skipped (no management_group):');
      summary.hotels_skipped_no_group.forEach(h => console.log(`  - ${h}`));
    }
    if (summary.hotel_people_skipped.length) {
      console.log('\nPeople links skipped:');
      summary.hotel_people_skipped.forEach(s => console.log(`  - ${s}`));
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Backfill failed (transaction rolled back):', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
