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
    const inviterUserResult = await client.query(
      "SELECT cloudbeds_user_id FROM users WHERE user_id = $1",
      [invitation.inviter_user_id]
    );
    const inviterCloudbedsId = inviterUserResult.rows[0].cloudbeds_user_id;

    // Find the properties linked to the inviter.
    const propertiesResult = await client.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1",
      [inviterCloudbedsId]
    );

    // Link the new user to the same properties as the inviter.
    for (const prop of propertiesResult.rows) {
      await client.query(
        "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
        [newDbUser.cloudbeds_user_id, prop.property_id]
      );
    }

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

router.get("/session-info", async (req, res) => {
  if (req.session && req.session.userId) {
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

      // Sync hotel details and link properties to the user
      for (const property of userProperties) {
        await cloudbedsAdapter.syncHotelDetailsToDb(
          access_token,
          property.property_id,
          client
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
      }

      await client.query("COMMIT");

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
