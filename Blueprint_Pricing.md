# **Blueprint_Pricing_Master.md**

## **0.0 AI PROTOCOL (FOR ALL AI AGENTS)**

This section is binding. Ignore older docs, memories, assumptions, and “best practices” that contradict this.

**Analyze First**

- Read all provided project files relevant to the task.
- Do not start coding before you understand which layer you are touching (frontend / backend / DB) and which module owns the logic.

**Plan Before Code**

- Before any code change, output a short bullet-point plan.

**STRUCTURAL ENFORCEMENT (CRITICAL)**

- **FIND and REPLACE MUST be in two separate fenced code blocks**.
- Each fenced block MUST contain only one of: the **FIND** snippet OR the **REPLACE** snippet.
- It is **STRICTLY FORBIDDEN** to place FIND and REPLACE in the same code block.
- **If FIND and REPLACE appear in the same code block: Output is INVALID → STOP → Apologize → Ask to re-output correctly**.
- Do NOT include any labels, comments, or explanations inside the code blocks.
- Wait for explicit user approval before writing code.

---

## **1.0 SYSTEM IDENTITY & FLEET INVENTORY**

**Sentinel** is a Hybrid Intelligence System acting as a "Navigator" for hotel revenue. It relies on **Control Theory** (correcting deviations from a target path) rather than pure predictive forecasting.

### **1.1 Active Fleet (Hotel ID Mapping)**

| Hotel Name                 | System ID                            | Source Type |
| :------------------------- | :----------------------------------- | :---------- |
| **The Portico Hotel**      | fbd2965d-34d9-4134-944f-28c3b512f2ff | UUID (Raw)  |
| **The W14 Hotel**          | ee9f3ef4-9a88-46a9-aaf6-83a5c17bea4a | UUID (Raw)  |
| **House of Toby**          | 1fa4727c-eb1a-44ce-bf95-5bc4fe6dac7d | UUID (Raw)  |
| **The 29 London**          | bb9b3c42-4d0d-4c0d-9f74-efd32aea7d52 | UUID (Raw)  |
| **Astor Victoria**         | 2400                                 | Integer     |
| **Jubilee Hotel Victoria** | 230719                               | Integer     |
| **The Cleveland Hotel**    | 289618                               | Integer     |
| **The Melita**             | 308760                               | Integer     |
| **Citygate**               | 315435                               | Integer     |
| **Elysee Hyde Park**       | 315473                               | Integer     |

---

## **2.0 NAVIGATOR PHYSICS (THE LOGIC)**

### **2.1 The Priority Stack (Conflict Resolution)**

When multiple rules apply to the same date, follow this hierarchy:

1. **Priority 1: Manual Padlock / Lock State** – Manual values in PMS or UI always win.
2. **Priority 2: Freeze Window** – Frozen days ($0 \\dots N$) preserve the PMS live rate.
3. **Priority 3: Dynamic Rate Cap (The Ceiling)** – Max Rate \= (Historical 94th Percentile) $\\times 1.30$.
4. **Priority 4: Last-Minute Floor (LMF)** – Calculated rate is overridden by a floor unless frozen.
5. **Priority 5: Navigator Strategic Decision** – The calculated rate from the pricing engine.

### **2.2 Strategic Curves & Seasonality**

- **Universal Anchor:** ALL curves must converge to 95% Occupancy by Day 7\.
- **Low (Pressure):** Month ADR $\< 90\\%$ of Annual Average. Target \= Historical Pace $+ 15\\%$.
- **Mid (Guide):** Month ADR $90\\% \- 102\\%$ of Annual Average. Target \= Historical Pace $\\times 0.90$.
- **High (Trap):** Month ADR $\> 102\\%$ of Annual Average. Target \= Historical Pace $\\times 0.60$.

### **2.3 Rate Stability (The Stopwatch)**

