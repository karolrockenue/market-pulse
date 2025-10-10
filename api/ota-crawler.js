require("dotenv").config();
const playwright = require("playwright-core");
const pgPool = require("./utils/db.js");
/**
 * This is the original Playwright version of the facet scraping function.
 * @param {import('playwright').Page} page The Playwright page object.
 * @param {string} filterName The name of the filter group to scrape (e.g., "Property type").
 * @returns {Promise<{[key: string]: number}>} A promise that resolves to an object of scraped names and counts.
 */
async function scrapeFacetGroup(page, filterName) {
  const results = {};
  try {
    console.log(`🔍 Scraping facet group: "${filterName}"...`);

    const groupContainer = page
      .locator('div[data-testid="filters-group"], fieldset')
      .filter({
        hasText: new RegExp(filterName, "i"),
      });

    const showAllButton = groupContainer
      .locator('button[data-testid="filters-group-expand-collapse"]')
      .first();
    if (await showAllButton.isVisible({ timeout: 1000 })) {
      console.log(`  -> Clicking "Show all" for "${filterName}"...`);
      await showAllButton.click();
      await page.waitForTimeout(500);
    }

    const parentButtons = await groupContainer
      .locator('button[data-testid="parent-checkbox-filter"]')
      .all();

    if (parentButtons.length > 0) {
      console.log(
        `  -> Found ${parentButtons.length} parent categories to expand for "${filterName}".`
      );
      for (const button of parentButtons) {
        if (
          (await button.isVisible()) &&
          (await button.getAttribute("aria-expanded")) === "false"
        ) {
          await button.click();
          await page.waitForTimeout(500);
        }
      }
    }

    const options = await groupContainer
      .locator("div[data-filters-item]")
      .all();
    for (const option of options) {
      const nameElement = option.locator(
        'div[data-testid="filters-group-label-content"]'
      );
      const countElement = option.locator(".fff1944c52");

      if ((await nameElement.count()) > 0 && (await countElement.count()) > 0) {
        const name = (await nameElement.innerText()).trim();
        const countText = await countElement.textContent();
        const count = parseInt(countText.trim().replace(/,/g, ""), 10);

        if (name && !isNaN(count)) {
          results[name] = count;
        }
      }
    }
  } catch (error) {
    console.warn(
      `Could not fully parse the facet group: "${filterName}"`,
      error.message
    );
  }
  return results;
}

/**
 * The original Playwright version of the price histogram scraping function.
 * @param {import('playwright').Page} page The Playwright page object.
 * @returns {Promise<number[]>} An array of integers representing the histogram bar heights.
 */
async function scrapePriceHistogram(page) {
  const results = [];
  try {
    console.log(`📊 Scraping price histogram...`);
    const histogramContainer = page.locator(
      'div[data-testid="filters-group-histogram"]'
    );
    const bars = await histogramContainer.locator("span").all();
    for (const bar of bars) {
      const style = await bar.getAttribute("style");
      const match = style.match(/height:\s*(\d+)%/);
      if (match && match[1]) {
        results.push(parseInt(match[1], 10));
      }
    }
  } catch (error) {
    console.warn(`Could not find or parse the price histogram.`, error.message);
  }
  return results;
}

/**
 * The original Playwright version of the main scraper function.
 */
