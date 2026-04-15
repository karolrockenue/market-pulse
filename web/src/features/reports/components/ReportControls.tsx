// web/src/features/reports/components/ReportControls.tsx

import { Play, Loader2, CalendarIcon } from 'lucide-react';
import { R } from "../../../styles/tokens";
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

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
  isLoading: boolean;
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
  isLoading,
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

  // Inline styles from OldReportTable.tsx
  const containerStyle = {
    backgroundColor: R.darkBand,
    borderRadius: '8px',
    border: `1px solid ${R.border}`,
    padding: '20px',
    marginBottom: '20px'
  };

  const labelStyle = {
    color: R.textDim,
    fontSize: '12px',
    marginBottom: '8px',
    display: 'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.025em'
  };

  const inputStyle = {
    width: '100%',
    backgroundColor: '#0a0a0a',
    border: `1px solid ${R.border}`,
    color: R.accent,
    fontSize: '14px',
    height: '36px',
    borderRadius: '6px',
    padding: '0 12px',
    fontFamily: 'inherit'
  };

  const buttonStyle = {
    backgroundColor: isLoading ? 'rgba(57, 189, 248, 0.7)' : R.warmTeal, // Blue button
    color: '#0a0a0a',
    height: '36px',
    padding: '0 24px',
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.025em',
    fontSize: '12px',
    fontWeight: '500' as const,
    borderRadius: '6px',
    border: 'none',
    cursor: isLoading ? 'wait' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
    fontFamily: 'inherit',
    marginTop: '23px' // Align with inputs
  };

  return (
    <div style={containerStyle}>
      <h3 style={{
        color: R.accent,
        textTransform: 'uppercase',
        letterSpacing: '-0.025em',
        marginBottom: '16px',
        fontSize: '14px',
        marginTop: 0
      }}>Report Period</h3>
      
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Preset Selector */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={labelStyle}>Date Preset</label>
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            style={inputStyle}
          >
            {presets.map(preset => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={labelStyle}>Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-9"
                style={{
                  backgroundColor: R.sidebar,
                  border: `1px solid ${R.border}`,
                  color: R.accent,
                  fontSize: "13px",
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(new Date(startDate), "dd MMM yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align="start"
              style={{
                backgroundColor: "#1a1a18",
                border: `1px solid ${R.border}`,
              }}
            >
              <Calendar
                mode="single"
                selected={startDate ? new Date(startDate) : undefined}
                onSelect={(d) => d && setStartDate(format(d, "yyyy-MM-dd"))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={labelStyle}>End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-9"
                style={{
                  backgroundColor: R.sidebar,
                  border: `1px solid ${R.border}`,
                  color: R.accent,
                  fontSize: "13px",
                }}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(new Date(endDate), "dd MMM yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align="start"
              style={{
                backgroundColor: "#1a1a18",
                border: `1px solid ${R.border}`,
              }}
            >
              <Calendar
                mode="single"
                selected={endDate ? new Date(endDate) : undefined}
                onSelect={(d) => d && setEndDate(format(d, "yyyy-MM-dd"))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Granularity */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={labelStyle}>Granularity</label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
            style={inputStyle}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* Run Button */}
        <div>
          <button
            onClick={onRunReport}
            disabled={isLoading}
            style={buttonStyle}
          >
            {isLoading ? (
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play style={{ width: '16px', height: '16px' }} />
            )}
            {isLoading ? 'Generating...' : 'Run Report'}
          </button>
        </div>
      </div>
    </div>
  );
}