import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import { R } from "../../../styles/tokens";

// ── Mason & Fifth — Sales Flash mockup ──
// Layout mirrors the WB Sales Flash spreadsheet (Westbourne Park, MAR-26).
// Static mock numbers — pulled from the actual report so users recognise it.
// Export button is a placeholder; wiring comes later.
//
// Design intent:
//  - One thing per row should pop: the Actuals figure, in white.
//  - Everything else (PM / PY / Budget) sits in muted grey as supporting context.
//  - Deltas live in subtle red/green pills, not raw colored text — reduces
//    the "every cell shouting" feeling of the dense Excel grid.
//  - Gold is reserved for section titles + the "Actuals" column ribbon, so
//    the eye knows where the answer lives.
//  - Subtotal rows get a left accent bar to break up scrolling.

type Hotel = { id: string; name: string };
const HOTELS: Hotel[] = [
  { id: "wb", name: "Westbourne Park" },
  { id: "ph", name: "Primrose Hill" },
  { id: "bmy", name: "Bermondsey" },
];

const fmt = (v: number, dp = 0) =>
  `£${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: dp })}`;
const fmtNum = (v: number, dp = 0) =>
  (v ?? 0).toLocaleString(undefined, { maximumFractionDigits: dp });

// ─────────────────────────────────────────────────────────────────────
//  Shared design primitives
// ─────────────────────────────────────────────────────────────────────

// Quiet, monochrome by default. Colour only earns a place on deltas, and
// even there it's desaturated. No coloured lane backgrounds, no chips,
// no left accent bars — the layout itself does the talking.
const ZEBRA = "rgba(255,255,255,0.012)";
const ACTUALS_LANE = "transparent"; // (was a gold ribbon — kept as a no-op to avoid touching every section)
const SUBTOTAL_BG = "transparent"; // (was a teal subtotal tint — same)

const cellBase: React.CSSProperties = {
  fontSize: 11,
  padding: "6px 10px",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 400,
};
const labelCell: React.CSSProperties = {
  fontSize: 11,
  padding: "6px 12px",
  textAlign: "left",
  color: R.text,
  fontWeight: 400,
  whiteSpace: "nowrap",
};
const headerCell: React.CSSProperties = {
  ...cellBase,
  fontSize: 9,
  color: R.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: 500,
  paddingTop: 6,
  paddingBottom: 8,
};

