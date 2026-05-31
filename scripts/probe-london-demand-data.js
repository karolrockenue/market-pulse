/**
 * Inventory probe for London market_availability_snapshots.
 * What do we actually have to build better demand forecasting on?
 * Run: node scripts/probe-london-demand-data.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CITY = "london";

async function main() {
  // 1. Overall coverage
  const cov = await pool.query(
    `SELECT
       COUNT(*) AS rows,
       MIN((scraped_at AT TIME ZONE 'UTC')::date) AS first_scrape,
       MAX((scraped_at AT TIME ZONE 'UTC')::date) AS last_scrape,
       COUNT(DISTINCT (scraped_at AT TIME ZONE 'UTC')::date) AS distinct_scrape_days,
       MIN(checkin_date) AS first_checkin,
       MAX(checkin_date) AS last_checkin,
       COUNT(DISTINCT checkin_date) AS distinct_checkins
     FROM market_availability_snapshots WHERE city_slug=$1`,
    [CITY]
  );
  console.log("=== 1. COVERAGE ===");
  console.table(cov.rows);

  // 2. Scrape-day density per month (how many days did the cron actually run)
  const dens = await pool.query(
    `SELECT to_char((scraped_at AT TIME ZONE 'UTC')::date,'YYYY-MM') AS month,
            COUNT(DISTINCT (scraped_at AT TIME ZONE 'UTC')::date) AS scrape_days,
            COUNT(*) AS rows
     FROM market_availability_snapshots WHERE city_slug=$1
     GROUP BY 1 ORDER BY 1`,
    [CITY]
  );
  console.log("\n=== 2. SCRAPE-DAY DENSITY PER MONTH ===");
  console.table(dens.rows);

  // 3. Field completeness on latest scrape
  const comp = await pool.query(
    `WITH latest AS (
       SELECT MAX((scraped_at AT TIME ZONE 'UTC')::date) AS d
       FROM market_availability_snapshots WHERE city_slug=$1)
     SELECT COUNT(*) AS rows,
       COUNT(weighted_avg_price) AS has_wap,
       COUNT(total_results) AS has_supply,
       COUNT(facet_price_histogram) AS has_histogram,
       COUNT(facet_star_rating) AS has_star_facet,
       COUNT(min_price_anchor) AS has_min_anchor
     FROM market_availability_snapshots, latest
     WHERE city_slug=$1 AND (scraped_at AT TIME ZONE 'UTC')::date = latest.d`,
    [CITY]
  );
  console.log("\n=== 3. FIELD COMPLETENESS (latest scrape day) ===");
  console.table(comp.rows);

  // 4. Lead-time depth: for a fixed check-in date, how many distinct lead times did we capture?
  // This is the asset that enables pace/fill-curve analysis.
  const lead = await pool.query(
    `WITH per_checkin AS (
       SELECT checkin_date,
              COUNT(DISTINCT (scraped_at AT TIME ZONE 'UTC')::date) AS snapshots,
              MAX(checkin_date - (scraped_at AT TIME ZONE 'UTC')::date) AS max_lead_days,
              MIN(checkin_date - (scraped_at AT TIME ZONE 'UTC')::date) AS min_lead_days
       FROM market_availability_snapshots
       WHERE city_slug=$1 AND checkin_date <= (SELECT MAX((scraped_at AT TIME ZONE 'UTC')::date) FROM market_availability_snapshots WHERE city_slug=$1)
       GROUP BY checkin_date)
     SELECT
       ROUND(AVG(snapshots),1) AS avg_snapshots_per_checkin,
       MAX(snapshots) AS max_snapshots,
       ROUND(AVG(max_lead_days),1) AS avg_max_lead,
       COUNT(*) FILTER (WHERE snapshots >= 30) AS checkins_with_30plus_snaps,
       COUNT(*) AS total_past_checkins
     FROM per_checkin`,
    [CITY]
  );
  console.log("\n=== 4. LEAD-TIME DEPTH (fill-curve feasibility) ===");
  console.table(lead.rows);

  // 5. Seasonal range already observed: monthly avg WAP + supply by check-in month
  const seas = await pool.query(
    `WITH latest_priced AS (
       SELECT DISTINCT ON (checkin_date) checkin_date, weighted_avg_price, total_results
       FROM market_availability_snapshots
       WHERE city_slug=$1 AND weighted_avg_price IS NOT NULL
       ORDER BY checkin_date, scraped_at DESC)
     SELECT to_char(checkin_date,'YYYY-MM') AS checkin_month,
            COUNT(*) AS days,
            ROUND(AVG(weighted_avg_price)) AS avg_wap,
            ROUND(MIN(weighted_avg_price)) AS min_wap,
            ROUND(MAX(weighted_avg_price)) AS max_wap,
            ROUND(AVG(total_results)) AS avg_supply
     FROM latest_priced GROUP BY 1 ORDER BY 1`,
    [CITY]
  );
  console.log("\n=== 5. SEASONAL SHAPE OBSERVED (latest-known price per checkin) ===");
  console.table(seas.rows);

  // 6. Day-of-week signal strength (is DOW a usable baseline dimension?)
  const dow = await pool.query(
    `WITH latest_priced AS (
       SELECT DISTINCT ON (checkin_date) checkin_date, weighted_avg_price, total_results
       FROM market_availability_snapshots
       WHERE city_slug=$1 AND weighted_avg_price IS NOT NULL
       ORDER BY checkin_date, scraped_at DESC)
     SELECT trim(to_char(checkin_date,'Day')) AS dow,
            ROUND(AVG(weighted_avg_price)) AS avg_wap,
            ROUND(AVG(total_results)) AS avg_supply,
            COUNT(*) AS days
     FROM latest_priced GROUP BY 1, EXTRACT(DOW FROM checkin_date) ORDER BY EXTRACT(DOW FROM checkin_date)`,
    [CITY]
  );
  console.log("\n=== 6. DAY-OF-WEEK SIGNAL ===");
  console.table(dow.rows);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
