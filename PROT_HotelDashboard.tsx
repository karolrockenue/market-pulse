import { useState, useMemo, CSSProperties } from 'react';
import { MarketOutlookBanner } from './MarketOutlookBanner';
import { MarketRankingCard } from './MarketRankingCard';
import { DynamicYTDTrend } from './DynamicYTDTrend';
import { OwnHotelOccupancy } from './OwnHotelOccupancy';
import { RecentBookings } from './RecentBookings';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Area, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Calendar, Target, BarChart3, Award, AlertCircle, ExternalLink, ArrowRight, Radio, Trophy } from 'lucide-react';

interface HotelDashboardProps {
  onNavigate: (view: string) => void;
  budgetExists: boolean;
}

export function HotelDashboard({ onNavigate, budgetExists }: HotelDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<'revpar' | 'occupancy' | 'adr'>('revpar');

  // Generate mock data for performance snapshot
  const performanceData = {
    lastMonth: {
      label: 'Last Month',
      sublabel: 'October (Final)',
      revpar: 152.50,
      revenue: 142000,
      occupancy: 78.5,
      change: 8.3,
      trend: 'up' as const,
      yoyRevenue: 131000,
      budget: {
        exists: true,
        target: 138000,
        actual: 142000,
        variance: 4000,
        onTarget: true
      }
    },
    currentMonth: {
      label: 'Current Month',
      sublabel: 'November (MTD)',
      revpar: 128.40,
      revenue: 89500,
      occupancy: 72.3,
      change: -4.2,
      trend: 'down' as const,
      yoyRevenue: 93400,
      budget: {
        exists: true,
        target: 135000,
        actual: 89500,
        variance: -45500,
        onTarget: false
      }
    },
    nextMonth: {
      label: 'Next Month',
      sublabel: 'December (OTB)',
      revpar: 176.80,
      revenue: 95000,
      occupancy: 65.8,
      change: 12.1,
      trend: 'up' as const,
      yoyRevenue: 84800,
      budget: {
        exists: false,
        target: 0,
        actual: 0,
        variance: 0,
        onTarget: false
      }
    }
  };

  const budgetPacing = {
    status: 'at-risk' as const,
    currentRevenue: 89500,
    targetRevenue: 135000,
    pacePercent: 66.3,
    daysRemaining: 12
  };

  const rankings = [
    { metric: 'Occupancy', rank: 3, total: 12 },
    { metric: 'ADR', rank: 5, total: 12 },
    { metric: 'RevPAR', rank: 4, total: 12 },
  ];

  const trendData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let day = 0; day < 90; day++) {
      const currentDate = new Date(today);
      currentDate.setDate(currentDate.getDate() + day);
      
      const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'short' });
      const dayLabel = currentDate.getDate();
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      
      let baseDemand = 55 + Math.sin(day / 15) * 20 + Math.random() * 8;
      if (isWeekend) baseDemand += 15;
      
      let baseSupply = 450 + Math.cos(day / 20) * 50 + Math.random() * 25;
      if (isWeekend) baseSupply -= 20;
      
      const showLabel = day % 7 === 0 || day === 0;
      
      const currentSupply = Math.round(Math.max(300, Math.min(600, baseSupply)));
      
      data.push({
        date: showLabel ? `${monthLabel} ${dayLabel}` : '',
        fullDate: `${monthLabel} ${dayLabel}`,
        dayIndex: day,
        marketDemand: Math.round(Math.max(20, Math.min(100, baseDemand))),
        marketSupply: currentSupply,
      });
    }
    
    return data;
  }, []);

  const paceHighlights = {
    paceVs7Days: {
      value: 3.2,
      trend: 'up' as const,
      label: 'Pace vs. 7 Days Ago'
    },
    priceVs7Days: {
      value: -1.8,
      trend: 'down' as const,
      label: 'Market Price vs. 7 Days Ago'
    }
  };

  const busiestDays = [
    { date: '2024-12-31', dayOfWeek: 'Tue', availability: 2.3, supply: 2112 },
    { date: '2024-12-24', dayOfWeek: 'Tue', availability: 3.1, supply: 2247 },
    { date: '2024-07-20', dayOfWeek: 'Sat', availability: 4.2, supply: 2456 },
    { date: '2024-08-15', dayOfWeek: 'Thu', availability: 4.8, supply: 2589 },
    { date: '2024-12-25', dayOfWeek: 'Wed', availability: 5.1, supply: 2634 },
  ];

  const quietestDays = [
    { date: '2024-01-15', dayOfWeek: 'Mon', availability: 87.2, supply: 4521 },
    { date: '2024-02-06', dayOfWeek: 'Tue', availability: 84.5, supply: 4389 },
    { date: '2024-01-22', dayOfWeek: 'Mon', availability: 82.8, supply: 4298 },
    { date: '2024-11-12', dayOfWeek: 'Tue', availability: 79.3, supply: 4112 },
    { date: '2024-02-13', dayOfWeek: 'Tue', availability: 78.1, supply: 4056 },
  ];

  const compSetData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, index) => {
      const seasonalFactor = Math.sin((index / 12) * Math.PI * 2) * 15 + 70;
      
      return {
        month,
        yourRevpar: seasonalFactor + Math.random() * 10 + 40,
        compSetRevpar: seasonalFactor + Math.random() * 8 + 35,
        yourOccupancy: seasonalFactor + Math.random() * 5,
        compSetOccupancy: seasonalFactor + Math.random() * 4 - 2,
        yourAdr: 120 + seasonalFactor * 0.8 + Math.random() * 15,
        compSetAdr: 115 + seasonalFactor * 0.8 + Math.random() * 12,
      };
    });
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return `£${(value / 1000).toFixed(0)}K`;
  };

  const getStatusConfig = (status: typeof budgetPacing.status) => {
    const configs = {
      'on-pace': {
        label: 'On Pace',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        icon: TrendingUp
      },
      'at-risk': {
        label: 'At Risk',
        color: '#faff6a',
        bgColor: 'rgba(250, 255, 106, 0.1)',
        borderColor: 'rgba(250, 255, 106, 0.3)',
        icon: AlertCircle
      },
      'needs-attention': {
        label: 'Needs Attention',
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        icon: TrendingDown
      }
    };
    return configs[status];
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#2C2C2C',
          border: '1px solid #3a3a35',
          borderRadius: '4px',
          padding: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ color: '#e5e5e5', fontSize: '12px', marginBottom: '4px' }}>{data.date}</div>
          <div style={{ color: '#9ca3af', fontSize: '12px' }}>
            Demand: <span style={{ color: '#faff6a' }}>{data.demand ? data.demand.toFixed(0) : '0'}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Inline styles
  const styles: Record<string, CSSProperties> = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#1d1d1c',
      position: 'relative',
      overflow: 'hidden'
    },
    backgroundGradient: {
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(to bottom right, rgba(57, 189, 248, 0.01), transparent, rgba(57, 189, 248, 0.01))'
    },
    gridOverlay: {
      position: 'absolute',
      inset: '0',
      backgroundImage: 'linear-gradient(rgba(57, 189, 248, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57, 189, 248, 0.03) 1px, transparent 1px)',
      backgroundSize: '64px 64px'
    },
    contentWrapper: {
      position: 'relative',
      zIndex: 10,
      padding: '24px'
    },
    performanceGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '16px',
      marginBottom: '24px'
    },
    card: {
      backgroundColor: 'rgb(26, 26, 26)',
      borderRadius: '8px',
      border: '1px solid #2a2a2a',
      padding: '16px'
    },
    periodHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '20px'
    },
    periodLabel: {
      color: '#e5e5e5',
      fontSize: '18px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em',
      marginBottom: '4px'
    },
    periodSublabel: {
      color: '#6b7280',
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em'
    },
    trendBadge: {
      padding: '4px 8px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    revenueSection: {
      marginBottom: '20px'
    },
    revenueRow: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '12px'
    },
    revenueValue: {
      color: '#39BDF8',
      fontSize: '32px'
    },
    occupancyLabel: {
      color: '#6b7280',
      fontSize: '12px',
      marginBottom: '6px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em'
    },
    label: {
      color: '#6b7280',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em'
    },
    comparisonRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px'
    },
    comparisonValue: {
      color: '#9ca3af',
      fontSize: '14px'
    },
    separator: {
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: '1px solid #2a2a2a'
    },
    budgetProgress: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    budgetRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '12px'
    },
    progressBar: {
      height: '6px',
      backgroundColor: '#1a1a1a',
      borderRadius: '9999px',
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      borderRadius: '9999px',
      backgroundColor: '#39BDF8',
      transition: 'all 0.3s'
    },
    marketOutlookContainer: {
      marginBottom: '32px',
      borderRadius: '8px',
      border: '1px solid #2a2a2a',
      transition: 'all 0.3s'
    },
    chartButton: {
      width: '100%',
      backgroundColor: '#1a1a1a',
      borderRadius: '0 0 8px 8px',
      border: '0',
      padding: '24px',
      textAlign: 'left',
      transition: 'all 0.3s',
      cursor: 'pointer'
    },
    chartHeader: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: '16px'
    },
    chartDescription: {
      color: '#6b7280',
      fontSize: '12px'
    },
    viewLink: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.3s'
    },
    chartContainer: {
      height: '240px'
    },
    demandPatternsSection: {
      marginTop: '24px',
      paddingTop: '24px',
      borderTop: '1px solid #2a2a2a'
    },
    demandPatternsHeader: {
      marginBottom: '20px'
    },
    demandPatternsTitle: {
      color: '#e5e5e5',
      fontSize: '18px',
      marginBottom: '4px'
    },
    demandPatternsDescription: {
      color: '#9ca3af',
      fontSize: '12px'
    },
    demandPatternsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '24px'
    },
    patternCard: {
      backgroundColor: '#1A1A1A',
      borderRadius: '8px',
      padding: '16px'
    },
    patternHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '16px'
    },
    iconBadge: {
      width: '32px',
      height: '32px',
      borderRadius: '9999px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    patternTitle: {
      color: '#e5e5e5',
      fontSize: '14px'
    },
    patternSubtitle: {
      color: '#9ca3af',
      fontSize: '12px'
    },
    table: {
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #2a2a2a'
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '8px',
      padding: '8px 12px',
      borderBottom: '1px solid #2a2a2a',
      backgroundColor: '#1D1D1C'
    },
    tableHeaderCell: {
      color: '#6b7280',
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em'
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '8px',
      padding: '10px 12px',
      backgroundColor: '#1D1D1C',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      fontSize: '12px'
    },
    badge: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '10px'
    },
    summary: {
      marginTop: '12px',
      borderRadius: '4px',
      padding: '12px'
    },
    summaryTitle: {
      fontSize: '12px',
      marginBottom: '4px'
    },
    summaryText: {
      color: '#e5e5e5',
      fontSize: '12px'
    },
    ytdSection: {
      marginTop: '24px'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.backgroundGradient}></div>
      <div style={styles.gridOverlay}></div>

      <div style={styles.contentWrapper}>
        {/* Performance Snapshot Row */}
        <div style={styles.performanceGrid}>
          {/* Last Month Card */}
          <div style={styles.card}>
            <div style={styles.periodHeader}>
              <div>
                <div style={styles.periodLabel}>{performanceData.lastMonth.label}</div>
                <div style={styles.periodSublabel}>{performanceData.lastMonth.sublabel}</div>
              </div>
              <div style={{
                ...styles.trendBadge,
                backgroundColor: performanceData.lastMonth.trend === 'up' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${performanceData.lastMonth.trend === 'up' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {performanceData.lastMonth.trend === 'up' ? (
                  <TrendingUp style={{ width: '12px', height: '12px', color: '#10b981' }} />
                ) : (
                  <TrendingDown style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                )}
                <span style={{ 
                  color: performanceData.lastMonth.trend === 'up' ? '#10b981' : '#ef4444',
                  fontSize: '12px'
                }}>
                  YOY {performanceData.lastMonth.change > 0 ? '+' : ''}{performanceData.lastMonth.change.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div style={styles.revenueSection}>
              <div style={styles.revenueRow}>
                <div style={styles.revenueValue}>£{performanceData.lastMonth.revenue.toLocaleString()}</div>
                <div style={styles.occupancyLabel}>
                  {performanceData.lastMonth.occupancy.toFixed(1)}% Occ
                </div>
              </div>
              <div style={styles.label}>Total Revenue</div>
            </div>

            <div style={styles.comparisonRow}>
              <div>
                <div style={{ ...styles.label, marginBottom: '4px' }}>Last Year</div>
                <div style={styles.comparisonValue}>£{performanceData.lastMonth.yoyRevenue.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...styles.label, marginBottom: '4px' }}>Variance</div>
                <div style={{ 
                  fontSize: '14px',
                  fontWeight: 500,
                  color: performanceData.lastMonth.revenue - performanceData.lastMonth.yoyRevenue >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {performanceData.lastMonth.revenue - performanceData.lastMonth.yoyRevenue >= 0 ? '+' : ''}£{Math.abs(performanceData.lastMonth.revenue - performanceData.lastMonth.yoyRevenue).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={styles.separator}>
              <div style={{ ...styles.label, marginBottom: '8px' }}>Budget</div>
              {performanceData.lastMonth.budget.exists ? (
                <div style={styles.budgetProgress}>
                  <div style={styles.budgetRow}>
                    <span style={{ color: '#6b7280' }}>Target</span>
                    <span style={{ color: '#9ca3af' }}>£{performanceData.lastMonth.budget.target.toLocaleString()}</span>
                  </div>
                  <div style={styles.progressBar}>
                    <div 
                      style={{ 
                        ...styles.progressFill,
                        width: `${Math.min(100, (performanceData.lastMonth.budget.actual / performanceData.lastMonth.budget.target) * 100)}%`
                      }}
                    />
                  </div>
                  <div style={styles.budgetRow}>
                    <span style={{ color: performanceData.lastMonth.budget.onTarget ? '#10b981' : '#ef4444' }}>
                      {performanceData.lastMonth.budget.onTarget ? 'On Target' : 'Off Target'}
                    </span>
                    <span style={{ color: performanceData.lastMonth.budget.variance >= 0 ? '#10b981' : '#ef4444' }}>
                      {performanceData.lastMonth.budget.variance >= 0 ? '+' : ''}£{Math.abs(performanceData.lastMonth.budget.variance).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => onNavigate('budgeting')}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: '8px 0',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>Not configured</div>
                  <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px', opacity: 0.4 }}>Click to configure →</div>
                </button>
              )}
            </div>
          </div>

          {/* Current Month MTD Card */}
          <div style={styles.card}>
            <div style={styles.periodHeader}>
              <div>
                <div style={styles.periodLabel}>{performanceData.currentMonth.label}</div>
                <div style={styles.periodSublabel}>{performanceData.currentMonth.sublabel}</div>
              </div>
              <div style={{
                ...styles.trendBadge,
                backgroundColor: performanceData.currentMonth.trend === 'up' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${performanceData.currentMonth.trend === 'up' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {performanceData.currentMonth.trend === 'up' ? (
                  <TrendingUp style={{ width: '12px', height: '12px', color: '#10b981' }} />
                ) : (
                  <TrendingDown style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                )}
                <span style={{ 
                  color: performanceData.currentMonth.trend === 'up' ? '#10b981' : '#ef4444',
                  fontSize: '12px'
                }}>
                  YOY {performanceData.currentMonth.change > 0 ? '+' : ''}{performanceData.currentMonth.change.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div style={styles.revenueSection}>
              <div style={styles.revenueRow}>
                <div style={styles.revenueValue}>£{performanceData.currentMonth.revenue.toLocaleString()}</div>
                <div style={styles.occupancyLabel}>
                  {performanceData.currentMonth.occupancy.toFixed(1)}% Occ
                </div>
              </div>
              <div style={styles.label}>Total Revenue</div>
            </div>

            <div style={styles.comparisonRow}>
              <div>
                <div style={{ ...styles.label, marginBottom: '4px' }}>Last Year</div>
                <div style={styles.comparisonValue}>£{performanceData.currentMonth.yoyRevenue.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...styles.label, marginBottom: '4px' }}>Variance</div>
                <div style={{ 
                  fontSize: '14px',
                  fontWeight: 500,
                  color: performanceData.currentMonth.revenue - performanceData.currentMonth.yoyRevenue >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {performanceData.currentMonth.revenue - performanceData.currentMonth.yoyRevenue >= 0 ? '+' : ''}£{Math.abs(performanceData.currentMonth.revenue - performanceData.currentMonth.yoyRevenue).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={styles.separator}>
              <div style={{ ...styles.label, marginBottom: '8px' }}>Budget</div>
              {performanceData.currentMonth.budget.exists ? (
                <div style={styles.budgetProgress}>
                  <div style={styles.budgetRow}>
                    <span style={{ color: '#6b7280' }}>Target</span>
                    <span style={{ color: '#9ca3af' }}>£{performanceData.currentMonth.budget.target.toLocaleString()}</span>
                  </div>
                  <div style={{ ...styles.progressBar, backgroundColor: '#0f0f0f' }}>
                    <div 
                      style={{ 
                        ...styles.progressFill,
                        backgroundColor: '#6b7280',
                        width: `${Math.min(100, (performanceData.currentMonth.budget.actual / performanceData.currentMonth.budget.target) * 100)}%`
                      }}
                    />
                  </div>
                  <div style={styles.budgetRow}>
                    <span style={{ color: performanceData.currentMonth.budget.onTarget ? '#10b981' : '#ef4444' }}>
                      {performanceData.currentMonth.budget.onTarget ? 'On Target' : 'Off Target'}
                    </span>
                    <span style={{ color: performanceData.currentMonth.budget.variance >= 0 ? '#10b981' : '#ef4444' }}>
                      {performanceData.currentMonth.budget.variance >= 0 ? '+' : ''}£{Math.abs(performanceData.currentMonth.budget.variance).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => onNavigate('budgeting')}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: '8px 0',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f0f0f'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>Not configured</div>
                  <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px', opacity: 0.4 }}>Click to configure →</div>
                </button>
              )}
            </div>
          </div>

          {/* Next Month OTB Card */}
          <div style={styles.card}>
            <div style={styles.periodHeader}>
              <div>
                <div style={styles.periodLabel}>{performanceData.nextMonth.label}</div>
                <div style={styles.periodSublabel}>{performanceData.nextMonth.sublabel}</div>
              </div>
              <div style={{
                ...styles.trendBadge,
                backgroundColor: performanceData.nextMonth.trend === 'up' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${performanceData.nextMonth.trend === 'up' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {performanceData.nextMonth.trend === 'up' ? (
                  <TrendingUp style={{ width: '12px', height: '12px', color: '#10b981' }} />
                ) : (
                  <TrendingDown style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                )}
                <span style={{ 
                  color: performanceData.nextMonth.trend === 'up' ? '#10b981' : '#ef4444',
                  fontSize: '12px'
                }}>
                  YOY {performanceData.nextMonth.change > 0 ? '+' : ''}{performanceData.nextMonth.change.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div style={styles.revenueSection}>
              <div style={styles.revenueRow}>
                <div style={styles.revenueValue}>£{performanceData.nextMonth.revenue.toLocaleString()}</div>
                <div style={styles.occupancyLabel}>
                  {performanceData.nextMonth.occupancy.toFixed(1)}% Occ
                </div>
              </div>
              <div style={styles.label}>Total Revenue</div>
            </div>

            <div style={styles.comparisonRow}>
              <div>
                <div style={{ ...styles.label, marginBottom: '4px' }}>Last Year</div>
                <div style={styles.comparisonValue}>£{performanceData.nextMonth.yoyRevenue.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...styles.label, marginBottom: '4px' }}>Variance</div>
                <div style={{ 
                  fontSize: '14px',
                  fontWeight: 500,
                  color: performanceData.nextMonth.revenue - performanceData.nextMonth.yoyRevenue >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {performanceData.nextMonth.revenue - performanceData.nextMonth.yoyRevenue >= 0 ? '+' : ''}£{Math.abs(performanceData.nextMonth.revenue - performanceData.nextMonth.yoyRevenue).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={styles.separator}>
              <div style={{ ...styles.label, marginBottom: '8px' }}>Budget</div>
              {performanceData.nextMonth.budget.exists ? (
                <div style={styles.budgetProgress}>
                  <div style={styles.budgetRow}>
                    <span style={{ color: '#6b7280' }}>Target</span>
                    <span style={{ color: '#9ca3af' }}>£{performanceData.nextMonth.budget.target.toLocaleString()}</span>
                  </div>
                  <div style={{ ...styles.progressBar, backgroundColor: '#0f0f0f' }}>
                    <div 
                      style={{ 
                        ...styles.progressFill,
                        width: `${Math.min(100, (performanceData.nextMonth.budget.actual / performanceData.nextMonth.budget.target) * 100)}%`
                      }}
                    />
                  </div>
                  <div style={styles.budgetRow}>
                    <span style={{ color: performanceData.nextMonth.budget.onTarget ? '#10b981' : '#ef4444' }}>
                      {performanceData.nextMonth.budget.onTarget ? 'On Target' : 'Off Target'}
                    </span>
                    <span style={{ color: performanceData.nextMonth.budget.variance >= 0 ? '#10b981' : '#ef4444' }}>
                      {performanceData.nextMonth.budget.variance >= 0 ? '+' : ''}£{Math.abs(performanceData.nextMonth.budget.variance).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => onNavigate('budgeting')}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: '10px 12px',
                    backgroundColor: 'transparent',
                    border: '1px dashed #2a2a2a',
                    borderRadius: '4px',
                    transition: 'all 0.3s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0f0f0f';
                    e.currentTarget.style.borderColor = '#6b7280';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = '#2a2a2a';
                  }}
                >
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>Not configured</div>
                  <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px', opacity: 0.4 }}>Click to configure →</div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Own Hotel Occupancy & Pickup */}
        <div style={{ display: 'flex', gap: '20px', width: '100%', marginBottom: '24px' }}>
          <div style={{ flex: '0 0 calc(66.67% + 8px)' }}>
            <OwnHotelOccupancy />
          </div>
          <div style={{ flex: '0 0 calc(33.33% - 28px)' }}>
            <RecentBookings />
          </div>
        </div>

        {/* Market Outlook Banner + Chart */}
        <div style={styles.marketOutlookContainer}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(250, 255, 106, 0.5)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(250, 255, 106, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#2a2a2a';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <MarketOutlookBanner status="softening" />

          <button
            onClick={() => onNavigate('market')}
            style={styles.chartButton}
          >
            <div style={styles.chartHeader}>
              <p style={styles.chartDescription}>Forward-looking 90-day outlook</p>
              <div style={styles.viewLink}>
                <span style={{ color: '#faff6a', fontSize: '12px', opacity: 0 }}>View</span>
                <ExternalLink style={{ width: '16px', height: '16px', color: '#6b7280' }} />
              </div>
            </div>

            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trendData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <CartesianGrid 
                    strokeDasharray="0" 
                    stroke="#2a2a25" 
                    opacity={0.5} 
                    vertical={true}
                    horizontal={true}
                  />
                  <XAxis 
                    dataKey="date" 
                    stroke="#3a3a35"
                    tick={{ fill: '#6b7280', fontSize: 9 }}
                    tickLine={{ stroke: '#3a3a35' }}
                    axisLine={{ stroke: '#3a3a35' }}
                    interval={13}
                  />
                  <YAxis 
                    yAxisId="left"
                    stroke="#3a3a35"
                    tick={{ fill: '#6b7280', fontSize: 9 }}
                    tickLine={{ stroke: '#3a3a35' }}
                    axisLine={{ stroke: '#3a3a35' }}
                    width={35}
                    domain={[0, 100]}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#3a3a35"
                    tick={{ fill: '#6b7280', fontSize: 9 }}
                    tickLine={{ stroke: '#3a3a35' }}
                    axisLine={{ stroke: '#3a3a35' }}
                    width={35}
                    domain={[0, 'auto']}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(250, 255, 106, 0.1)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(26, 26, 24, 0.95)',
                      border: '1px solid #3a3a35',
                      borderRadius: '4px',
                      padding: '6px',
                      fontSize: '10px'
                    }}
                    labelStyle={{ color: '#9ca3af', fontSize: '9px' }}
                    itemStyle={{ fontSize: '10px', color: '#e5e5e5' }}
                  />
                  
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="marketSupply" 
                    stroke="#3b82f6" 
                    strokeWidth={1.5}
                    strokeOpacity={0.3}
                    fill="#3b82f6"
                    fillOpacity={0.08}
                    name="Market Supply (Rooms)"
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="marketDemand" 
                    name="Market Demand (%)"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={16}
                    fillOpacity={0.85}
                  >
                    {trendData.map((entry, index) => {
                      let fill = '#3b82f6';
                      if (entry.marketDemand >= 85) fill = '#ef4444';
                      else if (entry.marketDemand >= 70) fill = '#f97316';
                      
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Market Demand Patterns */}
            <div style={styles.demandPatternsSection}>
              <div style={styles.demandPatternsHeader}>
                <h2 style={styles.demandPatternsTitle}>Market Demand Patterns</h2>
                <p style={styles.demandPatternsDescription}>
                  365-day historical analysis identifying recurring high-demand periods
                </p>
              </div>

              <div style={styles.demandPatternsGrid}>
                {/* Busiest Days */}
                <div style={styles.patternCard}>
                  <div style={styles.patternHeader}>
                    <div style={{ ...styles.iconBadge, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                      <TrendingUp style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                    </div>
                    <div>
                      <div style={styles.patternTitle}>Top 5 Busiest Days</div>
                      <div style={styles.patternSubtitle}>Lowest historical availability</div>
                    </div>
                  </div>

                  <div style={styles.table}>
                    <div style={styles.tableHeader}>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 1' }}>#</div>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 5' }}>Date</div>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 3', textAlign: 'right' }}>Supply</div>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 3', textAlign: 'right' }}>Demand</div>
                    </div>

                    <div style={{ borderTop: '1px solid #2a2a2a' }}>
                      {busiestDays.map((day, index) => (
                        <div 
                          key={day.date} 
                          style={styles.tableRow}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#141414'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1D1D1C'}
                        >
                          <div style={{ ...styles.tableCell, gridColumn: 'span 1', color: '#6b7280' }}>{index + 1}</div>
                          <div style={{ gridColumn: 'span 5' }}>
                            <div style={{ ...styles.tableCell, color: '#e5e5e5' }}>{formatDate(day.date)}</div>
                            <div style={{ color: '#6b7280', fontSize: '10px' }}>{day.dayOfWeek}</div>
                          </div>
                          <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                            <div style={{ color: '#9ca3af', fontSize: '10px' }}>{day.supply?.toLocaleString()}</div>
                          </div>
                          <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                            <div style={{ 
                              ...styles.badge,
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              color: '#ef4444'
                            }}>
                              {day.availability.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ 
                    ...styles.summary,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}>
                    <div style={{ ...styles.summaryTitle, color: '#ef4444' }}>High Demand Pattern</div>
                    <div style={styles.summaryText}>
                      Peak saturation occurs during major holidays and summer weekends. 
                      Market reaches near-sellout conditions {'(<5% availability)'} on top dates.
                    </div>
                  </div>
                </div>

                {/* Quietest Days */}
                <div style={styles.patternCard}>
                  <div style={styles.patternHeader}>
                    <div style={{ ...styles.iconBadge, backgroundColor: 'rgba(16, 185, 129, 0.2)' }}>
                      <TrendingDown style={{ width: '16px', height: '16px', color: '#10b981' }} />
                    </div>
                    <div>
                      <div style={styles.patternTitle}>Top 5 Quietest Days</div>
                      <div style={styles.patternSubtitle}>Highest historical availability</div>
                    </div>
                  </div>

                  <div style={styles.table}>
                    <div style={styles.tableHeader}>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 1' }}>#</div>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 5' }}>Date</div>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 3', textAlign: 'right' }}>Supply</div>
                      <div style={{ ...styles.tableHeaderCell, gridColumn: 'span 3', textAlign: 'right' }}>Demand</div>
                    </div>

                    <div style={{ borderTop: '1px solid #2a2a2a' }}>
                      {quietestDays.map((day, index) => (
                        <div 
                          key={day.date} 
                          style={styles.tableRow}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#141414'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1D1D1C'}
                        >
                          <div style={{ ...styles.tableCell, gridColumn: 'span 1', color: '#6b7280' }}>{index + 1}</div>
                          <div style={{ gridColumn: 'span 5' }}>
                            <div style={{ ...styles.tableCell, color: '#e5e5e5' }}>{formatDate(day.date)}</div>
                            <div style={{ color: '#6b7280', fontSize: '10px' }}>{day.dayOfWeek}</div>
                          </div>
                          <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                            <div style={{ color: '#9ca3af', fontSize: '10px' }}>{day.supply?.toLocaleString()}</div>
                          </div>
                          <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                            <div style={{ 
                              ...styles.badge,
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              color: '#10b981'
                            }}>
                              {day.availability.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ 
                    ...styles.summary,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <div style={{ ...styles.summaryTitle, color: '#10b981' }}>Low Demand Pattern</div>
                    <div style={styles.summaryText}>
                      Lowest demand occurs in January-February and mid-November. 
                      Market shows excess capacity {'(>75% availability)'} during these periods.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* YTD Performance */}
        <div style={styles.ytdSection}>
          <DynamicYTDTrend mode="multi-metric" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}