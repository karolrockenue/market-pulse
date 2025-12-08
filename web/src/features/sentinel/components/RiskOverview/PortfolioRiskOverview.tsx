// [MODIFIED] Imported useEffect, useState, and toast
import { useState, useEffect, useMemo } from "react";
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
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
// [MODIFIED] Import toast for error notifications
import { toast } from "sonner";
import { PortfolioFlowcast } from "./PortfolioFlowcast";

// --- Quadrant → Color map (canonical, do NOT recompute quadrant from x/y) ---
const QUADRANT_COLORS: Record<string, string> = {
  "Critical Risk": "#ef4444", // red
  "Fill Risk": "#f59e0b", // orange
  "Rate Strategy Risk": "#faff6a", // yellow
  "On Pace": "#10b981", // green
};

// Robust normalizer: trims, collapses whitespace, normalizes Unicode.
// This prevents invisible differences like "Fill Risk" (NBSP) or trailing spaces.
function normalizeQuadrant(q: unknown): string {
  if (typeof q !== "string") return "";
  return q.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function colorForQuadrant(q: unknown): string {
  const key = normalizeQuadrant(q);
  return QUADRANT_COLORS[key] ?? "#9ca3af"; // neutral grey fallback
}
// --- Robust numeric parser: handles numbers, "52.3", "52.3%", " 52 ", null/undefined ---
function num(val: any): number {
  if (val == null) return NaN;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.+-]/g, "");
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

// --- Normalize quadrant text safely ---
function normQuad(q: any): string {
  return (typeof q === "string" ? q.normalize("NFKC") : "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Choose color from payload: [FIXED & DEBUGGED] ---
// The logic now *only* uses X/Y coordinates to guarantee alignment.
// A console.log has been added to debug invalid data.
function colorFromPayload(payload: any): string {
  const x = num(
    payload?.forwardOccupancy ?? payload?.forward_occupancy ?? payload?.x
  );
  const y = num(
    payload?.pacingDifficultyPercent ??
      payload?.pacing_difficulty_percent ??
      payload?.y
  );
  const hotelName = payload?.hotelName ?? "Unknown Hotel";

  // Use neutral grey for any invalid data points
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.warn(`[DOT DEBUG] ${hotelName}: SKIPPED (Invalid Coords)`, {
      x,
      y,
    });
    return "#9ca3af"; // Grey
  }

  // Reference lines: x=60, y=115
  // Y-axis is reversed, so y < 115 is the TOP half.

  // Top-Left (Fill Risk / Need Volume)
  if (x < 60 && y < 115) {
    // console.log(`[DOT DEBUG] ${hotelName}: Top-Left (Orange)`, { x, y });
    return "#f59e0b"; // Orange
  }

  // Bottom-Left (Critical Risk)
  if (x < 60 && y >= 115) {
    // console.log(`[DOT DEBUG] ${hotelName}: Bottom-Left (Red)`, { x, y });
    return "#ef4444"; // Red
  }

  // Bottom-Right (Rate Strategy / Selling too cheap)
  if (x >= 60 && y >= 115) {
    // console.log(`[DOT DEBUG] ${hotelName}: Bottom-Right (Yellow)`, { x, y });
    return "#faff6a"; // Yellow
  }

  // Top-Right (On Pace)
  // console.log(`[DOT DEBUG] ${hotelName}: Top-Right (Green)`, { x, y });
  return "#10b981"; // Green
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

// --- [NEW] INLINE STYLE OBJECTS (Updated to match PROT design) ---
const styles = {
  pageWrapper: {
    minHeight: "100vh",
    backgroundColor: "#1d1d1c", // [UPDATED] Deep dark background
    padding: "24px",
    position: "relative" as "relative",
    overflow: "hidden" as "hidden",
  },
  // [NEW] Background effects container
  bgGradient: {
    position: "absolute" as "absolute",
    inset: 0,
    background:
      "linear-gradient(to bottom right, rgba(57, 189, 248, 0.02), transparent, rgba(250, 255, 106, 0.02))",
    pointerEvents: "none" as "none",
  },
  bgGrid: {
    position: "absolute" as "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(57,189,248,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.02) 1px, transparent 1px)",
    backgroundSize: "64px 64px",
    pointerEvents: "none" as "none",
  },
  contentContainer: {
    position: "relative" as "relative",
    zIndex: 10,
  },
  mb6: { marginBottom: "24px" },
  mb8: { marginBottom: "32px" },
  mb4: { marginBottom: "16px" },
  mb3: { marginBottom: "12px" },
  mb2: { marginBottom: "8px" },
  mb1: { marginBottom: "4px" },
  mt4: { marginTop: "16px" },
  mt6: { marginTop: "24px" },
  header: {
    marginBottom: "1.5rem",
  },
  h1: {
    color: "#e5e5e5",
    fontSize: "1.125rem",
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "-0.025em",
    marginBottom: "0.25rem",
  },
  h2: {
    color: "#e5e5e5",
    fontSize: "0.875rem",
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "-0.025em",
    marginBottom: "0.25rem",
  },
  h3: { color: "#e5e5e5", fontSize: "15px" },
  pSubtle: { color: "#6b7280", fontSize: "0.75rem" },
  pSmall: { color: "#6b7280", fontSize: "0.75rem" },
  pXSmall: {
    color: "#6b7280",
    fontSize: "0.75rem",
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "0.05em",
  },

  grid4: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "24px", // [UPDATED] Wider gap
  },
  grid7: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: "16px",
  },
  grid12: {
    display: "grid",
    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
    gap: "16px",
  },
  colSpan1: { gridColumn: "span 1 / span 1" },
  colSpan2: { gridColumn: "span 2 / span 2" },
  colSpan3: { gridColumn: "span 3 / span 3" },

  // [UPDATED] Card Styles with new border color #2a2a2a
  card: {
    backgroundColor: "#1a1a1a", // [UPDATED] Lighter dark
    border: "1px solid #2a2a2a", // [UPDATED] Subtle border
    borderRadius: "4px",
    padding: "12px",
  },
  cardPadded: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "20px",
  },
  // [UPDATED] Colored borders
  cardCriticalBorder: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a", // Keep base border
    borderRadius: "4px",
    padding: "12px",
  },
  cardModerateBorder: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "12px",
  },
  cardYellowBorder: {
    backgroundColor: "#1f1f1c",
    border: "1px solid #3a3a35",
    borderRadius: "4px",
    padding: "8px",
  },
  cardOrangeBorder: {
    backgroundColor: "#1f1f1c",
    border: "1px solid #3a3a35",
    borderRadius: "4px",
    padding: "8px",
  },
  cardRedBorder: {
    backgroundColor: "#1f1f1c",
    border: "1px solid #3a3a35",
    borderRadius: "4px",
    padding: "8px",
  },

  cardHeader: {
    padding: "12px 16px",
    backgroundColor: "#1a1a1a",
    borderBottom: "1px solid #2a2a2a",
    fontSize: "11px",
    color: "#9ca3af",
  },
  cardRow: {
    padding: "12px 16px",
    transition: "background-color 0.2s",
  },

  textRight: { textAlign: "right" as "right" },
  textCenter: { textAlign: "center" as "center" },
  textXs: { fontSize: "12px" },
  textSm: { fontSize: "14px" },
  textLg: { fontSize: "18px" },
  textXl: { fontSize: "20px" }, // 1.25rem
  text2Xl: { fontSize: "20px" }, // [UPDATED] Smaller than before
  textWhite: { color: "#e5e5e5" },
  textRed: { color: "#ef4444" },
  textRedLight: { color: "#f87171" },
  textOrange: { color: "#f59e0b" },
  textGreen: { color: "#10b981" },
  textYellow: { color: "#faff6a" },

  flex: { display: "flex" },
  flexCol: { display: "flex", flexDirection: "column" as "column" },
  flexBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  flexGap2: { display: "flex", alignItems: "center", gap: "8px" },
  flexGap3: { display: "flex", alignItems: "center", gap: "12px" },
  flexGap4: { display: "flex", alignItems: "center", gap: "16px" },
  flex1: { flex: "1 1 0%" },

  overflowHidden: { overflow: "hidden" },
  overflowAuto: { overflow: "auto" },
  overflowYAuto: { overflowY: "auto" as "auto" },
  maxH180: { maxHeight: "180px" },

  // Matrix Styles
  matrixControls: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "12px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  matrixTableWrapper: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    overflow: "hidden",
  },
  matrixOverflow: { overflowX: "auto" as "auto" },
  matrixMinWidth: { display: "inline-block", minWidth: "100%" },
  matrixHeaderRow: {
    display: "flex",
    position: "sticky" as "sticky",
    top: 0,
    zIndex: 10,
    backgroundColor: "#1a1a1a",
    borderBottom: "1px solid #2a2a2a",
  },
  matrixStickyHeader: {
    position: "sticky" as "sticky",
    left: 0,
    zIndex: 20,
    backgroundColor: "#1a1a1a",
    borderRight: "1px solid #2a2a2a",
    width: "240px",
    flexShrink: 0,
    padding: "12px 16px",
  },
  matrixDateHeader: {
    width: "56px",
    flexShrink: 0,
    padding: "8px 4px",
    textAlign: "center" as "center",
  },
  matrixDateToday: {
    backgroundColor: "rgba(250, 255, 106, 0.1)",
    borderLeft: "2px solid #faff6a",
  },
  matrixRow: {
    display: "flex",
    borderBottom: "1px solid #2a2a2a",
  },
  matrixStickyCell: {
    position: "sticky" as "sticky",
    left: 0,
    zIndex: 10,
    backgroundColor: "#1a1a1a",
    borderRight: "1px solid #2a2a2a",
    width: "240px",
    flexShrink: 0,
    padding: "8px 16px",
  },
  matrixDataCell: {
    width: "56px",
    flexShrink: 0,
    padding: "4px",
    textAlign: "center" as "center",
    position: "relative" as "relative",
  },
  matrixDataCellInner: {
    borderWidth: "1px",
    borderRadius: "2px",
    padding: "2px 4px",
    fontSize: "11px",
    position: "relative" as "relative",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  matrixDataCellToday: {
    backgroundColor: "rgba(250, 255, 106, 0.05)",
    borderLeft: "2px solid #faff6a",
  },
  matrixTooltip: {
    position: "absolute" as "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "100%",
    marginBottom: "4px",
    backgroundColor: "#1f1f1c",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "8px",
    zIndex: 30,
    opacity: 0,
    pointerEvents: "none" as "none",
    transition: "opacity 0.2s",
    whiteSpace: "nowrap" as "nowrap",
    fontSize: "11px",
  },

  // Quadrant Styles
  quadrantGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "24px",
  },
  quadrantChartWrapper: {
    gridColumn: "span 2 / span 2",
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "20px",
  },
  quadrantChartRelative: {
    position: "relative" as "relative",
    height: "520px",
  },
  quadrantOverlays: {
    position: "absolute" as "absolute",
    inset: 0,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gridTemplateRows: "repeat(2, minmax(0, 1fr))",
    gap: "1px",
    pointerEvents: "none" as "none",
    zIndex: 0,
  },
  quadrantLabel: {
    position: "absolute" as "absolute",
    zIndex: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: "4px",
    padding: "4px 8px",
    border: "1px solid #2a2a2a",
  },
  quadrantLegendDot: {
    width: "6px",
    height: "6px",
    borderRadius: "9999px",
  },
  quadrantActionList: {
    gridColumn: "span 1 / span 1",
    display: "flex",
    flexDirection: "column" as "column",
    gap: "16px",
  },
  quadrantActionItem: {
    backgroundColor: "#1f1f1c",
    borderRadius: "4px",
    padding: "8px",
    border: "1px solid #3a3a35",
  },

  flexHalf: { display: "flex", gap: "24px", marginBottom: "32px" },
  widthHalf: { width: "50%" },

  loadingOverlay: {
    position: "absolute" as "absolute",
    inset: 0,
    backgroundColor: "rgba(29, 29, 28, 0.9)",
    display: "flex",
    flexDirection: "column" as "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    backdropFilter: "blur(4px)",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #faff6a",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#6b7280",
    marginTop: "16px",
    fontSize: "12px",
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "0.05em",
  },
};
// --- [END] INLINE STYLES ---

