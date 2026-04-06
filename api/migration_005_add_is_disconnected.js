// migration_005_add_is_disconnected.js
// Adds is_disconnected boolean column to hotels table for soft disconnect feature.
// Run: node api/migration_005_add_is_disconnected.js

const pool = require("./utils/db");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE hotels ADD COLUMN IF NOT EXISTS is_disconnected BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log("Migration complete: added is_disconnected column to hotels table.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
