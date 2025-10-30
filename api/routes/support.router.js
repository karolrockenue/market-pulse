// File: api/routes/support.router.js

// Import Express to create the router
const express = require('express');
const router = express.Router();

// Import the SendGrid mail service
// We will install this in the next step
const sgMail = require('@sendgrid/mail');

// Set the API key from environment variables
// This MUST be set in your Vercel project settings
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Define the support email address from the frontend
const SUPPORT_EMAIL_TO = 'support@market-pulse.io';
// Define the "from" email from environment variables
const SUPPORT_EMAIL_FROM = process.env.SENDGRID_FROM_EMAIL;

/**
 * POST /api/support/submit
 * Receives a support request from the frontend, validates it,
 * and sends it as an email to the support inbox.
 */
router.post('/submit', async (req, res) => {
  try {
    // 1. Destructure and validate the incoming data
    const { email, subject, message, requestType, pmsType } = req.body;

    if (!email || !subject || !message || !requestType) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // 2. Build a clean HTML body for the email
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Support Request: [${requestType}]</h2>
        <p>You have received a new support request from the Market Pulse contact form.</p>
        <hr>
        <h3>Request Details:</h3>
        <ul>
          <li><strong>From:</strong> ${email}</li>
          <li><strong>Subject:</strong> ${subject}</li>
          <li><strong>Request Type:</strong> ${requestType}</li>
          ${pmsType ? `<li><strong>PMS System:</strong> ${pmsType}</li>` : ''}
        </ul>
        <h3>Message:</h3>
        <p style="background-color: #f4f4f4; padding: 15px; border-radius: 5px;">
          ${message.replace(/\n/g, '<br>')}
        </p>
      </div>
    `;

    // 3. Define the email message object
    const msg = {
      to: SUPPORT_EMAIL_TO,       // The email address receiving the support ticket
      from: SUPPORT_EMAIL_FROM,   // Your verified SendGrid "from" email
      replyTo: email,             // Set reply-to to the user's email
      subject: `New Support Request: ${subject}`, // Email subject
      html: htmlBody,             // The HTML content
    };

    // 4. Send the email
    await sgMail.send(msg);

    // 5. Send success response
    res.status(200).json({ success: true, message: 'Request submitted successfully.' });

  } catch (error) {
    // Log the error for debugging
    console.error('Error in /api/support/submit:', error);

    // Handle potential SendGrid errors
    if (error.response) {
      console.error(error.response.body);
    }

    res.status(500).json({ error: 'Failed to send support request.' });
  }
});

// Export the router to be used in server.js
module.exports = router;