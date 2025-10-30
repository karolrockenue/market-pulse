import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { ChevronDown, X } from 'lucide-react';

interface MetricSelectorProps {
  selectedMetrics: string[];
  onToggleMetric: (metric: string) => void;
}

export function MetricSelector({ selectedMetrics, onToggleMetric }: MetricSelectorProps) {
  const allMetrics = [
    { id: 'occupancy', label: 'Occupancy', category: 'Hotel' },
    { id: 'adr', label: 'ADR', category: 'Hotel' },
    { id: 'revpar', label: 'RevPAR', category: 'Hotel' },
    { id: 'total-revenue', label: 'Total Revenue', category: 'Hotel' },
    { id: 'rooms-sold', label: 'Rooms Sold', category: 'Hotel' },
    { id: 'rooms-unsold', label: 'Rooms Unsold', category: 'Hotel' },
    { id: 'market-occupancy', label: 'Market Occupancy', category: 'Market' },
    { id: 'market-adr', label: 'Market ADR', category: 'Market' },
  ];

  const hotelMetrics = allMetrics.filter(m => m.category === 'Hotel');
  const marketMetrics = allMetrics.filter(m => m.category === 'Market');

  const getMetricLabel = (id: string) => {
    return allMetrics.find(m => m.id === id)?.label || id;
  };

  return (
    <div>
      <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider">
        Metrics ({selectedMetrics.length} selected)
      </label>
      
      <div className="flex gap-2 flex-wrap items-center">
        {selectedMetrics.map(metric => (
          <Badge
            key={metric}
            className="bg-[#faff6a]/10 text-[#faff6a] border border-[#faff6a]/30 hover:bg-[#faff6a]/20 pr-1"
          >
            {getMetricLabel(metric)}
            <button
              onClick={() => onToggleMetric(metric)}
              className="ml-1 hover:bg-[#faff6a]/30 rounded p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] h-7 text-xs"
            >
              <ChevronDown className="w-3 h-3 mr-1" />
              Add Metrics
            </Button>
          </PopoverTrigger>
          <PopoverContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5] w-80" align="start">
            <div className="space-y-4">
              <div>
                <h4 className="text-[#9ca3af] text-xs mb-2 uppercase tracking-wider">Hotel Metrics</h4>
                <div className="space-y-2">
                  {hotelMetrics.map(metric => (
                    <label key={metric.id} className="flex items-center gap-2 cursor-pointer group py-1">
                      <Checkbox
                        checked={selectedMetrics.includes(metric.id)}
                        onCheckedChange={() => onToggleMetric(metric.id)}
                        className="border-[#3a3a35] data-[state=checked]:bg-[#faff6a] data-[state=checked]:border-[#faff6a]"
                      />
                      <span className="text-[#e5e5e5] text-sm group-hover:text-white transition-colors">
                        {metric.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-[#3a3a35] pt-3">
                <h4 className="text-[#9ca3af] text-xs mb-2 uppercase tracking-wider">Market Metrics</h4>
                <div className="space-y-2">
                  {marketMetrics.map(metric => (
                    <label key={metric.id} className="flex items-center gap-2 cursor-pointer group py-1">
                      <Checkbox
                        checked={selectedMetrics.includes(metric.id)}
                        onCheckedChange={() => onToggleMetric(metric.id)}
                        className="border-[#3a3a35] data-[state=checked]:bg-[#faff6a] data-[state=checked]:border-[#faff6a]"
                      />
                      <span className="text-[#e5e5e5] text-sm group-hover:text-white transition-colors">
                        {metric.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
