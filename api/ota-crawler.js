require("dotenv").config();
const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const pgPool = require("./utils/db.js");

/**
 * A resilient function to scrape a filter facet group using Puppeteer.
 * It's refactored from Playwright's locator API to Puppeteer's ElementHandle API.
 *
 * @param {import('puppeteer').Page} page The Puppeteer page object.
 * @param {string} filterName The name of the filter group to scrape (e.g., "Property type").
 * @returns {Promise<{[key: string]: number}>} A promise that resolves to an object of scraped names and counts.
 */
async function scrapeFacetGroup(page, filterName) {
  const results = {};
  try {
    console.log(`🔍 Scraping facet group: "${filterName}"...`);

    // In Puppeteer, we fetch all potential containers and then find the correct one.
    const groupContainers = await page.$$(
      'div[data-testid="filters-group"], fieldset'
    );
    let groupContainer = null;
    for (const container of groupContainers) {
      const text = await container.evaluate((node) => node.innerText);
      if (text && text.toLowerCase().includes(filterName.toLowerCase())) {
        groupContainer = container;
        break;
      }
    }

    if (!groupContainer) {
      console.warn(`Could not find container for "${filterName}".`);
      return results;
    }

    // Click the "Show all" button if it exists using the '$' selector.
    const showAllButton = await groupContainer.$(
      'button[data-testid="filters-group-expand-collapse"]'
    );
    if (showAllButton) {
      console.log(`  -> Clicking "Show all" for "${filterName}"...`);
      await showAllButton.click();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Puppeteer's equivalent for waitForTimeout
    }

    // Expand any collapsed parent categories.
    const parentButtons = await groupContainer.$$(
      'button[data-testid="parent-checkbox-filter"][aria-expanded="false"]'
    );
    if (parentButtons.length > 0) {
      console.log(
        `  -> Expanding ${parentButtons.length} parent categories for "${filterName}".`
      );
      for (const button of parentButtons) {
        await button.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Scrape the individual filter items using '$$' to get all matching elements.
    const options = await groupContainer.$$("div[data-filters-item]");
    for (const option of options) {
      const nameEl = await option.$(
        'div[data-testid="filters-group-label-content"]'
      );
      const countEl = await option.$(".fff1944c52");

      if (nameEl && countEl) {
        // We use '.evaluate()' to run code in the browser context to get text content.
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
 * The main generic scraper function for a given city, refactored for Puppeteer.
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
  let page = null;
  try {
    // Puppeteer does not use a 'context' in the same way Playwright does.
    // We create a page directly from the browser instance.
    page = await browser.newPage();

    // Set user agent and viewport on the page object.
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // If the proxy requires authentication, we set it up here on the page.
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      await page.authenticate({
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      });
    }

    const urlCityName = cityName.replace(" ", "+");
    const targetUrl = `https://www.booking.com/searchresults.html?ss=${urlCityName}&checkin=${checkinDate}&checkout=${checkoutDate}&group_adults=2&lang=en-us`;

    console.log(`Navigating to ${targetUrl}...`);
    // 'networkidle2' is a common waitUntil setting for Puppeteer to ensure the page is fully loaded.
    await page.goto(targetUrl, { waitUntil: "networkidle2" });
    console.log("Page loaded and network is idle.");

    try {
      // In Puppeteer, it's robust to wait for a selector and then click it.
      await page.waitForSelector("button#onetrust-accept-btn-handler", {
        timeout: 5000,
      });
      await page.click("button#onetrust-accept-btn-handler");
      console.log("Cookie consent button clicked.");
      await page.waitForNavigation({ waitUntil: "networkidle2" });
      console.log("Network is idle after click.");
    } catch (error) {
      console.log("Cookie consent button not found, continuing...");
    }

    // Wait for the h1 to be present before evaluating its content.
    await page.waitForSelector("h1", { timeout: 10000 });
    const headerText = await page.evaluate(() => {
      const h1s = Array.from(document.querySelectorAll("h1"));
      const target = h1s.find((h) =>
        /properties found/i.test(h.textContent || "")
      );
      return target ? target.textContent : "";
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
    if (page) {
      await page.close();
    }
  }
}

/**
 * Helper function to format a Date object into YYYY-MM-DD string.
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to create a delay.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The main orchestration function.
 */
async function main() {
  console.log("🚀 Starting the Market Pulse OTA Crawler...");
  let browser = null;

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  const cityToScrape = { name: "London", slug: "london" };

  try {
    // In Puppeteer, proxy settings are passed as command-line arguments.
    const args = [...chromium.args];
    if (process.env.PROXY_ENDPOINT) {
      args.push(`--proxy-server=${process.env.PROXY_ENDPOINT}`);
    }

    // This is the clean Puppeteer launch configuration. We let the package
    // handle all the complex environmental details without manual overrides.
    browser = await puppeteer.launch({
      args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    console.log(
      `Browser launched successfully. Target city: ${cityToScrape.name}`
    );

    const today = new Date();

    for (let i = 0; i < 120; i++) {
      const checkinDate = new Date(today);
      checkinDate.setDate(today.getDate() + i);
      const checkoutDate = new Date(checkinDate);
      checkoutDate.setDate(checkinDate.getDate() + 1);
      const checkinStr = formatDate(checkinDate);
      const checkoutStr = formatDate(checkoutDate);

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
          if (attempt === MAX_RETRIES) {
            console.error(
              `---\n ❌ All ${MAX_RETRIES} attempts failed for ${checkinStr}. Moving to next day. \n---`
            );
          } else {
            console.log(
              `---\n Retrying in ${RETRY_DELAY / 1000} seconds... \n---`
            );
            await delay(RETRY_DELAY);
          }
        }
      }

      if (i < 119) {
        const randomDelay = 4000 + Math.random() * 4000;
        console.log(
          `---\n Throttling: Waiting for ${(randomDelay / 1000).toFixed(
            2
          )} seconds... \n---`
        );
        await delay(randomDelay);
      }
    }

    console.log("✅ Crawler run finished for all 120 days.");
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

// This is the classic Vercel handler syntax (CommonJS) for maximum compatibility.
module.exports = async (request, response) => {
  try {
    await main();
    response.status(200).send("Scraper run completed successfully.");
  } catch (error) {
    console.error("An error occurred during the scraper run:", error);
    response.status(500).send(`Scraper run failed: ${error.message}`);
  }
};
