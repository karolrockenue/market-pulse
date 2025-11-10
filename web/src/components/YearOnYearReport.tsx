
import React, { useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import { toast } from 'sonner';

// [MODIFIED] Update props to accept propertyId and currencyCode
interface YearOnYearReportProps {
  propertyId: string;
  currencyCode: string;
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
export const YearOnYearReport = forwardRef(({ propertyId, currencyCode }: YearOnYearReportProps, ref) => {
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
        const response = await fetch(`/api/reports/available-years?propertyId=${propertyId}`);
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
        const response = await fetch('/api/reports/year-on-year', {
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

  // [NEW] Helper function to get delta props for the "Current Period" row
  const getCurrentPeriodSummaryDeltaProps = () => {
    // Check if the summary data exists
    if (!currentPeriodSummary) {
      // Return default empty props if summary doesn't exist
      return { value2: 0, value1: 0 };
    }
    
    // Return the correct props based on the selected metric
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
  
  // Helper to get highlighted column class for data cells
  const getColumnHighlight = (metric: DeltaMetric) => {
    // [MODIFIED] Use a more subtle 5% opacity.
    return selectedDeltaMetric === metric
      ? 'bg-[#faff6a]/5'
      : '';
  };

// replace with this:
  const getHeaderHighlight = (metric: DeltaMetric) => {
    // [MODIFIED] Use a more subtle 5% opacity
    return selectedDeltaMetric === metric
      ? 'bg-[#faff6a]/5 text-[#faff6a]'
      : 'text-[#9ca3af]';
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
    <div className="space-y-5 relative">
      {/* [NEW] Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#252521]/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="w-8 h-8 border-2 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"></div>
        </div>
      )}

      {/* Compact KPI Row - [MODIFIED] with currency formatting */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#1f1f1c] rounded-lg px-4 py-3 border border-[#3a3a35]">
          <div className="text-[#9ca3af] text-xs mb-1.5">Avg Occupancy</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[#e5e5e5]">{summary.avg1.occupancy.toFixed(1)}%</span>
              <span className="text-[#6b7280]">→</span>
              <span className="text-[#faff6a]">{summary.avg2.occupancy.toFixed(1)}%</span>
            </div>
            <DeltaCell 
              value2={summary.avg2.occupancy} 
              value1={summary.avg1.occupancy}
              suffix="%"
            />
          </div>
        </div>

{/* [FIXED] This is the corrected Avg ADR card */}
        <div className="bg-[#1f1f1c] rounded-lg px-4 py-3 border border-[#3a3a35]">
          <div className="text-[#9ca3af] text-xs mb-1.5">Avg ADR</div>
          <div className="flex items-center justify-between gap-3">
            {/* This div holds the numbers (e.g., £150 -> £165) */}
            <div className="flex items-center gap-2">
              <span className="text-[#e5e5e5]">{formatCurrency(summary.avg1.adr)}</span>
              <span className="text-[#6b7280]">→</span>
              <span className="text-[#faff6a]">{formatCurrency(summary.avg2.adr)}</span>
            </div>
            {/* This is the DeltaCell for ADR, now correctly placed */}
            <DeltaCell 
              value2={summary.avg2.adr} 
              value1={summary.avg1.adr}
            />
          </div>
        </div>

        <div className="bg-[#1f1f1c] rounded-lg px-4 py-3 border border-[#3a3a35]">
          <div className="text-[#9ca3af] text-xs mb-1.5">Avg RevPAR</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[#e5e5e5]">{formatCurrency(summary.avg1.revpar)}</span>
              <span className="text-[#6b7280]">→</span>
              <span className="text-[#faff6a]">{formatCurrency(summary.avg2.revpar)}</span>
            </div>
            <DeltaCell 
              value2={summary.avg2.revpar} 
              value1={summary.avg1.revpar}
            />
          </div>
        </div>

        <div className="bg-[#1f1f1c] rounded-lg px-4 py-3 border border-[#3a3a35]">
          <div className="text-[#9ca3af] text-xs mb-1.5">Total Revenue</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
<span className="text-[#e5e5e5]">{formatCurrencyDynamic(summary.total1.revenue)}</span>
              <span className="text-[#6b7280]">→</span>
    <span className="text-[#faff6a]">{formatCurrencyDynamic(summary.total2.revenue)}</span>
            </div>
            <DeltaCell 
              value2={summary.total2.revenue} 
              value1={summary.total1.revenue}
              decimals={0}
            />
          </div>
        </div>
      </div>

      {/* Controls Bar - [MODIFIED] to use live 'availableYears' */}
      <div className="flex items-center justify-between bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
        <div className="flex items-center gap-6">
          {/* Year Selector */}
          <div className="flex items-center gap-3">
            <span className="text-[#9ca3af] text-sm">Compare:</span>
            <Select value={year1} onValueChange={setYear1} disabled={isLoading}>
              <SelectTrigger className="w-24 h-9 bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[#9ca3af]">vs</span>
            <Select value={year2} onValueChange={setYear2} disabled={isLoading}>
              <SelectTrigger className="w-24 h-9 bg-[#2C2C2C] border-[#3a3a35] text-[#faff6a]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="h-6 w-px bg-[#3a3a35]" />

          {/* Delta Selector */}
          <div className="flex items-center gap-3">
            <span className="text-[#9ca3af] text-sm">Delta:</span>
            <div className="flex gap-1.5">
              {[
                { id: 'revenue' as DeltaMetric, label: 'Revenue' },
                { id: 'occupancy' as DeltaMetric, label: 'Occupancy' },
                { id: 'adr' as DeltaMetric, label: 'ADR' },
                { id: 'revpar' as DeltaMetric, label: 'RevPAR' },
              ].map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setSelectedDeltaMetric(metric.id)}
                  className={`px-3 py-1.5 rounded text-sm transition-all ${
                    selectedDeltaMetric === metric.id
                      ? 'bg-[#faff6a] text-[#1f1f1c]'
                      : 'bg-[#2C2C2C] text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#3a3a35]'
                  }`}
                  disabled={isLoading}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#6b7280] text-xs">
          <Info className="w-4 h-4" />
          <span>Year-on-year performance comparison</span>
        </div>
      </div>

      {/* Detailed Table - [MODIFIED] to use 'reportData' and formatted currency */}
      <div className="bg-[#2C2C2C] rounded-lg border border-[#3a3a35] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* ... (table headers are unchanged) ... */}
              <tr className="border-b border-[#3a3a35] bg-[#1f1f1c]">
                <th className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider sticky left-0 bg-[#1f1f1c] z-10">
                  Month
                </th>
                <th className="px-4 py-3 text-center text-[#e5e5e5] text-xs uppercase tracking-wider border-l-2 border-[#3a3a35]" colSpan={4}>
                  {year1}
                </th>
                <th className="px-4 py-3 text-center text-[#faff6a] text-xs uppercase tracking-wider border-l-2 border-[#3a3a35]" colSpan={4}>
                  {year2}
                </th>
                <th className="px-4 py-3 text-center text-[#faff6a] text-xs uppercase tracking-wider border-l-2 border-[#3a3a35]">
                  Δ {selectedDeltaMetric === 'revenue' ? 'Rev' : selectedDeltaMetric === 'occupancy' ? 'Occ' : selectedDeltaMetric === 'adr' ? 'ADR' : 'RevPAR'}
                </th>
              </tr>
              <tr className="border-b border-[#3a3a35] bg-[#1a1a18]">
                <th className="px-4 py-2.5 sticky left-0 bg-[#1a1a18] z-10"></th>
                <th className={`px-3 py-2.5 text-center text-xs border-l-2 border-[#3a3a35] ${getHeaderHighlight('occupancy')}`}>Occ</th>
                <th className={`px-3 py-2.5 text-center text-xs ${getHeaderHighlight('adr')}`}>ADR</th>
                <th className={`px-3 py-2.5 text-center text-xs ${getHeaderHighlight('revpar')}`}>RevPAR</th>
                <th className={`px-3 py-2.5 text-center text-xs ${getHeaderHighlight('revenue')}`}>Revenue</th>
                <th className={`px-3 py-2.5 text-center text-xs border-l-2 border-[#3a3a35] ${getHeaderHighlight('occupancy')}`}>Occ</th>
                <th className={`px-3 py-2.5 text-center text-xs ${getHeaderHighlight('adr')}`}>ADR</th>
                <th className={`px-3 py-2.5 text-center text-xs ${getHeaderHighlight('revpar')}`}>RevPAR</th>
                <th className={`px-3 py-2.5 text-center text-xs ${getHeaderHighlight('revenue')}`}>Revenue</th>
                <th className="px-3 py-2.5 text-center text-[#9ca3af] text-xs border-l-2 border-[#3a3a35]">Change</th>
              </tr>
</thead>
<tbody>
          {reportData.map((data, idx) => (
            <React.Fragment key={data.month}>
              <tr 
                className="border-b border-[#3a3a35] hover:bg-[#2a2a25] transition-colors"
                  >
                    <td className="px-4 py-3 text-[#e5e5e5] text-sm sticky left-0 z-10 bg-[#2C2C2C]">
                      {data.month}
                    </td>
                    
                    {/* Year 1 Metrics */}
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm border-l-2 border-[#3a3a35] ${getColumnHighlight('occupancy')}`}>
                      {data.year1.occupancy.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('adr')}`}>
                      {formatCurrency(data.year1.adr)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revpar')}`}>
                      {formatCurrency(data.year1.revpar)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revenue')}`}>
                      {formatCurrencyDynamic(data.year1.revenue)}
                    </td>
                    
                    {/* Year 2 Metrics */}
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm border-l-2 border-[#3a3a35] ${getColumnHighlight('occupancy')}`}>
                      {data.year2.occupancy.toFixed(1)}%
                    </td>
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('adr')}`}>
                      {formatCurrency(data.year2.adr)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revpar')}`}>
                      {formatCurrency(data.year2.revpar)}
                    </td>
                    <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revenue')}`}>
                      {formatCurrencyDynamic(data.year2.revenue)}
                    </td>
                    
                    {/* Delta */}
                    <td className="px-3 py-3 text-center border-l-2 border-[#3a3a35]">
                      <DeltaCell {...getDeltaProps(data)} />
                    </td>
          </tr>

               
</React.Fragment>
          ))}
            {currentPeriodSummary && (
                    <tr className="border-b border-[#3a/35]" style={{ backgroundColor: 'rgba(31, 31, 28, 0.8)' }}>
   <td className="px-4 py-3 text-[#faff6a] text-sm sticky left-0 z-10" style={{ backgroundColor: 'rgba(31, 31, 28, 0.8)' }}>
                    <strong>{currentPeriodSummary.periodLabel}</strong>
                  </td>
                      
                      {/* Year 1 YTD - with new background class */}
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm border-l-2 border-[#3a3a35] ${getColumnHighlight('occupancy')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{currentPeriodSummary.avg1.occupancy.toFixed(1)}%</strong>
                      </td>
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('adr')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{formatCurrency(currentPeriodSummary.avg1.adr)}</strong>
                      </td>
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revpar')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{formatCurrency(currentPeriodSummary.avg1.revpar)}</strong>
                      </td>
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revenue')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{formatCurrencyDynamic(currentPeriodSummary.total1.revenue)}</strong>
                      </td>
                      
                      {/* Year 2 YTD - with new background class */}
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm border-l-2 border-[#3a3a35] ${getColumnHighlight('occupancy')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{currentPeriodSummary.avg2.occupancy.toFixed(1)}%</strong>
                      </td>
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('adr')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{formatCurrency(currentPeriodSummary.avg2.adr)}</strong>
                      </td>
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revpar')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{formatCurrency(currentPeriodSummary.avg2.revpar)}</strong>
                      </td>
                      <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revenue')}`} style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <strong>{formatCurrencyDynamic(currentPeriodSummary.total2.revenue)}</strong>
                      </td>
                      
                      {/* Delta YTD - with new background class */}
                      <td className="px-3 py-3 text-center border-l-2 border-[#3a3a35]" style={{ backgroundColor: 'rgba(31, 31, 28, 0.6)' }}>
                        <DeltaCell {...getCurrentPeriodSummaryDeltaProps()} />
                      </td>
                    </tr>
                  )}

          {/* The "Full Year" row remains at the bottom */}
          <tr className="border-t-2 border-[#faff6a]/30 bg-[#1f1f1c]">
                <td className="px-4 py-3 text-[#faff6a] text-sm sticky left-0 bg-[#1f1f1c] z-10">
                  <strong>Full Year (Jan - Dec)</strong>
                </td>
                
                {/* Year 1 Averages/Totals */}
                <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm border-l-2 border-[#3a3a35] ${getColumnHighlight('occupancy')}`}>
                  <strong>{summary.avg1.occupancy.toFixed(1)}%</strong>
                </td>
                <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('adr')}`}>
                  <strong>{formatCurrency(summary.avg1.adr)}</strong>
                </td>
            <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revpar')}`}>
              <strong>{formatCurrency(summary.avg1.revpar)}</strong>
            </td>
            <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm`}>
              <strong>{formatCurrencyDynamic(summary.total1.revenue)}</strong>
            </td>
                
                {/* Year 2 Averages/Totals */}
                <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm border-l-2 border-[#3a3a35] ${getColumnHighlight('occupancy')}`}>
                  <strong>{summary.avg2.occupancy.toFixed(1)}%</strong>
                </td>
                <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('adr')}`}>
                  <strong>{formatCurrency(summary.avg2.adr)}</strong>
                </td>
          <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm ${getColumnHighlight('revpar')}`}>
              <strong>{formatCurrency(summary.avg2.revpar)}</strong>
            </td>
            <td className={`px-3 py-3 text-center text-[#e5e5e5] text-sm`}>
              <strong>{formatCurrencyDynamic(summary.total2.revenue)}</strong>
            </td>
                
                {/* Delta Total/Average */}
                <td className="px-3 py-3 text-center border-l-2 border-[#3a3a35]">
                  <DeltaCell {...getSummaryDeltaProps()} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
);
}); // [MODIFIED] Close the forwardRef wrapper