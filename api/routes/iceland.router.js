const express = require("express");
const { requireAdminApi } = require("../utils/middleware");
const icelandService = require("../services/iceland.service");

const router = express.Router();

router.use(requireAdminApi);

router.get("/dashboard", async (_req, res) => {
  try {
    const data = await icelandService.getDashboard();
    res.json(data);
  } catch (err) {
    console.error("[Iceland] dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
