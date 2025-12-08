const express = require("express");
const router = express.Router();
const MarketService = require("../services/market.service");
const { requireUserApi, requireAdminApi } = require("../utils/middleware");

// --- 1. MARKET DATA (Trends, KPIs, Neighborhoods) ---

router.get("/trends", requireUserApi, async (req, res) => {
  try {
    const { city, years } = req.query;
    if (!city || !years) return res.status(400).json({ error: "City and years required." });
    
    // Parse tiers
    const tierArray = req.query.tiers
      ? Array.isArray(req.query.tiers) ? req.query.tiers : [req.query.tiers]
      : null;

    const data = await MarketService.getMarketTrends(city, years, tierArray);
    res.json(data);
  } catch (error) {
    console.error("Error in /api/market/trends:", error);
    res.status(500).json({ error: "Failed to fetch market trends." });
  }
});

router.get("/kpis", requireUserApi, async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: "City required." });
    
    const data = await MarketService.getMarketKPIs(city);
    res.json(data);
  } catch (error) {
    console.error("Error in /api/market/kpis:", error);
    res.status(500).json({ error: "Failed to fetch market KPIs." });
  }
});

router.get("/neighborhoods", requireUserApi, async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: "City required." });

    const data = await MarketService.getNeighborhoods(city);
    res.json(data);
  } catch (error) {
    console.error("Error in /api/market/neighborhoods:", error);
    res.status(500).json({ error: "Failed to fetch neighborhoods." });
  }
});

router.get("/available-seasonality-years", requireUserApi, async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) return res.status(400).json({ error: "City required." });

    const data = await MarketService.getAvailableSeasonalityYears(city);
    res.json(data);
  } catch (error) {
    console.error("Error in /api/market/available-seasonality-years:", error);
    res.status(500).json({ error: "Failed to fetch years." });
  }
});

router.get("/seasonality", requireUserApi, async (req, res) => {
  try {
    const { city, year } = req.query;
    if (!city || !year) return res.status(400).json({ error: "City and year required." });

    const data = await MarketService.getSeasonalityData(city, year);
    res.json(data);
  } catch (error) {
    console.error("Error in /api/market/seasonality:", error);
    res.status(500).json({ error: "Failed to fetch seasonality." });
  }
});

// --- 2. PLANNING DATA (Forward View, Pace, Outlook) ---
// Migrated from planning.router.js

router.get('/forward-view', requireUserApi, async (req, res) => {
  try {
    const city = req.query.city || 'london';
    const data = await MarketService.getForwardView(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /api/market/forward-view:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/outlook', requireUserApi, async (req, res) => {
  // Previously /market-trend
  try {
    const city = req.query.city || 'london';
    const data = await MarketService.getMarketOutlook(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /api/market/outlook:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/pace', requireUserApi, async (req, res) => {
  try {
    const city = req.query.city || 'london';
    const period = parseInt(req.query.period, 10) || 7;
    
    const data = await MarketService.getPaceData(city, period);
    res.json(data);
  } catch (err) {
    console.error('Error in /api/market/pace:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', requireUserApi, async (req, res) => {
  try {
    const city = 'london'; // Hardcoded in original
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required.' });

    const data = await MarketService.getScrapeHistory(city, date);
    res.json(data);
  } catch (err) {
    console.error('Error in /api/market/history:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- 3. SHADOWFAX (Scraper Tools) ---
// Migrated from scraper.router.js

router.get('/shadowfax/properties', requireAdminApi, async (req, res) => {
  try {
    const data = await MarketService.getSentinelProperties();
    res.json(data);
  } catch (err) {
    console.error('Error in /api/market/shadowfax/properties', err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/shadowfax/price', requireAdminApi, async (req, res) => {
  try {
    const { hotelId, checkinDate } = req.body;
    if (!hotelId || !checkinDate) return res.status(400).json({ error: 'Missing parameters.' });

    const data = await MarketService.checkAssetPrice(hotelId, checkinDate);
    res.json(data);
  } catch (error) {
    console.error(`Shadowfax Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;