- **Low Season:** Hold rate if HoursSinceLastChange $\< 12$h.
- **High Season:** Hold rate if HoursSinceLastChange $\< 24$h.
- **Velocity Guard:** If Pickup_24h $\> 0$, the system refuses to drop the rate.

---

## **3.0 ARCHITECTURE & OWNERSHIP**

### **3.1 Backend Logic Owners**

- **sentinel.service.js:** Orchestrates pricing, drives preview calendars, and logs price history.
- **sentinel.pricing.engine.js:** Canonical formula hub for Node.
- **sentinel.bridge.service.js:** Logic owner for machine-to-machine AI interactions.
- **sentinel.adapter.js:** Owns bulk rate pushes and live PMS fetches.

### **3.2 Database Schema**

- **sentinel_configurations:** Facts (room types, mappings) and Rules (differentials, guardrails).
- **sentinel_rates_calendar:** Internal 365-day layer for rates and AI decisions.
- **sentinel_job_queue:** Queue of pending PMS rate push jobs.
- **sentinel_price_history:** Immutable ledger of all rate changes.
- **sentinel_daily_max_rates:** Granular daily price ceilings.
- **sentinel_pace_curves:** 365-day booking pace targets.

### **3.3 Active Endpoints**

- POST /api/sentinel/preview-rate: Generates live vs AI vs guardrails preview.
- POST /api/sentinel/overrides: Enqueues rate pushes to the job queue.
- GET /api/bridge/context/:hotelId: Returns full context (Inventory, Pace, Stability TS) for AI.
- POST /api/bridge/decisions: Upserts predictions into sentinel_ai_predictions.

---

## **4.0 PRICING FILE TREE**

Plaintext  
api/  
├── adapters/  
│ ├── cloudbedsAdapter.js  
│ └── sentinel.adapter.js  
├── routes/  
│ ├── bridge.router.js  
│ └── sentinel.router.js  
├── services/  
│ ├── sentinel.bridge.service.js  
│ ├── sentinel.pricing.engine.js  
│ └── sentinel.service.js  
web/src/features/sentinel/  
├── api/  
│ ├── sentinel.api.ts  
│ └── types.ts  
├── components/  
│ ├── ControlPanel/  
│ ├── PropertyHub/  
│ ├── RateManager/  
│ └── Shadowfax/  
└── hooks/  
 ├── useRateGrid.ts  
 ├── useSentinelConfig.ts  
 └── useShadowfax.ts

Note: This document is a focused pricing specification; a wider master blueprint exists covering full system architecture, override execution semantics, job queue behavior, notifications, OTA discount stack math, competitive ingestion (Shadowfax), and cross-module data flows—any AI agent must explicitly request that documentation if additional context or certainty is required.

## **5.0 REMOTE COMPUTING & HYBRID INFRASTRUCTURE**

### **5.1 The "Hawaii Protocol" (Concept)**

The system is designed for **Hybrid Execution**:

1.  **Lightweight Frontend (Vercel):** Runs the UI and triggers on the public web.
2.  **Heavyweight Compute (DGX Home Server):** Runs the Python pricing engine (`sentinel_live.py`) on bare metal.
3.  **The Tunnel (Tailscale):** Bridges the two worlds securely without port forwarding.

### **5.2 Connectivity Flows**

#### **Flow A: The Application (Vercel → DGX)**

- **Trigger:** User clicks "Run Sentinel" on the web.
- **Route:** Vercel (`POST /trigger`) → `DGX_API_URL` (Env Var) → **Tailscale Funnel** (Public HTTPS) → **DGX Localhost:5000**.
- **Requirement:** The `dgx-funnel` service must be active on the DGX.

#### **Flow B: The Developer (Cursor → DGX)**

- **Access:** Direct SSH via Tailscale private mesh network.
- **Magic IP:** Uses the `100.x.x.x` CGNAT IP, accessible from any WiFi in the world (Hotel/Cafe).
- **Config:** Requires `sentinel-hawaii` Host block in local `.ssh/config`.

