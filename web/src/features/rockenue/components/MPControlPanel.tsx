import { useState } from "react";
import {
  ChevronDown, ChevronUp, Globe2, Clock, Layers, Target,
  TrendingUp, Tag, Calendar, Plus, Trash2, Download,
  AlertTriangle, UploadCloud, RefreshCw, Sliders, Shield,
  Bell, Search, BarChart3, HelpCircle,
} from "lucide-react";

interface MPControlPanelProps { activeView: string; onNavigate: (view: string) => void; }

/* ── Design tokens (matching Canvas / tokens.ts) ── */
const R = {
  bg: "#14181D", card: "#1C2228", border: "#1E2330",
  sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7", text: "#B0B8C4",
  textMid: "#7A8494", textDim: "#4E5868",
  teal: "#39BDF8",       // app-wide accent, CTAs
  warmTeal: "#38C6BA",   // KPI values, winning, active states
  gold: "#C8A66E",       // eyebrows, section labels, attention
  darkBand: "#121519", sidebar: "#0C0E12",
  green: "#34D068",      // positive deltas
  red: "#ef4444",        // negative / errors
};

/* ── Tiny helpers ── */

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{ width: 34, height: 18, borderRadius: 9, background: on ? R.warmTeal : "#2C3038", padding: 2, cursor: "pointer", transition: "background 0.15s" }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 0.15s" }} />
    </div>
  );
}

/* ── Mock Data ── */

