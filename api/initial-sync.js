require("dotenv").config();

// /api/initial-sync.js (Refactored for Multi-PMS Support)
const fetch = require("node-fetch");
const crypto = require("crypto");
const pgPool = require("./utils/db");
const cloudbedsAdapter = require("./adapters/cloudbedsAdapter.js");
const mewsAdapter = require("./adapters/mewsAdapter.js"); // NEW: Require Mews adapter
const format = require("pg-format");

// const { getCredentialsForHotel, getRoomTypesFromPMS } = require("./routes/admin.router.js"); // <-- ADD THIS LINE

/**
 * The core logic for the initial sync process. Now supports Mews and Cloudbeds.
 * @param {string} propertyId The ID of the property to sync.
 */
async function runSync(propertyId) {
  if (!propertyId) {
    throw new Error("A propertyId is required to run the sync.");
  }
  console.log(`Starting 5-YEAR initial sync for property: ${propertyId}`);

  // Use a single database client for the entire operation
  const client = await pgPool.connect();
  try {
// [NEW] First, determine the PMS type AND locked_years for this property
    const hotelResult = await client.query(
      "SELECT pms_type, locked_years FROM hotels WHERE hotel_id = $1",
      [propertyId]
    );

    if (hotelResult.rows.length === 0) {
      throw new Error(`Hotel with ID ${propertyId} not found.`);
    }
    const pmsType = hotelResult.rows[0].pms_type;
    console.log(`Detected PMS Type: ${pmsType}`);

    // Start a transaction for the entire sync operation
    await client.query("BEGIN");

// [NEW] Clear existing metric snapshots, RESPECTING LOCKED YEARS
    console.log(`Clearing existing metric data for property ${propertyId}...`);

    // Get the hotel's locked_years from the result we fetched earlier
    const lockedYears = (hotelResult.rows[0].locked_years || []).map((y) =>
      parseInt(y, 10)
    );

    // Dynamically build a WHERE clause to exclude locked years from deletion
    let deleteQuery = "DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1";
    if (lockedYears.length > 0) {
      // Append the condition to NOT delete records where the year is in our locked list
      deleteQuery += ` AND EXTRACT(YEAR FROM stay_date) NOT IN (${lockedYears.join(
        ","
      )})`;
      console.log(
        `File lock active. Will NOT delete data for years: ${lockedYears.join(
          ", "
        )}`
      );
    }
    
    // Execute the safe, dynamic delete query
    await client.query(deleteQuery, [propertyId]);
    console.log("✅ Existing data cleared (respecting locks).");

    // /api/initial-sync.js

    // ==================================================================
    // CLOUDBEDS LOGIC PATH
    // ==================================================================
    if (pmsType === "cloudbeds") {
      console.log("--- Running Cloudbeds Sync ---");

// THE FIX: Get the pms_property_id from the hotels table first.
      const hotelDetailsResult = await client.query(
        "SELECT pms_property_id, tax_rate, tax_type, total_rooms FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      const pmsPropertyId = hotelDetailsResult.rows[0]?.pms_property_id;
      // This provides a fallback for old hotels where pms_property_id is null.
      // In that case, the internal propertyId IS the correct Cloudbeds ID.
      const cloudbedsApiId = pmsPropertyId || propertyId;

      // Get user and credential info
      const userResult = await client.query(
        `SELECT u.cloudbeds_user_id FROM users u
         JOIN user_properties up ON u.cloudbeds_user_id = up.user_id
         WHERE up.property_id = $1::integer LIMIT 1`,
        [propertyId]
      );

      if (userResult.rows.length === 0) {
        throw new Error(`No user link found for property ${propertyId}.`);
      }
      const user = userResult.rows[0];
      // getAccessToken uses our internal ID, which is correct for finding credentials.
      const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);

      // Sync metadata using the correct ID for the Cloudbeds API.
      console.log(
        `Syncing hotel metadata for Cloudbeds property ${cloudbedsApiId}...`
      );
      await cloudbedsAdapter.syncHotelDetailsToDb(
        accessToken,
        cloudbedsApiId,
        client
      );
      await cloudbedsAdapter.syncHotelTaxInfoToDb(
        accessToken,
        cloudbedsApiId,
        client
      );

      console.log("✅ Hotel metadata sync complete.");

      // --- [NEW] Calculate and save Total Rooms (copied from admin.router.js) ---
console.log(`[Initial Sync] Now calculating total rooms for hotel: ${propertyId}`);
let totalRooms = 0;
try {
  // 1. Get credentials and PMS info
  const { credentials, pms_type, pms_property_id } = await getCredentialsForHotel(
    propertyId
  );

  // 2. Call the PMS API function
  const apiResponse = await getRoomTypesFromPMS(
    propertyId, 
    pms_type, 
    credentials, 
    pms_property_id
  );

  // 3. Sum the 'roomTypeUnits', skipping "virtual" rooms
  if (apiResponse && Array.isArray(apiResponse.data)) {
    totalRooms = apiResponse.data.reduce(
      (sum, roomType) => {
        const roomName = roomType.roomTypeName || roomType.Name || "";
        if (roomName.toLowerCase().includes('virtual')) {
          console.log(` -- Skipping room: "${roomName}" (virtual)`);
          return sum;
        }
        return sum + (roomType.roomTypeUnits || roomType.RoomTypeUnits || 0);
      },
      0
    );
  } else {
    throw new Error("Invalid API response structure. Expected { data: [...] }");
  }

  // 4. Save to the database
  if (totalRooms > 0) {
    await client.query(
      "UPDATE hotels SET total_rooms = $1 WHERE hotel_id = $2",
      [totalRooms, propertyId]
    );
    console.log(`[Initial Sync] SUCCESS: Set total_rooms to ${totalRooms} for hotel ${propertyId}.`);
  } else {
    console.warn(`[Initial Sync] Calculated total rooms was 0 for hotel ${propertyId}. Skipping update.`);
  }

} catch (roomError) {
  // Log the error but do not fail the whole transaction
  console.error(`[Initial Sync] FAILED to update total_rooms for hotel ${propertyId}: ${roomError.message}`);
}
// --- [END NEW] ---

      // Fetch historical metrics
      const taxRate = hotelDetailsResult.rows[0]?.tax_rate || 0;
      const pricingModel = hotelDetailsResult.rows[0]?.tax_type || "inclusive";
const staticTotalRooms = hotelDetailsResult.rows[0]?.total_rooms;

      let allProcessedData = {};
      const startYear = new Date().getFullYear() - 5;
      const endYear = new Date().getFullYear();

      for (let year = startYear; year <= endYear; year++) {
        for (let month = 0; month < 12; month++) {
          const monthStartDate = new Date(Date.UTC(year, month, 1))
            .toISOString()
            .split("T")[0];
          const monthEndDate = new Date(Date.UTC(year, month + 1, 0))
            .toISOString()
            .split("T")[0];
          console.log(
            `Fetching metric data for ${year}-${String(month + 1).padStart(
              2,
              "0"
            )}...`
          );

          // Use the correct cloudbedsApiId for the API call.
          const monthlyData = await cloudbedsAdapter.getHistoricalMetrics(
            accessToken,
            cloudbedsApiId,
            monthStartDate,
            monthEndDate,
            taxRate,
            pricingModel
          );
          allProcessedData = { ...allProcessedData, ...monthlyData };
        }
      }

      console.log("Fetching forecast data for the next 365 days...");
      // Use the correct cloudbedsApiId for the API call.
      const futureData = await cloudbedsAdapter.getUpcomingMetrics(
        accessToken,
        cloudbedsApiId,
        taxRate,
        pricingModel
      );
      allProcessedData = { ...allProcessedData, ...futureData };

      // --- NEW, MORE ROBUST GO_LIVE_DATE LOGIC ---
      console.log("Calculating go_live_date with new robust logic...");

      // Step 1: Get a sorted list of all dates that have actual room sales.
      // This is the final, stricter logic that ignores financial-only transactions.
      const activeDates = Object.keys(allProcessedData)
        .filter((date) => allProcessedData[date].rooms_sold > 0)
        .sort();

      let newGoLiveDate = null;

      if (activeDates.length > 0) {
        // Step 2: Count the number of active days for each month.
        const monthlyActivityCounts = {};
        for (const date of activeDates) {
          const month = date.substring(0, 7); // "YYYY-MM"
          monthlyActivityCounts[month] =
            (monthlyActivityCounts[month] || 0) + 1;
        }

        // Step 3: Find the first month that meets our "serious business" criteria (10+ active days).
        const sortedMonths = Object.keys(monthlyActivityCounts).sort();
        const firstSeriousMonth = sortedMonths.find(
          (month) => monthlyActivityCounts[month] >= 10
        );

        if (firstSeriousMonth) {
          // Step 4: If a "serious" month is found, find the earliest date within that month.
          newGoLiveDate = activeDates.find((date) =>
            date.startsWith(firstSeriousMonth)
          );
          console.log(
            `First serious month (${firstSeriousMonth}) found. Setting go_live_date to first active day: ${newGoLiveDate}`
          );
        } else {
          // Fallback: If no month has 10+ active days, use the original logic (earliest date overall).
          newGoLiveDate = activeDates[0];
          console.log(
            `No month met the 10-day activity threshold. Falling back to earliest date: ${newGoLiveDate}`
          );
        }
      }

      // Step 5: Update the database with the calculated date.
      if (newGoLiveDate) {
        await client.query(
          `UPDATE hotels SET go_live_date = $1 WHERE hotel_id = $2`,
          [newGoLiveDate, propertyId]
        );
      }

 const datesToUpdate = Object.keys(allProcessedData);

      // [NEW] Filter out any records from a locked year before insertion
      // We already have 'lockedYears' array defined from the delete step
      const filteredDatesToUpdate = datesToUpdate.filter((date) => {
        const metricYear = new Date(date).getUTCFullYear(); // Use UTCFullYear for date strings
        // Return true (keep) if the year is NOT in the lockedYears array
        return !lockedYears.includes(metricYear);
      });

      // Log if we filtered anything
      if (datesToUpdate.length !== filteredDatesToUpdate.length) {
        console.log(
          `File lock: Filtered out ${
            datesToUpdate.length - filteredDatesToUpdate.length
          } records from locked years.`
        );
      }

      // Now, continue with the filtered list
      if (filteredDatesToUpdate.length > 0) {
        // Use the filtered list for bulk insertion
        const bulkInsertValues = filteredDatesToUpdate.map((date) => {
          const metrics = allProcessedData[date];
          return [
            date,
            propertyId,
            metrics.rooms_sold || 0,
staticTotalRooms || metrics.capacity_count || 0, // <-- REPLACED: Uses non-conflicting variable
            metrics.occupancy || 0,
            user.cloudbeds_user_id,
            metrics.net_revenue || 0,
            metrics.gross_revenue || 0,
            metrics.net_adr || 0,
            metrics.gross_adr || 0,
            metrics.net_revpar || 0,
            metrics.gross_revpar || 0,
          ];
        });
        const query = format(
          `INSERT INTO daily_metrics_snapshots (
              stay_date, hotel_id, rooms_sold, capacity_count, occupancy_direct, cloudbeds_user_id,
              net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar
            ) VALUES %L`,
          bulkInsertValues
        );
        await client.query(query);
      }
      console.log(
        `✅ Cloudbeds sync job complete for property ${propertyId}. Synced ${datesToUpdate.length} metric records.`
      );
    }
    // ==================================================================
    // MEWS LOGIC PATH (All new code)
    // ==================================================================
    // Replace with this:
    // replace with this
    // replace with this
    else if (pmsType === "mews") {
      console.log("--- Running Mews Sync ---");
      // Get Mews credentials from the DB
      const credsResult = await client.query(
        "SELECT pms_credentials FROM user_properties WHERE property_id = $1 LIMIT 1",
        [propertyId]
      );
      if (
        credsResult.rows.length === 0 ||
        !credsResult.rows[0].pms_credentials
      ) {
        throw new Error(
          `No Mews credentials found for property ${propertyId}.`
        );
      }
      const storedCredentials = credsResult.rows[0].pms_credentials;

      // --- NEW: Decrypt the Access Token before using it ---
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

      const credentials = {
        clientToken: storedCredentials.clientToken,
        accessToken: decryptedToken,
      };
      // --- END DECRYPTION LOGIC ---

      // Sync hotel metadata from Mews
      console.log("Syncing hotel metadata from Mews...");
      const hotelDetails = await mewsAdapter.getHotelDetails(credentials);

      const hotelTimezone = hotelDetails.timezone;
      if (!hotelTimezone) {
        throw new Error(
          `Mews did not return a timezone for property ${propertyId}. Halting sync.`
        );
      }

      // --- UPDATED QUERY: Saves new fields and standardizes pricing_model ---
      await client.query(
        `UPDATE hotels SET 
      property_name = $1, 
      city = $2, 
      currency_code = $3, 
      latitude = $4, 
      longitude = $5, 
      pricing_model = 'inclusive', -- Standardize to 'inclusive'
      timezone = $7,
      address_1 = $8,
      zip_postal_code = $9,
      country = $10
     WHERE hotel_id = $6::integer`,
        [
          hotelDetails.propertyName,
          hotelDetails.city,
          hotelDetails.currencyCode,
          hotelDetails.latitude,
          hotelDetails.longitude,
          propertyId,
          hotelTimezone,
          hotelDetails.address_1,
          hotelDetails.zip_postal_code,
          hotelDetails.country,
        ]
      );
      console.log(`✅ Hotel metadata sync complete.`);

      // --- NEW: Automatically sync neighborhood for Mews hotels ---
      if (hotelDetails.latitude && hotelDetails.longitude) {
        const neighborhood = await cloudbedsAdapter.getNeighborhoodFromCoords(
          hotelDetails.latitude,
          hotelDetails.longitude
        );
        if (neighborhood) {
          await client.query(
            "UPDATE hotels SET neighborhood = $1 WHERE hotel_id = $2",
            [neighborhood, propertyId]
          );
          console.log(`✅ Neighborhood set to: ${neighborhood}`);
        }
      }

      // --- The rest of the historical data fetch remains unchanged ---
      let allProcessedData = {};
      let currentStartDate = new Date();
      currentStartDate.setFullYear(currentStartDate.getFullYear() - 5);
      const today = new Date();

      while (currentStartDate < today) {
        let currentEndDate = new Date(currentStartDate);
        currentEndDate.setDate(currentEndDate.getDate() + 89);

        if (currentEndDate > today) {
          currentEndDate = today;
        }

        const startDateStr = currentStartDate.toISOString().split("T")[0];
        const endDateStr = currentEndDate.toISOString().split("T")[0];

        console.log(
          `Fetching Mews data from ${startDateStr} to ${endDateStr}...`
        );

        const [occupancyData, revenueData] = await Promise.all([
          mewsAdapter.getOccupancyMetrics(
            credentials,
            startDateStr,
            endDateStr,
            hotelTimezone
          ),
          mewsAdapter.getRevenueMetrics(
            credentials,
            startDateStr,
            endDateStr,
            hotelTimezone
          ),
        ]);

        occupancyData.dailyMetrics.forEach((metric) => {
          allProcessedData[metric.date] = {
            ...allProcessedData[metric.date],
            rooms_sold: metric.occupied,
            capacity_count: metric.available,
            occupancy:
              metric.available > 0 ? metric.occupied / metric.available : 0,
          };
        });

        revenueData.dailyMetrics.forEach((metric) => {
          allProcessedData[metric.date] = {
            ...allProcessedData[metric.date],
            net_revenue: metric.netRevenue,
            gross_revenue: metric.grossRevenue,
          };
        });

        currentStartDate.setDate(currentStartDate.getDate() + 90);
      }

      console.log("✅ All historical data fetched.");

      // --- NEW LOGIC TO SET GO_LIVE_DATE ---
      // Find the earliest date from all the data we've collected.
      // --- NEW LOGIC TO SET GO_LIVE_DATE ---
      // Find the earliest date that has actual activity (rooms sold or revenue).
      const sortedDates = Object.keys(allProcessedData).sort();
      const earliestDate = sortedDates.find(
        (date) =>
          allProcessedData[date].rooms_sold > 0 ||
          allProcessedData[date].gross_revenue > 0
      );

      if (earliestDate) {
        console.log(`Setting effective go_live_date to: ${earliestDate}`);
        // As you described, run the UPDATE query to store this date.
        await client.query(
          `UPDATE hotels SET go_live_date = $1 WHERE hotel_id = $2`,
          [earliestDate, propertyId]
        );
      }
      // --- END NEW LOGIC ---

  // --- END NEW LOGIC ---

      const datesToUpdate = Object.keys(allProcessedData);

      // [NEW] Filter out any records from a locked year before insertion
      // We already have 'lockedYears' array defined from the delete step
      const filteredDatesToUpdate = datesToUpdate.filter((date) => {
        const metricYear = new Date(date).getUTCFullYear(); // Use UTCFullYear for date strings
        // Return true (keep) if the year is NOT in the lockedYears array
        return !lockedYears.includes(metricYear);
      });

      // Log if we filtered anything
      if (datesToUpdate.length !== filteredDatesToUpdate.length) {
        console.log(
          `File lock: Filtered out ${
            datesToUpdate.length - filteredDatesToUpdate.length
          } records from locked years.`
        );
      }

      // Now, continue with the filtered list
      if (filteredDatesToUpdate.length > 0) {
        // Use the filtered list for bulk insertion
        const bulkInsertValues = filteredDatesToUpdate.map((date) => {
          const metrics = allProcessedData[date];
          const net_adr =
            metrics.rooms_sold > 0
              ? metrics.net_revenue / metrics.rooms_sold
              : 0;
          const gross_adr =
            metrics.rooms_sold > 0
              ? metrics.gross_revenue / metrics.rooms_sold
              : 0;
          const net_revpar =
            metrics.capacity_count > 0
              ? metrics.net_revenue / metrics.capacity_count
              : 0;
          const gross_revpar =
            metrics.capacity_count > 0
              ? metrics.gross_revenue / metrics.capacity_count
              : 0;

          return [
            date,
            propertyId,
            metrics.rooms_sold || 0,
            metrics.capacity_count || 0,
            metrics.occupancy || 0,
            null,
            metrics.net_revenue || 0,
            metrics.gross_revenue || 0,
            net_adr,
            gross_adr,
            net_revpar,
            gross_revpar,
          ];
        });
        const query = format(
          `INSERT INTO daily_metrics_snapshots (
          stay_date, hotel_id, rooms_sold, capacity_count, occupancy_direct, cloudbeds_user_id,
          net_revenue, gross_revenue, net_adr, gross_adr, net_revpar, gross_revpar
        ) VALUES %L`,
          bulkInsertValues
        );
        await client.query(query);
      }
      console.log(
        `✅ Mews sync job complete for property ${propertyId}. Synced ${datesToUpdate.length} metric records.`
      );
    }
    // If we get here, all steps for the specific PMS succeeded.
    await client.query("COMMIT");
  } catch (e) {
    // If any step fails, roll back all database changes
    await client.query("ROLLBACK");
    // Re-throw the error so it's logged by the wrapper function
    throw e;
  } finally {
    // Always release the database client back to the pool
    client.release();
  }
}

