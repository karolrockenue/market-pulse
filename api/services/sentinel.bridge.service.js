const db = require("../utils/db");
const pricingEngine = require("./sentinel.pricing.engine");
const pmsRegistry = require("../adapters/pmsRegistry");

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

      console.time("Step 3b MinRates");
      // Step 3b: Daily Min Rate Overrides
      const minRatesRes = await client.query(
        `SELECT to_char(stay_date, 'YYYY-MM-DD') as date, min_price
         FROM sentinel_daily_min_rates
         WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE`,
        [hotelId],
      );
      const dailyMinRatesMap = {};
      minRatesRes.rows.forEach((r) => {
        dailyMinRatesMap[r.date] = parseFloat(r.min_price);
      });
      console.timeEnd("Step 3b MinRates");

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

      // --- Step 4.6: Overlay Live PMS Rates onto Inventory ---
      // The calendar may contain stale SENTINEL-written rates from a previous AI run.
      // Fetch live PMS rates and replace calendar rates so DGX sees real PMS state.
      console.time("Step 4.6 Live PMS Overlay");
      // Override dates keep their stored rate — they are PMS-of-record truth
      // and must not be overwritten in-memory by the live PMS overlay.
      let overrideDateSet = new Set();
      try {
        const ovRes = await client.query(
          `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d
           FROM sentinel_rate_overrides
           WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE`,
          [hotelId],
        );
        overrideDateSet = new Set(ovRes.rows.map((r) => r.d));
      } catch (e) {
        console.warn(`[Bridge] Override set load failed for hotel ${hotelId}: ${e.message}`);
      }
      try {
        const baseRoomId = config.base_room_type_id;
        if (baseRoomId) {
          const hotelPmsType = await pmsRegistry.getPmsType(hotelId);
          const sentinelAdapter = pmsRegistry.getSentinelAdapter(hotelPmsType);

          const pmsPropertyIdRes = await client.query(
            "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
            [hotelId],
          );
          const pmsPropertyId = pmsPropertyIdRes.rows[0]?.pms_property_id;

          if (pmsPropertyId) {
            const startDate = new Date().toISOString().split("T")[0];
            const endDate = new Date(Date.now() + 365 * 86400000)
              .toISOString()
              .split("T")[0];

            const liveRes = await sentinelAdapter.getRates(
              hotelId,
              pmsPropertyId,
              baseRoomId,
              startDate,
              endDate,
            );

            const ratesList =
              liveRes?.data?.roomRateDetailed || liveRes?.roomRateDetailed || [];

            if (ratesList.length > 0) {
              const liveMap = {};
              for (const row of ratesList) {
                if (row.date && row.rate) liveMap[row.date] = parseFloat(row.rate);
              }

              if (inventoryWithHistory.length > 0) {
                // Overlay onto existing calendar rows
                let overlayCount = 0;
                for (const inv of inventoryWithHistory) {
                  const dStr = new Date(inv.stay_date).toISOString().split("T")[0];
                  const liveRate = liveMap[dStr];
                  // [OVERRIDE v1] Skip dates covered by a PMS override — their
                  // rate is the user-pinned value, not whatever live PMS serves.
                  if (overrideDateSet.has(dStr)) continue;
                  if (liveRate !== undefined && inv.source !== "MANUAL" && inv.source !== "LOCKED") {
                    inv.rate = liveRate;
                    inv.source = "SYNC";
                    overlayCount++;
                  }
                }
                console.log(
                  `[Bridge] Live PMS overlay: replaced ${overlayCount}/${inventoryWithHistory.length} calendar rates with live PMS rates.`,
                );
              } else {
                // Calendar is empty — populate from live PMS rates directly
                for (const row of ratesList) {
                  if (row.date && row.rate) {
                    inventoryWithHistory.push({
                      hotel_id: parseInt(hotelId),
                      room_type_id: baseRoomId,
                      stay_date: row.date,
                      rate: parseFloat(row.rate),
                      source: "SYNC",
                      last_change_ts: null,
                      last_change_val: null,
                    });
                  }
                }
                console.log(
                  `[Bridge] Calendar empty — seeded ${inventoryWithHistory.length} dates from live PMS rates.`,
                );
              }
            }
          }
        }
      } catch (pmsErr) {
        console.warn(
          `[Bridge] Live PMS overlay failed (using calendar rates): ${pmsErr.message}`,
        );
      }
      console.timeEnd("Step 4.6 Live PMS Overlay");
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
            CASE
              WHEN (SELECT s_date FROM latest_snapshot) IS NULL THEN 0
              ELSE (live.rooms_sold - COALESCE(hist.rooms_sold, 0))
            END as pickup_24h
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

      console.time("Step 6 Market Events");
      // Step 6: Market Events (Currently defaulting to 'london' as primary market)
      const eventsRes = await client.query(
        "SELECT event_date, impact_multiplier FROM sentinel_market_events WHERE market_slug = 'london' AND event_date >= CURRENT_DATE",
      );
      const peakDatesMap = {};
      eventsRes.rows.forEach((row) => {
        const dStr = new Date(row.event_date).toISOString().split("T")[0];
        peakDatesMap[dStr] = parseFloat(row.impact_multiplier);
      });
      console.timeEnd("Step 6 Market Events");

      console.log("[Bridge] Context assembly complete.");

      return {
        hotelId,
        generated_at: new Date().toISOString(),
        config: {
          peak_dates: peakDatesMap, // [NEW] Event Anchors for the Python Engine
          min_rates: config.monthly_min_rates || {},
          daily_min_rates: dailyMinRatesMap,
          currency: "USD",
          seasonality: config.seasonality_profile || {},
          capacity: config.total_capacity || 0,
          base_room_type_id: config.base_room_type_id,
          last_minute_floor: config.last_minute_floor || {}, // [FIX] Pass LMF settings to AI
          weak_day_pricing: config.weak_day_pricing || {}, // [NEW] Weak Day Pricing config for the engine
          rules: config.rules || {},
          strategy_mode: config.rules?.strategy_mode || "maintain",
          pricing_mode: config.rules?.pricing_mode || "maintain_profit", // [FIX] Expose Pricing Mode for Ruthless Decay
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
  async saveDecisions(decisions, mode) {
    const isPreview = mode === 'preview';
    console.log(
      `[Bridge] Processing ${decisions?.length} decisions (${isPreview ? 'PREVIEW — shadow only' : 'Shadow + Autonomy'})...`,
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
        console.log(`[Bridge] Shadow save: room_type_id sample = "${validDecisions[0].room_type_id}" (type: ${typeof validDecisions[0].room_type_id})`);
        const shadowQuery = `
     INSERT INTO sentinel_ai_predictions 
          (hotel_id, room_type_id, stay_date, suggested_rate, confidence_score, reasoning, model_version, is_applied, created_at)
         SELECT * FROM UNNEST(
            $1::int[], $2::text[], $3::date[], $4::numeric[], $5::numeric[], $6::text[], $7::text[], $8::boolean[], $9::timestamptz[]
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
        try {
          await client.query(shadowQuery, [
            validDecisions.map((d) => Number(d.hotel_id)),
            validDecisions.map((d) => String(d.room_type_id)),
            validDecisions.map((d) => d.stay_date),
            validDecisions.map((d) => Number(d.suggested_rate)),
            validDecisions.map((d) => Number(d.confidence_score) || 0.0),
            validDecisions.map((d) => d.reasoning || null),
            validDecisions.map((d) => d.model_version || "v1.0"),
            validDecisions.map(() => false),
            validDecisions.map(() => now),
          ]);
        } catch (err) {
          console.error("\n[CRASH LOG] PHASE 1: SHADOW SAVE FAILED");
          console.error(
            `[CRASH LOG] hotel_id type/val: ${typeof validDecisions[0].hotel_id} / ${validDecisions[0].hotel_id}`,
          );
          console.error(
            `[CRASH LOG] room_type_id type/val: ${typeof validDecisions[0].room_type_id} / ${validDecisions[0].room_type_id}`,
          );
          console.error(`[CRASH LOG] Postgres Error:`, err.message);
          throw err;
        }
      }
      console.timeEnd("Phase 1: Shadow Log");

      // ---------------------------------------------------------
      // PHASE 2: ACTIVE AUTONOMY (The 3-Layer Safety Protocol)
      // ---------------------------------------------------------
      if (isPreview) {
        console.log(`[Bridge] PREVIEW mode — skipping Phase 2 (autonomy). ${validDecisions.length} predictions saved as blue dots.`);
        return { saved: validDecisions.length, queued: 0, mode: 'preview' };
      }

      console.time("Phase 2: Autonomy Gates");

      // Group decisions by Hotel ID to fetch context efficiently
      const decisionsByHotel = validDecisions.reduce((acc, d) => {
        if (!acc[d.hotel_id]) acc[d.hotel_id] = [];
        acc[d.hotel_id].push(d);
        return acc;
      }, {});

      let totalQueued = 0;

      for (const hotelIdStr of Object.keys(decisionsByHotel)) {
        const hotelId = Number(hotelIdStr);
        const hotelDecisions = decisionsByHotel[hotelIdStr];

        // --- GATE 1: PERMISSION (Is Autopilot ON?) ---
        // [FIX] Also fetch rate_id_map to build the PMS payload later
        const configRes = await client.query(
          `SELECT is_autopilot_enabled, monthly_min_rates, rate_freeze_period, rate_id_map, room_differentials, last_minute_floor, weak_day_pricing
           FROM sentinel_configurations WHERE hotel_id = $1::int`,
          [hotelId],
        );
        const config = configRes.rows[0];

        // [FIX] Fetch PMS Property ID for the payload
        const hotelRes = await client.query(
          `SELECT pms_property_id FROM hotels WHERE hotel_id = $1::int`,
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

        // [FIX] Handle double-stringified JSON from the database
        let minRates = config.monthly_min_rates || {};
        if (typeof minRates === "string") {
          try {
            minRates = JSON.parse(minRates);
          } catch (e) {
            minRates = {};
          }
        }

        // Weak Day Pricing config (may arrive as object or stringified JSONB).
        let weakCfg = config.weak_day_pricing || {};
        if (typeof weakCfg === "string") {
          try {
            weakCfg = JSON.parse(weakCfg);
          } catch (e) {
            weakCfg = {};
          }
        }
        const weakEnabled =
          weakCfg.enabled === true ||
          String(weakCfg.enabled).toLowerCase() === "true";
        const weakDays = Array.isArray(weakCfg.days) ? weakCfg.days : [];
        const weakFloors = weakCfg.floors || {};

        const freezeDays = parseInt(config.rate_freeze_period || 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch Dynamic Ceilings (Gate 2 Data)
        const ceilingsRes = await client.query(
          `SELECT stay_date::text, max_price FROM sentinel_daily_max_rates
           WHERE hotel_id = $1::int AND stay_date = ANY($2::date[])`,
          [hotelId, stayDates],
        );
        const ceilingsMap = {};
        ceilingsRes.rows.forEach((r) => {
          ceilingsMap[r.stay_date.split("T")[0]] = parseFloat(r.max_price);
        });

        // Fetch Daily Min Rate Overrides (Gate 2 Data)
        const dailyMinsRes = await client.query(
          `SELECT to_char(stay_date, 'YYYY-MM-DD') as date, min_price
           FROM sentinel_daily_min_rates
           WHERE hotel_id = $1::int AND stay_date = ANY($2::date[])`,
          [hotelId, stayDates],
        );
        const dailyMinsMap = {};
        dailyMinsRes.rows.forEach((r) => {
          dailyMinsMap[r.date] = parseFloat(r.min_price);
        });

        // Fetch Conflict Locks & Current Rates (Gate 3 & Delta Check)
        // [FIX] Must include room_type_id in query and map key to avoid collisions
        // [FIX] Cast room_type_id to String for robust Set creation
        const roomTypeIdsStr = [
          ...new Set(hotelDecisions.map((d) => String(d.room_type_id))),
        ];

        let calendarRes;
        try {
          calendarRes = await client.query(
            `SELECT room_type_id, stay_date::text, source, rate FROM sentinel_rates_calendar
             WHERE hotel_id = $1::int 
               AND room_type_id::text = ANY($2::text[])
               AND stay_date = ANY($3::date[])`,
            [hotelId, roomTypeIdsStr, stayDates],
          );
        } catch (err) {
          console.error("\n[CRASH LOG] GATE 3: CONFLICT LOOKUP FAILED");
          console.error(`[CRASH LOG] roomTypeIds:`, roomTypeIdsStr);
          console.error(`[CRASH LOG] Postgres Error:`, err.message);
          throw err;
        }
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

        // Fetch LIVE PMS rates for delta comparison (not stale calendar)
        const liveRatesMap = {};
        let hotelPmsType = 'cloudbeds'; // default fallback
        try {
          hotelPmsType = await pmsRegistry.getPmsType(hotelId);
          const sentinelAdapter = pmsRegistry.getSentinelAdapter(hotelPmsType);

          // Fetch live rates for each unique room type the AI predicted on
          for (const roomTypeId of roomTypeIdsStr) {
            const datesSorted = stayDates
              .map((d) => new Date(d).toISOString().split("T")[0])
              .sort();
            const startDate = datesSorted[0];
            const endDate = datesSorted[datesSorted.length - 1];

            const liveRes = await sentinelAdapter.getRates(
              hotelId,
              pmsPropertyId,
              roomTypeId,
              startDate,
              endDate,
            );

            const ratesList =
              liveRes?.data?.roomRateDetailed || liveRes?.roomRateDetailed || [];

            for (const row of ratesList) {
              if (row.date && row.rate) {
                const key = `${roomTypeId}_${row.date}`;
                liveRatesMap[key] = parseFloat(row.rate);
              }
            }
          }
          console.log(
            `[Autonomy] Hotel ${hotelId}: Fetched ${Object.keys(liveRatesMap).length} live PMS rates for delta comparison.`,
          );
        } catch (liveErr) {
          console.warn(
            `[Autonomy] Hotel ${hotelId}: Failed to fetch live PMS rates, falling back to calendar. Error: ${liveErr.message}`,
          );
        }

        // Load override dates for this hotel scope. Phase 2 skips any date
        // with an override row — AI is forbidden from touching user-pinned
        // dates regardless of source, lock state, or anything else.
        let phaseOverrideDateSet = new Set();
        try {
          const ovRes = await client.query(
            `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d
             FROM sentinel_rate_overrides
             WHERE hotel_id = $1::int AND stay_date = ANY($2::date[])`,
            [hotelId, stayDates],
          );
          phaseOverrideDateSet = new Set(ovRes.rows.map((r) => r.d));
        } catch (e) {
          console.warn(`[Autonomy] Override set load failed for hotel ${hotelId}: ${e.message}`);
        }

        const validUpdates = [];
        let skFrozen = 0, skManual = 0, skSanity = 0, skDelta = 0, skRateMap = 0, skOverride = 0;

        for (const pred of hotelDecisions) {
          const dateStr = new Date(pred.stay_date).toISOString().split("T")[0];
          const stayDateObj = new Date(pred.stay_date);
          let safeRate = parseFloat(pred.suggested_rate);

          // --- GATE 3: CONFLICTS (Freeze & Locks) ---

          // 3a. Freeze Window (Today + X days)
          const daysUntilStay = (stayDateObj - today) / (1000 * 60 * 60 * 24);
          if (daysUntilStay < freezeDays) {
            skFrozen++;
            continue; // Frozen period
          }

          // 3a.5. PMS Override check — user-pinned dates are off-limits to
          // AI regardless of source, lock state, or anything else.
          if (phaseOverrideDateSet.has(dateStr)) {
            skOverride++;
            continue;
          }

          // 3b. Explicit Lock Check
          const key = `${pred.room_type_id}_${dateStr}`;
          const currentData = calendarMap[key] || {};
          const currentSource = (currentData.source || "").toUpperCase();

          // AI only respects explicit LOCKED (padlock) and PMS_LOCKED sources.
          // MANUAL (Rate Manager saves) and SYNC are now overridable by autopilot.
          if (currentSource === "LOCKED" || currentSource === "PMS_LOCKED") {
            skManual++;
            continue;
          }

          // --- GATE 2: POLICY (Hard Bounds) ---

          // 2a. Min Rate Check (with LMF override)
          const monthNames = [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ];
          const monthKey = monthNames[stayDateObj.getMonth()];
          const monthlyMin = parseFloat(minRates[monthKey] || 0);

          // Daily min override takes precedence over monthly default
          const dailyMinOverride = dailyMinsMap[dateStr];
          const hasDailyOverride =
            dailyMinOverride !== undefined && dailyMinOverride > 0;
          let minRate = hasDailyOverride ? dailyMinOverride : monthlyMin;

          const dayNamesLmf = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
          const dowStr = dayNamesLmf[stayDateObj.getUTCDay()];

          // Weak Day Pricing: explicit per-DOW £ floor wins over the monthly
          // default (a daily override still wins over the weak floor). Mirrors
          // the DGX engine so Node does not clamp the weak floor back up to the
          // monthly min. See pricing-formulas.md §13.
          const isWeakDay = weakEnabled && weakDays.includes(dowStr);
          if (isWeakDay && !hasDailyOverride) {
            const wf = parseFloat(weakFloors[dowStr]);
            if (Number.isFinite(wf) && wf > 0) minRate = wf;
          }

          // Last-Minute Floor: if active for this date, it REPLACES the resolved
          // min — EXCEPT for a weak day, which keeps the LOWER of (weak floor,
          // LMF rate) so a quiet day can still discount deeper close-in.
          const lmf = config.last_minute_floor || {};
          const lmfEnabled = lmf.enabled || false;
          const lmfDays = parseInt(lmf.days || "0", 10);
          const lmfRate = parseFloat(lmf.rate || "0");
          const lmfDow = new Set(lmf.dow || []);

          if (lmfEnabled && daysUntilStay <= lmfDays && lmfDow.has(dowStr)) {
            minRate = isWeakDay ? Math.min(minRate, lmfRate) : lmfRate;
          }

          if (safeRate < minRate) safeRate = minRate;

          // 2b. Dynamic Ceiling Check (94th Percentile Cap)
          const ceiling = ceilingsMap[dateStr];
          if (ceiling && safeRate > ceiling) safeRate = ceiling;

          // 2c. Sanity Check
          if (isNaN(safeRate) || safeRate <= 0) {
            skSanity++;
            continue;
          }

          // --- DELTA CHECK (Surgical Strike) ---
          // Compare against LIVE PMS rate (not stale calendar) to detect real deltas.
          // Falls back to calendar rate if live fetch failed or date not found.
          const liveKey = `${pred.room_type_id}_${dateStr}`;
          const liveRate = liveRatesMap[liveKey];
          const calendarRate = currentData.rate;
          const deltaRate = liveRate !== undefined ? liveRate : calendarRate;

          // [DEBUG] Log first 3 delta comparisons per hotel
          if (skDelta + skFrozen + skManual + skSanity + validUpdates.length < 3) {
            console.log(`[Autonomy Debug] Hotel ${hotelId} | ${dateStr} | AI=${safeRate} | Live=${liveRate !== undefined ? liveRate : 'N/A'} | Calendar=${calendarRate} | Source=${currentSource} | Delta=${deltaRate !== undefined ? Math.abs(safeRate - deltaRate).toFixed(2) : 'N/A'}`);
          }

          // [UPDATED] Reduced deadband to £1.00 to allow Ruthless Decay micro-drops
          if (
            deltaRate !== undefined &&
            Math.abs(safeRate - deltaRate) < 1.0
          ) {
            skDelta++;
            continue; // No change needed (Price change is insignificant)
          }

          // ALL GATES PASSED -> Queue for PMS
          validUpdates.push({
            hotel_id: hotelId,
            room_type_id: pred.room_type_id,
            start_date: pred.stay_date,
            end_date: pred.stay_date,
            price: safeRate,
            source: "SENTINEL",
          });
        }

        // --- APPLY DIFFERENTIALS TO DERIVED ROOMS ---
        // The AI only predicts the Base Room. We must calculate and inject the derived rooms (Single, etc.) here.
        const expandedUpdates = [];
        const differentials = config.room_differentials || [];

        for (const update of validUpdates) {
          expandedUpdates.push(update); // Add the Base Room

          if (differentials.length > 0) {
            for (const rule of differentials) {
              if (
                !rule ||
                rule.value === undefined ||
                String(rule.roomTypeId) === String(update.room_type_id)
              )
                continue;

              const derivedRate = pricingEngine.calculateDifferential(
                update.price,
                rule.roomTypeId,
                differentials,
              );

              if (derivedRate) {
                expandedUpdates.push({
                  hotel_id: update.hotel_id,
                  room_type_id: rule.roomTypeId,
                  start_date: update.start_date,
                  end_date: update.end_date,
                  price: derivedRate,
                  source: "SENTINEL",
                });
              }
            }
          }
        }

        // Overwrite the original array with the expanded list
        validUpdates.length = 0;
        validUpdates.push(...expandedUpdates);

        // --- EXECUTION ---
        if (validUpdates.length === 0) {
          console.log(
            `[Autonomy] Hotel ${hotelId}: ${hotelDecisions.length} predictions → 0 passed gates, 0 mapped to PMS | Filtered: frozen=${skFrozen} override=${skOverride} manual=${skManual} delta=${skDelta} sanity=${skSanity} rateMap=0`
          );
        }

        if (validUpdates.length > 0) {
          // [FIX] Construct the Cloudbeds JSON Payload
          // Structure: { pmsPropertyId, rates: [{ rate_id, date, amount }] }

          const ratesPayload = [];
          const rateIdMap = config.rate_id_map || {};

          for (const update of validUpdates) {
            // [FIX] rate_id_map keys are strings, but room_type_id may arrive as integer from DGX
            const pmsRateId = rateIdMap[String(update.room_type_id)];
            if (!pmsRateId) {
              skRateMap++;
              console.warn(
                `[Autonomy] Missing Rate ID mapping for Room ${update.room_type_id} (Hotel ${hotelId}). Keys: [${Object.keys(rateIdMap)}]. Skipping.`,
              );
              continue;
            }

            // Format date as YYYY-MM-DD
            const dStr = new Date(update.start_date)
              .toISOString()
              .split("T")[0];

            const rateEntry = {
              rateId: pmsRateId,
              date: dStr,
              rate: update.price,
            };
            // Mews category-specific pricing: room_type_id IS the Mews CategoryId.
            // Without this, updatePrice sets the base rate instead of the category price.
            if (hotelPmsType === 'mews') {
              rateEntry.categoryId = String(update.room_type_id);
            }
            ratesPayload.push(rateEntry);
          }

          console.log(
            `[Autonomy] Hotel ${hotelId}: ${hotelDecisions.length} predictions → ${validUpdates.length} passed gates, ${ratesPayload.length} mapped to PMS | Filtered: frozen=${skFrozen} override=${skOverride} manual=${skManual} delta=${skDelta} sanity=${skSanity} rateMap=${skRateMap}`
          );

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
                    VALUES ($1::int, $2::jsonb, 'PENDING', NOW())
                `;

              // Ensure hotelId is strictly an integer for the DB write
              await client.query(qQuery, [
                hotelId,
                JSON.stringify(chunkPayload),
              ]);
            }
            // REPLACE
            const hIds = validUpdates.map((u) => Number(u.hotel_id));
            const rIds = validUpdates.map((u) => String(u.room_type_id));
            const dates = validUpdates.map((u) => u.start_date);
            const prices = validUpdates.map((u) => u.price);

            if (hIds.length > 0) {
              try {
                await client.query(
                  `
                  UPDATE sentinel_ai_predictions AS p
                  SET is_applied = TRUE
                  FROM UNNEST($1::int[], $2::text[], $3::date[]) AS t(hid, rid, sdate)
                  WHERE p.hotel_id = t.hid 
                    AND p.room_type_id::text = t.rid 
                    AND p.stay_date = t.sdate
                `,
                  [hIds, rIds, dates],
                );
              } catch (err) {
                console.error(
                  "\n[CRASH LOG] PHASE 2: BULK MARK APPLIED FAILED",
                );
                console.error(`[CRASH LOG] Postgres Error:`, err.message);
                throw err;
              }

              try {
                await client.query(
                  `
                  INSERT INTO sentinel_price_history (hotel_id, room_type_id, stay_date, old_price, new_price, source, created_at)
                  SELECT 
                      t.hid, t.rid, t.sdate, c.rate, t.new_price, 'SENTINEL', NOW()
                  FROM UNNEST($1::int[], $2::text[], $3::date[], $4::numeric[]) AS t(hid, rid, sdate, new_price)
                  JOIN sentinel_rates_calendar c 
                      ON c.hotel_id = t.hid 
                      AND c.room_type_id::text = t.rid 
                      AND c.stay_date = t.sdate
                `,
                  [hIds, rIds, dates, prices],
                );
              } catch (err) {
                console.error("\n[CRASH LOG] PHASE 2: BULK LOG HISTORY FAILED");
                console.error(`[CRASH LOG] Postgres Error:`, err.message);
                throw err;
              }

              try {
                await client.query(
                  `
                  UPDATE sentinel_rates_calendar AS c
                  SET source = 'SENTINEL', last_updated_at = NOW(), rate = t.new_price
                  FROM UNNEST($1::int[], $2::text[], $3::date[], $4::numeric[]) AS t(hid, rid, sdate, new_price)
                  WHERE c.hotel_id = t.hid
                    AND c.room_type_id::text = t.rid
                    AND c.stay_date = t.sdate
                    -- [OVERRIDE v1] Belt-and-braces: never overwrite a cell covered by a PMS override.
                    -- Safe regardless of feature flag (table is empty when disabled).
                    AND NOT EXISTS (
                      SELECT 1 FROM sentinel_rate_overrides o
                      WHERE o.hotel_id = c.hotel_id AND o.stay_date = c.stay_date
                    )
                `,
                  [hIds, rIds, dates, prices],
                );
              } catch (err) {
                console.error(
                  "\n[CRASH LOG] PHASE 2: BULK UPDATE CALENDAR FAILED",
                );
                console.error(`[CRASH LOG] Postgres Error:`, err.message);
                throw err;
              }
            }
            totalQueued += ratesPayload.length;
            console.log(
              `[Autonomy] Hotel ${hotelId}: Queued ${ratesPayload.length} rate updates (Split into ${Math.ceil(ratesPayload.length / BATCH_SIZE)} jobs).`,
            );
          }
        }

        // Re-push active overrides as a safety net against PMS drift. Every
        // hour we re-emit the pinned base price for all future override dates
        // (fan out via differentials). If someone edited the rate directly
        // in Cloudbeds/Mews between cycles, this restores the user's intent.
        try {
          const ovRowsRes = await client.query(
            `SELECT to_char(stay_date, 'YYYY-MM-DD') AS d, base_override_price
             FROM sentinel_rate_overrides
             WHERE hotel_id = $1::int AND stay_date >= CURRENT_DATE`,
            [hotelId],
          );
          const ovRows = ovRowsRes.rows;

          if (ovRows.length > 0) {
            const baseRoomId = String(
              (await client.query(
                "SELECT base_room_type_id FROM sentinel_configurations WHERE hotel_id = $1",
                [hotelId],
              )).rows[0]?.base_room_type_id || "",
            );
            const rateIdMap = config.rate_id_map || {};
            const differentials = config.room_differentials || [];

            const rePushPayload = [];
            for (const ov of ovRows) {
              const basePrice = parseFloat(ov.base_override_price);
              if (!baseRoomId || isNaN(basePrice) || basePrice <= 0) continue;

              const baseRateId = rateIdMap[baseRoomId];
              if (baseRateId) {
                const entry = { rateId: baseRateId, date: ov.d, rate: basePrice };
                if (hotelPmsType === "mews") entry.categoryId = baseRoomId;
                rePushPayload.push(entry);
              }
              for (const rule of differentials) {
                if (!rule || rule.value === undefined) continue;
                if (String(rule.roomTypeId) === baseRoomId) continue;
                const derivedRateId = rateIdMap[rule.roomTypeId];
                if (!derivedRateId) continue;
                const derivedRate = pricingEngine.calculateDifferential(
                  basePrice,
                  rule.roomTypeId,
                  differentials,
                );
                if (derivedRate !== null && derivedRate > 0) {
                  const entry = { rateId: derivedRateId, date: ov.d, rate: derivedRate };
                  if (hotelPmsType === "mews") entry.categoryId = String(rule.roomTypeId);
                  rePushPayload.push(entry);
                }
              }
            }

            if (rePushPayload.length > 0) {
              const RE_BATCH_SIZE = 25;
              for (let i = 0; i < rePushPayload.length; i += RE_BATCH_SIZE) {
                const chunk = rePushPayload.slice(i, i + RE_BATCH_SIZE);
                await client.query(
                  `INSERT INTO sentinel_job_queue (hotel_id, payload, status, created_at)
                   VALUES ($1::int, $2::jsonb, 'PENDING', NOW())`,
                  [hotelId, JSON.stringify({ pmsPropertyId, rates: chunk })],
                );
              }
              console.log(
                `[Autonomy] Hotel ${hotelId}: Re-pushed ${ovRows.length} active overrides (${rePushPayload.length} rates across ${Math.ceil(rePushPayload.length / RE_BATCH_SIZE)} jobs).`,
              );
            }
          }
        } catch (e) {
          // Re-push failure must never break the main Phase 2 run.
          console.error(`[Autonomy] Hotel ${hotelId}: Override re-push failed: ${e.message}`);
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

  /**
   * [RETRY] Sweep unapplied predictions and re-process them through autonomy gates.
   * Fetches all is_applied=FALSE predictions for future dates and feeds them
   * back through saveDecisions() as if the DGX just sent them.
   */
  async retryUnapplied() {
    console.log("[Bridge] Starting retry sweep for unapplied predictions...");
    const result = await db.query(
      `SELECT DISTINCT ON (hotel_id, room_type_id, stay_date)
         hotel_id, room_type_id, stay_date, suggested_rate, confidence_score, reasoning, model_version
       FROM sentinel_ai_predictions
       WHERE is_applied = FALSE AND stay_date >= CURRENT_DATE
       ORDER BY hotel_id, room_type_id, stay_date, created_at DESC`
    );

    if (result.rows.length === 0) {
      console.log("[Bridge] No unapplied predictions to retry.");
      return { retried: 0, queued: 0 };
    }

    console.log(`[Bridge] Found ${result.rows.length} unapplied predictions. Re-processing...`);

    // Re-format as DGX-style decisions payload
    const decisions = result.rows.map((r) => ({
      hotel_id: r.hotel_id,
      room_type_id: r.room_type_id,
      stay_date: new Date(r.stay_date).toISOString().split("T")[0],
      suggested_rate: parseFloat(r.suggested_rate),
      confidence_score: parseFloat(r.confidence_score) || 0,
      reasoning: r.reasoning || "Retry sweep",
      model_version: r.model_version || "v1.0-retry",
    }));

    // Feed through the same saveDecisions pipeline
    const saveResult = await this.saveDecisions(decisions);
    console.log(`[Bridge] Retry sweep complete: ${saveResult.saved} processed, ${saveResult.queued} queued.`);
    return { retried: decisions.length, queued: saveResult.queued };
  }
}

module.exports = new SentinelBridgeService();
