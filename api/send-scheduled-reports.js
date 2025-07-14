// /api/send-scheduled-reports.js
require("dotenv").config();
const { Pool } = require("pg");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- DATE & HELPER FUNCTIONS ---
// These functions help calculate the correct date ranges for reports.
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
    // Add other periods as needed (next-month, this-year, etc.)
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

// --- BACKEND DATA FETCHING LOGIC ---
// These functions fetch data directly from the database for the report.
async function getHotelMetrics(propertyId, startDate, endDate) {
  const query = `
    SELECT stay_date::date, AVG(adr) as adr, AVG(occupancy_direct) as occupancy, SUM(total_revenue) as total_revenue, SUM(rooms_sold) as rooms_sold
    FROM daily_metrics_snapshots
    WHERE hotel_id = $1 AND stay_date::date >= $2 AND stay_date::date <= $3
    GROUP BY stay_date::date ORDER BY stay_date::date ASC;
  `;
  const { rows } = await pgPool.query(query, [propertyId, startDate, endDate]);
  return rows;
}

async function getMarketMetrics(propertyId, starRating, startDate, endDate) {
  const query = `
        SELECT stay_date::date, AVG(dms.adr) as market_adr, AVG(dms.occupancy_direct) as market_occupancy
        FROM daily_metrics_snapshots dms
        JOIN hotels h ON dms.hotel_id = h.hotel_id
        WHERE dms.hotel_id != $1 AND h.star_rating = $2 AND dms.stay_date::date >= $3 AND dms.stay_date::date <= $4
        GROUP BY stay_date::date ORDER BY stay_date::date ASC;
    `;
  const { rows } = await pgPool.query(query, [
    propertyId,
    starRating,
    startDate,
    endDate,
  ]);
  return rows;
}
// This function merges the two datasets and calculates new metrics.
function processData(hotelData, marketData) {
  const dataMap = new Map();

  const processRow = (row, isMarket = false) => {
    const date = row.stay_date.toISOString().substring(0, 10);
    if (!dataMap.has(date)) {
      dataMap.set(date, { date: date });
    }
    const entry = dataMap.get(date);

    // Add data to the correct properties (e.g., adr vs market_adr)
    const prefix = isMarket ? "market_" : "";
    entry[`${prefix}adr`] = row.adr;
    entry[`${prefix}occupancy`] = row.occupancy;
    entry[`${prefix}total_revenue`] = row.total_revenue;
    entry[`${prefix}rooms_sold`] = row.rooms_sold;

    // Add non-market-prefixed calculations only once
    if (!isMarket) {
      entry.capacity_count = row.capacity_count;
      entry.revpar = row.revpar;
    }
  };

  hotelData.forEach((row) => processRow(row, false));
  marketData.forEach((row) => processRow(row, true));

  return Array.from(dataMap.values()).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
}

