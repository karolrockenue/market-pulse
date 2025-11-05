// /api/routes/dashboard.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// Helper function to get the period for SQL queries
const getPeriod = (granularity) => {
  if (granularity === "monthly") return "date_trunc('month', stay_date)";
  if (granularity === "weekly") return "date_trunc('week', stay_date)";
  return "stay_date";
};

// --- USER PROFILE API ENDPOINTS ---
router.get("/user/profile", requireUserApi, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT first_name, last_name, email FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error in /api/user/profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

router.put("/user/profile", requireUserApi, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (typeof firstName !== "string" || typeof lastName !== "string") {
      return res
        .status(400)
        .json({ error: "First name and last name must be strings." });
    }
    const result = await pgPool.query(
      "UPDATE users SET first_name = $1, last_name = $2 WHERE cloudbeds_user_id = $3 RETURNING first_name, last_name",
      [firstName, lastName, req.session.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found to update." });
    }
    res.status(200).json({
      message: "Profile updated successfully.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating /api/user/profile:", error);
    res.status(500).json({ error: "Failed to update user profile." });
  }
});

// --- DASHBOARD API ENDPOINTS ---

router.get("/my-properties", requireUserApi, async (req, res) => {
  try {
    // --- FIX: Check for the 'super_admin' role instead of the old isAdmin flag ---
    if (req.session.role === "super_admin") {
      // If the user is a super_admin, fetch all hotels directly from the hotels table.
      // This ensures they can see every property in the system.
      const query = `
        SELECT 
          hotel_id AS property_id, 
          property_name,
          city /* Add this line to select the city */
        FROM hotels
        ORDER BY property_name;
      `;
      const result = await pgPool.query(query);
      return res.json(result.rows);
    } else {
      // For regular users, we must find their properties by looking for EITHER their
      // original cloudbeds_user_id OR their internal user_id in the user_properties table.

      // Step 1: Get the logged-in user's internal integer ID from the users table.
      const userResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );

      // If the user in the session doesn't exist in the users table, they have no properties.
      if (userResult.rows.length === 0) {
        return res.json([]);
      }
      const internalUserId = userResult.rows[0].user_id;

      // Step 2: Use both the session ID (cloudbeds_user_id) and the internal ID to find all linked properties.
      const query = `
        SELECT 
          up.property_id, 
          h.property_name,
          h.city
        FROM user_properties up
        JOIN hotels h ON up.property_id = h.hotel_id
        WHERE up.user_id = $1 OR up.user_id = $2::text
        ORDER BY h.property_name;
      `;
      const result = await pgPool.query(query, [
        req.session.userId,
        internalUserId,
      ]);
      return res.json(result.rows);
    }
  } catch (error) {
    console.error("Error in /api/my-properties:", error);
    res.status(500).json({ error: "Failed to fetch user properties." });
  }
});

router.get("/hotel-details/:propertyId", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // --- FIX: Check for 'super_admin' role to bypass the ownership check ---
    // Security check to ensure the user has access to the requested property.
    if (req.session.role !== "super_admin") {
      // Step 1: Get the user's internal integer ID from their session ID.
      // This is necessary because the user_properties table can link via either the string-based cloudbeds_user_id or the internal user_id.
      const userResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );

      // If the user doesn't exist in our system, deny access.
      if (userResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied: User not found." });
      }
      const internalUserId = userResult.rows[0].user_id;

      // Step 2: Check if a link exists in user_properties using EITHER the session ID or the internal ID.
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE (user_id = $1 OR user_id = $2::text) AND property_id = $3",
        [req.session.userId, internalUserId, propertyId]
      );

      // If no link is found, the user is not authorized for this property.
      if (accessCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
      }
    }

// Fetches hotel details.
    // [FIX] Add 'city' and 'hotel_id' to the SELECT statement.
    // 'city' is required by DemandPace.tsx for its market data API call.
    // 'total_rooms' is no longer needed for DemandPace, but 'hotel_id' is good practice.
    const hotelResult = await pgPool.query(
      `SELECT 
         property_name, currency_code, tax_rate, tax_type, tax_name, category,
         city, hotel_id 
       FROM hotels 
       WHERE hotel_id = $1`,
      [propertyId]
    );
    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel details not found." });
    }
    res.json(hotelResult.rows[0]);
  } catch (error) {
    console.error("Error in /api/hotel-details:", error);
    res.status(500).json({ error: "Failed to fetch hotel details." });
  }
});

