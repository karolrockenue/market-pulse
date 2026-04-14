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
  ReferenceLine,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

// ── Market Pulse Design System ──
const MP = {
  bg: "#1d1d1c",
  card: "#1A1A1A",
  border: "#2a2a2a",
  input: "#2C2C2C",
  accent: "#39BDF8",
  text: "#e5e5e5",
  textSec: "#9ca3af",
  textMuted: "#6b7280",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  orange: "#f97316",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
};

const gridStroke = { strokeDasharray: "0", stroke: MP.border, opacity: 0.5 };
const axisStyle = { stroke: MP.border, tick: { fill: MP.textMuted, fontSize: 10 }, tickLine: { stroke: MP.border }, axisLine: { stroke: MP.border } };
const tipStyle = {
  contentStyle: { backgroundColor: "rgba(26,26,26,0.95)", border: `1px solid ${MP.border}`, borderRadius: "6px", padding: "10px 14px" },
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
      divergence: Math.max(0, (demand - 50) * 0.8 - Math.max(0, wapDelta)),
      event: null as any,
    };
  });

  // Add 7d moving averages
  return days.map((day, i, arr) => {
    const win = arr.slice(Math.max(0, i - 6), i + 1);
    const demandMa = Math.round(win.reduce((s, d) => s + d.demand, 0) / win.length);
    const wapMa = Math.round(win.reduce((s, d) => s + d.wap, 0) / win.length);
    const segmentWapMa = Math.round(win.reduce((s, d) => s + d.segmentWap, 0) / win.length);
    return { ...day, demandMa, wapMa, segmentWapMa };
  });
}

// ── Demand color scale ──
const demandColor = (d: number) =>
  d >= 85 ? MP.red : d >= 70 ? MP.orange : d >= 50 ? MP.amber : d >= 30 ? MP.accent : "#3b82f6";

// ── Booking window zone labels ──
const ZONES = [
  { label: "0–14 days", range: [0, 14], color: MP.red, tag: "Urgent" },
  { label: "15–30 days", range: [15, 30], color: MP.orange, tag: "Tactical" },
  { label: "31–60 days", range: [31, 60], color: MP.amber, tag: "Strategic" },
  { label: "61–90 days", range: [61, 90], color: MP.accent, tag: "Horizon" },
] as const;

interface DemandRadarProps { allHotels: any[]; selectedProperty?: any }

