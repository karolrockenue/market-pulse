// /api/routes/rockenue.router.js
// This new router will handle all API endpoints for the internal Rockenue section.

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

// Import the database connection pool from the shared utils directory.
const pool = require("../utils/db");

// Import the PMS adapters. This is crucial for communicating with Cloudbeds, Mews, etc.
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");
const mewsAdapter = require("../adapters/mewsAdapter");

/**
 * Middleware to protect routes, ensuring they are only accessible by super_admin users.
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.session && req.session.role === "super_admin") {
    return next();
  } else {
    res.status(403).json({
      error: "Forbidden: Access is restricted to super administrators.",
    });
  }
};

router.use(requireSuperAdmin);

/**
 * A helper function to get a valid Cloudbeds access token for a given property.
 */
async function getCloudbedsAccessToken(propertyId) {
  if (!propertyId) {
    throw new Error(
      "A propertyId is required to get a Cloudbeds access token."
    );
  }
  const credsResult = await pool.query(
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
    {
      method: "POST",
      body: params,
    }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error(
      `Cloudbeds token refresh failed for property ${propertyId}.`
    );
  }
  return tokenData.access_token;
}

router.get("/hotels", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT hotel_id, property_name FROM hotels ORDER BY property_name ASC"
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching hotels for Rockenue report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * FINAL REFACTOR: Generates the Shreeji Report data with corrected filtering and mapping.
 */
/**
 * FINAL REVISION: Generates the Shreeji Report data with revised filtering and added columns.
 */
router.get("/shreeji-report", async (req, res) => {
  const { hotel_id, date } = req.query;
  if (!hotel_id || !date) {
    return res.status(400).json({ error: "hotel_id and date are required." });
  }

  try {
    const hotelInfoResult = await pool.query(
      "SELECT pms_type, pms_property_id FROM hotels WHERE hotel_id = $1",
      [hotel_id]
    );
    if (hotelInfoResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found." });
    }

    const { pms_type, pms_property_id } = hotelInfoResult.rows[0];
    const externalPropertyId = pms_property_id || hotel_id;

    let reportData = [];

    if (pms_type === "cloudbeds") {
      const accessToken = await getCloudbedsAccessToken(hotel_id);

      // --- STEP 1: Get an accurate list of reservation IDs ---
      // This filter finds all reservations that were active on the report date and excludes cancellations.
      const overlappingReservations = await cloudbedsAdapter.getReservations(
        accessToken,
        externalPropertyId,
        {
          checkInTo: date,
          checkOutFrom: date,
          excludeStatuses: "canceled", // REVISION: Use this more flexible filter.
        }
      );

      // Filter out any guests who checked out on the report date (as they weren't in-house overnight)
      // or those that are unassigned.
      const inHouseReservations = overlappingReservations.filter(
        (res) => res.checkOutDate !== date && res.roomID
      );

      if (inHouseReservations.length === 0) {
        return res.status(200).json([]);
      }

      const reservationIDs = inHouseReservations.map(
        (res) => res.reservationID
      );

      // --- STEP 2: Get the full details for only those specific reservations ---
      const detailedReservations =
        await cloudbedsAdapter.getReservationsWithDetails(
          accessToken,
          externalPropertyId,
          { reservationID: reservationIDs.join(",") }
        );

      // --- STEP 3: Map the detailed data with corrected field names and new columns ---
      reportData = detailedReservations.map((res) => ({
        roomName: res.rooms?.[0]?.roomName || "Unassigned",
        guestName: res.guestName || "N/A",
        balance: res.balance || 0,
        source: res.sourceName || "N/A",
        // REVISION: Add the new data columns.
        checkInDate: res.checkInDate,
        checkOutDate: res.checkOutDate,
        grandTotal: res.grandTotal || 0,
      }));
    } else {
      return res
        .status(501)
        .json({ error: "Report not implemented for Mews yet." });
    }

    reportData.sort((a, b) =>
      a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
    );

    res.status(200).json(reportData);
  } catch (error) {
    console.error(
      `Error generating Shreeji Report for hotel ${hotel_id}:`,
      error
    );
    res.status(500).json({
      error: "An internal server error occurred while generating the report.",
    });
  }
});

module.exports = router;
