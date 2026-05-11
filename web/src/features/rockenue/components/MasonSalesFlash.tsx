import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, RefreshCw } from "lucide-react";
import { R } from "../../../styles/tokens";
import {
  fetchMasonSalesFlash,
  type SalesFlashResponse,
  type RevenueCell,
  type KpiCell,
} from "../api/mason.api";

// ── Mason & Fifth — Sales Flash (live) ──
// Wired to /api/mason/sales-flash. v1 scope: Westbourne (318341) + Primrose
// (318343). Budget columns are hidden until per-service budgets are uploaded
// via POST /api/mason/budgets/:hotelId. Ancillary blocks (Canal/Meadow/
// Grounding) are deferred — those revenue streams sit largely outside Mews.
// Long Stay ADR is rendered as "Avg Monthly Charge" per Blueprint §15.1
// (Mews bills LS in monthly units, not room-nights).

type Property = { id: string; name: string; hotelId: number };
const PROPERTIES: Property[] = [
  { id: "wb", name: "Westbourne Park", hotelId: 318341 },
  { id: "ph", name: "Primrose Hill", hotelId: 318343 },
];

const fmtGbp = (v: number | null | undefined, dp = 0) => {
  if (v === null || v === undefined || !isFinite(v as number)) return "—";
  return `£${(v as number).toLocaleString(undefined, { maximumFractionDigits: dp })}`;
};
const fmtNum = (v: number | null | undefined, dp = 0) => {
  if (v === null || v === undefined || !isFinite(v as number)) return "—";
  return (v as number).toLocaleString(undefined, { maximumFractionDigits: dp });
};
const fmtPct = (v: number | null | undefined, dp = 1) => {
  if (v === null || v === undefined || !isFinite(v as number)) return "—";
  return `${(v as number).toFixed(dp)}%`;
};

