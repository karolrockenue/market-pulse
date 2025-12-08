// web/src/features/reports/components/ReportControls.tsx

import { Play, Loader2 } from 'lucide-react';

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
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    padding: '20px',
    marginBottom: '20px'
  };

  const labelStyle = {
    color: '#6b7280',
    fontSize: '12px',
    marginBottom: '8px',
    display: 'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.025em'
  };

  const inputStyle = {
    width: '100%',
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#e5e5e5',
    fontSize: '14px',
    height: '36px',
    borderRadius: '6px',
    padding: '0 12px',
    fontFamily: 'inherit'
  };

  const buttonStyle = {
    backgroundColor: isLoading ? 'rgba(57, 189, 248, 0.7)' : '#39BDF8', // Blue button
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
        color: '#e5e5e5',
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* End Date */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={labelStyle}>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
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