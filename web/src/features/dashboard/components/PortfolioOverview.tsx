import { useState, useEffect, useMemo, CSSProperties } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Filter,
  Calendar,
  Building2,
  Search,
  Check,
  ChevronsUpDown,
  TrendingDown,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  fetchPortfolioDetailed,
  PortfolioDetailedHotel,
} from "../api/dashboard.api";

// --- HELPER FUNCTIONS (Visual Logic) ---

const getOccupancyStyle = (value: number): CSSProperties => {
  if (value >= 100)
    return {
      backgroundColor: "rgba(168, 85, 247, 0.2)",
      border: "1px solid rgba(168, 85, 247, 0.3)",
    }; // Overbooked
  if (value >= 80)
    return {
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      border: "1px solid rgba(16, 185, 129, 0.3)",
    }; // Excellent
  if (value >= 70)
    return {
      backgroundColor: "rgba(57, 189, 248, 0.1)",
      border: "1px solid rgba(57, 189, 248, 0.2)",
    }; // Good
  if (value >= 50)
    return {
      backgroundColor: "rgba(249, 115, 22, 0.15)",
      border: "1px solid rgba(249, 115, 22, 0.25)",
    }; // Fair
  if (value >= 40)
    return {
      backgroundColor: "rgba(234, 88, 12, 0.2)",
      border: "1px solid rgba(234, 88, 12, 0.3)",
    }; // Warning
  return {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
  }; // Critical
};

const getOccupancyTextColor = (value: number): string => {
  if (value >= 100) return "#c084fc";
  if (value >= 80) return "#6ee7b7";
  if (value >= 70) return "#39BDF8";
  if (value >= 50) return "#fb923c";
  if (value >= 40) return "#f97316";
  return "#f87171";
};
// NEW: Relative Heatmap for ADR (Red -> Orange -> Blue -> Green matching Occupancy)
const getRelativeAdrStyle = (
  value: number,
  min: number,
  max: number
): CSSProperties => {
  if (max === min)
    return {
      backgroundColor: "transparent",
      border: "1px solid #2a2a2a",
    };

  const intensity = (value - min) / (max - min);

  if (intensity < 0.25) {
    // Red (Lowest 25% - Critical)
    return {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    };
  }
  if (intensity < 0.5) {
    // Orange (Low-Mid - Fair)
    return {
      backgroundColor: "rgba(249, 115, 22, 0.15)",
      border: "1px solid rgba(249, 115, 22, 0.25)",
    };
  }
  if (intensity < 0.75) {
    // Blue (High-Mid - Good)
    return {
      backgroundColor: "rgba(57, 189, 248, 0.1)",
      border: "1px solid rgba(57, 189, 248, 0.2)",
    };
  }
  // Green (Top 25% - Excellent)
  return {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
  };
};

const getRelativeAdrTextColor = (
  value: number,
  min: number,
  max: number
): string => {
  if (max === min) return "#e5e5e5";
  const intensity = (value - min) / (max - min);

  if (intensity < 0.25) return "#f87171"; // Red
  if (intensity < 0.5) return "#fb923c"; // Orange
  if (intensity < 0.75) return "#39BDF8"; // Blue
  return "#6ee7b7"; // Green
};

const detectAnomalies = (matrixData: any[]) => {
  const anomalies: {
    day: number;
    type: "drop" | "persistent" | "overbooked";
  }[] = [];

  // Detect sudden drops (≥15% decrease)
  for (let i = 1; i < matrixData.length; i++) {
    const diff = matrixData[i - 1].occupancy - matrixData[i].occupancy;
    if (diff >= 15) {
      anomalies.push({ day: i, type: "drop" });
    }
  }

  // Detect persistent low (below 50% for 7+ consecutive days)
  let lowCount = 0;
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy < 50) {
      lowCount++;
      if (
        lowCount >= 7 &&
        !anomalies.some((a) => a.day === i && a.type === "persistent")
      ) {
        anomalies.push({ day: i, type: "persistent" });
      }
    } else {
      lowCount = 0;
    }
  }

  // Detect overbooked (>100%)
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy > 100) {
      anomalies.push({ day: i, type: "overbooked" });
    }
  }
  return anomalies;
};

