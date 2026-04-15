import { CSSProperties } from "react";
import { Calendar, ExternalLink } from "lucide-react";
import { R } from "../../../styles/tokens";
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
      padding: "0",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    },
    header: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "16px 18px",
      borderBottom: `1px solid ${R.sep}`,
    },
    iconBadge: {
      width: "30px",
      height: "30px",
      borderRadius: "6px",
      backgroundColor: "rgba(57, 189, 248, 0.10)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: R.accent,
      fontSize: "14px",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "-0.3px",
    },
    subtitle: {
      color: R.textDim,
      fontSize: "10px",
      marginTop: "2px",
    },
    tableHeader: {
      display: "grid",
      gridTemplateColumns: "1fr 55px 65px 55px 70px",
      gap: "8px",
      padding: "7px 18px",
      backgroundColor: R.heroBg,
    },
    headerCell: {
      color: R.textDim,
      fontSize: "9px",
      textTransform: "uppercase",
      letterSpacing: "-0.2px",
    },
    row: {
      display: "grid",
      gridTemplateColumns: "1fr 55px 65px 55px 70px",
      gap: "8px",
      padding: "9px 18px",
      borderRadius: "4px",
      margin: "2px 6px",
      backgroundColor: "transparent",
      border: "1px solid transparent",
      transition: "background-color 0.2s",
      cursor: "default",
    },
    todayRow: {
      backgroundColor: "rgba(123, 175, 212, 0.04)",
      border: `1px solid rgba(123, 175, 212, 0.10)`,
    },
    dateCell: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    dateText: {
      color: R.accent,
      fontSize: "11px",
    },
    valueCell: {
      color: R.accent,
      fontSize: "11px",
      textAlign: "right",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    mainValue: {
      color: R.accent,
      fontSize: "11px",
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.iconBadge}>
          <Calendar
            style={{ width: "16px", height: "16px", color: "#38C6BA" }}
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
                e.currentTarget.style.backgroundColor = R.heroBg;
              }
            }}
            onMouseLeave={(e) => {
              if (!day.isToday) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <div style={styles.dateCell}>
              <div
                style={{
                  ...styles.dateText,
                  color: day.isToday ? "#7BAFD4" : R.accent,
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
                  color: "#7BAFD4",
                  fontSize: "11px",
                  fontWeight: 500,
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
            padding: "10px 18px",
            marginTop: "auto",
            backgroundColor: "transparent",
            border: "none",
            borderTop: `1px solid ${R.sep}`,
            cursor: "pointer",
            color: R.textDim,
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "-0.2px",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#7BAFD4")}
          onMouseLeave={(e) => (e.currentTarget.style.color = R.textDim)}
        >
          View Full Report
          <ExternalLink style={{ width: "12px", height: "12px" }} />
        </button>
      )}
    </div>
  );
}
