const express = require("express");
const router = express.Router();
const MarketService = require("../services/market.service");
const pool = require("../utils/db");
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

router.get("/accommodation-map", requireUserApi, async (req, res) => {
  try {
    const { citySlug } = req.query;
    if (!citySlug) return res.status(400).json({ error: "citySlug is required." });
    const data = await MarketService.getAccommodationMap(citySlug);
    res.json(data);
  } catch (error) {
    console.error("Error in /accommodation-map:", error);
    res.status(500).json({ error: "Failed to fetch accommodation map data." });
  }
});

router.get("/events", requireUserApi, async (req, res) => {
  try {
    const { citySlug } = req.query;
    if (!citySlug) return res.status(400).json({ error: "citySlug is required." });
    const data = await MarketService.getPredictHQEvents(citySlug);
    res.json(data);
  } catch (error) {
    console.error("Error in /events:", error);
    res.status(500).json({ error: "Failed to fetch event data." });
  }
});

router.get("/airbnb-availability", requireUserApi, async (req, res) => {
  try {
    const { citySlug } = req.query;
    if (!citySlug) return res.status(400).json({ error: "citySlug is required." });

    const { rows } = await pool.query(
      `SELECT checkin_date, total_listings, avg_price, median_price, listings
       FROM airbnb_availability_snapshots
       WHERE city_slug = $1
         AND scraped_at = (
           SELECT MAX(scraped_at) FROM airbnb_availability_snapshots WHERE city_slug = $1
         )
       ORDER BY checkin_date ASC`,
      [citySlug]
    );

    res.json({ citySlug, snapshots: rows });
  } catch (error) {
    console.error("Error in /airbnb-availability:", error);
    res.status(500).json({ error: "Failed to fetch Airbnb availability data." });
  }
});

router.get("/airbnb-scrape-history", requireUserApi, async (req, res) => {
  try {
    const { citySlug } = req.query;
    if (!citySlug) return res.status(400).json({ error: "citySlug is required." });

    const { rows } = await pool.query(
      `SELECT
         scraped_at::date AS scrape_date,
         MIN(scraped_at) AS started_at,
         MAX(scraped_at) AS finished_at,
         COUNT(DISTINCT checkin_date) AS dates_scraped,
         ROUND(AVG(total_listings)) AS avg_listings,
         ROUND(AVG(avg_price), 2) AS avg_price
       FROM airbnb_availability_snapshots
       WHERE city_slug = $1
       GROUP BY scraped_at::date
       ORDER BY scrape_date DESC
       LIMIT 7`,
      [citySlug]
    );

    res.json({ citySlug, scrapes: rows });
  } catch (error) {
    console.error("Error in /airbnb-scrape-history:", error);
    res.status(500).json({ error: "Failed to fetch scrape history." });
  }
});

router.get("/airbnb-registry", requireUserApi, async (req, res) => {
  try {
    const { citySlug } = req.query;
    if (!citySlug) return res.status(400).json({ error: "citySlug is required." });

    const { rows } = await pool.query(
      `SELECT
         listing->>'id' AS property_id,
         listing->>'name' AS name,
         listing->>'type' AS type,
         listing->>'beds' AS beds,
         listing->>'location' AS location,
         (listing->>'lat')::numeric AS lat,
         (listing->>'lng')::numeric AS lng,
         MAX((listing->>'rating')::numeric) AS rating,
         MAX((listing->>'reviews')::int) AS reviews,
         ROUND(AVG((listing->>'price')::numeric), 2) AS avg_price,
         MIN((listing->>'price')::numeric) AS min_price,
         MAX((listing->>'price')::numeric) AS max_price,
         COUNT(DISTINCT s.scraped_at::date) AS times_seen,
         MIN(s.scraped_at::date) AS first_seen,
         MAX(s.scraped_at::date) AS last_seen
       FROM airbnb_availability_snapshots s,
            jsonb_array_elements(s.listings) AS listing
       WHERE s.city_slug = $1
       GROUP BY listing->>'id', listing->>'name', listing->>'type',
                listing->>'beds', listing->>'location',
                (listing->>'lat')::numeric, (listing->>'lng')::numeric
       ORDER BY avg_price DESC`,
      [citySlug]
    );

    res.json({ citySlug, totalProperties: rows.length, properties: rows });
  } catch (error) {
    console.error("Error in /airbnb-registry:", error);
    res.status(500).json({ error: "Failed to fetch Airbnb property registry." });
  }
});

