// /api/routes/reports.js
const express = require("express");
const router = express.Router();

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");
// Helper function (copied from dashboard.router.js) to get the period for SQL queries
// [NEW] Get available years for a property
// Helper function (copied from dashboard.router.js) to get the period for SQL queries
/**
 * Returns a SQL string for DATE_TRUNC based on the granularity.
 * @param {string} granularity - 'daily', 'weekly', or 'monthly'
 * @returns {string} - A SQL snippet (e.g., "DATE_TRUNC('day', stay_date)")
 */
function getPeriod(granularity) {
  switch (granularity) {
    case "weekly":
      return "DATE_TRUNC('week', stay_date)"; // Group by the start of the week
    case "monthly":
      return "DATE_TRUNC('month', stay_date)"; // Group by the start of the month
    case "daily":
    default:
      return "DATE_TRUNC('day', stay_date)"; // Group by the day
  }
}

// [NEW] Get available years for a property
router.get("/available-years", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId) {
      return res.status(400).json({ error: "propertyId is required" });
    }

// --- Security Check ---
if (req.session.role !== "super_admin" && req.session.role !== "admin") {
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
    return res
      .status(403)
      .json({ error: "Access denied to this property." });
  }
}
// --- End Security Check ---

// [MODIFIED] This query is now much smarter
    const query = `
      SELECT DISTINCT date_part('year', dms.stay_date) AS year
      FROM daily_metrics_snapshots dms
      
      -- [NEW] Join with the hotels table to get the go_live_date
      JOIN hotels h ON dms.hotel_id = h.hotel_id
      
      WHERE
        dms.hotel_id = $1
        
        -- [NEW] Filter 1: Only include data on or after the hotel's true go-live date
        AND dms.stay_date >= h.go_live_date
        
        -- [NEW] Filter 2: Only include years that have actual sales data, not just zero-rows
        AND (dms.rooms_sold > 0 OR dms.gross_revenue > 0)
        
      ORDER BY
        year ASC;
    `;
    
    const result = await pgPool.query(query, [propertyId]);
    
    // Return an array of year strings, e.g., ["2023", "2024", "2025"]
    res.json(result.rows.map(row => row.year.toString()));

  } catch (error) {
    console.error("Error fetching available years:", error);
    res.status(500).json({ error: "Failed to fetch available years." });
  }
});

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

    // --- [NEW] Handle different report types ---
const {
      // COMMON FIELDS
      propertyId,
      reportName,
      recipients, // This is an array from the frontend, e.g., ["a@b.com", "c@d.com"]
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      // NEW TYPE DISCRIMINATOR
      reportType, // "standard" or "shreeji"
      // STANDARD REPORT FIELDS
      metricsHotel,
      metricsMarket,
      addComparisons,
      displayOrder,
      displayTotals,
      includeTaxes,
      reportPeriod,
      attachmentFormats,
    } = req.body;

