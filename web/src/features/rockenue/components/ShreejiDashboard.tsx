import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, RefreshCw } from "lucide-react";
import { R } from "../../../styles/tokens";
import {
  fetchShreejiDashboard,
  type ShreejiDashboard,
  type ShreejiHotelRow,
  type ShreejiPerfBlock,
  type ShreejiPortfolio,
} from "../api/shreeji.api";

const PORTFOLIO_OPTIONS: { value: ShreejiPortfolio; label: string; sub: string }[] = [
  { value: "all", label: "All portfolio", sub: "12 hotels" },
  { value: "sp", label: "Aaryan Capital SP", sub: "Sanchit · 5 hotels" },
  { value: "np", label: "Aaryan Capital NP", sub: "Partner · 7 hotels" },
];

// Studio mockup → live data. Fetches /api/shreeji/dashboard which returns
// per-hotel MTD / STLY / Apr (closed) / Pace-30d performance from
// daily_metrics_snapshots, plus Cloudbeds-sourced takings + ancillary
// breakdown. 10-min server-side cache; manual Refresh hits ?fresh=1.

// ── formatters ──
const fmtMoney = (v: number | null | undefined) => {
  if (v === null || v === undefined || !isFinite(v as number)) return "—";
  return `£${Math.round(v as number).toLocaleString("en-GB")}`;
};
const fmtPct = (v: number | null | undefined, dp = 1) => {
  if (v === null || v === undefined || !isFinite(v as number)) return "—";
  return `${((v as number) * 100).toFixed(dp)}%`;
};

