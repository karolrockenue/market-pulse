import { MOCK_SHREEJI_PORTFOLIO as P, MOCK_REPORT as D } from "./reportMockData";
import { fmtDecimal } from "./reportShared";
import {
  ReportShell, SectionLabel,
  tableTh, tableTd, tableThLeft, tableTdLeft,
  tableTotalsRow, tableTotalsCell,
} from "./ReportShell";
import { REPORT as R } from "../../../../styles/reportTokens";

const fmtMoney0 = (v: number) => `£${Math.round(v).toLocaleString("en-GB")}`;
const fmtPct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export function ShreejiPortfolioReport() {
  const rows = P.hotels.map((h) => {
    const rooms_sold = Math.round(h.occ * h.rooms * 31);
    const revpar = h.revenue / (h.rooms * 31);
    return { ...h, rooms_sold, revpar };
  });
  const totRooms = rows.reduce((s, r) => s + r.rooms, 0);
  const totRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totSold = rows.reduce((s, r) => s + r.rooms_sold, 0);
  const avgOcc = totSold / (totRooms * 31);
  const avgAdr = totRevenue / totSold;
  const avgRevpar = totRevenue / (totRooms * 31);

  return (
    <ReportShell
      reportType="Portfolio Performance"
      metadata={[
        { label: "Group", value: "Shreeji Hotels" },
        { label: "Properties", value: `${P.hotels.length}` },
        { label: "Period", value: P.period },
        { label: "Generated", value: D.generated },
      ]}
    >
      <SectionLabel>By Property</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={tableThLeft}>Property</th>
            <th style={tableTh}>Rooms</th>
            <th style={tableTh}>Occupancy</th>
            <th style={tableTh}>ADR</th>
            <th style={tableTh}>RevPAR</th>
            <th style={tableTh}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
              <td style={tableTdLeft}>{r.name}</td>
              <td style={tableTd}>{r.rooms}</td>
              <td style={tableTd}>{fmtPct(r.occ)}</td>
              <td style={tableTd}>£{fmtDecimal(r.adr)}</td>
              <td style={tableTd}>£{fmtDecimal(r.revpar)}</td>
              <td style={tableTd}>{fmtMoney0(r.revenue)}</td>
            </tr>
          ))}
          <tr style={tableTotalsRow}>
            <td style={{ ...tableTdLeft, ...tableTotalsCell }}>Portfolio Total / Avg</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{totRooms}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtPct(avgOcc)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>£{fmtDecimal(avgAdr)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>£{fmtDecimal(avgRevpar)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney0(totRevenue)}</td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
