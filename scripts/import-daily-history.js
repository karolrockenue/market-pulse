/**
 * Market Pulse - Historical DAILY Data Import Script
 *
 * This script provides a safe, repeatable method for importing historical *daily*
 * performance data (e.g., from a CSV) into the `daily_metrics_snapshots` table.
 *
 * It assumes the CSV contains "sparse" daily data (e.g., date, gross revenue, occupancy)
 * and calculates the remaining required metrics (net values, rooms_sold, adr, revpar)
 * by fetching the hotel's definitive 'total_rooms' and 'tax_rate' from the 'hotels' table.
 *
 * It correctly calculates 'rooms_sold' from 'occupancy' and 'total_rooms', ensuring
 * data integrity.
 *
 * ---
 * v1.0 (Nov 5, 2025)
 * - Initial version created for importing pre-calculated daily CSVs.
 * - Based on the safety/transactional logic of import-monthly-history.js.
 * - Removed all "monthly-to-daily" disaggregation and pattern logic.
 * ---
 *
 * Usage:
 * node scripts/import-daily-history.js \
 * --hotelId=123 \
 * --csv="/path/to/your/daily-data.csv" \
 * --lockYears="2022,2023"
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { format, parseISO } = require('date-fns');
const formatSql = require('pg-format');

// We are a script, so we must manually load dotenv
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Import the existing DB pool from the main application
const pool = require('../api/utils/db');

/**
 * Fetches the definitive 'total_rooms' and 'tax_rate' for the target hotel.
 *
 * @param {number} hotelId - The hotel_id to fetch details for.
 * @returns {object} An object containing { totalRooms, taxRate }.
 */
const getHotelDetails = async (hotelId) => {
  console.log(`Fetching details (rooms, tax) for hotelId: ${hotelId}...`);
  const { rows } = await pool.query(
    'SELECT total_rooms, tax_rate FROM hotels WHERE hotel_id = $1',
    [hotelId]
  );

  if (!rows.length) {
    throw new Error(`Hotel with hotelId ${hotelId} not found.`);
  }

  const { total_rooms, tax_rate } = rows[0];

  if (!total_rooms || total_rooms <= 0) {
    throw new Error(
      `Hotel ${hotelId} has an invalid total_rooms count: ${total_rooms}. Please fix in 'hotels' table.`
    );
  }
  if (tax_rate === null || tax_rate === undefined) {
    throw new Error(
      `Hotel ${hotelId} has a NULL tax_rate. Please fix in 'hotels' table.`
    );
  }

  console.log(`Found total_rooms: ${total_rooms}, tax_rate: ${tax_rate}`);
  // Assume tax_rate is stored as a decimal (e.g., 0.1 for 10%)
  return { totalRooms: total_rooms, taxRate: Number(tax_rate) };
};

/**
 * Reads the daily CSV file.
 *
 * @param {string} csvPath - Absolute path to the CSV file.
 * @returns {Promise<Array<object>>} A promise resolving to an array of day objects.
 */
