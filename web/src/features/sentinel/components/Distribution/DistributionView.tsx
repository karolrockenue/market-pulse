import { useState, useMemo } from "react";
import {
  Globe,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ClipboardList,
  Settings2,
} from "lucide-react";
import { CrmBoard } from "./CrmBoard";
import { ChannelsRegistry } from "./ChannelsRegistry";

// ── Brand palette ──
const BLUE = "#39BDF8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const BG_PAGE = "#1d1d1c";
const CARD_BG = "#1a1a1a";
const INPUT_BG = "#2C2C2C";
const BORDER = "#2a2a2a";
const TEXT = "#e5e5e5";
const TEXT_MID = "#9ca3af";
const TEXT_DIM = "#6b7280";

// ── Status palette (no red) ──
const STATUS_CFG: Record<Status, { color: string; label: string }> = {
  live: { color: GREEN, label: "Live" },
  onboarding: { color: BLUE, label: "Onboarding" },
  suspended: { color: AMBER, label: "Suspended" },
  none: { color: "#3f3f46", label: "" },
};

// ── OTAs ──
const OTA_CHANNELS = [
  { id: "booking", name: "Booking.com" },
  { id: "expedia", name: "Expedia" },
  { id: "agoda", name: "Agoda" },
  { id: "hotelbeds", name: "Hotelbeds" },
  { id: "trip", name: "Trip.com" },
  { id: "hrs", name: "HRS" },
  { id: "stuba", name: "Stuba" },
  { id: "webbeds", name: "WebBeds" },
  { id: "cntravel", name: "CN Travel" },
  { id: "direct", name: "Direct" },
  { id: "google", name: "Google Hotels" },
  { id: "trivago", name: "Trivago" },
];

const MANAGED_HOTELS = [
  "The Portico Hotel", "The W14 Hotel", "House of Toby", "The 29 London",
  "Astor Victoria", "Jubilee Hotel Victoria", "The Cleveland Hotel", "The Melita",
  "Vilenza Hotel", "Camden Suites", "City Rooms", "London Homes (Aldgate)",
  "The Whitechapel Hotel", "Citygate", "Elysee Hyde Park", "Notting Hill House Hotel",
  "The Jade Hotel", "Whitechapel Grand", "London Suites", "Studio 169",
  "Lancaster Court Hotel",
];

const HOTEL_GROUPS: Record<string, string[]> = {
  "All Properties": MANAGED_HOTELS,
  "Victoria Cluster": ["The Portico Hotel", "Astor Victoria", "Jubilee Hotel Victoria", "The Melita"],
  "East London": ["London Homes (Aldgate)", "The Whitechapel Hotel", "Citygate", "Whitechapel Grand"],
  "West London": ["The W14 Hotel", "The Cleveland Hotel", "Notting Hill House Hotel", "Elysee Hyde Park"],
  "Central": ["House of Toby", "The 29 London", "Camden Suites", "The Jade Hotel"],
};

type Status = "live" | "onboarding" | "suspended" | "none";
const STATUS_ORDER: Record<Status, number> = { live: 0, onboarding: 1, suspended: 2, none: 3 };

function buildGrid(): Record<string, Record<string, Status>> {
  const grid: Record<string, Record<string, Status>> = {};
  const pool: Status[] = ["live", "live", "live", "live", "onboarding", "suspended", "none", "none"];
  MANAGED_HOTELS.forEach((hotel, hi) => {
    grid[hotel] = {};
    OTA_CHANNELS.forEach((ch, ci) => {
      if (ch.id === "direct") { grid[hotel][ch.id] = "live"; return; }
      grid[hotel][ch.id] = pool[(hi * 7 + ci * 5) % pool.length];
    });
  });
  return grid;
}
const GRID = buildGrid();

// ══════════════════════════════════════════

type PageView = "distribution" | "crm" | "channels";

