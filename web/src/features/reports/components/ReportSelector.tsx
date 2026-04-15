import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Calendar,
  ArrowUpDown,
  FileText,
  Target,
  Wallet,
} from "lucide-react";
import { R } from "../../../styles/tokens";

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
  const reportTypes: ReportType[] = [
    {
      id: "performance-metrics",
      title: "Performance Metrics",
      description: "Occupancy, ADR, RevPAR and market comparisons",
      icon: BarChart3,
      category: "Core Analytics",
      available: true,
    },
    {
      id: "year-on-year",
      title: "Year-on-Year",
      description: "Side-by-side comparison with variance analysis",
      icon: ArrowUpDown,
      category: "Core Analytics",
      available: true,
    },
    {
      id: "bookings-report",
      title: "Bookings Report",
      description: "Daily booking summary with guest details and sources",
      icon: Calendar,
      category: "Core Analytics",
      available: true,
    },
    {
      id: "shreeji-report",
      title: "Shreeji Report",
      description: "Daily financial and occupancy report for property management",
      icon: FileText,
      category: "Core Analytics",
      available: true,
      requiredRole: "super_admin",
    },
    {
      id: "financial-transactions",
      title: "Financial Transactions",
      description: "Revenue streams, payment methods, transaction analysis",
      icon: DollarSign,
      category: "Financial",
      available: true,
    },
    {
      id: "monthly-takings",
      title: "Monthly Takings",
      description: "Cash vs Accrual reconciliation for end-of-month",
      icon: Wallet,
      category: "Financial",
      available: true,
    },
    {
      id: "forecast-report",
      title: "Forecast & Projections",
      description: "Forward demand forecasting and rate recommendations",
      icon: TrendingUp,
      category: "Forecasting",
      available: false,
    },
    {
      id: "events-impact",
      title: "Events Impact",
      description: "Event correlation with demand and pricing",
      icon: Calendar,
      category: "Market Intelligence",
      available: false,
    },
    {
      id: "competitive-positioning",
      title: "Competitive Positioning",
      description: "Pricing and ranking against competitive set",
      icon: Target,
      category: "Market Intelligence",
      available: false,
    },
  ];

  const categories = ["Core Analytics", "Financial", "Forecasting", "Market Intelligence"];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Reports
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>
          Reports Hub
        </h1>
        <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>
          Select a report type to generate custom analysis
        </p>
      </div>

      {/* Report cards by category */}
      {categories.map((cat) => {
        const items = reportTypes.filter((r) => {
          if (r.category !== cat) return false;
          if (r.requiredRole && r.requiredRole !== userRole) return false;
          return true;
        });
        if (!items.length) return null;

        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 12 }}>
              {cat}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {items.map((r, i) => {
                const Icon = r.icon;
                const accent = i % 2 === 0 ? R.warmTeal : R.gold;
                return (
                  <div
                    key={r.id}
                    onClick={() => r.available && onSelectReport(r.id)}
                    style={{
                      background: R.darkBand,
                      border: `1px solid ${R.border}`,
                      borderRadius: 8,
                      padding: "18px",
                      cursor: r.available ? "pointer" : "default",
                      opacity: r.available ? 1 : 0.45,
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (r.available) e.currentTarget.style.borderColor = `${R.warmTeal}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = R.border;
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Icon size={15} color={accent} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>{r.title}</span>
                      {!r.available && (
                        <span style={{ fontSize: 9, color: R.textDim, background: R.bg, padding: "2px 8px", borderRadius: 4, fontWeight: 600, letterSpacing: 0.5 }}>
                          COMING SOON
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: R.textMid, margin: 0, lineHeight: 1.5 }}>{r.description}</p>
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
