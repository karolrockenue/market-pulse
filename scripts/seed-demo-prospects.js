// Seed 3 demo prospects across different pipeline columns to populate the
// Sales kanban for visual demo. Idempotent (find-or-create by property_name).
// Cleanable: all rows tagged is_rockenue_managed=false + booking_property_id starts with "DEMO-".

require('dotenv').config();
const pool = require('../api/utils/db');
const salesCrm = require('../api/services/sales-crm.service');

const DEMO_PROSPECTS = [
  {
    property_name: "Bayswater Boutique",
    city: "London",
    total_rooms: 64,
    booking_property_id: "DEMO-9001",
    prospect_status: "cold",
    prospect_owner: "Karol",
    parity_leak_pct: 24,                   // metadata stored on activity
    last_activity_summary: "Discovered via Booking.com search",
    activity_seed: [
      { type: "agent_research", actor: "agent:prospect_discoverer",
        subject: "Discovered via Booking.com search",
        body: "4-star, 64 keys, independent. Parity violations visible in Hotelbeds + Mr & Mrs Smith." },
    ],
    contact: null,
  },
  {
    property_name: "Ellen Kensington",
    city: "London",
    total_rooms: 78,
    booking_property_id: "DEMO-9020",
    prospect_status: "studied",
    prospect_score: 847.0,
    prospect_owner: "Karol",
    study_generated_at: new Date().toISOString(),
    study_artifact_url: "/studies/demo-9020/dashboard.html",
    parity_leak_pct: 34,
    b2b_coverage_pct: 22,
    last_activity_summary: "Study generated — 34% parity leak",
    activity_seed: [
      { type: "agent_research", actor: "agent:prospect_discoverer",
        subject: "Section 14 scrape complete",
        body: "147 rate rows captured across 5 OTAs + 2 metasearch. B2B leakage: 22% of inventory." },
      { type: "study_generated", actor: "agent:study_generator",
        subject: "Study generated",
        body: "Parity leak: 34%. B2B coverage: 22%. Top angle: deep-deal stack visible on Hotelbeds.",
        artifact_url: "/studies/demo-9020/dashboard.html" },
      { type: "prospect_scored", actor: "agent:prospect_scorer",
        body: "Score: 847 (size 1.2 × leak 1.9 × persona 1.5 × recency 1.0)" },
    ],
    contact: { full_name: "Eleanor Vance", job_title: "Owner", email: "eleanor@ellenkensington.demo", role: "owner" },
  },
  {
    property_name: "Greenwich Quay Hotel",
    city: "London",
    total_rooms: 88,
    booking_property_id: "DEMO-9040",
    prospect_status: "in_conversation",
    prospect_score: 778.0,
    prospect_owner: "Karol",
    last_activity_summary: "GM replied — interested in 15-min call",
    activity_seed: [
      { type: "email_sent", actor: "Karol",
        subject: "Quick parity question for Greenwich Quay",
        body: "Hi — noticed your Booking.com rates lag your direct site by ~12% on weekday stays. Worth a quick chat?" },
      { type: "email_received", actor: "agent:reply_triager",
        subject: "Re: Quick parity question",
        body: "Yes happy to chat. Thursday afternoon any good?" },
    ],
    contact: { full_name: "Marcus Hale", job_title: "GM", email: "marcus@greenwichquay.demo", role: "gm" },
  },
];

(async () => {
  const client = await pool.connect();
  const summary = { hotels_created: 0, hotels_existing: 0, activities_created: 0, contacts_linked: 0 };

  try {
    await client.query('BEGIN');

    for (const p of DEMO_PROSPECTS) {
      // 1. Upsert hotel row by booking_property_id (unique partial index already exists)
      const { rows: existingRows } = await client.query(
        `SELECT hotel_id FROM hotels WHERE booking_property_id = $1`,
        [p.booking_property_id]
      );

      let hotel_id;
      if (existingRows.length) {
        hotel_id = existingRows[0].hotel_id;
        // Refresh prospect fields on every run (so changes here propagate)
        await client.query(`
          UPDATE hotels SET
            property_name = $1, city = $2, total_rooms = $3,
            prospect_status = $4, prospect_score = $5, prospect_owner = $6,
            study_generated_at = $7, study_artifact_url = $8,
            last_agent_review_at = NOW()
          WHERE hotel_id = $9
        `, [
          p.property_name, p.city, p.total_rooms,
          p.prospect_status, p.prospect_score ?? null, p.prospect_owner ?? null,
          p.study_generated_at ?? null, p.study_artifact_url ?? null,
          hotel_id,
        ]);
        summary.hotels_existing++;
      } else {
        const { rows: created } = await client.query(`
          INSERT INTO hotels (
            property_name, city, country, currency_code, total_rooms,
            booking_property_id, is_rockenue_managed, is_disconnected,
            prospect_status, prospect_score, prospect_owner,
            study_generated_at, study_artifact_url, last_agent_review_at,
            management_group, pricing_model
          ) VALUES (
            $1, $2, 'GB', 'GBP', $3,
            $4, false, false,
            $5, $6, $7,
            $8, $9, NOW(),
            'Prospect', 'inclusive'
          )
          RETURNING hotel_id
        `, [
          p.property_name, p.city, p.total_rooms,
          p.booking_property_id,
          p.prospect_status, p.prospect_score ?? null, p.prospect_owner ?? null,
          p.study_generated_at ?? null, p.study_artifact_url ?? null,
        ]);
        hotel_id = created[0].hotel_id;
        summary.hotels_created++;
      }

      // 2. Optional contact
      if (p.contact) {
        const existingPerson = (await client.query(
          `SELECT id FROM people WHERE LOWER(email) = LOWER($1) OR LOWER(full_name) = LOWER($2)`,
          [p.contact.email, p.contact.full_name]
        )).rows[0];

        let person;
        if (existingPerson) {
          person = existingPerson;
        } else {
          person = await salesCrm.upsertPerson({
            full_name: p.contact.full_name,
            email: p.contact.email,
            job_title: p.contact.job_title,
            notes: 'Demo seed',
          }, client);
        }

        await salesCrm.linkHotelPerson(
          hotel_id, person.id, p.contact.role,
          { is_primary: true, notes: 'Demo seed' },
          client
        );
        summary.contacts_linked++;
      }

      // 3. Activity seed (only if no activities yet for this hotel — to avoid pile-up on rerun)
      const { rows: existingActivities } = await client.query(
        `SELECT COUNT(*)::int AS n FROM hotel_activities WHERE hotel_id = $1`,
        [hotel_id]
      );
      if (existingActivities[0].n === 0 && p.activity_seed.length) {
        for (const a of p.activity_seed) {
          await salesCrm.recordActivity({
            hotel_id,
            type: a.type,
            actor: a.actor,
            subject: a.subject,
            body: a.body,
            artifact_url: a.artifact_url,
            metadata: {
              ...(p.parity_leak_pct !== undefined ? { parity_leak_pct: p.parity_leak_pct } : {}),
              ...(p.b2b_coverage_pct !== undefined ? { b2b_coverage_pct: p.b2b_coverage_pct } : {}),
            },
          }, client);
          summary.activities_created++;
        }
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Demo prospects seeded.\n');
    console.table(Object.entries(summary).map(([metric, value]) => ({ metric, value })));
    console.log('\nTo remove: DELETE FROM hotels WHERE booking_property_id LIKE \'DEMO-%\'; (cascades to people/activities/links)');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
