// /api/routes/dashboard.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware"); // Only need user auth for this router

// Helper function to get the period for SQL queries
// Export both the router for the app and the helper for tests

const getPeriod = (granularity) => {
  if (granularity === "monthly") return "date_trunc('month', stay_date)";
  if (granularity === "weekly") return "date_trunc('week', stay_date)";
  return "stay_date";
};

// --- DASHBOARD API ENDPOINTS ---

// /api/routes/dashboard.router.js
// api/routes/dashboard.router.js

router.get("/my-properties", requireUserApi, async (req, res) => {
  try {
    // This query now only gets the ID and name, as intended for the header.
    const query = `
      SELECT 
        up.property_id, 
        h.property_name
      FROM user_properties up
      LEFT JOIN hotels h ON up.property_id::text = h.hotel_id::text
      WHERE up.user_id = $1
      ORDER BY h.property_name;
    `;
    const result = await pgPool.query(query, [req.session.userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/my-properties:", error);
    res.status(500).json({ error: "Failed to fetch user properties." });
  }
});

// /api/routes/dashboard.router.js

// NEW: A simple, dedicated route to get details for a single property.
// api/routes/dashboard.router.js

router.get("/hotel-details/:propertyId", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const accessCheck = await pgPool.query(
      "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id::text = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied to this property." });
    }

    // The query now selects the hotel's currency code and tax name as well.
    const hotelResult = await pgPool.query(
      "SELECT property_name, currency_code, tax_rate, tax_type, tax_name FROM hotels WHERE hotel_id::text = $1",
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
    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0)
      return res.status(403).json({ error: "Access denied to this property." });

    // Fetch the category for the selected hotel
    const hotelCategoryResult = await pgPool.query(
      "SELECT category FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    // Check if the hotel or its category exists
    if (
      hotelCategoryResult.rows.length === 0 ||
      !hotelCategoryResult.rows[0].category
    ) {
      // If no category, return empty data as no market comparison is possible
      return res.json({ yourHotel: {}, market: {} });
    }
    // Store the category for the market data query
    const category = hotelCategoryResult.rows[0].category;

    const kpiQuery = `
      SELECT
          (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END), 0)) AS your_adr,
          (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0)) AS your_occupancy,
          (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0)) AS your_revpar,
          (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END), 0)) AS market_adr,
          (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0)) AS market_occupancy,
          (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0)) AS market_revpar
      FROM daily_metrics_snapshots dms
  JOIN hotels h ON dms.hotel_id = h.hotel_id
  WHERE dms.stay_date >= $2 AND dms.stay_date <= $3 AND h.category = $4;
`;
    const result = await pgPool.query(kpiQuery, [
      propertyId,
      startDate,
      endDate,
      category, // Use the new 'category' variable
    ]);
    const kpis = result.rows[0] || {};
    res.json({
      yourHotel: {
        occupancy: kpis.your_occupancy,
        adr: kpis.your_adr,
        revpar: kpis.your_revpar,
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
  try {
    const { startDate, endDate, granularity = "daily", propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0)
      return res.status(403).json({ error: "Access denied to this property." });

    const period = getPeriod(granularity);
    // api/routes/dashboard.router.js

    // api/routes/dashboard.router.js

    const query = `
      SELECT ${period} as period, AVG(adr) as adr, AVG(occupancy_direct) as occupancy_direct, AVG(revpar) as revpar,
      SUM(total_revenue) as total_revenue, SUM(rooms_sold) as rooms_sold, SUM(capacity_count) as capacity_count
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date >= $2::date AND stay_date <= $3::date
      GROUP BY period ORDER BY period ASC;
    `;
    const result = await pgPool.query(query, [propertyId, startDate, endDate]);
    res.json({ metrics: result.rows });
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

    const accessCheck = await pgPool.query(
      "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [req.session.userId, propertyId]
    );
    if (accessCheck.rows.length === 0)
      return res.status(403).json({ error: "Access denied to this property." });

    // Fetch the category for the selected hotel
    const hotelCategoryResult = await pgPool.query(
      "SELECT category FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    // If no category, no market comparison can be done
    if (
      hotelCategoryResult.rows.length === 0 ||
      !hotelCategoryResult.rows[0].category
    ) {
      return res.json({ metrics: [], competitorCount: 0 });
    }
    // Store the category for the queries
    const category = hotelCategoryResult.rows[0].category;
    const period = getPeriod(granularity);
    // api/routes/dashboard.router.js

    const query = `
      SELECT ${period} as period, AVG(dms.adr) as market_adr, AVG(dms.occupancy_direct) as market_occupancy, AVG(dms.revpar) as market_revpar,
      SUM(dms.total_revenue) as market_total_revenue, SUM(dms.rooms_sold) as market_rooms_sold, SUM(dms.capacity_count) as market_capacity_count
      FROM daily_metrics_snapshots dms
      JOIN hotels h ON dms.hotel_id = h.hotel_id
WHERE dms.hotel_id != $1 AND h.category = $2 AND dms.stay_date >= $3::date AND dms.stay_date <= $4::date
  GROUP BY period ORDER BY period ASC;
`;
    // Update the query to use the new 'category' variable
    const result = await pgPool.query(query, [
      propertyId,
      category,
      startDate,
      endDate,
    ]);
    // Also update the competitor count query to use 'category'
    // Also update the competitor count query to use 'category'
    const competitorCountResult = await pgPool.query(
      "SELECT COUNT(DISTINCT hotel_id) FROM hotels WHERE category = $1 AND hotel_id != $2",
      [category, propertyId]
    );

    // NEW: Query to get the total room capacity of the competitor set.
    // It finds the most recent capacity snapshot for each competitor hotel and sums them up.
    const competitorRoomsResult = await pgPool.query(
      `WITH latest_snapshots AS (
        SELECT DISTINCT ON (dms.hotel_id) dms.capacity_count
        FROM daily_metrics_snapshots dms
        JOIN hotels h ON dms.hotel_id = h.hotel_id
        WHERE h.category = $1 AND h.hotel_id != $2
        ORDER BY dms.hotel_id, dms.stay_date DESC
      )
      SELECT SUM(capacity_count)::integer as total_rooms FROM latest_snapshots;`,
      [category, propertyId]
    );

    // Add the new total_rooms to the JSON response.
    res.json({
      metrics: result.rows,
      competitorCount: parseInt(competitorCountResult.rows[0]?.count || 0, 10),
      totalRooms: competitorRoomsResult.rows[0]?.total_rooms || 0,
    });
  } catch (error) {
    console.error("Error in /api/competitor-metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  }
});

// The main export is the router itself, which the server needs.
module.exports = router;
