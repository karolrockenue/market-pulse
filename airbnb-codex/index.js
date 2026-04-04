require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const fetch = require("node-fetch");
const pgPool = require("./utils/db.js");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ---------------------------------------------------------------------------
// City configs
// ---------------------------------------------------------------------------
const CITY_CONFIGS = {
  archanes: {
    name: "Archanes, Crete",
    slug: "archanes",
    currency: "EUR",
    query: "Archanes--Greece",
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
  });

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

  try {
    const entries = pageData.niobeClientData || [];

    for (const [key, value] of entries) {
      if (!key.startsWith("StaysSearch")) continue;

      const results = value?.data?.presentation?.staysSearch?.results;
      if (!results) continue;

      // Pagination
      const pag = results.paginationInfo;
      if (pag?.nextPageCursor) {
        nextCursor = pag.nextPageCursor;
      }

      const items = results.searchResults || [];

      for (const item of items) {
        try {
          // --- PRICE: extract nightly rate ---
          let pricePerNight = null;
          const priceDetails = item.structuredDisplayPrice?.explanationData?.priceDetails;
          if (priceDetails) {
            for (const group of priceDetails) {
              for (const line of group.items || []) {
                const desc = line.description || "";
                // Match "2 nights x 200 zł" or "1 night x 473.63 zł"
                const nightlyMatch = desc.match(/night[s]?\s*x\s*([\d,.]+)/i);
                if (nightlyMatch) {
                  pricePerNight = parseFloat(nightlyMatch[1].replace(/,/g, ""));
                  break;
                }
              }
              if (pricePerNight) break;
            }
          }
          // Fallback: total ÷ 2 nights
          if (!pricePerNight) {
            const label = item.structuredDisplayPrice?.primaryLine?.discountedPrice
              || item.structuredDisplayPrice?.primaryLine?.price || "";
            const totalMatch = label.match(/([\d,.]+)/);
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

  return { listings, nextCursor };
}

// ---------------------------------------------------------------------------
// Scrape first page for a single date (page 1 only — sufficient for Archanes)
// ---------------------------------------------------------------------------

async function scrapeDate(cityConfig, checkinDate, checkoutDate) {
  console.log(`  Fetching ${checkinDate}...`);

  const pageData = await fetchAirbnbPage(cityConfig, checkinDate, checkoutDate);
  const { listings } = parseListings(pageData);

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

async function sendSummaryEmail(stats, startTime) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY not found. Skipping summary email.");
    return;
  }

  const duration = ((new Date() - startTime) / 1000 / 60).toFixed(2);

  const msg = {
    to: "karol@rockenue.com",
    from: "codex@em4689.market-pulse.io",
    subject: `Airbnb Codex: ${stats.city} - ${stats.successes}/${stats.totalDays} dates`,
    html: `
      <h1>Airbnb Codex Scraper: ${stats.city}</h1>
      <ul>
        <li><strong>Dates Scraped:</strong> ${stats.successes} / ${stats.totalDays}</li>
        <li><strong>Failures:</strong> ${stats.failures}</li>
        <li><strong>Total Listings Found:</strong> ${stats.totalListingsFound}</li>
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
    daysToScrape: 90,
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
    try {
      await sendSummaryEmail(stats, startTime);
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
