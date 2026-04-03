/**
 * @file mews.onboarding.router.js
 * @brief Admin-only routes for onboarding Mews properties.
 *
 * Mounted at: /api/mews
 *
 * Endpoints:
 *   POST /api/mews/onboard     - Connect a new Mews property
 *   POST /api/mews/test-creds  - Validate credentials without creating anything
 */

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { requireAdminApi } = require("../utils/middleware");
const mewsAdapter = require("../adapters/mewsAdapter");
const pgPool = require("../utils/db");

// All routes require admin
router.use(requireAdminApi);

/**
 * POST /api/mews/test-creds
 * Tests Mews credentials by calling configuration/get.
 * Does NOT create any database records.
 *
 * Body: { accessToken }
 * (ClientToken comes from env)
 */
router.post("/test-creds", async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res
      .status(400)
      .json({ success: false, message: "accessToken is required." });
  }

  if (!process.env.MEWS_CLIENT_TOKEN) {
    return res.status(500).json({
      success: false,
      message: "MEWS_CLIENT_TOKEN is not set in environment variables.",
    });
  }

  try {
    const credentials = {
      clientToken: process.env.MEWS_CLIENT_TOKEN,
      accessToken,
      client: "Rockenue MarketPulse 1.0.0",
    };

    // Fetch hotel details
    const details = await mewsAdapter.getHotelDetails(credentials);

    // Fetch ALL reservable services so admin can pick the right one
    const servicesResponse = await mewsAdapter._callMewsApi("services/getAll", credentials);
    const reservableServices = (servicesResponse.Services || [])
      .filter((s) => s.Type === "Reservable" && s.IsActive === true)
      .map((s) => ({ id: s.Id, name: s.Name, startTime: s.StartTime }));

    res.status(200).json({
      success: true,
      message: "Credentials valid. Property details retrieved.",
      data: {
        propertyName: details.propertyName,
        city: details.city,
        timezone: details.timezone,
        currency: details.currencyCode,
        enterpriseId: details.id,
        services: reservableServices,
      },
    });
  } catch (error) {
    console.error("[Mews Onboarding] test-creds failed:", error.message);
    res.status(400).json({
      success: false,
      message: `Credential test failed: ${error.message}`,
    });
  }
});

/**
 * POST /api/mews/onboard
 * Connects a Mews property to Market Pulse.
 *
 * Creates records in:
 *   - hotels (property details, pms_type='mews')
 *   - sentinel_configurations (room types, rate plans, rate_id_map)
 *
 * Body: { accessToken }
 * (ClientToken comes from env)
 *
 * Returns the created hotel record.
 */
