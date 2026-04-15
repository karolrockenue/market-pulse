import { useMemo, useState } from "react";
import { Trophy, Zap, Target, TrendingUp, TrendingDown, Bell, Search, ChevronDown, Building2, CalendarDays } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── MP Compset Intel V2 — with date pickers ──

interface MPCompsetViewV2Props { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444", amber: "#f59e0b", purple: "#8b5cf6",
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

function DatePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  // Generate 42 days for a calendar grid
  const parsed = new Date(value + "T12:00:00");
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthLabel = parsed.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const days: { day: number; current: boolean; date: string }[] = [];
  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    days.push({ day: d, current: false, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, current: true, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  // Next month fill
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    days.push({ day: d, current: false, date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }

  const navMonth = (dir: number) => {
    const d = new Date(year, month + dir, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const displayValue = parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
          background: R.cardRaised, border: `1px solid ${open ? `${R.teal}40` : R.border}`,
          borderRadius: 6, cursor: "pointer", transition: "border-color 0.15s", width: 260,
        }}
      >
        <CalendarDays size={13} color={R.textDim} />
        <span style={{ fontSize: 12, color: R.accent }}>{displayValue}</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 6,
          background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8,
          padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", width: 260,
        }}>
          {/* Month nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button onClick={() => navMonth(-1)} style={{ background: "none", border: "none", color: R.textMid, cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>{monthLabel}</span>
            <button onClick={() => navMonth(1)} style={{ background: "none", border: "none", color: R.textMid, cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>›</button>
          </div>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
              <div key={d} style={{ fontSize: 9, color: R.textDim, textAlign: "center", padding: 4, textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {days.map((d, i) => {
              const isSelected = d.date === value;
              const isToday = d.date === new Date().toISOString().split("T")[0];
              return (
                <button
                  key={i}
                  onClick={() => { onChange(d.date); setOpen(false); }}
                  style={{
                    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, borderRadius: 4, border: "none", cursor: "pointer",
                    background: isSelected ? R.teal : "transparent",
                    color: isSelected ? R.darkBand : d.current ? R.accent : R.textDim,
                    fontWeight: isSelected || isToday ? 600 : 400,
                    outline: isToday && !isSelected ? `1px solid ${R.teal}50` : "none",
                  }}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function MPCompsetViewV2({ activeView, onNavigate }: MPCompsetViewV2Props) {
  const [startDate, setStartDate] = useState("2026-04-14");
  const [endDate, setEndDate] = useState("2026-05-14");

  // 30 days of mock performance data
  const chartData = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 3, 14 + i);
    const dow = d.getDay();
    const isWknd = dow === 5 || dow === 6;
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      myOcc: Math.min(98, Math.round(72 + (isWknd ? 16 : 0) + Math.sin(i * 0.5) * 8)),
      compOcc: Math.min(95, Math.round(64 + (isWknd ? 14 : 0) + Math.sin(i * 0.5) * 6)),
      myADR: Math.round(148 + (isWknd ? 28 : 0) + Math.sin(i * 0.4) * 12),
      compADR: Math.round(132 + (isWknd ? 22 : 0) + Math.sin(i * 0.4) * 10),
      myRevPAR: Math.round((148 + (isWknd ? 28 : 0)) * (72 + (isWknd ? 16 : 0)) / 100),
      compRevPAR: Math.round((132 + (isWknd ? 22 : 0)) * (64 + (isWknd ? 14 : 0)) / 100),
    };
  }), []);

  const dailyData = useMemo(() => chartData.map(row => ({
    date: row.date, myOcc: row.myOcc, compOcc: row.compOcc, myRate: row.myADR, compRate: row.compADR,
  })), [chartData]);

  const portfolio = [
    { name: "The W14 Hotel", cat: "3★", myOcc: 84, segOcc: 68, myAdr: 152, segAdr: 136, rank: 3, total: 42 },
    { name: "Jubilee Hotel Victoria", cat: "3★", myOcc: 78, segOcc: 68, myAdr: 138, segAdr: 136, rank: 8, total: 42 },
    { name: "The Melita", cat: "3★", myOcc: 81, segOcc: 68, myAdr: 145, segAdr: 136, rank: 5, total: 42 },
    { name: "Elysee Hyde Park", cat: "3★", myOcc: 76, segOcc: 68, myAdr: 162, segAdr: 136, rank: 2, total: 42 },
    { name: "Camden Suites", cat: "3★", myOcc: 72, segOcc: 68, myAdr: 128, segAdr: 136, rank: 14, total: 42 },
  ];

  const rankColor = (rank: number, total: number) => {
    const pct = rank / total;
    if (pct <= 0.33) return { bg: "rgba(52,208,104,0.1)", color: R.green, border: `1px solid rgba(52,208,104,0.3)` };
    if (pct <= 0.66) return { bg: "rgba(245,158,11,0.1)", color: R.amber, border: `1px solid rgba(245,158,11,0.3)` };
    return { bg: "rgba(239,68,68,0.1)", color: R.red, border: `1px solid rgba(239,68,68,0.3)` };
  };

  const neighbourhoods = [
    { area: "Victoria / Pimlico", count: 18 },
    { area: "Paddington / Bayswater", count: 14 },
    { area: "Earl's Court / Kensington", count: 11 },
    { area: "King's Cross / Bloomsbury", count: 9 },
    { area: "Whitechapel / Aldgate", count: 7 },
  ];

  return (
    <div style={{ background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>The W14 Hotel</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: R.textMid }}>My Segment</span>
              <ChevronDown size={12} color={R.textDim} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Search size={16} color={R.textMid} style={{ cursor: "pointer" }} />
            <Bell size={16} color={R.textMid} style={{ cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ padding: "28px 32px" }}>
          {/* Header + Date Pickers */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Target size={22} color={R.teal} />
                  <h1 style={{ fontSize: 22, fontWeight: 400, color: R.accent, margin: 0, letterSpacing: -0.5 }}>Compset Intelligence</h1>
                </div>
                <p style={{ fontSize: 13, color: R.gold, margin: 0 }}>Your hotel vs competitive set — occupancy, ADR, RevPAR rankings and trends</p>
              </div>
              {/* Date Range Pickers */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <DatePicker label="From" value={startDate} onChange={setStartDate} />
                <div style={{ fontSize: 12, color: R.textDim, paddingBottom: 10 }}>→</div>
                <DatePicker label="To" value={endDate} onChange={setEndDate} />
                <button style={{
                  padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: R.teal, color: R.darkBand, fontSize: 12, fontWeight: 600,
                  height: 32, marginBottom: 0,
                }}>
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Portfolio Summary */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={14} color={R.gold} />
              <span style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Portfolio Competitive Summary</span>
              <span style={{ fontSize: 11, color: R.textDim, marginLeft: "auto" }}>{portfolio.length} properties</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                  {["Property", "Cat", "My Occ", "Seg Occ", "My ADR", "Seg ADR", "Rank"].map(h => (
                    <th key={h} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: R.textDim, textTransform: "uppercase", textAlign: h === "Property" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.map((p, i) => {
                  const rc = rankColor(p.rank, p.total);
                  return (
                    <tr key={i} style={{ borderBottom: i < portfolio.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: R.accent, fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: "10px 16px", fontSize: 11, color: R.textDim, textAlign: "right" }}>{p.cat}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: p.myOcc > p.segOcc ? R.green : R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.myOcc}%</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: R.textMid, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.segOcc}%</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: R.accent, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{curr}{p.myAdr}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: R.textMid, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{curr}{p.segAdr}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, backgroundColor: rc.bg, color: rc.color, border: rc.border }}>#{p.rank}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Scorecard Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
            {[
              { label: "Occupancy", my: "84%", comp: "68%", rank: 3, total: 42, color: R.teal },
              { label: "ADR", my: `${curr}152`, comp: `${curr}136`, rank: 5, total: 42, color: R.teal },
              { label: "RevPAR", my: `${curr}128`, comp: `${curr}92`, rank: 4, total: 42, color: R.teal },
            ].map(kpi => {
              const rc = rankColor(kpi.rank, kpi.total);
              return (
                <div key={kpi.label} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "16px 18px", position: "relative" }}>
                  <div style={{ position: "absolute", top: 12, right: 12, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, backgroundColor: rc.bg, color: rc.color, border: rc.border }}>#{kpi.rank}</div>
                  <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>{kpi.label}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color }}>{kpi.my}</div>
                      <div style={{ fontSize: 10, color: R.textDim, marginTop: 4 }}>My Hotel</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 600, color: R.textMid }}>{kpi.comp}</div>
                      <div style={{ fontSize: 10, color: R.textDim, marginTop: 4 }}>Segment Avg</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Sentinel Insight */}
            <div style={{ border: `1px solid rgba(56,198,186,0.3)`, borderRadius: 8, padding: "16px 18px", background: "linear-gradient(135deg, rgba(56,198,186,0.08), rgba(200,166,110,0.06))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Zap size={14} color={R.teal} />
                <span style={{ fontSize: 11, fontWeight: 600, color: R.teal, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sentinel Insight</span>
              </div>
              <div style={{ fontSize: 13, color: R.text, lineHeight: 1.65 }}>
                Your occupancy is <span style={{ color: R.green, fontWeight: 600 }}>16pts above</span> the segment average. Compset ADR is <span style={{ color: R.teal, fontWeight: 600 }}>{curr}16 lower</span> — room to hold firm on pricing.
              </div>
            </div>
          </div>

          {/* Main Content: Chart + Insights */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 20 }}>
            <div>
              {/* Performance Chart */}
              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Performance vs Market</div>
                    <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>Your hotel compared against segment average</div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <Leg color={R.teal} label="My Occupancy" />
                    <Leg color={R.teal} label="Segment Occ" dashed />
                    <Leg color={R.gold} label="My ADR" />
                    <Leg color={R.gold} label="Segment ADR" dashed />
                  </div>
                </div>
                <div style={{ padding: "12px 20px 16px", height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.5} />
                      <XAxis dataKey="date" stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} tickLine={{ stroke: R.border }} interval={6} />
                      <YAxis stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} tickLine={{ stroke: R.border }} />
                      <Tooltip contentStyle={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: "10px 14px" }} labelStyle={{ color: R.textMid, fontSize: 11 }} itemStyle={{ fontSize: 12, color: R.accent }} />
                      <Line type="monotone" dataKey="myOcc" name="My Occupancy" stroke={R.teal} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compOcc" name="Segment Occ" stroke={R.teal} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                      <Line type="monotone" dataKey="myADR" name="My ADR" stroke={R.gold} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compADR" name="Segment ADR" stroke={R.gold} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Daily Drill-Down */}
              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Daily Drill-Down</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                      {["Date", "My Occ", "Seg Occ", "Δ", "My ADR", "Seg ADR", "Δ"].map((h, i) => (
                        <th key={`${h}-${i}`} style={{ padding: "8px 14px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: R.textDim, textTransform: "uppercase", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.slice(0, 10).map((row, i) => {
                      const occDelta = row.myOcc - row.compOcc;
                      const adrDelta = row.myRate - row.compRate;
                      return (
                        <tr key={i} style={{ borderBottom: i < 9 ? `1px solid ${R.sep}` : "none" }}>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: R.accent }}>{row.date}</td>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.myOcc}%</td>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: R.textMid, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.compOcc}%</td>
                          <td style={{ padding: "8px 14px", fontSize: 11, color: occDelta > 0 ? R.green : R.red, textAlign: "right", fontWeight: 600 }}>{occDelta > 0 ? "+" : ""}{occDelta}</td>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{curr}{row.myRate}</td>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: R.textMid, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{curr}{row.compRate}</td>
                          <td style={{ padding: "8px 14px", fontSize: 11, color: adrDelta > 0 ? R.green : R.red, textAlign: "right", fontWeight: 600 }}>{adrDelta > 0 ? "+" : ""}{curr}{adrDelta}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right — Insights Sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Key Insights */}
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>Key Insights</div>
              {[
                { label: "Occupancy", value: "+16 pts", desc: "above segment average", winning: true },
                { label: "ADR", value: "£16", desc: "above segment average", winning: true },
                { label: "RevPAR", value: "£36", desc: "above segment average", winning: true },
              ].map(item => {
                const accent = item.winning ? R.teal : R.gold;
                const Icon = item.winning ? TrendingUp : TrendingDown;
                return (
                  <div key={item.label} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "18px 18px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Icon size={15} color={accent} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>{item.label}</span>
                    </div>
                    <p style={{ fontSize: 12, color: R.textMid, margin: 0, lineHeight: 1.5 }}>
                      <span style={{ color: accent, fontWeight: 600 }}>{item.value}</span> {item.desc}
                    </p>
                  </div>
                );
              })}

              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "18px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 14 }}>Market Context</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Segment Hotels", value: "42" },
                    { label: "Segment Rooms", value: "1,866" },
                    { label: "Market Hotels", value: "318" },
                    { label: "Market Rooms", value: "14,200" },
                  ].map(m => (
                    <div key={m.label}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "18px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 14 }}>Tier Distribution</div>
                {[
                  { tier: "5★", count: 12, pct: 4 },
                  { tier: "4★", count: 68, pct: 21 },
                  { tier: "3★", count: 142, pct: 45 },
                  { tier: "2★", count: 64, pct: 20 },
                  { tier: "1★", count: 32, pct: 10 },
                ].map(t => (
                  <div key={t.tier} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, fontSize: 11, color: R.textMid, fontWeight: 500 }}>{t.tier}</div>
                    <div style={{ flex: 1, height: 6, background: R.darkBand, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${t.pct}%`, background: R.teal, borderRadius: 3, opacity: 0.5 }} />
                    </div>
                    <div style={{ width: 28, fontSize: 10, color: R.textDim, textAlign: "right" }}>{t.count}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "18px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 14 }}>Neighbourhoods</div>
                {neighbourhoods.map((n, i) => (
                  <div key={n.area} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < neighbourhoods.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                    <span style={{ fontSize: 12, color: R.text }}>{n.area}</span>
                    <span style={{ fontSize: 12, color: R.textMid, fontVariantNumeric: "tabular-nums" }}>{n.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
