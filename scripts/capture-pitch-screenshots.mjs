// Capture candidate screenshots for the Pitch Deck.
//
// First run:  node scripts/capture-pitch-screenshots.mjs --headed
//   → opens a visible Chrome window. Log in manually, then walk away —
//     the script auto-detects that the dashboard loaded and continues.
//   → auth state is saved to scripts/.pitch-auth.json for future runs.
//
// Subsequent runs: node scripts/capture-pitch-screenshots.mjs
//   → runs headless using saved auth state.
//
// Output: web/public/screenshots/candidate-*.png  (12+ candidate shots)
// Pick favourites from the Pitch Deck → "Screenshot Gallery" slide.

import { chromium } from "playwright-core";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "web/public/screenshots");
const STATE_FILE = path.join(__dirname, ".pitch-auth.json");
const APP_URL = process.env.MP_URL || "https://www.market-pulse.io";

const HEADED = process.argv.includes("--headed");

// Each entry: { name, click, section? }
//   section : optional sidebar group to expand first
//   click   : visible nav-item label to click
const SHOTS = [
  // Top-level
  { name: "candidate-dashboard", click: "Dashboard" },
  { name: "candidate-demand-radar", click: "Demand Radar" },
  { name: "candidate-compset-intel", click: "Compset Intel" },
  { name: "candidate-reports", click: "Reports" },
  // Sentinel section
  { name: "candidate-risk-overview", section: "Sentinel", click: "Risk Overview" },
  { name: "candidate-control-panel", section: "Sentinel", click: "Control Panel" },
  { name: "candidate-rate-manager", section: "Sentinel", click: "Rate Manager" },
  { name: "candidate-market-profile", section: "Sentinel", click: "Market Profile" },
  { name: "candidate-sentinel-health", section: "Sentinel", click: "Health" },
  // Rockenue
  { name: "candidate-channel-pricing", section: "Rockenue", click: "Channel Pricing" },
  // Studio mockups (often the cleanest visual)
  { name: "candidate-mp-demand-radar", section: "Studio", click: "MP Demand Radar" },
  { name: "candidate-mp-reports", section: "Studio", click: "MP Reports" },
  { name: "candidate-mason-dashboard", section: "Studio", click: "Mason Dashboard" },
];

async function ensureSectionOpen(page, sectionName) {
  // Section toggles render their label in the sidebar; clicking expands children.
  // Locator: a div in the sidebar containing the exact label text.
  const sectionLocator = page.locator("div", { hasText: new RegExp(`^${sectionName}$`) }).first();
  // Try clicking — if already open, second click would close, so probe first by checking
  // whether one of its known children is already visible.
  const probeChildren = {
    Sentinel: "Risk Overview",
    Rockenue: "CRM",
    Studio: "MP Reports",
  };
  const probe = probeChildren[sectionName];
  if (probe) {
    const childVisible = await page.locator(`text=${probe}`).first().isVisible().catch(() => false);
    if (childVisible) return; // already open
  }
  await sectionLocator.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function detectLogin(page) {
  const body = await page.innerText("body").catch(() => "");
  return /sign in|continue with email|magic link|enter your email/i.test(body.slice(0, 1500));
}

// Switch the active property via the AppSidebar property dropdown.
// Opens dropdown, types the search term, presses Enter (selects single match).
async function selectProperty(page, propertyName) {
  console.log(`→ switching property to "${propertyName}"`);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  // 1) Click the first lucide-chevron-down inside the sidebar — its parent
  //    div is the property-dropdown trigger and the click bubbles up.
  const chevron = page.locator("svg.lucide-chevron-down").first();
  await chevron.click({ timeout: 5000 });
  await page.waitForTimeout(500);

  // 2) Type into the search input — placeholder is exact.
  const search = page.locator('input[placeholder="Type to search..."]').first();
  await search.fill(propertyName, { timeout: 5000 });
  await page.waitForTimeout(400);

  // 3) Press Enter — the sidebar's keyDown handler selects when single match.
  await search.press("Enter");
  await page.waitForTimeout(3000);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  console.log(`   property switched to "${propertyName}"`);
}

async function waitForLoggedIn(page) {
  // We're logged in when we can see the sidebar's "Dashboard" entry.
  // 5-minute window so the user has plenty of time to log in.
  await page.waitForFunction(
    () => /Dashboard/i.test(document.body.innerText) && !/sign in|continue with email/i.test(document.body.innerText.slice(0, 1500)),
    null,
    { timeout: 300_000, polling: 1000 }
  );
}

(async () => {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: !HEADED,
    // Prefer system Chrome if available, else fall back to Playwright's bundled Chromium.
    channel: process.env.MP_USE_BUNDLED ? undefined : "chrome",
    executablePath: process.env.MP_USE_BUNDLED
      ? "/Users/karolmarcu/Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium"
      : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1050 },
    deviceScaleFactor: 2,
    storageState: existsSync(STATE_FILE) ? STATE_FILE : undefined,
  });
  const page = await context.newPage();

  console.log(`→ opening ${APP_URL}`);
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  if (await detectLogin(page)) {
    if (!HEADED) {
      console.error("\nLogin required but running headless. Re-run with --headed and log in once.\n");
      await browser.close();
      process.exit(2);
    }
    console.log("\n*** Please log in inside the Chromium window. The script will continue automatically once the dashboard loads. ***\n");
    await waitForLoggedIn(page);
    await context.storageState({ path: STATE_FILE });
    console.log("→ auth state saved to scripts/.pitch-auth.json");
  } else {
    console.log("→ already authenticated");
  }

  // Wait a beat so dashboard widgets render
  await page.waitForTimeout(2000);

  // Switch to a London property (override via MP_PROPERTY env var if needed)
  const propertyName = process.env.MP_PROPERTY || "Portico";
  try {
    await selectProperty(page, propertyName);
  } catch (e) {
    console.warn(`   property switch failed: ${e.message.split("\n")[0]} — continuing with whatever is selected`);
  }

  for (const shot of SHOTS) {
    try {
      console.log(`→ ${shot.name}`);
      if (shot.section) {
        await ensureSectionOpen(page, shot.section);
      }
      const navItem = page.locator(`text="${shot.click}"`).first();
      await navItem.click({ timeout: 6000 });
      // generous wait for charts/networks
      await page.waitForTimeout(2800);
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      const file = path.join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`   saved ${path.relative(ROOT, file)}`);
    } catch (e) {
      console.warn(`   skipped ${shot.name}: ${e.message.split("\n")[0]}`);
    }
  }

  await browser.close();
  console.log("\nDone. Drop a peek at web/public/screenshots/ — and check the deck's Gallery slide.\n");
})();
