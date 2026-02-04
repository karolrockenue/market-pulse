# **Master Plan: Sentinel DGX Automation (Execution Ready)**

**System Target:** NVIDIA DGX (Ubuntu Linux) **Architecture:** Sidecar Pattern (Python Brain \+ Node.js IO Layer) **Logic Version:** Sentinel v4 (Stateful \+ Manual Locks)

---

## **1.0 Implementation Roadmap**

### **Phase 1: The Sidecar (Node.js)**

*Role: The "Dumb" I/O Layer. Fetches data, writes to DB.*

1. **Clone:** Pull `market-pulse-api` to `/home/ubuntu/market-pulse-api`.  
2. **Config:** Set `.env` with Production DB URL and `BRIDGE_API_KEY`.  
3. **Run:** Start via PM2 on Port 3001 (`pm2 start npm --name "sentinel-sidecar" -- start`).

### **Phase 2: The Brain (Python)**

*Role: The "Smart" Logic Layer. Owns the math and scheduling.*

1. **Setup:** Create `/home/ubuntu/sentinel_project/`.  
2. **Dependencies:** Install `flask`, `requests`, `apscheduler` (via `requirements.txt`).  
3. **Deploy:** Create `sentinel_live.py` with the code below.

### **Phase 3: Automation (Systemd)**

*Role: Keeps the Brain alive.*

1. **Service:** Register `sentinel.service` to auto-start Python on boot.

---

## **2.0 Final Code Artifacts**

### **A. Dependency File (`requirements.txt`)**

*Save this in `/home/ubuntu/sentinel_project/requirements.txt`*

Plaintext  
flask==3.0.0  
requests==2.31.0  
apscheduler==3.10.4

### **B. The Master Script (`sentinel_live.py`)**

*This includes the **Manual Lock Check** (Priority 1\) and relies on the **Noise Filter** (`diff < 2.00`) for stability.*

Python  
import requests  
import json  
import datetime  
import time  
from datetime import date, timedelta  
import sys  
from flask import Flask, request, jsonify  
from apscheduler.schedulers.background import BackgroundScheduler  
import threading  
import atexit

\# \==========================================  
\# ⚙️ CONFIGURATION  
\# \==========================================  
app \= Flask(\_\_name\_\_)  
\# Point to Local Node Sidecar (running on same DGX)  
API\_BASE\_URL \= "http://localhost:3001/api/bridge"   
API\_KEY \= "Spanking123\*" \# Replace with actual Env Var in production  
PORT \= 5000    
ENGINE\_LOCK \= threading.Lock()

\# Active Hotel Inventory (Matches Blueprint Section 1.1)  
ACTIVE\_HOTELS \= \[  
    "fbd2965d-34d9-4134-944f-28c3b512f2ff", \# Portico  
    "ee9f3ef4-9a88-46a9-aaf6-83a5c17bea4a", \# W14  
    "1fa4727c-eb1a-44ce-bf95-5bc4fe6dac7d", \# House of Toby  
    "bb9b3c42-4d0d-4c0d-9f74-efd32aea7d52", \# The 29  
    "2400", "230719", "289618", "308760", "315435", "315473"  
\]

\# \==========================================  
\# 🛠️ HELPER FUNCTIONS  
\# \==========================================

def log(msg):  
    """Simple logger with timestamp."""  
    print(f"\[{datetime.datetime.now().strftime('%H:%M:%S')}\] {msg}")

def get\_context(hotel\_id):  
    """Fetch commercial reality for a specific hotel."""  
    url \= f"{API\_BASE\_URL}/context/{hotel\_id}"  
    headers \= {"x-api-key": API\_KEY}  
      
    try:  
        res \= requests.get(url, headers=headers, timeout=120)  
        res.raise\_for\_status()  
        payload \= res.json()  
        return payload.get("data", payload)  
    except Exception as e:  
        log(f"   ❌ Context Fetch Failed: {e}")  
        return None

def send\_decisions(decisions):  
    """Upload decisions to the Bridge API."""  
    url \= f"{API\_BASE\_URL}/decisions"  
    headers \= {"x-api-key": API\_KEY, "Content-Type": "application/json"}  
      
    try:  
        res \= requests.post(url, headers=headers, json=decisions, timeout=120)  
        res.raise\_for\_status()  
        return True  
    except Exception as e:  
        log(f"   ❌ Upload Failed: {e}")  
        return False

