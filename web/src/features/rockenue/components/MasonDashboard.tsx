import { useMemo, useState, useEffect } from "react";
import { useDashboardData } from "../../dashboard/hooks/useDashboardData";
import { RecentBookings } from "../../dashboard/components/RecentBookings";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { R } from "../../../styles/tokens";

// ── Mason & Fifth Dashboard — Studio mockup ──
// Mirrors HotelDashboard layout but KPI cards aggregate the three Mews
// Reservable services (Short / Mid / Long Stay) and the Recent Bookings
// panel is scoped to Short Stay only.

export const SERVICES = [
  { key: "short", label: "Short Stay", color: "#7BAFD4" },
  { key: "mid", label: "Mid Stay", color: R.gold },
  { key: "long", label: "Long Stay", color: R.warmTeal },
] as const;

interface MasonHotel {
  hotelId: number;
  name: string;
  shortName: string;
}

export type ServiceKey = (typeof SERVICES)[number]["key"];
export type ServiceSplit = Record<ServiceKey, number>;

export interface MonthCard {
  label: string;
  title: string;
  revenueBy: ServiceSplit;
  occupancy: number;
  adr: number;
  adrByService: ServiceSplit;
  occByService: ServiceSplit;
}

const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

// Three-month window: last / current / next (relative to today)
export function buildWindow() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const from = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDayOfNext = new Date(next.getFullYear(), next.getMonth() + 1, 0);
  const to = `${lastDayOfNext.getFullYear()}-${String(lastDayOfNext.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfNext.getDate()).padStart(2, "0")}`;
  return {
    from,
    to,
    months: [monthKey(last), monthKey(current), monthKey(next)],
    titles: ["Last Month", "Current Month", "Next Month"],
  };
}

