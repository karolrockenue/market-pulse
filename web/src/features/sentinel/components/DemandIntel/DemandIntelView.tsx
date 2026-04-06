import { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
  Database,
  Plane,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
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
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { toast } from "sonner";

interface DemandIntelProps {
  allHotels: any[];
}

export function DemandIntelView({ allHotels }: DemandIntelProps) {
  // Hotel selector state
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");

  // Set first hotel on mount
  useEffect(() => {
    if (allHotels.length > 0 && !selectedHotelId) {
      setSelectedHotelId(allHotels[0].hotel_id?.toString() || allHotels[0].id?.toString() || "");
    }
  }, [allHotels]);

  const selectedHotel = useMemo(() => {
    return allHotels.find(
      (h) =>
        (h.hotel_id?.toString() || h.id?.toString()) === selectedHotelId
    );
  }, [allHotels, selectedHotelId]);

  const citySlug = selectedHotel?.city || selectedHotel?.city_slug || "london";
  const currencyCode = selectedHotel?.currency_code || "GBP";
  const propertyId = selectedHotel?.hotel_id || selectedHotel?.id;

  const getCurrencySymbol = (code: string) => {
    const map: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
    return map[code] || code || "£";
  };
  const currencySymbol = getCurrencySymbol(currencyCode);

  // Pace period selector
  const [paceAnalysisPeriod, setPaceAnalysisPeriod] = useState("7");

  // Market data state
  const [marketData, setMarketData] = useState<any[]>([]);
  const [hotelData, setHotelData] = useState<any[]>([]);
  const [staticMergedData, setStaticMergedData] = useState<any[]>([]);
  const [apiPaceData, setApiPaceData] = useState<any[]>([]);
  const [staticPaceData, setStaticPaceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flight demand state
  const [flightData, setFlightData] = useState<any[]>([]);
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightSource, setFlightSource] = useState<string>("");
  const [flightAirports, setFlightAirports] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch market + hotel data
  useEffect(() => {
    if (!propertyId || !citySlug) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 90);
        const startDateStr = today.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        const [marketRes, hotelRes, paceRes] = await Promise.all([
          fetch(`/api/market/forward-view?city=${citySlug}`),
          fetch(`/api/metrics/range?propertyId=${propertyId}&granularity=daily&startDate=${startDateStr}&endDate=${endDateStr}`),
          fetch(`/api/market/pace?city=${citySlug}&period=7`),
        ]);

        if (!marketRes.ok) throw new Error(`Market API failed: ${marketRes.statusText}`);
        if (!hotelRes.ok) throw new Error(`Hotel API failed: ${hotelRes.statusText}`);

        const marketApiData = await marketRes.json();
        const hotelApiData = await hotelRes.json();
        const paceApiData = paceRes.ok ? await paceRes.json() : [];

        setMarketData(marketApiData);
        setHotelData(hotelApiData.metrics || []);
        setStaticPaceData(paceApiData);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propertyId, citySlug]);

  // Fetch dynamic pace data
  useEffect(() => {
    if (!propertyId || !citySlug) return;

    const fetchPace = async () => {
      try {
        const res = await fetch(`/api/market/pace?city=${citySlug}&period=${paceAnalysisPeriod}`);
        if (res.ok) {
          setApiPaceData(await res.json());
        }
      } catch (err) {
        console.error("Pace fetch error:", err);
      }
    };

    fetchPace();
  }, [propertyId, citySlug, paceAnalysisPeriod]);

  // Fetch flight demand data
  useEffect(() => {
    if (!citySlug) return;

    const fetchFlights = async () => {
      setFlightLoading(true);
      try {
        const res = await fetch(`/api/flights/demand?city=${citySlug}&days=90`);
        if (res.ok) {
          const data = await res.json();
          setFlightData(data.data || []);
          setFlightSource(data.source || "");
          setFlightAirports(data.airports || []);
        }
      } catch (err) {
        console.error("Flight demand fetch error:", err);
      } finally {
        setFlightLoading(false);
      }
    };

    fetchFlights();
  }, [citySlug]);

  // Refresh flight data from AeroDataBox
  const handleRefreshFlights = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/flights/refresh?city=${citySlug}&days=90`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      const result = await res.json();
      toast.success(`Flight data refreshed: ${result.fetched} new, ${result.skipped} cached`);

      // Re-fetch the cached data
      const dataRes = await fetch(`/api/flights/demand?city=${citySlug}&days=90`);
      if (dataRes.ok) {
        const data = await dataRes.json();
        setFlightData(data.data || []);
        setFlightSource(data.source || "");
        setFlightAirports(data.airports || []);
      }
    } catch (err: any) {
      toast.error(`Flight refresh failed: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Merge market + hotel data
  useEffect(() => {
    if (marketData.length === 0) return;

    const normalizeDate = (dateStr: string) =>
      new Date(dateStr).toISOString().split("T")[0];

    const mergedMap = new Map<string, any>();
    const paceMap = new Map<string, any>();
    staticPaceData.forEach((item) => {
      paceMap.set(normalizeDate(item.checkin_date), item);
    });

    marketData.forEach((item) => {
      const dateKey = normalizeDate(item.checkin_date);
      const date = new Date(item.checkin_date);
      mergedMap.set(dateKey, {
        date,
        dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        dateString: date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }),
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        dayNum: date.getDate(),
        marketDemand: Math.round(item.market_demand_score || 0),
        marketWAP: Math.round(item.weighted_avg_price || 0),
        marketSupply: item.total_results || 0,
        priceIndex: item.mpss || 0,
        supplyChangePace: parseFloat((paceMap.get(dateKey)?.total_results_percent_delta || 0).toFixed(1)),
        marketPace: 0,
        supplyChange: 0,
        priceChange: 0,
        hotelOccupancy: 0,
        hotelRoomsUnsold: 0,
        hotelADR: 0,
        hotelRevenue: 0,
      });
    });

    hotelData.forEach((item) => {
      const dateKey = normalizeDate(item.period);
      const existing = mergedMap.get(dateKey);
      if (existing) {
        const occupancy = parseFloat(item.your_occupancy_direct || 0) * 100;
        const capacity = parseInt(item.your_capacity_count, 10) || 0;
        const roomsSold = parseInt(item.your_rooms_sold, 10) || 0;
        existing.hotelOccupancy = Math.round(occupancy);
        existing.hotelRoomsUnsold = capacity - roomsSold;
        existing.hotelADR = Math.round(parseFloat(item.your_gross_adr || item.your_net_adr || 0));
        existing.hotelRevenue = Math.round(parseFloat(item.your_gross_revenue || item.your_net_revenue || 0));
      }
    });

    setStaticMergedData(Array.from(mergedMap.values()).slice(0, 90));
  }, [marketData, hotelData, staticPaceData]);

  // Memoized chart data
  const trendData = useMemo(() => {
    return staticMergedData.map((day, idx) => ({
      ...day,
      xAxisLabel: idx % 7 === 0 || idx === 0 ? day.dateLabel : "",
      fullDate: day.dateLabel,
      dayIndex: idx,
    }));
  }, [staticMergedData]);

  const paceChartData = useMemo(() => {
    const paceMap = new Map<string, any>();
    const normalizeDate = (dateStr: string | Date) =>
      new Date(dateStr).toISOString().split("T")[0];

    apiPaceData.forEach((item) => {
      paceMap.set(normalizeDate(item.checkin_date), item);
    });

    return trendData.map((day) => {
      const dateKey = normalizeDate(day.date);
      const paceItem = paceMap.get(dateKey);
      return {
        ...day,
        priceChange: Math.round(paceItem?.wap_delta || 0),
        supplyChange: parseFloat((paceItem?.total_results_percent_delta || 0).toFixed(1)),
      };
    });
  }, [trendData, apiPaceData]);

  // Flight chart data (merged with trendData for synchronized X axis)
  const flightChartData = useMemo(() => {
    if (!flightData.length || !trendData.length) return trendData.map((d) => ({ ...d, arrivals: 0, departures: 0, totalFlights: 0 }));

    const flightMap = new Map<string, any>();
    flightData.forEach((item) => {
      flightMap.set(item.date, item);
    });

    return trendData.map((day) => {
      const dateKey = new Date(day.date).toISOString().split("T")[0];
      const flight = flightMap.get(dateKey);
      return {
        ...day,
        arrivals: flight?.arrivals || 0,
        departures: flight?.departures || 0,
        totalFlights: flight?.totalFlights || 0,
      };
    });
  }, [trendData, flightData]);

  // Compute flight stats
  const flightStats = useMemo(() => {
    if (!flightData.length) return null;
    const withData = flightData.filter((d) => d.arrivals > 0);
    if (!withData.length) return null;

    const avgArrivals = Math.round(withData.reduce((s, d) => s + d.arrivals, 0) / withData.length);
    const maxDay = withData.reduce((max, d) => (d.arrivals > max.arrivals ? d : max), withData[0]);
    const minDay = withData.reduce((min, d) => (d.arrivals < min.arrivals ? d : min), withData[0]);

    return {
      avgArrivals,
      peakDate: maxDay.date,
      peakArrivals: maxDay.arrivals,
      quietDate: minDay.date,
      quietArrivals: minDay.arrivals,
      daysWithData: withData.length,
    };
  }, [flightData]);

  const getPriceIndexColor = (index: number) => {
    if (index >= 90) return "#ef4444";
    if (index >= 40) return "#f59e0b";
    return "#3b82f6";
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#1d1d1c", color: "#e5e5e5", padding: "24px" }}>
        <Database className="w-8 h-8 animate-pulse mb-4" style={{ color: "#39BDF8" }} />
        <h2 className="text-xl font-light" style={{ color: "#e5e5e5" }}>Loading Demand Intelligence</h2>
        <p className="text-[#6b7280] text-sm mt-2">Fetching market, hotel, and flight data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#1d1d1c", color: "#e5e5e5", padding: "24px", textAlign: "center" }}>
        <TrendingDown className="w-8 h-8 text-[#ef4444] mb-4" />
        <h2 className="text-xl text-[#ef4444]">Failed to Load Data</h2>
        <code style={{ background: "#1a1a18", border: "1px solid #2a2a2a", padding: "8px 12px", borderRadius: "4px", marginTop: "12px", color: "#fca5a5" }}>{error}</code>
      </div>
    );
  }

  const chartGridProps = { strokeDasharray: "0", stroke: "#2a2a2a", opacity: 0.5, vertical: true, horizontal: true };
  const xAxisProps = { dataKey: "xAxisLabel" as const, stroke: "#2a2a2a", tick: { fill: "#6b7280", fontSize: 10 }, tickLine: { stroke: "#2a2a2a" }, axisLine: { stroke: "#2a2a2a" }, interval: 6 };
  const yAxisProps = { stroke: "#2a2a2a", tick: { fill: "#6b7280", fontSize: 10 }, tickLine: { stroke: "#2a2a2a" }, axisLine: { stroke: "#2a2a2a" }, width: 45 };
  const tooltipProps = {
    cursor: { fill: "rgba(57, 189, 248, 0.08)" },
    labelFormatter: (_label: string, payload: any[]) => payload?.[0]?.payload?.fullDate || _label,
    contentStyle: { backgroundColor: "rgba(26, 26, 26, 0.95)", border: "1px solid #2a2a2a", borderRadius: "4px", padding: "8px" },
    labelStyle: { color: "#9ca3af", fontSize: "10px" },
    itemStyle: { fontSize: "11px", color: "#e5e5e5" },
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1d1d1c", position: "relative", overflow: "hidden" }}>
      {/* Background effects */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar style={{ width: "24px", height: "24px", color: "#39BDF8" }} />
              <h1 style={{ color: "#e5e5e5", fontSize: "24px", lineHeight: "32px", margin: 0 }}>
                Demand Intelligence
              </h1>
              <span style={{ backgroundColor: "rgba(57, 189, 248, 0.15)", color: "#39BDF8", fontSize: "10px", padding: "2px 8px", borderRadius: "9999px", fontWeight: 600 }}>
                NEXT GEN
              </span>
            </div>

            {/* Hotel selector */}
            <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
              <SelectTrigger className="w-[260px] h-9 bg-[#2C2C2C] border-[#2a2a2a] text-[#e5e5e5]">
                <SelectValue placeholder="Select hotel" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                {allHotels.map((h) => (
                  <SelectItem
                    key={h.hotel_id || h.id}
                    value={(h.hotel_id || h.id).toString()}
                    className="text-[#e5e5e5] focus:bg-[#2C2C2C] focus:text-[#39BDF8]"
                  >
                    {h.property_name || h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p style={{ color: "#9ca3af", margin: 0 }}>
            Market intelligence + flight traffic demand signals • 90-day forward view
          </p>

          <div style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: "#2C2C2C", border: "1px solid #2a2a2a", borderRadius: "9999px", padding: "8px 16px" }}>
            <MapPin style={{ width: "16px", height: "16px", color: "#39BDF8" }} />
            <span style={{ color: "#e5e5e5", fontSize: "14px" }}>
              {citySlug.charAt(0).toUpperCase() + citySlug.slice(1).replace(/-/g, " ")} Market
            </span>
            {flightAirports.length > 0 && (
              <>
                <span style={{ color: "#6b7280", fontSize: "12px" }}>•</span>
                <Plane style={{ width: "12px", height: "12px", color: "#39BDF8" }} />
                <span style={{ color: "#6b7280", fontSize: "12px" }}>
                  {flightAirports.join(", ")}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

          {/* ━━━ FLIGHT DEMAND SECTION ━━━ */}
          <div style={{ backgroundColor: "#1A1A1A", borderRadius: "8px", border: "1px solid #2a2a2a", padding: "20px" }}>
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Plane style={{ width: "18px", height: "18px", color: "#39BDF8" }} />
                  <h2 style={{ color: "#e5e5e5", fontSize: "18px", margin: 0 }}>
                    Flight Traffic Demand
                  </h2>
                </div>
                <p style={{ color: "#9ca3af", fontSize: "12px", margin: "4px 0 0 0" }}>
                  Inbound flight arrivals as a forward-looking demand proxy • Source: AeroDataBox
                </p>
              </div>
              <button
                onClick={handleRefreshFlights}
                disabled={isRefreshing}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  backgroundColor: isRefreshing ? "#2C2C2C" : "rgba(57, 189, 248, 0.15)",
                  color: "#39BDF8", border: "1px solid rgba(57, 189, 248, 0.3)",
                  borderRadius: "6px", padding: "6px 14px", fontSize: "12px",
                  cursor: isRefreshing ? "not-allowed" : "pointer",
                }}
              >
                {isRefreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {isRefreshing ? "Fetching..." : "Refresh from API"}
              </button>
            </div>

            {/* Flight Stats Cards */}
            {flightStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
                <div style={{ backgroundColor: "#1d1d1c", borderRadius: "8px", border: "1px solid #2a2a2a", padding: "14px" }}>
                  <div style={{ color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>Avg Daily Arrivals</div>
                  <div style={{ color: "#39BDF8", fontSize: "24px", fontWeight: 600 }}>{flightStats.avgArrivals.toLocaleString()}</div>
                  <div style={{ color: "#6b7280", fontSize: "11px" }}>{flightAirports.join(" + ")}</div>
                </div>
                <div style={{ backgroundColor: "#1d1d1c", borderRadius: "8px", border: "1px solid #2a2a2a", padding: "14px" }}>
                  <div style={{ color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>Peak Day</div>
                  <div style={{ color: "#ef4444", fontSize: "24px", fontWeight: 600 }}>{flightStats.peakArrivals.toLocaleString()}</div>
                  <div style={{ color: "#6b7280", fontSize: "11px" }}>{new Date(flightStats.peakDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ backgroundColor: "#1d1d1c", borderRadius: "8px", border: "1px solid #2a2a2a", padding: "14px" }}>
                  <div style={{ color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>Quietest Day</div>
                  <div style={{ color: "#10b981", fontSize: "24px", fontWeight: 600 }}>{flightStats.quietArrivals.toLocaleString()}</div>
                  <div style={{ color: "#6b7280", fontSize: "11px" }}>{new Date(flightStats.quietDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                </div>
                <div style={{ backgroundColor: "#1d1d1c", borderRadius: "8px", border: "1px solid #2a2a2a", padding: "14px" }}>
                  <div style={{ color: "#6b7280", fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>Days with Data</div>
                  <div style={{ color: "#e5e5e5", fontSize: "24px", fontWeight: 600 }}>{flightStats.daysWithData}</div>
                  <div style={{ color: "#6b7280", fontSize: "11px" }}>of 90 days</div>
                </div>
              </div>
            )}

            {/* Flight Arrivals Chart */}
            <div style={{ backgroundColor: "#1d1d1c", borderRadius: "8px", border: "1px solid #2a2a2a" }}>
              <div style={{ padding: "20px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ color: "#e5e5e5", margin: 0 }}>Inbound Flight Arrivals</h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                    Scheduled passenger arrivals per day (excl. cargo, codeshare, private)
                  </p>
                </div>
                <div style={{ height: "238px" }}>
                  {flightLoading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#39BDF8" }} />
                    </div>
                  ) : flightChartData.some((d) => d.arrivals > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={flightChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} syncId="demandIntel">
                        <CartesianGrid {...chartGridProps} />
                        <XAxis {...xAxisProps} />
                        <YAxis {...yAxisProps} domain={[0, "auto"]} />
                        <Tooltip {...tooltipProps} />
                        <Area type="monotone" dataKey="arrivals" stroke="#39BDF8" strokeWidth={1.5} fill="#39BDF8" fillOpacity={0.12} name="Arrivals" />
                        <Bar dataKey="arrivals" name="Arrivals" radius={[2, 2, 0, 0]} maxBarSize={16} fillOpacity={0.7}>
                          {flightChartData.map((entry, index) => {
                            const avg = flightStats?.avgArrivals || 0;
                            let fill = "#39BDF8";
                            if (entry.arrivals > avg * 1.15) fill = "#ef4444";
                            else if (entry.arrivals > avg * 1.05) fill = "#f59e0b";
                            else if (entry.arrivals < avg * 0.85) fill = "#10b981";
                            return <Cell key={`fc-${index}`} fill={fill} />;
                          })}
                        </Bar>
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
                      <Plane className="w-8 h-8 mb-2" style={{ opacity: 0.3 }} />
                      <p style={{ fontSize: "13px" }}>No flight data cached yet</p>
                      <p style={{ fontSize: "11px" }}>Click "Refresh from API" to fetch data from AeroDataBox</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ━━━ MARKET ANALYTICS SECTION ━━━ */}
          <div style={{ backgroundColor: "#1A1A1A", borderRadius: "8px", border: "1px solid #2a2a2a", padding: "20px" }}>
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ color: "#e5e5e5", fontSize: "18px", margin: 0 }}>90-Day Market Analytics</h2>
                <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                  Comprehensive market intelligence with synchronized data visualization
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#9ca3af", fontSize: "12px" }}>Pace Period:</span>
                <Select value={paceAnalysisPeriod} onValueChange={setPaceAnalysisPeriod}>
                  <SelectTrigger className="w-[120px] h-8 bg-[#1d1d1c] border-[#2a2a2a] text-[#e5e5e5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1d1d1c] border-[#2a2a2a]">
                    <SelectItem value="1" className="text-[#e5e5e5] focus:bg-[#2C2C2C] focus:text-[#39BDF8]">1 Day</SelectItem>
                    <SelectItem value="3" className="text-[#e5e5e5] focus:bg-[#2C2C2C] focus:text-[#39BDF8]">3 Days</SelectItem>
                    <SelectItem value="7" className="text-[#e5e5e5] focus:bg-[#2C2C2C] focus:text-[#39BDF8]">7 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div style={{ backgroundColor: "#1d1d1c", borderRadius: "8px", border: "1px solid #2a2a2a" }}>
              {/* Chart 1: Market Supply Landscape */}
              <div style={{ padding: "20px", borderBottom: "1px solid #2a2a2a", backgroundColor: "#1d1d1c" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ color: "#e5e5e5", margin: 0 }}>Market Supply Landscape</h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>Available room inventory across competitive market</p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} syncId="demandIntel">
                      <CartesianGrid {...chartGridProps} />
                      <XAxis {...xAxisProps} />
                      <YAxis yAxisId="left" {...yAxisProps} domain={[0, 100]} />
                      <YAxis yAxisId="right" orientation="right" {...yAxisProps} domain={[0, "auto"]} />
                      <Tooltip {...tooltipProps} />
                      <Area yAxisId="right" type="monotone" dataKey="marketSupply" stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.08} name="Market Supply (Properties)" />
                      <Bar yAxisId="left" dataKey="marketDemand" name="Market Demand (%)" radius={[4, 4, 0, 0]} maxBarSize={24} fillOpacity={0.85}>
                        {trendData.map((entry, index) => {
                          let fill = "#3b82f6";
                          if (entry.marketDemand >= 85) fill = "#ef4444";
                          else if (entry.marketDemand >= 70) fill = "#f97316";
                          else if (entry.marketDemand >= 40) fill = "#f59e0b";
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Price Index */}
              <div style={{ padding: "20px", borderBottom: "1px solid #2a2a2a", backgroundColor: "#1d1d1c" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ color: "#e5e5e5", margin: 0 }}>Price Index Analysis</h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>Market pricing trends and rate positioning</p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 55, left: -20, bottom: 20 }} syncId="demandIntel">
                      <CartesianGrid {...chartGridProps} />
                      <XAxis {...xAxisProps} />
                      <YAxis {...yAxisProps} domain={[0, 100]} />
                      <Tooltip
                        cursor={{ stroke: "#39BDF8", strokeWidth: 2 }}
                        labelFormatter={(_l: string, p: any[]) => p?.[0]?.payload?.fullDate || _l}
                        formatter={(value: number) => Math.round(value)}
                        contentStyle={tooltipProps.contentStyle}
                        labelStyle={tooltipProps.labelStyle}
                        itemStyle={tooltipProps.itemStyle}
                      />
                      <Line
                        type="monotone"
                        dataKey="priceIndex"
                        stroke="transparent"
                        strokeWidth={0}
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={getPriceIndexColor(payload.priceIndex)} stroke="none" />;
                        }}
                        name="Price Index"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Price Change */}
              <div style={{ padding: "20px", borderBottom: "1px solid #2a2a2a", backgroundColor: "#1d1d1c" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ color: "#e5e5e5", margin: 0 }}>{paceAnalysisPeriod} Day Price Change</h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>Price fluctuations vs. {paceAnalysisPeriod} days ago</p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paceChartData} margin={{ top: 10, right: 55, left: -20, bottom: 20 }} syncId="demandIntel">
                      <CartesianGrid {...chartGridProps} />
                      <XAxis {...xAxisProps} />
                      <YAxis {...yAxisProps} label={{ value: `Price Change (${currencySymbol})`, angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10 }} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="priceChange" name={`Price Change (${currencySymbol})`} radius={[4, 4, 0, 0]} maxBarSize={24}>
                        {paceChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.priceChange >= 0 ? "#22c55e" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Supply Change */}
              <div style={{ padding: "20px", backgroundColor: "#1d1d1c" }}>
                <div style={{ marginBottom: "12px" }}>
                  <h3 style={{ color: "#e5e5e5", margin: 0 }}>{paceAnalysisPeriod} Day Supply Change</h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>Change in market room supply vs. {paceAnalysisPeriod} days ago</p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paceChartData} margin={{ top: 10, right: 55, left: -20, bottom: 20 }} syncId="demandIntel">
                      <CartesianGrid {...chartGridProps} />
                      <XAxis {...xAxisProps} />
                      <YAxis {...yAxisProps} label={{ value: "Supply Change (%)", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 10 }} />
                      <Tooltip {...tooltipProps} formatter={(value: number) => [`${value}%`, "Supply Change"]} />
                      <Bar dataKey="supplyChange" name="Supply Change (%)" radius={[4, 4, 0, 0]} maxBarSize={24}>
                        {paceChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.supplyChange >= 0 ? "#3b82f6" : "#8b5cf6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", color: "#6b7280", fontSize: "12px", paddingBottom: "16px" }}>
            Market intelligence powered by live channel data + AeroDataBox flight schedules • Updated daily
          </div>
        </div>
      </div>
    </div>
  );
}
