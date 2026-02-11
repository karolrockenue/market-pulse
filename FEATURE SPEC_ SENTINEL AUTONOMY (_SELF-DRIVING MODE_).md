# **FEATURE SPEC: SENTINEL AUTONOMY ("SELF-DRIVING MODE")**

### **1.0 OBJECTIVE**

Transition Sentinel from **"Shadow Mode"** (passive logging) to **"Active Autonomy"** (direct PMS pricing) for specific, trusted hotels. The system must autonomously inject AI rate decisions into the sentinel_job_queue while strictly adhering to a **"Defense in Depth"** safety protocol.

---

### **2.0 ARCHITECTURE & DATA FLOW**

**Current Flow (Shadow Mode):**

DGX (Python) $\\rightarrow$ POST /decisions $\\rightarrow$ sentinel_ai_predictions (Log only).

**New Autonomous Flow:**

DGX (Python) $\\rightarrow$ POST /decisions $\\rightarrow$ **Bridge Service (New Gatekeeper Logic)** $\\rightarrow$

1. **Gate 1:** Configuration Check (Is Autonomy On?)
2. **Gate 2:** Policy Validation (Min/Max/Ceiling Clamps)
3. **Gate 3:** Conflict Resolution (Freeze/Locks)  
   $\\rightarrow$ sentinel_job_queue (Action) $\\rightarrow$ PMS

---

### **3.0 THE 3-LAYER SAFETY PROTOCOL (GUARDRAILS)**

To answer the requirement for "multiple points of failure protection," the logic **MUST** pass through three distinct gates.

#### **Layer 1: The Configuration Gate (Permission)**

- **Check:** Is is_autopilot_enabled set to TRUE for this hotel_id?
- **Behavior:**
  - **TRUE:** Proceed to Layer 2\.
  - **FALSE:** Log to sentinel_ai_predictions (Shadow Mode) and **STOP**.

#### **Layer 2: The Policy Gate (Hard Bounds)**

- **Check:** Does the predicted rate violate basic math or business rules?
- **Behavior:**
  - **Min Rate:** If Rate \< Min_Rate $\\rightarrow$ Clamp to Min_Rate.
  - **Max Rate:** If Rate \> Max_Rate $\\rightarrow$ Clamp to Max_Rate.
  - **Dynamic Ceiling:** If Rate \> Daily_Max_Ceiling (94th percentile) $\\rightarrow$ Clamp to Ceiling.
  - **Sanity:** If NaN or \< 0 $\\rightarrow$ **REJECT**.

#### **Layer 3: The Conflict Gate (Context)**

- **Check:** Is the specific _date_ open for automation?
- **Behavior:**
  - **Freeze Window:** If Today \+ Freeze_Days \>= Stay_Date $\\rightarrow$ **SKIP** (Freeze wins).
  - **Manual Lock:** If sentinel_rates_calendar has source \= 'MANUAL' or PMS is Padlocked $\\rightarrow$ **SKIP** (Human wins).

---

### **4.0 DATABASE SCHEMA CHANGES**

#### **4.1 Sentinel Configurations**

Add the master switch to the hotel's rule set.

SQL  
\-- Enable Autonomy per hotel  
ALTER TABLE sentinel_configurations  
ADD COLUMN is_autopilot_enabled BOOLEAN DEFAULT FALSE;

#### **4.2 Sentinel Rates Calendar**

Add a specific source tag to track AI actions vs. Human actions.

SQL  
\-- (Conceptual Enum Update)  
\-- Existing values: 'MANUAL', 'PMS', 'IMPORT'  
\-- New value: 'AI_AUTO'

---

### **5.0 COMPONENT IMPLEMENTATION GUIDE**

#### **5.1 Frontend (React)**

- **File:** web/src/features/sentinel/components/ControlPanel/ControlPanelView.tsx
- **Action:** Add a **Toggle Switch** labeled _"Enable Autonomy (Beta)"_.
  - _Warning:_ "Enabling this allows Sentinel to update live rates without approval."
