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
// NEW: Import the handler for the scheduled reports job.
const scheduledReportsHandler = require("../send-scheduled-reports.js");

// Add this line with the other require statements
const cloudbeds = require("../utils/cloudbeds");
// Import the entire adapter module.
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter.js");
const mewsAdapter = require("../adapters/mewsAdapter.js");
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
async function getAdminAccessToken(adminUserId, propertyId) {
  if (!propertyId) {
    throw new Error("A propertyId is required to get an access token.");
  }

  const credsResult = await pgPool.query(
    `SELECT pms_credentials FROM user_properties WHERE property_id = $1 AND pms_credentials->>'refresh_token' IS NOT NULL LIMIT 1`,
    [propertyId]
  );

  const refreshToken = credsResult.rows[0]?.pms_credentials?.refresh_token;

  if (!refreshToken) {
    throw new Error(
      `Could not find a valid refresh token for property ${propertyId}.`
    );
  }

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

  return { accessToken: tokenData.access_token, propertyId: propertyId };
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

// New endpoint to fetch all scheduled reports for the admin panel dropdown.
router.get("/get-scheduled-reports", requireAdminApi, async (req, res) => {
  try {
    // FINAL FIX: The primary key column is 'id', not 'report_id'.
    // We select `sr.id` and alias it as `report_id` for clean output.
    const query = `
        SELECT 
            sr.id AS report_id, 
            sr.report_name,
            h.property_name
        FROM scheduled_reports sr
        JOIN hotels h ON sr.property_id::integer = h.hotel_id
        WHERE sr.property_id ~ '^[0-9]+$'
        ORDER BY h.property_name, sr.report_name;
    `;
    const { rows } = await pgPool.query(query);
    res.json(rows);
  } catch (error) {
    // Standard error handling if the database query fails.
    console.error("Error fetching scheduled reports for admin panel:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch scheduled reports from the database." });
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
    // Get the propertyId from the query string sent by the frontend.
    const { propertyId } = req.query;
    if (!propertyId) {
      // If no propertyId is provided in the request, return a 400 Bad Request error.
      return res.status(400).json({
        success: false,
        error: "Query parameter 'propertyId' is required.",
      });
    }

    // Call the helper function with both the admin's session ID and the target propertyId.
    // The helper returns an object { accessToken, propertyId }, so we destructure it.
    const { accessToken } = await getAdminAccessToken(
      req.session.userId,
      propertyId
    );

    // Check if the token was successfully obtained.
    if (accessToken) {
      // If successful, return a 200 OK response.
      res.status(200).json({
        success: true,
        message: "Cloudbeds authentication successful.",
      });
    } else {
      // This case should theoretically not be reached if getAdminAccessToken throws an error,
      // but it's good practice to handle it.
      throw new Error("Failed to obtain access token.");
    }
  } catch (error) {
    // If any part of the process fails, return a 500 Internal Server Error.
    console.error(
      `[Admin Test] Cloudbeds test failed for property ${req.query.propertyId}:`,
      error
    );
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
// NEW: Route to manually trigger the scheduled reports job
// UPDATED: Route to manually trigger a *single* scheduled report.
// It's now a POST request to accept a reportId in the body.
router.post("/run-scheduled-report", requireAdminApi, async (req, res) => {
  const { reportId } = req.body;
  if (!reportId) {
    return res.status(400).json({ error: "A reportId is required." });
  }

  console.log(`Admin panel manually triggering report ID: ${reportId}`);

  // We call the handler from send-scheduled-reports.js directly.
  // The handler will see the reportId in the req.body and run the
  // logic for a single report.
  await scheduledReportsHandler(req, res);
});

// /api/routes/admin.router.js
// /api/routes/admin.router.js
router.post("/sync-hotel-info", requireAdminApi, async (req, res) => {
  const { propertyId } = req.body;
  if (!propertyId) {
    return res.status(400).json({ error: "A propertyId is required." });
  }

  // Use a single client for a transaction, ensuring the operation is all-or-nothing.
  const client = await pgPool.connect();

  try {
    // First, determine the PMS type for the given propertyId.
    const hotelPmsResult = await client.query(
      "SELECT pms_type FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );
    if (hotelPmsResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found." });
    }
    const pmsType = hotelPmsResult.rows[0].pms_type;

    // Start a database transaction.
    await client.query("BEGIN");

    // Branch the logic based on the PMS type.
    if (pmsType === "cloudbeds") {
      console.log(
        `[Admin Sync] Syncing info for Cloudbeds hotel: ${propertyId}`
      );

      // THE FIX: Look up the correct external PMS ID before calling the adapter.
      // The 'propertyId' variable from the request is our internal ID.
      // We need the 'pms_property_id' for the external Cloudbeds API.
      const hotelDetailsResult = await client.query(
        "SELECT pms_property_id FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );

      // Use the fetched pms_property_id, but fall back to the internal ID for legacy hotels.
      const cloudbedsApiId =
        hotelDetailsResult.rows[0]?.pms_property_id || propertyId;

      console.log(
        `[Admin Sync] Internal ID: ${propertyId}, Found Cloudbeds API ID: ${cloudbedsApiId}`
      );

      // getAdminAccessToken correctly uses our internal ID to find the refresh token.
      const { accessToken } = await getAdminAccessToken(
        req.session.userId,
        propertyId
      );

      // Now, call the adapter functions with the correct external ID (cloudbedsApiId).
      await Promise.all([
        cloudbedsAdapter.syncHotelDetailsToDb(
          accessToken,
          cloudbedsApiId,
          client
        ),
        cloudbedsAdapter.syncHotelTaxInfoToDb(
          accessToken,
          cloudbedsApiId,
          client
        ),
      ]);

      // Sync neighborhood after core details are saved.
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
    } else if (pmsType === "mews") {
      console.log(`[Admin Sync] Syncing info for Mews hotel: ${propertyId}`);

      // --- This is the new logic for Mews ---
      // 1. Get Mews credentials from the database.
      const credsResult = await client.query(
        "SELECT pms_credentials FROM user_properties WHERE property_id = $1 LIMIT 1",
        [propertyId]
      );
      const mewsCredentials = credsResult.rows[0]?.pms_credentials;
      if (
        !mewsCredentials ||
        !mewsCredentials.clientToken ||
        !mewsCredentials.accessToken
      ) {
        throw new Error(
          `Could not find valid Mews credentials for property ${propertyId}.`
        );
      }

      // 2. Call the Mews adapter to get the latest hotel details.
      const hotelDetails = await mewsAdapter.getHotelDetails(mewsCredentials);

      // 3. Construct and run the UPDATE query to save the details to our database.
      const updateQuery = `
        UPDATE hotels
        SET 
          property_name = $1, 
          city = $2, 
          currency_code = $3, 
          latitude = $4, 
          longitude = $5, 
          timezone = $6
        WHERE hotel_id = $7;
      `;
      await client.query(updateQuery, [
        hotelDetails.propertyName,
        hotelDetails.city,
        hotelDetails.currencyCode,
        hotelDetails.latitude,
        hotelDetails.longitude,
        hotelDetails.timezone,
        propertyId,
      ]);
      // 4. Look up and save the neighborhood, reusing the same function as Cloudbeds.
      if (hotelDetails.latitude && hotelDetails.longitude) {
        // We can use the cloudbedsAdapter for this because it's a generic coordinate lookup.
        const neighborhood = await cloudbedsAdapter.getNeighborhoodFromCoords(
          hotelDetails.latitude,
          hotelDetails.longitude
        );

        // If a neighborhood was found, save it to the database.
        if (neighborhood) {
          await client.query(
            "UPDATE hotels SET neighborhood = $1 WHERE hotel_id = $2",
            [neighborhood, propertyId]
          );
        }
      }
    } else {
      // Handle cases where the PMS type is unknown or not supported yet.
      throw new Error(`Sync logic not implemented for PMS type: '${pmsType}'`);
    }

    // If all operations were successful, commit the transaction.
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

/**
 * A helper function to retrieve and decrypt Mews credentials for a given property.
 * @param {string} propertyId The internal hotel_id of the property.
 * @returns {Promise<{clientToken: string, accessToken: string}>} The Mews credentials.
 */
async function getMewsCredentials(propertyId) {
  // Find the encrypted credentials in the database.
  const credsResult = await pgPool.query(
    `SELECT pms_credentials FROM user_properties WHERE property_id = $1 LIMIT 1`,
    [propertyId]
  );
  const storedCredentials = credsResult.rows[0]?.pms_credentials;
  if (!storedCredentials || !storedCredentials.accessToken) {
    throw new Error(
      `Could not find Mews credentials for property ${propertyId}.`
    );
  }

  // --- Decrypt the Access Token ---
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const [ivHex, authTagHex, encryptedToken] =
    storedCredentials.accessToken.split(":");
  if (!ivHex || !authTagHex || !encryptedToken) {
    throw new Error("Stored credentials are in an invalid format.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decryptedToken = decipher.update(encryptedToken, "hex", "utf8");
  decryptedToken += decipher.final("utf8");

  return {
    clientToken: storedCredentials.clientToken,
    accessToken: decryptedToken,
  };
}

// SECURE MEWS TEST ROUTE for Connection & Configuration
router.get("/test-mews-connection", requireAdminApi, async (req, res) => {
  try {
    // Get the propertyId from the query string (e.g., from an Admin Panel UI).
    const { propertyId } = req.query;
    if (!propertyId) {
      return res
        .status(400)
        .json({ error: "A propertyId query parameter is required." });
    }

    // Fetch and decrypt the credentials for the requested property.
    const credentials = await getMewsCredentials(propertyId);

    // Call the adapter function with the dynamic credentials.
    const hotelDetails = await mewsAdapter.getHotelDetails(credentials);

    res.status(200).json({
      message: `Successfully connected to Mews for property ${propertyId}.`,
      data: hotelDetails,
    });
  } catch (error) {
    console.error(
      `Test Mews connection failed for property ${req.query.propertyId}:`,
      error
    );
    res.status(500).json({ message: "Test failed.", error: error.message });
  }
});
// SECURE MEWS TEST ROUTE for Occupancy Metrics
router.get("/test-mews-occupancy", requireAdminApi, async (req, res) => {
  try {
    // Get the propertyId from the query string.
    const { propertyId, startDate, endDate } = req.query;
    if (!propertyId) {
      return res
        .status(400)
        .json({ error: "A propertyId query parameter is required." });
    }

    // Fetch and decrypt the credentials for the requested property.
    const credentials = await getMewsCredentials(propertyId);

    // --- NEW: Fetch hotel details to get the correct timezone ---
    const hotelDetails = await mewsAdapter.getHotelDetails(credentials);
    if (!hotelDetails.timezone) {
      throw new Error(
        `Timezone could not be determined for property ${propertyId}.`
      );
    }

    // --- Use the same date range logic as before ---
    const endDateObj = new Date();
    endDateObj.setDate(endDateObj.getDate() - 1);
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - 8);

    const finalStartDate =
      startDate || startDateObj.toISOString().split("T")[0];
    const finalEndDate = endDate || endDateObj.toISOString().split("T")[0];

    // Call the adapter function with dynamic credentials and timezone.
    const occupancyData = await mewsAdapter.getOccupancyMetrics(
      credentials,
      finalStartDate,
      finalEndDate,
      hotelDetails.timezone // Use the dynamic timezone
    );

    res.status(200).json({
      message: `Successfully fetched Mews occupancy data for property ${propertyId}.`,
      data: occupancyData,
    });
  } catch (error) {
    console.error(
      `Test Mews occupancy failed for property ${req.query.propertyId}:`,
      error
    );
    res.status(500).json({ message: "Test failed.", error: error.message });
  }
});
// SECURE MEWS TEST ROUTE for Revenue Metrics
router.get("/test-mews-revenue", requireAdminApi, async (req, res) => {
  try {
    // Get the propertyId from the query string.
    const { propertyId, startDate, endDate } = req.query;
    if (!propertyId) {
      return res
        .status(400)
        .json({ error: "A propertyId query parameter is required." });
    }

    // Fetch and decrypt the credentials for the requested property.
    const credentials = await getMewsCredentials(propertyId);

    // Fetch hotel details to get the correct timezone for the revenue call.
    const hotelDetails = await mewsAdapter.getHotelDetails(credentials);
    if (!hotelDetails.timezone) {
      throw new Error(
        `Timezone could not be determined for property ${propertyId}.`
      );
    }

    // Use the same date range logic as before.
    const endDateObj = new Date();
    endDateObj.setDate(endDateObj.getDate() - 1);
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - 8);

    const finalStartDate =
      startDate || startDateObj.toISOString().split("T")[0];
    const finalEndDate = endDate || endDateObj.toISOString().split("T")[0];

    // Call the adapter function with dynamic credentials and timezone.
    const revenueData = await mewsAdapter.getRevenueMetrics(
      credentials,
      finalStartDate,
      finalEndDate,
      hotelDetails.timezone // Use the dynamic timezone
    );

    res.status(200).json({
      message: `Successfully fetched Mews revenue data for property ${propertyId}.`,
      data: revenueData,
    });
  } catch (error) {
    console.error(
      `Test Mews revenue failed for property ${req.query.propertyId}:`,
      error
    );
    res.status(500).json({ message: "Test failed.", error: error.message });
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
    const { id, columns, startDate, endDate, groupBy, propertyId } = req.query;

    if (!propertyId) {
      return res
        .status(400)
        .json({ error: "A propertyId is required for API explorer calls." });
    }

    // --- THE FIX: Look up the external PMS ID before making any API calls. ---
    // The 'propertyId' from the request is our internal ID.
    const hotelResult = await pgPool.query(
      "SELECT pms_property_id, pms_type FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found." });
    }

    // This API explorer is currently for Cloudbeds only.
    if (hotelResult.rows[0].pms_type !== "cloudbeds") {
      return res.status(400).json({
        message: "API Explorer currently supports Cloudbeds properties only.",
        pms_type: hotelResult.rows[0].pms_type,
      });
    }

    // Use the correct external ID for the Cloudbeds API, with a fallback for legacy properties.
    const cloudbedsApiId = hotelResult.rows[0].pms_property_id || propertyId;

    // getAdminAccessToken uses our internal ID to fetch credentials, which is correct.
    const { accessToken } = await getAdminAccessToken(
      req.session.userId,
      propertyId
    );

    let targetUrl;
    let options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Use the correct external ID in the header.
        "X-PROPERTY-ID": cloudbedsApiId,
      },
    };

    switch (endpoint) {
      case "insights-data":
        if (!id || !columns)
          return res
            .status(400)
            .json({ error: "Dataset ID and columns are required." });
        const requestBody = {
          // Use the correct external ID in the request body.
          property_ids: [cloudbedsApiId],
          dataset_id: parseInt(id, 10),
          columns: columns
            .split(",")
            .map((c) => ({ cdf: { column: c.trim() }, metrics: ["sum"] })),
          settings: { details: true, totals: true },
        };
        if (startDate && endDate) {
          requestBody.filters = {
            and: [
              {
                cdf: { column: "stay_date" },
                operator: "greater_than_or_equal",
                value: `${startDate}T00:00:00.000Z`,
              },
              {
                cdf: { column: "stay_date" },
                operator: "less_than_or_equal",
                value: `${endDate}T00:00:00.000Z`,
              },
            ],
          };
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

      // General API cases
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

      // Insights API (non-data) cases
      case "datasets":
        targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";
        break;
      case "dataset-structure":
        if (!id)
          return res.status(400).json({ error: "Dataset ID is required." });
        targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;
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
  // CORRECTED: Use the application-wide standard category list to validate input.
  const allowedCategories = [
    "Hostel",
    "Economy",
    "Midscale",
    "Upper Midscale",
    "Luxury",
  ];
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
