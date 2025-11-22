## **1\. Why We’re Doing This**

**Goal:** Let the system see **Real-Time Pickup** \= *Yesterday’s state vs Right Now* for each stay date, without breaking existing logic.

Pacing Strategy

**Key facts from current system:**

* `daily_metrics_snapshots` already stores **current per-day metrics** per hotel & stay\_date (rooms\_sold, capacity, revenue, etc.). It behaves as a **live table**, not a historian.

* It has **one row per (hotel\_id, stay\_date)** and is continuously updated by your importer logic.

So:

* We **keep `daily_metrics_snapshots` as the Live Layer (“Right Now”)**.

* We **add a new table** to archive how the future looked **yesterday at 03:00** (the Historian).

* Pickup \= **Live.rooms\_sold – Historian.rooms\_sold(yesterday)**.

No refactor of existing logic, only additive.

---

## **2\. Core Architecture: Two Tables**

### **2.1 Live Layer (Already Exists)**

**Table:** `daily_metrics_snapshots`  
 **Role:** “Right Now Board”

* One row per `(hotel_id, stay_date)`.

* Columns already include:

  * `hotel_id`

  * `stay_date`

  * `rooms_sold`

  * `capacity_count`

  * `net_revenue`, `gross_revenue`, etc.

* Continuously updated by existing PMS sync logic (and later webhooks).

We **do not change this table’s structure or behaviour**.

---

### **2.2 Historian Layer (New)**

**Table:** `pacing_snapshots`  
 **Role:** “Daily Photo Album of the Future”

Purpose:

* Store a **daily snapshot** of the next N days (e.g. 365\) as they looked at \~03:00.

* Never overwrite old rows → append-only history for pickup and cancellations.

**Minimal schema:**

* `hotel_id`

* `snapshot_date` (date when photo was taken – “today” at 03:00)

* `stay_date` (future date of stay)

* `rooms_sold`

* (optional: `capacity_count`, `net_revenue`, `gross_revenue` if needed for richer pacing)

**Index:**

* Composite index on `(hotel_id, snapshot_date, stay_date)`  
   → fast lookups for “yesterday vs today” 90-day windows.  
   Pacing Strategy

---

## **3\. Implementation Plan (Step by Step)**

### **Step 1 – Create the Historian Table**

**Action:**

* Add `pacing_snapshots` with columns \+ composite index as above.

* No changes to `daily_metrics_snapshots`.

**Effect:**

* Empty historian table ready to start receiving daily snapshots.

---

### **Step 2 – Extend Daily Recorder (`api/daily-refresh.js`)**

**Current behaviour (keep it):**

* Fetch future metrics from PMS.

* Update/overwrite `daily_metrics_snapshots` so it reflects **Right Now** for each `(hotel_id, stay_date)`.

**New behaviour (add on top, after successful sync):**

1. Compute `snapshot_date = today (hotel-local or system standard)`.

2. For each hotel, select the future horizon from `daily_metrics_snapshots`  
    (e.g. Today..Today+365).

3. `INSERT ... SELECT` into `pacing_snapshots`:

   * Copy `hotel_id`, `stay_date`, `rooms_sold` (and any extra fields).

   * Set `snapshot_date = today`.

   * Do **not** update any existing rows.

4. If PMS sync fails or returns incomplete data for a hotel → **skip** inserting for that hotel on that day and log an error (no partial/invalid baselines).

**Effect:**

* Once per day, we permanently store how the future looked at 03:00, without touching live data.

  ## **3\. Data Flow & Responsibilities**

  ### **3.1 Daily Snapshot Creation (Recorder)**

Once per day (e.g. around 03:00):

1. Ensure the live layer has been refreshed from the PMS.

2. For each hotel, read the **future horizon** (e.g. next 365 days) from the live layer.

3. Insert a copy of those rows into the Historian, with:

   * `snapshot_date = today`

   * copied `stay_date`, `rooms_sold`, etc.

4. If data for a hotel is incomplete or PMS failed → **skip** creating a baseline for that hotel for that day and log it.

Result:

* For every day we successfully run, we have a frozen “photo” of the next N days.

* The live layer continues to evolve independently.  
* 

---

### **Step 4 – Webhook Updates (Pulse on the Live Layer)**

**Router:** `api/routes/webhooks.router.js` (existing / extended).

**Trigger:** Cloudbeds webhooks (Booking Created / Cancelled / Modified).

**Action:**

1. Parse `hotel_id`, `stay_date`, and the net change in rooms.

2. `UPSERT` into `daily_metrics_snapshots` for that `(hotel_id, stay_date)`:

   * Update `rooms_sold` (and revenue) to reflect the new state.

**Effect:**

* `daily_metrics_snapshots` stays as close to real-time as Cloudbeds allows.

* Pacing endpoint automatically reflects intraday pickup because it always compares **fresh live** vs **frozen yesterday**.

---

### **Step 5 – Time & Integrity Rules**

* All comparisons are done using consistent **hotel-local “business date”** (derived from UTC).

* `pacing_snapshots` is **append-only**. No updates, no deletes (except future archival).

* If daily snapshot for a hotel is missing or flagged bad → pacing for that hotel/day is considered **invalid** and not used by AI.

---

### **Final Mental Model (For AI)**

* **`daily_metrics_snapshots`** \= Live Layer, “Right Now per stay\_date/hotel”.

* **`pacing_snapshots`** \= Historian Layer, “What the future looked like on each past day”.

* **Pickup** \= `Live.rooms_sold – Historian.rooms_sold(yesterday)` per date.

## **4.0 PROGRESS (Status: Backend Complete)**

**Completed Items:**
* **Schema:** `pacing_snapshots` table created.
* **Recorder:** `api/daily-refresh.js` updated. It now captures a snapshot of the future horizon (Live -> Historian) immediately after the PMS sync.
* **API Logic:** `api/routes/dashboard.router.js` updated. The `/summary` endpoint now queries "Yesterday's" snapshot and calculates `pickup` (`Live` - `Snapshot`).
* **Verification:** Validated via manual data seeding. The JSON response confirms the API correctly calculates pickup (e.g., `"pickup": 5`) when historical data exists.

**Current System State:**
* The backend is fully functional for **Daily Pickup**.
* The database currently holds **manual test data** (simulating a +5 pickup) to allow for frontend development/testing.
* **Next Actions:** Frontend UI implementation (Deferred), cleanup of test data, and Webhook integration.

