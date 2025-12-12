# Sentinel Implementation Plan

## Phase 1: Data Engineering [COMPLETE]

**Goal:** Establish a pipeline that converts raw, messy reservation data into a clean "Daily Grain" format, filtered strictly for the "Modern Era" strategy.

- [x] **Environment Setup**: Migrate to Nvidia DGX (`spark-828c`) and establish `venv`.
- [x] **Schema Definition**: Define `Unified_Schema.md` (Daily Grain, Lead Time, Price Paid).
- [x] **ETL Pipeline**: Build `etl_pipeline.py`.
  - [x] Ingest Cloudbeds CSVs from multiple hotels.
  - [x] **Filter: Modern Era**: Hard cutoff for bookings created after **Jan 1, 2024**.
  - [x] **Filter: Signal Purity**: Strict filter for `Adults == 2` to isolate "Core Demand."
  - [x] **Sanity Checks**: Exclude prices < £20 or > £1000.
- [x] **Initial Load**: Successfully process 4 hotels into `unified_daily_grain.csv`.

## Phase 2: Market Physics & Benchmarking [COMPLETE]

**Goal:** Map the "Laws of Gravity" for the market (Seasonality, Pace Curves, Velocity) to create the reference benchmarks.

- [x] **Global Brain Training**: Build `train_global.py`.
  - [x] Train Neural Network on Price Elasticity (Lead Time vs Price).
  - [x] Validate against "Sanity Check" holdout data.
- [x] **Pace Curve Mapping**: Build `build_pace_curves.py`.
  - [x] Generate "Ideal Accumulation" % for every Month/Lead Time bucket.
  - [x] Identify "Last Minute" markets (Jan) vs "Early Bird" markets (May/NYE).
- [x] **Physics Analysis**: Build `analyze_physics.py`.
  - [x] Calculate "Booking Velocity" (When does the crowd arrive?).
  - [x] Calculate "Price Ratios" (Premium vs Discount windows).
- [x] **Spot Check Tool**: Build `check_pace_point.py`.
  - [x] Allow manual benchmarking: "Where should occupancy be for Dec 27 as of today?"

## Phase 3: Operations Bridge (Live Feed) [IN PROGRESS]

**Goal:** Connect the "Global Brain" and "Pace Curves" to the Live PMS to automate decision support.

- [ ] **Live Connector**: Create `sentinel_live.py`.
  - Connect to Cloudbeds API.
  - Fetch **Live Occupancy** and **Live Inventory** for the next 90 days.
- [ ] **Velocity Monitor**:
  - Calculate yesterday's pickup speed (Bookings/Day).
  - Compare against "Speed Limits" (e.g., >2/day for NYE Far Out = Raise Rate).
- [ ] **Pace Monitor**:
  - Compare Live Occupancy % against the "Ideal Pace Curve" (Phase 2).
  - Output Status: `BEHIND_PACE` | `ON_TRACK` | `AHEAD_OF_PACE`.
- [ ] **Alerting System**:
  - Trigger "PANIC" alerts if velocity exceeds safe limits.
  - Trigger "DRAG" alerts if pace falls behind the curve in critical windows (30-60 days out).

## Phase 4: Feedback Loop (Future)

**Goal:** Allow the system to re-train itself based on the outcomes of its own recommendations.

- [ ] **Performance Logging**: Record "Sentinel Recommendation" vs "User Action" vs "Result".
- [ ] **Retraining Pipeline**: Automated monthly re-run of Phase 1 & 2 to incorporate new data.
