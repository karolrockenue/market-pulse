// Import React hooks for state and side effects
import { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
  Database,
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
} from "./ui/select";
import { MarketOutlookBanner } from "../features/dashboard/components/MarketOutlookBanner";

// Internal component for Market Demand Patterns
function MarketDemandPatterns({ patterns }: { patterns: any }) {
  if (!patterns) return null;

  const { busiestDays, quietestDays } = patterns;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Busiest Days Card */}
      <div className="bg-[#1A1A1A] border border-[#3a3a35] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#ef4444]/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#ef4444]" />
          </div>
          <div>
            <div className="text-[#e5e5e5] text-sm">High Demand Days</div>
            <div className="text-[#9ca3af] text-xs">
              Peak market saturation periods
            </div>
          </div>
        </div>
        <div className="space-y-1">
          {busiestDays.map((day: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 hover:bg-[#2C2C2C] rounded transition-colors border-b border-[#2a2a2a] last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#6b7280] text-xs w-4">{i + 1}</span>
                <div>
                  <div className="text-[#e5e5e5] text-xs">
                    {formatDate(day.date)}
                  </div>
                  <div className="text-[#6b7280] text-[10px]">
                    {day.dayOfWeek}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[#ef4444] text-xs font-medium bg-[#ef4444]/10 px-2 py-0.5 rounded">
                  {day.availability}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quietest Days Card */}
      <div className="bg-[#1A1A1A] border border-[#3a3a35] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#10b981]/20 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-[#10b981]" />
          </div>
          <div>
            <div className="text-[#e5e5e5] text-sm">Low Demand Days</div>
            <div className="text-[#9ca3af] text-xs">Soft market periods</div>
          </div>
        </div>
        <div className="space-y-1">
          {quietestDays.map((day: any, i: number) => (
            <div
              key={i}
              className="flex items-center justify-between p-2 hover:bg-[#2C2C2C] rounded transition-colors border-b border-[#2a2a2a] last:border-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#6b7280] text-xs w-4">{i + 1}</span>
                <div>
                  <div className="text-[#e5e5e5] text-xs">
                    {formatDate(day.date)}
                  </div>
                  <div className="text-[#6b7280] text-[10px]">
                    {day.dayOfWeek}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[#10b981] text-xs font-medium bg-[#10b981]/10 px-2 py-0.5 rounded">
                  {day.availability}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Define the props the component will receive from App.tsx
interface DemandPaceProps {
  propertyId: number | null;
  currencyCode: string;
  citySlug: string;
}

// Main component function
export function DemandPace({
  propertyId,
  currencyCode,
  citySlug,
}: DemandPaceProps) {
  const getCurrencySymbol = (code: string) => {
    const map: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
    return map[code] || code || "£";
  };
  const currencySymbol = getCurrencySymbol(currencyCode);

  // Pace Analysis period selector
  const [paceAnalysisPeriod, setPaceAnalysisPeriod] = useState("7");

  // --- Live Data State ---
  const [marketData, setMarketData] = useState<any[]>([]);
  const [hotelData, setHotelData] = useState<any[]>([]);
  const [staticMergedData, setStaticMergedData] = useState<any[]>([]);
  const [apiPaceData, setApiPaceData] = useState<any[]>([]);
  const [staticPaceData, setStaticPaceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for the Market Outlook banner
  const [marketOutlook, setMarketOutlook] = useState({
    status: "loading",
    metric: "Loading Outlook...",
    period: "",
  });

  // --- Data Fetching Effect ---
  useEffect(() => {
    if (!propertyId || !citySlug) {
      let errorMsg = "Cannot fetch data: ";
      if (!propertyId) errorMsg += "No property selected. ";
      if (!citySlug) errorMsg += "City slug is missing. ";
      setError(errorMsg);
      setIsLoading(false);
      return;
    }

    const fetchPlanningData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // API Call 1: Market Intelligence Data
        const marketResponse = await fetch(
          `/api/market/forward-view?city=${citySlug}`,
        );
        if (!marketResponse.ok) {
          throw new Error(`Market API failed: ${marketResponse.statusText}`);
        }
        const marketApiData = await marketResponse.json();
        setMarketData(marketApiData);

        // API Call 2: Hotel Performance Data
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 90);
        const startDateStr = today.toISOString().split("T")[0];
        const endDateStr = endDate.toISOString().split("T")[0];

        const hotelResponse = await fetch(
          `/api/metrics/range?propertyId=${propertyId}&granularity=daily&startDate=${startDateStr}&endDate=${endDateStr}`,
        );
        if (!hotelResponse.ok) {
          throw new Error(`Hotel API failed: ${hotelResponse.statusText}`);
        }
        const hotelApiData = await hotelResponse.json();
        setHotelData(hotelApiData.metrics);

        // API Call 3: Static 7-Day Pace Data
        const staticPaceResponse = await fetch(
          `/api/market/pace?city=${citySlug}&period=7`,
        );
        if (!staticPaceResponse.ok) {
          throw new Error(
            `Static Pace API failed: ${staticPaceResponse.statusText}`,
          );
        }
        const staticPaceApiData = await staticPaceResponse.json();
        setStaticPaceData(staticPaceApiData);
      } catch (err: any) {
        console.error("Failed to fetch planning data:", err);
        setError(err.message || "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanningData();
  }, [propertyId, citySlug]);

  // Pace Data Fetching Effect (dynamic based on period selector)
  useEffect(() => {
    if (!propertyId || !citySlug) return;

    const fetchPaceData = async () => {
      try {
        const paceResponse = await fetch(
          `/api/market/pace?city=${citySlug}&period=${paceAnalysisPeriod}`,
        );
        if (!paceResponse.ok) {
          throw new Error(`Pace API failed: ${paceResponse.statusText}`);
        }
        const paceData = await paceResponse.json();
        setApiPaceData(paceData);
      } catch (err: any) {
        console.error("Failed to fetch pace data:", err);
        setApiPaceData([]);
      }
    };

    fetchPaceData();
  }, [propertyId, citySlug, paceAnalysisPeriod]);

  // Market Outlook Fetching Effect
  useEffect(() => {
    if (!citySlug) return;

    const fetchMarketOutlook = async () => {
      try {
        setMarketOutlook({
          status: "loading",
          metric: "Loading Outlook...",
          period: "",
        });

        const response = await fetch(`/api/market/outlook?city=${citySlug}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(
            data.error || `API failed with status ${response.status}`,
          );
        }

        const data = await response.json();
        setMarketOutlook({
          status: data.status,
          metric: data.metric,
          period: data.period,
        });
      } catch (error: any) {
        console.error("Failed to fetch market outlook:", error);
        setMarketOutlook({
          status: "stable",
          metric: "Outlook Unavailable",
          period: "",
        });
      }
    };

    fetchMarketOutlook();
  }, [citySlug]);

  // Data Merging Effect
  useEffect(() => {
    if (marketData.length === 0 || hotelData.length === 0) return;

    const processedData = mergeAndProcessData(
      marketData,
      hotelData,
      staticPaceData,
    );
    setStaticMergedData(processedData);
  }, [marketData, hotelData, staticPaceData]);

  /**
   * Merges raw market and hotel API data into a single array for the UI.
   */
  const mergeAndProcessData = (
    market: any[],
    hotel: any[],
    staticPace: any[],
  ) => {
    const normalizeDate = (dateStr: string) =>
      new Date(dateStr).toISOString().split("T")[0];

    const mergedMap = new Map<string, any>();

    // Create a lookup map for pace data
    const paceMap = new Map<string, any>();
    staticPace.forEach((item) => {
      const dateKey = normalizeDate(item.checkin_date);
      paceMap.set(dateKey, item);
    });

    // Process market data
    market.forEach((item) => {
      const dateKey = normalizeDate(item.checkin_date);
      const date = new Date(item.checkin_date);
      mergedMap.set(dateKey, {
        date: date,
        dateLabel: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        dateString: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          weekday: "short",
        }),
        dayName: date
          .toLocaleDateString("en-US", { weekday: "short" })
          .toUpperCase(),
        dayNum: date.getDate(),
        marketDemand: Math.round(item.market_demand_score || 0),
        marketWAP: Math.round(item.weighted_avg_price || 0),
        marketSupply: item.total_results || 0,
        priceIndex: item.mpss || 0,
        supplyChangePace: parseFloat(
          (paceMap.get(dateKey)?.total_results_percent_delta || 0).toFixed(1),
        ),
        marketPace: 0,
        supplyChange: 0,
        priceChange: 0,
        hotelOccupancy: 0,
        hotelRoomsUnsold: 0,
        hotelADR: 0,
        hotelRevenue: 0,
      });
    });

    // Merge hotel data
    hotel.forEach((item) => {
      const dateKey = normalizeDate(item.period);
      const existing = mergedMap.get(dateKey);

      if (existing) {
        const occupancy = parseFloat(item.your_occupancy_direct || 0) * 100;
        const capacity = parseInt(item.your_capacity_count, 10) || 0;
        const roomsSold = parseInt(item.your_rooms_sold, 10) || 0;
        const adr = parseFloat(item.your_gross_adr || item.your_net_adr || 0);
        const revenue = parseFloat(
          item.your_gross_revenue || item.your_net_revenue || 0,
        );

        existing.hotelOccupancy = Math.round(occupancy);
        existing.hotelRoomsUnsold = capacity - roomsSold;
        existing.hotelADR = Math.round(adr);
        existing.hotelRevenue = Math.round(revenue);
      }
    });

    return Array.from(mergedMap.values()).slice(0, 90);
  };

  // --- Memoized Data Hooks ---
  const trendData = useMemo(() => {
    return staticMergedData.map((day, idx) => ({
      ...day,
      xAxisLabel: idx % 7 === 0 || idx === 0 ? day.dateLabel : "",
      fullDate: day.dateLabel,
      dayIndex: idx,
    }));
  }, [staticMergedData]);

  // Dynamic pace chart data
  const paceChartData = useMemo(() => {
    const paceMap = new Map<string, any>();
    const normalizeDate = (dateStr: string | Date) =>
      new Date(dateStr).toISOString().split("T")[0];

    apiPaceData.forEach((item) => {
      const dateKey = normalizeDate(item.checkin_date);
      paceMap.set(dateKey, item);
    });

    return trendData.map((day) => {
      const dateKey = normalizeDate(day.date);
      const paceItem = paceMap.get(dateKey);

      return {
        ...day,
        priceChange: Math.round(paceItem?.wap_delta || 0),
        supplyChange: parseFloat(
          (paceItem?.total_results_percent_delta || 0).toFixed(1),
        ),
      };
    });
  }, [trendData, apiPaceData]);

  // Memoized hook to calculate forward-looking patterns
  const futurePatterns = useMemo(() => {
    const combinedData = staticMergedData.map((day) => {
      const paceInfo = paceChartData.find(
        (p) => p.date.getTime() === day.date.getTime(),
      );
      return {
        ...day,
        priceChange: paceInfo?.priceChange || 0,
      };
    });

    const busiestDays = [...combinedData]
      .sort((a, b) => b.marketDemand - a.marketDemand)
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        dayOfWeek: day.dayName,
        availability: day.marketDemand,
        supply: day.marketSupply,
      }));

    const quietestDays = [...combinedData]
      .sort((a, b) => a.marketDemand - b.marketDemand)
      .slice(0, 5)
      .map((day) => ({
        date: day.date,
        dayOfWeek: day.dayName,
        availability: day.marketDemand,
        supply: day.marketSupply,
      }));

    return { busiestDays, quietestDays };
  }, [staticMergedData, paceChartData]);

  // Helper function for price index color
  const getPriceIndexColor = (index: number) => {
    if (index >= 90) return "#ef4444";
    if (index >= 40) return "#faff6a";
    return "#3b82f6";
  };

  // Render loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#1d1d1c",
          color: "#e5e5e5",
          padding: "24px",
        }}
      >
        <Database
          className="w-8 h-8 animate-pulse mb-4"
          style={{ color: "#39BDF8", stroke: "#39BDF8" }}
        />
        <h2 className="text-xl font-light" style={{ color: "#e5e5e5" }}>
          Loading Market Intelligence
        </h2>
        <p className="text-[#6b7280] text-sm mt-2">
          Fetching and processing 90-day forecast data...
        </p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#252521",
          color: "#e5e5e5",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <TrendingDown className="w-8 h-8 text-[#ef4444] mb-4" />
        <h2 className="text-xl text-[#ef4444]">Failed to Load Data</h2>
        <p className="text-[#9ca3af]">
          There was an error fetching the planning data:
        </p>
        <code
          style={{
            background: "#1a1a18",
            border: "1px solid #3a3a35",
            padding: "8px 12px",
            borderRadius: "4px",
            marginTop: "12px",
            color: "#fca5a5",
          }}
        >
          {error}
        </code>
      </div>
    );
  }

  // --- Main Component Render ---
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1d1d1c",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))",
          pointerEvents: "none",
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, padding: "24px" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <Calendar
              style={{ width: "24px", height: "24px", color: "#39BDF8" }}
            />
            <h1
              style={{
                color: "#e5e5e5",
                fontSize: "24px",
                lineHeight: "32px",
                margin: 0,
              }}
            >
              Market Intelligence
            </h1>
          </div>
          <p style={{ color: "#9ca3af", margin: 0 }}>
            90-day forward market planning and channel management • Real-time
            market intelligence
          </p>

          {/* Market Badge */}
          <div
            style={{
              marginTop: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#262626",
              border: "1px solid #3a3a35",
              borderRadius: "9999px",
              padding: "8px 16px",
            }}
          >
            <MapPin
              style={{ width: "16px", height: "16px", color: "#39BDF8" }}
            />
            <span style={{ color: "#e5e5e5", fontSize: "14px" }}>
              {citySlug.charAt(0).toUpperCase() + citySlug.slice(1)} Market
            </span>
            <span style={{ color: "#6b7280", fontSize: "12px" }}>•</span>
            <Database
              style={{ width: "12px", height: "12px", color: "#6b7280" }}
            />
            <span style={{ color: "#6b7280", fontSize: "12px" }}>
              Live Channel Data
            </span>
          </div>
        </div>

        {/* Market Outlook Banner */}
        <MarketOutlookBanner
          status={marketOutlook.status as any}
          metric={marketOutlook.metric}
          period={marketOutlook.period}
        />

        {/* Main Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* 90-Day Market Analytics Section */}
          <div
            style={{
              backgroundColor: "#1A1A1A",
              borderRadius: "8px",
              border: "1px solid #3a3a35",
              padding: "20px",
            }}
          >
            {/* Section Header with Pace Period Selector */}
            <div
              style={{
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2
                  style={{
                    color: "#e5e5e5",
                    fontSize: "18px",
                    lineHeight: "28px",
                    marginBottom: "4px",
                    margin: 0,
                  }}
                >
                  90-Day Market Analytics
                </h2>
                <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                  Comprehensive market intelligence with synchronized data
                  visualization
                </p>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                  Pace Period:
                </span>
                <Select
                  value={paceAnalysisPeriod}
                  onValueChange={setPaceAnalysisPeriod}
                >
                  <SelectTrigger className="w-[120px] h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f1f1c] border-[#3a3a35]">
                    <SelectItem
                      value="1"
                      className="text-[#e5e5e5] focus:bg-[#262626] focus:text-[#39BDF8]"
                    >
                      1 Day
                    </SelectItem>
                    <SelectItem
                      value="3"
                      className="text-[#e5e5e5] focus:bg-[#262626] focus:text-[#39BDF8]"
                    >
                      3 Days
                    </SelectItem>
                    <SelectItem
                      value="7"
                      className="text-[#e5e5e5] focus:bg-[#262626] focus:text-[#39BDF8]"
                    >
                      7 Days
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Charts Container */}
            <div
              style={{
                backgroundColor: "#1f1f1c",
                borderRadius: "8px",
                border: "1px solid #3a3a35",
              }}
            >
              {/* Chart 1: Market Demand / Supply Landscape */}
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #3a3a35",
                  backgroundColor: "#1f1f1c",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: "#e5e5e5", marginBottom: "2px", margin: 0 }}
                  >
                    Market Supply Landscape
                  </h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                    Available room inventory across competitive market
                  </p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={trendData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                      syncId="marketAnalytics"
                    >
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="#2a2a25"
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        interval={6}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        width={45}
                        domain={[0, 100]}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        width={45}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(250, 255, 106, 0.1)" }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 24, 0.95)",
                          border: "1px solid #3a3a35",
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: "#9ca3af", fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: "#e5e5e5" }}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="marketSupply"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        strokeOpacity={0.3}
                        fill="#3b82f6"
                        fillOpacity={0.08}
                        name="Market Supply (Properties)"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="marketDemand"
                        name="Market Demand (%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                        fillOpacity={0.85}
                      >
                        {trendData.map((entry, index) => {
                          const demand = entry.marketDemand;
                          let fill = "#3b82f6";

                          if (demand >= 85) {
                            fill = "#ef4444";
                          } else if (demand >= 70) {
                            fill = "#f97316";
                          } else if (demand >= 40) {
                            fill = "#faff6a";
                          }

                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Price Index Analysis */}
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #3a3a35",
                  backgroundColor: "#1f1f1c",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: "#e5e5e5", marginBottom: "2px", margin: 0 }}
                  >
                    Price Index Analysis
                  </h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                    Market pricing trends and rate positioning
                  </p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 10, right: 55, left: -20, bottom: 20 }}
                      syncId="marketAnalytics"
                    >
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="#2a2a25"
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        interval={6}
                      />
                      <YAxis
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        width={45}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        cursor={{ stroke: "#39BDF8", strokeWidth: 2 }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        formatter={(value) => Math.round(value as number)}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 24, 0.95)",
                          border: "1px solid #3a3a35",
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: "#9ca3af", fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: "#e5e5e5" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="priceIndex"
                        stroke="transparent"
                        strokeWidth={0}
                        dot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          const value = payload.priceIndex;
                          const fill = getPriceIndexColor(value);

                          return (
                            <circle
                              key={`dot-${index}`}
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={fill}
                              stroke="none"
                            />
                          );
                        }}
                        name="Price Index"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 3: Market Price Change */}
              <div
                style={{
                  padding: "20px",
                  borderBottom: "1px solid #3a3a35",
                  backgroundColor: "#1f1f1c",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: "#e5e5e5", marginBottom: "2px", margin: 0 }}
                  >
                    {paceAnalysisPeriod} Day Price Change
                  </h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                    Price fluctuations vs. {paceAnalysisPeriod} days ago
                  </p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={paceChartData}
                      margin={{ top: 10, right: 55, left: -20, bottom: 20 }}
                      syncId="marketAnalytics"
                    >
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="#2a2a25"
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        interval={6}
                      />
                      <YAxis
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        width={45}
                        label={{
                          value: `Price Change (${currencySymbol})`,
                          angle: -90,
                          position: "insideLeft",
                          fill: "#6b7280",
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(250, 255, 106, 0.1)" }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 24, 0.95)",
                          border: "1px solid #3a3a35",
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: "#9ca3af", fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: "#e5e5e5" }}
                      />
                      <Bar
                        dataKey="priceChange"
                        name={`Price Change (${currencySymbol})`}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      >
                        {paceChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.priceChange >= 0 ? "#22c55e" : "#ef4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4: Supply Change */}
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "#1f1f1c",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: "#e5e5e5", marginBottom: "2px", margin: 0 }}
                  >
                    {paceAnalysisPeriod} Day Supply Change
                  </h3>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>
                    Change in market room supply vs. {paceAnalysisPeriod} days
                    ago
                  </p>
                </div>
                <div style={{ height: "238px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={paceChartData}
                      margin={{ top: 10, right: 55, left: -20, bottom: 20 }}
                      syncId="marketAnalytics"
                    >
                      <CartesianGrid
                        strokeDasharray="0"
                        stroke="#2a2a25"
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        interval={6}
                      />
                      <YAxis
                        stroke="#3a3a35"
                        tick={{ fill: "#6b7280", fontSize: 10 }}
                        tickLine={{ stroke: "#3a3a35" }}
                        axisLine={{ stroke: "#3a3a35" }}
                        width={45}
                        label={{
                          value: "Supply Change (%)",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#6b7280",
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(250, 255, 106, 0.1)" }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        formatter={(value) => [`${value}%`, "Supply Change"]}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 24, 0.95)",
                          border: "1px solid #3a3a35",
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: "#9ca3af", fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: "#e5e5e5" }}
                      />
                      <Bar
                        dataKey="supplyChange"
                        name="Supply Change (%)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={24}
                      >
                        {paceChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.supplyChange >= 0 ? "#3b82f6" : "#8b5cf6"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Data Attribution Footer */}
          <div
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: "12px",
              paddingBottom: "16px",
            }}
          >
            Market intelligence powered by live channel data • Updated daily •
            Last refresh:{" "}
            {new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>

          {/* Market Demand Patterns - Outside charts container like prototype */}
          <MarketDemandPatterns patterns={futurePatterns} />
        </div>
      </div>
    </div>
  );
}
