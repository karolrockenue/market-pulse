import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Lock,
  User,
  AlertTriangle,
  Calendar as CalendarIcon,
  Zap,
  Eye,
  EyeOff,
  Loader2,
  Info,
  Target,
  ArrowDown,
  Check,
  BedDouble,
  History,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePickerCalendar } from "@/components/ui/date-picker";
import { format } from "date-fns";
import { toast } from "sonner";
import { OccupancyVisualizer } from "../RateManager/OccupancyVisualizer";
import {
  useRateGrid,
  calculateSellRate,
  calculateRequiredOverride,
} from "../../hooks/useRateGrid";
import { getPmsPropertyIds, getRateHistory } from "../../api/sentinel.api";
import type { RateHistoryEntry } from "../../api/types";

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#14181D",
    position: "relative",
    color: "#F3F5F7",
  },
  container: {
    position: "relative",
    zIndex: 10,
    padding: "32px",
    maxWidth: "none",
  },

  // Header
  header: { marginBottom: "24px" },
  title: {
    color: "#F3F5F7",
    fontSize: "24px",
    letterSpacing: "-0.025em",
    marginBottom: "4px",
  },
  subtitle: { color: "#7A8494", fontSize: "12px" },

  // Controls Card
  card: {
    backgroundColor: "#121519",
    border: "1px solid #1E2330",
    borderRadius: "8px",
    marginBottom: "24px",
    padding: "20px",
  },
  flexBetween: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
  },
  flexRow: { display: "flex", alignItems: "flex-end", gap: "16px" },
  formGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  label: {
    color: "#7A8494",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  // Visibility & Action Section
  gridSection: {
    backgroundColor: "#121519",
    borderRadius: "8px",
    border: "1px solid #1E2330",
    padding: "0",
    marginBottom: "24px",
    overflow: "hidden",
  },

  // Visibility Inner Box
  rowVisibilityContainer: {
    marginBottom: "0",
    padding: "10px 16px",
    backgroundColor: "#121519",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "0",
  },
  rowVisibilityInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowVisibilityLeft: { display: "flex", alignItems: "center", gap: "24px" },
  rowVisibilityLabel: {
    fontSize: "12px",
    color: "#4E5868",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  rowVisibilityButtons: { display: "flex", alignItems: "center", gap: "12px" },

  // Grid Container
  gridContainer: {
    position: "relative",
    minHeight: "auto",
    backgroundColor: "#121519",
    borderRadius: "0",
    border: "none",
    overflow: "hidden",
  },
  tableWrapper: { overflowX: "auto", paddingBottom: "4px" },

  // Table Cells
  thSticky: {
    position: "sticky",
    left: 0,
    zIndex: 20,
    backgroundColor: "#121519",
    borderRight: "1px solid #1E2330",
    borderBottom: "1px solid #1E2330",
    width: "180px",
    textAlign: "left",
    padding: "0 20px",
    height: 64,
    color: "#7A8494",
  },
  tdSticky: {
    position: "sticky",
    left: 0,
    zIndex: 10,
    backgroundColor: "#121519",
    borderRight: "1px solid #1E2330",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    padding: "0 20px",
    width: "180px",
    height: "44px",
    color: "#F3F5F7",
    fontSize: "13px",
  },

  // Inputs & Footer
  input: {
    width: "100%",
    backgroundColor: "#0C0E12",
    border: "1px solid #1E2330",
    color: "#F3F5F7",
    textAlign: "center",
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    height: "28px",
    borderRadius: "4px",
    outline: "none",
  },
  footer: {
    padding: "12px",
    backgroundColor: "#121519",
    borderTop: "1px solid rgba(255,255,255,0.04)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "#4E5868",
    fontSize: "12px",
  },
};

interface HotelRateWindowProps {
  allHotels: any[];
  userHotels: any[];
}

// [RATE HISTORY] compact relative-time label for the audit popover.
function relTimeFrom(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
// [RATE HISTORY] map sentinel_price_history.source -> [label, colour].
function rateSourceBadge(src: string): [string, string] {
  const s = (src || "").toUpperCase();
  if (s === "OVERRIDE") return ["Override", "#C8A66E"];
  if (s === "MANUAL" || s === "HOTEL_USER") return ["Manual", "#7A8494"];
  if (s === "SYNC" || s === "IMPORT") return ["PMS", "#4E5868"];
  return ["AI", "#38C6BA"];
}

export function HotelRateWindow({ allHotels, userHotels }: HotelRateWindowProps) {
  // --- STATE ---
  const [selectedHotelId, setSelectedHotelId] = useState<string>(
    () => localStorage.getItem("sentinel_last_hotel_id") || "",
  );
  const [hotelConfigs, setHotelConfigs] = useState<any[]>([]);
  const [pmsIdMap, setPmsIdMap] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [nightsToView, setNightsToView] = useState("30");

  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingEffectiveCell, setEditingEffectiveCell] = useState<
    string | null
  >(null);
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());
  const [hoveredAiCell, setHoveredAiCell] = useState<string | null>(null);
  const [paceCurves, setPaceCurves] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    aiPredictions,
    aiApprovedPending,
    calendarData,
    pickupWindow,
    setPickupWindow,
    pendingOverrides,
    savedOverrides,
    calcState,
    geniusPct,
    isLoading,
    isSubmitting,
    error,
    loadRates,
    setOverride,
    clearOverride,
    submitChanges,
    rateOverrides, // [OVERRIDE v1]
    removeRateOverride, // [OVERRIDE v1]
  } = useRateGrid();

  // --- INIT ---
  useEffect(() => {
    if (!userHotels || userHotels.length === 0) return;

    const init = async () => {
      let ids: Record<string, string> = {};
      try {
        ids = await getPmsPropertyIds();
      } catch {
        // Non-admin users may not have access — continue without PMS IDs
      }

      // Only include hotels that have a sentinel config (managed + enabled)
      const configChecks = await Promise.all(
        userHotels.map(async (h: any) => {
          const hid = h.hotel_id || h.property_id;
          try {
            const res = await fetch(`/api/sentinel/hotel-config/${hid}`);
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.config?.sentinel_enabled) {
                return { hotel_id: hid, ...json.config };
              }
            }
          } catch {}
          return null;
        }),
      );
      const list = configChecks.filter(Boolean);
      setHotelConfigs(list);
      setPmsIdMap(ids);

      // Default to the first hotel if none selected
      if (!selectedHotelId && list.length > 0) {
        setSelectedHotelId(String(list[0].hotel_id));
      }
    };
    init();
  }, [userHotels]);

  // Load hotel config + pace curves when hotel changes
  useEffect(() => {
    if (!selectedHotelId) return;
    const loadData = async () => {
      try {
        // Fetch sentinel config for this hotel (base_room_type_id, etc.)
        const configRes = await fetch(`/api/sentinel/hotel-config/${selectedHotelId}`);
        if (configRes.ok) {
          const configJson = await configRes.json();
          if (configJson.success && configJson.config) {
            setHotelConfigs((prev) =>
              prev.map((h) =>
                String(h.hotel_id) === selectedHotelId
                  ? { ...h, ...configJson.config }
                  : h,
              ),
            );
          }
        }

        const paceRes = await fetch(
          `/api/sentinel/pace-curves/${selectedHotelId}`,
        );
        if (paceRes.ok) {
          const json = await paceRes.json();
          setPaceCurves(Array.isArray(json.data) ? json.data : []);
        }
      } catch (err) {
        console.error("Failed to load hotel data", err);
      }
    };
    loadData();
  }, [selectedHotelId]);

  // --- MEMOIZED HELPERS ---
  const selectedHotel = useMemo(() => {
    const cfg = hotelConfigs.find(
      (c) => String(c.hotel_id) === selectedHotelId,
    );
    const details = allHotels.find(
      (h) => String(h.hotel_id || h.property_id) === selectedHotelId,
    );
    return {
      id: selectedHotelId,
      name: details?.property_name || `Hotel ${selectedHotelId}`,
      baseRoomTypeId: cfg?.base_room_type_id,
      pmsPropertyId: pmsIdMap[selectedHotelId],
    };
  }, [selectedHotelId, hotelConfigs, allHotels, pmsIdMap]);

  const visibleData = useMemo(() => {
    const startStr = startDate.toISOString().split("T")[0];
    const startIndex = calendarData.findIndex((d) => d.date === startStr);

    // Fallback if date not found (e.g. far future)
    let safeStart = startIndex;
    if (startIndex === -1) {
      const firstAvailable = calendarData.findIndex((d) => d.date >= startStr);
      safeStart = firstAvailable !== -1 ? firstAvailable : 0;
    }

    return calendarData.slice(safeStart, safeStart + parseInt(nightsToView));
  }, [calendarData, startDate, nightsToView]);

  const amberDates = useMemo(() => {
    const s = new Set<string>();
    visibleData.forEach((d) => {
      if (d.isDailyMinOverride && d.guardrailMin < d.monthlyMinDefault) {
        s.add(d.date);
      }
    });
    return s;
  }, [visibleData]);

  const getColBg = (date: string) => {
    if (hoveredColumn === date) return "rgba(57,189,248,0.04)";
    if (amberDates.has(date)) return "rgba(245, 158, 11, 0.06)";
    return "transparent";
  };

  // Helper to get Pace Value
  const getPaceValue = (dateStr: string) => {
    if (!paceCurves.length || !hotelConfigs.length) return null;

    const config = hotelConfigs.find(
      (c) => String(c.hotel_id) === selectedHotelId,
    );
    if (!config?.seasonality_profile) return null;

    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const daysOut = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysOut < 0) return null;

    const monthKey = String(targetDate.getMonth() + 1);
    let tier = config.seasonality_profile[monthKey];

    if (!tier) return null;
    tier = String(tier).toLowerCase();
    if (tier === "medium") tier = "mid";

    const curve = paceCurves.find(
      (c) => String(c.season_tier).toLowerCase() === tier,
    );
    if (!curve || !curve.curve_data) return null;

    const val = curve.curve_data[daysOut];
    return val !== undefined ? val : null;
  };

  // Helper for Seasonality Tier Display
  const getSeasonalityTier = (dateStr: string) => {
    if (!hotelConfigs.length) return "-";
    const config = hotelConfigs.find(
      (c) => String(c.hotel_id) === selectedHotelId,
    );
    if (!config?.seasonality_profile) return "-";

    const targetDate = new Date(dateStr);
    const monthKey = String(targetDate.getMonth() + 1);
    const tier = config.seasonality_profile[monthKey];

    if (!tier) return "-";
    if (tier === "mid" || tier === "medium") return "MED";
    return tier.toUpperCase();
  };

  // --- HANDLERS ---
  const handleLoad = async () => {
    let baseRoomTypeId = selectedHotel.baseRoomTypeId;

    // If config hasn't loaded yet, fetch it directly
    if (!baseRoomTypeId) {
      try {
        const res = await fetch(`/api/sentinel/hotel-config/${selectedHotelId}`);
        if (res.ok) {
          const json = await res.json();
          baseRoomTypeId = json.config?.base_room_type_id;
          if (baseRoomTypeId) {
            setHotelConfigs((prev) =>
              prev.map((h) =>
                String(h.hotel_id) === selectedHotelId
                  ? { ...h, ...json.config }
                  : h,
              ),
            );
          }
        }
      } catch {}
    }

    if (!baseRoomTypeId) {
      toast.error("Hotel has no Base Room Type configured.");
      return;
    }
    loadRates(selectedHotelId, baseRoomTypeId);
  };

  const toggleRow = (row: string) => {
    setHiddenRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  };

  const getToggleButtonStyle = (isHidden: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0px 10px",
    height: "24px",
    borderRadius: "4px",
    fontSize: "12px",
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
    backgroundColor: isHidden ? "#1E2330" : "rgba(57, 189, 248, 0.1)",
    color: isHidden ? "#4E5868" : "#38C6BA",
  });

  // [RATE HISTORY] read-only audit popover for a single PMS-rate cell.
  // Display-only: reads sentinel_price_history; never writes, queues, or pushes.
  const [historyCell, setHistoryCell] = useState<{
    date: string;
    label: string;
    liveRate: number;
    floor: number;
    rect: { left: number; right: number; top: number; bottom: number; width: number };
  } | null>(null);
  const [historyRows, setHistoryRows] = useState<RateHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyReqRef = useRef(0);

  const openRateHistory = async (day: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(day.liveRate > 0) || !selectedHotel.baseRoomTypeId) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHistoryCell({
      date: day.date,
      label: `${day.dayOfWeek} ${day.dayNumber} ${day.month}`,
      liveRate: day.liveRate,
      floor: day.guardrailMin || day.monthlyMinDefault || 0,
      rect: {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
      },
    });
    setHistoryRows([]);
    setHistoryLoading(true);
    const reqId = ++historyReqRef.current;
    const rows = await getRateHistory(
      selectedHotelId,
      String(selectedHotel.baseRoomTypeId),
      day.date,
      10,
    );
    if (historyReqRef.current === reqId) {
      setHistoryRows(rows);
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!historyCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryCell(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyCell]);

  // --- RENDER ---
  return (
    <div style={styles.page}>
      <style>{`
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-track { background: #121519; border-top: 1px solid #1E2330; }
        ::-webkit-scrollbar-thumb { background: #1E2330; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #38C6BA; }
        .rm-hist-cell:hover { background: rgba(56,198,186,0.12) !important; }
        .rm-hist-cell:hover .rm-hist-ic { opacity: 0.55 !important; }
      `}</style>

      {/* [RATE HISTORY] read-only audit popover (display-only, no push impact) */}
      {historyCell &&
        createPortal(
          (() => {
            const W = 240;
            const rect = historyCell.rect;
            const left = Math.max(
              8,
              Math.min(
                rect.left + window.scrollX + rect.width / 2 - W / 2,
                window.scrollX + window.innerWidth - W - 8,
              ),
            );
            const estH = 340;
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const openAbove = spaceBelow < estH && spaceAbove > spaceBelow;
            const top = openAbove
              ? rect.top + window.scrollY - 8
              : rect.bottom + window.scrollY + 8;
            const availH = openAbove ? spaceAbove : spaceBelow;
            const listMax = Math.min(260, Math.max(120, availH - 130));
            const vals = historyRows.map((r) => r.newPrice).slice().reverse();
            const floor = historyCell.floor;
            const base = vals.length ? vals : [historyCell.liveRate];
            const sw = W - 28;
            const sh = 38;
            const sp = 4;
            const lo = Math.min(floor > 0 ? floor : Infinity, ...base);
            const hi = Math.max(historyCell.liveRate, ...base);
            const span = hi - lo || 1;
            const spx = (i: number) =>
              sp + (vals.length > 1 ? (i * (sw - 2 * sp)) / (vals.length - 1) : 0);
            const spy = (v: number) =>
              sp + (sh - 2 * sp) * (1 - (v - lo) / span);
            const poly = vals
              .map((v, i) => `${spx(i).toFixed(1)},${spy(v).toFixed(1)}`)
              .join(" ");
            return (
              <>
                <div
                  onClick={() => setHistoryCell(null)}
                  style={{ position: "fixed", inset: 0, zIndex: 90 }}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top,
                    left,
                    width: W,
                    transform: openAbove ? "translateY(-100%)" : undefined,
                    zIndex: 100,
                    background: "#1C2228",
                    border: "1px solid #2A323D",
                    borderRadius: 10,
                    boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 12px 9px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        color: "#C8A66E",
                      }}
                    >
                      Live PMS Rate · last 10 changes
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#F3F5F7",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{historyCell.label}</span>
                      <span style={{ color: "#38C6BA" }}>
                        £{Math.round(historyCell.liveRate)}
                      </span>
                    </div>
                    <span
                      onClick={() => setHistoryCell(null)}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 10,
                        color: "#4E5868",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      ✕
                    </span>
                  </div>

                  {historyLoading ? (
                    <div
                      style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        color: "#4E5868",
                        fontSize: 11,
                      }}
                    >
                      Loading…
                    </div>
                  ) : historyRows.length === 0 ? (
                    <div
                      style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        color: "#4E5868",
                        fontSize: 11,
                      }}
                    >
                      No changes recorded.
                    </div>
                  ) : (
                    <div style={{ maxHeight: listMax, overflowY: "auto" }}>
                      {historyRows.map((row, k) => {
                        const older = historyRows[k + 1]?.newPrice;
                        const dir =
                          older == null
                            ? ""
                            : row.newPrice < older
                              ? "dn"
                              : row.newPrice > older
                                ? "up"
                                : "";
                        const arr =
                          dir === "dn" ? "▼" : dir === "up" ? "▲" : "";
                        const [stxt, scol] = rateSourceBadge(row.source);
                        return (
                          <div
                            key={k}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "44px 1fr auto",
                              gap: 6,
                              alignItems: "center",
                              padding: "6px 12px",
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                              fontSize: 11,
                            }}
                          >
                            <span style={{ color: "#4E5868" }}>
                              {relTimeFrom(row.createdAt)}
                            </span>
                            <span
                              style={{
                                color: "#F3F5F7",
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              £{Math.round(row.newPrice)}
                              {arr && (
                                <span
                                  style={{
                                    fontSize: 8,
                                    marginLeft: 4,
                                    fontWeight: 400,
                                    color:
                                      dir === "dn"
                                        ? "rgba(239,68,68,0.8)"
                                        : "rgba(52,208,104,0.85)",
                                  }}
                                >
                                  {arr}
                                </span>
                              )}
                            </span>
                            <span
                              style={{
                                fontSize: 7.5,
                                fontWeight: 700,
                                letterSpacing: 0.3,
                                textTransform: "uppercase",
                                padding: "2px 6px",
                                borderRadius: 999,
                                color: scol,
                                background: `${scol}1f`,
                                border: `1px solid ${scol}44`,
                                justifySelf: "end",
                              }}
                            >
                              {stxt}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!historyLoading && vals.length > 1 && (
                    <div
                      style={{
                        padding: "9px 12px 11px",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 8.5,
                          color: "#4E5868",
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span>trend</span>
                        {floor > 0 && <span>floor £{Math.round(floor)}</span>}
                      </div>
                      <svg
                        width="100%"
                        height={sh}
                        viewBox={`0 0 ${sw} ${sh}`}
                        preserveAspectRatio="none"
                      >
                        {floor > 0 && (
                          <line
                            x1={sp}
                            y1={spy(floor).toFixed(1)}
                            x2={sw - sp}
                            y2={spy(floor).toFixed(1)}
                            stroke="#C8A66E"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            opacity={0.5}
                          />
                        )}
                        <polyline
                          points={poly}
                          fill="none"
                          stroke="#38C6BA"
                          strokeWidth={1.6}
                        />
                        <circle
                          cx={spx(vals.length - 1).toFixed(1)}
                          cy={spy(vals[vals.length - 1]).toFixed(1)}
                          r={2.4}
                          fill="#F3F5F7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </>
            );
          })(),
          document.body,
        )}

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>My Rates</h1>
          <p style={styles.subtitle}>
            View and manage your daily room rates
          </p>
        </div>

        {/* Controls Card */}
        <div style={styles.card}>
          <div style={styles.flexBetween}>
            <div style={styles.flexRow}>
              {/* Hotel Select */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Select Hotel</label>
                <Select
                  value={selectedHotelId}
                  onValueChange={(v) => {
                    setSelectedHotelId(v);
                    localStorage.setItem("sentinel_last_hotel_id", v);
                  }}
                >
                  <SelectTrigger
                    className="text-sm"
                    style={{
                      width: "280px",
                      minWidth: "280px",
                      height: "40px",
                      backgroundColor: "#0C0E12",
                      borderColor: "#1E2330",
                      color: "#F3F5F7",
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      width: "280px",
                      maxWidth: "280px",
                      minWidth: "280px",
                      backgroundColor: "#121519",
                      borderColor: "#1E2330",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: "#F3F5F7",
                      padding: "4px",
                    }}
                  >
                    {[...hotelConfigs]
                      .sort((a, b) => {
                        const nameA = allHotels.find((h) => (h.hotel_id || h.property_id) === a.hotel_id)?.property_name || "";
                        const nameB = allHotels.find((h) => (h.hotel_id || h.property_id) === b.hotel_id)?.property_name || "";
                        return nameA.localeCompare(nameB);
                      })
                      .map((c) => {
                        const h = allHotels.find(
                          (ah) => (ah.hotel_id || ah.property_id) === c.hotel_id,
                        );
                        return (
                          <SelectItem
                            key={c.hotel_id}
                            value={String(c.hotel_id)}
                            style={{ color: "#F3F5F7", borderRadius: "4px" }}
                          >
                            <span
                              style={{
                                display: "block",
                                maxWidth: "220px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                paddingRight: "8px",
                              }}
                            >
                              {h?.property_name || c.hotel_id}
                            </span>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div style={styles.formGroup}>
                <DatePickerCalendar
                  value={format(startDate, "yyyy-MM-dd")}
                  onChange={(dateStr) => setStartDate(new Date(dateStr))}
                  label="Start Date"
                />
              </div>

              {/* Nights */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Nights</label>
                <Select value={nightsToView} onValueChange={setNightsToView}>
                  <SelectTrigger
                    className="text-sm"
                    style={{
                      width: "180px",
                      height: "40px",
                      backgroundColor: "#0C0E12",
                      borderColor: "#1E2330",
                      color: "#F3F5F7",
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: "#121519",
                      borderColor: "#1E2330",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: "#F3F5F7",
                    }}
                  >
                    <SelectItem value="30">30 Nights</SelectItem>
                    <SelectItem value="60">60 Nights</SelectItem>
                    <SelectItem value="90">90 Nights</SelectItem>
                    <SelectItem value="180">180 Nights</SelectItem>
                    <SelectItem value="365">365 Nights</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pickup Window */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Pickup vs</label>
                <Select
                  value={pickupWindow.toString()}
                  onValueChange={(v) => setPickupWindow(parseInt(v))}
                >
                  <SelectTrigger
                    className="text-sm"
                    style={{
                      width: "180px",
                      height: "40px",
                      backgroundColor: "#0C0E12",
                      borderColor: "#1E2330",
                      color: "#F3F5F7",
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: "#121519",
                      borderColor: "#1E2330",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: "#F3F5F7",
                    }}
                  >
                    <SelectItem value="1">Yesterday</SelectItem>
                    <SelectItem value="3">3 Days Ago</SelectItem>
                    <SelectItem value="7">7 Days Ago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <Button
                onClick={handleLoad}
                disabled={isLoading || !selectedHotelId}
                style={{ backgroundColor: "#38C6BA", color: "#14181D" }}
                className="h-9 text-sm font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CalendarIcon className="w-4 h-4 mr-2" />
                )}{" "}
                Load Rates
              </Button>
            </div>
          </div>
        </div>

        {/* --- GRID & VISUALIZER --- */}
        {calendarData.length > 0 ? (
          <>
            <OccupancyVisualizer
              selectedHotel={selectedHotel.name}
              startDate={startDate}
              hoveredDay={
                hoveredColumn
                  ? visibleData.findIndex((d) => d.date === hoveredColumn)
                  : null
              }
              data={calendarData.map((d) => ({
                ...d,
                pmsRate: d.liveRate,
                aiShadowRate: aiPredictions[d.date]?.rate
                  ? Math.max(aiPredictions[d.date].rate, d.guardrailMin || 0)
                  : undefined,
                isOverride: rateOverrides[d.date] !== undefined, // [NEW] gold dot for override days
              }))}
            />

            {/* Grid Section (Unified Container) */}
            <div style={styles.gridSection}>
              {/* Header: Visibility + Submit */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {/* Visibility Toolbar */}
                <div style={styles.rowVisibilityContainer} className="mb-0">
                  <div style={styles.rowVisibilityInner}>
                    <div style={styles.rowVisibilityLeft}>
                      <span style={styles.rowVisibilityLabel}>
                        Row Visibility:
                      </span>
                      <div style={styles.rowVisibilityButtons}>
                        <button
                          onClick={() => toggleRow("adr")}
                          style={getToggleButtonStyle(hiddenRows.has("adr"))}
                        >
                          {hiddenRows.has("adr") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>ADR</span>
                        </button>
                        <button
                          onClick={() => toggleRow("occupancy")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("occupancy"),
                          )}
                        >
                          {hiddenRows.has("occupancy") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Occupancy</span>
                        </button>
                        <button
                          onClick={() => toggleRow("roomsAvailable")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("roomsAvailable"),
                          )}
                        >
                          {hiddenRows.has("roomsAvailable") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Available</span>
                        </button>
                        <button
                          onClick={() => toggleRow("minRate")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("minRate"),
                          )}
                        >
                          {hiddenRows.has("minRate") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Min Rate</span>
                        </button>
                        <button
                          onClick={() => toggleRow("floorRate")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("floorRate"),
                          )}
                        >
                          {hiddenRows.has("floorRate") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Floor Rate</span>
                        </button>
                        <button
                          onClick={() => toggleRow("pmsRates")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("pmsRates"),
                          )}
                        >
                          {hiddenRows.has("pmsRates") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Live PMS Rate</span>
                        </button>
                        <button
                          onClick={() => toggleRow("sellRate")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("sellRate"),
                          )}
                        >
                          {hiddenRows.has("sellRate") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Sell Rate</span>
                        </button>
                        <button
                          onClick={() => toggleRow("effectiveRate")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("effectiveRate"),
                          )}
                        >
                          {hiddenRows.has("effectiveRate") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Target Sell Rate</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={() =>
                    submitChanges(
                      selectedHotelId,
                      selectedHotel.pmsPropertyId || "",
                      selectedHotel.baseRoomTypeId || "",
                    )
                  }
                  disabled={
                    isSubmitting || Object.keys(pendingOverrides).length === 0
                  }
                  style={{ backgroundColor: "#38C6BA", color: "#14181D" }}
                  className="h-9 text-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2" />
                  )}
                  Submit {Object.keys(pendingOverrides).length} Change(s)
                </Button>
              </div>

              {/* Table Container */}
              <div style={styles.gridContainer}>
                <div style={styles.tableWrapper} ref={scrollRef}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      tableLayout: "fixed",
                      minWidth: `${180 + visibleData.length * 96}px`,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={styles.thSticky}>
                          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: "#4E5868", textTransform: "uppercase" }}>Metric</span>
                        </th>
                        {visibleData.map((day) => (
                          <th
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              backgroundColor:
                                hoveredColumn === day.date
                                  ? "rgba(57,189,248,0.04)"
                                  : amberDates.has(day.date)
                                    ? "rgba(245, 158, 11, 0.08)"
                                    : "transparent",
                              borderBottom: "1px solid #1E2330",
                              textAlign: "center",
                              padding: "10px 0",
                              minWidth: "96px",
                              height: 64,
                              verticalAlign: "bottom",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                color: "#4E5868",
                                fontSize: "9px",
                                textTransform: "uppercase",
                              }}
                            >
                              {day.month}
                            </div>
                            <div style={{ color: (() => { const d = new Date(day.date); const dow = d.getDay(); return (dow === 0 || dow === 6) ? "#38C6BA" : "#4E5868"; })(), fontSize: "9px", marginTop: 1 }}>
                              {day.dayOfWeek}
                            </div>
                            <div
                              style={{
                                color: "#F3F5F7",
                                fontSize: "15px",
                                fontWeight: 600,
                                marginTop: "2px",
                              }}
                            >
                              {day.dayNumber}
                            </div>
                            {(pendingOverrides[day.date] !== undefined ||
                              savedOverrides[day.date] !== undefined) && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "6px",
                                  right: "6px",
                                }}
                              >
                                <User
                                  size={10}
                                  color={
                                    pendingOverrides[day.date]
                                      ? "#f59e0b"
                                      : "#7A8494"
                                  }
                                />
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 1. AI Status Row */}
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>AI Status</td>
                        {visibleData.map((day) => {
                          let text = "SENTINEL",
                            color = "#38C6BA";

                          const currentSource = (
                            day.source || ""
                          ).toUpperCase();

                          if (day.isFrozen) {
                            text = "FROZEN";
                            color = "#f59e0b";
                          } else if (pendingOverrides[day.date]) {
                            text = aiApprovedPending.has(day.date)
                              ? "SENTINEL"
                              : "PENDING";
                            color = aiApprovedPending.has(day.date)
                              ? "#38C6BA"
                              : "#f59e0b";
                          } else if (rateOverrides[day.date] !== undefined) {
                            // [OVERRIDE v1] user-pinned rate wins over AI
                            text = "OVERRIDE";
                            color = "#f59e0b";
                          } else if (
                            currentSource === "SENTINEL" ||
                            currentSource === "AI_AUTO" ||
                            currentSource === "AI_SUGGESTED"
                          ) {
                            text = "SENTINEL";
                            color = "#38C6BA";
                          } else if (currentSource === "SYNC") {
                            text = "SYNC";
                            color = "#4E5868";
                          } else if (
                            savedOverrides[day.date] ||
                            currentSource === "MANUAL"
                          ) {
                            text = "MANUAL";
                            color = "#7A8494";
                          }
                          const isOverride = text === "OVERRIDE";
                          return (
                            <td
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={{
                                textAlign: "center",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                width: "96px",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                backgroundColor:
                                  getColBg(day.date),
                              }}
                            >
                              <span
                                onClick={
                                  isOverride
                                    ? () => removeRateOverride(selectedHotelId, day.date)
                                    : undefined
                                }
                                title={isOverride ? "Click to clear override" : undefined}
                                style={{
                                  color,
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  letterSpacing: 0.3,
                                  textTransform: "uppercase",
                                  cursor: isOverride ? "pointer" : "default",
                                  textDecoration: isOverride ? "underline dotted" : "none",
                                }}
                              >
                                {text}
                              </span>
                              {(day.isFrozen || text === "MANUAL") && (
                                <Lock
                                  size={10}
                                  color={color}
                                  style={{
                                    marginLeft: 4,
                                    display: "inline",
                                    opacity: 0.6,
                                  }}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* 2. Metrics Rows */}
                      {!hiddenRows.has("adr") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            ADR
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={{
                                textAlign: "center",
                                color: "#B0B8C4",
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                backgroundColor:
                                  getColBg(day.date),
                                opacity: day.isFrozen ? 0.4 : 1,
                              }}
                            >
                              £{Math.round(day.adr)}
                            </td>
                          ))}
                        </tr>
                      )}
                      {!hiddenRows.has("occupancy") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            Occupancy
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              onMouseEnter={() => setHoveredColumn(day.date)}
                              onMouseLeave={() => setHoveredColumn(null)}
                              style={{
                                textAlign: "center",
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                backgroundColor:
                                  getColBg(day.date),
                                color:
                                  day.occupancy > 80
                                    ? "#38C6BA"
                                    : day.occupancy > 60
                                      ? "#B0B8C4"
                                      : "#C8A66E",
                              }}
                            >
                              {Math.round(day.occupancy)}%
                            </td>
                          ))}
                        </tr>
                      )}

                      {!hiddenRows.has("roomsAvailable") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <BedDouble size={14} color="#7A8494" /> Available
                            </div>
                          </td>
                          {visibleData.map((day) => {
                            const todayKey = (() => {
                              const d = new Date();
                              d.setHours(0, 0, 0, 0);
                              return d.toISOString().substring(0, 10);
                            })();
                            const isPast = day.date < todayKey;
                            return (
                              <td
                                key={day.date}
                                onMouseEnter={() => setHoveredColumn(day.date)}
                                onMouseLeave={() => setHoveredColumn(null)}
                                style={{
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                  height: "44px",
                                  verticalAlign: "middle",
                                  fontVariantNumeric: "tabular-nums",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  backgroundColor: getColBg(day.date),
                                  color: isPast ? "#5C6470" : "#B0B8C4",
                                }}
                              >
                                {isPast ? "—" : (day.roomsAvailable ?? 0)}
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* Divider: info → guardrails */}
                      <tr>
                        <td style={{ ...styles.tdSticky, height: 10, borderBottom: "none", padding: 0 }} />
                        {visibleData.map((day) => (
                          <td key={day.date} style={{ height: 10, backgroundColor: getColBg(day.date) }}
                            onMouseEnter={() => setHoveredColumn(day.date)} onMouseLeave={() => setHoveredColumn(null)} />
                        ))}
                      </tr>

                      {!hiddenRows.has("minRate") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            Min Rate
                          </td>
                          {visibleData.map((day) => {
                            const isBelowMonthly = day.isDailyMinOverride && day.guardrailMin < day.monthlyMinDefault;
                            return (
                              <td
                                key={day.date}
                                style={{
                                  textAlign: "center",
                                  color: isBelowMonthly ? "#ef4444" : "#7A8494",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                  height: "44px",
                                  verticalAlign: "middle",
                                  fontVariantNumeric: "tabular-nums",
                                  backgroundColor: isBelowMonthly
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : getColBg(day.date),
                                  borderBottom: isBelowMonthly ? "2px solid #ef4444" : "1px solid rgba(255,255,255,0.04)",
                                }}
                                title={isBelowMonthly ? `Monthly default: £${Math.round(day.monthlyMinDefault)}` : undefined}
                              >
                                {day.guardrailMin > 0 ? `£${Math.round(day.guardrailMin)}` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                      {!hiddenRows.has("floorRate") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            Floor (LMF)
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                textAlign: "center",
                                color: "#7A8494",
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                backgroundColor:
                                  getColBg(day.date),
                              }}
                            >
                              {day.floorRateLMF
                                ? `£${Math.round(day.floorRateLMF)}`
                                : "-"}
                            </td>
                          ))}
                        </tr>
                      )}


                      {!hiddenRows.has("pmsRates") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            Live PMS Rate
                          </td>
                          {visibleData.map((day) => {
                            const histClickable = day.liveRate > 0;
                            const histActive = historyCell?.date === day.date;
                            return (
                            <td
                              key={day.date}
                              className={histClickable ? "rm-hist-cell" : undefined}
                              onClick={
                                histClickable
                                  ? (e) => openRateHistory(day, e)
                                  : undefined
                              }
                              title={
                                histClickable
                                  ? "Click for last 10 rate changes"
                                  : undefined
                              }
                              style={{
                                textAlign: "center",
                                color: "#F3F5F7",
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                position: "relative",
                                cursor: histClickable ? "pointer" : "default",
                                backgroundColor: histActive
                                  ? "rgba(56,198,186,0.15)"
                                  : getColBg(day.date),
                                boxShadow: histActive
                                  ? "inset 0 0 0 1px rgba(56,198,186,0.4)"
                                  : undefined,
                              }}
                            >
                              {histClickable ? (
                                <span
                                  style={{
                                    borderBottom: "1px dotted #4E5868",
                                    paddingBottom: 1,
                                  }}
                                >
                                  £{Math.round(day.liveRate)}
                                </span>
                              ) : (
                                "-"
                              )}
                              {histClickable && (
                                <History
                                  size={9}
                                  color="#4E5868"
                                  className="rm-hist-ic"
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    right: 5,
                                    opacity: 0,
                                  }}
                                />
                              )}
                            </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* 3. Calculations */}
                      {!hiddenRows.has("sellRate") && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ ...styles.tdSticky, color: "#7A8494", fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            Current Sell Rate
                          </td>
                          {visibleData.map((day) => {
                            let c = 0;
                            if (day.liveRate > 0 && calcState) {
                              c = calculateSellRate(
                                day.liveRate,
                                geniusPct,
                                calcState,
                                day.date,
                                { includeTargeting: false },
                              );
                            }
                            return (
                              <td
                                key={day.date}
                                style={{
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                  height: "44px",
                                  verticalAlign: "middle",
                                  fontWeight: "bold",
                                  fontVariantNumeric: "tabular-nums",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  color: c > 0 ? "#38C6BA" : "#4E5868",
                                  backgroundColor: getColBg(day.date),
                                  opacity: day.isFrozen ? 0.4 : 1,
                                }}
                              >
                                {c > 0 ? `£${Math.round(c)}` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* Divider: guardrails → ai */}
                      <tr>
                        <td style={{ ...styles.tdSticky, height: 10, borderBottom: "none", padding: 0 }} />
                        {visibleData.map((day) => (
                          <td key={day.date} style={{ height: 10, backgroundColor: getColBg(day.date) }}
                            onMouseEnter={() => setHoveredColumn(day.date)} onMouseLeave={() => setHoveredColumn(null)} />
                        ))}
                      </tr>

                      {/* Sentinel Row (Blue) - Interactive Ghost Mode */}
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          backgroundColor: "rgba(57, 189, 248, 0.03)",
                        }}
                      >
                        <td
                          style={{
                            ...styles.tdSticky,
                            backgroundColor: "#121519",
                            padding: "0 20px",
                            borderLeft: "3px solid #38C6BA",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            Sentinel AI Rate
                          </span>
                        </td>
                        {visibleData.map((day) => {
                          const pred = aiPredictions[day.date];
                          const isApplied =
                            aiApprovedPending.has(day.date) ||
                            day.source === "SENTINEL";

                          const isHovered = hoveredAiCell === day.date;
                          const showArrow =
                            pred && !isApplied && !day.isFrozen && isHovered;

                          return (
                            <td
                              key={day.date}
                              onMouseEnter={() => setHoveredAiCell(day.date)}
                              onMouseLeave={() => setHoveredAiCell(null)}
                              style={{
                                textAlign: "center",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                position: "relative",
                                color: isApplied
                                  ? "#38C6BA"
                                  : pred
                                    ? "#38C6BA"
                                    : "#7A8494",
                                fontSize: "13px",
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                transition: "all 0.2s",
                                cursor:
                                  pred && !day.isFrozen ? "pointer" : "default",
                                backgroundColor: hoveredColumn === day.date
                                    ? "rgba(57,189,248,0.1)"
                                    : amberDates.has(day.date)
                                      ? "rgba(245, 158, 11, 0.06)"
                                    : "transparent",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  height: "100%",
                                  gap: "4px",
                                }}
                              >
                                <span>
                                  {pred ? `£${Math.round(pred.rate)}` : "-"}
                                </span>

                                {/* Hover Arrow Action */}
                                {showArrow && (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (pred) {
                                        const clampedRate = Math.max(pred.rate, day.guardrailMin || 0);
                                        setOverride(day.date, clampedRate);
                                        toast.success(
                                          `AI Rate £${clampedRate} applied`,
                                        );
                                      }
                                    }}
                                    style={{
                                      position: "absolute",
                                      bottom: "2px",
                                      backgroundColor: "#38C6BA",
                                      borderRadius: "50%",
                                      width: "16px",
                                      height: "16px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                                      zIndex: 10,
                                    }}
                                  >
                                    <ArrowDown
                                      size={10}
                                      color="#14181D"
                                      strokeWidth={3}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Divider: ai → editable */}
                      <tr>
                        <td style={{ ...styles.tdSticky, height: 10, borderBottom: "none", padding: 0 }} />
                        {visibleData.map((day) => (
                          <td key={day.date} style={{ height: 10, backgroundColor: getColBg(day.date) }}
                            onMouseEnter={() => setHoveredColumn(day.date)} onMouseLeave={() => setHoveredColumn(null)} />
                        ))}
                      </tr>

                      {!hiddenRows.has("effectiveRate") && (
                        <tr
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            backgroundColor: "rgba(56,198,186,0.03)",
                          }}
                        >
                          <td
                            style={{
                              ...styles.tdSticky,
                              backgroundColor: "#121519",
                              borderLeft: "3px solid #38C6BA",
                            }}
                          >
                            <span style={{ color: "#38C6BA", fontWeight: 600 }}>
                              Target Sell Rate
                            </span>
                          </td>
                          {visibleData.map((day) => {
                            const overrideVal =
                              pendingOverrides[day.date] ??
                              savedOverrides[day.date];
                            let effectiveVal = 0;

                            if (overrideVal && calcState) {
                              effectiveVal = calculateSellRate(
                                overrideVal,
                                geniusPct,
                                calcState,
                                day.date,
                                { includeTargeting: false },
                              );
                            }

                            return (
                              <td
                                key={day.date}
                                onClick={() => {
                                  if (!day.isFrozen)
                                    setEditingEffectiveCell(day.date);
                                }}
                                style={{
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                  height: "44px",
                                  verticalAlign: "middle",
                                  fontWeight: "bold",
                                  fontVariantNumeric: "tabular-nums",
                                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                                  color:
                                    effectiveVal > 0 ? "#38C6BA" : "#4E5868",
                                  backgroundColor:
                                    editingEffectiveCell === day.date
                                      ? "rgba(57, 189, 248, 0.04)"
                                      : getColBg(day.date),
                                  opacity: day.isFrozen ? 0.4 : 1,
                                  cursor: day.isFrozen
                                    ? "not-allowed"
                                    : "pointer",
                                }}
                              >
                                {editingEffectiveCell === day.date ? (
                                  <input
                                    autoFocus
                                    style={{
                                      ...styles.input,
                                      color: "#F3F5F7",
                                      fontWeight: "bold",
                                      backgroundColor:
                                        "rgba(57, 189, 248, 0.1)",
                                      border: "1px solid #38C6BA",
                                    }}
                                    defaultValue={
                                      effectiveVal > 0
                                        ? Math.round(effectiveVal)
                                        : ""
                                    }
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => {
                                      const v = parseFloat(e.target.value);
                                      if (!isNaN(v) && v > 0 && calcState) {
                                        const reqOverride =
                                          calculateRequiredOverride(
                                            v,
                                            geniusPct,
                                            calcState,
                                            day.date,
                                            { includeTargeting: false },
                                          );

                                        const roundedOverride =
                                          Math.round(reqOverride);

                                        if (
                                          day.guardrailMin > 0 &&
                                          roundedOverride < day.guardrailMin
                                        ) {
                                          toast.warning(
                                            `Base rate £${roundedOverride} is below min £${Math.round(day.guardrailMin)}. Sentinel may clamp this — ask an admin to adjust the min rate if needed.`,
                                            { style: { backgroundColor: "#121519", border: "1px solid #ef4444", color: "#ef4444" } }
                                          );
                                        }
                                        setOverride(
                                          day.date,
                                          roundedOverride,
                                        );
                                      } else if (e.target.value === "") {
                                        clearOverride(day.date);
                                      } else if (!isNaN(v) && v > 0 && !calcState) {
                                        toast.error(
                                          "Rate calculator isn't configured for this hotel, so a target sell rate can't be converted. Use the PMS Override row instead, or contact an admin.",
                                          { style: { backgroundColor: "#121519", border: "1px solid #ef4444", color: "#ef4444" } },
                                        );
                                      }
                                      setEditingEffectiveCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                      }
                                    }}
                                  />
                                ) : effectiveVal > 0 ? (
                                  `£${Math.round(effectiveVal)}`
                                ) : (
                                  "-"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                      {/* 4. PMS Override Input */}
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          backgroundColor: "rgba(56,198,186,0.03)",
                        }}
                      >
                        <td style={{
                          ...styles.tdSticky,
                          backgroundColor: "#121519",
                          borderLeft: "3px solid #38C6BA",
                        }}>
                          <span style={{ color: "#38C6BA", fontWeight: 600 }}>PMS Override</span>
                        </td>
                        {visibleData.map((day) => {
                          const savedVal = savedOverrides[day.date];
                          const pendingVal = pendingOverrides[day.date];
                          const displayVal = pendingVal ?? savedVal;
                          const isPending = pendingVal !== undefined;
                          const hasAny = displayVal !== undefined;

                          return (
                            <td
                              key={day.date}
                              onClick={() =>
                                !day.isFrozen && setEditingCell(day.date)
                              }
                              style={{
                                textAlign: "center",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                borderBottom: "1px solid rgba(255,255,255,0.04)",
                                cursor: day.isFrozen
                                  ? "not-allowed"
                                  : "pointer",
                                backgroundColor:
                                  editingCell === day.date
                                    ? "transparent"
                                    : isPending
                                      ? "rgba(250, 255, 106, 0.06)"
                                      : hasAny
                                        ? "rgba(243, 245, 247, 0.03)"
                                        : "transparent",
                                opacity: day.isFrozen ? 0.5 : 1,
                              }}
                            >
                              {editingCell === day.date ? (
                                <input
                                  autoFocus
                                  style={styles.input}
                                  defaultValue={
                                    displayVal ? Math.round(displayVal) : ""
                                  }
                                  onFocus={(e) => e.target.select()}
                                  onBlur={(e) => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v) && v > 0) {
                                      if (
                                        day.guardrailMin > 0 &&
                                        v < day.guardrailMin
                                      ) {
                                        toast.warning(
                                          `Override £${Math.round(v)} is below min £${Math.round(day.guardrailMin)}. Sentinel may clamp this — ask an admin to adjust the min rate if needed.`,
                                          { style: { backgroundColor: "#121519", border: "1px solid #ef4444", color: "#ef4444" } }
                                        );
                                      }
                                      setOverride(day.date, v);
                                    } else if (e.target.value === "") {
                                      clearOverride(day.date);
                                    }
                                    setEditingCell(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.currentTarget.blur();
                                    }
                                    if (e.key === "Tab") {
                                      e.preventDefault();

                                      const v = parseFloat(
                                        e.currentTarget.value,
                                      );
                                      if (!isNaN(v) && v > 0) {
                                        if (
                                          day.guardrailMin > 0 &&
                                          v < day.guardrailMin
                                        ) {
                                          toast.warning(
                                            `Override £${Math.round(v)} is below min £${Math.round(day.guardrailMin)}. Sentinel may clamp this — ask an admin to adjust the min rate if needed.`,
                                            { style: { backgroundColor: "#121519", border: "1px solid #ef4444", color: "#ef4444" } }
                                          );
                                        }
                                        setOverride(day.date, v);
                                      } else if (e.currentTarget.value === "") {
                                        clearOverride(day.date);
                                      }

                                      const currIdx = visibleData.findIndex(
                                        (d) => d.date === day.date,
                                      );
                                      if (
                                        currIdx !== -1 &&
                                        currIdx < visibleData.length - 1
                                      ) {
                                        const nextDay =
                                          visibleData[currIdx + 1];
                                        if (!nextDay.isFrozen) {
                                          setEditingCell(nextDay.date);
                                        }
                                      }
                                    }
                                  }}
                                />
                              ) : (
                                <span
                                  style={{
                                    color: isPending ? "#f59e0b" : "#38C6BA",
                                    fontWeight: isPending ? "bold" : 600,
                                    fontVariantNumeric: "tabular-nums",
                                    fontSize: "13px",
                                  }}
                                >
                                  {displayVal
                                    ? `£${Math.round(displayVal)}`
                                    : "-"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* Footer */}
                <div style={styles.footer}>
                  <Info size={14} />
                  <span>
                    Scroll to view 365 days • Click 'PMS Override' or 'Target Sell Rate' to set
                    manual rates • Live PMS sync active
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              height: "400px",
              border: "1px dashed #1E2330",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#4E5868",
            }}
          >
            <Zap className="w-12 h-12 mb-4 opacity-20" />
            <p>Select a hotel and click "Load Rates" to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
