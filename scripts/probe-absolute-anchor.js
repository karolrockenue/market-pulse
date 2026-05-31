/**
 * Validate absolute-anchored demand score vs current window-relative.
 * Anchor 0-100 to all-history P5/P95 (clamped) instead of the 90-day window.
 * Run: node scripts/probe-absolute-anchor.js
 */
require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const CITY = "london";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

async function main() {
  // One row per checkin date: latest-known WAP + supply (the observed market shape)
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (checkin_date) to_char(checkin_date,'YYYY-MM-DD') AS checkin_date,
            weighted_avg_price::float AS wap, total_results::int AS supply
     FROM market_availability_snapshots
     WHERE city_slug=$1 AND weighted_avg_price IS NOT NULL
     ORDER BY checkin_date, scraped_at DESC`,
    [CITY]
  );

  const pctile = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor((s.length - 1) * p)];
  };
  const waps = rows.map((r) => r.wap);
  const sups = rows.map((r) => r.supply);
  const wapLo = pctile(waps, 0.05), wapHi = pctile(waps, 0.95);
  const supLo = pctile(sups, 0.05), supHi = pctile(sups, 0.95);

  console.log("=== ABSOLUTE ANCHORS (all-history P5/P95) ===");
  console.log(`WAP    P5=£${Math.round(wapLo)}  P95=£${Math.round(wapHi)}`);
  console.log(`Supply P5=${Math.round(supLo)}  P95=${Math.round(supHi)}\n`);

  const absScore = (wap, supply) => {
    const priceScore = clamp01((wap - wapLo) / (wapHi - wapLo)) * 100;
    const supplyScarcity = (1 - clamp01((supply - supLo) / (supHi - supLo))) * 100;
    return Math.round(0.5 * supplyScarcity + 0.5 * priceScore);
  };

  // Compare Sundays: January (true trough) vs June (peak-season floor)
  const isSun = (d) => new Date(d + "T00:00:00Z").getUTCDay() === 0;
  const show = (label, monthPrefix) => {
    const set = rows.filter((r) => r.checkin_date.startsWith(monthPrefix) && isSun(r.checkin_date));
    console.log(`--- ${label} Sundays ---`);
    set.forEach((r) =>
      console.log(`${r.checkin_date}  WAP £${Math.round(r.wap)}  supply ${r.supply}  -> ABSOLUTE score ${absScore(r.wap, r.supply)}`)
    );
    if (set.length) {
      const scores = set.map((r) => absScore(r.wap, r.supply));
      console.log(`   range ${Math.min(...scores)}–${Math.max(...scores)}\n`);
    }
  };
  show("JANUARY", "2026-01");
  show("JUNE", "2026-06");

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
