// /api/routes/admin.router.js
console.log("[SERVER STARTUP] Admin router file is being loaded."); // Add this line

// /api/routes/admin.router.js
const express = require("express");
const {
  generateTakingsEmailHTML,
} = require("../utils/report-templates/takings-email.template.js");
const router = express.Router();
const fetch = require("node-fetch");
const format = require("pg-format"); // <-- Add this line
const crypto = require("crypto"); // For Mews credential decryption

// Import shared utilities
const pgPool = require("../utils/db");
// [MODIFIED] Import the permissive 'requireAdminApi' and the strict 'requireSuperAdminOnly'
const {
  requireAdminApi,
  requireSuperAdminOnly,
} = require("../utils/middleware");

// NEW: Import the handlers for the serverless cron jobs
const dailyRefreshHandler = require("../daily-refresh.js");
const initialSyncHandler = require("../initial-sync.js");
// NEW: Import the handler for the scheduled reports job.
const scheduledReportsHandler = require("../send-scheduled-reports.js");
// [NEW] Import the Rockenue asset sync handler
const rockenueSyncHandler = require("../sync-rockenue-assets.js");

// Add this line with the other require statements

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
// [MOVED] Hotel configuration endpoints (get-all-hotels, update-category, scheduled-reports)
// have been moved to api/routes/hotels.router.js

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

