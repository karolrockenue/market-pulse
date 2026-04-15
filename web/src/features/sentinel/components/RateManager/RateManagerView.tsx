import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Lock,
  User,
  AlertTriangle,
  Calendar as CalendarIcon,
  Zap,
  Eye,
  EyeOff,
  Loader2,
  TrendingUp,
  Activity,
  Info,
  Target,
  ArrowDown,
  Check,
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
import { R } from "@/styles/tokens";
import { OccupancyVisualizer } from "./OccupancyVisualizer";
import {
  useRateGrid,
  calculateSellRate,
  calculateRequiredOverride,
} from "../../hooks/useRateGrid";
import {
  getConfigs,
  getPmsPropertyIds,
  getSentinelStatus,
  triggerSentinelRun,
} from "../../api/sentinel.api";

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: R.bg,
    color: R.accent,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  container: {
    padding: "32px",
    maxWidth: "none",
  },

  // Header
  header: { marginBottom: "24px" },
  title: {
    color: R.accent,
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "-0.8px",
    marginBottom: "4px",
  },
  subtitle: { color: R.textDim, fontSize: "13px" },

  // Controls Card
  card: {
    backgroundColor: R.darkBand,
    border: `1px solid ${R.border}`,
    borderRadius: "10px",
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
    color: R.textDim,
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  gridSection: {
    backgroundColor: R.darkBand,
    borderRadius: "8px",
    border: `1px solid ${R.border}`,
    padding: "0",
    marginBottom: "24px",
    overflow: "hidden",
  },

  rowVisibilityContainer: {
    marginBottom: "0",
    padding: "10px 16px",
    backgroundColor: R.darkBand,
    border: "none",
    borderBottom: `1px solid ${R.sep}`,
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
    color: R.textDim,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  rowVisibilityButtons: { display: "flex", alignItems: "center", gap: "12px" },

  gridContainer: {
    position: "relative",
    minHeight: "auto",
    backgroundColor: R.darkBand,
    borderRadius: "0",
    border: "none",
    overflow: "hidden",
  },
  tableWrapper: { overflowX: "auto", paddingBottom: "4px" },

  thSticky: {
    position: "sticky",
    left: 0,
    zIndex: 20,
    backgroundColor: R.darkBand,
    borderRight: `1px solid ${R.border}`,
    borderBottom: `1px solid ${R.border}`,
    width: "180px",
    textAlign: "left",
    padding: "0 20px",
    height: 64,
    color: R.textDim,
  },
  tdSticky: {
    position: "sticky",
    left: 0,
    zIndex: 10,
    backgroundColor: R.darkBand,
    borderRight: `1px solid ${R.border}`,
    borderBottom: `1px solid ${R.sep}`,
    padding: "0 20px",
    width: "180px",
    height: "44px",
    color: R.accent,
    fontSize: "13px",
  },

  input: {
    width: "100%",
    backgroundColor: R.sidebar,
    border: `1px solid ${R.border}`,
    color: R.accent,
    textAlign: "center",
    fontSize: "13px",
    fontVariantNumeric: "tabular-nums",
    height: "28px",
    borderRadius: "4px",
    outline: "none",
  },
  footer: {
    padding: "12px",
    backgroundColor: R.darkBand,
    borderTop: `1px solid ${R.sep}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: R.textDim,
    fontSize: "12px",
  },
};

interface RateManagerViewProps {
  allHotels: any[];
}

export function RateManagerView({ allHotels }: RateManagerViewProps) {
  // --- STATE ---
  const [selectedHotelId, setSelectedHotelId] = useState<string>(
    () => localStorage.getItem("sentinel_last_hotel_id") || "",
  );
  const [sentinelConfigs, setSentinelConfigs] = useState<any[]>([]);
  const [pmsIdMap, setPmsIdMap] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [nightsToView, setNightsToView] = useState("30");

  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingEffectiveCell, setEditingEffectiveCell] = useState<
    string | null
  >(null);
  const [editingMinCell, setEditingMinCell] = useState<string | null>(null);
  const [hiddenRows, setHiddenRows] = useState<Set<string>>(new Set());
  // appliedPredictions removed (now in hook)
  const [hoveredAiCell, setHoveredAiCell] = useState<string | null>(null);
  const [paceCurves, setPaceCurves] = useState<any[]>([]);
  const [sentinelStatus, setSentinelStatus] = useState<{
    lastRun: string | null;
    changesLast24h: number;
  } | null>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [isRunningSentinel, setIsRunningSentinel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    aiPredictions,
    aiApprovedPending, // [NEW]
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
    applyAiPrediction, // [NEW]
    bulkApplyAi, // [NEW]
    submitChanges,
    saveMinRate,
  } = useRateGrid();

  // --- INIT ---
  useEffect(() => {
    const init = async () => {
      const [cfg, ids] = await Promise.all([getConfigs(), getPmsPropertyIds()]);
      // [FIX] Only include hotels where Sentinel is enabled
      const list = Object.values(cfg).filter((c: any) => c.sentinel_enabled);
      setSentinelConfigs(list);
      setPmsIdMap(ids);

      // Default to the first ENABLED hotel if none selected
      if (!selectedHotelId && list.length > 0) {
        setSelectedHotelId(String(list[0].hotel_id));
      }
    };
    init();
  }, []);

  // [NEW] Load Pace Curves, Status & Recent Jobs
  useEffect(() => {
    if (!selectedHotelId) return;
    const loadData = async () => {
      try {
        const [paceRes, statusData, jobsRes] = await Promise.all([
          fetch(`/api/sentinel/pace-curves/${selectedHotelId}`),
          getSentinelStatus(selectedHotelId),
          fetch(`/api/sentinel/recent-jobs/${selectedHotelId}`),
        ]);

        if (paceRes.ok) {
          const json = await paceRes.json();
          setPaceCurves(Array.isArray(json.data) ? json.data : []);
        }

        if (jobsRes.ok) {
          const jobs = await jobsRes.json();
          setRecentJobs(Array.isArray(jobs) ? jobs : []);
        }

        setSentinelStatus(statusData);
      } catch (err) {
        console.error("Failed to load auxiliary data", err);
      }
    };
    loadData();
  }, [selectedHotelId]);

  const handleRunSentinel = async () => {
    if (!selectedHotelId) return;
    setIsRunningSentinel(true);
    try {
      // Calculate 365 day window
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 365);

      const sStr = format(start, "yyyy-MM-dd");
      const eStr = format(end, "yyyy-MM-dd");

      // Trigger Prediction Run
      await triggerSentinelRun(selectedHotelId, sStr, eStr, "PREDICTION");

      toast.success("Sentinel Analysis Complete. Predictions updated.");

      // Refresh status after a short delay
      setTimeout(async () => {
        const s = await getSentinelStatus(selectedHotelId);
        setSentinelStatus(s);
        handleLoad(); // Reload grid
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to run Sentinel");
    } finally {
      setIsRunningSentinel(false);
    }
  };

  // --- MEMOIZED HELPERS ---
  const selectedHotel = useMemo(() => {
    const cfg = sentinelConfigs.find(
      (c) => String(c.hotel_id) === selectedHotelId,
    );
    const details = allHotels.find(
      (h) => String(h.hotel_id) === selectedHotelId,
    );
    return {
      id: selectedHotelId,
      name: details?.property_name || `Hotel ${selectedHotelId}`,
      baseRoomTypeId: cfg?.base_room_type_id,
      pmsPropertyId: pmsIdMap[selectedHotelId],
    };
  }, [selectedHotelId, sentinelConfigs, allHotels, pmsIdMap]);

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

  // Dates where daily min is overridden below monthly default — whole column gets amber tint
  const amberDates = useMemo(() => {
    const s = new Set<string>();
    visibleData.forEach((d) => {
      if (d.isDailyMinOverride && d.guardrailMin < d.monthlyMinDefault) {
        s.add(d.date);
      }
    });
    return s;
  }, [visibleData]);

  // Column background: amber for daily min override, blue for hover, else transparent
  const getColBg = (date: string, fallback = "transparent") => {
    if (hoveredColumn === date) return `${R.warmTeal}0a`;
    // No column highlight for saved daily min overrides
    return fallback;
  };

  // [NEW] Helper to get Pace Value
  const getPaceValue = (dateStr: string) => {
    if (!paceCurves.length || !sentinelConfigs.length) return null;

    const config = sentinelConfigs.find(
      (c) => String(c.hotel_id) === selectedHotelId,
    );
    if (!config?.seasonality_profile) return null;

    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize

    const diffTime = targetDate.getTime() - today.getTime();
    const daysOut = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysOut < 0) return null;

    const monthKey = String(targetDate.getMonth() + 1);
    let tier = config.seasonality_profile[monthKey];

    // [FIX] Robust Normalization
    if (!tier) return null;
    tier = String(tier).toLowerCase(); // Force lowercase string
    if (tier === "medium") tier = "mid";

    const curve = paceCurves.find(
      (c) => String(c.season_tier).toLowerCase() === tier,
    );
    if (!curve || !curve.curve_data) return null;

    const val = curve.curve_data[daysOut];
    return val !== undefined ? val : null;
  };

  // [NEW] Helper for Seasonality Tier Display
  const getSeasonalityTier = (dateStr: string) => {
    if (!sentinelConfigs.length) return "-";
    const config = sentinelConfigs.find(
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
  const handleLoad = () => {
    if (!selectedHotel.baseRoomTypeId) {
      toast.error("Hotel has no Base Room Type configured.");
      return;
    }
    loadRates(selectedHotelId, selectedHotel.baseRoomTypeId);
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
    backgroundColor: isHidden ? R.border : `${R.warmTeal}15`,
    color: isHidden ? R.textDim : R.warmTeal,
  });

  // --- RENDER ---
  return (
    <div style={styles.page}>
      <style>{`
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-track { background: ${R.darkBand}; border-top: 1px solid ${R.border}; }
        ::-webkit-scrollbar-thumb { background: ${R.border}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${R.warmTeal}; }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold, marginBottom: 6 }}>SENTINEL</div>
          <h1 style={styles.title}>Rate Manager</h1>
          <p style={styles.subtitle}>
            Super Admin • 365-Day Rate Calendar • AI + Manual Control
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
                      backgroundColor: R.sidebar,
                      borderColor: R.border,
                      color: R.accent,
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
                      backgroundColor: R.sidebar,
                      borderColor: R.border,
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: R.accent,
                      padding: "4px",
                    }}
                  >
                    {[...sentinelConfigs]
                      .sort((a, b) => {
                        const nameA = allHotels.find((h) => h.hotel_id === a.hotel_id)?.property_name || "";
                        const nameB = allHotels.find((h) => h.hotel_id === b.hotel_id)?.property_name || "";
                        return nameA.localeCompare(nameB);
                      })
                      .map((c) => {
                        const h = allHotels.find(
                          (ah) => ah.hotel_id === c.hotel_id,
                        );
                        return (
                          <SelectItem
                            key={c.hotel_id}
                            value={String(c.hotel_id)}
                            style={{ color: R.accent, borderRadius: "4px" }}
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
                      backgroundColor: R.sidebar,
                      borderColor: R.border,
                      color: R.accent,
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: R.sidebar,
                      borderColor: R.border,
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: R.accent,
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

              {/* [NEW] Pickup Window */}
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
                      backgroundColor: R.sidebar,
                      borderColor: R.border,
                      color: R.accent,
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: R.sidebar,
                      borderColor: R.border,
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: R.accent,
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
              {/* Status Block Container */}
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "center",
                  marginRight: "8px",
                }}
              >
                {/* Recent Jobs (Last 3 Pushes) */}
                {recentJobs.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        color: R.textMid,
                        textTransform: "uppercase",
                        marginBottom: "2px",
                      }}
                    >
                      Last 3 Pushes
                    </div>
                    {recentJobs.map((job, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: "11px",
                          color: idx === 0 ? R.accent : R.textDim,
                          lineHeight: "1.2",
                        }}
                      >
                        {format(new Date(job.latest_timestamp), "HH:mm dd/MM")}{" "}
                        • {job.days_count} days
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Status */}
                {sentinelStatus && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "10px",
                        color: R.textMid,
                        textTransform: "uppercase",
                        marginBottom: "2px",
                      }}
                    >
                      Last AI Run
                    </div>
                    <div style={{ fontSize: "12px", color: R.accent }}>
                      {sentinelStatus.lastRun
                        ? format(
                            new Date(sentinelStatus.lastRun),
                            "HH:mm dd/MM",
                          )
                        : "Never"}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color:
                          sentinelStatus.changesLast24h > 0
                            ? R.warmTeal
                            : R.textDim,
                      }}
                    >
                      {sentinelStatus.changesLast24h} updates (24h)
                    </div>
                  </div>
                )}
              </div>

              {/* Run Button - Only visible if data is loaded */}
              {calendarData.length > 0 && (
                <Button
                  onClick={handleRunSentinel}
                  disabled={isRunningSentinel || !selectedHotelId}
                  variant="outline"
                  className="h-9 text-sm"
                  style={{
                    borderColor: R.warmTeal,
                    color: R.warmTeal,
                    backgroundColor: `${R.warmTeal}0d`,
                  }}
                >
                  {isRunningSentinel ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Run Sentinel
                </Button>
              )}

              <Button
                onClick={handleLoad}
                disabled={isLoading || !selectedHotelId}
                style={{ backgroundColor: R.warmTeal, color: R.sidebar }}
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
                  : undefined, // Clamp AI rate to min rate floor
              }))}
            />

            {/* [RESTORED] Grid Section (Unified Container) */}
            <div style={styles.gridSection}>
              {/* Header: Visibility + Submit */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderBottom: `1px solid ${R.sep}`,
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
                          onClick={() => toggleRow("curveTier")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("curveTier"),
                          )}
                        >
                          {hiddenRows.has("curveTier") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Curve</span>
                        </button>
                        <button
                          onClick={() => toggleRow("curveTarget")}
                          style={getToggleButtonStyle(
                            hiddenRows.has("curveTarget"),
                          )}
                        >
                          {hiddenRows.has("curveTarget") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Curve Target</span>
                        </button>
                        <button
                          onClick={() => toggleRow("delta")}
                          style={getToggleButtonStyle(hiddenRows.has("delta"))}
                        >
                          {hiddenRows.has("delta") ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}{" "}
                          <span>Delta</span>
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

                {/* [NEW] Bulk Apply AI Button */}
                <Button
                  onClick={() => {
                    // Filter for non-frozen days that actually have an AI prediction
                    const validDates = visibleData
                      .filter((d) => !d.isFrozen && aiPredictions[d.date])
                      .map((d) => d.date);

                    if (validDates.length === 0) {
                      toast.info("No valid AI predictions in this view.");
                      return;
                    }

                    bulkApplyAi(validDates);
                    toast.success(
                      `Applied AI rates for ${validDates.length} days.`,
                    );
                  }}
                  variant="outline"
                  style={{
                    borderColor: R.warmTeal,
                    color: R.warmTeal,
                    backgroundColor: `${R.warmTeal}1a`,
                    marginRight: "12px",
                  }}
                  className="h-9 text-sm"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Apply AI (
                  {
                    visibleData.filter(
                      (d) => !d.isFrozen && aiPredictions[d.date],
                    ).length
                  }
                  )
                </Button>

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
                  style={{ backgroundColor: R.warmTeal, color: R.sidebar }}
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
                          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Metric</span>
                        </th>
                        {visibleData.map((day) => (
                          <th
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              backgroundColor:
                                hoveredColumn === day.date
                                  ? `${R.warmTeal}0a`
                                  : amberDates.has(day.date)
                                    ? `${R.gold}14`
                                    : "transparent",
                              borderBottom: `1px solid ${R.border}`,
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
                                color: R.textDim,
                                fontSize: "9px",
                                textTransform: "uppercase",
                              }}
                            >
                              {day.month}
                            </div>
                            <div style={{ color: (() => { const d = new Date(day.date); const dow = d.getDay(); return (dow === 0 || dow === 6) ? R.warmTeal : R.textDim; })(), fontSize: "9px", marginTop: 1 }}>
                              {day.dayOfWeek}
                            </div>
                            <div
                              style={{
                                color: R.accent,
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
                                      ? R.gold
                                      : R.textMid
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
                          borderBottom: `1px solid ${R.sep}`,
                        }}
                      >
                        <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>AI Status</td>
                        {visibleData.map((day) => {
                          let text = "SENTINEL",
                            color = R.warmTeal;

                          const currentSource = (
                            day.source || ""
                          ).toUpperCase();

                          if (day.isFrozen) {
                            text = "FROZEN";
                            color = R.gold;
                          } else if (pendingOverrides[day.date]) {
                            text = "PENDING";
                            color = R.gold;
                          } else if (
                            currentSource === "SENTINEL" ||
                            currentSource === "AI_AUTO" ||
                            currentSource === "AI_SUGGESTED"
                          ) {
                            text = "AI";
                            color = R.warmTeal;
                          } else if (currentSource === "MANUAL" || currentSource === "HOTEL_USER") {
                            text = "MANUAL";
                            color = R.textMid;
                          } else if (currentSource === "SYNC" || currentSource === "IMPORT") {
                            text = "PMS";
                            color = R.textDim;
                          } else {
                            text = "—";
                            color = R.textDim;
                          }
                          return (
                            <td
                              key={day.date}
                              style={{
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                padding: "0 4px",
                                height: "44px",
                                width: "96px",
                                backgroundColor:
                                  getColBg(day.date),
                              }}
                            >
                              <span
                                style={{
                                  color,
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {text}
                              </span>
                              {day.isFrozen && (
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
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              ADR{" "}
                              <button
                                onClick={() => toggleRow("adr")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                color: R.text,
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
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
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <Activity size={16} color={R.textMid} /> Occupancy{" "}
                              <button
                                onClick={() => toggleRow("occupancy")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                fontVariantNumeric: "tabular-nums",
                                backgroundColor:
                                  getColBg(day.date),
                                color:
                                  day.occupancy > 80
                                    ? R.warmTeal
                                    : day.occupancy > 60
                                      ? R.text
                                      : R.gold,
                              }}
                            >
                              {Math.round(day.occupancy)}%
                            </td>
                          ))}
                        </tr>
                      )}

                      {!hiddenRows.has("curveTier") && (
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ color: R.accent }}>Curve</span>
                              <button
                                onClick={() => toggleRow("curveTier")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                fontSize: "11px",
                                padding: "0 4px",
                                height: "44px",
                                color: R.accent,
                                backgroundColor:
                                  getColBg(day.date),
                              }}
                            >
                              {getSeasonalityTier(day.date)}
                            </td>
                          ))}
                        </tr>
                      )}

                      {/* Curve Target Row */}
                      {!hiddenRows.has("curveTarget") && (
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <Target size={16} color={R.warmTeal} /> Curve Target
                              <button
                                onClick={() => toggleRow("curveTarget")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => {
                            const target = getPaceValue(day.date);
                            return (
                              <td
                                key={day.date}
                                style={{
                                  borderBottom: `1px solid ${R.sep}`,
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                height: "44px",
                                  fontVariantNumeric: "tabular-nums",
                                  color: R.accent,
                                  backgroundColor:
                                    getColBg(day.date),
                                }}
                              >
                                {target !== null
                                  ? `${Math.round(target)}%`
                                  : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* Delta Row */}
                      {!hiddenRows.has("delta") && (
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ color: R.accent }}>Delta</span>
                              <button
                                onClick={() => toggleRow("delta")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => {
                            const target = getPaceValue(day.date);
                            const delta =
                              target !== null ? day.occupancy - target : null;
                            const color =
                              delta !== null
                                ? delta >= 0
                                  ? R.warmTeal
                                  : R.red
                                : R.textDim;
                            const sign = delta !== null && delta > 0 ? "+" : "";
                            return (
                              <td
                                key={day.date}
                                style={{
                                  borderBottom: `1px solid ${R.sep}`,
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                height: "44px",
                                  fontVariantNumeric: "tabular-nums",
                                  fontWeight: "bold",
                                  color: color,
                                  backgroundColor:
                                    getColBg(day.date),
                                }}
                              >
                                {delta !== null
                                  ? `${sign}${Math.round(delta)}%`
                                  : "-"}
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

                      {!hiddenRows.has("minRate") && (<>
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              Min Rate{" "}
                              <button
                                onClick={() => toggleRow("minRate")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => {
                            const isBelowMonthly = day.isDailyMinOverride && day.guardrailMin < day.monthlyMinDefault;
                            return (
                              <td
                                key={day.date}
                                onClick={() => !day.isFrozen && setEditingMinCell(day.date)}
                                style={{
                                  borderBottom: `1px solid ${R.sep}`,
                                  textAlign: "center",
                                  color: R.textDim,
                                  fontSize: "12px",
                                  padding: "0 4px",
                                height: "44px",
                                  fontVariantNumeric: "tabular-nums",
                                  cursor: day.isFrozen ? "not-allowed" : "pointer",
                                  backgroundColor:
                                    editingMinCell === day.date
                                      ? "transparent"
                                      : isBelowMonthly
                                        ? `${R.red}0f`
                                        : "transparent",
                                }}
                                title={isBelowMonthly ? `Monthly default: £${Math.round(day.monthlyMinDefault)}` : undefined}
                              >
                                {editingMinCell === day.date ? (
                                  <input
                                    autoFocus
                                    style={{
                                      ...styles.input,
                                      color: R.red,
                                      fontWeight: "bold",
                                      backgroundColor: `${R.red}1a`,
                                      border: `1px solid ${R.red}`,
                                    }}
                                    defaultValue={day.guardrailMin > 0 ? Math.round(day.guardrailMin) : ""}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => {
                                      const v = parseFloat(e.target.value);
                                      if (!isNaN(v) && v > 0 && selectedHotelId) {
                                        saveMinRate(selectedHotelId, day.date, v);
                                        if (v < day.monthlyMinDefault) {
                                          toast.warning(
                                            `Min rate set to £${Math.round(v)} — below monthly default of £${Math.round(day.monthlyMinDefault)}. Make sure you know what you're doing.`,
                                            { style: { backgroundColor: R.darkBand, border: `1px solid ${R.red}`, color: R.red } }
                                          );
                                        }
                                      } else if (e.target.value === "" && selectedHotelId) {
                                        // Revert to monthly default — delete the daily override
                                        saveMinRate(selectedHotelId, day.date, day.monthlyMinDefault);
                                      }
                                      setEditingMinCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                      if (e.key === "Tab") {
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                        const idx = visibleData.findIndex((d) => d.date === day.date);
                                        const next = e.shiftKey ? visibleData[idx - 1] : visibleData[idx + 1];
                                        if (next && !next.isFrozen) {
                                          setTimeout(() => setEditingMinCell(next.date), 0);
                                        }
                                      }
                                    }}
                                  />
                                ) : (
                                  day.guardrailMin > 0
                                    ? `£${Math.round(day.guardrailMin)}`
                                    : "-"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {/* "Leads to" sub-row: shows sell rate at min rate */}
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, padding: "4px 16px" }}>
                            <span style={{ color: R.textDim, fontSize: "10px", fontStyle: "italic", paddingLeft: "2px" }}>
                              Leads to
                            </span>
                          </td>
                          {visibleData.map((day) => {
                            let sellAtMin = 0;
                            if (day.guardrailMin > 0 && calcState) {
                              sellAtMin = calculateSellRate(
                                day.guardrailMin,
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
                                  borderBottom: `1px solid ${R.sep}`,
                                  textAlign: "center",
                                  color: R.textDim,
                                  fontSize: "10px",
                                  padding: "4px 8px",
                                  fontVariantNumeric: "tabular-nums",
                                  fontStyle: "italic",
                                }}
                              >
                                {sellAtMin > 0 ? `£${Math.round(sellAtMin)}` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      </>)}
                      {!hiddenRows.has("floorRate") && (
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              Floor Rate{" "}
                              <button
                                onClick={() => toggleRow("floorRate")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                color: R.textMid,
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
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

                      {/* Divider */}
                      <tr>
                        <td style={{ ...styles.tdSticky, height: 10, borderBottom: "none", padding: 0 }} />
                        {visibleData.map((day) => (
                          <td key={day.date} style={{ height: 10, backgroundColor: getColBg(day.date) }}
                            onMouseEnter={() => setHoveredColumn(day.date)} onMouseLeave={() => setHoveredColumn(null)} />
                        ))}
                      </tr>

                      {!hiddenRows.has("pmsRates") && (
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              Live PMS Rate{" "}
                              <button
                                onClick={() => toggleRow("pmsRates")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                color: R.accent,
                                fontSize: "13px",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                fontVariantNumeric: "tabular-nums",
                                backgroundColor:
                                  getColBg(day.date),
                              }}
                            >
                              {day.liveRate > 0
                                ? `£${Math.round(day.liveRate)}`
                                : "-"}
                            </td>
                          ))}
                        </tr>
                      )}

                      {/* 3. Calculations */}
                      {!hiddenRows.has("sellRate") && (
                        <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                          <td style={{ ...styles.tdSticky, color: R.textMid, fontWeight: 400, borderLeft: "3px solid transparent" }}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ color: R.warmTeal }}>
                                Current Sell Rate
                              </span>{" "}
                              <button
                                onClick={() => toggleRow("sellRate")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => {
                            // [MODIFIED] Calculate on-the-fly from PMS Rate (Data 3)
                            // Logic: PMS Rate * Multiplier * Discounts (Standard Stack)
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
                                  borderBottom: `1px solid ${R.sep}`,
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                  height: "44px",
                                  verticalAlign: "middle",
                                  fontWeight: "bold",
                                  fontVariantNumeric: "tabular-nums",
                                  color: c > 0 ? R.warmTeal : R.textDim,
                                  backgroundColor:
                                    getColBg(day.date),
                                  opacity: day.isFrozen ? 0.4 : 1,
                                }}
                              >
                                {c > 0 ? `£${Math.round(c)}` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* Sentinel Row (Blue) - Interactive Ghost Mode */}
                      <tr
                        style={{
                          borderBottom: `1px solid ${R.sep}`,
                          backgroundColor: `${R.warmTeal}05`,
                        }}
                      >
                        <td
                          style={{
                            ...styles.tdSticky,
                            borderLeft: `3px solid ${R.warmTeal}`,
                            color: R.warmTeal,
                            fontWeight: 600,
                          }}
                        >
                          Sentinel AI Rate
                        </td>
                        {visibleData.map((day) => {
                          const pred = aiPredictions[day.date];
                          // [FIX] Use Hook State
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
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                padding: "0 4px",
                                height: "44px",
                                verticalAlign: "middle",
                                position: "relative",
                                color: isApplied
                                  ? R.warmTeal
                                  : pred
                                    ? R.warmTeal
                                    : R.textMid,
                                fontSize: "13px",
                                fontWeight: 600,
                                transition: "all 0.2s",
                                cursor:
                                  pred && !day.isFrozen ? "pointer" : "default",
                                backgroundColor: isApplied
                                  ? `${R.warmTeal}0d`
                                  : hoveredColumn === day.date
                                    ? `${R.warmTeal}1a`
                                    : getColBg(day.date),
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
                                        // [FIX] Clamp AI rate to min rate floor
                                        const clampedRate = Math.max(pred.rate, day.guardrailMin || 0);
                                        applyAiPrediction(day.date, clampedRate);
                                        toast.success(
                                          `AI Rate £${clampedRate} applied`,
                                        );
                                      }
                                    }}
                                    style={{
                                      position: "absolute",
                                      bottom: "2px",
                                      backgroundColor: R.warmTeal,
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
                                      color={R.sidebar}
                                      strokeWidth={3}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Divider row */}
                      <tr style={{ height: "10px" }}>
                        <td colSpan={visibleData.length + 1} style={{ borderBottom: `1px solid ${R.sep}` }}></td>
                      </tr>

                      {/* 4. PMS Override Input */}
                      <tr
                        style={{
                          borderBottom: `1px solid ${R.sep}`,
                          backgroundColor: `${R.warmTeal}05`,
                        }}
                      >
                        <td style={{
                          ...styles.tdSticky,
                          borderLeft: `3px solid ${R.warmTeal}`,
                          color: R.warmTeal,
                          fontWeight: 600,
                        }}>
                          PMS Override
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
                                borderBottom: `1px solid ${R.sep}`,
                                textAlign: "center",
                                padding: "0 4px",
                                height: "44px",
                                cursor: day.isFrozen
                                  ? "not-allowed"
                                  : "pointer",
                                backgroundColor:
                                  editingCell === day.date
                                    ? "transparent"
                                    : isPending
                                      ? `${R.gold}0f`
                                      : hasAny
                                        ? `${R.accent}08`
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
                                        v < day.guardrailMin &&
                                        selectedHotelId
                                      ) {
                                        saveMinRate(selectedHotelId, day.date, v);
                                        toast.warning(
                                          `Override £${Math.round(v)} is below min £${Math.round(day.guardrailMin)} — daily min auto-adjusted. Make sure you know what you're doing.`,
                                          { style: { backgroundColor: R.darkBand, border: `1px solid ${R.red}`, color: R.red } }
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

                                      // 1. Save current value manually before switching
                                      const v = parseFloat(
                                        e.currentTarget.value,
                                      );
                                      if (!isNaN(v) && v > 0) {
                                        if (
                                          day.guardrailMin > 0 &&
                                          v < day.guardrailMin &&
                                          selectedHotelId
                                        ) {
                                          saveMinRate(selectedHotelId, day.date, v);
                                          toast.warning(
                                            `Override £${Math.round(v)} is below min £${Math.round(day.guardrailMin)} — daily min auto-adjusted.`,
                                            { style: { backgroundColor: R.darkBand, border: `1px solid ${R.red}`, color: R.red } }
                                          );
                                        }
                                        setOverride(day.date, v);
                                      } else if (e.currentTarget.value === "") {
                                        clearOverride(day.date);
                                      }

                                      // 2. Find and activate next cell
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
                                    color: isPending ? R.gold : R.accent,
                                    fontWeight: isPending ? "bold" : "normal",
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

                      {/* 5. Target Sell Rate (calculated from PMS Override) */}
                      {!hiddenRows.has("effectiveRate") && (
                        <tr
                          style={{
                            borderBottom: `1px solid ${R.sep}`,
                            backgroundColor: `${R.warmTeal}05`,
                          }}
                        >
                          <td
                            style={{
                              ...styles.tdSticky,
                              borderLeft: `3px solid ${R.warmTeal}`,
                              color: R.warmTeal,
                              fontWeight: 600,
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ color: R.warmTeal }}>
                                Target Sell Rate
                              </span>{" "}
                              <button
                                onClick={() => toggleRow("effectiveRate")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color={R.textDim} />
                              </button>
                            </div>
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
                                  borderBottom: `1px solid ${R.sep}`,
                                  textAlign: "center",
                                  fontSize: "13px",
                                  padding: "0 4px",
                                  height: "44px",
                                  verticalAlign: "middle",
                                  fontWeight: "bold",
                                  fontVariantNumeric: "tabular-nums",
                                  color:
                                    effectiveVal > 0 ? R.warmTeal : R.textDim,
                                  backgroundColor:
                                    editingEffectiveCell === day.date
                                      ? `${R.warmTeal}0a`
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
                                      color: R.accent,
                                      fontWeight: "bold",
                                      backgroundColor: `${R.warmTeal}1a`,
                                      border: `1px solid ${R.warmTeal}`,
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
                                          roundedOverride < day.guardrailMin &&
                                          selectedHotelId
                                        ) {
                                          saveMinRate(selectedHotelId, day.date, roundedOverride);
                                          toast.warning(
                                            `Base rate £${roundedOverride} is below min £${Math.round(day.guardrailMin)} — daily min auto-adjusted. Make sure you know what you're doing.`,
                                            { style: { backgroundColor: R.darkBand, border: `1px solid ${R.red}`, color: R.red } }
                                          );
                                        }
                                        setOverride(
                                          day.date,
                                          roundedOverride,
                                        );
                                      } else if (e.target.value === "") {
                                        clearOverride(day.date);
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
              border: `1px dashed ${R.border}`,
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: R.textDim,
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
