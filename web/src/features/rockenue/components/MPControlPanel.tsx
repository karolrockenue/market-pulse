import { useState } from "react";
import { Zap, ChevronDown, Shield, Activity, Target, Clock, Layers, Settings, Calendar, TrendingUp, Sliders, BarChart3, Play, RefreshCw, Tag } from "lucide-react";
import { MPSidebar } from "./MPSidebar";

interface MPControlPanelProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", surface: "#121519", recessed: "#0C0E12",
  border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  blue: "#39BDF8", gold: "#C8A66E", green: "#10b981", red: "#ef4444",
  amber: "#f59e0b", purple: "#8b5cf6", orange: "#f97316",
};

function Badge({ label, color, glow }: { label: string; color: string; glow?: boolean }) {
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 4, whiteSpace: "nowrap", background: `${color}15`, color, border: `1px solid ${color}30`, boxShadow: glow ? `0 0 10px ${color}40` : "none" }}>{label}</span>;
}

function Toggle({ on, color }: { on: boolean; color?: string }) {
  const c = color || R.blue;
  return <div style={{ width: 36, height: 20, borderRadius: 10, background: on ? c : R.textDim, padding: 2, cursor: "pointer" }}><div style={{ width: 16, height: 16, borderRadius: 8, background: R.accent, transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 0.15s" }} /></div>;
}

function Dot({ ok }: { ok: boolean }) {
  return <div style={{ width: 7, height: 7, borderRadius: 4, background: ok ? R.green : R.textDim, opacity: 0.7 }} />;
}

function SettingCell({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56, background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 8 }}>
      <div>
        <div style={{ fontSize: 13, color: R.accent }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: R.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub, icon: Icon }: { title: string; sub?: string; icon?: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      {Icon && <Icon size={13} color={R.blue} />}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: R.accent }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: R.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

const HOTELS = [
  { id: 315428, name: "Vilenza Hotel", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 2, max: 320, lmf: { enabled: true, rate: 79, days: 3, dow: ["mon","tue","wed","thu","sun"] }, rooms: [{ name: "Standard Double", isBase: true, diff: 0 }, { name: "Superior Twin", isBase: false, diff: 15 }, { name: "Double Deluxe", isBase: false, diff: 25 }, { name: "Triple Room", isBase: false, diff: 20 }, { name: "Junior Suite", isBase: false, diff: 45 }], minBase: 89 },
  { id: 289618, name: "The Cleveland Hotel", enabled: true, autopilot: true, strategy: "sell_every_room" as const, freeze: 1, max: 280, lmf: { enabled: true, rate: 69, days: 3, dow: ["mon","tue","wed","thu","fri","sat","sun"] }, rooms: [{ name: "Standard Room", isBase: true, diff: 0 }, { name: "Twin Room", isBase: false, diff: 10 }, { name: "Triple Room", isBase: false, diff: 18 }, { name: "Family Room", isBase: false, diff: 30 }], minBase: 79 },
  { id: 315433, name: "The Whitechapel Hotel", enabled: true, autopilot: false, strategy: "maintain" as const, freeze: 2, max: 400, lmf: { enabled: false, rate: 0, days: 0, dow: [] }, rooms: [{ name: "Compact Double", isBase: true, diff: 0 }, { name: "Standard Double", isBase: false, diff: 12 }, { name: "Superior Double", isBase: false, diff: 22 }, { name: "Twin Room", isBase: false, diff: 15 }, { name: "Triple Room", isBase: false, diff: 25 }, { name: "Quad Room", isBase: false, diff: 35 }], minBase: 95 },
  { id: 308760, name: "The Melita", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 2, max: 350, lmf: { enabled: true, rate: 85, days: 5, dow: ["mon","tue","wed","thu"] }, rooms: [{ name: "Standard Double", isBase: true, diff: 0 }, { name: "Superior Room", isBase: false, diff: 18 }, { name: "Deluxe Room", isBase: false, diff: 32 }, { name: "Jacuzzi Suite", isBase: false, diff: 65 }], minBase: 99 },
  { id: 315473, name: "Elysee Hyde Park", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 3, max: 380, lmf: { enabled: true, rate: 95, days: 3, dow: ["sun","mon","tue","wed","thu"] }, rooms: [{ name: "Economy Single", isBase: true, diff: 0 }, { name: "Standard Double", isBase: false, diff: 20 }, { name: "Twin Room", isBase: false, diff: 18 }, { name: "Superior Double", isBase: false, diff: 35 }, { name: "Family Room", isBase: false, diff: 42 }], minBase: 109 },
  { id: 230719, name: "Jubilee Hotel Victoria", enabled: true, autopilot: false, strategy: "maintain" as const, freeze: 2, max: 300, lmf: { enabled: false, rate: 0, days: 0, dow: [] }, rooms: [{ name: "Standard Double", isBase: true, diff: 0 }, { name: "Twin Room", isBase: false, diff: 12 }, { name: "Triple Room", isBase: false, diff: 22 }], minBase: 85 },
  { id: 315429, name: "Camden Suites", enabled: false, autopilot: false, strategy: "maintain" as const, freeze: 2, max: 250, lmf: { enabled: false, rate: 0, days: 0, dow: [] }, rooms: [{ name: "Studio Apartment", isBase: true, diff: 0 }, { name: "One-Bed Apartment", isBase: false, diff: 28 }, { name: "Two-Bed Apartment", isBase: false, diff: 55 }], minBase: 75 },
  { id: 2400, name: "Astor Victoria", enabled: true, autopilot: true, strategy: "maintain" as const, freeze: 2, max: 340, lmf: { enabled: true, rate: 82, days: 3, dow: ["mon","tue","wed","thu","sun"] }, rooms: [{ name: "Standard Single", isBase: true, diff: 0 }, { name: "Standard Double", isBase: false, diff: 15 }, { name: "Twin Room", isBase: false, diff: 15 }, { name: "Triple Room", isBase: false, diff: 28 }], minBase: 92 },
];

const READINESS = ["Max Rates", "Pace Curves", "Differentials", "Seasonality", "Min Rates"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SEASON: Record<string,string> = { Jan:"LOW", Feb:"LOW", Mar:"MID", Apr:"MID", May:"HIGH", Jun:"HIGH", Jul:"HIGH", Aug:"HIGH", Sep:"MID", Oct:"MID", Nov:"LOW", Dec:"MID" };
const tierColor = (t: string) => t === "HIGH" ? R.red : t === "MID" ? R.amber : R.blue;
const DOWS = [{ k: "mon", l: "M" },{ k: "tue", l: "T" },{ k: "wed", l: "W" },{ k: "thu", l: "T" },{ k: "fri", l: "F" },{ k: "sat", l: "S" },{ k: "sun", l: "S" }];

// OTA Promo config mock
const PROMO = { multiplier: 1.00, nonRef: 10, genius: 15, campaign: 8, targeting: 5, deepDeal: 0 };

export function MPControlPanel({ activeView, onNavigate }: MPControlPanelProps) {
  const [expandedHotel, setExpandedHotel] = useState<number | null>(315428);

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: "flex" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "20px 36px", borderBottom: `1px solid ${R.border}` }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.8 }}>Sentinel Control Panel</h1>
          <p style={{ fontSize: 13, color: R.textDim, margin: "4px 0 0" }}>AI pricing configuration across {HOTELS.length} properties</p>
        </div>

        <div style={{ padding: "24px 36px" }}>

          {/* ── Market Strategy Card ── */}
          <div style={{ background: R.surface, border: `1px solid ${R.blue}20`, borderRadius: 10, padding: "24px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${R.blue}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Calendar size={18} color={R.blue} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, textTransform: "uppercase", letterSpacing: -0.3 }}>Market Strategy & Vitals</div>
                <div style={{ fontSize: 12, color: R.textDim, marginTop: 2 }}>Global market defaults applied to all properties unless overridden</div>
              </div>
            </div>

            {/* Market tab */}
            <div style={{ display: "inline-flex", padding: 3, background: R.recessed, borderRadius: 6, border: `1px solid ${R.border}`, marginBottom: 20 }}>
              <div style={{ padding: "5px 16px", fontSize: 11, borderRadius: 4, background: R.blue, color: R.recessed, fontWeight: 600 }}>London</div>
            </div>

            {/* Events Table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: R.accent }}>Manual Events</span>
                <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: `1px solid ${R.border}`, background: R.recessed, color: R.accent, fontSize: 11, cursor: "pointer" }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add Event
                </button>
              </div>
              <div style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 120px 80px", gap: 0, padding: "8px 16px", borderBottom: `1px solid ${R.sep}` }}>
                  {["Date", "Event Name", "Impact", "Actions"].map((h, i) => (
                    <span key={h} style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, textAlign: i === 3 ? "right" : "left" }}>{h}</span>
                  ))}
                </div>
                {[
                  { date: "30 Jun - 13 Jul", name: "Wimbledon 2026", impact: "Extreme", impactColor: R.purple, mult: "2.5x", days: 14 },
                  { date: "3 - 12 Jul", name: "BST Hyde Park", impact: "High", impactColor: R.red, mult: "2.0x", days: 10 },
                  { date: "29 - 31 Aug", name: "Notting Hill Carnival", impact: "High", impactColor: R.red, mult: "2.0x", days: 3 },
                  { date: "20 - 24 May", name: "Chelsea Flower Show", impact: "Medium", impactColor: R.blue, mult: "1.5x", days: 5 },
                  { date: "14 Jun", name: "Trooping the Colour", impact: "Medium", impactColor: R.blue, mult: "1.5x", days: 1 },
                ].map((ev, i) => (
                  <div key={ev.name} style={{ display: "grid", gridTemplateColumns: "160px 1fr 120px 80px", gap: 0, padding: "10px 16px", borderBottom: i < 4 ? `1px solid ${R.sep}` : "none", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: R.accent }}>{ev.date}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: R.accent, fontWeight: 500 }}>{ev.name}</span>
                      {ev.days > 1 && <span style={{ fontSize: 9, color: R.textDim }}>{ev.days} days</span>}
                    </div>
                    <Badge label={`${ev.impact} ${ev.mult}`} color={ev.impactColor} />
                    <span style={{ fontSize: 11, color: R.textDim, textAlign: "right", cursor: "pointer" }}>Edit</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vitals */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: R.accent, display: "block", marginBottom: 12 }}>Vitals</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { label: "Portfolio Hotels", value: "8", color: R.blue },
                  { label: "Autopilot Active", value: "5", color: R.red },
                  { label: "Sentinel Enabled", value: "7", color: R.green },
                  { label: "Avg Freeze", value: "2.1d", color: R.amber },
                ].map(v => (
                  <div key={v.label} style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 6, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{v.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: v.color, letterSpacing: -0.5 }}>{v.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Hotel Accordion Rows ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {HOTELS.map(hotel => {
              const isOpen = expandedHotel === hotel.id;
              const ready = hotel.enabled ? READINESS.length : Math.max(0, READINESS.length - 2);
              return (
                <div key={hotel.id} style={{ background: R.surface, borderRadius: 8, overflow: "hidden", borderLeft: `3px solid ${hotel.enabled ? `${R.green}60` : `${R.amber}40`}`, border: `1px solid ${isOpen ? `${R.blue}40` : R.border}`, borderLeftWidth: 3, borderLeftColor: hotel.enabled ? `${R.green}60` : `${R.amber}40` }}>

                  {/* ── Row Header ── */}
                  <div onClick={() => setExpandedHotel(isOpen ? null : hotel.id)} style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px 100px auto", gap: 16, alignItems: "center", padding: "14px 20px", cursor: "pointer", background: isOpen ? R.recessed : "transparent" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ChevronDown size={13} color={R.textDim} style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: R.accent }}>{hotel.name}</span>
                      <span style={{ fontSize: 10, color: R.textDim }}>({hotel.id})</span>
                    </div>
                    <Badge label={hotel.autopilot ? "AUTOPILOT ON" : "Autopilot Off"} color={hotel.autopilot ? R.red : R.textDim} glow={hotel.autopilot} />
                    <Badge label={hotel.strategy === "sell_every_room" ? "Sell Every Room" : "Maintain"} color={hotel.strategy === "sell_every_room" ? R.purple : R.amber} />
                    <Badge label={hotel.enabled ? "Active" : "Paused"} color={hotel.enabled ? R.green : R.textDim} />
                    <div style={{ display: "flex", gap: 4, borderLeft: `1px solid ${R.border}`, paddingLeft: 16 }}>
                      {READINESS.map((r, i) => <Dot key={r} ok={i < ready} />)}
                    </div>
                  </div>

                  {/* ── Expanded Content ── */}
                  {isOpen && (
                    <div style={{ padding: "0 20px 28px", borderTop: `1px solid ${R.sep}` }}>

                      {/* 1. Settings Grid (2x3) */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <SettingCell label="Sentinel AI"><Toggle on={hotel.enabled} /></SettingCell>
                        <SettingCell label="Sentinel Mode" sub={hotel.autopilot ? "Auto PMS push" : "Manual review"}><Toggle on={hotel.autopilot} color={hotel.autopilot ? R.green : undefined} /></SettingCell>
                        <SettingCell label="Yield Strategy">
                          <span style={{ fontSize: 12, fontWeight: 600, color: hotel.strategy === "sell_every_room" ? R.purple : R.amber }}>{hotel.strategy === "sell_every_room" ? "Sell Every Room" : "Maintain"}</span>
                        </SettingCell>
                        <SettingCell label="Max Rate" sub="Global ceiling"><span style={{ fontSize: 16, fontWeight: 700, color: R.accent, fontFamily: "monospace" }}>£{hotel.max}</span></SettingCell>
                        <SettingCell label="Freeze Period" sub="Days locked"><span style={{ fontSize: 16, fontWeight: 700, color: R.accent, fontFamily: "monospace" }}>{hotel.freeze}d</span></SettingCell>
                        <SettingCell label="Max Rates Calendar">
                          <span style={{ fontSize: 12, color: R.blue, cursor: "pointer" }}>Edit Daily Caps</span>
                        </SettingCell>
                      </div>

                      {/* 2. Seasonality */}
                      <div style={{ padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <SectionHeader title="Seasonality Strategy" icon={Activity} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                          {MONTHS.map(m => (
                            <div key={m} style={{ textAlign: "center", cursor: "pointer" }}>
                              <div style={{ fontSize: 9, color: R.textDim, marginBottom: 4 }}>{m}</div>
                              <div style={{ padding: "6px 0", borderRadius: 4, background: `${tierColor(SEASON[m])}12`, fontSize: 9, fontWeight: 600, color: tierColor(SEASON[m]), border: `1px solid ${tierColor(SEASON[m])}20` }}>{SEASON[m]}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10 }}>
                          {[{ l: "Low (Pressure)", c: R.blue }, { l: "Mid (Guide)", c: R.amber }, { l: "High (Trap)", c: R.red }].map(x => (
                            <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 1, background: x.c }} /><span style={{ color: R.textDim }}>{x.l}</span></span>
                          ))}
                        </div>
                      </div>

                      {/* 3. Last-Minute Floor */}
                      <div style={{ padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                          <SectionHeader title="Last-Minute Floor Rate" sub="Override min rate close to arrival" icon={Clock} />
                          <Toggle on={hotel.lmf.enabled} color={R.orange} />
                        </div>
                        {hotel.lmf.enabled && (
                          <div style={{ background: R.recessed, border: `1px solid ${R.orange}25`, borderRadius: 8, padding: 16 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                              <div>
                                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Floor Rate</div>
                                <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, color: R.accent, fontFamily: "monospace" }}>£{hotel.lmf.rate}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Activate Within</div>
                                <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, color: R.accent, fontFamily: "monospace" }}>{hotel.lmf.days} days</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Active Days</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {DOWS.map(d => {
                                const active = hotel.lmf.dow.includes(d.k);
                                return <div key={d.k} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer", background: active ? `${R.orange}20` : R.surface, border: `1px solid ${active ? `${R.orange}50` : R.border}`, color: active ? R.orange : R.textDim }}>{d.l}</div>;
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Room Differentials */}
                      <div style={{ padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <SectionHeader title="Room Type Differentials" sub="Derived rates from base room" icon={Layers} />
                        {hotel.rooms.map((rt, i) => (
                          <div key={rt.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < hotel.rooms.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13, color: R.text }}>{rt.name}</span>
                              {rt.isBase && <span style={{ fontSize: 8, fontWeight: 700, color: R.blue, padding: "1px 5px", background: `${R.blue}12`, borderRadius: 3 }}>BASE</span>}
                            </div>
                            {rt.isBase ? (
                              <span style={{ fontSize: 12, color: R.textDim }}>Base room type</span>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 4, padding: "4px 10px", fontSize: 13, fontWeight: 600, color: R.accent, fontFamily: "monospace", minWidth: 56, textAlign: "center" }}>+{rt.diff}%</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 5. Pace Curves */}
                      <div style={{ padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <SectionHeader title="Pace Curves" sub="365-day booking pace targets by season tier" icon={TrendingUp} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                          {[{ tier: "Low", color: R.blue }, { tier: "Mid", color: R.amber }, { tier: "High", color: R.red }].map(t => (
                            <div key={t.tier} style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.color }}>{t.tier} Season</span>
                                <span style={{ fontSize: 10, color: R.textDim }}>365 points</span>
                              </div>
                              {/* Mini curve preview */}
                              <svg viewBox="0 0 100 30" style={{ width: "100%", height: 30 }}>
                                <path d={`M0,28 ${Array.from({ length: 20 }, (_, i) => `L${i * 5},${28 - Math.round(Math.pow(i / 19, 1.5) * 26)}`).join(" ")}`} fill="none" stroke={t.color} strokeWidth="1.5" opacity="0.6" />
                              </svg>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 6. Monthly Min Rates */}
                      <div style={{ padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <SectionHeader title="Monthly Min Rates" sub="Floor rate per month" icon={Target} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4 }}>
                          {MONTHS.map((m, i) => {
                            const rate = hotel.minBase + Math.round(Math.sin(i * 0.5) * 12 + (i > 3 && i < 9 ? 20 : 0));
                            return (
                              <div key={m} style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 4, padding: "8px 2px", textAlign: "center" }}>
                                <div style={{ fontSize: 8, color: R.textDim, marginBottom: 3 }}>{m}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: R.accent, fontFamily: "monospace" }}>£{rate}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 7. OTA Discount Stack (Promo Config) */}
                      <div style={{ padding: "20px 0", borderBottom: `1px solid ${R.sep}` }}>
                        <SectionHeader title="OTA Discount Stack" sub="Rate Replicator — sequential discount waterfall" icon={Tag} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {[
                            { label: "Strategic Multiplier", value: `${PROMO.multiplier.toFixed(2)}x`, color: R.accent },
                            { label: "Non-Refundable Discount", value: `${PROMO.nonRef}%`, color: R.amber },
                            { label: "Genius Discount", value: `${PROMO.genius}%`, color: R.purple },
                            { label: "Long Campaign", value: `${PROMO.campaign}%`, color: R.blue },
                            { label: "Targeting Discount", value: `${PROMO.targeting}%`, color: R.green },
                          ].map(p => (
                            <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 6 }}>
                              <span style={{ fontSize: 12, color: R.text }}>{p.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: p.color, fontFamily: "monospace" }}>{p.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 8. Admin Controls */}
                      <div style={{ padding: "20px 0 0" }}>
                        <SectionHeader title="Admin Controls" icon={Settings} />
                        <div style={{ display: "flex", gap: 8 }}>
                          {[
                            { label: "Run Sentinel", icon: Play, color: R.blue },
                            { label: "Recalculate", icon: RefreshCw, color: R.amber },
                            { label: "Sync PMS", icon: Sliders, color: R.green },
                          ].map(btn => {
                            const Icon = btn.icon;
                            return (
                              <button key={btn.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, border: `1px solid ${btn.color}30`, background: `${btn.color}08`, color: btn.color, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                                <Icon size={13} /> {btn.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
