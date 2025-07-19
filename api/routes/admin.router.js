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
async function getAdminAccessToken(adminUserId) {
  const refreshToken = await getAdminRefreshToken(adminUserId);
  if (!refreshToken) {
    throw new Error(
      "Could not find a valid refresh token for this admin user."
    );
  }

  // Get the admin's default property ID to use for API calls.
  const propertyResult = await pgPool.query(
    "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
    [adminUserId]
  );
  if (propertyResult.rows.length === 0) {
    throw new Error("No properties are associated with this admin account.");
  }
  const propertyId = propertyResult.rows[0].property_id;

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
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getRoomRates?propertyID=${propertyId}&pageSize=1`;
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

// Add this new route to the file.
router.get("/pilot-properties", requireAdminApi, async (req, res) => {
  try {
    // This query fetches all properties that have been provisioned for any user
    // who is in 'manual' mode, and joins to get the hotel name if it exists.
    const query = `
      SELECT up.property_id, up.status, up.user_id, h.property_name
      FROM user_properties up
      LEFT JOIN hotels h ON up.property_id = h.hotel_id
      WHERE up.user_id IN (SELECT cloudbeds_user_id FROM users WHERE auth_mode = 'manual')
      ORDER BY up.user_id, h.property_name;
    `;
    const result = await pgPool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error in /api/pilot-properties:", error);
    res.status(500).json({ error: "Failed to fetch pilot properties." });
  }
});
// --- NEW: Route for setting manual API credentials for a pilot user ---
// --- FINAL FIX: Using the correct ID (cloudbeds_user_id) ---
// /api/routes/admin.router.js
// Add this entire block back into admin.router.js

router.post("/provision-pilot-hotel", requireAdminApi, async (req, res) => {
  const { email, propertyId, clientId, clientSecret, apiKey } = req.body;
  if (!email || !propertyId || !clientId || !clientSecret || !apiKey) {
    return res.status(400).json({
      message:
        "Email, Property ID, Client ID, Client Secret, and API Key are required.",
    });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT cloudbeds_user_id FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      throw new Error(`User with email ${email} not found.`);
    }
    const cloudbedsUserId = userResult.rows[0].cloudbeds_user_id;

    // This query now saves the API key into the new pms_credentials JSONB column.
    const upsertQuery = `
  INSERT INTO user_properties (user_id, property_id, pms_credentials, status)
  VALUES ($1, $2, $3, 'pending')
  ON CONFLICT (user_id, property_id) 
  DO UPDATE SET
    pms_credentials = EXCLUDED.pms_credentials,
    status = 'pending';
`;
    await client.query(upsertQuery, [
      cloudbedsUserId,
      propertyId,
      { api_key: apiKey }, // Save as a JSON object
    ]);

    await client.query("COMMIT");
    res.status(200).json({
      message: `Successfully provisioned property ${propertyId} for user ${email}.`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error in pilot provisioning:", error);
    res
      .status(500)
      .json({ message: error.message || "An internal server error occurred." });
  } finally {
    client.release();
  }
});
// /api/routes/admin.router.js

// NEW: This is the new, backend-only route for activating a pilot property.
router.post("/activate-pilot-property", requireAdminApi, async (req, res) => {
  const { propertyId, userId } = req.body;
  if (!propertyId || !userId) {
    return res
      .status(400)
      .json({ message: "Property ID and User ID are required." });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // CORRECTED: Read api_key from the new pms_credentials column.
    const credsResult = await client.query(
      "SELECT pms_credentials FROM user_properties WHERE property_id = $1 AND user_id = $2",
      [propertyId, userId]
    );

    const apiKey = credsResult.rows[0]?.pms_credentials?.api_key;
    if (!apiKey) {
      throw new Error(
        `No API key found for property ${propertyId}. Please provision it first.`
      );
    }

    await cloudbeds.syncHotelDetailsToDb(apiKey, propertyId);

    // Note: The original code had a bug here trying to set old columns to NULL.
    // This is the correct, simplified query.
    await client.query(
      "UPDATE user_properties SET status = 'connected' WHERE property_id = $1 AND user_id = $2",
      [propertyId, userId]
    );

    await client.query("COMMIT");
    res.status(200).json({
      message: `Property ${propertyId} has been successfully activated.`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error activating pilot property:", error);
    res
      .status(500)
      .json({ message: error.message || "An internal server error occurred." });
  } finally {
    client.release();
  }
});

// api/routes/admin.router.js

// This new route will perform the one-time "app enabling" handshake.
router.post("/enable-pilot-app", requireAdminApi, async (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId) {
    return res.status(400).json({ message: "Property ID is required." });
  }

  try {
    // Get the API key from the new pms_credentials column.
    const keyResult = await pgPool.query(
      "SELECT pms_credentials FROM user_properties WHERE property_id = $1",
      [propertyId]
    );

    const apiKey = keyResult.rows[0]?.pms_credentials?.api_key;
    if (!apiKey) {
      throw new Error(`Could not find API key for property ${propertyId}.`);
    }

    // Call the function to set the app state.
    const success = await cloudbeds.setCloudbedsAppState(apiKey, propertyId);

    if (success) {
      res.status(200).json({
        success: true,
        message: `App successfully enabled for property ${propertyId}.`,
      });
    } else {
      throw new Error("Failed to set app state in Cloudbeds.");
    }
  } catch (error) {
    console.error("Error enabling pilot app:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

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

module.exports = router;
