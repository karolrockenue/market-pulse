import { useMemo } from "react";
import { TrendingUp, ChevronDown, Bell, Search } from "lucide-react";

// ── MP Dashboard v2: Borderless ──
// Cards removed from charts. Only month cards and bookings get a box.
// Charts sit open on the page with just section headers and subtle dividers.

const R = {
  bg: "#14181D", card: "#1C2228", border: "#2A3240", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  heroBg: "#111519", darkBand: "#121519", green: "#34D068", red: "#ef4444",
};
const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const demandColor = (v: number) => v >= 85 ? R.red : v >= 70 ? "#f97316" : v >= 50 ? "#f59e0b" : v >= 30 ? R.teal : "#3b82f6";

function Sidebar() {
  return (
    <div style={{ width: 220, background: R.darkBand, borderRight: `1px solid ${R.border}`, padding: "20px 0", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "0 20px 24px", alignItems: "center", gap: 5 }}>
        <span style={{ color: R.teal, fontSize: 18, fontWeight: 200 }}>(</span>
        <span style={{ color: R.accent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
        <span style={{ color: R.gold, fontSize: 18, fontWeight: 200 }}>)</span>
      </div>
      {["Dashboard", "Reports", "Market Intel", "Sentinel", "Bookings", "Settings"].map((item, i) => (
        <div key={item} style={{ padding: "10px 20px", fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? R.accent : R.textMid, cursor: "pointer", background: i === 0 ? `${R.teal}10` : "transparent", borderLeft: i === 0 ? `2px solid ${R.teal}` : "2px solid transparent" }}>{item}</div>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${R.border}`, alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: R.teal, alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: R.darkBand }}>KM</div>
        <div><div style={{ fontSize: 12, color: R.accent }}>Karol Marcu</div><div style={{ fontSize: 10, color: R.textDim }}>Managing Director</div></div>
      </div>
    </div>
  );
}

export function MPDash2() {
  const months = [
    { period: "Last Month", label: "Mar 2026", revenue: 542800, occ: 81.2, adr: 148, yoy: 11.2 },
    { period: "Current", label: "Apr 2026", revenue: 321900, occ: 74.6, adr: 142, yoy: 8.7 },
    { period: "Next Month", label: "May 2026", revenue: 184000, occ: 42.3, adr: 155, yoy: 14.1 },
  ];
  const demandBars = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const dow = i % 7; const v = Math.min(98, Math.max(8, Math.round(42 + (i / 60) * 20 + (dow >= 5 ? 22 : 0) + Math.sin(i * 0.4) * 14)));
    return { i, v, isEvent: [8, 9, 22, 23, 24, 25, 38, 39, 40, 50, 51].includes(i) };
  }), []);
  const occBars = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const dow = i % 7; const occ = Math.min(96, Math.max(30, Math.round(58 + (dow >= 5 ? 18 : 0) + Math.sin(i * 0.4) * 12)));
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
    <div style={{ minHeight: "100vh", background: R.heroBg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", display: "flex" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>Dashboard</div>
            <div style={{ alignItems: "center", gap: 6, padding: "5px 12px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: R.accent }}>W14 Hotel</span><ChevronDown size={12} color={R.textDim} />
            </div>
          </div>
          <div style={{ alignItems: "center", gap: 14 }}><Search size={15} color={R.textDim} /><Bell size={15} color={R.textDim} /></div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* Outlook */}
          <div style={{ alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 8, background: "rgba(52,208,104,0.05)", border: "1px solid rgba(52,208,104,0.15)", marginBottom: 24 }}>
            <TrendingUp size={14} color={R.green} />
            <span style={{ fontSize: 12, color: "#86efac", fontWeight: 500, flex: 1 }}>Market demand strengthening</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#86efac" }}>+8.4%</span>
          </div>

          {/* Month cards — these keep boxes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 32 }}>
            {months.map((m) => (
              <div key={m.period} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div><div style={{ fontSize: 14, color: R.accent, textTransform: "uppercase" }}>{m.period}</div><div style={{ fontSize: 10, color: R.textDim }}>{m.label}</div></div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: R.green, padding: "2px 6px", background: "rgba(52,208,104,0.08)", borderRadius: 3 }}>+{m.yoy}%</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 600, color: R.teal }}>{fmt(m.revenue)}</div>
                <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{m.occ}% occ · {fmt(m.adr)} ADR</div>
              </div>
            ))}
          </div>

          {/* Charts — borderless, just headers and content on the page */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>90-DAY FORWARD</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: R.accent, marginBottom: 14 }}>Market Demand</div>
              <div style={{ alignItems: "flex-end", gap: 1, height: 130 }}>
                {demandBars.map((b) => (
                  <div key={b.i} style={{ flex: 1, position: "relative" }}>
                    {b.isEvent && <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, background: `${R.teal}08` }} />}
                    <div style={{ position: "relative", width: "100%", height: `${b.v * 1.15}%`, background: demandColor(b.v), borderRadius: "1px 1px 0 0", opacity: 0.8, minHeight: 2 }} />
                  </div>
                ))}
              </div>
              <div style={{ gap: 4, marginTop: 8 }}>
                {["Chelsea Flower Show", "Wimbledon", "BST Hyde Park"].map((e) => (
                  <span key={e} style={{ fontSize: 7, color: R.gold, padding: "1px 5px", background: `${R.gold}10`, borderRadius: 2 }}>{e}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>90-DAY FORWARD</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: R.accent, marginBottom: 14 }}>Occupancy & Pickup</div>
              <div style={{ alignItems: "flex-end", gap: 1, height: 130 }}>
                {occBars.map((b) => (
                  <div key={b.i} style={{ flex: 1, flexDirection: "column", alignItems: "stretch", height: `${b.occ * 1.2}%` }}>
                    <div style={{ flex: b.pickup, background: R.teal, borderRadius: "1px 1px 0 0", opacity: 0.9, minHeight: b.pickup > 0 ? 1 : 0 }} />
                    <div style={{ flex: b.base, background: R.textDim, opacity: 0.4, minHeight: 1 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${R.border}`, marginBottom: 24 }} />

          {/* Bookings — keeps box */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${R.border}`, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Recent Bookings</div>
              <span style={{ fontSize: 11, color: R.teal, cursor: "pointer" }}>View all</span>
            </div>
            {bookings.map((b, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, padding: "10px 18px", borderBottom: i < bookings.length - 1 ? `1px solid ${R.border}` : "none", alignItems: "center" }}>
                <div><div style={{ fontSize: 12, color: R.accent, fontWeight: 500 }}>{b.guest}</div><div style={{ fontSize: 10, color: R.textDim }}>{b.room} · {b.nights}n</div></div>
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
