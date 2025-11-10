// File: api/utils/emailTemplates.js

/**
 * This function is copied directly from your MagicLinkEmail.tsx file.
 * It generates the final, robust HTML string for the magic link email.
 */
function getMagicLinkEmailHTML(userFirstName = "there", magicLinkUrl) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log in to Market Pulse</title>
  </head>
<body style="margin: 0; padding: 0; background-color: #1A1A18; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #1A1A18;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #252521; border-radius: 8px;">
          <tr>
            <td style="padding: 32px;">
              <h1 style="color: #FAFF6A; font-size: 24px; font-weight: 600; margin: 0 0 32px 0; letter-spacing: -0.5px;">Market Pulse</h1>

              <p style="color: #E5E5E5; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">Hello ${userFirstName},</p>

              <p style="color: #E5E5E5; font-size: 16px; line-height: 1.5; margin: 0 0 32px 0;">Click the button below to securely log in to your Market Pulse dashboard.</p>

              <table role="presentation" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #FAFF6A;">
                    <a href="${magicLinkUrl}" style="display: inline-block; background-color: #FAFF6A; color: #1A1A18; font-size: 16px; font-weight: 600; padding: 14px 28px; border-radius: 6px; text-decoration: none;">Log in to Market Pulse</a>
                  </td>
                </tr>
              </table>

              <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5; margin: 0 0 32px 0;">This link is valid for 15 minutes.</p>

              <div style="height: 1px; background-color: #3A3A35; margin: 32px 0;"></div>

              <p style="color: #9CA3AF; font-size: 12px; line-height: 1.4; margin: 0 0 8px 0;">If you did not request this login, you can safely ignore this email.</p>
              <p style="color: #9CA3AF; font-size: 12px; line-height: 1.4; margin: 0;">© ${currentYear} Market Pulse. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * [NEW] Generates the HTML for the scheduled Shreeji Report email.
 *
 * @param {string} reportName - The name of the scheduled report.
 * @param {string} hotelName - The name of the hotel.
 * @param {string} reportDate - The date the report was generated for (e.g., "November 10, 2025").
 * @param {string} recipientName - A name to personalize the greeting (e.g., "Team").
 * @returns {string} The full HTML string for the email.
 */
function getShreejiReportEmailHTML(reportName, hotelName, reportDate, recipientName = "Team") {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Scheduled Report</title>
  </head>
<body style="margin: 0; padding: 0; background-color: #1A1A18; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #1A1A18;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #252521; border-radius: 8px;">
          <tr>
            <td style="padding: 32px;">
              <h1 style="color: #FAFF6A; font-size: 24px; font-weight: 600; margin: 0 0 32px 0; letter-spacing: -0.5px;">Market Pulse</h1>

              <p style="color: #E5E5EE; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">Hello ${recipientName},</p>

              <p style="color: #E5E5E5; font-size: 16px; line-height: 1.5; margin: 0 0 32px 0;">
                Your scheduled report, <strong>"${reportName}"</strong>, is attached and ready for review.
              </p>

              <div style="padding: 16px; background-color: #1A1A18; border-radius: 6px; margin-bottom: 32px;">
                <p style="color: #E5E5E5; font-size: 14px; line-height: 1.5; margin: 0 0 8px 0;"><strong>Report Details:</strong></p>
                <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5; margin: 0;"><strong>Hotel:</strong> ${hotelName}</p>
                <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5; margin: 0;"><strong>Date:</strong> ${reportDate}</p>
              </div>

              <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5; margin: 0 0 32px 0;">
                This is an automated message. Please do not reply directly to this email.
              </p>

              <div style="height: 1px; background-color: #3A3A35; margin: 32px 0;"></div>

              <p style="color: #9CA3AF; font-size: 12px; line-height: 1.4; margin: 0;">© ${currentYear} Market Pulse. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// [REPLACE IT WITH THIS]
module.exports = {
  getMagicLinkEmailHTML,
  getShreejiReportEmailHTML // Add the new function here
};