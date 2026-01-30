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
    body: "background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #374151; padding: 20px; line-height: 1.5;",
    container:
      "max-width: 1000px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden;",
    header:
      "background-color: #f9fafb; padding: 24px; border-bottom: 1px solid #e5e7eb;",
    title: "color: #111827; font-size: 22px; margin: 0; font-weight: 700;",
    subtitle: "color: #6b7280; font-size: 14px; margin-top: 4px;",
    table: "width: 100%; border-collapse: collapse; font-size: 13px;",
    th: "text-align: right; padding: 12px; color: #4b5563; font-weight: 600; border-bottom: 1px solid #e5e7eb; background-color: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: 0.025em;",
    thLeft:
      "text-align: left; padding: 12px; color: #4b5563; font-weight: 600; border-bottom: 1px solid #e5e7eb; background-color: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: 0.025em;",
    td: "padding: 12px; text-align: right; color: #374151; border-bottom: 1px solid #f3f4f6;",
    tdLeft:
      "padding: 12px; text-align: left; color: #111827; border-bottom: 1px solid #f3f4f6; font-weight: 500;",
    totalRow: "background-color: #f9fafb; font-weight: bold; color: #111827;",
    highlight: "color: #111827; font-weight: 700;",
  };

  const rowsHtml = data
    .map((hotel, index) => {
      const bg = index % 2 === 0 ? "#ffffff" : "#fcfcfc";
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
        <td style="${style.td} font-weight: 600;">${formatCurrency(
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
              <th style="${style.th}">Total Revenue</th>
              <th style="${style.th}">Occ %</th>
              <th style="${style.th}">ADR</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="${style.totalRow}">
              <td style="${
                style.tdLeft
              } border-top: 1px solid #d1d5db;">TOTALS</td>
              <td style="${
                style.td
              } border-top: 1px solid #d1d5db;">${formatCurrency(
    totals.cash
  )}</td>
              <td style="${
                style.td
              } border-top: 1px solid #d1d5db;">${formatCurrency(
    totals.cards
  )}</td>
              <td style="${
                style.td
              } border-top: 1px solid #d1d5db;">${formatCurrency(
    totals.bacs
  )}</td>
              <td style="${
                style.td
              } border-top: 1px solid #d1d5db;">${formatCurrency(
    totals.extras
  )}</td>
              <td style="${style.td} border-top: 1px solid #d1d5db; ${
    style.highlight
  }">${formatCurrency(totals.totalRevenue)}</td>
              <td style="${
                style.td
              } border-top: 1px solid #d1d5db;" colspan="2"></td>
            </tr>
          </tbody>
        </table>

        <div style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px;">
          Generated automatically by Market Pulse. <br/>
          Cash Basis (Takings) vs Accrual Basis (Revenue) Reconciliation.
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { generateTakingsEmailHTML };