router.get("/sync-status/:propertyId", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // --- IMPORTANT: prevent any edge/proxy/browser caching of sync status.
    // Stale 'false' here causes the spinner to never clear even though data exists.
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    // --- FIX: Check for 'super_admin' role to bypass the ownership check ---
    // Security check to ensure the user has access to the requested property.
    if (req.session.role !== "super_admin") {
      // Step 1: Get the user's internal integer ID from their session ID.
      // This is necessary because the user_properties table can link via either the string-based cloudbeds_user_id or the internal user_id.
      const userResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );

      // If the user doesn't exist in our system, deny access.
      if (userResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied: User not found." });
      }
      const internalUserId = userResult.rows[0].user_id;

      // Step 2: Check for a link using EITHER ID, and explicitly cast the incoming string propertyId to an integer.
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE (user_id = $1 OR user_id = $2::text) AND property_id = $3::integer",
        [req.session.userId, internalUserId, propertyId]
      );

      // If no link is found, the user is not authorized for this property.
      if (accessCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
      }
    }

    const syncCheck = await pgPool.query(
      // **THE FIX**: Explicitly cast the incoming propertyId parameter to an integer.
      // This ensures we are comparing a number to a number, fixing the bug.
      "SELECT 1 FROM daily_metrics_snapshots WHERE hotel_id = $1::integer LIMIT 1",
      [propertyId]
    );
    res.json({ isSyncComplete: syncCheck.rows.length > 0 });
  } catch (error) {
    console.error("Error in /api/sync-status:", error);
    res.status(500).json({ error: "Failed to fetch sync status." });
  }
});

router.get("/last-refresh-time", requireUserApi, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT value FROM system_state WHERE key = 'last_successful_refresh'"
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Last refresh time not found." });
    res.json({ last_successful_run: result.rows[0].value.timestamp });
  } catch (error) {
    console.error("Error in /api/last-refresh-time:", error);
    res.status(500).json({ error: "Failed to fetch last refresh time" });
  }
});

router.get("/kpi-summary", requireUserApi, async (req, res) => {
  try {
    // PREVENT CACHING: Add headers to ensure fresh data is always fetched for the KPI cards.
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // Security check to ensure the user has access to the requested property.
    if (req.session.role !== "super_admin") {
      const userResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );

      if (userResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied: User not found." });
      }
      const internalUserId = userResult.rows[0].user_id;

      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE (user_id = $1 OR user_id = $2::text) AND property_id = $3::integer",
        [req.session.userId, internalUserId, propertyId]
      );

      if (accessCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
      }
    }

    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );
    let competitorIds;

    if (compSetResult.rows.length > 0) {
      competitorIds = compSetResult.rows.map((row) => row.competitor_hotel_id);
    } else {
      const categoryResult = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      const category = categoryResult.rows[0]?.category;
      if (!category) return res.json({ yourHotel: {}, market: {} });

      const categoryCompSetResult = await pgPool.query(
        "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
        [category, propertyId]
      );
      competitorIds = categoryCompSetResult.rows.map((row) => row.hotel_id);
    }

    if (competitorIds.length === 0) {
      // This is a fallback for hotels with no competitors.
      // It now correctly uses the new pre-calculated gross revenue and revpar columns.
 // /api/routes/dashboard.router.js
      const yourHotelQuery = `
          SELECT
            AVG(gross_adr) AS your_adr,
       
        (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) as your_occupancy_direct,
            AVG(gross_revpar) AS your_revpar,
            SUM(gross_revenue) AS your_total_revenue -- [NEW] Add total revenue calculation
          FROM daily_metrics_snapshots
          WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3;
        `;
      const yourHotelResult = await pgPool.query(yourHotelQuery, [
        propertyId,
        startDate,
        endDate,
      ]);
      // Return the hotel's own data and an empty object for the market.
      return res.json({ yourHotel: yourHotelResult.rows[0] || {}, market: {} });
    }

