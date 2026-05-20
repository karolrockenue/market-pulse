// Typed client for the Iceland market-intelligence dashboard.
// Mirrors api/services/iceland.service.js + api/routes/iceland.router.js.

export interface IcelandProperty {
  bookingHotelId: string;
  name: string;
  type: string | null;
  stars: number | null;
  score: number | null;
  reviewCount: number | null;
  address: string | null;
  neighborhood: string;
  price: number | null;
  currency: string | null;
  url: string | null;
  chain: string;
  // Tier A enrichment (nullable until enrich-inventory.js has run for this hotel)
  streetAddress: string | null;
  descriptionExcerpt: string | null;
  amenities: string[] | null;
  websiteUrl: string | null;
  detailFetchedAt: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface IcelandOpportunity {
  totalProperties: number;
  totalHotels: number;
  brandedCount: number;
  independentCount: number;
  chainCount: number;
  peakMonth: { label: string; avgWap: number } | null;
  troughMonth: { label: string; avgWap: number } | null;
  seasonalUpliftPct: number | null;
}

export interface IcelandScrapeHealth {
  scrapeDays: number;
  lastScrape: string | null;
  firstScrape: string | null;
  totalSnapshots: number;
}

export interface IcelandTierChain {
  name: string;
  count: number;
  properties: { name: string; reviewCount: number | null; score: number | null }[];
}

export interface IcelandSalesTargets {
  tier1: {
    label: string;
    blurb: string;
    count: number;
    ids: string[];
    chains: IcelandTierChain[];
  };
  tier2: {
    label: string;
    blurb: string;
    count: number;
    ids: string[];
  };
  tier3: {
    label: string;
    blurb: string;
    count: number;
    ids: string[];
  };
}

export interface IcelandMonthlySeasonality {
  ym: string;
  label: string;
  avgWap: number | null;
  avgSupply: number | null;
  samples: number;
}

export interface IcelandCompressionDay {
  checkinDate: string;
  wap: number;
  totalProperties: number | null;
}

export interface IcelandCoverageCell {
  checkinDate: string;
  wap: number | null;
  totalProperties: number | null;
}

export interface IcelandCoverageRow {
  scrapeDay: string;
  cells: IcelandCoverageCell[];
}

export interface IcelandCoverageMatrix {
  scrapeDays: number;
  columns: number;
  totalCellsFilled: number;
  rows: IcelandCoverageRow[];
  wapCutoffs: number[];
  minWap: number | null;
  maxWap: number | null;
}

export interface IcelandDashboardPayload {
  citySlug: string;
  cityLabel: string;
  lastInventoryRefresh: string | null;
  kpis: {
    totalProperties: number;
    totalHotels: number;
    avgPrice: number | null;
    avgScore: number | null;
    medianHotelPrice: number | null;
  };
  opportunity: IcelandOpportunity;
  scrapeHealth: IcelandScrapeHealth;
  coverageMatrix: IcelandCoverageMatrix;
  starDistribution: { stars: number; count: number }[];
  typeBreakdown: {
    type: string;
    count: number;
    withStars: number;
    avgScore: number | null;
    avgPrice: number | null;
  }[];
  neighborhoods: { name: string; count: number; avgPrice: number | null }[];
  chainBreakdown: { name: string; count: number }[];
  salesTargets: IcelandSalesTargets;
  topHotels: IcelandProperty[];
  inventory: IcelandProperty[];
  market: {
    hasData: boolean;
    forwardSnapshots: {
      checkinDate: string;
      totalProperties: number | null;
      wap: number | null;
      minPrice: number | null;
      maxPrice: number | null;
    }[];
    monthlySeasonality: IcelandMonthlySeasonality[];
    compressionDays: IcelandCompressionDay[];
  };
}

export async function fetchIcelandDashboard(): Promise<IcelandDashboardPayload> {
  const res = await fetch("/api/iceland/dashboard", {
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error(`Iceland dashboard fetch failed: ${res.status}`);
  }
  return res.json();
}
