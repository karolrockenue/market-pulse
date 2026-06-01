/**
 * @file masonXlsx.js
 * @brief Builds the Sales Flash Excel workbook from the same "M" data object the
 *        PDF uses (api/services/masonPdf.service.js → buildSalesFlashPdfData), so
 *        the two exports never diverge. Tabular only (charts are a PDF concern).
 */
const ExcelJS = require("exceljs");

const GBP = '£#,##0';
const GBP2 = '£#,##0.00';
const PCT = '0.0%';
const NUM = '#,##0';
const DAYS = '0.0';

// Header row styling helper
function header(ws, row) {
  row.font = { bold: true, size: 9, color: { argb: "FF6B7280" } };
  row.eachCell((c) => { c.alignment = { horizontal: "right" }; });
  row.getCell(1).alignment = { horizontal: "left" };
}
function titleRow(ws, text) {
  const r = ws.addRow([text]);
  r.font = { bold: true, size: 11, color: { argb: "FF0F4C81" } };
  return r;
}

async function buildSalesFlashXlsx(M) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Market Pulse";
  wb.created = new Date();

  // ── Summary ──────────────────────────────────────────────────────
  const s = wb.addWorksheet("Summary");
  s.addRow([M.property]).font = { bold: true, size: 14 };
  s.addRow([`Reporting Month: ${M.period}`, "", `Generated: ${M.generated}`]);
  s.addRow([]);
  titleRow(s, `Current Month Summary — ${M.period}`);
  header(s, s.addRow(["Metric", "Actual", "Prior Month", "Prior Year", "Budget"]));
  const kpiFmt = (k) => (k.pct ? PCT : k.rev ? GBP : GBP2);
  for (const k of [...M.revenue, ...M.kpis]) {
    const r = s.addRow([k.k, k.a, k.pm, k.py, k.b]);
    for (let c = 2; c <= 5; c++) r.getCell(c).numFmt = kpiFmt(k);
  }
  s.addRow([]);
  titleRow(s, "Short-Stay Source");
  s.addRow(["Direct", M.source.direct]).getCell(2).numFmt = PCT;
  s.addRow(["Indirect", M.source.indirect]).getCell(2).numFmt = PCT;
  s.addRow([]);
  titleRow(s, "Average Length of Stay (nights)");
  header(s, s.addRow(["Service", "ALOS", "Prior Month", "Prior Year"]));
  for (const a of M.alos) { const r = s.addRow([a.seg, a.a, a.pm, a.py]); [2, 3, 4].forEach((c) => (r.getCell(c).numFmt = DAYS)); }
  s.addRow([]);
  titleRow(s, "Lead Time to Reservation (days, booking→check-in)");
  header(s, s.addRow(["Service", "Days", "Prior Month", "Prior Year"]));
  for (const a of M.leadTime) { const r = s.addRow([a.seg, a.a, a.pm, a.py]); [2, 3, 4].forEach((c) => (r.getCell(c).numFmt = DAYS)); }
  s.getColumn(1).width = 30; [2, 3, 4, 5].forEach((c) => (s.getColumn(c).width = 14));

  // ── Annualised vs Budget ─────────────────────────────────────────
  const a = wb.addWorksheet("Annualised");
  titleRow(a, `Annualised vs Budget — ${M.fy}`);
  header(a, a.addRow(["Line", ...M.annual.map((x) => x.mo), "FY Total"]));
  const annRev = a.addRow(["Revenue (net)", ...M.annual.map((x) => x.rev), M.annual.reduce((t, x) => t + x.rev, 0)]);
  const annBud = a.addRow(["Budget", ...M.annual.map((x) => x.bud), M.annual.reduce((t, x) => t + x.bud, 0)]);
  const annVar = a.addRow(["Variance £", ...M.annual.map((x) => x.rev - x.bud), M.annual.reduce((t, x) => t + (x.rev - x.bud), 0)]);
  [annRev, annBud, annVar].forEach((r) => r.eachCell((c, n) => { if (n > 1) c.numFmt = GBP; }));
  const annOcc = a.addRow(["Occupancy", ...M.annual.map((x) => (x.occ == null ? null : x.occ / 100)), M.fytdOccupancy == null ? null : M.fytdOccupancy / 100]);
  annOcc.eachCell((c, n) => { if (n > 1) c.numFmt = "0%"; });
  a.getColumn(1).width = 16; a.columns.forEach((c, i) => { if (i > 0) c.width = 11; });

  // ── Pacing by Service ────────────────────────────────────────────
  const p = wb.addWorksheet("Pacing");
  titleRow(p, "Pacing Report — by Service");
  header(p, p.addRow(["Service / Metric", ...M.pacingCols, "FYTD"]));
  for (const seg of M.pacing) {
    p.addRow([seg.seg]).font = { bold: true, color: { argb: "FF1A1A1A" } };
    const rev = p.addRow(["Revenue (net)", ...seg.months.map((m) => m.rev), seg.totRev]);
    const nts = p.addRow(["Room Nights", ...seg.months.map((m) => m.nights), seg.totN]);
    const adr = p.addRow(["ADR (net)", ...seg.months.map((m) => m.adr), seg.totAdr]);
    const bud = p.addRow(["Budget Revenue", ...seg.months.map((m) => m.bud), seg.totBud]);
    const vr = p.addRow(["Variance £", ...seg.months.map((m) => (m.bud != null ? m.rev - m.bud : null)), seg.totRev - seg.totBud]);
    [rev, bud, vr].forEach((r) => r.eachCell((c, n) => { if (n > 1) c.numFmt = GBP; }));
    nts.eachCell((c, n) => { if (n > 1) c.numFmt = NUM; });
    adr.eachCell((c, n) => { if (n > 1) c.numFmt = GBP; });
  }
  p.getColumn(1).width = 18; p.columns.forEach((c, i) => { if (i > 0) c.width = 10; });

  // ── Weekly Unit Pacing ───────────────────────────────────────────
  const u = wb.addWorksheet("Unit Pacing");
  titleRow(u, `Weekly Unit Pacing — rooms by status (capacity ${M.cap})`);
  header(u, u.addRow(["Status", ...M.unit.cols]));
  M.unit.rows.forEach((rn, i) => u.addRow([rn, ...M.unit.data[i]]));
  u.addRow(["Capacity", ...M.unit.cols.map(() => M.cap)]);
  u.getColumn(1).width = 24; M.unit.cols.forEach((_, i) => (u.getColumn(i + 2).width = 13));

  // ── Business on the Books & Done ─────────────────────────────────
  const b = wb.addWorksheet("BOB & Done");
  titleRow(b, "Business on the Books & Business Done — by service");
  header(b, b.addRow(["Service", "On the Books", "Business Done (FYTD)"]));
  for (const x of M.bob) { const r = b.addRow([x.seg, x.bob, x.done]); r.getCell(2).numFmt = GBP; r.getCell(3).numFmt = GBP; }
  b.getColumn(1).width = 16; [2, 3].forEach((c) => (b.getColumn(c).width = 18));

  // ── Accommodation Bookings (per segment) ─────────────────────────
  const bk = wb.addWorksheet("Bookings");
  const segs = [["Short Stay", "short"], ["Mid Stay", "mid"], ["Long Stay", "long"]];
  for (const [label, key] of segs) {
    titleRow(bk, `${label} — bookings by created week`);
    header(bk, bk.addRow(["Week", "Bookings", "Room Nights", "Revenue", "Avg ADR"]));
    const rows = M.bookings[key] || [];
    let tb = 0, tn = 0, tr = 0;
    rows.forEach((r, i) => {
      tb += r[0]; tn += r[1]; tr += r[2];
      const row = bk.addRow([M.weeks[i], r[0], r[1], r[2], r[1] > 0 ? r[2] / r[1] : null]);
      row.getCell(4).numFmt = GBP; row.getCell(5).numFmt = GBP;
    });
    const tot = bk.addRow(["Total", tb, tn, tr, tn > 0 ? tr / tn : null]);
    tot.font = { bold: true }; tot.getCell(4).numFmt = GBP; tot.getCell(5).numFmt = GBP;
    bk.addRow([]);
  }
  bk.getColumn(1).width = 12; [2, 3, 4, 5].forEach((c) => (bk.getColumn(c).width = 13));

  return await wb.xlsx.writeBuffer();
}

module.exports = { buildSalesFlashXlsx };
