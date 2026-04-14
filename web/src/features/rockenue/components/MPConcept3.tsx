import { useMemo } from "react";
import { TrendingUp, ChevronDown, Bell, Globe } from "lucide-react";

// ── MP Concept 3: Full-width hero KPI banner, dense grid below ──

const R = {
  bg: "#14181D", card: "#1C2228", border: "#2A3240", accent: "#F3F5F7", white: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  heroBg: "#111519", darkBand: "#121519", green: "#34D068", red: "#ef4444",
};

const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const demandColor = (v: number) => v >= 85 ? R.red : v >= 70 ? "#f97316" : v >= 50 ? "#f59e0b" : v >= 30 ? R.teal : "#3b82f6";

export function MPConcept3() {
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

  const wapLine = useMemo(() => Array.from({ length: 60 }, (_, i) =>
    Math.round(136 + Math.sin(i * 0.13) * 20 + (i % 7 >= 5 ? 16 : 0) + Math.sin(i * 0.3) * 7)
  ), []);

  const bookings = [
    { guest: "M. Anderson", room: "Double Deluxe", nights: 3, rate: 162, source: "Booking.com", date: "12 Apr" },
    { guest: "J. Kowalski", room: "Superior Twin", nights: 2, rate: 148, source: "Direct", date: "12 Apr" },
    { guest: "S. Al-Rashid", room: "Junior Suite", nights: 4, rate: 215, source: "Expedia", date: "11 Apr" },
    { guest: "L. Chen", room: "Standard Double", nights: 1, rate: 128, source: "Booking.com", date: "11 Apr" },
    { guest: "R. Fernandez", room: "Double Deluxe", nights: 2, rate: 158, source: "HRS", date: "10 Apr" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: R.heroBg, color: R.white, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ─── Slim top bar ─── */}
      <div style={{ padding: "0 28px", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${R.border}`, background: R.darkBand }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: R.teal, fontSize: 18, fontWeight: 200 }}>(</span>
          <span style={{ color: R.accent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ROCKENUE</span>
          <span style={{ color: R.gold, fontSize: 18, fontWeight: 200 }}>)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, cursor: "pointer" }}>
            <span style={{ fontSize: 12, color: R.accent }}>W14 Hotel</span>
            <ChevronDown size={11} color={R.textDim} />
          </div>
          <Bell size={14} color={R.textDim} />
          <div style={{ width: 24, height: 24, borderRadius: 12, background: R.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: R.darkBand }}>KM</div>
        </div>
      </div>

      {/* ─── Hero KPI banner ─── */}
      <div style={{ background: R.darkBand, borderBottom: `1px solid ${R.border}`, padding: "28px 28px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Outlook line */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: R.green }} />
            <span style={{ fontSize: 12, color: "#86efac", fontWeight: 500 }}>Market demand strengthening</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#86efac", marginLeft: 8 }}>+8.4%</span>
          </div>
          {/* Big KPI row */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48 }}>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Revenue MTD</div>
              <div style={{ fontSize: 38, fontWeight: 700, color: R.teal, letterSpacing: -1.5 }}>£321,900</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Occupancy</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: R.accent }}>74.6%</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>ADR</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: R.accent }}>£142</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>RevPAR</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: R.accent }}>£106</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>YoY</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: R.green }}>+8.7%</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Comp Index</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: R.teal }}>112.4</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content grid ─── */}
      <div style={{ padding: "20px 28px", maxWidth: 1400, margin: "0 auto" }}>
        {/* Three charts in a row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          {/* Demand */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Market Demand</div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 100 }}>
                {demandBars.map((b) => (
                  <div key={b.i} style={{ flex: 1, position: "relative" }}>
                    {b.isEvent && <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, background: `${R.teal}08` }} />}
                    <div style={{ position: "relative", width: "100%", height: `${b.v}%`, background: demandColor(b.v), borderRadius: "1px 1px 0 0", opacity: 0.8, minHeight: 2 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Occupancy */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Occupancy & Pickup</div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 100 }}>
                {occBars.map((b) => (
                  <div key={b.i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", height: `${b.occ * 1.0}%` }}>
                    <div style={{ flex: b.pickup, background: R.teal, borderRadius: "1px 1px 0 0", opacity: 0.9, minHeight: b.pickup > 0 ? 1 : 0 }} />
                    <div style={{ flex: b.base, background: R.textDim, opacity: 0.4, minHeight: 1 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* WAP */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Market WAP</div>
            <div style={{ padding: "12px 16px" }}>
              <svg viewBox={`0 0 ${wapLine.length * 4} 80`} style={{ width: "100%", height: 100 }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="c3wf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={R.teal} stopOpacity="0.15" />
                    <stop offset="100%" stopColor={R.teal} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={wapLine.map((v, i) => `${i === 0 ? "M" : "L"}${i * 4},${80 - ((v - 110) / 70) * 80}`).join(" ") + ` L${(wapLine.length - 1) * 4},80 L0,80 Z`} fill="url(#c3wf)" />
                <path d={wapLine.map((v, i) => `${i === 0 ? "M" : "L"}${i * 4},${80 - ((v - 110) / 70) * 80}`).join(" ")} fill="none" stroke={R.teal} strokeWidth="1.5" opacity="0.7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Months + Bookings */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12 }}>
          {/* Month comparison table */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 12, fontWeight: 600, color: R.accent }}>Performance</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 0, padding: "0" }}>
              {/* Header */}
              <div style={{ padding: "8px 16px", fontSize: 9, color: R.textDim, textTransform: "uppercase", borderBottom: `1px solid ${R.border}` }} />
              <div style={{ padding: "8px 12px", fontSize: 9, color: R.textDim, textTransform: "uppercase", textAlign: "right", borderBottom: `1px solid ${R.border}` }}>Revenue</div>
              <div style={{ padding: "8px 12px", fontSize: 9, color: R.textDim, textTransform: "uppercase", textAlign: "right", borderBottom: `1px solid ${R.border}` }}>Occ</div>
              <div style={{ padding: "8px 12px", fontSize: 9, color: R.textDim, textTransform: "uppercase", textAlign: "right", borderBottom: `1px solid ${R.border}` }}>ADR</div>
              {[
                { label: "March 2026", rev: 542800, occ: "81.2%", adr: 148 },
                { label: "April 2026", rev: 321900, occ: "74.6%", adr: 142 },
                { label: "May 2026", rev: 184000, occ: "42.3%", adr: 155 },
              ].map((row, i) => (
                <>
                  <div key={`l${i}`} style={{ padding: "10px 16px", fontSize: 12, color: R.accent, fontWeight: 500, borderBottom: i < 2 ? `1px solid ${R.border}` : "none" }}>{row.label}</div>
                  <div style={{ padding: "10px 12px", fontSize: 12, color: R.teal, fontWeight: 600, textAlign: "right", borderBottom: i < 2 ? `1px solid ${R.border}` : "none" }}>{fmt(row.rev)}</div>
                  <div style={{ padding: "10px 12px", fontSize: 12, color: R.accent, textAlign: "right", borderBottom: i < 2 ? `1px solid ${R.border}` : "none" }}>{row.occ}</div>
                  <div style={{ padding: "10px 12px", fontSize: 12, color: R.accent, textAlign: "right", borderBottom: i < 2 ? `1px solid ${R.border}` : "none" }}>{fmt(row.adr)}</div>
                </>
              ))}
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
