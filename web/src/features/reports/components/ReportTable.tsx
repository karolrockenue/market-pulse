// web/src/features/reports/components/ReportTable.tsx

import { useState } from 'react';
import { ChevronDown, X, Settings2 } from 'lucide-react';

interface ReportTableProps {
  data: any[];
  isLoading: boolean;
  granularity: string;
  startDate: string;
  endDate: string;
  selectedMetrics: string[];
  onToggleMetric: (metric: string) => void;
  displayTotals: boolean;
  setDisplayTotals: (val: boolean) => void;
  taxInclusive: boolean;
  setTaxInclusive: (val: boolean) => void;
  showMarketComparisons: boolean;
  setShowMarketComparisons: (val: boolean) => void;
  currencyCode: string;
}

export function ReportTable({ 
  data, 
  isLoading,
  granularity,
  startDate,
  endDate,
  selectedMetrics,
  onToggleMetric,
  displayTotals,
  setDisplayTotals,
  taxInclusive,
  setTaxInclusive,
  showMarketComparisons,
  setShowMarketComparisons,
  currencyCode
}: ReportTableProps) {
  
  const [showMetricsDropdown, setShowMetricsDropdown] = useState(false);
  const [showFormattingDropdown, setShowFormattingDropdown] = useState(false);

  // --- CONSTANTS ---
  const allMetrics = [
    { id: 'occupancy', label: 'Occupancy', category: 'Hotel' },
    { id: 'adr', label: 'ADR', category: 'Hotel' },
    { id: 'revpar', label: 'RevPAR', category: 'Hotel' },
    { id: 'total-revenue', label: 'Total Revenue', category: 'Hotel' },
    { id: 'rooms-sold', label: 'Rooms Sold', category: 'Hotel' },
    { id: 'rooms-unsold', label: 'Rooms Unsold', category: 'Hotel' },
    { id: 'market-occupancy', label: 'Market Occ', category: 'Market' },
    { id: 'market-adr', label: 'Market ADR', category: 'Market' },
    { id: 'market-revpar', label: 'Market RevPAR', category: 'Market' },
    { id: 'market-total-revenue', label: 'Market Rev', category: 'Market' },
  ];

  const hotelMetrics = allMetrics.filter(m => m.category === 'Hotel');
  const marketMetrics = allMetrics.filter(m => m.category === 'Market');
  const activeOptionsCount = [displayTotals, taxInclusive, showMarketComparisons].filter(Boolean).length;

  const getMetricLabel = (id: string) => allMetrics.find(m => m.id === id)?.label || id;

  const formatValue = (metric: string, value: any) => {
    const num = parseFloat(value);
    if (value === null || value === undefined || isNaN(num)) return '-';

    const currencyFormatter = (digits: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

    if (metric.includes('occupancy')) return `${(num * 100).toFixed(1)}%`;
    if (metric.includes('rooms-sold') || metric.includes('rooms-unsold')) return Math.round(num).toString();
    if (metric.includes('revenue')) return currencyFormatter(0).format(num);
    return currencyFormatter(2).format(num);
  };

  const calculateAverage = (metric: string) => {
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((acc, row) => acc + (parseFloat(row[metric]) || 0), 0);
    return sum / data.length;
  };

  const sortedMetrics = [...selectedMetrics].sort((a, b) => {
    const priority = ['rooms-sold', 'rooms-unsold'];
    const idxA = priority.indexOf(a);
    const idxB = priority.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return allMetrics.findIndex(m => m.id === a) - allMetrics.findIndex(m => m.id === b);
  });

  // --- STYLES (Compact / Dark Theme) ---
  const containerStyle = {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    padding: '16px', // Reduced from 20px
    marginBottom: '20px' // Reduced from 24px
  };

  const controlGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px' // Reduced gap
  };

  const labelStyle = {
    color: '#6b7280',
    fontSize: '12px',
    marginBottom: '8px',
    display: 'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.025em'
  };

  const metricTagStyle = {
    backgroundColor: 'rgba(57, 189, 248, 0.1)',
    color: '#39BDF8',
    border: '1px solid rgba(57, 189, 248, 0.3)',
    padding: '2px 8px', // Tighter padding
    borderRadius: '6px',
    fontSize: '12px', // Strict 12px
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  const buttonStyle = {
    backgroundColor: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#e5e5e5',
    height: '32px', // Reduced height from 36px for compact feel
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    padding: '0 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'inherit'
  };

  const dropdownStyle = {
    position: 'absolute' as const,
    top: '100%',
    marginTop: '8px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '16px',
    zIndex: 50,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
  };

  // Table Styles (Compact)
  const tableHeaderStyle = {
    padding: '10px 12px', // Compact padding
    textAlign: 'left' as const,
    color: '#6b7280',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.025em',
    position: 'sticky' as const,
    left: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 10,
    borderBottom: '1px solid #2a2a2a'
  };

  const tableCellStyle = {
    padding: '10px 12px', // Compact padding (matches header)
    color: '#e5e5e5',
    fontSize: '14px',
    borderTop: '1px solid #2a2a2a'
  };

  const stickyCellStyle = {
    ...tableCellStyle,
    position: 'sticky' as const,
    left: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 10,
    borderRight: '1px solid #2a2a2a'
  };

  const totalRowStyle = {
    borderTop: '2px solid rgba(57, 189, 248, 0.3)',
    backgroundColor: '#0f0f0f'
  };

  const totalCellStyle = {
    padding: '10px 12px', // Compact padding
    color: '#39BDF8',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const
  };

  return (
    <div>
      {/* METRICS & FORMATTING CONTROLS */}
      <div style={containerStyle}>
        <div style={controlGridStyle}>
          
          {/* Left Side: Metric Selector */}
          <div>
            <label style={labelStyle}>
              Metrics ({selectedMetrics.length} selected)
            </label>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {selectedMetrics.map(metric => (
                <div key={metric} style={metricTagStyle}>
                  {getMetricLabel(metric)}
                  <button 
                    onClick={() => onToggleMetric(metric)}
                    style={{ marginLeft: '4px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: '#39BDF8' }}
                  >
                    <X style={{ width: '10px', height: '10px' }} />
                  </button>
                </div>
              ))}
              
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMetricsDropdown(!showMetricsDropdown)}
                  style={{ ...buttonStyle, height: '24px' }} // Even smaller for "Add Metrics"
                >
                  <ChevronDown style={{ width: '12px', height: '12px' }} />
                  Add Metrics
                </button>

                {showMetricsDropdown && (
                  <div style={{ ...dropdownStyle, left: 0, width: '320px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', marginTop: 0 }}>Hotel Metrics</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {hotelMetrics.map(metric => (
                          <label key={metric.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedMetrics.includes(metric.id)} 
                              onChange={() => onToggleMetric(metric.id)}
                            />
                            <span style={{ color: '#e5e5e5', fontSize: '14px' }}>{metric.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: '12px' }}>
                      <h4 style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', marginTop: 0 }}>Market Metrics</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {marketMetrics.map(metric => (
                          <label key={metric.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedMetrics.includes(metric.id)} 
                              onChange={() => onToggleMetric(metric.id)}
                            />
                            <span style={{ color: '#e5e5e5', fontSize: '14px' }}>{metric.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Right Side: Formatting Options */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFormattingDropdown(!showFormattingDropdown)}
                style={buttonStyle}
              >
                <Settings2 style={{ width: '14px', height: '14px' }} />
                Formatting
                {activeOptionsCount > 0 && (
                  <span style={{ marginLeft: '8px', padding: '1px 5px', backgroundColor: 'rgba(57, 189, 248, 0.2)', color: '#39BDF8', fontSize: '10px', borderRadius: '4px' }}>
                    {activeOptionsCount}
                  </span>
                )}
              </button>

              {showFormattingDropdown && (
                <div style={{ ...dropdownStyle, right: 0, width: '280px' }}>
                  <h3 style={{ color: '#e5e5e5', fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', marginTop: 0 }}>Formatting Options</h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a2a' }}>
                    <div>
                      <div style={{ color: '#e5e5e5', fontSize: '14px' }}>Display Totals</div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Show averages row</div>
                    </div>
                    <input type="checkbox" checked={displayTotals} onChange={(e) => setDisplayTotals(e.target.checked)} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2a2a2a' }}>
                    <div>
                      <div style={{ color: '#e5e5e5', fontSize: '14px' }}>Tax-Inclusive</div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Include tax in values</div>
                    </div>
                    <input type="checkbox" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                    <div>
                      <div style={{ color: '#e5e5e5', fontSize: '14px' }}>Market Comparisons</div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Show delta columns</div>
                    </div>
                    <input type="checkbox" checked={showMarketComparisons} onChange={(e) => setShowMarketComparisons(e.target.checked)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DATA TABLE CONTAINER */}
      {!data || data.length === 0 ? (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a', padding: '48px', textAlign: 'center' }}>
          <div style={{ color: '#9ca3af', fontSize: '14px' }}>
            {isLoading ? 'Generating report...' : 'No report data available. Click "Run Report" to generate.'}
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
          {/* Table Info Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a' }}>
            <div style={{ color: '#e5e5e5', fontSize: '14px' }}>
              Displaying <span style={{ color: '#39BDF8' }}>{granularity}</span> data from <span style={{ color: '#39BDF8' }}>{startDate}</span> to <span style={{ color: '#39BDF8' }}>{endDate}</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Date</th>
                  {sortedMetrics.map(metric => (
                    <th key={metric} style={tableHeaderStyle}>{getMetricLabel(metric)}</th>
                  ))}
                  {showMarketComparisons && (
                    <th style={{ ...tableHeaderStyle, borderLeft: '1px solid #2a2a2a' }}>Delta</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr 
                    key={index} 
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#232320'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    style={{ transition: 'background-color 0.2s' }}
                  >
                    <td style={stickyCellStyle}>
                      {new Date(row.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    {sortedMetrics.map(metric => (
                      <td key={metric} style={tableCellStyle}>
                        {formatValue(metric, row[metric])}
                      </td>
                    ))}
                    {showMarketComparisons && (
                      <td style={{ ...tableCellStyle, borderLeft: '1px solid #2a2a2a', color: '#9ca3af' }}>-</td>
                    )}
                  </tr>
                ))}
                {displayTotals && (
                  <tr style={totalRowStyle}>
                    <td style={{ ...totalCellStyle, position: 'sticky', left: 0, backgroundColor: '#0f0f0f', borderRight: '1px solid #2a2a2a' }}>TOTALS</td>
                    {sortedMetrics.map(metric => (
                      <td key={metric} style={totalCellStyle}>
                        {formatValue(metric, calculateAverage(metric))}
                      </td>
                    ))}
                    {showMarketComparisons && <td style={{ ...totalCellStyle, borderLeft: '1px solid #2a2a2a' }}></td>}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}