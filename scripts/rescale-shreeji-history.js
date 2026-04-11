/**
 * Market Pulse — Shreeji Group Historical Rescale
 *
 * Reads claude/Copy of FULL Shreeji 2024 _ 2025.xlsx (one tab per hotel with
 * monthly totals) and rewrites daily_metrics_snapshots so each month's totals
 * exactly match the sheet. Preserves the existing daily shape (from Cloudbeds'
 * partial historical import) by computing each day's % share of its month's
 * gross and scaling. Months where the DB has no data flat-distribute.
 *
 * Rule: if a month is missing/blank in the sheet, we leave the DB untouched
 * for that month (Cloudbeds already has the real post-go-live data).
 *
 * Default is DRY RUN (rolls back). Pass --apply to commit.
 * Pass --hotel=<id> to process a single hotel.
 *
 * On commit, sets hotels.locked_years = ['2024','2025'] (merged, not replaced)
 * so initial-sync.js will not wipe these years on future re-imports.
 *
 * Usage:
 *   node scripts/rescale-shreeji-history.js           # dry run, all hotels
 *   node scripts/rescale-shreeji-history.js --apply   # commit all hotels
 *   node scripts/rescale-shreeji-history.js --hotel=318304 --apply
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ExcelJS = require('exceljs');
const pool = require('../api/utils/db');

const XLSX_PATH = path.resolve(
  __dirname,
  '../claude/Copy of FULL Shreeji 2024 _ 2025.xlsx'
);

const SHEET_TO_HOTEL = {
  Portico: 318304,
  'The 29': 318308,
  'The W14': 318309,
  'St George Victoria': 318305,
  'Maiden Oval': 318307,
  Tudor: 318317,
  'The House on Warwick': 318316,
  'House of Toby': 318311,
  'Pack & Carriage': 318312,
  'Hyde Park Green': 318314,
};

// True-accounting annual targets from Shreeji (2024 + 2025 full-year).
// Used to (a) derive Dec 2025 for hotels where the sheet only has Jan-Nov and
// (b) final-verify the DB totals land within 0.5% of target after rescale.
const HOTEL_TARGETS = {
  318304: { 2024: 2309327, 2025: 2145154 }, // Portico
  318308: { 2024: 1746735, 2025: 1742908 }, // The 29
  318309: { 2024: 2474166, 2025: 2691479 }, // The W14
  318305: { 2024: 961469,  2025: 1021985 }, // St George Victoria
  318307: { 2024: 1237696, 2025: 1330807 }, // Maiden Oval
  318317: { 2024: 568564,  2025: 469457 },  // Tudor
  318316: { 2024: 2635487, 2025: 2645134 }, // House on Warwick
  318311: { 2024: 2333478, 2025: 2239579 }, // House of Toby
  318312: { 2024: 677327,  2025: 649651 },  // Pack & Carriage
  318314: { 2024: 849535,  2025: 938914 },  // Hyde Park Green
};

// Hotels where Dec 2025 must be derived from full-year target minus Jan-Nov
// sheet sum (sheet has no usable Dec 2025 row). Went live mid-Dec so Cloudbeds
// Dec 2025 is partial/broken and we overwrite it.
const DERIVE_DEC_2025_FROM_TARGET = new Set([
  318308, // The 29
  318307, // Maiden Oval
  318311, // House of Toby
  318312, // Pack & Carriage
]);

const LOCK_YEARS = ['2024', '2025'];
const TOLERANCE_PCT = 0.005; // 0.5%

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const onlyHotelArg = args.find((a) => a.startsWith('--hotel='));
const ONLY_HOTEL_ID = onlyHotelArg ? Number(onlyHotelArg.split('=')[1]) : null;

const fmtGBP = (n) =>
  '£' + Math.round(Number(n)).toLocaleString('en-GB');

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

async function readSheet() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const byHotel = {};
  for (const [sheetName, hotelId] of Object.entries(SHEET_TO_HOTEL)) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) throw new Error(`Missing sheet: ${sheetName}`);

    const months = [];
    const byYM = {};
    let lastDataRow = 1;
    let dec2024Rooms = null;

    ws.eachRow((row, rn) => {
      if (rn === 1) return; // header
      const dateCell = row.getCell(1).value;
      const roomsCell = row.getCell(4).value;
      const revCell = row.getCell(6).value;

      if (!(dateCell instanceof Date)) return;
      const year = dateCell.getUTCFullYear();
      const month = dateCell.getUTCMonth() + 1;
      const rev = Number(revCell);
      const rooms = Number(roomsCell);
      const validRev = Number.isFinite(rev) && rev > 0;
      const validRooms = Number.isFinite(rooms) && rooms > 0;

      if (year === 2024 && month === 12 && validRooms) {
        dec2024Rooms = Math.round(rooms);
      }

      if (validRev && validRooms) {
        const m = {
          year,
          month,
          roomsSold: Math.round(rooms),
          grossRevenue: rev,
        };
        months.push(m);
        byYM[`${year}-${month}`] = m;
        lastDataRow = rn;
      }
    });

    // Pass A — orphan Dec 2025 detection (Portico/W14/St George Victoria):
    // these sheets have Dec 2025 revenue in F but missing rooms_sold and/or
    // missing date. Fall back to Dec 2024 rooms for shape.
    if (!byYM['2025-12']) {
      const scanEnd = Math.min(lastDataRow + 3, ws.rowCount);
      for (let r = lastDataRow + 1; r <= scanEnd; r++) {
        const row = ws.getRow(r);
        const revCell = row.getCell(6).value;
        const roomsCell = row.getCell(4).value;
        const rev = Number(revCell);
        const rooms = Number(roomsCell);
        const validRev = Number.isFinite(rev) && rev > 0;
        const validRooms = Number.isFinite(rooms) && rooms > 0;

        if (!validRev) continue;

        const roomsResolved = validRooms
          ? Math.round(rooms)
          : dec2024Rooms;

        if (roomsResolved == null) {
          console.warn(
            `  [${sheetName}] Dec 2025 orphan revenue £${Math.round(
              rev
            )} but no rooms_sold and no Dec 2024 fallback — skipping`
          );
          break;
        }

        const m = {
          year: 2025,
          month: 12,
          roomsSold: roomsResolved,
          grossRevenue: rev,
          _orphan: true,
          _fallbackRooms: !validRooms,
        };
        months.push(m);
        byYM['2025-12'] = m;
        console.log(
          `  [${sheetName}] Dec 2025 orphan resolved: rev £${Math.round(
            rev
          )}, rooms ${roomsResolved}${
            !validRooms ? ' (from Dec 2024 fallback)' : ''
          }`
        );
        break;
      }
    }

    // Pass B — derive Dec 2025 from full-year target for mid-December go-live
    // hotels (The 29, Maiden Oval, House of Toby, Pack & Carriage).
    // Dec 2025 revenue = target_2025 − Σ(sheet Jan-Nov 2025). Rooms_sold is
    // taken from the sheet's D25 cell if present (Maiden Oval has 1117),
    // otherwise falls back to Dec 2024 rooms from the same sheet.
    if (DERIVE_DEC_2025_FROM_TARGET.has(hotelId) && !byYM['2025-12']) {
      const target2025 = HOTEL_TARGETS[hotelId]?.[2025];
      if (target2025 == null) {
        throw new Error(`Missing HOTEL_TARGETS[${hotelId}][2025]`);
      }

      const jan2025NovSum = months
        .filter((m) => m.year === 2025)
        .reduce((s, m) => s + m.grossRevenue, 0);
      const decRev = target2025 - jan2025NovSum;

      if (decRev <= 0) {
        console.warn(
          `  [${sheetName}] Derived Dec 2025 is non-positive (${decRev.toFixed(
            2
          )}) — skipping`
        );
      } else {
        // Scan rows 24-27 for any stray D value (rooms_sold) for Dec 2025.
        let decRooms = null;
        const scanEnd = Math.min(lastDataRow + 3, ws.rowCount);
        for (let r = lastDataRow + 1; r <= scanEnd; r++) {
          const roomsCell = ws.getRow(r).getCell(4).value;
          const roomsNum = Number(roomsCell);
          if (Number.isFinite(roomsNum) && roomsNum > 0) {
            decRooms = Math.round(roomsNum);
            break;
          }
        }
        if (decRooms == null) decRooms = dec2024Rooms;

        if (decRooms == null) {
          console.warn(
            `  [${sheetName}] Dec 2025 derived rev £${Math.round(
              decRev
            )} but no rooms proxy — skipping`
          );
        } else {
          const m = {
            year: 2025,
            month: 12,
            roomsSold: decRooms,
            grossRevenue: decRev,
            _derivedFromTarget: true,
          };
          months.push(m);
          byYM['2025-12'] = m;
          console.log(
            `  [${sheetName}] Dec 2025 derived: rev £${Math.round(
              decRev
            )}, rooms ${decRooms} (target £${target2025} − Jan-Nov £${Math.round(
              jan2025NovSum
            )})`
          );
        }
      }
    }

    byHotel[hotelId] = { sheetName, months };
  }
  return byHotel;
}

async function getHotelMeta(client, hotelId) {
  const { rows } = await client.query(
    'SELECT property_name, total_rooms, tax_rate FROM hotels WHERE hotel_id = $1',
    [hotelId]
  );
  if (!rows.length) throw new Error(`Hotel ${hotelId} not found`);
  return {
    name: rows[0].property_name,
    totalRooms: Number(rows[0].total_rooms),
    taxRate: Number(rows[0].tax_rate),
  };
}

async function getDbMonthShape(client, hotelId, year, month) {
  const { rows } = await client.query(
    `SELECT stay_date::text AS stay_date,
            COALESCE(gross_revenue, 0)::numeric AS gross_revenue,
            COALESCE(rooms_sold, 0)::int        AS rooms_sold
       FROM daily_metrics_snapshots
      WHERE hotel_id = $1
        AND EXTRACT(YEAR  FROM stay_date) = $2
        AND EXTRACT(MONTH FROM stay_date) = $3
      ORDER BY stay_date`,
    [hotelId, year, month]
  );
  return rows;
}

function computeDailyRows({
  hotelId,
  year,
  month,
  totalGross,
  totalRooms,
  capacity,
  taxRate,
  dbShape,
}) {
  const days = daysInMonth(year, month);
  const out = [];

  let dbGrossSum = 0;
  let dbRoomsSum = 0;
  const shapeByDay = {};
  for (const r of dbShape) {
    dbGrossSum += Number(r.gross_revenue);
    dbRoomsSum += Number(r.rooms_sold);
    shapeByDay[r.stay_date] = r;
  }

  for (let d = 1; d <= days; d++) {
    const stayDate = `${year}-${String(month).padStart(2, '0')}-${String(
      d
    ).padStart(2, '0')}`;
    const rec = shapeByDay[stayDate];

    let dayGross;
    if (dbGrossSum > 0 && rec) {
      const pct = Number(rec.gross_revenue) / dbGrossSum;
      dayGross = totalGross * pct;
    } else {
      dayGross = totalGross / days;
    }

    let dayRooms;
    if (dbRoomsSum > 0 && rec) {
      const pctR = Number(rec.rooms_sold) / dbRoomsSum;
      dayRooms = Math.round(totalRooms * pctR);
    } else {
      dayRooms = Math.round(totalRooms / days);
    }

    const dayNet = dayGross / (1 + taxRate);
    const grossAdr = dayRooms > 0 ? dayGross / dayRooms : 0;
    const netAdr = dayRooms > 0 ? dayNet / dayRooms : 0;
    const grossRevpar = dayGross / capacity;
    const netRevpar = dayNet / capacity;

    out.push({
      stayDate,
      hotelId,
      dayRooms,
      capacity,
      dayNet,
      netAdr,
      netRevpar,
      dayGross,
      grossAdr,
      grossRevpar,
    });
  }
  return out;
}

(async () => {
  console.log('--- Shreeji Historical Rescale ---');
  console.log(`Mode: ${APPLY ? 'APPLY (will commit)' : 'DRY RUN (rollback)'}`);
  if (ONLY_HOTEL_ID) console.log(`Only hotel: ${ONLY_HOTEL_ID}`);

  const byHotel = await readSheet();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let totalBefore = 0;
    let totalAfter = 0;
    const processedHotels = [];

    for (const [hotelIdStr, data] of Object.entries(byHotel)) {
      const hotelId = Number(hotelIdStr);
      if (ONLY_HOTEL_ID && hotelId !== ONLY_HOTEL_ID) continue;

      const meta = await getHotelMeta(client, hotelId);
      console.log(
        `\n=== ${meta.name} (${hotelId}) — rooms=${meta.totalRooms}, vat=${meta.taxRate} ===`
      );

      const beforeRow = await client.query(
        `SELECT COALESCE(SUM(gross_revenue), 0)::numeric AS g
           FROM daily_metrics_snapshots
          WHERE hotel_id = $1 AND EXTRACT(YEAR FROM stay_date) IN (2024, 2025)`,
        [hotelId]
      );
      const beforeGross = Number(beforeRow.rows[0].g);

      console.log(`  Sheet months: ${data.months.length}`);

      let hotelNewGrossSum = 0;
      const allNewRows = [];
      const allStayDates = [];

      for (const m of data.months) {
        const dbShape = await getDbMonthShape(client, hotelId, m.year, m.month);
        const rows = computeDailyRows({
          hotelId,
          year: m.year,
          month: m.month,
          totalGross: m.grossRevenue,
          totalRooms: m.roomsSold,
          capacity: meta.totalRooms,
          taxRate: meta.taxRate,
          dbShape,
        });
        for (const r of rows) {
          hotelNewGrossSum += r.dayGross;
          allStayDates.push(r.stayDate);
          allNewRows.push(r);
        }
      }

      console.log(
        `  Before 2024+2025 gross (all months): ${fmtGBP(beforeGross)}`
      );
      console.log(
        `  After  (sheet months only rewritten): ${fmtGBP(hotelNewGrossSum)}`
      );

      totalBefore += beforeGross;
      totalAfter += hotelNewGrossSum;

      await client.query(
        `DELETE FROM daily_metrics_snapshots
          WHERE hotel_id = $1 AND stay_date = ANY($2::date[])`,
        [hotelId, allStayDates]
      );

      if (allNewRows.length) {
        await client.query(
          `INSERT INTO daily_metrics_snapshots
            (stay_date, hotel_id, rooms_sold, capacity_count,
             net_revenue, net_adr, net_revpar,
             gross_revenue, gross_adr, gross_revpar)
          SELECT * FROM UNNEST (
            $1::date[], $2::int[], $3::int[], $4::int[],
            $5::numeric[], $6::numeric[], $7::numeric[],
            $8::numeric[], $9::numeric[], $10::numeric[]
          )`,
          [
            allNewRows.map((r) => r.stayDate),
            allNewRows.map(() => hotelId),
            allNewRows.map((r) => r.dayRooms),
            allNewRows.map((r) => r.capacity),
            allNewRows.map((r) => r.dayNet),
            allNewRows.map((r) => r.netAdr),
            allNewRows.map((r) => r.netRevpar),
            allNewRows.map((r) => r.dayGross),
            allNewRows.map((r) => r.grossAdr),
            allNewRows.map((r) => r.grossRevpar),
          ]
        );
      }

      processedHotels.push(hotelId);
    }

    if (processedHotels.length) {
      await client.query(
        `UPDATE hotels
            SET locked_years = (
              SELECT jsonb_agg(DISTINCT elem)
                FROM (
                  SELECT jsonb_array_elements_text(COALESCE(locked_years, '[]'::jsonb))
                  UNION
                  SELECT unnest($2::text[])
                ) AS t(elem)
            )
          WHERE hotel_id = ANY($1::int[])`,
        [processedHotels, LOCK_YEARS]
      );
    }

    console.log('\n================ SUMMARY ================');
    console.log(`Hotels processed: ${processedHotels.length}`);
    console.log(`Total BEFORE (2024+2025 gross):          ${fmtGBP(totalBefore)}`);
    console.log(`Total AFTER  (rewritten sheet months):   ${fmtGBP(totalAfter)}`);

    // Final verification: read post-rescale totals from inside the txn and
    // compare against HOTEL_TARGETS. Abort commit if any hotel exceeds 0.5%.
    console.log('\n--- Verification (±0.5% tolerance) ---');
    const verifyRows = await client.query(
      `SELECT hotel_id,
              EXTRACT(YEAR FROM stay_date)::int AS yr,
              ROUND(COALESCE(SUM(gross_revenue), 0)::numeric, 0) AS total
         FROM daily_metrics_snapshots
        WHERE hotel_id = ANY($1::int[])
          AND EXTRACT(YEAR FROM stay_date) IN (2024, 2025)
        GROUP BY hotel_id, EXTRACT(YEAR FROM stay_date)`,
      [processedHotels]
    );

    const actual = {};
    for (const row of verifyRows.rows) {
      if (!actual[row.hotel_id]) actual[row.hotel_id] = {};
      actual[row.hotel_id][row.yr] = Number(row.total);
    }

    let failures = 0;
    for (const hotelId of processedHotels) {
      const target = HOTEL_TARGETS[hotelId];
      const got = actual[hotelId] || {};
      const meta = await getHotelMeta(client, hotelId);
      for (const yr of [2024, 2025]) {
        const t = target[yr];
        const g = got[yr] || 0;
        const delta = g - t;
        const pct = t > 0 ? delta / t : 0;
        const ok = Math.abs(pct) <= TOLERANCE_PCT;
        const marker = ok ? '✅' : '❌';
        console.log(
          `  ${marker} ${meta.name.padEnd(32)} ${yr}  target ${fmtGBP(
            t
          )}  actual ${fmtGBP(g)}  Δ ${(pct * 100).toFixed(2)}%`
        );
        if (!ok) failures += 1;
      }
    }

    console.log(`\nlocked_years → ["2024","2025"] (merged) for processed hotels`);

    if (failures > 0) {
      console.error(
        `\n❌ ${failures} hotel-year(s) outside ±0.5% tolerance — rolling back.`
      );
      await client.query('ROLLBACK');
      process.exitCode = 1;
      return;
    }

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\n✅ COMMITTED.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY RUN — rolled back. Pass --apply to commit.');
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERROR — rolled back:', e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
