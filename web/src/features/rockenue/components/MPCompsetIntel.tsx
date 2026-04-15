import { useMemo } from "react";
import { Calendar, MapPin, Database, TrendingUp, Bell, Search, ChevronDown } from "lucide-react";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Area, Line, Bar, Cell,
  CartesianGrid, BarChart,
} from "recharts";

// ── MP Demand & Pace (Compset Intel) — Rockenue style mockup ──

interface MPCompsetIntelProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
  amber: "#f59e0b", orange: "#f97316", purple: "#8b5cf6", blue: "#3b82f6",
};

const gridStroke = { strokeDasharray: "0", stroke: R.border, opacity: 0.5 };
const axisStyle = { stroke: R.border, tick: { fill: R.textDim, fontSize: 10 }, tickLine: { stroke: R.border }, axisLine: { stroke: R.border } };
const tipStyle = {
  contentStyle: { backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: "6px", padding: "10px 14px" },
  labelStyle: { color: R.textMid, fontSize: "11px", marginBottom: "4px" },
  itemStyle: { fontSize: "12px", color: R.accent, padding: "1px 0" },
};
const curr = "£";

function Leg({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 14, height: 2, backgroundColor: dashed ? "transparent" : color, borderBottom: dashed ? `2px dashed ${color}` : "none", borderRadius: 1 }} />
      <span style={{ fontSize: 10, color: R.textDim }}>{label}</span>
    </div>
  );
}

