// Import React hooks for state and side effects
import { useState, useEffect, useMemo } from 'react';
import { MapPin, Calendar, TrendingUp, TrendingDown, DollarSign, Info, X, Home, StickyNote, BarChart3, Activity, DoorOpen, Database } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Cell, Area, ReferenceLine } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

import { MarketOutlookBanner } from './MarketOutlookBanner'; // <-- ADD THIS LINE
import { MarketDemandPatterns } from './MarketDemandPatterns';
// Define the props the component will receive from App.tsx
interface DemandPaceProps {
  propertyId: number | null;
  currencyCode: string;
  citySlug: string; // Used for market-level API calls
}

// Main component function, now accepting props
export function DemandPace({ propertyId, currencyCode, citySlug }: DemandPaceProps) {
  // --- Core UI State ---
  const [selectedDay, setSelectedDay] = useState<any>(null); // The currently selected day in the grid
  
  // Chart metric toggles
  const [showMarketDemand, setShowMarketDemand] = useState(true);
  const [showPriceIndex, setShowPriceIndex] = useState(true);
  const [showMarketSupply, setShowMarketSupply] = useState(true);
  
  // Synchronized hover state for both charts
  const [syncedHoverIndex, setSyncedHoverIndex] = useState<number | null>(null);
  
  // Column hover state for table
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  
  // Pace Analysis period selector
  const [paceAnalysisPeriod, setPaceAnalysisPeriod] = useState('7');
  
// --- Live Data State ---
  // Store raw API responses
  const [marketData, setMarketData] = useState<any[]>([]);
  const [hotelData, setHotelData] = useState<any[]>([]);
  
  // Store the combined and processed data for all charts and tables
const [staticMergedData, setStaticMergedData] = useState<any[]>([]);
// [NEW] Store the raw response from the pace API
  const [apiPaceData, setApiPaceData] = useState<any[]>([]);
  const [staticPaceData, setStaticPaceData] = useState<any[]>([]); // <-- ADD THIS LINE
  // Manage API call status
  
  const [isLoading, setIsLoading] = useState(true);

  // [NEW] State for the Market Outlook banner
  const [marketOutlook, setMarketOutlook] = useState({
    status: 'loading', // 'loading' | 'stable' | 'strengthening' | 'softening'
    metric: 'Loading Outlook...',
    period: '',
  });

  const [error, setError] = useState<string | null>(null);

// Helper function to select a day
  const handleSelectDay = (day: any) => {
    setSelectedDay(day);
  };

// --- Data Fetching Effect ---
  // Runs when the component mounts or when the selected propertyId changes
  useEffect(() => {


// Ensure we have a valid property to fetch data for
    if (!propertyId || !citySlug) {
      let errorMsg = "Cannot fetch data: ";
      if (!propertyId) errorMsg += "No property selected. ";
      if (!citySlug) errorMsg += "City slug is missing. ";
      setError(errorMsg);
      setIsLoading(false);
      return;
    }

    // Define an async function to fetch all required data
    const fetchPlanningData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // --- API Call 1: Market Intelligence Data ---
        // Fetches 90-day forward-looking MPSS, Market Demand, and Supply
        //
// Inside fetchPlanningData:
        const marketResponse = await fetch(`/api/planning/forward-view?city=${citySlug}`);
        if (!marketResponse.ok) {
          throw new Error(`Market API failed: ${marketResponse.statusText}`);
        }
        const marketApiData = await marketResponse.json(); 
   
        setMarketData(marketApiData); // Pass the whole response

 // --- API Call 2: Hotel Performance Data ---
        // [FIX] Changed to 'metrics-from-db' to get detailed data for
        // accurate 'Rooms to Sell' calculation, matching the Reports endpoint.
        //
        
        // We need to construct the 90-day date range for the API
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 90);
        
        const startDateStr = today.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const hotelResponse = await fetch(`/api/metrics-from-db?propertyId=${propertyId}&granularity=daily&startDate=${startDateStr}&endDate=${endDateStr}`);
        if (!hotelResponse.ok) {
          throw new Error(`Hotel API failed: ${hotelResponse.statusText}`);
        }
        const hotelApiData = await hotelResponse.json();
setHotelData(hotelApiData.metrics); // Data is in 'metrics' property

        // [MODIFIED] Data processing is now handled in a separate useEffect



        // --- API Call 3: Static 7-Day Pace Data ---
        // Fetches 7-day pace data for the static grid row
        const staticPaceResponse = await fetch(`/api/planning/pace?city=${citySlug}&period=7`);
        if (!staticPaceResponse.ok) {
          throw new Error(`Static Pace API failed: ${staticPaceResponse.statusText}`);
        }
        const staticPaceApiData = await staticPaceResponse.json();
        setStaticPaceData(staticPaceApiData);

        // [MODIFIED] Data processing is now handled in a separate useEffect
        // to allow all data sources to load independently.



      } catch (err: any) {
        console.error("Failed to fetch planning data:", err);
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

fetchPlanningData();
  }, [propertyId, citySlug]); // Re-run if these props change

  // --- [NEW] Pace Data Fetching Effect ---
  // Runs when the component mounts or when the pace period selector changes
  useEffect(() => {
    if (!propertyId || !citySlug) {
      // Don't fetch if base data isn't ready
      return;
    }

    const fetchPaceData = async () => {
      // --- [LOGGING] ---

      
      try {
        // --- API Call 3: Pace Intelligence Data ---
        // Fetches 90-day forward-looking pace deltas
        //
        const paceResponse = await fetch(`/api/planning/pace?city=${citySlug}&period=${paceAnalysisPeriod}`);
        if (!paceResponse.ok) {
          throw new Error(`Pace API failed: ${paceResponse.statusText}`);
        }
        const paceData = await paceResponse.json();
    

      setApiPaceData(paceData);

        // --- [DEBUG 1: START] ---
        console.log("[DEBUG 1] Raw /api/planning/pace response:", paceData);
        if (paceData.length > 0) {
          console.log(
            "[DEBUG 1] First pace item 'wap_delta':", 
            paceData[0].wap_delta, 
            "(Type:", typeof paceData[0].wap_delta, ")"
          );
        }
        // --- [DEBUG 1: END] ---

      } catch (err: any) {
        console.error("Failed to fetch pace data:", err);
        // We don't set a main error here, as pace is supplemental.
        setApiPaceData([]); // Clear pace data on error
      }
    };

fetchPaceData();
  }, [propertyId, citySlug, paceAnalysisPeriod]); // Re-run if these change

  // --- [NEW] Market Outlook Fetching Effect ---
  // Runs when the citySlug prop is available
  useEffect(() => {
    if (!citySlug) return; // Don't fetch if city isn't set

    const fetchMarketOutlook = async () => {
      try {
        // Set loading state
        setMarketOutlook({
          status: 'loading',
          metric: 'Loading Outlook...',
          period: '',
        });
        
        const response = await fetch(`/api/planning/market-trend?city=${citySlug}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `API failed with status ${response.status}`);
        }
        
        const data = await response.json();

        setMarketOutlook({
          status: data.status,
          metric: data.metric,
          period: data.period,
        });
      } catch (error: any) {
        console.error('Failed to fetch market outlook:', error);
        setMarketOutlook({
          status: 'stable', // Fallback on error
          metric: 'Outlook Unavailable',
          period: '', // Keep period clean on error
        });
      }
    };

    fetchMarketOutlook();
  }, [citySlug]); // This hook re-runs when the city changes

// --- [MODIFIED] Data Merging Effect ---
// This effect now ONLY merges static data. It does NOT depend on pace.
useEffect(() => {
  // --- [LOGGING] ---

  // Don't try to merge until we have the primary data
  if (marketData.length === 0 || hotelData.length === 0) {
    return;
  }

const processedData = mergeAndProcessData(
    marketData,
    hotelData,
    staticPaceData
  );

  setStaticMergedData(processedData); // [MODIFIED] Set static state


}, [marketData, hotelData, staticPaceData]); // [MODIFIED] Now depends on static pace data
/**
   * Merges raw market and hotel API data into a single array for the UI.
   * Calculates derived metrics like 'Rooms to Sell' and 'Price Change'.
   */
/**
   * Merges raw market and hotel API data into a single array for the UI.
   * Calculates derived metrics like 'Rooms to Sell' and 'Price Change'.
   */
const mergeAndProcessData = (market: any[], hotel: any[], staticPace: any[]) => {
  // Helper to format date strings consistently
  // [FIX] Moved this function to the top of the scope
  const normalizeDate = (dateStr: string) => new Date(dateStr).toISOString().split('T')[0];
  
  const mergedMap = new Map<string, any>();

  // Create a lookup map for pace data
  const paceMap = new Map<string, any>();
  staticPace.forEach(item => {
    const dateKey = normalizeDate(item.checkin_date);
    paceMap.set(dateKey, item);
  });

  // 1. Process market data (our primary source)
  market.forEach(item => {
    const dateKey = normalizeDate(item.checkin_date);
    const date = new Date(item.checkin_date);
    mergedMap.set(dateKey, {
      // Date info
      date: date,
      dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateString: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      dayNum: date.getDate(),

      // Market Metrics (from market_availability_snapshots)
      marketDemand: Math.round(item.market_demand_score || 0),
      marketWAP: Math.round(item.weighted_avg_price || 0),
      marketSupply: item.total_results || 0,
      priceIndex: item.mpss || 0,

 // --- [NEW] Static 7-Day Pace (Supply % Change) ---
      supplyChangePace: parseFloat((paceMap.get(dateKey)?.total_results_percent_delta || 0).toFixed(1)),

      // --- [REMOVED] Pace data is no longer merged here ---
      marketPace: 0,
      supplyChange: 0,
      priceChange: 0,

      // Default Hotel Metrics (in case of no match)
      hotelOccupancy: 0,
      hotelRoomsUnsold: 0, // Will be calculated from API data
      hotelADR: 0,
      hotelRevenue: 0,
    });
  });

  // 2. Merge hotel data
  hotel.forEach(item => {
    // 'metrics-from-db' uses 'period' instead of 'date'
    const dateKey = normalizeDate(item.period);
    const existing = mergedMap.get(dateKey);

    if (existing) {
      const occupancy = parseFloat(item.your_occupancy_direct || 0) * 100;
      const capacity = parseInt(item.your_capacity_count, 10) || 0;
      const roomsSold = parseInt(item.your_rooms_sold, 10) || 0;
      const adr = parseFloat(item.your_gross_adr || item.your_net_adr || 0);
      const revenue = parseFloat(item.your_gross_revenue || item.your_net_revenue || 0);

      existing.hotelOccupancy = Math.round(occupancy);
      existing.hotelRoomsUnsold = capacity - roomsSold;
      existing.hotelADR = Math.round(adr);
      existing.hotelRevenue = Math.round(revenue);
    }
  });

  // 3. Return the first 90 days
  return Array.from(mergedMap.values()).slice(0, 90);
};

// --- Memoized Data Hooks ---

// 'futureData' is now based on 'staticMergedData'
const futureData = useMemo(() => {
  return staticMergedData.slice(0, 90);
}, [staticMergedData]);

const trendData = useMemo(() => {
  // This is the static data for Charts 1 & 2
  return staticMergedData.map((day, idx) => ({
    ...day, // This includes the original 'date' object

    // [FIX] 'date' is now 'xAxisLabel' so it doesn't overwrite the real date
    xAxisLabel: (idx % 7 === 0 || idx === 0) ? day.dateLabel : '', 

    fullDate: day.dateLabel,
    dayIndex: idx,
  }));
}, [staticMergedData]);

// [NEW] 'paceChartData' is DYNAMIC and used for Charts 3 & 4
// It depends on the static 'trendData' AND the 'apiPaceData'
const paceChartData = useMemo(() => {
  // 1. Create a lookup map from the pace API response
  const paceMap = new Map<string, any>();
  const normalizeDate = (dateStr: string | Date) => new Date(dateStr).toISOString().split('T')[0];

  apiPaceData.forEach(item => {
    const dateKey = normalizeDate(item.checkin_date);
    paceMap.set(dateKey, item);
  });

  // 2. Map over the static trendData and merge in pace values
  return trendData.map((day) => {

    // [FIX] Use the reliable 'day.date' object (which is a full Date)
    const dateKey = normalizeDate(day.date); 
    const paceItem = paceMap.get(dateKey);

    return {
      ...day,
      // Add the pace-driven values here
      priceChange: Math.round(paceItem?.wap_delta || 0),
      supplyChange: parseFloat((paceItem?.total_results_percent_delta || 0).toFixed(1)),
    };
  });
}, [trendData, apiPaceData]);

// [NEW] Memoized hook to calculate forward-looking patterns
  const futurePatterns = useMemo(() => {
    // We need to merge the static data (WAP, Supply, Demand)
    // with the pace data (priceChange)
    const combinedData = staticMergedData.map((day) => {
      const paceInfo = paceChartData.find(p => p.date === day.date);
      return {
        ...day,
        priceChange: paceInfo?.priceChange || 0,
      };
    });

    // Busiest Days = Highest Market Demand
    const busiestDays = [...combinedData]
      .sort((a, b) => b.marketDemand - a.marketDemand)
      .slice(0, 5)
      .map(day => ({
        date: day.date,
        dayOfWeek: day.dayName,
        // In this component, "availability" is the demand score
        availability: day.marketDemand, 
        supply: day.marketSupply,
      }));

    // Quietest Days = Lowest Market Demand
    const quietestDays = [...combinedData]
      .sort((a, b) => a.marketDemand - b.marketDemand)
      .slice(0, 5)
      .map(day => ({
        date: day.date,
        dayOfWeek: day.dayName,
        availability: day.marketDemand,
        supply: day.marketSupply,
      }));

// Biggest Rate Increases = Highest Price Change
    const biggestIncreases = [...combinedData]
      .sort((a, b) => b.priceChange - a.priceChange)
      .slice(0, 5)
      .map(day => ({
        date: day.date,
        dayOfWeek: day.dayName,
        rate: day.priceIndex, // [MODIFIED] Use Price Index
        change: day.priceChange, // Use the delta
      }));

    // Biggest Rate Drops = Lowest Price Change
    const biggestDrops = [...combinedData]
      .sort((a, b) => a.priceChange - b.priceChange)
      .slice(0, 5)
      .map(day => ({
        date: day.date,
        dayOfWeek: day.dayName,
        rate: day.priceIndex, // [MODIFIED] Use Price Index
        change: day.priceChange,
      }));

    return { busiestDays, quietestDays, biggestIncreases, biggestDrops };
  }, [staticMergedData, paceChartData]); // Depends on our main data arrays

  const getDemandColor = (demand: number) => {
    if (demand >= 80) return '#ef4444';
    if (demand >= 60) return '#f59e0b';
    if (demand >= 40) return '#faff6a';
    return '#10b981';
  };

  const getPaceColor = (pace: number) => {
    if (pace >= 75) return '#ef4444';
    if (pace >= 50) return '#faff6a';
    return '#3b82f6';
  };

  const getDemandLabel = (demand: number) => {
    if (demand >= 80) return 'Critical';
    if (demand >= 60) return 'High';
    if (demand >= 40) return 'Moderate';
    return 'Low';
  };

  // [NEW] Helper for static 7-day supply pace row
  const getSupplyPaceLabel = (pacePercent: number) => {
    // Negative pace means supply *decreased* (good)
    if (pacePercent <= -10) {
      return { label: 'High', color: '#22c55e' }; // High Pace (Good)
    }
    // User logic: -3.1% to -10% is Medium
    if (pacePercent <= -3.1) {
      return { label: 'Medium', color: '#faff6a' }; // Medium Pace
    }
    // User logic: 0 to -3% is Low, and >0% (supply increase) is also Low
    return { label: 'Low', color: '#ef4444' }; // Low Pace (Bad)
  };


  const getPaceLabel = (pace: number) => {
    if (pace >= 75) return 'Hot';
    if (pace >= 50) return 'Moderate';
    return 'Cold';
  };

// Convert price index (MPSS) to 1-100 (higher = more expensive)
  // The API already provides this as 'priceIndex' (mpss)
  //
  const getPriceIndex = (priceIndexScore: number) => {
    return Math.max(1, Math.min(100, Math.round(priceIndexScore)));
  };
// Get color for price index (1-100 scale)
// Get color for price index (1-100 scale)
const getPriceIndexColor = (index: number) => {
  // [NEW] Hybrid logic for visibility and accuracy
  if (index >= 90) return '#ef4444'; // Critical (Red)
  if (index >= 40) return '#faff6a'; // High/Mid (Bright Yellow - from prototype)
  return '#3b82f6'; // Low (Blue - from prototype)
};

  // Get demand level styling
  const getDemandLevelStyle = (demand: number, isSelected: boolean) => {
    if (isSelected) return {};
    
    if (demand >= 80) {
      // Critical - Red (more subtle)
      return {
        background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, rgba(239, 68, 68, 0.015) 100%)',
        boxShadow: 'inset 0 0 20px rgba(239, 68, 68, 0.05)',
        borderColor: 'rgba(239, 68, 68, 0.15)',
        hoverBg: 'hover:bg-[#ef4444]/8'
      };
    } else if (demand >= 40) {
      // Moderate - Yellow (more subtle, less orange)
      return {
        background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.035) 0%, rgba(234, 179, 8, 0.015) 100%)',
        boxShadow: 'inset 0 0 20px rgba(234, 179, 8, 0.04)',
        borderColor: 'rgba(234, 179, 8, 0.12)',
        hoverBg: 'hover:bg-[#eab308]/8'
      };
    } else {
      // Low - Blue (more subtle)
      return {
        background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.035) 0%, rgba(59, 130, 246, 0.015) 100%)',
        boxShadow: 'inset 0 0 20px rgba(59, 130, 246, 0.04)',
        borderColor: 'rgba(59, 130, 246, 0.12)',
        hoverBg: 'hover:bg-[#3b82f6]/8'
      };
    }
  };

// Render loading or error states before rendering the component
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#252521',
        color: '#e5e5e5',
        padding: '24px'
      }}>
        <Database className="w-8 h-8 text-[#faff6a] animate-pulse mb-4" />
        <h2 className="text-xl">Loading Market Intelligence</h2>
        <p className="text-[#9ca3af]">Fetching and processing 90-day forecast data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#252521',
        color: '#e5e5e5',
        padding: '24px',
        textAlign: 'center'
      }}>
        <TrendingDown className="w-8 h-8 text-[#ef4444] mb-4" />
        <h2 className="text-xl text-[#ef4444]">Failed to Load Data</h2>
        <p className="text-[#9ca3af]">There was an error fetching the planning data:</p>
        <code style={{
          background: '#1a1a18',
          border: '1px solid #3a3a35',
          padding: '8px 12px',
          borderRadius: '4px',
          marginTop: '12px',
          color: '#fca5a5'
        }}>
          {error}
        </code>
      </div>
    );
  }

  // --- Main Component Render ---
  return (
    <div style={{ minHeight: '100vh', background: '#252521', padding: '24px' }}>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-6 h-6 text-[#faff6a]" />
          <h1 className="text-[#e5e5e5] text-2xl">Market Planning</h1>
        </div>
        <p className="text-[#9ca3af]">
        Real-time market intelligence 
        </p>
        
        {/* Market Badge */}
        <div className="mt-3 inline-flex items-center gap-2 bg-[#262626] border border-[#3a3a35] rounded-full px-4 py-2">
          <MapPin className="w-4 h-4 text-[#faff6a]" />
          <span className="text-[#e5e5e5] text-sm">London Market</span>
          <span className="text-[#6b7280] text-xs">•</span>
          <Database className="w-3 h-3 text-[#6b7280]" />
          <span className="text-[#6b7280] text-xs">Live Channel Data</span>
</div>
      </div>

{/* [NEW] Market Outlook Banner */}
      {/* This is now wired up to the live /api/planning/market-trend endpoint. */}
      <MarketOutlookBanner
        status={marketOutlook.status as any}
        metric={marketOutlook.metric}
        period={marketOutlook.period}
      />

      {/* Main Content Sections */}
      <div className="space-y-6">
        {/* Channel Manager Grid Section */}
        <div className="bg-[#262626] rounded-lg border border-[#3a3a35] p-5">
  <div className="mb-5">
            <h2 className="text-[#e5e5e5] text-lg mb-1">90-Day Planning Grid</h2>
         <p className="text-[#9ca3af] text-xs">
              90-day forward view with market metrics and property performance
            </p>
          </div>

{/* Grid Container */}
          <div className="bg-[#1f1f1c] rounded-lg border border-[#3a3a35] overflow-hidden">
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full text-xs table-fixed" style={{ minWidth: '2471px' }}>
          <thead>
                  <tr className="bg-[#252521] border-b border-[#3a3a35]">
                    <th className="sticky left-0 bg-[#252521] text-left text-[#9ca3af] border-r border-[#3a3a35] z-10" style={{ width: '161px', padding: '0.75rem', position: 'sticky', left: 0, zIndex: 10 }}>
                      <span className="text-xs uppercase tracking-wide">Metric</span>
                    </th>
                    {futureData.map((day, idx) => {
                      const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const isHovered = hoveredColumn === idx;
                      const demandStyle = getDemandLevelStyle(day.marketDemand, isSelected);

                      // --- [NEW] Logic from Prototype ---
                      const isFirstOfMonth = day.dayNum === 1;
                      const monthLabel = day.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                      const monthNumber = day.date.getMonth();
                      const isOddMonth = monthNumber % 2 === 1;
                      // --- End New Logic ---
                      
                      return (
                        <th 
                          key={idx}
                          onClick={() => setSelectedDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          // [MODIFIED] Added odd/even month bg color
                          className={`relative text-center p-3 cursor-pointer transition-all group ${
                            isSelected
                              ? 'bg-[#faff6a]/20 text-[#faff6a]'
                              : isHovered
                              ? 'bg-[#faff6a]/15 text-[#e5e5e5]'
                              : `text-[#9ca3af] ${isOddMonth ? 'bg-[#1a1a18]' : 'bg-[#252521]'} ${demandStyle.hoverBg || 'hover:bg-[#faff6a]/10'} hover:text-[#e5e5e5]`
                          }`}
                          style={{ 
                            width: '77px',
                            // [MODIFIED] Added special border for first of month
                            borderRight: isFirstOfMonth ? '2px solid #faff6a40' : '1px solid #3a3a35',
                            ...(!isSelected && !isFirstOfMonth ? {
                              borderRightColor: demandStyle.borderColor
                            } : {})
                          }}
                        >
                      {/* [MODIFIED] Added Month Label */}
                          <div className="text-[#e5e5e5] text-[9px] uppercase tracking-wider mb-0.5 opacity-70">
                            {monthLabel}
                          </div>
                          <div className={`text-xs ${selectedDay?.date.getTime() === day.date.getTime() ? 'text-[#faff6a]' : isHovered ? 'text-[#faff6a]' : 'text-[#e5e5e5] group-hover:text-[#faff6a]'}`}>
                            {day.dayName}
                          </div>
                          <div className="text-[#9ca3af] text-[10px] mt-0.5">{day.dayNum}</div>
                          {selectedDay?.date.getTime() !== day.date.getTime() && (
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-[#faff6a] group-hover:w-3/4 transition-all duration-200" />
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
          
                  {/* Row 2: Market Demand */}
                  <tr className="border-b border-[#3a3a35] transition-colors bg-[#262626]/30">
<td
  className="sticky left-0 z-20 bg-[#1f1f1c] border-r border-[#3a3a35]"
  style={{
    width: '161px',
    padding: '0.875rem',
    backgroundColor: '#1f1f1c',
  }}
>
  <div className="relative flex items-center gap-2 text-[#e5e5e5]">
    <TrendingUp className="w-4 h-4 text-[#faff6a]" />
    <span>Market Demand</span>

    {/* Sticky yellow divider pinned to the right edge of the sticky cell */}
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        right: -1,        // overlap the grid boundary so it never “jumps”
        width: '3px',
        height: '100%',
        background: '#faff6a',
        pointerEvents: 'none',
      }}
    />
  </div>
</td>



           {futureData.map((day, idx) => {
                      const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const demand = day.marketDemand;
                      
                      // Balanced background tint and text color based on demand level
                      let bgColor = 'rgba(38, 38, 38, 0.3)';
                      let valueColor = '#9ca3af';
                      let borderLeftColor = 'transparent';
                      
                      if (demand < 30) {
                        // Low demand - blue tint
                        bgColor = 'rgba(59, 130, 246, 0.08)';
                        valueColor = '#93b5e6';
                        borderLeftColor = 'rgba(59, 130, 246, 0.5)';
                      } else if (demand < 50) {
                        // Moderate - teal
                        bgColor = 'rgba(20, 184, 166, 0.09)';
                        valueColor = '#7dd3c0';
                        borderLeftColor = 'rgba(20, 184, 166, 0.5)';
                      } else if (demand < 70) {
                        // Medium-High - yellow
                        bgColor = 'rgba(250, 255, 106, 0.1)';
                        valueColor = '#faff6a';
                        borderLeftColor = 'rgba(250, 255, 106, 0.6)';
                      } else if (demand < 85) {
                        // High - orange
                        bgColor = 'rgba(251, 146, 60, 0.1)';
                        valueColor = '#fdb77c';
                        borderLeftColor = 'rgba(251, 146, 60, 0.6)';
                      } else {
                        // Very High - red
                        bgColor = 'rgba(239, 68, 68, 0.1)';
                        valueColor = '#fca5a5';
                        borderLeftColor = 'rgba(239, 68, 68, 0.6)';
                      }
                      
                      const isHovered = hoveredColumn === idx;
                      
                      return (
               <td 
                          key={idx}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          className={`text-center border-r cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-[#faff6a]/10 border-r-[#faff6a]/50'
                              : isHovered
                              ? 'hover:bg-[#faff6a]/15'
                              : 'hover:bg-[#262626]/50'
                          }`}
                          style={{ 
                            width: '77px',
                            padding: '0.875rem', 
                            backgroundColor: isSelected ? undefined : isHovered ? 'rgba(250, 255, 106, 0.15)' : bgColor,
                            borderRightColor: isSelected ? undefined : '#3a3a35',
                            borderLeftWidth: '2px',
                            borderLeftColor: isSelected ? '#faff6a' : '#3a3a35'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                            <div className="text-sm" style={{ color: isSelected ? '#faff6a' : valueColor }}>
                              {day.marketDemand}%
                            </div>
                            <div className="text-[9px] text-[#6b7280]">
                              {getDemandLabel(day.marketDemand)}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

  
{/* Row 3: [NEW] Static Market Pace (7-Day Supply Change) */}
                  <tr className="border-b border-[#3a3a35] hover:bg-[#262626]/30 transition-colors">
                    <td className="sticky left-0 bg-[#1f1f1c] text-[#e5e5e5] border-r border-[#3a3a35] z-10" style={{ width: '161px', padding: '0.75rem', position: 'sticky', left: 0, zIndex: 10 }}>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#9ca3af]" />
                        <span>Market Pace</span>
                      </div>
                    </td>
                    {futureData.map((day, idx) => {
                      const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const isHovered = hoveredColumn === idx;
                      const demandStyle = getDemandLevelStyle(day.marketDemand, isSelected);
                      const pace = getSupplyPaceLabel(day.supplyChangePace);
                      
                      return (
                        <td 
                          key={idx}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          className={`text-center p-3 border-r cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#faff6a]/10 border-[#3a3a35]'
                              : isHovered
                              ? 'bg-[#faff6a]/15'
                              : demandStyle.hoverBg || 'hover:bg-[#262626]/50'
                          }`}
                          style={{ 
                            width: '77px',
                            ...(!isSelected && !isHovered ? {
                              background: demandStyle.background,
                              borderRightColor: demandStyle.borderColor
                            } : {})
                          }}
                        >
                          <div className="text-[10px]" style={{ color: pace.color }}>
                            {pace.label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Row 4: Price Index */}
                  <tr className="border-b-2 border-[#faff6a]/20 hover:bg-[#262626]/30 transition-colors">
          <td className="sticky left-0 bg-[#1f1f1c] text-[#e5e5e5] border-r border-[#3a3a35] z-10" style={{ width: '161px', padding: '0.75rem', position: 'sticky', left: 0, zIndex: 10 }}>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#9ca3af]" />
                        <span>Price Index</span>
                      </div>
                    </td>
          {futureData.map((day, idx) => {
             const priceIndex = getPriceIndex(day.priceIndex); // [NEW]
    const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const isHovered = hoveredColumn === idx;
                      
                      return (
                        <td 
                          key={idx}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          className={`text-center p-3 border-r border-[#3a3a35] cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#faff6a]/10'
                              : isHovered
                              ? 'bg-[#faff6a]/15'
                              : 'hover:bg-[#262626]/50'
                          }`}
                          style={{ width: '77px' }}
                        >
                          <div className="text-xs" style={{ color: getPriceIndexColor(priceIndex) }}>
                            {priceIndex}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

{/* Separator for Hotel Metrics */}
<tr className="bg-[#262626]/50">
  {/* Sticky first column (matches other sticky metric cells) */}
  <td
    className="sticky left-0 z-20 bg-[#1f1f1c] border-t border-b border-[#3a3a35]"
    style={{
      width: '161px',
      padding: '0.5rem 0.75rem',
      position: 'sticky',
      left: 0,
      zIndex: 20,
      backgroundColor: '#1f1f1c',
    }}
  >
    <div className="flex items-center gap-2 text-[#faff6a] text-[10px] uppercase tracking-wider">
      <Home className="w-3 h-3" />
      <span>Your Hotel Metrics</span>
    </div>
  </td>

  {/* Scrolling filler to span remaining columns */}
<td
    colSpan={90}
    className="border-t border-b border-[#3a3a35] bg-[#262626]"
    style={{ padding: '0.5rem 0' }}
  />
</tr>


                  {/* Row 5: Hotel Occupancy */}
                  <tr className="border-b border-[#3a3a35] hover:bg-[#262626]/30 transition-colors">
     <td className="sticky left-0 bg-[#1f1f1c] text-[#e5e5e5] border-r border-[#3a3a35] z-10" style={{ width: '161px', padding: '0.75rem', position: 'sticky', left: 0, zIndex: 10 }}>
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#faff6a]" />
                        <span>Occupancy</span>
                      </div>
                    </td>
                 {futureData.map((day, idx) => {
                      const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const isHovered = hoveredColumn === idx;
                      
                      return (
                        <td 
                          key={idx}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          className={`text-center p-3 border-r border-[#3a3a35] cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#faff6a]/10'
                              : isHovered
                              ? 'bg-[#faff6a]/15'
                              : 'hover:bg-[#262626]/50'
                          }`}
                          style={{ width: '77px' }}
                        >
                        <div className="text-[#e5e5e5] text-xs">
                            {day.hotelOccupancy}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 6: Available Rooms to Sell */}
                  <tr className="border-b border-[#3a3a35] hover:bg-[#262626]/30 transition-colors">
<td className="sticky left-0 bg-[#1f1f1c] text-[#e5e5e5] border-r border-[#3a3a35] z-10" style={{ width: '161px', padding: '0.75rem', position: 'sticky', left: 0, zIndex: 10 }}>
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-[#faff6a]" />
                        <span>Rooms to Sell</span>
                      </div>
                    </td>
      {futureData.map((day, idx) => {
                      const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const isHovered = hoveredColumn === idx;
                      
                      return (
                        <td 
                          key={idx}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          className={`text-center p-3 border-r border-[#3a3a35] cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#faff6a]/10'
                              : isHovered
                              ? 'bg-[#faff6a]/15'
                              : 'hover:bg-[#262626]/50'
                          }`}
                          style={{ width: '77px' }}
                        >
                          <div className="text-[#e5e5e5] text-xs">
                            {day.hotelRoomsUnsold}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 7: ADR */}
                  <tr className="hover:bg-[#262626]/30 transition-colors">
     <td className="sticky left-0 bg-[#1f1f1c] text-[#e5e5e5] border-r border-[#3a3a35] z-10" style={{ width: '161px', padding: '0.75rem', position: 'sticky', left: 0, zIndex: 10 }}>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#faff6a]" />
                        <span>ADR</span>
                      </div>
                    </td>
               {futureData.map((day, idx) => {
                      const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                      const isHovered = hoveredColumn === idx;
                      
                      return (
                        <td 
                          key={idx}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredColumn(idx)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          className={`text-center p-3 border-r border-[#3a3a35] cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#faff6a]/10'
                              : isHovered
                              ? 'bg-[#faff6a]/15'
                              : 'hover:bg-[#262626]/50'
                          }`}
                          style={{ width: '77px' }}
                        >
                          <div className="text-[#e5e5e5] text-xs">
                            £{day.hotelADR}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-[#252521] border-t border-[#3a3a35] flex items-center justify-center gap-2 text-[#6b7280] text-[10px]">
              <Info className="w-3 h-3" />
             <span>Scroll horizontally to view all 90 days • Click any day column to view details below</span>
            </div>
          </div>
        </div>

        {/* Detail Panel - Column Child Extension */}
        {selectedDay && (
          <div className="relative -mt-1">
            {/* Connecting Arrow/Pointer */}
            <div className="flex justify-center">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-[#faff6a]/40" />
            </div>
            
            {/* Inset Panel with Shadow */}
            <div className="ml-8 mr-8 mt-1 bg-[#1a1a18] border-2 border-[#faff6a]/30 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Compact Header Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#faff6a]/5 border-b border-[#faff6a]/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#faff6a] animate-pulse" />
                  <div>
                    <div className="text-[#faff6a] text-xs">{selectedDay.dateString}</div>
                    <div className="text-[#9ca3af] text-[9px]">
                      {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long' })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 hover:bg-[#faff6a]/10 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[#9ca3af] hover:text-[#faff6a]" />
                </button>
              </div>

              {/* Content Grid with Indentation */}
         <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-b from-[#1a1a18] to-[#1f1f1c]">
                {/* Market Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[#6b7280] text-[9px] uppercase tracking-wider mb-2.5">
                    <div className="w-3 h-px bg-[#faff6a]/30" />
                    <span>Market Metrics</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">Demand</span>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-2 h-2 rounded-sm"
                        style={{ backgroundColor: getDemandColor(selectedDay.marketDemand) }}
                      />
                      <span className="text-[#e5e5e5] text-xs">{selectedDay.marketDemand}%</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">Pace</span>
                    <span className="text-[#e5e5e5] text-xs">{getPaceLabel(selectedDay.marketPace)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">WAP</span>
                    <span className="text-[#e5e5e5] text-xs">£{selectedDay.marketWAP}</span>
                  </div>
                </div>

                {/* Property Metrics */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[#6b7280] text-[9px] uppercase tracking-wider mb-2.5">
                    <div className="w-3 h-px bg-[#faff6a]/30" />
                    <span>Your Property</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">Occupancy</span>
                    <span className="text-[#faff6a] text-xs">{selectedDay.hotelOccupancy}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">Rooms to Sell</span>
                    <span className="text-[#e5e5e5] text-xs">{selectedDay.hotelRoomsUnsold}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">ADR</span>
                    <span className="text-[#e5e5e5] text-xs">£{selectedDay.hotelADR}</span>
                  </div>
                  
                  <div className="flex items-center justify-between py-1.5 px-2.5 bg-[#262626]/40 border border-[#3a3a35]/50 rounded">
                    <span className="text-[#9ca3af] text-xs">Revenue</span>
                    <span className="text-[#e5e5e5] text-xs">£{selectedDay.hotelRevenue.toLocaleString()}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Combined 90-Day Market Analytics - 4 Synchronized Charts */}
        <div className="bg-[#262626] rounded-lg border border-[#3a3a35] p-5">
  {/* [MODIFIED] Dropdown has been moved to Chart 4 */}
          <div className="mb-5">
            <div>
              <h2 className="text-[#e5e5e5] text-lg mb-1">90-Day Market Analytics</h2>
              <p className="text-[#9ca3af] text-xs">
                Comprehensive market intelligence with synchronized data visualization
              </p>
            </div>
          </div>

          <div className="bg-[#1f1f1c] rounded-lg border border-[#3a3a35]">
        {/* Chart 2: Market Supply Landscape */}
            <div className="p-5 border-b border-[#3a3a35]">
              <div className="mb-3">
                <h3 className="text-[#e5e5e5] mb-0.5">Market Demand</h3>
                <p className="text-[#9ca3af] text-xs">
                  Available room inventory across competitive market
                </p>
              </div>
              <div style={{ height: '238px' }}>
                <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
                   data={trendData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
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
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      interval={6}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#3a3a35"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      width={45}
                      domain={[0, 100]}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="#3a3a35"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      width={45}
                      domain={[0, 'auto']}
                    />
                
<Tooltip
                      cursor={{ fill: 'rgba(250, 255, 106, 0.1)' }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length) {
                          return payload[0].payload.fullDate;
                        }
                        return label;
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(26, 26, 24, 0.95)',
                        border: '1px solid #3a3a35',
                        borderRadius: '4px',
                        padding: '8px'
                      }}
                      labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
                      itemStyle={{ fontSize: '11px', color: '#e5e5e5' }}
                    />
                    
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="marketSupply" 
                      stroke="#3b82f6" 
                      strokeWidth={1.5}
                      strokeOpacity={0.4}
                      dot={false}
                      name="Available Properties"
                    />
<Bar 
                      yAxisId="left"
                      dataKey="marketDemand" 
                      name="Market Demand (%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    >
                      {trendData.map((entry, index) => {
                        const demand = entry.marketDemand;
                        let fill = '#3b82f6'; // Default: Low (Blue)

                        if (demand >= 85) {
                          fill = '#ef4444'; // Critical (Red)
                        } else if (demand >= 70) {
                          fill = '#f97316'; // High (Orange)
                        } else if (demand >= 40) { // [MODIFIED] Threshold lowered to 40
                          fill = '#faff6a'; // Moderate (Yellow)
                        }
                        // Anything below 40 remains Blue

                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Chart 3: Price Index Analysis */}
            <div className="p-5 border-b border-[#3a3a35]">
              <div className="mb-3">
                <h3 className="text-[#e5e5e5] mb-0.5">Price Index Analysis</h3>
                <p className="text-[#9ca3af] text-xs">
                  Market pricing trends and rate positioning
                </p>
              </div>
          <div style={{ height: '238px' }}>
                <ResponsiveContainer width="100%" height="100%">
             <LineChart
                   data={trendData}
                   margin={{ top: 10, right: 55, left: 10, bottom: 20 }}
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
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      interval={6}
                    />
                    <YAxis 
                      stroke="#3a3a35"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      width={45}
                     domain={[0, 100]}
                    />
             <Tooltip
                      cursor={{ stroke: '#faff6a', strokeWidth: 2 }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length) {
                          return payload[0].payload.fullDate;
                        }
                        return label;
                      }}
                      formatter={(value, name) => {
                        if (name === 'Price Index') {
                          return Math.round(value as number);
                        }
                        return value;
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(26, 26, 24, 0.95)',
                        border: '1px solid #3a3a35',
                        borderRadius: '4px',
                        padding: '8px'
                      }}
                      labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
                      itemStyle={{ fontSize: '11px', color: '#e5e5e5' }}
                    />
                    
                    <Line 
                      type="monotone" 
                      dataKey="priceIndex" 
                      stroke="transparent" 
                      strokeWidth={0}
                      dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        const value = payload.priceIndex;
                        // Determine color based on price index value
          // Determine color based on price index value
                        // [FIX] Use the unified getPriceIndexColor function
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

            {/* [NEW] Shared Pace Control Header for Charts 3 & 4 */}
    <div className="p-5 flex items-center justify-end gap-2 border-b border-t border-[#3a3a35] bg-[#1a1a18]">
      <span className="text-[#9ca3af] text-xs uppercase tracking-wider">Pace Analysis Period:</span>
      <Select value={paceAnalysisPeriod} onValueChange={setPaceAnalysisPeriod}>
        <SelectTrigger className="w-[120px] h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#1f1f1c] border-[#3a3a35]">
          <SelectItem value="1" className="text-[#e5e5e5] focus:bg-[#262626] focus:text-[#faff6a]">1 Day</SelectItem>
          <SelectItem value="3" className="text-[#e5e5e5] focus:bg-[#262626] focus:text-[#faff6a]">3 Days</SelectItem>
          <SelectItem value="7" className="text-[#e5e5e5] focus:bg-[#262626] focus:text-[#faff6a]">7 Days</SelectItem>
        </SelectContent>
      </Select>
    </div>

            {/* Chart 4: Market Price Change */}
            <div className="p-5 border-b border-[#3a3a35]">
              <div className="mb-3">
                <h3 className="text-[#e5e5e5] mb-0.5">{paceAnalysisPeriod} Day Price Change</h3>
                <p className="text-[#9ca3af] text-xs">Price fluctuations vs. {paceAnalysisPeriod} days ago</p>
              </div>
 <div style={{ height: '238px' }}>
                <ResponsiveContainer width="100%" height="100%">
    <BarChart
               data={paceChartData}
                 margin={{ top: 10, right: 55, left: 10, bottom: 20 }}
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
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      interval={6}
                    />
                    <YAxis 
                      stroke="#3a3a35"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      width={45}
                      label={{ value: 'Price Change (£)', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                    />
           <Tooltip
                      cursor={{ fill: 'rgba(250, 255, 106, 0.1)' }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length) {
                          return payload[0].payload.fullDate;
                        }
                        return label;
                      }}
                      contentStyle={{
                        backgroundColor: 'rgba(26, 26, 24, 0.95)',
                        border: '1px solid #3a3a35',
                        borderRadius: '4px',
                        padding: '8px'
                      }}
                      labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
                      itemStyle={{ fontSize: '11px', color: '#e5e5e5' }}
                    />
                    
<Bar 
                      dataKey="priceChange" 
                      name="Price Change (£)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    >
              {paceChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.priceChange >= 0 ? '#22c55e' : '#ef4444'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 1: 3 Day Supply Change */}
 <div className="p-5">
              {/* [MODIFIED] This header now contains the Pace Period dropdown */}
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[#e5e5e5] mb-0.5">{paceAnalysisPeriod} Day Supply Change</h3>
                  <p className="text-[#9ca3af] text-xs">
                    Change in market room supply vs. {paceAnalysisPeriod} days ago
                  </p>
                </div>
                
    
              </div>
 <div style={{ height: '238px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                 data={paceChartData}
                   margin={{ top: 10, right: 55, left: 10, bottom: 20 }}
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
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      interval={6}
                    />
                    <YAxis 
                      stroke="#3a3a35"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={{ stroke: '#3a3a35' }}
                      axisLine={{ stroke: '#3a3a35' }}
                      width={45}
                      label={{ value: 'Supply Change', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 10 }}
                    />
         <Tooltip
              cursor={{ fill: 'rgba(250, 255, 106, 0.1)' }}
              labelFormatter={(label, payload) => {
                if (payload && payload.length) {
                  return payload[0].payload.fullDate;
                }
                return label;
              }}
              // [NEW] Add formatter to append '%'
              formatter={(value, name) => {
                return [`${value}%`, name];
              }}
              contentStyle={{
                backgroundColor: 'rgba(26, 26, 24, 0.95)',
                border: '1px solid #3a3a35',
                borderRadius: '4px',
                padding: '8px'
              }}
              labelStyle={{ color: '#9ca3af', fontSize: '10px' }}
              itemStyle={{ fontSize: '11px', color: '#e5e5e5' }}
            />
                    
               <Bar 
                      dataKey="supplyChange" 
                      name="Supply Change (Properties)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    >
                {paceChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                  fill={entry.supplyChange >= 0 ? '#22c55e' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Attribution Footer */}
      <div className="text-center text-[#6b7280] text-xs mt-6 pb-4">
        Market intelligence powered by live channel data • Updated daily • Last refresh: 3 Nov 2025
      </div>
{/* [NEW] Market Saturation & Demand Patterns */}
      {/* [MODIFIED] This now passes live 90-day forward-looking data. */}
      <div className="mt-6">
        <MarketDemandPatterns patterns={futurePatterns} />
      </div>

    
    </div>
  );
}
