// This line loads the environment variables from your .env file
require("dotenv").config();

const playwright = require("playwright");

// Import our configured PostgreSQL connection pool
const pgPool = require("./utils/db.js");

// --- SendGrid Initialization ---
// Import the SendGrid mail library
const sgMail = require("@sendgrid/mail");
// Set the API key from our environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// --- End of SendGrid Initialization ---

/**
 * Scrapes the facet filter groups from the search results page (e.g., "Property type").
 * @param {import('playwright-core').Page} page - The Playwright page object.
 * @param {string} filterName - The name of the filter group to scrape (e.g., "Property rating").
 * @returns {Promise<Object>} A promise that resolves to an object of facet names and their counts.
 */
async function scrapeFacetGroup(page, filterName) {
  const results = {};
  try {
    // Find the container for the filter group by its text content
    const groupContainer = page
      .locator('div[data-testid="filters-group"], fieldset')
      .filter({ hasText: new RegExp(filterName, "i") });

    // Click the 'Show all' button if it exists to reveal all options
    const showAllButton = groupContainer
      .locator('button[data-testid="filters-group-expand-collapse"]')
      .first();
    if (await showAllButton.isVisible({ timeout: 1000 })) {
      await showAllButton.click({ force: true });
      await page.waitForTimeout(500); // Wait for animations
    }

    // Expand any parent checkboxes if they are collapsed
    const parentButtons = await groupContainer
      .locator('button[data-testid="parent-checkbox-filter"]')
      .all();
    if (parentButtons.length > 0) {
      for (const button of parentButtons) {
        if (
          (await button.isVisible()) &&
          (await button.getAttribute("aria-expanded")) === "false"
        ) {
          await button.click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    }

    // Loop through all filter items to extract their name and count
    const options = await groupContainer
      .locator("div[data-filters-item]")
      .all();
    for (const option of options) {
      const nameElement = option.locator(
        'div[data-testid="filters-group-label-content"]',
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
      error.message,
    );
  }
  return results;
}

/**
 * Scrapes the price distribution histogram from the filters sidebar.
 * @param {import('playwright-core').Page} page - The Playwright page object.
 * @returns {Promise<number[]>} A promise that resolves to an array of histogram bar heights (percentages).
 */
async function scrapePriceHistogram(page) {
  const results = [];
  try {
    const histogramContainer = page.locator(
      'div[data-testid="filters-group-histogram"]',
    );
    const bars = await histogramContainer.locator("span").all();
    for (const bar of bars) {
      const style = await bar.getAttribute("style");
      // Extract the height percentage from the style attribute
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

/**
 * Scrapes the min and max price values from the slider's input attributes.
 * @param {import('playwright-core').Page} page The Playwright page object.
 * @returns {Promise<{minPriceAnchor: number, maxPriceAnchor: number}>} An object with the min and max prices.
 */
async function scrapePriceAnchors(page) {
  try {
    // Target the main container for the price filter group using its unique data attribute.
    const priceGroup = page.locator('div[data-filters-group="price"]');

    // Find the first range input within that group to get the minimum price attribute.
    const minPrice = await priceGroup
      .locator('input[type="range"]')
      .first()
      .getAttribute("min");

    // Find the last range input within that group to get the maximum price attribute.
    const maxPrice = await priceGroup
      .locator('input[type="range"]')
      .last()
      .getAttribute("max");

    // Convert the scraped string values to numbers and return them.
    // If parsing fails for any reason, default to 0.
    return {
      minPriceAnchor: parseInt(minPrice, 10) || 0,
      maxPriceAnchor: parseInt(maxPrice, 10) || 0,
    };
  } catch (error) {
    console.warn("Could not parse price anchors.", error.message);
    // Return zeros if any part of the scraping fails to ensure the script doesn't crash.
    return { minPriceAnchor: 0, maxPriceAnchor: 0 };
  }
}

/**
 * Normalizes the price histogram array to ensure it contains exactly 50 bars.
 * If 100 bars are found (a common duplication artifact), it takes the first 50.
 * @param {number[]} hist The raw histogram array from the scraper.
 * @param {string} checkinDate The date being scraped, for logging purposes.
 * @returns {number[]} A clean 50-element histogram array.
 */
function normalizeHistogram(hist, checkinDate) {
  // If the histogram is already the correct length, do nothing.
  if (hist.length === 50) {
    return hist;
  }

  // If the histogram is duplicated (100 bars)
  if (hist.length === 100) {
    const firstHalf = hist.slice(0, 50);
    const secondHalf = hist.slice(50, 100);
    // Check if the two halves are identical.
    const isIdentical = firstHalf.every(
      (val, index) => val === secondHalf[index],
    );

    if (!isIdentical) {
      console.warn(
        `🟠 Histogram for ${checkinDate} has 100 bars, but halves differ. Using the first 50 as a fallback.`,
      );
    }
    // Return the first half.
    return firstHalf;
  }

  // If the length is unexpected, throw an error to trigger a retry.
  throw new Error(
    `Validation Failed: Unexpected histogram length of ${hist.length} for ${checkinDate}. Expected 50.`,
  );
}
/**
 * Main scraping function for a single city on a specific date.
 * @param {import('playwright-core').Browser} browser - The Playwright browser instance.
 * @param {string} checkinDate - The check-in date in YYYY-MM-DD format.
 * @param {string} checkoutDate - The check-out date in YYYY-MM-DD format.
 * @param {string} cityName - The name of the city to scrape (e.g., "London").
 * @param {string} citySlug - A URL-friendly slug for the city (e.g., "london").
 */
async function scrapeCity(
  browser,
  checkinDate,
  checkoutDate,
  cityName,
  citySlug,
) {
  let context = null;
  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    // Block images/media to save RAM
    await page.route(
      "**/*.{png,jpg,jpeg,gif,svg,webp,ttf,woff,woff2,mp4}",
      (route) => route.abort(),
    );

    const urlCityName = cityName.replace(" ", "+");
    const targetUrl = `https://www.booking.com/searchresults.html?ss=${urlCityName}&checkin=${checkinDate}&checkout=${checkoutDate}&group_adults=2&lang=en-us`;

    await page.goto(targetUrl, { waitUntil: "load", timeout: 90000 });

    // --- RESILIENCE: THE CSS JANITOR V2 ---
    // Aggressively hide overlays using specific IDs, ARIA roles, and common popup characteristics
    await page.addStyleTag({
      content: `
      /* The specific hashed class we know about (legacy support) */
      div.bbe73dce14, 
      
      /* Specific OneTrust Cookie Banner IDs */
      #onetrust-consent-sdk, 
      #onetrust-banner-sdk,
      .ot-sdk-container, 
      
      /* Generic Modal/Dialog attributes (catches dynamically named pop-ups) */
      div[role="dialog"],
      div[role="alertdialog"],
      div[aria-modal="true"],
      
      /* Sign-in Prompts (Catching variations of the aria-label) */
      button[aria-label*="Dismiss sign-in"],
      button[aria-label*="sign in information"],
      
      /* Extreme z-index elements that cover the whole screen */
      div[style*="z-index: 999"],
      div[style*="z-index: 1000"],
      div[style*="z-index: 9999"] { 
        display: none !important; 
        visibility: hidden !important; 
        pointer-events: none !important;
        opacity: 0 !important;
      }
      
      /* Prevent Booking from locking the page scroll behind an invisible overlay */
      body {
        overflow: auto !important;
        pointer-events: auto !important;
      }
    `,
    });
    // console.log("🛠 Pop-up Janitor: Overlays neutralized."); // Commented out to reduce log noise    // --- RESILIENCE: FLEXIBLE HEADER V2 ---

    // 1. Fail fast if we hit an Anti-Bot/CAPTCHA page.
    const pageTitle = await page.title();
    if (
      pageTitle.toLowerCase().includes("moment") ||
      pageTitle.toLowerCase().includes("robot") ||
      pageTitle.toLowerCase().includes("security")
    ) {
      throw new Error("🚨 Anti-Bot CAPTCHA intercepted! Failing fast.");
    }

    // 2. Wait for ANY primary header to render.
    await page
      .locator("h1")
      .first()
      .waitFor({ state: "attached", timeout: 30000 });

    // Grab all h1 texts on the page
    const allH1Texts = await page.locator("h1").allTextContents();

    // 3. Find the h1 that actually contains a number (bypasses A/B testing on the word "found")
    let headerText = allH1Texts.find((text) => /\d/.test(text));

    if (!headerText) {
      throw new Error(
        `Could not find a property count in any H1. Available H1s: [${allH1Texts.join(" | ")}]`,
      );
    }

    console.log(`🔎 Found Header: "${headerText.trim()}"`);

    const numberMatch = headerText.match(/\d{1,3}(,\d{3})*/);
    if (numberMatch && numberMatch[0]) {
      const totalResults = parseInt(numberMatch[0].replace(/,/g, ""), 10);

      const propertyTypes = await scrapeFacetGroup(page, "Property type");
      const starRatings = await scrapeFacetGroup(page, "Property rating");
      const neighbourhoods = await scrapeFacetGroup(page, "Neighborhood");
      const rawPriceHistogram = await scrapePriceHistogram(page);
      const priceHistogram = normalizeHistogram(rawPriceHistogram, checkinDate);
      const { minPriceAnchor, maxPriceAnchor } = await scrapePriceAnchors(page);

      if (!totalResults || Object.keys(propertyTypes).length === 0) {
        throw new Error(
          `Validation Failed: Incomplete facet data for ${checkinDate}.`,
        );
      }

      if (minPriceAnchor < 0 || maxPriceAnchor <= 0 || maxPriceAnchor > 5000) {
        throw new Error(
          `Validation Failed: Invalid price anchors for ${checkinDate}.`,
        );
      }

      const insertQuery = `
        INSERT INTO market_availability_snapshots(
          provider, city_slug, checkin_date, total_results, 
          facet_property_type, facet_star_rating, facet_neighbourhood, 
          facet_price_histogram, min_price_anchor, max_price_anchor, scraped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) 
        ON CONFLICT (provider, city_slug, checkin_date, (CAST(scraped_at AT TIME ZONE 'UTC' AS DATE))) 
        DO UPDATE SET 
          total_results = EXCLUDED.total_results, 
          facet_property_type = EXCLUDED.facet_property_type, 
          facet_star_rating = EXCLUDED.facet_star_rating, 
          facet_neighbourhood = EXCLUDED.facet_neighbourhood, 
          facet_price_histogram = EXCLUDED.facet_price_histogram,
          min_price_anchor = EXCLUDED.min_price_anchor,
          max_price_anchor = EXCLUDED.max_price_anchor, 
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
        minPriceAnchor,
        maxPriceAnchor,
      ];

      const result = await pgPool.query(insertQuery, values);
      console.log(
        `✅ Saved snapshot for ${checkinDate} (ID: ${result.rows[0].id})`,
      );
    } else {
      throw new Error("Could not find property count in header.");
    }
  } finally {
    if (context) await context.close();
  }
}
/**
 * Helper function to format a Date object into YYYY-MM-DD string.
 * @param {Date} date - The date to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to create a delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A helper function to execute a given function with a retry mechanism.
 * @param {Function} fn The async function to execute.
 * @param {number} attempts The maximum number of attempts.
 * @param {number} delayMs The delay between attempts in milliseconds.
 */
async function withRetries(fn, attempts = 3, delayMs = 5000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      // Attempt to execute the function
      return await fn();
    } catch (error) {
      // If this was the last attempt, re-throw the error to the caller
      if (i === attempts) {
        throw error;
      }
      // Extract just the first line of the Playwright error to prevent massive log spam
      const shortError = error.message.split("\n")[0];

      // Log a warning and wait for the delay before the next attempt
      console.warn(
        `🟠 Attempt ${i}/${attempts} failed. Retrying in ${delayMs / 1000}s... Error: ${shortError}`,
      );
      await delay(delayMs);
    }
  }
}

/**
 * Sends a summary email at the end of the scraper run.
 * @param {object} stats - An object containing the scrape statistics.
 * @param {Date} startTime - The time the script started.
 */
async function sendSummaryEmail(stats, startTime) {
  // Check if the SendGrid API key is configured. If not, log a warning and exit.
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("🟠 SENDGRID_API_KEY not found. Skipping summary email.");
    return;
  }

  // Calculate the total duration of the script run.
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2); // Duration in minutes

  // Define the email content.
  const msg = {
    to: "karol@rockenue.com", // **<-- IMPORTANT: CHANGE THIS to your email address**
    from: "codex@em4689.market-pulse.io", // Use a verified sender from your SendGrid account
    subject: `✅ Market Codex: ${stats.city} - ${stats.successes}/${stats.totalDays}`,
    html: `
      <h1>Market Codex Scraper Run Summary: ${stats.city}</h1>
      <p>The daily scraper run has finished.</p>
      <ul>
        <li><strong>Total Days Scraped:</strong> ${stats.successes} / ${stats.totalDays}</li>
        <li><strong>Permanent Failures:</strong> ${stats.failures}</li>
        <li><strong>Total Retries:</strong> ${stats.retries}</li>
        <li><strong>Total Duration:</strong> ${duration} minutes</li>
      </ul>
    `,
  };

  try {
    // Send the email.
    await sgMail.send(msg);
    console.log("✅ Summary email sent successfully.");
  } catch (error) {
    console.error("❌ Failed to send summary email:", error);
  }
}

async function main() {
  // 1. Grab the city slug from the command line (e.g., "node index.js london")
  // process.argv[0] is node, [1] is script path, [2] is the argument
  const targetCitySlug = process.argv[2];

  // 2. Define City Configurations
  const CITY_CONFIGS = {
    london: {
      name: "London",
      slug: "london",
      currency: "GBP", // Just for reference, script scrapes raw numbers
    },
    "las-vegas": {
      name: "Las Vegas",
      slug: "las-vegas",
      currency: "USD",
    },

    // --- ADD THIS NEW BLOCK ---
    mykonos: {
      // "Mykonos, Greece" ensures the search is specific, matching your URL
      name: "Mykonos, Greece",
      slug: "mykonos",
      currency: "EUR",
    },
    archanes: {
      name: "Archanes, Crete",
      slug: "archanes",
      currency: "EUR",
    },
  };

  // 3. Validate the input
  if (!targetCitySlug || !CITY_CONFIGS[targetCitySlug]) {
    console.error(
      `❌ Error: No valid city specified. Usage: "node index.js <city_slug>"`,
    );
    console.error(`Available cities: ${Object.keys(CITY_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const selectedCity = CITY_CONFIGS[targetCitySlug];

  // --- Configuration ---
  const CONFIG = {
    city: selectedCity, // Use the selected city config
    daysToScrape: 120,
    runHeadless: true,
    msDelayBetweenScrapes: 4000,
    retries: 3,
    msDelayBetweenRetries: 10000,
  };

  // --- New Statistics Tracking ---
  const startTime = new Date();
  const stats = {
    totalDays: CONFIG.daysToScrape,
    successes: 0,
    failures: 0,
    retries: 0,
    city: selectedCity.name, // Add city to stats for the email
  };

  // This array will hold any dates that fail all 3 initial attempts.
  const failedDates = [];

  try {
    console.log(`🚀 Starting scraper run for ${CONFIG.city.name}...`);
    const startDate = new Date();

    for (let i = 0; i < CONFIG.daysToScrape; i++) {
      const checkinDate = new Date(startDate);
      checkinDate.setDate(startDate.getDate() + i);
      const checkinStr = formatDate(checkinDate);
      const checkoutStr = formatDate(
        new Date(checkinDate.getTime() + 86400000),
      );

      let attemptCount = 0;

      try {
        await withRetries(
          async () => {
            attemptCount++;
            if (attemptCount > 1) {
              stats.retries++;
            }

            let browser = null;
            try {
              const launchOptions = {
                headless: CONFIG.runHeadless,
                args: [
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-dev-shm-usage",
                  "--disable-gpu", // Saves memory
                  "--disable-extensions", // Saves memory
                  "--single-process", // Sometimes helps on Linux/Render
                ],
                proxy: {
                  server: `http://${process.env.PROXY_ENDPOINT}`,
                  username: process.env.PROXY_USERNAME,
                  password: process.env.PROXY_PASSWORD,
                },
              };
              browser = await playwright.chromium.launch(launchOptions);

              // PASSING THE DYNAMIC CITY DATA HERE
              await scrapeCity(
                browser,
                checkinStr,
                checkoutStr,
                CONFIG.city.name,
                CONFIG.city.slug,
              );
            } finally {
              if (browser) {
                await browser.close();
                // CRITICAL: Give Render 5 seconds to kill the zombie process and free RAM
                await delay(5000);
              }
            }
          },
          CONFIG.retries,
          CONFIG.msDelayBetweenRetries,
        );
        stats.successes++;
      } catch (error) {
        stats.failures++;
        console.error(
          `🔴 FAILED PERMANENTLY for ${checkinStr} (${CONFIG.city.name}) after ${CONFIG.retries} attempts:`,
          error.message,
        );
        failedDates.push({ checkinStr, checkoutStr });
      }

      if (i < CONFIG.daysToScrape - 1) {
        await delay(CONFIG.msDelayBetweenScrapes);
      }
    }

    // --- Cool-down Retry Pass ---
    if (failedDates.length > 0) {
      console.log(
        `--- Cooling down for 10 minutes before retrying ${failedDates.length} failed dates for ${CONFIG.city.name}... ---`,
      );
      await delay(600000);
      console.log("--- Starting cool-down retry pass... ---");

      for (const [index, date] of failedDates.entries()) {
        const { checkinStr, checkoutStr } = date;
        console.log(
          `--- Retrying ${checkinStr} (${index + 1} of ${
            failedDates.length
          }) ---`,
        );

        let attemptCount = 0;

        try {
          await withRetries(
            async () => {
              attemptCount++;
              if (attemptCount > 1) stats.retries++;

              let browser = null;
              try {
                const launchOptions = {
                  headless: CONFIG.runHeadless,
                  args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-extensions",
                    "--single-process",
                  ],
                  proxy: {
                    server: `http://${process.env.PROXY_ENDPOINT}`,
                    username: process.env.PROXY_USERNAME,
                    password: process.env.PROXY_PASSWORD,
                  },
                };
                browser = await playwright.chromium.launch(launchOptions);
                await scrapeCity(
                  browser,
                  checkinStr,
                  checkoutStr,
                  CONFIG.city.name,
                  CONFIG.city.slug,
                );
              } finally {
                if (browser) await browser.close();
              }
            },
            CONFIG.retries,
            CONFIG.msDelayBetweenRetries,
          );

          stats.successes++;
          stats.failures--;
        } catch (error) {
          console.error(
            `🔴 FAILED PERMANENTLY AGAIN for ${checkinStr} after cool-down:`,
            error.message,
          );
        }
        if (index < failedDates.length - 1) {
          await delay(CONFIG.msDelayBetweenScrapes);
        }
      }
    }
  } catch (criticalError) {
    console.error(
      "A fatal error occurred in the main execution block:",
      criticalError,
    );
  } finally {
    console.log(
      `Scraper run finished for ${CONFIG.city.name}. Sending email summary...`,
    );
    try {
      // Pass the stats (which now include city name) to email
      await sendSummaryEmail(stats, startTime);
    } catch (emailError) {
      console.error("🔴 Failed to send summary email:", emailError.message);
    }
    try {
      await pgPool.end();
      console.log("Database pool closed.");
    } catch (dbError) {
      console.error("🔴 Error closing database pool:", dbError.message);
    }
  }
}
// Execute the main function and handle any top-level errors.
main().catch((error) => {
  console.error("A fatal error occurred in the main execution block:", error);
  process.exit(1);
});
