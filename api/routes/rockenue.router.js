// /api/routes/rockenue.router.js
// This new router will handle all API endpoints for the internal Rockenue section.

const express = require("express");
const router = express.Router();

/**
 * Middleware to protect routes, ensuring they are only accessible by super_admin users.
 * This checks the user's role stored in their session.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 * @param {function} next - The Express next middleware function.
 */
const requireSuperAdmin = (req, res, next) => {
  // Check if a user session exists and if the role is 'super_admin'.
  // The 'super_admin' role is the highest permission level in the system.
  if (req.session && req.session.role === "super_admin") {
    // If the user is a super_admin, proceed to the next handler.
    return next();
  } else {
    // If the session is missing or the role is incorrect, send a 403 Forbidden status.
    res
      .status(403)
      .json({
        error: "Forbidden: Access is restricted to super administrators.",
      });
  }
};

// Apply the security middleware to ALL routes that will be defined in this file.
// This ensures the entire section is secure by default.
router.use(requireSuperAdmin);

/**
 * A placeholder endpoint to verify that the Rockenue router is working and secured.
 * This will be accessible at GET /api/rockenue/status
 */
router.get("/status", (req, res) => {
  // This endpoint is only reachable by users who have passed the requireSuperAdmin middleware.
  res.status(200).json({
    message: "Success: You have accessed a secure Rockenue endpoint.",
    userRole: req.session.role, // Echo back the role for confirmation during testing.
  });
});

// Export the router so it can be mounted in the main server.js file in the next step.
module.exports = router;
