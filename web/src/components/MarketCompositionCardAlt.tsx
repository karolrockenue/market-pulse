import { Building2, MapPin } from 'lucide-react';

// Define the shape of the NEW data we expect from the API.
interface CategoryBreakdown {
  properties: number;
  rooms: number;
  neighborhoods: { [key: string]: number };
}

interface MarketCompositionData {
  competitorCount: number;
  totalRooms: number;
  breakdown: {
    categories: { [key: string]: CategoryBreakdown };
    neighborhoods: { [key: string]: number };
  };
}

// A helper function to generate consistent, visually distinct colors for neighborhoods.
const generateColor = (index: number) => {
  const colors = ['#faff6a', '#10b981', '#6366f1', '#f59e0b', '#9ca3af', '#ef4444'];
  return colors[index % colors.length];
};

export function MarketCompositionCardAlt({ 
  competitorCount = 0, 
  totalRooms = 0,
  breakdown
}: MarketCompositionData) {
  
  // Transform the live 'neighborhoods' summary into a list with assigned colors.
  const areaSummary = Object.entries(breakdown?.neighborhoods || {}).map(([name, count], index) => ({
    name,
    count,
    color: generateColor(index),
  }));

  // Create a map of neighborhood names to their colors for easy lookup.
  const areaColorMap = new Map(areaSummary.map(area => [area.name, area.color]));

  // Transform the live 'categories' data into the format needed by the UI.
  const tierData = Object.entries(breakdown?.categories || {}).map(([name, data]) => ({
    name,
    properties: data.properties,
    rooms: data.rooms,
    // Transform the nested neighborhood data for this tier.
  // The "|| {}" is the fix. It prevents a crash if data.neighborhoods is not yet available.
    areas: Object.entries(data.neighborhoods || {}).map(([areaName, count]) => ({
      name: areaName,
      count: count,
      color: areaColorMap.get(areaName) || '#ffffff', // Use the color map, default to white.
    })),
  }));

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-4">
      <div className="mb-4">
        <h3 className="text-[#e5e5e5] mb-3">Comp Set Breakdown</h3>
        
{/* Key Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* The padding class has been increased from p-2.5 to p-4 for more internal spacing. */}
          <div className="bg-[#1f1f1c] rounded p-4 text-center">
            <div className="text-[#9ca3af] text-[10px] mb-1">Total Rooms</div>
            <div className="text-[#e5e5e5]">{totalRooms > 0 ? totalRooms.toLocaleString() : '-'}</div>
          </div>
          {/* The padding class has been increased from p-2.5 to p-4 for more internal spacing. */}
          <div className="bg-[#1f1f1c] rounded p-4 text-center">
            <div className="text-[#9ca3af] text-[10px] mb-1">Competitors</div>
            <div className="text-[#e5e5e5]">{competitorCount > 0 ? competitorCount : '-'}</div>
          </div>
          {/* The padding class has been increased from p-2.5 to p-4 for more internal spacing. */}
          <div className="bg-[#1f1f1c] rounded p-4 text-center">
            <div className="text-[#9ca3af] text-[10px] mb-1">Avg Size</div>
            <div className="text-[#e5e5e5]">{totalRooms > 0 && competitorCount > 0 ? Math.round(totalRooms / competitorCount) : '-'}</div>
          </div>
        </div>
      </div>

      {/* Tier Distribution with Areas */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-[#9ca3af] text-xs mb-2">
          <Building2 className="w-3.5 h-3.5" />
          <span>Property Distribution by Tier & Area</span>
        </div>
        
        {tierData.map((tier, index) => (
          <div key={index} className="bg-[#1f1f1c] rounded p-3">
            {/* Tier Header with correct property and room counts */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="text-[#e5e5e5] text-sm">{tier.name}</div>
                <div className="text-[#9ca3af] text-xs">• {tier.properties} properties</div>
              </div>
{/* This now safely handles cases where 'tier.rooms' might be missing from the data. */}
              <div className="text-[#e5e5e5] text-xs">{(tier.rooms || 0).toLocaleString()} rooms</div>
            </div>
            
            {/* Room Count Bar, now functional */}
            <div className="w-full bg-[#2C2C2C] rounded-full h-1.5 mb-2 overflow-hidden">
              <div 
                className="h-full rounded-full"
                style={{ 
                  width: totalRooms > 0 ? `${(tier.rooms / totalRooms) * 100}%` : '0%',
                  backgroundColor: '#faff6a80'
                }}
              />
            </div>

            {/* Area Distribution, now functional */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {tier.areas.map((area, areaIndex) => (
                <div 
                  key={areaIndex}
                  className="flex items-center gap-1 bg-[#2C2C2C] rounded px-2 py-0.5"
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="text-[#9ca3af] text-[10px]">{area.name}</span>
                  <span className="text-[#e5e5e5] text-[10px]">({area.count})</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Area Summary */}
      <div className="pt-3 border-t border-[#3a3a35]">
        <div className="flex items-center gap-2 text-[#9ca3af] text-xs mb-2">
          <MapPin className="w-3.5 h-3.5" />
          <span>Geographic Distribution</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {areaSummary.map((area, index) => (
            <div 
              key={index}
              className="bg-[#1f1f1c] rounded p-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: area.color }}
                />
                <span className="text-[#e5e5e5] text-xs">{area.name}</span>
              </div>
              <span className="text-[#9ca3af] text-xs">{area.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}