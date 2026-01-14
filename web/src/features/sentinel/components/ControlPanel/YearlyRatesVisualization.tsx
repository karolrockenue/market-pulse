import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface YearlyRatesVisualizationProps {
  monthlyMinRates: Record<string, string>;
  monthlyMaxRates: Record<string, string>;
  dailyMaxRates?: Record<string, string>;
  currency: string;
}

export function YearlyRatesVisualization({
  monthlyMinRates,
  monthlyMaxRates,
  dailyMaxRates = {},
  currency,
}: YearlyRatesVisualizationProps) {
  const safeCurrency = currency && currency.trim() ? currency : "USD";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: 0,
  });

  // Default to collapsed to match "Room Differentials" style
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const months = [
    { key: "jan", name: "January", days: 31 },
    { key: "feb", name: "February", days: 28 },
    { key: "mar", name: "March", days: 31 },
    { key: "apr", name: "April", days: 30 },
    { key: "may", name: "May", days: 31 },
    { key: "jun", name: "June", days: 30 },
    { key: "jul", name: "July", days: 31 },
    { key: "aug", name: "August", days: 31 },
    { key: "sep", name: "September", days: 30 },
    { key: "oct", name: "October", days: 31 },
    { key: "nov", name: "November", days: 30 },
    { key: "dec", name: "December", days: 31 },
  ];

  // Generate all 365 days
  const allDays: Array<{
    monthIdx: number;
    day: number;
    monthKey: string;
    monthName: string;
    dayOfYear: number;
  }> = [];
  let dayCounter = 1;

  months.forEach((month, monthIdx) => {
    for (let day = 1; day <= month.days; day++) {
      allDays.push({
        monthIdx,
        day,
        monthKey: month.key,
        monthName: month.name,
        dayOfYear: dayCounter++,
      });
    }
  });

  // Enrich days with rate data (Logic from old file, Structure for new file)
  const processedDays = allDays.map((dayData) => {
    const minStr = monthlyMinRates[dayData.monthKey] || "0";
    const maxStr = monthlyMaxRates[dayData.monthKey] || "0";
    const dailyKey = `${dayData.monthIdx}-${dayData.day}`;
    const dailyOverride = dailyMaxRates[dailyKey];

    const minRate = parseFloat(minStr);
    let maxRate = parseFloat(maxStr);

    // Apply daily override logic
    if (dailyOverride) {
      maxRate = parseFloat(dailyOverride);
    }

    return {
      ...dayData,
      minRate,
      maxRate,
      // Jan 1, 2025 is Wednesday (3)
      dayOfWeek: (3 + dayData.dayOfYear - 1) % 7,
    };
  });

  // Calculate Scale
  const allValues = processedDays.flatMap((d) => [d.minRate, d.maxRate]);
  const maxValue = Math.max(...allValues, 500);
  // Ensure min doesn't break if 0, but usually we want a bit of buffer or 0 floor
  const minValue = Math.min(...allValues.filter((v) => v > 0), 0);

  const getBarHeight = (value: number) => {
    return ((value - minValue) / (maxValue - minValue)) * 100;
  };

  // Group by month for the new layout
  const daysByMonth = months.map((month, idx) => ({
    month,
    days: processedDays.filter((d) => d.monthIdx === idx),
  }));

  const activeDayData = hoveredDay
    ? processedDays.find((d) => d.dayOfYear === hoveredDay)
    : null;

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        border: "1px solid #2a2a2a",
        borderRadius: "8px",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              padding: "6px",
              backgroundColor: "rgba(57, 189, 248, 0.1)",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BarChart3
              style={{ width: "16px", height: "16px", color: "#39BDF8" }}
            />
          </div>
          <div>
            <h4
              style={{
                color: "#e5e5e5",
                fontSize: "13px",
                fontWeight: "500",
                margin: "0",
              }}
            >
              365-Day Rate Guardrails Overview
            </h4>
            <p
              style={{
                color: "#6b7280",
                fontSize: "11px",
                margin: "2px 0 0 0",
              }}
            >
              Daily rate corridors showing min/max ranges for the entire year
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            padding: "6px 12px",
            backgroundColor: "rgba(57, 189, 248, 0.1)",
            border: "1px solid rgba(57, 189, 248, 0.2)",
            borderRadius: "6px",
            color: "#39BDF8",
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(57, 189, 248, 0.15)";
            e.currentTarget.style.borderColor = "rgba(57, 189, 248, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(57, 189, 248, 0.1)";
            e.currentTarget.style.borderColor = "rgba(57, 189, 248, 0.2)";
          }}
        >
          {isExpanded ? (
            <ChevronUp style={{ width: "12px", height: "12px" }} />
          ) : (
            <ChevronDown style={{ width: "12px", height: "12px" }} />
          )}
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>

      {/* 365-Day Bar Chart */}
      {isExpanded && (
        <>
          <div
            style={{
              position: "relative",
              marginBottom: "16px",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              padding: "20px 20px 20px 70px",
              border: "1px solid #2a2a2a",
              overflowX: "auto",
              overflowY: "visible",
            }}
          >
            {/* Scrollable container */}
            <div
              style={{
                minWidth: "2400px",
                position: "relative",
              }}
            >
              {/* Price scale on left */}
              <div
                style={{
                  position: "absolute",
                  left: "-60px",
                  top: "20px",
                  bottom: "30px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "#6b7280",
                  textAlign: "right",
                  width: "45px",
                  zIndex: 1,
                }}
              >
                <div style={{ fontWeight: "500" }}>
                  {formatter.format(Math.round(maxValue))}
                </div>
                <div>
                  {formatter.format(
                    Math.round(maxValue * 0.75 + minValue * 0.25)
                  )}
                </div>
                <div>
                  {formatter.format(
                    Math.round(maxValue * 0.5 + minValue * 0.5)
                  )}
                </div>
                <div>
                  {formatter.format(
                    Math.round(maxValue * 0.25 + minValue * 0.75)
                  )}
                </div>
                <div style={{ fontWeight: "500" }}>
                  {formatter.format(Math.round(minValue))}
                </div>
              </div>

              {/* Chart area with months */}
              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  paddingTop: "20px",
                  paddingBottom: "10px",
                  position: "relative",
                }}
              >
                {daysByMonth.map(({ month, days }) => (
                  <div key={month.key} style={{ flex: "0 0 auto" }}>
                    {/* Month label */}
                    <div
                      style={{
                        marginBottom: "12px",
                        textAlign: "center",
                        fontSize: "11px",
                        color: "#39BDF8",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        paddingBottom: "8px",
                        borderBottom: "2px solid rgba(57, 189, 248, 0.3)",
                      }}
                    >
                      {month.name}
                    </div>

                    {/* Days for this month */}
                    <div
                      style={{
                        display: "flex",
                        gap: "2px",
                        alignItems: "flex-end",
                        height: "240px",
                        position: "relative",
                      }}
                    >
                      {days.map((day) => {
                        const isHovered = hoveredDay === day.dayOfYear;
                        const barHeight = getBarHeight(day.maxRate);
                        const minBarHeight = getBarHeight(day.minRate);
                        const corridorHeight = barHeight - minBarHeight;

                        return (
                          <div
                            key={day.dayOfYear}
                            onMouseEnter={() => setHoveredDay(day.dayOfYear)}
                            onMouseLeave={() => setHoveredDay(null)}
                            style={{
                              width: "6px",
                              height: "100%",
                              position: "relative",
                              display: "flex",
                              alignItems: "flex-end",
                              cursor: "pointer",
                            }}
                          >
                            {/* Corridor bar - Simple hover */}
                            <div
                              style={{
                                position: "absolute",
                                bottom: `${minBarHeight}%`,
                                left: 0,
                                right: 0,
                                height: `${Math.max(corridorHeight, 0.5)}%`,
                                backgroundColor: isHovered
                                  ? "rgba(57, 189, 248, 0.35)"
                                  : "rgba(57, 189, 248, 0.2)",
                                border: `1px solid ${
                                  isHovered
                                    ? "rgba(57, 189, 248, 0.6)"
                                    : "rgba(57, 189, 248, 0.4)"
                                }`,
                                borderRadius: "1px",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {/* Min marker (yellow line) */}
                              <div
                                style={{
                                  position: "absolute",
                                  bottom: "0",
                                  left: "0",
                                  right: "0",
                                  height: "2px",
                                  backgroundColor: "#faff6a",
                                  borderRadius: "1px",
                                }}
                              />

                              {/* Max marker (cyan line) */}
                              <div
                                style={{
                                  position: "absolute",
                                  top: "0",
                                  left: "0",
                                  right: "0",
                                  height: "2px",
                                  backgroundColor: "#39BDF8",
                                  borderRadius: "1px",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tooltip below chart */}
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "2px solid #39BDF8",
              borderRadius: "8px",
              padding: "12px 14px",
              fontSize: "11px",
              color: "#e5e5e5",
              marginBottom: "16px",
              minHeight: "120px",
            }}
          >
            <div
              style={{
                fontWeight: "600",
                color: activeDayData ? "#39BDF8" : "#6b7280",
                marginBottom: "8px",
                fontSize: "12px",
                textAlign: "center",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeDayData
                ? `${activeDayData.monthName} ${activeDayData.day}, 2025`
                : "Hover over any day to view rate details"}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                gap: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                  Max Ceiling
                </span>
                <span
                  style={{
                    color: "#39BDF8",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  {activeDayData
                    ? formatter.format(activeDayData.maxRate)
                    : "—"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                  Min Floor
                </span>
                <span
                  style={{
                    color: "#faff6a",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  {activeDayData
                    ? formatter.format(activeDayData.minRate)
                    : "—"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                  Corridor
                </span>
                <span
                  style={{
                    color: "#e5e5e5",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  {activeDayData
                    ? formatter.format(
                        activeDayData.maxRate - activeDayData.minRate
                      )
                    : "—"}
                </span>
              </div>
            </div>
            <div
              style={{
                fontSize: "9px",
                color: "#6b7280",
                textAlign: "center",
                marginTop: "8px",
                paddingTop: "8px",
                borderTop: "1px solid #2a2a2a",
                height: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {activeDayData
                ? `Day ${activeDayData.dayOfYear} of 365`
                : "\u00A0"}
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "16px",
              borderTop: "1px solid #2a2a2a",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "24px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "24px",
                    backgroundColor: "rgba(57, 189, 248, 0.2)",
                    border: "1px solid rgba(57, 189, 248, 0.4)",
                    borderRadius: "1px",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    fontWeight: "500",
                  }}
                >
                  Rate Corridor
                </span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "2px",
                    backgroundColor: "#39BDF8",
                    borderRadius: "1px",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Max Ceiling
                </span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "2px",
                    backgroundColor: "#faff6a",
                    borderRadius: "1px",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Min Floor
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: "10px",
                color: "#6b7280",
                fontStyle: "italic",
              }}
            >
              Scroll horizontally • Hover any day for details
            </div>
          </div>
        </>
      )}
    </div>
  );
}
