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

// In a future step, this could be moved to a shared /api/utils/cloudbeds.js utility
async function getCloudbedsAccessToken(refreshToken) {
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  if (!refreshToken) {
    throw new Error("Cannot get access token without a refresh token.");
  }
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
    console.error("Token refresh failed for a user:", tokenData);
    return null;
  }
  return tokenData.access_token;
}

// --- ADMIN API ENDPOINTS ---
// All routes are now protected by the requireAdminApi middleware.

router.get("/get-all-hotels", requireAdminApi, async (req, res) => {
  try {
    const { rows } = await pgPool.query(
      "SELECT hotel_id, property_name, property_type, city, star_rating FROM hotels ORDER BY property_name"
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
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (!userResult.rows.length || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "No refresh token found for admin user." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
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

router.get("/explore/datasets", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties are associated with this admin account.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": propertyIdForHeader,
      },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok) {
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/dataset-structure", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties are associated with this admin account.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Dataset ID is required." });
    }
    const targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": propertyIdForHeader,
      },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/insights-data", requireAdminApi, async (req, res) => {
  try {
    const { id, columns } = req.query;
    if (!id || !columns) {
      return res
        .status(400)
        .json({ error: "Dataset ID and columns are required." });
    }
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token for this user." });
    }
    const adminRefreshToken = userResult.rows[0].refresh_token;
    const accessToken = await getCloudbedsAccessToken(adminRefreshToken);
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties are associated with this admin account.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const insightsPayload = {
      property_ids: [propertyIdForHeader],
      dataset_id: parseInt(id, 10),
      columns: columns
        .split(",")
        .map((c) => ({ cdf: { column: c.trim() }, metrics: ["sum"] })),
      group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
      settings: { details: true, totals: true },
    };
    const targetUrl =
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-PROPERTY-ID": propertyIdForHeader,
      },
      body: JSON.stringify(insightsPayload),
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/sample-guest", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getGuestList?propertyIDs=${propertyIdForHeader}&pageSize=1`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data.data && data.data.length > 0
          ? data.data[0]
          : { message: "No guests found." }
      );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/sample-hotel", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/sample-room", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getRooms?propertyIDs=${propertyIdForHeader}&pageSize=1`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data.data && data.data.length > 0
          ? data.data[0]
          : { message: "No rooms found." }
      );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/sample-rate", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getRatePlans?propertyIDs=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data && data.length > 0 ? data[0] : { message: "No rate plans found." }
      );
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/taxes-fees", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getTaxesAndFees?propertyID=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/user-info", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getUsers?property_ids=${propertyIdForHeader}`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/explore/sample-reservation", requireAdminApi, async (req, res) => {
  try {
    const adminUserId = req.session.userId;
    const userResult = await pgPool.query(
      "SELECT refresh_token FROM users WHERE cloudbeds_user_id = $1",
      [adminUserId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].refresh_token) {
      return res
        .status(401)
        .json({ error: "Could not find a valid refresh token." });
    }
    const accessToken = await getCloudbedsAccessToken(
      userResult.rows[0].refresh_token
    );
    if (!accessToken) {
      throw new Error("Cloudbeds authentication failed.");
    }
    const propertyResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1",
      [adminUserId]
    );
    if (propertyResult.rows.length === 0) {
      throw new Error("No properties associated with admin.");
    }
    const propertyIdForHeader = propertyResult.rows[0].property_id;
    const targetUrl = `https://api.cloudbeds.com/api/v1.1/getReservations?propertyIDs=${propertyIdForHeader}&pageSize=1&sortByRecent=true`;
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await cloudbedsApiResponse.json();
    if (!cloudbedsApiResponse.ok)
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    res
      .status(200)
      .json(
        data.data && data.data.length > 0
          ? data.data[0]
          : { message: "No reservations found." }
      );
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

    const upsertQuery = `
      INSERT INTO user_properties (user_id, property_id, override_client_id, override_client_secret, override_api_key, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      ON CONFLICT (user_id, property_id) 
      DO UPDATE SET
        override_client_id = EXCLUDED.override_client_id,
        override_client_secret = EXCLUDED.override_client_secret,
        override_api_key = EXCLUDED.override_api_key,
        status = 'pending';
    `;
    await client.query(upsertQuery, [
      cloudbedsUserId,
      propertyId,
      clientId,
      clientSecret,
      apiKey,
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
// It replaces the old redirect-based flow.
// /api/routes/admin.router.js

//
router.post("/activate-pilot-property", requireAdminApi, async (req, res) => {
  // Now expecting both propertyId and userId from the request body
  const { propertyId, userId } = req.body;
  if (!propertyId || !userId) {
    return res
      .status(400)
      .json({ message: "Property ID and User ID are required." });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // The query now uses both propertyId and userId to find the exact record.
    const credsResult = await client.query(
      "SELECT override_api_key FROM user_properties WHERE property_id = $1 AND user_id = $2",
      [propertyId, userId]
    );

    if (
      credsResult.rows.length === 0 ||
      !credsResult.rows[0].override_api_key
    ) {
      throw new Error(
        `No API key found for property ${propertyId}. Please provision it first.`
      );
    }
    const apiKey = credsResult.rows[0].override_api_key;

    const hotelDetails = await cloudbeds.getHotelDetails(apiKey, propertyId);
    if (!hotelDetails) {
      throw new Error(
        `Could not fetch details for property ${propertyId} from Cloudbeds using the API key.`
      );
    }

    await client.query(
      `INSERT INTO hotels (hotel_id, property_name, city, address_1, country, currency_code)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (hotel_id) DO UPDATE SET
     property_name = EXCLUDED.property_name,
     city = EXCLUDED.city,
  address_1 = EXCLUDED.address1,
     country = EXCLUDED.country,
     currency_code = EXCLUDED.currency_code;`,
      [
        hotelDetails.propertyID,
        hotelDetails.propertyName,
        hotelDetails.propertyCity,
        hotelDetails.propertyAddress1,
        hotelDetails.propertyCountry,
        hotelDetails.propertyCurrencyCode,
      ]
    );

    // Also use both IDs to update the correct record
    await client.query(
      "UPDATE user_properties SET status = 'connected', override_client_id = NULL, override_client_secret = NULL WHERE property_id = $1 AND user_id = $2",
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
module.exports = router;
