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

// /api/routes/rockenue.router.js

router.get("/shreeji-report", async (req, res) => {
  const { hotel_id, date } = req.query;
  if (!hotel_id || !date) {
    return res.status(400).json({ error: "hotel_id and date are required." });
  }

  try {
    // --- NEW: Fetch the daily performance snapshot for the summary footer ---
    // This query pulls the pre-calculated daily metrics, which is the source of truth.
    // --- Fetch the daily performance snapshot with added debugging ---
    console.log(
      `[Shreeji Report] Querying DB for hotel_id: ${hotel_id}, stay_date: ${date}`
    );

    const snapshotResult = await pool.query(
      `SELECT
        rooms_sold,
        capacity_count,
        gross_revenue,
        gross_adr,
        gross_revpar
       FROM daily_metrics_snapshots
       WHERE hotel_id = $1::integer AND stay_date = $2::date`,
      [hotel_id, date]
    );

    // --- NEW: Log the exact data returned by the database ---
    if (snapshotResult.rows.length > 0) {
      console.log(
        "[Shreeji Report] DB Result:",
        JSON.stringify(snapshotResult.rows[0])
      );
    } else {
      console.log(
        "[Shreeji Report] DB Result: No snapshot found for this date."
      );
    }

    // Initialize a default summary object in case no data is found for the day.
    let summary = {
      vacant: "N/A",
      blocked: "N/A",
      sold: 0,
      occupancy: 0,
      revpar: 0,
      adr: 0,
      revenue: 0,
    };

    // If a snapshot was found, populate the summary object with its data.
    if (snapshotResult.rows.length > 0) {
      const snapshot = snapshotResult.rows[0];
      summary.sold = snapshot.rooms_sold || 0;
      summary.revenue = snapshot.gross_revenue || 0;
      summary.adr = snapshot.gross_adr || 0;
      summary.revpar = snapshot.gross_revpar || 0;
      summary.occupancy =
        snapshot.capacity_count > 0
          ? (snapshot.rooms_sold / snapshot.capacity_count) * 100
          : 0;
      summary.vacant =
        (snapshot.capacity_count || 0) - (snapshot.rooms_sold || 0);
    }
    // --- END: Daily performance snapshot ---

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

      const roomsResponse = await cloudbedsAdapter.getRooms(
        accessToken,
        externalPropertyId
      );

      const allHotelRooms = roomsResponse[0]?.rooms || [];
      const overlappingReservations = await cloudbedsAdapter.getReservations(
        accessToken,
        externalPropertyId,
        {
          checkInTo: date,
          checkOutFrom: date,
        }
      );

      const inHouseReservations = overlappingReservations.filter((res) => {
        if (res.status === "canceled" || !res.startDate || !res.endDate) {
          return false;
        }
        const checkInDateOnly = res.startDate.substring(0, 10);
        const checkOutDateOnly = res.endDate.substring(0, 10);
        return checkInDateOnly <= date && checkOutDateOnly > date;
      });

      const occupiedRoomsData = new Map();
      if (inHouseReservations.length > 0) {
        const reservationIDs = inHouseReservations.map(
          (res) => res.reservationID
        );
        const detailedReservations =
          await cloudbedsAdapter.getReservationsWithDetails(
            accessToken,
            externalPropertyId,
            { reservationID: reservationIDs.join(",") }
          );

        for (const res of detailedReservations) {
          if (res.rooms && res.rooms.length > 0 && res.rooms[0].roomName) {
            const roomName = res.rooms[0].roomName;
            occupiedRoomsData.set(roomName, {
              guestName: res.guestName || "N/A",
              balance: res.balance || 0,
              source: res.sourceName || "N/A",
              checkInDate: res.reservationCheckIn,
              checkOutDate: res.reservationCheckOut,
              grandTotal: parseFloat(res.total) || 0,
            });
          }
        }
      }

      reportData = allHotelRooms.map((room) => {
        const occupiedData = occupiedRoomsData.get(room.roomName);
        if (occupiedData) {
          return {
            roomName: room.roomName,
            ...occupiedData,
          };
        } else {
          return {
            roomName: room.roomName,
            guestName: "---",
            balance: 0,
            source: "---",
            checkInDate: "---",
            checkOutDate: "---",
            grandTotal: 0,
          };
        }
      });
    } else {
      // For Mews or other PMS types, we will still return the summary data, even if the report is not implemented.
      // This allows the frontend to show the summary footer regardless of PMS.
      if (summary.sold === 0 && summary.revenue === 0) {
        return res
          .status(501)
          .json({ error: "Report not implemented for Mews yet." });
      }
    }

    reportData.sort((a, b) =>
      a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
    );

    // --- NEW: Return a single object containing both the report data and the summary ---
    res.status(200).json({ reportData, summary });
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
