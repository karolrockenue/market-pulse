import { useState, useEffect, useMemo } from "react";
import {
  ComposedChart, LineChart, BarChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── Color constants (brand palette) ───
const BLUE = "#39BDF8";
const WHITE = "#e5e5e5";
const GRAY = "#9ca3af";
const DIM = "#6b7280";
const SURFACE = "#1d1d1c";
const BORDER = "#2a2a2a";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";
const PINK = "#ec4899";
const INPUT_BG = "#2C2C2C";

// ─── Shared styles ───
const card: React.CSSProperties = {
  backgroundColor: "rgb(26, 26, 26)",
  borderRadius: "8px",
  border: `1px solid ${BORDER}`,
  overflow: "hidden",
};
const cardPad: React.CSSProperties = { ...card, padding: "20px" };
const sectionLabel: React.CSSProperties = { color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" };
const sectionTitle: React.CSSProperties = { color: WHITE, fontSize: "16px", fontWeight: 600, margin: 0, marginBottom: "2px" };
const sectionSub: React.CSSProperties = { color: GRAY, fontSize: "11px", margin: 0 };
const tooltipStyle = {
  contentStyle: { backgroundColor: "rgba(26,26,26,0.95)", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "8px" },
  labelStyle: { color: GRAY, fontSize: "10px" },
  itemStyle: { fontSize: "11px", color: WHITE },
};

// Color helpers
const TYPE_COLORS: Record<string, string> = {
  Hotels: BLUE, Apartments: PURPLE, Hostels: AMBER, "Guest houses": GREEN,
  "Bed and breakfasts": PINK, "Holiday homes": DIM, Homestays: "#6366f1",
  "Aparthotels": "#14b8a6", Motels: "#f43f5e",
};
const getTypeColor = (type: string) => TYPE_COLORS[type] || DIM;
const getHeatColor = (val: number, min: number, max: number) => {
  const pct = (val - min) / (max - min);
  if (pct >= 0.85) return { bg: "rgba(239,68,68,0.25)", text: RED };
  if (pct >= 0.65) return { bg: "rgba(245,158,11,0.2)", text: AMBER };
  if (pct >= 0.4) return { bg: "rgba(57,189,248,0.12)", text: BLUE };
  return { bg: "rgba(16,185,129,0.12)", text: GREEN };
};

const DOW_COLORS: Record<string, string> = {
  Saturday: RED, Friday: AMBER, Thursday: PURPLE, Wednesday: BLUE,
  Tuesday: GREEN, Monday: GRAY, Sunday: DIM,
};

export function MarketProfile() {
  const city = "london"; // TODO: make dynamic via prop/selector

  // ─── State ───
  const [overview, setOverview] = useState<any>(null);
  const [seasonal, setSeasonal] = useState<any[]>([]);
  const [absorptionDow, setAbsorptionDow] = useState<any[]>([]);
  const [priceMovement, setPriceMovement] = useState<any[]>([]);
  const [absorptionDate, setAbsorptionDate] = useState<any[]>([]);
  const [compression, setCompression] = useState<any[]>([]);
  const [neighbourhoods, setNeighbourhoods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pick a recent Saturday for single-date absorption
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7) + 7); // next Saturday + 1 week
    return d.toISOString().split("T")[0];
  }, []);

  // ─── Fetch all data in parallel ───
  useEffect(() => {
    const base = `/api/market/profile`;
    setLoading(true);
    Promise.all([
      fetch(`${base}/overview?city=${city}`).then((r) => r.json()),
      fetch(`${base}/seasonal?city=${city}`).then((r) => r.json()),
      fetch(`${base}/absorption-dow?city=${city}`).then((r) => r.json()),
      fetch(`${base}/price-movement?city=${city}`).then((r) => r.json()),
      fetch(`${base}/absorption-date?city=${city}&date=${targetDate}`).then((r) => r.json()),
      fetch(`${base}/compression?city=${city}`).then((r) => r.json()),
      fetch(`${base}/neighbourhoods?city=${city}`).then((r) => r.json()),
    ])
      .then(([ov, sea, absDow, pm, absDate, comp, neigh]) => {
        setOverview(ov);
        setSeasonal(Array.isArray(sea) ? sea : []);
        setAbsorptionDow(Array.isArray(absDow) ? absDow : []);
        setPriceMovement(Array.isArray(pm) ? pm : []);
        setAbsorptionDate(Array.isArray(absDate) ? absDate : []);
        setCompression(Array.isArray(comp) ? comp : []);
        setNeighbourhoods(Array.isArray(neigh) ? neigh : []);
      })
      .catch((err) => console.error("MarketProfile fetch error:", err))
      .finally(() => setLoading(false));
  }, [city, targetDate]);

  // ─── Transform data for charts ───

  // Property types from overview
  const propertyTypes = useMemo(() => {
    if (!overview?.propertyTypes) return [];
    return Object.entries(overview.propertyTypes)
      .map(([type, count]) => ({ type, count: Number(count), color: getTypeColor(type) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [overview]);
  const totalProps = propertyTypes.reduce((s, t) => s + t.count, 0);

  // KPIs
  const kpis = overview?.kpis || {};
  const weekendPremium = kpis.weekday_wap && kpis.weekend_wap
    ? Math.round(((kpis.weekend_wap - kpis.weekday_wap) / kpis.weekday_wap) * 100)
    : null;

  // Seasonal heatmap: pivot rows into month objects
  const seasonalHeatmap = useMemo(() => {
    if (!seasonal.length) return [];
    const months: Record<string, any> = {};
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    seasonal.forEach((row) => {
      if (!months[row.month]) months[row.month] = { month: row.month, month_num: row.month_num };
      months[row.month][dows[row.dow_num]] = Number(row.avg_wap);
    });
    return Object.values(months).sort((a: any, b: any) => a.month_num - b.month_num);
  }, [seasonal]);

  // All WAP values for heatmap color range
  const allWaps = useMemo(() => {
    return seasonalHeatmap.flatMap((m: any) =>
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => m[d]).filter(Boolean)
    );
  }, [seasonalHeatmap]);
  const wapMin = Math.min(...(allWaps.length ? allWaps : [0]));
  const wapMax = Math.max(...(allWaps.length ? allWaps : [100]));

  // Peak/cheapest from seasonal
  const peakEntry = useMemo(() => {
    if (!seasonal.length) return null;
    return seasonal.reduce((best, r) => (Number(r.avg_wap) > Number(best.avg_wap) ? r : best), seasonal[0]);
  }, [seasonal]);
  const cheapEntry = useMemo(() => {
    if (!seasonal.length) return null;
    return seasonal.reduce((best, r) => (Number(r.avg_wap) < Number(best.avg_wap) ? r : best), seasonal[0]);
  }, [seasonal]);

  // DOW absorption: pivot into chart-friendly format
  const dowChartData = useMemo(() => {
    if (!absorptionDow.length) return [];
    const byLeadTime: Record<string, any> = {};
    absorptionDow.forEach((row) => {
      const key = `${row.days_out}d`;
      if (!byLeadTime[key]) byLeadTime[key] = { days_out: key };
      byLeadTime[key][row.dow.trim()] = Number(row.pct_remaining);
    });
    return Object.values(byLeadTime);
  }, [absorptionDow]);

  // Price movement
  const priceChartData = useMemo(() => {
    return priceMovement.map((r) => ({
      days_out: `${r.days_out}d`,
      wap: Number(r.avg_wap),
      supply: Number(r.avg_supply),
    }));
  }, [priceMovement]);

  // Single date absorption
  const absorptionCurve = useMemo(() => {
    return absorptionDate.map((r) => ({
      label: `${r.days_out}d`,
      days: Number(r.days_out),
      supply: Number(r.total_results),
      wap: Number(r.weighted_avg_price),
      five: Number(r.facet_star_rating?.["5 stars"] || 0),
      four: Number(r.facet_star_rating?.["4 stars"] || 0),
      three: Number(r.facet_star_rating?.["3 stars"] || 0),
      two: Number(r.facet_star_rating?.["2 stars"] || 0),
    }));
  }, [absorptionDate]);

  // Star rating: sample every ~10th point for a cleaner stacked bar
  const starRatingData = useMemo(() => {
    if (!absorptionCurve.length) return [];
    const step = Math.max(1, Math.floor(absorptionCurve.length / 12));
    return absorptionCurve.filter((_, i) => i % step === 0 || i === absorptionCurve.length - 1);
  }, [absorptionCurve]);

  // Compression
  const compressionData = useMemo(() => {
    return compression.map((r, i) => ({
      date: i % 7 === 0 ? new Date(r.checkin_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
      wap: Number(r.wap),
      spread: Number(r.price_spread),
      supply: Number(r.supply),
    }));
  }, [compression]);

  // Currency — detect from city
  const curr = city === "las-vegas" ? "$" : city === "archanes" ? "E" : "£";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#1d1d1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: GRAY }}>
          <div className="w-12 h-12 border-4 border-[#39BDF8] border-t-transparent border-solid rounded-full animate-spin" style={{ margin: "0 auto 20px" }} />
          Loading Market Profile...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1d1d1c", position: "relative", overflow: "hidden" }}>
      {/* Background */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ color: WHITE, fontSize: "24px", margin: 0, marginBottom: "4px" }}>
            Market Profile — {city.charAt(0).toUpperCase() + city.slice(1)}
          </h1>
          <p style={{ color: GRAY, fontSize: "12px", margin: 0 }}>City-wide market structure, pricing dynamics, and booking behaviour derived from daily OTA intelligence</p>
        </div>

        {/* ─── ROW 1: City KPIs ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: "Total Listed Properties", value: kpis.avg_supply ? Math.round(kpis.avg_supply).toLocaleString() : "--", color: WHITE },
            { label: "Hotels Only", value: overview?.propertyTypes?.Hotels || "--", color: BLUE },
            { label: "Avg Market WAP", value: kpis.avg_wap ? `${curr}${Math.round(kpis.avg_wap)}` : "--", color: BLUE },
            { label: "Weekend Premium", value: weekendPremium != null ? `+${weekendPremium}%` : "--", color: GREEN },
            { label: "Peak WAP", value: peakEntry ? `${curr}${Math.round(peakEntry.avg_wap)}` : "--", sub: peakEntry ? `${peakEntry.month} ${peakEntry.dow}` : "", color: RED },
            { label: "Cheapest WAP", value: cheapEntry ? `${curr}${Math.round(cheapEntry.avg_wap)}` : "--", sub: cheapEntry ? `${cheapEntry.month} ${cheapEntry.dow}` : "", color: GREEN },
          ].map((k) => (
            <div key={k.label} style={{ ...cardPad, padding: "14px 16px", textAlign: "center" }}>
              <div style={sectionLabel}>{k.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 600, color: k.color }}>{k.value}</div>
              {k.sub && <div style={{ fontSize: "10px", color: DIM, marginTop: "2px" }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* ─── ROW 2: Market Composition + Seasonal Heatmap ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "24px" }}>
          {/* Property types */}
          <div style={cardPad}>
            <div style={sectionLabel}>MARKET COMPOSITION</div>
            <h3 style={sectionTitle}>Property Types</h3>
            <p style={sectionSub}>{totalProps.toLocaleString()} total listed properties</p>
            <div style={{ marginTop: "16px" }}>
              {propertyTypes.map((t) => {
                const pct = ((t.count / totalProps) * 100).toFixed(1);
                return (
                  <div key={t.type} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: t.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: GRAY, flex: 1 }}>{t.type}</span>
                    <span style={{ fontSize: "12px", color: WHITE, fontWeight: 500, width: "50px", textAlign: "right" }}>{t.count}</span>
                    <div style={{ width: "80px", height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: t.color, borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "10px", color: DIM, width: "36px", textAlign: "right" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seasonal heatmap */}
          <div style={cardPad}>
            <div style={sectionLabel}>SEASONAL PRICING</div>
            <h3 style={sectionTitle}>WAP Heatmap — Month x Day of Week</h3>
            <p style={sectionSub}>Weighted average price at ~30 days lead time</p>
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
                <div />
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} style={{ fontSize: "9px", color: DIM, textAlign: "center", textTransform: "uppercase" }}>{d}</div>
                ))}
              </div>
              {seasonalHeatmap.map((row: any) => {
                const vals = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => row[d]);
                return (
                  <div key={row.month} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", color: GRAY, display: "flex", alignItems: "center" }}>{row.month}</div>
                    {vals.map((v: number, i: number) => {
                      if (!v) return <div key={i} style={{ backgroundColor: "#141414", borderRadius: "4px", padding: "8px 4px", textAlign: "center" }}><span style={{ fontSize: "11px", color: "#333" }}>--</span></div>;
                      const heat = getHeatColor(v, wapMin, wapMax);
                      return (
                        <div key={i} style={{ backgroundColor: heat.bg, borderRadius: "4px", padding: "8px 4px", textAlign: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: 500, color: heat.text }}>{curr}{v}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── ROW 3: DOW Absorption + Price Movement ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "16px", marginBottom: "24px" }}>
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>BOOKING VELOCITY</div>
              <h3 style={sectionTitle}>Supply Remaining by Day of Week</h3>
              <p style={sectionSub}>% of original supply still available at each lead time</p>
            </div>
            <div style={{ padding: "16px 20px", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dowChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="days_out" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} domain={[60, 110]} unit="%" />
                  <Tooltip {...tooltipStyle} />
                  {Object.entries(DOW_COLORS).map(([dow, color]) => (
                    <Line key={dow} type="monotone" dataKey={dow} stroke={color}
                      strokeWidth={dow === "Saturday" || dow === "Friday" ? 2.5 : 1.5}
                      dot={dow === "Saturday" || dow === "Friday" ? { r: 3 } : false}
                      strokeDasharray={dow === "Sunday" ? "4 4" : undefined}
                      name={dow} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>PRICE DYNAMICS</div>
              <h3 style={sectionTitle}>WAP & Supply vs Lead Time</h3>
              <p style={sectionSub}>Saturdays — pricing and supply as the date approaches</p>
            </div>
            <div style={{ padding: "16px 20px", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={priceChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="days_out" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={10} tickLine={false} unit={curr} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar yAxisId="right" dataKey="supply" fill={BLUE} fillOpacity={0.2} radius={[4, 4, 0, 0]} name="Supply" />
                  <Line yAxisId="left" type="monotone" dataKey="wap" stroke={AMBER} strokeWidth={2.5} dot={{ r: 4 }} name={`WAP (${curr})`} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ─── ROW 4: Single-Date Absorption + Star Ratings ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "16px", marginBottom: "24px" }}>
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>ABSORPTION CURVE</div>
              <h3 style={sectionTitle}>{new Date(targetDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
              <p style={sectionSub}>Supply and pricing from first scrape to arrival</p>
            </div>
            <div style={{ padding: "16px 20px", height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={absorptionCurve} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={9} tickLine={false} interval={Math.max(1, Math.floor(absorptionCurve.length / 15))} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={10} tickLine={false} unit={curr} />
                  <Tooltip {...tooltipStyle} />
                  <Area yAxisId="left" type="monotone" dataKey="supply" stroke={BLUE} strokeWidth={2} fill={BLUE} fillOpacity={0.1} name="Supply" />
                  <Line yAxisId="right" type="monotone" dataKey="wap" stroke={AMBER} strokeWidth={2} dot={false} name={`WAP (${curr})`} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>SUPPLY COMPOSITION</div>
              <h3 style={sectionTitle}>Star Rating Distribution Over Time</h3>
              <p style={sectionSub}>How the mix changes as the date approaches</p>
            </div>
            <div style={{ padding: "16px 20px", height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={starRatingData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="label" stroke="#6b7280" fontSize={9} tickLine={false} />
                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="two" stackId="stars" fill={DIM} name="2 Star" />
                  <Bar dataKey="three" stackId="stars" fill={AMBER} name="3 Star" />
                  <Bar dataKey="four" stackId="stars" fill={BLUE} name="4 Star" />
                  <Bar dataKey="five" stackId="stars" fill={PURPLE} name="5 Star" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ─── ROW 5: Compression + Neighbourhoods ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "16px", marginBottom: "24px" }}>
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>MARKET COMPRESSION</div>
              <h3 style={sectionTitle}>Price Spread & WAP — 90 Day Forward</h3>
              <p style={sectionSub}>Narrow spread = compressed market (uniform pricing). Wide = diverse/soft.</p>
            </div>
            <div style={{ padding: "16px 20px", height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={compressionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={9} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={10} tickLine={false} unit={curr} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area yAxisId="right" type="monotone" dataKey="spread" stroke={PURPLE} strokeWidth={1.5} fill={PURPLE} fillOpacity={0.08} name={`Price Spread (${curr})`} />
                  <Line yAxisId="left" type="monotone" dataKey="wap" stroke={BLUE} strokeWidth={2} dot={false} name={`WAP (${curr})`} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>NEIGHBOURHOOD DEMAND</div>
              <h3 style={sectionTitle}>Which Areas Sell Out Fastest</h3>
              <p style={sectionSub}>Supply at 30 days vs 7 days — higher absorption = hotter area</p>
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 1fr", padding: "10px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
                {["Area", "30d Out", "7d Out", "Absorbed"].map((h) => (
                  <span key={h} style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
                ))}
              </div>
              {neighbourhoods.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: DIM, fontSize: "12px" }}>Insufficient data — need 30+ days of scrapes</div>
              ) : neighbourhoods.map((row: any, i: number) => {
                const abs = Number(row.pct_absorbed) || 0;
                const absColor = abs >= 8 ? RED : abs >= 4 ? AMBER : abs >= 2 ? BLUE : DIM;
                return (
                  <div key={row.neighbourhood} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 1fr", padding: "10px 20px", borderBottom: i < neighbourhoods.length - 1 ? `1px solid ${BORDER}` : "none", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: WHITE }}>{row.neighbourhood}</span>
                    <span style={{ fontSize: "12px", color: GRAY }}>{row.supply_30d || "--"}</span>
                    <span style={{ fontSize: "12px", color: GRAY }}>{row.supply_7d || "--"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "50px", height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(abs * 8, 100)}%`, height: "100%", backgroundColor: absColor, borderRadius: "3px" }} />
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: absColor }}>{abs}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
