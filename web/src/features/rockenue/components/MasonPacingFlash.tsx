import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { R } from "../../../styles/tokens";

// ── Mason & Fifth — Pacing Flash mockup ──
// Mirrors the Pacing Flash spreadsheet layout. Three properties, 5 KPI blocks
// (Revenue · Room Nights · RevPAR · ADR · Occupancy), 13 months Jun→Jun.
// Per KPI: Last Pacing Report · Current OTB · Forecast · Final Month LY ·
// Same Time LY · % vs STLY · % vs LPR (with arrow indicators).
// Numbers are mock — seeded from the actual WB MASTER report (12.09.25).
// Export button is a placeholder; wiring comes later.

type Property = { id: string; name: string };
const PROPERTIES: Property[] = [
  { id: "wb", name: "Westbourne Park" },
  { id: "ph", name: "Primrose Hill" },
  { id: "bmy", name: "Bermondsey" },
];

const MONTHS = [
  "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25",
  "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26",
];

const fmt = (v: number, dp = 0) =>
  (v ?? 0).toLocaleString(undefined, { maximumFractionDigits: dp });

interface KpiBlock {
  name: string;
  unit: "currency" | "count" | "currencyPerNight" | "percent";
  rows: {
    lpr: number[];
    otb: number[];
    forecast: number[];
    finalLY: number[];
    stly: number[];
    pctVsLPR: number[]; // signed % deltas (positive ▲, negative ▼, 0 →)
    pctVsSTLY?: (number | null)[]; // optional, mostly null in source spreadsheet
  };
}

// ── Westbourne Park — seeded from WB MASTER (12.09.25) ──────────────
const WB_BLOCKS: KpiBlock[] = [
  {
    name: "Revenue",
    unit: "currency",
    rows: {
      lpr: [234313, 633746, 468463, 750813, 400965, 282200, 230522, 168952, 120623, 100048, 76627, 81360, 61146],
      otb: [234313, 633746, 468463, 751148, 405363, 286236, 232568, 167136, 118983, 98310, 74920, 79006, 60539],
      forecast: [234313, 633746, 468463, 865251, 969220, 1156279, 1276491, 1274437, 1153568, 1174380, 1047062, 1152357, 1106457],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 234313],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 0.04, 1.1, 1.4, 0.9, -1.1, -1.4, -1.7, -2.2, -2.9, -1.0],
    },
  },
  {
    name: "Room Nights",
    unit: "count",
    rows: {
      lpr: [2075, 5011, 4563, 6846, 4559, 3429, 2774, 2148, 1552, 1293, 974, 1010, 768],
      otb: [2075, 5011, 4563, 6835, 4583, 3459, 2783, 2117, 1524, 1263, 950, 979, 760],
      forecast: [2075, 5011, 4563, 7597, 8561, 8946, 9386, 9263, 8247, 8775, 8389, 8793, 8587],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2075],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, -0.2, 0.5, 0.9, 0.3, -1.4, -1.8, -2.3, -2.5, -3.1, -1.0],
    },
  },
  {
    name: "RevPAR",
    unit: "currencyPerNight",
    rows: {
      lpr: [55, 107, 62, 80, 41, 30, 24, 18, 14, 11, 8, 9, 7],
      otb: [55, 107, 62, 81, 42, 31, 24, 18, 14, 10, 8, 8, 7],
      forecast: [55, 107, 62, 93, 100, 124, 133, 135, 136, 125, 114, 121, 121],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 1.3, 2.4, 3.3, 0, 0, 0, -9.1, 0, -11.1, 0],
    },
  },
  {
    name: "ADR",
    unit: "currencyPerNight",
    rows: {
      lpr: [113, 126, 103, 110, 88, 82, 83, 79, 78, 77, 79, 81, 80],
      otb: [113, 126, 103, 110, 88, 83, 84, 79, 78, 78, 79, 81, 80],
      forecast: [113, 126, 103, 114, 113, 129, 136, 138, 140, 134, 125, 131, 129],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 113],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 0, 0, 1.2, 1.2, 0, 0, 1.3, 0, 0, 0],
    },
  },
  {
    name: "Occupancy",
    unit: "percent",
    rows: {
      lpr: [49, 85, 60, 73, 47, 37, 29, 23, 18, 14, 11, 11, 8],
      otb: [49, 85, 60, 73, 47, 37, 29, 22, 18, 13, 10, 10, 8],
      forecast: [49, 85, 60, 82, 89, 96, 98, 98, 97, 93, 91, 93, 94],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 0, 0, 0, 0, -4.3, 0, -7.1, -9.1, -9.1, 0],
    },
  },
];

