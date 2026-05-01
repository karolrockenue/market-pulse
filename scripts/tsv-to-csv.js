#!/usr/bin/env node
// Convert a TSV file to RFC-4180 CSV with UTF-8 BOM (so Excel opens it cleanly).
// Usage: node scripts/tsv-to-csv.js <input.tsv> [output.csv]

const fs = require("fs");
const path = require("path");

const inPath = process.argv[2];
if (!inPath) {
  console.error("Usage: node scripts/tsv-to-csv.js <input.tsv> [output.csv]");
  process.exit(1);
}
const outPath = process.argv[3] || inPath.replace(/\.tsv$/i, "") + ".csv";

const csvEscape = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};

const tsv = fs.readFileSync(inPath, "utf8");
const lines = tsv.split(/\r?\n/);

const BOM = "﻿";
const out = fs.createWriteStream(outPath, { encoding: "utf8" });
out.write(BOM);

let rowCount = 0;
for (const line of lines) {
  if (line === "") continue;
  const cells = line.split("\t");
  out.write(cells.map(csvEscape).join(",") + "\r\n");
  rowCount++;
}
out.end(() => {
  const bytes = fs.statSync(outPath).size;
  console.log(`Wrote ${rowCount} rows (incl. header) -> ${outPath} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
});
