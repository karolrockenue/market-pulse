import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, RefreshCw } from "lucide-react";
import { R } from "../../../styles/tokens";
import {
  fetchMasonPacing,
  fetchMasonBookingPulse,
  type PacingResponse,
  type PacingMonth,
  type BookingPulseResponse,
} from "../api/mason.api";

// ── Mason & Fifth — Pacing Flash (live) ──
// Wired to /api/mason/pacing and /api/mason/booking-pulse. v1 scope:
// Westbourne (318341) + Primrose (318343). Belsize is excluded — opens
// mid-May 2026 with no LY data (Blueprint).
//
// STLY + LPR rows render blank in v1; the backend returns null for those
// fields and the helpers below hide them. Replaces the mockup (mason-and-
// fifth.md §Active Projects + mason-stly-plan.md).

type Property = { id: string; name: string; hotelId: number };
const PROPERTIES: Property[] = [
  { id: "wb", name: "Westbourne Park", hotelId: 318341 },
  { id: "ph", name: "Primrose Hill", hotelId: 318343 },
];

const KPIS = [
  { key: "revenue", name: "Revenue", unit: "currency" as const },
  { key: "roomNights", name: "Room Nights", unit: "count" as const },
  { key: "revpar", name: "RevPAR", unit: "currencyPerNight" as const },
  { key: "adr", name: "ADR", unit: "currencyPerNight" as const },
  { key: "occupancy", name: "Occupancy", unit: "percent" as const },
];

type KpiKey = (typeof KPIS)[number]["key"];
type Unit = (typeof KPIS)[number]["unit"];

const fmt = (v: number, dp = 0) =>
  (v ?? 0).toLocaleString(undefined, { maximumFractionDigits: dp });