// /api/routes/dashboard.router.js
    const kpiQuery = `
      SELECT
          AVG(CASE WHEN dms.hotel_id = $1 THEN dms.gross_adr ELSE NULL END) AS your_adr,

          SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END)::numeric /
          NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0) AS your_occupancy,

          AVG(CASE WHEN dms.hotel_id = $1 THEN dms.gross_revpar ELSE NULL END) AS your_revpar,
          
          -- [NEW] Add total revenue calculation for your hotel
          SUM(CASE WHEN dms.hotel_id = $1 THEN dms.gross_revenue ELSE NULL END) AS your_total_revenue,

          AVG(CASE WHEN dms.hotel_id != $1 THEN dms.gross_adr ELSE NULL END) AS market_adr,

  
          SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END)::numeric /
          NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0) AS market_occupancy,

          AVG(CASE WHEN dms.hotel_id != $1 THEN dms.gross_revpar ELSE NULL END) AS market_revpar
      FROM daily_metrics_snapshots dms
      WHERE dms.stay_date >= $2 AND dms.stay_date <= $3 AND (dms.hotel_id = $1 OR dms.hotel_id = ANY($4::int[]));
    `;
    const result = await pgPool.query(kpiQuery, [
      propertyId,
      startDate,
      endDate,
      competitorIds,
    ]);
    const kpis = result.rows[0] || {};

    res.json({
// /api/routes/dashboard.router.js
      yourHotel: {
        occupancy: kpis.your_occupancy,
        adr: kpis.your_adr,
        revpar: kpis.your_revpar,
        totalRevenue: kpis.your_total_revenue, // [NEW] Pass the new value in the response
      },
      market: {
        occupancy: kpis.market_occupancy,
        adr: kpis.market_adr,
        revpar: kpis.market_revpar,
      },
    });
  } catch (error) {
    console.error("Error in /api/kpi-summary:", error);
    res.status(500).json({ error: "Failed to fetch KPI summary" });
  }
});
router.get("/metrics-from-db", requireUserApi, async (req, res) => {
  // Prevent API response caching
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  try {
    const { startDate, endDate, granularity = "daily", propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // Security check (No changes needed here)
    if (req.session.role !== "super_admin") {
      const userResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );
      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: "Access denied: User not found." });
      }
      const internalUserId = userResult.rows[0].user_id;
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE (user_id = $1 OR user_id = $2::text) AND property_id = $3::integer",
        [req.session.userId, internalUserId, propertyId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied to this property." });
      }
    }

    // --- [NEW] Fetch total_rooms for capacity calculation ---
    const hotelResult = await pgPool.query("SELECT total_rooms FROM hotels WHERE hotel_id = $1", [propertyId]);
    if (hotelResult.rows.length === 0) {
        return res.status(404).json({ error: "Hotel not found." });
    }
    const totalRooms = hotelResult.rows[0].total_rooms;
    if (!totalRooms || totalRooms <= 0) {
        // Handle cases where total_rooms might be missing or invalid
        console.warn(`Hotel ${propertyId} has missing or invalid total_rooms (${totalRooms}). Capacity calculations may be inaccurate.`);
        // We could throw an error or proceed cautiously. Let's proceed but calculations might yield null/0.
    }
    // --- [END NEW] ---

    const period = getPeriod(granularity);

    // This query now focuses only on summing/averaging metrics. Capacity is handled separately.
    const query = `
      SELECT
        ${period} as period,
        SUM(rooms_sold) as your_rooms_sold,
        -- [REMOVED] SUM(capacity_count) - We calculate this outside SQL now
        (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) as your_occupancy_direct, -- Keep for now, might be useful elsewhere
        AVG(gross_adr) as your_adr, -- Keep alias for KPI card
        AVG(gross_revpar) as your_revpar, -- Keep alias for KPI card
        SUM(gross_revenue) as your_total_revenue, -- Keep alias for KPI card
        -- Full metrics needed by Budgeting/Reports
        SUM(net_revenue) as your_net_revenue,
        SUM(gross_revenue) as your_gross_revenue,
        AVG(net_adr) as your_net_adr,
        AVG(gross_adr) as your_gross_adr,
        AVG(net_revpar) as your_net_revpar,
        AVG(gross_revpar) as your_gross_revpar,
        -- [NEW] Calculate days in the period for capacity calc
        COUNT(DISTINCT stay_date) as days_in_period
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date >= $2::date AND stay_date <= $3::date
      GROUP BY period ORDER BY period ASC;
    `;

    const result = await pgPool.query(query, [propertyId, startDate, endDate]);

    // --- [NEW] Post-process results to calculate correct capacity and remaining unsold ---
    const today = new Date(); // Use server's current date


   const processedMetrics = await Promise.all(result.rows.map(async (row) => {
        const periodDate = new Date(row.period);
        const daysInPeriod = parseInt(row.days_in_period, 10);
        const correctCapacity = totalRooms ? totalRooms * daysInPeriod : null;

        let physicalUnsoldRemaining = null;

        // [NEW LOG 1] Check if the condition for running the query is met
   // [NEW LOG 1] Check if the condition for running the query is met
        
        // [FIX] Compare UTC month and year to avoid timezone comparison bugs.
        // The original check (periodDate.getTime() === currentMonthStart.getTime()) would fail
        // if the server's local timezone was different from UTC, as 'currentMonthStart'
        // was created in local time while 'periodDate' was created from a UTC timestamp.
        const isCurrentMonthConditionMet = (
            granularity === 'monthly' &&
            periodDate.getUTCFullYear() === today.getUTCFullYear() &&
            periodDate.getUTCMonth() === today.getUTCMonth()
        );
        
        if (periodDate.getUTCMonth() === 9 && periodDate.getUTCFullYear() === 2025) { // Log only for October
             // [MODIFIED] Update log to show the new comparison values
             console.log(`[BACKEND DEBUG Oct] Granularity=${granularity}, PeriodMonth=${periodDate.getUTCMonth()}, TodayMonth=${today.getUTCMonth()}, ConditionMet=${isCurrentMonthConditionMet}`);
        }

        if (isCurrentMonthConditionMet) {
            try {
                const unsoldQuery = `
                    SELECT SUM(capacity_count - rooms_sold) AS physical_unsold_remaining
                    FROM daily_metrics_snapshots
                    WHERE hotel_id = $1
                    AND stay_date >= CURRENT_DATE
                    AND date_trunc('month', stay_date) = date_trunc('month', CURRENT_DATE);
                `;
                // [NEW LOG 2] Log before running the query
                console.log(`[BACKEND DEBUG Oct] Running unsoldQuery for hotel ${propertyId}...`);
                const unsoldResult = await pgPool.query(unsoldQuery, [propertyId]);
                // [NEW LOG 3] Log the raw query result
                console.log(`[BACKEND DEBUG Oct] unsoldQuery raw result:`, JSON.stringify(unsoldResult.rows));

                // Parse the result
                const rawValue = unsoldResult.rows[0]?.physical_unsold_remaining;
                physicalUnsoldRemaining = rawValue !== null && rawValue !== undefined
                    ? parseInt(rawValue, 10)
                    : 0;

                // [NEW LOG 4] Log the final parsed value
                console.log(`[BACKEND DEBUG Oct] Parsed physicalUnsoldRemaining:`, physicalUnsoldRemaining);

            } catch (unsoldError) {
                console.error(`[BACKEND DEBUG Oct] Failed to calculate physical_unsold_remaining for ${propertyId}:`, unsoldError);
                physicalUnsoldRemaining = 0;
            }
        }

        return {
            ...row,
            your_capacity_count: correctCapacity,
            physical_unsold_remaining: physicalUnsoldRemaining
        };
    }));
    // --- [END NEW] ---

    res.json({ metrics: processedMetrics }); // Send the processed data

  } catch (error) {
    console.error("Error in /api/metrics-from-db:", error);
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  }
});

