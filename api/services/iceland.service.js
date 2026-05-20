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

// Heimaleiga is a property manager, not a chain — treat as "Independent" for
// tiering / wedge counts so it doesn't inflate the branded story.
const MGR_CHAIN_NAMES = new Set(["Heimaleiga (mgr)"]);

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

function dateKey(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
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

  // Sales targets matrix — three tiers that map to a real sales motion.
  // T1 Branded chains: central decision-makers, bigger contracts, hottest first call.
  // T2 Established independents: visible track record (≥300 reviews + score ≥8.0).
  // T3 Long tail: everyone else, volume play / cold outreach.
  const tier1 = [];
  const tier2 = [];
  const tier3 = [];
  for (const p of inventory) {
    const isBranded = p.chain !== "Independent" && !MGR_CHAIN_NAMES.has(p.chain);
    if (isBranded) {
      tier1.push(p);
    } else if (
      (p.reviewCount ?? 0) >= 300 &&
      (p.score ?? 0) >= 8.0
    ) {
      tier2.push(p);
    } else {
      tier3.push(p);
    }
  }
  const sortBySalience = (a, b) => {
    const av = (a.reviewCount ?? 0) * (a.score ?? 0);
    const bv = (b.reviewCount ?? 0) * (b.score ?? 0);
    return bv - av;
  };
  tier1.sort(sortBySalience);
  tier2.sort(sortBySalience);
  tier3.sort(sortBySalience);

  const tierIds = (rows) => rows.map((p) => p.bookingHotelId);
  const salesTargets = {
    tier1: {
      label: "Tier 1 · Branded Chains",
      blurb: "Central decision-makers. Highest contract value per win. Start here.",
      count: tier1.length,
      ids: tierIds(tier1),
      chains: (() => {
        const m = new Map();
        for (const p of tier1) {
          if (!m.has(p.chain)) m.set(p.chain, { name: p.chain, count: 0, properties: [] });
          const b = m.get(p.chain);
          b.count++;
          b.properties.push({ name: p.name, reviewCount: p.reviewCount, score: p.score });
        }
        return Array.from(m.values()).sort((a, b) => b.count - a.count);
      })(),
    },
    tier2: {
      label: "Tier 2 · Established Independents",
      blurb: "≥300 reviews and ≥8.0 score. Owner-operated, established, ready for revenue management.",
      count: tier2.length,
      ids: tierIds(tier2),
    },
    tier3: {
      label: "Tier 3 · Long Tail",
      blurb: "Smaller / newer properties. Volume play — cold outreach + group offers.",
      count: tier3.length,
      ids: tierIds(tier3),
    },
  };

  // Top 25 hotels (already sorted by review_count desc thanks to query)
  const topHotels = hotels.slice(0, 25);

  // Forward market signal — pull latest snapshots for next 120 days
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
  const seenDates = new Set();
  const forwardSnapshots = [];
  for (const row of marketQuery.rows) {
    const key = dateKey(row.checkin_date);
    if (!key || seenDates.has(key)) continue;
    seenDates.add(key);
    forwardSnapshots.push({
      checkinDate: key,
      totalProperties: row.total_results,
      wap: row.wap !== null ? Number(row.wap) : null,
      minPrice: row.min_price_anchor !== null ? Number(row.min_price_anchor) : null,
      maxPrice: row.max_price_anchor !== null ? Number(row.max_price_anchor) : null,
    });
  }
  forwardSnapshots.sort((a, b) => a.checkinDate.localeCompare(b.checkinDate));

  // Monthly seasonality — group forward snapshots by year-month so the sales
  // team can see the Icelandic peak-season curve at a glance.
  const monthMap = new Map();
  for (const s of forwardSnapshots) {
    if (s.wap === null) continue;
    const ym = s.checkinDate.slice(0, 7);
    if (!monthMap.has(ym)) {
      monthMap.set(ym, { ym, waps: [], supplies: [], samples: 0 });
    }
    const b = monthMap.get(ym);
    b.waps.push(s.wap);
    if (s.totalProperties !== null) b.supplies.push(s.totalProperties);
    b.samples++;
  }
  const monthlySeasonality = Array.from(monthMap.values())
    .map((b) => {
      const monthIdx = Number(b.ym.slice(5, 7)) - 1;
      return {
        ym: b.ym,
        label: `${MONTH_NAMES[monthIdx]} ${b.ym.slice(2, 4)}`,
        avgWap:
          b.waps.length > 0
            ? Math.round(b.waps.reduce((s, v) => s + v, 0) / b.waps.length)
            : null,
        avgSupply:
          b.supplies.length > 0
            ? Math.round(b.supplies.reduce((s, v) => s + v, 0) / b.supplies.length)
            : null,
        samples: b.samples,
      };
    })
    .sort((a, b) => a.ym.localeCompare(b.ym));

  // Peak / trough months (only consider months with ≥7 days of data so we
  // don't pick a 1-2 day fragment at either end).
  const eligibleMonths = monthlySeasonality.filter(
    (m) => m.samples >= 7 && m.avgWap !== null,
  );
  let peakMonth = null;
  let troughMonth = null;
  if (eligibleMonths.length > 0) {
    peakMonth = eligibleMonths.reduce((a, b) => (b.avgWap > a.avgWap ? b : a));
    troughMonth = eligibleMonths.reduce((a, b) => (b.avgWap < a.avgWap ? b : a));
  }

  // Compression days — top 10 forward dates by WAP. Story: "these are the
  // days the market has pricing power, your hotels should be charging premiums".
  const compressionDays = forwardSnapshots
    .filter((s) => s.wap !== null)
    .slice()
    .sort((a, b) => b.wap - a.wap)
    .slice(0, 10)
    .map((s) => ({
      checkinDate: s.checkinDate,
      wap: s.wap,
      totalProperties: s.totalProperties,
    }))
    .sort((a, b) => a.checkinDate.localeCompare(b.checkinDate));

  // Coverage matrix — the "we capture everything" heatmap.
  // Last 10 scrape days × intersection of their 120-day forward windows.
  // Each cell = latest WAP for that (scrape_day, checkin_date) pair.
  const coverageQuery = await pool.query(
    `
    WITH ranked AS (
      SELECT DATE(scraped_at) AS scrape_day, checkin_date,
             CAST(weighted_avg_price AS NUMERIC) AS wap,
             total_results,
             ROW_NUMBER() OVER (
               PARTITION BY DATE(scraped_at), checkin_date
               ORDER BY scraped_at DESC
             ) AS rn
        FROM market_availability_snapshots
       WHERE provider = 'booking' AND city_slug = $1
         AND scraped_at >= CURRENT_DATE - INTERVAL '14 days'
    )
    SELECT scrape_day, checkin_date, wap, total_results
      FROM ranked
     WHERE rn = 1
     ORDER BY scrape_day DESC, checkin_date ASC
    `,
    [CITY_SLUG],
  );
  const byDay = new Map();
  for (const row of coverageQuery.rows) {
    const sd = dateKey(row.scrape_day);
    const cd = dateKey(row.checkin_date);
    if (!sd || !cd) continue;
    if (!byDay.has(sd)) byDay.set(sd, new Map());
    byDay.get(sd).set(cd, {
      wap: row.wap !== null ? Number(row.wap) : null,
      totalProperties: row.total_results,
    });
  }
  // Only include scrape days that produced a full forward sweep
  // (≥100 cells). Partial / first-day scrapes would collapse the intersection.
  const FULL_SWEEP_THRESHOLD = 100;
  const allScrapeDays = Array.from(byDay.keys())
    .filter((sd) => byDay.get(sd).size >= FULL_SWEEP_THRESHOLD)
    .sort();
  const selectedScrapeDays = allScrapeDays.slice(-10);
  let coverageColumns = [];
  let coverageRows = [];
  let wapCutoffs = [0, 0, 0, 0];
  let coverageMin = null;
  let coverageMax = null;
  let totalCellsFilled = 0;
  if (selectedScrapeDays.length > 0) {
    let intMin = null;
    let intMax = null;
    for (const sd of selectedScrapeDays) {
      const dates = Array.from(byDay.get(sd).keys()).sort();
      if (dates.length === 0) continue;
      if (intMin === null || dates[0] > intMin) intMin = dates[0];
      if (intMax === null || dates[dates.length - 1] < intMax) intMax = dates[dates.length - 1];
    }
    if (intMin && intMax) {
      const start = new Date(intMin + "T00:00:00Z");
      const end = new Date(intMax + "T00:00:00Z");
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        coverageColumns.push(d.toISOString().slice(0, 10));
      }
    }
    coverageRows = selectedScrapeDays
      .slice()
      .reverse() // most recent first for display
      .map((sd) => {
        const dayMap = byDay.get(sd);
        return {
          scrapeDay: sd,
          cells: coverageColumns.map((cd) => {
            const cell = dayMap.get(cd);
            if (cell && cell.wap !== null) totalCellsFilled++;
            return {
              checkinDate: cd,
              wap: cell ? cell.wap : null,
              totalProperties: cell ? cell.totalProperties : null,
            };
          }),
        };
      });
    const flatWaps = [];
    for (const row of coverageRows) {
      for (const c of row.cells) {
        if (c.wap !== null) flatWaps.push(c.wap);
      }
    }
    flatWaps.sort((a, b) => a - b);
    if (flatWaps.length > 0) {
      const qCut = (q) =>
        flatWaps[Math.min(Math.floor(flatWaps.length * q), flatWaps.length - 1)];
      wapCutoffs = [qCut(0.2), qCut(0.4), qCut(0.6), qCut(0.8)];
      coverageMin = flatWaps[0];
      coverageMax = flatWaps[flatWaps.length - 1];
    }
  }
  const coverageMatrix = {
    scrapeDays: coverageRows.length,
    columns: coverageColumns.length,
    totalCellsFilled,
    rows: coverageRows,
    wapCutoffs,
    minWap: coverageMin,
    maxWap: coverageMax,
  };

  // Scrape health — credibility line for the meeting.
  const healthQuery = await pool.query(
    `
    SELECT COUNT(DISTINCT DATE(scraped_at)) AS scrape_days,
           MAX(scraped_at) AS last_scrape,
           MIN(DATE(scraped_at)) AS first_scrape,
           COUNT(*) AS total_snapshots
      FROM market_availability_snapshots
     WHERE provider = 'booking' AND city_slug = $1
       AND scraped_at >= CURRENT_DATE - INTERVAL '30 days'
    `,
    [CITY_SLUG],
  );
  const hrow = healthQuery.rows[0] || {};
  const scrapeHealth = {
    scrapeDays: hrow.scrape_days ? Number(hrow.scrape_days) : 0,
    lastScrape: hrow.last_scrape ? new Date(hrow.last_scrape).toISOString() : null,
    firstScrape: dateKey(hrow.first_scrape),
    totalSnapshots: hrow.total_snapshots ? Number(hrow.total_snapshots) : 0,
  };

  // Opportunity stats — the headline numbers above the fold.
  const brandedCount = tier1.length;
  const independentCount = inventory.length - brandedCount;
  const chainCount = chainBreakdown.filter(
    (c) => c.name !== "Independent" && !MGR_CHAIN_NAMES.has(c.name),
  ).length;
  const opportunity = {
    totalProperties: inventory.length,
    totalHotels: hotels.length,
    brandedCount,
    independentCount,
    chainCount,
    peakMonth: peakMonth
      ? { label: peakMonth.label, avgWap: peakMonth.avgWap }
      : null,
    troughMonth: troughMonth
      ? { label: troughMonth.label, avgWap: troughMonth.avgWap }
      : null,
    seasonalUpliftPct:
      peakMonth && troughMonth && troughMonth.avgWap > 0
        ? Math.round(((peakMonth.avgWap - troughMonth.avgWap) / troughMonth.avgWap) * 100)
        : null,
  };

  return {
    citySlug: CITY_SLUG,
    cityLabel: "Reykjavik (capital region)",
    lastInventoryRefresh: lastRefresh.toISOString
      ? lastRefresh.toISOString()
      : null,
    kpis,
    opportunity,
    scrapeHealth,
    coverageMatrix,
    starDistribution,
    typeBreakdown,
    neighborhoods,
    chainBreakdown,
    salesTargets,
    topHotels,
    inventory,
    market: {
      hasData: forwardSnapshots.length > 0,
      forwardSnapshots,
      monthlySeasonality,
      compressionDays,
    },
  };
}

module.exports = { getDashboard };
