# **SENTINEL MASTER BLUEPRINT (v6.4)**

**System Status:** Phase 3 (Live Operations Bridge) | **Strategy:** "The Navigator"

## **1.0 SYSTEM IDENTITY & PROTOCOL**

**Sentinel** is a Hybrid Intelligence System acting as a "Navigator" for hotel revenue. It relies on **Control Theory** (correcting deviations from a target path) rather than pure predictive forecasting.

### **1.1 AI Interaction Protocol**

- **Role:** You are the Lead Architect. Do not write code until requirements are clear.
- **Granularity:** All logic operates on the **Daily Grain** (Date \+ Hotel ID).
- **Modern Era Rule:** Training data strictly excludes pre-2024 records to avoid "Volume-First" contamination.
- **Signal Purity:** Demand logic filters strictly for `Adults == 2` (The Lead Room proxy).

---

## **2.0 FLEET INVENTORY & STATUS**

_This table maps the internal IDs found in the Daily Grain to the Real Hotel Names. All listed hotels are Active and Ready._

### **2.1 Active Fleet (Ready for AI)**

| Hotel Name                   | System ID (UUID or Int)                | Source Type |
| :--------------------------- | :------------------------------------- | :---------- |
| **The Portico Hotel**        | `fbd2965d-34d9-4134-944f-28c3b512f2ff` | UUID (Raw)  |
| **The W14 Hotel**            | `ee9f3ef4-9a88-46a9-aaf6-83a5c17bea4a` | UUID (Raw)  |
| **House of Toby**            | `1fa4727c-eb1a-44ce-bf95-5bc4fe6dac7d` | UUID (Raw)  |
| **The 29 London**            | `bb9b3c42-4d0d-4c0d-9f74-efd32aea7d52` | UUID (Raw)  |
| **Astor Victoria**           | `2400`                                 | Integer     |
| **Jubilee Hotel Victoria**   | `230719`                               | Integer     |
| **The Cleveland Hotel**      | `289618`                               | Integer     |
| **The Melita**               | `308760`                               | Integer     |
| **Vilenza Hotel**            | `315428`                               | Integer     |
| **Camden Suites**            | `315429`                               | Integer     |
| **City Rooms**               | `315430`                               | Integer     |
| **London Homes (Aldgate)**   | `315431`                               | Integer     |
| **The Whitechapel Hotel**    | `315433`                               | Integer     |
| **Citygate**                 | `315435`                               | Integer     |
| **Elysee Hyde Park**         | `315473`                               | Integer     |
| **Notting Hill House Hotel** | `316843`                               | Integer     |
| **The Jade Hotel**           | `318238`                               | Integer     |
| **Whitechapel Grand**        | `318297`                               | Integer     |
| **London Suites**            | `318298`                               | Integer     |
| **Studio 169**               | `318301`                               | Integer     |
| **Lancaster Court Hotel**    | `318302`                               | Integer     |

Export to Sheets

### **2.2 Missing Data (Action Required)**

_Defined in system but missing raw CSV data:_

- St George Hotel Norfolk Square (ID: 318291\)
- G Hotel Henderson (ID: 318303\)
- St George's Inn Victoria (ID: 318305\)
- Maiden Oval (ID: 318307\)
- Aviator Bali (ID: 318310\)
- The Pack and Carriage London (ID: 318312\)

---

3.0 PROJECT FUNDAMENTALS (LOGIC PILLARS)
The Sentinel architecture rests on four non-negotiable pillars. These define how the system perceives time, demand, and price, pivoting away from prediction and towards Control Theory.

3.1 The Navigator Logic (Control Theory)
The system operates by correcting Pace Deviations within strict bounds. It does not "predict" the final price; it "navigates" towards a full hotel by adjusting the rate based on current position vs. the strategic path.

The Floor (Hard Constraint): Defined by the User-Set Base Rate (sourced from Market Pulse).

The Ceiling (Dynamic Constraint): Defined by the Dynamic Rate Cap (Section 3.4).

