const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireAdminApi } = require('../utils/middleware');
const { getHotelPrice } = require('../utils/scraper.utils.js');

// Protect all routes in this file
router.use(requireAdminApi);

/**
 * GET /api/scraper/sentinel-properties
 * Fetches a siloed list of properties for the Shadowfax tool.
 * Reads from the super_admin "master" asset table.
 */
router.get('/sentinel-properties', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         id AS property_id,
         asset_name AS property_name,
         genius_discount_pct
       FROM rockenue_managed_assets
       WHERE sentinel_active = true
       ORDER BY asset_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sentinel properties', err);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});


/**
 * POST /api/scraper/get-price
 * Body: { hotelId: string (UUID), checkinDate: string }
 */
router.post('/get-price', async (req, res) => {
  const { hotelId, checkinDate } = req.body;

  if (!hotelId || !checkinDate) {
    return res.status(400).json({ error: 'Missing hotelId or checkinDate.' });
  }

  try {
    // 1. Fetch the asset's booking_com_url from the database
    const assetQuery = await db.query(
      'SELECT booking_com_url FROM rockenue_managed_assets WHERE id = $1',
      [hotelId]
    );

    const asset = assetQuery.rows[0];

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    if (!asset.booking_com_url) {
      return res.status(400).json({
        error: 'This asset is not configured for price checking. (Missing booking_com_url)',
      });
    }

    // 2. Call the Shadowfax "Logic Hub"
    console.log(`Shadowfax: Initiating price check for asset ${hotelId} on ${checkinDate}`);
    // 'price' is the complex object { price, roomName } returned from the util
    const price = await getHotelPrice(asset.booking_com_url, checkinDate);

    // 3. Return the result
    return res.json({
      hotelId,
      checkinDate,
      price, // Return the whole object, as the new frontend expects
    });
    
  } catch (error) {
    console.error(`Shadowfax API Error (/get-price): ${error.message}`);
    return res.status(500).json({
      error: `Scrape failed: ${error.message}`,
    });
  }
});

module.exports = router;