interface Breakdown {
  [key: string]: number;
}

interface MarketCompositionCardProps {
  competitorCount: number;
  totalRooms: number;
  breakdown: {
    categories: Breakdown;
    neighborhoods: Breakdown;
  };
}

// Helper component to render a dynamic breakdown section (for Tiers or Neighborhoods)
function BreakdownSection({ title, data, total, colors }: { title: string; data: Breakdown; total: number; colors: { [key: string]: string } }) {
  if (total === 0 || Object.keys(data).length === 0) {
    return (
      <div>
        <div className="text-[#9ca3af] text-xs mb-1.5">{title}</div>
        <div className="text-[#6b7280] text-xs">No data available</div>
      </div>
    );
  }

  const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
  const totalPercentage = sortedData.reduce((sum, [, count]) => sum + (count / total) * 100, 0);

  return (
    <div>
      <div className="text-[#9ca3af] text-xs mb-1.5">{title}</div>
      <div className="h-6 flex rounded overflow-hidden bg-[#1f1f1c]">
        {sortedData.map(([name, count], index) => {
          const percentage = (count / total) * 100;
          return (
            <div
              key={name}
              style={{ width: `${percentage}%`, backgroundColor: colors[name] || '#4b5563' }}
              className="transition-all hover:opacity-80"
              title={`${name}: ${count} hotels (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {sortedData.map(([name, count]) => {
          const percentage = (count / total) * 100;
          return (
            <div key={name} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: colors[name] || '#4b5563' }}
              />
              <span className="text-[#9ca3af] text-xs truncate" title={name}>{name}</span>
              <span className="text-[#e5e5e5] ml-auto text-xs">{percentage.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MarketCompositionCard({ competitorCount, totalRooms, breakdown }: MarketCompositionCardProps) {
  // Define color mappings for dynamic data.
// Define a fixed color map for the known Quality Tiers.
  const qualityTierColors: { [key: string]: string } = {
    'Luxury': '#faff6a',
    'Upper Midscale': '#10b981', // Corrected name to match database
    'Midscale': '#6b7280',
    'Economy': '#4b5563',
    'Hostel': '#a855f7',
    // We can add other known categories here if needed.
  };

  // Define a palette of colors to be used for dynamic neighborhood generation.
  const colorPalette = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#f97316', // Orange
    '#84cc16', // Lime
    '#a855f7', // Purple
    '#eab308', // Yellow
    '#14b8a6', // Teal
  ];

  // This utility converts any string into a consistent color from our palette.
  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colorPalette.length);
    return colorPalette[index];
  };

  // Dynamically create the color map for neighborhoods based on the incoming data.
  const neighborhoodColors = Object.keys(breakdown.neighborhoods).reduce((acc, name) => {
    acc[name] = stringToColor(name);
    return acc;
  }, {} as { [key: string]: string });


  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-3">
      <h3 className="text-[#e5e5e5] mb-3 text-sm">Market Composition</h3>
      
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1f1f1c] rounded p-2">
            <div className="text-[#9ca3af] text-xs mb-1">Competitors</div>
            <div className="text-white text-lg">{competitorCount}</div>
          </div>
          <div className="bg-[#1f1f1c] rounded p-2">
            <div className="text-[#9ca3af] text-xs mb-1">Total Rooms</div>
            <div className="text-white text-lg">{totalRooms.toLocaleString()}</div>
          </div>
        </div>

        <div className="pt-2 border-t border-[#3a3a35] space-y-3">
          <BreakdownSection 
            title="Quality Tiers" 
            data={breakdown.categories} 
            total={competitorCount}
            colors={qualityTierColors}
          />
          <BreakdownSection 
            title="Neighborhoods" 
            data={breakdown.neighborhoods} 
            total={competitorCount}
            colors={neighborhoodColors}
          />
        </div>
      </div>
    </div>
  );
}