function pctDelta(curr: number, prev: number): number {
  if (!prev || !isFinite(prev)) return NaN;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// RevPAR = Revenue ÷ available rooms = Occ × ADR. Derived from existing
// block fields so no backend change is needed.
function revpar(block: { occ?: number; adr?: number } | null | undefined): number {
  if (!block || !block.occ || !block.adr) return 0;
  return block.occ * block.adr;
}

// "2025-05-01" + "2025-05-15" → "1–15 May 25". Tolerant to a missing range
// (e.g. backend hasn't been redeployed yet) — returns "—" rather than crashing.
function fmtRange(range: { start: string; end: string } | null | undefined) {
  if (!range || !range.start || !range.end) return "—";
  const s = new Date(range.start + "T00:00:00Z");
  const e = new Date(range.end + "T00:00:00Z");
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const monthYr = e.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
  if (sameMonth) {
    return `${s.getUTCDate()}–${e.getUTCDate()} ${monthYr}`;
  }
  const sLabel = s.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const eLabel = e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
  return `${sLabel} – ${eLabel}`;
}

function DeltaText({ pct, size = 11 }: { pct: number; size?: number }) {
  if (!isFinite(pct) || Math.abs(pct) < 0.05) {
    return <span style={{ color: R.textDim, fontSize: size }}>—</span>;
  }
  const up = pct > 0;
  return (
    <span style={{ color: up ? "rgba(52,208,104,0.85)" : "rgba(239,68,68,0.85)", fontSize: size }}>
      {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

// Absolute £ delta for revenue, signed and colored. Stays meaningful even when
// the comparison is partial-MTD vs full-LY-month (unlike a % delta, which is
// misleading there).
function MoneyDelta({ curr, prev, size = 12 }: { curr: number; prev: number; size?: number }) {
  if (!isFinite(curr) || !isFinite(prev)) {
    return <span style={{ color: R.textDim, fontSize: size }}>—</span>;
  }
  const diff = curr - prev;
  if (Math.abs(diff) < 1) {
    return <span style={{ color: R.textDim, fontSize: size }}>—</span>;
  }
  const up = diff > 0;
  return (
    <span style={{ color: up ? "rgba(52,208,104,0.85)" : "rgba(239,68,68,0.85)", fontSize: size, fontVariantNumeric: "tabular-nums" }}>
      {up ? "+" : "−"}£{Math.abs(Math.round(diff)).toLocaleString("en-GB")}
    </span>
  );
}

// ── shared cell styles ──
// Generous spacing + larger font so the 16-column Performance grid stays
// scannable. Headers stay one notch smaller than body cells for hierarchy.
const cellBase: React.CSSProperties = {
  fontSize: 13,
  padding: "12px 14px",
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 400,
  color: R.text,
};
const labelCell: React.CSSProperties = {
  fontSize: 14,
  padding: "12px 16px",
  textAlign: "left",
  color: R.text,
  fontWeight: 500,
  whiteSpace: "nowrap",
};
const headerCell: React.CSSProperties = {
  ...cellBase,
  fontSize: 10,
  color: R.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontWeight: 600,
  padding: "14px 14px 10px",
};
const headerLabelCell: React.CSSProperties = {
  ...headerCell,
  textAlign: "left",
  padding: "14px 16px 10px",
};
const groupHeaderCell: React.CSSProperties = {
  fontSize: 9,
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: R.gold,
  padding: "8px 6px 4px",
  fontWeight: 600,
};

// ── shared layout helpers ──
function Section({
  title,
  subtitle,
  children,
  rightSlot,
  loading = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 10, display: "flex", alignItems: "baseline", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 12, color: R.warmTeal, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</div>
          {loading && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: R.warmTeal, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <RefreshCw size={11} className="animate-spin" />
              Refreshing
            </span>
          )}
          {subtitle && <div style={{ fontSize: 10, color: R.textDim, alignSelf: "baseline" }}>{subtitle}</div>}
        </div>
        {rightSlot}
      </div>
      <div
        style={{
          background: R.darkBand,
          border: `1px solid ${R.border}`,
          borderRadius: 10,
          overflow: "hidden",
          opacity: loading ? 0.55 : 1,
          transition: "opacity 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function KpiTile({ label, value, sub, accent = false }: { label: string; value: string; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 10, padding: "14px 16px", minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, color: accent ? R.gold : R.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: R.textMid, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ── header bar ──
function TopBar({
  data,
  monthKey,
  onMonthChange,
  portfolio,
  onPortfolioChange,
  onRefresh,
  loading,
  financialsLoading,
}: {
  data: ShreejiDashboard | null;
  monthKey: string;
  onMonthChange: (m: string) => void;
  portfolio: ShreejiPortfolio;
  onPortfolioChange: (p: ShreejiPortfolio) => void;
  onRefresh: () => void;
  loading: boolean;
  financialsLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const currentPortfolio =
    PORTFOLIO_OPTIONS.find((o) => o.value === portfolio) ?? PORTFOLIO_OPTIONS[0];

  // Build 6 most-recent month options. Tag the current month "live", anything
  // older as "closed".
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string; tag: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      opts.push({
        value,
        label: d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }),
        tag: i === 0 ? "live" : "closed",
      });
    }
    return opts;
  }, []);

  const current = monthOptions.find((o) => o.value === monthKey) ?? monthOptions[0];

  const asOf = data?.asOf
    ? new Date(data.asOf).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      })
    : "—";

  const totalRooms = data?.totals?.rooms ?? 0;
  const hotelCount = data?.hotels?.length ?? 0;

  return (
    <div style={{ padding: "14px 28px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: R.darkBand }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: R.gold, textTransform: "uppercase" }}>Shreeji Portfolio</div>
        <div style={{ fontSize: 13, color: R.accent, fontWeight: 600 }}>
          {hotelCount > 0 ? `${hotelCount} properties · ${totalRooms} rooms` : "loading…"}
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPortfolioOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: R.cardRaised,
              border: `1px solid ${portfolioOpen ? R.warmTeal : R.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              minWidth: 260,
            }}
          >
            <span style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>Portfolio</span>
            <span style={{ fontSize: 12, color: R.gold, fontWeight: 600, flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{currentPortfolio.label}</span>
            <ChevronDown size={12} color={R.textMid} style={{ transform: portfolioOpen ? "rotate(180deg)" : "none" }} />
          </button>
          {portfolioOpen && (
            <>
              <div onClick={() => setPortfolioOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 260, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8, padding: 4, zIndex: 11 }}>
                {PORTFOLIO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onPortfolioChange(opt.value);
                      setPortfolioOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 5,
                      border: "none",
                      background: opt.value === portfolio ? "rgba(56,198,186,0.12)" : "transparent",
                      color: opt.value === portfolio ? R.warmTeal : R.text,
                      fontSize: 12,
                      fontWeight: opt.value === portfolio ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: R.cardRaised,
              border: `1px solid ${open ? R.warmTeal : R.border}`,
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              minWidth: 160,
            }}
          >
            <span style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>Reporting</span>
            <span style={{ fontSize: 12, color: R.gold, fontWeight: 600, flex: 1, textAlign: "left" }}>{current.label}</span>
            <ChevronDown size={12} color={R.textMid} style={{ transform: open ? "rotate(180deg)" : "none" }} />
          </button>
          {open && (
            <>
              <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, minWidth: 200, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8, padding: 4, zIndex: 11 }}>
                {monthOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onMonthChange(opt.value);
                      setOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 5,
                      border: "none",
                      background: opt.value === monthKey ? "rgba(56,198,186,0.12)" : "transparent",
                      color: opt.value === monthKey ? R.warmTeal : R.text,
                      fontSize: 12,
                      fontWeight: opt.value === monthKey ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
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

        <div style={{ fontSize: 11, color: R.textMid }}>
          <span style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 9, marginRight: 6 }}>As of</span>
          {asOf}
          {data?.cached ? (
            <span style={{ marginLeft: 8, color: R.textDim, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>· cached</span>
          ) : null}
          {financialsLoading && (
            <span style={{ marginLeft: 8, color: R.warmTeal, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>· loading takings…</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Re-fetch financials from Cloudbeds (skips cache)"
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
          <RefreshCw size={14} className={loading || financialsLoading ? "spin" : ""} /> Refresh
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

// ── headline KPI strip ──
function HeadlineStrip({ data, loading = false }: { data: ShreejiDashboard; loading?: boolean }) {
  const t = data.totals;
  const totalTakings = t.takings.total;
  const cardsShare = totalTakings > 0 ? (t.takings.visa + t.takings.mastercard + t.takings.amex + t.takings.otherCards) / totalTakings : 0;
  const cashShare = totalTakings > 0 ? t.takings.cash / totalTakings : 0;

  // Defensive: a stale backend (pre-redeploy) may not include yoy / lastLy.
  // Fall back to a non-YoY render rather than crashing.
  const yoy = t.yoy ?? { deltaPct: null, lastLyRev: 0, matchedHotels: 0, unmatchedHotels: 0 };
  const lastLabel = fmtRange(data.ranges?.last);
  const lastLyLabel = fmtRange(data.ranges?.lastLy);

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 24, opacity: loading ? 0.55 : 1, transition: "opacity 180ms ease-out" }}>
      <KpiTile
        label="Revenue MTD"
        value={fmtMoney(t.mtd.rev)}
        sub={
          <span style={{ color: R.textDim }}>
            Occ {fmtPct(t.mtd.occ, 0)} · ADR {fmtMoney(t.mtd.adr)} · {data.daysElapsed}d in
          </span>
        }
        accent
      />
      <KpiTile
        label={`Last Closed Month · ${lastLabel}`}
        value={fmtMoney(t.last.rev)}
        sub={
          <span style={{ color: R.textDim }}>
            {yoy.deltaPct !== null ? (
              <>
                vs {lastLyLabel} {fmtMoney(yoy.lastLyRev)} <DeltaText pct={yoy.deltaPct} />
                {yoy.unmatchedHotels > 0 && (
                  <span style={{ marginLeft: 6 }}>· {yoy.unmatchedHotels} new hotel{yoy.unmatchedHotels === 1 ? "" : "s"} excluded</span>
                )}
              </>
            ) : (
              <>Occ {fmtPct(t.last.occ, 0)} · ADR {fmtMoney(t.last.adr)}</>
            )}
          </span>
        }
      />
      <KpiTile
        label="Occupancy MTD"
        value={fmtPct(t.mtd.occ, 0)}
        sub={
          <span>
            ADR {fmtMoney(t.mtd.adr)} · {data.daysElapsed}d in
          </span>
        }
      />
      <KpiTile
        label="On The Books · Next 30d"
        value={fmtMoney(t.pace.rev)}
        sub={
          <span style={{ color: R.textDim }}>
            Pickup 7d {t.pace.pickup7d > 0 ? `+${t.pace.pickup7d.toLocaleString("en-GB")} rooms` : "—"}
          </span>
        }
      />
      <KpiTile
        label="Total Takings MTD"
        value={fmtMoney(totalTakings)}
        sub={
          <span style={{ color: R.textDim }}>
            {totalTakings > 0 ? (
              <>
                Cards {fmtPct(cardsShare, 0)} · Cash {fmtPct(cashShare, 0)}
              </>
            ) : (
              "Loading from Cloudbeds…"
            )}
          </span>
        }
      />
    </div>
  );
}

// ── performance table ──
function PerformanceTable({ data, loading = false }: { data: ShreejiDashboard; loading?: boolean }) {
  // 16 columns total:
  //   name | rooms | <sp> | mtd[occ adr rvp rev] | mtdLY[occ adr rvp rev Δrev] | <sp>
  //                       | pace[occ rvp rev]
  // The Δ Rev column shows ABSOLUTE £ delta (not %), which stays meaningful
  // even when MTD is partial vs full prior-year month — a % delta would be
  // misleading since the windows aren't the same length.
  // Widths tuned for fontSize 13 body cells + 12px horizontal padding.
  const cols =
    "minmax(220px, 1.5fr) 64px 14px 76px 88px 78px 110px 70px 78px 70px 100px 100px 14px 80px 78px 110px";

  const spacerCell: React.CSSProperties = {
    borderLeft: `1px solid ${R.border}`,
    height: "100%",
  };

  // LY cells use a quieter palette + slightly smaller font so the eye lands
  // on current-year numbers first. Delta keeps full opacity so up/down is obvious.
  const lyCell: React.CSSProperties = {
    ...cellBase,
    fontSize: 12,
    color: "rgba(255,255,255,0.32)",
  };
  const lyHeader: React.CSSProperties = {
    ...headerCell,
    color: "rgba(255,255,255,0.28)",
    fontSize: 9,
  };

  // Defensive — older backend payload may lack stly/lastLy on hotel rows.
  const safe = (block: ShreejiPerfBlock | undefined) =>
    block && typeof block.rev === "number" ? block : { rev: 0, occ: 0, adr: 0, roomsSold: 0, capacity: 0 };

  return (
    <Section title="Performance by Property" subtitle="Current MTD vs same month last year · forward pace 30d" loading={loading}>
      <div style={{ overflowX: "auto" }}>
      {/* Group headers */}
      <div style={{ display: "grid", gridTemplateColumns: cols, background: "rgba(0,0,0,0.18)", borderBottom: `1px solid ${R.border}` }}>
        <div></div>
        <div></div>
        <div></div>
        <div style={{ ...groupHeaderCell, gridColumn: "span 4" }}>{fmtRange(data.ranges?.mtd)} (MTD)</div>
        <div style={{ ...groupHeaderCell, gridColumn: "span 5", color: "rgba(255,255,255,0.32)" }}>vs {fmtRange(data.ranges?.stly)}</div>
        <div></div>
        <div style={{ ...groupHeaderCell, gridColumn: "span 3", color: R.warmTeal }}>Next 30d (OTB)</div>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: `1px solid ${R.border}` }}>
        <div style={headerLabelCell}>Property</div>
        <div style={headerCell}>Rms</div>
        <div style={spacerCell} />
        <div style={headerCell}>Occ</div>
        <div style={headerCell}>ADR</div>
        <div style={headerCell}>RevPAR</div>
        <div style={headerCell}>Revenue</div>
        <div style={lyHeader}>Occ</div>
        <div style={lyHeader}>ADR</div>
        <div style={lyHeader}>RevPAR</div>
        <div style={lyHeader}>Revenue</div>
        <div style={headerCell}>Δ Rev (£)</div>
        <div style={spacerCell} />
        <div style={headerCell}>Occ</div>
        <div style={headerCell}>RevPAR</div>
        <div style={headerCell}>Revenue</div>
      </div>
      {/* Rows */}
      {data.hotels.map((h) => {
        const stly = safe(h.stly);
        return (
          <div
            key={h.id}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              borderBottom: `1px solid ${R.sep}`,
            }}
          >
            <div style={labelCell}>{h.name}</div>
            <div style={{ ...cellBase, color: R.textMid }}>{h.rooms}</div>
            <div style={spacerCell} />
            {/* MTD current */}
            <div style={cellBase}>{fmtPct(h.mtd.occ, 0)}</div>
            <div style={cellBase}>{fmtMoney(h.mtd.adr)}</div>
            <div style={cellBase}>{fmtMoney(revpar(h.mtd))}</div>
            <div style={{ ...cellBase, color: R.gold, fontWeight: 600 }}>{fmtMoney(h.mtd.rev)}</div>
            {/* MTD LY */}
            <div style={lyCell}>{stly.rev > 0 ? fmtPct(stly.occ, 0) : "—"}</div>
            <div style={lyCell}>{stly.rev > 0 ? fmtMoney(stly.adr) : "—"}</div>
            <div style={lyCell}>{stly.rev > 0 ? fmtMoney(revpar(stly)) : "—"}</div>
            <div style={lyCell}>{stly.rev > 0 ? fmtMoney(stly.rev) : "—"}</div>
            <div style={cellBase}>
              {stly.rev > 0 ? <MoneyDelta curr={h.mtd.rev} prev={stly.rev} /> : <span style={{ color: R.textDim }}>—</span>}
            </div>
            <div style={spacerCell} />
            {/* Pace */}
            <div style={{ ...cellBase, color: R.warmTeal }}>{fmtPct(h.pace.occ, 0)}</div>
            <div style={{ ...cellBase, color: R.warmTeal }}>{fmtMoney(revpar(h.pace))}</div>
            <div style={{ ...cellBase, color: R.warmTeal }}>{fmtMoney(h.pace.rev)}</div>
          </div>
        );
      })}
      {/* Totals row — like-for-like portfolio YoY (only hotels with LY data) */}
      {(() => {
        const mtdMatched = data.hotels.filter((h) => safe(h.stly).rev > 0);
        const mtdMatchedNow = mtdMatched.reduce((s, h) => s + h.mtd.rev, 0);
        const mtdMatchedLy = mtdMatched.reduce((s, h) => s + h.stly.rev, 0);
        const mtdMatchedSold = mtdMatched.reduce((s, h) => s + h.stly.roomsSold, 0);
        const mtdMatchedCap = mtdMatched.reduce((s, h) => s + h.stly.capacity, 0);
        const mtdLyOcc = mtdMatchedCap > 0 ? mtdMatchedSold / mtdMatchedCap : 0;
        const mtdLyAdr = mtdMatchedSold > 0 ? mtdMatchedLy / mtdMatchedSold : 0;

        // Pace totals from the backend don't include ADR/capacity, so derive
        // RevPAR from per-hotel sums: total pace rev ÷ total pace capacity.
        const paceTotCap = data.hotels.reduce((s, h) => s + (h.pace?.capacity || 0), 0);
        const paceTotRev = data.totals.pace.rev;
        const paceRevpar = paceTotCap > 0 ? paceTotRev / paceTotCap : 0;

        return (
          <div style={{ display: "grid", gridTemplateColumns: cols, background: "rgba(0,0,0,0.22)", borderTop: `1px solid ${R.border}` }}>
            <div style={{ ...labelCell, fontWeight: 700, color: R.gold }}>Portfolio Total / Avg</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{data.totals.rooms}</div>
            <div style={spacerCell} />
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtPct(data.totals.mtd.occ, 0)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(data.totals.mtd.adr)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(revpar(data.totals.mtd))}</div>
            <div style={{ ...cellBase, fontWeight: 700, color: R.gold }}>{fmtMoney(data.totals.mtd.rev)}</div>
            <div style={lyCell}>{mtdMatchedCap > 0 ? fmtPct(mtdLyOcc, 0) : "—"}</div>
            <div style={lyCell}>{mtdMatchedSold > 0 ? fmtMoney(mtdLyAdr) : "—"}</div>
            <div style={lyCell}>{mtdMatchedCap > 0 ? fmtMoney(mtdMatchedLy / mtdMatchedCap) : "—"}</div>
            <div style={lyCell}>{mtdMatchedLy > 0 ? fmtMoney(mtdMatchedLy) : "—"}</div>
            <div style={cellBase}>
              {mtdMatchedLy > 0 ? <MoneyDelta curr={mtdMatchedNow} prev={mtdMatchedLy} size={13} /> : <span style={{ color: R.textDim }}>—</span>}
            </div>
            <div style={spacerCell} />
            <div style={{ ...cellBase, fontWeight: 700, color: R.warmTeal }}>{fmtPct(data.totals.pace.occ, 0)}</div>
            <div style={{ ...cellBase, fontWeight: 700, color: R.warmTeal }}>{fmtMoney(paceRevpar)}</div>
            <div style={{ ...cellBase, fontWeight: 700, color: R.warmTeal }}>{fmtMoney(data.totals.pace.rev)}</div>
          </div>
        );
      })()}
      </div>
    </Section>
  );
}

// ── takings table ──
// Shimmer bar shown while financials are still loading from Cloudbeds, so
// users see "fetching" rather than "no data" during the 30-60s phase 2 wait.
function ShimmerBar({ width = 56 }: { width?: number }) {
  return (
    <span
      className="animate-pulse"
      style={{
        display: "inline-block",
        width,
        height: 10,
        background: "rgba(255,255,255,0.10)",
        borderRadius: 3,
        verticalAlign: "middle",
      }}
    />
  );
}

function TakingsTable({ data, financialsLoading, loading = false }: { data: ShreejiDashboard; financialsLoading: boolean; loading?: boolean }) {
  const cols = "minmax(240px, 1.8fr) 120px 130px 130px 120px 130px 130px";
  const t = data.totals.takings;
  const totRow = t.total;

  // Hotels with takings === null come in two flavours:
  //   1. Phase 1 paint (financialsLoading=true) → render a shimmer bar so the
  //      user sees the row is mid-fetch, not blank by mistake.
  //   2. Final state (financialsLoading=false) → genuine null (Cloudbeds
  //      session expired or non-Cloudbeds). Render "—".
  return (
    <Section
      title="Takings by Payment Method"
      subtitle="Current month MTD · gross paid (matches Cloudbeds Daily Takings)"
      loading={loading}
      rightSlot={
        financialsLoading ? (
          <span style={{ fontSize: 10, color: R.warmTeal, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Loading from Cloudbeds…
          </span>
        ) : data.hotels.some((h) => h.financialsError) && (
          <span style={{ fontSize: 10, color: "rgba(239,68,68,0.85)" }}>
            {data.hotels.filter((h) => h.financialsError).length} hotel(s) returned an error — see hover tooltip
          </span>
        )
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: `1px solid ${R.border}` }}>
        <div style={headerLabelCell}>Property</div>
        <div style={headerCell}>Cash</div>
        <div style={headerCell}>Visa</div>
        <div style={headerCell}>Mastercard</div>
        <div style={headerCell}>Amex</div>
        <div style={headerCell}>Bank Transfer</div>
        <div style={{ ...headerCell, color: R.gold }}>Total</div>
      </div>
      {data.hotels.map((h) => {
        const tk = h.takings;
        const isDash = !tk;
        const isLoading = isDash && financialsLoading;
        const empty = (w = 56) => (isLoading ? <ShimmerBar width={w} /> : "—");
        const row = (
          <div
            key={h.id}
            title={h.financialsError || undefined}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              borderBottom: `1px solid ${R.sep}`,
            }}
          >
            <div style={{ ...labelCell, color: isDash ? (isLoading ? R.text : R.textDim) : R.text }}>{h.name}</div>
            <div style={cellBase}>{isDash ? empty(56) : fmtMoney(tk!.cash)}</div>
            <div style={cellBase}>{isDash ? empty(72) : fmtMoney(tk!.visa)}</div>
            <div style={cellBase}>{isDash ? empty(72) : fmtMoney(tk!.mastercard)}</div>
            <div style={cellBase}>{isDash ? empty(56) : fmtMoney(tk!.amex)}</div>
            <div style={cellBase}>{isDash ? empty(72) : fmtMoney(tk!.bankTransfer)}</div>
            <div style={{ ...cellBase, fontWeight: 600, color: isDash ? (isLoading ? R.text : R.textDim) : R.gold }}>
              {isDash ? empty(80) : fmtMoney(tk!.total)}
            </div>
          </div>
        );
        return row;
      })}
      <div style={{ display: "grid", gridTemplateColumns: cols, background: "rgba(0,0,0,0.22)", borderTop: `1px solid ${R.border}` }}>
        <div style={{ ...labelCell, fontWeight: 700, color: R.gold }}>Portfolio Total</div>
        {financialsLoading && t.total === 0 ? (
          <>
            <div style={cellBase}><ShimmerBar width={64} /></div>
            <div style={cellBase}><ShimmerBar width={80} /></div>
            <div style={cellBase}><ShimmerBar width={80} /></div>
            <div style={cellBase}><ShimmerBar width={64} /></div>
            <div style={cellBase}><ShimmerBar width={80} /></div>
            <div style={cellBase}><ShimmerBar width={88} /></div>
          </>
        ) : (
          <>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(t.cash)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(t.visa)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(t.mastercard)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(t.amex)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(t.bankTransfer)}</div>
            <div style={{ ...cellBase, fontWeight: 700, color: R.gold }}>{fmtMoney(t.total)}</div>
          </>
        )}
      </div>
      {totRow > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: cols, borderTop: `1px solid ${R.sep}`, background: "rgba(0,0,0,0.12)" }}>
          <div style={{ ...labelCell, color: R.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>% share</div>
          <div style={{ ...cellBase, color: R.textDim, fontSize: 10 }}>{fmtPct(t.cash / totRow, 1)}</div>
          <div style={{ ...cellBase, color: R.textDim, fontSize: 10 }}>{fmtPct(t.visa / totRow, 1)}</div>
          <div style={{ ...cellBase, color: R.textDim, fontSize: 10 }}>{fmtPct(t.mastercard / totRow, 1)}</div>
          <div style={{ ...cellBase, color: R.textDim, fontSize: 10 }}>{fmtPct(t.amex / totRow, 1)}</div>
          <div style={{ ...cellBase, color: R.textDim, fontSize: 10 }}>{fmtPct(t.bankTransfer / totRow, 1)}</div>
          <div style={{ ...cellBase, color: R.textDim, fontSize: 10 }}>100%</div>
        </div>
      )}
    </Section>
  );
}

// ── ancillary detail (expand panel) ──
// Single flat table of every item the hotel sold, sorted by revenue desc.
// Category column lets the eye group without needing per-category sub-cards.
function AncillaryDetail({ hotel }: { hotel: ShreejiHotelRow }) {
  const anc = hotel.ancillary;
  if (!anc) return null;
  const CATEGORY_LABEL: Record<"breakfast" | "bar" | "parking" | "laundry" | "other", string> = {
    breakfast: "Breakfast",
    bar: "Bar / Drinks",
    parking: "Parking",
    laundry: "Laundry",
    other: "Other",
  };
  type Row = { category: string; name: string; qty: number; unit: number; revenue: number };
  const items: Row[] = [];
  (Object.keys(CATEGORY_LABEL) as (keyof typeof CATEGORY_LABEL)[]).forEach((key) => {
    const bucket = anc[key];
    if (!bucket) return;
    bucket.items.forEach((it) => {
      items.push({ category: CATEGORY_LABEL[key], name: it.name, qty: it.qty, unit: it.unit, revenue: it.revenue });
    });
  });
  items.sort((a, b) => b.revenue - a.revenue);

  if (items.length === 0) return null;

  const detailCols = "120px minmax(220px, 2fr) 90px 110px 110px";

  return (
    <div style={{ background: "rgba(0,0,0,0.25)", borderTop: `1px solid ${R.border}`, borderBottom: `1px solid ${R.border}`, padding: "12px 28px 16px 52px" }}>
      <div style={{ background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: detailCols, borderBottom: `1px solid ${R.border}` }}>
          <div style={{ ...headerCell, padding: "10px 12px 8px", textAlign: "left" }}>Category</div>
          <div style={{ ...headerCell, padding: "10px 12px 8px", textAlign: "left" }}>Item</div>
          <div style={{ ...headerCell, padding: "10px 10px 8px" }}>Qty</div>
          <div style={{ ...headerCell, padding: "10px 10px 8px" }}>Unit</div>
          <div style={{ ...headerCell, padding: "10px 10px 8px" }}>Revenue</div>
        </div>
        {items.map((it, i) => (
          <div
            key={`${it.category}-${it.name}-${i}`}
            style={{ display: "grid", gridTemplateColumns: detailCols, borderBottom: i === items.length - 1 ? "none" : `1px solid ${R.sep}` }}
          >
            <div style={{ fontSize: 11, padding: "8px 12px", color: R.gold, fontWeight: 500, letterSpacing: 0.3 }}>{it.category}</div>
            <div style={{ fontSize: 12, padding: "8px 12px", color: R.text }}>{it.name}</div>
            <div style={{ ...cellBase, padding: "8px 10px", color: R.textMid, fontSize: 12 }}>{it.qty.toLocaleString("en-GB")}</div>
            <div style={{ ...cellBase, padding: "8px 10px", color: R.textMid, fontSize: 12 }}>£{it.unit.toFixed(2)}</div>
            <div style={{ ...cellBase, padding: "8px 10px", color: R.text, fontSize: 12, fontWeight: 500 }}>{fmtMoney(it.revenue)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ancillary table ──
function AncillaryTable({ data, financialsLoading, loading = false }: { data: ShreejiDashboard; financialsLoading: boolean; loading?: boolean }) {
  const cols = "36px minmax(240px, 1.8fr) 120px 130px 120px 120px 120px 130px 110px";
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandable = data.hotels.filter((h) => h.ancillary && h.ancillary.grandTotal > 0);
  const allOpen = expandable.length > 0 && openIds.size === expandable.length;
  const toggleAll = () => setOpenIds(allOpen ? new Set() : new Set(expandable.map((h) => h.id)));
  const a = data.totals.ancillary;

  return (
    <Section
      title="Ancillary Revenue"
      subtitle="Current month MTD · breakfast & add-ons sold per property · click a row for item-level breakdown"
      loading={loading}
      rightSlot={
        financialsLoading ? (
          <span style={{ fontSize: 10, color: R.warmTeal, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Loading from Cloudbeds…
          </span>
        ) : undefined
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: `1px solid ${R.border}` }}>
        <div
          onClick={toggleAll}
          title={allOpen ? "Collapse all" : "Expand all"}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: R.textDim, padding: "10px 0" }}
        >
          {allOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
        <div style={headerLabelCell}>Property</div>
        <div style={headerCell}>Breakfast</div>
        <div style={headerCell}>Bar / Drinks</div>
        <div style={headerCell}>Parking</div>
        <div style={headerCell}>Laundry</div>
        <div style={headerCell}>Other</div>
        <div style={{ ...headerCell, color: R.gold }}>Total Add-ons</div>
        <div style={headerCell}>% of Rev</div>
      </div>
      {data.hotels.map((h) => {
        const anc = h.ancillary;
        const isOpen = openIds.has(h.id);
        const total = anc?.grandTotal ?? 0;
        const share = h.mtd.rev > 0 ? total / h.mtd.rev : 0;
        const hasItems = !!(anc && anc.grandTotal > 0);
        return (
          <div key={h.id}>
            <div
              onClick={() => hasItems && toggle(h.id)}
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                borderBottom: `1px solid ${R.sep}`,
                background: isOpen ? "rgba(56,198,186,0.06)" : "transparent",
                cursor: hasItems ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: !hasItems ? R.textDim : isOpen ? R.warmTeal : R.textDim,
                  transition: "transform 120ms",
                }}
              >
                {hasItems ? (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span style={{ width: 12 }} />}
              </div>
              <div style={{ ...labelCell, color: !hasItems ? R.textDim : isOpen ? R.warmTeal : R.text }}>{h.name}</div>
              {anc ? (
                <>
                  <div style={cellBase}>{fmtMoney(anc.breakfast.total)}</div>
                  <div style={cellBase}>{fmtMoney(anc.bar.total)}</div>
                  <div style={{ ...cellBase, color: anc.parking.total === 0 ? R.textDim : R.text }}>
                    {anc.parking.total === 0 ? "—" : fmtMoney(anc.parking.total)}
                  </div>
                  <div style={cellBase}>{fmtMoney(anc.laundry.total)}</div>
                  <div style={cellBase}>{fmtMoney(anc.other.total)}</div>
                  <div style={{ ...cellBase, fontWeight: 600, color: R.gold }}>{fmtMoney(anc.grandTotal)}</div>
                  <div style={{ ...cellBase, color: R.textMid }}>{fmtPct(share, 1)}</div>
                </>
              ) : financialsLoading ? (
                <>
                  <div style={cellBase}><ShimmerBar width={56} /></div>
                  <div style={cellBase}><ShimmerBar width={64} /></div>
                  <div style={cellBase}><ShimmerBar width={56} /></div>
                  <div style={cellBase}><ShimmerBar width={56} /></div>
                  <div style={cellBase}><ShimmerBar width={56} /></div>
                  <div style={cellBase}><ShimmerBar width={72} /></div>
                  <div style={cellBase}><ShimmerBar width={48} /></div>
                </>
              ) : (
                <>
                  <div style={cellBase}>—</div>
                  <div style={cellBase}>—</div>
                  <div style={cellBase}>—</div>
                  <div style={cellBase}>—</div>
                  <div style={cellBase}>—</div>
                  <div style={{ ...cellBase, color: R.textDim }}>—</div>
                  <div style={{ ...cellBase, color: R.textDim }}>—</div>
                </>
              )}
            </div>
            {isOpen && hasItems && <AncillaryDetail hotel={h} />}
          </div>
        );
      })}
      <div style={{ display: "grid", gridTemplateColumns: cols, background: "rgba(0,0,0,0.22)", borderTop: `1px solid ${R.border}` }}>
        <div />
        <div style={{ ...labelCell, fontWeight: 700, color: R.gold }}>Portfolio Total</div>
        {financialsLoading && a.grandTotal === 0 ? (
          <>
            <div style={cellBase}><ShimmerBar width={64} /></div>
            <div style={cellBase}><ShimmerBar width={72} /></div>
            <div style={cellBase}><ShimmerBar width={64} /></div>
            <div style={cellBase}><ShimmerBar width={64} /></div>
            <div style={cellBase}><ShimmerBar width={64} /></div>
            <div style={cellBase}><ShimmerBar width={80} /></div>
            <div style={cellBase}><ShimmerBar width={48} /></div>
          </>
        ) : (
          <>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(a.breakfast)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(a.bar)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(a.parking)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(a.laundry)}</div>
            <div style={{ ...cellBase, fontWeight: 700 }}>{fmtMoney(a.other)}</div>
            <div style={{ ...cellBase, fontWeight: 700, color: R.gold }}>{fmtMoney(a.grandTotal)}</div>
            <div style={{ ...cellBase, fontWeight: 700, color: R.textMid }}>
              {data.totals.mtd.rev > 0 ? fmtPct(a.grandTotal / data.totals.mtd.rev, 1) : "—"}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

// ── empty / loading / error ──
function SkeletonRow({ cols = 12 }: { cols?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
        padding: "10px 12px",
        borderBottom: `1px solid ${R.sep}`,
      }}
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} style={{ height: 12, background: "rgba(255,255,255,0.05)", borderRadius: 3 }} />
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ marginTop: 24 }}>
      <Section title="Loading">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </Section>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        marginTop: 40,
        padding: 24,
        background: "rgba(239,68,68,0.06)",
        border: "1px solid rgba(239,68,68,0.32)",
        borderRadius: 10,
        color: R.text,
        maxWidth: 720,
      }}
    >
      <div style={{ fontSize: 12, color: "rgba(239,68,68,0.85)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
        Failed to load Shreeji dashboard
      </div>
      <div style={{ fontSize: 12, color: R.textMid, marginBottom: 14, lineHeight: 1.5 }}>{message}</div>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 14px",
          background: R.cardRaised,
          border: `1px solid ${R.border}`,
          borderRadius: 6,
          color: R.warmTeal,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ── main ──
export function ShreejiDashboard() {
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const [monthKey, setMonthKey] = useState(defaultMonth);
  const [portfolio, setPortfolio] = useState<ShreejiPortfolio>("all");
  const [data, setData] = useState<ShreejiDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-phase load:
  // 1. fast (financials=false): DB-only perf paint, sub-second
  // 2. full (financials=true): includes Cloudbeds takings + ancillary
  // The skeleton phase only renders for the very first paint; subsequent
  // month changes use the same two-phase pattern but the previous full data
  // stays visible until the new fast paint replaces it (no flicker).
  const load = useCallback(
    async (mk: string, pf: ShreejiPortfolio, fresh: boolean) => {
      setError(null);
      setLoading(true);
      try {
        // Phase 1 — fast
        const skeleton = await fetchShreejiDashboard({ monthKey: mk, portfolio: pf, financials: false });
        setData(skeleton);
        setLoading(false);
        // Phase 2 — full
        setFinancialsLoading(true);
        const full = await fetchShreejiDashboard({ monthKey: mk, portfolio: pf, fresh });
        setData(full);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      } finally {
        setFinancialsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(monthKey, portfolio, false);
  }, [monthKey, portfolio, load]);

  const handleRefresh = useCallback(() => {
    load(monthKey, portfolio, true);
  }, [monthKey, portfolio, load]);

  return (
    <div style={{ background: R.bg, minHeight: "100vh", color: R.text }}>
      <TopBar
        data={data}
        monthKey={monthKey}
        onMonthChange={setMonthKey}
        portfolio={portfolio}
        onPortfolioChange={setPortfolio}
        onRefresh={handleRefresh}
        loading={loading}
        financialsLoading={financialsLoading}
      />

      <div style={{ padding: "24px 28px 80px", maxWidth: 1700, margin: "0 auto" }}>
        {error && <ErrorState message={error} onRetry={() => load(monthKey, true)} />}
        {!error && loading && !data && <LoadingState />}
        {!error && data && (
          <>
            <HeadlineStrip data={data} loading={loading} />
            <PerformanceTable data={data} loading={loading} />
            <TakingsTable data={data} loading={loading} financialsLoading={financialsLoading} />
            <AncillaryTable data={data} loading={loading} financialsLoading={financialsLoading} />
          </>
        )}
      </div>
    </div>
  );
}
