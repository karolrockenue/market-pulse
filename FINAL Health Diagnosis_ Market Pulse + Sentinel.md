# \# 0\. MIGRATION SAFETY RULES (THIS DOCUMENT)

# 

# This document is a \*\*refactor/migration plan only\*\*. It does NOT define new product features or new business logic.

# 

# When using this document together with \`Blueprint.md\` and the Gemini control prompt:

# 


# \- This plan \*\*only allows moving and grouping existing logic\*\* (routers → services, App.tsx → feature folders). You must \*\*not change what the system does\*\*, only \*where\* that logic lives.

# \- \*\*Do not invent anything\*\*: no new endpoints, no new fields, no new tables, no new pricing or metric formulas, no new background jobs, unless I explicitly request them.

# \- When consolidating metrics or pricing into services, you must \*\*copy existing SQL and formulas exactly\*\* from the current files. If you are unsure whether two formulas are truly identical, you must \*\*ask before merging\*\*.

# \- \*\*Public API contracts must not change\*\* (URL paths, HTTP verbs, request/response shapes) unless I explicitly approve a change for a specific endpoint.

# \- During this migration you must favour \*\*small, reversible steps\*\*:

#   \- introduce new router/service \*\*alongside\*\* existing ones;

#   \- only remove old code after I confirm the new path is wired and tested.

# \- All other AI protocol rules still apply:

#   \- read all files first;

#   \- output \*\*“Plan ready.”\*\* before any code;

#   \- modify \*\*one file at a time\*\* using the strict SEARCH / REPLACE format;

#   \- if anything is ambiguous or missing, \*\*ask instead of guessing\*\*.

# All refactor work described in this document must be performed exclusively inside a dedicated Git branch named `refactor-metrics-router-app-split`; never modify `main` until I explicitly confirm the branch is ready to merge. After every refactor session you must produce a precise changelog entry for me to append to this file, including each router or file created/moved and a full testing checklist for that unit (you must tell me all endpoints, flows, and behaviours to manually test before we continue to the next step).



#   **System Architecture Diagnosis & Treatment Plan**

Patient: Market Pulse \+ Sentinel

Current Status: FUNCTIONAL BUT FRAGILE

Target State: MODULAR & SCALABLE

## **1\. Executive Summary (The Diagnosis)**

The system currently suffers from **Page-Driven Architecture**. Code is organized by "Screens" (Dashboard, Planning, Property Hub) rather than "Domains" (Metrics, Config, Market Data).

**Symptoms:**

* **Logic Duplication:** Revenue/Occupancy SQL is repeated in 5+ files ("SQL Spaghetti").  
* **Split-Brain Risk:** Pricing logic exists in Frontend React, creating a risk of data mismatch with the Backend.  
* **Performance Risk:** Heavy tasks (Scraping, Webhook processing) run inside API requests, risking server timeouts.  
* **Frontend Bloat:** App.tsx is a "God Component" (1200+ lines) managing state for the entire application.

**The Cure:** Transition to **Domain-Driven Design**. Separate **Data** (Metrics) from **Configuration** (Hotels) from **Operations** (Admin).

---

## **📅 SESSION 1: The Nervous System (Backend Routers & Services)**

**Objective:** Consolidate 15 fragmented routers into 8 Domain Engines. Extract SQL into a Service Layer.

### **Why this is first:**

We cannot fix the Frontend or the Pricing Logic until the Backend provides a clean, unified API. This stops the "Spaghetti SQL" bleeding immediately.

### **Step 1.1: The Service Layer (The Brains)**

*Create reusable logic modules. Routers will just call these.*

* \[ \] **Create api/services/metrics.service.js**  
  * Moves SUM(rooms\_sold) and AVG(revpar) queries here.  
  * Handles Single Hotel, Portfolio Aggregation, and Year-on-Year math.  
* \[ \] **Create api/services/market.service.js**  
  * Moves Scraper data fetching, Pace calculation, and Seasonality logic here.  
* \[ \] **Create api/services/hotel.service.js**  
  * Handles Hotel Config, CompSets, and Rockenue Asset CRUD.

  ### **Step 1.2: The Domain Routers (The Interface)**

*Create the 8 consolidated routers.*

* \[ \] **Create metrics.router.js** (Replaces dashboard, reports, portfolio analytics).  
  * Endpoints: /kpi-summary, /trends, /risk-matrix.  
