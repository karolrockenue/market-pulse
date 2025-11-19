// Temporary Debugging Block
console.log('--- MIDDLEWARE DEBUG ---');
console.log('Path:', req.path);
console.log('Incoming Cookie Header:', req.headers.cookie); 
console.log('Session ID:', req.sessionID);
console.log('Session Data:', req.session);
console.log('------------------------');

// /api/utils/middleware.js (with extensive debugging)
const pgPool = require("./db");

async function requireUserApi(req, res, next) {
  // --- NEW DIAGNOSTIC LOG ---
  // We are logging the session content at the very start of the middleware.
  // This will tell us if the session is missing entirely or if the userId is missing.

  // Check for an active session. This part remains the same.
  if (!req.session || !req.session.userId) {
    // We are adding a log here to know exactly why the 401 is being sent.
    console.error(
      `[API AUTH FAILURE] Session or session.userId is missing. Denying access to ${req.path}.`
    );
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

// --- [NEW] Permissive middleware for Staff ('admin' + 'super_admin') ---
const requireAdminApi = (req, res, next) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  
  // Allows access for 'admin' (staff) AND 'super_admin' (you).
  const allowedRoles = ["admin", "super_admin"];
  if (!allowedRoles.includes(req.session.role)) {
    return res
      .status(403)
      .json({ error: "Forbidden: Administrator access required." });
  }
  next();
};

// --- [RENAMED] Strict "Karol-only" middleware ---
const requireSuperAdminOnly = (req, res, next) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User session required." });
  }
  // This logic is unchanged: it *only* allows 'super_admin'
  if (req.session.role !== "super_admin") {
    return res
      .status(403)
      .json({ error: "Forbidden: Super administrator access required." });
  }
  next();
};

// middleware.js

// api/utils/middleware.js

const requirePageLogin = (req, res, next) => {
  // --- BREADCRUMB 7: LOG THE INCOMING SESSION STATE WHEN A PAGE IS REQUESTED ---

  // Check if the session or the userId on the session exists.
  if (!req.session || !req.session.userId) {
    // If it doesn't exist, log the failure and the entire (empty) session object for debugging.

    // Redirect the user to the sign-in page.
    return res.redirect("/signin");
  }

  // If the session is valid, log the success and allow the request to proceed.

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

/**
 * Middleware to ensure the user has management permissions.
 * Allows 'owner', 'super_admin', and 'admin' roles to proceed.
 */
const requireManagePermission = (req, res, next) => {
  // --- MODIFICATION ---
  // Add 'admin' to the list of roles that can manage users/properties.
  const allowedRoles = ["owner", "super_admin", "admin"];
  if (req.session && allowedRoles.includes(req.session.role)) {
    return next();
  }
  // --- END MODIFICATION ---
  
  res.status(403).json({
    error: "Forbidden: You do not have permission to perform this action.",
  });
};

module.exports = {
  requireUserApi,
  requireAdminApi, // Export the new permissive middleware
  requireSuperAdminOnly, // Export the new strict middleware
  requirePageLogin,
  requireAccountOwner,
  requireManagePermission,
};