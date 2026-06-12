import { useState, useEffect, CSSProperties } from "react";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { R } from "../../../styles/tokens";
import { RoundedGridReportControls } from "./RoundedGridReportControls";

interface SourceReportProps {
  hotelId: string;
  propertyName?: string;
  currencySymbol: string;
  onBack: () => void;
}

interface SourceRow {
  source: string;
  bookings: number;
  cancelled: number;
  roomNights: number;
  revenue: number;
  sharePct: number;
  adr: number;
  alos: number;
  avgLead: number;
  cancelPct: number;
}

interface Totals {
  bookings: number;
  cancelled: number;
  roomNights: number;
  revenue: number;
  sharePct: number;
  adr: number;
  alos: number;
  avgLead: number;
  cancelPct: number;
}

interface SourceReportResponse {
  start: string;
  end: string;
  dataFrom: string | null;
  sources: SourceRow[];
  totals: Totals;
}

// First day of the previous full month (UTC).
function previousMonthStart(): string {
  const today = new Date();
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().split("T")[0];
}

// Last day of the previous full month (UTC).
function previousMonthEnd(): string {
  const today = new Date();
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return d.toISOString().split("T")[0];
}

const fmtCurrency = (n: number, sym: string) =>
  `${sym}${(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const fmtNumber = (n: number) => (n || 0).toLocaleString("en-GB");

export function SourceReport({
  hotelId,
  propertyName,
  currencySymbol,
  onBack,
}: SourceReportProps) {
  // Date controls — default to previous full month.
  const [startDate, setStartDate] = useState<string>(previousMonthStart);
  const [endDate, setEndDate] = useState<string>(previousMonthEnd);
  const [datePreset, setDatePreset] = useState<string>("previous-month");
  // Granularity is hidden for this report but the shared component requires
  // the prop pair — keep state local and inert.
  const [granularity, setGranularity] = useState<string>("monthly");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SourceReportResponse | null>(null);

  // Date preset → range (mirrors ReportsHub.tsx so the dropdown stays useful here).
  useEffect(() => {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    const d = today.getUTCDate();
    const dow = today.getUTCDay() === 0 ? 7 : today.getUTCDay();
    const fmt = (x: Date) => x.toISOString().split("T")[0];

    let s: Date;
    let e: Date;
    switch (datePreset) {
      case "last-week":
        s = new Date(Date.UTC(y, m, d - dow - 6));
        e = new Date(Date.UTC(y, m, d - dow));
        break;
      case "current-week":
        s = new Date(Date.UTC(y, m, d - dow + 1));
        e = new Date(Date.UTC(y, m, d - dow + 7));
        break;
      case "previous-month":
        s = new Date(Date.UTC(y, m - 1, 1));
        e = new Date(Date.UTC(y, m, 0));
        break;
      case "current-month":
        s = new Date(Date.UTC(y, m, 1));
        e = new Date(Date.UTC(y, m + 1, 0));
        break;
      case "next-month":
        s = new Date(Date.UTC(y, m + 1, 1));
        e = new Date(Date.UTC(y, m + 2, 0));
        break;
      case "year-to-date":
        s = new Date(Date.UTC(y, 0, 1));
        e = today;
        break;
      case "this-year":
        s = new Date(Date.UTC(y, 0, 1));
        e = new Date(Date.UTC(y, 11, 31));
        break;
      case "last-year":
        s = new Date(Date.UTC(y - 1, 0, 1));
        e = new Date(Date.UTC(y - 1, 11, 31));
        break;
      default:
        return;
    }
    setStartDate(fmt(s));
    setEndDate(fmt(e));
  }, [datePreset]);

  const runReport = async () => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/hotels/${hotelId}/source-report?start=${startDate}&end=${endDate}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: SourceReportResponse = await res.json();
      setData(json);
    } catch (e: any) {
      console.error("Failed to fetch source report:", e);
      setError(e.message || "Failed to load report");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on mount and whenever hotel changes.
  useEffect(() => {
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const handleExportCSV = () => {
    if (!data || data.sources.length === 0) {
      toast.error("Run the report first.");
      return;
    }
    const headers = [
      "Source",
      "Bookings",
      "Room Nights",
      "Revenue",
      "% of Revenue",
      "ADR",
      "ALOS",
      "Avg Lead (d)",
      "Cancel %",
    ];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = data.sources.map((r) =>
      [
        r.source,
        r.bookings,
        r.roomNights,
        r.revenue.toFixed(2),
        r.sharePct.toFixed(1) + "%",
        r.adr.toFixed(0),
        r.alos.toFixed(1),
        r.avgLead,
        r.cancelPct.toFixed(1) + "%",
      ]
        .map(escape)
        .join(","),
    );
    const totalsRow = [
      "Totals",
      data.totals.bookings,
      data.totals.roomNights,
      data.totals.revenue.toFixed(2),
      data.totals.sharePct.toFixed(1) + "%",
      data.totals.adr.toFixed(0),
      data.totals.alos.toFixed(1),
      data.totals.avgLead,
      data.totals.cancelPct.toFixed(1) + "%",
    ]
      .map(escape)
      .join(",");
    const csv = [headers.map(escape).join(","), ...rows, totalsRow].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = (propertyName || hotelId || "Property").replace(/\s+/g, "_");
    a.href = url;
    a.download = `Source_Report_${name}_${data.start}_to_${data.end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const formatDateLabel = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <div
      style={{
        flex: 1,
        background: R.bg,
        color: R.accent,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ padding: "32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
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
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to Report Selection
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 2,
                  color: R.gold,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Reports
              </div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: R.accent,
                  margin: "0 0 6px",
                  letterSpacing: -0.5,
                }}
              >
                Source Report
              </h1>
              <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>
                Booking volume and revenue by acquisition channel · grouped by
                booking date
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              disabled={!data || data.sources.length === 0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: R.heroBg,
                border: `1px solid ${R.border}`,
                color: R.accent,
                padding: "8px 14px",
                fontSize: 13,
                borderRadius: 4,
                cursor:
                  !data || data.sources.length === 0 ? "default" : "pointer",
                opacity: !data || data.sources.length === 0 ? 0.5 : 1,
                fontFamily: "inherit",
              }}
            >
              <Download size={14} color={R.textDim} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Unified canvas */}
        <div
          style={{
            backgroundColor: R.darkBand,
            borderRadius: 8,
            border: `1px solid ${R.border}`,
            overflow: "hidden",
          }}
        >
          {/* Controls */}
          <div style={{ padding: "20px 24px" }}>
            <RoundedGridReportControls
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              datePreset={datePreset}
              setDatePreset={setDatePreset}
              granularity={granularity}
              setGranularity={setGranularity}
              onRunReport={runReport}
              transparent
              showGranularity={false}
            />
          </div>

          <div style={{ height: 1, background: R.sep }} />

          {/* Coverage notice — picker start predates available reservation data */}
          {data && data.dataFrom && data.start < data.dataFrom && (
            <div
              style={{
                padding: "10px 24px",
                borderBottom: `1px solid ${R.sep}`,
                fontSize: 11,
                color: R.gold,
              }}
            >
              Reservation data for this property is available from{" "}
              {formatDateLabel(data.dataFrom)}. Bookings made before that date
              are not included in this report.
            </div>
          )}

          {/* Section header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 24px",
              borderBottom: `1px solid ${R.sep}`,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: R.warmTeal,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: R.accent,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Breakdown by Source
            </span>
            <span
              style={{
                fontSize: 11,
                color: R.textDim,
                marginLeft: "auto",
              }}
            >
              {formatDateLabel(startDate)} — {formatDateLabel(endDate)}
              {data && ` · ${data.sources.length} ${data.sources.length === 1 ? "source" : "sources"}`}
            </span>
          </div>

          {/* States */}
          {loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "48px 0",
              }}
            >
              <Loader2
                style={{
                  width: 16,
                  height: 16,
                  color: R.warmTeal,
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ color: R.textDim, fontSize: 12 }}>
                Loading…
              </span>
            </div>
          )}

          {error && !loading && (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div
                style={{ color: R.red, fontSize: 12, marginBottom: 4 }}
              >
                Failed to load source report
              </div>
              <div style={{ color: R.textDim, fontSize: 11 }}>{error}</div>
            </div>
          )}

          {!loading && !error && data && data.sources.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ color: R.textDim, fontSize: 13 }}>
                No bookings found in this date range
              </div>
              <div
                style={{ color: R.textDim, fontSize: 11, marginTop: 4 }}
              >
                Try a wider window or a different hotel
              </div>
            </div>
          )}

          {/* Table */}
          {!loading && !error && data && data.sources.length > 0 && (
            <div style={{ overflowX: "auto" }}>
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
                    <th style={{ ...thStyle, textAlign: "left" }}>Source</th>
                    <th style={thStyle}>Bookings</th>
                    <th style={thStyle}>Room Nights</th>
                    <th style={thStyle}>Revenue</th>
                    <th style={thStyle}>% of Revenue</th>
                    <th style={thStyle}>ADR</th>
                    <th style={thStyle}>ALOS</th>
                    <th style={thStyle}>Avg Lead</th>
                    <th style={thStyle}>Cancel %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((r, i) => (
                    <tr
                      key={`${r.source}-${i}`}
                      style={{
                        borderBottom: `1px solid ${R.sep}`,
                        transition: "background-color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = R.card)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <td style={{ ...tdStyle, textAlign: "left" }}>
                        {r.source}
                      </td>
                      <td style={{ ...tdStyle, color: R.text }}>
                        {fmtNumber(r.bookings)}
                      </td>
                      <td style={{ ...tdStyle, color: R.text }}>
                        {fmtNumber(r.roomNights)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: R.warmTeal,
                          fontWeight: 500,
                        }}
                      >
                        {fmtCurrency(r.revenue, currencySymbol)}
                      </td>
                      <td style={tdStyle}>{r.sharePct.toFixed(1)}%</td>
                      <td style={tdStyle}>
                        {fmtCurrency(r.adr, currencySymbol)}
                      </td>
                      <td style={tdStyle}>{r.alos.toFixed(1)}</td>
                      <td style={tdStyle}>{r.avgLead}d</td>
                      <td style={tdStyle}>{r.cancelPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      background: R.sidebar,
                      borderTop: `1px solid ${R.border}`,
                    }}
                  >
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "left",
                        fontWeight: 600,
                      }}
                    >
                      Totals
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {fmtNumber(data.totals.bookings)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {fmtNumber(data.totals.roomNights)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {fmtCurrency(data.totals.revenue, currencySymbol)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {data.totals.sharePct.toFixed(1)}%
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {fmtCurrency(data.totals.adr, currencySymbol)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {data.totals.alos.toFixed(1)}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {data.totals.avgLead}d
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      {data.totals.cancelPct.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: "12px 14px",
  textAlign: "right",
  color: R.textMid,
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: CSSProperties = {
  padding: "11px 14px",
  textAlign: "right",
  color: R.accent,
  fontSize: 12.5,
  fontVariantNumeric: "tabular-nums",
};
