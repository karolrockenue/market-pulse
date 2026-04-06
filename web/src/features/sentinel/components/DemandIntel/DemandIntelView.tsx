import { useState, useEffect, useMemo } from "react";
import {
  Plane,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Cell,
  Area,
  Line,
  PieChart,
  Pie,
} from "recharts";
import { toast } from "sonner";

// Country code → flag emoji
const countryFlag = (code: string) => {
  try {
    return code
      .toUpperCase()
      .split("")
      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
      .join("");
  } catch {
    return "";
  }
};

// Country code → readable name (common ones)
const COUNTRY_NAMES: Record<string, string> = {
  AE: "UAE", US: "United States", DE: "Germany", FR: "France", ES: "Spain",
  IT: "Italy", NL: "Netherlands", CH: "Switzerland", IE: "Ireland", PT: "Portugal",
  TR: "Turkey", SA: "Saudi Arabia", QA: "Qatar", IN: "India", PK: "Pakistan",
  CN: "China", JP: "Japan", KR: "South Korea", AU: "Australia", CA: "Canada",
  BR: "Brazil", GR: "Greece", PL: "Poland", RO: "Romania", NO: "Norway",
  SE: "Sweden", DK: "Denmark", FI: "Finland", AT: "Austria", BE: "Belgium",
  CZ: "Czech Republic", HU: "Hungary", EG: "Egypt", MA: "Morocco", ZA: "South Africa",
  IL: "Israel", JO: "Jordan", GB: "United Kingdom", BG: "Bulgaria", HR: "Croatia",
  OM: "Oman", BH: "Bahrain", KW: "Kuwait", SG: "Singapore", TH: "Thailand",
  MY: "Malaysia", LB: "Lebanon", CY: "Cyprus", MT: "Malta", IS: "Iceland",
  LU: "Luxembourg", BA: "Bosnia", RS: "Serbia", UA: "Ukraine", GE: "Georgia",
  AM: "Armenia", AZ: "Azerbaijan", KZ: "Kazakhstan", UZ: "Uzbekistan",
};

interface DemandIntelProps {
  allHotels: any[];
}

