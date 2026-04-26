// /api/utils/pdf.utils.js
// A new utility for generating PDFs from HTML templates using Playwright.

const playwright = require("playwright-core");
const chromium = require("@sparticuz/chromium");
const fs = require("fs").promises;
const path = require("path");

/**
 * Generates a PDF from a specified HTML template file and injects data.
 *
 * @param {string} templateName - The name of the template file in /api/utils/report-templates/
 * @param {object} data - The JSON data object to inject into the template.
 * @param {object|null} [pdfOptionsOverride=null] - Optional Playwright page.pdf() option overrides.
 *   When omitted, the Shreeji-compatible defaults are used (format A4, scale 0.7, 20px top/bottom
 *   margins, 8px side margins, printBackground). Pass a partial object to override specific options
 *   (e.g. { scale: 1.0, displayHeaderFooter: true, footerTemplate, margin }).
 * @returns {Promise<Buffer>} A promise that resolves with the PDF buffer.
 */
async function generatePdfFromHtml(templateName, data, pdfOptionsOverride = null) {
  let browser = null;
  
  // Construct the full path to the HTML template
  const templatePath = path.resolve(
    __dirname,
    "report-templates",
    templateName
  );

  try {
    // Read the HTML file content
    const htmlContent = await fs.readFile(templatePath, "utf-8");

    // --- [FIX 1] Environment-Aware Browser Launch ---
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT_NAME;
    const isVercelProd = process.env.VERCEL_ENV === "production" && !isRailway;

    if (isVercelProd) {
      // FOR VERCEL: Use the lightweight @sparticuz/chromium package
      console.log("[pdf.utils.js] Launching Vercel (production) browser...");
      browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else if (isRailway) {
      // FOR RAILWAY: Use system-installed Chromium
      console.log("[pdf.utils.js] Launching Railway browser...");
      browser = await playwright.chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } else {
      // FOR LOCAL DEV: Use the standard local Playwright installation.
      console.log("[pdf.utils.js] Launching local (development) browser...");
      browser = await playwright.chromium.launch({
        headless: true,
      });
    }
    // --- [END FIX 1] ---
    
    const context = await browser.newContext();
    const page = await context.newPage();

    // Log any errors from inside the headless browser
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`[Headless Browser ERROR] ${msg.text()}`);
      }
    });

    // Set the page content from our HTML file
    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded", // Wait for HTML to be parsed
    });
    console.log("[pdf.utils.js] Page 'domcontentloaded' complete.");

    // --- [FIX 2] Reliable Wait Strategy ---
    // We wait for the 'script-ready' class, which the template
    // will add to the body *after* it defines window.renderReport.
    await page.waitForSelector('body.script-ready', { timeout: 15000 });
    console.log("[pdf.utils.js] 'body.script-ready' detected. Injecting data...");

    // Now it is safe to call the function
    await page.evaluate((data) => {
      window.renderReport(data);
    }, data);

    // Wait for our script to signal it's done *rendering*. 30s ceiling so
    // a cold-start fonts/network stall on Railway has room to recover —
    // the template itself races fonts.ready against a 1.5s timeout, so
    // anything north of that is a real bug worth investigating in logs.
    await page.waitForSelector("body.ready", { timeout: 30000 });
    console.log("[pdf.utils.js] 'body.ready' detected. Generating PDF...");

    // Generate the PDF
    const defaultPdfOptions = {
      format: "A4",
      scale: 0.7, // Shreeji template is designed to fit at 70% scale.
      printBackground: true,
      margin: {
        top: "20px",
        bottom: "20px",
        left: "8px",
        right: "8px",
      },
    };
    const pdfOptions = pdfOptionsOverride
      ? { ...defaultPdfOptions, ...pdfOptionsOverride }
      : defaultPdfOptions;
    const pdfBuffer = await page.pdf(pdfOptions);

    console.log("[pdf.utils.js] PDF generated successfully.");
    return pdfBuffer;
    
  } catch (error) {
    console.error("[pdf.utils.js] Error generating PDF:", {
      template: templateName,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    throw new Error("Could not generate PDF.");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generatePdfFromHtml,
};