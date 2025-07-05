// server.js (Final Corrected Version)
require("dotenv").config();
const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const path = require("path");
const { Client } = require("pg");

const app = express();
app.use(express.json());

// --- API ROUTES ARE NOW DEFINED FIRST ---

// Helper function for Cloudbeds API authentication
async function getCloudbedsAccessToken() {
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REFRESH_TOKEN,
  } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: CLOUDBEDS_REFRESH_TOKEN,
  });
  const tokenResponse = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error("Authentication failed");
  return tokenData.access_token;
}

// Endpoint for the live API dashboard query
app.post("/api/explore", async (req, res) => {
  try {
    const accessToken = await getCloudbedsAccessToken();
    const { CLOUDBEDS_PROPERTY_ID } = process.env;
    const insightsPayload = {
      ...req.body,
      property_ids: [parseInt(CLOUDBEDS_PROPERTY_ID)],
    };
    const apiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-PROPERTY-ID": CLOUDBEDS_PROPERTY_ID,
        },
        body: JSON.stringify(insightsPayload),
      }
    );
    const data = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(data.message || "API Error");
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Insights API Query Failed", message: error.message });
  }
});

// Endpoint to get hotel details from Cloudbeds API
app.get("/api/hotel-details", async (req, res) => {
  try {
    const accessToken = await getCloudbedsAccessToken();
    const { CLOUDBEDS_PROPERTY_ID } = process.env;
    const response = await fetch(
      `https://api.cloudbeds.com/api/v1.1/getHotelDetails?propertyID=${CLOUDBEDS_PROPERTY_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "API Error");
    res.json(data);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch hotel details", message: error.message });
  }
});

// Endpoint to get metrics from our own database
app.get("/api/metrics-from-db", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();

    // Use today's date for a dynamic 7-day forecast
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 7);

    const startDate = today.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];

    // --- FIX #2: FORMAT THE DATE DIRECTLY IN THE SQL QUERY ---
    const query = `
      SELECT
        TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
        adr, occupancy_direct, revpar, rooms_sold, capacity_count,
        total_revenue, total_room_revenue, total_other_revenue, room_rate_total,
        taxes_total, fees_total, misc_income, adults_count, children_count,
        room_guest_count, blocked_rooms_count, out_of_service_rooms_count
      FROM daily_metrics_snapshots
      WHERE stay_date >= $1 AND stay_date <= $2
      ORDER BY stay_date ASC;
    `;
    const result = await client.query(query, [startDate, endDate]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  } finally {
    await client.end();
  }
});

// --- STATIC AND FALLBACK ROUTES ARE NOW LAST ---
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));

// This route ensures the root URL serves index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// --- SERVER LISTENING LOGIC ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
