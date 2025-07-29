// /api/routes/users.router.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto"); // Built-in Node.js module for cryptography

// Import shared utilities
const pgPool = require("../utils/db");
const { requireUserApi, requireAdminApi } = require("../utils/middleware");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * @route POST /api/users/invite
 * @description Creates an invitation for a new user and sends an email.
 * @access Admin
 */
router.post("/invite", requireAdminApi, async (req, res) => {
  try {
    const { invitee_first_name, invitee_last_name, invitee_email } = req.body;
    const inviter_user_id = req.session.userId; // This is the cloudbeds_user_id of the admin

    // --- Validation ---
    if (!invitee_first_name || !invitee_last_name || !invitee_email) {
      return res.status(400).json({
        error: "First name, last name, and email are required.",
      });
    }

    // Check if user already exists
    const existingUser = await pgPool.query(
      "SELECT user_id FROM users WHERE email = $1",
      [invitee_email]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "A user with this email address already exists.",
      });
    }

    // Check for a pending invitation
    const pendingInvite = await pgPool.query(
      "SELECT invitation_id FROM user_invitations WHERE invitee_email = $1 AND status = 'pending'",
      [invitee_email]
    );
    if (pendingInvite.rows.length > 0) {
      return res.status(409).json({
        error: "An invitation has already been sent to this email address.",
      });
    }

    // --- Create Invitation ---
    const invitation_token = crypto.randomBytes(32).toString("hex");
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + 7); // Invitation expires in 7 days

    // Get the inviter's user_id (primary key) from their cloudbeds_user_id
    const inviterResult = await pgPool.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
      [inviter_user_id]
    );
    if (inviterResult.rows.length === 0) {
      return res.status(404).json({ error: "Inviting user not found." });
    }
    const inviterPrimaryKey = inviterResult.rows[0].user_id;

    const newInvite = await pgPool.query(
      `
        INSERT INTO user_invitations 
          (inviter_user_id, invitee_email, invitee_first_name, invitee_last_name, invitation_token, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        inviterPrimaryKey,
        invitee_email,
        invitee_first_name,
        invitee_last_name,
        invitation_token,
        expires_at,
      ]
    );

    // --- Send Invitation Email ---
    const invitationLink = `https://www.market-pulse.io/api/auth/accept-invitation?token=${invitation_token}`;
    const msg = {
      to: invitee_email,
      from: "support@market-pulse.io", // Use a verified sender
      subject: "You've been invited to join Market Pulse",
      html: `
        <p>Hello ${invitee_first_name},</p>
        <p>You have been invited to join Market Pulse. Click the link below to accept the invitation and set up your account.</p>
        <a href="${invitationLink}">Accept Invitation</a>
        <p>This link will expire in 7 days.</p>
      `,
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
});
/**
 * @route GET /api/users/team
 * @description Fetches all active users and pending invitations for the user's account.
 * @access User
 */
/**
 * @route GET /api/users/team
 * @description Fetches all active users and pending invitations for the user's account.
 * @access User
 */
/**
 * @route GET /api/users/team
 * @description Fetches all active users and pending invitations for the user's account.
 * @access User
 */
