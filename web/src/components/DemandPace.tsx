// Import React hooks for state and side effects
import { useState, useEffect, useMemo } from "react";
import { R } from "../styles/tokens";
import { AirbnbAvailability } from "./AirbnbAvailability";
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
import React from "react";



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

  // Accommodation type counts from map POI data

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
    if (marketData.length === 0) return;

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
    if (index >= 40) return "#f59e0b";
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
          background: R.bg,
          color: R.accent,
          padding: "24px",
        }}
      >
        <Database
          className="w-8 h-8 animate-pulse mb-4"
          style={{ color: R.warmTeal, stroke: R.warmTeal }}
        />
        <h2 className="text-xl font-light" style={{ color: R.accent }}>
          Loading Demand Data
        </h2>
        <p className="text-[#4E5868] text-sm mt-2">
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
          background: R.bg,
          color: R.accent,
          padding: "24px",
          textAlign: "center",
        }}
      >
        <TrendingDown className="w-8 h-8 text-[#ef4444] mb-4" />
        <h2 className="text-xl text-[#ef4444]">Failed to Load Data</h2>
        <p className="text-[#7A8494]">
          There was an error fetching the planning data:
        </p>
        <code
          style={{
            background: "#1a1a18",
            border: `1px solid ${R.border}`,
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
    <div style={{ flex: 1, background: R.bg, color: R.accent }}>
      <div style={{ padding: "24px 28px" }}>
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
              style={{ width: "24px", height: "24px", color: R.warmTeal }}
            />
            <h1
              style={{
                color: R.accent,
                fontSize: "24px",
                lineHeight: "32px",
                margin: 0,
              }}
            >
              Demand {citySlug ? citySlug.charAt(0).toUpperCase() + citySlug.slice(1).replace(/-/g, " ") : ""}
            </h1>
          </div>
          <p style={{ color: R.textMid, margin: 0 }}>
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
              backgroundColor: R.card,
              border: `1px solid ${R.border}`,
              borderRadius: "9999px",
              padding: "8px 16px",
            }}
          >
            <MapPin
              style={{ width: "16px", height: "16px", color: R.warmTeal }}
            />
            <span style={{ color: R.accent, fontSize: "14px" }}>
              {citySlug.charAt(0).toUpperCase() + citySlug.slice(1)} Market
            </span>
            <span style={{ color: R.textDim, fontSize: "12px" }}>•</span>
            <Database
              style={{ width: "12px", height: "12px", color: R.textDim }}
            />
            <span style={{ color: R.textDim, fontSize: "12px" }}>
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
              backgroundColor: R.darkBand,
              borderRadius: "8px",
              border: `1px solid ${R.border}`,
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
                    color: R.accent,
                    fontSize: "18px",
                    lineHeight: "28px",
                    marginBottom: "4px",
                    margin: 0,
                  }}
                >
                  90-Day Market Analytics
                </h2>
                <p style={{ color: R.textMid, fontSize: "12px", margin: 0 }}>
                  Comprehensive market intelligence with synchronized data
                  visualization
                </p>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={{ color: R.textMid, fontSize: "12px" }}>
                  Pace Period:
                </span>
                <Select
                  value={paceAnalysisPeriod}
                  onValueChange={setPaceAnalysisPeriod}
                >
                  <SelectTrigger className="w-[120px] h-8 bg-[#14181D] border-[#1E2330] text-[#F3F5F7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14181D] border-[#1E2330]">
                    <SelectItem
                      value="1"
                      className="text-[#F3F5F7] focus:bg-[#2C2C2C] focus:text-[#38C6BA]"
                    >
                      1 Day
                    </SelectItem>
                    <SelectItem
                      value="3"
                      className="text-[#F3F5F7] focus:bg-[#2C2C2C] focus:text-[#38C6BA]"
                    >
                      3 Days
                    </SelectItem>
                    <SelectItem
                      value="7"
                      className="text-[#F3F5F7] focus:bg-[#2C2C2C] focus:text-[#38C6BA]"
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
                backgroundColor: R.bg,
                borderRadius: "8px",
                border: `1px solid ${R.border}`,
              }}
            >
              {/* Chart 1: Market Demand / Supply Landscape */}
              <div
                style={{
                  padding: "20px",
                  borderBottom: `1px solid ${R.border}`,
                  backgroundColor: R.bg,
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: R.accent, marginBottom: "2px", margin: 0 }}
                  >
                    Market Supply Landscape
                  </h3>
                  <p style={{ color: R.textMid, fontSize: "12px", margin: 0 }}>
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
                        stroke={R.border}
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        interval={6}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        width={45}
                        domain={[0, 100]}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        width={45}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(57, 189, 248, 0.08)" }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 26, 0.95)",
                          border: `1px solid ${R.border}`,
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: R.textMid, fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: R.accent }}
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
                            fill = "#f59e0b";
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
                  borderBottom: `1px solid ${R.border}`,
                  backgroundColor: R.bg,
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: R.accent, marginBottom: "2px", margin: 0 }}
                  >
                    Price Index Analysis
                  </h3>
                  <p style={{ color: R.textMid, fontSize: "12px", margin: 0 }}>
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
                        stroke={R.border}
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        interval={6}
                      />
                      <YAxis
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        width={45}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        cursor={{ stroke: R.warmTeal, strokeWidth: 2 }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        formatter={(value) => Math.round(value as number)}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 26, 0.95)",
                          border: `1px solid ${R.border}`,
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: R.textMid, fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: R.accent }}
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
                  borderBottom: `1px solid ${R.border}`,
                  backgroundColor: R.bg,
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: R.accent, marginBottom: "2px", margin: 0 }}
                  >
                    {paceAnalysisPeriod} Day Price Change
                  </h3>
                  <p style={{ color: R.textMid, fontSize: "12px", margin: 0 }}>
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
                        stroke={R.border}
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        interval={6}
                      />
                      <YAxis
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        width={45}
                        label={{
                          value: `Price Change (${currencySymbol})`,
                          angle: -90,
                          position: "insideLeft",
                          fill: R.textDim,
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(57, 189, 248, 0.08)" }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 26, 0.95)",
                          border: `1px solid ${R.border}`,
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: R.textMid, fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: R.accent }}
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
                  backgroundColor: R.bg,
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <h3
                    style={{ color: R.accent, marginBottom: "2px", margin: 0 }}
                  >
                    {paceAnalysisPeriod} Day Supply Change
                  </h3>
                  <p style={{ color: R.textMid, fontSize: "12px", margin: 0 }}>
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
                        stroke={R.border}
                        opacity={0.5}
                        vertical={true}
                        horizontal={true}
                      />
                      <XAxis
                        dataKey="xAxisLabel"
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        interval={6}
                      />
                      <YAxis
                        stroke={R.border}
                        tick={{ fill: R.textDim, fontSize: 10 }}
                        tickLine={{ stroke: R.border }}
                        axisLine={{ stroke: R.border }}
                        width={45}
                        label={{
                          value: "Supply Change (%)",
                          angle: -90,
                          position: "insideLeft",
                          fill: R.textDim,
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(57, 189, 248, 0.08)" }}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length) {
                            return payload[0].payload.fullDate;
                          }
                          return label;
                        }}
                        formatter={(value) => [`${value}%`, "Supply Change"]}
                        contentStyle={{
                          backgroundColor: "rgba(26, 26, 26, 0.95)",
                          border: `1px solid ${R.border}`,
                          borderRadius: "4px",
                          padding: "8px",
                        }}
                        labelStyle={{ color: R.textMid, fontSize: "10px" }}
                        itemStyle={{ fontSize: "11px", color: R.accent }}
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


          {citySlug === "archanes" && (
            <AirbnbAvailability
              citySlug={citySlug}
              currencySymbol={currencySymbol}
            />
          )}

          <div
            style={{
              textAlign: "center",
              color: R.textDim,
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

        </div>
      </div>
    </div>
  );
}
