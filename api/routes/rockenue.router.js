// /api/routes/rockenue.router.js
// This new router will handle all API endpoints for the internal Rockenue section.

const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");

// Import the database connection pool from the shared utils directory.
const pool = require("../utils/db");

// Import the PMS adapters. This is crucial for communicating with Cloudbeds, Mews, etc.
// Import the PMS adapters. This is crucial for communicating with Cloudbeds, Mews, etc.
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");
const mewsAdapter = require("../adapters/mewsAdapter");

// --- [NEW] Import both permission middlewares ---
const { requireAdminApi, requireSuperAdminOnly } = require("../utils/middleware");

/**
 * Middleware to protect routes, ensuring they are accessible by staff.
 * [MODIFIED] This is now the permissive check for 'admin' OR 'super_admin'.
 * We use the global 'requireAdminApi' function.
 */
router.use(requireAdminApi);

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
    let takingsData = {}; // Initialize an empty takings object.

    // CORRECTED: Declare these variables here, outside the 'if' block.
    // This ensures they always exist when the final response is constructed.
    let blockedRoomNames = [];
    let blockedRoomsCount = 0;

    if (pms_type === "cloudbeds") {
      const accessToken = await getCloudbedsAccessToken(hotel_id);

      // Fetch all data sources in parallel for maximum efficiency.
      // NEW: Added the getDailyUpsells function to the list of parallel calls.
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

      // --- START DIAGNOSTIC LOGS ---
      // Add detailed logging to inspect the raw data structures from the Cloudbeds adapter.
      console.log("--- [DIAGNOSTIC] Content of getRooms response ---");
      console.log(JSON.stringify(roomsResponse, null, 2));
      console.log("--- [DIAGNOSTIC] Content of getRoomBlocks response ---");
      console.log(JSON.stringify(roomBlocksResult, null, 2));
      // --- END DIAGNOSTIC LOGS ---

      // --- RESTORED: Original, Correct Block Processing Logic ---

      // --- FINAL DIAGNOSTIC LOGS ---
      console.log("--- [FINAL CHECK] Content of getRooms response ---");
      console.log(JSON.stringify(roomsResponse, null, 2));
      console.log("--- [FINAL CHECK] Content of getRoomBlocks response ---");
      console.log(JSON.stringify(roomBlocksResult, null, 2));
      // --- END LOGS ---

      // Create a lookup map from roomID to roomName.
      const roomMap = new Map();
      // THE FIX - PART 1: Revert to original logic. The logs confirm the getRooms
      // response is nested: an array containing one object which has a 'rooms' array property.
      // This correctly extracts the flat list of all rooms for the property.
      const allRoomsForMap = roomsResponse[0]?.rooms || [];
      for (const room of allRoomsForMap) {
        roomMap.set(room.roomID, room.roomName);
      }

      // THE FIX - PART 2: Process the corrected data from getRoomBlocks.
      // The adapter now returns a simple, flat array of block objects.

      // First, filter these blocks to only include those active for the "hotel night" of the selected date.
      // The logic is the same as for reservations: the block must start on or before the report date (startDate <= date)
      // and must end after the report date (endDate > date). This correctly excludes blocks that check out on the morning of the report date.
      const activeOvernightBlocks = roomBlocksResult.filter((block) => {
        return block.startDate <= date && block.endDate > date;
      });

      // Now, we iterate over the correctly filtered list of active blocks.
      if (activeOvernightBlocks && activeOvernightBlocks.length > 0) {
        // Each 'block' is an object that contains a 'rooms' array.
        for (const block of activeOvernightBlocks) {
          // The 'rooms' array within a block contains objects with a 'roomID'.
          for (const room of block.rooms) {
            const roomName = roomMap.get(room.roomID);
            // If we find a matching name in our map, add it to our list.
            if (roomName) {
              blockedRoomNames.push(roomName);
            }
          }
        }
      }

      // Get the final count and update the summary.
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

            // THE FIX: The adults and children counts are nested within the first room object of the reservation.
            // We now access them from the correct location: res.rooms[0].
            const roomDetails = res.rooms[0];
            const adults = parseInt(roomDetails.adults, 10) || 0;
            const children = parseInt(roomDetails.children, 10) || 0;

            let paxString = `${adults}`;
            if (children > 0) {
              paxString += `+${children}`;
            }

            occupiedRoomsData.set(roomName, {
              guestName: res.guestName || "N/A",
              pax: paxString, // Add the new pax string to the data object.
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
            pax: "---", // Add a placeholder for unoccupied rooms.
            balance: 0,
            source: "---",
            checkInDate: "---",
            checkOutDate: "---",
            grandTotal: 0,
          };
        }
      });
    } else {
      if (summary.sold === 0 && summary.revenue === 0) {
        return res
          .status(501)
          .json({ error: "Report not implemented for Mews yet." });
      }
    }

    reportData.sort((a, b) =>
      a.roomName.localeCompare(b.roomName, undefined, { numeric: true })
    );
    res.status(200).json({
      reportData,
      summary,
      takings: takingsData,
      // Add the new 'blocks' object containing the count and a sorted list of names.
      blocks: {
        count: blockedRoomsCount,
        names: blockedRoomNames.sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true })
        ),
      },
    });
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


