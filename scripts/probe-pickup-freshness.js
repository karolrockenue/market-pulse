require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const CITY = "london";

async function main() {
  // 1. Is the scrape fresh?
  const fresh = await pool.query(
    `SELECT MAX((scraped_at AT TIME ZONE 'UTC')::date) AS last_scrape,
            COUNT(DISTINCT (scraped_at AT TIME ZONE 'UTC')::date) FILTER (WHERE (scraped_at AT TIME ZONE 'UTC')::date >= (now()::date - 9)) AS scrape_days_last10
     FROM market_availability_snapshots WHERE city_slug=$1`, [CITY]);
  console.log("=== FRESHNESS ===");
  console.table(fresh.rows);

  // 2. The Jul-2 area: raw WAP for checkins 28 Jun–5 Jul, as seen across the last ~12 scrape days
  const spike = await pool.query(
    `SELECT to_char((scraped_at AT TIME ZONE 'UTC')::date,'MM-DD') AS scraped,
            to_char(checkin_date,'MM-DD') AS checkin,
            ROUND(weighted_avg_price) AS wap
     FROM market_availability_snapshots
     WHERE city_slug=$1
       AND checkin_date BETWEEN '2026-06-28' AND '2026-07-05'
       AND (scraped_at AT TIME ZONE 'UTC')::date >= (now()::date - 12)
       AND weighted_avg_price IS NOT NULL
     ORDER BY checkin_date, scraped_at DESC`, [CITY]);
  // pivot-ish print
  console.log("\n=== RAW WAP around Jul 2 (checkin x scrape-day) ===");
  console.table(spike.rows);

  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
