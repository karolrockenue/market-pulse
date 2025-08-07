// /api/routes/admin.router.js
console.log("[SERVER STARTUP] Admin router file is being loaded."); // Add this line

// /api/routes/admin.router.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const format = require("pg-format"); // <-- Add this line

// Import shared utilities
const pgPool = require("../utils/db");
const { requireAdminApi } = require("../utils/middleware");

// NEW: Import the handlers for the serverless cron jobs
const dailyRefreshHandler = require("../daily-refresh.js");
const initialSyncHandler = require("../initial-sync.js");

// Add this line with the other require statements
const cloudbeds = require("../utils/cloudbeds");
// Import the entire adapter module.
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter.js");
// In a future step, this could be moved to a shared /api/utils/cloudbeds.js utility
// This helper finds the admin's refresh token from its new location in the database.
async function getAdminRefreshToken(adminUserId) {
  const result = await pgPool.query(
    `SELECT pms_credentials FROM user_properties WHERE user_id = $1 LIMIT 1`,
    [adminUserId]
  );
  // Optional chaining (?.) safely handles cases where credentials or the token might be missing.
  return result.rows[0]?.pms_credentials?.refresh_token;
}

// This is the main helper we will now use in all admin routes.
// This is the main helper we will now use in all admin routes.
// This is the new, corrected version of the function.
async function getAdminAccessToken(adminUserId) {
  // Step 1: Find a property this admin has access to.
  const propertyResult = await pgPool.query(
    "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
    [adminUserId]
  );

  if (propertyResult.rows.length === 0) {
    throw new Error("This admin user is not associated with any properties.");
  }
  const propertyId = propertyResult.rows[0].property_id;

  // Step 2: Find the credentials for that property. They might belong to the
  // original user who connected the account, not the current admin.
  // This query specifically looks for a record that HAS a refresh token.
  const credsResult = await pgPool.query(
    `SELECT pms_credentials FROM user_properties WHERE property_id = $1 AND pms_credentials->>'refresh_token' IS NOT NULL LIMIT 1`,
    [propertyId]
  );

  const refreshToken = credsResult.rows[0]?.pms_credentials?.refresh_token;

  if (!refreshToken) {
    throw new Error(
      "Could not find a valid refresh token for the property this admin has access to."
    );
  }

  // --- The rest of the function remains the same ---
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await response.json();

  if (!tokenData.access_token) {
    console.error("Token refresh failed for admin user:", tokenData);
    throw new Error("Cloudbeds authentication failed for admin user.");
  }

  // Return an object containing both the token and the property ID.
  return { accessToken: tokenData.access_token, propertyId };
}

// --- ADMIN API ENDPOINTS ---
// All routes are now protected by the requireAdminApi middleware.

