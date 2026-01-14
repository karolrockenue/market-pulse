/**
 * @file bridge.router.js
 * @brief Dedicated Router for Sentinel AI Bridge (Python <-> Node).
 * Protected by API Key.
 */
const express = require("express");
const router = express.Router();
const bridgeAuth = require("../utils/bridgeAuth");
const bridgeService = require("../services/sentinel.bridge.service");

// 1. Apply Security Layer (All routes require x-api-key)
router.use(bridgeAuth);

/**
 * GET /api/bridge/context/:hotelId
 * The "Eyes": Returns full state (inventory, config, pace) for the AI to analyze.
 */
router.get("/context/:hotelId", async (req, res) => {
  try {
    const { hotelId } = req.params;
    const context = await bridgeService.getHotelContext(hotelId);

    res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error(
      `[Bridge] Context fetch failed for ${req.params.hotelId}:`,
      error
    );
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/bridge/decisions
 * The "Hands": Receives rate predictions from AI and stores them in shadow table.
 */
router.post("/decisions", async (req, res) => {
  try {
    const decisions = req.body; // Expects Array of objects

    const result = await bridgeService.saveDecisions(decisions);

    res.status(200).json({
      success: true,
      message: `Successfully stored ${result.saved} predictions.`,
    });
  } catch (error) {
    console.error("[Bridge] Decision save failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