async function scrapeCity(
  browser,
  checkinDate,
  checkoutDate,
  cityName,
  citySlug
) {
  console.log(
    `\n---\n Scraping ${cityName} for check-in date: ${checkinDate} \n---`
  );
  let context = null;

  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    const urlCityName = cityName.replace(" ", "+");
    const targetUrl = `https://www.booking.com/searchresults.html?ss=${urlCityName}&checkin=${checkinDate}&checkout=${checkoutDate}&group_adults=2&lang=en-us`;

    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    console.log("Page loaded and network is idle.");

    try {
      await page
        .locator("button#onetrust-accept-btn-handler")
        .click({ timeout: 5000 });
      console.log("Cookie consent button clicked.");
      await page.waitForLoadState("networkidle");
      console.log("Network is idle after click.");
    } catch (error) {
      console.log("Cookie consent button not found, continuing...");
    }

    const resultsHeaderLocator = page.locator(
      'h1:has-text("properties found")'
    );
    const headerText = await resultsHeaderLocator.textContent({
      timeout: 10000,
    });
    const numberMatch = headerText.match(/\d{1,3}(,\d{3})*/);

    if (numberMatch && numberMatch[0]) {
      const totalResults = parseInt(numberMatch[0].replace(/,/g, ""), 10);
      console.log(`Total properties found: ${totalResults}`);

      const propertyTypes = await scrapeFacetGroup(page, "Property type");
      const starRatings = await scrapeFacetGroup(page, "Property rating");
      const neighbourhoods = await scrapeFacetGroup(page, "Neighborhood");
      const priceHistogram = await scrapePriceHistogram(page);

      console.log("📊 Scraped Property Types:", propertyTypes);
      console.log("⭐️ Scraped Star Ratings:", starRatings);
      console.log("📍 Scraped Neighbourhoods:", neighbourhoods);
      console.log("💰 Scraped Price Histogram:", priceHistogram);

      const insertQuery = `
        INSERT INTO market_availability_snapshots(
          provider, city_slug, checkin_date, total_results,
          facet_property_type, facet_star_rating, facet_neighbourhood,
          facet_price_histogram, scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (provider, city_slug, checkin_date, (CAST(scraped_at AT TIME ZONE 'UTC' AS DATE)))
        DO UPDATE SET
          total_results = EXCLUDED.total_results,
          facet_property_type = EXCLUDED.facet_property_type,
          facet_star_rating = EXCLUDED.facet_star_rating,
          facet_neighbourhood = EXCLUDED.facet_neighbourhood,
          facet_price_histogram = EXCLUDED.facet_price_histogram,
          scraped_at = NOW()
        RETURNING id;
      `;
      const values = [
        "booking",
        citySlug,
        checkinDate,
        totalResults,
        JSON.stringify(propertyTypes),
        JSON.stringify(starRatings),
        JSON.stringify(neighbourhoods),
        JSON.stringify(priceHistogram),
      ];

      const result = await pgPool.query(insertQuery, values);
      console.log(
        `✅ Successfully saved/updated snapshot to DB with ID: ${result.rows[0].id}`
      );
    } else {
      console.log("Could not find the total number of properties on the page.");
    }
  } catch (error) {
    throw error;
  } finally {
    if (context) {
      await context.close();
    }
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The main orchestration function.
 */
async function main(startDay = 0, endDay = 119) {
  // Default to the full range
  console.log(
    `🚀 Starting the Market Pulse OTA Crawler for days ${startDay}-${endDay}...`
  );

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  const cityToScrape = { name: "London", slug: "london" };
  const today = new Date();

  // The main loop now iterates through the specified day range.
  for (let i = startDay; i <= endDay; i++) {
    let browser = null;

    const checkinDate = new Date(today);
    checkinDate.setDate(today.getDate() + i);
    const checkoutDate = new Date(checkinDate);
    checkoutDate.setDate(checkinDate.getDate() + 1);
    const checkinStr = formatDate(checkinDate);
    const checkoutStr = formatDate(checkoutDate);

    try {
      // A new browser is launched for each day.
      console.log("Preparing to launch browser for new day...");
      const proxyEndpoint = process.env.PROXY_ENDPOINT;
      const proxyUsername = process.env.PROXY_USERNAME;
      const proxyPassword = process.env.PROXY_PASSWORD;
      if (!proxyEndpoint || !proxyUsername || !proxyPassword) {
        throw new Error(
          "Proxy credentials are not set in environment variables."
        );
      }

      let launchOptions = {
        proxy: {
          server: `http://${proxyEndpoint}`,
          username: proxyUsername,
          password: proxyPassword,
        },
      };

      if (process.env.VERCEL_ENV === "production") {
        const chromium = require("@sparticuz/chromium");
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.args = chromium.args;
        launchOptions.headless = true;
      } else {
        launchOptions.headless = false;
      }
      browser = await playwright.chromium.launch(launchOptions);
      console.log(`Browser launched successfully for ${checkinStr}.`);

      let success = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await scrapeCity(
            browser,
            checkinStr,
            checkoutStr,
            cityToScrape.name,
            cityToScrape.slug
          );
          success = true;
          break;
        } catch (error) {
          console.warn(
            `---\n ⚠️ Attempt ${attempt}/${MAX_RETRIES} failed for ${checkinStr}: ${error.message} \n---`
          );
          if (attempt < MAX_RETRIES) {
            console.log(
              `---\n Retrying in ${RETRY_DELAY / 1000} seconds... \n---`
            );
            await delay(RETRY_DELAY);
          }
        }
      }

      if (!success) {
        console.error(
          `---\n ❌ All ${MAX_RETRIES} attempts failed for ${checkinStr}. Moving to next day. \n---`
        );
      }
    } catch (error) {
      console.error(
        `A critical error occurred during the scrape for ${checkinStr}:`,
        error
      );
    } finally {
      if (browser) {
        await browser.close();
        console.log(`Browser closed for ${checkinStr}.`);
      }
    }

    if (i < endDay) {
      const randomDelay = 4000 + Math.random() * 4000;
      console.log(
        `---\n Throttling: Waiting for ${(randomDelay / 1000).toFixed(
          2
        )} seconds... \n---`
      );
      await delay(randomDelay);
    }
  }

  await pgPool.end();
  console.log(
    `Database pool closed. Crawler run finished for days ${startDay}-${endDay}.`
  );
}
module.exports = async (req, res) => {
  // Add secret validation to the worker as well.
  const { secret, startDay, endDay } = req.query;
  const crawlerSecret = process.env.CRAWLER_SECRET;

  if (!crawlerSecret || secret !== crawlerSecret) {
    console.warn("Unauthorized attempt to trigger a crawler worker.");
    return res.status(401).send("Unauthorized");
  }

  // Parse startDay and endDay from the query, with defaults.
  const start = startDay ? parseInt(startDay, 10) : 0;
  const end = endDay ? parseInt(endDay, 10) : 4; // Default to a small local run.

  try {
    // We don't wait for main() to finish. This allows the manager to move on.
    main(start, end);
    // Immediately send a response to acknowledge the job has started.
    res
      .status(202)
      .send(`Accepted: Worker job started for days ${start}-${end}.`);
  } catch (error) {
    console.error("An error occurred during the scraper run:", error);
    // Note: This error will only catch immediate setup errors, not errors inside main().
    res.status(500).send(`Scraper run failed: ${error.message}`);
  }
};
