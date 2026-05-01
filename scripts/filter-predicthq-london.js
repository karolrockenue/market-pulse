#!/usr/bin/env node
// Filter the full PredictHQ London TSV down to ~a few hundred events that actually matter for hotel demand.
// Rule: keep if local_rank >= 75 OR phq_attendance >= 5000 OR category in {public-holidays, school-holidays}.
// Sort: by start_utc asc, then local_rank desc (ties).
// Output: CSV (with BOM) + TSV.

const fs = require("fs");
const path = require("path");

const IN_TSV = path.resolve(__dirname, "..", "predicthq-london-2026.tsv");
const OUT_BASENAME = "predicthq-london-2026-filtered";

const KEEP_CATEGORIES = new Set(["public-holidays"]);
const DROP_CATEGORIES = new Set([
  "school-holidays",
  "airport-delays",
  "health-warnings",
  "severe-weather",
  "daylight-savings",
  "academic",
  "politics",
]);
const LOCAL_RANK_MIN = 85;
const ATTENDANCE_MIN = 20000;

const raw = fs.readFileSync(IN_TSV, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
const header = lines[0].split("\t");
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const kept = [];
for (let i = 1; i < lines.length; i++) {
  const row = lines[i].split("\t");
  const localRank = Number(row[idx.local_rank]) || 0;
  const attendance = Number(row[idx.phq_attendance]) || 0;
  const category = row[idx.category];
  if (DROP_CATEGORIES.has(category)) continue;
  if (localRank >= LOCAL_RANK_MIN || attendance >= ATTENDANCE_MIN || KEEP_CATEGORIES.has(category)) {
    kept.push(row);
  }
}

// Sort: start_utc asc, then local_rank desc
kept.sort((a, b) => {
  const ad = a[idx.start_utc] || "";
  const bd = b[idx.start_utc] || "";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (Number(b[idx.local_rank]) || 0) - (Number(a[idx.local_rank]) || 0);
});

// Write TSV
const tsvOut = path.resolve(__dirname, "..", `${OUT_BASENAME}.tsv`);
fs.writeFileSync(tsvOut, [header.join("\t"), ...kept.map((r) => r.join("\t"))].join("\n") + "\n", "utf8");

// Write CSV with BOM and RFC-4180 escaping
const csvEscape = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csvOut = path.resolve(__dirname, "..", `${OUT_BASENAME}.csv`);
const ws = fs.createWriteStream(csvOut, { encoding: "utf8" });
ws.write("﻿");
ws.write(header.map(csvEscape).join(",") + "\r\n");
for (const r of kept) ws.write(r.map(csvEscape).join(",") + "\r\n");
ws.end(() => {
  const csvBytes = fs.statSync(csvOut).size;
  const tsvBytes = fs.statSync(tsvOut).size;
  console.log(`Input rows: ${lines.length - 1}`);
  console.log(`Kept rows : ${kept.length}`);
  console.log(`Filter    : local_rank>=${LOCAL_RANK_MIN} OR phq_attendance>=${ATTENDANCE_MIN} OR category in {${[...KEEP_CATEGORIES].join(",")}}`);
  console.log(`Wrote     : ${csvOut} (${(csvBytes / 1024).toFixed(1)} KB)`);
  console.log(`Wrote     : ${tsvOut} (${(tsvBytes / 1024).toFixed(1)} KB)`);

  // Breakdown by category for sanity
  const byCat = {};
  for (const r of kept) byCat[r[idx.category]] = (byCat[r[idx.category]] || 0) + 1;
  console.log(`\nBy category:`);
  for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(22)} ${n}`);
  }
});
