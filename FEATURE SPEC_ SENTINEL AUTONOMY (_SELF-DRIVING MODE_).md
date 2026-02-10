# **FEATURE SPEC: SENTINEL AUTONOMY ("SELF-DRIVING MODE")**

### **1.0 OBJECTIVE**

Transition Sentinel from **"Shadow Mode"** (passive logging) to **"Active Autonomy"** (direct PMS pricing) for specific, trusted hotels. The system must autonomously inject AI rate decisions into the sentinel\_job\_queue while strictly adhering to a **"Defense in Depth"** safety protocol.

---

### **2.0 ARCHITECTURE & DATA FLOW**

**Current Flow (Shadow Mode):**

DGX (Python) $\\rightarrow$ POST /decisions $\\rightarrow$ sentinel\_ai\_predictions (Log only).

**New Autonomous Flow:**

DGX (Python) $\\rightarrow$ POST /decisions $\\rightarrow$ **Bridge Service (New Gatekeeper Logic)** $\\rightarrow$

1. **Gate 1:** Configuration Check (Is Autonomy On?)  
2. **Gate 2:** Policy Validation (Min/Max/Ceiling Clamps)  
3. **Gate 3:** Conflict Resolution (Freeze/Locks)  
   $\\rightarrow$ sentinel\_job\_queue (Action) $\\rightarrow$ PMS

---

### **3.0 THE 3-LAYER SAFETY PROTOCOL (GUARDRAILS)**

To answer the requirement for "multiple points of failure protection," the logic **MUST** pass through three distinct gates.

#### **Layer 1: The Configuration Gate (Permission)**

* **Check:** Is is\_autopilot\_enabled set to TRUE for this hotel\_id?  
* **Behavior:**  
  * **TRUE:** Proceed to Layer 2\.  
  * **FALSE:** Log to sentinel\_ai\_predictions (Shadow Mode) and **STOP**.

#### **Layer 2: The Policy Gate (Hard Bounds)**

* **Check:** Does the predicted rate violate basic math or business rules?  
* **Behavior:**  
  * **Min Rate:** If Rate \< Min\_Rate $\\rightarrow$ Clamp to Min\_Rate.  
  * **Max Rate:** If Rate \> Max\_Rate $\\rightarrow$ Clamp to Max\_Rate.  
  * **Dynamic Ceiling:** If Rate \> Daily\_Max\_Ceiling (94th percentile) $\\rightarrow$ Clamp to Ceiling.  
  * **Sanity:** If NaN or \< 0 $\\rightarrow$ **REJECT**.

#### **Layer 3: The Conflict Gate (Context)**

* **Check:** Is the specific *date* open for automation?  
* **Behavior:**  
  * **Freeze Window:** If Today \+ Freeze\_Days \>= Stay\_Date $\\rightarrow$ **SKIP** (Freeze wins).  
  * **Manual Lock:** If sentinel\_rates\_calendar has source \= 'MANUAL' or PMS is Padlocked $\\rightarrow$ **SKIP** (Human wins).

---

### **4.0 DATABASE SCHEMA CHANGES**

#### **4.1 Sentinel Configurations**

Add the master switch to the hotel's rule set.

SQL  
\-- Enable Autonomy per hotel  
ALTER TABLE sentinel\_configurations  
ADD COLUMN is\_autopilot\_enabled BOOLEAN DEFAULT FALSE;

#### **4.2 Sentinel Rates Calendar**

Add a specific source tag to track AI actions vs. Human actions.

SQL  
\-- (Conceptual Enum Update)  
\-- Existing values: 'MANUAL', 'PMS', 'IMPORT'  
\-- New value: 'AI\_AUTO'

---

### **5.0 COMPONENT IMPLEMENTATION GUIDE**

#### **5.1 Frontend (React)**

* **File:** web/src/features/sentinel/components/ControlPanel/ControlPanelView.tsx  
* **Action:** Add a **Toggle Switch** labeled *"Enable Autonomy (Beta)"*.  
  * *Warning:* "Enabling this allows Sentinel to update live rates without approval."  
* **File:** web/src/features/sentinel/components/RateManager/RateManagerView.tsx  
* **Action:** Update the grid cell renderer. If source \=== 'AI\_AUTO', display a small **Robot Icon** 🤖 to differentiate from User Overrides.

#### **5.2 Backend Logic (Node.js)**

* **File:** api/services/sentinel.bridge.service.js  
* **Task:** Rewrite the processAiDecisions function to implement the 3-Layer Safety Protocol.

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

1. **Deploy Schema:** Run migration to add is\_autopilot\_enabled.  
2. **Deploy Code:** Update Bridge Service and UI.  
3. **Verify Default:** Ensure all hotels default to FALSE.  
4. **Pilot Test:**  
   * Select **The Portico Hotel** (ID: fbd2965d...).  
   * Set is\_autopilot\_enabled \= TRUE.  
   * Wait for the next hourly run (check logs).  
   * Verify rates appear in PMS with the correct value.

### **7.0 NEXT ACTION FOR AI**

To begin execution, simply ask:

*"Apply the schema migration and update the Bridge Service now."*

