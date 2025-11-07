import { useState, useEffect } from 'react';

interface ReportTableProps {
  startDate: string;
  endDate: string;
  granularity: string;
  selectedMetrics: string[];
  displayTotals: boolean;
  showMarketComparisons: boolean;
  taxInclusive: boolean;
  tableLayout: string;
  data: any[];
  currencyCode: string; // Use currency code
}

export function ReportTable({
  startDate,
  endDate,
  granularity,
  selectedMetrics,
  displayTotals,
  showMarketComparisons,
  taxInclusive,
  tableLayout,
  data,
  currencyCode,
}: ReportTableProps) {
  // Mapping for display labels
  const metricLabels: Record<string, string> = {
    'occupancy': 'Occupancy',
    'adr': 'ADR',
    'revpar': 'RevPAR',
    'total-revenue': 'Total Revenue',
    'rooms-sold': 'Rooms Sold',
    'rooms-unsold': 'Rooms Unsold',
    'market-occupancy': 'Market Occ',
    'market-adr': 'Market ADR',
    'market-revpar': 'Market RevPAR',
  };

  // Robust formatting function using Intl.NumberFormat
  const formatValue = (metric: string, value: any) => {
    const numValue = parseFloat(value);

    if (value === null || value === undefined || isNaN(numValue)) {
      return '-';
    }

    // Use Intl.NumberFormat for currency and separators
    const currencyFormatter = (digits: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

    if (metric.includes('occupancy')) {
      return `${(numValue * 100).toFixed(1)}%`;
    }
    if (metric.includes('adr') || metric.includes('revpar')) {
      return currencyFormatter(2).format(numValue);
    }
    if (metric.includes('revenue')) {
      return currencyFormatter(0).format(numValue);
    }
    return new Intl.NumberFormat('en-US').format(Math.round(numValue));
  };

  // Render message if no data
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] p-12 text-center">
        <div className="text-[#9ca3af] text-sm">
          No report data available. Click "Run Report" to generate.
        </div>
      </div>
    );
  }

  // Main component render
  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] overflow-hidden">
      {/* Header showing date range and granularity */}
      <div className="px-6 py-4 border-b border-[#3a3a35]">
        <div className="text-[#e5e5e5] text-sm">
          Displaying <span className="text-[#faff6a]">{granularity}</span> data from{' '}
          <span className="text-[#faff6a]">{startDate}</span> to{' '}
          <span className="text-[#faff6a]">{endDate}</span>
        </div>
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#2C2C2C]">
            <tr className="border-b border-[#3a3a35]">
              <th className="px-6 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider sticky left-0 bg-[#2C2C2C]">
                Date
              </th>
              {selectedMetrics.map(metric => (
                <th key={metric} className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider">
                  {metricLabels[metric] || metric.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </th>
              ))}
              {showMarketComparisons && selectedMetrics
                .filter(metric => !metric.startsWith('market-') && selectedMetrics.includes(`market-${metric}`))
                .map(metric => (
                  <th key={`${metric}-delta-header`} className="px-4 py-3 text-left text-[#9ca3af] text-xs uppercase tracking-wider border-l border-[#3a3a35]">
                    Delta ({metricLabels[metric] || metric.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())})
                  </th>
                ))}
            </tr>
          </thead>{/* [FIX] No whitespace between thead and tbody */}
          <tbody>{/* [FIX] No whitespace or comments after this tag */}
            {data.map((row, index) => (
              <tr key={index} className="border-t border-[#3a3a35] hover:bg-[#3a3a35]/30 transition-colors">
                <td className="px-6 py-3 text-[#e5e5e5] text-xs sticky left-0 bg-[#2C2C2C]">
                  {new Date(row.period).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                {selectedMetrics.map(metric => (
                  <td key={metric} className="px-4 py-3 text-[#e5e5e5] text-xs">
                    {formatValue(metric, row[metric])}
                  </td>
                ))}
                {showMarketComparisons && selectedMetrics
                  .filter(metric => !metric.startsWith('market-') && selectedMetrics.includes(`market-${metric}`))
                  .map(metric => {
                    const hotelMetricKey = metric;
                    const marketMetricKey = `market-${metric}`;
                    const hotelValue = parseFloat(row[hotelMetricKey]) || 0;
                    const marketValue = parseFloat(row[marketMetricKey]) || 0;
                    const delta = hotelValue - marketValue;
                    const deltaFormatted = formatValue(metric, delta);
                    const colorClass = delta > 0 ? 'text-[#10b981]' : delta < 0 ? 'text-[#ef4444]' : 'text-[#9ca3af]';
                    return (
                      <td key={`${metric}-delta`} className={`px-4 py-3 text-xs border-l border-[#3a3a35] ${colorClass}`}>
                        {deltaFormatted}
                      </td>
                    );
                  })}
              </tr>
            ))}
            {displayTotals && (() => {
              // Calculate Totals/Averages
              const totals: { [key: string]: number } = {};
              const counts: { [key: string]: number } = {};
              data.forEach(row => {
                selectedMetrics.forEach(metric => {
                  const value = parseFloat(row[metric]);
                  if (!isNaN(value)) {
                    totals[metric] = (totals[metric] || 0) + value;
                    counts[metric] = (counts[metric] || 0) + 1;
                  }
                });
              });
              const metricsToAverage = ['occupancy', 'adr', 'revpar', 'market-occupancy', 'market-adr', 'market-revpar'];

              // Render Totals Row
              return (
                <tr className="border-t-2 border-[#faff6a]/30 bg-[#3a3a35]/20">
                  <td className="px-6 py-3 text-[#faff6a] text-xs uppercase tracking-wider sticky left-0 bg-[#3a3a35]/20">
                    Totals / Avg
                  </td>
                  {selectedMetrics.map(metric => {
                    let finalValue: number | undefined;
                    const totalValue = totals[metric];
                    const count = counts[metric];
                    if (count > 0) {
                      finalValue = metricsToAverage.includes(metric) ? totalValue / count : totalValue;
                    }
                    return (
                      <td key={metric + '-total'} className="px-4 py-3 text-[#faff6a] text-xs">
                        {finalValue !== undefined ? formatValue(metric, finalValue) : '-'}
                      </td>
                    );
                  })}
                  {showMarketComparisons && selectedMetrics
                    .filter(metric => !metric.startsWith('market-') && selectedMetrics.includes(`market-${metric}`))
                    .map(metric => {
                      const hotelMetricKey = metric;
                      const marketMetricKey = `market-${metric}`;
                      const hotelTotalValue = totals[hotelMetricKey];
                      const hotelCount = counts[hotelMetricKey];
                      const marketTotalValue = totals[marketMetricKey];
                       const marketCount = counts[marketMetricKey];
                      let hotelFinalValue: number | undefined;
                      let marketFinalValue: number | undefined;
                      if (hotelCount > 0) {
                        hotelFinalValue = metricsToAverage.includes(hotelMetricKey) 
                          ? hotelTotalValue / hotelCount 
                          : hotelTotalValue;
                      }
                      if (marketCount > 0) {
                        marketFinalValue = metricsToAverage.includes(marketMetricKey) 
                          ? marketTotalValue / marketCount 
                          : marketTotalValue;
                      }
                      let deltaFinalValue: number | undefined;
                      if (hotelFinalValue !== undefined && marketFinalValue !== undefined) {
                        deltaFinalValue = hotelFinalValue - marketFinalValue;
                      }
                      const deltaFormatted = deltaFinalValue !== undefined ? formatValue(metric, deltaFinalValue) : '-';
                      const colorClass = deltaFinalValue !== undefined 
                        ? (deltaFinalValue > 0 ? 'text-[#10b981]' : deltaFinalValue < 0 ? 'text-[#ef4444]' : 'text-[#faff6a]') 
                        : 'text-[#faff6a]';
                      return (
                        <td key={`${metric}-delta-total`} className={`px-4 py-3 text-xs border-l border-[#3a3a35] ${colorClass}`}>
                          {deltaFormatted}
                        </td>
                      );
                    })}
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}