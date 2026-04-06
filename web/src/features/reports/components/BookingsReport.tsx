import { useState, useEffect, CSSProperties } from "react";
import { ArrowLeft, Calendar, ChevronDown, Loader2 } from "lucide-react";

interface BookingsReportProps {
  hotelId: string;
  currencySymbol: string;
  onBack: () => void;
}

interface BookingDetail {
  id: string;
  guestName: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  source: string;
  avgNightlyRate: number;
  totalRate: number;
  status: string;
}

interface DaySummary {
  dateStr: string;
  dateKey: string;
  bookings: number;
  roomNights: number;
  adr: number;
  revenue: number;
  isToday: boolean;
  details: BookingDetail[];
}

// --- HELPERS ---

const formatDate = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const sourceColor = (source: string): string => {
  switch (source) {
    case "Booking.com": return "#39BDF8";
    case "Direct": return "#10b981";
    case "Expedia": return "#f59e0b";
    case "Hotels.com": return "#8b5cf6";
    case "Agoda": return "#ef4444";
    default: return "#9ca3af";
  }
};

const statusColor = (status: string): string => {
  if (!status) return "#9ca3af";
  const s = status.toLowerCase();
  if (s === "confirmed" || s === "started") return "#9ca3af";
  if (s === "checked in" || s === "checked_in") return "#10b981";
  if (s === "checked out" || s === "checked_out" || s === "processed") return "#6b7280";
  if (s === "cancelled" || s === "canceled") return "#ef4444";
  return "#9ca3af";
};

// --- COMPONENT ---

