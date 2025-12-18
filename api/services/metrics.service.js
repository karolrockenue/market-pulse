const pgPool = require("../utils/db");
const { format } = require("date-fns");

/**
 * Returns a SQL string for DATE_TRUNC based on the granularity.
 * @param {string} granularity - 'daily', 'weekly', or 'monthly'
 * @returns {string} - A SQL snippet
 */
function getPeriod(granularity) {
  switch (granularity) {
    case "weekly":
      return "DATE_TRUNC('week', stay_date)";
    case "monthly":
      return "DATE_TRUNC('month', stay_date)";
    case "daily":
    default:
      return "DATE_TRUNC('day', stay_date)";
  }
}

const MetricsService = {
  /**
   * Fetches available years for a property based on sales data.
   */

  async getAvailableYears(propertyId) {
    console.log(
      `[DEBUG] getAvailableYears START. PropertyID: ${propertyId} (Type: ${typeof propertyId})`
    );

    const query = `
      SELECT DISTINCT date_part('year', dms.stay_date) AS year
      FROM daily_metrics_snapshots dms
      JOIN hotels h ON dms.hotel_id = h.hotel_id
      WHERE
        dms.hotel_id = $1
        AND dms.stay_date >= h.go_live_date
        AND (dms.rooms_sold > 0 OR dms.gross_revenue > 0)
      ORDER BY year ASC;
    `;

    try {
      const result = await pgPool.query(query, [propertyId]);
      console.log(
        `[DEBUG] getAvailableYears SUCCESS. Found ${result.rows.length} years.`
      );
      return result.rows.map((row) => row.year.toString());
    } catch (error) {
      console.error("[DEBUG] getAvailableYears FAILED.");
      console.error("SQL Error Message:", error.message);
      console.error("SQL Error Code:", error.code);
      console.error("SQL Hint:", error.hint);
      throw error;
    }
  },

  /**
   * Fetches KPI summary for a property and its market.
   */
  async getKPISummary(propertyId, startDate, endDate, competitorIds) {
    // Fallback for no competitors
    if (!competitorIds || competitorIds.length === 0) {
      const yourHotelQuery = `
          SELECT
            AVG(gross_adr) AS your_adr,
            (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) as your_occupancy_direct,
            AVG(gross_revpar) AS your_revpar,
            SUM(gross_revenue) AS your_total_revenue
          FROM daily_metrics_snapshots
          WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3;
        `;
      const result = await pgPool.query(yourHotelQuery, [
        propertyId,
        startDate,
        endDate,
      ]);
      return { yourHotel: result.rows[0] || {}, market: {} };
    }

    const kpiQuery = `
      SELECT
          AVG(CASE WHEN dms.hotel_id = $1 THEN dms.gross_adr ELSE NULL END) AS your_adr,
          SUM(CASE WHEN dms.hotel_id = $1 THEN dms.rooms_sold ELSE 0 END)::numeric /
          NULLIF(SUM(CASE WHEN dms.hotel_id = $1 THEN dms.capacity_count ELSE 0 END), 0) AS your_occupancy,
          AVG(CASE WHEN dms.hotel_id = $1 THEN dms.gross_revpar ELSE NULL END) AS your_revpar,
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

    return {
      yourHotel: {
        occupancy: kpis.your_occupancy,
        adr: kpis.your_adr,
        revpar: kpis.your_revpar,
        totalRevenue: kpis.your_total_revenue,
      },
      market: {
        occupancy: kpis.market_occupancy,
        adr: kpis.market_adr,
        revpar: kpis.market_revpar,
      },
    };
  },

  /**
   * Fetches detailed metrics from DB with capacity post-processing.
   */
  async getMetricsFromDB(
    propertyId,
    startDate,
    endDate,
    granularity = "daily"
  ) {
    // 1. Fetch total_rooms
    const hotelResult = await pgPool.query(
      "SELECT total_rooms FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (hotelResult.rows.length === 0) throw new Error("Hotel not found");
    const totalRooms = hotelResult.rows[0].total_rooms;

    // 2. Execute Query
    const period = getPeriod(granularity);
    const query = `
      SELECT
        ${period} as period,
        SUM(rooms_sold) as your_rooms_sold,
        (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) as your_occupancy_direct,
        AVG(gross_adr) as your_adr,
        AVG(gross_revpar) as your_revpar,
        SUM(gross_revenue) as your_total_revenue,
        SUM(net_revenue) as your_net_revenue,
        SUM(gross_revenue) as your_gross_revenue,
        AVG(net_adr) as your_net_adr,
        AVG(gross_adr) as your_gross_adr,
        AVG(net_revpar) as your_net_revpar,
        AVG(gross_revpar) as your_gross_revpar,
        COUNT(DISTINCT stay_date) as days_in_period
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date >= $2::date AND stay_date <= $3::date
      GROUP BY period ORDER BY period ASC;
    `;
    const result = await pgPool.query(query, [propertyId, startDate, endDate]);

    // 3. Post-process
    const today = new Date();
    const processedMetrics = await Promise.all(
      result.rows.map(async (row) => {
        const periodDate = new Date(row.period);
        const daysInPeriod = parseInt(row.days_in_period, 10);
        const correctCapacity = totalRooms ? totalRooms * daysInPeriod : null;
        let physicalUnsoldRemaining = null;

        const isCurrentMonthConditionMet =
          granularity === "monthly" &&
          periodDate.getUTCFullYear() === today.getUTCFullYear() &&
          periodDate.getUTCMonth() === today.getUTCMonth();

        if (isCurrentMonthConditionMet) {
          try {
            const unsoldQuery = `
              SELECT SUM(capacity_count - rooms_sold) AS physical_unsold_remaining
              FROM daily_metrics_snapshots
              WHERE hotel_id = $1
              AND stay_date >= CURRENT_DATE
              AND date_trunc('month', stay_date) = date_trunc('month', CURRENT_DATE);
          `;
            const unsoldResult = await pgPool.query(unsoldQuery, [propertyId]);
            const rawValue = unsoldResult.rows[0]?.physical_unsold_remaining;
            physicalUnsoldRemaining =
              rawValue !== null && rawValue !== undefined
                ? parseInt(rawValue, 10)
                : 0;
          } catch (unsoldError) {
            physicalUnsoldRemaining = 0;
          }
        }

        return {
          ...row,
          your_capacity_count: correctCapacity,
          physical_unsold_remaining: physicalUnsoldRemaining,
        };
      })
    );

    return processedMetrics;
  },

  /**
   * Fetches competitor metrics and details.
   */
  async getCompetitorMetrics(
    competitorIds,
    startDate,
    endDate,
    granularity = "daily"
  ) {
    if (!competitorIds || competitorIds.length === 0) {
      return { metrics: [], competitorCount: 0, totalRooms: 0, breakdown: {} };
    }

    // 1. Get Details
    const competitorDetailsQuery = `
        SELECT h.category, h.neighborhood, h.total_rooms
        FROM hotels h
        WHERE h.hotel_id = ANY($1::int[]);
    `;
    const { rows: competitorDetails } = await pgPool.query(
      competitorDetailsQuery,
      [competitorIds]
    );

    // 2. Build Breakdown
    const breakdown = { categories: {}, neighborhoods: {} };
    let totalRooms = 0;

    competitorDetails.forEach((hotel) => {
      const category = hotel.category?.trim();
      const neighborhood = hotel.neighborhood?.trim();
      const rooms = hotel.total_rooms || 0;
      totalRooms += rooms;

      if (neighborhood) {
        breakdown.neighborhoods[neighborhood] =
          (breakdown.neighborhoods[neighborhood] || 0) + 1;
      }

      if (category) {
        if (!breakdown.categories[category]) {
          breakdown.categories[category] = {
            properties: 0,
            rooms: 0,
            neighborhoods: {},
          };
        }
        breakdown.categories[category].properties += 1;
        breakdown.categories[category].rooms += rooms;
        if (neighborhood) {
          const categoryNeighborhoods =
            breakdown.categories[category].neighborhoods;
          categoryNeighborhoods[neighborhood] =
            (categoryNeighborhoods[neighborhood] || 0) + 1;
        }
      }
    });

    // 3. Get Metrics
    const period = getPeriod(granularity);
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

    return {
      metrics: result.rows,
      competitorCount: competitorIds.length,
      totalRooms,
      breakdown,
    };
  },

  /**
   * Fetches market ranking.
   */
  async getMarketRanking(propertyId, competitorIds, startDate, endDate) {
    const allHotelIds = [propertyId, ...competitorIds];
    const rankingQuery = `
      WITH HotelPerformance AS (
        SELECT
          hotel_id,
          AVG(gross_adr) AS adr,
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) AS occupancy,
          AVG(gross_revpar) AS revpar
        FROM daily_metrics_snapshots
        WHERE
          hotel_id = ANY($1::int[]) AND
          stay_date BETWEEN $2 AND $3
        GROUP BY hotel_id
      ),
      Rankings AS (
        SELECT
          hotel_id,
          RANK() OVER (ORDER BY occupancy DESC NULLS LAST) as occupancy_rank,
          RANK() OVER (ORDER BY adr DESC NULLS LAST) as adr_rank,
          RANK() OVER (ORDER BY revpar DESC NULLS LAST) as revpar_rank
        FROM HotelPerformance
      )
      SELECT occupancy_rank, adr_rank, revpar_rank
      FROM Rankings
      WHERE hotel_id = $4;
    `;
    const result = await pgPool.query(rankingQuery, [
      allHotelIds,
      startDate,
      endDate,
      propertyId,
    ]);
    return result.rows[0] || null;
  },

  /**
   * Fetches main dashboard chart data.
   */
  async getDashboardChart(
    propertyId,
    competitorIds,
    startDate,
    endDate,
    granularity = "daily"
  ) {
    const period = getPeriod(granularity);
    const query = `
      WITH AllData AS (
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
      SELECT
        period AS date,
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
    const result = await pgPool.query(query, [
      propertyId,
      startDate,
      endDate,
      competitorIds,
    ]);
    return result.rows;
  },

  /**
   * Fetches Year-on-Year metrics.
   */
  async getYearOnYearMetrics(propertyId, year1, year2) {
    const query = `
      SELECT
        date_part('month', stay_date) AS month_number,
        COALESCE(
          (SUM(CASE WHEN date_part('year', stay_date) = $2 THEN rooms_sold END)::numeric /
           NULLIF(SUM(CASE WHEN date_part('year', stay_date) = $2 THEN capacity_count END), 0)) * 100
        , 0) AS y1_occupancy,
        COALESCE(AVG(CASE WHEN date_part('year', stay_date) = $2 THEN gross_adr END), 0) AS y1_adr,
        COALESCE(AVG(CASE WHEN date_part('year', stay_date) = $2 THEN gross_revpar END), 0) AS y1_revpar,
        COALESCE(SUM(CASE WHEN date_part('year', stay_date) = $2 THEN gross_revenue END), 0) AS y1_revenue,
        COALESCE(SUM(CASE WHEN date_part('year', stay_date) = $2 THEN rooms_sold END), 0) AS y1_rooms_sold,

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
    const result = await pgPool.query(query, [
      propertyId,
      parseInt(year1),
      parseInt(year2),
    ]);
    return result.rows;
  },

  /**
   * Fetches 13-month snapshot for dashboard.
   */
  async getDashboardSnapshot(propertyId) {
    const query = `
      WITH MonthlyData AS (
        SELECT
          date_trunc('month', stay_date) AS month_start,
          SUM(rooms_sold) AS total_sold_room_nights,
          SUM(capacity_count) AS capacity_count,
          SUM(gross_revenue) AS revenue,
          AVG(gross_adr) AS adr,
          (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)) AS occupancy
        FROM daily_metrics_snapshots
        WHERE hotel_id = $1
          AND stay_date >= date_trunc('month', CURRENT_DATE - INTERVAL '13 months')
          AND stay_date < date_trunc('month', CURRENT_DATE + INTERVAL '2 months')
        GROUP BY 1
      )
      SELECT
        TO_CHAR(month_start, 'YYYY-MM') as period,
        occupancy,
        revenue,
        adr,
        total_sold_room_nights,
        capacity_count
      FROM MonthlyData;
    `;
    const result = await pgPool.query(query, [propertyId]);
    return result.rows;
  },

  /**
   * Fetches physical unsold rooms for current month.
   */
  async getPhysicalUnsold(propertyId) {
    const query = `
      SELECT SUM(capacity_count - rooms_sold) AS physical_unsold_remaining
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1
      AND stay_date >= CURRENT_DATE
      AND date_trunc('month', stay_date) = date_trunc('month', CURRENT_DATE);
    `;
    const result = await pgPool.query(query, [propertyId]);
    return result.rows[0]?.physical_unsold_remaining
      ? parseInt(result.rows[0].physical_unsold_remaining, 10)
      : 0;
  },

  /**
   * Fetches pickup history for pacing.
   */
  async getPickupHistory(propertyId) {
    const query = `
      SELECT
        TO_CHAR(date_trunc('month', stay_date), 'YYYY-MM') as period,
        SUM(rooms_sold) as history_rooms_sold
      FROM pacing_snapshots
      WHERE hotel_id = $1
        AND snapshot_date = CURRENT_DATE - INTERVAL '1 day'
        AND stay_date >= date_trunc('month', CURRENT_DATE)
        AND stay_date < date_trunc('month', CURRENT_DATE + INTERVAL '2 months')
      GROUP BY 1;
    `;
    const result = await pgPool.query(query, [propertyId]);
    return result.rows;
  },

  /**
   * Runs a dynamic report based on metrics configuration.
   */
  async runDynamicReport(
    propertyId,
    startDate,
    endDate,
    granularity,
    metrics,
    includeTaxes,
    competitorIds
  ) {
    const period = getPeriod(granularity);
    const allHotelIds = [propertyId, ...competitorIds];
    const { hotel: hotelMetrics = [], market: marketMetrics = [] } = metrics;
    const selectClauses = [];

    const getMetricSql = (metric, isMarket, useTaxes) => {
      const hotelIdCheck = isMarket ? "hotel_id != $1" : "hotel_id = $1";
      const alias = isMarket ? `market-${metric}` : metric;
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
          return null;
      }
    };

    hotelMetrics.forEach((m) => {
      const sql = getMetricSql(m, false, includeTaxes);
      if (sql) selectClauses.push(sql);
    });
    marketMetrics.forEach((m) => {
      const metricName = m.replace("market-", "");
      const sql = getMetricSql(metricName, true, includeTaxes);
      if (sql) selectClauses.push(sql);
    });

    if (selectClauses.length === 0) return [];

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
    const result = await pgPool.query(query, [
      propertyId,
      startDate,
      endDate,
      allHotelIds,
    ]);
    return result.rows;
  },

  // --- PORTFOLIO METHODS ---

  /**
   * Portfolio: Occupancy Problem List
   */
  async getPortfolioOccupancyProblemList(group, hotelId) {
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
      WHERE ${whereClause}
      ORDER BY occupancy ASC;
    `;
    const result = await pgPool.query(query, params);
    return result.rows;
  },

  /**
   * Portfolio: Pacing Overview (Data Only)
   */
  async getPortfolioPacingData(group, hotelId) {
    const params = [];
    const whereConditions = ["is_rockenue_managed = true"];
    if (group) {
      params.push(group);
      whereConditions.push(`management_group = $${params.length}`);
    }
    if (hotelId) {
      params.push(hotelId);
      whereConditions.push(`hotel_id = $${params.length}`);
    }
    const whereClause = whereConditions.join(" AND ");

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
        WHERE ${whereClause}
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
      SELECT
        h.hotel_id,
        h.property_name,
        COALESCE(h.total_rooms, 0) AS total_rooms,
        COALESCE(f30.forward_occupancy, 0) AS "forwardOccupancy",
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
      ORDER BY h.property_name;
    `;
    const result = await pgPool.query(query, params);
    return result.rows;
  },

  /**
   * Portfolio: Occupancy Matrix
   */
  async getPortfolioOccupancyMatrix(group, hotelId) {
    const params = [];
    const whereConditions = [
      "d.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '45 days'",
      "h.is_rockenue_managed = true",
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
      WHERE ${whereClause}
      ORDER BY
        h.property_name, d.stay_date;
    `;
    const result = await pgPool.query(query, params);
    return result.rows;
  },

  /**
   * Dashboard: Flowcast (90-day forward view with pickup)
   */
  async getDashboardFlowcast(propertyId) {
    const query = `
      SELECT
        d.stay_date,
        d.rooms_sold,
        d.capacity_count,
        COALESCE(p1.rooms_sold, 0) as rooms_sold_1d_ago,
        COALESCE(p3.rooms_sold, 0) as rooms_sold_3d_ago,
        COALESCE(p7.rooms_sold, 0) as rooms_sold_7d_ago
      FROM daily_metrics_snapshots d
      LEFT JOIN pacing_snapshots p1 ON d.hotel_id = p1.hotel_id 
           AND d.stay_date = p1.stay_date 
           AND p1.snapshot_date = CURRENT_DATE - INTERVAL '1 day'
      LEFT JOIN pacing_snapshots p3 ON d.hotel_id = p3.hotel_id 
           AND d.stay_date = p3.stay_date 
           AND p3.snapshot_date = CURRENT_DATE - INTERVAL '3 days'
      LEFT JOIN pacing_snapshots p7 ON d.hotel_id = p7.hotel_id 
           AND d.stay_date = p7.stay_date 
           AND p7.snapshot_date = CURRENT_DATE - INTERVAL '7 days'
      WHERE d.hotel_id = $1
        AND d.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY d.stay_date ASC;
    `;
    const result = await pgPool.query(query, [propertyId]);
    return result.rows;
  },

  /**
   * Dashboard: Recent Activity (Sales Ledger)
   */
  async getRecentActivity(propertyId) {
    // Aggregates sales ledger (bookings made) for the last 7 days
    const query = `
      WITH dates AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '6 days', 
          CURRENT_DATE, 
          '1 day'::interval
        )::date AS date
      )
      SELECT
        TO_CHAR(dates.date, 'Dy DD Mon') as "dateStr",
        CASE WHEN dates.date = CURRENT_DATE THEN true ELSE false END as "isToday",
        COALESCE(COUNT(dbr.id), 0) as bookings,
        COALESCE(SUM(dbr.room_nights), 0) as "roomNights",
        COALESCE(SUM(dbr.revenue), 0) as revenue,
        CASE 
          WHEN COALESCE(SUM(dbr.room_nights), 0) > 0 
          THEN COALESCE(SUM(dbr.revenue), 0) / SUM(dbr.room_nights) 
          ELSE 0 
        END as adr
      FROM dates
      LEFT JOIN daily_bookings_record dbr 
        ON dates.date = dbr.booking_date::date 
        AND dbr.hotel_id = $1
      GROUP BY dates.date
      ORDER BY dates.date ASC;
    `;
    const result = await pgPool.query(query, [propertyId]);
    return result.rows;
  },

  /**
   * Portfolio: Flowcast (90-day forward view with pickup)
   */
  async getPortfolioFlowcast(group, hotelId) {
    const params = [];
    const whereConditions = [
      "h.is_rockenue_managed = true",
      "d.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'",
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

    const query = `
      SELECT
        h.hotel_id,
        h.property_name,
        d.stay_date,
        d.rooms_sold,
        d.capacity_count,
        d.gross_adr as sentinel_rate,
        COALESCE(p1.rooms_sold, 0) as rooms_sold_1d_ago,
        COALESCE(p2.rooms_sold, 0) as rooms_sold_2d_ago
      FROM hotels h
      JOIN daily_metrics_snapshots d ON h.hotel_id = d.hotel_id
      LEFT JOIN pacing_snapshots p1 ON d.hotel_id = p1.hotel_id 
           AND d.stay_date = p1.stay_date 
           AND p1.snapshot_date = CURRENT_DATE - INTERVAL '1 day'
      LEFT JOIN pacing_snapshots p2 ON d.hotel_id = p2.hotel_id 
           AND d.stay_date = p2.stay_date 
           AND p2.snapshot_date = CURRENT_DATE - INTERVAL '2 days'
      WHERE ${whereClause}
      ORDER BY h.property_name, d.stay_date;
    `;

    const result = await pgPool.query(query, params);
    return result.rows;
  },
};

module.exports = MetricsService;