// [MODIFIED] All mock data functions (generateHotelData, generateForwardPaceData, generateBudgetPacingData)
// and their direct calls (const hotels = ...) have been REMOVED.

// Helper functions for matrix
const getOccupancyColor = (value: number) => {
  if (value >= 100)
    return {
      backgroundColor: "rgba(168, 85, 247, 0.3)",
      borderColor: "rgba(168, 85, 247, 0.5)",
    }; // Overbooked
  if (value >= 80)
    return {
      backgroundColor: "rgba(16, 185, 129, 0.3)",
      borderColor: "rgba(16, 185, 129, 0.5)",
    }; // Excellent
  if (value >= 70)
    return {
      backgroundColor: "rgba(250, 255, 106, 0.2)",
      borderColor: "rgba(250, 255, 106, 0.3)",
    }; // Good
  if (value >= 50)
    return {
      backgroundColor: "rgba(249, 115, 22, 0.2)",
      borderColor: "rgba(249, 115, 22, 0.3)",
    }; // Fair
  if (value >= 40)
    return {
      backgroundColor: "rgba(234, 88, 12, 0.3)",
      borderColor: "rgba(234, 88, 12, 0.5)",
    }; // Warning
  return {
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    borderColor: "rgba(239, 68, 68, 0.5)",
  }; // Critical
};

const getOccupancyTextColor = (value: number) => {
  if (value >= 100) return { color: "#c084fc" }; // text-purple-400
  if (value >= 80) return { color: "#34d399" }; // text-emerald-400
  if (value >= 70) return { color: "#faff6a" }; // text-[#faff6a]
  if (value >= 50) return { color: "#fb923c" }; // text-orange-400
  if (value >= 40) return { color: "#f97316" }; // text-orange-500
  return { color: "#f87171" }; // text-red-400
};

// Helper functions for pace variance
const getPaceVarianceColor = (variance: number) => {
  if (variance < -30)
    return {
      backgroundColor: "rgba(239, 68, 68, 0.4)",
      borderColor: "rgba(239, 68, 68, 0.6)",
    }; // Deep Red
  if (variance < -10)
    return {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      borderColor: "rgba(239, 68, 68, 0.4)",
    }; // Light Red
  if (variance <= 10)
    return { backgroundColor: "#3a3a35", borderColor: "#4a4a45" }; // Grey
  return {
    backgroundColor: "rgba(16, 185, 129, 0.3)",
    borderColor: "rgba(16, 185, 129, 0.5)",
  }; // Green
};

const getPaceVarianceTextColor = (variance: number) => {
  if (variance < -30) return { color: "#f87171" }; // text-red-400
  if (variance < -10) return { color: "#fca5a5" }; // text-red-300
  if (variance <= 10) return { color: "#9ca3af" };
  return { color: "#34d399" }; // text-emerald-400
};

const detectAnomalies = (matrixData: any[]) => {
  const anomalies: {
    day: number;
    type: "drop" | "persistent" | "overbooked";
  }[] = [];

  for (let i = 1; i < matrixData.length; i++) {
    const diff = matrixData[i - 1].occupancy - matrixData[i].occupancy;
    if (diff >= 15) {
      anomalies.push({ day: i, type: "drop" });
    }
  }

  let lowCount = 0;
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy < 50) {
      lowCount++;
      if (
        lowCount >= 7 &&
        !anomalies.some((a) => a.day === i && a.type === "persistent")
      ) {
        anomalies.push({ day: i, type: "persistent" });
      }
    } else {
      lowCount = 0;
    }
  }

  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy > 100) {
      anomalies.push({ day: i, type: "overbooked" });
    }
  }

  return anomalies;
};

