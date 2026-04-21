import { MOCK_REPORT as D } from "./reportMockData";
import { fmtDecimal } from "./reportShared";
import {
  ReportShell, SectionLabel,
  tableTh, tableTd, tableThLeft, tableTdLeft,
  tableTotalsRow, tableTotalsCell,
} from "./ReportShell";
import { REPORT as R } from "../../../../styles/reportTokens";

// Monthly Performance uses Archivo across the whole report body (header, metadata,
// section label, and the data table) via ReportShell's `fontFamily` override.
const FONT = "'Archivo', 'Helvetica Neue', Arial, sans-serif";

const fmtPctRow = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtCurrency = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateShort = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function MonthlyPerformanceReport() {
  const rows = D.daily.map((d) => {
    const rooms_sold = Math.round(d.occ * D.rooms);
    const revenue = rooms_sold * d.adr;
    const revpar = revenue / D.rooms;
    return { ...d, rooms_sold, revenue, revpar };
  });
  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totalRooms = rows.reduce((s, r) => s + r.rooms_sold, 0);
  const avgOcc = rows.reduce((s, r) => s + r.occ, 0) / rows.length;
  const avgAdr = totalRev / totalRooms;
  const avgRevpar = totalRev / (rows.length * D.rooms);

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap');`}</style>
      <ReportShell
        reportType="Monthly Performance"
        fontFamily={FONT}
        metadata={[
          { label: "Property", value: D.property },
          { label: "Period", value: D.period },
          { label: "Generated", value: D.generated },
        ]}
      >
        <SectionLabel>Daily Performance</SectionLabel>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={tableThLeft}>Date</th>
              <th style={tableTh}>DOW</th>
              <th style={tableTh}>Occupancy</th>
              <th style={tableTh}>ADR</th>
              <th style={tableTh}>RevPAR</th>
              <th style={tableTh}>Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isWeekend = r.dow === "Sat" || r.dow === "Sun";
              return (
                <tr key={r.date} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
                  <td style={tableTdLeft}>{fmtDateShort(r.date)}</td>
                  <td style={{ ...tableTd, color: isWeekend ? R.text : R.textMuted }}>{r.dow}</td>
                  <td style={tableTd}>{fmtPctRow(r.occ)}</td>
                  <td style={tableTd}>£{fmtDecimal(r.adr)}</td>
                  <td style={tableTd}>£{fmtDecimal(r.revpar)}</td>
                  <td style={tableTd}>{fmtCurrency(r.revenue)}</td>
                </tr>
              );
            })}
            <tr style={tableTotalsRow}>
              <td style={{ ...tableTdLeft, ...tableTotalsCell }}>Totals / Avg</td>
              <td style={tableTd}></td>
              <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtPctRow(avgOcc)}</td>
              <td style={{ ...tableTd, ...tableTotalsCell }}>£{fmtDecimal(avgAdr)}</td>
              <td style={{ ...tableTd, ...tableTotalsCell }}>£{fmtDecimal(avgRevpar)}</td>
              <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtCurrency(totalRev)}</td>
            </tr>
          </tbody>
        </table>
      </ReportShell>
    </>
  );
}
