// /api/routes/budgets.router.js

const express = require('express');
const router = express.Router();
const db = require('../utils/db');
const { requireUserApi } = require('../utils/middleware');
// [MODIFIED] Remove date-fns imports that are no longer needed in this file
// const { parse, subDays, format, isAfter, addDays, getYear, getMonth } = require('date-fns');
// [NEW] Import the new shared benchmark function
const { getBenchmarks } = require('../utils/benchmark.utils');


// GET /api/budgets/:hotelId/:year
// (This endpoint remains unchanged)
router.get('/:hotelId/:year', requireUserApi, async (req, res) => {
  const { hotelId, year } = req.params;
  const internalUserId = req.user.internalId; // User ID from our 'users' table

  // Validate year parameter
  const budgetYear = parseInt(year, 10);
  if (isNaN(budgetYear)) {
    return res.status(400).json({ error: 'Invalid year parameter.' });
  }

  // Validate hotelId parameter
  const propertyId = parseInt(hotelId, 10);
  if (isNaN(propertyId)) {
    return res.status(400).json({ error: 'Invalid hotelId parameter.' });
  }

  const cloudbedsUserId = req.user.cloudbedsId; // Get string ID from middleware
 

  console.log(`[API GET /budgets] Request - Hotel ID: ${propertyId}, Year: ${budgetYear}, User String ID: ${cloudbedsUserId}, User Int ID: ${internalUserId}, Role: ${req.session.role}`);

  try {
    let hasAccess = false;
    if (req.session.role === 'super_admin') {
      console.log(`[API GET /budgets] Access Granted: User is super_admin.`);
      hasAccess = true;
    } else {
      console.log(`[API GET /budgets] DEBUG - Checking access for non-admin user.`);
      const accessCheck = await db.query(
        `SELECT 1 FROM user_properties
         WHERE (user_id = $1 OR user_id = $2::text)
         AND property_id = $3`,
        [cloudbedsUserId, internalUserId, propertyId]
      );
      console.log(`[API GET /budgets] DEBUG - Access check query result row count: ${accessCheck.rows.length}`);
      if (accessCheck.rows.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.warn(`[API GET /budgets] Access Denied - User ${cloudbedsUserId}/${internalUserId} is not super_admin and not linked to property ${propertyId}`);
      return res.status(403).json({ error: 'Forbidden: Access denied to this property.' });
    }

    const budgetResult = await db.query(
      `SELECT
         month,
         target_occupancy,
         target_adr_net,
         target_adr_gross,
         target_revenue_net,
         target_revenue_gross
       FROM hotel_budgets
       WHERE hotel_id = $1 AND budget_year = $2
       ORDER BY month ASC`,
      [propertyId, budgetYear]
    );

    const budgetMap = new Map();
    budgetResult.rows.forEach(row => {
      budgetMap.set(row.month, {
        target_occupancy: row.target_occupancy,
        target_adr_net: row.target_adr_net,
        target_adr_gross: row.target_adr_gross,
        target_revenue_net: row.target_revenue_net,
        target_revenue_gross: row.target_revenue_gross
      });
    });

    const fullBudget = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 1; i <= 12; i++) {
      const monthData = budgetMap.get(i);
      fullBudget.push({
        month: months[i - 1],
        targetOccupancy: monthData?.target_occupancy ?? null,
        targetADR: monthData?.target_adr_gross ?? null,
        targetRevenue: monthData?.target_revenue_gross ?? '',
      });
    }

    console.log(`[API GET /budgets] Success - Found ${budgetResult.rows.length} budget entries for Hotel ${propertyId}, Year ${budgetYear}`);
    res.json(fullBudget);

  } catch (error) {
    console.error(`[API GET /budgets] Error fetching budget for Hotel ${propertyId}, Year ${budgetYear}:`, error);
    res.status(500).json({ error: 'Internal server error while fetching budget.' });
  }
});

