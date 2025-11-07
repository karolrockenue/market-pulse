import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Settings2 } from 'lucide-react';

interface FormattingOptionsProps {
  displayTotals: boolean;
  setDisplayTotals: (value: boolean) => void;
  taxInclusive: boolean;
  setTaxInclusive: (value: boolean) => void;
  showMarketComparisons: boolean;
  setShowMarketComparisons: (value: boolean) => void;
  tableLayout: string;
  setTableLayout: (value: string) => void;
}

export function FormattingOptions({
  displayTotals,
  setDisplayTotals,
  taxInclusive,
  setTaxInclusive,
  showMarketComparisons,
  setShowMarketComparisons,
  tableLayout,
  setTableLayout,
}: FormattingOptionsProps) {
  const activeOptionsCount = [displayTotals, taxInclusive, showMarketComparisons].filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-9"
        >
          <Settings2 className="w-4 h-4 mr-2" />
          Formatting
          {activeOptionsCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-[#faff6a]/20 text-[#faff6a] text-xs rounded">
              {activeOptionsCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] w-80" align="end">
        <div className="space-y-3">
          <h3 className="text-[#e5e5e5] text-sm mb-3">Formatting Options</h3>
          
          <div className="flex items-center justify-between py-2 border-b border-[#3a3a35]">
            <div>
              <div className="text-[#e5e5e5] text-sm">Display Totals</div>
              <div className="text-[#9ca3af] text-xs">Show averages row</div>
            </div>
            <Switch
              checked={displayTotals}
              onCheckedChange={setDisplayTotals}
              className="data-[state=checked]:bg-[#faff6a]"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[#3a3a35]">
            <div>
              <div className="text-[#e5e5e5] text-sm">Tax-Inclusive</div>
              <div className="text-[#9ca3af] text-xs">Include tax in values</div>
            </div>
            <Switch
              checked={taxInclusive}
              onCheckedChange={setTaxInclusive}
              className="data-[state=checked]:bg-[#faff6a]"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-b border-[#3a3a35]">
            <div>
              <div className="text-[#e5e5e5] text-sm">Market Comparisons</div>
              <div className="text-[#9ca3af] text-xs">Show delta columns</div>
            </div>
            <Switch
              checked={showMarketComparisons}
              onCheckedChange={setShowMarketComparisons}
              className="data-[state=checked]:bg-[#faff6a]"
            />
          </div>

          {showMarketComparisons && (
            <div className="pt-2">
              <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
                Table Layout
              </label>
              <Select value={tableLayout} onValueChange={setTableLayout}>
                <SelectTrigger className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5]">
                  <SelectItem value="group-by-metric">Group by Metric</SelectItem>
                  <SelectItem value="group-by-source">Group by Source</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
