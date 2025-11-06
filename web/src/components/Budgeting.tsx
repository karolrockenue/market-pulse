import { useState, useEffect, Fragment, useCallback } from 'react'; // [MODIFIED] Added useCallback
import { TrendingUp, TrendingDown, Calendar as CalendarIcon, Target, DollarSign, Percent, AlertCircle, CheckCircle2, Edit, Plus, ChevronDown, ChevronRight, Award, TrendingDown as TrendingDownIcon } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner'; // [NEW] Import toast for error messages
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CreateBudgetModal } from './CreateBudgetModal';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MonthBudgetData {
  month: string;
  // Actuals (Read-only)
  actualOccupancy: number | null;
  actualADR: number | null;
  actualRevenue: number | null;
  capacityCount: number | null; // [NEW] Store the total capacity for the month
  // Targets (Read-only in table, editable in modal)
  targetOccupancy: string;
  targetADR: string;
  targetRevenue: string;
  // For current month pacing
  isCurrentMonth?: boolean;
  daysInMonth?: number;
  daysPassed?: number;
}

// [NEW] Define props for the component
interface BudgetingProps {
  propertyId: string; // ID of the currently selected property
}

export function Budgeting({ propertyId }: BudgetingProps) { // [MODIFIED] Accept propertyId prop
  // Define current date constants first
  const currentMonth = 9; // October (0-indexed)
  const currentDay = 10; // October 10, 2025

  const [selectedYear, setSelectedYear] = useState<string>('2025');
  const [revenueType, setRevenueType] = useState<'gross' | 'net'>('gross');
  const [monthlyData, setMonthlyData] = useState<MonthBudgetData[]>([]);
const [budgetExists, setBudgetExists] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    // Get the current month's short name (e.g., "Oct")
    const currentMonthName = new Date().toLocaleString('en-US', { month: 'short' });
    return new Set([currentMonthName]); // Set default to current month
  });
const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [actualsData, setActualsData] = useState<any[]>([]); // [NEW] State to hold actuals fetched from API
  const [benchmarkData, setBenchmarkData] = useState<Record<string, any>>({});

// [NEW] This function will be passed to the modal to fetch last year's actuals
  const handleCopyLastYearActuals = async (year: string): Promise<MonthBudgetData[] | null> => {
    // We want the data from the year *before* the selected budget year
    const lastYear = (parseInt(year) - 1).toString();
    const startDate = `${lastYear}-01-01`;
    const endDate = `${lastYear}-12-31`;



    try {
      // Call the same trusted endpoint we use for current actuals
      const response = await fetch(
        `/api/metrics-from-db?propertyId=${propertyId}&startDate=${startDate}&endDate=${endDate}&granularity=monthly`
      );

      if (!response.ok) {
        throw new Error(`API error! status: ${response.status}`);
      }

      const data = await response.json(); // This has a { metrics: [...] } structure


      // We need to map this API data to the MonthBudgetData format
      // required by the modal's state.
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Create a map for quick lookup
      const actualsMap = new Map(
        data.metrics.map((row: any) => {
          // Get 0-indexed month from the period date string
          const monthIndex = new Date(row.period).getUTCMonth(); 
          return [months[monthIndex], row];
        })
      );

      // Build the final array, ensuring all 12 months are present
      const formattedData: MonthBudgetData[] = months.map(monthName => {
        const row = actualsMap.get(monthName);

        // We use GROSS values as the baseline for a new budget
        // The API returns occupancy as a decimal (e.g., 0.84), so we multiply by 100
        const occ = row ? parseFloat(row.your_occupancy_direct || 0) : 0;
        const adr = row ? parseFloat(row.your_gross_adr || 0) : 0;
        const rev = row ? parseFloat(row.your_gross_revenue || 0) : 0;

        // Return the data in the format the modal's state expects
        // We use .toFixed() to convert numbers to strings
        return {
          month: monthName,
          // Only set a value if it's greater than 0, otherwise leave as empty string
          targetOccupancy: occ > 0 ? (occ * 100).toFixed(1) : '',
          targetADR: adr > 0 ? adr.toFixed(0) : '',
          targetRevenue: rev > 0 ? rev.toFixed(0) : '',
        };
      });

      return formattedData; // Return the 12-month array to the modal
    
    } catch (error: any) {
      console.error("[Budgeting] Error fetching last year's actuals:", error);
      // Return null to signal failure
      return null;
    }
  };


// [NEW] Helper function to get days in a specific month and year
  const getDaysInMonth = (year: number, monthIndex: number): number => {
    // Month index is 0-based (0 for Jan, 11 for Dec)
    // Using day 0 of the *next* month gives the last day of the current month
    return new Date(year, monthIndex + 1, 0).getDate();
  };

// [MODIFIED] Initialize monthly data function - now accepts API data format
  // Uses useCallback to prevent re-creation on every render
