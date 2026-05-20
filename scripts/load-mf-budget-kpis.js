/**
 * @file load-mf-budget-kpis.js
 * @brief Backfills hotel_service_budgets.budget_room_nights + budget_occupancy_pct
 *        from "M&F Budget Summary 26_27.xlsx".
 *
 * The original loader (load-mf-budgets-fy26.js) only imported budget_revenue_net.
 * Dom asked for Budget + vs Budget % across the Sales Flash KPI section, which
 * needs budgeted occupancy + room-nights (so we can derive budget ADR/RevPAR).
 * Those figures ARE in the budget workbook (per-service "Target Occupancy %"
 * and "Room Nights Sold"); this script extracts them and UPDATEs the existing
 * rows WITHOUT touching the VAT-corrected budget_revenue_net.
 *
 * Usage:  node scripts/load-mf-budget-kpis.js          (dry run, prints table)
 *         node scripts/load-mf-budget-kpis.js --apply  (writes to DB)
 */
require("dotenv").config();
const path = require("path");
const ExcelJS = require("exceljs");
const pgPool = require("../api/utils/db");

const FILE = path.join(__dirname, "..", "claude", "M&F Budget Summary 26_27.xlsx");
const APPLY = process.argv.includes("--apply");

const SHEET_HOTEL = {
  "WESTBOURNE PARK": 318341,
  "PRIMROSE HILL": 318343,
  "BELSIZE PARK": 318329,
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Pull a usable scalar out of an ExcelJS cell (handles formula results + rich text).
function cellVal(cell) {
  const v = cell && cell.value;
  if (v == null) return null;
  if (v instanceof Date) return v; // Dates are typeof "object" — pass through
  if (typeof v === "object") {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    return null;
  }
  return v;
}

// Parse a header cell into { year, month } — accepts Date objects, "Apr-26"
// short strings, or full date strings ("Fri May 01 2026 02:00:00 GMT+0100").
function parseMonth(v) {
  if (v instanceof Date && !isNaN(v)) return { year: v.getUTCFullYear(), month: v.getUTCMonth() + 1 };
  if (typeof v === "string") {
    const s = v.trim();
    const m = s.match(/^([A-Za-z]{3})[-\s](\d{2,4})$/);
    if (m) {
      const mi = MONTHS.indexOf(m[1].toLowerCase());
      if (mi >= 0) {
        const yr = m[2].length === 2 ? 2000 + parseInt(m[2], 10) : parseInt(m[2], 10);
        return { year: yr, month: mi + 1 };
      }
    }
    // Full date string ("Fri May 01 2026 …") — require a month name AND a
    // 4-digit year so junk like "YEAR 1" doesn't slip through new Date().
    if (/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) && /\b20\d{2}\b/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d)) return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
  }
  return null;
}

function labelOf(row) {
  for (let c = 1; c <= 4; c++) {
    const x = cellVal(row.getCell(c));
    if (x != null && String(x).trim() !== "") return String(x).trim();
  }
  return null;
}

// Per-role metric label matchers (occupancy %, room nights sold).
const ROLE_LABELS = {
  short: { occ: /^SS Target Occupancy/i, nights: /^SS Room Nights Sold/i },
  mid: { occ: /^MS Target Occupancy/i, nights: /^MS Room Nights Sold/i },
  long: { occ: /^LS Target Occupancy/i, nights: /^LS Room Nights Sold/i },
};

function parseSheet(ws) {
  // 1) find header row = first row in 1..12 with >=4 parseable month columns
  let headerRow = null;
  const monthCols = {}; // colIdx -> {year,month}
  for (let r = 1; r <= 12 && !headerRow; r++) {
    const cols = {};
    let hits = 0;
    for (let c = 2; c <= ws.columnCount; c++) {
      const pm = parseMonth(cellVal(ws.getRow(r).getCell(c)));
      if (pm) { cols[c] = pm; hits++; }
    }
    if (hits >= 4) { headerRow = r; Object.assign(monthCols, cols); }
  }
  if (!headerRow) return null;

  // 2) scan rows for the role metric labels
  const out = {}; // role -> { mk -> {occ,nights} }
  for (const role of Object.keys(ROLE_LABELS)) out[role] = {};
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const label = labelOf(ws.getRow(r));
    if (!label) continue;
    for (const role of Object.keys(ROLE_LABELS)) {
      const isOcc = ROLE_LABELS[role].occ.test(label);
      const isNights = ROLE_LABELS[role].nights.test(label);
      if (!isOcc && !isNights) continue;
      for (const [c, pm] of Object.entries(monthCols)) {
        const raw = cellVal(ws.getRow(r).getCell(Number(c)));
        if (typeof raw !== "number" || !isFinite(raw)) continue;
        const mk = `${pm.year}-${String(pm.month).padStart(2, "0")}`;
        out[role][mk] = out[role][mk] || {};
        if (isOcc) out[role][mk].occ = raw;
        if (isNights) out[role][mk].nights = raw;
      }
    }
  }
  return out;
}