const fmt = (v: number) =>
  `£${Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatCompact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 10_000) return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return Math.round(value).toLocaleString();
};

export function MonthCardView({ card, impliedAmr = false }: { card: MonthCard; impliedAmr?: boolean }) {
  const total =
    card.revenueBy.short + card.revenueBy.mid + card.revenueBy.long;
  // Implied AMR (Average Monthly Rate) = nightly ADR × 30.44 (avg days/month).
  // Long Stay's ADR is already a monthly figure (§15.1 monthly billing), so it
  // IS the AMR — don't multiply it. Used on the Sales Flash cards per Dom's
  // request to replace per-segment occupancy with implied AMR.
  const AMR_DAYS = 30.44;
  const amrByService = {
    short: card.adrByService.short * AMR_DAYS,
    mid: card.adrByService.mid * AMR_DAYS,
    long: card.adrByService.long,
  };

  return (
    <div
      style={{
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        padding: "18px 20px",
        background: R.darkBand,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: R.accent,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            fontSize: 10,
            color: R.textDim,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginTop: 2,
          }}
        >
          {card.label}
        </div>
      </div>

      {/* Unified grid: [dot | name | Revenue | Occ | ADR]
          Name column hugs its content, Revenue sits centred in the flexible
          middle column (between service name and Occ), Occ and ADR pinned
          to the right at fixed widths. */}
      {(() => {
        const grid = "12px auto 1fr 72px 72px";
        const smallLabel = {
          fontSize: 8,
          color: R.textDim,
          textTransform: "uppercase" as const,
          letterSpacing: 0.8,
          fontWeight: 600,
          marginBottom: 3,
        };
        const smallValue = {
          fontSize: 14,
          color: R.accent,
          fontWeight: 600,
          letterSpacing: -0.3,
        };
        return (
          <>
            {/* Hero row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: grid,
                columnGap: 18,
                alignItems: "end",
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: `1px solid ${R.sep}`,
              }}
            >
              <div style={{ gridColumn: "1 / 4", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#7BAFD4",
                    letterSpacing: -0.8,
                    lineHeight: 1,
                    marginBottom: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmt(total)}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: R.textDim,
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  Total Revenue · 3 services
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={smallLabel}>Occupancy</div>
                <div style={smallValue}>{card.occupancy.toFixed(1)}%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={smallLabel}>Avg ADR</div>
                <div style={smallValue}>{fmt(card.adr)}</div>
              </div>
            </div>

            {/* Service rows — Revenue / (Occ | Implied AMR) / ADR */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {impliedAmr && (
                <div style={{ display: "grid", gridTemplateColumns: grid, columnGap: 18 }}>
                  <span /><span /><span />
                  <span style={{ ...smallLabel, textAlign: "right", marginBottom: 0 }}>Implied AMR</span>
                  <span style={{ ...smallLabel, textAlign: "right", marginBottom: 0 }}>ADR</span>
                </div>
              )}
              {SERVICES.map((svc) => {
                const value = card.revenueBy[svc.key];
                const svcAdr = card.adrByService[svc.key];
                const svcOcc = card.occByService[svc.key];
                const svcAmr = amrByService[svc.key];
                return (
                  <div
                    key={svc.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: grid,
                      alignItems: "center",
                      columnGap: 18,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: svc.color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: R.text,
                        fontWeight: 500,
                        letterSpacing: -0.1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {svc.label}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: R.accent,
                        fontWeight: 600,
                        letterSpacing: -0.3,
                        textAlign: "center",
                      }}
                    >
                      {fmt(value)}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: R.textMid,
                        fontWeight: 500,
                        textAlign: "right",
                      }}
                    >
                      {impliedAmr ? fmt(svcAmr) : `${svcOcc.toFixed(0)}%`}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: R.textMid,
                        fontWeight: 500,
                        textAlign: "right",
                      }}
                    >
                      {impliedAmr && svc.key === "long" ? (
                        <span style={{ color: R.textDim }}>—</span>
                      ) : (
                        <>
                          {fmt(svcAdr)}
                          {svc.key === "long" && svcAdr > 0 && !impliedAmr && (
                            <span style={{ color: R.textDim, fontSize: 10, marginLeft: 3 }}>/mo</span>
                          )}
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

          </>
        );
      })()}
    </div>
  );
}

function OccupancyChart({ data, loading }: { data: any[]; loading: boolean }) {
  const [pickup, setPickup] = useState<"24h" | "3d" | "7d">("24h");

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const pickupValue = pickup === "24h" ? d.pickup24h : pickup === "3d" ? d.pickup3d : d.pickup7d;
    const pickupLabel = pickup === "24h" ? "Pickup 24h" : pickup === "3d" ? "Pickup 3d" : "Pickup 7d";
    // pickupValue is null when the baseline snapshot for the window is missing.
    const pickupText = pickupValue == null ? "n/a" : `${pickupValue >= 0 ? "+" : ""}${Number(pickupValue).toFixed(1)}%`;
    return (
      <div style={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: "10px 14px" }}>
        <div style={{ color: R.textMid, fontSize: 11, marginBottom: 6 }}>{d.fullDate}</div>
        <div style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Occupancy: {Number(d.occupancy).toFixed(1)}%</div>
        <div style={{ color: R.textDim, fontSize: 11, marginTop: 3 }}>
          {pickupLabel}: {pickupText}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${R.sep}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>
              90 Day Occupancy & Pickup
            </div>
            <span
              title="Covers every reservation at this property — Short, Mid and Long Stay services combined."
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: R.warmTeal,
                background: "rgba(56,198,186,0.10)",
                border: "1px solid rgba(56,198,186,0.25)",
                borderRadius: 4,
                padding: "2px 7px",
              }}
            >
              All Services
            </span>
          </div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
            Occupancy trend with booking velocity overlay
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 2,
            background: R.heroBg,
            padding: 3,
            borderRadius: 6,
            border: `1px solid ${R.border}`,
          }}
        >
          {(["24h", "3d", "7d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPickup(p)}
              style={{
                padding: "4px 10px",
                fontSize: 10,
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: pickup === p ? "#7BAFD4" : "transparent",
                color: pickup === p ? R.darkBand : R.textDim,
                fontWeight: pickup === p ? 600 : 400,
                textTransform: "uppercase",
                letterSpacing: -0.3,
              }}
            >
              {p === "24h" ? "24h" : p === "3d" ? "3 Days" : "7 Days"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px 20px 16px", flex: 1, minHeight: 360, position: "relative" }}>
        {loading && (!data || data.length === 0) && (
          <div
            style={{
              position: "absolute",
              inset: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: R.textDim,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Loading occupancy & pickup…
          </div>
        )}
        {!loading && (!data || data.length === 0) ? (
          <div
            style={{
              position: "absolute",
              inset: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: R.textDim,
              fontSize: 11,
            }}
          >
            No occupancy data yet for this property.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data || []} margin={{ top: 5, right: 10, left: 4, bottom: 5 }}>
              <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.25} vertical={false} />
              <XAxis
                dataKey="date"
                stroke={R.border}
                tick={{ fill: R.textDim, fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: R.border, strokeOpacity: 0.3 }}
                interval={6}
              />
              <YAxis
                stroke={R.border}
                tick={{ fill: R.textDim, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={42}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: "rgba(123,175,212,0.05)" }}
                content={<CustomTooltip />}
              />
              <Bar
                dataKey={
                  pickup === "24h"
                    ? "baseOccupancy24h"
                    : pickup === "3d"
                      ? "baseOccupancy3d"
                      : "baseOccupancy7d"
                }
                stackId="o"
                name="Occupancy"
                radius={[0, 0, 0, 0]}
                maxBarSize={10}
                fill={R.textDim}
                fillOpacity={0.5}
              />
              <Bar
                dataKey={
                  pickup === "24h" ? "pickup24h" : pickup === "3d" ? "pickup3d" : "pickup7d"
                }
                stackId="o"
                name="Pickup"
                radius={[2, 2, 0, 0]}
                maxBarSize={10}
                fill="#7BAFD4"
                fillOpacity={0.85}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function DemandChart({ rawData, loading }: { rawData: any[]; loading: boolean }) {
  // Compute 7-day moving average on top of the live demand bars.
  const days = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    return rawData.map((entry, i) => {
      const win = rawData.slice(Math.max(0, i - 6), i + 1);
      const ma = Math.round(
        win.reduce((s: number, x: any) => s + (x.marketDemand || 0), 0) / win.length,
      );
      return { ...entry, demandMa: ma };
    });
  }, [rawData]);

  return (
    <div style={{ width: "100%", padding: 20, textAlign: "left" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>
            How Busy Is the Market?
          </div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
            Market demand score — higher means busier, stronger pricing power
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 12, height: 2, background: R.warmTeal, borderRadius: 1 }} />
            <span style={{ fontSize: 9, color: R.textDim }}>Demand</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 12, height: 2, background: R.warmTeal, borderRadius: 1, opacity: 0.7 }} />
            <span style={{ fontSize: 9, color: R.textDim }}>7d trend</span>
          </div>
          <ExternalLink size={14} style={{ color: R.textDim }} />
        </div>
      </div>

      <div style={{ height: 260, position: "relative" }}>
        {loading && days.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: R.textDim,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Loading market demand…
          </div>
        )}
        {!loading && days.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: R.textDim,
              fontSize: 11,
            }}
          >
            No demand data yet for this property.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={days} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <XAxis
                dataKey="date"
                stroke={R.border}
                tick={{ fill: R.textDim, fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: R.border, strokeOpacity: 0.3 }}
                interval={13}
              />
              <YAxis
                stroke={R.border}
                tick={{ fill: R.textDim, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={35}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                cursor={{ stroke: R.warmTeal, strokeOpacity: 0.15, strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: "rgba(18,21,25,0.95)",
                  border: `1px solid ${R.border}`,
                  borderRadius: 6,
                  padding: "10px 14px",
                }}
                labelStyle={{ color: R.textMid, fontSize: 11, marginBottom: 4 }}
                itemStyle={{ fontSize: 12, color: R.text, padding: "1px 0" }}
                formatter={(v: number, name: string) => [`${v}%`, name]}
              />
              <Bar dataKey="marketDemand" name="Demand" radius={[2, 2, 0, 0]} maxBarSize={10}>
                {days.map((d: any, i: number) => {
                  const v = d.marketDemand || 0;
                  if (v >= 85) return <Cell key={i} fill={R.red} fillOpacity={0.75} />;
                  if (v >= 70) return <Cell key={i} fill={R.gold} fillOpacity={0.55} />;
                  return <Cell key={i} fill={R.warmTeal} fillOpacity={0.25 + (v / 100) * 0.45} />;
                })}
              </Bar>
              <Line
                type="monotone"
                dataKey="demandMa"
                name="7d trend"
                stroke={R.warmTeal}
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                strokeOpacity={0.7}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  YEAR ON YEAR — Vertical P&L Table (wired to live Mews data)
// ════════════════════════════════════════════════════════════════════

const YOY_MONTHS_FULL = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtK(v: number) {
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 10_000) return `£${(v / 1_000).toFixed(0)}k`;
  if (Math.abs(v) >= 1_000) return `£${(v / 1_000).toFixed(1)}k`;
  if (v === 0) return "—";
  return `£${Math.round(v)}`;
}

function pctStr(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: R.accent, letterSpacing: -0.2 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: R.textDim, marginTop: 3 }}>{subtitle}</div>
      )}
    </div>
  );
}

function DeltaChip({ pct, size = "md" }: { pct: number | null; size?: "sm" | "md" }) {
  if (pct === null || !isFinite(pct)) {
    return <span style={{ fontSize: size === "sm" ? 10 : 11, color: R.textDim }}>—</span>;
  }
  const up = pct >= 0;
  const fontSize = size === "sm" ? 10 : 11;
  const pad = size === "sm" ? "2px 6px" : "3px 8px";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: pad,
        fontSize,
        fontWeight: 700,
        borderRadius: 4,
        color: up ? R.green : R.red,
        background: up ? "rgba(52,208,104,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${up ? "rgba(52,208,104,0.25)" : "rgba(239,68,68,0.25)"}`,
      }}
    >
      {up ? "▲" : "▼"} {pctStr(pct)}
    </span>
  );
}