### **5.3 Infrastructure Configuration**

#### **1. Vercel Environment Variables**

- `DGX_API_URL`: Must point to the **Funnel URL** (e.g., `https://spark-828c.tailxxxx.ts.net`), NOT the numeric IP.

#### **2. Local Developer SSH Config (`~/.ssh/config`)**

```text
Host sentinel-hawaii
    HostName 100.66.138.7
    User sentinel
```

3. DGX System Services (Daemonized)
   We run two critical background services on the Linux host:

Service A: The Pricing Engine (sentinel.service)

Command: Runs python3 sentinel_live.py.

Logs: journalctl -u sentinel.service -f

Service B: The Public Tunnel (dgx-funnel.service)

Command: /usr/bin/tailscale funnel 5000

Definition Path: /etc/systemd/system/dgx-funnel.service

Behavior: Auto-restarts on crash; ensures Vercel can always reach the server.

5.4 Operational Commands (Cheat Sheet)

Goal Command (on DGX Terminal)
Watch Pricing Live journalctl -u sentinel.service -f
Check Tunnel Status systemctl status dgx-funnel.service
Restart Tunnel sudo systemctl restart dgx-funnel.service
Get Tailscale IP tailscale ip -4
Check Public URL tailscale funnel status

### [2026-02-04] - Shadow Mode Verification & Infrastructure Automation

- **Shadow Mode Integrity Confirmed:** Verified that AI decisions are correctly saving to `sentinel_ai_predictions` (Shadow) without leaking into `sentinel_price_history` (Live) or `sentinel_rates_calendar` (Production). Confirmed timestamp alignment between DGX logs (CET) and Database (UTC).
- **Middleware "Service Entrance":** Implemented `isInternalRobot` bypass in `middleware.js`. Allows Python scripts (`sync_fleet.py`) to authenticate using `x-internal-secret` header, resolving "401 Unauthorized" errors for automated jobs.
- **Fleet Sync Automation:** deployed `sync_fleet.py` on DGX.
  - **Function:** Triggers `/api/sentinel/sync` for all 33 managed hotels.
  - **Schedule:** Runs daily at **05:00 AM** via Cron.
  - **Goal:** Prevents "Inventory Empty" / "20 dates checked" errors by ensuring the calendar is hydrated before the AI runs.
- **Cron Job Architecture:**
- `0 5 * * *`: **Fleet Sync** (Refreshes Facts & Calendar).
  - `0 * * * *`: **Sentinel Run** (Generates & Uploads Decisions - **Hourly**).

### [2026-02-09] - Logic Hardening & Infrastructure Adjustment

- **"Sell Every Room" Fix:**
  - **Issue:** Rates were hitting the standard Min Rate (£90) instead of the lower Last-Minute Floor (£80).
  - **Fix 1 (Bridge):** Updated `sentinel.bridge.service.js` to pass `last_minute_floor` configuration to the Python Engine.
  - **Fix 2 (Engine):** Updated `sentinel_live.py` Desperation Logic to force-drop rates to the _effective_ floor (Standard or LMF) when lead time is < 48h.
- **Infrastructure Decision (No Git on DGX):**
  - **Decision:** We explicitly chose **NOT** to use Git on the DGX server for now. The code is managed via direct editing (Cursor SSH).
  - **Action:** Removed `daily_update.sh` and the corresponding cron job to prevent errors.
- **Schedule Update:** Increased Sentinel Run frequency to **Hourly** (`0 * * * *`) to capture rapid market changes.

### [2026-02-12] - Navigator v5 Deployment (The "Bible" Update)