router.post("/onboard", async (req, res) => {
  const { accessToken, serviceId: requestedServiceId } = req.body;

  if (!accessToken) {
    return res
      .status(400)
      .json({ success: false, message: "accessToken is required." });
  }

  if (!process.env.MEWS_CLIENT_TOKEN) {
    return res.status(500).json({
      success: false,
      message: "MEWS_CLIENT_TOKEN is not set in environment variables.",
    });
  }

  const client = await pgPool.connect();

  try {
    const credentials = {
      clientToken: process.env.MEWS_CLIENT_TOKEN,
      accessToken,
      client: "Rockenue MarketPulse 1.0.0",
    };

    // ── Step 1: Fetch all configuration data ──
    console.log("[Mews Onboarding] Fetching property configuration...");

    const details = await mewsAdapter.getHotelDetails(credentials);
    const serviceId = requestedServiceId || await mewsAdapter.getAccommodationServiceId(credentials);
    console.log(`[Mews Onboarding] Using serviceId: ${serviceId}${requestedServiceId ? ' (user-selected)' : ' (auto-detected)'}`);

    const roomTypes = await mewsAdapter.getResourceCategories(
      credentials,
      serviceId,
    );
    const ratePlans = await mewsAdapter.getRatePlans(credentials, serviceId);

    console.log(
      `[Mews Onboarding] Property: ${details.propertyName} | ` +
        `Rooms: ${roomTypes.length} types | Rates: ${ratePlans.length} plans`,
    );

    // ── Step 2: Check for duplicates ──
    const existingHotel = await client.query(
      "SELECT hotel_id FROM hotels WHERE pms_property_id = $1 AND pms_type = 'mews'",
      [details.id],
    );

    if (existingHotel.rows.length > 0) {
      client.release();
      return res.status(409).json({
        success: false,
        message: `This Mews property is already onboarded (hotel_id: ${existingHotel.rows[0].hotel_id}).`,
      });
    }

    // ── Step 3: Build rate_id_map ──
    const rateIdMap = mewsAdapter.buildMewsRateIdMap(ratePlans, roomTypes);

    // ── Step 4: Insert into database (transaction) ──
    await client.query("BEGIN");

    // 4a. Insert hotel — get actual room/space count from Mews resources
    let totalRooms;
    try {
      totalRooms = await mewsAdapter.getResourceCount(credentials, serviceId, details.timezone);
    } catch (e) {
      console.warn(`[Mews Onboarding] Could not fetch resource count: ${e.message}. Falling back to room type capacity sum.`);
      totalRooms = roomTypes.reduce((sum, rt) => sum + (rt.capacity || 0), 0);
    }

    const hotelResult = await client.query(
      `INSERT INTO hotels (
        property_name, city, timezone, currency_code, total_rooms,
        latitude, longitude, address_1, zip_postal_code, country,
        pms_type, pms_property_id,
        pms_credentials,
        is_rockenue_managed, pricing_model,
        neighborhood, tax_rate, tax_type, tax_name, go_live_date
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        'mews', $11,
        $12,
        true, 'inclusive',
        $13, $14, $15, $16, CURRENT_DATE
      ) RETURNING hotel_id`,
      [
        details.propertyName,
        details.city,
        details.timezone,
        details.currencyCode,
        totalRooms,
        details.latitude,
        details.longitude,
        details.address_1,
        details.zip_postal_code,
        details.country,
        details.id, // Enterprise UUID as pms_property_id
        JSON.stringify({
          accessToken,
          serviceId,
          timezone: details.timezone,
        }),
        details.neighborhood,
        details.taxRate,
        details.taxType,
        details.taxName,
      ],
    );

    const hotelId = hotelResult.rows[0].hotel_id;
    console.log(`[Mews Onboarding] Hotel created with ID: ${hotelId}`);

    // 4b. Insert sentinel_configurations
    // Map room types and rate plans to the same JSON shape Cloudbeds uses
    const pmsRoomTypesPayload = { data: roomTypes };
    const pmsRatePlansPayload = { data: ratePlans };

    // Pick a default base room type (first one, admin can change later)
    const defaultBaseRoomTypeId =
      roomTypes.length > 0 ? roomTypes[0].roomTypeID : null;

    await client.query(
      `INSERT INTO sentinel_configurations (
        hotel_id,
        pms_room_types,
        pms_rate_plans,
        rate_id_map,
        base_room_type_id,
        sentinel_enabled,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())`,
      [
        hotelId,
        JSON.stringify(pmsRoomTypesPayload),
        JSON.stringify(pmsRatePlansPayload),
        JSON.stringify(rateIdMap),
        defaultBaseRoomTypeId,
      ],
    );

    console.log(
      `[Mews Onboarding] Sentinel config created for hotel ${hotelId}`,
    );

    // 4c. Encrypt access token and insert user_properties (needed by initial-sync)
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encryptedToken = cipher.update(accessToken, "utf8", "hex");
    encryptedToken += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    const storedCredentials = {
      accessToken: `${iv.toString("hex")}:${authTag}:${encryptedToken}`,
      clientToken: process.env.MEWS_CLIENT_TOKEN,
      serviceId,
    };

    const userId = req.session.userId;
    await client.query(
      `INSERT INTO user_properties (user_id, property_id, pms_credentials, status)
       VALUES ($1, $2, $3, 'syncing')
       ON CONFLICT (user_id, property_id) DO UPDATE SET pms_credentials = $3, status = 'syncing'`,
      [userId, hotelId, JSON.stringify(storedCredentials)],
    );

    await client.query("COMMIT");

    // ── Step 5: Return success, then trigger initial-sync (fire-and-forget) ──
    res.status(201).json({
      success: true,
      message: `Mews property "${details.propertyName}" onboarded successfully.`,
      data: {
        hotelId,
        propertyName: details.propertyName,
        enterpriseId: details.id,
        city: details.city,
        timezone: details.timezone,
        currency: details.currencyCode,
        totalRooms,
        roomTypes: roomTypes.length,
        ratePlans: ratePlans.length,
        baseRoomTypeId: defaultBaseRoomTypeId,
        rateIdMap,
      },
    });

    // Fire-and-forget: trigger full initial sync (5 years history + 365 days forward)
    const syncUrl =
      process.env.VERCEL_ENV === "production"
        ? "https://www.market-pulse.io/api/admin/initial-sync"
        : "http://localhost:3000/api/admin/initial-sync";
    fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({ propertyId: hotelId }),
    }).catch((syncErr) =>
      console.error(`[Mews Onboarding] Failed to trigger initial sync for hotel ${hotelId}:`, syncErr)
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[Mews Onboarding] Failed:", error.message);
    res.status(500).json({
      success: false,
      message: `Onboarding failed: ${error.message}`,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
