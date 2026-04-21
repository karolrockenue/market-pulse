import { MOCK_REPORT as D, MOCK_PICKUP } from "./reportMockData";
import {
  ReportShell, SectionLabel,
  tableTh, tableTd, tableThLeft, tableTdLeft,
} from "./ReportShell";
import { REPORT as R } from "../../../../styles/reportTokens";

const fmtPct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const fmtDateShort = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function PickupReport() {
  const rows = MOCK_PICKUP.map((r) => ({ ...r, occ: r.sold / r.capacity }));

  return (
    <ReportShell
      reportType="Pickup & Pace"
      metadata={[
        { label: "Property", value: D.property },
        { label: "Horizon", value: "Next 14 arrival dates" },
        { label: "Pickup baseline", value: "Snapshot of rooms-sold Δ vs 1 / 7 / 30 days ago" },
        { label: "Generated", value: D.generated },
      ]}
    >
      <SectionLabel>Forward Pace</SectionLabel>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={tableThLeft}>Arrival</th>
            <th style={tableTh}>DOW</th>
            <th style={tableTh}>Capacity</th>
            <th style={tableTh}>Sold</th>
            <th style={tableTh}>Occ %</th>
            <th style={tableTh}>+1d</th>
            <th style={tableTh}>+7d</th>
            <th style={tableTh}>+30d</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isWeekend = r.dow === "Sat" || r.dow === "Sun";
            return (
              <tr key={r.date} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
                <td style={tableTdLeft}>{fmtDateShort(r.date)}</td>
                <td style={{ ...tableTd, color: isWeekend ? R.text : R.textMuted }}>{r.dow}</td>
                <td style={{ ...tableTd, color: R.textMuted }}>{r.capacity}</td>
                <td style={tableTd}>{r.sold}</td>
                <td style={tableTd}>{fmtPct(r.occ, 1)}</td>
                <td style={{ ...tableTd, color: R.pos }}>{signed(r.pickup1)}</td>
                <td style={{ ...tableTd, color: R.pos }}>{signed(r.pickup7)}</td>
                <td style={{ ...tableTd, color: R.pos }}>{signed(r.pickup30)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ReportShell>
  );
}