function pctDelta(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr === null || curr === undefined || !isFinite(curr)) return null;
  if (prev === null || prev === undefined || !isFinite(prev) || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  // Cap extreme deltas (caused by tiny denominators — e.g. a single stray
  // £1 in a prior-month value would produce ±50,000% nonsense). Anything
  // beyond ±999% is functionally meaningless; we render it as "—".
  if (Math.abs(pct) > 999) return null;
  return pct;
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

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

function DeltaText({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return <span style={{ color: R.textDim, fontSize: 11 }}>—</span>;
  }
  if (Math.abs(pct) < 0.1) {
    return <span style={{ color: R.textDim, fontSize: 11 }}>—</span>;
  }
  const up = pct > 0;
  return (
    <span style={{ color: up ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)", fontSize: 11 }}>
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function TopBar({
  property,
  onChange,
  monthKey,
  monthOptions,
  onMonthChange,
  asOf,
  loading,
  onRefresh,
}: {
  property: Property;
  onChange: (p: Property) => void;
  monthKey: string;
  monthOptions: { value: string; label: string; tag: string }[];
  onMonthChange: (mk: string) => void;
  asOf: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  return (
    <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: R.darkBand }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>
          Sales Flash
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
                    onClick={() => { onChange(p); setOpen(false); }}
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

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 9 }}>Reporting month</span>
            <button
              onClick={() => setMonthOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: R.cardRaised, border: `1px solid ${monthOpen ? R.warmTeal : R.border}`,
                borderRadius: 6, padding: "6px 12px", cursor: "pointer", minWidth: 140,
              }}
            >
              <span style={{ fontSize: 12, color: R.gold, fontWeight: 600, flex: 1, textAlign: "left" }}>{monthLabel(monthKey)}</span>
              <ChevronDown size={12} color={R.textMid} style={{ transform: monthOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {monthOpen && (
              <>
                <div onClick={() => setMonthOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "auto", right: 0, minWidth: 220, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8, padding: 4, zIndex: 11 }}>
                  {monthOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { onMonthChange(opt.value); setMonthOpen(false); }}
                      style={{
                        width: "100%", padding: "8px 12px", borderRadius: 5, border: "none",
                        background: opt.value === monthKey ? "rgba(56,198,186,0.12)" : "transparent",
                        color: opt.value === monthKey ? R.warmTeal : R.text,
                        fontSize: 12, fontWeight: opt.value === monthKey ? 600 : 500,
                        cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.4 }}>{opt.tag}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {asOf && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 9 }}>As of</span>
              <span style={{ color: R.textMid }}>{asOf}</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", background: R.cardRaised, border: `1px solid ${R.border}`,
            borderRadius: 6, color: loading ? R.textDim : R.warmTeal, fontSize: 12, fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
        <button
          disabled
          title="Excel export — coming soon"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6,
            color: R.textDim, fontSize: 12, fontWeight: 600, cursor: "not-allowed", opacity: 0.6,
          }}
        >
          <Download size={14} /> Export Excel
        </button>
      </div>
    </div>
  );
}

function Section({ title, subtitle, done, children }: { title: string; subtitle?: string; done?: boolean; children: React.ReactNode }) {
  // `done` is a temporary visual marker: tints the whole section green so
  // verified-working areas are easy to skip when scanning for things that
  // still need work. Remove the prop (and these styles) once Sales Flash
  // is fully signed off.
  const doneWrap = done
    ? {
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.28)",
        borderRadius: 10,
        padding: "14px 16px",
      }
    : {};
  return (
    <div style={{ marginBottom: 32, ...doneWrap }}>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</div>
        {done && (
          <span style={{ fontSize: 9, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, padding: "2px 8px", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 999 }}>
            ✓ verified
          </span>
        )}
      </div>
      {subtitle && <div style={{ fontSize: 10, color: R.textDim, marginTop: -10, marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function CurrentMonthSummary({ data, hasBudgetData }: { data: SalesFlashResponse; hasBudgetData: boolean }) {
  const r = data.summary.revenue;
  const k = data.summary.kpis;

  // Reusable row renderer for Revenue + Total Accom
  function RevenueRow({ label, cell, emphasis = false }: { label: string; cell: RevenueCell; emphasis?: boolean }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 110px 110px 100px 140px 90px 90px 90px", borderBottom: `1px solid ${R.sep}`, alignItems: "center" }}>
        <div style={{ ...labelCell, fontWeight: emphasis ? 600 : 400, color: emphasis ? R.gold : R.text }}>{label}</div>
        <div style={{ ...cellBase, color: R.textMid }}>{fmtGbp(cell.priorMonth)}</div>
        <div style={{ ...cellBase, color: R.textMid }}>{fmtGbp(cell.priorYear)}</div>
        <div style={{ ...cellBase, color: R.textMid }}>{hasBudgetData ? fmtGbp(cell.budget) : <span style={{ color: R.textDim }}>—</span>}</div>
        <div style={{ ...cellBase, color: emphasis ? R.gold : R.text, fontWeight: emphasis ? 700 : 600 }}>{fmtGbp(cell.actual)}</div>
        <div style={cellBase}><DeltaText pct={pctDelta(cell.actual, cell.priorMonth)} /></div>
        <div style={cellBase}><DeltaText pct={pctDelta(cell.actual, cell.priorYear)} /></div>
        <div style={cellBase}>{hasBudgetData ? <DeltaText pct={pctDelta(cell.actual, cell.budget)} /> : <span style={{ color: R.textDim }}>—</span>}</div>
      </div>
    );
  }

  function KpiRow({ label, cell, fmt }: { label: string; cell: KpiCell; fmt: (v: number | null | undefined) => string }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 110px 110px 140px 90px 90px", borderBottom: `1px solid ${R.sep}`, alignItems: "center" }}>
        <div style={labelCell}>{label}</div>
        <div style={{ ...cellBase, color: R.textMid }}>{fmt(cell.priorMonth)}</div>
        <div style={{ ...cellBase, color: R.textMid }}>{fmt(cell.priorYear)}</div>
        <div style={{ ...cellBase, color: R.text, fontWeight: 600 }}>{fmt(cell.actual)}</div>
        <div style={cellBase}><DeltaText pct={pctDelta(cell.actual, cell.priorMonth)} /></div>
        <div style={cellBase}><DeltaText pct={pctDelta(cell.actual, cell.priorYear)} /></div>
      </div>
    );
  }

  const revHeader = (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 110px 110px 100px 140px 90px 90px 90px", borderBottom: `1px solid ${R.border}` }}>
      <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>Revenue (net)</div>
      <div style={headerCell}>Prior Month</div>
      <div style={headerCell}>Prior Year</div>
      <div style={headerCell}>Budget</div>
      <div style={{ ...headerCell, color: R.gold }}>Actuals (current month)</div>
      <div style={headerCell}>vs PM</div>
      <div style={headerCell}>vs PY</div>
      <div style={headerCell}>vs Bud</div>
    </div>
  );

  const kpiHeader = (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 110px 110px 140px 90px 90px", borderBottom: `1px solid ${R.border}` }}>
      <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>KPI</div>
      <div style={headerCell}>Prior Month</div>
      <div style={headerCell}>Prior Year</div>
      <div style={{ ...headerCell, color: R.gold }}>Actuals (current month)</div>
      <div style={headerCell}>vs PM</div>
      <div style={headerCell}>vs PY</div>
    </div>
  );

  return (
    <Section title="Current Month Summary" subtitle={`${monthLabel(data.monthKey)} — consumed scope (matches Mews Order Items Report)`} done>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14 }}>
          {revHeader}
          <RevenueRow label="Short Stay Revenue" cell={r.short} />
          <RevenueRow label="Mid Stay Revenue" cell={r.mid} />
          <RevenueRow label="Long Stay Revenue" cell={r.long} />
          <RevenueRow label="Total Accommodation Revenue" cell={r.totalAccom} emphasis />
        </div>

        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14 }}>
          {kpiHeader}
          <KpiRow label="Occupancy (blended)" cell={k.occupancy} fmt={(v) => fmtPct(v)} />
          <KpiRow label="ADR (blended)" cell={k.adrBlended} fmt={(v) => fmtGbp(v)} />
          <KpiRow label="RevPAR" cell={k.revpar} fmt={(v) => fmtGbp(v)} />
          <KpiRow label="SS ADR" cell={k.adrShort} fmt={(v) => fmtGbp(v)} />
          <KpiRow label="MS ADR" cell={k.adrMid} fmt={(v) => fmtGbp(v)} />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 110px 110px 140px 90px 90px", borderBottom: `1px solid ${R.sep}`, alignItems: "center" }}>
            <div style={{ ...labelCell, color: R.text }}>
              LS Avg Monthly Charge
              <span style={{ color: R.textDim, fontSize: 9, marginLeft: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>· /mo</span>
            </div>
            <div style={{ ...cellBase, color: R.textMid }}>{fmtGbp(k.amrLong.priorMonth)}</div>
            <div style={{ ...cellBase, color: R.textMid }}>{fmtGbp(k.amrLong.priorYear)}</div>
            <div style={{ ...cellBase, color: R.text, fontWeight: 600 }}>{fmtGbp(k.amrLong.actual)}</div>
            <div style={cellBase}><DeltaText pct={pctDelta(k.amrLong.actual, k.amrLong.priorMonth)} /></div>
            <div style={cellBase}><DeltaText pct={pctDelta(k.amrLong.actual, k.amrLong.priorYear)} /></div>
          </div>
          {(k.directShareNet.actual !== null || k.indirectShareNet.actual !== null) && (
            <>
              <KpiRow label="Direct Booking %" cell={k.directShareNet} fmt={(v) => v !== null && v !== undefined ? fmtPct(v * 100) : "—"} />
              <KpiRow label="Indirect (OTA) Booking %" cell={k.indirectShareNet} fmt={(v) => v !== null && v !== undefined ? fmtPct(v * 100) : "—"} />
            </>
          )}
        </div>
      </div>
    </Section>
  );
}

function AnnualisedTable({ data, hasBudgetData }: { data: SalesFlashResponse; hasBudgetData: boolean }) {
  const months = data.annualised;
  const grid = `minmax(180px, 1.5fr) repeat(${months.length}, minmax(78px, 1fr)) 110px`;

  const totals = {
    short: months.reduce((s, m) => s + m.revenue.short, 0),
    mid: months.reduce((s, m) => s + m.revenue.mid, 0),
    long: months.reduce((s, m) => s + m.revenue.long, 0),
    total: months.reduce((s, m) => s + m.revenue.total, 0),
    budgetTotal: hasBudgetData ? months.reduce((s, m) => s + (m.budget?.total || 0), 0) : 0,
  };
  const variance = hasBudgetData ? totals.total - totals.budgetTotal : null;

  return (
    <Section title="Annualised vs Budget" subtitle={`${monthLabel(months[0]?.monthKey ?? "")} → ${monthLabel(months[months.length - 1]?.monthKey ?? "")}`} done>
      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, overflowX: "auto" }}>
        <div style={{ minWidth: 1100 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
            <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>Line</div>
            {months.map((m) => <div key={m.monthKey} style={headerCell}>{monthLabel(m.monthKey)}</div>)}
            <div style={{ ...headerCell, color: R.gold }}>FYTD</div>
          </div>
          {[
            { label: "Short Stay Revenue", get: (m: typeof months[number]) => m.revenue.short, total: totals.short },
            { label: "Mid Stay Revenue", get: (m: typeof months[number]) => m.revenue.mid, total: totals.mid },
            { label: "Long Stay Revenue", get: (m: typeof months[number]) => m.revenue.long, total: totals.long },
          ].map((row) => (
            <div key={row.label} style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
              <div style={labelCell}>{row.label}</div>
              {months.map((m) => <div key={m.monthKey} style={cellBase}>{fmtGbp(row.get(m), 0)}</div>)}
              <div style={{ ...cellBase, color: R.text, fontWeight: 600 }}>{fmtGbp(row.total, 0)}</div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}`, background: "rgba(200,166,110,0.04)" }}>
            <div style={{ ...labelCell, color: R.gold, fontWeight: 600 }}>Total Accommodation</div>
            {months.map((m) => <div key={m.monthKey} style={{ ...cellBase, color: R.gold, fontWeight: 600 }}>{fmtGbp(m.revenue.total, 0)}</div>)}
            <div style={{ ...cellBase, color: R.gold, fontWeight: 700 }}>{fmtGbp(totals.total, 0)}</div>
          </div>
          {hasBudgetData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
                <div style={{ ...labelCell, color: R.textMid }}>Budget</div>
                {months.map((m) => <div key={m.monthKey} style={{ ...cellBase, color: R.textMid }}>{fmtGbp(m.budget?.total || 0, 0)}</div>)}
                <div style={{ ...cellBase, color: R.textMid }}>{fmtGbp(totals.budgetTotal, 0)}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: grid }}>
                <div style={{ ...labelCell, color: R.warmTeal }}>vs Budget</div>
                {months.map((m) => {
                  const v = m.budget ? m.revenue.total - m.budget.total : null;
                  return <div key={m.monthKey} style={cellBase}><DeltaText pct={m.budget && m.budget.total > 0 ? (v! / m.budget.total) * 100 : null} /></div>;
                })}
                <div style={cellBase}>{variance !== null ? <span style={{ color: variance >= 0 ? R.green : R.red, fontWeight: 600 }}>{fmtGbp(variance, 0)}</span> : "—"}</div>
              </div>
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: grid, borderTop: `1px solid ${R.border}` }}>
            <div style={{ ...labelCell, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Occupancy (blended)</div>
            {months.map((m) => <div key={m.monthKey} style={{ ...cellBase, color: R.textDim }}>{fmtPct(m.occupancy, 0)}</div>)}
            <div style={cellBase} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function BobBusinessDone({ data }: { data: SalesFlashResponse }) {
  // Derive the date ranges from the annualised grid + today, mirroring the
  // router's logic: months wholly past go to Business Done, current+future go
  // to BOB. We use the asOf date as "today" so the labels match what the
  // backend computed.
  const todayStr = data.asOf;
  const fyMonths = data.annualised.map((a) => a.monthKey);
  const pastMonths = fyMonths.filter((mk) => `${mk}-31` < todayStr);
  const futureMonths = fyMonths.filter((mk) => `${mk}-31` >= todayStr);
  const fmtRange = (arr: string[]) => arr.length === 0 ? "—" : arr.length === 1 ? monthLabel(arr[0]) : `${monthLabel(arr[0])} → ${monthLabel(arr[arr.length - 1])}`;
  const bobRange = fmtRange(futureMonths);
  const doneRange = fmtRange(pastMonths);

  const Card = ({ title, subtitle, totals, accent }: { title: string; subtitle: string; totals: { short: number; mid: number; long: number; total: number }; accent: string }) => (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 18 }}>
      <div style={{ fontSize: 11, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 10, color: R.textDim, marginBottom: 12 }}>{subtitle}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "Short Stay", value: totals.short },
          { label: "Mid Stay", value: totals.mid },
          { label: "Long Stay", value: totals.long },
          { label: "Total", value: totals.total, bold: true },
        ].map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${R.sep}` }}>
            <span style={{ fontSize: 11, color: R.textMid }}>{r.label}</span>
            <span style={{ fontSize: 12, color: R.text, fontWeight: r.bold ? 700 : 500 }}>{fmtGbp(r.value, 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <Section title="BOB & Business Done" subtitle="Forward Book of Business (booked future stays) vs FY-to-date Business Done (realised revenue from past months)" done>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card title="Business Done — realised" subtitle={`Past months: ${doneRange}`} totals={data.businessDone} accent={R.gold} />
        <Card title="Forward BOB — booked future stays" subtitle={`Current + future months: ${bobRange}`} totals={data.bob} accent={R.warmTeal} />
      </div>
    </Section>
  );
}

function PacingByService({ data, hasBudgetData }: { data: SalesFlashResponse; hasBudgetData: boolean }) {
  const months = data.annualised.map((a) => a.monthKey);
  const grid = `minmax(170px, 1.4fr) repeat(${months.length}, minmax(72px, 1fr)) 100px`;

  return (
    <Section title="Pacing Report — by Service" subtitle="Revenue + nights + ADR per service across the FY" done>
      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, overflowX: "auto" }}>
        <div style={{ minWidth: 1200 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
            <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>Service / Metric</div>
            {months.map((mk) => <div key={mk} style={headerCell}>{monthLabel(mk)}</div>)}
            <div style={{ ...headerCell, color: R.gold }}>FYTD</div>
          </div>
          {data.pacing.map((p) => {
            const totalRev = p.months.reduce((s, m) => s + m.actualRevenue, 0);
            const totalNights = p.months.reduce((s, m) => s + m.actualNights, 0);
            const totalBudget = hasBudgetData ? p.months.reduce((s, m) => s + (m.budgetRevenue || 0), 0) : null;
            const blendedAdr = totalNights > 0 ? totalRev / totalNights : null;
            const isLong = p.role === "long";
            return (
              <div key={p.role} style={{ marginTop: 6 }}>
                <div style={{ ...labelCell, color: R.warmTeal, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 10 }}>
                  {p.role === "short" ? "Short Stay (<1 month)" : p.role === "mid" ? "Mid Stay (1-3 months)" : "Long Stay (3+ months)"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
                  <div style={labelCell}>Revenue (net)</div>
                  {p.months.map((m) => <div key={m.monthKey} style={cellBase}>{fmtGbp(m.actualRevenue, 0)}</div>)}
                  <div style={{ ...cellBase, color: R.text, fontWeight: 600 }}>{fmtGbp(totalRev, 0)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
                  <div style={labelCell}>{isLong ? "Month-Charges" : "Room Nights"}</div>
                  {p.months.map((m) => <div key={m.monthKey} style={cellBase}>{fmtNum(m.actualNights, 0)}</div>)}
                  <div style={{ ...cellBase, color: R.text, fontWeight: 600 }}>{fmtNum(totalNights, 0)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
                  <div style={labelCell}>{isLong ? "Avg Monthly Charge" : "ADR (net)"}</div>
                  {p.months.map((m) => <div key={m.monthKey} style={cellBase}>{fmtGbp(m.actualAdr, 0)}</div>)}
                  <div style={{ ...cellBase, color: R.text }}>{fmtGbp(blendedAdr, 0)}</div>
                </div>
                {hasBudgetData && totalBudget !== null && (
                  <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
                    <div style={{ ...labelCell, color: R.textDim }}>Budget Revenue</div>
                    {p.months.map((m) => <div key={m.monthKey} style={{ ...cellBase, color: R.textDim }}>{fmtGbp(m.budgetRevenue, 0)}</div>)}
                    <div style={{ ...cellBase, color: R.textDim }}>{fmtGbp(totalBudget, 0)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function WeeklyUnitPacing({ data }: { data: SalesFlashResponse }) {
  const weeks = data.unitPacing;
  if (!weeks || weeks.length === 0) return null;
  const grid = `minmax(160px, 1fr) ${weeks.map(() => "minmax(110px, 1fr)").join(" ")}`;
  const renderRow = (label: string, color: string, get: (w: typeof weeks[number]) => { rooms: number; pct: number }) => (
    <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}`, alignItems: "center" }}>
      <div style={{ ...labelCell, color }}>{label}</div>
      {weeks.map((w) => {
        const v = get(w);
        return (
          <div key={w.weekStart} style={cellBase}>
            <span style={{ color: R.text, fontWeight: 600 }}>{fmtNum(v.rooms, 1)}</span>
            <span style={{ color: R.textDim, marginLeft: 8, fontSize: 10 }}>· {fmtPct(v.pct * 100, 0)}</span>
          </div>
        );
      })}
    </div>
  );
  return (
    <Section title="Weekly Unit Pacing" subtitle="Average rooms occupied per service across the next 5 weeks">
      <div style={{ background: "rgba(56,198,186,0.04)", border: `1px solid rgba(56,198,186,0.18)`, borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: R.text, lineHeight: 1.5 }}>
        <strong style={{ color: R.warmTeal }}>How Weekly Unit Pacing is counted:</strong>{" "}
        average rooms occupied per day across the 7-day week, broken out by Mews service (Short / Mid / Long Stay).
        "Offline" = blocked + out-of-service rooms from daily metrics. "Vacant" = remaining capacity.
        Each cell shows rooms + share of capacity. Reservation capture began 2026-04-13, plus historical
        backfill of all Mews reservations from 2024-01-01 — so forward weeks reflect every active
        reservation in Mews.
      </div>
      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, overflowX: "auto" }}>
        <div style={{ minWidth: 800 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
            <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>Week beginning</div>
            {weeks.map((w) => {
              const d = new Date(w.weekStart + "T00:00:00Z");
              const lbl = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
              return <div key={w.weekStart} style={headerCell}>{lbl}</div>;
            })}
          </div>
          {renderRow("Short Stay", R.text, (w) => w.shortStay)}
          {renderRow("Mid Stay", R.text, (w) => w.midStay)}
          {renderRow("Long Stay", R.text, (w) => w.longStay)}
          {renderRow("Offline", R.textDim, (w) => w.offline)}
          {renderRow("Vacant", R.textDim, (w) => w.vacant)}
        </div>
      </div>
    </Section>
  );
}

function SsLsBookings({ data }: { data: SalesFlashResponse }) {
  const ss = data.ssWeekly;
  const grid = ss.length
    ? `minmax(180px, 1.5fr) ${ss.map(() => "minmax(76px, 1fr)").join(" ")}`
    : `minmax(180px, 1.5fr)`;

  return (
    <Section title="Accommodation Bookings" subtitle="Last 8 weeks — Short Stay weekly + Long Stay new deals by lead-time tier" done>
      <div style={{ background: "rgba(56,198,186,0.04)", border: `1px solid rgba(56,198,186,0.18)`, borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: R.text, lineHeight: 1.5 }}>
        <strong style={{ color: R.warmTeal }}>How Short Stay is counted:</strong>{" "}
        reservations under Mews's Short Stay Accommodation service, excluding cancellations. Ties to Mews's Reservation Report exactly for any week. Capture began 2026-04-13.
      </div>
      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, overflowX: "auto", marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: R.warmTeal, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 12px 8px" }}>Short Stay — weekly bookings</div>
        {ss.length === 0 ? (
          <div style={{ color: R.textDim, fontSize: 11, padding: 12 }}>No short-stay bookings captured yet.</div>
        ) : (
          <div style={{ minWidth: 800 }}>
            <div style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.border}` }}>
              <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>Week ending</div>
              {ss.map((w) => {
                const d = new Date(w.weekStart + "T00:00:00Z");
                const lbl = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
                return <div key={w.weekStart} style={headerCell}>{lbl}</div>;
              })}
            </div>
            {[
              { label: "Bookings", get: (w: typeof ss[number]) => w.bookings, fmt: (v: number) => fmtNum(v, 0) },
              { label: "Room nights", get: (w: typeof ss[number]) => w.roomNights, fmt: (v: number) => fmtNum(v, 0) },
              { label: "Revenue (gross)", get: (w: typeof ss[number]) => w.revenue, fmt: (v: number) => fmtGbp(v, 0) },
              { label: "Avg ADR", get: (w: typeof ss[number]) => w.avgAdr, fmt: (v: number | null | undefined) => fmtGbp(v, 0) },
            ].map((r) => (
              <div key={r.label} style={{ display: "grid", gridTemplateColumns: grid, borderBottom: `1px solid ${R.sep}` }}>
                <div style={labelCell}>{r.label}</div>
                {ss.map((w) => <div key={w.weekStart} style={cellBase}>{r.fmt(r.get(w) as any)}</div>)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, overflowX: "auto" }}>
        <div style={{ fontSize: 10, color: R.warmTeal, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 12px 8px" }}>Long Stay — new deals by lead-time tier</div>
        <div style={{ minWidth: 800 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) 90px 110px 90px", borderBottom: `1px solid ${R.border}` }}>
            <div style={{ ...headerCell, textAlign: "left", paddingLeft: 12 }}>Lead-time tier</div>
            <div style={headerCell}>Bookings</div>
            <div style={headerCell}>Revenue (gross)</div>
            <div style={headerCell}>Nights</div>
          </div>
          {data.lsTierWeekly.map((t) => (
            <div key={t.tier} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) 90px 110px 90px", borderBottom: `1px solid ${R.sep}` }}>
              <div style={labelCell}>{t.label}</div>
              <div style={cellBase}>{fmtNum(t.total.bookings, 0)}</div>
              <div style={cellBase}>{fmtGbp(t.total.revenue, 0)}</div>
              <div style={cellBase}>{fmtNum(t.total.nights, 0)}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// Build the 3 month options: current (partial), last completed (default), 2 months back.
function getMonthOptions(): { value: string; label: string; tag: string }[] {
  const today = new Date();
  const mk = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  return [
    { value: mk(0), label: monthLabel(mk(0)), tag: "current (partial)" },
    { value: mk(-1), label: monthLabel(mk(-1)), tag: "last completed" },
    { value: mk(-2), label: monthLabel(mk(-2)), tag: "2 months back" },
  ];
}

export function MasonSalesFlash() {
  const [property, setProperty] = useState<Property>(PROPERTIES[0]);
  const monthOptions = useMemo(getMonthOptions, []);
  const [monthKey, setMonthKey] = useState<string>(monthOptions[1].value); // default = last completed
  const [data, setData] = useState<SalesFlashResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Clear stale data when property or month changes so the full-page "Loading…"
  // placeholder shows during the fetch (live Mews API is slow, ~20-30s). Refresh
  // ticks keep data.
  useEffect(() => {
    setData(null);
  }, [property.hotelId, monthKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMasonSalesFlash(property.hotelId, monthKey)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [property, monthKey, tick]);

  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <TopBar
        property={property}
        onChange={setProperty}
        monthKey={monthKey}
        monthOptions={monthOptions}
        onMonthChange={setMonthKey}
        asOf={data?.asOf ?? null}
        loading={loading}
        onRefresh={() => setTick((t) => t + 1)}
      />

      <div style={{ padding: "24px 28px" }}>
        {error && (
          <div style={{ padding: "10px 14px", marginBottom: 22, background: "rgba(239,68,68,0.10)", border: `1px solid ${R.red}33`, borderRadius: 6, color: R.red, fontSize: 11 }}>
            {error}
          </div>
        )}

        {data && !data.hasBudgetData && (
          <div style={{ padding: "10px 14px", marginBottom: 22, background: "rgba(200,166,110,0.06)", border: `1px solid ${R.gold}33`, borderRadius: 6, color: R.gold, fontSize: 11, letterSpacing: 0.3 }}>
            Per-service budgets not yet uploaded — Budget columns are hidden. Upload via <code>POST /api/mason/budgets/{property.hotelId}</code> with rows {"{ year, rows: [{ month, service_role, budget_revenue_net }, …] }"} to enable.
          </div>
        )}

        {loading && !data && (
          <div style={{ color: R.textDim, fontSize: 12, padding: "40px 0", textAlign: "center" }}>Loading sales flash…</div>
        )}

        {data && (
          <>
            <CurrentMonthSummary data={data} hasBudgetData={data.hasBudgetData} />
            <AnnualisedTable data={data} hasBudgetData={data.hasBudgetData} />
            <BobBusinessDone data={data} />
            <PacingByService data={data} hasBudgetData={data.hasBudgetData} />
            <WeeklyUnitPacing data={data} />
            <SsLsBookings data={data} />
          </>
        )}
      </div>
    </div>
  );
}
