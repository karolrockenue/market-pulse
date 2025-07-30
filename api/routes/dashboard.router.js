// /api/routes/dashboard.router.js
const express = require("express");
const router = express.Router();
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// GET KPI Summary
router.get("/kpi-summary", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId)) {
      return res.status(400).json({ error: "Invalid Property ID format." });
    }

    const yourHotelQuery = `
      SELECT
        -- FIX: Cast all aggregated columns to a numeric type for correct calculations.
        SUM(total_revenue::numeric) AS total_revenue,
        AVG(adr::numeric) AS adr,
        AVG(occupancy_direct::numeric) AS occupancy,
        AVG(revpar::numeric) AS revpar
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date BETWEEN $2 AND $3;
    `;

    const marketQuery = `
      SELECT
        -- FIX: Cast all aggregated columns to a numeric type.
        SUM(dms.total_revenue::numeric) / COUNT(DISTINCT dms.hotel_id) AS total_revenue,
        AVG(dms.adr::numeric) AS adr,
        AVG(dms.occupancy_direct::numeric) AS occupancy,
        AVG(dms.revpar::numeric) AS revpar
      FROM daily_metrics_snapshots dms
      JOIN hotels h ON h.hotel_id = dms.hotel_id
      WHERE dms.hotel_id != $1
        AND h.category = (SELECT category FROM hotels WHERE hotel_id = $1)
        AND dms.stay_date BETWEEN $2 AND $3;
    `;

    const [yourHotelResult, marketResult] = await Promise.all([
      pgPool.query(yourHotelQuery, [numericPropertyId, startDate, endDate]),
      pgPool.query(marketQuery, [numericPropertyId, startDate, endDate]),
    ]);

    res.json({
      yourHotel: yourHotelResult.rows[0],
      market: marketResult.rows[0],
    });
  } catch (error) {
    console.error("Error fetching KPI summary:", error);
    res.status(500).json({ error: "Failed to fetch KPI summary." });
  }
});

// GET Metrics from DB (for chart and tables)
router.get("/metrics-from-db", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, granularity, propertyId } = req.query;
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId)) {
      return res.status(400).json({ error: "Invalid Property ID format." });
    }

    const dateColumn =
      granularity === "monthly"
        ? "DATE_TRUNC('month', stay_date)::DATE"
        : granularity === "weekly"
        ? "DATE_TRUNC('week', stay_date)::DATE"
        : "stay_date";

    const query = `
      SELECT
        ${dateColumn} AS period,
        -- FIX: Cast all aggregated columns to a numeric type for correct calculations.
        AVG(occupancy_direct::numeric) AS occupancy_direct,
        AVG(adr::numeric) AS adr,
        AVG(revpar::numeric) AS revpar
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date BETWEEN $2 AND $3
      GROUP BY ${dateColumn}
      ORDER BY ${dateColumn};
    `;

    const result = await pgPool.query(query, [
      numericPropertyId,
      startDate,
      endDate,
    ]);
    res.json({ metrics: result.rows });
  } catch (error) {
    console.error("Error fetching metrics from DB:", error);
    res.status(500).json({ error: "Failed to fetch metrics." });
  }
});

// GET Competitor Metrics (for chart and tables)
router.get("/competitor-metrics", requireUserApi, async (req, res) => {
  try {
    const { startDate, endDate, granularity, propertyId } = req.query;
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId)) {
      return res.status(400).json({ error: "Invalid Property ID format." });
    }

    const dateColumn =
      granularity === "monthly"
        ? "DATE_TRUNC('month', dms.stay_date)::DATE"
        : granularity === "weekly"
        ? "DATE_TRUNC('week', dms.stay_date)::DATE"
        : "dms.stay_date";

    const categoryResult = await pgPool.query(
      "SELECT category FROM hotels WHERE hotel_id = $1",
      [numericPropertyId]
    );
    if (categoryResult.rows.length === 0) {
      return res.json({ metrics: [], competitorCount: 0, totalRooms: 0 });
    }
    const userHotelCategory = categoryResult.rows[0].category;

    const statsQuery = `
      SELECT COUNT(DISTINCT hotel_id) as competitor_count, SUM(total_rooms) as total_rooms
      FROM hotels
      WHERE category = $1 AND hotel_id != $2
    `;
    const statsResult = await pgPool.query(statsQuery, [
      userHotelCategory,
      numericPropertyId,
    ]);
    const { competitor_count, total_rooms } = statsResult.rows[0];

    const metricsQuery = `
      SELECT
        ${dateColumn} AS period,
        -- FIX: Cast all aggregated columns to a numeric type for correct calculations.
        AVG(dms.occupancy_direct::numeric) AS market_occupancy,
        AVG(dms.adr::numeric) AS market_adr,
        AVG(dms.revpar::numeric) AS market_revpar
      FROM daily_metrics_snapshots dms
      JOIN hotels h ON h.hotel_id = dms.hotel_id
      WHERE h.category = $1 AND dms.hotel_id != $2 AND dms.stay_date BETWEEN $3 AND $4
      GROUP BY ${dateColumn}
      ORDER BY ${dateColumn};
    `;
    const result = await pgPool.query(metricsQuery, [
      userHotelCategory,
      numericPropertyId,
      startDate,
      endDate,
    ]);

    res.json({
      metrics: result.rows,
      competitorCount: parseInt(competitor_count, 10) || 0,
      totalRooms: parseInt(total_rooms, 10) || 0,
    });
  } catch (error) {
    console.error("Error fetching competitor metrics:", error);
    res.status(500).json({ error: "Failed to fetch competitor metrics." });
  }
});

// GET Sync Status
router.get("/sync-status/:propertyId", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId)) {
      return res.status(400).json({ error: "Invalid Property ID format." });
    }

    const result = await pgPool.query(
      "SELECT COUNT(*) FROM daily_metrics_snapshots WHERE hotel_id = $1",
      [numericPropertyId]
    );
    const isSyncComplete = result.rows[0].count > 0;
    res.json({ isSyncComplete });
  } catch (error) {
    console.error("Error fetching sync status:", error);
    res.status(500).json({ error: "Failed to fetch sync status." });
  }
});

// GET Hotel Details (for tax/currency)
router.get("/hotel-details/:propertyId", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId)) {
      return res.status(400).json({ error: "Invalid Property ID format." });
    }

    const result = await pgPool.query(
      "SELECT tax_rate, tax_type, tax_name, currency_code FROM hotels WHERE hotel_id = $1",
      [numericPropertyId]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "Hotel details not found." });
    }
  } catch (error) {
    console.error("Error fetching hotel details:", error);
    res.status(500).json({ error: "Failed to fetch hotel details." });
  }
});

// GET User's Properties (for header dropdown)
router.get("/my-properties", requireUserApi, async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT p.property_id, h.property_name 
             FROM user_properties p
             JOIN hotels h ON p.property_id = h.hotel_id
             WHERE p.user_id = $1`,
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching user properties:", error);
    res.status(500).json({ error: "Failed to fetch properties." });
  }
});

// GET User Profile (for settings page)
router.get("/user/profile", requireUserApi, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT first_name, last_name, email FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: "User profile not found." });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

// PUT User Profile (for settings page)
router.put("/user/profile", requireUserApi, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const result = await pgPool.query(
      "UPDATE users SET first_name = $1, last_name = $2 WHERE cloudbeds_user_id = $3 RETURNING *",
      [firstName, lastName, req.session.userId]
    );
    if (result.rows.length > 0) {
      res.json({
        message: "Profile updated successfully.",
        user: result.rows[0],
      });
    } else {
      res.status(404).json({ error: "User not found." });
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

module.exports = router;
