const pool = require("../utils/db");

const CITY_SLUG = "reykjavik";

// Chain detection — order matters (more-specific patterns first).
const CHAIN_PATTERNS = [
  { rx: /\bcenter hotels?\b/i, name: "Center Hotels" },
  { rx: /\bberjaya\b/i, name: "Berjaya Iceland Hotels" },
  { rx: /\bkea ?hotels?\b|by kea/i, name: "Keahotels" },
  { rx: /\biceland(?:air)? hotels?\b/i, name: "Icelandair Hotels" },
  { rx: /\bfoss ?hotels?\b/i, name: "Fosshotel" },
  { rx: /\bhilton\b|curio collection/i, name: "Hilton (incl. Curio)" },
  { rx: /\bcandlewood\b|\bihg\b/i, name: "IHG" },
  { rx: /\bradisson\b/i, name: "Radisson" },
  { rx: /\bmarriott\b/i, name: "Marriott" },
  { rx: /\bheimaleiga\b/i, name: "Heimaleiga (mgr)" },
  { rx: /\bhi (?:eco )?hostel\b/i, name: "Hostelling International" },
  { rx: /\bbest western\b/i, name: "Best Western" },
];

function inferChain(name) {
  if (!name) return "Independent";
  for (const { rx, name: chainName } of CHAIN_PATTERNS) {
    if (rx.test(name)) return chainName;
  }
  return "Independent";
}

function normalizeNeighborhood(addr) {
  if (!addr) return "(unknown)";
  const first = addr.split(",")[0].trim();
  return first || "(unknown)";
}

