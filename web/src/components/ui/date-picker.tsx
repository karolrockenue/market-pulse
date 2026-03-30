import { useState, useRef, useEffect, CSSProperties } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerCalendarProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void; // YYYY-MM-DD
  label?: string; // optional label above the trigger
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
const dayNames = ["M", "T", "W", "T", "F", "S", "S"];

const generateCalendarDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

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

export function DatePickerCalendar({
  value,
  onChange,
  label,
}: DatePickerCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(value);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync viewMonth when value changes externally
  useEffect(() => {
    const d = new Date(value);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  }, [value]);

  const getSelectedDay = () => {
    const d = new Date(value);
    if (d.getFullYear() === viewMonth.year && d.getMonth() === viewMonth.month) {
      return d.getDate();
    }
    return null;
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const navigateMonth = (direction: -1 | 1) => {
    setViewMonth((prev) => {
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
    width: "280px",
    minWidth: "280px",
  };

  const calendarOverlayStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: "8px",
    zIndex: 1000,
    background: "#141414",
    border: "1px solid #2a2a2a",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    width: "280px",
    minWidth: "280px",
  };

  const labelStyle: CSSProperties = {
    color: "#6b7280",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "6px",
    display: "block",
  };

  const selectedDay = getSelectedDay();
  const days = generateCalendarDays(viewMonth.year, viewMonth.month);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={inputStyle} onClick={() => setIsOpen(!isOpen)}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={14} style={{ color: "#6b7280" }} />
          <span>{formatDateDisplay(value)}</span>
        </div>
      </div>

      {isOpen && (
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
                navigateMonth(-1);
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
                navigateMonth(1);
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
              gridTemplateColumns: "repeat(7, 32px)",
              gap: "2px",
              marginBottom: "10px",
              justifyContent: "center",
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
              gridTemplateColumns: "repeat(7, 32px)",
              gap: "2px",
              justifyContent: "center",
            }}
          >
            {days.map((day, idx) => {
              const isSelected = day !== null && day === selectedDay;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (day) handleDayClick(day);
                  }}
                  style={{
                    width: "32px",
                    height: "32px",
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
                onChange(todayStr);
                setViewMonth({
                  year: today.getFullYear(),
                  month: today.getMonth(),
                });
                setIsOpen(false);
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
      )}
    </div>
  );
}
