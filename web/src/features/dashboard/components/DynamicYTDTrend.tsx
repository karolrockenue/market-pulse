import { TrendingUp, ExternalLink } from "lucide-react";

// [NEW] Interfaces for data handling
interface MetricValues {
  thisYear: number;
  lastYear: number;
}

interface MonthData {
  month: string;
  monthIndex: number;
  isMTD?: boolean;
  revenue: MetricValues;
  occupancy: MetricValues;
  adr: MetricValues;
  roomsSold: MetricValues;
}

interface DynamicYTDTrendProps {
  onNavigate?: (view: string) => void;
  data?: any[]; // Map incoming API data
}

export function DynamicYTDTrend({
  onNavigate,
  data: propData,
}: DynamicYTDTrendProps) {
  // [NEW] Map data safely from API format to internal structure
  const multiMetricData: MonthData[] = (
    Array.isArray(propData) ? propData : []
  ).map((row) => {
    // Helper to extract nested OR flat data to handle different API shapes
    const extract = (key: string): { thisYear: number; lastYear: number } => {
      // 1. Try Nested Object: row[key] = { thisYear, lastYear }
      if (row[key] && typeof row[key] === "object") {
        return {
          thisYear: Number(row[key].thisYear) || 0,
          lastYear: Number(row[key].lastYear) || 0,
        };
      }
      // 2. Try Flat Keys: row[key] (current) & row[key + 'LastYear'] / row[key + '_last_year']
      const current = Number(row[key]) || 0;
      const last =
        Number(row[`${key}LastYear`]) || Number(row[`${key}_last_year`]) || 0;
      return { thisYear: current, lastYear: last };
    };

    return {
      month: row.month || "Unknown",
      monthIndex: row.monthIndex || 0,
      isMTD: !!row.isMTD,
      revenue: extract("revenue"),
      occupancy: extract("occupancy"),
      adr: extract("adr"),
      roomsSold: extract("roomsSold"),
    };
  });

  // [NEW] Formatter from Prototype
  const formatValue = (
    value: number,
    type: "occupancy" | "adr" | "revenue",
    showSign = false
  ): string => {
    if (type === "occupancy") {
      return `${value.toFixed(1)}%`;
    } else if (type === "adr") {
      return `£${value.toFixed(0)}`;
    } else if (type === "revenue") {
      // [MODIFIED] Full number format with commas (e.g. £131,000)
      const absValue = Math.abs(value);
      const formatted = `£${Math.round(absValue).toLocaleString()}`;
      const sign = value < 0 ? "-" : showSign ? "+" : "";
      return `${sign}${formatted}`;
    }
    return value.toString();
  };

  const formatVariance = (value: number): string => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  // [NEW] Grid Template matching 9 columns
  const GRID_TEMPLATE = "repeat(9, 1fr)";

  return (
    <div
      onClick={onNavigate ? () => onNavigate("reports") : undefined}
      style={{
        backgroundColor: "#1a1a1a",
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
        padding: "24px",
        width: "100%",
        textAlign: "left",
        transition: "all 0.3s",
        cursor: onNavigate ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(57, 189, 248, 0.5)";
        e.currentTarget.style.boxShadow = "0 0 20px rgba(57, 189, 248, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#2a2a2a";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor: "rgba(57, 189, 248, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.3s",
            }}
          >
            <TrendingUp
              style={{ width: "20px", height: "20px", color: "#39BDF8" }}
            />
          </div>
          <div>
            <div style={{ color: "#e5e5e5", marginBottom: "4px" }}>
              YTD Performance - All Metrics
            </div>
            <div style={{ color: "#6b7280", fontSize: "12px" }}>
              ADR, Occupancy & Revenue comparison ({multiMetricData.length}{" "}
              {multiMetricData.length === 1 ? "month" : "months"})
            </div>
          </div>
        </div>
        {onNavigate && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "gap 0.3s",
            }}
          >
            <span
              style={{
                color: "#39BDF8",
                fontSize: "12px",
                opacity: 0,
                transition: "opacity 0.3s",
              }}
            >
              View
            </span>
            <ExternalLink
              style={{
                width: "16px",
                height: "16px",
                color: "#6b7280",
                transition: "all 0.3s",
              }}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: "8px",
          overflow: "hidden",
          border: "1px solid #2a2a2a",
          position: "relative",
        }}
      >
        {/* Column Backgrounds for Revenue columns */}
        <div
          style={{
            position: "absolute",
            inset: "0",
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
            gap: "8px",
            padding: "0 16px",
            pointerEvents: "none",
          }}
        >
          <div></div>
          <div></div>
          <div></div>
          <div style={{ backgroundColor: "rgba(57, 189, 248, 0.05)" }}></div>
          <div></div>
          <div></div>
          <div style={{ backgroundColor: "rgba(57, 189, 248, 0.05)" }}></div>
          <div></div>
          <div></div>
        </div>

        {/* Table Header - Year Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
            gap: "8px",
            padding: "8px 16px",
            borderBottom: "1px solid rgba(42, 42, 42, 0.5)",
            backgroundColor: "#1D1D1C",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div></div>
          <div
            style={{
              gridColumn: "span 3",
              color: "#39BDF8",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
            }}
          >
            2024
          </div>
          <div
            style={{
              gridColumn: "span 3",
              color: "#39BDF8",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
              paddingLeft: "8px",
            }}
          >
            2025
          </div>
          <div
            style={{
              gridColumn: "span 2",
              color: "#39BDF8",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
              paddingLeft: "8px",
            }}
          >
            Delta
          </div>
        </div>

        {/* Table Header - Metric Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: GRID_TEMPLATE,
            gap: "8px",
            padding: "12px 16px",
            borderBottom: "1px solid #2a2a2a",
            backgroundColor: "#1D1D1C",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              paddingRight: "12px",
            }}
          >
            Month
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
            }}
          >
            Occ
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
            }}
          >
            ADR
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
            }}
          >
            Rev
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
              borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
              paddingLeft: "8px",
            }}
          >
            Occ
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
            }}
          >
            ADR
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
            }}
          >
            Rev
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
              borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
              paddingLeft: "8px",
            }}
          >
            Rev %
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              paddingRight: "12px",
            }}
          >
            Rev $
          </div>
        </div>

        {/* Table Body */}
        <div style={{ position: "relative", zIndex: 10 }}>
          {multiMetricData.map((row, index) => {
            const revDiff = row.revenue.thisYear - row.revenue.lastYear;
            const revPct =
              row.revenue.lastYear !== 0
                ? (revDiff / row.revenue.lastYear) * 100
                : 0;

            return (
              <div
                key={row.monthIndex}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID_TEMPLATE,
                  gap: "8px",
                  padding: "14px 16px",
                  transition: "background-color 0.3s",
                  backgroundColor: row.isMTD
                    ? "rgba(57, 189, 248, 0.1)"
                    : "transparent",
                  borderLeft: row.isMTD ? "2px solid #39BDF8" : "none",
                  borderTop: index > 0 ? "1px solid #2a2a2a" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!row.isMTD) {
                    e.currentTarget.style.backgroundColor = "#141414";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!row.isMTD) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {/* Month */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    paddingRight: "12px",
                  }}
                >
                  <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
                    {row.month}
                  </span>
                  {row.isMTD && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        backgroundColor: "rgba(57, 189, 248, 0.2)",
                        color: "#39BDF8",
                        border: "1px solid rgba(57, 189, 248, 0.3)",
                      }}
                    >
                      MTD
                    </span>
                  )}
                </div>

                {/* 2024 Metrics */}
                <div
                  style={{
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.occupancy.lastYear, "occupancy")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.adr.lastYear, "adr")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.revenue.lastYear, "revenue")}
                </div>

                {/* 2025 Metrics */}
                <div
                  style={{
                    textAlign: "center",
                    color: "#e5e5e5",
                    fontSize: "12px",
                    paddingRight: "12px",
                    borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
                    paddingLeft: "8px",
                  }}
                >
                  {formatValue(row.occupancy.thisYear, "occupancy")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#e5e5e5",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.adr.thisYear, "adr")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: "#e5e5e5",
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.revenue.thisYear, "revenue")}
                </div>

                {/* Delta % */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    paddingRight: "12px",
                    borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
                    paddingLeft: "8px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      backgroundColor:
                        revPct >= 0
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      color: revPct >= 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {formatVariance(revPct)}
                  </span>
                </div>

                {/* Delta $ */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    paddingRight: "12px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      backgroundColor:
                        revDiff >= 0
                          ? "rgba(16, 185, 129, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      color: revDiff >= 0 ? "#10b981" : "#ef4444",
                    }}
                  >
                    {formatValue(revDiff, "revenue", true)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Totals Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_TEMPLATE,
              gap: "8px",
              padding: "14px 16px",
              backgroundColor: "#1D1D1C",
              borderTop: "2px solid rgba(57, 189, 248, 0.3)",
              position: "relative",
              zIndex: 10,
            }}
          >
            {/* Label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingRight: "12px",
              }}
            >
              <span style={{ color: "#39BDF8", fontSize: "12px" }}>
                YTD Total
              </span>
            </div>

            {/* 2024 Totals */}
            <div
              style={{
                textAlign: "center",
                color: "#e5e5e5",
                fontSize: "12px",
                paddingRight: "12px",
              }}
            >
              {formatValue(
                multiMetricData.length
                  ? multiMetricData.reduce(
                      (sum, row) => sum + row.occupancy.lastYear,
                      0
                    ) / multiMetricData.length
                  : 0,
                "occupancy"
              )}
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#e5e5e5",
                fontSize: "12px",
                paddingRight: "12px",
              }}
            >
              {formatValue(
                (() => {
                  const totalRev = multiMetricData.reduce(
                    (sum, row) => sum + row.revenue.lastYear,
                    0
                  );
                  const totalSold = multiMetricData.reduce(
                    (sum, row) => sum + row.roomsSold.lastYear,
                    0
                  );
                  return totalSold ? totalRev / totalSold : 0;
                })(),
                "adr"
              )}
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#e5e5e5",
                fontSize: "12px",
                paddingRight: "12px",
              }}
            >
              {formatValue(
                multiMetricData.reduce(
                  (sum, row) => sum + row.revenue.lastYear,
                  0
                ),
                "revenue"
              )}
            </div>

            {/* 2025 Totals */}
            <div
              style={{
                textAlign: "center",
                color: "#e5e5e5",
                fontSize: "12px",
                paddingRight: "12px",
                borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
                paddingLeft: "8px",
              }}
            >
              {formatValue(
                multiMetricData.length
                  ? multiMetricData.reduce(
                      (sum, row) => sum + row.occupancy.thisYear,
                      0
                    ) / multiMetricData.length
                  : 0,
                "occupancy"
              )}
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#e5e5e5",
                fontSize: "12px",
                paddingRight: "12px",
              }}
            >
              {formatValue(
                (() => {
                  const totalRev = multiMetricData.reduce(
                    (sum, row) => sum + row.revenue.thisYear,
                    0
                  );
                  const totalSold = multiMetricData.reduce(
                    (sum, row) => sum + row.roomsSold.thisYear,
                    0
                  );
                  return totalSold ? totalRev / totalSold : 0;
                })(),
                "adr"
              )}
            </div>
            <div
              style={{
                textAlign: "center",
                color: "#e5e5e5",
                fontSize: "12px",
                paddingRight: "12px",
              }}
            >
              {formatValue(
                multiMetricData.reduce(
                  (sum, row) => sum + row.revenue.thisYear,
                  0
                ),
                "revenue"
              )}
            </div>

            {/* Totals Delta % */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                paddingRight: "12px",
                borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
                paddingLeft: "8px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  backgroundColor: (() => {
                    const totalLY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.lastYear,
                      0
                    );
                    const totalTY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.thisYear,
                      0
                    );
                    const v = totalLY
                      ? ((totalTY - totalLY) / totalLY) * 100
                      : 0;
                    return v >= 0
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(239, 68, 68, 0.2)";
                  })(),
                  color: (() => {
                    const totalLY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.lastYear,
                      0
                    );
                    const totalTY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.thisYear,
                      0
                    );
                    return totalTY - totalLY >= 0 ? "#10b981" : "#ef4444";
                  })(),
                }}
              >
                {(() => {
                  const totalLY = multiMetricData.reduce(
                    (sum, row) => sum + row.revenue.lastYear,
                    0
                  );
                  const totalTY = multiMetricData.reduce(
                    (sum, row) => sum + row.revenue.thisYear,
                    0
                  );
                  const v = totalLY ? ((totalTY - totalLY) / totalLY) * 100 : 0;
                  return formatVariance(v);
                })()}
              </span>
            </div>

            {/* Totals Delta $ */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                paddingRight: "12px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  backgroundColor: (() => {
                    const totalLY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.lastYear,
                      0
                    );
                    const totalTY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.thisYear,
                      0
                    );
                    return totalTY - totalLY >= 0
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(239, 68, 68, 0.2)";
                  })(),
                  color: (() => {
                    const totalLY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.lastYear,
                      0
                    );
                    const totalTY = multiMetricData.reduce(
                      (sum, row) => sum + row.revenue.thisYear,
                      0
                    );
                    return totalTY - totalLY >= 0 ? "#10b981" : "#ef4444";
                  })(),
                }}
              >
                {(() => {
                  const totalLY = multiMetricData.reduce(
                    (sum, row) => sum + row.revenue.lastYear,
                    0
                  );
                  const totalTY = multiMetricData.reduce(
                    (sum, row) => sum + row.revenue.thisYear,
                    0
                  );
                  return formatValue(totalTY - totalLY, "revenue", true);
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
