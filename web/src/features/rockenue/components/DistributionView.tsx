import { useState, useMemo, useRef, useEffect } from "react";
import {
  Globe,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Settings2,
  Loader2,
  Info,
  X,
  AlertTriangle,
} from "lucide-react";
import { ChannelsRegistry } from "./ChannelsRegistry";
import { useDistributionGrid } from "../hooks/useDistributionGrid";
import type { GridStatus, GridCell } from "../api/types";

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
type Status = "live" | "onboarding" | "suspended" | "none";
const STATUS_CFG: Record<Status, { color: string; label: string }> = {
  live: { color: GREEN, label: "Live" },
  onboarding: { color: BLUE, label: "Onboarding" },
  suspended: { color: AMBER, label: "Suspended" },
  none: { color: "#3f3f46", label: "" },
};

const STATUS_ORDER: Record<Status, number> = { live: 0, onboarding: 1, suspended: 2, none: 3 };

// ── Hotel groups (matched by hotel_name) ──
const HOTEL_GROUPS: Record<string, string[]> = {
  "All Properties": [],
  "Victoria Cluster": ["The Portico Hotel", "Astor Victoria", "Jubilee Hotel Victoria", "The Melita"],
  "East London": ["London Homes (Aldgate)", "The Whitechapel Hotel", "Citygate", "Whitechapel Grand"],
  "West London": ["The W14 Hotel", "The Cleveland Hotel", "Notting Hill House Hotel", "Elysee Hyde Park"],
  "Central": ["House of Toby", "The 29 London", "Camden Suites", "The Jade Hotel"],
};

