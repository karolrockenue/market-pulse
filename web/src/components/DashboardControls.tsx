import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface DashboardControlsProps {
  granularity: string;
  setGranularity: (value: string) => void;
  datePreset: string;
  setDatePreset: (value: string) => void;
  comparisonMetric: string;
  setComparisonMetric: (value: string) => void;
}

export function DashboardControls({
  granularity,
  setGranularity,
  datePreset,
  setDatePreset,
  comparisonMetric,
  setComparisonMetric,
}: DashboardControlsProps) {
  return (
    <div className="bg-[#262626]/30 rounded border border-[#3a3a35]/50 p-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-[#6b7280] text-xs">View:</label>
        <div className="flex gap-1">
          {['Daily', 'Weekly', 'Monthly'].map((option) => (
            <button
              key={option}
              onClick={() => setGranularity(option)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                granularity === option
                  ? 'bg-[#3a3a35] text-[#e5e5e5]'
                  : 'bg-transparent text-[#9ca3af] hover:text-[#e5e5e5]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="h-4 w-px bg-[#3a3a35]/50" />

      <div className="flex items-center gap-2">
        <label className="text-[#6b7280] text-xs">Period:</label>
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-36 h-7 bg-[#3a3a35] border-[#4a4a45] text-[#e5e5e5] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
            <SelectItem value="previous-month">Previous Month</SelectItem>
            <SelectItem value="current-month">Current Month</SelectItem>
            <SelectItem value="next-month">Next Month</SelectItem>
            <SelectItem value="ytd">Year-to-Date</SelectItem>
            <SelectItem value="this-year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[#6b7280] text-xs">Metric:</label>
        <Select value={comparisonMetric} onValueChange={setComparisonMetric}>
          <SelectTrigger className="w-32 h-7 bg-[#3a3a35] border-[#4a4a45] text-[#e5e5e5] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
            <SelectItem value="occupancy">Occupancy</SelectItem>
            <SelectItem value="adr">ADR</SelectItem>
            <SelectItem value="revpar">RevPAR</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
