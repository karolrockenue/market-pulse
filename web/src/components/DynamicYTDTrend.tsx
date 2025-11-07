import { TrendingUp, ExternalLink } from 'lucide-react';

// [NEW] Interface now matches the data we receive from the API
interface MonthData {
  month: string;
  monthIndex: number;
  thisYear: number;
  lastYear: number;
  variance: number;
  isMTD?: boolean;
}

interface DynamicYTDTrendProps {
  onNavigate?: (view: string) => void;
  data?: MonthData[]; // [NEW] Accept data as a prop
}

export function DynamicYTDTrend({ onNavigate, data: propData }: DynamicYTDTrendProps) {
  

// [NEW] Use the prop data, default to empty array
  // [FIX] Ensure data is always an array to prevent .map() crash
  const data = Array.isArray(propData) ? propData : [];

// [NEW] Simplified formatter, hardcoded for revenue
  const formatValue = (value: number): string => {
    return `£${Math.round(value).toLocaleString()}`;
  };

  const formatVariance = (variance: number): string => {
    const sign = variance >= 0 ? '+' : '';
    return `${sign}${variance.toFixed(1)}%`;
  };



  return (
    <button
      // The className prop is still valid for shadcn/ui components and interactivity
      className="bg-[#2C2C2C] rounded-lg border border-[#3a3a35] w-full text-left hover:border-[#faff6a]/50 hover:shadow-[0_0_20px_rgba(250,255,106,0.15)] transition-all group"
      // [FIX] Add inline style for padding
      style={{ padding: '24px' }}
onClick={onNavigate ? () => onNavigate('reports') : undefined}
      disabled={!onNavigate}
    >
      {/* Header */}
      <div 
        // [FIX] Replaced 'flex items-start justify-between mb-4'
        style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          justifyContent: 'space-between', 
          marginBottom: '16px' 
        }}
      >
        <div 
          // [FIX] Replaced 'flex items-center gap-2'
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}
        >
          {/* This className is for shadcn/ui component, so it's OK */}
          <div className="w-8 h-8 rounded-full bg-[#faff6a]/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#faff6a]" />
          </div>
 <div>
            {/* These text classes are OK */}
            <div className="text-[#e5e5e5] text-sm">Revenue YTD Trend</div>
            <div className="text-[#9ca3af] text-xs">
              {/* [NEW] This title is now dynamic based on prop data */}
              Year-to-date performance by month ({data.length} {data.length === 1 ? 'month' : 'months'})
            </div>
          </div>
        </div>
        {onNavigate && (
          // [FIX] Replaced 'flex items-center gap-1.5 ...'
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
            // Group hover effects are complex to do inline, so we accept the loss of animation
            // to gain the correct layout.
          >
            <span className="text-[#faff6a] text-xs opacity-0 group-hover:opacity-100 transition-opacity">View</span>
            <ExternalLink className="w-4 h-4 text-[#6b7280] group-hover:text-[#faff6a] group-hover:scale-110 transition-all" />
          </div>
        )}
      </div>

      {/* Table */}
      {/* This className is for shadcn/ui component, so it's OK */}
      <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
        {/* Table Header */}
        <div 
          // [FIX] Replaced 'grid grid-cols-5 gap-2 px-4 py-3 ...'
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '8px',
            padding: '12px 16px',
          }}
          // These classes are for styling, not layout, so they are OK
          className="border-b border-[#3a3a35] bg-[#1a1a18]"
        >
          <div className="text-[#9ca3af] text-[10px] uppercase">Month</div>
          <div className="text-[#9ca3af] text-[10px] uppercase" style={{ textAlign: 'right' }}>Last Year</div>
          <div className="text-[#9ca3af] text-[10px] uppercase" style={{ textAlign: 'right' }}>This Year</div>
          <div className="text-[#9ca3af] text-[10px] uppercase" style={{ textAlign: 'right' }}>Variance</div>
          <div className="text-[#9ca3af] text-[10px] uppercase" style={{ textAlign: 'right' }}>Variance %</div>
        </div>

        {/* Table Body */}
        {/* [FIX] Removed 'divide-y divide-[#3a3a35]' wrapper */}
        <div>
          {data.map((row, index) => (
            <div
              key={row.monthIndex}
              // [FIX] Replaced 'grid grid-cols-5 gap-2 px-4 py-3.5 ...'
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                padding: '14px 16px',
                // [FIX] Manually add the border-top that 'divide-y' was doing
                borderTop: index === 0 ? 'none' : '1px solid #3a3a35'
              }}
              // These classes are for styling/interactivity, so they are OK
              className={`transition-colors ${
                row.isMTD
                  ? 'bg-[#faff6a]/10 border-l-2 border-l-[#faff6a]'
                  : 'hover:bg-[#3a3a35]/30'
              }`}
            >
              {/* Month */}
              <div 
                // [FIX] Replaced 'flex items-center gap-2'
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px' 
                }}
              >
                <span className="text-[#e5e5e5] text-xs">
                  {row.month}
                </span>
                {row.isMTD && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-[#faff6a]/20 text-[#faff6a] border border-[#faff6a]/30">
                    MTD
                  </span>
                )}
              </div>

              {/* Last Year */}
              <div className="text-[#9ca3af] text-xs" style={{ textAlign: 'right' }}>
                {formatValue(row.lastYear)}
              </div>

              {/* This Year */}
              <div className="text-[#e5e5e5] text-xs" style={{ textAlign: 'right' }}>
                {formatValue(row.thisYear)}
              </div>

              {/* Variance (Absolute) */}
              <div className="text-[#e5e5e5] text-xs" style={{ textAlign: 'right' }}>
                {row.thisYear >= row.lastYear ? '+' : ''}{Math.round(row.thisYear - row.lastYear).toLocaleString()}
              </div>

              {/* Variance (%) */}
              <div 
                // [FIX] Replaced 'flex items-center justify-end gap-1'
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'flex-end', 
                  gap: '4px' 
                }}
              >
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                  row.variance >= 0 
                    ? 'bg-[#10b981]/20 text-[#10b981]' 
                    : 'bg-[#ef4444]/20 text-[#ef4444]'
                }`}>
                  {formatVariance(row.variance)}
                </span>
              </div>
            </div>
          ))}
          
          {/* Totals Row */}
          <div 
            // [FIX] Replaced 'grid grid-cols-5 gap-2 px-4 py-3.5 ...'
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              padding: '14px 16px',
            }}
            // These classes are for styling, not layout, so they are OK
            className="bg-[#1a1a18] border-t-2 border-t-[#faff6a]/30"
          >
            {/* Label */}
            <div 
              // [FIX] Replaced 'flex items-center'
              style={{ 
                display: 'flex', 
                alignItems: 'center' 
              }}
            >
              <span className="text-[#faff6a] text-xs font-semibold">YTD Total</span>
            </div>

{/* Last Year Total */}
            <div className="text-[#e5e5e5] text-xs font-semibold" style={{ textAlign: 'right' }}>
              {formatValue(data.reduce((sum, row) => sum + row.lastYear, 0))}
            </div>

            {/* This Year Total */}
            <div className="text-[#e5e5e5] text-xs font-semibold" style={{ textAlign: 'right' }}>
              {formatValue(data.reduce((sum, row) => sum + row.thisYear, 0))}
            </div>

{/* Variance (Absolute) Total */}
            <div className="text-[#e5e5e5] text-xs font-semibold" style={{ textAlign: 'right' }}>
              {(() => {
                const totalLastYear = data.reduce((sum, row) => sum + row.lastYear, 0);
                const totalThisYear = data.reduce((sum, row) => sum + row.thisYear, 0);
                const diff = totalThisYear - totalLastYear;
                return `${diff >= 0 ? '+' : ''}${Math.round(diff).toLocaleString()}`;
              })()}
            </div>

            {/* Variance (%) Total */}
{/* Variance (%) Total */}
            <div 
              // [FIX] Replaced 'flex items-center justify-end gap-1'
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-end', 
                gap: '4px' 
              }}
            >
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${(() => {
                const totalLastYear = data.reduce((sum, row) => sum + row.lastYear, 0);
                if (totalLastYear === 0) return 'bg-[#10b981]/20 text-[#10b981]'; // Handle divide by zero
                const totalThisYear = data.reduce((sum, row) => sum + row.thisYear, 0);
                const variance = ((totalThisYear - totalLastYear) / totalLastYear) * 100;
                return variance >= 0 ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#ef4444]/20 text-[#ef4444]';
              })()}`}>
                {(() => {
                  const totalLastYear = data.reduce((sum, row) => sum + row.lastYear, 0);
                  if (totalLastYear === 0) return '+100.0%'; // Handle divide by zero
                  const totalThisYear = data.reduce((sum, row) => sum + row.thisYear, 0);
                  const variance = ((totalThisYear - totalLastYear) / totalLastYear) * 100;
                  return formatVariance(variance);
                })()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}