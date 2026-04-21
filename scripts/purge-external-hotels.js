require('dotenv').config();
const pool = require('../api/utils/db');

const HOTELS_TO_PURGE = [
  { id: 2400,   name: 'Astor Victoria' },
  { id: 318318, name: 'Brickell Apart Hotel' },
  { id: 318320, name: 'Hotel Tano Guam' },
];
const REASON = 'External hotel removed 2026-04-20; daily_metrics_snapshots retained for market analysis.';

async function purgeOne(client, hotelId) {
  console.log(`\n── Purging hotel_id=${hotelId} ──`);

  const meta = await client.query(
    `SELECT hotel_id, property_name, city, country, total_rooms, latitude, longitude,
            pms_type, pms_property_id, management_group
       FROM hotels WHERE hotel_id = $1`,
    [hotelId]
  );
  if (meta.rows.length === 0) {
    console.log('  (hotel row not found — skipping)');
    return;
  }
  const h = meta.rows[0];

  await client.query(
    `INSERT INTO deleted_hotels_archive
       (hotel_id, property_name, city, country, total_rooms, latitude, longitude,
        pms_type, pms_property_id, management_group, deleted_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (hotel_id) DO UPDATE SET
       property_name = EXCLUDED.property_name,
       deleted_at = NOW(),
       deleted_reason = EXCLUDED.deleted_reason`,
    [h.hotel_id, h.property_name, h.city, h.country, h.total_rooms, h.latitude, h.longitude,
     h.pms_type, h.pms_property_id, h.management_group, REASON]
  );
  console.log(`  archived: ${h.property_name} (${h.city || '?'}, ${h.total_rooms || '?'} rms)`);

  // Integer hotel_id tables
  const intTables = [
    'crm_tasks',
    'daily_bookings_record',
    'distribution_hotel_channels',
    'distribution_hotel_pricing_overrides',
    'hotel_budgets',
    'mews_webhook_state',
    'pacing_snapshots',
    'reservations',
    'sentinel_ai_predictions',
    'sentinel_configurations',
    'sentinel_daily_max_rates',
    'sentinel_daily_min_rates',
    'sentinel_job_queue',
    'sentinel_notifications',
    'sentinel_pace_curves',
    'sentinel_price_history',
    'sentinel_rates_calendar',
  ];
  for (const t of intTables) {
    const r = await client.query(`DELETE FROM ${t} WHERE hotel_id = $1`, [hotelId]);
    if (r.rowCount > 0) console.log(`  ${t}: ${r.rowCount} rows`);
  }

  // competitor side of comp set
  const compResult = await client.query(
    `DELETE FROM hotel_comp_sets WHERE hotel_id = $1 OR competitor_hotel_id = $1`,
    [hotelId]
  );
  if (compResult.rowCount > 0) console.log(`  hotel_comp_sets: ${compResult.rowCount} rows`);

  // Text/varchar property_id tables
  const textTables = ['scheduled_reports', 'user_invitations', 'user_properties'];
  for (const t of textTables) {
    const r = await client.query(`DELETE FROM ${t} WHERE property_id = $1`, [String(hotelId)]);
    if (r.rowCount > 0) console.log(`  ${t}: ${r.rowCount} rows`);
  }

  const rAssets = await client.query(
    `DELETE FROM rockenue_managed_assets WHERE market_pulse_hotel_id = $1`,
    [String(hotelId)]
  );
  if (rAssets.rowCount > 0) console.log(`  rockenue_managed_assets: ${rAssets.rowCount} rows`);

  const rHotel = await client.query(`DELETE FROM hotels WHERE hotel_id = $1`, [hotelId]);
  console.log(`  hotels: ${rHotel.rowCount} row`);

  const keep = await client.query(
    `SELECT COUNT(*)::int AS n FROM daily_metrics_snapshots WHERE hotel_id = $1`,
    [hotelId]
  );
  console.log(`  daily_metrics_snapshots: KEPT (${keep.rows[0].n} rows preserved for market analysis)`);
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const h of HOTELS_TO_PURGE) {
      await purgeOne(client, h.id);
    }
    await client.query('COMMIT');
    console.log('\n✓ Purge committed.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\n✗ Purge failed — rolled back.');
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

run();