export function DemandRadarView({ allHotels, selectedProperty }: DemandRadarProps) {
  const cityName = selectedProperty?.city || "";
  const citySlug = useMemo(() => {
    return cityName ? cityName.toLowerCase().replace(/\s+/g, "-") : "";
  }, [cityName]);

  // Collect integer hotel IDs for portfolio-level queries
  // Admin endpoint returns hotel_id AS property_id
  const hotelIds = useMemo(() => {
    return allHotels
      ?.map((h: any) => parseInt(h.property_id || h.hotel_id))
      .filter((id: number) => !isNaN(id) && id > 0) || [];
  }, [allHotels]);
  const hotelIdsParam = hotelIds.join(",");

  const curr = "\u00A3";

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
    const avgDemand = avg("demand");
    const avgWap = avg("segmentWap");
    const avgSupply = avg("supply");

    // WAP percentiles for spike colouring (using segment WAP)
    const sortedSegWaps = [...days].map((d) => d.segmentWap).sort((a, b) => a - b);
    const pct = (p: number) => sortedSegWaps[Math.floor(sortedSegWaps.length * p)] || 0;
    const segWapP75 = pct(0.75);
    const segWapP90 = pct(0.90);

    // 30-day momentum: avg delta across all forward dates (now vs 30 days ago)
    let demandMomentum = 0;
    let wapMomentum = 0;
    if (pace30.length > 0) {
      const validD = pace30.filter((p: any) => p.market_demand_score_delta != null);
      const validW = pace30.filter((p: any) => p.wap_delta != null);
      demandMomentum = validD.length > 0 ? Math.round(validD.reduce((s: number, p: any) => s + p.market_demand_score_delta, 0) / validD.length) : 0;
      wapMomentum = validW.length > 0 ? Math.round(validW.reduce((s: number, p: any) => s + p.wap_delta, 0) / validW.length) : 0;
    }

    const highDemand = days.filter((d) => d.demand >= 70).length;
    const lowDemand = days.filter((d) => d.demand < 30).length;

    const risingDemandFlatPrice = days.filter((d) => d.demandDelta > 5 && d.wapDelta < 2).length;
    const compressed = days.filter((d) => d.supplyPctDelta < -2 && d.demand > 55).length;

    const sorted = [...days].sort((a, b) => b.demand - a.demand);
    const peak = sorted[0];
    const trough = sorted[sorted.length - 1];

    const regime = demandMomentum > 3 ? "strengthening" : demandMomentum < -3 ? "softening" : "stable";

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

    return { avgDemand, avgWap, avgSupply, segWapP75, segWapP90, demandMomentum, wapMomentum, highDemand, lowDemand, risingDemandFlatPrice, compressed, peak, trough, regime, dowAvg, zones, eventDays, leadTimeBuckets, losBuckets, avgLeadTime, avgLos, bookingDataLive };
  }, [days, bookingBehavior, pace30]);

  // Scatter data for divergence plot

  const scatterData = useMemo(() =>
    days.map((d) => ({ x: d.demand, y: d.segmentWap, label: d.shortLabel, i: d.i, divergence: d.divergence, demandDelta: d.demandDelta, wapDelta: d.wapDelta })),
  [days]);

  const bannerCfg = stats.regime === "strengthening"
    ? { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)", icon: MP.green, text: "#86efac", Icon: TrendingUp }
    : stats.regime === "softening"
    ? { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", icon: MP.red, text: "#fca5a5", Icon: TrendingDown }
    : { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.3)", icon: MP.amber, text: "#fde047", Icon: Minus };

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
      <div className="min-h-screen" style={{ backgroundColor: MP.bg, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "16px", backgroundColor: "rgba(57,189,248,0.08)", border: "1px solid rgba(57,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
            <Activity size={36} color={MP.accent} strokeWidth={1.5} />
          </div>
          <h2 style={{ color: MP.text, fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
            Demand Radar not available for {displayCity}
          </h2>
          <p style={{ color: MP.textMuted, fontSize: "14px", maxWidth: "460px", lineHeight: "1.6", marginBottom: "32px" }}>
            Market intelligence requires a minimum of 5 properties in a city and active Booking.com
            scrape coverage. {displayCity} does not have enough data yet.
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
    <div className="min-h-screen" style={{ backgroundColor: MP.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "24px", maxWidth: "1600px", margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Activity style={{ width: "24px", height: "24px", color: MP.accent }} />
          <h1 style={{ color: MP.text, fontSize: "24px", margin: 0, fontWeight: 600 }}>Demand Radar</h1>
          <span style={{ fontSize: "10px", color: MP.accent, backgroundColor: "rgba(57,189,248,0.1)", padding: "2px 8px", borderRadius: "4px", fontWeight: 600, letterSpacing: "0.05em" }}>v2</span>
        </div>
        <p style={{ color: MP.textSec, margin: "0 0 20px", fontSize: "13px" }}>
          90-day forward market intelligence for {cityName || citySlug} • Live Booking.com data
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
              The 90-day market demand is {stats.regime}
            </h3>
            <p style={{ fontSize: "12px", color: MP.textSec, margin: "4px 0 0" }}>
              Based on {days.length} days of forward availability, pricing, and supply data
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "28px", fontWeight: 600, color: bannerCfg.text, lineHeight: 1 }}>
              {stats.demandMomentum > 0 ? "+" : ""}{stats.demandMomentum}pp
            </div>
            <div style={{ fontSize: "12px", color: MP.textSec, marginTop: "4px" }}>
              demand vs 30 days ago
            </div>
          </div>
          <div style={{ width: "1px", height: "40px", backgroundColor: MP.border, margin: "0 4px" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "28px", fontWeight: 600, color: stats.wapMomentum > 0 ? MP.green : stats.wapMomentum < 0 ? MP.red : MP.textSec, lineHeight: 1 }}>
              {stats.wapMomentum > 0 ? "+" : ""}{curr}{stats.wapMomentum}
            </div>
            <div style={{ fontSize: "12px", color: MP.textSec, marginTop: "4px" }}>
              avg rate vs 30 days ago
            </div>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", backgroundColor: MP.card, borderRadius: "0 0 8px 8px", border: `1px solid ${MP.border}`, borderTop: "none", marginBottom: "24px", overflow: "hidden" }}>
          {[
            { label: "Avg Demand", value: `${stats.avgDemand}%`, color: demandColor(stats.avgDemand) },
            { label: "Avg WAP", value: `${curr}${stats.avgWap}`, color: MP.text },
            { label: "Avg Supply", value: stats.avgSupply.toLocaleString(), color: MP.accent },
            { label: "High Demand Days", value: `${stats.highDemand}`, sub: `of 90 above 70%`, color: MP.orange },
            { label: "Peak Date", value: stats.peak?.label || "—", sub: `${stats.peak?.demand}% · ${curr}${stats.peak?.segmentWap}`, color: MP.red },
            { label: "Quietest Date", value: stats.trough?.label || "—", sub: `${stats.trough?.demand}% · ${curr}${stats.trough?.segmentWap}`, color: MP.green },
          ].map((kpi, idx) => (
            <div key={kpi.label} style={{ padding: "14px 16px", textAlign: "center", borderRight: idx < 5 ? `1px solid ${MP.border}` : "none" }}>
              <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{kpi.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
              {kpi.sub && <div style={{ fontSize: "10px", color: MP.textMuted, marginTop: "2px" }}>{kpi.sub}</div>}
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
            CENTREPIECE — DEMAND (Busy vs Quiet)
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: MP.card, borderRadius: "8px 8px 0 0", border: `1px solid ${MP.border}`, borderBottom: "none" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${MP.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>90-DAY FORWARD VIEW</div>
                <h3 style={{ color: MP.text, fontSize: "18px", fontWeight: 600, margin: 0 }}>How Busy Is the Market?</h3>
                <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>Market demand score from Booking.com — higher means busier, fewer rooms available, stronger pricing power</p>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "11px", alignItems: "center" }}>
                <Leg color={MP.accent} label="Demand" />
                <Leg color={MP.accent} label="7d trend" dashed />
                <div style={{ width: "1px", height: "14px", backgroundColor: MP.border }} />
                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  {[
                    { color: MP.accent, opacity: 0.25 },
                    { color: MP.accent, opacity: 0.45 },
                    { color: MP.accent, opacity: 0.6 },
                    { color: MP.amber, opacity: 0.55 },
                    { color: MP.red, opacity: 0.75 },
                  ].map((s, i) => (
                    <div key={i} style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: s.color, opacity: s.opacity }} />
                  ))}
                  <span style={{ fontSize: "10px", color: MP.textMuted, marginLeft: "4px" }}>quiet → busy</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: "8px 20px 0" }}>
            <div style={{ position: "relative" }}>
              {/* Top labels — rotated */}
              <EventLabels days={days} curr={curr} />
              {/* Background event columns */}
              <div style={{ position: "absolute", top: "160px", left: "20px", right: "10px", bottom: 0, display: "flex", pointerEvents: "none" }}>
                {days.map((d) => (
                  <div key={d.i} style={{ flex: 1, backgroundColor: d.event ? MP.accent : "transparent", opacity: d.event ? (d.event.localRank >= 95 ? 0.08 : 0.04) : 0 }} />
                ))}
              </div>
              {/* Chart */}
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={days} margin={{ top: 10, right: 10, left: -15, bottom: 0 }} syncId="dr">
                    <XAxis dataKey="xLabel" {...axisStyle} interval={0} tickLine={false} height={20} tick={({ x, y, payload }: any) => payload?.value ? <text x={x} y={y + 12} textAnchor="middle" fill={MP.textMuted} fontSize={9}>{payload.value}</text> : null} />
                    <YAxis {...axisStyle} width={35} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip {...tipStyle} cursor={{ stroke: MP.accent, strokeOpacity: 0.15, strokeWidth: 1 }}
                      labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }}
                      formatter={(v: number, name: string) => [`${v}%`, name]} />
                    <Bar dataKey="demand" name="Demand" radius={[2, 2, 0, 0]} maxBarSize={10}>
                      {days.map((d, i) => {
                        const v = d.demand;
                        if (v >= 85) return <Cell key={i} fill={MP.red} fillOpacity={0.75} />;
                        if (v >= 70) return <Cell key={i} fill={MP.amber} fillOpacity={0.55} />;
                        return <Cell key={i} fill={MP.accent} fillOpacity={0.25 + (v / 100) * 0.45} />;
                      })}
                    </Bar>
                    <Line type="monotone" dataKey="demandMa" name="7d trend" stroke={MP.accent} strokeWidth={2} strokeDasharray="6 3" dot={false} strokeOpacity={0.7} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CENTREPIECE — PRICING (2-4★ Segment WAP)
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: MP.card, borderLeft: `1px solid ${MP.border}`, borderRight: `1px solid ${MP.border}`, borderBottom: `1px solid ${MP.border}`, borderTop: "none" }}>
          <div style={{ padding: "12px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${MP.border}` }}>
            <div>
              <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>MARKET PRICING</div>
              <h3 style={{ color: MP.text, fontSize: "15px", fontWeight: 600, margin: 0 }}>Weighted Average Price</h3>
              <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>2-4★ hotel segment — excludes luxury and unrated properties</p>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "11px", alignItems: "center" }}>
              <Leg color={MP.text} label="WAP" />
              <Leg color={MP.textMuted} label="7d trend" dotted />
            </div>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ position: "relative", height: 260 }}>
              {/* Subtle spike tint columns behind the chart */}
              <div style={{ position: "absolute", top: "6px", left: "20px", right: "10px", bottom: "20px", display: "flex", pointerEvents: "none", zIndex: 0 }}>
                {days.map((d) => {
                  const isSpike = d.segmentWap >= stats.segWapP90;
                  const isWarm = !isSpike && d.segmentWap >= stats.segWapP75;
                  return (
                    <div key={d.i} style={{
                      flex: 1,
                      backgroundColor: isSpike ? MP.amber : isWarm ? MP.amber : "transparent",
                      opacity: isSpike ? 0.08 : isWarm ? 0.04 : 0,
                    }} />
                  );
                })}
              </div>
              <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={days} margin={{ top: 6, right: 10, left: -15, bottom: 20 }} syncId="dr">
                  <defs>
                    <linearGradient id="wapFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={MP.text} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={MP.text} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={50} tickFormatter={(v) => `${curr}${v}`} domain={["dataMin - 15", "dataMax + 15"]} />
                  <Tooltip {...tipStyle} cursor={{ stroke: MP.accent, strokeOpacity: 0.15, strokeWidth: 1 }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? d.shortLabel : _l; }}
                    formatter={(v: number, name: string) => [`${curr}${v}`, name]} />
                  <Area type="monotone" dataKey="segmentWap" name="WAP" stroke={MP.text} strokeWidth={2} fill="url(#wapFill)" fillOpacity={1} dot={false} activeDot={{ r: 3, fill: MP.text, stroke: MP.card, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="segmentWapMa" name="7d trend" stroke={MP.textMuted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} strokeOpacity={0.6} />
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CENTREPIECE — 7-DAY CHANGE (attached to WAP above)
            ══════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: MP.card, borderRadius: "0 0 8px 8px", border: `1px solid ${MP.border}`, borderTop: "none", marginBottom: "24px" }}>
          <div style={{ padding: "12px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${MP.border}` }}>
            <div>
              <div style={{ fontSize: "10px", color: MP.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>7-DAY CHANGE</div>
              <h3 style={{ color: MP.text, fontSize: "15px", fontWeight: 600, margin: 0 }}>Recent Pickup</h3>
              <p style={{ color: MP.textSec, fontSize: "11px", margin: "2px 0 0" }}>How demand and price shifted vs the same dates 7 days ago</p>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: "11px", alignItems: "center" }}>
              <Leg color={MP.green} label="Demand up" />
              <Leg color={MP.red} label="Demand down" />
              <Leg color={MP.amber} label="Price change" dashed />
            </div>
          </div>
          <div style={{ padding: "0 20px 16px" }}>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={days} margin={{ top: 6, right: 10, left: -15, bottom: 20 }} syncId="dr">
                  <CartesianGrid {...gridStroke} vertical={false} />
                  <XAxis dataKey="xLabel" {...axisStyle} interval={6} />
                  <YAxis {...axisStyle} width={50} />
                  <ReferenceLine y={0} stroke={MP.textMuted} strokeOpacity={0.4} strokeWidth={1} />
                  <Tooltip {...tipStyle} cursor={{ stroke: MP.accent, strokeOpacity: 0.15, strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      const dd = d.demandDelta || 0;
                      const wd = d.wapDelta || 0;
                      const sd = d.supplyPctDelta || 0;
                      return (
                        <div style={{ ...tipStyle.contentStyle, padding: "10px 14px" }}>
                          <div style={{ ...tipStyle.labelStyle as any, fontWeight: 600 }}>{d.shortLabel}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 10px", fontSize: "12px" }}>
                            <span style={{ color: MP.textMuted }}>Demand</span>
                            <span style={{ color: dd >= 0 ? MP.green : MP.red, textAlign: "right" }}>{dd > 0 ? "+" : ""}{dd}pp</span>
                            <span style={{ color: MP.textMuted }}>Price</span>
                            <span style={{ color: wd >= 0 ? MP.green : MP.red, textAlign: "right" }}>{wd > 0 ? "+" : ""}{curr}{wd}</span>
                            <span style={{ color: MP.textMuted }}>Supply</span>
                            <span style={{ color: sd > 0 ? MP.accent : sd < 0 ? MP.purple : MP.textMuted, textAlign: "right" }}>{sd > 0 ? "+" : ""}{sd}%</span>
                          </div>
                        </div>
                      );
                    }} />
                  <Bar dataKey="demandDelta" name="Demand change" radius={[3, 3, 0, 0]} maxBarSize={10}>
                    {days.map((d, i) => <Cell key={i} fill={d.demandDelta >= 0 ? MP.green : MP.red} fillOpacity={0.6} />)}
                  </Bar>
                  <Line type="monotone" dataKey="wapDelta" name="Price change" stroke={MP.amber} strokeWidth={2} dot={false} strokeDasharray="5 3" strokeOpacity={0.8} />
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
                color: stats.regime === "strengthening" ? MP.green : stats.regime === "softening" ? MP.red : MP.amber,
                title: `Market is ${stats.regime}`,
                body: `Demand is ${stats.demandMomentum > 0 ? "+" : ""}${stats.demandMomentum}pp vs 30 days ago. Avg rates moved ${stats.wapMomentum > 0 ? "+" : ""}${curr}${stats.wapMomentum}. ${stats.regime === "strengthening" ? "Rates have room to follow demand higher." : stats.regime === "softening" ? "Consider defending occupancy over rate." : "Hold current positioning."}`,
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
          border: `1px solid ${MP.border}`, backgroundColor: expanded ? "rgba(57,189,248,0.1)" : "transparent", color: expanded ? MP.accent : MP.textMuted,
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
                color: MP.accent, opacity: hover?.idx === d.i ? 1 : (d.event.localRank >= 95 ? 0.8 : 0.5),
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
            height: "4px", backgroundColor: MP.accent,
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
            <span style={{ color: MP.accent, fontWeight: 600 }}>{hoverEv.attendance ? hoverEv.attendance.toLocaleString() : "—"}</span>
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

function Leg({ color, label, dashed, dotted }: { color: string; label: string; dashed?: boolean; dotted?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
      <span style={{ width: "16px", height: "2px", borderRadius: "1px", backgroundColor: dashed || dotted ? "transparent" : color, borderBottom: dashed ? `2px dashed ${color}` : dotted ? `2px dotted ${color}` : "none", opacity: dashed ? 0.4 : dotted ? 0.5 : 1 }} />
      <span style={{ color: MP.textMuted, fontSize: "11px" }}>{label}</span>
    </span>
  );
}
