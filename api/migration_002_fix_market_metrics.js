// This script corrects the typos from the first migration.
// 1. Drops the old (broken) columns and SQL function.
// 2. Creates the (corrected) SQL function.
// 3. Adds the (corrected) generated columns.
// 4. Backfills all data.
//
// To run: `node api/migration_002_fix_market_metrics.js`

require('dotenv').config(); // Load .env variables
const pool = require('./utils/db'); // Use the existing shared DB connection pool

// --- SQL FIX 1 ---
// Corrected function:
// (bucket.item->>'count')::INT is changed to (bucket.item)::text::INT
// This correctly casts the JSONB number (e.g., 5) to an integer.
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
    IF histogram IS NULL OR histogram = 'null'::jsonb OR jsonb_array_length(histogram) = 0 THEN
        RETURN NULL;
    END IF;

    bucket_width := (max_price - min_price) / jsonb_array_length(histogram);

    IF bucket_width <= 0 THEN
        RETURN NULL;
    END IF;

    FOR bucket IN SELECT * FROM jsonb_array_elements(histogram) WITH ORDINALITY AS t(item, index)
    LOOP
        bucket_price := min_price + (bucket.index - 0.5) * bucket_width;
        
        -- --- THIS IS THE FIX ---
        -- The item itself is the count, not an object.
        bucket_count := (bucket.item)::text::INT;
        -- --- END FIX ---

        total_price_x_count := total_price_x_count + (bucket_price * bucket_count);
        total_count := total_count + bucket_count;
    END LOOP;

    IF total_count = 0 THEN
        RETURN NULL;
    END IF;

    RETURN total_price_x_count / total_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

// --- SQL FIX 2 ---
// Corrected ALTER TABLE:
// ->>'HotELS' is changed to ->>'Hotels' (case-sensitive)
//
const alterTableSql = `
ALTER TABLE market_availability_snapshots
    ADD COLUMN IF NOT EXISTS weighted_avg_price NUMERIC
        GENERATED ALWAYS AS (calculate_wap(facet_price_histogram, min_price_anchor, max_price_anchor)) STORED,
    
    ADD COLUMN IF NOT EXISTS hotel_count INT
        -- --- THIS IS THE FIX ---
        GENERATED ALWAYS AS ( (facet_property_type->>'Hotels')::INT ) STORED;
        -- --- END FIX ---
`;

// This SQL drops the old, broken artifacts
const dropOldSql = `
-- Drop the generated columns (this is fast)
ALTER TABLE market_availability_snapshots
    DROP COLUMN IF EXISTS weighted_avg_price,
    DROP COLUMN IF EXISTS hotel_count;

-- Drop the old broken function
DROP FUNCTION IF EXISTS calculate_wap(JSONB, NUMERIC, NUMERIC);
`;

// This SQL backfills the data for all existing rows.
const backfillSql = `
UPDATE market_availability_snapshots
SET provider = provider;
`;

// --- Main execution function ---
const runMigration = async () => {
  console.log('Starting Phase 1 (FIX): Database Correction...');
  const client = await pool.connect();
  console.log('Database client connected.');

  try {
    await client.query('BEGIN'); // Start transaction
    console.log('Transaction started.');

    // 1. Drop old, broken columns and function
    console.log('Step 1/4: Dropping old columns and function...');
    await client.query(dropOldSql);
    console.log('...Old artifacts dropped.');

    // 2. Create the CORRECTED WAP function
    console.log('Step 2/4: Creating corrected calculate_wap() SQL function...');
    await client.query(createWapFunctionSql);
    console.log('...calculate_wap() function created successfully.');

    // 3. Add the CORRECTED Generated Columns
    console.log('Step 3/4: Altering market_availability_snapshots table...');
    await client.query(alterTableSql);
    console.log('...weighted_avg_price and hotel_count columns added successfully.');

    // 4. Backfill Historical Data
    console.log('Step 4/4: Backfilling all data (this may take a minute)...');
    const result = await client.query(backfillSql);
    console.log(`...Backfill complete. ${result.rowCount} rows updated.`);

    await client.query('COMMIT'); // Commit transaction
    console.log('---');
    console.log('✅ Migration fix successful. Database is now correct.');
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