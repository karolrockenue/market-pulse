// web/src/features/reports/ReportsHub.tsx

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button"; // Stays global (up 2 levels)
import { toast } from "sonner";

// --- LOCAL FEATURE COMPONENTS (./components) ---
import { ReportSelector } from "./components/ReportSelector";
import { ReportTable } from "./components/ReportTable";
import { RoundedGridReportControls } from "./components/RoundedGridReportControls";
import { MetricSelectorChips } from "./components/MetricSelectorChips";
import { FormattingOptions } from "./components/FormattingOptions";
import { ReportActions } from "./components/ReportActions";
import { BudgetReport } from "./components/BudgetReport";
import { YearOnYearReport } from "./components/YearOnYearReport";
import { ShreejiReport } from "./components/ShreejiReport";
import { PortfolioOverview } from "./components/PortfolioOverview"; // <--- UPDATED: Now local
import { MonthlyTakingsReport } from "./components/MonthlyTakingsReport";

// --- GLOBAL COMPONENTS (../../components) ---
// These are shared components that live in src/components
import { CreateScheduleModal } from "../../components/CreateScheduleModal";
import { ManageSchedulesModal } from "../../components/ManageSchedulesModal";

// --- HOOKS ---
import { useReportData } from "./hooks/useReportData";
import { useScheduledReports } from "./hooks/useScheduledReports";

interface ReportsHubProps {
  hotelId: string;
  propertyName?: string; // Used for export filenames
  currencySymbol: string; // e.g. '$', '£'
  currencyCode: string; // e.g. 'USD', 'GBP'
  userRole?: string;
}

