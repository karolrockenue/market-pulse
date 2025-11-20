import { Activity, Info, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { Badge } from './ui/badge';
import { ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

interface VisualizerDay {
  date: string;
  occupancy: number;
  guardrailMin: number;
  rate: number;
  liveRate: number;
}

interface OccupancyVisualizerProps {
  selectedHotel: string;
  startDate: Date;
  hoveredDay?: number | null;
  data?: VisualizerDay[]; // [NEW] Accept real data
}

export function OccupancyVisualizer({ selectedHotel, startDate, hoveredDay, data = [] }: OccupancyVisualizerProps) {
  // [NEW] Transform real data for the visualizer
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(d => {
      const dateObj = new Date(d.date);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      return {
        date: dateObj,
        occupancy: d.occupancy || 0,
        available: 0, // Placeholder as raw capacity isn't in grid data yet
        isWeekend,
        sentinelRate: d.rate || 0,
        sRate: d.rate || 0, // Placeholder until Calculator is integrated here
        minRate: d.guardrailMin || 0,
        pmsRate: d.liveRate || 0, // [NEW] Mapped from liveRate
      };
    });
  }, [data]);
  
// Calculate statistics
  const getStats = (dataset: typeof chartData) => {
    if (dataset.length === 0) return { avgOccupancy: 0, minOccupancy: 0, maxOccupancy: 0, gaps: 0, avgRate: 0, minRate: 0, maxRate: 100, avgOcc30: 0, minRateDays: 0 };
    
    // 1. Average Occupancy (Next 30 Days)
    const next30 = dataset.slice(0, 30);
    const avgOcc30 = next30.length > 0 
      ? Math.round(next30.reduce((sum, d) => sum + d.occupancy, 0) / next30.length) 
      : 0;

    // 2. Count days where Current Rate (PMS) = Min Rate (Next 90 Days)
    // We assume dataset is already ~90 days based on parent logic, but we check all available.
    const minRateDays = dataset.filter(d => d.pmsRate <= d.minRate && d.pmsRate > 0).length;

    return {
      avgOccupancy: Math.round(
        dataset.reduce((sum, d) => sum + d.occupancy, 0) / dataset.length
      ),
      avgOcc30,     // [NEW]
      minRateDays,  // [NEW]
      minOccupancy: Math.min(...dataset.map(d => d.occupancy)),
      maxOccupancy: Math.max(...dataset.map(d => d.occupancy)),
      gaps: dataset.filter(d => d.occupancy < 50).length,
      avgRate: Math.round(
        dataset.reduce((sum, d) => sum + d.sentinelRate, 0) / dataset.length
      ),
      // Include PMS rates in the scale
      minRate: Math.min(...dataset.map(d => Math.min(d.sentinelRate, d.minRate, d.sRate, d.pmsRate))) || 0,
      maxRate: Math.max(...dataset.map(d => Math.max(d.sentinelRate, d.minRate, d.sRate, d.pmsRate))) || 100,
    };
  };

  const stats = getStats(chartData);

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Flowcast */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #2a2a2a', 
          borderRadius: '0.5rem', 
          overflow: 'hidden' 
        }}>
          {/* Header */}
          <CollapsibleTrigger style={{ 
            width: '100%', 
            borderBottom: '1px solid #2a2a2a', 
            padding: '1rem',
            cursor: 'pointer',
            background: 'transparent',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f1f1f'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ChevronDown 
                  style={{ 
                    width: '1rem', 
                    height: '1rem', 
                    color: '#faff6a',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }} 
                />
                <div style={{ 
                  width: '0.375rem', 
                  height: '0.375rem', 
                  borderRadius: '9999px', 
                  backgroundColor: '#faff6a' 
                }}></div>
<span style={{ 
                  color: '#e5e5e5', 
                  fontSize: '0.875rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em' 
                }}>Flowcast</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginRight: '2.5rem' }}>
                <Badge 
                  variant="outline" 
                  style={{
                    backgroundColor: 'rgba(74, 74, 72, 0.1)',
                    color: '#6b7280',
                    borderColor: 'rgba(74, 74, 72, 0.3)'
                  }}
                >
                  30D AVG: {stats.avgOcc30}%
                </Badge>
                <Badge 
                  variant="outline" 
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.3)'
                  }}
                >
                  Min Rate Days: {stats.minRateDays}
                </Badge>
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Bar Chart */}
          <CollapsibleContent>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ 
                position: 'relative', 
                height: '14rem', 
                backgroundColor: '#141410', 
                borderRadius: '0.25rem', 
                border: '1px solid rgba(250, 255, 106, 0.15)', 
                overflow: 'hidden' 
              }}>
                {/* Y-axis labels (Occupancy - Left) */}
                <div style={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  bottom: 0, 
                  width: '3rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  paddingTop: '0.75rem', 
                  paddingBottom: '0.75rem' 
                }}>
                  {[100, 75, 50, 25].map((val, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '0.5rem' }}>
                      <span style={{ fontSize: '10px', color: 'rgba(57, 189, 248, 0.6)', fontFamily: 'monospace' }}>{val}%</span>
                    </div>
                  ))}
                </div>