- **Navigator v5 (Projection Logic):** Transitioned from "Snapshot" to "Horizon" view. Logic now uses `Current_Occupancy + (Velocity * Days_Remaining)` to predict sell-outs.
- **Saturday Strength:** Implemented 50% Anchor (Mid-Season) for all Fridays/Saturdays, even in Low Season, to prevent "Panic Drops" on weekends.
- **Asymmetric Aggression:**
  - **Low Season:** Decisive Down (1.5x) / Gentle Up (0.5x).
  - **High Season:** Stubborn Down (0.5x) / Aggressive Up (1.5x).
- **LMF Sequence Fix:** Moved Last-Minute Floor check to the top of the engine so the "Slider" math recognizes the lower floor.
- **Source Hierarchy & Locks:**
  - **MANUAL:** Set via Market Pulse UI. **AI is forbidden from touching this.**
  - **SYNC:** Set when price changes in Cloudbeds. **AI is allowed to override this.**
  - **SENTINEL:** Set when AI moves a price. **AI is allowed to override this.**
- **Memory Restoration:** Fixed a "Paperwork Bug" where the Bridge was pushing rates but failing to log them to `sentinel_price_history`.

## **6.0 DEBUGGING & DATA INTEGRITY**

### **6.1 Self-Healing Authentication**

- **Issue:** Occasional `invalid_request` errors during Cloudbeds token refresh.
- **Cause:** High concurrency. When 33 hotels are processed hourly, multiple processes may attempt to refresh the same token simultaneously, causing Cloudbeds to invalidate the session.
- **Protocol:** These errors are usually transient. If a run fails, the system typically self-heals in the next hourly cycle. Manual re-authentication is only required if failures persist for > 3 consecutive hours.

## **7.0 SCHEMA SOURCE OF TRUTH**

_AI Agents must use these exact column names for all SQL queries._

### **7.1 sentinel_configurations (The Rules)**

- `hotel_id` (int), `monthly_min_rates` (jsonb), `last_minute_floor` (jsonb), `seasonality_profile` (jsonb), `rules` (jsonb), `is_autopilot_enabled` (bool), `rate_id_map` (jsonb).

### **7.2 sentinel_ai_predictions (The Brain)**

- `hotel_id` (int), `stay_date` (date), `suggested_rate` (numeric), `reasoning` (text), `is_applied` (bool), `created_at` (timestamp).

### **7.3 sentinel_rates_calendar (The Production Grid)**

- `hotel_id` (int), `stay_date` (date), `rate` (numeric), `source` (text), `last_updated_at` (timestamptz).
- **Valid Sources:** `MANUAL`, `SYNC`, `SENTINEL`.

### **7.4 sentinel_price_history (The Memory)**

- `hotel_id` (int), `stay_date` (date), `old_price` (numeric), `new_price` (numeric), `source` (varchar), `created_at` (timestamp).

### **7.5 sentinel_job_queue (The Hand)**

- `hotel_id` (int), `payload` (jsonb), `status` (text), `last_error` (text), `created_at` (timestamptz).

## **8.0 STANDARD DEBUG PROTOCOL**

### **8.1 "Why did the AI pick this price?"**

```sql
SELECT stay_date, suggested_rate, reasoning, is_applied, created_at
FROM sentinel_ai_predictions
WHERE hotel_id = {{ID}} AND stay_date = '{{DATE}}'
ORDER BY created_at DESC LIMIT 5;
```

8.2 "Show me the last 5 updates sent to the PMS"
code
SQL
SELECT created_at, status, last_error,
(SELECT x.rate FROM jsonb_to_recordset(payload->'rates') AS x(date text, rate float) WHERE x.date = '{{DATE}}' LIMIT 1) as rate_sent
FROM sentinel_job_queue
WHERE hotel_id = {{ID}} AND payload->'rates' @> '[{"date": "{{DATE}}"}]'
ORDER BY created_at DESC LIMIT 5;
8.3 "Who owns this date right now?"
code
SQL
SELECT stay_date, rate, source, last_updated_at
FROM sentinel_rates_calendar
WHERE hotel_id = {{ID}} AND stay_date = '{{DATE}}';