\# \==========================================  
\# 🧠 SENTINEL CORE LOGIC  
\# \==========================================

def calculate\_optimal\_rate(day\_data, config, constraints, market\_data):  
    """  
    SENTINEL LOGIC v4 (Stateful: Manual Locks \+ Velocity \+ Seasonality)  
    """  
    stay\_date\_str \= day\_data\['stay\_date'\].split("T")\[0\]  
    stay\_date \= datetime.datetime.strptime(stay\_date\_str, "%Y-%m-%d").date()  
    today \= date.today()  
    lead\_time \= (stay\_date \- today).days

    \# 1\. Lead Time Check  
    if lead\_time \< 0: return None 

    \# \--- \[FIX\] PRIORITY 1: MANUAL LOCK (Blueprint Sec 2.1) \---  
    \# If the PMS/DB says this rate is manually locked, AI must yield.  
    if day\_data.get('is\_manual') or day\_data.get('is\_locked'):  
        \# log(f"Skipping {stay\_date\_str} (Manual Lock)")  
        return None

    \# \--- Seasonality \---  
    season\_map \= config.get('seasonality', {})  
    month\_key \= str(stay\_date.month)  
    season\_tier \= season\_map.get(month\_key, "mid").lower()

    \# Define Season Attributes (Blueprint Sec 2.2 & 2.3)  
    season\_rules \= {  
        "low":  {"anchor": 0.30, "aggression": 1.5},   
        "mid":  {"anchor": 0.50, "aggression": 1.0},   
        "high": {"anchor": 0.70, "aggression": 0.5}    
    }  
    current\_season \= season\_rules.get(season\_tier, season\_rules\["mid"\])  
    anchor\_pct \= current\_season\["anchor"\]

    \# \--- System State \---  
    current\_rate \= float(day\_data.get('rate', 0\) or 0\)

    \# \--- Constraints \---  
    min\_rates\_map \= config.get('min\_rates', {})  
    month\_slug \= stay\_date.strftime('%b').lower()  
    raw\_min \= min\_rates\_map.get(month\_slug, min\_rates\_map.get('default', 60.00))  
    min\_rate \= float(raw\_min) if raw\_min else 60.00

    \# \--- HYBRID MAX RATE LOOKUP \---  
    max\_rate\_map \= {}  
    for row in constraints.get('max\_rates', \[\]):  
        if row.get('max\_price') is not None:  
            d\_key \= row\['stay\_date'\].split('T')\[0\]  
            max\_rate\_map\[d\_key\] \= float(row\['max\_price'\])

    dynamic\_max \= max\_rate\_map.get(stay\_date\_str)  
      
    if dynamic\_max is None: dynamic\_max \= 999.00  
    if dynamic\_max \<= min\_rate: dynamic\_max \= min\_rate \+ 20.00

    \# \--- Reference Rate \---  
    price\_band \= dynamic\_max \- min\_rate  
    reference\_rate \= min\_rate \+ (price\_band \* anchor\_pct)

    \# \--- Targets vs Reality \---  
    active\_curve\_list \= None  
    for curve in constraints.get('pace\_curves', \[\]):  
        if curve.get('season\_tier', '').lower() \== season\_tier:  
            active\_curve\_list \= curve.get('curve\_data', \[\])  
            break  
              
    target\_occupancy\_pct \= 50.0   
    if active\_curve\_list and isinstance(active\_curve\_list, list):  
        idx \= lead\_time if lead\_time \< len(active\_curve\_list) else \-1  
        try: target\_occupancy\_pct \= float(active\_curve\_list\[idx\])  
        except: target\_occupancy\_pct \= 50.0

    \# \--- Market Velocity \---  
    rooms\_sold \= 0  
    pickup\_24h \= 0  
    capacity \= int(config.get('capacity', 13))

    for m in market\_data.get('pickup\_velocity', \[\]):  
        if m\['stay\_date'\].startswith(stay\_date\_str):  
            rooms\_sold \= int(float(m.get('rooms\_sold', 0)))  
            pickup\_24h \= int(float(m.get('pickup\_24h', 0)))  
            daily\_cap \= int(float(m.get('capacity', 0)))  
            if daily\_cap \> 0: capacity \= daily\_cap  
            break  
              
    current\_occupancy\_pct \= 0.0  
    if capacity \> 0:  
        current\_occupancy\_pct \= (rooms\_sold / capacity) \* 100  
          
    delta \= current\_occupancy\_pct \- target\_occupancy\_pct

    \# \--- THE DECISION SLIDER \---  
    final\_rate \= reference\_rate  
      
    \# 1\. Calculate Raw Move  
    aggression\_multiplier \= current\_season\["aggression"\]  
    slide\_factor \= min((abs(delta) / 10.0) \* aggression\_multiplier, 1.0)

    \# 2\. Apply Move (With Trajectory Guard)  
    if delta \< 0:  
        \# BEHIND CURVE \-\> POTENTIAL DROP  
        estimated\_daily\_gain\_pct \= pickup\_24h \* 3.0  
        projected\_final\_occ \= current\_occupancy\_pct \+ (estimated\_daily\_gain\_pct \* lead\_time)  
        is\_on\_trajectory \= projected\_final\_occ \>= target\_occupancy\_pct  
          
        \# Velocity Guard (Blueprint 2.3)  
        if is\_on\_trajectory and pickup\_24h \> 0:  
            final\_rate \= current\_rate   
        else:  
            price\_drop \= (reference\_rate \- min\_rate) \* slide\_factor  
            final\_rate \= reference\_rate \- price\_drop

    elif delta \> 0:  
        \# AHEAD OF CURVE \-\> HIKE PRICE  
        price\_hike \= (dynamic\_max \- reference\_rate) \* slide\_factor  
        if season\_tier \== 'high' and pickup\_24h \>= 2:  
             price\_hike \*= 1.5   
        final\_rate \= reference\_rate \+ price\_hike

    \# \--- Protected Floor Logic \---  
    effective\_min \= min\_rate  
    if season\_tier in \['mid', 'high'\] and lead\_time \> 30:  
        effective\_min \= min\_rate \+ (price\_band \* 0.15) 

    \# \--- Day of Week Adjustments \---  
    dow \= stay\_date.weekday()  
    if dow in \[4, 5\]: final\_rate \*= 1.20   
    elif dow \== 6: final\_rate \*= 0.95

    \# \--- Final Bounds \---  
    final\_rate \= max(effective\_min, min(final\_rate, dynamic\_max))

    \# \--- NOISE FILTER (Stability Mitigation) \---  
    \# Since we deferred the Stopwatch timestamp check, this filter is critical.  
    diff \= abs(final\_rate \- current\_rate)  
    if diff \< 2.00:  
        \# Rate is stable enough, do not churn.  
        return None

    return {  
        "hotel\_id": day\_data.get('hotel\_id'),   
        "room\_type\_id": day\_data.get('room\_type\_id'),  
        "stay\_date": stay\_date\_str,  
        "suggested\_rate": round(final\_rate, 2),  
        "confidence\_score": 0.90,  
        "reasoning": f"Szn:{season\_tier} | Vel:{pickup\_24h} | Δ{delta:.1f}% | Rec:£{final\_rate:.0f}",  
        "model\_version": "Sentinel-Logic-v4"  
    }

