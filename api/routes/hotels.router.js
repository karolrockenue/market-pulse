// api/routes/hotels.router.js

const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const hotelService = require("../services/hotel.service");
const { getBenchmarks } = require("../utils/benchmark.utils");
const {
  requireAdminApi,
  requireSuperAdminOnly,
  requireUserApi
} = require("../utils/middleware");

/**
 * Helper: Verify User Access to Property
 * Preserves logic from budgets.router.js
 */
async function verifyPropertyAccess(req, propertyId) {
  // Super Admins have universal access
  if (req.session.role === 'super_admin') return true;

  const internalUserId = req.user.internalId;
  const cloudbedsUserId = req.user.cloudbedsId;

  // Check link in user_properties
  const { rows } = await pool.query(
    `SELECT 1 FROM user_properties
     WHERE (user_id = $1 OR user_id = $2::text)
     AND property_id = $3`,
    [cloudbedsUserId, internalUserId, propertyId]
  );
  return rows.length > 0;
}

// =============================================================================
// 1. GLOBAL CONFIGURATION (Admin Only)
// =============================================================================

// GET /api/hotels -> List all hotels (Replaces /api/admin/get-all-hotels)
// GET /api/hotels -> List all hotels (Admin only)
// GET /api/hotels -> List all hotels (Admin only)
router.get("/", requireAdminApi, async (req, res) => {
  try {
    const hotels = await hotelService.getAllHotels();
    res.json(hotels);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotels." });
  }
});

// GET /api/hotels/mine -> List hotels for the current user
router.get("/mine", requireUserApi, async (req, res) => {
  try {
    const userRole = req.session.role;
    let query;
    let params = [];

    if (userRole === "super_admin" || userRole === "admin") {
      query = `SELECT hotel_id AS property_id, property_name, city FROM hotels ORDER BY property_name;`;
    } else {
      // Get internal ID
      const userRes = await pool.query("SELECT user_id FROM users WHERE cloudbeds_user_id = $1", [req.session.userId]);
      if (userRes.rows.length === 0) return res.json([]);
      const internalId = userRes.rows[0].user_id;

      query = `
        SELECT up.property_id, h.property_name, h.city
        FROM user_properties up
        JOIN hotels h ON up.property_id = h.hotel_id
        WHERE up.user_id = $1 OR up.user_id = $2::text
        ORDER BY h.property_name;
      `;
      params = [req.session.userId, internalId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching my properties:", error);
    res.status(500).json({ error: "Failed to fetch user properties." });
  }
});

// GET /api/hotels/:propertyId/details -> Specific Hotel Details
router.get("/:propertyId/details", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    // Authorization Check
    const hasAccess = await verifyPropertyAccess(req, propertyId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

    const result = await pool.query(
      `SELECT property_name, currency_code, tax_rate, tax_type, tax_name, category, city, hotel_id 
       FROM hotels WHERE hotel_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Hotel not found." });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotel details." });
  }
});

// PATCH /api/hotels/:propertyId/category -> Update Category
router.patch("/:propertyId/category", requireUserApi, async (req, res) => {
  const { propertyId } = req.params;
  const { category } = req.body;
  const validCategories = ["Economy", "Midscale", "Upper Midscale", "Luxury", "Hostel"];
  
  if (!validCategories.includes(category)) return res.status(400).json({ error: "Invalid category." });

  try {
    const hasAccess = await verifyPropertyAccess(req, propertyId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

    await pool.query("UPDATE hotels SET category = $1 WHERE hotel_id = $2", [category, propertyId]);
    res.json({ message: "Category updated." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update category." });
  }
});

// PATCH /api/hotels/:propertyId/tax-info -> Update Tax Info
router.patch("/:propertyId/tax-info", requireUserApi, async (req, res) => {
  const { propertyId } = req.params;
  const { rate, type, name } = req.body;

  try {
    const hasAccess = await verifyPropertyAccess(req, propertyId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

    await pool.query(
      "UPDATE hotels SET tax_rate = $1, tax_type = $2, tax_name = $3 WHERE hotel_id = $4",
      [rate, type, name, propertyId]
    );
    res.json({ message: "Tax info updated." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update tax info." });
  }
});

// GET /api/hotels/mine -> List hotels for the current user
router.get("/mine", requireUserApi, async (req, res) => {
  try {
    const userRole = req.session.role;
    let query;
    let params = [];

    if (userRole === "super_admin" || userRole === "admin") {
      query = `SELECT hotel_id AS property_id, property_name, city FROM hotels ORDER BY property_name;`;
    } else {
      // Get internal ID
      const userRes = await pool.query("SELECT user_id FROM users WHERE cloudbeds_user_id = $1", [req.session.userId]);
      if (userRes.rows.length === 0) return res.json([]);
      const internalId = userRes.rows[0].user_id;

      query = `
        SELECT up.property_id, h.property_name, h.city
        FROM user_properties up
        JOIN hotels h ON up.property_id = h.hotel_id
        WHERE up.user_id = $1 OR up.user_id = $2::text
        ORDER BY h.property_name;
      `;
      params = [req.session.userId, internalId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching my properties:", error);
    res.status(500).json({ error: "Failed to fetch user properties." });
  }
});

// GET /api/hotels/:propertyId/details -> Specific Hotel Details
router.get("/:propertyId/details", requireUserApi, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    // Authorization Check
    const hasAccess = await verifyPropertyAccess(req, propertyId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

    const result = await pool.query(
      `SELECT property_name, currency_code, tax_rate, tax_type, tax_name, category, city, hotel_id 
       FROM hotels WHERE hotel_id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Hotel not found." });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotel details." });
  }
});