* \[ \] **Create hotels.router.js** (Replaces admin config, budgets, property-hub).  
  * Endpoints: /settings, /compset, /budgets, /assets.  
* \[ \] **Create market.router.js** (Replaces planning, market).  
  * Endpoints: /forward-pace, /market-outlook, /neighborhoods.  
* \[ \] **Refactor admin.router.js** (Internal Ops only).  
  * Endpoints: /sync-trigger, /health, /maintenance.  
* \[ \] **Refactor webhooks.router.js** (External Ops only).  
  * Endpoints: /cloudbeds/events.  
* \[ \] **Update users.router.js** & **auth.router.js** (Minor cleanups).

  ### **Step 1.3: The Switch-Over**

* \[ \] Update server.js to mount the new routers and unmount the old ones.  
* \[ \] **DELETE** obsolete files: dashboard.router.js, planning.router.js, rockenue.router.js, property-hub.router.js, scraper.router.js.  
  ---

  ## **📅 SESSION 2: The Face (Frontend Modularization)**

**Objective:** De-bloat App.tsx and align Frontend structure with the new Backend Domains.

### **Why this is second:**

Once the API is clean, we can rewrite the Frontend to consume it efficiently without breaking existing functionality.

### **Step 2.1: Feature Folders**

*Move code from App.tsx into specific domain folders.*

* \[ \] **Create web/src/features/ directory.**  
* \[ \] **Migrate Dashboard:** features/dashboard/ (View, Hooks, API).  
* \[ \] **Migrate Market:** features/market/ (View, Hooks, API).  
* \[ \] **Migrate Admin:** features/admin/ (View, Hooks, API).  
* \[ \] **Migrate Sentinel:** features/sentinel/ (View, Hooks, API).

  ### **Step 2.2: The App Shell**

* \[ \] **Refactor App.tsx**:  
  * Remove all data fetching useEffect hooks.  
  * Keep only: Routing (activeView), Auth Context, and Layout (TopNav).

  ---

  ## **📅 SESSION 3: Brain Surgery & Muscles (Logic & Workers)**

**Objective:** Fix the "Split Brain" pricing risk and "Async" performance bottlenecks.

### **Why this is third:**

This is complex logic work. It requires a stable Router and Frontend structure to be safe.

### **Step 3.1: Fix Split Brain (Pricing Engine)**

* \[ \] **Create api/services/sentinel.service.js** & **pricing.engine.js**.  
  * Move calculateSellRate logic from React (SentinelRateManager.tsx) to Node.js.  
* \[ \] **Update sentinel.router.js**: Add POST /preview-rate.  
* \[ \] **Update Frontend**: SentinelRateManager calls API for math instead of doing it locally.

  ### **Step 3.2: Fix Scraper Bomb (Async Workers)**

* \[ \] **Create api/services/sync.service.js**.  
  * Logic to handle Webhooks and queue jobs.  
* \[ \] **Create api/workers/scraper.worker.js**.  
  * Move Playwright logic here.  
* \[ \] **Update admin.router.js**: Triggering a scrape now adds a job to the queue instead of running immediately.  
  ---

  ## **🗺️ Appendix: The Map (Before vs. After)**

| Current Messy Router | New Clean Router | New Responsibility |
| :---- | :---- | :---- |
| dashboard.router.js | **metrics.router.js** | **Internal Data** (Occupancy, RevPAR, Revenue). |
| reports.router.js | **metrics.router.js** | (Same \- Reports are just views of metrics). |
| portfolio.router.js | **metrics.router.js** | (Same \- Portfolio Risk is just aggregated metrics). |
| planning.router.js | **market.router.js** | **External Data** (Scraped Trends, Pace). |
| rockenue.router.js | **hotels.router.js** | **Configuration** (Asset List / Off-Platform Assets). |
| budgets.router.js | **hotels.router.js** | (Same \- Budgets are hotel config). |
| admin.router.js | **admin.router.js** | **Internal Ops** (Manual Sync, Maintenance). |
| scraper.router.js | **admin.router.js** | (Same \- Triggers only. Logic moves to worker). |
| webhooks.router.js | **webhooks.router.js** | **External Ops** (Inbound Events). |
| sentinel.router.js | **sentinel.router.js** | **Pricing Engine** (Write-only / Decision). |


