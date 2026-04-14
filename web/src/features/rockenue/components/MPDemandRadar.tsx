import { useMemo } from "react";
import { TrendingUp, Activity, Target, Zap, AlertCircle, Bell, Search, ChevronDown, Clock, Layers } from "lucide-react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, Bar, Cell,
  ReferenceLine, CartesianGrid, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { MPSidebar } from "./MPSidebar";

// ── MP Demand Radar — Rockenue style mockup ──

interface MPDemandRadarProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#2A3240", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
  amber: "#f59e0b", orange: "#f97316", purple: "#8b5cf6",
};

const gridStroke = { strokeDasharray: "0", stroke: R.border, opacity: 0.5 };
const axisStyle = { stroke: R.border, tick: { fill: R.textDim, fontSize: 10 }, tickLine: { stroke: R.border }, axisLine: { stroke: R.border } };
const tipStyle = {
  contentStyle: { backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: "6px", padding: "10px 14px" },
  labelStyle: { color: R.textMid, fontSize: "11px", marginBottom: "4px" },
  itemStyle: { fontSize: "12px", color: R.accent, padding: "1px 0" },
};

const demandColor = (d: number) => d >= 85 ? R.red : d >= 70 ? R.orange : d >= 50 ? R.amber : d >= 30 ? R.teal : "#3b82f6";
const curr = "£";

function Leg({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 14, height: 2, backgroundColor: (dashed || dotted) ? "transparent" : color, borderBottom: (dashed || dotted) ? `2px ${dotted ? "dotted" : "dashed"} ${color}` : "none", borderRadius: 1 }} />
      <span style={{ fontSize: 10, color: R.textDim }}>{label}</span>
    </div>
  );
}

function Signal({ color, title, detail }: { color: string; title: string; detail: string }) {
  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: R.accent, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: R.textMid, lineHeight: 1.5 }}>{detail}</div>
    </div>
  );
}

