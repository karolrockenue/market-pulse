require("dotenv").config();
const chromium = require("@sparticuz/chromium");
const playwright = require("playwright-core");
// ...
const pgPool = require("./utils/db.js");
const fs = require("fs");

/**
 * A resilient function to scrape a filter facet group from the search results page.
 * It can handle simple flat lists, lists with a "Show all" button, and complex
 * lists with nested, expandable parent categories.
 *
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
 * Scrapes the price distribution histogram from the "Your budget" filter.
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
  let context;

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
  let browser;

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;

  const cityToScrape = { name: "London", slug: "london" };

  try {
    const proxyConfig = {
      server: process.env.PROXY_ENDPOINT,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    };

    let executablePath;
    try {
      console.log(
        "Attempting to get executable path from @sparticuz/chromium..."
      );
      executablePath = await chromium.executablePath();
      console.log("Successfully got executable path:", executablePath);
    } catch (e) {
      console.error(
        "CRITICAL: Failed to get executable path from chromium.",
        e
      );
      // Re-throw the error to ensure the main catch block handles it
      throw e;
    }

    // The libraryPath property is undefined in this environment, which is the root cause of the error.
    // The libraryPath property is undefined in this environment, which is the root cause of the error.
    // We will manually set the path to the known location of the shared libraries.
    const libraryPath = "/tmp/swiftshader";
    console.log(
      "Final Library Path to be used (manual override):",
      libraryPath
    );

    // --- FINAL DIAGNOSTIC: Check if the library file actually exists ---
    try {
      const dirExists = fs.existsSync(libraryPath);
      console.log(
        `DIAGNOSTIC - Does ${libraryPath} directory exist?`,
        dirExists
      );
      if (dirExists) {
        const files = fs.readdirSync(libraryPath);
        console.log(
          `DIAGNOSTIC - Contents of ${libraryPath}:`,
          files.join(", ")
        );
        const libExists = files.includes("libnss3.so");
        console.log(
          "DIAGNOSTIC - Does libnss3.so exist in that directory?",
          libExists
        );
      }
    } catch (e) {
      console.error("DIAGNOSTIC - Error checking file system:", e);
    }
    // --- END FINAL DIAGNOSTIC ---

    browser = await playwright.chromium.launch({
      // Use the arguments recommended by the package for serverless environments.
      args: chromium.args,
      // Use the executable path we logged above.
      executablePath: executablePath,
      // The headless option for Playwright must be a boolean.
      headless: true,
      proxy: proxyConfig,
      // Set the library path env variable to the correct, manually-defined path.
      // This allows the Chromium executable to find libnss3.so and other dependencies.
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${libraryPath}:${process.env.LD_LIBRARY_PATH || ""}`,
      },
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

// This is the standard Vercel serverless function handler.
export default async function handler(request, response) {
  try {
    await main();
    response.status(200).send("Scraper run completed successfully.");
  } catch (error) {
    console.error("An error occurred during the scraper run:", error);
    response.status(500).send(`Scraper run failed: ${error.message}`);
  }
}