// Flat-text delta. No chip, no border, no background.
function DeltaChip({ pct }: { pct: number | null | undefined; size?: "sm" | "md" }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return <span style={{ color: R.textDim, fontSize: 11 }}>—</span>;
  }
  if (Math.abs(pct) < 0.1) {
    return <span style={{ color: R.textDim, fontSize: 11 }}>—</span>;
  }
  const up = pct > 0;
  return (
    <span
      style={{
        color: up ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
        fontSize: 11,
        fontWeight: 400,
      }}
    >
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Top bar
// ─────────────────────────────────────────────────────────────────────
function TopBar({
  hotel,
  onChangeHotel,
  reportDate,
}: {
  hotel: Hotel;
  onChangeHotel: (h: Hotel) => void;
  reportDate: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        padding: "14px 28px",
        borderBottom: `1px solid ${R.border}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: R.darkBand,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: 2,
            color: R.gold,
            textTransform: "uppercase",
          }}
        >
          Sales Flash · WIP
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
            <span style={{ fontSize: 13, color: R.text, fontWeight: 400, flex: 1, textAlign: "left" }}>
              {hotel.name}
            </span>
            <ChevronDown size={14} color={R.textMid} style={{ transform: open ? "rotate(180deg)" : "none" }} />
          </button>
          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 220,
                  background: R.cardRaised,
                  border: `1px solid ${R.border}`,
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 11,
                }}
              >
                {HOTELS.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      onChangeHotel(h);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 5,
                      border: "none",
                      background: h.id === hotel.id ? "rgba(56,198,186,0.12)" : "transparent",
                      color: h.id === hotel.id ? R.warmTeal : R.text,
                      fontSize: 12,
                      fontWeight: h.id === hotel.id ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 400 }}>
            Report
          </span>
          <span style={{ fontSize: 11.5, color: R.gold, fontWeight: 400 }}>{reportDate}</span>
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
          fontWeight: 400,
          cursor: "not-allowed",
          opacity: 0.6,
        }}
      >
        <Download size={14} /> Export Excel
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Section wrapper — clearer title hierarchy
// ─────────────────────────────────────────────────────────────────────
function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, color: R.text, fontWeight: 500, letterSpacing: 0.1 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: R.textDim, fontWeight: 400 }}>{subtitle}</div>
        )}
      </div>
      <div
        style={{
          background: R.darkBand,
          border: `1px solid ${R.border}`,
          borderRadius: 8,
          padding: 18,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "'Inter', system-ui, sans-serif",
          overflowX: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SubBlockTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 10 }}>
      <div style={{ fontSize: 11, color: R.text, fontWeight: 500 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10.5, color: R.textDim, fontWeight: 400 }}>{subtitle}</div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 1: CURRENT MONTH SUMMARY
// ═════════════════════════════════════════════════════════════════════

interface SummaryRow {
  label: string;
  priorMonth: number;
  priorYear: number;
  budget: number;
  actuals: number;
  vsPrMonthPct: number | null;
  vsPriorYearPct: number | null;
  vsBudgetPct: number | null;
  emphasis?: boolean;
  isCurrency?: boolean;
  isPercent?: boolean;
  unit?: string;
}

const REVENUE_ROWS: SummaryRow[] = [
  { label: "Short Stay Revenue £ net", priorMonth: 231526, priorYear: 231526, budget: 383222, actuals: 317159, vsPrMonthPct: 37.0, vsPriorYearPct: 37.0, vsBudgetPct: -17.2, isCurrency: true },
  { label: "Mid Stay Revenue £ net", priorMonth: 20546, priorYear: 20546, budget: 0, actuals: 28508, vsPrMonthPct: 38.8, vsPriorYearPct: 38.8, vsBudgetPct: null, isCurrency: true },
  { label: "Long Stay Revenue £ net", priorMonth: 323449, priorYear: 323449, budget: 587148, actuals: 316063, vsPrMonthPct: -2.3, vsPriorYearPct: -2.3, vsBudgetPct: -46.2, isCurrency: true },
  { label: "Total Accommodation Revenue £ net", priorMonth: 575520, priorYear: 575520, budget: 970370, actuals: 661730, vsPrMonthPct: 15.0, vsPriorYearPct: 15.0, vsBudgetPct: -31.8, emphasis: true, isCurrency: true },
  { label: "CANAL Revenue £ net", priorMonth: 136595, priorYear: 136595, budget: 106757, actuals: 32112, vsPrMonthPct: -76.5, vsPriorYearPct: -76.5, vsBudgetPct: -69.9, isCurrency: true },
  { label: "MEADOW Revenue £ net", priorMonth: 20805, priorYear: 20805, budget: 48815, actuals: 17731, vsPrMonthPct: -14.8, vsPriorYearPct: -14.8, vsBudgetPct: -63.7, isCurrency: true },
  { label: "GROUNDING Revenue £ net", priorMonth: 4366, priorYear: 4366, budget: 12500, actuals: 1447, vsPrMonthPct: -66.8, vsPriorYearPct: -66.8, vsBudgetPct: -88.4, isCurrency: true },
  { label: "Total Ancillary Revenue £ net", priorMonth: 161766, priorYear: 161766, budget: 168072, actuals: 51290, vsPrMonthPct: -68.3, vsPriorYearPct: -68.3, vsBudgetPct: -69.5, emphasis: true, isCurrency: true },
  { label: "Total Revenue £ net", priorMonth: 737285, priorYear: 737285, budget: 1138442, actuals: 713020, vsPrMonthPct: -3.3, vsPriorYearPct: -3.3, vsBudgetPct: -37.4, emphasis: true, isCurrency: true },
];

const KPI_ROWS: SummaryRow[] = [
  { label: "Occupancy % blended", priorMonth: 60.3, priorYear: 60.3, budget: 89.9, actuals: 65.0, vsPrMonthPct: 4.7, vsPriorYearPct: -24.9, vsBudgetPct: -24.9, isPercent: true },
  { label: "SS ADR £ net", priorMonth: 139.20, priorYear: 139.20, budget: 170, actuals: 138.72, vsPrMonthPct: -0.3, vsPriorYearPct: -18.4, vsBudgetPct: -18.4, isCurrency: true },
  { label: "MS & LS AMR £ net", priorMonth: 2786.76, priorYear: 2786.76, budget: 2508, actuals: 2712.04, vsPrMonthPct: -2.7, vsPriorYearPct: 8.1, vsBudgetPct: 8.1, isCurrency: true },
  { label: "Rev PAR £ net", priorMonth: 139.20, priorYear: 139.20, budget: 170, actuals: 138.72, vsPrMonthPct: -0.3, vsPriorYearPct: -18.4, vsBudgetPct: -18.4, isCurrency: true },
  { label: "SS ALOS (Days)", priorMonth: 2.49, priorYear: 2.49, budget: 4, actuals: 2.66, vsPrMonthPct: 7.1, vsPriorYearPct: -33.4, vsBudgetPct: -33.4, unit: " d" },
  { label: "MS ALOS (Days)", priorMonth: 54.69, priorYear: 54.69, budget: 0, actuals: 52.5, vsPrMonthPct: -4.0, vsPriorYearPct: null, vsBudgetPct: null, unit: " d" },
  { label: "LS ALOS (Months)", priorMonth: 8.42, priorYear: 8.42, budget: 6, actuals: 8.63, vsPrMonthPct: 2.5, vsPriorYearPct: 43.9, vsBudgetPct: 43.9, unit: " mo" },
  { label: "SS Direct Booking %", priorMonth: 32.9, priorYear: 68.2, budget: 75, actuals: 31.6, vsPrMonthPct: -1.3, vsPriorYearPct: -53.7, vsBudgetPct: -57.9, isPercent: true },
  { label: "SS Indirect Booking %", priorMonth: 63.5, priorYear: 31.6, budget: 25, actuals: 66.2, vsPrMonthPct: 4.7, vsPriorYearPct: 109.5, vsBudgetPct: 164.8, isPercent: true },
];

function fmtCell(v: number, row: SummaryRow): string {
  if (row.isCurrency) return fmt(v, v < 1000 ? 2 : 0);
  if (row.isPercent) return `${v.toFixed(1)}%`;
  if (row.unit) return `${v.toFixed(2)}${row.unit}`;
  return fmtNum(v, 1);
}

function SummaryTable({ title, rows }: { title: string; rows: SummaryRow[] }) {
  const grid = "minmax(220px, 2fr) 92px 92px 92px 100px 84px 84px 84px";
  return (
    <div style={{ minWidth: 880 }}>
      <SubBlockTitle title={title} />

      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
        <div />
        <div style={headerCell}>Prior Mo</div>
        <div style={headerCell}>Prior Yr</div>
        <div style={headerCell}>Budget</div>
        <div style={headerCell}>Actuals</div>
        <div style={headerCell}>vs Pr.Mo</div>
        <div style={headerCell}>vs PY</div>
        <div style={headerCell}>vs Bud</div>
      </div>

      {rows.map((row, i) => {
        const zebra = i % 2 === 1 && !row.emphasis;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: grid,
              background: zebra ? ZEBRA : "transparent",
              borderTop: row.emphasis ? `1px solid ${R.sep}` : "none",
              alignItems: "center",
            }}
          >
            <div
              style={{
                ...labelCell,
                color: row.emphasis ? R.text : R.textMid,
                fontWeight: row.emphasis ? 500 : 400,
              }}
            >
              {row.label}
            </div>
            <div style={{ ...cellBase, color: R.textDim }}>{fmtCell(row.priorMonth, row)}</div>
            <div style={{ ...cellBase, color: R.textDim }}>{fmtCell(row.priorYear, row)}</div>
            <div style={{ ...cellBase, color: R.textDim }}>{row.budget === 0 ? "—" : fmtCell(row.budget, row)}</div>
            <div style={{ ...cellBase, color: row.emphasis ? R.text : R.textMid }}>
              {fmtCell(row.actuals, row)}
            </div>
            <div style={{ ...cellBase }}>
              <DeltaChip pct={row.vsPrMonthPct} />
            </div>
            <div style={{ ...cellBase }}>
              <DeltaChip pct={row.vsPriorYearPct} />
            </div>
            <div style={{ ...cellBase }}>
              <DeltaChip pct={row.vsBudgetPct} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 2: ANNUALISED VS BUDGET
// ═════════════════════════════════════════════════════════════════════

const FY_MONTHS = ["Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26"];

const ANNUALISED = {
  occActual: [40.8, 54.9, 50.1, 81.9, 78.7, 81.3, 82.1, 62.2, 60.3, 65.0],
  occBudget: [31.3, 36.3, 44.4, 54.9, 61.8, 68.8, 81.0, 79.8, 85.7, 89.9],
  totalActual: [255532, 702079, 533059, 899464, 829157, 882367, 939385, 577838, 575520, 661730],
  totalBudget: [108156, 483692, 474849, 626631, 700618, 697439, 886871, 760544, 851173, 970370],
  totalAnnualActual: 6856130,
  totalAnnualBudget: 6560344,
  annualVariance: 295787,
};

function AnnualisedTable() {
  const grid = `minmax(180px, 1.5fr) repeat(${FY_MONTHS.length}, minmax(78px, 1fr)) 110px`;
  const occAchievement = ANNUALISED.occActual.map((a, i) => a / ANNUALISED.occBudget[i]);
  const revAchievement = ANNUALISED.totalActual.map((a, i) => a / ANNUALISED.totalBudget[i]);
  const variance = ANNUALISED.totalActual.map((a, i) => a - ANNUALISED.totalBudget[i]);

  const Header = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: grid,
        borderBottom: `1px solid ${R.border}`,
      }}
    >
      <div />
      {FY_MONTHS.map((m) => (
        <div key={m} style={{ ...headerCell, padding: "6px 8px" }}>{m}</div>
      ))}
      <div
        style={{
          ...headerCell,
          padding: "6px 8px",
          color: R.textDim,
          background: ACTUALS_LANE,
          fontWeight: 500,
        }}
      >
        TOTAL
      </div>
    </div>
  );

  const renderBlock = (
    blockTitle: string,
    actualRow: { values: string[]; total: string },
    budgetRow: { values: string[]; total: string },
    achievementRow: { raw: number[]; values: string[]; total: string; totalRaw: number },
    extraRow?: { label: string; values: string[]; total: string; raw: number[]; totalRaw: number },
  ) => (
    <div style={{ marginBottom: 4 }}>
      <div style={{ padding: "16px 0 6px", display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 11, color: R.text, fontWeight: 500 }}>
          {blockTitle}
        </div>
      </div>
      {/* Actual */}
      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}` }}>
        <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 400 }}>Actual</div>
        {actualRow.values.map((v, i) => (
          <div key={i} style={{ ...cellBase, padding: "5px 8px", color: R.text, fontWeight: 400 }}>{v}</div>
        ))}
        <div style={{ ...cellBase, padding: "5px 8px", background: ACTUALS_LANE, color: R.text, fontWeight: 500, fontSize: 12 }}>
          {actualRow.total}
        </div>
      </div>
      {/* Budget */}
      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}`, background: ZEBRA }}>
        <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 400 }}>Budget</div>
        {budgetRow.values.map((v, i) => (
          <div key={i} style={{ ...cellBase, padding: "5px 8px", color: R.textMid }}>{v}</div>
        ))}
        <div style={{ ...cellBase, padding: "5px 8px", background: ACTUALS_LANE, color: R.textMid, fontWeight: 400 }}>
          {budgetRow.total}
        </div>
      </div>
      {/* Achievement */}
      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}` }}>
        <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 400 }}>% Ach.</div>
        {achievementRow.values.map((v, i) => (
          <div
            key={i}
            style={{
              ...cellBase,
              padding: "5px 8px",
              color: achievementRow.raw[i] >= 1 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
              fontWeight: 400,
            }}
          >
            {v}
          </div>
        ))}
        <div
          style={{
            ...cellBase,
            padding: "5px 8px",
            background: ACTUALS_LANE,
            color: achievementRow.totalRaw >= 1 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
            fontWeight: 500,
          }}
        >
          {achievementRow.total}
        </div>
      </div>
      {extraRow && (
        <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}`, background: ZEBRA }}>
          <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 400 }}>{extraRow.label}</div>
          {extraRow.raw.map((v, i) => (
            <div
              key={i}
              style={{
                ...cellBase,
                padding: "5px 8px",
                color: v >= 0 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
                fontWeight: 400,
              }}
            >
              {extraRow.values[i]}
            </div>
          ))}
          <div
            style={{
              ...cellBase,
              padding: "5px 8px",
              background: ACTUALS_LANE,
              color: extraRow.totalRaw >= 0 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
              fontWeight: 500,
            }}
          >
            {extraRow.total}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minWidth: 1100 }}>
      {Header}

      {renderBlock(
        "Occupancy % blended",
        {
          values: ANNUALISED.occActual.map((v) => `${v.toFixed(1)}%`),
          total: `${(ANNUALISED.occActual.reduce((s, v) => s + v, 0) / ANNUALISED.occActual.length).toFixed(1)}%`,
        },
        {
          values: ANNUALISED.occBudget.map((v) => `${v.toFixed(1)}%`),
          total: `${(ANNUALISED.occBudget.reduce((s, v) => s + v, 0) / ANNUALISED.occBudget.length).toFixed(1)}%`,
        },
        {
          raw: occAchievement,
          values: occAchievement.map((v) => `${(v * 100).toFixed(0)}%`),
          total: `${((ANNUALISED.occActual.reduce((s, v) => s + v, 0) / ANNUALISED.occBudget.reduce((s, v) => s + v, 0)) * 100).toFixed(0)}%`,
          totalRaw: ANNUALISED.occActual.reduce((s, v) => s + v, 0) / ANNUALISED.occBudget.reduce((s, v) => s + v, 0),
        },
      )}

      {renderBlock(
        "Total Revenue £ net",
        {
          values: ANNUALISED.totalActual.map((v) => fmt(v / 1000) + "k"),
          total: fmt(ANNUALISED.totalAnnualActual / 1_000_000, 2) + "M",
        },
        {
          values: ANNUALISED.totalBudget.map((v) => fmt(v / 1000) + "k"),
          total: fmt(ANNUALISED.totalAnnualBudget / 1_000_000, 2) + "M",
        },
        {
          raw: revAchievement,
          values: revAchievement.map((v) => `${(v * 100).toFixed(0)}%`),
          total: `${((ANNUALISED.totalAnnualActual / ANNUALISED.totalAnnualBudget) * 100).toFixed(0)}%`,
          totalRaw: ANNUALISED.totalAnnualActual / ANNUALISED.totalAnnualBudget,
        },
        {
          label: "Variance £",
          raw: variance,
          values: variance.map((v) => (v >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(v) / 1000) + "k"),
          total: (ANNUALISED.annualVariance >= 0 ? "▲ " : "▼ ") + fmt(Math.abs(ANNUALISED.annualVariance)),
          totalRaw: ANNUALISED.annualVariance,
        },
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 3: BOB & BUSINESS DONE
// ═════════════════════════════════════════════════════════════════════

function BobBusinessDone() {
  const bob = { ss: 606827, ms: 73951, ls: 907424 };
  const fy = { ss: 606827, ms: 73951, ls: 907424 };
  const fyBudget = 3118640;
  const fyVariance = fy.ss + fy.ms + fy.ls - fyBudget;

  const Card = ({
    badge,
    title,
    subtitle,
    rows,
    footer,
  }: {
    badge: string;
    title: string;
    subtitle: string;
    rows: { label: string; value: number }[];
    footer?: { label: string; value: number; isVariance?: boolean }[];
  }) => {
    const total = rows.reduce((s, r) => s + r.value, 0);
    return (
      <div style={{ flex: 1, padding: 22 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: R.textDim,
            marginBottom: 6,
          }}
        >
          {badge}
        </div>
        <div style={{ fontSize: 13, color: R.text, fontWeight: 400, letterSpacing: -0.1 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: R.textDim, marginTop: 3, marginBottom: 16 }}>{subtitle}</div>

        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: `1px solid ${R.sep}`,
              background: i % 2 === 1 ? ZEBRA : "transparent",
              paddingLeft: 4,
              paddingRight: 4,
            }}
          >
            <span style={{ fontSize: 12, color: R.text }}>{r.label}</span>
            <span style={{ fontSize: 13, color: R.text, fontWeight: 400 }}>{fmt(r.value)}</span>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 4px 6px",
            marginTop: 6,
            }}
        >
          <span style={{ fontSize: 11, color: R.textDim, fontWeight: 400, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</span>
          <span style={{ fontSize: 16, color: R.text, fontWeight: 500 }}>{fmt(total)}</span>
        </div>

        {footer?.map((f) => (
          <div
            key={f.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "5px 4px",
            }}
          >
            <span style={{ fontSize: 10.5, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 400 }}>
              {f.label}
            </span>
            {f.isVariance ? (
              <DeltaChip pct={(f.value / fyBudget) * 100} />
            ) : (
              <span style={{ fontSize: 12, color: R.textMid, fontWeight: 400 }}>{fmt(f.value)}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        background: R.darkBand,
        overflow: "hidden",
      }}
    >
      <Card
        badge="Future"
        title="Business On The Books"
        subtitle="Booked business beyond the financial year"
        rows={[
          { label: "Short Stay Revenue £ net", value: bob.ss },
          { label: "Mid Stay Revenue £ net", value: bob.ms },
          { label: "Long Stay Revenue £ net", value: bob.ls },
        ]}
      />
      <div style={{ borderLeft: `1px solid ${R.border}` }}>
        <Card
          badge="FY-to-Date"
          title="Total Business Done"
          subtitle="Revenue consumed & booked YTD, including current month"
          rows={[
            { label: "Short Stay Revenue £ net", value: fy.ss },
            { label: "Mid Stay Revenue £ net", value: fy.ms },
            { label: "Long Stay Revenue £ net", value: fy.ls },
          ]}
          footer={[
            { label: "Accom Revenue Budget £", value: fyBudget },
            { label: "Variance vs Budget", value: fyVariance, isVariance: true },
          ]}
        />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 4: PACING REPORT VS BUDGET
// ═════════════════════════════════════════════════════════════════════

interface PacingBlock {
  title: string;
  subtitle: string;
  metrics: {
    name: string;
    actual: number[];
    budget: number[];
    fmt: (v: number) => string;
  }[];
}

const PACING_BLOCKS: PacingBlock[] = [
  {
    title: "Short Stay  · <1 month",
    subtitle: "Daily-rate inventory: nights / revenue / ADR vs budget",
    metrics: [
      {
        name: "Total Nights Booked",
        actual: [1671, 3906, 2419, 3304, 2235, 2719, 3464, 1661, 1732, 2388],
        budget: [900, 3720, 3420, 3482, 2620, 2100, 2325, 1743, 1801, 2058],
        fmt: (v) => v.toLocaleString(),
      },
      {
        name: "Revenue £ net",
        actual: [220790, 543712, 291410, 481773, 331855, 437254, 556087, 216929, 231526, 317159],
        budget: [60786, 325793, 253792, 342415, 353242, 286903, 405764, 237447, 296467, 383222],
        fmt: (v) => fmt(v / 1000) + "k",
      },
      {
        name: "ADR £ net",
        actual: [135.20, 143.20, 132.03, 149.88, 152.00, 160.73, 158.95, 131.12, 139.20, 138.72],
        budget: [174.49, 173.59, 129.13, 156.04, 162.22, 138.82, 170.01, 131, 139, 170],
        fmt: (v) => fmt(v, 0),
      },
    ],
  },
  {
    title: "Mid Stay  · 1–3 months",
    subtitle: "In-house room count + revenue + AMR (avg monthly rate)",
    metrics: [
      {
        name: "In-House at Month-end",
        actual: [0, 2, 28, 59, 77, 32, 20, 14, 13, 16],
        budget: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        fmt: (v) => v.toString(),
      },
      {
        name: "Revenue £ net",
        actual: [0, 29084, 55924, 108296, 119748, 58750, 35605, 23033, 20546, 28508],
        budget: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        fmt: (v) => fmt(v / 1000) + "k",
      },
      {
        name: "AMR £ net",
        actual: [0, 0, 0, 0, 2930, 2814, 2782, 2955, 3020, 2944],
        budget: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        fmt: (v) => fmt(v, 0),
      },
    ],
  },
  {
    title: "Long Stay  · 3 months+",
    subtitle: "In-house room count + revenue + AMR vs budget",
    metrics: [
      {
        name: "In-House at Month-end",
        actual: [35, 74, 98, 152, 171, 166, 162, 163, 145, 163],
        budget: [19, 62, 87, 112, 137, 162, 187, 212, 224, 237],
        fmt: (v) => v.toString(),
      },
      {
        name: "Revenue £ net",
        actual: [34742, 129283, 185725, 309395, 377555, 386363, 347692, 337876, 323449, 316063],
        budget: [47370, 157898, 221058, 284217, 347376, 410536, 481107, 523097, 554706, 587148],
        fmt: (v) => fmt(v / 1000) + "k",
      },
      {
        name: "AMR £ net",
        actual: [2631, 2606, 2637, 2611, 2588, 2584, 2576, 2560, 2553, 2480],
        budget: [2537, 2537, 2537, 2537, 2537, 2537, 2477, 2487, 2498, 2508],
        fmt: (v) => fmt(v, 0),
      },
    ],
  },
];

function PacingReport() {
  const grid = `minmax(170px, 1.4fr) repeat(${FY_MONTHS.length}, minmax(72px, 1fr)) 100px`;
  return (
    <div style={{ minWidth: 1100 }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
        <div />
        {FY_MONTHS.map((m) => (
          <div key={m} style={{ ...headerCell, padding: "6px 6px" }}>{m}</div>
        ))}
        <div
          style={{
            ...headerCell,
            padding: "6px 6px",
            color: R.textDim,
            background: ACTUALS_LANE,
              fontWeight: 500,
          }}
        >
          TOTAL
        </div>
      </div>

      {PACING_BLOCKS.map((block) => (
        <div key={block.title} style={{ marginBottom: 8 }}>
          <div style={{ padding: "16px 0 6px" }}>
            <SubBlockTitle title={block.title} subtitle={block.subtitle} />
          </div>

          {block.metrics.map((m) => {
            const actualTotal = m.actual.reduce((s, v) => s + v, 0);
            const budgetTotal = m.budget.reduce((s, v) => s + v, 0);
            return (
              <div key={m.name} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid,
                    padding: "6px 0 2px",
                    fontSize: 11,
                    color: R.text,
                    fontWeight: 400,
                    letterSpacing: 0.1,
                  }}
                >
                  <div style={{ paddingLeft: 12 }}>{m.name}</div>
                </div>
                {/* Actual */}
                <div style={{ display: "grid", gridTemplateColumns: grid, padding: "4px 0", borderBottom: `1px solid ${R.sep}` }}>
                  <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 400 }}>Actual</div>
                  {m.actual.map((v, i) => (
                    <div key={i} style={{ ...cellBase, padding: "4px 6px", color: R.text, fontWeight: 400 }}>
                      {v === 0 ? "—" : m.fmt(v)}
                    </div>
                  ))}
                  <div style={{ ...cellBase, padding: "4px 6px", background: ACTUALS_LANE, color: R.text, fontWeight: 500, fontSize: 12 }}>
                    {actualTotal === 0 ? "—" : m.fmt(actualTotal)}
                  </div>
                </div>
                {/* Budget */}
                <div style={{ display: "grid", gridTemplateColumns: grid, padding: "4px 0", borderBottom: `1px solid ${R.sep}`, background: ZEBRA }}>
                  <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 400 }}>Budget</div>
                  {m.budget.map((v, i) => (
                    <div key={i} style={{ ...cellBase, padding: "4px 6px", color: R.textMid }}>
                      {v === 0 ? "—" : m.fmt(v)}
                    </div>
                  ))}
                  <div style={{ ...cellBase, padding: "4px 6px", background: ACTUALS_LANE, color: R.textMid, fontWeight: 400 }}>
                    {budgetTotal === 0 ? "—" : m.fmt(budgetTotal)}
                  </div>
                </div>
                {/* % achievement */}
                <div style={{ display: "grid", gridTemplateColumns: grid, padding: "4px 0 8px", borderBottom: `1px solid ${R.sep}` }}>
                  <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 400 }}>% Ach.</div>
                  {m.actual.map((a, i) => {
                    const b = m.budget[i];
                    if (!b) return <div key={i} style={{ ...cellBase, padding: "4px 6px", color: R.textDim }}>—</div>;
                    const ach = a / b;
                    return (
                      <div key={i} style={{ ...cellBase, padding: "4px 6px", color: ach >= 1 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)", fontWeight: 400 }}>
                        {(ach * 100).toFixed(0)}%
                      </div>
                    );
                  })}
                  <div
                    style={{
                      ...cellBase,
                      padding: "4px 6px",
                      background: ACTUALS_LANE,
                      color: budgetTotal && actualTotal / budgetTotal >= 1 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
                      fontWeight: 500,
                    }}
                  >
                    {budgetTotal ? `${((actualTotal / budgetTotal) * 100).toFixed(0)}%` : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 5: WEEKLY UNIT PACING
// ═════════════════════════════════════════════════════════════════════

const WEEKS = ["02 Mar", "09 Mar", "16 Mar", "23 Mar", "30 Mar"];
const UNIT_PACING = [
  { label: "Short Stay", values: [59.4, 85.6, 57.4, 84.1, 62.7], pcts: [17.9, 25.8, 17.3, 25.3, 18.9], color: "#7BAFD4" },
  { label: "Mid Stay", values: [8.6, 9.4, 7.0, 5.7, 6.3], pcts: [2.6, 2.8, 2.1, 1.7, 1.9], color: R.gold },
  { label: "Long Stay", values: [130.7, 127.6, 131.9, 130.6, 131.9], pcts: [39.4, 38.4, 39.7, 39.3, 39.7], color: R.warmTeal },
  { label: "Subtotal", values: [198.7, 222.6, 196.3, 220.4, 200.9], pcts: [59.9, 67.0, 59.1, 66.4, 60.5], emphasis: true },
  { label: "Offline", values: [7.3, 6.6, 5.0, 5.0, 5.1], pcts: [2.2, 2.0, 1.5, 1.5, 1.5], color: R.textDim },
  { label: "Vacant", values: [126.0, 102.9, 130.7, 106.6, 126.0], pcts: [38.0, 31.0, 39.4, 32.1, 38.0], color: R.red },
];

function WeeklyUnitPacing() {
  const grid = `minmax(160px, 1fr) ${WEEKS.map(() => "minmax(110px, 1fr)").join(" ")}`;
  return (
    <div style={{ minWidth: 720 }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
        <div style={{ ...headerCell, textAlign: "left" }}>Week beginning</div>
        {WEEKS.map((w) => (
          <div key={w} style={{ ...headerCell }}>{w}</div>
        ))}
      </div>
      {UNIT_PACING.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: grid,
            borderBottom: `1px solid ${R.sep}`,
            background: row.emphasis ? SUBTOTAL_BG : i % 2 === 1 ? ZEBRA : "transparent",
            borderLeft: row.emphasis ? `2px solid ${R.warmTeal}` : "2px solid transparent",
            alignItems: "center",
          }}
        >
          <div style={{ ...labelCell, color: row.emphasis ? R.accent : R.text, fontWeight: row.emphasis ? 700 : 500 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 2,
                background: row.color || R.textDim,
                marginRight: 8,
                verticalAlign: "middle",
              }}
            />
            {row.label}
          </div>
          {row.values.map((v, i2) => (
            <div key={i2} style={{ ...cellBase, padding: "8px 12px" }}>
              <div style={{ color: R.text, fontWeight: 400, fontSize: 12 }}>{v.toFixed(1)}</div>
              <div style={{ fontSize: 10, color: R.textMid, marginTop: 1 }}>{row.pcts[i2].toFixed(1)}%</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 6: ACCOMMODATION BOOKINGS
// ═════════════════════════════════════════════════════════════════════

const SS_WEEKLY_DATES = ["19 Jan", "26 Jan", "02 Feb", "09 Feb", "16 Feb", "23 Feb", "02 Mar", "09 Mar"];
const SS_WEEKLY = {
  bookings: [287, 217, 201, 196, 193, 182, 180, 184],
  nights: [762, 510, 505, 458, 457, 495, 471, 535],
  revenue: [100918, 76039, 76719, 70533, 71232, 79109, 77623, 92726],
  adr: [132.44, 149.10, 151.92, 154.00, 155.87, 159.82, 164.80, 173.32],
};

function SSWeeklyTable() {
  const grid = `minmax(180px, 1.5fr) ${SS_WEEKLY_DATES.map(() => "minmax(76px, 1fr)").join(" ")}`;
  const rows = [
    { label: "Total Bookings", values: SS_WEEKLY.bookings.map((v) => v.toLocaleString()), bold: false },
    { label: "Total Nights Booked", values: SS_WEEKLY.nights.map((v) => v.toLocaleString()), bold: false },
    { label: "Total Revenue Booked £", values: SS_WEEKLY.revenue.map((v) => fmt(v / 1000) + "k"), bold: true },
    { label: "Booked ADR £", values: SS_WEEKLY.adr.map((v) => fmt(v, 0)), bold: false },
  ];
  return (
    <div style={{ minWidth: 800 }}>
      <SubBlockTitle title="Short Stay — Weekly Bookings Made" subtitle="8-week trailing" />
      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
        <div style={{ ...headerCell, textAlign: "left" }}>Week ending</div>
        {SS_WEEKLY_DATES.map((d) => (
          <div key={d} style={{ ...headerCell, padding: "6px 8px" }}>{d}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: "grid",
            gridTemplateColumns: grid,
            borderBottom: `1px solid ${R.sep}`,
            background: i % 2 === 1 ? ZEBRA : "transparent",
            alignItems: "center",
          }}
        >
          <div style={{ ...labelCell, color: r.bold ? R.accent : R.text, fontWeight: r.bold ? 600 : 500 }}>{r.label}</div>
          {r.values.map((v, idx) => (
            <div key={idx} style={{ ...cellBase, padding: "6px 8px", color: r.bold ? R.accent : R.textMid, fontWeight: r.bold ? 700 : 500 }}>
              {v}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const LS_DEALS_DATES = ["19 Jan", "26 Jan", "02 Feb", "09 Feb", "16 Feb", "23 Feb", "02 Mar", "09 Mar"];
const LS_DEALS = {
  weekly: [8, 2, 10, 5, 4, 6, 7, 3],
  nine_plus: [1, 1, 2, 2, 1, 4, 0, 1],
  six_to_nine: [0, 1, 5, 0, 1, 1, 4, 0],
  three_to_six: [3, 0, 1, 3, 1, 0, 0, 2],
  one_to_three: [4, 0, 2, 0, 1, 1, 3, 0],
  ls_revenue: [58365, 40147, 174189, 67780, 56566, 119293, 63945, 49853],
  ms_revenue: [12008, 0, 0, 0, 2142, 5426, 13748, 0],
  combined: [70373, 40147, 174189, 67780, 58708, 124719, 77693, 49853],
  allTime: { weekly: 384, nine_plus: 68, six_to_nine: 91, three_to_six: 96, one_to_three: 129, ls_revenue: 4766937, ms_revenue: 232958, combined: 5245228 },
};

function LSDealsTable() {
  const grid = `minmax(220px, 1.6fr) ${LS_DEALS_DATES.map(() => "minmax(64px, 1fr)").join(" ")} 110px`;
  const rows = [
    { label: "LS Weekly Bookings", values: LS_DEALS.weekly, allTime: LS_DEALS.allTime.weekly, fmt: (v: number) => v.toString(), bold: true, indent: 0 },
    { label: "9+ Month Bookings", values: LS_DEALS.nine_plus, allTime: LS_DEALS.allTime.nine_plus, fmt: (v: number) => v.toString(), indent: 1 },
    { label: "6–9 Month Bookings", values: LS_DEALS.six_to_nine, allTime: LS_DEALS.allTime.six_to_nine, fmt: (v: number) => v.toString(), indent: 1 },
    { label: "3–6 Month Bookings", values: LS_DEALS.three_to_six, allTime: LS_DEALS.allTime.three_to_six, fmt: (v: number) => v.toString(), indent: 1 },
    { label: "1–3 Month Bookings", values: LS_DEALS.one_to_three, allTime: LS_DEALS.allTime.one_to_three, fmt: (v: number) => v.toString(), indent: 1 },
    { label: "LS Weekly Revenue £", values: LS_DEALS.ls_revenue, allTime: LS_DEALS.allTime.ls_revenue, fmt: (v: number) => v === 0 ? "—" : fmt(v / 1000) + "k", bold: true, indent: 0 },
    { label: "MS Weekly Revenue £", values: LS_DEALS.ms_revenue, allTime: LS_DEALS.allTime.ms_revenue, fmt: (v: number) => v === 0 ? "—" : fmt(v / 1000) + "k", indent: 0 },
    { label: "MS & LS Combined £", values: LS_DEALS.combined, allTime: LS_DEALS.allTime.combined, fmt: (v: number) => v === 0 ? "—" : fmt(v / 1000) + "k", bold: true, emphasis: true, indent: 0 },
  ];
  return (
    <div style={{ minWidth: 920 }}>
      <SubBlockTitle title="Long Stay — Weekly New Deals Made" subtitle="Extensions excluded · split by booking-window tier" />
      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
        <div style={{ ...headerCell, textAlign: "left" }}>Week ending</div>
        {LS_DEALS_DATES.map((d) => (
          <div key={d} style={{ ...headerCell, padding: "6px 6px" }}>{d}</div>
        ))}
        <div
          style={{
            ...headerCell,
            padding: "6px 6px",
            color: R.textDim,
            background: ACTUALS_LANE,
              fontWeight: 500,
          }}
        >
          ALL TIME
        </div>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: "grid",
            gridTemplateColumns: grid,
            borderBottom: `1px solid ${R.sep}`,
            background: r.emphasis ? SUBTOTAL_BG : i % 2 === 1 ? ZEBRA : "transparent",
            borderLeft: r.emphasis ? `2px solid ${R.warmTeal}` : "2px solid transparent",
            alignItems: "center",
          }}
        >
          <div
            style={{
              ...labelCell,
              paddingLeft: r.indent ? 28 : 12,
              color: r.emphasis ? R.accent : r.bold ? R.text : R.textMid,
              fontWeight: r.bold ? 700 : 500,
              textTransform: r.emphasis ? "uppercase" : "none",
              letterSpacing: r.emphasis ? 0.4 : 0,
              fontSize: r.emphasis ? 11 : 11.5,
            }}
          >
            {r.label}
          </div>
          {r.values.map((v, idx) => (
            <div
              key={idx}
              style={{
                ...cellBase,
                padding: "6px 6px",
                color: r.bold ? R.accent : R.textMid,
                fontWeight: r.bold ? 700 : 500,
              }}
            >
              {r.fmt(v)}
            </div>
          ))}
          <div
            style={{
              ...cellBase,
              padding: "6px 8px",
              color: R.textMid,
              fontWeight: 500,
            }}
          >
            {r.fmt(r.allTime)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  SECTION 7: ANCILLARIES
// ═════════════════════════════════════════════════════════════════════

const ANCILLARY_BLOCKS = [
  {
    title: "CANAL Restaurant",
    subtitle: "Net revenue, guest count & spend per head",
    rows: [
      { name: "Revenue £ net", actual: [11937, 164513, 188171, 176386, 175941, 164006, 158390, 131807, 136595, 32112], budget: [60434, 73044, 84282, 87904, 95520, 93398, 101138, 95520, 94399, 106757], fmt: (v: number) => fmt(v / 1000) + "k", bold: true },
      { name: "Guests Consumed", actual: [1313, 6886, 7107, 7073, 6742, 7322, 6166, 5612, 6273, 1435], budget: [2028, 2395, 2967, 3598, 4289, 4874, 5691, 3860, 3641, 4559], fmt: (v: number) => v.toLocaleString() },
      { name: "Av. SPH £ net", actual: [9.09, 23.89, 26.48, 24.94, 25.59, 22.40, 25.69, 23.49, 21.78, 22.38], budget: [22, 22, 22, 22, 22, 22, 22, 22, 22, 22], fmt: (v: number) => fmt(v, 2) },
    ],
  },
  {
    title: "MEADOW Workspace",
    subtitle: "Co-working desk revenue",
    rows: [
      { name: "Revenue £ net", actual: [3500, 12300, 14200, 18900, 21800, 19400, 17900, 18200, 20805, 17731], budget: [15000, 18000, 22000, 25000, 30000, 35000, 40000, 42000, 45000, 48815], fmt: (v: number) => fmt(v / 1000) + "k", bold: true },
    ],
  },
  {
    title: "GROUNDING Wellness",
    subtitle: "Treatments + retail",
    rows: [
      { name: "Revenue £ net", actual: [800, 2100, 2800, 3400, 3900, 4100, 3800, 4200, 4366, 1447], budget: [3000, 4500, 6000, 7500, 9000, 10000, 11000, 11500, 12000, 12500], fmt: (v: number) => fmt(v) },
    ],
  },
];

function AncillariesTable() {
  const grid = `minmax(180px, 1.5fr) repeat(${FY_MONTHS.length}, minmax(72px, 1fr)) 110px`;
  return (
    <div style={{ minWidth: 1100 }}>
      <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
        <div />
        {FY_MONTHS.map((m) => (
          <div key={m} style={{ ...headerCell, padding: "6px 8px" }}>{m}</div>
        ))}
        <div
          style={{
            ...headerCell,
            padding: "6px 8px",
          }}
        >
          TOTAL
        </div>
      </div>

      {ANCILLARY_BLOCKS.map((block) => (
        <div key={block.title} style={{ marginBottom: 8 }}>
          <div style={{ padding: "16px 0 6px" }}>
            <SubBlockTitle title={block.title} subtitle={block.subtitle} />
          </div>
          {block.rows.map((r) => {
            const actualTotal = r.actual.reduce((s, v) => s + v, 0);
            const budgetTotal = r.budget.reduce((s, v) => s + v, 0);
            const variance = actualTotal - budgetTotal;
            return (
              <div key={r.name} style={{ marginBottom: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: grid, padding: "6px 0 2px", fontSize: 11, color: R.text, fontWeight: 400 }}>
                  <div style={{ paddingLeft: 12 }}>{r.name}</div>
                </div>
                {/* Actual */}
                <div style={{ display: "grid", gridTemplateColumns: grid, padding: "4px 0", borderBottom: `1px solid ${R.sep}` }}>
                  <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 400 }}>Actual</div>
                  {r.actual.map((v, i) => (
                    <div key={i} style={{ ...cellBase, padding: "4px 8px", color: R.text, fontWeight: 400 }}>{r.fmt(v)}</div>
                  ))}
                  <div style={{ ...cellBase, padding: "4px 8px", background: ACTUALS_LANE, color: R.text, fontWeight: 500, fontSize: 12 }}>
                    {r.fmt(actualTotal)}
                  </div>
                </div>
                {/* Budget */}
                <div style={{ display: "grid", gridTemplateColumns: grid, padding: "4px 0", borderBottom: `1px solid ${R.sep}`, background: ZEBRA }}>
                  <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 400 }}>Budget</div>
                  {r.budget.map((v, i) => (
                    <div key={i} style={{ ...cellBase, padding: "4px 8px", color: R.textMid }}>{r.fmt(v)}</div>
                  ))}
                  <div style={{ ...cellBase, padding: "4px 8px", background: ACTUALS_LANE, color: R.textMid, fontWeight: 400 }}>
                    {r.fmt(budgetTotal)}
                  </div>
                </div>
                {/* Variance — only shown for the bold (revenue) row */}
                {r.bold && (
                  <div style={{ display: "grid", gridTemplateColumns: grid, padding: "4px 0 8px", borderBottom: `1px solid ${R.sep}` }}>
                    <div style={{ ...labelCell, paddingLeft: 22, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 400 }}>Δ vs Bud</div>
                    {r.actual.map((a, i) => {
                      const v = a - r.budget[i];
                      const pct = r.budget[i] > 0 ? (v / r.budget[i]) * 100 : null;
                      return (
                        <div key={i} style={{ ...cellBase, padding: "4px 6px" }}>
                          <DeltaChip pct={pct} size="sm" />
                        </div>
                      );
                    })}
                    <div
                      style={{
                        ...cellBase,
                        padding: "4px 8px",
                        background: ACTUALS_LANE,
                      }}
                    >
                      <DeltaChip pct={budgetTotal > 0 ? (variance / budgetTotal) * 100 : null} size="sm" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
//  ROOT
// ═════════════════════════════════════════════════════════════════════

export function MasonSalesFlash() {
  const [hotel, setHotel] = useState<Hotel>(HOTELS[0]);

  return (
    <div style={{ flex: 1, background: R.bg, color: R.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <TopBar hotel={hotel} onChangeHotel={setHotel} reportDate="09 Mar 2026" />

      <div style={{ padding: "28px 32px" }}>
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 28,
            background: "rgba(200,166,110,0.06)",
            border: `1px solid ${R.gold}33`,
            borderRadius: 6,
            color: R.gold,
            fontSize: 11,
            letterSpacing: 0.3,
          }}
        >
          Mockup · numbers seeded from the live MAR-26 Westbourne report. Backend wiring + Excel export shipping after layout sign-off.
        </div>

        <Section title="Current Month Summary" subtitle={`MAR-26 · ${hotel.name}`}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
            <SummaryTable title="Summary Revenues — Monthly" rows={REVENUE_ROWS} />
            <SummaryTable title="Accommodation KPIs" rows={KPI_ROWS} />
          </div>
        </Section>

        <Section title="Annualised vs Budget" subtitle="FY Jun 25 → Mar 26">
          <AnnualisedTable />
        </Section>

        <Section title="BOB & Business Done" subtitle="Future booked vs total business done YTD">
          <BobBusinessDone />
        </Section>

        <Section title="Pacing Report — vs Budget" subtitle="Short Stay (daily-rate) · Mid Stay · Long Stay">
          <PacingReport />
        </Section>

        <Section title="Weekly Unit Pacing" subtitle="Inventory by service across the trailing 5 weeks">
          <WeeklyUnitPacing />
        </Section>

        <Section title="Accommodation Bookings" subtitle="Short Stay weekly · Long Stay new deals">
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <SSWeeklyTable />
            <LSDealsTable />
          </div>
        </Section>

        <Section title="Ancillary Services" subtitle="Restaurant · Workspace · Wellness">
          <AncillariesTable />
        </Section>
      </div>
    </div>
  );
}
