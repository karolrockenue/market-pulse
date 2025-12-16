import { CSSProperties } from "react";
import { Calendar } from "lucide-react";
import { type RecentActivityDay } from "../api/dashboard.api";

interface RecentBookingsProps {
  data: RecentActivityDay[];
}

export function RecentBookings({ data }: RecentBookingsProps) {
  // Use passed data
  const bookingData = data || [];

  const styles: Record<string, CSSProperties> = {
    container: {
      backgroundColor: "#1a1a1a",
      borderRadius: "8px",
      border: "1px solid #2a2a2a",
      padding: "20px",
      height: "460px", // Matches PROT fixed height
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
      gridTemplateColumns: "1fr 65px 80px 50px 60px",
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
      gridTemplateColumns: "1fr 65px 80px 50px 60px",
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

      <div>
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
              <div style={styles.mainValue}>
                {day.isToday ? day.roomNights : "-"}
              </div>
            </div>

            <div style={styles.valueCell}>
              <div style={styles.mainValue}>£{Math.round(day.adr)}</div>
            </div>

            <div style={styles.valueCell}>
              <div
                style={{
                  ...styles.mainValue,
                  color: "#39BDF8",
                  fontSize: "11px",
                }}
              >
                £{Math.round(day.revenue).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
