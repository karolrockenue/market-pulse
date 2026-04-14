import { useMemo } from "react";
import { BarChart3, FileText, Calendar, DollarSign, TrendingUp, Target, Wallet, ArrowUpDown, Bell, Search, ChevronDown, Download } from "lucide-react";
import { MPSidebar } from "./MPSidebar";

// ── MP Reports Hub — Rockenue style mockup ──
interface MPReportsHubProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#39BDF8", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
};

const fmt = (v: number) => `£${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const reportTypes = [
  { id: "performance", title: "Performance Metrics", desc: "Occupancy, ADR, RevPAR and market comparisons", icon: BarChart3, category: "Core Analytics", active: true },
  { id: "yoy", title: "Year-on-Year", desc: "Side-by-side comparison with variance analysis", icon: ArrowUpDown, category: "Core Analytics", active: true },
  { id: "bookings", title: "Bookings Report", desc: "Daily booking summary with guest details and sources", icon: Calendar, category: "Core Analytics", active: true },
  { id: "financial", title: "Financial Transactions", desc: "Revenue streams, payment methods, transaction analysis", icon: DollarSign, category: "Financial", active: true },
  { id: "takings", title: "Monthly Takings", desc: "Cash vs Accrual reconciliation for end-of-month", icon: Wallet, category: "Financial", active: true },
  { id: "forecast", title: "Forecast & Projections", desc: "Forward demand forecasting and rate recommendations", icon: TrendingUp, category: "Forecasting", active: false },
  { id: "events", title: "Events Impact", desc: "Event correlation with demand and pricing", icon: Calendar, category: "Market Intelligence", active: false },
  { id: "compset", title: "Competitive Positioning", desc: "Pricing and ranking against competitive set", icon: Target, category: "Market Intelligence", active: false },
];

export function MPReportsHub({ activeView, onNavigate }: MPReportsHubProps) {
  const sampleData = useMemo(() => {
    const days = [];
    for (let d = 1; d <= 14; d++) {
      const dow = (d + 1) % 7;
      const isWknd = dow >= 5;
      const occ = Math.min(98, Math.round(62 + (isWknd ? 22 : 0) + Math.sin(d * 0.6) * 10));
      const adr = Math.round(128 + (isWknd ? 35 : 0) + Math.sin(d * 0.4) * 15);
      const revpar = Math.round(adr * occ / 100);
      const revenue = Math.round(revpar * 42);
      days.push({ date: `${d} Apr`, dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dow], occ, adr, revpar, revenue });
    }
    return days;
  }, []);

  const categories = ["Core Analytics", "Financial", "Forecasting", "Market Intelligence"];

  return (
    <div style={{ display: "flex", height: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: R.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>The W14 Hotel</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} color={R.textDim} style={{ position: "absolute", left: 10 }} />
              <input style={{ background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 10px 6px 30px", fontSize: 12, color: R.text, outline: "none", width: 180 }} placeholder="Search reports..." />
            </div>
            <Bell size={16} color={R.textMid} style={{ cursor: "pointer" }} />
          </div>
        </div>

        <div style={{ padding: "32px" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Reports</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>Reports Hub</h1>
            <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>Select a report type to generate custom analysis</p>
          </div>

          {/* Report type cards by category */}
          {categories.map(cat => {
            const items = reportTypes.filter(r => r.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 12 }}>{cat}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
                  {items.map((r, i) => {
                    const Icon = r.icon;
                    const accent = i % 2 === 0 ? R.teal : R.gold;
                    return (
                      <div key={r.id} style={{
                        background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "18px 18px",
                        cursor: r.active ? "pointer" : "default", opacity: r.active ? 1 : 0.45,
                        transition: "border-color 0.15s",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <Icon size={15} color={accent} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>{r.title}</span>
                          {!r.active && <span style={{ fontSize: 9, color: R.textDim, background: R.bg, padding: "2px 8px", borderRadius: 4, fontWeight: 600, letterSpacing: 0.5 }}>COMING SOON</span>}
                        </div>
                        <p style={{ fontSize: 12, color: R.textMid, margin: 0, lineHeight: 1.5 }}>{r.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Sample report preview */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Preview</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: R.accent }}>Performance Metrics — April 2026</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: R.textMid }}>
                  Current Month <ChevronDown size={12} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: R.textMid }}>
                  Daily <ChevronDown size={12} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.teal, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, color: R.darkBand, fontWeight: 600 }}>
                  <Download size={12} /> Export
                </div>
              </div>
            </div>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Avg Occupancy", value: "76.4%", delta: "+4.2%" },
                { label: "Avg ADR", value: "£152", delta: "+8.1%" },
                { label: "Avg RevPAR", value: "£116", delta: "+12.8%" },
                { label: "Total Revenue", value: "£68,124", delta: "+11.3%" },
              ].map((kpi, i) => (
                <div key={kpi.label} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "16px 18px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 8 }}>{kpi.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: R.accent, letterSpacing: -0.5 }}>{kpi.value}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: R.green }}>{kpi.delta}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Data table */}
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                    {["Date", "", "Occ %", "ADR", "RevPAR", "Revenue"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", textAlign: h === "Date" || h === "" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < sampleData.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: R.accent, fontWeight: 500 }}>{row.date}</td>
                      <td style={{ padding: "9px 8px", fontSize: 11, color: R.textDim }}>{row.dow}</td>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: row.occ >= 85 ? R.green : R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.occ}%</td>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.adr)}</td>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.revpar)}</td>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: R.accent, textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmt(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `1px solid ${R.border}`, background: R.darkBand }}>
                    <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: R.accent }} colSpan={2}>TOTAL / AVG</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: R.accent, textAlign: "right" }}>{Math.round(sampleData.reduce((s, r) => s + r.occ, 0) / sampleData.length)}%</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: R.accent, textAlign: "right" }}>{fmt(Math.round(sampleData.reduce((s, r) => s + r.adr, 0) / sampleData.length))}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: R.accent, textAlign: "right" }}>{fmt(Math.round(sampleData.reduce((s, r) => s + r.revpar, 0) / sampleData.length))}</td>
                    <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, color: R.teal, textAlign: "right" }}>{fmt(sampleData.reduce((s, r) => s + r.revenue, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
