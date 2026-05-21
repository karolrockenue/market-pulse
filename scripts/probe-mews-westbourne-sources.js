// READ-ONLY: list resolved booking sources for Westbourne (318341) past
// check-ins in the last 60 days. Resolves reservation.TravelAgencyId ->
// company name via companies/getAll; falls back to Origin for direct/manual.
require("dotenv").config({ path: "./.env" });
const mews = require("../api/adapters/mewsAdapter");
const HOTEL = 318341;

async function pageAll(ep, creds, body, key) {
  const out = [];
  let cursor = null, p = 0;
  do {
    const r = await mews._callMewsApi(ep, creds, { ...body, Limitation: { Count: 1000, Cursor: cursor } });
    out.push(...(r[key] || []));
    cursor = r.Cursor || null;
    if (++p > 60) break;
  } while (cursor);
  return out;
}

(async () => {
  const creds = await mews.getCredentials(HOTEL);
  const now = new Date();
  const from = new Date(now.getTime() - 60 * 86400000);

  const companies = await pageAll("companies/getAll", creds, {}, "Companies");
  const cMap = new Map(companies.map((c) => [c.Id, c.Name]));

  const res = await pageAll(
    "reservations/getAll/2023-06-06", creds,
    { StartUtc: from.toISOString(), EndUtc: now.toISOString(), TimeFilter: "Start", States: ["Started", "Processed"] },
    "Reservations",
  );

  const label = (r) => {
    if (r.TravelAgencyId) return cMap.get(r.TravelAgencyId) || `«unresolved agency ${String(r.TravelAgencyId).slice(0,8)}»`;
    const o = r.Origin || "Unknown";
    if (o === "Distributor") return "Direct — Booking Engine";
    if (o === "Commander") return "Manual (Commander)";
    if (o === "ChannelManager") return "Channel Manager (no agency)";
    return `Origin: ${o}`;
  };

  const seen = new Set();
  const uniq = res.filter((r) => (r.Id && !seen.has(r.Id)) ? (seen.add(r.Id), true) : false);
  const agg = new Map();
  let total = 0, canceled = 0;
  for (const r of uniq) {
    if ((r.State || "") === "Canceled") { canceled++; continue; }
    total++;
    const s = label(r);
    agg.set(s, (agg.get(s) || 0) + 1);
  }

  const rows = [...agg.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`Westbourne (318341) — check-ins ${from.toISOString().slice(0,10)} → ${now.toISOString().slice(0,10)}`);
  console.log(`reservations: raw ${res.length}, unique ${uniq.length} (non-canceled ${total}, canceled ${canceled}); companies: ${companies.length}\n`);
  console.log("count  share   source");
  for (const [s, n] of rows) {
    console.log(`${String(n).padStart(5)}  ${((n/total)*100).toFixed(1).padStart(5)}%  ${s}`);
  }
  process.exit(0);
})();
