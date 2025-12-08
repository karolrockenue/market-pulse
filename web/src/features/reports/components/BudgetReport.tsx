import { ArrowLeft, ArrowUp, ArrowDown, Minus, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useMemo, useState, useEffect, Fragment } from 'react';

interface BudgetReportProps {
  startDate: string;
  endDate: string;
  granularity: string;
  propertyId?: string;
  currencyCode?: string;
  onBack?: () => void;
}

interface MonthlyData {
  month: string;
  budget: {
    occupancy: number;
    adr: number;
    revpar: number;
    revenue: number;
    roomsSold: number;
  };
  actual: {
    occupancy: number;
    adr: number;
    revpar: number;
    revenue: number;
    roomsSold: number;
  };
}

type DeltaMetric = 'revenue' | 'occupancy' | 'adr' | 'revpar';

export function BudgetReport({ startDate, endDate, granularity, propertyId, currencyCode = 'USD', onBack }: BudgetReportProps) {
  const [selectedDeltaMetric, setSelectedDeltaMetric] = useState<DeltaMetric>('revenue');
  const [selectedYear, setSelectedYear] = useState('2025');
  const [isLoading, setIsLoading] = useState(false);
  const [budgetData, setBudgetData] = useState<MonthlyData[]>([]);

  const currencySymbol = currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$';

  // Generate available years
  const availableYears = ['2023', '2024', '2025', '2026'];

  // [NEW] Fetch real data from API
  useEffect(() => {
    const fetchData = async () => {
      if (!propertyId) return;
      
      setIsLoading(true);
      try {
        // 1. Fetch Budget Targets for the selected year
        const budgetRes = await fetch(`/api/hotels/${propertyId}/budgets/${selectedYear}`);
        const budgetJson = await budgetRes.json(); // Array of 12 objects (one per month)

        // 2. Fetch Actual Metrics for the selected year (Jan 1 to Dec 31)
        const actualRes = await fetch(
          `/api/metrics/range?propertyId=${propertyId}&startDate=${selectedYear}-01-01&endDate=${selectedYear}-12-31&granularity=monthly`
        );
        const actualJson = await actualRes.json(); // { metrics: [...] }

        // 3. Merge Data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const mergedData = months.map((monthName, index) => {
          const monthNum = index + 1;

          // Find Budget Row
// Find Budget Row
          const budgetRow = Array.isArray(budgetJson) 
            ? budgetJson.find((b: any) => b.month === monthName) 
            : null;

          // Find Actual Row (match YYYY-MM)
          const actualRow = actualJson.metrics 
            ? actualJson.metrics.find((m: any) => {
                const d = new Date(m.period);
                return d.getUTCMonth() === index && d.getUTCFullYear() === parseInt(selectedYear);
              })
            : null;

          const b_occ = parseFloat(budgetRow?.targetOccupancy || 0);
          const b_adr = parseFloat(budgetRow?.targetADR || 0);
          const b_rev = parseFloat(budgetRow?.targetRevenue || 0);
          // Calculate implied rooms sold: Revenue / ADR (if valid)
          const b_rooms = b_adr > 0 ? Math.round(b_rev / b_adr) : 0;
          const b_revpar = b_occ > 0 ? (b_rev / (b_rooms / (b_occ/100))) : 0; // Approx if capacity unknown, usually easier: (occ/100)*adr

          const a_occ = parseFloat(actualRow?.your_occupancy_direct || 0) * 100; // API returns 0.xx
          const a_adr = parseFloat(actualRow?.your_gross_adr || 0);
          const a_rev = parseFloat(actualRow?.your_gross_revenue || 0);
          const a_revpar = parseFloat(actualRow?.your_gross_revpar || 0);
          const a_rooms = parseInt(actualRow?.your_rooms_sold || 0, 10);

          return {
            month: monthName,
            budget: {
              occupancy: b_occ,
              adr: b_adr,
              revpar: (b_occ / 100) * b_adr, // Standard formula
              revenue: b_rev,
              roomsSold: b_rooms,
            },
            actual: {
              occupancy: a_occ,
              adr: a_adr,
              revpar: a_revpar,
              revenue: a_rev,
              roomsSold: a_rooms,
            },
          };
        });

        setBudgetData(mergedData);
      } catch (error) {
        console.error("Failed to load budget report data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propertyId, selectedYear]);

  // Calculate totals and averages
  const summary = useMemo(() => {
    const totalsBudget = budgetData.reduce((acc, item) => ({
      occupancy: acc.occupancy + item.budget.occupancy,
      adr: acc.adr + item.budget.adr,
      revpar: acc.revpar + item.budget.revpar,
      revenue: acc.revenue + item.budget.revenue,
      roomsSold: acc.roomsSold + item.budget.roomsSold,
    }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 });

    const totalsActual = budgetData.reduce((acc, item) => ({
      occupancy: acc.occupancy + item.actual.occupancy,
      adr: acc.adr + item.actual.adr,
      revpar: acc.revpar + item.actual.revpar,
      revenue: acc.revenue + item.actual.revenue,
      roomsSold: acc.roomsSold + item.actual.roomsSold,
    }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 });

    const count = budgetData.length;

// Calculate YTD (Year to Date)
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth(); // 0 = Jan, 10 = Nov
    const selYearInt = parseInt(selectedYear);

    let ytdMonthCount = 12;
    if (selYearInt === currentYear) {
      ytdMonthCount = currentMonthIndex; // e.g. 10 for Nov (Jan-Oct)
    } else if (selYearInt > currentYear) {
      ytdMonthCount = 0;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const ytdLabel = ytdMonthCount > 0 
      ? `YTD (Jan - ${months[Math.min(ytdMonthCount - 1, 11)]})` 
      : 'YTD';

    const ytdData = budgetData.slice(0, ytdMonthCount);
    const ytdTotalsBudget = ytdData.reduce((acc, item) => ({
      occupancy: acc.occupancy + item.budget.occupancy,
      adr: acc.adr + item.budget.adr,
      revpar: acc.revpar + item.budget.revpar,
      revenue: acc.revenue + item.budget.revenue,
      roomsSold: acc.roomsSold + item.budget.roomsSold,
    }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 });

    const ytdTotalsActual = ytdData.reduce((acc, item) => ({
      occupancy: acc.occupancy + item.actual.occupancy,
      adr: acc.adr + item.actual.adr,
      revpar: acc.revpar + item.actual.revpar,
      revenue: acc.revenue + item.actual.revenue,
      roomsSold: acc.roomsSold + item.actual.roomsSold,
    }), { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 });

    return {
      avgBudget: {
        occupancy: totalsBudget.occupancy / count,
        adr: totalsBudget.adr / count,
        revpar: totalsBudget.revpar / count,
      },
      avgActual: {
        occupancy: totalsActual.occupancy / count,
        adr: totalsActual.adr / count,
        revpar: totalsActual.revpar / count,
      },
      totalBudget: totalsBudget,
      totalActual: totalsActual,
      ytd: {
        avgBudget: {
          occupancy: ytdTotalsBudget.occupancy / ytdMonthCount,
          adr: ytdTotalsBudget.adr / ytdMonthCount,
          revpar: ytdTotalsBudget.revpar / ytdMonthCount,
        },
        avgActual: {
          occupancy: ytdTotalsActual.occupancy / ytdMonthCount,
          adr: ytdTotalsActual.adr / ytdMonthCount,
          revpar: ytdTotalsActual.revpar / ytdMonthCount,
        },
totalBudget: ytdTotalsBudget,
        totalActual: ytdTotalsActual,
        label: ytdLabel, // Pass the dynamic label out
      },
    };
  }, [budgetData, selectedYear]);

  const calculateDelta = (actual: number, budget: number) => {
    const delta = actual - budget;
    const percentChange = ((delta / budget) * 100);
    return {
      absolute: delta,
      percent: percentChange,
      isPositive: delta > 0,
      isNeutral: Math.abs(percentChange) < 0.5,
    };
  };

  const DeltaCell = ({ actual, budget, prefix = '', suffix = '', decimals = 1 }: any) => {
    const delta = calculateDelta(actual, budget);
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        {delta.isNeutral ? (
          <Minus style={{ width: '14px', height: '14px', color: '#9ca3af' }} />
        ) : delta.isPositive ? (
          <ArrowUp style={{ width: '14px', height: '14px', color: '#10b981' }} />
        ) : (
          <ArrowDown style={{ width: '14px', height: '14px', color: '#ef4444' }} />
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '14px',
            color: delta.isNeutral ? '#9ca3af' : delta.isPositive ? '#10b981' : '#ef4444'
          }}>
            {delta.isPositive ? '+' : ''}{delta.percent.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  };

const getDeltaProps = (data: MonthlyData) => {
    switch (selectedDeltaMetric) {
      case 'occupancy':
        return { actual: data.actual.occupancy, budget: data.budget.occupancy, suffix: '%' };
      case 'adr':
        return { actual: data.actual.adr, budget: data.budget.adr, prefix: currencySymbol };
      case 'revpar':
        return { actual: data.actual.revpar, budget: data.budget.revpar, prefix: currencySymbol };
      case 'revenue':
      default:
        return { actual: data.actual.revenue, budget: data.budget.revenue, prefix: currencySymbol, decimals: 0 };
    }
  };

  const getSummaryDeltaProps = () => {
    switch (selectedDeltaMetric) {
      case 'occupancy':
        return { actual: summary.avgActual.occupancy, budget: summary.avgBudget.occupancy, suffix: '%' };
      case 'adr':
        return { actual: summary.avgActual.adr, budget: summary.avgBudget.adr, prefix: currencySymbol };
      case 'revpar':
        return { actual: summary.avgActual.revpar, budget: summary.avgBudget.revpar, prefix: currencySymbol };
      case 'revenue':
      default:
        return { actual: summary.totalActual.revenue, budget: summary.totalBudget.revenue, prefix: currencySymbol, decimals: 0 };
    }
  };

  const getYTDDeltaProps = () => {
    switch (selectedDeltaMetric) {
      case 'occupancy':
        return { actual: summary.ytd.avgActual.occupancy, budget: summary.ytd.avgBudget.occupancy, suffix: '%' };
      case 'adr':
        return { actual: summary.ytd.avgActual.adr, budget: summary.ytd.avgBudget.adr, prefix: currencySymbol };
      case 'revpar':
        return { actual: summary.ytd.avgActual.revpar, budget: summary.ytd.avgBudget.revpar, prefix: currencySymbol };
      case 'revenue':
      default:
        return { actual: summary.ytd.totalActual.revenue, budget: summary.ytd.totalBudget.revenue, prefix: currencySymbol, decimals: 0 };
    }
  };

  // Helper to get highlighted column style for data cells
  const getColumnHighlight = (metric: DeltaMetric) => {
    return selectedDeltaMetric === metric
      ? { 
          backgroundColor: 'rgba(57, 189, 248, 0.05)', 
          borderLeft: '1px solid rgba(57, 189, 248, 0.2)',
          borderRight: '1px solid rgba(57, 189, 248, 0.2)'
        }
      : {};
  };

  // Helper to get highlighted header style
  const getHeaderHighlight = (metric: DeltaMetric) => {
    return selectedDeltaMetric === metric
      ? { backgroundColor: 'rgba(57, 189, 248, 0.1)', color: '#39BDF8' }
      : { color: '#9ca3af' };
  };

return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1d1d1c', position: 'relative', overflow: 'hidden' }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(250, 255, 106, 0.01))'
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)',
        backgroundSize: '64px 64px'
      }} />

<div style={{ position: 'relative', zIndex: 10, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Header */}
        <div>
          <button 
            onClick={onBack}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              color: '#9ca3af', 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: '14px', 
              marginBottom: '16px',
              padding: 0
            }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back to Report Selection
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#e5e5e5', marginBottom: '4px' }}>Performance vs Budget Report</h1>
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>Track performance against defined budget targets</p>
        </div>

        {/* Compact KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          border: '1px solid #2a2a2a' 
        }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '12px', 
            marginBottom: '6px', 
            textTransform: 'uppercase', 
            letterSpacing: '-0.025em' 
          }}>Avg Occupancy</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e5e5e5' }}>{summary.avgBudget.occupancy.toFixed(1)}%</span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>{summary.avgActual.occupancy.toFixed(1)}%</span>
            </div>
            <DeltaCell 
              actual={summary.avgActual.occupancy} 
              budget={summary.avgBudget.occupancy}
              suffix="%"
            />
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          border: '1px solid #2a2a2a' 
        }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '12px', 
            marginBottom: '6px', 
            textTransform: 'uppercase', 
            letterSpacing: '-0.025em' 
          }}>Avg ADR</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e5e5e5' }}>{currencySymbol}{summary.avgBudget.adr.toFixed(0)}</span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>{currencySymbol}{summary.avgActual.adr.toFixed(0)}</span>
            </div>
            <DeltaCell 
              actual={summary.avgActual.adr} 
              budget={summary.avgBudget.adr}
              prefix={currencySymbol}
            />
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          border: '1px solid #2a2a2a' 
        }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '12px', 
            marginBottom: '6px', 
            textTransform: 'uppercase', 
            letterSpacing: '-0.025em' 
          }}>Avg RevPAR</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e5e5e5' }}>{currencySymbol}{summary.avgBudget.revpar.toFixed(0)}</span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>{currencySymbol}{summary.avgActual.revpar.toFixed(0)}</span>
            </div>
            <DeltaCell 
              actual={summary.avgActual.revpar} 
              budget={summary.avgBudget.revpar}
              prefix={currencySymbol}
            />
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          border: '1px solid #2a2a2a' 
        }}>
          <div style={{ 
            color: '#6b7280', 
            fontSize: '12px', 
            marginBottom: '6px', 
            textTransform: 'uppercase', 
            letterSpacing: '-0.025em' 
          }}>Total Revenue</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e5e5e5' }}>{currencySymbol}{summary.totalBudget.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              <span style={{ color: '#6b7280' }}>→</span>
              <span style={{ color: '#39BDF8' }}>{currencySymbol}{summary.totalActual.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>
            <DeltaCell 
              actual={summary.totalActual.revenue} 
              budget={summary.totalBudget.revenue}
              prefix={currencySymbol}
              decimals={0}
            />
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        backgroundColor: '#1a1a1a', 
        borderRadius: '8px', 
        padding: '16px', 
        border: '1px solid #2a2a2a' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              color: '#6b7280', 
              fontSize: '14px', 
              textTransform: 'uppercase', 
              letterSpacing: '-0.025em' 
            }}>Year:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 h-9 bg-[#0a0a0a] border-[#2a2a2a] text-[#39BDF8]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-[#e5e5e5]">
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div style={{ height: '24px', width: '1px', backgroundColor: '#2a2a2a' }} />

          {/* Delta Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ 
              color: '#6b7280', 
              fontSize: '14px', 
              textTransform: 'uppercase', 
              letterSpacing: '-0.025em' 
            }}>Delta:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'revenue' as DeltaMetric, label: 'Revenue' },
                { id: 'occupancy' as DeltaMetric, label: 'Occupancy' },
                { id: 'adr' as DeltaMetric, label: 'ADR' },
                { id: 'revpar' as DeltaMetric, label: 'RevPAR' },
              ].map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setSelectedDeltaMetric(metric.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.025em',
                    transition: 'all 0.2s',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: selectedDeltaMetric === metric.id ? '#39BDF8' : '#0a0a0a',
                    color: selectedDeltaMetric === metric.id ? '#0a0a0a' : '#9ca3af',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedDeltaMetric !== metric.id) {
                      e.currentTarget.style.color = '#e5e5e5';
                      e.currentTarget.style.backgroundColor = '#0f0f0f';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedDeltaMetric !== metric.id) {
                      e.currentTarget.style.color = '#9ca3af';
                      e.currentTarget.style.backgroundColor = '#0a0a0a';
                    }
                  }}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '12px' }}>
          <Info style={{ width: '16px', height: '16px' }} />
          <span>Budget vs Actual performance comparison</span>
        </div>
      </div>

      {/* Detailed Table */}
      <div style={{ 
        backgroundColor: '#1a1a1a', 
        borderRadius: '8px', 
        border: '1px solid #2a2a2a', 
        overflow: 'hidden' 
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'left', 
                  color: '#6b7280', 
                  fontSize: '12px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '-0.025em',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#1a1a1a',
                  zIndex: 10
                }}>
                  Month
                </th>
                
                {/* Budget Headers */}
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '12px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '-0.025em',
                  borderLeft: '2px solid #2a2a2a'
                }} colSpan={4}>
                  Budget
                </th>
                
                {/* Actual Headers */}
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'center', 
                  color: '#39BDF8', 
                  fontSize: '12px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '-0.025em',
                  borderLeft: '2px solid #2a2a2a'
                }} colSpan={4}>
                  Actual
                </th>
                
                {/* Delta Header */}
                <th style={{ 
                  padding: '12px 16px', 
                  textAlign: 'center', 
                  color: '#39BDF8', 
                  fontSize: '12px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '-0.025em',
                  borderLeft: '2px solid #2a2a2a'
                }}>
                  Δ {selectedDeltaMetric === 'revenue' ? 'Rev' : selectedDeltaMetric === 'occupancy' ? 'Occ' : selectedDeltaMetric === 'adr' ? 'ADR' : 'RevPAR'}
                </th>
              </tr>
              <tr style={{ borderBottom: '1px solid #2a2a2a', backgroundColor: '#0f0f0f' }}>
                <th style={{ 
                  padding: '10px 16px',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#0f0f0f',
                  zIndex: 10
                }}></th>
                
                {/* Budget Sub-headers */}
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  borderLeft: '2px solid #2a2a2a',
                  ...getHeaderHighlight('occupancy')
                }}>Occ</th>
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  ...getHeaderHighlight('adr')
                }}>ADR</th>
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  ...getHeaderHighlight('revpar')
                }}>RevPAR</th>
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  ...getHeaderHighlight('revenue')
                }}>Revenue</th>
                
                {/* Actual Sub-headers */}
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  borderLeft: '2px solid #2a2a2a',
                  ...getHeaderHighlight('occupancy')
                }}>Occ</th>
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  ...getHeaderHighlight('adr')
                }}>ADR</th>
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  ...getHeaderHighlight('revpar')
                }}>RevPAR</th>
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  fontSize: '12px',
                  ...getHeaderHighlight('revenue')
                }}>Revenue</th>
                
                {/* Delta Sub-header */}
                <th style={{ 
                  padding: '10px 12px', 
                  textAlign: 'center', 
                  color: '#9ca3af', 
                  fontSize: '12px',
                  borderLeft: '2px solid #2a2a2a'
                }}>Change</th>
              </tr>
            </thead>