// [MODIFIED] Initialize monthly data function - now accepts API budget and actuals data
  const initializeMonthlyData = useCallback((
    apiBudgetData?: { month: string; targetOccupancy: string | null; targetADR: string | null; targetRevenue: string }[],
    apiActualsData?: any[] // Actuals data from POST /api/reports/run
  ): MonthBudgetData[] => {
    // [NEW LOG 4] Log only Oct data passed in
console.log("[DEBUG] initializeMonthlyData received actuals for Oct:", apiActualsData?.find(a => a.period.startsWith('2025-10')));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Create a map for quick lookup of API data by month name
    const budgetMap = new Map(apiBudgetData?.map(item => [item.month, item]));

    return months.map((monthName, index) => {
// Find corresponding actuals data for this month
// Find corresponding actuals data for this month by comparing year and month
      const targetYear = parseInt(selectedYear);
      const targetMonth = index; // 0-based month index (0=Jan, 1=Feb, etc.)
      // --- Add Log ---

      const actualsForMonth = apiActualsData?.find(a => {
        // Parse the 'period' date string from the API data
        const periodDate = new Date(a.period); // Assumes a parseable date string like YYYY-MM-DD...
        // Compare the UTC year and month
        return periodDate.getUTCFullYear() === targetYear && periodDate.getUTCMonth() === targetMonth;
      });

      // [NEW LOG 5] Log the found object
  console.log(`[InitData ${monthName}] Finding actualsForMonth:`, actualsForMonth);
  // [NEW LOG 6] Log the specific value
  console.log(`[InitData ${monthName}] Physical Unsold from actualsForMonth:`, actualsForMonth?.physical_unsold_remaining);

// [MODIFIED] Get actuals from apiActualsData or default to null
      const actualOccupancy = actualsForMonth?.occupancy ? parseFloat(actualsForMonth.occupancy) * 100 : null;
      const actualADR = actualsForMonth?.adr ? parseFloat(actualsForMonth.adr) : null;

  // --- Revenue Processing (Updated) ---
const rawTotalRevenue = actualsForMonth?.['total-revenue']; // Access the field named "total-revenue"
      const actualRevenue = rawTotalRevenue ? parseFloat(rawTotalRevenue) : null;

      // [NEW] Parse and store the capacity count for the month
      const rawCapacityCount = actualsForMonth?.['capacity-count'];
      const capacityCount = rawCapacityCount ? parseInt(rawCapacityCount, 10) : null;
   

      // Determine if it's the current month (for pacing logic)
      const today = new Date(); // Use actual current date
      const currentYearActual = today.getFullYear();
      const currentMonthActual = today.getMonth(); // 0-indexed
      const currentDayActual = today.getDate();
      const isCurrentMonth = parseInt(selectedYear) === currentYearActual && index === currentMonthActual;
const daysInMonth = getDaysInMonth(targetYear, targetMonth);
      // Get targets from the map using the monthName
      const target = budgetMap.get(monthName);

return {
          month: monthName,
          actualOccupancy,
          actualADR,
          actualRevenue,
          capacityCount: capacityCount,
          targetOccupancy: target?.targetOccupancy ?? '',
          targetADR: target?.targetADR ?? '',
          targetRevenue: target?.targetRevenue ?? '',
          isCurrentMonth: isCurrentMonth,
          daysInMonth: daysInMonth, // [FIXED] Was 'daysInMonthForCalc'
          daysPassed: isCurrentMonth ? currentDayActual : undefined,
          physical_unsold_remaining: actualsForMonth?.physical_unsold_remaining
      };
    });
// [MODIFIED] Add dependencies for useCallback
}, [selectedYear, revenueType, getDaysInMonth]); // [MODIFIED] Removed propertyRoomCount
// [MODIFIED] Fetch budget AND actuals data from API
  useEffect(() => {
    if (!propertyId) {
      setIsLoading(false);
      setMonthlyData(initializeMonthlyData()); // Pass undefined for both
      setActualsData([]); // Clear actuals
      setBudgetExists(false);
      return;
    }

    // Combined function to fetch both datasets
    const fetchData = async () => {
      setIsLoading(true);
      setBudgetExists(false); // Assume no budget initially
      let fetchedBudgets: any[] | undefined = undefined; // To store budget results
      let fetchedActuals: any[] = []; // To store actuals results

      try {
        // --- Fetch Budget Data (Existing Logic) ---
  
        const budgetResponse = await fetch(`/api/budgets/${propertyId}/${selectedYear}`);


        if (!budgetResponse.ok) {
          if (budgetResponse.status === 403) {
             toast.error('Access Denied', { description: 'You do not have permission to view budgets for this property.' });
          } else {
            // Try to parse error, otherwise use status text
            let errorMsg = `HTTP error! status: ${budgetResponse.status}`;
            try {
              const errorData = await budgetResponse.json();
              errorMsg = errorData.error || errorMsg;
            } catch (e) { /* Ignore JSON parse error */ }
            toast.error('Failed to load budget data', { description: errorMsg });
          }
           // Don't throw here, actuals might still load
        } else {
          fetchedBudgets = await budgetResponse.json(); // Store budget data
   
          const hasBudgetData = fetchedBudgets?.some((month: any) => month.targetRevenue && parseFloat(month.targetRevenue) > 0);
          setBudgetExists(!!hasBudgetData); // Set budgetExists based on fetched data

        }

// Budgeting.tsx
        // --- [FIX] Fetch Actuals Data using the CORRECT endpoint ---
        // We now call /api/metrics-from-db, which correctly calculates occupancy

        const yearStartDate = `${selectedYear}-01-01`;
        const yearEndDate = `${selectedYear}-12-31`; // Fetch full year

        const actualsResponse = await fetch(
          `/api/metrics-from-db?propertyId=${propertyId}&startDate=${yearStartDate}&endDate=${yearEndDate}&granularity=monthly`
        );
        


        if (!actualsResponse.ok) {
           // Try to parse error, otherwise use status text
           let errorMsg = `HTTP error! status: ${actualsResponse.status}`;
           try {
             const errorData = await actualsResponse.json();
             errorMsg = errorData.error || errorMsg;
           } catch (e) { /* Ignore JSON parse error */ }
           // Don't throw, just log and proceed without actuals
           console.error("Error fetching actuals data:", errorMsg);
           toast.error('Failed to load actuals data', { description: errorMsg });
           fetchedActuals = []; // Ensure actualsData is empty on error
        } else {
           const actualsDataFromApi = await actualsResponse.json(); // This has a { metrics: [...] } structure
fetchedActuals = actualsDataFromApi.metrics.map((row: any) => {
   // [NEW LOG 1] Log raw API row (only Oct)
   console.log("[DEBUG] Raw API Row for Oct:", row.period.startsWith('2025-10') ? row : 'Not Oct');
   const useGross = revenueType === 'gross';
   // [NEW] Store in temp variable
   const mappedRow = {
     period: row.period,
     occupancy: row.your_occupancy_direct,
     adr: useGross ? row.your_gross_adr : row.your_net_adr,
     'total-revenue': useGross ? row.your_gross_revenue : row.your_net_revenue,
     'capacity-count': row.your_capacity_count,
     physical_unsold_remaining: row.physical_unsold_remaining // This is the field we are tracing
   };
   // [NEW LOG 2] Log the object being created (only Oct)
   console.log("[DEBUG] Mapped Row for Oct:", mappedRow.period.startsWith('2025-10') ? mappedRow : 'Not Oct');
   return mappedRow;
});

        }

        // --- Update State with Fetched Data ---
        setActualsData(fetchedActuals); // Update actuals state
        // Initialize monthly data using both fetched datasets
        setMonthlyData(initializeMonthlyData(fetchedBudgets, fetchedActuals));
        // [NEW LOG 3] Log only the October object from the state
console.log("[DEBUG] actualsData state AFTER set:", fetchedActuals.find(a => a.period.startsWith('2025-10')));

      } catch (error: any) {
        // Catch errors not handled by !response.ok checks (e.g., network errors)
        console.error("[Budgeting Fetch] General error during data fetching:", error);
        toast.error('Failed to load page data', { description: error.message });
        setMonthlyData(initializeMonthlyData()); // Reset to blank structure
        setActualsData([]);
        setBudgetExists(false);
      } finally {

        setIsLoading(false); // Stop loading
      }
    };

    fetchData();
    // Dependencies: Re-run when propertyId or selectedYear changes
}, [propertyId, selectedYear]); // [FIX] Removed initializeMonthlyData from dependencies

  // [NEW] useEffect to fetch benchmark data when a month is expanded
  useEffect(() => {
    // Find which month was just expanded
    const expandedMonthArray = Array.from(expandedMonths);
    if (expandedMonthArray.length === 0) {
      return; // No month is expanded
    }

    const currentMonth = expandedMonthArray[0]; // e.g., "Nov"
    
    // Check if we already fetched data for this month
    if (!propertyId || !selectedYear || benchmarkData[currentMonth]) {
      return;
    }

    // Fetch benchmark data for this specific month
    const fetchBenchmarks = async () => {
      try {
        const response = await fetch(`/api/budgets/benchmarks/${propertyId}/${currentMonth}/${selectedYear}`);
        if (!response.ok) {
          throw new Error('Failed to fetch benchmarks');
        }
        const data = await response.json();
        
        // Save the data to our state, keyed by the month name
        setBenchmarkData(prevData => ({
          ...prevData,
          [currentMonth]: data
        }));

      } catch (error) {
        console.error(`Error fetching benchmarks for ${currentMonth}:`, error);
        // Save a default to prevent re-fetching on error
        setBenchmarkData(prevData => ({
          ...prevData,
          [currentMonth]: { benchmarkOcc: 75.0, benchmarkAdr: 120.0, source: 'default (error)' }
        }));
      }
    };

    fetchBenchmarks();
    
  }, [expandedMonths, propertyId, selectedYear, benchmarkData]); // Dependencies
