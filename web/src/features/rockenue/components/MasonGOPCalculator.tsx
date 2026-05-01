import { useMemo, useState } from "react";
import { Download, ChevronDown, RotateCcw } from "lucide-react";
import { R } from "../../../styles/tokens";

// ── Mason & Fifth — GOP Calculator mockup ──
// Single-page form: type revenue + costs → live Gross Operating Profit.
// USALI-style P&L: Revenue → Departmental Costs → Departmental Profit
// → Undistributed Operating Expenses → GOP. Inputs are editable, totals
// recompute on every keystroke. Mock numbers seeded from MAR-26 WB so
// the page lands with a believable starting point.
// Same calm visual language as Sales Flash: flat grid, no bold weights,
// no coloured lanes, desaturated deltas.

type Hotel = { id: string; name: string };
const HOTELS: Hotel[] = [
  { id: "wb", name: "Westbourne Park" },
  { id: "ph", name: "Primrose Hill" },
  { id: "bmy", name: "Bermondsey" },
];

const fmt = (v: number) =>
  `£${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtSigned = (v: number) =>
  `${v < 0 ? "−" : ""}£${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// ─────────────────────────────────────────────────────────────────────
//  Mock seed values — MAR-26 Westbourne Park, derived from Sales Flash
// ─────────────────────────────────────────────────────────────────────

interface Seed {
  hotelLabel: string;
  rooms: number;       // physical capacity
  daysInMonth: number;
  revenue: {
    shortStay: number;
    midStay: number;
    longStay: number;
    canal: number;
    meadow: number;
    grounding: number;
  };
  deptCosts: {
    accommodationOps: number;  // housekeeping, supplies, commissions across SS/MS/LS
    canalCogs: number;         // food + beverage cost
    meadowCogs: number;
    groundingCogs: number;
    accommodationPayroll: number;
    fbPayroll: number;
  };
  undistributed: {
    adminGeneral: number;
    salesMarketing: number;
    propertyOps: number;
    utilities: number;
    itTelecom: number;
  };
}

const SEED_BY_HOTEL: Record<string, Seed> = {
  wb: {
    hotelLabel: "Westbourne Park",
    rooms: 305,
    daysInMonth: 31,
    revenue: {
      shortStay: 317159,
      midStay: 28508,
      longStay: 316063,
      canal: 32112,
      meadow: 17731,
      grounding: 1447,
    },
    deptCosts: {
      accommodationOps: 78000,
      canalCogs: 11200,
      meadowCogs: 2700,
      groundingCogs: 580,
      accommodationPayroll: 96000,
      fbPayroll: 18000,
    },
    undistributed: {
      adminGeneral: 49000,
      salesMarketing: 42000,
      propertyOps: 28000,
      utilities: 24000,
      itTelecom: 10500,
    },
  },
  ph: {
    hotelLabel: "Primrose Hill",
    rooms: 60,
    daysInMonth: 31,
    revenue: {
      shortStay: 79006,
      midStay: 5380,
      longStay: 73710,
      canal: 8200,
      meadow: 0,
      grounding: 0,
    },
    deptCosts: {
      accommodationOps: 18500,
      canalCogs: 2900,
      meadowCogs: 0,
      groundingCogs: 0,
      accommodationPayroll: 22000,
      fbPayroll: 3200,
    },
    undistributed: {
      adminGeneral: 11000,
      salesMarketing: 9200,
      propertyOps: 6400,
      utilities: 5300,
      itTelecom: 2400,
    },
  },
  bmy: {
    hotelLabel: "Bermondsey",
    rooms: 105,
    daysInMonth: 31,
    revenue: {
      shortStay: 138000,
      midStay: 12100,
      longStay: 159200,
      canal: 14800,
      meadow: 7500,
      grounding: 600,
    },
    deptCosts: {
      accommodationOps: 32000,
      canalCogs: 5100,
      meadowCogs: 1100,
      groundingCogs: 240,
      accommodationPayroll: 39000,
      fbPayroll: 7400,
    },
    undistributed: {
      adminGeneral: 19000,
      salesMarketing: 16500,
      propertyOps: 11500,
      utilities: 9700,
      itTelecom: 4200,
    },
  },
};

// ─────────────────────────────────────────────────────────────────────
//  Top bar (same pattern as Sales / Pacing Flash)
// ─────────────────────────────────────────────────────────────────────

function TopBar({
  hotel,
  onChangeHotel,
  reportDate,
  onReset,
}: {
  hotel: Hotel;
  onChangeHotel: (h: Hotel) => void;
  reportDate: string;
  onReset: () => void;
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
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>
          GOP Calculator · WIP
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
            <span style={{ fontSize: 13, color: R.text, fontWeight: 500, flex: 1, textAlign: "left" }}>
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
                      background: h.id === hotel.id ? "rgba(56,198,186,0.10)" : "transparent",
                      color: h.id === hotel.id ? R.warmTeal : R.text,
                      fontSize: 12,
                      fontWeight: 400,
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
          <span style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>Period</span>
          <span style={{ fontSize: 11.5, color: R.gold, fontWeight: 400 }}>{reportDate}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onReset}
          title="Reset all inputs to seeded values"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: "transparent",
            border: `1px solid ${R.border}`,
            borderRadius: 6,
            color: R.textMid,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={13} /> Reset
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
            cursor: "not-allowed",
            opacity: 0.6,
          }}
        >
          <Download size={14} /> Export
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Editable row + section primitives
// ─────────────────────────────────────────────────────────────────────