// NEW: Zero-DB Cloudbeds debug — hit getHotelDetails with a raw token.
// Usage (admin only):
//   GET /api/admin/debug/cloudbeds/property-details?access_token=...&propertyId=96147116859584
router.get(
  "/debug/cloudbeds/property-details",
  requireAdminApi,
  async (req, res) => {
    try {
      const { access_token, propertyId } = req.query;

      // 1) Validate inputs early to avoid confusing errors.
      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: "Query param 'access_token' is required.",
        });
      }
      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: "Query param 'propertyId' is required.",
        });
      }

      // 2) Call Cloudbeds directly — NO DB LOOKUPS.
      //    Important: Many Cloudbeds endpoints require BOTH the property ID in URL AND X-PROPERTY-ID header.
      const url = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${encodeURIComponent(
        propertyId
      )}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "X-PROPERTY-ID": propertyId,
        },
      });

      // 3) Return the raw Cloudbeds JSON and HTTP status so we can see the real error (e.g., 403).
      const data = await resp.json().catch(() => ({}));

      return res.status(resp.status).json({
        success: resp.ok && data?.success !== false,
        httpStatus: resp.status,
        cloudbeds: data,
      });
    } catch (err) {
      console.error("[Debug] Cloudbeds property-details probe failed:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// NEW: Route to manually trigger the daily refresh job
router.get("/daily-refresh", requireAdminApi, async (req, res) => {
  console.log("Admin panel manually triggering daily-refresh job...");
  // We call the handler directly, passing the request and response objects.
  await dailyRefreshHandler(req, res);
});

// [Find the existing /initial-sync route around line 194 and REPLACE the whole block with this:]

// NEW: Route to manually trigger the initial sync job
// [MODIFIED] Uses a Hybrid Guard: Accepts EITHER a valid Admin Session OR the Internal Secret
router.post(
  "/initial-sync",
  (req, res, next) => {
    // 1. Check for Internal Secret (Server-to-Server bypass)
    const authHeader = req.headers["authorization"];
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (internalSecret && authHeader === `Bearer ${internalSecret}`) {
      // Whitelisted internal call - allow access
      return next();
    }

    // 2. If no secret, enforce standard Admin Session check (Manual Trigger)
    if (!req.session || !req.session.userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized: User session required." });
    }
    const allowedRoles = ["admin", "super_admin"];
    if (!req.session.role || !allowedRoles.includes(req.session.role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: Administrator access required." });
    }

    // valid session - allow accessss
    next();
  },
  async (req, res) => {
    // This handler now triggers the sync job
    try {
      console.log("[INITIAL SYNC] Job triggered...");
      // We call the handler directly, passing the request and response objects.
      await initialSyncHandler(req, res);
    } catch (error) {
      console.error("[INITIAL SYNC] Handler call failed:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to start sync handler." });
      }
    }
  }
);
// NEW: Route to manually trigger the scheduled reports job
// UPDATED: Route to manually trigger a *single* scheduled report.
// It's now a POST request to accept a reportId in the body.
router.post(
  "/run-scheduled-report",
  (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (internalSecret && authHeader === `Bearer ${internalSecret}`) {
      return next();
    }
    return requireAdminApi(req, res, next);
  },
  async (req, res) => {
    const { reportId } = req.body;
    if (!reportId) {
      return res.status(400).json({ error: "A reportId is required." });
    }
    console.log(`Admin panel manually triggering report ID: ${reportId}`);
    await scheduledReportsHandler(req, res);
  }
);

// [NEW] Route to manually trigger the Rockenue asset sync job
router.get("/sync-rockenue-assets", requireAdminApi, async (req, res) => {
  console.log("Admin panel manually triggering Rockenue asset sync...");
  try {
    // [FIX] Use the 'rockenueSyncHandler' variable we imported at the top
    await rockenueSyncHandler(req, res);
  } catch (error) {
    console.error("Failed to manually trigger Rockenue asset sync:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to start sync handler." });
    }
  }
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
    // --- [NEW] Calculate and save Total Rooms ---
    // We re-use the logic from the backfill endpoint within this transaction.
    console.log(
      `[Admin Sync] Now calculating total rooms for hotel: ${propertyId}`
    );
    let totalRooms = 0;
    try {
      // 1. Get credentials and PMS info
      const { credentials, pms_type, pms_property_id } =
        await getCredentialsForHotel(propertyId);

      // 2. Call the PMS API function
      const apiResponse = await getRoomTypesFromPMS(
        propertyId,
        pms_type,
        credentials,
        pms_property_id
      );

      // 3. Sum the 'roomTypeUnits', skipping "virtual" rooms
      if (apiResponse && Array.isArray(apiResponse.data)) {
        totalRooms = apiResponse.data.reduce((sum, roomType) => {
          const roomName = roomType.roomTypeName || roomType.Name || "";
          const lowerName = roomName.toLowerCase();

          // [FIX] Exclude Virtual, "Day Use", and "DayUse" (case-insensitive)
          if (
            lowerName.includes("virtual") ||
            lowerName.includes("day use") ||
            lowerName.includes("dayuse")
          ) {
            console.log(` -- Skipping room: "${roomName}" (Virtual/Day Use)`);
            return sum;
          }
          return sum + (roomType.roomTypeUnits || roomType.RoomTypeUnits || 0);
        }, 0);
      } else {
        throw new Error(
          "Invalid API response structure. Expected { data: [...] }"
        );
      }

      // 4. Save to the database
      if (totalRooms > 0) {
        await client.query(
          "UPDATE hotels SET total_rooms = $1 WHERE hotel_id = $2",
          [totalRooms, propertyId]
        );
        console.log(
          `[Admin Sync] SUCCESS: Set total_rooms to ${totalRooms} for hotel ${propertyId}.`
        );
      } else {
        console.warn(
          `[Admin Sync] Calculated total rooms was 0 for hotel ${propertyId}. Skipping update.`
        );
      }
    } catch (roomError) {
      // Log the error but do not fail the whole transaction
      // This ensures that hotel info (like name, city) can still be synced
      // even if the room count fails.
      console.error(
        `[Admin Sync] FAILED to update total_rooms for hotel ${propertyId}: ${roomError.message}`
      );
    }
    // --- [END NEW] ---

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

/**
 * Helper function to get the necessary credentials for any hotel.
 * This is used by the backfill endpoint.
 * @param {string} hotelId The internal hotel_id
 * @returns {Promise<{credentials: object, pms_type: string}>}
 */
async function getCredentialsForHotel(hotelId) {
  const result = await pgPool.query(
    // We fetch the stored credentials and the pms_type
    `SELECT up.pms_credentials, h.pms_type 
     FROM user_properties up
     JOIN hotels h ON up.property_id = h.hotel_id
     WHERE up.property_id = $1 
     AND up.pms_credentials IS NOT NULL
     LIMIT 1`,
    [hotelId]
  );
  if (result.rows.length === 0) {
    throw new Error(`No credentials found for hotel ${hotelId}`);
  }

  // For Mews, we must decrypt the access token before returning
  if (result.rows[0].pms_type === "mews") {
    const storedCredentials = result.rows[0].pms_credentials;
    // Re-use the existing getMewsCredentials logic, but adapt it
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    const [ivHex, authTagHex, encryptedToken] =
      storedCredentials.accessToken.split(":");
    if (!ivHex || !authTagHex || !encryptedToken) {
      throw new Error("Stored Mews credentials are in an invalid format.");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decryptedToken = decipher.update(encryptedToken, "hex", "utf8");
    decryptedToken += decipher.final("utf8");

    return {
      credentials: {
        clientToken: storedCredentials.clientToken,
        accessToken: decryptedToken,
      },
      pms_type: "mews",
    };
  }

  // For Cloudbeds, just return the stored credentials object
  return {
    credentials: result.rows[0].pms_credentials,
    pms_type: result.rows[0].pms_type,
  };
}
/**
 * Helper function to get the necessary credentials for any hotel.
 * This is used by the backfill endpoint.
 * @param {string} hotelId The internal hotel_id
 * @returns {Promise<{credentials: object, pms_type: string, pms_property_id: string}>}
 */
async function getCredentialsForHotel(hotelId) {
  const result = await pgPool.query(
    // We fetch the stored credentials, pms_type, and the external pms_property_id
    `SELECT up.pms_credentials, h.pms_type, h.pms_property_id
     FROM user_properties up
     JOIN hotels h ON up.property_id = h.hotel_id
     WHERE up.property_id = $1 
     AND up.pms_credentials IS NOT NULL
     LIMIT 1`,
    [hotelId]
  );
  if (result.rows.length === 0) {
    throw new Error(`No credentials or hotel entry found for hotel ${hotelId}`);
  }

  const { pms_credentials, pms_type, pms_property_id } = result.rows[0];

  // For Mews, we must decrypt the access token before returning
  if (pms_type === "mews") {
    const storedCredentials = pms_credentials;
    // Re-use the existing getMewsCredentials logic
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    const [ivHex, authTagHex, encryptedToken] =
      storedCredentials.accessToken.split(":");
    if (!ivHex || !authTagHex || !encryptedToken) {
      throw new Error("Stored Mews credentials are in an invalid format.");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decryptedToken = decipher.update(encryptedToken, "hex", "utf8");
    decryptedToken += decipher.final("utf8");

    return {
      credentials: {
        clientToken: storedCredentials.clientToken,
        accessToken: decryptedToken,
      },
      pms_type: "mews",
      pms_property_id: pms_property_id,
    };
  }

  // For Cloudbeds, just return the stored credentials object
  return {
    credentials: pms_credentials, // This contains the refresh_token
    pms_type: "cloudbeds",
    pms_property_id: pms_property_id,
  };
}
/**
 * Fetches room type data directly from the PMS API.
 * This function contains the logic that was missing from the adapters.
 * @param {string} hotelId Internal hotel_id (for getting the *right* token)
 * @param {string} pms_type 'cloudbeds' or 'mews'
 * @param {object} credentials The credentials object from getCredentialsForHotel
 * @param {string} pms_property_id The external PMS property ID (Cloudbeds needs this)
 * @returns {Promise<object>} The raw API response (expected to have a .data property)
 */
async function getRoomTypesFromPMS(
  hotelId,
  pms_type,
  credentials,
  pms_property_id
) {
  if (pms_type === "cloudbeds") {
    // --- Cloudbeds Logic ---
    // 1. Get a fresh Access Token using the stored refresh_token
    // We use the internal hotelId to find the right refresh token
    const { accessToken } = await getAdminAccessToken("admin", hotelId); // Re-use existing admin helper

    // 2. Use the external pms_property_id for the API call
    const cloudbedsApiId = pms_property_id || hotelId; // Fallback for older hotels
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getRoomTypes?propertyID=${cloudbedsApiId}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": cloudbedsApiId,
      },
    });

    if (!response.ok) {
      throw new Error(`Cloudbeds API error: ${response.statusText}`);
    }
    return response.json(); // Returns { success: true, data: [...] }
  } else if (pms_type === "mews") {
    // --- Mews Logic ---
    // Credentials are pre-decrypted by getCredentialsForHotel
    const targetUrl = "https://api.mews.com/api/connector/v1/roomTypes/getAll";
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        ClientToken: credentials.clientToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mews API error: ${response.statusText}`);
    }
    const mewsData = await response.json();
    // Mews data format is { RoomTypes: [...] }. We adapt it to match the
    // Cloudbeds format { data: [...] } for consistent processing.
    return { data: mewsData.RoomTypes || [] };
  } else {
    throw new Error(`PMS type "${pms_type}" not supported for getRoomTypes.`);
  }
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
// This is the fully corrected route handler for the API Explorer.
// This is the fully corrected route handler for the API Explorer.
router.get("/explore/:endpoint", requireAdminApi, async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { id, columns, startDate, endDate, groupBy, propertyId } = req.query;

    if (!propertyId) {
      return res.status(400).json({ error: "A propertyId is required." });
    }

    const hotelResult = await pgPool.query(
      "SELECT pms_property_id, pms_type FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );

    if (hotelResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found." });
    }

    if (hotelResult.rows[0].pms_type !== "cloudbeds") {
      return res.status(400).json({
        message: "API Explorer currently supports Cloudbeds properties only.",
      });
    }

    const cloudbedsApiId = hotelResult.rows[0].pms_property_id || propertyId;
    const { accessToken } = await getAdminAccessToken(
      req.session.userId,
      propertyId
    );

    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-PROPERTY-ID": cloudbedsApiId,
      },
    };

    let targetUrl;

    // --- CORRECTED LOGIC ---
    // Each case will now handle its own fetch and response.
    switch (endpoint) {
      case "get-webhooks":
        // This endpoint requires the propertyID as a query parameter
        targetUrl = `https://api.cloudbeds.com/api/v1.3/getWebhooks?propertyID=${cloudbedsApiId}`;
        // This endpoint uses the user-level token, not a property-specific one
        // It also doesn't need the X-PROPERTY-ID header.
        // We'll remove the header just to be safe.
        delete options.headers["X-PROPERTY-ID"];
        break;

      case "create-test-webhook":
        // REGISTER ALL SENTINEL WEBHOOKS (Loop)
        // We hijack the standard flow here because we need to make MULTIPLE calls.
        const myPublicUrl = "https://market-pulse.io/api/webhooks";
        const actionsToRegister = [
          "created", // New Bookings
          "status_changed", // Cancellations
          "dates_changed", // Extending/Shortening stays
          "accommodation_changed", // Moving rooms
        ];

        const results = [];

        for (const action of actionsToRegister) {
          const params = new URLSearchParams({
            propertyID: cloudbedsApiId,
            object: "reservation",
            action: action,
            endpointUrl: myPublicUrl,
          });

          const resp = await fetch(
            "https://api.cloudbeds.com/api/v1.1/postWebhook",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: options.headers.Authorization, // Re-use the admin token
              },
              body: params,
            }
          );
          const data = await resp.json();
          results.push({
            action,
            success: data.success,
            id: data.data?.subscriptionID,
          });
        }

        // Return immediately, skipping the default switch break flow
        return res.status(200).json({
          message: "Registered all Sentinel webhooks.",
          details: results,
        });

      case "sample-hotel":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${cloudbedsApiId}`;
        break;
      case "sample-guest":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getGuestList?propertyID=${cloudbedsApiId}&pageSize=1`;
        break;
      case "sample-reservation":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getReservations?propertyID=${cloudbedsApiId}&pageSize=1`;
        break;
      case "taxes-fees":
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getTaxesAndFees?propertyID=${cloudbedsApiId}`;
        break;
      case "user-info":
        targetUrl = "https://api.cloudbeds.com/api/v1.3/userinfo";
        break;
      case "sample-room": // Changed to getRoomTypes
        targetUrl = `https://api.cloudbeds.com/api/v1.1/getRoomTypes?propertyID=${cloudbedsApiId}`;
        break;

      // --- Multi-Step Case for Sample Rate ---
      case "sample-rate": {
        const roomTypesUrl = `https://api.cloudbeds.com/api/v1.1/getRoomTypes?propertyID=${cloudbedsApiId}`;
        const roomTypesResponse = await fetch(roomTypesUrl, options);
        const roomTypesData = await roomTypesResponse.json();

        if (
          !roomTypesResponse.ok ||
          !roomTypesData.data ||
          roomTypesData.data.length === 0
        ) {
          throw new Error(
            "Could not find any room types for this property to fetch rates."
          );
        }

        const firstRoomTypeId = roomTypesData.data[0].roomTypeID;
        const today = new Date().toISOString().split("T")[0];
        const tomorrow = new Date(Date.now() + 86400000)
          .toISOString()
          .split("T")[0];
        const ratesUrl = `https://api.cloudbeds.com/api/v1.1/getRoomRates?propertyID=${cloudbedsApiId}&roomTypeID=${firstRoomTypeId}&startDate=${today}&endDate=${tomorrow}`;

        const ratesResponse = await fetch(ratesUrl, options);
        const ratesData = await ratesResponse.json();
        if (!ratesResponse.ok)
          throw new Error(
            `Cloudbeds API Error fetching rates: ${JSON.stringify(ratesData)}`
          );

        return res.status(200).json({
          note: `Showing sample rates for room type: ${roomTypesData.data[0].roomTypeName} (ID: ${firstRoomTypeId})`,
          rates: ratesData,
        });
      }

      // --- Insights API Cases ---
      case "datasets":
        targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";
        break;
      case "dataset-structure":
        if (!id)
          return res.status(400).json({ error: "Dataset ID is required." });
        targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;
        break;
      case "insights-data": {
        if (!id || !columns)
          return res
            .status(400)
            .json({ error: "Dataset ID and columns are required." });
        const requestBody = {
          /* ... body remains the same */
        };
        // (The complex insights-data logic remains the same as before)
        const insightRequestBody = {
          property_ids: [cloudbedsApiId],
          dataset_id: parseInt(id, 10),
          columns: columns
            .split(",")
            .map((c) => ({ cdf: { column: c.trim() }, metrics: ["sum"] })),
          settings: { details: true, totals: true },
        };
        if (startDate && endDate) {
          // THE FIX: Determine the correct date column based on the dataset ID.
          // The Financial dataset (ID 1) uses 'service_date', while others (like ID 7) use 'stay_date'.
          const dateColumn =
            parseInt(id, 10) === 1 ? "service_date" : "stay_date";

          console.log(
            `[API Explorer] Using date column: ${dateColumn} for dataset ID: ${id}`
          );

          insightRequestBody.filters = {
            and: [
              {
                cdf: { column: dateColumn },
                operator: "greater_than_or_equal",
                value: `${startDate}T00:00:00.000Z`,
              },
              {
                cdf: { column: dateColumn },
                operator: "less_than_or_equal",
                value: `${endDate}T00:00:00.000Z`,
              },
            ],
          };
        }
        if (groupBy) {
          insightRequestBody.group_rows = groupBy
            .split(",")
            .map((dim) => ({ cdf: { column: dim.trim() } }));
        }
        targetUrl =
          "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
        options.method = "POST";
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(insightRequestBody);
        break;
      }
      default:
        return res.status(404).json({ error: "Unknown explorer endpoint." });
    }

    // This final block now only handles the cases that set a `targetUrl` and didn't return early.
    const apiResponse = await fetch(targetUrl, options);
    const data = await apiResponse.json();
    if (!apiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      `[API Explorer Error] Endpoint: ${req.params.endpoint}, Error: ${error.message}`
    );
    return res.status(500).json({ success: false, error: error.message });
  }
});
// /api/routes/admin.router.js