export function MPDemandRadar({ activeView, onNavigate }: MPDemandRadarProps) {
  // Generate 90 days of mock data
  const days = useMemo(() => {
    const events: Record<number, string> = { 8: "Wimbledon W1", 9: "Wimbledon W1", 22: "BST Hyde Park", 23: "BST Hyde Park", 38: "Notting Hill", 39: "Notting Hill", 50: "UEFA", 51: "UEFA" };
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(2026, 3, 14 + i);
      const dow = d.getDay();
      const isWknd = dow === 5 || dow === 6;
      const isEvent = events[i] != null;
      const demand = Math.min(98, Math.max(12, Math.round(44 + (isWknd ? 22 : 0) + (isEvent ? 18 : 0) + Math.sin(i * 0.25) * 14 + (i / 90) * 10)));
      const wap = Math.round(128 + (isWknd ? 32 : 0) + (isEvent ? 25 : 0) + Math.sin(i * 0.3) * 18 + (i / 90) * 15);
      const supply = Math.round(1820 - demand * 4 + Math.sin(i * 0.5) * 60);
      const demandDelta = Math.round((Math.sin(i * 0.4) * 8) + (isEvent ? 6 : 0));
      const wapDelta = Math.round(Math.sin(i * 0.35) * 12 + (isEvent ? 8 : 0));

      return {
        i, dow, demand, wap, supply, demandDelta, wapDelta,
        event: events[i] || null,
        label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        shortLabel: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" }),
        dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
        xLabel: i % 14 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
      };
    });
  }, []);

  // 7d moving averages
  const chartData = useMemo(() => days.map((day, i, arr) => {
    const win = arr.slice(Math.max(0, i - 6), i + 1);
    return {
      ...day,
      demandMa: Math.round(win.reduce((s, d) => s + d.demand, 0) / win.length),
      wapMa: Math.round(win.reduce((s, d) => s + d.wap, 0) / win.length),
    };
  }), [days]);

  const avgDemand = Math.round(days.reduce((s, d) => s + d.demand, 0) / days.length);
  const avgWap = Math.round(days.reduce((s, d) => s + d.wap, 0) / days.length);
  const avgSupply = Math.round(days.reduce((s, d) => s + d.supply, 0) / days.length);
  const highDemand = days.filter(d => d.demand >= 70).length;
  const sorted = [...days].sort((a, b) => b.demand - a.demand);
  const peak = sorted[0];
  const trough = sorted[sorted.length - 1];

  // Scatter data
  const scatterData = days.map(d => ({ x: d.demand, y: d.wap, label: d.shortLabel }));

  // DOW averages
  const dowAvg = Array.from({ length: 7 }, (_, dow) => {
    const subset = days.filter(d => d.dow === dow);
    return {
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      demand: Math.round(subset.reduce((s, d) => s + d.demand, 0) / subset.length),
      wap: Math.round(subset.reduce((s, d) => s + d.wap, 0) / subset.length),
    };
  });

  // Booking window zones
  const zones = [
    { tag: "Urgent", range: [0, 14], color: R.red },
    { tag: "Tactical", range: [15, 30], color: R.orange },
    { tag: "Strategic", range: [31, 60], color: R.amber },
    { tag: "Horizon", range: [61, 90], color: R.teal },
  ].map(z => {
    const subset = days.filter(d => d.i >= z.range[0] && d.i <= z.range[1]);
    return { ...z, avgDemand: Math.round(subset.reduce((s, d) => s + d.demand, 0) / subset.length), avgWap: Math.round(subset.reduce((s, d) => s + d.wap, 0) / subset.length), count: subset.length };
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>London</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} color={R.textDim} style={{ position: "absolute", left: 10 }} />
              <input style={{ background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 10px 6px 30px", fontSize: 12, color: R.text, outline: "none", width: 180 }} placeholder="Search..." />
            </div>
            <Bell size={16} color={R.textMid} />
          </div>
        </div>

        <div style={{ padding: "28px 32px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Activity size={22} color={R.teal} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: R.accent, margin: 0, letterSpacing: -0.5 }}>Demand Radar</h1>
          </div>
          <p style={{ fontSize: 13, color: R.textMid, margin: "0 0 20px" }}>90-day forward market intelligence for London</p>

          {/* ── Outlook Banner ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: "8px 8px 0 0", background: "rgba(56,198,186,0.06)", borderBottom: `1px solid rgba(56,198,186,0.25)` }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(56,198,186,0.3)" }}>
              <TrendingUp size={20} color={R.green} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: "#86efac" }}>The 90-day market demand is strengthening</div>
              <div style={{ fontSize: 12, color: R.textMid, marginTop: 4 }}>Based on {days.length} days of forward availability, pricing, and supply data</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: "#86efac", lineHeight: 1 }}>+4pp</div>
              <div style={{ fontSize: 12, color: R.textMid, marginTop: 4 }}>demand vs 30d ago</div>
            </div>
            <div style={{ width: 1, height: 40, background: R.border, margin: "0 4px" }} />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: R.green, lineHeight: 1 }}>+{curr}7</div>
              <div style={{ fontSize: 12, color: R.textMid, marginTop: 4 }}>avg rate vs 30d ago</div>
            </div>
          </div>

          {/* ── KPI Strip ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", background: R.card, borderRadius: "0 0 8px 8px", border: `1px solid ${R.border}`, borderTop: "none", marginBottom: 24, overflow: "hidden" }}>
            {[
              { label: "Avg Demand", value: `${avgDemand}%`, color: demandColor(avgDemand) },
              { label: "Avg WAP", value: `${curr}${avgWap}`, color: R.accent },
              { label: "Avg Supply", value: avgSupply.toLocaleString(), color: R.teal },
              { label: "High Demand", value: `${highDemand}`, sub: "of 90 above 70%", color: R.orange },
              { label: "Peak Date", value: peak.label, sub: `${peak.demand}% · ${curr}${peak.wap}`, color: R.red },
              { label: "Quietest", value: trough.label, sub: `${trough.demand}% · ${curr}${trough.wap}`, color: R.green },
            ].map((kpi, idx) => (
              <div key={kpi.label} style={{ padding: "14px 16px", textAlign: "center", borderRight: idx < 5 ? `1px solid ${R.border}` : "none" }}>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
                {kpi.sub && <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{kpi.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Signals ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            <Signal color={R.green} title="12 dates — demand up, rates flat" detail="Demand rose 5+pp in 7 days but WAP hasn't followed — revenue left on table" />
            <Signal color={R.amber} title="8 compression events" detail="Supply dropping 2%+ while demand is above 55% — strong pricing power" />
            <Signal color={R.textDim} title="6 low demand days" detail="Below 30% — consider promotions, visibility boosts, or flash deals" />
          </div>

          {/* ══════ DEMAND CHART ══════ */}
          <div style={{ background: R.card, borderRadius: "8px 8px 0 0", border: `1px solid ${R.border}`, borderBottom: "none" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>90-DAY FORWARD VIEW</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: R.accent }}>How Busy Is the Market?</div>
                <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Market demand score — higher means busier, stronger pricing power</div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Leg color={R.teal} label="Demand" />
                <Leg color={R.teal} label="7d trend" dashed />
              </div>
            </div>
            <div style={{ padding: "8px 20px 0", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="xLabel" {...axisStyle} interval={0} tickLine={false} height={20} tick={({ x, y, payload }: any) => payload?.value ? <text x={x} y={y + 12} textAnchor="middle" fill={R.textDim} fontSize={9}>{payload.value}</text> : null} />
                  <YAxis {...axisStyle} width={35} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip {...tipStyle} cursor={{ stroke: R.teal, strokeOpacity: 0.15, strokeWidth: 1 }} labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }} formatter={(v: number) => [`${v}%`, "Demand"]} />
                  <Bar dataKey="demand" name="Demand" radius={[2, 2, 0, 0]} maxBarSize={10}>
                    {chartData.map((d, i) => {
                      if (d.demand >= 85) return <Cell key={i} fill={R.red} fillOpacity={0.75} />;
                      if (d.demand >= 70) return <Cell key={i} fill={R.amber} fillOpacity={0.55} />;
                      return <Cell key={i} fill={R.teal} fillOpacity={0.25 + (d.demand / 100) * 0.45} />;
                    })}
                  </Bar>
                  <Line type="monotone" dataKey="demandMa" name="7d trend" stroke={R.teal} strokeWidth={2} strokeDasharray="6 3" dot={false} strokeOpacity={0.7} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ══════ WAP CHART ══════ */}
          <div style={{ background: R.card, borderLeft: `1px solid ${R.border}`, borderRight: `1px solid ${R.border}`, borderBottom: `1px solid ${R.border}` }}>
            <div style={{ padding: "12px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${R.border}` }}>
              <div>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>MARKET PRICING</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Weighted Average Price</div>
                <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>2-4★ hotel segment — excludes luxury and unrated</div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Leg color={R.accent} label="WAP" />
                <Leg color={R.textDim} label="7d trend" dotted />
              </div>
            </div>
            <div style={{ padding: "0 20px 16px", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 6, right: 10, left: -15, bottom: 20 }}>
                  <defs>
                    <linearGradient id="rWapFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={R.accent} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={R.accent} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={50} tickFormatter={v => `${curr}${v}`} domain={["dataMin - 15", "dataMax + 15"]} />
                  <Tooltip {...tipStyle} cursor={{ stroke: R.teal, strokeOpacity: 0.15, strokeWidth: 1 }} labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }} formatter={(v: number) => [`${curr}${v}`, "WAP"]} />
                  <Area type="monotone" dataKey="wap" name="WAP" stroke={R.accent} strokeWidth={2} fill="url(#rWapFill)" fillOpacity={1} dot={false} activeDot={{ r: 3, fill: R.accent, stroke: R.card, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="wapMa" name="7d trend" stroke={R.textDim} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.6} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ══════ 7-DAY CHANGE ══════ */}
          <div style={{ background: R.card, borderRadius: "0 0 8px 8px", border: `1px solid ${R.border}`, borderTop: "none", marginBottom: 24 }}>
            <div style={{ padding: "12px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${R.border}` }}>
              <div>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>7-DAY CHANGE</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Recent Pickup</div>
                <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>How demand and price shifted vs the same dates 7 days ago</div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Leg color={R.green} label="Demand up" />
                <Leg color={R.red} label="Demand down" />
                <Leg color={R.amber} label="Price change" dashed />
              </div>
            </div>
            <div style={{ padding: "0 20px 16px", height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 6, right: 10, left: -15, bottom: 20 }}>
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={50} />
                  <ReferenceLine y={0} stroke={R.textDim} strokeOpacity={0.4} strokeWidth={1} />
                  <Tooltip {...tipStyle} cursor={{ stroke: R.teal, strokeOpacity: 0.15, strokeWidth: 1 }} labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }} />
                  <Bar dataKey="demandDelta" name="Demand Δ" radius={[2, 2, 0, 0]} maxBarSize={8}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.demandDelta >= 0 ? R.green : R.red} fillOpacity={0.6} />)}
                  </Bar>
                  <Line type="monotone" dataKey="wapDelta" name="Price Δ" stroke={R.amber} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.7} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ══════ AI MARKET BRIEF ══════ */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "20px", marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>AI MARKET BRIEF</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: R.accent, marginBottom: 16 }}>What's Happening & Why</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { title: "Trajectory", body: "Demand is trending upward across the 90-day window, driven by seasonal momentum and event density in June-July. WAP is following with a slight lag — pricing power is building.", accent: R.green },
                { title: "Events", body: "Wimbledon (Jun 30–Jul 13) and BST Hyde Park are the dominant demand anchors. Hotels within 5km should pre-position rates 30+ days ahead of these windows.", accent: R.amber },
                { title: "Compression", body: "8 dates show supply contracting while demand holds above 55%. These are natural compression points — ideal for aggressive yield management and minimum-stay restrictions.", accent: R.teal },
              ].map(card => (
                <div key={card.title} style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: "16px", borderTop: `2px solid ${card.accent}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: R.accent, marginBottom: 8 }}>{card.title}</div>
                  <div style={{ fontSize: 12, color: R.textMid, lineHeight: 1.65 }}>{card.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══════ BOOKING WINDOW + DOW ══════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {/* Booking Window */}
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "20px" }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>BOOKING WINDOW</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: R.accent, marginBottom: 16 }}>Demand by Lead Time</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {zones.map(z => (
                  <div key={z.tag} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 72, fontSize: 11, fontWeight: 600, color: z.color }}>{z.tag}</div>
                    <div style={{ flex: 1, height: 24, background: R.darkBand, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                      <div style={{ height: "100%", width: `${z.avgDemand}%`, background: z.color, opacity: 0.35, borderRadius: 4 }} />
                      <span style={{ position: "absolute", right: 8, top: 4, fontSize: 11, fontWeight: 600, color: R.accent }}>{z.avgDemand}%</span>
                    </div>
                    <div style={{ width: 56, fontSize: 11, color: R.textDim, textAlign: "right" }}>{curr}{z.avgWap}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Day-of-Week */}
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "20px" }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>DAY-OF-WEEK PATTERNS</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: R.accent, marginBottom: 16 }}>Demand + WAP by Day</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dowAvg.map(d => (
                  <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, fontSize: 11, fontWeight: 500, color: R.textMid }}>{d.label}</div>
                    <div style={{ flex: 1, height: 20, background: R.darkBand, borderRadius: 4, overflow: "hidden", position: "relative" }}>
                      <div style={{ height: "100%", width: `${d.demand}%`, background: R.teal, opacity: 0.3, borderRadius: 4 }} />
                      <span style={{ position: "absolute", right: 8, top: 2, fontSize: 10, fontWeight: 600, color: R.accent }}>{d.demand}%</span>
                    </div>
                    <div style={{ width: 50, fontSize: 11, color: R.textDim, textAlign: "right" }}>{curr}{d.wap}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════ DIVERGENCE SCATTER ══════ */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}` }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>DEMAND vs PRICE</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Divergence Scatter</div>
              <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Each dot is one date — high demand + low WAP = opportunity</div>
            </div>
            <div style={{ padding: "8px 20px 16px", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                  <CartesianGrid {...gridStroke} />
                  <XAxis type="number" dataKey="x" name="Demand" {...axisStyle} domain={[0, 100]} tickFormatter={v => `${v}%`} label={{ value: "Demand %", position: "insideBottom", offset: -5, fill: R.textDim, fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" name="WAP" {...axisStyle} width={50} tickFormatter={v => `${curr}${v}`} label={{ value: "WAP", angle: -90, position: "insideLeft", offset: 15, fill: R.textDim, fontSize: 10 }} />
                  <ZAxis range={[30, 30]} />
                  <Tooltip {...tipStyle} formatter={(v: number, name: string) => [name === "Demand" ? `${v}%` : `${curr}${v}`, name]} />
                  <Scatter data={scatterData} fill={R.teal} fillOpacity={0.5} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ══════ SUPPLY DYNAMICS ══════ */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}` }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>SUPPLY DYNAMICS</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Available Properties</div>
              <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Total listed properties across the 90-day window</div>
            </div>
            <div style={{ padding: "0 20px 16px", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }}>
                  <defs>
                    <linearGradient id="rSupplyFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={R.teal} stopOpacity={0.12} />
                      <stop offset="100%" stopColor={R.teal} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={50} />
                  <Tooltip {...tipStyle} cursor={{ stroke: R.teal, strokeOpacity: 0.15, strokeWidth: 1 }} labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }} />
                  <Area type="monotone" dataKey="supply" name="Supply" stroke={R.teal} strokeWidth={1.5} fill="url(#rSupplyFill)" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
