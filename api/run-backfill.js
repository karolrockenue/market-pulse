// /api/run-backfill.js
require("dotenv").config();
const pgPool = require("./utils/db");

/**
 * The core backfill logic.
 */
async function runTheCorrection() {
  const client = await pgPool.connect();
  let updatedCount = 0;
  let hotelCount = 0;

  try {
    await client.query("BEGIN");

    const hotelsResult = await client.query(`
      SELECT hotel_id, tax_rate, property_name
      FROM hotels
      WHERE pms_type = 'cloudbeds' AND tax_type = 'inclusive'
    `);
    const affectedHotels = hotelsResult.rows;
    hotelCount = affectedHotels.length;

    if (hotelCount === 0) {
      return {
        success: true,
        message: "No affected hotels found. Data is already correct.",
      };
    }

    for (const hotel of affectedHotels) {
      const { hotel_id, tax_rate } = hotel;
      const taxMultiplier = 1 + parseFloat(tax_rate);

      const updateResult = await client.query(
        `
        UPDATE daily_metrics_snapshots
        SET
          net_revenue = gross_revenue,
          gross_revenue = gross_revenue * $2,
          net_adr = CASE WHEN rooms_sold > 0 THEN gross_revenue / rooms_sold ELSE 0 END,
          gross_adr = CASE WHEN rooms_sold > 0 THEN (gross_revenue * $2) / rooms_sold ELSE 0 END,
          net_revpar = CASE WHEN capacity_count > 0 THEN gross_revenue / capacity_count ELSE 0 END,
          gross_revpar = CASE WHEN capacity_count > 0 THEN (gross_revenue * $2) / capacity_count ELSE 0 END
        WHERE hotel_id = $1
      `,
        [hotel_id, taxMultiplier]
      );
      updatedCount += updateResult.rowCount;
    }

    await client.query("COMMIT");
    return {
      success: true,
      message: `Successfully corrected ${updatedCount} records across ${hotelCount} hotel(s).`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Backfill script failed:", error);
    return { success: false, message: error.message };
  } finally {
    client.release();
  }
}

/**
 * The Vercel Serverless Function handler.
 */
export default async function handler(request, response) {
  try {
    console.log("🚀 Backfill endpoint triggered. Running correction...");
    const result = await runTheCorrection();

    if (result.success) {
      console.log(`✅ Backfill successful: ${result.message}`);
      return response
        .status(200)
        .json({ status: "Success", message: result.message });
    } else {
      console.error(`❌ Backfill failed: ${result.message}`);
      return response
        .status(500)
        .json({ status: "Failed", message: result.message });
    }
  } catch (error) {
    console.error("A critical error occurred in the handler:", error);
    return response
      .status(500)
      .json({ status: "Failed", message: "A critical error occurred." });
  }
}
