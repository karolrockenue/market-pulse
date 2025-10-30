import { Trophy } from 'lucide-react';

export function TopPerformers() {
  const topHotels = [
    { rank: 1, name: 'The London Ritz', revpar: 342, growth: 25.3 },
    { rank: 2, name: 'Claridge\'s', revpar: 318, growth: 18.7 },
    { rank: 3, name: 'The Savoy', revpar: 295, growth: 22.1 },
    { rank: 4, name: 'Mandarin Oriental', revpar: 287, growth: 15.8 },
  ];

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-[#faff6a]" />
        <h2 className="text-[#e5e5e5] text-sm">Top Performers</h2>
      </div>
      
      <div className="space-y-2">
        {topHotels.map((hotel) => (
          <div key={hotel.rank} className="flex items-center justify-between p-2 bg-[#1f1f1c] rounded hover:bg-[#3a3a35]/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] ${
                hotel.rank === 1 ? 'bg-[#faff6a]/20 text-[#faff6a]' : 'bg-[#3a3a35] text-[#9ca3af]'
              }`}>
                {hotel.rank}
              </div>
              <div>
                <div className="text-[#e5e5e5] text-xs">{hotel.name}</div>
                <div className="text-[#9ca3af] text-[10px]">${hotel.revpar}</div>
              </div>
            </div>
            <div className="text-[#10b981] text-xs">
              +{hotel.growth}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
