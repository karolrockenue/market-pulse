import {
  ChevronDown,
  Star,
  X,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
// [MODIFIED] Import the hook from your components folder
import { useActionList } from "@/components/ActionListContext";

interface PortfolioFlowcastProps {
  startDate: Date;
  globalGroupFilter?: string;
  globalHotelFilter?: string;
}

export function PortfolioFlowcast({
  startDate,
  globalGroupFilter = "all",
  globalHotelFilter = "all",
}: PortfolioFlowcastProps) {
  const [pickupPeriod, setPickupPeriod] = useState<"24h" | "48h">("24h");
  const [expandedHotels, setExpandedHotels] = useState<Set<number>>(new Set());

  // [MODIFIED] Use Global Context instead of local state
  const {
    actionList: globalActionList,
    toggleItem,
    clearList,
    hasItem,
  } = useActionList();
  const [actionListOpen, setActionListOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [hotelsData, setHotelsData] = useState<any[]>([]);

  // 1. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (globalHotelFilter !== "all")
          params.append("hotelId", globalHotelFilter);
        else if (globalGroupFilter !== "all")
          params.append("group", globalGroupFilter);

        const res = await fetch(
          `/api/metrics/portfolio/flowcast?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to load flowcast");

        const data = await res.json();

        // Parse dates
        const parsed = data.map((h: any) => ({
          ...h,
          data: h.data.map((d: any) => ({
            ...d,
            date: new Date(d.date),
          })),
        }));

        setHotelsData(parsed);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load flowcast data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [globalGroupFilter, globalHotelFilter]);

  // [MODIFIED] Helper to toggle via context
  const handleToggleAction = (
    hotel: { id: number; name: string },
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    toggleItem({ id: hotel.id, name: hotel.name });
  };

  const toggleHotel = (hotelId: number) => {
    const newExpanded = new Set(expandedHotels);
    if (newExpanded.has(hotelId)) {
      newExpanded.delete(hotelId);
    } else {
      newExpanded.add(hotelId);
    }
    setExpandedHotels(newExpanded);
  };

  const expandAll = () => {
    setExpandedHotels(new Set(hotelsData.map((h) => h.id)));
  };

  const collapseAll = () => {
    setExpandedHotels(new Set());
  };

  // Helper to calculate summary metrics from real data
  const getHotelMetrics = (hotel: any) => {
    if (!hotel || !hotel.data || hotel.data.length === 0)
      return { avgOccupancy: 0, recentPickup: 0 };

    // [FIX] Weighted Average Calculation (Total Sold / Total Capacity)
    // We only look at the first 30 days for the "Avg Occ" header, as 90 days dilutes the signal too much.
    const windowDays = 30;
    const periodData = hotel.data.slice(0, windowDays);

    const totalSold = periodData.reduce(
      (sum: number, d: any) => sum + (d.roomsSold || 0),
      0
    );
    const totalCap = periodData.reduce(
      (sum: number, d: any) => sum + (d.capacity || 0),
      0
    );

    const avgOccupancy =
      totalCap > 0 ? Math.round((totalSold / totalCap) * 100) : 0;

    // Pickup is still an average of the daily pickup percentages
    const recentPickup =
      pickupPeriod === "24h"
        ? periodData.reduce((sum: number, d: any) => sum + d.pickup24h, 0) /
          windowDays
        : periodData.reduce((sum: number, d: any) => sum + d.pickup48h, 0) /
          windowDays;

    return { avgOccupancy, recentPickup };
  };

  if (loading) {
    return (
      <div
        style={{
          padding: "2rem",
          display: "flex",
          justifyContent: "center",
          backgroundColor: "#1a1a1a",
          borderRadius: "0.5rem",
          border: "1px solid #2a2a2a",
        }}
      >
        <Loader2 className="animate-spin text-[#39BDF8]" />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Master Controls */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid #2a2a2a",
          borderRadius: "0.5rem",
          padding: "1rem",
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "0.375rem",
              height: "0.375rem",
              borderRadius: "9999px",
              backgroundColor: "#faff6a",
            }}
          ></div>
          <span
            style={{
              color: "#e5e5e5",
              fontSize: "0.875rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            FLOWCAST PORTFOLIO
          </span>
          <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
            ({hotelsData.length} Hotels)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Action List Button */}
          <Sheet open={actionListOpen} onOpenChange={setActionListOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                style={{
                  backgroundColor:
                    globalActionList.length > 0
                      ? "rgba(57, 189, 248, 0.1)"
                      : "#141414",
                  borderColor:
                    globalActionList.length > 0 ? "#39BDF8" : "#2a2a2a",
                  color: globalActionList.length > 0 ? "#39BDF8" : "#9ca3af",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Star style={{ width: "0.875rem", height: "0.875rem" }} />
                Action List
                {globalActionList.length > 0 && (
                  <span
                    style={{
                      backgroundColor: "#39BDF8",
                      color: "#0a0a0a",
                      borderRadius: "9999px",
                      padding: "0 0.375rem",
                      fontSize: "0.625rem",
                      fontWeight: "600",
                    }}
                  >
                    {globalActionList.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              style={{
                backgroundColor: "#1d1d1c",
                borderLeft: "1px solid #2a2a2a",
                width: "400px",
              }}
            >
              <SheetHeader style={{ marginBottom: "1.5rem" }}>
                <SheetTitle
                  style={{
                    color: "#e5e5e5",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontSize: "0.875rem",
                  }}
                >
                  Action List
                </SheetTitle>
                <SheetDescription
                  style={{ color: "#6b7280", fontSize: "0.75rem" }}
                >
                  Hotels flagged for follow-up • Saved across sessions
                </SheetDescription>
              </SheetHeader>

              {globalActionList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "3rem 1rem",
                    color: "#6b7280",
                  }}
                >
                  <Star
                    style={{
                      width: "3rem",
                      height: "3rem",
                      margin: "0 auto 1rem",
                      opacity: 0.3,
                    }}
                  />
                  <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                    No hotels in action list
                  </p>
                  <p style={{ fontSize: "0.75rem" }}>
                    Click the checkbox next to hotels that need follow-up
                  </p>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {globalActionList.length}{" "}
                      {globalActionList.length === 1 ? "hotel" : "hotels"}{" "}
                      flagged
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearList}
                      style={{
                        fontSize: "0.75rem",
                        color: "#ef4444",
                        padding: "0.25rem 0.5rem",
                      }}
                    >
                      Clear All
                    </Button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {globalActionList.map((item) => {
                      const hotel = hotelsData.find((h) => h.id === item.id);
                      // Graceful fallback if data isn't loaded yet
                      const metrics = hotel
                        ? getHotelMetrics(hotel)
                        : { avgOccupancy: 0, recentPickup: 0 };
                      const pickupTrend =
                        metrics.recentPickup > 2
                          ? "up"
                          : metrics.recentPickup > 1
                          ? "stable"
                          : "down";

                      return (
                        <div
                          key={item.id}
                          style={{
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #2a2a2a",
                            borderRadius: "0.375rem",
                            padding: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "start",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                color: "#e5e5e5",
                                fontSize: "0.875rem",
                                flex: 1,
                              }}
                            >
                              {item.name}
                            </span>
                            <button
                              onClick={(e) =>
                                handleToggleAction(
                                  { id: item.id, name: item.name },
                                  e
                                )
                              }
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "0",
                                color: "#6b7280",
                                transition: "color 0.2s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color = "#ef4444")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = "#6b7280")
                              }
                            >
                              <X style={{ width: "1rem", height: "1rem" }} />
                            </button>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "0.5rem",
                              fontSize: "0.75rem",
                            }}
                          >
                            <div>
                              <span style={{ color: "#6b7280" }}>
                                Avg Occ:{" "}
                              </span>
                              <span
                                style={{
                                  color:
                                    metrics.avgOccupancy >= 70
                                      ? "#10b981"
                                      : metrics.avgOccupancy >= 50
                                      ? "#faff6a"
                                      : "#ef4444",
                                  fontFamily: "monospace",
                                }}
                              >
                                {metrics.avgOccupancy}%
                              </span>
                            </div>
                            <div>
                              <span style={{ color: "#6b7280" }}>Pickup: </span>
                              <span
                                style={{
                                  color:
                                    pickupTrend === "up"
                                      ? "#10b981"
                                      : pickupTrend === "stable"
                                      ? "#faff6a"
                                      : "#6b7280",
                                  fontFamily: "monospace",
                                }}
                              >
                                {pickupTrend === "up"
                                  ? "↑"
                                  : pickupTrend === "stable"
                                  ? "→"
                                  : "↓"}{" "}
                                {metrics.recentPickup.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button
              onClick={expandAll}
              size="sm"
              variant="outline"
              style={{
                backgroundColor: "#141414",
                borderColor: "#2a2a2a",
                color: "#9ca3af",
                fontSize: "0.75rem",
              }}
            >
              Expand All
            </Button>
            <Button
              onClick={collapseAll}
              size="sm"
              variant="outline"
              style={{
                backgroundColor: "#141414",
                borderColor: "#2a2a2a",
                color: "#9ca3af",
                fontSize: "0.75rem",
              }}
            >
              Collapse All
            </Button>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              Pickup Period:
            </span>
            <Select
              value={pickupPeriod}
              onValueChange={(value: "24h" | "48h") => setPickupPeriod(value)}
            >
              <SelectTrigger
                style={{
                  width: "120px",
                  backgroundColor: "#141414",
                  borderColor: "#2a2a2a",
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
              >
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="48h">48 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Hotel Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {hotelsData.map((hotel) => {
          const isExpanded = expandedHotels.has(hotel.id);
          const metrics = getHotelMetrics(hotel);
          const pickupTrend =
            metrics.recentPickup > 2
              ? "up"
              : metrics.recentPickup > 1
              ? "stable"
              : "down";
          const hotelId = hotel.id;

          return (
            <Collapsible
              key={hotelId}
              open={isExpanded}
              onOpenChange={() => toggleHotel(hotelId)}
            >
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "0.375rem",
                  overflow: "hidden",
                }}
              >
                {/* Collapsed Header */}
                <CollapsibleTrigger
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    cursor: "pointer",
                    background: "transparent",
                    transition: "background-color 0.2s",
                    borderBottom: isExpanded ? "1px solid #2a2a2a" : "none",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#1f1f1f")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Left: Hotel Name */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        flex: 1,
                      }}
                    >
                      {/* Action List Checkbox */}
                      <button
                        onClick={(e) =>
                          handleToggleAction(
                            { id: hotel.id, name: hotel.name },
                            e
                          )
                        }
                        style={{
                          background: "none",
                          border: `1.5px solid ${
                            hasItem(hotel.id) ? "#39BDF8" : "#3a3a3a"
                          }`,
                          borderRadius: "0.25rem",
                          width: "1rem",
                          height: "1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          backgroundColor: hasItem(hotel.id)
                            ? "#39BDF8"
                            : "transparent",
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          if (!hasItem(hotel.id)) {
                            e.currentTarget.style.borderColor = "#39BDF8";
                            e.currentTarget.style.backgroundColor =
                              "rgba(57, 189, 248, 0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!hasItem(hotel.id)) {
                            e.currentTarget.style.borderColor = "#3a3a3a";
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }
                        }}
                      >
                        {hasItem(hotel.id) && (
                          <CheckSquare
                            style={{
                              width: "0.75rem",
                              height: "0.75rem",
                              color: "#0a0a0a",
                            }}
                          />
                        )}
                      </button>
                      <ChevronDown
                        style={{
                          width: "0.875rem",
                          height: "0.875rem",
                          color: "#39BDF8",
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      />
                      <span style={{ color: "#e5e5e5", fontSize: "0.875rem" }}>
                        {hotel.name}
                      </span>
                    </div>

                    {/* Right: Metrics */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1.5rem",
                      }}
                    >
                      {/* Avg Occupancy */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          Avg Occ:
                        </span>
                        <span
                          style={{
                            fontSize: "0.875rem",
                            color:
                              metrics.avgOccupancy >= 70
                                ? "#10b981"
                                : metrics.avgOccupancy >= 50
                                ? "#faff6a"
                                : "#ef4444",
                            fontWeight: "600",
                            fontFamily: "monospace",
                          }}
                        >
                          {metrics.avgOccupancy}%
                        </span>
                      </div>

                      {/* Pickup Trend */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          Pickup:
                        </span>
                        <span
                          style={{
                            fontSize: "0.875rem",
                            color:
                              pickupTrend === "up"
                                ? "#10b981"
                                : pickupTrend === "stable"
                                ? "#faff6a"
                                : "#6b7280",
                            fontFamily: "monospace",
                          }}
                        >
                          {pickupTrend === "up"
                            ? "↑"
                            : pickupTrend === "stable"
                            ? "→"
                            : "↓"}{" "}
                          {metrics.recentPickup.toFixed(1)}%
                        </span>
                      </div>

                      {/* Mini Sparkline */}
                      <div
                        style={{
                          width: "80px",
                          height: "24px",
                          position: "relative",
                        }}
                      >
                        <svg
                          width="80"
                          height="24"
                          style={{ display: "block" }}
                        >
                          <path
                            d={hotel.data
                              .slice(0, 30)
                              .map((d: any, idx: number) => {
                                const x = (idx / 29) * 80;
                                const y = 24 - (d.occupancy / 100) * 24;
                                return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                              })
                              .join(" ")}
                            fill="none"
                            stroke="#39BDF8"
                            strokeWidth="1.5"
                            strokeOpacity="0.6"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Expanded Content: Full Flowcast Chart */}
                <CollapsibleContent>
                  <div style={{ padding: "1.5rem" }}>
                    <div
                      style={{
                        position: "relative",
                        height: "15rem",
                        backgroundColor: "#141410",
                        borderRadius: "0.25rem",
                        border: "1px solid rgba(250, 255, 106, 0.15)",
                        overflow: "hidden",
                      }}
                    >
                      {/* Y-axis labels */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: "3rem",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          paddingTop: "0.75rem",
                          paddingBottom: "0.75rem",
                        }}
                      >
                        {[100, 75, 50, 25].map((val, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              paddingRight: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "10px",
                                color: "rgba(57, 189, 248, 0.6)",
                                fontFamily: "monospace",
                              }}
                            >
                              {val}%
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Guide lines */}
                      <div
                        style={{
                          position: "absolute",
                          left: "3rem",
                          right: "0.5rem",
                          top: 0,
                          bottom: 0,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          paddingTop: "0.75rem",
                          paddingBottom: "0.75rem",
                        }}
                      >
                        {[100, 75, 50, 25].map((val, idx) => (
                          <div
                            key={idx}
                            style={{
                              height: "1px",
                              backgroundColor: "#2a2a2a",
                            }}
                          ></div>
                        ))}
                      </div>

                      {/* Bars */}
                      <div
                        style={{
                          position: "absolute",
                          left: "3rem",
                          right: "0.5rem",
                          top: "0.75rem",
                          bottom: "0.75rem",
                          display: "flex",
                          alignItems: "flex-end",
                          gap: "2px",
                        }}
                      >
                        {hotel.data.map((day: any, idx: number) => {
                          const dateStr = day.date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                          const currentPickup =
                            pickupPeriod === "24h"
                              ? day.pickup24h
                              : day.pickup48h;

                          return (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    style={{
                                      flex: 1,
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      cursor: "pointer",
                                      position: "relative",
                                      height: "100%",
                                      justifyContent: "flex-end",
                                    }}
                                  >
                                    {/* Occupancy Bar */}
                                    <div
                                      style={{
                                        width: "100%",
                                        backgroundColor: "#2a2a2a",
                                        height: `${Math.min(
                                          day.occupancy,
                                          100
                                        )}%`,
                                        position: "relative",
                                        transition: "box-shadow 0.2s",
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow =
                                          "inset 0 0 12px rgba(57, 189, 248, 0.4)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow =
                                          "none";
                                      }}
                                    >
                                      {/* Pickup Overlay */}
                                      {currentPickup > 0.3 && (
                                        <div
                                          style={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            width: "100%",
                                            height: `${Math.min(
                                              (currentPickup / day.occupancy) *
                                                100 *
                                                2.5,
                                              100
                                            )}%`,
                                            backgroundColor: "#39BDF8",
                                            opacity: 0.7,
                                          }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent
                                  style={{
                                    backgroundColor: "#1f1f1c",
                                    borderColor: "#3a3a3a",
                                    color: "#e5e5e5",
                                  }}
                                >
                                  <div style={{ fontSize: "0.75rem" }}>
                                    <div
                                      style={{
                                        color: "#9ca3af",
                                        marginBottom: "0.25rem",
                                      }}
                                    >
                                      {dateStr}
                                    </div>
                                    <div
                                      style={{
                                        color: "#e5e5e5",
                                        marginBottom: "0.5rem",
                                        fontWeight: "600",
                                      }}
                                    >
                                      Occupancy: {Math.round(day.occupancy)}%
                                    </div>
                                    <div
                                      style={{
                                        color: "#39BDF8",
                                        marginBottom: "0.5rem",
                                      }}
                                    >
                                      {pickupPeriod === "24h" ? "24h" : "48h"}{" "}
                                      Pickup: +{currentPickup.toFixed(1)}%
                                    </div>
                                    <div
                                      style={{
                                        borderTop: "1px solid #3a3a3a",
                                        paddingTop: "0.5rem",
                                        marginTop: "0.5rem",
                                      }}
                                    >
                                      <div style={{ color: "white" }}>
                                        Rate: £{Math.round(day.sentinelRate)}
                                      </div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>

                      {/* Rate Line */}
                      <svg
                        style={{
                          position: "absolute",
                          left: "3rem",
                          right: "0.5rem",
                          top: "0.75rem",
                          bottom: "0.75rem",
                          pointerEvents: "none",
                          width: "calc(100% - 3.5rem)",
                          height: "calc(100% - 1.5rem)",
                        }}
                      >
                        <defs>
                          <linearGradient
                            id={`rateGradient-${hotelId}`}
                            x1="0%"
                            y1="0%"
                            x2="0%"
                            y2="100%"
                          >
                            <stop
                              offset="0%"
                              stopColor="#faff6a"
                              stopOpacity="0.15"
                            />
                            <stop
                              offset="100%"
                              stopColor="#faff6a"
                              stopOpacity="0.02"
                            />
                          </linearGradient>
                        </defs>

                        {/* Area under rate line */}
                        <path
                          d={
                            hotel.data
                              .map((day: any, idx: number) => {
                                const x = (idx / (hotel.data.length - 1)) * 100;
                                const minRate = Math.min(
                                  ...hotel.data.map((d: any) => d.sentinelRate)
                                );
                                const maxRate = Math.max(
                                  ...hotel.data.map((d: any) => d.sentinelRate)
                                );
                                const range = maxRate - minRate || 1;
                                const y =
                                  100 -
                                  ((day.sentinelRate - minRate) / range) * 100;
                                return `${idx === 0 ? "M" : "L"} ${x}% ${y}%`;
                              })
                              .join(" ") + ` L 100% 100% L 0% 100% Z`
                          }
                          fill={`url(#rateGradient-${hotelId})`}
                        />

                        {/* Rate line */}
                        <path
                          d={hotel.data
                            .map((day: any, idx: number) => {
                              const x = (idx / (hotel.data.length - 1)) * 100;
                              const minRate = Math.min(
                                ...hotel.data.map((d: any) => d.sentinelRate)
                              );
                              const maxRate = Math.max(
                                ...hotel.data.map((d: any) => d.sentinelRate)
                              );
                              const range = maxRate - minRate || 1;
                              const y =
                                100 -
                                ((day.sentinelRate - minRate) / range) * 100;
                              return `${idx === 0 ? "M" : "L"} ${x}% ${y}%`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke="#faff6a"
                          strokeOpacity="0.8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    {/* Timeline */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "1rem",
                        paddingLeft: "1rem",
                        paddingRight: "1rem",
                        fontSize: "10px",
                        color: "#6b7280",
                        fontFamily: "monospace",
                      }}
                    >
                      <span style={{ color: "#e5e5e5" }}>
                        {hotel.data[0].date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>
                        {hotel.data[19]?.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span>
                        {hotel.data[39]?.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span style={{ color: "#e5e5e5" }}>
                        {hotel.data[59]?.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span style={{ color: "#e5e5e5" }}>
                        {hotel.data[79]?.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span style={{ color: "#e5e5e5" }}>
                        {hotel.data[
                          hotel.data.length - 1
                        ]?.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