// ── Primrose Hill — synthetic but proportionally smaller (60-room property) ──
const PH_BLOCKS: KpiBlock[] = [
  {
    name: "Revenue",
    unit: "currency",
    rows: {
      lpr: [42500, 105800, 78200, 132400, 71800, 51200, 41700, 30600, 21400, 17900, 13800, 14600, 11000],
      otb: [42500, 105800, 78200, 132800, 72600, 51900, 42100, 30200, 21100, 17500, 13400, 14200, 10800],
      forecast: [42500, 105800, 78200, 152500, 173400, 207200, 228600, 228200, 206500, 210400, 187500, 206300, 198100],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 42500],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 0.3, 1.1, 1.4, 1.0, -1.3, -1.4, -2.2, -2.9, -2.7, -1.8],
    },
  },
  {
    name: "Room Nights",
    unit: "count",
    rows: {
      lpr: [378, 905, 824, 1240, 824, 622, 504, 390, 281, 235, 178, 184, 140],
      otb: [378, 905, 824, 1238, 829, 627, 506, 384, 277, 230, 173, 178, 138],
      forecast: [378, 905, 824, 1380, 1551, 1620, 1700, 1681, 1495, 1591, 1521, 1594, 1557],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 378],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, -0.2, 0.6, 0.8, 0.4, -1.5, -1.4, -2.1, -2.8, -3.3, -1.4],
    },
  },
  {
    name: "RevPAR",
    unit: "currencyPerNight",
    rows: {
      lpr: [56, 109, 64, 82, 42, 31, 25, 19, 14, 12, 9, 9, 7],
      otb: [56, 109, 64, 83, 43, 32, 25, 18, 14, 11, 9, 9, 7],
      forecast: [56, 109, 64, 95, 102, 126, 135, 137, 138, 127, 116, 123, 123],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 56],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 1.2, 2.4, 3.2, 0, 0, 0, -8.3, 0, 0, 0],
    },
  },
  {
    name: "ADR",
    unit: "currencyPerNight",
    rows: {
      lpr: [115, 128, 105, 112, 90, 84, 85, 81, 80, 79, 81, 83, 82],
      otb: [115, 128, 105, 112, 90, 84, 85, 81, 80, 80, 81, 83, 82],
      forecast: [115, 128, 105, 116, 115, 132, 139, 141, 143, 137, 128, 134, 132],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 115],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.3, 0, 0, 0],
    },
  },
  {
    name: "Occupancy",
    unit: "percent",
    rows: {
      lpr: [49, 85, 60, 73, 47, 37, 29, 23, 18, 14, 11, 11, 8],
      otb: [49, 85, 60, 73, 47, 37, 29, 22, 18, 13, 10, 10, 8],
      forecast: [49, 85, 60, 82, 89, 96, 98, 98, 97, 93, 91, 93, 94],
      finalLY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49],
      stly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      pctVsLPR: [0, 0, 0, 0, 0, 0, 0, -4.3, 0, -7.1, -9.1, -9.1, 0],
    },
  },
];

const BMY_BLOCKS: KpiBlock[] = WB_BLOCKS.map((b) => ({
  ...b,
  rows: {
    ...b.rows,
    lpr: b.rows.lpr.map((v) => Math.round(v * 0.55)),
    otb: b.rows.otb.map((v) => Math.round(v * 0.55)),
    forecast: b.rows.forecast.map((v) => Math.round(v * 0.55)),
    finalLY: b.rows.finalLY.map((v) => Math.round(v * 0.55)),
    stly: b.rows.stly.map((v) => Math.round(v * 0.55)),
  },
}));

const BLOCKS_BY_PROPERTY: Record<string, KpiBlock[]> = {
  wb: WB_BLOCKS,
  ph: PH_BLOCKS,
  bmy: BMY_BLOCKS,
};

// ── Helpers ─────────────────────────────────────────────────────────
function arrowFor(p: number | null | undefined) {
  if (p === null || p === undefined || !isFinite(p) || Math.abs(p) < 0.05)
    return { sym: "→", col: R.textDim };
  return p > 0 ? { sym: "↑", col: R.green } : { sym: "↓", col: R.red };
}

function fmtBlock(v: number, unit: KpiBlock["unit"]) {
  if (v === 0) return "—";
  if (unit === "currency") {
    if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 10_000) return `£${(v / 1000).toFixed(0)}k`;
    if (v >= 1000) return `£${(v / 1000).toFixed(1)}k`;
    return `£${v}`;
  }
  if (unit === "currencyPerNight") return `£${fmt(v)}`;
  if (unit === "percent") return `${v}%`;
  return fmt(v);
}

