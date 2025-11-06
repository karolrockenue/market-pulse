/**
 * Market Pulse - Historical Data Import Script
 *
 * This script provides a safe, repeatable method for importing historical *monthly*
 * performance data (e.g., from a CSV) into the *daily* `daily_metrics_snapshots` table.
 *
 * It solves the "monthly-to-daily" disaggregation problem by applying a daily
 * distribution pattern from an existing "pattern hotel" (either the hotel itself
 * from a different year, or an external hotel).
 *
 * It correctly uses the hotel's definitive 'total_rooms' from the 'hotels' table
 * as the daily 'capacity_count' to ensure accurate Occupancy and RevPAR.
 *
 * ---
 * v4.0 (Nov 5, 2025)
 * - FINAL FIX: Corrected to use dynamic async import() for 'csv-parse' (v5+),
 * which is an ES Module and cannot be loaded with require().
 * ---
 *
 * Usage:
 * node scripts/import-monthly-history.js \
 * --hotelId=123 \
 * --csv="/path/to/your/monthly-data.csv" \
 * --lockYears="2022,2023" \
 * --patternHotelId=456
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const {
  format,
  parse: parseDate,
  getDaysInMonth,
  getYear,
  getMonth,
  getDate,
} = require('date-fns');
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
 * Fetches and processes the daily distribution pattern for a given hotel.
 * This pattern is used to disaggregate monthly totals into daily values.
 *
 * @param {number} hotelId - The hotel_id to fetch pattern data for.
 * @returns {object} An object mapping 'MM-DD' to its % share of monthly revenue/rooms.
 */
const getDailyPattern = async (hotelId) => {
  console.log(`Analyzing daily pattern for patternHotelId: ${hotelId}...`);

  const patternData = await pool.query(
    `
    SELECT
      TO_CHAR(stay_date, 'MM-DD') AS day_key,
      SUM(rooms_sold)::numeric AS total_rooms,
      SUM(net_revenue)::numeric AS total_revenue
    FROM daily_metrics_snapshots
    WHERE hotel_id = $1
    GROUP BY 1
    ORDER BY 1;
  `,
    [hotelId]
  );

  if (!patternData.rows.length) {
    throw new Error(
      `No pattern data found for patternHotelId: ${hotelId}. Cannot proceed.`
    );
  }

  // 1. Calculate monthly totals from the pattern data
  const monthlyTotals = {}; // 'MM' -> { rooms, revenue }
  patternData.rows.forEach((row) => {
    const month = row.day_key.split('-')[0];
    if (!monthlyTotals[month]) {
      monthlyTotals[month] = { rooms: 0, revenue: 0 };
    }
    monthlyTotals[month].rooms += Number(row.total_rooms);
    monthlyTotals[month].revenue += Number(row.total_revenue);
  });

  // 2. Calculate the daily percentage of the monthly total
  const pattern = {}; // 'MM-DD' -> { roomsPct, revenuePct }
  patternData.rows.forEach((row) => {
    const month = row.day_key.split('-')[0];
    const monthTotal = monthlyTotals[month];

    pattern[row.day_key] = {
      roomsPct:
        monthTotal.rooms > 0 ? Number(row.total_rooms) / monthTotal.rooms : 0,
      revenuePct:
        monthTotal.revenue > 0
          ? Number(row.total_revenue) / monthTotal.revenue
          : 0,
    };
  });

  console.log(
    `Successfully built daily pattern from ${patternData.rows.length} day-keys.`
  );
  return pattern;
};

/**
 * Checks if the target hotel has any existing data that can be used
 * as a "self-pattern," avoiding the need for --patternHotelId.
 *
 * @param {number} hotelId - The target hotel_id.
 * @returns {boolean} True if a self-pattern can be built.
 */
const checkSelfPattern = async (hotelId) => {
  const { rows } = await pool.query(
    `SELECT 1 FROM daily_metrics_snapshots WHERE hotel_id = $1 LIMIT 1`,
    [hotelId]
  );
  return rows.length > 0;
};

/**
 * Reads the monthly CSV file.
 *
 * @param {string} csvPath - Absolute path to the CSV file.
 * @returns {Promise<Array<object>>} A promise resolving to an array of month objects.
 */
