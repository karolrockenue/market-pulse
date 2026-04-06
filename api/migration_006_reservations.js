// Migration: Create reservations table
// Stores individual reservation details (90-day rolling window).
// To run: `node api/migration_006_reservations.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id              VARCHAR(255) NOT NULL,
        hotel_id        INTEGER NOT NULL,
        guest_name      VARCHAR(255),
        room_type       VARCHAR(255),
        check_in        DATE NOT NULL,
        check_out       DATE NOT NULL,
        nights          INTEGER NOT NULL DEFAULT 1,
        source          VARCHAR(100),
        avg_nightly_rate NUMERIC,
        total_rate      NUMERIC,
        status          VARCHAR(50),
        booking_date    DATE NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, hotel_id)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_hotel_booking_date
      ON reservations (hotel_id, booking_date DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_hotel_check_in
      ON reservations (hotel_id, check_in);
    `);

    await client.query('COMMIT');
    console.log('Migration complete: reservations table created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
