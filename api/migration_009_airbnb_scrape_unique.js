// Migration: add scrape_unique_properties column to airbnb_availability_snapshots
//
// Purpose: enable per-date occupancy proxy. Each row gets the count of unique
// properties seen across the *entire scrape* (all 90 forward dates) on that
// scrape day. With this, per-date occupancy ≈ 1 − total_listings / scrape_unique_properties.
//
// The column is denormalised (same value across the 90 rows of a single
// scrape) but the storage cost is trivial and it makes downstream queries
// trivially fast — no per-query union of 90 days.
//
// To run: `node api/migration_009_airbnb_scrape_unique.js`

require('dotenv').config();
const pool = require('./utils/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add the column (idempotent)
    await client.query(`
      ALTER TABLE airbnb_availability_snapshots
      ADD COLUMN IF NOT EXISTS scrape_unique_properties INT;
    `);

    // Backfill: for every (city_slug, scrape_date) tuple already in the
    // table, count distinct (name, type, beds, lat, lng) tuples and write
    // that count back to all matching rows.
    const result = await client.query(`
      WITH scrape_props AS (
        SELECT DISTINCT
          s.city_slug,
          s.scraped_at::date AS scrape_date,
          listing->>'name' AS name,
          listing->>'type' AS type,
          listing->>'beds' AS beds,
          (listing->>'lat')::numeric AS lat,
          (listing->>'lng')::numeric AS lng
        FROM airbnb_availability_snapshots s,
             jsonb_array_elements(s.listings) AS listing
        WHERE s.listings IS NOT NULL
      ),
      scrape_uniques AS (
        SELECT city_slug, scrape_date, COUNT(*) AS unique_count
        FROM scrape_props
        GROUP BY city_slug, scrape_date
      )
      UPDATE airbnb_availability_snapshots a
      SET scrape_unique_properties = u.unique_count
      FROM scrape_uniques u
      WHERE a.city_slug = u.city_slug
        AND a.scraped_at::date = u.scrape_date;
    `);

    await client.query('COMMIT');
    console.log(`Migration complete: scrape_unique_properties column added and backfilled. Rows updated: ${result.rowCount}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
