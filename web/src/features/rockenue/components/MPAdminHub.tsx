import { useState } from "react";
import {
  Database, Cloud, RefreshCw, ChevronDown, Trash2, Users, Search,
  CheckCircle2, XCircle, Clock, Send, Play, Settings, Globe2,
  Building2, Hotel, Sparkles, Crown, ArrowRight, Copy, Info,
} from "lucide-react";

interface Props { activeView: string; onNavigate: (view: string) => void; }

/* ── Tokens (matching live design) ── */
const R = {
  bg: "#14181D", heroBg: "#121519", card: "#121519", border: "#1E2330",
  sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7", text: "#B0B8C4",
  textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA",
  gold: "#C8A66E", green: "#34D068", red: "#ef4444", sidebar: "#0C0E12",
};

const gradientText: React.CSSProperties = {
  background: "linear-gradient(135deg, #38C6BA 0%, #C8A66E 100%)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};

/* ── Tiny components ── */

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{ width: 34, height: 18, borderRadius: 9, background: on ? R.teal : "#2A3240", padding: 2, cursor: "pointer" }}>
      <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform 0.15s" }} />
    </div>
  );
}

function Btn({ children, primary, small }: { children: React.ReactNode; primary?: boolean; small?: boolean }) {
  return (
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
      padding: small ? "5px 12px" : primary ? "9px 20px" : "7px 14px",
      borderRadius: 8, fontSize: small ? 11 : 12, fontWeight: primary ? 700 : 500,
      border: primary ? "none" : `1px solid ${R.border}`,
      background: primary ? R.teal : "transparent", color: primary ? R.sidebar : R.text,
    }}>{children}</button>
  );
}

