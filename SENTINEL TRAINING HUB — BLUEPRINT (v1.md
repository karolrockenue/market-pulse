SENTINEL TRAINING HUB — BLUEPRINT (v2.0)
0.0 PROTOCOL
0.1 Behaviour Rules (AI)
Do Not Start With Code: Analyze context first.

Step by Step: Propose single steps; wait for confirmation.

No Assumptions: Ask if data sources or rules are missing.

User is Architect: You propose options; the user decides.

0.2 Technical Rules (Revised)
Granularity is King: We do not train on "stay averages." We train on the Daily Grain (individual nights).

Separation of Logic:

Global Brain: Learns Human Behavior (Seasonality, Lead Time Curves, Market Elasticity).

Local Specialist: Learns Property Context (ADR Scale, Room Count, Channel Mix).

Data Sanctity: Raw exports (Booking.com/PMS) must be normalized into the Unified Schema before training.

Currency Agnostic: The Global Model sees "Ratios" (Price relative to average), not raw currency.

1.0 SYSTEM OVERVIEW
1.1 The Goal
To train a Hybrid Intelligence System:

The Foundation Model: A Neural Network (Transformer/LSTM) that predicts demand curves and price elasticity based on global data.

The Local Adapter: A lightweight tuner that applies global logic to specific hotel constraints.

1.2 The Infrastructure
Hardware: Nvidia DGX.

Environment: Python 3.12+ (venv).

Core Libraries: pytorch or tensorflow (Deep Learning), pandas (ETL), scikit-learn (Local Adapters).

1.3 The Data Flow (The New Pipeline)
Ingest: Raw Reservation Exports (PMS/OTA) + Market Snapshots (Codex).

Normalize: etl_pipeline.py converts all files into the Unified Schema (Daily Grain).

Train Global: The model learns "City Curves" and "Market Compression" logic.

Fine-Tune Local: The model adapts to specific Hotel IDs.

2.0 FILE STRUCTURE (THE MAP)
Root: /home/sentinel/sentinel-training-hub/

Plaintext

├── datasets/
│   ├── raw_exports/             <-- DUMP ZONE (CSVs/JSONs from Cloudbeds, Booking.com)
│   ├── market_codex/            <-- EXTERNAL INTEL (Market Snapshots)
│   └── processed_training/      <-- THE CLEAN FUEL (Unified Schema Parquet/CSV)
│
├── strategy/
│   ├── global_logic.md          <-- Universal Laws (Elasticity, Seasonality)
│   ├── local_configs/           <-- Per-Hotel Settings (Base Rates, Room Counts)
│   └── schema_definition.md     <-- The "Rosetta Stone" (Column Mappings)
│
├── models/
│   ├── global_brain/            <-- The Heavy Weights (.pt / .h5 files)
│   └── local_adapters/          <-- The Lightweight Tuners (.pkl / .json)
│
├── etl_pipeline.py              <-- THE TRANSLATOR (Raw -> Unified Schema)
├── train_global.py              <-- THE PROFESSOR (Trains the Brain)
├── train_local.py               <-- THE COACH (Fine-tunes the Adapter)
└── venv/
3.0 DATA STRATEGY
3.1 The Input Streams
A. Raw Reservations (The Education)

Source: Cloudbeds, Old PMS, OTA Exports.

Key Fields: Booking Date, Arrival Date, Status (Cancellations), Rate Plan.

Purpose: Reconstructs the Booking Curve and Pickup Velocity.

B. Market Context (The Environment)

Source: Codex Snapshots (market_availability_snapshots).

Key Fields: Total Supply (Compression), Price Histogram (Distribution).

Purpose: Distinguishes "My Pricing Error" vs. "Dead Market".

C. Daily Snapshots (The Heartbeat)

Source: Live PMS Feed.

Purpose: Used for validation and real-time inference (Operational State).

3.2 The Transformation: "The Daily Grain"
We split every reservation into single nights.

Input: Res #123 | Jan 10-12 | $200 Total

Output:

Jan 10 | $50 | Lead Time 30

Jan 11 | $150 | Lead Time 30 (High Demand Night)

3.3 The Unified Schema (Target Format)
hotel_id

stay_date

booking_date (derived lead_time)

price_paid (normalized)

market_compression_score (from Codex)

is_cancellation (Boolean)

4.0 LOGIC ARCHITECTURE
4.1 Global Logic (The 90%)
Lead Time Curves: "Leisure markets fill 60 days out; Corporate markets fill 7 days out."

Day-of-Week: "Saturdays carry a 1.5x premium."

Event Detection: "If Pickup Velocity > 2σ (Standard Deviation), trigger Panic Mode."

4.2 Local Context (The 10%)
Capacity Constraint: "My hotel has only 10 rooms. If I sell 2, I am 20% full. React faster than the 500-room hotel."

Currency/Scale: "Translate the Global '1.2x hike' into 'GBP +£20'."

5.0 ACTIVE SCRIPTS
etl_pipeline.py
Role: The Gatekeeper.

Action: Reads messy CSVs -> Applies Schema -> Splits into Daily Grain -> Saves to processed_training/.

train_global.py
Role: The Intelligence Builder.

Action: Loads processed data from all hotels -> Updates Neural Network weights -> Saves global_brain_v1.pt.