interface KPICardProps {
  label: string;
  value: string | number;
currencyCode?: string; // Accept currency code instead of prefix
  suffix?: string;
  change?: number;
  trend?: 'up' | 'down';
  // Add a new prop for the comparison text.
  comparisonText?: string; 
}

export function KPICard({ label, value, currencyCode, suffix, change, trend, comparisonText = "vs last period" }: KPICardProps) {
  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-3">
      <div className="text-[#9ca3af] text-xs mb-1">{label}</div>
 <div className="flex items-baseline gap-1">
    <span className="text-white text-xl">
      {currencyCode ? // If a currency code is provided...
        new Intl.NumberFormat('en-US', { // ...use Intl.NumberFormat
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 0, // No decimals for KPIs
          maximumFractionDigits: 0,
        }).format(parseFloat(value as string) || 0) // Convert value to number and format
      : // Otherwise, just display the value as is
        value 
      }
    </span>
    {/* Suffix is still displayed normally */}
  {suffix && <span className="text-[#9ca3af] text-sm">{suffix}</span>}
  </div>
      {/* This now uses the dynamic comparison text. */}
      {change !== undefined && (
        <div className={`text-xs mt-1 ${trend === 'up' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
          {trend === 'up' ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% {comparisonText}
        </div>
      )}
    </div>
  );
}