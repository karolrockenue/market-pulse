import { CSSProperties } from "react";
import { R } from "../../../styles/tokens";

interface FormattingOptionsProps {
  displayTotals: boolean;
  setDisplayTotals: (value: boolean) => void;
  taxInclusive: boolean;
  setTaxInclusive: (value: boolean) => void;
  showMarketComparisons: boolean;
  setShowMarketComparisons: (value: boolean) => void;
  tableLayout: string;
  setTableLayout: (value: string) => void;
}

const formattingItems = [
  { id: "totals", label: "Totals" },
  { id: "tax", label: "Tax Incl." },
  { id: "market", label: "Market Δ" },
];

const layoutOptions = [
  { id: "group-by-metric", label: "By Metric" },
  { id: "group-by-source", label: "By Source" },
];

export function FormattingOptions({
  displayTotals,
  setDisplayTotals,
  taxInclusive,
  setTaxInclusive,
  showMarketComparisons,
  setShowMarketComparisons,
  tableLayout,
  setTableLayout,
}: FormattingOptionsProps) {
  const getActive = (id: string) => {
    if (id === "totals") return displayTotals;
    if (id === "tax") return taxInclusive;
    if (id === "market") return showMarketComparisons;
    return false;
  };

  const handleToggle = (id: string) => {
    if (id === "totals") setDisplayTotals(!displayTotals);
    if (id === "tax") setTaxInclusive(!taxInclusive);
    if (id === "market") setShowMarketComparisons(!showMarketComparisons);
  };

  return (
    <div>
      <span
        style={{
          color: R.textDim,
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "-0.025em",
          marginBottom: "8px",
          display: "block",
        }}
      >
        Formatting
      </span>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {formattingItems.map((item) => {
          const active = getActive(item.id);
          return (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
              onClick={() => handleToggle(item.id)}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: active ? R.accent : R.textDim,
                  letterSpacing: "-0.01em",
                  transition: "color 0.15s ease",
                }}
              >
                {item.label}
              </span>
              <div
                style={
                  {
                    width: "40px",
                    height: "22px",
                    borderRadius: "11px",
                    position: "relative",
                    transition: "background-color 0.15s ease",
                    flexShrink: 0,
                    backgroundColor: active
                      ? "rgba(57, 189, 248, 0.25)"
                      : "#222",
                  } as CSSProperties
                }
              >
                <div
                  style={
                    {
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      position: "absolute",
                      top: "3px",
                      left: active ? "21px" : "3px",
                      backgroundColor: active ? "#38C6BA" : R.textDim,
                      transition:
                        "left 0.15s ease, background-color 0.15s ease",
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          );
        })}

        {showMarketComparisons &&
          layoutOptions.map((opt) => {
            const active = tableLayout === opt.id;
            return (
              <div
                key={opt.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
                onClick={() => setTableLayout(opt.id)}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: active ? "#c5c5c5" : "#444",
                    letterSpacing: "-0.01em",
                    transition: "color 0.15s ease",
                  }}
                >
                  {opt.label}
                </span>
                <div
                  style={
                    {
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      border: `2px solid ${active ? "#38C6BA" : R.border}`,
                      backgroundColor: active ? "#38C6BA" : "transparent",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    } as CSSProperties
                  }
                >
                  {active && (
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        backgroundColor: R.darkBand,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
