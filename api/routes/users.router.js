// /api/routes/users.router.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi, requireAccountOwner } = require("../utils/middleware");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
// Add this line with the other require statements at the top of the file.
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");

// --- NEW: Custom middleware to check if user can invite others ---
// This allows both 'owner' and 'super_admin' roles to send invitations.
const requireInvitePermission = (req, res, next) => {
  if (
    !req.session.role ||
    !["owner", "super_admin"].includes(req.session.role)
  ) {
    return res.status(403).json({
      error: "Forbidden: You do not have permission to invite users.",
    });
  }
  next();
};

/**
 * @route POST /api/users/invite
 * @description Creates an invitation for a new user and sends an email.
 * @access Owner or Super Admin
 */
// --- FIX: Use the new, more specific middleware ---
router.post(
  "/invite",
  [requireUserApi, requireInvitePermission],
  async (req, res) => {
    try {
      const { invitee_first_name, invitee_last_name, invitee_email } = req.body;
      const inviter_user_id = req.session.userId;

      if (!invitee_first_name || !invitee_last_name || !invitee_email) {
        return res
          .status(400)
          .json({ error: "First name, last name, and email are required." });
      }

      const existingUser = await pgPool.query(
        "SELECT user_id FROM users WHERE email = $1",
        [invitee_email]
      );
      if (existingUser.rows.length > 0) {
        return res
          .status(409)
          .json({ error: "A user with this email address already exists." });
      }

      const pendingInvite = await pgPool.query(
        "SELECT invitation_id FROM user_invitations WHERE invitee_email = $1 AND status = 'pending'",
        [invitee_email]
      );
      if (pendingInvite.rows.length > 0) {
        return res.status(409).json({
          error: "An invitation has already been sent to this email address.",
        });
      }

      const invitation_token = crypto.randomBytes(32).toString("hex");
      const expires_at = new Date();
      expires_at.setDate(expires_at.getDate() + 7);

      const newInvite = await pgPool.query(
        `INSERT INTO user_invitations (invited_by_user_id, invitee_email, invitee_first_name, invitee_last_name, invitation_token, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          inviter_user_id,
          invitee_email,
          invitee_first_name,
          invitee_last_name,
          invitation_token,
          expires_at,
        ]
      );

      const invitationLink = `https://www.market-pulse.io/api/auth/accept-invitation?token=${invitation_token}`;
      const msg = {
        to: invitee_email,
        from: { name: "Market Pulse", email: "support@market-pulse.io" },
        subject: "You've been invited to join Market Pulse",
        html: `<p>Hello ${invitee_first_name},</p><p>You have been invited to join Market Pulse. Click the link below to accept the invitation and set up your account.</p><a href="${invitationLink}">Accept Invitation</a><p>This link will expire in 7 days.</p>`,
      };
      await sgMail.send(msg);
      res.status(201).json({
        message: "Invitation sent successfully.",
        invite: newInvite.rows[0],
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ error: "Failed to send invitation." });
    }
  }
);

/**
 * @route GET /api/users/team
 * @description Fetches all active users and pending invitations for the user's account.
 * @access User
 */
router.get("/team", requireUserApi, async (req, res) => {
  const requesterCloudbedsId = req.session.userId;
  try {
    const propertiesResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1",
      [requesterCloudbedsId]
    );
    const propertyIds = propertiesResult.rows.map((p) => p.property_id);

    if (propertyIds.length === 0) {
      const selfResult = await pgPool.query(
        "SELECT first_name, last_name, email, role FROM users WHERE cloudbeds_user_id = $1",
        [requesterCloudbedsId]
      );
      if (selfResult.rows.length === 0) return res.json([]);
      const self = selfResult.rows[0];
      const roleMap = {
        super_admin: "Super Admin",
        owner: "Owner",
        user: "User",
      };
      return res.json([
        {
          name: `${self.first_name || ""} ${self.last_name || ""}`.trim(),
          email: self.email,
          status: "Active",
          role: roleMap[self.role] || "User",
        },
      ]);
    }

    const teamResult = await pgPool.query(
      "SELECT DISTINCT user_id FROM user_properties WHERE property_id = ANY($1::int[])",
      [propertyIds]
    );
    const teamCloudbedsIds = teamResult.rows.map((u) => u.user_id);
    if (teamCloudbedsIds.length === 0) return res.json([]);

    const activeUsersResult = await pgPool.query(
      `SELECT first_name, last_name, email, role FROM users WHERE cloudbeds_user_id = ANY($1::text[])`,
      [teamCloudbedsIds]
    );
    const roleMap = {
      super_admin: "Super Admin",
      owner: "Owner",
      user: "User",
    };
    const activeUsers = activeUsersResult.rows.map((user) => ({
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      email: user.email,
      status: "Active",
      role: roleMap[user.role] || "User",
    }));

    // --- FIX: Corrected column name from 'invited_by_user_id' to 'inviter_user_id' ---
    const pendingInvitesResult = await pgPool.query(
      `SELECT invitee_first_name, invitee_last_name, invitee_email FROM user_invitations WHERE inviter_user_id = ANY(SELECT user_id FROM users WHERE cloudbeds_user_id = ANY($1::text[])) AND status = 'pending'`,
      [teamCloudbedsIds]
    );
    const pendingInvites = pendingInvitesResult.rows.map((invite) => ({
      name: `${invite.invitee_first_name || ""} ${
        invite.invitee_last_name || ""
      }`.trim(),
      email: invite.invitee_email,
      status: "Pending",
      role: "User",
    }));

    const allMembers = [...activeUsers, ...pendingInvites];
    res.json(allMembers);
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Could not fetch team members." });
  }
});

