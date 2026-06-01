/**
 * @file load-mf-budget-extras.js
 * @brief Loads the three budget figures Dom asked for that aren't derivable
 *        from hotel_service_budgets — LS ADR budget + SS Direct/Indirect %
 *        budget — from "M&F Budget Summary 26_27.xlsx" into mf_monthly_kpi_history.
 *
 * Why: the live Sales Flash already shows Budget for Occupancy/ADR/RevPAR/SS+MS
 * ADR/Revenue (from hotel_service_budgets). Missing: LS ADR budget (never wired)
 * and the Direct/Indirect split (no source in the budget table). Both live in
 * Dom's budget workbook, so we snapshot them the same way as the PY hardcode.
 *
 * Sheets: WESTBOURNE PARK (318341), PRIMROSE HILL (318343). BELSIZE excluded —
 * short-stay-only, has no LS / Direct-Indirect rows.
 *
 * Stored metric_keys (mf_monthly_kpi_history, source='Budget Summary 26-27'):
 *   ls_adr_budget          → £ net nightly
 *   ss_direct_pct_budget   → 0..1 fraction (matches live direct scale + UI fmtPct(v*100))
 *   ss_indirect_pct_budget → 0..1 fraction
 *
 * Usage:  node scripts/load-mf-budget-extras.js           (dry run)
 *         node scripts/load-mf-budget-extras.js --apply    (writes)
 */
require("dotenv").config();
const path = require("path");
const ExcelJS = require("exceljs");
const pgPool = require("../api/utils/db");

const FILE = path.join(__dirname, "..", "claude", "M&F Budget Summary 26_27.xlsx");
const APPLY = process.argv.includes("--apply");
const FY_START = 2026; // Apr 2026 → Mar 2027 (months in columns 3..14)

const SHEET_HOTEL = {
  "WESTBOURNE PARK": 318341,
  "PRIMROSE HILL": 318343,
};
const ROW_LABELS = {
  lsAdr: "LS ADR £ net",
  ssNights: "SS Room Nights Sold",
  ssDirect: "SS Direct Room Nights Sold",
  ssIndirect: "SS Indirect Room Nights Sold",
};

function cellVal(cell) {
  const v = cell && cell.value;
  if (v == null) return null;
  if (typeof v === "object") {
    if ("result" in v) return v.result;
    if ("text" in v) return v.text;
    return null;
  }
  return v;
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
const pad2 = (n) => String(n).padStart(2, "0");
const fyMonthKey = (i) => { const mn = ((3 + i) % 12) + 1, yr = i < 9 ? FY_START : FY_START + 1; return `${yr}-${pad2(mn)}`; };

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const out = [];

  for (const [sheetName, hotelId] of Object.entries(SHEET_HOTEL)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(`(sheet not found: ${sheetName})`); continue; }
    const rowFor = {};
    ws.eachRow((r, rn) => {
      const lbl = cellVal(r.getCell(2));
      if (lbl == null) return;
      const s = String(lbl).trim();
      for (const [k, label] of Object.entries(ROW_LABELS)) if (s === label && rowFor[k] == null) rowFor[k] = rn;
    });
    const missing = Object.keys(ROW_LABELS).filter((k) => rowFor[k] == null);
    if (missing.length) { console.log(`[${sheetName}] missing rows: ${missing.join(", ")} — skipping`); continue; }

    for (let i = 0; i < 12; i++) {
      const col = 3 + i;
      const lsAdr = num(cellVal(ws.getRow(rowFor.lsAdr).getCell(col)));
      const ssN = num(cellVal(ws.getRow(rowFor.ssNights).getCell(col)));
      const dN = num(cellVal(ws.getRow(rowFor.ssDirect).getCell(col)));
      const iN = num(cellVal(ws.getRow(rowFor.ssIndirect).getCell(col)));
      const [year, month] = fyMonthKey(i).split("-").map(Number);
      const push = (key, val) => { if (val != null) out.push({ hotelId, year, month, metric_key: key, value: Math.round(val * 10000) / 10000 }); };
      push("ls_adr_budget", lsAdr);
      if (ssN && ssN > 0) {
        if (dN != null) push("ss_direct_pct_budget", dN / ssN);
        if (iN != null) push("ss_indirect_pct_budget", iN / ssN);
      }
    }
  }

  console.log(`Parsed ${out.length} budget rows.`);
  for (const [name, hid] of [["Westbourne", 318341], ["Primrose", 318343]]) {
    const apr = out.filter((r) => r.hotelId === hid && r.year === FY_START && r.month === 4);
    console.log(`  ${name} Apr-${FY_START}: ` + apr.map((r) => `${r.metric_key}=${r.value}`).join("  "));
  }

  if (!APPLY) { console.log("\nDry run — re-run with --apply to write."); process.exit(0); }

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS mf_monthly_kpi_history (
      hotel_id INTEGER NOT NULL, year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      metric_key TEXT NOT NULL, value NUMERIC(12,2) NOT NULL,
      source TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (hotel_id, year, month, metric_key))`);
  let n = 0;
  for (const r of out) {
    await pgPool.query(
      `INSERT INTO mf_monthly_kpi_history (hotel_id, year, month, metric_key, value, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,'Budget Summary 26-27', NOW())
       ON CONFLICT (hotel_id, year, month, metric_key)
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()`,
      [r.hotelId, r.year, r.month, r.metric_key, r.value]);
    n++;
  }
  console.log(`\nApplied. Upserted ${n} rows into mf_monthly_kpi_history.`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
