import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Copy, FileText, TrendingUpIcon, ArrowRight, Check, X, Calendar, ChevronLeft, AlertCircle, Target, DollarSign, Percent, Info, Calculator } from 'lucide-react';
import { toast } from 'sonner'; // [FIX] Removed the invalid '@2.0.3' version from the import path

interface MonthBudgetData {
  month: string;
  targetOccupancy: string;
  targetADR: string;
  targetRevenue: string;
}

// [MODIFIED] Add MonthBudgetData to be accessible
interface MonthBudgetData {
  month: string;
  targetOccupancy: string;
  targetADR: string;
  targetRevenue: string;
}

interface CreateBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: string;
  onSaveBudget: (year: string, data: MonthBudgetData[]) => void;
  existingBudget?: MonthBudgetData[];
  // [NEW] Add a new prop to handle fetching last year's actuals
  // This function will be defined in the parent and passed in.
  onCopyLastYearActuals: (year: string) => Promise<MonthBudgetData[] | null>;
}

// [MODIFIED] Destructure the new onCopyLastYearActuals prop
export function CreateBudgetModal({ isOpen, onClose, year, onSaveBudget, existingBudget, onCopyLastYearActuals }: CreateBudgetModalProps) {
  const [step, setStep] = useState<'select-year' | 'choose-method' | 'edit'>('select-year');
  const [selectedYear, setSelectedYear] = useState<string>(year);
  const [budgetData, setBudgetData] = useState<MonthBudgetData[]>([]);
  const [percentageIncrease, setPercentageIncrease] = useState<string>('5');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = ['2025', '2026'];

  // Currency formatter
  const formatCurrency = (value: number): string => {
    return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const hasExistingBudget = (checkYear: string) => {
    return checkYear === year && existingBudget && existingBudget.length > 0;
  };

  // Calculate budget totals and summary
  const budgetSummary = useMemo(() => {
    const totalRevenue = budgetData.reduce((sum, m) => sum + parseFloat(m.targetRevenue || '0'), 0);
    const avgOccupancy = budgetData.reduce((sum, m, _, arr) => {
      const occ = parseFloat(m.targetOccupancy || '0');
      return sum + occ / arr.length;
    }, 0);
    const avgADR = budgetData.reduce((sum, m, _, arr) => {
      const adr = parseFloat(m.targetADR || '0');
      return sum + adr / arr.length;
    }, 0);
    const filledMonths = budgetData.filter(m => m.targetRevenue && parseFloat(m.targetRevenue) > 0).length;

    return { totalRevenue, avgOccupancy, avgADR, filledMonths };
  }, [budgetData]);

  // Initialize blank budget
  const initBlankBudget = () => {
    const blank = months.map(month => ({
      month,
      targetOccupancy: '',
      targetADR: '',
      targetRevenue: '',
    }));
    setBudgetData(blank);
    setStep('edit');
  };

  // Copy from last year (using actual data or mock)
// [MODIFIED] Copy from last year (now fetches REAL data)
  const copyFromLastYear = async () => {
    // Show a loading toast while we fetch
    const loadingToast = toast.loading("Fetching last year's actuals...");
    
    // Call the new prop function, which is defined in Budgeting.tsx
    // It will perform the API call and return the formatted data
    const data = await onCopyLastYearActuals(selectedYear);

    if (data) {
      // If data was returned, set it as the modal's state
      setBudgetData(data);
      toast.success("Last year's actuals loaded.", { id: loadingToast });
      setStep('edit'); // Move to the edit screen
    } else {
      // If the fetch failed (returned null)
      toast.error("Could not load last year's data.", { id: loadingToast });
      // We stay on the 'choose-method' step
    }
  };

  // Copy with percentage increase
  const copyWithIncrease = () => {
    const increase = parseFloat(percentageIncrease) || 0;
    const lastYear = (parseInt(selectedYear) - 1).toString();
    const lastYearData = existingBudget;

    let baseData;
    if (lastYearData && lastYearData.length > 0) {
      baseData = lastYearData;
    } else {
      baseData = months.map(month => ({
        month,
        targetOccupancy: (72 + Math.random() * 15).toFixed(1),
        targetADR: (115 + Math.random() * 25).toFixed(0),
        targetRevenue: '',
      }));
    }

    const withIncrease = baseData.map(m => {
      const occ = parseFloat(m.targetOccupancy || '0');
      const adr = parseFloat(m.targetADR || '0');
      const adjustedADR = adr * (1 + increase / 100);
      const revenue = (occ / 100) * adjustedADR * 30 * 50;
      return {
        month: m.month,
        targetOccupancy: occ.toFixed(1),
        targetADR: adjustedADR.toFixed(0),
        targetRevenue: revenue.toFixed(0),
      };
    });
    setBudgetData(withIncrease);
    setStep('edit');
  };

  // Load existing budget for editing
  const loadExistingBudget = () => {
    const existing = existingBudget;
    if (existing) {
      setBudgetData([...existing]);
      setStep('edit');
    }
  };

  // Helper function to get days in a specific month and year
  const getDaysInMonth = (year: number, monthIndex: number): number => {
    // Month index is 0-based (0 for Jan, 11 for Dec)
    // Using day 0 of the *next* month gives the last day of the current month
    return new Date(year, monthIndex + 1, 0).getDate();
  };
// Handle field changes with improved auto-calculation
  const handleFieldChange = (index: number, fieldEdited: 'targetOccupancy' | 'targetADR' | 'targetRevenue', value: string) => {
    const newData = [...budgetData];
    // Ensure the directly edited field is updated first
    newData[index] = { ...newData[index], [fieldEdited]: value };
    console.log(`[Modal Input] Index: ${index}, Field: ${fieldEdited}, New Value: ${value}, Month: ${newData[index].month}`);

    // --- Refined Auto-calculation ---
    const currentMonthData = newData[index];
    const occStr = currentMonthData.targetOccupancy;
    const adrStr = currentMonthData.targetADR;
    const revStr = currentMonthData.targetRevenue;

    // Convert to numbers, treating empty/invalid as NaN
    const occ = occStr && !isNaN(parseFloat(occStr)) ? parseFloat(occStr) : NaN;
    const adr = adrStr && !isNaN(parseFloat(adrStr)) ? parseFloat(adrStr) : NaN;
    const rev = revStr && !isNaN(parseFloat(revStr)) ? parseFloat(revStr) : NaN;

    // Get actual days in the month
    const yearNum = parseInt(selectedYear);
    const monthIndex = months.indexOf(currentMonthData.month); // 0-based index
    const days = getDaysInMonth(yearNum, monthIndex);
    const rooms = 50; // TODO: Get dynamically if possible

    let calculatedValue: number | null = null;
    let fieldToUpdate: 'targetOccupancy' | 'targetADR' | 'targetRevenue' | null = null;

    // Try to calculate Revenue (if Occ & ADR are valid and Revenue was NOT just edited)
    if (fieldEdited !== 'targetRevenue' && !isNaN(occ) && occ > 0 && !isNaN(adr) && adr > 0) {
        calculatedValue = (occ / 100) * adr * days * rooms;
        fieldToUpdate = 'targetRevenue';
        console.log(`[Modal Calc] Path 1: Calculated Revenue = ${calculatedValue.toFixed(0)}`);
    }
    // Try to calculate ADR (if Rev & Occ are valid and ADR was NOT just edited)
    else if (fieldEdited !== 'targetADR' && !isNaN(rev) && rev > 0 && !isNaN(occ) && occ > 0) {
        const roomNightsSold = (occ / 100) * days * rooms;
        if (roomNightsSold > 0) {
            calculatedValue = rev / roomNightsSold;
            fieldToUpdate = 'targetADR';
            console.log(`[Modal Calc] Path 2: Calculated ADR = ${calculatedValue.toFixed(0)}`);
        } else {
            console.log('[Modal Calc] Path 2 skipped: Room nights sold is zero.');
        }
    }
    // Try to calculate Occupancy (if Rev & ADR are valid and Occ was NOT just edited)
    else if (fieldEdited !== 'targetOccupancy' && !isNaN(rev) && rev > 0 && !isNaN(adr) && adr > 0) {
        const totalRoomNightRevenuePotential = adr * days * rooms;
        if (totalRoomNightRevenuePotential > 0) {
            calculatedValue = (rev / totalRoomNightRevenuePotential) * 100;
            // Clamp occupancy between 0 and potentially > 100 (let user fix later if needed)
            calculatedValue = Math.max(0, calculatedValue);
            fieldToUpdate = 'targetOccupancy';
            console.log(`[Modal Calc] Path 3: Calculated Occupancy = ${calculatedValue.toFixed(1)}`);
        } else {
            console.log('[Modal Calc] Path 3 skipped: Revenue potential is zero.');
        }
    } else {
         console.log('[Modal Calc] No calculation path triggered or insufficient valid inputs.');
    }

    // Update the state ONLY if a field was calculated and it wasn't the one just edited
    if (fieldToUpdate && fieldToUpdate !== fieldEdited && calculatedValue !== null && isFinite(calculatedValue)) {
        // Format based on the field type
        const formattedValue = fieldToUpdate === 'targetOccupancy'
            ? calculatedValue.toFixed(1)
            : calculatedValue.toFixed(0);
        newData[index] = { ...newData[index], [fieldToUpdate]: formattedValue };
    }
    // Ensure the edited field retains its entered value if no calculation overwrites another field
    else if (fieldToUpdate !== fieldEdited) {
         newData[index] = { ...newData[index], [fieldEdited]: value };
    }


    setBudgetData(newData);
  };

const handleSave = () => {
    // Call the callback passed from Budgeting.tsx, which handles the API call and toast
    onSaveBudget(selectedYear, budgetData);
    // Do NOT show toast here
    handleClose(); // Close the modal
  };

  const handleClose = () => {
    setStep('select-year');
    setBudgetData([]);
    setSelectedYear(year);
    onClose();
  };

  const handleBackToMethod = () => {
    setStep('choose-method');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className={`
          bg-[#262626] border-[#3a3a35] text-[#e5e5e5] overflow-hidden flex flex-col p-0
          ${step === 'edit' 
            ? '!max-w-[85vw] !w-[85vw] !h-[85vh] !max-h-[85vh]' 
            : '!max-w-[600px] !w-[600px] max-h-[80vh]'
          }
        `}
      >
        
        {/* STEP 1: Select Year */}
        {step === 'select-year' && (
          <div className="flex flex-col">
            <div className="px-6 py-5 border-b border-[#3a3a35]">
              <DialogHeader>
                <DialogTitle className="text-[#e5e5e5] text-xl">Budget Management</DialogTitle>
                <DialogDescription className="text-[#9ca3af] text-sm">
                  Select which year's budget you want to create or edit
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-6">
              {/* Year Selection Cards */}
              <div className="space-y-3">
                {years.map((yr) => {
                  const hasBudget = hasExistingBudget(yr);
                  const isCurrent = yr === '2025';
                  
                  return (
                    <div
                      key={yr}
                      onClick={() => {
                        setSelectedYear(yr);
                        setStep('choose-method');
                      }}
                      className={`
                        relative bg-[#1f1f1c] border-2 rounded-lg p-4 cursor-pointer transition-all hover:border-[#faff6a]/50
                        ${selectedYear === yr ? 'border-[#faff6a] shadow-lg shadow-[#faff6a]/20' : 'border-[#3a3a35]'}
                      `}
                    >
                      <div className="flex items-center gap-4">
                        {/* Year Icon */}
                        <div className="w-12 h-12 rounded-lg bg-[#faff6a]/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-6 h-6 text-[#faff6a]" />
                        </div>

                        {/* Year Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[#e5e5e5] text-2xl">{yr}</h3>
                            {isCurrent && (
                              <Badge className="bg-[#faff6a]/20 text-[#faff6a] border-[#faff6a]/30 text-[9px] px-1.5 py-0.5">
                                Current
                              </Badge>
                            )}
                          </div>
                          
                          {/* Status */}
                          <div className="flex items-center gap-1.5">
                            {hasBudget ? (
                              <>
                                <div className="w-3.5 h-3.5 rounded-full bg-[#10b981]/20 flex items-center justify-center">
                                  <Check className="w-2 h-2 text-[#10b981]" />
                                </div>
                                <span className="text-[#10b981] text-xs">Budget exists</span>
                              </>
                            ) : (
                              <>
                                <div className="w-3.5 h-3.5 rounded-full bg-[#6b7280]/20 flex items-center justify-center">
                                  <X className="w-2 h-2 text-[#6b7280]" />
                                </div>
                                <span className="text-[#6b7280] text-xs">No budget set</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ArrowRight className="w-5 h-5 text-[#9ca3af]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Choose Method */}
        {step === 'choose-method' && (
          <div className="flex flex-col">
            <div className="px-6 py-4 border-b border-[#3a3a35]">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setStep('select-year')}
                  variant="ghost"
                  size="sm"
                  className="text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#3a3a35]"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#faff6a]/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[#faff6a]" />
                  </div>
                  <div>
                    <DialogTitle className="text-[#e5e5e5] text-xl">
                      {hasExistingBudget(selectedYear) ? `Edit ${selectedYear} Budget` : `Create ${selectedYear} Budget`}
                    </DialogTitle>
                    <DialogDescription className="text-[#9ca3af] text-xs">
                      Choose how you want to {hasExistingBudget(selectedYear) ? 'update' : 'create'} your budget
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="space-y-3">
                {/* If editing existing budget, show edit option first */}
                {hasExistingBudget(selectedYear) && (
                  <div 
                    onClick={loadExistingBudget}
                    className="bg-[#1f1f1c] border-2 border-[#faff6a]/40 rounded-lg p-4 hover:border-[#faff6a] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#faff6a]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#faff6a]/30 transition-colors">
                        <FileText className="w-6 h-6 text-[#faff6a]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[#e5e5e5] mb-1">Edit Existing Budget</h3>
                        <p className="text-[#9ca3af] text-xs">Modify your current {selectedYear} budget targets</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-[#9ca3af] group-hover:text-[#faff6a] transition-colors" />
                    </div>
                  </div>
                )}

                {/* Divider if editing */}
                {hasExistingBudget(selectedYear) && (
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#3a3a35]"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[#262626] px-3 text-[#6b7280] text-xs">Or start fresh</span>
                    </div>
                  </div>
                )}

                {/* Option 1: Start Blank */}
                <div 
                  onClick={initBlankBudget}
                  className="bg-[#1f1f1c] border-2 border-[#3a3a35] rounded-lg p-4 hover:border-[#faff6a]/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#3a3a35] flex items-center justify-center flex-shrink-0 group-hover:bg-[#4a4a45] transition-colors">
                      <FileText className="w-6 h-6 text-[#9ca3af]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[#e5e5e5] mb-1">Start with Blank Budget</h3>
                      <p className="text-[#9ca3af] text-xs">Create targets from scratch, or use quick fill later</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#9ca3af] group-hover:text-[#faff6a] transition-colors" />
                  </div>
                </div>

                {/* Option 2: Copy Last Year */}
                <div 
                  onClick={copyFromLastYear}
                  className="bg-[#1f1f1c] border-2 border-[#3a3a35] rounded-lg p-4 hover:border-[#faff6a]/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#3b82f6]/30 transition-colors">
                      <Copy className="w-6 h-6 text-[#3b82f6]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[#e5e5e5] mb-1">Copy Last Year's Actuals</h3>
                      <p className="text-[#9ca3af] text-xs">Use {parseInt(selectedYear) - 1} data as baseline</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#9ca3af] group-hover:text-[#faff6a] transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Edit Budget Table */}
        {step === 'edit' && (
          <div className="flex flex-col h-full">
            <div className="px-8 py-6 border-b border-[#3a3a35]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleBackToMethod}
                    variant="ghost"
                    className="text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#3a3a35]"
                  >
                    <ChevronLeft className="w-5 h-5 mr-2" />
                    Back
                  </Button>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#faff6a]/20 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-[#faff6a]" />
                    </div>
                    <div>
                      <DialogTitle className="text-[#e5e5e5] text-3xl">Edit {selectedYear} Budget</DialogTitle>
                      <DialogDescription className="text-[#9ca3af] text-base mt-1">
                        Set your monthly targets • Fill 2 of 3 fields to auto-calculate the third
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                {/* Budget Summary Cards */}
<div className="flex gap-3">
                  <div className="flex items-center gap-2 bg-[#1f1f1c] border border-[#3a3a35] rounded-lg px-3 py-2">
                    <DollarSign className="w-3.5 h-3.5 text-[#faff6a]" />
                    <div className="flex flex-col">
                      <span className="text-[#6b7280] text-[10px] uppercase tracking-wide">Total Revenue</span>
                      {/* [MODIFIED] Added 'text-sm' to reduce font size */}
                      <span className="text-[#e5e5e5] text-sm">{formatCurrency(budgetSummary.totalRevenue)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#1f1f1c] border border-[#3a3a35] rounded-lg px-3 py-2">
                    <Percent className="w-3.5 h-3.5 text-[#3b82f6]" />
                    <div className="flex flex-col">
                      <span className="text-[#6b7280] text-[10px] uppercase tracking-wide">Avg Occ</span>
                      {/* [MODIFIED] Added 'text-sm' to reduce font size */}
                      <span className="text-[#e5e5e5] text-sm">{budgetSummary.avgOccupancy.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[#1f1f1c] border border-[#3a3a35] rounded-lg px-3 py-2">
                    <Target className="w-3.5 h-3.5 text-[#10b981]" />
                    <div className="flex flex-col">
                      <span className="text-[#6b7280] text-[10px] uppercase tracking-wide">Complete</span>
                      {/* [MODIFIED] Added 'text-sm' to reduce font size */}
                      <span className="text-[#e5e5e5] text-sm">{budgetSummary.filledMonths}/12</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-3">
              {/* Toolbar with Apply from Last Year */}
              <div className="flex items-center justify-between mb-3 bg-[#1f1f1c] border border-[#3a3a35] rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
   {/* [MODIFIED] Clarified the label to explain what the % box does */}
                  <span className="text-[#9ca3af] text-xs">Apply % increase to {parseInt(selectedYear) - 1} data:</span>
                  <div className="flex items-center gap-2">
                    <div className="relative w-24">
                      <Input
                        type="number"
                        value={percentageIncrease}
                        onChange={(e) => setPercentageIncrease(e.target.value)}
                        className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] text-center pr-7 h-8 text-xs"
                        placeholder="0"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] text-xs">%</span>
                    </div>
                    <Button
                      onClick={copyWithIncrease}
                      size="sm"
                      className="bg-[#3b82f6] text-white hover:bg-[#2563eb] h-8 px-3 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
                <div className="text-[#6b7280] text-xs">Revenue-only budgeting or driver-based (fill 2 of 3 fields)</div>
              </div>

              {/* Budget Table */}
              <div className="border-2 border-[#3a3a35] rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#1f1f1c]">
                    <tr>
                      <th className="text-left px-3 py-2 text-[#9ca3af] text-xs uppercase tracking-wide border-r border-[#3a3a35] w-[110px]">
                        Month
                      </th>
                      <th className="text-center px-2 py-2 text-[#9ca3af] text-xs uppercase tracking-wide border-r border-[#3a3a35]">
                        Target Occ %
                      </th>
                      <th className="text-center px-2 py-2 text-[#9ca3af] text-xs uppercase tracking-wide border-r border-[#3a3a35]">
                        Target ADR (£)
                      </th>
                      <th className="text-center px-2 py-2 text-[#9ca3af] text-xs uppercase tracking-wide">
                        Target Revenue (£)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetData.map((row, index) => (
                      <tr key={row.month} className="border-b border-[#2a2a25] hover:bg-[#2a2a25] transition-colors">
                        <td className="px-3 py-1.5 text-[#e5e5e5] border-r border-[#2a2a25]">
                          <span className="text-xs">{row.month} {selectedYear}</span>
                        </td>
                        <td className="px-1.5 py-1.5 text-center border-r border-[#2a2a25]">
                          <Input
                            type="number"
                            step="0.1"
                            value={row.targetOccupancy}
                            onChange={(e) => handleFieldChange(index, 'targetOccupancy', e.target.value)}
                            className="h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-center text-xs hover:border-[#faff6a]/40 focus:border-[#faff6a] transition-colors"
                            placeholder="75.0"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center border-r border-[#2a2a25]">
                          <Input
                            type="number"
                            step="1"
                            value={row.targetADR}
                            onChange={(e) => handleFieldChange(index, 'targetADR', e.target.value)}
                            className="h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-center text-xs hover:border-[#faff6a]/40 focus:border-[#faff6a] transition-colors"
                            placeholder="120"
                          />
                        </td>
                        <td className="px-1.5 py-1.5 text-center">
                          <Input
                            type="number"
                            step="100"
                            value={row.targetRevenue}
                            onChange={(e) => handleFieldChange(index, 'targetRevenue', e.target.value)}
                            className="h-8 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-center text-xs hover:border-[#faff6a]/40 focus:border-[#faff6a] transition-colors"
                            placeholder="45000"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer with Actions */}
            <div className="px-8 py-6 border-t border-[#3a3a35] bg-[#1f1f1c]">
              <div className="flex justify-between items-center">
                <div className="text-[#9ca3af] text-sm">
                  {budgetSummary.filledMonths === 12 ? (
                    <div className="flex items-center gap-2 text-[#10b981]">
                      <Check className="w-4 h-4" />
                      <span>All months configured</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{12 - budgetSummary.filledMonths} months remaining</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button
                    onClick={handleClose}
                    variant="ghost"
                    className="text-[#9ca3af] hover:text-[#e5e5e5] hover:bg-[#3a3a35] px-8 h-12"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a] px-10 h-12 text-base"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Save {selectedYear} Budget
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}