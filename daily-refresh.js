// daily-refresh.js
// MODIFIED TO RUN ON VERCEL AS A SERVERLESS FUNCTION
// AND TO USE THE SHARED CONSTANTS FILE

import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import pg from "pg";
const { Client } = pg;
import { DATASET_7_MAP } from "./public/constants.js";

// --- AUTHENTICATION (Identical to the other script) ---
async function getCloudbedsAccessToken() {
  const {
    CLOUDBEDS_CLIENT_ID,
    CLOUDBEDS_CLIENT_SECRET,
    CLOUDBEDS_REFRESH_TOKEN,
  } = process.env;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLOUDBEDS_CLIENT_ID,
    client_secret: CLOUDBEDS_CLIENT_SECRET,
    refresh_token: CLOUDBEDS_REFRESH_TOKEN,
  });
  const tokenResponse = await fetch(
    "https://hotels.cloudbeds.com/api/v1.1/access_token",
    { method: "POST", body: params }
  );
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) throw new Error("Authentication failed");
  return tokenData.access_token;
}

// --- DATA PROCESSING (Identical to the other script) ---
function processApiDataForTable(data) {
  const aggregatedData = {};

  if (!data.index || !data.records) {
    console.log("API returned no data to process.");
    return aggregatedData;
  }

  // Aggregate the raw data by date by SUMMING all records
  for (let i = 0; i < data.index.length; i++) {
    const date = data.index[i][0];
    if (!aggregatedData[date]) {
      aggregatedData[date] = { totalRevenueForADR: 0 };
      for (const key in DATASET_7_MAP) {
        if (
          DATASET_7_MAP[key].type !== "string" &&
          DATASET_7_MAP[key].type !== "date"
        ) {
          aggregatedData[date][key] = 0;
        }
      }
    }

    for (const metric in data.records) {
      if (aggregatedData[date].hasOwnProperty(metric)) {
        // This "+=" is critical - it sums the values if the API returns multiple rows
        aggregatedData[date][metric] +=
          parseFloat(data.records[metric][i]) || 0;
      }
    }
    const adr = parseFloat(data.records.adr[i]) || 0;
    const roomsSold = parseInt(data.records.rooms_sold[i]) || 0;
    aggregatedData[date].totalRevenueForADR += adr * roomsSold;
  }

  // Perform final calculations on the aggregated data
  for (const date in aggregatedData) {
    const dayData = aggregatedData[date];
    if (dayData.rooms_sold > 0) {
      dayData.adr = dayData.totalRevenueForADR / dayData.rooms_sold;
    }
    if (dayData.capacity_count > 0) {
      dayData.occupancy = dayData.rooms_sold / dayData.capacity_count;
    }
  }

  return aggregatedData;
}

