import { TrendingUp, TrendingDown } from 'lucide-react';

// [NEW] Define the types from App.tsx
interface KpiDataSet {
  occupancy: number;
  adr: number;
  revpar: number;
  totalRevenue?: number;
}

interface KpiData {
  yourHotel: KpiDataSet;
  market: KpiDataSet;
}

// [NEW] Define the component's props
interface InsightsCardProps {
  kpiData: KpiData;
  currencyCode: string;
}

interface MetricComparison {
  name: string;
  yourValue: number;
  marketValue: number;
  format: 'percentage' | 'currency';
  rank: number; // Not used in this design, but kept for type structure
  totalProperties: number; // Not used in this design, but kept for type structure
}

// [MODIFIED] Update the component to accept props
export function InsightsCard({ kpiData, currencyCode }: InsightsCardProps) {
  // [MODIFIED] Build the metrics array dynamically from props
  const metrics: MetricComparison[] = [
    {
      name: 'Occupancy',
      yourValue: kpiData.yourHotel.occupancy,
      marketValue: kpiData.market.occupancy,
      format: 'percentage',
      rank: 0, // Not used
      totalProperties: 0, // Not used
    },
    {
      name: 'ADR',
      yourValue: kpiData.yourHotel.adr,
      marketValue: kpiData.market.adr,
      format: 'currency',
      rank: 0, // Not used
      totalProperties: 0, // Not used
    },
    {
      name: 'RevPAR',
      yourValue: kpiData.yourHotel.revpar,
      marketValue: kpiData.market.revpar,
      format: 'currency',
      rank: 0, // Not used
      totalProperties: 0, // Not used
    },
  ];

  // [MODIFIED] Update formatValue to use the currencyCode prop
  const formatValue = (value: number, format: 'percentage' | 'currency'): string => {
    if (format === 'percentage') {
      return `${(value || 0).toFixed(1)}%`; // Add (|| 0) for safety
    }
    // Use Intl.NumberFormat for correct currency formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2, // Keep the cents as per the design
      maximumFractionDigits: 2,
    }).format(value || 0);
  };

  const isOutperforming = (yourValue: number, marketValue: number): boolean => {
    return (yourValue || 0) > (marketValue || 0); // Add (|| 0) for safety
  };

  // [MODIFIED] Update calculateDifference to use the currencyCode prop
  const calculateDifference = (yourValue: number, marketValue: number, format: 'percentage' | 'currency'): string => {
    const diff = (yourValue || 0) - (marketValue || 0);
    const absDiff = Math.abs(diff);
    const prefix = diff >= 0 ? '+' : '-';
    
    if (format === 'percentage') {
      return `${prefix}${absDiff.toFixed(1)}%`;
    }
    // Use Intl.NumberFormat to format the difference as currency
    // The prefix will be added before the currency symbol (e.g., +$10.50)
    return `${prefix}${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absDiff)}`;
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-3">
      <h3 className="text-[#e5e5e5] mb-3 text-sm">Your Hotel vs Comp Set</h3>
      <div className="space-y-2">
        {metrics.map((metric, index) => {
          const outperforming = isOutperforming(metric.yourValue, metric.marketValue);
          const Icon = outperforming ? TrendingUp : TrendingDown;
          const iconColor = outperforming ? '#10b981' : '#ef4444';
          const differenceText = calculateDifference(metric.yourValue, metric.marketValue, metric.format);
          const differenceColor = outperforming ? '#10b981' : '#ef4444';

          return (
            <div 
              key={index} 
              className="flex items-center justify-between p-2.5 bg-[#1f1f1c] rounded hover:bg-[#23231F] transition-colors"
            >
              {/* Left side: Icon + Metric Name */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon 
                  className="w-4 h-4 flex-shrink-0" 
                  style={{ color: iconColor }}
                />
                <span className="text-[#e5e5e5] text-xs truncate">{metric.name}</span>
              </div>

              {/* Right side: Values + Difference */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Comparison Values */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#faff6a] text-xs font-medium">
                    {formatValue(metric.yourValue, metric.format)}
                  </span>
                  <span className="text-[#6b7280] text-xs">vs</span>
                  <span className="text-[#9ca3af] text-xs">
                    {formatValue(metric.marketValue, metric.format)}
                  </span>
                </div>

                {/* Difference Badge */}
                <div className="bg-[#23231F] border border-[#3a3a35] rounded px-2 py-0.5">
                  <span 
                    className="text-[10px] font-medium"
                    style={{ color: differenceColor }}
                  >
                    {differenceText}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}