router.get("/get-all-hotels", requireAdminApi, async (req, res) => {
  try {
    const { rows } = await pgPool.query(
      // Select the new 'category' column instead of 'star_rating'
      "SELECT hotel_id, property_name, property_type, city, category, neighborhood FROM hotels ORDER BY property_name"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotels." });
  }
});
router.get("/test-database", requireAdminApi, async (req, res) => {
  try {
    const client = await pgPool.connect();
    client.release();
    res
      .status(200)
      .json({ success: true, message: "Database connection successful." });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Database connection failed." });
  }
});

router.get("/test-cloudbeds", requireAdminApi, async (req, res) => {
  try {
    // The new helper function handles all the logic.
    const accessToken = await getAdminAccessToken(req.session.userId);
    if (accessToken) {
      res.status(200).json({
        success: true,
        message: "Cloudbeds authentication successful.",
      });
    } else {
      throw new Error("Failed to obtain access token.");
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Route to manually trigger the daily refresh job
router.get("/daily-refresh", requireAdminApi, async (req, res) => {
  console.log("Admin panel manually triggering daily-refresh job...");
  // We call the handler directly, passing the request and response objects.
  await dailyRefreshHandler(req, res);
});

// NEW: Route to manually trigger the initial sync job
router.post("/initial-sync", requireAdminApi, async (req, res) => {
  console.log("Admin panel manually triggering initial-sync job...");
  // We call the handler directly, passing the request and response objects.
  await initialSyncHandler(req, res);
});

// /api/routes/admin.router.js
// /api/routes/admin.router.js
router.post("/sync-hotel-info", requireAdminApi, async (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId) {
    return res.status(400).json({ error: "A propertyId is required." });
  }

  const client = await pgPool.connect(); // Use a single client for the transaction
  try {
    // --- FIX: Correctly destructure the object from getAdminAccessToken ---
    // The function returns { accessToken, propertyId }, so we need to get the token string.
    const { accessToken } = await getAdminAccessToken(req.session.userId);

    // Start a database transaction.
    await client.query("BEGIN");

    // Execute all Cloudbeds sync functions concurrently.
    // --- FIX: Use the consistent 'cloudbedsAdapter' module for all calls. ---
    await Promise.all([
      cloudbedsAdapter.syncHotelDetailsToDb(accessToken, propertyId, client),
      cloudbedsAdapter.syncHotelTaxInfoToDb(accessToken, propertyId, client),
    ]);

    // Sync neighborhood after core details are saved to ensure lat/lon exist.
    const hotelRes = await client.query(
      "SELECT latitude, longitude FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    const coords = hotelRes.rows[0];

    if (coords && coords.latitude && coords.longitude) {
      const neighborhood = await cloudbedsAdapter.getNeighborhoodFromCoords(
        coords.latitude,
        coords.longitude
      );
      if (neighborhood) {
        await client.query(
          "UPDATE hotels SET neighborhood = $1 WHERE hotel_id = $2",
          [neighborhood, propertyId]
        );
      }
    }

    // Commit the transaction if all operations were successful.
    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: `Successfully synced all hotel information for property ${propertyId}.`,
    });
  } catch (error) {
    // If any error occurs, roll back the entire transaction.
    await client.query("ROLLBACK");
    console.error(
      `Error syncing hotel info for property ${propertyId}:`,
      error
    );
    res
      .status(500)
      .json({ error: error.message || "An internal server error occurred." });
  } finally {
    // ALWAYS release the client back to the pool.
    client.release();
  }
});

// This endpoint was missing from the original server.js but is called by admin.mjs
router.get("/run-endpoint-tests", requireAdminApi, (req, res) => {
  const results = [
    {
      name: "KPI Summary",
      ok: true,
      status: 200,
      statusText: "OK (Route exists)",
    },
    {
      name: "Your Hotel Metrics",
      ok: true,
      status: 200,
      statusText: "OK (Route exists)",
    },
    {
      name: "Competitor Metrics",
      ok: true,
      status: 200,
      statusText: "OK (Route exists)",
    },
  ];
  res.status(200).json(results);
});
router.get("/explore/:endpoint", requireAdminApi, async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { id, columns, startDate, endDate, groupBy } = req.query;

    const { accessToken, propertyId } = await getAdminAccessToken(
      req.session.userId
    );

    let targetUrl;
    let options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": propertyId,
      },
    };

    switch (endpoint) {
      // Insights API
      case "datasets":
        targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";
        break;
      case "dataset-structure":
        if (!id)
          return res.status(400).json({ error: "Dataset ID is required." });
        targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;
        break;
      case "insights-data":
        if (!id || !columns)
          return res
            .status(400)
            .json({ error: "Dataset ID and columns are required." });
        const requestBody = {
          property_ids: [propertyId],
          dataset_id: parseInt(id, 10),
          columns: columns
            .split(",")
            .map((c) => ({ cdf: { column: c.trim() }, metrics: ["sum"] })),
          settings: { details: true, totals: true },
        };
        // 2. Add date filters to the request body IF they were provided
        if (startDate && endDate) {
          // FIX: The filter must be an array of objects, with the column specified inside a 'cdf' object.
          requestBody.filters = [
            {
              cdf: { column: "stay_date" },
              from: startDate,
              to: endDate,
            },
          ];
        }
        let groupRows = [{ cdf: { column: "stay_date" }, modifier: "day" }];
        if (groupBy) {
          const dimensions = groupBy
            .split(",")
            .map((dim) => ({ cdf: { column: dim.trim() } }));
          groupRows = [...groupRows, ...dimensions];
        }
        requestBody.group_rows = groupRows;
        targetUrl =
          "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(requestBody);
        break;

      // General API
      case "sample-hotel":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${propertyId}`;
        break;
      case "sample-guest":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getGuestList?propertyID=${propertyId}&pageSize=1`;
        break;
      case "sample-reservation":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getReservations?propertyID=${propertyId}&pageSize=1`;
        break;
      case "sample-room":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getRoomList?propertyID=${propertyId}&pageSize=1`;
        break;
      case "sample-rate":
        const today = new Date().toISOString().split("T")[0];
        const tomorrow = new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0];
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getRoomRates?propertyID=${propertyId}&pageSize=1&startDate=${today}&endDate=${tomorrow}`;
        break;
      case "taxes-fees":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getTaxesAndFees?propertyID=${propertyId}`;
        break;
      case "user-info":
        targetUrl = "https://api.cloudbeds.com/api/v1.3/userinfo";
        break;

      default:
        return res.status(404).json({ error: "Unknown explorer endpoint." });
    }

    const apiResponse = await fetch(targetUrl, options);
    const data = await apiResponse.json();
    if (!apiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// /api/routes/admin.router.js

// NEW: Endpoint to update a hotel's category
router.post("/update-hotel-category", requireAdminApi, async (req, res) => {
  const { hotelId, category } = req.body;

  // Validate that the category is one of the allowed values
  const allowedCategories = ["Budget", "Midscale", "Upper Midscale", "Luxury"];
  if (!allowedCategories.includes(category)) {
    return res.status(400).json({ error: "Invalid category provided." });
  }

  if (!hotelId) {
    return res.status(400).json({ error: "Hotel ID is required." });
  }

  try {
    // Execute the update query
    const result = await pgPool.query(
      "UPDATE hotels SET category = $1 WHERE hotel_id = $2",
      [category, hotelId]
    );

    // Check if any row was actually updated
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Hotel not found." });
    }

    // Send a success response
    res.status(200).json({ message: "Category updated successfully." });
  } catch (error) {
    console.error("Error updating hotel category:", error);
    res.status(500).json({ error: "Failed to update category." });
  }
});
// --- ADD THIS NEW ENDPOINT ---

// NEW: Endpoint to record the successful completion of a background job.
// NEW: Endpoint to record the successful completion of a background job.
// This route is NOT protected by requireAdminApi. Instead, it uses a new, simple
// inline middleware to check for a secret authorization header.
router.post(
  "/record-job-success",
  (req, res, next) => {
    // This is a simple middleware that checks for a secret key.
    const authHeader = req.headers["authorization"];
    const expectedToken = `Bearer ${process.env.INTERNAL_API_SECRET}`;

    if (authHeader !== expectedToken) {
      // If the key doesn't match, deny access.
      return res.status(401).json({ error: "Unauthorized" });
    }
    // If the key matches, proceed to the main route handler.
    next();
  },
  async (req, res) => {
    // Get the job_name from the request body.
    const { jobName } = req.body;
    if (!jobName) {
      return res.status(400).json({ error: "A jobName is required." });
    }

    try {
      // Create the JSON object that will be stored in the database.
      const jobData = {
        timestamp: new Date().toISOString(),
      };

      const query = `
      INSERT INTO system_state (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key)
      DO UPDATE SET value = $2;
    `;

      // --- ADDED FOR DEBUGGING ---
      console.log(
        `[DEBUG] Attempting to update system_state for key: ${jobName}`
      );
      // Execute the query with the job name (e.g., 'last_successful_refresh') and the JSON data.
      const result = await pgPool.query(query, [jobName, jobData]);
      // This will log how many rows were affected. It should be 1.
      console.log(
        `[DEBUG] system_state update complete. Rows affected: ${result.rowCount}`
      );
      // --- END DEBUGGING ---

      res
        .status(200)
        .json({ success: true, message: `Job ${jobName} recorded.` });
    } catch (error) {
      console.error(`Error recording job success for ${jobName}:`, error);
      res
        .status(500)
        .json({ success: false, error: "Failed to record job success." });
    }
  }
);

// --- Comp Set Management Endpoints ---

/**
 * Gets the effective competitive set for a given hotel.
 *
 * It first checks for a manually defined comp set in the `hotel_comp_sets` table.
 * If found, it returns that list.
 * If not found, it falls back to finding all other hotels in the same category.
 */
router.get("/hotel/:hotelId/compset", requireAdminApi, async (req, res) => {
  const { hotelId } = req.params;

  try {
    // First, try to find a custom comp set for this hotel.
    const customCompSetQuery = `
      SELECT h.hotel_id, h.property_name, h.category, h.city
      FROM hotels h
      JOIN hotel_comp_sets cs ON h.hotel_id = cs.competitor_hotel_id
      WHERE cs.hotel_id = $1
      ORDER BY h.property_name;
    `;
    const { rows: customCompSet } = await pgPool.query(customCompSetQuery, [
      hotelId,
    ]);

    // If a custom comp set exists (even if empty), return it.
    if (customCompSet.length > 0) {
      console.log(
        `[Compset] Found ${customCompSet.length} custom competitors for hotel ${hotelId}.`
      );
      return res.json(customCompSet);
    }

    // If no custom comp set exists, fall back to category-based logic.
    // First, get the category of the primary hotel.
    const hotelInfo = await pgPool.query(
      "SELECT category FROM hotels WHERE hotel_id = $1",
      [hotelId]
    );
    if (hotelInfo.rows.length === 0) {
      return res.status(404).json({ error: "Primary hotel not found." });
    }
    const category = hotelInfo.rows[0].category;

    // Then, find all other hotels in that same category.
    const categoryCompSetQuery = `
      SELECT hotel_id, property_name, category, city
      FROM hotels
      WHERE category = $1 AND hotel_id != $2
      ORDER BY property_name;
    `;
    const { rows: categoryCompSet } = await pgPool.query(categoryCompSetQuery, [
      category,
      hotelId,
    ]);
    console.log(
      `[Compset] No custom set for hotel ${hotelId}. Falling back to category '${category}', found ${categoryCompSet.length} competitors.`
    );
    res.json(categoryCompSet);
  } catch (error) {
    console.error(`Error fetching comp set for hotel ${hotelId}:`, error);
    res.status(500).json({ error: "Failed to fetch competitive set." });
  }
});

/**
 * Sets the manual competitive set for a hotel.
 * This operation is transactional: it deletes all old entries and inserts all new ones.
 * Sending an empty array for competitorIds will simply clear the custom comp set.
 */
router.post("/hotel/:hotelId/compset", requireAdminApi, async (req, res) => {
  const { hotelId } = req.params;
  const { competitorIds } = req.body; // Expect an array of hotel IDs

  if (!Array.isArray(competitorIds)) {
    return res.status(400).json({ error: "competitorIds must be an array." });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN"); // Start transaction

    // First, delete all existing comp set entries for this hotel.
    await client.query("DELETE FROM hotel_comp_sets WHERE hotel_id = $1", [
      hotelId,
    ]);

    // If there are new competitors to add, insert them.
    if (competitorIds.length > 0) {
      // Prepare the data for a bulk insert. Each inner array is a row: [hotel_id, competitor_hotel_id]
      const values = competitorIds.map((id) => [hotelId, id]);
      // Use pg-format to create a safe, multi-row INSERT statement.
      const insertQuery = format(
        "INSERT INTO hotel_comp_sets (hotel_id, competitor_hotel_id) VALUES %L",
        values
      );
      await client.query(insertQuery);
    }

    await client.query("COMMIT"); // Commit transaction
    res.status(200).json({
      message: `Successfully updated competitive set for hotel ${hotelId}.`,
    });
  } catch (error) {
    await client.query("ROLLBACK"); // Rollback on error
    console.error(`Error setting comp set for hotel ${hotelId}:`, error);
    res.status(500).json({ error: "Failed to update competitive set." });
  } finally {
    client.release(); // ALWAYS release client
  }
});

module.exports = router;
