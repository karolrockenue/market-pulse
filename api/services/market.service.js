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
    const sql = `
      WITH far AS (
        SELECT checkin_date, facet_neighbourhood
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND (checkin_date - scraped_at::date) BETWEEN 28 AND 35
          AND checkin_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE + 30
      ),
      near AS (
        SELECT checkin_date, facet_neighbourhood
        FROM market_availability_snapshots
        WHERE LOWER(city_slug) = LOWER($1)
          AND (checkin_date - scraped_at::date) BETWEEN 3 AND 9
          AND checkin_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE + 30
      )
      SELECT
        key AS neighbourhood,
        ROUND(AVG((far.facet_neighbourhood->>key)::numeric)) AS supply_30d,
        ROUND(AVG((near.facet_neighbourhood->>key)::numeric)) AS supply_7d,
        ROUND((1 - AVG((near.facet_neighbourhood->>key)::numeric) / NULLIF(AVG((far.facet_neighbourhood->>key)::numeric), 0)) * 100, 1) AS pct_absorbed
      FROM far, jsonb_object_keys(far.facet_neighbourhood) AS key
      JOIN near ON far.checkin_date = near.checkin_date
      GROUP BY key
      HAVING AVG((far.facet_neighbourhood->>key)::numeric) > 50
      ORDER BY pct_absorbed DESC;
    `;
    const { rows } = await db.query(sql, [citySlug]);
    return rows;
  }
}

module.exports = MarketService;
