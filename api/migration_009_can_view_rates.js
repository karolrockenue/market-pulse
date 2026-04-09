const db = require("./utils/db");

async function run() {
  console.log("[Migration 009] Adding can_view_rates column to users...");
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_rates BOOLEAN DEFAULT false;
  `);
  console.log("[Migration 009] Done.");
  process.exit(0);
}

run().catch((err) => {
  console.error("[Migration 009] Failed:", err);
  process.exit(1);
});
