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
  topHotels: IcelandProperty[];
  inventory: IcelandProperty[];
  market: {
    hasData: boolean;
    forwardSnapshots: {
      checkinDate: string;
      totalProperties: number;
      wap: number | null;
      minPrice: number | null;
      maxPrice: number | null;
    }[];
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
