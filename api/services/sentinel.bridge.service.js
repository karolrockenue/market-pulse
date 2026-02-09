const db = require("../utils/db");

/**
 * @file sentinel.bridge.service.js
 * @brief Logic owner for Machine-to-Machine interactions (AI Bridge).
 * Optimized to use a single DB connection for Context Retrieval.
 */
class SentinelBridgeService {
  /**
   * [READ] Assemble the Full Context for the AI.
   * Aggregates: Configs, Calendar (Inventory), Max Rates, Pace Curves, and Pickup Velocity.
   */
  /**
   * [READ] Assemble the Full Context for the AI.
   * Aggregates: Configs, Calendar, Max Rates, Pace Curves, Velocity, AND HISTORY.
   */
  async getHotelContext(hotelId) {
    console.log(`[Bridge] Fetching context for hotel: ${hotelId}`);
    const client = await db.connect();

    try {
      console.time("Step 1 Config");
      // Step 1: Config
      const configRes = await client.query(
        "SELECT * FROM sentinel_configurations WHERE hotel_id = $1",
        [hotelId],
      );
      const config = configRes.rows[0] || {};
      console.timeEnd("Step 1 Config");

      console.time("Step 2 Inventory");
      // Step 2: Calendar (Inventory)
      const calendarRes = await client.query(
        `SELECT hotel_id, room_type_id, stay_date, rate, source 
         FROM sentinel_rates_calendar
         WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE
         ORDER BY stay_date ASC`,
        [hotelId],
      );
      console.timeEnd("Step 2 Inventory");

      console.time("Step 3 MaxRates");
      // Step 3: Max Rates
      const maxRatesRes = await client.query(
        `SELECT stay_date, max_price 
         FROM sentinel_daily_max_rates 
         WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE`,
        [hotelId],
      );

      console.timeEnd("Step 3 MaxRates");

      console.time("Step 4 Curves");
      // Step 4: Pace Curves
      const curvesRes = await client.query(
        "SELECT season_tier, curve_data FROM sentinel_pace_curves WHERE hotel_id = $1",
        [hotelId],
      );
      console.timeEnd("Step 4 Curves");

      // --- NEW: Step 4.5 Fetch Last Price Change History ---
      console.time("Step 4.5 History");
      console.log("[Bridge] Step 4.5: Fetching Price History...");
      const historyRes = await client.query(
        `SELECT DISTINCT ON (stay_date) stay_date, created_at, old_price, new_price
         FROM sentinel_price_history
         WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE
         ORDER BY stay_date, created_at DESC`,
        [hotelId],
      );

      // Map history to a lookup object { "YYYY-MM-DD": { ts, price } }
      const historyMap = {};
      historyRes.rows.forEach((row) => {
        const dStr = new Date(row.stay_date).toISOString().split("T")[0];
        historyMap[dStr] = {
          timestamp: row.created_at,
          old_price: row.old_price,
          new_price: row.new_price,
        };
      });

      // Inject History into Inventory Rows
      const inventoryWithHistory = calendarRes.rows.map((row) => {
        const dStr = new Date(row.stay_date).toISOString().split("T")[0];
        const hist = historyMap[dStr];
        return {
          ...row,
          last_change_ts: hist ? hist.timestamp : null,
          last_change_val: hist ? hist.new_price : null,
        };
      });
      console.timeEnd("Step 4.5 History");
      // -----------------------------------------------------

      console.time("Step 5 Velocity");
      // Step 5: Velocity
      const velocityRes = await client.query(
        `
        WITH latest_snapshot AS (
            SELECT MAX(snapshot_date) as s_date 
            FROM pacing_snapshots 
            WHERE hotel_id = $1 AND snapshot_date < CURRENT_DATE
        )
        SELECT DISTINCT ON (live.stay_date::date)
            live.stay_date::date as stay_date,
            live.rooms_sold,
            live.capacity_count as capacity,
            (live.rooms_sold - COALESCE(hist.rooms_sold, 0)) as pickup_24h
        FROM daily_metrics_snapshots live
        LEFT JOIN pacing_snapshots hist 
            ON live.hotel_id = hist.hotel_id 
            AND live.stay_date::date = hist.stay_date::date
            AND hist.snapshot_date = (SELECT s_date FROM latest_snapshot)
        WHERE live.hotel_id = $1 
          AND live.stay_date::date >= CURRENT_DATE
        ORDER BY live.stay_date::date ASC, live.snapshot_id DESC
        `,
        [hotelId],
      );
      console.timeEnd("Step 5 Velocity");

      console.log("[Bridge] Context assembly complete.");

      return {
        hotelId,
        generated_at: new Date().toISOString(),
        config: {
          min_rates: config.monthly_min_rates || {},
          currency: "USD",
          seasonality: config.seasonality_profile || {},
          capacity: config.total_capacity || 0,
          base_room_type_id: config.base_room_type_id,
          last_minute_floor: config.last_minute_floor || {}, // [FIX] Pass LMF settings to AI
          rules: config.rules || {},
          strategy_mode: config.rules?.strategy_mode || "maintain",
        },
        inventory: inventoryWithHistory, // [UPDATED]
        constraints: {
          max_rates: maxRatesRes.rows,
          pace_curves: curvesRes.rows,
        },
        market: {
          pickup_velocity: velocityRes.rows,
        },
      };
    } catch (err) {
      console.error("[Bridge] CRITICAL ERROR during context fetch:", err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * [WRITE] Save AI Predictions to the Shadow Table (Batch Optimized).
   */
  async saveDecisions(decisions) {
    console.log(
      `[Bridge] Saving ${decisions?.length} decisions (Batch Mode)...`,
    );
    if (!Array.isArray(decisions) || decisions.length === 0)
      return { saved: 0 };

    const client = await db.connect();

    try {
      console.time("DB Batch Insert");

      // Filter valid decisions
      const validDecisions = decisions.filter(
        (d) => d.hotel_id && d.room_type_id && d.stay_date && d.suggested_rate,
      );

      if (validDecisions.length === 0) return { saved: 0 };

      // Construct Batch Query using UNNEST for high performance
      const query = `
        INSERT INTO sentinel_ai_predictions 
        (hotel_id, room_type_id, stay_date, suggested_rate, confidence_score, reasoning, model_version, is_applied, created_at)
        SELECT * FROM UNNEST(
          $1::int[],       -- hotel_id
          $2::int[],       -- room_type_id
          $3::date[],      -- stay_date
          $4::numeric[],   -- suggested_rate
          $5::numeric[],   -- confidence_score
          $6::text[],      -- reasoning
          $7::text[],      -- model_version
          $8::boolean[],   -- is_applied
          $9::timestamptz[] -- created_at
        )
        ON CONFLICT (hotel_id, room_type_id, stay_date) 
        DO UPDATE SET 
          suggested_rate = EXCLUDED.suggested_rate,
          confidence_score = EXCLUDED.confidence_score,
          reasoning = EXCLUDED.reasoning,
          model_version = EXCLUDED.model_version,
          created_at = NOW(),
          is_applied = FALSE
      `;

      const now = new Date();

      await client.query(query, [
        validDecisions.map((d) => d.hotel_id),
        validDecisions.map((d) => d.room_type_id),
        validDecisions.map((d) => d.stay_date),
        validDecisions.map((d) => d.suggested_rate),
        validDecisions.map((d) => d.confidence_score || 0.0),
        validDecisions.map((d) => d.reasoning || null),
        validDecisions.map((d) => d.model_version || "v1.0"),
        validDecisions.map(() => false),
        validDecisions.map(() => now),
      ]);

      console.timeEnd("DB Batch Insert");
      console.log(`[Bridge] Saved ${validDecisions.length} decisions.`);
      return { saved: validDecisions.length };
    } catch (error) {
      console.error("[Bridge] Save Failed:", error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new SentinelBridgeService();