function deltaPct(ty: number, ly: number): number | null {
  if (!ly || ly === 0) return null;
  return ((ty - ly) / ly) * 100;
}

interface YoYRow {
  // 12 values per service, indexed 0..11 for Jan..Dec
  ty: number[];
  ly: number[];
}

interface YoYTableData {
  byService: Record<ServiceKey, YoYRow>;
  actualMonths: number; // months completed this year (for YTD + styling)
  tyYear: number;
  lyYear: number;
}

function YoYPnLTable({
  data,
  loading,
  error,
  vatMode,
}: {
  data: YoYTableData | null;
  loading: boolean;
  error: string | null;
  vatMode: VatMode;
}) {
  const vatLabel = vatMode === "gross" ? "Gross (incl. VAT)" : "Net (excl. VAT)";

  return (
    <div
      style={{
        background: R.darkBand,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        padding: 20,
        fontFamily: "'Inter', system-ui, sans-serif",
        fontVariantNumeric: "tabular-nums",
        overflowX: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <SectionHeader
          title="Year on Year"
          subtitle={
            data
              ? `${data.tyYear} vs ${data.lyYear} · total revenue per month · YTD through month ${data.actualMonths} · ${vatLabel}`
              : loading
                ? "Loading 12 months TY + 12 months LY from Mews…"
                : "—"
          }
        />
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 6,
            color: R.red,
            fontSize: 12,
          }}
        >
          Failed to load YoY data: {error}
        </div>
      )}

      {loading && !data && <YoYSkeleton />}

      {data && <YoYPnLTableInner data={data} vatMode={vatMode} />}
    </div>
  );
}