function fmtBlock(v: number | null | undefined, unit: Unit) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  if (unit === "currency") {
    if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 10_000) return `£${(v / 1000).toFixed(0)}k`;
    if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(1)}k`;
    return `£${Math.round(v)}`;
  }
  if (unit === "currencyPerNight") return `£${fmt(Math.round(v))}`;
  if (unit === "percent") return `${Math.round(v)}%`;
  return fmt(Math.round(v));
}

function arrowFor(p: number | null | undefined) {
  if (p === null || p === undefined || !isFinite(p) || Math.abs(p) < 0.05)
    return { sym: "→", col: R.textDim };
  return p > 0 ? { sym: "↑", col: R.green } : { sym: "↓", col: R.red };
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function pickKpi(row: { revenue?: number; roomNights?: number; adr?: number | null; revpar?: number | null; occupancy?: number | null } | null, key: KpiKey): number | null {
  if (!row) return null;
  // PacingMonth.currentOTB is wrapped — caller passes .total. Same for forecast / finalLY.
  if (key === "revenue") return row.revenue ?? null;
  if (key === "roomNights") return row.roomNights ?? null;
  if (key === "adr") return row.adr ?? null;
  if (key === "revpar") return row.revpar ?? null;
  if (key === "occupancy") return row.occupancy ?? null;
  return null;
}

function TopBar({
  property,
  onChange,
  asOf,
  loading,
  onRefresh,
}: {
  property: Property;
  onChange: (p: Property) => void;
  asOf: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>
          Pacing Flash
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

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11 }}>
          <div>
            <div style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 9 }}>As of</div>
            <div style={{ color: R.gold, fontWeight: 600 }}>{asOf || "—"}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: R.cardRaised,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
            color: loading ? R.textDim : R.warmTeal,
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
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
    </div>
  );
}

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

function KpiBlockView({
  kpiKey,
  unit,
  name,
  grid,
  monthKeys,
  pacingMonths,
  stlyAvailable,
  lprAvailable,
}: {
  kpiKey: KpiKey;
  unit: Unit;
  name: string;
  grid: string;
  monthKeys: string[];
  pacingMonths: PacingMonth[];
  stlyAvailable: boolean;
  lprAvailable: boolean;
}) {
  const otb = pacingMonths.map((m) => pickKpi(m.currentOTB.total as any, kpiKey));
  const forecast = pacingMonths.map((m) => pickKpi(m.forecast as any, kpiKey));
  const finalLY = pacingMonths.map((m) => pickKpi(m.finalLY as any, kpiKey));
  const stly = pacingMonths.map((m) => pickKpi(m.sameTimeLY as any, kpiKey));
  const lpr = pacingMonths.map((m) => pickKpi(m.lastPacingReport as any, kpiKey));

  const valueRows: { label: string; values: (number | null)[]; color: string; bold?: boolean; visible: boolean }[] = [
    { label: "Last Pacing Report", values: lpr, color: R.textMid, visible: lprAvailable },
    { label: "Current OTB", values: otb, color: R.gold, bold: true, visible: true },
    { label: "Forecast", values: forecast, color: R.warmTeal, visible: true },
    { label: "Final Month LY", values: finalLY, color: R.textDim, visible: true },
    { label: "Same Time LY", values: stly, color: R.textDim, visible: stlyAvailable },
  ];

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 16, marginBottom: 18, overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{name}</div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>OTB · Forecast · Final Month LY{stlyAvailable ? " · STLY" : ""}{lprAvailable ? " · % vs LPR" : ""}</div>
        </div>
      </div>

      <div style={{ minWidth: 1100 }}>
        <div style={{ display: "grid", gridTemplateColumns: grid, padding: "8px 0", borderBottom: `1px solid ${R.border}`, fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
          <div />
          {monthKeys.map((mk) => (
            <div key={mk} style={{ ...cellBase }}>{monthLabel(mk)}</div>
          ))}
        </div>

        {valueRows.filter((r) => r.visible).map((row) => (
          <div key={row.label} style={{ display: "grid", gridTemplateColumns: grid, padding: "3px 0", borderBottom: `1px solid ${R.sep}` }}>
            <div style={{ ...labelCell }}>{row.label}</div>
            {row.values.map((v, i) => (
              <div key={i} style={{ ...cellBase, color: row.color, fontWeight: row.bold ? 700 : 500 }}>
                {fmtBlock(v, unit)}
              </div>
            ))}
          </div>
        ))}

        {/* % vs LPR row only when LPR data exists */}
        {lprAvailable && (
          <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0", borderBottom: `1px solid ${R.sep}`, background: "rgba(56,198,186,0.04)" }}>
            <div style={{ ...labelCell, color: R.warmTeal }}>% vs Last Report</div>
            {pacingMonths.map((_, i) => {
              const cur = otb[i];
              const ref = lpr[i];
              if (cur === null || ref === null || ref === 0) return <div key={i} style={cellBase}>—</div>;
              const p = ((cur - ref) / Math.abs(ref)) * 100;
              const a = arrowFor(p);
              return (
                <div key={i} style={{ ...cellBase, color: a.col, fontWeight: 600 }}>{a.sym} {Math.abs(p).toFixed(1)}%</div>
              );
            })}
          </div>
        )}

        {/* % vs STLY only when STLY data exists */}
        {stlyAvailable && (
          <div style={{ display: "grid", gridTemplateColumns: grid, padding: "5px 0" }}>
            <div style={{ ...labelCell, color: R.gold }}>% vs Same Time LY</div>
            {pacingMonths.map((_, i) => {
              const cur = otb[i];
              const ref = stly[i];
              if (cur === null || ref === null || ref === 0) return <div key={i} style={cellBase}>—</div>;
              const p = ((cur - ref) / Math.abs(ref)) * 100;
              const a = arrowFor(p);
              return (
                <div key={i} style={{ ...cellBase, color: a.col, fontWeight: 600 }}>{a.sym} {Math.abs(p).toFixed(1)}%</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingPulse({ data, loading, weeksBack, earliestCapture }: {
  data: BookingPulseResponse | null;
  loading: boolean;
  weeksBack: number;
  earliestCapture: string | null;
}) {
  const [stayMonth, setStayMonth] = useState<string | null>(null);

  // Pivot rows into { weekStart -> { stayMonth -> { bookings, cancels, revenue, nights } } }
  const { weekStarts, stayMonths, byWeek, totalsByMonth } = useMemo(() => {
    if (!data) return { weekStarts: [], stayMonths: [], byWeek: new Map(), totalsByMonth: new Map() };
    const wkSet = new Set<string>();
    const smSet = new Set<string>();
    const totals = new Map<string, { bookings: number; cancellations: number; revenue: number; roomNights: number }>();
    for (const r of data.rows) {
      wkSet.add(r.weekStart);
      smSet.add(r.stayMonth);
      const t = totals.get(r.stayMonth) || { bookings: 0, cancellations: 0, revenue: 0, roomNights: 0 };
      t.bookings += r.bookings;
      t.cancellations += r.cancellations;
      t.revenue += r.revenue;
      t.roomNights += r.roomNights;
      totals.set(r.stayMonth, t);
    }
    const weekStarts = [...wkSet].sort();
    const stayMonths = [...smSet].sort();
    const byWeek = new Map<string, Map<string, { bookings: number; cancellations: number; revenue: number; roomNights: number }>>();
    for (const r of data.rows) {
      if (!byWeek.has(r.stayMonth)) byWeek.set(r.stayMonth, new Map());
      byWeek.get(r.stayMonth)!.set(r.weekStart, r);
    }
    return { weekStarts, stayMonths, byWeek, totalsByMonth: totals };
  }, [data]);

  // Default selection = first stay month (most-recent past with bookings)
  useEffect(() => {
    if (stayMonth === null && stayMonths.length > 0) setStayMonth(stayMonths[0]);
  }, [stayMonths, stayMonth]);

  const grid = `minmax(180px, 1.4fr) ${weekStarts.map(() => "minmax(70px, 1fr)").join(" ")} 90px`;

  const selectedRows = stayMonth ? byWeek.get(stayMonth) : null;
  const t = stayMonth ? totalsByMonth.get(stayMonth) : null;
  const newBookings = weekStarts.map((w) => selectedRows?.get(w)?.bookings ?? 0);
  const cancellations = weekStarts.map((w) => selectedRows?.get(w)?.cancellations ?? 0);
  const revenue = weekStarts.map((w) => selectedRows?.get(w)?.revenue ?? 0);

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 16, marginBottom: 18, overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Booking Pulse
          </div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
            Last {weeksBack} weeks of bookings · attributed to stay month
            {earliestCapture && ` · capture started ${earliestCapture}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 6, flexWrap: "wrap" }}>
          {stayMonths.map((m) => (
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
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: R.textDim, fontSize: 11 }}>Loading booking pulse…</div>}
      {!loading && stayMonths.length === 0 && (
        <div style={{ color: R.textDim, fontSize: 11 }}>
          No bookings captured yet (reservations webhook started {earliestCapture || "recently"}).
        </div>
      )}

      {!loading && stayMonths.length > 0 && (
        <div style={{ minWidth: 800 }}>
          <div style={{ display: "grid", gridTemplateColumns: grid, padding: "8px 0", borderBottom: `1px solid ${R.border}`, fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>
            <div style={{ paddingLeft: 12 }}>Week of</div>
            {weekStarts.map((w) => {
              const d = new Date(w + "T00:00:00Z");
              const lbl = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
              return <div key={w} style={cellBase}>{lbl}</div>;
            })}
            <div style={{ ...cellBase, color: R.gold }}>TOTAL</div>
          </div>

          {[
            { label: "New Bookings", values: newBookings, total: t?.bookings ?? 0, color: R.gold, fmt: (v: number) => v === 0 ? "—" : v.toString(), bold: true },
            { label: "Cancellations", values: cancellations, total: t?.cancellations ?? 0, color: R.red, fmt: (v: number) => v === 0 ? "—" : `−${v}`, bold: false },
            { label: "Revenue Picked Up £", values: revenue, total: t?.revenue ?? 0, color: R.warmTeal, fmt: (v: number) => v === 0 ? "—" : `£${(v / 1000).toFixed(0)}k`, bold: true },
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
      )}
    </div>
  );
}

export function MasonPacingFlash() {
  const [property, setProperty] = useState<Property>(PROPERTIES[0]);
  const [pacing, setPacing] = useState<PacingResponse | null>(null);
  const [pulse, setPulse] = useState<BookingPulseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Clear stale data when property changes so the full-page "Loading…" placeholder
  // shows during the fetch (live Mews API is slow). Refresh ticks keep data.
  useEffect(() => {
    setPacing(null);
    setPulse(null);
  }, [property.hotelId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchMasonPacing(property.hotelId, { monthsBack: 2, monthsForward: 11 }),
      fetchMasonBookingPulse(property.hotelId, 8),
    ])
      .then(([p, b]) => {
        if (cancelled) return;
        setPacing(p);
        setPulse(b);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [property, tick]);

  const monthKeys = pacing?.grid.map((g) => g.monthKey) ?? [];
  const grid = `minmax(150px, 1.3fr) repeat(${Math.max(1, monthKeys.length)}, minmax(60px, 1fr))`;

  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <TopBar
        property={property}
        onChange={setProperty}
        asOf={pacing?.asOf ?? null}
        loading={loading}
        onRefresh={() => setTick((t) => t + 1)}
      />

      <div style={{ padding: "24px 28px" }}>
        {error && (
          <div style={{ padding: "10px 14px", marginBottom: 22, background: "rgba(239,68,68,0.10)", border: `1px solid ${R.red}33`, borderRadius: 6, color: R.red, fontSize: 11 }}>
            {error}
          </div>
        )}

        {pacing && (!pacing.stlyAvailable || !pacing.lprAvailable) && (
          <div style={{ padding: "10px 14px", marginBottom: 22, background: "rgba(200,166,110,0.06)", border: `1px solid ${R.gold}33`, borderRadius: 6, color: R.gold, fontSize: 11, letterSpacing: 0.3 }}>
            {pacing.notes.stly} {pacing.notes.lpr} {pacing.notes.forecast}
          </div>
        )}

        {loading && !pacing && (
          <div style={{ color: R.textDim, fontSize: 12, padding: "40px 0", textAlign: "center" }}>Loading pacing data…</div>
        )}

        {pacing && pacing.grid.length > 0 && KPIS.map((k) => (
          <KpiBlockView
            key={k.key}
            kpiKey={k.key}
            unit={k.unit}
            name={k.name}
            grid={grid}
            monthKeys={monthKeys}
            pacingMonths={pacing.grid}
            stlyAvailable={pacing.stlyAvailable}
            lprAvailable={pacing.lprAvailable}
          />
        ))}

        {pulse && <BookingPulse data={pulse} loading={loading} weeksBack={pulse.weeksBack} earliestCapture={pulse.earliestReservationCapture} />}
      </div>
    </div>
  );
}
