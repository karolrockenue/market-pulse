import { useMemo, useState } from "react";
import { ChevronDown, Bell, Search, Lock, ArrowDown, Check } from "lucide-react";
import { MPSidebar } from "./MPSidebar";

// ── MP My Rates — Rockenue style mockup ──

interface MPMyRatesProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", surface: "#121519", recessed: "#0C0E12",
  border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  blue: "#39BDF8", gold: "#C8A66E", green: "#34D068", red: "#ef4444",
  amber: "#f59e0b",
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
    const minRate = Math.round(95 + (isWknd ? 15 : 0));
    const liveRate = Math.round(135 + (isWknd ? 28 : 0) + Math.sin(i * 0.4) * 10);
    const aiRate = Math.round(142 + (isWknd ? 32 : 0) + Math.sin(i * 0.3) * 14);
    const sellRate = Math.round(liveRate * 0.82);
    const hasOverride = [5, 12, 18, 22].includes(i);
    const aiApplied = [7, 8, 14, 15, 20, 21].includes(i);
    return {
      i, dow, isFrozen, occ, adr, minRate, liveRate, aiRate, sellRate, hasOverride, aiApplied,
      dayName: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString("en-GB", { month: "short" }),
      status: isFrozen ? "FROZEN" : aiApplied ? "SENTINEL" : hasOverride ? "PENDING" : "SYNC" as string,
    };
  }), []);

  const statusColor = (s: string) => s === "SENTINEL" ? R.blue : s === "FROZEN" ? R.amber : s === "PENDING" ? R.amber : R.textDim;
  const occColor = (v: number) => v >= 80 ? R.green : v >= 60 ? R.amber : R.red;

  // Row definitions
  const rows: { key: string; label: string; section?: string }[] = [
    { key: "status", label: "Rate Source" },
    { key: "occ", label: "Occupancy %" },
    { key: "adr", label: "ADR" },
    { key: "spacer1", label: "", section: "spacer" },
    { key: "min", label: "Min Rate" },
    { key: "live", label: "Live PMS Rate" },
    { key: "sell", label: "Current Sell Rate" },
    { key: "spacer2", label: "", section: "spacer" },
    { key: "ai", label: "Sentinel AI Rate", section: "ai" },
    { key: "spacer3", label: "", section: "spacer" },
    { key: "override", label: "PMS Override", section: "editable" },
    { key: "target", label: "Target Sell Rate", section: "editable" },
  ];

  const ROW_H = 42;
  const LABEL_W = 200;
  const COL_W = 84;

  const cellVal = (row: typeof rows[0], day: typeof days[0]) => {
    switch (row.key) {
      case "status": return day.status;
      case "occ": return `${day.occ}%`;
      case "adr": return fmt(day.adr);
      case "min": return fmt(day.minRate);
      case "live": return fmt(day.liveRate);
      case "sell": return fmt(day.sellRate);
      case "ai": return fmt(day.aiRate);
      case "override": return day.hasOverride ? fmt(day.liveRate + 8) : "\u2014";
      case "target": return day.hasOverride ? fmt(Math.round((day.liveRate + 8) * 0.82)) : "\u2014";
      default: return "";
    }
  };

  const cellColor = (row: typeof rows[0], day: typeof days[0]) => {
    switch (row.key) {
      case "status": return statusColor(day.status);
      case "occ": return occColor(day.occ);
      case "sell": return R.green;
      case "ai": return day.aiApplied ? R.green : R.blue;
      case "override": return day.hasOverride ? R.accent : R.textDim;
      case "target": return day.hasOverride ? R.accent : R.textDim;
      default: return R.text;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", display: "flex" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "24px 40px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.8 }}>My Rates</h1>
              <span style={{ fontSize: 13, color: R.textDim }}>View and manage your daily room rates</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Search size={15} color={R.textDim} style={{ cursor: "pointer" }} />
              <Bell size={15} color={R.textDim} style={{ cursor: "pointer" }} />
            </div>
          </div>
        </div>

        {/* Controls Card */}
        <div style={{ padding: "16px 40px 20px" }}>
          <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderRadius: 10, padding: "20px 24px", display: "flex", alignItems: "flex-end", gap: 16 }}>
            {[
              { label: "Hotel", value: "Vilenza Hotel" },
              { label: "Start Date", value: "14 Apr 2026" },
              { label: "Nights", value: "30" },
              { label: "Compare", value: "vs Yesterday" },
            ].map(ctrl => (
              <div key={ctrl.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{ctrl.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.bg, border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", minWidth: 120 }}>
                  <span style={{ fontSize: 13, color: R.accent }}>{ctrl.value}</span>
                  <ChevronDown size={12} color={R.textDim} />
                </div>
              </div>
            ))}
            <button style={{ background: R.blue, color: R.recessed, border: "none", borderRadius: 6, padding: "9px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Load Rates
            </button>
            <div style={{ flex: 1 }} />
            <button style={{ background: "transparent", color: R.textMid, border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 18px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              2 changes pending
            </button>
          </div>
        </div>

        {/* Rate Grid */}
        <div style={{ flex: 1, overflow: "hidden", margin: "0 40px 20px", background: R.surface, border: `1px solid ${R.border}`, borderRadius: 10 }}>
          <div style={{ overflow: "auto", height: "100%" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "fit-content" }}>
              {/* Date Header Row */}
              <thead>
                <tr>
                  <th style={{
                    position: "sticky", left: 0, zIndex: 20, background: R.surface,
                    width: LABEL_W, minWidth: LABEL_W, borderRight: `1px solid ${R.border}`, borderBottom: `1px solid ${R.border}`,
                    padding: "0 20px", textAlign: "left", height: 64,
                  }}>
                    <span style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Metric</span>
                  </th>
                  {days.map(day => (
                    <th
                      key={day.i}
                      onMouseEnter={() => setHoveredCol(day.i)}
                      onMouseLeave={() => setHoveredCol(null)}
                      style={{
                        width: COL_W, minWidth: COL_W, borderBottom: `1px solid ${R.border}`,
                        padding: "8px 0", textAlign: "center", verticalAlign: "bottom", height: 64,
                        background: hoveredCol === day.i ? `${R.blue}06` : day.isFrozen ? `${R.amber}04` : "transparent",
                        position: "relative",
                      }}
                    >
                      <div style={{ fontSize: 9, color: R.textDim }}>{day.monthLabel}</div>
                      <div style={{ fontSize: 9, color: day.dow === 0 || day.dow === 6 ? R.blue : R.textDim, marginTop: 1 }}>{day.dayName}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: R.accent, marginTop: 2 }}>{day.dayNum}</div>
                      {day.isFrozen && <Lock size={8} color={R.amber} style={{ position: "absolute", top: 6, right: 6 }} />}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  if (row.section === "spacer") {
                    return (
                      <tr key={row.key}>
                        <td style={{ position: "sticky", left: 0, zIndex: 10, background: R.surface, borderRight: `1px solid ${R.border}`, height: 8 }} />
                        {days.map(day => (
                          <td key={day.i} style={{
                            height: 8,
                            background: hoveredCol === day.i ? `${R.blue}06` : day.isFrozen ? `${R.amber}04` : "transparent",
                          }}
                            onMouseEnter={() => setHoveredCol(day.i)}
                            onMouseLeave={() => setHoveredCol(null)}
                          />
                        ))}
                      </tr>
                    );
                  }

                  const isAi = row.section === "ai";
                  const isEditable = row.section === "editable";
                  const labelColor = isAi ? R.blue : isEditable ? R.blue : R.textMid;
                  const labelWeight = isAi || isEditable ? 600 : 400;
                  const rowBgBase = isAi ? `${R.blue}06` : isEditable ? `${R.blue}04` : "transparent";

                  return (
                    <tr key={row.key}>
                      <td style={{
                        position: "sticky", left: 0, zIndex: 10, background: R.surface,
                        borderRight: `1px solid ${R.border}`, borderBottom: `1px solid ${R.sep}`,
                        padding: "0 20px", height: ROW_H, fontSize: 13, color: labelColor, fontWeight: labelWeight,
                        borderTop: isAi ? `1px solid ${R.blue}15` : "none",
                      }}>
                        {row.label}
                      </td>
                      {days.map(day => {
                        const val = cellVal(row, day);
                        const color = cellColor(row, day);
                        const isStatus = row.key === "status";
                        const colBg = hoveredCol === day.i ? `${R.blue}06` : day.isFrozen ? `${R.amber}04` : rowBgBase;

                        return (
                          <td
                            key={day.i}
                            onMouseEnter={() => setHoveredCol(day.i)}
                            onMouseLeave={() => setHoveredCol(null)}
                            style={{
                              width: COL_W, minWidth: COL_W, height: ROW_H,
                              borderBottom: `1px solid ${R.sep}`,
                              borderTop: isAi ? `1px solid ${R.blue}15` : "none",
                              textAlign: "center", verticalAlign: "middle",
                              fontSize: isStatus ? 9 : 13,
                              fontWeight: isStatus ? 700 : isAi ? 600 : 400,
                              fontFamily: isStatus ? "inherit" : "monospace",
                              letterSpacing: isStatus ? 0.5 : 0,
                              textTransform: isStatus ? "uppercase" as const : "none" as const,
                              color,
                              background: colBg,
                              cursor: (isAi && !day.isFrozen && !day.aiApplied) || isEditable ? "pointer" : "default",
                              padding: "0 4px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                              {val}
                              {isAi && day.aiApplied && <Check size={10} color={R.green} />}
                              {isAi && hoveredCol === day.i && !day.isFrozen && !day.aiApplied && <ArrowDown size={10} color={R.blue} />}
                              {isEditable && day.hasOverride && row.key === "override" && (
                                <div style={{ width: 4, height: 4, borderRadius: 2, background: R.amber, flexShrink: 0 }} />
                              )}
                            </div>
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

        {/* Footer */}
        <div style={{ padding: "0 40px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: R.textDim }}>Scroll horizontally to view more dates. Click any blue cell to edit.</span>
          <div style={{ display: "flex", gap: 16, fontSize: 10 }}>
            {[
              { label: "AI Active", color: R.blue },
              { label: "Frozen", color: R.amber },
              { label: "Applied", color: R.green },
              { label: "Override", color: R.amber },
            ].map(l => (
              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: l.color }} />
                <span style={{ color: R.textDim }}>{l.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
