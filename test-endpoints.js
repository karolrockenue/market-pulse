// test-endpoints.js
// A standalone script to test the newly discovered insights query endpoint.
require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// --- Authentication Logic ---
let accessToken = null;

async function getNewAccessToken() {
  console.log("Authenticating with Cloudbeds...");
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REFRESH_TOKEN,
  } = process.env;
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("client_id", CLOUDBEDS_CLIENT_ID);
  params.append("client_secret", CLOUDBEDS_CLIENT_SECRET);
  params.append("refresh_token", CLOUDBEDS_REFRESH_TOKEN);

  try {
    const response = await fetch(
      "https://hotels.cloudbeds.com/api/v1.1/access_token",
      {
        method: "POST",
        body: params,
      }
    );
    const data = await response.json();
    if (data.access_token) {
      accessToken = data.access_token;
      console.log("✅ Authentication successful.\n");
      return true;
    } else {
      console.error("❌ Authentication failed. Response:", data);
      return false;
    }
  } catch (error) {
    console.error("❌ Critical error during authentication:", error);
    return false;
  }
}

// --- Main Testing Function ---
async function runTests() {
  console.log("--- Starting Cloudbeds Insights Query Test ---");

  const authenticated = await getNewAccessToken();
  if (!authenticated) {
    console.log("\nHalting test because authentication failed.");
    return;
  }

  // --- Define the Query Payload ---
  const insightsPayload = {
    property_ids: [parseInt(process.env.CLOUDBEDS_PROPERTY_ID)],
    dataset_id: 7, // Occupancy dataset
    filters: {
      and: [
        {
          cdf: { column: "stay_date" },
          operator: "greater_than_or_equal",
          value:
            new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0] +
            "T00:00:00.000Z", // Last 7 days
        },
        {
          cdf: { column: "stay_date" },
          operator: "less_than_or_equal",
          value: new Date().toISOString().split("T")[0] + "T00:00:00.000Z",
        },
      ],
    },
    columns: [
      { cdf: { column: "adr" }, metrics: ["mean"] },
      { cdf: { column: "revpar" }, metrics: ["mean"] },
      { cdf: { column: "occupancy" }, metrics: ["mean"] },
      { cdf: { column: "total_revenue" }, metrics: ["sum"] },
    ],
    settings: { details: false, totals: false },
    group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
  };

  // --- Define the Correct Endpoint and Headers ---
  const endpointUrl =
    "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run";
  const requestHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
  };

  console.log(`\n-----------------------------------------`);
  console.log(`▶️  Testing POST to: ${endpointUrl}`);
  console.log(`   With Headers:`, JSON.stringify(requestHeaders, null, 2));
  console.log(`   With Payload:`, JSON.stringify(insightsPayload, null, 2));

  try {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(insightsPayload),
    });

    console.log(`\n   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      // Status is 200-299
      console.log(
        `   ✅ SUCCESS! This endpoint is valid and accepted the payload.`
      );
      const data = await response.json();
      console.log("   Response Preview:", JSON.stringify(data, null, 2));
    } else {
      console.log(`   ❌ FAILED with status ${response.status}.`);
      const errorText = await response.text();
      console.log("   Error Response:", errorText);
    }
  } catch (error) {
    console.error(`   ❌ CRITICAL ERROR testing this endpoint:`, error.message);
  }

  console.log(`\n-----------------------------------------`);
  console.log("--- Test Complete ---");
}

// --- Run the script ---
runTests();
