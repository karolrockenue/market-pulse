import { useState, useRef, useEffect, CSSProperties } from 'react';
import { R } from "../../../styles/tokens";
import { Download, Clock, ChevronDown } from 'lucide-react';

interface ReportActionsProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  onCreateSchedule: () => void;
  onManageSchedules: () => void;
}

export function ReportActions({
  onExportCSV,
  onExportExcel,
  onCreateSchedule,
  onManageSchedules,
}: ReportActionsProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (scheduleRef.current && !scheduleRef.current.contains(e.target as Node)) setScheduleOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const buttonStyle: CSSProperties = {
    background: R.heroBg,
    border: `1px solid ${R.border}`,
    color: R.accent,
    padding: '8px 14px',
    fontSize: '13px',
    borderRadius: '4px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  };

  const dropdownStyle: CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    zIndex: 1000,
    background: R.heroBg,
    border: `1px solid ${R.border}`,
    borderRadius: '8px',
    padding: '4px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    minWidth: '200px',
  };

  const menuItemStyle: CSSProperties = {
    padding: '8px 12px',
    color: R.accent,
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.15s',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {/* Export Dropdown */}
      <div ref={exportRef} style={{ position: 'relative' }}>
        <button
          style={buttonStyle}
          onClick={() => { setExportOpen(!exportOpen); setScheduleOpen(false); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = R.heroBg)}
        >
          <Download size={14} color={R.textMid} />
          Export
          <ChevronDown size={12} color={R.textDim} />
        </button>
        {exportOpen && (
          <div style={dropdownStyle}>
            <button
              style={menuItemStyle}
              onClick={() => { onExportCSV(); setExportOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Download as CSV
            </button>
            <button
              style={menuItemStyle}
              onClick={() => { onExportExcel(); setExportOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Download as Excel (.xlsx)
            </button>
          </div>
        )}
      </div>

      {/* Schedule Dropdown */}
      <div ref={scheduleRef} style={{ position: 'relative' }}>
        <button
          style={buttonStyle}
          onClick={() => { setScheduleOpen(!scheduleOpen); setExportOpen(false); }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
          onMouseLeave={(e) => (e.currentTarget.style.background = R.heroBg)}
        >
          <Clock size={14} color={R.textMid} />
          Schedule
          <ChevronDown size={12} color={R.textDim} />
        </button>
        {scheduleOpen && (
          <div style={dropdownStyle}>
            <button
              style={menuItemStyle}
              onClick={() => { onCreateSchedule(); setScheduleOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Create New Schedule
            </button>
            <button
              style={menuItemStyle}
              onClick={() => { onManageSchedules(); setScheduleOpen(false); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e1e1e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Manage Schedules
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
