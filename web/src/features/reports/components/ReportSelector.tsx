import { useState } from "react";
import {
  BarChart3,
  Globe,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  ArrowUpDown,
  FileText,
  ChevronRight,
  PieChart,
  Target,
  Building2,
  Wallet,
} from "lucide-react";

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: string;
  available: boolean;
  requiredRole?: string;
}

interface ReportSelectorProps {
  onSelectReport: (reportId: string) => void;
  userRole?: string;
}

export function ReportSelector({
  onSelectReport,
  userRole,
}: ReportSelectorProps) {
  const [hoveredReport, setHoveredReport] = useState<string | null>(null);

  const reportTypes: ReportType[] = [
    // --- Core Analytics ---
    {
      id: "performance-metrics",
      title: "Performance Metrics",
      description:
        "Comprehensive analysis of occupancy, ADR, RevPAR, and market comparisons over time",
      icon: BarChart3,
      category: "Core Analytics",
      available: true,
    },
    {
      id: "year-on-year",
      title: "Year-on-Year Comparison",
      description:
        "Side-by-side comparison of 2024 vs 2025 performance with variance analysis and growth metrics",
      icon: ArrowUpDown,
      category: "Core Analytics",
      available: true,
    },
    {
      id: "performance-vs-budget",
      title: "Performance vs Budget",
      description:
        "Track performance against defined budget targets for ADR, Occupancy, and Revenue",
      icon: PieChart,
      category: "Core Analytics",
      available: true,
    },

    // --- Internal Reports (Restricted) ---
    {
      id: "shreeji-report",
      title: "Shreeji Report",
      description:
        "Daily financial and occupancy report for property management with in-house guests and takings",
      icon: FileText,
      category: "Core Analytics", // Kept in Core as per PROT, or move to 'Internal Reports' if you prefer separation
      available: true,
      requiredRole: "super_admin",
    },
    {
      id: "portfolio-overview",
      title: "Portfolio Overview",
      description: "High-level aggregated view of all properties in the group.",
      icon: Building2,
      category: "Internal Reports",
      available: true,
      requiredRole: "super_admin",
    },

    // --- Guest Analytics ---
    {
      id: "guest-source-countries",
      title: "Guest Source Countries",
      description:
        "Geographic breakdown of guest origins, booking patterns, and regional market insights",
      icon: Globe,
      category: "Guest Analytics",
      available: true,
    },
    {
      id: "guest-demographics",
      title: "Guest Demographics",
      description:
        "Analyze guest profiles, booking behavior, length of stay, and customer segmentation",
      icon: Users,
      category: "Guest Analytics",
      available: false,
    },

    // --- Financial ---
    {
      id: "financial-transactions",
      title: "Financial Transactions",
      description:
        "Detailed financial reporting including revenue streams, payment methods, and transaction analysis",
      icon: DollarSign,
      category: "Financial",
      available: true,
    },
    {
      id: "monthly-takings",
      title: "Monthly Takings",
      description:
        "Reconcile Cash (Takings) vs Accrual (Revenue) for end-of-month reporting",
      icon: Wallet,
      category: "Financial",
      available: true,
    },

    // --- Forecasting ---
    {
      id: "forecast-report",
      title: "Forecast & Projections",
      description:
        "Forward-looking analysis with demand forecasting, rate recommendations, and revenue projections",
      icon: TrendingUp,
      category: "Forecasting",
      available: false,
    },

    // --- Market Intelligence ---
    {
      id: "events-impact",
      title: "Events Impact Analysis",
      description:
        "Correlation between local events, market demand, and pricing performance",
      icon: Calendar,
      category: "Market Intelligence",
      available: false,
    },
    {
      id: "competitive-positioning",
      title: "Competitive Positioning",
      description:
        "Analyze your hotel's pricing and ranking against the compset.",
      icon: Target,
      category: "Market Intelligence",
      available: false,
    },
  ];

  const categories = [
    "Core Analytics",
    "Guest Analytics",
    "Financial",
    "Forecasting",
    "Market Intelligence",
    "Internal Reports",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header - Aligned with ReportsHub.tsx detail view */}
      <div style={{ marginBottom: "24px" }}>
        {/* Spacer to match Back Button height (text-sm + mb-2 = ~28px) */}
        <div style={{ height: "28px", marginBottom: "0px" }} />
        <h1
          style={{
            color: "white",
            fontSize: "24px",
            lineHeight: "32px",
            margin: 0,
            marginBottom: "4px",
            fontWeight: 400,
          }}
        >
          Reports Hub
        </h1>
        <p
          style={{
            color: "#9ca3af",
            fontSize: "14px",
            lineHeight: "20px",
            margin: 0,
          }}
        >
          Select a report type to begin building your custom analysis
        </p>
      </div>

      {/* Reports by Category */}
      {categories.map((category) => {
        // Filter: Category match AND Role match
        const categoryReports = reportTypes.filter((r) => {
          if (r.category !== category) return false;
          if (r.requiredRole && r.requiredRole !== userRole) return false;
          return true;
        });

        if (categoryReports.length === 0) return null;

        return (
          <div
            key={category}
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {/* Category Header */}
            <div
              style={{
                backgroundColor: "#242424",
                borderBottom: "1px solid #2a2a2a",
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  color: "#9ca3af",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: 0,
                }}
              >
                {category}
              </h2>
              <span
                style={{
                  color: "#9ca3af",
                  fontSize: "11px",
                }}
              >
                {categoryReports.filter((r) => r.available).length}/
                {categoryReports.length}
              </span>
            </div>

            {/* Reports List */}
            <div style={{ padding: "8px" }}>
              {categoryReports.map((report) => {
                const Icon = report.icon;
                const isHovered = hoveredReport === report.id;

                return (
                  <div
                    key={report.id}
                    onMouseEnter={() => setHoveredReport(report.id)}
                    onMouseLeave={() => setHoveredReport(null)}
                    style={{
                      backgroundColor:
                        isHovered && report.available
                          ? "rgba(57, 189, 248, 0.05)"
                          : "transparent",
                      border:
                        isHovered && report.available
                          ? "1px solid rgba(57, 189, 248, 0.2)"
                          : "1px solid transparent",
                      borderRadius: "6px",
                      padding: "12px 14px",
                      marginBottom: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      cursor: report.available ? "pointer" : "default",
                      transition: "all 0.2s",
                      opacity: report.available ? 1 : 0.6,
                    }}
                    onClick={() =>
                      report.available && onSelectReport(report.id)
                    }
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: report.available
                          ? "rgba(57, 189, 248, 0.1)"
                          : "#2a2a2a",
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        style={{
                          width: "18px",
                          height: "18px",
                          color: report.available ? "#39BDF8" : "#6b7280",
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: report.available ? "#e5e5e5" : "#9ca3af",
                          fontSize: "13px",
                          textTransform: "uppercase",
                          letterSpacing: "-0.025em",
                          marginBottom: "4px",
                        }}
                      >
                        {report.title}
                      </div>
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: "11px",
                          lineHeight: "1.4",
                        }}
                      >
                        {report.description}
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flexShrink: 0,
                      }}
                    >
                      {!report.available && (
                        <span
                          style={{
                            color: "#6b7280",
                            fontSize: "10px",
                            backgroundColor: "#2a2a2a",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Soon
                        </span>
                      )}
                      {report.available && (
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isHovered
                              ? "#39BDF8"
                              : "rgba(57, 189, 248, 0.1)",
                            transition: "all 0.2s",
                          }}
                        >
                          <ChevronRight
                            style={{
                              width: "16px",
                              height: "16px",
                              color: isHovered ? "#0f0f0f" : "#39BDF8",
                            }}
                          />
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
  );
}
