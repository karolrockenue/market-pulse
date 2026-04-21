import { MOCK_REPORT as D, MOCK_TAKINGS } from "./reportMockData";
import { fmtDecimal } from "./reportShared";
import {
  ReportShell, SectionLabel,
  tableTh, tableTd, tableThLeft, tableTdLeft,
  tableTotalsRow, tableTotalsCell,
} from "./ReportShell";
import { REPORT as R } from "../../../../styles/reportTokens";

const fmtMoney2 = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateShort = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function MonthlyTakingsReport() {
  const rows = MOCK_TAKINGS.map((r) => ({ ...r, net: r.gross - r.vat }));
  const totGross = rows.reduce((s, r) => s + r.gross, 0);
  const totNet = rows.reduce((s, r) => s + r.net, 0);
  const totVat = rows.reduce((s, r) => s + r.vat, 0);
  const totRooms = rows.reduce((s, r) => s + r.rooms, 0);
  const avgAdr = totGross / totRooms;

  return (
    <ReportShell
      reportType="Daily Takings"
      metadata={[
        { label: "Property", value: D.property },
        { label: "Period", value: "1–14 March 2026" },
        { label: "Currency", value: "GBP · VAT inclusive shown gross" },
        { label: "Generated", value: D.generated },
      ]}
    >
      <SectionLabel>Daily Takings Breakdown</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={tableThLeft}>Date</th>
            <th style={tableTh}>DOW</th>
            <th style={tableTh}>Room Nights</th>
            <th style={tableTh}>ADR</th>
            <th style={tableTh}>Net (ex. VAT)</th>
            <th style={tableTh}>VAT 20%</th>
            <th style={tableTh}>Gross</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isWeekend = r.dow === "Sat" || r.dow === "Sun";
            const adr = r.gross / r.rooms;
            return (
              <tr key={r.date} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
                <td style={tableTdLeft}>{fmtDateShort(r.date)}</td>
                <td style={{ ...tableTd, color: isWeekend ? R.text : R.textMuted }}>{r.dow}</td>
                <td style={tableTd}>{r.rooms}</td>
                <td style={tableTd}>£{fmtDecimal(adr)}</td>
                <td style={tableTd}>{fmtMoney2(r.net)}</td>
                <td style={tableTd}>{fmtMoney2(r.vat)}</td>
                <td style={tableTd}>{fmtMoney2(r.gross)}</td>
              </tr>
            );
          })}
          <tr style={tableTotalsRow}>
            <td style={{ ...tableTdLeft, ...tableTotalsCell }}>Totals</td>
            <td style={tableTd}></td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{totRooms}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>£{fmtDecimal(avgAdr)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney2(totNet)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney2(totVat)}</td>
            <td style={{ ...tableTd, ...tableTotalsCell }}>{fmtMoney2(totGross)}</td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