// --- [NEW] Custom Tooltip for Quadrant Chart ---
const QuadrantTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "#1f1f1c",
          border: "1px solid #faff6a",
          borderRadius: "8px",
          padding: "8px 12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          zIndex: 100,
        }}
      >
        <div
          style={{ color: "#e5e5e5", fontSize: "13px", marginBottom: "4px" }}
        >
          {data.hotelName}
        </div>
        <div style={{ ...styles.pXSmall, color: "#9ca3af" }}>
          Occ:{" "}
          <span style={styles.textWhite}>
            {data.forwardOccupancy.toFixed(1)}%
          </span>
        </div>
        <div style={{ ...styles.pXSmall, color: "#9ca3af" }}>
          Pressure:{" "}
          <span style={styles.textWhite}>
            {data.pacingDifficultyPercent.toFixed(1)}%
          </span>
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

  const [matrixMetric, setMatrixMetric] = useState<
    "occupancy" | "adr" | "available"
  >("occupancy");
  const [matrixDays, setMatrixDays] = useState<number>(45);
  const [sortByRisk, setSortByRisk] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedHotel, setSelectedHotel] = useState<string>("all");
  const [hotelSearchOpen, setHotelSearchOpen] = useState(false);

  const [globalSelectedGroup, setGlobalSelectedGroup] = useState<string>("all");
  const [globalSelectedHotel, setGlobalSelectedHotel] = useState<string>("all");
  const [globalHotelSearchOpen, setGlobalHotelSearchOpen] = useState(false); // <-- ADD THIS LINE
  const [viewType, setViewType] = useState<"group" | "individual">("group");
  const [allHotels, setAllHotels] = useState<any[]>([]); // For populating filters

  // [NEW] Memoized hook to get unique group names for filters
  const globalHotelGroups = useMemo(() => {
    const groups = new Set(
      allHotels.map((h) => h.management_group).filter(Boolean)
    );
    return Array.from(groups).sort();
  }, [allHotels]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // --- [NEW] Build query params from global filters ---
        const params = new URLSearchParams();
        if (globalSelectedHotel !== "all") {
          params.append("hotelId", globalSelectedHotel);
        } else if (globalSelectedGroup !== "all") {
          params.append("group", globalSelectedGroup);
        }
        const queryString = params.toString();
        const query = queryString ? `?${queryString}` : "";
        // --- [END NEW] ---
        const [occProblemRes, pacingRes, matrixRes] = await Promise.all([
          // [MODIFY] Append query string to all fetch calls
          // Endpoints updated to match metrics.router.js definitions
          fetch(`/api/metrics/portfolio/occupancy-problems${query}`),
          fetch(`/api/metrics/portfolio/pacing${query}`),
          fetch(`/api/metrics/portfolio/matrix${query}`),
        ]);

        if (!occProblemRes.ok)
          throw new Error("Failed to fetch occupancy problem list");
        if (!pacingRes.ok) throw new Error("Failed to fetch pacing overview");
        if (!matrixRes.ok) throw new Error("Failed to fetch occupancy matrix");

        const occProblemData = await occProblemRes.json();
        const pacingData = await pacingRes.json();
        const matrixData = await matrixRes.json();

        setOccupancyProblemList(occProblemData);
        setPacingOverviewData(pacingData);
        setOccupancyMatrixData(matrixData);

        // --- [NEW DEBUGGING LINE 1] ---
        console.log("--- ENTIRE PACING ARRAY ---", pacingData);
        // --- [END DEBUGGING LINE 1] ---

        // --- [NEW] DEBUG LOG FOR ELYSEE HYDE PARK ---
        // Find the specific hotel in the newly fetched data
        const hotelToDebug = pacingData.find(
          (h: any) => h.hotelName === "The Cleveland Hotel"
        );

        if (hotelToDebug) {
          console.log(
            "--- [DEBUG] The Cleveland Hotel FINAL QUADRANT LOGIC ---",
            {
              property_name: hotelToDebug.hotelName,
              fwdOcc: hotelToDebug.forwardOccupancy,
              currentMonthStatus: hotelToDebug.currentMonthStatus,
              pacingDifficultyPercent: hotelToDebug.pacingDifficultyPercent,
            }
          );
        } else {
          console.warn(
            "--- [DEBUG] The Cleveland ---",
            "Hotel not found in pacing data array."
          );
        }
        // --- [END NEW DEBUG LOG] ---
      } catch (error: any) {
        console.error("Error fetching portfolio data:", error);
        toast.error("Failed to load portfolio data", {
          description: error.message,
        });
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
        const response = await fetch("/api/hotels"); //
        if (!response.ok) {
          throw new Error("Failed to fetch hotel list for filters");
        }
        const data = await response.json();
        setAllHotels(data);
      } catch (error: any) {
        console.error("Error fetching filter data:", error);
        toast.error("Failed to load filter options", {
          description: error.message,
        });
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

  if (selectedHotel !== "all") {
    filteredHotels = occupancyMatrixData.filter(
      (h) => h.name === selectedHotel
    );
  } else if (selectedGroup !== "all") {
    filteredHotels = occupancyMatrixData.filter(
      (h) => h.group === selectedGroup
    );
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
  const avgPortfolioOcc =
    occupancyMatrixData.length > 0
      ? occupancyMatrixData.reduce((sum, h) => sum + h.occupancy, 0) /
        occupancyMatrixData.length
      : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1d1d1c",
        position: "relative",
        overflow: "hidden",
        padding: "24px",
      }}
    >
      {/* Animated background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(57, 189, 248, 0.02), transparent, rgba(250, 255, 106, 0.02))",
          pointerEvents: "none",
        }}
      ></div>

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(57,189,248,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.02) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          pointerEvents: "none",
        }}
      ></div>

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

      <div style={{ position: "relative", zIndex: 10, padding: "1.5rem" }}>
        {/* Page Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1
            style={{
              color: "#e5e5e5",
              fontSize: "1.125rem",
              textTransform: "uppercase",
              letterSpacing: "-0.025em",
              marginBottom: "0.25rem",
            }}
          >
            Risk Overview
          </h1>
          <p style={{ color: "#6b7280", fontSize: "0.75rem" }}>
            Next 30-day availability risk across all managed properties •
            Identify underperforming hotels requiring immediate action
          </p>
        </div>

        {/* Global Filter Bar */}
        <div
          style={{
            marginBottom: "1.5rem",
            backgroundColor: "#1a1a1a",
            borderRadius: "0.25rem",
            border: "1px solid #2a2a2a",
            padding: "0.625rem 1rem",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label
              style={{
                color: "#6b7280",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              View:
            </label>

            {/* View Type Toggle */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                backgroundColor: "#1a1a1a",
                borderRadius: "0.25rem",
                padding: "0.25rem",
              }}
            >
              <button
                onClick={() => {
                  setViewType("individual");
                  setGlobalSelectedHotel("all");
                }}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor:
                    viewType === "individual" ? "#2a2a2a" : "transparent",
                  color: viewType === "individual" ? "#e5e5e5" : "#6b7280",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <User style={{ width: "0.875rem", height: "0.875rem" }} />
                Individual Hotel
              </button>
              <button
                onClick={() => {
                  setViewType("group");
                  setGlobalSelectedGroup("all");
                }}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor:
                    viewType === "group" ? "#2a2a2a" : "transparent",
                  color: viewType === "group" ? "#e5e5e5" : "#6b7280",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Building2 style={{ width: "0.875rem", height: "0.875rem" }} />
                Group/Portfolio
              </button>
            </div>

            <div
              style={{
                height: "1.5rem",
                width: "1px",
                backgroundColor: "#2a2a2a",
              }}
            />

            {/* Conditional Dropdown */}
            {viewType === "individual" ? (
              <Popover
                open={globalHotelSearchOpen}
                onOpenChange={setGlobalHotelSearchOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    style={{
                      width: "240px",
                      justifyContent: "space-between",
                      backgroundColor: "#0a0a0a",
                      border: "1px solid #2a2a2a",
                      color: "#e5e5e5",
                      height: "2.25rem",
                      padding: "0 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                    }}
                    role="combobox"
                    aria-expanded={globalHotelSearchOpen}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <User
                        style={{
                          width: "0.875rem",
                          height: "0.875rem",
                          color: "#6b7280",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {globalSelectedHotel === "all"
                          ? "Select Hotel..."
                          : allHotels.find(
                              (h) =>
                                h.hotel_id.toString() === globalSelectedHotel
                            )?.property_name || "Select Hotel..."}
                      </span>
                    </div>
                    <ChevronsUpDown
                      style={{
                        width: "1rem",
                        height: "1rem",
                        color: "#6b7280",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[300px] p-0"
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }}
                  align="start"
                >
                  <Command style={{ backgroundColor: "#1a1a1a" }}>
                    <CommandInput
                      placeholder="Type to search hotels..."
                      style={{
                        color: "#e5e5e5",
                        borderBottom: "1px solid #2a2a2a",
                      }}
                      className="placeholder:text-[#6b7280]"
                    />
                    <CommandList style={{ backgroundColor: "#1a1a1a" }}>
                      <CommandEmpty className="text-[#6b7280] text-sm py-6 text-center">
                        No hotel found.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setGlobalSelectedHotel("all");
                            setGlobalHotelSearchOpen(false);
                          }}
                          style={{ color: "#e5e5e5" }}
                          className="aria-selected:bg-[#2a2a2a] aria-selected:text-[#e5e5e5]"
                        >
                          <Check
                            style={{
                              marginRight: "0.5rem",
                              height: "1rem",
                              width: "1rem",
                              opacity: globalSelectedHotel === "all" ? 1 : 0,
                            }}
                          />
                          All Hotels ({allHotels.length})
                        </CommandItem>
                        {allHotels.map((hotel) => (
                          <CommandItem
                            key={hotel.hotel_id}
                            value={
                              hotel.property_name || `Hotel ${hotel.hotel_id}`
                            }
                            onSelect={() => {
                              setGlobalSelectedHotel(hotel.hotel_id.toString());
                              setGlobalHotelSearchOpen(false);
                            }}
                            style={{ color: "#e5e5e5" }}
                            className="aria-selected:bg-[#2a2a2a] aria-selected:text-[#e5e5e5]"
                          >
                            <Check
                              style={{
                                marginRight: "0.5rem",
                                height: "1rem",
                                width: "1rem",
                                opacity:
                                  globalSelectedHotel ===
                                  hotel.hotel_id.toString()
                                    ? 1
                                    : 0,
                              }}
                            />
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <span>
                                {hotel.property_name ||
                                  `Hotel ${hotel.hotel_id}`}
                              </span>
                              <span
                                style={{
                                  color: "#6b7280",
                                  fontSize: "0.75rem",
                                }}
                              >
                                {hotel.management_group}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <Select
                value={globalSelectedGroup}
                onValueChange={setGlobalSelectedGroup}
              >
                <SelectTrigger className="w-[240px] bg-[#0a0a0a] border-[#2a2a2a] text-[#e5e5e5] h-9 text-xs">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Building2
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: "#6b7280",
                      }}
                    />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                  }}
                >
                  <SelectItem
                    value="all"
                    className="text-[#e5e5e5] focus:bg-[#2a2a2a] focus:text-[#e5e5e5] text-xs"
                  >
                    All Groups ({globalHotelGroups.length} groups,{" "}
                    {allHotels.length} hotels)
                  </SelectItem>
                  {globalHotelGroups.map((group) => (
                    <SelectItem
                      key={group}
                      value={group}
                      className="text-[#e5e5e5] focus:bg-[#2a2a2a] focus:text-[#e5e5e5] text-xs"
                    >
                      {group} (
                      {
                        allHotels.filter((h) => h.management_group === group)
                          .length
                      }{" "}
                      hotels)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div style={{ flex: 1 }} />

            {/* Display badge showing current selection */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "0.25rem",
                padding: "0.375rem 0.75rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <div
                  style={{
                    width: "0.375rem",
                    height: "0.375rem",
                    borderRadius: "9999px",
                    backgroundColor: "#10b981",
                  }}
                ></div>
                <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                  Viewing:{" "}
                  <span style={{ color: "#e5e5e5" }}>
                    {viewType === "individual"
                      ? globalSelectedHotel === "all"
                        ? "All Individual Hotels"
                        : allHotels.find(
                            (h) => h.hotel_id.toString() === globalSelectedHotel
                          )?.property_name
                      : globalSelectedGroup === "all"
                      ? "All Portfolio"
                      : globalSelectedGroup}
                  </span>
                  {viewType === "group" && (
                    <span style={{ color: "#6b7280", marginLeft: "0.25rem" }}>
                      ({pacingOverviewData.length} hotels)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats (HUD Style) */}
        <div
          style={{ marginBottom: "1.5rem", position: "relative", zIndex: 10 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1rem",
            }}
          >
            {/* 1. Portfolio Hotels Count */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "0.25rem",
                padding: "1rem",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Corner Brackets */}
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #39BDF8",
                  borderLeft: "2px solid #39BDF8",
                  opacity: 0.25,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #39BDF8",
                  borderRight: "2px solid #39BDF8",
                  opacity: 0.25,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #39BDF8",
                  borderLeft: "2px solid #39BDF8",
                  opacity: 0.25,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #39BDF8",
                  borderRight: "2px solid #39BDF8",
                  opacity: 0.25,
                }}
              ></div>

              {/* Subtle gradient background */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "50%",
                  background:
                    "linear-gradient(180deg, rgba(57, 189, 248, 0.015) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              ></div>

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(57, 189, 248, 0.06)",
                      border: "1px solid rgba(57, 189, 248, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Building2
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: "#39BDF8",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      lineHeight: 1,
                    }}
                  >
                    {viewType === "individual" && globalSelectedHotel !== "all"
                      ? "Selected Hotel"
                      : "Portfolio Hotels"}
                  </div>
                </div>
                <div
                  style={{
                    color: "#e5e5e5",
                    fontSize: "2rem",
                    fontFamily: "monospace",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  46
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <div
                    style={{
                      width: "0.25rem",
                      height: "0.25rem",
                      borderRadius: "9999px",
                      backgroundColor: "#39BDF8",
                      opacity: 0.7,
                    }}
                  ></div>
                  <span style={{ color: "#6b7280", fontSize: "0.625rem" }}>
                    ACTIVE PROPERTIES
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Critical Risk */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "0.25rem",
                padding: "1rem",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 16px rgba(239, 68, 68, 0.04)",
              }}
            >
              {/* Corner Brackets */}
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #ef4444",
                  borderLeft: "2px solid #ef4444",
                  opacity: 0.3,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #ef4444",
                  borderRight: "2px solid #ef4444",
                  opacity: 0.3,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #ef4444",
                  borderLeft: "2px solid #ef4444",
                  opacity: 0.3,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #ef4444",
                  borderRight: "2px solid #ef4444",
                  opacity: 0.3,
                }}
              ></div>

              {/* Red gradient background */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "50%",
                  background:
                    "linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              ></div>

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                      border: "1px solid rgba(239, 68, 68, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AlertTriangle
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: "#ef4444",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      lineHeight: 1,
                    }}
                  >
                    Critical Risk
                  </div>
                </div>
                <div
                  style={{
                    color: "#ef4444",
                    fontSize: "2rem",
                    fontFamily: "monospace",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  {
                    pacingOverviewData.filter(
                      (h) =>
                        num(h.forwardOccupancy) < 60 &&
                        num(h.pacingDifficultyPercent) >= 115
                    ).length
                  }
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "0.25rem",
                      backgroundColor: "#2a2a2a",
                      borderRadius: "9999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${
                          (pacingOverviewData.filter(
                            (h) =>
                              num(h.forwardOccupancy) < 60 &&
                              num(h.pacingDifficultyPercent) >= 115
                          ).length /
                            Math.max(pacingOverviewData.length, 1)) *
                          100
                        }%`,
                        backgroundColor: "#ef4444",
                        opacity: 0.8,
                        transition: "width 0.3s",
                      }}
                    ></div>
                  </div>
                  <span
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      fontFamily: "monospace",
                    }}
                  >
                    QUADRANT ALIGNED
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Risk Warnings (Formerly Moderate) */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                borderRadius: "0.25rem",
                padding: "1rem",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 16px rgba(245, 158, 11, 0.03)",
              }}
            >
              {/* Corner Brackets */}
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #f59e0b",
                  borderLeft: "2px solid #f59e0b",
                  opacity: 0.3,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #f59e0b",
                  borderRight: "2px solid #f59e0b",
                  opacity: 0.3,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #f59e0b",
                  borderLeft: "2px solid #f59e0b",
                  opacity: 0.3,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #f59e0b",
                  borderRight: "2px solid #f59e0b",
                  opacity: 0.3,
                }}
              ></div>

              {/* Orange gradient background */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "50%",
                  background:
                    "linear-gradient(180deg, rgba(245, 158, 11, 0.03) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              ></div>

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AlertCircle
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: "#f59e0b",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      lineHeight: 1,
                    }}
                  >
                    Risk Warnings
                  </div>
                </div>
                <div
                  style={{
                    color: "#f59e0b",
                    fontSize: "2rem",
                    fontFamily: "monospace",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  {
                    pacingOverviewData.filter((h) => {
                      const occ = num(h.forwardOccupancy);
                      const pressure = num(h.pacingDifficultyPercent);
                      const isCritical = occ < 60 && pressure >= 115;
                      const isOnPace = occ >= 60 && pressure < 115;
                      return !isCritical && !isOnPace;
                    }).length
                  }
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "0.25rem",
                      backgroundColor: "#2a2a2a",
                      borderRadius: "9999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${
                          (pacingOverviewData.filter((h) => {
                            const occ = num(h.forwardOccupancy);
                            const pressure = num(h.pacingDifficultyPercent);
                            const isCritical = occ < 60 && pressure >= 115;
                            const isOnPace = occ >= 60 && pressure < 115;
                            return !isCritical && !isOnPace;
                          }).length /
                            Math.max(pacingOverviewData.length, 1)) *
                          100
                        }%`,
                        opacity: 0.8,
                        backgroundColor: "#f59e0b",
                        transition: "width 0.3s",
                      }}
                    ></div>
                  </div>
                  <span
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      fontFamily: "monospace",
                    }}
                  >
                    FILL or RATE RISK
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Avg Portfolio Occupancy */}
            <div
              style={{
                backgroundColor: "#1a1a1a",
                border: "1px solid rgba(250, 255, 106, 0.2)",
                borderRadius: "0.25rem",
                padding: "1rem",
                position: "relative",
                overflow: "hidden",
                boxShadow: "0 0 16px rgba(250, 255, 106, 0.02)",
              }}
            >
              {/* Corner Brackets */}
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #faff6a",
                  borderLeft: "2px solid #faff6a",
                  opacity: 0.25,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderTop: "2px solid #faff6a",
                  borderRight: "2px solid #faff6a",
                  opacity: 0.25,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  left: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #faff6a",
                  borderLeft: "2px solid #faff6a",
                  opacity: 0.25,
                }}
              ></div>
              <div
                style={{
                  position: "absolute",
                  bottom: "0.5rem",
                  right: "0.5rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  borderBottom: "2px solid #faff6a",
                  borderRight: "2px solid #faff6a",
                  opacity: 0.25,
                }}
              ></div>

              {/* Yellow gradient background */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "50%",
                  background:
                    "linear-gradient(180deg, rgba(250, 255, 106, 0.02) 0%, transparent 100%)",
                  pointerEvents: "none",
                }}
              ></div>

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(250, 255, 106, 0.06)",
                      border: "1px solid rgba(250, 255, 106, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Activity
                      style={{
                        width: "0.875rem",
                        height: "0.875rem",
                        color: "#faff6a",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      lineHeight: 1,
                    }}
                  >
                    Avg {viewType === "group" ? "Portfolio" : "Selected"} Occ.
                  </div>
                </div>
                <div
                  style={{
                    color: "#e5e5e5",
                    fontSize: "2rem",
                    fontFamily: "monospace",
                    lineHeight: 1,
                    marginBottom: "0.5rem",
                  }}
                >
                  {pacingOverviewData.length > 0
                    ? (
                        pacingOverviewData.reduce(
                          (sum, h) => sum + num(h.forwardOccupancy),
                          0
                        ) / pacingOverviewData.length
                      ).toFixed(0)
                    : 0}
                  <span style={{ fontSize: "1.25rem", color: "#6b7280" }}>
                    %
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: "0.25rem",
                      backgroundColor: "#2a2a2a",
                      borderRadius: "9999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${
                          pacingOverviewData.length > 0
                            ? Math.round(
                                pacingOverviewData.reduce(
                                  (sum, h) => sum + num(h.forwardOccupancy),
                                  0
                                ) / pacingOverviewData.length
                              )
                            : 0
                        }%`,
                        backgroundColor: "#faff6a",
                        opacity: 0.75,
                        transition: "width 0.3s",
                      }}
                    ></div>
                  </div>
                  <span
                    style={{
                      color: "#6b7280",
                      fontSize: "0.625rem",
                      fontFamily: "monospace",
                    }}
                  >
                    30-DAY FWD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Quadrant Chart */}
        <div style={{ marginBottom: "2rem", position: "relative", zIndex: 10 }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <h2
              style={{
                color: "#e5e5e5",
                textTransform: "uppercase",
                letterSpacing: "-0.025em",
                fontSize: "0.875rem",
                marginBottom: "0.25rem",
              }}
            >
              Risk Quadrant Analysis
            </h2>
            <p style={{ color: "#6b7280", fontSize: "0.75rem" }}>
              Strategic diagnostic tool • Combines volume and budget pacing risk
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1.5rem",
            }}
          >
            {/* Scatter Plot */}
            <div
              style={{
                gridColumn: "span 2",
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "0.25rem",
                padding: "1.25rem",
              }}
            >
              <div style={{ position: "relative", height: "520px" }}>
                {/* Quadrant Background Overlays */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gridTemplateRows: "repeat(2, 1fr)",
                    gap: "1px",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                >
                  <div
                    style={{ backgroundColor: "rgba(251, 146, 60, 0.03)" }}
                  ></div>
                  <div
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.03)" }}
                  ></div>
                  <div
                    style={{ backgroundColor: "rgba(220, 38, 38, 0.03)" }}
                  ></div>
                  <div
                    style={{ backgroundColor: "rgba(57, 189, 248, 0.03)" }}
                  ></div>
                </div>

                {/* Quadrant Labels (Positioned) */}
                <div
                  style={{
                    position: "absolute",
                    top: "1rem",
                    left: "1rem",
                    zIndex: 10,
                    backgroundColor: "#1a1a1a",
                    border: "1px solid rgba(251, 146, 60, 0.2)",
                    borderRadius: "0.25rem",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "0.375rem",
                        height: "0.375rem",
                        backgroundColor: "#fb923c",
                        borderRadius: "9999px",
                      }}
                    ></div>
                    <span style={{ color: "#fb923c", fontSize: "0.75rem" }}>
                      Fill Risk
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    zIndex: 10,
                    backgroundColor: "#1a1a1a",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: "0.25rem",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "0.375rem",
                        height: "0.375rem",
                        backgroundColor: "#10b981",
                        borderRadius: "9999px",
                      }}
                    ></div>
                    <span style={{ color: "#10b981", fontSize: "0.75rem" }}>
                      On Pace
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    position: "absolute",
                    bottom: "1rem",
                    left: "1rem",
                    zIndex: 10,
                    backgroundColor: "#1a1a1a",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                    borderRadius: "0.25rem",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "0.375rem",
                        height: "0.375rem",
                        backgroundColor: "#dc2626",
                        borderRadius: "9999px",
                      }}
                    ></div>
                    <span style={{ color: "#dc2626", fontSize: "0.75rem" }}>
                      Critical Risk
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    position: "absolute",
                    bottom: "1rem",
                    right: "1rem",
                    zIndex: 10,
                    backgroundColor: "#1a1a1a",
                    border: "1px solid rgba(57, 189, 248, 0.2)",
                    borderRadius: "0.25rem",
                    padding: "0.25rem 0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "0.375rem",
                        height: "0.375rem",
                        backgroundColor: "#39BDF8",
                        borderRadius: "9999px",
                      }}
                    ></div>
                    <span style={{ color: "#39BDF8", fontSize: "0.75rem" }}>
                      Rate Strategy Risk
                    </span>
                  </div>
                </div>

                {/* Chart */}
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  style={{ position: "relative", zIndex: 5 }}
                >
                  <ScatterChart
                    margin={{ top: 30, right: 30, bottom: 60, left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a35" />
                    <XAxis
                      type="number"
                      dataKey="forwardOccupancy"
                      name="Forward Volume (Occupancy %)"
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      stroke="#9ca3af"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      label={{
                        value: "Forward Volume (Occupancy %)",
                        position: "bottom",
                        fill: "#e5e5e5",
                        offset: 30,
                        style: { fontSize: 13 },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="pacingDifficultyPercent"
                      name="Pacing Rate Pressure (%)"
                      reversed={true}
                      domain={[0, "auto"]}
                      ticks={[0, 50, 100, 115, 200, 300, 400, 500]}
                      stroke="#9ca3af"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                      label={{
                        value: "Pacing Rate Pressure (%)",
                        angle: -90,
                        position: "insideLeft",
                        fill: "#e5e5e5",
                        offset: -50,
                        style: { fontSize: 13, textAnchor: "middle" },
                      }}
                    />
                    <ZAxis range={[100, 100]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3", stroke: "#faff6a" }}
                      content={<QuadrantTooltip />}
                    />

                    {/* Reference Lines */}
                    <ReferenceLine
                      y={115}
                      stroke="#faff6a"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                    />
                    <ReferenceLine
                      x={60}
                      stroke="#faff6a"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                    />

                    <Scatter
                      name="Hotels"
                      data={pacingOverviewData}
                      shape={DotByPayload}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quadrant Summary - Right Side (Detailed Lists) */}
            <div
              style={{
                height: "520px",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* 1. Critical Risk (Red) - Occ < 60 && Pressure >= 115 */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "0.25rem",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    flexShrink: 0,
                  }}
                >
                  <AlertCircle
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "#ef4444",
                    }}
                  />
                  <h3
                    style={{
                      color: "#ef4444",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}
                  >
                    Critical Risk
                  </h3>
                  <span
                    style={{
                      marginLeft: "auto",
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                      fontSize: "0.65rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {
                      pacingOverviewData.filter(
                        (d) =>
                          num(d.forwardOccupancy) < 60 &&
                          num(d.pacingDifficultyPercent) >= 115
                      ).length
                    }
                  </span>
                </div>
                <div
                  style={{
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    paddingRight: "4px",
                  }}
                >
                  {pacingOverviewData
                    .filter(
                      (d) =>
                        num(d.forwardOccupancy) < 60 &&
                        num(d.pacingDifficultyPercent) >= 115
                    )
                    .sort(
                      (a, b) =>
                        num(b.pacingDifficultyPercent) -
                        num(a.pacingDifficultyPercent)
                    )
                    .map((hotel, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: "#1f1f1c",
                          border: "1px solid #3a3a35",
                          borderRadius: "0.25rem",
                          padding: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            color: "#e5e5e5",
                            fontSize: "0.75rem",
                            marginBottom: "2px",
                            fontWeight: 500,
                          }}
                        >
                          {hotel.hotelName}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{ color: "#6b7280", fontSize: "0.65rem" }}
                          >
                            Occ: {num(hotel.forwardOccupancy).toFixed(0)}%
                          </span>
                          <span
                            style={{ color: "#ef4444", fontSize: "0.65rem" }}
                          >
                            {num(hotel.pacingDifficultyPercent).toFixed(0)}%
                            Pressure
                          </span>
                        </div>
                      </div>
                    ))}
                  {pacingOverviewData.filter(
                    (d) =>
                      num(d.forwardOccupancy) < 60 &&
                      num(d.pacingDifficultyPercent) >= 115
                  ).length === 0 && (
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.75rem",
                        fontStyle: "italic",
                        padding: "0.5rem",
                      }}
                    >
                      No hotels in critical risk.
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Rate Strategy Risk (Yellow) - Occ >= 60 && Pressure >= 115 */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "0.25rem",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    flexShrink: 0,
                  }}
                >
                  <Target
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "#faff6a",
                    }}
                  />
                  <h3
                    style={{
                      color: "#faff6a",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}
                  >
                    Rate Strategy Risk
                  </h3>
                  <span
                    style={{
                      marginLeft: "auto",
                      backgroundColor: "rgba(250, 255, 106, 0.1)",
                      color: "#faff6a",
                      fontSize: "0.65rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {
                      pacingOverviewData.filter(
                        (d) =>
                          num(d.forwardOccupancy) >= 60 &&
                          num(d.pacingDifficultyPercent) >= 115
                      ).length
                    }
                  </span>
                </div>
                <div
                  style={{
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    paddingRight: "4px",
                  }}
                >
                  {pacingOverviewData
                    .filter(
                      (d) =>
                        num(d.forwardOccupancy) >= 60 &&
                        num(d.pacingDifficultyPercent) >= 115
                    )
                    .sort(
                      (a, b) =>
                        num(b.pacingDifficultyPercent) -
                        num(a.pacingDifficultyPercent)
                    )
                    .map((hotel, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: "#1f1f1c",
                          border: "1px solid #3a3a35",
                          borderRadius: "0.25rem",
                          padding: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            color: "#e5e5e5",
                            fontSize: "0.75rem",
                            marginBottom: "2px",
                            fontWeight: 500,
                          }}
                        >
                          {hotel.hotelName}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{ color: "#6b7280", fontSize: "0.65rem" }}
                          >
                            Occ: {num(hotel.forwardOccupancy).toFixed(0)}%
                          </span>
                          <span
                            style={{ color: "#faff6a", fontSize: "0.65rem" }}
                          >
                            {num(hotel.pacingDifficultyPercent).toFixed(0)}%
                            Pressure
                          </span>
                        </div>
                      </div>
                    ))}
                  {pacingOverviewData.filter(
                    (d) =>
                      num(d.forwardOccupancy) >= 60 &&
                      num(d.pacingDifficultyPercent) >= 115
                  ).length === 0 && (
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.75rem",
                        fontStyle: "italic",
                        padding: "0.5rem",
                      }}
                    >
                      No hotels in rate risk.
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Fill Risk (Orange) - Occ < 60 && Pressure < 115 */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "0.25rem",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "#f59e0b",
                    }}
                  />
                  <h3
                    style={{
                      color: "#f59e0b",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}
                  >
                    Fill Risk
                  </h3>
                  <span
                    style={{
                      marginLeft: "auto",
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      color: "#f59e0b",
                      fontSize: "0.65rem",
                      padding: "1px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {
                      pacingOverviewData.filter(
                        (d) =>
                          num(d.forwardOccupancy) < 60 &&
                          num(d.pacingDifficultyPercent) < 115
                      ).length
                    }
                  </span>
                </div>
                <div
                  style={{
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    paddingRight: "4px",
                  }}
                >
                  {pacingOverviewData
                    .filter(
                      (d) =>
                        num(d.forwardOccupancy) < 60 &&
                        num(d.pacingDifficultyPercent) < 115
                    )
                    .sort(
                      (a, b) =>
                        num(a.forwardOccupancy) - num(b.forwardOccupancy)
                    )
                    .map((hotel, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: "#1f1f1c",
                          border: "1px solid #3a3a35",
                          borderRadius: "0.25rem",
                          padding: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            color: "#e5e5e5",
                            fontSize: "0.75rem",
                            marginBottom: "2px",
                            fontWeight: 500,
                          }}
                        >
                          {hotel.hotelName}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{ color: "#6b7280", fontSize: "0.65rem" }}
                          >
                            Pressure:{" "}
                            {num(hotel.pacingDifficultyPercent).toFixed(0)}%
                          </span>
                          <span
                            style={{ color: "#f59e0b", fontSize: "0.65rem" }}
                          >
                            {num(hotel.forwardOccupancy).toFixed(0)}% Occ
                          </span>
                        </div>
                      </div>
                    ))}
                  {pacingOverviewData.filter(
                    (d) =>
                      num(d.forwardOccupancy) < 60 &&
                      num(d.pacingDifficultyPercent) < 115
                  ).length === 0 && (
                    <div
                      style={{
                        color: "#6b7280",
                        fontSize: "0.75rem",
                        fontStyle: "italic",
                        padding: "0.5rem",
                      }}
                    >
                      No hotels in fill risk.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. On Pace (Green) - Minimal view */}
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "0.25rem",
                  padding: "0.75rem",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Check
                    style={{
                      width: "0.875rem",
                      height: "0.875rem",
                      color: "#10b981",
                    }}
                  />
                  <h3
                    style={{
                      color: "#10b981",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}
                  >
                    On Pace
                  </h3>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: "#10b981",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    {
                      pacingOverviewData.filter(
                        (d) =>
                          num(d.forwardOccupancy) >= 60 &&
                          num(d.pacingDifficultyPercent) < 115
                      ).length
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1.5: Portfolio Flowcast */}
        <PortfolioFlowcast
          startDate={new Date()}
          globalGroupFilter={
            selectedGroup !== "all" ? selectedGroup : globalSelectedGroup
          }
          globalHotelFilter={
            selectedHotel !== "all" ? selectedHotel : globalSelectedHotel
          }
        />

        {/* SECTION 2: Occupancy Matrix */}
        <div style={styles.mb8}>
          <div style={styles.mb4}>
            <h2 style={styles.h2}>Occupancy Matrix</h2>
            <p style={styles.pSmall}>
              Dense at-a-glance view of all properties vs next 45 days • Visual
              anomaly detection
            </p>
          </div>

          {/* Controls Bar */}
          <div
            style={{
              marginBottom: "1rem",
              backgroundColor: "#1a1a1a",
              borderRadius: "0.25rem",
              border: "1px solid #2a2a2a",
              padding: "0.625rem 1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={styles.flexGap4}>
              {/* Metric Toggle */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <Filter className="w-4 h-4 text-[#6b7280] mr-2" />
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "0.25rem",
                    padding: "0.25rem",
                  }}
                >
                  <button
                    onClick={() => setMatrixMetric("occupancy")}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      transition: "all 0.2s",
                      backgroundColor:
                        matrixMetric === "occupancy"
                          ? "#2a2a2a"
                          : "transparent",
                      color:
                        matrixMetric === "occupancy" ? "#e5e5e5" : "#6b7280",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Occupancy %
                  </button>
                  <button
                    onClick={() => setMatrixMetric("adr")}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      transition: "all 0.2s",
                      backgroundColor:
                        matrixMetric === "adr" ? "#2a2a2a" : "transparent",
                      color: matrixMetric === "adr" ? "#e5e5e5" : "#6b7280",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    ADR
                  </button>
                  <button
                    onClick={() => setMatrixMetric("available")}
                    style={{
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      transition: "all 0.2s",
                      backgroundColor:
                        matrixMetric === "available"
                          ? "#2a2a2a"
                          : "transparent",
                      color:
                        matrixMetric === "available" ? "#e5e5e5" : "#6b7280",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Rooms Available
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSortByRisk(!sortByRisk)}
                className={`px-3 py-1.5 rounded text-sm transition-all ${
                  sortByRisk
                    ? "bg-[#ef4444] text-white"
                    : "bg-[#1f1f1c] border border-[#3a3a35] text-[#9ca3af] hover:border-[#ef4444]/50"
                }`}
              >
                {sortByRisk ? "Showing Highest Risk First" : "Sort by Risk"}
              </button>
            </div>

            {/* Legend */}
            <div style={styles.flexGap4}>
              <div style={styles.flexGap2}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    ...getOccupancyColor(30),
                    borderRadius: "4px",
                  }}
                ></div>
                <span style={styles.textXs}>{"<40%"}</span>
              </div>
              <div style={styles.flexGap2}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    ...getOccupancyColor(55),
                    borderRadius: "4px",
                  }}
                ></div>
                <span style={styles.textXs}>40-70%</span>
              </div>
              <div style={styles.flexGap2}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    ...getOccupancyColor(75),
                    borderRadius: "4px",
                  }}
                ></div>
                <span style={styles.textXs}>70-80%</span>
              </div>
              <div style={styles.flexGap2}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    ...getOccupancyColor(90),
                    borderRadius: "4px",
                  }}
                ></div>
                <span style={styles.textXs}>80-100%</span>
              </div>
              <div style={styles.flexGap2}>
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    ...getOccupancyColor(101),
                    borderRadius: "4px",
                  }}
                ></div>
                <span style={styles.textXs}>{">100%"}</span>
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
                      const dayOfWeek = date.toLocaleDateString("en-US", {
                        weekday: "short",
                      });
                      const dayOfMonth = date.getDate();
                      const month = date.toLocaleDateString("en-US", {
                        month: "short",
                      });

                      return (
                        <div
                          key={i}
                          style={{
                            ...styles.matrixDateHeader,
                            ...(isToday ? styles.matrixDateToday : {}),
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: isToday ? "#faff6a" : "#6b7280",
                            }}
                          >
                            {dayOfWeek}
                          </div>
                          <div
                            style={{
                              ...styles.textXs,
                              color: isToday ? "#faff6a" : "#9ca3af",
                            }}
                          >
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
                            <div
                              style={{ ...styles.textWhite, ...styles.textSm }}
                            >
                              {hotel.name}
                            </div>
                            {hotel.riskLevel === "critical" && (
                              <AlertCircle className="w-4 h-4 text-[#ef4444]" />
                            )}
                            {hotel.riskLevel === "moderate" && (
                              <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                            )}
                          </div>
                        </div>

                        {/* Date Cells */}
                        <div style={styles.flex}>
                          {hotel.matrixData
                            .slice(0, matrixDays)
                            .map((dayData: any, dayIndex: number) => {
                              const isToday = dayIndex === 0;
                              const value =
                                matrixMetric === "occupancy"
                                  ? dayData.occupancy
                                  : matrixMetric === "adr"
                                  ? dayData.adr
                                  : dayData.available;

                              const anomaly = anomalies.find(
                                (a) => a.day === dayIndex
                              );
                              const colorStyle =
                                matrixMetric === "occupancy"
                                  ? getOccupancyColor(value)
                                  : {};
                              const textStyle =
                                matrixMetric === "occupancy"
                                  ? getOccupancyTextColor(value)
                                  : styles.textWhite;

                              return (
                                <div
                                  key={dayIndex}
                                  className="group" // Keep group for hover
                                  style={{
                                    ...styles.matrixDataCell,
                                    ...(isToday
                                      ? styles.matrixDataCellToday
                                      : {}),
                                  }}
                                >
                                  <div
                                    style={{
                                      ...styles.matrixDataCellInner,
                                      ...(matrixMetric === "occupancy"
                                        ? colorStyle
                                        : { backgroundColor: "#1f1f1c" }),
                                      ...textStyle,
                                    }}
                                  >
                                    {matrixMetric === "occupancy" &&
                                      `${value.toFixed(0)}%`}
                                    {matrixMetric === "adr" &&
                                      `£${value.toFixed(0)}`}
                                    {matrixMetric === "available" && value}

                                    {anomaly && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: "-4px",
                                          right: "-4px",
                                        }}
                                      >
                                        {anomaly.type === "drop" && (
                                          <TrendingDown
                                            className="w-3 h-3 text-[#ef4444]"
                                            title="Sudden drop ≥15%"
                                          />
                                        )}
                                        {anomaly.type === "persistent" && (
                                          <AlertTriangle
                                            className="w-3 h-3 text-[#f59e0b]"
                                            title="Persistent low <50% for 7+ days"
                                          />
                                        )}
                                        {anomaly.type === "overbooked" && (
                                          <div
                                            className="w-3 h-3 bg-purple-500 rounded-full"
                                            title="Overbooked >100%"
                                          />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Hover Tooltip (Requires CSS to show on .group:hover) */}
                                  <div
                                    className="matrix-tooltip"
                                    style={styles.matrixTooltip}
                                  >
                                    <div
                                      style={{
                                        ...styles.textWhite,
                                        ...styles.mb1,
                                      }}
                                    >
                                      {hotel.name}
                                    </div>
                                    <div style={styles.pXSmall}>
                                      {matrixDates[dayIndex].toLocaleDateString(
                                        "en-US",
                                        {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        }
                                      )}
                                    </div>
                                    <div
                                      style={{
                                        borderTop: "1px solid #3a3a35",
                                        marginTop: "4px",
                                        paddingTop: "4px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "2px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          ...styles.flexBetween,
                                          gap: "12px",
                                        }}
                                      >
                                        <span style={styles.pXSmall}>
                                          Occupancy:
                                        </span>
                                        <span
                                          style={{
                                            ...getOccupancyTextColor(
                                              dayData.occupancy
                                            ),
                                            fontSize: "12px",
                                          }}
                                        >
                                          {dayData.occupancy.toFixed(1)}%
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          ...styles.flexBetween,
                                          gap: "12px",
                                        }}
                                      >
                                        <span style={styles.pXSmall}>ADR:</span>
                                        <span
                                          style={{
                                            ...styles.textWhite,
                                            fontSize: "12px",
                                          }}
                                        >
                                          £{dayData.adr.toFixed(0)}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          ...styles.flexBetween,
                                          gap: "12px",
                                        }}
                                      >
                                        <span style={styles.pXSmall}>
                                          Available:
                                        </span>
                                        <span
                                          style={{
                                            ...styles.textWhite,
                                            fontSize: "12px",
                                          }}
                                        >
                                          {dayData.available} rooms
                                        </span>
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

        {/* [MODIFIED] VARIATION 1: Budget Pacing Problem List */}
        <div style={styles.mb8}>
          <div style={styles.mb4}>
            <h2 style={styles.h2}>Budget Pacing Problem List</h2>
            <p style={styles.pSmall}>
              Tactical action required • Sorted by most urgent budget risk
            </p>
          </div>

          <div style={{ ...styles.card, padding: 0, ...styles.overflowHidden }}>
            {/* Table Header */}
            <div style={{ ...styles.cardHeader, ...styles.grid12 }}>
              <div style={styles.colSpan3}>Hotel Name</div>
              <div style={styles.colSpan2}>Current Month Status</div>
              <div style={{ ...styles.colSpan2, ...styles.textRight }}>
                Current Month Shortfall
              </div>
              <div style={{ ...styles.colSpan2, ...styles.textRight }}>
                Required ADR
              </div>
              <div style={{ ...styles.colSpan3, ...styles.textCenter }}>
                Next Month Status
              </div>
            </div>

            {/* Table Rows */}
            <div>
              {/* [MODIFIED] Data source is now pacingOverviewData */}
              {pacingOverviewData
                .sort((a, b) => {
                  const statusOrder = { red: 0, yellow: 1, green: 2 };
                  return (
                    statusOrder[
                      a.currentMonthStatus as keyof typeof statusOrder
                    ] -
                    statusOrder[
                      b.currentMonthStatus as keyof typeof statusOrder
                    ]
                  );
                })
                .map((hotel, index) => {
                  // [MODIFIED] Logic simplified as API does not provide 'statusText'
                  const currentStatusConfig = {
                    red: { label: "At Risk" },
                    yellow: { label: "Slightly Behind" },
                    green: { label: "On Target" },
                  };

                  const statusColorMap = {
                    red: "bg-[#ef4444]",
                    yellow: "bg-[#f59e0b]",
                    green: "bg-[#10b981]",
                  };

                  const current =
                    currentStatusConfig[
                      hotel.currentMonthStatus as keyof typeof currentStatusConfig
                    ];

                  return (
                    <div
                      key={`trend-${hotel.hotelName}`}
                      style={{
                        ...styles.cardRow,
                        ...styles.grid12,
                        ...styles.textSm,
                        borderTop: index === 0 ? "none" : "1px solid #3a3a35",
                      }}
                    >
                      <div style={{ ...styles.colSpan3, ...styles.textWhite }}>
                        {hotel.hotelName}
                      </div>

                      <div style={styles.colSpan2}>
                        <Badge
                          className={
                            hotel.currentMonthStatus === "red"
                              ? "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40"
                              : hotel.currentMonthStatus === "yellow"
                              ? "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40"
                              : "bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40"
                          }
                        >
                          {current.label}
                        </Badge>
                      </div>

                      <div style={{ ...styles.colSpan2, ...styles.textRight }}>
                        <span
                          style={
                            hotel.currentMonthShortfall < 0
                              ? styles.textRedLight
                              : styles.textGreen
                          }
                        >
                          {hotel.currentMonthShortfall < 0 ? "-" : "+"}£
                          {Math.abs(hotel.currentMonthShortfall).toLocaleString(
                            undefined,
                            { maximumFractionDigits: 0 }
                          )}
                        </span>
                      </div>

                      <div style={{ ...styles.colSpan2, ...styles.textRight }}>
                        <span
                          style={
                            hotel.currentMonthStatus === "red"
                              ? styles.textYellow
                              : styles.textWhite
                          }
                        >
                          {/* [MODIFIED] Handle 'Infinity' case */}
                          {hotel.currentMonthRequiredADR > 90000
                            ? "N/A"
                            : `£${hotel.currentMonthRequiredADR.toFixed(2)}`}
                        </span>
                      </div>

                      {/* [MODIFIED] This column now only shows the *one* next month we have data for */}
                      <div
                        style={{
                          ...styles.colSpan3,
                          ...styles.flex,
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div style={styles.flexGap2}>
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "4px",
                              backgroundColor: statusColorMap[
                                hotel.nextMonthStatus as keyof typeof statusColorMap
                              ].replace("bg-", ""),
                            }}
                            title="Next Month"
                          ></div>
                        </div>
                        <span style={{ ...styles.pXSmall, marginLeft: "8px" }}>
                          Next Month
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
