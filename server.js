// server.js (Updated to split 'Us' vs 'Them' and fix timezone bug)
require("dotenv").config();
const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const path = require("path");
const { Client } = require("pg");

const app = express();
app.use(express.json());

// --- API ROUTES ---

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

// Endpoint for the live API dashboard query (no changes)
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

// Endpoint to get hotel details from Cloudbeds API (no changes)
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

// --- MODIFIED ENDPOINT: Fetches data for OUR hotel ONLY ---
app.get("/api/metrics-from-db", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const ourHotelId = parseInt(process.env.CLOUDBEDS_PROPERTY_ID, 10);
  try {
    await client.connect();

    // --- FIX: Corrected date handling to avoid timezone bugs ---
    const { startDate, days } = req.query;
    const finalStartDate = startDate || new Date().toISOString().split("T")[0];
    const numDays = parseInt(days, 10) || 7;
    const startDateObjUTC = new Date(finalStartDate + "T00:00:00Z");
    const endDateObjUTC = new Date(startDateObjUTC);
    endDateObjUTC.setDate(startDateObjUTC.getDate() + (numDays - 1));
    const finalEndDate = endDateObjUTC.toISOString().split("T")[0];
    // --- END FIX ---

    const query = `
      SELECT
        TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
        adr, occupancy_direct, revpar, rooms_sold, capacity_count,
        total_revenue, total_room_revenue, total_other_revenue, room_rate_total,
        taxes_total, fees_total, misc_income, adults_count, children_count,
        room_guest_count, blocked_rooms_count, out_of_service_rooms_count
      FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date >= $2 AND stay_date <= $3
      ORDER BY stay_date ASC;
    `;
    const result = await client.query(query, [
      ourHotelId,
      finalStartDate,
      finalEndDate,
    ]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch metrics from database" });
  } finally {
    await client.end();
  }
});

// --- NEW ENDPOINT: Fetches data for ALL COMPETITORS ---
app.get("/api/competitor-metrics", async (req, res) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const ourHotelId = parseInt(process.env.CLOUDBEDS_PROPERTY_ID, 10);
  try {
    await client.connect();

    // --- FIX: Corrected date handling to avoid timezone bugs ---
    const { startDate, days } = req.query;
    const finalStartDate = startDate || new Date().toISOString().split("T")[0];
    const numDays = parseInt(days, 10) || 7;
    const startDateObjUTC = new Date(finalStartDate + "T00:00:00Z");
    const endDateObjUTC = new Date(startDateObjUTC);
    endDateObjUTC.setDate(startDateObjUTC.getDate() + (numDays - 1));
    const finalEndDate = endDateObjUTC.toISOString().split("T")[0];
    // --- END FIX ---

    const query = `
      SELECT
        hotel_id,
        TO_CHAR(stay_date, 'YYYY-MM-DD') AS stay_date,
        adr, occupancy_direct, revpar, rooms_sold, capacity_count
      FROM daily_metrics_snapshots
      WHERE hotel_id != $1 AND stay_date >= $2 AND stay_date <= $3
      ORDER BY stay_date, hotel_id ASC;
    `;
    const result = await client.query(query, [
      ourHotelId,
      finalStartDate,
      finalEndDate,
    ]);
    res.json(result.rows);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch competitor metrics from database" });
  } finally {
    await client.end();
  }
});

// --- STATIC AND FALLBACK ROUTES ---
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath));
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// --- SERVER LISTENING LOGIC ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
