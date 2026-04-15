import { TrendingUp, ExternalLink } from "lucide-react";
import { R } from "../../../styles/tokens";

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
  currencySymbol?: string;
}

export function DynamicYTDTrend({
  onNavigate,
  data: propData,
  currencySymbol = "£",
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
      return `${currencySymbol}${value.toFixed(0)}`;
    } else if (type === "revenue") {
      // [MODIFIED] Full number format with commas (e.g. £131,000)
      const absValue = Math.abs(value);
      const formatted = `${currencySymbol}${Math.round(absValue).toLocaleString()}`;
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
        backgroundColor: R.darkBand,
        borderRadius: "10px",
        border: `1px solid ${R.border}`,
        padding: "24px",
        width: "100%",
        textAlign: "left",
        transition: "all 0.3s",
        cursor: onNavigate ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${R.warmTeal}50`;
        e.currentTarget.style.boxShadow = `0 0 20px ${R.warmTeal}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = R.border;
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
              style={{ width: "20px", height: "20px", color: "#38C6BA" }}
            />
          </div>
          <div>
            <div style={{ color: R.accent, marginBottom: "4px" }}>
              Annual Performance - All Metrics
            </div>
            <div style={{ color: R.textDim, fontSize: "12px" }}>
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
                color: R.warmTeal,
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
                color: R.textDim,
                transition: "all 0.3s",
              }}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: R.darkBand,
          borderRadius: "8px",
          overflow: "hidden",
          border: `1px solid ${R.border}`,
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
            borderBottom: `1px solid ${R.sep}`,
            backgroundColor: R.heroBg,
            position: "relative",
            zIndex: 10,
          }}
        >
          <div></div>
          <div
            style={{
              gridColumn: "span 3",
              color: R.warmTeal,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
            }}
          >
            {new Date().getFullYear() - 1}
          </div>
          <div
            style={{
              gridColumn: "span 3",
              color: R.warmTeal,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              textAlign: "center",
              borderLeft: "1px solid rgba(57, 189, 248, 0.2)",
              paddingLeft: "8px",
            }}
          >
            {new Date().getFullYear()}
          </div>
          <div
            style={{
              gridColumn: "span 2",
              color: R.warmTeal,
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
            borderBottom: "1px solid #1E2330",
            backgroundColor: R.heroBg,
            position: "relative",
            zIndex: 10,
          }}
        >
          <div
            style={{
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
              color: R.textDim,
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
                  borderLeft: row.isMTD ? "2px solid #38C6BA" : "none",
                  borderTop: index > 0 ? "1px solid #1E2330" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!row.isMTD) {
                    e.currentTarget.style.backgroundColor = R.heroBg;
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
                  <span style={{ color: R.accent, fontSize: "12px" }}>
                    {row.month}
                  </span>
                  {row.isMTD && (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        backgroundColor: "rgba(57, 189, 248, 0.2)",
                        color: R.warmTeal,
                        border: "1px solid rgba(57, 189, 248, 0.3)",
                      }}
                    >
                      MTD
                    </span>
                  )}
                </div>

                {/* Last Year Metrics */}
                <div
                  style={{
                    textAlign: "center",
                    color: R.textMid,
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.occupancy.lastYear, "occupancy")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: R.textMid,
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.adr.lastYear, "adr")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: R.textMid,
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.revenue.lastYear, "revenue")}
                </div>

                {/* This Year Metrics */}
                <div
                  style={{
                    textAlign: "center",
                    color: R.accent,
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
                    color: R.accent,
                    fontSize: "12px",
                    paddingRight: "12px",
                  }}
                >
                  {formatValue(row.adr.thisYear, "adr")}
                </div>
                <div
                  style={{
                    textAlign: "center",
                    color: R.accent,
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
                          ? "rgba(52, 208, 104, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      color: revPct >= 0 ? R.green : "#ef4444",
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
                          ? "rgba(52, 208, 104, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      color: revDiff >= 0 ? R.green : "#ef4444",
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
              backgroundColor: R.heroBg,
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
              <span style={{ color: R.warmTeal, fontSize: "12px" }}>
                Annual Total
              </span>
            </div>

            {/* Last Year Totals */}
            <div
              style={{
                textAlign: "center",
                color: R.accent,
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
                color: R.accent,
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
                color: R.accent,
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

            {/* This Year Totals */}
            <div
              style={{
                textAlign: "center",
                color: R.accent,
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
                color: R.accent,
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
                color: R.accent,
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
                      ? "rgba(52, 208, 104, 0.2)"
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
                    return totalTY - totalLY >= 0 ? R.green : "#ef4444";
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
                      ? "rgba(52, 208, 104, 0.2)"
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
                    return totalTY - totalLY >= 0 ? R.green : "#ef4444";
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
