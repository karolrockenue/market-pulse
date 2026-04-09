// api/routes/hotels.router.js

const express = require("express");
const router = express.Router();
const pool = require("../utils/db");
const hotelService = require("../services/hotel.service");
const {
  requireAdminApi,
  requireSuperAdminOnly,
  requireUserApi,
  requireRatesAccess
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
    const includeDisconnected = req.query.includeDisconnected === "true";
    const disconnectedFilter = includeDisconnected ? "" : "WHERE is_disconnected = false";
    const disconnectedFilterAnd = includeDisconnected ? "" : "AND h.is_disconnected = false";
    let query;
    let params = [];

    if (userRole === "super_admin" || userRole === "admin") {
      query = `SELECT hotel_id AS property_id, property_name, city, is_disconnected FROM hotels ${disconnectedFilter} ORDER BY property_name;`;
    } else {
      // Get internal ID
      const userRes = await pool.query("SELECT user_id FROM users WHERE cloudbeds_user_id = $1", [req.session.userId]);
      if (userRes.rows.length === 0) return res.json([]);
      const internalId = userRes.rows[0].user_id;

      query = `
        SELECT up.property_id, h.property_name, h.city, h.is_disconnected
        FROM user_properties up
        JOIN hotels h ON up.property_id = h.hotel_id
        WHERE (up.user_id = $1 OR up.user_id = $2::text) ${disconnectedFilterAnd}
        ORDER BY h.property_name;
      `;
      params = [req.session.userId, internalId];
    }

    const result = await pool.query(query, params);
    console.log(`[DEBUG /mine] userId=${req.session.userId} role=${userRole} params=${JSON.stringify(params)} resultCount=${result.rows.length}`);
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

// POST /api/hotels/:hotelId/disconnect -> Soft Disconnect (preserves data)
router.post("/:hotelId/disconnect", requireUserApi, async (req, res) => {
  const { hotelId } = req.params;
  try {
    const hasAccess = await verifyPropertyAccess(req, hotelId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

    const result = await pool.query(
      "UPDATE hotels SET is_disconnected = true WHERE hotel_id = $1 AND is_disconnected = false",
      [hotelId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Hotel not found or already disconnected." });
    res.json({ success: true, message: "Hotel disconnected. Data preserved." });
  } catch (error) {
    console.error("Disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect hotel." });
  }
});

// POST /api/hotels/:hotelId/reconnect -> Reconnect a soft-disconnected hotel
router.post("/:hotelId/reconnect", requireUserApi, async (req, res) => {
  const { hotelId } = req.params;
  try {
    const hasAccess = await verifyPropertyAccess(req, hotelId);
    if (!hasAccess) return res.status(403).json({ error: "Access denied." });

    const result = await pool.query(
      "UPDATE hotels SET is_disconnected = false WHERE hotel_id = $1 AND is_disconnected = true",
      [hotelId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Hotel not found or already active." });
    res.json({ success: true, message: "Hotel reconnected." });
  } catch (error) {
    console.error("Reconnect error:", error);
    res.status(500).json({ error: "Failed to reconnect hotel." });
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

router.get("/assets", requireUserApi, async (req, res) => {
  const role = req.session.role;
  try {
    const allAssets = await hotelService.getRockenuePortfolio();

    // Super admins see everything
    if (role === "super_admin" || role === "admin") {
      return res.json(allAssets);
    }

    // Rate-view users see only their linked hotels
    const userCheck = await pool.query(
      "SELECT can_view_rates FROM users WHERE cloudbeds_user_id = $1",
      [req.session.userId]
    );
    if (!userCheck.rows.length || !userCheck.rows[0].can_view_rates) {
      return res.status(403).json({ error: "Access denied." });
    }

    const { rows } = await pool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1 OR user_id = $2::text",
      [req.user.cloudbedsId, req.user.internalId]
    );
    const allowedIds = new Set(rows.map(r => r.property_id));
    res.json(allAssets.filter(a => allowedIds.has(a.market_pulse_hotel_id)));
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
    console.error("[PUT /assets/:id] Error:", error);
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

// GET /api/hotels/:hotelId/bookings?days=14
// Returns daily summary + individual booking details for the Bookings Report.
router.get("/:hotelId/bookings", requireUserApi, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.hotelId);
    const days = parseInt(req.query.days) || 14;

    // Fetch reservations within the date range, grouped by booking_date
    const result = await pool.query(
      `SELECT id, guest_name, room_type, check_in, check_out, nights,
              source, avg_nightly_rate, total_rate, status, booking_date
       FROM reservations
       WHERE hotel_id = $1
         AND booking_date >= CURRENT_DATE - $2::int
       ORDER BY booking_date DESC, created_at DESC`,
      [hotelId, days]
    );

    // Group by booking_date
    const dayMap = {};
    const today = new Date().toISOString().split("T")[0];

    for (const row of result.rows) {
      const key = row.booking_date instanceof Date
        ? row.booking_date.toISOString().split("T")[0]
        : row.booking_date;

      if (!dayMap[key]) {
        const d = new Date(key + "T00:00:00");
        dayMap[key] = {
          dateKey: key,
          dateStr: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
          isToday: key === today,
          bookings: 0,
          roomNights: 0,
          totalRevenue: 0,
          details: [],
        };
      }

      const day = dayMap[key];
      const isCancelled = (row.status || '').toLowerCase().includes('cancel');

      day.bookings += 1;
      // Exclude cancelled bookings from ADR/revenue/room nights totals
      if (!isCancelled) {
        day.roomNights += row.nights || 0;
        day.totalRevenue += parseFloat(row.total_rate) || 0;
      }
      day.details.push({
        id: row.id,
        guestName: row.guest_name || row.id,
        roomType: row.room_type,
        checkIn: row.check_in,
        checkOut: row.check_out,
        nights: row.nights,
        source: row.source,
        avgNightlyRate: parseFloat(row.avg_nightly_rate) || 0,
        totalRate: parseFloat(row.total_rate) || 0,
        status: row.status,
      });
    }

    // Sort details: confirmed/active first, cancelled last
    const statusOrder = (s) => {
      const lower = (s || '').toLowerCase();
      if (lower.includes('cancel')) return 3;
      if (lower.includes('checked_out') || lower.includes('processed')) return 2;
      if (lower.includes('checked_in') || lower.includes('started')) return 1;
      return 0; // confirmed at top
    };

    // Convert to sorted array and compute ADR
    const days_arr = Object.values(dayMap)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .map((d) => {
        d.details.sort((a, b) => statusOrder(a.status) - statusOrder(b.status));
        return {
          ...d,
          adr: d.roomNights > 0 ? Math.round(d.totalRevenue / d.roomNights) : 0,
          revenue: Math.round(d.totalRevenue),
        };
      });

    res.json({ days: days_arr });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;