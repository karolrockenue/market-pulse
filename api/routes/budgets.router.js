const express = require('express');
const router = express.Router();
const db = require('../utils/db'); // Assuming db utils path
const { requireUserApi } = require('../utils/middleware'); // [FIX] Use the correct middleware function name
const { parse, subDays, format, isAfter, addDays, getYear, getMonth } = require('date-fns'); // [NEW] Add date-fns
// Placeholder GET endpoint
// GET /api/budgets/:hotelId/:year
// GET /api/budgets/:hotelId/:year
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

 // budgets.router.js - GET handler
  const cloudbedsUserId = req.user.cloudbedsId; // Get string ID from middleware
 

  console.log(`[API GET /budgets] Request - Hotel ID: ${propertyId}, Year: ${budgetYear}, User String ID: ${cloudbedsUserId}, User Int ID: ${internalUserId}, Role: ${req.session.role}`);

  try {
    // [FIX] Add check for super_admin role BEFORE checking user_properties
    let hasAccess = false;
    if (req.session.role === 'super_admin') {
      console.log(`[API GET /budgets] Access Granted: User is super_admin.`);
      hasAccess = true; // Super admins bypass the property link check
    } else {
      // [FIX] For non-admins, check user_properties using BOTH user IDs, mirroring dashboard.router.js logic
      console.log(`[API GET /budgets] DEBUG - Checking access for non-admin user.`);
      const accessCheck = await db.query(
        `SELECT 1 FROM user_properties
         WHERE (user_id = $1 OR user_id = $2::text) -- Check string OR integer (cast to text) ID
         AND property_id = $3`,
        [cloudbedsUserId, internalUserId, propertyId] // Pass both IDs
      );
      console.log(`[API GET /budgets] DEBUG - Access check query result row count: ${accessCheck.rows.length}`);
      if (accessCheck.rows.length > 0) {
        hasAccess = true; // User is linked via one of the IDs
      }
    }

    // If access check failed (neither super_admin nor linked)
    if (!hasAccess) {
      console.warn(`[API GET /budgets] Access Denied - User ${cloudbedsUserId}/${internalUserId} is not super_admin and not linked to property ${propertyId}`);
      return res.status(403).json({ error: 'Forbidden: Access denied to this property.' });
    }

    // 2. Fetch budget data... (rest of the handler remains the same)
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

    // 3. Format the response: Ensure all 12 months are present
    const budgetMap = new Map();
    budgetResult.rows.forEach(row => {
      budgetMap.set(row.month, {
        target_occupancy: row.target_occupancy, // Keep as string or null from DB
        target_adr_net: row.target_adr_net,     // Keep as string or null from DB
        target_adr_gross: row.target_adr_gross, // Keep as string or null from DB
        target_revenue_net: row.target_revenue_net, // Keep as string from DB
        target_revenue_gross: row.target_revenue_gross // Keep as string from DB
      });
    });

    const fullBudget = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 1; i <= 12; i++) {
      const monthData = budgetMap.get(i);
      fullBudget.push({
        month: months[i - 1], // Use month name like the frontend expects
        // Return null for optional fields if not found, empty string otherwise (matching frontend init state)
        targetOccupancy: monthData?.target_occupancy ?? null, // Match frontend type MonthBudgetData
        targetADR: monthData?.target_adr_gross ?? null,      // Default to returning GROSS ADR for now
        targetRevenue: monthData?.target_revenue_gross ?? '', // Default to returning GROSS Revenue

        // Add net values if needed by frontend later
        // targetADRNet: monthData?.target_adr_net ?? null,
        // targetRevenueNet: monthData?.target_revenue_net ?? ''
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
router.post('/:hotelId/:year', requireUserApi, async (req, res) => {
  const { hotelId, year } = req.params;
  const budgetData = req.body; // Expects an array of 12 month objects { month, targetOccupancy, targetADR, targetRevenue }
  const cloudbedsUserId = req.user.cloudbedsId; // Use cloudbeds ID for access check

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

  // --- MODIFICATION START: Use db.connect() for transaction ---
  let client; // Define client outside try block for access in finally
  try {
    // --- Acquire a client connection from the pool ---
    client = await db.connect(); // Use connect() on the exported pool instance
    console.log('[API POST /budgets] Acquired DB client for transaction.');

    // --- Start Transaction ---
    await client.query('BEGIN'); // Use client.query now
    console.log('[API POST /budgets] Transaction started.');

 // budgets.router.js - POST handler
// budgets.router.js - POST handler
    // --- [FIX] Verify User Access (using client) ---
    const internalUserId = req.user.internalId; // <<<--- ADD THIS LINE to get integer ID

    // [FIX] Add check for super_admin role BEFORE checking user_properties
    let hasAccess = false;
    if (req.session.role === 'super_admin') {
      console.log(`[API POST /budgets] Access Granted: User is super_admin.`);
      hasAccess = true;
    } else {
      // [FIX] For non-admins, check using BOTH user IDs
      console.log(`[API POST /budgets] DEBUG - Checking access for non-admin user.`);
      const accessCheck = await client.query(
        `SELECT 1 FROM user_properties
         WHERE (user_id = $1 OR user_id = $2::text) -- Check string OR integer (cast to text) ID
         AND property_id = $3`,
        [cloudbedsUserId, internalUserId, propertyId] // Pass both IDs
      );
       console.log(`[API POST /budgets] DEBUG - Access check query result row count: ${accessCheck.rows.length}`);
      if (accessCheck.rows.length > 0) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.warn(`[API POST /budgets] Access Denied - User ${cloudbedsUserId}/${internalUserId} is not super_admin and not linked to property ${propertyId}`);
      // Throw an error to jump to the catch block for rollback
      throw new Error('Forbidden: Access denied to this property.');
    }

    // --- Fetch Hotel's Tax Rate (using client) --- (rest of the handler remains the same)
    const hotelResult = await client.query('SELECT tax_rate FROM hotels WHERE hotel_id = $1', [propertyId]);
    if (hotelResult.rows.length === 0) {
      // Throw an error to jump to the catch block for rollback
      throw new Error('Hotel not found.');
    }
    const taxRateDecimal = hotelResult.rows[0].tax_rate ? parseFloat(hotelResult.rows[0].tax_rate) / 100 : 0;
    console.log(`[API POST /budgets] Using Tax Rate (decimal): ${taxRateDecimal} for Hotel ${propertyId}`);

    // --- Loop Through Months and Upsert Data (using client) ---
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 0; i < budgetData.length; i++) {
        const monthData = budgetData[i];
        const monthNumber = months.indexOf(monthData.month) + 1;

        if (monthNumber === 0) {
            console.error(`[API POST /budgets] Invalid month name received: ${monthData.month}`);
            throw new Error(`Invalid month name: ${monthData.month}`); // Throw to trigger rollback
        }

        const targetOccupancy = monthData.targetOccupancy !== '' ? parseFloat(monthData.targetOccupancy) : null;
        const targetAdrGrossInput = monthData.targetADR !== '' ? parseFloat(monthData.targetADR) : null;
        const targetRevenueGrossInput = monthData.targetRevenue !== '' ? parseFloat(monthData.targetRevenue) : null;

        if (targetRevenueGrossInput === null || isNaN(targetRevenueGrossInput)) {
            console.warn(`[API POST /budgets] Skipping month ${monthNumber}: Missing or invalid targetRevenue.`);
            continue; // Skip this month
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
        // Use client.query for upsert
        await client.query(upsertQuery, values);
    } // End loop

    // --- Commit Transaction ---
    await client.query('COMMIT'); // Use client.query
    console.log(`[API POST /budgets] Transaction committed. Budget saved for Hotel ${propertyId}, Year ${budgetYear}`);
    res.status(200).json({ message: `Budget for ${budgetYear} saved successfully.` });

  } catch (error) {
    // --- Handle Errors: Attempt Rollback ---
    if (client) { // Check if client was successfully acquired before trying to rollback
      try {
        await client.query('ROLLBACK'); // Use client.query
        console.log('[API POST /budgets] Transaction rolled back due to error.');
      } catch (rollbackError) {
        console.error('[API POST /budgets] CRITICAL: Failed to rollback transaction:', rollbackError);
      }
    }
    // Log the original error that caused the rollback
    console.error(`[API POST /budgets] Error during budget save transaction for Hotel ${propertyId}, Year ${budgetYear}:`, error);
    // Respond with appropriate status based on thrown error
    if (error.message.startsWith('Forbidden')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.startsWith('Hotel not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error while saving budget.' });
    }
  } finally {
    // --- Release Client ---
    // Ensure the client connection is always released back to the pool
    if (client) {
      client.release();
      console.log('[API POST /budgets] DB client released.');
    }
  }
  // --- MODIFICATION END ---
});

// [NEW] Endpoint to get benchmark Occ/ADR for pacing logic
// GET /api/budgets/benchmarks/:hotelId/:month/:year
router.get('/benchmarks/:hotelId/:month/:year', requireUserApi, async (req, res) => {
  const { hotelId, month, year } = req.params;
  const propertyId = parseInt(hotelId, 10);

  // --- 1. Determine Target Date and Date Range ---
  let targetDate;
  try {
    // Parse the date. e.g., "Mar 2026" -> 2026-03-01
    targetDate = parse(`${month} ${year}`, 'MMM yyyy', new Date());
  } catch (e) {
    return res.status(400).json({ error: 'Invalid month or year.' });
  }
  
  // 'now' is today (e.g., Oct 27, 2025)
  const now = new Date(); 
  // 'nearTermLimit' is 90 days from now (e.g., Jan 25, 2026)
  const nearTermLimit = addDays(now, 90); 

  // Default benchmarks
  const defaultBenchmarks = {
    benchmarkOcc: 75.0, // Our 75% default
    benchmarkAdr: 120.0, // Our £120 default
    source: 'default'
  };

  try {
    let benchmarks = null;

    // --- 2. Logic for Near-Term Months (e.g., Nov 2025) ---
    // If targetDate is before Jan 25, 2026
    if (!isAfter(targetDate, nearTermLimit)) {
      // Try to get "Last 30 Days" (L30D) benchmarks
 const l30dQuery = `
        SELECT
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS occ,
          SUM(gross_revenue)::numeric / NULLIF(SUM(rooms_sold), 0) AS adr
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1
          AND stay_date BETWEEN (NOW() - '30 days'::interval) AND NOW() -- [FIXED] Was stay_date
          AND capacity_count > 0;
      `;
      const l30dResult = await db.query(l30dQuery, [propertyId]);
      
      if (l30dResult.rows.length > 0 && l30dResult.rows[0].occ) {
        benchmarks = {
          benchmarkOcc: parseFloat(l30dResult.rows[0].occ),
          benchmarkAdr: parseFloat(l30dResult.rows[0].adr),
          source: 'l30d'
        };
      }
    }

    // --- 3. Logic for Distant-Future (or if L30D failed) ---
    // If benchmarks are still null (either distant-future or L30D had no data)
    if (!benchmarks) {
      // Try to get "Same Month Last Year" (SMLY) benchmarks
      const targetYearSMLY = getYear(targetDate) - 1; // e.g., 2025
      const targetMonthSMLY = getMonth(targetDate) + 1; // e.g., 3 (for March)
      
      const smlyQuery = `
        SELECT
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS occ,
          SUM(gross_revenue)::numeric / NULLIF(SUM(rooms_sold), 0) AS adr
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1
          AND EXTRACT(YEAR FROM stay_date) = $2
          AND EXTRACT(MONTH FROM stay_date) = $3
          AND capacity_count > 0;
      `;
      const smlyResult = await db.query(smlyQuery, [propertyId, targetYearSMLY, targetMonthSMLY]);

      if (smlyResult.rows.length > 0 && smlyResult.rows[0].occ) {
        benchmarks = {
          benchmarkOcc: parseFloat(smlyResult.rows[0].occ),
          benchmarkAdr: parseFloat(smlyResult.rows[0].adr),
          source: 'smly'
        };
      }
    }

    // --- 4. Final Fallback ---
    if (!benchmarks) {
      benchmarks = defaultBenchmarks;
    }

    res.json(benchmarks);

  } catch (error) {
    console.error(`[API GET /benchmarks] Error fetching benchmarks for Hotel ${propertyId}, ${month} ${year}:`, error);
    res.status(500).json({ error: 'Internal server error while fetching benchmarks.' });
  }
});
module.exports = router;