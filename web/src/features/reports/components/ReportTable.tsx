import { R } from "../../../styles/tokens";

interface ReportTableProps {
  startDate: string;
  endDate: string;
  granularity: string;
  selectedMetrics: string[];
  displayTotals: boolean;
  showMarketComparisons: boolean;
  taxInclusive: boolean;
  tableLayout: string;
  data: any[];
  currencySymbol?: string;
  transparent?: boolean;
}

export function ReportTable({
  startDate,
  endDate,
  granularity,
  selectedMetrics,
  displayTotals,
  showMarketComparisons,
  taxInclusive,
  tableLayout,
  data,
  currencySymbol = "£",
  transparent = false,
}: ReportTableProps) {
  const metricLabels: Record<string, string> = {
    occupancy: "Occupancy",
    adr: "ADR",
    revpar: "RevPAR",
    "total-revenue": "Total Revenue",
    "rooms-sold": "Rooms Sold",
    "rooms-unsold": "Rooms Unsold",
    "market-occupancy": "Market Occ",
    "market-adr": "Market ADR",
  };

  const formatValue = (metric: string, value: number) => {
    // Safety check in case value is undefined/null
    const safeValue = Number(value) || 0;

    // Occupancy comes in as a decimal (e.g. 0.725), so multiply by 100
    if (metric.includes("occupancy")) return `${(safeValue * 100).toFixed(1)}%`;

    if (
      metric.includes("adr") ||
      metric.includes("revenue") ||
      metric.includes("revpar")
    ) {
      // Format with currency symbol and standard comma separation
      return `${currencySymbol}${safeValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Add comma separation for whole numbers like rooms-sold
    return safeValue.toLocaleString("en-US");
  };
  const calculateAggregate = (metric: string) => {
    if (data.length === 0) return 0;

    // Calculate the total sum safely
    const sum = data.reduce((acc, row) => acc + (Number(row[metric]) || 0), 0);

    // Return the total sum for volume/financial metrics
    if (
      metric.includes("revenue") ||
      metric.includes("rooms-sold") ||
      metric.includes("rooms-unsold")
    ) {
      return sum;
    }

    // Return the average for rate/percentage metrics (Occ, ADR, RevPAR)
    return sum / data.length;
  };

  if (data.length === 0) {
    return (
      <div
        style={{
          backgroundColor: transparent ? "transparent" : R.darkBand,
          borderRadius: transparent ? "0" : "4px",
          border: transparent ? "none" : `1px solid ${R.border}`,
          padding: "48px",
          textAlign: "center",
        }}
      >
        <div style={{ color: R.textMid, fontSize: "0.875rem" }}>
          No report data available. Click "Run Report" to generate.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: transparent ? "transparent" : R.darkBand,
        borderRadius: transparent ? "0" : "8px",
        border: transparent ? "none" : `1px solid ${R.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${R.border}`,
        }}
      >
        <div style={{ color: R.accent, fontSize: "0.875rem" }}>
          Displaying <span style={{ color: R.gold }}>{granularity}</span>{" "}
          data from <span style={{ color: R.gold }}>{startDate}</span> to{" "}
          <span style={{ color: R.gold }}>{endDate}</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${R.border}` }}>
              <th
                style={{
                  padding: "0.625rem 1rem",
                  textAlign: "left",
                  color: R.textDim,
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "-0.025em",
                  fontWeight: "normal",
                  position: "sticky",
                  left: 0,
                  backgroundColor: R.darkBand,
                  zIndex: 10,
                }}
              >
                Date
              </th>
              {selectedMetrics.map((metric) => (
                <th
                  key={metric}
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "center",
                    color: R.textDim,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                    fontWeight: "normal",
                  }}
                >
                  {metricLabels[metric]}
                </th>
              ))}
              {showMarketComparisons && (
                <th
                  style={{
                    padding: "0.625rem 0.75rem",
                    textAlign: "center",
                    color: R.textDim,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                    fontWeight: "normal",
                    borderLeft: `1px solid ${R.border}`,
                  }}
                >
                  Delta
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                style={{
                  borderBottom: `1px solid ${R.sep}`,
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = R.card;
                  const firstCell = e.currentTarget
                    .firstElementChild as HTMLElement;
                  if (firstCell) firstCell.style.backgroundColor = R.card;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  const firstCell = e.currentTarget
                    .firstElementChild as HTMLElement;
                  if (firstCell) firstCell.style.backgroundColor = R.darkBand;
                }}
              >
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    color: R.accent,
                    fontSize: "0.875rem",
                    position: "sticky",
                    left: 0,
                    backgroundColor: R.darkBand,
                    zIndex: 10,
                    transition: "background-color 0.2s",
                  }}
                >
                  {granularity === "monthly" && row.period
                    ? new Date(`${row.period}T12:00:00`).toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric" },
                      )
                    : row.period}
                </td>
                {selectedMetrics.map((metric) => (
                  <td
                    key={metric}
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      color: R.accent,
                      fontSize: "0.875rem",
                    }}
                  >
                    {formatValue(metric, row[metric])}
                  </td>
                ))}
                {showMarketComparisons && (
                  <td
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      fontSize: "0.875rem",
                      borderLeft: `1px solid ${R.border}`,
                      color:
                        row.delta > 0
                          ? R.green
                          : row.delta < 0
                            ? "#ef4444"
                            : R.textMid,
                    }}
                  >
                    {row.delta > 0 ? "+" : ""}
                    {row.delta?.toFixed(2) || "0.00"}
                  </td>
                )}
              </tr>
            ))}
            {displayTotals && (
              <tr
                style={{
                  borderTop: "2px solid rgba(57, 189, 248, 0.3)",
                  backgroundColor: R.heroBg,
                }}
              >
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    color: R.warmTeal,
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "-0.025em",
                    position: "sticky",
                    left: 0,
                    backgroundColor: R.heroBg,
                    zIndex: 10,
                  }}
                >
                  Total / Avg
                </td>
                {selectedMetrics.map((metric) => (
                  <td
                    key={metric}
                    style={{
                      padding: "0.75rem",
                      textAlign: "center",
                      color: R.warmTeal,
                      fontSize: "0.875rem",
                    }}
                  >
                    {formatValue(metric, calculateAggregate(metric))}
                  </td>
                ))}
                {showMarketComparisons && (
                  <td
                    style={{
                      padding: "0.75rem",
                      borderLeft: `1px solid ${R.border}`,
                    }}
                  ></td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