const readCsv = (csvPath) => {
  // This function must handle the async import of csv-parse
  return new Promise(async (resolve, reject) => {
    try {
      // Dynamically import the ESM 'csv-parse' package
      const { parse } = await import('csv-parse');

      const results = [];
      const parser = fs.createReadStream(path.resolve(csvPath)).pipe(
        parse({
          columns: true, // Treat first row as headers
          skip_empty_lines: true,
          trim: true,
        })
      );

      parser.on('data', (data) => {
        results.push(data);
      });
      parser.on('end', () => {
        resolve(results);
      });
      parser.on('error', (error) => {
        reject(error);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Main script execution function.
 */
(async () => {
  let client; // For transaction management
  try {
    // 1. Parse CLI Arguments
    const argv = yargs(hideBin(process.argv))
      .option('hotelId', {
        describe: 'The hotel_id to import data for',
        type: 'number',
        demandOption: true,
      })
      .option('csv', {
        describe: 'Path to the daily data CSV file',
        type: 'string',
        demandOption: true,
      })
      .option('lockYears', {
        describe: 'Comma-separated list of years to lock (e.g., "2022,2023")',
        type: 'string',
        demandOption: true,
      }).argv;

    const { hotelId, csv: csvPath, lockYears } = argv;
    const yearsToLock = lockYears.split(',').map((y) => y.trim());

    console.log(`--- Market Pulse Daily Historical Import Tool ---`);
    console.log(`Target Hotel ID: ${hotelId}`);
    console.log(`CSV File: ${csvPath}`);
    console.log(`Years to Lock: ${yearsToLock.join(', ')}`);

    // 2. GET HOTEL DETAILS
    const { totalRooms: capacityCount, taxRate } = await getHotelDetails(
      hotelId
    );

    // 3. Read CSV
    const dailyData = await readCsv(csvPath);
    console.log(`Loaded ${dailyData.length} daily rows from CSV.`);

    // 4. Start Database Transaction
    client = await pool.connect();
    await client.query('BEGIN');
    console.log('Database transaction started.');

    // 5. Process Data & Build Bulk Insert
    const dailyRows = [];
    const datesToDelete = [];

    for (const row of dailyData) {
      // Expected CSV headers: date, revenue_gross, occupancy
      // We IGNORE adr_gross as it's unreliable.
      const { date, revenue_gross, occupancy } = row;

      if (!date || !revenue_gross || !occupancy) {
        throw new Error(
          `Invalid CSV row. Missing 'date', 'revenue_gross', or 'occupancy'. Row: ${JSON.stringify(
            row
          )}`
        );
      }

      const stayDate = format(parseISO(date), 'yyyy-MM-dd');
      datesToDelete.push(stayDate);

// --- Metric Calculation Logic (v2.1 - CORRECTED) ---
const grossRevenue = Number(revenue_gross);

// --- THIS IS THE FIX ---
// We assume occupancy is a decimal (0.85), NOT a percentage (85).
const occupancyPct = Number(occupancy); 
// ---------------------

      // 1. Calculate Rooms Sold (The reliable way)
      const roomsSold = Math.round(occupancyPct * capacityCount);

      // 2. Calculate Net Revenue
      const netRevenue = grossRevenue / (1 + taxRate);

      // 3. Calculate ADR (Net & Gross)
      const netAdr = roomsSold > 0 ? netRevenue / roomsSold : 0;
      const grossAdr = roomsSold > 0 ? grossRevenue / roomsSold : 0;

      // 4. Calculate RevPAR (Net & Gross)
      const netRevpar = netRevenue / capacityCount;
      const grossRevpar = grossRevenue / capacityCount;
      // --- End Calculation ---

      // Add to bulk insert array
      dailyRows.push([
        stayDate,
        hotelId,
        roomsSold,
        capacityCount,
        netRevenue,
        netAdr,
        netRevpar,
        grossRevenue,
        grossAdr,
        grossRevpar,
      ]);
    }

    if (!dailyRows.length) {
      throw new Error('No daily rows were generated. Check CSV.');
    }

    console.log(`Processed ${dailyRows.length} daily snapshot rows.`);

    // 6. Execute Database Operations
    // Step 6a: Delete all existing data for these specific dates
    console.log(`Deleting existing data for ${datesToDelete.length} days...`);
    await client.query(
      `
      DELETE FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date = ANY($2::date[])
    `,
      [hotelId, datesToDelete]
    );

    // Step 6b: Bulk-insert new data
    console.log('Inserting new daily snapshots...');
    const insertQuery = formatSql(
      `
      INSERT INTO daily_metrics_snapshots (
        stay_date, hotel_id, rooms_sold, capacity_count, net_revenue, 
        net_adr, net_revpar, gross_revenue, gross_adr, gross_revpar
      ) VALUES %L
    `,
      dailyRows
    );
    await client.query(insertQuery);

    // Step 6c: Atomically update the locked_years JSONB array
    console.log(`Locking years: ${yearsToLock.join(', ')}...`);
    await client.query(
      `
      UPDATE hotels
      SET locked_years = (
        SELECT jsonb_agg(DISTINCT elem)
        FROM (
          SELECT jsonb_array_elements_text(COALESCE(locked_years, '[]'::jsonb))
          UNION
          SELECT unnest($2::text[])
        ) AS t(elem)
      )
      WHERE hotel_id = $1;
    `,
      [hotelId, yearsToLock]
    );

    // 7. Commit Transaction
    await client.query('COMMIT');
    console.log('--- SUCCESS ---');
    console.log(
      'Transaction committed. Data imported and years locked successfully.'
    );
  } catch (error) {
    // 8. Rollback on Error
    if (client) {
      await client.query('ROLLBACK');
      console.error('--- ERROR: TRANSACTION ROLLED BACK ---');
    } else {
      console.error('--- ERROR ---');
    }
    console.error(error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release(); // Return client to the pool
    }
  }
})();