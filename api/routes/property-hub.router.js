const express = require('express');
const router = express.Router();
const pool = require('../utils/db');
const { requireAdminApi } = require('../utils/middleware'); // <-- Import permissive middleware

// Protect all routes in this file
router.use(requireAdminApi); // <-- Use permissive middleware

// GET /api/property-hub/assets
// Fetches assets JOINED with their Sentinel Configuration
router.get('/assets', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         rma.id,
         rma.asset_name,
         rma.market_pulse_hotel_id,
         rma.sentinel_active,
         rma.booking_com_url,
         rma.genius_discount_pct,
         rma.min_rate,
         rma.max_rate,
         -- Sentinel Config Columns
         sc.strategic_multiplier,
         sc.calculator_settings
       FROM rockenue_managed_assets rma
       LEFT JOIN hotels h ON rma.market_pulse_hotel_id = h.hotel_id::text
       LEFT JOIN sentinel_configurations sc ON h.hotel_id = sc.hotel_id
       ORDER BY rma.asset_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching property hub assets', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// PUT /api/property-hub/assets/:assetId
// Updates both Rockenue Asset AND Sentinel Configuration
router.put('/assets/:assetId', async (req, res) => {
  const { assetId } = req.params;
  const {
    // Asset Fields
    booking_com_url,
    genius_discount_pct,
    // Calculator Fields
    strategic_multiplier,
    calculator_settings
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Update Rockenue Managed Asset
    const assetResult = await client.query(
      `UPDATE rockenue_managed_assets
       SET
         booking_com_url = $1,
         genius_discount_pct = $2
       WHERE id = $3
       RETURNING *`,
      [
        booking_com_url,
        genius_discount_pct || 0,
        assetId
      ]
    );

    if (assetResult.rows.length === 0) {
      throw new Error('Asset not found');
    }

    const updatedAsset = assetResult.rows[0];

    // 2. If linked to a real hotel, update Sentinel Configuration
    if (updatedAsset.market_pulse_hotel_id) {
        // We need the integer hotel_id
        const hotelRes = await client.query(
            `SELECT hotel_id FROM hotels WHERE hotel_id::text = $1`,
            [updatedAsset.market_pulse_hotel_id]
        );

        if (hotelRes.rows.length > 0) {
            const hotelId = hotelRes.rows[0].hotel_id;

            // UPSERT into sentinel_configurations
            await client.query(
                `INSERT INTO sentinel_configurations
                 (hotel_id, strategic_multiplier, calculator_settings)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (hotel_id)
                 DO UPDATE SET
                    strategic_multiplier = EXCLUDED.strategic_multiplier,
                    calculator_settings = EXCLUDED.calculator_settings`,
                [
                    hotelId,
                    strategic_multiplier || 1.3,
                    calculator_settings || {}
                ]
            );
        }
    }

    await client.query('COMMIT');
    
    // Return the combined object so frontend state updates correctly
    res.status(200).json({
        ...updatedAsset,
        strategic_multiplier,
        calculator_settings
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating asset config', err);
    res.status(500).json({ error: 'Failed to update asset' });
  } finally {
    client.release();
  }
});

module.exports = router;