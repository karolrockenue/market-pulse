import { useMemo } from 'react';
import { MarketOutlookBanner } from './MarketOutlookBanner';
import { DynamicYTDTrend } from './DynamicYTDTrend';
import { ResponsiveContainer, ComposedChart, Bar, Area, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, Award, AlertCircle, ExternalLink } from 'lucide-react';

// [NEW] Define interfaces for the incoming data prop
interface DashboardData {
  snapshot: {
    lastMonth: SnapshotPeriod;
    currentMonth: SnapshotPeriod;
    nextMonth: SnapshotPeriod;
  };
  marketOutlook: {
    status: 'strengthening' | 'softening' | 'stable';
    metric: string;
  };
  forwardDemandChartData: any[];
  demandPatterns: {
    busiestDays: PatternDay[];
    quietestDays: PatternDay[];
  };
rankings: {
    occupancy: Rank;
    adr: Rank;
    revpar: Rank;
  };
  ytdTrend: any; // [TODO] We'll use this in the next feature
  budgetBenchmark: {
    benchmarkOcc: number;
    benchmarkAdr: number;
    source: string;
  } | null;
}

interface SnapshotPeriod {
  label: string;
  revenue: number;
  occupancy: number;
  adr: number;
  yoyChange: number;
  targetRevenue: number | null;
}

interface PatternDay {
  date: string;
  dayOfWeek: string;
  availability: number; // This is our market_demand_score
  supply: number;
}

