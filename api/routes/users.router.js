// /api/routes/users.router.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const pgPool = require("../utils/db");
const {
  requireUserApi,
  requireAccountOwner,
  requireManagePermission,
} = require("../utils/middleware");
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const cloudbedsAdapter = require("../adapters/cloudbedsAdapter");

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
      const inviter_cloudbeds_id = req.session.userId;
      const inviterResult = await pgPool.query(
        "SELECT user_id FROM users WHERE cloudbeds_user_id = $1",
        [inviter_cloudbeds_id]
      );
      if (inviterResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Forbidden: Inviter account not found." });
      }
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

router.get("/team", requireUserApi, async (req, res) => {
  try {
    const { role, userId, email: sessionEmail } = req.session;
    const propertyIdForQuery =
      role === "super_admin" ? req.query.propertyId : null;

    let activeUsers = [];
    let propertyIdsForInvites = [];

    const roleMap = {
      super_admin: "Super Admin",
      owner: "Owner",
      user: "User",
    };

    if (role === "super_admin" && propertyIdForQuery) {
      console.log(
        `[GET /TEAM] Admin fetching team for propertyId: ${propertyIdForQuery}`
      );
      const userIdsResult = await pgPool.query(
        `SELECT DISTINCT user_id FROM user_properties WHERE property_id = $1`,
        [propertyIdForQuery]
      );
      const teamUserIds = userIdsResult.rows.map((row) => row.user_id);
      console.log(
        `[GET /TEAM] Found linked user IDs from user_properties: ${JSON.stringify(
          teamUserIds
        )}`
      );

      if (teamUserIds.length > 0) {
        const teamResult = await pgPool.query(
          `SELECT first_name, last_name, email, role FROM users
           WHERE cloudbeds_user_id = ANY($1::text[]) OR user_id::text = ANY($1::text[])`,
          [teamUserIds]
        );
        console.log(
          `[GET /TEAM] Found ${teamResult.rowCount} user profiles for those IDs.`
        );
        activeUsers = teamResult.rows.map((user) => ({
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          email: user.email,
          status: "Active",
          role: roleMap[user.role] || "User",
        }));
      } else {
        console.log(
          `[GET /TEAM] No linked user IDs found for property ${propertyIdForQuery}.`
        );
      }
      propertyIdsForInvites = [propertyIdForQuery];
      const isAdminInList = activeUsers.some(
        (user) => user.email === sessionEmail
      );
      if (!isAdminInList) {
        const adminDetailsResult = await pgPool.query(
          "SELECT first_name, last_name, email, role FROM users WHERE cloudbeds_user_id = $1",
          [userId]
        );
        if (adminDetailsResult.rows.length > 0) {
          console.log("[GET /TEAM] Manually adding viewing admin to the list.");
          const adminUser = adminDetailsResult.rows[0];
          activeUsers.unshift({
            name: `${adminUser.first_name || ""} ${
              adminUser.last_name || ""
            }`.trim(),
            email: adminUser.email,
            status: "Active",
            role: roleMap[adminUser.role] || "User",
          });
        }
      }
    } else {
      const propertiesResult = await pgPool.query(
        "SELECT property_id FROM user_properties WHERE user_id = $1",
        [userId]
      );
      const propertyIds = propertiesResult.rows.map((p) => p.property_id);
      propertyIdsForInvites = propertyIds;
      if (propertyIds.length > 0) {
        const teamResult = await pgPool.query(
          "SELECT DISTINCT user_id FROM user_properties WHERE property_id = ANY($1::int[])",
          [propertyIds]
        );
        const teamUserIds = teamResult.rows.map((u) => u.user_id);
        if (teamUserIds.length > 0) {
          const activeUsersResult = await pgPool.query(
            `SELECT first_name, last_name, email, role FROM users 
             WHERE cloudbeds_user_id = ANY($1::text[]) OR user_id::text = ANY($1::text[])`,
            [teamUserIds]
          );
          activeUsers = activeUsersResult.rows.map((user) => ({
            name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
            email: user.email,
            status: "Active",
            role: roleMap[user.role] || "User",
          }));
        }
      }
    }
    let pendingInvites = [];
    if (propertyIdsForInvites.length > 0) {
      const pendingInvitesResult = await pgPool.query(
        `SELECT invitee_first_name, invitee_last_name, invitee_email FROM user_invitations WHERE property_id = ANY($1::int[]) AND status = 'pending'`,
        [propertyIdsForInvites]
      );
      pendingInvites = pendingInvitesResult.rows.map((invite) => ({
        name: `${invite.invitee_first_name || ""} ${
          invite.invitee_last_name || ""
        }`.trim(),
        email: invite.invitee_email,
        status: "Pending",
        role: "User",
      }));
    }
    res.json([...activeUsers, ...pendingInvites]);
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Could not fetch team members." });
  }
});

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
      const removerRole = req.session.role;
      const removeeRole = userToRemove.role;
      if (removeeRole === "super_admin") {
        throw new Error("A Super Admin account cannot be removed.");
      }
      if (removerRole === "owner" && removeeRole !== "user") {
        throw new Error(
          "You do not have permission to remove an Account Owner."
        );
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
      const accessToken = await cloudbedsAdapter.getAccessToken(propertyId);
      await cloudbedsAdapter.setAppDisabled(accessToken, propertyId);
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM hotel_comp_sets WHERE hotel_id = $1 OR competitor_hotel_id = $1",
        [propertyId]
      );
      await client.query(
        "DELETE FROM daily_metrics_snapshots WHERE hotel_id = $1",
        [propertyId]
      );
      await client.query("DELETE FROM user_properties WHERE property_id = $1", [
        propertyId,
      ]);
      const deleteHotelResult = await client.query(
        "DELETE FROM hotels WHERE hotel_id = $1",
        [propertyId]
      );
      if (deleteHotelResult.rowCount === 0) {
        throw new Error("Property not found in the database.");
      }
      await client.query("COMMIT");
      res.status(200).json({
        message:
          "Property has been successfully disconnected and all associated data has been removed.",
        remainingProperties: 1,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error during full property deletion:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to delete property." });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/link-property",
  [requireUserApi, requireManagePermission],
  async (req, res) => {
    const { email, propertyId } = req.body;
    if (!email || !propertyId) {
      return res
        .status(400)
        .json({ error: "Email and propertyId are required." });
    }
    const client = await pgPool.connect();
    try {
      console.log(
        `[LINK-PROPERTY] Admin attempting to link email '${email}' to propertyId '${propertyId}'`
      );
      await client.query("BEGIN");
      const userToLinkResult = await client.query(
        "SELECT user_id FROM users WHERE email = $1",
        [email]
      );
      if (userToLinkResult.rows.length === 0) {
        console.error(`[LINK-PROPERTY] User not found for email: ${email}`);
        throw new Error(
          "User not found. Please ensure the user has an existing Market Pulse account."
        );
      }
      const userIdToLink = userToLinkResult.rows[0].user_id;
      console.log(
        `[LINK-PROPERTY] Found user with internal ID: ${userIdToLink}`
      );
      const existingLinkCheck = await client.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [userIdToLink.toString(), propertyId]
      );
      if (existingLinkCheck.rows.length > 0) {
        console.warn(
          `[LINK-PROPERTY] Link already exists for user ID '${userIdToLink}' and property ID '${propertyId}'`
        );
        throw new Error("This user already has access to this property.");
      }
      console.log(
        `[LINK-PROPERTY] Inserting into user_properties with user_id: '${userIdToLink.toString()}' and property_id: ${propertyId}`
      );
      const insertResult = await client.query(
        "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
        [userIdToLink.toString(), propertyId]
      );
      console.log(
        `[LINK-PROPERTY] Insert result rowCount: ${insertResult.rowCount}`
      );
      await client.query("COMMIT");
      console.log(
        `[LINK-PROPERTY] Transaction COMMITTED successfully for email '${email}'.`
      );
      res
        .status(200)
        .json({ message: `Successfully granted access to ${email}.` });
    } catch (error) {
      console.error(
        `[LINK-PROPERTY] Error in transaction, ROLLING BACK. Error: ${error.message}`
      );
      await client.query("ROLLBACK");
      res
        .status(400)
        .json({ error: error.message || "Failed to grant access." });
    } finally {
      client.release();
    }
  }
);

router.get("/owned-properties", requireUserApi, async (req, res) => {
  const userCloudbedsId = req.session.userId;
  try {
    if (req.session.role === "super_admin") {
      const propertiesResult = await pgPool.query(
        `SELECT hotel_id AS property_id, property_name FROM hotels ORDER BY property_name`
      );
      res.json(propertiesResult.rows);
    } else {
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
