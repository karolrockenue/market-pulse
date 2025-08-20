// /api/adapters/operaAdapter.js

// Using 'axios' for making HTTP requests, a standard choice for Node.js applications.
// This will be used to communicate with the Oracle Hospitality Integration Platform (OHIP) API.
const axios = require("axios");

// Retrieve the Oracle credentials and the domain URL from the environment variables we configured.
const { OPERA_CLIENT_ID, OPERA_CLIENT_SECRET, OPERA_DOMAIN_URL } = process.env;

/**
 * The operaAdapter object encapsulates all communication with the OHIP API.
 * In line with the project's adapter pattern, the main application logic
 * will call functions on this object without needing to know the specific details
 * of the OHIP API implementation.
 */
const operaAdapter = {
  /**
   * Exchanges an authorization code, received from the OHIP callback, for access and refresh tokens.
   * @param {string} code The authorization code from Oracle's redirect.
   * @returns {Promise<object>} A promise that resolves to the token data (access_token, refresh_token, etc.).
   */
  async exchangeCodeForTokens(code) {
    // The token endpoint URL is constructed from the base domain URL stored in our .env file.
    const tokenUrl = `${OPERA_DOMAIN_URL}/oauth2/v1/token`;

    // The redirect URI must exactly match the one used in the initial authorization request.
    const redirectUri =
      process.env.VERCEL_ENV === "production"
        ? "https://www.market-pulse.io/api/auth/opera/callback"
        : "http://localhost:3000/api/auth/opera/callback";

    // The payload for the token exchange POST request, as required by the OAuth 2.0 spec.
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    });

    // Oracle's OAuth 2.0 flow requires the client ID and secret to be Base64 encoded
    // and sent in the Authorization header, which is standard HTTP Basic Authentication.
    const credentials = Buffer.from(
      `${OPERA_CLIENT_ID}:${OPERA_CLIENT_SECRET}`
    ).toString("base64");

    try {
      // We use axios to make the POST request to the token endpoint.
      const response = await axios.post(tokenUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
      });
      // If successful, the response data will contain our tokens. We return it.
      return response.data;
    } catch (error) {
      // If the request fails, log the detailed error message from Oracle for easier debugging.
      console.error(
        "Error exchanging OHIP code for tokens:",
        error.response ? error.response.data : error.message
      );
      // Rethrow the error so it can be caught and handled by the route that called this function.
      throw new Error("Failed to exchange authorization code for tokens.");
    }
  },
};

// Export the adapter so it can be used by other parts of the application, such as the auth router.
module.exports = operaAdapter;
