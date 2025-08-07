// /api/routes/auth.router.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");

const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");

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

    const loginLink = `https://www.market-pulse.io/api/auth/magic-link-callback?token=${token}`;
    const msg = {
      to: user.email,
      from: { name: "Market Pulse", email: "login@market-pulse.io" },
      subject: "Your Market Pulse Login Link",
      html: `<p>Hello ${
        user.first_name || "there"
      },</p><p>Click the link below to log in to your Market Pulse dashboard. This link will expire in 15 minutes.</p><p><a href="${loginLink}" style="font-size: 16px; font-weight: bold; padding: 10px 15px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">Log in to Market Pulse</a></p>`,
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
  // --- BREADCRUMB 1: LOG THE START OF THE CALLBACK ---
  console.log(
    `[BREADCRUMB 1 - auth.router.js] Magic link callback started. Token: ${req.query.token}`
  );

  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Invalid or missing login token.");
  }
  try {
    const tokenResult = await pgPool.query(
      "SELECT * FROM magic_login_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL",
      [token]
    );

    // --- BREADCRUMB 2: LOG THE TOKEN VALIDATION RESULT ---
    console.log(
      `[BREADCRUMB 2 - auth.router.js] Token validation query found ${tokenResult.rows.length} rows.`
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

    // --- BREADCRUMB 3: LOG THE USER FOUND ---
    console.log(
      `[BREADCRUMB 3 - auth.router.js] Found user: ${user.email}, Role: ${user.role}`
    );

    await pgPool.query(
      "UPDATE magic_login_tokens SET used_at = NOW() WHERE token = $1",
      [loginToken.token]
    );

    // --- BREADCRUMB 4: LOG BEFORE SESSION REGENERATION ---
    console.log(
      `[BREADCRUMB 4 - auth.router.js] About to regenerate session for user ${user.cloudbeds_user_id}.`
    );

    req.session.regenerate((err) => {
      if (err) {
        console.error("[CRITICAL] Session regeneration failed:", err);
        return res.status(500).send("An error occurred during login.");
      }

      req.session.userId = user.cloudbeds_user_id;
      req.session.role = user.role;

      // --- BREADCRUMB 5: LOG THE NEWLY CREATED SESSION OBJECT ---
      console.log(
        `[BREADCRUMB 5 - auth.router.js] Session regenerated. New session content:`,
        req.session
      );

      // api/routes/auth.router.js

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[CRITICAL] Session save failed:", saveErr);
          return res.status(500).send("An error occurred during login.");
        }

        // Instead of a server-side redirect, send a simple HTML page
        // that performs a client-side redirect using JavaScript.
        console.log(
          `[BREADCRUMB 6 - auth.router.js] Session saved. Sending client-side redirect page.`
        );
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
                            // This script will run in the browser, redirecting to the dashboard.
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

    const invitationResult = await client.query(
      "SELECT * FROM user_invitations WHERE token = $1 AND status = 'pending' AND expires_at > NOW()",
      [token]
    );

    if (invitationResult.rows.length === 0) {
      return res.status(400).send("Invitation is invalid or has expired.");
    }
    const invitation = invitationResult.rows[0];

    // Create the new user
    const newUserCloudbedsId = `invited-${invitation.token.substring(0, 16)}`;
    const userInsertResult = await client.query(
      // --- FIX: Explicitly insert the 'user' role ---
      "INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, role, pms_type) VALUES ($1, $2, $3, $4, 'user', 'cloudbeds') RETURNING user_id",
      [
        newUserCloudbedsId,
        invitation.email,
        invitation.first_name,
        invitation.last_name,
      ]
    );

    // Link the new user to the same properties as the inviter
    const propertiesResult = await client.query(
      "SELECT property_id, property_name FROM user_properties WHERE user_id = $1",
      [invitation.invited_by_user_id]
    );

    for (const prop of propertiesResult.rows) {
      await client.query(
        "INSERT INTO user_properties (user_id, property_id, property_name, pms_type, status) VALUES ($1, $2, $3, 'cloudbeds', 'connected')",
        [newUserCloudbedsId, prop.property_id, prop.property_name]
      );
    }

    // Mark invitation as accepted
    await client.query(
      "UPDATE user_invitations SET status = 'accepted', accepted_at = NOW() WHERE invitation_id = $1",
      [invitation.invitation_id]
    );

    await client.query("COMMIT");

    // Set session data for the new user
    req.session.userId = newUserCloudbedsId;
    // --- FIX: Set the new user's role in the session ---
    req.session.role = "user";

    req.session.save((err) => {
      if (err) throw err;
      res.redirect("/app/");
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

router.get("/session-info", async (req, res) => {
  // --- BREADCRUMB 8: LOG THE START OF THE SESSION-INFO REQUEST ---
  console.log("[BREADCRUMB 8 - auth.router.js] /session-info endpoint hit.");
  console.log(
    "[BREADCRUMB 8a - auth.router.js] Full session object on request:",
    req.session
  );

  if (req.session && req.session.userId) {
    // --- BREADCRUMB 8b: LOG THAT A VALID SESSION WAS FOUND ---
    console.log(
      `[BREADCRUMB 8b - auth.router.js] Valid session found for userId: ${req.session.userId}. Fetching user details.`
    );
    try {
      const userResult = await pgPool.query(
        "SELECT first_name, last_name, role FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );
      if (userResult.rows.length === 0) {
        // This case should not happen if the session is valid, but it's good practice to handle it.
        console.error("[CRITICAL] User from session not found in DB.");
        return res.json({ isLoggedIn: false });
      }
      const user = userResult.rows[0];

      const responsePayload = {
        isLoggedIn: true,
        // --- FIX: Send both the new 'role' and the old 'isAdmin' flag for compatibility ---
        role: user.role,
        isAdmin: user.role === "super_admin" || user.role === "owner", // Re-create the isAdmin flag for the old header code
        firstName: user.first_name,
        lastName: user.last_name,
      };

      // --- BREADCRUMB 8c: LOG THE RESPONSE BEING SENT TO THE FRONTEND ---
      console.log(
        "[BREADCRUMB 8c - auth.router.js] Sending session-info payload to frontend:",
        responsePayload
      );
      res.json(responsePayload);
    } catch (error) {
      console.error(
        "[CRITICAL] Error in /api/auth/session-info endpoint:",
        error
      );
      res.status(500).json({ error: "Could not retrieve session info." });
    }
  } else {
    // --- BREADCRUMB 8d: LOG THE SESSION FAILURE CASE ---
    console.error(
      "[CRITICAL] /session-info endpoint hit, but session or userId was missing."
    );
    res.json({ isLoggedIn: false });
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
  console.log("[BREADCRUMB 1] OAuth callback started.");
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

    // BREADCRUMB 2: Log the entire token response from Cloudbeds. This is the most critical log.
    console.log(
      "[BREADCRUMB 2] Full token response from Cloudbeds:",
      JSON.stringify(tokenResponse, null, 2)
    );

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
    // BREADCRUMB 3: Log the user info we received.
    console.log(
      "[BREADCRUMB 3] User info response:",
      JSON.stringify(cloudbedsUser, null, 2)
    );

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

    // BREADCRUMB 4: Log the results of our property parsing logic.
    console.log(
      "[BREADCRUMB 4] Parsed userProperties array:",
      JSON.stringify(userProperties, null, 2)
    );
    if (userProperties.length === 0) {
      console.warn(
        "[BREADCRUMB WARN] No properties found in tokenResponse.resources. The hotel sync loop will be skipped."
      );
    }

    // Step 3: Perform all database operations in a single transaction
    const client = await pgPool.connect();
    try {
      // BREADCRUMB 5: Announce that we are starting the database transaction.
      console.log("[BREADCRUMB 5] Starting database transaction.");
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
      console.log(
        `[BREADCRUMB 6] User ${cloudbedsUser.email} upserted successfully.`
      );

      const pmsCredentials = {
        access_token,
        refresh_token,
        token_expiry: new Date(Date.now() + expires_in * 1000),
      };

      // Sync hotel details and link properties to the user
      for (const property of userProperties) {
        console.log(
          `[BREADCRUMB 7] LOOP START: Syncing property ID: ${property.property_id}`
        );
        await cloudbedsAdapter.syncHotelDetailsToDb(
          access_token,
          property.property_id,
          client
        );
        console.log(
          `[BREADCRUMB 8] LOOP: syncHotelDetailsToDb completed for ${property.property_id}.`
        );

        const linkQuery = `
          INSERT INTO user_properties (user_id, property_id, pms_credentials, status)
          VALUES ($1, $2, $3, 'connected')
          ON CONFLICT (user_id, property_id) DO UPDATE SET
            pms_credentials = EXCLUDED.pms_credentials,
            status = 'connected';
        `;
        await client.query(linkQuery, [
          cloudbedsUser.user_id,
          property.property_id,
          pmsCredentials,
        ]);
        console.log(
          `[BREADCRUMB 9] LOOP END: User linked to property ${property.property_id}.`
        );
      }

      await client.query("COMMIT");
      console.log(
        "[BREADCRUMB 10] Database transaction committed successfully."
      );

      // Step 4: Handle session and redirect AFTER the database transaction is safely committed
      req.session.userId = cloudbedsUser.user_id;
      req.session.role = userRole;

      req.session.save((err) => {
        if (err) {
          console.error(
            "CRITICAL: Database commit succeeded but session save failed:",
            err
          );
          return res
            .status(500)
            .send(
              "Your account was connected, but we could not log you in. Please try logging in manually."
            );
        }

        console.log(
          "[BREADCRUMB 11] Session saved. Triggering initial sync and redirecting user."
        );
        const primaryPropertyId = userProperties[0]?.property_id;
        if (primaryPropertyId) {
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
            body: JSON.stringify({ propertyId: primaryPropertyId }),
          }).catch((syncErr) =>
            console.error("Failed to trigger initial sync:", syncErr)
          );
        }
        // /api/routes/auth.router.js

        // CRITICAL FIX: Add the new propertyId to the redirect URL.
        // This allows the frontend to know exactly which property to select
        // and check the sync status for.
        res.redirect(
          `/app/?newConnection=true&propertyId=${primaryPropertyId}`
        );
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
