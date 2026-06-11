/**
 * @file mfRateSegment.js
 * @brief Single source of truth for Mason & Fifth rate-segment classification
 *        (short | mid | long | exclude).
 *
 * Yesterday's V3 migration (2026-05-28, mason-and-fifth.md §19.3) moved M&F
 * segment classification from "which Mews service" to "which rate GROUP",
 * because Mews merged Mid into the Short service and split Long across an old
 * monthly + a new nightly service — so service-based classification mislabels
 * them. The resolution logic used to live only inside the re-runnable backfill
 * (`scripts/backfill-mf-rate-segment.js`); it now lives here so the historical
 * backfill and the live webhook path can never drift.
 *
 * All three hotels resolve by rate GROUP name (Primrose + Belsize flipped
 * 2026-06-11 after Silvija aligned their Mews services/rates to the Westbourne
 * setup — Mid rates inside the Short service, Long on a new nightly service).
 * Rates whose group is not listed fall back to their SERVICE's role, so
 * leftover bookings on the old "DO NOT USE" mid/long services stay correct.
 *
 * `rate_segment` ∈ { short, mid, long, exclude }. "exclude" = comp / management.
 */
const mewsAdapter = require("../adapters/mewsAdapter");

// M&F hotel IDs (market-pulse hotels.hotel_id).
const MF_HOTEL_IDS = [318329, 318341, 318343];

// Rate-group NAME → segment. Anything not listed falls back to the owning
// service's role (SERVICE_ROLE), then "short". Westbourne confirmed via
// scripts/probe-wb-rates-segments.js; Primrose/Belsize via
// scripts/probe-ph-bp-realign.js (2026-06-11, post-Silvija realignment).
const RATE_GROUP_SEGMENTS = {
  318341: {
    mid: ["OLD DIRECT Mid Stay"],
    long: ["LongStay", "OLD DIRECT LongStay", "OLD"],
    exclude: ["MANAGEMENT"],
  },
  318343: {
    mid: [
      "Mid Stay",
      "OLD DIRECT M&F Stay Awhile – Monthly Stays Made Simple",
      "OLD DIRECT Monthly Stays Made Simple",
      "OLD DIRECT Monthly Stay Made Simple 3",
    ],
    long: ["LongStay", "Extended Stay", "OLD DIRECT Direct Long Stay"],
    exclude: ["Friends & Staff"],
  },
  318329: {
    mid: ["Mid Stay"],
    long: ["LongStay", "Extended Stay"],
    exclude: ["Friends & Staff"],
  },
};

// Service → role, used for non-rate-group hotels AND as the fallback when a
// Westbourne reservation has no/unknown RateId.
const SERVICE_ROLE = {
  318341: {
    "e810df20-baa7-4895-a964-b26b00b051b9": "short",
    "4d036740-d62c-41d8-bcb6-b2e400f348b3": "mid",
    "c65e3632-af72-4b7a-8f64-b26b00b23336": "long",
    "3990f059-4fd8-47b3-ad48-b37600b41a91": "long",
    "72b82965-e525-4001-90d7-b26b00b26959": "long",
    "38bdc698-2872-4b4f-9984-b37900af2d20": "exclude", // Management
  },
  318343: {
    "b518b662-2504-4092-aa6a-b13400ade71e": "short",
    "b17bc567-1252-4532-8399-b37e00aad8fd": "mid", // Mid Stay Accommodation DO NOT USE
    "1170a1a6-7130-4a1d-ab5d-b35b00f1692b": "mid", // ARCHIVE Mid Stay Accommodation
    "270856f0-7b69-4425-a558-b14c0090c12d": "long", // LongStay Accommodation DO NOT USE
    "3dc71b11-420c-48ed-a0b7-b46500df9f59": "long", // LongStay Accommodation (nightly, 2026-06)
    "e5ad6c2e-58f3-4924-9e94-b38400c54e24": "exclude", // Management
  },
  318329: {
    "c6267c3b-144c-40e2-baf3-b3e00110df1b": "short",
    "8e73ceb8-2725-43eb-95fa-b46500ac6dee": "long", // LongStay Accommodation (nightly, 2026-06)
  },
};

function isMfHotel(hotelId) {
  return MF_HOTEL_IDS.includes(Number(hotelId));
}

// Build rateId → segment for a rate-group-mode hotel (Westbourne only today).
// Returns null for hotels that classify by service.
async function buildRateSegmentMap(hotelId, credentials) {
  const cfg = RATE_GROUP_SEGMENTS[hotelId];
  if (!cfg) return null;
  const toSeg = {};
  for (const seg of ["mid", "long", "exclude"])
    for (const g of cfg[seg] || []) toSeg[g] = seg;

  const resp = await mewsAdapter._callMewsApi("rates/getAll", credentials, {
    ServiceIds: Object.keys(SERVICE_ROLE[hotelId] || {}),
    Extent: { Rates: true, RateGroups: true },
  });
  const groupName = {};
  for (const g of resp.RateGroups || []) groupName[g.Id] = g.Name;
  const svcRole = SERVICE_ROLE[hotelId] || {};
  const rateSeg = {};
  for (const r of resp.Rates || []) {
    // Group mapping wins; otherwise the rate inherits its service's role
    // (keeps leftover bookings on old mid/long services correct); else short.
    const seg = toSeg[groupName[r.GroupId]] || svcRole[r.ServiceId] || "short";
    rateSeg[r.Id] = seg;
  }
  return rateSeg;
}

