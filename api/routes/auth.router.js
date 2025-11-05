// /api/routes/auth.router.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const pgPool = require("../utils/db");
const { getMagicLinkEmailHTML } = require("../utils/emailTemplates.js"); // [NEW] Import our new template function

const { requireUserApi } = require("../utils/middleware");

const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");
const mewsAdapter = require("../adapters/mewsAdapter");
const operaAdapter = require("../adapters/operaAdapter");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// --- AUTHENTICATION ENDPOINTS ---

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res
        .status(500)
        .json({ error: "Could not log out, please try again." });
    }
    res.clearCookie("connect.sid", {
      path: "/",
      domain: ".market-pulse.io",
    });
    res.status(200).json({ message: "Logged out successfully" });
  });
});

router.post("/login", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }
  try {
    const userResult = await pgPool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    const user = userResult.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date(Date.now() + 15 * 60 * 1000);
    await pgPool.query(
      "INSERT INTO magic_login_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)",
      [token, user.user_id, expires_at]
    );

  // --- DYNAMIC URL LOGIC ---
    // Create the correct baseUrl based on the environment.
    // This ensures magic links work on production, Vercel previews, and local development.
    let baseUrl;
// --- DYNAMIC URL LOGIC (v2) ---
    // Create the correct baseUrl based on the environment.

    if (process.env.VERCEL_ENV === 'production') {
      // Production environment
      baseUrl = 'https://www.market-pulse.io';
    } else if (process.env.VERCEL_BRANCH_URL) { 
      // Vercel "branch" preview environment (e.g., "feature-branch.vercel.app")
      // This is the URL the user is actually visiting.
      baseUrl = `https://${process.env.VERCEL_BRANCH_URL}`;
    } else if (process.env.VERCEL_URL) {
      // Fallback for other Vercel previews (e.g., the ...k3p69ah6r... URL)
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      // Local development environment
      baseUrl = 'http://localhost:3000'; // Frontend runs on 3000
    }
    // --- END DYNAMIC URL LOGIC (v2) ---

    // Construct the final link using the dynamic base URL
    const loginLink = `${baseUrl}/api/auth/magic-link-callback?token=${token}`;
    // --- END DYNAMIC URL LOGIC ---
const msg = {
  to: user.email,
  // [FIX] Use your verified SendGrid sending domain to avoid spam filters
  from: { name: "Market Pulse", email: "login@em4689.market-pulse.io" }, 
  subject: "Your Market Pulse Login Link",
  // [NEW] Call the imported function to get the robust HTML
  html: getMagicLinkEmailHTML(user.first_name || "there", loginLink),
};
    await sgMail.send(msg);
    res.status(200).json({ success: true, message: "Login link sent." });
  } catch (error) {
    console.error("Error during magic link login:", error);
    res.status(500).json({ error: "An internal error occurred." });
  }
});

// api/routes/auth.router.js

// api/routes/auth.router.js

