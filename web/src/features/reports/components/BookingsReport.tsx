import { useState, useEffect, CSSProperties } from "react";
import { R } from "../../../styles/tokens";
import { ArrowLeft, ChevronDown, Loader2 } from "lucide-react";

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
    case "Booking.com": return R.warmTeal;
    case "Direct": return R.green;
    case "Expedia": return R.gold;
    case "Hotels.com": return R.warmTeal;
    case "Agoda": return R.red;
    default: return R.textMid;
  }
};

const statusColor = (status: string): string => {
  if (!status) return R.textMid;
  const s = status.toLowerCase();
  if (s === "confirmed" || s === "started") return R.textMid;
  if (s === "checked in" || s === "checked_in") return R.green;
  if (s === "checked out" || s === "checked_out" || s === "processed") return R.textDim;
  if (s === "cancelled" || s === "canceled") return R.red;
  return R.textMid;
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

  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={{ padding: "32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: R.textDim,
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "12px",
              padding: 0,
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = R.warmTeal)}
            onMouseLeave={(e) => (e.currentTarget.style.color = R.textDim)}
          >
            <ArrowLeft style={{ width: "14px", height: "14px" }} />
            Back to Reports
          </button>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>
            Reports
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>
            Bookings Report
          </h1>
          <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>
            Last 14 days — click a day to expand individual bookings
          </p>
        </div>

        {/* Main card */}
        <div style={{
          backgroundColor: R.darkBand,
          borderRadius: 8,
          border: `1px solid ${R.border}`,
          overflow: "hidden",
        }}>
          {/* Card header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 20px",
            borderBottom: `1px solid ${R.sep}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: R.warmTeal }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: R.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Daily Bookings
            </span>
            <span style={{ fontSize: 11, color: R.textDim, marginLeft: 4 }}>Last 14 days</span>
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: "8px" }}>
              <Loader2 style={{ width: "16px", height: "16px", color: R.warmTeal, animation: "spin 1s linear infinite" }} />
              <span style={{ color: R.textDim, fontSize: "12px" }}>Loading bookings...</span>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div style={{ color: R.red, fontSize: "12px", marginBottom: "4px" }}>Failed to load bookings</div>
              <div style={{ color: R.textDim, fontSize: "11px" }}>{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && days.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ color: R.textDim, fontSize: "13px" }}>No bookings found in the last 14 days</div>
              <div style={{ color: R.textDim, fontSize: "11px", marginTop: "4px" }}>Bookings will appear here as they come in via webhooks</div>
            </div>
          )}

          {/* Table */}
          {!loading && !error && days.length > 0 && (
            <div style={{ padding: "12px 16px 16px" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: summaryGridCols,
                backgroundColor: R.sidebar,
                borderRadius: "6px 6px 0 0",
                border: `1px solid ${R.border}`,
                borderBottom: "none",
              }}>
                <div style={headerCellStyle}>Date</div>
                <div style={headerCellStyle}>Bookings</div>
                <div style={headerCellStyle}>Room Nights</div>
                <div style={headerCellStyle}>ADR</div>
                <div style={headerCellStyle}>Revenue</div>
              </div>

              {/* Day rows + accordion */}
              <div style={{
                border: `1px solid ${R.border}`,
                borderTop: `1px solid ${R.border}`,
                borderRadius: "0 0 6px 6px",
                overflow: "hidden",
              }}>
                {days.map((day, i) => {
                  const isExpanded = expandedDay === day.dateKey;
                  const isLast = i === days.length - 1;

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
                            ? "rgba(56, 198, 186, 0.06)"
                            : hoveredRow === i
                              ? "rgba(57, 189, 248, 0.04)"
                              : "transparent",
                          borderBottom: isLast && !isExpanded ? "none" : `1px solid ${R.sep}`,
                          transition: "background-color 0.15s",
                          cursor: "pointer",
                          ...(day.isToday ? { borderLeft: `3px solid ${R.warmTeal}` } : { borderLeft: "3px solid transparent" }),
                        }}
                      >
                        <div style={{
                          ...cellStyle,
                          color: day.isToday ? R.warmTeal : R.accent,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}>
                          <ChevronDown style={{
                            width: 14,
                            height: 14,
                            color: R.textDim,
                            transition: "transform 0.2s",
                            transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                            flexShrink: 0,
                          }} />
                          {day.dateStr}
                        </div>
                        <div style={cellStyle}>{day.bookings}</div>
                        <div style={cellStyle}>{day.roomNights}</div>
                        <div style={{ ...cellStyle, fontVariantNumeric: "tabular-nums" }}>
                          {currencySymbol}{day.adr}
                        </div>
                        <div style={{ ...cellStyle, color: R.warmTeal, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                          {currencySymbol}{day.revenue.toLocaleString()}
                        </div>
                      </div>

                      {/* Accordion: booking details */}
                      {isExpanded && (
                        <div style={{
                          backgroundColor: "rgba(12, 14, 18, 0.5)",
                          borderBottom: isLast ? "none" : `1px solid ${R.sep}`,
                          padding: "12px 16px 14px",
                        }}>
                          {/* Inner detail table */}
                          <div style={{
                            backgroundColor: R.sidebar,
                            borderRadius: 6,
                            border: `1px solid ${R.border}`,
                            overflow: "hidden",
                          }}>
                            {/* Detail header */}
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: detailGridCols,
                              borderBottom: `1px solid ${R.border}`,
                              padding: "0 12px",
                            }}>
                              <div style={detailHeaderStyle}>Guest Name</div>
                              <div style={detailHeaderStyle}>Room Type</div>
                              <div style={detailHeaderStyle}>Source</div>
                              <div style={detailHeaderStyle}>Arrival</div>
                              <div style={detailHeaderStyle}>Departure</div>
                              <div style={detailHeaderStyle}>Nights</div>
                              <div style={detailHeaderStyle}>Avg Rate</div>
                              <div style={detailHeaderStyle}>Total</div>
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
                                  borderBottom: bIdx < day.details.length - 1 ? `1px solid ${R.sep}` : "none",
                                }}
                              >
                                <div style={{ ...detailCellStyle }}>
                                  <div style={{ color: R.accent, fontSize: 11 }}>{b.guestName || "—"}</div>
                                  <div style={{ color: statusColor(b.status), fontSize: 9, textTransform: "uppercase", marginTop: 1, letterSpacing: 0.3 }}>
                                    {b.status || "—"}
                                  </div>
                                </div>
                                <div style={{ ...detailCellStyle, color: R.textMid, display: "flex", alignItems: "center" }}>
                                  {b.roomType || "—"}
                                </div>
                                <div style={{ ...detailCellStyle, display: "flex", alignItems: "center" }}>
                                  <span style={{
                                    color: sourceColor(b.source),
                                    fontSize: 10,
                                    backgroundColor: `${sourceColor(b.source)}15`,
                                    padding: "3px 8px",
                                    borderRadius: 4,
                                    whiteSpace: "nowrap",
                                  }}>
                                    {b.source || "—"}
                                  </span>
                                </div>
                                <div style={{ ...detailCellStyle, display: "flex", alignItems: "center" }}>
                                  {formatDate(b.checkIn)}
                                </div>
                                <div style={{ ...detailCellStyle, color: R.textMid, display: "flex", alignItems: "center" }}>
                                  {formatDate(b.checkOut)}
                                </div>
                                <div style={{ ...detailCellStyle, color: R.textMid, display: "flex", alignItems: "center" }}>
                                  {b.nights}
                                </div>
                                <div style={{ ...detailCellStyle, color: R.textMid, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center" }}>
                                  {currencySymbol}{b.avgNightlyRate}
                                </div>
                                <div style={{ ...detailCellStyle, color: R.warmTeal, fontWeight: 500, fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center" }}>
                                  {currencySymbol}{b.totalRate}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SHARED STYLES ---

const headerCellStyle: CSSProperties = {
  color: R.textDim,
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "8px 10px",
  fontWeight: 600,
};

const cellStyle: CSSProperties = {
  padding: "10px 10px",
  fontSize: 12,
  color: R.accent,
};

const detailHeaderStyle: CSSProperties = {
  color: R.textDim,
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "8px 10px",
  fontWeight: 600,
};

const detailCellStyle: CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  color: R.accent,
};
