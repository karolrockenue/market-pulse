import { MOCK_REPORT as D, MOCK_YOY } from "./reportMockData";
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

export function YearOnYearReport() {
  const rows = MOCK_YOY.map((m) => ({
    ...m,
    revDelta: (m.rev26 - m.rev25) / m.rev25,
    occDelta: m.occ26 - m.occ25,
    adrDelta: (m.adr26 - m.adr25) / m.adr25,
  }));
  const totRev25 = rows.reduce((s, r) => s + r.rev25, 0);
  const totRev26 = rows.reduce((s, r) => s + r.rev26, 0);
  const totDelta = (totRev26 - totRev25) / totRev25;

  return (
    <ReportShell
      reportType="Year-on-Year"
      metadata={[
        { label: "Property", value: D.property },
        { label: "Periods", value: "YTD · Jan–Mar 2025 vs Jan–Mar 2026" },
        { label: "Generated", value: D.generated },
      ]}
    >
      <SectionLabel>Month-by-Month Comparison</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={tableThLeft}>Month</th>
            <th style={tableTh}>Revenue 2025</th>
            <th style={tableTh}>Revenue 2026</th>
            <th style={tableTh}>Rev Δ</th>
            <th style={tableTh}>Occ 2025</th>
            <th style={tableTh}>Occ 2026</th>
            <th style={tableTh}>ADR 2025</th>
            <th style={tableTh}>ADR 2026</th>
            <th style={tableTh}>ADR Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.month} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
              <td style={tableTdLeft}>{r.month}</td>
              <td style={{ ...tableTd, color: R.textMuted }}>{fmtMoney0(r.rev25)}</td>
              <td style={tableTd}>{fmtMoney0(r.rev26)}</td>
              <td style={{ ...tableTd, color: r.revDelta >= 0 ? R.pos : R.neg }}>{fmtDelta(r.revDelta)}</td>
              <td style={{ ...tableTd, color: R.textMuted }}>{fmtPct(r.occ25)}</td>
              <td style={tableTd}>{fmtPct(r.occ26)}</td>
              <td style={{ ...tableTd, color: R.textMuted }}>£{fmtDecimal(r.adr25)}</td>
              <td style={tableTd}>£{fmtDecimal(r.adr26)}</td>
              <td style={{ ...tableTd, color: r.adrDelta >= 0 ? R.pos : R.neg }}>{fmtDelta(r.adrDelta)}</td>
            </tr>
          ))}
          <tr style={tableTotalsRow}>
            <td style={{ ...tableTdLeft, ...tableTotalsCell }}>YTD Total</td>
            <td style={{ ...tableTd, ...tableTotalsCell, color: R.textMuted }}>{fmtMoney0(totRev25)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney0(totRev26)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell, color: totDelta >= 0 ? R.pos : R.neg }}>{fmtDelta(totDelta)}</td>
            <td colSpan={5} style={tableTd}></td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