export function MPCompsetIntel({ activeView, onNavigate }: MPCompsetIntelProps) {
  // 90 days of mock market data
  const data = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(2026, 3, 14 + i);
      const dow = d.getDay();
      const isWknd = dow === 5 || dow === 6;
      const supply = Math.round(1860 + (isWknd ? -120 : 0) + Math.sin(i * 0.3) * 80 - (i / 90) * 60);
      const demand = Math.min(98, Math.max(15, Math.round(48 + (isWknd ? 20 : 0) + Math.sin(i * 0.25) * 14 + (i / 90) * 8)));
      const wap = Math.round(132 + (isWknd ? 28 : 0) + Math.sin(i * 0.3) * 16 + (i / 90) * 12);
      const pdi = Math.round(22 + Math.sin(i * 0.35) * 6 + (isWknd ? 4 : 0));
      const priceChange = Math.round(Math.sin(i * 0.4) * 12 + (isWknd ? 5 : -2));
      const supplyChange = Math.round(Math.sin(i * 0.5) * 4 + (isWknd ? -2 : 1));
      return {
        i, supply, demand, wap, pdi, priceChange, supplyChange,
        label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        shortLabel: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" }),
        xLabel: i % 14 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
      };
    });
  }, []);

  // 7d moving averages
  const chartData = useMemo(() => data.map((day, i, arr) => {
    const win = arr.slice(Math.max(0, i - 6), i + 1);
    return {
      ...day,
      supplyMa: Math.round(win.reduce((s, d) => s + d.supply, 0) / win.length),
      wapMa: Math.round(win.reduce((s, d) => s + d.wap, 0) / win.length),
    };
  }), [data]);

  const avgSupply = Math.round(data.reduce((s, d) => s + d.supply, 0) / data.length);
  const avgWap = Math.round(data.reduce((s, d) => s + d.wap, 0) / data.length);
  const avgDemand = Math.round(data.reduce((s, d) => s + d.demand, 0) / data.length);

  return (
    <div style={{ background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
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
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Calendar size={22} color={R.teal} />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: R.accent, margin: 0, letterSpacing: -0.5 }}>Demand & Pace</h1>
            </div>
            <p style={{ fontSize: 13, color: R.textMid, margin: "0 0 12px" }}>90-day forward market planning and channel management</p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 999, padding: "6px 14px" }}>
              <MapPin size={14} color={R.teal} />
              <span style={{ fontSize: 13, color: R.accent }}>London Market</span>
              <span style={{ color: R.textDim, fontSize: 12 }}>•</span>
              <Database size={12} color={R.textDim} />
              <span style={{ fontSize: 11, color: R.textDim }}>Live Channel Data</span>
            </div>
          </div>

          {/* Outlook Banner */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 8, background: "rgba(56,198,186,0.06)", border: `1px solid rgba(56,198,186,0.2)`, marginTop: 20, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(56,198,186,0.3)" }}>
              <TrendingUp size={20} color={R.green} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#86efac" }}>Market outlook: Demand strengthening into summer</div>
              <div style={{ fontSize: 12, color: R.textMid, marginTop: 3 }}>Forward availability tightening across 2-4★ segment — pricing power building</div>
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              {[
                { label: "Avg Supply", value: avgSupply.toLocaleString(), color: R.teal },
                { label: "Avg WAP", value: `${curr}${avgWap}`, color: R.accent },
                { label: "Avg Demand", value: `${avgDemand}%`, color: R.amber },
              ].map(k => (
                <div key={k.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: R.textDim, marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 90-Day Market Analytics ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: R.accent }}>90-Day Market Analytics</div>
                <div style={{ fontSize: 12, color: R.textMid, marginTop: 2 }}>Comprehensive market intelligence with synchronized data visualization</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: R.textMid }}>Pace Period:</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: R.accent }}>
                  7 Days <ChevronDown size={12} color={R.textMid} />
                </div>
              </div>
            </div>
          </div>

          {/* Charts stacked — all connected */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>

            {/* Chart 1: Market Supply Landscape */}
            <div style={{ padding: "20px", borderBottom: `1px solid ${R.sep}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Market Supply Landscape</div>
                  <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Available room inventory across competitive market</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <Leg color={R.teal} label="Supply" />
                  <Leg color={R.teal} label="7d avg" dashed />
                </div>
              </div>
              <div style={{ height: 238 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="compset">
                    <defs>
                      <linearGradient id="cSupplyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={R.teal} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={R.teal} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStroke} />
                    <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                    <YAxis {...axisStyle} width={50} />
                    <Tooltip {...tipStyle} labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l} />
                    <Area type="monotone" dataKey="supply" name="Supply" stroke={R.teal} strokeWidth={2} fill="url(#cSupplyFill)" dot={false} activeDot={{ r: 3, fill: R.teal, stroke: R.card, strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="supplyMa" name="7d avg" stroke={R.teal} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Price Index (WAP) */}
            <div style={{ padding: "20px", borderBottom: `1px solid ${R.sep}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Price Index Analysis</div>
                  <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Weighted Average Price — market pricing trend</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <Leg color={R.amber} label="WAP" />
                  <Leg color={R.amber} label="7d avg" dashed />
                  <Leg color={R.gold} label="PDI" />
                </div>
              </div>
              <div style={{ height: 238 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="compset">
                    <defs>
                      <linearGradient id="cWapFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={R.amber} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={R.amber} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridStroke} vertical={false} />
                    <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                    <YAxis {...axisStyle} width={50} tickFormatter={v => `${curr}${v}`} domain={["dataMin - 15", "dataMax + 15"]} />
                    <Tooltip {...tipStyle} labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l} formatter={(v: number, name: string) => [name === "PDI" ? v : `${curr}${v}`, name]} />
                    <Area type="monotone" dataKey="wap" name="WAP" stroke={R.amber} strokeWidth={2} fill="url(#cWapFill)" dot={false} activeDot={{ r: 3, fill: R.amber, stroke: R.card, strokeWidth: 2 }} />
                    <Line type="monotone" dataKey="wapMa" name="7d avg" stroke={R.amber} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="pdi" name="PDI" stroke={R.gold} strokeWidth={1} dot={false} strokeOpacity={0.4} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Market Price Change */}
            <div style={{ padding: "20px", borderBottom: `1px solid ${R.sep}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Market Price Change</div>
                  <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>WAP movement vs 7 days ago — positive = prices rising</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <Leg color={R.green} label="Up" />
                  <Leg color={R.red} label="Down" />
                </div>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="compset">
                    <CartesianGrid {...gridStroke} vertical={false} />
                    <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                    <YAxis {...axisStyle} width={50} tickFormatter={v => `${curr}${v}`} />
                    <Tooltip {...tipStyle} labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l} formatter={(v: number) => [`${curr}${v}`, "Price Δ"]} />
                    <Bar dataKey="priceChange" name="Price Δ" radius={[2, 2, 0, 0]} maxBarSize={8}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.priceChange >= 0 ? R.green : R.red} fillOpacity={0.6} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Supply Change */}
            <div style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Supply Change</div>
                  <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Room inventory change vs 7 days ago</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <Leg color={R.blue} label="Increase" />
                  <Leg color={R.purple} label="Decrease" />
                </div>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="compset">
                    <CartesianGrid {...gridStroke} vertical={false} />
                    <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                    <YAxis {...axisStyle} width={50} />
                    <Tooltip {...tipStyle} labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l} formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}%`, "Supply Δ"]} />
                    <Bar dataKey="supplyChange" name="Supply Δ" radius={[2, 2, 0, 0]} maxBarSize={8}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.supplyChange >= 0 ? R.blue : R.purple} fillOpacity={0.6} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", color: R.textDim, fontSize: 11, padding: "20px 0 8px" }}>
            Market intelligence powered by live channel data • Updated daily • Last refresh: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
      </div>
    </div>
  );
}