function Card({ title, sub, children, gold: isGold }: { title: string; sub?: string; children: React.ReactNode; gold?: boolean }) {
  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}` }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: R.accent, textTransform: isGold ? "uppercase" : undefined, letterSpacing: isGold ? "0.12em" : "-0.3px" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

/* ── Data ── */

const HOTELS = [
  { id: 315428, name: "Vilenza Hotel", rooms: 22, city: "London", category: "Midscale", managed: true, group: "London Core", active: true, pms: "Cloudbeds" },
  { id: 289618, name: "The Cleveland Hotel", rooms: 18, city: "London", category: "Economy", managed: true, group: "London Core", active: true, pms: "Cloudbeds" },
  { id: 315433, name: "The Whitechapel Hotel", rooms: 30, city: "London", category: "Midscale", managed: true, group: "London East", active: true, pms: "Cloudbeds" },
  { id: 308760, name: "The Melita", rooms: 14, city: "London", category: "Upper Midscale", managed: true, group: "London Core", active: true, pms: "Mews" },
  { id: 315473, name: "Elysee Hyde Park", rooms: 24, city: "London", category: "Upper Midscale", managed: true, group: "London West", active: true, pms: "Cloudbeds" },
  { id: 230719, name: "Jubilee Hotel Victoria", rooms: 16, city: "London", category: "Economy", managed: true, group: "London Core", active: true, pms: "Cloudbeds" },
  { id: 315429, name: "Camden Suites", rooms: 8, city: "London", category: "Midscale", managed: false, group: "—", active: false, pms: "Cloudbeds" },
  { id: 2400, name: "Astor Victoria", rooms: 20, city: "London", category: "Economy", managed: true, group: "London Core", active: true, pms: "Cloudbeds" },
];

const REPORTS = [
  "Vilenza Hotel — Daily Performance",
  "The Cleveland Hotel — Weekly Summary",
  "Portfolio — Monthly Takings",
  "The Melita — Daily Performance",
];

const DATASETS = [
  { id: "financial", name: "Financial", desc: "Revenue, payments, transactions" },
  { id: "guests", name: "Guests", desc: "Guest profiles and demographics" },
  { id: "reservations", name: "Reservations", desc: "Booking details and status" },
  { id: "occupancy", name: "Occupancy", desc: "Room availability and fill rates" },
  { id: "housekeeping", name: "Housekeeping", desc: "Room status and assignments" },
  { id: "payout", name: "Payout", desc: "Channel payout summaries" },
];

const thStyle: React.CSSProperties = { padding: "10px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, color: R.textDim, textTransform: "uppercase", textAlign: "left" };
const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold, marginBottom: 16 };

/* ═══════════════════════════════════════════ */

export function MPAdminHub({ activeView, onNavigate }: Props) {
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);

  return (
    <div style={{ background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", minHeight: "100vh" }}>
      <div style={{ padding: "28px 32px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: R.gold, marginBottom: 8 }}>ADMIN</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 6px" }}>
            Admin <span style={gradientText}>Dashboard</span>
          </h1>
          <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>System management, property onboarding, and API diagnostics</p>
        </div>

        {/* ═══ 1. SYSTEM HEALTH + MANUAL REPORT ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* System Health */}
          <Card title="System Status & Health">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { icon: Database, label: "Database", status: "Connected", ok: true },
                { icon: Cloud, label: "Cloudbeds Auth", status: "Authenticated", ok: true },
                { icon: Clock, label: "Data Freshness", status: "2h ago", ok: true },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Icon size={14} color={R.textMid} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>{item.label}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: item.ok ? R.green : R.red }} />
                      <span style={{ fontSize: 12, color: item.ok ? R.text : R.red }}>{item.status}</span>
                    </div>
                    <Btn small>Test</Btn>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Manual Report Trigger */}
          <Card title="Manual Report Trigger">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Select Report</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, color: R.textMid, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                    <span>Choose a scheduled report...</span>
                    <ChevronDown size={12} color={R.textDim} />
                  </div>
                  <Btn primary><Send size={12} /> Send Now</Btn>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${R.sep}`, paddingTop: 12 }}>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Available Reports</div>
                {REPORTS.map((r, i) => (
                  <div key={r} style={{ fontSize: 12, color: R.text, padding: "6px 0", borderBottom: i < REPORTS.length - 1 ? `1px solid ${R.sep}` : "none" }}>{r}</div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ═══ 2. HOTEL MANAGEMENT TABLE ═══ */}
        <div style={{ ...sectionLabel, marginTop: 8 }}>Hotel Management</div>
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Properties</div>
              <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>Manage Rockenue properties and assignment to management groups</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 12px", gap: 6 }}>
                <Search size={12} color={R.textDim} />
                <span style={{ fontSize: 12, color: R.textDim }}>Search hotels...</span>
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Property</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Rooms</th>
                <th style={thStyle}>City</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>PMS</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Managed</th>
                <th style={thStyle}>Group</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {HOTELS.map((h, i) => (
                <tr key={h.id} style={{ borderBottom: i < HOTELS.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                  <td style={{ padding: "10px 16px", fontSize: 11, color: R.textDim, fontVariantNumeric: "tabular-nums" }}>{h.id}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: R.accent, fontWeight: 500 }}>{h.name}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: R.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{h.rooms}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: R.text }}>{h.city}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: R.text, cursor: "pointer", width: "fit-content" }}>
                      {h.category} <ChevronDown size={10} color={R.textDim} />
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", fontSize: 11, color: R.textMid }}>{h.pms}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 5, height: 5, borderRadius: 3, background: h.active ? R.green : R.textDim }} />
                      <span style={{ fontSize: 11, color: h.active ? R.text : R.textDim }}>{h.active ? "Active" : "Disconnected"}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }}><Toggle on={h.managed} /></td>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, color: h.group === "—" ? R.textDim : R.text, cursor: "pointer", width: "fit-content" }}>
                      {h.group} <ChevronDown size={10} color={R.textDim} />
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <Users size={13} color={R.teal} style={{ cursor: "pointer" }} title="Comp Set" />
                      <RefreshCw size={13} color={R.textMid} style={{ cursor: "pointer" }} title="Sync" />
                      <Database size={13} color={R.textMid} style={{ cursor: "pointer" }} title="Full Sync" />
                      <Trash2 size={13} color={R.red} style={{ cursor: "pointer", opacity: 0.5 }} title="Delete" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ═══ 3. MEWS ONBOARDING ═══ */}
        <div style={sectionLabel}>Mews Onboarding</div>
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Mews Property Onboarding</div>
            <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>Connect a Mews property and sync data automatically</div>
          </div>
          <div style={{ padding: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Mews Access Token</div>
                <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: R.textDim }}>
                  ••••••••••••••••••••••••••
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn>Test Credentials</Btn>
                <Btn primary>Begin Onboarding <ArrowRight size={13} /></Btn>
              </div>
            </div>

            {/* Preview of what a successful test shows */}
            <div style={{ marginTop: 16, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Property Preview</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  { label: "Property", value: "The Melita" },
                  { label: "City", value: "London" },
                  { label: "Timezone", value: "Europe/London" },
                  { label: "Currency", value: "GBP" },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Classification tiers */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Property Classification</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {[
                  { icon: Building2, tier: "Hostel", desc: "Budget-friendly shared" },
                  { icon: Building2, tier: "Economy", desc: "Essential comfort" },
                  { icon: Hotel, tier: "Midscale", desc: "Balanced comfort" },
                  { icon: Sparkles, tier: "Upper Midscale", desc: "Stylish & service" },
                  { icon: Crown, tier: "Luxury", desc: "Premium experience" },
                ].map((t, i) => {
                  const Icon = t.icon;
                  const selected = i === 2;
                  return (
                    <div key={t.tier} style={{
                      background: selected ? `${R.teal}08` : R.heroBg,
                      border: `1px solid ${selected ? `${R.teal}25` : R.border}`,
                      borderRadius: 8, padding: "14px 12px", textAlign: "center", cursor: "pointer",
                    }}>
                      <Icon size={16} color={selected ? R.teal : R.textMid} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: selected ? R.teal : R.accent, marginBottom: 2 }}>{t.tier}</div>
                      <div style={{ fontSize: 10, color: R.textDim }}>{t.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 4. API TARGET PROPERTY ═══ */}
        <div style={sectionLabel}>API Explorer</div>
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>API Target Property:</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", minWidth: 280 }}>
              <span style={{ fontSize: 12, color: R.accent }}>Vilenza Hotel (Cloudbeds)</span>
              <ChevronDown size={12} color={R.textDim} style={{ marginLeft: "auto" }} />
            </div>
            <span style={{ fontSize: 11, color: R.textDim }}>Select the property to use for API tests</span>
          </div>
        </div>

        {/* ═══ 5. API EXPLORER ═══ */}
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>Cloudbeds API Explorer</div>
            <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>Test and debug API calls using stored property credentials</div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${R.sep}` }}>
            <div style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: R.accent, borderBottom: `2px solid ${R.teal}` }}>Insights API</div>
            <div style={{ padding: "12px 20px", fontSize: 13, color: R.textDim, cursor: "pointer" }}>General API</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {/* Left: Dataset selector */}
            <div style={{ padding: 20, borderRight: `1px solid ${R.border}` }}>
              <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Step 1: Select Dataset</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
                {DATASETS.map(ds => {
                  const sel = selectedDataset === ds.id;
                  return (
                    <div key={ds.id} onClick={() => setSelectedDataset(sel ? null : ds.id)} style={{
                      background: sel ? `${R.teal}08` : R.heroBg,
                      border: `1px solid ${sel ? `${R.teal}25` : R.border}`,
                      borderRadius: 8, padding: "12px", cursor: "pointer",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: sel ? R.teal : R.accent, marginBottom: 2 }}>{ds.name}</div>
                      <div style={{ fontSize: 10, color: R.textDim }}>{ds.desc}</div>
                    </div>
                  );
                })}
              </div>

              {selectedDataset && (
                <>
                  <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Step 2: Configure Parameters</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {["Start Date", "End Date"].map(lbl => (
                      <div key={lbl}>
                        <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{lbl}</div>
                        <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: R.textMid }}>2026-04-01</div>
                      </div>
                    ))}
                  </div>
                  <Btn primary><Play size={12} /> Get Insights Data</Btn>
                </>
              )}
            </div>

            {/* Right: Response */}
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8 }}>API Response</div>
                <Copy size={12} color={R.textMid} style={{ cursor: "pointer" }} />
              </div>
              <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: 16, minHeight: 300, fontFamily: "monospace", fontSize: 11, color: R.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
{`{
  "success": true,
  "data": {
    "dataset": "${selectedDataset || "..."}",
    "rows": 42,
    "metrics": ["revenue", "occupancy"],
    "results": [
      { "date": "2026-04-01", "revenue": 4280, "occ": 82 },
      { "date": "2026-04-02", "revenue": 3950, "occ": 76 },
      { "date": "2026-04-03", "revenue": 5120, "occ": 91 }
    ]
  }
}`}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