The Path (Strategic Target): Defined by the Inverted Pace Curve (Section 3.3).

3.2 The Price Power Switch (Dynamic Seasonality)
We do not use hard-coded calendar months (e.g., "August is High Season"). We define seasonality dynamically per hotel based on Pricing Power.

The Logic: A month’s seasonality is determined by comparing its Historical Average ADR against the hotel’s Annual Average ADR.

The Thresholds (The Three Tiers):

LOW (Pressure Mode): Month ADR is < 90% of Annual Average.

MID (Guide Mode): Month ADR is 90% - 102% of Annual Average.

HIGH (Trap Mode): Month ADR is > 102% of Annual Average.

The Override: The Market Pulse UI provides a "Seasonality Override" control, allowing human managers to force a specific month into a different tier (e.g., promoting February to 'High' for a specific event).

3.3 The Inverted Pace Curves (Strategic Archetypes)
We do not use generic curves. Each hotel gets 3 Custom Curves (Low, Mid, High) generated from its own historical DNA, but distorted to force specific behaviors.

The Universal Anchor (The Law of Day 7): Regardless of season or hotel, ALL curves must converge to 95% Occupancy by Day 7. This ensures that no matter how arrogant or desperate the strategy, the system always prioritizes filling rooms in the final week.

Archetype A: The Pressure Curve (Low Season | "Panic Mode")

The Goal: Force the system to feel "Behind Pace" to stimulate volume at the floor price.

The Mechanics: Target = Historical Pace + Pressure Margin (15%)

Result: Since Target > Reality, the system perceives a deficit and Yields DOWN immediately.

Archetype B: The Guide Curve (Medium Season | "Integrity Mode")

The Goal: Maintain rate integrity. Prevent unnecessary drops without forcing unrealistic hikes.

The Mechanics: Target = Historical Pace \* 0.90 (Slight Suppression).

Result: Since Reality is slightly > Target, the system perceives a small surplus and Holds Rate / Gently Yields UP.

Archetype C: The Trap Curve (High Season | "Greed Mode")

The Goal: Force the system to feel "Ahead of Pace" to yield aggressive ADR early.

The Mechanics: Target = Historical Pace \* 0.60 (Deep Suppression).

The Aggressive Ramp: The curve remains suppressed until Day 21, then ramps vertically to hit 85% by Day 14 (The "Squeeze"), before landing on the Universal Anchor (95% @ D7).

Result: Since Reality >>> Target, the system perceives a massive surplus and Yields UP Aggressively.

3.4 The Dynamic Rate Cap (Safety Ceiling)
To prevent hallucinations (e.g., pricing £900 on a Tuesday in Feb), we enforce a "Safe Max Rate" per Hotel, Month, and Day of Week.

The Formula: Max Rate = (Historical 94th Percentile) \* 1.30

The Logic: This cuts off the top 6% of extreme outliers (buyouts) while allowing a 30% growth buffer on legitimate peak days.

Granularity: Calculated strictly on 2024-2025 data for that specific DOW and Month.

Status: Implemented. Calculated and stored in the SQL table sentinel_daily_max_rates.

## **4.0 TECHNICAL SPECIFICATIONS (THE BRIDGE)**

### **4.1 The "Golden Schema" (Training Data)**

All raw data must be ETL'd into `unified_daily_grain.csv` with this strict structure: | Column | Type | Description | | :--- | :--- | :--- | | `hotel_id` | String | The UUID or Integer ID (Must match Inventory above). | | `stay_date` | Date | YYYY-MM-DD. | | `lead_time` | Int | Days between booking and arrival. | | `price_paid` | Float | Total Rate / Nights. | | `source` | String | OTA or Direct. |

### **4.2 The Market Pulse Bridge (API Contract)**

Sentinel retrieves live constraints from the Market Pulse Database via REST API.

**Endpoint:** `GET /api/market-pulse/snapshot` **Request Payload:**

