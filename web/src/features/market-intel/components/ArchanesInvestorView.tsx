import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import {
  Building2,
  Coins,
  TrendingUp,
  CalendarRange,
  MapPin,
  Award,
  Layers,
  Star,
  Users,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
} from "recharts";
import { R } from "../../../styles/tokens";

const ArchanesPropertyMap = lazy(() => import("./ArchanesPropertyMap"));

// ----------------------------------------------------------------------------
// Types (mirror MarketService.getAirbnbInvestorView payload)
// ----------------------------------------------------------------------------

interface InvestorPayload {
  citySlug: string;
  tracking: {
    firstScrape: string | null;
    lastScrape: string | null;
    totalScrapes: number;
    uniqueProperties: number;
    daysOfHistory?: number;
  };
  kpis: {
    uniqueProperties: number;
    medianNightlyRate: number | null;
    forwardAvgRate: number | null;
    avgListingsPerNight: number | null;
  };
  demandCalendar: Array<{
    date: string;
    listings: number;
    scrapeUniqueProperties: number;
    avgPrice: number | null;
    medianPrice: number | null;
    occupancyPct: number | null;
  }>;
  forwardAdrCurve: Array<{
    date: string;
    avgPrice: number | null;
    medianPrice: number | null;
  }>;
  dowPremium: Array<{
    dow: number;
    label: string;
    avgPrice: number | null;
    premiumPct: number | null;
  }>;
  priceLadder: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    sampleSize: number;
  } | null;
  priceLadderByBeds: Array<{
    bucket: string;
    sampleSize: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }>;
  occupancyAnalysis: {
    estimatedOccupancyPct: number;
    avgVisibilityPct: number;
    totalScrapes: number;
    sampleSize: number;
    visibilityHistogram: Array<{ bucket: string; count: number }>;
  } | null;
  registry: Array<{
    propertyId: string;
    name: string;
    type: string | null;
    beds: string | null;
    location: string | null;
    lat: number | null;
    lng: number | null;
    rating: number | null;
    reviews: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    timesSeen: number;
    firstSeen: string;
    lastSeen: string;
    distanceKm: number | null;
  }>;
  propertyMix: Array<{ type: string; count: number; pct: number }>;
  bedsDistribution: Array<{ bucket: string; count: number }>;
  ratingHistogram: Array<{ bucket: string; count: number }>;
  concentration: {
    top5SharePct: number;
    top5Frequent: Array<{ propertyId: string; name: string; timesSeen: number }>;
    propertiesWithin1km: number;
    maxNightlyRate: number;
    totalProperties: number;
  } | null;
  trophyProperties: Array<{
    propertyId: string;
    name: string;
    type: string | null;
    beds: string | null;
    rating: number | null;
    reviews: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    timesSeen: number;
    distanceKm: number | null;
  }>;
  caveats: { source: string; daysOfHistory: number; notes: string[] };
}

interface Props {
  citySlug: string;
  currencySymbol: string;
}

// ----------------------------------------------------------------------------
// Design tokens
// ----------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: R.darkBand,
  border: `1px solid ${R.border}`,
  borderRadius: "8px",
  padding: "20px",
};

const titleStyle: React.CSSProperties = {
  color: R.accent,
  fontSize: "13px",
  fontWeight: 500,
  marginBottom: "4px",
};

const subtitleStyle: React.CSSProperties = {
  color: R.textDim,
  fontSize: "11px",
  marginBottom: "16px",
};

const tipContent: React.CSSProperties = {
  background: "rgba(12, 14, 18, 0.95)",
  border: `1px solid ${R.border}`,
  borderRadius: "6px",
  padding: "8px 12px",
  color: R.accent,
  fontSize: "12px",
};

const tipLabel: React.CSSProperties = { color: R.textMid, fontSize: "11px", marginBottom: "4px" };
const tipItem: React.CSSProperties = { color: R.accent, fontSize: "12px" };
const tipCursor = { fill: "rgba(57, 189, 248, 0.06)" };

const gridStroke = { stroke: R.border, strokeOpacity: 0.5 };
const axisTick = { fill: R.textMid, fontSize: 11 };
const axisLine = { stroke: R.border };

const upperLabel: React.CSSProperties = {
  color: R.textDim,
  fontSize: "9px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: 600,
};

// Pre-clean-dataset history offset
const LEGACY_SCRAPE_DAYS = 7;
const LEGACY_FIRST_SCRAPE = "2026-04-04";

