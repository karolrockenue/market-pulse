require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const fetch = require("node-fetch");
const pgPool = require("./utils/db.js");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// A single Airbnb search page is 18 results. With the ~10 km bbox a healthy
// date returns ~100+; any date at/under one page is a suspected pagination cap.
const ONE_PAGE = 18;

// ---------------------------------------------------------------------------
// City configs
// ---------------------------------------------------------------------------
//
// IMPORTANT: Airbnb caps any single search at ~270 results. A loose query
// like "Archanes--Greece" pulls listings from a wide regional radius
// (Heraklion, coastal villas, etc.) and silently truncates at 270 — making
// per-date count meaningless because it always reads ~270.
//
// Fix: pass an explicit lat/lng bounding box so Airbnb only searches within
// that geographic window. For Archanes, 10 km radius returns ~157 listings
// (well under cap) AND only includes properties actually in the
// Archanes-area competitive set. We also apply a post-parse distance filter
// as a belt-and-braces safety net.
//
// To compute a bbox for a new city: dLat = radiusKm / 111;
// dLng = radiusKm / (111 * cos(lat * π/180)). Then sw = (lat-dLat, lng-dLng),
// ne = (lat+dLat, lng+dLng).
const CITY_CONFIGS = {
  archanes: {
    name: "Archanes, Crete",
    slug: "archanes",
    currency: "EUR",
    query: "Archanes--Greece",
    center: { lat: 35.2352, lng: 25.1594 },
    radiusKm: 10,
    bbox: {
      swLat: "35.14511",
      neLat: "35.32529",
      swLng: "25.04910",
      neLng: "25.26970",
      zoom: 13,
    },
  },
  "tarnawa-dolna": {
    name: "Tarnawa Dolna, Małopolska",
    slug: "tarnawa-dolna",
    currency: "PLN",
    query: "Sucha-Beskidzka--Poland",
    center: { lat: 49.7297, lng: 19.6094 },
    radiusKm: 10,
    bbox: {
      swLat: "49.63961",
      neLat: "49.81979",
      swLng: "19.47003",
      neLng: "19.74877",
      zoom: 13,
    },
  },
};

// ---------------------------------------------------------------------------
// Fetch search page HTML and extract embedded JSON
// ---------------------------------------------------------------------------

