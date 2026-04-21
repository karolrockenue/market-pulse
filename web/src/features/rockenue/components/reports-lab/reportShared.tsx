import { REPORT as R } from "../../../../styles/reportTokens";
import { MOCK_REPORT } from "./reportMockData";

// Shared primitives so the three variations only differ in composition,
// not in number formatting or KPI math.

export const fmtMoney = (n: number) =>
  `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

export const fmtDecimal = (n: number, d = 2) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toFixed(d)}%`;

export const fmtDelta = (n: number) => {
  const pct = (n * 100).toFixed(1);
  const sign = n >= 0 ? "+" : "";
  return `${sign}${pct}%`;
};

export function KpiBlock({
  label,
  value,
  delta,
  align = "left",
}: {
  label: string;
  value: string;
  delta: number;
  align?: "left" | "right" | "center";
}) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{
        fontSize: R.labelSize,
        letterSpacing: R.letterSpacingLabel,
        textTransform: "uppercase",
        color: R.textMuted,
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ fontSize: R.kpiSize, fontWeight: 600, color: R.text, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{
        fontSize: 11,
        color: delta >= 0 ? R.pos : R.neg,
        marginTop: 6,
        fontWeight: 500,
      }}>
        {fmtDelta(delta)} vs prior year
      </div>
    </div>
  );
}

export function SegmentTable() {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>Channel</th>
          <th style={{ textAlign: "right", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>Revenue</th>
          <th style={{ textAlign: "right", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>Share</th>
          <th style={{ textAlign: "right", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>ADR</th>
        </tr>
      </thead>
      <tbody>
        {MOCK_REPORT.bySegment.map((row, i) => {
          const isLast = i === MOCK_REPORT.bySegment.length - 1;
          return (
            <tr key={row.label}>
              <td style={{ padding: "10px 0", borderBottom: isLast ? "none" : `1px solid ${R.border}` }}>{row.label}</td>
              <td style={{ padding: "10px 0", textAlign: "right", borderBottom: isLast ? "none" : `1px solid ${R.border}` }}>{fmtMoney(row.revenue)}</td>
              <td style={{ padding: "10px 0", textAlign: "right", borderBottom: isLast ? "none" : `1px solid ${R.border}`, color: R.textMuted }}>{fmtPct(row.share, 1)}</td>
              <td style={{ padding: "10px 0", textAlign: "right", borderBottom: isLast ? "none" : `1px solid ${R.border}` }}>£{fmtDecimal(row.adr)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function RoomTypeTable() {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>Room Type</th>
          <th style={{ textAlign: "right", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>Sold</th>
          <th style={{ textAlign: "right", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>ADR</th>
          <th style={{ textAlign: "right", padding: "8px 0", borderBottom: `1px solid ${R.border}`, color: R.textMuted, fontWeight: 500, fontSize: 10, letterSpacing: R.letterSpacingLabel, textTransform: "uppercase" }}>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {MOCK_REPORT.byRoomType.map((row, i) => {
          const isLast = i === MOCK_REPORT.byRoomType.length - 1;
          return (
            <tr key={row.label}>
              <td style={{ padding: "10px 0", borderBottom: isLast ? "none" : `1px solid ${R.border}` }}>{row.label}</td>
              <td style={{ padding: "10px 0", textAlign: "right", borderBottom: isLast ? "none" : `1px solid ${R.border}`, color: R.textMuted }}>{row.sold.toLocaleString("en-GB")}</td>
              <td style={{ padding: "10px 0", textAlign: "right", borderBottom: isLast ? "none" : `1px solid ${R.border}` }}>£{fmtDecimal(row.adr)}</td>
              <td style={{ padding: "10px 0", textAlign: "right", borderBottom: isLast ? "none" : `1px solid ${R.border}`, fontWeight: 500 }}>{fmtMoney(row.revenue)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Small brand-mark for light surfaces (dark text version)
export function BrandMarkLight({ size = 14 }: { size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1 }}>
      <span style={{ color: "#38C6BA", fontSize: size * 1.7, fontWeight: 300 }}>(</span>
      <span style={{ color: R.text, fontSize: size, fontWeight: 700, letterSpacing: "0.14em" }}>MARKET PULSE</span>
      <span style={{ color: "#C8A66E", fontSize: size * 1.7, fontWeight: 300 }}>)</span>
    </div>
  );
}

// Brand-mark for dark letterhead surfaces (light text version)
export function BrandMarkDark({ size = 14 }: { size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1 }}>
      <span style={{ color: "#38C6BA", fontSize: size * 1.7, fontWeight: 300 }}>(</span>
      <span style={{ color: "#F3F5F7", fontSize: size, fontWeight: 700, letterSpacing: "0.14em" }}>MARKET PULSE</span>
      <span style={{ color: "#C8A66E", fontSize: size * 1.7, fontWeight: 300 }}>)</span>
    </div>
  );
}