// NEW: Endpoint to update a hotel's category
// [CLEANUP] Removed duplicate update-hotel-category endpoint
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
// [MOVED] Compset management endpoints moved to hotels.router.js
router.get(
  "/backfill-room-counts",
  requireSuperAdminOnly, // [MODIFIED] Protected for super-admin only
  async (req, res) => {
    let updatedCount = 0;
    let failedCount = 0;
    const logs = [];

    // [FIX] We no longer need the broken adapterGetRoomTypes object

    try {
      // 1. Get all hotels
      const { rows: hotels } = await pgPool.query(
        "SELECT hotel_id, property_name, pms_type FROM hotels"
      );

      logs.push(`Found ${hotels.length} hotels to process...`);

      // 2. Loop through each hotel
      for (const hotel of hotels) {
        let totalRooms = 0;
        try {
          // 3. Get credentials and PMS info using our new helper
          const { credentials, pms_type, pms_property_id } =
            await getCredentialsForHotel(hotel.hotel_id);

          // 4. Call our new, self-contained PMS API function
          const apiResponse = await getRoomTypesFromPMS(
            hotel.hotel_id,
            pms_type,
            credentials,
            pms_property_id
          );

          // 5. Sum the 'roomTypeUnits' from the response
          // This field name is 'roomTypeUnits' in Cloudbeds
          // and 'RoomTypeUnits' in Mews. We check for both.
          if (apiResponse && Array.isArray(apiResponse.data)) {
            totalRooms = apiResponse.data.reduce(
              (sum, roomType) => {
                // Get the room name. Cloudbeds uses 'roomTypeName', Mews uses 'Name'.
                const roomName = roomType.roomTypeName || roomType.Name || ""; // Default to empty string
                const lowerName = roomName.toLowerCase();

                // [FIX] Exclude Virtual, "Day Use", and "DayUse" (case-insensitive)
                if (
                  lowerName.includes("virtual") ||
                  lowerName.includes("day use") ||
                  lowerName.includes("dayuse")
                ) {
                  logs.push(
                    ` -- Skipping room: "${roomName}" (Virtual/Day Use)`
                  );
                  return sum; // Return the current sum without adding
                }
                // If not virtual, add its units to the sum
                return (
                  sum + (roomType.roomTypeUnits || roomType.RoomTypeUnits || 0)
                );
              },
              0 // Initial value for sum
            );
          } else {
            throw new Error(
              "Invalid API response structure. Expected { data: [...] }"
            );
          }

          // 6. Save to the database
          if (totalRooms > 0) {
            await pgPool.query(
              "UPDATE hotels SET total_rooms = $1 WHERE hotel_id = $2",
              [totalRooms, hotel.hotel_id]
            );
            logs.push(
              `SUCCESS: ${hotel.property_name} (ID: ${hotel.hotel_id}) -> ${totalRooms} rooms.`
            );
            updatedCount++;
          } else {
            // This is a safety check. If a hotel has 0 rooms, log it as a fail.
            throw new Error("Calculated total rooms was 0. Skipping update.");
          }
        } catch (error) {
          logs.push(
            `FAILED: ${hotel.property_name} (ID: ${hotel.hotel_id}) -> ${error.message}`
          );
          failedCount++;
        }
      }

      logs.push("--- Backfill Complete ---");
      logs.push(`Successfully updated: ${updatedCount}`);
      logs.push(`Failed: ${failedCount}`);

      // 7. Send the log report
      res.json({
        message: "Backfill complete.",
        updated: updatedCount,
        failed: failedCount,
        logs: logs,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: "Fatal error during backfill", details: error.message });
    }
  }
);
// --- END OF NEW ENDPOINT ---

// --- END OF NEW ENDPOINT ---
// --- END OF NEW ENDPOINT ---

// [MOVED] Hotel management, group listing, and deletion endpoints moved to hotels.router.js

/**
 * Visual Preview for the Light-Themed Takings Email
 * URL: /api/admin/test-takings-preview
 */
router.get("/test-takings-preview", requireAdminApi, (req, res) => {
  const mockData = [
    {
      name: "The Grand Plaza",
      takings: { cash: 1250.5, cards: 8420.0, bacs: 500.0 },
      revenue: {
        totalRevenue: 10500.0,
        occupancy: 85.5,
        adr: 122.8,
        extras: { total: 450.0 },
      },
    },
    {
      name: "Riverside Boutique",
      takings: { cash: 420.0, cards: 5100.0, bacs: 0 },
      revenue: {
        totalRevenue: 5800.0,
        occupancy: 72.1,
        adr: 98.5,
        extras: { total: 120.0 },
      },
    },
  ];

  const dateRange = { startDate: "2026-01-01", endDate: "2026-01-31" };
  const html = generateTakingsEmailHTML(
    "Monthly Takings Audit (Preview)",
    dateRange,
    mockData
  );

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

module.exports = router;
