import { useMemo } from "react";
import { TrendingUp, ChevronDown, Bell, BarChart3, Activity, Calendar, Users } from "lucide-react";

// ── MP Concept 4: Two-column — left is a persistent summary panel, right scrolls ──

const R = {
  bg: "#14181D", card: "#1C2228", border: "#2A3240", accent: "#F3F5F7", white: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  heroBg: "#111519", darkBand: "#121519", green: "#34D068", red: "#ef4444",
};

const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const demandColor = (v: number) => v >= 85 ? R.red : v >= 70 ? "#f97316" : v >= 50 ? "#f59e0b" : v >= 30 ? R.teal : "#3b82f6";

export function MPConcept4() {
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
    { guest: "R. Fernandez", room: "Double Deluxe", nights: 2, rate: 158, source: "HRS", date: "10 Apr" },
    { guest: "A. Novak", room: "Standard Double", nights: 1, rate: 135, source: "Direct", date: "10 Apr" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: R.heroBg, color: R.white, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ─── Top bar ─── */}
      <div style={{ padding: "0 28px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${R.border}`, background: R.darkBand, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: R.teal, fontSize: 18, fontWeight: 200 }}>(</span>
            <span style={{ color: R.accent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
            <span style={{ color: R.gold, fontSize: 18, fontWeight: 200 }}>)</span>
          </div>
          <div style={{ width: 1, height: 18, background: R.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 12, color: R.accent }}>W14 Hotel</span>
            <ChevronDown size={11} color={R.textDim} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Bell size={14} color={R.textDim} />
          <div style={{ width: 26, height: 26, borderRadius: 13, background: R.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: R.darkBand }}>KM</div>
        </div>
      </div>

      {/* ─── Split layout ─── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left panel — sticky summary */}
        <div style={{ width: 320, borderRight: `1px solid ${R.border}`, padding: "24px", overflow: "auto", flexShrink: 0, background: R.bg }}>
          {/* Property name */}
          <div style={{ fontSize: 18, fontWeight: 700, color: R.accent, marginBottom: 4 }}>W14 Hotel</div>
          <div style={{ fontSize: 11, color: R.textDim, marginBottom: 24 }}>London · 65 rooms</div>

          {/* Outlook */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(52,208,104,0.06)", border: "1px solid rgba(52,208,104,0.15)", marginBottom: 24 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: R.green }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#86efac", fontWeight: 500 }}>Demand strengthening</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#86efac" }}>+8.4%</span>
          </div>

          {/* KPI stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 24 }}>
            {[
              { label: "Revenue MTD", value: "£321,900", color: R.teal, icon: <BarChart3 size={13} /> },
              { label: "Occupancy", value: "74.6%", color: R.accent, icon: <Activity size={13} /> },
              { label: "ADR", value: "£142", color: R.accent, icon: <Calendar size={13} /> },
              { label: "RevPAR", value: "£106", color: R.accent, icon: <Users size={13} /> },
            ].map((k, i) => (
              <div key={k.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i < 3 ? `1px solid ${R.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ color: R.textDim }}>{k.icon}</div>
                  <span style={{ fontSize: 13, color: R.text }}>{k.label}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 600, color: k.color }}>{k.value}</span>
              </div>
            ))}
          </div>

          {/* YoY + Index */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>YoY</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: R.green }}>+8.7%</div>
            </div>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px", textAlign: "center" }}>
              <div style={{ fontSize: 8, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Comp Index</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: R.teal }}>112.4</div>
            </div>
          </div>
        </div>

        {/* Right panel — scrollable content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>
          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Market Demand</div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 130 }}>
                  {demandBars.map((b) => (
                    <div key={b.i} style={{ flex: 1, position: "relative" }}>
                      {b.isEvent && <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, background: `${R.teal}08` }} />}
                      <div style={{ position: "relative", width: "100%", height: `${b.v * 1.15}%`, background: demandColor(b.v), borderRadius: "1px 1px 0 0", opacity: 0.8, minHeight: 2 }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {["Chelsea Flower Show", "Wimbledon", "BST Hyde Park"].map((e) => (
                    <span key={e} style={{ fontSize: 7, color: R.gold, padding: "1px 5px", background: `${R.gold}10`, borderRadius: 2 }}>{e}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Occupancy & Pickup</div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 130 }}>
                  {occBars.map((b) => (
                    <div key={b.i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", height: `${b.occ * 1.2}%` }}>
                      <div style={{ flex: b.pickup, background: R.teal, borderRadius: "1px 1px 0 0", opacity: 0.9, minHeight: b.pickup > 0 ? 1 : 0 }} />
                      <div style={{ flex: b.base, background: R.textDim, opacity: 0.4, minHeight: 1 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Demand patterns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Busiest Days</div>
              <div style={{ padding: "4px 0" }}>
                {[
                  { date: "Sat 14 Jun", demand: 94, event: "Wimbledon W1" },
                  { date: "Sat 21 Jun", demand: 91, event: "Wimbledon Final" },
                  { date: "Sat 5 Jul", demand: 88, event: "BST Hyde Park" },
                  { date: "Fri 13 Jun", demand: 86, event: null },
                  { date: "Sat 26 Jul", demand: 84, event: "Notting Hill" },
                ].map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: i < 4 ? `1px solid ${R.border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: R.accent }}>{d.date}</span>
                      {d.event && <span style={{ fontSize: 8, color: R.gold, padding: "1px 5px", background: `${R.gold}10`, borderRadius: 3 }}>{d.event}</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: demandColor(d.demand) }}>{d.demand}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Quietest Days</div>
              <div style={{ padding: "4px 0" }}>
                {[
                  { date: "Tue 22 Apr", demand: 18 },
                  { date: "Mon 28 Apr", demand: 21 },
                  { date: "Wed 7 May", demand: 24 },
                  { date: "Tue 13 May", demand: 26 },
                  { date: "Mon 2 Jun", demand: 28 },
                ].map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: i < 4 ? `1px solid ${R.border}` : "none" }}>
                    <span style={{ fontSize: 12, color: R.accent }}>{d.date}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6" }}>{d.demand}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bookings */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>Recent Bookings</div>
              <span style={{ fontSize: 10, color: R.teal, cursor: "pointer" }}>View all</span>
            </div>
            {bookings.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10, padding: "9px 16px", borderBottom: i < bookings.length - 1 ? `1px solid ${R.border}` : "none", alignItems: "center" }}>
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
