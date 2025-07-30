// /api/routes/auth.router.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");
const { syncHotelDetailsToDb } = require("../utils/cloudbeds");

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

router.get("/magic-link-callback", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send("Invalid or missing login token.");
  }
  try {
    const tokenResult = await pgPool.query(
      "SELECT * FROM magic_login_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    if (tokenResult.rows.length === 0) {
      return res
        .status(400)
        .send(
          "Login link is invalid or has expired. Please request a new one."
        );
    }
    const validToken = tokenResult.rows[0];

    const userQuery = `
      SELECT u.user_id, u.cloudbeds_user_id, u.is_admin, u.auth_mode
      FROM users u
      WHERE u.user_id = $1
    `;
    const userResult = await pgPool.query(userQuery, [validToken.user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).send("Could not find a matching user account.");
    }
    const user = userResult.rows[0];

    // Set the session variables.
    // FIX: This was using an undefined variable 'cloudbedsUserIdToUse'.
    // It now correctly uses the 'cloudbeds_user_id' from the user we just fetched.
    req.session.userId = user.cloudbeds_user_id;
    req.session.isAdmin = user.is_admin || false;

    // Delete the used token.
    await pgPool.query("DELETE FROM magic_login_tokens WHERE token = $1", [
      token,
    ]);

    req.session.save((err) => {
      if (err) {
        console.error("Session save error after magic link login:", err);
        return res.status(500).send("An error occurred during login.");
      }
      console.log(
        `[BREADCRUMB 1 - auth.router.js] Session saved successfully. Redirecting. Session content:`,
        req.session
      );
      res.redirect("/app/");
    });
  } catch (error) {
    console.error("Error during magic link callback:", error);
    res.status(500).send("An internal error occurred.");
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

    const inviteResult = await client.query(
      "SELECT i.*, u.cloudbeds_user_id as inviter_cloudbeds_id FROM user_invitations i JOIN users u ON i.inviter_user_id = u.user_id WHERE i.invitation_token = $1 AND i.status = 'pending' AND i.expires_at > NOW()",
      [token]
    );
    if (inviteResult.rows.length === 0) {
      throw new Error(
        "Invitation is invalid, has expired, or has already been used."
      );
    }
    const invitation = inviteResult.rows[0];

    const newCloudbedsUserId = `invited-${crypto
      .randomBytes(8)
      .toString("hex")}`;
    const newUserResult = await client.query(
      `INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, auth_mode, pms_type, is_admin)
       VALUES ($1, $2, $3, $4, 'invited', 'cloudbeds', false)
       RETURNING user_id, cloudbeds_user_id`,
      [
        newCloudbedsUserId,
        invitation.invitee_email,
        invitation.invitee_first_name,
        invitation.invitee_last_name,
      ]
    );
    const finalCloudbedsId = newUserResult.rows[0].cloudbeds_user_id;

    const propertiesResult = await client.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1",
      [invitation.inviter_cloudbeds_id]
    );
    const inviterProperties = propertiesResult.rows;

    if (inviterProperties.length > 0) {
      for (const prop of inviterProperties) {
        await client.query(
          "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
          [finalCloudbedsId, prop.property_id]
        );
      }
    }

    await client.query(
      "DELETE FROM user_invitations WHERE invitation_token = $1",
      [token]
    );

    req.session.userId = finalCloudbedsId;
    req.session.isAdmin = false;

    req.session.save(async (err) => {
      if (err) {
        throw new Error("Failed to create user session.");
      }
      await client.query("COMMIT");
      res.redirect("/app/");
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error accepting invitation:", error);
    res.status(400).send(error.message);
  } finally {
    client.release();
  }
});