const readCsv = (csvPath) => {
  // This function must now handle the async import of csv-parse
  return new Promise(async (resolve, reject) => {
    try {
      // --- THIS IS THE FIX ---
      // Dynamically import the ESM 'csv-parse' package
      const { parse } = await import('csv-parse');
      // ---------------------

      const results = [];
      const parser = fs.createReadStream(path.resolve(csvPath)).pipe(
        parse({
          columns: true, // Treat first row as headers
          skip_empty_lines: true,
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
 * We wrap the main logic in an async IIFE (Immediately Invoked Function Expression)
 * to allow 'await' at the top level.
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
        describe: 'Path to the monthly data CSV file',
        type: 'string',
        demandOption: true,
      })
      .option('lockYears', {
        describe: 'Comma-separated list of years to lock (e.g., "2022,2023")',
        type: 'string',
        demandOption: true,
      })
      .option('patternHotelId', {
        describe:
          'A hotel_id to use for the daily distribution pattern. If omitted, uses --hotelId.',
        type: 'number',
      }).argv;

    const { hotelId, csv: csvPath, lockYears } = argv;
    const yearsToLock = lockYears.split(',').map((y) => y.trim());
    let { patternHotelId } = argv;

    console.log(`--- Market Pulse Historical Import Tool ---`);
    console.log(`Target Hotel ID: ${hotelId}`);
    console.log(`CSV File: ${csvPath}`);
    console.log(`Years to Lock: ${yearsToLock.join(', ')}`);

    // 2. GET HOTEL ROOM COUNT
// 2. GET HOTEL DETAILS
    const { totalRooms: capacityCount, taxRate } = await getHotelDetails(
      hotelId
    );
    // 3. Determine Pattern Hotel
    if (!patternHotelId) {
      console.log('No --patternHotelId provided. Checking for self-pattern...');
      const canSelfPattern = await checkSelfPattern(hotelId);
      if (canSelfPattern) {
        console.log(
          'Self-pattern data found. Using target hotel for pattern.'
        );
        patternHotelId = hotelId;
      } else {
        throw new Error(
          `No self-pattern data found for hotel ${hotelId}. You must provide --patternHotelId.`
        );
      }
    } else {
      console.log(`Using external pattern from hotel: ${patternHotelId}`);
    }

    // 4. Get Pattern & Read CSV
    const [pattern, monthlyData] = await Promise.all([
      getDailyPattern(patternHotelId),
      readCsv(csvPath), // This will now work
    ]);

    console.log(`Loaded ${monthlyData.length} months from CSV.`);

    // 5. Start Database Transaction
    client = await pool.connect();
    await client.query('BEGIN');
    console.log('Database transaction started.');

    // 6. Disaggregate Data & Build Bulk Insert
    const dailyRows = [];
    const datesToDelete = [];

    for (const monthRow of monthlyData) {
      // Expected CSV headers: month, total_rooms_sold, total_net_revenue
      const { month, total_rooms_sold, total_net_revenue } = monthRow;

      // Parse 'YYYY-MM' or 'YYYY-MM-DD' from CSV
      const monthDate = parseDate(month, 'yyyy-MM', new Date());
      const year = getYear(monthDate);
      const monthIndex = getMonth(monthDate); // 0-11
      const daysInMonth = getDaysInMonth(monthDate);
      const monthlyCapacity = capacityCount * daysInMonth;

      // Add all dates in this month to the delete list
      for (let i = 1; i <= daysInMonth; i++) {
        datesToDelete.push(format(new Date(year, monthIndex, i), 'yyyy-MM-dd'));
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, monthIndex, day);
        const stayDate = format(currentDate, 'yyyy-MM-dd');
        const dayKey = format(currentDate, 'MM-dd'); // e.g., '01-28'

        const dayPattern = pattern[dayKey];
        if (!dayPattern) {
          console.warn(`Warning: No pattern data found for ${dayKey}.`);
          continue;
        }

        // Apply pattern percentage to monthly total
        const roomsSold = Math.round(
          Number(total_rooms_sold) * dayPattern.roomsPct
        );
        const netRevenue = Number(total_net_revenue) * dayPattern.revenuePct;

// Calculate derived metrics (Net)
        const netAdr = roomsSold > 0 ? netRevenue / roomsSold : 0;
        const netRevpar = netRevenue / capacityCount;

        // Calculate derived metrics (Gross)
        const grossRevenue = netRevenue * (1 + taxRate);
        const grossAdr = roomsSold > 0 ? grossRevenue / roomsSold : 0;
        const grossRevpar = grossRevenue / capacityCount;
        
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
    }

    if (!dailyRows.length) {
      throw new Error('No daily rows were generated. Check CSV and pattern.');
    }

    console.log(`Generated ${dailyRows.length} daily snapshot rows.`);

    // 7. Execute Database Operations
    // Step 7a: Delete all existing data
    console.log(`Deleting existing data for ${datesToDelete.length} days...`);
    await client.query(
      `
      DELETE FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date = ANY($2::date[])
    `,
      [hotelId, datesToDelete]
    );

    // Step 7b: Bulk-insert new data
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

    // Step 7c: Atomically update the locked_years JSONB array
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

    // 8. Commit Transaction
    await client.query('COMMIT');
    console.log('--- SUCCESS ---');
    console.log(
      'Transaction committed. Data imported and years locked successfully.'
    );
  } catch (error) {
    // 9. Rollback on Error
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