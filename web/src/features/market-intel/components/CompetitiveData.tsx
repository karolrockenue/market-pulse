import { useState, useEffect, useMemo, CSSProperties } from 'react';
import { R } from '../../../styles/tokens';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Trophy, AlertTriangle, Target, Zap, Loader2, ChevronDown, Building2 } from 'lucide-react';
import { format, addDays, addMonths } from 'date-fns';
import { DatePickerNav } from '@/components/DatePickerNav';
// Select removed — period dropdown dropped

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
}

export function CompetitiveData({ propertyId, currencySymbol, hotelCategory, properties, onPropertyChange, onNavigate }: CompetitiveDataProps) {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(today, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(today, 30), 'yyyy-MM-dd'));
  const [datePreset, setDatePreset] = useState('30-days');
  const [comparison, setComparison] = useState('my-segment');
  const [openPicker, setOpenPicker] = useState<'from' | 'to' | null>(null);

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
  const [marketContext, setMarketContext] = useState<{ segmentHotels: number; segmentRooms: number; marketHotels: number; marketRooms: number; byTier?: { tier: string; count: number }[]; byNeighborhood?: { area: string; count: number }[] } | null>(null);

  // Portfolio summary state
  const isGroup = properties.length > 1;
  const [portfolioData, setPortfolioData] = useState<PortfolioRow[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioExpanded, setPortfolioExpanded] = useState(false);
  const [neighborhoodsExpanded, setNeighborhoodsExpanded] = useState(false);

  useEffect(() => {
    if (!isGroup) { setPortfolioData([]); return; }

    const fetchPortfolio = async () => {
      setPortfolioLoading(true);
      try {
        const scope = comparison === 'total-market' ? 'total-market' : 'my-segment';
        const propertyIds = properties.map((p) => p.property_id).join(',');
        const params = new URLSearchParams({ propertyIds, startDate, endDate, scope });
        const res = await fetch(`/api/metrics/portfolio-competitive?${params}`);
        const batchData = await res.json();

        const safeRound = (val: any) => val != null ? Math.round(Number(val)) : null;
        const safeOcc = (val: any) => val != null ? Math.round(Number(val) * 100) : null;
        const pick = (...vals: any[]) => vals.find((v) => v != null) ?? null;

        const rows: PortfolioRow[] = batchData.map((item: any) => {
          const prop = properties.find((p) => p.property_id.toString() === item.hotelId.toString());
          const yh = item.kpis?.yourHotel || {};
          const mkt = item.kpis?.market || {};
          return {
            hotelId: item.hotelId,
            hotelName: prop?.property_name || '--',
            category: item.category || '--',
            myOcc: safeOcc(pick(yh.occupancy, yh.your_occupancy, yh.your_occupancy_direct)),
            segOcc: safeOcc(pick(mkt.occupancy, mkt.market_occupancy)),
            myAdr: safeRound(pick(yh.adr, yh.your_adr)),
            segAdr: safeRound(pick(mkt.adr, mkt.market_adr)),
            myRevpar: safeRound(pick(yh.revpar, yh.your_revpar)),
            segRevpar: safeRound(pick(mkt.revpar, mkt.market_revpar)),
            occRank: item.ranking?.occupancy?.rank ?? null,
            occTotal: item.ranking?.occupancy?.total ?? null,
          };
        });
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
        const intelParams = new URLSearchParams({ propertyId, startDate, endDate, scope, granularity: 'daily' });

        // Single call — returns KPIs, ranking, market context, range, and competitors
        const intelRes = await fetch(`/api/metrics/competitive-intel?${intelParams}`);
        const intelJson = await intelRes.json();

        // KPIs + ranking + market context
        const yh = intelJson.kpis?.yourHotel || {};
        setKpis({
          yourHotel: {
            occupancy: yh.occupancy ?? yh.your_occupancy ?? yh.your_occupancy_direct ?? null,
            adr: yh.adr ?? yh.your_adr ?? null,
            revpar: yh.revpar ?? yh.your_revpar ?? null,
          },
          market: intelJson.kpis?.market || {},
        });
        setRanking(intelJson.ranking || { occupancy: {}, adr: {}, revpar: {} });
        setMarketContext(intelJson.marketContext || null);

        // Merge chart data from the same response
        const myMetrics = intelJson.range?.metrics || [];
        const compMetrics = intelJson.competitors?.metrics || [];

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
        console.error('CompetitiveData: failed to fetch data', err);
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
      flex: 1,
      background: R.bg,
      color: R.accent,
    },
    contentWrapper: {
      padding: '24px 28px'
    },
    header: {
      marginBottom: '24px'
    },
    title: {
      color: R.gold,
      fontSize: '22px',
      fontWeight: 400,
      letterSpacing: -0.5,
      marginBottom: '4px'
    },
    subtitle: {
      color: R.textMid,
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
      backgroundColor: R.darkBand,
      border: `1px solid ${R.border}`,
      borderRadius: '6px',
      color: R.textMid,
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    toggleButtonActive: {
      backgroundColor: R.warmTeal,
      color: R.bg,
      borderColor: R.warmTeal
    },
    scorecardGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '14px',
      marginBottom: '24px'
    },
    card: {
      backgroundColor: R.card,
      borderRadius: '8px',
      border: `1px solid ${R.border}`,
      padding: '16px 18px',
      position: 'relative'
    },
    rankBadge: {
      position: 'absolute',
      top: '12px',
      right: '12px',
      padding: '3px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 600
    },
    metricRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    metricLabel: {
      color: R.textDim,
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '12px'
    },
    metricValue: {
      fontSize: '26px',
      fontWeight: 700
    },
    comparisonLabel: {
      color: R.textDim,
      fontSize: '10px',
      textTransform: 'uppercase',
      letterSpacing: '-0.025em',
      marginBottom: '4px'
    },
    comparisonValue: {
      color: R.textMid,
      fontSize: '14px'
    },
    chartCard: {
      backgroundColor: R.darkBand,
      borderRadius: '8px',
      border: `1px solid ${R.border}`,
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
      color: R.accent,
      fontSize: '14px',
      fontWeight: 600
    },
    chartControls: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center'
    },
    table: {
      backgroundColor: R.darkBand,
      borderRadius: '8px',
      border: `1px solid ${R.border}`,
      overflow: 'hidden'
    },
    tableHeader: {
      display: 'grid',
      gridTemplateColumns: '120px 1fr 1fr 1fr 1fr 140px',
      gap: '12px',
      padding: '12px 16px',
      borderBottom: `1px solid ${R.sep}`,
      backgroundColor: R.bg
    },
    tableHeaderCell: {
      color: R.textDim,
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
      borderBottom: `1px solid ${R.sep}`,
      transition: 'background-color 0.2s'
    },
    tableCell: {
      color: R.accent,
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
          backgroundColor: R.darkBand,
          border: `1px solid ${R.border}`,
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ color: R.accent, fontSize: '12px', marginBottom: '8px', fontWeight: 600 }}>
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

      <div style={styles.contentWrapper}>
        {/* Header + Date Pickers — exact copy of MPCompsetViewV2 layout */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Target size={22} color={R.warmTeal} />
                <h1 style={{ fontSize: 22, fontWeight: 400, color: R.accent, margin: 0, letterSpacing: -0.5 }}>Compset Intelligence</h1>
              </div>
              <p style={{ fontSize: 13, color: R.gold, margin: 0 }}>Your hotel vs competitive set — occupancy, ADR, RevPAR rankings and trends</p>
            </div>
            {/* Date Range Pickers */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
              <DatePickerNav label="From" value={startDate} onChange={(d) => { setStartDate(d); setDatePreset('custom'); }} isOpen={openPicker === 'from'} onOpenChange={(v) => setOpenPicker(v ? 'from' : null)} />
              <div style={{ fontSize: 12, color: R.textDim, paddingBottom: 10 }}>→</div>
              <DatePickerNav label="To" value={endDate} onChange={(d) => { setEndDate(d); setDatePreset('custom'); }} isOpen={openPicker === 'to'} onOpenChange={(v) => setOpenPicker(v ? 'to' : null)} />
              <button
                onClick={() => fetchData()}
                style={{
                  padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: "#38C6BA", color: R.darkBand, fontSize: 12, fontWeight: 600,
                  height: 32, marginBottom: 0,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>


        {/* Portfolio Competitive Summary */}
        {isGroup && (
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24, overflow: 'hidden' }}>
            <div
              onClick={() => setPortfolioExpanded(!portfolioExpanded)}
              style={{ padding: '14px 20px', borderBottom: portfolioExpanded ? `1px solid ${R.sep}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Building2 size={14} color={R.gold} />
              <span style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Portfolio Competitive Summary</span>
              <span style={{ fontSize: 11, color: R.textDim, marginLeft: 'auto' }}>{portfolioData.length} properties</span>
              <ChevronDown
                size={14}
                color={R.textDim}
                style={{ transition: 'transform 0.2s', transform: portfolioExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }}
              />
            </div>

            {portfolioExpanded && (portfolioLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: R.textDim, gap: '8px' }}>
                <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '12px' }}>Loading portfolio data...</span>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${R.sep}` }}>
                    {['Property', 'Cat', 'My Occ', 'Seg Occ', 'My ADR', 'Seg ADR', 'Rank'].map(h => (
                      <th key={h} style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: R.textDim, textTransform: 'uppercase', textAlign: h === 'Property' ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.map((row, i) => {
                    const occWinning = row.myOcc != null && row.segOcc != null && row.myOcc >= row.segOcc;
                    const rankVal = row.occRank;
                    const rankTotal = row.occTotal || 1;
                    const rankPct = rankVal != null ? rankVal / rankTotal : 1;
                    const rc = rankVal == null
                      ? { bg: 'transparent', color: R.textDim, border: 'none' }
                      : rankPct <= 0.33
                      ? { bg: 'rgba(52,208,104,0.1)', color: R.green, border: `1px solid rgba(52,208,104,0.3)` }
                      : rankPct <= 0.66
                      ? { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: `1px solid rgba(245,158,11,0.3)` }
                      : { bg: 'rgba(239,68,68,0.1)', color: R.red, border: `1px solid rgba(239,68,68,0.3)` };

                    return (
                      <tr
                        key={row.hotelId}
                        onClick={() => onPropertyChange(row.hotelId)}
                        style={{ borderBottom: i < portfolioData.length - 1 ? `1px solid ${R.sep}` : 'none', cursor: 'pointer' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(56,198,186,0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '10px 16px', fontSize: 13, color: R.accent, fontWeight: 500 }}>{row.hotelName}</td>
                        <td style={{ padding: '10px 16px', fontSize: 11, color: R.textDim, textAlign: 'right' }}>{row.category}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: occWinning ? R.green : R.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.myOcc != null ? `${row.myOcc}%` : '--'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: R.textMid, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.segOcc != null ? `${row.segOcc}%` : '--'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: R.accent, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.myAdr != null ? `${currencySymbol}${row.myAdr}` : '--'}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: R.textMid, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.segAdr != null ? `${currencySymbol}${row.segAdr}` : '--'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          {rankVal != null ? (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, backgroundColor: rc.bg, color: rc.color, border: rc.border }}>#{rankVal}</span>
                          ) : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          </div>
        )}

        {/* Segment Toggle */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          <button
            style={{
              ...styles.toggleButton,
              ...(comparison === 'my-segment' ? styles.toggleButtonActive : {}),
            }}
            onClick={() => setComparison('my-segment')}
          >
            My Segment{hotelCategory ? ` (${hotelCategory})` : ''}
          </button>
          <button
            style={{
              ...styles.toggleButton,
              ...(comparison === 'total-market' ? styles.toggleButtonActive : {}),
            }}
            onClick={() => setComparison('total-market')}
          >
            Total Market
          </button>
        </div>

        {/* Scorecard Row */}
        {isLoading ? (
          <div style={styles.scorecardGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ ...styles.card, minHeight: '120px' }}>
                <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ width: '60%', height: '10px', backgroundColor: R.border, borderRadius: '4px' }} />
                  <div style={{ width: '40%', height: '28px', backgroundColor: R.border, borderRadius: '4px' }} />
                  <div style={{ width: '50%', height: '10px', backgroundColor: R.border, borderRadius: '4px' }} />
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
            if (!rank || !total) return { bg: 'rgba(107,114,128,0.1)', color: R.textDim, border: '1px solid rgba(107,114,128,0.3)' };
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
              <div style={{ ...styles.card, backgroundColor: R.darkBand }}>
                <div style={{ ...styles.rankBadge, backgroundColor: occRank.bg, color: occRank.color, border: occRank.border }}>
                  #{ranking.occupancy?.rank || '-'}
                </div>
                <div style={styles.metricLabel}>Occupancy</div>
                <div style={styles.metricRow}>
                  <div>
                    <div style={{ ...styles.metricValue, color: "#7BAFD4" }}>{myOcc}{myOcc !== '--' && '%'}</div>
                    <div style={{ color: R.textDim, fontSize: '10px', marginTop: '4px' }}>My Hotel</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: R.textMid }}>{compOcc}{compOcc !== '--' && '%'}</div>
                    <div style={{ color: R.textDim, fontSize: '10px', marginTop: '4px' }}>{comparison === 'total-market' ? 'Market Avg' : 'Segment Avg'}</div>
                  </div>
                </div>
              </div>

              {/* ADR */}
              <div style={{ ...styles.card, backgroundColor: R.darkBand }}>
                <div style={{ ...styles.rankBadge, backgroundColor: adrRank.bg, color: adrRank.color, border: adrRank.border }}>
                  #{ranking.adr?.rank || '-'}
                </div>
                <div style={styles.metricLabel}>ADR</div>
                <div style={styles.metricRow}>
                  <div>
                    <div style={{ ...styles.metricValue, color: "#7BAFD4" }}>{myAdr !== '--' && currencySymbol}{myAdr}</div>
                    <div style={{ color: R.textDim, fontSize: '10px', marginTop: '4px' }}>My Hotel</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: R.textMid }}>{compAdr !== '--' && currencySymbol}{compAdr}</div>
                    <div style={{ color: R.textDim, fontSize: '10px', marginTop: '4px' }}>{comparison === 'total-market' ? 'Market Avg' : 'Segment Avg'}</div>
                  </div>
                </div>
              </div>

              {/* RevPAR */}
              <div style={{ ...styles.card, backgroundColor: R.darkBand }}>
                <div style={{ ...styles.rankBadge, backgroundColor: revRank.bg, color: revRank.color, border: revRank.border }}>
                  #{ranking.revpar?.rank || '-'}
                </div>
                <div style={styles.metricLabel}>RevPAR</div>
                <div style={styles.metricRow}>
                  <div>
                    <div style={{ ...styles.metricValue, color: "#7BAFD4" }}>{myRev !== '--' && currencySymbol}{myRev}</div>
                    <div style={{ color: R.textDim, fontSize: '10px', marginTop: '4px' }}>My Hotel</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: R.textMid }}>{compRev !== '--' && currencySymbol}{compRev}</div>
                    <div style={{ color: R.textDim, fontSize: '10px', marginTop: '4px' }}>{comparison === 'total-market' ? 'Market Avg' : 'Segment Avg'}</div>
                  </div>
                </div>
              </div>

              {/* Sentinel Insight */}
              <div style={{
                ...styles.card,
                background: 'linear-gradient(135deg, rgba(56, 198, 186, 0.08), rgba(200, 166, 110, 0.06))',
                border: '1px solid rgba(56, 198, 186, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Zap style={{ width: '14px', height: '14px', color: '#7BAFD4' }} />
                  <div style={{ color: '#7BAFD4', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sentinel Insight
                  </div>
                </div>
                <div style={{ color: R.text, fontSize: '13px', lineHeight: '1.65' }}>
                  {typeof myOcc === 'number' && typeof compOcc === 'number' && myOcc > compOcc
                    ? <>Your occupancy is <span style={{ color: '#7BAFD4', fontWeight: 600 }}>{myOcc - compOcc}pts above</span> the segment average.</>
                    : typeof myOcc === 'number' && typeof compOcc === 'number'
                    ? <>Your occupancy is <span style={{ color: '#ef4444', fontWeight: 600 }}>{compOcc - myOcc}pts below</span> the segment average.</>
                    : <>Select a date range to see competitive insights.</>
                  }
                  {typeof myAdr === 'number' && typeof compAdr === 'number' && myAdr < compAdr && (
                    <> Compset ADR is <span style={{ color: '#7BAFD4', fontWeight: 600 }}>{currencySymbol}{compAdr - myAdr} higher</span> — consider raising rates.</>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Main Content Grid: Chart + Table (left 2/3) | Insights sidebar (right 1/3) */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
          {/* ── Left Column ── */}
          <div>
            {/* Performance Chart */}
            <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24 }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${R.sep}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Performance vs Market</div>
                  <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>
                    Your hotel compared against {comparison === 'total-market' ? 'total market' : 'segment'} average
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {showOccupancy && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 14, height: 2, backgroundColor: '#38C6BA', borderRadius: 1 }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>My Occupancy</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 14, height: 0, borderBottom: '2px dashed #38C6BA' }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>Segment Occ</span>
                      </div>
                    </>
                  )}
                  {showADR && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 14, height: 2, backgroundColor: R.gold, borderRadius: 1 }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>My ADR</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 14, height: 0, borderBottom: `2px dashed ${R.gold}` }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>Segment ADR</span>
                      </div>
                    </>
                  )}
                  {showRevPAR && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 14, height: 2, backgroundColor: R.green, borderRadius: 1 }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>My RevPAR</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 14, height: 0, borderBottom: `2px dashed ${R.green}` }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>Segment RevPAR</span>
                      </div>
                    </>
                  )}
                  <div style={{ width: 1, height: 16, backgroundColor: R.border, margin: '0 4px' }} />
                  {['Occ', 'ADR', 'RevPAR'].map((label, i) => {
                    const checked = i === 0 ? showOccupancy : i === 1 ? showADR : showRevPAR;
                    const toggle = i === 0 ? setShowOccupancy : i === 1 ? setShowADR : setShowRevPAR;
                    return (
                      <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={(e) => toggle(e.target.checked)} style={{ accentColor: '#38C6BA', width: 12, height: 12 }} />
                        <span style={{ fontSize: 10, color: R.textDim }}>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: R.textDim, gap: '8px' }}>
                  <Loader2 style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '13px' }}>Loading data...</span>
                </div>
              ) : pacingData.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: R.textDim, fontSize: '13px' }}>
                  No data available for this date range
                </div>
              ) : (
              <div style={{ padding: '12px 20px 16px', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pacingData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.5} />
                  <XAxis
                    dataKey="date"
                    stroke={R.border}
                    tick={{ fill: R.textDim, fontSize: 10 }}
                    tickLine={{ stroke: R.border }}
                    interval={6}
                  />
                  <YAxis
                    stroke={R.border}
                    tick={{ fill: R.textDim, fontSize: 10 }}
                    tickLine={{ stroke: R.border }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(18,21,25,0.95)', border: `1px solid ${R.border}`, borderRadius: 6, padding: '10px 14px' }}
                    labelStyle={{ color: R.textMid, fontSize: 11 }}
                    itemStyle={{ fontSize: 12, color: R.accent }}
                  />
                  {showOccupancy && (
                    <>
                      <Line type="monotone" dataKey="myOccupancy" name="My Occupancy" stroke="#38C6BA" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compsetOccupancy" name="Segment Occ" stroke="#38C6BA" strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                    </>
                  )}
                  {showADR && (
                    <>
                      <Line type="monotone" dataKey="myADR" name="My ADR" stroke={R.gold} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compsetADR" name="Segment ADR" stroke={R.gold} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                    </>
                  )}
                  {showRevPAR && (
                    <>
                      <Line type="monotone" dataKey="myRevPAR" name="My RevPAR" stroke={R.green} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="compsetRevPAR" name="Segment RevPAR" stroke={R.green} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.5} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
              </div>
              )}
            </div>

            {/* Daily Drill-Down Table */}
            {isLoading ? (
              <div style={{ ...styles.table, padding: '16px' }}>
                <div className="animate-pulse" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ width: '200px', height: '14px', backgroundColor: R.border, borderRadius: '4px' }} />
                    <div style={{ width: '120px', height: '14px', backgroundColor: R.border, borderRadius: '4px' }} />
                  </div>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ width: '80px', height: '12px', backgroundColor: R.border, borderRadius: '4px' }} />
                      <div style={{ flex: 1, height: '12px', backgroundColor: R.border, borderRadius: '4px' }} />
                      <div style={{ flex: 1, height: '12px', backgroundColor: R.border, borderRadius: '4px' }} />
                      <div style={{ flex: 1, height: '12px', backgroundColor: R.border, borderRadius: '4px' }} />
                      <div style={{ flex: 1, height: '12px', backgroundColor: R.border, borderRadius: '4px' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: R.accent, fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                    Daily Performance Drill-Down
                  </div>
                  <div style={{ color: R.textDim, fontSize: '11px' }}>
                    Day-by-day comparison with configurable metrics
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showDrillOccupancy}
                      onChange={(e) => setShowDrillOccupancy(e.target.checked)}
                      style={{ accentColor: R.warmTeal, width: '14px', height: '14px' }}
                    />
                    <span style={{ color: R.textMid, fontSize: '11px' }}>Occupancy</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showDrillADR}
                      onChange={(e) => setShowDrillADR(e.target.checked)}
                      style={{ accentColor: R.warmTeal, width: '14px', height: '14px' }}
                    />
                    <span style={{ color: R.textMid, fontSize: '11px' }}>ADR</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showDrillRevPAR}
                      onChange={(e) => setShowDrillRevPAR(e.target.checked)}
                      style={{ accentColor: R.warmTeal, width: '14px', height: '14px' }}
                    />
                    <span style={{ color: R.textMid, fontSize: '11px' }}>RevPAR</span>
                  </label>
                </div>
              </div>

              <div style={styles.table}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `120px repeat(${(showDrillOccupancy ? 1 : 0) + (showDrillADR ? 1 : 0) + (showDrillRevPAR ? 1 : 0)}, 1fr 1fr)`,
                  gap: '12px',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${R.sep}`,
                  backgroundColor: R.bg
                }}>
                  <div style={styles.tableHeaderCell}>Date</div>
                  {showDrillOccupancy && (
                    <>
                      <div style={{ ...styles.tableHeaderCell, color: "#7BAFD4" }}>My Occ %</div>
                      <div style={{ ...styles.tableHeaderCell, color: '#f59e0b' }}>Comp Occ %</div>
                    </>
                  )}
                  {showDrillADR && (
                    <>
                      <div style={{ ...styles.tableHeaderCell, color: "#7BAFD4" }}>My ADR</div>
                      <div style={{ ...styles.tableHeaderCell, color: '#f59e0b' }}>Comp ADR</div>
                    </>
                  )}
                  {showDrillRevPAR && (
                    <>
                      <div style={{ ...styles.tableHeaderCell, color: "#7BAFD4" }}>My RevPAR</div>
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
                      borderBottom: `1px solid ${R.sep}`,
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(57, 189, 248, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={styles.tableCell}>{row.date}</div>
                    {showDrillOccupancy && (
                      <>
                        <div style={styles.tableCell}>
                          <span style={{ color: row.myOcc > row.compOcc ? '#10b981' : R.accent }}>
                            {row.myOcc}%
                          </span>
                        </div>
                        <div style={{ ...styles.tableCell, color: R.textMid }}>{row.compOcc}%</div>
                      </>
                    )}
                    {showDrillADR && (
                      <>
                        <div style={styles.tableCell}>
                          <span style={{ color: row.myRate > row.compRate ? '#10b981' : row.myRate < row.compRate - 10 ? '#ef4444' : R.accent }}>
                            {currencySymbol}{row.myRate}
                          </span>
                        </div>
                        <div style={{ ...styles.tableCell, color: R.textMid }}>{currencySymbol}{row.compRate}</div>
                      </>
                    )}
                    {showDrillRevPAR && (
                      <>
                        <div style={styles.tableCell}>
                          <span style={{ color: row.myRevPAR > row.compRevPAR ? '#10b981' : '#ef4444' }}>
                            {currencySymbol}{row.myRevPAR}
                          </span>
                        </div>
                        <div style={{ ...styles.tableCell, color: R.textMid }}>{currencySymbol}{row.compRevPAR}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>

          {/* ── Right Column: Insights Sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Key Insights */}
            {(() => {
              const myOcc = kpis.yourHotel?.occupancy != null ? Math.round(Number(kpis.yourHotel.occupancy) * 100) : null;
              const compOcc = kpis.market?.occupancy != null ? Math.round(Number(kpis.market.occupancy) * 100) : null;
              const myAdr = kpis.yourHotel?.adr != null ? Math.round(Number(kpis.yourHotel.adr)) : null;
              const compAdr = kpis.market?.adr != null ? Math.round(Number(kpis.market.adr)) : null;
              const myRev = kpis.yourHotel?.revpar != null ? Math.round(Number(kpis.yourHotel.revpar)) : null;
              const compRev = kpis.market?.revpar != null ? Math.round(Number(kpis.market.revpar)) : null;

              const occResult: 'win' | 'tie' | 'loss' = myOcc != null && compOcc != null ? (myOcc > compOcc ? 'win' : myOcc === compOcc ? 'tie' : 'loss') : 'tie';
              const adrResult: 'win' | 'tie' | 'loss' = myAdr != null && compAdr != null ? (myAdr > compAdr ? 'win' : myAdr === compAdr ? 'tie' : 'loss') : 'tie';
              const revResult: 'win' | 'tie' | 'loss' = myRev != null && compRev != null ? (myRev > compRev ? 'win' : myRev === compRev ? 'tie' : 'loss') : 'tie';

              const segLabel = comparison === 'total-market' ? 'market' : 'segment';
              const insights = [
                {
                  label: 'Occupancy',
                  result: occResult,
                  detail: myOcc != null && compOcc != null
                    ? occResult === 'win'
                      ? <><span style={{ color: "#7BAFD4", fontWeight: 600 }}>+{myOcc - compOcc} pts</span> above {segLabel} average</>
                      : occResult === 'tie'
                        ? <>Matching {segLabel} average</>
                        : <><span style={{ color: R.gold, fontWeight: 600 }}>−{compOcc - myOcc} pts</span> below {segLabel} average</>
                    : <>No data</>
                },
                {
                  label: 'ADR',
                  result: adrResult,
                  detail: myAdr != null && compAdr != null
                    ? adrResult === 'win'
                      ? <><span style={{ color: "#7BAFD4", fontWeight: 600 }}>{currencySymbol}{myAdr - compAdr}</span> above {segLabel} average</>
                      : adrResult === 'tie'
                        ? <>Matching {segLabel} average</>
                        : <><span style={{ color: R.gold, fontWeight: 600 }}>{currencySymbol}{compAdr - myAdr}</span> below {segLabel} average</>
                    : <>No data</>
                },
                {
                  label: 'RevPAR',
                  result: revResult,
                  detail: myRev != null && compRev != null
                    ? revResult === 'win'
                      ? <><span style={{ color: "#7BAFD4", fontWeight: 600 }}>{currencySymbol}{myRev - compRev}</span> above {segLabel} average</>
                      : revResult === 'tie'
                        ? <>Matching {segLabel} average</>
                        : <><span style={{ color: R.gold, fontWeight: 600 }}>{currencySymbol}{compRev - myRev}</span> below {segLabel} average</>
                    : <>No data</>
                },
              ];

              return (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>Key Insights</div>
                  {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{ height: 80, backgroundColor: R.darkBand, borderRadius: 8, border: `1px solid ${R.border}` }} />
                      ))}
                    </div>
                  ) : insights.map((item) => {
                    const winning = item.result === 'win';
                    const accent = winning ? "#7BAFD4" : R.gold;
                    const Icon = winning ? TrendingUp : TrendingDown;
                    return (
                      <div key={item.label} style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <Icon size={15} color={accent} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: R.accent }}>{item.label}</span>
                        </div>
                        <p style={{ fontSize: 12, color: R.textMid, margin: 0, lineHeight: 1.5 }}>
                          {item.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Market Context */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>Market Context</div>
              <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18 }}>
              {marketContext ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: "Segment Hotels", value: marketContext.segmentHotels.toLocaleString() },
                    { label: "Segment Rooms", value: marketContext.segmentRooms.toLocaleString() },
                    { label: "Market Hotels", value: marketContext.marketHotels.toLocaleString() },
                    { label: "Market Rooms", value: marketContext.marketRooms.toLocaleString() },
                  ].map(m => (
                    <div key={m.label}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: R.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  Select a property to see market composition
                </div>
              )}
              </div>
            </div>

            {/* Market Position */}
            {(() => {
              const displayTotal = (t: number | undefined) => t != null ? t * 2 : undefined;
              const metrics = [
                { label: 'Occupancy', rank: ranking.occupancy?.rank, total: displayTotal(ranking.occupancy?.total) },
                { label: 'ADR', rank: ranking.adr?.rank, total: displayTotal(ranking.adr?.total) },
                { label: 'RevPAR', rank: ranking.revpar?.rank, total: displayTotal(ranking.revpar?.total) },
              ];

              return (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>Market Position</div>
                  <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {isLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {[1, 2, 3].map((i) => (
                          <div key={i}>
                            <div style={{ width: 80, height: 10, backgroundColor: R.border, borderRadius: 4, marginBottom: 8 }} />
                            <div style={{ height: 6, backgroundColor: R.border, borderRadius: 3 }} />
                          </div>
                        ))}
                      </div>
                    ) : metrics.map((m) => {
                      const hasData = m.rank != null && m.total != null && m.total > 0;
                      const pct = hasData ? Math.round(((m.total! - m.rank! + 1) / m.total!) * 100) : 0;

                      return (
                        <div key={m.label}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: R.textMid, fontWeight: 500 }}>{m.label}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>
                              {hasData ? `#${m.rank} of ${m.total}` : '—'}
                            </span>
                          </div>
                          <div style={{ height: 6, background: R.sidebar, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${hasData ? pct : 0}%`, background: R.warmTeal, borderRadius: 3, opacity: 0.5, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              );
            })()}

            {/* Tier Distribution */}
            {marketContext?.byTier && marketContext.byTier.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>Tier Distribution</div>
                <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18 }}>
                  {marketContext.byTier.map((item) => {
                    const pct = marketContext.marketHotels > 0 ? Math.round((item.count / marketContext.marketHotels) * 100) : 0;
                    const tierLabel = item.tier.replace(/[★☆⭐]/g, '').trim();
                    return (
                      <div key={item.tier} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 100, flexShrink: 0, fontSize: 11, color: R.textMid, fontWeight: 500, whiteSpace: 'nowrap' }}>{tierLabel}</div>
                        <div style={{ flex: 1, minWidth: 0, height: 6, background: R.sidebar, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: R.warmTeal, borderRadius: 3, opacity: 0.5 }} />
                        </div>
                        <div style={{ width: 28, flexShrink: 0, fontSize: 10, color: R.textMid, textAlign: 'right' }}>{item.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Neighbourhoods */}
            {marketContext?.byNeighborhood && marketContext.byNeighborhood.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>Neighbourhoods</div>
                <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: R.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Area</span>
                    <span style={{ fontSize: 10, color: R.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hotels</span>
                  </div>
                  {(neighborhoodsExpanded ? marketContext.byNeighborhood : marketContext.byNeighborhood.slice(0, 5)).map((item, i, arr) => (
                    <div key={item.area} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${R.sep}` : 'none' }}>
                      <span style={{ fontSize: 12, color: R.text }}>{item.area}</span>
                      <span style={{ fontSize: 12, color: R.textMid, fontVariantNumeric: 'tabular-nums' }}>{item.count}</span>
                    </div>
                  ))}
                  {marketContext.byNeighborhood.length > 5 && (
                    <button
                      onClick={() => setNeighborhoodsExpanded(!neighborhoodsExpanded)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', color: R.textMid, fontSize: 11, padding: 0 }}
                    >
                      <span style={{ display: 'inline-block', transform: neighborhoodsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', fontSize: 10 }}>&#9660;</span>
                      {neighborhoodsExpanded ? 'Show less' : `Show all ${marketContext.byNeighborhood.length} areas`}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}