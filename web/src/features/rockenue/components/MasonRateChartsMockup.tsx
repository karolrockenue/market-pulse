import { R } from "../../../styles/tokens";
import { MasonRateCharts } from "./MasonRateCharts";

// Studio mockup wrapper — renders the reusable MasonRateCharts block under a
// Studio header. The real charts live in MasonRateCharts.tsx (also embedded in
// the Sales Flash right column).
export function MasonRateChartsMockup() {
  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <div style={{ padding: "16px 28px", borderBottom: `1px solid ${R.border}`, background: R.darkBand }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>Studio · Mockup</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent, marginTop: 4 }}>Rate by Studio Category &amp; Segment</div>
        <div style={{ fontSize: 12, color: R.textDim, marginTop: 4 }}>
          Dom's three rate charts (source: "Av Studio Table"), restyled in Market Pulse. Synthetic data — live build pulls room categories + rates from Mews.
        </div>
      </div>
      <div style={{ padding: "24px 28px", maxWidth: 760 }}>
        <MasonRateCharts />
      </div>
    </div>
  );
}
