// [MODIFIED] Imported useEffect, useState, and toast
import { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  ArrowDown,
  ArrowUp,
  AlertCircle,
  Activity,
  Target,
  Clock,
  DollarSign,
  Bed,
  Filter,
  Calendar,
  TrendingDown,
  Building2,
  Search,
  Check,
  ChevronsUpDown,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  User
} from 'lucide-react';
import { Badge } from './ui/badge';
import { LineChart, Line, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
// [MODIFIED] Import toast for error notifications
import { toast } from 'sonner';

// --- Quadrant → Color map (canonical, do NOT recompute quadrant from x/y) ---
const QUADRANT_COLORS: Record<string, string> = {
  'Critical Risk': '#ef4444',   // red
  'Fill Risk': '#f59e0b',       // orange
  'Rate Strategy Risk': '#faff6a', // yellow
  'On Pace': '#10b981',         // green
};

// Robust normalizer: trims, collapses whitespace, normalizes Unicode.
// This prevents invisible differences like "Fill Risk" (NBSP) or trailing spaces.
function normalizeQuadrant(q: unknown): string {
  if (typeof q !== 'string') return '';
  return q
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function colorForQuadrant(q: unknown): string {
  const key = normalizeQuadrant(q);
  return QUADRANT_COLORS[key] ?? '#9ca3af'; // neutral grey fallback
}
// --- Robust numeric parser: handles numbers, "52.3", "52.3%", " 52 ", null/undefined ---
function num(val: any): number {
  if (val == null) return NaN;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.+-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

// --- Normalize quadrant text safely ---
function normQuad(q: any): string {
  return (typeof q === 'string' ? q.normalize('NFKC') : '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Choose color from payload: [FIXED & DEBUGGED] ---
// The logic now *only* uses X/Y coordinates to guarantee alignment.
// A console.log has been added to debug invalid data.
function colorFromPayload(payload: any): string {

  const x = num(payload?.forwardOccupancy ?? payload?.forward_occupancy ?? payload?.x);
  const y = num(payload?.pacingDifficultyPercent ?? payload?.pacing_difficulty_percent ?? payload?.y);
  const hotelName = payload?.hotelName ?? 'Unknown Hotel';

  // Use neutral grey for any invalid data points
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.warn(`[DOT DEBUG] ${hotelName}: SKIPPED (Invalid Coords)`, { x, y });
    return '#9ca3af'; // Grey
  }

  // Reference lines: x=60, y=115
  // Y-axis is reversed, so y < 115 is the TOP half.
  
  // Top-Left (Fill Risk / Need Volume)
  if (x < 60 && y < 115) {
    // console.log(`[DOT DEBUG] ${hotelName}: Top-Left (Orange)`, { x, y });
    return '#f59e0b';   // Orange
  }

  // Bottom-Left (Critical Risk)
  if (x < 60 && y >= 115) {
    // console.log(`[DOT DEBUG] ${hotelName}: Bottom-Left (Red)`, { x, y });
    return '#ef4444';   // Red
  }
  
  // Bottom-Right (Rate Strategy / Selling too cheap)
  if (x >= 60 && y >= 115) {
    // console.log(`[DOT DEBUG] ${hotelName}: Bottom-Right (Yellow)`, { x, y });
    return '#faff6a';  // Yellow
  }

  // Top-Right (On Pace)
  // console.log(`[DOT DEBUG] ${hotelName}: Top-Right (Green)`, { x, y });
  return '#10b981';                            // Green
}
// Custom shape: color each dot directly from its payload
const DotByPayload = (props: any) => {
  const { cx, cy, r = 5, payload } = props;
  if (cx == null || cy == null) return null;
  const fill = colorFromPayload(payload);
  return <circle cx={cx} cy={cy} r={r} fill={fill} />;
};


// Custom dot that ALWAYS uses the color passed in by <Cell>
const DotShape = (props: any) => {
  const { cx, cy, r = 4, fill, stroke, strokeWidth = 0 } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};


// --- [NEW] INLINE STYLE OBJECTS ---
// These objects replace the Tailwind utility classes
const styles = {
  // [MODIFIED] FONT SIZES ARE SCALED DOWN
  pageWrapper: {
    minHeight: '100vh',
    backgroundColor: '#252521',
    padding: '24px', // p-6
  },
  mb6: { marginBottom: '24px' }, // mb-6
  mb8: { marginBottom: '32px' }, // mb-8
  mb4: { marginBottom: '16px' }, // mb-4
  mb3: { marginBottom: '12px' }, // mb-3
  mb2: { marginBottom: '8px' }, // mb-2
  mb1: { marginBottom: '4px' }, // mb-1
  mt4: { marginTop: '16px' }, // mt-4
  mt6: { marginTop: '24px' }, // mt-6
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  h1: { color: '#e5e5e5', fontSize: '22px' }, // Was 24px
  h2: { color: '#e5e5e5', fontSize: '18px' }, // Was 20px
  h3: { color: '#e5e5e5', fontSize: '15px' }, // Default was larger
  pSubtle: { color: '#9ca3af', fontSize: '13px' }, // Was default
  pSmall: { color: '#9ca3af', fontSize: '13px' }, // Was 14px
  pXSmall: { color: '#9ca3af', fontSize: '11px' }, // Was 12px
  grid4: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '16px',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
  grid7: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: '16px',
  },
  grid12: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    gap: '16px',
  },
  colSpan1: { gridColumn: 'span 1 / span 1' },
  colSpan2: { gridColumn: 'span 2 / span 2' },
  colSpan3: { gridColumn: 'span 3 / span 3' },
  card: {
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '8px',
    padding: '16px',
  },
  cardPadded: { // p-6
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '8px',
    padding: '24px',
  },
  cardCriticalBorder: {
    backgroundColor: '#262626',
    border: '1px solid rgba(239, 68, 68, 0.2)', // border-[#ef4444]/20
    borderRadius: '8px',
    padding: '16px',
  },
  cardModerateBorder: {
    backgroundColor: '#262626',
    border: '1px solid rgba(245, 158, 11, 0.2)', // border-[#f59e0b]/20
    borderRadius: '8px',
    padding: '16px',
  },
  cardYellowBorder: { // For Rate Strategy Risk
    backgroundColor: '#262626',
    border: '1px solid rgba(250, 255, 106, 0.3)', // border-[#faff6a]/30
    borderRadius: '8px',
    padding: '16px',
  },
  cardOrangeBorder: { // For Fill Risk
    backgroundColor: '#262626',
    border: '1px solid rgba(245, 158, 11, 0.3)', // border-[#f59e0b]/30
    borderRadius: '8px',
    padding: '16px',
  },
  cardRedBorder: { // For Critical Risk
    backgroundColor: '#262626',
    border: '1px solid rgba(239, 68, 68, 0.3)', // border-red-500/30
    borderRadius: '8px',
    padding: '16px',
  },
  cardHeader: {
    paddingLeft: '16px', // px-4
    paddingRight: '16px', // px-4
    paddingTop: '12px', // py-3
    paddingBottom: '12px', // py-3
    backgroundColor: '#1f1f1c',
    borderBottom: '1px solid #3a3a35',
    fontSize: '11px', // Was 12px
    color: '#9ca3af',
  },
  cardRow: {
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '12px',
    paddingBottom: '12px',
    transition: 'background-color 0.2s',
  },
  cardRowHover: { // Simulating hover:bg-[#1f1f1c]
    // This requires JS, so we'll just set the base style.
    // The hover effect will be lost, which is a limitation of this approach.
    // We'll add a border-bottom instead.
    borderBottom: '1px solid #3a3a35'
  },
  textRight: { textAlign: 'right' as 'right' },
  textCenter: { textAlign: 'center' as 'center' },
  textXs: { fontSize: '11px' }, // Was 12px
  textSm: { fontSize: '13px' }, // Was 14px
  textLg: { fontSize: '18px' }, // Was 20px
  textXl: { fontSize: '22px' }, // Was 24px
  text2Xl: { fontSize: '24px' }, // Was 30px
  textWhite: { color: '#e5e5e5' },
  textRed: { color: '#ef4444' },
  textRedLight: { color: '#f87171' }, // text-red-400
  textOrange: { color: '#f59e0b' },
  textGreen: { color: '#10b981' },
  textYellow: { color: '#faff6a' },
  flex: { display: 'flex' },
  flexCol: { display: 'flex', flexDirection: 'column' as 'column' },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flexGap2: { display: 'flex', alignItems: 'center', gap: '8px' },
  flexGap3: { display: 'flex', alignItems: 'center', gap: '12px' },
  flexGap4: { display: 'flex', alignItems: 'center', gap: '16px' },
  flex1: { flex: '1 1 0%' },
  divideY: { borderBottom: '1px solid #3a3a35' }, // Simplified version
  spaceY1: { marginTop: '4px' }, // Simplified
  spaceY2: { marginTop: '8px' }, // Simplified
  spaceY4: { marginTop: '16px' }, // Simplified
  overflowHidden: { overflow: 'hidden' },
  overflowAuto: { overflow: 'auto' },
  overflowYAuto: { overflowY: 'auto' as 'auto' },
  maxH180: { maxHeight: '180px' },
  
  // Matrix Styles
  matrixControls: {
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matrixTableWrapper: {
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  matrixOverflow: { overflowX: 'auto' as 'auto' },
  matrixMinWidth: { display: 'inline-block', minWidth: '100%' },
  matrixHeaderRow: {
    display: 'flex',
    position: 'sticky' as 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: '#1f1f1c',
    borderBottom: '1px solid #3a3a35',
  },
  matrixStickyHeader: {
    position: 'sticky' as 'sticky',
    left: 0,
    zIndex: 20,
    backgroundColor: '#1f1f1c',
    borderRight: '1px solid #3a3a35',
    width: '256px', // w-64
    flexShrink: 0,
    padding: '12px 16px',
  },
matrixDateHeader: {
    width: '56px', // w-14
    flexShrink: 0,
    padding: '8px 4px', // py-2 px-1
    textAlign: 'center' as 'center',
  },
  matrixDateToday: {
    backgroundColor: 'rgba(250, 255, 106, 0.1)',
    borderLeft: '2px solid #faff6a',
  },
  matrixRow: {
    display: 'flex',
    borderBottom: '1px solid #3a3a35'
    // hover:bg-[#1f1f1c]/50 is not possible without JS listeners
  },
  matrixStickyCell: {
    position: 'sticky' as 'sticky',
    left: 0,
    zIndex: 10,
    backgroundColor: '#262626', // Base color
    // hover:bg-[#1f1f1c]/50 is not possible
    borderRight: '1px solid #3a3a35',
    width: '256px',
    flexShrink: 0,
    padding: '8px 16px',
  },
matrixDataCell: {
    width: '56px', // w-14
    flexShrink: 0,
    padding: '4px', // p-1
    textAlign: 'center' as 'center',
    position: 'relative' as 'relative',
  },
  matrixDataCellInner: {
    borderWidth: '1px',
    borderRadius: '4px',
    padding: '2px 4px',
    fontSize: '11px', // Was 12px
    position: 'relative' as 'relative',
  },
  matrixDataCellToday: {
    backgroundColor: 'rgba(250, 255, 106, 0.05)',
    borderLeft: '2px solid #faff6a',
  },
  matrixTooltip: {
    position: 'absolute' as 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: '100%',
    marginBottom: '4px',
    backgroundColor: '#1f1f1c',
    border: '1px solid #3a3a35',
    borderRadius: '8px',
    padding: '8px',
    zIndex: 30,
    opacity: 0, // Handled by group-hover
    pointerEvents: 'none' as 'none',
    transition: 'opacity 0.2s',
    whiteSpace: 'nowrap' as 'nowrap',
    fontSize: '11px', // Was 12px
  },

  // Quadrant Styles
  quadrantGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '24px',
  },
  quadrantChartWrapper: {
    gridColumn: 'span 2 / span 2',
    backgroundColor: '#262626',
    border: '1px solid #3a3a35',
    borderRadius: '8px',
    padding: '24px',
  },
  quadrantChartRelative: { position: 'relative' as 'relative', height: '520px' },
  quadrantOverlays: {
    position: 'absolute' as 'absolute',
    inset: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
    gap: '1px',
    pointerEvents: 'none' as 'none',
    zIndex: 0,
  },
  quadrantLabel: {
    position: 'absolute' as 'absolute',
    zIndex: 10,
    backgroundColor: 'rgba(31, 31, 28, 0.9)',
    borderRadius: '4px',
    padding: '6px 12px',
  },
  quadrantLegendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '9999px',
  },
  quadrantActionList: { gridColumn: 'span 1 / span 1', display: 'flex', flexDirection: 'column' as 'column', gap: '16px' },
  quadrantActionItem: {
    backgroundColor: '#1f1f1c',
    borderRadius: '4px',
    padding: '8px',
    border: '1px solid #3a3a35',
  },

  // Problem List (Side by Side)
  flexHalf: { display: 'flex', gap: '16px', marginBottom: '32px' },
  widthHalf: { width: '50%' },
  // [NEW] Loading overlay
  loadingOverlay: {
    position: 'absolute' as 'absolute',
    inset: 0,
    backgroundColor: 'rgba(37, 37, 33, 0.8)', // bg-[#252521]/80
    display: 'flex',
    flexDirection: 'column' as 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  loadingSpinner: {
    width: '48px', // w-12
    height: '48px', // h-12
    border: '4px solid #faff6a',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#faff6a',
    marginTop: '16px',
    fontSize: '13px', // Was 14px
  }
};
// --- [END] INLINE STYLES ---

// [MODIFIED] All mock data functions (generateHotelData, generateForwardPaceData, generateBudgetPacingData)
// and their direct calls (const hotels = ...) have been REMOVED.

// Helper functions for matrix
const getOccupancyColor = (value: number) => {
  if (value >= 100) return { backgroundColor: 'rgba(168, 85, 247, 0.3)', borderColor: 'rgba(168, 85, 247, 0.5)' }; // Overbooked
  if (value >= 80) return { backgroundColor: 'rgba(16, 185, 129, 0.3)', borderColor: 'rgba(16, 185, 129, 0.5)' }; // Excellent
  if (value >= 70) return { backgroundColor: 'rgba(250, 255, 106, 0.2)', borderColor: 'rgba(250, 255, 106, 0.3)' }; // Good
  if (value >= 50) return { backgroundColor: 'rgba(249, 115, 22, 0.2)', borderColor: 'rgba(249, 115, 22, 0.3)' }; // Fair
  if (value >= 40) return { backgroundColor: 'rgba(234, 88, 12, 0.3)', borderColor: 'rgba(234, 88, 12, 0.5)' }; // Warning
  return { backgroundColor: 'rgba(239, 68, 68, 0.3)', borderColor: 'rgba(239, 68, 68, 0.5)' }; // Critical
};

const getOccupancyTextColor = (value: number) => {
  if (value >= 100) return { color: '#c084fc' }; // text-purple-400
  if (value >= 80) return { color: '#34d399' }; // text-emerald-400
  if (value >= 70) return { color: '#faff6a' }; // text-[#faff6a]
  if (value >= 50) return { color: '#fb923c' }; // text-orange-400
  if (value >= 40) return { color: '#f97316' }; // text-orange-500
  return { color: '#f87171' }; // text-red-400
};

// Helper functions for pace variance
const getPaceVarianceColor = (variance: number) => {
  if (variance < -30) return { backgroundColor: 'rgba(239, 68, 68, 0.4)', borderColor: 'rgba(239, 68, 68, 0.6)' }; // Deep Red
  if (variance < -10) return { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }; // Light Red
  if (variance <= 10) return { backgroundColor: '#3a3a35', borderColor: '#4a4a45' }; // Grey
  return { backgroundColor: 'rgba(16, 185, 129, 0.3)', borderColor: 'rgba(16, 185, 129, 0.5)' }; // Green
};

const getPaceVarianceTextColor = (variance: number) => {
  if (variance < -30) return { color: '#f87171' }; // text-red-400
  if (variance < -10) return { color: '#fca5a5' }; // text-red-300
  if (variance <= 10) return { color: '#9ca3af' };
  return { color: '#34d399' }; // text-emerald-400
};

const detectAnomalies = (matrixData: any[]) => {
  const anomalies: { day: number; type: 'drop' | 'persistent' | 'overbooked' }[] = [];
  
  for (let i = 1; i < matrixData.length; i++) {
    const diff = matrixData[i - 1].occupancy - matrixData[i].occupancy;
    if (diff >= 15) {
      anomalies.push({ day: i, type: 'drop' });
    }
  }
  
  let lowCount = 0;
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy < 50) {
      lowCount++;
      if (lowCount >= 7 && !anomalies.some(a => a.day === i && a.type === 'persistent')) {
        anomalies.push({ day: i, type: 'persistent' });
      }
    } else {
      lowCount = 0;
    }
  }
  
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy > 100) {
      anomalies.push({ day: i, type: 'overbooked' });
    }
  }
  
  return anomalies;
};