def process\_hotel(hotel\_id):  
    """Orchestrates the logic for a single hotel."""  
    log(f"🏨 STARTING HOTEL ID: {hotel\_id}")  
    context \= get\_context(hotel\_id)  
    if not context:  
        log("   ⚠️ Skipping hotel due to context error.")  
        return {"success": False}

    config \= context.get('config', {})  
    inventory \= context.get('inventory', \[\])  
    constraints \= context.get('constraints', {})  
    market \= context.get('market', {})

    if not inventory: return {"success": False, "message": "Empty Inventory"}  
    base\_room\_id \= str(config.get('base\_room\_type\_id'))

    decisions \= \[\]  
      
    for day in inventory:  
        inv\_room\_id \= str(day.get('room\_type\_id'))  
        if inv\_room\_id \!= base\_room\_id: continue  
          
        decision \= calculate\_optimal\_rate(day, config, constraints, market)  
        if decision: decisions.append(decision)  
              
    if decisions:  
        send\_decisions(decisions)  
      
    return {"success": True, "count": len(decisions)}

\# \==========================================  
\# ⚡️ SCHEDULER & ROUTES  
\# \==========================================

def run\_sequence():  
    """The Job run by APScheduler."""  
    if ENGINE\_LOCK.acquire(blocking=False):  
        try:  
            log("⏰ Auto-Pilot Started")  
            for hid in ACTIVE\_HOTELS:  
                process\_hotel(hid)  
                time.sleep(1)   
        finally:  
            ENGINE\_LOCK.release()  
    else:  
        log("⚠️  Skipping Auto-Run: Engine Busy")