interface Rank {
  rank: number | string;
  total: number | string;
}
interface HotelDashboardProps {
  onNavigate: (view: string) => void;
  data: DashboardData | null;
  isLoading: boolean;
}
// [NEW] Internal helper component for rendering revenue budget pacing
// [NEW] Internal helper component for rendering revenue budget pacing
function RevenuePacingDisplay({
  currentRevenue,
  targetRevenue,
  onNavigate,
}: {
  currentRevenue: number;
  targetRevenue: number | null;
  onNavigate: () => void;
}) {
  // Case 1: Budget is not configured (targetRevenue is null or 0)
  if (!targetRevenue) {
    return (
      <button
        onClick={onNavigate}
        className="w-full text-center py-2.5 px-3 hover:bg-[#1a1a18] rounded border border-dashed border-[#3a3a35] hover:border-[#6b7280] transition-all group cursor-pointer"
      >
        <div className="text-[#6b7280] text-xs group-hover:text-[#9ca3af] transition-colors">Not configured</div>
        <div className="text-[#6b7280] text-[10px] mt-1 opacity-40 group-hover:opacity-100 group-hover:text-[#9ca3af] transition-all">Click to configure →</div>
      </button>
    );
  }

  // Case 2: Budget is configured
  // 1. Calculate pacing and deltas
  const pacePercent = (currentRevenue / targetRevenue) * 100;
  const deltaAmount = currentRevenue - targetRevenue;
  
  // 2. Determine labels and colors
  const statusLabel = deltaAmount >= 0 ? "On Target" : "Off Target";
  const color = deltaAmount >= 0 ? '#10b981' : '#ef4444'; // Green or Red
  
  const formattedTarget = `£${targetRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const formattedDelta = `£${Math.abs(deltaAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div
      onClick={onNavigate}
      className="w-full text-left py-1 hover:bg-[#1a1a18] rounded transition-colors group cursor-pointer"
    >
      {/* Row 1: Target vs Amount */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <div className="text-[#9ca3af] text-xs">Target</div>
        <div className="text-[#9ca3af] text-xs">{formattedTarget}</div>
      </div>
      
      {/* Row 2: Progress Bar */}
      <div
        className="h-2 rounded-full"
        style={{
          backgroundColor: '#1a1a18', // Bar background
          overflow: 'hidden',
          marginBottom: '4px',
          // [FIX] Add 2px top/bottom markings (border)
          borderTop: '2px solid #3a3a35',
          borderBottom: '2px solid #3a3a35',
          // Adjust height to account for borders
          height: '12px', // 8px bar + 4px border
          display: 'flex',
          alignItems: 'center',
          padding: '2px 0', // Visual padding inside borders
        }}
      >
        <div
          className="h-2 rounded-full" // This is the inner bar
          style={{
            width: `${Math.min(pacePercent, 100)}%`,
            // [FIX] Use the correct fill color from prototype
            backgroundColor: '#9DA3AF', 
            transition: 'width 0.5s',
            height: '8px', // Bar height
          }}
        />
      </div>
      
      {/* Row 3: Status vs Delta */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          className="text-xs"
          style={{ color: color, fontWeight: 500 }}
        >
          {statusLabel}
        </div>
        <div
          className="text-xs"
          style={{ color: color, fontWeight: 500 }}
        >
          {formattedDelta}
        </div>
      </div>
    </div>
  );
}

export function HotelDashboard({ onNavigate, data, isLoading }: HotelDashboardProps) {

  // [NEW] Get data from props, with fallbacks for loading state
// [NEW] Get data from props, with fallbacks for loading state
// [NEW] Get data from props, with fallbacks for loading state
  const snapshot = data?.snapshot || {
    lastMonth: { label: '...', revenue: 0, occupancy: 0, adr: 0, yoyChange: 0, targetRevenue: null },
    currentMonth: { label: '...', revenue: 0, occupancy: 0, adr: 0, yoyChange: 0, targetRevenue: null },
    nextMonth: { label: '...', revenue: 0, occupancy: 0, adr: 0, yoyChange: 0, targetRevenue: null },
  };

  const marketOutlook = data?.marketOutlook || {
    status: 'stable',
    metric: '...',
  };

  const rankings = data?.rankings || {
    occupancy: { rank: '-', total: '-' },
    adr: { rank: '-', total: '-' },
    revpar: { rank: '-', total: '-' },
  };

const trendData = data?.forwardDemandChartData || [];
  const busiestDays = data?.demandPatterns?.busiestDays || [];
  const quietestDays = data?.demandPatterns?.quietestDays || [];
  const ytdTrendData = data?.ytdTrend || []; // [NEW] Add this line
  const budgetBenchmark = data?.budgetBenchmark;
  // [NEW] Helper to format the YOY change
  const formatYOY = (change: number) => {
    if (change === 0 || isNaN(change) || !isFinite(change)) return { trend: 'stable' as 'stable', label: '0.0%' };
    const trend = change > 0 ? 'up' : 'down';
    const sign = change > 0 ? '+' : '';
    return {
      trend: trend as 'up' | 'down',
      label: `${sign}${change.toFixed(1)}%`,
    };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '...';
    const date = new Date(dateStr);
    // Use toLocaleDateString with UTC timezone to prevent off-by-one day errors
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC' 
    });
  };

  // [NEW] Loading overlay
  if (isLoading) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', color: '#9ca3af' }}>
          <div 
            className="w-12 h-12 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"
            style={{ margin: '0 auto 20px auto' }}
          ></div>
          Loading Hotel Dashboard...
        </div>
      </div>
    );
  }

  // [NEW] Error/Empty state
  if (!data) {
    return (
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', color: '#fca5a5' }}>
          <AlertCircle className="w-12 h-12" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '8px' }}>Error Loading Dashboard</h3>
          <p style={{ color: '#9ca3af' }}>
            There was a problem fetching the summary data.
            <br />
            Please try refreshing the page or selecting a different property.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{ padding: '24px' }}
    >
      {/* 1. Top Banner - Market Outlook */}
      <MarketOutlookBanner 
        status={marketOutlook.status} 
        metric={marketOutlook.metric} 
      />

      {/* 2. Performance Snapshot Row */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* === Last Month Card === */}
        <div className="bg-[#262626] rounded-lg border border-[#3a3a35] p-5">
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div className="text-[#9ca3af] text-xs mb-1">Last Month</div>
              <div className="text-[#e5e5e5]">{snapshot.lastMonth.label}</div>
            </div>
            {/* [FIX] Correct IIFE syntax: ( () => { ... } )() */}
            {( () => {
              const yoy = formatYOY(snapshot.lastMonth.yoyChange);
              if (yoy.trend === 'stable') return null; // Don't show badge if 0%
              return (
                <div className={`px-2 py-1 rounded flex items-center gap-1 ${
                  yoy.trend === 'up' 
                    ? 'bg-[#10b981]/10 border border-[#10b981]/30' 
                    : 'bg-[#ef4444]/10 border border-[#ef4444]/30'
                }`}>
                  {yoy.trend === 'up' ? (
                    <TrendingUp className="w-3 h-3 text-[#10b981]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[#ef4444]" />
                  )}
                  <span className={yoy.trend === 'up' ? 'text-[#10b981] text-xs' : 'text-[#ef4444] text-xs'}>
                    YOY {yoy.label}
                  </span>
                </div>
              );
            })()}
          </div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div className="text-[#6b7280] text-xs mb-1">Occupancy</div>
              <div className="text-[#e5e5e5]">{snapshot.lastMonth.occupancy.toFixed(1)}%</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div className="text-[#6b7280] text-xs mb-1">Revenue</div>
              <div className="text-[#e5e5e5] text-2xl">£{snapshot.lastMonth.revenue.toLocaleString()}</div>
            </div>
          </div>
          <div 
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #3a3a35'
            }}
