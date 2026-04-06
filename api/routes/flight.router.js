const express = require("express");
const router = express.Router();
const { requireAdminApi } = require("../utils/middleware");
const flightService = require("../services/flight.service");
const logger = require("../utils/logger");

// GET /api/flights/demand?city=london&days=90&yoy=true
// Returns cached flight demand data for a city, optionally with YoY comparison
router.get("/demand", requireAdminApi, async (req, res) => {
  try {
    const { city, days, yoy } = req.query;
    if (!city) {
      return res.status(400).json({ error: "city query param required" });
    }
    const includeYoY = yoy === "true" || yoy === "1";
    const result = await flightService.getFlightDemand(city, parseInt(days) || 90, includeYoY);
    res.json(result);
  } catch (err) {
    logger.error({ msg: "GET /flights/demand error", error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flights/refresh?city=london&days=90&yoy=true
// Triggers a fresh fetch from AeroDataBox (admin only)
// Runs in the background — returns immediately
router.post("/refresh", requireAdminApi, async (req, res) => {
  try {
    const { city, days, yoy } = req.query;
    if (!city) {
      return res.status(400).json({ error: "city query param required" });
    }

    const airports = flightService.CITY_AIRPORTS[city];
    if (!airports) {
      return res.json({ citySlug: city, fetched: 0, skipped: 0, message: "No airport config for this city" });
    }

    const includeYoY = yoy === "true" || yoy === "1";

    // Return immediately — run fetch in background
    res.json({ status: "started", citySlug: city, airports, includeYoY, message: "Fetching in background. Refresh page in a few minutes to see data." });

    console.log(`[FLIGHT] Starting background refresh for ${city} (${airports.join(", ")}) yoy=${includeYoY}`);
    console.log(`[FLIGHT] RAPIDAPI_KEY present: ${!!process.env.RAPIDAPI_KEY}, length: ${(process.env.RAPIDAPI_KEY || "").length}`);

    flightService.refreshFlightDemand(city, parseInt(days) || 90, includeYoY)
      .then((result) => {
        console.log(`[FLIGHT] Refresh complete: fetched=${result.fetched}, skipped=${result.skipped}`);
      })
      .catch((err) => {
        console.error(`[FLIGHT] Refresh FAILED: ${err.message}`);
        console.error(err.stack);
      });
  } catch (err) {
    logger.error({ msg: "POST /flights/refresh error", error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flights/cities
// Returns supported cities and their airport configs
router.get("/cities", requireAdminApi, async (req, res) => {
  res.json(flightService.getSupportedCities());
});

module.exports = router;
