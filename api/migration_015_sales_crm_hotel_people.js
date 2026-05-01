require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. hotel_people join table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_people (
        hotel_id INTEGER NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (hotel_id, person_id, role)
      );
    `);

    // 2. Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotel_people_hotel ON hotel_people(hotel_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hotel_people_person ON hotel_people(person_id);
    `);

    // At most one primary contact per role per hotel
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_people_primary
        ON hotel_people(hotel_id, role)
        WHERE is_primary = TRUE;
    `);

    // 3. updated_at trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_hotel_people_updated_at ON hotel_people;`);
    await client.query(`
      CREATE TRIGGER trg_hotel_people_updated_at
        BEFORE UPDATE ON hotel_people
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    await client.query('COMMIT');
    console.log('[migration_015] Created hotel_people table + composite PK + 3 indexes + trigger');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_015] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
