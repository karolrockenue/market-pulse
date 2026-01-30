import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
  Save,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface MonthlyTakingsReportProps {
  onBack: () => void;
}

export const MonthlyTakingsReport: React.FC<MonthlyTakingsReportProps> = ({
  onBack,
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
        const res = await axios.get("/api/hotels");
        // Robust mapping to handle variations in API response
        const list = res.data.map((h: any) => ({
          hotel_id: h.id || h.hotel_id,
          property_name: h.property_name || h.name || "Unknown Hotel",
          pms_property_id: h.pms_property_id,
        }));
        setAvailableHotels(list);
      } catch (err) {
        console.error("Failed to fetch hotels", err);
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

  const formatCurrency = (value: number) => {
    return `£${value.toLocaleString("en-GB", {
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
        minHeight: "100vh",
        background: "#1D1D1C",
        padding: "24px",
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
              className="text-[#9ca3af] hover:text-[#faff6a] pl-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>

            {/* Toggle Filter Panel */}
            <Button
              variant="outline"
              onClick={() => setIsSelectionOpen(!isSelectionOpen)}
              className="border-[#2a2a2a] text-[#9ca3af] hover:text-white hover:bg-[#2a2a2a]"
            >
              <Filter className="w-4 h-4 mr-2" />
              {isSelectionOpen ? "Hide Selector" : "Select Hotels"}
            </Button>
          </div>

          {/* NEW: Hotel Selection Grid */}
          {isSelectionOpen && (
            <div className="mb-6 p-4 bg-[#151515] border border-[#2a2a2a] rounded-lg">
              <div className="flex items-center justify-between mb-3 border-b border-[#2a2a2a] pb-2">
                <span className="text-sm font-medium text-gray-400">
                  Select Hotels for Group Audit
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="text-xs text-[#faff6a] hover:text-[#faff6a] hover:bg-[#2a2a2a]"
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
                            ? "bg-[#faff6a]/10 border-[#faff6a] text-white"
                            : "bg-[#1A1A1A] border-[#2a2a2a] text-gray-500 hover:border-gray-500"
                        }
                      `}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 mr-2 text-[#faff6a]" />
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
                  color: "#e5e5e5",
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
                  color: "#9ca3af",
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
                className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-10"
              >
                <Clock className="w-4 h-4 mr-2" />
                Schedule Report
              </Button>

              <div className="flex items-center gap-4 bg-[#1A1A1A] p-2 rounded-lg border border-[#2a2a2a]">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    background: "transparent",
                    color: "white",
                    border: "none",
                    outline: "none",
                    fontSize: "13px",
                  }}
                />
                <span style={{ color: "#6b7280" }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    background: "transparent",
                    color: "white",
                    border: "none",
                    outline: "none",
                    fontSize: "13px",
                  }}
                />
                <Button
                  onClick={loadData}
                  size="sm"
                  style={{
                    background: "#faff6a",
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
          <div className="flex items-center justify-center h-64 border border-[#2a2a2a] rounded-lg bg-[#1A1A1A]">
            <Loader2 className="w-8 h-8 text-[#faff6a] animate-spin" />
          </div>
        ) : (
          <div
            style={{
              background: "#1A1A1A",
              border: "1px solid #2a2a2a",
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
                    background: "#0a0a0a",
                    borderBottom: "1px solid #2a2a2a",
                  }}
                >
                  <th
                    style={{
                      textAlign: "left",
                      padding: "16px",
                      color: "#9ca3af",
                      fontSize: "11px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Hotel Name
                  </th>
                  <th
                    colSpan={3}
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: "#9ca3af",
                      fontSize: "11px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Takings (Cash Basis)
                  </th>
                  <th
                    colSpan={4}
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: "#9ca3af",
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
                    background: "#0a0a0a",
                    borderBottom: "1px solid #2a2a2a",
                  }}
                >
                  <th
                    style={{
                      padding: "12px 16px",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  ></th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Cash
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Credit Cards
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    BACS
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Extras
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                      borderLeft: "2px solid #444",
                    }}
                  >
                    Occ %
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    ADR
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#6b7280",
                      fontSize: "10px",
                      fontWeight: "500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Revpar
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 16px",
                      color: "#faff6a",
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
                      borderBottom: "1px solid #2a2a2a",
                      background: index % 2 === 0 ? "#1A1A1A" : "#151515",
                    }}
                  >
                    <td
                      style={{
                        padding: "16px",
                        color: "#e5e5e5",
                        fontSize: "14px",
                        fontWeight: "500",
                        borderRight: "1px solid #2a2a2a",
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
                        borderRight: "1px solid #2a2a2a",
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
                        borderRight: "1px solid #2a2a2a",
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
                        borderRight: "1px solid #2a2a2a",
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
                        borderRight: "1px solid #2a2a2a",
                      }}
                    >
                      {formatCurrency(hotel.revenue?.extras?.total || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#e5e5e5",
                        fontSize: "14px",
                        fontWeight: "600",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: "1px solid #2a2a2a",
                      }}
                    >
                      {formatCurrency(hotel.revenue?.totalRevenue || 0)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "16px",
                        color: "#d1d5db",
                        fontSize: "13px",
                        fontFamily: "ui-monospace, monospace",
                        borderRight: "1px solid #2a2a2a",
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
                      }}
                    >
                      {formatCurrency(hotel.revenue?.adr || 0)}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr
                  style={{
                    background: "#0a0a0a",
                    borderTop: "2px solid #3a3a3a",
                  }}
                >
                  <td
                    style={{
                      padding: "16px",
                      color: "#9ca3af",
                      fontSize: "12px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: "#e5e5e5",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    {formatCurrency(totals.cash)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: "#e5e5e5",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    {formatCurrency(totals.creditCards)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: "#e5e5e5",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    {formatCurrency(totals.bacs)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: "#e5e5e5",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    {formatCurrency(totals.extras)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "16px",
                      color: "#faff6a",
                      fontSize: "14px",
                      fontWeight: "600",
                      fontFamily: "ui-monospace, monospace",
                      borderRight: "1px solid #2a2a2a",
                    }}
                  >
                    {formatCurrency(totals.totalRevenue)}
                  </td>
                  <td
                    colSpan={2}
                    style={{
                      textAlign: "center",
                      padding: "16px",
                      color: "#6b7280",
                      fontSize: "11px",
                      fontStyle: "italic",
                    }}
                  >
                    —
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
                  color: "#e5e5e5",
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
                    background: "#1A1A1A",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #2a2a2a",
                    height: "fit-content",
                  }}
                >
                  <h3
                    style={{
                      color: "#9ca3af",
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
                            style={{ borderBottom: "1px solid #2a2a2a" }}
                          >
                            <td
                              style={{
                                padding: "8px 0",
                                color: "#e5e5e5",
                                fontSize: "13px",
                              }}
                            >
                              {method}
                            </td>
                            <td
                              style={{
                                padding: "8px 0",
                                textAlign: "right",
                                color: "#e5e5e5",
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
                        <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                          <td
                            style={{
                              padding: "8px 0",
                              color: "#e5e5e5",
                              fontSize: "13px",
                            }}
                          >
                            Cash
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              textAlign: "right",
                              color: "#e5e5e5",
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
                    background: "#1A1A1A",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid #2a2a2a",
                    height: "fit-content",
                  }}
                >
                  <h3
                    style={{
                      color: "#9ca3af",
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
                            color: "#6b7280",
                            fontSize: "10px",
                          }}
                        >
                          Item
                        </th>
                        <th
                          style={{
                            padding: "8px 0",
                            color: "#6b7280",
                            fontSize: "10px",
                            textAlign: "center",
                          }}
                        >
                          Qty
                        </th>
                        <th
                          style={{
                            padding: "8px 0",
                            color: "#6b7280",
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
                          style={{ borderBottom: "1px solid #2a2a2a" }}
                        >
                          <td
                            style={{
                              padding: "8px 0",
                              color: "#e5e5e5",
                              fontSize: "13px",
                            }}
                          >
                            {item}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              textAlign: "center",
                              color: "#9ca3af",
                              fontSize: "13px",
                            }}
                          >
                            {data.quantity}
                          </td>
                          <td
                            style={{
                              padding: "8px 0",
                              textAlign: "right",
                              color: "#e5e5e5",
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
                              color: "#6b7280",
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
