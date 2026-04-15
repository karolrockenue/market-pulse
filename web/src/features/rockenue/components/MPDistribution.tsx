import { useState, useMemo } from "react";
import {
  Globe, Search, ChevronDown, Bell, Settings2, AlertTriangle, Info,
} from "lucide-react";

/**
 * ── MP Distribution — Rockenue style mockup ──
 * Mock data. Not wired. Design exercise.
 *
 * Hotel × Channel status grid + Channels registry.
 * Clean layout matching Reports Hub style.
 */

interface MPDistributionProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#4ade80", red: "#ef4444",
  amber: "#f59e0b", orange: "#f97316", purple: "#8b5cf6", blue: "#3b82f6",
};

// ══════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════

type Status = "live" | "onboarding" | "suspended" | "none";

const STATUS_CFG: Record<Status, { color: string; label: string; bg: string }> = {
  live: { color: R.green, label: "Live", bg: `${R.green}12` },
  onboarding: { color: R.blue, label: "Onboarding", bg: `${R.blue}12` },
  suspended: { color: R.amber, label: "Suspended", bg: `${R.amber}12` },
  none: { color: R.textDim, label: "—", bg: "transparent" },
};

const CHANNELS = [
  { id: 1, name: "Booking.com", type: "OTA", commission: 18, agreement: "Group", payment: "VCC", contact: "Sarah Jenkins" },
  { id: 2, name: "Expedia", type: "OTA", commission: 20, agreement: "Group", payment: "VCC", contact: "Tom Reid" },
  { id: 3, name: "Hostelworld", type: "OTA", commission: 15, agreement: "Individual", payment: "Guest Pays", contact: null },
  { id: 4, name: "HRS", type: "Wholesaler", commission: 22, agreement: "Group", payment: "BACS", contact: "Anna Becker" },
  { id: 5, name: "Google Hotels", type: "Meta", commission: 12, agreement: "Direct", payment: "CPC", contact: null },
  { id: 6, name: "Direct", type: "Direct", commission: null, agreement: "Direct", payment: "Guest Pays", contact: null },
];

const HOTELS = [
  { id: 1, name: "The W14 Hotel", group: "West London" },
  { id: 2, name: "Jubilee Hotel Victoria", group: "Victoria Cluster" },
  { id: 3, name: "The Melita", group: "Victoria Cluster" },
  { id: 4, name: "Elysee Hyde Park", group: "West London" },
  { id: 5, name: "Camden Suites", group: "Central" },
  { id: 6, name: "Vilenza Hotel", group: "Central" },
  { id: 7, name: "The Whitechapel Hotel", group: "East London" },
  { id: 8, name: "Notting Hill House Hotel", group: "West London" },
  { id: 9, name: "Lancaster Court Hotel", group: "West London" },
  { id: 10, name: "The Portico Hotel", group: "Victoria Cluster" },
];

// Generate grid: hotelId → channelId → status
const GRID: Record<number, Record<number, { status: Status; reason?: string }>> = {};
HOTELS.forEach(h => {
  GRID[h.id] = {};
  CHANNELS.forEach(ch => {
    // Most are live, some variation
    let status: Status = "live";
    if (ch.id === 4 && h.id === 5) status = "suspended";
    else if (ch.id === 5 && [3, 6, 9].includes(h.id)) status = "none";
    else if (ch.id === 2 && h.id === 7) status = "onboarding";
    else if (ch.id === 3 && [2, 4, 10].includes(h.id)) status = "none";
    else if (ch.id === 4 && [3, 8].includes(h.id)) status = "none";
    else if (ch.id === 1 && h.id === 9) status = "onboarding";

    GRID[h.id][ch.id] = {
      status,
      reason: status === "suspended" ? "Rate parity issues — under review" : undefined,
    };
  });
});

const GROUPS = ["All Properties", "Victoria Cluster", "East London", "West London", "Central"];

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

type PageView = "grid" | "channels";

