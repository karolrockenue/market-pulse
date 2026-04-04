-- Airbnb Codex: siloed table for Airbnb market snapshots
-- Run once against the Neon DB

CREATE TABLE IF NOT EXISTS airbnb_availability_snapshots (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  city_slug     TEXT NOT NULL,
  checkin_date  DATE NOT NULL,
  total_listings INTEGER,
  listings      JSONB,                -- array of individual listing objects
  avg_price     NUMERIC,
  median_price  NUMERIC,
  scraped_at    TIMESTAMPTZ DEFAULT NOW(),

  -- one snapshot per city per checkin date per calendar day
  UNIQUE (city_slug, checkin_date, (CAST(scraped_at AT TIME ZONE 'UTC' AS DATE)))
);

CREATE INDEX IF NOT EXISTS idx_airbnb_snapshots_city_date
  ON airbnb_availability_snapshots (city_slug, checkin_date);
