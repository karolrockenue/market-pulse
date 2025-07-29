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
      "SELECT user_id, auth_mode, needs_property_sync FROM users WHERE cloudbeds_user_id = $1",
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

    // NEW LOGIC BLOCK TO HANDLE DIFFERENT USER TYPES
    if (user.auth_mode === "invited") {
      // Invited users are team members who view existing data.
      // They don't have their own PMS connection, so we don't need to check for tokens.
      // We simply verify their session is valid and let them pass through.
      console.log(`[DEBUG] User is 'invited'. Allowing access to view data.`);
    } else if (user.auth_mode === "manual") {
      const allowedPaths = ["/my-properties", "/last-refresh-time"];

      if (allowedPaths.includes(req.path)) {
        console.log(
          `[DEBUG] Path ${req.path} is allowed without X-Property-ID. Skipping header check.`
        );
      } else {
        const propertyId = req.query.propertyId;
        if (!propertyId) {
          return res.status(400).json({
            error: "An X-Property-ID header is required for this request.",
          });
        }

        const credsResult = await pgPool.query(
          "SELECT pms_credentials FROM user_properties WHERE user_id = $1 AND property_id = $2",
          [req.user.cloudbedsId, propertyId]
        );

        const credentials = credsResult.rows[0]?.pms_credentials;

        if (!credentials || !credentials.api_key) {
          return res.status(403).json({
            error: "API Key not configured for this property.",
          });
        }

        req.user.accessToken = credentials.api_key;
      }
    }
    // Note: 'oauth' users will fall through this block and proceed,
    // as their token refresh is handled by the data sync scripts, not here.

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
