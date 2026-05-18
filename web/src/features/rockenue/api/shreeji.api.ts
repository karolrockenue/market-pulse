// Typed client for the Shreeji portfolio dashboard.
// Mirrors api/services/shreeji.service.js + api/routes/shreeji.router.js.

export interface ShreejiPerfBlock {
  occ: number;
  adr: number;
  rev: number;
  roomsSold: number;
  capacity: number;
}

export interface ShreejiPaceBlock extends ShreejiPerfBlock {
  pickup7d: number;
}

export interface ShreejiTakings {
  cash: number;
  visa: number;
  mastercard: number;
  amex: number;
  otherCards: number;
  bankTransfer: number;
  total: number;
}

export interface ShreejiLineItem {
  name: string;
  qty: number;
  unit: number;
  revenue: number;
}

export interface ShreejiAncillaryBucket {
  total: number;
  items: ShreejiLineItem[];
}

export interface ShreejiAncillary {
  breakfast: ShreejiAncillaryBucket;
  bar: ShreejiAncillaryBucket;
  parking: ShreejiAncillaryBucket;
  laundry: ShreejiAncillaryBucket;
  other: ShreejiAncillaryBucket;
  grandTotal: number;
}

export interface ShreejiHotelRow {
  id: string;
  name: string;
  rooms: number;
  pmsType: string;
  mtd: ShreejiPerfBlock;
  stly: ShreejiPerfBlock;
  last: ShreejiPerfBlock;
  lastLy: ShreejiPerfBlock;
  pace: ShreejiPaceBlock;
  takings: ShreejiTakings | null;
  ancillary: ShreejiAncillary | null;
  financialsError: string | null;
}

export interface ShreejiYoY {
  matchedHotels: number;
  unmatchedHotels: number;
  lastRev: number;
  lastLyRev: number;
  deltaPct: number | null;
}

export interface ShreejiTotals {
  rooms: number;
  mtd: { rev: number; occ: number; adr: number };
  last: { rev: number; occ: number; adr: number };
  lastLy: { rev: number };
  yoy: ShreejiYoY;
  pace: { rev: number; occ: number; pickup7d: number };
  takings: ShreejiTakings;
  ancillary: Omit<ShreejiAncillary, "breakfast" | "bar" | "parking" | "laundry" | "other"> & {
    breakfast: number;
    bar: number;
    parking: number;
    laundry: number;
    other: number;
  };
}

export type ShreejiPortfolio = "all" | "sp" | "np";

export interface ShreejiDashboard {
  monthKey: string;
  portfolio?: ShreejiPortfolio;
  asOf: string;
  ranges: {
    mtd: { start: string; end: string };
    stly: { start: string; end: string };
    last: { start: string; end: string };
    lastLy: { start: string; end: string };
    pace: { start: string; end: string };
  };
  daysElapsed: number;
  hotels: ShreejiHotelRow[];
  totals: ShreejiTotals;
  includesFinancials: boolean;
  cached: boolean;
}

export async function fetchShreejiDashboard(opts: {
  monthKey?: string;
  fresh?: boolean;
  financials?: boolean;
  portfolio?: ShreejiPortfolio;
}): Promise<ShreejiDashboard> {
  const params = new URLSearchParams();
  if (opts.monthKey) params.set("monthKey", opts.monthKey);
  if (opts.fresh) params.set("fresh", "1");
  if (opts.financials === false) params.set("financials", "0");
  if (opts.portfolio && opts.portfolio !== "all") params.set("portfolio", opts.portfolio);
  const url = `/api/shreeji/dashboard${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error || "";
    } catch {
      /* ignore */
    }
    throw new Error(`Shreeji dashboard fetch failed: ${res.status}${detail ? ` — ${detail}` : ""}`);
  }
  return res.json();
}