@app.route('/run', methods=\['POST'\])  
def manual\_trigger():  
    if not ENGINE\_LOCK.acquire(blocking=False):  
        return jsonify({"error": "Engine Busy"}), 429  
    try:  
        hid \= request.json.get('hotel\_id')  
        res \= process\_hotel(hid)  
        return jsonify(res)  
    finally:  
        ENGINE\_LOCK.release()

@app.route('/health', methods=\['GET'\])  
def health():  
    return jsonify({"status": "online", "mode": "DGX-Sidecar"}), 200

if \_\_name\_\_ \== "\_\_main\_\_":  
    \# Logic Sanity Check  
    if calculate\_optimal\_rate.\_\_code\_\_.co\_code \== b'd\\x00S\\x00':  
        print("❌ ERROR: Logic function is empty.")  
        sys.exit(1)

    sched \= BackgroundScheduler()  
    sched.add\_job(run\_sequence, 'interval', minutes=60, max\_instances=1)  
    sched.start()  
    atexit.register(lambda: sched.shutdown())  
        
    log(f"🚀 Sentinel DGX Server listening on port {PORT}")  
    app.run(host='0.0.0.0', port=PORT, use\_reloader=False)

### **C. Service Definition (`sentinel.service`)**

*Save this in `/etc/systemd/system/sentinel.service`*

Ini, TOML  
\[Unit\]  
Description=Sentinel Pricing Brain (DGX)  
After=network.target

\[Service\]  
User=ubuntu  
WorkingDirectory=/home/ubuntu/sentinel\_project  
ExecStart=/usr/bin/python3 sentinel\_live.py

\# 🔐 SECRETS (Update with real key)  
Environment="BRIDGE\_KEY=Spanking123\*"  
Environment="PYTHONUNBUFFERED=1"

Restart=always  
RestartSec=10

\[Install\]  
WantedBy=multi-user.target

# **Appendix B: Implementation Status & Migration Log (Feb 03, 2026\)**

### **1\. Executive Summary**

The **Infrastructure Layer** is complete. The pipeline from the Web Frontend → Node.js Sidecar → Python Brain → Neon Database is fully connected and operational. The **Logic Layer** is currently failing. The system successfully triggers and reads data, but the AI pricing engine returns `NULL` values, causing database write errors. This is due to a mismatch between the generic Python logic currently deployed and the actual data structure required by the legacy application.

---

### **2\. Migration Changelog (Completed Items)**

#### **A. Infrastructure & Networking**

* **✅ Service Installation:** Successfully deployed `sentinel` (Python/Flask) via Systemd and `sentinel-sidecar` (Node.js) via PM2.  
* **✅ Inter-Process Communication:** Fixed `ECONNREFUSED` errors. The Node Sidecar successfully sends POST requests to the Python Brain on Port 5000\.  
* **✅ Frontend Trigger:** Confirmed that the "Sentinel AI" button on the web dashboard successfully triggers the remote DGX pipeline.

#### **B. Database Connectivity (The "Bridge")**

* **✅ Connection Secured:** Hardcoded Neon DB credentials into `db.js` to bypass `.env` loading failures.  
* **✅ Read Operation Fixed:**  
  * *Issue:* Bridge was querying a non-existent table `inventory_snapshots`.  
  * *Fix:* Analyzed CSV dump, identified `sentinel_rates_calendar` as the source of truth.  
  * *Result:* Pipeline now successfully fetches 90 days of live inventory/rate data.  
