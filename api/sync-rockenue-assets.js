// Import the database connection utility
// We assume the db.js utility is in the /api/utils/ directory
const db = require('./utils/db'); 

/**
 * Vercel Serverless Function (Cron Job)
 * * This script runs daily to synchronize the 'hotels' table with the
 * 'rockenue_managed_assets' table.
 * * It finds any hotel marked as 'is_rockenue_managed = true' in the main
 * 'hotels' table and ensures it has a corresponding entry in the
 * 'rockenue_managed_assets' table for financial tracking.
 * * This allows staff to use the Admin Panel toggle, and the financial
 * data is automatically pre-populated for a super_admin to update later.
 */
module.exports = async (req, res) => {
  // Simple auth check (optional but recommended for cron jobs)
  // You could set a 'CRON_SECRET' in your Vercel .env
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).send('Unauthorized');
  // }

  let client;
  try {
 client = await db.connect(); // Get a client from our db.js pool
    console.log('Running daily Rockenue asset sync...');

    // This is the core logic.
    // It finds all 'hotel_id's from 'hotels' where 'is_rockenue_managed' is true
    // AND that 'hotel_id' does not already exist in 'rockenue_managed_assets'.
    //
    // It then inserts the missing hotels into 'rockenue_managed_assets'
    // with a default 'monthly_fee' of 0.
    const query = `
      INSERT INTO rockenue_managed_assets (
          market_pulse_hotel_id, 
          asset_name, 
          city, 
          total_rooms, 
          management_group,
          monthly_fee
      )
      SELECT 
          h.hotel_id, 
          h.property_name, 
          h.city, 
          h.total_rooms, 
          h.management_group,
          0.00 -- Default monthly_fee
      FROM 
          hotels h
      LEFT JOIN 
          rockenue_managed_assets rma ON h.hotel_id = rma.market_pulse_hotel_id
      WHERE 
          h.is_rockenue_managed = true 
          AND rma.market_pulse_hotel_id IS NULL; -- The magic: only insert if missing
    `;

    const result = await client.query(query);

    const newAssetsCount = result.rowCount;
    console.log(`Rockenue Asset Sync Complete. Added ${newAssetsCount} new assets.`);

    // Send a success response
    res.status(200).json({ 
      message: `Sync complete. Added ${newAssetsCount} new assets.` 
    });

  } catch (error) {
    console.error('Error during Rockenue asset sync:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
};