// File: api/utils/emailTemplates.js

/**
 * This function is copied directly from your MagicLinkEmail.tsx file.
 * It generates the final, robust HTML string for the magic link email.
 */
function getMagicLinkEmailHTML(userFirstName = "there", magicLinkUrl) {
  const headline = "Log In to Market Pulse";
  const bodyText = `
    Hello ${userFirstName},<br><br>
    Click the button below to securely log in to your dashboard.<br><br>
    <span style="font-size: 13px; color: #888;">This link is valid for 30 minutes. If you did not request this login, you can safely ignore this email.</span>
  `;
  return getMarketPulseEmailHTML(headline, bodyText, magicLinkUrl, "Log In");
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
// [WITH THIS]

const getShreejiReportEmailHTML = (reportName, hotelName, reportDate, recipientName) => {
  const headline = "Your Report is Ready";
  const bodyText = `
    Hello ${recipientName},<br><br>
    Your scheduled report, "<strong>${reportName}</strong>" for <strong>${hotelName}</strong> (Date: ${reportDate}), is attached and ready for review.
  `;
  
  // Use the new reusable wrapper
  return getMarketPulseEmailHTML(headline, bodyText);
};

// [ADD THIS NEW FUNCTION]

const getStandardReportEmailHTML = (reportName, reportPeriod, startDate, endDate) => {
  const headline = "Your Report is Ready";
  const bodyText = `
    Hello,<br><br>
    Your scheduled report, "<strong>${reportName}</strong>", is attached.<br><br>
    This report was generated for the <strong>${reportPeriod}</strong> period (from ${startDate} to ${endDate}).
  `;
  
  // Use the new reusable wrapper
  return getMarketPulseEmailHTML(headline, bodyText);
};
// [ADD THIS NEW FUNCTION]

// Branded Accent wrapper — dark navy header, light content, modern footer.
function getMarketPulseEmailHTML(headline, bodyText, buttonLink, buttonText) {
  const appUrl = process.env.BASE_URL || "https://www.market-pulse.io";
  const finalButtonLink = buttonLink || appUrl;
  const finalButtonText = buttonText || "View Dashboard";

  return `
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; color: #333;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 32px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="border-radius: 12px; overflow: hidden; background-color: #ffffff;">
              <!-- Dark header -->
              <tr>
                <td style="background: #0f172a; padding: 20px 36px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td><span style="font-size: 15px; font-weight: 600; letter-spacing: 1px; color: #ffffff;">( MARKET PULSE )</span></td>
                  </tr></table>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 32px 36px;">
                  <h1 style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 20px;">${headline}</h1>
                  <div style="font-size: 14px; line-height: 1.6; color: #475569;">
                    ${bodyText}
                  </div>
                  <table border="0" cellpadding="0" cellspacing="0" style="padding-top: 28px;">
                    <tr>
                      <td>
                        <a href="${finalButtonLink}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; background: #0f172a; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block;">
                          ${finalButtonText}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 36px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
                  <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                    &copy; ${new Date().getFullYear()} Market Pulse
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  `;
}

// [WITH THIS]
module.exports = {
  getMagicLinkEmailHTML,
  getShreejiReportEmailHTML,
  getStandardReportEmailHTML, // [NEW]
  getMarketPulseEmailHTML,  // [NEW]
  // ... other exports ...
};