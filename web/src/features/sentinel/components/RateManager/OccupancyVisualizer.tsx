import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface OccupancyVisualizerProps {
  selectedHotel: string;
  startDate: Date;
  hoveredDay: number | null;
  data: any[];
}

export function OccupancyVisualizer({
  selectedHotel,
  startDate,
  hoveredDay,
  data = [],
}: OccupancyVisualizerProps) {
  // Transform data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const startStr = startDate.toISOString().split("T")[0];
    const startIndex = data.findIndex((d) => d.date === startStr);
    const actualStart = startIndex === -1 ? 0 : startIndex;
    const sliced = data.slice(actualStart, actualStart + 90);

    return sliced.map((d) => {
      const dateObj = new Date(d.date);
      const dayOfWeek = dateObj.getDay();
      return {
        date: dateObj,
        occupancy: d.occupancy || 0,
        available: 0,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        // [FIX] Use the Shadow Rate for the Blue Dot. Fallback to 0 (hide dot) if no prediction.
        sentinelRate: d.aiShadowRate || 0,
        minRate: d.guardrailMin || 0,
        pmsRate: d.liveRate || 0,
        isFrozen: d.isFrozen,
        pickup: d.pickup || 0,
      };
    });
  }, [data, startDate]);

  // Calculate stats
  const stats = useMemo(() => {
    if (chartData.length === 0)
      return {
        avgOcc30: 0,
        minRateDays: 0,
        minRate: 0,
        maxRate: 100,
        totalPickup: 0,
      };

    const next30 = chartData.slice(0, 30);
    const avgOcc30 =
      next30.length > 0
        ? Math.round(
            next30.reduce((sum, d) => sum + d.occupancy, 0) / next30.length
          )
        : 0;

    const minRateDays = chartData.filter(
      (d) => d.pmsRate <= d.minRate && d.pmsRate > 0
    ).length;
    const allRates = chartData.flatMap((d) =>
      [d.sentinelRate, d.minRate, d.pmsRate].filter((r) => r > 0)
    );
    const minRate = allRates.length > 0 ? Math.min(...allRates) : 0;
    const maxRate = allRates.length > 0 ? Math.max(...allRates) : 200;

    const totalPickup = chartData.reduce((sum, d) => sum + d.pickup, 0);

    return {
      avgOcc30,
      minRateDays,
      minRate: Math.max(0, minRate - 10),
      maxRate: maxRate + 20,
      totalPickup,
    };
  }, [chartData]);

  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "0.5rem",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <CollapsibleTrigger
            style={{
              width: "100%",
              borderBottom: "1px solid #2a2a2a",
              padding: "1rem",
              cursor: "pointer",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
            >
              <ChevronDown
                style={{
                  width: "1rem",
                  height: "1rem",
                  color: "#faff6a",
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                }}
              />
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
                Flowcast
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginRight: "2.5rem",
              }}
            >
              <Badge
                variant="outline"
                style={{
                  backgroundColor:
                    stats.totalPickup > 0
                      ? "rgba(16, 185, 129, 0.1)"
                      : stats.totalPickup < 0
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(74, 74, 72, 0.1)",
                  color:
                    stats.totalPickup > 0
                      ? "#10b981"
                      : stats.totalPickup < 0
                      ? "#ef4444"
                      : "#6b7280",
                  borderColor:
                    stats.totalPickup > 0
                      ? "rgba(16, 185, 129, 0.3)"
                      : stats.totalPickup < 0
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(74, 74, 72, 0.3)",
                }}
              >
                Pickup: {stats.totalPickup > 0 ? "+" : ""}
                {stats.totalPickup}
              </Badge>

              <Badge
                variant="outline"
                style={{
                  backgroundColor: "rgba(74, 74, 72, 0.1)",
                  color: "#6b7280",
                  borderColor: "rgba(74, 74, 72, 0.3)",
                }}
              >
                30D AVG: {stats.avgOcc30}%
              </Badge>
              <Badge
                variant="outline"
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "#ef4444",
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
              >
                Min Rate Days: {stats.minRateDays}
              </Badge>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div style={{ padding: "1.5rem" }}>
              <div
                style={{
                  position: "relative",
                  height: "14rem",
                  backgroundColor: "#141410",
                  borderRadius: "0.25rem",
                  border: "1px solid rgba(250, 255, 106, 0.15)",
                  overflow: "hidden",
                }}
              >
                {/* Y-axis labels (Occupancy - Left) */}
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
                    paddingBottom: "2rem",
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

                {/* Y-axis labels (Rate - Right) */}
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "3.5rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    paddingTop: "0.75rem",
                    paddingBottom: "2rem",
                  }}
                >
                  {(() => {
                    const range = stats.maxRate - stats.minRate || 1;
                    const labels = [
                      stats.maxRate,
                      Math.round(stats.maxRate - range / 3),
                      Math.round(stats.maxRate - (2 * range) / 3),
                      stats.minRate,
                    ];
                    return labels.map((val, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          paddingLeft: "0.5rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "10px",
                            color: "rgba(250, 255, 106, 0.6)",
                            fontFamily: "monospace",
                          }}
                        >
                          £{val}
                        </span>
                      </div>
                    ));
                  })()}
                </div>

                {/* X-Axis Labels (Timeline) */}
                <div
                  style={{
                    position: "absolute",
                    left: "3rem",
                    right: "3.5rem",
                    bottom: 0,
                    height: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    borderTop: "1px solid #2a2a2a",
                  }}
                >
                  {chartData.map((day, idx) => {
                    const isFirstOfMonth = day.date.getDate() === 1;
                    const isMonday = day.date.getDay() === 1;

                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          position: "relative",
                          height: "100%",
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        {isFirstOfMonth && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: "4px",
                              fontSize: "10px",
                              fontWeight: "bold",
                              color: "#e5e5e5",
                              whiteSpace: "nowrap",
                              paddingLeft: "2px",
                            }}
                          >
                            {format(day.date, "MMM").toUpperCase()}
                          </div>
                        )}

                        {isMonday && !isFirstOfMonth && (
                          <div
                            style={{
                              position: "absolute",
                              top: "4px",
                              fontSize: "9px",
                              color: "#6b7280",
                            }}
                          >
                            {day.date.getDate()}
                          </div>
                        )}

                        <div
                          style={{
                            width: "1px",
                            height: isFirstOfMonth ? "6px" : "3px",
                            backgroundColor: isFirstOfMonth
                              ? "#e5e5e5"
                              : "#2a2a2a",
                            marginTop: "0px",
                          }}
                        ></div>
                      </div>
                    );
                  })}
                </div>

                {/* Bars - Occupancy */}
                <div
                  style={{
                    position: "absolute",
                    left: "3rem",
                    right: "3.5rem",
                    top: "0.75rem",
                    bottom: "2rem",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "2px",
                  }}
                >
                  {chartData.map((day, idx) => {
                    const isHovered = hoveredDay === idx;

                    const pickupHeightPct = Math.min(
                      Math.abs(day.pickup) * 1.5,
                      day.occupancy
                    );
                    const relativeHeight =
                      day.occupancy > 0
                        ? (pickupHeightPct / day.occupancy) * 100
                        : 0;

                    return (
                      <TooltipProvider key={idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              style={{
                                flex: 1,
                                height: "100%",
                                position: "relative",
                                display: "flex",
                                alignItems: "flex-end",
                              }}
                            >
                              {/* 1. Main Bar (Total Occupancy) */}
                              <div
                                style={{
                                  width: "100%",
                                  backgroundColor: "#2a2a2a",
                                  height: `${Math.min(day.occupancy, 100)}%`,
                                  transition: "all 0.2s",
                                  boxShadow: isHovered
                                    ? "inset 0 0 12px rgba(57, 189, 248, 0.4)"
                                    : "none",
                                  position: "relative",
                                  zIndex: 1,
                                }}
                              >
                                {/* 2a. Positive Pickup (Blue Tip INSIDE at Top) */}
                                {day.pickup > 0 && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      backgroundColor: "#39BDF8",
                                      height: `${relativeHeight}%`,
                                      transition: "all 0.2s",
                                      opacity: 1,
                                    }}
                                  ></div>
                                )}

                                {/* 2b. Negative Pickup (Red Tip OUTSIDE at Top) */}
                                {day.pickup < 0 && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: "100%",
                                      left: 0,
                                      right: 0,
                                      backgroundColor: "rgba(239, 68, 68, 0.6)",
                                      height: `${Math.abs(day.pickup) * 1.5}%`,
                                      transition: "all 0.2s",
                                    }}
                                  ></div>
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
                                {format(day.date, "EEE, MMM do")}
                              </div>
                              <div style={{ color: "#39BDF8" }}>
                                {Math.round(day.occupancy)}% occupied
                              </div>
                              <div style={{ color: "white" }}>
                                PMS Rate: £{day.pmsRate}
                              </div>
                              {/* [NEW] AI Rate Tooltip */}
                              {day.sentinelRate > 0 && (
                                <div style={{ color: "#39BDF8" }}>
                                  Sentinel Rate: £{day.sentinelRate}
                                </div>
                              )}
                              <div style={{ color: "#ef4444" }}>
                                Min: £{day.minRate}
                              </div>
                              {day.pickup !== 0 && (
                                <div
                                  style={{
                                    color:
                                      day.pickup > 0 ? "#10b981" : "#ef4444",
                                    marginTop: "4px",
                                    fontWeight: 600,
                                  }}
                                >
                                  Pickup: {day.pickup > 0 ? "+" : ""}
                                  {day.pickup}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>

                {/* Rate Dots Overlay */}
                <div
                  style={{
                    position: "absolute",
                    left: "3rem",
                    right: "3.5rem",
                    top: "0.75rem",
                    bottom: "2rem",
                    display: "flex",
                    gap: "2px",
                    pointerEvents: "none",
                    zIndex: 20,
                  }}
                >
                  {chartData.map((day, idx) => {
                    const range = stats.maxRate - stats.minRate || 1;

                    const pmsHeight = Math.max(
                      0,
                      Math.min(
                        100,
                        ((day.pmsRate - stats.minRate) / range) * 100
                      )
                    );
                    const sentinelHeight = Math.max(
                      0,
                      Math.min(
                        100,
                        ((day.sentinelRate - stats.minRate) / range) * 100
                      )
                    );

                    return (
                      <div
                        key={idx}
                        style={{
                          flex: 1,
                          position: "relative",
                          height: "100%",
                        }}
                      >
                        {/* Sentinel AI Rate (Blue Dot) */}
                        {day.sentinelRate > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              transform: "translateX(-50%)",
                              borderRadius: "9999px",
                              backgroundColor: "#39BDF8",
                              border: "1px solid #141410",
                              width: "0.375rem",
                              height: "0.375rem",
                              bottom: `${sentinelHeight}%`,
                              zIndex: 5,
                            }}
                          />
                        )}

                        {/* PMS Rate (White Dot) - Rendered second to appear on top if equal */}
                        {day.pmsRate > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              transform: "translateX(-50%)",
                              borderRadius: "9999px",
                              backgroundColor: "white",
                              border: "1px solid #141410",
                              width: "0.375rem",
                              height: "0.375rem",
                              bottom: `${pmsHeight}%`,
                              zIndex: 10,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Min Rate Floor Lines */}
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    left: "3rem",
                    right: "3.5rem",
                    top: "0.75rem",
                    bottom: "2rem",
                    pointerEvents: "none",
                    width: "calc(100% - 6.5rem)",
                    height: "calc(100% - 2.75rem)",
                    zIndex: 25,
                  }}
                >
                  {chartData.map((day, idx) => {
                    const x = ((idx + 0.5) / chartData.length) * 100;
                    const range = stats.maxRate - stats.minRate || 1;
                    const y =
                      100 - ((day.minRate - stats.minRate) / range) * 100;
                    const lineWidth = (1 / Math.max(1, chartData.length)) * 80;
                    return (
                      <line
                        key={`min-${idx}`}
                        x1={x - lineWidth / 2}
                        y1={y}
                        x2={x + lineWidth / 2}
                        y2={y}
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        strokeOpacity="0.6"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Legend */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "1.5rem",
                  marginTop: "1rem",
                  borderTop: "1px solid #2a2a2a",
                  paddingTop: "1rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "0.75rem",
                      height: "0.75rem",
                      backgroundColor: "#2a2a2a",
                      borderRadius: "2px",
                    }}
                  ></div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }}
                  >
                    Occupancy
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "0.75rem",
                      height: "0.75rem",
                      backgroundColor: "#39BDF8",
                      borderRadius: "2px",
                    }}
                  ></div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }}
                  >
                    Pickup
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "0.5rem",
                      height: "0.5rem",
                      backgroundColor: "white",
                      borderRadius: "50%",
                      border: "1px solid #2a2a2a",
                    }}
                  ></div>

                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }}
                  >
                    PMS Rate
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "0.5rem",
                      height: "0.5rem",
                      backgroundColor: "#39BDF8",
                      borderRadius: "50%",
                      border: "1px solid #2a2a2a",
                    }}
                  ></div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }}
                  >
                    Sentinel AI Rate
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "1rem",
                      height: "2px",
                      backgroundColor: "#ef4444",
                    }}
                  ></div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }}
                  >
                    Min Rate (Guardrail)
                  </span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
