// test-hotel-endpoint.js
// A standalone script to test the newly discovered properties endpoint.
require("dotenv").config();
const fetch = require("node-fetch").default || require("node-fetch");

// --- AUTHENTICATION LOGIC ---
async function getCloudbedsAccessToken() {
  console.log("Authenticating with Cloudbeds...");
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

  try {
    const response = await fetch(
      "https://hotels.cloudbeds.com/api/v1.1/access_token",
      { method: "POST", body: params }
    );
    const data = await response.json();
    if (data.access_token) {
      console.log("✅ Authentication successful.\n");
      return data.access_token;
    } else {
      console.error("❌ Authentication failed:", data);
      return null;
    }
  } catch (error) {
    console.error("❌ Critical error during authentication:", error);
    return null;
  }
}

// --- MAIN TESTING FUNCTION ---
async function findHotelEndpoint() {
  const accessToken = await getCloudbedsAccessToken();
  if (!accessToken) {
    console.log("Halting test due to authentication failure.");
    return;
  }

  // NEW: The single, correct URL constructed from the screenshot and working scripts.
  const correctUrl =
    "https://api.cloudbeds.com/datainsights/v1.1/me/properties";

  // NEW: The required headers, including X-PROPERTY-ID.
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
  };

  console.log("--- Starting Final Endpoint Test ---\n");
  console.log(`-----------------------------------------`);
  console.log(`▶️  Testing GET: ${correctUrl}`);
  console.log(`   With Headers:`, JSON.stringify(headers, null, 2));

  try {
    const response = await fetch(correctUrl, {
      method: "GET",
      headers: headers,
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const responseData = await response.json();
      console.log(`   ✅ SUCCESS! This endpoint is valid and returned data.`);
      console.log("   RAW JSON RESPONSE:");
      console.log(JSON.stringify(responseData, null, 2));
    } else {
      const errorText = await response.text();
      console.log(`   ❌ FAILED with status ${response.status}.`);
      console.log(`   Error Body: ${errorText}`);
    }
  } catch (error) {
    console.error(`   ❌ CRITICAL ERROR testing this endpoint:`, error.message);
  }
  console.log(`-----------------------------------------\n`);
  console.log("--- Test Complete ---");
}

// Run the discovery script
findHotelEndpoint();