// Belsize uses a different "Business Plan" layout (short-stay-only). Pull
// Short Stay nights + occupancy from its "Sold Nights" / "Short Stay
// Occupancy" rows. Mid/Long aren't operated there yet.
function parseBelsize(ws) {
  let headerRow = null;
  const monthCols = {};
  for (let r = 1; r <= 12 && !headerRow; r++) {
    const cols = {};
    let hits = 0;
    for (let c = 2; c <= ws.columnCount; c++) {
      const pm = parseMonth(cellVal(ws.getRow(r).getCell(c)));
      if (pm) { cols[c] = pm; hits++; }
    }
    if (hits >= 4) { headerRow = r; Object.assign(monthCols, cols); }
  }
  if (!headerRow) return null;
  const findRow = (re) => {
    for (let r = headerRow; r <= ws.rowCount; r++) {
      const lab = labelOf(ws.getRow(r));
      if (lab && re.test(lab)) return r;
    }
    return null;
  };
  const rNights = findRow(/^Sold Nights$/i);
  const rOcc = findRow(/^Short Stay Occupancy$/i);
  const out = { short: {}, mid: {}, long: {} };
  for (const [c, pm] of Object.entries(monthCols)) {
    const mk = `${pm.year}-${String(pm.month).padStart(2, "0")}`;
    const n = rNights ? cellVal(ws.getRow(rNights).getCell(Number(c))) : null;
    const o = rOcc ? cellVal(ws.getRow(rOcc).getCell(Number(c))) : null;
    if (typeof n === "number" || typeof o === "number") {
      out.short[mk] = {};
      if (typeof n === "number") out.short[mk].nights = n;
      if (typeof o === "number") out.short[mk].occ = o;
    }
  }
  return out;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  const updates = []; // {hotelId, year, month, role, occ, nights}
  for (const [sheetName, hotelId] of Object.entries(SHEET_HOTEL)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) { console.log(`! sheet not found: ${sheetName}`); continue; }
    let parsed = parseSheet(ws);
    const empty = !parsed || Object.values(parsed).every((o) => Object.keys(o).length === 0);
    if (empty) parsed = parseBelsize(ws); // fall back to the Belsize layout
    if (!parsed) { console.log(`! could not parse: ${sheetName}`); continue; }
    for (const role of Object.keys(parsed)) {
      for (const [mk, v] of Object.entries(parsed[role])) {
        if (v.occ == null && v.nights == null) continue;
        const [year, month] = mk.split("-").map(Number);
        updates.push({
          hotelId, year, month, role,
          occ: v.occ != null ? Number(v.occ.toFixed(4)) : null,
          nights: v.nights != null ? Math.round(v.nights) : null,
        });
      }
    }
  }

  // Print a compact summary (Jul row per hotel as a sanity check)
  console.log(`Parsed ${updates.length} (hotel,month,role) KPI budget rows.`);
  for (const hid of [318341, 318343, 318329]) {
    const jul = updates.filter((u) => u.hotelId === hid && u.month === 7 && u.year === 2026);
    console.log(`  ${hid} Jul-26:`, jul.map((u) => `${u.role} occ=${u.occ} nights=${u.nights}`).join(" | ") || "(none)");
  }

  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write budget_room_nights + budget_occupancy_pct.");
    process.exit(0);
  }

  let updated = 0, missing = 0;
  for (const u of updates) {
    const res = await pgPool.query(
      `UPDATE hotel_service_budgets
         SET budget_room_nights = COALESCE($5, budget_room_nights),
             budget_occupancy_pct = COALESCE($6, budget_occupancy_pct),
             updated_at = NOW()
       WHERE hotel_id = $1 AND year = $2 AND month = $3 AND service_role = $4`,
      [u.hotelId, u.year, u.month, u.role, u.nights, u.occ],
    );
    if (res.rowCount > 0) updated += res.rowCount;
    else missing++;
  }
  console.log(`\nApplied. Rows updated: ${updated}. (No matching budget row for ${missing} parsed entries — expected for months with no revenue budget, e.g. Belsize.)`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
