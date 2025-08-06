// /api/routes/auth.router.js
const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const pgPool = require("../utils/db");
const { requireUserApi } = require("../utils/middleware");
const { syncHotelDetailsToDb } = require("../utils/cloudbeds");
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

router.get("/magic-link-callback", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Magic link token is required.");
  }

  try {
    const tokenResult = await pgPool.query(
      "SELECT * FROM magic_login_tokens WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL",
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).send("Magic link is invalid or has expired.");
    }

    const loginToken = tokenResult.rows[0];
    const userResult = await pgPool.query(
      "SELECT user_id, cloudbeds_user_id, email, role FROM users WHERE user_id = $1",
      [loginToken.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    const user = userResult.rows[0];

    // --- FIX: Update the token record using the 'token' column, not 'token_id' ---
    await pgPool.query(
      "UPDATE magic_login_tokens SET used_at = NOW() WHERE token = $1",
      [token]
    );

    req.session.userId = user.cloudbeds_user_id;
    req.session.role = user.role;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).send("Could not log you in.");
      }
      res.redirect("/app/");
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

router.get("/session-info", async (req, res) => {
  // Check if a user is logged in by looking for their ID in the session.
  if (req.session.userId) {
    try {
      // --- FIX: Query for the 'role' column instead of the deleted 'is_admin' column. ---
      const userResult = await pgPool.query(
        "SELECT first_name, last_name, role FROM users WHERE cloudbeds_user_id = $1",
        [req.session.userId]
      );

      if (userResult.rows.length === 0) {
        return res.json({ isLoggedIn: false });
      }

      const user = userResult.rows[0];

      // --- FIX: Return the user's actual role in the response. ---
      // The frontend components will use this to decide what to show.
      res.json({
        isLoggedIn: true,
        role: user.role, // e.g., 'super_admin', 'owner', 'user'
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
    // If there's no session ID, the user is not logged in.
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

router.get("/cloudbeds/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code is missing.");
  }

  try {
    const tokenResponse = await cloudbedsAdapter.exchangeCodeForToken(code);
    const { access_token, refresh_token, expires_in } = tokenResponse;

    const pmsCredentials = {
      access_token,
      refresh_token,
      token_expiry: new Date(Date.now() + expires_in * 1000),
    };

    const cloudbedsUser = await cloudbedsAdapter.getUserInfo(access_token);

    // This is the fix. The property info is in the 'tokenResponse' object we already have.
    // We are extracting the property ID and name from the 'resources' array within it.
    const userProperties = tokenResponse.resources.map((resource) => ({
      property_id: resource.property_id,
      property_name: resource.property_name,
    }));

    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");

      // --- FIX: Use UPSERT (INSERT ... ON CONFLICT) to handle user creation ---
      // This creates the user with the 'owner' role if they don't exist,
      // or does nothing if they already do. It also fetches the final role.
      const userUpsertQuery = `
        INSERT INTO users (cloudbeds_user_id, email, first_name, last_name, role, pms_type)
        VALUES ($1, $2, $3, $4, 'owner', 'cloudbeds')
        ON CONFLICT (cloudbeds_user_id) DO NOTHING;
      `;
      await client.query(userUpsertQuery, [
        cloudbedsUser.user_id,
        cloudbedsUser.email,
        cloudbedsUser.first_name,
        cloudbedsUser.last_name,
      ]);

      // --- FIX: Select the user's role, which is now guaranteed to exist ---
      const userResult = await client.query(
        "SELECT role FROM users WHERE cloudbeds_user_id = $1",
        [cloudbedsUser.user_id]
      );
      const userRole = userResult.rows[0].role;

      // Link properties to the user
      for (const property of userProperties) {
        const linkQuery = `
          INSERT INTO user_properties (user_id, property_id, property_name, pms_type, pms_credentials, status)
          VALUES ($1, $2, $3, 'cloudbeds', $4, 'connected')
          ON CONFLICT (user_id, property_id) DO UPDATE SET
            property_name = EXCLUDED.property_name,
            pms_credentials = EXCLUDED.pms_credentials,
            status = 'connected',
            updated_at = NOW();
        `;
        await client.query(linkQuery, [
          cloudbedsUser.user_id,
          property.property_id,
          property.property_name,
          pmsCredentials,
        ]);
      }

      await client.query("COMMIT");

      // Set session data
      req.session.userId = cloudbedsUser.user_id;
      // --- FIX: Set the user's role from the database ---
      req.session.role = userRole;

      req.session.save((err) => {
        if (err) throw err;
        // Trigger the initial sync in the background
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/initial-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
          },
          body: JSON.stringify({ userId: cloudbedsUser.user_id }),
        }).catch((syncErr) =>
          console.error("Failed to trigger initial sync:", syncErr)
        );
        res.redirect("/app/?newConnection=true");
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error during Cloudbeds OAuth callback:", error);
    res.status(500).send("An internal server error occurred.");
  }
});

module.exports = router;
