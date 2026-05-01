require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        companies_house_number VARCHAR(20),
        company_type VARCHAR(50),
        primary_contact_id INTEGER,
        website TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Indexes
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_companies_name_lower
        ON companies (LOWER(name));
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_companies_ch_number
        ON companies (companies_house_number)
        WHERE companies_house_number IS NOT NULL;
    `);

    // 3. Shared updated_at trigger function (safe to re-create)
    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 4. Trigger on companies
    await client.query(`DROP TRIGGER IF EXISTS trg_companies_updated_at ON companies;`);
    await client.query(`
      CREATE TRIGGER trg_companies_updated_at
        BEFORE UPDATE ON companies
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    await client.query('COMMIT');
    console.log('[migration_013] Created companies table + 2 indexes + set_updated_at function + trigger');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration_013] Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