function EditableRow({
  label,
  value,
  onChange,
  pctOfRevenue,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  pctOfRevenue?: number;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 90px 160px",
        alignItems: "center",
        padding: "9px 0",
        borderBottom: `1px solid ${R.sep}`,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: R.text, fontWeight: 400 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: R.textDim, fontVariantNumeric: "tabular-nums" }}>
        {pctOfRevenue !== undefined ? `${pctOfRevenue.toFixed(1)}%` : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: R.heroBg,
            border: `1px solid ${R.border}`,
            borderRadius: 5,
            padding: "0 0 0 10px",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = R.warmTeal + "55")}
          onBlur={(e) => (e.currentTarget.style.borderColor = R.border)}
        >
          <span style={{ fontSize: 11, color: R.textDim }}>£</span>
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange(isNaN(n) ? 0 : n);
            }}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "6px 10px",
              fontSize: 12,
              color: R.text,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
              width: 110,
              fontWeight: 400,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function SectionFrame({
  title,
  subtitle,
  children,
  subtotal,
  subtotalLabel,
  subtotalPct,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  subtotal: number;
  subtotalLabel: string;
  subtotalPct?: number;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 12, color: R.text, fontWeight: 500 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: R.textDim }}>{subtitle}</div>}
      </div>
      <div
        style={{
          background: R.darkBand,
          border: `1px solid ${R.border}`,
          borderRadius: 8,
          padding: "8px 18px 14px",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {children}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 160px",
            alignItems: "center",
            padding: "12px 0 4px",
            marginTop: 4,
          }}
        >
          <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
            {subtotalLabel}
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: R.textDim, fontVariantNumeric: "tabular-nums" }}>
            {subtotalPct !== undefined ? `${subtotalPct.toFixed(1)}%` : ""}
          </div>
          <div
            style={{
              textAlign: "right",
              fontSize: 16,
              color: R.text,
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              paddingRight: 12,
            }}
          >
            {fmt(subtotal)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Sticky live summary
// ─────────────────────────────────────────────────────────────────────

function LiveSummary({
  totalRevenue,
  totalCosts,
  gop,
  gopPct,
  goppar,
  hotelLabel,
}: {
  totalRevenue: number;
  totalCosts: number;
  gop: number;
  gopPct: number;
  goppar: number;
  hotelLabel: string;
}) {
  const tile: React.CSSProperties = {
    flex: 1,
    padding: "14px 18px",
    borderRight: `1px solid ${R.border}`,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: R.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: 500,
  };
  const valueStyle: React.CSSProperties = {
    fontSize: 18,
    color: R.text,
    fontWeight: 500,
    marginTop: 4,
    fontVariantNumeric: "tabular-nums",
  };
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: R.darkBand,
        border: `1px solid ${R.border}`,
        borderRadius: 8,
        marginBottom: 24,
        display: "flex",
        overflow: "hidden",
      }}
    >
      <div style={tile}>
        <div style={labelStyle}>Property</div>
        <div style={{ ...valueStyle, fontSize: 14, color: R.textMid }}>{hotelLabel}</div>
      </div>
      <div style={tile}>
        <div style={labelStyle}>Total Revenue</div>
        <div style={valueStyle}>{fmt(totalRevenue)}</div>
      </div>
      <div style={tile}>
        <div style={labelStyle}>Total Costs</div>
        <div style={{ ...valueStyle, color: R.textMid }}>{fmt(totalCosts)}</div>
      </div>
      <div style={tile}>
        <div style={labelStyle}>GOP £</div>
        <div style={{ ...valueStyle, color: gop >= 0 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)" }}>
          {fmtSigned(gop)}
        </div>
      </div>
      <div style={tile}>
        <div style={labelStyle}>GOP %</div>
        <div style={{ ...valueStyle, color: gop >= 0 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)" }}>
          {gopPct.toFixed(1)}%
        </div>
      </div>
      <div style={{ ...tile, borderRight: "none" }}>
        <div style={labelStyle}>GOPPAR</div>
        <div style={valueStyle}>{fmt(goppar)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────────────────────────────

export function MasonGOPCalculator() {
  const [hotel, setHotel] = useState<Hotel>(HOTELS[0]);
  const seed = SEED_BY_HOTEL[hotel.id];

  // Single state object so reset is one line.
  const [state, setState] = useState(() => ({
    revenue: { ...seed.revenue },
    deptCosts: { ...seed.deptCosts },
    undistributed: { ...seed.undistributed },
  }));

  // When the user switches property, reset to that property's seed.
  // Use a ref-effect-free trick: track previous hotel id via state initialiser.
  const [lastHotelId, setLastHotelId] = useState(hotel.id);
  if (lastHotelId !== hotel.id) {
    setLastHotelId(hotel.id);
    setState({
      revenue: { ...seed.revenue },
      deptCosts: { ...seed.deptCosts },
      undistributed: { ...seed.undistributed },
    });
  }

  const totals = useMemo(() => {
    const totalRevenue =
      state.revenue.shortStay +
      state.revenue.midStay +
      state.revenue.longStay +
      state.revenue.canal +
      state.revenue.meadow +
      state.revenue.grounding;

    const totalDeptCosts =
      state.deptCosts.accommodationOps +
      state.deptCosts.canalCogs +
      state.deptCosts.meadowCogs +
      state.deptCosts.groundingCogs +
      state.deptCosts.accommodationPayroll +
      state.deptCosts.fbPayroll;

    const deptProfit = totalRevenue - totalDeptCosts;

    const totalUndistributed =
      state.undistributed.adminGeneral +
      state.undistributed.salesMarketing +
      state.undistributed.propertyOps +
      state.undistributed.utilities +
      state.undistributed.itTelecom;

    const gop = deptProfit - totalUndistributed;
    const gopPct = totalRevenue > 0 ? (gop / totalRevenue) * 100 : 0;
    const availableRoomNights = seed.rooms * seed.daysInMonth;
    const goppar = availableRoomNights > 0 ? gop / availableRoomNights : 0;
    const totalCosts = totalDeptCosts + totalUndistributed;

    return {
      totalRevenue,
      totalDeptCosts,
      deptProfit,
      totalUndistributed,
      totalCosts,
      gop,
      gopPct,
      goppar,
      availableRoomNights,
    };
  }, [state, seed]);

  const pct = (n: number) => (totals.totalRevenue > 0 ? (n / totals.totalRevenue) * 100 : 0);

  const setRevenue = <K extends keyof Seed["revenue"]>(key: K, value: number) =>
    setState((s) => ({ ...s, revenue: { ...s.revenue, [key]: value } }));
  const setDept = <K extends keyof Seed["deptCosts"]>(key: K, value: number) =>
    setState((s) => ({ ...s, deptCosts: { ...s.deptCosts, [key]: value } }));
  const setUndist = <K extends keyof Seed["undistributed"]>(key: K, value: number) =>
    setState((s) => ({ ...s, undistributed: { ...s.undistributed, [key]: value } }));

  const reset = () =>
    setState({
      revenue: { ...seed.revenue },
      deptCosts: { ...seed.deptCosts },
      undistributed: { ...seed.undistributed },
    });

  return (
    <div style={{ flex: 1, background: R.bg, color: R.text, fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" }}>
      <TopBar hotel={hotel} onChangeHotel={setHotel} reportDate="Mar 2026" onReset={reset} />

      <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 24,
            background: "rgba(200,166,110,0.06)",
            border: `1px solid ${R.gold}33`,
            borderRadius: 6,
            color: R.gold,
            fontSize: 11,
            letterSpacing: 0.3,
          }}
        >
          Mockup · seeded from MAR-26 actuals; type any cell to override. Costs are illustrative until cost data is wired through Mews.
        </div>

        <LiveSummary
          totalRevenue={totals.totalRevenue}
          totalCosts={totals.totalCosts}
          gop={totals.gop}
          gopPct={totals.gopPct}
          goppar={totals.goppar}
          hotelLabel={seed.hotelLabel}
        />

        {/* ── Revenue ──────────────────────────────────────────── */}
        <SectionFrame
          title="Revenue"
          subtitle="Per service · gross of VAT"
          subtotal={totals.totalRevenue}
          subtotalLabel="Total Revenue"
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 160px", padding: "8px 0", borderBottom: `1px solid ${R.sep}` }}>
            <div />
            <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>% of Rev</div>
            <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right", paddingRight: 12 }}>Amount</div>
          </div>

          <EditableRow label="Short Stay" value={state.revenue.shortStay} onChange={(v) => setRevenue("shortStay", v)} pctOfRevenue={pct(state.revenue.shortStay)} />
          <EditableRow label="Mid Stay" value={state.revenue.midStay} onChange={(v) => setRevenue("midStay", v)} pctOfRevenue={pct(state.revenue.midStay)} />
          <EditableRow label="Long Stay" value={state.revenue.longStay} onChange={(v) => setRevenue("longStay", v)} pctOfRevenue={pct(state.revenue.longStay)} />
          <EditableRow label="CANAL Restaurant" value={state.revenue.canal} onChange={(v) => setRevenue("canal", v)} pctOfRevenue={pct(state.revenue.canal)} />
          <EditableRow label="MEADOW Workspace" value={state.revenue.meadow} onChange={(v) => setRevenue("meadow", v)} pctOfRevenue={pct(state.revenue.meadow)} />
          <EditableRow label="GROUNDING Wellness" value={state.revenue.grounding} onChange={(v) => setRevenue("grounding", v)} pctOfRevenue={pct(state.revenue.grounding)} />
        </SectionFrame>

        {/* ── Departmental Costs ─────────────────────────────── */}
        <SectionFrame
          title="Departmental Expenses"
          subtitle="Direct cost of running each revenue line"
          subtotal={totals.totalDeptCosts}
          subtotalLabel="Total Departmental"
          subtotalPct={pct(totals.totalDeptCosts)}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 160px", padding: "8px 0", borderBottom: `1px solid ${R.sep}` }}>
            <div />
            <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>% of Rev</div>
            <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right", paddingRight: 12 }}>Amount</div>
          </div>

          <EditableRow
            label="Accommodation Operations"
            hint="Housekeeping, supplies, OTA commissions, linen"
            value={state.deptCosts.accommodationOps}
            onChange={(v) => setDept("accommodationOps", v)}
            pctOfRevenue={pct(state.deptCosts.accommodationOps)}
          />
          <EditableRow
            label="Accommodation Payroll"
            hint="Front office, housekeeping wages"
            value={state.deptCosts.accommodationPayroll}
            onChange={(v) => setDept("accommodationPayroll", v)}
            pctOfRevenue={pct(state.deptCosts.accommodationPayroll)}
          />
          <EditableRow
            label="CANAL — Cost of Sales"
            hint="Food + beverage cost"
            value={state.deptCosts.canalCogs}
            onChange={(v) => setDept("canalCogs", v)}
            pctOfRevenue={pct(state.deptCosts.canalCogs)}
          />
          <EditableRow
            label="F&B Payroll"
            hint="Kitchen + service team"
            value={state.deptCosts.fbPayroll}
            onChange={(v) => setDept("fbPayroll", v)}
            pctOfRevenue={pct(state.deptCosts.fbPayroll)}
          />
          <EditableRow
            label="MEADOW — Cost of Sales"
            value={state.deptCosts.meadowCogs}
            onChange={(v) => setDept("meadowCogs", v)}
            pctOfRevenue={pct(state.deptCosts.meadowCogs)}
          />
          <EditableRow
            label="GROUNDING — Cost of Sales"
            value={state.deptCosts.groundingCogs}
            onChange={(v) => setDept("groundingCogs", v)}
            pctOfRevenue={pct(state.deptCosts.groundingCogs)}
          />
        </SectionFrame>

        {/* ── Departmental Profit (computed callout) ────────── */}
        <div
          style={{
            background: R.darkBand,
            border: `1px solid ${R.border}`,
            borderRadius: 8,
            padding: "12px 18px",
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Departmental Profit
            </div>
            <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
              Total Revenue − Total Departmental Expenses
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 11, color: R.textDim }}>{pct(totals.deptProfit).toFixed(1)}%</span>
            <span style={{ fontSize: 18, color: R.text, fontWeight: 500 }}>{fmt(totals.deptProfit)}</span>
          </div>
        </div>

        {/* ── Undistributed Operating Expenses ─────────────────── */}
        <SectionFrame
          title="Undistributed Operating Expenses"
          subtitle="Property-wide overheads"
          subtotal={totals.totalUndistributed}
          subtotalLabel="Total Undistributed"
          subtotalPct={pct(totals.totalUndistributed)}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 160px", padding: "8px 0", borderBottom: `1px solid ${R.sep}` }}>
            <div />
            <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>% of Rev</div>
            <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right", paddingRight: 12 }}>Amount</div>
          </div>

          <EditableRow label="Administrative & General" value={state.undistributed.adminGeneral} onChange={(v) => setUndist("adminGeneral", v)} pctOfRevenue={pct(state.undistributed.adminGeneral)} />
          <EditableRow label="Sales & Marketing" value={state.undistributed.salesMarketing} onChange={(v) => setUndist("salesMarketing", v)} pctOfRevenue={pct(state.undistributed.salesMarketing)} />
          <EditableRow label="Property Operations & Maintenance" value={state.undistributed.propertyOps} onChange={(v) => setUndist("propertyOps", v)} pctOfRevenue={pct(state.undistributed.propertyOps)} />
          <EditableRow label="Utilities" value={state.undistributed.utilities} onChange={(v) => setUndist("utilities", v)} pctOfRevenue={pct(state.undistributed.utilities)} />
          <EditableRow label="IT / Telecom" value={state.undistributed.itTelecom} onChange={(v) => setUndist("itTelecom", v)} pctOfRevenue={pct(state.undistributed.itTelecom)} />
        </SectionFrame>

        {/* ── Final GOP card ────────────────────────────────── */}
        <div
          style={{
            background: R.darkBand,
            border: `1px solid ${R.border}`,
            borderRadius: 10,
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Gross Operating Profit
            </div>
            <div style={{ fontSize: 10, color: R.textDim, marginTop: 4 }}>
              Departmental Profit − Total Undistributed Expenses
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 22, fontVariantNumeric: "tabular-nums" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>Margin</div>
              <div
                style={{
                  fontSize: 16,
                  color: totals.gop >= 0 ? "rgba(52,208,104,0.78)" : "rgba(239,68,68,0.78)",
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {totals.gopPct.toFixed(1)}%
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>GOPPAR</div>
              <div style={{ fontSize: 16, color: R.text, fontWeight: 500, marginTop: 2 }}>{fmt(totals.goppar)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>GOP £</div>
              <div
                style={{
                  fontSize: 28,
                  color: totals.gop >= 0 ? "rgba(52,208,104,0.85)" : "rgba(239,68,68,0.85)",
                  fontWeight: 500,
                  marginTop: 2,
                  letterSpacing: -0.4,
                }}
              >
                {fmtSigned(totals.gop)}
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: R.textDim, marginTop: 16, textAlign: "center" }}>
          {seed.rooms} rooms × {seed.daysInMonth} days = {totals.availableRoomNights.toLocaleString()} available room-nights · used for GOPPAR
        </div>
      </div>
    </div>
  );
}
