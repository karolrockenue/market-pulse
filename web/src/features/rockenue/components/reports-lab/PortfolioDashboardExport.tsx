import { MOCK_PORTFOLIO_EXPORT as P, MOCK_REPORT as D } from "./reportMockData";
import { fmtDecimal } from "./reportShared";
import {
  ReportShell, SectionLabel,
  tableTh, tableTd, tableThLeft, tableTdLeft,
  tableTotalsRow, tableTotalsCell,
} from "./ReportShell";
import { REPORT as R } from "../../../../styles/reportTokens";

const fmtMoney0 = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;
const fmtPct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const fmtDelta = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

export function PortfolioDashboardExport() {
  const totRooms = P.rows.reduce((s, r) => s + r.rooms, 0);
  const totRevenue = P.rows.reduce((s, r) => s + r.revenue, 0);
  const weightedAdr =
    P.rows.reduce((s, r) => s + r.adr * r.rooms * r.occ, 0) /
    P.rows.reduce((s, r) => s + r.rooms * r.occ, 0);
  const avgOcc = P.rows.reduce((s, r) => s + r.occ * r.rooms, 0) / totRooms;

  return (
    <ReportShell
      reportType="Portfolio Dashboard"
      metadata={[
        { label: "Group", value: P.group },
        { label: "Properties", value: `${P.rows.length}` },
        { label: "Period", value: P.period },
        { label: "Generated", value: D.generated },
      ]}
    >
      <SectionLabel>Properties at a Glance</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={tableThLeft}>Property</th>
            <th style={tableTh}>Rooms</th>
            <th style={tableTh}>Occ</th>
            <th style={tableTh}>ADR</th>
            <th style={tableTh}>RevPAR</th>
            <th style={tableTh}>Revenue</th>
            <th style={tableTh}>YoY</th>
          </tr>
        </thead>
        <tbody>
          {P.rows.map((r, i) => (
            <tr key={r.property} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
              <td style={tableTdLeft}>{r.property}</td>
              <td style={tableTd}>{r.rooms}</td>
              <td style={tableTd}>{fmtPct(r.occ)}</td>
              <td style={tableTd}>£{fmtDecimal(r.adr)}</td>
              <td style={tableTd}>£{fmtDecimal(r.revpar)}</td>
              <td style={tableTd}>{fmtMoney0(r.revenue)}</td>
              <td style={{ ...tableTd, color: r.yoy >= 0 ? R.pos : R.neg }}>{fmtDelta(r.yoy)}</td>
            </tr>
          ))}
          <tr style={tableTotalsRow}>
            <td style={{ ...tableTdLeft, ...tableTotalsCell }}>Portfolio</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{totRooms}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtPct(avgOcc)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>£{fmtDecimal(weightedAdr)}</td>
            <td style={tableTd}></td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney0(totRevenue)}</td>
            <td style={tableTd}></td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
