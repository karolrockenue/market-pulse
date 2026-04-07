// One-time script to remove seed CRM tasks from the database.
// Run: node scripts/clear-crm-seed-tasks.js

require('dotenv').config();
const pool = require('../api/utils/db');

async function run() {
  try {
    // Delete all existing tasks (cascade deletes comments + subtasks)
    const { rowCount } = await pool.query('DELETE FROM crm_tasks');
    console.log(`Deleted ${rowCount} seed tasks (+ cascaded comments/subtasks).`);

    // Reset the sequence so new tasks start from 1
    await pool.query("ALTER SEQUENCE crm_tasks_id_seq RESTART WITH 1");
    console.log('Reset task ID sequence to 1.');

    console.log('Done. CRM is clean — ready for real tasks.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
