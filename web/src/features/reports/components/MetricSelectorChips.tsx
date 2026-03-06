import { CSSProperties } from "react";

/**
 * Variant A — "Round Slide Toggle"
 * Horizontal row of label + classic round pill toggles.
 */

interface MetricSelectorChipsProps {
  selectedMetrics: string[];
  onToggleMetric: (metric: string) => void;
}

const allMetrics = [
  { id: "occupancy", label: "Occ" },
  { id: "adr", label: "ADR" },
  { id: "revpar", label: "RevPAR" },
  { id: "total-revenue", label: "Rev" },
  { id: "rooms-sold", label: "Sold" },
  { id: "rooms-unsold", label: "Unsold" },
  { id: "market-occupancy", label: "Mkt Occ" },
  { id: "market-adr", label: "Mkt ADR" },
];

export function MetricSelectorChips({
  selectedMetrics,
  onToggleMetric,
}: MetricSelectorChipsProps) {
  return (
    <div>
      <span
        style={{
          color: "#6b7280",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "-0.025em",
          marginBottom: "8px",
          display: "block",
        }}
      >
        Metrics
      </span>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
        }}
      >
        {allMetrics.map((m) => {
          const active = selectedMetrics.includes(m.id);
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
              }}
              onClick={() => onToggleMetric(m.id)}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: active ? "#e5e5e5" : "#6b7280",
                  letterSpacing: "-0.01em",
                  transition: "color 0.15s ease",
                }}
              >
                {m.label}
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
                      backgroundColor: active ? "#39BDF8" : "#6b7280",
                      transition:
                        "left 0.15s ease, background-color 0.15s ease",
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
