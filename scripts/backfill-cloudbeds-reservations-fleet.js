/**
 * Fleet-wide reservation history backfill for all connected Cloudbeds hotels.
 *
 * Wraps scripts/backfill-reservations-by-checkin.js per hotel:
 *   checkInFrom = go_live_date (fallback 2023-01-01)
 *   checkInTo   = current MIN(check_in) in `reservations` + 1 day overlap
 *                 (or 2027-12-31 if the hotel has no rows yet)
 *
 * Hotels whose existing data already reaches back to go_live are skipped.
 * Elysee Hyde Park (315473) is excluded — off-boarded 2026-05-29.
 *
 * Usage:
 *   node scripts/backfill-cloudbeds-reservations-fleet.js [--dry-run] [hotel_id ...]
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const { run } = require('./backfill-reservations-by-checkin');

const EXCLUDED_HOTEL_IDS = [315473];
const FALLBACK_FROM = '2023-01-01';
const FAR_FUTURE_TO = '2027-12-31';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyIds = args.filter((a) => /^\d+$/.test(a)).map(Number);

  const { rows: hotels } = await pool.query(
    `SELECT h.hotel_id, h.property_name, h.go_live_date::text AS go_live,
            (MIN(r.check_in) + INTERVAL '1 day')::date::text AS backfill_to,
            COUNT(r.id)::int AS existing_rows
       FROM hotels h
       LEFT JOIN reservations r ON r.hotel_id = h.hotel_id
      WHERE h.pms_type = 'cloudbeds'
        AND EXISTS (
          SELECT 1 FROM user_properties up
           WHERE up.property_id = h.hotel_id
             AND up.pms_credentials->>'refresh_token' IS NOT NULL
        )
        AND h.hotel_id <> ALL($1::int[])
      GROUP BY h.hotel_id, h.property_name, h.go_live_date
      ORDER BY h.property_name`,
    [EXCLUDED_HOTEL_IDS],
  );

  const targets = hotels
    .filter((h) => onlyIds.length === 0 || onlyIds.includes(h.hotel_id))
    .map((h) => ({
      ...h,
      from: h.go_live || FALLBACK_FROM,
      to: h.backfill_to || FAR_FUTURE_TO,
    }))
    // Cloudbeds v1.3 ignores checkIn filters and returns full history, so each
    // run is a full-history pull. Skip hotels already covered back to go-live
    // (existing min check_in within 2 days of go_live).
    .filter((h) => {
      const gapDays = (new Date(h.to) - new Date(h.from)) / 86400000;
      return gapDays > 2;
    });

  console.log(`[Fleet Backfill] ${targets.length} hotels to process${dryRun ? ' (DRY RUN)' : ''}:\n`);
  console.table(targets.map((h) => ({
    hotel_id: h.hotel_id,
    name: h.property_name,
    from: h.from,
    to: h.to,
    existing_rows: h.existing_rows,
  })));

  if (dryRun) return;

  const results = [];
  for (const h of targets) {
    try {
      await run(h.hotel_id, h.from, h.to);
      results.push({ hotel_id: h.hotel_id, name: h.property_name, result: 'OK' });
    } catch (err) {
      console.error(`[Fleet Backfill] FAILED ${h.property_name} (${h.hotel_id}): ${err.message}`);
      results.push({ hotel_id: h.hotel_id, name: h.property_name, result: `FAILED: ${err.message.substring(0, 80)}` });
    }
    await sleep(2000);
  }

  console.log('\n[Fleet Backfill] Summary:');
  console.table(results);
}

main()
  .catch((err) => { console.error('[Fleet Backfill] Fatal:', err); process.exitCode = 1; })
  .finally(() => pool.end());