async function fetchAirbnbPage(cityConfig, checkinDate, checkoutDate, cursor) {
  const params = new URLSearchParams({
    adults: "2",
    checkin: checkinDate,
    checkout: checkoutDate,
    "refinement_paths[]": "/homes",
    date_picker_type: "calendar",
    tab_id: "home_tab",
    // Force the response currency. Without this, Airbnb infers currency from
    // the requesting IP — e.g. a Polish IP returns złoty, US returns USD —
    // and the parser stores those raw values as if they were EUR. Always
    // pin to the city's configured currency.
    currency: cityConfig.currency || "EUR",
  });

  // If a bbox is configured, force Airbnb to search only inside that geographic
  // window — otherwise the loose query name is interpreted as a wide region.
  if (cityConfig.bbox) {
    params.set("ne_lat", cityConfig.bbox.neLat);
    params.set("ne_lng", cityConfig.bbox.neLng);
    params.set("sw_lat", cityConfig.bbox.swLat);
    params.set("sw_lng", cityConfig.bbox.swLng);
    params.set("search_by_map", "true");
    params.set("zoom", String(cityConfig.bbox.zoom));
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  const url = `https://www.airbnb.com/s/${cityConfig.query}/homes?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      // Belt-and-braces: also pin currency via cookie in case the query
      // param alone doesn't override an IP-based session preference.
      Cookie: `currency=${cityConfig.currency || "EUR"}`,
    },
    timeout: 30000,
  });

  if (!response.ok) {
    throw new Error(`Airbnb page ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  // Extract the deferred state JSON embedded in the page
  const match = html.match(/id="data-deferred-state-0"[^>]*>([^<]+)/);
  if (!match) {
    throw new Error("Could not find deferred state JSON in page HTML");
  }

  return JSON.parse(match[1]);
}

// ---------------------------------------------------------------------------
// Parse listings from embedded page data
// ---------------------------------------------------------------------------

function parseListings(pageData) {
  const listings = [];
  let nextCursor = null;
  let pageCursors = [];

  try {
    const entries = pageData.niobeClientData || [];

    for (const [key, value] of entries) {
      if (!key.startsWith("StaysSearch")) continue;

      const results = value?.data?.presentation?.staysSearch?.results;
      if (!results) continue;

      // Pagination. Airbnb removed the single `nextPageCursor` field in
      // April 2026 and now ships the full list of page cursors up front in
      // `pageCursors[]` (pageCursors[0] = current page). Reading the old field
      // silently capped every scrape at one page (18 results). Prefer the
      // array; keep nextPageCursor as a fallback if Airbnb reinstates it.
      const pag = results.paginationInfo;
      if (Array.isArray(pag?.pageCursors) && pag.pageCursors.length) {
        pageCursors = pag.pageCursors;
      }
      if (pag?.nextPageCursor) {
        nextCursor = pag.nextPageCursor;
      }

      const items = results.searchResults || [];

      for (const item of items) {
        try {
          // --- PRICE: extract nightly rate ---
          // Description formats observed:
          //   "2 nights x 455.21 zł"            (PLN, no symbol prefix)
          //   "2 nights x € 78.00"              (EUR, symbol+space prefix)
          //   "1 night x €105.30"               (EUR, no space)
          // Strip the currency symbol then grab the first decimal number.
          let pricePerNight = null;
          const priceDetails = item.structuredDisplayPrice?.explanationData?.priceDetails;
          if (priceDetails) {
            for (const group of priceDetails) {
              for (const line of group.items || []) {
                const desc = line.description || "";
                if (!/night/i.test(desc)) continue;
                // Find the first number after "night(s) x"
                const afterX = desc.split(/x/i).pop() || "";
                const numMatch = afterX.match(/([\d][\d,.]*)/);
                if (numMatch) {
                  pricePerNight = parseFloat(numMatch[1].replace(/,/g, ""));
                  break;
                }
              }
              if (pricePerNight) break;
            }
          }
          // Fallback: read primary line, divide total by 2 nights.
          if (!pricePerNight) {
            const label = item.structuredDisplayPrice?.primaryLine?.discountedPrice
              || item.structuredDisplayPrice?.primaryLine?.price || "";
            const totalMatch = label.match(/([\d][\d,.]*)/);
            if (totalMatch) {
              pricePerNight = parseFloat(totalMatch[1].replace(/,/g, "")) / 2;
            }
          }

          // --- NAME ---
          const name = item.subtitle || item.nameLocalized?.localizedStringWithTranslationPreference || "";

          // --- TYPE & LOCATION from title ---
          const title = item.title || "";
          const typeMatch = title.match(/^(\w[\w\s]*?)\s+in\s+/i);
          const type = typeMatch ? typeMatch[1] : null;
          const location = title.match(/in\s+(.+)$/i)?.[1] || null;

          // --- BEDS from structuredContent ---
          const bedLines = (item.structuredContent?.primaryLine || [])
            .filter((l) => l.type === "BEDINFO")
            .map((l) => l.body);
          const beds = bedLines.join(", ") || null; // e.g. "1 bedroom, 1 king bed"

          // --- RATING ---
          const ratingStr = item.avgRatingLocalized || "";
          const ratingMatch = ratingStr.match(/([\d.]+)\s*\((\d+)\)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
          const reviews = ratingMatch ? parseInt(ratingMatch[2]) : 0;

          // --- COORDINATES ---
          const coord = item.demandStayListing?.location?.coordinate;
          const lat = coord?.latitude || null;
          const lng = coord?.longitude || null;

          listings.push({
            id: item.propertyId || null,
            name: name.substring(0, 200),
            type,
            location,
            beds,
            lat,
            lng,
            rating,
            reviews,
            price: pricePerNight,
          });
        } catch (parseErr) {
          console.warn("Skipped a listing:", parseErr.message);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to parse listings:", error.message);
  }

  return { listings, nextCursor, pageCursors };
}

// ---------------------------------------------------------------------------
// Scrape all pages for a single date
// ---------------------------------------------------------------------------

async function scrapeDate(cityConfig, checkinDate, checkoutDate) {
  let allListings = [];
  // 30 pages × ~18 results = enough to fully exhaust Airbnb's per-query
  // ceiling (~270). With a tight bbox the response is well under the cap.
  const MAX_PAGES = 30;

  // Page 1 (no cursor) also carries the full pageCursors[] list for this query.
  console.log(`  Fetching ${checkinDate} (page 1)...`);
  const firstPage = await fetchAirbnbPage(cityConfig, checkinDate, checkoutDate, null);
  const first = parseListings(firstPage);
  allListings = allListings.concat(first.listings);

  // Preferred path: walk the remaining pageCursors (index 0 is the page we just
  // fetched). Fallback: chase the legacy nextPageCursor chain if pageCursors is
  // absent. Either way we never exit after a single page unless there genuinely
  // is only one.
  const remainingCursors = (first.pageCursors || []).slice(1, MAX_PAGES);
  if (remainingCursors.length) {
    for (let i = 0; i < remainingCursors.length; i++) {
      await delay(2000);
      console.log(`  Fetching ${checkinDate} (page ${i + 2}/${remainingCursors.length + 1})...`);
      const pageData = await fetchAirbnbPage(cityConfig, checkinDate, checkoutDate, remainingCursors[i]);
      const { listings } = parseListings(pageData);
      allListings = allListings.concat(listings);
    }
  } else {
    let cursor = first.nextCursor;
    let page = 1;
    while (cursor && page < MAX_PAGES) {
      page++;
      await delay(2000);
      console.log(`  Fetching ${checkinDate} (page ${page}, legacy cursor)...`);
      const pageData = await fetchAirbnbPage(cityConfig, checkinDate, checkoutDate, cursor);
      const { listings, nextCursor } = parseListings(pageData);
      allListings = allListings.concat(listings);
      cursor = nextCursor;
    }
  }

  // Dedup within the date: page cursors overlap slightly, so the same listing
  // can appear on two pages. Key by coordinate; keep coordinate-less listings
  // (we can't tell them apart and dropping them loses data).
  const seenCoords = new Set();
  allListings = allListings.filter((l) => {
    if (l.lat == null || l.lng == null) return true;
    const k = `${l.lat},${l.lng}`;
    if (seenCoords.has(k)) return false;
    seenCoords.add(k);
    return true;
  });

  // Belt-and-braces distance filter: even with the bbox, Airbnb sometimes
  // returns properties slightly outside the box. Drop anything beyond the
  // configured radius from the city centre. Listings without coordinates
  // are kept (we can't measure them, and dropping them would silently lose
  // data). When tweaking the radius, also tweak the bbox above.
  let listings = allListings;
  if (cityConfig.center && cityConfig.radiusKm) {
    const before = listings.length;
    listings = listings.filter((l) => {
      if (l.lat == null || l.lng == null) return true;
      const dLat = (l.lat - cityConfig.center.lat) * 111;
      const dLng =
        (l.lng - cityConfig.center.lng) *
        111 *
        Math.cos((cityConfig.center.lat * Math.PI) / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng) <= cityConfig.radiusKm;
    });
    const dropped = before - listings.length;
    if (dropped > 0) {
      console.log(`  Distance filter: dropped ${dropped} of ${before} listings outside ${cityConfig.radiusKm} km`);
    }
  }

  // Calculate aggregates
  const prices = listings
    .map((l) => l.price)
    .filter((p) => p !== null && p > 0)
    .sort((a, b) => a - b);

  const avgPrice =
    prices.length > 0
      ? Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100
      : null;

  const medianPrice =
    prices.length > 0
      ? prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)]
      : null;

  return {
    totalListings: listings.length,
    listings,
    avgPrice,
    medianPrice,
  };
}

// ---------------------------------------------------------------------------
// DB insert
// ---------------------------------------------------------------------------

// After all 90 dates are saved, count unique properties seen across the
// entire scrape (union over the 90 forward dates) and stamp that count on
// every row from today's scrape. Enables per-date occupancy proxy.
async function setScrapeUniqueCount(citySlug) {
  const result = await pgPool.query(
    `WITH scrape_props AS (
       SELECT DISTINCT
         listing->>'name' AS name,
         listing->>'type' AS type,
         listing->>'beds' AS beds,
         (listing->>'lat')::numeric AS lat,
         (listing->>'lng')::numeric AS lng
       FROM airbnb_availability_snapshots s,
            jsonb_array_elements(s.listings) AS listing
       WHERE s.city_slug = $1
         AND s.scraped_at::date = CURRENT_DATE
     )
     UPDATE airbnb_availability_snapshots
     SET scrape_unique_properties = (SELECT COUNT(*) FROM scrape_props)
     WHERE city_slug = $1
       AND scraped_at::date = CURRENT_DATE
     RETURNING (SELECT COUNT(*) FROM scrape_props) AS unique_count`,
    [citySlug]
  );
  return result.rows[0]?.unique_count || 0;
}

async function saveSnapshot(citySlug, checkinDate, data) {
  const query = `
    INSERT INTO airbnb_availability_snapshots
      (city_slug, checkin_date, total_listings, listings, avg_price, median_price, scraped_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (city_slug, checkin_date, (CAST(scraped_at AT TIME ZONE 'UTC' AS DATE)))
    DO UPDATE SET
      total_listings = EXCLUDED.total_listings,
      listings       = EXCLUDED.listings,
      avg_price      = EXCLUDED.avg_price,
      median_price   = EXCLUDED.median_price,
      scraped_at     = NOW()
    RETURNING id;
  `;

  const values = [
    citySlug,
    checkinDate,
    data.totalListings,
    JSON.stringify(data.listings),
    data.avgPrice,
    data.medianPrice,
  ];

  const result = await pgPool.query(query, values);
  return result.rows[0].id;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(fn, attempts = 3, delayMs = 10000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts) throw error;
      const shortError = error.message.split("\n")[0];
      console.warn(
        `  Attempt ${i}/${attempts} failed. Retrying in ${delayMs / 1000}s... Error: ${shortError}`
      );
      await delay(delayMs);
    }
  }
}

async function sendSummaryEmail(stats, startTime, uniqueCount) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY not found. Skipping summary email.");
    return;
  }

  const duration = ((new Date() - startTime) / 1000 / 60).toFixed(2);

  // "Dates scraped" only proves the run executed — NOT that it captured the
  // market. A broken paginator returns one page (18) per date and still reports
  // 90/90. Gate health on real coverage: the cross-date union of unique
  // properties and the best single-date count must clear sane floors, and most
  // dates must return more than one page.
  const UNIQUE_FLOOR = 80; // Archanes universe is ~200; <80 means truncation/regression
  const reasons = [];
  if (stats.failures > 0) reasons.push(`${stats.failures} date(s) failed`);
  if (uniqueCount < UNIQUE_FLOOR) reasons.push(`union of unique properties ${uniqueCount} < ${UNIQUE_FLOOR}`);
  if (stats.maxListingsPerDate <= ONE_PAGE) reasons.push(`best date only ${stats.maxListingsPerDate} listings (one-page cap)`);
  if (stats.truncatedDates > stats.successes * 0.25) reasons.push(`${stats.truncatedDates}/${stats.successes} dates returned <=${ONE_PAGE} listings`);
  const healthy = reasons.length === 0;
  const flag = healthy ? "✅" : "⚠️";

  const msg = {
    to: "karol@rockenue.com",
    from: "codex@em4689.market-pulse.io",
    subject: `${flag} Airbnb Codex: ${stats.city} — ${healthy ? "healthy" : "CHECK"} (${uniqueCount} unique, ${stats.successes}/${stats.totalDays} dates)`,
    html: `
      <h1>Airbnb Codex Scraper: ${stats.city}</h1>
      <p style="font-size:16px"><strong>${flag} ${healthy ? "Healthy capture" : "Suspected truncation — investigate"}</strong></p>
      ${healthy ? "" : `<ul style="color:#b00">${reasons.map((r) => `<li>${r}</li>`).join("")}</ul>`}
      <ul>
        <li><strong>Unique properties (union across dates):</strong> ${uniqueCount}</li>
        <li><strong>Best single-date count:</strong> ${stats.maxListingsPerDate}</li>
        <li><strong>Dates at/under one page (&le;${ONE_PAGE}):</strong> ${stats.truncatedDates} / ${stats.successes}</li>
        <li><strong>Dates scraped:</strong> ${stats.successes} / ${stats.totalDays}</li>
        <li><strong>Failures:</strong> ${stats.failures}</li>
        <li><strong>Total listing-rows written:</strong> ${stats.totalListingsFound}</li>
        <li><strong>Duration:</strong> ${duration} minutes</li>
      </ul>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log("Summary email sent.");
  } catch (error) {
    console.error("Failed to send summary email:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const targetCitySlug = process.argv[2];

  if (!targetCitySlug || !CITY_CONFIGS[targetCitySlug]) {
    console.error(
      `Usage: node index.js <city_slug>\nAvailable: ${Object.keys(CITY_CONFIGS).join(", ")}`
    );
    process.exit(1);
  }

  const city = CITY_CONFIGS[targetCitySlug];

  const CONFIG = {
    // Default 90-day horizon. CODEX_MAX_DAYS lets a quick verification run scrape
    // just the first N dates (e.g. CODEX_MAX_DAYS=3 node index.js archanes).
    daysToScrape: Number(process.env.CODEX_MAX_DAYS) || 90,
    retries: 3,
    delayBetweenDates: 4000, // 4s between dates
    delayBetweenRetries: 15000,
  };

  const startTime = new Date();
  const stats = {
    city: city.name,
    totalDays: CONFIG.daysToScrape,
    successes: 0,
    failures: 0,
    totalListingsFound: 0,
    maxListingsPerDate: 0,
    truncatedDates: 0, // dates that came back with <=18 listings (one-page cap signature)
  };

  const failedDates = [];

  try {
    console.log(`Starting Airbnb scraper for ${city.name} (${CONFIG.daysToScrape} days)...`);
    const startDate = new Date();

    for (let i = 0; i < CONFIG.daysToScrape; i++) {
      const checkin = new Date(startDate);
      checkin.setDate(startDate.getDate() + i);
      const checkinStr = formatDate(checkin);
      const checkoutStr = formatDate(new Date(checkin.getTime() + 2 * 86400000));

      try {
        const data = await withRetries(
          () => scrapeDate(city, checkinStr, checkoutStr),
          CONFIG.retries,
          CONFIG.delayBetweenRetries
        );

        const id = await saveSnapshot(city.slug, checkinStr, data);
        stats.successes++;
        stats.totalListingsFound += data.totalListings;
        stats.maxListingsPerDate = Math.max(stats.maxListingsPerDate, data.totalListings);
        if (data.totalListings <= ONE_PAGE) stats.truncatedDates++;

        console.log(
          `  ${checkinStr}: ${data.totalListings} listings, avg ${city.currency} ${data.avgPrice || "N/A"} (ID: ${id})`
        );
      } catch (error) {
        stats.failures++;
        console.error(
          `  FAILED ${checkinStr} after ${CONFIG.retries} attempts: ${error.message.split("\n")[0]}`
        );
        failedDates.push({ checkinStr, checkoutStr });
      }

      if (i < CONFIG.daysToScrape - 1) {
        await delay(CONFIG.delayBetweenDates);
      }
    }

    // Cool-down retry pass
    if (failedDates.length > 0) {
      console.log(
        `\nCooling down 5 min before retrying ${failedDates.length} failed dates...`
      );
      await delay(300000);

      for (const [index, date] of failedDates.entries()) {
        try {
          const data = await withRetries(
            () => scrapeDate(city, date.checkinStr, date.checkoutStr),
            CONFIG.retries,
            CONFIG.delayBetweenRetries
          );

          await saveSnapshot(city.slug, date.checkinStr, data);
          stats.successes++;
          stats.failures--;
          stats.totalListingsFound += data.totalListings;
          stats.maxListingsPerDate = Math.max(stats.maxListingsPerDate, data.totalListings);
          if (data.totalListings <= ONE_PAGE) stats.truncatedDates++;
          console.log(`  Retry OK: ${date.checkinStr} — ${data.totalListings} listings`);
        } catch (error) {
          console.error(
            `  Retry FAILED again: ${date.checkinStr} — ${error.message.split("\n")[0]}`
          );
        }

        if (index < failedDates.length - 1) {
          await delay(CONFIG.delayBetweenDates);
        }
      }
    }
  } catch (criticalError) {
    console.error("Fatal error:", criticalError);
  } finally {
    console.log(
      `\nDone: ${stats.successes}/${stats.totalDays} dates, ${stats.totalListingsFound} total listings.`
    );
    // Stamp scrape_unique_properties on every row from today's scrape now that
    // the full 90-day window is in the table. Powers the per-date occupancy proxy.
    let uniqueCount = 0;
    try {
      uniqueCount = await setScrapeUniqueCount(city.slug);
      console.log(`Unique properties across full scrape: ${uniqueCount}`);
    } catch (e) {
      console.error("setScrapeUniqueCount error:", e.message);
    }
    try {
      await sendSummaryEmail(stats, startTime, uniqueCount);
    } catch (e) {
      console.error("Email error:", e.message);
    }
    try {
      await pgPool.end();
    } catch (e) {
      console.error("DB close error:", e.message);
    }
  }
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
