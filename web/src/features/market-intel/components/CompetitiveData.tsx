import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, Target, Zap, Loader2, ChevronDown } from 'lucide-react';
import { format, addDays, addMonths } from 'date-fns';
import { DatePickerCalendar } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Property {
  property_id: number;
  property_name: string;
}

interface PortfolioRow {
  hotelId: string;
  hotelName: string;
  category: string;
  myOcc: number | null;
  segOcc: number | null;
  myAdr: number | null;
  segAdr: number | null;
  myRevpar: number | null;
  segRevpar: number | null;
  occRank: number | null;
  occTotal: number | null;
}

interface CompetitiveDataProps {
  propertyId: string;
  currencySymbol: string;
  hotelCategory: string | null;
  properties: Property[];
  onPropertyChange: (id: string) => void;
  onNavigate: (view: string) => void;
  budgetExists: boolean;
}

export function CompetitiveData({ propertyId, currencySymbol, hotelCategory, properties, onPropertyChange, onNavigate, budgetExists }: CompetitiveDataProps) {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));
  const [datePreset, setDatePreset] = useState('30-days');
  const [comparison, setComparison] = useState('my-segment');

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case '30-days':
        setStartDate(format(now, 'yyyy-MM-dd'));
        setEndDate(format(addDays(now, 30), 'yyyy-MM-dd'));
        break;
      case '90-days':
        setStartDate(format(now, 'yyyy-MM-dd'));
        setEndDate(format(addDays(now, 90), 'yyyy-MM-dd'));
        break;
      case '6-months':
        setStartDate(format(now, 'yyyy-MM-dd'));
        setEndDate(format(addMonths(now, 6), 'yyyy-MM-dd'));
        break;
    }
  };
  const [showOccupancy, setShowOccupancy] = useState(true);
  const [showADR, setShowADR] = useState(false);
  const [showRevPAR, setShowRevPAR] = useState(false);
  
  // Drill-down metric toggles
  const [showDrillOccupancy, setShowDrillOccupancy] = useState(true);
  const [showDrillADR, setShowDrillADR] = useState(true);
  const [showDrillRevPAR, setShowDrillRevPAR] = useState(false);

  // Real data state
  const [pacingData, setPacingData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Scorecard state
  const [kpis, setKpis] = useState<{ yourHotel: any; market: any }>({ yourHotel: {}, market: {} });
  const [ranking, setRanking] = useState<any>({ occupancy: {}, adr: {}, revpar: {} });

  // Market context state
  const [marketContext, setMarketContext] = useState<{ segmentHotels: number; segmentRooms: number; marketHotels: number; marketRooms: number } | null>(null);

  useEffect(() => {
    if (!propertyId || propertyId === 'ALL') { setMarketContext(null); return; }
    fetch(`/api/metrics/market-context?propertyId=${propertyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setMarketContext)
      .catch(() => setMarketContext(null));
  }, [propertyId]);

  // Portfolio summary state
  const isGroup = properties.length > 1;
  const [portfolioData, setPortfolioData] = useState<PortfolioRow[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioExpanded, setPortfolioExpanded] = useState(false);

  useEffect(() => {
    if (!isGroup) { setPortfolioData([]); return; }

    const fetchPortfolio = async () => {
      setPortfolioLoading(true);
      try {
        const rows: PortfolioRow[] = await Promise.all(
          properties.map(async (prop) => {
            const id = prop.property_id.toString();
            const scope = comparison === 'total-market' ? 'total-market' : 'my-segment';
            const params = new URLSearchParams({ propertyId: id, startDate, endDate, scope });

            const [kpiRes, rankRes, detailRes] = await Promise.all([
              fetch(`/api/metrics/kpi-summary?${params}`),
              fetch(`/api/metrics/ranking?${params}`),
              fetch(`/api/hotels/${id}/details`),
            ]);

            const kpiJson = await kpiRes.json();
            const rankJson = await rankRes.json();
            const detailJson = await detailRes.json();

            const yh = kpiJson.yourHotel || {};
            const mkt = kpiJson.market || {};

            const safeRound = (val: any) => val != null ? Math.round(Number(val)) : null;
            const safeOcc = (val: any) => val != null ? Math.round(Number(val) * 100) : null;
            const pick = (...vals: any[]) => vals.find((v) => v != null) ?? null;

            return {
              hotelId: id,
              hotelName: prop.property_name,
              category: detailJson.category || '--',
              myOcc: safeOcc(pick(yh.occupancy, yh.your_occupancy, yh.your_occupancy_direct)),
              segOcc: safeOcc(pick(mkt.occupancy, mkt.market_occupancy)),
              myAdr: safeRound(pick(yh.adr, yh.your_adr)),
              segAdr: safeRound(pick(mkt.adr, mkt.market_adr)),
              myRevpar: safeRound(pick(yh.revpar, yh.your_revpar)),
              segRevpar: safeRound(pick(mkt.revpar, mkt.market_revpar)),
              occRank: rankJson.occupancy?.rank ?? null,
              occTotal: rankJson.occupancy?.total ?? null,
            };
          })
        );
        setPortfolioData(rows);
      } catch (err) {
        console.error('Portfolio competitive fetch failed', err);
        setPortfolioData([]);
      } finally {
        setPortfolioLoading(false);
      }
    };

    fetchPortfolio();
  }, [isGroup, properties, startDate, endDate, comparison]);

  useEffect(() => {
    if (!propertyId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const scope = comparison === 'total-market' ? 'total-market' : 'my-segment';
        const params = new URLSearchParams({
          propertyId,
          startDate,
          endDate,
          granularity: 'daily',
          scope,
        });

        const kpiParams = new URLSearchParams({ propertyId, startDate, endDate, scope });

        const [myRes, compRes, kpiRes, rankRes] = await Promise.all([
          fetch(`/api/metrics/range?${params}`),
          fetch(`/api/metrics/competitors?${params}`),
          fetch(`/api/metrics/kpi-summary?${kpiParams}`),
          fetch(`/api/metrics/ranking?${kpiParams}`),
        ]);

        const myJson = await myRes.json();
        const compJson = await compRes.json();
        const kpiJson = await kpiRes.json();
        const rankJson = await rankRes.json();

        // Normalize KPI shape — backend returns different field names depending on compset presence
        const yh = kpiJson.yourHotel || {};
        setKpis({
          yourHotel: {
            occupancy: yh.occupancy ?? yh.your_occupancy ?? yh.your_occupancy_direct ?? null,
            adr: yh.adr ?? yh.your_adr ?? null,
            revpar: yh.revpar ?? yh.your_revpar ?? null,
          },
          market: kpiJson.market || {},
        });
        setRanking(rankJson);

        const myMetrics = myJson.metrics || [];
        const compMetrics = compJson.metrics || [];

        // Index compset data by period for fast lookup
        const compByPeriod: Record<string, any> = {};
        compMetrics.forEach((row: any) => {
          const key = row.period?.slice(0, 10);
          if (key) compByPeriod[key] = row;
        });

        const merged = myMetrics.map((row: any) => {
          const period = row.period?.slice(0, 10);
          const dateLabel = new Date(period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const comp = compByPeriod[period] || {};

          const myOcc = row.your_occupancy_direct != null ? Math.round(Number(row.your_occupancy_direct) * 100 * 10) / 10 : null;
          const compOcc = comp.market_occupancy != null ? Math.round(Number(comp.market_occupancy) * 100 * 10) / 10 : null;

          return {
            date: dateLabel,
            myOccupancy: myOcc,
            compsetOccupancy: compOcc,
            myADR: row.your_adr != null ? Math.round(Number(row.your_adr) * 10) / 10 : null,
            compsetADR: comp.market_gross_adr != null ? Math.round(Number(comp.market_gross_adr) * 10) / 10 : null,
            myRevPAR: row.your_revpar != null ? Math.round(Number(row.your_revpar) * 10) / 10 : null,
            compsetRevPAR: comp.market_gross_revpar != null ? Math.round(Number(comp.market_gross_revpar) * 10) / 10 : null,
          };
        });

        setPacingData(merged);
      } catch (err) {
        console.error('CompetitiveData: failed to fetch pacing data', err);
        setPacingData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propertyId, startDate, endDate, comparison]);

  // Daily drill-down derives from real pacingData
  const dailyData = useMemo(() => {
    return pacingData.map((row) => ({
      date: row.date,
      myOcc: row.myOccupancy != null ? Math.round(row.myOccupancy) : null,
      compOcc: row.compsetOccupancy != null ? Math.round(row.compsetOccupancy) : null,
      myRate: row.myADR != null ? Math.round(row.myADR) : null,
      compRate: row.compsetADR != null ? Math.round(row.compsetADR) : null,
      myRevPAR: row.myRevPAR != null ? Math.round(row.myRevPAR) : null,
      compRevPAR: row.compsetRevPAR != null ? Math.round(row.compsetRevPAR) : null,
    }));
  }, [pacingData]);

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
    header: {
      marginBottom: '24px'
    },
    title: {
      color: '#e5e5e5',
      fontSize: '18px',
      marginBottom: '4px'
    },
    subtitle: {
      color: '#9ca3af',
      fontSize: '12px'
    },
    filterBar: {
      display: 'flex',
      gap: '16px',
      marginBottom: '24px',
      alignItems: 'flex-end'
    },
    toggleButton: {
      padding: '8px 16px',
      backgroundColor: 'rgb(26, 26, 26)',
      border: '1px solid #2a2a2a',
      borderRadius: '6px',
      color: '#9ca3af',
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    toggleButtonActive: {
      backgroundColor: '#39BDF8',
      color: '#1d1d1c',
      borderColor: '#39BDF8'
    },
    scorecardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
      marginBottom: '24px'
    },
    card: {
      backgroundColor: 'rgb(26, 26, 26)',
      borderRadius: '8px',
      border: '1px solid #2a2a2a',
      padding: '16px',
      position: 'relative'
    },
    rankBadge: {
      position: 'absolute',
      top: '12px',
      right: '12px',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600
    },
    metricRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: '12px'
    },
    metricLabel: {
      color: '#6b7280',
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em',
      marginBottom: '8px'
    },
    metricValue: {
      fontSize: '28px',
      fontWeight: 600
    },
    comparisonLabel: {
      color: '#6b7280',
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em',
      marginBottom: '4px'
    },
    comparisonValue: {
      color: '#9ca3af',
      fontSize: '14px'
    },
    chartCard: {
      backgroundColor: 'rgb(26, 26, 26)',
      borderRadius: '8px',
      border: '1px solid #2a2a2a',
      padding: '20px',
      marginBottom: '24px'
    },
    chartHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    chartTitle: {
      color: '#e5e5e5',
      fontSize: '14px',
      fontWeight: 600
    },
    chartControls: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center'
    },
    table: {
      backgroundColor: 'rgb(26, 26, 26)',
      borderRadius: '8px',
      border: '1px solid #2a2a2a',
      overflow: 'hidden'
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '120px 1fr 1fr 1fr 1fr 140px',
      gap: '12px',
      padding: '12px 16px',
      borderBottom: '1px solid #2a2a2a',
      backgroundColor: '#1d1d1c'
    },
    tableHeaderCell: {
      color: '#6b7280',
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em',
      fontWeight: 600
    },
    tableRow: {
      display: 'grid',
      gridTemplateColumns: '120px 1fr 1fr 1fr 1fr 140px',
      gap: '12px',
      padding: '12px 16px',
      borderBottom: '1px solid #2a2a2a',
      transition: 'background-color 0.2s'
    },
    tableCell: {
      color: '#e5e5e5',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center'
    },
    actionButton: {
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgb(26, 26, 26)',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ color: '#e5e5e5', fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>
            {payload[0].payload.date}
          </div>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color, fontSize: '11px', marginBottom: '4px' }}>
              {entry.name}: {entry.value}
              {entry.name.includes('Occupancy') ? '%' : currencySymbol}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={styles.container}>
      <div style={styles.backgroundGradient}></div>
      <div style={styles.gridOverlay}></div>

      <div style={styles.contentWrapper}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>Competitive Intelligence</div>
          <div style={styles.subtitle}>Compare your performance against your competitive set and market segment</div>
        </div>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          <DatePickerCalendar
            label="From"
            value={startDate}
            onChange={(d) => { setStartDate(d); setDatePreset('custom'); }}
          />
          <DatePickerCalendar
            label="To"
            value={endDate}
            onChange={(d) => { setEndDate(d); setDatePreset('custom'); }}
          />

          {/* Period Preset */}
          <div>
            <label style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Period</label>
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger
                style={{
                  width: '280px',
                  minWidth: '280px',
                  height: '42px',
                  backgroundColor: '#0d0d0d',
                  border: '1px solid #2a2a2a',
                  color: '#e5e5e5',
                  fontSize: '13px',
                  borderRadius: '4px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  width: '280px',
                  minWidth: '280px',
                  backgroundColor: '#1a1a18',
                  border: '1px solid #3a3a35',
                  color: '#e5e5e5',
                  padding: '4px',
                }}
              >
                <SelectItem value="30-days" style={{ color: '#e5e5e5', borderRadius: '4px' }}>Next 30 Days</SelectItem>
                <SelectItem value="90-days" style={{ color: '#e5e5e5', borderRadius: '4px' }}>Next 90 Days</SelectItem>
                <SelectItem value="6-months" style={{ color: '#e5e5e5', borderRadius: '4px' }}>Next 6 Months</SelectItem>
                {datePreset === 'custom' && <SelectItem value="custom" style={{ color: '#e5e5e5', borderRadius: '4px' }}>Custom</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Segment Toggle */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                ...styles.toggleButton,
                ...(comparison === 'my-segment' ? styles.toggleButtonActive : {})
              }}
              onClick={() => setComparison('my-segment')}
            >
              My Segment{hotelCategory ? ` (${hotelCategory})` : ''}
            </button>
            <button
              style={{
                ...styles.toggleButton,
                ...(comparison === 'total-market' ? styles.toggleButtonActive : {})
              }}
              onClick={() => setComparison('total-market')}
            >
              Total Market
            </button>
          </div>
        </div>

        {/* Market Context Bar */}
        {marketContext && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            backgroundColor: 'rgb(26, 26, 26)',
            borderRadius: '8px',
            border: '1px solid #2a2a2a',
            marginBottom: '24px',
            overflow: 'hidden',
          }}>
            {[
              { label: 'Segment Hotels', value: marketContext.segmentHotels, suffix: 'hotels' },
              { label: 'Segment Rooms', value: marketContext.segmentRooms.toLocaleString(), suffix: 'rooms' },
              { label: 'Total Market Hotels', value: marketContext.marketHotels, suffix: 'hotels' },
              { label: 'Total Market Rooms', value: marketContext.marketRooms.toLocaleString(), suffix: 'rooms' },
            ].map((item, idx) => (
              <div key={idx} style={{
                padding: '16px 20px',
                borderRight: idx < 3 ? '1px solid #2a2a2a' : 'none',
              }}>
                <div style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '-0.025em', marginBottom: '8px' }}>
                  {item.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ color: '#39BDF8', fontSize: '24px', fontWeight: 600 }}>{item.value}</span>
                  <span style={{ color: '#6b7280', fontSize: '11px' }}>{item.suffix}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Portfolio Competitive Summary */}
        {isGroup && (
          <div style={{
            backgroundColor: 'rgb(26, 26, 26)',
            borderRadius: '8px',
            border: '1px solid #2a2a2a',
            marginBottom: '24px',
            overflow: 'hidden',
          }}>
            <div
              onClick={() => setPortfolioExpanded(!portfolioExpanded)}
              style={{ padding: '16px 20px', borderBottom: portfolioExpanded ? '1px solid #2a2a2a' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ color: '#e5e5e5', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                  Property-by-Property Market Comparison
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px' }}>
                  Each hotel compared against its own segment — click a row to drill in
                </div>
              </div>
              <ChevronDown
                style={{
                  width: '18px',
                  height: '18px',
                  color: '#6b7280',
                  transition: 'transform 0.2s',
                  transform: portfolioExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  flexShrink: 0,
                }}
              />
            </div>

            {portfolioExpanded && (portfolioLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: '#6b7280', gap: '8px' }}>
                <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '12px' }}>Loading portfolio data...</span>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 80px',
                  gap: '8px',
                  padding: '10px 20px',
                  borderBottom: '1px solid #2a2a2a',
                  backgroundColor: '#1d1d1c',
                }}>
                  {['Hotel', 'Category', 'My Occ', 'Seg Occ', 'My ADR', 'Seg ADR', 'My RevPAR', 'Seg RevPAR', 'Rank'].map((h) => (
                    <div key={h} style={{ color: '#6b7280', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>{h}</div>
                  ))}
                </div>

                {/* Table Rows */}
                {portfolioData.map((row) => {
                  const isSelected = row.hotelId === propertyId;
                  const occWinning = row.myOcc != null && row.segOcc != null && row.myOcc >= row.segOcc;
                  const adrWinning = row.myAdr != null && row.segAdr != null && row.myAdr >= row.segAdr;

                  return (
                    <div
                      key={row.hotelId}
                      onClick={() => onPropertyChange(row.hotelId)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr 80px',
                        gap: '8px',
                        padding: '12px 20px',
                        borderBottom: '1px solid #2a2a2a',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(57, 189, 248, 0.08)' : 'transparent',
                        borderLeft: isSelected ? '3px solid #39BDF8' : '3px solid transparent',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(57, 189, 248, 0.04)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ color: isSelected ? '#39BDF8' : '#e5e5e5', fontSize: '12px', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.hotelName}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>{row.category}</div>
                      <div style={{ color: occWinning ? '#10b981' : '#e5e5e5', fontSize: '12px' }}>
                        {row.myOcc != null ? `${row.myOcc}%` : '--'}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        {row.segOcc != null ? `${row.segOcc}%` : '--'}
                      </div>
                      <div style={{ color: adrWinning ? '#10b981' : '#e5e5e5', fontSize: '12px' }}>
                        {row.myAdr != null ? `${currencySymbol}${row.myAdr}` : '--'}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        {row.segAdr != null ? `${currencySymbol}${row.segAdr}` : '--'}
                      </div>
                      <div style={{ color: '#e5e5e5', fontSize: '12px' }}>
                        {row.myRevpar != null ? `${currencySymbol}${row.myRevpar}` : '--'}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        {row.segRevpar != null ? `${currencySymbol}${row.segRevpar}` : '--'}
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        {row.occRank != null ? (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            ...(row.occRank <= Math.ceil((row.occTotal || 1) * 0.33)
                              ? { backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                              : row.occRank <= Math.ceil((row.occTotal || 1) * 0.66)
                              ? { backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }
                              : { backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                            ),
                          }}>
                            #{row.occRank}/{row.occTotal}
                          </span>
                        ) : '--'}
                      </div>
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        )}

        {/* Scorecard Row */}
        {isLoading ? (
          <div style={styles.scorecardGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ ...styles.card, minHeight: '120px' }}>
                <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ width: '60%', height: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                  <div style={{ width: '40%', height: '28px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                  <div style={{ width: '50%', height: '10px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (() => {
          const myOcc = kpis.yourHotel?.occupancy != null ? Math.round(Number(kpis.yourHotel.occupancy) * 100) : '--';
          const compOcc = kpis.market?.occupancy != null ? Math.round(Number(kpis.market.occupancy) * 100) : '--';
          const myAdr = kpis.yourHotel?.adr != null ? Math.round(Number(kpis.yourHotel.adr)) : '--';
          const compAdr = kpis.market?.adr != null ? Math.round(Number(kpis.market.adr)) : '--';
          const myRev = kpis.yourHotel?.revpar != null ? Math.round(Number(kpis.yourHotel.revpar)) : '--';
          const compRev = kpis.market?.revpar != null ? Math.round(Number(kpis.market.revpar)) : '--';

          const getRankColor = (rank: number, total: number) => {
            if (!rank || !total) return { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', border: '1px solid rgba(107,114,128,0.3)' };
            const pct = rank / total;
            if (pct <= 0.33) return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' };
            if (pct <= 0.66) return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' };
            return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' };
          };

          const occRank = getRankColor(ranking.occupancy?.rank, ranking.occupancy?.total);
          const adrRank = getRankColor(ranking.adr?.rank, ranking.adr?.total);
          const revRank = getRankColor(ranking.revpar?.rank, ranking.revpar?.total);

          return (
            <div style={styles.scorecardGrid}>
              {/* Occupancy */}
              <div style={styles.card}>
                <div style={{ ...styles.rankBadge, backgroundColor: occRank.bg, color: occRank.color, border: occRank.border }}>
                  #{ranking.occupancy?.rank || '-'}
                </div>
                <div style={styles.metricLabel}>Occupancy</div>
                <div style={styles.metricRow}>
                  <div>
                    <div style={{ ...styles.metricValue, color: '#39BDF8' }}>{myOcc}{myOcc !== '--' && '%'}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>My Hotel</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...styles.metricValue, color: '#9ca3af', fontSize: '20px' }}>{compOcc}{compOcc !== '--' && '%'}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{comparison === 'total-market' ? 'Market Avg' : 'Segment Avg'}</div>
                  </div>
                </div>
              </div>

              {/* ADR */}
              <div style={styles.card}>
                <div style={{ ...styles.rankBadge, backgroundColor: adrRank.bg, color: adrRank.color, border: adrRank.border }}>
                  #{ranking.adr?.rank || '-'}
                </div>
                <div style={styles.metricLabel}>ADR (Average Daily Rate)</div>
                <div style={styles.metricRow}>
                  <div>
                    <div style={{ ...styles.metricValue, color: '#39BDF8' }}>{myAdr !== '--' && currencySymbol}{myAdr}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>My Hotel</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...styles.metricValue, color: '#9ca3af', fontSize: '20px' }}>{compAdr !== '--' && currencySymbol}{compAdr}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{comparison === 'total-market' ? 'Market Avg' : 'Segment Avg'}</div>
                  </div>
                </div>
              </div>

              {/* RevPAR */}
              <div style={styles.card}>
                <div style={{ ...styles.rankBadge, backgroundColor: revRank.bg, color: revRank.color, border: revRank.border }}>
                  #{ranking.revpar?.rank || '-'}
                </div>
                <div style={styles.metricLabel}>RevPAR</div>
                <div style={styles.metricRow}>
                  <div>
                    <div style={{ ...styles.metricValue, color: '#39BDF8' }}>{myRev !== '--' && currencySymbol}{myRev}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>My Hotel</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...styles.metricValue, color: '#9ca3af', fontSize: '20px' }}>{compRev !== '--' && currencySymbol}{compRev}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>{comparison === 'total-market' ? 'Market Avg' : 'Segment Avg'}</div>
                  </div>
                </div>
              </div>

              {/* Sentinel Insight */}
              <div style={{
                ...styles.card,
                background: 'linear-gradient(135deg, rgba(57, 189, 248, 0.1), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(57, 189, 248, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Zap style={{ width: '16px', height: '16px', color: '#39BDF8' }} />
                  <div style={{ color: '#39BDF8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '-0.025em' }}>
                    Sentinel Insight
                  </div>
                </div>
                <div style={{ color: '#e5e5e5', fontSize: '13px', lineHeight: '1.6' }}>
                  {typeof myOcc === 'number' && typeof compOcc === 'number' && myOcc > compOcc
                    ? <>Your occupancy is <span style={{ color: '#10b981', fontWeight: 600 }}>{myOcc - compOcc}pts above</span> the segment average.</>
                    : typeof myOcc === 'number' && typeof compOcc === 'number'
                    ? <>Your occupancy is <span style={{ color: '#ef4444', fontWeight: 600 }}>{compOcc - myOcc}pts below</span> the segment average.</>
                    : <>Select a date range to see competitive insights.</>
                  }
                  {typeof myAdr === 'number' && typeof compAdr === 'number' && myAdr < compAdr && (
                    <> Compset ADR is <span style={{ color: '#39BDF8', fontWeight: 600 }}>{currencySymbol}{compAdr - myAdr} higher</span> — consider raising rates.</>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pacing Chart */}
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <div>
              <div style={styles.chartTitle}>Forward Booking Pace</div>
              <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
                Track your competitive position over time
              </div>
            </div>
            <div style={styles.chartControls}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showOccupancy}
                  onChange={(e) => setShowOccupancy(e.target.checked)}
                  style={{ accentColor: '#39BDF8', width: '14px', height: '14px' }}
                />
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>Occupancy</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showADR}
                  onChange={(e) => setShowADR(e.target.checked)}
                  style={{ accentColor: '#39BDF8', width: '14px', height: '14px' }}
                />
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>ADR</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showRevPAR}
                  onChange={(e) => setShowRevPAR(e.target.checked)}
                  style={{ accentColor: '#39BDF8', width: '14px', height: '14px' }}
                />
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>RevPAR</span>
              </label>
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#6b7280', gap: '8px' }}>
              <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px' }}>Loading data...</span>
            </div>
          ) : pacingData.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#6b7280', fontSize: '13px' }}>
              No data available for this date range
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pacingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280" 
                fontSize={10}
                tickLine={false}
              />
              <YAxis 
                stroke="#6b7280" 
                fontSize={10}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                iconType="line"
              />
              {showOccupancy && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="myOccupancy" 
                    stroke="#39BDF8" 
                    strokeWidth={2.5}
                    name="My Occupancy"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="compsetOccupancy" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Compset Occupancy"
                    dot={false}
                  />
                </>
              )}
              {showADR && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="myADR" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5}
                    name="My ADR"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="compsetADR" 
                    stroke="#ec4899" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Compset ADR"
                    dot={false}
                  />
                </>
              )}
              {showRevPAR && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="myRevPAR" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    name="My RevPAR"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="compsetRevPAR" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Compset RevPAR"
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Daily Drill-Down Table */}
        {isLoading ? (
          <div style={{ ...styles.table, padding: '16px' }}>
            <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ width: '200px', height: '14px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                <div style={{ width: '120px', height: '14px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
              </div>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '80px', height: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                  <div style={{ flex: 1, height: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                  <div style={{ flex: 1, height: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                  <div style={{ flex: 1, height: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                  <div style={{ flex: 1, height: '12px', backgroundColor: '#2a2a2a', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ color: '#e5e5e5', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                Daily Performance Drill-Down
              </div>
              <div style={{ color: '#6b7280', fontSize: '11px' }}>
                Day-by-day comparison with configurable metrics
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDrillOccupancy}
                  onChange={(e) => setShowDrillOccupancy(e.target.checked)}
                  style={{ accentColor: '#39BDF8', width: '14px', height: '14px' }}
                />
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>Occupancy</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDrillADR}
                  onChange={(e) => setShowDrillADR(e.target.checked)}
                  style={{ accentColor: '#39BDF8', width: '14px', height: '14px' }}
                />
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>ADR</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDrillRevPAR}
                  onChange={(e) => setShowDrillRevPAR(e.target.checked)}
                  style={{ accentColor: '#39BDF8', width: '14px', height: '14px' }}
                />
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>RevPAR</span>
              </label>
            </div>
          </div>

          <div style={styles.table}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `120px repeat(${(showDrillOccupancy ? 1 : 0) + (showDrillADR ? 1 : 0) + (showDrillRevPAR ? 1 : 0)}, 1fr 1fr)`,
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid #2a2a2a',
              backgroundColor: '#1d1d1c'
            }}>
              <div style={styles.tableHeaderCell}>Date</div>
              {showDrillOccupancy && (
                <>
                  <div style={{ ...styles.tableHeaderCell, color: '#39BDF8' }}>My Occ %</div>
                  <div style={{ ...styles.tableHeaderCell, color: '#f59e0b' }}>Comp Occ %</div>
                </>
              )}
              {showDrillADR && (
                <>
                  <div style={{ ...styles.tableHeaderCell, color: '#39BDF8' }}>My ADR</div>
                  <div style={{ ...styles.tableHeaderCell, color: '#f59e0b' }}>Comp ADR</div>
                </>
              )}
              {showDrillRevPAR && (
                <>
                  <div style={{ ...styles.tableHeaderCell, color: '#39BDF8' }}>My RevPAR</div>
                  <div style={{ ...styles.tableHeaderCell, color: '#f59e0b' }}>Comp RevPAR</div>
                </>
              )}
            </div>
            {dailyData.map((row, index) => (
              <div 
                key={index} 
                style={{
                  display: 'grid',
                  gridTemplateColumns: `120px repeat(${(showDrillOccupancy ? 1 : 0) + (showDrillADR ? 1 : 0) + (showDrillRevPAR ? 1 : 0)}, 1fr 1fr)`,
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: '1px solid #2a2a2a',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(57, 189, 248, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={styles.tableCell}>{row.date}</div>
                {showDrillOccupancy && (
                  <>
                    <div style={styles.tableCell}>
                      <span style={{ color: row.myOcc > row.compOcc ? '#10b981' : '#e5e5e5' }}>
                        {row.myOcc}%
                      </span>
                    </div>
                    <div style={{ ...styles.tableCell, color: '#9ca3af' }}>{row.compOcc}%</div>
                  </>
                )}
                {showDrillADR && (
                  <>
                    <div style={styles.tableCell}>
                      <span style={{ color: row.myRate > row.compRate ? '#10b981' : row.myRate < row.compRate - 10 ? '#ef4444' : '#e5e5e5' }}>
                        {currencySymbol}{row.myRate}
                      </span>
                    </div>
                    <div style={{ ...styles.tableCell, color: '#9ca3af' }}>{currencySymbol}{row.compRate}</div>
                  </>
                )}
                {showDrillRevPAR && (
                  <>
                    <div style={styles.tableCell}>
                      <span style={{ color: row.myRevPAR > row.compRevPAR ? '#10b981' : '#ef4444' }}>
                        {currencySymbol}{row.myRevPAR}
                      </span>
                    </div>
                    <div style={{ ...styles.tableCell, color: '#9ca3af' }}>{currencySymbol}{row.compRevPAR}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}