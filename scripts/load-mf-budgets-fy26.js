/**
 * Load Mason & Fifth FY26 budgets into hotel_service_budgets.
 *
 * Source: claude/M&F Budget Summary 26_27.xlsx (FY = Apr 2026 → Mar 2027).
 * Values are net of VAT, in GBP.
 *
 * Usage:
 *   node scripts/load-mf-budgets-fy26.js          # dry run
 *   node scripts/load-mf-budgets-fy26.js --apply  # actually write
 *
 * Idempotent: upserts on (hotel_id, year, month, service_role).
 *
 * Notes:
 * - FY spans two calendar years; rows are split into year=2026 (Apr-Dec)
 *   and year=2027 (Jan-Mar).
 * - Belsize uses 31-day rolling periods in the source. Mapped to the
 *   calendar month each period predominantly falls in. April = 0
 *   (pre-opening), property opens partway through May 2026.
 * - Belsize Mid/Long Stay are zeros across the FY by design (SS-only
 *   property in year 1).
 */

require('dotenv').config();
const pool = require('../api/utils/db');

const HOTELS = {
  318341: 'Westbourne Park',
  318343: 'Primrose Hill',
  318329: 'Belsize Park',
};

// All values net of VAT. Rounded to the penny from the source spreadsheet.
const BUDGETS = [
  // ── Westbourne Park (318341) ────────────────────────────────────
  // FY26 Apr 2026 → Mar 2027
  [318341, 2026,  4, 'short', 274543.94],
  [318341, 2026,  4, 'mid',   120797.66],
  [318341, 2026,  4, 'long',  420327.34], // VAT-dropped (was 446830.34 gross)
  [318341, 2026,  5, 'short', 348651.38],
  [318341, 2026,  5, 'mid',   126356.91],
  [318341, 2026,  5, 'long',  503134.85], // VAT-dropped
  [318341, 2026,  6, 'short', 379563.00],
  [318341, 2026,  6, 'mid',   121169.68],
  [318341, 2026,  6, 'long',  501923.19], // VAT-dropped
  [318341, 2026,  7, 'short', 409569.75],
  [318341, 2026,  7, 'mid',   116221.22],
  [318341, 2026,  7, 'long',  572334.44], // VAT-dropped
  [318341, 2026,  8, 'short', 390302.54],
  [318341, 2026,  8, 'mid',    99969.95],
  [318341, 2026,  8, 'long',  578623.83], // VAT-dropped
  [318341, 2026,  9, 'short', 346864.51],
  [318341, 2026,  9, 'mid',    77030.39],
  [318341, 2026,  9, 'long',  556239.42], // VAT-dropped
  [318341, 2026, 10, 'short', 293258.17],
  [318341, 2026, 10, 'mid',    53140.76],
  [318341, 2026, 10, 'long',  582026.36], // VAT-dropped
  [318341, 2026, 11, 'short', 330069.68],
  [318341, 2026, 11, 'mid',    47871.66],
  [318341, 2026, 11, 'long',  555645.06], // VAT-dropped
  [318341, 2026, 12, 'short', 360197.54],
  [318341, 2026, 12, 'mid',    40032.70],
  [318341, 2026, 12, 'long',  567334.88], // VAT-dropped
  [318341, 2027,  1, 'short', 215481.01],
  [318341, 2027,  1, 'mid',    16070.37],
  [318341, 2027,  1, 'long',  585169.92], // VAT-dropped
  [318341, 2027,  2, 'short', 225722.42],
  [318341, 2027,  2, 'mid',    16012.98],
  [318341, 2027,  2, 'long',  549867.84], // VAT-dropped
  [318341, 2027,  3, 'short', 268040.80],
  [318341, 2027,  3, 'mid',     9507.55],
  [318341, 2027,  3, 'long',  615252.97], // VAT-dropped

  // ── Primrose Hill (318343) ──────────────────────────────────────
  [318343, 2026,  4, 'short', 195038.63],
  [318343, 2026,  4, 'mid',    13623.73],
  [318343, 2026,  4, 'long',   12071.40],
  [318343, 2026,  5, 'short', 238888.85],
  [318343, 2026,  5, 'mid',    22931.51],
  [318343, 2026,  5, 'long',    7936.29],
  [318343, 2026,  6, 'short', 266709.73],
  [318343, 2026,  6, 'mid',    28114.85],
  [318343, 2026,  6, 'long',    9705.32],
  [318343, 2026,  7, 'short', 285848.76],
  [318343, 2026,  7, 'mid',    32319.29],
  [318343, 2026,  7, 'long',    6381.21],
  [318343, 2026,  8, 'short', 273703.95],
  [318343, 2026,  8, 'mid',    35352.75],
  [318343, 2026,  8, 'long',    4836.23],
  [318343, 2026,  9, 'short', 250282.91],
  [318343, 2026,  9, 'mid',    31036.99],
  [318343, 2026,  9, 'long',    5688.92],
  [318343, 2026, 10, 'short', 250067.59],
  [318343, 2026, 10, 'mid',    12970.19],
  [318343, 2026, 10, 'long',   14112.04],
  [318343, 2026, 11, 'short', 238467.59],
  [318343, 2026, 11, 'mid',     5750.39],
  [318343, 2026, 11, 'long',   12071.40],
  [318343, 2026, 12, 'short', 256019.22],
  [318343, 2026, 12, 'mid',     6180.52],
  [318343, 2026, 12, 'long',   13169.64],
  [318343, 2027,  1, 'short', 166885.25],
  [318343, 2027,  1, 'mid',     3893.13],
  [318343, 2027,  1, 'long',   13455.94],
  [318343, 2027,  2, 'short', 171042.43],
  [318343, 2027,  2, 'mid',     3872.31],
  [318343, 2027,  2, 'long',   12670.93],
  [318343, 2027,  3, 'short', 197550.05],
  [318343, 2027,  3, 'mid',    11811.66],
  [318343, 2027,  3, 'long',   10014.78],

  // ── Belsize Park (318329) ───────────────────────────────────────
  // SS-only year 1. Apr 2026 = pre-opening (zero). Property opens
  // partway through May 2026. MS/LS budgeted at zero across FY.
  [318329, 2026,  4, 'short',      0.00],
  [318329, 2026,  4, 'mid',        0.00],
  [318329, 2026,  4, 'long',       0.00],
  [318329, 2026,  5, 'short',  67234.92],
  [318329, 2026,  5, 'mid',        0.00],
  [318329, 2026,  5, 'long',       0.00],
  [318329, 2026,  6, 'short', 204925.00],
  [318329, 2026,  6, 'mid',        0.00],
  [318329, 2026,  6, 'long',       0.00],
  [318329, 2026,  7, 'short', 245636.77],
  [318329, 2026,  7, 'mid',        0.00],
  [318329, 2026,  7, 'long',       0.00],
  [318329, 2026,  8, 'short', 219688.27],
  [318329, 2026,  8, 'mid',        0.00],
  [318329, 2026,  8, 'long',       0.00],
  [318329, 2026,  9, 'short', 218586.67],
  [318329, 2026,  9, 'mid',        0.00],
  [318329, 2026,  9, 'long',       0.00],
  [318329, 2026, 10, 'short', 231519.71],
  [318329, 2026, 10, 'mid',        0.00],
  [318329, 2026, 10, 'long',       0.00],
  [318329, 2026, 11, 'short', 201672.22],
  [318329, 2026, 11, 'mid',        0.00],
  [318329, 2026, 11, 'long',       0.00],
  [318329, 2026, 12, 'short', 220494.96],
  [318329, 2026, 12, 'mid',        0.00],
  [318329, 2026, 12, 'long',       0.00],
  [318329, 2027,  1, 'short', 147472.81],
  [318329, 2027,  1, 'mid',        0.00],
  [318329, 2027,  1, 'long',       0.00],
  [318329, 2027,  2, 'short', 154073.24],
  [318329, 2027,  2, 'mid',        0.00],
  [318329, 2027,  2, 'long',       0.00],
  [318329, 2027,  3, 'short', 199151.32],
  [318329, 2027,  3, 'mid',        0.00],
  [318329, 2027,  3, 'long',       0.00],
];

