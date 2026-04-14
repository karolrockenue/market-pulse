/**
 * REAL RECALC for Durrant House (318344) — uses patched previewCalendar.
 *
 * THIS WILL:
 *   - read prod Neon DB
 *   - call sentinelService.recalculateRates(318344, ...)
 *   - write SENTINEL rows into prod sentinel_rates_calendar
 *   - insert jobs into prod sentinel_job_queue
 *
 * THEN: Railway's per-minute worker (process-queue cron) drains the queue
 * and pushes the rates to Cloudbeds for real.
 *
 * Run from project root:
 *   node scripts/recalc-durrant.js
 *
 * Safe for Durrant only (the property is brand new in Cloudbeds, has no
 * live bookings, and the 71 prior bad jobs were already SKIPPED via
 * containment SQL). Do NOT point this at any other hotel without thought.
 */

require("dotenv").config();
const sentinelService = require("../api/services/sentinel.service");

const HOTEL_ID = 318344;

(async () => {
  try {
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 365 * 86400000)
      .toISOString()
      .split("T")[0];

    console.log(
      `\n[RECALC] Hotel ${HOTEL_ID} | Range: ${startDate} → ${endDate}\n`
    );

    const result = await sentinelService.recalculateRates(
      HOTEL_ID,
      startDate,
      endDate
    );

    console.log(`\n[RECALC] Done.`);
    console.log(`[RECALC] Total rates queued: ${result.totalQueued}`);
    console.log(
      `[RECALC] Railway's per-minute worker will now drain the queue.`
    );
    console.log(
      `[RECALC] Watch sentinel_rates_calendar and the Cloudbeds activity log.\n`
    );
    process.exit(0);
  } catch (err) {
    console.error("\n[RECALC] FAILED:", err);
    process.exit(1);
  }
})();
