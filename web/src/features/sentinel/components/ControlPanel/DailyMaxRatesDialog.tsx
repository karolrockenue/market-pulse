import { useState, useEffect } from "react";
import { Calendar, Copy, Zap, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DailyMaxRatesDialogProps {
  propertyName: string;
  propertyId: string;
  trigger?: React.ReactNode;
  initialRates?: Record<string, string>; // [NEW] Read from DB
  onSave?: (rates: Record<string, string>) => void; // [NEW] Write to DB
  sourceHotels?: { id: string; name: string }[]; // [NEW] List of hotels to copy from
  onFetchRates?: (hotelId: string) => Promise<Record<string, string>>; // [NEW] Fetcher
}

export function DailyMaxRatesDialog({
  propertyName,
  propertyId,
  trigger,
  initialRates = {},
  onSave,
  sourceHotels = [],
  onFetchRates,
}: DailyMaxRatesDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rates, setRates] = useState<Record<string, string>>(initialRates);

  // Sync state when initialRates loads from DB
  useEffect(() => {
    // [FIX] Only update if the content actually changes to avoid resetting local work
    // or entering infinite loops if the parent passes a new object reference.
    if (JSON.stringify(initialRates) !== JSON.stringify(rates)) {
      setRates(initialRates);
    }
  }, [initialRates]);

  // UI States
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importId, setImportId] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const handleImportRates = async () => {
    if (!importId || !onFetchRates) return;
    setIsImporting(true);
    try {
      const fetchedRates = await onFetchRates(importId);
      if (fetchedRates && Object.keys(fetchedRates).length > 0) {
        setRates(fetchedRates); // Replace current rates with imported ones
        setShowImport(false);
      }
    } catch (error) {
      console.error("Failed to import rates", error);
    } finally {
      setIsImporting(false);
    }
  };

  // Bulk update state
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [bulkRate, setBulkRate] = useState("");

  const daysOfWeek = [
    { id: 1, name: "Monday", short: "Mon" },
    { id: 2, name: "Tuesday", short: "Tue" },
    { id: 3, name: "Wednesday", short: "Wed" },
    { id: 4, name: "Thursday", short: "Thu" },
    { id: 5, name: "Friday", short: "Fri" },
    { id: 6, name: "Saturday", short: "Sat" },
    { id: 0, name: "Sunday", short: "Sun" },
  ];

  const months = [
    { name: "January", short: "Jan", days: 31 },
    { name: "February", short: "Feb", days: 28 },
    { name: "March", short: "Mar", days: 31 },
    { name: "April", short: "Apr", days: 30 },
    { name: "May", short: "May", days: 31 },
    { name: "June", short: "Jun", days: 30 },
    { name: "July", short: "Jul", days: 31 },
    { name: "August", short: "Aug", days: 31 },
    { name: "September", short: "Sep", days: 30 },
    { name: "October", short: "Oct", days: 31 },
    { name: "November", short: "Nov", days: 30 },
    { name: "December", short: "Dec", days: 31 },
  ];

  const getDaysInMonth = (monthId: number) => {
    const daysCount = months[monthId].days;
    const days = [];
    for (let i = 1; i <= daysCount; i++) {
      days.push(i);
    }
    return days;
  };

  const getDayOfWeek = (year: number, monthId: number, day: number) => {
    const date = new Date(year, monthId, day);
    return date.getDay();
  };

  const handleBulkSet = (monthId: number, value: string) => {
    const days = getDaysInMonth(monthId);
    const newRates: Record<string, string> = {};
    days.forEach((day) => {
      newRates[`${monthId}-${day}`] = value;
    });
    setRates((prev) => ({ ...prev, ...newRates }));
  };

  const handleAdvancedBulkUpdate = () => {
    if (!bulkRate || selectedDays.length === 0 || selectedMonths.length === 0) {
      return;
    }

    const newRates: Record<string, string> = {};
    const year = 2025;

    selectedMonths.forEach((monthId) => {
      const days = getDaysInMonth(monthId);
      days.forEach((day) => {
        const dayOfWeek = getDayOfWeek(year, monthId, day);
        if (selectedDays.includes(dayOfWeek)) {
          newRates[`${monthId}-${day}`] = bulkRate;
        }
      });
    });

    setRates((prev) => ({ ...prev, ...newRates }));

    // Reset bulk update form
    setBulkRate("");
    setSelectedDays([]);
    setSelectedMonths([]);
    setShowBulkUpdate(false);
  };

  const toggleDay = (dayId: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const toggleMonth = (monthId: number) => {
    setSelectedMonths((prev) =>
      prev.includes(monthId)
        ? prev.filter((m) => m !== monthId)
        : [...prev, monthId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button
            style={{
              backgroundColor: "rgba(26, 26, 26, 0.5)",
              border: "1px solid rgba(42, 42, 42, 0.5)",
              color: "#9ca3af",
              height: "32px",
              fontSize: "12px",
              padding: "0 12px",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1a1a1a";
              e.currentTarget.style.borderColor = "rgba(57, 189, 248, 0.3)";
              e.currentTarget.style.color = "#39BDF8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(26, 26, 26, 0.5)";
              e.currentTarget.style.borderColor = "rgba(42, 42, 42, 0.5)";
              e.currentTarget.style.color = "#9ca3af";
            }}
          >
            <Calendar style={{ width: "12px", height: "12px" }} />
            Daily Max Rates
          </button>
        )}
      </DialogTrigger>
      <DialogContent
        style={{
          backgroundColor: "#1a1a1a",
          border: "1px solid rgba(42, 42, 42, 0.5)",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DialogHeader style={{ flexShrink: 0, paddingBottom: "16px" }}>
          <DialogTitle
            style={{
              color: "#e5e5e5",
              fontSize: "20px",
              letterSpacing: "-0.025em",
            }}
          >
            Daily Maximum Rates - {propertyName}
          </DialogTitle>
          <DialogDescription style={{ color: "#6b7280", fontSize: "12px" }}>
            Configure daily maximum rate overrides for all 365 days of the year.
          </DialogDescription>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "8px",
            }}
          >
            <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>
              Property ID: {propertyId}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  setShowImport(!showImport);
                  setShowBulkUpdate(false);
                }}
                disabled={!onFetchRates || sourceHotels.length === 0}
                style={{
                  fontSize: "12px",
                  height: "28px",
                  padding: "0 12px",
                  borderRadius: "6px",
                  border: showImport
                    ? "1px solid rgba(16, 185, 129, 0.2)"
                    : "1px solid transparent",
                  backgroundColor: showImport
                    ? "rgba(16, 185, 129, 0.05)"
                    : "transparent",
                  color: showImport ? "#10b981" : "#6b7280",
                  cursor:
                    !onFetchRates || sourceHotels.length === 0
                      ? "not-allowed"
                      : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                  opacity: !onFetchRates || sourceHotels.length === 0 ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!showImport && onFetchRates && sourceHotels.length > 0) {
                    e.currentTarget.style.color = "#10b981";
                    e.currentTarget.style.backgroundColor =
                      "rgba(16, 185, 129, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showImport) {
                    e.currentTarget.style.color = "#6b7280";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <Download style={{ width: "12px", height: "12px" }} />
                Import
              </button>
              <button
                onClick={() => {
                  setShowBulkUpdate(!showBulkUpdate);
                  setShowImport(false);
                }}
                style={{
                  fontSize: "12px",
                  height: "28px",
                  padding: "0 12px",
                  borderRadius: "6px",
                  border: showBulkUpdate
                    ? "1px solid rgba(57, 189, 248, 0.2)"
                    : "1px solid transparent",
                  backgroundColor: showBulkUpdate
                    ? "rgba(57, 189, 248, 0.05)"
                    : "transparent",
                  color: showBulkUpdate ? "#39BDF8" : "#6b7280",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!showBulkUpdate) {
                    e.currentTarget.style.color = "#39BDF8";
                    e.currentTarget.style.backgroundColor =
                      "rgba(57, 189, 248, 0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showBulkUpdate) {
                    e.currentTarget.style.color = "#6b7280";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <Zap style={{ width: "12px", height: "12px" }} />
                Bulk Update
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Import Panel */}
        {showImport && (
          <div
            style={{
              backgroundColor: "#141414",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              borderRadius: "8px",
              padding: "20px",
              flexShrink: 0,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                color: "#10b981",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: "600",
                marginBottom: "16px",
              }}
            >
              Import Max Rates
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                    fontWeight: "500",
                  }}
                >
                  Source Property
                </div>
                <select
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "#0f0f0f",
                    border: "1px solid #2a2a2a",
                    color: "#e5e5e5",
                    fontSize: "14px",
                    height: "32px",
                    padding: "0 8px",
                    borderRadius: "6px",
                    outline: "none",
                    appearance: "none",
                  }}
                >
                  <option value="">Select a hotel...</option>
                  {sourceHotels
                    .filter((h) => h.id !== propertyId)
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={handleImportRates}
                disabled={!importId || isImporting}
                style={{
                  backgroundColor: "#10b981",
                  color: "#0f0f0f",
                  height: "32px",
                  padding: "0 16px",
                  fontSize: "12px",
                  fontWeight: "500",
                  borderRadius: "6px",
                  border: "none",
                  cursor: !importId || isImporting ? "not-allowed" : "pointer",
                  opacity: !importId || isImporting ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                  minWidth: "100px",
                  justifyContent: "center",
                }}
              >
                {isImporting ? (
                  <Loader2
                    style={{
                      width: "12px",
                      height: "12px",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                ) : (
                  <Download style={{ width: "12px", height: "12px" }} />
                )}
                {isImporting ? "Loading..." : "Import"}
              </button>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                marginTop: "12px",
                fontStyle: "italic",
              }}
            >
              Note: This will replace all current daily max rates with the
              values from the selected property.
            </div>
          </div>
        )}

        {/* Advanced Bulk Update Panel */}
        {showBulkUpdate && (
          <div
            style={{
              backgroundColor: "#141414",
              border: "1px solid rgba(57, 189, 248, 0.2)",
              borderRadius: "8px",
              padding: "20px",
              flexShrink: 0,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                color: "#39BDF8",
                fontSize: "12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: "600",
                marginBottom: "16px",
              }}
            >
              Bulk Update
            </div>

            {/* Day of Week Selection */}
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Days of Week
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {daysOfWeek.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => toggleDay(day.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "500",
                      border: selectedDays.includes(day.id)
                        ? "1px solid rgba(57, 189, 248, 0.4)"
                        : "1px solid #2a2a2a",
                      backgroundColor: selectedDays.includes(day.id)
                        ? "rgba(57, 189, 248, 0.2)"
                        : "#1a1a1a",
                      color: selectedDays.includes(day.id)
                        ? "#39BDF8"
                        : "#6b7280",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: selectedDays.includes(day.id)
                        ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedDays.includes(day.id)) {
                        e.currentTarget.style.borderColor =
                          "rgba(57, 189, 248, 0.3)";
                        e.currentTarget.style.color = "#9ca3af";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedDays.includes(day.id)) {
                        e.currentTarget.style.borderColor = "#2a2a2a";
                        e.currentTarget.style.color = "#6b7280";
                      }
                    }}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Selection */}
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                  fontWeight: "500",
                }}
              >
                Months
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {months.map((month, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleMonth(idx)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "500",
                      border: selectedMonths.includes(idx)
                        ? "1px solid rgba(57, 189, 248, 0.4)"
                        : "1px solid #2a2a2a",
                      backgroundColor: selectedMonths.includes(idx)
                        ? "rgba(57, 189, 248, 0.2)"
                        : "#1a1a1a",
                      color: selectedMonths.includes(idx)
                        ? "#39BDF8"
                        : "#6b7280",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      boxShadow: selectedMonths.includes(idx)
                        ? "0 1px 2px rgba(0, 0, 0, 0.05)"
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedMonths.includes(idx)) {
                        e.currentTarget.style.borderColor =
                          "rgba(57, 189, 248, 0.3)";
                        e.currentTarget.style.color = "#9ca3af";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedMonths.includes(idx)) {
                        e.currentTarget.style.borderColor = "#2a2a2a";
                        e.currentTarget.style.color = "#6b7280";
                      }
                    }}
                  >
                    {month.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Rate Input and Apply */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "12px",
                paddingTop: "4px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "#9ca3af",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "8px",
                    fontWeight: "500",
                  }}
                >
                  Rate to Apply
                </div>
                <input
                  type="number"
                  value={bulkRate}
                  onChange={(e) => setBulkRate(e.target.value)}
                  placeholder="400"
                  style={{
                    width: "100%",
                    backgroundColor: "#0f0f0f",
                    border: "1px solid #2a2a2a",
                    color: "#e5e5e5",
                    fontSize: "14px",
                    height: "32px",
                    padding: "0 12px",
                    borderRadius: "6px",
                    outline: "none",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      "rgba(57, 189, 248, 0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#2a2a2a")
                  }
                />
              </div>
              <button
                onClick={handleAdvancedBulkUpdate}
                disabled={
                  !bulkRate ||
                  selectedDays.length === 0 ||
                  selectedMonths.length === 0
                }
                style={{
                  backgroundColor: "#39BDF8",
                  color: "#0f0f0f",
                  height: "32px",
                  padding: "0 16px",
                  fontSize: "12px",
                  fontWeight: "500",
                  borderRadius: "6px",
                  border: "none",
                  cursor:
                    !bulkRate ||
                    selectedDays.length === 0 ||
                    selectedMonths.length === 0
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !bulkRate ||
                    selectedDays.length === 0 ||
                    selectedMonths.length === 0
                      ? 0.3
                      : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (
                    bulkRate &&
                    selectedDays.length > 0 &&
                    selectedMonths.length > 0
                  ) {
                    e.currentTarget.style.backgroundColor =
                      "rgba(57, 189, 248, 0.9)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#39BDF8";
                }}
              >
                <Zap style={{ width: "12px", height: "12px" }} />
                Apply
              </button>
            </div>

            {/* Preview */}
            {selectedDays.length > 0 && selectedMonths.length > 0 && (
              <div
                style={{
                  color: "#9ca3af",
                  fontSize: "11px",
                  paddingTop: "12px",
                  borderTop: "1px solid #2a2a2a",
                  marginTop: "12px",
                }}
              >
                Will update all{" "}
                <span style={{ color: "#39BDF8", fontWeight: "500" }}>
                  {selectedDays
                    .map((d) => daysOfWeek.find((day) => day.id === d)?.name)
                    .join(", ")}
                </span>{" "}
                in{" "}
                <span style={{ color: "#39BDF8", fontWeight: "500" }}>
                  {selectedMonths.map((m) => months[m].name).join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Horizontal Scrolling Calendar */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {months.map((month, monthIdx) => (
              <div
                key={monthIdx}
                style={{
                  backgroundColor: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  overflow: "hidden",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                }}
              >
                {/* Month Header with Bulk Fill */}
                <div
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderBottom: "1px solid #2a2a2a",
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      color: "#e5e5e5",
                      fontSize: "14px",
                      fontWeight: "500",
                      minWidth: "90px",
                      textTransform: "uppercase",
                      letterSpacing: "0.025em",
                    }}
                  >
                    {month.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      style={{
                        color: "#9ca3af",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      Fill All:
                    </span>
                    <input
                      type="number"
                      placeholder="400"
                      id={`bulk-${monthIdx}`}
                      style={{
                        backgroundColor: "#141414",
                        border: "1px solid #2a2a2a",
                        color: "#e5e5e5",
                        fontSize: "12px",
                        height: "32px",
                        width: "96px",
                        padding: "0 8px",
                        borderRadius: "6px",
                        outline: "none",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(57, 189, 248, 0.5)")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "#2a2a2a")
                      }
                    />
                    <button
                      onClick={(e) => {
                        // [FIX] Prevent form submission bubbles and safe element lookup
                        e.preventDefault();
                        const input = document.getElementById(
                          `bulk-${monthIdx}`
                        ) as HTMLInputElement;
                        if (input && input.value) {
                          handleBulkSet(monthIdx, input.value);
                        }
                      }}
                      style={{
                        height: "32px",
                        padding: "0 12px",
                        color: "#9ca3af",
                        fontSize: "12px",
                        fontWeight: "500",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        borderRadius: "6px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#39BDF8";
                        e.currentTarget.style.backgroundColor =
                          "rgba(57, 189, 248, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#9ca3af";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Copy style={{ width: "12px", height: "12px" }} />
                      Apply
                    </button>
                  </div>
                </div>

                {/* Days Row - Horizontal Scroll */}
                <div style={{ overflowX: "auto", backgroundColor: "#0f0f0f" }}>
                  <div style={{ display: "flex", gap: "8px", padding: "16px" }}>
                    {getDaysInMonth(monthIdx).map((day) => {
                      const dayOfWeek = getDayOfWeek(2025, monthIdx, day);
                      const dayName = daysOfWeek.find(
                        (d) => d.id === dayOfWeek
                      )?.short;
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      return (
                        <div key={day} style={{ flexShrink: 0, width: "70px" }}>
                          <div
                            style={{
                              textAlign: "center",
                              marginBottom: "8px",
                              backgroundColor: "#1a1a1a",
                              borderRadius: "6px 6px 0 0",
                              padding: "6px 0",
                              border: "1px solid #2a2a2a",
                              borderBottom: "none",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "500",
                                color: isWeekend ? "#faff6a" : "#9ca3af",
                              }}
                            >
                              {day}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: isWeekend
                                  ? "rgba(250, 255, 106, 0.6)"
                                  : "#6b7280",
                              }}
                            >
                              {dayName}
                            </div>
                          </div>
                          <input
                            type="number"
                            value={rates[`${monthIdx}-${day}`] || ""}
                            onChange={(e) => {
                              setRates((prev) => ({
                                ...prev,
                                [`${monthIdx}-${day}`]: e.target.value,
                              }));
                            }}
                            placeholder="400"
                            style={{
                              textAlign: "center",
                              border: "1px solid #2a2a2a",
                              borderColor: rates[`${monthIdx}-${day}`]
                                ? "rgba(57, 189, 248, 0.3)"
                                : "#2a2a2a",
                              backgroundColor: rates[`${monthIdx}-${day}`]
                                ? "rgba(57, 189, 248, 0.1)"
                                : "#1a1a1a",
                              color: "#e5e5e5",
                              height: "40px",
                              fontSize: "14px",
                              width: "100%",
                              borderRadius: "0 0 6px 6px",
                              fontWeight: "500",
                              outline: "none",
                              padding: "0 4px",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor =
                                "rgba(57, 189, 248, 0.5)")
                            }
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = rates[
                                `${monthIdx}-${day}`
                              ]
                                ? "rgba(57, 189, 248, 0.3)"
                                : "#2a2a2a";
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter
          style={{
            gap: "8px",
            flexShrink: 0,
            borderTop: "1px solid rgba(42, 42, 42, 0.3)",
            paddingTop: "16px",
            marginTop: "16px",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => setIsOpen(false)}
            style={{
              backgroundColor: "rgba(26, 26, 26, 0.5)",
              border: "1px solid rgba(42, 42, 42, 0.5)",
              color: "#9ca3af",
              height: "36px",
              padding: "0 20px",
              fontSize: "14px",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#1a1a1a";
              e.currentTarget.style.borderColor = "#2a2a2a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(26, 26, 26, 0.5)";
              e.currentTarget.style.borderColor = "rgba(42, 42, 42, 0.5)";
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (onSave) onSave(rates);
              setIsOpen(false);
            }}
            style={{
              backgroundColor: "rgba(57, 189, 248, 0.9)",
              color: "#0f0f0f",
              height: "36px",
              padding: "0 20px",
              fontSize: "14px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#39BDF8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(57, 189, 248, 0.9)";
            }}
          >
            Save Changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