router.get("/session-info", async (req, res) => {
  if (req.session.userId) {
    try {
      const userResult = await pgPool.query(
        "SELECT first_name, last_name, is_admin FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );
      if (userResult.rows.length === 0) {
        return res.json({ isLoggedIn: false });
      }
      const user = userResult.rows[0];
      res.json({
        isLoggedIn: true,
        isAdmin: user.is_admin || false,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    } catch (error) {
      console.error(
        "CRITICAL ERROR in /api/auth/session-info endpoint:",
        error
      );
      res.status(500).json({ error: "Could not retrieve session info." });
    }
  } else {
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
  const { propertyId } = req.query;
  if (!propertyId) {
    return res.status(400).send("Property ID is required.");
  }
  try {
    const credsResult = await pgPool.query(
      `SELECT override_client_id FROM user_properties WHERE user_id = $1 AND property_id = $2`,
      [req.session.userId, propertyId]
    );
    if (
      credsResult.rows.length === 0 ||
      !credsResult.rows[0].override_client_id
    ) {
      return res
        .status(404)
        .send(
          "Credentials for this property not found or you do not have access."
        );
    }
    const clientId = credsResult.rows[0].override_client_id;
    const redirectUri =
      process.env.VERCEL_ENV === "production"
        ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
        : process.env.CLOUDBEDS_REDIRECT_URI;
    const state = propertyId;
    const scopes =
      "read:user read:hotel read:guest read:reservation read:room read:rate read:currency read:taxesAndFees read:dataInsightsGuests read:dataInsightsOccupancy read:dataInsightsReservations offline_access";
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      state: state,
    });
    const authorizationUrl = `https://hotels.cloudbeds.com/api/v1.2/oauth?${params.toString()}`;
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error("Error starting pilot connection:", error);
    res
      .status(500)
      .send("An error occurred while starting the connection process.");
  }
});

router.get("/cloudbeds/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Error: No authorization code provided.");
    }

    const clientId = process.env.CLOUDBEDS_CLIENT_ID;
    const clientSecret = process.env.CLOUDBEDS_CLIENT_SECRET;
    const redirectUri =
      process.env.VERCEL_ENV === "production"
        ? "https://www.market-pulse.io/api/auth/cloudbeds/callback"
        : process.env.CLOUDBEDS_REDIRECT_URI;

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code,
    });
    const tokenResponse = await fetch(
      "https://hotels.cloudbeds.com/api/v1.1/access_token",
      { method: "POST", body: tokenParams }
    );
    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error(
        `Failed to get access token. Response: ${JSON.stringify(tokenData)}`
      );
    }

    const propertyId = tokenData.resources?.[0]?.id;
    if (!propertyId) {
      throw new Error(
        "Could not determine Property ID from Cloudbeds token response."
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    const userInfoResponse = await fetch(
      "https://api.cloudbeds.com/api/v1.3/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const userInfo = await userInfoResponse.json();

    let existingUser;
    let cloudbedsUserIdToUse;

    const existingUserResult = await pgPool.query(
      "SELECT * FROM users WHERE email = $1",
      [userInfo.email]
    );

    if (existingUserResult.rows.length > 0) {
      console.log(
        `[OAuth Callback] Found existing user for email: ${userInfo.email}. Linking new property to this user.`
      );
      existingUser = existingUserResult.rows[0];
      cloudbedsUserIdToUse = existingUser.cloudbeds_user_id;

      await pgPool.query(
        "UPDATE users SET first_name = $1, last_name = $2 WHERE email = $3",
        [userInfo.first_name, userInfo.last_name, userInfo.email]
      );
    } else {
      console.log(
        `[OAuth Callback] No existing user found for email: ${userInfo.email}. Creating a new user.`
      );
      const newUserQuery = `
        INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, status, auth_mode, pms_type)
        VALUES ($1, $2, $3, $4, 'active', 'oauth', 'cloudbeds')
        RETURNING *;
      `;
      const newUserResult = await pgPool.query(newUserQuery, [
        userInfo.user_id,
        userInfo.email,
        userInfo.first_name,
        userInfo.last_name,
      ]);
      existingUser = newUserResult.rows[0];
      cloudbedsUserIdToUse = existingUser.cloudbeds_user_id;
    }

    await syncHotelDetailsToDb(access_token, propertyId);

    const pmsCredentials = {
      access_token,
      refresh_token,
      token_expiry: tokenExpiry.toISOString(),
    };

    await pgPool.query(
      `INSERT INTO user_properties (user_id, property_id, status, pms_credentials) 
       VALUES ($1, $2, 'connected', $3) 
       ON CONFLICT (user_id, property_id) 
       DO UPDATE SET status = 'connected', pms_credentials = EXCLUDED.pms_credentials;`,
      [cloudbedsUserIdToUse, propertyId, pmsCredentials]
    );

    console.log(
      `[Auto-Sync] Delegating sync for property ${propertyId} to its dedicated endpoint.`
    );
    const syncUrl = `${req.protocol}://${req.get("host")}/api/initial-sync`;

    fetch(syncUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: propertyId }),
    }).catch((error) => {
      console.error(
        `[Auto-Sync] CRITICAL: Failed to fire request to dedicated sync endpoint for property ${propertyId}:`,
        error
      );
    });

    // FIX: This section was using the wrong variables. It now uses the corrected
    // 'cloudbedsUserIdToUse' and pulls the 'is_admin' flag from our database record.
    req.session.userId = cloudbedsUserIdToUse;
    req.session.isAdmin = existingUser.is_admin || false;

    req.session.save((err) => {
      if (err) {
        return res
          .status(500)
          .send("An error occurred during authentication session save.");
      }
      res.redirect("/app/?newConnection=true");
    });
  } catch (error) {
    console.error("CRITICAL ERROR in OAuth callback:", error.stack);
    res.status(500).json({
      message: "An error occurred during authentication.",
      error: error.message,
      stack: error.stack,
    });
  }
});

module.exports = router;
