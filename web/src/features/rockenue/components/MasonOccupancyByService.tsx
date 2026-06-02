import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { R } from "../../../styles/tokens";
import { fetchMasonOccByService, type OccByServiceResponse } from "../api/mason.api";

// ── Mason & Fifth — 120-day Occupancy by Service ──
// Stacked daily occupancy for the Sales Flash, replacing the old
// occupancy+pickup chart. Long/Mid/Short come from Mews service_id;
// Other = property occupancy − the three guest segments
// (Management/comp + house-use/OOO blocks). Values are % of capacity.
// Stack order (bottom→top): Long · Mid · Short · Other. Long is anchored at
// the 0% baseline and Other (offline) sits on top, so day-to-day swings in
// offline rooms don't make Long Stay look like it's shrinking (Dom, Jun 2026).
// Palette locked: A · muted-red Other.

const DAYS = 120;
// Blue ramp with even LIGHTNESS steps and low saturation so adjacent bars
// separate by brightness, not by vibrating hue (saturated blues/teal made it
// shimmer). Mid = muted steel-blue between dark navy (Long) and light (Short).
const PALETTE = { long: "#1E3A57", mid: "#50708F", short: "#7BAFD4", other: "#BA5A54" };

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

export function MasonOccupancyByService({ hotelId, monthKey }: { hotelId: number; monthKey?: string }) {
  const [resp, setResp] = useState<OccByServiceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResp(null);
    setLoading(true);
    setError(null);
    fetchMasonOccByService(hotelId, monthKey, DAYS)
      .then((d) => { if (!cancelled) setResp(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hotelId, monthKey]);

  const { data, monthMarks } = useMemo(() => {
    if (!resp) return { data: [], monthMarks: [] as { x: string; label: string }[] };
    const rows = resp.rows.map((r) => {
      const dt = new Date(r.date);
      const cap = r.capacity || 1;
      const pct = (n: number) => (n / cap) * 100;
      return {
        date: dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
        fullDate: dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }),
        dom: dt.getUTCDate(),
        long: pct(r.long),
        mid: pct(r.mid),
        short: pct(r.short),
        other: pct(r.other),
      };
    });
    // Vertical split at the 1st of each month (after the first point) — divides
    // the window into months. Label with the month abbreviation.
    const monthMarks = rows
      .filter((d, i) => i > 0 && d.dom === 1)
      .map((d) => ({ x: d.date, label: d.date.split(" ")[1] }));
    return { data: rows, monthMarks };
  }, [resp]);

  const xInterval = Math.max(6, Math.floor(data.length / 13));

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 28 }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>120 Day Occupancy by Service</div>
              <span
                title="Covers every reservation at this property — Short, Mid and Long Stay services combined."
                style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: R.warmTeal, background: "rgba(56,198,186,0.10)", border: "1px solid rgba(56,198,186,0.25)", borderRadius: 4, padding: "2px 7px" }}
              >
                All Services
              </span>
            </div>
            <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>Daily occupancy split by service</div>
          </div>
          <InlineLegend />
        </div>
        <div style={{ padding: "20px 20px 16px", height: 380, position: "relative" }}>
          {loading && data.length === 0 && (
            <div style={{ position: "absolute", inset: 20, display: "flex", alignItems: "center", justifyContent: "center", color: R.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Loading occupancy…
            </div>
          )}
          {error && (
            <div style={{ position: "absolute", inset: 20, display: "flex", alignItems: "center", justifyContent: "center", color: R.red, fontSize: 11 }}>
              {error}
            </div>
          )}
          {!loading && !error && data.length === 0 ? (
            <div style={{ position: "absolute", inset: 20, display: "flex", alignItems: "center", justifyContent: "center", color: R.textDim, fontSize: 11 }}>
              No occupancy data for this property.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={344}>
              <ComposedChart data={data} margin={{ top: 5, right: 10, left: 4, bottom: 5 }}>
                <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.25} vertical={false} />
                <XAxis dataKey="date" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} interval={xInterval} />
                <YAxis stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={42} domain={[0, 110]} allowDataOverflow ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip cursor={{ fill: "rgba(123,175,212,0.05)" }} content={<ChartTooltip />} />
                <Bar dataKey="other" stackId="o" name="Other" radius={[2, 2, 0, 0]} maxBarSize={8} fill={PALETTE.other} fillOpacity={0.9} />
                <Bar dataKey="short" stackId="o" name="Short Stay" radius={[0, 0, 0, 0]} maxBarSize={8} fill={PALETTE.short} fillOpacity={0.9} />
                <Bar dataKey="mid" stackId="o" name="Mid Stay" radius={[0, 0, 0, 0]} maxBarSize={8} fill={PALETTE.mid} fillOpacity={0.9} />
                <Bar dataKey="long" stackId="o" name="Long Stay" radius={[0, 0, 0, 0]} maxBarSize={8} fill={PALETTE.long} fillOpacity={0.9} />
                {/* Month-boundary dividers — rendered after the bars so they sit on top of tall spikes. */}
                {monthMarks.map((m) => (
                  <ReferenceLine
                    key={m.x}
                    x={m.x}
                    stroke={R.text}
                    strokeOpacity={0.55}
                    strokeDasharray="3 3"
                    ifOverflow="visible"
                    label={{ value: m.label, position: "insideTopLeft", fill: R.textDim, fontSize: 9 }}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
