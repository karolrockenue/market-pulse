/**
 * Property-wide historical revenue backfill for Mason & Fifth hotels.
 *
 * Purpose: light up the "Pr. Year" column on Sales Flash for all 3 M&F
 * hotels by pulling consumed revenue from Mews WITHOUT the single-
 * ServiceIds filter that `getRevenueMetrics` uses. The standard backfill
 * misses Westbourne's pre-March-2026 revenue because the current Short
 * Stay service didn't exist back then — bookings sat under other service
 * IDs we don't query.
 *
 * Scope: AccCat allowlist matches `mason.router.js` MF_HOTELS — the same
 * Short / Mid / Long Accommodation Income categories Sales Flash uses,
 * so Pr. Year ties to the same scope as the current-month figure.
 *
 * Day-grouping: 11:00 local cutoff per Blueprint §13.1 (Mews Order Items
 * Report convention).
 *
 * Writes: gross_revenue + net_revenue on daily_metrics_snapshots.
 *         Does NOT touch rooms_sold / capacity_count — leaves whatever
 *         the prior service-scoped backfill wrote. Westbourne pre-Mar-2026
 *         occupancy stays blank because services/getAvailability for the
 *         current service ID returns nothing for that period.
 *
 * Usage:
 *   node scripts/backfill-mf-historical-revenue.js                       # all 3, 2024-04-01 → 2026-03-31
 *   node scripts/backfill-mf-historical-revenue.js 318341                # single hotel
 *   node scripts/backfill-mf-historical-revenue.js 318341 2024-04-01 2025-12-31
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const mewsAdapter = require('../api/adapters/mewsAdapter');

const MF_HOTELS = {
  318329: {
    name: 'Belsize Park',
    accCats: ['d30087d1-9400-4550-9838-b3e900b73224'],
  },
  318341: {
    name: 'Westbourne Park',
    accCats: [
      '69d71bed-2cf8-4abe-b7df-b26b00b80ae0', // Short Stay
      '09f3c399-8ca0-4418-93bb-b2e400f31f27', // Mid Stay
      '58dcdf67-55af-44b0-a847-b26b00b7ed18', // Long Stay
    ],
  },
  318343: {
    name: 'Primrose Hill',
    accCats: [
      '92fa995e-9d52-46fb-8d05-b145008b03bc', // Short Stay
      'ed8aec0c-9c25-4ed5-ab95-b2e400e02a4f', // Mid Stay
      '0885a203-be01-4cc7-8d6c-b14500a4f4b3', // Long Stay
    ],
  },
};

const argHotelId = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const argStart = process.argv[3] || '2024-04-01';
const argEnd = process.argv[4] || '2026-03-31';

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Subtract 11h from ConsumedUtc, then format in the hotel's local
 * timezone. Matches Mason Dashboard / Sales Flash day-grouping rule.
 */
