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

    // /api/utils/middleware.js

    // /api/utils/middleware.js

    if (user.auth_mode === "manual") {
      // --- FIX: Define paths that DON'T need a property ID ---
      const allowedPaths = ["/my-properties", "/last-refresh-time"];

      // If the request is for a general, non-property-specific endpoint,
      // we can skip the property ID header check.
      if (allowedPaths.includes(req.path)) {
        console.log(
          `[DEBUG] Path ${req.path} is allowed without X-Property-ID. Skipping header check.`
        );
        // We still call next() at the end, so we just let this block pass.
      } else {
        // For all other data-intensive endpoints, enforce the header requirement.
        // --- FIX: Look for the property ID in the query string, not the header ---
        const propertyId = req.query.propertyId;
        if (!propertyId) {
          return res.status(400).json({
            error: "An X-Property-ID header is required for this request.",
          });
        }

        // Retrieve the permanently stored API key for the requested property.
        const keyResult = await pgPool.query(
          "SELECT override_api_key FROM user_properties WHERE user_id = $1 AND property_id = $2",
          [req.user.cloudbedsId, propertyId]
        );

        if (
          keyResult.rows.length === 0 ||
          !keyResult.rows[0].override_api_key
        ) {
          return res.status(403).json({
            error: "API Key not configured for this property.",
          });
        }

        // Attach the API key as the 'accessToken' for the downstream API call.
        req.user.accessToken = keyResult.rows[0].override_api_key;
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

// middleware.js

const requirePageLogin = (req, res, next) => {
  // --- BREADCRUMB 2: LOG THE INCOMING SESSION STATE ---
  console.log(
    `[BREADCRUMB 2 - middleware.js] requirePageLogin triggered for path: ${req.path}. Session content:`,
    req.session
  );

  if (!req.session.userId) {
    console.error(
      `[LOGIN FAILURE] Session userId not found. Redirecting to /signin.`
    );
    return res.redirect("/signin");
  }
  console.log(
    `[LOGIN SUCCESS] Session valid for userId: ${req.session.userId}. Allowing access.`
  );
  next();
};

module.exports = {
  requireUserApi,
  requireAdminApi,
  requirePageLogin,
};
