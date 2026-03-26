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

    // Test: fetch hotel details
    const details = await mewsAdapter.getHotelDetails(credentials);

    // Test: find accommodation service
    const serviceId = await mewsAdapter.getAccommodationServiceId(credentials);

    // Test: fetch room types
    const roomTypes = await mewsAdapter.getResourceCategories(
      credentials,
      serviceId,
    );

    // Test: fetch rate plans
    const ratePlans = await mewsAdapter.getRatePlans(credentials, serviceId);

    res.status(200).json({
      success: true,
      message: "Credentials valid. Property details retrieved.",
      data: {
        propertyName: details.propertyName,
        city: details.city,
        timezone: details.timezone,
        currency: details.currencyCode,
        enterpriseId: details.id,
        serviceId,
        roomTypes: roomTypes.map((r) => ({
          id: r.roomTypeID,
          name: r.roomTypeName,
        })),
        ratePlans: ratePlans.map((r) => ({
          id: r.rateID,
          name: r.ratePlanName,
          isBase: !r.isDerived,
        })),
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
    const serviceId = await mewsAdapter.getAccommodationServiceId(credentials);
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

    // 4a. Insert hotel
    const totalRooms = roomTypes.reduce(
      (sum, rt) => sum + (rt.capacity || 0),
      0,
    );

    const hotelResult = await client.query(
      `INSERT INTO hotels (
        property_name, city, timezone, currency_code, total_rooms,
        latitude, longitude, address_1, zip_postal_code, country,
        pms_type, pms_property_id,
        pms_credentials
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        'mews', $11,
        $12
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

    await client.query("COMMIT");

    // ── Step 5: Return success ──
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
