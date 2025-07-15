// /api/utils/middleware.js
const pgPool = require("./db");
const cloudbeds = require("./cloudbeds");

/**
 * NEW: API Middleware to protect routes and manage access tokens.
 * This now handles both OAuth and Manual "pilot" auth users.
 */
async function requireUserApi(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const userResult = await pgPool.query(
      "SELECT user_id, auth_mode, refresh_token, needs_property_sync FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    const user = userResult.rows[0];
    req.user = { internalId: user.user_id, cloudbedsId: req.session.userId };

    if (user.auth_mode === "manual") {
      const propertyId = req.headers["x-property-id"];
      if (!propertyId && req.path !== "/my-properties") {
        // Allow /my-properties to pass without a header
        return res.status(400).json({
          error: "X-Property-ID header is required for this request.",
        });
      }

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

      if (user.needs_property_sync) {
        const tempTokenForSync =
          req.user.accessToken ||
          (
            await cloudbeds.getManualAccessToken(
              (
                await pgPool.query(
                  "SELECT override_client_id, override_client_secret FROM user_properties WHERE user_id = $1 AND override_client_id IS NOT NULL LIMIT 1",
                  [req.user.cloudbedsId]
                )
              ).rows[0].override_client_id,
              (
                await pgPool.query(
                  "SELECT override_client_id, override_client_secret FROM user_properties WHERE user_id = $1 AND override_client_id IS NOT NULL LIMIT 1",
                  [req.user.cloudbedsId]
                )
              ).rows[0].override_client_secret
            )
          )?.access_token;
        if (tempTokenForSync) {
          const properties = await cloudbeds.getPropertiesForUser(
            tempTokenForSync
          );
          if (properties) {
            const client = await pgPool.connect();
            // Find this block: if (user.needs_property_sync) { ... }
            // And replace the try...catch...finally inside it with this new version.
            try {
              await client.query("BEGIN");
              for (const prop of properties) {
                // Step 1: NEW - Ensure the hotel exists in our main hotels table.
                // We use our new utility function to get the hotel's details.
                const hotelDetails = await cloudbeds.getHotelDetails(
                  tempTokenForSync,
                  prop.id
                );
                if (hotelDetails) {
                  // If we got details, insert them into the central 'hotels' table.
                  // ON CONFLICT ensures we don't create duplicates.
                  await client.query(
                    `INSERT INTO hotels (hotel_id, property_name, city, star_rating)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (hotel_id) DO NOTHING`,
                    [
                      hotelDetails.propertyID,
                      hotelDetails.propertyName,
                      hotelDetails.propertyCity,
                      2,
                    ] // We assume a default star rating of 2 for now.
                  );
                }

                // Step 2: Link the property to the user (this part is unchanged).
                await client.query(
                  "INSERT INTO user_properties (user_id, property_id) VALUES ($1, $2) ON CONFLICT (user_id, property_id) DO NOTHING",
                  [req.user.cloudbedsId, prop.id]
                );
              }
              // Step 3: Mark the sync as complete for this user (unchanged).
              await client.query(
                "UPDATE users SET needs_property_sync = false WHERE user_id = $1",
                [req.user.internalId]
              );
              await client.query("COMMIT");
            } catch (e) {
              await client.query("ROLLBACK");
              // Updated error message for better debugging.
              console.error(
                "Property sync and registration for manual user failed:",
                e
              );
            } finally {
              client.release();
            }
          }
        }
      }
    }
    return next();
  } catch (error) {
    console.error("CRITICAL ERROR in requireUserApi middleware:", error);
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
