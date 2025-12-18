import { useMemo, CSSProperties } from "react";
import { MarketOutlookBanner } from "./MarketOutlookBanner";
import { DynamicYTDTrend } from "./DynamicYTDTrend";
import { OwnHotelOccupancy } from "./OwnHotelOccupancy";
import { RecentBookings } from "./RecentBookings";
import { DataPendingBlur } from "../../../components/ui/DataPendingBlur";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Area,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { type DashboardData } from "../api/dashboard.api";

interface HotelDashboardProps {
  onNavigate: (view: string) => void;
  data: DashboardData | null;
  isLoading: boolean;
}

export function HotelDashboard({
  onNavigate,
  data,
  isLoading,
}: HotelDashboardProps) {
  // 1. Safe Data Accessors (Wiring Real Data to Prototype Variables)
  const snapshot = data?.snapshot || {
    lastMonth: {
      label: "...",
      revenue: 0,
      occupancy: 0,
      adr: 0,
      yoyChange: 0,
      targetRevenue: null,
      pacingStatus: null,
    },
    currentMonth: {
      label: "...",
      revenue: 0,
      occupancy: 0,
      adr: 0,
      yoyChange: 0,
      targetRevenue: null,
      pacingStatus: null,
    },
    nextMonth: {
      label: "...",
      revenue: 0,
      occupancy: 0,
      adr: 0,
      yoyChange: 0,
      targetRevenue: null,
      pacingStatus: null,
    },
  };

  const marketOutlook = data?.marketOutlook || {
    status: "stable" as const,
    metric: "...",
  };
  const trendData = data?.forwardDemandChartData || [];
  const busiestDays = data?.demandPatterns?.busiestDays || [];
  const quietestDays = data?.demandPatterns?.quietestDays || [];
  const ytdTrendData = data?.ytdTrend || [];

  // [NEW] Detect if this is a "Day Zero" hotel (no market data yet)
  const isNewHotel = !trendData || trendData.length === 0;

  // Helper for Date Formatting
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "...";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  // Helper for Currency
  const formatCurrency = (value: number) => {
    return `£${(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  };

  // Helper for Variance formatting
  const getVariance = (current: number, target: number | null) => {
    if (!target) return { value: 0, onTarget: false, label: "0" };
    const diff = current - target;
    return {
      value: diff,
      onTarget: diff >= 0, // Simplified rule: positive variance is "on target" for revenue
      label: `${diff >= 0 ? "+" : ""}£${Math.abs(diff).toLocaleString(
        undefined,
        { maximumFractionDigits: 0 }
      )}`,
    };
  };

  // Inline Styles (Strictly copied from Prototype)
  const styles: Record<string, CSSProperties> = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#1d1d1c", // Matching your dark theme base
      position: "relative",
      overflow: "hidden",
      paddingBottom: "48px",
    },
    backgroundGradient: {
      position: "absolute",
      inset: "0",
      background:
        "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))",
      pointerEvents: "none",
    },
    gridOverlay: {
      position: "absolute",
      inset: "0",
      backgroundImage:
        "linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)",
      backgroundSize: "64px 64px",
      pointerEvents: "none",
    },
    contentWrapper: {
      position: "relative",
      zIndex: 10,
      padding: "24px",
    },
    performanceGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "16px",
      marginBottom: "24px",
    },
    card: {
      backgroundColor: "rgb(26, 26, 26)", // #1A1A1A equivalent
      borderRadius: "8px",
      border: "1px solid #2a2a2a",
      padding: "16px",
    },
    periodHeader: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: "20px",
    },
    periodLabel: {
      color: "#e5e5e5",
      fontSize: "18px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
      marginBottom: "4px",
    },
    periodSublabel: {
      color: "#6b7280",
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    trendBadge: {
      padding: "4px 8px",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    revenueSection: {
      marginBottom: "20px",
    },
    revenueRow: {
      display: "flex",
      alignItems: "flex-end",
      gap: "12px",
    },
    revenueValue: {
      color: "#39BDF8",
      fontSize: "32px",
    },
    occupancyLabel: {
      color: "#6b7280",
      fontSize: "12px",
      marginBottom: "6px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    label: {
      color: "#6b7280",
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    comparisonRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "16px",
    },
    comparisonValue: {
      color: "#9ca3af",
      fontSize: "14px",
    },
    separator: {
      marginTop: "16px",
      paddingTop: "16px",
      borderTop: "1px solid #2a2a2a",
    },
    budgetProgress: {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    budgetRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "12px",
    },
    progressBar: {
      height: "6px",
      backgroundColor: "#1a1a1a",
      borderRadius: "9999px",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: "9999px",
      backgroundColor: "#39BDF8",
      transition: "all 0.3s",
    },
    marketOutlookContainer: {
      marginBottom: "32px",
      borderRadius: "8px",
      border: "1px solid #2a2a2a",
      transition: "all 0.3s",
    },
    chartButton: {
      width: "100%",
      backgroundColor: "#1a1a1a",
      borderRadius: "0 0 8px 8px",
      border: "0",
      padding: "24px",
      textAlign: "left",
      transition: "all 0.3s",
      cursor: "pointer",
    },
    chartHeader: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: "16px",
    },
    chartDescription: {
      color: "#6b7280",
      fontSize: "12px",
    },
    viewLink: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.3s",
    },
    chartContainer: {
      height: "240px",
    },
    demandPatternsSection: {
      marginTop: "24px",
      paddingTop: "24px",
      borderTop: "1px solid #2a2a2a",
    },
    demandPatternsHeader: {
      marginBottom: "20px",
    },
    demandPatternsTitle: {
      color: "#e5e5e5",
      fontSize: "18px",
      marginBottom: "4px",
    },
    demandPatternsDescription: {
      color: "#9ca3af",
      fontSize: "12px",
    },
    demandPatternsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "24px",
    },
    patternCard: {
      backgroundColor: "#1A1A1A",
      borderRadius: "8px",
      padding: "16px",
    },
    patternHeader: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "16px",
    },
    iconBadge: {
      width: "32px",
      height: "32px",
      borderRadius: "9999px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    patternTitle: {
      color: "#e5e5e5",
      fontSize: "14px",
    },
    patternSubtitle: {
      color: "#9ca3af",
      fontSize: "12px",
    },
    table: {
      backgroundColor: "#1a1a1a",
      borderRadius: "8px",
      overflow: "hidden",
      border: "1px solid #2a2a2a",
    },
    tableHeader: {
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gap: "8px",
      padding: "8px 12px",
      borderBottom: "1px solid #2a2a2a",
      backgroundColor: "#1D1D1C",
    },
    tableHeaderCell: {
      color: "#6b7280",
      fontSize: "10px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    tableRow: {
      display: "grid",
      gridTemplateColumns: "repeat(12, 1fr)",
      gap: "8px",
      padding: "10px 12px",
      backgroundColor: "#1D1D1C",
      transition: "background-color 0.2s",
    },
    tableCell: {
      fontSize: "12px",
    },
    badge: {
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: "10px",
    },
    summary: {
      marginTop: "12px",
      borderRadius: "4px",
      padding: "12px",
    },
    summaryTitle: {
      fontSize: "12px",
      marginBottom: "4px",
    },
    summaryText: {
      color: "#e5e5e5",
      fontSize: "12px",
    },
    ytdSection: {
      marginTop: "24px",
    },
  };

  // Loading State
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div
          style={{
            ...styles.contentWrapper,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "80vh",
          }}
        >
          <div style={{ textAlign: "center", color: "#9ca3af" }}>
            <div
              className="w-12 h-12 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"
              style={{ margin: "0 auto 20px auto" }}
            ></div>
            Loading Dashboard...
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (!data) {
    return (
      <div style={styles.container}>
        <div
          style={{
            ...styles.contentWrapper,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "80vh",
          }}
        >
          <div style={{ textAlign: "center", color: "#fca5a5" }}>
            <AlertCircle
              style={{
                width: "48px",
                height: "48px",
                margin: "0 auto 12px auto",
              }}
            />
            <h3>Error Loading Dashboard</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.backgroundGradient}></div>
      <div style={styles.gridOverlay}></div>

      <div style={styles.contentWrapper}>
        {/* Performance Snapshot Grid */}
        <div style={styles.performanceGrid}>
          {/* Card 1: Last Month */}
          <div style={styles.card}>
            <div style={styles.periodHeader}>
              <div>
                <div style={styles.periodLabel}>Last Month</div>
                <div style={styles.periodSublabel}>
                  {snapshot.lastMonth.label}
                </div>
              </div>
              {/* YOY Trend Badge */}
              {snapshot.lastMonth.yoyChange !== 0 && (
                <div
                  style={{
                    ...styles.trendBadge,
                    backgroundColor:
                      snapshot.lastMonth.yoyChange > 0
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${
                      snapshot.lastMonth.yoyChange > 0
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(239, 68, 68, 0.3)"
                    }`,
                  }}
                >
                  {snapshot.lastMonth.yoyChange > 0 ? (
                    <TrendingUp
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "#10b981",
                      }}
                    />
                  ) : (
                    <TrendingDown
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "#ef4444",
                      }}
                    />
                  )}
                  <span
                    style={{
                      color:
                        snapshot.lastMonth.yoyChange > 0
                          ? "#10b981"
                          : "#ef4444",
                      fontSize: "12px",
                    }}
                  >
                    YOY {snapshot.lastMonth.yoyChange > 0 ? "+" : ""}
                    {(snapshot.lastMonth.yoyChange || 0).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            <div style={styles.revenueSection}>
              <div style={styles.revenueRow}>
                <div style={styles.revenueValue}>
                  {formatCurrency(snapshot.lastMonth.revenue)}
                </div>
                <div style={styles.occupancyLabel}>
                  {(snapshot.lastMonth.occupancy || 0).toFixed(1)}% Occ
                </div>
              </div>
              <div style={styles.label}>Total Revenue</div>
            </div>

            {/* Budget / Variance Section (Replaces Old Component) */}
            <div style={styles.separator}>
              <div style={{ ...styles.label, marginBottom: "8px" }}>Budget</div>
              {snapshot.lastMonth.targetRevenue ? (
                (() => {
                  const budget = snapshot.lastMonth.targetRevenue;
                  const actual = snapshot.lastMonth.revenue;
                  const variance = getVariance(actual, budget);
                  const pct = Math.min(100, (actual / budget) * 100);

                  return (
                    <div style={styles.budgetProgress}>
                      <div style={styles.budgetRow}>
                        <span style={{ color: "#6b7280" }}>Target</span>
                        <span style={{ color: "#9ca3af" }}>
                          {formatCurrency(budget)}
                        </span>
                      </div>
                      <div style={styles.progressBar}>
                        <div
                          style={{ ...styles.progressFill, width: `${pct}%` }}
                        />
                      </div>
                      <div style={styles.budgetRow}>
                        <span
                          style={{
                            color: variance.onTarget ? "#10b981" : "#ef4444",
                          }}
                        >
                          {variance.onTarget ? "On Target" : "Off Target"}
                        </span>
                        <span
                          style={{
                            color: variance.onTarget ? "#10b981" : "#ef4444",
                          }}
                        >
                          {variance.label}
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <button
                  onClick={() => onNavigate("settings")}
                  style={{
                    width: "100%",
                    textAlign: "center",
                    padding: "8px 0",
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "4px",
                    transition: "background-color 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#1a1a1a")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Not configured
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "10px",
                      marginTop: "4px",
                      opacity: 0.4,
                    }}
                  >
                    Click to configure →
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Current Month */}
          <div style={styles.card}>
            <div style={styles.periodHeader}>
              <div>
                <div style={styles.periodLabel}>Current Month</div>
                <div style={styles.periodSublabel}>
                  {snapshot.currentMonth.label}
                </div>
              </div>
              {snapshot.currentMonth.yoyChange !== 0 && (
                <div
                  style={{
                    ...styles.trendBadge,
                    backgroundColor:
                      snapshot.currentMonth.yoyChange > 0
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${
                      snapshot.currentMonth.yoyChange > 0
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(239, 68, 68, 0.3)"
                    }`,
                  }}
                >
                  {snapshot.currentMonth.yoyChange > 0 ? (
                    <TrendingUp
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "#10b981",
                      }}
                    />
                  ) : (
                    <TrendingDown
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "#ef4444",
                      }}
                    />
                  )}
                  <span
                    style={{
                      color:
                        snapshot.currentMonth.yoyChange > 0
                          ? "#10b981"
                          : "#ef4444",
                      fontSize: "12px",
                    }}
                  >
                    YOY {snapshot.currentMonth.yoyChange > 0 ? "+" : ""}
                    {(snapshot.currentMonth.yoyChange || 0).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            <div style={styles.revenueSection}>
              <div style={styles.revenueRow}>
                <div style={styles.revenueValue}>
                  {formatCurrency(snapshot.currentMonth.revenue)}
                </div>
                <div style={styles.occupancyLabel}>
                  {(snapshot.currentMonth.occupancy || 0).toFixed(1)}% Occ
                </div>
              </div>
              <div style={styles.label}>Total Revenue</div>
            </div>

            <div style={styles.separator}>
              <div style={{ ...styles.label, marginBottom: "8px" }}>Budget</div>
              {snapshot.currentMonth.targetRevenue ? (
                (() => {
                  const budget = snapshot.currentMonth.targetRevenue;
                  const actual = snapshot.currentMonth.revenue;
                  const variance = getVariance(actual, budget);
                  const pct = Math.min(100, (actual / budget) * 100);

                  return (
                    <div style={styles.budgetProgress}>
                      <div style={styles.budgetRow}>
                        <span style={{ color: "#6b7280" }}>Target</span>
                        <span style={{ color: "#9ca3af" }}>
                          {formatCurrency(budget)}
                        </span>
                      </div>
                      <div
                        style={{
                          ...styles.progressBar,
                          backgroundColor: "#0f0f0f",
                        }}
                      >
                        <div
                          style={{
                            ...styles.progressFill,
                            backgroundColor: "#6b7280",
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                      <div style={styles.budgetRow}>
                        <span
                          style={{
                            color: variance.onTarget ? "#10b981" : "#ef4444",
                          }}
                        >
                          {variance.onTarget ? "On Target" : "Off Target"}
                        </span>
                        <span
                          style={{
                            color: variance.onTarget ? "#10b981" : "#ef4444",
                          }}
                        >
                          {variance.label}
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <button
                  onClick={() => onNavigate("settings")}
                  style={{
                    width: "100%",
                    textAlign: "center",
                    padding: "8px 0",
                    backgroundColor: "transparent",
                    border: "none",
                    borderRadius: "4px",
                    transition: "background-color 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#0f0f0f")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Not configured
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "10px",
                      marginTop: "4px",
                      opacity: 0.4,
                    }}
                  >
                    Click to configure →
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Next Month */}
          <div style={styles.card}>
            <div style={styles.periodHeader}>
              <div>
                <div style={styles.periodLabel}>Next Month</div>
                <div style={styles.periodSublabel}>
                  {snapshot.nextMonth.label}
                </div>
              </div>
              {snapshot.nextMonth.yoyChange !== 0 && (
                <div
                  style={{
                    ...styles.trendBadge,
                    backgroundColor:
                      snapshot.nextMonth.yoyChange > 0
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(239, 68, 68, 0.1)",
                    border: `1px solid ${
                      snapshot.nextMonth.yoyChange > 0
                        ? "rgba(16, 185, 129, 0.3)"
                        : "rgba(239, 68, 68, 0.3)"
                    }`,
                  }}
                >
                  {snapshot.nextMonth.yoyChange > 0 ? (
                    <TrendingUp
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "#10b981",
                      }}
                    />
                  ) : (
                    <TrendingDown
                      style={{
                        width: "12px",
                        height: "12px",
                        color: "#ef4444",
                      }}
                    />
                  )}
                  <span
                    style={{
                      color:
                        snapshot.nextMonth.yoyChange > 0
                          ? "#10b981"
                          : "#ef4444",
                      fontSize: "12px",
                    }}
                  >
                    YOY {snapshot.nextMonth.yoyChange > 0 ? "+" : ""}
                    {(snapshot.nextMonth.yoyChange || 0).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            <div style={styles.revenueSection}>
              <div style={styles.revenueRow}>
                <div style={styles.revenueValue}>
                  {formatCurrency(snapshot.nextMonth.revenue)}
                </div>
                <div style={styles.occupancyLabel}>
                  {(snapshot.nextMonth.occupancy || 0).toFixed(1)}% Occ
                </div>
              </div>
              <div style={styles.label}>Total Revenue</div>
            </div>

            <div style={styles.separator}>
              <div style={{ ...styles.label, marginBottom: "8px" }}>Budget</div>
              {snapshot.nextMonth.targetRevenue ? (
                (() => {
                  const budget = snapshot.nextMonth.targetRevenue;
                  const actual = snapshot.nextMonth.revenue;
                  const variance = getVariance(actual, budget);
                  const pct = Math.min(100, (actual / budget) * 100);

                  return (
                    <div style={styles.budgetProgress}>
                      <div style={styles.budgetRow}>
                        <span style={{ color: "#6b7280" }}>Target</span>
                        <span style={{ color: "#9ca3af" }}>
                          {formatCurrency(budget)}
                        </span>
                      </div>
                      <div
                        style={{
                          ...styles.progressBar,
                          backgroundColor: "#0f0f0f",
                        }}
                      >
                        <div
                          style={{ ...styles.progressFill, width: `${pct}%` }}
                        />
                      </div>
                      <div style={styles.budgetRow}>
                        <span
                          style={{
                            color: variance.onTarget ? "#10b981" : "#ef4444",
                          }}
                        >
                          {variance.onTarget ? "On Target" : "Off Target"}
                        </span>
                        <span
                          style={{
                            color: variance.onTarget ? "#10b981" : "#ef4444",
                          }}
                        >
                          {variance.label}
                        </span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <button
                  onClick={() => onNavigate("settings")}
                  style={{
                    width: "100%",
                    textAlign: "center",
                    padding: "10px 12px",
                    backgroundColor: "transparent",
                    border: "1px dashed #2a2a2a",
                    borderRadius: "4px",
                    transition: "all 0.3s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#0f0f0f";
                    e.currentTarget.style.borderColor = "#6b7280";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "#2a2a2a";
                  }}
                >
                  <div style={{ color: "#6b7280", fontSize: "12px" }}>
                    Not configured
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "10px",
                      marginTop: "4px",
                      opacity: 0.4,
                    }}
                  >
                    Click to configure →
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
        {/* [NEW] Flowcast & Recent Activity Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            // height removed: lets the grid grow to fit the tallest child
            marginBottom: "24px",
          }}
        >
          <div style={{ gridColumn: "span 2" }}>
            <OwnHotelOccupancy data={data?.flowcast || []} />
          </div>
          <div style={{ gridColumn: "span 1" }}>
            <RecentBookings data={data?.recentActivity || []} />
          </div>
        </div>
        {/* Market Outlook Banner + Chart (Merged Container) */}
        <div
          style={styles.marketOutlookContainer}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(250, 255, 106, 0.5)";
            e.currentTarget.style.boxShadow =
              "0 0 20px rgba(250, 255, 106, 0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#2a2a2a";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <MarketOutlookBanner
            status={isNewHotel ? "initializing" : marketOutlook.status}
            metric={isNewHotel ? "Data Populating..." : marketOutlook.metric}
          />

          <button
            onClick={() => onNavigate("demand-pace")} // [FIX] Matches App.tsx switch case
            style={styles.chartButton}
          >
            <div style={styles.chartHeader}>
              <p style={styles.chartDescription}>
                Forward-looking 90-day outlook
              </p>
              <div style={styles.viewLink}>
                <span
                  style={{ color: "#faff6a", fontSize: "12px", opacity: 0 }}
                >
                  View
                </span>
                <ExternalLink
                  style={{ width: "16px", height: "16px", color: "#6b7280" }}
                />
              </div>
            </div>

            <div style={styles.chartContainer}>
              <DataPendingBlur
                isPending={isNewHotel}
                message="Collecting Market Data. Check back in a couple of days..."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={trendData}
                    margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="0"
                      stroke="#2a2a25"
                      opacity={0.5}
                      vertical={true}
                      horizontal={true}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#3a3a35"
                      tick={{ fill: "#6b7280", fontSize: 9 }}
                      tickLine={{ stroke: "#3a3a35" }}
                      axisLine={{ stroke: "#3a3a35" }}
                      interval={13}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#3a3a35"
                      tick={{ fill: "#6b7280", fontSize: 9 }}
                      tickLine={{ stroke: "#3a3a35" }}
                      axisLine={{ stroke: "#3a3a35" }}
                      width={35}
                      domain={[0, 100]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#3a3a35"
                      tick={{ fill: "#6b7280", fontSize: 9 }}
                      tickLine={{ stroke: "#3a3a35" }}
                      axisLine={{ stroke: "#3a3a35" }}
                      width={35}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(250, 255, 106, 0.1)" }}
                      contentStyle={{
                        backgroundColor: "rgba(26, 26, 24, 0.95)",
                        border: "1px solid #3a3a35",
                        borderRadius: "4px",
                        padding: "6px",
                        fontSize: "10px",
                      }}
                      labelStyle={{ color: "#9ca3af", fontSize: "9px" }}
                      itemStyle={{ fontSize: "10px", color: "#e5e5e5" }}
                    />

                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="marketSupply"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      strokeOpacity={0.3}
                      fill="#3b82f6"
                      fillOpacity={0.08}
                      name="Market Supply (Rooms)"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="marketDemand"
                      name="Market Demand (%)"
                      radius={[2, 2, 0, 0]}
                      maxBarSize={16}
                      fillOpacity={0.85}
                    >
                      {trendData.map((entry, index) => {
                        let fill = "#3b82f6";
                        if (entry.marketDemand >= 85) fill = "#ef4444";
                        else if (entry.marketDemand >= 70) fill = "#f97316";
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </DataPendingBlur>
            </div>

            {/* Market Demand Patterns */}
            <div style={styles.demandPatternsSection}>
              <DataPendingBlur
                isPending={isNewHotel}
                message="Collecting Market Data. Check back in a couple of days..."
              >
                <div style={styles.demandPatternsHeader}>
                  <h2 style={styles.demandPatternsTitle}>
                    Market Demand Patterns
                  </h2>
                  <p style={styles.demandPatternsDescription}>
                    365-day historical analysis identifying recurring
                    high-demand periods
                  </p>
                </div>

                <div style={styles.demandPatternsGrid}>
                  {/* Busiest Days */}
                  <div style={styles.patternCard}>
                    <div style={styles.patternHeader}>
                      <div
                        style={{
                          ...styles.iconBadge,
                          backgroundColor: "rgba(239, 68, 68, 0.2)",
                        }}
                      >
                        <TrendingUp
                          style={{
                            width: "16px",
                            height: "16px",
                            color: "#ef4444",
                          }}
                        />
                      </div>
                      <div>
                        <div style={styles.patternTitle}>
                          Top 5 Busiest Days
                        </div>
                        <div style={styles.patternSubtitle}>
                          Lowest historical availability
                        </div>
                      </div>
                    </div>

                    <div style={styles.table}>
                      <div style={styles.tableHeader}>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 1",
                          }}
                        >
                          #
                        </div>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 5",
                          }}
                        >
                          Date
                        </div>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 3",
                            textAlign: "right",
                          }}
                        >
                          Supply
                        </div>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 3",
                            textAlign: "right",
                          }}
                        >
                          Demand
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid #2a2a2a" }}>
                        {busiestDays.map((day, index) => (
                          <div
                            key={day.date}
                            style={styles.tableRow}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#141414")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#1D1D1C")
                            }
                          >
                            <div
                              style={{
                                ...styles.tableCell,
                                gridColumn: "span 1",
                                color: "#6b7280",
                              }}
                            >
                              {index + 1}
                            </div>
                            <div style={{ gridColumn: "span 5" }}>
                              <div
                                style={{
                                  ...styles.tableCell,
                                  color: "#e5e5e5",
                                }}
                              >
                                {formatDate(day.date)}
                              </div>
                              <div
                                style={{ color: "#6b7280", fontSize: "10px" }}
                              >
                                {day.dayOfWeek}
                              </div>
                            </div>
                            <div
                              style={{
                                gridColumn: "span 3",
                                textAlign: "right",
                              }}
                            >
                              <div
                                style={{ color: "#9ca3af", fontSize: "10px" }}
                              >
                                {day.supply?.toLocaleString()}
                              </div>
                            </div>
                            <div
                              style={{
                                gridColumn: "span 3",
                                textAlign: "right",
                              }}
                            >
                              <div
                                style={{
                                  ...styles.badge,
                                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                                  color: "#ef4444",
                                }}
                              >
                                {(day.availability || 0).toFixed(1)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.summary,
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                      }}
                    >
                      <div style={{ ...styles.summaryTitle, color: "#ef4444" }}>
                        High Demand Pattern
                      </div>
                      <div style={styles.summaryText}>
                        Peak saturation occurs during major holidays and summer
                        weekends. Market reaches near-sellout conditions{" "}
                        {"(<5% availability)"} on top dates.
                      </div>
                    </div>
                  </div>

                  {/* Quietest Days */}
                  <div style={styles.patternCard}>
                    <div style={styles.patternHeader}>
                      <div
                        style={{
                          ...styles.iconBadge,
                          backgroundColor: "rgba(16, 185, 129, 0.2)",
                        }}
                      >
                        <TrendingDown
                          style={{
                            width: "16px",
                            height: "16px",
                            color: "#10b981",
                          }}
                        />
                      </div>
                      <div>
                        <div style={styles.patternTitle}>
                          Top 5 Quietest Days
                        </div>
                        <div style={styles.patternSubtitle}>
                          Highest historical availability
                        </div>
                      </div>
                    </div>

                    <div style={styles.table}>
                      <div style={styles.tableHeader}>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 1",
                          }}
                        >
                          #
                        </div>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 5",
                          }}
                        >
                          Date
                        </div>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 3",
                            textAlign: "right",
                          }}
                        >
                          Supply
                        </div>
                        <div
                          style={{
                            ...styles.tableHeaderCell,
                            gridColumn: "span 3",
                            textAlign: "right",
                          }}
                        >
                          Demand
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid #2a2a2a" }}>
                        {quietestDays.map((day, index) => (
                          <div
                            key={day.date}
                            style={styles.tableRow}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#141414")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#1D1D1C")
                            }
                          >
                            <div
                              style={{
                                ...styles.tableCell,
                                gridColumn: "span 1",
                                color: "#6b7280",
                              }}
                            >
                              {index + 1}
                            </div>
                            <div style={{ gridColumn: "span 5" }}>
                              <div
                                style={{
                                  ...styles.tableCell,
                                  color: "#e5e5e5",
                                }}
                              >
                                {formatDate(day.date)}
                              </div>
                              <div
                                style={{ color: "#6b7280", fontSize: "10px" }}
                              >
                                {day.dayOfWeek}
                              </div>
                            </div>
                            <div
                              style={{
                                gridColumn: "span 3",
                                textAlign: "right",
                              }}
                            >
                              <div
                                style={{ color: "#9ca3af", fontSize: "10px" }}
                              >
                                {day.supply?.toLocaleString()}
                              </div>
                            </div>
                            <div
                              style={{
                                gridColumn: "span 3",
                                textAlign: "right",
                              }}
                            >
                              <div
                                style={{
                                  ...styles.badge,
                                  backgroundColor: "rgba(16, 185, 129, 0.2)",
                                  color: "#10b981",
                                }}
                              >
                                {(day.availability || 0).toFixed(1)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.summary,
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                      }}
                    >
                      <div style={{ ...styles.summaryTitle, color: "#10b981" }}>
                        Low Demand Pattern
                      </div>
                      <div style={styles.summaryText}>
                        Lowest demand occurs in January-February and
                        mid-November. Market shows excess capacity{" "}
                        {"(>75% availability)"} during these periods.
                      </div>
                    </div>
                  </div>
                </div>
              </DataPendingBlur>
            </div>
          </button>
        </div>
        {/* YTD Performance */}
        <div style={styles.ytdSection}>
          <DynamicYTDTrend onNavigate={onNavigate} data={ytdTrendData} />
        </div>
      </div>
    </div>
  );
}
