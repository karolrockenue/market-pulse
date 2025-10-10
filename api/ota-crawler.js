require("dotenv").config();
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const pgPool = require("./utils/db.js");

/**
 * A resilient function to scrape a filter facet group using Puppeteer.
 *
 * @param {import('puppeteer').Page} page The Puppeteer page object.
 * @param {string} filterName The name of the filter group to scrape (e.g., "Property type").
 * @returns {Promise<{[key: string]: number}>} A promise that resolves to an object of scraped names and counts.
 */
async function scrapeFacetGroup(page, filterName) {
  const results = {};
  try {
    console.log(`🔍 Scraping facet group: "${filterName}"...`);

    // Find the main container for the filter group.
    const groupContainer = (
      await page.$$('div[data-testid="filters-group"], fieldset')
    ).find(async (el) => {
      const text = await el.evaluate((node) => node.innerText);
      return text.includes(filterName);
    });

    if (!groupContainer) {
      console.warn(`Could not find container for "${filterName}".`);
      return results;
    }

    // Click the "Show all" button if it exists.
    const showAllButton = await groupContainer.$(
      'button[data-testid="filters-group-expand-collapse"]'
    );
    if (showAllButton) {
      console.log(`  -> Clicking "Show all" for "${filterName}"...`);
      await showAllButton.click();
      await page.waitForTimeout(500);
    }

    // Expand any parent categories.
    const parentButtons = await groupContainer.$$(
      'button[data-testid="parent-checkbox-filter"][aria-expanded="false"]'
    );
    if (parentButtons.length > 0) {
      console.log(
        `  -> Expanding ${parentButtons.length} parent categories for "${filterName}".`
      );
      for (const button of parentButtons) {
        await button.click();
        await page.waitForTimeout(500);
      }
    }

    // Scrape the individual filter items.
    const options = await groupContainer.$$("div[data-filters-item]");
    for (const option of options) {
      const nameEl = await option.$(
        'div[data-testid="filters-group-label-content"]'
      );
      const countEl = await option.$(".fff1944c52");

      if (nameEl && countEl) {
        const name = await nameEl.evaluate((node) => node.innerText.trim());
        const countText = await countEl.evaluate((node) =>
          node.textContent.trim()
        );
        const count = parseInt(countText.replace(/,/g, ""), 10);

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
 * Scrapes the price distribution histogram using Puppeteer.
 * @param {import('puppeteer').Page} page The Puppeteer page object.
 * @returns {Promise<number[]>} An array of integers representing the histogram bar heights.
 */
async function scrapePriceHistogram(page) {
  const results = [];
  try {
    console.log(`📊 Scraping price histogram...`);
    const histogramContainer = await page.$(
      'div[data-testid="filters-group-histogram"]'
    );
    if (histogramContainer) {
      const bars = await histogramContainer.$$("span");
      for (const bar of bars) {
        const style = await bar.evaluate((node) => node.getAttribute("style"));
        const match = style.match(/height:\s*(\d+)%/);
        if (match && match[1]) {
          results.push(parseInt(match[1], 10));
        }
      }
    }
  } catch (error) {
    console.warn(`Could not find or parse the price histogram.`, error.message);
  }
  return results;
}

/**
 * The main generic scraper function for a given city.
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
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
    );

    const urlCityName = cityName.replace(" ", "+");
    const targetUrl = `https://www.booking.com/searchresults.html?ss=${urlCityName}&checkin=${checkinDate}&checkout=${checkoutDate}&group_adults=2&lang=en-us`;

    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "networkidle2" });
    console.log("Page loaded and network is idle.");

    // Handle cookie consent button
    try {
      const cookieButton = await page.waitForSelector(
        "button#onetrust-accept-btn-handler",
        { timeout: 5000 }
      );
      await cookieButton.click();
      console.log("Cookie consent button clicked.");
      await page.waitForNavigation({ waitUntil: "networkidle2" });
      console.log("Network is idle after click.");
    } catch (error) {
      console.log("Cookie consent button not found, continuing...");
    }

    const resultsHeader = await page.waitForSelector(
      'h1:has-text("properties found")',
      { timeout: 10000 }
    );
    const headerText = await resultsHeader.evaluate((el) => el.textContent);
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

      // Database insertion logic (remains unchanged)
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
    if (page) {
      await page.close();
    }
  }
}

function formatDate(date) {
  /* ... (This function remains unchanged) ... */
}
function delay(ms) {
  /* ... (This function remains unchanged) ... */
}

/**
 * The main orchestration function.
 */
async function main() {
  console.log("🚀 Starting the Market Pulse OTA Crawler...");
  let browser;

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  const cityToScrape = { name: "London", slug: "london" };

  try {
    // This is the new Puppeteer launch configuration. It is much more stable on Vercel.
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    console.log(
      `Browser launched successfully. Target city: ${cityToScrape.name}`
    );

    // ... (The rest of the main function's loop logic remains unchanged) ...
  } catch (error) {
    console.error("A critical error occurred in the main process:", error);
  } finally {
    if (browser) {
      await browser.close();
      console.log("Browser closed.");
    }
    await pgPool.end();
    console.log("Database pool closed.");
  }
}

// This is the classic Vercel handler syntax for maximum compatibility.
module.exports = async (request, response) => {
  try {
    await main();
    response.status(200).send("Scraper run completed successfully.");
  } catch (error) {
    console.error("An error occurred during the scraper run:", error);
    response.status(500).send(`Scraper run failed: ${error.message}`);
  }
};
