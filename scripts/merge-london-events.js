/**
 * Merge the PredictHQ London feed with the curated Excel calendar into the
 * file the radar reads (api/data/london-events-2026.json). Curated wins on dupes.
 * Re-run after updating the curated calendar. Run: node scripts/merge-london-events.js
 */
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "api", "data");
const phq = JSON.parse(fs.readFileSync(path.join(dir, "predicthq-london-2026.json"), "utf8"));
const cur = JSON.parse(fs.readFileSync(path.join(dir, "london-events-curated-source.json"), "utf8"));

const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const key2 = (t) => norm(t).slice(0, 2).join(" ");
const STOP = new Set(["london", "the", "world", "uk", "royal", "international", "intl"]);
const overlap = (a, b) => (a.start || a.end) <= (b.end || b.start) && (b.start || b.end) <= (a.end || a.start);
const match = (p, c) => {
  const pf = norm(p.title)[0], cf = norm(c.title)[0];
  if (pf && cf && pf === cf && !STOP.has(pf) && pf.length >= 4) return true;
  return key2(p.title) === key2(c.title);
};

const dropped = [];
const phqKept = phq.filter((p) => {
  const dup = cur.find((c) => match(p, c) && overlap(p, c));
  if (dup) { dropped.push(`${p.title} ≈ ${dup.title}`); return false; }
  return true;
});
const merged = [...phqKept, ...cur].sort((a, b) => (a.start || "").localeCompare(b.start || ""));

fs.writeFileSync(path.join(dir, "london-events-2026.json"), JSON.stringify(merged, null, 1));
console.log(`Merged ${phq.length} PHQ + ${cur.length} curated − ${dropped.length} dupes = ${merged.length} → api/data/london-events-2026.json`);
