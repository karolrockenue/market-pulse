import { MOCK_REPORT as D, MOCK_BUDGET } from "./reportMockData";
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

export function BudgetReport() {
  const rows = MOCK_BUDGET.map((m) => ({
    ...m,
    revVariance: (m.actualRev - m.budgetRev) / m.budgetRev,
    occVariance: m.actualOcc - m.budgetOcc,
    adrVariance: (m.actualAdr - m.budgetAdr) / m.budgetAdr,
  }));
  const totBudget = rows.reduce((s, r) => s + r.budgetRev, 0);
  const totActual = rows.reduce((s, r) => s + r.actualRev, 0);
  const totVar = (totActual - totBudget) / totBudget;

  return (
    <ReportShell
      reportType="Budget vs Actual"
      metadata={[
        { label: "Property", value: D.property },
        { label: "Period", value: "YTD · Jan–Apr 2026 (April partial)" },
        { label: "Budget set", value: "Nov 2025, locked by owner" },
        { label: "Generated", value: D.generated },
      ]}
    >
      <SectionLabel>Budget vs Actual</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={tableThLeft}>Month</th>
            <th style={tableTh}>Budget Rev</th>
            <th style={tableTh}>Actual Rev</th>
            <th style={tableTh}>Rev Var</th>
            <th style={tableTh}>Budget Occ</th>
            <th style={tableTh}>Actual Occ</th>
            <th style={tableTh}>Budget ADR</th>
            <th style={tableTh}>Actual ADR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.month} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
              <td style={tableTdLeft}>{r.month}</td>
              <td style={{ ...tableTd, color: R.textMuted }}>{fmtMoney0(r.budgetRev)}</td>
              <td style={tableTd}>{fmtMoney0(r.actualRev)}</td>
              <td style={{ ...tableTd, color: r.revVariance >= 0 ? R.pos : R.neg }}>{fmtDelta(r.revVariance)}</td>
              <td style={{ ...tableTd, color: R.textMuted }}>{fmtPct(r.budgetOcc)}</td>
              <td style={tableTd}>{fmtPct(r.actualOcc)}</td>
              <td style={{ ...tableTd, color: R.textMuted }}>£{fmtDecimal(r.budgetAdr)}</td>
              <td style={tableTd}>£{fmtDecimal(r.actualAdr)}</td>
            </tr>
          ))}
          <tr style={tableTotalsRow}>
            <td style={{ ...tableTdLeft, ...tableTotalsCell }}>YTD Total</td>
            <td style={{ ...tableTd, ...tableTotalsCell, color: R.textMuted }}>{fmtMoney0(totBudget)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney0(totActual)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell, color: totVar >= 0 ? R.pos : R.neg }}>{fmtDelta(totVar)}</td>
            <td colSpan={4} style={tableTd}></td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
