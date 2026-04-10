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
  topTen: Array<{
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
// Shared style tokens
// ----------------------------------------------------------------------------

const card: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "20px",
};

const cardTitle: React.CSSProperties = {
  color: "#e5e5e5",
  fontSize: "14px",
  fontWeight: 600,
  marginBottom: "4px",
};

const cardSubtitle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "11px",
  marginBottom: "16px",
};

const tooltipContent: React.CSSProperties = {
  background: "rgba(26, 26, 26, 0.95)",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "8px 12px",
  color: "#e5e5e5",
  fontSize: "12px",
};

// Recharts default item/label colour is near-black on the wrapper bg.
// Apply white text via these props on every Tooltip in this view.
const tooltipLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "11px",
  marginBottom: "4px",
};

const tooltipItem: React.CSSProperties = {
  color: "#e5e5e5",
  fontSize: "12px",
};

const tooltipCursor = { fill: "rgba(57, 189, 248, 0.08)" };

// Pre-clean-dataset history. We collected data from 2026-04-04 to 2026-04-10
// before the 10 km bbox + EUR currency fixes landed; that data was wiped
// because it was geographically polluted and priced in PLN. The badge counts
// those days as part of the tracking history even though they don't appear
// in the database. When new clean days accumulate this offset stays constant.
const LEGACY_SCRAPE_DAYS = 7;
const LEGACY_FIRST_SCRAPE = "2026-04-04";

const labelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "-0.025em",
  fontWeight: 600,
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

const formatLongDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
    return () => {
      cancelled = true;
    };
  }, [citySlug]);

  const fmt = (v: number | null | undefined, decimals = 0) =>
    v === null || v === undefined || isNaN(Number(v))
      ? "—"
      : `${currencySymbol}${Number(v).toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}`;

  // Average per-date occupancy from the demand calendar (works with 1 scrape).
  // Per-property visibility ratios need multiple scrapes to be informative;
  // until we have 7+ days they all read 100% which is meaningless.
  const avgPerDateOccupancy = useMemo(() => {
    if (!data) return null;
    const occs = data.demandCalendar
      .map((d) => d.occupancyPct)
      .filter((x): x is number => x !== null);
    if (occs.length === 0) return null;
    return Math.round(occs.reduce((a, b) => a + b, 0) / occs.length);
  }, [data]);

  // Distance scatter data (memoised)
  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.registry
      .filter((p) => p.distanceKm !== null && p.avgPrice > 0)
      .map((p) => ({
        x: p.distanceKm,
        y: p.avgPrice,
        z: Math.max(p.timesSeen, 1),
        name: p.name,
      }));
  }, [data]);

  if (loading) {
    return (
      <div
        style={{
          ...card,
          textAlign: "center",
          padding: "60px",
          color: "#6b7280",
          margin: "24px",
        }}
      >
        Loading Archanes investor view…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          ...card,
          textAlign: "center",
          padding: "60px",
          color: "#ef4444",
          margin: "24px",
        }}
      >
        Failed to load investor view. {error}
      </div>
    );
  }

  if (!data.tracking.firstScrape || data.registry.length === 0) {
    return (
      <div
        style={{
          ...card,
          textAlign: "center",
          padding: "60px",
          color: "#9ca3af",
          margin: "24px",
        }}
      >
        No Airbnb data collected for Archanes yet. The scraper runs daily — come
        back tomorrow.
      </div>
    );
  }

  const { tracking, kpis, demandCalendar, forwardAdrCurve, dowPremium, priceLadder, priceLadderByBeds, occupancyAnalysis, propertyMix, bedsDistribution, ratingHistogram, concentration, topTen, caveats, registry } = data;

  // Colour ramp for per-date occupancy bars (0% blue → 100% red)
  const occupancyColor = (pct: number): string => {
    if (pct < 30) return "rgba(57, 189, 248, 0.55)";
    if (pct < 50) return "rgba(57, 189, 248, 0.85)";
    if (pct < 70) return "rgba(168, 85, 247, 0.75)";
    if (pct < 85) return "rgba(245, 158, 11, 0.85)";
    return "rgba(239, 68, 68, 0.9)";
  };


  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ---------------------------------------------------------------- */}
      {/* HEADER + TRACKING BADGE                                          */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <MapPin size={20} color="#39BDF8" />
            <h1 style={{ color: "#e5e5e5", fontSize: "22px", fontWeight: 600, margin: 0 }}>
              Archanes — Investor View
            </h1>
          </div>
          <div style={{ color: "#9ca3af", fontSize: "13px" }}>
            Live market intelligence from Airbnb · 10 km radius around Archanes village ·
            built for go/no-go decisions on building or buying short-let supply.
          </div>
        </div>
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(57, 189, 248, 0.06)",
            border: "1px solid rgba(57, 189, 248, 0.2)",
            borderRadius: "8px",
            color: "#9ca3af",
            fontSize: "11px",
            lineHeight: 1.6,
            textAlign: "right",
            minWidth: "260px",
          }}
        >
          <div>
            Tracked since{" "}
            <span style={{ color: "#39BDF8", fontWeight: 600 }}>{formatLongDate(LEGACY_FIRST_SCRAPE)}</span>
          </div>
          <div>
            <span style={{ color: "#e5e5e5", fontWeight: 600 }}>{tracking.totalScrapes + LEGACY_SCRAPE_DAYS}</span> daily scrapes
            {" · "}
            <span style={{ color: "#e5e5e5", fontWeight: 600 }}>{tracking.uniqueProperties}</span> unique properties seen
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* KPI STRIP                                                        */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        <KpiTile icon={<Building2 size={16} color="#39BDF8" />} label="Unique Properties" value={kpis.uniqueProperties.toString()} hint="Distinct listings tracked" />
        <KpiTile icon={<Coins size={16} color="#39BDF8" />} label="Median Nightly Rate" value={fmt(kpis.medianNightlyRate)} hint="Across all listings & forward dates" />
        <KpiTile icon={<TrendingUp size={16} color="#39BDF8" />} label="Forward 90d ADR" value={fmt(kpis.forwardAvgRate)} hint="Latest scrape average" />
        <KpiTile icon={<CalendarRange size={16} color="#39BDF8" />} label="Avg Listings / Night" value={kpis.avgListingsPerNight?.toString() || "—"} hint="Latest scrape" />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* FORWARD OCCUPANCY (per-date proxy from scrape_unique_properties) */}
      {/* ---------------------------------------------------------------- */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
          <div style={cardTitle}>Forward Occupancy — Next 90 Days</div>
          <div style={{ color: "#6b7280", fontSize: "11px" }}>
            {demandCalendar[0]?.scrapeUniqueProperties || 0} unique properties this scrape
          </div>
        </div>
        <div style={cardSubtitle}>
          Per check-in date · 1 − (listings still bookable ÷ all properties seen this scrape) · taller red bars = tighter dates
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={demandCalendar} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={{ stroke: "#2a2a2a" }}
              tickLine={false}
              interval={6}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={tooltipCursor}
              contentStyle={tooltipContent}
              labelStyle={tooltipLabel}
              itemStyle={tooltipItem}
              labelFormatter={formatDate}
              formatter={(_v: any, _name: any, props: any) => {
                const p = props.payload;
                return [
                  `${p.occupancyPct}% occ · ${p.listings} of ${p.scrapeUniqueProperties} bookable${p.avgPrice ? ` · ${fmt(p.avgPrice)}` : ""}`,
                  "",
                ];
              }}
            />
            <Bar dataKey="occupancyPct" radius={[3, 3, 0, 0]} maxBarSize={14}>
              {demandCalendar.map((d, i) => (
                <Cell key={i} fill={occupancyColor(d.occupancyPct ?? 0)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", color: "#6b7280", fontSize: "10px" }}>
          <span>Loose</span>
          {[15, 40, 60, 78, 92].map((p) => (
            <div key={p} style={{ width: "20px", height: "10px", borderRadius: "2px", background: occupancyColor(p) }} />
          ))}
          <span>Tight</span>
          <span style={{ marginLeft: "auto", color: "#9ca3af" }}>
            Search constrained to 10 km around Archanes village so the result count is not clipped by Airbnb's per-query ceiling — per-date variation reflects real availability.
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* FORWARD ADR CURVE + DAY-OF-WEEK PREMIUM (2-up)                   */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
        <div style={card}>
          <div style={cardTitle}>Forward ADR Curve — Next 90 Days</div>
          <div style={cardSubtitle}>Average and median nightly rate from the latest scrape</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={forwardAdrCurve} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${currencySymbol}${v}`}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={tooltipCursor}
                contentStyle={tooltipContent}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                labelFormatter={formatDate}
                formatter={(v: number, name: string) => [fmt(v), name]}
              />
              <Line type="monotone" dataKey="avgPrice" stroke="#39BDF8" strokeWidth={2} dot={false} name="Avg" />
              <Line type="monotone" dataKey="medianPrice" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" name="Median" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={cardTitle}>Day-of-Week Premium</div>
          <div style={cardSubtitle}>% above midweek (Mon–Thu) baseline</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dowPremium} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#2a2a2a" }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={tooltipCursor}
                contentStyle={tooltipContent}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(v: number) => [`${v}%`, "vs midweek"]}
              />
              <Bar dataKey="premiumPct" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {dowPremium.map((d, i) => (
                  <Cell key={i} fill={(d.premiumPct || 0) > 0 ? "#39BDF8" : "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* PRICE LADDER + PRICE LADDER BY BEDS (2-up)                       */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={card}>
          <div style={cardTitle}>Price Ladder — Whole Market</div>
          <div style={cardSubtitle}>
            What each tier of property actually charges · plan a high-end villa around P75–P90, not the average
          </div>
          {priceLadder ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
              {[
                { key: "p10", label: "P10  · Budget", value: priceLadder.p10, color: "#6b7280" },
                { key: "p25", label: "P25  · Lower-Mid", value: priceLadder.p25, color: "#10b981" },
                { key: "p50", label: "P50  · Median", value: priceLadder.p50, color: "#39BDF8" },
                { key: "p75", label: "P75  · Upper-Mid", value: priceLadder.p75, color: "#f59e0b" },
                { key: "p90", label: "P90  · Premium", value: priceLadder.p90, color: "#ef4444" },
              ].map((row) => {
                const pct = priceLadder.p90 > 0 ? (row.value / priceLadder.p90) * 100 : 0;
                return (
                  <div key={row.key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "120px", color: "#9ca3af", fontSize: "12px" }}>{row.label}</div>
                    <div style={{ flex: 1, height: "20px", background: "#1d1d1c", borderRadius: "4px", border: "1px solid #2a2a2a", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: row.color, opacity: 0.85 }} />
                    </div>
                    <div style={{ width: "90px", textAlign: "right", color: "#e5e5e5", fontSize: "13px", fontWeight: 600 }}>
                      {fmt(row.value)}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: "8px", color: "#6b7280", fontSize: "11px" }}>
                Sample size: {priceLadder.sampleSize} unique properties
              </div>
            </div>
          ) : (
            <div style={{ color: "#6b7280", fontSize: "12px" }}>Not enough data yet.</div>
          )}
        </div>

        <div style={card}>
          <div style={cardTitle}>Price Ladder — by Bed Configuration</div>
          <div style={cardSubtitle}>
            How the bed-count premium stacks · medium tick = P50 · faded edges = P10/P90
          </div>
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
                        <span style={{ color: "#e5e5e5", fontSize: "12px", fontWeight: 600 }}>{b.bucket}</span>
                        <span style={{ color: "#6b7280", fontSize: "11px" }}>
                          n={b.sampleSize} · {fmt(b.p10)}–{fmt(b.p90)}
                        </span>
                      </div>
                      <div style={{ position: "relative", height: "16px", background: "#1d1d1c", borderRadius: "4px", border: "1px solid #2a2a2a", overflow: "hidden" }}>
                        {/* P10–P90 faded band */}
                        <div
                          style={{
                            position: "absolute",
                            left: `${p10pct}%`,
                            width: `${p90pct - p10pct}%`,
                            height: "100%",
                            background: "rgba(57, 189, 248, 0.2)",
                          }}
                        />
                        {/* P25–P75 stronger band */}
                        <div
                          style={{
                            position: "absolute",
                            left: `${p25pct}%`,
                            width: `${p75pct - p25pct}%`,
                            height: "100%",
                            background: "rgba(57, 189, 248, 0.55)",
                          }}
                        />
                        {/* P50 marker tick */}
                        <div
                          style={{
                            position: "absolute",
                            left: `${p50pct}%`,
                            top: 0,
                            bottom: 0,
                            width: "2px",
                            background: "#39BDF8",
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", color: "#6b7280", fontSize: "10px" }}>
                        <span>{fmt(0)}</span>
                        <span>{fmt(globalMax)}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div style={{ color: "#6b7280", fontSize: "12px" }}>Not enough data yet.</div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* ESTIMATED OCCUPANCY                                              */}
      {/* ---------------------------------------------------------------- */}
      {avgPerDateOccupancy !== null && occupancyAnalysis && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <div style={cardTitle}>Estimated Occupancy</div>
              <div style={cardSubtitle}>
                Per-date average across the 90-day forward window · 1 − (listings still bookable on a date ÷ all properties seen this scrape)
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: "180px" }}>
              <div style={{ color: "#39BDF8", fontSize: "44px", fontWeight: 600, lineHeight: 1 }}>
                {avgPerDateOccupancy}%
              </div>
              <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "4px" }}>
                avg across 90 dates · {occupancyAnalysis.sampleSize} properties
              </div>
            </div>
          </div>

          {occupancyAnalysis.totalScrapes >= 3 ? (
            <div style={{ marginTop: "20px" }}>
              <div style={{ ...labelStyle, marginBottom: "8px" }}>
                Cross-Scrape Visibility (% of scrape days each property appeared in)
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={occupancyAnalysis.visibilityHistogram} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#2a2a2a" }} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={tooltipCursor} contentStyle={tooltipContent} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {occupancyAnalysis.visibilityHistogram.map((_d, i) => {
                      const palette = ["#ef4444", "#f59e0b", "#a855f7", "#10b981", "#39BDF8"];
                      return <Cell key={i} fill={palette[i] || "#39BDF8"} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", color: "#6b7280", fontSize: "10px" }}>
                <span>← rarely visible (likely booked / blocked)</span>
                <span>always visible (likely chronically vacant) →</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                background: "rgba(57, 189, 248, 0.04)",
                border: "1px dashed rgba(57, 189, 248, 0.25)",
                borderRadius: "6px",
                color: "#9ca3af",
                fontSize: "11px",
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              <strong style={{ color: "#39BDF8" }}>Cross-scrape visibility chart unlocks at 3+ scrape days.</strong> Currently {occupancyAnalysis.totalScrapes} day(s) of clean data — once we accumulate a few more, this section will also show how often each individual property appears in our scrapes (a separate booking signal that complements the per-date method).
            </div>
          )}

          <div
            style={{
              marginTop: "16px",
              padding: "10px 14px",
              background: "rgba(245, 158, 11, 0.06)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "6px",
              color: "#9ca3af",
              fontSize: "11px",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>Methodology. </span>
            Two complementary methods. <strong style={{ color: "#e5e5e5" }}>Per-date (headline):</strong> for each forward check-in date, occupancy = 1 − (listings still bookable on that date ÷ unique properties seen in this scrape). Works with a single scrape. <strong style={{ color: "#e5e5e5" }}>Per-property (chart, when populated):</strong> tracks how often each individual listing appears across multiple daily scrapes — a property visible in every scrape is never booked or always blocked; a property visible rarely is genuinely booking out. Both should converge once we have 7+ days of history. Search radius is 10 km from Archanes village to ensure Airbnb's per-query ceiling never clips the data.
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* PROPERTY MAP (Leaflet)                                           */}
      {/* ---------------------------------------------------------------- */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={cardTitle}>Property Map</div>
            <div style={{ ...cardSubtitle, marginBottom: 0 }}>
              Every tracked property · clustered when zoomed out · coloured by ADR tier
            </div>
          </div>
          <div style={{ color: "#6b7280", fontSize: "11px" }}>
            {registry.filter((p) => p.lat !== null).length} mapped of {registry.length}
          </div>
        </div>
        <Suspense
          fallback={
            <div style={{ height: "520px", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: "13px" }}>
              Loading map…
            </div>
          }
        >
          <ArchanesPropertyMap registry={registry} currencySymbol={currencySymbol} />
        </Suspense>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* DISTANCE SCATTER + CONCENTRATION (2-up)                          */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
        <div style={card}>
          <div style={cardTitle}>Distance vs Nightly Rate</div>
          <div style={cardSubtitle}>How much premium a walkable-to-village location commands · dot size = times the listing has appeared</div>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis
                type="number"
                dataKey="x"
                name="Distance"
                unit="km"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="ADR"
                tickFormatter={(v: number) => `${currencySymbol}${v}`}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis type="number" dataKey="z" range={[20, 220]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3", stroke: "#39BDF8" }}
                contentStyle={tooltipContent}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(v: any, name: string) => {
                  if (name === "ADR") return [fmt(v), "ADR"];
                  if (name === "Distance") return [`${v} km`, "From centre"];
                  return [v, name];
                }}
              />
              <Scatter data={scatterData} fill="#39BDF8" fillOpacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={cardTitle}>Concentration & Geography</div>
          <div style={cardSubtitle}>How fragmented vs concentrated this market is</div>
          {concentration && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "8px" }}>
              <ConcentrationStat label="Top 5 listings (by frequency)" value={`${concentration.top5SharePct}% of all observed listing-nights`} />
              <ConcentrationStat label="Properties within 1 km of village centre" value={`${concentration.propertiesWithin1km} of ${concentration.totalProperties}`} />
              <ConcentrationStat label="Highest single nightly rate seen" value={fmt(concentration.maxNightlyRate)} />
              <div>
                <div style={{ ...labelStyle, marginBottom: "6px" }}>Most Frequent Listings</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {concentration.top5Frequent.map((p) => (
                    <div key={p.propertyId} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span style={{ color: "#e5e5e5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>{p.name || "—"}</span>
                      <span style={{ color: "#39BDF8", fontWeight: 600 }}>{p.timesSeen}×</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* PROPERTY MIX + BEDS + RATINGS (3-up)                             */}
      {/* ---------------------------------------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Layers size={14} color="#39BDF8" />
            <div style={cardTitle}>Property Mix</div>
          </div>
          <div style={cardSubtitle}>By listing type</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={propertyMix}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={80}
                stroke="#1a1a1a"
                strokeWidth={2}
              >
                {propertyMix.map((_entry, index) => (
                  <Cell key={index} fill={["#39BDF8", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#6b7280"][index % 6]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipContent}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(v: any, _name: any, props: any) => [`${v} (${props.payload.pct}%)`, props.payload.type]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
            {propertyMix.slice(0, 6).map((m, i) => (
              <div key={m.type} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#9ca3af" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: ["#39BDF8", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#6b7280"][i % 6] }} />
                <span style={{ textTransform: "capitalize" }}>{m.type}</span>
                <span style={{ color: "#6b7280" }}>{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Building2 size={14} color="#39BDF8" />
            <div style={cardTitle}>Bed Configuration</div>
          </div>
          <div style={cardSubtitle}>What asset shape the market wants</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bedsDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={{ stroke: "#2a2a2a" }} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={tooltipCursor} contentStyle={tooltipContent} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Bar dataKey="count" fill="#39BDF8" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <Star size={14} color="#39BDF8" />
            <div style={cardTitle}>Quality Bar</div>
          </div>
          <div style={cardSubtitle}>How saturated the comp set is at the top</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ratingHistogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={{ stroke: "#2a2a2a" }} tickLine={false} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={tooltipCursor} contentStyle={tooltipContent} labelStyle={tooltipLabel} itemStyle={tooltipItem} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={20}>
                {ratingHistogram.map((r, i) => (
                  <Cell key={i} fill={r.bucket === "Unrated" || r.bucket === "<4.0" ? "#6b7280" : r.bucket >= "4.7-4.8" ? "#39BDF8" : "rgba(57,189,248,0.5)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* TOP 10 TROPHY PROPERTIES TABLE                                   */}
      {/* ---------------------------------------------------------------- */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <Award size={14} color="#39BDF8" />
          <div style={cardTitle}>Top 10 Trophy Properties</div>
        </div>
        <div style={cardSubtitle}>The highest-priced listings — your competitive set if you're building at the top of the market</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "Name", "Type", "Beds", "Rating", "Avg", "Min", "Max", "Seen", "Dist."].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...labelStyle,
                      textAlign: ["Name", "Type", "Beds"].includes(h) ? "left" : "right",
                      padding: "8px 10px",
                      borderBottom: "1px solid #2a2a2a",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topTen.map((p, i) => (
                <tr key={p.propertyId} style={{ borderBottom: "1px solid rgba(42,42,42,0.5)" }}>
                  <td style={{ color: "#6b7280", fontSize: "11px", padding: "10px" }}>{i + 1}</td>
                  <td style={{ color: "#e5e5e5", fontSize: "12px", padding: "10px", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "—"}</td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", padding: "10px", textTransform: "capitalize" }}>{p.type || "—"}</td>
                  <td style={{ color: "#9ca3af", fontSize: "11px", padding: "10px" }}>{p.beds || "—"}</td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", padding: "10px", textAlign: "right" }}>
                    {p.rating ? `${p.rating} (${p.reviews})` : "—"}
                  </td>
                  <td style={{ color: "#39BDF8", fontSize: "12px", padding: "10px", textAlign: "right", fontWeight: 600 }}>{fmt(p.avgPrice)}</td>
                  <td style={{ color: "#10b981", fontSize: "12px", padding: "10px", textAlign: "right" }}>{fmt(p.minPrice)}</td>
                  <td style={{ color: "#ef4444", fontSize: "12px", padding: "10px", textAlign: "right" }}>{fmt(p.maxPrice)}</td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", padding: "10px", textAlign: "right" }}>{p.timesSeen}×</td>
                  <td style={{ color: "#6b7280", fontSize: "11px", padding: "10px", textAlign: "right" }}>
                    {p.distanceKm !== null ? `${p.distanceKm.toFixed(1)} km` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* FOOTER CAVEATS                                                   */}
      {/* ---------------------------------------------------------------- */}
      <div
        style={{
          ...card,
          background: "rgba(245, 158, 11, 0.04)",
          border: "1px solid rgba(245, 158, 11, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <Users size={14} color="#f59e0b" />
          <div style={{ ...cardTitle, marginBottom: 0 }}>Data Caveats</div>
        </div>
        <div style={{ color: "#9ca3af", fontSize: "12px", lineHeight: 1.7 }}>
          {caveats.notes.map((n, i) => (
            <div key={i}>· {n}</div>
          ))}
          <div>· {caveats.daysOfHistory} days of history collected so far. Signals get stronger with each passing scrape.</div>
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
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        {icon}
        <div style={labelStyle}>{label}</div>
      </div>
      <div style={{ color: "#39BDF8", fontSize: "26px", fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "4px" }}>{hint}</div>
    </div>
  );
}

function ConcentrationStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...labelStyle, marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

export default ArchanesInvestorView;
