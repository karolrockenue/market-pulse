// api/get-all-datasets.js
const fetch = require("node-fetch").default || require("node-fetch");

// Re-usable function to get an access token using our system's refresh token.
// This is a simplified version for our admin tool.
async function getCloudbedsAccessToken() {
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REFRESH_TOKEN, // Using the system-wide refresh token for this tool
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
    throw new Error("Failed to authenticate with Cloudbeds.");
  }
  return tokenData.access_token;
}

// The main handler for our new serverless function.
module.exports = async (request, response) => {
  try {
    const accessToken = await getCloudbedsAccessToken();

    const cloudbedsApiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/datasets",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID, // Required header
        },
      }
    );

    if (!cloudbedsApiResponse.ok) {
      const errorBody = await cloudbedsApiResponse.text();
      throw new Error(
        `Cloudbeds API Error: ${cloudbedsApiResponse.status} ${errorBody}`
      );
    }

    const data = await cloudbedsApiResponse.json();

    // Send the data from Cloudbeds back to our frontend.
    response.status(200).json(data);
  } catch (error) {
    console.error("Error in /api/get-all-datasets:", error);
    response.status(500).json({ error: error.message });
  }
};
