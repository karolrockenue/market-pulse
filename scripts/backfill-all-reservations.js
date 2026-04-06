/**
 * Backfill reservations for ALL active hotels, sequentially.
 *
 * Usage:
 *   node scripts/backfill-all-reservations.js [days]
 *
 * Default: last 14 days. Skips already-backfilled hotels (those with reservations in the date range).
 * Cloudbeds hotels are slow (~3-5 min each due to per-reservation API calls).
 * Mews hotels are fast (~30s each, bulk API).
 */

require('dotenv').config();
const { execSync } = require('child_process');
const pool = require('../api/utils/db');

async function run() {
  const days = parseInt(process.argv[2]) || 14;

  // Get all active hotels with a valid PMS type
  const result = await pool.query(`
    SELECT hotel_id, property_name, pms_type
    FROM hotels
    WHERE is_disconnected = false AND pms_type IS NOT NULL
    ORDER BY pms_type DESC, hotel_id
  `);

  const hotels = result.rows;
  console.log(`\n[Backfill All] ${hotels.length} hotels to process (${days} days)\n`);

  // Check which hotels already have data in the date range
  const existing = await pool.query(`
    SELECT DISTINCT hotel_id FROM reservations
    WHERE booking_date >= CURRENT_DATE - $1::int
  `, [days]);
  const alreadyDone = new Set(existing.rows.map(r => r.hotel_id));

  let completed = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const hotel of hotels) {
    if (alreadyDone.has(hotel.hotel_id)) {
      console.log(`[${hotel.hotel_id}] ${hotel.property_name} — already has data, skipping`);
      skippedExisting++;
      continue;
    }

    console.log(`\n[${hotel.hotel_id}] ${hotel.property_name} (${hotel.pms_type}) — starting...`);
    const start = Date.now();

    try {
      execSync(`node scripts/backfill-reservations.js ${hotel.hotel_id} ${days}`, {
        stdio: 'inherit',
        timeout: 600000, // 10 min max per hotel
      });
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[${hotel.hotel_id}] Done in ${elapsed}s`);
      completed++;
    } catch (err) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.error(`[${hotel.hotel_id}] FAILED after ${elapsed}s: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n[Backfill All] Complete.`);
  console.log(`  Processed: ${completed}`);
  console.log(`  Skipped (existing): ${skippedExisting}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total hotels: ${hotels.length}`);

  await pool.end();
}

run().catch(err => {
  console.error('[Backfill All] Fatal:', err);
  process.exit(1);
});