<tbody>
              {budgetData.map((data, idx) => (
                <Fragment key={data.month}>
                  <tr 
                    style={{ 
                      borderBottom: '1px solid #2a2a2a',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(15, 15, 15, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Month */}
                    <td style={{ 
                      padding: '12px 16px', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: '#1a1a1a'
                    }}>
                      {data.month}
                    </td>
                    
                    {/* Budget Metrics */}
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      borderLeft: '2px solid #2a2a2a',
                      ...getColumnHighlight('occupancy')
                    }}>
                      {data.budget.occupancy.toFixed(1)}%
                    </td>
                  <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      ...getColumnHighlight('adr')
                    }}>
                      {currencySymbol}{data.budget.adr.toFixed(0)}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      ...getColumnHighlight('revpar')
                    }}>
                      {currencySymbol}{data.budget.revpar.toFixed(0)}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      ...getColumnHighlight('revenue')
                    }}>
                      {currencySymbol}{data.budget.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    
                    {/* Actual Metrics */}
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      borderLeft: '2px solid #2a2a2a',
                      ...getColumnHighlight('occupancy')
                    }}>
                      {data.actual.occupancy.toFixed(1)}%
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      ...getColumnHighlight('adr')
                    }}>
                      {currencySymbol}{data.actual.adr.toFixed(0)}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      ...getColumnHighlight('revpar')
                    }}>
                      {currencySymbol}{data.actual.revpar.toFixed(0)}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      color: '#e5e5e5', 
                      fontSize: '14px',
                      ...getColumnHighlight('revenue')
                    }}>
                      {currencySymbol}{data.actual.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </td>
                    
                    {/* Delta */}
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'center',
                      borderLeft: '2px solid #2a2a2a'
                    }}>
                      <DeltaCell {...getDeltaProps(data)} />
                    </td>
                  </tr>
                  

  {/* [REMOVED] YTD Row was here */}
                </Fragment>
              ))}
              
         {/* YTD Row - Moved outside loop */}
              <tr style={{ backgroundColor: '#0f0f0f', borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ 
                  padding: '12px 16px', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#0f0f0f',
                  zIndex: 10,
                  position: 'relative'
                }}>
                  {/* Left accent bar */}
                  <div style={{ 
                    position: 'absolute', 
                    left: 0, 
                    top: 0, 
                    bottom: 0, 
                    width: '4px', 
                    backgroundColor: '#39BDF8' 
                  }} />
                  <div style={{ paddingLeft: '12px' }}>
                    {/* [MODIFIED] Use dynamic label */}
                    <strong>{(summary.ytd as any).label || 'YTD'}</strong>
                  </div>
                </td>
                
                {/* Budget YTD Averages/Totals */}
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  borderLeft: '2px solid #2a2a2a',
                  ...getColumnHighlight('occupancy')
                }}>
                  <strong>{summary.ytd.avgBudget.occupancy.toFixed(1)}%</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('adr')
                }}>
                  <strong>{currencySymbol}{summary.ytd.avgBudget.adr.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revpar')
                }}>
                  <strong>{currencySymbol}{summary.ytd.avgBudget.revpar.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revenue')
                }}>
                  <strong>{currencySymbol}{summary.ytd.totalBudget.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                </td>
                
                {/* Actual YTD Averages/Totals */}
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  borderLeft: '2px solid #2a2a2a',
                  ...getColumnHighlight('occupancy')
                }}>
                  <strong>{summary.ytd.avgActual.occupancy.toFixed(1)}%</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('adr')
                }}>
                  <strong>{currencySymbol}{summary.ytd.avgActual.adr.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revpar')
                }}>
                  <strong>{currencySymbol}{summary.ytd.avgActual.revpar.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revenue')
                }}>
                  <strong>{currencySymbol}{summary.ytd.totalActual.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                </td>
                
                {/* Delta YTD */}
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center',
                  borderLeft: '2px solid #2a2a2a'
                }}>
                  <DeltaCell {...getYTDDeltaProps()} />
                </td>
              </tr>

              {/* Totals/Averages Row */}
              <tr style={{ 
                borderTop: '2px solid rgba(57, 189, 248, 0.3)', 
                backgroundColor: '#0f0f0f' 
              }}>
                <td style={{ 
                  padding: '12px 16px', 
                  color: '#39BDF8', 
                  fontSize: '14px',
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#0f0f0f',
                  zIndex: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '-0.025em'
                }}>
                  <strong>AVG / TOTAL</strong>
                </td>
                
                {/* Budget Averages/Totals */}
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  borderLeft: '2px solid #2a2a2a',
                  ...getColumnHighlight('occupancy')
                }}>
                  <strong>{summary.avgBudget.occupancy.toFixed(1)}%</strong>
                </td>
 <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('adr')
                }}>
                  <strong>{currencySymbol}{summary.avgBudget.adr.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revpar')
                }}>
                  <strong>{currencySymbol}{summary.avgBudget.revpar.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revenue')
                }}>
                  <strong>{currencySymbol}{summary.totalBudget.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                </td>
                
                {/* Actual Averages/Totals */}
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  borderLeft: '2px solid #2a2a2a',
                  ...getColumnHighlight('occupancy')
                }}>
                  <strong>{summary.avgActual.occupancy.toFixed(1)}%</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('adr')
                }}>
                  <strong>{currencySymbol}{summary.avgActual.adr.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revpar')
                }}>
                  <strong>{currencySymbol}{summary.avgActual.revpar.toFixed(0)}</strong>
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center', 
                  color: '#e5e5e5', 
                  fontSize: '14px',
                  ...getColumnHighlight('revenue')
                }}>
                  <strong>{currencySymbol}{summary.totalActual.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                </td>
                
                {/* Delta Total/Average */}
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'center',
                  borderLeft: '2px solid #2a2a2a'
                }}>
                  <DeltaCell {...getSummaryDeltaProps()} />
                </td>
              </tr>
            </tbody>
</table>
        </div>
      </div>
      </div>
    </div>
  );
}