>
            <div className="text-[#6b7280] text-xs mb-2">Budget</div>
   <RevenuePacingDisplay
              currentRevenue={snapshot.lastMonth.revenue}
              targetRevenue={snapshot.lastMonth.targetRevenue}
              onNavigate={() => onNavigate('budgeting')}
            />
          </div>
        </div>

        {/* === Current Month MTD Card === */}
        <div className="bg-[#262626] rounded-lg border border-[#3a3a35] p-5">
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div className="text-[#9ca3af] text-xs mb-1">Current Month</div>
              <div className="text-[#e5e5e5]">{snapshot.currentMonth.label}</div>
            </div>
            {/* [FIX] Correct IIFE syntax: ( () => { ... } )() */}
            {( () => {
              const yoy = formatYOY(snapshot.currentMonth.yoyChange);
              if (yoy.trend === 'stable') return null;
              return (
                <div className={`px-2 py-1 rounded flex items-center gap-1 ${
                  yoy.trend === 'up' 
                    ? 'bg-[#10b981]/10 border border-[#10b981]/30' 
                    : 'bg-[#ef4444]/10 border border-[#ef4444]/30'
                }`}>
                  {yoy.trend === 'up' ? (
                    <TrendingUp className="w-3 h-3 text-[#10b981]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[#ef4444]" />
                  )}
                  <span className={yoy.trend === 'up' ? 'text-[#10b981] text-xs' : 'text-[#ef4444] text-xs'}>
                    YOY {yoy.label}
                  </span>
                </div>
              );
            })()}
          </div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div className="text-[#6b7280] text-xs mb-1">Occupancy</div>
              <div className="text-[#e5e5e5]">{snapshot.currentMonth.occupancy.toFixed(1)}%</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div className="text-[#6b7280] text-xs mb-1">Revenue</div>
              <div className="text-[#e5e5e5] text-2xl">£{snapshot.currentMonth.revenue.toLocaleString()}</div>
            </div>
          </div>
          <div 
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #3a3a35'
            }}
