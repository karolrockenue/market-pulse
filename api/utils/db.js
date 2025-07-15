// /api/utils/db.js
const { Pool } = require("pg");

// This initializes the PostgreSQL connection pool.
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Export the pool so other files can use it.
module.exports = pgPool;
