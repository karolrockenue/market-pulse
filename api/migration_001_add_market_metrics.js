// A one-time migration script to upgrade the market_availability_snapshots table.
// This script adds a SQL function and two 'STORED' generated columns
// to pre-calculate Weighted Average Price (WAP) and Hotel Count.
//
// As per the project plan, this moves heavy computation from "on-demand"
// to "on-insert", significantly improving API performance.
//
// To run: `node api/migration_001_add_market_metrics.js`

// --- FIX ---
// Load environment variables from .env file
// This ensures the db.js pool connects to the correct Neon database,
// not the default "karolmarcu" database.
require('dotenv').config();
// -----------

const pool = require('./utils/db'); // Use the existing shared DB connection pool

// This is the SQL function to calculate Weighted Average Price (WAP)
// It implements the methodology from the "market_price_strength_methodology.md" doc.
const createWapFunctionSql = `
CREATE OR REPLACE FUNCTION calculate_wap(
    histogram JSONB,
    min_price NUMERIC,
    max_price NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    total_price_x_count NUMERIC := 0;
    total_count NUMERIC := 0;
    bucket RECORD;
    bucket_price NUMERIC;
    bucket_count INT;
    bucket_width NUMERIC;
BEGIN
    -- Return NULL immediately if histogram is empty or invalid
    IF histogram IS NULL OR histogram = 'null'::jsonb OR jsonb_array_length(histogram) = 0 THEN
        RETURN NULL;
    END IF;

    -- Calculate the width of each price bucket
    bucket_width := (max_price - min_price) / jsonb_array_length(histogram);

    -- Return NULL if width is zero or negative (invalid data)
    IF bucket_width <= 0 THEN
        RETURN NULL;
    END IF;

    -- Loop through each bucket in the JSONB array
    FOR bucket IN SELECT * FROM jsonb_array_elements(histogram) WITH ORDINALITY AS t(item, index)
    LOOP
        -- The price is the midpoint of the bucket
        bucket_price := min_price + (bucket.index - 0.5) * bucket_width;
        
        -- The count is the value from the histogram array
        bucket_count := (bucket.item->>'count')::INT;

        -- Aggregate the totals
        total_price_x_count := total_price_x_count + (bucket_price * bucket_count);
        total_count := total_count + bucket_count;
    END LOOP;

    -- Avoid division by zero, return NULL if no items were counted
    IF total_count = 0 THEN
        RETURN NULL;
    END IF;

    -- Return the Weighted Average Price
    RETURN total_price_x_count / total_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

// This SQL alters the table to add the new generated columns.
// - weighted_avg_price: Automatically runs the calculate_wap function
// - hotel_count: Automatically extracts the 'Hotels' value from the JSON
// 'STORED' means the data is calculated and saved to disk on insert/update.
const alterTableSql = `
ALTER TABLE market_availability_snapshots
    ADD COLUMN IF NOT EXISTS weighted_avg_price NUMERIC
        GENERATED ALWAYS AS (calculate_wap(facet_price_histogram, min_price_anchor, max_price_anchor)) STORED,
    ADD COLUMN IF NOT EXISTS hotel_count INT
        GENERATED ALWAYS AS ( (facet_property_type->>'HotELS')::INT ) STORED;
`;

// This SQL backfills the data for all existing rows.
// We perform a "dummy" update to trigger the STORED generated column logic.
// We filter where the new columns ARE NULL to only affect historical rows.
const backfillSql = `
UPDATE market_availability_snapshots
SET provider = provider
WHERE weighted_avg_price IS NULL OR hotel_count IS NULL;
`;

// --- Main execution function ---
const runMigration = async () => {
  console.log('Starting Phase 1: Database Migration...');
  const client = await pool.connect();
  console.log('Database client connected.');

  try {
    await client.query('BEGIN'); // Start transaction
    console.log('Transaction started.');

    // 1. Create the WAP "Recipe" (SQL Function)
    console.log('Step 1/3: Creating calculate_wap() SQL function...');
    await client.query(createWapFunctionSql);
    console.log('...calculate_wap() function created successfully.');

    // 2. Add "Auto-Calculating" Generated Columns
    console.log('Step 2/3: Altering market_availability_snapshots table...');
    await client.query(alterTableSql);
    console.log('...weighted_avg_price and hotel_count columns added successfully.');

    // 3. Backfill Historical Data
    console.log('Step 3/3: Backfilling historical data (this may take a minute)...');
    const result = await client.query(backfillSql);
    console.log(`...Backfill complete. ${result.rowCount} historical rows updated.`);

    await client.query('COMMIT'); // Commit transaction
    console.log('---');
    console.log('✅ Migration successful. Database is now upgraded.');
    console.log('---');
  } catch (err) {
    await client.query('ROLLBACK'); // Rollback on error
    console.error('🔴 MIGRATION FAILED:', err.message);
    console.error(err.stack);
    console.log('Transaction rolled back. No changes were made.');
  } finally {
    client.release(); // Release client back to pool
    console.log('Database client released.');
    pool.end(); // Close the pool
  }
};

// Execute the migration
runMigration();