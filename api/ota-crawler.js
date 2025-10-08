// Import the chromium browser type from the Playwright library.
// We specify chromium directly to ensure we use a consistent browser engine.
const { chromium } = require("playwright");

// The main function that will contain our scraping logic.
// It's an async function because browser operations are asynchronous.
async function scrapeBookingLondon() {
  // Launch a new browser instance. 'headless: true' is the default,
  // meaning it runs without a visible UI. Set to false for debugging.
  const browser = await chromium.launch();

  // Log to the console that the browser has been launched.
  console.log("Browser launched...");

  try {
    // Create a new page (like a new tab) within the browser.
    const page = await browser.newPage();

    // Define the target URL for a hardcoded search: London, for 2 adults, 30 days from now.
    // We use a static future date for this proof of concept.
    const targetUrl =
      "https://www.booking.com/searchresults.html?ss=London&checkin=2025-11-07&checkout=2025-11-08&group_adults=2&lang=en-us";

    // Instruct the page to navigate to the URL.
    // 'waitUntil: "domcontentloaded"' waits until the initial HTML is loaded, which is often faster
    // than waiting for all images and resources ('load').
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    // Log a success message once the page has loaded.
    console.log("Page loaded successfully.");

    // --- DATA EXTRACTION LOGIC WILL GO HERE IN A FUTURE STEP ---
  } catch (error) {
    // If any error occurs during the process, log it to the console.
    console.error("An error occurred during scraping:", error);
  } finally {
    // This block will always execute, whether the try block succeeded or failed.
    // It's crucial for ensuring the browser is always closed to prevent lingering processes.
    await browser.close();
    console.log("Browser closed.");
  }
}

// Execute the main scraping function.
scrapeBookingLondon();