// ── Status dropdown popover ──
function StatusPopover({
  hotelId,
  channelId,
  currentStatus,
  onSelect,
  onSuspend,
  onClose,
  onPipelineNavigate,
}: {
  hotelId: number;
  channelId: number;
  currentStatus: Status;
  onSelect: (status: GridStatus) => void;
  onSuspend: (hotelId: number, channelId: number) => void;
  onClose: () => void;
  onPipelineNavigate?: (hotelId: number, channelId: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        background: "#2a2a2a",
        border: `1px solid #3f3f46`,
        borderRadius: 8,
        padding: 4,
        minWidth: 130,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {(["live", "onboarding", "suspended", "none"] as Status[]).map((s) => {
        const cfg = STATUS_CFG[s];
        const isActive = currentStatus === s;
        return (
          <button
            key={s}
            onClick={() => {
              if (s === "suspended") {
                onSuspend(hotelId, channelId);
              } else {
                onSelect(s);
              }
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 10px",
              border: "none",
              borderRadius: 4,
              background: isActive ? `${cfg.color}15` : "transparent",
              color: isActive ? cfg.color : TEXT_MID,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
            {s === "none" ? "Not connected" : cfg.label}
          </button>
        );
      })}
      {currentStatus === "onboarding" && onPipelineNavigate && (
        <>
          <div style={{ height: 1, background: "#3f3f46", margin: "4px 0" }} />
          <button
            onClick={() => { onPipelineNavigate(hotelId, channelId); onClose(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "6px 10px",
              border: "none",
              borderRadius: 4,
              background: "transparent",
              color: BLUE,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            Create Task
          </button>
        </>
      )}
    </div>
  );
}

// ── Suspension Reason Modal ──
function SuspensionModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, transition: "opacity 0.2s" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 460, background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
        zIndex: 61, boxShadow: "0 0 20px rgba(57,189,248,0.08), 0 12px 40px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${BLUE}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={15} style={{ color: BLUE }} />
          </div>
          <div>
            <div style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>Suspend Channel</div>
            <div style={{ color: TEXT_MID, fontSize: 11, marginTop: 2 }}>Explain why so your team has context</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 8 }}>Reason</div>
          <textarea
            autoFocus
            placeholder="e.g. Contract expired, rate parity issues, zero volume for 6 months..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", background: INPUT_BG, border: `1px solid ${BORDER}`,
              borderRadius: 6, color: TEXT, fontSize: 13, outline: "none", resize: "vertical",
              fontFamily: "system-ui, -apple-system, sans-serif", lineHeight: 1.5,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = `${BLUE}40`)}
            onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
          />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} style={{
            height: 36, padding: "0 18px", borderRadius: 6, border: `1px solid ${BORDER}`,
            background: INPUT_BG, color: TEXT, fontSize: 12, cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif", transition: "border-color 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${BLUE}40`)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
          >Cancel</button>
          <button onClick={() => { if (reason.trim()) { onConfirm(reason.trim()); onClose(); } }} style={{
            height: 36, padding: "0 20px", borderRadius: 6, border: "none",
            background: reason.trim() ? BLUE : `${BLUE}30`, color: reason.trim() ? "#000" : TEXT_DIM,
            fontSize: 12, fontWeight: 600, cursor: reason.trim() ? "pointer" : "default",
            fontFamily: "system-ui, -apple-system, sans-serif", transition: "all 0.15s",
          }}>
            Suspend
          </button>
        </div>
      </div>
    </>
  );
}

// ── Suspension Info Popover (shown on click of info icon) ──
function SuspensionInfoPopover({
  reason,
  suspendedBy,
  suspendedAt,
  onClose,
}: {
  reason: string;
  suspendedBy: string | null;
  suspendedAt: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const dateStr = suspendedAt ? new Date(suspendedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <div ref={ref} style={{
      position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
      zIndex: 50, width: 240, marginTop: 4,
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
      boxShadow: "0 0 16px rgba(57,189,248,0.06), 0 8px 24px rgba(0,0,0,0.4)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: BLUE }} />
          <span style={{ color: BLUE, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em" }}>Suspended</span>
        </div>
        <X size={12} style={{ color: TEXT_DIM, cursor: "pointer" }} onClick={onClose} />
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ color: TEXT, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{reason}</div>
        <div style={{ display: "flex", gap: 12 }}>
          {suspendedBy && <span style={{ color: TEXT_MID, fontSize: 10 }}>{suspendedBy}</span>}
          {dateStr && <span style={{ color: TEXT_DIM, fontSize: 10 }}>{dateStr}</span>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════

type PageView = "grid" | "channels";

interface DistributionViewProps {
  onPipelineNavigate?: (hotelId: number, channelId: number) => void;
}

export function DistributionView({ onPipelineNavigate }: DistributionViewProps) {
  const { hotels, channels, grid, loading, updateCellStatus } = useDistributionGrid();

  const [pageView, setPageView] = useState<PageView>("grid");
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Properties");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [popoverCell, setPopoverCell] = useState<{ hotelId: number; channelId: number } | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ hotelId: number; channelId: number } | null>(null);
  const [infoCell, setInfoCell] = useState<string | null>(null);

  const displayedHotels = useMemo(() => {
    let filtered = [...hotels];

    // Filter by group
    if (selectedGroup !== "All Properties") {
      const groupNames = HOTEL_GROUPS[selectedGroup] || [];
      filtered = filtered.filter((h) => groupNames.includes(h.hotel_name));
    }

    // Filter by search
    if (search) filtered = filtered.filter((h) => h.hotel_name.toLowerCase().includes(search.toLowerCase()));

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((h) =>
        channels.some((ch) => (grid[h.hotel_id]?.[ch.id]?.status || "none") === statusFilter)
      );
    }

    // Sort
    if (sortCol) {
      filtered.sort((a, b) => {
        if (sortCol === "hotel") return sortAsc ? a.hotel_name.localeCompare(b.hotel_name) : b.hotel_name.localeCompare(a.hotel_name);
        const sa = STATUS_ORDER[(grid[a.hotel_id]?.[Number(sortCol)]?.status || "none") as Status];
        const sb = STATUS_ORDER[(grid[b.hotel_id]?.[Number(sortCol)]?.status || "none") as Status];
        return sortAsc ? sa - sb : sb - sa;
      });
    }

    return filtered;
  }, [hotels, channels, grid, search, selectedGroup, statusFilter, sortCol, sortAsc]);

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
                {pageView === "grid" ? <Globe size={18} style={{ color: BLUE }} /> : <Settings2 size={18} style={{ color: BLUE }} />}
              </div>
              <h1 style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "-0.025em" }}>
                {pageView === "grid" ? "Distribution" : "Channels"}
              </h1>
            </div>

            {/* Toggle Switch */}
            <div style={{ display: "flex", background: INPUT_BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {([
                { key: "grid" as PageView, label: "Grid", icon: <Globe size={13} /> },
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
            {pageView === "grid"
              ? `Channel connections and onboarding across ${hotels.length} properties`
              : "OTA partners, agreements, contacts, and commission structures"}
          </p>
        </div>

        {/* ══ CHANNELS VIEW ══ */}
        {pageView === "channels" && <ChannelsRegistry />}

        {/* ══ GRID VIEW ══ */}
        {pageView === "grid" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
              <Loader2 size={28} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div>

        {/* ── Filters ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: TEXT_DIM }} />
            <input type="text" placeholder="Search hotels..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "7px 10px 7px 30px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none" }} />
          </div>

          <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}
            style={{ padding: "7px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 12, outline: "none", cursor: "pointer" }}>
            {Object.keys(HOTEL_GROUPS).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <div style={{ flex: 1 }} />

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
                  {channels.map((ch) => (
                    <th key={ch.id} onClick={() => handleSort(String(ch.id))} style={{
                      padding: "11px 6px", textAlign: "center", fontSize: 10, fontWeight: 600,
                      color: sortCol === String(ch.id) ? BLUE : TEXT_MID, textTransform: "uppercase", letterSpacing: "-0.025em",
                      borderBottom: `1px solid ${BORDER}`, background: "#222222",
                      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", minWidth: 80,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                        {ch.name} <SortIcon col={String(ch.id)} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedHotels.map((hotel, ri) => (
                  <tr key={hotel.hotel_id} style={{ borderBottom: `1px solid ${BORDER}`, transition: "background 0.12s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent")}
                  >
                    <td style={{
                      padding: "10px 16px", fontSize: 12, color: TEXT, fontWeight: 500,
                      position: "sticky", left: 0, background: ri % 2 === 1 ? "#1c1c1b" : CARD_BG,
                      zIndex: 1, whiteSpace: "nowrap", borderRight: `1px solid ${BORDER}`,
                    }}>
                      {hotel.hotel_name}
                    </td>
                    {channels.map((ch) => {
                      const cell = grid[hotel.hotel_id]?.[ch.id];
                      const status = (cell?.status || "none") as Status;
                      const cfg = STATUS_CFG[status];
                      const isPopoverOpen = popoverCell?.hotelId === hotel.hotel_id && popoverCell?.channelId === ch.id;
                      const cellKey = `${hotel.hotel_id}-${ch.id}`;
                      const isInfoOpen = infoCell === cellKey;
                      const hasSuspensionInfo = status === "suspended" && cell?.suspension_reason;
                      return (
                        <td key={ch.id} style={{
                          padding: "10px 6px", textAlign: "center",
                          background: ri % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent",
                          position: "relative",
                        }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <div
                              onClick={() => setPopoverCell(isPopoverOpen ? null : { hotelId: hotel.hotel_id, channelId: ch.id })}
                              style={{ cursor: "pointer", display: "inline-block" }}
                            >
                              {status === "none" ? (
                                <span style={{ color: "#3f3f46", fontSize: 13 }}>—</span>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
                                  <span style={{ color: cfg.color, fontSize: 10, fontWeight: 500, letterSpacing: "0.02em" }}>{cfg.label}</span>
                                </div>
                              )}
                            </div>
                            {hasSuspensionInfo && (
                              <div
                                onClick={(e) => { e.stopPropagation(); setInfoCell(isInfoOpen ? null : cellKey); }}
                                style={{
                                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                  background: isInfoOpen ? `${BLUE}20` : `${BLUE}10`,
                                  border: `1px solid ${isInfoOpen ? `${BLUE}40` : `${BLUE}20`}`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer", transition: "all 0.15s",
                                }}
                              >
                                <Info size={9} style={{ color: BLUE }} />
                              </div>
                            )}
                          </div>
                          {isPopoverOpen && (
                            <StatusPopover
                              hotelId={hotel.hotel_id}
                              channelId={ch.id}
                              currentStatus={status}
                              onSelect={(newStatus) => updateCellStatus(hotel.hotel_id, ch.id, newStatus)}
                              onSuspend={(hId, cId) => setSuspendTarget({ hotelId: hId, channelId: cId })}
                              onClose={() => setPopoverCell(null)}
                              onPipelineNavigate={onPipelineNavigate}
                            />
                          )}
                          {isInfoOpen && hasSuspensionInfo && (
                            <SuspensionInfoPopover
                              reason={cell.suspension_reason!}
                              suspendedBy={cell.suspended_by}
                              suspendedAt={cell.suspended_at}
                              onClose={() => setInfoCell(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {displayedHotels.length === 0 && (
                  <tr><td colSpan={channels.length + 1} style={{ padding: 40, textAlign: "center", color: TEXT_DIM, fontSize: 13 }}>No hotels match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        </div>
          )
        )}

      </div>

      {/* Suspension Reason Modal */}
      {suspendTarget && (
        <SuspensionModal
          onConfirm={(reason) => {
            updateCellStatus(suspendTarget.hotelId, suspendTarget.channelId, "suspended", reason, "User");
            setSuspendTarget(null);
          }}
          onClose={() => setSuspendTarget(null)}
        />
      )}
    </div>
  );
}
