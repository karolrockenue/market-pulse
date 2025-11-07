interface RankingData {
  metric: string;
  rank: number;
  total: number;
}

interface MarketRankingCardProps {
  rankings: RankingData[];
}

export function MarketRankingCard({ rankings }: MarketRankingCardProps) {
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

const getRankColor = (rank: number, total: number) => {
    // Calculate the percentile rank (e.g., rank 1 in 100 is 1st percentile)
    const percentileRank = rank / total;

    // 1. GREEN for the Top 33%
    // We use <= 0.34 to include the top third (e.g., rank 34 in 100 is 0.34)
    if (percentileRank <= 0.34) {
      return '#10b981'; // Green
    }
    
    // 2. RED for the Bottom 33%
    // We use > 0.67 for the bottom third (e.g., rank 67 in 100 is 0.67, so 68+ is red)
    if (percentileRank > 0.67) {
      return '#ef4444'; // Red
    }
    
    // 3. YELLOW for everything in the middle
    return '#facc15'; // Yellow
  };

  const getRankBgColor = (rank: number, total: number) => {
    // Calculate the percentile rank (e.g., rank 1 in 100 is 1st percentile)
    const percentileRank = rank / total;

    // 1. GREEN background for the Top 33%
    if (percentileRank <= 0.34) {
      return 'rgba(16, 185, 129, 0.15)'; // Green bg
    }
    
    // 2. RED background for the Bottom 33%
    if (percentileRank > 0.67) {
      return 'rgba(239, 68, 68, 0.15)'; // Red bg
    }
    
    // 3. YELLOW background for the middle
    return 'rgba(250, 204, 21, 0.15)'; // Yellow bg
  };

  const getPercentile = (rank: number, total: number) => {
    return Math.round(((total - rank) / total) * 100);
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-3">
      <h3 className="text-[#e5e5e5] mb-3 text-sm">Market Ranking</h3>
      
      <div className="space-y-2">
        {rankings.map((ranking, index) => {
          const color = getRankColor(ranking.rank, ranking.total);
          const bgColor = getRankBgColor(ranking.rank, ranking.total);
          const percentile = getPercentile(ranking.rank, ranking.total);
          
          return (
            <div key={index} className="p-3 bg-[#1f1f1c] rounded">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[#e5e5e5] text-xs">{ranking.metric}</div>
                <div 
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ 
                    color,
                    backgroundColor: bgColor
                  }}
                >
                  {getOrdinal(ranking.rank)} of {ranking.total}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-2 bg-[#252521] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${percentile}%`,
                        backgroundColor: color
                      }}
                    />
                  </div>
                </div>
                <div className="text-[#9ca3af] text-xs whitespace-nowrap">
                  {percentile}th percentile
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