// --- MAIN COMPONENT ---

export function PortfolioOverview() {
  const [loading, setLoading] = useState(true);
  const [rawHotels, setRawHotels] = useState<PortfolioDetailedHotel[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [matrixMetric, setMatrixMetric] = useState<
    "occupancy" | "adr" | "available"
  >("occupancy");
  const [matrixDays, setMatrixDays] = useState<number>(45);
  const [sortByRisk, setSortByRisk] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedHotel, setSelectedHotel] = useState<string>("all");
  const [hotelSearchOpen, setHotelSearchOpen] = useState(false);

  // --- DATA LOADING ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchPortfolioDetailed();
        setRawHotels(data);
      } catch (err) {
        console.error("Portfolio Load Error:", err);
        setError("Failed to load portfolio data.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- DERIVED DATA & TRANSFORMATION ---

  // 1. Process Hotels (Add Risk Levels)
  const processedHotels = useMemo(() => {
    return rawHotels.map((h) => {
      // Calculate average occupancy for next 30 days to determine risk
      const next30 = h.matrixData.slice(0, 30);
      const avgOcc =
        next30.reduce((acc, d) => acc + d.occupancy, 0) / (next30.length || 1);

      let riskLevel: "critical" | "moderate" | "low" = "low";
      if (avgOcc < 45) riskLevel = "critical";
      else if (avgOcc < 60) riskLevel = "moderate";

      return { ...h, riskLevel };
    });
  }, [rawHotels]);

  // 2. Generate Filter Lists
  const hotelGroups = useMemo(
    () => Array.from(new Set(processedHotels.map((h) => h.group))).sort(),
    [processedHotels]
  );

  // 3. Generate Dates for Header
  const matrixDates = useMemo(
    () =>
      Array.from({ length: matrixDays }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return date;
      }),
    [matrixDays]
  );

  // 4. Filter & Sort Logic
  const displayHotels = useMemo(() => {
    let filtered = processedHotels;

    if (selectedHotel !== "all") {
      filtered = filtered.filter((h) => h.name === selectedHotel);
    } else if (selectedGroup !== "all") {
      filtered = filtered.filter((h) => h.group === selectedGroup);
    }

    if (sortByRisk) {
      filtered = [...filtered].sort((a, b) => {
        // Sort by number of "Red Days" (<40% occ)
        const aRed = a.matrixData.filter((d) => d.occupancy < 40).length;
        const bRed = b.matrixData.filter((d) => d.occupancy < 40).length;
        return bRed - aRed;
      });
    }

    // Limit to 20 for performance in grid
    return filtered.slice(0, 20);
  }, [processedHotels, selectedHotel, selectedGroup, sortByRisk]);

  // --- RENDER ---

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1d1c]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#39BDF8]" />
          <p className="text-sm text-gray-400">Aggregating Portfolio Data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500 bg-[#1d1d1c] h-screen">{error}</div>
    );
  }

  // --- KPI CARD LOGIC (Aggregated on the fly) ---
  const currentMonthIdx = new Date().getMonth() + 1; // 1-12

  // Helper to aggregate data for a specific month index across all hotels
  const getAggregatesForMonth = (monthOffset: number) => {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + monthOffset);
    const mNum = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    let totalRev = 0;
    let totalRevLY = 0;
    let totalSold = 0;
    let totalCap = 0;

    processedHotels.forEach((h) => {
      // Find this year's data
      const mData = h.monthlyData.find(
        (m) => m.month_num === mNum && m.year === year
      );
      // Find last year's data
      const mDataLY = h.monthlyData.find(
        (m) => m.month_num === mNum && m.year === year - 1
      );

      if (mData) {
        totalRev += parseFloat(mData.revenue as any);
        totalSold += parseInt(mData.rooms_sold as any);
        totalCap += parseInt(mData.total_capacity as any);
      }
      if (mDataLY) {
        totalRevLY += parseFloat(mDataLY.revenue as any);
      }
    });

    const occ = totalCap > 0 ? (totalSold / totalCap) * 100 : 0;

    return {
      label:
        monthOffset === -1
          ? "Last Month"
          : monthOffset === 0
          ? "Current Month"
          : "Next Month",
      sublabel:
        targetDate.toLocaleString("default", { month: "long" }) +
        (monthOffset === 0 ? " (MTD)" : ""),
      revenue: totalRev,
      occupancy: occ,
      yoyRevenue: totalRevLY,
      change: totalRevLY > 0 ? ((totalRev - totalRevLY) / totalRevLY) * 100 : 0,
      trend: totalRev >= totalRevLY ? ("up" as const) : ("down" as const),
    };
  };

  const kpiCards = [
    getAggregatesForMonth(-1), // Last Month
    getAggregatesForMonth(0), // This Month
    getAggregatesForMonth(1), // Next Month
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1d1d1c",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background FX */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(57, 189, 248, 0.01) 0%, transparent 50%, rgba(250, 255, 106, 0.01) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, padding: "24px" }}>
        {/* 1. KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {kpiCards.map((period, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "rgb(26, 26, 26)",
                borderRadius: "8px",
                border: "1px solid #2a2a2a",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#e5e5e5",
                      fontSize: "18px",
                      textTransform: "uppercase",
                      letterSpacing: "-0.025em",
                      marginBottom: "4px",
                    }}
                  >
                    {period.label}
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {period.sublabel}
                  </div>
                </div>
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor:
                      period.trend === "up"
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${
                      period.trend === "up"
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(239, 68, 68, 0.3)"
                    }`,
                  }}
                >
                  {period.trend === "up" ? (
                    <TrendingUp size={12} color="#10b981" />
                  ) : (
                    <TrendingDown size={12} color="#ef4444" />
                  )}
                  <span
                    style={{
                      color: period.trend === "up" ? "#10b981" : "#ef4444",
                      fontSize: "12px",
                    }}
                  >
                    YOY {period.change > 0 ? "+" : ""}
                    {period.change.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "12px",
                  }}
                >
                  <div style={{ color: "#39BDF8", fontSize: "32px" }}>
                    £{Math.round(period.revenue).toLocaleString()}
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "12px",
                      marginBottom: "6px",
                      textTransform: "uppercase",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {period.occupancy.toFixed(0)}% Occ
                  </div>
                </div>
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Total Revenue
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 2. OCCUPANCY MATRIX CONTROLS */}
        <div
          style={{
            marginBottom: "1rem",
            backgroundColor: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "0.25rem",
            padding: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {/* Metric Toggles */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Filter size={16} className="text-gray-500" />
                {["occupancy", "adr", "available"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMatrixMetric(m as any)}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      textTransform: "capitalize",
                      backgroundColor:
                        matrixMetric === m ? "#2a2a2a" : "#1a1a1a",
                      color: matrixMetric === m ? "#e5e5e5" : "#6b7280",
                      border:
                        matrixMetric === m
                          ? "1px solid #3a3a3a"
                          : "1px solid #2a2a2a",
                    }}
                  >
                    {m === "available"
                      ? "Rooms Avail."
                      : m === "adr"
                      ? "ADR"
                      : m}
                  </button>
                ))}
              </div>

              {/* Group Select */}
              <Select
                value={selectedGroup}
                onValueChange={(val) => {
                  setSelectedGroup(val);
                  setSelectedHotel("all");
                }}
                disabled={selectedHotel !== "all"}
              >
                <SelectTrigger
                  style={{
                    width: "200px",
                    backgroundColor: "#0a0a0a",
                    borderColor: "#2a2a2a",
                    color: "#e5e5e5",
                    height: "2.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Building2 size={16} className="text-gray-500" />
                    <SelectValue placeholder="All Groups" />
                  </div>
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <SelectItem
                    value="all"
                    className="text-gray-200 focus:bg-[#2a2a2a]"
                  >
                    All Groups
                  </SelectItem>
                  {hotelGroups.map((g) => (
                    <SelectItem
                      key={g}
                      value={g}
                      className="text-gray-200 focus:bg-[#2a2a2a]"
                    >
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Hotel Search */}
              <Popover open={hotelSearchOpen} onOpenChange={setHotelSearchOpen}>
                <PopoverTrigger asChild>
                  <button
                    style={{
                      width: "220px",
                      justifyContent: "space-between",
                      backgroundColor: "#0a0a0a",
                      border: "1px solid #2a2a2a",
                      color: "#e5e5e5",
                      height: "2.25rem",
                      padding: "0 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        overflow: "hidden",
                      }}
                    >
                      <Search size={16} className="text-gray-500" />
                      <span className="truncate">
                        {selectedHotel === "all"
                          ? "Search hotel..."
                          : selectedHotel}
                      </span>
                    </div>
                    <ChevronsUpDown size={16} className="text-gray-500" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }}
                  className="w-[300px] p-0"
                >
                  <Command style={{ backgroundColor: "#1a1a1a" }}>
                    <CommandInput
                      placeholder="Search hotels..."
                      className="text-gray-200"
                      style={{ backgroundColor: "#1a1a1a" }}
                    />
                    <CommandList>
                      <CommandEmpty className="text-gray-400 py-2 text-center">
                        No hotel found.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          className="text-gray-200 aria-selected:bg-[#2a2a2a]"
                          onSelect={() => {
                            setSelectedHotel("all");
                            setHotelSearchOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedHotel === "all"
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          All Hotels
                        </CommandItem>
                        {processedHotels.map((h) => (
                          <CommandItem
                            key={h.id}
                            className="text-gray-200 aria-selected:bg-[#2a2a2a]"
                            onSelect={() => {
                              setSelectedHotel(h.name);
                              setHotelSearchOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedHotel === h.name
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {h.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Risk Sort */}
              <button
                onClick={() => setSortByRisk(!sortByRisk)}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  backgroundColor: sortByRisk
                    ? "rgba(239, 68, 68, 0.2)"
                    : "#1a1a1a",
                  color: sortByRisk ? "#ef4444" : "#6b7280",
                  border: sortByRisk
                    ? "1px solid rgba(239, 68, 68, 0.3)"
                    : "1px solid #2a2a2a",
                }}
              >
                {sortByRisk ? "Showing Highest Risk" : "Sort by Risk"}
              </button>
            </div>
          </div>
        </div>

        {/* 3. THE MATRIX */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "0.25rem",
            overflow: "hidden",
            marginBottom: "2.5rem",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "inline-block", minWidth: "100%" }}>
              {/* Header Row */}
              <div
                style={{
                  display: "flex",
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  backgroundColor: "#1a1a1a",
                  borderBottom: "1px solid #2a2a2a",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 20,
                    backgroundColor: "#1a1a1a",
                    borderRight: "1px solid #2a2a2a",
                    width: "256px",
                    flexShrink: 0,
                    padding: "0.75rem 1rem",
                  }}
                >
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                    }}
                  >
                    Hotel
                  </div>
                </div>
                <div style={{ display: "flex" }}>
                  {matrixDates.map((date, i) => (
                    <div
                      key={i}
                      style={{
                        width: "64px",
                        flexShrink: 0,
                        padding: "0.75rem 0.5rem",
                        textAlign: "center",
                        backgroundColor:
                          i === 0 ? "rgba(57, 189, 248, 0.05)" : "transparent",
                        borderLeft:
                          i === 0
                            ? "1px solid rgba(57, 189, 248, 0.3)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "10px",
                          color: i === 0 ? "#39BDF8" : "#6b7280",
                        }}
                      >
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: i === 0 ? "#39BDF8" : "#6b7280",
                        }}
                      >
                        {date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div>
                {displayHotels.map((hotel) => {
                  const anomalies = detectAnomalies(hotel.matrixData);

                  // Calculate Row Min/Max for Relative ADR Coloring
                  const rowAdrs = hotel.matrixData.map((d) => d.adr);
                  const minAdr = Math.min(...rowAdrs);
                  const maxAdr = Math.max(...rowAdrs);

                  return (
                    <div
                      key={hotel.id}
                      style={{
                        display: "flex",
                        borderBottom: "1px solid #2a2a2a",
                      }}
                    >
                      <div
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 10,
                          backgroundColor: "#1a1a1a",
                          borderRight: "1px solid #2a2a2a",
                          width: "256px",
                          flexShrink: 0,
                          padding: "0.5rem 1rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{ color: "#e5e5e5", fontSize: "0.75rem" }}
                          >
                            {hotel.name}
                          </div>
                          {hotel.riskLevel === "critical" && (
                            <AlertCircle size={16} className="text-red-500" />
                          )}
                          {hotel.riskLevel === "moderate" && (
                            <AlertTriangle
                              size={16}
                              className="text-amber-500"
                            />
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex" }}>
                        {matrixDates.map((_, idx) => {
                          const dayData = hotel.matrixData[idx] || {
                            occupancy: 0,
                            adr: 0,
                            available: 0,
                          };
                          const value =
                            matrixMetric === "occupancy"
                              ? dayData.occupancy
                              : matrixMetric === "adr"
                              ? dayData.adr
                              : Math.round(dayData.available); // FIX: No decimals for availability

                          // Determine Style
                          let style = {};
                          if (matrixMetric === "occupancy") {
                            style = getOccupancyStyle(value);
                          } else if (matrixMetric === "adr") {
                            style = getRelativeAdrStyle(value, minAdr, maxAdr); // FIX: Row-relative
                          } else {
                            style = {
                              backgroundColor: "#1a1a1a",
                              border: "1px solid #2a2a2a",
                            };
                          }

                          const color =
                            matrixMetric === "occupancy"
                              ? getOccupancyTextColor(value)
                              : matrixMetric === "adr"
                              ? getRelativeAdrTextColor(value, minAdr, maxAdr)
                              : "#e5e5e5";
                          const anomaly = anomalies.find((a) => a.day === idx);

                          return (
                            <div
                              key={idx}
                              style={{
                                width: "64px",
                                flexShrink: 0,
                                padding: "0.5rem",
                                textAlign: "center",
                                position: "relative",
                                backgroundColor:
                                  idx === 0
                                    ? "rgba(57, 189, 248, 0.05)"
                                    : "transparent",
                                borderLeft:
                                  idx === 0
                                    ? "1px solid rgba(57, 189, 248, 0.3)"
                                    : "none",
                              }}
                            >
                              <div
                                style={{
                                  ...style,
                                  borderRadius: "0.125rem",
                                  padding: "0.125rem 0.25rem",
                                  fontSize: "0.75rem",
                                  color,
                                  position: "relative",
                                }}
                              >
                                {matrixMetric === "adr" && "£"}
                                {value}
                                {matrixMetric === "occupancy" && "%"}
                                {anomaly && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "-4px",
                                      right: "-4px",
                                    }}
                                  >
                                    {anomaly.type === "drop" && (
                                      <TrendingDown
                                        size={12}
                                        className="text-red-500"
                                      />
                                    )}
                                    {anomaly.type === "persistent" && (
                                      <AlertTriangle
                                        size={12}
                                        className="text-amber-500"
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 4. MONTHLY PERFORMANCE TABLES (YTD) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "1.5rem",
            marginBottom: "2rem",
            position: "relative",
            zIndex: 10,
          }}
        >
          {displayHotels.map((hotel) => {
            const currentYear = new Date().getFullYear();
            return (
              <div
                key={hotel.id}
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    background: "#0f0f0f",
                    borderBottom: "1px solid #2a2a2a",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      color: "#e5e5e5",
                      fontSize: "0.875rem",
                      textTransform: "uppercase",
                    }}
                  >
                    {hotel.name}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                    {hotel.totalRooms} rooms • {hotel.group}
                  </div>
                </div>

                <div style={{ background: "#1a1a1a" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1px 0.8fr 0.8fr 1fr 1fr",
                      gap: "0.5rem",
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid #2a2a2a",
                    }}
                  >
                    <div
                      style={{
                        color: "#9ca3af",
                        fontSize: "10px",
                        textTransform: "uppercase",
                      }}
                    >
                      Month
                    </div>
                    <div
                      style={{
                        color: "#9ca3af",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      {currentYear - 1} Rev
                    </div>
                    <div></div>
                    <div
                      style={{
                        color: "#39BDF8",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      {currentYear} Occ
                    </div>
                    <div
                      style={{
                        color: "#39BDF8",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      {currentYear} ADR
                    </div>
                    <div
                      style={{
                        color: "#39BDF8",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      {currentYear} Rev
                    </div>
                    <div
                      style={{
                        color: "#9ca3af",
                        fontSize: "10px",
                        textTransform: "uppercase",
                        textAlign: "right",
                      }}
                    >
                      Var
                    </div>
                  </div>

                  {/* Render Months Jan -> Jun (or whatever data we have) */}
                  {Array.from({ length: 6 }).map((_, i) => {
                    const mNum = i + 1;
                    const thisYearData = hotel.monthlyData.find(
                      (d) => d.month_num === mNum && d.year === currentYear
                    );
                    const lastYearData = hotel.monthlyData.find(
                      (d) => d.month_num === mNum && d.year === currentYear - 1
                    );

                    const revTY = parseFloat(
                      (thisYearData?.revenue as any) || 0
                    );
                    const revLY = parseFloat(
                      (lastYearData?.revenue as any) || 0
                    );
                    const occTY = thisYearData
                      ? (parseInt(thisYearData.rooms_sold as any) /
                          parseInt(thisYearData.total_capacity as any)) *
                        100
                      : 0;
                    const adrTY = parseFloat((thisYearData?.adr as any) || 0);

                    const delta = revTY - revLY;
                    const deltaPct = revLY > 0 ? (delta / revLY) * 100 : 0;
                    const isCurrent = mNum === new Date().getMonth() + 1;

                    const monthName = new Date(2000, i, 1).toLocaleString(
                      "default",
                      { month: "long" }
                    );

                    return (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1.2fr 1fr 1px 0.8fr 0.8fr 1fr 1fr",
                          gap: "0.5rem",
                          padding: "0.75rem 1rem",
                          borderBottom: "1px solid #2a2a2a",
                          background: isCurrent
                            ? "rgba(57, 189, 248, 0.02)"
                            : "transparent",
                        }}
                      >
                        <div
                          style={{
                            color: isCurrent ? "#39BDF8" : "#e5e5e5",
                            fontSize: "12px",
                          }}
                        >
                          {monthName}
                        </div>
                        <div
                          style={{
                            color: "#9ca3af",
                            fontSize: "12px",
                            textAlign: "right",
                            fontFamily: "monospace",
                          }}
                        >
                          £{revLY.toLocaleString()}
                        </div>
                        <div style={{ background: "#2a2a2a" }}></div>
                        <div
                          style={{
                            color: "#e5e5e5",
                            fontSize: "12px",
                            textAlign: "right",
                            fontFamily: "monospace",
                          }}
                        >
                          {occTY.toFixed(0)}%
                        </div>
                        <div
                          style={{
                            color: "#e5e5e5",
                            fontSize: "12px",
                            textAlign: "right",
                            fontFamily: "monospace",
                          }}
                        >
                          £{adrTY.toFixed(0)}
                        </div>
                        <div
                          style={{
                            color: "#39BDF8",
                            fontSize: "12px",
                            textAlign: "right",
                            fontFamily: "monospace",
                          }}
                        >
                          £{revTY.toLocaleString()}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 4px",
                              borderRadius: "2px",
                              color: delta >= 0 ? "#10b981" : "#ef4444",
                              backgroundColor:
                                delta >= 0
                                  ? "rgba(16, 185, 129, 0.1)"
                                  : "rgba(239, 68, 68, 0.1)",
                            }}
                          >
                            {delta >= 0 ? "+" : ""}
                            {deltaPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