// --- [NEW] Set defaults and nullify params based on type ---
    const safeReportType = reportType || 'standard';
    const isShreeji = safeReportType === 'shreeji';

    // These values are for "Standard" reports. If it's a Shreeji report,
    // we set them to non-null defaults to satisfy database constraints.
    const safeMetricsHotel = isShreeji ? [] : metricsHotel;
    const safeMetricsMarket = isShreeji ? [] : (Array.isArray(metricsMarket) ? metricsMarket : []);
    const safeAddComparisons = isShreeji ? false : !!addComparisons;
    
    // [FIX] All columns below must have a non-null default to prevent constraint errors.
    const safeDisplayOrder = isShreeji ? "metric" : (displayOrder ?? "metric");
    const safeDisplayTotals = isShreeji ? false : displayTotals;
    const safeIncludeTaxes = isShreeji ? false : (includeTaxes ?? true);
    const safeReportPeriod = isShreeji ? "daily" : (reportPeriod ?? "daily"); // Provide a non-null default
    const safeAttachmentFormats = isShreeji ? [] : (attachmentFormats ?? []); // Provide a non-null default
    // --- [END NEW LOGIC] ---

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
          attachment_formats,
          report_type 
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, $17)
        RETURNING *
      `,
      [
        internalUserId, // $1
        propertyId, // $2
        reportName, // $3
        Array.isArray(recipients) ? recipients.join(',') : recipients, // $4
        frequency, // $5
        dayOfWeek, // $6
        dayOfMonth, // $7
        timeOfDay, // $8
        // [MODIFIED] Use the new "safe" variables
        safeMetricsHotel, // $9
        safeMetricsMarket, // $10
        safeAddComparisons, // $11
        safeDisplayOrder, // $12
        safeDisplayTotals, // $13
        safeIncludeTaxes, // $14
        safeReportPeriod, // $15
        safeAttachmentFormats, // $16
        // [NEW] Save the report type
        safeReportType, // $17
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error creating scheduled report:", error);
    res.status(500).json({ error: error.message });
  }
});
/**
 * @route POST /api/reports/run
 * @description Runs a "Performance Metrics" report and returns the aggregated data.
 * @access User
 */
router.post("/run", requireUserApi, async (req, res) => {
  // Prevent API response caching
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  try {
    // --- 1. Get and Validate Parameters ---
    const {
      propertyId,
      startDate,
      endDate,
      granularity = "daily",
      metrics, // Expects { hotel: ['occupancy', 'adr'], market: ['market-occupancy'] }
      includeTaxes = false,
    } = req.body;

    if (!propertyId || !startDate || !endDate || !metrics) {
      return res.status(400).json({ error: "Missing required report parameters." });
    }

// --- 2. Security Check (re-using logic from dashboard) ---
if (req.session.role !== "super_admin" && req.session.role !== "admin") {
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

    // --- 3. Get Competitive Set (re-using logic from dashboard) ---
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
      if (category) {
        const categoryCompSetResult = await pgPool.query(
          "SELECT hotel_id FROM hotels WHERE category = $1 AND hotel_id != $2",
          [category, propertyId]
        );
        competitorIds = categoryCompSetResult.rows.map((row) => row.hotel_id);
      } else {
        competitorIds = [];
      }
    }

    // --- 4. Build Dynamic SQL Query ---
    const period = getPeriod(granularity); // Granularity is correctly used here
    const allHotelIds = [propertyId, ...competitorIds];

    // Helper function to generate the SQL for a specific metric
    const getMetricSql = (metric, isMarket, useTaxes) => {
      // Determine if we are querying for the hotel ($1) or the market (NOT $1)
      const hotelIdCheck = isMarket ? "hotel_id != $1" : "hotel_id = $1";
      // The alias in the SELECT statement (e.g., "adr" or "market-adr")
      const alias = isMarket ? `market-${metric}` : metric;

      // Return the correct SQL snippet for the requested metric
      // This switch now respects the 'useTaxes' flag
      switch (metric) {
        case "occupancy":
          return `AVG(CASE WHEN ${hotelIdCheck} THEN occupancy_direct END) AS "${alias}"`;
        case "adr":
          return `AVG(CASE WHEN ${hotelIdCheck} THEN ${
            useTaxes ? "gross_adr" : "net_adr"
          } END) AS "${alias}"`;
        case "revpar":
          return `AVG(CASE WHEN ${hotelIdCheck} THEN ${
            useTaxes ? "gross_revpar" : "net_revpar"
          } END) AS "${alias}"`;
        case "total-revenue":
          return `SUM(CASE WHEN ${hotelIdCheck} THEN ${
            useTaxes ? "gross_revenue" : "net_revenue"
          } END) AS "${alias}"`;
        case "rooms-sold":
          return `SUM(CASE WHEN ${hotelIdCheck} THEN rooms_sold END) AS "${alias}"`;
        case "rooms-unsold":
          return `SUM(CASE WHEN ${hotelIdCheck} THEN (capacity_count - rooms_sold) END) AS "${alias}"`;
        default:
          return null; // Ignore any unknown metrics
      }
    };

    // Dynamically build the SELECT clauses based on the 'metrics' object
    const { hotel: hotelMetrics = [], market: marketMetrics = [] } = metrics;
    const selectClauses = [];

    // Generate SQL for requested hotel metrics
    hotelMetrics.forEach((metric) => {
      const sql = getMetricSql(metric, false, includeTaxes);
      if (sql) selectClauses.push(sql);
    });

    // Generate SQL for requested market metrics
    marketMetrics.forEach((metric) => {
      // The metric from the frontend is 'market-occupancy', so we strip the prefix
      const metricName = metric.replace("market-", "");
      const sql = getMetricSql(metricName, true, includeTaxes);
      if (sql) selectClauses.push(sql);
    });

    // If no valid metrics were selected, return empty data to avoid a SQL error
    if (selectClauses.length === 0) {
      return res.json([]);
    }

    // Construct the final query with the dynamic SELECT clauses
    const query = `
      SELECT
        ${period} AS period,
        ${selectClauses.join(",\n    ")}
      FROM daily_metrics_snapshots
      WHERE
        hotel_id = ANY($4::int[]) AND
        stay_date BETWEEN $2 AND $3
      GROUP BY period
      ORDER BY period ASC;
    `;

    // Execute the query
    const result = await pgPool.query(query, [
      propertyId,
      startDate,
      endDate,
      allHotelIds,
    ]);

    // --- 5. Return Data ---
    res.json(result.rows);
} catch (error) {
    console.error("Error running performance report:", error);
    res.status(500).json({ error: "Failed to run report." });
  }
});

/**
 * @route DELETE /api/reports/scheduled-reports/:id
 * @description Deletes a scheduled report.
 * @access User
 */
router.delete("/scheduled-reports/:id", requireUserApi, async (req, res) => {
  try {
    const { id } = req.params;

    // --- 1. Get Internal User ID ---
    // (This ensures a user can only delete their own reports)
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    const internalUserId = userResult.rows[0].user_id;

    // --- 2. Execute Delete Query ---
// --- 2. Execute Delete Query ---
    // [FIX] Changed 'schedule_id' to 'id' to match the database schema
    const deleteResult = await pgPool.query(
      `DELETE FROM scheduled_reports
       WHERE id = $1 AND user_id = $2
       RETURNING id`, // Also changed this to 'id'
      [id, internalUserId]
    );

    // --- 3. Check if anything was deleted ---
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ 
        error: "Scheduled report not found or you do not have permission to delete it." 
      });
    }
// --- 4. Send Success Response ---
    res.status(200).json({ 
      message: "Schedule deleted successfully.", 
      id: deleteResult.rows[0].id // [FIX] Changed 'schedule_id' to 'id'
    });

  } catch (error) {
    console.error("Error deleting scheduled report:", error);
    res.status(500).json({ error: "Failed to delete scheduled report." });
  }
});

/**
 * @route POST /api/reports/year-on-year
 * @description Runs a "Year-on-Year Comparison" report.
 * @access User
 */
router.post("/year-on-year", requireUserApi, async (req, res) => {
  // Prevent API response caching
  res.set({
    "Cache-Control": "no-store", "Pragma": "no-cache", "Expires": "0",
  });

  try {
    // --- 1. Get and Validate Parameters ---
    const { propertyId, year1, year2 } = req.body;

    if (!propertyId || !year1 || !year2) {
      return res.status(400).json({ error: "Missing required parameters: propertyId, year1, and year2." });
    }
// --- 2. Security Check (re-using logic from /run endpoint) ---
if (req.session.role !== "super_admin" && req.session.role !== "admin") {
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

    // --- 3. Build and Execute SQL Query ---
    // This query uses conditional aggregation to get data for both years in a single pass.
    // It groups by month number (1-12) and provides all metrics.
    // We multiply occupancy by 100 to send a percentage (e.g., 75.0) as the frontend expects.
    const query = `
      SELECT
        date_part('month', stay_date) AS month_number,
        
 -- Aggregates for Year 1 (e.g., 2024)
        COALESCE(
          (SUM(CASE WHEN date_part('year', stay_date) = $2 THEN rooms_sold END)::numeric /
           NULLIF(SUM(CASE WHEN date_part('year', stay_date) = $2 THEN capacity_count END), 0)) * 100
        , 0) AS y1_occupancy,
        COALESCE(AVG(CASE WHEN date_part('year', stay_date) = $2 THEN gross_adr END), 0) AS y1_adr,
        COALESCE(AVG(CASE WHEN date_part('year', stay_date) = $2 THEN gross_revpar END), 0) AS y1_revpar,
        COALESCE(SUM(CASE WHEN date_part('year', stay_date) = $2 THEN gross_revenue END), 0) AS y1_revenue,
        COALESCE(SUM(CASE WHEN date_part('year', stay_date) = $2 THEN rooms_sold END), 0) AS y1_rooms_sold,

        -- Aggregates for Year 2 (e.g., 2025)
        COALESCE(
          (SUM(CASE WHEN date_part('year', stay_date) = $3 THEN rooms_sold END)::numeric /
           NULLIF(SUM(CASE WHEN date_part('year', stay_date) = $3 THEN capacity_count END), 0)) * 100
        , 0) AS y2_occupancy,
        COALESCE(AVG(CASE WHEN date_part('year', stay_date) = $3 THEN gross_adr END), 0) AS y2_adr,
        COALESCE(AVG(CASE WHEN date_part('year', stay_date) = $3 THEN gross_revpar END), 0) AS y2_revpar,
        COALESCE(SUM(CASE WHEN date_part('year', stay_date) = $3 THEN gross_revenue END), 0) AS y2_revenue,
        COALESCE(SUM(CASE WHEN date_part('year', stay_date) = $3 THEN rooms_sold END), 0) AS y2_rooms_sold
        
      FROM daily_metrics_snapshots
      WHERE
        hotel_id = $1 AND
        (date_part('year', stay_date) = $2 OR date_part('year', stay_date) = $3)
      GROUP BY month_number
      ORDER BY month_number ASC;
    `;
    
    // Pass years as numbers for the SQL query
    const result = await pgPool.query(query, [propertyId, parseInt(year1), parseInt(year2)]);

    // --- 4. Format Data for Frontend ---
    // Transform the flat SQL result into the nested JSON structure the component expects.
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Create a full 12-month array template
    const fullYearData = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1; // 1-12
      // Find the corresponding data from our SQL query
      const row = result.rows.find(r => r.month_number == monthIndex);

      if (row) {
        // If data exists for this month, format it
        return {
          month: monthNames[i],
          year1: {
            occupancy: parseFloat(row.y1_occupancy),
            adr: parseFloat(row.y1_adr),
            revpar: parseFloat(row.y1_revpar),
            revenue: parseFloat(row.y1_revenue),
            roomsSold: parseInt(row.y1_rooms_sold),
          },
          year2: {
            occupancy: parseFloat(row.y2_occupancy),
            adr: parseFloat(row.y2_adr),
            revpar: parseFloat(row.y2_revpar),
            revenue: parseFloat(row.y2_revenue),
            roomsSold: parseInt(row.y2_rooms_sold),
          }
        };
      } else {
        // If no data exists (e.g., future month), return a zero-filled object
        return {
          month: monthNames[i],
          year1: { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 },
          year2: { occupancy: 0, adr: 0, revpar: 0, revenue: 0, roomsSold: 0 },
        };
      }
    });

    res.json(fullYearData);

  } catch (error) {
    console.error("Error running Year-on-Year report:", error);
    res.status(500).json({ error: "Failed to run report." });
  }
});

module.exports = router;


