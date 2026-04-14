import { useMemo } from "react";
import { TrendingUp, ChevronDown, Bell, Settings, Search, ArrowRight } from "lucide-react";

// ── MP Concept 2: Sidebar nav, wide content area ──

const R = {
  bg: "#14181D", card: "#1C2228", border: "#2A3240", accent: "#F3F5F7", white: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  heroBg: "#111519", darkBand: "#121519", green: "#34D068", red: "#ef4444",
};

const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const demandColor = (v: number) => v >= 85 ? R.red : v >= 70 ? "#f97316" : v >= 50 ? "#f59e0b" : v >= 30 ? R.teal : "#3b82f6";

export function MPConcept2() {
  const months = [
    { period: "Last Month", label: "Mar 2026", revenue: 542800, occ: 81.2, adr: 148, yoy: 11.2 },
    { period: "Current", label: "Apr 2026", revenue: 321900, occ: 74.6, adr: 142, yoy: 8.7 },
    { period: "Next Month", label: "May 2026", revenue: 184000, occ: 42.3, adr: 155, yoy: 14.1 },
  ];

  const demandBars = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const dow = i % 7;
    const v = Math.min(98, Math.max(8, Math.round(42 + (i / 60) * 20 + (dow >= 5 ? 22 : 0) + Math.sin(i * 0.4) * 14)));
    return { i, v, isEvent: [8, 9, 22, 23, 24, 25, 38, 39, 40, 50, 51].includes(i) };
  }), []);

  const occBars = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const dow = i % 7;
    const occ = Math.min(96, Math.max(30, Math.round(58 + (dow >= 5 ? 18 : 0) + Math.sin(i * 0.4) * 12)));
    const pickup = Math.max(0, Math.min(14, Math.round(4 + Math.sin(i * 0.7) * 4 + (dow >= 5 ? 5 : 0))));
    return { i, occ, base: occ - pickup, pickup };
  }), []);

  const bookings = [
    { guest: "M. Anderson", room: "Double Deluxe", nights: 3, rate: 162, source: "Booking.com", date: "12 Apr" },
    { guest: "J. Kowalski", room: "Superior Twin", nights: 2, rate: 148, source: "Direct", date: "12 Apr" },
    { guest: "S. Al-Rashid", room: "Junior Suite", nights: 4, rate: 215, source: "Expedia", date: "11 Apr" },
    { guest: "L. Chen", room: "Standard Double", nights: 1, rate: 128, source: "Booking.com", date: "11 Apr" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: R.heroBg, color: R.white, fontFamily: "'Inter', system-ui, sans-serif", display: "flex" }}>

      {/* ─── Sidebar ─── */}
      <div style={{ width: 220, background: R.darkBand, borderRight: `1px solid ${R.border}`, padding: "20px 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 24px", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: R.teal, fontSize: 18, fontWeight: 200 }}>(</span>
          <span style={{ color: R.accent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
          <span style={{ color: R.gold, fontSize: 18, fontWeight: 200 }}>)</span>
        </div>
        {[
          { label: "Dashboard", active: true },
          { label: "Reports", active: false },
          { label: "Market Intel", active: false },
          { label: "Sentinel", active: false },
          { label: "Bookings", active: false },
          { label: "Settings", active: false },
        ].map((item) => (
          <div key={item.label} style={{
            padding: "10px 20px", fontSize: 13, fontWeight: item.active ? 600 : 400,
            color: item.active ? R.accent : R.textMid, cursor: "pointer",
            background: item.active ? `${R.teal}10` : "transparent",
            borderLeft: item.active ? `2px solid ${R.teal}` : "2px solid transparent",
          }}>
            {item.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${R.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: R.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: R.darkBand }}>KM</div>
          <div>
            <div style={{ fontSize: 12, color: R.accent }}>Karol Marcu</div>
            <div style={{ fontSize: 10, color: R.textDim }}>Managing Director</div>
          </div>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>Dashboard</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: R.accent }}>W14 Hotel</span>
              <ChevronDown size={12} color={R.textDim} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Search size={15} color={R.textDim} />
            <Bell size={15} color={R.textDim} />
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* Outlook + KPI strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderRadius: 8, background: "rgba(52,208,104,0.06)", border: "1px solid rgba(52,208,104,0.2)", marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(52,208,104,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={13} color={R.green} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#86efac" }}>Market demand strengthening</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#86efac" }}>+8.4%</div>
          </div>

          {/* KPI row — horizontal cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Revenue MTD", value: fmt(321900), color: R.teal },
              { label: "Occupancy", value: "74.6%", color: R.accent },
              { label: "ADR", value: fmt(142), color: R.accent },
              { label: "RevPAR", value: fmt(106), color: R.accent },
              { label: "YoY", value: "+8.7%", color: R.green },
              { label: "Comp Index", value: "112.4", color: R.teal },
            ].map((k) => (
              <div key={k.label} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 8, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Month cards — horizontal strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {months.map((m) => (
              <div key={m.period} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, color: R.accent, textTransform: "uppercase" }}>{m.period}</div>
                    <div style={{ fontSize: 10, color: R.textDim }}>{m.label}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: R.green, padding: "2px 6px", background: "rgba(52,208,104,0.08)", borderRadius: 3 }}>+{m.yoy}%</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, color: R.teal }}>{fmt(m.revenue)}</div>
                <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{m.occ}% occ · {fmt(m.adr)} ADR</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${R.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Market Demand</div>
              </div>
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 120 }}>
                  {demandBars.map((b) => (
                    <div key={b.i} style={{ flex: 1, position: "relative" }}>
                      {b.isEvent && <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, background: `${R.teal}08` }} />}
                      <div style={{ position: "relative", width: "100%", height: `${b.v * 1.1}%`, background: demandColor(b.v), borderRadius: "1px 1px 0 0", opacity: 0.8, minHeight: 2 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${R.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Occupancy & Pickup</div>
              </div>
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 120 }}>
                  {occBars.map((b) => (
                    <div key={b.i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", height: `${b.occ * 1.15}%` }}>
                      <div style={{ flex: b.pickup, background: R.teal, borderRadius: "1px 1px 0 0", opacity: 0.9, minHeight: b.pickup > 0 ? 1 : 0 }} />
                      <div style={{ flex: b.base, background: R.textDim, opacity: 0.4, minHeight: 1 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bookings */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Recent Bookings</div>
              <span style={{ fontSize: 11, color: R.teal, cursor: "pointer" }}>View all</span>
            </div>
            {bookings.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, padding: "10px 18px", borderBottom: i < bookings.length - 1 ? `1px solid ${R.border}` : "none", alignItems: "center" }}>
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
    </div>
  );
}