router.get("/competitor-metrics", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, granularity = "daily", propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // Security: Ensure the user has access to the requested property
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
      }
    }

    let competitorIds;
    // This new text clarifies what the automatic matching is based on.
    // This new text is universal for all users and removes the conditional logic.
    const compsetSource =
      "a comp set of local hotels in a similar quality class";

    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );

    if (compSetResult.rows.length > 0) {
      competitorIds = compSetResult.rows.map((row) => row.competitor_hotel_id);
      // The line that reassigned the compsetSource has been removed.
    } else {
      const categoryResult = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      const category = categoryResult.rows[0]?.category;
      if (!category)
        return res.json({
          metrics: [],
          competitorCount: 0,
          totalRooms: 0,
          breakdown: {},
        });

      const categoryCompSetResult = await pgPool.query(
        "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
        [category, propertyId]
      );
      competitorIds = categoryCompSetResult.rows.map((row) => row.hotel_id);
    }

    if (competitorIds.length === 0) {
      return res.json({
        metrics: [],
        competitorCount: 0,
        totalRooms: 0,
        breakdown: {},
      });
    }

// /api/routes/dashboard.router.js
// --- UPGRADED DATA AGGREGATION LOGIC ---
    // [FINAL FIX] This query is now simple and correct.
    // It reads the definitive room count from the 'hotels.total_rooms' column,