async function run() {
  const apply = process.argv.includes('--apply');

  // FY26 budget totals for sanity check
  const totals = {};
  for (const [h, , , role, rev] of BUDGETS) {
    totals[h] = totals[h] || { short: 0, mid: 0, long: 0, total: 0 };
    totals[h][role] += rev;
    totals[h].total += rev;
  }
  console.log('\n── FY26 budget totals (net) ──');
  for (const [id, name] of Object.entries(HOTELS)) {
    const t = totals[id] || { short: 0, mid: 0, long: 0, total: 0 };
    console.log(
      `  ${name} (${id})  total £${t.total.toLocaleString('en-GB', { maximumFractionDigits: 0 })}  ` +
      `[short £${t.short.toLocaleString('en-GB', { maximumFractionDigits: 0 })} | ` +
      `mid £${t.mid.toLocaleString('en-GB', { maximumFractionDigits: 0 })} | ` +
      `long £${t.long.toLocaleString('en-GB', { maximumFractionDigits: 0 })}]`,
    );
  }
  console.log(`\nRows to upsert: ${BUDGETS.length}`);

  if (!apply) {
    console.log('\n[dry run] No DB writes. Re-run with --apply to load.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure table exists (idempotent — migration_022 may not have run yet)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hotel_service_budgets (
        hotel_id      INTEGER NOT NULL,
        year          INTEGER NOT NULL,
        month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        service_role  TEXT    NOT NULL,
        budget_revenue_net  NUMERIC(12, 2) NOT NULL DEFAULT 0,
        budget_room_nights  INTEGER,
        budget_occupancy_pct NUMERIC(5, 4),
        notes         TEXT,
        updated_by    INTEGER,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (hotel_id, year, month, service_role)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hsb_hotel_year
        ON hotel_service_budgets (hotel_id, year);
    `);

    let upserted = 0;
    for (const [hotel_id, year, month, role, rev] of BUDGETS) {
      await client.query(
        `INSERT INTO hotel_service_budgets
            (hotel_id, year, month, service_role, budget_revenue_net, notes, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (hotel_id, year, month, service_role) DO UPDATE
           SET budget_revenue_net = EXCLUDED.budget_revenue_net,
               notes = EXCLUDED.notes,
               updated_at = NOW()`,
        [hotel_id, year, month, role, rev, 'FY26 plan — loaded from M&F Budget Summary 26_27.xlsx'],
      );
      upserted++;
    }

    await client.query('COMMIT');
    console.log(`\n✓ Upserted ${upserted} rows into hotel_service_budgets`);

    // Verify
    const { rows } = await client.query(`
      SELECT hotel_id,
             SUM(CASE WHEN year=2026 AND month>=4 THEN budget_revenue_net ELSE 0 END) +
             SUM(CASE WHEN year=2027 AND month<=3 THEN budget_revenue_net ELSE 0 END)
               AS fy26_total
      FROM hotel_service_budgets
      WHERE hotel_id IN (318329, 318341, 318343)
      GROUP BY hotel_id
      ORDER BY hotel_id`);
    console.log('\n── DB verification (FY26 = Apr 2026 → Mar 2027) ──');
    for (const r of rows) {
      console.log(`  ${HOTELS[r.hotel_id]} (${r.hotel_id})  £${Number(r.fy26_total).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n✗ Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
