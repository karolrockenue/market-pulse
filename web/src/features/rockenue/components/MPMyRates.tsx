import { useMemo, useState } from "react";
import { ChevronDown, Bell, Search } from "lucide-react";

// ── MP My Rates — Rockenue style mockup ──
// Horizontal rate grid. Visual hierarchy from real Rate Manager.

interface MPMyRatesProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  teal: "#39BDF8", warmTeal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
};

const fmt = (v: number) => `£${v}`;

export function MPMyRates({ activeView, onNavigate }: MPMyRatesProps) {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const days = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 3, 14 + i);
    const dow = d.getDay();
    const isWknd = dow === 5 || dow === 6;
    const isFrozen = i < 2;
    const occ = Math.min(96, Math.round(62 + (isWknd ? 18 : 0) + Math.sin(i * 0.3) * 8));
    const adr = Math.round(128 + (isWknd ? 30 : 0) + Math.sin(i * 0.25) * 12);
    const curveTarget = Math.round(55 + (isWknd ? 15 : 0) + Math.sin(i * 0.2) * 5);
    const delta = occ - curveTarget;
    const minRate = Math.round(95 + (isWknd ? 15 : 0));
    const floorRate = Math.round(minRate * 0.85);
    const liveRate = Math.round(135 + (isWknd ? 28 : 0) + Math.sin(i * 0.4) * 10);
    const aiRate = Math.round(142 + (isWknd ? 32 : 0) + Math.sin(i * 0.3) * 14);
    const sellRate = Math.round(liveRate * 0.82);
    const hasOverride = [5, 12, 18, 22].includes(i);
    const aiApplied = [7, 8, 14, 15, 20, 21].includes(i);
    const curve = occ > 80 ? "Peak" : occ > 65 ? "Mid" : "Low";
    return {
      i, dow, isWknd, isFrozen, occ, adr, curveTarget, delta, minRate, floorRate, liveRate, aiRate, sellRate,
      hasOverride, aiApplied, curve,
      dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString("en-GB", { month: "short" }),
      source: isFrozen ? "Frozen" : aiApplied ? "Sentinel" : hasOverride ? "Override" : "Sync",
    };
  }), []);

  // Row definitions with visual sections
  type RowDef = { key: string; label: string; section: "info" | "guardrails" | "ai" | "editable" | "divider" };
  const rows: RowDef[] = [
    { key: "source", label: "AI Status", section: "info" },
    { key: "occ", label: "Occupancy", section: "info" },
    { key: "adr", label: "ADR", section: "info" },
    { key: "curve", label: "Curve", section: "info" },
    { key: "delta", label: "Delta", section: "info" },
    { key: "div1", label: "", section: "divider" },
    { key: "min", label: "Min Rate", section: "guardrails" },
    { key: "floor", label: "Floor (LMF)", section: "guardrails" },
    { key: "live", label: "Live PMS Rate", section: "guardrails" },
    { key: "sell", label: "Current Sell Rate", section: "guardrails" },
    { key: "div2", label: "", section: "divider" },
    { key: "ai", label: "Sentinel AI Rate", section: "ai" },
    { key: "div3", label: "", section: "divider" },
    { key: "override", label: "PMS Override", section: "editable" },
    { key: "target", label: "Target Sell Rate", section: "editable" },
  ];

  const cellVal = (key: string, day: typeof days[0]) => {
    switch (key) {
      case "source": return day.source;
      case "occ": return `${day.occ}%`;
      case "adr": return fmt(day.adr);
      case "curve": return day.curve;
      case "delta": return `${day.delta > 0 ? "+" : ""}${day.delta}`;
      case "min": return fmt(day.minRate);
      case "floor": return fmt(day.floorRate);
      case "live": return fmt(day.liveRate);
      case "sell": return fmt(day.sellRate);
      case "ai": return fmt(day.aiRate);
      case "override": return day.hasOverride ? fmt(day.liveRate + 8) : "—";
      case "target": return day.hasOverride ? fmt(Math.round((day.liveRate + 8) * 0.82)) : "—";
      default: return "";
    }
  };

  const cellColor = (key: string, day: typeof days[0]) => {
    switch (key) {
      case "source":
        return day.source === "Sentinel" ? R.teal : day.source === "Frozen" ? R.gold : day.source === "Override" ? R.gold : R.textDim;
      case "occ": return day.occ >= 80 ? R.warmTeal : day.occ >= 60 ? R.text : R.gold;
      case "curve": return day.curve === "Peak" ? R.warmTeal : day.curve === "Mid" ? R.text : R.gold;
      case "delta": return day.delta > 0 ? R.green : day.delta < -10 ? R.red : R.text;
      case "floor": return R.textMid;
      case "sell": return R.warmTeal;
      case "ai": return day.aiApplied ? R.teal : R.textMid;
      case "override": return day.hasOverride ? R.warmTeal : R.textDim;
      case "target": return day.hasOverride ? R.warmTeal : R.textDim;
      default: return R.text;
    }
  };

  const COL_W = 96;
  const LABEL_W = 180;
  const ROW_H = 44;

  return (
    <div style={{ height: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>Vilenza Hotel</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: R.textMid }}>14 Apr – 13 May</span>
              <ChevronDown size={12} color={R.textMid} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: R.textMid }}>30 nights</span>
              <ChevronDown size={12} color={R.textMid} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={{
              background: "transparent", color: R.textMid, border: `1px solid ${R.border}`, borderRadius: 6,
              padding: "6px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>
              2 changes pending
            </button>
            <button style={{
              background: R.teal, color: R.darkBand, border: "none", borderRadius: 6,
              padding: "6px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              Submit
            </button>
            <Bell size={16} color={R.textMid} />
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: "20px 32px 12px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 6 }}>Pricing</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: R.accent, margin: 0, letterSpacing: -0.5 }}>My Rates</h1>
        </div>

        {/* Flowcast */}
        <div style={{ margin: "0 32px 20px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: R.teal }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: R.accent, textTransform: "uppercase", letterSpacing: "0.05em" }}>Flowcast</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: R.textDim, background: "rgba(52,208,104,0.1)", border: "1px solid rgba(52,208,104,0.3)", padding: "2px 8px", borderRadius: 4, fontWeight: 600, color: R.green }}>Pickup: +14</span>
              <span style={{ fontSize: 10, color: R.textDim, background: "rgba(78,88,104,0.1)", border: "1px solid rgba(78,88,104,0.3)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>30D AVG: 74%</span>
              <span style={{ fontSize: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: "2px 8px", borderRadius: 4, fontWeight: 600, color: R.red }}>Min Rate Days: 3</span>
              <div style={{ display: "flex", background: "#0C0E12", borderRadius: 4, padding: 2, border: `1px solid ${R.border}` }}>
                {["90D", "180D", "365D"].map((label, i) => (
                  <button key={label} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 2, border: "none", cursor: "pointer", background: i === 0 ? R.border : "transparent", color: i === 0 ? R.accent : R.textDim, fontWeight: i === 0 ? 600 : 400 }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Chart area */}
          <div style={{ padding: 20 }}>
            <div style={{ position: "relative", height: 180, background: "#0C0E12", borderRadius: 4, border: `1px solid ${R.border}`, overflow: "hidden" }}>
              {/* Y-axis left (occupancy) */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 40, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "8px 0 24px" }}>
                {[100, 75, 50, 25].map(v => (
                  <div key={v} style={{ textAlign: "right", paddingRight: 6 }}>
                    <span style={{ fontSize: 9, color: "rgba(57,189,248,0.6)", fontFamily: "monospace" }}>{v}%</span>
                  </div>
                ))}
              </div>
              {/* Y-axis right (rate) */}
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 44, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "8px 0 24px" }}>
                {["£280", "£210", "£140", "£70"].map(v => (
                  <div key={v} style={{ textAlign: "left", paddingLeft: 6 }}>
                    <span style={{ fontSize: 9, color: "rgba(200,166,110,0.6)", fontFamily: "monospace" }}>{v}</span>
                  </div>
                ))}
              </div>
              {/* Bars */}
              <div style={{ position: "absolute", left: 40, right: 44, top: 8, bottom: 24, display: "flex", alignItems: "flex-end", gap: 2 }}>
                {days.map(day => {
                  const barH = Math.min(day.occ, 100);
                  const pickupH = Math.round(Math.random() * 12);
                  const hasPickup = day.i % 3 === 0;
                  return (
                    <div key={day.i} style={{ flex: 1, height: "100%", position: "relative", display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", height: `${barH}%`, background: R.border, position: "relative" }}>
                        {hasPickup && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: `${pickupH}%`, background: R.teal }} />}
                      </div>
                      {/* PMS rate dot */}
                      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: 3, background: "white", border: "1px solid #0C0E12", bottom: `${Math.round(40 + Math.sin(day.i * 0.3) * 20)}%`, zIndex: 10 }} />
                      {/* AI rate dot */}
                      {day.i % 2 === 0 && <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: 3, background: R.teal, border: "1px solid #0C0E12", bottom: `${Math.round(45 + Math.sin(day.i * 0.25) * 22)}%`, zIndex: 5 }} />}
                    </div>
                  );
                })}
              </div>
              {/* X-axis */}
              <div style={{ position: "absolute", left: 40, right: 44, bottom: 0, height: 20, display: "flex", alignItems: "center", borderTop: `1px solid ${R.border}` }}>
                {days.filter((_, i) => i % 7 === 0).map(day => (
                  <div key={day.i} style={{ flex: 7, textAlign: "center" }}>
                    <span style={{ fontSize: 9, color: R.textDim }}>{day.dayNum} {day.monthLabel}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 12, borderTop: `1px solid ${R.border}`, paddingTop: 12 }}>
              {[
                { type: "box", color: R.border, label: "Occupancy" },
                { type: "box", color: R.teal, label: "Pickup" },
                { type: "dot", color: "white", label: "PMS Rate" },
                { type: "dot", color: R.teal, label: "Sentinel AI Rate" },
                { type: "line", color: R.red, label: "Min Rate" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {item.type === "box" && <div style={{ width: 10, height: 10, background: item.color, borderRadius: 2 }} />}
                  {item.type === "dot" && <div style={{ width: 6, height: 6, background: item.color, borderRadius: 3, border: `1px solid ${R.border}` }} />}
                  {item.type === "line" && <div style={{ width: 12, height: 2, background: item.color }} />}
                  <span style={{ fontSize: 11, color: R.textMid, textTransform: "uppercase" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rate Grid */}
        <div style={{ flex: 1, overflow: "hidden", margin: "0 32px 20px", background: R.card, border: `1px solid ${R.border}`, borderRadius: 8 }}>
          <div style={{ overflow: "auto", height: "100%" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "fit-content" }}>
              {/* Date header */}
              <thead>
                <tr>
                  <th style={{
                    position: "sticky", left: 0, zIndex: 10, background: R.card,
                    width: LABEL_W, minWidth: LABEL_W, borderRight: `1px solid ${R.border}`,
                    borderBottom: `1px solid ${R.border}`, padding: "0 20px", textAlign: "left", height: 64,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Metric</span>
                  </th>
                  {days.map(day => (
                    <th
                      key={day.i}
                      onMouseEnter={() => setHoveredCol(day.i)}
                      onMouseLeave={() => setHoveredCol(null)}
                      style={{
                        width: COL_W, minWidth: COL_W, borderBottom: `1px solid ${R.border}`,
                        padding: "10px 0", textAlign: "center", verticalAlign: "bottom", height: 64,
                        background: hoveredCol === day.i ? "rgba(57,189,248,0.04)" : "transparent",
                      }}
                    >
                      <div style={{ fontSize: 9, color: R.textDim }}>{day.monthLabel}</div>
                      <div style={{ fontSize: 9, color: day.isWknd ? R.warmTeal : R.textDim, marginTop: 1 }}>{day.dayName}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: R.accent, marginTop: 2 }}>{day.dayNum}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  // Divider row
                  if (row.section === "divider") {
                    return (
                      <tr key={row.key}>
                        <td style={{ position: "sticky", left: 0, zIndex: 10, background: R.card, borderRight: `1px solid ${R.border}`, height: 10 }} />
                        {days.map(day => (
                          <td key={day.i} style={{ height: 10, background: hoveredCol === day.i ? "rgba(57,189,248,0.04)" : "transparent" }}
                            onMouseEnter={() => setHoveredCol(day.i)} onMouseLeave={() => setHoveredCol(null)} />
                        ))}
                      </tr>
                    );
                  }

                  // Section-specific styling
                  const isAi = row.section === "ai";
                  const isEditable = row.section === "editable";
                  const isSource = row.key === "source";

                  // Label styling — only editable rows are bold
                  const labelColor = isEditable ? R.warmTeal : isAi ? R.teal : R.textMid;
                  const labelWeight = isEditable ? 600 : 400;

                  // Row left border for emphasis
                  const leftBorder = isEditable ? `3px solid ${R.warmTeal}` : isAi ? `3px solid ${R.teal}` : "3px solid transparent";

                  // Row background tint
                  const rowBg = isEditable ? "rgba(56,198,186,0.03)" : isAi ? "rgba(57,189,248,0.03)" : "transparent";

                  return (
                    <tr key={row.key}>
                      <td style={{
                        position: "sticky", left: 0, zIndex: 10, background: R.card,
                        borderRight: `1px solid ${R.border}`, borderBottom: `1px solid ${R.sep}`,
                        borderLeft: leftBorder,
                        padding: "0 20px", height: ROW_H, fontSize: 13, color: labelColor, fontWeight: labelWeight,
                      }}>
                        {row.label}
                      </td>
                      {days.map(day => {
                        const val = cellVal(row.key, day);
                        const color = cellColor(row.key, day);
                        const colHover = hoveredCol === day.i ? "rgba(57,189,248,0.04)" : "transparent";

                        return (
                          <td
                            key={day.i}
                            onMouseEnter={() => setHoveredCol(day.i)}
                            onMouseLeave={() => setHoveredCol(null)}
                            style={{
                              width: COL_W, minWidth: COL_W, height: ROW_H,
                              borderBottom: `1px solid ${R.sep}`,
                              textAlign: "center", verticalAlign: "middle",
                              padding: "0 4px",
                              background: `${rowBg}`,
                              // Layer hover on top
                              ...(hoveredCol === day.i ? { background: `rgba(57,189,248,0.04)` } : {}),
                            }}
                          >
                            {isSource ? (
                              <span style={{
                                fontSize: 9, fontWeight: 600, letterSpacing: 0.3,
                                color, textTransform: "uppercase",
                              }}>
                                {val}
                              </span>
                            ) : (
                              <span style={{
                                fontSize: 13,
                                fontWeight: isEditable ? 600 : 400,
                                color,
                                fontVariantNumeric: "tabular-nums",
                              }}>
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}
