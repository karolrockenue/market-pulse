import React, { useState, useEffect, useMemo } from "react";
import { R } from "../../../styles/tokens";
import {
  ArrowLeft,
  Loader2,
  Calendar as CalendarIcon,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
  Save,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchTakingsReport } from "../api/reports.api";
import axios from "axios";
import { CreateScheduleModal } from "@/components/CreateScheduleModal";
import { toast } from "sonner";

// --- Types ---

// --- Types ---

interface Hotel {
  hotel_id: string;
  property_name: string;
  pms_property_id: string;
}

interface TakingsData {
  cash: number;
  cards: number;
  bacs: number;
  cardBreakdown: Record<string, number>;
}

interface RevenueData {
  extras: {
    total: number;
    breakdown: Record<string, { amount: number; quantity: number }>;
  };
  totalRevenue: number;
  occupancy: number; // 0-100
  adr: number;
  roomsSold: number;
  capacity: number;
}

interface ReportItem {
  id: string; // hotel_id
  name: string;
  status: "idle" | "loading" | "success" | "error";
  takings?: TakingsData;
  revenue?: RevenueData;
  errorMsg?: string;
}

const currencySymbolMap: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', JPY: '¥', CNY: '¥',
  AUD: 'A$', CAD: 'C$', CHF: 'CHF', INR: '₹', KRW: '₩',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', ZAR: 'R', BRL: 'R$',
  MXN: 'MX$', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', THB: '฿',
  AED: 'د.إ', SAR: '﷼', PLN: 'zł', CZK: 'Kč', HUF: 'Ft',
};

interface MonthlyTakingsReportProps {
  onBack: () => void;
  currencyCode?: string;
}

