import { CSSProperties } from "react";
import { Calendar, ExternalLink } from "lucide-react";
import { type RecentActivityDay } from "../api/dashboard.api";

interface RecentBookingsProps {
  data: RecentActivityDay[];
  currencySymbol?: string;
  onViewFullReport?: () => void;
}

export function RecentBookings({
  data,
  currencySymbol = "£",
  onViewFullReport,
}: RecentBookingsProps) {
  // Use passed data, newest first
  const bookingData = [...(data || [])].reverse();

  // Format large numbers compactly (e.g. 228193564 → "228.2M", 1500000 → "1.5M", 12500 → "12.5K")
  const formatCompact = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 10_000) return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return Math.round(value).toLocaleString();
  };

  const styles: Record<string, CSSProperties> = {
    container: {
      backgroundColor: "#1a1a1a",
      borderRadius: "8px",
      border: "1px solid #2a2a2a",
      padding: "20px",
      height: "460px",
      display: "flex",
      flexDirection: "column",
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "16px",
      paddingBottom: "12px",
      borderBottom: "1px solid #2a2a2a",
    },
    iconBadge: {
      width: "32px",
      height: "32px",
      borderRadius: "6px",
      backgroundColor: "rgba(57, 189, 248, 0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: "#e5e5e5",
      fontSize: "14px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    subtitle: {
      color: "#6b7280",
      fontSize: "11px",
      marginTop: "2px",
    },
    tableHeader: {
      display: "grid",
      gridTemplateColumns: "1fr minmax(50px, auto) minmax(60px, auto) minmax(55px, auto) minmax(65px, auto)",
      gap: "12px",
      padding: "6px 10px",
      backgroundColor: "#141414",
      borderRadius: "4px",
      marginBottom: "6px",
    },
    headerCell: {
      color: "#6b7280",
      fontSize: "9px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    row: {
      display: "grid",
      gridTemplateColumns: "1fr minmax(50px, auto) minmax(60px, auto) minmax(55px, auto) minmax(65px, auto)",
      gap: "12px",
      padding: "10px 10px",
      backgroundColor: "#1D1D1C",
      borderRadius: "4px",
      marginBottom: "6px",
      transition: "background-color 0.2s",
      cursor: "default",
    },
    todayRow: {
      backgroundColor: "rgba(57, 189, 248, 0.08)",
      border: "1px solid rgba(57, 189, 248, 0.2)",
    },
    dateCell: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    dateText: {
      color: "#e5e5e5",
      fontSize: "11px",
    },
    valueCell: {
      color: "#9ca3af",
      fontSize: "11px",
      textAlign: "right",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    mainValue: {
      color: "#e5e5e5",
      fontSize: "12px",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBadge}>
          <Calendar
            style={{ width: "16px", height: "16px", color: "#39BDF8" }}
          />
        </div>
        <div>
          <div style={styles.title}>Recent Bookings</div>
          <div style={styles.subtitle}>Last 7 days activity</div>
        </div>
      </div>

      <div style={styles.tableHeader}>
        <div style={styles.headerCell}>Date</div>
        <div style={{ ...styles.headerCell, textAlign: "right" }}>Bookings</div>
        <div style={{ ...styles.headerCell, textAlign: "right" }}>
          Room Nights
        </div>
        <div style={{ ...styles.headerCell, textAlign: "right" }}>ADR</div>
        <div style={{ ...styles.headerCell, textAlign: "right" }}>Revenue</div>
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        {bookingData.map((day, index) => (
          <div
            key={index}
            style={{
              ...styles.row,
              ...(day.isToday ? styles.todayRow : {}),
            }}
            onMouseEnter={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.backgroundColor = "#141414";
              }
            }}
            onMouseLeave={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.backgroundColor = "#1D1D1C";
              }
            }}
          >
            <div style={styles.dateCell}>
              <div
                style={{
                  ...styles.dateText,
                  color: day.isToday ? "#39BDF8" : "#e5e5e5",
                }}
              >
                {day.dateStr}
              </div>
            </div>

            <div style={styles.valueCell}>
              <div style={styles.mainValue}>{day.bookings}</div>
            </div>

            <div style={styles.valueCell}>
              <div style={styles.mainValue}>{day.roomNights}</div>
            </div>

            <div style={styles.valueCell}>
              <div style={{ ...styles.mainValue, whiteSpace: "nowrap" }}>
                {currencySymbol}
                {formatCompact(day.adr)}
              </div>
            </div>

            <div style={styles.valueCell}>
              <div
                style={{
                  ...styles.mainValue,
                  color: "#39BDF8",
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                }}
              >
                {currencySymbol}
                {formatCompact(day.revenue)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {onViewFullReport && (
        <button
          onClick={onViewFullReport}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "10px 0",
            marginTop: "auto",
            backgroundColor: "transparent",
            border: "none",
            borderTop: "1px solid #2a2a2a",
            cursor: "pointer",
            color: "#6b7280",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "-0.025em",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#39BDF8")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
        >
          View Full Report
          <ExternalLink style={{ width: "12px", height: "12px" }} />
        </button>
      )}
    </div>
  );
}
