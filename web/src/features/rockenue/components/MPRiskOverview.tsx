import { useMemo } from "react";
import { AlertTriangle, AlertCircle, Activity, Target, TrendingDown, TrendingUp, Building2, Bell, Search } from "lucide-react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { MPSidebar } from "./MPSidebar";

// ── MP Risk Overview — Rockenue style mockup ──

interface MPRiskOverviewProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", surface: "#121519", recessed: "#0C0E12",
  border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  blue: "#39BDF8", gold: "#C8A66E", green: "#10b981", red: "#ef4444",
  amber: "#f59e0b", purple: "#8b5cf6",
};

const QUADRANTS = {
  "Critical Risk": R.red,
  "Fill Risk": R.amber,
  "Rate Strategy Risk": R.blue,
  "On Pace": R.green,
};

const HOTELS = [
  { name: "The W14 Hotel", occ: 84, target: 78, adrDelta: 12, quadrant: "On Pace", rooms: 42 },
  { name: "Jubilee Victoria", occ: 62, target: 72, adrDelta: -8, quadrant: "Critical Risk", rooms: 38 },
  { name: "The Melita", occ: 78, target: 75, adrDelta: 6, quadrant: "On Pace", rooms: 28 },
  { name: "Elysee Hyde Park", occ: 55, target: 70, adrDelta: 14, quadrant: "Rate Strategy Risk", rooms: 35 },
  { name: "Camden Suites", occ: 68, target: 74, adrDelta: -3, quadrant: "Fill Risk", rooms: 22 },
  { name: "Vilenza Hotel", occ: 72, target: 68, adrDelta: 8, quadrant: "On Pace", rooms: 30 },
  { name: "Whitechapel Hotel", occ: 58, target: 72, adrDelta: -12, quadrant: "Critical Risk", rooms: 44 },
  { name: "Notting Hill House", occ: 81, target: 76, adrDelta: 4, quadrant: "On Pace", rooms: 18 },
  { name: "Lancaster Court", occ: 65, target: 70, adrDelta: 10, quadrant: "Rate Strategy Risk", rooms: 26 },
  { name: "The Portico", occ: 74, target: 72, adrDelta: -1, quadrant: "Fill Risk", rooms: 32 },
];

const occColor = (v: number, target: number) => {
  const diff = v - target;
  if (diff >= 5) return R.green;
  if (diff >= -5) return R.amber;
  return R.red;
};