router.get("/neighbourhood-supply", requireUserApi, async (req, res) => {
  try {
    const { citySlug } = req.query;
    if (!citySlug) return res.status(400).json({ error: "citySlug is required." });
    const data = await MarketService.getNeighbourhoodSupply(citySlug);
    res.json(data);
  } catch (error) {
    console.error("Error in /neighbourhood-supply:", error);
    res.status(500).json({ error: "Failed to fetch neighbourhood supply." });
  }
});

router.get("/market-baseline", requireUserApi, async (req, res) => {
  try {
    const city = req.query.city || "london";
    const data = await MarketService.getMarketBaseline(city);
    res.json(data || {});
  } catch (error) {
    console.error("Error in /market-baseline:", error);
    res.status(500).json({ error: "Failed to fetch market baseline." });
  }
});

// --- 4. DEMAND RADAR (Booking behavior + Hotel OTB) ---

router.get("/booking-behavior", requireUserApi, async (req, res) => {
  try {
    const hotelIds = req.query.hotelIds;
    if (!hotelIds) return res.status(400).json({ error: "hotelIds required (comma-separated)." });
    const ids = hotelIds.split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (!ids.length) return res.status(400).json({ error: "No valid hotelIds." });
    const data = await MarketService.getBookingBehavior(ids);
    res.json(data);
  } catch (error) {
    console.error("Error in /booking-behavior:", error);
    res.status(500).json({ error: "Failed to fetch booking behavior." });
  }
});

router.get("/hotel-otb", requireUserApi, async (req, res) => {
  try {
    const hotelIds = req.query.hotelIds;
    if (!hotelIds) return res.status(400).json({ error: "hotelIds required (comma-separated)." });
    const ids = hotelIds.split(",").map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (!ids.length) return res.status(400).json({ error: "No valid hotelIds." });
    const data = await MarketService.getHotelOtb(ids);
    res.json(data);
  } catch (error) {
    console.error("Error in /hotel-otb:", error);
    res.status(500).json({ error: "Failed to fetch hotel OTB data." });
  }
});

// --- 5. MARKET PROFILE (City-level analytics) ---

router.get('/profile/overview', requireAdminApi, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City required.' });
    const data = await MarketService.getProfileOverview(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/overview:', err);
    res.status(500).json({ error: 'Failed to fetch profile overview.' });
  }
});

router.get('/profile/seasonal', requireAdminApi, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City required.' });
    const data = await MarketService.getProfileSeasonal(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/seasonal:', err);
    res.status(500).json({ error: 'Failed to fetch seasonal data.' });
  }
});

router.get('/profile/absorption-dow', requireAdminApi, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City required.' });
    const data = await MarketService.getProfileAbsorptionDow(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/absorption-dow:', err);
    res.status(500).json({ error: 'Failed to fetch absorption data.' });
  }
});

router.get('/profile/price-movement', requireAdminApi, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City required.' });
    const data = await MarketService.getProfilePriceMovement(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/price-movement:', err);
    res.status(500).json({ error: 'Failed to fetch price movement.' });
  }
});

router.get('/profile/absorption-date', requireAdminApi, async (req, res) => {
  try {
    const { city, date } = req.query;
    if (!city || !date) return res.status(400).json({ error: 'City and date required.' });
    const data = await MarketService.getProfileAbsorptionDate(city, date);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/absorption-date:', err);
    res.status(500).json({ error: 'Failed to fetch absorption curve.' });
  }
});

router.get('/profile/compression', requireAdminApi, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City required.' });
    const data = await MarketService.getProfileCompression(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/compression:', err);
    res.status(500).json({ error: 'Failed to fetch compression data.' });
  }
});

router.get('/profile/neighbourhoods', requireAdminApi, async (req, res) => {
  try {
    const city = req.query.city;
    if (!city) return res.status(400).json({ error: 'City required.' });
    const data = await MarketService.getProfileNeighbourhoods(city);
    res.json(data);
  } catch (err) {
    console.error('Error in /profile/neighbourhoods:', err);
    res.status(500).json({ error: 'Failed to fetch neighbourhood data.' });
  }
});

module.exports = router;