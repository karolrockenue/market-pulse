require("dotenv").config();
const playwright = require("playwright-core");
const pgPool = require("./utils/db.js");

// Conditionally require @sparticuz/chromium only in production.
let chromium = null;
if (process.env.VERCEL_ENV === "production") {
  chromium = require("@sparticuz/chromium");
}

async function scrapeFacetGroup(page, filterName) {
  const results = {};
  try {
    const groupContainer = page
      .locator('div[data-testid="filters-group"], fieldset')
      .filter({ hasText: new RegExp(filterName, "i") });
    const showAllButton = groupContainer
      .locator('button[data-testid="filters-group-expand-collapse"]')
      .first();
    if (await showAllButton.isVisible({ timeout: 1000 })) {
      await showAllButton.click();
      await page.waitForTimeout(500);
    }
    const parentButtons = await groupContainer
      .locator('button[data-testid="parent-checkbox-filter"]')
      .all();
    if (parentButtons.length > 0) {
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
      `Could not fully parse facet group: "${filterName}"`,
      error.message
    );
  }
  return results;
}

async function scrapePriceHistogram(page) {
  const results = [];
  try {
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
    console.warn(`Could not parse price histogram.`, error.message);
  }
  return results;
}

async function scrapeCity(
  browser,
  checkinDate,
  checkoutDate,
  cityName,
  citySlug
) {
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
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    try {
      await page
        .locator("button#onetrust-accept-btn-handler")
        .click({ timeout: 5000 });
      await page.waitForLoadState("networkidle");
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
      const propertyTypes = await scrapeFacetGroup(page, "Property type");
      const starRatings = await scrapeFacetGroup(page, "Property rating");
      const neighbourhoods = await scrapeFacetGroup(page, "Neighborhood");
      const priceHistogram = await scrapePriceHistogram(page);
      const insertQuery = `INSERT INTO market_availability_snapshots(provider, city_slug, checkin_date, total_results, facet_property_type, facet_star_rating, facet_neighbourhood, facet_price_histogram, scraped_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) ON CONFLICT (provider, city_slug, checkin_date, (CAST(scraped_at AT TIME ZONE 'UTC' AS DATE))) DO UPDATE SET total_results = EXCLUDED.total_results, facet_property_type = EXCLUDED.facet_property_type, facet_star_rating = EXCLUDED.facet_star_rating, facet_neighbourhood = EXCLUDED.facet_neighbourhood, facet_price_histogram = EXCLUDED.facet_price_histogram, scraped_at = NOW() RETURNING id;`;
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
        `✅ [DEBUG-STEP-1] Successfully saved snapshot for ${checkinDate} with ID: ${result.rows[0].id}`
      );
    } else {
      throw new Error("Could not find total properties on page.");
    }
  } finally {
    if (context) {
      await context.close();
    }
  }
}

function formatDate(date) {
  /* ... same as before ... */
}
function delay(ms) {
  /* ... same as before ... */
}

async function main() {
  console.log("🚀 [DEBUG-STEP-1] Starting Monolithic Scraper Test...");
  const cityToScrape = { name: "London", slug: "london" };
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    // Hardcoded to 5 days for this test
    let browser = null;
    const checkinDate = new Date(today);
    checkinDate.setDate(today.getDate() + i);
    const checkinStr = formatDate(checkinDate);
    const checkoutStr = formatDate(new Date(checkinDate.getTime() + 86400000));
    try {
      let launchOptions = {
        proxy: {
          server: `http://${process.env.PROXY_ENDPOINT}`,
          username: process.env.PROXY_USERNAME,
          password: process.env.PROXY_PASSWORD,
        },
      };
      if (process.env.VERCEL_ENV === "production") {
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.args = chromium.args;
        launchOptions.headless = true;
      } else {
        launchOptions.headless = false;
      }
      browser = await playwright.chromium.launch(launchOptions);
      await scrapeCity(
        browser,
        checkinStr,
        checkoutStr,
        cityToScrape.name,
        cityToScrape.slug
      );
    } catch (error) {
      console.error(
        `A critical error occurred during the scrape for ${checkinStr}:`,
        error
      );
    } finally {
      if (browser) {
        await browser.close();
      }
      if (i < 4) {
        await delay(5000);
      }
    }
  }
  await pgPool.end();
  console.log("Database pool closed. Monolithic run finished.");
}

module.exports = async (req, res) => {
  console.log("[DEBUG-STEP-1] Monolithic handler invoked.");
  try {
    await main();
    res.status(200).send("Monolithic scraper run completed.");
  } catch (error) {
    console.error(
      "[DEBUG-STEP-1] CRITICAL FAILURE in monolithic handler:",
      error
    );
    res.status(500).send(`Monolithic scraper failed: ${error.message}`);
  }
};
