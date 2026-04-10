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
  static async getMarketBaseline(citySlug) {
    const slug = slugify(citySlug);
    const { rows } = await db.query(`
      SELECT
        PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY weighted_avg_price) AS wap_p5,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY weighted_avg_price) AS wap_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY weighted_avg_price) AS wap_p50,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY weighted_avg_price) AS wap_p75,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY weighted_avg_price) AS wap_p95,
        PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY total_results) AS supply_p5,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_results) AS supply_p95,
        MIN(weighted_avg_price) AS wap_floor,
        MAX(weighted_avg_price) AS wap_ceil
      FROM market_availability_snapshots
      WHERE LOWER(city_slug) = LOWER($1)
        AND weighted_avg_price IS NOT NULL
    `, [slug]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      wapMin: parseFloat(r.wap_p5), wapMax: parseFloat(r.wap_p95),
      wapP25: parseFloat(r.wap_p25), wapP50: parseFloat(r.wap_p50), wapP75: parseFloat(r.wap_p75),
      wapFloor: parseFloat(r.wap_floor), wapCeil: parseFloat(r.wap_ceil),
      supplyMin: parseFloat(r.supply_p5), supplyMax: parseFloat(r.supply_p95),
    };
  }

  /**
   * Compute segment WAP (2-4★) from histogram by trimming 5★ from top and 1★ from bottom.
   */
  static _calcSegmentWap(histogram, minPrice, maxPrice, starRating) {
    if (!histogram?.length || !starRating) return null;

    const s5 = parseInt(starRating["5 stars"] || 0);
    const s1 = parseInt(starRating["1 star"] || 0);
    const totalRated = s1
      + parseInt(starRating["2 stars"] || 0)
      + parseInt(starRating["3 stars"] || 0)
      + parseInt(starRating["4 stars"] || 0)
      + s5;

    if (totalRated === 0) return null;

    const trimTopPct = s5 / totalRated;
    const trimBotPct = s1 / totalRated;

    const bucketWidth = (maxPrice - minPrice) / histogram.length;
    const buckets = histogram.map((val, i) => ({
      mid: minPrice + (i + 0.5) * bucketWidth,
      count: typeof val === "object" ? parseInt(val.count || 0) : parseInt(val || 0),
    }));

    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    if (totalCount === 0) return null;

    // Trim bottom (1★)
    let toTrimBot = Math.round(totalCount * trimBotPct);
    for (let i = 0; i < buckets.length && toTrimBot > 0; i++) {
      const remove = Math.min(buckets[i].count, toTrimBot);
      buckets[i].count -= remove;
      toTrimBot -= remove;
    }

    // Trim top (5★)
    let toTrimTop = Math.round(totalCount * trimTopPct);
    for (let i = buckets.length - 1; i >= 0 && toTrimTop > 0; i--) {
      const remove = Math.min(buckets[i].count, toTrimTop);
      buckets[i].count -= remove;
      toTrimTop -= remove;
    }

    let sumPxC = 0, sumC = 0;
    for (const b of buckets) { sumPxC += b.mid * b.count; sumC += b.count; }
    return sumC > 0 ? Math.round((sumPxC / sumC) * 100) / 100 : null;
  }

  static async getForwardView(city) {
    const citySlug = slugify(city);

    const sql = `
      SELECT DISTINCT ON (checkin_date)
        checkin_date,
        total_results,
        weighted_avg_price,
        facet_star_rating,
        facet_price_histogram,
        min_price_anchor,
        max_price_anchor,
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

    // Compute segment WAP per row, then strip heavy fields before returning
    let processedRows = rows.map((row) => {
      const segmentWap = MarketService._calcSegmentWap(
        row.facet_price_histogram,
        parseFloat(row.min_price_anchor),
        parseFloat(row.max_price_anchor),
        row.facet_star_rating
      );
      return {
        checkin_date: row.checkin_date,
        total_results: row.total_results,
        weighted_avg_price: row.weighted_avg_price,
        hotel_count: row.hotel_count,
        segment_wap: segmentWap,
      };
    });

    processedRows = calculatePriceIndex(processedRows);
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

  /**
   * Returns aggregated neighbourhood supply data from the most complete
   * recent scrape batch (last 14 days). Sums facet_neighbourhood counts
   * across all forward checkin dates to give a full market picture.
   */
  static async getNeighbourhoodSupply(citySlug) {
    const slug = slugify(citySlug);

    // Find the most complete batch in the last 14 days
    const batchRes = await db.query(
      `SELECT scraped_at::date AS batch_date, COUNT(*) AS days_covered
       FROM market_availability_snapshots
       WHERE city_slug = $1
         AND scraped_at >= CURRENT_DATE - INTERVAL '14 days'
       GROUP BY scraped_at::date
       ORDER BY days_covered DESC, batch_date DESC
       LIMIT 1`,
      [slug],
    );

    if (batchRes.rows.length === 0) return { batchDate: null, neighbourhoods: [] };

    const batchDate = batchRes.rows[0].batch_date;

    // Pull all facet_neighbourhood JSONB for that batch
    const dataRes = await db.query(
      `SELECT facet_neighbourhood
       FROM market_availability_snapshots
       WHERE city_slug = $1
         AND scraped_at::date = $2
         AND facet_neighbourhood IS NOT NULL`,
      [slug, batchDate],
    );

    // Aggregate: sum counts per neighbourhood across all checkin dates
    const totals = {};
    let dayCount = 0;
    for (const row of dataRes.rows) {
      const facets = row.facet_neighbourhood;
      if (!facets || typeof facets !== "object") continue;
      dayCount++;
      for (const [name, count] of Object.entries(facets)) {
        const num = parseInt(count, 10) || 0;
        if (!totals[name]) totals[name] = 0;
        totals[name] += num;
      }
    }

    // Build sorted array with average per day
    const neighbourhoods = Object.entries(totals)
      .map(([name, total]) => ({
        name,
        totalProperties: total,
        avgProperties: dayCount > 0 ? Math.round(total / dayCount) : 0,
      }))
      .sort((a, b) => b.totalProperties - a.totalProperties);

    return { batchDate, daysCovered: dayCount, neighbourhoods };
  }

  /**
   * Returns accommodation POIs for a city, using a DB cache.
   * On cache miss, queries OpenStreetMap Overpass API and stores the result.
   * Cache is considered fresh for 30 days.
   */
  static async getAccommodationMap(citySlug) {
    const slug = slugify(citySlug);

    // Check cache
    const cached = await db.query(
      `SELECT pois, fetched_at FROM city_accommodation_pois
       WHERE city_slug = $1 AND fetched_at > NOW() - INTERVAL '90 days'
       LIMIT 1`,
      [slug],
    );

    if (cached.rows.length > 0) {
      return { citySlug: slug, pois: cached.rows[0].pois, fetchedAt: cached.rows[0].fetched_at, source: "cache" };
    }

    // Derive bounding box from hotels in this city
    const bboxRes = await db.query(
      `SELECT
         MIN(latitude) AS min_lat, MAX(latitude) AS max_lat,
         MIN(longitude) AS min_lng, MAX(longitude) AS max_lng
       FROM hotels
       WHERE LOWER(REPLACE(city, ' ', '-')) = $1
         AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [slug],
    );

    const bbox = bboxRes.rows[0];
    if (bbox) {
      bbox.min_lat = parseFloat(bbox.min_lat);
      bbox.max_lat = parseFloat(bbox.max_lat);
      bbox.min_lng = parseFloat(bbox.min_lng);
      bbox.max_lng = parseFloat(bbox.max_lng);
    }
    if (!bbox || isNaN(bbox.min_lat)) {
      // Fallback: use well-known city centers with generous bbox
      const CITY_BBOX = {
        "london": { s: 51.28, n: 51.69, w: -0.51, e: 0.33 },
        "las-vegas": { s: 35.92, n: 36.33, w: -115.38, e: -114.92 },
      };
      const fb = CITY_BBOX[slug];
      if (!fb) return { citySlug: slug, pois: [], fetchedAt: null, source: "no-data" };
      bbox.min_lat = fb.s;
      bbox.max_lat = fb.n;
      bbox.min_lng = fb.w;
      bbox.max_lng = fb.e;
    } else {
      // Expand bbox by ~20% to capture surrounding area
      const latPad = (bbox.max_lat - bbox.min_lat) * 0.2 || 0.05;
      const lngPad = (bbox.max_lng - bbox.min_lng) * 0.2 || 0.05;
      bbox.min_lat -= latPad;
      bbox.max_lat += latPad;
      bbox.min_lng -= lngPad;
      bbox.max_lng += lngPad;
    }

    // Query Overpass API for accommodation nodes
    const bb = `${bbox.min_lat},${bbox.min_lng},${bbox.max_lat},${bbox.max_lng}`;
    const types = ["hotel", "hostel", "guest_house", "apartment", "motel"];
    const unions = types.flatMap((t) => [
      'nwr["tourism"="' + t + '"](' + bb + ");",
    ]).join("");
    const overpassQuery = '[out:json][timeout:90];(' + unions + ");out center;";

    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];
    let resp;
    for (const url of endpoints) {
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        });
        if (resp.ok) break;
        console.warn(`Overpass mirror ${url} returned ${resp.status}, trying next...`);
      } catch (err) {
        console.warn(`Overpass mirror ${url} failed: ${err.message}, trying next...`);
      }
    }

    if (!resp || !resp.ok) {
      console.error("All Overpass mirrors failed");
      return { citySlug: slug, pois: [], fetchedAt: null, source: "error" };
    }

    const data = await resp.json();
    const pois = (data.elements || [])
      .map((el) => ({
        name: el.tags?.name || null,
        type: el.tags?.tourism || "hotel",
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon,
        stars: el.tags?.stars ? parseInt(el.tags.stars, 10) : null,
      }))
      .filter((p) => p.lat && p.lng);

    // Upsert into cache
    await db.query(
      `INSERT INTO city_accommodation_pois (city_slug, pois, fetched_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (city_slug) DO UPDATE SET pois = $2, fetched_at = NOW()`,
      [slug, JSON.stringify(pois)],
    );

    return { citySlug: slug, pois, fetchedAt: new Date().toISOString(), source: "overpass" };
  }

  // ═══════════════════════════════════════════════════════
  // MARKET PROFILE — City-level analytics from scrape data
  // ═══════════════════════════════════════════════════════

  static async getProfileOverview(city) {
    const citySlug = slugify(city);
    // KPIs: total supply, hotels only, avg WAP, weekend premium, peak/cheapest
    const sql = `
      WITH latest AS (
        SELECT DISTINCT ON (checkin_date)
          checkin_date, total_results, weighted_avg_price,
          facet_property_type, EXTRACT(DOW FROM checkin_date) AS dow
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
        ORDER BY checkin_date, scraped_at DESC
      )
      SELECT
        ROUND(AVG(total_results)) AS avg_supply,
        ROUND(AVG(weighted_avg_price)) AS avg_wap,
        ROUND(AVG(CASE WHEN dow IN (5,6) THEN weighted_avg_price END)) AS weekend_wap,
        ROUND(AVG(CASE WHEN dow NOT IN (5,6) THEN weighted_avg_price END)) AS weekday_wap,
        MAX(total_results) AS max_supply,
        MIN(total_results) AS min_supply
      FROM latest;
    `;
    const { rows } = await db.query(sql, [citySlug]);

    // Property types from latest scrape
    const typesSql = `
      SELECT facet_property_type
      FROM market_availability_snapshots
      WHERE LOWER(city_slug) = LOWER($1)
        AND checkin_date = CURRENT_DATE + 1
      ORDER BY scraped_at DESC LIMIT 1;
    `;
    const typesRes = await db.query(typesSql, [citySlug]);
    const propertyTypes = typesRes.rows[0]?.facet_property_type || {};

    return { kpis: rows[0] || {}, propertyTypes };
  }

  static async getProfileSeasonal(city) {
    const citySlug = slugify(city);
    const sql = `
      SELECT
        TO_CHAR(checkin_date, 'Mon') AS month,
        EXTRACT(MONTH FROM checkin_date) AS month_num,
        TRIM(TO_CHAR(checkin_date, 'Dy')) AS dow,
        EXTRACT(DOW FROM checkin_date) AS dow_num,
        ROUND(AVG(weighted_avg_price)) AS avg_wap
      FROM market_availability_snapshots
      WHERE LOWER(city_slug) = LOWER($1)
        AND (checkin_date - scraped_at::date) BETWEEN 25 AND 35
      GROUP BY month, month_num, dow, dow_num
      ORDER BY month_num, dow_num;
    `;
    const { rows } = await db.query(sql, [citySlug]);
    return rows;
  }

  static async getProfileAbsorptionDow(city) {
    const citySlug = slugify(city);
    const sql = `
      WITH snapshots AS (
        SELECT
          checkin_date,
          TRIM(TO_CHAR(checkin_date, 'Day')) AS dow,
          EXTRACT(DOW FROM checkin_date) AS dow_num,
          (checkin_date - scraped_at::date) AS days_out,
          total_results
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND checkin_date >= CURRENT_DATE - INTERVAL '90 days'
      ),
      baseline AS (
        SELECT checkin_date, dow, dow_num, MAX(total_results) AS max_supply
        FROM snapshots
        WHERE days_out >= 60
        GROUP BY checkin_date, dow, dow_num
      )
      SELECT
        b.dow,
        s.days_out,
        ROUND(AVG(s.total_results::numeric / NULLIF(b.max_supply, 0) * 100), 1) AS pct_remaining
      FROM snapshots s
      JOIN baseline b ON s.checkin_date = b.checkin_date
      WHERE s.days_out IN (60, 45, 30, 21, 14, 7, 3, 1)
      GROUP BY b.dow, b.dow_num, s.days_out
      ORDER BY b.dow_num, s.days_out DESC;
    `;
    const { rows } = await db.query(sql, [citySlug]);
    return rows;
  }

  static async getProfilePriceMovement(city) {
    const citySlug = slugify(city);
    const sql = `
      SELECT
        (checkin_date - scraped_at::date) AS days_out,
        ROUND(AVG(weighted_avg_price)) AS avg_wap,
        ROUND(AVG(total_results)) AS avg_supply
      FROM market_availability_snapshots
      WHERE LOWER(city_slug) = LOWER($1)
        AND EXTRACT(DOW FROM checkin_date) = 6
        AND checkin_date >= CURRENT_DATE - INTERVAL '90 days'
        AND (checkin_date - scraped_at::date) IN (90, 60, 30, 14, 7, 3, 1)
      GROUP BY days_out
      ORDER BY days_out DESC;
    `;
    const { rows } = await db.query(sql, [citySlug]);
    return rows;
  }

  static async getProfileAbsorptionDate(city, targetDate) {
    const citySlug = slugify(city);
    const sql = `
      SELECT
        checkin_date,
        scraped_at::date AS snapshot_date,
        (checkin_date - scraped_at::date) AS days_out,
        total_results,
        ROUND(weighted_avg_price::numeric, 0) AS weighted_avg_price,
        facet_star_rating
      FROM market_availability_snapshots
      WHERE LOWER(city_slug) = LOWER($1)
        AND checkin_date = $2
      ORDER BY scraped_at ASC;
    `;
    const { rows } = await db.query(sql, [citySlug, targetDate]);
    return rows;
  }

  static async getProfileCompression(city) {
    const citySlug = slugify(city);
    const sql = `
      SELECT DISTINCT ON (checkin_date)
        checkin_date,
        (max_price_anchor - min_price_anchor) AS price_spread,
        ROUND(weighted_avg_price::numeric, 0) AS wap,
        total_results AS supply
      FROM market_availability_snapshots
      WHERE LOWER(city_slug) = LOWER($1)
        AND scraped_at::date = (SELECT MAX(scraped_at::date) FROM market_availability_snapshots WHERE LOWER(city_slug) = LOWER($1))
        AND checkin_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90
      ORDER BY checkin_date, scraped_at DESC;
    `;
    const { rows } = await db.query(sql, [citySlug]);
    return rows;
  }

  static async getProfileNeighbourhoods(city) {
    const citySlug = slugify(city);
    // Compare neighbourhood supply from the oldest scrape vs the newest scrape
    // for overlapping check-in dates — shows which areas absorbed the most
    const sql = `
      WITH date_range AS (
        SELECT checkin_date,
               MIN(scraped_at::date) AS first_scraped,
               MAX(scraped_at::date) AS last_scraped
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND facet_neighbourhood IS NOT NULL
          AND checkin_date >= CURRENT_DATE
        GROUP BY checkin_date
        HAVING COUNT(DISTINCT scraped_at::date) >= 2
      ),
      early AS (
        SELECT DISTINCT ON (m.checkin_date) m.checkin_date, m.facet_neighbourhood
        FROM market_availability_snapshots m
        JOIN date_range d ON m.checkin_date = d.checkin_date
        WHERE LOWER(m.city_slug) = LOWER($1)
          AND m.scraped_at::date <= d.first_scraped + 3
          AND m.facet_neighbourhood IS NOT NULL
        ORDER BY m.checkin_date, m.scraped_at ASC
      ),
      late AS (
        SELECT DISTINCT ON (m.checkin_date) m.checkin_date, m.facet_neighbourhood
        FROM market_availability_snapshots m
        JOIN date_range d ON m.checkin_date = d.checkin_date
        WHERE LOWER(m.city_slug) = LOWER($1)
          AND m.scraped_at::date >= d.last_scraped - 3
          AND m.facet_neighbourhood IS NOT NULL
        ORDER BY m.checkin_date, m.scraped_at DESC
      )
      SELECT
        key AS neighbourhood,
        ROUND(AVG((early.facet_neighbourhood->>key)::numeric)) AS supply_30d,
        ROUND(AVG((late.facet_neighbourhood->>key)::numeric)) AS supply_7d,
        ROUND((1 - AVG((late.facet_neighbourhood->>key)::numeric) / NULLIF(AVG((early.facet_neighbourhood->>key)::numeric), 0)) * 100, 1) AS pct_absorbed
      FROM early
      JOIN late ON early.checkin_date = late.checkin_date
      CROSS JOIN LATERAL jsonb_object_keys(early.facet_neighbourhood) AS key
      WHERE (early.facet_neighbourhood->>key) IS NOT NULL
        AND (late.facet_neighbourhood->>key) IS NOT NULL
      GROUP BY key
      HAVING AVG((early.facet_neighbourhood->>key)::numeric) > 50
      ORDER BY pct_absorbed DESC
      LIMIT 15;
    `;
    const { rows } = await db.query(sql, [citySlug]);
    return rows;
  }

  // ── PredictHQ Events ──

  static async getPredictHQEvents(citySlug) {
    const PREDICTHQ_TOKEN = process.env.PREDICTHQ_ACCESS_TOKEN;
    if (!PREDICTHQ_TOKEN) throw new Error("PREDICTHQ_ACCESS_TOKEN not configured");

    const CACHE_TTL_HOURS = 24;
    const slug = slugify(citySlug);

    // Check cache
    const cached = await db.query(
      `SELECT place_id, events, fetched_at FROM predicthq_events WHERE city_slug = $1`,
      [slug]
    );
    if (cached.rows.length > 0) {
      const age = (Date.now() - new Date(cached.rows[0].fetched_at).getTime()) / 3600000;
      if (age < CACHE_TTL_HOURS) {
        return { citySlug: slug, events: cached.rows[0].events, fetchedAt: cached.rows[0].fetched_at, source: "cache" };
      }
    }

    // Resolve place ID (use cached if available)
    let placeId = cached.rows[0]?.place_id || null;
    if (!placeId) {
      const headers = { Authorization: `Bearer ${PREDICTHQ_TOKEN}`, Accept: "application/json" };
      // Map city slug to a country for more accurate lookup
      const cityName = slug.replace(/-/g, " ");
      const placeRes = await fetch(
        `https://api.predicthq.com/v1/places/?q=${encodeURIComponent(cityName)}&type=locality&limit=1`,
        { headers }
      );
      if (!placeRes.ok) throw new Error(`PredictHQ Places API error: ${placeRes.status}`);
      const placeData = await placeRes.json();
      if (!placeData.results?.length) throw new Error(`No PredictHQ place found for "${cityName}"`);
      placeId = placeData.results[0].id;
    }

    // Fetch events for next 180 days to cover mockup date ranges
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const headers = { Authorization: `Bearer ${PREDICTHQ_TOKEN}`, Accept: "application/json" };

    // Look up city coordinates from the Places API result for radius search
    const placeLookup = await fetch(
      `https://api.predicthq.com/v1/places/?id=${placeId}&limit=1`,
      { headers }
    );
    const placeInfo = placeLookup.ok ? await placeLookup.json() : { results: [] };
    const coords = placeInfo.results?.[0]?.location; // [lng, lat]
    const withinParam = coords ? `30km@${coords[1]},${coords[0]}` : null;

    // Use radius search (catches suburbs like Wimbledon) with place.scope fallback
    const locationParam = withinParam ? { within: withinParam } : { "place.scope": placeId };

    // Fetch in two tiers to get both major and notable events within API limits
    const baseParams = {
      ...locationParam,
      "active.gte": today,
      "active.lte": end,
      category: "concerts,festivals,sports,conferences,expos,performing-arts",
      sort: "-rank",
      limit: "50",
    };

    // Tier 0: Blockbusters (rank >= 88) — guarantees Wimbledon, Pride, mega concerts
    const params0 = new URLSearchParams({ ...baseParams, "rank.gte": "88" });
    const res0 = await fetch(`https://api.predicthq.com/v1/events/?${params0}`, { headers });
    const data0 = res0.ok ? await res0.json() : { results: [] };

    // Tier 1: Major events (rank 80-87)
    const params1 = new URLSearchParams({ ...baseParams, "rank.gte": "80", "rank.lte": "87" });
    const res1 = await fetch(`https://api.predicthq.com/v1/events/?${params1}`, { headers });
    const data1 = res1.ok ? await res1.json() : { results: [] };

    // Tier 2: Notable events (rank 65-79) to fill in the mid-tier
    const params2 = new URLSearchParams({ ...baseParams, "rank.gte": "65", "rank.lte": "79" });
    const res2 = await fetch(`https://api.predicthq.com/v1/events/?${params2}`, { headers });
    const data2 = res2.ok ? await res2.json() : { results: [] };

    const allResults = [...(data0.results || []), ...(data1.results || []), ...(data2.results || [])];

    // Deduplicate by event ID
    const seen = new Set();
    const deduped = allResults.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Map to lean format
    const events = deduped.map((e) => {
      const localRank = e.local_rank || 0;
      const tier = localRank >= 90 ? "Extreme" : localRank >= 75 ? "High" : "Medium";
      return {
        id: e.id,
        title: e.title,
        category: e.category,
        start: e.start?.slice(0, 10) || e.start_local?.slice(0, 10) || null,
        end: e.end?.slice(0, 10) || e.end_local?.slice(0, 10) || null,
        rank: e.rank,
        localRank: localRank,
        attendance: e.phq_attendance || null,
        accommodationSpend: e.predicted_event_spend_industries?.accommodation || null,
        tier,
      };
    });

    // Upsert cache
    await db.query(
      `INSERT INTO predicthq_events (city_slug, place_id, events, fetched_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (city_slug) DO UPDATE SET place_id = $2, events = $3, fetched_at = NOW()`,
      [slug, placeId, JSON.stringify(events)]
    );

    return { citySlug: slug, events, fetchedAt: new Date().toISOString(), source: "predicthq" };
  }

  /**
   * Booking behavior analytics derived from the reservations table.
   * Returns lead-time distribution buckets and length-of-stay buckets.
   * hotelIds: array of integer hotel IDs to aggregate across.
   */
  static async getBookingBehavior(hotelIds) {
    if (!hotelIds?.length) return { leadTimeBuckets: [], losBuckets: [], avgLeadTime: 0, avgLos: 0, totalBookings: 0 };

    const result = await db.query(
      `SELECT
         check_in::date - booking_date::date AS lead_time,
         nights
       FROM reservations
       WHERE hotel_id = ANY($1::int[])
         AND status != 'canceled'
         AND booking_date >= CURRENT_DATE - INTERVAL '90 days'
         AND check_in IS NOT NULL
         AND booking_date IS NOT NULL`,
      [hotelIds]
    );

    const rows = result.rows;
    if (!rows.length) return { leadTimeBuckets: [], losBuckets: [], avgLeadTime: 0, avgLos: 0, totalBookings: 0 };

    // Lead time buckets
    const ltBuckets = [
      { label: "0–7d", min: 0, max: 7, count: 0 },
      { label: "8–14d", min: 8, max: 14, count: 0 },
      { label: "15–30d", min: 15, max: 30, count: 0 },
      { label: "31–60d", min: 31, max: 60, count: 0 },
      { label: "60d+", min: 61, max: Infinity, count: 0 },
    ];

    // LOS buckets
    const losBkts = [
      { label: "1 night", min: 1, max: 1, count: 0 },
      { label: "2 nights", min: 2, max: 2, count: 0 },
      { label: "3 nights", min: 3, max: 3, count: 0 },
      { label: "4+ nights", min: 4, max: Infinity, count: 0 },
    ];

    let totalLt = 0;
    let totalLos = 0;

    for (const row of rows) {
      const lt = parseInt(row.lead_time) || 0;
      const nights = parseInt(row.nights) || 1;
      totalLt += lt;
      totalLos += nights;

      for (const b of ltBuckets) {
        if (lt >= b.min && lt <= b.max) { b.count++; break; }
      }
      for (const b of losBkts) {
        if (nights >= b.min && nights <= b.max) { b.count++; break; }
      }
    }

    const total = rows.length;
    const ltColors = ["#ef4444", "#f97316", "#f59e0b", "#39BDF8", "#3b82f6"];
    const losColors = ["#39BDF8", "#f59e0b", "#f97316", "#8b5cf6"];

    return {
      leadTimeBuckets: ltBuckets.map((b, i) => ({
        label: b.label,
        value: Math.round((b.count / total) * 100),
        count: b.count,
        color: ltColors[i],
      })),
      losBuckets: losBkts.map((b, i) => ({
        label: b.label,
        value: Math.round((b.count / total) * 100),
        count: b.count,
        color: losColors[i],
      })),
      avgLeadTime: Math.round(totalLt / total),
      avgLos: Math.round((totalLos / total) * 10) / 10,
      totalBookings: total,
    };
  }

  /**
   * Forward occupancy (on-the-books) per stay_date for the next 90 days.
   * hotelIds: array of integer hotel IDs to aggregate across.
   */
  static async getHotelOtb(hotelIds) {
    if (!hotelIds?.length) return [];

    const result = await db.query(
      `SELECT
         stay_date,
         SUM(rooms_sold) AS rooms_sold,
         SUM(capacity_count) AS capacity
       FROM daily_metrics_snapshots
       WHERE hotel_id = ANY($1::int[])
         AND stay_date >= CURRENT_DATE
         AND stay_date < CURRENT_DATE + 90
       GROUP BY stay_date
       ORDER BY stay_date`,
      [hotelIds]
    );

    return result.rows.map((r) => ({
      date: r.stay_date,
      occupancy: r.capacity > 0 ? Math.round((r.rooms_sold / r.capacity) * 100) : 0,
      roomsSold: parseInt(r.rooms_sold) || 0,
      capacity: parseInt(r.capacity) || 0,
    }));
  }

  /**
   * --- AIRBNB INVESTOR VIEW (Archanes only, but slug-agnostic) ---
   * Aggregates everything the investor-facing page needs from
   * airbnb_availability_snapshots into one payload. Five SQL queries fan out
   * in parallel; the bulk of the slicing (mix, beds, ratings, concentration,
   * top-10) happens in JS off the registry result so we only round-trip once
   * for the per-property data.
   */
  static async getAirbnbInvestorView(citySlug) {
    const ARCHANES_CENTER = { lat: 35.2352, lng: 25.1594 };

    // ---- 1. Tracking + KPIs (single small query) ----
    // Note: scraped listings have NULL ids — Airbnb doesn't expose propertyId
    // in this payload. We identify unique properties by the natural key
    // (name + type + beds + lat + lng), matching the existing /airbnb-registry.
    const trackingQuery = db.query(
      `WITH all_listings AS (
         SELECT (l->>'price')::numeric AS price
         FROM airbnb_availability_snapshots s,
              jsonb_array_elements(s.listings) l
         WHERE s.city_slug = $1
           AND l->>'price' IS NOT NULL
           AND (l->>'price')::numeric > 0
       ),
       unique_props AS (
         SELECT DISTINCT
           l->>'name' AS name,
           l->>'type' AS type,
           l->>'beds' AS beds,
           (l->>'lat')::numeric AS lat,
           (l->>'lng')::numeric AS lng
         FROM airbnb_availability_snapshots s,
              jsonb_array_elements(s.listings) l
         WHERE s.city_slug = $1
       ),
       latest_snap AS (
         SELECT *
         FROM airbnb_availability_snapshots
         WHERE city_slug = $1
           AND scraped_at::date = (
             SELECT MAX(scraped_at::date)
             FROM airbnb_availability_snapshots
             WHERE city_slug = $1
           )
       )
       SELECT
         (SELECT MIN(scraped_at::date) FROM airbnb_availability_snapshots WHERE city_slug = $1) AS first_scrape,
         (SELECT MAX(scraped_at::date) FROM airbnb_availability_snapshots WHERE city_slug = $1) AS last_scrape,
         (SELECT COUNT(DISTINCT scraped_at::date) FROM airbnb_availability_snapshots WHERE city_slug = $1) AS total_scrapes,
         (SELECT COUNT(*) FROM unique_props) AS unique_properties,
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price) FROM all_listings) AS median_price_all_time,
         (SELECT AVG(avg_price) FROM latest_snap) AS forward_avg_price_latest,
         (SELECT AVG(total_listings) FROM latest_snap) AS avg_listings_latest`,
      [citySlug]
    );

    // ---- 2. Demand calendar (latest scrape, forward window) ----
    // scrape_unique_properties is the same on every row from a given scrape;
    // exposing it here lets us compute per-date occupancy as
    // 1 − total_listings / scrape_unique_properties.
    const calendarQuery = db.query(
      `SELECT
         checkin_date,
         total_listings,
         avg_price,
         median_price,
         scrape_unique_properties
       FROM airbnb_availability_snapshots
       WHERE city_slug = $1
         AND scraped_at::date = (
           SELECT MAX(scraped_at::date)
           FROM airbnb_availability_snapshots
           WHERE city_slug = $1
         )
       ORDER BY checkin_date ASC`,
      [citySlug]
    );

    // ---- 3. Day-of-week aggregation (latest scrape) ----
    const dowQuery = db.query(
      `SELECT
         EXTRACT(DOW FROM checkin_date)::int AS dow,
         AVG(avg_price)::numeric AS avg_price,
         AVG(total_listings)::numeric AS avg_listings,
         COUNT(*)::int AS sample_size
       FROM airbnb_availability_snapshots
       WHERE city_slug = $1
         AND scraped_at::date = (
           SELECT MAX(scraped_at::date)
           FROM airbnb_availability_snapshots
           WHERE city_slug = $1
         )
       GROUP BY EXTRACT(DOW FROM checkin_date)
       ORDER BY dow`,
      [citySlug]
    );

    // ---- 4. Price ladder (deciles from per-property avg) ----
    // Per-property aggregation uses the natural key — listings have NULL ids.
    const ladderQuery = db.query(
      `WITH registry AS (
         SELECT
           AVG((listing->>'price')::numeric) AS avg_price
         FROM airbnb_availability_snapshots s,
              jsonb_array_elements(s.listings) listing
         WHERE s.city_slug = $1
           AND (listing->>'price') IS NOT NULL
           AND (listing->>'price')::numeric > 0
         GROUP BY listing->>'name', listing->>'type', listing->>'beds',
                  listing->>'location',
                  (listing->>'lat')::numeric, (listing->>'lng')::numeric
       )
       SELECT
         percentile_cont(0.10) WITHIN GROUP (ORDER BY avg_price)::numeric AS p10,
         percentile_cont(0.25) WITHIN GROUP (ORDER BY avg_price)::numeric AS p25,
         percentile_cont(0.50) WITHIN GROUP (ORDER BY avg_price)::numeric AS p50,
         percentile_cont(0.75) WITHIN GROUP (ORDER BY avg_price)::numeric AS p75,
         percentile_cont(0.90) WITHIN GROUP (ORDER BY avg_price)::numeric AS p90,
         COUNT(*)::int AS sample_size
       FROM registry`,
      [citySlug]
    );

    // ---- 5. Full property registry (one trip → JS slices the rest) ----
    // Identity = name + type + beds + location + lat + lng (no id, see note above).
    const registryQuery = db.query(
      `SELECT
         listing->>'name' AS name,
         listing->>'type' AS type,
         listing->>'beds' AS beds,
         listing->>'location' AS location,
         (listing->>'lat')::numeric AS lat,
         (listing->>'lng')::numeric AS lng,
         MAX((listing->>'rating')::numeric) AS rating,
         MAX((listing->>'reviews')::int) AS reviews,
         ROUND(AVG((listing->>'price')::numeric), 2) AS avg_price,
         MIN((listing->>'price')::numeric) AS min_price,
         MAX((listing->>'price')::numeric) AS max_price,
         COUNT(DISTINCT s.scraped_at::date)::int AS times_seen,
         MIN(s.scraped_at::date) AS first_seen,
         MAX(s.scraped_at::date) AS last_seen
       FROM airbnb_availability_snapshots s,
            jsonb_array_elements(s.listings) AS listing
       WHERE s.city_slug = $1
         AND (listing->>'price') IS NOT NULL
         AND (listing->>'price')::numeric > 0
       GROUP BY listing->>'name', listing->>'type',
                listing->>'beds', listing->>'location',
                (listing->>'lat')::numeric, (listing->>'lng')::numeric
       ORDER BY avg_price DESC`,
      [citySlug]
    );

    const [
      trackingResult,
      calendarResult,
      dowResult,
      ladderResult,
      registryResult,
    ] = await Promise.all([
      trackingQuery,
      calendarQuery,
      dowQuery,
      ladderQuery,
      registryQuery,
    ]);

    const tracking = trackingResult.rows[0] || {};

    // Empty-state short circuit — return a stable shape
    if (!tracking.first_scrape || registryResult.rows.length === 0) {
      return {
        citySlug,
        tracking: {
          firstScrape: null,
          lastScrape: null,
          totalScrapes: 0,
          uniqueProperties: 0,
        },
        kpis: {
          uniqueProperties: 0,
          medianNightlyRate: null,
          forwardAvgRate: null,
          avgListingsPerNight: null,
        },
        demandCalendar: [],
        forwardAdrCurve: [],
        dowPremium: [],
        priceLadder: null,
        priceLadderByBeds: [],
        occupancyAnalysis: null,
        registry: [],
        propertyMix: [],
        bedsDistribution: [],
        ratingHistogram: [],
        concentration: null,
        topTen: [],
        caveats: {
          source: "Airbnb only",
          daysOfHistory: 0,
          notes: [
            "No data yet for this city.",
            "Single-source signal — no STR or Booking.com cross-check.",
          ],
        },
      };
    }

    // ---- Demand calendar: attach per-date occupancy proxy ----
    // occupancyPct = 1 − listings_for_date / scrape_unique_properties
    // This is the cleanest per-date demand signal we can derive — it
    // compares each forward date's available listings against the full
    // pool of properties seen during the same scrape.
    const demandCalendar = calendarResult.rows.map((r) => {
      const listings = Number(r.total_listings) || 0;
      const scrapeUnique = Number(r.scrape_unique_properties) || 0;
      const occupancyPct = scrapeUnique > 0
        ? Math.max(0, Math.min(100, Math.round((1 - listings / scrapeUnique) * 100)))
        : null;
      return {
        date: r.checkin_date,
        listings,
        scrapeUniqueProperties: scrapeUnique,
        avgPrice: r.avg_price !== null ? Number(r.avg_price) : null,
        medianPrice: r.median_price !== null ? Number(r.median_price) : null,
        occupancyPct,
      };
    });

    // ---- Forward ADR curve: same source, lighter shape ----
    const forwardAdrCurve = demandCalendar.map((d) => ({
      date: d.date,
      avgPrice: d.avgPrice,
      medianPrice: d.medianPrice,
    }));

    // ---- Day-of-week premium: midweek (Mon-Thu = dow 1..4) baseline ----
    const dowRows = dowResult.rows.map((r) => ({
      dow: Number(r.dow),
      avgPrice: r.avg_price !== null ? Number(r.avg_price) : null,
      avgListings: r.avg_listings !== null ? Number(r.avg_listings) : null,
      sampleSize: Number(r.sample_size) || 0,
    }));
    const midweek = dowRows.filter((d) => d.dow >= 1 && d.dow <= 4 && d.avgPrice);
    const midweekBaseline = midweek.length
      ? midweek.reduce((s, d) => s + d.avgPrice, 0) / midweek.length
      : null;
    const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowPremium = dowRows.map((d) => ({
      dow: d.dow,
      label: dowLabels[d.dow],
      avgPrice: d.avgPrice,
      premiumPct: midweekBaseline && d.avgPrice
        ? Math.round(((d.avgPrice / midweekBaseline) - 1) * 1000) / 10
        : null,
    }));

    // ---- Price ladder ----
    const ladderRow = ladderResult.rows[0] || {};
    const priceLadder = ladderRow.sample_size
      ? {
          p10: Number(ladderRow.p10),
          p25: Number(ladderRow.p25),
          p50: Number(ladderRow.p50),
          p75: Number(ladderRow.p75),
          p90: Number(ladderRow.p90),
          sampleSize: Number(ladderRow.sample_size),
        }
      : null;

    // ---- Registry: normalise once, slice many times ----
    // Synthesise a stable id from the natural key since scraped listings
    // don't carry one.
    const registry = registryResult.rows.map((r, idx) => {
      const lat = r.lat !== null ? Number(r.lat) : null;
      const lng = r.lng !== null ? Number(r.lng) : null;
      let distanceKm = null;
      if (lat !== null && lng !== null) {
        const dlat = (lat - ARCHANES_CENTER.lat) * 111;
        const dlng = (lng - ARCHANES_CENTER.lng) * 111 * Math.cos((ARCHANES_CENTER.lat * Math.PI) / 180);
        distanceKm = Math.round(Math.sqrt(dlat * dlat + dlng * dlng) * 100) / 100;
      }
      const propertyId = `p_${idx}_${(r.name || "").substring(0, 24).replace(/\s+/g, "_")}`;
      return {
        propertyId,
        name: r.name,
        type: r.type,
        beds: r.beds,
        location: r.location,
        lat,
        lng,
        rating: r.rating !== null ? Number(r.rating) : null,
        reviews: r.reviews !== null ? Number(r.reviews) : 0,
        avgPrice: Number(r.avg_price),
        minPrice: Number(r.min_price),
        maxPrice: Number(r.max_price),
        timesSeen: Number(r.times_seen),
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        distanceKm,
      };
    });

    // ---- Property mix donut ----
    const mixCounts = {};
    for (const p of registry) {
      const t = (p.type || "Other").trim() || "Other";
      mixCounts[t] = (mixCounts[t] || 0) + 1;
    }
    const propertyMix = Object.entries(mixCounts)
      .map(([type, count]) => ({
        type,
        count,
        pct: Math.round((count / registry.length) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // ---- Beds distribution: parse "1 bedroom, 2 beds" → bedroom bucket ----
    const bedBuckets = { "Studio": 0, "1 BR": 0, "2 BR": 0, "3 BR": 0, "4+ BR": 0, "Unknown": 0 };
    for (const p of registry) {
      const beds = (p.beds || "").toLowerCase();
      let bucket = "Unknown";
      if (/studio/.test(beds)) bucket = "Studio";
      else {
        const match = beds.match(/(\d+)\s*bedroom/);
        if (match) {
          const n = parseInt(match[1]);
          if (n === 1) bucket = "1 BR";
          else if (n === 2) bucket = "2 BR";
          else if (n === 3) bucket = "3 BR";
          else if (n >= 4) bucket = "4+ BR";
        }
      }
      bedBuckets[bucket]++;
    }
    const bedsDistribution = Object.entries(bedBuckets)
      .filter(([, count]) => count > 0)
      .map(([bucket, count]) => ({ bucket, count }));

    // ---- Rating histogram: 0.1-wide buckets from 4.0 to 5.0 ----
    const ratingBuckets = {};
    const bucketKeys = ["<4.0", "4.0-4.1", "4.1-4.2", "4.2-4.3", "4.3-4.4", "4.4-4.5", "4.5-4.6", "4.6-4.7", "4.7-4.8", "4.8-4.9", "4.9-5.0", "Unrated"];
    for (const k of bucketKeys) ratingBuckets[k] = 0;
    for (const p of registry) {
      if (p.rating === null || isNaN(p.rating)) {
        ratingBuckets["Unrated"]++;
      } else if (p.rating < 4.0) {
        ratingBuckets["<4.0"]++;
      } else if (p.rating >= 5.0) {
        ratingBuckets["4.9-5.0"]++;
      } else {
        const i = Math.floor((p.rating - 4.0) * 10);
        ratingBuckets[bucketKeys[1 + i]]++;
      }
    }
    const ratingHistogram = bucketKeys.map((bucket) => ({
      bucket,
      count: ratingBuckets[bucket],
    }));

    // ---- Concentration card ----
    const totalTimesSeen = registry.reduce((s, p) => s + p.timesSeen, 0);
    const top5Frequent = [...registry]
      .sort((a, b) => b.timesSeen - a.timesSeen)
      .slice(0, 5);
    const top5Share = totalTimesSeen > 0
      ? Math.round((top5Frequent.reduce((s, p) => s + p.timesSeen, 0) / totalTimesSeen) * 1000) / 10
      : 0;
    const within1km = registry.filter((p) => p.distanceKm !== null && p.distanceKm <= 1).length;
    const maxRate = registry.length ? Math.max(...registry.map((p) => p.maxPrice)) : 0;

    const concentration = {
      top5SharePct: top5Share,
      top5Frequent: top5Frequent.map((p) => ({
        propertyId: p.propertyId,
        name: p.name,
        timesSeen: p.timesSeen,
      })),
      propertiesWithin1km: within1km,
      maxNightlyRate: maxRate,
      totalProperties: registry.length,
    };

    // ---- Price ladder by bed configuration ----
    const bedBucketize = (s) => {
      if (!s) return "Unknown";
      const lower = String(s).toLowerCase();
      if (/studio/.test(lower)) return "Studio";
      const m = lower.match(/(\d+)\s*bedroom/);
      if (!m) return "Unknown";
      const n = parseInt(m[1]);
      if (n === 1) return "1 BR";
      if (n === 2) return "2 BR";
      if (n === 3) return "3 BR";
      return "4+ BR";
    };
    const percentile = (arr, q) => {
      if (!arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * q);
      return sorted[Math.min(idx, sorted.length - 1)];
    };
    const bedPriceBuckets = {};
    for (const p of registry) {
      const k = bedBucketize(p.beds);
      if (!bedPriceBuckets[k]) bedPriceBuckets[k] = [];
      bedPriceBuckets[k].push(p.avgPrice);
    }
    const bedOrder = ["Studio", "1 BR", "2 BR", "3 BR", "4+ BR", "Unknown"];
    const priceLadderByBeds = bedOrder
      .filter((k) => bedPriceBuckets[k] && bedPriceBuckets[k].length > 0)
      .map((k) => ({
        bucket: k,
        sampleSize: bedPriceBuckets[k].length,
        p10: Math.round(percentile(bedPriceBuckets[k], 0.10)),
        p25: Math.round(percentile(bedPriceBuckets[k], 0.25)),
        p50: Math.round(percentile(bedPriceBuckets[k], 0.50)),
        p75: Math.round(percentile(bedPriceBuckets[k], 0.75)),
        p90: Math.round(percentile(bedPriceBuckets[k], 0.90)),
      }));

    // ---- Occupancy proxy from per-property visibility ratios ----
    // For each unique property, visibility = timesSeen / totalScrapes.
    // Estimated occupancy = 1 − avg visibility. Biased high by Airbnb's
    // ~90-result page cap; will tighten once the scraper grabs more pages.
    const totalScrapes = Number(tracking.total_scrapes) || 0;
    const visibilityBuckets = { "0–20%": 0, "20–40%": 0, "40–60%": 0, "60–80%": 0, "80–100%": 0 };
    let visibilitySum = 0;
    for (const p of registry) {
      const ratio = totalScrapes > 0 ? Math.min(1, p.timesSeen / totalScrapes) : 0;
      visibilitySum += ratio;
      if (ratio <= 0.2) visibilityBuckets["0–20%"]++;
      else if (ratio <= 0.4) visibilityBuckets["20–40%"]++;
      else if (ratio <= 0.6) visibilityBuckets["40–60%"]++;
      else if (ratio <= 0.8) visibilityBuckets["60–80%"]++;
      else visibilityBuckets["80–100%"]++;
    }
    const avgVisibility = registry.length > 0 ? visibilitySum / registry.length : 0;
    const occupancyAnalysis = {
      estimatedOccupancyPct: Math.round((1 - avgVisibility) * 100),
      avgVisibilityPct: Math.round(avgVisibility * 100),
      totalScrapes,
      sampleSize: registry.length,
      visibilityHistogram: Object.entries(visibilityBuckets).map(([bucket, count]) => ({ bucket, count })),
    };

    // ---- Top 10 trophy properties (already sorted by avg_price DESC) ----
    const topTen = registry.slice(0, 10).map((p) => ({
      propertyId: p.propertyId,
      name: p.name,
      type: p.type,
      beds: p.beds,
      rating: p.rating,
      reviews: p.reviews,
      avgPrice: p.avgPrice,
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      timesSeen: p.timesSeen,
      distanceKm: p.distanceKm,
    }));

    // ---- Days of history (for badges) ----
    const firstScrapeDate = new Date(tracking.first_scrape);
    const lastScrapeDate = new Date(tracking.last_scrape);
    const daysOfHistory = Math.max(
      1,
      Math.round((lastScrapeDate - firstScrapeDate) / (1000 * 60 * 60 * 24)) + 1
    );

    return {
      citySlug,
      tracking: {
        firstScrape: tracking.first_scrape,
        lastScrape: tracking.last_scrape,
        totalScrapes: Number(tracking.total_scrapes) || 0,
        uniqueProperties: Number(tracking.unique_properties) || 0,
        daysOfHistory,
      },
      kpis: {
        uniqueProperties: Number(tracking.unique_properties) || 0,
        medianNightlyRate: tracking.median_price_all_time !== null
          ? Math.round(Number(tracking.median_price_all_time) * 100) / 100
          : null,
        forwardAvgRate: tracking.forward_avg_price_latest !== null
          ? Math.round(Number(tracking.forward_avg_price_latest) * 100) / 100
          : null,
        avgListingsPerNight: tracking.avg_listings_latest !== null
          ? Math.round(Number(tracking.avg_listings_latest))
          : null,
      },
      demandCalendar,
      forwardAdrCurve,
      dowPremium,
      priceLadder,
      priceLadderByBeds,
      occupancyAnalysis,
      registry,
      propertyMix,
      bedsDistribution,
      ratingHistogram,
      concentration,
      topTen,
      caveats: {
        source: "Airbnb only",
        daysOfHistory,
        notes: [
          "Single-source signal — no STR or Booking.com cross-check.",
          "Demand pressure is a supply-burn-down proxy, not metered occupancy.",
          "Property coordinates are Airbnb-fuzzed (±200m).",
        ],
      },
    };
  }
}

module.exports = MarketService;
