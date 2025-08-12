// /api/routes/reports.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// --- SCHEDULED REPORTS API ENDPOINTS ---

router.get("/scheduled-reports", requireUserApi, async (req, res) => {
  try {
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) return res.json([]);
    const internalUserId = userResult.rows[0].user_id;
    const { rows } = await pgPool.query(
      `SELECT sr.*, h.property_name FROM scheduled_reports sr LEFT JOIN hotels h ON sr.property_id::integer = h.hotel_id WHERE sr.user_id = $1 ORDER BY sr.created_at DESC`,
      [internalUserId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching scheduled reports:", error);
    res.status(500).json({ error: "Failed to fetch scheduled reports" });
  }
});

// Create new scheduled report
router.post("/scheduled-reports", requireUserApi, async (req, res) => {
  try {
    const {
      propertyId,
      reportName,
      recipients,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      metricsHotel,
      metricsMarket,
      addComparisons,
      displayOrder,
      displayTotals,
      includeTaxes,
      reportPeriod,
      attachmentFormats,
    } = req.body;

    // Defaults to satisfy NOT NULLs and keep consistent types
    const safeMetricsMarket = Array.isArray(metricsMarket) ? metricsMarket : [];
    const safeAddComparisons = !!addComparisons;
    const safeDisplayOrder = displayOrder ?? "metric"; // typical values: "metric" | "source"
    const safeIncludeTaxes = includeTaxes ?? true;

    const result = await pool.query(
      `
        INSERT INTO scheduled_reports (
          property_id,
          report_name,
          recipients,
          frequency,
          day_of_week,
          day_of_month,
          time_of_day,
          metrics_hotel,
          metrics_market,
          add_comparisons,
          display_order,
          display_totals,
          include_taxes,
          report_period,
          attachment_formats
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *
      `,
      [
        propertyId,
        reportName,
        recipients,
        frequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
        metricsHotel,
        safeMetricsMarket,
        safeAddComparisons,
        safeDisplayOrder,
        displayTotals,
        safeIncludeTaxes,
        reportPeriod,
        attachmentFormats,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating scheduled report:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
