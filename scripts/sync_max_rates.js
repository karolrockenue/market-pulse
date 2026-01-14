/**
 * scripts/sync_max_rates.js
 * BRIDGES SENTINEL CSV -> MARKET PULSE DB
 * * Reads: master_rate_caps_2026.csv (Expecting columns: hotel_id, date, final_cap)
 * Writes: sentinel_daily_max_rates (Postgres)
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") }); // Load .env first

const fs = require("fs");
const csv = require("csv-parser"); // npm install csv-parser
const db = require("../api/utils/db"); // Ensure this path matches your project structure

// --- CONFIGURATION ---
const CSV_PATH = path.join(__dirname, "../master_rate_caps_2026.csv"); // Assumes file is in project root

// --- ID MAPPING ---
// MAPS CSV UUIDs -> MARKET PULSE IDs
// PLEASE UPDATE THE VALUES ON THE RIGHT SIDE IF THEY DIFFER
const ID_MAPPING = {
  // The Portico Hotel
  "fbd2965d-34d9-4134-944f-28c3b512f2ff": 318304,

  // The W14 Hotel
  "ee9f3ef4-9a88-46a9-aaf6-83a5c17bea4a": 318309,

  // House of Toby
  "1fa4727c-eb1a-44ce-bf95-5bc4fe6dac7d": 318311,

  // The 29 London
  "bb9b3c42-4d0d-4c0d-9f74-efd32aea7d52": 318308,
};

async function syncRates() {
  console.log("🚀 Starting Max Rate Sync...");
  console.log(`📂 Reading from: ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ File not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const results = [];

  // 1. Read CSV
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`📊 Loaded ${results.length} rows. Mapping IDs...`);

  // 2. Prepare Data
  const mappedRows = [];
  results.forEach((row) => {
    // Handle Column Names from CSV (hotel_id, date, final_cap)
    const originalId = row.hotel_id;
    const stayDate = row.date;
    const price = parseFloat(row.final_cap);

    // Apply Mapping
    // If the ID exists in our map, use the map value. Otherwise, keep original.
    const finalId = ID_MAPPING[originalId] || originalId;

    if (stayDate && !isNaN(price)) {
      mappedRows.push({
        hotel_id: finalId,
        stay_date: stayDate,
        max_price: price,
      });
    }
  });

  // 3. Batch Upsert
  const BATCH_SIZE = 1000;
  let processed = 0;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    for (let i = 0; i < mappedRows.length; i += BATCH_SIZE) {
      const batch = mappedRows.slice(i, i + BATCH_SIZE);

      const values = [];
      const placeholders = [];

      batch.forEach((row, idx) => {
        const offset = idx * 3;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        values.push(row.hotel_id, row.stay_date, row.max_price);
      });

      const query = `
        INSERT INTO sentinel_daily_max_rates (hotel_id, stay_date, max_price)
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (hotel_id, stay_date) 
        DO UPDATE SET 
          max_price = EXCLUDED.max_price,
          updated_at = NOW()
        WHERE sentinel_daily_max_rates.is_manual_override = FALSE; 
      `;

      await client.query(query, values);
      processed += batch.length;
      process.stdout.write(`\rProcessing... ${processed}/${mappedRows.length}`);
    }

    await client.query("COMMIT");
    console.log("\n✅ Sync Complete! Database updated.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Error syncing rates:", err);
  } finally {
    client.release();
    process.exit();
  }
}

syncRates();
