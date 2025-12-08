// api/services/hotel.service.js

const pool = require("../utils/db");
const format = require("pg-format");
const fetch = require("node-fetch");

// Helper: Replicated from admin.router.js for the delete functionality
async function getAdminAccessToken(adminUserId, propertyId) {
  if (!propertyId) throw new Error("A propertyId is required.");

  const credsResult = await pool.query(
    `SELECT pms_credentials FROM user_properties WHERE property_id = $1 AND pms_credentials->>'refresh_token' IS NOT NULL LIMIT 1`,
    [propertyId]
  );
  const refreshToken = credsResult.rows[0]?.pms_credentials?.refresh_token;
  if (!refreshToken) return { accessToken: null }; // Fail gracefully for deletion

  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const response = await fetch("https://hotels.cloudbeds.com/api/v1.1/access_token", {
    method: "POST",
    body: params,
  });
  const tokenData = await response.json();
  return { accessToken: tokenData.access_token };
}

const HotelService = {
  /**
   * Fetches all hotels for the admin list.
   * Source: admin.router.js
   */
  getAllHotels: async () => {
    const { rows } = await pool.query(
      "SELECT hotel_id, property_name, total_rooms, property_type, city, category, neighborhood, is_rockenue_managed, management_group FROM hotels ORDER BY property_name"
    );
    return rows;
  },

  /**
   * Updates a hotel's quality category.
   * Source: admin.router.js
   */
  updateHotelCategory: async (hotelId, category) => {
    const result = await pool.query(
      "UPDATE hotels SET category = $1 WHERE hotel_id = $2",
      [category, hotelId]
    );
    return result.rowCount > 0;
  },

  /**
   * Updates management info (group or is_rockenue_managed) and syncs with Assets table.
   * Source: admin.router.js
   */
  updateHotelManagement: async (hotelId, field, value) => {
    // 1. Update the specific field
    const updateQuery = format(
      "UPDATE hotels SET %I = %L WHERE hotel_id = %L",
      field,
      value,
      hotelId
    );
    const result = await pool.query(updateQuery);
    
    if (result.rowCount === 0) return false;

    // 2. Instant Sync Logic (Copied from admin.router.js)
    if (field === 'is_rockenue_managed' && value === true) {
      const syncQuery = `
        INSERT INTO rockenue_managed_assets (
            market_pulse_hotel_id, asset_name, city, total_rooms, management_group, monthly_fee
        )
        SELECT 
            h.hotel_id::text, h.property_name, h.city, h.total_rooms, h.management_group, 0.00
        FROM 
            hotels h
        LEFT JOIN 
            rockenue_managed_assets rma ON h.hotel_id = rma.market_pulse_hotel_id::integer
        WHERE 
            h.hotel_id = $1
            AND h.is_rockenue_managed = true 
            AND rma.market_pulse_hotel_id IS NULL;
      `;
      await pool.query(syncQuery, [hotelId]);
    } else if (field === 'is_rockenue_managed' && value === false) {
      const deleteQuery = `
        DELETE FROM rockenue_managed_assets
        WHERE market_pulse_hotel_id = $1::text;
      `;
      await pool.query(deleteQuery, [hotelId]);
    }

    return true;
  },

  /**
   * Fetches distinct management groups.
   * Source: admin.router.js
   */
  getManagementGroups: async () => {
    const { rows } = await pool.query(
      `SELECT DISTINCT management_group 
       FROM hotels 
       WHERE management_group IS NOT NULL AND management_group != '' 
       ORDER BY management_group`
    );
    return rows.map(row => row.management_group);
  },

  /**
   * Fetches budget data for a specific year.
   * Source: budgets.router.js
   */
  getBudgets: async (hotelId, year) => {
    const budgetResult = await pool.query(
      `SELECT
         month,
         target_occupancy,
         target_adr_net,
         target_adr_gross,
         target_revenue_net,
         target_revenue_gross
       FROM hotel_budgets
       WHERE hotel_id = $1 AND budget_year = $2
       ORDER BY month ASC`,
      [hotelId, year]
    );

    // Transform to array of 12 months (matching original logic)
    const budgetMap = new Map();
    budgetResult.rows.forEach(row => {
      budgetMap.set(row.month, {
        target_occupancy: row.target_occupancy,
        target_adr_net: row.target_adr_net,
        target_adr_gross: row.target_adr_gross,
        target_revenue_net: row.target_revenue_net,
        target_revenue_gross: row.target_revenue_gross
      });
    });

    const fullBudget = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 1; i <= 12; i++) {
      const monthData = budgetMap.get(i);
      fullBudget.push({
        month: months[i - 1],
        targetOccupancy: monthData?.target_occupancy ?? null,
        targetADR: monthData?.target_adr_gross ?? null,
        targetRevenue: monthData?.target_revenue_gross ?? '',
      });
    }
    return fullBudget;
  },

  /**
   * Saves budget data transactionally.
   * Source: budgets.router.js
   */
  saveBudgets: async (hotelId, year, budgetData) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get Tax Rate
      const hotelResult = await client.query('SELECT tax_rate FROM hotels WHERE hotel_id = $1', [hotelId]);
      if (hotelResult.rows.length === 0) throw new Error('Hotel not found.');
      const taxRateDecimal = hotelResult.rows[0].tax_rate ? parseFloat(hotelResult.rows[0].tax_rate) / 100 : 0;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      for (const monthData of budgetData) {
        const monthNumber = months.indexOf(monthData.month) + 1;
        if (monthNumber === 0) continue;

        const targetOccupancy = monthData.targetOccupancy !== '' ? parseFloat(monthData.targetOccupancy) : null;
        const targetAdrGrossInput = monthData.targetADR !== '' ? parseFloat(monthData.targetADR) : null;
        const targetRevenueGrossInput = monthData.targetRevenue !== '' ? parseFloat(monthData.targetRevenue) : null;

        if (targetRevenueGrossInput === null || isNaN(targetRevenueGrossInput)) continue;

        let targetRevenueGross = targetRevenueGrossInput;
        let targetRevenueNet = targetRevenueGross / (1 + taxRateDecimal);
        let targetAdrGross = targetAdrGrossInput;
        let targetAdrNet = targetAdrGross !== null ? targetAdrGross / (1 + taxRateDecimal) : null;

        const values = [
            hotelId, year, monthNumber, targetOccupancy, targetAdrNet,
            targetAdrGross, targetRevenueNet, targetRevenueGross
        ];

        const upsertQuery = `
            INSERT INTO hotel_budgets (
              hotel_id, budget_year, month, target_occupancy, target_adr_net,
              target_adr_gross, target_revenue_net, target_revenue_gross, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, NOW()
            )
            ON CONFLICT (hotel_id, budget_year, month) DO UPDATE SET
              target_occupancy = EXCLUDED.target_occupancy,
              target_adr_net = EXCLUDED.target_adr_net,
              target_adr_gross = EXCLUDED.target_adr_gross,
              target_revenue_net = EXCLUDED.target_revenue_net,
              target_revenue_gross = EXCLUDED.target_revenue_gross,
              updated_at = NOW();
        `;
        await client.query(upsertQuery, values);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Gets Comp Set (Manual or Category Fallback).
   * Source: admin.router.js
   */
  getCompSet: async (hotelId) => {
    // 1. Custom Comp Set
    const customCompSetQuery = `
      SELECT h.hotel_id, h.property_name, h.category, h.city
      FROM hotels h
      JOIN hotel_comp_sets cs ON h.hotel_id = cs.competitor_hotel_id
      WHERE cs.hotel_id = $1
      ORDER BY h.property_name;
    `;
    const { rows: customCompSet } = await pool.query(customCompSetQuery, [hotelId]);

    if (customCompSet.length > 0) return customCompSet;

    // 2. Fallback to Category
    const hotelInfo = await pool.query("SELECT category FROM hotels WHERE hotel_id = $1", [hotelId]);
    if (hotelInfo.rows.length === 0) throw new Error("Primary hotel not found.");
    const category = hotelInfo.rows[0].category;

    const categoryCompSetQuery = `
      SELECT hotel_id, property_name, category, city
      FROM hotels
      WHERE category = $1 AND hotel_id != $2
      ORDER BY property_name;
    `;
    const { rows: categoryCompSet } = await pool.query(categoryCompSetQuery, [category, hotelId]);
    return categoryCompSet;
  },

  /**
   * Sets Manual Comp Set.
   * Source: admin.router.js
   */
  setCompSet: async (hotelId, competitorIds) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM hotel_comp_sets WHERE hotel_id = $1", [hotelId]);

      if (competitorIds.length > 0) {
        const values = competitorIds.map((id) => [hotelId, id]);
        const insertQuery = format(
          "INSERT INTO hotel_comp_sets (hotel_id, competitor_hotel_id) VALUES %L",
          values
        );
        await client.query(insertQuery);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Gets all Rockenue Assets (Live + Off-Platform).
   * Source: rockenue.router.js
   */
/**
   * Gets all Rockenue Assets (Live + Off-Platform).
   * Source: rockenue.router.js
   */
/**
   * Gets all Rockenue Assets (Live + Off-Platform).
   * Source: rockenue.router.js
   */
  getRockenuePortfolio: async () => {
    const query = `
        SELECT 
          r.id, 
          r.asset_name AS "hotelName", 
          r.asset_name, -- Raw field for PropertyHubPage
          r.city, 
          r.total_rooms AS "totalRooms", 
          r.management_group AS "group", 
          r.monthly_fee AS "monthlyFee",
          r.market_pulse_hotel_id,
          r.booking_com_url, -- From rockenue_managed_assets
          r.genius_discount_pct, -- From rockenue_managed_assets
          
          -- [FIX] Join with Sentinel Configurations for Calculator Metrics
          sc.strategic_multiplier,
          sc.calculator_settings,

          CASE 
            WHEN r.market_pulse_hotel_id IS NOT NULL THEN 'Live' 
            ELSE 'Off-Platform' 
          END AS status
        FROM 
          rockenue_managed_assets r
        LEFT JOIN 
          sentinel_configurations sc ON r.market_pulse_hotel_id::text = sc.hotel_id::text
        ORDER BY
          status DESC,
          "hotelName" ASC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  /**
   * Adds a new Off-Platform Asset.
   * Source: rockenue.router.js
   */
  addRockenueAsset: async () => {
    const query = `
        INSERT INTO rockenue_managed_assets (
          asset_name, city, total_rooms, management_group, monthly_fee, market_pulse_hotel_id
        )
        VALUES 
          ('New Property', 'City', 0, 'Group A', 0.00, NULL)
        RETURNING 
          id, 
          asset_name AS "hotelName", 
          city, 
          total_rooms AS "totalRooms", 
          management_group AS "group", 
          monthly_fee AS "monthlyFee",
          market_pulse_hotel_id,
          'Off-Platform' AS status;
    `;
    const { rows } = await pool.query(query);
    return rows[0];
  },

  /**
   * Updates an Asset (Fee + details if off-platform).
   * Source: rockenue.router.js
   */
 /**
   * Updates an Asset (Fee + details if off-platform).
   * Source: rockenue.router.js
   */
  updateRockenueAsset: async (id, data) => {
    // [FIX] Destructure all fields
    const { 
        monthlyFee, hotelName, city, totalRooms, group, 
        booking_com_url, genius_discount_pct, strategic_multiplier, calculator_settings 
    } = data;
    
    // Fallbacks
    const fee = monthlyFee !== undefined ? parseFloat(monthlyFee) : null;
    const rooms = totalRooms !== undefined ? parseInt(totalRooms, 10) : null;
    const assetNameValue = hotelName || null;
    const cityValue = city || null;
    const groupValue = group || null;

    // 1. Update Base Asset (rockenue_managed_assets)
    const assetQuery = `
      UPDATE rockenue_managed_assets
      SET
        monthly_fee = COALESCE($1, monthly_fee),
        asset_name = CASE WHEN market_pulse_hotel_id IS NULL THEN COALESCE($3, asset_name) ELSE asset_name END,
        city = CASE WHEN market_pulse_hotel_id IS NULL THEN COALESCE($4, city) ELSE city END,
        total_rooms = CASE WHEN market_pulse_hotel_id IS NULL THEN COALESCE($5, total_rooms) ELSE total_rooms END,
        management_group = CASE WHEN market_pulse_hotel_id IS NULL THEN COALESCE($6, management_group) ELSE management_group END,
        booking_com_url = COALESCE($7, booking_com_url),
        genius_discount_pct = COALESCE($8, genius_discount_pct),
        updated_at = NOW()
      WHERE
        id = $2
      RETURNING
        id, market_pulse_hotel_id;
    `;
    
    const assetResult = await pool.query(assetQuery, [
        fee, id, assetNameValue, cityValue, rooms, groupValue,
        booking_com_url, genius_discount_pct
    ]);

    if (assetResult.rows.length === 0) return null;
    const { market_pulse_hotel_id } = assetResult.rows[0];

    // 2. If Live, Update Sentinel Config (sentinel_configurations)
    if (market_pulse_hotel_id) {
        const configQuery = `
            UPDATE sentinel_configurations
            SET
                strategic_multiplier = COALESCE($2, strategic_multiplier),
                calculator_settings = COALESCE($3, calculator_settings),
                updated_at = NOW()
            WHERE hotel_id = $1::integer
        `;
        await pool.query(configQuery, [market_pulse_hotel_id, strategic_multiplier, calculator_settings]);
    }

    // 3. Re-fetch full object with JOIN (to return complete updated state)
    const finalQuery = `
        SELECT 
          r.id, 
          r.asset_name AS "hotelName", 
          r.asset_name,
          r.city, 
          r.total_rooms AS "totalRooms", 
          r.management_group AS "group", 
          r.monthly_fee AS "monthlyFee",
          r.market_pulse_hotel_id,
          r.booking_com_url,
          r.genius_discount_pct,
          sc.strategic_multiplier,
          sc.calculator_settings,
          CASE 
            WHEN r.market_pulse_hotel_id IS NOT NULL THEN 'Live' 
            ELSE 'Off-Platform' 
          END AS status
        FROM 
          rockenue_managed_assets r
        LEFT JOIN 
          sentinel_configurations sc ON r.market_pulse_hotel_id::text = sc.hotel_id::text
        WHERE r.id = $1
    `;
    
    const { rows } = await pool.query(finalQuery, [id]);
    return rows[0];
  },
  /**
   * Deletes an Off-Platform Asset.
   * Source: rockenue.router.js
   */
  deleteRockenueAsset: async (id) => {
    const query = `
        DELETE FROM rockenue_managed_assets 
        WHERE id = $1 AND market_pulse_hotel_id IS NULL;
    `;
    const result = await pool.query(query, [id]);
    return result.rowCount > 0;
  },

  /**
   * Deletes a Hotel and all related data (Full Disconnect).
   * Source: admin.router.js
   */
  deleteHotel: async (hotelId, adminUserId) => {
    const client = await pool.connect();
    try {
      // 1. Try to disconnect Cloudbeds
      try {
        const hotelResult = await client.query(
          "SELECT pms_type, pms_property_id FROM hotels WHERE hotel_id = $1",
          [hotelId]
        );
        if (hotelResult.rows.length > 0 && hotelResult.rows[0].pms_type === 'cloudbeds') {
          const { accessToken } = await getAdminAccessToken(adminUserId, hotelId);
          if (accessToken) {
            await fetch("https://hotels.cloudbeds.com/api/v1.1/postAppState", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: new URLSearchParams({ app_state: "disabled" })
            });
          }
        }
      } catch (e) {
        // Ignore cloudbeds errors, proceed to DB delete
      }

      // 2. DB Deletion
      await client.query("BEGIN");
      await client.query("DELETE FROM rockenue_managed_assets WHERE market_pulse_hotel_id = $1", [String(hotelId)]);
      await client.query("DELETE FROM sentinel_configurations WHERE hotel_id = $1", [hotelId]);
      await client.query("DELETE FROM hotel_comp_sets WHERE hotel_id = $1 OR competitor_hotel_id = $1", [hotelId]);
      await client.query("DELETE FROM scheduled_reports WHERE property_id = $1", [String(hotelId)]);
      await client.query("DELETE FROM hotel_budgets WHERE hotel_id = $1", [hotelId]);
      await client.query("DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1", [hotelId]);
      await client.query("DELETE FROM user_properties WHERE property_id = $1", [hotelId]);
      await client.query("DELETE FROM hotels WHERE hotel_id = $1", [hotelId]);
      await client.query("COMMIT");

      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = HotelService;