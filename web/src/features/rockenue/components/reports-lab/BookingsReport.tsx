import { MOCK_REPORT as D, MOCK_BOOKINGS_DAYS } from "./reportMockData";
import { fmtDecimal } from "./reportShared";
import {
  ReportShell, SectionLabel,
  tableTh, tableTd, tableThLeft, tableTdLeft,
} from "./ReportShell";
import { REPORT as R } from "../../../../styles/reportTokens";

const fmtMoney2 = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDateLong = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const fmtDateShort = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export function BookingsReport() {
  return (
    <ReportShell
      reportType="Bookings"
      metadata={[
        { label: "Property", value: D.property },
        { label: "Period", value: "Last 3 days · grouped by booking date" },
        { label: "Generated", value: D.generated },
      ]}
    >
      {MOCK_BOOKINGS_DAYS.map((day) => (
        <div key={day.date} style={{ marginTop: 20 }}>
          {/* Day summary header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 6, borderBottom: `2px solid ${R.border}` }}>
            <div style={{ fontSize: 12, color: R.text, fontWeight: 500 }}>{fmtDateLong(day.date)}</div>
            <div style={{ fontSize: 10, color: R.textMuted, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>
              {day.bookings} bookings · {day.roomNights} room-nights · {fmtMoney2(day.revenue)}
            </div>
          </div>

          {day.details.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={tableThLeft}>Res. ID</th>
                  <th style={tableThLeft}>Guest</th>
                  <th style={tableThLeft}>Room Type</th>
                  <th style={tableTh}>Check-In</th>
                  <th style={tableTh}>Nights</th>
                  <th style={tableThLeft}>Source</th>
                  <th style={tableTh}>ADR</th>
                  <th style={tableTh}>Total</th>
                  <th style={tableThLeft}>Status</th>
                </tr>
              </thead>
              <tbody>
                {day.details.map((b, i) => {
                  const cancelled = b.status === "Cancelled";
                  const rowColor = cancelled ? R.textMuted : R.text;
                  return (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${R.border}`, background: i % 2 === 1 ? R.muted : "transparent" }}>
                      <td style={{ ...tableTdLeft, color: R.textMuted, fontSize: 10 }}>{b.id}</td>
                      <td style={{ ...tableTdLeft, color: rowColor, textDecoration: cancelled ? "line-through" : "none" }}>{b.guest}</td>
                      <td style={{ ...tableTdLeft, color: rowColor }}>{b.room}</td>
                      <td style={{ ...tableTd, color: rowColor }}>{fmtDateShort(b.checkIn)}</td>
                      <td style={{ ...tableTd, color: rowColor }}>{b.nights}</td>
                      <td style={{ ...tableTdLeft, color: rowColor }}>{b.source}</td>
                      <td style={{ ...tableTd, color: rowColor }}>£{fmtDecimal(b.rate)}</td>
                      <td style={{ ...tableTd, color: rowColor }}>{fmtMoney2(b.rate * b.nights)}</td>
                      <td style={{ ...tableTdLeft, color: cancelled ? R.neg : R.textMuted, fontSize: 10 }}>{b.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 10, color: R.textMuted, padding: "10px 0" }}>
              Individual booking detail not shown (summary only).
            </div>
          )}
        </div>
      ))}
      <SectionLabel>Notes</SectionLabel>
      <div style={{ fontSize: 10.5, color: R.textMuted, lineHeight: 1.55 }}>
        Cancelled bookings are struck through and excluded from revenue totals but retained in the booking count for audit.
      </div>
    </ReportShell>
  );
}