JSON  
{  
 "hotel_id": "ee9f3ef4-...",  
 "start_date": "2026-06-01",  
 "end_date": "2026-06-07"  
}

**Response Payload (The "Laws"):**

JSON  
{  
 "data": \[  
 {  
 "date": "2026-06-01",  
 "min_rate_floor": 85.00, // HARD FLOOR (User Set)  
 "current_occupancy_pct": 45.0 // LIVE STATUS (PMS)  
 }  
 \]  
}

---

## **5.0 IMPLEMENTATION ROADMAP**

### **Phase 1: Data Engineering \[COMPLETE\]**

- Migrated to DGX (`spark-828c`).
- Built `etl_pipeline.py`.
- Filtered for Modern Era (2024+) and Signal Purity (Adults=2).

### **Phase 2: Physics Modeling \[COMPLETE\]**

- Built `train_global.py` (Price Elasticity Model).
- Built `build_pace_curves.py` (Historical Velocity).

### **Phase 3: Live Bridge \[IN PROGRESS\]**

- **Task 3.1:** Create `build_dynamic_caps.py`.
  - _Action:_ Iterate through **ALL 21 Active Hotels**.
  - _Output:_ Generate `datasets/reference/master_rate_caps.csv` (The 2026 Ceilings).
- **Task 3.2:** Create `build_pace_targets.py`.
  - _Action:_ Iterate through **ALL 21 Active Hotels**.
  - _Output:_ Generate `datasets/reference/master_inverted_curves.csv` (The Strategic Targets).
- **Task 3.3:** Create `sentinel_live.py`.
  - _Action:_ Connect API Input \+ Reference Files \+ Logic → Price Decision.

### **Phase 4: Automated Retraining Loop \[FUTURE\]**

---

## **APPENDIX: STRATEGIC CHANGELOG (CURATED)**

_Canonical decisions that define the Sentinel Philosophy._

1. **The "Modern Era" Cutoff (2024-01-01):** Mixed pre-2024 data (Covid/Recovery) fatally confused the system. Sentinel is now **blind** to Volume-First eras.
2. **Pace \> Price Pivot:** The system no longer optimizes for revenue sums via prediction. It optimizes for **Control Theory** (being in the right place at the right time).
3. **Curves as Control Surface:** Neural models exist, but **curves dictate behavior**. The AI reacts to **position vs. curve**, not raw demand prediction.
4. **NYE vs January Physics:** Not all “winter” behaves the same. Some dates (NYE) obey Summer Physics. Logic must be Month-Specific.

Changelog:

**Friday, 26th December 2025**

- Plan for next session \- clear up sentinel folder leaving only critical files. From there create necessary files with Max Rates for all hotels and work on Inverted Curves

Saturday, 27th December 2025

Finalized Max Rate Logic (The "Golden Seed"): After testing P80, P90, P95, and Raw Max, we finalized on Day-of-Week P94 (94th Percentile) \* 1.3 Multiplier.

Why: This specific setting cuts off the top 6% of extreme "buyout" outliers (solving the W14 £1000+ spikes) while preserving legitimate high-demand weekday peaks (solving the Citygate "under £150" issue).

Architectural Pivot (Unified Constraints): Decided that "Max Rates" cannot live in a static CSV or a simple column. We created a dedicated SQL table `sentinel_daily_max_rates` to store granular daily caps.

Why: "The Ceiling" must be addressable per-day (Granularity) and writeable by the UI (Overrides). A simple column in the config table was insufficient for 365-day control.

Plan for next session: Run the transfer script to push the calculated 2026 Max Rates from Sentinel (CSV) into the Market Pulse SQL database for all corresponding hotels. DONE

