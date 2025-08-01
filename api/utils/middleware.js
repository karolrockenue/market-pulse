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
  // First, check if the user is logged in at all.
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  // Second, check if the user's role in the session is 'super_admin'.
  // This is the core of our security fix.
  if (req.session.role !== "super_admin") {
    return res
      .status(403)
      .json({ error: "Forbidden: Super administrator access required." });
  }
  // If both checks pass, allow the request to proceed.
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

// /api/utils/middleware.js

/**
 * New Middleware: requireAccountOwner
 * This function checks if the logged-in user is the "owner" of a specific property.
 * Ownership is defined by having non-null credentials stored in the user_properties table.
 * This prevents a delegated user (Team Member) from managing other users' access.
 */
async function requireAccountOwner(req, res, next) {
  // Extract the propertyId from the request body. This is the property the user is trying to manage.
  const { propertyId } = req.body;
  // Get the ID of the user making the request from their session.
  const requesterCloudbedsId = req.session.userId;

  // Ensure a propertyId was provided in the request.
  if (!propertyId) {
    return res.status(400).json({ error: "A propertyId is required." });
  }

  try {
    // Query the user_properties table to check the user's link to the specified property.
    const ownerCheck = await pgPool.query(
      "SELECT pms_credentials FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [requesterCloudbedsId, propertyId]
    );

    // Case 1: The user has no link to this property at all.
    if (ownerCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have access to this property." });
    }

    // Case 2: The user is linked, but their credentials are null. This means they are a Team Member, not the owner.
    if (ownerCheck.rows[0].pms_credentials === null) {
      return res.status(403).json({
        error: "Forbidden: You do not have permission to manage this property.",
      });
    }

    // If both checks pass, the user is the Account Owner. Allow the request to proceed.
    next();
  } catch (error) {
    console.error("Error in requireAccountOwner middleware:", error);
    return res
      .status(500)
      .json({ error: "Internal server error during permission check." });
  }
}

module.exports = {
  requireUserApi,
  requireAdminApi,
  requirePageLogin,
  requireAccountOwner, // Export the new middleware
};
