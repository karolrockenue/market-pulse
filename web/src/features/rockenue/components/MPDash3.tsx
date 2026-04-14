import { useMemo, useState } from "react";
import { TrendingUp, ChevronDown, Bell, Search } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MPSidebar } from "./MPSidebar";

// ── MP Dashboard v3: Layered depth — full element set from Market Pulse ──

interface MPDash3Props { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#39BDF8", gold: "#C8A66E",
  heroBg: "#111519", darkBand: "#121519", sidebar: "#0F1215", green: "#34D068", red: "#ef4444",
  cardLight: "#1E2530",
};
const curr = "£";
const fmt = (v: number) => `${curr}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const demandColor = (v: number) => v >= 85 ? R.red : v >= 70 ? "#f97316" : v >= 50 ? "#f59e0b" : v >= 30 ? R.teal : "#3b82f6";

export function MPDash3({ activeView, onNavigate }: MPDash3Props) {
  const months = [
    { period: "Last Month", label: "March 2026", revenue: 542800, occ: 81.2, adr: 148, revpar: 120, yoy: 11.2, lyRev: 488200, lyOcc: 74.1, lyAdr: 136 },
    { period: "Current Month", label: "April 2026", revenue: 321900, occ: 74.6, adr: 142, revpar: 106, yoy: 8.7, lyRev: 296100, lyOcc: 69.3, lyAdr: 131 },
    { period: "Next Month", label: "May 2026", revenue: 184000, occ: 42.3, adr: 155, revpar: 66, yoy: 14.1, lyRev: 161200, lyOcc: 38.8, lyAdr: 139 },
  ];

  const demandChartData = useMemo(() => {
    const events: Record<number, string> = { 14: "Chelsea Flower Show", 15: "Chelsea Flower Show", 38: "Wimbledon", 39: "Wimbledon", 40: "Wimbledon", 55: "BST Hyde Park", 56: "BST Hyde Park", 72: "Notting Hill Carnival", 73: "Notting Hill Carnival" };
    const raw = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(2026, 3, 14 + i);
      const dow = d.getDay();
      const isWknd = dow === 5 || dow === 6;
      const isEvent = events[i] != null;
      const demand = Math.min(97, Math.max(15, Math.round(46 + (isWknd ? 20 : 0) + (isEvent ? 16 : 0) + Math.sin(i * 0.15) * 8 + (i / 90) * 10)));
      return {
        i, demand, event: events[i] || null,
        shortLabel: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
        xLabel: i % 13 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
        demandMa: 0,
      };
    });
    return raw.map((day, i, arr) => {
      const win = arr.slice(Math.max(0, i - 6), i + 1);
      return { ...day, demandMa: Math.round(win.reduce((s, d) => s + d.demand, 0) / win.length) };
    });
  }, []);

  const [pickupPeriod, setPickupPeriod] = useState<"24h" | "3d" | "7d">("24h");

  const occData = useMemo(() => Array.from({ length: 90 }, (_, i) => {
    const d = new Date(2026, 3, 14 + i);
    const dow = d.getDay();
    const isWknd = dow === 5 || dow === 6;
    const seasonal = (i / 90) * 10;
    const occ = Math.min(96, Math.max(35, Math.round(60 + (isWknd ? 18 : 0) + Math.sin(i * 0.15) * 6 + seasonal)));
    const p24 = Math.max(1, Math.round(3 + (isWknd ? 4 : 0) + Math.sin(i * 0.2) * 2));
    const p3d = Math.max(2, Math.round(7 + (isWknd ? 5 : 0) + Math.sin(i * 0.18) * 3));
    const p7d = Math.max(3, Math.round(12 + (isWknd ? 7 : 0) + Math.sin(i * 0.15) * 4));
    return {
      date: i % 13 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
      fullDate: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      occupancy: occ,
      pickup24h: p24, pickup3d: p3d, pickup7d: p7d,
      baseOccupancy24h: occ - p24, baseOccupancy3d: occ - p3d, baseOccupancy7d: occ - p7d,
    };
  }), []);

  const ytdData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => ({
    month: m,
    thisYear: i < 4 ? Math.round(380000 + Math.sin(i * 0.8) * 80000 + i * 20000) : 0,
    lastYear: Math.round(340000 + Math.sin(i * 0.6) * 60000 + i * 15000),
    isFuture: i >= 4,
  }));

  const bookings = [
    { guest: "M. Anderson", room: "Double Deluxe", nights: 3, rate: 162, source: "Booking.com", date: "12 Apr", status: "confirmed" },
    { guest: "J. Kowalski", room: "Superior Twin", nights: 2, rate: 148, source: "Direct", date: "12 Apr", status: "confirmed" },
    { guest: "S. Al-Rashid", room: "Junior Suite", nights: 4, rate: 215, source: "Expedia", date: "11 Apr", status: "confirmed" },
    { guest: "L. Chen", room: "Standard Double", nights: 1, rate: 128, source: "Booking.com", date: "11 Apr", status: "confirmed" },
    { guest: "R. Fernandez", room: "Double Deluxe", nights: 2, rate: 158, source: "HRS", date: "10 Apr", status: "confirmed" },
    { guest: "T. Müller", room: "Standard Double", nights: 1, rate: 135, source: "Booking.com", date: "10 Apr", status: "cancelled" },
  ];

  const busiestDays = [
    { date: "Sat 14 Jun", demand: 94, event: "Wimbledon W1" },
    { date: "Sat 21 Jun", demand: 91, event: "Wimbledon Final" },
    { date: "Sat 5 Jul", demand: 88, event: "BST Hyde Park" },
    { date: "Fri 13 Jun", demand: 86, event: null },
    { date: "Sat 26 Jul", demand: 84, event: "Notting Hill Carnival" },
  ];

  const quietestDays = [
    { date: "Tue 22 Apr", demand: 18 },
    { date: "Mon 28 Apr", demand: 21 },
    { date: "Wed 7 May", demand: 24 },
    { date: "Tue 13 May", demand: 26 },
    { date: "Mon 2 Jun", demand: 28 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", display: "flex" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Dashboard</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, cursor: "pointer" }}>
              <span style={{ fontSize: 12 }}>W14 Hotel</span><ChevronDown size={12} color={R.textDim} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: R.green, boxShadow: `0 0 6px ${R.green}50` }} />
            <Search size={15} color={R.textDim} /><Bell size={15} color={R.textDim} />
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* 3 Month Performance Cards — transparent/ghost with border */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            {months.map((m) => {
              const up = m.yoy > 0;
              return (
                <div key={m.period} style={{ border: `1px solid ${R.border}`, borderRadius: 10, padding: "18px 20px", background: R.darkBand }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: -0.3 }}>{m.period}</div>
                      <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase" }}>{m.label}</div>
                    </div>
                    <div style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 3, background: up ? "rgba(52,208,104,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${up ? "rgba(52,208,104,0.25)" : "rgba(239,68,68,0.25)"}`, color: up ? R.green : R.red }}>
                      {up ? "▲" : "▼"} YOY +{m.yoy}%
                    </div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 600, color: R.teal, marginBottom: 2 }}>{fmt(m.revenue)}</div>
                  <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", marginBottom: 14 }}>Total Revenue</div>
                  {/* Comparison table */}
                  <div style={{ borderTop: `1px solid ${R.sep}`, paddingTop: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0, fontSize: 11 }}>
                      <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6 }} />
                      <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>This Year</div>
                      <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>Last Year</div>
                      {[
                        { label: "Revenue", ty: fmt(m.revenue), ly: fmt(m.lyRev) },
                        { label: "Occupancy", ty: `${m.occ}%`, ly: `${m.lyOcc}%` },
                        { label: "ADR", ty: fmt(m.adr), ly: fmt(m.lyAdr) },
                      ].map((row, ri) => (
                        <div key={row.label} style={{ display: "contents" }}>
                          <div style={{ color: R.textMid, padding: "5px 0", borderTop: ri === 0 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>{row.label}</div>
                          <div style={{ color: R.accent, padding: "5px 0", textAlign: "right", borderTop: ri === 0 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>{row.ty}</div>
                          <div style={{ color: R.textDim, padding: "5px 0", textAlign: "right", borderTop: ri === 0 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>{row.ly}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Occupancy Chart (2/3) + Recent Bookings (1/3) — lighter card */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 24 }}>
            {/* Occupancy & Pickup */}
            <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>90 Day Occupancy & Pickup</div>
                  <div style={{ fontSize: 10, color: R.textDim }}>Occupancy trend with booking velocity overlay</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ display: "flex", gap: 12, fontSize: 9 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: R.textDim, opacity: 0.5, borderRadius: 2 }} /><span style={{ color: R.textDim }}>Base Occupancy %</span></span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: R.teal, borderRadius: 2 }} /><span style={{ color: R.textDim }}>{pickupPeriod === "24h" ? "24h" : pickupPeriod === "3d" ? "3 Day" : "7 Day"} Pickup %</span></span>
                  </div>
                  <div style={{ display: "flex", gap: 2, background: R.heroBg, padding: 3, borderRadius: 6, border: `1px solid ${R.border}` }}>
                    {(["24h", "3d", "7d"] as const).map(p => (
                      <button key={p} onClick={() => setPickupPeriod(p)} style={{
                        padding: "4px 10px", fontSize: 10, borderRadius: 4, border: "none", cursor: "pointer",
                        background: pickupPeriod === p ? R.teal : "transparent",
                        color: pickupPeriod === p ? R.darkBand : R.textDim,
                        fontWeight: pickupPeriod === p ? 600 : 400,
                        textTransform: "uppercase", letterSpacing: -0.3,
                      }}>
                        {p === "24h" ? "24h" : p === "3d" ? "3 Days" : "7 Days"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ padding: "20px 20px 16px", height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={occData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.25} vertical={false} />
                    <XAxis dataKey="date" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} interval={0} />
                    <YAxis stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={30} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      const pv = pickupPeriod === "24h" ? d.pickup24h : pickupPeriod === "3d" ? d.pickup3d : d.pickup7d;
                      const pl = pickupPeriod === "24h" ? "24h Pickup" : pickupPeriod === "3d" ? "3d Pickup" : "7d Pickup";
                      return (
                        <div style={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)" }}>
                          <div style={{ color: R.accent, fontSize: 11, marginBottom: 8, fontWeight: 500 }}>{d.fullDate}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: R.textDim }} />
                              <span style={{ color: R.textMid, fontSize: 10 }}>Occupancy:</span>
                              <span style={{ color: R.accent, fontSize: 11, fontWeight: 500 }}>{d.occupancy}%</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: R.teal }} />
                              <span style={{ color: R.textMid, fontSize: 10 }}>{pl}:</span>
                              <span style={{ color: R.teal, fontSize: 11, fontWeight: 500 }}>{pv}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }} />
                    <Bar dataKey={pickupPeriod === "24h" ? "baseOccupancy24h" : pickupPeriod === "3d" ? "baseOccupancy3d" : "baseOccupancy7d"} stackId="occ" name="Base Occupancy" radius={[0, 0, 0, 0]} maxBarSize={10} fill={R.textDim} fillOpacity={0.5} />
                    <Bar dataKey={pickupPeriod === "24h" ? "pickup24h" : pickupPeriod === "3d" ? "pickup3d" : "pickup7d"} stackId="occ" name="Pickup" radius={[2, 2, 0, 0]} maxBarSize={10} fill={R.teal} fillOpacity={0.85} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Bookings */}
            <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 6, background: "rgba(57,189,248,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={R.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: -0.3 }}>Recent Bookings</div>
                  <div style={{ fontSize: 10, color: R.textDim }}>Last 7 days activity</div>
                </div>
              </div>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 55px 65px 55px 70px", gap: 8, padding: "7px 18px", background: R.heroBg }}>
                {["Date", "Bookings", "Rm Nights", "ADR", "Revenue"].map((h, i) => (
                  <div key={h} style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: -0.2, textAlign: i === 0 ? "left" : "right" }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {[
                  { date: "Sun 13 Apr", bookings: 8, nights: 14, adr: 156, revenue: 2184, isToday: true },
                  { date: "Sat 12 Apr", bookings: 11, nights: 19, adr: 168, revenue: 3192, isToday: false },
                  { date: "Fri 11 Apr", bookings: 6, nights: 10, adr: 142, revenue: 1420, isToday: false },
                  { date: "Thu 10 Apr", bookings: 5, nights: 8, adr: 138, revenue: 1104, isToday: false },
                  { date: "Wed 9 Apr", bookings: 7, nights: 12, adr: 145, revenue: 1740, isToday: false },
                  { date: "Tue 8 Apr", bookings: 4, nights: 7, adr: 134, revenue: 938, isToday: false },
                  { date: "Mon 7 Apr", bookings: 3, nights: 5, adr: 128, revenue: 640, isToday: false },
                ].map((day, i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1fr 55px 65px 55px 70px", gap: 8,
                    padding: "9px 18px", borderRadius: 4, margin: "2px 6px",
                    background: day.isToday ? "rgba(57,189,248,0.03)" : "transparent",
                    border: day.isToday ? `1px solid ${R.border}` : "1px solid transparent",
                  }}>
                    <div style={{ fontSize: 11, color: day.isToday ? R.teal : R.accent }}>{day.date}</div>
                    <div style={{ fontSize: 11, color: R.accent, textAlign: "right" }}>{day.bookings}</div>
                    <div style={{ fontSize: 11, color: R.accent, textAlign: "right" }}>{day.nights}</div>
                    <div style={{ fontSize: 11, color: R.accent, textAlign: "right" }}>{fmt(day.adr)}</div>
                    <div style={{ fontSize: 11, color: R.teal, textAlign: "right", fontWeight: 500 }}>{fmt(day.revenue)}</div>
                  </div>
                ))}
              </div>
              {/* View Full Report */}
              <div style={{ padding: "10px 18px", borderTop: `1px solid ${R.sep}`, textAlign: "center", cursor: "pointer" }}>
                <span style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: -0.2 }}>View Full Report</span>
              </div>
            </div>
          </div>

          {/* Market Outlook Banner + Demand Chart */}
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
            {/* Outlook Banner */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: `1px solid rgba(52,208,104,0.08)`, background: "rgba(52,208,104,0.03)" }}>
              <TrendingUp size={16} color={R.green} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#86efac" }}>The 30-day market demand is strengthening</div>
                <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>Forward-looking 90-day outlook</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#86efac", lineHeight: 1 }}>+8.4%</div>
                <div style={{ fontSize: 10, color: R.textDim, marginTop: 3 }}>vs 30 days ago</div>
              </div>
            </div>
            {/* Chart Header */}
            <div style={{ padding: "14px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>How Busy Is the Market?</div>
                <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>Market demand score — higher means busier, stronger pricing power</div>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 12, height: 2, background: R.teal, borderRadius: 1 }} />
                  <span style={{ color: R.textDim }}>Demand</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 12, height: 0, borderBottom: `2px dashed ${R.teal}` }} />
                  <span style={{ color: R.textDim }}>7d trend</span>
                </div>
                <div style={{ width: 1, height: 12, background: R.border }} />
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  {[
                    { color: R.teal, opacity: 0.25 },
                    { color: R.teal, opacity: 0.45 },
                    { color: R.teal, opacity: 0.6 },
                    { color: "#f59e0b", opacity: 0.55 },
                    { color: R.red, opacity: 0.75 },
                  ].map((s, i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, opacity: s.opacity }} />
                  ))}
                  <span style={{ fontSize: 9, color: R.textDim, marginLeft: 3 }}>quiet → busy</span>
                </div>
              </div>
            </div>
            {/* Event labels + chart */}
            <div style={{ padding: "8px 20px 12px" }}>
              <div style={{ position: "relative" }}>
                {/* Rotated event labels */}
                <div style={{ height: 80, position: "relative", overflow: "hidden" }}>
                  {(() => {
                    const seen = new Set<string>();
                    return demandChartData.filter(d => {
                      if (!d.event || seen.has(d.event)) return false;
                      seen.add(d.event);
                      return true;
                    }).map(d => (
                      <div key={`${d.event}-${d.i}`} style={{
                        position: "absolute", left: `calc(30px + ${(d.i / 90) * 100}% * (1 - 40px / 100%))`, bottom: 0,
                        transform: "rotate(-40deg)", transformOrigin: "bottom left",
                        fontSize: 9, fontWeight: 500, color: R.teal, opacity: 0.7, whiteSpace: "nowrap",
                      }}>
                        {d.event}
                      </div>
                    ));
                  })()}
                </div>
                {/* Event background columns behind chart */}
                <div style={{ position: "absolute", top: 80, left: 30, right: 10, bottom: 20, display: "flex", pointerEvents: "none", zIndex: 0 }}>
                  {demandChartData.map(d => (
                    <div key={d.i} style={{ flex: 1, backgroundColor: d.event ? R.teal : "transparent", opacity: d.event ? 0.07 : 0 }} />
                  ))}
                </div>
                {/* Chart */}
                <div style={{ position: "relative", zIndex: 1, height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={demandChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.2} vertical={false} />
                  <XAxis dataKey="xLabel" stroke={R.border} tick={({ x, y, payload }: any) => payload?.value ? <text x={x} y={y + 12} textAnchor="middle" fill={R.textDim} fontSize={9}>{payload.value}</text> : null} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} interval={0} height={20} />
                  <YAxis stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={30} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)" }}>
                        <div style={{ color: R.accent, fontSize: 11, marginBottom: 6, fontWeight: 500 }}>{d.shortLabel}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: demandColor(d.demand) }} />
                          <span style={{ color: R.textMid, fontSize: 10 }}>Demand:</span>
                          <span style={{ color: R.accent, fontSize: 11, fontWeight: 500 }}>{d.demand}%</span>
                        </div>
                        {d.event && <div style={{ fontSize: 10, color: R.teal, marginTop: 4 }}>{d.event}</div>}
                      </div>
                    );
                  }} />
                  <Bar dataKey="demand" name="Demand" radius={[2, 2, 0, 0]} maxBarSize={10}>
                    {demandChartData.map((d, i) => {
                      if (d.demand >= 85) return <Cell key={i} fill={R.red} fillOpacity={0.75} />;
                      if (d.demand >= 70) return <Cell key={i} fill="#f59e0b" fillOpacity={0.55} />;
                      return <Cell key={i} fill={R.teal} fillOpacity={0.25 + (d.demand / 100) * 0.45} />;
                    })}
                  </Bar>
                  <Line type="monotone" dataKey="demandMa" name="7d trend" stroke={R.teal} strokeWidth={2} strokeDasharray="6 3" dot={false} strokeOpacity={0.7} />
                </ComposedChart>
              </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Demand Patterns — ghost cards side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={{ border: `1px solid ${R.border}`, borderRadius: 10, padding: "18px 20px", background: R.darkBand }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: "rgba(52,208,104,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={11} color={R.green} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Busiest Days</div>
                  <div style={{ fontSize: 10, color: R.textDim }}>Highest demand in the next 90 days</div>
                </div>
              </div>
              {busiestDays.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < busiestDays.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{d.date}</span>
                    {d.event && <span style={{ fontSize: 8, color: R.gold, padding: "1px 5px", background: `${R.gold}10`, borderRadius: 3 }}>{d.event}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 40, height: 3, background: R.darkBand, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${d.demand}%`, height: "100%", background: demandColor(d.demand), borderRadius: 2, opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: demandColor(d.demand), width: 28, textAlign: "right" }}>{d.demand}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${R.border}`, borderRadius: 10, padding: "18px 20px", background: R.darkBand }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: `${R.teal}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={11} color={R.teal} style={{ transform: "rotate(180deg)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Quietest Days</div>
                  <div style={{ fontSize: 10, color: R.textDim }}>Opportunity to push rates or campaigns</div>
                </div>
              </div>
              {quietestDays.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: i < quietestDays.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                  <span style={{ fontSize: 12 }}>{d.date}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 40, height: 3, background: R.darkBand, borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${d.demand}%`, height: "100%", background: "#3b82f6", borderRadius: 2, opacity: 0.5 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", width: 28, textAlign: "right" }}>{d.demand}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* YTD Performance Table */}
          {(() => {
            const GRID = "minmax(60px,1fr) repeat(3,minmax(50px,1fr)) repeat(3,minmax(50px,1fr)) minmax(55px,1fr) minmax(65px,1fr)";
            const ytdRows = [
              { month: "Jan", lyOcc: 68.2, lyAdr: 128, lyRev: 312000, tyOcc: 74.1, tyAdr: 138, tyRev: 358000 },
              { month: "Feb", lyOcc: 71.5, lyAdr: 132, lyRev: 328000, tyOcc: 78.3, tyAdr: 144, tyRev: 384000 },
              { month: "Mar", lyOcc: 74.1, lyAdr: 136, lyRev: 488200, tyOcc: 81.2, tyAdr: 148, tyRev: 542800 },
              { month: "Apr", isMTD: true, lyOcc: 69.3, lyAdr: 131, lyRev: 296100, tyOcc: 74.6, tyAdr: 142, tyRev: 321900 },
            ];
            const totalLyRev = ytdRows.reduce((s, r) => s + r.lyRev, 0);
            const totalTyRev = ytdRows.reduce((s, r) => s + r.tyRev, 0);
            const totalDelta = totalTyRev - totalLyRev;
            const totalDeltaPct = totalLyRev ? ((totalDelta / totalLyRev) * 100) : 0;
            const hdr: React.CSSProperties = { fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: -0.2, textAlign: "center" };
            const cell: React.CSSProperties = { fontSize: 12, textAlign: "center", fontVariantNumeric: "tabular-nums" };

            return (
              <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>Annual Performance</div>
                    <div style={{ fontSize: 10, color: R.textDim }}>ADR, Occupancy & Revenue comparison</div>
                  </div>
                </div>
                {/* Year headers */}
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "8px 20px", background: R.heroBg, borderBottom: `1px solid ${R.sep}` }}>
                  <div />
                  <div style={{ gridColumn: "span 3", ...hdr, color: R.teal }}>2025</div>
                  <div style={{ gridColumn: "span 3", ...hdr, color: R.teal, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>2026</div>
                  <div style={{ gridColumn: "span 2", ...hdr, color: R.teal, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>Delta</div>
                </div>
                {/* Metric headers */}
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "10px 20px", background: R.heroBg, borderBottom: `1px solid ${R.sep}` }}>
                  <div style={{ ...hdr, textAlign: "left" }}>Month</div>
                  <div style={hdr}>Occ</div>
                  <div style={hdr}>ADR</div>
                  <div style={hdr}>Rev</div>
                  <div style={{ ...hdr, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>Occ</div>
                  <div style={hdr}>ADR</div>
                  <div style={hdr}>Rev</div>
                  <div style={{ ...hdr, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>Rev %</div>
                  <div style={hdr}>Rev {curr}</div>
                </div>
                {/* Rows */}
                {ytdRows.map((r, i) => {
                  const diff = r.tyRev - r.lyRev;
                  const pct = r.lyRev ? ((diff / r.lyRev) * 100) : 0;
                  const dc = diff >= 0 ? R.green : R.red;
                  return (
                    <div key={r.month} style={{
                      display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "12px 20px",
                      borderTop: i > 0 ? `1px solid ${R.sep}` : "none",
                      background: r.isMTD ? `${R.teal}08` : "transparent",
                      borderLeft: r.isMTD ? `2px solid ${R.teal}` : "2px solid transparent",
                    }}>
                      <div style={{ fontSize: 12, color: R.accent, display: "flex", alignItems: "center", gap: 8 }}>
                        {r.month}
                        {r.isMTD && <span style={{ fontSize: 9, color: R.teal, padding: "1px 6px", background: `${R.teal}15`, borderRadius: 3 }}>MTD</span>}
                      </div>
                      <div style={{ ...cell, color: R.textMid }}>{r.lyOcc.toFixed(1)}%</div>
                      <div style={{ ...cell, color: R.textMid }}>{fmt(r.lyAdr)}</div>
                      <div style={{ ...cell, color: R.textMid }}>{fmt(r.lyRev)}</div>
                      <div style={{ ...cell, color: R.accent, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>{r.tyOcc.toFixed(1)}%</div>
                      <div style={{ ...cell, color: R.accent }}>{fmt(r.tyAdr)}</div>
                      <div style={{ ...cell, color: R.accent }}>{fmt(r.tyRev)}</div>
                      <div style={{ ...cell, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: `${dc}20`, color: dc }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ ...cell }}>
                        <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: `${dc}20`, color: dc }}>{diff >= 0 ? "+" : ""}{fmt(diff)}</span>
                      </div>
                    </div>
                  );
                })}
                {/* Totals */}
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "12px 20px", background: R.heroBg, borderTop: `2px solid ${R.teal}30` }}>
                  <div style={{ fontSize: 12, color: R.teal }}>YTD Total</div>
                  <div style={{ ...cell, color: R.accent }}>{(ytdRows.reduce((s, r) => s + r.lyOcc, 0) / ytdRows.length).toFixed(1)}%</div>
                  <div style={{ ...cell, color: R.accent }}>{fmt(Math.round(ytdRows.reduce((s, r) => s + r.lyAdr, 0) / ytdRows.length))}</div>
                  <div style={{ ...cell, color: R.accent }}>{fmt(totalLyRev)}</div>
                  <div style={{ ...cell, color: R.accent, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>{(ytdRows.reduce((s, r) => s + r.tyOcc, 0) / ytdRows.length).toFixed(1)}%</div>
                  <div style={{ ...cell, color: R.accent }}>{fmt(Math.round(ytdRows.reduce((s, r) => s + r.tyAdr, 0) / ytdRows.length))}</div>
                  <div style={{ ...cell, color: R.accent }}>{fmt(totalTyRev)}</div>
                  <div style={{ ...cell, borderLeft: `1px solid ${R.teal}20`, paddingLeft: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: `${totalDelta >= 0 ? R.green : R.red}20`, color: totalDelta >= 0 ? R.green : R.red }}>{totalDeltaPct >= 0 ? "+" : ""}{totalDeltaPct.toFixed(1)}%</span>
                  </div>
                  <div style={{ ...cell }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: `${totalDelta >= 0 ? R.green : R.red}20`, color: totalDelta >= 0 ? R.green : R.red }}>{totalDelta >= 0 ? "+" : ""}{fmt(totalDelta)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
