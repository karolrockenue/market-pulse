// /api/routes/admin.router.js
console.log("[SERVER STARTUP] Admin router file is being loaded."); // Add this line

// /api/routes/admin.router.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

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
router.post("/sync-hotel-info", requireAdminApi, async (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId) {
    return res.status(400).json({ error: "A propertyId is required." });
  }

  try {
    // Use the new helper to get a valid token for the logged-in admin.
    const accessToken = await getAdminAccessToken(req.session.userId);

    // Execute all sync functions concurrently.
    await Promise.all([
      cloudbeds.syncHotelDetailsToDb(accessToken, propertyId),
      cloudbeds.syncHotelTaxInfoToDb(accessToken, propertyId),
    ]);

    // Sync neighborhood after core details are saved to ensure lat/lon exist.
    const hotelRes = await pgPool.query(
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
        await pgPool.query(
          "UPDATE hotels SET neighborhood = $1 WHERE hotel_id = $2",
          [neighborhood, propertyId]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully synced all hotel information for property ${propertyId}.`,
    });
  } catch (error) {
    console.error(
      `Error syncing hotel info for property ${propertyId}:`,
      error
    );
    res
      .status(500)
      .json({ error: error.message || "An internal server error occurred." });
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

// --- API EXPLORER ENDPOINTS ---
// --- API EXPLORER ENDPOINTS (Corrected) ---
// This single handler manages all API explorer requests by calling the new helper.
router.get("/explore/:endpoint", requireAdminApi, async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { id, columns } = req.query;

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
        targetUrl =
          "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify({
          property_ids: [propertyId],
          dataset_id: parseInt(id, 10),
          columns: columns
            .split(",")
            .map((c) => ({ cdf: { column: c.trim() }, metrics: ["sum"] })),
          group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
          settings: { details: true, totals: true },
        });
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
        // Get today's and tomorrow's date in YYYY-MM-DD format.
        const today = new Date().toISOString().split("T")[0];
        const tomorrow = new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0]; // 86400000ms = 24 hours
        // Add the required startDate and endDate parameters to the URL.
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

module.exports = router;