// [MODIFIED] Handle saving budget from modal - Call POST API
  const handleSaveBudget = async (year: string, budgetTargetsFromModal: { month: string; targetOccupancy: string; targetADR: string; targetRevenue: string; }[]) => {

    // Add loading state or disable save button here if desired

    try { // [FIX] The 'try' block starts here
      // --- [FIX] Map the data to the format the API endpoint expects ---
      // We must ensure empty strings from the modal are sent as 'null' to the database
      const apiPayload = budgetTargetsFromModal.map(month => ({
        month: month.month,
        // Send null if the string is empty, otherwise send the value
        targetOccupancy: month.targetOccupancy || null, 
        targetADR: month.targetADR || null,
        // The API requires a revenue value, so send '0' if it's empty
        targetRevenue: month.targetRevenue || '0', 
      }));

      // --- Make the actual fetch call ---
      const response = await fetch(`/api/budgets/${propertyId}/${year}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // [FIX] Send the newly formatted apiPayload, not the raw modal data
        body: JSON.stringify(apiPayload),
      });

  
      // --- Handle response ---
      if (!response.ok) {
        const errorData = await response.json();
        // --- Log error response ---
        console.error('[Budgeting Save] API Error Response:', errorData);
        throw new Error(errorData.error || `Failed to save budget (HTTP ${response.status})`);
      }

      // --- Process success ---
      const successData = await response.json();

      toast.success(successData.message || `Budget for ${year} saved successfully!`);

      // Update local state for immediate feedback using the data *sent*
      // (The API currently just returns a message, not the full saved budget)
      // [FIX] We can just re-use the 'apiPayload' we already built
      const savedDataForInit = apiPayload;



      // [FIX] Pass BOTH the new budget (savedDataForInit) AND the existing actuals (actualsData)
      // This merges them instead of wiping the actuals.
      setMonthlyData(initializeMonthlyData(savedDataForInit, actualsData));

      // [FIX] Now set budgetExists to true so the component re-renders to show the table
      setBudgetExists(savedDataForInit.some(m => m.targetRevenue && parseFloat(m.targetRevenue) > 0));

      // Consider re-fetching with GET if you want to confirm data integrity from DB
      // fetchBudgetData();

    } catch (error: any) {
      // --- Log caught errors ---
      console.error('[Budgeting Save] Error during save process:', error);
      toast.error('Error saving budget', { description: error.message });

      // [NEW] Re-throw the error so the modal's save button can stop its
      // loading spinner and knows the save failed.
      throw error; 
    } finally {
      // Remove loading state or re-enable save button here
    }
  };

  // Calculate totals
  const totalActualRevenue = monthlyData
    .filter(m => m.actualRevenue !== null)
    .reduce((sum, m) => sum + (m.actualRevenue || 0), 0);
  
  const totalTargetRevenue = monthlyData.reduce((sum, m) => sum + parseFloat(m.targetRevenue || '0'), 0);
  
const totalActualOcc = monthlyData
    .filter(m => m.actualOccupancy !== null)
    .reduce((sum, m, _, arr) => sum + (m.actualOccupancy || 0) / arr.filter(x => x.actualOccupancy !== null).length, 0);
  
  // [NEW] Calculate average Actual ADR
  const validActualADRs = monthlyData
    .map(m => m.actualADR)
    .filter(adr => adr !== null && adr > 0);
  
  const totalActualADR = validActualADRs.length > 0
    ? validActualADRs.reduce((sum, adr) => sum + (adr || 0), 0) / validActualADRs.length
    : 0;
// [FIX] Calculate total target occupancy average, safely handling non-numeric strings
  // 1. Parse all targetOccupancy strings into numbers (yields numbers or NaN)
  const validTargetOccs = monthlyData
    .map(m => parseFloat(m.targetOccupancy))
    // 2. Filter out any NaNs (from '', ' ', etc.) and any explicit zeros
    .filter(occ => !isNaN(occ) && occ > 0);

const totalTargetOcc = validTargetOccs.length > 0
    ? validTargetOccs.reduce((sum, occ) => sum + occ, 0) / validTargetOccs.length
    : 0; // Default to 0 if no valid targets are set

  // [NEW] Calculate average Target ADR
  const validTargetADRs = monthlyData
    .map(m => parseFloat(m.targetADR))
    .filter(adr => !isNaN(adr) && adr > 0);
  
  const totalTargetADR = validTargetADRs.length > 0
    ? validTargetADRs.reduce((sum, adr) => sum + adr, 0) / validTargetADRs.length
    : 0;

  // Toggle month expansion
  const toggleMonthExpansion = (month: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set<string>();
      // Only one month can be expanded at a time
      if (!prev.has(month)) {
        newSet.add(month);
      }
      return newSet;
    });
  };
// Calculate pacing metrics for a specific month
// [MODIFIED] Function now accepts the 'benchmarks' object we fetched from the API
  // AND uses the new physical_unsold_remaining from the API data
  const calculateMonthPacing = (monthData: MonthBudgetData & { physical_unsold_remaining?: number | null }, monthIndex: number, benchmarks: { benchmarkOcc?: number, benchmarkAdr?: number, source?: string } | undefined) => {

    // --- 1. Get Base Data ---
    const targetRev = parseFloat(monthData.targetRevenue) || 0;
    const actualRev = monthData.actualRevenue || 0; // This is MTD + OTB revenue
    // [MODIFIED] Use the CORRECT capacity count passed from the modified API
    const capacityCount = monthData.capacityCount || 0;
    const targetOcc = parseFloat(monthData.targetOccupancy) || 0;
    const actualOcc = monthData.actualOccupancy || 0;
    const actualADR = monthData.actualADR || 0;
    // [NEW] Get the physical unsold rooms calculated by the backend
    const physicalUnsoldRemaining = monthData.physical_unsold_remaining; // Could be null/undefined/number

    // --- 2. Get Date Info ---
    const today = new Date();
    const currentYearActual = today.getFullYear();
    const currentMonthActual = today.getMonth();
    const currentDayActual = today.getDate();

    const isCurrentMonth = parseInt(selectedYear) === currentYearActual && monthIndex === currentMonthActual;
    const isPastMonth = parseInt(selectedYear) < currentYearActual || (parseInt(selectedYear) === currentYearActual && monthIndex < currentMonthActual);
    const isFutureMonth = parseInt(selectedYear) > currentYearActual || (parseInt(selectedYear) === currentYearActual && monthIndex > currentMonthActual);

    // [MODIFIED] Get daysInMonth directly for consistency
    const daysInMonth = getDaysInMonth(parseInt(selectedYear), monthIndex);
    const daysPassed = isPastMonth ? daysInMonth : (isCurrentMonth ? currentDayActual : 0);
    const daysRemaining = daysInMonth - daysPassed;

    // --- 3. Base Pacing Calculations ---
    const remainingTarget = targetRev - actualRev;
    const totalSoldRoomNights = capacityCount * (actualOcc / 100);
    // [MODIFIED] Calculate remaining unsold based on CORRECT capacity
    const remainingUnsoldRoomNights = capacityCount - totalSoldRoomNights;


// --- 4. Determine Status Tiers (Green/Yellow/Red) ---
    let statusTier = 'green';
    let statusText = 'On Target';
    let requiredADR = 0;
    let benchmarkAdr = 0;
    let benchmarkOcc = 0;
    let adrRatio = 1;
    let roomsLeftToSell = 0; // [FIX] Declare the variable here in the outer scope

    // Rules for defaulting to Green
    if (targetRev <= 0) { // No target set
        statusTier = 'green';
        statusText = 'On Target';
    } else if (remainingTarget <= 0 && actualRev > 0) { // Target already met
        statusTier = 'green';
        statusText = 'Target Met';
     } else if (isPastMonth) {
        // Simple comparison for past months
        if (actualRev < targetRev * 0.9) statusTier = 'red';
        else if (actualRev < targetRev) statusTier = 'yellow';
    } else if (!benchmarks) { // Benchmarks still loading
        statusTier = 'loading';
        statusText = 'Loading...';
    } else {
        // --- Logic for Current & Future Months ---
        benchmarkOcc = benchmarks.benchmarkOcc || 75.0;
        benchmarkAdr = (actualADR > 0 ? actualADR : benchmarks.benchmarkAdr) || 120.0;
// --- [NEW LOGIC] Determine rooms left to sell ---
     
        
        // Get the benchmark occupancy (e.g., 80.0) from the API
// This is our historical benchmark (L30D/SMLY)
        benchmarkOcc = benchmarks.benchmarkOcc || 75.0; 
        
        // Convert it to a decimal (e.g., 0.80) for calculation
        const benchmarkOccDecimal = benchmarkOcc / 100; 

        if (isCurrentMonth && physicalUnsoldRemaining !== null && physicalUnsoldRemaining !== undefined) {
            // --- Current Month Logic (Your Fix) ---
            // Project our sales by applying the benchmark occupancy to our remaining physical inventory.
            // e.g., 17 physical rooms * 80% benchmark occ = 13.6 projected rooms to sell.
            roomsLeftToSell = physicalUnsoldRemaining * benchmarkOccDecimal;

        } else if (isFutureMonth) {
            // --- Future Month Logic (Unchanged principle) ---
            // Project total sales for the month based on benchmark occ
            const totalProjectedRoomsToSell = capacityCount * benchmarkOccDecimal;
            // Subtract what's already on the books
            const remainingProjectedRoomsToSell = totalProjectedRoomsToSell - totalSoldRoomNights;
            roomsLeftToSell = remainingProjectedRoomsToSell > 0 ? remainingProjectedRoomsToSell : 0; // Can't be negative
        }
        // --- [END NEW LOGIC] ---

        // Calculate Required ADR based on the determined roomsLeftToSell
        if (roomsLeftToSell > 0 && remainingTarget > 0) {
            requiredADR = remainingTarget / roomsLeftToSell;
        } else if (remainingTarget > 0) {
            // Still need revenue but no rooms left to sell according to calc -> impossible target
            requiredADR = benchmarkAdr * 999; // Set high number for Red status
        } else {
             // Target met or no rooms left & no target left -> Green
            requiredADR = 0;
        }

        // Compare Required ADR to Benchmark ADR to set the tier
        adrRatio = benchmarkAdr > 0 ? requiredADR / benchmarkAdr : (requiredADR > 0 ? 999 : 1);

        if (requiredADR === 0 && remainingTarget <=0) {
            statusTier = 'green'; // If target met, ensure green
            // statusText remains 'Target Met' from earlier check
        } else if (adrRatio > 1.15) {
            statusTier = 'red';
            statusText = 'At Risk';
        } else if (adrRatio > 1.0) {
            statusTier = 'yellow';
            statusText = 'Slightly Behind';
        } else {
             statusTier = 'green'; // If ratio <= 1.0, it's green
             statusText = 'On Target'; // Set text explicitly
        }
    }

// --- 5. Return all data ---
    console.log(`[Budgeting Pacing: ${monthData.month}]
          - Status: ${statusText} (${statusTier})
          - Required ADR: ${requiredADR.toFixed(2)}
          - Benchmark ADR: ${benchmarkAdr.toFixed(2)}
          - Benchmark Occ (L30D/SMLY): ${benchmarkOcc.toFixed(1)}%
          - ADR Ratio (Req/Bench): ${(adrRatio * 100).toFixed(1)}%
          - Physical Rooms Remaining (Inventory): ${physicalUnsoldRemaining ?? 'N/A (Future)'}
          - Projected Rooms To Sell (Calc): ${roomsLeftToSell.toFixed(2)}
        `);

return {
      targetRev, actualRev, daysPassed, daysRemaining, remainingTarget,
      totalSoldRoomNights,
      // [MODIFIED] Rename original calc for clarity, add the new physical value
      totalMonthUnsoldPotential: remainingUnsoldRoomNights,
      physicalUnsoldRemaining: (isCurrentMonth && physicalUnsoldRemaining !== null && physicalUnsoldRemaining !== undefined) ? physicalUnsoldRemaining : null, // Only return for current month
      statusTier, statusText, requiredADR, benchmarkAdr, benchmarkOcc,
      isPastMonth, isCurrentMonth, isFutureMonth,
      hasPacing: (isCurrentMonth || isFutureMonth) && targetRev > 0,
      hasReview: isPastMonth && targetRev > 0
    };
  };
 
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white text-2xl mb-2">Budget</h1>
        <p className="text-[#9ca3af]">Set monthly targets and track real-time pacing against goals</p>
      </div>

      {/* Page Controls */}
      <div className="bg-[#262626] border border-[#3a3a35] rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#9ca3af]" />
              <span className="text-[#9ca3af] text-sm">Budget for</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1f1f1c] border-[#3a3a35]">
                  <SelectItem value="2024" className="text-[#e5e5e5]">2024</SelectItem>
                  <SelectItem value="2025" className="text-[#e5e5e5]">2025</SelectItem>
                  <SelectItem value="2026" className="text-[#e5e5e5]">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Revenue Type Toggle */}
            <div className="flex items-center gap-2 ml-6">
              <span className="text-[#9ca3af] text-sm">Revenue Type:</span>
              <div className="flex bg-[#1f1f1c] border border-[#3a3a35] rounded p-1">
                <button
                  onClick={() => setRevenueType('gross')}
                  className={`px-4 py-1.5 rounded text-sm transition-colors ${
                    revenueType === 'gross'
                      ? 'bg-[#faff6a] text-[#1f1f1c]'
                      : 'text-[#9ca3af] hover:text-[#e5e5e5]'
                  }`}
                >
                  Gross
                </button>
                <button
                  onClick={() => setRevenueType('net')}
                  className={`px-4 py-1.5 rounded text-sm transition-colors ${
                    revenueType === 'net'
                      ? 'bg-[#faff6a] text-[#1f1f1c]'
                      : 'text-[#9ca3af] hover:text-[#e5e5e5]'
                  }`}
                >
                  Net
                </button>
              </div>
            </div>
          </div>

          {/* Create/Edit Budget Button */}
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            {budgetExists ? (
              <>
                <Edit className="w-4 h-4 mr-2" />
                Edit Budget
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Budget
              </>
            )}
          </Button>
        </div>
      </div>

{/* No Budget State - Only show if NOT loading and budget doesn't exist */}
      {!isLoading && !budgetExists && (
        <div className="bg-[#262626] border border-[#3a3a35] rounded-lg p-12 text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#faff6a]/20 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-[#faff6a]" />
          </div>
          <h2 className="text-[#e5e5e5] text-xl mb-2">No Budget Set for {selectedYear}</h2>
          <p className="text-[#9ca3af] mb-6 max-w-md mx-auto">
            Create your {selectedYear} budget to start tracking performance against targets and view real-time pacing insights.
          </p>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create {selectedYear} Budget
          </Button>
        </div>
      )}

{/* [NEW] Show Loading Indicator */}
      {isLoading && (
         <div className="bg-[#262626] border border-[#3a3a35] rounded-lg p-12 text-center mb-6">
          <div className="w-8 h-8 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#9ca3af]">Loading budget data...</p>
        </div>
      )}

      {/* Budget & Pacing Table - Only show if budget exists AND not loading */}
      {!isLoading && budgetExists && (
        <>
          <div className="bg-[#262626] border border-[#3a3a35] rounded-lg overflow-hidden">
            <div className="px-6 py-3 border-b border-[#3a3a35] flex items-center justify-between">
              <div>
                <h2 className="text-[#e5e5e5]">Budget & Pacing Table</h2>
                <p className="text-[#9ca3af] text-xs mt-0.5">Monthly targets vs actuals with variance tracking — Click any month to view pacing details</p>
              </div>
              <Button
                onClick={() => setIsModalOpen(true)}
                variant="ghost"
                className="text-[#9ca3af] hover:text-[#faff6a] hover:bg-[#3a3a35]"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1f1f1c]">
                  <tr>
                    <th className="text-left px-4 py-2 text-[#9ca3af] text-[11px] uppercase tracking-wide border-r border-[#3a3a35] w-[100px]" rowSpan={2}>
                      Month
                    </th>
                    <th className="text-center px-3 py-1.5 text-[#9ca3af] text-[11px] uppercase tracking-wide border-r border-b border-[#3a3a35]" colSpan={3}>
                      Actuals
                    </th>
                    <th className="text-center px-3 py-1.5 text-[#9ca3af] text-[11px] uppercase tracking-wide border-r border-b border-[#3a3a35]" colSpan={3}>
                      Targets
                    </th>
              {/* [MODIFIED] Changed colSpan back to 2 */}
                    <th className="text-center px-3 py-1.5 text-[#9ca3af] text-[11px] uppercase tracking-wide border-b border-[#3a3a35]" colSpan={2}>
                      Variance
                    </th>
                  </tr>
                  <tr>
                    {/* Actuals Headers */}
                    <th className="text-center px-3 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[110px]">Occ %</th>
                    <th className="text-center px-3 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[110px]">ADR</th>
                    <th className="text-center px-3 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[130px]">Revenue</th>
                    
                    {/* Targets Headers */}
                    <th className="text-center px-2 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[90px]">Occ %</th>
                    <th className="text-center px-2 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[90px]">ADR</th>
                    <th className="text-center px-2 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[110px]">Revenue</th>
                    
               {/* Variance Headers */}
                    <th className="text-center px-2 py-2 text-[#6b7280] text-[10px] border-r border-[#3a3a35] w-[100px]">Rev £</th>
              {/* [NEW] Added Rev % header */}
                    {/* [REMOVED] Occ pts header */}
                    <th className="text-center px-2 py-2 text-[#6b7280] text-[10px] w-[90px]">Rev %</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row, index) => {
                    const targetOcc = parseFloat(row.targetOccupancy) || 0;
                    const targetAdr = parseFloat(row.targetADR) || 0;
                    const targetRev = parseFloat(row.targetRevenue) || 0;
                    
                    const revenueVariance = row.actualRevenue && targetRev ? row.actualRevenue - targetRev : null;
                    const occVariance = row.actualOccupancy && targetOcc ? row.actualOccupancy - targetOcc : null;
const isExpanded = expandedMonths.has(row.month);
                    // [MODIFIED] Removed propertyRoomCount from the call
     // [MODIFIED] Pass the fetched benchmark data for this specific month into the function
                    const pacing = calculateMonthPacing(row, index, benchmarkData[row.month]);

                    // [NEW] Add calculations from the prototype for the new "Path to Target" UI
                    // This logic is used by the new JSX block we're about to add.
                    const isOnTrack = pacing.pacingVariance >= 0;
                    // Use remainingRoomNights from pacing object, default to 0
                    const roomsRemaining = pacing.remainingRoomNights || 0; 
                    // Get ADR to display for "On Target" state
                    const currentADR = pacing.targetADR || pacing.benchmarkADR || 0; 
                    // Get Occ to display for "On Target" state
                    const currentOcc = pacing.targetOcc || pacing.benchmarkOcc || 0; 
                    // Calculate a simple forecast based on current MTD run-rate
                    const forecastedRev = pacing.actualRev + (pacing.daysRemaining * (pacing.actualRev / Math.max(pacing.daysPassed || 1, 1)));
                    // Calculate the projected miss amount
                    const missAmount = Math.abs(pacing.targetRev - forecastedRev);

                    return (
                      <Fragment key={row.month}>
                        {/* Main Row - Clickable */}
                        <tr
                          onClick={() => toggleMonthExpansion(row.month)}
                          className={`border-b border-[#2a2a25] hover:bg-[#2a2a25] transition-colors cursor-pointer ${
                            row.isCurrentMonth ? 'bg-[#faff6a]/5' : ''
                          }`}
                        >
                          {/* Month */}
                          <td className="px-4 py-2 text-[#e5e5e5] border-r border-[#2a2a25]">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#9ca3af]" />
                              )}
                              <span className="text-sm">{row.month}</span>
                              {row.isCurrentMonth && (
                                <Badge className="bg-[#faff6a]/20 text-[#faff6a] border-[#faff6a]/30 text-[9px] px-1 py-0">
                                  Now
                                </Badge>
                              )}
                            </div>
                          </td>
                          
                          {/* Actuals - Read Only */}
                          <td className="px-3 py-2 text-center text-[#e5e5e5] text-xs border-r border-[#2a2a25]">
                            {row.actualOccupancy ? `${row.actualOccupancy.toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-3 py-2 text-center text-[#e5e5e5] text-xs border-r border-[#2a2a25]">
                            {row.actualADR ? `£${row.actualADR.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-center text-[#e5e5e5] text-xs border-r border-[#2a2a25]">
                            {row.actualRevenue ? `£${row.actualRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          
                          {/* Targets - Read Only (Edit via modal) */}
                          <td className="px-2 py-2 text-center text-[#e5e5e5] text-xs border-r border-[#2a2a25]">
{/* [FIX] Safely parse and format, showing '-' for invalid/empty strings (like '' or ' ') or 0 */
                              !isNaN(parseFloat(row.targetOccupancy)) && parseFloat(row.targetOccupancy) > 0
                              ? `${parseFloat(row.targetOccupancy).toFixed(1)}%`
                              : '-'
                            }                          </td>
                          <td className="px-2 py-2 text-center text-[#e5e5e5] text-xs border-r border-[#2a2a25]">
                            {row.targetADR ? `£${parseFloat(row.targetADR).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-center text-[#e5e5e5] text-xs border-r border-[#2a2a25]">
                            {row.targetRevenue ? `£${parseFloat(row.targetRevenue).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                          </td>
                          
                          {/* Variance */}
              <td className="px-2 py-2 text-center border-r border-[#2a2a25]">
                            {revenueVariance !== null ? (
                              <div className={`flex items-center justify-center gap-1 ${
                                revenueVariance >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                              }`}>
                                {revenueVariance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                <span className="text-[11px]">{revenueVariance >= 0 ? '+' : ''}£{Math.abs(revenueVariance).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              </div>
                            ) : (
                              <span className="text-[#6b7280] text-[11px]">-</span>
                            )}
                          </td>
                          
                          {/* [NEW] Revenue Variance % Column */}
                          <td className="px-2 py-2 text-center border-r border-[#2a2a25]">
                            {revenueVariance !== null && targetRev > 0 ? (
                              // Calculate and format the percentage variance
                              <div className={`${revenueVariance >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                <span className="text-[11px]">
                                  {revenueVariance >= 0 ? '+' : ''}{(revenueVariance / targetRev * 100).toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              // Show '-' if target is 0 or no variance
                              <span className="text-[#6b7280] text-[11px]">-</span>
                            )}
                          </td>
                          
                  
                        </tr>

                        {/* Expandable Pacing Section */}
               {/* Expandable Pacing Section */}
                        {isExpanded && (
                          <tr className="border-b border-[#2a2a25]">
                            <td colSpan={9} className="p-0">
                              <div className="bg-[#1a1a18] border-t-2 border-[#faff6a]/20">
                                
                                {/* [NEW] Show Pacing/Future Panel */}
                                {(pacing.hasPacing) && (
                                  <div className="px-6 py-8">
                                    {/* Header */}
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a25]">
                                      <div className={`w-0.5 h-5 ${pacing.isCurrentMonth ? 'bg-[#faff6a]' : 'bg-[#9ca3af]'} rounded-full`}></div>
                                      <div>
                                        <h3 className={`${pacing.isCurrentMonth ? 'text-[#faff6a]' : 'text-[#9ca3af]'} text-xs`}>
                                          {pacing.isCurrentMonth ? 'Month Pacing Analysis' : 'Future Pacing'}
                                        </h3>
                                        <p className="text-[#6b7280] text-[10px]">
                                          {pacing.isCurrentMonth
                                            ? `${row.month} ${selectedYear} — Day ${pacing.daysPassed} of ${pacing.daysPassed + pacing.daysRemaining}`
                                            : `${row.month} ${selectedYear} — Not yet started`}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Pacing Grid */}
                                    <div className="grid grid-cols-9 gap-6 pt-4">
                                      {/* Column 1: PERFORMANCE TO DATE */}
                                      <div className="col-span-3 pr-[5%]">
                                        <div className="text-[#9ca3af] text-[10px] uppercase tracking-wide mb-2">Performance to Date</div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Actual Revenue (On Books)</span>
                                            <span className="text-[#e5e5e5] text-xs">£{pacing.actualRev.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Sold Room Nights (On Books)</span>
                                            <span className="text-[#e5e5e5] text-xs">{pacing.totalSoldRoomNights.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                   <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                        {/* [MODIFIED] Label changed */}
                                        <span className="text-[#6b7280] text-[10px]">Physical Rooms Remaining (Today+)</span>
                                        {/* [MODIFIED] Value now uses physicalUnsoldRemaining for current month, otherwise the old value */}
                                        <span className="text-[#e5e5e5] text-xs">
                                          {pacing.isCurrentMonth && pacing.physicalUnsoldRemaining !== null
                                            ? pacing.physicalUnsoldRemaining.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                            : pacing.totalMonthUnsoldPotential.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                          }
                                        </span>
                                      </div>
                                          <div className="flex items-baseline justify-between pt-0.5">
                                            <span className="text-[#6b7280] text-[10px]">Days Elapsed</span>
                                            <span className="text-[#9ca3af] text-[10px]">{pacing.daysPassed} of {pacing.daysPassed + pacing.daysRemaining} days</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Column 2: FULL MONTH GOAL */}
                                      <div className="col-span-3 px-[5%]">
                                        <div className="text-[#9ca3af] text-[10px] uppercase tracking-wide mb-2">Full Month Goal</div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Full Month Target</span>
                                            <span className="text-[#e5e5e5] text-xs">£{pacing.targetRev.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Revenue Still to Earn</span>
                                            <span className="text-[#e5e5e5] text-xs">£{Math.abs(pacing.remainingTarget).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pt-0.5">
                                            <span className="text-[#6b7280] text-[10px]">Achievement Rate</span>
                                            <span className={`text-sm ${(pacing.actualRev / pacing.targetRev * 100) >= 100 ? 'text-[#10b981]' : 'text-[#e5e5e5]'}`}>
                                              {((pacing.actualRev / pacing.targetRev) * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                     {/* Column 3: PATH TO TARGET (Uses our new 3-tier logic) */}
                                  <div className="col-span-3 pl-[5%]">
                                    <div className="text-[#9ca3af] text-[10px] uppercase tracking-wide mb-2">Path to Target</div>
                                    <div className="space-y-1.5">

                                      {/* Status Row */}
                                      <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                        <span className="text-[#6b7280] text-[10px]">Status</span>
                                        <Badge 
                                          className="text-[9px] px-1.5 py-0.5" // Base classes without colors
                                          style={
                                            pacing.statusTier === 'green' ? { // Green "On Target"
                                              backgroundColor: 'rgba(74, 222, 128, 0.2)',
                                              color: '#4ade80',
                                              borderColor: 'rgba(74, 222, 128, 0.4)',
                                              borderWidth: '1px'
                                            } :
                                            pacing.statusTier === 'yellow' ? { // Yellow "Slightly Behind"
                                              backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                              color: '#f59e0b',
                                              borderColor: 'rgba(245, 158, 11, 0.4)',
                                              borderWidth: '1px'
                                            } :
                                            pacing.statusTier === 'red' ? { // Red "At Risk"
                                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                              color: '#ef4444',
                                              borderColor: 'rgba(239, 68, 68, 0.4)',
                                              borderWidth: '1px'
                                            } :
                                            { // Loading state
                                              backgroundColor: 'rgba(107, 114, 128, 0.2)',
                                              color: '#9ca3af',
                                              borderColor: 'rgba(107, 114, 128, 0.4)',
                                              borderWidth: '1px'
                                            }
                                          }
                                        >
                                          {pacing.statusText}
                                        </Badge>
                                      </div>

                                      {/* [NEW] Show key metrics for all states (except loading) */}
                                      {pacing.statusTier !== 'loading' ? (
                                        <>
                                          {/* Required ADR */}
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Required ADR</span>
                                            <span className={`text-xs font-medium ${
                                              pacing.statusTier === 'green' ? 'text-[#e5e5e5]' : 'text-[#faff6a]'
                                            }`}>
                                              £{pacing.requiredADR.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          </div>


                                          {/* Projected Occupancy */}
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Projected Occupancy</span>
                                            <span className="text-[#e5e5e5] text-xs">
                                              {pacing.benchmarkOcc.toFixed(1)}%
                                            </span>
                                          </div>

                                          {/* [NEW] Summary Text */}
                                          <div className="pt-1">
                                            <p className={`text-[10px] leading-relaxed ${
                                              pacing.statusTier === 'green' ? 'text-[#4ade80]' :
                                              pacing.statusTier === 'yellow' ? 'text-[#f59e0b]' : 'text-[#ef4444]'
                                            }`}>
                                              {pacing.statusTier === 'green' && pacing.statusText === 'Target Met'
                                                ? `Target already exceeded by £${Math.abs(pacing.remainingTarget).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.`
                                                : pacing.statusTier === 'green'
                                                  ? 'Your Required ADR is achievable based on your benchmark.'
                                                  : 'Your Required ADR is higher than your benchmark.'
                                              }
                                            </p>
                                          </div>
                                        </>
                                      ) : (
                                        /* This is the loading state */
                                        <div className="pt-2">
                                          <p className="text-[#9ca3af] text-[10px] leading-relaxed">
                                            Calculating benchmarks...
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* [NEW] Show Past Month Review Panel */}
                                {pacing.hasReview && (
                                  <div className="px-6 py-8">
                                    {/* Header */}
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a25]">
                                      <div className="w-0.5 h-5 bg-[#faff6a] rounded-full"></div>
                                      <div>
                                        <h3 className="text-[#faff6a] text-xs">{row.month}: Monthly Review</h3>
                                        <p className="text-[#6b7280] text-[10px]">{row.month} {selectedYear} — Final Results</p>
                                      </div>
                                    </div>

                                    {/* 3-Column Grid */}
                                    <div className="grid grid-cols-9 gap-6 pt-4">
                                      {/* Column 1: FINAL ACTUALS */}
                                      <div className="col-span-3 pr-[5%]">
                                        <div className="text-[#9ca3af] text-[10px] uppercase tracking-wide mb-2">Final Actuals</div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Actual Revenue</span>
                                            <span className="text-[#e5e5e5] text-xs">£{pacing.actualRev.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Actual Occupancy %</span>
                                            <span className="text-[#e5e5e5] text-xs">{row.actualOccupancy?.toFixed(1)}%</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pt-0.5">
                                            <span className="text-[#6b7280] text-[10px]">Actual ADR</span>
                                            <span className="text-[#e5e5e5] text-xs">£{row.actualADR?.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Column 2: TARGETS */}
                                      <div className="col-span-3 px-[5%]">
                                        <div className="text-[#9ca3af] text-[10px] uppercase tracking-wide mb-2">Targets</div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Target Revenue</span>
                                            <span className="text-[#e5e5e5] text-xs">£{pacing.targetRev.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Target Occupancy %</span>
                                            <span className="text-[#e5e5e5] text-xs">{targetOcc.toFixed(1)}%</span>
                                          </div>
                                          <div className="flex items-baseline justify-between pt-0.5">
                                            <span className="text-[#6b7280] text-[10px]">Target ADR</span>
                                            <span className="text-[#e5e5e5] text-xs">£{parseFloat(row.targetADR).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Column 3: FINAL VARIANCE */}
                                      <div className="col-span-3 pl-[5%]">
                                        <div className="text-[#9ca3af] text-[10px] uppercase tracking-wide mb-2">Final Variance</div>
                                        <div className="space-y-1.5">
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Revenue Variance</span>
                                            <span className={`text-xs ${(pacing.actualRev - pacing.targetRev) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                              {(pacing.actualRev - pacing.targetRev) >= 0 ? '+' : ''}£{Math.abs(pacing.actualRev - pacing.targetRev).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                          </div>
                                          <div className="flex items-baseline justify-between pb-1.5 border-b border-[#2a2a25]">
                                            <span className="text-[#6b7280] text-[10px]">Occupancy Variance</span>
                                            <span className={`text-xs ${((row.actualOccupancy || 0) - targetOcc) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                              {((row.actualOccupancy || 0) - targetOcc) >= 0 ? '+' : ''}{((row.actualOccupancy || 0) - targetOcc).toFixed(1)} pts
                                            </span>
                                          </div>
                                          <div className="flex items-baseline justify-between pt-0.5">
                                            <span className="text-[#6b7280] text-[10px]">ADR Variance</span>
                                            <span className={`text-xs ${((row.actualADR || 0) - parseFloat(row.targetADR)) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                              {((row.actualADR || 0) - parseFloat(row.targetADR)) >= 0 ? '+' : ''}£{Math.abs((row.actualADR || 0) - parseFloat(row.targetADR)).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* [NEW] Show Fallback "No Data" Panel */}
                                {!pacing.hasPacing && !pacing.hasReview && (
                                  <div className="text-center py-6">
                                    <AlertCircle className="w-6 h-6 text-[#6b7280] mx-auto mb-1.5" />
                                    <p className="text-[#9ca3af] text-xs">
                                      {pacing.targetRev === 0 ? 'No target set for this month' : 'No actual data available yet'}
                                    </p>
                                  </div>
                                )}

                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      );
                  })}
   
                  {/* Full Year Total Row */}
                  <tr className="bg-[#1f1f1c] border-t-2 border-[#faff6a]/30">
                    <td className="px-4 py-2.5 text-[#faff6a] border-r border-[#3a3a35]">
                      <span className="text-sm">Full Year</span>
                    </td>
                    
                    {/* Actuals Totals */}
                    <td className="px-2 py-2.5 text-center text-[#e5e5e5] text-xs border-r border-[#3a3a35]">
                      {totalActualOcc > 0 ? `${totalActualOcc.toFixed(1)}%` : '-'}
                    </td>
           <td className="px-2 py-2.5 text-center text-[#e5e5e5] text-xs border-r border-[#3a3a35]">
                      {/* [FIXED] Was hardcoded '-', now uses totalActualADR */}
                      {totalActualADR > 0 ? `£${totalActualADR.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[#e5e5e5] text-xs border-r border-[#3a3a35]">
                      {totalActualRevenue > 0 ? `£${totalActualRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                    </td>
                    
                    {/* Targets Totals */}
               {/* Targets Totals */}
<td className="px-2 py-2.5 text-center text-[#faff6a] text-xs border-r border-[#3a3a35]">
  {/* [FIX] Check if totalTargetOcc is a truthy, valid number before formatting */}
  {totalTargetOcc ? `${totalTargetOcc.toFixed(1)}%` : '-'}
</td><td className="px-2 py-2.5 text-center text-[#faff6a] text-xs border-r border-[#3a3a35]">
                      {/* [FIXED] Was hardcoded '-', now uses totalTargetADR */}
                      {totalTargetADR > 0 ? `£${totalTargetADR.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                    </td>
                    <td className="px-2 py-2.5 text-center text-[#faff6a] text-xs border-r border-[#3a3a35]">
                      {totalTargetRevenue > 0 ? `£${totalTargetRevenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-'}
                    </td>
                    
     {/* Variance Totals */}
                    <td className="px-2 py-2.5 text-center border-r border-[#3a3a35]">
                      {totalActualRevenue > 0 && totalTargetRevenue > 0 ? (
                        <div className={`flex items-center justify-center gap-1 ${
                          (totalActualRevenue - totalTargetRevenue) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}>
                          {(totalActualRevenue - totalTargetRevenue) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          <span className="text-[11px]">
                            {(totalActualRevenue - totalTargetRevenue) >= 0 ? '+' : ''}£{Math.abs(totalActualRevenue - totalTargetRevenue).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#6b7280] text-[11px]">-</span>
                      )}
                    </td>

                    {/* [NEW] Total Revenue Variance % Column */}
                    <td className="px-2 py-2.5 text-center border-r border-[#3a3a35]">
                      {totalActualRevenue > 0 && totalTargetRevenue > 0 ? (
                        // Calculate and format the total percentage variance
                        <div className={`${(totalActualRevenue - totalTargetRevenue) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          <span className="text-[11px]">
                            {(totalActualRevenue - totalTargetRevenue) >= 0 ? '+' : ''}{((totalActualRevenue - totalTargetRevenue) / totalTargetRevenue * 100).toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        // Show '-' if no data
                        <span className="text-[#6b7280] text-[11px]">-</span>
                      )}
                    </td>

    
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
{/* Budget Modal */}
      <CreateBudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        year={selectedYear}
        onSaveBudget={handleSaveBudget}
        existingBudget={budgetExists ? monthlyData.map(m => ({
          month: m.month,
          targetOccupancy: m.targetOccupancy,
          targetADR: m.targetADR,
          targetRevenue: m.targetRevenue,
        })) : undefined}
        // [NEW] Pass the new handler function as a prop
        onCopyLastYearActuals={handleCopyLastYearActuals}
      />
    </div>
  );
}