function YoYPnLTableInner({ data, vatMode: _ }: { data: YoYTableData; vatMode: VatMode }) {
  const { byService, actualMonths, tyYear, lyYear } = data;

  // Total = sum of all services per month. Per-service rows aren't shown
  // because the AccountingCategory split (Short / Mid / Long) wasn't in
  // place for most of LY at either Mason property — comparing TY-Short vs
  // LY-Short on its own is misleading. Total-only is the only honest
  // comparison while LY data is mid-migration. See blueprint §10.
  const totTy = YOY_MONTHS_FULL.map((_, i) =>
    SERVICES.reduce((a, s) => a + (byService[s.key].ty[i] || 0), 0),
  );
  const totLy = YOY_MONTHS_FULL.map((_, i) =>
    SERVICES.reduce((a, s) => a + (byService[s.key].ly[i] || 0), 0),
  );

  const ytdTotTy = totTy.slice(0, actualMonths).reduce((a, b) => a + b, 0);
  const ytdTotLy = totLy.slice(0, actualMonths).reduce((a, b) => a + b, 0);
  const ytdDelta = deltaPct(ytdTotTy, ytdTotLy);

  const grid = "150px repeat(12, 1fr) 90px";

  return (
    <div style={{ minWidth: 1040 }}>
      {/* Month header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid,
          padding: "6px 0",
          borderBottom: `1px solid ${R.border}`,
        }}
      >
        <div />
        {YOY_MONTHS_FULL.map((m, i) => (
          <div
            key={m}
            style={{
              fontSize: 9,
              color: i >= actualMonths ? R.textDim : R.textMid,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontWeight: 600,
              textAlign: "right",
              padding: "0 6px",
            }}
          >
            {m}
          </div>
        ))}
        <div
          style={{
            fontSize: 9,
            color: R.gold,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            fontWeight: 700,
            textAlign: "right",
            padding: "0 6px",
          }}
        >
          YTD
        </div>
      </div>

      {/* Total Revenue label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 0 4px",
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 3, background: "#7BAFD4" }} />
        <span
          style={{
            fontSize: 12,
            color: R.accent,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Total Revenue
        </span>
      </div>

      {/* TY row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid,
          padding: "4px 0",
        }}
      >
        <div style={{ paddingLeft: 18, fontSize: 10, color: R.textMid, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {tyYear}
        </div>
        {totTy.map((v, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              color: "#7BAFD4",
              fontWeight: 600,
              textAlign: "right",
              padding: "0 6px",
              opacity: i >= actualMonths ? 0.45 : 1,
            }}
          >
            {fmtK(v)}
          </div>
        ))}
        <div style={{ fontSize: 12, color: "#7BAFD4", fontWeight: 700, textAlign: "right", padding: "0 6px" }}>
          {fmtK(ytdTotTy)}
        </div>
      </div>

      {/* LY row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid,
          padding: "4px 0",
        }}
      >
        <div style={{ paddingLeft: 18, fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {lyYear}
        </div>
        {totLy.map((v, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              color: R.textMid,
              textAlign: "right",
              padding: "0 6px",
            }}
          >
            {fmtK(v)}
          </div>
        ))}
        <div style={{ fontSize: 12, color: R.textMid, textAlign: "right", padding: "0 6px" }}>
          {fmtK(ytdTotLy)}
        </div>
      </div>

      {/* Δ row — months with no LY data render as "—" via deltaPct returning null */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid,
          padding: "4px 0 8px",
        }}
      >
        <div style={{ paddingLeft: 18, fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.4 }}>
          Δ%
        </div>
        {totTy.map((v, i) => {
          const d = deltaPct(v, totLy[i]);
          return (
            <div
              key={i}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: d === null ? R.textDim : d >= 0 ? R.green : R.red,
                textAlign: "right",
                padding: "0 6px",
                opacity: i >= actualMonths ? 0.45 : 1,
              }}
            >
              {d === null ? "—" : pctStr(d)}
            </div>
          );
        })}
        <div style={{ textAlign: "right", padding: "0 6px" }}>
          <DeltaChip pct={ytdDelta} size="sm" />
        </div>
      </div>
    </div>
  );
}

