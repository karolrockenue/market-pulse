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
      const {
        invitee_first_name,
        invitee_last_name,
        invitee_email,
        property_id,
      } = req.body;
      const inviter_cloudbeds_id = req.session.userId; // Get the cloudbeds_user_id from the session.

      // Look up the internal user_id (primary key) using the cloudbeds_user_id from the session.
      // This is necessary because the user_invitations table has a foreign key constraint
      // that references the internal user_id, not the cloudbeds_user_id.
      const inviterResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [inviter_cloudbeds_id]
      );

      // If no user is found for the session ID, it's a server error or invalid session.
      if (inviterResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Forbidden: Inviter account not found." });
      }

      // Use the correct internal user_id for the database INSERT operation.
      const inviter_user_id = inviterResult.rows[0].user_id;

      if (
        !invitee_first_name ||
        !invitee_last_name ||
        !invitee_email ||
        !property_id
      ) {
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
        // --- FIX: Corrected column name from 'invited_by_user_id' to 'inviter_user_id' ---
        `INSERT INTO user_invitations (inviter_user_id, invitee_email, invitee_first_name, invitee_last_name, invitation_token, expires_at, property_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          inviter_user_id,
          invitee_email,
          invitee_first_name,
          invitee_last_name,
          invitation_token,
          expires_at,
          property_id,
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
// find this line/block
// replace with this
// replace with this
router.get("/team", requireUserApi, async (req, res) => {
  // This is the Cloudbeds-specific ID from the user's session.
  const requesterCloudbedsId = req.session.userId;

  try {
    // Step 1: Get the internal user_id (the integer PK) for the logged-in user
    // by looking them up using their cloudbeds_user_id from the session.
    const userResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [requesterCloudbedsId]
    );

    // If we can't find an internal user for the session, something is wrong.
    if (userResult.rows.length === 0) {
      // This can happen if a user exists in the session but was deleted from the DB.
      // Return an empty array to prevent the frontend from crashing.
      return res.json([]);
    }
    const currentUserId = userResult.rows[0].user_id;

    // Step 2: Find all properties this user has access to, using their internal user_id.
    const propertiesResult = await pgPool.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1",
      [currentUserId]
    );
    const propertyIds = propertiesResult.rows.map((p) => p.property_id);

    // If the user isn't linked to any properties, just return their own info.
    if (propertyIds.length === 0) {
      const selfResult = await pgPool.query(
        "SELECT first_name, last_name, email, role FROM users WHERE user_id = $1",
        [currentUserId]
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

    // Step 3: Find the internal user_ids of ALL users who have access to ANY of those properties.
    const teamResult = await pgPool.query(
      "SELECT DISTINCT user_id FROM user_properties WHERE property_id = ANY($1::int[])",
      [propertyIds]
    );
    const teamUserIds = teamResult.rows.map((u) => u.user_id);
    if (teamUserIds.length === 0) return res.json([]);

    // Step 4: Fetch the profile details for all those users using their internal user_ids.
    const activeUsersResult = await pgPool.query(
      `SELECT first_name, last_name, email, role FROM users WHERE user_id = ANY($1::int[])`,
      [teamUserIds]
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

    // Step 5: Fetch pending invitations for any of the shared properties.
    const pendingInvitesResult = await pgPool.query(
      `SELECT invitee_first_name, invitee_last_name, invitee_email FROM user_invitations WHERE property_id = ANY($1::int[]) AND status = 'pending'`,
      [propertyIds]
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

 * @description Disconnects a property from a user's account, removing their access.
 * @access User
 */
/**
 * @route POST /api/users/disconnect-property
 * @description Disconnects and DELETES a property from the entire system.
 * @access Account Owner or Super Admin
 */
// --- CHANGE: Added 'requireAccountOwner' to restrict this destructive action ---
router.post(
  "/disconnect-property",
  [requireUserApi, requireAccountOwner],
  async (req, res) => {
    const { propertyId } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: "Property ID is required." });
    }

    const client = await pgPool.connect();
    try {
      // Step 1: Notify Cloudbeds that the app is being disabled for this property.
      // This uses the owner's credentials to ensure the correct token is found.
      const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);
      await cloudbedsAdapter.setAppDisabled(accessToken, propertyId);

      // Step 2: Begin a transaction to delete all data associated with the property.
      await client.query("BEGIN");

      // --- NEW: Delete competitive set relationships ---
      // This cleans up any manual market definitions linked to this hotel.
      await client.query(
        "DELETE FROM hotel_comp_sets WHERE hotel_id = $1 OR competitor_hotel_id = $1",
        [propertyId]
      );

      // --- NEW: Delete all historical and upcoming performance metrics ---
      // This removes the core analytical data for the property.
      await client.query(
        "DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1",
        [propertyId]
      );

      // --- NEW: Delete all user links to this property ---
      // This removes access for every user, not just the current one.
      await client.query("DELETE FROM user_properties WHERE property_id = $1", [
        propertyId,
      ]);

      // --- NEW: Delete the master hotel record ---
      // This is the final step, removing the property from the hotels table.
      const deleteHotelResult = await client.query(
        "DELETE FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );

      // If no hotel was deleted, it means the propertyId was invalid.
      if (deleteHotelResult.rowCount === 0) {
        throw new Error("Property not found in the database.");
      }

      // Step 3: Commit the transaction if all deletions were successful.
      await client.query("COMMIT");

      res.status(200).json({
        message:
          "Property has been successfully disconnected and all associated data has been removed.",
        // We set remainingProperties to a non-zero value to prevent an unnecessary redirect on the frontend.
        // The page will simply refresh its list, and the deleted property will be gone.
        remainingProperties: 1,
      });
    } catch (error) {
      // If any step fails, roll back the entire transaction.
      await client.query("ROLLBACK");
      console.error("Error during full property deletion:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to delete property." });
    } finally {
      // Always release the database client.
      client.release();
    }
  }
);
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
      // replace with this
      // Find the user's internal primary key (`user_id`) using their email address.
      // This is the correct foreign key to use for the `user_properties` table.
      const userToLinkResult = await client.query(
        "SELECT user_id FROM users WHERE email = $1",
        [email]
      );

      // Check if a user with the provided email exists in the system.
      if (userToLinkResult.rows.length === 0) {
        throw new Error(
          "User not found. Please ensure the user has an existing Market Pulse account."
        );
      }

      // Get the correct user_id from the query result.
      const userIdToLink = userToLinkResult.rows[0].user_id;

      // Verify that this user doesn't already have access to the target property.
      const existingLinkCheck = await client.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [userIdToLink, propertyId]
      );

      // If a link already exists, inform the admin.
      if (existingLinkCheck.rows.length > 0) {
        throw new Error("This user already has access to this property.");
      }

      // Insert the new record into user_properties using the correct internal user_id.
      await client.query(
        "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
        [userIdToLink, propertyId]
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
