require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. hotel_activities timeline (immutable — no updated_at, no trigger)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_activities (
        id BIGSERIAL PRIMARY KEY,
        hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
        type VARCHAR(40) NOT NULL,
        actor VARCHAR(100),
        subject TEXT,
        body TEXT,
        artifact_url TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotel_activities_hotel_date
        ON hotel_activities(hotel_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotel_activities_type
        ON hotel_activities(type);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotel_activities_actor
        ON hotel_activities(actor);
    `);

    await client.query('COMMIT');
    console.log('[migration_016] Created hotel_activities table + 3 indexes (immutable, no updated_at)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_016] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
