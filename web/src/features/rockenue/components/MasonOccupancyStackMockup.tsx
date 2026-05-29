import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { R } from "../../../styles/tokens";

// ── Mason & Fifth — Occupancy by Service (Studio mockup, palette locked) ──
// Same shell as the production "90-day occupancy" chart (header, badge,
// container sizing, grid, axes 0-100, maxBarSize 10, 2fr:1fr card layout).
// Changes vs the old chart: no pickup → the 24h/3d/7d toggle is gone; bars
// stack the four service segments (Long · Mid · Short · Other); the legend
// now lives inside the chart header where the toggle used to be.
//
// Data is synthetic and kept roughly equal across the three guest segments
// so the colours read clearly. Real build wires to a daily per-service
// helper derived from reservations.mews_service_id.

const CAP = 331;

// Locked palette (variant A · muted red Other), Long darkened.
const PALETTE = { long: "#1E3A57", mid: "#50708F", short: "#7BAFD4", other: "#BA5A54" };

const DATA = Array.from({ length: 90 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const iso = d.toISOString().slice(0, 10);
  const dow = d.getDay();
  const weekend = dow === 5 || dow === 6;
  // Mockup only: three guest segments roughly equal so each colour reads.
  const long = 88 + Math.sin(i / 7) * 10 + (weekend ? 6 : 0);
  const mid = 84 + Math.cos(i / 5) * 10 + (weekend ? 5 : 0);
  const short = 90 + Math.sin(i / 4 + 1) * 10 + (weekend ? 8 : 0);
  const other = 12 + (i % 6 === 0 ? 4 : 0);
  const pct = (n: number) => (n / CAP) * 100;
  return {
    date: `${iso.slice(5)}`,
    fullDate: new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    long: pct(long),
    mid: pct(mid),
    short: pct(short),
    other: pct(other),
  };
});

const LEGEND_ITEMS: { key: keyof typeof PALETTE; label: string }[] = [
  { key: "long", label: "Long Stay" },
  { key: "mid", label: "Mid Stay" },
  { key: "short", label: "Short Stay" },
  { key: "other", label: "Other" },
];

function InlineLegend() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      {LEGEND_ITEMS.map((it) => (
        <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: PALETTE[it.key] }} />
          <span style={{ fontSize: 10, color: R.textMid, whiteSpace: "nowrap" }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const occ = d.long + d.mid + d.short + d.other;
  const row = (label: string, v: number, c: string) => (
    <div style={{ color: R.textDim, fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
      {label}: {v.toFixed(1)}%
    </div>
  );
  return (
    <div style={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: "10px 14px" }}>
      <div style={{ color: R.textMid, fontSize: 11, marginBottom: 6 }}>{d.fullDate}</div>
      <div style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Occupancy: {occ.toFixed(1)}%</div>
      {row("Long Stay", d.long, PALETTE.long)}
      {row("Mid Stay", d.mid, PALETTE.mid)}
      {row("Short Stay", d.short, PALETTE.short)}
      {row("Other", d.other, PALETTE.other)}
    </div>
  );
}

function OccByServiceChart() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${R.sep}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>
              90 Day Occupancy by Service
            </div>
            <span
              title="Covers every reservation at this property — Short, Mid and Long Stay services combined."
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: R.warmTeal,
                background: "rgba(56,198,186,0.10)",
                border: "1px solid rgba(56,198,186,0.25)",
                borderRadius: 4,
                padding: "2px 7px",
              }}
            >
              All Services
            </span>
          </div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
            Daily occupancy split by service
          </div>
        </div>
        {/* Legend lives where the 24h/3d/7d toggle used to be */}
        <InlineLegend />
      </div>
      <div style={{ padding: "20px 20px 16px", flex: 1, minHeight: 360, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={DATA} margin={{ top: 5, right: 10, left: 4, bottom: 5 }}>
            <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.25} vertical={false} />
            <XAxis
              dataKey="date"
              stroke={R.border}
              tick={{ fill: R.textDim, fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: R.border, strokeOpacity: 0.3 }}
              interval={6}
            />
            <YAxis
              stroke={R.border}
              tick={{ fill: R.textDim, fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              width={42}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip cursor={{ fill: "rgba(123,175,212,0.05)" }} content={<ChartTooltip />} />
            {/* Bottom → top: Long · Mid · Short · Other */}
            <Bar dataKey="long" stackId="o" name="Long Stay" radius={[0, 0, 0, 0]} maxBarSize={10} fill={PALETTE.long} fillOpacity={0.9} />
            <Bar dataKey="mid" stackId="o" name="Mid Stay" radius={[0, 0, 0, 0]} maxBarSize={10} fill={PALETTE.mid} fillOpacity={0.9} />
            <Bar dataKey="short" stackId="o" name="Short Stay" radius={[0, 0, 0, 0]} maxBarSize={10} fill={PALETTE.short} fillOpacity={0.9} />
            <Bar dataKey="other" stackId="o" name="Other" radius={[2, 2, 0, 0]} maxBarSize={10} fill={PALETTE.other} fillOpacity={0.9} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MasonOccupancyStackMockup() {
  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <div style={{ padding: "16px 28px", borderBottom: `1px solid ${R.border}`, background: R.darkBand }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>
          Studio · Mockup
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent, marginTop: 4 }}>
          Occupancy by Service — locked design
        </div>
        <div style={{ fontSize: 12, color: R.textDim, marginTop: 4 }}>
          Palette A (muted red Other), legend in-chart, no pickup toggle. Synthetic data (segments kept roughly equal).
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <OccByServiceChart />
          </div>
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>
              What "Other" is
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.55, color: R.text }}>
              Management/comp reservations (~4/day) + house-use/OOO blocks (~2/day) — occupied but not a guest segment.
              <br /><br />
              Short / Mid / Long are exact (Mews <code>service_id</code>). "Other" makes the stack reconcile to true property occupancy and sits on top of the segments.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