function consumedDate(utcStr, timezone) {
  const d = new Date(utcStr);
  d.setUTCHours(d.getUTCHours() - 11);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

async function fetchPropertyWideRevenue(credentials, accCats, startDate, endDate, timezone) {
  const allowSet = new Set(accCats);
  const dailyTotals = {}; // { 'YYYY-MM-DD': { net, gross } }

  // Mews orderItems/getAll window cap = 3 months + 1 day. Chunk at 89 days.
  let chunkStart = startDate;
  while (chunkStart <= endDate) {
    const chunkEnd = addDays(chunkStart, 88) > endDate ? endDate : addDays(chunkStart, 88);

    // Mews local-midnight to UTC: subtract the UK offset. Use Intl trick.
    const localToUtc = (iso) => {
      const d = new Date(`${iso}T00:00:00Z`);
      const offsetMin = new Date(d.toLocaleString('en-US', { timeZone: timezone })).getTime()
        - d.getTime();
      return new Date(d.getTime() - offsetMin).toISOString();
    };

    let cursor = null;
    do {
      const body = {
        ConsumedUtc: {
          StartUtc: localToUtc(chunkStart),
          EndUtc: localToUtc(addDays(chunkEnd, 1)),
        },
        Types: ['SpaceOrder'],
        AccountingStates: ['Open', 'Closed'],
        Limitation: { Cursor: cursor, Count: 1000 },
      };
      const resp = await mewsAdapter._callMewsApi('orderItems/getAll', credentials, body);
      const items = resp.OrderItems || [];
      for (const item of items) {
        if (!allowSet.has(item.AccountingCategoryId)) continue;
        if (item.Type === 'Deposit') continue; // belt + braces, Types filter should cover
        const date = consumedDate(item.ConsumedUtc, timezone);
        if (!dailyTotals[date]) dailyTotals[date] = { net: 0, gross: 0 };
        if (item.Amount) {
          if (typeof item.Amount.NetValue === 'number') dailyTotals[date].net += item.Amount.NetValue;
          if (typeof item.Amount.GrossValue === 'number') dailyTotals[date].gross += item.Amount.GrossValue;
        }
      }
      cursor = resp.Cursor || null;
    } while (cursor);

    chunkStart = addDays(chunkEnd, 1);
  }

  return dailyTotals;
}

async function run() {
  const ids = argHotelId ? [argHotelId] : Object.keys(MF_HOTELS).map(Number);

  for (const hotelId of ids) {
    const meta = MF_HOTELS[hotelId];
    if (!meta) {
      console.error(`Unknown hotel ${hotelId} — skipping`);
      continue;
    }

    // Load credentials + timezone from hotels.pms_credentials
    const { rows: hotelRows } = await pool.query(
      `SELECT pms_credentials FROM hotels WHERE hotel_id = $1`,
      [hotelId],
    );
    if (hotelRows.length === 0) {
      console.error(`Hotel ${hotelId} not found`);
      continue;
    }
    const creds = await mewsAdapter.getCredentials(hotelId);
    const tz = hotelRows[0].pms_credentials?.timezone || 'Europe/London';

    console.log(`\n── ${meta.name} (${hotelId}) ${argStart} → ${argEnd} ──`);
    console.log(`  AccCats: ${meta.accCats.length}, timezone: ${tz}`);

    let dailyTotals;
    try {
      dailyTotals = await fetchPropertyWideRevenue(creds, meta.accCats, argStart, argEnd, tz);
    } catch (err) {
      console.error(`  ✗ Fetch failed: ${err.message}`);
      continue;
    }

    const dates = Object.keys(dailyTotals).sort();
    const totalGross = dates.reduce((s, d) => s + dailyTotals[d].gross, 0);
    const totalNet = dates.reduce((s, d) => s + dailyTotals[d].net, 0);
    console.log(`  Fetched ${dates.length} days. Total gross £${totalGross.toLocaleString('en-GB', { maximumFractionDigits: 0 })} / net £${totalNet.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`);

    // Upsert into daily_metrics_snapshots (revenue columns only)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let upserted = 0;
      for (const date of dates) {
        const { net, gross } = dailyTotals[date];
        if (date < argStart || date > argEnd) continue; // 11h cutoff can spill ±1 day at the edges
        await client.query(
          `INSERT INTO daily_metrics_snapshots
              (hotel_id, stay_date, gross_revenue, net_revenue, snapshot_taken_date)
            VALUES ($1, $2, $3, $4, CURRENT_DATE)
            ON CONFLICT (hotel_id, stay_date) DO UPDATE
              SET gross_revenue = EXCLUDED.gross_revenue,
                  net_revenue = EXCLUDED.net_revenue,
                  snapshot_taken_date = CURRENT_DATE`,
          [hotelId, date, gross, net],
        );
        upserted++;
      }
      await client.query('COMMIT');
      console.log(`  ✓ Upserted ${upserted} day rows`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ✗ DB write failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  await pool.end();
}

run();