/**
 * @route DELETE /api/users/remove
 * @description Deletes a user and all their associated data from the account.
 * @access Owner or Super Admin
 */
router.delete(
  "/remove",
  [requireUserApi, requireInvitePermission],
  async (req, res) => {
    const { email: emailToRemove } = req.body;
    const adminCloudbedsId = req.session.userId;

    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");

      const adminResult = await client.query(
        "SELECT email FROM users WHERE cloudbeds_user_id = $1",
        [adminCloudbedsId]
      );
      if (
        adminResult.rows.length > 0 &&
        adminResult.rows[0].email === emailToRemove
      ) {
        throw new Error("You cannot remove your own account.");
      }

      // --- FIX: Fetch the user's role to check permissions ---
      const userToRemoveResult = await client.query(
        "SELECT user_id, cloudbeds_user_id, role FROM users WHERE email = $1",
        [emailToRemove]
      );

      if (userToRemoveResult.rows.length === 0) {
        await client.query(
          "DELETE FROM user_invitations WHERE invitee_email = $1",
          [emailToRemove]
        );
        await client.query("COMMIT");
        return res.status(200).json({
          message: `Invitation for ${emailToRemove} has been successfully removed.`,
        });
      }

      const userToRemove = userToRemoveResult.rows[0];

      // --- FIX: Check the role property to prevent deletion of a super admin ---
      if (userToRemove.role === "super_admin") {
        throw new Error("This user is a Super Admin and cannot be removed.");
      }

      const {
        user_id: userPkToRemove,
        cloudbeds_user_id: userCloudbedsIdToRemove,
      } = userToRemove;
      await client.query("DELETE FROM user_properties WHERE user_id = $1", [
        userCloudbedsIdToRemove,
      ]);
      await client.query(
        "DELETE FROM user_invitations WHERE inviter_user_id = $1",
        [userPkToRemove]
      );
      await client.query("DELETE FROM users WHERE user_id = $1", [
        userPkToRemove,
      ]);

      await client.query("COMMIT");
      res.status(200).json({
        message: `User ${emailToRemove} has been successfully removed.`,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error removing user:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to remove user." });
    } finally {
      client.release();
    }
  }
);

/**
 * @route POST /api/users/disconnect-property
 * @description Disconnects a property from a user's account, removing their access.
 * @access User
 */
router.post("/disconnect-property", requireUserApi, async (req, res) => {
  const { propertyId } = req.body;
  const userCloudbedsId = req.session.userId;

  if (!propertyId) {
    return res.status(400).json({ error: "Property ID is required." });
  }

  const client = await pgPool.connect();
  try {
    // NEW: Before committing to any changes, call the Cloudbeds API to disable the app.
    // This is wrapped in its own try/catch block to ensure that a failure to communicate
    // with Cloudbeds does not prevent the user from disconnecting the property in our system.
    try {
      // Step 1: Get a fresh access token for the property using the adapter.
      const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);
      // Step 2: Call the new adapter function to set the app_state to disabled.
      await cloudbedsAdapter.setAppDisabled(accessToken, propertyId);
    } catch (cbError) {
      // Log the error for debugging, but do not stop the disconnection process.
      // This makes our application more resilient.
      console.error(
        `[Disconnect Route] Failed to disable app in Cloudbeds for property ${propertyId}, but proceeding with local disconnection. Error: ${cbError.message}`
      );
    }

    // --- Original database logic continues below ---

    // Start the database transaction.
    await client.query("BEGIN");

    // Delete the link between the user and the property.
    const deleteResult = await client.query(
      "DELETE FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [userCloudbedsId, propertyId]
    );

    // If no record was deleted, it means the user didn't have access, so we throw an error.
    if (deleteResult.rowCount === 0) {
      throw new Error(
        "Property connection not found or you do not have permission."
      );
    }

    // Check how many properties the user has left after this disconnection.
    const remainingPropsResult = await client.query(
      "SELECT COUNT(*) FROM user_properties WHERE user_id = $1",
      [userCloudbedsId]
    );
    const remainingProperties = parseInt(
      remainingPropsResult.rows[0].count,
      10
    );

    // If all database operations were successful, commit the transaction.
    await client.query("COMMIT");

    // Send a success response to the frontend.
    res.status(200).json({
      message: "Property disconnected successfully.",
      remainingProperties: remainingProperties,
    });
  } catch (error) {
    // If any error occurs in our database logic, roll back the transaction.
    await client.query("ROLLBACK");
    console.error("Error disconnecting property:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to disconnect property." });
  } finally {
    // ALWAYS release the database client back to the pool.
    client.release();
  }
});
/**
 * @route POST /api/users/link-property
 * @description Links an existing user to a property owned by the requester.
 * @access Account Owner
 */