router.get("/magic-link-callback", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Invalid or missing login token.");
  }
  try {
    const tokenResult = await pgPool.query(
      "SELECT * FROM magic_login_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL",
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res
        .status(400)
        .send(
          "Login link is invalid, has expired, or has already been used. Please request a new one."
        );
    }
    const loginToken = tokenResult.rows[0];

    const userResult = await pgPool.query(
      "SELECT user_id, cloudbeds_user_id, email, role FROM users WHERE user_id = $1",
      [loginToken.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send("Could not find a matching user account.");
    }
    const user = userResult.rows[0];

    await pgPool.query(
      "UPDATE magic_login_tokens SET used_at = NOW() WHERE token = $1",
      [loginToken.token]
    );

    req.session.regenerate((err) => {
      if (err) {
        console.error("[CRITICAL] Session regeneration failed:", err);
        return res.status(500).send("An error occurred during login.");
      }

      req.session.userId = user.cloudbeds_user_id;
      req.session.role = user.role;

      // api/routes/auth.router.js

      // api/routes/auth.router.js

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[CRITICAL] Session save failed:", saveErr);
          return res.status(500).send("An error occurred during login.");
        }

        // --- THE FIX: Proactively clear the HOST-ONLY cookie by NOT specifying a domain. ---
        res.clearCookie("connect.sid", { path: "/" });

        res.status(200).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Logging in...</title>
                        <style>
                            body { font-family: sans-serif; background-color: #111827; color: #d1d5db; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                            .container { text-align: center; }
                        </style>
                        <script>
                            window.location.href = '/app/';
                        </script>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Login Successful</h1>
                            <p>Redirecting you to the dashboard...</p>
                        </div>
                    </body>
                    </html>
                `);
      });
    });
  } catch (error) {
    console.error("Error during magic link callback:", error);
    res.status(500).send("An internal server error occurred.");
  }
});

router.get("/accept-invitation", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Invitation token is required.");
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // --- FIX: Use the correct column name 'invitation_token' to find the invitation. ---
    const invitationResult = await client.query(
      "SELECT * FROM user_invitations WHERE invitation_token = $1 AND status = 'pending' AND expires_at > NOW()",
      [token]
    );

    if (invitationResult.rows.length === 0) {
      return res.status(400).send("Invitation is invalid or has expired.");
    }
    const invitation = invitationResult.rows[0];

    // --- FIX: Create the new user's ID from 'invitation.invitation_token'. ---
    const newUserCloudbedsId = `invited-${invitation.invitation_token.substring(
      0,
      16
    )}`;

    // Create the new user and return their new cloudbeds_user_id
    const userInsertResult = await client.query(
      "INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, role, pms_type) VALUES ($1, $2, $3, $4, 'user', 'cloudbeds') RETURNING cloudbeds_user_id",
      [
        newUserCloudbedsId,
        invitation.invitee_email,
        invitation.invitee_first_name,
        invitation.invitee_last_name,
      ]
    );
    const newDbUser = userInsertResult.rows[0];

    // --- FIX: Find the inviter's cloudbeds_user_id to correctly look up their properties. ---
    // --- FIX: Grant access only to the specific property stored with the invitation. ---
    // This ensures a super_admin invitation only grants access to the intended property.
    if (!invitation.property_id) {
      // This is a data integrity issue. If an invitation has no property, we cannot proceed.
      throw new Error(
        `Invitation record (ID: ${invitation.invitation_id}) is missing a property_id.`
      );
    }

    // Link the new user to the single, specific property from the invitation.
    await client.query(
      "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
      [newDbUser.cloudbeds_user_id, invitation.property_id]
    );

    // --- FIX: Delete the invitation after it has been successfully used. ---
    await client.query(
      "DELETE FROM user_invitations WHERE invitation_id = $1",
      [invitation.invitation_id]
    );

    await client.query("COMMIT");

    // Regenerate session to prevent fixation attacks and log the new user in
    req.session.regenerate((err) => {
      if (err) {
        console.error("Error regenerating session for new user:", err);
        // Even if session fails, the user was created. Redirect them to login.
        return res.redirect(
          "/login.html?message=Account created! Please log in."
        );
      }
      req.session.userId = newDbUser.cloudbeds_user_id;
      req.session.role = "user";

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("Error saving session for new user:", saveErr);
          return res.redirect(
            "/login.html?message=Account created! Please log in."
          );
        }
        // Redirect to the dashboard on successful login
        res.redirect("/app/");
      });
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error during invitation acceptance:", error);
    res.status(500).send("An internal server error occurred.");
  } finally {
    client.release();
  }
});

// api/routes/auth.router.js
// /api/routes/auth.router.js

router.get("/session-info", async (req, res) => {
  if (req.session && req.session.userId) {
    try {
      const userResult = await pgPool.query(
        "SELECT first_name, last_name, role FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );
      if (userResult.rows.length === 0) {
        console.error("[CRITICAL] User from session not found in DB.");
        return res.json({ isLoggedIn: false });
      }
      const user = userResult.rows[0];

      const responsePayload = {
        isLoggedIn: true,
        role: user.role,
        isAdmin: user.role === "super_admin" || user.role === "owner", 
        firstName: user.first_name,
        lastName: user.last_name,
      };

      res.json(responsePayload);
    } catch (error) {
      console.error(
        "[CRITICAL] Error in /api/auth/session-info endpoint:",
        error
      );
      res.status(500).json({ error: "Could not retrieve session info." });
    }
  } else {
    console.error(
      "[CRITICAL] /session-info endpoint hit, but session or userId was missing."
    );
    res.json({ isLoggedIn: false });
  }
});
router.post("/mews/validate", async (req, res) => {
  // Destructure and validate the incoming data from the frontend form
  const { firstName, lastName, email, accessToken } = req.body;
  if (!firstName || !lastName || !email || !accessToken) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Check if a user with this email already exists in the database
    const existingUser = await pgPool.query(
      "SELECT user_id FROM users WHERE email = $1",
      [email]
    );
    if (existingUser.rows.length > 0) {
      // Use status 409 Conflict for an existing resource
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    // --- FIX: Combine the server's ClientToken with the user's AccessToken ---
    // --- FIX: Combine the server's ClientToken with the user's AccessToken ---
    const clientToken = process.env.MEWS_CLIENT_TOKEN;
    // --- DIAGNOSTIC LOG ---
    // --- END DIAGNOSTIC LOG ---
    if (!clientToken) {
      return res.status(500).json({ message: "Server configuration error." });
    }
    const credentials = { clientToken, accessToken };
    // --- END FIX ---

    // Use the adapter to get initial details from Mews. This validates the token.
    // This call corresponds to Mews' /configuration/get endpoint.
    const propertyDetails = await mewsAdapter.getHotelDetails(credentials); // Pass the full credentials object

    // --- LOGIC TO DETECT A PORTFOLIO TOKEN ---
    // A portfolio token used with /configuration/get returns a "dummy" enterprise.
    // We assume such a dummy enterprise might lack a physical address, which is a good indicator.
    // --- FIX: Use the 'IsPortfolio' flag for reliable token type detection ---
    if (propertyDetails.rawResponse.Enterprise.IsPortfolio === true) {
      // If it looks like a portfolio, fetch the list of all hotels in that portfolio.
      const portfolioHotels = await mewsAdapter.getPortfolioEnterprises(
        credentials
      );
      if (!portfolioHotels || portfolioHotels.length === 0) {
        return res.status(404).json({
          message: "Portfolio token is valid, but no properties were found.",
        });
      }
      // Respond to the frontend with the list of hotels
      return res.status(200).json({
        tokenType: "portfolio",
        properties: portfolioHotels, // Expects an array of {id, name} objects
      });
    } else {
      // If it has an address, it's a single property.
      // Respond to the frontend with the single hotel's details.
      return res.status(200).json({
        tokenType: "single",
        properties: [
          {
            id: propertyDetails.id,
            name: propertyDetails.propertyName, // <-- FIX: Use .propertyName
          },
        ],
      });
    }
  } catch (error) {
    console.error("Mews validation error:", error);
    // The adapter should throw an error for an invalid token.
    // We respond with a 401 Unauthorized status.
    return res.status(401).json({ message: "Invalid Mews Access Token." });
  }
});

// --- MEWS ONBOARDING: STEP 2 - CREATE USER & PROPERTY ---
router.post("/mews/create", async (req, res) => {
  const { firstName, lastName, email, accessToken, selectedProperties } =
    req.body;

  // Basic validation
  if (
    !firstName ||
    !email ||
    !accessToken ||
    !selectedProperties ||
    selectedProperties.length === 0
  ) {
    return res.status(400).json({ message: "Missing required information." });
  }

  const client = await pgPool.connect();
  try {
    // --- Start Transaction ---
    await client.query("BEGIN");

    // --- 1. Encrypt the Mews Access Token for secure storage ---
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encryptedToken = cipher.update(accessToken, "utf8", "hex");
    encryptedToken += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    // Store iv and authTag with the token for decryption
    const storedCredentials = {
      accessToken: `${iv.toString("hex")}:${authTag}:${encryptedToken}`,
      clientToken: process.env.MEWS_CLIENT_TOKEN, // Also store the client token used
    };

    // --- 2. Create the User ---
    // --- 2. Create the User ---
    const userResult = await client.query(
      `INSERT INTO users (email, first_name, last_name, role, pms_type)
   VALUES ($1, $2, $3, 'owner', 'mews')
   RETURNING user_id`,
      [email, firstName, lastName]
    );
    const newUserIdInt = userResult.rows[0].user_id; // This is the integer ID

    // --- NEW: Generate and save a unique string ID for the session ---
    const newUserStringId = `mews-${newUserIdInt}-${crypto
      .randomBytes(4)
      .toString("hex")}`;
    await client.query(
      `UPDATE users SET cloudbeds_user_id = $1 WHERE user_id = $2`,
      [newUserStringId, newUserIdInt]
    );
    // --- END NEW ---

    const newHotelIds = [];

    // --- 3. Create Hotels and Link to User ---
    for (const property of selectedProperties) {
      // ... (rest of the loop is the same)
      const hotelResult = await client.query(
        `INSERT INTO hotels (pms_property_id, property_name, pms_type)
     VALUES ($1, $2, 'mews')
     RETURNING hotel_id`,
        [property.id, property.name]
      );
      const newHotelId = hotelResult.rows[0].hotel_id;
      newHotelIds.push(newHotelId);

      // Link the user to the new property
      await client.query(
        `INSERT INTO user_properties (user_id, property_id, pms_credentials, status)
     VALUES ($1, $2, $3, 'syncing')`,
        [newUserStringId, newHotelId, storedCredentials] // <-- FIX: Use the new string ID here
      );
    }

    // --- Commit Transaction ---
    await client.query("COMMIT");

    // --- 4. Log the new user in by creating a session ---
    req.session.regenerate(async (err) => {
      if (err) {
        console.error("Mews onboarding: Session regeneration failed:", err);
        // Even if session fails, account was created.
        return res
          .status(500)
          .json({ message: "Could not log you in automatically." });
      }
      req.session.userId = newUserStringId; // <-- FIX: Use the new string ID for the session
      req.session.role = "owner";
      req.session.save();

      // --- 5. Asynchronously Trigger Initial Sync for each new property ---
      for (const hotelId of newHotelIds) {
        const syncUrl =
          process.env.VERCEL_ENV === "production"
            ? "https://www.market-pulse.io/api/initial-sync"
            : "http://localhost:3000/api/initial-sync";
        fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
          },
          body: JSON.stringify({ propertyId: hotelId }),
        }).catch((syncErr) =>
          console.error(
            `Failed to trigger initial sync for hotel ${hotelId}:`,
            syncErr
          )
        );
      }

      // --- 6. Respond to frontend to redirect ---
      // --- 6. Respond to frontend to redirect ---
      // We only have one hotel ID for Mews single-property onboarding.
      const primaryPropertyId = newHotelIds[0];
      res.status(200).json({
        message: "Connection successful!",
        redirectTo: `/app/?newConnection=true&propertyId=${primaryPropertyId}`,
      });
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error during Mews connection creation:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  } finally {
    client.release();
  }
});

// --- OHIP/OPERA ONBOARDING ROUTES ---

/**
 * Step 1: Initiate the OAuth 2.0 flow for OPERA Cloud.
 * This route constructs the Oracle authorization URL with the necessary parameters
 * (client ID, redirect URI, scopes) and redirects the user to Oracle's
 * login and consent screen.
 */
router.get("/opera", (req, res) => {
  // Retrieve the necessary configuration from environment variables.
  const { OPERA_CLIENT_ID, OPERA_DOMAIN_URL } = process.env;

  // Define the Redirect URI. This must exactly match the URI registered in the OCI console.
  const redirectUri =
    process.env.VERCEL_ENV === "production"
      ? "https://www.market-pulse.io/api/auth/opera/callback" // This will be your production callback URL
      : "http://localhost:3000/api/auth/opera/callback";

  // Check for required configuration to prevent server errors.
  if (!OPERA_CLIENT_ID || !OPERA_DOMAIN_URL) {
    console.error("OHIP configuration is missing in environment variables.");
    return res.status(500).send("Server configuration error.");
  }

  // Define the scopes (permissions) we are requesting. 'openid' is standard for OIDC.
  // We will add specific OHIP API scopes later on once we know which ones are needed.
  // In addition to the standard OIDC scopes, we are now requesting the primary
  // scope required to access the Oracle Hospitality APIs.
  // Reverting to the original scopes to confirm the base functionality.
  const scopes = "openid profile email urn:opc:idm:__myscopes__";

  // Construct the URL query parameters.
  const params = new URLSearchParams({
    client_id: OPERA_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state: crypto.randomBytes(16).toString("hex"), // Use a CSRF token for security.
  });

  // Construct the full authorization URL from the domain URL.
  const authorizationUrl = `${OPERA_DOMAIN_URL}/oauth2/v1/authorize?${params.toString()}`;

  // Redirect the user to the Oracle authorization server.
  res.redirect(authorizationUrl);
});

/**
 * Step 2: Handle the callback from the Oracle Authorization Server.
 * Oracle redirects the user back to this endpoint after they grant consent.
 * This endpoint receives an authorization 'code' in the query parameters.
 */
/**
 * Step 2: Handle the callback from the Oracle Authorization Server.
 * This route now calls our adapter to exchange the received authorization code
 * for an access token and a refresh token.
 */
router.get("/opera/callback", async (req, res) => {
  // Extract the authorization code from the query parameters sent by Oracle.
  const { code } = req.query;

  // Validate that the code exists.
  if (!code) {
    return res
      .status(400)
      .send("Authorization code is missing from the callback.");
  }

  try {
    // Call our new adapter function to perform the token exchange.
    const tokenData = await operaAdapter.exchangeCodeForTokens(code);

    // For this test, we will log the entire token response to the server console.
    // This is a crucial step to let us see the structure of the data we get back.
    console.log("Successfully received OHIP tokens:", tokenData);

    // In future steps, we will save these tokens and create the user session.
    // For now, just send a success message to the browser to confirm the flow worked.
    res
      .status(200)
      .send(
        "<h1>OHIP Connection Successful!</h1><p>Successfully exchanged the code for tokens. Please check your server console for the full token response. You can close this window.</p>"
      );
  } catch (error) {
    // If the token exchange fails, our adapter will throw an error.
    // We catch it here and send a user-friendly error message to the browser.
    console.error("Failed during OHIP token exchange:", error);
    res
      .status(500)
      .send(
        "<h1>Error</h1><p>Could not exchange the authorization code for an access token. Please check the server logs for more details.</p>"
      );
  }
});

router.get("/cloudbeds", (req, res) => {
  const { CLOUDBEDS_CLIENT_ID } = process.env;
  const redirectUri =
    process.env.VERCEL_ENV === "production"
      ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
      : process.env.CLOUDBEDS_REDIRECT_URI;
  if (!CLOUDBEDS_CLIENT_ID || !redirectUri) {
    return res.status(500).send("Server configuration error.");
  }
  const scopes =
    "read:user read:hotel read:guest read:reservation read:room read:rate read:currency read:taxesAndFees read:dataInsightsGuests read:dataInsightsOccupancy read:dataInsightsReservations offline_access";
  const params = new URLSearchParams({
    client_id: CLOUDBEDS_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
  });
  const authorizationUrl = `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`;
  res.redirect(authorizationUrl);
});

router.get("/connect-pilot-property", requireUserApi, async (req, res) => {
  // This route is now legacy and can be removed, but is kept for historical reference.
  // It is no longer reachable as the UI elements have been removed.
  res.status(410).send("This feature has been deprecated.");
});
// /api/routes/auth.router.js

router.get("/cloudbeds/callback", async (req, res) => {
  // BREADCRUMB 1: Log that the callback has been initiated.

  const { code } = req.query;
  if (!code) {
    console.error("[BREADCRUMB FAIL] No authorization code provided.");
    return res.status(400).send("Authorization code is missing.");
  }

  try {
    // Step 1: Exchange the authorization code for an access token
    const { CLOUDBEDS_CLIENT_ID, CLOUDBEDS_CLIENT_SECRET } = process.env;
    const redirectUri =
      process.env.VERCEL_ENV === "production"
        ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
        : process.env.CLOUDBEDS_REDIRECT_URI;

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLOUDBEDS_CLIENT_ID,
      client_secret: CLOUDBEDS_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code: code,
    });

    const tokenRes = await fetch(
      "https://hotels.cloudbeds.com/api/v1.1/access_token",
      {
        method: "POST",
        body: params,
      }
    );
    const tokenResponse = await tokenRes.json();

    if (!tokenResponse.access_token) {
      console.error("[BREADCRUMB FAIL] Token exchange failed.");
      throw new Error(
        "Token exchange failed: " + JSON.stringify(tokenResponse)
      );
    }
    const { access_token, refresh_token, expires_in } = tokenResponse;

    // Step 2: Fetch user and property info from Cloudbeds
    const userInfoRes = await fetch(
      "https://api.cloudbeds.com/api/v1.3/userinfo",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );
    const cloudbedsUser = await userInfoRes.json();

    // This is the key logic we are testing. We need to see if this array is populated.
    // /api/routes/auth.router.js

    // CRITICAL FIX: The parsing logic has been updated to match the new API response format.
    // The 'resources' array now contains objects, not strings.
    const userProperties = tokenResponse.resources
      // Filter the array to only include objects where the 'type' is 'property'.
      .filter((r) => r && r.type === "property" && r.id)
      // Map the filtered array to our desired format, extracting the 'id'.
      .map((r) => ({
        property_id: r.id,
      }));

    if (userProperties.length === 0) {
      console.warn(
        "[BREADCRUMB WARN] No properties found in tokenResponse.resources. The hotel sync loop will be skipped."
      );
    }

    // Step 3: Perform all database operations in a single transaction
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");

      // Upsert the user (create if not exist, update if exist)
      const userUpsertQuery = `
        INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, role, pms_type)
        VALUES ($1, $2, $3, $4, 'owner', 'cloudbeds')
        ON CONFLICT (email) DO UPDATE SET
            cloudbeds_user_id = EXCLUDED.cloudbeds_user_id,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            updated_at = NOW()
        RETURNING role;
      `;
      const userResult = await client.query(userUpsertQuery, [
        cloudbedsUser.user_id,
        cloudbedsUser.email,
        cloudbedsUser.first_name,
        cloudbedsUser.last_name,
      ]);
      const userRole = userResult.rows[0].role;

      const pmsCredentials = {
        access_token,
        refresh_token,
        token_expiry: new Date(Date.now() + expires_in * 1000),
      };

      // /api/routes/auth.router.js

      // /api/routes/auth.router.js

      // This array will hold the internal IDs of the property/properties just synced.
      const newlySyncedInternalIds = [];

      // Sync hotel details and link properties to the user
      for (const property of userProperties) {
        const internalHotelId = await cloudbedsAdapter.syncHotelDetailsToDb(
          access_token,
          property.property_id,
          client
        );

        if (!internalHotelId) {
          console.warn(
            `Skipping property link for ${property.property_id} due to sync failure.`
          );
          continue;
        }

        // Add the new internal ID to our list.
        newlySyncedInternalIds.push(internalHotelId);

        const linkQuery = `
          INSERT INTO user_properties (user_id, property_id, pms_credentials, status)
          VALUES ($1, $2, $3, 'connected')
          ON CONFLICT (user_id, property_id) DO UPDATE SET
            pms_credentials = EXCLUDED.pms_credentials,
            status = 'connected';
        `;

        await client.query(linkQuery, [
          cloudbedsUser.user_id,
          internalHotelId,
          pmsCredentials,
        ]);
      }

      await client.query("COMMIT");

      // Step 4: Handle session and redirect
      req.session.userId = cloudbedsUser.user_id;
      req.session.role = userRole;

// This is the new, corrected code
      req.session.save((err) => {
        if (err) {
          console.error(
            "CRITICAL: Database commit succeeded but session save failed:",
            err
          );
          return res
            .status(500)
            .send("Your account was connected, but we could not log you in.");
        }

        // --- [NEW] START INITIAL SYNC TRIGGER ---
        
        // 1. Determine the correct base URL (copied from magic link logic)
        let baseUrl;
        if (process.env.VERCEL_ENV === 'production') {
          baseUrl = 'https://www.market-pulse.io';
        } else if (process.env.VERCEL_BRANCH_URL) { 
          baseUrl = `https://${process.env.VERCEL_BRANCH_URL}`;
        } else if (process.env.VERCEL_URL) {
          baseUrl = `https://${process.env.VERCEL_URL}`;
        } else {
          baseUrl = 'http://localhost:3000'; // Assumes backend runs on 3000
        }

        // 2. Loop through all new hotels and trigger the sync for each
        for (const hotelId of newlySyncedInternalIds) {
          // Call the documented admin endpoint to trigger the initial-sync.js job
          const syncUrl = `${baseUrl}/api/admin/initial-sync`;
          
          console.log(`[AUTH CALLBACK] Triggering initial sync for new hotel ${hotelId} via ${syncUrl}`);

          // We do this asynchronously and don't wait for the response.
          // The user gets redirected immediately, and the sync runs
          // in the background. The .catch() is just for logging.
          fetch(syncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Use the internal secret, just like the Mews handler
              "Authorization": `Bearer ${process.env.INTERNAL_API_SECRET}`,
            },
            body: JSON.stringify({ propertyId: hotelId }),
          }).catch((syncErr) =>
            console.error(
              `[AUTH CALLBACK] Failed to trigger initial sync for hotel ${hotelId}:`,
              syncErr
            )
          );
        }
        // --- [END] INITIAL SYNC TRIGGER ---


        // 3. Redirect the user (this logic is unchanged)
        const primaryNewPropertyId = newlySyncedInternalIds[0];

        if (primaryNewPropertyId) {
          res.redirect(
            `/app/?newConnection=true&propertyId=${primaryNewPropertyId}`
          );
        } else {
          // Fallback if no properties were synced.
          console.warn(
            "OAuth callback completed but no new properties were synced."
          );
          res.redirect("/app/");
        }
      });


    } catch (dbError) {
      await client.query("ROLLBACK");
      console.error(
        "[BREADCRUMB FAIL] Error during OAuth DB transaction, rolling back:",
        dbError
      );
      res
        .status(500)
        .send("A database error occurred during the connection process.");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(
      "[BREADCRUMB FAIL] A critical error occurred in OAuth callback:",
      error
    );
    res.status(500).send("An internal server error occurred.");
  }
});

module.exports = router;
