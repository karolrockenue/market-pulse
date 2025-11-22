const express = require("express");
const router = express.Router();

// POST /api/webhooks
// Public endpoint for Cloudbeds events
router.post("/", async (req, res) => {
  try {
    console.log("--- [WEBHOOK RECEIVED] ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    // This logs the exact structure you are looking for
    console.log("Payload:", JSON.stringify(req.body, null, 2)); 

    // Always return 200 OK quickly, otherwise Cloudbeds will retry
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;