export const MonthlyTakingsReport: React.FC<MonthlyTakingsReportProps> = ({
  onBack,
  currencyCode = 'GBP',
}) => {
  // --- Selection State ---
  const [availableHotels, setAvailableHotels] = useState<Hotel[]>([]);
  const [selectedHotelIds, setSelectedHotelIds] = useState<string[]>([]);
  const [isSelectionOpen, setIsSelectionOpen] = useState(true);

  // --- Report State ---
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // [NEW] Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Date State
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // --- Schedule Handler ---
  const handleSaveSchedule = async (scheduleData: any) => {
    try {
      // [FIX] Force Integer type for DB compatibility
      const primaryHotelId =
        selectedHotelIds.length > 0 ? parseInt(selectedHotelIds[0], 10) : null;

      if (!primaryHotelId || isNaN(primaryHotelId)) {
        toast.error("Please select at least one hotel first.");
        return;
      }

      const payload = {
        ...scheduleData,
        // [FIX] Map the Modal's 'emailRecipients' to the API's expected 'recipients'
        recipients: scheduleData.emailRecipients,
        propertyId: primaryHotelId,
        reportType: "takings_audit",
        metricsHotel: selectedHotelIds,
        metricsMarket: [],
        addComparisons: false,
        displayOrder: "default",
        displayTotals: true,
        includeTaxes: true,
      };

      await axios.post("/api/metrics/reports/scheduled", payload);
      toast.success("Multi-hotel report scheduled successfully");
      setIsScheduleModalOpen(false);
    } catch (error: any) {
      console.error("Failed to save schedule", error);
      toast.error(
        `Failed to save: ${error.response?.data?.error || "Server Error"}`
      );
    }
  };

  // --- 1. Fetch Available Hotels ---
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        // Admins see the full fleet via /api/hotels (admin-only). Non-admin
        // owners (e.g. property owners running their own takings audit) get
        // 403 there and need /api/hotels/mine, which is scoped to the
        // user's user_properties rows. Without this fallback, owners saw
        // an empty hotel selector. Mirrors the SentinelHub fix in
        // blueprint §4.8b.
        let res;
        try {
          res = await axios.get("/api/hotels");
        } catch (err: any) {
          if (err?.response?.status === 403) {
            res = await axios.get("/api/hotels/mine");
          } else {
            throw err;
          }
        }
        const rows = Array.isArray(res.data) ? res.data : [];
        const list = rows.map((h: any) => ({
          hotel_id: h.id || h.hotel_id || h.property_id,
          property_name: h.property_name || h.name || "Unknown Hotel",
          pms_property_id: h.pms_property_id,
        }));
        setAvailableHotels(list);
      } catch (err) {
        console.error("Failed to fetch hotels", err);
        setAvailableHotels([]);
      }
    };
    fetchHotels();
  }, []);

  // --- 2. Selection Logic ---
  const toggleHotel = (id: string) => {
    setSelectedHotelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedHotelIds.length === availableHotels.length) {
      setSelectedHotelIds([]);
    } else {
      setSelectedHotelIds(availableHotels.map((h) => h.hotel_id));
    }
  };

  // --- 3. Multi-Hotel Fetch Loop ---
  const loadData = async () => {
    if (selectedHotelIds.length === 0) return;

    setLoading(true);
    setData([]);
    setIsSelectionOpen(false); // Close selection panel
    setProgress({ current: 0, total: selectedHotelIds.length });

    const results: any[] = [];

    for (let i = 0; i < selectedHotelIds.length; i++) {
      const targetId = selectedHotelIds[i];
      try {
        const result = await fetchTakingsReport(startDate, endDate, targetId);
        // Normalize result (some APIs return array, some object)
        const items = Array.isArray(result) ? result : [result];
        results.push(...items);
      } catch (error) {
        console.error(`Failed to load for ${targetId}`, error);
      }

      // Update Progress & Live Data
      setProgress({ current: i + 1, total: selectedHotelIds.length });
      setData([...results]);
    }

    setLoading(false);
  };

  // Calculate totals
  const totals = data.reduce(
    (acc, hotel) => ({
      cash: acc.cash + (hotel.takings?.cash || 0),
      creditCards: acc.creditCards + (hotel.takings?.cards || 0), // Note: API returns 'cards'
      bacs: acc.bacs + (hotel.takings?.bacs || 0),
      extras: acc.extras + (hotel.revenue?.extras?.total || 0), // [FIX] Handle object structure
      totalRevenue: acc.totalRevenue + (hotel.revenue?.totalRevenue || 0),
    }),
    {
      cash: 0,
      creditCards: 0,
      bacs: 0,
      extras: 0,
      totalRevenue: 0,
    }
  );

  const symbol = currencySymbolMap[currencyCode.toUpperCase()] || currencyCode;

  const formatCurrency = (value: number) => {
    return `${symbol}${value.toLocaleString("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  };

  return (
    <div
      style={{
        flex: 1,
        background: R.bg,
        color: R.accent,
        padding: "24px 28px",
      }}
    >
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-[#7A8494] hover:text-[#F3F5F7] pl-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>

            {/* Toggle Filter Panel */}
            <Button
              variant="outline"
              onClick={() => setIsSelectionOpen(!isSelectionOpen)}
              className="border-[#1E2330] text-[#7A8494] hover:text-white hover:bg-[#1E2330]"
            >
              <Filter className="w-4 h-4 mr-2" />
              {isSelectionOpen ? "Hide Selector" : "Select Hotels"}
            </Button>
          </div>

          {/* NEW: Hotel Selection Grid */}
          {isSelectionOpen && (
            <div className="mb-6 p-4 bg-[#111519] border border-[#1E2330] rounded-lg">
              <div className="flex items-center justify-between mb-3 border-b border-[#1E2330] pb-2">
                <span className="text-sm font-medium text-gray-400">
                  Select Hotels for Group Audit
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="text-xs text-[#38C6BA] hover:text-[#F3F5F7] hover:bg-[#1E2330]"
                >
                  {selectedHotelIds.length === availableHotels.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableHotels.map((h) => {
                  const isSelected = selectedHotelIds.includes(h.hotel_id);
                  return (
                    <div
                      key={h.hotel_id}
                      onClick={() => toggleHotel(h.hotel_id)}
                      className={`
                        cursor-pointer flex items-center p-2 rounded border text-sm transition-colors select-none
                        ${
                          isSelected
                            ? "bg-[#38C6BA]/10 border-[#38C6BA] text-white"
                            : "bg-[#121519] border-[#1E2330] text-gray-500 hover:border-[#1E2330]"
                        }
                      `}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 mr-2 text-[#38C6BA]" />
                      ) : (
                        <Square className="w-4 h-4 mr-2" />
                      )}
                      <span className="truncate" title={h.property_name}>
                        {h.property_name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h1
                style={{
                  color: R.accent,
                  fontSize: "24px",
                  fontWeight: "600",
                  marginBottom: "8px",
                  letterSpacing: "-0.025em",
                }}
              >
                Monthly Takings
              </h1>
              <p
                style={{
                  color: R.textMid,
                  fontSize: "14px",
                }}
              >
                Financial performance (Cash Basis) vs Revenue (Accrual Basis)
              </p>
            </div>
            {/* Date Controls */}
            <div className="flex items-center gap-3">
              {/* [NEW] Schedule Button */}
              <Button
                variant="outline"
                onClick={() => setIsScheduleModalOpen(true)}
                disabled={selectedHotelIds.length === 0}
                className="bg-[#1C2228] border-[#1E2330] text-[#F3F5F7] hover:bg-[#1C2228] h-10"
              >
                <Clock className="w-4 h-4 mr-2" />
                Schedule Report
              </Button>

              <div className="flex items-center gap-4 bg-[#121519] p-2 rounded-lg border border-[#1E2330]">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-9"
                      style={{
                        backgroundColor: R.sidebar,
                        border: `1px solid ${R.border}`,
                        color: R.accent,
                        fontSize: "13px",
                      }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(new Date(startDate), "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" style={{ backgroundColor: "#1a1a18", border: `1px solid ${R.border}` }}>
                    <Calendar mode="single" selected={startDate ? new Date(startDate) : undefined} onSelect={(d) => d && setStartDate(format(d, "yyyy-MM-dd"))} initialFocus />
                  </PopoverContent>
                </Popover>
                <span style={{ color: R.textDim }}>to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-9"
                      style={{
                        backgroundColor: R.sidebar,
                        border: `1px solid ${R.border}`,
                        color: R.accent,
                        fontSize: "13px",
                      }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(new Date(endDate), "dd MMM yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" style={{ backgroundColor: "#1a1a18", border: `1px solid ${R.border}` }}>
                    <Calendar mode="single" selected={endDate ? new Date(endDate) : undefined} onSelect={(d) => d && setEndDate(format(d, "yyyy-MM-dd"))} initialFocus />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={loadData}
                  size="sm"
                  style={{
                    background: "#38C6BA",
                    color: "black",
                    fontWeight: "bold",
                    marginLeft: "8px",
                  }}
                >
                  Run Report
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* [NEW] Schedule Modal */}
        <CreateScheduleModal
          open={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSave={handleSaveSchedule}
          variant="takings" // [NEW] Activates specialized UI
        />

        {/* Main Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64 border border-[#1E2330] rounded-lg bg-[#121519]">
            <Loader2 className="w-8 h-8 text-[#38C6BA] animate-spin" />
          </div>
        ) : (
          <div
            style={{
              background: R.darkBand,
              border: `1px solid ${R.border}`,
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: R.sidebar,
                    borderBottom: `1px solid ${R.border}`,
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "16px",
                      color: R.textMid,
                      fontSize: "11px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Hotel Name
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: R.textMid,
                      fontSize: "11px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Takings (Cash Basis)
                  </th>
                  <th
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: R.textMid,
                      fontSize: "11px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Revenue (Accrual Basis)
                  </th>
                </tr>
                <tr
                  style={{
                    background: R.sidebar,
                    borderBottom: `1px solid ${R.border}`,
                  }}
                >
                  <th
                    style={{
                      padding: "12px 16px",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  ></th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Cash
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Credit Cards
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    BACS
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Extras
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                      borderLeft: "2px solid #444",
                    }}
                  >
                    Occ %
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    ADR
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: R.textDim,
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Revpar
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#38C6BA",
                      fontSize: "10px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Total Revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((hotel, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: `1px solid ${R.border}`,
                      background: index % 2 === 0 ? R.darkBand : R.heroBg,
                    }}
                  >
                    <td
                      style={{
                        padding: "16px",
                        color: R.accent,
                        fontSize: "14px",
                        fontWeight: "500",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {hotel.name}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {formatCurrency(hotel.takings?.cash || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {formatCurrency(hotel.takings?.cards || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {formatCurrency(hotel.takings?.bacs || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {formatCurrency(hotel.revenue?.extras?.total || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                        borderLeft: "2px solid #444",
                      }}
                    >
                      {formatPercent(hotel.revenue?.occupancy || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {formatCurrency(hotel.revenue?.adr || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: `1px solid ${R.border}`,
                      }}
                    >
                      {formatCurrency(hotel.revenue?.revpar || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: R.accent,
                        fontSize: "14px",
                        fontWeight: "600",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {formatCurrency(hotel.revenue?.totalRevenue || 0)}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr
                  style={{
                    background: R.sidebar,
                    borderTop: "2px solid #3a3a3a",
                  }}
                >
                  <td
                    style={{
                      padding: "16px",
                      color: R.textMid,
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    {formatCurrency(totals.cash)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    {formatCurrency(totals.creditCards)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    {formatCurrency(totals.bacs)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    {formatCurrency(totals.extras)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                      borderLeft: "2px solid #444",
                    }}
                  >
                    {formatPercent(totals.avgOcc || 0)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    {formatCurrency(totals.avgAdr || 0)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: R.accent,
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: `1px solid ${R.border}`,
                    }}
                  >
                    {formatCurrency(totals.avgRevpar || 0)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: "#38C6BA",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {formatCurrency(totals.totalRevenue)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* [NEW] Detailed Breakdown Section */}
        {!loading &&
          data.map((hotel) => (
            // [FIX] Use 'hotelId' (camelCase) which matches the API response
            <div key={hotel.hotelId} style={{ marginTop: "48px" }}>
              <h2
                style={{
                  color: R.accent,
                  fontSize: "18px",
                  marginBottom: "16px",
                  borderBottom: "1px solid #333",
                  paddingBottom: "8px",
                }}
              >
                {hotel.name} - Detailed Audit
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 2fr",
                  gap: "24px",
                }}
              >
                {/* 1. Payment Method Summary */}
                <div
                  style={{
                    background: R.darkBand,
                    padding: "16px",
                    borderRadius: "8px",
                    border: `1px solid ${R.border}`,
                    height: "fit-content",
                  }}
                >
                  <h3
                    style={{
                      color: R.textMid,
                      fontSize: "12px",
                      textTransform: "uppercase",
                      marginBottom: "12px",
                    }}
                  >
                    Payment Methods
                  </h3>
                  <table style={{ width: "100%" }}>
                    <tbody>
                      {Object.entries(hotel.takings?.cardBreakdown || {}).map(
                        ([method, amount]: [string, any]) => (
                          <tr
                            key={method}
                            style={{ borderBottom: `1px solid ${R.border}` }}
                          >
                            <td
                              style={{
                                padding: "8px 0",
                                color: R.accent,
                                fontSize: "13px",
                              }}
                            >
                              {method}
                            </td>
                            <td
                              style={{
                                padding: "8px 0",
                                textAlign: "right",
                                color: R.accent,
                                fontFamily: "monospace",
                              }}
                            >
                              {formatCurrency(amount)}
                            </td>
                          </tr>
                        )
                      )}
                      {/* Add Cash/BACS manually if not in breakdown */}
                      {hotel.takings?.cash > 0 && (
                        <tr style={{ borderBottom: `1px solid ${R.border}` }}>
                          <td
                            style={{
                              padding: "8px 0",
                              color: R.accent,
                              fontSize: "13px",
                            }}
                          >
                            Cash
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              textAlign: "right",
                              color: R.accent,
                              fontFamily: "monospace",
                            }}
                          >
                            {formatCurrency(hotel.takings.cash)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Extras Breakdown (NEW) */}
                <div
                  style={{
                    background: R.darkBand,
                    padding: "16px",
                    borderRadius: "8px",
                    border: `1px solid ${R.border}`,
                    height: "fit-content",
                  }}
                >
                  <h3
                    style={{
                      color: R.textMid,
                      fontSize: "12px",
                      textTransform: "uppercase",
                      marginBottom: "12px",
                    }}
                  >
                    Extras Breakdown
                  </h3>
                  <table style={{ width: "100%" }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid #333",
                          textAlign: "left",
                        }}
                      >
                        <th
                          style={{
                            padding: "8px 0",
                            color: R.textDim,
                            fontSize: "10px",
                          }}
                        >
                          Item
                        </th>
                        <th
                          style={{
                            padding: "8px 0",
                            color: R.textDim,
                            fontSize: "10px",
                            textAlign: "center",
                          }}
                        >
                          Qty
                        </th>
                        <th
                          style={{
                            padding: "8px 0",
                            color: R.textDim,
                            fontSize: "10px",
                            textAlign: "right",
                          }}
                        >
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(
                        hotel.revenue?.extras?.breakdown || {}
                      ).map(([item, data]: [string, any]) => (
                        <tr
                          key={item}
                          style={{ borderBottom: `1px solid ${R.border}` }}
                        >
                          <td
                            style={{
                              padding: "8px 0",
                              color: R.accent,
                              fontSize: "13px",
                            }}
                          >
                            {item}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              textAlign: "center",
                              color: R.textMid,
                              fontSize: "13px",
                            }}
                          >
                            {data.quantity}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              textAlign: "right",
                              color: R.accent,
                              fontFamily: "monospace",
                            }}
                          >
                            {formatCurrency(data.amount)}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(hotel.revenue?.extras?.breakdown || {})
                        .length === 0 && (
                        <tr>
                          <td
                            colSpan={3}
                            style={{
                              color: R.textDim,
                              fontSize: "12px",
                              padding: "8px 0",
                            }}
                          >
                            No extras found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