async function getDashboard() {
  const inventoryQuery = await pool.query(
    `
    SELECT booking_hotel_id, property_name, property_type, star_rating,
           review_score, review_count, address_snippet,
           cheapest_price, cheapest_price_currency, property_url,
           street_address, description_excerpt, amenities, website_url,
           detail_fetched_at, first_seen, last_seen
      FROM hotel_inventory
     WHERE city_slug = $1
     ORDER BY review_count DESC NULLS LAST
    `,
    [CITY_SLUG],
  );
  const inventory = inventoryQuery.rows.map((r) => ({
    bookingHotelId: r.booking_hotel_id,
    name: r.property_name,
    type: r.property_type,
    stars: r.star_rating,
    score: r.review_score !== null ? Number(r.review_score) : null,
    reviewCount: r.review_count,
    address: r.address_snippet,
    neighborhood: normalizeNeighborhood(r.address_snippet),
    price: r.cheapest_price !== null ? Number(r.cheapest_price) : null,
    currency: r.cheapest_price_currency,
    url: r.property_url,
    chain: inferChain(r.property_name),
    // Tier A enrichment fields (populated by enrich-inventory.js)
    streetAddress: r.street_address,
    descriptionExcerpt: r.description_excerpt,
    amenities: r.amenities,
    websiteUrl: r.website_url,
    detailFetchedAt: r.detail_fetched_at,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
  }));

  // KPI block
  const hotels = inventory.filter((p) => p.type === "Hotel");
  const priced = inventory.filter((p) => p.price !== null);
  const scored = inventory.filter((p) => p.score !== null);
  const lastRefresh = inventory.reduce(
    (max, p) => (p.lastSeen > max ? p.lastSeen : max),
    new Date(0),
  );
  const kpis = {
    totalProperties: inventory.length,
    totalHotels: hotels.length,
    avgPrice:
      priced.length > 0
        ? Math.round(priced.reduce((s, p) => s + p.price, 0) / priced.length)
        : null,
    avgScore:
      scored.length > 0
        ? Math.round((scored.reduce((s, p) => s + p.score, 0) / scored.length) * 10) / 10
        : null,
    medianHotelPrice:
      hotels.length > 0 && hotels.filter((h) => h.price !== null).length > 0
        ? (() => {
            const prices = hotels
              .filter((h) => h.price !== null)
              .map((h) => h.price)
              .sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            return prices.length % 2 === 0
              ? Math.round((prices[mid - 1] + prices[mid]) / 2)
              : prices[mid];
          })()
        : null,
  };

  // Type breakdown
  const typeMap = new Map();
  for (const p of inventory) {
    const t = p.type || "(unknown)";
    if (!typeMap.has(t))
      typeMap.set(t, { type: t, count: 0, prices: [], scores: [], stars: 0 });
    const bucket = typeMap.get(t);
    bucket.count++;
    if (p.price !== null) bucket.prices.push(p.price);
    if (p.score !== null) bucket.scores.push(p.score);
    if (p.stars !== null) bucket.stars++;
  }
  const typeBreakdown = Array.from(typeMap.values())
    .map((b) => ({
      type: b.type,
      count: b.count,
      withStars: b.stars,
      avgScore:
        b.scores.length > 0
          ? Math.round((b.scores.reduce((s, v) => s + v, 0) / b.scores.length) * 10) / 10
          : null,
      avgPrice:
        b.prices.length > 0
          ? Math.round(b.prices.reduce((s, v) => s + v, 0) / b.prices.length)
          : null,
    }))
    .sort((a, b) => b.count - a.count);

  // Star distribution (rated only)
  const starMap = new Map();
  for (const p of inventory) {
    if (p.stars !== null) {
      starMap.set(p.stars, (starMap.get(p.stars) || 0) + 1);
    }
  }
  const starDistribution = Array.from(starMap.entries())
    .map(([stars, count]) => ({ stars, count }))
    .sort((a, b) => b.stars - a.stars);

  // Neighborhood breakdown
  const hoodMap = new Map();
  for (const p of inventory) {
    const h = p.neighborhood;
    if (!hoodMap.has(h)) hoodMap.set(h, { name: h, count: 0, prices: [] });
    const bucket = hoodMap.get(h);
    bucket.count++;
    if (p.price !== null) bucket.prices.push(p.price);
  }
  const neighborhoods = Array.from(hoodMap.values())
    .map((b) => ({
      name: b.name,
      count: b.count,
      avgPrice:
        b.prices.length > 0
          ? Math.round(b.prices.reduce((s, v) => s + v, 0) / b.prices.length)
          : null,
    }))
    .sort((a, b) => b.count - a.count);

  // Chain breakdown
  const chainMap = new Map();
  for (const p of inventory) {
    chainMap.set(p.chain, (chainMap.get(p.chain) || 0) + 1);
  }
  const chainBreakdown = Array.from(chainMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      // Independent always last
      if (a.name === "Independent") return 1;
      if (b.name === "Independent") return -1;
      return b.count - a.count;
    });

  // Top 25 hotels (already sorted by review_count desc thanks to query)
  const topHotels = hotels.slice(0, 25);

  // Forward market signal — pull latest snapshots for next 30 days
  const marketQuery = await pool.query(
    `
    SELECT checkin_date, total_results,
           CAST(weighted_avg_price AS NUMERIC) AS wap,
           min_price_anchor, max_price_anchor
      FROM market_availability_snapshots
     WHERE provider = 'booking' AND city_slug = $1
       AND checkin_date >= CURRENT_DATE
       AND checkin_date <= CURRENT_DATE + INTERVAL '120 days'
     ORDER BY checkin_date ASC, scraped_at DESC
    `,
    [CITY_SLUG],
  );
  // Dedup: latest snapshot per checkin_date
  const seenDates = new Set();
  const forwardSnapshots = [];
  for (const row of marketQuery.rows) {
    // pg returns ::date as either a string ("YYYY-MM-DD") or a Date depending
    // on driver config; handle both. (Blueprint §1.3.)
    const key =
      typeof row.checkin_date === "string"
        ? row.checkin_date.slice(0, 10)
        : row.checkin_date.toISOString().slice(0, 10);
    if (seenDates.has(key)) continue;
    seenDates.add(key);
    forwardSnapshots.push({
      checkinDate: key,
      totalProperties: row.total_results,
      wap: row.wap !== null ? Number(row.wap) : null,
      minPrice: row.min_price_anchor,
      maxPrice: row.max_price_anchor,
    });
  }
  forwardSnapshots.sort((a, b) => a.checkinDate.localeCompare(b.checkinDate));

  return {
    citySlug: CITY_SLUG,
    cityLabel: "Reykjavik (capital region)",
    lastInventoryRefresh: lastRefresh.toISOString
      ? lastRefresh.toISOString()
      : null,
    kpis,
    starDistribution,
    typeBreakdown,
    neighborhoods,
    chainBreakdown,
    topHotels,
    inventory,
    market: {
      hasData: forwardSnapshots.length > 0,
      forwardSnapshots,
    },
  };
}

module.exports = { getDashboard };
