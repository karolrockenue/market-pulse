import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { R } from "../../../styles/tokens";
import type { SsWeeklyRow } from "../api/mason.api";

// ── Mason & Fifth — per-segment Weekly Bookings chart ──
// One generic chart used beside each segment's table (Short / Mid / Long —
// Dom's "split Accommodation Bookings per segment"): clustered bars (bookings
// + room nights) + revenue £ line on a secondary axis.

const C = {
  bookings: "#7BAFD4",
  nights: "#50708F",
  revenue: "#C8A66E",
};

function gbpCompact(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `£${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (a >= 1_000) return `£${Math.round(v / 1_000)}k`;
  return `£${Math.round(v)}`;
}

function weekLabel(ws: string) {
  return new Date(ws + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

const cardStyle = { background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, marginBottom: 14 };
const titleStyle = { fontSize: 10, color: R.warmTeal, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.5, padding: "0 0 10px 2px" };

function SsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const row = (lbl: string, val: string, c: string) => (
    <div style={{ color: R.textDim, fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{lbl}: <span style={{ color: R.text }}>{val}</span>
    </div>
  );
  return (
    <div style={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: "10px 14px" }}>
      <div style={{ color: R.textMid, fontSize: 11, marginBottom: 6 }}>Week beginning {label}</div>
      {row("Bookings", String(d.bookings), C.bookings)}
      {row("Room nights", d.nights.toLocaleString(), C.nights)}
      {row("Revenue (gross)", gbpCompact(d.revenue), C.revenue)}
    </div>
  );
}

// Generic per-segment weekly chart: bookings + nights bars + revenue £ line.
// Used for Short / Mid / Long each beside its own table (Dom's split request).
export function SegmentWeeklyChart({ rows, title, height = 240 }: { rows: SsWeeklyRow[]; title: string; height?: number }) {
  if (!rows?.length) {
    return (
      <div style={{ ...cardStyle, marginBottom: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
        <span style={{ color: R.textDim, fontSize: 11 }}>No bookings captured yet.</span>
      </div>
    );
  }
  const data = rows.map((w) => ({ week: weekLabel(w.weekStart), bookings: w.bookings, nights: w.roomNights, revenue: w.revenue }));
  return (
    <div style={{ ...cardStyle, marginBottom: 0 }}>
      <div style={titleStyle}>{title}</div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.25} vertical={false} />
          <XAxis dataKey="week" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} />
          <YAxis yAxisId="count" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={36} domain={[0, "auto"]} allowDecimals={false} />
          <YAxis yAxisId="rev" orientation="right" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={48} domain={[0, "auto"]} tickFormatter={gbpCompact} />
          <Tooltip cursor={{ fill: "rgba(123,175,212,0.05)" }} content={<SsTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, color: R.textMid }} iconType="plainline" />
          <Bar yAxisId="count" dataKey="bookings" name="Bookings" fill={C.bookings} fillOpacity={0.9} maxBarSize={16} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="count" dataKey="nights" name="Room nights" fill={C.nights} fillOpacity={0.9} maxBarSize={16} radius={[2, 2, 0, 0]} />
          <Line yAxisId="rev" dataKey="revenue" name="Revenue £ (right)" stroke={C.revenue} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