export function DemandIntelView({ allHotels }: DemandIntelProps) {
  // Derive unique cities
  const cities = useMemo(() => {
    const cityMap = new Map<string, string>();
    allHotels.forEach((h) => {
      const slug = h.city || h.city_slug;
      if (slug && !cityMap.has(slug)) {
        cityMap.set(slug, slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "));
      }
    });
    return Array.from(cityMap.entries()).map(([slug, label]) => ({ slug, label }));
  }, [allHotels]);

  const [citySlug, setCitySlug] = useState(() => {
    const london = cities.find((c) => c.slug === "london");
    return london?.slug || cities[0]?.slug || "london";
  });

  const currencyCode = allHotels.find((h) => (h.city || h.city_slug) === citySlug)?.currency_code || "GBP";
  const currencySymbol = currencyCode === "GBP" ? "£" : currencyCode === "EUR" ? "€" : "$";

  // Data state
  const [marketData, setMarketData] = useState<any[]>([]);
  const [paceData, setPaceData] = useState<any[]>([]);
  const [flightData, setFlightData] = useState<any[]>([]);
  const [flightAirports, setFlightAirports] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [flightLoading, setFlightLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch market + pace data
  useEffect(() => {
    if (!citySlug) return;
    setIsLoading(true);
    Promise.all([
      fetch(`/api/market/forward-view?city=${citySlug}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/market/pace?city=${citySlug}&period=7`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([market, pace]) => { setMarketData(market); setPaceData(pace); })
      .catch((err) => console.error("Market fetch error:", err))
      .finally(() => setIsLoading(false));
  }, [citySlug]);

  // Fetch flight data with YoY
  useEffect(() => {
    if (!citySlug) return;
    setFlightLoading(true);
    fetch(`/api/flights/demand?city=${citySlug}&days=90&yoy=true`)
      .then((r) => r.ok ? r.json() : { data: [], airports: [] })
      .then((data) => { setFlightData(data.data || []); setFlightAirports(data.airports || []); })
      .catch((err) => console.error("Flight fetch error:", err))
      .finally(() => setFlightLoading(false));
  }, [citySlug]);

  // Refresh flights from API (with YoY)
  const handleRefreshFlights = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/flights/refresh?city=${citySlug}&days=90&yoy=true`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      await res.json();
      toast.success("Fetching flight data + last year's comparison in the background. Reload in ~20 min.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Merged chart data
  const chartData = useMemo(() => {
    const normalize = (s: string) => new Date(s).toISOString().split("T")[0];
    const flightMap = new Map(flightData.map((f) => [f.date, f]));
    const paceMap = new Map(paceData.map((p) => [normalize(p.checkin_date), p]));

    return marketData.slice(0, 90).map((item, idx) => {
      const dateKey = normalize(item.checkin_date);
      const date = new Date(item.checkin_date);
      const flight = flightMap.get(dateKey);
      const pace = paceMap.get(dateKey);

      return {
        dateKey,
        date,
        label: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        xLabel: idx % 7 === 0 ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        demand: Math.round(item.market_demand_score || 0),
        supply: item.total_results || 0,
        wap: Math.round(item.weighted_avg_price || 0),
        priceIndex: item.mpss || 0,
        arrivals: flight?.arrivals || 0,
        departures: flight?.departures || 0,
        totalFlights: flight?.totalFlights || 0,
        yoyArrivals: flight?.yoy?.arrivals || 0,
        yoyChange: flight?.arrivals && flight?.yoy?.arrivals
          ? Math.round(((flight.arrivals - flight.yoy.arrivals) / flight.yoy.arrivals) * 100)
          : null,
        origins: flight?.origins || [],
        priceChange: Math.round(pace?.wap_delta || 0),
        supplyChange: parseFloat((pace?.total_results_percent_delta || 0).toFixed(1)),
      };
    });
  }, [marketData, flightData, paceData]);

  // Aggregate origin countries across all dates
  const originBreakdown = useMemo(() => {
    const countryTotals = new Map<string, { country: string; count: number }>();
    for (const day of flightData) {
      for (const o of (day.origins || [])) {
        const existing = countryTotals.get(o.country);
        if (existing) {
          existing.count += o.count;
        } else {
          countryTotals.set(o.country, { country: o.country, count: o.count });
        }
      }
    }
    return Array.from(countryTotals.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [flightData]);

  const totalOriginFlights = originBreakdown.reduce((s, o) => s + o.count, 0);

  // Stats
  const stats = useMemo(() => {
    if (!chartData.length) return null;

    const withFlights = chartData.filter((d) => d.arrivals > 0);
    const withYoY = chartData.filter((d) => d.yoyArrivals > 0);
    const avgDemand = Math.round(chartData.reduce((s, d) => s + d.demand, 0) / chartData.length);
    const avgWap = Math.round(chartData.reduce((s, d) => s + d.wap, 0) / chartData.length);
    const avgArrivals = withFlights.length ? Math.round(withFlights.reduce((s, d) => s + d.arrivals, 0) / withFlights.length) : 0;
    const avgYoYArrivals = withYoY.length ? Math.round(withYoY.reduce((s, d) => s + d.yoyArrivals, 0) / withYoY.length) : 0;
    const yoyPct = avgYoYArrivals > 0 ? Math.round(((avgArrivals - avgYoYArrivals) / avgYoYArrivals) * 100) : null;

    // Peak dates by combined score
    const scored = chartData.map((d) => {
      const avgArr = avgArrivals || 1;
      const flightSignal = d.arrivals > 0 ? (d.arrivals / avgArr) * 50 : 0;
      return { ...d, score: Math.round(flightSignal + d.demand) };
    });
    const sorted = [...scored].sort((a, b) => b.score - a.score);

    // WAP trend
    const first7 = chartData.slice(0, 7);
    const last7 = chartData.slice(-7);
    const wapTrend = (last7.reduce((s, d) => s + d.wap, 0) / 7) - (first7.reduce((s, d) => s + d.wap, 0) / 7);

    return {
      avgDemand, avgWap, avgArrivals, avgYoYArrivals, yoyPct, wapTrend,
      hotDates: sorted.slice(0, 7),
      quietDates: sorted.slice(-7).reverse(),
      hasFlights: withFlights.length > 0,
      hasYoY: withYoY.length > 0,
    };
  }, [chartData]);

  // Chart config
  const gridProps = { strokeDasharray: "0", stroke: "#2a2a2a", opacity: 0.5 };
  const xProps = { dataKey: "xLabel" as const, stroke: "#2a2a2a", tick: { fill: "#6b7280", fontSize: 10 }, tickLine: { stroke: "#2a2a2a" }, axisLine: { stroke: "#2a2a2a" }, interval: 6 };
  const yProps = { stroke: "#2a2a2a", tick: { fill: "#6b7280", fontSize: 10 }, tickLine: { stroke: "#2a2a2a" }, axisLine: { stroke: "#2a2a2a" }, width: 50 };
  const tipStyle = {
    contentStyle: { backgroundColor: "rgba(26, 26, 26, 0.95)", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 14px" },
    labelStyle: { color: "#9ca3af", fontSize: "11px", marginBottom: "4px" },
    itemStyle: { fontSize: "12px", color: "#e5e5e5", padding: "1px 0" },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1d1d1c] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39BDF8] animate-spin mb-3" />
        <p className="text-[#9ca3af] text-sm">Loading demand intelligence...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d1d1c]">
      <div className="fixed inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(57,189,248,0.015) 0%, transparent 50%, rgba(57,189,248,0.01) 100%)" }} />

      <div className="relative z-10 p-6 max-w-[1600px] mx-auto">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[22px] font-semibold text-[#e5e5e5] tracking-tight">Demand Intelligence</h1>
              <span className="bg-[rgba(57,189,248,0.12)] text-[#39BDF8] text-[10px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide">BETA</span>
            </div>
            <p className="text-[#6b7280] text-[13px]">
              90-day forward demand — market data, flight traffic, origin intelligence
              {flightAirports.length > 0 && (
                <span className="ml-1.5 text-[#9ca3af]">({flightAirports.join(" + ")})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cities.length > 1 && (
              <select value={citySlug} onChange={(e) => setCitySlug(e.target.value)}
                className="h-9 px-3 bg-[#2C2C2C] border border-[#2a2a2a] rounded-md text-[#e5e5e5] text-sm outline-none">
                {cities.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            )}
            <button onClick={handleRefreshFlights} disabled={isRefreshing}
              className="flex items-center gap-2 h-9 px-4 rounded-md text-xs font-medium"
              style={{ backgroundColor: isRefreshing ? "#2C2C2C" : "rgba(57,189,248,0.1)", color: "#39BDF8", border: "1px solid rgba(57,189,248,0.2)", cursor: isRefreshing ? "not-allowed" : "pointer" }}>
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isRefreshing ? "Fetching..." : "Refresh Flight Data"}
            </button>
          </div>
        </div>

        {/* ── HERO KPIs ── */}
        {stats && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <KpiCard label="Market Demand" value={`${stats.avgDemand}%`} sub="90-day avg"
              color={stats.avgDemand >= 70 ? "#ef4444" : stats.avgDemand >= 40 ? "#f59e0b" : "#39BDF8"} />
            <KpiCard label="Market Rate" value={`${currencySymbol}${stats.avgWap}`}
              sub={stats.wapTrend !== 0 ? `${stats.wapTrend > 0 ? "+" : ""}${currencySymbol}${Math.abs(Math.round(stats.wapTrend))} trend` : "stable"}
              color="#e5e5e5" subColor={stats.wapTrend > 0 ? "#ef4444" : stats.wapTrend < 0 ? "#10b981" : "#6b7280"} />
            <KpiCard label="Daily Arrivals" value={stats.hasFlights ? stats.avgArrivals.toLocaleString() : "—"}
              sub={stats.hasFlights ? `avg across ${flightAirports.length} airports` : "Click refresh"} color="#39BDF8" />
            <KpiCard label="vs Last Year"
              value={stats.yoyPct !== null ? `${stats.yoyPct > 0 ? "+" : ""}${stats.yoyPct}%` : "—"}
              sub={stats.hasYoY ? `was ${stats.avgYoYArrivals.toLocaleString()}/day` : "No YoY data yet"}
              color={stats.yoyPct !== null ? (stats.yoyPct > 0 ? "#10b981" : "#ef4444") : "#6b7280"}
              icon={stats.yoyPct !== null ? (stats.yoyPct > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />) : undefined} />
            <KpiCard label="Top Origin" value={originBreakdown.length > 0 ? `${countryFlag(originBreakdown[0].country)} ${COUNTRY_NAMES[originBreakdown[0].country] || originBreakdown[0].country}` : "—"}
              sub={originBreakdown.length > 0 ? `${Math.round((originBreakdown[0].count / totalOriginFlights) * 100)}% of arrivals` : "No origin data"}
              color="#e5e5e5" />
          </div>
        )}

        {/* ── FLIGHT ARRIVALS + YoY CHART ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-4">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-[#39BDF8]" />
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">Flight Arrivals — This Year vs Last Year</h2>
            </div>
            <p className="text-[11px] text-[#6b7280] mt-0.5">
              Blue bars = this year's scheduled arrivals • Gray line = same period last year (day-of-week aligned)
            </p>
          </div>
          <div style={{ height: 260 }}>
            {flightLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-[#39BDF8]" /></div>
            ) : chartData.some((d) => d.arrivals > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xProps} />
                  <YAxis {...yProps} domain={[0, "auto"]} />
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                    formatter={(value: number, name: string) => {
                      if (name === "YoY Change") return [value !== null ? `${value > 0 ? "+" : ""}${value}%` : "—", name];
                      return [value.toLocaleString(), name];
                    }} />
                  <Bar dataKey="arrivals" name="This Year" radius={[3, 3, 0, 0]} maxBarSize={18} fillOpacity={0.8}>
                    {chartData.map((entry, i) => {
                      const avg = stats?.avgArrivals || 1;
                      let fill = "#39BDF8";
                      if (entry.arrivals > avg * 1.15) fill = "#ef4444";
                      else if (entry.arrivals > avg * 1.05) fill = "#f59e0b";
                      else if (entry.arrivals < avg * 0.85) fill = "#10b981";
                      return <Cell key={i} fill={fill} />;
                    })}
                  </Bar>
                  {stats?.hasYoY && (
                    <Line type="monotone" dataKey="yoyArrivals" name="Last Year" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#6b7280]">
                <Plane className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-[13px]">No flight data cached</p>
                <p className="text-[11px]">Click "Refresh Flight Data" to fetch from AeroDataBox</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TWO-COLUMN: Origins + Market Demand ── */}
        <div className="grid grid-cols-5 gap-4 mb-4">

          {/* Origin Countries — Left (2 cols) */}
          <div className="col-span-2 bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-[#39BDF8]" />
              <h2 className="text-[14px] font-medium text-[#e5e5e5]">Where Travellers Fly From</h2>
            </div>
            {originBreakdown.length > 0 ? (
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {originBreakdown.map((o, i) => {
                  const pct = Math.round((o.count / totalOriginFlights) * 100);
                  return (
                    <div key={o.country} className="flex items-center gap-3 py-1.5 px-2 rounded" style={{ backgroundColor: i < 3 ? "rgba(57,189,248,0.05)" : "transparent" }}>
                      <span className="text-[16px] w-7 text-center">{countryFlag(o.country)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] text-[#e5e5e5]">{COUNTRY_NAMES[o.country] || o.country}</span>
                          <span className="text-[11px] text-[#9ca3af]">{o.count.toLocaleString()} flights · {pct}%</span>
                        </div>
                        <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: i < 3 ? "#39BDF8" : "#3b82f6", opacity: 1 - i * 0.03 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-[#6b7280]">
                <Globe className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-[12px]">Origin data appears after flight refresh</p>
              </div>
            )}
          </div>

          {/* Market Demand Heatmap — Right (3 cols) */}
          <div className="col-span-3 bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">Market Demand Heatmap</h2>
              <p className="text-[11px] text-[#6b7280] mt-0.5">
                Demand % bars with flight arrivals overlay — spikes in both = high-confidence demand
              </p>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xProps} />
                  <YAxis yAxisId="demand" {...yProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  {stats?.hasFlights && <YAxis yAxisId="flights" orientation="right" {...yProps} domain={[0, "auto"]} />}
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                    formatter={(value: number, name: string) => {
                      if (name === "Market Demand") return [`${value}%`, name];
                      return [value.toLocaleString(), name];
                    }} />
                  <Bar yAxisId="demand" dataKey="demand" name="Market Demand" radius={[3, 3, 0, 0]} maxBarSize={18} fillOpacity={0.8}>
                    {chartData.map((entry, i) => {
                      let fill = "#3b82f6";
                      if (entry.demand >= 85) fill = "#ef4444";
                      else if (entry.demand >= 70) fill = "#f97316";
                      else if (entry.demand >= 40) fill = "#f59e0b";
                      return <Cell key={i} fill={fill} />;
                    })}
                  </Bar>
                  {stats?.hasFlights && (
                    <Line yAxisId="flights" type="monotone" dataKey="arrivals" name="Flight Arrivals" stroke="#39BDF8" strokeWidth={2} dot={false} strokeOpacity={0.7} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── HOT + QUIET DATES ── */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-[#ef4444]" />
                <h2 className="text-[14px] font-medium text-[#e5e5e5]">Peak Demand Dates</h2>
              </div>
              <div className="space-y-0.5">
                {stats.hotDates.map((d, i) => (
                  <DateRow key={i} d={d} rank={i + 1} type="hot" currencySymbol={currencySymbol} hasFlights={stats.hasFlights} hasYoY={stats.hasYoY} />
                ))}
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Snowflake className="w-4 h-4 text-[#3b82f6]" />
                <h2 className="text-[14px] font-medium text-[#e5e5e5]">Low Demand Dates</h2>
              </div>
              <div className="space-y-0.5">
                {stats.quietDates.map((d, i) => (
                  <DateRow key={i} d={d} rank={i + 1} type="quiet" currencySymbol={currencySymbol} hasFlights={stats.hasFlights} hasYoY={stats.hasYoY} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRICING + SUPPLY ROW ── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Pricing Pressure */}
          <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
            <div className="mb-3">
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">Pricing Pressure</h2>
              <p className="text-[11px] text-[#6b7280] mt-0.5">WAP line + 7d price change bars</p>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xProps} />
                  <YAxis yAxisId="wap" {...yProps} tickFormatter={(v) => `${currencySymbol}${v}`} />
                  <YAxis yAxisId="change" orientation="right" {...yProps} />
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                    formatter={(v: number, n: string) => n === "WAP" ? [`${currencySymbol}${v}`, n] : [`${v > 0 ? "+" : ""}${currencySymbol}${v}`, n]} />
                  <Area yAxisId="wap" type="monotone" dataKey="wap" name="WAP" stroke="#e5e5e5" strokeWidth={1.5} fill="#e5e5e5" fillOpacity={0.04} dot={false} />
                  <Bar yAxisId="change" dataKey="priceChange" name="7d Change" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.priceChange >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.7} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Supply Dynamics */}
          <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
            <div className="mb-3">
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">Supply Dynamics</h2>
              <p className="text-[11px] text-[#6b7280] mt-0.5">Available properties + 7d supply change</p>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xProps} />
                  <YAxis yAxisId="supply" {...yProps} />
                  <YAxis yAxisId="change" orientation="right" {...yProps} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...tipStyle} cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                    formatter={(v: number, n: string) => n === "Supply Change" ? [`${v > 0 ? "+" : ""}${v}%`, n] : [v.toLocaleString(), n]} />
                  <Area yAxisId="supply" type="monotone" dataKey="supply" name="Properties" stroke="#3b82f6" strokeWidth={1.5} fill="#3b82f6" fillOpacity={0.08} dot={false} />
                  <Bar yAxisId="change" dataKey="supplyChange" name="Supply Change" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.supplyChange >= 0 ? "#3b82f6" : "#8b5cf6"} fillOpacity={0.7} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <p className="text-center text-[#6b7280] text-[11px] pb-4">
          Market data: Booking.com • Flight data: AeroDataBox (FIDS) • Origins: arrival source airports • YoY: day-of-week aligned (-364d) • Auto-refresh daily 04:00 UTC
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ label, value, sub, color, subColor, icon }: {
  label: string; value: string; sub: string; color: string; subColor?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-4">
      <div className="text-[10px] text-[#6b7280] uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <div className="text-[26px] font-semibold leading-tight" style={{ color }}>{value}</div>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: subColor || "#6b7280" }}>{sub}</div>
    </div>
  );
}

function DateRow({ d, rank, type, currencySymbol, hasFlights, hasYoY }: {
  d: any; rank: number; type: "hot" | "quiet"; currencySymbol: string; hasFlights: boolean; hasYoY: boolean;
}) {
  const accent = type === "hot" ? "#ef4444" : "#3b82f6";
  const bg = type === "hot" ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)";

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md" style={{ backgroundColor: rank <= 3 ? bg : "transparent" }}>
      <span className="text-[11px] font-mono w-5 text-right" style={{ color: rank <= 3 ? accent : "#6b7280" }}>{rank}</span>
      <span className="text-[13px] text-[#e5e5e5] flex-1">{d.dayName} {d.label}</span>
      <div className="flex items-center gap-4 text-[11px]">
        <span style={{ color: d.demand >= 70 ? "#ef4444" : d.demand >= 40 ? "#f59e0b" : "#6b7280" }}>{d.demand}%</span>
        <span className="text-[#9ca3af]">{currencySymbol}{d.wap}</span>
        {hasFlights && (
          <span className="text-[#39BDF8] flex items-center gap-1">
            <Plane className="w-3 h-3" />{d.arrivals > 0 ? d.arrivals.toLocaleString() : "—"}
          </span>
        )}
        {hasYoY && d.yoyChange !== null && (
          <span style={{ color: d.yoyChange > 0 ? "#10b981" : d.yoyChange < 0 ? "#ef4444" : "#6b7280", minWidth: "36px", textAlign: "right" }}>
            {d.yoyChange > 0 ? "+" : ""}{d.yoyChange}%
          </span>
        )}
      </div>
    </div>
  );
}
