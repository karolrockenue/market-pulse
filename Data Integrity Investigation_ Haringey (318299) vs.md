# **Data Integrity Investigation: Haringey (318299) vs. Jubilee (230719)**

**Last Updated:** November 7, 2025

## **1.0 Summary of Findings**

We have identified a critical data integrity bug in the `daily-refresh.js` cron job. The *same script* runs for all hotels, but produces perfect data for one hotel (Jubilee, `230719`) and completely corrupts the data for another (Haringey, `318299`).

We found it after Haringey Hotel was onboarded today and [initial-sync.js](http://initial-sync.js) has ran inserting wrong info into the db. Both daily-refresh and initial-sync are likely the problem

This corruption happens every time the `daily-refresh` job runs, overwriting any manual data fixes.

The bug manifests in two ways for the broken hotel (`318299`):

1. **Corrupt Capacity:** The script ignores the static `hotels.total_rooms` value (29) and instead inserts a dynamic, fluctuating "available rooms" value into the `daily_metrics_snapshots.capacity_count` column.  
2. **Corrupt Revenue:** The script incorrectly maps revenue. It takes the **NET** revenue from Cloudbeds and inserts it into the **GROSS** revenue column (`gross_revenue`), while simultaneously calculating a fake, incorrect net value for the `net_revenue` column.

## **2.0 The Core Contradiction**

The central mystery is *why* this bug only affects Haringey.

* **Jubilee Hotel (`230719`) \- The "Correct" Hotel:**  
  * `daily-refresh.js` runs perfectly.  
  * `capacity_count` is static and correct.  
  * `net_revenue` and `gross_revenue` are mapped correctly.  
* **Haringey Hotel (`318299`) \- The "Broken" Hotel:**  
  * `daily-refresh.js` runs and corrupts its data.  
  * `capacity_count` becomes dynamic and incorrect.  
  * `net_revenue` and `gross_revenue` are swapped and calculated incorrectly.

We have confirmed that this is **NOT** related to the hotel's configuration in the `hotels` table. A query confirms **both hotels have the identical `tax_type: 'inclusive'` and `tax_rate: 0.2000`**.

## **3.0 The Root Cause Hypothesis (The "Why")**

The bug is not in the `daily-refresh.js` script itself, but in the **`api/adapters/cloudbedsAdapter.js`** file that it calls.

The `daily-refresh.js` script loops through all hotels and calls functions like `cloudbedsAdapter.getOccupancyMetrics(...)`. The adapter itself must contain flawed logic that branches based on the *user who owns the API credentials*.

1. A SQL query confirmed the `pms_credentials` for each hotel are owned by different users:  
   * **Jubilee (Correct):** Owned by `user_id: "433091"` (`karol@...`)  
   * **Haringey (Broken):** Owned by `user_id: "560536"` (`bohdan@...`)  
2. **Hypothesis:** The `cloudbedsAdapter.js` functions are hard-coded to look for credentials associated with `user_id: "433091"`.  
   * **"Happy Path" (Jubilee):** The adapter finds the credentials it's looking for, runs its correct logic, and returns perfect data.  
   * **"Broken Path" (Haringey):** The adapter fails to find credentials for its hard-coded user. This triggers a `catch` block or fallback logic *inside the adapter*. This fallback logic is the source of all our problems: it incorrectly fetches *dynamic available rooms* instead of occupancy and improperly maps the `net/gross` revenue.

This single "credential lookup" bug explains every contradiction.

## **4.0 Test Plan for Verification**

This plan will allow a developer to reproduce the bug and confirm the hypothesis.

### **Test 1: Verify Static Hotel Configuration (Confirm Identical Setup)**

**Action:** Run this query to prove both hotels are configured identically for tax.

SELECT hotel\_id, property\_name, tax\_type, tax\_rate, total\_rooms  
FROM hotels  
WHERE hotel\_id IN (318299, 230719);

**Expected Result:** You will see `tax_type: 'inclusive'`, `tax_rate: 0.2000` for both. Note the correct `total_rooms` for Haringey is `29`.

### **Test 2: Verify Credential Ownership (Confirm The "Why")**

**Action:** Run this query to prove the credentials are owned by different users.

SELECT  
  h.property\_name, h.hotel\_id, up.user\_id, u.email  
FROM  
  user\_properties up  
JOIN  
  hotels h ON up.property\_id \= h.hotel\_id  
JOIN  
  users u ON up.user\_id \= u.cloudbeds\_user\_id  
WHERE  
  up.property\_id IN (318299, 230719\)  
  AND up.pms\_credentials IS NOT NULL;

**Expected Result:** You will see two different `user_id`s and `email`s.

### **Test 3: Observe Data Integrity \- Jubilee (The "Correct" Hotel)**

**Action:** Run this query to show that Jubilee's data is healthy.

SELECT capacity\_count, COUNT(\*) as day\_count  
FROM daily\_metrics\_snapshots  
WHERE hotel\_id \= 230719  
GROUP BY capacity\_count;

**Expected Result:** A single row with the hotel's correct `capacity_count`.

### **Test 4: Manually Fix Haringey's Data (Set a Clean State)**

**Action:** Run these two `UPDATE` queries to manually fix all of Haringey's data *before* the test.

**Query 4a (Fix Capacity):**

UPDATE daily\_metrics\_snapshots  
SET capacity\_count \= 29  
WHERE hotel\_id \= 318299;

**Query 4b (Fix Revenue):**

UPDATE daily\_metrics\_snapshots  
SET  
  net\_revenue \= gross\_revenue,  
  gross\_revenue \= gross\_revenue \* (1 \+ 0.2000)  
WHERE  
  hotel\_id \= 318299;

**Expected Result:** `UPDATE` success. Haringey's data is now 100% correct.

### **Test 5: The "Smoking Gun" Test (Reproduce the Bug)**

**Action 1:** Manually trigger the daily refresh job from the admin panel. `GET /api/admin/daily-refresh`

**Action 2:** Wait for the job to complete, then immediately run this query to see the data the script *just inserted* for November.

SELECT  
  stay\_date,  
  capacity\_count,  
  net\_revenue,  
  gross\_revenue  
FROM  
  daily\_metrics\_snapshots  
WHERE  
  hotel\_id \= 318299  
  AND stay\_date \>= '2025-11-01'  
  AND stay\_date \<= '2025-11-30'  
ORDER BY  
  stay\_date ASC;

**Expected Result:** You will see that the data is **corrupt again**.

1. `capacity_count` will be fluctuating (e.g., 26, 37, 11, 9...) and not `29`.  
2. `gross_revenue` will hold the NET value, and `net_revenue` will be incorrect.

This proves the bug is in the `daily-refresh` logic path for Haringey and must be fixed within `api/adapters/cloudbedsAdapter.js`.

