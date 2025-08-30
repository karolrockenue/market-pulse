// /api/backfill-cloudbeds-metrics.js

// This line loads the environment variables from your .env file
require("dotenv").config();

const express = require("express");
const router = express.Router();
const pgPool = require("./utils/db");
// Import the middleware to ensure only a logged-in admin can run this script.
const { requireAdminApi } = require("./utils/middleware");

/**
 * Recalculates all dependent metrics based on corrected revenue figures.
 * @param {object} snapshot - The original snapshot record from the database.
 * @param {object} hotel - The hotel record, containing the tax_rate.
 * @returns {object} An object containing all the new, corrected metric values.
 */
function recalculateMetrics(snapshot, hotel) {
  const new_net_revenue = parseFloat(snapshot.gross_revenue);
  const taxRate = parseFloat(hotel.tax_rate) || 0;

  const new_gross_revenue = new_net_revenue * (1 + taxRate);
  const rooms_sold = parseInt(snapshot.rooms_sold, 10);
  const capacity_count = parseInt(snapshot.capacity_count, 10);
  const occupancy = capacity_count > 0 ? rooms_sold / capacity_count : 0;

  const new_net_adr = rooms_sold > 0 ? new_net_revenue / rooms_sold : 0;
  const new_gross_adr = rooms_sold > 0 ? new_gross_revenue / rooms_sold : 0;

  const new_net_revpar = new_net_adr * occupancy;
  const new_gross_revpar = new_gross_adr * occupancy;

  return {
    net_revenue: new_net_revenue,
    gross_revenue: new_gross_revenue,
    net_adr: new_net_adr,
    gross_adr: new_gross_adr,
    net_revpar: new_net_revpar,
    gross_revpar: new_gross_revpar,
  };
}

// Protect this route with the admin middleware.
router.get("/", requireAdminApi, async (req, res) => {
  // Immediately send a response to the browser so it doesn't time out.
  // The script will continue to run on the server in the background.
  res
    .status(202)
    .send(
      "--- Starting backfill process for Cloudbeds metrics. This may take several minutes. You can close this window. ---"
    );

  console.log("--- Starting backfill process for Cloudbeds metrics ---");
  const client = await pgPool.connect();

  try {
    const hotelsResult = await client.query(
      "SELECT hotel_id, tax_rate, property_name FROM hotels WHERE pms_type = 'cloudbeds'"
    );
    const cloudbedsHotels = hotelsResult.rows;
    console.log(
      `Found ${cloudbedsHotels.length} Cloudbeds properties to process.`
    );

    for (const hotel of cloudbedsHotels) {
      console.log(
        `\nProcessing hotel: "${hotel.property_name}" (ID: ${hotel.hotel_id})`
      );
      await client.query("BEGIN");
      const snapshotsResult = await client.query(
        "SELECT * FROM daily_metrics_snapshots WHERE hotel_id = $1",
        [hotel.hotel_id]
      );
      const snapshots = snapshotsResult.rows;

      if (snapshots.length === 0) {
        console.log(" -> No snapshots found for this hotel. Skipping.");
        await client.query("COMMIT");
        continue;
      }

      console.log(` -> Found ${snapshots.length} snapshots to correct.`);
      for (const snapshot of snapshots) {
        const correctedMetrics = recalculateMetrics(snapshot, hotel);
        await client.query(
          `UPDATE daily_metrics_snapshots SET
                        net_revenue = $1, gross_revenue = $2, net_adr = $3, gross_adr = $4, net_revpar = $5, gross_revpar = $6
                     WHERE snapshot_id = $7`,
          [
            correctedMetrics.net_revenue,
            correctedMetrics.gross_revenue,
            correctedMetrics.net_adr,
            correctedMetrics.gross_adr,
            correctedMetrics.net_revpar,
            correctedMetrics.gross_revpar,
            snapshot.snapshot_id,
          ]
        );
      }
      await client.query("COMMIT");
      console.log(` -> Successfully updated ${snapshots.length} snapshots.`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      "!!! An error occurred during the backfill process !!!",
      error
    );
  } finally {
    client.release();
    console.log("\n--- Backfill process finished ---");
  }
});

module.exports = router;
