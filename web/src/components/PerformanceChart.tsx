import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// [NEW] This interface expects a string 'date', not a number 'timestamp'
interface PerformanceChartProps {
  data: Array<{
    date: string; // This is the key change
    you: number;
    market: number;
  }>;
  metric: string;
  chartType?: 'line' | 'bar'; // New prop to control chart type
  currencyCode: string; // [MODIFIED] Added currencyCode back in
}

export function PerformanceChart({ data, metric, chartType = 'line', currencyCode }: PerformanceChartProps) {
  
  // [MODIFIED] Use currencyCode for formatting
  const formatValue = (value: number) => {
    if (metric === 'occupancy') return `${value.toFixed(1)}%`;
    
    // Use Intl.NumberFormat for currency
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0, // No decimals for chart
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      occupancy: 'Occupancy',
      adr: 'ADR',
      revpar: 'RevPAR'
    };
    return labels[metric] || metric;
  };

  // [NEW] This is the custom tooltip from the prototype
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1f1f1c] border border-[#3a3a35] rounded p-3 shadow-lg">
          {/* It uses the string 'date' property directly */}
          <p className="text-[#e5e5e5] text-xs mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#faff6a]" />
              <span className="text-[#9ca3af] text-xs">You:</span>
              <span className="text-[#faff6a] text-xs">{formatValue(payload[0].value)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#9ca3af]" />
              <span className="text-[#9ca3af] text-xs">Market:</span>
              <span className="text-[#e5e5e5] text-xs">{formatValue(payload[1].value)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const commonProps = {
    data,
    margin: { top: 10, right: 10, left: 0, bottom: 0 }
  };

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[#e5e5e5]">Performance Comparison</h3>
          <div className="px-2.5 py-1 rounded bg-[#faff6a]/10 border border-[#faff6a]/30">
            <span className="text-[#faff6a] text-xs">{getMetricLabel(metric)}</span>
          </div>
        </div>
        {/* [NEW] This is the legend from the prototype */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 ${chartType === 'bar' ? 'bg-[#faff6a]' : 'rounded-full bg-[#faff6a]'}`} />
            <span className="text-[#9ca3af]">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 ${chartType === 'bar' ? 'bg-[#9ca3af]' : 'rounded-full bg-[#9ca3af]'}`} />
            <span className="text-[#9ca3af]">Market</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {/* [NEW] Logic to switch chart type */}
          {chartType === 'bar' ? (
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" vertical={false} />
              <XAxis 
                dataKey="date" // Simple string dataKey
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={{ stroke: '#3a3a35' }}
                // [NEW] This automatically skips labels to prevent overlap
                interval="auto" 
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={{ stroke: '#3a3a35' }}
                // [MODIFIED] Use currencyCode-aware formatter
                tickFormatter={(value) => {
                  if (metric === 'occupancy') return `${value.toFixed(0)}%`;
                  // Format as currency, but just the number
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currencyCode,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(value).replace(/[^0-9,]/g, ''); // Keep numbers/commas
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#3a3a35', opacity: 0.3 }} />
    <Bar 
                dataKey="you" 
                fill="#faff6a" 
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
                // [NEW] Add the drawing animation
                isAnimationActive={true}
                animationDuration={800}
              />
              <Bar 
                dataKey="market" 
                fill="#9ca3af" 
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
                // [NEW] Add the drawing animation
                isAnimationActive={true}
                animationDuration={800}
                animationBegin={200} // Start this one slightly later
              />
            </BarChart>
          ) : (
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" vertical={false} />
              <XAxis 
                dataKey="date" // Simple string dataKey
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={{ stroke: '#3a3a35' }}
                // [NEW] This automatically skips labels to prevent overlap
                interval="auto"
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={{ stroke: '#3a3a35' }}
                // [MODIFIED] Use currencyCode-aware formatter
                tickFormatter={(value) => {
                  if (metric === 'occupancy') return `${value.toFixed(0)}%`;
                  // Format as currency, but just the number
                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currencyCode,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(value).replace(/[^0-9,]/g, ''); // Keep numbers/commas
                }}
              />
              <Tooltip content={<CustomTooltip />} />
<Line 
                type="monotone" 
                dataKey="you" 
                stroke="#faff6a" 
                strokeWidth={2}
                dot={{ fill: '#faff6a', r: 3 }}
                activeDot={{ r: 5, fill: '#faff6a' }}
                // [MODIFY PROPS HERE]
                isAnimationActive={true}
                animationDuration={800}
              />
              <Line 
                type="monotone" 
                dataKey="market" 
                stroke="#9ca3af" 
                strokeWidth={2}
                dot={{ fill: '#9ca3af', r: 3 }}
                activeDot={{ r: 5, fill: '#9ca3af' }}
                // [MODIFY PROPS HERE]
      // [VARIANT A]
         // [VARIANT B]
                isAnimationActive={true}
                animationDuration={1100}
                animationEasing="ease-in"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}