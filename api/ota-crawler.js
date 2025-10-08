// Import the chromium browser type from the Playwright library.
const { chromium } = require("playwright");
// Import the PostgreSQL connection pool from our shared db utility file.
const pgPool = require("./utils/db.js");

// The main function that will contain our scraping logic.
async function scrapeBookingLondon() {
  const browser = await chromium.launch();
  console.log("Browser launched...");

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const checkinDate = formatDate(today);
    // Note: The checkout date is not needed for the DB insert, only for the URL.
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkoutDate = formatDate(tomorrow);

    const targetUrl = `https://www.booking.com/searchresults.html?ss=London&checkin=${checkinDate}&checkout=${checkoutDate}&group_adults=2&lang=en-us`;

    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    console.log("Page loaded and network is idle.");

    try {
      const cookieButtonLocator = page.locator(
        "button#onetrust-accept-btn-handler"
      );
      await cookieButtonLocator.click({ timeout: 5000 });
      console.log("Cookie consent button clicked.");
      await page.waitForLoadState("networkidle");
      console.log("Network is idle after click.");
    } catch (error) {
      console.log("Cookie consent button not found, continuing...");
    }

    const resultsHeaderLocator = page.locator('h1[aria-live="assertive"]');
    const headerText = await resultsHeaderLocator.textContent();
    const numberMatch = headerText.match(/\d{1,3}(,\d{3})*/);

    if (numberMatch && numberMatch[0]) {
      const totalResults = parseInt(numberMatch[0].replace(/,/g, ""), 10);
      console.log(`Total properties found: ${totalResults}`);

      // --- NEW: DATABASE INSERT LOGIC ---

      // Define the SQL query to insert our data. We use parameterized queries ($1, $2, etc.)
      // to prevent SQL injection vulnerabilities.
      // 'RETURNING id' will give us back the UUID of the row we just created.
      const insertQuery = `
        INSERT INTO market_availability_snapshots(provider, city_slug, checkin_date, total_results)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;

      // The values to be inserted, corresponding to the parameters in the query.
      const values = ["booking", "london", checkinDate, totalResults];

      // Execute the query using the connection pool.
      const result = await pgPool.query(insertQuery, values);

      // Log a success message including the new row's ID.
      console.log(
        `✅ Successfully saved snapshot to DB with ID: ${result.rows[0].id}`
      );
    } else {
      console.log("Could not find the total number of properties.");
    }
  } catch (error) {
    console.error("An error occurred during scraping:", error);
  } finally {
    await browser.close();
    console.log("Browser closed.");
    // It's good practice to end the pool when the script is done.
    await pgPool.end();
    console.log("Database pool closed.");
  }
}

scrapeBookingLondon();