// --- [NEW] Custom Tooltip for Quadrant Chart ---
const QuadrantTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: '#1f1f1c',
        border: '1px solid #faff6a',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        zIndex: 100,
      }}>
        <div style={{ color: '#e5e5e5', fontSize: '13px', marginBottom: '4px' }}>
          {data.hotelName}
        </div>
        <div style={{ ...styles.pXSmall, color: '#9ca3af' }}>
          Occ: <span style={styles.textWhite}>{data.forwardOccupancy.toFixed(1)}%</span>
        </div>
        <div style={{ ...styles.pXSmall, color: '#9ca3af' }}>
          Pressure: <span style={styles.textWhite}>{data.pacingDifficultyPercent.toFixed(1)}%</span>
        </div>
      </div>
    );
  }
  return null;
};

// --- [NEW] Custom Tooltip for Matrix Chart ---
// [MODIFIED] This tooltip is no longer needed as the matrix is rendered
// differently. We will keep the helper functions though.
// ... (MatrixTooltip component removed for brevity, it's unused)


export function PortfolioRiskOverview() {
  // --- [MODIFIED] State Declarations ---
  const [isLoading, setIsLoading] = useState(true);
  const [occupancyProblemList, setOccupancyProblemList] = useState<any[]>([]);
  const [pacingOverviewData, setPacingOverviewData] = useState<any[]>([]);
  const [occupancyMatrixData, setOccupancyMatrixData] = useState<any[]>([]);
  
  const [matrixMetric, setMatrixMetric] = useState<'occupancy' | 'adr' | 'available'>('occupancy');
  const [matrixDays, setMatrixDays] = useState<number>(45);
  const [sortByRisk, setSortByRisk] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedHotel, setSelectedHotel] = useState<string>('all');
  const [hotelSearchOpen, setHotelSearchOpen] = useState(false);
  