* **✅ Write Operation Implemented:**  
  * *Status:* Code updated to `INSERT` predictions into `sentinel_ai_predictions`.  
  * *Current State:* The logic is active but failing due to data validation errors (see Blockers).

---

### **3\. Current Critical Blocker**

**Error:** `null value in column "suggested_rate" violates not-null constraint`

**Diagnosis:** The infrastructure works, but the math is broken. The Python script is receiving data, processing it, and returning `suggested_rate: null` (or None). The database rejects this empty value.

**Root Cause:** We are running a "Skeleton" Python script that guesses at the necessary logic. We have not migrated the **actual pricing logic files** from the original working application. The script is likely failing silently (returning None) because it expects columns or data types that match the original application, which we have been guessing at.

---

### **4\. Instructions for Future AI Agent (READ CAREFULLY)**

**⚠️ DO NOT CONTINUE GUESSING DATABASE SCHEMA OR LOGIC.**

The infrastructure is fragile; guessing column names will break the pipeline again. To fix the `NULL` price error, you must obtain the **source of truth** from the user.

**Step 1: Request The Logic Files** Do not try to patch `sentinel_live.py` with synthetic logic. Ask the user to upload the specific Python files from the **original, working local application**.

* *Target:* Look for files named `pricing_engine.py`, `algorithm.py`, or the original `sentinel.py`.  
* *Goal:* We need to see exactly how the original app handled `competitor_rates` and `occupancy` to calculate a price.

**Step 2: Request The SQL Schema** We are blindly inserting into `sentinel_ai_predictions`. Ask the user to run the following command in their terminal to dump the **exact** structure of the relevant tables.

**Command to run:**  
Bash  
pg\_dump \-t sentinel\_rates\_calendar \-t sentinel\_ai\_predictions \--schema-only "postgresql://neondb\_owner:npg\_4onu9ZrBUydf@ep-wispy-hill-a9gmzm0p-pooler.gwc.azure.neon.tech/neondb?sslmode=require"

* 

**Step 3: Align the Python Input/Output** Once you have the **Original Logic File** and the **Schema Dump**:

1. Update the Node.js `getHotelContext` query to pull exactly the columns the original Python logic expects.  
2. Update the Python `calculate_optimal_rate` function to match the original math exactly.

**Final Warning:** If the Python script returns `NULL`, it is not a database error—it is a logic error. **Do not modify the Node.js database code** to fix this. Fix the Python math by using the user's original files.

# **Appendix C: Logic Verification & Port Conflict Resolution (Feb 03, 2026\)**

### **1\. Critical Discovery: The "Lost" Logic Found**

* **Issue:** The newly deployed "Skeleton" script in `~/market-pulse` was returning `NULL` prices because it lacked the actual pricing algorithms.  
* **Discovery:** The user identified a legacy script located at `~/sentinel-training-hub/sentinel_live.py`.  
* **Verification:** Manual execution of this script confirmed it is fully functional:  
  * *Input:* Processed 331 dates.  
  * *Output:* Generated 329 valid pricing decisions.  
  * *Status:* **Upload Successful** (No NULL errors).  
* **Conclusion:** We do not need to rewrite the logic. We simply need to point the production service to this existing file.

### **2\. Port 5000 Conflict Resolution**

* **Incident:** The user attempted to run the legacy script manually but encountered `Address already in use` on Port 5000\.  
* **Root Cause:** The systemd service `sentinel` (the "New" Brain) was running in the background, locking Port 5000\.  
* **Resolution:**  
  * Stopped the background service: `sudo systemctl stop sentinel`.  
  * Freed Port 5000 for manual testing.  
  * Successfully ran the legacy script `python3 sentinel_live.py` manually.

### **3\. Next Steps (Action Items)**

1. **Migrate:** Permanently replace the "New" skeleton service with the "Old" working script.  
2. **Service Update:** Edit `/etc/systemd/system/sentinel.service` to point to the `~/sentinel-training-hub` directory instead of `~/market-pulse`.  
3. **Restart:** Enable the service so the "Old" logic runs automatically on boot.

