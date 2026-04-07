import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertCircle,
  Zap,
  Activity,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

// ── Market Pulse Design System ──
const MP = {
  bg: "#1d1d1c",
  card: "#1A1A1A",
  border: "#2a2a2a",
  input: "#2C2C2C",
  accent: "#39BDF8",
  text: "#e5e5e5",
  textSec: "#9ca3af",
  textMuted: "#6b7280",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  orange: "#f97316",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const gridStroke = { strokeDasharray: "0", stroke: MP.border, opacity: 0.5 };
const axisStyle = { stroke: MP.border, tick: { fill: MP.textMuted, fontSize: 10 }, tickLine: { stroke: MP.border }, axisLine: { stroke: MP.border } };
const tipStyle = {
  contentStyle: { backgroundColor: "rgba(26,26,26,0.95)", border: `1px solid ${MP.border}`, borderRadius: "6px", padding: "10px 14px" },
  labelStyle: { color: MP.textSec, fontSize: "11px", marginBottom: "4px" },
  itemStyle: { fontSize: "12px", color: MP.text, padding: "1px 0" },
};

// ── Mock data matching REAL API shape ──
// forward-view: market_demand_score, weighted_avg_price, total_results, mpss
// pace: wap_delta, total_results_percent_delta, market_demand_score_delta
const rand = (seed: number, min: number, max: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return min + (x - Math.floor(x)) * (max - min);
};

function generateData() {
  const days: any[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (let i = 0; i < 90; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dow = d.getDay();

    // Demand score — blended supply scarcity + price signal
    let dem = 44 + (i / 90) * 16;
    if (dow === 5) dem += 17;
    if (dow === 6) dem += 24;
    if (dow === 0) dem += 7;
    if (dow === 4) dem += 4;
    if (i === 12 || i === 13) dem += 30;
    if (i === 28) dem += 24;
    if (i === 45 || i === 46) dem += 36;
    if (i >= 60 && i <= 62) dem += 20;
    if (i === 75 || i === 76) dem += 28;
    const demand = Math.min(99, Math.max(8, Math.round(dem + rand(i, -7, 7))));

    // WAP — from Booking.com scrape
    const wap = Math.round(118 + (demand - 44) * 1.9 + rand(i + 100, -10, 10));

    // Supply — total properties available on Booking.com
    const supply = Math.round(3850 - (demand - 44) * 9 + rand(i + 200, -120, 120));

    // MPSS — price index (where this date sits on 0-100 price scale within the 90d window)
    const mpss = Math.min(100, Math.max(0, Math.round(demand * 0.75 + rand(i + 300, -10, 12))));

    // Pace deltas (vs 7 days ago) — what actually changed since last week
    const wapDelta = Math.round(rand(i + 400, -18, 18));
    const supplyPctDelta = Math.round(rand(i + 500, -5, 5) * 10) / 10;
    const demandDelta = Math.round(rand(i + 600, -8, 8));

    days.push({
      i, d, dow,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      shortLabel: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" }),
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      xLabel: i % 14 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
      weekNum: Math.floor(i / 7),
      // Forward view
      demand, wap, supply, mpss,
      // Pace (7d)
      wapDelta, supplyPctDelta, demandDelta,
    });
  }

  // Add 7d moving averages
  return days.map((day, i, arr) => {
    const win = arr.slice(Math.max(0, i - 6), i + 1);
    const demandMa = Math.round(win.reduce((s, d) => s + d.demand, 0) / win.length);
    const wapMa = Math.round(win.reduce((s, d) => s + d.wap, 0) / win.length);
    return { ...day, demandMa, wapMa };
  });
}

interface DemandRadarProps { allHotels: any[] }

export function DemandRadarView({ allHotels }: DemandRadarProps) {
  const curr = "\u00A3";
  const days = useMemo(() => generateData(), []);

  // ── Stats ──
  const stats = useMemo(() => {
    const avg = (key: string) => Math.round(days.reduce((s, d) => s + d[key], 0) / days.length);
    const avgDemand = avg("demand");
    const avgWap = avg("wap");
    const avgSupply = avg("supply");

    // Trajectory
    const early = days.slice(0, 21);
    const late = days.slice(-21);
    const earlyDemand = Math.round(early.reduce((s, d) => s + d.demand, 0) / early.length);
    const lateDemand = Math.round(late.reduce((s, d) => s + d.demand, 0) / late.length);
    const earlyWap = Math.round(early.reduce((s, d) => s + d.wap, 0) / early.length);
    const lateWap = Math.round(late.reduce((s, d) => s + d.wap, 0) / late.length);
    const demandTrajectory = lateDemand - earlyDemand;
    const wapTrajectory = lateWap - earlyWap;

    // Counts
    const highDemand = days.filter((d) => d.demand >= 70).length;
    const lowDemand = days.filter((d) => d.demand < 30).length;

    // Days where demand rose but price didn't follow (opportunity)
    const risingDemandFlatPrice = days.filter((d) => d.demandDelta > 5 && d.wapDelta < 2).length;
    // Days where supply is compressing (dropping) and demand is high
    const compressed = days.filter((d) => d.supplyPctDelta < -2 && d.demand > 55).length;

    // Peak / trough
    const sorted = [...days].sort((a, b) => b.demand - a.demand);
    const peak = sorted[0];
    const trough = sorted[sorted.length - 1];

    const regime = demandTrajectory > 5 ? "strengthening" : demandTrajectory < -5 ? "softening" : "stable";

    return { avgDemand, avgWap, avgSupply, demandTrajectory, wapTrajectory, highDemand, lowDemand, risingDemandFlatPrice, compressed, peak, trough, regime };
  }, [days]);

  const bannerCfg = stats.regime === "strengthening"
    ? { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.4)", icon: MP.green, text: "#86efac", Icon: TrendingUp }
    : stats.regime === "softening"
    ? { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.4)", icon: MP.red, text: "#fca5a5", Icon: TrendingDown }
    : { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.4)", icon: MP.amber, text: "#fde047", Icon: Minus };

  const demandColor = (d: number) => d >= 85 ? MP.red : d >= 70 ? MP.orange : d >= 50 ? MP.amber : d >= 30 ? MP.accent : MP.green;

  return (
    <div className="min-h-screen" style={{ backgroundColor: MP.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Activity style={{ width: "24px", height: "24px", color: MP.accent }} />
          <h1 style={{ color: MP.text, fontSize: "24px", margin: 0, fontWeight: 600 }}>Demand Radar</h1>
        </div>
        <p style={{ color: MP.textSec, margin: "0 0 20px", fontSize: "13px" }}>
          90-day forward market intelligence • Booking.com channel data
        </p>

        {/* ── OUTLOOK BANNER ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "16px", padding: "16px",
          borderRadius: "8px 8px 0 0", backgroundColor: bannerCfg.bg,
          borderBottom: `1px solid ${bannerCfg.border}`,
        }}>
          <div style={{ flexShrink: 0, width: "40px", height: "40px", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", border: `1px solid ${bannerCfg.border}` }}>
            <bannerCfg.Icon className="w-5 h-5" style={{ color: bannerCfg.icon }} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <h3 style={{ fontSize: "16px", fontWeight: 500, color: bannerCfg.text, margin: 0 }}>
              The 90-day market demand is {stats.regime}
            </h3>
            <p style={{ fontSize: "12px", color: MP.textSec, margin: "4px 0 0" }}>
              Based on {days.length} days of forward availability, pricing, and supply data scraped daily from Booking.com
            </p>
          </div>
          <div style={{ fontSize: "24px", fontWeight: 600, color: bannerCfg.text, whiteSpace: "nowrap" }}>
            {stats.demandTrajectory > 0 ? "+" : ""}{stats.demandTrajectory}pp
          </div>
        </div>

        {/* ── KPIs (attached to banner) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", backgroundColor: MP.card, borderRadius: "0 0 8px 8px", border: `1px solid ${MP.border}`, borderTop: "none", marginBottom: "24px", overflow: "hidden" }}>
          {[
            { label: "Avg Demand", value: `${stats.avgDemand}%`, color: demandColor(stats.avgDemand) },
            { label: "Avg WAP", value: `${curr}${stats.avgWap}`, color: MP.text },
            { label: "Avg Supply", value: stats.avgSupply.toLocaleString(), color: MP.accent },
            { label: "High Demand Days", value: `${stats.highDemand}`, sub: "of 90 above 70%", color: MP.orange },
            { label: "Peak Date", value: stats.peak?.label || "—", sub: `${stats.peak?.demand}% · ${curr}${stats.peak?.wap}`, color: MP.red },
            { label: "Quietest Date", value: stats.trough?.label || "—", sub: `${stats.trough?.demand}% · ${curr}${stats.trough?.wap}`, color: MP.green },
          ].map((kpi, idx) => (
            <div key={kpi.label} style={{ padding: "14px 16px", textAlign: "center", borderRight: idx < 5 ? `1px solid ${MP.border}` : "none" }}>
              <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{kpi.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: "10px", color: MP.textMuted, marginTop: "2px" }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── SIGNALS (if any) ── */}
        {(stats.risingDemandFlatPrice > 0 || stats.compressed > 0 || stats.lowDemand > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {stats.risingDemandFlatPrice > 0 && (
              <Signal icon={<Target className="w-4 h-4" />} color={MP.green}
                title={`${stats.risingDemandFlatPrice} dates — demand up, rates flat`}
                detail="Demand rose 5+pp in last 7 days but WAP hasn't followed — potential revenue left on table" />
            )}
            {stats.compressed > 0 && (
              <Signal icon={<Zap className="w-4 h-4" />} color={MP.amber}
                title={`${stats.compressed} compression events`}
                detail="Supply dropping 2%+ while demand is above 55% — strong pricing power window" />
            )}
            {stats.lowDemand > 0 && (
              <Signal icon={<AlertCircle className="w-4 h-4" />} color={MP.textMuted}
                title={`${stats.lowDemand} low demand days`}
                detail="Below 30% demand — consider promotions, OTA visibility boosts, or flash deals" />
            )}
          </div>
        )}

        {/* ── MAIN CHART: Demand bars (colored) + WAP line ── */}
        <Card label="DEMAND & PRICING" title="Market Demand vs Weighted Average Price"
          subtitle="Bars = demand % colored by intensity · Line = market WAP · Spot high-demand high-price days instantly"
          legend={<><Leg color={MP.amber} label="Demand (colored)" /> <Leg color={MP.text} label="WAP" /></>}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={days} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="dr">
                <CartesianGrid {...gridStroke} vertical={false} />
                <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                <YAxis yAxisId="demand" {...axisStyle} width={35} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="wap" orientation="right" {...axisStyle} width={50} tickFormatter={(v) => `${curr}${v}`} />
                <Tooltip {...tipStyle} cursor={{ fill: "rgba(57,189,248,0.04)" }}
                  labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }}
                  formatter={(v: number, name: string) => name === "WAP" ? [`${curr}${v}`, name] : [`${v}%`, name]} />
                <Bar yAxisId="demand" dataKey="demand" name="Demand" radius={[3, 3, 0, 0]} maxBarSize={14} fillOpacity={0.85}>
                  {days.map((d, i) => <Cell key={i} fill={demandColor(d.demand)} />)}
                </Bar>
                <Line yAxisId="wap" type="monotone" dataKey="wap" name="WAP" stroke={MP.text} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── DATE STRIP: Demand + Price side by side for every day ── */}
        <Card label="DATE-BY-DATE" title="Demand & Price Scanner"
          subtitle="Each row = one day. Instantly spot high demand + high price, or demand rising without price following.">
          <div style={{ maxHeight: "520px", overflowY: "auto", marginRight: "-8px", paddingRight: "8px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${MP.border}`, position: "sticky", top: 0, backgroundColor: MP.card, zIndex: 1 }}>
              <div style={{ width: "100px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase" }}>Date</div>
              <div style={{ flex: 1, fontSize: "10px", color: MP.textMuted, textTransform: "uppercase" }}>Demand</div>
              <div style={{ width: "50px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>%</div>
              <div style={{ width: "20px" }} />
              <div style={{ flex: 1, fontSize: "10px", color: MP.textMuted, textTransform: "uppercase" }}>WAP</div>
              <div style={{ width: "55px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>Rate</div>
              <div style={{ width: "20px" }} />
              <div style={{ width: "60px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>Supply</div>
              <div style={{ width: "70px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>7d Pace</div>
            </div>
            {/* Rows */}
            {days.map((d) => {
              const wapPct = Math.min(100, Math.max(0, ((d.wap - 80) / (280 - 80)) * 100));
              const isWeekend = d.dow === 0 || d.dow === 5 || d.dow === 6;
              return (
                <div key={d.i} style={{
                  display: "flex", alignItems: "center", padding: "5px 0",
                  borderBottom: `1px solid ${MP.border}`,
                  backgroundColor: isWeekend ? "rgba(57,189,248,0.02)" : "transparent",
                }}>
                  {/* Date */}
                  <div style={{ width: "100px", fontSize: "12px", color: isWeekend ? MP.text : MP.textSec, fontWeight: isWeekend ? 600 : 400 }}>
                    {d.shortLabel}
                  </div>
                  {/* Demand bar */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <div style={{ height: "14px", borderRadius: "3px", backgroundColor: demandColor(d.demand), opacity: 0.7, width: `${d.demand}%`, minWidth: "4px", transition: "width 0.2s" }} />
                  </div>
                  <div style={{ width: "50px", fontSize: "12px", fontWeight: 600, color: demandColor(d.demand), textAlign: "right" }}>{d.demand}%</div>
                  <div style={{ width: "20px" }} />
                  {/* WAP bar */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    <div style={{ height: "14px", borderRadius: "3px", backgroundColor: MP.text, opacity: 0.15, width: `${wapPct}%`, minWidth: "4px" }} />
                  </div>
                  <div style={{ width: "55px", fontSize: "12px", color: MP.text, textAlign: "right" }}>{curr}{d.wap}</div>
                  <div style={{ width: "20px" }} />
                  {/* Supply */}
                  <div style={{ width: "60px", fontSize: "11px", color: MP.textMuted, textAlign: "right" }}>{d.supply.toLocaleString()}</div>
                  {/* Pace indicator */}
                  <div style={{ width: "70px", fontSize: "11px", textAlign: "right", color: d.demandDelta > 3 ? MP.green : d.demandDelta < -3 ? MP.red : MP.textMuted }}>
                    {d.demandDelta > 0 ? "+" : ""}{d.demandDelta}pp
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── PACE ROW: What moved in the last 7 days ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {/* Demand Pace */}
          <Card label="7-DAY PACE" title="Demand Change" subtitle="How demand shifted vs 7 days ago per check-in date">
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 10, right: 5, left: -20, bottom: 20 }} syncId="dr">
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={30} tickFormatter={(v) => `${v}`} />
                  <ReferenceLine y={0} stroke={MP.textMuted} strokeOpacity={0.3} />
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57,189,248,0.04)" }}
                    labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l}
                    formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}pp`, "Demand \u0394"]} />
                  <Bar dataKey="demandDelta" radius={[2, 2, 0, 0]} maxBarSize={10}>
                    {days.map((d, i) => <Cell key={i} fill={d.demandDelta >= 0 ? MP.green : MP.red} fillOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Price Pace */}
          <Card label="7-DAY PACE" title="Price Change" subtitle="WAP movement vs 7 days ago">
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 10, right: 5, left: -20, bottom: 20 }} syncId="dr">
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={35} tickFormatter={(v) => `${curr}${v}`} />
                  <ReferenceLine y={0} stroke={MP.textMuted} strokeOpacity={0.3} />
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57,189,248,0.04)" }}
                    labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l}
                    formatter={(v: number) => [`${v > 0 ? "+" : ""}${curr}${v}`, "WAP \u0394"]} />
                  <Bar dataKey="wapDelta" radius={[2, 2, 0, 0]} maxBarSize={10}>
                    {days.map((d, i) => <Cell key={i} fill={d.wapDelta >= 0 ? MP.green : MP.red} fillOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Supply Pace */}
          <Card label="7-DAY PACE" title="Supply Change" subtitle="Properties available vs 7 days ago">
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 10, right: 5, left: -20, bottom: 20 }} syncId="dr">
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={30} tickFormatter={(v) => `${v}%`} />
                  <ReferenceLine y={0} stroke={MP.textMuted} strokeOpacity={0.3} />
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57,189,248,0.04)" }}
                    labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l}
                    formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}%`, "Supply \u0394"]} />
                  <Bar dataKey="supplyPctDelta" radius={[2, 2, 0, 0]} maxBarSize={10}>
                    {days.map((d, i) => <Cell key={i} fill={d.supplyPctDelta >= 0 ? MP.accent : MP.purple} fillOpacity={0.6} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ── SUPPLY LANDSCAPE ── */}
        <Card label="SUPPLY DYNAMICS" title="Available Properties"
          subtitle="Total Booking.com listings per check-in date — drops signal compression">
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={days} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="dr">
                <defs>
                  <linearGradient id="dr-supply" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MP.purple} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={MP.purple} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStroke} vertical={false} />
                <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                <YAxis {...axisStyle} width={45} />
                <Tooltip {...tipStyle} cursor={{ stroke: MP.border }}
                  labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l}
                  formatter={(v: number) => [v.toLocaleString(), "Properties"]} />
                <Area type="monotone" dataKey="supply" name="Supply" stroke={MP.purple} fill="url(#dr-supply)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>



        <div style={{ textAlign: "center", color: MP.textMuted, fontSize: "12px", paddingBottom: "16px" }}>
          Mock data • Production sources from daily Booking.com scrapes • Updated daily at 04:00 UTC
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Card({ label, title, subtitle, legend, children }: { label: string; title: string; subtitle: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: MP.card, borderRadius: "8px", border: `1px solid ${MP.border}`, marginBottom: "16px" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${MP.border}` }}>
        <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <h3 style={{ color: MP.text, fontSize: "16px", fontWeight: 600, margin: 0 }}>{title}</h3>
            <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>{subtitle}</p>
          </div>
          {legend && <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>{legend}</div>}
        </div>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Signal({ icon, color, title, detail }: { icon: React.ReactNode; color: string; title: string; detail: string }) {
  return (
    <div style={{ backgroundColor: MP.card, borderRadius: "8px", border: `1px solid ${MP.border}`, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: MP.text }}>{title}</span>
      </div>
      <p style={{ fontSize: "11px", color: MP.textSec, margin: 0, lineHeight: 1.4 }}>{detail}</p>
    </div>
  );
}

function Leg({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
      <span style={{ width: "16px", height: "2px", borderRadius: "1px", backgroundColor: dashed || dotted ? "transparent" : color, borderBottom: dashed ? `2px dashed ${color}` : dotted ? `2px dotted ${color}` : "none", opacity: dashed ? 0.4 : dotted ? 0.5 : 1 }} />
      <span style={{ color: MP.textMuted, fontSize: "11px" }}>{label}</span>
    </span>
  );
}
