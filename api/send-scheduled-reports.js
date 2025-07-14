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

// This function merges the two datasets together by date.
function processData(hotelData, marketData) {
  const dataMap = new Map();
  hotelData.forEach((row) =>
    dataMap.set(row.stay_date.toISOString().substring(0, 10), { ...row })
  );
  marketData.forEach((row) => {
    const date = row.stay_date.toISOString().substring(0, 10);
    if (dataMap.has(date)) {
      Object.assign(dataMap.get(date), row);
    } else {
      dataMap.set(date, { ...row });
    }
  });
  return Array.from(dataMap.values()).sort(
    (a, b) => new Date(a.stay_date) - new Date(b.stay_date)
  );
}

// --- DYNAMIC CSV GENERATION ---
// This function creates the CSV string from the live data.
function generateCSV(data, report) {
  const headers = ["Date"];
  const hotelMetrics = new Set(report.metrics_hotel);
  const marketMetrics = new Set(report.metrics_market);

  // Dynamically build headers based on saved metrics
  if (hotelMetrics.has("Occupancy")) headers.push("Your Occupancy");
  if (hotelMetrics.has("ADR")) headers.push("Your ADR");
  if (hotelMetrics.has("Total Revenue")) headers.push("Your Total Revenue");
  if (hotelMetrics.has("Rooms Sold")) headers.push("Your Rooms Sold");

  if (report.add_comparisons) {
    if (marketMetrics.has("Market Occupancy")) headers.push("Market Occupancy");
    if (marketMetrics.has("Market ADR")) headers.push("Market ADR");
  }

  const headerRow = headers.join(",");
  const bodyRows = data
    .map((row) => {
      const rowData = [formatDateForQuery(new Date(row.stay_date))];
      if (hotelMetrics.has("Occupancy"))
        rowData.push((row.occupancy * 100 || 0).toFixed(2) + "%");
      if (hotelMetrics.has("ADR")) rowData.push((row.adr || 0).toFixed(2));
      if (hotelMetrics.has("Total Revenue"))
        rowData.push((row.total_revenue || 0).toFixed(2));
      if (hotelMetrics.has("Rooms Sold")) rowData.push(row.rooms_sold || 0);

      if (report.add_comparisons) {
        if (marketMetrics.has("Market Occupancy"))
          rowData.push((row.market_occupancy * 100 || 0).toFixed(2) + "%");
        if (marketMetrics.has("Market ADR"))
          rowData.push((row.market_adr || 0).toFixed(2));
      }
      return rowData.join(",");
    })
    .join("\n");

  return `${headerRow}\n${bodyRows}`;
}

// --- MAIN HANDLER ---
// This is the main function executed by the cron job.
module.exports = async (req, res) => {
  console.log("Cron job started: Checking for scheduled reports to send.");

  try {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDayOfWeek = now.getUTCDay();
    const currentDayOfMonth = now.getUTCDate();

    const { rows: dueReports } = await pgPool.query(
      `SELECT sr.*, h.star_rating
       FROM scheduled_reports sr
       JOIN hotels h ON sr.property_id = h.hotel_id::varchar
       WHERE sr.time_of_day LIKE $1 AND (
         (sr.frequency = 'Daily') OR
         (sr.frequency = 'Weekly' AND sr.day_of_week = $2) OR
         (sr.frequency = 'Monthly' AND sr.day_of_month = $3)
       )`,
      [`${currentHour}:00%`, currentDayOfWeek, currentDayOfMonth]
    );

    if (dueReports.length === 0) {
      console.log("No reports due at this time.");
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
