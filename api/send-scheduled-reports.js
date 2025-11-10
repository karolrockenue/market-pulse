// /api/send-scheduled-reports.js
// /api/send-scheduled-reports.js
require("dotenv").config();
const { Pool } = require("pg");
const exceljs = require("exceljs");
const { subDays, format } = require("date-fns"); // For calculating "yesterday"
const { formatInTimeZone } = require("date-fns-tz"); // For email date formatting

// [NEW] Import all our new utility functions
const { sendEmail } = require("./utils/email.utils");
const { generateShreejiReport } = require("./utils/report.generators");
const { getShreejiReportEmailHTML } = require("./utils/emailTemplates");




const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- HELPER FUNCTIONS (Date, Data Processing) ---
// These are unchanged, but needed for the script to run.
function formatDateForQuery(date) {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDateRange(period) {
  const today = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    )
  );
  let startDate, endDate;
  const dayOfWeek = today.getUTCDay() === 0 ? 6 : today.getUTCDay() - 1;

  switch (period) {
    case "last-week":
      startDate = new Date(today);
      startDate.setUTCDate(today.getUTCDate() - dayOfWeek - 7);
      endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 6);
      break;
    case "current-month":
      startDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
      );
      endDate = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
      );
      break;
    case "current-week":
    default:
      startDate = new Date(today);
      startDate.setUTCDate(today.getUTCDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 6);
      break;
  }
  return {
    startDate: formatDateForQuery(startDate),
    endDate: formatDateForQuery(endDate),
  };
}

async function getHotelMetrics(propertyId, startDate, endDate) {
  const query = `
    SELECT 
      stay_date::date, 
      rooms_sold,
      capacity_count,
      occupancy_direct,
      -- THE FIX: Select all new gross and net columns instead of legacy ones
      gross_revenue,
      net_revenue,
      gross_adr,
      net_adr,
      gross_revpar,
      net_revpar
    FROM daily_metrics_snapshots
    WHERE hotel_id = $1 AND stay_date::date >= $2 AND stay_date::date <= $3
    GROUP BY stay_date::date, rooms_sold, capacity_count, occupancy_direct, gross_revenue, net_revenue, gross_adr, net_adr, gross_revpar, net_revpar
    ORDER BY stay_date::date ASC;
  `;
  const { rows } = await pgPool.query(query, [propertyId, startDate, endDate]);
  return rows;
}

// /api/send-scheduled-reports.js

// The function now accepts 'propertyId' and 'category' for fallback.
async function getMarketMetrics(propertyId, category, startDate, endDate) {
  const compSetResult = await pgPool.query(
    "SELECT competitor_hotel_id FROM hotel_comp_sets WHERE hotel_id = $1",
    [propertyId]
  );
  let query;
  let queryParams;

  const metricsToSelect = `
    AVG(dms.occupancy_direct) as market_occupancy,
    -- THE FIX: Select all new gross and net market columns
    AVG(dms.gross_adr) as market_gross_adr,
    AVG(dms.net_adr) as market_net_adr,
    AVG(dms.gross_revpar) as market_gross_revpar,
    AVG(dms.net_revpar) as market_net_revpar
  `;

  if (compSetResult.rows.length > 0) {
    const competitorIds = compSetResult.rows.map(
      (row) => row.competitor_hotel_id
    );
    query = `
      SELECT stay_date::date, ${metricsToSelect}
      FROM daily_metrics_snapshots dms
      WHERE dms.hotel_id = ANY($1::int[]) AND dms.stay_date::date >= $2 AND dms.stay_date::date <= $3
      GROUP BY stay_date::date ORDER BY stay_date::date ASC;
    `;
    queryParams = [competitorIds, startDate, endDate];
  } else {
    query = `
      SELECT stay_date::date, ${metricsToSelect}
      FROM daily_metrics_snapshots dms
      JOIN hotels h ON dms.hotel_id = h.hotel_id
      WHERE dms.hotel_id != $1 AND h.category = $2 AND dms.stay_date::date >= $3 AND dms.stay_date::date <= $4
      GROUP BY stay_date::date ORDER BY stay_date::date ASC;
    `;
    queryParams = [propertyId, category, startDate, endDate];
  }

  const { rows } = await pgPool.query(query, queryParams);
  return rows;
}

