// READ-ONLY probe answering Dom's two V2 verification questions:
//   (A) "Mid Stay revenues pull from the Mid Stay Accounting codes, and ADRs
//        from the ADR of the Mid Stay rates booked?"
//   (B) "We put management (comp) rooms into a Management Segment — do these
//        reservations affect any areas of the report?"
//
// DB-only (reservations + daily_metrics_snapshots). No Mews API calls, no
// writes. Runs against the shared prod Neon DB (per Blueprint §16.15) — read
// only, safe.
//
// Usage: node scripts/probe-mason-mid-and-mgmt.js [YYYY-MM]
//        (default month = last completed calendar month)

require("dotenv").config({ path: "./.env" });
const pool = require("../api/utils/db");

// Service-UUID → { role, label } map per hotel. Mirrors MF_SERVICE_IDS +
// the excluded Management / archive services documented in
// claude/rockenue/groups/mason-and-fifth.md §10 / §18.1.
const SERVICE_MAP = {
  318341: {
    name: "Westbourne Park",
    midAccCat: "09f3c399 (Accommodation Income – Mid Stay)",
    services: {
      "e810df20-baa7-4895-a964-b26b00b051b9": ["short", "Short Stay"],
      "4d036740-d62c-41d8-bcb6-b2e400f348b3": ["mid", "Mid Stay"],
      "c65e3632-af72-4b7a-8f64-b26b00b23336": ["long", "Long (canonical)"],
      "3990f059-4fd8-47b3-ad48-b37600b41a91": ["long", "Long NEW (nightly)"],
      "72b82965-e525-4001-90d7-b26b00b26959": ["long", "Long DO-NOT-USE (legacy monthly)"],
      "38bdc698-2872-4b4f-9984-b37900af2d20": ["mgmt", "Management"],
    },
  },
  318343: {
    name: "Primrose Hill",
    midAccCat: "ed8aec0c (Accommodation Income – Mid Stay)",
    services: {
      "b518b662-2504-4092-aa6a-b13400ade71e": ["short", "Short Stay"],
      "b17bc567-1252-4532-8399-b37e00aad8fd": ["mid", "Mid Stay"],
      "270856f0-7b69-4425-a558-b14c0090c12d": ["long", "Long Stay"],
      "e5ad6c2e-58f3-4924-9e94-b38400c54e24": ["mgmt", "Management"],
      "1170a1a6-7130-4a1d-ab5d-b35b00f1692b": ["archive", "ARCHIVE Mid"],
    },
  },
  318329: {
    name: "Belsize Park",
    midAccCat: "(none — Short-Stay-only year 1)",
    services: {
      "c6267c3b-144c-40e2-baf3-b3e00110df1b": ["short", "Short Stay"],
    },
  },
};

function lastCompletedMonth() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(mk) {
  const [y, m] = mk.split("-").map(Number);
  const start = `${mk}-01`;
  const endExcl = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  return { start, endExcl };
}

async function probeHotel(hotelId, mk) {
  const cfg = SERVICE_MAP[hotelId];
  const { start, endExcl } = monthBounds(mk);

  // Per-service: reservation count + true occupied room-nights in the month.
  // room-nights = overlap of [check_in, check_out) with the month.
  const { rows } = await pool.query(
    `SELECT mews_service_id AS sid,
            COUNT(*)::int AS res_count,
            SUM(GREATEST(0,
              LEAST(check_out, $3::date) - GREATEST(check_in, $2::date)
            ))::int AS room_nights
       FROM reservations
      WHERE hotel_id = $1
        AND status NOT ILIKE '%cancel%'
        AND check_in < $3::date AND check_out > $2::date
      GROUP BY 1`,
    [hotelId, start, endExcl],
  );

  // Property-wide occupied room-nights (the report's occupancy source).
  const { rows: dms } = await pool.query(
    `SELECT SUM(rooms_sold)::int AS sold, SUM(capacity_count)::int AS cap
       FROM daily_metrics_snapshots
      WHERE hotel_id = $1 AND stay_date >= $2::date AND stay_date < $3::date`,
    [hotelId, start, endExcl],
  );
  const propSold = dms[0]?.sold || 0;
  const propCap = dms[0]?.cap || 0;

  console.log(`\n══ ${cfg.name} (${hotelId}) — ${mk} ══`);
  console.log(`Mid Stay revenue AccCat: ${cfg.midAccCat}`);
  console.log(
    `Property-wide (daily_metrics_snapshots): rooms_sold=${propSold}  capacity=${propCap}  occ=${propCap ? ((propSold / propCap) * 100).toFixed(1) : "—"}%`,
  );
  console.log(
    "service".padEnd(30) +
      "role".padEnd(9) +
      "res".padStart(6) +
      "room-nts".padStart(10) +
      "avg-stay-nts".padStart(13),
  );

  let mgmtNights = 0;
  for (const r of rows) {
    const [role, label] = cfg.services[r.sid] || ["?", "(unmapped service)"];
    if (role === "mgmt") mgmtNights += r.room_nights || 0;
    const ratio = r.res_count ? r.room_nights / r.res_count : 0;
    console.log(
      String(label).padEnd(30) +
        String(role).padEnd(9) +
        String(r.res_count).padStart(6) +
        String(r.room_nights).padStart(10) +
        ratio.toFixed(1).padStart(13),
    );
  }
  // Surface any unmapped service IDs so the map can be kept current.
  for (const r of rows) {
    if (!cfg.services[r.sid]) console.log(`   ⚠ unmapped service id ${r.sid} (${r.res_count} res)`);
  }

  console.log(
    `→ Management/comp occupied room-nights: ${mgmtNights}` +
      (propSold ? `  = ${((mgmtNights / propSold) * 100).toFixed(1)}% of property occupancy` : ""),
  );
}

(async () => {
  const mk = process.argv[2] || lastCompletedMonth();
  console.log(`Mason Mid-revenue + Management-distortion probe — month ${mk}`);
  console.log("(read-only; reservations + daily_metrics_snapshots)");
  for (const hotelId of [318341, 318343, 318329]) {
    try {
      await probeHotel(hotelId, mk);
    } catch (e) {
      console.error(`  ${hotelId} failed: ${e.message}`);
    }
  }
  console.log(`
─── How to read this ───
(A) Mid revenue: the Mason report rolls Mid into the Mid AccCat shown above
    (mason.router.js MF_HOTELS[id].accountingCategories.mid). Mid ADR =
    Mid net ÷ Mid SpaceOrder count. Where "nts/res ≫ 1" the Mid (and Long)
    SpaceOrders are MONTHLY billing units, so that ADR is an avg MONTHLY
    charge, not a nightly rate (Blueprint §15.1) — same caveat that LS→ADR
    (item 3) will fix via true room-nights.
(B) Management/comp: Management service reservations are EXCLUDED from the
    SS/MS/LS segment classification and from the revenue AccCat allowlist, so
    they do NOT touch segment revenue/bookings/ALOS/lead-time/rate charts.
    BUT property occupancy comes from daily_metrics_snapshots (rooms_sold),
    which counts physically-occupied comp rooms — so comp rooms inflate
    blended occupancy and dilute blended ADR/RevPAR by the % shown above.`);
  await pool.end();
})();