// --- DYNAMIC CSV GENERATION ---
// --- DYNAMIC CSV GENERATION ---
// This function creates the CSV string with the new column order and names.
function generateCSV(data, report) {
  // 1. Define the desired master order of columns.
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

  // 2. Build the list of active headers based on saved metrics and desired order.
  for (const header of Object.keys(masterHeaderOrder)) {
    if (hotelMetrics.has(header) || header === "Date") {
      headers.push(header);
    }
  }

  // 3. Generate the rows based on the final active headers.
  const headerRow = headers.join(",");
  let bodyRows = data
    .map((row) => {
      return headers
        .map((header) => {
          const value = masterHeaderOrder[header](row);
          // Format for display in CSV
          if (header === "Occupancy") return (value * 100).toFixed(2) + "%";
          if (typeof value === "number") return value.toFixed(2);
          return value;
        })
        .join(",");
    })
    .join("\n");

  // --- THIS IS THE NEW LOGIC ---
  // 4. If the report is set to display totals, calculate and append them.
  if (report.display_totals) {
    const totals = {};
    const sums = ["Rooms Sold", "Rooms Unsold", "Total Revenue"];
    const avgs = ["ADR", "RevPAR", "Occupancy"];

    // Calculate sums
    sums.forEach((key) => {
      totals[key] = data.reduce(
        (sum, row) => sum + (masterHeaderOrder[key](row) || 0),
        0
      );
    });

    // Calculate averages
    avgs.forEach((key) => {
      totals[key] =
        data.reduce((sum, row) => sum + (masterHeaderOrder[key](row) || 0), 0) /
        data.length;
    });

    const totalsRowData = headers.map((header) => {
      if (header === "Date") return "Totals / Averages";
      if (totals[header] !== undefined) {
        const value = totals[header];
        if (header === "Occupancy") return (value * 100).toFixed(2) + "%";
        if (typeof value === "number") return value.toFixed(2);
        return value;
      }
      return ""; // Empty cell for non-totaled columns
    });

    // Append the formatted totals row to the CSV body
    bodyRows += "\n" + totalsRowData.join(",");
  }

  return `${headerRow}\n${bodyRows}`;
}
// --- MAIN HANDLER ---
// This is the main function executed by the cron job.
module.exports = async (req, res) => {
  console.log("Cron job started: Checking for scheduled reports to send.");

  try {
    const now = new Date();
    // --- THIS IS THE FIX ---
    // We now get the current hour AND minute for a precise match.
    const currentHour = now.getUTCHours().toString().padStart(2, "0");
    const currentMinute = now.getUTCMinutes().toString().padStart(2, "0");
    const currentTime = `${currentHour}:${currentMinute}`;

    const currentDayOfWeek = now.getUTCDay();
    const currentDayOfMonth = now.getUTCDate();

    // The query now looks for an EXACT time match (e.g., '08:51').
    const { rows: dueReports } = await pgPool.query(
      `SELECT sr.*, h.star_rating
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
      // This message is expected if no reports are scheduled for the current minute.
      console.log(`No reports due at this time (${currentTime} UTC).`);
      return res.status(200).send("No reports due.");
    }

    console.log(`Found ${dueReports.length} report(s) to send.`);

    // The rest of the fudnction remains the same...
    for (const report of dueReports) {
      const { startDate, endDate } = calculateDateRange(report.report_period);
      const hotelData = await getHotelMetrics(
        report.property_id,
        startDate,
        endDate
      );
      const marketData = report.add_comparisons
        ? await getMarketMetrics(
            report.property_id,
            report.star_rating,
            startDate,
            endDate
          )
        : [];
      const processedData = processData(hotelData, marketData);

      if (processedData.length === 0) {
        console.log(`No data for report "${report.report_name}", skipping.`);
        continue;
      }

      const csvData = generateCSV(processedData, report);
      const csvBuffer = Buffer.from(csvData, "utf-8");

      const msg = {
        to: report.recipients.split(",").map((e) => e.trim()),
        from: {
          name: "Market Pulse Reports",
          email: "reports@market-pulse.io",
        },
        subject: `Your Scheduled Report: ${report.report_name}`,
        text: `Hello,\n\nPlease find your scheduled report, "${report.report_name}", attached.\n\nThis report was generated for the period of ${startDate} to ${endDate}.\n\nRegards,\nThe Market Pulse Team`,
        attachments: [
          {
            content: csvBuffer.toString("base64"),
            filename: `${report.report_name.replace(
              /\s/g,
              "_"
            )}_${startDate}_to_${endDate}.csv`,
            type: "text/csv",
            disposition: "attachment",
          },
        ],
      };

      await sgMail.send(msg);
      console.log(
        `Successfully sent report "${report.report_name}" to ${report.recipients}`
      );
    }

    res
      .status(200)
      .send(`Successfully processed ${dueReports.length} reports.`);
  } catch (error) {
    console.error("Cron job failed:", error);
    res.status(500).json({ error: "Failed to process scheduled reports." });
  }
};
