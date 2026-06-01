/**
 * @file load-mf-budget-extras.js
 * @brief Loads the budget figures Dom asked for that aren't in hotel_service_budgets —
 *        LS ADR budget + SS Direct/Indirect % budget — into mf_monthly_kpi_history.
 *
 * SS Direct/Indirect % budget: taken from Dom's explicit Direct-Booking-% table
 * (provided 2026-06-01) for ALL THREE sites — it's the source of truth and is NOT
 * fully in the workbook (Belsize's tab has no Direct/Indirect rows). Stored as a
 * 0..1 fraction (matches live direct scale + UI fmtPct(v*100)).
 *
 * LS ADR budget: read from the "LS ADR £ net" row of "M&F Budget Summary 26_27.xlsx".
 * Westbourne + Primrose only — Belsize is short-stay-only (no long stay → LS ADR N/A).
 *
 * metric_keys (mf_monthly_kpi_history, source='Budget 26-27'):
 *   ls_adr_budget · ss_direct_pct_budget · ss_indirect_pct_budget
 *
 * Usage:  node scripts/load-mf-budget-extras.js [--apply]
 */
require("dotenv").config();
const path = require("path");
const ExcelJS = require("exceljs");
const pgPool = require("../api/utils/db");

const FILE = path.join(__dirname, "..", "claude", "M&F Budget Summary 26_27.xlsx");
const APPLY = process.argv.includes("--apply");
const FY_START = 2026; // Apr 2026 → Mar 2027

// Dom's Direct Booking % by FY month (Apr..Mar). Indirect = 1 − Direct.
// null = month with no trading (Belsize opens May 2026).
const DIRECT_PCT = {
  318341: [0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50], // Westbourne
  318343: [0.40, 0.40, 0.40, 0.42, 0.42, 0.42, 0.45, 0.45, 0.45, 0.50, 0.50, 0.50], // Primrose
  318329: [null, 0.20, 0.25, 0.25, 0.30, 0.30, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50], // Belsize
};
// LS ADR — workbook sheet name → hotel (Belsize excluded: no long stay)
const LS_SHEET_HOTEL = { "WESTBOURNE PARK": 318341, "PRIMROSE HILL": 318343 };
const LS_ADR_LABEL = "LS ADR £ net";

function cellVal(cell) {
  const v = cell && cell.value;
  if (v == null) return null;
  if (typeof v === "object") return "result" in v ? v.result : v.text || null;
  return v;
}
const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
const pad2 = (n) => String(n).padStart(2, "0");
const fyMonthKey = (i) => { const mn = ((3 + i) % 12) + 1, yr = i < 9 ? FY_START : FY_START + 1; return `${yr}-${pad2(mn)}`; };
const r2 = (v) => Math.round(v * 100) / 100;

(async () => {
  const out = [];

  // 1. SS Direct / Indirect % budget — all three sites, from Dom's explicit table.
  for (const [hid, arr] of Object.entries(DIRECT_PCT)) {
    for (let i = 0; i < 12; i++) {
      const d = arr[i];
      if (d == null) continue;
      const [year, month] = fyMonthKey(i).split("-").map(Number);
      out.push({ hotelId: +hid, year, month, metric_key: "ss_direct_pct_budget", value: r2(d) });
      out.push({ hotelId: +hid, year, month, metric_key: "ss_indirect_pct_budget", value: r2(1 - d) });
    }
  }

  // 2. LS ADR £ net budget — from the workbook (Westbourne + Primrose).
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  for (const [sheetName, hotelId] of Object.entries(LS_SHEET_HOTEL)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(`(sheet not found: ${sheetName})`); continue; }
    let lsRow = null;
    ws.eachRow((r, rn) => { if (lsRow == null && String(cellVal(r.getCell(2)) || "").trim() === LS_ADR_LABEL) lsRow = rn; });
    if (!lsRow) { console.log(`[${sheetName}] no "${LS_ADR_LABEL}" row — skipping LS ADR`); continue; }
    for (let i = 0; i < 12; i++) {
      const v = num(cellVal(ws.getRow(lsRow).getCell(3 + i)));
      if (v == null) continue;
      const [year, month] = fyMonthKey(i).split("-").map(Number);
      out.push({ hotelId, year, month, metric_key: "ls_adr_budget", value: r2(v) });
    }
  }

  console.log(`Parsed ${out.length} budget rows.`);
  for (const [name, hid] of [["Westbourne", 318341], ["Primrose", 318343], ["Belsize", 318329]]) {
    const may = out.filter((r) => r.hotelId === hid && r.year === 2026 && r.month === 5);
    console.log(`  ${name} May-26: ` + (may.map((r) => `${r.metric_key}=${r.value}`).join("  ") || "(none)"));
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
       VALUES ($1,$2,$3,$4,$5,'Budget 26-27', NOW())
       ON CONFLICT (hotel_id, year, month, metric_key)
       DO UPDATE SET value = EXCLUDED.value, source = EXCLUDED.source, updated_at = NOW()`,
      [r.hotelId, r.year, r.month, r.metric_key, r.value]);
    n++;
  }
  console.log(`\nApplied. Upserted ${n} rows into mf_monthly_kpi_history.`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
