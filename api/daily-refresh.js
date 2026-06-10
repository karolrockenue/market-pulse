// /api/daily-refresh.js (Refactored for Multi-PMS Forecasting)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
// Import the mewsAdapter so we can use its functions.
const mewsAdapter = require("./adapters/mewsAdapter.js");
const format = require("pg-format");
const logger = require("./utils/logger");
const Sentry = require("@sentry/node");

module.exports = async (request, response) => {
  // ** REFACTORED LOGIC **
  // The job now fetches all connected properties directly, making it property-centric

  try {
    // More descriptive logging for the job's purpose.
    console.log("Starting daily forecast refresh job for all properties...");
    let totalRecordsUpdated = 0;
    let allProperties = []; // Define here to ensure it's in scope
    const failures = []; // per-hotel hard fetch failures (previously swallowed by catch->continue)
    const emptyData = []; // hotels that returned 0 forecast rows

    // Step 1: Get a list of hotels to process.
    // Optional query params:
    //   ?hotelId=N    — refresh a single hotel
    //   ?pmsType=mews — refresh only hotels on a specific PMS (used by the
    //                   intraday Mews cadence to keep revenue fresh without
    //                   re-running Cloudbeds every 2h)
    const singleHotelId = request.query?.hotelId;
    const pmsTypeFilter = request.query?.pmsType;
    const propertiesClient = await pgPool.connect();
    try {
      let propertiesResult;
      if (singleHotelId) {
        propertiesResult = await propertiesClient.query(
          "SELECT hotel_id, pms_property_id, property_name, pms_type, timezone, tax_rate, tax_type, total_rooms, history_locked_until::text AS history_locked_until FROM hotels WHERE hotel_id = $1 AND is_disconnected = false",
          [singleHotelId],
        );
      } else if (pmsTypeFilter) {
        propertiesResult = await propertiesClient.query(
          "SELECT hotel_id, pms_property_id, property_name, pms_type, timezone, tax_rate, tax_type, total_rooms, history_locked_until::text AS history_locked_until FROM hotels WHERE pms_type = $1 AND is_disconnected = false",
          [pmsTypeFilter],
        );
      } else {
        propertiesResult = await propertiesClient.query(
          "SELECT hotel_id, pms_property_id, property_name, pms_type, timezone, tax_rate, tax_type, total_rooms, history_locked_until::text AS history_locked_until FROM hotels WHERE is_disconnected = false",
        );
      }
      console.log("...Initial property fetch query complete.");
      allProperties = propertiesResult.rows;
    } catch (e) {
      console.error(
        "CRITICAL: Failed to fetch initial property list.",
        e.message,
      );
      throw e;
    } finally {
      propertiesClient.release();
    }
    const filterDesc = singleHotelId
      ? ` (filtered to hotel ${singleHotelId})`
      : pmsTypeFilter
        ? ` (filtered to PMS=${pmsTypeFilter})`
        : "";
    console.log(`Found ${allProperties.length} properties to process.${filterDesc}`);

    // Step 2: Loop through each property.
    for (const hotel of allProperties) {
      const {
        hotel_id,
        property_name,
        pms_type,
        timezone,
        tax_rate,
        tax_type,
        total_rooms, // <-- ADDED
      } = hotel;
      console.log(
        `--- Processing: ${property_name} (ID: ${hotel_id}, PMS: ${pms_type}) ---`,
      );

      let processedData; // This will hold the forecast data from the adapter.

      // /api/daily-refresh.js

      // Branch logic based on the property's PMS type.
      if (pms_type === "cloudbeds") {
        try {
          // THE FIX: Determine the correct ID to use for the Cloudbeds API.
          // For new hotels, this will be pms_property_id.
          // For old hotels, it will fall back to hotel_id, which is correct for them.
          const cloudbedsApiId = hotel.pms_property_id || hotel.hotel_id;

          // getAccessToken correctly uses our internal hotel_id to find credentials.
          const accessToken = await cloudbedsAdapter.getAccessToken(hotel_id);
          const pricingModel = tax_type || "inclusive";

          // Call the Cloudbeds adapter with the correct ID for their API.
          processedData = await cloudbedsAdapter.getUpcomingMetrics(
            accessToken,
            cloudbedsApiId,
            tax_rate,
            pricingModel,
          );
        } catch (err) {
          console.error(
            `-- Failed to fetch Cloudbeds data for ${property_name}. Error: --`,
            err.message,
          );
          failures.push({ hotel_id, property_name, pms_type: "cloudbeds", error: err.message });
          continue; // Skip to the next hotel.
        }
      } else if (pms_type === "mews") {
        try {
          // Get Mews credentials using the new adapter pattern
          // (ClientToken from env, AccessToken from hotels.pms_credentials)
          const credentials = await mewsAdapter.getCredentials(hotel_id);

          // Get the serviceId from pms_credentials stored during onboarding
          const credsResult = await pgPool.query(
            "SELECT pms_credentials FROM hotels WHERE hotel_id = $1",
            [hotel_id],
          );
          const pmsCreds = credsResult.rows[0]?.pms_credentials;
          const serviceId = pmsCreds?.serviceId;
          const tz = pmsCreds?.timezone || timezone || "UTC";

          if (!serviceId) {
            throw new Error(
              `No serviceId in pms_credentials for Mews hotel ${hotel_id}. Re-onboard the property.`,
            );
          }

          // Probe capacity once (avoids redundant API call per chunk)
          const mewsCapacity = await mewsAdapter.probeCapacity(credentials, serviceId);
          console.log(`-- Mews capacity for ${property_name}: ${mewsCapacity} rooms --`);

          // Update total_rooms if it drifted (rooms added/removed in Mews)
          if (mewsCapacity && mewsCapacity !== total_rooms) {
            await pgPool.query("UPDATE hotels SET total_rooms = $1 WHERE hotel_id = $2", [mewsCapacity, hotel_id]);
            total_rooms = mewsCapacity;
            console.log(`-- Updated total_rooms for ${property_name}: ${total_rooms} → ${mewsCapacity} --`);
          }

          const dataMap = {};
          let currentStartDate = new Date();
          currentStartDate.setDate(currentStartDate.getDate() - 14); // 14 days back to recapture
          const finalEndDate = new Date();
          finalEndDate.setDate(finalEndDate.getDate() + 367);

          // Loop through in 90-day chunks to respect Mews API limits (max 3 months for reservations)
          while (currentStartDate < finalEndDate) {
            let currentEndDate = new Date(currentStartDate);
            currentEndDate.setDate(currentEndDate.getDate() + 89);

            if (currentEndDate > finalEndDate) {
              currentEndDate = finalEndDate;
            }

            const startDateStr = currentStartDate.toISOString().split("T")[0];
            const endDateStr = currentEndDate.toISOString().split("T")[0];

            console.log(
              `-- Fetching Mews forecast chunk from ${startDateStr} to ${endDateStr}... --`,
            );

            try {
              const chunkData = await mewsAdapter.getCombinedMetrics(
                credentials,
                serviceId,
                startDateStr,
                endDateStr,
                tz,
                mewsCapacity,
              );
              Object.assign(dataMap, chunkData);
            } catch (chunkErr) {
              console.error(
                `-- Mews chunk failed (${startDateStr} to ${endDateStr}): ${chunkErr.message}. Skipping chunk. --`,
              );
            }

            currentStartDate.setDate(currentStartDate.getDate() + 90);
          }

          processedData = dataMap;
        } catch (err) {
          console.error(
            `-- Failed to fetch Mews forecast for ${property_name}. Error: --`,
            err.message,
          );
          failures.push({ hotel_id, property_name, pms_type: "mews", error: err.message });
          continue;
        }
      } else {
        console.log(
          `-- Unknown PMS type '${pms_type}' for hotel ${property_name}. Skipping. --`,
        );
        continue; // Skip unknown PMS types.
      }

      // History lock: hotels.history_locked_until freezes all stay_dates on or
      // before that date — refresh data for those dates is discarded, never upserted.
      const historyLockedUntil = hotel.history_locked_until || null;
      let datesToUpdate = Object.keys(processedData);
      if (historyLockedUntil) {
        const beforeCount = datesToUpdate.length;
        datesToUpdate = datesToUpdate.filter((date) => date > historyLockedUntil);
        if (datesToUpdate.length !== beforeCount) {
          console.log(
            `-- History lock (${historyLockedUntil}): skipped ${beforeCount - datesToUpdate.length} locked dates for ${property_name}. --`,
          );
        }
      }

      if (datesToUpdate.length > 0) {
        const client = await pgPool.connect();
        try {
          await client.query("BEGIN");

          // Find a cloudbeds_user_id for the property, required by the legacy DB schema.
          // NOTE: This can be removed once cloudbeds_user_id is removed from the table.
          const userResult = await client.query(
            "SELECT user_id FROM user_properties WHERE property_id = $1 LIMIT 1",
            [hotel_id],
          );
          const cloudbedsUserId =
            userResult.rows.length > 0 ? userResult.rows[0].user_id : null;

          const todayIso = new Date().toISOString().slice(0, 10);
          const bulkInsertValues = datesToUpdate.map((date) => {
            const metrics = processedData[date];
            // This data structure matches what both adapters will return.
            return [
              todayIso, // snapshot_taken_date
              date,
              hotel_id,
              metrics.rooms_sold || 0,
              total_rooms || metrics.capacity_count || 0, // <-- REPLACED: Prioritizes static total_rooms
              cloudbedsUserId, // Legacy column
              metrics.net_revenue || 0,
              metrics.gross_revenue || 0,
              metrics.net_adr || 0,
              metrics.gross_adr || 0,
              metrics.net_revpar || 0,
              metrics.gross_revpar || 0,
            ];
          });

          // This single query works for both Cloudbeds and Mews data.
          // Note: occupancy_direct is no longer populated as it was a calculated field.
          const query = format(
            `INSERT INTO daily_metrics_snapshots (snapshot_taken_date, stay_date, hotel_id, rooms_sold, capacity_count, cloudbeds_user_id, net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar)
             VALUES %L
             ON CONFLICT (hotel_id, stay_date) DO UPDATE SET
                 snapshot_taken_date = EXCLUDED.snapshot_taken_date,
                 rooms_sold = EXCLUDED.rooms_sold,
                 capacity_count = EXCLUDED.capacity_count,
                 cloudbeds_user_id = EXCLUDED.cloudbeds_user_id,
                 net_revenue = EXCLUDED.net_revenue,
                 gross_revenue = EXCLUDED.gross_revenue,
                 net_adr = EXCLUDED.net_adr,
                 gross_adr = EXCLUDED.gross_adr,
                 net_revpar = EXCLUDED.net_revpar,
                 gross_revpar = EXCLUDED.gross_revpar;`,
            bulkInsertValues,
          );

          await client.query(query);

          // --- PACING SNAPSHOT (HISTORIAN) ---
          // Archive the current future state for this hotel into the pacing_snapshots table.
          // This allows us to calculate pickup (today vs yesterday) later.
          const snapshotQuery = `
            INSERT INTO pacing_snapshots (hotel_id, snapshot_date, stay_date, rooms_sold, capacity_count, net_revenue, gross_revenue)
            SELECT hotel_id, CURRENT_DATE, stay_date, rooms_sold, capacity_count, net_revenue, gross_revenue
            FROM daily_metrics_snapshots
            WHERE hotel_id = $1
              AND stay_date >= CURRENT_DATE
              AND stay_date <= CURRENT_DATE + INTERVAL '365 days'
            ON CONFLICT (hotel_id, snapshot_date, stay_date) DO NOTHING;
          `;
          await client.query(snapshotQuery, [hotel_id]);

          await client.query("COMMIT");

          totalRecordsUpdated += datesToUpdate.length;
          console.log(
            `-- Successfully updated ${datesToUpdate.length} forecast records for ${property_name}. --`,
          );
        } catch (e) {
          await client.query("ROLLBACK");
          console.error(
            `-- DB update failed for ${property_name}. Error: --`,
            e.message,
          );
        } finally {
          client.release();
        }
      } else {
        console.log(
          `-- No new forecast records to update for ${property_name}. --`,
        );
        emptyData.push({ hotel_id, property_name, pms_type });
      }
    }

    // --- FLEET REFRESH ALERTING ---
    // A per-hotel fetch failure used to be console.error'd then silently skipped
    // (catch -> continue), so a fleet-wide PMS/API breakage still finished as a
    // "Success" with system_state updated — exactly how the Cloudbeds dynamic-CDF
    // 400 outage went unnoticed from 2026-05-19. Aggregate failures and raise a
    // real alert (structured log + Sentry), escalating when an entire PMS is down.
    if (failures.length > 0 || emptyData.length > 0) {
      const processed = allProperties.length;
      const failedByPms = failures.reduce(
        (acc, f) => ((acc[f.pms_type] = (acc[f.pms_type] || 0) + 1), acc),
        {},
      );
      const processedByPms = allProperties.reduce(
        (acc, h) => ((acc[h.pms_type] = (acc[h.pms_type] || 0) + 1), acc),
        {},
      );
      const bySignature = failures.reduce((acc, f) => {
        const sig = String(f.error || "unknown").split("\n")[0].slice(0, 80);
        (acc[sig] = acc[sig] || []).push(f.property_name);
        return acc;
      }, {});
      // Fleet-wide = >=50% of processed hotels failed, or every hotel of some PMS failed.
      const wholePmsDown = Object.entries(failedByPms).some(
        ([pms, n]) => processedByPms[pms] && n >= processedByPms[pms],
      );
      const isCritical =
        processed > 0 && (failures.length / processed >= 0.5 || wholePmsDown);
      const summary = {
        type: "cron",
        job: "daily-refresh",
        event: "refresh_failures",
        processed,
        failed: failures.length,
        emptyData: emptyData.length,
        failedByPms,
        signatures: Object.fromEntries(
          Object.entries(bySignature).map(([sig, hotels]) => [sig, hotels.length]),
        ),
        sample: failures.slice(0, 5),
      };
      if (failures.length > 0) {
        logger.error(
          summary,
          `[daily-refresh] ${failures.length}/${processed} hotels failed to refresh${isCritical ? " (FLEET-WIDE)" : ""}`,
        );
        try {
          Sentry.withScope((scope) => {
            scope.setLevel(isCritical ? "fatal" : "warning");
            scope.setContext("daily_refresh", summary);
            Sentry.captureMessage(
              `daily-refresh: ${failures.length}/${processed} hotels failed${isCritical ? " — FLEET-WIDE outage" : ""}`,
            );
          });
        } catch (sentryErr) {
          console.error("Sentry capture failed:", sentryErr.message);
        }
      } else {
        logger.warn(
          summary,
          `[daily-refresh] ${emptyData.length}/${processed} hotels returned 0 forecast rows`,
        );
      }
    }

    console.log(
      "✅ Daily forecast refresh job complete. Attempting to update system_state table...",
    );
    const jobData = { timestamp: new Date().toISOString() };
    const stateClient = await pgPool.connect();
    try {
      // --- GATELOG: About to update system_state ---
      console.log("GATELOG: Writing new timestamp to system_state...");

      // THE FIX: Corrected the key to match what the dashboard API endpoint reads.
      await stateClient.query(
        "INSERT INTO system_state (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2;",
        ["last_successful_refresh", jobData],
      );

      // --- GATELOG: Finished updating system_state ---
      console.log("GATELOG: Write to system_state complete.");
    } catch (e) {
      console.error("CRITICAL: Failed to update system_state.", e.message);
      throw e; // Re-throw to be caught by main catch block
    } finally {
      stateClient.release();
    }

    response.status(200).json({
      status: "Success",
      processedProperties: allProperties.length,
      totalRecordsUpdated: totalRecordsUpdated,
      failed: failures.length,
      emptyData: emptyData.length,
      failedHotels: failures.map((f) => ({
        hotel_id: f.hotel_id,
        property_name: f.property_name,
        pms_type: f.pms_type,
        error: f.error,
      })),
    });
  } catch (error) {
    console.error("CRON JOB FAILED:", error);
    response.status(500).json({ status: "Failure", error: error.message });
  }
};