router.post(
  "/link-property",
  [requireUserApi, requireAccountOwner],
  async (req, res) => {
    const { email, propertyId } = req.body;
    if (!email || !propertyId) {
      return res
        .status(400)
        .json({ error: "Email and propertyId are required." });
    }
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      const userToLinkResult = await client.query(
        "SELECT cloudbeds_user_id FROM users WHERE email = $1",
        [email]
      );
      if (userToLinkResult.rows.length === 0) {
        throw new Error(
          "User not found. Please ensure the user has an existing Market Pulse account."
        );
      }
      const userCloudbedsIdToLink = userToLinkResult.rows[0].cloudbeds_id;
      const existingLinkCheck = await client.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [userCloudbedsIdToLink, propertyId]
      );
      if (existingLinkCheck.rows.length > 0) {
        throw new Error("This user already has access to this property.");
      }
      await client.query(
        "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
        [userCloudbedsIdToLink, propertyId]
      );
      await client.query("COMMIT");
      res
        .status(200)
        .json({ message: `Successfully granted access to ${email}.` });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error linking property to user:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to grant access." });
    } finally {
      client.release();
    }
  }
);

/**
 * @route GET /api/users/owned-properties
 * @description Fetches properties for which the user is the Account Owner, or all properties for a Super Admin.
 * @access User
 */
router.get("/owned-properties", requireUserApi, async (req, res) => {
  const userCloudbedsId = req.session.userId;
  try {
    // --- FIX: Check the user's role from the session ---
    if (req.session.role === "super_admin") {
      const propertiesResult = await pgPool.query(
        `SELECT hotel_id AS property_id, property_name FROM hotels ORDER BY property_name`
      );
      res.json(propertiesResult.rows);
    } else {
      // Logic for 'owner' role to find all properties they can manage.
      const query = `
          SELECT up.property_id, h.property_name
          FROM user_properties up
          JOIN hotels h ON up.property_id = h.hotel_id
          WHERE up.user_id = $1 AND up.pms_credentials IS NOT NULL
          ORDER BY h.property_name;
      `;
      const propertiesResult = await pgPool.query(query, [userCloudbedsId]);
      res.json(propertiesResult.rows);
    }
  } catch (error) {
    console.error("Error fetching owned properties:", error);
    res.status(500).json({ error: "Could not check ownership status." });
  }
});

module.exports = router;
