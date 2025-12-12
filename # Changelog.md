\# Changelog

All notable changes to the Sentinel Training Hub will be documented in this file.

\#\# \[Unreleased\]  
\#\#\# Planned  
\- Build \`etl_pipeline.py\` to normalize Raw Reservation Exports.  
\- Create \`Unified Reservation Schema\` definition.  
\- Implement \`health_check.py\` for raw JSON/CSV validation.

\#\# \[0.1.0\] \- 2025-12-06  
\#\#\# Added  
\- \*\*Project Blueprint v2.0\*\*: Shifted architecture to "Global Brain \+ Local Specialist".  
\- \*\*Data Strategy\*\*: Adopted "Daily Grain" granularity (splitting reservations into single nights).  
\- \*\*Market Intelligence\*\*: Added Codex Snapshot integration for market compression signals.

\#\#\# Removed  
\- \*\*Random Forest\*\*: Deprecated the V1 Random Forest approach in favor of Neural Networks.  
\- \*\*Snapshot Training\*\*: Removed dependency on daily snapshots for \*training\* (now used for operations only).

## [0.2.0] - 2025-12-08

### Infrastructure

- **Migration**: Moved development environment to **Nvidia DGX** (`spark-828c`).
- **Pipeline**: Deployed `etl_pipeline.py` with multi-hotel support.

### Strategy (The Pivot)

- **Modern Era Filter**: Implemented a hard cutoff (2024-01-01) for training data. Analyzing 2021-2023 proved those years contained "Volume First" strategies that confuse the current "Rate First" AI.
- **Pace-Based Pricing**: Shifted AI objective from "Price Prediction" to "Pace Curve Benchmarking."
  - Created `build_pace_curves.py` to map the "Ideal Accumulation" for every month.
  - Created `check_pace_point.py` to benchmark live dates against history.

### Logic Definitions

- **The "Lead Room" Proxy**: ETL pipeline now strictly filters for `Adults == 2` to remove noise from single corp travelers or large families.
- **NYE Physics**: Identified specific "Early Bird" dominance for NYE (revenue won 90+ days out), contrasting with the "Last Minute" nature of January.

# Changelog

## [0.2.0] - 2025-12-08 | The "Market Physics" Pivot

### 🚨 Critical Strategic Pivots

- **The "Modern Era" Decision**: We discovered a massive strategic conflict in the historical data.
  - _The Discovery_: 2021–2023 data reflected a "Volume-First" strategy (high occupancy, lower rates, panic dumping). 2024–2025 reflects a "Rate-First" strategy (higher ADR, controlled volume).
  - _The Conflict_: Training the AI on the mixed dataset confused it. It couldn't decide if "Last Minute" was a discount bin (2025) or a premium window (Old days).
  - _The Fix_: Implemented a **Hard Cutoff**. The AI is now blind to any booking created before **Jan 1, 2024**.
- **The "Pace" vs. "Price" Pivot**:
  - _The Disagreement_: The User rejected the AI's initial focus on "Total Revenue" sums, arguing that high revenue might just mean "we sold out too cheap."
  - _The Resolution_: We shifted the AI's primary goal from "Predicting Price" to **"Mapping the Curve."** The goal is now to identify the **Optimal Selling Window** (e.g., 30-60 days out) and the **Ideal Pace** (e.g., "We should be 40% full by today").

### 🧪 Experiments & Data Forensics

- **The "Lead Room" Purification**: We realized mixing Suites with Standard Rooms created noise. We updated the ETL to strictly filter for `Adults == 2` as a proxy for the core demand signal.
- **The "£483k" Outlier**: Found a single dirty data point (£483,564 rate) that broke the Neural Network's gradients. Implemented strict Price Guardrails (£20 min / £1000 max).
- **The NYE vs. Jan Analysis**:
  - _Hypothesis_: Is Winter just "Winter"?
  - _Result_: **No.** We proved New Year's Eve obeys "Summer Physics" (Revenue is won 90+ days out), whereas January obeys "Last Minute Physics" (Revenue is won 0-14 days out).
- **The "Summer Sampling" Test**: Analyzed 6 random dates in July/August. Confirmed that the "Golden Window" for revenue is consistently **15–60 days out**, and that the last 3 days are almost always a discount zone.

### 🛠 New Architecture (Files Created)

**Data Engineering**

- `etl_pipeline.py`: Updated with "Modern Era" filter, "2-Adults" filter, and TZ-naive date fixes.
- `analyze_rooms.py`: Diagnostic tool used to identify room type distributions.

**Intelligence & Physics**

- `train_global.py`: The Neural Network trainer. Updated to V2 (Price Normalization) to fix "Small Number" prediction errors.
- `analyze_physics.py`: The "Scientist." Calculates **Volume Velocity** (% of bookings per lead time bucket) and **Price Ratios** (Premium vs. Average).
- `build_pace_curves.py`: The "Cartographer." Generates the Master Reference Table showing the ideal accumulation % for every month (e.g., "By Day 60, May is usually 34% full").

**Operations Benchmarking**

- `check_pace_point.py`: The "Spot Check." Benchmarks a specific future date (e.g., Dec 27) against the Modern Era history to see if we are Behind/Ahead.
- `generate_pace_forecast.py`: Generates a daily forecast for the next 60 days.
- `plot_pace.py`: Visualizes the "Cliff Edge," proving visually that January targets drop to ~50% (Last minute market) vs December's 90%.

### 📉 Outcomes

- **Infrastructure**: Fully migrated to **Nvidia DGX** (`spark-828c`).
- **Data Health**: Normalized 4 hotels into a single 230k+ row dataset (`unified_daily_grain.csv`).
- **Model Status**: The Global Brain is trained, but the **Pace Curves** are now considered the primary operational tool for the next phase.
