import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Flame,
  Snowflake,
  TrendingUp,
  TrendingDown,
  ChevronRight,
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

// ── Palette ──
const BLUE = "#39BDF8";
const WHITE = "#e5e5e5";
const GRAY = "#9ca3af";
const DIM = "#6b7280";
const BORDER = "#2a2a2a";
const SURFACE = "#1A1A1A";
const RED = "#ef4444";
const ORANGE = "#f97316";
const AMBER = "#f59e0b";
const GREEN = "#10b981";
const PURPLE = "#8b5cf6";

const tooltipStyle = {
  contentStyle: { backgroundColor: "rgba(26,26,26,0.95)", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "10px 14px" },
  labelStyle: { color: GRAY, fontSize: "11px", marginBottom: "4px" },
  itemStyle: { fontSize: "12px", color: WHITE, padding: "1px 0" },
};

interface DemandRadarProps {
  allHotels: any[];
}

export function DemandRadarView({ allHotels }: DemandRadarProps) {
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
  const curr = currencyCode === "GBP" ? "\u00A3" : currencyCode === "EUR" ? "\u20AC" : "$";

  const [pacePeriod, setPacePeriod] = useState("7");

  // ── Data state ──
  const [marketData, setMarketData] = useState<any[]>([]);
  const [paceData, setPaceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch market + pace
  useEffect(() => {
    if (!citySlug) return;
    setIsLoading(true);
    Promise.all([
      fetch(`/api/market/forward-view?city=${citySlug}`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/market/pace?city=${citySlug}&period=${pacePeriod}`).then((r) => r.ok ? r.json() : []),
    ])
      .then(([market, pace]) => { setMarketData(market); setPaceData(pace); })
      .catch((err) => console.error("Fetch error:", err))
      .finally(() => setIsLoading(false));
  }, [citySlug, pacePeriod]);

  // ── Process data ──
  const days = useMemo(() => {
    const norm = (s: string) => new Date(s).toISOString().split("T")[0];
    const paceMap = new Map(paceData.map((p) => [norm(p.checkin_date), p]));

    return marketData.slice(0, 90).map((item, idx) => {
      const d = new Date(item.checkin_date);
      const dateKey = norm(item.checkin_date);
      const pace = paceMap.get(dateKey);
      return {
        idx,
        dateKey,
        date: d,
        label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        xLabel: idx % 7 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        dow: d.getDay(),
        weekNum: Math.floor(idx / 7),
        demand: Math.round(item.market_demand_score || 0),
        supply: item.total_results || 0,
        wap: Math.round(item.weighted_avg_price || 0),
        mpss: Math.round(item.mpss || 0),
        priceChange: Math.round(pace?.wap_delta || 0),
        supplyChange: parseFloat((pace?.total_results_percent_delta || 0).toFixed(1)),
      };
    });
  }, [marketData, paceData]);

  // ── Aggregations ──
  const stats = useMemo(() => {
    if (!days.length) return null;

    const avgDemand = Math.round(days.reduce((s, d) => s + d.demand, 0) / days.length);
    const avgWap = Math.round(days.reduce((s, d) => s + d.wap, 0) / days.length);
    const avgSupply = Math.round(days.reduce((s, d) => s + d.supply, 0) / days.length);
    const highDemandDays = days.filter((d) => d.demand >= 70).length;

    // Trends: first 2 weeks vs last 2 weeks
    const first14 = days.slice(0, 14);
    const last14 = days.slice(-14);
    const wapFirst = first14.reduce((s, d) => s + d.wap, 0) / first14.length;
    const wapLast = last14.reduce((s, d) => s + d.wap, 0) / last14.length;
    const wapTrend = Math.round(wapLast - wapFirst);
    const demandFirst = first14.reduce((s, d) => s + d.demand, 0) / first14.length;
    const demandLast = last14.reduce((s, d) => s + d.demand, 0) / last14.length;
    const demandTrend = Math.round(demandLast - demandFirst);

    // Top / bottom dates
    const sorted = [...days].sort((a, b) => b.demand - a.demand);

    return {
      avgDemand, avgWap, avgSupply, highDemandDays,
      wapTrend, demandTrend,
      hotDates: sorted.slice(0, 5),
      quietDates: sorted.slice(-5).reverse(),
    };
  }, [days]);

  // Weekly rollup
  const weeks = useMemo(() => {
    const map = new Map<number, typeof days>();
    for (const d of days) {
      const arr = map.get(d.weekNum) || [];
      arr.push(d);
      map.set(d.weekNum, arr);
    }
    return Array.from(map.entries())
      .map(([weekNum, daysInWeek]) => {
        const avgDemand = Math.round(daysInWeek.reduce((s, d) => s + d.demand, 0) / daysInWeek.length);
        const avgWap = Math.round(daysInWeek.reduce((s, d) => s + d.wap, 0) / daysInWeek.length);
        const avgSupply = Math.round(daysInWeek.reduce((s, d) => s + d.supply, 0) / daysInWeek.length);
        const peakDemand = Math.max(...daysInWeek.map((d) => d.demand));
        const start = daysInWeek[0].date;
        const end = daysInWeek[daysInWeek.length - 1].date;
        return {
          weekNum,
          label: `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} — ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          shortLabel: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          avgDemand,
          avgWap,
          avgSupply,
          peakDemand,
          days: daysInWeek,
        };
      })
      .sort((a, b) => a.weekNum - b.weekNum);
  }, [days]);

  const demandColor = (d: number) => {
    if (d >= 85) return RED;
    if (d >= 70) return ORANGE;
    if (d >= 40) return AMBER;
    if (d >= 20) return BLUE;
    return GREEN;
  };

  const demandBg = (d: number) => {
    if (d >= 85) return "rgba(239,68,68,0.3)";
    if (d >= 70) return "rgba(249,115,22,0.25)";
    if (d >= 40) return "rgba(245,158,11,0.2)";
    if (d >= 20) return "rgba(57,189,248,0.15)";
    return "rgba(16,185,129,0.12)";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1d1d1c] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39BDF8] animate-spin mb-3" />
        <p className="text-[#9ca3af] text-sm">Loading demand radar...</p>
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
            <h1 className="text-[22px] font-semibold text-[#e5e5e5] tracking-tight mb-1">
              Demand Radar
            </h1>
            <p className="text-[#6b7280] text-[13px]">
              90-day forward demand, pricing pressure, and supply dynamics
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cities.length > 1 && (
              <select value={citySlug} onChange={(e) => setCitySlug(e.target.value)}
                className="h-9 px-3 bg-[#2C2C2C] border border-[#2a2a2a] rounded-md text-[#e5e5e5] text-sm outline-none">
                {cities.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            )}
            <select value={pacePeriod} onChange={(e) => setPacePeriod(e.target.value)}
              className="h-9 px-3 bg-[#2C2C2C] border border-[#2a2a2a] rounded-md text-[#e5e5e5] text-sm outline-none">
              <option value="1">1d pace</option>
              <option value="3">3d pace</option>
              <option value="7">7d pace</option>
            </select>
          </div>
        </div>

        {/* ── KPI ROW ── */}
        {stats && (
          <div className="grid grid-cols-6 gap-3 mb-6">
            <Kpi label="Avg Demand" value={`${stats.avgDemand}%`}
              color={demandColor(stats.avgDemand)} />
            <Kpi label="Avg Market Rate" value={`${curr}${stats.avgWap}`}
              sub={stats.wapTrend !== 0 ? `${stats.wapTrend > 0 ? "+" : ""}${curr}${Math.abs(stats.wapTrend)} trend` : "stable"}
              color={WHITE}
              subColor={stats.wapTrend > 0 ? RED : stats.wapTrend < 0 ? GREEN : DIM} />
            <Kpi label="Avg Supply" value={stats.avgSupply.toLocaleString()}
              sub="listed properties" color={BLUE} />
            <Kpi label="High Demand Days" value={`${stats.highDemandDays}`}
              sub={`of 90 days above 70%`} color={ORANGE} />
            <Kpi label="Demand Trend" value={`${stats.demandTrend > 0 ? "+" : ""}${stats.demandTrend}pp`}
              sub="first 2wk vs last 2wk"
              color={stats.demandTrend > 0 ? RED : stats.demandTrend < 0 ? GREEN : DIM}
              icon={stats.demandTrend > 0 ? <TrendingUp className="w-4 h-4" /> : stats.demandTrend < 0 ? <TrendingDown className="w-4 h-4" /> : undefined} />
            <Kpi label="Rate Trend" value={`${stats.wapTrend > 0 ? "+" : ""}${curr}${Math.abs(stats.wapTrend)}`}
              sub="first 2wk vs last 2wk"
              color={stats.wapTrend > 0 ? RED : stats.wapTrend < 0 ? GREEN : DIM}
              icon={stats.wapTrend > 0 ? <TrendingUp className="w-4 h-4" /> : stats.wapTrend < 0 ? <TrendingDown className="w-4 h-4" /> : undefined} />
          </div>
        )}

        {/* ── CALENDAR HEATMAP ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">90-Day Demand Calendar</h2>
              <p className="text-[11px] text-[#6b7280] mt-0.5">Each cell = one day, colored by demand intensity. Hover for details.</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[#6b7280]">
              <span>Low</span>
              {[GREEN, BLUE, AMBER, ORANGE, RED].map((c) => (
                <div key={c} className="w-4 h-3 rounded-sm" style={{ backgroundColor: c, opacity: 0.7 }} />
              ))}
              <span>High</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="overflow-x-auto">
            <div className="flex gap-1" style={{ minWidth: "fit-content" }}>
              {/* Day-of-week labels */}
              <div className="flex flex-col gap-1 pr-2 pt-5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="h-[32px] flex items-center text-[10px] text-[#6b7280]">{d}</div>
                ))}
              </div>

              {/* Week columns */}
              {weeks.map((week) => (
                <div key={week.weekNum} className="flex flex-col gap-1">
                  <div className="text-[9px] text-[#6b7280] text-center h-4 leading-4 whitespace-nowrap">
                    {week.shortLabel}
                  </div>
                  {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                    const day = week.days.find((d) => d.dow === dow);
                    if (!day) return <div key={dow} className="w-[32px] h-[32px]" />;
                    return (
                      <div
                        key={dow}
                        className="w-[32px] h-[32px] rounded-[4px] flex items-center justify-center text-[10px] font-medium cursor-default relative group"
                        style={{
                          backgroundColor: demandBg(day.demand),
                          color: demandColor(day.demand),
                        }}
                        title={`${day.dayName} ${day.label}: ${day.demand}% demand, ${curr}${day.wap} WAP, ${day.supply} supply`}
                      >
                        {day.demand}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN CHART: Demand + WAP ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-4">
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-[#e5e5e5]">Demand vs Market Rate</h2>
            <p className="text-[11px] text-[#6b7280] mt-0.5">
              Demand % bars with WAP line overlay — watch for demand spikes without rate response
            </p>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={days} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="radar">
                <CartesianGrid strokeDasharray="0" stroke={BORDER} opacity={0.5} />
                <XAxis dataKey="xLabel" stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} interval={6} />
                <YAxis yAxisId="demand" stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} width={40} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="wap" orientation="right" stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} width={55} tickFormatter={(v) => `${curr}${v}`} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(57,189,248,0.06)" }}
                  labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                  formatter={(value: number, name: string) => {
                    if (name === "Demand") return [`${value}%`, name];
                    if (name === "WAP") return [`${curr}${value}`, name];
                    return [value, name];
                  }} />
                <Bar yAxisId="demand" dataKey="demand" name="Demand" radius={[3, 3, 0, 0]} maxBarSize={16} fillOpacity={0.85}>
                  {days.map((d, i) => <Cell key={i} fill={demandColor(d.demand)} />)}
                </Bar>
                <Line yAxisId="wap" type="monotone" dataKey="wap" name="WAP" stroke={WHITE} strokeWidth={1.5} dot={false} strokeOpacity={0.6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── TWO-COLUMN: Price Pace + Supply Pace ── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
            <div className="mb-3">
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">{pacePeriod}d Price Change</h2>
              <p className="text-[11px] text-[#6b7280] mt-0.5">How rates shifted vs {pacePeriod} day(s) ago</p>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="radar">
                  <CartesianGrid strokeDasharray="0" stroke={BORDER} opacity={0.5} />
                  <XAxis dataKey="xLabel" stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} interval={6} />
                  <YAxis stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} width={45} tickFormatter={(v) => `${curr}${v}`} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(57,189,248,0.06)" }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                    formatter={(v: number) => [`${v > 0 ? "+" : ""}${curr}${v}`, "Price Change"]} />
                  <Bar dataKey="priceChange" name="Price Change" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {days.map((d, i) => <Cell key={i} fill={d.priceChange >= 0 ? GREEN : RED} fillOpacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
            <div className="mb-3">
              <h2 className="text-[15px] font-medium text-[#e5e5e5]">{pacePeriod}d Supply Change</h2>
              <p className="text-[11px] text-[#6b7280] mt-0.5">How inventory shifted vs {pacePeriod} day(s) ago</p>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} syncId="radar">
                  <CartesianGrid strokeDasharray="0" stroke={BORDER} opacity={0.5} />
                  <XAxis dataKey="xLabel" stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} interval={6} />
                  <YAxis stroke={BORDER} tick={{ fill: DIM, fontSize: 10 }} tickLine={{ stroke: BORDER }} axisLine={{ stroke: BORDER }} width={45} tickFormatter={(v) => `${v}%`} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(57,189,248,0.06)" }}
                    labelFormatter={(_l, p) => { const d = p?.[0]?.payload; return d ? `${d.dayName} ${d.label}` : _l; }}
                    formatter={(v: number) => [`${v > 0 ? "+" : ""}${v}%`, "Supply Change"]} />
                  <Bar dataKey="supplyChange" name="Supply Change" radius={[3, 3, 0, 0]} maxBarSize={14}>
                    {days.map((d, i) => <Cell key={i} fill={d.supplyChange >= 0 ? BLUE : PURPLE} fillOpacity={0.7} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── WEEKLY ROLLUP TABLE ── */}
        <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5 mb-4">
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-[#e5e5e5]">Weekly Snapshot</h2>
            <p className="text-[11px] text-[#6b7280] mt-0.5">Aggregated view by week — demand, rate, supply at a glance</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-[10px] text-[#6b7280] uppercase tracking-wide py-2 px-3">Week</th>
                  <th className="text-right text-[10px] text-[#6b7280] uppercase tracking-wide py-2 px-3">Avg Demand</th>
                  <th className="text-right text-[10px] text-[#6b7280] uppercase tracking-wide py-2 px-3">Peak</th>
                  <th className="text-right text-[10px] text-[#6b7280] uppercase tracking-wide py-2 px-3">Avg WAP</th>
                  <th className="text-right text-[10px] text-[#6b7280] uppercase tracking-wide py-2 px-3">Avg Supply</th>
                  <th className="text-center text-[10px] text-[#6b7280] uppercase tracking-wide py-2 px-3 w-[200px]">Daily Pattern</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.weekNum} className="border-b border-[#2a2a2a]/50 hover:bg-[rgba(57,189,248,0.03)]">
                    <td className="py-2.5 px-3 text-[#e5e5e5] whitespace-nowrap">{w.label}</td>
                    <td className="py-2.5 px-3 text-right font-medium" style={{ color: demandColor(w.avgDemand) }}>{w.avgDemand}%</td>
                    <td className="py-2.5 px-3 text-right font-medium" style={{ color: demandColor(w.peakDemand) }}>{w.peakDemand}%</td>
                    <td className="py-2.5 px-3 text-right text-[#e5e5e5]">{curr}{w.avgWap}</td>
                    <td className="py-2.5 px-3 text-right text-[#9ca3af]">{w.avgSupply.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-0.5 justify-center">
                        {w.days.map((d) => (
                          <div
                            key={d.idx}
                            className="w-[22px] h-[18px] rounded-[3px] flex items-center justify-center text-[8px] font-medium"
                            style={{ backgroundColor: demandBg(d.demand), color: demandColor(d.demand) }}
                            title={`${d.dayName}: ${d.demand}%`}
                          >
                            {d.demand}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── HOT + QUIET DATES ── */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-[#ef4444]" />
                <h2 className="text-[14px] font-medium text-[#e5e5e5]">Hottest Dates</h2>
              </div>
              <div className="space-y-0.5">
                {stats.hotDates.map((d, i) => (
                  <DateRow key={i} d={d} rank={i + 1} type="hot" curr={curr} />
                ))}
              </div>
            </div>
            <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Snowflake className="w-4 h-4 text-[#3b82f6]" />
                <h2 className="text-[14px] font-medium text-[#e5e5e5]">Quietest Dates</h2>
              </div>
              <div className="space-y-0.5">
                {stats.quietDates.map((d, i) => (
                  <DateRow key={i} d={d} rank={i + 1} type="quiet" curr={curr} />
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[#6b7280] text-[11px] pb-4">
          Market data: Booking.com · Pace: {pacePeriod}-day delta · Updated daily
        </p>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Kpi({ label, value, sub, color, subColor, icon }: {
  label: string; value: string; sub?: string; color: string; subColor?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#1A1A1A] rounded-lg border border-[#2a2a2a] p-4">
      <div className="text-[10px] text-[#6b7280] uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <div className="text-[24px] font-semibold leading-tight" style={{ color }}>{value}</div>
        {icon && <span style={{ color }}>{icon}</span>}
      </div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: subColor || "#6b7280" }}>{sub}</div>}
    </div>
  );
}

function DateRow({ d, rank, type, curr }: {
  d: any; rank: number; type: "hot" | "quiet"; curr: string;
}) {
  const accent = type === "hot" ? "#ef4444" : "#3b82f6";
  const bg = type === "hot" ? "rgba(239,68,68,0.06)" : "rgba(59,130,246,0.06)";

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-md" style={{ backgroundColor: rank <= 3 ? bg : "transparent" }}>
      <span className="text-[11px] font-mono w-5 text-right" style={{ color: rank <= 3 ? accent : "#6b7280" }}>{rank}</span>
      <span className="text-[13px] text-[#e5e5e5] flex-1">{d.dayName} {d.label}</span>
      <div className="flex items-center gap-4 text-[11px]">
        <span style={{ color: d.demand >= 70 ? "#ef4444" : d.demand >= 40 ? "#f59e0b" : "#6b7280" }}>{d.demand}%</span>
        <span className="text-[#9ca3af]">{curr}{d.wap}</span>
        <span className="text-[#6b7280]">{d.supply.toLocaleString()} props</span>
      </div>
    </div>
  );
}
