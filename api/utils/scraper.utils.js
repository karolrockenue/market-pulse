const chromium = require('@sparticuz/chromium');
const playwright = require('playwright-core');
const { format, addDays } = require('date-fns');

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
      // Log a warning and wait for the delay before the next attempt
      console.warn(
        `🟠 Shadowfax Attempt ${i} of ${attempts} failed. Retrying in ${
          delayMs / 1000
        }s...`,
        `Error: ${error.message}`
      );
      await delay(delayMs);
    }
  }
}

/**
 * Builds a valid Booking.com URL with check-in, check-out, and guest params.
 * @param {string} hotelUrl - The base URL of the hotel's B.com page.
 * @param {string | Date} checkinDate - The selected check-in date.
 * @returns {string} The full URL to be scraped.
 */
function buildBookingUrl(hotelUrl, checkinDate) {
  const checkin = format(new Date(checkinDate), 'yyyy-MM-dd');
  // Per plan, assume 2 adults, 1 night
  const checkout = format(addDays(new Date(checkinDate), 1), 'yyyy-MM-dd');

  const url = new URL(hotelUrl);
  url.searchParams.set('checkin', checkin);
  url.searchParams.set('checkout', checkout);
  url.searchParams.set('group_adults', '2');
  url.searchParams.set('group_children', '0');
  url.searchParams.set('no_rooms', '1');
  return url.toString();
}
/**
 * A single attempt to launch a browser and scrape the price.
 * This function is designed to be wrapped by `withRetries`.
 */
