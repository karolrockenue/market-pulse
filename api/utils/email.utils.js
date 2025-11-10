// File: /api/utils/email.utils.js

const sgMail = require('@sendgrid/mail');

// Set the API key once for the entire application
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Define a default sender email from your environment variables
//
const DEFAULT_SENDER_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@market-pulse.io';

/**
 * A centralized utility for sending emails via SendGrid.
 *
 * @param {object} msg - A SendGrid message object.
 * @param {string|string[]} msg.to - The recipient(s).
 * @param {string} msg.subject - The email subject.
 * @param {string} msg.html - The HTML body of the email.
 * @param {object[]} [msg.attachments] - Optional array of SendGrid attachment objects.
 * @param {object|string} [msg.from] - Optional sender. Defaults to { name: 'Market Pulse', email: DEFAULT_SENDER_EMAIL }.
 * @param {string} [msg.replyTo] - Optional reply-to address.
 */
async function sendEmail(msg) {
  // Define a default "from" object, which can be overridden
  const defaultFrom = {
    name: 'Market Pulse',
    email: DEFAULT_SENDER_EMAIL,
  };

  const messageToSend = {
    ...msg,
    from: msg.from || defaultFrom,
  };

  try {
    await sgMail.send(messageToSend);
    console.log(`[email.utils.js] Email sent successfully to: ${Array.isArray(messageToSend.to) ? messageToSend.to.join(',') : messageToSend.to}`);
  } catch (error) {
    console.error('[email.utils.js] Error sending email:', error);
    
    // Log detailed SendGrid errors if available
    if (error.response) {
      console.error(error.response.body);
    }
    
    // Re-throw the error to be handled by the calling function
    // (e.g., the cron job or the API route)
    throw new Error('Failed to send email.');
  }
}

module.exports = {
  sendEmail,
};