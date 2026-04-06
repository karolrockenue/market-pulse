import { useState, useEffect, useMemo } from "react";
import {
  Plane,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Flame,
  Snowflake,
  Database,
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
} from "recharts";
import { toast } from "sonner";

interface DemandIntelProps {
  allHotels: any[];
}

export function DemandIntelView({ allHotels }: DemandIntelProps) {
  // Derive unique cities from hotels
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

  const [citySlug, setCitySlug] = useState(cities[0]?.slug || "london");
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
      .then(([market, pace]) => {
        setMarketData(market);
        setPaceData(pace);
      })
      .catch((err) => console.error("Market fetch error:", err))
      .finally(() => setIsLoading(false));
  }, [citySlug]);

  // Fetch flight data
  useEffect(() => {
    if (!citySlug) return;
    setFlightLoading(true);

    fetch(`/api/flights/demand?city=${citySlug}&days=90`)
      .then((r) => r.ok ? r.json() : { data: [], airports: [] })
      .then((data) => {
        setFlightData(data.data || []);
        setFlightAirports(data.airports || []);
      })
      .catch((err) => console.error("Flight fetch error:", err))
      .finally(() => setFlightLoading(false));
  }, [citySlug]);

  // Refresh flights from API
  const handleRefreshFlights = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/flights/refresh?city=${citySlug}&days=90`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      await res.json();
      toast.success("Flight data fetch started — refresh the page in a few minutes to see results");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Merged chart data: market + flights + pace on one timeline
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
        priceChange: Math.round(pace?.wap_delta || 0),
        supplyChange: parseFloat((pace?.total_results_percent_delta || 0).toFixed(1)),
      };
    });
  }, [marketData, flightData, paceData]);

  // Compute summary stats
  const stats = useMemo(() => {
    if (!chartData.length) return null;

    const withFlights = chartData.filter((d) => d.arrivals > 0);
    const avgDemand = Math.round(chartData.reduce((s, d) => s + d.demand, 0) / chartData.length);
    const avgWap = Math.round(chartData.reduce((s, d) => s + d.wap, 0) / chartData.length);
    const avgArrivals = withFlights.length
      ? Math.round(withFlights.reduce((s, d) => s + d.arrivals, 0) / withFlights.length)
      : 0;

    // Peak and quiet dates by combined signal
    const scored = chartData.map((d) => {
      const avgArr = avgArrivals || 1;
      const flightSignal = d.arrivals > 0 ? (d.arrivals / avgArr) * 50 : 0;
      const demandSignal = d.demand;
      return { ...d, score: Math.round(flightSignal + demandSignal) };
    });

    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const hotDates = sorted.slice(0, 7);
    const quietDates = sorted.slice(-7).reverse();

    // WAP trend (first 7 days avg vs last 7 days avg)
    const first7 = chartData.slice(0, 7);
    const last7 = chartData.slice(-7);
    const wapFirst = first7.reduce((s, d) => s + d.wap, 0) / 7;
    const wapLast = last7.reduce((s, d) => s + d.wap, 0) / 7;
    const wapTrend = wapLast - wapFirst;

    return { avgDemand, avgWap, avgArrivals, wapTrend, hotDates, quietDates, scored, hasFlights: withFlights.length > 0 };
  }, [chartData]);

  // Common chart config
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
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(57,189,248,0.015) 0%, transparent 50%, rgba(57,189,248,0.01) 100%)" }} />

      <div className="relative z-10 p-6 max-w-[1600px] mx-auto">

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[22px] font-semibold text-[#e5e5e5] tracking-tight">Demand Intelligence</h1>
              <span className="bg-[rgba(57,189,248,0.12)] text-[#39BDF8] text-[10px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide">BETA</span>
            </div>
            <p className="text-[#6b7280] text-[13px]">
              90-day forward demand signals — market data + flight traffic
              {flightAirports.length > 0 && (
                <span className="ml-2 text-[#9ca3af]">
                  <Plane className="w-3 h-3 inline mb-0.5 mr-1" />
                  {flightAirports.join(", ")}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* City selector */}
            {cities.length > 1 && (
              <select
                value={citySlug}
                onChange={(e) => setCitySlug(e.target.value)}
                className="h-9 px-3 bg-[#2C2C2C] border border-[#2a2a2a] rounded-md text-[#e5e5e5] text-sm outline-none"
              >
                {cities.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleRefreshFlights}
              disabled={isRefreshing}
              className="flex items-center gap-2 h-9 px-4 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: isRefreshing ? "#2C2C2C" : "rgba(57,189,248,0.1)",
                color: "#39BDF8",
                border: "1px solid rgba(57,189,248,0.2)",
                cursor: isRefreshing ? "not-allowed" : "pointer",
              }}
            >
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {isRefreshing ? "Fetching flights..." : "Refresh Flight Data"}
            </button>
          </div>
        </div>

        {/* ── HERO KPIs ── */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Market Demand"
              value={`${stats.avgDemand}%`}
              sub="90-day average"
              color={stats.avgDemand >= 70 ? "#ef4444" : stats.avgDemand >= 40 ? "#f59e0b" : "#39BDF8"}
            />
            <KpiCard
              label="Avg Market Rate"
              value={`${currencySymbol}${stats.avgWap}`}
              sub={
                stats.wapTrend !== 0
                  ? `${stats.wapTrend > 0 ? "+" : ""}${currencySymbol}${Math.abs(Math.round(stats.wapTrend))} trend`
                  : "stable"
              }
              color="#e5e5e5"
              subColor={stats.wapTrend > 0 ? "#ef4444" : stats.wapTrend < 0 ? "#10b981" : "#6b7280"}
            />
            <KpiCard
              label="Daily Flight Arrivals"
              value={stats.hasFlights ? stats.avgArrivals.toLocaleString() : "—"}
              sub={stats.hasFlights ? `across ${flightAirports.join(", ")}` : "No data — click refresh"}
              color="#39BDF8"
            />
            <KpiCard
              label="Data Coverage"
              value={`${chartData.length}`}
              sub="days forward"
              color="#e5e5e5"
            />
          </div>
        )}

        {/* ── MAIN CHART: Combined Demand Signal ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-6">
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-[#e5e5e5]">Demand Heatmap</h2>
            <p className="text-[11px] text-[#6b7280] mt-0.5">
              Market demand % (bars) overlaid with flight arrivals (line) — dates where both spike are high-confidence demand peaks
            </p>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                <CartesianGrid {...gridProps} />
                <XAxis {...xProps} />
                <YAxis yAxisId="demand" {...yProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="flights" orientation="right" {...yProps} domain={[0, "auto"]} hide={!stats?.hasFlights} />
                <Tooltip
                  {...tipStyle}
                  cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                  labelFormatter={(_l, p) => {
                    const d = p?.[0]?.payload;
                    return d ? `${d.dayName} ${d.label}` : _l;
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "Market Demand") return [`${value}%`, name];
                    if (name === "Flight Arrivals") return [value.toLocaleString(), name];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="demand" dataKey="demand" name="Market Demand" radius={[3, 3, 0, 0]} maxBarSize={20} fillOpacity={0.8}>
                  {chartData.map((entry, i) => {
                    let fill = "#3b82f6";
                    if (entry.demand >= 85) fill = "#ef4444";
                    else if (entry.demand >= 70) fill = "#f97316";
                    else if (entry.demand >= 40) fill = "#f59e0b";
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
                {stats?.hasFlights && (
                  <Line
                    yAxisId="flights"
                    type="monotone"
                    dataKey="arrivals"
                    name="Flight Arrivals"
                    stroke="#39BDF8"
                    strokeWidth={2}
                    dot={false}
                    strokeOpacity={0.8}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── FLIGHT ARRIVALS CHART ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-[#39BDF8]" />
                <h2 className="text-[15px] font-medium text-[#e5e5e5]">Flight Arrivals</h2>
              </div>
              <p className="text-[11px] text-[#6b7280] mt-0.5">
                Scheduled inbound passenger flights per day (excl. cargo, codeshare, private)
                {flightAirports.length > 0 && ` — ${flightAirports.join(" + ")}`}
              </p>
            </div>
          </div>
          <div style={{ height: 240 }}>
            {flightLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-[#39BDF8]" />
              </div>
            ) : chartData.some((d) => d.arrivals > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                  <CartesianGrid {...gridProps} />
                  <XAxis {...xProps} />
                  <YAxis {...yProps} domain={[0, "auto"]} />
                  <Tooltip
                    {...tipStyle}
                    cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                    labelFormatter={(_l, p) => {
                      const d = p?.[0]?.payload;
                      return d ? `${d.dayName} ${d.label}` : _l;
                    }}
                    formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                  />
                  <Area type="monotone" dataKey="arrivals" name="Arrivals" stroke="#39BDF8" strokeWidth={1.5} fill="#39BDF8" fillOpacity={0.06} dot={false} />
                  <Bar dataKey="arrivals" name="Arrivals" radius={[3, 3, 0, 0]} maxBarSize={18} fillOpacity={0.75}>
                    {chartData.map((entry, i) => {
                      const avg = stats?.avgArrivals || 1;
                      let fill = "#39BDF8";
                      if (entry.arrivals > avg * 1.15) fill = "#ef4444";
                      else if (entry.arrivals > avg * 1.05) fill = "#f59e0b";
                      else if (entry.arrivals < avg * 0.85) fill = "#10b981";
                      return <Cell key={i} fill={fill} />;
                    })}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#6b7280]">
                <Plane className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-[13px]">No flight data cached</p>
                <p className="text-[11px]">Click "Refresh Flight Data" above to fetch from AeroDataBox</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TWO-COLUMN: Hot Dates + Quiet Dates ── */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Hot Dates */}
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-[#ef4444]" />
                <h2 className="text-[14px] font-medium text-[#e5e5e5]">Peak Demand Dates</h2>
              </div>
              <div className="space-y-1">
                {stats.hotDates.map((d, i) => (
                  <DateRow key={i} d={d} rank={i + 1} type="hot" currencySymbol={currencySymbol} hasFlights={stats.hasFlights} />
                ))}
              </div>
            </div>

            {/* Quiet Dates */}
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Snowflake className="w-4 h-4 text-[#3b82f6]" />
                <h2 className="text-[14px] font-medium text-[#e5e5e5]">Low Demand Dates</h2>
              </div>
              <div className="space-y-1">
                {stats.quietDates.map((d, i) => (
                  <DateRow key={i} d={d} rank={i + 1} type="quiet" currencySymbol={currencySymbol} hasFlights={stats.hasFlights} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PRICING PRESSURE CHART ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-6">
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-[#e5e5e5]">Pricing Pressure</h2>
            <p className="text-[11px] text-[#6b7280] mt-0.5">
              Market weighted average price (line) with 7-day price change (bars) — rising WAP + positive change = pricing power
            </p>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                <CartesianGrid {...gridProps} />
                <XAxis {...xProps} />
                <YAxis yAxisId="wap" {...yProps} tickFormatter={(v) => `${currencySymbol}${v}`} />
                <YAxis yAxisId="change" orientation="right" {...yProps} />
                <Tooltip
                  {...tipStyle}
                  cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                  labelFormatter={(_l, p) => {
                    const d = p?.[0]?.payload;
                    return d ? `${d.dayName} ${d.label}` : _l;
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "Market WAP") return [`${currencySymbol}${value}`, name];
                    if (name === "7d Price Change") return [`${value > 0 ? "+" : ""}${currencySymbol}${value}`, name];
                    return [value, name];
                  }}
                />
                <Area yAxisId="wap" type="monotone" dataKey="wap" name="Market WAP" stroke="#e5e5e5" strokeWidth={1.5} fill="#e5e5e5" fillOpacity={0.04} dot={false} />
                <Bar yAxisId="change" dataKey="priceChange" name="7d Price Change" radius={[3, 3, 0, 0]} maxBarSize={18}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.priceChange >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.7} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── SUPPLY DYNAMICS CHART ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-6">
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-[#e5e5e5]">Supply Dynamics</h2>
            <p className="text-[11px] text-[#6b7280] mt-0.5">
              Total available properties (area) with 7-day supply change % (bars) — shrinking supply + high demand = rate opportunity
            </p>
          </div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="intel">
                <CartesianGrid {...gridProps} />
                <XAxis {...xProps} />
                <YAxis yAxisId="supply" {...yProps} />
                <YAxis yAxisId="change" orientation="right" {...yProps} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  {...tipStyle}
                  cursor={{ fill: "rgba(57, 189, 248, 0.06)" }}
                  labelFormatter={(_l, p) => {
                    const d = p?.[0]?.payload;
                    return d ? `${d.dayName} ${d.label}` : _l;
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "Supply Change") return [`${value > 0 ? "+" : ""}${value}%`, name];
                    return [value.toLocaleString(), name];
                  }}
                />
                <Area yAxisId="supply" type="monotone" dataKey="supply" name="Available Properties" stroke="#3b82f6" strokeWidth={1.5} fill="#3b82f6" fillOpacity={0.08} dot={false} />
                <Bar yAxisId="change" dataKey="supplyChange" name="Supply Change" radius={[3, 3, 0, 0]} maxBarSize={18}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.supplyChange >= 0 ? "#3b82f6" : "#8b5cf6"} fillOpacity={0.7} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[#6b7280] text-[11px] pb-4">
          Market data: Booking.com channel • Flight data: AeroDataBox • Refreshed daily at 04:00 UTC
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ label, value, sub, color, subColor }: { label: string; value: string; sub: string; color: string; subColor?: string }) {
  return (
    <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-4">
      <div className="text-[10px] text-[#6b7280] uppercase tracking-wide mb-1">{label}</div>
      <div className="text-[28px] font-semibold leading-tight" style={{ color }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: subColor || "#6b7280" }}>{sub}</div>
    </div>
  );
}

function DateRow({ d, rank, type, currencySymbol, hasFlights }: { d: any; rank: number; type: "hot" | "quiet"; currencySymbol: string; hasFlights: boolean }) {
  const accentColor = type === "hot" ? "#ef4444" : "#3b82f6";
  const bgColor = type === "hot" ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)";

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-md"
      style={{ backgroundColor: rank <= 3 ? bgColor : "transparent" }}
    >
      <span className="text-[11px] font-mono w-5 text-right" style={{ color: rank <= 3 ? accentColor : "#6b7280" }}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-[#e5e5e5]">
          {d.dayName} {d.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px]">
        <span style={{ color: d.demand >= 70 ? "#ef4444" : d.demand >= 40 ? "#f59e0b" : "#6b7280" }}>
          {d.demand}%
        </span>
        <span className="text-[#9ca3af]">{currencySymbol}{d.wap}</span>
        {hasFlights && (
          <span className="text-[#39BDF8] flex items-center gap-1">
            <Plane className="w-3 h-3" />
            {d.arrivals > 0 ? d.arrivals.toLocaleString() : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
