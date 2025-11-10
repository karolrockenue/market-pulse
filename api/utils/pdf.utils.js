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
 * @returns {Promise<Buffer>} A promise that resolves with the PDF buffer.
 */
async function generatePdfFromHtml(templateName, data) {
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
    const isProduction = process.env.VERCEL_ENV === "production";

    if (isProduction) {
      // FOR VERCEL: Use the lightweight @sparticuz/chromium package
      console.log("[pdf.utils.js] Launching Vercel (production) browser...");
      browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
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
    await page.waitForSelector('body.script-ready', { timeout: 10000 });
    console.log("[pdf.utils.js] 'body.script-ready' detected. Injecting data...");
    
    // Now it is safe to call the function
    await page.evaluate((data) => {
      window.renderReport(data);
    }, data);

    // Wait for our script to signal it's done *rendering*
    await page.waitForSelector("body.ready", { timeout: 10000 });
    console.log("[pdf.utils.js] 'body.ready' detected. Generating PDF...");

    // Generate the PDF
// Generate the PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      scale: 0.7, // <-- [NEW] Scale the content to 80% to fit
 printBackground: true,
      margin: {
        top: "20px",
        bottom: "20px",
        left: "8px",  // <-- REDUCED
        right: "8px", // <-- REDUCED
      },
    });

    console.log("[pdf.utils.js] PDF generated successfully.");
    return pdfBuffer;
    
  } catch (error) {
    console.error("Error generating PDF:", error);
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