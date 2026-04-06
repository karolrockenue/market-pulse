const express = require("express");
const router = express.Router();
const { requireAdminApi } = require("../utils/middleware");
const flightService = require("../services/flight.service");
const logger = require("../utils/logger");

// GET /api/flights/demand?city=london&days=90
// Returns cached flight demand data for a city
router.get("/demand", requireAdminApi, async (req, res) => {
  try {
    const { city, days } = req.query;
    if (!city) {
      return res.status(400).json({ error: "city query param required" });
    }
    const result = await flightService.getFlightDemand(city, parseInt(days) || 90);
    res.json(result);
  } catch (err) {
    logger.error({ msg: "GET /flights/demand error", error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flights/refresh?city=london&days=90
// Triggers a fresh fetch from AeroDataBox (admin only)
router.post("/refresh", requireAdminApi, async (req, res) => {
  try {
    const { city, days } = req.query;
    if (!city) {
      return res.status(400).json({ error: "city query param required" });
    }
    const result = await flightService.refreshFlightDemand(city, parseInt(days) || 90);
    res.json(result);
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
