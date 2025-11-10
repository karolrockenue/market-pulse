// File: /api/utils/report.generators.js
// [NEW] A centralized "Logic Hub" for generating complex reports.

const pool = require("./db"); // Database connection pool
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter"); // Cloudbeds adapter
const { generatePdfFromHtml } = require("./pdf.utils"); // PDF utility
const fetch = require("node-fetch"); // Needed for access token helper
const { format } = require("date-fns"); // For formatting the filename date

/**
 * A helper function to get a valid Cloudbeds access token for a given property.
 * Copied directly from rockenue.router.js.
 *
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

/**
 * Generates the Shreeji Report PDF for a specific hotel and date.
 * This logic is extracted from /api/routes/rockenue.router.js.
 *
 * @param {string|number} hotelId - The hotel_id to generate the report for.
 * @param {string} date - The report date in 'YYYY-MM-DD' format.
 * @returns {Promise<object>} An object containing { pdfBuffer, fileName, hotelName, reportDate }.
 */
async function generateShreejiReport(hotelId, date) {
  console.log(
    `[report.generators.js] Generating Shreeji Report for hotel ${hotelId} on ${date}`
  );

  try {
    // --- 1. GATHER ALL DATA ---
    //

    const snapshotResult = await pool.query(
      `SELECT
        rooms_sold,
        capacity_count,
        gross_revenue,
        gross_adr,
        gross_revpar
       FROM daily_metrics_snapshots
       WHERE hotel_id = $1::integer AND stay_date = $2::date`,
      [hotelId, date]
    );

    let summary = {
      vacant: "N/A",
      blocked: "N/A",
      sold: 0,
      occupancy: 0,
      revpar: 0,
      adr: 0,
      revenue: 0,
    };
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

    const hotelInfoResult = await pool.query(
      "SELECT pms_type, pms_property_id, property_name FROM hotels WHERE hotel_id = $1",
      [hotelId]
    );
    if (hotelInfoResult.rows.length === 0) {
      throw new Error(`Hotel not found with ID: ${hotelId}`);
    }

    const { pms_type, pms_property_id, property_name } =
      hotelInfoResult.rows[0];
    const externalPropertyId = pms_property_id || hotelId;

    let reportData = [];
    let takingsData = {};
    let blockedRoomNames = [];
    let blockedRoomsCount = 0;

    if (pms_type === "cloudbeds") {
      const accessToken = await getCloudbedsAccessToken(hotelId);
      const [
        takingsResult,
        roomsResponse,
        overlappingReservations,
        roomBlocksResult,
      ] = await Promise.all([
        cloudbedsAdapter.getDailyTakings(accessToken, externalPropertyId, date),
        cloudbedsAdapter.getRooms(accessToken, externalPropertyId),
        cloudbedsAdapter.getReservations(accessToken, externalPropertyId, {
          checkInTo: date,
          checkOutFrom: date,
        }),
        cloudbedsAdapter.getRoomBlocks(accessToken, externalPropertyId, date),
      ]);

      const roomMap = new Map();
      const allRoomsForMap = roomsResponse[0]?.rooms || [];
      for (const room of allRoomsForMap) {
        roomMap.set(room.roomID, room.roomName);
      }

      const activeOvernightBlocks = roomBlocksResult.filter((block) => {
        return block.startDate <= date && block.endDate > date;
      });

      if (activeOvernightBlocks && activeOvernightBlocks.length > 0) {
        for (const block of activeOvernightBlocks) {
          for (const room of block.rooms) {
            const roomName = roomMap.get(room.roomID);
            if (roomName) {
              blockedRoomNames.push(roomName);
            }
          }
        }
      }
      blockedRoomsCount = blockedRoomNames.length;
      summary.blocked = blockedRoomsCount;

      takingsData = takingsResult;
      const allHotelRooms = roomsResponse[0]?.rooms || [];

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
            const roomDetails = res.rooms[0];
            const adults = parseInt(roomDetails.adults, 10) || 0;
            const children = parseInt(roomDetails.children, 10) || 0;

            let paxString = `${adults}`;
            if (children > 0) {
              paxString += `+${children}`;
            }

            occupiedRoomsData.set(roomName, {
              guestName: res.guestName || "N/A",
              pax: paxString,
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
            pax: "---",
            balance: 0,
            source: "---",
            checkInDate: "---",
            checkOutDate: "---",
            grandTotal: 0,
          };
        }
      });
    } else {
      // Handle Mews or other PMS types if necessary
      if (summary.sold === 0 && summary.revenue === 0) {
        throw new Error(
          `Report not implemented for Mews (or no data) for hotel ${hotelId} on ${date}.`
        );
      }
    }

    reportData.sort((a, b) =>
      a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
    );

    const blocksData = {
      count: blockedRoomsCount,
      names: blockedRoomNames.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    };

    // --- 2. PREPARE DATA FOR PDF ---
    const dataForPdf = {
      reportData,
      summary,
      takings: takingsData,
      blocks: blocksData,
      hotelName: property_name,
      reportDate: date,
    };

    // --- 3. GENERATE PDF ---
    //
    const pdfBuffer = await generatePdfFromHtml(
      "shreeji.template.html",
      dataForPdf
    );

// --- 4. PREPARE FILENAME ---
    // Create a Date object from the YYYY-MM-DD string.
    // We add T12:00:00Z to ensure it's parsed as UTC and avoids timezone day-rollover issues.
    const dateObj = new Date(date + 'T12:00:00Z');

    // Format the date as DD-MMM-YYYY (e.g., 09-Nov-2025)
    const formattedDate = format(dateObj, 'dd-MMM-yyyy');

    // Use the new required filename
    const fileName = `Daily Chart - ${property_name} - ${formattedDate}.pdf`;

    // --- 5. RETURN RESULTS ---
    return {
      pdfBuffer,
      fileName,
      hotelName: property_name,
      reportDate: date,
    };
  } catch (error) {
    console.error(
      `[report.generators.js] Error generating Shreeji Report for hotel ${hotelId}:`,
      error
    );
    // Throw error so the cron job or API can catch it
    throw error;
  }
}

module.exports = {
  generateShreejiReport,
};