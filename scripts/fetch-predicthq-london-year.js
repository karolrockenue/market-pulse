#!/usr/bin/env node
// One-off: fetch ALL PredictHQ events for London for calendar 2026, write TSV for Excel paste.
// Usage: node scripts/fetch-predicthq-london-year.js [YYYY]   (default: current year)

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const TOKEN = process.env.PREDICTHQ_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("PREDICTHQ_ACCESS_TOKEN not set in .env");
  process.exit(1);
}

const YEAR = Number(process.argv[2]) || new Date().getFullYear();
const LAT = 51.5074;
const LNG = -0.1278;
const WITHIN = `30km@${LAT},${LNG}`;
const PAGE_SIZE = 50; // free-tier cap
const REQUEST_DELAY_MS = 120;

const headers = { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function weekRanges(year) {
  const ranges = [];
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year, 11, 31);
  for (let t = yearStart; t <= yearEnd; t += 7 * 86400000) {
    const start = new Date(t).toISOString().slice(0, 10);
    const endTs = Math.min(t + 6 * 86400000, yearEnd);
    const end = new Date(endTs).toISOString().slice(0, 10);
    ranges.push({ start, end });
  }
  return ranges;
}

async function fetchWindow(start, end) {
  const events = [];
  let offset = 0;
  let total = null;
  while (true) {
    const params = new URLSearchParams({
      within: WITHIN,
      "active.gte": start,
      "active.lte": end,
      sort: "-rank",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    const url = `https://api.predicthq.com/v1/events/?${params}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PredictHQ ${res.status} for ${start}..${end} offset=${offset}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const batch = data.results || [];
    events.push(...batch);
    if (total === null) total = data.count ?? 0;
    if (batch.length === 0) break;
    offset += batch.length;
    if (offset >= total) break;
    if (offset >= 10000) {
      console.warn(`  WARN: hit 10k deep-pagination cap for ${start}..${end} (total reported=${total})`);
      break;
    }
    await sleep(REQUEST_DELAY_MS);
  }
  process.stdout.write(`  ${start}..${end}  fetched=${events.length}  reported_total=${total}\n`);
  return events;
}

function flat(e) {
  const spendInd = e.predicted_event_spend_industries || {};
  const geo = e.geo || {};
  const geometry = geo.geometry || {};
  const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const placeHierarchies = Array.isArray(e.place_hierarchies)
    ? e.place_hierarchies.map((p) => p.join(">")).join(" | ")
    : "";
  const entities = Array.isArray(e.entities)
    ? e.entities.map((x) => `${x.type}:${x.name}`).join(" | ")
    : "";
  const placesIds = Array.isArray(e.place_hierarchies)
    ? e.place_hierarchies.flat().join(",")
    : "";

  return {
    id: e.id,
    title: e.title,
    description: (e.description || "").replace(/\s+/g, " ").trim(),
    category: e.category,
    labels: Array.isArray(e.labels) ? e.labels.join(";") : "",
    rank: e.rank,
    local_rank: e.local_rank,
    phq_attendance: e.phq_attendance,
    start_utc: e.start,
    end_utc: e.end,
    start_local: e.start_local,
    end_local: e.end_local,
    timezone: e.timezone,
    duration_sec: e.duration,
    country: e.country,
    state: e.state,
    scope: e.scope,
    relevance: Array.isArray(e.relevance) ? e.relevance.join(";") : "",
    predicted_event_spend: e.predicted_event_spend,
    spend_accommodation: spendInd.accommodation,
    spend_hospitality: spendInd.hospitality,
    spend_transportation: spendInd.transportation,
    lat: coords[1],
    lng: coords[0],
    venue_type: geo.placekey || "",
    entities: entities,
    place_hierarchies: placeHierarchies,
    place_ids: placesIds,
    first_seen: e.first_seen,
    updated: e.updated,
  };
}

function toTsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/\t/g, " ").replace(/\r?\n/g, " ");
    return s;
  };
  const lines = [headers.join("\t")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join("\t"));
  return lines.join("\n");
}

(async () => {
  console.log(`Fetching PredictHQ events for London, ${YEAR}-01-01 .. ${YEAR}-12-31 (weekly chunks, limit=${PAGE_SIZE}/page)`);
  const all = [];
  for (const { start, end } of weekRanges(YEAR)) {
    const wk = await fetchWindow(start, end);
    all.push(...wk);
    await sleep(REQUEST_DELAY_MS);
  }

  // Dedupe by id (months will overlap multi-month events via active.gte/lte)
  const seen = new Set();
  const deduped = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));

  const flatRows = deduped.map(flat);
  const tsv = toTsv(flatRows);

  const outPath = path.resolve(process.cwd(), `predicthq-london-${YEAR}.tsv`);
  fs.writeFileSync(outPath, tsv, "utf8");

  console.log(`\nRaw events fetched (with month dupes): ${all.length}`);
  console.log(`Unique events: ${deduped.length}`);
  console.log(`Written: ${outPath}`);
  console.log(`\nOpen the TSV in Excel (File > Open), or copy-paste its contents into a sheet — columns split on TAB automatically.`);
})();
