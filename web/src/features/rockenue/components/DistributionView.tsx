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
  Bell,
} from "lucide-react";
import { ChannelsRegistry } from "./ChannelsRegistry";
import { useDistributionGrid } from "../hooks/useDistributionGrid";
import type { GridStatus, GridCell } from "../api/types";

// ── New palette (matching MP mockups) ──
const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  teal: "#38C6BA", warmTeal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
};

// ── Status palette ──
type Status = "live" | "onboarding" | "suspended" | "none";
const STATUS_CFG: Record<Status, { color: string; label: string; bg: string }> = {
  live: { color: R.green, label: "Live", bg: `${R.green}12` },
  onboarding: { color: R.warmTeal, label: "Onboarding", bg: `${R.warmTeal}12` },
  suspended: { color: R.gold, label: "Suspended", bg: `${R.gold}12` },
  none: { color: R.textDim, label: "", bg: "transparent" },
};

const STATUS_ORDER: Record<Status, number> = { live: 0, onboarding: 1, suspended: 2, none: 3 };

// ── Hotel groups ──
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
        position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
        zIndex: 50, background: R.cardRaised, border: `1px solid ${R.border}`,
        borderRadius: 8, padding: 4, minWidth: 140,
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
              if (s === "suspended") onSuspend(hotelId, channelId);
              else onSelect(s);
              onClose();
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "7px 12px", border: "none", borderRadius: 5,
              background: isActive ? `${cfg.color}15` : "transparent",
              color: isActive ? cfg.color : R.textMid,
              fontSize: 11, fontWeight: 500, cursor: "pointer", textAlign: "left",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
            {s === "none" ? "Not connected" : cfg.label}
          </button>
        );
      })}
      {currentStatus === "onboarding" && onPipelineNavigate && (
        <>
          <div style={{ height: 1, background: R.border, margin: "4px 0" }} />
          <button
            onClick={() => { onPipelineNavigate(hotelId, channelId); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              padding: "7px 12px", border: "none", borderRadius: 5,
              background: "transparent", color: R.warmTeal,
              fontSize: 11, fontWeight: 500, cursor: "pointer", textAlign: "left",
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
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 460, background: R.card, border: `1px solid ${R.border}`, borderRadius: 10,
        zIndex: 61, boxShadow: "0 12px 40px rgba(0,0,0,0.5)", overflow: "hidden",
      }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${R.border}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${R.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={15} style={{ color: R.gold }} />
          </div>
          <div>
            <div style={{ color: R.accent, fontSize: 14, fontWeight: 600 }}>Suspend Channel</div>
            <div style={{ color: R.textMid, fontSize: 11, marginTop: 2 }}>Explain why so your team has context</div>
          </div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ color: R.textDim, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Reason</div>
          <textarea
            autoFocus
            placeholder="e.g. Contract expired, rate parity issues, zero volume for 6 months..."
            value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            style={{
              width: "100%", padding: "10px 12px", background: R.cardRaised, border: `1px solid ${R.border}`,
              borderRadius: 6, color: R.accent, fontSize: 13, outline: "none", resize: "vertical",
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif", lineHeight: 1.5,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: `1px solid ${R.border}` }}>
          <button onClick={onClose} style={{
            height: 36, padding: "0 18px", borderRadius: 6, border: `1px solid ${R.border}`,
            background: R.cardRaised, color: R.accent, fontSize: 12, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => { if (reason.trim()) { onConfirm(reason.trim()); onClose(); } }} style={{
            height: 36, padding: "0 20px", borderRadius: 6, border: "none",
            background: reason.trim() ? R.gold : `${R.gold}30`, color: reason.trim() ? "#000" : R.textDim,
            fontSize: 12, fontWeight: 600, cursor: reason.trim() ? "pointer" : "default",
          }}>
            Suspend
          </button>
        </div>
      </div>
    </>
  );
}

// ── Suspension Info Popover ──
function SuspensionInfoPopover({
  reason, suspendedBy, suspendedAt, onClose,
}: {
  reason: string; suspendedBy: string | null; suspendedAt: string | null; onClose: () => void;
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
      background: R.card, border: `1px solid ${R.border}`, borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
    }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: `1px solid ${R.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: R.gold }} />
          <span style={{ color: R.gold, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Suspended</span>
        </div>
        <X size={12} style={{ color: R.textDim, cursor: "pointer" }} onClick={onClose} />
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ color: R.accent, fontSize: 12, lineHeight: 1.5, marginBottom: 8 }}>{reason}</div>
        <div style={{ display: "flex", gap: 12 }}>
          {suspendedBy && <span style={{ color: R.textMid, fontSize: 10 }}>{suspendedBy}</span>}
          {dateStr && <span style={{ color: R.textDim, fontSize: 10 }}>{dateStr}</span>}
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
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [popoverCell, setPopoverCell] = useState<{ hotelId: number; channelId: number } | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{ hotelId: number; channelId: number } | null>(null);
  const [infoCell, setInfoCell] = useState<string | null>(null);

  const displayedHotels = useMemo(() => {
    let filtered = [...hotels];

    if (selectedGroup !== "All Properties") {
      const groupNames = HOTEL_GROUPS[selectedGroup] || [];
      filtered = filtered.filter((h) => groupNames.includes(h.hotel_name));
    }

    if (search) filtered = filtered.filter((h) => h.hotel_name.toLowerCase().includes(search.toLowerCase()));

    if (sortCol) {
      filtered.sort((a, b) => {
        if (sortCol === "hotel") return sortAsc ? a.hotel_name.localeCompare(b.hotel_name) : b.hotel_name.localeCompare(a.hotel_name);
        const sa = STATUS_ORDER[(grid[a.hotel_id]?.[Number(sortCol)]?.status || "none") as Status];
        const sb = STATUS_ORDER[(grid[b.hotel_id]?.[Number(sortCol)]?.status || "none") as Status];
        return sortAsc ? sa - sb : sb - sa;
      });
    }

    return filtered;
  }, [hotels, channels, grid, search, selectedGroup, sortCol, sortAsc]);

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown size={9} style={{ color: R.textDim, opacity: 0.3 }} />;
    return sortAsc ? <ChevronUp size={10} style={{ color: R.warmTeal }} /> : <ChevronDown size={10} style={{ color: R.warmTeal }} />;
  };

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

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
                    background: isActive ? `${R.warmTeal}12` : "transparent",
                    color: isActive ? R.warmTeal : R.textDim,
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

        {/* ══ CHANNELS VIEW ══ */}
        {pageView === "channels" && <ChannelsRegistry />}

        {/* ══ GRID VIEW ══ */}
        {pageView === "grid" && (
          loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
              <Loader2 size={28} style={{ color: R.warmTeal, animation: "spin 1s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th onClick={() => handleSort("hotel")} style={{
                        padding: "12px 20px", textAlign: "left", fontSize: 10, fontWeight: 600,
                        color: sortCol === "hotel" ? R.warmTeal : R.textDim, textTransform: "uppercase", letterSpacing: 1,
                        borderBottom: `1px solid ${R.border}`, minWidth: 220,
                        cursor: "pointer", userSelect: "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>Property <SortIcon col="hotel" /></div>
                      </th>
                      {channels.map((ch) => (
                        <th key={ch.id} onClick={() => handleSort(String(ch.id))} style={{
                          padding: "12px 14px", textAlign: "center", fontSize: 10, fontWeight: 600,
                          color: sortCol === String(ch.id) ? R.warmTeal : R.textMid, textTransform: "uppercase", letterSpacing: 0.5,
                          borderBottom: `1px solid ${R.border}`, cursor: "pointer", userSelect: "none",
                          whiteSpace: "nowrap", minWidth: 110,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            {ch.name} <SortIcon col={String(ch.id)} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedHotels.map((hotel) => (
                      <tr key={hotel.hotel_id}>
                        <td style={{ padding: "12px 20px", borderBottom: `1px solid ${R.sep}` }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>{hotel.hotel_name}</div>
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
                              padding: "10px 8px", textAlign: "center",
                              borderBottom: `1px solid ${R.sep}`, position: "relative",
                            }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <div
                                  onClick={() => setPopoverCell(isPopoverOpen ? null : { hotelId: hotel.hotel_id, channelId: ch.id })}
                                  style={{ cursor: "pointer", display: "inline-block" }}
                                >
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
                                </div>
                                {hasSuspensionInfo && (
                                  <div
                                    onClick={(e) => { e.stopPropagation(); setInfoCell(isInfoOpen ? null : cellKey); }}
                                    style={{
                                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                      background: isInfoOpen ? `${R.gold}20` : `${R.gold}10`,
                                      border: `1px solid ${isInfoOpen ? `${R.gold}40` : `${R.gold}20`}`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      cursor: "pointer", transition: "all 0.15s",
                                    }}
                                  >
                                    <Info size={9} style={{ color: R.gold }} />
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
                      <tr><td colSpan={channels.length + 1} style={{ padding: 40, textAlign: "center", color: R.textDim, fontSize: 13 }}>No hotels match your filters</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: R.darkBand }}>
                      <td style={{ padding: "12px 20px", fontSize: 12, fontWeight: 600, color: R.textMid, borderTop: `1px solid ${R.border}` }}>
                        {displayedHotels.length} properties
                      </td>
                      {channels.map(ch => {
                        const liveCount = displayedHotels.filter(h => ((grid[h.hotel_id]?.[ch.id]?.status) || "none") === "live").length;
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
