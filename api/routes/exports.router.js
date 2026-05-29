/**
 * @file exports.router.js
 * @brief Login-gated downloads of pre-generated data exports (CSV).
 *
 * Mounted at: /api/exports
 *
 * Static files in /api/exports/ are served ONLY to authenticated Market Pulse
 * users (requireUserApi). Filenames are whitelisted — no path traversal, no
 * arbitrary file reads. Add new exports by dropping the file in api/exports/
 * and adding its name to ALLOWED.
 *
 * NOTE: these CSVs contain confidential commercial data (named partners +
 * negotiated rates). They are intentionally behind login, never public/static.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { requireUserApi } = require("../utils/middleware");

const EXPORTS_DIR = path.join(__dirname, "..", "exports");

const ALLOWED = new Set([
  "westbourne-rates-full.csv",
  "primrose-rates-full.csv",
  "belsize-rates-full.csv",
]);

router.get("/:file", requireUserApi, (req, res) => {
  const file = req.params.file;
  if (!ALLOWED.has(file)) {
    return res.status(404).json({ error: "Export not found." });
  }
  const fullPath = path.join(EXPORTS_DIR, file);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Export not found." });
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
  fs.createReadStream(fullPath).pipe(res);
});

module.exports = router;
