// api/utils/report-templates/takings-email.template.js

const { format } = require("date-fns");

/**
 * Formats a number as GBP currency
 */
const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value) => {
  return `${(value || 0).toFixed(1)}%`;
};

/**
 * Generates the HTML Body for the Takings Report Email.
 * Uses inline styles for maximum email client compatibility.
 */
function generateTakingsEmailHTML(reportName, dateRange, data) {
  // Calculate Totals
  const totals = data.reduce(
    (acc, hotel) => ({
      cash: acc.cash + (hotel.takings?.cash || 0),
      cards: acc.cards + (hotel.takings?.cards || 0),
      bacs: acc.bacs + (hotel.takings?.bacs || 0),
      extras: acc.extras + (hotel.revenue?.extras?.total || 0),
      totalRevenue: acc.totalRevenue + (hotel.revenue?.totalRevenue || 0),
    }),
    { cash: 0, cards: 0, bacs: 0, extras: 0, totalRevenue: 0 }
  );

  // Styles
  const style = {
    body: "background-color: #1D1D1C; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e5e5e5; padding: 20px;",
    container:
      "max-width: 1000px; margin: 0 auto; background-color: #1A1A1A; border: 1px solid #333333; border-radius: 8px; overflow: hidden;",
    header:
      "background-color: #0a0a0a; padding: 20px; border-bottom: 1px solid #333333;",
    title: "color: #faff6a; font-size: 24px; margin: 0; font-weight: 600;",
    subtitle: "color: #9ca3af; font-size: 14px; margin-top: 5px;",
    table: "width: 100%; border-collapse: collapse; font-size: 13px;",
    th: "text-align: right; padding: 12px; color: #9ca3af; font-weight: 600; border-bottom: 1px solid #333333; background-color: #151515; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;",
    thLeft:
      "text-align: left; padding: 12px; color: #9ca3af; font-weight: 600; border-bottom: 1px solid #333333; background-color: #151515; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;",
    td: "padding: 12px; text-align: right; color: #d1d5db; border-bottom: 1px solid #2a2a2a; font-family: monospace;",
    tdLeft:
      "padding: 12px; text-align: left; color: #e5e5e5; border-bottom: 1px solid #2a2a2a; font-weight: 500;",
    totalRow: "background-color: #252525; font-weight: bold; color: #ffffff;",
    highlight: "color: #faff6a;",
  };

  const rowsHtml = data
    .map((hotel, index) => {
      const bg = index % 2 === 0 ? "#1A1A1A" : "#151515";
      return `
      <tr style="background-color: ${bg};">
        <td style="${style.tdLeft}">${hotel.name}</td>
        <td style="${style.td}">${formatCurrency(hotel.takings?.cash || 0)}</td>
        <td style="${style.td}">${formatCurrency(
        hotel.takings?.cards || 0
      )}</td>
        <td style="${style.td}">${formatCurrency(hotel.takings?.bacs || 0)}</td>
        <td style="${style.td}">${formatCurrency(
        hotel.revenue?.extras?.total || 0
      )}</td>
        <td style="${
          style.td
        } color: #ffffff; font-weight: 600;">${formatCurrency(
        hotel.revenue?.totalRevenue || 0
      )}</td>
        <td style="${style.td}">${formatPercent(
        hotel.revenue?.occupancy || 0
      )}</td>
        <td style="${style.td}">${formatCurrency(hotel.revenue?.adr || 0)}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="${style.body}">
      <div style="${style.container}">
        <div style="${style.header}">
          <h1 style="${style.title}">${reportName}</h1>
          <p style="${style.subtitle}">Period: ${dateRange.startDate} to ${
    dateRange.endDate
  }</p>
        </div>

        <table style="${style.table}" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th style="${style.thLeft}">Hotel Name</th>
              <th style="${style.th}">Cash</th>
              <th style="${style.th}">Cards</th>
              <th style="${style.th}">BACS</th>
              <th style="${style.th}">Extras</th>
              <th style="${style.th} color: #faff6a;">Total Revenue</th>
              <th style="${style.th}">Occ %</th>
              <th style="${style.th}">ADR</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="${style.totalRow}">
              <td style="${
                style.tdLeft
              } border-top: 2px solid #444;">TOTALS</td>
              <td style="${
                style.td
              } border-top: 2px solid #444;">${formatCurrency(totals.cash)}</td>
              <td style="${
                style.td
              } border-top: 2px solid #444;">${formatCurrency(
    totals.cards
  )}</td>
              <td style="${
                style.td
              } border-top: 2px solid #444;">${formatCurrency(totals.bacs)}</td>
              <td style="${
                style.td
              } border-top: 2px solid #444;">${formatCurrency(
    totals.extras
  )}</td>
              <td style="${style.td} border-top: 2px solid #444; ${
    style.highlight
  }">${formatCurrency(totals.totalRevenue)}</td>
              <td style="${
                style.td
              } border-top: 2px solid #444;" colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <div style="padding: 20px; background-color: #151515; border-top: 1px solid #333; text-align: center; color: #666; font-size: 11px;">
          Generated automatically by Market Pulse. <br/>
          Cash Basis (Takings) vs Accrual Basis (Revenue) Reconciliation.
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { generateTakingsEmailHTML };
