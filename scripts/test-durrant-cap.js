/**
 * DRY-RUN TEST for fix/daily-max-key-format
 *
 * Calls the patched previewCalendar() against Durrant House (318344) for
 * a handful of dates that already have a daily_max_rate ceiling, and prints
 * what the engine would return.
 *
 * NO WRITES. NO QUEUE INSERTS. NO PMS PUSHES.
 *
 * Run from project root:
 *   node scripts/test-durrant-cap.js
 *
 * Expected output (after the fix):
 *   2026-04-15  liveRate=…   suggestedRate=…   finalRate=270.00   max=270
 *   2026-07-15  liveRate=…   suggestedRate=…   finalRate=286.00   max=286
 *   2026-12-25  liveRate=…   suggestedRate=…   finalRate=274.66   max=274.66
 *
 * If finalRate is greater than the corresponding daily max, the fix did
 * not land. If finalRate equals the daily max (or is below it because
 * the engine output was already lower), the patch is working.
 */

require("dotenv").config();
const sentinelService = require("../api/services/sentinel.service");

const HOTEL_ID = 318344;
const BASE_ROOM_TYPE_ID = "674565"; // Double
const DATES_TO_INSPECT = [
  "2026-04-15",
  "2026-05-15",
  "2026-07-15",
  "2026-09-05",
  "2026-12-25",
];

(async () => {
  try {
    console.log(
      `\n[DRY RUN] Asking previewCalendar for hotel ${HOTEL_ID}, base room ${BASE_ROOM_TYPE_ID}\n`
    );

    const calendar = await sentinelService.previewCalendar({
      hotelId: HOTEL_ID,
      baseRoomTypeId: BASE_ROOM_TYPE_ID,
      startDate: "2026-04-11",
      endDate: "2027-04-11",
    });

    const byDate = {};
    calendar.forEach((d) => {
      byDate[d.date] = d;
    });

    console.log(
      "date         live      suggested   finalRate   source         maxApplied  isFrozen"
    );
    console.log(
      "-----------  --------  ----------  ----------  -------------  ----------  --------"
    );
    for (const dateStr of DATES_TO_INSPECT) {
      const d = byDate[dateStr];
      if (!d) {
        console.log(`${dateStr}  (no row returned)`);
        continue;
      }
      const live = d.liveRate == null ? "n/a" : Number(d.liveRate).toFixed(2);
      const sug = d.suggestedRate == null ? "n/a" : Number(d.suggestedRate).toFixed(2);
      const fin = d.finalRate == null ? "n/a" : Number(d.finalRate).toFixed(2);
      const src = (d.source || "").padEnd(13);
      const mx = d.guardrailMax == null && d.maxApplied == null
        ? "n/a"
        : Number(d.maxApplied ?? d.guardrailMax).toFixed(2);
      console.log(
        `${dateStr}  ${live.padEnd(8)}  ${sug.padEnd(10)}  ${fin.padEnd(10)}  ${src}  ${mx.padEnd(10)}  ${d.isFrozen ? "yes" : "no"}`
      );
    }

    console.log("\n[DRY RUN] Done. No writes were made.\n");
    process.exit(0);
  } catch (err) {
    console.error("\n[DRY RUN] Failed:", err);
    process.exit(1);
  }
})();
