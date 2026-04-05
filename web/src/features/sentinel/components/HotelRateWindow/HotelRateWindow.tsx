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
import { OccupancyVisualizer } from "../RateManager/OccupancyVisualizer";
import {
  useRateGrid,
  calculateSellRate,
  calculateRequiredOverride,
} from "../../hooks/useRateGrid";
import { getPmsPropertyIds } from "../../api/sentinel.api";

// --- STYLES ---
const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#1d1d1c",
    position: "relative",
    overflow: "hidden",
    color: "#e5e5e5",
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
    color: "#e5e5e5",
    fontSize: "24px",
    letterSpacing: "-0.025em",
    marginBottom: "4px",
  },
  subtitle: { color: "#9ca3af", fontSize: "12px" },

  // Controls Card
  card: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
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
    color: "#9ca3af",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  // Visibility & Action Section
  gridSection: {
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    border: "1px solid #2a2a2a",
    padding: "16px",
    marginBottom: "24px",
  },

  // Visibility Inner Box
  rowVisibilityContainer: {
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#1A1A1A",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
  },
  rowVisibilityInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowVisibilityLeft: { display: "flex", alignItems: "center", gap: "24px" },
  rowVisibilityLabel: {
    fontSize: "12px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  rowVisibilityButtons: { display: "flex", alignItems: "center", gap: "12px" },

  // Grid Container
  gridContainer: {
    position: "relative",
    minHeight: "400px",
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    border: "1px solid #2a2a2a",
    overflow: "hidden",
  },
  tableWrapper: { overflowX: "auto", paddingBottom: "4px" },

  // Table Cells
  thSticky: {
    position: "sticky",
    left: 0,
    zIndex: 20,
    backgroundColor: "#1A1A1A",
    borderRight: "1px solid #2a2a2a",
    borderBottom: "1px solid #2a2a2a",
    width: "240px",
    textAlign: "left",
    padding: "12px 16px",
    color: "#9ca3af",
  },
  tdSticky: {
    position: "sticky",
    left: 0,
    zIndex: 10,
    backgroundColor: "#1A1A1A",
    borderRight: "1px solid #2a2a2a",
    borderBottom: "1px solid #2a2a2a",
    padding: "12px 16px",
    width: "240px",
    color: "#e5e5e5",
    fontSize: "13px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  // Inputs & Footer
  input: {
    width: "100%",
    backgroundColor: "#0f0f0f",
    border: "1px solid #2a2a2a",
    color: "#e5e5e5",
    textAlign: "center",
    fontSize: "13px",
    fontFamily: "monospace",
    height: "28px",
    borderRadius: "4px",
    outline: "none",
  },
  footer: {
    padding: "12px",
    backgroundColor: "#1A1A1A",
    borderTop: "1px solid #2a2a2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    color: "#6b7280",
    fontSize: "12px",
  },
};

interface HotelRateWindowProps {
  allHotels: any[];
  userHotels: any[];
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
  const [editingMinCell, setEditingMinCell] = useState<string | null>(null);
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
    saveMinRate,
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
    if (hoveredColumn === date) return "rgba(57,189,248,0.05)";
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
    backgroundColor: isHidden ? "#2a2a2a" : "rgba(57, 189, 248, 0.1)",
    color: isHidden ? "#6b7280" : "#39BDF8",
  });

  // --- RENDER ---
  return (
    <div style={styles.page}>
      <style>{`
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; border-top: 1px solid #2a2a2a; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #39BDF8; }
      `}</style>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(57, 189, 248, 0.05), transparent, rgba(250, 255, 106, 0.05))",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      ></div>

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
                      backgroundColor: "#0d0d0d",
                      borderColor: "#2a2a2a",
                      color: "#e5e5e5",
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
                      backgroundColor: "#141414",
                      borderColor: "#2a2a2a",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: "#e5e5e5",
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
                            style={{ color: "#e5e5e5", borderRadius: "4px" }}
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
                      backgroundColor: "#0d0d0d",
                      borderColor: "#2a2a2a",
                      color: "#e5e5e5",
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: "#141414",
                      borderColor: "#2a2a2a",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: "#e5e5e5",
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
                      backgroundColor: "#0d0d0d",
                      borderColor: "#2a2a2a",
                      color: "#e5e5e5",
                      fontSize: "13px",
                      padding: "10px 12px",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: "#141414",
                      borderColor: "#2a2a2a",
                      borderRadius: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      color: "#e5e5e5",
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
                style={{ backgroundColor: "#39BDF8", color: "#1d1d1c" }}
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
                  marginBottom: "16px",
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
                  style={{ backgroundColor: "#39BDF8", color: "#1d1d1c" }}
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
                      minWidth: `${240 + visibleData.length * 84}px`,
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={styles.thSticky}>METRIC</th>
                        {visibleData.map((day) => (
                          <th
                            key={day.date}
                            onMouseEnter={() => setHoveredColumn(day.date)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            style={{
                              backgroundColor:
                                hoveredColumn === day.date
                                  ? "rgba(58, 58, 53, 0.3)"
                                  : amberDates.has(day.date)
                                    ? "rgba(245, 158, 11, 0.08)"
                                    : "#1A1A1A",
                              borderBottom: "1px solid #2a2a2a",
                              borderRight: "1px solid #2a2a2a",
                              textAlign: "center",
                              padding: "12px 8px",
                              minWidth: "84px",
                              cursor: "pointer",
                            }}
                          >
                            <div
                              style={{
                                color: "#6b7280",
                                fontSize: "10px",
                                textTransform: "uppercase",
                                marginBottom: "4px",
                              }}
                            >
                              {day.month}
                            </div>
                            <div style={{ color: "#e5e5e5", fontSize: "12px" }}>
                              {day.dayOfWeek}
                            </div>
                            <div
                              style={{
                                color: "#9ca3af",
                                fontSize: "12px",
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
                                      : "#9ca3af"
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
                          borderBottom: "1px solid #2a2a2a",
                          backgroundColor: "rgba(26, 26, 26, 0.2)",
                        }}
                      >
                        <td style={styles.tdSticky}>AI Status</td>
                        {visibleData.map((day) => {
                          let text = "SENTINEL",
                            color = "#39BDF8";

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
                              ? "#39BDF8"
                              : "#f59e0b";
                          } else if (
                            currentSource === "SENTINEL" ||
                            currentSource === "AI_AUTO" ||
                            currentSource === "AI_SUGGESTED"
                          ) {
                            text = "SENTINEL";
                            color = "#39BDF8";
                          } else if (currentSource === "SYNC") {
                            text = "SYNC";
                            color = "#6b7280";
                          } else if (
                            savedOverrides[day.date] ||
                            currentSource === "MANUAL"
                          ) {
                            text = "MANUAL";
                            color = "#9ca3af";
                          }
                          return (
                            <td
                              key={day.date}
                              style={{
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                padding: "12px 8px",
                                width: "84px",
                                backgroundColor:
                                  getColBg(day.date),
                              }}
                            >
                              <span
                                style={{
                                  color,
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  fontFamily: "monospace",
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
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td style={styles.tdSticky}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <TrendingUp size={16} color="#9ca3af" /> ADR{" "}
                              <button
                                onClick={() => toggleRow("adr")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color="#6b7280" />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                color: "#e5e5e5",
                                fontSize: "12px",
                                padding: "12px 8px",
                                fontFamily: "monospace",
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
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td style={styles.tdSticky}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <Activity size={16} color="#9ca3af" /> Occupancy{" "}
                              <button
                                onClick={() => toggleRow("occupancy")}
                                style={{
                                  marginLeft: "auto",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                <Eye size={14} color="#6b7280" />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                fontSize: "13px",
                                padding: "12px 8px",
                                fontFamily: "monospace",
                                backgroundColor:
                                  getColBg(day.date),
                                color:
                                  day.occupancy > 80
                                    ? "#10b981"
                                    : day.occupancy > 60
                                      ? "#facc15"
                                      : "#ef4444",
                              }}
                            >
                              {Math.round(day.occupancy)}%
                            </td>
                          ))}
                        </tr>
                      )}

                      {/* Spacer between metrics and pricing sections */}
                      <tr style={{ height: "8px" }}>
                        <td colSpan={visibleData.length + 1} style={{ borderBottom: "1px solid #2a2a2a" }}></td>
                      </tr>

                      {!hiddenRows.has("minRate") && (
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td style={{ ...styles.tdSticky, color: "#f59e0b" }}>
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
                                <Eye size={14} color="#6b7280" />
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
                                  borderRight: "1px solid #2a2a2a",
                                  textAlign: "center",
                                  color: isBelowMonthly ? "#ef4444" : "#6b7280",
                                  fontSize: "12px",
                                  padding: "12px 8px",
                                  fontFamily: "monospace",
                                  cursor: day.isFrozen ? "not-allowed" : "pointer",
                                  backgroundColor:
                                    editingMinCell === day.date
                                      ? "transparent"
                                      : isBelowMonthly
                                        ? "rgba(239, 68, 68, 0.15)"
                                        : getColBg(day.date),
                                  borderBottom: isBelowMonthly ? "2px solid #ef4444" : undefined,
                                }}
                                title={isBelowMonthly ? `Monthly default: £${Math.round(day.monthlyMinDefault)}` : undefined}
                              >
                                {editingMinCell === day.date ? (
                                  <input
                                    autoFocus
                                    style={{
                                      ...styles.input,
                                      color: "#ef4444",
                                      fontWeight: "bold",
                                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                                      border: "1px solid #ef4444",
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
                                            { style: { backgroundColor: "#1a1a1a", border: "1px solid #ef4444", color: "#ef4444" } }
                                          );
                                        }
                                      } else if (e.target.value === "" && selectedHotelId) {
                                        saveMinRate(selectedHotelId, day.date, day.monthlyMinDefault);
                                      }
                                      setEditingMinCell(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
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
                      )}
                      {!hiddenRows.has("floorRate") && (
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td style={styles.tdSticky}>
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
                                <Eye size={14} color="#6b7280" />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                color: "#f97316",
                                fontSize: "12px",
                                padding: "12px 8px",
                                fontFamily: "monospace",
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
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td style={styles.tdSticky}>
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
                                <Eye size={14} color="#6b7280" />
                              </button>
                            </div>
                          </td>
                          {visibleData.map((day) => (
                            <td
                              key={day.date}
                              style={{
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                color: "#e5e5e5",
                                fontSize: "12px",
                                padding: "12px 8px",
                                fontFamily: "monospace",
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
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td style={styles.tdSticky}>
                            <div
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ color: "#10b981" }}>
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
                                <Eye size={14} color="#6b7280" />
                              </button>
                            </div>
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
                                  borderRight: "1px solid #2a2a2a",
                                  textAlign: "center",
                                  fontSize: "12px",
                                  padding: "12px 8px",
                                  fontWeight: "bold",
                                  fontFamily: "monospace",
                                  color: c > 0 ? "#10b981" : "#4a4a48",
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

                      {/* Sentinel Row (Blue) - Interactive Ghost Mode */}
                      <tr
                        style={{
                          borderBottom: "2px solid rgba(57, 189, 248, 0.4)",
                          backgroundColor: "rgba(57, 189, 248, 0.02)",
                        }}
                      >
                        <td
                          style={{
                            ...styles.tdSticky,
                            backgroundColor: "#1A1A1A",
                            padding: "16px",
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
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                padding: "16px 8px",
                                position: "relative",
                                color: isApplied
                                  ? "#10b981"
                                  : pred
                                    ? "#39BDF8"
                                    : "#4a4a48",
                                fontSize: "14px",
                                fontWeight: 600,
                                transition: "all 0.2s",
                                cursor:
                                  pred && !day.isFrozen ? "pointer" : "default",
                                backgroundColor: isApplied
                                  ? "rgba(16, 185, 129, 0.05)"
                                  : hoveredColumn === day.date
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
                                      backgroundColor: "#39BDF8",
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
                                      color="#1d1d1c"
                                      strokeWidth={3}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      {/* === YOUR RATE CONTROLS — editable zone === */}
                      <tr>
                        <td
                          colSpan={visibleData.length + 1}
                          style={{
                            padding: "6px 16px",
                            backgroundColor: "#141414",
                            borderBottom: "none",
                          }}
                        >
                          <span style={{
                            fontSize: "10px",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            color: "#39BDF8",
                            fontWeight: 600,
                          }}>
                            Your Rate Controls
                          </span>
                          <span style={{
                            fontSize: "10px",
                            color: "#6b7280",
                            marginLeft: "8px",
                          }}>
                            — click any cell to edit
                          </span>
                        </td>
                      </tr>

                      {!hiddenRows.has("effectiveRate") && (
                        <tr
                          style={{
                            borderTop: "3px solid #39BDF8",
                            borderLeft: "3px solid #39BDF8",
                            borderBottom: "1px solid rgba(57, 189, 248, 0.15)",
                            backgroundColor: "rgba(57, 189, 248, 0.03)",
                          }}
                        >
                          <td
                            style={{
                              ...styles.tdSticky,
                              backgroundColor: "rgba(57, 189, 248, 0.05)",
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
                              <span style={{ color: "#e5e5e5", fontWeight: 600 }}>
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
                                <Eye size={14} color="#6b7280" />
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
                                  borderRight: "1px solid #2a2a2a",
                                  textAlign: "center",
                                  fontSize: "12px",
                                  padding: "12px 8px",
                                  fontWeight: "bold",
                                  fontFamily: "monospace",
                                  color:
                                    effectiveVal > 0 ? "#e5e5e5" : "#4a4a48",
                                  backgroundColor:
                                    editingEffectiveCell === day.date
                                      ? "rgba(57, 189, 248, 0.05)"
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
                                      color: "#e5e5e5",
                                      fontWeight: "bold",
                                      backgroundColor:
                                        "rgba(57, 189, 248, 0.1)",
                                      border: "1px solid #39BDF8",
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
                                            { style: { backgroundColor: "#1a1a1a", border: "1px solid #ef4444", color: "#ef4444" } }
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
                      {/* 4. PMS Override Input */}
                      <tr
                        style={{
                          borderBottom: "3px solid #39BDF8",
                          borderLeft: "3px solid #39BDF8",
                          backgroundColor: "rgba(57, 189, 248, 0.03)",
                        }}
                      >
                        <td style={{
                          ...styles.tdSticky,
                          backgroundColor: "rgba(57, 189, 248, 0.05)",
                        }}>
                          <span style={{ color: "#e5e5e5", fontWeight: 600 }}>PMS Override</span>
                          <span style={{ color: "#6b7280", fontSize: "10px", marginLeft: "6px" }}>base rate</span>
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
                                borderRight: "1px solid #2a2a2a",
                                textAlign: "center",
                                padding: "12px 8px",
                                cursor: day.isFrozen
                                  ? "not-allowed"
                                  : "pointer",
                                backgroundColor:
                                  editingCell === day.date
                                    ? "transparent"
                                    : isPending
                                      ? "rgba(250, 255, 106, 0.06)"
                                      : hasAny
                                        ? "rgba(229, 229, 229, 0.03)"
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
                                          { style: { backgroundColor: "#1a1a1a", border: "1px solid #ef4444", color: "#ef4444" } }
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
                                          v < day.guardrailMin &&
                                          selectedHotelId
                                        ) {
                                          saveMinRate(selectedHotelId, day.date, v);
                                          toast.warning(
                                            `Override £${Math.round(v)} is below min £${Math.round(day.guardrailMin)} — daily min auto-adjusted.`,
                                            { style: { backgroundColor: "#1a1a1a", border: "1px solid #ef4444", color: "#ef4444" } }
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
                                    color: isPending ? "#f59e0b" : "#e5e5e5",
                                    fontWeight: isPending ? "bold" : "normal",
                                    fontFamily: "monospace",
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
              border: "1px dashed #2a2a2a",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
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
