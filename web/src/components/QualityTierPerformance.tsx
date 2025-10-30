export function QualityTierPerformance() {
  const tiers = [
    { name: 'Luxury', change: 18.5 },
    { name: 'Upper Mid', change: 12.3 },
    { name: 'Midscale', change: 8.7 },
    { name: 'Economy', change: -3.2 },
    { name: 'Hostel', change: -8.5 },
  ];

  const maxValue = Math.max(...tiers.map(t => Math.abs(t.change)));

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-4">
      <h2 className="text-[#e5e5e5] text-sm mb-4">YoY by Quality Tier</h2>
      
      <div className="space-y-2">
        {tiers.map((tier) => {
          const isPositive = tier.change >= 0;
          const percentage = (Math.abs(tier.change) / maxValue) * 100;
          
          return (
            <div key={tier.name} className="flex items-center gap-2">
              <div className="w-20 text-[#9ca3af] text-xs text-right">{tier.name}</div>
              
              <div className="flex-1 flex items-center">
                <div className="flex-1 flex justify-end pr-1">
                  {!isPositive && (
                    <div 
                      className="h-6 bg-[#ef4444] rounded-l transition-all hover:opacity-80 flex items-center justify-start pl-2"
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="text-white text-[10px]">{tier.change}%</span>
                    </div>
                  )}
                </div>
                
                <div className="w-px h-8 bg-[#9ca3af]" />
                
                <div className="flex-1 pl-1">
                  {isPositive && (
                    <div 
                      className="h-6 bg-[#10b981] rounded-r transition-all hover:opacity-80 flex items-center justify-end pr-2"
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="text-white text-[10px]">+{tier.change}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
