require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. people table
    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT,
        phone VARCHAR(50),
        whatsapp VARCHAR(50),
        linkedin_url TEXT,
        job_title TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Indexes
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_email_lower
        ON people (LOWER(email))
        WHERE email IS NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_people_whatsapp
        ON people (whatsapp)
        WHERE whatsapp IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_people_name_lower
        ON people (LOWER(full_name));
    `);

    // 3. updated_at trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_people_updated_at ON people;`);
    await client.query(`
      CREATE TRIGGER trg_people_updated_at
        BEFORE UPDATE ON people
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    // 4. Deferred FK from companies.primary_contact_id → people.id
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_companies_primary_contact'
        ) THEN
          ALTER TABLE companies
            ADD CONSTRAINT fk_companies_primary_contact
            FOREIGN KEY (primary_contact_id) REFERENCES people(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query('COMMIT');
    console.log('[migration_014] Created people table + 3 indexes + trigger + companies.primary_contact_id FK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_014] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
