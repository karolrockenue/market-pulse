/**
 * Diagnostic: pull per-Mews-service revenue for a single hotel.
 *
 * Proves the M&F "all services" dashboard is feasible end-to-end:
 *   1. services/getAll — lists every service (Reservable + Consumable)
 *   2. orderItems/getAll — pulls order items in a ConsumedUtc window,
 *      grouped in-memory by ServiceId
 *
 * Usage:
 *   node scripts/mnf-service-revenue.js <hotel_id> [days=30]
 *
 * Example:
 *   node scripts/mnf-service-revenue.js 318341 30   # Westbourne Park
 *   node scripts/mnf-service-revenue.js 318329 30   # Belsize Park
 */

require("dotenv").config();
const pool = require("../api/utils/db");
const mewsAdapter = require("../api/adapters/mewsAdapter");

async function main() {
  const hotelId = parseInt(process.argv[2], 10);
  const days = parseInt(process.argv[3] || "30", 10);

  if (!hotelId) {
    console.error(
      "Usage: node scripts/mnf-service-revenue.js <hotel_id> [days=30]",
    );
    process.exit(1);
  }

  // Resolve hotel context
  const hotelRow = await pool.query(
    `SELECT hotel_id, property_name, pms_type, pms_credentials
     FROM hotels WHERE hotel_id = $1`,
    [hotelId],
  );
  if (hotelRow.rows.length === 0) {
    console.error(`Hotel ${hotelId} not found.`);
    process.exit(1);
  }
  const hotel = hotelRow.rows[0];
  if (hotel.pms_type !== "mews") {
    console.error(`Hotel ${hotelId} is ${hotel.pms_type}, not mews.`);
    process.exit(1);
  }

  console.log(
    `\n=== ${hotel.property_name} (hotel_id=${hotelId}) — last ${days} days ===\n`,
  );

  const credentials = await mewsAdapter.getCredentials(hotelId);
  const onboardedServiceId = hotel.pms_credentials?.serviceId;

  // 1. List all services
  console.log("[1/3] Fetching services/getAll ...");
  const servicesResp = await mewsAdapter._callMewsApi(
    "services/getAll",
    credentials,
  );
  const allServices = servicesResp.Services || [];
  const activeServices = allServices.filter((s) => s.IsActive);

  console.log(
    `  Found ${allServices.length} total (${activeServices.length} active):`,
  );
  for (const s of activeServices) {
    const tag = s.Id === onboardedServiceId ? "  ← onboarded" : "";
    console.log(`    [${s.Type}]  ${s.Name}  (${s.Id})${tag}`);
  }

  // 2. Pull orderItems in the window (paginated)
  const endUtc = new Date();
  const startUtc = new Date(endUtc);
  startUtc.setUTCDate(endUtc.getUTCDate() - days);

  console.log(
    `\n[2/3] Fetching orderItems/getAll (ConsumedUtc ${startUtc.toISOString().slice(0, 10)} → ${endUtc.toISOString().slice(0, 10)})...`,
  );

  let allItems = [];
  let cursor = null;
  let page = 0;

  do {
    const resp = await mewsAdapter._callMewsApi(
      "orderItems/getAll",
      credentials,
      {
        ConsumedUtc: {
          StartUtc: startUtc.toISOString(),
          EndUtc: endUtc.toISOString(),
        },
        AccountingStates: ["Open", "Closed"],
        Limitation: { Count: 1000, Cursor: cursor },
      },
    );
    const items = resp.OrderItems || [];
    allItems = allItems.concat(items);
    cursor = resp.Cursor || null;
    page += 1;
    console.log(
      `    page ${page}: +${items.length} (total ${allItems.length})`,
    );
    if (page > 50) {
      console.warn("    aborting pagination after 50 pages — widen/narrow window");
      break;
    }
  } while (cursor);

  // 3. Group by ServiceId
  console.log("\n[3/3] Grouping by service...\n");

  const byService = new Map();
  for (const s of activeServices) {
    byService.set(s.Id, {
      name: s.Name,
      type: s.Type,
      isOnboarded: s.Id === onboardedServiceId,
      net: 0,
      gross: 0,
      count: 0,
    });
  }

  let orphanCount = 0;
  for (const item of allItems) {
    const sid = item.ServiceId;
    if (!sid) {
      orphanCount += 1;
      continue;
    }
    let bucket = byService.get(sid);
    if (!bucket) {
      // service not in active list (inactive / not returned) — still count it
      bucket = {
        name: `(inactive service ${sid.slice(0, 8)})`,
        type: "?",
        isOnboarded: false,
        net: 0,
        gross: 0,
        count: 0,
      };
      byService.set(sid, bucket);
    }
    bucket.net += item.Amount?.NetValue || 0;
    bucket.gross += item.Amount?.GrossValue || 0;
    bucket.count += 1;
  }

  // Print
  const rows = [...byService.entries()]
    .filter(([, v]) => v.count > 0)
    .sort(([, a], [, b]) => b.gross - a.gross);

  const PAD = {
    name: 42,
    type: 14,
    count: 8,
    net: 14,
    gross: 14,
  };

  const hr = (cols) =>
    cols.map((w) => "─".repeat(w)).join("  ");

  console.log(
    `${"Service".padEnd(PAD.name)}  ${"Type".padEnd(PAD.type)}  ${"Items".padStart(PAD.count)}  ${"Net".padStart(PAD.net)}  ${"Gross".padStart(PAD.gross)}`,
  );
  console.log(hr([PAD.name, PAD.type, PAD.count, PAD.net, PAD.gross]));

  let totalNet = 0,
    totalGross = 0,
    totalCount = 0;

  for (const [, v] of rows) {
    const flag = v.isOnboarded ? " ★" : "  ";
    const name = (v.name + flag).padEnd(PAD.name).slice(0, PAD.name);
    console.log(
      `${name}  ${v.type.padEnd(PAD.type)}  ${String(v.count).padStart(PAD.count)}  ${v.net.toFixed(2).padStart(PAD.net)}  ${v.gross.toFixed(2).padStart(PAD.gross)}`,
    );
    totalNet += v.net;
    totalGross += v.gross;
    totalCount += v.count;
  }

  console.log(hr([PAD.name, PAD.type, PAD.count, PAD.net, PAD.gross]));
  console.log(
    `${"TOTAL".padEnd(PAD.name)}  ${"".padEnd(PAD.type)}  ${String(totalCount).padStart(PAD.count)}  ${totalNet.toFixed(2).padStart(PAD.net)}  ${totalGross.toFixed(2).padStart(PAD.gross)}`,
  );

  if (orphanCount > 0) {
    console.log(
      `\n  (${orphanCount} order items had no ServiceId — skipped)`,
    );
  }

  console.log("\n★ = service currently onboarded in Market Pulse\n");

  await pool.end();
}

main().catch((err) => {
  console.error("\n[Error]", err.message);
  if (err.response?.data) {
    console.error("  Mews response:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