const HOTELS = [
  { id: 315428, name: "Vilenza Hotel", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 2, max: 320, lmf: { enabled: true, rate: 79, days: 3, dow: ["mon","tue","wed","thu","sun"] }, rooms: [{ name: "Standard Double", isBase: true, diff: 0, op: "+" }, { name: "Superior Twin", isBase: false, diff: 15, op: "+" }, { name: "Double Deluxe", isBase: false, diff: 25, op: "+" }, { name: "Triple Room", isBase: false, diff: 20, op: "+" }, { name: "Junior Suite", isBase: false, diff: 45, op: "+" }], minBase: 89, rd: { min: true, max: true, curves: true, season: true, diffs: true } },
  { id: 289618, name: "The Cleveland Hotel", enabled: true, autopilot: true, strategy: "sell_every_room" as const, freeze: 1, max: 280, lmf: { enabled: true, rate: 69, days: 3, dow: ["mon","tue","wed","thu","fri","sat","sun"] }, rooms: [{ name: "Standard Room", isBase: true, diff: 0, op: "+" }, { name: "Twin Room", isBase: false, diff: 10, op: "+" }, { name: "Triple Room", isBase: false, diff: 18, op: "+" }, { name: "Family Room", isBase: false, diff: 30, op: "+" }], minBase: 79, rd: { min: true, max: true, curves: true, season: true, diffs: true } },
  { id: 315433, name: "The Whitechapel Hotel", enabled: true, autopilot: false, strategy: "maintain" as const, freeze: 2, max: 400, lmf: { enabled: false, rate: 0, days: 0, dow: [] as string[] }, rooms: [{ name: "Compact Double", isBase: true, diff: 0, op: "+" }, { name: "Standard Double", isBase: false, diff: 12, op: "+" }, { name: "Superior Double", isBase: false, diff: 22, op: "+" }, { name: "Twin Room", isBase: false, diff: 15, op: "+" }, { name: "Triple Room", isBase: false, diff: 25, op: "+" }, { name: "Quad Room", isBase: false, diff: 35, op: "+" }], minBase: 95, rd: { min: true, max: false, curves: false, season: true, diffs: true } },
  { id: 308760, name: "The Melita", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 2, max: 350, lmf: { enabled: true, rate: 85, days: 5, dow: ["mon","tue","wed","thu"] }, rooms: [{ name: "Standard Double", isBase: true, diff: 0, op: "+" }, { name: "Superior Room", isBase: false, diff: 18, op: "+" }, { name: "Deluxe Room", isBase: false, diff: 32, op: "+" }, { name: "Jacuzzi Suite", isBase: false, diff: 65, op: "+" }], minBase: 99, rd: { min: true, max: true, curves: true, season: true, diffs: true } },
  { id: 315473, name: "Elysee Hyde Park", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 3, max: 380, lmf: { enabled: true, rate: 95, days: 3, dow: ["sun","mon","tue","wed","thu"] }, rooms: [{ name: "Economy Single", isBase: true, diff: 0, op: "+" }, { name: "Standard Double", isBase: false, diff: 20, op: "+" }, { name: "Twin Room", isBase: false, diff: 18, op: "+" }, { name: "Superior Double", isBase: false, diff: 35, op: "+" }, { name: "Family Room", isBase: false, diff: 42, op: "+" }], minBase: 109, rd: { min: true, max: true, curves: true, season: true, diffs: true } },
  { id: 230719, name: "Jubilee Hotel Victoria", enabled: true, autopilot: false, strategy: "maintain" as const, freeze: 2, max: 300, lmf: { enabled: false, rate: 0, days: 0, dow: [] as string[] }, rooms: [{ name: "Standard Double", isBase: true, diff: 0, op: "+" }, { name: "Twin Room", isBase: false, diff: 12, op: "+" }, { name: "Triple Room", isBase: false, diff: 22, op: "+" }], minBase: 85, rd: { min: true, max: true, curves: false, season: true, diffs: true } },
  { id: 315429, name: "Camden Suites", enabled: false, autopilot: false, strategy: "maintain" as const, freeze: 2, max: 250, lmf: { enabled: false, rate: 0, days: 0, dow: [] as string[] }, rooms: [{ name: "Studio Apartment", isBase: true, diff: 0, op: "+" }, { name: "One-Bed Apartment", isBase: false, diff: 28, op: "+" }, { name: "Two-Bed Apartment", isBase: false, diff: 55, op: "+" }], minBase: 75, rd: { min: false, max: false, curves: false, season: false, diffs: false } },
  { id: 2400, name: "Astor Victoria", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 2, max: 340, lmf: { enabled: true, rate: 82, days: 3, dow: ["mon","tue","wed","thu","sun"] }, rooms: [{ name: "Standard Single", isBase: true, diff: 0, op: "+" }, { name: "Standard Double", isBase: false, diff: 15, op: "+" }, { name: "Twin Room", isBase: false, diff: 15, op: "+" }, { name: "Triple Room", isBase: false, diff: 28, op: "+" }], minBase: 92, rd: { min: true, max: true, curves: true, season: true, diffs: true } },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEASON_MAP: Record<string, "LOW"|"MID"|"HIGH"> = { Jan:"LOW", Feb:"LOW", Mar:"MID", Apr:"MID", May:"HIGH", Jun:"HIGH", Jul:"HIGH", Aug:"HIGH", Sep:"MID", Oct:"MID", Nov:"LOW", Dec:"MID" };
const DOWS = [{ k: "mon", l: "Mon" },{ k: "tue", l: "Tue" },{ k: "wed", l: "Wed" },{ k: "thu", l: "Thu" },{ k: "fri", l: "Fri" },{ k: "sat", l: "Sat" },{ k: "sun", l: "Sun" }];
const PROMO = { multiplier: 1.00, nonRef: 10, genius: 15, campaign: 8, targeting: 5, deepDeal: 0 };

const EVENTS = [
  { date: "30 Jun – 13 Jul", name: "Wimbledon 2026", mult: "2.5×", days: 14 },
  { date: "3 – 12 Jul", name: "BST Hyde Park", mult: "2.0×", days: 10 },
  { date: "29 – 31 Aug", name: "Notting Hill Carnival", mult: "2.0×", days: 3 },
  { date: "20 – 24 May", name: "Chelsea Flower Show", mult: "1.5×", days: 5 },
  { date: "14 Jun", name: "Trooping the Colour", mult: "1.5×", days: 1 },
];

const WEBHOOKS = [
  { name: "Vilenza Hotel", ok: true },
  { name: "The Cleveland Hotel", ok: true },
  { name: "The Whitechapel Hotel", ok: false },
  { name: "The Melita", ok: true },
  { name: "Elysee Hyde Park", ok: true },
];

/* ── Shared cell styles ── */
const th: React.CSSProperties = { padding: "8px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: R.textDim, textTransform: "uppercase", textAlign: "left" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };

/* ═══════════════════════════════════════════ */

export function MPControlPanel({ activeView, onNavigate }: MPControlPanelProps) {
  const [expandedHotel, setExpandedHotel] = useState<number | null>(null);
  const [diffsOpen, setDiffsOpen] = useState(true);
  const [addEventOpen, setAddEventOpen] = useState(false);

  const readinessCount = (rd: typeof HOTELS[0]["rd"]) => Object.values(rd).filter(Boolean).length;

  return (
    <div style={{ background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", minHeight: "100vh" }}>

      {/* ── Top Bar ── */}
      <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
          <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>Portfolio</span>
          <ChevronDown size={14} color={R.textMid} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Search size={16} color={R.textMid} style={{ cursor: "pointer" }} />
          <Bell size={16} color={R.textMid} style={{ cursor: "pointer" }} />
        </div>
      </div>

      <div style={{ padding: "28px 32px" }}>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>SENTINEL</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>AI Control Panel</h1>
          <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>PMS Integration & AI Configuration &bull; {HOTELS.length} properties</p>
        </div>

        {/* ═══ 1. ACTIVATION ═══ */}
        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Activate Property</div>
            <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>Select an unactivated hotel to sync with PMS</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 280, height: 32, background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 6, display: "flex", alignItems: "center", padding: "0 12px", color: R.textDim, fontSize: 12 }}>
              Search hotel...
            </div>
            <button style={{ padding: "7px 16px", borderRadius: 6, background: R.warmTeal, color: R.sidebar, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", height: 32 }}>
              Activate & Sync
            </button>
          </div>
        </div>

        {/* ═══ 2. MARKET STRATEGY ═══ */}
        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", gap: 10 }}>
            <Globe2 size={14} color={R.textMid} />
            <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Market Strategy & Vitals</div>
          </div>

          <div style={{ padding: "18px 20px" }}>
            {/* Market tab */}
            <div style={{ display: "inline-flex", padding: 2, background: R.sidebar, borderRadius: 5, border: `1px solid ${R.border}`, marginBottom: 18 }}>
              <div style={{ padding: "4px 16px", fontSize: 11, borderRadius: 3, background: R.card, color: R.accent, fontWeight: 500 }}>London</div>
            </div>

            {/* Events header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Manual Events</div>
              <button onClick={() => setAddEventOpen(!addEventOpen)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${R.border}`, background: R.card, color: R.text, fontSize: 11, cursor: "pointer" }}>
                <Plus size={11} /> Add Event
              </button>
            </div>

            {/* Add Event */}
            {addEventOpen && (
              <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: R.accent, marginBottom: 12 }}>Add Event Range</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  {["Start Date", "End Date"].map(lbl => (
                    <div key={lbl}>
                      <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{lbl}</div>
                      <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, padding: "7px 12px", fontSize: 12, color: R.textDim, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <Calendar size={12} color={R.textDim} /> Pick a date
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Event Name</div>
                    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, padding: "7px 12px", fontSize: 12, color: R.textDim }}>e.g. Wimbledon 2026</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Impact Tier</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["Medium 1.5×", "High 2.0×", "Extreme 2.5×"].map((t, i) => (
                        <div key={t} style={{ flex: 1, textAlign: "center", fontSize: 10, padding: "7px 2px", borderRadius: 4, background: i === 0 ? `rgba(255,255,255,0.04)` : R.card, border: `1px solid ${i === 0 ? "rgba(255,255,255,0.08)" : R.border}`, color: i === 0 ? R.accent : R.textDim, cursor: "pointer" }}>{t}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setAddEventOpen(false)} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${R.border}`, background: "transparent", color: R.textMid, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                  <button style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: R.warmTeal, color: R.sidebar, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add Events</button>
                </div>
              </div>
            )}

            {/* Events table */}
            <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                    <th style={th}>Date</th>
                    <th style={th}>Event Name</th>
                    <th style={thR}>Impact</th>
                    <th style={{ ...thR, width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((ev, i) => (
                    <tr key={ev.name} style={{ borderBottom: i < EVENTS.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                      <td style={{ padding: "9px 16px", fontSize: 12, color: R.text }}>{ev.date}</td>
                      <td style={{ padding: "9px 16px", fontSize: 12, color: R.accent, fontWeight: 500 }}>
                        {ev.name}
                        {ev.days > 1 && <span style={{ color: R.textDim, fontWeight: 400, marginLeft: 6, fontSize: 10 }}>({ev.days}d)</span>}
                      </td>
                      <td style={{ padding: "9px 16px", fontSize: 11, color: R.gold, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{ev.mult}</td>
                      <td style={{ padding: "9px 16px", textAlign: "right" }}>
                        <Trash2 size={12} color={R.textDim} style={{ cursor: "pointer", opacity: 0.5 }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Vitals */}
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 10 }}>Vitals</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Portfolio Hotels", value: "8", color: R.warmTeal },
                { label: "Autopilot Active", value: "5", color: R.gold },
                { label: "Sentinel Enabled", value: "7", color: R.warmTeal },
                { label: "Avg Freeze", value: "2.1d", color: R.accent },
              ].map(v => (
                <div key={v.label} style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{v.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: v.color, letterSpacing: -0.5 }}>{v.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ 3. HOTEL ACCORDIONS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {HOTELS.map(hotel => {
            const isOpen = expandedHotel === hotel.id;
            const { rd } = hotel;
            const ready = readinessCount(rd);
            return (
              <div key={hotel.id} style={{
                background: R.darkBand, borderRadius: 10, overflow: "hidden",
                border: `1px solid ${isOpen ? "rgba(255,255,255,0.06)" : R.border}`,
                borderLeft: `3px solid ${hotel.enabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"}`,
              }}>
                {/* Header */}
                <div onClick={() => setExpandedHotel(isOpen ? null : hotel.id)} style={{ display: "flex", alignItems: "center", padding: "13px 20px", cursor: "pointer", gap: 14 }}>
                  <ChevronDown size={12} color={R.textDim} style={{ transform: isOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.15s", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: R.accent, minWidth: 170 }}>{hotel.name}</span>
                  <span style={{ fontSize: 10, color: R.textDim, fontVariantNumeric: "tabular-nums" }}>({hotel.id})</span>

                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Status indicators */}
                    {hotel.autopilot && <span style={{ fontSize: 10, fontWeight: 600, color: R.warmTeal, padding: "2px 8px", borderRadius: 3, background: `${R.warmTeal}10`, border: `1px solid ${R.warmTeal}20` }}>AUTOPILOT</span>}
                    <span style={{ fontSize: 10, color: hotel.strategy === "sell_every_room" ? R.gold : R.textMid }}>{hotel.strategy === "sell_every_room" ? "Sell Every Room" : "Maintain"}</span>
                    <span style={{ fontSize: 10, color: hotel.enabled ? R.green : R.textDim }}>●&ensp;{hotel.enabled ? "Active" : "Paused"}</span>
                    <div style={{ width: 1, height: 14, background: R.border }} />
                    {/* Readiness dots */}
                    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                      {Object.entries(rd).map(([k, ok]) => (
                        <div key={k} style={{ width: 6, height: 6, borderRadius: 3, background: ok ? R.green : `${R.red}40` }} title={k} />
                      ))}
                      <span style={{ fontSize: 9, color: ready === 5 ? R.warmTeal : R.textDim, marginLeft: 4 }}>{ready}/5</span>
                    </div>
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ padding: "0 20px 24px", borderTop: `1px solid ${R.sep}` }}>

                    {/* ── Settings Grid ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      {[
                        { label: "Sentinel AI", sub: null, right: <Toggle on={hotel.enabled} /> },
                        { label: "Sentinel Mode", sub: hotel.autopilot ? "Autopilot — auto PMS push" : "Manual review", right: <Toggle on={hotel.autopilot} /> },
                        { label: "Yield Strategy", sub: null, right: (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: R.card, border: `1px solid ${R.border}`, borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
                            <span style={{ fontSize: 12, color: R.text }}>{hotel.strategy === "sell_every_room" ? "Sell Every Room" : "Maintain"}</span>
                            <ChevronDown size={10} color={R.textDim} />
                          </div>
                        )},
                        { label: "Max Rates", sub: "Daily ceilings", right: <span style={{ fontSize: 12, color: R.teal, cursor: "pointer", fontWeight: 500 }}>Edit Calendar</span> },
                        { label: "Freeze Period", sub: null, right: <span style={{ fontSize: 14, fontWeight: 600, color: R.accent, fontVariantNumeric: "tabular-nums" }}>{hotel.freeze}d</span> },
                        { label: "Global Max", sub: "Fallback ceiling", right: <span style={{ fontSize: 14, fontWeight: 600, color: R.accent, fontVariantNumeric: "tabular-nums" }}>£{hotel.max}</span> },
                      ].map(cell => (
                        <div key={cell.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", height: 50, background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, color: R.accent }}>{cell.label}</div>
                            {cell.sub && <div style={{ fontSize: 10, color: R.textDim, marginTop: 1 }}>{cell.sub}</div>}
                          </div>
                          {cell.right}
                        </div>
                      ))}
                    </div>

                    {/* ── Seasonality ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase", marginBottom: 12 }}>Seasonality Strategy</div>
                      <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                          {MONTHS.map(m => {
                            const tier = SEASON_MAP[m];
                            const tc = tier === "HIGH" ? R.red : tier === "MID" ? R.gold : R.teal;
                            return (
                              <button key={m} style={{ background: `${tc}08`, border: `1px solid ${tc}15`, borderRadius: 5, padding: "8px 0", textAlign: "center", cursor: "pointer" }}>
                                <div style={{ fontSize: 9, color: R.textMid, letterSpacing: 0.5 }}>{m.slice(0, 3)}</div>
                                <div style={{ fontSize: 9, color: tc, marginTop: 3, fontWeight: 500 }}>{tier}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 20, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${R.sep}`, justifyContent: "center" }}>
                          {[{ l: "Low (Pressure)", c: R.teal }, { l: "Mid (Guide)", c: R.gold }, { l: "High (Trap)", c: R.red }].map(x => (
                            <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: R.textDim }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: `${x.c}30` }} />{x.l}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* ── Last-Minute Floor ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase" }}>Last-Minute Floor Rate</div>
                          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>Override min rate close to arrival</div>
                        </div>
                        <Toggle on={hotel.lmf.enabled} />
                      </div>
                      {hotel.lmf.enabled && (
                        <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: 14 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div>
                              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Floor Rate</div>
                              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, padding: "7px 12px", fontSize: 14, fontWeight: 600, color: R.accent, fontVariantNumeric: "tabular-nums" }}>£{hotel.lmf.rate}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Activate Within</div>
                              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, padding: "7px 12px", fontSize: 14, fontWeight: 600, color: R.accent, fontVariantNumeric: "tabular-nums" }}>{hotel.lmf.days} days</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Active Days</div>
                          <div style={{ display: "flex", gap: 4 }}>
                            {DOWS.map(d => {
                              const active = hotel.lmf.dow.includes(d.k);
                              return (
                                <div key={d.k} style={{
                                  flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 4, fontSize: 11, cursor: "pointer",
                                  background: active ? "rgba(255,255,255,0.06)" : R.card,
                                  border: `1px solid ${active ? "rgba(255,255,255,0.10)" : R.border}`,
                                  color: active ? R.accent : R.textDim, fontWeight: active ? 500 : 400,
                                }}>{d.l}</div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Room Differentials ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div onClick={() => setDiffsOpen(!diffsOpen)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: diffsOpen ? 12 : 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase" }}>Room Type Differentials</div>
                        {diffsOpen ? <ChevronUp size={12} color={R.textDim} /> : <ChevronDown size={12} color={R.textDim} />}
                      </div>
                      {diffsOpen && (
                        <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                                <th style={th}>Room Type</th>
                                <th style={thR}>Differential</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hotel.rooms.map((rt, i) => (
                                <tr key={rt.name} style={{ borderBottom: i < hotel.rooms.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                                  <td style={{ padding: "9px 16px", fontSize: 12, color: R.text }}>
                                    {rt.name}
                                    {rt.isBase && <span style={{ fontSize: 9, color: R.warmTeal, marginLeft: 8, fontWeight: 600, letterSpacing: 0.5 }}>BASE</span>}
                                  </td>
                                  <td style={{ padding: "9px 16px", fontSize: 12, color: rt.isBase ? R.textDim : R.accent, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: rt.isBase ? 400 : 600 }}>
                                    {rt.isBase ? "—" : `${rt.op}${rt.diff}%`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* ── Pace Curves ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase" }}>Pace Curves</div>
                        <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${R.border}`, background: R.card, color: R.text, fontSize: 11, cursor: "pointer" }}>
                          <Download size={11} /> {rd.curves ? "Replace" : "Import"}
                        </button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {["Low", "Mid", "High"].map(tier => (
                          <div key={tier} style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: "12px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 500, color: R.text }}>{tier} Season</span>
                              <span style={{ fontSize: 9, color: R.textDim }}>365 pts</span>
                            </div>
                            <svg viewBox="0 0 100 24" style={{ width: "100%", height: 24, display: "block" }}>
                              <path d={`M0,22 ${Array.from({ length: 20 }, (_, i) => `L${i * 5},${22 - Math.round(Math.pow(i / 19, 1.5) * 20)}`).join(" ")}`} fill="none" stroke={R.warmTeal} strokeWidth="1.5" opacity="0.5" />
                            </svg>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Monthly Min Rates ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase", marginBottom: 12 }}>Monthly Min Rates</div>
                      <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                          {MONTHS.map((m, i) => {
                            const rate = hotel.minBase + Math.round(Math.sin(i * 0.5) * 12 + (i > 3 && i < 9 ? 20 : 0));
                            return (
                              <div key={m} style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: R.textDim, marginBottom: 3 }}>{m.slice(0, 3)}</div>
                                <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 4, padding: "5px 2px", fontSize: 11, fontWeight: 500, color: R.accent, fontVariantNumeric: "tabular-nums" }}>£{rate}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* ── Rate Corridor ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase", marginBottom: 12 }}>Rate Corridor</div>
                      <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: 14 }}>
                        <svg viewBox="0 0 365 60" style={{ width: "100%", height: 60, display: "block" }} preserveAspectRatio="none">
                          <path d={`M0,15 ${Array.from({ length: 365 }, (_, i) => {
                            const m = Math.floor(i / 30.4);
                            const maxVal = hotel.max - Math.round(Math.sin(m * 0.5) * 40 + (m > 3 && m < 9 ? -30 : 10));
                            const y = 60 - ((maxVal - 50) / (hotel.max + 50 - 50)) * 60;
                            return `L${i},${Math.max(2, Math.min(58, y))}`;
                          }).join(" ")} L365,45 ${Array.from({ length: 365 }, (_, i) => {
                            const idx = 364 - i;
                            const m = Math.floor(idx / 30.4);
                            const minVal = hotel.minBase + Math.round(Math.sin(m * 0.5) * 12 + (m > 3 && m < 9 ? 20 : 0));
                            const y = 60 - ((minVal - 50) / (hotel.max + 50 - 50)) * 60;
                            return `L${idx},${Math.max(2, Math.min(58, y))}`;
                          }).join(" ")} Z`} fill={`${R.warmTeal}06`} stroke="none" />
                          <path d={`M0,15 ${Array.from({ length: 365 }, (_, i) => {
                            const m = Math.floor(i / 30.4);
                            const maxVal = hotel.max - Math.round(Math.sin(m * 0.5) * 40 + (m > 3 && m < 9 ? -30 : 10));
                            const y = 60 - ((maxVal - 50) / (hotel.max + 50 - 50)) * 60;
                            return `L${i},${Math.max(2, Math.min(58, y))}`;
                          }).join(" ")}`} fill="none" stroke={R.gold} strokeWidth="0.8" opacity="0.5" />
                          <path d={`M0,45 ${Array.from({ length: 365 }, (_, i) => {
                            const m = Math.floor(i / 30.4);
                            const minVal = hotel.minBase + Math.round(Math.sin(m * 0.5) * 12 + (m > 3 && m < 9 ? 20 : 0));
                            const y = 60 - ((minVal - 50) / (hotel.max + 50 - 50)) * 60;
                            return `L${i},${Math.max(2, Math.min(58, y))}`;
                          }).join(" ")}`} fill="none" stroke={R.warmTeal} strokeWidth="0.8" opacity="0.5" />
                        </svg>
                        <div style={{ display: "flex", gap: 16, fontSize: 10, marginTop: 6 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 2, background: R.gold, borderRadius: 1, opacity: 0.5 }} /><span style={{ color: R.textDim }}>Max (Ceiling)</span></span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 2, background: R.warmTeal, borderRadius: 1, opacity: 0.5 }} /><span style={{ color: R.textDim }}>Min (Floor)</span></span>
                        </div>
                      </div>
                    </div>

                    {/* ── OTA Discount Stack ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase", marginBottom: 12 }}>OTA Discount Stack</div>
                      <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <tbody>
                            {[
                              { label: "Strategic Multiplier", value: `${PROMO.multiplier.toFixed(2)}×` },
                              { label: "Non-Refundable Discount", value: `${PROMO.nonRef}%` },
                              { label: "Genius Discount", value: `${PROMO.genius}%` },
                              { label: "Long Campaign", value: `${PROMO.campaign}%` },
                              { label: "Targeting Discount", value: `${PROMO.targeting}%` },
                              { label: "Deep Deal (Override)", value: PROMO.deepDeal > 0 ? `${PROMO.deepDeal}%` : "Off" },
                            ].map((p, i, arr) => (
                              <tr key={p.label} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                                <td style={{ padding: "9px 16px", fontSize: 12, color: R.text }}>{p.label}</td>
                                <td style={{ padding: "9px 16px", fontSize: 12, fontWeight: 500, color: R.accent, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.value}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: `1px solid ${R.border}` }}>
                              <td style={{ padding: "10px 16px", fontSize: 11, color: R.textDim }}>Simulated Sell Rate (Base £{hotel.minBase + 20})</td>
                              <td style={{ padding: "10px 16px", fontSize: 15, fontWeight: 600, color: R.warmTeal, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                £{Math.round((hotel.minBase + 20) * PROMO.multiplier * (1 - PROMO.nonRef/100) * (1 - PROMO.genius/100) * (1 - PROMO.campaign/100) * (1 - PROMO.targeting/100))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* ── Admin Controls ── */}
                    <div style={{ padding: "18px 0", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase", marginBottom: 12 }}>Admin Controls</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {["Sync with PMS", "Re-Push Rates", "Force Sync", "Export Res"].map(label => (
                          <button key={label} style={{ padding: "7px 14px", borderRadius: 6, border: `1px solid ${R.border}`, background: R.card, color: R.text, fontSize: 11, cursor: "pointer" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Save ── */}
                    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 18 }}>
                      <button style={{ padding: "8px 24px", borderRadius: 6, border: "none", background: R.warmTeal, color: R.sidebar, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ═══ 4. WEBHOOK MANAGEMENT ═══ */}
        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, marginTop: 16, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", gap: 10 }}>
            <Shield size={14} color={R.textMid} />
            <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>PMS Webhook Management</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                <th style={th}>Property</th>
                <th style={th}>Status</th>
                <th style={thR}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {WEBHOOKS.map((wh, i) => (
                <tr key={wh.name} style={{ borderBottom: i < WEBHOOKS.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                  <td style={{ padding: "9px 16px", fontSize: 12, color: R.accent }}>{wh.name}</td>
                  <td style={{ padding: "9px 16px" }}>
                    <span style={{ fontSize: 10, color: wh.ok ? R.green : R.red }}>{wh.ok ? "Active" : "Error"}</span>
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 3, background: wh.ok ? R.green : R.red, marginLeft: 6, verticalAlign: "middle", opacity: 0.7 }} />
                  </td>
                  <td style={{ padding: "9px 16px", textAlign: "right" }}>
                    <span style={{ fontSize: 11, color: R.teal, cursor: "pointer", marginRight: 12 }}>Register</span>
                    <span style={{ fontSize: 11, color: R.teal, cursor: "pointer" }}>Test</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
