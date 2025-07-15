// /api/utils/middleware.js (with extensive debugging)
const pgPool = require("./db");
const cloudbeds = require("./cloudbeds");

async function requireUserApi(req, res, next) {
  console.log(`[DEBUG 0] Middleware triggered for path: ${req.path}`);
  if (!req.session || !req.session.userId) {
    console.log("[DEBUG FAIL] No session or userId found.");
    return res.status(401).json({ error: "Authentication required." });
  }
  console.log(`[DEBUG 1] Session found for userId: ${req.session.userId}`);

  try {
    const userResult = await pgPool.query(
      "SELECT user_id, auth_mode, refresh_token, needs_property_sync FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      console.log(
        `[DEBUG FAIL] User not found in DB for cloudbeds_user_id: ${req.session.userId}`
      );
      return res.status(401).json({ error: "User not found." });
    }

    const user = userResult.rows[0];
    req.user = { internalId: user.user_id, cloudbedsId: req.session.userId };
    console.log(
      `[DEBUG 2] User found. Mode: ${user.auth_mode}, Needs Sync: ${user.needs_property_sync}`
    );

    if (user.auth_mode === "manual") {
      console.log("[DEBUG 3] Manual auth mode detected.");
      const propertyId = req.headers["x-property-id"];

      // api/utils/middleware.js

      // ...

      // This conditional check now includes an exception for the '/api/auth/connect-pilot-property'
      // route. This route initiates the OAuth flow and therefore will not have the
      // X-Property-ID header, which is only needed for subsequent API calls.
      if (
        !propertyId &&
        req.path !== "/my-properties" &&
        req.path !== "/api/auth/connect-pilot-property"
      ) {
        console.log(
          `[DEBUG FAIL] Manual user on path '${req.path}' requires X-Property-ID header.`
        );
        return res.status(400).json({
          error: "X-Property-ID header is required for this request.",
        });
      }

      if (user.needs_property_sync) {
        console.log(
          "[DEBUG 4] 'needs_property_sync' is TRUE. Starting one-time sync."
        );
        const client = await pgPool.connect();
        try {
          console.log(
            "[DEBUG 5] Fetching first available credential to get a temporary token."
          );
          const credsResult = await client.query(
            "SELECT override_client_id, override_client_secret FROM user_properties WHERE user_id = $1 AND override_client_id IS NOT NULL LIMIT 1",
            [req.user.cloudbedsId]
          );

          if (credsResult.rows.length === 0) {
            throw new Error(
              "Could not find any credentials to perform initial property sync."
            );
          }
          const { override_client_id, override_client_secret } =
            credsResult.rows[0];
          console.log(
            "[DEBUG 6] Credentials found. Fetching temporary access token..."
          );

          const tempTokenForSync = await cloudbeds.getManualAccessToken(
            override_client_id,
            override_client_secret
          );
          if (!tempTokenForSync || !tempTokenForSync.access_token) {
            throw new Error("Failed to get temporary access token for sync.");
          }
          console.log(
            "[DEBUG 7] Temporary token acquired. Fetching property list from Cloudbeds..."
          );

          const properties = await cloudbeds.getPropertiesForUser(
            tempTokenForSync.access_token
          );
          if (!properties) {
            throw new Error(
              "Failed to fetch property list from Cloudbeds during sync."
            );
          }
          console.log(
            `[DEBUG 8] Found ${properties.length} properties. Starting DB transaction.`
          );

          await client.query("BEGIN");
          for (const prop of properties) {
            console.log(`[DEBUG 9] Processing property ID: ${prop.id}`);
            const hotelDetails = await cloudbeds.getHotelDetails(
              tempTokenForSync.access_token,
              prop.id
            );
            if (hotelDetails) {
              console.log(
                `[DEBUG 10] Fetched details for ${hotelDetails.propertyName}. Inserting into 'hotels' table.`
              );
              await client.query(
                `INSERT INTO hotels (hotel_id, property_name, city, star_rating) VALUES ($1, $2, $3, $4) ON CONFLICT (hotel_id) DO NOTHING`,
                [
                  hotelDetails.propertyID,
                  hotelDetails.propertyName,
                  hotelDetails.propertyCity,
                  2,
                ]
              );
            }
            console.log(
              `[DEBUG 11] Linking property ${prop.id} to user ${req.user.cloudbedsId}.`
            );
            await client.query(
              "INSERT INTO user_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT (user_id, property_id) DO NOTHING",
              [req.user.cloudbedsId, prop.id]
            );
          }
          console.log(
            "[DEBUG 12] All properties processed. Updating user 'needs_property_sync' flag to false."
          );
          await client.query(
            "UPDATE users SET needs_property_sync = false WHERE user_id = $1",
            [req.user.internalId]
          );
          await client.query("COMMIT");
          console.log(
            "[DEBUG 13] DB transaction committed successfully. Sync complete."
          );
        } catch (e) {
          console.error(
            "[DEBUG FAIL] Error during property sync transaction:",
            e
          );
          await client.query("ROLLBACK");
          throw e; // Re-throw the error to be caught by the main catch block
        } finally {
          client.release();
        }
      }
      // This part handles normal API calls after the initial sync is done.
      if (propertyId) {
        if (
          req.session.manualTokens &&
          req.session.manualTokens[propertyId] &&
          req.session.manualTokens[propertyId].expires > Date.now()
        ) {
          req.user.accessToken = req.session.manualTokens[propertyId].token;
        } else {
          const credsResult = await pgPool.query(
            "SELECT override_client_id, override_client_secret FROM user_properties WHERE user_id = $1 AND property_id = $2",
            [req.user.cloudbedsId, propertyId]
          );
          if (
            credsResult.rows.length === 0 ||
            !credsResult.rows[0].override_client_id
          ) {
            return res.status(403).json({
              error: "Manual credentials not configured for this property.",
            });
          }
          const { override_client_id, override_client_secret } =
            credsResult.rows[0];
          const tokenData = await cloudbeds.getManualAccessToken(
            override_client_id,
            override_client_secret
          );
          if (!tokenData || !tokenData.access_token) {
            return res
              .status(503)
              .json({ error: "Could not authenticate with Cloudbeds." });
          }
          if (!req.session.manualTokens) req.session.manualTokens = {};
          req.session.manualTokens[propertyId] = {
            token: tokenData.access_token,
            expires: Date.now() + (tokenData.expires_in - 300) * 1000,
          };
          req.user.accessToken = tokenData.access_token;
        }
      }
    }
    console.log(
      `[DEBUG FINAL] Middleware success for path: ${req.path}. Calling next().`
    );
    return next();
  } catch (error) {
    console.error(
      `[CRITICAL ERROR] Middleware failed for path ${req.path}:`,
      error
    );
    return res
      .status(500)
      .json({ error: "Internal server error during authentication." });
  }
}

// --- EXISTING UNCHANGED MIDDLEWARE ---
const requireAdminApi = (req, res, next) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  if (!req.session.isAdmin) {
    return res
      .status(403)
      .json({ error: "Forbidden: Administrator access required." });
  }
  next();
};

const requirePageLogin = (req, res, next) => {
  // --- ADD THESE DEBUG LINES ---
  console.log(`[DEBUG SESSION READ] Checking page login for path: ${req.path}`);
  console.log(
    `[DEBUG SESSION READ] Found session userId: ${req.session.userId}`
  );
  // --- END DEBUG LINES ---
  if (!req.session.userId) {
    return res.redirect("/signin");
  }
  next();
};

module.exports = {
  requireUserApi,
  requireAdminApi,
  requirePageLogin,
};
