import { type SnapshotPeriod, type PatternDay, type Rank } from "../types";

// --- NEW INTERFACES ---
export interface FlowcastDay {
  date: string;
  fullDate: string;
  occupancy: number;
  pickup24h: number;
  pickup3d: number;
  pickup7d: number;
  baseOccupancy24h: number;
  baseOccupancy3d: number;
  baseOccupancy7d: number;
  isWeekend: boolean;
}

export interface RecentActivityDay {
  date: string;
  dateStr: string;
  bookings: number;
  roomNights: number;
  adr: number;
  revenue: number;
  isToday: boolean;
}

export interface DashboardData {
  // --- NEW FIELDS ---
  flowcast: FlowcastDay[];
  recentActivity: RecentActivityDay[];
  snapshot: {
    lastMonth: SnapshotPeriod;
    currentMonth: SnapshotPeriod;
    nextMonth: SnapshotPeriod;
  };
  marketOutlook: {
    status: "strengthening" | "softening" | "stable";
    metric: string;
  };
  forwardDemandChartData: any[];
  demandPatterns: {
    busiestDays: PatternDay[];
    quietestDays: PatternDay[];
  };
  rankings: {
    occupancy: Rank;
    adr: Rank;
    revpar: Rank;
  };
  ytdTrend: any;
  budgetBenchmark: {
    benchmarkOcc: number;
    benchmarkAdr: number;
    source: string;
  } | null;
}

export interface PortfolioMetrics {
  aggregates: {
    totalRevenue: number;
    occupancy: number;
    adr: number;
    revpar: number;
  };
  hotels: {
    id: number;
    name: string;
    revenue: number;
    occupancy: number;
    adr: number;
    revpar: number;
  }[];
}

export interface MatrixDay {
  day: number;
  occupancy: number;
  adr: number;
  available: number;
}

export interface MonthlyMetric {
  month_name: string;
  month_num: number;
  year: number;
  revenue: number;
  rooms_sold: number;
  total_capacity: number;
  adr: number;
}

export interface PortfolioDetailedHotel {
  id: number;
  name: string;
  group: string;
  city: string;
  totalRooms: number;
  matrixData: MatrixDay[];
  monthlyData: MonthlyMetric[];
}

// Inline types to match HotelDashboard.tsx expectations
interface SnapshotPeriod {
  label: string;
  revenue: number;
  occupancy: number;
  adr: number;
  yoyChange: number;
  targetRevenue: number | null;
  pacingStatus: { statusTier: string; statusText: string } | null;
}

interface PatternDay {
  date: string;
  dayOfWeek: string;
  availability: number;
  supply: number;
}

interface Rank {
  rank: number | string;
  total: number | string;
}
// --- HELPER GENERATORS REMOVED (Data now comes from Backend) ---

export const fetchDashboardSummary = async (
  propertyId: number,
  city: string
): Promise<DashboardData> => {
  // [DEBUG] Log the property context being requested
  console.log(
    `[Dashboard API] Fetching data for Property ID: ${propertyId}, City: ${city}`
  );

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  // Declare once at the top to reuse everywhere
  const currentMonthIndex = new Date().getMonth();

  // 1. Fetch the main dashboard summary (Fast, but missing YTD details)
  const summaryPromise = fetch(
    `/api/metrics/summary?propertyId=${propertyId}&city=${city}`
  ).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch dashboard summary");
    return res.json();
  });

  // 2. Fetch the detailed YTD Report (Rich data: Occ, ADR, Rev)
  // We use the report endpoint because it already works correctly.
  const ytdReportPromise = fetch(`/api/metrics/reports/year-on-year`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, year1: lastYear, year2: currentYear }),
  }).then((res) => {
    if (!res.ok) return []; // If report fails, fallback to empty
    return res.json();
  });

  // 3. Wait for both and merge
  const [dashboardData, ytdReportData] = await Promise.all([
    summaryPromise,
    ytdReportPromise,
  ]);

  // [DEBUG] Inspect the raw data returned from the YTD endpoint
  console.group("🔍 Dashboard vs Report Data Debug");
  console.log("Raw YTD Report API Response:", ytdReportData);

  // Check a specific month (e.g., last month) to compare with what you see on screen
  const lastMonthIndex = currentMonthIndex - 1;

  if (ytdReportData[lastMonthIndex]) {
    console.log(
      `Data for Month Index ${lastMonthIndex} (Last Month):`,
      ytdReportData[lastMonthIndex]
    );
  }
  console.groupEnd();

  // 4. Transform the Report Data to match Dashboard Component expectations
  // Explicit month mapping to ensure data aligns even if API returns sparse arrays
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const enrichedYtdTrend = ytdReportData.map((row: any) => {
    // Resolve index from the month name returned by the API (e.g. "Jan" -> 0)
    const monthIndex = monthNames.indexOf(row.month);
    const isMTD = monthIndex === currentMonthIndex;

    return {
      month: row.month,
      monthIndex: monthIndex,
      isMTD: isMTD,
      revenue: {
        thisYear: row.year2?.revenue || 0,
        lastYear: row.year1?.revenue || 0,
      },
      occupancy: {
        thisYear: row.year2?.occupancy || 0,
        lastYear: row.year1?.occupancy || 0,
      },
      adr: {
        thisYear: row.year2?.adr || 0,
        lastYear: row.year1?.adr || 0,
      },
      roomsSold: {
        thisYear: row.year2?.roomsSold || 0,
        lastYear: row.year1?.roomsSold || 0,
      },
    };
  });

  // Only keep months up to current month (matching original dashboard logic)
  // Use filter instead of slice to handle potential unsorted data safely
  const filteredTrend = enrichedYtdTrend
    .filter(
      (item: any) =>
        item.monthIndex !== -1 && item.monthIndex <= currentMonthIndex
    )
    .sort((a: any, b: any) => a.monthIndex - b.monthIndex);

  return {
    ...dashboardData,
    ytdTrend: filteredTrend.length > 0 ? filteredTrend : dashboardData.ytdTrend,
    // Real data from API
    flowcast: dashboardData.flowcast || [],
    recentActivity: dashboardData.recentActivity || [],
  };
};

export const fetchPortfolioMetrics = async (): Promise<PortfolioMetrics> => {
  const res = await fetch("/api/metrics/portfolio");
  if (!res.ok) throw new Error("Failed to fetch portfolio metrics");
  return res.json();
};

export const fetchPortfolioDetailed = async (): Promise<
  PortfolioDetailedHotel[]
> => {
  const res = await fetch("/api/metrics/portfolio/detailed");
  if (!res.ok) throw new Error("Failed to fetch detailed portfolio metrics");
  return res.json();
};