// POST /api/budgets/:hotelId/:year
// (This endpoint remains unchanged)
router.post('/:hotelId/:year', requireUserApi, async (req, res) => {
  const { hotelId, year } = req.params;
  const budgetData = req.body;
  const cloudbedsUserId = req.user.cloudbedsId;

  // --- 1. Validate Input ---
  const budgetYear = parseInt(year, 10);
  if (isNaN(budgetYear)) {
    return res.status(400).json({ error: 'Invalid year parameter.' });
  }
  const propertyId = parseInt(hotelId, 10);
  if (isNaN(propertyId)) {
    return res.status(400).json({ error: 'Invalid hotelId parameter.' });
  }
  if (!Array.isArray(budgetData) || budgetData.length !== 12) {
    return res.status(400).json({ error: 'Invalid budget data format. Expected an array of 12 month objects.' });
  }

  console.log(`[API POST /budgets] Request - Hotel ID: ${propertyId}, Year: ${budgetYear}, User ID: ${cloudbedsUserId}`);

  let client;
  try {
    client = await db.connect();
    console.log('[API POST /budgets] Acquired DB client for transaction.');
    await client.query('BEGIN');
    console.log('[API POST /budgets] Transaction started.');

    const internalUserId = req.user.internalId;

    let hasAccess = false;
    if (req.session.role === 'super_admin') {
      console.log(`[API POST /budgets] Access Granted: User is super_admin.`);
      hasAccess = true;
    } else {
      console.log(`[API POST /budgets] DEBUG - Checking access for non-admin user.`);
      const accessCheck = await client.query(
        `SELECT 1 FROM user_properties
         WHERE (user_id = $1 OR user_id = $2::text)
         AND property_id = $3`,
        [cloudbedsUserId, internalUserId, propertyId]
      );
       console.log(`[API POST /budgets] DEBUG - Access check query result row count: ${accessCheck.rows.length}`);
      if (accessCheck.rows.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.warn(`[API POST /budgets] Access Denied - User ${cloudbedsUserId}/${internalUserId} is not super_admin and not linked to property ${propertyId}`);
      throw new Error('Forbidden: Access denied to this property.');
    }

    const hotelResult = await client.query('SELECT tax_rate FROM hotels WHERE hotel_id = $1', [propertyId]);
    if (hotelResult.rows.length === 0) {
      throw new Error('Hotel not found.');
    }
    const taxRateDecimal = hotelResult.rows[0].tax_rate ? parseFloat(hotelResult.rows[0].tax_rate) / 100 : 0;
    console.log(`[API POST /budgets] Using Tax Rate (decimal): ${taxRateDecimal} for Hotel ${propertyId}`);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < budgetData.length; i++) {
        const monthData = budgetData[i];
        const monthNumber = months.indexOf(monthData.month) + 1;

        if (monthNumber === 0) {
            console.error(`[API POST /budgets] Invalid month name received: ${monthData.month}`);
            throw new Error(`Invalid month name: ${monthData.month}`);
        }

        const targetOccupancy = monthData.targetOccupancy !== '' ? parseFloat(monthData.targetOccupancy) : null;
        const targetAdrGrossInput = monthData.targetADR !== '' ? parseFloat(monthData.targetADR) : null;
        const targetRevenueGrossInput = monthData.targetRevenue !== '' ? parseFloat(monthData.targetRevenue) : null;

        if (targetRevenueGrossInput === null || isNaN(targetRevenueGrossInput)) {
            console.warn(`[API POST /budgets] Skipping month ${monthNumber}: Missing or invalid targetRevenue.`);
            continue;
        }

        let targetRevenueGross = targetRevenueGrossInput;
        let targetRevenueNet = targetRevenueGross / (1 + taxRateDecimal);
        let targetAdrGross = targetAdrGrossInput;
        let targetAdrNet = targetAdrGross !== null ? targetAdrGross / (1 + taxRateDecimal) : null;

        const values = [
            propertyId, budgetYear, monthNumber, targetOccupancy, targetAdrNet,
            targetAdrGross, targetRevenueNet, targetRevenueGross
        ];

        const upsertQuery = `
            INSERT INTO hotel_budgets (
              hotel_id, budget_year, month, target_occupancy, target_adr_net,
              target_adr_gross, target_revenue_net, target_revenue_gross, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, NOW()
            )
            ON CONFLICT (hotel_id, budget_year, month) DO UPDATE SET
              target_occupancy = EXCLUDED.target_occupancy,
              target_adr_net = EXCLUDED.target_adr_net,
              target_adr_gross = EXCLUDED.target_adr_gross,
              target_revenue_net = EXCLUDED.target_revenue_net,
              target_revenue_gross = EXCLUDED.target_revenue_gross,
              updated_at = NOW();
        `;
        await client.query(upsertQuery, values);
    } // End loop

    await client.query('COMMIT');
    console.log(`[API POST /budgets] Transaction committed. Budget saved for Hotel ${propertyId}, Year ${budgetYear}`);
    res.status(200).json({ message: `Budget for ${budgetYear} saved successfully.` });

  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log('[API POST /budgets] Transaction rolled back due to error.');
      } catch (rollbackError) {
        console.error('[API POST /budgets] CRITICAL: Failed to rollback transaction:', rollbackError);
      }
    }
    console.error(`[API POST /budgets] Error during budget save transaction for Hotel ${propertyId}, Year ${budgetYear}:`, error);
    if (error.message.startsWith('Forbidden')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.startsWith('Hotel not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error while saving budget.' });
    }
  } finally {
    if (client) {
      client.release();
      console.log('[API POST /budgets] DB client released.');
    }
  }
});


// --- [MODIFIED] Endpoint now uses the shared utility ---
// GET /api/budgets/benchmarks/:hotelId/:month/:year
router.get('/benchmarks/:hotelId/:month/:year', requireUserApi, async (req, res) => {
  const { hotelId, month, year } = req.params;
  const propertyId = parseInt(hotelId, 10);

  // Validate parameters
  if (isNaN(propertyId)) {
    return res.status(400).json({ error: 'Invalid hotelId parameter.' });
  }
  // (Basic validation for month/year, the utility handles parsing)
  if (!month || !year) {
    return res.status(400).json({ error: 'Missing month or year.' });
  }

  try {
    // [MODIFIED] All logic is replaced with a single call
    // to the shared utility function.
    console.log(`[API GET /benchmarks] Fetching benchmarks for ${propertyId}, ${month}, ${year} from shared utility...`);
    
    // The getBenchmarks function handles all logic: L30D, SMLY, defaults, and date parsing.
    const benchmarks = await getBenchmarks(propertyId, month, year);
    
    console.log(`[API GET /benchmarks] Success. Source: ${benchmarks.source}`);
    res.json(benchmarks);

  } catch (error) {
    // Catch errors from the utility (e.g., bad date parse) or DB
    console.error(`[API GET /benchmarks] Error fetching benchmarks for Hotel ${propertyId}, ${month} ${year}:`, error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
});

module.exports = router;