const [globalSelectedGroup, setGlobalSelectedGroup] = useState<string>('all');
  const [globalSelectedHotel, setGlobalSelectedHotel] = useState<string>('all');
  const [globalHotelSearchOpen, setGlobalHotelSearchOpen] = useState(false); // <-- ADD THIS LINE
const [viewType, setViewType] = useState<'group' | 'individual'>('group');
  const [allHotels, setAllHotels] = useState<any[]>([]); // For populating filters

  // [NEW] Memoized hook to get unique group names for filters
  const globalHotelGroups = useMemo(() => {
    const groups = new Set(allHotels.map(h => h.management_group).filter(Boolean));
    return Array.from(groups).sort();
  }, [allHotels]);

useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // --- [NEW] Build query params from global filters ---
        const params = new URLSearchParams();
        if (globalSelectedHotel !== 'all') {
          params.append('hotelId', globalSelectedHotel);
        } else if (globalSelectedGroup !== 'all') {
          params.append('group', globalSelectedGroup);
        }
        const queryString = params.toString();
        const query = queryString ? `?${queryString}` : '';
        // --- [END NEW] ---

        const [occProblemRes, pacingRes, matrixRes] = await Promise.all([
          // [MODIFY] Append query string to all fetch calls
          fetch(`/api/portfolio/occupancy-problem-list${query}`),
          fetch(`/api/portfolio/pacing-overview${query}`),
          fetch(`/api/portfolio/occupancy-matrix${query}`)
        ]);

        if (!occProblemRes.ok) throw new Error('Failed to fetch occupancy problem list');
        if (!pacingRes.ok) throw new Error('Failed to fetch pacing overview');
        if (!matrixRes.ok) throw new Error('Failed to fetch occupancy matrix');

        const occProblemData = await occProblemRes.json();
        const pacingData = await pacingRes.json();
        const matrixData = await matrixRes.json();
        
        setOccupancyProblemList(occProblemData);
        setPacingOverviewData(pacingData);
        setOccupancyMatrixData(matrixData);

        // --- [NEW DEBUGGING LINE 1] ---
        console.log('--- ENTIRE PACING ARRAY ---', pacingData);
        // --- [END DEBUGGING LINE 1] ---

        // --- [NEW] DEBUG LOG FOR ELYSEE HYDE PARK ---
        // Find the specific hotel in the newly fetched data
        const hotelToDebug = pacingData.find(
          (h: any) => h.hotelName === 'The Cleveland Hotel'
        );
        
        if (hotelToDebug) {
          console.log('--- [DEBUG] The Cleveland Hotel FINAL QUADRANT LOGIC ---', {
            property_name: hotelToDebug.hotelName,
            fwdOcc: hotelToDebug.forwardOccupancy,
            currentMonthStatus: hotelToDebug.currentMonthStatus,
            pacingDifficultyPercent: hotelToDebug.pacingDifficultyPercent
          });
        } else {
          console.warn('--- [DEBUG] The Cleveland ---', 'Hotel not found in pacing data array.');
        }
        // --- [END NEW DEBUG LOG] ---

      } catch (error: any) {
        console.error("Error fetching portfolio data:", error);
        toast.error('Failed to load portfolio data', { description: error.message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
}, [globalSelectedGroup, globalSelectedHotel]); // [MODIFY] Re-run when global filters change


  // --- [NEW] Data Fetching Effect for Filters ---
  // Fetches all hotels *once* to populate the global filter dropdowns
  useEffect(() => {
    const fetchAllHotels = async () => {
      try {
        // Use the admin endpoint to get a simple list of all hotels
        const response = await fetch('/api/admin/get-all-hotels'); //
        if (!response.ok) {
          throw new Error('Failed to fetch hotel list for filters');
        }
        const data = await response.json();
        setAllHotels(data);
      } catch (error: any) {
        console.error("Error fetching filter data:", error);
        toast.error('Failed to load filter options', { description: error.message });
      }
    };
    fetchAllHotels();
  }, []); // Empty dependency array ensures this runs only once

// Get unique hotel groups from the matrix data
  // [REMOVED] This line is no longer needed, we use 'globalHotelGroups'
  // const hotelGroups = Array.from(new Set(occupancyMatrixData.map(h => h.group))).sort();
  
  // Generate dates for matrix columns
  const matrixDates = Array.from({ length: matrixDays }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
  
  // Filter hotels by selected group and specific hotel
  let filteredHotels = occupancyMatrixData;
  
  if (selectedHotel !== 'all') {
    filteredHotels = occupancyMatrixData.filter(h => h.name === selectedHotel);
  } 
  else if (selectedGroup !== 'all') {
    filteredHotels = occupancyMatrixData.filter(h => h.group === selectedGroup);
  }
  
  const sortedHotels = sortByRisk
    ? [...filteredHotels].sort((a, b) => {
        // [MODIFIED] Sort logic now uses the avg occupancy from the API data
        const aRisk = a.occupancy < 45 ? 0 : a.occupancy < 60 ? 1 : 2;
        const bRisk = b.occupancy < 45 ? 0 : b.occupancy < 60 ? 1 : 2;
        if (aRisk !== bRisk) return aRisk - bRisk;
        return a.occupancy - b.occupancy;
      })
    : filteredHotels;

  // Calculate average occupancy for the header card
  const avgPortfolioOcc = occupancyMatrixData.length > 0
    ? occupancyMatrixData.reduce((sum, h) => sum + h.occupancy, 0) / occupancyMatrixData.length
    : 0;

  return (
    <div style={{...styles.pageWrapper, position: 'relative'}}>
      {/* [NEW] Loading Overlay */}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading Portfolio Intelligence...</p>
        </div>
      )}

      {/* Page Header */}
      <div style={styles.mb6}>
        <div style={styles.header}>
          <AlertTriangle className="w-6 h-6 text-[#faff6a]" />
          <h1 style={styles.h1}>Portfolio Risk Overview</h1>
        </div>
<p style={styles.pSubtle}>
          Next 30-day availability risk across all managed properties • Identify underperforming hotels requiring immediate action
        </p>
      </div> {/* [MODIFIED] This closes the header div, which was missing in your file */}
      {/* [NEW] Global Filter Bar (Prototype-Aligned) */}
      <div style={{
        marginBottom: '24px',
        backgroundColor: '#262626',
        borderRadius: '8px',
        border: '1px solid #3a3a35',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* [FIX] Correct 2-Button Toggle */}
        <div style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: '#1a1a18',
          borderRadius: '8px',
          padding: '4px'
        }}>
          <button
            onClick={() => {
              setViewType('group');
              setGlobalSelectedHotel('all');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: viewType === 'group' ? '#faff6a' : 'transparent',
              color: viewType === 'group' ? '#1a1a18' : '#9ca3af'
            }}
          >
            <Building2 className="w-3.5 h-3.5" />
            Group/Portfolio
          </button>
          <button
            onClick={() => {
              setViewType('individual');
              setGlobalSelectedGroup('all');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              border: 'none',
              backgroundColor: viewType === 'individual' ? '#faff6a' : 'transparent',
              color: viewType === 'individual' ? '#1a1a18' : '#9ca3af'
            }}
          >
            <User className="w-3.5 h-3.5" />
            Individual Hotel
          </button>
        </div>

        <div style={{ height: '24px', width: '1px', backgroundColor: '#3a3a35' }} />

        {/* [FIXED] Conditional Dropdown */}
        {viewType === 'individual' ? (
          /* Individual Hotel Filter (Popover) */
          <Popover open={globalHotelSearchOpen} onOpenChange={setGlobalHotelSearchOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-[240px] justify-between bg-[#1a1a18] border border-[#3a3a35] text-[#e5e5e5] h-9 px-3 rounded text-xs flex items-center gap-2 hover:border-[#faff6a]/50 transition-colors"
                role="combobox"
                aria-expanded={globalHotelSearchOpen}
              >
                <div style={{ ...styles.flexGap2, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <User className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {globalSelectedHotel === 'all'
                      ? 'Select Hotel...'
                      : allHotels.find(h => h.hotel_id.toString() === globalSelectedHotel)?.property_name || 'Select Hotel...'
                    }
                  </span>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-[#9ca3af] flex-shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 bg-[#1f1f1c] border-[#3a3a35]" align="start">
              <Command className="bg-[#1f1f1c]">
                <CommandInput placeholder="Type to search hotels..." className="text-[#e5e5e5] placeholder:text-[#9ca3af]" />
                <CommandList>
                  <CommandEmpty className="text-[#9ca3af] text-sm py-6 text-center">No hotel found.</CommandEmpty>
<CommandGroup>
                    {/* [FIX] Added null checks to prevent crash */}
                    {allHotels.map((hotel) => (
                      <CommandItem
                        key={hotel.hotel_id}
                        value={hotel.property_name || `Hotel ${hotel.hotel_id}`} // Handles null property_name
                        onSelect={() => {
                          setGlobalSelectedHotel(hotel.hotel_id.toString());
                          setGlobalHotelSearchOpen(false);
                        }}
                        className="text-[#e5e5e5] aria-selected:bg-[#262626] aria-selected:text-[#faff6a]"
                      >
                        <Check className={`mr-2 h-4 w-4 ${globalSelectedHotel === hotel.hotel_id.toString() ? 'opacity-100' : 'opacity-0'}`} />
                        <div style={styles.flexCol}>
                          <span>{hotel.property_name || `Hotel ${hotel.hotel_id}`}</span>
                          <span style={{ ...styles.textXs, color: '#6b7280' }}>{hotel.management_group || 'No Group'}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          /* Group Filter (Select) */
          <Select
            value={globalSelectedGroup}
            onValueChange={(value) => {
              setGlobalSelectedGroup(value);
              setGlobalSelectedHotel('all');
            }}
          >
            <SelectTrigger className="w-[240px] bg-[#1a1a18] border-[#3a3a35] text-[#e5e5e5] h-9 text-xs">
              <div style={styles.flexGap2}>
                <Building2 className="w-3.5 h-3.5 text-[#9ca3af]" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-[#262626] border-[#3a3a35]">
              {/* This is the "All Portfolio" option, as requested */}
              <SelectItem value="all" className="text-[#e5e5e5] focus:bg-[#1a1a18] focus:text-[#faff6a] text-xs">
                All Portfolio ({globalHotelGroups.length} groups, {allHotels.length} hotels)
              </SelectItem>
              {globalHotelGroups.map(group => (
                <SelectItem key={group} value={group} className="text-[#e5e5e5] focus:bg-[#1a1a18] focus:text-[#faff6a] text-xs">
                  {group} ({allHotels.filter(h => h.management_group === group).length} hotels)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div style={{ flex: '1 1 0%' }} />

        {/* [FIXED] Display badge showing current selection */}
        <div style={{
          backgroundColor: '#1a1a18',
          border: '1px solid #3a3a35',
          borderRadius: '8px',
          padding: '6px 12px'
        }}>
          <div style={styles.flexGap2}>
            <div style={{ width: '6px', height: '6px', borderRadius: '99px', backgroundColor: '#10b981' }}></div>
            <span style={{ ...styles.textXs, color: '#9ca3af' }}>
              Viewing: <span style={{ color: '#faff6a' }}>
                {viewType === 'individual'
                  ? (globalSelectedHotel === 'all'
                    ? 'All Individual Hotels' 
                    : allHotels.find(h => h.hotel_id.toString() === globalSelectedHotel)?.property_name)
                  : (globalSelectedGroup === 'all'
                    ? 'All Portfolio'
                    : globalSelectedGroup)
                }
              </span>
              <span style={{ ...styles.textXs, color: '#6b7280', marginLeft: '4px' }}>
                ({occupancyMatrixData.length} hotels)
              </span>
            </span>
          </div>
        </div>
      </div>

{/* Summary Stats */}
        {/* [MODIFIED] All logic now uses 'pacingOverviewData' to match the chart */}
        <div style={{...styles.grid4, ...styles.mt4}}>
          <div style={styles.card}>
            <div style={{...styles.pXSmall, ...styles.mb1}}>Portfolio Hotels</div>
            {/* [FIX] Use pacingOverviewData.length */}
            <div style={styles.text2Xl}>{pacingOverviewData.length}</div>
          </div>
          <div style={styles.cardCriticalBorder}>
            <div style={{...styles.pXSmall, ...styles.mb1}}>Critical Risk</div>
            {/* [FIX] Recalculate using pacingOverviewData and the card's own <45% rule */}
            <div style={{...styles.text2Xl, ...styles.textRed}}>
              {pacingOverviewData.filter(h => num(h.forwardOccupancy) < 45).length}
            </div>
            <div style={{...styles.pXSmall, marginTop: '4px'}}>{'<45% occupancy'}</div>
          </div>
          <div style={styles.cardModerateBorder}>
            <div style={{...styles.pXSmall, ...styles.mb1}}>Moderate Risk</div>
            {/* [FIX] Recalculate using pacingOverviewData and the card's own 45-60% rule */}
            <div style={{...styles.text2Xl, ...styles.textOrange}}>
              {pacingOverviewData.filter(h => {
                const occ = num(h.forwardOccupancy);
                return occ >= 45 && occ < 60;
              }).length}
            </div>
            <div style={{...styles.pXSmall, marginTop: '4px'}}>45-60% occupancy</div>
          </div>
          <div style={styles.card}>
            <div style={{...styles.pXSmall, ...styles.mb1}}>Avg Portfolio Occ.</div>
            <div style={styles.text2Xl}>
              {/* [FIX] Recalculate using pacingOverviewData */}
              {(pacingOverviewData.length > 0
                ? pacingOverviewData.reduce((sum, h) => sum + num(h.forwardOccupancy), 0) / pacingOverviewData.length
                : 0
              ).toFixed(0)}%
            </div>
          </div>
        </div>
 

      {/* Risk Quadrant Chart */}
      <div style={styles.mb8}>
        <div style={styles.mb4}>
          <h2 style={styles.h2}>Risk Quadrant Chart</h2>
          <p style={styles.pSmall}>Strategic diagnostic tool • Combines volume and budget pacing risk</p>
        </div>

        <div style={styles.quadrantGrid}>
          {/* Scatter Plot */}
          <div style={styles.quadrantChartWrapper}>
            <div style={styles.quadrantChartRelative}>
              {/* Quadrant Background Overlays */}
              <div style={styles.quadrantOverlays}>
                <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.03)' }}></div> {/* Fill Risk */}
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.03)' }}></div> {/* On Pace */}
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.03)' }}></div> {/* Critical Risk */}
                <div style={{ backgroundColor: 'rgba(250, 255, 106, 0.03)' }}></div> {/* Rate Strategy Risk */}
              </div>
{/* Quadrant Labels */}
              
              {/* Top-Left: Need Volume (Bad Volume, Good Stress) */}
              <div style={{...styles.quadrantLabel, top: '16px', left: '16px', border: '1px solid rgba(245, 158, 11, 0.4)'}}>
                <div style={styles.flexGap2}>
                  <div style={{...styles.quadrantLegendDot, backgroundColor: '#f59e0b'}}></div>
                  <span style={{...styles.textXs, color: '#f59e0b'}}>Need Volume</span>
                </div>
              </div>

              {/* Top-Right: On Pace (Good Volume, Good Stress) */}
              <div style={{...styles.quadrantLabel, top: '16px', right: '16px', border: '1px solid rgba(16, 185, 129, 0.4)'}}>
                <div style={styles.flexGap2}>
                  <div style={{...styles.quadrantLegendDot, backgroundColor: '#10b981'}}></div>
                  <span style={{...styles.textXs, color: '#10b981'}}>On Pace</span>
                </div>
              </div>

              {/* Bottom-Left: Critical Risk (Bad Volume, Bad Stress) */}
              <div style={{...styles.quadrantLabel, bottom: '16px', left: '16px', border: '1px solid rgba(239, 68, 68, 0.4)'}}>
                <div style={styles.flexGap2}>
                  <div style={{...styles.quadrantLegendDot, backgroundColor: '#ef4444'}}></div>
                  <span style={{...styles.textXs, color: '#ef4444'}}>Critical Risk</span>
                </div>
              </div>

              {/* Bottom-Right: Selling too cheap (Good Volume, Bad Stress) */}
              <div style={{...styles.quadrantLabel, bottom: '16px', right: '16px', border: '1px solid rgba(250, 255, 106, 0.4)'}}>
                <div style={styles.flexGap2}>
                  <div style={{...styles.quadrantLegendDot, backgroundColor: '#faff6a'}}></div>
                  <span style={{...styles.textXs, color: '#faff6a'}}>Selling too cheap</span>
                </div>
              </div>

              {/* Chart */}


<ResponsiveContainer width="100%" height="100%" style={{position: 'relative', zIndex: 5}}>
         <ScatterChart margin={{ top: 30, right: 30, bottom: 60, left: 80 }}>


                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" />
                  <XAxis 
                    type="number" 
                    dataKey="forwardOccupancy" 
                    name="Forward Volume (Occupancy %)"
                    domain={[20, 90]}
                    ticks={[20, 30, 40, 50, 60, 70, 80, 90]}
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    label={{ 
                      value: 'Forward Volume (Occupancy %)', 
                      position: 'bottom', 
                      fill: '#e5e5e5', 
                      offset: 30,
                      style: { fontSize: 13 }
                    }}
                  />
<YAxis 
                    type="number" 
                    dataKey="pacingDifficultyPercent" 
                    name="Pacing Rate Pressure (%)"
                    
                    /* This is the prop that inverts the axis */
                    reversed={true} 
                    
                    /* Set a normal (low-to-high) domain */
                    domain={[50, 500]}
                    
                    /* Ticks must also be in normal order */
                    ticks={[50, 115, 200, 300, 400, 500]}
                    
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    label={{ 
                      value: 'Pacing Rate Pressure (%)', 
                      angle: -90, 
                      position: 'insideLeft', 
                      fill: '#e5e5e5',
                      offset: -50,
                      style: { fontSize: 13, textAnchor: 'middle' }
                    }}
                  />
                  <ZAxis range={[100, 100]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3', stroke: '#faff6a' }}
                    content={<QuadrantTooltip />}
                  />
                  
                  {/* Reference Lines - Manually set based on domains */}
                  <ReferenceLine y={115} stroke="#faff6a" strokeWidth={1} strokeDasharray="5 5" />
                  <ReferenceLine x={60} stroke="#faff6a" strokeWidth={1} strokeDasharray="5 5" />
                  
                  {/* [MODIFIED] Data source is now the state variable */}
<Scatter
  name="Hotels"
  data={pacingOverviewData}
  shape={DotByPayload}   // <- uses payload to color each dot
/>






                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Y-axis Subtitle */}
            <div style={{ position: 'absolute', bottom: '110px', left: '10px', zIndex: 10 }}>
              <div style={{ color: '#9ca3af', fontSize: '10px', transform: 'rotate(-90deg)', transformOrigin: 'left', whiteSpace: 'nowrap' }}>
                (Required ADR vs. Benchmark ADR)
              </div>
            </div>

            {/* Summary Stats */}
            <div style={{...styles.grid4, ...styles.mt6, paddingTop: '16px', borderTop: '1px solid #3a3a35'}}>
              <div style={styles.textCenter}>
                <div style={{...styles.text2Xl, ...styles.textRed, ...styles.mb1}}>
                  {pacingOverviewData.filter(d => d.quadrant === 'Critical Risk').length}
                </div>
                <div style={styles.textXs}>Critical Risk</div>
              </div>
              <div style={styles.textCenter}>
                <div style={{...styles.text2Xl, ...styles.textYellow, ...styles.mb1}}>
                  {pacingOverviewData.filter(d => d.quadrant === 'Rate Strategy Risk').length}
                </div>
                <div style={styles.textXs}>Rate Strategy Risk</div>
              </div>
              <div style={styles.textCenter}>
                <div style={{...styles.text2Xl, ...styles.textOrange, ...styles.mb1}}>
                  {pacingOverviewData.filter(d => d.quadrant === 'Fill Risk').length}
                </div>
                <div style={styles.textXs}>Fill Risk</div>
              </div>
              <div style={styles.textCenter}>
                <div style={{...styles.text2Xl, ...styles.textGreen, ...styles.mb1}}>
                  {pacingOverviewData.filter(d => d.quadrant === 'On Pace').length}
                </div>
                <div style={styles.textXs}>On Pace</div>
              </div>
            </div>
          </div>

          {/* Action Lists */}
          <div style={styles.quadrantActionList}>
            <div style={styles.cardRedBorder}>
              <div style={{...styles.flexGap2, ...styles.mb3}}>
                <AlertCircle className="w-5 h-5 text-red-400" />
                <h3 style={{color: '#f87171'}}>Critical Risk</h3>
              </div>
              <div style={{...styles.overflowYAuto, ...styles.maxH180, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {pacingOverviewData
                  .filter(h => h.quadrant === 'Critical Risk')
                  
                  .slice()
                  .sort((a, b) => b.pacingDifficultyPercent - a.pacingDifficultyPercent)
                  .map((hotel, index) => (
                    <div key={`critical-${hotel.hotelId}-${index}`} style={styles.quadrantActionItem}>
                      <div style={{...styles.textWhite, ...styles.textSm}}>{hotel.hotelName}</div>
                      <div style={{...styles.flexBetween, marginTop: '4px'}}>
                        <span style={styles.textXs}>Occ: {hotel.forwardOccupancy.toFixed(0)}%</span>
                        <span style={{...styles.textXs, color: '#f87171'}}>{hotel.pacingDifficultyPercent.toFixed(0)}% pressure</span>
                      </div>
                    </div>
                  ))}
                {pacingOverviewData.filter(h => h.quadrant === 'Critical Risk').length === 0 && (
                  <p style={{...styles.textXs, fontStyle: 'italic'}}>No hotels in critical risk</p>
                )}
              </div>
            </div>

     <div style={styles.cardYellowBorder}>
              <div style={{...styles.flexGap2, ...styles.mb3}}>
                <Target className="w-5 h-5 text-[#faff6a]" />
                <h3 style={{color: '#faff6a'}}>Selling too cheap</h3>
              </div>
              <div style={{...styles.overflowYAuto, ...styles.maxH180, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {pacingOverviewData
                  .filter(h => h.quadrant === 'Rate Strategy Risk')
                  .slice()
                  .sort((a, b) => b.pacingDifficultyPercent - a.pacingDifficultyPercent)
                  .map((hotel, index) => (
                    <div key={`rate-${hotel.hotelId}-${index}`} style={styles.quadrantActionItem}>
                      <div style={{...styles.textWhite, ...styles.textSm}}>{hotel.hotelName}</div>
                      <div style={{...styles.flexBetween, marginTop: '4px'}}>
                        <span style={styles.textXs}>Occ: {hotel.forwardOccupancy.toFixed(0)}%</span>
                        <span style={{...styles.textXs, color: '#faff6a'}}>{hotel.pacingDifficultyPercent.toFixed(0)}% pressure</span>
                      </div>
                    </div>
                  ))}
                {pacingOverviewData.filter(h => h.quadrant === 'Rate Strategy Risk').length === 0 && (
                  <p style={{...styles.textXs, fontStyle: 'italic'}}>No hotels with rate strategy risk</p>
                )}
              </div>
            </div>
<div style={styles.cardOrangeBorder}>
              <div style={{...styles.flexGap2, ...styles.mb3}}>
                <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
                <h3 style={{color: '#f59e0b'}}>Need Volume</h3>
              </div>
              <div style={{...styles.overflowYAuto, ...styles.maxH180, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {pacingOverviewData
                  .filter(h => h.quadrant === 'Fill Risk')
                  .slice()
                  .sort((a, b) => a.forwardOccupancy - b.forwardOccupancy)
                  .map((hotel, index) => (
                    <div key={`fill-${hotel.hotelId}-${index}`} style={styles.quadrantActionItem}>
                      <div style={{...styles.textWhite, ...styles.textSm}}>{hotel.hotelName}</div>
                      <div style={{...styles.flexBetween, marginTop: '4px'}}>
                        <span style={styles.textXs}>Occ: {hotel.forwardOccupancy.toFixed(0)}%</span>
                        <span style={{...styles.textXs, color: '#f59e0b'}}>{hotel.pacingDifficultyPercent.toFixed(0)}% pressure</span>
                      </div>
                    </div>
                  ))}
                {pacingOverviewData.filter(h => h.quadrant === 'Fill Risk').length === 0 && (
                  <p style={{...styles.textXs, fontStyle: 'italic'}}>No hotels with fill risk</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Occupancy Matrix */}
      <div style={styles.mb8}>
        <div style={styles.mb4}>
          <h2 style={styles.h2}>Occupancy Matrix</h2>
          <p style={styles.pSmall}>Dense at-a-glance view of all properties vs next 45 days • Visual anomaly detection</p>
        </div>

        {/* Controls Bar */}
        <div style={styles.matrixControls}>
          <div style={styles.flexGap4}>
            {/* Metric Toggle */}
            <div style={styles.flexGap2}>
              <Filter className="w-4 h-4 text-[#9ca3af]" />
      <button
                onClick={() => setMatrixMetric('occupancy')}
                className="px-3 py-1.5 rounded text-sm transition-all" // Use static classes for size
                style={{ // Use inline style ONLY for dynamic colors
                  cursor: 'pointer',
                  border: matrixMetric === 'occupancy' ? '1px solid #faff6a' : '1px solid #3a3a35',
                  backgroundColor: matrixMetric === 'occupancy' ? '#faff6a' : '#1f1f1c',
                  color: matrixMetric === 'occupancy' ? '#1d1d1c' : '#9ca3af'
                }}
              >
                Occupancy %
              </button>
              <button
                onClick={() => setMatrixMetric('adr')}
                className="px-3 py-1.5 rounded text-sm transition-all" // Use static classes for size
                style={{ // Use inline style ONLY for dynamic colors
                  cursor: 'pointer',
                  border: matrixMetric === 'adr' ? '1px solid #faff6a' : '1px solid #3a3a35',
                  backgroundColor: matrixMetric === 'adr' ? '#faff6a' : '#1f1f1c',
                  color: matrixMetric === 'adr' ? '#1d1d1c' : '#9ca3af'
                }}
              >
                ADR
              </button>
              <button
                onClick={() => setMatrixMetric('available')}
                className="px-3 py-1.5 rounded text-sm transition-all" // Use static classes for size
                style={{ // Use inline style ONLY for dynamic colors
                  cursor: 'pointer',
                  border: matrixMetric === 'available' ? '1px solid #faff6a' : '1px solid #3a3a35',
                  backgroundColor: matrixMetric === 'available' ? '#faff6a' : '#1f1f1c',
                  color: matrixMetric === 'available' ? '#1d1d1c' : '#9ca3af'
                }}
              >
                Rooms Available
              </button>
            </div>
 

            <button
              onClick={() => setSortByRisk(!sortByRisk)}
              className={`px-3 py-1.5 rounded text-sm transition-all ${
                sortByRisk
                  ? 'bg-[#ef4444] text-white'
                  : 'bg-[#1f1f1c] border border-[#3a3a35] text-[#9ca3af] hover:border-[#ef4444]/50'
              }`}
            >
              {sortByRisk ? 'Showing Highest Risk First' : 'Sort by Risk'}
            </button>
          </div>

          {/* Legend */}
          <div style={styles.flexGap4}>
            <div style={styles.flexGap2}>
              <div style={{width: '16px', height: '16px', ...getOccupancyColor(30), borderRadius: '4px'}}></div>
              <span style={styles.textXs}>{'<40%'}</span>
            </div>
            <div style={styles.flexGap2}>
              <div style={{width: '16px', height: '16px', ...getOccupancyColor(55), borderRadius: '4px'}}></div>
              <span style={styles.textXs}>40-70%</span>
            </div>
            <div style={styles.flexGap2}>
              <div style={{width: '16px', height: '16px', ...getOccupancyColor(75), borderRadius: '4px'}}></div>
              <span style={styles.textXs}>70-80%</span>
            </div>
            <div style={styles.flexGap2}>
              <div style={{width: '16px', height: '16px', ...getOccupancyColor(90), borderRadius: '4px'}}></div>
              <span style={styles.textXs}>80-100%</span>
            </div>
            <div style={styles.flexGap2}>
              <div style={{width: '16px', height: '16px', ...getOccupancyColor(101), borderRadius: '4px'}}></div>
              <span style={styles.textXs}>{'>100%'}</span>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div style={styles.matrixTableWrapper}>
          <div style={styles.matrixOverflow}>
            <div style={styles.matrixMinWidth}>
              {/* Header Row */}
              <div style={styles.matrixHeaderRow}>
                <div style={styles.matrixStickyHeader}>
                  <div style={styles.textXs}>Hotel</div>
                </div>
                
                <div style={styles.flex}>
                  {matrixDates.map((date, i) => {
                    const isToday = i === 0;
                    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const dayOfMonth = date.getDate();
                    const month = date.toLocaleDateString('en-US', { month: 'short' });
                    
                    return (
                      <div
                        key={i}
                        style={{...styles.matrixDateHeader, ...(isToday ? styles.matrixDateToday : {})}}
                      >
                        <div style={{fontSize: '10px', color: isToday ? '#faff6a' : '#6b7280'}}>
                          {dayOfWeek}
                        </div>
                        <div style={{...styles.textXs, color: isToday ? '#faff6a' : '#9ca3af'}}>
                          {month} {dayOfMonth}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hotel Rows */}
              <div>
                {sortedHotels.map((hotel) => {
                  const anomalies = detectAnomalies(hotel.matrixData);
                  
                  return (
                    <div key={hotel.id} style={styles.matrixRow}>
                      {/* Sticky Left Column - Hotel Info */}
                      <div style={styles.matrixStickyCell}>
                        <div style={styles.flexBetween}>
                          <div style={{...styles.textWhite, ...styles.textSm}}>{hotel.name}</div>
                          {hotel.riskLevel === 'critical' && (
                            <AlertCircle className="w-4 h-4 text-[#ef4444]" />
                          )}
                          {hotel.riskLevel === 'moderate' && (
                            <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                          )}
                        </div>
                      </div>

                      {/* Date Cells */}
                      <div style={styles.flex}>
                        {hotel.matrixData.slice(0, matrixDays).map((dayData: any, dayIndex: number) => {
                          const isToday = dayIndex === 0;
                          const value = matrixMetric === 'occupancy' 
                            ? dayData.occupancy 
                            : matrixMetric === 'adr' 
                            ? dayData.adr 
                            : dayData.available;
                          
                          const anomaly = anomalies.find(a => a.day === dayIndex);
                          const colorStyle = matrixMetric === 'occupancy' ? getOccupancyColor(value) : {};
                          const textStyle = matrixMetric === 'occupancy' ? getOccupancyTextColor(value) : styles.textWhite;
                          
                          return (
                            <div
                              key={dayIndex}
                              className="group" // Keep group for hover
                              style={{...styles.matrixDataCell, ...(isToday ? styles.matrixDataCellToday : {})}}
                            >
                              <div
                                style={{
                                  ...styles.matrixDataCellInner,
                                  ...(matrixMetric === 'occupancy' ? colorStyle : {backgroundColor: '#1f1f1c'}),
                                  ...textStyle
              }}
                           >
                                {matrixMetric === 'occupancy' && `${value.toFixed(0)}%`}
                                {matrixMetric === 'adr' && `£${value.toFixed(0)}`}
                                {matrixMetric === 'available' && value}
                                
                                {anomaly && (
                                  <div style={{position: 'absolute', top: '-4px', right: '-4px'}}>
                                    {anomaly.type === 'drop' && (
                                      <TrendingDown className="w-3 h-3 text-[#ef4444]" title="Sudden drop ≥15%" />
                                    )}
                                    {anomaly.type === 'persistent' && (
                                      <AlertTriangle className="w-3 h-3 text-[#f59e0b]" title="Persistent low <50% for 7+ days" />
                                    )}
                                    {anomaly.type === 'overbooked' && (
                                      <div className="w-3 h-3 bg-purple-500 rounded-full" title="Overbooked >100%" />
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Hover Tooltip (Requires CSS to show on .group:hover) */}
                              <div className="matrix-tooltip" style={styles.matrixTooltip}>
                                <div style={{...styles.textWhite, ...styles.mb1}}>{hotel.name}</div>
                                <div style={styles.pXSmall}>{matrixDates[dayIndex].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                <div style={{borderTop: '1px solid #3a3a35', marginTop: '4px', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px'}}>
                                  <div style={{...styles.flexBetween, gap: '12px'}}>
                                    <span style={styles.pXSmall}>Occupancy:</span>
                                    <span style={{...getOccupancyTextColor(dayData.occupancy), fontSize: '12px'}}>{dayData.occupancy.toFixed(1)}%</span>
                                  </div>
                                  <div style={{...styles.flexBetween, gap: '12px'}}>
                                    <span style={styles.pXSmall}>ADR:</span>
                                    <span style={{...styles.textWhite, fontSize: '12px'}}>£{dayData.adr.toFixed(0)}</span>
                                  </div>
                                  <div style={{...styles.flexBetween, gap: '12px'}}>
                                    <span style={styles.pXSmall}>Available:</span>
                                    <span style={{...styles.textWhite, fontSize: '12px'}}>{dayData.available} rooms</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* Add this CSS to your index.css or a <style> tag to make tooltips work */}
        <style>{`
          .group:hover .matrix-tooltip {
            opacity: 1;
            pointer-events: auto;
          }
        `}</style>
      </div>

      {/* SECTION 3 & 4: Side by Side Layout */}
      <div style={styles.flexHalf}>
        {/* SECTION 3: Problem List View */}
        <div style={styles.widthHalf}>
          <div style={styles.mb4}>
            <div style={{...styles.flexGap3, ...styles.mb1}}>
              <h2 style={styles.h2}>Next 30-Day Problem List</h2>
              <Badge className="bg-[#faff6a]/20 text-[#faff6a] border-[#faff6a]/40 px-2 py-0.5 text-xs">
                30 Days
              </Badge>
            </div>
            <p style={styles.pSmall}>Next 30-day occupancy ranked by worst performance</p>
          </div>

          <div style={{...styles.card, padding: 0, ...styles.overflowHidden}}>
            <div style={{...styles.cardHeader, ...styles.grid7}}>
              <div style={styles.colSpan1}>Risk</div>
              <div style={styles.colSpan2}>Hotel</div>
              <div style={styles.colSpan1}>City</div>
              <div style={{...styles.colSpan1, ...styles.textRight}}>Occ %</div>
              <div style={{...styles.colSpan1, ...styles.textRight}}>Unsold</div>
              <div style={{...styles.colSpan1, ...styles.textRight}}>ADR</div>
            </div>

            <div>
              {/* [MODIFIED] Data source is new state variable. Sliced to top 20. */}
              {occupancyProblemList.slice(0, 20).map((hotel, index) => (
                <div key={hotel.hotel_id} style={{...styles.cardRow, ...styles.grid7, borderTop: index === 0 ? 'none' : '1px solid #3a3a35'}}>
                  <div style={{...styles.colSpan1, ...styles.flexGap2}}>
                    {/* [MODIFIED] Risk logic is now based on occupancy value */}
                    {hotel.occupancy < 45 ? (
                      <div style={{...styles.flexGap2, ...styles.textRed}}>
                        <AlertCircle className="w-4 h-4" />
                        <span style={styles.textXs}>Critical</span>
                      </div>
                    ) : hotel.occupancy < 60 ? (
                      <div style={{...styles.flexGap2, ...styles.textOrange}}>
                        <AlertTriangle className="w-4 h-4" />
                        <span style={styles.textXs}>Moderate</span>
                      </div>
                    ) : (
                      <div style={{...styles.flexGap2, ...styles.textGreen}}>
                         <Check className="w-4 h-4" />
                         <span style={styles.textXs}>Healthy</span>
                      </div>
                    )}
                  </div>
                  <div style={{...styles.colSpan2, ...styles.textWhite}}>{hotel.name}</div>
                  <div style={styles.colSpan1}>{hotel.city}</div>
                  <div style={{...styles.colSpan1, ...styles.textRight, ...(hotel.occupancy < 45 ? styles.textRed : (hotel.occupancy < 60 ? styles.textOrange : styles.textGreen))}}>
         {parseFloat(hotel.occupancy).toFixed(1)}%
                  </div>
                  {/* [MODIFIED] Using `unsold_rooms` from API */}
                  <div style={{...styles.colSpan1, ...styles.textRight, ...styles.textWhite}}>{hotel.unsold_rooms}</div>
                  <div style={{...styles.colSpan1, ...styles.textRight, ...styles.textWhite}}>£{parseFloat(hotel.adr).toFixed(0)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: Risk Timeline (Mock Data) */}
        <div style={styles.widthHalf}>
          <div style={styles.mb4}>
            <div style={{...styles.flexGap3, ...styles.mb1}}>
              <h2 style={styles.h2}>Next 30-Day Risk Timeline</h2>
              <Badge className="bg-[#faff6a]/20 text-[#faff6a] border-[#faff6a]/40 px-2 py-0.5 text-xs">
                30 Days
              </Badge>
            </div>
            <p style={styles.pSmall}>Daily risk concentration over the next 30 days</p>
          </div>

          <div style={styles.cardPadded}>
            <h3 style={{...styles.h3, ...styles.flexGap2, ...styles.mb3}}>
              <Clock className="w-4 h-4 text-[#faff6a]" />
              Next 30-Day Risk Concentration
            </h3>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              {/* This component still uses mock data as it's a visual prototype */}
              {Array.from({ length: 30 }, (_, i) => {
                const critical = Math.floor(Math.random() * 12);
                const moderate = Math.floor(Math.random() * 15);
                const total = 40;
                const criticalPct = (critical / total) * 100;
                const moderatePct = (moderate / total) * 100;
                const goodPct = 100 - criticalPct - moderatePct;
                
                const date = new Date();
                date.setDate(date.getDate() + i);
                const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                return (
                  <div key={i} style={styles.flexGap2}>
                    <div style={{...styles.pXSmall, width: '64px'}}>{dayLabel}</div>
                    <div style={{...styles.flex, ...styles.flex1, height: '20px', backgroundColor: '#1f1f1c', borderRadius: '9999px', overflow: 'hidden'}}>
                      <div 
                        style={{ backgroundColor: '#ef4444', height: '100%', width: `${criticalPct}%` }}
                        title={`${critical} critical`}
                      />
                      <div 
                        style={{ backgroundColor: '#f59e0b', height: '100%', width: `${moderatePct}%` }}
                        title={`${moderate} moderate`}
                      />
                      <div 
                        style={{ backgroundColor: '#10b981', height: '100%', width: `${goodPct}%` }}
                      />
                    </div>
                    <div style={{...styles.flexGap2, ...styles.textXs, width: '96px'}}>
                      {critical > 5 && (
                        <div style={{...styles.flexGap2, ...styles.textRed}}>
                          <AlertCircle className="w-3 h-3" />
                          <span>{critical}</span>
                        </div>
                      )}
                      {moderate > 8 && (
                        <div style={{...styles.flexGap2, ...styles.textOrange}}>
                          <AlertTriangle className="w-3 h-3" />
                          <span>{moderate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{...styles.flex, justifyContent: 'flex-end', gap: '16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #3a3a35'}}>
              <div style={{...styles.flexGap2, ...styles.textXs}}>
                <div style={{width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '4px'}}></div>
                <span>Critical Risk</span>
              </div>
              <div style={{...styles.flexGap2, ...styles.textXs}}>
                <div style={{width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '4px'}}></div>
                <span>Moderate Risk</span>
              </div>
              <div style={{...styles.flexGap2, ...styles.textXs}}>
                <div style={{width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '4px'}}></div>
                <span>Healthy</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* [MODIFIED] VARIATION 1: Budget Pacing Problem List */}
      <div style={styles.mb8}>
        <div style={styles.mb4}>
          <h2 style={styles.h2}>Budget Pacing Problem List</h2>
          <p style={styles.pSmall}>Tactical action required • Sorted by most urgent budget risk</p>
        </div>

        <div style={{...styles.card, padding: 0, ...styles.overflowHidden}}>
          {/* Table Header */}
          <div style={{...styles.cardHeader, ...styles.grid12}}>
            <div style={styles.colSpan3}>Hotel Name</div>
            <div style={styles.colSpan2}>Current Month Status</div>
            <div style={{...styles.colSpan2, ...styles.textRight}}>Current Month Shortfall</div>
            <div style={{...styles.colSpan2, ...styles.textRight}}>Required ADR</div>
            <div style={{...styles.colSpan3, ...styles.textCenter}}>Next Month Status</div>
          </div>

          {/* Table Rows */}
          <div>
            {/* [MODIFIED] Data source is now pacingOverviewData */}
            {pacingOverviewData
              .sort((a, b) => {
                const statusOrder = { red: 0, yellow: 1, green: 2 };
                return statusOrder[a.currentMonthStatus as keyof typeof statusOrder] - statusOrder[b.currentMonthStatus as keyof typeof statusOrder];
              })
              .map((hotel, index) => {
                // [MODIFIED] Logic simplified as API does not provide 'statusText'
                const currentStatusConfig = {
                  red: { label: 'At Risk' },
                  yellow: { label: 'Slightly Behind' },
                  green: { label: 'On Target' }
                };

                const statusColorMap = {
                  red: 'bg-[#ef4444]',
                  yellow: 'bg-[#f59e0b]',
                  green: 'bg-[#10b981]'
                };

                const current = currentStatusConfig[hotel.currentMonthStatus as keyof typeof currentStatusConfig];
                
                return (
                  <div key={`trend-${hotel.hotelName}`} style={{...styles.cardRow, ...styles.grid12, ...styles.textSm, borderTop: index === 0 ? 'none' : '1px solid #3a3a35'}}>
                    <div style={{...styles.colSpan3, ...styles.textWhite}}>{hotel.hotelName}</div>
                    
                    <div style={styles.colSpan2}>
                      <Badge className={
                        hotel.currentMonthStatus === 'red' ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40' :
                        hotel.currentMonthStatus === 'yellow' ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40' :
                        'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                      }>
                        {current.label}
                      </Badge>
                    </div>
                    
                    <div style={{...styles.colSpan2, ...styles.textRight}}>
                      <span style={hotel.currentMonthShortfall < 0 ? styles.textRedLight : styles.textGreen}>
                        {hotel.currentMonthShortfall < 0 ? '-' : '+'}£{Math.abs(hotel.currentMonthShortfall).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    
                    <div style={{...styles.colSpan2, ...styles.textRight}}>
                      <span style={hotel.currentMonthStatus === 'red' ? styles.textYellow : styles.textWhite}>
                        {/* [MODIFIED] Handle 'Infinity' case */}
                        {hotel.currentMonthRequiredADR > 90000 ? 'N/A' : `£${hotel.currentMonthRequiredADR.toFixed(2)}`}
                      </span>
                    </div>
                    
                    {/* [MODIFIED] This column now only shows the *one* next month we have data for */}
                    <div style={{...styles.colSpan3, ...styles.flex, justifyContent: 'center', alignItems: 'center', gap: '8px'}}>
                      <div style={styles.flexGap2}>
                        <div 
                          style={{width: '20px', height: '20px', borderRadius: '4px', backgroundColor: statusColorMap[hotel.nextMonthStatus as keyof typeof statusColorMap].replace('bg-', '')}}
                          title="Next Month"
                        ></div>
                      </div>
                      <span style={{...styles.pXSmall, marginLeft: '8px'}}>Next Month</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

    </div>
  );
}