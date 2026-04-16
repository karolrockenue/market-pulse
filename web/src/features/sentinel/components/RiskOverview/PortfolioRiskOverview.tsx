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
import { toast } from "sonner";
import { PortfolioFlowcast } from "./PortfolioFlowcast";
import { R } from "@/styles/tokens";

// --- Currency symbol helper ---
const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  IDR: "Rp",
};

function getCurrencySymbol(currencyCode?: string): string {
  const code = (currencyCode || "GBP").toUpperCase();
  return CURRENCY_SYMBOLS[code] || code + " ";
}

// --- Quadrant → Color map ---
const QUADRANT_COLORS: Record<string, string> = {
  "Critical Risk": R.red,
  "Fill Risk": R.gold,
  "Rate Strategy Risk": R.warmTeal,
  "On Pace": R.green,
};

function normalizeQuadrant(q: unknown): string {
  if (typeof q !== "string") return "";
  return q.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function colorForQuadrant(q: unknown): string {
  const key = normalizeQuadrant(q);
  return QUADRANT_COLORS[key] ?? R.textMid;
}

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

function normQuad(q: any): string {
  return (typeof q === "string" ? q.normalize("NFKC") : "")
    .replace(/\s+/g, " ")
    .trim();
}

function colorFromPayload(payload: any): string {
  const x = num(
    payload?.forwardOccupancy ?? payload?.forward_occupancy ?? payload?.x
  );
  const y = num(
    payload?.pacingDifficultyPercent ??
      payload?.pacing_difficulty_percent ??
      payload?.y
  );
  if (!Number.isFinite(x) || !Number.isFinite(y)) return R.textMid;
  if (x < 60 && y < 115) return R.gold;
  if (x < 60 && y >= 115) return R.red;
  if (x >= 60 && y >= 115) return R.warmTeal;
  return R.green;
}

const DotByPayload = (props: any) => {
  const { cx, cy, r = 5, payload } = props;
  if (cx == null || cy == null) return null;
  const fill = colorFromPayload(payload);
  return <circle cx={cx} cy={cy} r={r} fill={fill} />;
};

const DotShape = (props: any) => {
  const { cx, cy, r = 4, fill, stroke, strokeWidth = 0 } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  );
};

// --- Helper functions ---
const getOccupancyColor = (value: number) => {
  if (value >= 100) return { backgroundColor: `${R.warmTeal}30`, borderColor: `${R.warmTeal}50` };
  if (value >= 80) return { backgroundColor: `${R.green}25`, borderColor: `${R.green}40` };
  if (value >= 70) return { backgroundColor: `${R.warmTeal}20`, borderColor: `${R.warmTeal}40` };
  if (value >= 50) return { backgroundColor: `${R.gold}20`, borderColor: `${R.gold}30` };
  if (value >= 40) return { backgroundColor: `${R.gold}30`, borderColor: `${R.gold}50` };
  return { backgroundColor: `${R.red}40`, borderColor: `${R.red}60` };
};

const getOccupancyTextColor = (value: number) => {
  if (value >= 100) return { color: R.warmTeal };
  if (value >= 80) return { color: R.green };
  if (value >= 70) return { color: R.warmTeal };
  if (value >= 50) return { color: R.gold };
  if (value >= 40) return { color: R.gold };
  return { color: R.red };
};

const getPaceVarianceColor = (variance: number) => {
  if (variance < -30) return { backgroundColor: `${R.red}40`, borderColor: `${R.red}60` };
  if (variance < -10) return { backgroundColor: `${R.red}20`, borderColor: `${R.red}40` };
  if (variance <= 10) return { backgroundColor: R.border, borderColor: R.textDim };
  return { backgroundColor: `${R.green}25`, borderColor: `${R.green}40` };
};

const getPaceVarianceTextColor = (variance: number) => {
  if (variance < -30) return { color: R.red };
  if (variance < -10) return { color: R.red };
  if (variance <= 10) return { color: R.textMid };
  return { color: R.green };
};

const detectAnomalies = (matrixData: any[]) => {
  const anomalies: { day: number; type: "drop" | "persistent" | "overbooked" }[] = [];
  for (let i = 1; i < matrixData.length; i++) {
    const diff = matrixData[i - 1].occupancy - matrixData[i].occupancy;
    if (diff >= 15) anomalies.push({ day: i, type: "drop" });
  }
  let lowCount = 0;
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy < 50) {
      lowCount++;
      if (lowCount >= 7 && !anomalies.some((a) => a.day === i && a.type === "persistent")) {
        anomalies.push({ day: i, type: "persistent" });
      }
    } else {
      lowCount = 0;
    }
  }
  for (let i = 0; i < matrixData.length; i++) {
    if (matrixData[i].occupancy > 100) anomalies.push({ day: i, type: "overbooked" });
  }
  return anomalies;
};

const QuadrantTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
        <div style={{ color: R.accent, fontSize: 13, marginBottom: 4 }}>{data.hotelName}</div>
        <div style={{ color: R.textMid, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Occ: <span style={{ color: R.accent }}>{data.forwardOccupancy.toFixed(1)}%</span>
        </div>
        <div style={{ color: R.textMid, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Pressure: <span style={{ color: R.accent }}>{data.pacingDifficultyPercent.toFixed(1)}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export function PortfolioRiskOverview() {
  const [isLoading, setIsLoading] = useState(true);
  const [occupancyProblemList, setOccupancyProblemList] = useState<any[]>([]);
  const [pacingOverviewData, setPacingOverviewData] = useState<any[]>([]);
  const [occupancyMatrixData, setOccupancyMatrixData] = useState<any[]>([]);

  const [matrixMetric, setMatrixMetric] = useState<"occupancy" | "adr" | "available">("occupancy");
  const [matrixDays, setMatrixDays] = useState<number>(45);
  const [sortByRisk, setSortByRisk] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedHotel, setSelectedHotel] = useState<string>("all");
  const [hotelSearchOpen, setHotelSearchOpen] = useState(false);

  const [globalSelectedGroup, setGlobalSelectedGroup] = useState<string>("all");
  const [globalSelectedHotel, setGlobalSelectedHotel] = useState<string>("all");
  const [globalHotelSearchOpen, setGlobalHotelSearchOpen] = useState(false);
  const [viewType, setViewType] = useState<"group" | "individual">("group");
  const [allHotels, setAllHotels] = useState<any[]>([]);

  const globalHotelGroups = useMemo(() => {
    const groups = new Set(allHotels.map((h) => h.management_group).filter(Boolean));
    return Array.from(groups).sort();
  }, [allHotels]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (globalSelectedHotel !== "all") {
          params.append("hotelId", globalSelectedHotel);
        } else if (globalSelectedGroup !== "all") {
          params.append("group", globalSelectedGroup);
        }
        const queryString = params.toString();
        const query = queryString ? `?${queryString}` : "";
        const [occProblemRes, pacingRes, matrixRes] = await Promise.all([
          fetch(`/api/metrics/portfolio/occupancy-problems${query}`),
          fetch(`/api/metrics/portfolio/pacing${query}`),
          fetch(`/api/metrics/portfolio/matrix${query}`),
        ]);

        if (!occProblemRes.ok) throw new Error("Failed to fetch occupancy problem list");
        if (!pacingRes.ok) throw new Error("Failed to fetch pacing overview");
        if (!matrixRes.ok) throw new Error("Failed to fetch occupancy matrix");

        const occProblemData = await occProblemRes.json();
        const pacingData = await pacingRes.json();
        const matrixData = await matrixRes.json();

        setOccupancyProblemList(occProblemData);
        setPacingOverviewData(pacingData);
        setOccupancyMatrixData(matrixData);
      } catch (error: any) {
        console.error("Error fetching portfolio data:", error);
        toast.error("Failed to load portfolio data", { description: error.message });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [globalSelectedGroup, globalSelectedHotel]);

  useEffect(() => {
    const fetchAllHotels = async () => {
      try {
        const response = await fetch("/api/hotels");
        if (!response.ok) throw new Error("Failed to fetch hotel list for filters");
        const data = await response.json();
        setAllHotels(Array.isArray(data) ? data : []);
      } catch (error: any) {
        console.error("Error fetching filter data:", error);
        setAllHotels([]);
        toast.error("Failed to load filter options", { description: error.message });
      }
    };
    fetchAllHotels();
  }, []);

  const matrixDates = Array.from({ length: matrixDays }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  let filteredHotels = occupancyMatrixData;
  if (selectedHotel !== "all") {
    filteredHotels = occupancyMatrixData.filter((h) => h.name === selectedHotel);
  } else if (selectedGroup !== "all") {
    filteredHotels = occupancyMatrixData.filter((h) => h.group === selectedGroup);
  }

  const sortedHotels = sortByRisk
    ? [...filteredHotels].sort((a, b) => {
        const aRisk = a.occupancy < 45 ? 0 : a.occupancy < 60 ? 1 : 2;
        const bRisk = b.occupancy < 45 ? 0 : b.occupancy < 60 ? 1 : 2;
        if (aRisk !== bRisk) return aRisk - bRisk;
        return a.occupancy - b.occupancy;
      })
    : filteredHotels;

  const avgPortfolioOcc =
    occupancyMatrixData.length > 0
      ? occupancyMatrixData.reduce((sum, h) => sum + h.occupancy, 0) / occupancyMatrixData.length
      : 0;

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", padding: "24px 36px" }}>
      {/* Loading Overlay */}
      {isLoading && (
        <div style={{ position: "fixed", inset: 0, background: `${R.bg}e6`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50, backdropFilter: "blur(4px)" }}>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 40, height: 40, border: `3px solid ${R.warmTeal}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ color: R.textDim, marginTop: 16, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Loading Portfolio Intelligence...</p>
        </div>
      )}

      {/* Page Header */}
      <div style={{ marginBottom: 24, borderBottom: `1px solid ${R.border}`, paddingBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold, marginBottom: 6 }}>SENTINEL</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.8, margin: 0, color: R.accent }}>Risk Overview</h1>
        <p style={{ fontSize: 13, color: R.textDim, margin: "4px 0 0" }}>
          Next 30-day availability risk across all managed properties
        </p>
      </div>

      {/* Global Filter Bar */}
      <div style={{ marginBottom: 24, background: R.darkBand, borderRadius: 10, border: `1px solid ${R.border}`, padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: R.textDim, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>View:</span>

          <div style={{ display: "flex", gap: 8, padding: 4 }}>
            <button
              onClick={() => { setViewType("individual"); setGlobalSelectedHotel("all"); }}
              style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 8, background: viewType === "individual" ? R.border : "transparent", color: viewType === "individual" ? R.accent : R.textDim, border: "none", cursor: "pointer", transition: "all 0.2s" }}
            >
              <User size={14} /> Individual Hotel
            </button>
            <button
              onClick={() => { setViewType("group"); setGlobalSelectedGroup("all"); }}
              style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 8, background: viewType === "group" ? R.border : "transparent", color: viewType === "group" ? R.accent : R.textDim, border: "none", cursor: "pointer", transition: "all 0.2s" }}
            >
              <Building2 size={14} /> Group/Portfolio
            </button>
          </div>

          <div style={{ height: 24, width: 1, background: R.border }} />

          {viewType === "individual" ? (
            <Popover open={globalHotelSearchOpen} onOpenChange={setGlobalHotelSearchOpen}>
              <PopoverTrigger asChild>
                <button
                  style={{ width: 240, justifyContent: "space-between", background: R.sidebar, border: `1px solid ${R.border}`, color: R.accent, height: 36, padding: "0 12px", borderRadius: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  role="combobox"
                  aria-expanded={globalHotelSearchOpen}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <User size={14} style={{ color: R.textDim, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {globalSelectedHotel === "all" ? "Select Hotel..." : allHotels.find((h) => h.hotel_id.toString() === globalSelectedHotel)?.property_name || "Select Hotel..."}
                    </span>
                  </div>
                  <ChevronsUpDown size={16} style={{ color: R.textDim, flexShrink: 0 }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" style={{ background: R.darkBand, border: `1px solid ${R.border}` }} align="start">
                <Command style={{ background: R.darkBand }}>
                  <CommandInput placeholder="Type to search hotels..." style={{ color: R.accent, borderBottom: `1px solid ${R.border}` }} className="placeholder:text-[#4E5868]" />
                  <CommandList style={{ background: R.darkBand }}>
                    <CommandEmpty style={{ color: R.textDim, fontSize: 14, padding: 24, textAlign: "center" }}>No hotel found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { setGlobalSelectedHotel("all"); setGlobalHotelSearchOpen(false); }} style={{ color: R.accent }} className="aria-selected:bg-[#1E2330] aria-selected:text-[#F3F5F7]">
                        <Check style={{ marginRight: 8, height: 16, width: 16, opacity: globalSelectedHotel === "all" ? 1 : 0 }} />
                        All Hotels ({allHotels.length})
                      </CommandItem>
                      {allHotels.map((hotel) => (
                        <CommandItem key={hotel.hotel_id} value={hotel.property_name || `Hotel ${hotel.hotel_id}`} onSelect={() => { setGlobalSelectedHotel(hotel.hotel_id.toString()); setGlobalHotelSearchOpen(false); }} style={{ color: R.accent }} className="aria-selected:bg-[#1E2330] aria-selected:text-[#F3F5F7]">
                          <Check style={{ marginRight: 8, height: 16, width: 16, opacity: globalSelectedHotel === hotel.hotel_id.toString() ? 1 : 0 }} />
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{hotel.property_name || `Hotel ${hotel.hotel_id}`}</span>
                            <span style={{ color: R.textDim, fontSize: 12 }}>{hotel.management_group}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <Select value={globalSelectedGroup} onValueChange={setGlobalSelectedGroup}>
              <SelectTrigger className="w-[240px] h-9 text-xs" style={{ background: R.sidebar, border: `1px solid ${R.border}`, color: R.accent }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={14} style={{ color: R.textDim }} />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent style={{ background: R.darkBand, border: `1px solid ${R.border}` }}>
                <SelectItem value="all" className="text-[#F3F5F7] focus:bg-[#1E2330] focus:text-[#F3F5F7] text-xs">
                  All Groups ({globalHotelGroups.length} groups, {allHotels.length} hotels)
                </SelectItem>
                {globalHotelGroups.map((group) => (
                  <SelectItem key={group} value={group} className="text-[#F3F5F7] focus:bg-[#1E2330] focus:text-[#F3F5F7] text-xs">
                    {group} ({allHotels.filter((h) => h.management_group === group).length} hotels)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div style={{ flex: 1 }} />

          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: R.green }} />
              <span style={{ color: R.textDim, fontSize: 12 }}>
                Viewing:{" "}
                <span style={{ color: R.accent }}>
                  {viewType === "individual"
                    ? globalSelectedHotel === "all"
                      ? "All Individual Hotels"
                      : allHotels.find((h) => h.hotel_id.toString() === globalSelectedHotel)?.property_name
                    : globalSelectedGroup === "all"
                    ? "All Portfolio"
                    : globalSelectedGroup}
                </span>
                {viewType === "group" && <span style={{ color: R.textDim, marginLeft: 4 }}>({pacingOverviewData.length} hotels)</span>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          {
            label: viewType === "individual" && globalSelectedHotel !== "all" ? "Selected Hotel" : "Portfolio Hotels",
            value: String(pacingOverviewData.length || 0),
            sub: "ACTIVE PROPERTIES",
            icon: Building2,
            color: R.warmTeal,
          },
          {
            label: "Critical Risk",
            value: String(pacingOverviewData.filter((h) => num(h.forwardOccupancy) < 60 && num(h.pacingDifficultyPercent) >= 115).length),
            sub: "QUADRANT ALIGNED",
            icon: AlertTriangle,
            color: R.red,
            pct: (pacingOverviewData.filter((h) => num(h.forwardOccupancy) < 60 && num(h.pacingDifficultyPercent) >= 115).length / Math.max(pacingOverviewData.length, 1)) * 100,
          },
          {
            label: "Risk Warnings",
            value: String(pacingOverviewData.filter((h) => { const occ = num(h.forwardOccupancy); const p = num(h.pacingDifficultyPercent); return !(occ < 60 && p >= 115) && !(occ >= 60 && p < 115); }).length),
            sub: "FILL or RATE RISK",
            icon: AlertCircle,
            color: R.gold,
            pct: (pacingOverviewData.filter((h) => { const occ = num(h.forwardOccupancy); const p = num(h.pacingDifficultyPercent); return !(occ < 60 && p >= 115) && !(occ >= 60 && p < 115); }).length / Math.max(pacingOverviewData.length, 1)) * 100,
          },
          {
            label: `Avg ${viewType === "group" ? "Portfolio" : "Selected"} Occ.`,
            value: pacingOverviewData.length > 0 ? `${(pacingOverviewData.reduce((sum, h) => sum + num(h.forwardOccupancy), 0) / pacingOverviewData.length).toFixed(0)}` : "0",
            valueSuffix: "%",
            sub: "30-DAY FWD",
            icon: Activity,
            color: R.warmTeal,
            pct: pacingOverviewData.length > 0 ? Math.round(pacingOverviewData.reduce((sum, h) => sum + num(h.forwardOccupancy), 0) / pacingOverviewData.length) : 0,
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Icon size={14} color={kpi.color} />
                <span style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: kpi.color, letterSpacing: -1, lineHeight: 1, marginBottom: 8 }}>
                {kpi.value}
                {kpi.valueSuffix && <span style={{ fontSize: 20, color: R.textDim }}>{kpi.valueSuffix}</span>}
              </div>
              {kpi.pct !== undefined ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: R.border, borderRadius: 9999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${kpi.pct}%`, background: kpi.color, opacity: 0.8, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ color: R.textDim, fontSize: 10, fontFamily: "monospace" }}>{kpi.sub}</span>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: R.textDim }}>{kpi.sub}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Risk Quadrant Analysis */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Risk Matrix</div>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: R.accent }}>Quadrant Analysis</div>
          <div style={{ fontSize: 12, color: R.textMid, marginTop: 2 }}>Strategic diagnostic tool — combines volume and budget pacing risk</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          {/* Scatter Plot */}
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 20 }}>
            <div style={{ position: "relative", height: 520 }}>
              {/* Quadrant Background */}
              <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 1, pointerEvents: "none", zIndex: 0 }}>
                <div style={{ background: `${R.gold}08` }} />
                <div style={{ background: `${R.green}08` }} />
                <div style={{ background: `${R.red}08` }} />
                <div style={{ background: `${R.warmTeal}08` }} />
              </div>

              {/* Quadrant Labels */}
              <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, background: R.darkBand, border: `1px solid ${R.gold}30`, borderRadius: 6, padding: "4px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, background: R.gold, borderRadius: "50%" }} />
                  <span style={{ color: R.gold, fontSize: 12 }}>Fill Risk</span>
                </div>
              </div>
              <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10, background: R.darkBand, border: `1px solid ${R.green}30`, borderRadius: 6, padding: "4px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, background: R.green, borderRadius: "50%" }} />
                  <span style={{ color: R.green, fontSize: 12 }}>On Pace</span>
                </div>
              </div>
              <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 10, background: R.darkBand, border: `1px solid ${R.red}30`, borderRadius: 6, padding: "4px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, background: R.red, borderRadius: "50%" }} />
                  <span style={{ color: R.red, fontSize: 12 }}>Critical Risk</span>
                </div>
              </div>
              <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 10, background: R.darkBand, border: `1px solid ${R.warmTeal}30`, borderRadius: 6, padding: "4px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, background: R.warmTeal, borderRadius: "50%" }} />
                  <span style={{ color: R.warmTeal, fontSize: 12 }}>Rate Strategy Risk</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height="100%" style={{ position: "relative", zIndex: 5 }}>
                <ScatterChart margin={{ top: 30, right: 30, bottom: 60, left: 80 }}>
                  <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.3} />
                  <XAxis type="number" dataKey="forwardOccupancy" name="Forward Volume (Occupancy %)" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} label={{ value: "Forward Volume (Occupancy %)", position: "bottom", fill: R.textMid, offset: 30, style: { fontSize: 10 } }} />
                  <YAxis type="number" dataKey="pacingDifficultyPercent" name="Pacing Rate Pressure (%)" reversed={true} domain={[0, "auto"]} ticks={[0, 50, 100, 115, 200, 300, 400, 500]} stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`} label={{ value: "Pacing Rate Pressure (%)", angle: -90, position: "insideLeft", fill: R.textMid, offset: -50, style: { fontSize: 10, textAnchor: "middle" } }} />
                  <ZAxis range={[100, 100]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3", stroke: R.warmTeal }} content={<QuadrantTooltip />} />
                  <ReferenceLine y={115} stroke={R.warmTeal} strokeWidth={1} strokeDasharray="5 5" />
                  <ReferenceLine x={60} stroke={R.warmTeal} strokeWidth={1} strokeDasharray="5 5" />
                  <Scatter name="Hotels" data={pacingOverviewData} shape={DotByPayload} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quadrant Summary */}
          <div style={{ height: 520, display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Critical Risk */}
            <div style={{ flex: 1, background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, borderLeft: `3px solid ${R.red}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexShrink: 0 }}>
                <AlertCircle size={14} color={R.red} />
                <span style={{ color: R.red, fontSize: 13, fontWeight: 600 }}>Critical Risk</span>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: R.red }}>{pacingOverviewData.filter((d) => num(d.forwardOccupancy) < 60 && num(d.pacingDifficultyPercent) >= 115).length}</span>
              </div>
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                {pacingOverviewData.filter((d) => num(d.forwardOccupancy) < 60 && num(d.pacingDifficultyPercent) >= 115).sort((a, b) => num(b.pacingDifficultyPercent) - num(a.pacingDifficultyPercent)).map((hotel, i) => (
                  <div key={i} style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 6, padding: 8 }}>
                    <div style={{ color: R.accent, fontSize: 12, marginBottom: 2, fontWeight: 500 }}>{hotel.hotelName}</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: R.textDim, fontSize: 11 }}>Occ: {num(hotel.forwardOccupancy).toFixed(0)}%</span>
                      <span style={{ color: R.red, fontSize: 11 }}>{num(hotel.pacingDifficultyPercent).toFixed(0)}% Pressure</span>
                    </div>
                  </div>
                ))}
                {pacingOverviewData.filter((d) => num(d.forwardOccupancy) < 60 && num(d.pacingDifficultyPercent) >= 115).length === 0 && (
                  <div style={{ color: R.textDim, fontSize: 12, fontStyle: "italic", padding: 8 }}>No hotels in critical risk.</div>
                )}
              </div>
            </div>

            {/* Rate Strategy Risk */}
            <div style={{ flex: 1, background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, borderLeft: `3px solid ${R.warmTeal}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexShrink: 0 }}>
                <Target size={14} color={R.warmTeal} />
                <span style={{ color: R.warmTeal, fontSize: 13, fontWeight: 600 }}>Rate Strategy Risk</span>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: R.warmTeal }}>{pacingOverviewData.filter((d) => num(d.forwardOccupancy) >= 60 && num(d.pacingDifficultyPercent) >= 115).length}</span>
              </div>
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                {pacingOverviewData.filter((d) => num(d.forwardOccupancy) >= 60 && num(d.pacingDifficultyPercent) >= 115).sort((a, b) => num(b.pacingDifficultyPercent) - num(a.pacingDifficultyPercent)).map((hotel, i) => (
                  <div key={i} style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 6, padding: 8 }}>
                    <div style={{ color: R.accent, fontSize: 12, marginBottom: 2, fontWeight: 500 }}>{hotel.hotelName}</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: R.textDim, fontSize: 11 }}>Occ: {num(hotel.forwardOccupancy).toFixed(0)}%</span>
                      <span style={{ color: R.warmTeal, fontSize: 11 }}>{num(hotel.pacingDifficultyPercent).toFixed(0)}% Pressure</span>
                    </div>
                  </div>
                ))}
                {pacingOverviewData.filter((d) => num(d.forwardOccupancy) >= 60 && num(d.pacingDifficultyPercent) >= 115).length === 0 && (
                  <div style={{ color: R.textDim, fontSize: 12, fontStyle: "italic", padding: 8 }}>No hotels in rate risk.</div>
                )}
              </div>
            </div>

            {/* Fill Risk */}
            <div style={{ flex: 1, background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, borderLeft: `3px solid ${R.gold}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexShrink: 0 }}>
                <AlertTriangle size={14} color={R.gold} />
                <span style={{ color: R.gold, fontSize: 13, fontWeight: 600 }}>Fill Risk</span>
                <span style={{ marginLeft: "auto", fontSize: 18, fontWeight: 700, color: R.gold }}>{pacingOverviewData.filter((d) => num(d.forwardOccupancy) < 60 && num(d.pacingDifficultyPercent) < 115).length}</span>
              </div>
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                {pacingOverviewData.filter((d) => num(d.forwardOccupancy) < 60 && num(d.pacingDifficultyPercent) < 115).sort((a, b) => num(a.forwardOccupancy) - num(b.forwardOccupancy)).map((hotel, i) => (
                  <div key={i} style={{ background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 6, padding: 8 }}>
                    <div style={{ color: R.accent, fontSize: 12, marginBottom: 2, fontWeight: 500 }}>{hotel.hotelName}</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: R.textDim, fontSize: 11 }}>Pressure: {num(hotel.pacingDifficultyPercent).toFixed(0)}%</span>
                      <span style={{ color: R.gold, fontSize: 11 }}>{num(hotel.forwardOccupancy).toFixed(0)}% Occ</span>
                    </div>
                  </div>
                ))}
                {pacingOverviewData.filter((d) => num(d.forwardOccupancy) < 60 && num(d.pacingDifficultyPercent) < 115).length === 0 && (
                  <div style={{ color: R.textDim, fontSize: 12, fontStyle: "italic", padding: 8 }}>No hotels in fill risk.</div>
                )}
              </div>
            </div>

            {/* On Pace */}
            <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 14, borderLeft: `3px solid ${R.green}`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={14} color={R.green} />
                <span style={{ color: R.green, fontSize: 13, fontWeight: 600 }}>On Pace</span>
                <span style={{ marginLeft: "auto", color: R.green, fontSize: 18, fontWeight: 700 }}>
                  {pacingOverviewData.filter((d) => num(d.forwardOccupancy) >= 60 && num(d.pacingDifficultyPercent) < 115).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Flowcast */}
      <PortfolioFlowcast
        startDate={new Date()}
        globalGroupFilter={selectedGroup !== "all" ? selectedGroup : globalSelectedGroup}
        globalHotelFilter={selectedHotel !== "all" ? selectedHotel : globalSelectedHotel}
      />

      {/* Occupancy Matrix */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Portfolio View</div>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: R.accent }}>Occupancy Matrix</div>
          <p style={{ color: R.textMid, fontSize: 12, marginTop: 2 }}>Dense at-a-glance view of all properties vs next 45 days</p>
        </div>

        {/* Controls Bar */}
        <div style={{ marginBottom: 16, background: R.darkBand, borderRadius: 10, border: `1px solid ${R.border}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Filter size={16} color={R.textDim} style={{ marginRight: 8 }} />
            <div style={{ display: "flex", gap: 8, padding: 4 }}>
              {(["occupancy", "adr", "available"] as const).map((metric) => (
                <button
                  key={metric}
                  onClick={() => setMatrixMetric(metric)}
                  style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, transition: "all 0.2s", background: matrixMetric === metric ? R.border : "transparent", color: matrixMetric === metric ? R.accent : R.textDim, border: "none", cursor: "pointer" }}
                >
                  {metric === "occupancy" ? "Occupancy %" : metric === "adr" ? "ADR" : "Rooms Available"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSortByRisk(!sortByRisk)}
              style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, background: sortByRisk ? R.red : "transparent", color: sortByRisk ? R.accent : R.textMid, border: sortByRisk ? "none" : `1px solid ${R.border}`, cursor: "pointer", transition: "all 0.2s" }}
            >
              {sortByRisk ? "Showing Highest Risk First" : "Sort by Risk"}
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {[
              { label: "<40%", value: 30 },
              { label: "40-70%", value: 55 },
              { label: "70-80%", value: 75 },
              { label: "80-100%", value: 90 },
              { label: ">100%", value: 101 },
            ].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, ...getOccupancyColor(l.value), borderRadius: 4 }} />
                <span style={{ fontSize: 12, color: R.textMid }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Matrix Table */}
        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "inline-block", minWidth: "100%" }}>
              {/* Header Row */}
              <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 10, background: R.darkBand, borderBottom: `1px solid ${R.border}` }}>
                <div style={{ position: "sticky", left: 0, zIndex: 20, background: R.darkBand, borderRight: `1px solid ${R.border}`, width: 240, flexShrink: 0, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>Hotel</div>
                </div>
                <div style={{ display: "flex" }}>
                  {matrixDates.map((date, i) => {
                    const isToday = i === 0;
                    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" });
                    const dayOfMonth = date.getDate();
                    const month = date.toLocaleDateString("en-US", { month: "short" });
                    return (
                      <div key={i} style={{ width: 56, flexShrink: 0, padding: "8px 4px", textAlign: "center", ...(isToday ? { background: `${R.warmTeal}10`, borderLeft: `2px solid ${R.warmTeal}` } : {}) }}>
                        <div style={{ fontSize: 10, color: isToday ? R.warmTeal : R.textDim }}>{dayOfWeek}</div>
                        <div style={{ fontSize: 12, color: isToday ? R.warmTeal : R.textMid }}>{month} {dayOfMonth}</div>
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
                    <div key={hotel.id} style={{ display: "flex", borderBottom: `1px solid ${R.sep}` }}>
                      <div style={{ position: "sticky", left: 0, zIndex: 10, background: R.darkBand, borderRight: `1px solid ${R.border}`, width: 240, flexShrink: 0, padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ color: R.accent, fontSize: 14 }}>{hotel.name}</div>
                        </div>
                        {hotel.riskLevel === "critical" && <AlertCircle size={16} color={R.red} />}
                        {hotel.riskLevel === "moderate" && <AlertTriangle size={16} color={R.gold} />}
                      </div>
                      <div style={{ display: "flex" }}>
                        {hotel.matrixData.slice(0, matrixDays).map((dayData: any, dayIndex: number) => {
                          const isToday = dayIndex === 0;
                          const value = matrixMetric === "occupancy" ? dayData.occupancy : matrixMetric === "adr" ? dayData.adr : dayData.available;
                          const anomaly = anomalies.find((a) => a.day === dayIndex);
                          const colorStyle = matrixMetric === "occupancy" ? getOccupancyColor(value) : {};
                          const textStyle = matrixMetric === "occupancy" ? getOccupancyTextColor(value) : { color: R.accent };

                          return (
                            <div key={dayIndex} className="group" style={{ width: 56, flexShrink: 0, padding: 4, textAlign: "center", position: "relative", ...(isToday ? { background: `${R.warmTeal}08`, borderLeft: `2px solid ${R.warmTeal}` } : {}) }}>
                              <div style={{ borderWidth: 1, borderRadius: 2, padding: "2px 4px", fontSize: 11, position: "relative", height: 24, display: "flex", alignItems: "center", justifyContent: "center", ...(matrixMetric === "occupancy" ? colorStyle : { background: R.sidebar }), ...textStyle, fontVariantNumeric: "tabular-nums" }}>
                                {matrixMetric === "occupancy" && `${value.toFixed(0)}%`}
                                {matrixMetric === "adr" && `${getCurrencySymbol(hotel.currencyCode)}${value.toFixed(0)}`}
                                {matrixMetric === "available" && value}
                                {anomaly && (
                                  <div style={{ position: "absolute", top: -4, right: -4 }}>
                                    {anomaly.type === "drop" && <TrendingDown size={12} color={R.red} />}
                                    {anomaly.type === "persistent" && <AlertTriangle size={12} color={R.gold} />}
                                    {anomaly.type === "overbooked" && <div style={{ width: 12, height: 12, background: R.warmTeal, borderRadius: "50%" }} />}
                                  </div>
                                )}
                              </div>
                              <div className="matrix-tooltip" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "100%", marginBottom: 4, background: R.sidebar, border: `1px solid ${R.border}`, borderRadius: 6, padding: 8, zIndex: 30, opacity: 0, pointerEvents: "none", transition: "opacity 0.2s", whiteSpace: "nowrap", fontSize: 11 }}>
                                <div style={{ color: R.accent, marginBottom: 4 }}>{hotel.name}</div>
                                <div style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{matrixDates[dayIndex].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                                <div style={{ borderTop: `1px solid ${R.border}`, marginTop: 4, paddingTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ color: R.textDim }}>Occupancy:</span>
                                    <span style={{ ...getOccupancyTextColor(dayData.occupancy), fontSize: 12 }}>{dayData.occupancy.toFixed(1)}%</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ color: R.textDim }}>ADR:</span>
                                    <span style={{ color: R.accent, fontSize: 12 }}>{getCurrencySymbol(hotel.currencyCode)}{dayData.adr.toFixed(0)}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ color: R.textDim }}>Available:</span>
                                    <span style={{ color: R.accent, fontSize: 12 }}>{dayData.available} rooms</span>
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
        <style>{`.group:hover .matrix-tooltip { opacity: 1; pointer-events: auto; }`}</style>
      </div>

      {/* Budget Pacing Problem List */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Tactical</div>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, color: R.accent }}>Budget Pacing Problem List</div>
          <p style={{ color: R.textMid, fontSize: 12, marginTop: 2 }}>Sorted by most urgent budget risk</p>
        </div>

        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
          {/* Table Header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", padding: "12px 16px", background: R.sidebar, borderBottom: `1px solid ${R.border}`, fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <div style={{ gridColumn: "span 3" }}>Hotel Name</div>
            <div style={{ gridColumn: "span 2" }}>Current Month Status</div>
            <div style={{ gridColumn: "span 2", textAlign: "right" }}>Current Month Shortfall</div>
            <div style={{ gridColumn: "span 2", textAlign: "right" }}>Required ADR</div>
            <div style={{ gridColumn: "span 3", textAlign: "center" }}>Next Month Status</div>
          </div>

          {/* Table Rows */}
          <div>
            {pacingOverviewData
              .sort((a, b) => {
                const statusOrder = { red: 0, yellow: 1, green: 2 };
                return (statusOrder[a.currentMonthStatus as keyof typeof statusOrder] || 2) - (statusOrder[b.currentMonthStatus as keyof typeof statusOrder] || 2);
              })
              .map((hotel, index) => {
                const currentStatusConfig: Record<string, { label: string }> = {
                  red: { label: "At Risk" },
                  yellow: { label: "Slightly Behind" },
                  green: { label: "On Target" },
                };
                const current = currentStatusConfig[hotel.currentMonthStatus as string] || { label: "Unknown" };

                const statusColorMap: Record<string, string> = { red: R.red, yellow: R.gold, green: R.green };
                const statusColor = statusColorMap[hotel.nextMonthStatus as string] || R.textDim;

                return (
                  <div
                    key={`trend-${hotel.hotelName}`}
                    style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", padding: "12px 16px", fontSize: 14, borderTop: index === 0 ? "none" : `1px solid ${R.sep}`, alignItems: "center" }}
                  >
                    <div style={{ gridColumn: "span 3", color: R.accent }}>{hotel.hotelName}</div>
                    <div style={{ gridColumn: "span 2" }}>
                      <Badge className={
                        hotel.currentMonthStatus === "red"
                          ? "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40"
                          : hotel.currentMonthStatus === "yellow"
                          ? "bg-[#C8A66E]/20 text-[#C8A66E] border-[#C8A66E]/40"
                          : "bg-[#34D068]/20 text-[#34D068] border-[#34D068]/40"
                      }>
                        {current.label}
                      </Badge>
                    </div>
                    <div style={{ gridColumn: "span 2", textAlign: "right" }}>
                      <span style={{ color: hotel.currentMonthShortfall < 0 ? R.red : R.green }}>
                        {hotel.currentMonthShortfall < 0 ? "-" : "+"}{getCurrencySymbol(hotel.currencyCode)}
                        {Math.abs(hotel.currentMonthShortfall).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div style={{ gridColumn: "span 2", textAlign: "right" }}>
                      <span style={{ color: hotel.currentMonthStatus === "red" ? R.warmTeal : R.accent }}>
                        {hotel.currentMonthRequiredADR > 90000 ? "N/A" : `${getCurrencySymbol(hotel.currencyCode)}${hotel.currentMonthRequiredADR.toFixed(2)}`}
                      </span>
                    </div>
                    <div style={{ gridColumn: "span 3", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: statusColor }} />
                      <span style={{ color: R.textDim, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Next Month</span>
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