async function attemptScrape(hotelUrl, checkinDate) {
  let browser = null;
  console.log('Launching headless browser for Shadowfax attempt...');

  try {
    // Step 2: Integrate Proxy & Add Conditional Launch
    
    // Base launch options, including the proxy
    let launchOptions = {
      headless: true,
      proxy: {
        server: `http://${process.env.PROXY_ENDPOINT}`,
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD,
      },
    };

    if (process.env.NODE_ENV === 'production') {
      // --- PRODUCTION (Vercel) ---
      console.log('Shadowfax: Using @sparticuz/chromium for PRODUCTION');
      launchOptions = {
        ...launchOptions,
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      };
    } else {
      // --- LOCAL DEVELOPMENT ---
      console.log('Shadowfax: Using local playwright-core for DEVELOPMENT');
    }

    browser = await playwright.chromium.launch(launchOptions);

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/5.0 (KHTML, like Gecko) Chrome/99.0.4844.84 Safari/5.0 (KHTML, like Gecko)',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    const urlToScrape = buildBookingUrl(hotelUrl, checkinDate);

    console.log(`Shadowfax navigating to: ${urlToScrape}`);
    await page.goto(urlToScrape, { waitUntil: 'load', timeout: 90000 });

    // --- Step 1: Handle Cookie Consent Banner ---
    try {
      await page
        .locator('button#onetrust-accept-btn-handler')
        .click({ timeout: 5000 });
      await page.waitForLoadState('networkidle');
      console.log('Shadowfax: Cookie consent button clicked.');
    } catch (error) {
      console.log('Shadowfax: Cookie consent button not found, continuing...');
    }

    // --- Step 2: Handle Intercepting Genius/Sign-in Pop-up ---
    try {
      const dismissButton = page.locator(
        'button[aria-label="Dismiss sign-in info."]'
      );
      await dismissButton.waitFor({ state: 'visible', timeout: 7000 });
      await dismissButton.click();
      await page.waitForTimeout(1000);
      console.log('Shadowfax: Intercepting pop-up dismissed.');
    } catch (error) {
      console.log('Shadowfax: No intercepting pop-up found, continuing...');
    }

    // --- Step 3: NEW Minimum Price Finding Logic ---
    let minPrice = Infinity;
    let cheapestRoomName = 'Unknown Room Type';
    let cheapestPriceString = ''; // This will store the full string, e.g., "£57"

    try {
      // 1. Define the selector for all room blocks.
      const roomBlockSelector = page.locator(
        '[data-testid="room-card"], [data-testid="room-block"], table#hprt-table tbody tr'
      );

      // 2. Wait for at least one room block to be visible.
      await roomBlockSelector.first().waitFor({ state: 'visible', timeout: 15000 });

      // 3. Get all room blocks on the page.
      const allRoomBlocks = await roomBlockSelector.all();

      if (allRoomBlocks.length === 0) {
        throw new Error('Page loaded, but no room blocks were found.');
      }

      console.log(`Shadowfax: Found ${allRoomBlocks.length} room blocks to check.`);

   // 4. Loop through every block to find the minimum *non-single* price.
      for (const block of allRoomBlocks) {
        try {
          // 4a. Find room name FIRST to filter out "single" rooms
          let roomName = 'Unknown';
          try {
            const roomNameElement = block.locator(
              '.hprt-roomtype-name', // Standard table room name
              '.room_name',
              'a.room_link',
              '[data-testid="room-name"], [data-testid="title"], h3, h4'
            ).first();
            roomName = (await roomNameElement.innerText()).trim();
          } catch (nameError) {
            console.warn('Shadowfax: Could not find room name for a block. Skipping.');
            continue; // Skip this block if we can't get a name
          }

          // 4b. CHECK if room name is "single"
          if (roomName.toLowerCase().includes('single')) {
            console.log(`Shadowfax: Skipping room: ${roomName} (is single)`);
            continue; // Skip this "single" room
          }

          // 4c. Find the price element *within this valid block*.
          const priceElement = block.locator(
            '[data-testid="price-and-discounted-price"], [data-testid="price"], .bui-price-display__value'
          ).first();
          
          const priceText = (await priceElement.innerText()).trim();
          // Extract the numeric value for comparison
          const currentPriceNum = parseFloat(priceText.replace(/[^\d.]/g, '').trim());

          if (isNaN(currentPriceNum)) {
            console.warn('Shadowfax: Found valid room but price was invalid. Skipping.');
            continue; // Skip this block
          }

          // 4d. Compare to find the new minimum.
          if (currentPriceNum < minPrice) {
            minPrice = currentPriceNum;
            cheapestPriceString = priceText; // Store the *full* string
            cheapestRoomName = roomName; // Store the name we found in step 4a
          }
        } catch (innerError) {
          // This catches an error inside one block, allowing the loop to continue
          console.warn(`Shadowfax: Error processing a single room block, skipping. Error: ${innerError.message}`);
        }
      }
      // 5. After the loop, check if we found any valid price.
      if (minPrice === Infinity) {
        throw new Error('Found room blocks, but could not extract a valid price from any of them.');
      }

    } catch (error) {
      // This block catches errors if the *room block* selector fails (step 1 or 2)
      console.warn(`Shadowfax: Could not find any room blocks. Error: ${error.message}`);
      
      // Check for "Sold Out" message as a fallback
      const unavailableText = page.locator('text=/No rooms available/i');
      if (await unavailableText.count() > 0) {
        throw new Error('This hotel is unavailable for this date.');
      }
      throw new Error('Could not find a valid room block or price on the page.');
    }

    // 6. Return the true minimum price and room name.
    console.log(`Shadowfax found *true minimum*: ${cheapestPriceString} for room: ${cheapestRoomName}`);
    return { price: cheapestPriceString, roomName: cheapestRoomName };
  } finally {
    if (browser) {
      await browser.close();
      console.log('Shadowfax browser closed for this attempt.');
    }
  }
}

/**
 * Scrapes a hotel's Booking.com page for the lowest price.
 * This is the new public-facing wrapper that implements the retry logic.
 * @param {string} hotelUrl - The base URL for the hotel.
 * @param {string | Date} checkinDate - The target check-in date.
 * @returns {Promise<string>} - The lowest price found as a string.
 */
async function getHotelPrice(hotelUrl, checkinDate) {
  try {
    // Use withRetries to run the scrape attempt
    const price = await withRetries(
      () => attemptScrape(hotelUrl, checkinDate),
      3, // 3 attempts total
      5000 // 5 second delay between retries
    );
    return price;

  } catch (error) {
    // --- Step 4: Add Error Standardization ---
    console.error(`Error in Shadowfax scraper (getHotelPrice) after all retries:`, error);
    
    // Check for specific, user-friendly messages
    if (error.message.includes('unavailable for this date')) {
      throw new Error('This hotel is unavailable for the selected date.');
    }
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      throw new Error('The request timed out. The page may be slow or the scraper was blocked.');
    }
    
    // Generic fallback error
    throw new Error(`Failed to scrape price: ${error.message}`);
  }
}

module.exports = {
  getHotelPrice,
};