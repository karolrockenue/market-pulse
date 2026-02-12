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
   * [WRITE] Save AI Predictions AND Execute Autonomy (if enabled).
   * Implements the 3-Layer Safety Protocol.
   */
  async saveDecisions(decisions) {
    console.log(
      `[Bridge] Processing ${decisions?.length} decisions (Shadow + Autonomy)...`,
    );

    // [DEBUG] Log the Hotel ID type to confirm UUID vs Integer
    if (decisions && decisions.length > 0) {
      const sample = decisions[0];
      console.log(
        `[Bridge] Debug Sample: HotelID=${sample.hotel_id} (Type: ${typeof sample.hotel_id}), Rate=${sample.suggested_rate}`,
      );
    }

    if (!Array.isArray(decisions) || decisions.length === 0)
      return { saved: 0 };

    const client = await db.connect();

    try {
      // ---------------------------------------------------------
      // PHASE 1: SHADOW SAVE (Always Log to History)
      // ---------------------------------------------------------
      console.time("Phase 1: Shadow Log");
      const validDecisions = decisions.filter(
        (d) => d.hotel_id && d.room_type_id && d.stay_date && d.suggested_rate,
      );

      if (validDecisions.length > 0) {
        const shadowQuery = `
          INSERT INTO sentinel_ai_predictions 
          (hotel_id, room_type_id, stay_date, suggested_rate, confidence_score, reasoning, model_version, is_applied, created_at)
          SELECT * FROM UNNEST(
            $1::int[], $2::int[], $3::date[], $4::numeric[], $5::numeric[], $6::text[], $7::text[], $8::boolean[], $9::timestamptz[]
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
        await client.query(shadowQuery, [
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
      }
      console.timeEnd("Phase 1: Shadow Log");

      // ---------------------------------------------------------
      // PHASE 2: ACTIVE AUTONOMY (The 3-Layer Safety Protocol)
      // ---------------------------------------------------------
      console.time("Phase 2: Autonomy Gates");

      // Group decisions by Hotel ID to fetch context efficiently
      const decisionsByHotel = validDecisions.reduce((acc, d) => {
        if (!acc[d.hotel_id]) acc[d.hotel_id] = [];
        acc[d.hotel_id].push(d);
        return acc;
      }, {});

      let totalQueued = 0;

      for (const hotelId of Object.keys(decisionsByHotel)) {
        const hotelDecisions = decisionsByHotel[hotelId];

        // --- GATE 1: PERMISSION (Is Autopilot ON?) ---
        // [FIX] Also fetch rate_id_map to build the PMS payload later
        const configRes = await client.query(
          `SELECT is_autopilot_enabled, monthly_min_rates, rate_freeze_period, rate_id_map 
           FROM sentinel_configurations WHERE hotel_id = $1`,
          [hotelId],
        );
        const config = configRes.rows[0];

        // [FIX] Fetch PMS Property ID for the payload
        const hotelRes = await client.query(
          `SELECT pms_property_id FROM hotels WHERE hotel_id = $1`,
          [hotelId],
        );
        const pmsPropertyId = hotelRes.rows[0]?.pms_property_id;

        if (!pmsPropertyId) {
          console.error(
            `[Autonomy] Hotel ${hotelId}: Missing PMS Property ID. Skipping.`,
          );
          continue;
        }

        if (!config || !config.is_autopilot_enabled) {
          console.log(
            `[Autonomy] Hotel ${hotelId}: Autopilot OFF. Skipping execution.`,
          );
          continue;
        }

        // Prepare Gate Data
        const stayDates = hotelDecisions.map((d) => d.stay_date);
        const minRates = config.monthly_min_rates || {};
        const freezeDays = parseInt(config.rate_freeze_period || 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch Dynamic Ceilings (Gate 2 Data)
        const ceilingsRes = await client.query(
          `SELECT stay_date::text, max_price FROM sentinel_daily_max_rates 
           WHERE hotel_id = $1 AND stay_date = ANY($2::date[])`,
          [hotelId, stayDates],
        );
        const ceilingsMap = {};
        ceilingsRes.rows.forEach((r) => {
          ceilingsMap[r.stay_date.split("T")[0]] = parseFloat(r.max_price);
        });

        // Fetch Conflict Locks & Current Rates (Gate 3 & Delta Check)
        // [FIX] Must include room_type_id in query and map key to avoid collisions
        // [FIX] Cast room_type_id to String for robust Set creation
        const roomTypeIds = [
          ...new Set(hotelDecisions.map((d) => String(d.room_type_id))),
        ];

        const calendarRes = await client.query(
          `SELECT room_type_id, stay_date::text, source, rate FROM sentinel_rates_calendar
           WHERE hotel_id = $1 
             AND room_type_id = ANY($2::text[])  -- [FIX] Cast to text[] to match DB column type
             AND stay_date = ANY($3::date[])`,
          [hotelId, roomTypeIds, stayDates],
        );

        const calendarMap = {};
        calendarRes.rows.forEach((r) => {
          // [FIX] Robust Date Normalization (Handle Date obj or String)
          let dStr;
          if (r.stay_date instanceof Date) {
            dStr = r.stay_date.toISOString().split("T")[0];
          } else {
            dStr = String(r.stay_date).split("T")[0];
          }

          // Key by Room + Date
          const key = `${r.room_type_id}_${dStr}`;

          calendarMap[key] = {
            source: r.source,
            rate: parseFloat(r.rate || 0),
          };
        });

        const validUpdates = [];

        for (const pred of hotelDecisions) {
          const dateStr = new Date(pred.stay_date).toISOString().split("T")[0];
          const stayDateObj = new Date(pred.stay_date);
          let safeRate = parseFloat(pred.suggested_rate);

          // --- GATE 3: CONFLICTS (Freeze & Locks) ---

          // 3a. Freeze Window (Today + X days)
          const daysUntilStay = (stayDateObj - today) / (1000 * 60 * 60 * 24);
          if (daysUntilStay < freezeDays) {
            continue; // Frozen period
          }

          // 3b. Manual Lock (Human Override)
          // [FIX] Lookup using composite key
          const key = `${pred.room_type_id}_${dateStr}`;
          const currentData = calendarMap[key] || {};
          const currentSource = currentData.source;

          if (currentSource === "MANUAL" || currentSource === "PMS_LOCKED") {
            continue; // Human wins
          }

          // --- GATE 2: POLICY (Hard Bounds) ---

          // 2a. Min Rate Check
          const monthKey = String(stayDateObj.getMonth() + 1); // 1-12
          const minRate = parseFloat(minRates[monthKey] || 0);
          if (safeRate < minRate) safeRate = minRate;

          // 2b. Dynamic Ceiling Check (94th Percentile Cap)
          const ceiling = ceilingsMap[dateStr];
          if (ceiling && safeRate > ceiling) safeRate = ceiling;

          // 2c. Sanity Check
          if (isNaN(safeRate) || safeRate <= 0) continue;

          // --- DELTA CHECK (Surgical Strike) ---
          // Only push if the price is actually different.
          // We check !== undefined to ensure we have a valid DB baseline.
          // If DB has 0 (or null converted to 0), and AI has a real price, we MUST push.
          const currentRate = currentData.rate;

          // [UPDATED] Widen deadband to £5.00 to prevent micro-jitter
          if (
            currentRate !== undefined &&
            Math.abs(safeRate - currentRate) < 5.0
          ) {
            continue; // No change needed (Price change is insignificant)
          }

          // ALL GATES PASSED -> Queue for PMS
          validUpdates.push({
            hotel_id: hotelId,
            room_type_id: pred.room_type_id,
            start_date: pred.stay_date,
            end_date: pred.stay_date,
            price: safeRate,
            source: "AI_AUTO",
          });
        }

        // --- EXECUTION ---
        if (validUpdates.length > 0) {
          // [FIX] Construct the Cloudbeds JSON Payload
          // Structure: { pmsPropertyId, rates: [{ rate_id, date, amount }] }

          const ratesPayload = [];
          const rateIdMap = config.rate_id_map || {};

          for (const update of validUpdates) {
            const pmsRateId = rateIdMap[update.room_type_id];
            if (!pmsRateId) {
              console.warn(
                `[Autonomy] Missing Rate ID mapping for Room ${update.room_type_id} (Hotel ${hotelId}). Skipping.`,
              );
              continue;
            }

            // Format date as YYYY-MM-DD
            const dStr = new Date(update.start_date)
              .toISOString()
              .split("T")[0];

            ratesPayload.push({
              rateId: pmsRateId, // [CRITICAL] Must match Cloudbeds Adapter (camelCase)
              date: dStr,
              rate: update.price, // [CRITICAL] Must match Cloudbeds Adapter ('rate', not 'amount')
            });
          }

          if (ratesPayload.length > 0) {
            // [FIX] Chunking Logic for Cloudbeds API Limit (Max 30 items)
            // We use a safe batch size of 25 to avoid edge cases.
            const BATCH_SIZE = 25;

            for (let i = 0; i < ratesPayload.length; i += BATCH_SIZE) {
              const chunk = ratesPayload.slice(i, i + BATCH_SIZE);

              const chunkPayload = {
                pmsPropertyId: pmsPropertyId,
                rates: chunk,
              };

              const qQuery = `
                    INSERT INTO sentinel_job_queue 
                    (hotel_id, payload, status, created_at)
                    VALUES ($1, $2, 'PENDING', NOW())
                `;

              // [FIX] Handle UUID vs Integer Hotel ID by not casting to ::int[]
              await client.query(qQuery, [
                hotelId,
                JSON.stringify(chunkPayload),
              ]);
            }
            // --- NEW: Mark Decisions as Applied, Log to History, AND Update Calendar Source ---
            for (const update of validUpdates) {
              // 1. Mark as Applied in Predictions
              await client.query(
                `UPDATE sentinel_ai_predictions 
                 SET is_applied = TRUE 
                 WHERE hotel_id = $1 AND stay_date = $2`,
                [hotelId, update.start_date],
              );

              // 2. Log to Price History (so Stopwatch/Velocity work)
              await client.query(
                `INSERT INTO sentinel_price_history (hotel_id, room_type_id, stay_date, old_price, new_price, source, created_at)
                 VALUES ($1, $2, $3, (SELECT rate FROM sentinel_rates_calendar WHERE hotel_id = $1 AND stay_date = $3 LIMIT 1), $4, 'AI_AUTO', NOW())`,
                [hotelId, update.room_type_id, update.start_date, update.price],
              );

              // 3. Update the Live Calendar Source so the UI shows "Sentinel AI"
              await client.query(
                `UPDATE sentinel_rates_calendar 
                 SET source = 'AI_AUTO', last_updated_at = NOW()
                 WHERE hotel_id = $1 AND stay_date = $2 AND room_type_id = $3`,
                [hotelId, update.start_date, String(update.room_type_id)],
              );
            }

            totalQueued += ratesPayload.length;
            console.log(
              `[Autonomy] Hotel ${hotelId}: Queued ${ratesPayload.length} rate updates (Split into ${Math.ceil(ratesPayload.length / BATCH_SIZE)} jobs).`,
            );
          }
        }
      }

      console.timeEnd("Phase 2: Autonomy Gates");
      return { saved: validDecisions.length, queued: totalQueued };
    } catch (error) {
      console.error("[Bridge] Process Failed:", error);
      // [DEBUG] Check for common UUID/Int mismatch
      if (
        error.message &&
        error.message.includes("invalid input syntax for type integer")
      ) {
        console.error(
          "[Bridge] CRITICAL: Attempted to insert a non-integer Hotel ID into an Integer array. This confirms the UUID bug.",
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new SentinelBridgeService();
