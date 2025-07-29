// /api/initial-sync.js (Refactored to use the Adapter for Auth)
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");

module.exports = async (request, response) => {
  // Read propertyId from request body (for admin panel) or command line (for auto-sync).
  const propertyId = request.body.propertyId || process.argv[2];

  if (!propertyId) {
    const errorMsg = "A propertyId is required.";
    console.error(`❌ ${errorMsg}`);
    // If called as a webhook, send a response. If called as a script, this won't do anything.
    return response?.status(400).json({ error: errorMsg });
  }

  console.log(`Starting 15-YEAR initial sync for property: ${propertyId}`);

  try {
    const result = await pgPool.query(
      `SELECT u.cloudbeds_user_id, u.auth_mode, up.pms_credentials
       FROM users u 
       JOIN user_properties up ON u.cloudbeds_user_id = up.user_id 
       WHERE up.property_id = $1::integer LIMIT 1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      throw new Error(
        `No active user or property link found for property ${propertyId}.`
      );
    }

    const user = result.rows[0];

    // Get the access token using the adapter. All complex logic is now hidden.
    const accessToken = await cloudbedsAdapter.getAccessToken(
      user.pms_credentials,
      user.auth_mode
    );

    const today = new Date();
    const pastDate = new Date();
    pastDate.setFullYear(today.getFullYear() - 15);
    const futureDate = new Date();
    futureDate.setFullYear(today.getFullYear() + 1);
    const startDate = pastDate.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];
    console.log(`Sync script: Fetching data from ${startDate} to ${endDate}`);

    const processedData = await cloudbedsAdapter.getHistoricalMetrics(
      accessToken,
      propertyId,
      startDate,
      endDate
    );

    const datesToUpdate = Object.keys(processedData);
    if (datesToUpdate.length > 0) {
      for (const date of datesToUpdate) {
        const metrics = processedData[date];
        const query = `
          INSERT INTO daily_metrics_snapshots (stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count, total_revenue, cloudbeds_user_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (hotel_id, stay_date, cloudbeds_user_id) DO UPDATE SET
              adr = EXCLUDED.adr, occupancy_direct = EXCLUDED.occupancy_direct, revpar = EXCLUDED.revpar, rooms_sold = EXCLUDED.rooms_sold,
              capacity_count = EXCLUDED.capacity_count, total_revenue = EXCLUDED.total_revenue;
        `;
        const values = [
          date,
          propertyId,
          metrics.adr || 0,
          metrics.occupancy || 0,
          metrics.revpar || 0,
          metrics.rooms_sold || 0,
          metrics.capacity_count || 0,
          metrics.total_revenue || 0,
          user.cloudbeds_user_id,
        ];
        await pgPool.query(query, values);
      }
    }

    console.log(`✅ Initial sync job complete for property ${propertyId}.`);
    // If called as a webhook, send a response.
    if (response) {
      response
        .status(200)
        .json({ success: true, totalRecordsUpdated: datesToUpdate.length });
    }
  } catch (error) {
    console.error(
      `❌ A critical error occurred during the initial sync for property ${propertyId}:`,
      error
    );
    // If called as a webhook, send a response.
    if (response) {
      response.status(500).json({ success: false, error: error.message });
    }
  }
};