- **File:** web/src/features/sentinel/components/RateManager/RateManagerView.tsx
- **Action:** Update the grid cell renderer. If source \=== 'AI_AUTO', display a small **Robot Icon** 🤖 to differentiate from User Overrides.

#### **5.2 Backend Logic (Node.js)**

- **File:** api/services/sentinel.bridge.service.js
- **Task:** Rewrite the processAiDecisions function to implement the 3-Layer Safety Protocol.

**Pseudocode for sentinel.bridge.service.js:**

JavaScript  
async function processAiDecisions(hotelId, predictions) {  
 // 1\. Fetch Config & Context  
 const config \= await sentinelService.getConfiguration(hotelId);

    // Always save to Shadow History first (Audit Trail)
    await saveToShadowHistory(hotelId, predictions);

    // \--- GATE 1: PERMISSION \---
    if (\!config.is\_autopilot\_enabled) return;

    const validUpdates \= \[\];

    for (const pred of predictions) {
        let safeRate \= pred.price;

        // \--- GATE 2: POLICY (BOUNDS) \---
        // Clamp to Min/Max
        if (safeRate \< config.min\_rate) safeRate \= config.min\_rate;
        if (safeRate \> config.max\_rate) safeRate \= config.max\_rate;

        // Clamp to Dynamic Ceiling (if exists)
        const dailyCeiling \= await sentinelService.getDailyCeiling(hotelId, pred.date);
        if (dailyCeiling && safeRate \> dailyCeiling) safeRate \= dailyCeiling;

        // \--- GATE 3: CONFLICT (LOCKS) \---
        const isFrozen \= sentinelService.isDateFrozen(pred.date, config.freeze\_window);
        const isLocked \= await sentinelService.isDateLocked(hotelId, pred.date);

        if (isFrozen || isLocked) continue; // Skip this date

        // If all gates passed:
        validUpdates.push({
            date: pred.date,
            rate: safeRate,
            roomTypeId: pred.room\_type\_id,
            source: 'AI\_AUTO' // Tag it
        });
    }

    // Final Push
    if (validUpdates.length \> 0\) {
        await sentinelService.enqueueRateUpdate(hotelId, validUpdates);
    }

}

---

### **6.0 ROLLOUT STRATEGY**

1. **Deploy Schema:** Run migration to add is_autopilot_enabled.
2. **Deploy Code:** Update Bridge Service and UI.
3. **Verify Default:** Ensure all hotels default to FALSE.
4. **Pilot Test:**
   - Select **The Portico Hotel** (ID: fbd2965d...).
   - Set is_autopilot_enabled \= TRUE.
   - Wait for the next hourly run (check logs).
   - Verify rates appear in PMS with the correct value.

### **7.0 NEXT ACTION FOR AI**

To begin execution, simply ask:

_"Apply the schema migration and update the Bridge Service now."_

Changelog: Sentinel System Implementation & Core Integration
🚀 Major Achievements (System Implementation):

Validated Core Pricing Engine: Confirmed implementation of the "Waterfall" logic (Base Rate → Multipliers → Discounts → Taxes) and "Guardrails" (Min/Max/Freeze) in sentinel.pricing.engine.js.

Enabled Differential Logic: The system can now correctly calculate derived room rates (e.g., Single vs Double) based on the room_differentials rules we successfully saved.

Integrated AI Bridge: Verified the SentinelBridgeService which assembles the full hotel context (Inventory, Competitors, Pace Curves) for the Python AI.

Completed Data Flow: The Frontend (ControlPanelView) can now successfully push "Rules" (Strategy, Autopilot, Aggression) to the Backend, which the Service layer uses to generate Job Queue items for the PMS.

🐛 Critical Fixes (The "Last Mile"):

Fixed Configuration Persistence: Resolved the "Payload Too Large" crash by stripping read-only PMS data in sentinel.api.ts, allowing the complex Pricing Rules to be saved to the DB.

