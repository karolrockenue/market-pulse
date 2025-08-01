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
          property_name
        FROM hotels
        ORDER BY property_name;
      `;
      const result = await pgPool.query(query);
      return res.json(result.rows);
    } else {
      // If they are a regular user ('owner' or 'user'), get only their linked properties.
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
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id::text = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
      }
    }

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

router.get("/sync-status/:propertyId", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // --- FIX: Check for 'super_admin' role to bypass the ownership check ---
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id::text = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const syncCheck = await pgPool.query(
      "SELECT 1 FROM daily_metrics_snapshots WHERE hotel_id = $1 LIMIT 1",
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
    const { startDate, endDate, propertyId } = req.query;
    if (!propertyId)
      return res.status(400).json({ error: "A propertyId is required." });

    // --- FIX: Check for 'super_admin' role to bypass the ownership check ---
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0)
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
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
      const yourHotelQuery = `
          SELECT
            (SUM(total_revenue) / NULLIF(SUM(rooms_sold), 0)) AS your_adr,
            (SUM(rooms_sold)::NUMERIC / NULLIF(SUM(capacity_count), 0)) AS your_occupancy,
            (SUM(total_revenue)::NUMERIC / NULLIF(SUM(capacity_count), 0)) AS your_revpar
          FROM daily_metrics_snapshots
          WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3;
        `;
      const yourHotelResult = await pgPool.query(yourHotelQuery, [
        propertyId,
        startDate,
        endDate,
      ]);
      return res.json({ yourHotel: yourHotelResult.rows[0] || {}, market: {} });
    }

    const kpiQuery = `
      SELECT
          (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END), 0)) AS your_adr,
          (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0)) AS your_occupancy,
          (SUM(CASE WHEN dms.hotel_id = $1 THEN dms.total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0)) AS your_revpar,
          (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.total_revenue ELSE 0 END) / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END), 0)) AS market_adr,
          (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.rooms_sold ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0)) AS market_occupancy,
          (SUM(CASE WHEN dms.hotel_id != $1 THEN dms.total_revenue ELSE 0 END)::NUMERIC / NULLIF(SUM(CASE WHEN dms.hotel_id != $1 THEN dms.capacity_count ELSE 0 END), 0)) AS market_revpar
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

    // --- FIX: Check for 'super_admin' role to bypass the ownership check ---
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0)
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
    }

    const period = getPeriod(granularity);
    const query = `
      SELECT ${period} as period, AVG(adr::numeric) as adr, AVG(occupancy_direct::numeric) as occupancy_direct, AVG(revpar::numeric) as revpar,
    SUM(total_revenue::numeric)   as total_revenue, SUM(rooms_sold) as rooms_sold, SUM(capacity_count) as capacity_count
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

    // --- FIX: Check for 'super_admin' role to bypass the ownership check ---
    if (req.session.role !== "super_admin") {
      const accessCheck = await pgPool.query(
        "SELECT * FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [req.session.userId, propertyId]
      );
      if (accessCheck.rows.length === 0)
        return res
          .status(403)
          .json({ error: "Access denied to this property." });
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
      if (!category)
        return res.json({ metrics: [], competitorCount: 0, totalRooms: 0 });

      const categoryCompSetResult = await pgPool.query(
        "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
        [category, propertyId]
      );
      competitorIds = categoryCompSetResult.rows.map((row) => row.hotel_id);
    }

    if (competitorIds.length === 0) {
      return res.json({ metrics: [], competitorCount: 0, totalRooms: 0 });
    }

    const period = getPeriod(granularity);

    const metricsQuery = `
      SELECT ${period} as period, AVG(dms.adr::numeric) as market_adr, AVG(dms.occupancy_direct::numeric) as market_occupancy, AVG(dms.revpar::numeric) as market_revpar,
      SUM(dms.total_revenue::numeric) as market_total_revenue, SUM(dms.rooms_sold) as market_rooms_sold, SUM(dms.capacity_count) as market_capacity_count
      FROM daily_metrics_snapshots dms
      WHERE dms.hotel_id = ANY($1::int[]) AND dms.stay_date >= $2::date AND dms.stay_date <= $3::date
      GROUP BY period ORDER BY period ASC;
    `;
    const result = await pgPool.query(metricsQuery, [
      competitorIds,
      startDate,
      endDate,
    ]);

    const competitorRoomsResult = await pgPool.query(
      `WITH latest_snapshots AS (
        SELECT DISTINCT ON (dms.hotel_id) dms.capacity_count
        FROM daily_metrics_snapshots dms
        WHERE dms.hotel_id = ANY($1::int[])
        ORDER BY dms.hotel_id, dms.stay_date DESC
      )
      SELECT SUM(capacity_count)::integer as total_rooms FROM latest_snapshots;`,
      [competitorIds]
    );

    res.json({
      metrics: result.rows,
      competitorCount: competitorIds.length,
      totalRooms: competitorRoomsResult.rows[0]?.total_rooms || 0,
    });
  } catch (error) {
    console.error("Error in /api/competitor-metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics" });
  }
});

module.exports = router;