export function BookingsReport({ hotelId, currencySymbol, onBack }: BookingsReportProps) {
  const [days, setDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredBooking, setHoveredBooking] = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/hotels/${hotelId}/bookings?days=14`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDays(data.days || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch bookings:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [hotelId]);

  const toggleDay = (dateKey: string) => {
    setExpandedDay((prev) => (prev === dateKey ? null : dateKey));
  };

  const summaryGridCols = "1.4fr 0.7fr 0.9fr 0.7fr 0.9fr";
  const detailGridCols = "1.4fr 1fr 0.7fr 0.7fr 0.5fr 0.8fr 0.7fr 0.7fr";

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      backgroundColor: "#1d1d1c",
      position: "relative",
      overflow: "hidden",
    },
    bgGradient: {
      position: "absolute",
      inset: "0",
      background: "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))",
    },
    bgGrid: {
      position: "absolute",
      inset: "0",
      backgroundImage: "linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)",
      backgroundSize: "64px 64px",
    },
    content: {
      position: "relative",
      zIndex: 10,
      padding: "24px",
    },
    backBtn: {
      background: "none",
      border: "none",
      color: "#6b7280",
      fontSize: "12px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "8px",
      padding: 0,
    },
    heading: {
      color: "white",
      fontSize: "24px",
      lineHeight: "32px",
      margin: 0,
      marginBottom: "4px",
      fontWeight: 400,
    },
    subtitle: {
      color: "#9ca3af",
      fontSize: "14px",
      lineHeight: "20px",
      margin: 0,
    },
    card: {
      backgroundColor: "#1a1a1a",
      borderRadius: "8px",
      border: "1px solid #2a2a2a",
      padding: "20px",
    },
    sectionHeader: {
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
    sectionTitle: {
      color: "#e5e5e5",
      fontSize: "14px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
    },
    sectionSubtitle: {
      color: "#6b7280",
      fontSize: "11px",
      marginTop: "2px",
    },
    headerCell: {
      color: "#6b7280",
      fontSize: "9px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
      padding: "6px 10px",
    },
    cell: {
      padding: "10px 10px",
      fontSize: "12px",
      color: "#e5e5e5",
    },
  };

  return (
    <div style={s.page}>
      <div style={s.bgGradient} />
      <div style={s.bgGrid} />

      <div style={s.content}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <button style={s.backBtn} onClick={onBack}>
            <ArrowLeft style={{ width: "14px", height: "14px" }} />
            Back to Reports
          </button>
          <h1 style={s.heading}>Bookings Report</h1>
          <p style={s.subtitle}>Last 14 days — click a day to expand individual bookings</p>
        </div>

        <div style={s.card}>
          <div style={s.sectionHeader}>
            <div style={s.iconBadge}>
              <Calendar style={{ width: "16px", height: "16px", color: "#39BDF8" }} />
            </div>
            <div>
              <div style={s.sectionTitle}>Daily Bookings</div>
              <div style={s.sectionSubtitle}>Last 14 days</div>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: "8px" }}>
              <Loader2 style={{ width: "16px", height: "16px", color: "#39BDF8", animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#6b7280", fontSize: "12px" }}>Loading bookings...</span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div style={{ color: "#ef4444", fontSize: "12px", marginBottom: "4px" }}>Failed to load bookings</div>
              <div style={{ color: "#6b7280", fontSize: "11px" }}>{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && days.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ color: "#6b7280", fontSize: "13px" }}>No bookings found in the last 14 days</div>
              <div style={{ color: "#4b5563", fontSize: "11px", marginTop: "4px" }}>Bookings will appear here as they come in via webhooks</div>
            </div>
          )}

          {/* Table */}
          {!loading && !error && days.length > 0 && (
            <>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: summaryGridCols, backgroundColor: "#141414", borderRadius: "4px", marginBottom: "4px" }}>
                <div style={s.headerCell}>Date</div>
                <div style={s.headerCell}>Bookings</div>
                <div style={s.headerCell}>Room Nights</div>
                <div style={s.headerCell}>ADR</div>
                <div style={s.headerCell}>Revenue</div>
              </div>

              {/* Day rows + accordion */}
              {days.map((day, i) => {
                const isExpanded = expandedDay === day.dateKey;

                return (
                  <div key={day.dateKey}>
                    {/* Summary row */}
                    <div
                      onClick={() => toggleDay(day.dateKey)}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: summaryGridCols,
                        backgroundColor: day.isToday
                          ? "rgba(57, 189, 248, 0.08)"
                          : isExpanded
                            ? "#141414"
                            : hoveredRow === i
                              ? "#141414"
                              : "#1D1D1C",
                        borderRadius: isExpanded ? "4px 4px 0 0" : "4px",
                        marginBottom: isExpanded ? "0" : "2px",
                        transition: "background-color 0.15s",
                        cursor: "pointer",
                        ...(day.isToday ? { border: "1px solid rgba(57, 189, 248, 0.2)" } : {}),
                      }}
                    >
                      <div style={{ ...s.cell, color: day.isToday ? "#39BDF8" : "#e5e5e5", display: "flex", alignItems: "center", gap: "8px" }}>
                        <ChevronDown style={{
                          width: "14px",
                          height: "14px",
                          color: "#6b7280",
                          transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                          flexShrink: 0,
                        }} />
                        {day.dateStr}
                      </div>
                      <div style={s.cell}>{day.bookings}</div>
                      <div style={s.cell}>{day.roomNights}</div>
                      <div style={s.cell}>{currencySymbol}{day.adr}</div>
                      <div style={{ ...s.cell, color: "#39BDF8" }}>{currencySymbol}{day.revenue.toLocaleString()}</div>
                    </div>

                    {/* Accordion: booking details */}
                    {isExpanded && (
                      <div style={{
                        backgroundColor: "#1D1D1C",
                        borderRadius: "0 0 4px 4px",
                        marginBottom: "2px",
                        padding: "10px 4px 12px",
                      }}>
                        {/* Inner table card */}
                        <div style={{
                          backgroundColor: "#111111",
                          borderRadius: "6px",
                          border: "1px solid #2a2a2a",
                          overflow: "hidden",
                        }}>
                          {/* Detail header */}
                          <div style={{ display: "grid", gridTemplateColumns: detailGridCols, backgroundColor: "#0f0f0f", borderBottom: "1px solid #2a2a2a", padding: "0 12px" }}>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Guest Name</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Room Type</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Source</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Arrival</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Departure</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Nights</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Avg Rate</div>
                            <div style={{ ...s.headerCell, padding: "8px 10px" }}>Total</div>
                          </div>

                          {/* Detail rows */}
                          {day.details.map((b: BookingDetail, bIdx: number) => (
                            <div
                              key={b.id}
                              onMouseEnter={() => setHoveredBooking(b.id)}
                              onMouseLeave={() => setHoveredBooking(null)}
                              style={{
                                display: "grid",
                                gridTemplateColumns: detailGridCols,
                                padding: "0 12px",
                                backgroundColor: hoveredBooking === b.id ? "rgba(57, 189, 248, 0.04)" : "transparent",
                                transition: "background-color 0.15s",
                                borderBottom: bIdx < day.details.length - 1 ? "1px solid #1a1a1a" : "none",
                              }}
                            >
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px" }}>
                                <div>{b.guestName || "—"}</div>
                                <div style={{ color: statusColor(b.status), fontSize: "9px", textTransform: "uppercase", marginTop: "1px" }}>{b.status || "—"}</div>
                              </div>
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px", color: "#9ca3af", display: "flex", alignItems: "center" }}>{b.roomType || "—"}</div>
                              <div style={{ ...s.cell, padding: "8px 10px", display: "flex", alignItems: "center" }}>
                                <span style={{
                                  color: sourceColor(b.source),
                                  fontSize: "10px",
                                  backgroundColor: `${sourceColor(b.source)}15`,
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  whiteSpace: "nowrap",
                                }}>
                                  {b.source || "—"}
                                </span>
                              </div>
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px", display: "flex", alignItems: "center" }}>{formatDate(b.checkIn)}</div>
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px", color: "#9ca3af", display: "flex", alignItems: "center" }}>{formatDate(b.checkOut)}</div>
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px", color: "#9ca3af", display: "flex", alignItems: "center" }}>{b.nights}</div>
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px", color: "#9ca3af", display: "flex", alignItems: "center" }}>{currencySymbol}{b.avgNightlyRate}</div>
                              <div style={{ ...s.cell, padding: "8px 10px", fontSize: "11px", color: "#39BDF8", fontWeight: 500, display: "flex", alignItems: "center" }}>{currencySymbol}{b.totalRate}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
