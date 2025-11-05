// /api/routes/portfolio.router.js
console.log("--- RUNNING LATEST portfolio.router.js (v6-benchmark-refactor) ---");
const express = require("express");
const router = express.Router();
const pgPool = require("../utils/db");
const { requireAdminApi } = require("../utils/middleware");
// [NEW] Import the shared benchmark utility
const { getBenchmarks } = require("../utils/benchmark.utils");
// [NEW] Import date-fns to get the current month/year
const { format } = require('date-fns');

// Protect all routes in this file. Only super_admins can access them.
router.use(requireAdminApi);

/**
 * Endpoint: GET /api/portfolio/occupancy-problem-list
 * [MODIFIED] Now supports global filtering by group or hotelId
 */
router.get("/occupancy-problem-list", async (req, res) => {
  // [NEW] Add global filters
  const { group, hotelId } = req.query;
  const params = [];
  const whereConditions = ["h.is_rockenue_managed = true"];

  if (group) {
    params.push(group);
    whereConditions.push(`h.management_group = $${params.length}`);
  }
  if (hotelId) {
    params.push(hotelId);
    whereConditions.push(`h.hotel_id = $${params.length}`);
  }

  const whereClause = whereConditions.join(" AND ");
  // [END NEW]

  try {
    const query = `
      WITH forward_metrics AS (
        SELECT
          hotel_id,
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS forward_30_occ,
          SUM(capacity_count - rooms_sold) AS forward_30_unsold
        FROM daily_metrics_snapshots
        WHERE stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        GROUP BY hotel_id
      ),
      l30_adr AS (
        SELECT
          hotel_id,
          AVG(gross_adr) AS adr
        FROM daily_metrics_snapshots
        WHERE stay_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE - INTERVAL '1 day'
          AND gross_adr > 0
        GROUP BY hotel_id
      )
      SELECT
        h.hotel_id,
        h.property_name AS name,
        h.city,
        h.total_rooms,
        COALESCE(fm.forward_30_occ, 0) AS occupancy,
        COALESCE(fm.forward_30_unsold, COALESCE(h.total_rooms, 0) * 30) AS unsold_rooms,
        COALESCE(l.adr, 0) AS adr,
        null AS market_avg
      FROM hotels h
      LEFT JOIN forward_metrics fm ON h.hotel_id = fm.hotel_id
      LEFT JOIN l30_adr l ON h.hotel_id = l.hotel_id
      WHERE ${whereClause} -- [MODIFIED]
      ORDER BY occupancy ASC;
    `;
    const { rows } = await pgPool.query(query, params); // [MODIFIED]
    res.json(rows);
  } catch (error) {
    console.error("Error fetching portfolio occupancy problem list:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Endpoint: GET /api/portfolio/pacing-overview
 * [MODIFIED] Now supports global filtering by group or hotelId
 */
router.get("/pacing-overview", async (req, res) => {
  console.log(`[DEBUG /pacing-overview] Endpoint hit. Fetching data (v6-benchmark-refactor)...`);
  
  // [NEW] Add global filters
  const { group, hotelId } = req.query;
  const params = [];
  const whereConditions = ["is_rockenue_managed = true"]; // Note: no 'h.' prefix here for the CTE

  if (group) {
    params.push(group);
    whereConditions.push(`management_group = $${params.length}`);
  }
  if (hotelId) {
    params.push(hotelId);
    whereConditions.push(`hotel_id = $${params.length}`);
  }

  const whereClause = whereConditions.join(" AND ");
  // [END NEW]

  // [NEW] Get current month/year for the benchmark utility
  const now = new Date();
  const currentMonthName = format(now, 'MMM'); // e.g., 'Nov'
  const currentYear = format(now, 'yyyy'); // e.g., '2025'

  try {
    const query = `
      WITH dates AS (
        SELECT
          date_trunc('month', CURRENT_DATE) AS current_month_start,
          (date_trunc('month', CURRENT_DATE) + interval '1 month') AS next_month_start,
          (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day') AS next_month_end,
          EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '2 months' - interval '1 day'))::int AS days_in_next_month
      ),
      all_hotels AS (
        SELECT hotel_id, property_name, total_rooms
        FROM hotels
        WHERE ${whereClause} -- [MODIFIED]
      ),
      targets AS (
        SELECT hotel_id, month, target_revenue_gross
        FROM hotel_budgets
        WHERE budget_year = EXTRACT(YEAR FROM CURRENT_DATE)
          AND month IN (EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(MONTH FROM CURRENT_DATE) + 1)
      ),
      otb_metrics AS (
        SELECT
          hotel_id,
          date_trunc('month', stay_date) AS month_start,
          SUM(gross_revenue) AS otb_revenue,
          SUM(rooms_sold) AS otb_rooms,
          SUM(capacity_count) AS month_capacity
        FROM daily_metrics_snapshots, dates
        WHERE stay_date >= dates.current_month_start AND stay_date <= dates.next_month_end
        GROUP BY hotel_id, month_start
      ),
      forward_30_occ AS (
        SELECT
          hotel_id,
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) * 100 AS forward_occupancy
        FROM daily_metrics_snapshots
        WHERE stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        GROUP BY hotel_id
      ),
      physical_unsold_rest_of_month AS (
        SELECT
          d.hotel_id,
          SUM(d.capacity_count - d.rooms_sold) AS physical_unsold_remaining
        FROM daily_metrics_snapshots d
        JOIN hotels h ON d.hotel_id = h.hotel_id
        WHERE d.stay_date BETWEEN CURRENT_DATE AND (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')
          AND h.is_rockenue_managed = true
        GROUP BY d.hotel_id
      )
      -- [REMOVED] l30d_data, smly_data, benchmarks CTEs are gone

      SELECT
        h.hotel_id,
        h.property_name,
        COALESCE(h.total_rooms, 0) AS total_rooms,
        COALESCE(f30.forward_occupancy, 0) AS "forwardOccupancy",
        
        -- [REMOVED] All benchmark/debug columns (b.benchmark_adr, etc) are gone
        
        COALESCE(t_cur.target_revenue_gross, 0) AS "currentMonthTargetRevenue",
        COALESCE(otb_cur.otb_revenue, 0) AS "currentMonthOtbRevenue",
        COALESCE(pu.physical_unsold_remaining, h.total_rooms, 0) AS "currentMonthPhysicalUnsold",
        COALESCE(t_next.target_revenue_gross, 0) AS "nextMonthTargetRevenue",
        COALESCE(otb_next.otb_revenue, 0) AS "nextMonthOtbRevenue",
        COALESCE(otb_next.month_capacity, COALESCE(h.total_rooms, 0) * d.days_in_next_month) AS "nextMonthCapacity",
        COALESCE(otb_next.otb_rooms, 0) AS "nextMonthOtbRooms"
      FROM all_hotels h
      CROSS JOIN dates d
      LEFT JOIN targets t_cur ON h.hotel_id = t_cur.hotel_id AND t_cur.month = EXTRACT(MONTH FROM CURRENT_DATE)
      LEFT JOIN targets t_next ON h.hotel_id = t_next.hotel_id AND t_next.month = EXTRACT(MONTH FROM d.next_month_start)
      LEFT JOIN otb_metrics otb_cur ON h.hotel_id = otb_cur.hotel_id AND otb_cur.month_start = d.current_month_start
      LEFT JOIN otb_metrics otb_next ON h.hotel_id = otb_next.hotel_id AND otb_next.month_start = d.next_month_start
      LEFT JOIN forward_30_occ f30 ON h.hotel_id = f30.hotel_id
      LEFT JOIN physical_unsold_rest_of_month pu ON h.hotel_id = pu.hotel_id
      -- [REMOVED] LEFT JOIN benchmarks b... is gone
      ORDER BY h.property_name;
    `;

    const { rows } = await pgPool.query(query, params); // [MODIFIED]

    // --- [MODIFIED] JS Processing: Use Promise.all to map asynchronously ---
    // We must now 'await' the benchmark fetch for each hotel.
    const results = await Promise.all(rows.map(async (row) => {

      // --- [NEW] Fetch benchmark from single source of truth ---
      const benchmarkData = await getBenchmarks(row.hotel_id, currentMonthName, currentYear);
      // --- [DEBUG] ADD THIS BLOCK FOR CITYGATE ---
if (row.property_name.toLowerCase().includes('citygate')) {
  console.log('--- [DEBUG] CITYGATE DATA (Raw SQL Row) ---');
  console.log(row);
  console.log('--- [DEBUG] CITYGATE BENCHMARK ---');
  console.log(benchmarkData);
}
// --- [END DEBUG] ---
      // Use the authoritative values
      const benchmarkAdr = benchmarkData.benchmarkAdr;
      // Convert Occ from 75.0 (percentage) to 0.75 (decimal) for calculations
      const benchmarkOcc = benchmarkData.benchmarkOcc / 100.0; 
      // --- [END NEW] ---

      // --- Current Month Logic (now uses correct benchmarks) ---
      const currentMonthShortfall = parseFloat(row.currentMonthTargetRevenue) - parseFloat(row.currentMonthOtbRevenue);
      // Use the new benchmarkOcc
      const currentMonthRoomsLeftToSell = parseFloat(row.currentMonthPhysicalUnsold) * benchmarkOcc;
      let currentMonthRequiredADR = 0;
      if (currentMonthRoomsLeftToSell > 0 && currentMonthShortfall > 0) {
        currentMonthRequiredADR = currentMonthShortfall / currentMonthRoomsLeftToSell;
      } else if (currentMonthShortfall > 0) {
        currentMonthRequiredADR = 99999; // Impossible to hit
      }

      // --- Next Month Logic (now uses correct benchmarks) ---
      const nextMonthShortfall = parseFloat(row.nextMonthTargetRevenue) - parseFloat(row.nextMonthOtbRevenue);
      // Use the new benchmarkOcc
      const nextMonthProjectedRooms = parseFloat(row.nextMonthCapacity) * benchmarkOcc;
      const nextMonthRoomsLeftToSell = nextMonthProjectedRooms - parseFloat(row.nextMonthOtbRooms);
      let nextMonthRequiredADR = 0;
      if (nextMonthRoomsLeftToSell > 0 && nextMonthShortfall > 0) {
        nextMonthRequiredADR = nextMonthShortfall / nextMonthRoomsLeftToSell;
      } else if (nextMonthShortfall > 0) {
        nextMonthRequiredADR = 99999; // Impossible to hit
      }

      // --- Quadrant & Status Logic (now uses correct benchmarks) ---
      // Use the new benchmarkAdr
      const pacingDifficultyPercent = (benchmarkAdr > 0 ? (currentMonthRequiredADR / benchmarkAdr) : (currentMonthRequiredADR > 0 ? 999 : 1)) * 100;
      
      let quadrant, currentMonthStatus;
      
      if (currentMonthRequiredADR === 99999) {
          currentMonthStatus = 'red';
      } else if (pacingDifficultyPercent > 115) {
          currentMonthStatus = 'red';
      } else if (pacingDifficultyPercent > 100) {
          currentMonthStatus = 'yellow';
      } else {
          currentMonthStatus = 'green';
      }

      const fwdOcc = parseFloat(row.forwardOccupancy);
      // --- [DEBUG] ADD THIS BLOCK ---
if (row.property_name.toLowerCase().includes('citygate')) {
  console.log('--- [DEBUG] CITYGATE FINAL QUADTRANT LOGIC ---');
  console.log({
    property_name: row.property_name,
    fwdOcc: fwdOcc,
    currentMonthStatus: currentMonthStatus,
    pacingDifficultyPercent: pacingDifficultyPercent
  });
  console.log('-------------------------------------------');
}
// --- [END DEBUG] ---
      if (fwdOcc < 60 && currentMonthStatus === 'red') {
        quadrant = 'Critical Risk';
      } else if (fwdOcc >= 60 && currentMonthStatus === 'red') {
        quadrant = 'Rate Strategy Risk';
      } else if (fwdOcc < 60 && (currentMonthStatus === 'yellow' || currentMonthStatus === 'green')) {
        quadrant = 'Fill Risk';
      } else {
        quadrant = 'On Pace';
      }

      // Determine next month status
      let nextMonthStatus;
      // Use the new benchmarkAdr
      const nextPacingDifficulty = (benchmarkAdr > 0 ? (nextMonthRequiredADR / benchmarkAdr) : (nextMonthRequiredADR > 0 ? 999 : 1)) * 100;
      if (nextMonthRequiredADR === 99999) {
          nextMonthStatus = 'red';
      } else if (nextPacingDifficulty > 115) {
          nextMonthStatus = 'red';
      } else if (nextPacingDifficulty > 100) {
          nextMonthStatus = 'yellow';
      } else {
          nextMonthStatus = 'green';
      }

      // Debug log for the specific hotel from your changelog
      if (row.hotel_id === 318291) {
        console.log('--- [DEBUG /pacing-overview] JS CALC FOR ST GEORGE (318291) [v6-refactor] ---');
        // --- [DEBUG] ADD THIS BLOCK FOR CITYGATE ---
if (row.property_name.toLowerCase().includes('citygate')) {
  console.log('--- [DEBUG /pacing-overview] JS CALC FOR CITYGATE ---');
  console.log({
    source: benchmarkData.source,
    benchmarkAdr: benchmarkAdr,
    benchmarkOcc: benchmarkOcc,
    currentMonthRequiredADR: currentMonthRequiredADR,
    pacingDifficultyPercent: pacingDifficultyPercent,
    currentMonthStatus: currentMonthStatus,
    forwardOccupancy: fwdOcc,
    quadrant: quadrant // This is the final value
  });
  console.log('----------------------------------------------------');
}
// --- [END DEBUG] ---
        console.log({
          source: benchmarkData.source, // Log the source
          benchmarkAdr: benchmarkAdr,
          benchmarkOcc: benchmarkOcc,
          currentMonthRequiredADR: currentMonthRequiredADR,
          pacingDifficultyPercent: pacingDifficultyPercent,
          currentMonthStatus: currentMonthStatus,
          forwardOccupancy: fwdOcc,
          quadrant: quadrant
        });
        console.log('------------------------------------------------------------------');
      }

      return {
        hotelId: row.hotel_id,
        hotelName: row.property_name,
        // Quadrant Chart Data
        forwardOccupancy: fwdOcc,
        pacingDifficultyPercent: isNaN(pacingDifficultyPercent) ? 100 : pacingDifficultyPercent,
        quadrant: quadrant,
        // Pacing List Data
        currentMonthStatus: currentMonthStatus,
        currentMonthShortfall: currentMonthShortfall,
        currentMonthRequiredADR: currentMonthRequiredADR,
        nextMonthStatus: nextMonthStatus,
        nextMonthShortfall: nextMonthShortfall,
        nextMonthRequiredADR: nextMonthRequiredADR,
      };
    })); // End of Promise.all(rows.map(...))

    res.json(results);

  } catch (error) {
    console.error("Error fetching portfolio pacing overview:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Endpoint: GET /api/portfolio/occupancy-matrix
 * [MODIFIED] Now supports global filtering by group or hotelId
 */
router.get("/occupancy-matrix", async (req, res) => {
  // [NEW] Add global filters
  const { group, hotelId } = req.query;
  const params = [];
  const whereConditions = [
    "d.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'",
    "h.is_rockenue_managed = true"
  ];

  if (group) {
    params.push(group);
    whereConditions.push(`h.management_group = $${params.length}`);
  }
  if (hotelId) {
    params.push(hotelId);
    whereConditions.push(`h.hotel_id = $${params.length}`);
  }

  const whereClause = whereConditions.join(" AND ");
  // [END NEW]

  try {
    const query = `
      SELECT
        h.hotel_id,
        h.property_name,
        h.city,
        h.management_group AS "group",
        h.total_rooms,
        d.stay_date,
        d.rooms_sold,
        d.capacity_count,
        (d.rooms_sold::numeric / NULLIF(d.capacity_count, 0)) * 100 AS occupancy,
        d.gross_adr AS adr
      FROM hotels h
      LEFT JOIN daily_metrics_snapshots d ON h.hotel_id = d.hotel_id
      WHERE ${whereClause} -- [MODIFIED]
      ORDER BY
        h.property_name, d.stay_date;
    `;
    const { rows } = await pgPool.query(query, params); // [MODIFIED]

    // --- JS Processing: Aggregate flat data into nested structure ---
    const hotelsMap = new Map();

    for (const row of rows) {
      if (!hotelsMap.has(row.hotel_id)) {
        hotelsMap.set(row.hotel_id, {
          id: row.hotel_id,
          name: row.property_name,
          city: row.city,
          group: row.group,
          totalRooms: row.total_rooms,
          occupancy: 0, 
          riskLevel: 'low',
          matrixData: []
        });
      }

      // [FIX] This line is corrected from 'row..hotel_id' to 'row.hotel_id'
      const hotel = hotelsMap.get(row.hotel_id);
      hotel.matrixData.push({
        day: row.stay_date,
        occupancy: parseFloat(row.occupancy || 0),
        adr: parseFloat(row.adr || 0),
        available: (row.capacity_count - row.rooms_sold),
      });
    }

    // Calculate 30-day avg occupancy and risk level
    for (const hotel of hotelsMap.values()) {
      const first30Days = hotel.matrixData.slice(0, 30);
      if (first30Days.length > 0) {
        const avgOcc = first30Days.reduce((sum, day) => sum + day.occupancy, 0) / first30Days.length;
        hotel.occupancy = avgOcc;
        if (avgOcc < 45) hotel.riskLevel = 'critical';
        else if (avgOcc < 60) hotel.riskLevel = 'moderate';
        else hotel.riskLevel = 'low';
      }
    }

    res.json(Array.from(hotelsMap.values()));

  } catch (error) {
    // [FIX] Corrected a copy-paste error in the catch block
    console.error("Error fetching portfolio occupancy matrix:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;