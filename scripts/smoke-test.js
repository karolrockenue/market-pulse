#!/usr/bin/env node
/**
 * Smoke Test Script for Market Pulse
 *
 * Usage:
 *   node scripts/smoke-test.js <base-url> <session-cookie>
 *
 * Example:
 *   node scripts/smoke-test.js https://market-pulse-production-106e.up.railway.app "s%3Aabc123..."
 *
 * The session cookie is the value of `connect.sid` from your browser dev tools.
 * You must be logged in as an admin user for full coverage.
 */

const BASE_URL = process.argv[2];
const SESSION_COOKIE = process.argv[3];

if (!BASE_URL || !SESSION_COOKIE) {
  console.error("Usage: node scripts/smoke-test.js <base-url> <session-cookie>");
  console.error('Example: node scripts/smoke-test.js https://market-pulse-production-106e.up.railway.app "s%3Aabc123..."');
  process.exit(1);
}

const BRIDGE_KEY = process.env.SENTINEL_DGX_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

// Test hotel ID — uses first Rockenue-managed hotel
let TEST_HOTEL_ID = null;
let TEST_MARKET_SLUG = null;

const results = { pass: 0, fail: 0, skip: 0, errors: [] };

async function req(method, path, { auth = "session", body = null, label = null, allowStatus = [200] } = {}) {
  const tag = label || `${method} ${path}`;
  const url = `${BASE_URL}${path}`;
  const headers = { "Content-Type": "application/json" };

  if (auth === "session") {
    headers["Cookie"] = `connect.sid=${SESSION_COOKIE}`;
  } else if (auth === "bridge") {
    headers["x-api-key"] = BRIDGE_KEY;
  } else if (auth === "cron") {
    headers["Authorization"] = `Bearer ${CRON_SECRET}`;
  }

  try {
    const opts = { method, headers, redirect: "manual" };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const ok = allowStatus.includes(res.status);

    if (ok) {
      results.pass++;
      console.log(`  ✅ ${tag} → ${res.status}`);
    } else {
      results.fail++;
      let detail = "";
      try { detail = (await res.text()).substring(0, 200); } catch {}
      results.errors.push({ tag, status: res.status, detail });
      console.log(`  ❌ ${tag} → ${res.status} ${detail.substring(0, 80)}`);
    }
    return { status: res.status, ok };
  } catch (err) {
    results.fail++;
    results.errors.push({ tag, status: "NETWORK", detail: err.message });
    console.log(`  ❌ ${tag} → NETWORK ERROR: ${err.message}`);
    return { status: 0, ok: false };
  }
}

async function discoverTestIds() {
  console.log("\n🔍 Discovering test IDs...");
  const headers = {
    "Content-Type": "application/json",
    "Cookie": `connect.sid=${SESSION_COOKIE}`,
  };

  // Get a hotel ID from sentinel configs
  try {
    const res = await fetch(`${BASE_URL}/api/sentinel/configs`, { headers });
    if (res.ok) {
      const json = await res.json();
      const data = json.data || json;
      if (Array.isArray(data) && data.length > 0) {
        TEST_HOTEL_ID = data[0].hotel_id;
        console.log(`  Found test hotel ID: ${TEST_HOTEL_ID}`);
      }
    }
  } catch {}

  // Get a market slug from hotels
  try {
    const res = await fetch(`${BASE_URL}/api/hotels/mine`, { headers });
    if (res.ok) {
      const json = await res.json();
      const data = json.data || json;
      if (Array.isArray(data) && data.length > 0) {
        TEST_MARKET_SLUG = data[0].city_slug;
        console.log(`  Found test market slug: ${TEST_MARKET_SLUG}`);
      }
    }
  } catch {}

  if (!TEST_HOTEL_ID) console.log("  ⚠️  No hotel ID found — some tests will be skipped");
  if (!TEST_MARKET_SLUG) console.log("  ⚠️  No market slug found — some tests will be skipped");
}

function skip(tag) {
  results.skip++;
  console.log(`  ⏭️  ${tag} → SKIPPED (no test ID)`);
}

