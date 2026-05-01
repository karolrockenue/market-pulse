#!/usr/bin/env node
// Annual refresh of the PredictHQ static dataset. Reads a TSV produced by
// scripts/fetch-predicthq-london-year.js (or an .xlsx with the same column
// order) and writes api/data/predicthq-london-<YEAR>.json in the lean shape
// MarketService.getPredictHQEvents serves.
//
// Filter matches the live API path the static path replaced:
//   categories ∈ {concerts, festivals, sports, conferences, expos, performing-arts}
//   rank ≥ 65
//
// Usage:
//   node scripts/build-predicthq-static.js <input.tsv|input.xlsx> [year]
//   node scripts/build-predicthq-static.js predicthq-london-2026.tsv 2026

const fs = require("fs");
const path = require("path");

const ALLOWED = new Set([
  "concerts", "festivals", "sports", "conferences", "expos", "performing-arts",
]);
const RANK_MIN = 65;

const COLUMNS = [
  "id", "title", "description", "category", "labels",
  "rank", "local_rank", "phq_attendance",
  "start_utc", "end_utc", "start_local", "end_local",
  "timezone", "duration_sec", "country", "state", "scope", "relevance",
  "predicted_event_spend", "spend_accommodation", "spend_hospitality", "spend_transportation",
  "lat", "lng", "venue_type", "entities", "place_hierarchies", "place_ids",
  "first_seen", "updated",
];

function parseRowTsv(line) {
  const cells = line.split("\t");
  const o = {};
  COLUMNS.forEach((k, i) => (o[k] = cells[i]));
  return o;
}

async function readRows(input) {
  const ext = path.extname(input).toLowerCase();
  if (ext === ".tsv") {
    const raw = fs.readFileSync(input, "utf8").split(/\r?\n/).filter(Boolean);
    // The fetcher prepends a header line; tolerate either by sniffing.
    const start = raw[0].split("\t")[0] === "id" ? 1 : 0;
    return raw.slice(start).map(parseRowTsv);
  }
  if (ext === ".xlsx") {
    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(input);
    const ws = wb.worksheets[0];
    const rows = [];
    let first = true;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = row.values.slice(1); // exceljs is 1-indexed
      if (first && String(cells[0]) === "id") { first = false; return; }
      first = false;
      const o = {};
      COLUMNS.forEach((k, i) => {
        const v = cells[i];
        o[k] = v instanceof Date ? v.toISOString() : v == null ? "" : String(v);
      });
      rows.push(o);
    });
    return rows;
  }
  throw new Error(`Unsupported input extension: ${ext}`);
}

function tier(localRank) {
  const lr = Number(localRank) || 0;
  return lr >= 90 ? "Extreme" : lr >= 75 ? "High" : "Medium";
}

function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? (Number.isInteger(n) ? n : n) : null;
}

function datePart(v) {
  if (!v) return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

(async () => {
  const [, , input, yearArg] = process.argv;
  if (!input) {
    console.error("Usage: node scripts/build-predicthq-static.js <input.tsv|input.xlsx> [year]");
    process.exit(1);
  }
  const year = yearArg || (input.match(/(\d{4})/) || [])[1] || new Date().getFullYear();

  const rows = await readRows(path.resolve(input));
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!ALLOWED.has(r.category)) continue;
    const rank = Number(r.rank);
    if (!Number.isFinite(rank) || rank < RANK_MIN) continue;
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      title: r.title,
      category: r.category,
      start: datePart(r.start_utc),
      end: datePart(r.end_utc) || datePart(r.start_utc),
      rank: num(r.rank),
      localRank: num(r.local_rank) || 0,
      attendance: num(r.phq_attendance),
      accommodationSpend: num(r.spend_accommodation),
      tier: tier(r.local_rank),
    });
  }
  out.sort((a, b) => (a.start || "").localeCompare(b.start || "") || (b.localRank - a.localRank));

  const outPath = path.resolve(__dirname, "..", "api", "data", `predicthq-london-${year}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out), "utf8");

  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`Read   : ${rows.length} rows from ${input}`);
  console.log(`Kept   : ${out.length} events (categories ∈ allowed, rank ≥ ${RANK_MIN})`);
  console.log(`Wrote  : ${outPath} (${kb} KB)`);
  console.log(`Range  : ${out[0]?.start} → ${out[out.length - 1]?.start}`);
  console.log(`\nNext: update STATIC_EVENTS_FILES in api/services/market.service.js to point at this file.`);
})().catch((e) => { console.error(e); process.exit(1); });
