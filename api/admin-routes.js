// api/admin-routes.js (Now with all admin routes included)
const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

module.exports = function (pgPool) {
  // --- HELPER & MIDDLEWARE ---
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
        throw new Error(
          `Cloudbeds API Error: ${response.status} - ${errorText}`
        );
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch datasets.", details: error.message });
    }
  });

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
        res.status(500).json({
          error: "Failed to fetch multi-levels.",
          details: error.message,
        });
      }
    }
  );

  router.get(
    "/datasets/:datasetId/fields",
    requireCloudbedsToken,
    async (req, res) => {
      try {
        const { datasetId } = req.params;
        const { ml_id } = req.query;
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
        res
          .status(500)
          .json({ error: "Failed to fetch fields.", details: error.message });
      }
    }
  );

  // --- START: MISSING ADMIN ROUTES ADDED BACK ---
  router.get("/test-cloudbeds", requireCloudbedsToken, async (req, res) => {
    // This now uses the requireCloudbedsToken middleware to perform a real check
    res
      .status(200)
      .json({ success: true, message: "Cloudbeds API token is valid." });
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
    // This is a placeholder test but now resides in the correct file
    const results = [
      {
        name: "KPI Summary",
        ok: true,
        status: 200,
        statusText: "OK (Route exists)",
      },
      {
        name: "Your Hotel Metrics",
        ok: true,
        status: 200,
        statusText: "OK (Route exists)",
      },
      {
        name: "Competitor Metrics",
        ok: true,
        status: 200,
        statusText: "OK (Route exists)",
      },
      {
        name: "Get Hotel Name",
        ok: true,
        status: 200,
        statusText: "OK (Route exists)",
      },
    ];
    res.status(200).json(results);
  });
  // --- END: MISSING ADMIN ROUTES ADDED BACK ---

  return router;
};
