/**
 * READ-ONLY probe. Compares, for a Cloudbeds hotel's near-term stay-dates:
 *   1. DB snapshot rooms_sold (daily_metrics_snapshots, set by 03:00 refresh)
 *   2. FRESH Insights rooms_sold (live getUpcomingMetrics call — the authoritative source)
 *   3. Transactional in-house room count (getReservations, overlap count)
 *
 * Purpose: determine whether Insights reflects intraday bookings (low lag) and
 * whether a transactional count matches Insights semantics — to choose the
 * webhook fix's data source. Writes NOTHING.
 *
 * Usage: node scripts/probe-availability-source.js <hotel_id> [days]
 */

require('dotenv').config();
const pool = require('../api/utils/db');
const cb = require('../api/adapters/cloudbedsAdapter');

function dateOnly(v) { return v ? String(v).split(' ')[0].split('T')[0] : null; }

async function run(hotelId, days) {
  const { rows } = await pool.query(
    `SELECT hotel_id, pms_property_id, property_name, total_rooms,
            tax_rate, pricing_model
       FROM hotels WHERE hotel_id = $1`, [hotelId]);
  if (!rows.length) throw new Error(`Hotel ${hotelId} not found`);
  const h = rows[0];
  console.log(`\n${h.property_name} (${hotelId}) — Cloudbeds ${h.pms_property_id}, total_rooms=${h.total_rooms}\n`);

  const token = await cb.getAccessToken(hotelId);

  // 1. FRESH Insights (authoritative source, live right now)
  const fresh = await cb.getUpcomingMetrics(token, h.pms_property_id, h.tax_rate || 0, h.pricing_model || 'inclusive');

  // 2. DB snapshot
  const snap = await pool.query(
    `SELECT stay_date::text AS d, rooms_sold, capacity_count, snapshot_taken_date::text AS taken
       FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date >= CURRENT_DATE AND stay_date < CURRENT_DATE + $2::int
      ORDER BY stay_date`, [hotelId, days]);
  const snapMap = {};
  snap.rows.forEach(r => { snapMap[r.d] = r; });

  // 3. Transactional overlap count via getReservations (status-filtered, active only)
  const todayIso = new Date().toISOString().split('T')[0];
  const endIso = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
  const resv = await cb.getReservations(token, h.pms_property_id, {
    checkInFrom: '2020-01-01',
    checkInTo: endIso,
    checkOutFrom: todayIso,
    includeAllStatuses: 'true',
  });
  if (resv.length) console.log(`[sample reservation keys] ${Object.keys(resv[0]).join(', ')}\n`);
  const ACTIVE = (s) => s && !/cancel|no_?show/i.test(s);
  function txnCount(dateStr) {
    let n = 0;
    for (const r of resv) {
      if (!ACTIVE(r.status)) continue;
      const ci = dateOnly(r.startDate || r.reservationCheckIn);
      const co = dateOnly(r.endDate || r.reservationCheckOut);
      if (ci && co && ci <= dateStr && dateStr < co) n++;
    }
    return n;
  }

  console.log('stay_date  | DB sold | Insights(now) | txn(reservations) | DB-vs-Insights');
  console.log('-----------+---------+---------------+-------------------+---------------');
  const allDates = Object.keys(fresh).filter(d => d >= todayIso && d < endIso).sort().slice(0, days);
  for (const d of allDates) {
    const ins = Math.round(fresh[d]?.rooms_sold ?? 0);
    const db = snapMap[d] ? Math.round(snapMap[d].rooms_sold) : null;
    const txn = txnCount(d);
    const diff = db == null ? '—' : (ins - db);
    console.log(
      `${d} | ${String(db ?? '—').padStart(7)} | ${String(ins).padStart(13)} | ${String(txn).padStart(17)} | ${String(diff).padStart(13)}`
    );
  }
  console.log(`\nDB snapshot_taken_date: ${snap.rows[0]?.taken || 'n/a'} | reservations fetched: ${resv.length}`);
}

const hotelId = parseInt(process.argv[2], 10);
const days = parseInt(process.argv[3], 10) || 12;
if (!hotelId) { console.error('Usage: node scripts/probe-availability-source.js <hotel_id> [days]'); process.exit(1); }
run(hotelId, days)
  .catch(e => { console.error('Probe error:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
