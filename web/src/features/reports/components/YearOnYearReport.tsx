
import React, { useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

import { toast } from 'sonner';

// [MODIFIED] Update props to accept propertyId and currencyCode
interface YearOnYearReportProps {
  propertyId: string;
  currencyCode: string;
  onBack?: () => void;
}

interface MonthlyData {
  month: string;
  year1: {
    occupancy: number;
    adr: number;
    revpar: number;
    revenue: number;
    roomsSold: number;
  };
  year2: {
    occupancy: number;
    adr: number;
    revpar: number;
    revenue: number;
    roomsSold: number;
  };
}

type DeltaMetric = 'revenue' | 'occupancy' | 'adr' | 'revpar';

// [MODIFIED] Destructure the new props and wrap component in forwardRef
export const YearOnYearReport = forwardRef(({ propertyId, currencyCode, onBack }: YearOnYearReportProps, ref) => {
  const [selectedDeltaMetric, setSelectedDeltaMetric] = useState<DeltaMetric>('revenue');
  
  // [MODIFIED] Default year state to empty strings
  const [year1, setYear1] = useState<string>('');
  const [year2, setYear2] = useState<string>('');

  // [NEW] State to hold data from the API
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [reportData, setReportData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // [REMOVED] Mock availableYears array

// [NEW] useEffect to fetch the list of available years for the dropdowns
  useEffect(() => {
    if (!propertyId) return; // Don't run if propertyId isn't set yet


    const fetchAvailableYears = async () => {
      try {
        // [FIX] Point to the new Metrics Engine (Session 1 Architecture)
        const response = await fetch(`/api/metrics/available-years?propertyId=${propertyId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch available years');
        }
        // The backend sends a list of years (e.g., ["2023", "2024", "2025", "2026"])
        const years: string[] = await response.json();
        setAvailableYears(years); // Set the full list for the dropdown

        // --- [NEW] Logic to set correct defaults ---
        // Get the project's current year from its "today" date (based on changelogs)
     const projectToday = new Date(); // Use the actual current date
        const projectCurrentYear = projectToday.getFullYear(); // This will be 2025

        // Filter out any years that are in the future
        const validYears = years.filter(year => parseInt(year, 10) <= projectCurrentYear);
        // e.g., if years = ["2023", "2024", "2025", "2026"], validYears = ["2023", "2024", "2025"]
        // --- End of [NEW] Logic ---


        // [MODIFIED] Set defaults to the last two years in the *valid* list.
        if (validYears.length >= 2) {
          // This sets year1 to the second-to-last valid year (e.g., "2024")
          setYear1(validYears[validYears.length - 2]); 
          // This sets year2 to the last valid year (e.g., "2025")
          setYear2(validYears[validYears.length - 1]);
        } else if (validYears.length === 1) {
          // If only one year of data, compare it to itself
          setYear1(validYears[0]);
          setYear2(validYears[0]);
        } else {
          // If no data, clear the years
          setYear1('');
          setYear2('');
        }
      } catch (error: any) {
        toast.error('Could not load available years', { description: error.message });
      }
    };

    fetchAvailableYears();
  }, [propertyId]); // This hook re-runs only when the property changes

  // [REMOVED] Mock yearOnYearData generator (useMemo)

  // [NEW] useEffect to fetch the main report data when years change
  useEffect(() => {
    // Don't run if the required data isn't ready
    if (!propertyId || !year1 || !year2) {
      return;
    }

const fetchReportData = async () => {
      setIsLoading(true);
      try {
        // [FIX] Point to the new Metrics Engine (Session 1 Architecture)
        const response = await fetch('/api/metrics/reports/year-on-year', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            year1,
            year2,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to run year-on-year report');
        }
        
        const data: MonthlyData[] = await response.json();
        setReportData(data); // Set the live data

      } catch (error: any) {
        toast.error('Could not load report data', { description: error.message });
        setReportData([]); // Clear data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [propertyId, year1, year2]); // This hook re-runs if property or selected years change

  // [NEW] Currency and Number formatting helpers
  const formatCurrency = (value: number, digits: number = 0) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      maximumFractionDigits: digits,
    }).format(value);
  };
  

// [MODIFIED] Helper function to format currency. Now always shows the full formatted number.
const formatCurrencyDynamic = (value: number) => {
  // Always show the plain, formatted number with 0 decimals
  // e.g., 25,000 -> £25,000
  // e.g., 1,110,000 -> £1,110,000
  return formatCurrency(value, 0);
};

  // Define the project's "current" date (October 2025)
const projectToday = new Date(); // Use the actual current date
  const currentYear = projectToday.getFullYear().toString(); // "2025"
  // [FIX] Get the index of the *last complete month* (9 for October -> 8 for September)
  const lastCompleteMonthIndex = projectToday.getMonth() - 1; 

// [FIXED] Use 3-letter month names to match the API data from the logs
const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const lastCompleteMonthName = monthNames[lastCompleteMonthIndex]; // [NEW] Add this line
  // [MODIFIED] This summary calculation now watches the live 'reportData' state
  const summary = useMemo(() => {
    // [NEW] If no data, return zeroed-out object
    if (!reportData || reportData.length === 0) {
      const zeroMetrics = { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 };
      return {
        avg1: { occupancy: 0, adr: 0, revpar: 0 },
        avg2: { occupancy: 0, adr: 0, revpar: 0 },
        total1: zeroMetrics,
        total2: zeroMetrics,
      };
    }
    
    // [MODIFIED] Use 'reportData' instead of 'yearOnYearData'
    const totals1 = reportData.reduce((acc, item) => ({
      occupancy: acc.occupancy + item.year1.occupancy,
      adr: acc.adr + item.year1.adr,
      revpar: acc.revpar + item.year1.revpar,
      revenue: acc.revenue + item.year1.revenue,
      roomsSold: acc.roomsSold + item.year1.roomsSold,
    }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 });

    const totals2 = reportData.reduce((acc, item) => ({
      occupancy: acc.occupancy + item.year2.occupancy,
      adr: acc.adr + item.year2.adr,
      revpar: acc.revpar + item.year2.revpar,
      revenue: acc.revenue + item.year2.revenue,
      roomsSold: acc.roomsSold + item.year2.roomsSold,
    }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 });

    const count = reportData.length;

return {
      avg1: {
        occupancy: totals1.occupancy / count,
        adr: totals1.adr / count,
        revpar: totals1.revpar / count,
      },
      avg2: {
        occupancy: totals2.occupancy / count,
        adr: totals2.adr / count,
        revpar: totals2.revpar / count,
      },
      total1: totals1,
      total2: totals2,
    };
  }, [reportData]); // [FIXED] The dependency array for 'summary' goes here.
  
const currentPeriodSummary = useMemo(() => {


// [FIXED] Only run this logic if EITHER year1 OR year2 is the current year
  if ((year1 !== currentYear && year2 !== currentYear) || !reportData || reportData.length === 0) {
    return null; // Don't show this row if not comparing to the current year
  }

// [FIX] Get the months that have passed (e.g., 'January' through 'September')
const elapsedMonths = monthNames.slice(0, lastCompleteMonthIndex + 1); // Slices 0-8

  // Filter the report data to *only* include these elapsed months
  const filteredData = reportData.filter(item => elapsedMonths.includes(item.month));

  // If no data (e.g., report is still loading), return null
  if (filteredData.length === 0) {
    return null;
  }

  // --- Calculate Totals and Averages on the *filtered* data ---
  const totals1 = filteredData.reduce((acc, item) => ({
    occupancy: acc.occupancy + item.year1.occupancy,
    adr: acc.adr + item.year1.adr,
    revpar: acc.revpar + item.year1.revpar,
    revenue: acc.revenue + item.year1.revenue,
  }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0 });

  const totals2 = filteredData.reduce((acc, item) => ({
    occupancy: acc.occupancy + item.year2.occupancy,
    adr: acc.adr + item.year2.adr,
    revpar: acc.revpar + item.year2.revpar,
    revenue: acc.revenue + item.year2.revenue,
  }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0 });

  const count = filteredData.length;

  return {
    avg1: {
      occupancy: totals1.occupancy / count,
      adr: totals1.adr / count,
      revpar: totals1.revpar / count,
    },
    avg2: {
      occupancy: totals2.occupancy / count,
      adr: totals2.adr / count,
      revpar: totals2.revpar / count,
    },
    total1: totals1,
    total2: totals2,
// Store the label for the row, e.g., "Jan - Oct"
// [MODIFIED] Use a clearer YTD label
periodLabel: `YTD (${monthNames[0].substring(0, 3)} - ${monthNames[lastCompleteMonthIndex].substring(0, 3)})`
  };
}, [reportData, year1, year2]); // [FIXED] Re-run if data or EITHER year changes
  
  // [FIXED] The extra line that was here has been moved to its correct location above.

  // --- No changes to helper functions below this line ---
  // (calculateDelta, DeltaCell, getDeltaProps, getSummaryDeltaProps, getColumnHighlight, getHeaderHighlight)
  // ... (pasting them here for completeness) ...

  const calculateDelta = (value2: number, value1: number) => {
    // [NEW] Handle division by zero
    if (value1 === 0) {
      return { absolute: value2, percent: value2 > 0 ? 100 : 0, isPositive: value2 > 0, isNeutral: value2 === 0 };
    }
    const delta = value2 - value1;
    const percentChange = ((delta / value1) * 100);
    return {
      absolute: delta,
      percent: percentChange,
      isPositive: delta > 0,
      isNeutral: Math.abs(percentChange) < 0.5,
    };
  };

 const DeltaCell = ({ value2, value1, prefix = '', suffix = '', decimals = 1 }: any) => {
    const delta = calculateDelta(value2, value1);
    
    return (
      <div className="flex items-center justify-center gap-1.5">
        {delta.isNeutral ? (
          <Minus className="w-3.5 h-3.5 text-[#9ca3af]" />
        ) : delta.isPositive ? (
          <ArrowUp className="w-3.5 h-3.5 text-[#10b981]" />
        ) : (
          <ArrowDown className="w-3.5 h-3.5 text-[#ef4444]" />
        )}
        <div className="text-center">
          <div className={`text-sm ${
            delta.isNeutral ? 'text-[#9ca3af]' : delta.isPositive ? 'text-[#10b981]' : 'text-[#ef4444]'
          }`}>
            {delta.isPositive ? '+' : ''}{delta.percent.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  };

  const getDeltaProps = (data: MonthlyData) => {
    switch (selectedDeltaMetric) {
      case 'occupancy':
        return { value2: data.year2.occupancy, value1: data.year1.occupancy, suffix: '%' };
      case 'adr':
        return { value2: data.year2.adr, value1: data.year1.adr, prefix: '$' };
      case 'revpar':
        return { value2: data.year2.revpar, value1: data.year1.revpar, prefix: '$' };
      case 'revenue':
      default:
        return { value2: data.year2.revenue, value1: data.year1.revenue, prefix: '$', decimals: 0 };
    }
  };

  const getSummaryDeltaProps = () => {
    switch (selectedDeltaMetric) {
      case 'occupancy':
        return { value2: summary.avg2.occupancy, value1: summary.avg1.occupancy, suffix: '%' };
      case 'adr':
        return { value2: summary.avg2.adr, value1: summary.avg1.adr, prefix: '$' };
      case 'revpar':
        return { value2: summary.avg2.revpar, value1: summary.avg1.revpar, prefix: '$' };
      case 'revenue':
      default:
        return { value2: summary.total2.revenue, value1: summary.total1.revenue, prefix: '$', decimals: 0 };
    }
  };

  const getCurrentPeriodSummaryDeltaProps = () => {
    if (!currentPeriodSummary) {
      return { value2: 0, value1: 0 };
    }
    switch (selectedDeltaMetric) {
      case 'occupancy':
        return { value2: currentPeriodSummary.avg2.occupancy, value1: currentPeriodSummary.avg1.occupancy, suffix: '%' };
      case 'adr':
        return { value2: currentPeriodSummary.avg2.adr, value1: currentPeriodSummary.avg1.adr, prefix: '$' };
      case 'revpar':
        return { value2: currentPeriodSummary.avg2.revpar, value1: currentPeriodSummary.avg1.revpar, prefix: '$' };
      case 'revenue':
      default:
        return { value2: currentPeriodSummary.total2.revenue, value1: currentPeriodSummary.total1.revenue, prefix: '$', decimals: 0 };
    }
  };
  
  const getColumnHighlight = (metric: DeltaMetric) => {
    return selectedDeltaMetric === metric
      ? {
          backgroundColor: 'rgba(57, 189, 248, 0.05)',
          borderLeft: '1px solid rgba(57, 189, 248, 0.2)',
          borderRight: '1px solid rgba(57, 189, 248, 0.2)',
        }
      : {};
  };

  const getHeaderHighlight = (metric: DeltaMetric) => {
    return selectedDeltaMetric === metric
      ? {
          backgroundColor: 'rgba(57, 189, 248, 0.1)',
          color: '#39BDF8',
        }
      : {
          color: '#9ca3af',
        };
  };


  // [NEW] Expose internal data and state via the ref for the parent (App.tsx)
  useImperativeHandle(ref, () => ({
    // Expose the data needed for exporting
    getExportData: () => {
      return {
        reportData,
        year1,
        year2,
        summary,
        currentPeriodSummary,
        // Pass the helper functions so App.tsx can use the exact same formatting
        formatCurrency,
        formatCurrencyDynamic
      };
    },
    // Expose the state needed for scheduling
    getScheduleParameters: () => {
      return {
        year1,
        year2
      };
    }
  }));

  // --- RENDER LOGIC ---
  // --- RENDER LOGIC ---

return (
  <div style={{ position: 'relative', width: '100%' }}>
    {/* Fixed Background Layer from ReportTable */}
    <div style={{
      position: 'fixed', 
      inset: 0, 
      backgroundColor: '#1d1d1c', 
      zIndex: 0,
      pointerEvents: 'none'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(250, 255, 106, 0.01))'
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)',
        backgroundSize: '64px 64px'
      }} />
    </div>

{/* Content Layer */}
    <div style={{ position: 'relative', zIndex: 10 }}>
      
      {/* Header - Moved inside component to sit above fixed background */}
      <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
        <div style={{ marginBottom: '0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  color: '#9ca3af',
                  fontSize: '14px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  padding: 0,
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#39BDF8'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
              >
                <span>←</span>
                <span>Back to Report Selection</span>
              </button>
            )}
            <h1 style={{ color: 'white', fontSize: '24px', marginBottom: '4px', marginTop: 0 }}>
              Year-on-Year Comparison Report
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
              Side-by-side performance comparison with variance analysis
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          padding: '1.5rem',
          // [MODIFIED] Removed background and borderRadius so the global grid/gradient shows through
        }}
      >

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#0a0a0a]/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="w-8 h-8 border-2 border-[#39BDF8] border-t-transparent border-solid rounded-full animate-spin"></div>
        </div>
      )}

            {/* KPI Cards – PROT visual style */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
        }}
      >
        {/* Avg Occupancy */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            border: '1px solid #2a2a2a',
          }}
        >
          <div
            style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              marginBottom: '0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
            }}
          >
            Avg Occupancy
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: '#e5e5e5' }}>
                {summary.avg1.occupancy.toFixed(1)}%
              </span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>
                {summary.avg2.occupancy.toFixed(1)}%
              </span>
            </div>
            <DeltaCell
              value2={summary.avg2.occupancy}
              value1={summary.avg1.occupancy}
              suffix="%"
            />
          </div>
        </div>

        {/* Avg ADR */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            border: '1px solid #2a2a2a',
          }}
        >
          <div
            style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              marginBottom: '0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
            }}
          >
            Avg ADR
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: '#e5e5e5' }}>
                {formatCurrency(summary.avg1.adr)}
              </span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>
                {formatCurrency(summary.avg2.adr)}
              </span>
            </div>
            <DeltaCell value2={summary.avg2.adr} value1={summary.avg1.adr} />
          </div>
        </div>

        {/* Avg RevPAR */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
         border: '1px solid #2a2a2a',

          }}
        >
          <div
            style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              marginBottom: '0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
            }}
          >
            Avg RevPAR
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: '#e5e5e5' }}>
                {formatCurrency(summary.avg1.revpar)}
              </span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>
                {formatCurrency(summary.avg2.revpar)}
              </span>
            </div>
            <DeltaCell
              value2={summary.avg2.revpar}
              value1={summary.avg1.revpar}
            />
          </div>
        </div>

        {/* Total Revenue */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            border: '1px solid #2a2a2a',
          }}
        >
          <div
            style={{
              color: '#6b7280',
              fontSize: '0.75rem',
              marginBottom: '0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '-0.025em',
            }}
          >
            Total Revenue
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: '#e5e5e5' }}>
                {formatCurrencyDynamic(summary.total1.revenue)}
              </span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>
                {formatCurrencyDynamic(summary.total2.revenue)}
              </span>
            </div>
            <DeltaCell
              value2={summary.total2.revenue}
              value1={summary.total1.revenue}
              decimals={0}
            />
          </div>
        </div>
      </div>

           {/* Controls Bar – PROT visual style */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1a1a1a',
          borderRadius: '0.5rem',
          padding: '1rem',
          border: '1px solid #2a2a2a',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
          }}
        >
          {/* Year Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span
              style={{
                color: '#6b7280',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
              }}
            >
              Compare:
            </span>

            <Select value={year1} onValueChange={setYear1} disabled={isLoading}>
              <SelectTrigger className="w-24 h-9 bg-[#0a0a0a] border-[#2a2a2a] text-[#e5e5e5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]">
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>vs</span>

            <Select value={year2} onValueChange={setYear2} disabled={isLoading}>
              <SelectTrigger className="w-24 h-9 bg-[#0a0a0a] border-[#2a2a2a] text-[#39BDF8]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]">
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vertical divider */}
          <div
            style={{
              height: '1.5rem',
              width: '1px',
              backgroundColor: '#2a2a2a',
            }}
          />

          {/* Delta Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span
              style={{
                color: '#6b7280',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '-0.025em',
              }}
            >
              Delta:
            </span>

            <div
              style={{
                display: 'flex',
                gap: '0.375rem',
              }}
            >
              {[
                { id: 'revenue' as DeltaMetric, label: 'Revenue' },
                { id: 'occupancy' as DeltaMetric, label: 'Occupancy' },
                { id: 'adr' as DeltaMetric, label: 'ADR' },
                { id: 'revpar' as DeltaMetric, label: 'RevPAR' },
              ].map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setSelectedDeltaMetric(metric.id)}
                  disabled={isLoading}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    border: 'none',
                    cursor: isLoading ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor:
                      selectedDeltaMetric === metric.id ? '#39BDF8' : '#0a0a0a',
                    color:
                      selectedDeltaMetric === metric.id ? '#0a0a0a' : '#9ca3af',
                  }}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Info text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#6b7280',
            fontSize: '0.75rem',
          }}
        >
          <Info style={{ width: '1rem', height: '1rem' }} />
          <span>Year-on-year performance comparison</span>
        </div>
      </div>

      {/* Detailed Table – PROT visual style */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '0.5rem',
          border: '1px solid #2a2a2a',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    color: '#6b7280',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#1a1a1a',
                    zIndex: 10,
                  }}
                >
                  Month
                </th>
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    borderLeft: '2px solid #2a2a2a',
                  }}
                  colSpan={4}
                >
                  {year1}
                </th>
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    color: '#39BDF8',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    borderLeft: '2px solid #2a2a2a',
                  }}
                  colSpan={4}
                >
                  {year2}
                </th>
                <th
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'center',
                    color: '#39BDF8',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    borderLeft: '2px solid #2a2a2a',
                  }}
                >
                  Δ {selectedDeltaMetric === 'revenue'
                    ? 'Rev'
                    : selectedDeltaMetric === 'occupancy'
                    ? 'Occ'
                    : selectedDeltaMetric === 'adr'
                    ? 'ADR'
                    : 'RevPAR'}
                </th>
              </tr>
              <tr
                style={{
                  borderBottom: '1px solid #2a2a2a',
                  backgroundColor: '#0f0f0f',
                }}
              >
                <th
                  style={{
                    padding: '0.625rem 1rem',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#0f0f0f',
                    zIndex: 10,
                  }}
                />
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    borderLeft: '2px solid #2a2a2a',
                    ...getHeaderHighlight('occupancy'),
                  }}
                >
                  Occ
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    ...getHeaderHighlight('adr'),
                  }}
                >
                  ADR
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    ...getHeaderHighlight('revpar'),
                  }}
                >
                  RevPAR
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    ...getHeaderHighlight('revenue'),
                  }}
                >
                  Revenue
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    borderLeft: '2px solid #2a2a2a',
                    ...getHeaderHighlight('occupancy'),
                  }}
                >
                  Occ
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    ...getHeaderHighlight('adr'),
                  }}
                >
                  ADR
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    ...getHeaderHighlight('revpar'),
                  }}
                >
                  RevPAR
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    ...getHeaderHighlight('revenue'),
                  }}
                >
                  Revenue
                </th>
                <th
                  style={{
                    padding: '0.625rem 0.75rem',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                    borderLeft: '2px solid #2a2a2a',
                  }}
                >
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((data) => (
                <tr
                  key={data.month}
                  style={{
                    borderBottom: '1px solid #2a2a2a',
                  }}
                >
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#1a1a1a',
                      zIndex: 10,
                    }}
                  >
                    {data.month}
                  </td>

                  {/* Year 1 */}
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      borderLeft: '2px solid #2a2a2a',
                      ...getColumnHighlight('occupancy'),
                    }}
                  >
                    {data.year1.occupancy.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('adr'),
                    }}
                  >
                    {formatCurrency(data.year1.adr)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revpar'),
                    }}
                  >
                    {formatCurrency(data.year1.revpar)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revenue'),
                    }}
                  >
                    {formatCurrencyDynamic(data.year1.revenue)}
                  </td>

                  {/* Year 2 */}
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      borderLeft: '2px solid #2a2a2a',
                      ...getColumnHighlight('occupancy'),
                    }}
                  >
                    {data.year2.occupancy.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('adr'),
                    }}
                  >
                    {formatCurrency(data.year2.adr)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revpar'),
                    }}
                  >
                    {formatCurrency(data.year2.revpar)}
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revenue'),
                    }}
                  >
                    {formatCurrencyDynamic(data.year2.revenue)}
                  </td>

                  {/* Delta */}
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      borderLeft: '2px solid #2a2a2a',
                    }}
                  >
                    <DeltaCell {...getDeltaProps(data)} />
                  </td>
                </tr>
              ))}

              {currentPeriodSummary && (
                <tr
                  style={{
                    backgroundColor: '#0f0f0f',
                    borderBottom: '1px solid #2a2a2a',
                  }}
                >
                  <td
                    style={{
                      padding: '0.75rem 1rem',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: '#0f0f0f',
                      zIndex: 10,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '0.25rem',
                        backgroundColor: '#39BDF8',
                      }}
                    />
                    <span style={{ paddingLeft: '0.75rem', fontWeight: 600 }}>
                      {currentPeriodSummary.periodLabel}
                    </span>
                  </td>

                  {/* Year 1 YTD */}
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      borderLeft: '2px solid #2a2a2a',
                      ...getColumnHighlight('occupancy'),
                    }}
                  >
                    <strong>
                      {currentPeriodSummary.avg1.occupancy.toFixed(1)}%
                    </strong>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('adr'),
                    }}
                  >
                    <strong>{formatCurrency(currentPeriodSummary.avg1.adr)}</strong>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revpar'),
                    }}
                  >
                    <strong>
                      {formatCurrency(currentPeriodSummary.avg1.revpar)}
                    </strong>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revenue'),
                    }}
                  >
                    <strong>
                      {formatCurrencyDynamic(currentPeriodSummary.total1.revenue)}
                    </strong>
                  </td>

                  {/* Year 2 YTD */}
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      borderLeft: '2px solid #2a2a2a',
                      ...getColumnHighlight('occupancy'),
                    }}
                  >
                    <strong>
                      {currentPeriodSummary.avg2.occupancy.toFixed(1)}%
                    </strong>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('adr'),
                    }}
                  >
                    <strong>{formatCurrency(currentPeriodSummary.avg2.adr)}</strong>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revpar'),
                    }}
                  >
                    <strong>
                      {formatCurrency(currentPeriodSummary.avg2.revpar)}
                    </strong>
                  </td>
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      color: '#e5e5e5',
                      fontSize: '0.875rem',
                      ...getColumnHighlight('revenue'),
                    }}
                  >
                    <strong>
                      {formatCurrencyDynamic(currentPeriodSummary.total2.revenue)}
                    </strong>
                  </td>

                  {/* Delta YTD */}
                  <td
                    style={{
                      padding: '0.75rem',
                      textAlign: 'center',
                      borderLeft: '2px solid #2a2a2a',
                    }}
                  >
                    <DeltaCell {...getCurrentPeriodSummaryDeltaProps()} />
                  </td>
                </tr>
              )}

              {/* Full Year Totals */}
              <tr
                style={{
                  borderTop: '2px solid rgba(57, 189, 248, 0.3)',
                  backgroundColor: '#0f0f0f',
                }}
              >
                <td
                  style={{
                    padding: '0.75rem 1rem',
                    color: '#39BDF8',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: '#0f0f0f',
                    zIndex: 10,
                  }}
                >
                  <strong>AVG / TOTAL</strong>
                </td>

                {/* Year 1 Totals */}
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                    borderLeft: '2px solid #2a2a2a',
                    ...getColumnHighlight('occupancy'),
                  }}
                >
                  <strong>{summary.avg1.occupancy.toFixed(1)}%</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                    ...getColumnHighlight('adr'),
                  }}
                >
                  <strong>{formatCurrency(summary.avg1.adr)}</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                    ...getColumnHighlight('revpar'),
                  }}
                >
                  <strong>{formatCurrency(summary.avg1.revpar)}</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                  }}
                >
                  <strong>{formatCurrencyDynamic(summary.total1.revenue)}</strong>
                </td>

                {/* Year 2 Totals */}
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                    borderLeft: '2px solid #2a2a2a',
                    ...getColumnHighlight('occupancy'),
                  }}
                >
                  <strong>{summary.avg2.occupancy.toFixed(1)}%</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                    ...getColumnHighlight('adr'),
                  }}
                >
                  <strong>{formatCurrency(summary.avg2.adr)}</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                    ...getColumnHighlight('revpar'),
                  }}
                >
                  <strong>{formatCurrency(summary.avg2.revpar)}</strong>
                </td>
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    color: '#e5e5e5',
                    fontSize: '0.875rem',
                  }}
                >
                  <strong>{formatCurrencyDynamic(summary.total2.revenue)}</strong>
                </td>

                {/* Delta Totals */}
                <td
                  style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    borderLeft: '2px solid #2a2a2a',
                  }}
                >
                  <DeltaCell {...getSummaryDeltaProps()} />
                </td>
              </tr>
            </tbody>
          </table>
</div>
    </div>

    </div>
    </div>
  </div>
);
}); // [MODIFIED] Close the forwardRef wrapper