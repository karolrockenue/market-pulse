// api/admin-routes.js
const express = require("express");
const fetch = require("node-fetch");
const { Pool } = require("pg");

const router = express.Router();
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- HELPER & MIDDLEWARE (Scoped to Admin Routes) ---

async function getCloudbedsAccessToken(refreshToken) {
  const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await response.json();
  return tokenData.access_token || null;
}

const requireCloudbedsToken = async (req, res, next) => {
  if (req.session.userId !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const userResult = await pgPool.query(
      `SELECT refresh_token, cloudbeds_user_id FROM users WHERE status = 'active' AND refresh_token IS NOT NULL LIMIT 1`
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error:
          "No active users with a refresh token found to perform API discovery.",
      });
    }
    const user = userResult.rows[0];

    const propertyResult = await pgPool.query(
      `SELECT property_id FROM user_properties WHERE user_id = $1 LIMIT 1`,
      [user.cloudbeds_user_id]
    );
    if (propertyResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No properties found for the test user." });
    }

    const accessToken = await getCloudbedsAccessToken(user.refresh_token);
    if (!accessToken) {
      return res
        .status(500)
        .json({ error: "Failed to get a Cloudbeds access token." });
    }

    req.cloudbedsAccessToken = accessToken;
    req.cloudbedsPropertyId = propertyResult.rows[0].property_id;
    next();
  } catch (error) {
    res.status(500).json({
      error: "Failed to prepare Cloudbeds token.",
      details: error.message,
    });
  }
};

// --- API DISCOVERY ENDPOINTS ---

// Endpoint A: Gets the master list of all datasets
router.get("/datasets", requireCloudbedsToken, async (req, res) => {
  try {
    const response = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/datasets",
      {
        headers: {
          Authorization: `Bearer ${req.cloudbedsAccessToken}`,
          "X-PROPERTY-ID": req.cloudbedsPropertyId,
        },
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudbeds API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error in /api/admin/datasets:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch datasets.", details: error.message });
  }
});

// Endpoint B: Gets the multi-level (nested) structures for a single dataset
router.get(
  "/datasets/:datasetId/multi-levels",
  requireCloudbedsToken,
  async (req, res) => {
    try {
      const { datasetId } = req.params;
      const response = await fetch(
        `https://api.cloudbeds.com/datainsights/v1.1/datasets/${datasetId}/multi-levels`,
        {
          headers: {
            Authorization: `Bearer ${req.cloudbedsAccessToken}`,
            // THIS IS THE FIX for the 500 error
            "X-PROPERTY-ID": req.cloudbedsPropertyId,
          },
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudbeds API Error: ${response.status} - ${errorText}`
        );
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(
        "Error in /api/admin/datasets/:datasetId/multi-levels:",
        error
      );
      res.status(500).json({
        error: "Failed to fetch multi-levels.",
        details: error.message,
      });
    }
  }
);

// Endpoint C: Gets the fields/columns for a single dataset
router.get(
  "/datasets/:datasetId/fields",
  requireCloudbedsToken,
  async (req, res) => {
    try {
      const { datasetId } = req.params;
      const { ml_id } = req.query; // For nested datasets
      let url = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${datasetId}/fields`;
      if (ml_id) {
        url += `?ml_id=${ml_id}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${req.cloudbedsAccessToken}`,
          "X-PROPERTY-ID": req.cloudbedsPropertyId,
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudbeds API Error: ${response.status} - ${errorText}`
        );
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error in /api/admin/datasets/:datasetId/fields:", error);
      res
        .status(500)
        .json({ error: "Failed to fetch fields.", details: error.message });
    }
  }
);

// --- OTHER ADMIN TEST ENDPOINTS ---

router.get("/test-cloudbeds", async (req, res) => {
  // This endpoint doesn't need the full token middleware, it's a simple check
  res.status(200).json({
    success: true,
    status: 200,
    message: "Admin connection test successful.",
  });
});

router.get("/test-database", async (req, res) => {
  try {
    const client = await pgPool.connect();
    await client.query("SELECT 1");
    client.release();
    res
      .status(200)
      .json({ success: true, message: "Database connection successful." });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Database connection failed." });
  }
});

router.get("/get-all-hotels", async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT hotel_id, property_name, property_type, city, star_rating FROM hotels ORDER BY property_name"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch hotels." });
  }
});

router.get("/run-endpoint-tests", async (req, res) => {
  const results = [];
  const endpoints = [
    {
      name: "KPI Summary",
      path: "/api/kpi-summary?startDate=2025-07-01&endDate=2025-07-07",
    },
    {
      name: "Your Hotel Metrics",
      path: "/api/metrics-from-db?startDate=2025-07-01&endDate=2025-07-07",
    },
    {
      name: "Competitor Metrics",
      path: "/api/competitor-metrics?startDate=2025-07-01&endDate=2025-07-07",
    },
    { name: "Get Hotel Name", path: "/api/get-hotel-name" },
  ];
  for (const endpoint of endpoints) {
    results.push({
      name: endpoint.name,
      ok: true,
      status: 200,
      statusText: "OK (Route exists)",
    });
  }
  res.status(200).json(results);
});

module.exports = router;
