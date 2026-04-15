import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { R } from "../styles/tokens";
import {
  ComposedChart, LineChart, BarChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const NeighbourhoodMaps = lazy(() => import("./NeighbourhoodMaps"));

// ─── Color constants (brand palette) ───
const BLUE = R.warmTeal;
const WHITE = R.accent;
const GRAY = R.textMid;
const DIM = R.textDim;
const SURFACE = R.bg;
const BORDER = R.border;
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";
const PINK = "#ec4899";
const INPUT_BG = R.card;

// ─── Shared styles ───
const card: React.CSSProperties = {
  backgroundColor: R.darkBand,
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

// ─── Mock data for new widgets ───
const MOCK_STAR_RATINGS = [
  { label: "5 Star", count: 206, pct: 4.8, color: PURPLE },
  { label: "4 Star", count: 1667, pct: 38.5, color: BLUE },
  { label: "3 Star", count: 635, pct: 14.7, color: AMBER },
  { label: "2 Star", count: 163, pct: 3.8, color: DIM },
  { label: "Unrated", count: 1658, pct: 38.3, color: "#3a3a3a" },
];

const MOCK_PRICE_HISTOGRAM = [
  { bucket: "£0–50", count: 312 }, { bucket: "£50–75", count: 487 },
  { bucket: "£75–100", count: 623 }, { bucket: "£100–125", count: 558 },
  { bucket: "£125–150", count: 492 }, { bucket: "£150–175", count: 401 },
  { bucket: "£175–200", count: 338 }, { bucket: "£200–250", count: 412 },
  { bucket: "£250–300", count: 287 }, { bucket: "£300–400", count: 219 },
  { bucket: "£400–500", count: 112 }, { bucket: "£500+", count: 88 },
];

// Mock seasonality heatmap from real hotel ADR data (12 months, all DOW)
const MOCK_ADR_HEATMAP = [
  { month: "Jan", month_num: 1,  Sun: 112, Mon: 118, Tue: 121, Wed: 119, Thu: 124, Fri: 142, Sat: 148 },
  { month: "Feb", month_num: 2,  Sun: 108, Mon: 115, Tue: 118, Wed: 117, Thu: 122, Fri: 138, Sat: 145 },
  { month: "Mar", month_num: 3,  Sun: 119, Mon: 126, Tue: 131, Wed: 128, Thu: 135, Fri: 152, Sat: 159 },
  { month: "Apr", month_num: 4,  Sun: 128, Mon: 134, Tue: 138, Wed: 136, Thu: 143, Fri: 165, Sat: 172 },
  { month: "May", month_num: 5,  Sun: 135, Mon: 142, Tue: 146, Wed: 144, Thu: 151, Fri: 178, Sat: 186 },
  { month: "Jun", month_num: 6,  Sun: 148, Mon: 155, Tue: 159, Wed: 157, Thu: 164, Fri: 192, Sat: 201 },
  { month: "Jul", month_num: 7,  Sun: 156, Mon: 162, Tue: 165, Wed: 163, Thu: 171, Fri: 198, Sat: 212 },
  { month: "Aug", month_num: 8,  Sun: 152, Mon: 158, Tue: 161, Wed: 159, Thu: 168, Fri: 195, Sat: 208 },
  { month: "Sep", month_num: 9,  Sun: 138, Mon: 145, Tue: 149, Wed: 147, Thu: 155, Fri: 179, Sat: 188 },
  { month: "Oct", month_num: 10, Sun: 132, Mon: 139, Tue: 143, Wed: 141, Thu: 148, Fri: 168, Sat: 176 },
  { month: "Nov", month_num: 11, Sun: 122, Mon: 129, Tue: 133, Wed: 131, Thu: 138, Fri: 158, Sat: 165 },
  { month: "Dec", month_num: 12, Sun: 142, Mon: 148, Tue: 152, Wed: 150, Thu: 158, Fri: 182, Sat: 195 },
];

const AVAILABLE_CITIES = [
  { slug: "london", label: "London", scrapes: 170 },
  { slug: "las-vegas", label: "Las Vegas", scrapes: 62 },
  { slug: "mykonos", label: "Mykonos", scrapes: 14 },
  { slug: "archanes", label: "Archanes", scrapes: 1 },
];

export function MarketProfile() {
  const [city, setCity] = useState("london");

  // ─── State ───
  const [overview, setOverview] = useState<any>(null);
  const [seasonal, setSeasonal] = useState<any[]>([]);
  const [absorptionDow, setAbsorptionDow] = useState<any[]>([]);
  const [priceMovement, setPriceMovement] = useState<any[]>([]);
  const [compression, setCompression] = useState<any[]>([]);
  const [neighbourhoods, setNeighbourhoods] = useState<any[]>([]);
  const [areaIntel, setAreaIntel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch all data in parallel ───
  useEffect(() => {
    const base = `/api/market/profile`;
    setLoading(true);
    Promise.all([
      fetch(`${base}/overview?city=${city}`).then((r) => r.json()),
      fetch(`${base}/seasonal?city=${city}`).then((r) => r.json()),
      fetch(`${base}/absorption-dow?city=${city}`).then((r) => r.json()),
      fetch(`${base}/price-movement?city=${city}`).then((r) => r.json()),
      fetch(`${base}/compression?city=${city}`).then((r) => r.json()),
      fetch(`${base}/neighbourhoods?city=${city}`).then((r) => r.json()),
      fetch(`${base}/neighbourhood-intel?city=${city}`).then((r) => r.json()),
    ])
      .then(([ov, sea, absDow, pm, comp, neigh, intel]) => {
        setOverview(ov);
        setSeasonal(Array.isArray(sea) ? sea : []);
        setAbsorptionDow(Array.isArray(absDow) ? absDow : []);
        setPriceMovement(Array.isArray(pm) ? pm : []);
        setCompression(Array.isArray(comp) ? comp : []);
        setNeighbourhoods(Array.isArray(neigh) ? neigh : []);
        setAreaIntel(Array.isArray(intel) ? intel : []);
      })
      .catch((err) => console.error("MarketProfile fetch error:", err))
      .finally(() => setLoading(false));
  }, [city]);

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
      if (!byLeadTime[key]) byLeadTime[key] = { days_out: key, _sort: Number(row.days_out) };
      byLeadTime[key][row.dow.trim()] = Number(row.pct_remaining);
    });
    return Object.values(byLeadTime).sort((a: any, b: any) => a._sort - b._sort);
  }, [absorptionDow]);

  // Price movement
  const priceChartData = useMemo(() => {
    return priceMovement.map((r) => ({
      days_out: `${r.days_out}d`,
      _sort: Number(r.days_out),
      wap: Number(r.avg_wap),
      supply: Number(r.avg_supply),
    })).sort((a, b) => a._sort - b._sort);
  }, [priceMovement]);

  // Compression
  const compressionData = useMemo(() => {
    return compression.map((r, i) => ({
      date: i % 7 === 0 ? new Date(r.checkin_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
      wap: Number(r.wap),
      spread: Number(r.price_spread),
      supply: Number(r.supply),
    }));
  }, [compression]);

  // Area intel: build chart data from top 8 areas' absorption curves
  const AREA_COLORS = [BLUE, RED, AMBER, GREEN, PURPLE, PINK, "#3b82f6", "#f97316"];
  const areaTop8 = useMemo(() => areaIntel.slice(0, 8), [areaIntel]);
  const areaChartData = useMemo(() => {
    if (!areaTop8.length) return [];
    const buckets = [90, 60, 30, 14, 7, 3];
    return buckets.map((b) => {
      const point: any = { days_out: `${b}d`, _sort: b };
      areaTop8.forEach((area) => {
        const match = area.curve?.find((c: any) => c.days_out === b);
        point[area.neighbourhood] = match ? match.pct_remaining : null;
      });
      return point;
    });
  }, [areaTop8]);

  // Currency — detect from city
  const curr = city === "las-vegas" ? "$" : city === "archanes" ? "E" : "£";

  if (loading) {
    return (
      <div style={{ flex: 1, background: R.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: GRAY }}>
          <div className="w-12 h-12 border-4 border-[#38C6BA] border-t-transparent border-solid rounded-full animate-spin" style={{ margin: "0 auto 20px" }} />
          Loading Market Profile...
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent }}>
      <div style={{ padding: "24px 28px" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ color: WHITE, fontSize: "24px", margin: 0, marginBottom: "4px" }}>
              Market Profile — {AVAILABLE_CITIES.find(c => c.slug === city)?.label || city}
            </h1>
            <p style={{ color: GRAY, fontSize: "12px", margin: 0 }}>City-wide market structure, pricing dynamics, and booking behaviour derived from daily OTA intelligence</p>
          </div>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={{
              backgroundColor: INPUT_BG, color: WHITE, border: `1px solid ${BORDER}`,
              borderRadius: "6px", padding: "8px 12px", fontSize: "13px", cursor: "pointer",
              outline: "none", minWidth: "160px",
            }}
          >
            {AVAILABLE_CITIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label} ({c.scrapes}d)</option>
            ))}
          </select>
        </div>


        {/* ─── ROW 1: City KPIs (scrape-sourced market structure) ─── */}
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

        {/* ─── AREA DEMAND INTELLIGENCE (absorption curves + ranked table) ─── */}
        {areaIntel.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>AREA DEMAND INTELLIGENCE</div>
              <h3 style={sectionTitle}>Search Demand by Neighbourhood</h3>
              <p style={sectionSub}>Same-date booking absorption across all accommodation types — steeper drop = higher converting search demand</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr" }}>
              {/* Left: Absorption curves */}
              <div style={{ padding: "16px 20px", borderRight: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                  Supply remaining (%) as stay date approaches — 90 days out to 3 days out
                </div>
                <div style={{ height: "320px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={areaChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                      <XAxis dataKey="days_out" stroke={DIM} fontSize={10} tickLine={false} />
                      <YAxis stroke={DIM} fontSize={10} tickLine={false} domain={[80, 102]} unit="%" />
                      <Tooltip
                        contentStyle={{ backgroundColor: "rgba(26,26,26,0.95)", border: `1px solid ${BORDER}`, borderRadius: "4px", padding: "8px" }}
                        labelStyle={{ color: GRAY, fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px" }}
                        formatter={(val: any) => val != null ? `${val}%` : "—"}
                      />
                      {areaTop8.map((area, i) => (
                        <Line
                          key={area.neighbourhood}
                          type="monotone"
                          dataKey={area.neighbourhood}
                          stroke={AREA_COLORS[i]}
                          strokeWidth={i < 3 ? 2.5 : 1.5}
                          dot={i < 3 ? { r: 3 } : false}
                          connectNulls
                          name={area.neighbourhood}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Ranked table */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "grid", gridTemplateColumns: "14px 1fr 48px 48px 42px 1fr", gap: "5px", padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, backgroundColor: SURFACE, alignItems: "center" }}>
                  <span />
                  {["Area", "Supply", "Booked", "Abs %", "Demand Score"].map((h) => (
                    <span key={h} style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {areaIntel.slice(0, 15).map((row: any, i: number) => {
                    const score = row.demand_score || 0;
                    const scoreColor = score >= 80 ? RED : score >= 55 ? AMBER : score >= 30 ? BLUE : DIM;
                    const scoreLabel = score >= 80 ? "Hot" : score >= 55 ? "Warm" : score >= 30 ? "Active" : "Cool";
                    return (
                      <div key={row.neighbourhood} style={{
                        display: "grid", gridTemplateColumns: "14px 1fr 48px 48px 42px 1fr", gap: "5px",
                        padding: "8px 16px", borderBottom: i < 14 ? `1px solid ${BORDER}` : "none", alignItems: "center",
                      }}>
                        {i < 8 ? (
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: AREA_COLORS[i] }} />
                        ) : <span />}
                        <span style={{ fontSize: "12px", color: WHITE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.neighbourhood}</span>
                        <span style={{ fontSize: "11px", color: GRAY }}>{row.avg_supply}</span>
                        <span style={{ fontSize: "11px", color: BLUE }}>{row.rooms_absorbed ?? "—"}</span>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: scoreColor }}>{row.pct_absorbed}%</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ flex: 1, height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${score}%`, height: "100%", backgroundColor: scoreColor, borderRadius: "3px", transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: "9px", color: scoreColor, fontWeight: 600, minWidth: "30px" }}>{scoreLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* ─── ROW 2: Accommodation Map (full-width hero) ─── */}
        <div style={{ marginBottom: "24px" }}>
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>ACCOMMODATION SUPPLY</div>
              <h3 style={sectionTitle}>Property Map</h3>
              <p style={sectionSub}>Every hotel, hostel, guest house, apartment and motel from OpenStreetMap</p>
            </div>
            <div style={{ height: "380px" }}>
              <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: GRAY, fontSize: "12px" }}>Loading map...</div>}>
                <NeighbourhoodMaps citySlug={city} />
              </Suspense>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={R.border} />
                  <XAxis dataKey="days_out" stroke={R.textDim} fontSize={10} tickLine={false} />
                  <YAxis stroke={R.textDim} fontSize={10} tickLine={false} domain={[60, 110]} unit="%" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke={R.border} />
                  <XAxis dataKey="days_out" stroke={R.textDim} fontSize={10} tickLine={false} />
                  <YAxis yAxisId="left" stroke={R.textDim} fontSize={10} tickLine={false} unit={curr} />
                  <YAxis yAxisId="right" orientation="right" stroke={R.textDim} fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar yAxisId="right" dataKey="supply" fill={BLUE} fillOpacity={0.2} radius={[4, 4, 0, 0]} name="Supply" />
                  <Line yAxisId="left" type="monotone" dataKey="wap" stroke={AMBER} strokeWidth={2.5} dot={{ r: 4 }} name={`WAP (${curr})`} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ─── ROW 4: Price Distribution Histogram (mock data) ─── */}
        <div style={{ marginBottom: "24px" }}>
          <div style={card}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={sectionLabel}>PRICE DISTRIBUTION</div>
              <h3 style={sectionTitle}>Price Bracket Distribution</h3>
              <p style={sectionSub}>Number of available properties by price bracket — shows where supply is concentrated and where there's pricing headroom</p>
            </div>
            <div style={{ padding: "16px 20px", height: "260px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_PRICE_HISTOGRAM} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={R.border} vertical={false} />
                  <XAxis dataKey="bucket" stroke={R.textDim} fontSize={10} tickLine={false} interval={0} angle={-35} textAnchor="end" height={50} />
                  <YAxis stroke={R.textDim} fontSize={10} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" name="Properties" radius={[4, 4, 0, 0]}>
                    {MOCK_PRICE_HISTOGRAM.map((_, i) => (
                      <Cell key={i} fill={BLUE} fillOpacity={0.15 + (i < 6 ? (6 - i) * 0.12 : 0.05)} />
                    ))}
                  </Bar>
                </BarChart>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={R.border} />
                  <XAxis dataKey="date" stroke={R.textDim} fontSize={9} tickLine={false} />
                  <YAxis yAxisId="left" stroke={R.textDim} fontSize={10} tickLine={false} unit={curr} />
                  <YAxis yAxisId="right" orientation="right" stroke={R.textDim} fontSize={10} tickLine={false} />
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

        {/* ─── ROW 6: Market Structure (compact — Property Types + Star Rating) ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          {/* Property types — compact horizontal bars */}
          <div style={cardPad}>
            <div style={sectionLabel}>MARKET COMPOSITION</div>
            <h3 style={sectionTitle}>Property Types</h3>
            <p style={sectionSub}>{totalProps.toLocaleString()} total listed properties</p>
            <div style={{ marginTop: "14px" }}>
              {propertyTypes.length === 0 ? (
                <div style={{ padding: "18px 0", color: DIM, fontSize: "12px", textAlign: "center" }}>
                  Insufficient diversity in this market — city-level supply too thin for a meaningful breakdown.
                </div>
              ) : propertyTypes.map((t) => {
                const pct = ((t.count / totalProps) * 100).toFixed(1);
                return (
                  <div key={t.type} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: t.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: GRAY, flex: 1 }}>{t.type}</span>
                    <span style={{ fontSize: "12px", color: WHITE, fontWeight: 500, width: "46px", textAlign: "right" }}>{t.count}</span>
                    <div style={{ width: "80px", height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: t.color, borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "10px", color: DIM, width: "32px", textAlign: "right" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Star Rating Breakdown — compact */}
          <div style={cardPad}>
            <div style={sectionLabel}>SUPPLY COMPOSITION</div>
            <h3 style={sectionTitle}>Star Rating Breakdown</h3>
            <p style={sectionSub}>Distribution by hotel classification</p>
            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {MOCK_STAR_RATINGS.map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", color: WHITE }}>{s.label}</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
                      <span style={{ fontSize: "12px", color: WHITE, fontWeight: 500 }}>{s.count.toLocaleString()}</span>
                      <span style={{ fontSize: "10px", color: DIM }}>{s.pct}%</span>
                    </div>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${s.pct}%`, height: "100%", backgroundColor: s.color, borderRadius: "3px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── ROW 7: ADR Seasonality Heatmap (mock data — will use daily_metrics_snapshots) ─── */}
        <div style={{ marginBottom: "24px" }}>
          <div style={cardPad}>
            <div style={sectionLabel}>SEASONALITY</div>
            <h3 style={sectionTitle}>ADR Heatmap — Month x Day of Week</h3>
            <p style={sectionSub}>Average daily rate from Market Pulse hotels with 12+ months history — {MOCK_ADR_HEATMAP.length} months shown</p>
            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
                <div />
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} style={{ fontSize: "9px", color: DIM, textAlign: "center", textTransform: "uppercase" }}>{d}</div>
                ))}
              </div>
              {MOCK_ADR_HEATMAP.map((row) => {
                const vals = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (row as any)[d] as number);
                const allVals = MOCK_ADR_HEATMAP.flatMap((r) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (r as any)[d] as number));
                const hMin = Math.min(...allVals);
                const hMax = Math.max(...allVals);
                return (
                  <div key={row.month} style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
                    <div style={{ fontSize: "11px", color: GRAY, display: "flex", alignItems: "center" }}>{row.month}</div>
                    {vals.map((v, i) => {
                      const heat = getHeatColor(v, hMin, hMax);
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

      </div>
    </div>
  );
}
