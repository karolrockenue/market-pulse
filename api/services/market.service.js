const db = require("../utils/db");
const {
  calculatePriceIndex,
  calculateMarketDemand,
  calculatePace,
} = require("../utils/market-codex.utils");
const { getHotelPrice } = require("../utils/scraper.utils.js");

// Helper to ensure city names match DB slugs (e.g. "Las Vegas" -> "las-vegas")
const slugify = (city) =>
  city ? city.toLowerCase().trim().replace(/\s+/g, "-") : "";

class MarketService {
  /**
   * --- MARKET TRENDS (From market.router.js) ---
   * Fetches monthly Occupancy, ADR, and RevPAR trends for a city.
   */
  static async getMarketTrends(city, years, tierArray) {
    // Calculate Date Range from Years
    const yearArray = Array.isArray(years) ? years : [years];
    const minYear = Math.min(...yearArray.map((y) => parseInt(y)));
    const maxYear = Math.max(...yearArray.map((y) => parseInt(y)));
    const startDate = new Date(Date.UTC(minYear, 0, 1));
    const endDate = new Date(Date.UTC(maxYear, 11, 31));
    const totalDaysInPeriod =
      (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;

    // Build Query
    // [FIX] Removed totalDaysInPeriod to match the loose validation query (3 params only)
    let queryParams = [city, startDate, endDate];
    let tierFilterSql = "";

    if (tierArray && tierArray.length > 0) {
      queryParams.push(tierArray);
      tierFilterSql = `AND category = ANY($${queryParams.length}::text[])`;
    }

    // [DEBUG MODE] Relaxed query for local testing
    const query = `
            WITH TargetHotels AS (
                SELECT h.hotel_id
                FROM hotels h
                WHERE LOWER(h.city) = LOWER($1)
                  ${tierFilterSql}
            )
       SELECT
                date_trunc('month', dms.stay_date) as period,
                h.category,
                (SUM(dms.rooms_sold)::numeric / NULLIF(SUM(dms.capacity_count), 0)) as occupancy,
                AVG(dms.gross_adr) as adr,
                AVG(dms.gross_revpar) as revpar
            FROM daily_metrics_snapshots dms
            JOIN hotels h ON dms.hotel_id = h.hotel_id
            WHERE dms.hotel_id IN (SELECT hotel_id FROM TargetHotels)
              AND dms.stay_date >= $2 AND dms.stay_date <= $3
            GROUP BY period, h.category
            ORDER BY period, h.category ASC;
        `;

    const result = await db.query(query, queryParams);
    return result.rows;
  }

  /**
   * --- MARKET KPIs (From market.router.js) ---
   * Calculates YoY changes using "Average of Changes" logic.
   */
  static async getMarketKPIs(city) {
    // Define the date ranges
    const today = new Date();
    const endDateCurrent = new Date(today);
    const startDateCurrent = new Date(
      new Date().setDate(today.getDate() - 364)
    );
    const endDatePrior = new Date(new Date().setDate(today.getDate() - 365));
    const startDatePrior = new Date(new Date().setDate(today.getDate() - 729));

    const query = `
    -- CTE 1: Define the date ranges to be used throughout the query.
    WITH DateRanges AS (
        SELECT $2::date AS current_start, $3::date AS current_end,
               $4::date AS prior_start, $5::date AS prior_end
    ),
    -- CTE 2: Find all hotels that are eligible for this YoY comparison.
    ValidatedHotels AS (
        SELECT hotel_id
        FROM hotels, DateRanges
        WHERE city = $1
          AND go_live_date IS NOT NULL
          -- THIS IS THE NEW RULE: Only include hotels with a go_live_date at least 2 months
          -- before the start of the comparison period, ensuring they are mature properties.
          AND go_live_date <= (DateRanges.prior_start - INTERVAL '2 months')
    ),
    -- CTE 3: Calculate the average metrics for each hotel for both the current and prior periods.
    HotelYoY AS (
        SELECT
            h.hotel_id,
            AVG(CASE WHEN dms.stay_date BETWEEN dr.current_start AND dr.current_end THEN dms.gross_revpar END) as current_revpar,
            AVG(CASE WHEN dms.stay_date BETWEEN dr.prior_start AND dr.prior_end THEN dms.gross_revpar END) as prior_revpar,
           AVG(CASE WHEN dms.stay_date BETWEEN dr.current_start AND dr.current_end THEN dms.gross_adr END) as current_adr,
            AVG(CASE WHEN dms.stay_date BETWEEN dr.prior_start AND dr.prior_end THEN dms.gross_adr END) as prior_adr,
            -- [FIX] Correctly calculate occupancy from source columns
            (SUM(CASE WHEN dms.stay_date BETWEEN dr.current_start AND dr.current_end THEN dms.rooms_sold END)::numeric /
             NULLIF(SUM(CASE WHEN dms.stay_date BETWEEN dr.current_start AND dr.current_end THEN dms.capacity_count END), 0)) as current_occupancy,
            (SUM(CASE WHEN dms.stay_date BETWEEN dr.prior_start AND dr.prior_end THEN dms.rooms_sold END)::numeric /
             NULLIF(SUM(CASE WHEN dms.stay_date BETWEEN dr.prior_start AND dr.prior_end THEN dms.capacity_count END), 0)) as prior_occupancy
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges dr
        WHERE h.hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
        GROUP BY h.hotel_id
    )
    -- Final SELECT: Calculate the final market values.
    SELECT
        -- THIS IS THE NEW LOGIC: Average the individual percentage changes of each hotel.
        AVG( (current_revpar - prior_revpar) / NULLIF(prior_revpar, 0) ) AS revpar_change,
        AVG( (current_adr - prior_adr) / NULLIF(prior_adr, 0) ) AS adr_change,
        AVG( current_occupancy - prior_occupancy ) AS occupancy_change,
        
        -- Also calculate the simple market-wide averages for display on the KPI cards.
        AVG(current_revpar) as current_revpar,
        AVG(prior_revpar) as prior_revpar,
        AVG(current_adr) as current_adr,
        AVG(prior_adr) as prior_adr,
        AVG(current_occupancy) as current_occupancy,
        AVG(prior_occupancy) as prior_occupancy
    FROM HotelYoY;
  `;

    const result = await db.query(query, [
      city,
      startDateCurrent,
      endDateCurrent,
      startDatePrior,
      endDatePrior,
    ]);
    return result.rows[0] || {};
  }

  /**
   * --- NEIGHBORHOODS (From market.router.js) ---
   * Aggregates metrics for all neighborhoods.
   */
  static async getNeighborhoods(city) {
    const endDateCurrent = new Date();
    const startDateCurrent = new Date(
      new Date().setDate(endDateCurrent.getDate() - 364)
    );
    const endDatePrior = new Date(
      new Date().setDate(endDateCurrent.getDate() - 365)
    );
    const startDatePrior = new Date(
      new Date().setDate(endDateCurrent.getDate() - 729)
    );

    const query = `
    WITH DateRanges AS (
        SELECT $2::date AS current_start, $3::date AS current_end,
               $4::date AS prior_start, $5::date AS prior_end
    ),
    NeighborhoodMetricsCurrent AS (
        SELECT
            h.neighborhood,
           COUNT(DISTINCT h.hotel_id) as hotel_count,
            -- THE FIX: Use the new gross columns
            AVG(dms.gross_revpar) AS revpar,
            AVG(dms.gross_adr) AS adr,
            -- [FIX] Correctly calculate occupancy from source columns
            (SUM(dms.rooms_sold)::numeric / NULLIF(SUM(dms.capacity_count), 0)) AS occupancy
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges
        WHERE h.city = $1 AND h.go_live_date IS NOT NULL
          AND h.go_live_date <= DateRanges.current_start
          AND dms.stay_date BETWEEN DateRanges.current_start AND DateRanges.current_end
        GROUP BY h.neighborhood
    ),
    NeighborhoodMetricsPrior AS (
        SELECT
            h.neighborhood,
            -- THE FIX: Use the new gross_revpar column
            AVG(dms.gross_revpar) AS prior_revpar
        FROM hotels h
        JOIN daily_metrics_snapshots dms ON h.hotel_id = dms.hotel_id
        CROSS JOIN DateRanges
        WHERE h.city = $1 AND h.go_live_date IS NOT NULL
          AND h.go_live_date <= DateRanges.prior_start
          AND dms.stay_date BETWEEN DateRanges.prior_start AND DateRanges.prior_end
        GROUP BY h.neighborhood
    )
    SELECT
        nmc.neighborhood AS name, nmc.revpar, nmc.adr, nmc.occupancy, nmc.hotel_count,
        CASE
            WHEN nmp.prior_revpar > 0 THEN (nmc.revpar - nmp.prior_revpar) / nmp.prior_revpar * 100
            ELSE NULL
        END AS yoy
    FROM NeighborhoodMetricsCurrent nmc
    LEFT JOIN NeighborhoodMetricsPrior nmp ON nmc.neighborhood = nmp.neighborhood
    WHERE nmc.neighborhood IS NOT NULL
    ORDER BY nmc.revpar DESC;
  `;

    const result = await db.query(query, [
      city,
      startDateCurrent,
      endDateCurrent,
      startDatePrior,
      endDatePrior,
    ]);
    return result.rows;
  }

  /**
   * --- SEASONALITY YEARS (From market.router.js) ---
   */
  static async getAvailableSeasonalityYears(city) {
    const query = `
    -- For each year, check if there is at least one hotel that was live
    -- for the entirety of that year.
    SELECT DISTINCT EXTRACT(YEAR FROM s.yr)::integer AS year
    FROM generate_series(
      '2022-01-01'::date,
      (CURRENT_DATE - INTERVAL '1 year'),
      '1 year'
    ) AS s(yr)
    WHERE EXISTS (
      SELECT 1
      FROM hotels h
      WHERE h.city = $1
        AND h.go_live_date IS NOT NULL
        -- The hotel must have been live on or before the first day of the year.
        AND h.go_live_date <= s.yr
    )
    ORDER BY year DESC;
  `;
    const result = await db.query(query, [city]);
    return result.rows.map((row) => row.year);
  }

  /**
   * --- SEASONALITY DATA (From market.router.js) ---
   */
  static async getSeasonalityData(city, year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const query = `
     WITH ValidatedHotels AS (
            SELECT hotel_id
            FROM hotels
            WHERE city = $1
              AND go_live_date IS NOT NULL
              -- NEW: Only include hotels that were live before the start of 2024.
              AND go_live_date < '2024-01-01'
        )
        SELECT
            stay_date::date AS date,
            -- THE FIX: Use the new gross_revpar column
            AVG(gross_revpar) AS value
        FROM daily_metrics_snapshots
        WHERE hotel_id IN (SELECT hotel_id FROM ValidatedHotels)
          AND stay_date BETWEEN $2 AND $3
        GROUP BY stay_date
        ORDER BY stay_date ASC;
    `;
    const result = await db.query(query, [city, startDate, endDate]);
    return result.rows;
  }

  /**
   * --- FORWARD VIEW (From planning.router.js) ---
   * Get the *latest full scrape* for the next 90 days.
   */
  static async getForwardView(city) {
    // 1. Force slug format (handles "Las Vegas" -> "las-vegas")
    const citySlug = slugify(city);

    const sql = `
      SELECT DISTINCT ON (checkin_date)
        checkin_date,
        total_results,
        weighted_avg_price, 
        -- Fallback: If hotel_count is null, use total_results (supply)
        COALESCE(hotel_count, total_results) as hotel_count
      FROM market_availability_snapshots
      WHERE
        LOWER(city_slug) = LOWER($1)
        AND checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY
        checkin_date ASC, 
        scraped_at DESC;
    `;

    const { rows } = await db.query(sql, [citySlug]);
    let processedRows = calculatePriceIndex(rows);
    processedRows = calculateMarketDemand(processedRows);
    return processedRows;
  }

  /**
   * --- MARKET OUTLOOK (From planning.router.js) ---
   * Originally /market-trend. Using "rolling forecast" logic.
   */
  static async getMarketOutlook(city) {
    const query = `
    WITH DateRange AS (
      -- 1. Find the min/max dates of available scrape data
      SELECT
        MIN((scraped_at AT TIME ZONE 'UTC')::date) AS start_date,
        MAX((scraped_at AT TIME ZONE 'UTC')::date) AS end_date
      FROM market_availability_snapshots
      WHERE city_slug = $1
    ),
    Config AS (
      -- 2. Cap the total window at 30 days and get the half-window
      SELECT
        end_date,
        -- Cap at 30 days, or use available days if less
        LEAST((end_date - start_date + 1), 30) AS total_window_days
      FROM DateRange
    ),
    Periods AS (
      -- 3. Define the two periods to compare based on the half-window
      SELECT
        FLOOR(total_window_days / 2) AS half_window_days,
        end_date AS recent_period_end,
        (end_date - (FLOOR(total_window_days / 2) - 1) * INTERVAL '1 day') AS recent_period_start,
        (end_date - FLOOR(total_window_days / 2) * INTERVAL '1 day') AS past_period_end,
        (end_date - (FLOOR(total_window_days / 2) * 2 - 1) * INTERVAL '1 day') AS past_period_start
      FROM Config
    ),
    -- 4. [NEW] Calculate the "Past" outlook using the correct rolling 30-day forecast logic
    Past_Forecast_Snapshots AS (
      SELECT
        AVG(total_results) AS avg_30day_supply,
        AVG(weighted_avg_price) AS avg_30day_wap
      FROM market_availability_snapshots, Periods p
      WHERE
        city_slug = $1
        AND (scraped_at AT TIME ZONE 'UTC')::date BETWEEN p.past_period_start AND p.past_period_end
        -- Only look at the next 30 days for each scrape
        AND checkin_date BETWEEN (scraped_at AT TIME ZONE 'UTC')::date AND ((scraped_at AT TIME ZONE 'UTC')::date + INTERVAL '29 days')
      GROUP BY
        (scraped_at AT TIME ZONE 'UTC')::date
    ),
    Past_Outlook AS (
      -- 5. [NEW] Average the daily forecasts from the "Past" period
      SELECT
        AVG(avg_30day_supply) AS past_supply,
        AVG(avg_30day_wap) AS past_wap
      FROM Past_Forecast_Snapshots
    ),
    -- 6. [NEW] Calculate the "Recent" outlook
    Recent_Forecast_Snapshots AS (
      SELECT
        AVG(total_results) AS avg_30day_supply,
        AVG(weighted_avg_price) AS avg_30day_wap
      FROM market_availability_snapshots, Periods p
      WHERE
        city_slug = $1
        AND (scraped_at AT TIME ZONE 'UTC')::date BETWEEN p.recent_period_start AND p.recent_period_end
        AND checkin_date BETWEEN (scraped_at AT TIME ZONE 'UTC')::date AND ((scraped_at AT TIME ZONE 'UTC')::date + INTERVAL '29 days')
      GROUP BY
        (scraped_at AT TIME ZONE 'UTC')::date
    ),
    Recent_Outlook AS (
      -- 7. [NEW] Average the daily forecasts from the "Recent" period
      SELECT
        AVG(avg_30day_supply) AS recent_supply,
        AVG(avg_30day_wap) AS recent_wap
      FROM Recent_Forecast_Snapshots
    )
    -- 8. Final Select: Combine all results
SELECT
      p.half_window_days,
      po.past_supply,
      po.past_wap,
      ro.recent_supply,
      ro.recent_wap
    FROM
      Periods p,
      Past_Outlook po,
      Recent_Outlook ro;
  `;

    // Force slug format
    const { rows } = await db.query(query, [slugify(city)]);

    if (!rows.length || !rows[0].recent_supply) {
      return {
        status: "stable",
        metric: "Data Populating",
        period: "",
      };
    }

    const data = rows[0];
    const pastSupply = parseFloat(data.past_supply);
    const recentSupply = parseFloat(data.recent_supply);
    const pastWap = parseFloat(data.past_wap);
    const recentWap = parseFloat(data.recent_wap);

    const supplyDelta = ((recentSupply - pastSupply) / pastSupply) * 100;
    const wapDelta = ((recentWap - pastWap) / pastWap) * 100;

    // Market Demand is the inverse of Supply change
    const marketDemandDelta = -supplyDelta;

    let status = "stable";
    let metric = "";
    let metric_name = "market demand"; // Default to market demand

    // 1. Primary check: Market Demand (Supply Change)
    if (marketDemandDelta > 1) {
      // e.g., Supply *dropped* > 1%
      status = "strengthening";
      metric = `+${marketDemandDelta.toFixed(1)}%`;
      metric_name = "market demand";
    } else if (marketDemandDelta < -1) {
      // e.g., Supply *rose* > 1%
      status = "softening";
      metric = `${marketDemandDelta.toFixed(1)}%`;
      metric_name = "market demand";
    }
    // 2. Secondary check: Price (if Demand is stable)
    else if (wapDelta > 1) {
      status = "strengthening";
      metric = `+${wapDelta.toFixed(1)}%`;
      metric_name = "market price";
    } else if (wapDelta < -1) {
      status = "softening";
      metric = `${wapDelta.toFixed(1)}%`;
      metric_name = "market price";
    }
    // 3. Both are stable: Default to showing the Market Demand delta
    else {
      status = "stable";
      metric = `${marketDemandDelta > 0 ? "+" : ""}${marketDemandDelta.toFixed(
        1
      )}%`;
      metric_name = "market demand";
    }

    return {
      status,
      metric,
      // debug info
      debug: {
        marketDemandDelta,
        supplyDelta,
        wapDelta,
        half_window_days: data.half_window_days,
        pastWap,
        recentWap,
        pastSupply,
        recentSupply,
      },
    };
  }

  /**
   * --- PACE (From planning.router.js) ---
   */
  static async getPaceData(city, period) {
    const citySlug = slugify(city);

    // --- Query 1: Get LATEST data for all 90 days ---
    const latestSql = `
      SELECT DISTINCT ON (checkin_date)
        checkin_date, total_results, weighted_avg_price, 
        COALESCE(hotel_count, total_results) as hotel_count
      FROM market_availability_snapshots
      WHERE
        LOWER(city_slug) = LOWER($1)
        AND checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY
        checkin_date ASC, scraped_at DESC;
    `;

    const { rows: latestRowsRaw } = await db.query(latestSql, [citySlug]);

    // --- Query 2: Get PAST data for all 90 days ---
    const pastSql = `
      WITH TargetPastScrape AS (
        -- 1. Find the most recent date that a scrape ran, on or before N days ago
        SELECT MAX((scraped_at AT TIME ZONE 'UTC')::date) AS past_scrape_date
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND (scraped_at AT TIME ZONE 'UTC')::date <= (CURRENT_DATE - $2 * INTERVAL '1 day')
      )
      -- 2. Get the latest data for each check-in day *from that specific scrape date*
      SELECT DISTINCT ON (s.checkin_date)
        s.checkin_date, s.total_results, s.weighted_avg_price, 
        COALESCE(s.hotel_count, s.total_results) as hotel_count
      FROM market_availability_snapshots s, TargetPastScrape t
      WHERE LOWER(s.city_slug) = LOWER($1)
        AND s.checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        AND (s.scraped_at AT TIME ZONE 'UTC')::date = t.past_scrape_date
      ORDER BY s.checkin_date ASC, s.scraped_at DESC;
    `;

    const { rows: pastRowsRaw } = await db.query(pastSql, [citySlug, period]);

    let latestRowsProcessed = calculatePriceIndex(latestRowsRaw);
    latestRowsProcessed = calculateMarketDemand(latestRowsProcessed);

    let pastRowsProcessed = calculatePriceIndex(pastRowsRaw);
    pastRowsProcessed = calculateMarketDemand(pastRowsProcessed);

    // Calculate pace
    const paceData = calculatePace(latestRowsProcessed, pastRowsProcessed);
    return paceData;
  }

  /**
   * --- HISTORY (From planning.router.js) ---
   * Fetches 30-day scrape history for a *single* check-in date.
   */
  static async getScrapeHistory(city, date) {
    const citySlug = slugify(city);

    const sql = `
      SELECT
        scraped_at,
        total_results,
        weighted_avg_price,
        COALESCE(hotel_count, total_results) as hotel_count
      FROM market_availability_snapshots
      WHERE city_slug = $1
        AND checkin_date = $2
      ORDER BY scraped_at DESC
      LIMIT 30;
    `;

    const { rows } = await db.query(sql, [citySlug, date]);
    let processedRows = calculatePriceIndex(rows);
    processedRows = calculateMarketDemand(processedRows);

    return processedRows.reverse();
  }

  /**
   * --- SENTINEL PROPERTIES (From scraper.router.js) ---
   * Fetches properties for the Shadowfax tool.
   */
  static async getSentinelProperties() {
    const result = await db.query(
      `SELECT
         id AS property_id,
         asset_name AS property_name,
         genius_discount_pct
       FROM rockenue_managed_assets
       WHERE sentinel_active = true
       ORDER BY asset_name`
    );
    return result.rows;
  }

  /**
   * --- CHECK PRICE (From scraper.router.js / Shadowfax) ---
   * Uses Shadowfax logic hub.
   */
  static async checkAssetPrice(hotelId, checkinDate) {
    const assetQuery = await db.query(
      "SELECT booking_com_url FROM rockenue_managed_assets WHERE id = $1",
      [hotelId]
    );

    const asset = assetQuery.rows[0];

    if (!asset) {
      throw new Error("Asset not found.");
    }

    if (!asset.booking_com_url) {
      throw new Error(
        "This asset is not configured for price checking. (Missing booking_com_url)"
      );
    }

    // Call the Shadowfax "Logic Hub"
    const price = await getHotelPrice(asset.booking_com_url, checkinDate);

    return {
      hotelId,
      checkinDate,
      price,
    };
  }
}

module.exports = MarketService;
