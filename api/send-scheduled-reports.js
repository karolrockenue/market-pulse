// /api/send-scheduled-reports.js
require("dotenv").config();
const { Pool } = require("pg");
const sgMail = require("@sendgrid/mail");
const exceljs = require("exceljs");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
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
    SELECT stay_date::date, 
           AVG(adr) as adr, 
           AVG(occupancy_direct) as occupancy, 
           AVG(revpar) as revpar,
           SUM(total_revenue) as total_revenue, 
           SUM(rooms_sold) as rooms_sold,
           SUM(capacity_count) as capacity_count
    FROM daily_metrics_snapshots
    WHERE hotel_id = $1 AND stay_date::date >= $2 AND stay_date::date <= $3
    GROUP BY stay_date::date ORDER BY stay_date::date ASC;
  `;
  const { rows } = await pgPool.query(query, [propertyId, startDate, endDate]);
  return rows;
}

// The function now accepts 'category' instead of 'starRating'
// The function now accepts 'category' instead of 'starRating'
async function getMarketMetrics(propertyId, category, startDate, endDate) {
  const query = `
    SELECT stay_date::date, AVG(dms.adr) as market_adr, AVG(dms.occupancy_direct) as market_occupancy
    FROM daily_metrics_snapshots dms
    JOIN hotels h ON dms.hotel_id = h.hotel_id
    WHERE dms.hotel_id != $1 AND h.category = $2 AND dms.stay_date::date >= $3 AND dms.stay_date::date <= $4
    GROUP BY stay_date::date ORDER BY stay_date::date ASC;
`;
  // Use the 'category' variable in the query
  const { rows } = await pgPool.query(query, [
    propertyId,
    category,
    startDate,
    endDate,
  ]);
  return rows;
}

function processData(hotelData, marketData) {
  const dataMap = new Map();
  const processRow = (row, isMarket = false) => {
    const date = row.stay_date.toISOString().substring(0, 10);
    if (!dataMap.has(date)) dataMap.set(date, { date: date });
    const entry = dataMap.get(date);
    const prefix = isMarket ? "market_" : "";
    entry[`${prefix}adr`] = row.adr;
    entry[`${prefix}occupancy`] = row.occupancy;
    if (!isMarket) {
      entry.revpar = row.revpar;
      entry.total_revenue = row.total_revenue;
      entry.rooms_sold = row.rooms_sold;
      entry.capacity_count = row.capacity_count;
    }
  };
  hotelData.forEach((row) => processRow(row, false));
  marketData.forEach((row) => processRow(row, true));
  return Array.from(dataMap.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
}

// --- DYNAMIC FILE GENERATORS ---

// Reusable function to get headers and format data
function getReportData(data, report) {
  const masterHeaderOrder = {
    Date: (row) => row.date,
    "Rooms Sold": (row) => parseFloat(row.rooms_sold) || 0,
    "Rooms Unsold": (row) =>
      parseFloat(row.capacity_count) - parseFloat(row.rooms_sold) || 0,
    ADR: (row) => parseFloat(row.adr) || 0,
    RevPAR: (row) => parseFloat(row.revpar) || 0,
    Occupancy: (row) => parseFloat(row.occupancy) || 0,
    "Total Revenue": (row) => parseFloat(row.total_revenue) || 0,
  };
  const headers = [];
  const hotelMetrics = new Set(report.metrics_hotel);
  for (const header of Object.keys(masterHeaderOrder)) {
    if (hotelMetrics.has(header) || header === "Date") {
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
    const avgs = ["ADR", "RevPAR", "Occupancy"];
    sums.forEach((key) => {
      totals[key] = data.reduce(
        (sum, row) => sum + (masterHeaderOrder[key](row) || 0),
        0
      );
    });
    avgs.forEach((key) => {
      totals[key] =
        data.reduce((sum, row) => sum + (masterHeaderOrder[key](row) || 0), 0) /
        data.length;
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
module.exports = async (req, res) => {
  console.log("Cron job started: Checking for scheduled reports to send.");

  try {
    const now = new Date();
    const currentTime = `${now.getUTCHours().toString().padStart(2, "0")}:${now
      .getUTCMinutes()
      .toString()
      .padStart(2, "0")}`;
    const currentDayOfWeek = now.getUTCDay();
    const currentDayOfMonth = now.getUTCDate();

    const { rows: dueReports } = await pgPool.query(
      // Select the new 'category' column instead of 'star_rating'
      `SELECT sr.*, h.category
   FROM scheduled_reports sr
   JOIN hotels h ON sr.property_id::integer = h.hotel_id
   WHERE sr.time_of_day = $1 AND (
         (sr.frequency = 'Daily') OR
         (sr.frequency = 'Weekly' AND sr.day_of_week = $2) OR
         (sr.frequency = 'Monthly' AND sr.day_of_month = $3)
       )`,
      [currentTime, currentDayOfWeek, currentDayOfMonth]
    );

    if (dueReports.length === 0) {
      console.log(`No reports due at this time (${currentTime} UTC).`);
      return res.status(200).send("No reports due.");
    }

    console.log(`Found ${dueReports.length} report(s) to send.`);

    for (const report of dueReports) {
      const { startDate, endDate } = calculateDateRange(report.report_period);
      const hotelData = await getHotelMetrics(
        report.property_id,
        startDate,
        endDate
      );
      const marketData = report.add_comparisons
        ? // Pass the new 'report.category' field to the updated function
          await getMarketMetrics(
            report.property_id,
            report.category,
            startDate,
            endDate
          )
        : [];
      const processedData = processData(hotelData, marketData);

      if (processedData.length === 0) {
        console.log(`No data for report "${report.report_name}", skipping.`);
        continue;
      }

      const attachments = [];
      const formats = report.attachment_formats || ["csv"]; // Default to csv if not set

      if (formats.includes("csv")) {
        attachments.push({
          content: generateCSV(processedData, report).toString("base64"),
          filename: `${report.report_name.replace(/\s/g, "_")}.csv`,
          type: "text/csv",
          disposition: "attachment",
        });
      }
      if (formats.includes("xlsx")) {
        const xlsxBuffer = await generateXLSX(processedData, report);
        attachments.push({
          content: xlsxBuffer.toString("base64"),
          filename: `${report.report_name.replace(/\s/g, "_")}.xlsx`,
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          disposition: "attachment",
        });
      }

      if (attachments.length > 0) {
        const msg = {
          to: report.recipients.split(",").map((e) => e.trim()),
          from: {
            name: "Market Pulse Reports",
            email: "reports@market-pulse.io",
          },
          subject: `Your Scheduled Report: ${report.report_name}`,
          text: `Hello,\n\nPlease find your scheduled report, "${report.report_name}", attached.\n\nThis report was generated for the period of ${startDate} to ${endDate}.\n\nRegards,\nThe Market Pulse Team`,
          attachments: attachments,
        };
        await sgMail.send(msg);
        console.log(
          `Successfully sent report "${report.report_name}" to ${report.recipients}`
        );
      }
    }

    res
      .status(200)
      .send(`Successfully processed ${dueReports.length} reports.`);
  } catch (error) {
    console.error("Cron job failed:", error);
    res.status(500).json({ error: "Failed to process scheduled reports." });
  }
};
