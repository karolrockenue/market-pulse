// /api/routes/reports.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

// Get scheduled reports for the current user
router.get("/scheduled-reports", requireUserApi, async (req, res) => {
  try {
    // Resolve internal user_id from session (cloudbeds_user_id)
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const internalUserId = userResult.rows[0].user_id;

    const { rows } = await pgPool.query(
      `SELECT sr.*, h.property_name
       FROM scheduled_reports sr
       LEFT JOIN hotels h
         ON (
           CASE
             WHEN sr.property_id ~ '^[0-9]+$' THEN sr.property_id::int
             ELSE NULL
           END
         ) = h.hotel_id
       WHERE sr.user_id = $1
       ORDER BY sr.created_at DESC`,
      [internalUserId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching scheduled reports:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- SCHEDULED REPORTS API ENDPOINTS ---
// Create new scheduled report
router.post("/scheduled-reports", requireUserApi, async (req, res) => {
  try {
    // Resolve internal user_id from session (cloudbeds_user_id)
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const internalUserId = userResult.rows[0].user_id;

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
    const safeDisplayOrder = displayOrder ?? "metric"; // "metric" | "source"
    const safeIncludeTaxes = includeTaxes ?? true;

    const result = await pgPool.query(
      `
        INSERT INTO scheduled_reports (
          user_id,
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
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
      `,
      [
        internalUserId, // $1
        propertyId, // $2
        reportName, // $3
        recipients, // $4
        frequency, // $5
        dayOfWeek, // $6
        dayOfMonth, // $7
        timeOfDay, // $8
        metricsHotel, // $9
        safeMetricsMarket, // $10
        safeAddComparisons, // $11
        safeDisplayOrder, // $12
        displayTotals, // $13
        safeIncludeTaxes, // $14
        reportPeriod, // $15
        attachmentFormats, // $16
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating scheduled report:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
