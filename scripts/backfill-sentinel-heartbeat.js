// Backfill: seed sentinel_hotel_heartbeat from existing sentinel_job_queue.
// One-time run after migration_011; idempotent (can re-run safely).
//
// Success = status='COMPLETED' AND payload.rates array has >0 entries.
// SKIPPED jobs do not count (either disconnected or filtered by safety check).
// consecutive_failures is computed from jobs after the most recent success.
//
// To run: `node scripts/backfill-sentinel-heartbeat.js`

require('dotenv').config();
const pool = require('../api/utils/db');

async function run() {
  console.log('[Heartbeat Backfill] Starting...');

  // Latest success per hotel (COMPLETED with non-empty rates payload).
  const { rows: successes } = await pool.query(`
    SELECT DISTINCT ON (hotel_id)
      hotel_id,
      updated_at AS last_success_at,
      COALESCE(jsonb_array_length(payload->'rates'), 0) AS rates_count
    FROM sentinel_job_queue
    WHERE status = 'COMPLETED'
      AND jsonb_typeof(payload->'rates') = 'array'
      AND jsonb_array_length(payload->'rates') > 0
    ORDER BY hotel_id, updated_at DESC
  `);

  // Latest failure per hotel.
  const { rows: failures } = await pool.query(`
    SELECT DISTINCT ON (hotel_id)
      hotel_id,
      id AS job_id,
      updated_at AS last_failure_at,
      last_error
    FROM sentinel_job_queue
    WHERE status = 'FAILED'
    ORDER BY hotel_id, updated_at DESC
  `);

  const successByHotel = new Map(successes.map(r => [r.hotel_id, r]));
  const failureByHotel = new Map(failures.map(r => [r.hotel_id, r]));
  const hotelIds = new Set([...successByHotel.keys(), ...failureByHotel.keys()]);

  console.log(`[Heartbeat Backfill] Found ${successByHotel.size} hotels with a success, ${failureByHotel.size} with a failure, ${hotelIds.size} distinct.`);

  let written = 0;
  for (const hotelId of hotelIds) {
    const s = successByHotel.get(hotelId);
    const f = failureByHotel.get(hotelId);

    // consecutive_failures = count of FAILED jobs after last_success_at (or all FAILED if no success).
    let consecutive = 0;
    if (f) {
      const cutoff = s ? s.last_success_at : new Date(0);
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM sentinel_job_queue
         WHERE hotel_id = $1 AND status = 'FAILED' AND updated_at > $2`,
        [hotelId, cutoff],
      );
      consecutive = rows[0].n;
    }

    await pool.query(
      `INSERT INTO sentinel_hotel_heartbeat (
         hotel_id, last_success_at, last_success_rates_count,
         last_failure_at, last_failure_error, last_failure_job_id,
         consecutive_failures, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (hotel_id) DO UPDATE SET
         last_success_at          = EXCLUDED.last_success_at,
         last_success_rates_count = EXCLUDED.last_success_rates_count,
         last_failure_at          = EXCLUDED.last_failure_at,
         last_failure_error       = EXCLUDED.last_failure_error,
         last_failure_job_id      = EXCLUDED.last_failure_job_id,
         consecutive_failures     = EXCLUDED.consecutive_failures,
         updated_at               = NOW()`,
      [
        hotelId,
        s?.last_success_at ?? null,
        s?.rates_count ?? null,
        f?.last_failure_at ?? null,
        f?.last_error ? String(f.last_error).substring(0, 500) : null,
        f?.job_id ?? null,
        consecutive,
      ],
    );
    written += 1;
  }

  console.log(`[Heartbeat Backfill] Wrote ${written} heartbeat rows.`);
  await pool.end();
}

run().catch(err => {
  console.error('[Heartbeat Backfill] Failed:', err);
  process.exit(1);
});
