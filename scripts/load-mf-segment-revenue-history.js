/**
 * @file load-mf-segment-revenue-history.js
 * @brief Loads prior-year per-segment revenue (Short/Mid/Long) from Mason's
 *        "Monthly Summary Hardcode.xlsx" into mf_segment_revenue_history.
 *
 * Why: the Sales Flash Current-Month-Summary "Prior Year" column can only show
 * a property-wide total from our snapshots — Dom asked for it split by segment
 * (his PDF: "Can the PY totals be split by Segment — from 'Monthly Summary
 * Hardcode'"). Mews can't reconstruct LY per-segment yet (that's the STLY
 * workstream), and past months don't change, so we hardcode the analyst
 * figures into the DB.
 *
 * Source basis = Mason's analyst monthly summary (NOT Mews) — it counts
 * differently from our current-year Mews figures, so PY won't perfectly
 * reconcile to current-year. Use the base "SHORT/MID/LONG STAY REVENUE £ net"
 * rows — they foot to "Total Revenue £ net blended" (the "...actuals" variants
 * do not).
 *
 * Usage:  node scripts/load-mf-segment-revenue-history.js          (dry run)
 *         node scripts/load-mf-segment-revenue-history.js --apply  (writes)
 */
require("dotenv").config();
const path = require("path");
const ExcelJS = require("exceljs");
const pgPool = require("../api/utils/db");

const FILE = path.join(__dirname, "..", "claude", "Monthly Summary Hardcode.xlsx");
const APPLY = process.argv.includes("--apply");

// Exact property labels we trust (ignore WESTBOURNE PARK1/2, BERMONDSEY, ALL GUESTHOUSES).
const PROP_HOTEL = {
  "PRIMROSE HILL": 318343,
  "WESTBOURNE PARK": 318341,
};

// Base segment-revenue metrics (these foot to the blended total).
const ROLE_METRIC = {
  short: /^SHORT STAY REVENUE £ net$/i,
  mid: /^MID STAY REVENUE £ net$/i,
  long: /^LONG STAY REVENUE £ net$/i,
};

function cellVal(cell) {
  const v = cell && cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    return null;
  }
  return v;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const ws = wb.getWorksheet("Sheet1");

  // month -> column (header row 2, dates from col 8)
  const monthCol = {};
  for (let c = 8; c <= ws.columnCount; c++) {
    const v = cellVal(ws.getRow(2).getCell(c));
    if (v instanceof Date) monthCol[`${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`] = c;
  }
  const todayMk = (() => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; })();

  // Collect first matching row per (property, role)
  const rowFor = {}; // `${prop}|${role}` -> rowNum
  for (let r = 3; r <= ws.rowCount; r++) {
    const prop = cellVal(ws.getRow(r).getCell(1));
    const metric = cellVal(ws.getRow(r).getCell(3));
    if (!prop || !metric) continue;
    const p = String(prop).trim();
    if (!(p in PROP_HOTEL)) continue;
    for (const role of Object.keys(ROLE_METRIC)) {
      const key = `${p}|${role}`;
      if (!(key in rowFor) && ROLE_METRIC[role].test(String(metric).trim())) rowFor[key] = r;
    }
  }

  const rows = []; // {hotelId, year, month, role, rev}
  for (const [p, hotelId] of Object.entries(PROP_HOTEL)) {
    for (const role of Object.keys(ROLE_METRIC)) {
      const rn = rowFor[`${p}|${role}`];
      if (!rn) { console.log(`! no ${role} row for ${p}`); continue; }
      for (const [mk, c] of Object.entries(monthCol)) {
        if (mk >= todayMk) continue; // past months only (LY actuals)
        const v = cellVal(ws.getRow(rn).getCell(c));
        if (typeof v !== "number" || !isFinite(v)) continue;
        const [year, month] = mk.split("-").map(Number);
        rows.push({ hotelId, year, month, role, rev: Math.round(v * 100) / 100 });
      }
    }
  }

  console.log(`Parsed ${rows.length} (hotel,month,role) PY revenue rows.`);
  for (const hid of [318341, 318343]) {
    const jul = rows.filter((r) => r.hotelId === hid && r.month === 7 && r.year === 2025);
    console.log(`  ${hid} Jul-2025:`, jul.map((r) => `${r.role}=£${Math.round(r.rev)}`).join(" | ") || "(none)");
  }

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write.");
    process.exit(0);
  }

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS mf_segment_revenue_history (
      hotel_id      INTEGER NOT NULL,
      year          INTEGER NOT NULL,
      month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      service_role  TEXT    NOT NULL,
      revenue_net   NUMERIC(12,2) NOT NULL DEFAULT 0,
      source        TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (hotel_id, year, month, service_role)
    )`);

  let n = 0;
  for (const r of rows) {
    await pgPool.query(
      `INSERT INTO mf_segment_revenue_history
         (hotel_id, year, month, service_role, revenue_net, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,'Monthly Summary Hardcode', NOW())
       ON CONFLICT (hotel_id, year, month, service_role)
       DO UPDATE SET revenue_net = EXCLUDED.revenue_net, source = EXCLUDED.source, updated_at = NOW()`,
      [r.hotelId, r.year, r.month, r.role, r.rev],
    );
    n++;
  }
  console.log(`\nApplied. Upserted ${n} rows into mf_segment_revenue_history.`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
