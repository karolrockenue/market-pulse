import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState } from 'react';

export function MarketSeasonality() {
  const [selectedYear, setSelectedYear] = useState('2025');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const getPerformanceLevel = () => {
    const rand = Math.random();
    if (rand > 0.66) return 'high';
    if (rand > 0.33) return 'medium';
    return 'low';
  };

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[#e5e5e5] text-sm">Seasonality Heatmap</h2>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2023">2023</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        {months.map((month, monthIdx) => (
          <div key={month} className="flex items-center gap-1">
            <div className="w-6 text-[#9ca3af] text-[10px]">{month}</div>
            <div className="flex gap-[1px] flex-1">
              {Array.from({ length: daysInMonth[monthIdx] }, (_, dayIdx) => {
                const level = getPerformanceLevel();
                return (
                  <div
                    key={dayIdx}
                    className={`h-3 flex-1 transition-opacity hover:opacity-80 cursor-pointer ${
                      level === 'high' ? 'bg-[#10b981]' :
                      level === 'medium' ? 'bg-[#f59e0b]' :
                      'bg-[#ef4444]'
                    }`}
                    title={`${month} ${dayIdx + 1}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#3a3a35]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[#10b981]" />
          <span className="text-[#9ca3af] text-[10px]">High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[#f59e0b]" />
          <span className="text-[#9ca3af] text-[10px]">Med</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-[#ef4444]" />
          <span className="text-[#9ca3af] text-[10px]">Low</span>
        </div>
      </div>
    </div>
  );
}