// /api/routes/dashboard.router.js
// --- UPGRADED DATA AGGREGATION LOGIC ---
    // [FINAL FIX] This query is now simple and correct.
    // It reads the definitive room count from the 'hotels.total_rooms' column,
    // completely bypassing the flawed 'daily_metrics_snapshots' table.
    const competitorDetailsQuery = `
        SELECT 
            h.category, 
            h.neighborhood, 
            h.total_rooms
        FROM hotels h
        WHERE h.hotel_id = ANY($1::int[]);
    `;
    const { rows: competitorDetails } = await pgPool.query(
      competitorDetailsQuery,
      [competitorIds]
    );

    // This new logic builds the complex, nested object the frontend design requires.
    const breakdown = {
      categories: {},
      neighborhoods: {},
    };
    let totalRooms = 0;
    
    // Process each competitor hotel to build the nested breakdown.
    competitorDetails.forEach((hotel) => {
      // Ensure we have valid data to work with.
      const category = hotel.category?.trim();
      const neighborhood = hotel.neighborhood?.trim();
      const rooms = hotel.total_rooms || 0;

      // Sum up the total rooms for the entire market.
      totalRooms += rooms;

      // Aggregate the simple neighborhood summary for the bottom of the card.
      if (neighborhood) {
        breakdown.neighborhoods[neighborhood] = (breakdown.neighborhoods[neighborhood] || 0) + 1;
      }

      // Aggregate the complex category breakdown.
      if (category) {
        // If this is the first time we see this category, initialize its object.
        if (!breakdown.categories[category]) {
          breakdown.categories[category] = { properties: 0, rooms: 0, neighborhoods: {} };
        }

        // Increment the property count and add to the room count for this category.
        breakdown.categories[category].properties += 1;
        breakdown.categories[category].rooms += rooms;

        // If the hotel is in a valid neighborhood, count it within its category.
        if (neighborhood) {
          const categoryNeighborhoods = breakdown.categories[category].neighborhoods;
          categoryNeighborhoods[neighborhood] = (categoryNeighborhoods[neighborhood] || 0) + 1;
        }
      }
    });
    // --- END OF UPGRADED LOGIC ---

    const period = getPeriod(granularity);
    // This query is now cleaned up to only select the new pre-calculated columns.
    const metricsQuery = `
      SELECT
        ${period} as period,
  
        (SUM(dms.rooms_sold)::numeric / NULLIF(SUM(dms.capacity_count), 0)) as market_occupancy,
 
        AVG(dms.net_adr) as market_net_adr,
        AVG(dms.gross_adr) as market_gross_adr,
        AVG(dms.net_revpar) as market_net_revpar,
        AVG(dms.gross_revpar) as market_gross_revpar,
        SUM(dms.net_revenue) as market_net_revenue,
        SUM(dms.gross_revenue) as market_gross_revenue
      FROM daily_metrics_snapshots dms
      WHERE dms.hotel_id = ANY($1::int[]) AND dms.stay_date >= $2::date AND dms.stay_date <= $3::date
      GROUP BY period ORDER BY period ASC;
    `;
    const result = await pgPool.query(metricsQuery, [
      competitorIds,
      startDate,
      endDate,
    ]);

    res.json({
      metrics: result.rows,
      competitorCount: competitorIds.length,
      totalRooms: totalRooms,
      breakdown: breakdown,
      source: compsetSource,
    });
  } catch (error) {
    console.error("Error in /api/competitor-metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  }
});
// --- NEW: ENDPOINT TO SET HOTEL CATEGORY ---
router.patch(
  "/my-properties/:propertyId/category",
  requireUserApi,
  async (req, res) => {
    // Extract propertyId from the URL parameters and category from the request body.
    const { propertyId } = req.params;
    const { category } = req.body;

    // Define the list of valid categories to prevent invalid data injection.
    // Define the list of valid categories to prevent invalid data injection.
    const validCategories = [
      "Economy",
      "Midscale",
      "Upper Midscale",
      "Luxury",
      "Hostel",
    ]; // Add "Hostel" as a valid option
    if (!category || !validCategories.includes(category)) {
      // If the provided category is not in our list, reject the request.
      return res.status(400).json({ error: "A valid category is required." });
    }

    try {
      // /api/routes/dashboard.router.js

      // /api/routes/dashboard.router.js

      // Security check: For regular users, verify they have access to this property.
      // super_admin users can bypass this check.
      if (req.session.role !== "super_admin") {
        // THE FIX: Explicitly cast the propertyId from the URL to an integer.
        // This prevents a hard crash in the database driver from a type mismatch.
        const accessCheck = await pgPool.query(
          "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2::integer",
          [req.session.userId, propertyId]
        );
        if (accessCheck.rows.length === 0) {
          return res
            .status(403)
            .json({ error: "Access denied to this property." });
        }
      }

      // Update the category for the specified hotel in the database.
      const updateResult = await pgPool.query(
        "UPDATE hotels SET category = $1 WHERE hotel_id = $2 RETURNING hotel_id, category",
        [category, propertyId]
      );

      // If no rows are returned, it means the hotel_id was not found.
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: "Property not found." });
      }

      // Send a success response.
      res.status(200).json({
        message: "Hotel category updated successfully.",
        hotel: updateResult.rows[0],
      });
    } catch (error) {
      // Log any errors and send a generic server error response.
      console.error("Error updating hotel category:", error);
      res.status(500).json({ error: "Failed to update hotel category." });
    }
  }
);
// --- NEW: MARKET RANKING ENDPOINT ---
router.get("/market-ranking", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }

    // Security: Ensure the user has access to the requested property
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
      }
    }

    // Step 1: Determine the competitive set (reusing existing logic)
    let competitorIds;
    const compSetResult = await pgPool.query(
      "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
      [propertyId]
    );

    if (compSetResult.rows.length > 0) {
      competitorIds = compSetResult.rows.map((row) => row.competitor_hotel_id);
    } else {
      const categoryResult = await pgPool.query(
        "SELECT category FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      const category = categoryResult.rows[0]?.category;
      if (!category) {
        return res.json({}); // No category, no comp set
      }
      const categoryCompSetResult = await pgPool.query(
        "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
        [category, propertyId]
      );
      competitorIds = categoryCompSetResult.rows.map((row) => row.hotel_id);
    }

    if (competitorIds.length === 0) {
      // If no competitors, ranking is always 1 of 1
      const result = {
        occupancy: { rank: 1, total: 1 },
        adr: { rank: 1, total: 1 },
        revpar: { rank: 1, total: 1 },
      };
      return res.json(result);
    }

    // Combine the main property with its competitors for the query
    const allHotelIds = [propertyId, ...competitorIds];
    const totalHotels = allHotelIds.length;

// /api/routes/dashboard.router.js
    // Step 2: Calculate performance for all hotels and rank them using window functions
    // Step 2: Calculate performance for all hotels and rank them using window functions
    const rankingQuery = `
      WITH HotelPerformance AS (
        -- First, calculate the average performance for each hotel in the set
        -- [FIX] This now calculates occupancy correctly and uses gross metrics
        -- to ensure consistency with all other dashboard components.
        SELECT
          hotel_id,
          AVG(gross_adr) AS adr,
          -- [FIX] Correctly calculate occupancy from source columns, instead of reading 'occupancy_direct'
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) AS occupancy,
          AVG(gross_revpar) AS revpar
        FROM daily_metrics_snapshots
        WHERE
          hotel_id = ANY($1::int[]) AND
          stay_date BETWEEN $2 AND $3
        GROUP BY hotel_id
      ),
      Rankings AS (
        -- Then, use RANK() to assign a rank to each hotel for each metric
        SELECT
          hotel_id,
          RANK() OVER (ORDER BY occupancy DESC NULLS LAST) as occupancy_rank,
          RANK() OVER (ORDER BY adr DESC NULLS LAST) as adr_rank,
          RANK() OVER (ORDER BY revpar DESC NULLS LAST) as revpar_rank
        FROM HotelPerformance
      )
      -- Finally, select only the ranks for our subject property
      SELECT occupancy_rank, adr_rank, revpar_rank
      FROM Rankings
      WHERE hotel_id = $4;
    `;

    const rankingResult = await pgPool.query(rankingQuery, [
      allHotelIds,
      startDate,
      endDate,
      propertyId,
    ]);

    if (rankingResult.rows.length === 0) {
      // This can happen if the main hotel had no data in the selected period.
      // Default to last place.
      const total = competitorIds.length + 1;
      return res.json({
        occupancy: { rank: total, total: total },
        adr: { rank: total, total: total },
        revpar: { rank: total, total: total },
      });
    }

    const ranks = rankingResult.rows[0];
    const result = {
      occupancy: {
        rank: parseInt(ranks.occupancy_rank, 10),
        total: totalHotels,
      },
      adr: { rank: parseInt(ranks.adr_rank, 10), total: totalHotels },
      revpar: { rank: parseInt(ranks.revpar_rank, 10), total: totalHotels },
    };

    res.json(result);
  } catch (error) {
    console.error("Error in /api/market-ranking:", error);
    res.status(500).json({ error: "Failed to fetch market ranking." });
  }
});

