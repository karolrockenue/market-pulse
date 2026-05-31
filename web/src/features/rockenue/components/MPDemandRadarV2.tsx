import { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertCircle,
  Zap,
  Activity,
  BarChart3,
  ChevronRight,
  CalendarDays,
  Layers,
  Clock,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  Cell,
  LabelList,
  ReferenceLine,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

// ── Navy Design System (from tokens) ──
import { R } from "../../../styles/tokens";
const MP = {
  bg: R.bg,
  card: R.darkBand,
  border: R.border,
  input: R.card,
  accent: R.warmTeal,
  text: R.accent,
  textSec: R.textMid,
  textMuted: R.textDim,
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  orange: "#f97316",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  gold: R.gold,
  emerald: "#0C8A43",
  // rockenue.com brand ramp (Scheme A): steel → steel-teal → teal → gold
  steel: "#3E4754",
  steelTeal: "#5E7E86",
  cream: "#F4F2EC",
  terracotta: "#C77B62",
  paceUp: "#34D068",
};

const gridStroke = { strokeDasharray: "0", stroke: MP.border, opacity: 0.5 };
const axisStyle = { stroke: MP.border, tick: { fill: MP.textMuted, fontSize: 10 }, tickLine: { stroke: MP.border }, axisLine: { stroke: MP.border } };
const tipStyle = {
  contentStyle: { backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${MP.border}`, borderRadius: "6px", padding: "10px 14px" },
  labelStyle: { color: MP.textSec, fontSize: "11px", marginBottom: "4px" },
  itemStyle: { fontSize: "12px", color: MP.text, padding: "1px 0" },
};

// Build day objects from raw API data
function buildDaysFromApi(marketData: any[], paceData: any[]) {
  // Build pace lookup
  const paceMap = new Map<string, any>();
  (paceData || []).forEach((p) => {
    const raw = String(p.checkin_date).slice(0, 10);
    const [y, m, d] = raw.split("-").map(Number);
    const key = new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
    paceMap.set(key, p);
  });

  const days = marketData.map((item, i) => {
    const raw = String(item.checkin_date).slice(0, 10);
    const [yr, mo, dy] = raw.split("-").map(Number);
    const d = new Date(Date.UTC(yr, mo - 1, dy));
    const dow = d.getUTCDay();
    const dateStr = raw;
    const demand = Math.round(item.market_demand_score || 0);
    const wap = Math.round(item.weighted_avg_price || 0);
    const segmentWap = Math.round(item.segment_wap || wap);
    const supply = item.total_results || 0;
    const mpss = item.mpss || 0;

    const pace = paceMap.get(dateStr);
    const wapDelta = pace ? Math.round(pace.wap_delta || 0) : 0;
    const supplyPctDelta = pace ? Math.round((pace.total_results_percent_delta || 0) * 10) / 10 : 0;
    const demandDelta = pace ? Math.round(pace.market_demand_score_delta || 0) : 0;
    // Guard malformed-scrape artifacts: a >60% weekly swing means the 7-days-ago
    // baseline was a broken row (e.g. supply 1,608 vs the usual ~3,900). Real
    // weekly availability moves are small, so treat these as steady not a phantom.
    const paceRaw = Math.round((-supplyPctDelta) * 10) / 10;
    const paceTighten = Math.abs(paceRaw) > 60 ? 0 : paceRaw;

    return {
      i, d, dow, dateStr,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      shortLabel: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" }),
      dayName: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      monthLabel: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      dayNum: d.getUTCDate(),
      xLabel: i % 14 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "",
      weekNum: Math.floor(i / 7),
      demand, wap, segmentWap, supply, mpss,
      wapDelta, supplyPctDelta, demandDelta,
      // CONCEPT: absolute-anchored demand (C) + pace as supply tightening (B).
      // pace = supply down vs 7d ago = market filling; +ve means tighter.
      absScore: absDemandScore(wap, supply),
      paceTighten,
      divergence: Math.max(0, (demand - 50) * 0.8 - Math.max(0, wapDelta)),
      event: null as any,
    };
  });

  // PROPOSED LOGIC (the version we kept): segment WAP for price, supply scored
  // vs its own day-of-week norm, price-led 60/40. SEG anchors estimate segment-WAP
  // P5/P95; production should derive these from history.
  const SEG_LO = 140, SEG_HI = 260, cl = (x: number) => Math.max(0, Math.min(1, x));
  const dowMed: Record<number, number> = {};
  for (let dw = 0; dw < 7; dw++) {
    const s = days.filter((d) => d.dow === dw).map((d) => d.supply).sort((a: number, b: number) => a - b);
    dowMed[dw] = s.length ? s[Math.floor(s.length / 2)] : 0;
  }

  // Add 7d moving averages + the v2 demand score
  return days.map((day, i, arr) => {
    const win = arr.slice(Math.max(0, i - 6), i + 1);
    const demandMa = Math.round(win.reduce((s, d) => s + d.demand, 0) / win.length);
    const wapMa = Math.round(win.reduce((s, d) => s + d.wap, 0) / win.length);
    const segmentWapMa = Math.round(win.reduce((s, d) => s + d.segmentWap, 0) / win.length);
    const priceScore = cl((day.segmentWap - SEG_LO) / (SEG_HI - SEG_LO)) * 100;
    const norm = dowMed[day.dow] || day.supply;
    const rel = norm ? (norm - day.supply) / norm : 0;
    const supplyScore = Math.max(0, Math.min(100, 50 + rel * 180));
    const demandV2 = Math.round(0.6 * priceScore + 0.4 * supplyScore);
    return { ...day, demandMa, wapMa, segmentWapMa, demandV2 };
  });
}

// ── Demand color scale ──
const demandColor = (d: number) =>
  d >= 85 ? MP.red : d >= 70 ? MP.orange : d >= 50 ? MP.amber : d >= 30 ? MP.accent : "#3b82f6";

// ── CONCEPT: absolute-anchored demand ──
// The live "demand" score is normalised within the 90-day window only, so its
// 0 just means "worst day on screen". Here we re-anchor to the all-history
// London range (P5/P95) so a score carries absolute meaning — a weak June day
// no longer reads like a real January trough. Anchors from scripts/probe-*.js
// (28 May scrape). When promoted, these should come from the backend, not be
// hardcoded.
const ANCHORS = { wapLo: 164, wapHi: 287, supLo: 1374, supHi: 4056 };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const absDemandScore = (wap: number, supply: number) => {
  if (!wap || !supply) return 0;
  const price = clamp01((wap - ANCHORS.wapLo) / (ANCHORS.wapHi - ANCHORS.wapLo)) * 100;
  const scarce = (1 - clamp01((supply - ANCHORS.supLo) / (ANCHORS.supHi - ANCHORS.supLo))) * 100;
  return Math.round(0.5 * scarce + 0.5 * price);
};
// Concept colour scale: Strong / Moderate / Weak
// rockenue.com brand ramp (Scheme A): Peak ≥80 gold · Strong teal · Mod steel-teal · Weak steel.
const absColor = (d: number) => (d >= 80 ? MP.gold : d >= 60 ? MP.accent : d >= 35 ? MP.steelTeal : MP.steel);

// ── Booking window zone labels ──
const ZONES = [
  { label: "0–14 days", range: [0, 14], color: MP.red, tag: "Urgent" },
  { label: "15–30 days", range: [15, 30], color: MP.orange, tag: "Tactical" },
  { label: "31–60 days", range: [31, 60], color: MP.amber, tag: "Strategic" },
  { label: "61–90 days", range: [61, 90], color: MP.accent, tag: "Horizon" },
] as const;

// Studio copy of the live Demand Radar (sentinel/DemandRadarView).
// Hardcoded to London + self-fetches hotels because the Studio host has no
// selectedProperty / allHotels context. Everything else is a verbatim clone.
interface DemandRadarProps { activeView?: string; onNavigate?: (view: string) => void }

export function MPDemandRadarV2(_props: DemandRadarProps) {
  const cityName = "London";
  const citySlug = useMemo(() => {
    return cityName ? cityName.toLowerCase().replace(/\s+/g, "-") : "";
  }, [cityName]);

  // Self-fetch hotel IDs for portfolio-level queries (booking-behavior).
  // Mirrors the dual-endpoint pattern: /api/hotels first, /api/hotels/mine on 403.
  const [hotelIds, setHotelIds] = useState<number[]>([]);
  useEffect(() => {
    const extract = (arr: any[]) =>
      (Array.isArray(arr) ? arr : [])
        .map((h: any) => parseInt(h.property_id || h.hotel_id))
        .filter((id: number) => !isNaN(id) && id > 0);
    (async () => {
      try {
        let res = await fetch("/api/hotels");
        if (res.status === 403) res = await fetch("/api/hotels/mine");
        const data = res.ok ? await res.json() : [];
        setHotelIds(extract(data));
      } catch {
        setHotelIds([]);
      }
    })();
  }, []);
  const hotelIdsParam = hotelIds.join(",");

  const curr = citySlug === "archanes" ? "€" : "£";

  const [baseDays, setBaseDays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "none">("none");

  useEffect(() => {
    if (!citySlug) {
      setIsLoading(false);
      setDataSource("none");
      setBaseDays([]);
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [marketRes, paceRes] = await Promise.all([
          fetch(`/api/market/forward-view?city=${citySlug}`),
          fetch(`/api/market/pace?city=${citySlug}&period=7`),
        ]);

        if (!marketRes.ok) throw new Error("Market API failed");

        const marketData = await marketRes.json();
        const paceData = paceRes.ok ? await paceRes.json() : [];

        if (!marketData?.length) throw new Error("No market data");

        setBaseDays(buildDaysFromApi(marketData, paceData));
        setDataSource("live");
      } catch (err) {
        console.warn("Demand Radar: no data for", citySlug, err);
        setDataSource("none");
        setBaseDays([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [citySlug]);

  // 30-day pace for banner headline (strategic view)
  const [pace30, setPace30] = useState<any[]>([]);
  useEffect(() => {
    if (!citySlug) { setPace30([]); return; }
    fetch(`/api/market/pace?city=${citySlug}&period=30`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPace30(data || []))
      .catch(() => setPace30([]));
  }, [citySlug]);

  const [phqEvents, setPhqEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!citySlug) { setPhqEvents([]); return; }
    fetch(`/api/market/events?citySlug=${citySlug}`)
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((data) => setPhqEvents(data.events || []))
      .catch(() => setPhqEvents([]));
  }, [citySlug]);

  // Fetch booking behavior (lead time + LOS) from reservations
  const [bookingBehavior, setBookingBehavior] = useState<any>(null);
  useEffect(() => {
    if (!hotelIdsParam) return;
    fetch(`/api/market/booking-behavior?hotelIds=${hotelIdsParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.totalBookings > 0) setBookingBehavior(data); })
      .catch(() => {});
  }, [hotelIdsParam]);

  // Merge events into day data — only top events by attendance get chart markers
  const days = useMemo(() => {
    // Pick the top 10 unique events by attendance to keep the chart clean
    const seen = new Set<string>();
    const topChartEvents = [...phqEvents]
      .filter((ev) => ev.localRank >= 90)
      .sort((a, b) => (b.attendance || 0) - (a.attendance || 0))
      .filter((ev) => { if (seen.has(ev.title)) return false; seen.add(ev.title); return true; })
      .slice(0, 10);
    const topTitles = new Set(topChartEvents.map((e) => e.title));

    const eventMap = new Map<string, any>();
    // Helper: iterate date strings without timezone drift
    const addDays = (dateStr: string, n: number) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + n));
      return dt.toISOString().slice(0, 10);
    };
    for (const ev of phqEvents) {
      if (!topTitles.has(ev.title)) continue;
      const start = (ev.start || "").slice(0, 10);
      const end = (ev.end || ev.start || "").slice(0, 10);
      if (!start) continue;
      for (let key = start; key <= end; key = addDays(key, 1)) {
        const existing = eventMap.get(key);
        if (!existing || ev.localRank > existing.localRank) {
          eventMap.set(key, { name: ev.title, tier: ev.tier, localRank: ev.localRank, attendance: ev.attendance, category: ev.category, accommodationSpend: ev.accommodationSpend, startDate: ev.start, endDate: ev.end || ev.start });
        }
      }
    }
    // Build OTB lookup by date
    return baseDays.map((day) => ({
      ...day,
      event: eventMap.get(day.dateStr) || null,
    }));
  }, [baseDays, phqEvents]);

  // Top events for the strip — deduplicated by name, sorted by impact, capped at 8
  const topEvents = useMemo(() => {
    const seen = new Set<string>();
    return [...phqEvents]
      .filter((ev) => ev.localRank >= 90) // Only significant events
      .sort((a, b) => b.localRank - a.localRank)
      .filter((ev) => { if (seen.has(ev.title)) return false; seen.add(ev.title); return true; })
      .slice(0, 8);
  }, [phqEvents]);

  // ── Stats ──
  const stats = useMemo(() => {
    const avg = (key: string) => Math.round(days.reduce((s, d) => s + d[key], 0) / days.length);
    const avgDemand = avg("demandV2"); // proposed-logic score (segment WAP + DOW-normed supply)
    const avgWap = avg("segmentWap");
    const avgSupply = avg("supply");

    // WAP percentiles for spike colouring (using segment WAP)
    const sortedSegWaps = [...days].map((d) => d.segmentWap).sort((a, b) => a - b);
    const pct = (p: number) => sortedSegWaps[Math.floor(sortedSegWaps.length * p)] || 0;
    const segWapP75 = pct(0.75);
    const segWapP90 = pct(0.90);

    // 30-day momentum (PACE): change in ABSOLUTE demand for these same dates vs
    // 30 days ago. Reconstruct 30-days-ago WAP/supply from the pace deltas and
    // re-score on the absolute anchors, so trend is in level-points, not supply %.
    let absMomentum = 0;
    let wapMomentum = 0;
    if (pace30.length > 0) {
      const p30 = new Map(pace30.map((p: any) => [String(p.checkin_date).slice(0, 10), p]));
      const lvlDeltas = days.map((d) => {
        const p = p30.get(d.dateStr);
        if (!p || p.wap_delta == null || p.total_results_delta == null) return null;
        const past = absDemandScore(d.wap - p.wap_delta, d.supply - p.total_results_delta);
        return d.absScore - past;
      }).filter((x): x is number => x != null);
      absMomentum = lvlDeltas.length ? Math.round(lvlDeltas.reduce((s, x) => s + x, 0) / lvlDeltas.length) : 0;
      const validW = pace30.filter((p: any) => p.wap_delta != null);
      wapMomentum = validW.length > 0 ? Math.round(validW.reduce((s: number, p: any) => s + p.wap_delta, 0) / validW.length) : 0;
    }

    // CONCEPT classification: LEVEL (the demandV2 score) vs TREND (pace), kept independent.
    const strongDays = days.filter((d) => d.demandV2 >= 60).length;
    const lowDemand = days.filter((d) => d.demandV2 < 35).length;
    const pricingPowerDays = days.filter((d) => d.demandV2 >= 60 && d.paceTighten >= 3).length;

    const risingDemandFlatPrice = days.filter((d) => d.demandDelta > 5 && d.wapDelta < 2).length;
    const compressed = days.filter((d) => d.supplyPctDelta < -2 && d.demandV2 >= 55).length;

    const sorted = [...days].sort((a, b) => b.demandV2 - a.demandV2);
    const peak = sorted[0];
    const trough = sorted[sorted.length - 1];

    // LEVEL band drives the headline; TREND only drives the arrow/colour.
    const level =
      avgDemand >= 70 ? "at peak strength" :
      avgDemand >= 58 ? "strong" :
      avgDemand >= 45 ? "steady" :
      avgDemand >= 30 ? "soft" : "weak";
    const regime = level;
    const trendDir = absMomentum > 1 ? "up" : absMomentum < -1 ? "down" : "flat";

    // Day-of-week averages
    const dowAvg = Array.from({ length: 7 }, (_, dow) => {
      const subset = days.filter((d) => d.dow === dow);
      return {
        dow,
        label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
        demand: Math.round(subset.reduce((s, d) => s + d.demand, 0) / subset.length),
        wap: Math.round(subset.reduce((s, d) => s + d.segmentWap, 0) / subset.length),
        supply: Math.round(subset.reduce((s, d) => s + d.supply, 0) / subset.length),
      };
    });

    // Booking window zones
    const zones = ZONES.map((z) => {
      const subset = days.filter((d) => d.i >= z.range[0] && d.i <= z.range[1]);
      return {
        ...z,
        avgDemand: Math.round(subset.reduce((s, d) => s + d.demand, 0) / subset.length),
        avgWap: Math.round(subset.reduce((s, d) => s + d.segmentWap, 0) / subset.length),
        avgSupply: Math.round(subset.reduce((s, d) => s + d.supply, 0) / subset.length),
        highDays: subset.filter((d) => d.demand >= 70).length,
        count: subset.length,
      };
    });

    // AI Market Brief — derive narrative insights
    const eventDays = days.filter((d) => d.event);

    // Booking behavior — use real data if available, else mock fallback
    const mockLtBuckets = [
      { label: "0–7d", value: 18, color: MP.red },
      { label: "8–14d", value: 22, color: MP.orange },
      { label: "15–30d", value: 28, color: MP.amber },
      { label: "31–60d", value: 20, color: MP.accent },
      { label: "60d+", value: 12, color: "#3b82f6" },
    ];
    const mockLosBuckets = [
      { label: "1 night", value: 35, color: MP.accent },
      { label: "2 nights", value: 30, color: MP.amber },
      { label: "3 nights", value: 18, color: MP.orange },
      { label: "4+ nights", value: 17, color: MP.purple },
    ];
    const leadTimeBuckets = bookingBehavior?.leadTimeBuckets?.length ? bookingBehavior.leadTimeBuckets : mockLtBuckets;
    const losBuckets = bookingBehavior?.losBuckets?.length ? bookingBehavior.losBuckets : mockLosBuckets;
    const avgLeadTime = bookingBehavior?.avgLeadTime ?? 19;
    const avgLos = bookingBehavior?.avgLos ?? 1.9;
    const bookingDataLive = !!bookingBehavior?.totalBookings;

    return { avgDemand, avgWap, avgSupply, segWapP75, segWapP90, absMomentum, wapMomentum, trendDir, level, strongDays, pricingPowerDays, lowDemand, risingDemandFlatPrice, compressed, peak, trough, regime, dowAvg, zones, eventDays, leadTimeBuckets, losBuckets, avgLeadTime, avgLos, bookingDataLive };
  }, [days, bookingBehavior, pace30]);

  // Scatter data for divergence plot

  const scatterData = useMemo(() =>
    days.map((d) => ({ x: d.demand, y: d.segmentWap, label: d.shortLabel, i: d.i, divergence: d.divergence, demandDelta: d.demandDelta, wapDelta: d.wapDelta })),
  [days]);

  // Colour = LEVEL band; arrow = TREND direction (the two axes kept separate).
  const bannerCfg = (() => {
    const Icon = stats.trendDir === "up" ? TrendingUp : stats.trendDir === "down" ? TrendingDown : Minus;
    if (stats.level === "strong" || stats.level === "at peak strength")
      return { bg: "rgba(56,198,186,0.10)", border: "rgba(56,198,186,0.3)", icon: MP.accent, text: "#9fe0d8", Icon };
    if (stats.level === "soft" || stats.level === "weak")
      return { bg: "rgba(199,123,98,0.10)", border: "rgba(199,123,98,0.3)", icon: MP.terracotta, text: "#e3ad99", Icon };
    return { bg: "rgba(200,166,110,0.10)", border: "rgba(200,166,110,0.3)", icon: MP.gold, text: "#ddc7a1", Icon };
  })();

  // CONCEPT (Idea 5): near-term (actionable) vs horizon (early-booking) split.
  // A single 90-day average buries the fact that far-out months look soft only
  // because they haven't filled yet — split them so the headline stays honest.
  const split = useMemo(() => {
    const band = (v: number) => v >= 70 ? "peak" : v >= 58 ? "strong" : v >= 45 ? "steady" : v >= 30 ? "soft" : "weak";
    const lvl = (arr: any[]) => arr.length ? Math.round(arr.reduce((s, d) => s + d.demandV2, 0) / arr.length) : 0;
    const near = days.slice(0, 14), horizon = days.slice(14);
    const n = lvl(near), h = lvl(horizon);
    return { near: n, horizon: h, nearBand: band(n), horizonBand: band(h),
      nearStrong: near.filter((d) => d.demandV2 >= 60).length,
      horizonStrong: horizon.filter((d) => d.demandV2 >= 60).length };
  }, [days]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: MP.bg }}>
        <div style={{ textAlign: "center" }}>
          <Activity className="w-8 h-8 animate-spin" style={{ color: MP.accent, margin: "0 auto 12px" }} />
          <p style={{ color: MP.textSec, fontSize: "13px" }}>Loading market data…</p>
        </div>
      </div>
    );
  }

  if (dataSource === "none" || baseDays.length === 0) {
    const displayCity = cityName
      ? cityName.charAt(0).toUpperCase() + cityName.slice(1)
      : "this market";
    return (
      <div style={{ flex: 1, background: MP.bg, color: MP.text }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "16px", backgroundColor: "rgba(57,189,248,0.08)", border: "1px solid rgba(57,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
            <Activity size={36} color={MP.accent} strokeWidth={1.5} />
          </div>
          <h2 style={{ color: MP.text, fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
            Demand Radar not available for {displayCity}
          </h2>
          <p style={{ color: MP.textMuted, fontSize: "14px", maxWidth: "460px", lineHeight: "1.6", marginBottom: "32px" }}>
            Market intelligence requires active scrape coverage (Booking.com or Airbnb).
            {displayCity} does not have enough data yet.
          </p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: "40px", height: "40px", borderRadius: "8px", backgroundColor: "rgba(42,42,42,0.5)", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart3 size={18} color="#4a4a48" strokeWidth={1.5} />
              </div>
            ))}
          </div>
          <div style={{ backgroundColor: "rgba(57,189,248,0.05)", border: "1px solid rgba(57,189,248,0.15)", borderRadius: "8px", padding: "16px 24px", maxWidth: "400px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Layers size={16} color={MP.accent} />
              <span style={{ color: MP.text, fontSize: "13px", fontWeight: 600 }}>Currently active markets</span>
            </div>
            <p style={{ color: MP.textSec, fontSize: "12px", lineHeight: "1.5", margin: 0 }}>
              London and Las Vegas have full Demand Radar coverage. Select a property in one of these cities to view forward market intelligence.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, background: MP.bg, color: MP.text }}>
      <div style={{ padding: "28px 32px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Activity style={{ width: "24px", height: "24px", color: MP.accent }} />
          <h1 style={{ color: MP.text, fontSize: "24px", margin: 0, fontWeight: 600 }}>Demand Radar</h1>
          <span style={{ fontSize: "10px", color: "#7BAFD4", backgroundColor: "rgba(123,175,212,0.08)", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, letterSpacing: "0.05em" }}>v2 · timeline</span>
        </div>
        <p style={{ color: MP.textSec, margin: "0 0 20px", fontSize: "13px" }}>
          90-day forward market intelligence for {cityName || citySlug} • Live {citySlug === "archanes" ? "Airbnb" : "Booking.com"} data
        </p>

        {/* ── OUTLOOK BANNER ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px",
          borderRadius: "8px 8px 0 0", backgroundColor: bannerCfg.bg,
          borderBottom: `1px solid ${bannerCfg.border}`,
        }}>
          <div style={{ flexShrink: 0, width: "40px", height: "40px", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", border: `1px solid ${bannerCfg.border}` }}>
            <bannerCfg.Icon className="w-5 h-5" style={{ color: bannerCfg.icon }} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <h3 style={{ fontSize: "16px", fontWeight: 500, color: bannerCfg.text, margin: 0 }}>
              The next 90 days are looking {stats.regime}
            </h3>
            <p style={{ fontSize: "12px", color: MP.textSec, margin: "4px 0 0" }}>
              {stats.strongDays} of {days.length} days are strong (60+){stats.pricingPowerDays > 0 ? ` · ${stats.pricingPowerDays} with pricing power` : ""}
            </p>
          </div>
          {/* LEVEL — absolute strength (the headline metric) */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "28px", fontWeight: 600, color: absColor(stats.avgDemand), lineHeight: 1 }}>
              {stats.avgDemand}<span style={{ fontSize: "14px", color: MP.textSec }}>/100</span>
            </div>
            <div style={{ fontSize: "12px", color: MP.textSec, marginTop: "4px" }}>
              absolute demand level
            </div>
          </div>
          <div style={{ width: "1px", height: "40px", backgroundColor: MP.border, margin: "0 4px" }} />
          {/* TREND — pace vs 30 days ago (secondary; recomputed on absolute score) */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "28px", fontWeight: 600, color: stats.trendDir === "up" ? MP.paceUp : stats.trendDir === "down" ? MP.terracotta : MP.textSec, lineHeight: 1 }}>
              {stats.absMomentum > 0 ? "+" : ""}{stats.absMomentum} pts
            </div>
            <div style={{ fontSize: "12px", color: MP.textSec, marginTop: "4px" }}>
              trend vs 30 days ago
            </div>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", backgroundColor: MP.card, borderRadius: "0 0 8px 8px", border: `1px solid ${MP.border}`, borderTop: "none", marginBottom: "24px", overflow: "hidden" }}>
          {[
            { label: "Avg Demand", value: `${stats.avgDemand}/100`, color: absColor(stats.avgDemand) },
            { label: "Avg WAP", value: `${curr}${stats.avgWap}`, color: MP.text },
            { label: "Avg Supply", value: stats.avgSupply.toLocaleString(), color: MP.accent },
            { label: "Strong Days", value: `${stats.strongDays}`, sub: `of 90 scoring 60+`, color: MP.green },
            { label: "Peak Date", value: stats.peak?.label || "—", sub: `${stats.peak?.demandV2} · ${curr}${stats.peak?.segmentWap}`, color: MP.gold },
            { label: "Quietest Date", value: stats.trough?.label || "—", sub: `${stats.trough?.demandV2} · ${curr}${stats.trough?.segmentWap}`, color: MP.textSec },
          ].map((kpi, idx) => (
            <div key={kpi.label} style={{ padding: "14px 16px", textAlign: "center", borderRight: idx < 5 ? `1px solid ${MP.border}` : "none" }}>
              <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{kpi.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: "10px", color: MP.textMuted, marginTop: "2px" }}>{kpi.sub}</div>}
            </div>
          ))}
        </div>

        {/* ── NEAR-TERM vs HORIZON (Idea 5) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          {[
            { tag: "NEXT 14 DAYS", note: "actionable window", lvl: split.near, band: split.nearBand, strong: split.nearStrong, n: 14 },
            { tag: "HORIZON · DAYS 15–90", note: "still booking — reads soft because it hasn't filled", lvl: split.horizon, band: split.horizonBand, strong: split.horizonStrong, n: Math.max(0, days.length - 14) },
          ].map((s) => (
            <div key={s.tag} style={{ backgroundColor: MP.card, border: `1px solid ${MP.border}`, borderRadius: "8px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ fontSize: "30px", fontWeight: 700, color: absColor(s.lvl), lineHeight: 1 }}>{s.lvl}<span style={{ fontSize: "14px", color: MP.textSec, fontWeight: 600 }}>/100</span></div>
              <div>
                <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.tag}</div>
                <div style={{ fontSize: "15px", fontWeight: 600, color: absColor(s.lvl), textTransform: "capitalize" }}>{s.band}</div>
                <div style={{ fontSize: "11px", color: MP.textSec, marginTop: "1px" }}>{s.strong} strong days · {s.note}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── SIGNALS ── */}
        {(stats.risingDemandFlatPrice > 0 || stats.compressed > 0 || stats.lowDemand > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {stats.risingDemandFlatPrice > 0 && (
              <Signal icon={<Target className="w-4 h-4" />} color={MP.green}
                title={`${stats.risingDemandFlatPrice} dates — demand up, rates flat`}
                detail="Demand rose 5+pp in 7 days but WAP hasn't followed — revenue left on table" />
            )}
            {stats.compressed > 0 && (
              <Signal icon={<Zap className="w-4 h-4" />} color={MP.amber}
                title={`${stats.compressed} compression events`}
                detail="Supply dropping 2%+ while demand is above 55% — strong pricing power" />
            )}
            {stats.lowDemand > 0 && (
              <Signal icon={<AlertCircle className="w-4 h-4" />} color={MP.textMuted}
                title={`${stats.lowDemand} low demand days`}
                detail="Below 30% — consider promotions, visibility boosts, or flash deals" />
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CENTREPIECE — DEMAND TIMELINE
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: MP.card, borderRadius: "8px 8px 0 0", border: `1px solid ${MP.border}`, borderBottom: "none" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${MP.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>90-DAY FORWARD VIEW</div>
                <h3 style={{ color: MP.text, fontSize: "18px", fontWeight: 600, margin: 0 }}>Demand Timeline</h3>
                <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>
                  Demand, price, supply and pace on one shared 90-day axis — scrub across to read any date as a vertical slice
                </p>
              </div>
              <div style={{ display: "flex", gap: "14px", fontSize: "11px", alignItems: "center", flexWrap: "wrap" }}>
                <Leg color={MP.gold} label="Peak 80+" />
                <Leg color={MP.accent} label="Strong 60–79" />
                <Leg color={MP.steelTeal} label="Mod 35–59" />
                <Leg color={MP.steel} label="Weak <35" />
                <Leg color={MP.cream} label="Price" />
                <Leg color={MP.textSec} label="Supply" dotted />
                <span style={{ fontSize: "11px", color: MP.paceUp }}>▲ filling fast</span>
                <span style={{ fontSize: "11px", color: MP.terracotta }}>▼ cooling</span>
              </div>
            </div>
          </div>
          <div style={{ padding: "16px 20px 14px" }}>
            <MultiLaneTimeline days={days} curr={curr} scoreKey="demandV2" />
            {/* Plain-language guide to the pace lane */}
            <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: `1px solid ${MP.border}`, fontSize: "11px", color: MP.textSec, lineHeight: 1.5 }}>
              <span style={{ color: MP.text, fontWeight: 600 }}>Pace arrows (bottom lane):</span>{" "}
              <span style={{ color: MP.paceUp }}>▲</span> the date is <b style={{ color: MP.text }}>filling fast</b> — selling through quicker than a week ago, momentum building.{" "}
              <span style={{ color: MP.terracotta }}>▼</span> it's <b style={{ color: MP.text }}>cooling</b> — losing pace. Bar colour = how strong the date is today; arrow = which way it's moving this week. A tall bar with <span style={{ color: MP.paceUp }}>▲</span> is the best case — strong and still accelerating.
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CENTREPIECE — 7-DAY CHANGE (attached to the timeline above)
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: MP.card, borderRadius: "0 0 8px 8px", border: `1px solid ${MP.border}`, borderTop: "none", marginBottom: "24px" }}>
          <div style={{ padding: "12px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${MP.border}` }}>
            <div>
              <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>7-DAY PICKUP</div>
              <h3 style={{ color: MP.text, fontSize: "15px", fontWeight: 600, margin: 0 }}>Recent Pickup</h3>
              <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>How fast each date is filling vs 7 days ago — change in availability (price is in the timeline above)</p>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "11px", alignItems: "center" }}>
              <Leg color={MP.paceUp} label="Filling fast" />
              <Leg color={MP.terracotta} label="Cooling" />
            </div>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={days} margin={{ top: 6, right: 10, left: -15, bottom: 20 }} syncId="dr">
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={50} tickFormatter={(v) => `${v}%`} />
                  <ReferenceLine y={0} stroke={MP.border} strokeWidth={1} />
                  <Tooltip {...tipStyle} cursor={{ stroke: MP.accent, strokeOpacity: 0.15, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      const p = d.paceTighten || 0;
                      return (
                        <div style={{ ...tipStyle.contentStyle, padding: "10px 14px" }}>
                          <div style={{ ...tipStyle.labelStyle as any, fontWeight: 600 }}>{d.shortLabel}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: "12px" }}>
                            <span style={{ color: MP.textMuted }}>Pace</span>
                            <span style={{ color: p >= 3 ? MP.paceUp : p <= -3 ? MP.terracotta : MP.textMuted, textAlign: "right" }}>{p >= 3 ? `▲ filling fast ${p}%/wk` : p <= -3 ? `▼ cooling ${Math.abs(p)}%/wk` : "steady"}</span>
                            <span style={{ color: MP.textMuted }}>Demand</span>
                            <span style={{ color: absColor(d.demandV2), textAlign: "right" }}>{d.demandV2}/100</span>
                            <span style={{ color: MP.textMuted }}>WAP</span>
                            <span style={{ color: MP.text, textAlign: "right" }}>{curr}{d.segmentWap}</span>
                          </div>
                        </div>
                      );
                    }} />
                  <Bar dataKey="paceTighten" name="Pickup" radius={[3, 3, 0, 0]} maxBarSize={10}>
                    {days.map((d, i) => <Cell key={i} fill={d.paceTighten >= 0 ? MP.paceUp : MP.terracotta} fillOpacity={0.75} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            AI MARKET BRIEF (Lighthouse-style smart summaries)
            ══════════════════════════════════════════════════════════════════ */}
        <Card label="AI MARKET BRIEF" title="What's Happening & Why"
          subtitle="Auto-generated insights from demand, pricing, supply, and event data">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              {
                icon: <TrendingUp className="w-4 h-4" />,
                color: stats.level === "strong" || stats.level === "at peak strength" ? MP.accent : stats.level === "soft" || stats.level === "weak" ? MP.terracotta : MP.gold,
                title: `Next 90 days: ${stats.level}`,
                body: `Absolute demand averages ${stats.avgDemand}/100 with ${stats.strongDays} strong days. Trend is ${stats.absMomentum > 0 ? "+" : ""}${stats.absMomentum} pts vs 30 days ago (rates ${stats.wapMomentum > 0 ? "+" : ""}${curr}${stats.wapMomentum}). ${stats.trendDir === "up" ? "Firming — rates have room to follow." : stats.trendDir === "down" ? "Softening — defend occupancy on the weak days." : "Holding — keep current positioning."}`,
              },
              {
                icon: <CalendarDays className="w-4 h-4" />,
                color: topEvents.length > 0 ? MP.orange : MP.textMuted,
                title: topEvents.length > 0 ? `${topEvents.length} major events in the next 90 days` : "No major events detected",
                body: topEvents.length > 0
                  ? `${topEvents.slice(0, 3).map((e) => e.title.length > 30 ? e.title.slice(0, 28) + "…" : e.title).join(", ")}${topEvents.length > 3 ? ` and ${topEvents.length - 3} more` : ""}. These drive significant accommodation demand — check rate positioning on those dates.`
                  : "No events with local_rank 85+ detected for this market in the next 90 days.",
              },
              {
                icon: <Layers className="w-4 h-4" />,
                color: MP.purple,
                title: `${stats.compressed} supply compression events`,
                body: `Supply dropped 2%+ on ${stats.compressed} dates where demand exceeds 55%. Compression = fewer competitors = pricing power. ${stats.compressed > 5 ? "This is a strong signal — consider raising floors." : "Moderate compression — watch for acceleration."}`,
              },
            ].map((insight) => (
              <div key={insight.title} style={{
                padding: "14px 16px", borderRadius: "6px", backgroundColor: MP.bg,
                border: `1px solid ${MP.border}`, borderLeft: `3px solid ${insight.color}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ color: insight.color }}>{insight.icon}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: MP.text }}>{insight.title}</span>
                </div>
                <p style={{ fontSize: "11px", color: MP.textSec, margin: 0, lineHeight: 1.5 }}>{insight.body}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            BOOKING BEHAVIOR (Lead time + LOS)
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {/* Lead Time Distribution */}
          <Card label="BOOKING BEHAVIOR" title="Lead Time Distribution"
            subtitle={stats.bookingDataLive ? `From ${bookingBehavior.totalBookings} bookings (last 90 days)` : "How far in advance guests are booking — mock data"}>
            <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "120px", padding: "0 8px" }}>
              {stats.leadTimeBuckets.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: b.color, marginBottom: "4px" }}>{b.value}%</div>
                  <div style={{
                    width: "100%", maxWidth: "48px", borderRadius: "4px 4px 0 0",
                    backgroundColor: b.color, opacity: 0.6,
                    height: `${b.value * 3}px`,
                    transition: "height 0.3s",
                  }} />
                  <div style={{ fontSize: "10px", color: MP.textMuted, marginTop: "6px", textAlign: "center" }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", padding: "8px 0 0", borderTop: `1px solid ${MP.border}` }}>
              <span style={{ fontSize: "10px", color: MP.textMuted }}>
                <Clock className="w-3 h-3" style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                Avg lead time: <strong style={{ color: MP.text }}>{stats.avgLeadTime} days</strong>
              </span>
              <span style={{ fontSize: "10px", color: MP.textMuted }}>
                Last-minute (0–7d): <strong style={{ color: MP.red }}>{stats.leadTimeBuckets[0]?.value || 0}%</strong>
              </span>
            </div>
          </Card>

          {/* Length of Stay */}
          <Card label="BOOKING BEHAVIOR" title="Length of Stay"
            subtitle={stats.bookingDataLive ? "Guest stay patterns from real booking data" : "Guest stay patterns — mock data"}>
            <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "120px", padding: "0 8px" }}>
              {stats.losBuckets.map((b) => (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: b.color, marginBottom: "4px" }}>{b.value}%</div>
                  <div style={{
                    width: "100%", maxWidth: "56px", borderRadius: "4px 4px 0 0",
                    backgroundColor: b.color, opacity: 0.6,
                    height: `${b.value * 3}px`,
                    transition: "height 0.3s",
                  }} />
                  <div style={{ fontSize: "10px", color: MP.textMuted, marginTop: "6px", textAlign: "center" }}>{b.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", padding: "8px 0 0", borderTop: `1px solid ${MP.border}` }}>
              <span style={{ fontSize: "10px", color: MP.textMuted }}>
                Avg LOS: <strong style={{ color: MP.text }}>{stats.avgLos} nights</strong>
              </span>
              <span style={{ fontSize: "10px", color: MP.textMuted }}>
                3+ nights: <strong style={{ color: MP.purple }}>{(stats.losBuckets[2]?.value || 0) + (stats.losBuckets[3]?.value || 0)}%</strong>
              </span>
            </div>
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: BOOKING WINDOW ANALYSIS + DAY-OF-WEEK PATTERNS
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          {/* Booking Window Zones */}
          <Card label="BOOKING WINDOW" title="Demand by Lead Time"
            subtitle="How demand, pricing, and supply shift across the booking horizon">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {stats.zones.map((z) => (
                <div key={z.label} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "6px", backgroundColor: MP.bg, border: `1px solid ${MP.border}` }}>
                  <div style={{ width: "4px", height: "40px", borderRadius: "2px", backgroundColor: z.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: MP.text }}>{z.label}</span>
                      <span style={{ fontSize: "9px", color: z.color, backgroundColor: `${z.color}15`, padding: "1px 6px", borderRadius: "3px", fontWeight: 600, textTransform: "uppercase" }}>{z.tag}</span>
                    </div>
                    {/* Mini demand bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.05)" }}>
                        <div style={{ height: "100%", borderRadius: "3px", backgroundColor: demandColor(z.avgDemand), width: `${z.avgDemand}%`, transition: "width 0.3s" }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "60px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 600, color: demandColor(z.avgDemand) }}>{z.avgDemand}%</div>
                    <div style={{ fontSize: "9px", color: MP.textMuted }}>demand</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "55px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: MP.text }}>{curr}{z.avgWap}</div>
                    <div style={{ fontSize: "9px", color: MP.textMuted }}>WAP</div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "50px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: MP.purple }}>{z.avgSupply.toLocaleString()}</div>
                    <div style={{ fontSize: "9px", color: MP.textMuted }}>supply</div>
                  </div>
                  {z.highDays > 0 && (
                    <div style={{ fontSize: "10px", color: MP.orange, backgroundColor: "rgba(249,115,22,0.1)", padding: "2px 6px", borderRadius: "3px", whiteSpace: "nowrap" }}>
                      {z.highDays} hot
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Day of Week Patterns */}
          <Card label="WEEKLY RHYTHM" title="Day-of-Week Patterns"
            subtitle="Average demand and pricing by day of week across all 90 days">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.dowAvg} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="label" {...axisStyle} />
                  <YAxis yAxisId="demand" {...axisStyle} width={35} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="wap" orientation="right" {...axisStyle} width={45} tickFormatter={(v) => `${curr}${v}`} />
                  <Tooltip {...tipStyle}
                    formatter={(v: number, name: string) => name === "WAP" ? [`${curr}${v}`, name] : [`${v}%`, name]} />
                  <Bar yAxisId="demand" dataKey="demand" name="Demand" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.75}>
                    {stats.dowAvg.map((d, i) => <Cell key={i} fill={demandColor(d.demand)} />)}
                  </Bar>
                  <Line yAxisId="wap" type="monotone" dataKey="wap" name="WAP" stroke={MP.text} strokeWidth={2} dot={{ fill: MP.text, r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: PRICING OPPORTUNITY MAP
            ══════════════════════════════════════════════════════════════════ */}
        <Card label="PRICING OPPORTUNITY MAP" title="Where is the market mispriced?"
          subtitle="Each dot is a check-in date over the next 90 days, plotted by how busy the market is (→) vs how expensive it is (↑)."
          legend={<><Leg color={MP.green} label="Under-priced (push rates up)" /> <Leg color={MP.red} label="Over-priced (risk of low pickup)" /> <Leg color={MP.accent} label="Fairly priced" /></>}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 12, left: 55, zIndex: 5, pointerEvents: "none" }}>
              <div style={{ fontSize: "10px", color: MP.red, opacity: 0.7, fontWeight: 600, letterSpacing: "0.03em" }}>OVERPRICED</div>
              <div style={{ fontSize: "9px", color: MP.textMuted, maxWidth: 120, lineHeight: 1.3, marginTop: 2 }}>High prices but low demand — rooms may sit empty</div>
            </div>
            <div style={{ position: "absolute", top: 12, right: 25, zIndex: 5, pointerEvents: "none", textAlign: "right" }}>
              <div style={{ fontSize: "10px", color: MP.amber, opacity: 0.7, fontWeight: 600, letterSpacing: "0.03em" }}>PEAK DATES</div>
              <div style={{ fontSize: "9px", color: MP.textMuted, maxWidth: 120, lineHeight: 1.3, marginTop: 2 }}>High demand, high prices — market is yielding correctly</div>
            </div>
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid {...gridStroke} />
                  <XAxis type="number" dataKey="x" name="Demand" domain={[0, 100]}
                    {...axisStyle} tickFormatter={(v) => `${v}%`}
                    label={{ value: "← Quiet market                    Busy market →", position: "insideBottom", offset: -14, style: { fill: MP.textMuted, fontSize: 10 } }} />
                  <YAxis type="number" dataKey="y" name="WAP"
                    {...axisStyle} width={55} tickFormatter={(v) => `${curr}${v}`} />
                  <ZAxis type="number" dataKey="divergence" range={[40, 180]} />
                  <Tooltip {...tipStyle} cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const zone = d.x > 60 && d.y < stats.avgWap ? "opportunity" : d.x < 40 && d.y > stats.avgWap ? "risk" : d.x > 60 && d.y >= stats.avgWap ? "peak" : "quiet";
                      const zoneLabel = { opportunity: "Under-priced — push rates", risk: "Over-priced — watch pickup", peak: "Peak pricing — hold", quiet: "Off-peak — expected" } as const;
                      const zoneColor = { opportunity: MP.green, risk: MP.red, peak: MP.amber, quiet: MP.textMuted } as const;
                      return (
                        <div style={{ ...tipStyle.contentStyle, padding: "10px 14px" }}>
                          <div style={{ ...tipStyle.labelStyle as any, fontWeight: 600 }}>{d.label}</div>
                          <div style={{ fontSize: "12px", color: MP.text }}>Market demand: {d.x}%</div>
                          <div style={{ fontSize: "12px", color: MP.text }}>Avg nightly rate: {curr}{d.y}</div>
                          <div style={{ fontSize: "11px", color: zoneColor[zone], marginTop: "6px", fontWeight: 500 }}>{zoneLabel[zone]}</div>
                        </div>
                      );
                    }} />
                  <ReferenceLine x={50} stroke={MP.border} strokeDasharray="4 4" />
                  <ReferenceLine y={stats.avgWap} stroke={MP.border} strokeDasharray="4 4" />
                  <Scatter data={scatterData} fillOpacity={0.75}>
                    {scatterData.map((d, i) => (
                      <Cell key={i} fill={d.x > 60 && d.y < stats.avgWap ? MP.green : d.x < 40 && d.y > stats.avgWap ? MP.red : d.x > 60 && d.y >= stats.avgWap ? MP.amber : `${MP.accent}66`} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "0 55px 0 55px" }}>
              <div style={{ fontSize: "10px", color: MP.textMuted, opacity: 0.7 }}>
                <span style={{ fontWeight: 600 }}>QUIET DATES</span> — low demand, low prices
              </div>
              <div style={{ fontSize: "10px", color: MP.green, opacity: 0.7, textAlign: "right" }}>
                <span style={{ fontWeight: 600 }}>OPPORTUNITY</span> — high demand, prices haven't caught up
              </div>
            </div>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: SUPPLY DYNAMICS
            ══════════════════════════════════════════════════════════════════ */}
        <Card label="SUPPLY DYNAMICS" title="Available Properties"
          subtitle="Total Booking.com listings per check-in date — drops signal compression, spikes signal oversupply">
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={days} margin={{ top: 10, right: 10, left: -15, bottom: 20 }} syncId="dr">
                <defs>
                  <linearGradient id="dr-supply" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={MP.purple} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={MP.purple} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStroke} vertical={false} />
                <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                <YAxis {...axisStyle} width={45} />
                <Tooltip {...tipStyle} cursor={{ stroke: MP.border }}
                  labelFormatter={(_l, p) => p?.[0]?.payload?.shortLabel || _l}
                  formatter={(v: number) => [v.toLocaleString(), "Properties"]} />
                <Area type="monotone" dataKey="supply" name="Supply" stroke={MP.purple} fill="url(#dr-supply)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 7: DATE-BY-DATE SCANNER (collapsed by default)
            ══════════════════════════════════════════════════════════════════ */}
        <DateScanner days={days} curr={curr} />

        <div style={{ textAlign: "center", color: MP.textMuted, fontSize: "12px", paddingBottom: "16px" }}>
          Live data for {cityName || citySlug} • Scraped daily from Booking.com • Events from PredictHQ
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function DateScanner({ days, curr }: { days: any[]; curr: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card label="DATE-BY-DATE" title="Full Date Scanner"
      subtitle="Every date in the 90-day window with demand, price, supply, and pace at a glance"
      legend={
        <button onClick={() => setExpanded(!expanded)} style={{
          display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, cursor: "pointer",
          border: `1px solid ${MP.border}`, backgroundColor: expanded ? "rgba(123,175,212,0.08)" : "transparent", color: expanded ? "#7BAFD4" : MP.textMuted,
        }}>
          <BarChart3 className="w-3 h-3" />
          {expanded ? "Collapse" : "Expand"}
          <ChevronRight className="w-3 h-3" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </button>
      }>
      {expanded && (
        <div style={{ maxHeight: "520px", overflowY: "auto", marginRight: "-8px", paddingRight: "8px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${MP.border}`, position: "sticky", top: 0, backgroundColor: MP.card, zIndex: 1 }}>
            <div style={{ width: "100px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase" }}>Date</div>
            <div style={{ flex: 1, fontSize: "10px", color: MP.textMuted, textTransform: "uppercase" }}>Demand</div>
            <div style={{ width: "50px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>%</div>
            <div style={{ width: "20px" }} />
            <div style={{ flex: 1, fontSize: "10px", color: MP.textMuted, textTransform: "uppercase" }}>WAP</div>
            <div style={{ width: "55px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>Rate</div>
            <div style={{ width: "20px" }} />
            <div style={{ width: "60px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>Supply</div>
            <div style={{ width: "70px", fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", textAlign: "right" }}>7d Pace</div>
          </div>
          {days.map((d) => {
            const wapPct = Math.min(100, Math.max(0, ((d.segmentWap - 60) / (250 - 60)) * 100));
            const isWeekend = d.dow === 0 || d.dow === 5 || d.dow === 6;
            return (
              <div key={d.i} style={{
                display: "flex", alignItems: "center", padding: "5px 0",
                borderBottom: `1px solid ${MP.border}`,
                backgroundColor: isWeekend ? "rgba(57,189,248,0.02)" : "transparent",
              }}>
                <div style={{ width: "100px", fontSize: "12px", color: isWeekend ? MP.text : MP.textSec, fontWeight: isWeekend ? 600 : 400 }}>
                  {d.shortLabel}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <div style={{ height: "14px", borderRadius: "3px", backgroundColor: demandColor(d.demand), opacity: 0.7, width: `${d.demand}%`, minWidth: "4px", transition: "width 0.2s" }} />
                </div>
                <div style={{ width: "50px", fontSize: "12px", fontWeight: 600, color: demandColor(d.demand), textAlign: "right" }}>{d.demand}%</div>
                <div style={{ width: "20px" }} />
                <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                  <div style={{ height: "14px", borderRadius: "3px", backgroundColor: MP.text, opacity: 0.15, width: `${wapPct}%`, minWidth: "4px" }} />
                </div>
                <div style={{ width: "55px", fontSize: "12px", color: MP.text, textAlign: "right" }}>{curr}{d.segmentWap}</div>
                <div style={{ width: "20px" }} />
                <div style={{ width: "60px", fontSize: "11px", color: MP.textMuted, textAlign: "right" }}>{d.supply.toLocaleString()}</div>
                <div style={{ width: "70px", fontSize: "11px", textAlign: "right", color: d.demandDelta > 3 ? MP.green : d.demandDelta < -3 ? MP.red : MP.textMuted }}>
                  {d.demandDelta > 0 ? "+" : ""}{d.demandDelta}pp
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!expanded && (
        <div style={{ textAlign: "center", padding: "20px 0", color: MP.textMuted, fontSize: "12px" }}>
          90 dates available — click Expand to browse
        </div>
      )}
    </Card>
  );
}

function Card({ label, title, subtitle, legend, children }: { label: string; title: string; subtitle: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: MP.card, borderRadius: "8px", border: `1px solid ${MP.border}`, marginBottom: "16px" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${MP.border}` }}>
        <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <h3 style={{ color: MP.text, fontSize: "16px", fontWeight: 600, margin: 0 }}>{title}</h3>
            <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>{subtitle}</p>
          </div>
          {legend && <div style={{ display: "flex", gap: "16px", fontSize: "11px", alignItems: "center" }}>{legend}</div>}
        </div>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function EventLabels({ days, curr }: { days: any[]; curr: string }) {
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const hoverDay = hover ? days[hover.idx] : null;
  const hoverEv = hoverDay?.event;

  const catLabel = (c: string) => {
    const map: Record<string, string> = { sports: "Sports", concerts: "Concert", festivals: "Festival", conferences: "Conference", expos: "Expo", "performing-arts": "Performing Arts" };
    return map[c] || c;
  };

  const spans = useMemo(() => {
    const result: { name: string; startIdx: number; endIdx: number; localRank: number }[] = [];
    const seen = new Set<string>();
    const totalDays = days.length;
    for (const d of days) {
      if (!d.event || seen.has(d.event.name)) continue;
      seen.add(d.event.name);
      const first = days.findIndex((x) => x.event?.name === d.event.name);
      let last = first;
      for (let j = first + 1; j < totalDays; j++) {
        if (days[j].event?.name === d.event.name) last = j;
        else if (j - last > 2) break;
      }
      if (last > first) {
        result.push({ name: d.event.name, startIdx: first, endIdx: last, localRank: d.event.localRank });
      }
    }
    return result;
  }, [days]);

  const totalDays = days.length;

  return (
    <div style={{ position: "relative", height: "160px", marginLeft: "20px", marginRight: "10px", borderBottom: `1px solid ${MP.border}`, overflow: "hidden" }}>
      {/* Rotated labels */}
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {days.map((d) => {
          if (!d.event) return <div key={d.i} style={{ flex: 1 }} />;
          const prev = days[d.i - 1];
          if (prev?.event?.name === d.event.name) return <div key={d.i} style={{ flex: 1 }} />;
          return (
            <div key={d.i} style={{ flex: 1, position: "relative", overflow: "visible" }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setHover({ idx: d.i, x: rect.left, y: rect.bottom });
              }}
              onMouseLeave={() => setHover(null)}
            >
              <div style={{
                position: "absolute", bottom: "14px", left: "0px",
                transform: "rotate(-45deg)", transformOrigin: "bottom left",
                whiteSpace: "nowrap", fontSize: "11px", fontWeight: 500, cursor: "default",
                color: "#7BAFD4", opacity: hover?.idx === d.i ? 1 : (d.event.localRank >= 95 ? 0.8 : 0.5),
                transition: "opacity 0.15s",
              }}>
                {d.event.name.length > 28 ? d.event.name.slice(0, 26) + "…" : d.event.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Duration span bars */}
      {spans.map((span) => {
        const leftPct = (span.startIdx / totalDays) * 100;
        const widthPct = ((span.endIdx - span.startIdx + 1) / totalDays) * 100;
        return (
          <div key={span.name} style={{
            position: "absolute", bottom: "0px",
            left: `${leftPct}%`, width: `${widthPct}%`,
            height: "4px", backgroundColor: "#7BAFD4",
            opacity: span.localRank >= 95 ? 0.4 : 0.2, borderRadius: "2px",
          }} />
        );
      })}

      {/* Hover tooltip */}
      {hoverEv && hover && (
        <div style={{
          position: "fixed", left: Math.min(hover.x, window.innerWidth - 280), top: hover.y + 8,
          zIndex: 50, width: "260px",
          backgroundColor: "rgba(26,26,26,0.97)", border: `1px solid ${MP.border}`,
          borderRadius: "8px", padding: "14px 16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", pointerEvents: "none",
        }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: MP.text, marginBottom: "8px", lineHeight: 1.3 }}>{hoverEv.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontSize: "11px" }}>
            <span style={{ color: MP.textMuted }}>Date</span>
            <span style={{ color: MP.text }}>{hoverDay.shortLabel}</span>
            <span style={{ color: MP.textMuted }}>Category</span>
            <span style={{ color: MP.text }}>{catLabel(hoverEv.category)}</span>
            <span style={{ color: MP.textMuted }}>Attendance</span>
            <span style={{ color: "#7BAFD4", fontWeight: 600 }}>{hoverEv.attendance ? hoverEv.attendance.toLocaleString() : "—"}</span>
            <span style={{ color: MP.textMuted }}>Accom. spend</span>
            <span style={{ color: MP.green, fontWeight: 600 }}>{hoverEv.accommodationSpend ? `${curr}${Math.round(hoverEv.accommodationSpend / 1000).toLocaleString()}k` : "—"}</span>
            <span style={{ color: MP.textMuted }}>Local rank</span>
            <span style={{ color: MP.text }}>{hoverEv.localRank}/100</span>
            <span style={{ color: MP.textMuted }}>Impact tier</span>
            <span style={{ color: hoverEv.localRank >= 95 ? MP.red : MP.amber, fontWeight: 500 }}>{hoverEv.tier}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Signal({ icon, color, title, detail }: { icon: React.ReactNode; color: string; title: string; detail: string }) {
  return (
    <div style={{ backgroundColor: MP.card, borderRadius: "8px", border: `1px solid ${MP.border}`, padding: "14px 16px", borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: MP.text }}>{title}</span>
      </div>
      <p style={{ fontSize: "11px", color: MP.textSec, margin: 0, lineHeight: 1.4 }}>{detail}</p>
    </div>
  );
}

// ── CONCEPT A: synced multi-lane timeline ──
// Demand / price / supply / pace on one shared 90-day x-axis. Left gutter holds
// lane labels + axis ticks so gridlines and data lines never cross them.
function MultiLaneTimeline({ days, curr, scoreKey = "absScore" }: { days: any[]; curr: string; scoreKey?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!days.length) return null;
  const N = days.length, W = 1200, H = 348;
  const PAD_L = 48, PAD_R = 30;
  const plotW = W - PAD_L - PAD_R, colW = plotW / N;
  const xAt = (i: number) => PAD_L + i * colW + colW / 2;
  // lane bands [top, bottom]
  const DEM: [number, number] = [14, 130], PRI: [number, number] = [158, 224], SUP: [number, number] = [248, 306];
  const PACE_Y = 328, MONTH_Y = 344;
  const segWaps = days.map((d) => d.segmentWap), sup = days.map((d) => d.supply);
  const wMin = Math.min(...segWaps), wMax = Math.max(...segWaps);
  const sMin = Math.min(...sup), sMax = Math.max(...sup);
  const py = (v: number) => PRI[1] - ((v - wMin) / (wMax - wMin || 1)) * (PRI[1] - PRI[0]);
  const sy = (v: number) => SUP[1] - ((v - sMin) / (sMax - sMin || 1)) * (SUP[1] - SUP[0]);
  const mid = (b: [number, number]) => (b[0] + b[1]) / 2;

  const monthMarks: { i: number; label: string }[] = [];
  let lastM = "";
  days.forEach((d, i) => { const m = d.dateStr.slice(0, 7); if (m !== lastM) { lastM = m; monthMarks.push({ i, label: d.monthLabel }); } });

  const onMove = (e: any) => {
    const r = e.currentTarget.getBoundingClientRect();
    const idx = Math.max(0, Math.min(N - 1, Math.floor((((e.clientX - r.left) / r.width) * W - PAD_L) / colW)));
    setHover(Math.max(0, Math.min(N - 1, idx)));
  };
  const hd = hover != null ? days[hover] : null;
  const last = days[N - 1];
  const gutTick = (x: number, y: number, t: string) => <text x={x} y={y} fill={MP.textMuted} fontSize={8} textAnchor="end">{t}</text>;
  const laneName = (t: string, b: [number, number]) => <text x={6} y={mid(b) + 3} fill={MP.textSec} fontSize={9} fontWeight={600}>{t}</text>;
  const thresholdY = DEM[1] - (60 / 100) * (DEM[1] - DEM[0]);
  const peakY = DEM[1] - (80 / 100) * (DEM[1] - DEM[0]);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="v2price" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MP.cream} stopOpacity={0.14} />
            <stop offset="100%" stopColor={MP.cream} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* month gridlines (behind data, only across the plot area) */}
        {monthMarks.map((mm) => (
          <g key={mm.i}>
            <line x1={xAt(mm.i) - colW / 2} y1={DEM[0]} x2={xAt(mm.i) - colW / 2} y2={SUP[1]} stroke={MP.border} strokeWidth={1} strokeOpacity={0.6} />
            <text x={xAt(mm.i) - colW / 2 + 3} y={MONTH_Y} fill={MP.textMuted} fontSize={9}>{mm.label}</text>
          </g>
        ))}

        {/* lane baselines */}
        {[DEM, PRI, SUP].map((L, k) => (<line key={k} x1={PAD_L} y1={L[1]} x2={W - PAD_R} y2={L[1]} stroke={MP.border} strokeWidth={1} />))}

        {/* DEMAND: 60 threshold guide + bars */}
        <line x1={PAD_L} y1={thresholdY} x2={W - PAD_R} y2={thresholdY} stroke={MP.accent} strokeOpacity={0.3} strokeWidth={1} strokeDasharray="3 3" />
        <line x1={PAD_L} y1={peakY} x2={W - PAD_R} y2={peakY} stroke={MP.gold} strokeOpacity={0.5} strokeWidth={1} strokeDasharray="3 3" />
        {days.map((d, i) => {
          const h = (d[scoreKey] / 100) * (DEM[1] - DEM[0]);
          return <rect key={i} x={PAD_L + i * colW + colW * 0.12} y={DEM[1] - h} width={Math.max(0.6, colW * 0.76)} height={h} fill={absColor(d[scoreKey])} fillOpacity={0.9} rx={1} />;
        })}

        {/* PRICE: soft area + line + end value */}
        <polygon points={`${PAD_L},${PRI[1]} ${days.map((d, i) => `${xAt(i)},${py(d.segmentWap)}`).join(" ")} ${xAt(N - 1)},${PRI[1]}`} fill="url(#v2price)" />
        <polyline points={days.map((d, i) => `${xAt(i)},${py(d.segmentWap)}`).join(" ")} fill="none" stroke={MP.cream} strokeWidth={1.75} />

        {/* SUPPLY: line + end value */}
        <polyline points={days.map((d, i) => `${xAt(i)},${sy(d.supply)}`).join(" ")} fill="none" stroke={MP.textSec} strokeWidth={1.5} strokeDasharray="3 2" />

        {/* PACE lane (own row only) */}
        {days.map((d, i) => Math.abs(d.paceTighten) >= 3 ? (
          <text key={"pl" + i} x={xAt(i)} y={PACE_Y + 3} fill={d.paceTighten > 0 ? MP.paceUp : MP.terracotta} fontSize={8} textAnchor="middle">{d.paceTighten > 0 ? "▲" : "▼"}</text>
        ) : null)}

        {/* left gutter: lane names + axis ticks (drawn last so nothing overlaps) */}
        <rect x={0} y={0} width={PAD_L - 2} height={H} fill={MP.card} />
        {laneName("DEMAND", DEM)}{laneName("PRICE", PRI)}{laneName("SUPPLY", SUP)}
        <text x={6} y={PACE_Y + 3} fill={MP.textSec} fontSize={9} fontWeight={600}>PACE</text>
        {gutTick(PAD_L - 5, DEM[0] + 6, "100")}{gutTick(PAD_L - 5, peakY + 3, "80")}{gutTick(PAD_L - 5, thresholdY + 3, "60")}{gutTick(PAD_L - 5, DEM[1], "0")}
        {gutTick(PAD_L - 5, PRI[0] + 6, `${curr}${wMax}`)}{gutTick(PAD_L - 5, PRI[1], `${curr}${wMin}`)}
        {gutTick(PAD_L - 5, SUP[0] + 6, (sMax / 1000).toFixed(1) + "k")}{gutTick(PAD_L - 5, SUP[1], (sMin / 1000).toFixed(1) + "k")}

        {/* right end values */}
        <text x={W - PAD_R + 4} y={py(last.segmentWap) + 3} fill={MP.cream} fontSize={9} fontWeight={600}>{curr}{last.segmentWap}</text>
        <text x={W - PAD_R + 4} y={sy(last.supply) + 3} fill={MP.textSec} fontSize={9}>{(last.supply / 1000).toFixed(1)}k</text>

        {/* hover guide */}
        {hd && (
          <g>
            <line x1={xAt(hd.i)} y1={DEM[0]} x2={xAt(hd.i)} y2={SUP[1]} stroke={MP.text} strokeOpacity={0.25} strokeWidth={1} />
            <circle cx={xAt(hd.i)} cy={py(hd.segmentWap)} r={2.5} fill={MP.cream} />
            <circle cx={xAt(hd.i)} cy={sy(hd.supply)} r={2.5} fill={MP.textSec} />
          </g>
        )}
      </svg>
      {hd && (
        <div style={{ position: "absolute", top: 0, left: `min(calc(${(hd.i / N) * 100}% + 12px), calc(100% - 210px))`, background: "rgba(18,21,25,0.97)", border: `1px solid ${MP.border}`, borderRadius: "8px", padding: "9px 12px", fontSize: "12px", minWidth: "198px", pointerEvents: "none" }}>
          <div style={{ fontWeight: 600, color: MP.text, marginBottom: "5px" }}>{hd.shortLabel}</div>
          {([["Demand", `${hd[scoreKey]}/100`, absColor(hd[scoreKey])], ["WAP", `${curr}${hd.segmentWap}`, MP.text], ["Supply", hd.supply.toLocaleString(), MP.text], ["Pace (7d)", hd.paceTighten >= 3 ? `▲ filling fast (${hd.paceTighten}%/wk)` : hd.paceTighten <= -3 ? `▼ cooling (${Math.abs(hd.paceTighten)}%/wk)` : "steady", hd.paceTighten >= 3 ? MP.paceUp : hd.paceTighten <= -3 ? MP.terracotta : MP.textSec]] as [string, string, string][]).map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "16px", margin: "2px 0", color: MP.textSec }}>
              <span>{k}</span><span style={{ color: c, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Leg({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
      <span style={{ width: "16px", height: "2px", borderRadius: "1px", backgroundColor: dashed || dotted ? "transparent" : color, borderBottom: dashed ? `2px dashed ${color}` : dotted ? `2px dotted ${color}` : "none", opacity: dashed ? 0.4 : dotted ? 0.5 : 1 }} />
      <span style={{ color: MP.textMuted, fontSize: "11px" }}>{label}</span>
    </span>
  );
}
