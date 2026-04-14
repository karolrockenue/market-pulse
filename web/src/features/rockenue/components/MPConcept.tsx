import { useMemo } from "react";
import { TrendingUp, ChevronDown, Bell, Settings, Search } from "lucide-react";

// ── MP Concept: Market Pulse dashboard reimagined in Rockenue brand language ──
// Mock data. Not wired. Design exercise.

const R = {
  bg: "#14181D",
  card: "#1C2228",
  border: "#2A3240",
  accent: "#F3F5F7",
  white: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  teal: "#38C6BA",
  gold: "#C8A66E",
  heroBg: "#111519",
  darkBand: "#121519",
  green: "#34D068",
  red: "#ef4444",
};

export function MPConcept() {
  // ── Mock data ──
  const months = [
    { period: "Last Month", label: "March 2026", revenue: 542800, occ: 81.2, adr: 148, yoy: 11.2, lyRev: 488200, lyOcc: 74.1, lyAdr: 136 },
    { period: "Current Month", label: "April 2026", revenue: 321900, occ: 74.6, adr: 142, yoy: 8.7, lyRev: 296100, lyOcc: 69.3, lyAdr: 131 },
    { period: "Next Month", label: "May 2026", revenue: 184000, occ: 42.3, adr: 155, yoy: 14.1, lyRev: 161200, lyOcc: 38.8, lyAdr: 139 },
  ];

  const demandBars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => {
      const dow = i % 7;
      const v = Math.min(98, Math.max(8, Math.round(42 + (i / 60) * 20 + (dow >= 5 ? 22 : 0) + Math.sin(i * 0.4) * 14)));
      return { i, v, isEvent: [8, 9, 22, 23, 24, 25, 38, 39, 40, 50, 51].includes(i) };
    }), []);

  const occBars = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => {
      const dow = i % 7;
      const occ = Math.min(96, Math.max(30, Math.round(58 + (dow >= 5 ? 18 : 0) + Math.sin(i * 0.4) * 12)));
      const pickup = Math.max(0, Math.min(14, Math.round(4 + Math.sin(i * 0.7) * 4 + (dow >= 5 ? 5 : 0))));
      return { i, occ, base: occ - pickup, pickup };
    }), []);

  const ytdData = useMemo(() =>
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => ({
      month: m, rev: i < 4 ? Math.round(380000 + Math.sin(i * 0.8) * 80000 + i * 20000) : 0, isFuture: i >= 4,
    })), []);

  const recentBookings = [
    { guest: "M. Anderson", room: "Double Deluxe", nights: 3, rate: 162, source: "Booking.com", date: "12 Apr" },
    { guest: "J. Kowalski", room: "Superior Twin", nights: 2, rate: 148, source: "Direct", date: "12 Apr" },
    { guest: "S. Al-Rashid", room: "Junior Suite", nights: 4, rate: 215, source: "Expedia", date: "11 Apr" },
    { guest: "L. Chen", room: "Standard Double", nights: 1, rate: 128, source: "Booking.com", date: "11 Apr" },
    { guest: "R. Fernandez", room: "Double Deluxe", nights: 2, rate: 158, source: "HRS", date: "10 Apr" },
  ];

  const demandColor = (v: number) =>
    v >= 85 ? R.red : v >= 70 ? "#f97316" : v >= 50 ? "#f59e0b" : v >= 30 ? R.teal : "#3b82f6";

  const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div style={{ minHeight: "100vh", background: R.heroBg, color: R.white, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ─── Top Nav ─── */}
      <nav style={{ padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${R.border}`, background: R.darkBand }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: R.teal, fontSize: 20, fontWeight: 200 }}>(</span>
            <span style={{ color: R.accent, fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
            <span style={{ color: R.gold, fontSize: 20, fontWeight: 200 }}>)</span>
          </div>
          <div style={{ width: 1, height: 20, background: R.border }} />
          <div style={{ display: "flex", gap: 20, fontSize: 12, color: R.textMid, fontWeight: 500 }}>
            {["Dashboard", "Reports", "Market Intel", "Sentinel"].map((item, i) => (
              <span key={item} style={{ color: i === 0 ? R.accent : R.textMid, cursor: "pointer", paddingBottom: 2, borderBottom: i === 0 ? `2px solid ${R.teal}` : "2px solid transparent" }}>{item}</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Property selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 12, color: R.accent }}>W14 Hotel</span>
            <ChevronDown size={12} color={R.textDim} />
          </div>
          <div style={{ width: 1, height: 20, background: R.border }} />
          <Search size={15} color={R.textDim} style={{ cursor: "pointer" }} />
          <Bell size={15} color={R.textDim} style={{ cursor: "pointer" }} />
          <Settings size={15} color={R.textDim} style={{ cursor: "pointer" }} />
          <div style={{ width: 28, height: 28, borderRadius: 14, background: R.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: R.darkBand }}>KM</div>
        </div>
      </nav>

      {/* ─── Content ─── */}
      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Market Outlook Banner */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderRadius: 8,
          background: "rgba(52, 208, 104, 0.06)", border: "1px solid rgba(52, 208, 104, 0.2)", marginBottom: 20,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(52,208,104,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={14} color={R.green} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#86efac" }}>The 30-day market demand is strengthening</div>
            <div style={{ fontSize: 10, color: R.textDim }}>Calculated from thousands of live OTA data points daily</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#86efac" }}>+8.4%</div>
        </div>

        {/* 3-Month Performance Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
          {months.map((m, mi) => {
            const up = m.yoy > 0;
            return (
              <div key={m.period} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 16, color: R.accent, textTransform: "uppercase", letterSpacing: -0.3 }}>{m.period}</div>
                    <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase" }}>{m.label}</div>
                  </div>
                  <div style={{
                    padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
                    background: up ? "rgba(52,208,104,0.08)" : "rgba(239,68,68,0.08)",
                    border: `1px solid ${up ? "rgba(52,208,104,0.25)" : "rgba(239,68,68,0.25)"}`,
                    color: up ? R.green : R.red,
                  }}>
                    {up ? "▲" : "▼"} YOY +{m.yoy}%
                  </div>
                </div>
                <div style={{ fontSize: 30, fontWeight: 600, color: R.teal, marginBottom: 2 }}>{fmt(m.revenue)}</div>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", marginBottom: 16 }}>Total Revenue</div>
                {/* Comparison table */}
                <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0, fontSize: 11 }}>
                    <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6 }} />
                    <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>This Year</div>
                    <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>Last Year</div>
                    {[
                      { label: "Revenue", ty: fmt(m.revenue), ly: fmt(m.lyRev) },
                      { label: "Occupancy", ty: `${m.occ}%`, ly: `${m.lyOcc}%` },
                      { label: "ADR", ty: fmt(m.adr), ly: fmt(m.lyAdr) },
                    ].map((row) => (
                      <>
                        <div style={{ color: R.textMid, padding: "4px 0", borderTop: `1px solid ${R.border}` }}>{row.label}</div>
                        <div style={{ color: R.accent, padding: "4px 0", textAlign: "right", borderTop: `1px solid ${R.border}` }}>{row.ty}</div>
                        <div style={{ color: R.textDim, padding: "4px 0", textAlign: "right", borderTop: `1px solid ${R.border}` }}>{row.ly}</div>
                      </>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Two-column: Demand Chart + Occupancy Chart */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {/* Forward Demand */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>90-DAY FORWARD</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Market Demand</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {[0.25, 0.4, 0.55, 0.5, 0.7].map((op, i) => {
                  const c = i === 3 ? "#f59e0b" : i === 4 ? R.red : R.teal;
                  return <div key={i} style={{ width: 6, height: 6, borderRadius: 1.5, background: c, opacity: op }} />;
                })}
              </div>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 140 }}>
                {demandBars.map((b) => (
                  <div key={b.i} style={{ flex: 1, position: "relative" }}>
                    {b.isEvent && <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, background: `${R.teal}08` }} />}
                    <div style={{ position: "relative", width: "100%", height: `${b.v * 1.2}%`, background: demandColor(b.v), borderRadius: "1px 1px 0 0", opacity: 0.8, minHeight: 2 }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
                {["Chelsea Flower Show", "Wimbledon", "BST Hyde Park"].map((e) => (
                  <span key={e} style={{ fontSize: 7, color: R.gold, padding: "1px 5px", background: `${R.gold}10`, borderRadius: 2 }}>{e}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Occupancy + Pickup */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>90-DAY FORWARD</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Occupancy & Pickup</div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 9 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 6, background: R.textDim, opacity: 0.5, borderRadius: 1 }} /><span style={{ color: R.textDim }}>Base</span></span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 6, background: R.teal, borderRadius: 1 }} /><span style={{ color: R.textDim }}>Pickup</span></span>
              </div>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 140 }}>
                {occBars.map((b) => (
                  <div key={b.i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", height: `${b.occ * 1.3}%` }}>
                    <div style={{ flex: b.pickup, background: R.teal, borderRadius: "1px 1px 0 0", opacity: 0.9, minHeight: b.pickup > 0 ? 1 : 0 }} />
                    <div style={{ flex: b.base, background: R.textDim, opacity: 0.4, minHeight: 1 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Two-column: YTD Trend + Recent Bookings */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 20 }}>
          {/* YTD Revenue Trend */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}` }}>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>YEAR TO DATE</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Monthly Revenue</div>
            </div>
            <div style={{ padding: "20px 20px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}>
                {ytdData.map((m) => (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: "100%", maxWidth: 32,
                      height: m.isFuture ? 0 : `${(m.rev / 500000) * 100}%`,
                      background: m.isFuture ? "transparent" : R.teal,
                      borderRadius: "3px 3px 0 0", opacity: 0.7,
                      minHeight: m.isFuture ? 0 : 4,
                    }} />
                    <div style={{ fontSize: 9, color: R.textDim, marginTop: 6 }}>{m.month}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Bookings */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>ACTIVITY</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Recent Bookings</div>
              </div>
              <span style={{ fontSize: 11, color: R.teal, cursor: "pointer" }}>View all</span>
            </div>
            <div>
              {recentBookings.map((b, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, padding: "10px 20px", borderBottom: i < recentBookings.length - 1 ? `1px solid ${R.border}` : "none", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: R.accent, fontWeight: 500 }}>{b.guest}</div>
                    <div style={{ fontSize: 10, color: R.textDim }}>{b.room} · {b.nights}n</div>
                  </div>
                  <div style={{ fontSize: 12, color: R.accent, fontWeight: 500 }}>{fmt(b.rate)}</div>
                  <div style={{ fontSize: 10, color: R.textMid, padding: "2px 8px", background: R.heroBg, borderRadius: 4 }}>{b.source}</div>
                  <div style={{ fontSize: 10, color: R.textDim }}>{b.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Demand Patterns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(52,208,104,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={13} color={R.green} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: R.accent }}>Busiest Days</div>
                <div style={{ fontSize: 10, color: R.textDim }}>Highest demand in the next 90 days</div>
              </div>
            </div>
            {[
              { date: "Sat 14 Jun", demand: 94, event: "Wimbledon W1" },
              { date: "Sat 21 Jun", demand: 91, event: "Wimbledon Final" },
              { date: "Sat 5 Jul", demand: 88, event: "BST Hyde Park" },
              { date: "Fri 13 Jun", demand: 86, event: null },
              { date: "Sat 26 Jul", demand: 84, event: "Notting Hill Carnival" },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 4 ? `1px solid ${R.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: R.accent }}>{d.date}</span>
                  {d.event && <span style={{ fontSize: 9, color: R.gold, padding: "1px 6px", background: `${R.gold}10`, borderRadius: 3 }}>{d.event}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 48, height: 4, background: "#1a1f28", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${d.demand}%`, height: "100%", background: demandColor(d.demand), borderRadius: 2, opacity: 0.7 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: demandColor(d.demand), width: 28, textAlign: "right" }}>{d.demand}%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(56,198,186,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={13} color={R.teal} style={{ transform: "rotate(180deg)" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: R.accent }}>Quietest Days</div>
                <div style={{ fontSize: 10, color: R.textDim }}>Lowest demand — opportunity to push rates or campaigns</div>
              </div>
            </div>
            {[
              { date: "Tue 22 Apr", demand: 18, event: null },
              { date: "Mon 28 Apr", demand: 21, event: null },
              { date: "Wed 7 May", demand: 24, event: null },
              { date: "Tue 13 May", demand: 26, event: null },
              { date: "Mon 2 Jun", demand: 28, event: null },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 4 ? `1px solid ${R.border}` : "none" }}>
                <span style={{ fontSize: 12, color: R.accent }}>{d.date}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 48, height: 4, background: "#1a1f28", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${d.demand}%`, height: "100%", background: "#3b82f6", borderRadius: 2, opacity: 0.5 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", width: 28, textAlign: "right" }}>{d.demand}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default MPConcept;