export function MPDistribution({ activeView, onNavigate }: MPDistributionProps) {
  const [pageView, setPageView] = useState<PageView>("grid");
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Properties");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  // Stats
  const stats = useMemo(() => {
    let live = 0, onboarding = 0, suspended = 0, notConnected = 0;
    HOTELS.forEach(h => {
      CHANNELS.forEach(ch => {
        const s = GRID[h.id]?.[ch.id]?.status ?? "none";
        if (s === "live") live++;
        else if (s === "onboarding") onboarding++;
        else if (s === "suspended") suspended++;
        else notConnected++;
      });
    });
    return { live, onboarding, suspended, notConnected, total: HOTELS.length * CHANNELS.length };
  }, []);

  // Filtered hotels
  const displayedHotels = useMemo(() => {
    let list = [...HOTELS];

    if (selectedGroup !== "All Properties") {
      list = list.filter(h => h.group === selectedGroup);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(h => h.name.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      list = list.filter(h =>
        CHANNELS.some(ch => (GRID[h.id]?.[ch.id]?.status ?? "none") === statusFilter)
      );
    }

    return list;
  }, [search, selectedGroup, statusFilter]);

  return (
    <div style={{ height: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>Portfolio</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} color={R.textDim} style={{ position: "absolute", left: 10 }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                style={{ background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 10px 6px 30px", fontSize: 12, color: R.text, outline: "none", width: 200 }}
                placeholder="Search properties..." />
            </div>
            <Bell size={16} color={R.textMid} />
          </div>
        </div>

        <div style={{ padding: "32px" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Operations</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>Distribution</h1>
                <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>
                  {pageView === "grid"
                    ? `Channel connections across ${displayedHotels.length} properties`
                    : "OTA partners, agreements, and commission structures"}
                </p>
              </div>

              {/* View toggle */}
              <div style={{ display: "flex", alignItems: "center", background: R.cardRaised, borderRadius: 8, border: `1px solid ${R.border}`, overflow: "hidden" }}>
                {([
                  { key: "grid" as PageView, label: "Grid", icon: Globe },
                  { key: "channels" as PageView, label: "Channels", icon: Settings2 },
                ] as const).map(v => {
                  const Icon = v.icon;
                  const isActive = pageView === v.key;
                  return (
                    <button key={v.key} onClick={() => setPageView(v.key)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 18px", border: "none",
                      background: isActive ? `${R.teal}12` : "transparent",
                      color: isActive ? R.teal : R.textDim,
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      transition: "all 0.15s",
                    }}>
                      <Icon size={13} />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* GRID VIEW                                           */}
          {/* ═══════════════════════════════════════════════════ */}
          {pageView === "grid" && (
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: "12px 20px", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim,
                      textTransform: "uppercase", textAlign: "left",
                      borderBottom: `1px solid ${R.border}`, minWidth: 220,
                    }}>Property</th>
                    {CHANNELS.map(ch => (
                      <th key={ch.id} style={{
                        padding: "12px 14px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                        color: R.textMid, textTransform: "uppercase", textAlign: "center",
                        borderBottom: `1px solid ${R.border}`, minWidth: 110,
                      }}>{ch.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedHotels.map((hotel, ri) => {
                    const liveCount = CHANNELS.filter(ch => (GRID[hotel.id]?.[ch.id]?.status ?? "none") === "live").length;
                    return (
                      <tr key={hotel.id}>
                        <td style={{
                          padding: "12px 20px", borderBottom: `1px solid ${R.sep}`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>{hotel.name}</div>
                          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{hotel.group}</div>
                        </td>
                        {CHANNELS.map(ch => {
                          const status = (GRID[hotel.id]?.[ch.id]?.status ?? "none") as Status;
                          const cfg = STATUS_CFG[status];
                          return (
                            <td key={ch.id} style={{
                              padding: "10px 8px", textAlign: "center",
                              borderBottom: `1px solid ${R.sep}`,
                            }}>
                              {status === "none" ? (
                                <span style={{ color: R.textDim, fontSize: 11 }}>—</span>
                              ) : (
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "4px 10px", borderRadius: 6, background: cfg.bg,
                                }}>
                                  <div style={{ width: 6, height: 6, borderRadius: 3, background: cfg.color, opacity: 0.8 }} />
                                  <span style={{ fontSize: 11, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: R.darkBand }}>
                    <td style={{ padding: "12px 20px", fontSize: 12, fontWeight: 600, color: R.textMid, borderTop: `1px solid ${R.border}` }}>
                      {displayedHotels.length} properties
                    </td>
                    {CHANNELS.map(ch => {
                      const liveCount = displayedHotels.filter(h => (GRID[h.id]?.[ch.id]?.status ?? "none") === "live").length;
                      return (
                        <td key={ch.id} style={{ padding: "12px 14px", textAlign: "center", borderTop: `1px solid ${R.border}` }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: liveCount === displayedHotels.length ? R.green : R.textMid }}>
                            {liveCount}/{displayedHotels.length}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════ */}
          {/* CHANNELS VIEW                                       */}
          {/* ═══════════════════════════════════════════════════ */}
          {pageView === "channels" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 12 }}>Active Partners</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                {CHANNELS.map((ch, i) => {
                  const liveCount = HOTELS.filter(h => (GRID[h.id]?.[ch.id]?.status ?? "none") === "live").length;
                  const onbCount = HOTELS.filter(h => (GRID[h.id]?.[ch.id]?.status ?? "none") === "onboarding").length;
                  const susCount = HOTELS.filter(h => (GRID[h.id]?.[ch.id]?.status ?? "none") === "suspended").length;
                  return (
                    <div key={ch.id} style={{
                      background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: "20px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>{ch.name}</span>
                          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: `${R.teal}12`, color: R.teal, fontWeight: 500 }}>{ch.type}</span>
                        </div>
                        {ch.commission != null && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: ch.commission >= 20 ? R.amber : R.accent }}>{ch.commission}%</span>
                        )}
                      </div>

                      {/* Channel details */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                        {[
                          { label: "Agreement", value: ch.agreement },
                          { label: "Payment", value: ch.payment },
                          { label: "Contact", value: ch.contact ?? "—" },
                          { label: "Properties", value: `${liveCount} live` },
                        ].map(row => (
                          <div key={row.label}>
                            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, color: R.textDim, textTransform: "uppercase", marginBottom: 3 }}>{row.label}</div>
                            <div style={{ fontSize: 12, color: R.accent, fontWeight: 500 }}>{row.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Status bar */}
                      <div style={{ display: "flex", gap: 4, height: 4, borderRadius: 2, overflow: "hidden", background: R.cardRaised }}>
                        {liveCount > 0 && <div style={{ flex: liveCount, background: R.green, borderRadius: 2 }} />}
                        {onbCount > 0 && <div style={{ flex: onbCount, background: R.teal, borderRadius: 2 }} />}
                        {susCount > 0 && <div style={{ flex: susCount, background: R.amber, borderRadius: 2 }} />}
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                        {liveCount > 0 && <span style={{ fontSize: 10, color: R.green }}>{liveCount} live</span>}
                        {onbCount > 0 && <span style={{ fontSize: 10, color: R.teal }}>{onbCount} onboarding</span>}
                        {susCount > 0 && <span style={{ fontSize: 10, color: R.amber }}>{susCount} suspended</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
