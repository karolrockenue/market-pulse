require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS deleted_hotels_archive (
        hotel_id         INTEGER PRIMARY KEY,
        property_name    TEXT,
        city             TEXT,
        country          TEXT,
        total_rooms      INTEGER,
        latitude         NUMERIC,
        longitude        NUMERIC,
        pms_type         TEXT,
        pms_property_id  TEXT,
        management_group TEXT,
        deleted_at       TIMESTAMPTZ DEFAULT NOW(),
        deleted_reason   TEXT
      );
    `);
    console.log('deleted_hotels_archive table ready.');

    // Drop the FK from daily_metrics_snapshots → hotels so time-series can
    // outlive hotel offboarding. The archive table provides the join path
    // (hotel_id → name/city/etc) for deleted hotels.
    await client.query(`
      ALTER TABLE daily_metrics_snapshots
        DROP CONSTRAINT IF EXISTS daily_metrics_snapshots_hotel_id_fkey;
    `);
    console.log('daily_metrics_snapshots_hotel_id_fkey dropped (if it existed).');
  } finally {
    client.release();
    pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
