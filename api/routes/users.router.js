// /api/routes/users.router.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto"); // Built-in Node.js module for cryptography

// Import shared utilities
const pgPool = require("../utils/db");
const { requireAdminApi } = require("../utils/middleware"); // Only admins can invite users
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

module.exports = router;
