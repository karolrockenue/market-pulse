// api/get-all-datasets.js
const fetch = require("node-fetch").default || require("node-fetch");

async function getCloudbedsAccessToken() {
  console.log("[get-all-datasets] Attempting to get access token...");
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

  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    {
      method: "POST",
      body: params,
    }
  );

  const tokenData = await response.json();
  if (!tokenData.access_token) {
    console.error(
      "[get-all-datasets] Failed to authenticate with Cloudbeds:",
      tokenData
    );
    throw new Error("Failed to authenticate with Cloudbeds.");
  }
  console.log("[get-all-datasets] Access token received successfully.");
  return tokenData.access_token;
}

module.exports = async (request, response) => {
  console.log(
    `[get-all-datasets] Function invoked at: ${new Date().toISOString()}`
  );
  try {
    const accessToken = await getCloudbedsAccessToken();
    const targetUrl = "https://api.cloudbeds.com/datainsights/v1.1/datasets";

    console.log(`[get-all-datasets] Calling Cloudbeds API: ${targetUrl}`);
    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
      },
    });
    console.log(
      `[get-all-datasets] Cloudbeds API responded with status: ${cloudbedsApiResponse.status}`
    );

    if (!cloudbedsApiResponse.ok) {
      const errorBody = await cloudbedsApiResponse.text();
      console.error(
        `[get-all-datasets] Cloudbeds API Error: ${cloudbedsApiResponse.status}`,
        errorBody
      );
      // Important: Send a structured JSON error back to our frontend
      return response.status(cloudbedsApiResponse.status).json({
        success: false,
        error: "Failed to fetch from Cloudbeds API.",
        details: errorBody,
      });
    }

    const data = await cloudbedsApiResponse.json();
    console.log(
      "[get-all-datasets] Successfully fetched data, sending to client."
    );
    return response.status(200).json(data);
  } catch (error) {
    console.error("[get-all-datasets] A critical error occurred:", error);
    // Important: Send a structured JSON error back to our frontend
    return response.status(500).json({ success: false, error: error.message });
  }
};