function YoYSkeleton() {
  return (
    <div style={{ minWidth: 1040 }}>
      {/* header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "150px repeat(12, 1fr) 90px",
          padding: "6px 0",
          borderBottom: `1px solid ${R.border}`,
          gap: 6,
        }}
      >
        <div />
        {YOY_MONTHS_FULL.map((_, i) => (
          <SkeletonBar key={i} width="100%" height={8} />
        ))}
        <SkeletonBar width="100%" height={8} />
      </div>

      <div style={{ padding: "10px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: "#7BAFD4", opacity: 0.45 }} />
          <SkeletonBar width={120} height={10} />
        </div>
        {[0, 1, 2].map((rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: "150px repeat(12, 1fr) 90px",
              gap: 6,
              padding: "4px 0",
            }}
          >
            <div style={{ paddingLeft: 18 }}>
              <SkeletonBar width={40} height={8} />
            </div>
            {YOY_MONTHS_FULL.map((_, i) => (
              <SkeletonBar key={i} width="100%" height={10} />
            ))}
            <SkeletonBar width="100%" height={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ApiServiceBucket {
  name: string;
  gross: number;
  net: number;
  items: number;
  nights: number;
}

export interface ApiMonthRow {
  month: string;
  services: Record<ServiceKey, ApiServiceBucket>;
  totalGross: number;
  totalNet: number;
}

export interface ApiResponse {
  hotelId: number;
  hotelName: string;
  from: string;
  to: string;
  timezone: string;
  monthly: ApiMonthRow[];
  itemsScanned: number;
  elapsedMs?: number;
  cachedAt?: number;
}

export type VatMode = "gross" | "net";

// Classy pulse animation for skeletons
export const SKELETON_PULSE_KEYFRAMES = `
@keyframes masonPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
@keyframes masonShimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

export function SkeletonBar({
  width,
  height = 10,
  radius = 3,
}: {
  width: number | string;
  height?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: `linear-gradient(90deg, ${R.heroBg} 0%, ${R.cardLight} 50%, ${R.heroBg} 100%)`,
        backgroundSize: "200% 100%",
        animation: "masonShimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}

export function MonthCardSkeleton({ title, label }: { title: string; label: string }) {
  return (
    <div
      style={{
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        padding: "18px 20px",
        background: R.darkBand,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: R.accent,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 10,
            color: R.textDim,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>

      <SkeletonBar width={140} height={22} radius={4} />
      <div style={{ height: 8 }} />
      <SkeletonBar width={96} height={8} />

      <div style={{ height: 18 }} />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 16,
          borderBottom: `1px solid ${R.sep}`,
        }}
      >
        {SERVICES.map((svc) => (
          <div
            key={svc.key}
            style={{
              display: "grid",
              gridTemplateColumns: "12px minmax(76px, 1fr) 44px 1fr",
              alignItems: "center",
              columnGap: 12,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: svc.color,
                opacity: 0.45,
              }}
            />
            <SkeletonBar width={72} height={11} />
            <SkeletonBar width={28} height={9} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <SkeletonBar width={80} height={14} />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 18,
        }}
      >
        <div>
          <SkeletonBar width={52} height={8} />
          <div style={{ height: 6 }} />
          <SkeletonBar width={56} height={14} />
        </div>
        <div>
          <SkeletonBar width={30} height={8} />
          <div style={{ height: 6 }} />
          <SkeletonBar width={56} height={14} />
        </div>
      </div>
    </div>
  );
}

// Aggregate multiple per-hotel revenue responses into a single combined response.
// Sums gross/net/items per month × service across all included hotels.
function aggregateRevenueResponses(
  responses: ApiResponse[],
  label: string,
): ApiResponse {
  const byMonth = new Map<string, ApiMonthRow>();
  for (const resp of responses) {
    for (const row of resp.monthly) {
      let agg = byMonth.get(row.month);
      if (!agg) {
        agg = {
          month: row.month,
          services: {
            short: { name: "Short Stay", gross: 0, net: 0, items: 0 },
            mid: { name: "Mid Stay", gross: 0, net: 0, items: 0 },
            long: { name: "Long Stay", gross: 0, net: 0, items: 0 },
          },
          totalGross: 0,
          totalNet: 0,
        };
        byMonth.set(row.month, agg);
      }
      for (const key of ["short", "mid", "long"] as ServiceKey[]) {
        const bucket = row.services?.[key];
        if (!bucket) continue;
        agg.services[key].gross += bucket.gross;
        agg.services[key].net += bucket.net;
        agg.services[key].items += bucket.items;
      }
      agg.totalGross += row.totalGross;
      agg.totalNet += row.totalNet;
    }
  }
  const monthly = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const first = responses[0];
  return {
    hotelId: -1,
    hotelName: label,
    from: first?.from || "",
    to: first?.to || "",
    timezone: first?.timezone || "Europe/London",
    monthly,
    itemsScanned: responses.reduce((a, r) => a + r.itemsScanned, 0),
  };
}

interface MasonDashboardProps {
  /**
   * If set, the dashboard shows numbers for only this single Mason hotel.
   * If null/undefined, it aggregates across every Mason hotel the user has
   * access to (admin "Mason Dashboard" synthetic entry path).
   */
  scopedHotelId?: number | null;
  onNavigate?: (view: string) => void;
}

export function MasonDashboard({ scopedHotelId = null, onNavigate }: MasonDashboardProps = {}) {
  const window = useMemo(buildWindow, []);
  const [accessibleHotels, setAccessibleHotels] = useState<MasonHotel[] | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [vatMode, setVatMode] = useState<VatMode>("gross");

  // Inner hotel picker — only used when scopedHotelId is null (admin path).
  const [internalPick, setInternalPick] = useState<number | null>(null);
  const [hotelMenuOpen, setHotelMenuOpen] = useState(false);

  // Year-on-year state: full TY + full LY, fetched in parallel per hotel.
  const tyYear = new Date().getFullYear();
  const lyYear = tyYear - 1;
  const [yoyApi, setYoyApi] = useState<{ ty: ApiResponse; ly: ApiResponse } | null>(null);
  const [yoyLoading, setYoyLoading] = useState(true);
  const [yoyError, setYoyError] = useState<string | null>(null);

  // 1. Discover which M&F hotels the user is entitled to see.
  useEffect(() => {
    fetch("/api/mason/access")
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error || r.statusText))))
      .then((d: { hotels: MasonHotel[] }) => {
        setAccessibleHotels(d.hotels || []);
      })
      .catch((e) => setAccessError(String(e?.message || e)));
  }, []);

  // Seed the inner picker once we know the user's accessible hotels.
  useEffect(() => {
    if (scopedHotelId != null) return;
    if (internalPick != null) return;
    if (!accessibleHotels || accessibleHotels.length === 0) return;
    setInternalPick(accessibleHotels[0].hotelId);
  }, [accessibleHotels, scopedHotelId, internalPick]);

  // Resolve the single hotel to display. Priority:
  //   1. scopedHotelId prop (came from the main property dropdown)
  //   2. internalPick (admin picked from the inner dropdown)
  const activeHotelId = scopedHotelId ?? internalPick;
  const activeHotel = useMemo(() => {
    if (!accessibleHotels || activeHotelId == null) return null;
    return accessibleHotels.find((h) => h.hotelId === activeHotelId) || null;
  }, [accessibleHotels, activeHotelId]);
  const showInnerPicker =
    scopedHotelId == null && (accessibleHotels?.length ?? 0) > 1;

  const hotelKey = activeHotelId != null ? String(activeHotelId) : "";
  const portfolioLabel = activeHotel?.name || "Mason & Fifth";

  // Reuse the standard dashboard endpoint for occupancy + market demand.
  // All M&F hotels are in London, so we hard-code the city slug. The hook
  // waits until both params are set before firing.
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData(
    activeHotelId,
    "london",
  );

  // 2. Fetch current window data for the single active hotel.
  useEffect(() => {
    if (activeHotelId == null) return;
    setLoading(true);
    setError(null);
    setApiData(null);
    fetch(
      `/api/mason/service-revenue?hotelId=${activeHotelId}&from=${window.from}&to=${window.to}`,
    )
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error || r.statusText))))
      .then((d: ApiResponse) => setApiData(d))
      .catch((e) => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [hotelKey, window.from, window.to, activeHotelId]);

  // 3. Fetch YoY data (full TY + full LY) for the single active hotel.
  useEffect(() => {
    if (activeHotelId == null) return;
    setYoyLoading(true);
    setYoyError(null);
    setYoyApi(null);
    const tyUrl = `/api/mason/service-revenue?hotelId=${activeHotelId}&from=${tyYear}-01-01&to=${tyYear}-12-31`;
    const lyUrl = `/api/mason/service-revenue?hotelId=${activeHotelId}&from=${lyYear}-01-01&to=${lyYear}-12-31`;
    Promise.all([
      fetch(tyUrl).then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error || r.statusText)))),
      fetch(lyUrl).then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error || r.statusText)))),
    ])
      .then(([ty, ly]: [ApiResponse, ApiResponse]) => setYoyApi({ ty, ly }))
      .catch((e) => setYoyError(String(e?.message || e)))
      .finally(() => setYoyLoading(false));
  }, [hotelKey, tyYear, lyYear, activeHotelId]);

  const yoyData: YoYTableData | null = useMemo(() => {
    if (!yoyApi) return null;
    const byService: Record<ServiceKey, YoYRow> = {
      short: { ty: Array(12).fill(0), ly: Array(12).fill(0) },
      mid: { ty: Array(12).fill(0), ly: Array(12).fill(0) },
      long: { ty: Array(12).fill(0), ly: Array(12).fill(0) },
    };
    const pick = (bucket: { gross: number; net: number } | undefined) =>
      (vatMode === "net" ? bucket?.net : bucket?.gross) || 0;

    for (const row of yoyApi.ty.monthly) {
      const idx = parseInt(row.month.split("-")[1], 10) - 1;
      if (idx < 0 || idx > 11) continue;
      for (const svc of SERVICES) {
        byService[svc.key].ty[idx] = pick(row.services?.[svc.key]);
      }
    }
    for (const row of yoyApi.ly.monthly) {
      const idx = parseInt(row.month.split("-")[1], 10) - 1;
      if (idx < 0 || idx > 11) continue;
      for (const svc of SERVICES) {
        byService[svc.key].ly[idx] = pick(row.services?.[svc.key]);
      }
    }

    // actualMonths = completed months so far this year (Jan..today's month, inclusive)
    const today = new Date();
    const actualMonths = today.getFullYear() === tyYear ? today.getMonth() + 1 : 12;

    return { byService, actualMonths, tyYear, lyYear };
  }, [yoyApi, vatMode, tyYear, lyYear]);

  const cards: MonthCard[] = useMemo(() => {
    const out: MonthCard[] = [];
    // Headline occupancy + headline ADR come from useDashboardData's monthly
    // snapshot. rooms_sold is property-wide (capacity − availability per
    // Blueprint §10); revenue there is Short-Stay only, so we recover
    // property-wide room nights as revenue/adr and divide the live 3-service
    // revenue by it to get a true property-wide ADR.
    const snapshotForIndex = (i: number) => {
      if (!dashboardData?.snapshot) return null;
      if (i === 0) return dashboardData.snapshot.lastMonth;
      if (i === 1) return dashboardData.snapshot.currentMonth;
      if (i === 2) return dashboardData.snapshot.nextMonth;
      return null;
    };
    window.months.forEach((m, i) => {
      const row = apiData?.monthly.find((x) => x.month === m);
      const byService: ServiceSplit = { short: 0, mid: 0, long: 0 };
      const nightsByService: ServiceSplit = { short: 0, mid: 0, long: 0 };
      for (const svc of SERVICES) {
        const bucket = row?.services?.[svc.key];
        byService[svc.key] = (vatMode === "net" ? bucket?.net : bucket?.gross) || 0;
        nightsByService[svc.key] = bucket?.nights || 0;
      }
      const snapshot = snapshotForIndex(i);
      const occupancy = snapshot?.occupancy ?? 0;
      // Room nights = snapshot revenue / snapshot ADR (both DB-sourced, gross,
      // so the /1.2 cancels). Always gross on both sides.
      const roomNights = snapshot && snapshot.adr > 0 ? snapshot.revenue / snapshot.adr : 0;
      // Property capacity = room nights ÷ occupancy fraction. Used as the
      // denominator for per-service occupancy so the three service shares
      // sum to the property-wide headline occupancy.
      const capacityNights = occupancy > 0 ? roomNights / (occupancy / 100) : 0;
      const totalRevenue = byService.short + byService.mid + byService.long;
      const adr = roomNights > 0 ? totalRevenue / roomNights : 0;
      // Per-service ADR: Short/Mid = £/night (daily SpaceOrder). Long Stay
      // SpaceOrders are monthly units, so its "ADR" is really £/month — UI
      // labels it accordingly.
      const svcAdr = (key: ServiceKey) =>
        nightsByService[key] > 0 ? byService[key] / nightsByService[key] : 0;
      // Long Stay SpaceOrders are monthly units — scale by ~30 to get
      // approximate room-days for the occupancy share. Rough (±20%) but
      // keeps the share visible instead of rounding to 0%.
      const LONG_NIGHTS_PER_UNIT = 30;
      const svcOcc = (key: ServiceKey) => {
        if (capacityNights <= 0) return 0;
        const scale = key === "long" ? LONG_NIGHTS_PER_UNIT : 1;
        return (nightsByService[key] * scale / capacityNights) * 100;
      };
      out.push({
        title: window.titles[i],
        label: monthLabel(m),
        revenueBy: byService,
        occupancy,
        adr,
        adrByService: {
          short: svcAdr("short"),
          mid: svcAdr("mid"),
          long: svcAdr("long"),
        },
        occByService: {
          short: svcOcc("short"),
          mid: svcOcc("mid"),
          long: svcOcc("long"),
        },
      });
    });
    return out;
  }, [apiData, dashboardData, window.months, window.titles, vatMode]);

  const placeholderLabels = useMemo(() => {
    return window.months.map((m, i) => ({
      title: window.titles[i],
      label: monthLabel(m),
    }));
  }, [window.months, window.titles]);

  return (
    <div
      style={{
        flex: 1,
        background: R.bg,
        color: R.accent,
        fontFamily: "'Inter', system-ui, sans-serif",
        minHeight: "100vh",
      }}
    >
      <style>{SKELETON_PULSE_KEYFRAMES}</style>

      {/* Top bar — property selector */}
      <div
        style={{
          padding: "14px 28px",
          borderBottom: `1px solid ${R.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 2,
              color: R.gold,
              textTransform: "uppercase",
            }}
          >
            Mason Dashboard
          </div>

          {/* Property scope — dropdown when admin has multiple hotels,
              static readout when pinned to a single scope via the main
              property selector. */}
          {showInnerPicker ? (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setHotelMenuOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: R.cardRaised,
                  border: `1px solid ${hotelMenuOpen ? R.warmTeal : R.border}`,
                  borderRadius: 6,
                  padding: "6px 12px 6px 14px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                  minWidth: 260,
                }}
              >
                <span style={{ fontSize: 13, color: R.accent, fontWeight: 600, flex: 1, textAlign: "left" }}>
                  {portfolioLabel}
                </span>
                <ChevronDown
                  size={14}
                  color={R.textMid}
                  style={{
                    transition: "transform 0.15s",
                    transform: hotelMenuOpen ? "rotate(180deg)" : "none",
                  }}
                />
              </button>

              {hotelMenuOpen && (
                <>
                  <div
                    onClick={() => setHotelMenuOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 10 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      minWidth: 260,
                      background: R.cardRaised,
                      border: `1px solid ${R.border}`,
                      borderRadius: 8,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                      padding: 4,
                      zIndex: 11,
                    }}
                  >
                    {accessibleHotels?.map((h) => {
                      const active = h.hotelId === activeHotelId;
                      return (
                        <button
                          key={h.hotelId}
                          onClick={() => {
                            setInternalPick(h.hotelId);
                            setHotelMenuOpen(false);
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "8px 12px",
                            borderRadius: 5,
                            border: "none",
                            background: active ? "rgba(56,198,186,0.12)" : "transparent",
                            color: active ? R.warmTeal : R.text,
                            fontSize: 12,
                            fontWeight: active ? 600 : 500,
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = R.heroBg;
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <span>{h.name}</span>
                          {active && (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                background: R.warmTeal,
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: R.cardRaised,
                border: `1px solid ${R.border}`,
                borderRadius: 6,
                padding: "6px 12px 6px 14px",
                minWidth: 260,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: R.accent, fontWeight: 600 }}>
                  {portfolioLabel}
                </div>
                {accessibleHotels && accessibleHotels.length === 0 && (
                  <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>
                    No Mason & Fifth properties linked to your account.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Service legend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 6,
              background: "rgba(56,198,186,0.08)",
              border: "1px solid rgba(56,198,186,0.20)",
            }}
          >
            {SERVICES.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 2,
                    background: s.color,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: R.textMid,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* VAT toggle */}
          <div
            title={
              vatMode === "gross"
                ? "Showing gross revenue (incl. UK VAT)"
                : "Showing net revenue (excl. UK VAT)"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 4px 4px 12px",
              borderRadius: 6,
              background: R.cardRaised,
              border: `1px solid ${R.border}`,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: R.textDim,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                fontWeight: 600,
              }}
            >
              VAT
            </span>
            <div
              style={{
                display: "flex",
                gap: 2,
                background: R.heroBg,
                padding: 2,
                borderRadius: 5,
                border: `1px solid ${R.border}`,
              }}
            >
              {(["gross", "net"] as const).map((m) => {
                const isActive = vatMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setVatMode(m)}
                    style={{
                      padding: "4px 10px",
                      fontSize: 10,
                      borderRadius: 4,
                      border: "none",
                      cursor: "pointer",
                      background: isActive ? R.warmTeal : "transparent",
                      color: isActive ? R.darkBand : R.textDim,
                      fontWeight: isActive ? 700 : 500,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    {m === "gross" ? "Incl." : "Excl."}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {loading && (
          <div
            style={{
              fontSize: 10,
              color: R.textMid,
              marginBottom: 16,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: R.warmTeal,
                animation: "masonPulse 1.4s ease-in-out infinite",
              }}
            />
            Fetching Mews revenue for {portfolioLabel}…
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 6,
              color: R.red,
              fontSize: 12,
            }}
          >
            Couldn't load live revenue: {error}
          </div>
        )}
        {!loading && apiData && (
          <div
            style={{
              fontSize: 10,
              color: R.textDim,
              marginBottom: 16,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Mews · {apiData.itemsScanned.toLocaleString()} order items · {apiData.timezone} ·
            {" "}
            {apiData.from} → {apiData.to} ·{" "}
            <span style={{ color: vatMode === "net" ? R.warmTeal : R.gold, fontWeight: 600 }}>
              {vatMode === "gross" ? "Gross (incl. VAT)" : "Net (excl. VAT)"}
            </span>
            {apiData.cachedAt && (
              <span style={{ marginLeft: 8, color: R.textMid }}>
                · cached {Math.max(1, Math.round((Date.now() - apiData.cachedAt) / 60000))}m ago
              </span>
            )}
          </div>
        )}
        {/* 3 Month KPI Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {loading
            ? placeholderLabels.map((p) => (
                <MonthCardSkeleton key={p.title} title={p.title} label={p.label} />
              ))
            : cards.map((c) => <MonthCardView key={c.title} card={c} />)}
        </div>

        {/* Occupancy + Recent Bookings */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: R.darkBand,
              border: `1px solid ${R.border}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <OccupancyChart
              data={dashboardData?.flowcast || []}
              loading={dashboardLoading}
            />
          </div>
          <div
            style={{
              background: R.darkBand,
              border: `1px solid ${R.border}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <RecentBookings
              data={dashboardData?.recentActivity || []}
              currencySymbol="£"
              onViewFullReport={onNavigate ? () => onNavigate("reports:bookings-report") : undefined}
            />
          </div>
        </div>

        {/* Market outlook + demand chart */}
        {(() => {
          const outlook = dashboardData?.marketOutlook;
          const status = outlook?.status || "stable";
          const accentColor =
            status === "strengthening" ? R.green : status === "softening" ? R.red : R.gold;
          const rgba = (hex: { r: number; g: number; b: number }, a: number) =>
            `rgba(${hex.r},${hex.g},${hex.b},${a})`;
          const rgb =
            status === "strengthening"
              ? { r: 52, g: 208, b: 104 }
              : status === "softening"
                ? { r: 239, g: 68, b: 68 }
                : { r: 200, g: 166, b: 110 };
          const headlineText =
            outlook
              ? `The 90-day market demand is ${status}`
              : dashboardLoading
                ? "Loading market outlook…"
                : "Market outlook unavailable";
          return (
            <div
              style={{
                background: R.darkBand,
                border: `1px solid ${R.border}`,
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: `1px solid ${rgba(rgb, 0.08)}`,
                  background: rgba(rgb, 0.03),
                }}
              >
                {status === "softening" ? (
                  <TrendingDown size={16} color={accentColor} />
                ) : (
                  <TrendingUp size={16} color={accentColor} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: accentColor }}>
                    {headlineText}
                  </div>
                  <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>
                    Demand vs 30 days ago
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1, color: accentColor }}>
                    {outlook?.metric || "—"}
                  </div>
                  <div style={{ fontSize: 10, color: R.textDim, marginTop: 3 }}>
                    demand vs 30d ago
                  </div>
                </div>
              </div>
              <DemandChart
                rawData={dashboardData?.forwardDemandChartData || []}
                loading={dashboardLoading}
              />
            </div>
          );
        })()}

        {/* YTD strip */}
        <YoYPnLTable
          data={yoyData}
          loading={yoyLoading}
          error={yoyError}
          vatMode={vatMode}
        />
      </div>
    </div>
  );
}