export function MPRiskOverview({ activeView, onNavigate }: MPRiskOverviewProps) {
  const scatterData = HOTELS.map(h => ({
    x: h.occ, y: h.adrDelta, name: h.name, quadrant: h.quadrant,
    color: QUADRANTS[h.quadrant as keyof typeof QUADRANTS] || R.textDim,
  }));

  const quadrantCounts = Object.entries(QUADRANTS).map(([label, color]) => ({
    label, color, count: HOTELS.filter(h => h.quadrant === label).length,
    hotels: HOTELS.filter(h => h.quadrant === label).map(h => h.name),
  }));

  // 30-day occupancy matrix mock
  const matrixDays = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 3, 14 + i);
    return { dayNum: d.getDate(), dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()], month: d.toLocaleDateString("en-GB", { month: "short" }) };
  }), []);

  const matrixData = useMemo(() => HOTELS.map(h => ({
    ...h,
    days: Array.from({ length: 30 }, (_, i) => {
      const dow = (i + 1) % 7;
      const isWknd = dow >= 5;
      return Math.min(100, Math.max(20, Math.round(h.occ + (isWknd ? 12 : -4) + Math.sin(i * 0.3 + HOTELS.indexOf(h)) * 8)));
    }),
  })), []);

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: "flex" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />
      <div style={{ flex: 1, overflow: "auto" }}>

        {/* Header */}
        <div style={{ padding: "20px 36px", borderBottom: `1px solid ${R.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.8 }}>Risk Overview</h1>
            <p style={{ fontSize: 13, color: R.textDim, margin: "4px 0 0" }}>Portfolio-wide occupancy and pricing risk assessment</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Search size={15} color={R.textDim} style={{ cursor: "pointer" }} />
            <Bell size={15} color={R.textDim} style={{ cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ padding: "24px 36px" }}>

          {/* KPI Strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Portfolio Hotels", value: "10", sub: "Sentinel active", icon: Building2, color: R.blue },
              { label: "Avg Occupancy", value: "69.7%", sub: "Target: 72.7%", icon: Target, color: R.amber },
              { label: "Hotels at Risk", value: "4", sub: "Below target by 5%+", icon: AlertTriangle, color: R.red },
              { label: "On Pace", value: "4", sub: "Meeting or exceeding target", icon: TrendingUp, color: R.green },
            ].map(kpi => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 10, padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Icon size={14} color={kpi.color} />
                    <span style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color, letterSpacing: -1 }}>{kpi.value}</div>
                  <div style={{ fontSize: 11, color: R.textDim, marginTop: 4 }}>{kpi.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Risk Quadrant + Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 28 }}>
            {/* Scatter */}
            <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Risk Matrix</div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, marginBottom: 4 }}>Quadrant Analysis</div>
              <div style={{ fontSize: 12, color: R.textMid, marginBottom: 16 }}>Occupancy vs ADR delta — each dot is one hotel</div>

              <div style={{ position: "relative", height: 340 }}>
                {/* Quadrant background */}
                <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", pointerEvents: "none", zIndex: 0, left: 50, right: 10, top: 10, bottom: 30 }}>
                  <div style={{ background: `${R.blue}08`, borderRight: `1px dashed ${R.border}`, borderBottom: `1px dashed ${R.border}` }} />
                  <div style={{ background: `${R.green}08`, borderBottom: `1px dashed ${R.border}` }} />
                  <div style={{ background: `${R.red}08`, borderRight: `1px dashed ${R.border}` }} />
                  <div style={{ background: `${R.amber}08` }} />
                </div>
                {/* Labels */}
                <div style={{ position: "absolute", zIndex: 5, pointerEvents: "none", left: 60, right: 20, top: 15, bottom: 35 }}>
                  <span style={{ position: "absolute", top: 4, left: 4, fontSize: 9, color: R.blue, opacity: 0.6 }}>Rate Strategy Risk</span>
                  <span style={{ position: "absolute", top: 4, right: 4, fontSize: 9, color: R.green, opacity: 0.6 }}>On Pace</span>
                  <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: 9, color: R.red, opacity: 0.6 }}>Critical Risk</span>
                  <span style={{ position: "absolute", bottom: 4, right: 4, fontSize: 9, color: R.amber, opacity: 0.6 }}>Fill Risk</span>
                </div>
                <div style={{ position: "relative", zIndex: 10, height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.2} />
                      <XAxis type="number" dataKey="x" name="Occupancy" domain={[40, 100]} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} label={{ value: "Occupancy %", position: "insideBottom", offset: -5, fill: R.textDim, fontSize: 10 }} />
                      <YAxis type="number" dataKey="y" name="ADR Delta" domain={[-20, 20]} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={40} tickFormatter={v => `${v > 0 ? "+" : ""}${v}`} label={{ value: "ADR Delta", angle: -90, position: "insideLeft", offset: 15, fill: R.textDim, fontSize: 10 }} />
                      <ZAxis range={[60, 60]} />
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 6, padding: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: R.accent, marginBottom: 4 }}>{d.name}</div>
                            <div style={{ fontSize: 11, color: R.textMid }}>Occ: {d.x}% | ADR: {d.y > 0 ? "+" : ""}{d.y}%</div>
                            <div style={{ fontSize: 10, color: d.color, marginTop: 3 }}>{d.quadrant}</div>
                          </div>
                        );
                      }} />
                      <Scatter data={scatterData}>
                        {scatterData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.8} />)}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quadrant Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {quadrantCounts.map(q => (
                <div key={q.label} style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 10, padding: "16px 18px", borderLeft: `3px solid ${q.color}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: q.color }}>{q.label}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: q.color }}>{q.count}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {q.hotels.map(h => (
                      <span key={h} style={{ fontSize: 11, color: R.textMid }}>{h}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Occupancy Matrix */}
          <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${R.sep}` }}>
              <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Portfolio View</div>
              <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3 }}>30-Day Occupancy Matrix</div>
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: "fit-content" }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, zIndex: 20, background: R.surface, width: 160, minWidth: 160, borderRight: `1px solid ${R.border}`, padding: "8px 16px", textAlign: "left" }}>
                      <span style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>Hotel</span>
                    </th>
                    {matrixDays.map((d, i) => (
                      <th key={i} style={{ width: 36, minWidth: 36, padding: "4px 0", textAlign: "center", borderBottom: `1px solid ${R.sep}` }}>
                        <div style={{ fontSize: 8, color: R.textDim }}>{d.dayName}</div>
                        <div style={{ fontSize: 11, color: R.accent }}>{d.dayNum}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map((hotel, hi) => (
                    <tr key={hotel.name}>
                      <td style={{ position: "sticky", left: 0, zIndex: 10, background: R.surface, borderRight: `1px solid ${R.border}`, borderBottom: `1px solid ${R.sep}`, padding: "8px 16px" }}>
                        <div style={{ fontSize: 12, color: R.accent, fontWeight: 500, whiteSpace: "nowrap" }}>{hotel.name}</div>
                        <div style={{ fontSize: 10, color: R.textDim }}>{hotel.rooms} rooms</div>
                      </td>
                      {hotel.days.map((occ, di) => {
                        const bg = occ >= 85 ? R.green : occ >= 70 ? R.amber : occ >= 50 ? R.blue : R.red;
                        return (
                          <td key={di} style={{ width: 36, minWidth: 36, height: 36, textAlign: "center", borderBottom: `1px solid ${R.sep}`, padding: 0 }}>
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `${bg}15`, fontSize: 10, color: bg, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                              {occ}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