export const ReportsHub: React.FC<ReportsHubProps> = ({
  hotelId,
  propertyName,
  currencySymbol,
  currencyCode,
  userRole,
}) => {
  // --- STATE: View Navigation ---
  const [activeReportType, setActiveReportType] = useState<string | null>(null);

  // --- STATE: Report Configuration (Lifted from Table/App) ---
  const [startDate, setStartDate] = useState("2025-09-01");
  const [endDate, setEndDate] = useState("2025-09-15");
  const [datePreset, setDatePreset] = useState("current-month");
  const [granularity, setGranularity] = useState("daily");

  // Metrics & Formatting State
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "occupancy",
    "adr",
    "revpar",
    "total-revenue",
  ]);
  const [displayTotals, setDisplayTotals] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(true);
  const [showMarketComparisons, setShowMarketComparisons] = useState(false);

  // --- STATE: Modals ---
  const [tableLayout, setTableLayout] = useState("group-by-metric");

  // --- STATE: Modals ---
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showManageSchedules, setShowManageSchedules] = useState(false);

  // --- HOOKS ---
  const { data, loading, error, runReport, clearReport } = useReportData();
  const { schedules, loadSchedules, addSchedule, removeSchedule } =
    useScheduledReports();

  // Refs for auto-running effects
  const isTaxEffectMount = useRef(true);
  const isMetricsEffectMount = useRef(true);

  // --- EFFECTS ---

  // 1. Reset when hotel changes
  useEffect(() => {
    setActiveReportType(null);
    clearReport();
    if (hotelId) {
      loadSchedules(hotelId);
    }
  }, [hotelId, clearReport, loadSchedules]);

  // 2. Date Preset Logic (Auto-calc start/end dates)
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
    const currentDay = today.getUTCDate();
    const currentDayOfWeek = today.getUTCDay() === 0 ? 7 : today.getUTCDay();

    let newStart: Date;
    let newEnd: Date;
    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    switch (datePreset) {
      case "last-week":
        newStart = new Date(
          Date.UTC(
            currentYear,
            currentMonth,
            currentDay - currentDayOfWeek - 6,
          ),
        );
        newEnd = new Date(
          Date.UTC(currentYear, currentMonth, currentDay - currentDayOfWeek),
        );
        break;
      case "current-week":
        newStart = new Date(
          Date.UTC(
            currentYear,
            currentMonth,
            currentDay - currentDayOfWeek + 1,
          ),
        );
        newEnd = new Date(
          Date.UTC(
            currentYear,
            currentMonth,
            currentDay - currentDayOfWeek + 7,
          ),
        );
        break;
      case "current-month":
        newStart = new Date(Date.UTC(currentYear, currentMonth, 1));
        newEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        break;
      case "next-month":
        newStart = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
        newEnd = new Date(Date.UTC(currentYear, currentMonth + 2, 0));
        break;
      case "year-to-date":
        newStart = new Date(Date.UTC(currentYear, 0, 1));
        newEnd = today;
        break;
      case "this-year":
        newStart = new Date(Date.UTC(currentYear, 0, 1));
        newEnd = new Date(Date.UTC(currentYear, 11, 31));
        break;
      case "last-year":
        newStart = new Date(Date.UTC(currentYear - 1, 0, 1));
        newEnd = new Date(Date.UTC(currentYear - 1, 11, 31));
        break;
      default:
        return;
    }
    setStartDate(formatDate(newStart));
    setEndDate(formatDate(newEnd));
  }, [datePreset]);

  // 3. Auto-run report when configuration changes (after initial mount)
  useEffect(() => {
    if (activeReportType === "performance-metrics") {
      if (isTaxEffectMount.current) {
        isTaxEffectMount.current = false;
      } else {
        handleRunReport();
      }
    }
  }, [taxInclusive]);

  useEffect(() => {
    if (activeReportType === "performance-metrics") {
      if (isMetricsEffectMount.current) {
        isMetricsEffectMount.current = false;
      } else {
        handleRunReport();
      }
    }
  }, [selectedMetrics]);

  // --- HANDLERS ---

  const handleRunReport = () => {
    if (!hotelId || !activeReportType) return;

    // [FIX] Pass all the state variables the backend needs
    runReport({
      hotelId,
      reportType: activeReportType,
      startDate,
      endDate,
      // [NEW] These were missing and causing the 400 error
      metrics: selectedMetrics, // Backend needs strict list: ['occupancy', 'adr']
      granularity: granularity, // 'daily', 'weekly', 'monthly'
      includeTaxes: taxInclusive, // boolean
    } as any); // Type cast allows extra props until we update ReportParams interface
  };

  const handleBack = () => {
    setActiveReportType(null);
    clearReport();
  };

  const handleToggleMetric = (metric: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric],
    );
  };
  const downloadCSV = (data: any[], fileName: string) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);

    // 1. Helper to format values consistently with the UI logic
    const formatCsvValue = (fieldName: string, value: any) => {
      const safeValue = Number(value) || 0;
      if (fieldName.toLowerCase().includes("occupancy")) {
        return `${(safeValue * 100).toFixed(1)}%`;
      }
      if (
        fieldName.toLowerCase().includes("adr") ||
        fieldName.toLowerCase().includes("revenue") ||
        fieldName.toLowerCase().includes("revpar")
      ) {
        return safeValue.toFixed(2);
      }
      return value ?? "";
    };

    // 2. Build Data Rows (Standard CSV escaping)
    const dataRows = data.map((row) =>
      headers
        .map((fieldName) => {
          const formatted = formatCsvValue(fieldName, row[fieldName]);
          return `"${("" + formatted).replace(/"/g, '""')}"`;
        })
        .join(","),
    );

    // 3. Calculate Totals Row (Mirroring calculateAggregate from ReportTable.tsx)
    const totalsRow = headers
      .map((fieldName) => {
        if (fieldName === "period") return '"Total / Avg"';

        const sum = data.reduce(
          (acc, row) => acc + (Number(row[fieldName]) || 0),
          0,
        );
        const isVolume =
          fieldName.includes("revenue") ||
          fieldName.includes("rooms-sold") ||
          fieldName.includes("rooms-unsold");

        const finalVal = isVolume ? sum : sum / data.length;
        const formattedTotal = formatCsvValue(fieldName, finalVal);
        return `"${("" + formattedTotal).replace(/"/g, '""')}"`;
      })
      .join(",");

    // 4. Combine: Strictly [Headers] + [Data] + [Totals] with no leading text
    const csvContent = [headers.join(","), ...dataRows, totalsRow].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (format: "csv" | "xlsx") => {
    if (!data || !data.rows || data.rows.length === 0) {
      toast.error("No data available to export. Please run the report first.");
      return;
    }

    if (format === "csv") {
      // 1. Format the report name (e.g., "performance-metrics" -> "Performance Metrics")
      const reportName = activeReportType
        ? activeReportType
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
        : "Report";

      // 2. Property Name Lookup (Uses prop, falls back to hotelId)
      const exportPropName = propertyName || hotelId || "Property";

      // 3. Clean Filename with spaces
      const fileName = `${reportName} ${exportPropName} ${startDate} to ${endDate}`;

      // 4. Trigger Download
      downloadCSV(data.rows, fileName);
      toast.success("CSV Export successful");
    } else {
      toast.info("Excel (.xlsx) export coming soon. Please use CSV for now.");
    }
  };

  // --- RENDER ---

  // 1. Main Menu (Selector)
  if (!activeReportType) {
    return (
      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          backgroundColor: "#1d1d1c",
        }}
      >
        {/* Fixed Full-Screen Background */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(250, 255, 106, 0.01))",
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
        </div>
        <div
          className="p-6"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1500px" }}>
            <ReportSelector
              onSelectReport={setActiveReportType}
              userRole={userRole}
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. Specialized Reports (These manage their own internal state/fetching)
  if (activeReportType === "performance-vs-budget") {
    return (
      <BudgetReport
        startDate={startDate}
        endDate={endDate}
        granularity={granularity}
        propertyId={hotelId}
        currencyCode={currencyCode}
        onBack={handleBack}
      />
    );
  }

  if (activeReportType === "year-on-year") {
    return (
      <YearOnYearReport
        propertyId={hotelId}
        currencyCode={currencyCode}
        onBack={handleBack}
        onExportCSV={() => handleExport("csv")}
        onExportExcel={() => handleExport("xlsx")}
        onCreateSchedule={() => setShowCreateSchedule(true)}
        onManageSchedules={() => setShowManageSchedules(true)}
      />
    );
  }

  if (activeReportType === "shreeji-report") {
    return (
      <ShreejiReport
        scheduledReports={schedules} // We filter these in the hook or API
        isLoadingSchedules={false} // TODO: Hook up loading state
        onSaveSchedule={async (payload) => {
          await addSchedule(payload);
        }}
        onDeleteSchedule={async (id) => {
          await removeSchedule(id, hotelId);
        }}
      />
    );
  }

  if (activeReportType === "portfolio-overview") {
    // Wrapper to provide back button for Portfolio
    return (
      <div className="min-h-screen bg-[#252521]">
        <div className="p-4 border-b border-[#3a3a35] bg-[#2C2C2C]">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="text-[#9ca3af] hover:text-[#faff6a]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Button>
        </div>
        <PortfolioOverview />
      </div>
    );
  }

  if (activeReportType === "monthly-takings") {
    return <MonthlyTakingsReport onBack={handleBack} hotelId={hotelId} />;
  }

  // 3. Generic/Core Reports (Performance Metrics) - Managed by Hub State
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1d1d1c",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: "0",
          background:
            "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))",
        }}
      ></div>
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: "0",
          backgroundImage:
            "linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      ></div>

      <div style={{ position: "relative", zIndex: 10, padding: "24px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div>
            <button
              onClick={handleBack}
              style={{
                background: "none",
                border: "none",
                color: "#6b7280",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "8px",
                padding: "0",
                textTransform: "uppercase",
                letterSpacing: "-0.025em",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#39BDF8")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Report Selection</span>
            </button>
            <div
              style={{
                color: "#e5e5e5",
                fontSize: "18px",
                textTransform: "uppercase",
                letterSpacing: "-0.025em",
                marginBottom: "6px",
              }}
            >
              Performance Metrics Report
            </div>
            <div
              style={{
                color: "#6b7280",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "-0.025em",
              }}
            >
              Comprehensive analysis of occupancy, ADR, RevPAR, and market
              comparisons
            </div>
          </div>

          <ReportActions
            onExportCSV={() => handleExport("csv")}
            onExportExcel={() => handleExport("xlsx")}
            onCreateSchedule={() => setShowCreateSchedule(true)}
            onManageSchedules={() => setShowManageSchedules(true)}
          />
        </div>

        {/* Unified Canvas — single #1A1A1A card */}
        <div
          style={{
            backgroundColor: "rgb(26, 26, 26)",
            borderRadius: "8px",
            border: "1px solid #2a2a2a",
            overflow: "hidden",
            minHeight: "calc(100vh - 160px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Section 1: Report Controls */}
          <div style={{ padding: "20px 24px" }}>
            <RoundedGridReportControls
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              datePreset={datePreset}
              setDatePreset={setDatePreset}
              granularity={granularity}
              setGranularity={setGranularity}
              onRunReport={handleRunReport}
              transparent
            />
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "#2a2a2a" }} />

          {/* Section 2: Metrics + Formatting */}
          <div style={{ padding: "20px 24px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "32px",
              }}
            >
              <MetricSelectorChips
                selectedMetrics={selectedMetrics}
                onToggleMetric={handleToggleMetric}
              />
              <div
                style={{
                  width: "1px",
                  backgroundColor: "#2a2a2a",
                  alignSelf: "stretch",
                }}
              />
              <FormattingOptions
                displayTotals={displayTotals}
                setDisplayTotals={setDisplayTotals}
                taxInclusive={taxInclusive}
                setTaxInclusive={setTaxInclusive}
                showMarketComparisons={showMarketComparisons}
                setShowMarketComparisons={setShowMarketComparisons}
                tableLayout={tableLayout}
                setTableLayout={setTableLayout}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "#2a2a2a" }} />
          {/* Report Table */}
          <div style={{ flex: 1 }}>
            <ReportTable
              startDate={startDate}
              endDate={endDate}
              granularity={granularity}
              selectedMetrics={selectedMetrics}
              displayTotals={displayTotals}
              showMarketComparisons={showMarketComparisons}
              taxInclusive={taxInclusive}
              tableLayout={tableLayout}
              data={data?.rows || []}
              currencySymbol={currencySymbol}
              transparent
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateScheduleModal
        open={showCreateSchedule}
        onClose={() => setShowCreateSchedule(false)}
        onSave={async (payload) => {
          await addSchedule({ ...payload, hotelId });
          setShowCreateSchedule(false);
        }}
      />
      <ManageSchedulesModal
        open={showManageSchedules}
        onClose={() => setShowManageSchedules(false)}
        schedules={schedules}
        onDelete={async (id) => await removeSchedule(id, hotelId)}
      />
    </div>
  );
};
