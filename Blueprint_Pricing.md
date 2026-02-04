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