// Palette
const PIE_COLORS = [R.warmTeal, R.warmTeal, R.gold, "#8b5cf6", R.red, R.textDim];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

const formatLongDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const occupancyColor = (pct: number): string => {
  if (pct < 30) return `${R.warmTeal}88`;
  if (pct < 50) return `${R.warmTeal}cc`;
  if (pct < 70) return "#a855f7bb";
  if (pct < 85) return `${R.gold}dd`;
  return `${R.red}ee`;
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function ArchanesInvestorView({ citySlug, currencySymbol }: Props) {
  const [data, setData] = useState<InvestorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/market/airbnb-investor/${citySlug}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("ArchanesInvestorView fetch failed:", err);
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [citySlug]);

  const fmt = (v: number | null | undefined, decimals = 0) =>
    v === null || v === undefined || isNaN(Number(v))
      ? "—"
      : `${currencySymbol}${Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

  const avgPerDateOccupancy = useMemo(() => {
    if (!data) return null;
    const occs = data.demandCalendar.map((d) => d.occupancyPct).filter((x): x is number => x !== null);
    if (occs.length === 0) return null;
    return Math.round(occs.reduce((a, b) => a + b, 0) / occs.length);
  }, [data]);

  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.registry
      .filter((p) => p.distanceKm !== null && p.avgPrice > 0)
      .map((p) => ({ x: p.distanceKm, y: p.avgPrice, z: Math.max(p.timesSeen, 1), name: p.name }));
  }, [data]);

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: R.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} style={{ color: R.warmTeal, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px", color: R.red, margin: "28px 32px" }}>
        Failed to load investor view. {error}
      </div>
    );
  }

  if (!data.tracking.firstScrape || data.registry.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px", color: R.textMid, margin: "28px 32px" }}>
        No Airbnb data collected for Archanes yet. The scraper runs daily — come back tomorrow.
      </div>
    );
  }

  const { tracking, kpis, demandCalendar, forwardAdrCurve, dowPremium, priceLadder, priceLadderByBeds, occupancyAnalysis, propertyMix, bedsDistribution, ratingHistogram, concentration, trophyProperties, caveats, registry } = data;

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Market Intelligence</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <MapPin size={22} color={R.warmTeal} />
              <h1 style={{ color: R.accent, fontSize: "22px", fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
                Archanes — Investor View
              </h1>
            </div>
            <div style={{ color: R.textMid, fontSize: "13px" }}>
              Live Airbnb intelligence · 10 km radius around Archanes village · built for go/no-go decisions on short-let supply
            </div>
          </div>
          <div style={{
            padding: "10px 14px",
            background: `${R.warmTeal}0a`,
            border: `1px solid ${R.warmTeal}30`,
            borderRadius: "8px",
            color: R.textMid,
            fontSize: "11px",
            lineHeight: 1.6,
            textAlign: "right",
            minWidth: "260px",
          }}>
            <div>Tracked since <span style={{ color: R.warmTeal, fontWeight: 600 }}>{formatLongDate(LEGACY_FIRST_SCRAPE)}</span></div>
            <div>
              <span style={{ color: R.accent, fontWeight: 600 }}>{tracking.totalScrapes + LEGACY_SCRAPE_DAYS}</span> daily scrapes
              {" · "}
              <span style={{ color: R.accent, fontWeight: 600 }}>{tracking.uniqueProperties}</span> unique properties seen
            </div>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <KpiTile icon={<Building2 size={16} color={R.warmTeal} />} label="Unique Properties" value={kpis.uniqueProperties.toString()} hint="Distinct listings tracked" />
          <KpiTile icon={<Coins size={16} color={R.warmTeal} />} label="Median Nightly Rate" value={fmt(kpis.medianNightlyRate)} hint="Across all listings & forward dates" />
          <KpiTile icon={<TrendingUp size={16} color={R.warmTeal} />} label="Forward 90d ADR" value={fmt(kpis.forwardAvgRate)} hint="Latest scrape average" />
          <KpiTile icon={<CalendarRange size={16} color={R.warmTeal} />} label="Avg Listings / Night" value={kpis.avgListingsPerNight?.toString() || "—"} hint="Latest scrape" />
        </div>

        {/* ── FORWARD OCCUPANCY ── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
            <div style={titleStyle}>Forward Occupancy — Next 90 Days</div>
            <div style={{ color: R.textDim, fontSize: "11px" }}>
              {demandCalendar[0]?.scrapeUniqueProperties || 0} unique properties this scrape
            </div>
          </div>
          <div style={subtitleStyle}>
            Per check-in date · 1 − (listings still bookable ÷ all properties seen this scrape) · taller red bars = tighter dates
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={demandCalendar} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridStroke} vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={axisTick} axisLine={axisLine} tickLine={false} interval={6} />
              <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={tipCursor}
                contentStyle={tipContent}
                labelStyle={tipLabel}
                itemStyle={tipItem}
                labelFormatter={formatDate}
                formatter={(_v: any, _name: any, props: any) => {
                  const p = props.payload;
                  return [`${p.occupancyPct}% occ · ${p.listings} of ${p.scrapeUniqueProperties} bookable${p.avgPrice ? ` · ${fmt(p.avgPrice)}` : ""}`, ""];
                }}
              />
              <Bar dataKey="occupancyPct" radius={[3, 3, 0, 0]} maxBarSize={14}>
                {demandCalendar.map((d, i) => (
                  <Cell key={i} fill={occupancyColor(d.occupancyPct ?? 0)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", color: R.textDim, fontSize: "10px" }}>
            <span>Loose</span>
            {[15, 40, 60, 78, 92].map((p) => (
              <div key={p} style={{ width: "20px", height: "10px", borderRadius: "2px", background: occupancyColor(p) }} />
            ))}
            <span>Tight</span>
            <span style={{ marginLeft: "auto", color: R.textMid }}>
              Search constrained to 10 km around Archanes village so the result count is not clipped by Airbnb's per-query ceiling.
            </span>
          </div>
        </div>

        {/* ── ADR CURVE + DOW PREMIUM ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={titleStyle}>Forward ADR Curve — Next 90 Days</div>
            <div style={subtitleStyle}>Average and median nightly rate from the latest scrape</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={forwardAdrCurve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridStroke} />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `${currencySymbol}${v}`} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={tipCursor} contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem} labelFormatter={formatDate} formatter={(v: number, name: string) => [fmt(v), name]} />
                <Line type="monotone" dataKey="avgPrice" stroke={R.warmTeal} strokeWidth={2} dot={false} name="Avg" />
                <Line type="monotone" dataKey="medianPrice" stroke={R.warmTeal} strokeWidth={2} dot={false} strokeDasharray="4 4" name="Median" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <div style={titleStyle}>Day-of-Week Premium</div>
            <div style={subtitleStyle}>% above midweek (Mon–Thu) baseline</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dowPremium} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridStroke} />
                <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis tickFormatter={(v: number) => `${v}%`} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={tipCursor} contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem} formatter={(v: number) => [`${v}%`, "vs midweek"]} />
                <Bar dataKey="premiumPct" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {dowPremium.map((d, i) => (
                    <Cell key={i} fill={(d.premiumPct || 0) > 0 ? R.warmTeal : R.textDim} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── PRICE LADDER + BY BEDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={titleStyle}>Price Ladder — Whole Market</div>
            <div style={subtitleStyle}>What each tier actually charges · plan around P75–P90, not the average</div>
            {priceLadder ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                {[
                  { key: "p10", label: "P10  · Budget", value: priceLadder.p10, color: R.textDim },
                  { key: "p25", label: "P25  · Lower-Mid", value: priceLadder.p25, color: R.warmTeal },
                  { key: "p50", label: "P50  · Median", value: priceLadder.p50, color: R.warmTeal },
                  { key: "p75", label: "P75  · Upper-Mid", value: priceLadder.p75, color: R.gold },
                  { key: "p90", label: "P90  · Premium", value: priceLadder.p90, color: R.red },
                ].map((row) => {
                  const pct = priceLadder.p90 > 0 ? (row.value / priceLadder.p90) * 100 : 0;
                  return (
                    <div key={row.key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "120px", color: R.textMid, fontSize: "12px" }}>{row.label}</div>
                      <div style={{ flex: 1, height: "20px", background: R.darkBand, borderRadius: "4px", border: `1px solid ${R.border}`, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: row.color, opacity: 0.85 }} />
                      </div>
                      <div style={{ width: "90px", textAlign: "right", color: R.accent, fontSize: "13px", fontWeight: 600 }}>
                        {fmt(row.value)}
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: "8px", color: R.textDim, fontSize: "11px" }}>
                  Sample size: {priceLadder.sampleSize} unique properties
                </div>
              </div>
            ) : (
              <div style={{ color: R.textDim, fontSize: "12px" }}>Not enough data yet.</div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={titleStyle}>Price Ladder — by Bed Configuration</div>
            <div style={subtitleStyle}>How the bed-count premium stacks · medium tick = P50 · faded edges = P10/P90</div>
            {priceLadderByBeds.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "8px" }}>
                {(() => {
                  const globalMax = Math.max(...priceLadderByBeds.map((b) => b.p90));
                  return priceLadderByBeds.map((b) => {
                    const p10pct = (b.p10 / globalMax) * 100;
                    const p25pct = (b.p25 / globalMax) * 100;
                    const p50pct = (b.p50 / globalMax) * 100;
                    const p75pct = (b.p75 / globalMax) * 100;
                    const p90pct = (b.p90 / globalMax) * 100;
                    return (
                      <div key={b.bucket}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: R.accent, fontSize: "12px", fontWeight: 600 }}>{b.bucket}</span>
                          <span style={{ color: R.textDim, fontSize: "11px" }}>n={b.sampleSize} · {fmt(b.p10)}–{fmt(b.p90)}</span>
                        </div>
                        <div style={{ position: "relative", height: "16px", background: R.darkBand, borderRadius: "4px", border: `1px solid ${R.border}`, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: `${p10pct}%`, width: `${p90pct - p10pct}%`, height: "100%", background: `${R.warmTeal}30` }} />
                          <div style={{ position: "absolute", left: `${p25pct}%`, width: `${p75pct - p25pct}%`, height: "100%", background: `${R.warmTeal}88` }} />
                          <div style={{ position: "absolute", left: `${p50pct}%`, top: 0, bottom: 0, width: "2px", background: R.warmTeal }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: R.textDim, fontSize: "10px" }}>
                          <span>{fmt(0)}</span>
                          <span>{fmt(globalMax)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div style={{ color: R.textDim, fontSize: "12px" }}>Not enough data yet.</div>
            )}
          </div>
        </div>

        {/* ── ESTIMATED OCCUPANCY ── */}
        {avgPerDateOccupancy !== null && occupancyAnalysis && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <div style={titleStyle}>Estimated Occupancy</div>
                <div style={subtitleStyle}>
                  Per-date average across the 90-day forward window · 1 − (listings still bookable on a date ÷ all properties seen this scrape)
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: "180px" }}>
                <div style={{ color: R.warmTeal, fontSize: "44px", fontWeight: 600, lineHeight: 1 }}>
                  {avgPerDateOccupancy}%
                </div>
                <div style={{ color: R.textDim, fontSize: "11px", marginTop: "4px" }}>
                  avg across 90 dates · {occupancyAnalysis.sampleSize} properties
                </div>
              </div>
            </div>

            {occupancyAnalysis.totalScrapes >= 3 ? (
              <div style={{ marginTop: "20px" }}>
                <div style={{ ...upperLabel, marginBottom: "8px" }}>
                  Cross-Scrape Visibility (% of scrape days each property appeared in)
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={occupancyAnalysis.visibilityHistogram} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridStroke} vertical={false} />
                    <XAxis dataKey="bucket" tick={axisTick} axisLine={axisLine} tickLine={false} />
                    <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                    <Tooltip cursor={tipCursor} contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {occupancyAnalysis.visibilityHistogram.map((_d, i) => (
                        <Cell key={i} fill={[R.red, R.gold, "#a855f7", R.warmTeal, R.warmTeal][i] || R.warmTeal} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", color: R.textDim, fontSize: "10px" }}>
                  <span>← rarely visible (likely booked / blocked)</span>
                  <span>always visible (likely chronically vacant) →</span>
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: "16px", padding: "12px 16px",
                background: `${R.warmTeal}06`, border: `1px dashed ${R.warmTeal}40`, borderRadius: "6px",
                color: R.textMid, fontSize: "11px", lineHeight: 1.6, textAlign: "center",
              }}>
                <strong style={{ color: R.warmTeal }}>Cross-scrape visibility chart unlocks at 3+ scrape days.</strong> Currently {occupancyAnalysis.totalScrapes} day(s) of clean data — once we accumulate a few more, this section will also show how often each individual property appears in our scrapes.
              </div>
            )}

            <div style={{
              marginTop: "16px", padding: "10px 14px",
              background: `${R.gold}08`, border: `1px solid ${R.gold}30`, borderRadius: "6px",
              color: R.textMid, fontSize: "11px", lineHeight: 1.6,
            }}>
              <span style={{ color: R.gold, fontWeight: 600 }}>Methodology. </span>
              Two complementary methods. <strong style={{ color: R.accent }}>Per-date (headline):</strong> for each forward check-in date, occupancy = 1 − (listings still bookable on that date ÷ unique properties seen in this scrape). Works with a single scrape. <strong style={{ color: R.accent }}>Per-property (chart, when populated):</strong> tracks how often each individual listing appears across multiple daily scrapes. Both should converge once we have 7+ days of history. Search radius is 10 km from Archanes village.
            </div>
          </div>
        )}

        {/* ── PROPERTY MAP ── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <div style={titleStyle}>Property Map</div>
              <div style={{ ...subtitleStyle, marginBottom: 0 }}>
                Every tracked property · clustered when zoomed out · coloured by ADR tier
              </div>
            </div>
            <div style={{ color: R.textDim, fontSize: "11px" }}>
              {registry.filter((p) => p.lat !== null).length} mapped of {registry.length}
            </div>
          </div>
          <Suspense
            fallback={
              <div style={{ height: "520px", display: "flex", alignItems: "center", justifyContent: "center", color: R.textDim, fontSize: "13px" }}>
                Loading map…
              </div>
            }
          >
            <ArchanesPropertyMap registry={registry} currencySymbol={currencySymbol} />
          </Suspense>
        </div>

        {/* ── DISTANCE SCATTER + CONCENTRATION ── */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={titleStyle}>Distance vs Nightly Rate</div>
            <div style={subtitleStyle}>How much premium a walkable-to-village location commands · dot size = times the listing appeared</div>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid {...gridStroke} />
                <XAxis type="number" dataKey="x" name="Distance" unit="km" tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis type="number" dataKey="y" name="ADR" tickFormatter={(v: number) => `${currencySymbol}${v}`} tick={axisTick} axisLine={false} tickLine={false} />
                <ZAxis type="number" dataKey="z" range={[20, 220]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: R.warmTeal }}
                  contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem}
                  formatter={(v: any, name: string) => {
                    if (name === "ADR") return [fmt(v), "ADR"];
                    if (name === "Distance") return [`${v} km`, "From centre"];
                    return [v, name];
                  }}
                />
                <Scatter data={scatterData} fill={R.warmTeal} fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <div style={titleStyle}>Concentration & Geography</div>
            <div style={subtitleStyle}>How fragmented vs concentrated this market is</div>
            {concentration && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
                <ConcentrationStat label="Top 5 listings (by frequency)" value={`${concentration.top5SharePct}% of all observed listing-nights`} />
                <ConcentrationStat label="Properties within 1 km of village centre" value={`${concentration.propertiesWithin1km} of ${concentration.totalProperties}`} />
                <ConcentrationStat label="Highest single nightly rate seen" value={fmt(concentration.maxNightlyRate)} />
                <div>
                  <div style={{ ...upperLabel, marginBottom: "6px" }}>Most Frequent Listings</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {concentration.top5Frequent.map((p) => (
                      <div key={p.propertyId} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                        <span style={{ color: R.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>{p.name || "—"}</span>
                        <span style={{ color: R.warmTeal, fontWeight: 600 }}>{p.timesSeen}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── PROPERTY MIX + BEDS + RATINGS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Layers size={14} color={R.warmTeal} />
              <div style={titleStyle}>Property Mix</div>
            </div>
            <div style={subtitleStyle}>By listing type</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={propertyMix} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={48} outerRadius={80} stroke={R.card} strokeWidth={2}>
                  {propertyMix.map((_entry, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem} formatter={(v: any, _name: any, props: any) => [`${v} (${props.payload.pct}%)`, props.payload.type]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {propertyMix.slice(0, 6).map((m, i) => (
                <div key={m.type} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: R.textMid }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span style={{ textTransform: "capitalize" }}>{m.type}</span>
                  <span style={{ color: R.textDim }}>{m.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Building2 size={14} color={R.warmTeal} />
              <div style={titleStyle}>Bed Configuration</div>
            </div>
            <div style={subtitleStyle}>What asset shape the market wants</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bedsDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridStroke} />
                <XAxis dataKey="bucket" tick={axisTick} axisLine={axisLine} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={tipCursor} contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem} />
                <Bar dataKey="count" fill={R.warmTeal} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Star size={14} color={R.warmTeal} />
              <div style={titleStyle}>Quality Bar</div>
            </div>
            <div style={subtitleStyle}>How saturated the comp set is at the top</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ratingHistogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid {...gridStroke} />
                <XAxis dataKey="bucket" tick={{ fill: R.textMid, fontSize: 9 }} axisLine={axisLine} tickLine={false} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip cursor={tipCursor} contentStyle={tipContent} labelStyle={tipLabel} itemStyle={tipItem} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                  {ratingHistogram.map((r, i) => (
                    <Cell key={i} fill={r.bucket === "Unrated" || r.bucket === "<4.0" ? R.textDim : r.bucket >= "4.7-4.8" ? R.warmTeal : `${R.warmTeal}80`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── TOP 100 TROPHY PROPERTIES ── */}
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Award size={14} color={R.gold} />
            <div style={titleStyle}>Top 100 Trophy Properties</div>
          </div>
          <div style={subtitleStyle}>The highest-priced listings — your competitive set if you're building at the top of the market</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#", "Name", "Type", "Beds", "Rating", "Avg", "Min", "Max", "Seen", "Dist."].map((h) => (
                    <th key={h} style={{
                      ...upperLabel,
                      textAlign: ["Name", "Type", "Beds"].includes(h) ? "left" : "right",
                      padding: "8px 10px",
                      borderBottom: `1px solid ${R.border}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trophyProperties.map((p, i) => (
                  <tr key={p.propertyId} style={{ borderBottom: `1px solid ${R.border}50` }}>
                    <td style={{ color: R.textDim, fontSize: "11px", padding: "10px" }}>{i + 1}</td>
                    <td style={{ color: R.accent, fontSize: "12px", padding: "10px", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "—"}</td>
                    <td style={{ color: R.textMid, fontSize: "12px", padding: "10px", textTransform: "capitalize" }}>{p.type || "—"}</td>
                    <td style={{ color: R.textMid, fontSize: "11px", padding: "10px" }}>{p.beds || "—"}</td>
                    <td style={{ color: R.textMid, fontSize: "12px", padding: "10px", textAlign: "right" }}>
                      {p.rating ? `${p.rating} (${p.reviews})` : "—"}
                    </td>
                    <td style={{ color: R.warmTeal, fontSize: "12px", padding: "10px", textAlign: "right", fontWeight: 600 }}>{fmt(p.avgPrice)}</td>
                    <td style={{ color: R.warmTeal, fontSize: "12px", padding: "10px", textAlign: "right" }}>{fmt(p.minPrice)}</td>
                    <td style={{ color: R.red, fontSize: "12px", padding: "10px", textAlign: "right" }}>{fmt(p.maxPrice)}</td>
                    <td style={{ color: R.textMid, fontSize: "12px", padding: "10px", textAlign: "right" }}>{p.timesSeen}×</td>
                    <td style={{ color: R.textDim, fontSize: "11px", padding: "10px", textAlign: "right" }}>
                      {p.distanceKm !== null ? `${p.distanceKm.toFixed(1)} km` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CAVEATS ── */}
        <div style={{ ...cardStyle, background: `${R.gold}08`, border: `1px solid ${R.gold}30` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Users size={14} color={R.gold} />
            <div style={{ ...titleStyle, marginBottom: 0 }}>Data Caveats</div>
          </div>
          <div style={{ color: R.textMid, fontSize: "12px", lineHeight: 1.7 }}>
            {caveats.notes.map((n, i) => (
              <div key={i}>· {n}</div>
            ))}
            <div>· {caveats.daysOfHistory} days of history collected so far. Signals get stronger with each passing scrape.</div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function KpiTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        {icon}
        <div style={upperLabel}>{label}</div>
      </div>
      <div style={{ color: R.warmTeal, fontSize: "26px", fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: R.textDim, fontSize: "11px", marginTop: "4px" }}>{hint}</div>
    </div>
  );
}

function ConcentrationStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...upperLabel, marginBottom: "4px" }}>{label}</div>
      <div style={{ color: R.accent, fontSize: "14px", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default ArchanesInvestorView;