async function run() {
  console.log(`\n🏥 Market Pulse Smoke Test`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Time:   ${new Date().toISOString()}\n`);

  // --- PUBLIC ENDPOINTS ---
  console.log("── Public Endpoints ──");
  await req("GET", "/", { auth: "none", label: "SPA index.html" });
  await req("GET", "/api/auth/session-info", { auth: "session", label: "GET /auth/session-info" });

  // --- DISCOVER IDS ---
  await discoverTestIds();

  // --- AUTH ---
  console.log("\n── Auth ──");
  await req("GET", "/api/auth/session-info", { label: "Session info (authed)" });

  // --- HOTELS ---
  console.log("\n── Hotels ──");
  await req("GET", "/api/hotels/mine", { label: "My hotels" });
  await req("GET", "/api/hotels/", { label: "All hotels (admin)" });
  await req("GET", "/api/hotels/management-groups", { label: "Management groups" });
  if (TEST_HOTEL_ID) {
    await req("GET", `/api/hotels/${TEST_HOTEL_ID}/details`, { label: "Hotel details" });
    await req("GET", `/api/hotels/${TEST_HOTEL_ID}/compset`, { label: "Hotel compset" });
    const year = new Date().getFullYear();
    await req("GET", `/api/hotels/${TEST_HOTEL_ID}/budgets/${year}`, { label: `Hotel budgets ${year}` });
  } else {
    skip("Hotel details/compset/budgets");
  }

  // --- METRICS ---
  console.log("\n── Metrics ──");
  await req("GET", "/api/metrics/metadata/last-refresh", { label: "Last refresh metadata" });
  if (TEST_HOTEL_ID) {
    await req("GET", `/api/metrics/metadata/sync-status/${TEST_HOTEL_ID}`, { label: "Sync status" });
    await req("GET", `/api/metrics/kpi-summary?hotelId=${TEST_HOTEL_ID}`, { label: "KPI summary" });
  } else {
    skip("Metrics (need hotel ID)");
  }

  // --- MARKET ---
  console.log("\n── Market ──");
  if (TEST_MARKET_SLUG) {
    await req("GET", `/api/market/trends?citySlug=${TEST_MARKET_SLUG}`, { label: "Market trends" });
    await req("GET", `/api/market/kpis?citySlug=${TEST_MARKET_SLUG}`, { label: "Market KPIs" });
    await req("GET", `/api/market/neighborhoods?citySlug=${TEST_MARKET_SLUG}`, { label: "Neighborhoods" });
    await req("GET", `/api/market/forward-view?citySlug=${TEST_MARKET_SLUG}`, { label: "Forward view" });
    await req("GET", `/api/market/outlook?citySlug=${TEST_MARKET_SLUG}`, { label: "Market outlook" });
    await req("GET", `/api/market/accommodation-map?citySlug=${TEST_MARKET_SLUG}`, { label: "Accommodation map" });
    await req("GET", `/api/market/neighbourhood-supply?citySlug=${TEST_MARKET_SLUG}`, { label: "Neighbourhood supply" });
  } else {
    skip("Market endpoints (need city slug)");
  }

  // --- SENTINEL ---
  console.log("\n── Sentinel ──");
  await req("GET", "/api/sentinel/configs", { label: "Sentinel configs" });
  await req("GET", "/api/sentinel/pms-property-ids", { label: "PMS property IDs" });
  await req("GET", "/api/sentinel/notifications", { label: "Notifications" });
  if (TEST_HOTEL_ID) {
    await req("GET", `/api/sentinel/config/${TEST_HOTEL_ID}`, { label: "Sentinel config (hotel)" });
    await req("GET", `/api/sentinel/max-rates/${TEST_HOTEL_ID}`, { label: "Max rates" });
    await req("GET", `/api/sentinel/min-rates/${TEST_HOTEL_ID}`, { label: "Min rates" });
    await req("GET", `/api/sentinel/pace-curves/${TEST_HOTEL_ID}`, { label: "Pace curves" });
    await req("GET", `/api/sentinel/predictions/${TEST_HOTEL_ID}`, { label: "AI predictions" });
    await req("GET", `/api/sentinel/status/${TEST_HOTEL_ID}`, { label: "Sentinel status" });
    await req("GET", `/api/sentinel/recent-jobs/${TEST_HOTEL_ID}`, { label: "Recent jobs" });
    if (TEST_MARKET_SLUG) {
      await req("GET", `/api/sentinel/market-events/${TEST_MARKET_SLUG}`, { label: "Market events" });
    }
  } else {
    skip("Sentinel hotel-specific endpoints");
  }

  // --- ADMIN ---
  console.log("\n── Admin ──");
  await req("GET", "/api/admin/test-database", { label: "DB connection test" });

  // --- BRIDGE (API key auth) ---
  console.log("\n── Bridge (API key) ──");
  if (BRIDGE_KEY) {
    await req("GET", "/api/bridge/fleet", { auth: "bridge", label: "Bridge fleet" });
    if (TEST_HOTEL_ID) {
      await req("GET", `/api/bridge/context/${TEST_HOTEL_ID}`, { auth: "bridge", label: "Bridge context" });
    }
  } else {
    skip("Bridge endpoints (no SENTINEL_DGX_KEY in env)");
  }

  // --- USERS ---
  console.log("\n── Users ──");
  await req("GET", "/api/users/profile", { label: "User profile" });
  await req("GET", "/api/users/team", { label: "User team" });

  // --- REPORTS (just check the page loads) ---
  console.log("\n── Static Pages ──");
  await req("GET", "/reports", { auth: "none", label: "Reports page (SPA)" });
  await req("GET", "/sentinel", { auth: "none", label: "Sentinel page (SPA)" });
  await req("GET", "/settings", { auth: "none", label: "Settings page (SPA)" });

  // --- SUMMARY ---
  console.log("\n════════════════════════════════════");
  console.log(`  ✅ PASS: ${results.pass}`);
  console.log(`  ❌ FAIL: ${results.fail}`);
  console.log(`  ⏭️  SKIP: ${results.skip}`);
  console.log("════════════════════════════════════");

  if (results.errors.length > 0) {
    console.log("\n── Failed Endpoints ──");
    for (const e of results.errors) {
      console.log(`  ${e.tag} → ${e.status}`);
      if (e.detail) console.log(`    ${e.detail.substring(0, 120)}`);
    }
  }

  console.log("");
  process.exit(results.fail > 0 ? 1 : 0);
}

run();
