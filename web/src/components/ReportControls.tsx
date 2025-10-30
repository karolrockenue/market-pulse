import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Calendar, Play, Loader2 } from 'lucide-react'; // Import Loader2

interface ReportControlsProps {
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  datePreset: string;
  setDatePreset: (preset: string) => void;
  granularity: string;
  setGranularity: (granularity: string) => void;
  onRunReport: () => void;
  isLoading: boolean; // Add the new prop
}

export function ReportControls({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  datePreset,
  setDatePreset,
  granularity,
setGranularity,
onRunReport,
isLoading, // Destructure the new prop
}: ReportControlsProps) {
  const presets = [
    { value: 'last-week', label: 'Last Week' },
    { value: 'current-week', label: 'Current Week' },
    { value: 'current-month', label: 'Current Month' },
    { value: 'next-month', label: 'Next Month' },
    { value: 'year-to-date', label: 'Year-to-Date' },
    { value: 'this-year', label: 'This Year' },
    { value: 'last-year', label: 'Last Year' },
  ];

  return (
    <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
      <h3 className="text-[#e5e5e5] mb-4">Report Period</h3>
      
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">Date Preset</label>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
              {presets.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-sm"
          />
        </div>

        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-sm"
          />
        </div>

        <div>
          <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">Granularity</label>
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

<Button 
  onClick={onRunReport}
  disabled={isLoading} // Disable button when loading
  className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] h-10 px-6"
>
  {isLoading ? (
    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> // Show spinner
  ) : (
    <Play className="w-4 h-4 mr-2" /> // Show play icon
  )}
  {isLoading ? 'Running Report...' : 'Run Report'} 
</Button>
    </div>
  );
}
