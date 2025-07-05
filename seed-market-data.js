// seed-market-data.js
// A special script to be run ONCE to seed the database with mock market data from a CSV file.

require("dotenv").config();
const fs = require("fs");
const { parse } = require("csv-parse");
const { Client } = require("pg");

const CSV_FILE_PATH = "./daily_metrics_snapshots_5hotels.csv"; // <-- This line has been updated

async function seedDatabase() {
  console.log("Starting database seeding process from CSV...");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const records = [];

  // 1. Create a parser to read the CSV file
  const parser = fs.createReadStream(CSV_FILE_PATH).pipe(
    parse({
      columns: true, // Treat the first row as headers
      cast: true, // Automatically cast data types
    })
  );

  // 2. Read the CSV file row by row
  console.log(`Reading data from ${CSV_FILE_PATH}...`);
  for await (const record of parser) {
    records.push(record);
  }
  console.log(`✅ Found ${records.length} records in the CSV file.`);

  try {
    // 3. Connect to the database
    await client.connect();
    console.log("✅ Database connection successful.");

    // 4. Loop through records and insert them into the database
    for (const metrics of records) {
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

      // The `snapshot_id` from the CSV is ignored, the database will handle it.
      const values = [
        metrics.snapshot_taken_date,
        metrics.stay_date,
        metrics.hotel_id,
        metrics.adr,
        metrics.occupancy_direct,
        metrics.revpar,
        metrics.rooms_sold,
        metrics.capacity_count,
        metrics.total_revenue,
        metrics.total_room_revenue,
        metrics.total_other_revenue,
        metrics.room_rate_total,
        metrics.taxes_total,
        metrics.fees_total,
        metrics.misc_income,
        metrics.adults_count,
        metrics.children_count,
        metrics.room_guest_count,
        metrics.blocked_rooms_count,
        metrics.out_of_service_rooms_count,
      ];

      try {
        await client.query(query, values);
        console.log(
          `  > Stored metrics for hotel ${metrics.hotel_id} on ${metrics.stay_date}`
        );
      } catch (dbError) {
        console.error(
          `  > ❌ Database error for hotel ${metrics.hotel_id} on ${metrics.stay_date}:`,
          dbError
        );
      }
    }

    console.log("✅ Database seeding process completed successfully!");
  } catch (error) {
    console.error(
      "❌ A critical error occurred during the seeding process:",
      error
    );
  } finally {
    // 5. Close the database connection
    if (client) {
      await client.end();
      console.log("Database connection closed.");
    }
  }
}

// --- Run the script ---
seedDatabase();