// --- NEW: ENDPOINT TO SAVE USER-SUBMITTED TAX INFO ---
router.patch(
  "/my-properties/:propertyId/tax-info",
  requireUserApi, // Ensures the user is logged in
  async (req, res) => {
    // Get the property ID from the URL and the tax data from the request body.
    const { propertyId } = req.params;
    const { rate, type, name } = req.body;

    // --- Data Validation ---
    // Ensure the rate is a valid number.
    const taxRate = parseFloat(rate);
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 1) {
      return res
        .status(400)
        .json({ error: "A valid tax rate between 0 and 1 is required." });
    }
    // Ensure the type is one of the allowed values.
    if (!["inclusive", "exclusive"].includes(type)) {
      return res
        .status(400)
        .json({ error: "Tax type must be 'inclusive' or 'exclusive'." });
    }

    try {
      // Security Check: Only a super_admin or a user directly linked to the property can update it.
      if (req.session.role !== "super_admin") {
        const accessCheck = await pgPool.query(
          "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2::integer",
          [req.session.userId, propertyId]
        );
        if (accessCheck.rows.length === 0) {
          return res
            .status(403)
            .json({ error: "Access denied to this property." });
        }
      }

      // --- Database Update ---
      // Update the hotels table with the provided tax information.
      const updateResult = await pgPool.query(
        "UPDATE hotels SET tax_rate = $1, tax_type = $2, tax_name = $3 WHERE hotel_id = $4 RETURNING hotel_id, tax_rate, tax_type, tax_name",
        [taxRate, type, name || "Tax", propertyId]
      );

      // If no rows were updated, the property was not found.
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ error: "Property not found." });
      }

      // Send a success response.
      res.status(200).json({
        message: "Hotel tax information updated successfully.",
        hotel: updateResult.rows[0],
      });
    } catch (error) {
      console.error("Error updating hotel tax info:", error);
      res
        .status(500)
        .json({ error: "Failed to update hotel tax information." });
    }
  }
);
// --- NEW: ENDPOINT FOR THE MAIN DASHBOARD PERFORMANCE CHART ---
router.get("/dashboard-chart", requireUserApi, async (req, res) => {
  try {
    // 1. Read the new 'granularity' parameter, defaulting to 'daily'.
    const { startDate, endDate, propertyId, granularity = 'daily' } = req.query;
    if (!propertyId || !startDate || !endDate) {
      return res.status(400).json({ error: "propertyId, startDate, and endDate are required." });
    }

    // Security check (no changes needed here)
    if (req.session.role !== "super_admin") {
      // Logic to check user access to the property
      const userResult = await pgPool.query("SELECT user_id FROM users WHERE cloudbeds_user_id = $1", [req.session.userId]);
      if (userResult.rows.length === 0) return res.status(403).json({ error: "Access denied: User not found." });
      const internalUserId = userResult.rows[0].user_id;
      const accessCheck = await pgPool.query("SELECT 1 FROM user_properties WHERE (user_id = $1 OR user_id = $2::text) AND property_id = $3::integer", [req.session.userId, internalUserId, propertyId]);
      if (accessCheck.rows.length === 0) return res.status(403).json({ error: "Access denied to this property." });
    }

    // Comp set logic (no changes needed here)
    let competitorIds;
    const compSetResult = await pgPool.query("SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1", [propertyId]);
    if (compSetResult.rows.length > 0) {
      competitorIds = compSetResult.rows.map((row) => row.competitor_hotel_id);
    } else {
      const categoryResult = await pgPool.query("SELECT category FROM hotels WHERE hotel_id = $1", [propertyId]);
      const category = categoryResult.rows[0]?.category;
      if (category) {
        const categoryCompSetResult = await pgPool.query("SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2", [category, propertyId]);
        competitorIds = categoryCompSetResult.rows.map((row) => row.hotel_id);
      } else {
        competitorIds = [];
      }
    }

    // 2. Use the existing 'getPeriod' helper function.
    const period = getPeriod(granularity);

    // 3. This is the updated query that uses the dynamic period for grouping.
    const query = `
      WITH AllData AS (
        -- First, get all the raw daily data for both the hotel and its market.
        SELECT
          ${period} AS period,
          CASE WHEN hotel_id = $1 THEN occupancy_direct ELSE NULL END AS your_occupancy,
          CASE WHEN hotel_id = $1 THEN gross_adr ELSE NULL END AS your_adr,
          CASE WHEN hotel_id = $1 THEN gross_revpar ELSE NULL END AS your_revpar,
          CASE WHEN hotel_id != $1 THEN occupancy_direct ELSE NULL END AS market_occupancy,
          CASE WHEN hotel_id != $1 THEN gross_adr ELSE NULL END AS market_adr,
          CASE WHEN hotel_id != $1 THEN gross_revpar ELSE NULL END AS market_revpar
        FROM daily_metrics_snapshots
        WHERE 
          (hotel_id = $1 OR hotel_id = ANY($4::int[])) AND
          stay_date BETWEEN $2 AND $3
      )
      -- Then, aggregate that data based on the selected period (day, week, or month).
      SELECT
        period AS date, -- Alias 'period' to 'date' for frontend consistency.
        json_build_object(
          'occupancy', COALESCE(AVG(your_occupancy), 0),
          'adr', COALESCE(AVG(your_adr), 0),
          'revpar', COALESCE(AVG(your_revpar), 0)
        ) AS "yourHotel",
        json_build_object(
          'occupancy', COALESCE(AVG(market_occupancy), 0),
          'adr', COALESCE(AVG(market_adr), 0),
          'revpar', COALESCE(AVG(market_revpar), 0)
        ) AS "market"
      FROM AllData
      GROUP BY period
      ORDER BY period ASC;
    `;
    
    const result = await pgPool.query(query, [propertyId, startDate, endDate, competitorIds]);
    res.json(result.rows);

  } catch (error) {
    console.error("Error in /api/dashboard-chart:", error);
    res.status(500).json({ error: "Failed to fetch dashboard chart data." });
  }
});

module.exports = router;
