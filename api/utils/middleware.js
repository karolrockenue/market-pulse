// /api/utils/middleware.js (with extensive debugging)
const pgPool = require("./db");
const cloudbeds = require("./cloudbeds");

async function requireUserApi(req, res, next) {
  // Check for an active session. This part remains the same.
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    // The query is now simplified. We just need to check if the user exists.
    // All references to 'auth_mode' and 'needs_property_sync' are removed.
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );

    // If no user is found for the session ID, deny access.
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found." });
    }

    // Attach the user's IDs to the request object for use in other routes.
    // This is useful for knowing who is making the request.
    const user = userResult.rows[0];
    req.user = { internalId: user.user_id, cloudbedsId: req.session.userId };

    // With the pilot code removed, we no longer need complex checks.
    // If the user exists in our database, they are valid. We let them proceed.
    return next();
  } catch (error) {
    // Generic error handling for any unexpected database issues.
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
