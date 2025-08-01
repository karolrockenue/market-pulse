// /api/routes/users.router.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto"); // Built-in Node.js module for cryptography

// Import shared utilities
const pgPool = require("../utils/db");
const {
  requireUserApi,
  requireAdminApi,
  requireAccountOwner,
} = require("../utils/middleware");
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
        error:
          "A user with this email address already exists. Please use the 'Grant Access' button instead.",
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
router.get("/team", requireUserApi, async (req, res) => {
  console.log("--- [DEBUG] START /api/users/team ---");
  const requesterCloudbedsId = req.session.userId;
  console.log(
    `[DEBUG] 1. Requester cloudbeds_user_id from session: ${requesterCloudbedsId}`
  );

  const client = await pgPool.connect();
  try {
    // --- Step 1: Find properties for the requester
    const propertiesResult = await client.query(
      "SELECT property_id FROM user_properties WHERE user_id = $1",
      [requesterCloudbedsId]
    );
    const propertyIds = propertiesResult.rows.map((p) => p.property_id);
    console.log(`[DEBUG] 2. Found property IDs for requester:`, propertyIds);

    let teamCloudbedsIds = [];
    if (propertyIds.length > 0) {
      // If the user has properties, the team is everyone who shares them.
      const teamResult = await client.query(
        "SELECT DISTINCT user_id FROM user_properties WHERE property_id = ANY($1::int[])",
        [propertyIds]
      );
      teamCloudbedsIds = teamResult.rows.map((u) => u.user_id);
    } else {
      // If the user has no properties, the "team" is just themself for now.
      teamCloudbedsIds.push(requesterCloudbedsId);
    }
    console.log(
      `[DEBUG] 3. Defined team members by cloudbeds_user_id:`,
      teamCloudbedsIds
    );

    // If teamCloudbedsIds is empty for some reason, we can't proceed.
    if (teamCloudbedsIds.length === 0) {
      console.log("[DEBUG] 3a. No team members found, returning empty array.");
      return res.json([]);
    }

    // --- Step 2: Fetch all active users on the team ---
    const activeUsersResult = await client.query(
      `SELECT first_name, last_name, email FROM users WHERE cloudbeds_user_id = ANY($1::text[])`,
      [teamCloudbedsIds]
    );
    const activeUsers = activeUsersResult.rows.map((user) => ({
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      email: user.email,
      status: "Active",
    }));
    console.log(`[DEBUG] 4. Fetched active users:`, activeUsers);

    // --- Step 3: Fetch all pending invitations sent by anyone on the team ---
    const teamPksResult = await client.query(
      "SELECT user_id FROM users WHERE cloudbeds_user_id = ANY($1::text[])",
      [teamCloudbedsIds]
    );
    const teamMemberPks = teamPksResult.rows.map((u) => u.user_id);
    console.log(`[DEBUG] 5. Fetched team member primary keys:`, teamMemberPks);

    let pendingInvites = [];
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
    console.log(`[DEBUG] 6. Fetched pending invites:`, pendingInvites);

    // --- Step 4: Combine and send the final list ---
    const allMembers = [...activeUsers, ...pendingInvites];
    console.log(`[DEBUG] 7. Final combined list to be sent:`, allMembers);
    console.log("--- [DEBUG] END /api/users/team ---");

    res.json(allMembers);
  } catch (error) {
    console.error(
      "--- [CRITICAL DEBUG] Error fetching team members: ---",
      error
    );
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

/**
 * @route POST /api/users/disconnect-property
 * @description Disconnects a property from a user's account, removing their access.
 * @access User
 */
router.post("/disconnect-property", requireUserApi, async (req, res) => {
  // Extract propertyId from the request body
  const { propertyId } = req.body;
  // Get the user's unique ID from their session
  const userCloudbedsId = req.session.userId;

  // Basic validation to ensure a property ID was sent
  if (!propertyId) {
    return res.status(400).json({ error: "Property ID is required." });
  }

  // Get a client from the connection pool to run the database transaction
  const client = await pgPool.connect();
  try {
    // Start a database transaction
    await client.query("BEGIN");

    // Execute the DELETE query to remove the specific link between the user and the property.
    // This is the core action that "disconnects" the property.
    const deleteResult = await client.query(
      "DELETE FROM user_properties WHERE user_id = $1 AND property_id = $2",
      [userCloudbedsId, propertyId]
    );

    // If no rows were deleted, it means the connection didn't exist or the user
    // doesn't have permission. This prevents accidental success messages.
    if (deleteResult.rowCount === 0) {
      throw new Error(
        "Property connection not found or you do not have permission."
      );
    }

    // After deleting, check how many properties the user has left.
    const remainingPropsResult = await client.query(
      "SELECT COUNT(*) FROM user_properties WHERE user_id = $1",
      [userCloudbedsId]
    );

    // Parse the count of remaining properties
    const remainingProperties = parseInt(
      remainingPropsResult.rows[0].count,
      10
    );

    // If all queries were successful, commit the transaction to save the changes
    await client.query("COMMIT");

    // Send a success response back to the frontend, including the number of remaining properties.
    // The frontend will use this to decide whether to redirect the user.
    res.status(200).json({
      message: "Property disconnected successfully.",
      remainingProperties: remainingProperties,
    });
  } catch (error) {
    // If any error occurred, roll back the transaction to undo any changes
    await client.query("ROLLBACK");
    console.error("Error disconnecting property:", error);
    res.status(400).json({
      error: error.message || "Failed to disconnect property.",
    });
  } finally {
    // Always release the client back to the pool
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
    // requireUserApi confirms the user is logged in.
    // requireAccountOwner confirms they own the property they're trying to share.

    const { email, propertyId } = req.body; // The email of the user to grant access to, and the property to share.

    // --- Validation ---
    if (!email || !propertyId) {
      return res
        .status(400)
        .json({ error: "Email and propertyId are required." });
    }

    const client = await pgPool.connect();
    try {
      // Start a database transaction for safety.
      await client.query("BEGIN");

      // --- Find the user to be linked ---
      const userToLinkResult = await client.query(
        "SELECT cloudbeds_user_id FROM users WHERE email = $1",
        [email]
      );

      if (userToLinkResult.rows.length === 0) {
        // If the user doesn't exist in our system, we can't link them.
        throw new Error(
          "User not found. Please ensure the user has an existing Market Pulse account."
        );
      }
      const userCloudbedsIdToLink = userToLinkResult.rows[0].cloudbeds_user_id;

      // --- Check if the user is already linked to this property ---
      const existingLinkCheck = await client.query(
        "SELECT 1 FROM user_properties WHERE user_id = $1 AND property_id = $2",
        [userCloudbedsIdToLink, propertyId]
      );

      if (existingLinkCheck.rows.length > 0) {
        throw new Error("This user already has access to this property.");
      }

      // --- Create the new property link ---
      // The status is 'connected' and pms_credentials will be null by default,
      // which correctly marks them as a Team Member for this property.
      await client.query(
        "INSERT INTO user_properties (user_id, property_id, status) VALUES ($1, $2, 'connected')",
        [userCloudbedsIdToLink, propertyId]
      );

      // If all steps succeed, commit the transaction.
      await client.query("COMMIT");

      res
        .status(200)
        .json({ message: `Successfully granted access to ${email}.` });
    } catch (error) {
      // If any error occurs, roll back all changes.
      await client.query("ROLLBACK");
      console.error("Error linking property to user:", error);
      // Send back a specific error message from our checks or a generic one.
      res
        .status(400)
        .json({ error: error.message || "Failed to grant access." });
    } finally {
      // Always release the database client back to the pool.
      client.release();
    }
  }
);

/**
 * @route GET /api/user/owned-properties
 * @description Fetches properties for which the user is the Account Owner.
 * @access User
 */
router.get("/owned-properties", requireUserApi, async (req, res) => {
  // Get the logged-in user's ID from the session.
  const userCloudbedsId = req.session.userId;

  try {
    // This query joins user_properties with the hotels table to get property names.
    // The key is "WHERE up.pms_credentials IS NOT NULL", which is our definition of an Account Owner.
    const query = `
      SELECT
        up.property_id,
        h.property_name
      FROM
        user_properties up
      JOIN
        hotels h ON up.property_id = h.hotel_id
      WHERE
        up.user_id = $1 AND up.pms_credentials IS NOT NULL
    `;

    const result = await pgPool.query(query, [userCloudbedsId]);

    // Return the list of owned properties. The frontend will use this to populate the dropdown.
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching owned properties:", error);
    res.status(500).json({ error: "Failed to fetch owned properties." });
  }
});

module.exports = router;
