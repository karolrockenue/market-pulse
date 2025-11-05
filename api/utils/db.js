// /api/utils/db.js
const { Pool, types } = require("pg");

// --- FIX for Timezone Bug ---
// This tells the pg driver to not parse DATE and TIMESTAMP fields into JS Date objects.
// Instead, they will be returned as plain strings (e.g., '2025-07-19' or '2025-07-19 10:00:00').
// This prevents the driver from converting UTC dates from the DB into the server's local timezone.
const DATE_OID = 1082;
const TIMESTAMP_OID = 1114;
const TIMESTAMPTZ_OID = 1184;

const parseDate = (val) => val;

types.setTypeParser(DATE_OID, parseDate);
types.setTypeParser(TIMESTAMP_OID, parseDate);
types.setTypeParser(TIMESTAMPTZ_OID, parseDate);
// --- END FIX ---

// This initializes the PostgreSQL connection pool.
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// --- [NEW] UNHANDLED ERROR FIX ---
// This prevents an idle connection timeout from Neon DB (or any network error)
// from crashing the entire Node.js server.
pgPool.on('error', (err, client) => {
  console.error('[UNHANDLED DB POOL ERROR]', err.message, err.stack);
});
// --- END FIX ---

// Export the pool so other files can use it.
module.exports = pgPool;