// POST /api/hotels/category -> Update Category
router.post("/category", requireAdminApi, async (req, res) => {
  const { hotelId, category } = req.body;
  const validCategories = ["Hostel", "Economy", "Midscale", "Upper Midscale", "Luxury"];
  
  if (!hotelId) return res.status(400).json({ error: "Hotel ID is required." });
  if (!validCategories.includes(category)) return res.status(400).json({ error: "Invalid category." });

  try {
    const success = await hotelService.updateHotelCategory(hotelId, category);
    if (!success) return res.status(404).json({ error: "Hotel not found." });
    res.json({ message: "Category updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update category." });
  }
});

// POST /api/hotels/management -> Update Management Info & Sync Assets
router.post("/management", requireAdminApi, async (req, res) => {
  const { hotelId, field, value } = req.body;
  if (!["is_rockenue_managed", "management_group"].includes(field)) {
    return res.status(400).json({ error: "Invalid field." });
  }

  try {
    const success = await hotelService.updateHotelManagement(hotelId, field, value);
    if (!success) return res.status(404).json({ error: "Hotel not found." });
    res.json({ message: "Management info updated successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update management info." });
  }
});

// GET /api/hotels/management-groups
router.get("/management-groups", requireAdminApi, async (req, res) => {
  try {
    const groups = await hotelService.getManagementGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch management groups." });
  }
});

// POST /api/hotels/delete -> Full Disconnect
router.post("/delete", requireAdminApi, async (req, res) => {
  const { hotelId } = req.body;
  if (!hotelId) return res.status(400).json({ error: "Hotel ID is required." });

  try {
    // req.session.userId is needed to get the admin token for Cloudbeds disconnect
    await hotelService.deleteHotel(hotelId, req.session.userId);
    res.json({ success: true, message: "Hotel disconnected and data removed." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete hotel." });
  }
});

// =============================================================================
// 2. ROCKENUE ASSETS (Super Admin Only)
// Replaces rockenue.router.js portfolio endpoints
// =============================================================================

router.get("/assets", requireSuperAdminOnly, async (req, res) => {
  try {
    const assets = await hotelService.getRockenuePortfolio();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/assets", requireSuperAdminOnly, async (req, res) => {
  try {
    const newAsset = await hotelService.addRockenueAsset();
    res.status(201).json(newAsset);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.put("/assets/:id", requireSuperAdminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const updatedAsset = await hotelService.updateRockenueAsset(id, req.body);
    if (!updatedAsset) return res.status(404).json({ error: "Property not found." });
    res.json(updatedAsset);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/assets/:id", requireSuperAdminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const success = await hotelService.deleteRockenueAsset(id);
    if (!success) {
      return res.status(404).json({ 
        error: 'Property not found or is a "Live" property and cannot be deleted.' 
      });
    }
    res.json({ message: "Off-Platform property deleted." });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =============================================================================
// 3. COMPETITIVE SETS (Admin Only)
// Replaces admin.router.js compset endpoints
// =============================================================================

router.get("/:hotelId/compset", requireAdminApi, async (req, res) => {
  try {
    const compSet = await hotelService.getCompSet(req.params.hotelId);
    res.json(compSet);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch competitive set." });
  }
});

router.post("/:hotelId/compset", requireAdminApi, async (req, res) => {
  const { competitorIds } = req.body;
  if (!Array.isArray(competitorIds)) {
    return res.status(400).json({ error: "competitorIds must be an array." });
  }
  try {
    await hotelService.setCompSet(req.params.hotelId, competitorIds);
    res.json({ message: "Successfully updated competitive set." });
  } catch (error) {
    res.status(500).json({ error: "Failed to update competitive set." });
  }
});

// =============================================================================
// 4. BUDGETS & BENCHMARKS (User API)
// Replaces budgets.router.js
// =============================================================================

router.get("/:hotelId/budgets/:year", requireUserApi, async (req, res) => {
  const { hotelId, year } = req.params;
  
  if (isNaN(parseInt(hotelId)) || isNaN(parseInt(year))) {
    return res.status(400).json({ error: "Invalid parameters." });
  }

  try {
    const hasAccess = await verifyPropertyAccess(req, hotelId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: Access denied to this property." });
    }

    const budgets = await hotelService.getBudgets(hotelId, parseInt(year));
    res.json(budgets);
  } catch (error) {
    console.error("Error fetching budget:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/:hotelId/budgets/:year", requireUserApi, async (req, res) => {
  const { hotelId, year } = req.params;
  const budgetData = req.body;

  if (isNaN(parseInt(hotelId)) || isNaN(parseInt(year))) {
    return res.status(400).json({ error: "Invalid parameters." });
  }
  if (!Array.isArray(budgetData) || budgetData.length !== 12) {
    return res.status(400).json({ error: "Invalid budget data format." });
  }

  try {
    const hasAccess = await verifyPropertyAccess(req, hotelId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: Access denied to this property." });
    }

    await hotelService.saveBudgets(hotelId, parseInt(year), budgetData);
    res.json({ message: `Budget for ${year} saved successfully.` });
  } catch (error) {
    console.error("Error saving budget:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/:hotelId/benchmarks/:month/:year", requireUserApi, async (req, res) => {
  const { hotelId, month, year } = req.params;
  
  try {
    const hasAccess = await verifyPropertyAccess(req, hotelId);
    if (!hasAccess) {
      return res.status(403).json({ error: "Forbidden: Access denied to this property." });
    }

    const benchmarks = await getBenchmarks(parseInt(hotelId), month, year);
    res.json(benchmarks);
  } catch (error) {
    console.error("Error fetching benchmarks:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;