function processData(hotelData, marketData) {
  const dataMap = new Map();
  hotelData.forEach((row) => {
    const date = row.stay_date.substring(0, 10);
    dataMap.set(date, { date, ...row });
  });

  marketData.forEach((row) => {
    const date = row.stay_date.substring(0, 10);
    if (dataMap.has(date)) {
      // Merge market data into the existing hotel data entry for that date
      const existingEntry = dataMap.get(date);
      dataMap.set(date, { ...existingEntry, ...row });
    }
  });

  return Array.from(dataMap.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
}

// --- DYNAMIC FILE GENERATORS ---

// Reusable function to get headers and format data
// Reusable function to get headers and format data
function getReportData(data, report) {
  // THE FIX: This function is now "tax-aware".
  // It checks the report's settings to decide which revenue columns to use.
  const useGross = report.include_taxes;

  const masterHeaderOrder = {
    Date: (row) => row.date,
    "Rooms Sold": (row) => parseFloat(row.rooms_sold) || 0,
    "Rooms Unsold": (row) =>
      (parseFloat(row.capacity_count) || 0) - (parseFloat(row.rooms_sold) || 0),
    ADR: (row) => parseFloat(useGross ? row.gross_adr : row.net_adr) || 0,
    RevPAR: (row) =>
      parseFloat(useGross ? row.gross_revpar : row.net_revpar) || 0,
    Occupancy: (row) => parseFloat(row.occupancy_direct) || 0,
    "Total Revenue": (row) =>
      parseFloat(useGross ? row.gross_revenue : row.net_revenue) || 0,
    "Market Occupancy": (row) => parseFloat(row.market_occupancy) || 0,
    "Market ADR": (row) =>
      parseFloat(useGross ? row.market_gross_adr : row.market_net_adr) || 0,
  };

  const headers = ["Date"];
  const selectedMetrics = new Set([
    ...report.metrics_hotel,
    ...report.metrics_market,
  ]);

  for (const header of Object.keys(masterHeaderOrder)) {
    if (header !== "Date" && selectedMetrics.has(header)) {
      headers.push(header);
    }
  }

  const body = data.map((row) =>
    headers.map((header) => masterHeaderOrder[header](row))
  );

  let totals = null;
  if (report.display_totals) {
    totals = {};
    const sums = ["Rooms Sold", "Rooms Unsold", "Total Revenue"];
    const avgs = [
      "ADR",
      "RevPAR",
      "Occupancy",
      "Market Occupancy",
      "Market ADR",
    ];

    sums.forEach((key) => {
      if (headers.includes(key)) {
        totals[key] = data.reduce(
          (sum, row) => sum + (masterHeaderOrder[key](row) || 0),
          0
        );
      }
    });

    avgs.forEach((key) => {
      if (headers.includes(key)) {
        totals[key] =
          data.reduce(
            (sum, row) => sum + (masterHeaderOrder[key](row) || 0),
            0
          ) / data.length;
      }
    });
  }

  return { headers, body, totals };
}
function generateCSV(data, report) {
  const { headers, body, totals } = getReportData(data, report);
  const headerRow = headers.join(",");
  let bodyRows = body
    .map((row) =>
      row
        .map((cell, i) => {
          if (headers[i] === "Occupancy") return (cell * 100).toFixed(2) + "%";
          if (typeof cell === "number") return cell.toFixed(2);
          return cell;
        })
        .join(",")
    )
    .join("\n");

  if (totals) {
    const totalsRowData = headers.map((header) => {
      if (header === "Date") return "Totals / Averages";
      if (totals[header] !== undefined) {
        const value = totals[header];
        if (header === "Occupancy") return (value * 100).toFixed(2) + "%";
        if (typeof value === "number") return value.toFixed(2);
        return value;
      }
      return "";
    });
    bodyRows += "\n" + totalsRowData.join(",");
  }

  return Buffer.from(`${headerRow}\n${bodyRows}`, "utf-8");
}

async function generateXLSX(data, report) {
  const { headers, body, totals } = getReportData(data, report);
  const workbook = new exceljs.Workbook();
  const worksheet = workbook.addWorksheet("Report");

  worksheet.columns = headers.map((header) => ({
    header: header,
    key: header,
    width: 15,
  }));
  worksheet.getRow(1).font = { bold: true };

  body.forEach((row) => {
    const rowData = {};
    headers.forEach((header, i) => {
      rowData[header] = row[i];
    });
    worksheet.addRow(rowData);
  });

  if (totals) {
    worksheet.addRow([]); // Spacer row
    const totalsRow = worksheet.addRow({});
    totalsRow.getCell("Date").value = "Totals / Averages";
    totalsRow.font = { bold: true };
    headers.forEach((header) => {
      if (totals[header] !== undefined) {
        totalsRow.getCell(header).value = totals[header];
      }
    });
  }

  // Apply number formatting
  worksheet.columns.forEach((column) => {
    if (column.key === "Occupancy") {
      column.numFmt = "0.00%";
    } else if (["ADR", "RevPAR", "Total Revenue"].includes(column.key)) {
      column.numFmt = '"£"#,##0.00';
    }
  });

  return await workbook.xlsx.writeBuffer();
}

// --- MAIN HANDLER ---
// --- MAIN HANDLER ---
module.exports = async (req, res) => {
  try {
    let dueReports;
    // THE FIX: Safely access reportId from req.body, which might be undefined in a cron job.
    // We check if req.body exists before trying to get reportId from it.
    const reportId = req.body?.reportId;

    // If a reportId is provided, this is a manual trigger for a single report.
    if (reportId) {
      console.log(`Manual trigger: Fetching report with ID: ${reportId}`);
      const result = await pgPool.query(
        `SELECT sr.*, h.category, h.property_name
         FROM scheduled_reports sr
         JOIN hotels h ON sr.property_id::integer = h.hotel_id
         WHERE sr.id = $1`,
        [reportId]
      );
      dueReports = result.rows;
    } else {
      // If no reportId is provided, this is a normal cron job run.
      console.log("Cron job: Checking for reports based on schedule.");
      const now = new Date();
const currentTime = `${now
        .getUTCHours()
        .toString()
        .padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}`;
      
      // [FIX] Normalize Sunday from 0 (JS getUTCDay()) to 7 (ISO standard used in DB)
      let currentDayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday...
      if (currentDayOfWeek === 0) {
        currentDayOfWeek = 7; // Convert Sunday to 7 to match frontend/DB
      }

      const currentDayOfMonth = now.getUTCDate();

      const result = await pgPool.query(
        `SELECT sr.*, h.category, h.property_name
         FROM scheduled_reports sr
         JOIN hotels h ON sr.property_id::integer = h.hotel_id
         WHERE sr.time_of_day = $1 AND (
           (sr.frequency = 'Daily') OR
           (sr.frequency = 'Weekly' AND sr.day_of_week = $2) OR
           (sr.frequency = 'Monthly' AND sr.day_of_month = $3)
         )`,
        [currentTime, currentDayOfWeek, currentDayOfMonth]
      );
      dueReports = result.rows;
    }

    if (dueReports.length === 0) {
      const message = reportId
        ? `Report with ID ${reportId} not found.`
        : `No reports due at this time.`;
      console.log(message);
      return res.status(reportId ? 404 : 200).send(message);
    }

   console.log(`Found ${dueReports.length} report(s) to process.`);
let sentCount = 0;

for (const report of dueReports) {
  // [NEW] Check for the 'shreeji' report type (which the UI will save).
  // We assume 'standard' or undefined is the default P&L report.
  if (report.report_type === 'shreeji') {
    try {
      // --- 1. GENERATE SHREEJI REPORT ---
      // This report is always for "yesterday".
      const yesterday = subDays(new Date(), 1);
      const reportDateStr = format(yesterday, "yyyy-MM-dd");
      const hotelId = report.property_id; // Use the property_id from the scheduled report

      console.log(`[Cron] Generating Shreeji Report for hotel ${hotelId} on ${reportDateStr}...`);

      const { pdfBuffer, fileName, hotelName, reportDate } =
        await generateShreejiReport(hotelId, reportDateStr);

      // --- 2. PREPARE EMAIL ---
      // Format the date nicely for the email body
      const emailDate = formatInTimeZone(
        yesterday,
        "Europe/London", // Use UK timezone as requested
        "MMMM d, yyyy"
      );

      const emailHtml = getShreejiReportEmailHTML(
        report.report_name,
        hotelName,
        emailDate,
        "Team"
      );

      const recipients = report.recipients.split(",").map((e) => e.trim());

      // --- 3. SEND EMAIL WITH ATTACHMENT ---
      await sendEmail({
        to: recipients,
        subject: `Your Scheduled Report: ${report.report_name} for ${hotelName}`,
        html: emailHtml,
        attachments: [
          {
            content: pdfBuffer.toString("base64"),
            filename: fileName,
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      });

      console.log(`[Cron] Successfully sent Shreeji Report "${report.report_name}"`);
      sentCount++;

    } catch (shreejiError) {
      console.error(`[Cron] Failed to process Shreeji Report "${report.report_name}":`, shreejiError);
      // We could optionally email an admin here, but for now we just log
    }

  } else {
    // --- 4. ELSE, RUN EXISTING STANDARD REPORT LOGIC ---
    try {
      const { startDate, endDate } = calculateDateRange(report.report_period);
      const hotelData = await getHotelMetrics(
        report.property_id,
        startDate,
        endDate
      );
      const marketData = report.add_comparisons
        ? await getMarketMetrics(
            report.property_id,
            report.category,
            startDate,
            endDate
          )
        : [];
      const processedData = processData(hotelData, marketData);

      if (processedData.length === 0) {
        console.log(`[Cron] No data for standard report "${report.report_name}", skipping.`);
        continue;
      }

      const attachments = [];
      const formats = report.attachment_formats || ["csv"];
      const cleanHotelName = report.property_name.replace(/\s/g, "_");
      const cleanReportName = report.report_name.replace(/\s/g, "_");

      if (formats.includes("csv")) {
        attachments.push({
          content: generateCSV(processedData, report).toString("base64"),
          filename: `${cleanHotelName}_${cleanReportName}.csv`,
          type: "text/csv",
          disposition: "attachment",
        });
      }
      if (formats.includes("xlsx")) {
        const xlsxBuffer = await generateXLSX(processedData, report);
        attachments.push({
          content: xlsxBuffer.toString("base64"),
          filename: `${cleanHotelName}_${cleanReportName}.xlsx`,
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment",
        });
      }

      if (attachments.length > 0) {
        const msg = {
          to: report.recipients.split(",").map((e) => e.trim()),
          // [MODIFIED] Use a "from" object matching our new email util
          from: {
            name: "Market Pulse Reports",
            email: process.env.SENDGRID_FROM_EMAIL || "reports@market-pulse.io",
          },
          subject: `Your Scheduled Report: ${report.report_name}`,
          text: `Hello,\n\nPlease find your scheduled report, "${report.report_name}", attached.\n\nThis report was generated for the period of ${startDate} to ${endDate}.\n\nRegards,\nThe Market Pulse Team`,
          attachments: attachments,
        };

        // [MODIFIED] Use the new sendEmail utility
        await sendEmail(msg);

        console.log(
          `[Cron] Successfully sent standard report "${report.report_name}" to ${report.recipients}`
        );
        sentCount++;
      }
    } catch (standardReportError) {
      console.error(`[Cron] Failed to process Standard Report "${report.report_name}":`, standardReportError);
    }
  }
} // End for-loop

res
  .status(200)
  .json({ message: `Successfully sent ${sentCount} report(s).` });
  } catch (error) {
    console.error("Report job failed:", error);
    res.status(500).json({ error: "Failed to process scheduled reports." });
  }
};
