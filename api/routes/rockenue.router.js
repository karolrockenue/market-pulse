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
 * This checks the user's role stored in their session.
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

// Apply the security middleware to ALL routes that will be defined in this file.
router.use(requireSuperAdmin);

/**
 * A helper function to get a valid Cloudbeds access token for a given property.
 * This is similar to the one in admin.router.js but is kept here for module independence.
 * @param {string} propertyId - The internal hotel ID.
 * @returns {Promise<string>} - A valid access token.
 */
async function getCloudbedsAccessToken(propertyId) {
  if (!propertyId) {
    throw new Error(
      "A propertyId is required to get a Cloudbeds access token."
    );
  }
  // Find the refresh token associated with the property.
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

  // Exchange the refresh token for a new access token.
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

/**
 * A placeholder endpoint to verify that the Rockenue router is working and secured.
 */
router.get("/status", (req, res) => {
  res.status(200).json({
    message: "Success: You have accessed a secure Rockenue endpoint.",
    userRole: req.session.role,
  });
});

/**
 * Fetches a list of all hotels in the system for dropdowns.
 */
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
 * NEW ENDPOINT: Generates the Shreeji Report data.
 * This is the core logic for fetching and combining the data.
 * Accessible at GET /api/rockenue/shreeji-report?hotel_id=...&date=...
 */
router.get("/shreeji-report", async (req, res) => {
  const { hotel_id, date } = req.query;

  // --- 1. Input Validation ---
  if (!hotel_id || !date) {
    return res
      .status(400)
      .json({ error: "hotel_id and date are required parameters." });
  }

  try {
    // --- 2. Determine PMS Type and Get External ID ---
    const hotelInfoResult = await pool.query(
      "SELECT pms_type, pms_property_id FROM hotels WHERE hotel_id = $1",
      [hotel_id]
    );

    if (hotelInfoResult.rows.length === 0) {
      return res.status(404).json({ error: "Hotel not found." });
    }
    const { pms_type, pms_property_id } = hotelInfoResult.rows[0];

    // The external ID is what we use to talk to the PMS API.
    const externalPropertyId = pms_property_id || hotel_id; // Fallback for older hotels

    let reportData = [];

    // --- 3. Branch Logic Based on PMS Type ---
    if (pms_type === "cloudbeds") {
      // Get a fresh access token for Cloudbeds.
      const accessToken = await getCloudbedsAccessToken(hotel_id);

      // Fetch both lists of data from Cloudbeds in parallel to save time.
      const [allRooms, inHouseReservations] = await Promise.all([
        cloudbedsAdapter.getRooms(accessToken, externalPropertyId),
        cloudbedsAdapter.getReservations(accessToken, externalPropertyId, {
          status: "in_house",
        }),
      ]);

      // Create a quick lookup map of reservations by their assigned room number.
      const reservationMap = new Map();
      inHouseReservations.forEach((res) => {
        if (res.roomID) {
          // A reservation might be in-house but not yet assigned a room.
          reservationMap.set(res.roomID.toString(), res);
        }
      });

      // --- 4. Merge the Data ---
      // Loop through the definitive list of all physical rooms.
      reportData = allRooms.map((room) => {
        const reservation = reservationMap.get(room.roomID.toString());

        // If a reservation exists for this room, populate the details.
        if (reservation) {
          return {
            roomName: room.roomName,
            guestName: `${reservation.guestFirstName} ${reservation.guestLastName}`,
            balance: reservation.balance,
            source: reservation.sourceName || "N/A", // Use source name if available
          };
        } else {
          // If no reservation, the room is vacant.
          return {
            roomName: room.roomName,
            guestName: "--- VACANT ---",
            balance: 0,
            source: "N/A",
          };
        }
      });
    } else if (pms_type === "mews") {
      // Future logic for Mews would go here.
      // It would be very similar: get credentials, fetch rooms, fetch in-house guests, merge.
      return res
        .status(501)
        .json({ error: "Report not implemented for Mews yet." });
    } else {
      return res
        .status(400)
        .json({ error: `Unsupported PMS type: ${pms_type}` });
    }

    // --- 5. Sort and Send the Final Report ---
    // Sort the final report by room name/number.
    reportData.sort((a, b) =>
      a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
    );

    res.status(200).json(reportData);
  } catch (error) {
    console.error(
      `Error generating Shreeji Report for hotel ${hotel_id}:`,
      error
    );
    res
      .status(500)
      .json({
        error: "An internal server error occurred while generating the report.",
      });
  }
});

// Export the router so it can be mounted in the main server.js file.
module.exports = router;