router.get("/team", requireUserApi, async (req, res) => {
  // The cloudbeds_user_id of the person making the request.
  const requesterCloudbedsId = req.session.userId;

  const client = await pgPool.connect();
  try {
    // --- Step 1: Find all properties the current user has access to. ---
    const propertiesResult = await client.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1",
      [requesterCloudbedsId]
    );
    const propertyIds = propertiesResult.rows.map((p) => p.property_id);

    let activeUsers = [];
    let pendingInvites = [];

    if (propertyIds.length > 0) {
      // --- Step 2: Find all cloudbeds_user_ids that have access to ANY of these properties. This defines the "team". ---
      const teamMemberCloudbedsIdsResult = await client.query(
        "SELECT DISTINCT user_id FROM user_properties WHERE property_id = ANY($1::text[])",
        [propertyIds]
      );
      const teamCloudbedsIds = teamMemberCloudbedsIdsResult.rows.map(
        (u) => u.user_id
      );

      if (teamCloudbedsIds.length > 0) {
        // --- Step 3: Fetch the full user details for everyone on the team. ---
        const activeUsersResult = await client.query(
          `SELECT first_name, last_name, email FROM users WHERE cloudbeds_user_id = ANY($1::text[])`,
          [teamCloudbedsIds]
        );
        activeUsers = activeUsersResult.rows.map((user) => ({
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email,
          status: "Active",
        }));

        // --- Step 4: Fetch pending invitations sent by anyone on the team. ---
        // First, get the primary keys (user_id) of the team members.
        const teamMemberPksResult = await client.query(
          "SELECT user_id FROM users WHERE cloudbeds_user_id = ANY($1::text[])",
          [teamCloudbedsIds]
        );
        const teamMemberPks = teamMemberPksResult.rows.map((u) => u.user_id);

        if (teamMemberPks.length > 0) {
          const pendingInvitesResult = await client.query(
            `SELECT invitee_first_name, invitee_last_name, invitee_email
             FROM user_invitations 
             WHERE inviter_user_id = ANY($1::int[]) AND status = 'pending'`,
            [teamMemberPks]
          );
          pendingInvites = pendingInvitesResult.rows.map((invite) => ({
            name: `${invite.invitee_first_name || ""} ${
              invite.invitee_last_name || ""
            }`.trim(),
            email: invite.invitee_email,
            status: "Pending",
          }));
        }
      }
    } else {
      // If the user has no properties, they can only see themselves.
      const selfResult = await client.query(
        "SELECT first_name, last_name, email FROM users WHERE cloudbeds_user_id = $1",
        [requesterCloudbedsId]
      );
      if (selfResult.rows.length > 0) {
        const self = selfResult.rows[0];
        activeUsers.push({
          name: `${self.first_name || ""} ${self.last_name || ""}`.trim(),
          email: self.email,
          status: "Active",
        });
      }
    }

    // --- Step 5: Combine and send the final list ---
    const allMembers = [...activeUsers, ...pendingInvites];
    res.json(allMembers);
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to retrieve team data." });
  } finally {
    client.release();
  }
});

/**
 * @route DELETE /api/users/remove
 * @description Deletes a user and all their associated data from the account.
 * @access Admin
 */
router.delete("/remove", requireAdminApi, async (req, res) => {
  const { email: emailToRemove } = req.body;
  const adminCloudbedsId = req.session.userId; // The cloudbeds_user_id of the admin performing the action.

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    // --- Security Check 1: Get admin's email to prevent self-deletion ---
    const adminResult = await client.query(
      "SELECT email FROM users WHERE cloudbeds_user_id = $1",
      [adminCloudbedsId]
    );

    if (adminResult.rows.length === 0) {
      throw new Error("Admin account not found.");
    }

    if (adminResult.rows[0].email === emailToRemove) {
      throw new Error("You cannot remove your own account.");
    }

    // --- Security Check 2: Find the user to be deleted ---
    const userToRemoveResult = await client.query(
      "SELECT user_id, cloudbeds_user_id FROM users WHERE email = $1",
      [emailToRemove]
    );

    if (userToRemoveResult.rows.length === 0) {
      throw new Error("User to be removed not found.");
    }
    const {
      user_id: userPkToRemove,
      cloudbeds_user_id: userCloudbedsIdToRemove,
    } = userToRemoveResult.rows[0];

    // --- Data Deletion ---

    // 1. Delete any property links associated with the user
    [cite_start]; // Note: The user_properties table uses the string-based cloudbeds_user_id as the foreign key [cite: 350, 353]
    await client.query("DELETE FROM user_properties WHERE user_id = $1", [
      userCloudbedsIdToRemove,
    ]);

    // 2. Delete any pending invitations sent by this user
    await client.query(
      "DELETE FROM user_invitations WHERE inviter_user_id = $1",
      [userPkToRemove]
    );

    // 3. Delete the user record itself
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
    // Send back a specific error message from our checks or a generic one
    res.status(400).json({ error: error.message || "Failed to remove user." });
  } finally {
    client.release();
  }
});

module.exports = router;