export function DistributionView() {
  const [pageView, setPageView] = useState<PageView>("distribution");
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Properties");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const displayedHotels = useMemo(() => {
    let hotels = HOTEL_GROUPS[selectedGroup] || MANAGED_HOTELS;
    if (search) hotels = hotels.filter((h) => h.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") hotels = hotels.filter((h) => OTA_CHANNELS.some((ch) => GRID[h]?.[ch.id] === statusFilter));
    if (sortCol) {
      hotels = [...hotels].sort((a, b) => {
        if (sortCol === "hotel") return sortAsc ? a.localeCompare(b) : b.localeCompare(a);
        const sa = STATUS_ORDER[GRID[a]?.[sortCol] || "none"];
        const sb = STATUS_ORDER[GRID[b]?.[sortCol] || "none"];
        return sortAsc ? sa - sb : sb - sa;
      });
    }
    return hotels;
  }, [search, selectedGroup, statusFilter, sortCol, sortAsc]);

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown size={9} style={{ color: TEXT_DIM, opacity: 0.3 }} />;
    return sortAsc ? <ChevronUp size={10} style={{ color: BLUE }} /> : <ChevronDown size={10} style={{ color: BLUE }} />;
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, position: "relative", overflow: "hidden", paddingBottom: 64 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "28px 32px" }}>

        {/* ── Header with Page Switch ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(57,189,248,0.12)" }}>
                {pageView === "distribution" ? <Globe size={18} style={{ color: BLUE }} /> : pageView === "crm" ? <ClipboardList size={18} style={{ color: BLUE }} /> : <Settings2 size={18} style={{ color: BLUE }} />}
              </div>
              <h1 style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                {pageView === "distribution" ? "Distribution" : pageView === "crm" ? "CRM" : "Channels"}
              </h1>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: `${BLUE}18`, color: BLUE }}>MOCKUP</span>
            </div>

            {/* Toggle Switch */}
            <div style={{ display: "flex", background: INPUT_BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {([
                { key: "distribution" as PageView, label: "Distribution", icon: <Globe size={13} /> },
                { key: "crm" as PageView, label: "CRM", icon: <ClipboardList size={13} /> },
                { key: "channels" as PageView, label: "Channels", icon: <Settings2 size={13} /> },
              ]).map((v, i, arr) => (
                <button key={v.key} onClick={() => setPageView(v.key)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
                  border: "none", background: pageView === v.key ? `${BLUE}15` : "transparent",
                  color: pageView === v.key ? BLUE : TEXT_DIM,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                  borderRight: i < arr.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
          <p style={{ color: TEXT_DIM, fontSize: 12, margin: 0, marginLeft: 46 }}>
            {pageView === "distribution"
              ? `Channel connections and onboarding across ${MANAGED_HOTELS.length} properties`
              : pageView === "crm"
              ? "Task management, assignments, and workflows across your portfolio"
              : "OTA partners, agreements, contacts, and commission structures"}
          </p>
        </div>

        {/* ══ CRM VIEW ══ */}
        {pageView === "crm" && <CrmBoard />}

        {/* ══ CHANNELS VIEW ══ */}
        {pageView === "channels" && <ChannelsRegistry />}

        {/* ══ DISTRIBUTION VIEW ══ */}
        {pageView === "distribution" && <div style={{ padding: "0 32px 64px" }}>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
            <input type="text" placeholder="Search hotels..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "7px 10px 7px 30px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none" }} />
          </div>

          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
            style={{ padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none", cursor: "pointer" }}>
            {Object.keys(HOTEL_GROUPS).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <div style={{ display: "flex", gap: 3 }}>
            {(["all", "live", "onboarding", "suspended"] as const).map((s) => {
              const active = statusFilter === s;
              const cfg = s === "all" ? { color: TEXT_MID, label: "All" } : STATUS_CFG[s];
              return (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding: "5px 12px", borderRadius: 6, border: `1px solid ${active ? cfg.color + "60" : BORDER}`,
                  background: active ? `${cfg.color}0a` : "transparent", color: active ? cfg.color : TEXT_DIM,
                  fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
                }}>
                  {s === "all" ? "All" : cfg.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            {(["live", "onboarding", "suspended"] as Status[]).map((s) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_CFG[s].color }} />
                <span style={{ color: TEXT_DIM, fontSize: 11 }}>{STATUS_CFG[s].label}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3f3f46" }} />
              <span style={{ color: TEXT_DIM, fontSize: 11 }}>Not connected</span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════ */}
        {/* THE GRID                                */}
        {/* ════════════════════════════════════════ */}

        <div style={{ backgroundColor: CARD_BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 48 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort("hotel")} style={{
                    padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 600,
                    color: sortCol === "hotel" ? BLUE : TEXT_DIM, textTransform: "uppercase", letterSpacing: "-0.025em",
                    position: "sticky", left: 0, background: "#222222", zIndex: 3, minWidth: 190,
                    borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, cursor: "pointer", userSelect: "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>Property <SortIcon col="hotel" /></div>
                  </th>
                  {OTA_CHANNELS.map((ch) => (
                    <th key={ch.id} onClick={() => handleSort(ch.id)} style={{
                      padding: "11px 6px", textAlign: "center", fontSize: 10, fontWeight: 600,
                      color: sortCol === ch.id ? BLUE : TEXT_MID, textTransform: "uppercase", letterSpacing: "-0.025em",
                      borderBottom: `1px solid ${BORDER}`, background: "#222222",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", minWidth: 80,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                        {ch.name} <SortIcon col={ch.id} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedHotels.map((hotel, ri) => (
                  <tr key={hotel} style={{ borderBottom: `1px solid ${BORDER}`, transition: "background 0.12s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent")}
                  >
                    <td style={{
                      padding: "10px 16px", fontSize: 12, color: TEXT, fontWeight: 500,
                      position: "sticky", left: 0, background: ri % 2 === 1 ? "#1c1c1b" : CARD_BG,
                      zIndex: 1, whiteSpace: "nowrap", borderRight: `1px solid ${BORDER}`,
                    }}>
                      {hotel}
                    </td>
                    {OTA_CHANNELS.map((ch) => {
                      const status = GRID[hotel]?.[ch.id] || "none";
                      const cfg = STATUS_CFG[status];
                      return (
                        <td key={ch.id} style={{
                          padding: "10px 6px", textAlign: "center",
                          background: ri % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent",
                        }}>
                          {status === "none" ? (
                            <span style={{ color: "#3f3f46", fontSize: 13 }}>—</span>
                          ) : (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                              <span style={{ color: cfg.color, fontSize: 10, fontWeight: 500, letterSpacing: "0.02em" }}>{cfg.label}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {displayedHotels.length === 0 && (
                  <tr><td colSpan={OTA_CHANNELS.length + 1} style={{ padding: 40, textAlign: "center", color: TEXT_DIM, fontSize: 13 }}>No hotels match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        </div>}

      </div>
    </div>
  );
}
