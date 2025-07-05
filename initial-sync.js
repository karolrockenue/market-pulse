// initial-sync.js
// A special script to be run ONCE when a new hotel is onboarded.
// It fetches 365 days of historical data AND 365 days of future data.

require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { Client } = require("pg");

// --- DATA MAP (Identical to the other script) ---
const DATASET_7_MAP = {
  adr: { name: "ADR", category: "Booking", type: "currency" },
  revpar: { name: "RevPAR", category: "Booking", type: "currency" },
  adults_count: { name: "Adults", category: "Booking", type: "number" },
  children_count: { name: "Children", category: "Booking", type: "number" },
  room_guest_count: {
    name: "Room Guest Count",
    category: "Booking",
    type: "number",
  },
  total_revenue: {
    name: "Total Revenue",
    category: "Finance",
    type: "currency",
  },
  room_revenue: {
    name: "Total Room Revenue",
    category: "Finance",
    type: "currency",
  },
  non_room_revenue: {
    name: "Total Other Revenue",
    category: "Finance",
    type: "currency",
  },
  additional_room_revenue: {
    name: "Other Room Revenue",
    category: "Finance",
    type: "currency",
  },
  room_rate: { name: "Room Rate", category: "Finance", type: "currency" },
  misc_income: { name: "Misc. Income", category: "Finance", type: "currency" },
  room_fees: { name: "Total Fees", category: "Finance", type: "currency" },
  room_taxes: { name: "Total Taxes", category: "Finance", type: "currency" },
  occupancy: {
    name: "Occupancy (Direct)",
    category: "Occupancy",
    type: "percent",
  },
  mfd_occupancy: {
    name: "Adjusted Occupancy",
    category: "Occupancy",
    type: "percent",
  },
  rooms_sold: { name: "Rooms Sold", category: "Occupancy", type: "number" },
  capacity_count: { name: "Capacity", category: "Occupancy", type: "number" },
  blocked_room_count: {
    name: "Blocked Rooms",
    category: "Occupancy",
    type: "number",
  },
  out_of_service_count: {
    name: "Out of Service Rooms",
    category: "Occupancy",
    type: "number",
  },
};

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

// --- MAIN INGESTION FUNCTION ---
async function runIngestion() {
  console.log("Starting INITIAL SYNC for new hotel...");

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Authenticate
    console.log("Authenticating...");
    const accessToken = await getCloudbedsAccessToken();
    console.log("✅ Authentication successful.");

    // 2. Define Date Range (Past 365 and Future 365 Days)
    const today = new Date();
    const pastDate = new Date();
    const futureDate = new Date();
    pastDate.setDate(today.getDate() - 365);
    futureDate.setDate(today.getDate() + 365);

    const startDate = pastDate.toISOString().split("T")[0];
    const endDate = futureDate.toISOString().split("T")[0];
    console.log(
      `Fetching historical and forecast data from ${startDate} to ${endDate}`
    );

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
    console.log("--- Initial Sync process finished successfully! ---");
  } catch (error) {
    console.error("❌ A critical error occurred during the ingestion process:");
    console.error(error);
    process.exit(1); // Exit with an error code
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// --- Run the script ---
runIngestion();
