/**
 * Backfill reservations.room_type (studio / space category) for M&F hotels
 * from Mews. Our webhook only captured room_type intermittently — ~87% of
 * short and 100% of long reservations had it NULL — which blocked the
 * "rate by studio category" charts. Each Mews reservation carries a
 * RequestedResourceCategoryId; this maps it to the category NAME (which
 * normalises across services — e.g. the long service's "Classic Studio" id
 * resolves to the same label as the short service's) and writes it.
 *
 * Usage:
 *   node scripts/backfill-mf-room-category.js               # all 3 M&F hotels
 *   node scripts/backfill-mf-room-category.js 318341        # single hotel
 *   node scripts/backfill-mf-room-category.js 318341 2024-01-01 2026-05-20
 */
require("dotenv").config();
const pool = require("../api/utils/db");
const mews = require("../api/adapters/mewsAdapter");

const MF_HOTELS = [318329, 318341, 318343];
const argHotelId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const argStart = process.argv[3] || "2024-01-01";
const argEnd = process.argv[4] || new Date().toISOString().slice(0, 10);

const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function catName(c) {
  const n = c.Names && (c.Names.en || c.Names["en-GB"] || Object.values(c.Names)[0]);
  return (n || c.Name || "").trim();
}

async function buildCategoryMap(creds) {
  // resourceCategories/getAll requires ServiceIds — gather every accommodation
  // service (incl. archive / "to delete" so old reservations still resolve).
  const svcResp = await mews._callMewsApi("services/getAll", creds, {});
  const accomIds = (svcResp.Services || [])
    .filter((s) => /accommodation/i.test(s.Name || ""))
    .map((s) => s.Id);
  if (accomIds.length === 0) return {};
  const resp = await mews._callMewsApi("resourceCategories/getAll", creds, { ServiceIds: accomIds });
  const map = {};
  for (const c of resp.ResourceCategories || []) map[c.Id] = catName(c);
  return map;
}

async function fetchReservations(creds, fromIso, toIso) {
  const out = [];
  let cursor = null;
  do {
    const resp = await mews._callMewsApi("reservations/getAll/2023-06-06", creds, {
      CreatedUtc: { StartUtc: `${fromIso}T00:00:00Z`, EndUtc: `${toIso}T00:00:00Z` },
      Limitation: { Count: 1000, Cursor: cursor },
    });
    if (resp.Reservations) out.push(...resp.Reservations);
    cursor = resp.Cursor || null;
  } while (cursor);
  return out;
}

async function backfillHotel(hotelId) {
  const creds = await mews.getCredentials(hotelId);
  const catMap = await buildCategoryMap(creds);
  console.log(`\n── ${hotelId} ── (${Object.keys(catMap).length} categories) ${argStart} → ${argEnd}`);

  let updated = 0, scanned = 0, unmapped = 0;
  const nameCounts = {};
  let chunkStart = argStart;
  while (chunkStart < argEnd) {
    const chunkEnd = addDays(chunkStart, 89) > argEnd ? argEnd : addDays(chunkStart, 89);
    const res = await fetchReservations(creds, chunkStart, chunkEnd);
    scanned += res.length;

    const ids = [], names = [];
    for (const r of res) {
      const name = catMap[r.RequestedResourceCategoryId];
      if (!name) { unmapped++; continue; }
      ids.push(r.Id);
      names.push(name);
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    }
    // Batch update in slices of 1000
    for (let i = 0; i < ids.length; i += 1000) {
      const idSlice = ids.slice(i, i + 1000);
      const nameSlice = names.slice(i, i + 1000);
      const r = await pool.query(
        `UPDATE reservations r SET room_type = v.name
           FROM (SELECT UNNEST($1::text[]) AS id, UNNEST($2::text[]) AS name) v
          WHERE r.id = v.id AND r.hotel_id = $3`,
        [idSlice, nameSlice, hotelId],
      );
      updated += r.rowCount;
    }
    process.stdout.write(`  ${chunkStart}→${chunkEnd}: ${res.length} res\r`);
    chunkStart = addDays(chunkEnd, 1);
  }
  console.log(`\n  scanned ${scanned}, updated ${updated}, unmapped(non-accom) ${unmapped}`);
  console.log("  categories written:", Object.entries(nameCounts).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}=${c}`).join(" | "));
}

(async () => {
  const hotels = argHotelId ? [argHotelId] : MF_HOTELS;
  for (const h of hotels) {
    try { await backfillHotel(h); } catch (e) { console.error(`  ✗ ${h}: ${e.message}`); }
  }
  process.exit(0);
})();
