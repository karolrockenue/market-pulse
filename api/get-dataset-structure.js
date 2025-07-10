// api/get-dataset-structure.js
const fetch = require("node-fetch").default || require("node-fetch");

// Re-usable authentication function
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

  const response = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await response.json();
  if (!tokenData.access_token) {
    throw new Error("Failed to authenticate with Cloudbeds.");
  }
  return tokenData.access_token;
}

// Main handler for our new serverless function
module.exports = async (request, response) => {
  try {
    const accessToken = await getCloudbedsAccessToken();

    // Get the dataset ID from the query parameter (e.g., /api/get-dataset-structure?id=3)
    const { id } = request.query;
    if (!id) {
      return response.status(400).json({ error: "Dataset ID is required." });
    }

    const targetUrl = `https://api.cloudbeds.com/datainsights/v1.1/datasets/${id}/multi-levels`;

    const cloudbedsApiResponse = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
      },
    });

    const data = await cloudbedsApiResponse.json();

    if (!cloudbedsApiResponse.ok) {
      throw new Error(`Cloudbeds API Error: ${JSON.stringify(data)}`);
    }

    return response.status(200).json(data);
  } catch (error) {
    return response.status(500).json({ success: false, error: error.message });
  }
};
