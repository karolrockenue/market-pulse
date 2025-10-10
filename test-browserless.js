// Load environment variables from the .env file
require("dotenv").config();
// Import the playwright library
const playwright = require("playwright");

async function runTest() {
  let browser;
  try {
    // Get the API key from your environment variables
    const apiKey = process.env.BROWSERLESS_API_KEY;
    if (!apiKey) {
      throw new Error("BROWSERLESS_API_KEY is not set in your .env file.");
    }

    console.log("Connecting to Browserless.io...");

    // This is the new connection method. Instead of launching a local browser,
    // we connect to a remote one managed by Browserless.io via a WebSocket.
    // We pass our API key in the connection string.
    // Read your existing residential proxy credentials from the .env file.
    const proxyEndpoint = process.env.PROXY_ENDPOINT;
    const proxyUsername = process.env.PROXY_USERNAME;
    const proxyPassword = process.env.PROXY_PASSWORD;

    if (!proxyEndpoint || !proxyUsername || !proxyPassword) {
      throw new Error("Proxy credentials are not set in your .env file.");
    }

    browser = await playwright.chromium.connect({
      // This is the new, correct WebSocket endpoint for Browserless.io services.
      wsEndpoint: `wss://production-sfo.browserless.io?token=${apiKey}`,
      // We're adding a 30-second timeout to prevent hangs.
      timeout: 30000,
      // This is the crucial change: we tell Playwright to make the connection
      // TO Browserless through your residential proxy service. This bypasses
      // any local network blocks interfering with the WebSocket connection.
      proxy: {
        server: proxyEndpoint,
        username: proxyUsername,
        password: proxyPassword,
      },
    });

    console.log("Successfully connected!");

    // Create a new page in the remote browser
    const page = await browser.newPage();

    console.log("Navigating to example.com...");
    await page.goto("http://example.com");

    // Get the title of the page to confirm it loaded
    const pageTitle = await page.title();
    console.log(`Page title is: "${pageTitle}"`);

    if (pageTitle === "Example Domain") {
      console.log("✅ Test Passed!");
    } else {
      console.log("❌ Test Failed.");
    }
  } catch (error) {
    console.error("An error occurred during the test:", error);
  } finally {
    // Ensure the remote browser connection is closed
    if (browser) {
      console.log("Closing browser connection...");
      await browser.close();
    }
  }
}

// Run the asynchronous test function
runTest();