function segmentFor(hotelId, rateId, serviceId, rateSegMap) {
  if (rateSegMap && rateId && rateSegMap[rateId]) return rateSegMap[rateId];
  // fallback: service → role (reservations with no/unknown RateId)
  return (SERVICE_ROLE[hotelId] || {})[serviceId] || null;
}

// ─── Live path (webhook) ───────────────────────────────────────────
// The rate→segment map is built from rates/getAll, which is slow and rarely
// changes, so cache it per hotel. New rate plans are picked up within the TTL;
// re-run the backfill to restamp history when Dom files new Mid rates.
const RATE_MAP_TTL_MS = 60 * 60 * 1000; // 1h
const _rateMapCache = new Map(); // hotelId → { map, expiresAt }

async function getRateSegmentMapCached(hotelId, credentials) {
  if (!RATE_GROUP_SEGMENTS[hotelId]) return null; // service-based hotel, no API call
  const hit = _rateMapCache.get(hotelId);
  if (hit && hit.expiresAt > Date.now()) return hit.map;
  const map = await buildRateSegmentMap(hotelId, credentials);
  _rateMapCache.set(hotelId, { map, expiresAt: Date.now() + RATE_MAP_TTL_MS });
  return map;
}

/**
 * Resolve rate_segment for a reservation at booking time. Returns
 * 'short' | 'mid' | 'long' | 'exclude' for M&F hotels, or null for non-M&F
 * hotels and unresolved reservations. NEVER throws — if building the rate map
 * fails (Mews error), it falls back to the service-based map so the caller's
 * ledger write is never blocked.
 */
async function classifyReservation(hotelId, credentials, rateId, serviceId) {
  if (!isMfHotel(hotelId)) return null;
  let rateSegMap = null;
  try {
    rateSegMap = await getRateSegmentMapCached(hotelId, credentials);
  } catch (err) {
    rateSegMap = null; // fall back to service-based classification
  }
  return segmentFor(hotelId, rateId, serviceId, rateSegMap);
}

// ─── Room category (studio type) resolution ────────────────────────
// Each Mews reservation carries a RequestedResourceCategoryId; this maps it to
// the category NAME (e.g. "Best In House (Our Favourites)") that the studio /
// category charts group by. Built from services/getAll (accommodation only) +
// resourceCategories/getAll — slow and rarely changes, so cached per hotel.
// Mirrors getRateSegmentMapCached. Same resolution the room-category backfill
// uses (scripts/backfill-mf-room-category.js) so live + history can't drift.
function _categoryName(c) {
  const n = c.Names && (c.Names.en || c.Names["en-GB"] || Object.values(c.Names)[0]);
  return (n || c.Name || "").trim();
}

async function buildRoomCategoryMap(hotelId, credentials) {
  const svcResp = await mewsAdapter._callMewsApi("services/getAll", credentials, {});
  const accomIds = (svcResp.Services || [])
    .filter((s) => /accommodation/i.test(s.Name || ""))
    .map((s) => s.Id);
  if (accomIds.length === 0) return {};
  const resp = await mewsAdapter._callMewsApi("resourceCategories/getAll", credentials, {
    ServiceIds: accomIds,
  });
  const map = {};
  for (const c of resp.ResourceCategories || []) map[c.Id] = _categoryName(c);
  return map;
}

const CATEGORY_MAP_TTL_MS = 6 * 60 * 60 * 1000; // 6h — categories rarely change
const _categoryMapCache = new Map(); // hotelId → { map, expiresAt }

async function getRoomCategoryMapCached(hotelId, credentials) {
  const hit = _categoryMapCache.get(hotelId);
  if (hit && hit.expiresAt > Date.now()) return hit.map;
  const map = await buildRoomCategoryMap(hotelId, credentials);
  _categoryMapCache.set(hotelId, { map, expiresAt: Date.now() + CATEGORY_MAP_TTL_MS });
  return map;
}

/**
 * Resolve a reservation's room category (studio type) name at booking time from
 * its RequestedResourceCategoryId. Returns the full category name (e.g.
 * "Classic Studio (All You Need)") for M&F hotels, or null for non-M&F hotels /
 * unresolved ids. NEVER throws — on a Mews error it returns null so the caller's
 * ledger write is never blocked (the backfill can heal later).
 */
async function resolveRoomCategory(hotelId, credentials, requestedResourceCategoryId) {
  if (!isMfHotel(hotelId) || !requestedResourceCategoryId) return null;
  try {
    const map = await getRoomCategoryMapCached(hotelId, credentials);
    return map[requestedResourceCategoryId] || null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  MF_HOTEL_IDS,
  RATE_GROUP_SEGMENTS,
  SERVICE_ROLE,
  isMfHotel,
  buildRateSegmentMap,
  segmentFor,
  getRateSegmentMapCached,
  classifyReservation,
  buildRoomCategoryMap,
  getRoomCategoryMapCached,
  resolveRoomCategory,
};
