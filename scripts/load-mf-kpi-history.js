/**
 * @file load-mf-kpi-history.js
 * @brief Loads prior-year KPI actuals + Direct/Indirect split from Mason's
 *        "Monthly Summary Hardcode.xlsx" into mf_monthly_kpi_history.
 *
 * Why: Dom's V3 decision — the Sales Flash "Prior Year" columns should come
 * HARDCODED from his analyst file, not computed from Mews (keeps the report
 * consistent with the benchmarks investors have already seen, and avoids
 * reconstructing LY per-segment from Mews). Past months don't change, so we
 * snapshot the analyst figures into the DB. Re-run when Dom re-sends the file.
 *
 * Companion to load-mf-segment-revenue-history.js (same file, same pattern) —
 * that one loads PY segment REVENUE; this one loads the rest of the KPI row
 * set + the SS Direct/Indirect booking split.
 *
 * Source basis = Mason's analyst monthly summary (NOT Mews) → won't perfectly
 * reconcile to current-year Mews figures; that's expected and matches how the
 * PY revenue row already behaves.
 *
 * Stored on the SAME scale as the live `actual` KPI cells:
 *   - occupancy / direct% / indirect%  → 0-100 (file stores fractions → ×100)
 *   - adr / revpar / amr               → plain £ net
 *
 * Usage:  node scripts/load-mf-kpi-history.js          (dry run)
 *         node scripts/load-mf-kpi-history.js --apply   (writes)
 */
require("dotenv").config();
const path = require("path");
const ExcelJS = require("exceljs");
const pgPool = require("../api/utils/db");

const FILE = path.join(__dirname, "..", "claude", "Monthly Summary Hardcode.xlsx");
const APPLY = process.argv.includes("--apply");

const PROP_HOTEL = {
  "PRIMROSE HILL": 318343,
  "WESTBOURNE PARK": 318341,
};

// metric_key → ordered candidate row labels (prefer the realised "actuals"
// variant, fall back to the base row where actuals is blank). Exact, case-
// insensitive match on column C.
const METRICS = {
  occupancy:      ["Occupancy % blended actuals", "Occupancy % blended"],
  adr_blended:    ["ADR £ net blended"],
  revpar_blended: ["RevPAR £ net blended"],
  ss_adr:         ["SS ADR £ net actuals", "SS ADR £ net"],
  ms_adr:         ["MS ADR £ net actuals", "MS ADR £ net"],
  ls_adr:         ["LS ADR £ net actuals", "LS ADR £ net"],
  ss_direct_pct:  ["SS Direct Booking %"],
  ss_indirect_pct:["SS Indirect Booking %"],
};
// Stored 0-100 (file holds 0..1 fractions for these).
const PCT_KEYS = new Set(["occupancy", "ss_direct_pct", "ss_indirect_pct"]);

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

  const monthCol = {};
  for (let c = 8; c <= ws.columnCount; c++) {
    const v = cellVal(ws.getRow(2).getCell(c));
    if (v instanceof Date) monthCol[`${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}`] = c;
  }
  const todayMk = (() => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; })();

  // Resolve the row number of each candidate label per property (first match).
  const rowFor = {}; // `${prop}|${label}` -> rowNum
  for (let r = 3; r <= ws.rowCount; r++) {
    const prop = cellVal(ws.getRow(r).getCell(1));
    const metric = cellVal(ws.getRow(r).getCell(3));
    if (!prop || !metric) continue;
    const p = String(prop).trim();
    if (!(p in PROP_HOTEL)) continue;
    const m = String(metric).trim();
    for (const labels of Object.values(METRICS)) {
      for (const lbl of labels) {
        const key = `${p}|${lbl}`;
        if (!(key in rowFor) && lbl.toLowerCase() === m.toLowerCase()) rowFor[key] = r;
      }
    }
  }

  const out = []; // {hotelId, year, month, metric_key, value}
  for (const [p, hotelId] of Object.entries(PROP_HOTEL)) {
    for (const [key, labels] of Object.entries(METRICS)) {
      for (const [mk, c] of Object.entries(monthCol)) {
        if (mk >= todayMk) continue; // past months only (LY actuals)
        let raw = null;
        for (const lbl of labels) {
          const rn = rowFor[`${p}|${lbl}`];
          if (!rn) continue;
          const v = cellVal(ws.getRow(rn).getCell(c));
          if (typeof v === "number" && isFinite(v)) { raw = v; break; }
        }
        if (raw == null) continue;
        const value = PCT_KEYS.has(key) ? raw * 100 : raw;
        const [year, month] = mk.split("-").map(Number);
        out.push({ hotelId, year, month, metric_key: key, value: Math.round(value * 100) / 100 });
      }
    }
  }

  console.log(`Parsed ${out.length} (hotel,month,metric) PY rows.`);
  for (const hid of [318341, 318343]) {
    const s = out.filter((r) => r.hotelId === hid && r.year === 2025 && r.month === 7);
    console.log(`  ${hid} Jul-2025: ` + (s.map((r) => `${r.metric_key}=${r.value}`).join("  ") || "(none)"));
  }

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write.");
    process.exit(0);
  }

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS mf_monthly_kpi_history (
      hotel_id    INTEGER NOT NULL,
      year        INTEGER NOT NULL,
      month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      metric_key  TEXT    NOT NULL,
      value       NUMERIC(12,2) NOT NULL,
      source      TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (hotel_id, year, month, metric_key)
    )`);

  let n = 0;
  for (const r of out) {
    await pgPool.query(
      `INSERT INTO mf_monthly_kpi_history
         (hotel_id, year, month, metric_key, value, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,'Monthly Summary Hardcode', NOW())
       ON CONFLICT (hotel_id, year, month, metric_key)
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()`,
      [r.hotelId, r.year, r.month, r.metric_key, r.value],
    );
    n++;
  }
  console.log(`\nApplied. Upserted ${n} rows into mf_monthly_kpi_history.`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
