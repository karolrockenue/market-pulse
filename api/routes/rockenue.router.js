// /api/routes/rockenue.router.js
// This new router will handle all API endpoints for the internal Rockenue section.

const express = require("express");
const router = express.Router();
// Import the database connection pool from the shared utils directory.
// This allows us to query the PostgreSQL database.
const pool = require("../utils/db");

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
    res.status(403).json({
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

/**
 * NEW ENDPOINT: Fetches a list of all hotels in the system.
 * This is used to populate dropdowns in Rockenue reports.
 * Accessible at GET /api/rockenue/hotels
 */
router.get("/hotels", async (req, res) => {
  try {
    // Query the database to get the ID and name for every hotel.
    // We order by property_name to ensure the dropdown list is alphabetical.
    const { rows } = await pool.query(
      "SELECT hotel_id, property_name FROM hotels ORDER BY property_name ASC"
    );
    // Send the list of hotels back to the client.
    res.status(200).json(rows);
  } catch (error) {
    // If there's an error with the database query, log it for debugging.
    console.error("Error fetching hotels for Rockenue report:", error);
    // Send a generic server error message to the client.
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Export the router so it can be mounted in the main server.js file.
module.exports = router;