Synchronized State (Autopilot): Fixed the Frontend/Backend disconnect where is_autopilot_enabled was being saved but not read, ensuring the UI correctly reflects the system's active state.

Cleaned Telemetry: Implemented and then cleaned up deep-trace logging to verify that payloads move correctly from UI → Router → Service → Database.

📌 Note for Next Session
Objective: Debug "Heartbeat" (Cron Job)

Issue: The logic is ready, but the AI "Pulse" (Hourly Run) didn't trigger as expected.

Target: Investigate the process-queue endpoint in sentinel.router.js and the Vercel Cron configuration to ensure the system wakes up and processes the job queue automatically.
[2026-02-10] - Sentinel Autonomy Activation & Stabilization
🚀 Major Milestone: Sentinel Autonomy ("Self-Driving Mode") is LIVE
Today marks the successful transition of Sentinel from a passive "Shadow Mode" advisor to an active, autonomous pricing engine. The system is now capable of calculating, validating, and pushing rate updates directly to the PMS without human intervention, protected by a robust "Defense in Depth" safety protocol.
🔧 Key Technical Achievements:
Activated the "Bridge" (Node.js <-> Python):
Established a secure, automated pipeline where the Python AI (on DGX) fetches context from the Node.js backend, calculates optimal rates, and sends decisions back for execution.
Implemented the 3-Layer Safety Protocol in sentinel.bridge.service.js:
Permission Gate: Checks is_autopilot_enabled per hotel.
Policy Gate: Enforces Min/Max rates and Dynamic Ceilings (94th percentile cap).
Conflict Gate: Respects Freeze Windows and Manual Locks (Human Overrides).
Solved the "Cloudbeds Limit" (Chunking):
Diagnosed a critical failure where pushing 365 days of rates caused a 400 Bad Request due to Cloudbeds' 30-item limit.
Implemented intelligent Batch Chunking in the Bridge Service, splitting massive updates into safe batches of 25 rates per job.
Implemented "Surgical Strike" (Delta Check):
Added logic to compare the AI's new rate against the existing rate in the database before pushing.
Result: Drastically reduced API spam by only queuing updates where the price actually changes by a meaningful amount (> £5.00).
Fix: Resolved a complex text = integer type mismatch in the PostgreSQL query that was causing the Delta Check to crash silently.
Stabilized the AI Logic (Anti-Jitter):
Identified that the AI was "flickering" prices by small amounts (e.g., £100 -> £101 -> £100) due to sensitive math.
Enforced a £5.00 Deadband in the Node.js layer: The system now ignores any AI suggestion that differs from the live rate by less than £5, ensuring stability.
Updated the Python Engine (on DGX) to use a 5-day window (down from 7) for the "Sell Every Room" strategy, making the desperation logic more targeted.
🐛 Critical Fixes:
Schema Alignment: Fixed a crash caused by the AI trying to insert into non-existent columns (room_type_id) in the sentinel_job_queue. We now correctly pack the data into the JSON payload column expected by the worker.
UUID vs Integer Crash: Resolved a type casting error where UUID hotel IDs were being forced into Integer arrays, crashing the Bridge for specific hotels.
Map Lookup Failure: Fixed a bug where the "Delta Check" was failing to find the current rate because of date format mismatches (Date Object vs String) and missing Room Type keys.
📊 Current System Status:
Autonomy: ACTIVE for pilot hotels (Lancaster Court, Studio 169).
Efficiency: The system now pushes ~10-20 targeted updates per run instead of 400+ redundant ones.
Safety: Rates are clamped, frozen periods are respected, and manual overrides always take precedence.
Known Issue (Operational): "The Tudor Inn Hotel" has an invalid/expired Cloudbeds token, causing webhook errors. This requires a manual reconnect in the admin panel but does not affect the code logic.
📌 Next Steps:
Monitor: Watch the hourly runs for 24 hours to confirm stability.
Reconnect Tudor Inn: Fix the expired token to stop the webhook error noise.
Expand: Once stable, enable Autonomy for more hotels in the fleet.
