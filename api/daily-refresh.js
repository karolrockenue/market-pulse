// /api/daily-refresh.js (Refactored for Direct DB Update)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const format = require("pg-format");
// add this line at the top
const mewsAdapter = require("../adapters/mewsAdapter.js");

// /api/daily-refresh.js
// ...
// replace with this
module.exports = async (request, response) => {
  console.log("Starting daily refresh for all properties...");
  const client = await pgPool.connect();

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log(`Fetching data for date: ${yesterdayStr}`);

    const hotelsResult = await client.query("SELECT * FROM hotels");
    const allHotels = hotelsResult.rows;
    let processedCount = 0;

    for (const hotel of allHotels) {
      const { hotel_id, pms_type, timezone } = hotel;
      console.log(
        `Processing hotel: ${hotel.property_name} (ID: ${hotel_id}, PMS: ${pms_type})`
      );

      if (pms_type === "mews") {
        try {
          const credsResult = await client.query(
            "SELECT pms_credentials FROM user_properties WHERE property_id = $1 LIMIT 1",
            [hotel_id]
          );
          const credentials = credsResult.rows[0]?.pms_credentials;
          if (!credentials || !timezone) {
            throw new Error("Missing credentials or timezone for Mews hotel.");
          }

          const [occupancyData, revenueData] = await Promise.all([
            mewsAdapter.getOccupancyMetrics(
              credentials,
              yesterdayStr,
              yesterdayStr,
              timezone
            ),
            mewsAdapter.getRevenueMetrics(
              credentials,
              yesterdayStr,
              yesterdayStr,
              timezone
            ),
          ]);

          const metrics = {
            ...occupancyData.dailyMetrics[0],
            ...revenueData.dailyMetrics[0],
          };
          const rooms_sold = metrics.occupied || 0;
          const capacity_count = metrics.available || 0;
          const net_revenue = metrics.netRevenue || 0;
          const gross_revenue = metrics.grossRevenue || 0;

          const upsertQuery = format(
            `INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, rooms_sold, capacity_count, net_revenue, gross_revenue)
             VALUES (%L, %L, %L, %L, %L, %L)
             ON CONFLICT (hotel_id, stay_date) 
             DO UPDATE SET rooms_sold = EXCLUDED.rooms_sold, capacity_count = EXCLUDED.capacity_count, net_revenue = EXCLUDED.net_revenue, gross_revenue = EXCLUDED.gross_revenue;`,
            yesterdayStr,
            hotel_id,
            rooms_sold,
            capacity_count,
            net_revenue,
            gross_revenue
          );
          await client.query(upsertQuery);
          console.log(
            `✅ Successfully refreshed data for Mews hotel ID: ${hotel_id}`
          );
          processedCount++;
        } catch (err) {
          console.error(
            `❌ Failed to refresh data for Mews hotel ID ${hotel_id}:`,
            err.message
          );
        }
      } else if (pms_type === "cloudbeds") {
        try {
          const accessToken = await cloudbedsAdapter.getAccessToken(hotel_id);
          const data = await cloudbedsAdapter.getDailyFinancials(
            accessToken,
            hotel_id,
            yesterdayStr
          );

          if (data) {
            const {
              rooms_sold,
              capacity_count,
              net_revenue,
              gross_revenue,
              net_adr,
              gross_adr,
              net_revpar,
              gross_revpar,
            } = data;
            const upsertQuery = format(
              `INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, rooms_sold, capacity_count, net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar)
               VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)
               ON CONFLICT (hotel_id, stay_date)
               DO UPDATE SET rooms_sold = EXCLUDED.rooms_sold, capacity_count = EXCLUDED.capacity_count, net_revenue = EXCLUDED.net_revenue, gross_revenue = EXCLUDED.gross_revenue, net_adr = EXCLUDED.net_adr, gross_adr = EXCLUDED.gross_adr, net_revpar = EXCLUDED.net_revpar, gross_revpar = EXCLUDED.gross_revpar;`,
              yesterdayStr,
              hotel_id,
              rooms_sold,
              capacity_count,
              net_revenue,
              gross_revenue,
              net_adr,
              gross_adr,
              net_revpar,
              gross_revpar
            );
            await client.query(upsertQuery);
            console.log(
              `✅ Successfully refreshed data for Cloudbeds hotel ID: ${hotel_id}`
            );
            processedCount++;
          }
        } catch (err) {
          console.error(
            `❌ Failed to refresh data for Cloudbeds hotel ID ${hotel_id}:`,
            err.message
          );
        }
      }
    } // end for loop

    console.log("Daily refresh job finished.");
    return response.status(200).json({
      success: true,
      message: `Daily refresh completed. Processed ${processedCount} of ${allHotels.length} hotels.`,
    });
  } catch (e) {
    console.error("A critical error occurred during the daily refresh:", e);
    return response.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
};
