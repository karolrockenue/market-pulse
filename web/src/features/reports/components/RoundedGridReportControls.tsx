import { useState, useRef, useEffect, CSSProperties } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
} from "lucide-react";

interface RoundedGridReportControlsProps {
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  datePreset: string;
  setDatePreset: (preset: string) => void;
  granularity: string;
  setGranularity: (granularity: string) => void;
  onRunReport: () => void;
  transparent?: boolean;
}

const monthNames = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];
const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

const generateCalendarDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
};

const formatDateDisplay = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const presets = [
  { value: "last-week", label: "Last Week" },
  { value: "current-week", label: "Current Week" },
  { value: "current-month", label: "Current Month" },
  { value: "next-month", label: "Next Month" },
  { value: "year-to-date", label: "Year-to-Date" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
];

const granularityOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function RoundedGridReportControls({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  datePreset,
  setDatePreset,
  granularity,
  setGranularity,
  onRunReport,
  transparent = false,
}: RoundedGridReportControlsProps) {
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [fromViewMonth, setFromViewMonth] = useState(() => {
    const d = new Date(startDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [toViewMonth, setToViewMonth] = useState(() => {
    const d = new Date(endDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [presetOpen, setPresetOpen] = useState(false);
  const [granularityOpen, setGranularityOpen] = useState(false);
  const [runButtonHovered, setRunButtonHovered] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpenPicker(null);
        setPresetOpen(false);
        setGranularityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getSelectedDay = (
    dateStr: string,
    viewYear: number,
    viewMonth: number,
  ) => {
    const d = new Date(dateStr);
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      return d.getDate();
    }
    return null;
  };

  const handleDayClick = (
    day: number,
    viewYear: number,
    viewMonth: number,
    type: "from" | "to",
  ) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (type === "from") {
      setStartDate(dateStr);
    } else {
      setEndDate(dateStr);
    }
    setOpenPicker(null);
  };

  const navigateMonth = (direction: -1 | 1, type: "from" | "to") => {
    if (type === "from") {
      setFromViewMonth((prev) => {
        let newMonth = prev.month + direction;
        let newYear = prev.year;
        if (newMonth < 0) {
          newMonth = 11;
          newYear--;
        }
        if (newMonth > 11) {
          newMonth = 0;
          newYear++;
        }
        return { year: newYear, month: newMonth };
      });
    } else {
      setToViewMonth((prev) => {
        let newMonth = prev.month + direction;
        let newYear = prev.year;
        if (newMonth < 0) {
          newMonth = 11;
          newYear--;
        }
        if (newMonth > 11) {
          newMonth = 0;
          newYear++;
        }
        return { year: newYear, month: newMonth };
      });
    }
  };

  const inputStyle: CSSProperties = {
    background: "#0d0d0d",
    border: "1px solid #2a2a2a",
    color: "#e5e5e5",
    padding: "10px 12px",
    fontSize: "13px",
    borderRadius: "4px",
    outline: "none",
    fontFamily: "system-ui, -apple-system, sans-serif",
    transition: "all 0.2s",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  };

  const calendarOverlayStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: "8px",
    zIndex: 1000,
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  };

  const labelStyle: CSSProperties = {
    color: "#6b7280",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "6px",
    display: "block",
  };

  const dropdownStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: "4px",
    zIndex: 1000,
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "4px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    minWidth: "160px",
  };

  const dropdownItemStyle: CSSProperties = {
    padding: "8px 12px",
    fontSize: "12px",
    color: "#e5e5e5",
    cursor: "pointer",
    borderRadius: "4px",
    transition: "background 0.15s",
    background: "transparent",
    border: "none",
    width: "100%",
    textAlign: "left",
    fontFamily: "inherit",
  };

  const selectedFromDay = getSelectedDay(
    startDate,
    fromViewMonth.year,
    fromViewMonth.month,
  );
  const selectedToDay = getSelectedDay(
    endDate,
    toViewMonth.year,
    toViewMonth.month,
  );

  const renderCalendar = (
    viewMonth: { year: number; month: number },
    selectedDay: number | null,
    type: "from" | "to",
  ) => {
    const days = generateCalendarDays(viewMonth.year, viewMonth.month);
    return (
      <div style={calendarOverlayStyle}>
        {/* Month Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateMonth(-1, type);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#e5e5e5",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <div
            style={{
              color: "#e5e5e5",
              fontSize: "12px",
              letterSpacing: "0.05em",
            }}
          >
            {monthNames[viewMonth.month]} {viewMonth.year}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateMonth(1, type);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#e5e5e5",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day Name Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "6px",
            marginBottom: "10px",
          }}
        >
          {dayNames.map((day, i) => (
            <div
              key={`${day}-${i}`}
              style={{
                textAlign: "center",
                fontSize: "9px",
                color: "#6b7280",
                padding: "4px",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day Grid — Rounded circles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "4px",
          }}
        >
          {days.map((day, idx) => {
            const isSelected = day === selectedDay;
            return (
              <div
                key={idx}
                onClick={() => {
                  if (day)
                    handleDayClick(day, viewMonth.year, viewMonth.month, type);
                }}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "11px",
                  color: isSelected
                    ? "#0d0d0d"
                    : day
                      ? "#e5e5e5"
                      : "transparent",
                  background: isSelected ? "#39bdf8" : "transparent",
                  borderRadius: "50%",
                  cursor: day ? "pointer" : "default",
                  fontFamily: "monospace",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (day && !isSelected)
                    e.currentTarget.style.background = "#2a2a2a";
                }}
                onMouseLeave={(e) => {
                  if (day && !isSelected)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {day || ""}
              </div>
            );
          })}
        </div>

        {/* Today shortcut */}
        <div
          style={{
            marginTop: "12px",
            borderTop: "1px solid #2a2a2a",
            paddingTop: "10px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
              if (type === "from") {
                setStartDate(todayStr);
                setFromViewMonth({
                  year: today.getFullYear(),
                  month: today.getMonth(),
                });
              } else {
                setEndDate(todayStr);
                setToViewMonth({
                  year: today.getFullYear(),
                  month: today.getMonth(),
                });
              }
              setOpenPicker(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#39bdf8",
              fontSize: "11px",
              cursor: "pointer",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              fontFamily: "inherit",
              padding: "4px 8px",
            }}
          >
            Today
          </button>
        </div>
      </div>
    );
  };

  const currentPresetLabel =
    presets.find((p) => p.value === datePreset)?.label || datePreset;
  const currentGranularityLabel =
    granularityOptions.find((g) => g.value === granularity)?.label ||
    granularity;

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "12px",
        padding: transparent ? "0" : "16px 24px",
        backgroundColor: transparent ? "transparent" : "#141414",
        border: transparent ? "none" : "1px solid #2a2a2a",
        borderRadius: transparent ? "0" : "8px",
      }}
    >
      {/* Date Preset Dropdown */}
      <div style={{ position: "relative", minWidth: "150px" }}>
        <label style={labelStyle}>Preset</label>
        <div
          onClick={() => {
            setPresetOpen(!presetOpen);
            setOpenPicker(null);
            setGranularityOpen(false);
          }}
          style={{
            ...inputStyle,
            backgroundColor: "#141414",
            borderColor: presetOpen ? "#39bdf8" : "#2a2a2a",
          }}
        >
          <span>{currentPresetLabel}</span>
          <ChevronDown size={12} style={{ color: "#6b7280" }} />
        </div>
        {presetOpen && (
          <div style={dropdownStyle}>
            {presets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  setDatePreset(preset.value);
                  setPresetOpen(false);
                }}
                style={{
                  ...dropdownItemStyle,
                  background:
                    preset.value === datePreset
                      ? "rgba(57, 189, 248, 0.1)"
                      : "transparent",
                  color: preset.value === datePreset ? "#39bdf8" : "#e5e5e5",
                }}
                onMouseEnter={(e) => {
                  if (preset.value !== datePreset)
                    e.currentTarget.style.background = "#1a1a1a";
                }}
                onMouseLeave={(e) => {
                  if (preset.value !== datePreset)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "36px",
          backgroundColor: "#2a2a2a",
          flexShrink: 0,
        }}
      />

      {/* From Date — Rounded Grid Picker */}
      <div style={{ position: "relative", width: "300px" }}>
        <label style={labelStyle}>From</label>
        <div
          onClick={() => {
            setOpenPicker(openPicker === "from" ? null : "from");
            setPresetOpen(false);
            setGranularityOpen(false);
            // Sync view month to current start date
            const d = new Date(startDate);
            setFromViewMonth({ year: d.getFullYear(), month: d.getMonth() });
          }}
          style={{
            ...inputStyle,
            backgroundColor: "#141414",
            borderColor: openPicker === "from" ? "#39bdf8" : "#2a2a2a",
          }}
        >
          <span>{formatDateDisplay(startDate)}</span>
          <Calendar size={14} style={{ color: "#6b7280" }} />
        </div>
        {openPicker === "from" &&
          renderCalendar(fromViewMonth, selectedFromDay, "from")}
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "36px",
          backgroundColor: "#2a2a2a",
          flexShrink: 0,
        }}
      />

      {/* To Date — Rounded Grid Picker */}
      <div style={{ position: "relative", width: "300px" }}>
        <label style={labelStyle}>To</label>
        <div
          onClick={() => {
            setOpenPicker(openPicker === "to" ? null : "to");
            setPresetOpen(false);
            setGranularityOpen(false);
            const d = new Date(endDate);
            setToViewMonth({ year: d.getFullYear(), month: d.getMonth() });
          }}
          style={{
            ...inputStyle,
            backgroundColor: "#141414",
            borderColor: openPicker === "to" ? "#39bdf8" : "#2a2a2a",
          }}
        >
          <span>{formatDateDisplay(endDate)}</span>
          <Calendar size={14} style={{ color: "#6b7280" }} />
        </div>
        {openPicker === "to" &&
          renderCalendar(toViewMonth, selectedToDay, "to")}
      </div>

      {/* Divider */}
      <div
        style={{
          width: "1px",
          height: "36px",
          backgroundColor: "#2a2a2a",
          flexShrink: 0,
        }}
      />

      {/* Granularity Dropdown */}
      <div style={{ position: "relative", minWidth: "120px" }}>
        <label style={labelStyle}>View</label>
        <div
          onClick={() => {
            setGranularityOpen(!granularityOpen);
            setOpenPicker(null);
            setPresetOpen(false);
          }}
          style={{
            ...inputStyle,
            backgroundColor: "#141414",
            borderColor: granularityOpen ? "#39bdf8" : "#2a2a2a",
          }}
        >
          <span>{currentGranularityLabel}</span>
          <ChevronDown size={12} style={{ color: "#6b7280" }} />
        </div>
        {granularityOpen && (
          <div style={dropdownStyle}>
            {granularityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setGranularity(opt.value);
                  setGranularityOpen(false);
                }}
                style={{
                  ...dropdownItemStyle,
                  background:
                    opt.value === granularity
                      ? "rgba(57, 189, 248, 0.1)"
                      : "transparent",
                  color: opt.value === granularity ? "#39bdf8" : "#e5e5e5",
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== granularity)
                    e.currentTarget.style.background = "#1a1a1a";
                }}
                onMouseLeave={(e) => {
                  if (opt.value !== granularity)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Run Button */}
      <button
        onClick={onRunReport}
        onMouseEnter={() => setRunButtonHovered(true)}
        onMouseLeave={() => setRunButtonHovered(false)}
        style={{
          backgroundColor: runButtonHovered ? "#29ADEE" : "#39BDF8",
          color: "#0a0a0a",
          height: "38px",
          padding: "0 20px",
          fontSize: "12px",
          fontWeight: 500,
          borderRadius: "6px",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "background-color 0.2s",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <Play style={{ width: "14px", height: "14px" }} />
        Run Report
      </button>
    </div>
  );
}