Sunday, 28th December 2025PHASE 3 COMPLETE: The "Navigator" Core Logic is Live.Seasonality Maps Injected: Every active hotel now has a 12-month dynamic classification (Low/Mid/High) stored in sentinel_configurations $\rightarrow$ seasonality_profile (JSON).Pace Curves Generated: The 3 strategic curves (Pressure, Guide, Trap) are calculated and stored in the new sentinel_pace_curves table.Logic: All curves strictly converge to 95% Occupancy by Day 7 (The Universal Anchor).Data Scope:21 Core Hotels: Fully populated with valid 2026 strategies.7 "New/Ghost" Hotels: Skipped due to insufficient historical data (e.g., St George Norfolk, G Hotel, Aviator, etc.). These remain null until sufficient history accumulates.Architecture Note: We successfully resolved the "UUID vs. Integer" ID conflict for the 4 Modern Era hotels (Portico, W14, Toby, 29 London). All SQL keys are now standardized to Market Pulse Integers.Project Status: READY FOR EXECUTION.We now possess the complete "Physics" of the pricing engine:The Floor: min_price (User Config)The Ceiling: sentinel_daily_max_rates (SQL)The Context: seasonality_profile (SQL)The Target: sentinel_pace_curves (SQL)The foundational data layer is finished. No further "training" or "uploading" is required for these elements. The next development cycle can focus purely on the Control Loop Logic (reading these values to price daily).

APPENDIX A: THE "NAVIGATOR" UPGRADE (v7.0 AUTOMATION)Added Jan 2026 - Transition from "Stateless Calculator" to "Stateful Autonomous Agent"A.1 The "Black Box" (Transaction History)To enable the AI to understand Velocity of Price ($v_{price}$) and prevent "Panic Drops," we now log every rate change permanently.New SQL Table: sentinel_price_historyPurpose: Immutable ledger of all rate changes (Manual or AI).Schema:id (PK)hotel_id, room_type_id, stay_dateold_price (Price before the change)new_price (Price after the change)source (Enum: MANUAL, AI_APPROVED, SYNC)created_at (Timestamp - Critical for "Stopwatch" logic)Write Logic (Fetch-Diff-Write):Located in sentinel.service.js $\to$ buildOverridePayload.Before overwriting a rate in sentinel_rates_calendar, the service:Fetches the existing rate.Diffs it against the new rate.Logs the transaction only if the value changed.A.2 The "Bridge" Upgrade (Context Injection)The AI Context (GET /api/bridge/context/:hotelId) has been upgraded to support stateful decisions.New Field: inventory[].last_change_tsSource: Fetches the most recent created_at timestamp from sentinel_price_history for each date.Purpose: Allows the AI to calculate "Hours since last change" to enforce stability periods.A.3 Autonomous Execution ("Ghost Mode")Sentinel now operates autonomously on the DGX server, decoupled from local development environments (Cursor/Laptop).The Controller: run_forever.pyRole: Process Manager / Heartbeat.Mechanism: Infinite loop that launches the pricing logic, waits for completion, and sleeps for 6 hours.Deployment: Runs as a background daemon using nohup.Command: nohup python3 run_forever.py > sentinel.log 2>&1 &The Schedule:Runs 4 times daily (Approx: 06:00, 12:00, 18:00, 00:00).Ensures reaction to market moves without over-correcting (thanks to the Logic Stopwatch).A.4 Logic V4 (Stateful Navigator)The Python Logic (sentinel_live.py) now implements Control Theory:The Stopwatch (Anti-Flicker):If HoursSinceLastChange < 12h (Low Season) or < 24h (High Season), the system HOLDS, ignoring minor occupancy shifts.The Velocity Guard:If Pickup_24h > 0 (Momentum is positive), the system REFUSES TO DROP the rate, even if Delta is negative.Seasonal Aggression:High Season: Low Sensitivity to drops, High Aggression on hikes (Multiplier: 1.5x).Low Season: High Sensitivity to drops (to capture volume), Conservative hikes.A.5 Self-Healing (Hydration)Problem: The "Shrinking Road" (Inventory window shrinks by 1 day every 24h).Solution: daily-refresh.js (Scheduled Nightly).Automatically calls PMS to fetch rates for Today + 365.Upserts into sentinel_rates_calendar to keep the pricing runway full.
