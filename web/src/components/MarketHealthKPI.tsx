import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketHealthKPIProps {
  status: 'up' | 'down';
  change: number;
}

export function MarketHealthKPI({ status, change }: MarketHealthKPIProps) {
  const isUp = status === 'up';

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#9ca3af] text-xs mb-1">Market Health</div>
          <div className={`text-2xl ${isUp ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {isUp ? 'UP' : 'DOWN'}
          </div>
        </div>
        <div className="text-right">
          {isUp ? (
            <TrendingUp className="w-6 h-6 text-[#10b981] mb-1" />
          ) : (
            <TrendingDown className="w-6 h-6 text-[#ef4444] mb-1" />
          )}
          <div className={`text-lg ${isUp ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {isUp ? '+' : ''}{change}%
          </div>
        </div>
      </div>
      <div className="text-[#9ca3af] text-xs mt-1">vs Prior Year</div>
    </div>
  );
}