// ── Top bar ─────────────────────────────────────────────────────────
function TopBar({
  property,
  onChange,
  reportDate,
  prevReportDate,
}: {
  property: Property;
  onChange: (p: Property) => void;
  reportDate: string;
  prevReportDate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>
          Pacing Flash · WIP
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: R.cardRaised,
              border: `1px solid ${open ? R.warmTeal : R.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              minWidth: 220,
            }}
          >
            <span style={{ fontSize: 13, color: R.accent, fontWeight: 600, flex: 1, textAlign: "left" }}>{property.name}</span>
            <ChevronDown size={14} color={R.textMid} style={{ transform: open ? "rotate(180deg)" : "none" }} />
          </button>
          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 220, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8, padding: 4, zIndex: 11 }}>
                {PROPERTIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onChange(p);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 5,
                      border: "none",
                      background: p.id === property.id ? "rgba(56,198,186,0.12)" : "transparent",
                      color: p.id === property.id ? R.warmTeal : R.text,
                      fontSize: 12,
                      fontWeight: p.id === property.id ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
          <div>
            <div style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 9 }}>This report</div>
            <div style={{ color: R.gold, fontWeight: 600 }}>{reportDate}</div>
          </div>
          <div>
            <div style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 9 }}>Last report</div>
            <div style={{ color: R.textMid, fontWeight: 500 }}>{prevReportDate}</div>
          </div>
        </div>
      </div>

      <button
        disabled
        title="Excel export — coming soon"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          background: R.cardRaised,
          border: `1px solid ${R.border}`,
          borderRadius: 6,
          color: R.textDim,
          fontSize: 12,
          fontWeight: 600,
          cursor: "not-allowed",
          opacity: 0.6,
        }}
      >
        <Download size={14} /> Export Excel
      </button>
    </div>
  );
}

// ── KPI block ───────────────────────────────────────────────────────

const cellBase: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 6px",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const labelCell: React.CSSProperties = {
  fontSize: 10,
  padding: "4px 12px",
  textAlign: "left",
  color: R.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

function KpiBlockView({ block }: { block: KpiBlock }) {
  const grid = `minmax(150px, 1.3fr) repeat(${MONTHS.length}, minmax(60px, 1fr))`;
  const valueRows: { label: string; values: number[]; color: string; bold?: boolean; unitSwap?: boolean }[] = [
    { label: "Last Pacing Report", values: block.rows.lpr, color: R.textMid },
    { label: "Current OTB", values: block.rows.otb, color: R.gold, bold: true },
    { label: "Forecast", values: block.rows.forecast, color: R.warmTeal },
    { label: "Final Month LY", values: block.rows.finalLY, color: R.textDim },
    { label: "Same Time LY", values: block.rows.stly, color: R.textDim },
  ];

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 16, marginBottom: 18, overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{block.name}</div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>OTB vs Forecast vs Last Pacing Report · % Δ vs LPR · STLY pending LY data</div>
        </div>
      </div>

      <div style={{ minWidth: 1100 }}>
        <div style={{ display: "grid", gridTemplateColumns: grid, padding: "8px 0", borderBottom: `1px solid ${R.border}`, fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          <div />
          {MONTHS.map((m) => (
            <div key={m} style={{ ...cellBase }}>{m}</div>
          ))}
        </div>

        {valueRows.map((row) => (
          <div key={row.label} style={{ display: "grid", gridTemplateColumns: grid, padding: "3px 0", borderBottom: `1px solid ${R.sep}` }}>
            <div style={{ ...labelCell }}>{row.label}</div>
            {row.values.map((v, i) => (
              <div key={i} style={{ ...cellBase, color: row.color, fontWeight: row.bold ? 700 : 500 }}>
                {fmtBlock(v, block.unit)}
              </div>
            ))}
          </div>
        ))}

        {/* % vs LPR */}
        <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}`, background: "rgba(56,198,186,0.04)" }}>
          <div style={{ ...labelCell, color: R.warmTeal }}>% vs Last Report</div>
          {block.rows.pctVsLPR.map((p, i) => {
            const a = arrowFor(p);
            return (
              <div key={i} style={{ ...cellBase, color: a.col, fontWeight: 600 }}>
                {a.sym} {Math.abs(p).toFixed(1)}%
              </div>
            );
          })}
        </div>

        {/* % vs STLY (mostly placeholder until LY data accumulates) */}
        <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0" }}>
          <div style={{ ...labelCell, color: R.gold }}>% vs Same Time LY</div>
          {MONTHS.map((_, i) => {
            const stly = block.rows.stly[i];
            const otb = block.rows.otb[i];
            if (!stly || stly === 0) {
              return <div key={i} style={{ ...cellBase, color: R.textDim }}>—</div>;
            }
            const p = ((otb - stly) / stly) * 100;
            const a = arrowFor(p);
            return (
              <div key={i} style={{ ...cellBase, color: a.col, fontWeight: 600 }}>
                {a.sym} {Math.abs(p).toFixed(1)}%
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Booking pulse — simple 8-week stay-month attribution mock ───────

const PULSE_WEEKS = ["19 Jan", "26 Jan", "02 Feb", "09 Feb", "16 Feb", "23 Feb", "02 Mar", "09 Mar"];
const PULSE_DATA: Record<string, { newBookings: number[]; cancellations: number[]; revenue: number[] }> = {
  "Mar 26": { newBookings: [42, 28, 35, 22, 18, 14, 12, 8], cancellations: [3, 2, 5, 1, 2, 3, 1, 1], revenue: [62000, 41000, 53400, 33800, 27500, 21600, 18200, 12300] },
  "Apr 26": { newBookings: [22, 31, 28, 35, 41, 38, 32, 24], cancellations: [1, 2, 1, 3, 2, 1, 2, 1], revenue: [38000, 52800, 47700, 58900, 68200, 62100, 53400, 41200] },
  "May 26": { newBookings: [12, 18, 22, 25, 28, 31, 35, 38], cancellations: [0, 1, 1, 0, 2, 1, 1, 2], revenue: [22000, 31200, 38400, 43600, 48800, 53800, 60100, 65300] },
  "Jun 26": { newBookings: [8, 12, 14, 18, 22, 24, 28, 31], cancellations: [0, 0, 1, 0, 1, 0, 1, 1], revenue: [15000, 22500, 26100, 33200, 40400, 43900, 51200, 56700] },
};

function BookingPulse() {
  const [stayMonth, setStayMonth] = useState("Mar 26");
  const data = PULSE_DATA[stayMonth];
  const totalRev = data.revenue.reduce((s, v) => s + v, 0);
  const totalBkg = data.newBookings.reduce((s, v) => s + v, 0);
  const totalCxl = data.cancellations.reduce((s, v) => s + v, 0);
  const grid = `minmax(180px, 1.4fr) ${PULSE_WEEKS.map(() => "minmax(70px, 1fr)").join(" ")} 90px`;

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 16, marginBottom: 18, overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Booking Pulse
          </div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
            New bookings · cancellations · revenue picked up by week of booking, attributed to stay month
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 6 }}>
          {Object.keys(PULSE_DATA).map((m) => (
            <button
              key={m}
              onClick={() => setStayMonth(m)}
              style={{
                padding: "5px 12px",
                fontSize: 10,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: stayMonth === m ? R.warmTeal : "transparent",
                color: stayMonth === m ? R.darkBand : R.textDim,
                fontWeight: stayMonth === m ? 700 : 500,
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div style={{ minWidth: 800 }}>
        <div style={{ display: "grid", gridTemplateColumns: grid, padding: "8px 0", borderBottom: `1px solid ${R.border}`, fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          <div style={{ paddingLeft: 12 }}>Week ending</div>
          {PULSE_WEEKS.map((w) => (
            <div key={w} style={{ ...cellBase }}>{w}</div>
          ))}
          <div style={{ ...cellBase, color: R.gold }}>TOTAL</div>
        </div>

        {[
          { label: "New Bookings", values: data.newBookings, total: totalBkg, color: R.gold, fmt: (v: number) => v.toString(), bold: true },
          { label: "Cancellations", values: data.cancellations, total: totalCxl, color: R.red, fmt: (v: number) => v === 0 ? "—" : `−${v}` },
          { label: "Revenue Picked Up £", values: data.revenue, total: totalRev, color: R.warmTeal, fmt: (v: number) => `£${(v / 1000).toFixed(0)}k`, bold: true },
        ].map((r) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}` }}>
            <div style={{ ...labelCell, color: R.text, fontSize: 11, textTransform: "none", letterSpacing: 0 }}>{r.label}</div>
            {r.values.map((v, i) => (
              <div key={i} style={{ ...cellBase, color: r.color, fontWeight: r.bold ? 700 : 500 }}>{r.fmt(v)}</div>
            ))}
            <div style={{ ...cellBase, color: r.color, fontWeight: 700 }}>{r.fmt(r.total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  ROOT
// ═════════════════════════════════════════════════════════════════════

export function MasonPacingFlash() {
  const [property, setProperty] = useState<Property>(PROPERTIES[0]);
  const blocks = BLOCKS_BY_PROPERTY[property.id];

  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <TopBar property={property} onChange={setProperty} reportDate="09 Mar 2026" prevReportDate="02 Mar 2026" />

      <div style={{ padding: "24px 28px" }}>
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 22,
            background: "rgba(200,166,110,0.06)",
            border: `1px solid ${R.gold}33`,
            borderRadius: 6,
            color: R.gold,
            fontSize: 11,
            letterSpacing: 0.3,
          }}
        >
          Mockup · numbers seeded from the live WB MASTER (12.09.25). STLY columns will start populating once a year of pacing snapshots is on file.
        </div>

        {blocks.map((b) => (
          <KpiBlockView key={b.name} block={b} />
        ))}

        <BookingPulse />
      </div>
    </div>
  );
}
