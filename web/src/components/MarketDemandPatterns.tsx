import { Calendar, TrendingDown, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';

// [MODIFIED] These types now match the prop data
interface DemandDay {
  date: Date; // Was string
  dayOfWeek: string;
  availability: number;
  supply?: number;
}

interface RateDay {
  date: Date; // Was string
  dayOfWeek: string;
  rate: number;
  change: number;
}

// [NEW] Define the interface for the prop we are receiving
interface MarketDemandPatternsProps {
  patterns: {
    busiestDays: DemandDay[];
    quietestDays: DemandDay[];
    biggestIncreases: RateDay[];
    biggestDrops: RateDay[];
  };
}

export function MarketDemandPatterns({ patterns }: MarketDemandPatternsProps) {
  // [NEW] Destructure the patterns from the props
  const { busiestDays, quietestDays, biggestIncreases, biggestDrops } = patterns;

  // [REMOVED] All mock data arrays (busiestDays, quietestDays, etc.) are deleted.
// [MODIFIED] This helper now accepts a Date object directly
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
      <div className="mb-5">
        {/* [MODIFIED] Heading and sub-heading updated */}
        <h2 className="text-[#e5e5e5] text-lg mb-1">90-Day Planning Highlights</h2>
        <p className="text-[#9ca3af] text-xs">
          Key high-demand, low-demand, and rate-change days from the 90-day forecast.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top 5 Busiest Days */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#ef4444]/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#ef4444]" />
            </div>
            <div>
              <div className="text-[#e5e5e5] text-sm">Top 5 Busiest Days</div>
              {/* [MODIFIED] Sub-heading */}
              <div className="text-[#9ca3af] text-xs">Highest forward-looking demand</div>
            </div>
          </div>

          <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-[#3a3a35] bg-[#1a1a18]">
              <div className="col-span-1 text-[#9ca3af] text-[10px] uppercase">#</div>
              <div className="col-span-5 text-[#9ca3af] text-[10px] uppercase">Date</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Available Properties</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Demand</div>
            </div>

            {/* Rows - [MODIFIED] Now maps 'busiestDays' from props */}
            <div className="divide-y divide-[#3a3a35]">
              {busiestDays.map((day, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-[#3a3a35]/30 transition-colors">
                  <div className="col-span-1 text-[#6b7280] text-xs">{index + 1}</div>
                  <div className="col-span-5">
                    <div className="text-[#e5e5e5] text-xs">{formatDate(day.date)}</div>
                    <div className="text-[#6b7280] text-[10px]">{day.dayOfWeek}</div>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="text-[#9ca3af] text-[10px]">{day.supply?.toLocaleString()}</div>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-[#ef4444]/20 text-[#ef4444]">
                      {day.availability.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 5 Quietest Days */}
        <div>
<div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#faff6a]/20 flex items-center justify-center">
          <TrendingDown className="w-4 h-4 text-[#faff6a]" />
        </div>
            <div>
              <div className="text-[#e5e5e5] text-sm">Top 5 Quietest Days</div>
              {/* [MODIFIED] Sub-heading */}
              <div className="text-[#9ca3af] text-xs">Lowest forward-looking demand</div>
            </div>
          </div>

          <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-[#3a3a35] bg-[#1a1a18]">
              <div className="col-span-1 text-[#9ca3af] text-[10px] uppercase">#</div>
              <div className="col-span-5 text-[#9ca3af] text-[10px] uppercase">Date</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Available Properties</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Demand</div>
            </div>

            {/* Rows - [MODIFIED] Now maps 'quietestDays' from props */}
            <div className="divide-y divide-[#3a3a35]">
              {quietestDays.map((day, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-[#3a3a35]/30 transition-colors">
                  <div className="col-span-1 text-[#6b7280] text-xs">{index + 1}</div>
                  <div className="col-span-5">
                    <div className="text-[#e5e5e5] text-xs">{formatDate(day.date)}</div>
                    <div className="text-[#6b7280] text-[10px]">{day.dayOfWeek}</div>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="text-[#9ca3af] text-[10px]">{day.supply?.toLocaleString()}</div>
                  </div>
                  <div className="col-span-3 text-right">
                   <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-[#faff6a]/20 text-[#faff6a]">
                      {day.availability.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 5 Biggest Rate Increases */}
        <div>
<div className="flex items-center gap-2 mb-4">
<div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
        >
          <ArrowUp className="w-4 h-4" style={{ color: '#11B981' }} />
        </div>
            <div>
              <div className="text-[#e5e5e5] text-sm">Top 5 Rate Increases</div>
              {/* [MODIFIED] Sub-heading */}
              <div className="text-[#9ca3af] text-xs">Highest forward-looking price pace</div>
            </div>
          </div>

          <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-[#3a3a35] bg-[#1a1a18]">
              <div className="col-span-1 text-[#9ca3af] text-[10px] uppercase">#</div>
              <div className="col-span-5 text-[#9ca3af] text-[10px] uppercase">Date</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Price Index</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Change</div>
            </div>

            {/* Rows - [MODIFIED] Now maps 'biggestIncreases' from props */}
            <div className="divide-y divide-[#3a3a35]">
              {biggestIncreases.map((day, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-[#3a3a35]/30 transition-colors">
                  <div className="col-span-1 text-[#6b7280] text-xs">{index + 1}</div>
                  <div className="col-span-5">
                    <div className="text-[#e5e5e5] text-xs">{formatDate(day.date)}</div>
                    <div className="text-[#6b7280] text-[10px]">{day.dayOfWeek}</div>
                  </div>
                  <div className="col-span-3 text-right">
    <div className="text-[#e5e5e5] text-xs">{day.rate.toFixed(0)}</div>
                  </div>
                  <div className="col-span-3 text-right">
<div 
     className="inline-block px-2 py-0.5 rounded text-[10px]"
     style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#11B981' }}
   >
                      +£{day.change.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top 5 Biggest Rate Drops */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center">
              <ArrowDown className="w-4 h-4 text-[#3b82f6]" />
            </div>
            <div>
              <div className="text-[#e5e5e5] text-sm">Top 5 Rate Drops</div>
              {/* [MODIFIED] Sub-heading */}
              <div className="text-[#9ca3af] text-xs">Largest forward-looking price pace</div>
            </div>
          </div>

          <div className="bg-[#1f1f1c] rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-[#3a3a35] bg-[#1a1a18]">
              <div className="col-span-1 text-[#9ca3af] text-[10px] uppercase">#</div>
              <div className="col-span-5 text-[#9ca3af] text-[10px] uppercase">Date</div>
           <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Price Index</div>
              <div className="col-span-3 text-[#9ca3af] text-[10px] uppercase text-right">Change</div>
            </div>

            {/* Rows - [MODIFIED] Now maps 'biggestDrops' from props */}
            <div className="divide-y divide-[#3a3a35]">
              {biggestDrops.map((day, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 px-3 py-2.5 hover:bg-[#3a3a35]/30 transition-colors">
                  <div className="col-span-1 text-[#6b7280] text-xs">{index + 1}</div>
                  <div className="col-span-5">
                    <div className="text-[#e5e5e5] text-xs">{formatDate(day.date)}</div>
                    <div className="text-[#6b7280] text-[10px]">{day.dayOfWeek}</div>
                  </div>
                  <div className="col-span-3 text-right">
       <div className="text-[#e5e5e5] text-xs">{day.rate.toFixed(0)}</div>
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-[#3b82f6]/20 text-[#3b82f6]">
                      -£{Math.abs(day.change).toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Insight */}
      <div className="mt-5 pt-4 border-t border-[#3a3a35]">
        <div className="bg-[#faff6a]/10 border border-[#faff6a]/30 rounded p-3">
          {/* [MODIFIED] This is the new disclaimer text */}
          <div className="text-[#faff6a] text-xs mb-1">Historical Data vs. Forward-Looking Trends</div>
          <div className="text-[#e5e5e5] text-sm">
            This historical analysis identifies past-year trends and is for informational purposes only. It does not guarantee future performance.
            <br />
            Always cross-reference these historical patterns with the live <strong>90-Day Planning Grid</strong> and <strong>Market Outlook</strong> banner at the top of the page before making pricing decisions.
          </div>
        </div>
      </div>

      {/* Calendar Icon Footer */}
      <div className="mt-4 flex items-center justify-center gap-2 text-[#6b7280]">
        <Calendar className="w-3 h-3" />
        {/* [MODIFIED] Footer text */}
        <span className="text-xs">Based on 90-day forward-looking data from the live forecast</span>
      </div>
    </div>
  );
}