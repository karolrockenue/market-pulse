// /fix-cloudbeds-tax.js
require("dotenv").config();
const pgPool = require("./api/utils/db");

/**
 * A one-time script to correct historical data for Cloudbeds properties
 * with 'inclusive' tax rates, where net/gross values were stored incorrectly.
 */
async function runBackfill() {
  console.log("🚀 Starting historical data correction script...");
  const client = await pgPool.connect();

  try {
    // Start a transaction to ensure all updates succeed or none do.
    await client.query("BEGIN");

    // 1. Find all hotels that are affected by this specific issue.
    const hotelsResult = await client.query(`
      SELECT hotel_id, tax_rate, property_name
      FROM hotels
      WHERE pms_type = 'cloudbeds' AND tax_type = 'inclusive'
    `);

    const affectedHotels = hotelsResult.rows;

    if (affectedHotels.length === 0) {
      console.log("✅ No affected hotels found. Your data is already correct.");
      return;
    }

    console.log(
      `Found ${affectedHotels.length} affected hotel(s). Processing now...`
    );

    // 2. Loop through each affected hotel and correct its data.
    for (const hotel of affectedHotels) {
      const { hotel_id, tax_rate, property_name } = hotel;
      const taxMultiplier = 1 + parseFloat(tax_rate);

      console.log(`--- Processing ${property_name} (ID: ${hotel_id}) ---`);

      // 3. This is the core update logic.
      // It uses the value in 'gross_revenue' (which we know is the true net) as the base for all calculations.
      const updateResult = await client.query(
        `
        UPDATE daily_metrics_snapshots
        SET
          -- The old 'gross_revenue' was the correct net, so we move it to 'net_revenue'.
          net_revenue = gross_revenue,

          -- We calculate the new, correct 'gross_revenue' by adding tax to the true net.
          gross_revenue = gross_revenue * $2,

          -- We recalculate all derived metrics based on the new, correct values.
          net_adr = CASE WHEN rooms_sold > 0 THEN gross_revenue / rooms_sold ELSE 0 END,
          gross_adr = CASE WHEN rooms_sold > 0 THEN (gross_revenue * $2) / rooms_sold ELSE 0 END,
          net_revpar = CASE WHEN capacity_count > 0 THEN gross_revenue / capacity_count ELSE 0 END,
          gross_revpar = CASE WHEN capacity_count > 0 THEN (gross_revenue * $2) / capacity_count ELSE 0 END
        WHERE hotel_id = $1
      `,
        [hotel_id, taxMultiplier]
      );

      console.log(
        `--- Corrected ${updateResult.rowCount} records for ${property_name}. ---`
      );
    }

    // 4. If all updates were successful, commit the changes to the database.
    await client.query("COMMIT");
    console.log("\n✅ All historical data has been successfully corrected!");
  } catch (error) {
    // 5. If any error occurred, roll back all changes to keep the database consistent.
    await client.query("ROLLBACK");
    console.error(
      "❌ An error occurred. Rolling back all changes. Your database is untouched.",
      error
    );
    throw error; // Re-throw the error to exit the script with a failure code.
  } finally {
    // 6. Always release the database client back to the pool.
    client.release();
  }
}

// Execute the script
runBackfill()
  .then(() => {
    console.log("Script finished.");
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