>
            <div className="text-[#6b7280] text-xs mb-2">Budget</div>
      <RevenuePacingDisplay
              currentRevenue={snapshot.currentMonth.revenue}
              targetRevenue={snapshot.currentMonth.targetRevenue}
              onNavigate={() => onNavigate('budgeting')}
            />
          </div>
        </div>

        {/* === Next Month OTB Card === */}
        <div className="bg-[#262626] rounded-lg border border-[#3a3a35] p-5">
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div className="text-[#9ca3af] text-xs mb-1">Next Month</div>
              <div className="text-[#e5e5e5]">{snapshot.nextMonth.label}</div>
            </div>
             {/* [FIX] Correct IIFE syntax: ( () => { ... } )() */}
             {( () => {
              const yoy = formatYOY(snapshot.nextMonth.yoyChange);
              if (yoy.trend === 'stable') return null;
              return (
                <div className={`px-2 py-1 rounded flex items-center gap-1 ${
                  yoy.trend === 'up' 
                    ? 'bg-[#10b981]/10 border border-[#10b981]/30' 
                    : 'bg-[#ef4444]/10 border border-[#ef4444]/30'
                }`}>
                  {yoy.trend === 'up' ? (
                    <TrendingUp className="w-3 h-3 text-[#10b981]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[#ef4444]" />
                  )}
                  <span className={yoy.trend === 'up' ? 'text-[#10b981] text-xs' : 'text-[#ef4444] text-xs'}>
                    YOY {yoy.label}
                  </span>
                </div>
              );
            })()}
          </div>
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div className="text-[#6b7280] text-xs mb-1">Occupancy</div>
              <div className="text-[#e5e5e5]">{snapshot.nextMonth.occupancy.toFixed(1)}%</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div className="text-[#6b7280] text-xs mb-1">Revenue</div>
              <div className="text-[#e5e5e5] text-2xl">£{snapshot.nextMonth.revenue.toLocaleString()}</div>
            </div>
          </div>
          <div 
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid #3a3a35'
            }}
          >
            <div className="text-[#6b7280] text-xs mb-2">Budget</div>
     <RevenuePacingDisplay
              currentRevenue={snapshot.nextMonth.revenue}
              targetRevenue={snapshot.nextMonth.targetRevenue}
              onNavigate={() => onNavigate('budgeting')}
            />
          </div>
        </div>
      </div>

      {/* 3. Mission Control Grid */}
      <div 
        style={{
          display: 'grid',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Tile 2: 90-Day Market Demand */}
        <button
          onClick={() => onNavigate('demand-pace')} // [FIX] Navigate to correct page
          className="bg-[#262626] rounded-lg border border-[#3a3a35] p-6 text-left hover:border-[#faff6a]/50 hover:shadow-[0_0_20px_rgba(250,255,106,0.15)] transition-all group"
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div className="w-10 h-10 rounded-lg bg-[#faff6a]/10 flex items-center justify-center group-hover:bg-[#faff6a]/20 transition-colors">
                <BarChart3 className="w-5 h-5 text-[#faff6a]" />
              </div>
              <div>
                <h3 className="text-[#e5e5e5] mb-1">90-Day Market Demand</h3>
                <p className="text-[#6b7280] text-xs">Forward-looking outlook</p>
              </div>
            </div>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="text-[#faff6a] text-xs opacity-0 group-hover:opacity-100 transition-opacity">View</span>
              <ExternalLink className="w-4 h-4 text-[#6b7280] group-hover:text-[#faff6a] group-hover:scale-110 transition-all" />
            </div>
          </div>

          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={trendData}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <CartesianGrid 
                  strokeDasharray="0" 
                  stroke="#2a2a25" 
                  opacity={0.5} 
                  vertical={true}
                  horizontal={true}
                />
                <XAxis 
                  dataKey="date" 
                  stroke="#3a3a35"
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  tickLine={{ stroke: '#3a3a35' }}
                  axisLine={{ stroke: '#3a3a35' }}
                  interval={13}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#3a3a35"
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  tickLine={{ stroke: '#3a3a35' }}
                  axisLine={{ stroke: '#3a3a35' }}
                  width={35}
                  domain={[0, 100]}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#3a3a35"
                  tick={{ fill: '#6b7280', fontSize: 9 }}
                  tickLine={{ stroke: '#3a3a35' }}
                  axisLine={{ stroke: '#3a3a35' }}
                  width={35}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(250, 255, 106, 0.1)' }}
                  contentStyle={{
                    backgroundColor: 'rgba(26, 26, 24, 0.95)',
                    border: '1px solid #3a3a35',
                    borderRadius: '4px',
                    padding: '6px',
                    fontSize: '10px'
                  }}
                  labelStyle={{ color: '#9ca3af', fontSize: '9px' }}
                  itemStyle={{ fontSize: '10px', color: '#e5e5e5' }}
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
                  radius={[2, 2, 0, 0]}
                  maxBarSize={16}
                  fillOpacity={0.85}
                >
                  {trendData.map((entry, index) => {
                    let fill = '#3b82f6'; // Normal/low (blue)
                    if (entry.marketDemand >= 85) fill = '#ef4444'; // Critical (red)
                    else if (entry.marketDemand >= 70) fill = '#f97316'; // High (softer orange)
                    
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Market Demand Patterns - Integrated */}
          <div 
            style={{
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid #3a3a35'
            }}
          >
      <div style={{ marginBottom: '20px' }}>
              <h2 className="text-[#e5e5e5] text-lg mb-1">90-Day Demand Highlights</h2>
              <p className="text-[#9ca3af] text-xs">
                Key high-demand and low-demand days from the 90-day forecast.
              </p>
            </div>
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '24px'
              }}
            >
              {/* Top 5 Busiest Days */}
              <div>
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#ef4444]/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[#ef4444]" />
                  </div>
              <div>
                    <div className="text-[#e5e5e5] text-sm">Top 5 Busiest Days</div>
                    <div className="text-[#9ca3af] text-xs">Highest forward-looking market demand</div>
                  </div>
                </div>

                <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
                  {/* Header */}
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, 1fr)',
                      gap: '8px',
                      padding: '8px 12px'
                    }}
                    className="border-b border-[#3a3a35] bg-[#1a1a18]"
                  >
                    <div style={{ gridColumn: 'span 1' }} className="text-[#9ca3af] text-[10px] uppercase">#</div>
                    <div style={{ gridColumn: 'span 5' }} className="text-[#9ca3af] text-[10px] uppercase">Date</div>
                    <div style={{ gridColumn: 'span 3', textAlign: 'right' }} className="text-[#9ca3af] text-[10px] uppercase">Supply</div>
                    <div style={{ gridColumn: 'span 3', textAlign: 'right' }} className="text-[#9ca3af] text-[10px] uppercase">Demand</div>
                  </div>

                  <div>
                    {busiestDays.map((day, index) => (
                      <div 
                        key={day.date} 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(12, 1fr)',
                          gap: '8px',
                          padding: '10px 12px',
                          borderTop: index === 0 ? 'none' : '1px solid #3a3a35'
                        }}
                        className="hover:bg-[#3a3a35]/30 transition-colors"
                      >
                        <div style={{ gridColumn: 'span 1' }} className="text-[#6b7280] text-xs">{index + 1}</div>
                        <div style={{ gridColumn: 'span 5' }}>
                          <div className="text-[#e5e5e5] text-xs">{formatDate(day.date)}</div>
                          <div className="text-[#6b7280] text-[10px]">{day.dayOfWeek}</div>
                        </div>
                        <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                          <div className="text-[#9ca3af] text-[10px]">{day.supply?.toLocaleString()}</div>
                        </div>
                        <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                          <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-[#ef4444]/20 text-[#ef4444]">
                            {day.availability?.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top 5 Quietest Days (Apply same fixes) */}
              <div>
                <div 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '16px'
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-[#10b981]" />
                  </div>
              <div>
                    <div className="text-[#e5e5e5] text-sm">Top 5 Quietest Days</div>
                    <div className="text-[#9ca3af] text-xs">Lowest forward-looking market demand</div>
                  </div>
                </div>

                <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
                  {/* Header */}
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, 1fr)',
                      gap: '8px',
                      padding: '8px 12px'
                    }}
                    className="border-b border-[#3a3a35] bg-[#1a1a18]"
                  >
                    <div style={{ gridColumn: 'span 1' }} className="text-[#9ca3af] text-[10px] uppercase">#</div>
                    <div style={{ gridColumn: 'span 5' }} className="text-[#9ca3af] text-[10px] uppercase">Date</div>
                    <div style={{ gridColumn: 'span 3', textAlign: 'right' }} className="text-[#9ca3af] text-[10px] uppercase">Supply</div>
                    <div style={{ gridColumn: 'span 3', textAlign: 'right' }} className="text-[#9ca3af] text-[10px] uppercase">Demand</div>
                  </div>

                  <div>
                    {quietestDays.map((day, index) => (
                      <div 
                        key={day.date} 
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(12, 1fr)',
                          gap: '8px',
                          padding: '10px 12px',
                          borderTop: index === 0 ? 'none' : '1px solid #3a3a35'
                        }}
                        className="hover:bg-[#3a3a35]/30 transition-colors"
                      >
                        <div style={{ gridColumn: 'span 1' }} className="text-[#6b7280] text-xs">{index + 1}</div>
                        <div style={{ gridColumn: 'span 5' }}>
                          <div className="text-[#e5e5e5] text-xs">{formatDate(day.date)}</div>
                          <div className="text-[#6b7280] text-[10px]">{day.dayOfWeek}</div>
                        </div>
                        <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                          <div className="text-[#9ca3af] text-[10px]">{day.supply?.toLocaleString()}</div>
                        </div>
                        <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                          <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-[#10b981]/20 text-[#10b981]">
                            {day.availability?.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* 5. Revenue YTD Trend & Budget Pacing */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginTop: '24px'
        }}
      >
{/* Dynamic YTD Trend - 60% width (3 cols) */}
        <div style={{ gridColumn: 'span 3' }}>
          {/* [FIX] Pass live data to DynamicYTDTrend */}
          <DynamicYTDTrend onNavigate={() => onNavigate('reports')} data={ytdTrendData} />
        </div>

        {/* Comp Set Rank - 40% width (2 cols) */}
        <div style={{ gridColumn: 'span 2' }}>
          <button
            onClick={() => onNavigate('youVsCompSet')} // [FIX] Navigate to correct page
            className="w-full bg-[#262626] rounded-lg border border-[#3a3a35] p-6 text-left hover:border-[#faff6a]/50 hover:shadow-[0_0_20px_rgba(250,255,106,0.15)] transition-all group"
          >
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}
            >
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div className="w-10 h-10 rounded-lg bg-[#faff6a]/10 flex items-center justify-center group-hover:bg-[#faff6a]/20 transition-colors">
                  <Award className="w-5 h-5 text-[#faff6a]" />
                </div>
                <div>
                  <h3 className="text-[#e5e5e5] mb-1">Comp Set Rank</h3>
                  <p className="text-[#6b7280] text-xs">Your market position (Last Month)</p>
                </div>
              </div>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="text-[#faff6a] text-xs opacity-0 group-hover:opacity-100 transition-opacity">View</span>
                <ExternalLink className="w-4 h-4 text-[#6b7280] group-hover:text-[#faff6a] group-hover:scale-110 transition-all" />
              </div>
            </div>

            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(1, 1fr)',
                gap: '12px'
              }}
            >
              {[
                { metric: 'Occupancy', ...rankings.occupancy },
                { metric: 'ADR', ...rankings.adr },
                { metric: 'RevPAR', ...rankings.revpar },
              ].map((ranking, index) => {
                const getOrdinal = (n: number | string) => {
                  if (typeof n !== 'number') return n;
                  const s = ['th', 'st', 'nd', 'rd'];
                  const v = n % 100;
                  return n + (s[(v - 20) % 10] || s[v] || s[0]);
                };

                const getRankColor = (rank: number | string, total: number | string) => {
                  if (typeof rank !== 'number' || typeof total !== 'number') return '#9ca3af';
                  if (rank === 1) return '#faff6a';
                  if (rank <= 3) return '#10b981';
                  if (rank > total * 0.75) return '#ef4444';
                  return '#9ca3af';
                };

                const getRankBgColor = (rank: number | string, total: number | string) => {
                  if (typeof rank !== 'number' || typeof total !== 'number') return 'rgba(156, 163, 175, 0.15)';
                  if (rank === 1) return 'rgba(250, 255, 106, 0.15)';
                  if (rank <= 3) return 'rgba(16, 185, 129, 0.15)';
                  if (rank > total * 0.75) return 'rgba(239, 68, 68, 0.15)';
                  return 'rgba(156, 163, 175, 0.15)';
                };

                const getPercentile = (rank: number | string, total: number | string) => {
                  if (typeof rank !== 'number' || typeof total !== 'number' || total === 0) return 0;
                  return Math.round(((total - rank) / total) * 100);
                };

                const color = getRankColor(ranking.rank, ranking.total);
                const bgColor = getRankBgColor(ranking.rank, ranking.total);
                const percentile = getPercentile(ranking.rank, ranking.total);

                return (
                  <div 
                    key={index} 
                    style={{ padding: '12px' }}
                    className="bg-[#1f1f1c] rounded"
                  >
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}
                    >
                      <div className="text-[#e5e5e5] text-xs">{ranking.metric}</div>
                      <div 
                        className="px-2 py-1 rounded text-xs"
                        style={{ 
                          color,
                          backgroundColor: bgColor
                        }}
                      >
                        {getOrdinal(ranking.rank)} of {ranking.total}
                      </div>
                    </div>
                    
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div className="h-1.5 bg-[#252521] rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${percentile}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-[#9ca3af] text-[10px] whitespace-nowrap">
                        {percentile}th
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}