/**
 * GET /api/rockenue/portfolio
 * Fetches ALL assets (Live & Off-Platform) for the portfolio.
 * This single endpoint powers the entire page and its KPI cards.
 */
// --- [SECURED] We add the strict 'requireSuperAdminOnly' middleware here ---
router.get('/portfolio', requireSuperAdminOnly, async (req, res) => {
  
  try {
// This query selects all assets and dynamically creates the 'status'
      // and 'hotelName' fields to match the prototype's data structure.
      const query = `
        SELECT 
          id, 
          asset_name AS "hotelName", 
          city, 
          total_rooms AS "totalRooms", 
          management_group AS "group", 
          monthly_fee AS "monthlyFee",
          market_pulse_hotel_id, -- Keep this for the 'Delete' button logic
          
          -- Create the 'status' field dynamically
          CASE 
            WHEN market_pulse_hotel_id IS NOT NULL THEN 'Live' 
            ELSE 'Off-Platform' 
          END AS status
        FROM 
          rockenue_managed_assets
        ORDER BY
          status DESC, -- Show 'Live' properties first
          "hotelName" ASC;
      `;
      
      // [FIX] Use pool.query() directly
      const { rows } = await pool.query(query);
      res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching Rockenue portfolio:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /api/rockenue/portfolio
 * Adds a new "Off-Platform" property to the portfolio.
 * This matches the prototype's "Add New Property" button.
 */
// --- [SECURED] We add the strict 'requireSuperAdminOnly' middleware here ---
router.post('/portfolio', requireSuperAdminOnly, async (req, res) => {
  try {
// Create a new, blank "Off-Platform" asset, matching the
      // defaults in the prototype's addProperty function.
      const query = `
        INSERT INTO rockenue_managed_assets (
          asset_name, 
          city, 
          total_rooms, 
          management_group, 
          monthly_fee,
          market_pulse_hotel_id -- This is explicitly NULL
        )
        VALUES 
          ('New Property', 'City', 0, 'Group A', 0.00, NULL)
        RETURNING 
          id, 
          asset_name AS "hotelName", 
          city, 
          total_rooms AS "totalRooms", 
          management_group AS "group", 
          monthly_fee AS "monthlyFee",
          market_pulse_hotel_id,
          'Off-Platform' AS status; -- Return the new row in the correct format
      `;
      
      // [FIX] Use pool.query() directly
      const { rows } = await pool.query(query);
      res.status(201).json(rows[0]); // Send the new property back to the frontend
  } catch (error) {
    console.error('Error adding new portfolio property:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * PUT /api/rockenue/portfolio/:id
 * Updates the 'monthly_fee' for any property (Live or Off-Platform).
 * This matches the prototype's "handleFeeUpdate" function.
 */
// --- [SECURED] We add the strict 'requireSuperAdminOnly' middleware here ---
router.put('/portfolio/:id', requireSuperAdminOnly, async (req, res) => {
  const { id } = req.params;
  // [MODIFIED] Destructure all fields from the body
  const {
    monthlyFee,
    hotelName, // Corresponds to asset_name
    city,
    totalRooms,
    group
  } = req.body;

  // [MODIFIED] Validate all required fields for a full update
  // We only require monthlyFee, as others can be set to empty/0
  if (monthlyFee === undefined || isNaN(parseFloat(monthlyFee))) {
    return res.status(400).json({ error: 'Invalid monthlyFee (number) is required.' });
  }

  // [NEW] Sanitize inputs
  const fee = parseFloat(monthlyFee);
  const rooms = parseInt(totalRooms, 10) || 0;
  const assetNameValue = hotelName || 'New Property'; // Default name if empty
  const cityValue = city || 'City'; // Default city if empty
  const groupValue = group || null; // Allow setting group to null

  try {
    // [MODIFIED] Upgraded query to handle business logic in SQL.
    // - monthly_fee is ALWAYS updated.
    // - Other fields are ONLY updated if market_pulse_hotel_id IS NULL (i.e., "Off-Platform").
    const query = `
      UPDATE rockenue_managed_assets
      SET
        monthly_fee = $1,
        asset_name = CASE
          WHEN market_pulse_hotel_id IS NULL THEN $3
          ELSE asset_name
        END,
        city = CASE
          WHEN market_pulse_hotel_id IS NULL THEN $4
          ELSE city
        END,
        total_rooms = CASE
          WHEN market_pulse_hotel_id IS NULL THEN $5
          ELSE total_rooms
        END,
        management_group = CASE
          WHEN market_pulse_hotel_id IS NULL THEN $6
          ELSE management_group
        END,
        updated_at = NOW()
      WHERE
        id = $2
      RETURNING
        id,
        asset_name AS "hotelName",
        city,
        total_rooms AS "totalRooms",
        management_group AS "group",
        monthly_fee AS "monthlyFee",
        market_pulse_hotel_id,
        CASE
          WHEN market_pulse_hotel_id IS NOT NULL THEN 'Live'
          ELSE 'Off-Platform'
        END AS status; -- Return the updated row in the correct frontend format
    `;

    // [MODIFIED] Pass all new parameters to the query
    const { rows } = await pool.query(query, [
      fee,
      id,
      assetNameValue,
      cityValue,
      rooms,
      groupValue
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    res.status(200).json(rows[0]); // Send the fully updated row back

  } catch (error) {
    console.error(`Error updating asset ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * DELETE /api/rockenue/portfolio/:id
 * Deletes an "Off-Platform" property.
 * This matches the prototype's "deleteProperty" function.
 */
// --- [SECURED] We add the strict 'requireSuperAdminOnly' middleware here ---
router.delete('/portfolio/:id', requireSuperAdminOnly, async (req, res) => {
  const { id } = req.params;

  try {
// CRITICAL: We add "AND market_pulse_hotel_id IS NULL"
      // This makes it impossible to delete a "Live" property that is
      // synced from the main 'hotels' table, matching the prototype's logic.
      const query = `
        DELETE FROM rockenue_managed_assets 
        WHERE 
          id = $1 
          AND market_pulse_hotel_id IS NULL;
      `;
      
      // [FIX] Use pool.query() directly
      const result = await pool.query(query, [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ 
          error: 'Property not found or is a "Live" property and cannot be deleted.' 
        });
      }
      
      res.status(200).json({ message: 'Off-Platform property deleted.' });
  } catch (error) {
    console.error(`Error deleting asset ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ... (Your module.exports = router; line at the end of the file)

module.exports = router;