// --- MAIN INGESTION FUNCTION --- WRAPPED FOR VERCEL
async function runIngestion() {
  console.log("Starting daily metrics ingestion process...");

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Authenticate
    console.log("Authenticating...");
    const accessToken = await getCloudbedsAccessToken();
    console.log("✅ Authentication successful.");

    // 2. Define Date Range (Next 365 Days) - This logic was for daily-refresh
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 365);

    const startDate = today.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];
    console.log(`Fetching forecast data from ${startDate} to ${endDate}`);

    // 3. Construct API Payload
    const columnsToRequest = Object.keys(DATASET_7_MAP)
      .filter((column) => {
        const type = DATASET_7_MAP[column].type;
        return (
          type === "currency" ||
          type === "number" ||
          type === "percent" ||
          type === "DynamicCurrency" ||
          type === "DynamicPercentage"
        );
      })
      .map((column) => ({
        cdf: { column },
        metrics: ["sum", "mean"],
      }));

    const insightsPayload = {
      property_ids: [parseInt(process.env.CLOUDBEDS_PROPERTY_ID)],
      dataset_id: 7,
      filters: {
        and: [
          {
            cdf: { column: "stay_date" },
            operator: "greater_than_or_equal",
            value: `${startDate}T00:00:00.000Z`,
          },
          {
            cdf: { column: "stay_date" },
            operator: "less_than_or_equal",
            value: `${endDate}T00:00:00.000Z`,
          },
        ],
      },
      columns: columnsToRequest,
      group_rows: [{ cdf: { column: "stay_date" }, modifier: "day" }],
      settings: { details: true, totals: false },
    };

    // 4. Fetch data from Cloudbeds
    console.log("Fetching data from Cloudbeds Insights API...");
    const apiResponse = await fetch(
      "https://api.cloudbeds.com/datainsights/v1.1/reports/query/data?mode=Run",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-PROPERTY-ID": process.env.CLOUDBEDS_PROPERTY_ID,
        },
        body: JSON.stringify(insightsPayload),
      }
    );

    const responseText = await apiResponse.text();
    if (!apiResponse.ok) {
      throw new Error(
        `Cloudbeds API responded with ${apiResponse.status}: ${responseText}`
      );
    }
    const data = JSON.parse(responseText);
    console.log("✅ Data fetched successfully.");

    // 5. Process data with robust aggregation
    console.log("Processing data with aggregation logic...");
    const processedData = processApiDataForTable(data);
    console.log("✅ Data processed successfully.");

    // 6. ---- DATABASE INSERTION LOGIC ----
    await client.connect();
    console.log("Preparing to insert data into the database...");
    for (const date in processedData) {
      const metrics = processedData[date];
      console.log(`  > Storing metrics for ${date}`);

      // Example of an UPSERT (update if exists, else insert) query
      const query = `
        INSERT INTO daily_metrics_snapshots (
          snapshot_taken_date, stay_date, hotel_id, adr, occupancy_direct, revpar, rooms_sold, capacity_count,
          total_revenue, total_room_revenue, total_other_revenue, room_rate_total, taxes_total, fees_total, misc_income,
          adults_count, children_count, room_guest_count, blocked_rooms_count, out_of_service_rooms_count
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (stay_date, hotel_id) DO UPDATE SET
          adr = EXCLUDED.adr,
          occupancy_direct = EXCLUDED.occupancy_direct,
          revpar = EXCLUDED.revpar,
          rooms_sold = EXCLUDED.rooms_sold,
          capacity_count = EXCLUDED.capacity_count,
          total_revenue = EXCLUDED.total_revenue,
          total_room_revenue = EXCLUDED.total_room_revenue,
          total_other_revenue = EXCLUDED.total_other_revenue,
          room_rate_total = EXCLUDED.room_rate_total,
          taxes_total = EXCLUDED.taxes_total,
          fees_total = EXCLUDED.fees_total,
          misc_income = EXCLUDED.misc_income,
          adults_count = EXCLUDED.adults_count,
          children_count = EXCLUDED.children_count,
          room_guest_count = EXCLUDED.room_guest_count,
          blocked_rooms_count = EXCLUDED.blocked_rooms_count,
          out_of_service_rooms_count = EXCLUDED.out_of_service_rooms_count;
      `;

      const values = [
        new Date(), // snapshot_taken_date
        date, // stay_date
        process.env.CLOUDBEDS_PROPERTY_ID, // hotel_id
        metrics.adr,
        metrics.occupancy,
        metrics.revpar,
        metrics.rooms_sold,
        metrics.capacity_count,
        metrics.total_revenue,
        metrics.room_revenue,
        metrics.non_room_revenue,
        metrics.room_rate,
        metrics.room_taxes,
        metrics.room_fees,
        metrics.misc_income,
        metrics.adults_count,
        metrics.children_count,
        metrics.room_guest_count,
        metrics.blocked_room_count,
        metrics.out_of_service_count,
      ];

      try {
        await client.query(query, values);
        console.log(`  > Successfully stored metrics for ${date}`);
      } catch (dbError) {
        console.error(`  > ❌ Database error for ${date}:`, dbError);
      }
    }

    console.log("✅ Database operations complete.");
    console.log("--- Ingestion process finished successfully! ---");
  } catch (error) {
    console.error("❌ A critical error occurred during the ingestion process:");
    console.error(error);
    throw error; // Throw error to be caught by the handler
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// --- VERCEL HANDLER ---
// This function is the entry point for Vercel.
// It runs the main ingestion logic and sends a response.
export default async function handler(request, response) {
  try {
    await runIngestion();
    response.status(200).send("Cron job executed successfully.");
  } catch (error) {
    console.error("Handler error:", error);
    response.status(500).send("Error executing cron job.");
  }
}
