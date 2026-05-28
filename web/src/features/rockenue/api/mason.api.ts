// Typed client for Mason & Fifth Sales Flash + Pacing Flash endpoints.
// Mirrors api/services/mason.service.js + api/routes/mason.router.js.

export type MasonRole = "short" | "mid" | "long";

export interface KpiRoleSplit {
  revenue: number;
  nights: number;
  adr: number | null;
  configured: boolean;
}

export interface KpiTotals {
  revenue: number;
  roomNights: number;
  capacity: number;
  occupancy: number | null;
  adr: number | null;
  revpar: number | null;
}

export interface MonthOtbRow {
  monthKey: string;
  byRole: Record<MasonRole, KpiRoleSplit>;
  total: KpiTotals;
}

export interface PacingMonth {
  monthKey: string;
  currentOTB: MonthOtbRow;
  forecast: KpiTotals & { isForward?: boolean; isCurrent?: boolean; isPast?: boolean };
  finalLY: KpiTotals | null;
  sameTimeLY: KpiTotals | null;
  lastPacingReport: KpiTotals | null;
}

export interface PacingResponse {
  hotelId: number;
  hotelName: string;
  shortName: string;
  windowStart: string;
  windowEnd: string;
  asOf: string;
  grid: PacingMonth[];
  stlyAvailable: boolean;
  lprAvailable: boolean;
  notes: Record<string, string>;
}

export interface BookingPulseRow {
  weekStart: string;
  stayMonth: string;
  bookings: number;
  cancellations: number;
  revenue: number;
  roomNights: number;
}

export interface BookingPulseResponse {
  hotelId: number;
  rows: BookingPulseRow[];
  weeksBack: number;
  earliestReservationCapture: string;
}

export interface RevenueCell {
  actual: number;
  priorMonth: number | null;
  priorYear: number | null;
  budget: number | null;
}

export interface KpiCell {
  actual: number | null;
  priorMonth: number | null;
  priorYear: number | null;
  budget?: number | null;
}

export interface SalesFlashSummary {
  monthKey: string;
  revenue: {
    short: RevenueCell;
    mid: RevenueCell;
    long: RevenueCell;
    totalAccom: RevenueCell;
  };
  kpis: {
    occupancy: KpiCell;
    adrBlended: KpiCell;
    revpar: KpiCell;
    adrShort: KpiCell;
    adrMid: KpiCell;
    amrLong: KpiCell;
    directBookingEngine: KpiCell;
    directManual: KpiCell;
    ota: KpiCell;
  };
}

export interface SalesFlashAnnualisedRow {
  monthKey: string;
  revenue: { short: number; mid: number; long: number; total: number };
  budget: { short: number; mid: number; long: number; total: number } | null;
  occupancy: number | null;
}

export interface SalesFlashPacingRow {
  role: MasonRole;
  months: Array<{
    monthKey: string;
    actualRevenue: number;
    actualNights: number;
    actualAdr: number | null;
    budgetRevenue: number | null;
  }>;
}

export interface UnitPacingRow {
  weekStart: string;
  shortStay: { rooms: number; pct: number };
  midStay: { rooms: number; pct: number };
  longStay: { rooms: number; pct: number };
  offline: { rooms: number; pct: number };
  vacant: { rooms: number; pct: number };
  capacity: number;
}

export interface SsWeeklyRow {
  weekStart: string;
  bookings: number;
  roomNights: number;
  revenue: number;
  avgAdr: number | null;
}

export interface LsTierRow {
  tier: string;
  label: string;
  weekly: Array<{ weekStart: string; count: number }>;
  total: { bookings: number; revenue: number; nights: number };
}

export interface SalesFlashMonthCard {
  title: string;
  label: string;
  revenueBy: { short: number; mid: number; long: number };
  occupancy: number;
  adr: number;
  adrByService: { short: number; mid: number; long: number };
  occByService: { short: number; mid: number; long: number };
}

export interface SalesFlashResponse {
  hotelId: number;
  hotelName: string;
  shortName: string;
  monthKey: string;
  asOf: string;
  hasBudgetData: boolean;
  summary: SalesFlashSummary;
  alos: { short: KpiCell; mid: KpiCell; long: KpiCell };
  leadTime: { short: KpiCell; mid: KpiCell; long: KpiCell };
  rateCharts: {
    ssAdrByCategory: { name: string; value: number }[];
    amrBySegment: { name: string; value: number }[];
    lsAmrByCategory: { name: string; value: number }[];
  };
  annualised: SalesFlashAnnualisedRow[];
  pacing: SalesFlashPacingRow[];
  bob: { short: number; mid: number; long: number; total: number };
  businessDone: { short: number; mid: number; long: number; total: number };
  fytdOccupancy: number | null;
  inHouseFY: Array<{ monthKey: string; short: number; mid: number; long: number }>;
  unitPacing: UnitPacingRow[];
  ssWeekly: SsWeeklyRow[];
  allWeekly: SsWeeklyRow[];
  lsTierWeekly: LsTierRow[];
  notes: Record<string, string | null>;
}

export interface OccByServiceRow {
  date: string;
  capacity: number;
  sold: number;
  short: number;
  mid: number;
  long: number;
  other: number;
}

export interface OccByServiceResponse {
  hotelId: number;
  shortName: string;
  days: number;
  rows: OccByServiceRow[];
}

async function jsonFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`${r.status} ${url}: ${body.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

export function fetchMasonPacing(
  hotelId: number,
  opts: { monthsBack?: number; monthsForward?: number } = {},
): Promise<PacingResponse> {
  const monthsBack = opts.monthsBack ?? 2;
  const monthsForward = opts.monthsForward ?? 11;
  return jsonFetch(
    `/api/mason/pacing?hotelId=${hotelId}&monthsBack=${monthsBack}&monthsForward=${monthsForward}`,
  );
}

export function fetchMasonBookingPulse(
  hotelId: number,
  weeksBack = 8,
): Promise<BookingPulseResponse> {
  return jsonFetch(`/api/mason/booking-pulse?hotelId=${hotelId}&weeksBack=${weeksBack}`);
}

export function fetchMasonOccByService(
  hotelId: number,
  monthKey?: string,
  days = 120,
): Promise<OccByServiceResponse> {
  const mk = monthKey ? `&monthKey=${monthKey}` : "";
  return jsonFetch(`/api/mason/occupancy-by-service?hotelId=${hotelId}&days=${days}${mk}`);
}

export function fetchMasonSalesFlash(
  hotelId: number,
  monthKey?: string,
): Promise<SalesFlashResponse> {
  const qs = monthKey
    ? `?hotelId=${hotelId}&monthKey=${monthKey}`
    : `?hotelId=${hotelId}`;
  return jsonFetch(`/api/mason/sales-flash${qs}`);
}

export interface MasonCardsResponse {
  hotelId: number;
  monthKey: string;
  cards: SalesFlashMonthCard[];
}

export function fetchMasonCards(
  hotelId: number,
  monthKey?: string,
): Promise<MasonCardsResponse> {
  const qs = monthKey
    ? `?hotelId=${hotelId}&monthKey=${monthKey}`
    : `?hotelId=${hotelId}`;
  return jsonFetch(`/api/mason/cards${qs}`);
}