// --- HELPER FUNCTIONS COPIED FROM ADMIN.ROUTER.JS ---
// This breaks the circular dependency.

/**
 * Gets a fresh admin access token for Cloudbeds.
 * NOTE: This is a copy of the function in admin.router.js.
 */
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

/**
 * Helper function to get the necessary credentials for any hotel.
 * NOTE: This is a copy of the function in admin.router.js.
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
  if (pms_type === 'mews') {
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
        accessToken: decryptedToken
      },
      pms_type: 'mews',
      pms_property_id: pms_property_id
    };
  }

  // For Cloudbeds, just return the stored credentials object
  return {
    credentials: pms_credentials, // This contains the refresh_token
    pms_type: 'cloudbeds',
    pms_property_id: pms_property_id
  };
}

/**
 * Fetches room type data directly from the PMS API.
 * NOTE: This is a copy of the function in admin.router.js.
 * @param {string} hotelId Internal hotel_id (for getting the *right* token)
 * @param {string} pms_type 'cloudbeds' or 'mews'
 * @param {object} credentials The credentials object from getCredentialsForHotel
 * @param {string} pms_property_id The external PMS property ID (Cloudbeds needs this)
 * @returns {Promise<object>} The raw API response (expected to have a .data property)
 */
async function getRoomTypesFromPMS(hotelId, pms_type, credentials, pms_property_id) {
  if (pms_type === 'cloudbeds') {
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

  } else if (pms_type === 'mews') {
    // --- Mews Logic ---
    // Credentials are pre-decrypted by getCredentialsForHotel
    const targetUrl = "https://api.mews.com/api/connector/v1/roomTypes/getAll";
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${credentials.accessToken}`,
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

// --- END OF COPIED FUNCTIONS ---




// Wrapper and command-line execution logic remains unchanged...
const serverlessWrapper = async (request, response) => {
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Method Not Allowed" });
  }
  const { propertyId } = request.body;
  try {
    await runSync(propertyId);
    response.status(200).json({ success: true });
  } catch (error) {
    console.error(
      `❌ A critical error occurred during the initial sync for property ${propertyId}:`,
      error
    );
    response.status(500).json({ success: false, error: error.message });
  }
};
serverlessWrapper.runSync = runSync;
module.exports = serverlessWrapper;
if (require.main === module) {
  const propertyId = process.argv[2];
  runSync(propertyId)
    .then(() => {
      console.log("Script finished successfully.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Script failed with an error:", error);
      process.exit(1);
    });
}