{/* Y-axis labels (Rate - Right) */}
                <div style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: 0, 
                  bottom: 0, 
                  width: '3.5rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  paddingTop: '0.75rem', 
                  paddingBottom: '0.75rem' 
                }}>
                  {(() => {
                    const range = stats.maxRate - stats.minRate || 1;
                    // Generate 4 equidistant labels from Max to Min
                    const labels = [
                      stats.maxRate,
                      Math.round(stats.maxRate - (range / 3)),
                      Math.round(stats.maxRate - (2 * range / 3)),
                      stats.minRate
                    ];
                    return labels.map((val, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '0.5rem' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(250, 255, 106, 0.6)', fontFamily: 'monospace' }}>£{val}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Guide lines */}
                <div style={{ 
                  position: 'absolute', 
                  left: '3rem', 
                  right: '3.5rem', 
                  top: 0, 
                  bottom: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  paddingTop: '0.75rem', 
                  paddingBottom: '0.75rem' 
                }}>
                  {[100, 75, 50, 25].map((val, idx) => (
                    <div key={idx} style={{ height: '1px', backgroundColor: '#2a2a2a' }}></div>
                  ))}
                </div>

                {/* Bars - BOTTOM LAYER */}
                <div style={{ 
                  position: 'absolute', 
                  left: '3rem', 
                  right: '3.5rem', 
                  top: '0.75rem', 
                  bottom: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'flex-end', 
                  gap: '2px' 
                }}>
                  {chartData.map((day, idx) => {
                    const dateStr = day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    const isHovered = hoveredDay !== null && hoveredDay !== undefined && idx === hoveredDay;
                    return (
                      <TooltipProvider key={idx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div style={{ 
                              flex: 1, 
                              display: 'flex', 
                              alignItems: 'flex-end', 
                              cursor: 'pointer', 
                              position: 'relative',
                              height: '100%' 
                            }}>
                              <div
                                style={{ 
                                  width: '100%', 
                                  backgroundColor: '#2a2a2a',
                                  height: `${Math.min(day.occupancy, 100)}%`,
                                  boxShadow: isHovered ? 'inset 0 0 12px rgba(57, 189, 248, 0.4)' : 'none',
                                  transition: 'box-shadow 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isHovered) {
                                    e.currentTarget.style.boxShadow = 'inset 0 0 12px rgba(57, 189, 248, 0.4)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isHovered) {
                                    e.currentTarget.style.boxShadow = 'none';
                                  }
                                }}
                              ></div>
                            </div>
                          </TooltipTrigger>
<TooltipContent 
                            className="[&_svg]:fill-[#3a3a3a]"
                            style={{ backgroundColor: '#1f1f1c', borderColor: '#3a3a3a', color: '#e5e5e5' }}
                          >
                            <div style={{ fontSize: '0.75rem' }}>
                              <div style={{ color: '#9ca3af', marginBottom: '0.25rem' }}>{dateStr}</div>
                              <div style={{ color: '#39BDF8', marginBottom: '0.25rem' }}>{Math.round(day.occupancy)}% occupied</div>
                              <div style={{ color: 'white', marginBottom: '0.25rem' }}>PMS Rate: £{day.pmsRate}</div>
                              <div style={{ color: '#ef4444' }}>Min: £{day.minRate}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>

 
{/* Rate Dots Overlay - TOP LAYER */}
                <div style={{ 
                  position: 'absolute', 
                  left: '3rem', 
                  right: '3.5rem', 
                  top: '0.75rem', 
                  bottom: '0.75rem', 
                  display: 'flex', 
                  gap: '2px', 
                  pointerEvents: 'none' 
                }}>
                  {chartData.map((day, idx) => {
                    const range = stats.maxRate - stats.minRate || 1;
                    const rateHeight = ((day.pmsRate - stats.minRate) / range) * 100;
                    
                    return (
                      <div key={idx} style={{ flex: 1, position: 'relative', height: '100%' }}>
                        {/* Current Rate (white dots) */}
                        <div 
                          style={{ 
                            position: 'absolute', 
                            left: '50%', 
                            transform: 'translateX(-50%)', 
                            borderRadius: '9999px', 
                            backgroundColor: 'white', 
                            border: '1px solid #141410', 
                            width: '0.375rem', 
                            height: '0.375rem',
                            bottom: `${rateHeight}%` 
                          }}
                        ></div>
                      </div>
                    );
                  })}
                </div>

{/* Min Rate Floor Line - FRONT LAYER (on top of everything) */}
                <svg 
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ 
                    position: 'absolute', 
                    left: '3rem', 
                    right: '3.5rem', 
                    top: '0.75rem', 
                    bottom: '0.75rem', 
                    pointerEvents: 'none',
                    width: 'calc(100% - 6.5rem)', 
                    height: 'calc(100% - 1.5rem)' 
                  }}
                >
                  {/* Draw individual min rate markers on each column */}
                  {chartData.map((day, idx) => {
                    const x = ((idx + 0.5) / chartData.length) * 100; // Center of each column
                    const range = stats.maxRate - stats.minRate || 1;
                    const y = 100 - ((day.minRate - stats.minRate) / range) * 100;
                    const lineWidth = (1 / Math.max(1, chartData.length)) * 80; // 80% of column width
                    
                    return (
                      <line
                        key={`minrate-${idx}`}
                        x1={x - lineWidth/2}
                        y1={y}
                        x2={x + lineWidth/2}
                        y2={y}
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        strokeOpacity="0.4"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Timeline - Dynamic based on data length */}
              {chartData.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginTop: '1rem', 
                  paddingLeft: '1rem', 
                  paddingRight: '1rem', 
                  fontSize: '10px', 
                  color: '#6b7280', 
                  fontFamily: 'monospace' 
                }}>
                  <span style={{ color: '#e5e5e5' }}>{chartData[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  {chartData.length > 30 && <span>{chartData[Math.floor(chartData.length * 0.33)].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  {chartData.length > 30 && <span>{chartData[Math.floor(chartData.length * 0.66)].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  <span style={{ color: '#e5e5e5' }}>{chartData[chartData.length - 1].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}

              {/* Legend */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '1.5rem', 
                marginTop: '1rem', 
                fontSize: '0.75rem' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '0.75rem', 
                    height: '0.75rem', 
                    backgroundColor: '#39BDF8', 
                    borderRadius: '0.125rem' 
                  }}></div>
                  <span style={{ color: '#9ca3af' }}>Occupancy %</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '0.5rem', 
                    height: '0.5rem', 
                    borderRadius: '9999px', 
                    backgroundColor: 'white', 
                    border: '1px solid #2a2a2a' 
                  }}></div>
                  <span style={{ color: '#9ca3af' }}>Current Rate</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '0.5rem', 
                    height: '0.5rem', 
                    borderRadius: '9999px', 
                    backgroundColor: '#39BDF8', 
                    border: '1px solid #2a2a2a' 
                  }}></div>
                  <span style={{ color: '#9ca3af' }}>S-Rate</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ 
                    width: '0.75rem', 
                    height: '0.125rem', 
                    backgroundColor: '#ef4444', 
                    opacity: 0.6,
                    borderTop: '1.5px dashed #ef4444' 
                  }}></div>
                  <span style={{ color: '#9ca3af' }}>Min Rate Floor</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
