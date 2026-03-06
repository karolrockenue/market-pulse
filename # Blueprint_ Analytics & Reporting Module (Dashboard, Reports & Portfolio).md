\# Blueprint: Analytics & Reporting Module (Dashboard, Reports & Portfolio)

\#\# 0.0 AI PROTOCOL (FOR ALL AI AGENTS)

This section is binding. Ignore older docs, memories, assumptions, and “best practices” that contradict this.

\*\*System Scope Notice\*\*  
This Blueprint covers ONLY the Reporting, Dashboard, and Portfolio Analytics domains (Market Pulse). This is part of a wider system that includes AI Pricing (Sentinel) and Market Intel. If a request touches logic outside of Analytics & Reporting (e.g., pushing rates to PMS), DO NOT guess. Explicitly ask the user to provide the relevant Blueprint for that domain.

\*\*Analyze First\*\*  
Read all provided project files relevant to the task. Do not start coding before you understand the layer (frontend/backend/DB) and the module owner.

\*\*Plan Before Code\*\*  
Before any code change, output a short bullet-point plan.

\*\*STRUCTURAL ENFORCEMENT (CRITICAL)\*\*  
\- FIND and REPLACE MUST be in two separate fenced code blocks.  
\- Each fenced block MUST contain only one of:  
  \- the FIND snippet  
  \- the REPLACE snippet  
\- It is STRICTLY FORBIDDEN to place FIND and REPLACE in the same code block, label them inside a single snippet, or combine them under comments.

\*\*Wait for explicit user approval before writing code.\*\* Only skip incremental patches if the user explicitly asks for “full file replacement”.

\*\*Clarify Ambiguity\*\*  
Do not invent endpoints, tables, or formulas. If uncertain, ask.

\*\*Incremental Testing\*\*  
After each non-trivial change, provide a Test Checklist detailing what to run and what a "pass" looks like.

\---

\#\# 1.0 SYSTEM OVERVIEW

\#\#\# 1.1 High-Level Structure  
The Analytics & Reporting Module is the visualization and data-aggregation core of the Market Pulse platform. It is strictly read-only regarding external property management systems, focusing entirely on surface-level business intelligence.

\*\*Responsibilities:\*\*  
\- \*\*Dashboard\*\*: High-level daily KPIs, 13-month snapshots, YTD trends, Flowcast (90-day forward view), and recent booking ledger activity.  
\- \*\*Reports Hub\*\*: Dynamic performance matrices (Hotel vs Market), Year-on-Year comparisons, Monthly Takings (Hybrid Cash/Accrual), and Shreeji PDF generation.  
\- \*\*Portfolio Analytics\*\*: Multi-property CEO views, matrix roll-ups, occupancy problem lists, and quadrant-based pacing risk assessment.  
\- \*\*Scheduled Reporting\*\*: Automated PDF/email distribution managed via the \`scheduled\_reports\` database table.

\#\#\# 1.2 Key Boundaries  
\- \*\*UI ↔ Backend\*\*: Frontend components communicate exclusively with \`/api/metrics\`. The frontend \`reports.api.ts\` handles the parallel fetching and manual merging of \`range\` and \`competitor\` endpoints to construct unified report tables.  
\- \*\*Data Ownership\*\*: Metrics are derived from snapshots (\`daily\_metrics\_snapshots\`), historical pacing (\`pacing\_snapshots\`), and budgets (\`hotel\_budgets\`).

\---

\#\# 2.0 ARCHITECTURE

\#\#\# 2.1 Backend Architecture

\* \*\*\`api/services/metrics.service.js\`\*\*: The single source of truth for all KPI, YoY, portfolio, and pacing logic. Handles SQL generation and data transformations.  
\* \*\*\`api/routes/metrics.router.js\`\*\*: The Express interface. It handles complex orchestration, such as the massive \`/summary\` endpoint which aggregates data from over 10 different service/utility calls.  
\* \*\*\`api/adapters/cloudbedsAdapter.js\`\*\*: Used explicitly by the Takings Report to fetch live cash-basis financials (\`getMonthlyFinancials\`).

\#\#\# 2.2 Frontend Architecture (Reporting Scope)

\* \*\*API Hub\*\*: \`web/src/features/reports/api/reports.api.ts\` drives the UI data fetching.  
\* \*\*Merge Logic\*\*: The frontend is responsible for taking decoupled \`yourHotelData\` and \`marketData\` arrays and merging them into a single Map keyed by date for table rendering.

\---

\#\# 3.0 LOGIC HUBS & FORMULAS

\#\#\# 3.1 Tax Toggles (Gross vs. Net)  
Performance reports dynamically switch between gross and net values based on the \`includeTaxes\` boolean.  
\* \*\*Frontend Mapping\*\*: Uses aliases like \`your\_gross\_adr\` vs \`your\_net\_adr\` depending on user selection.  
\* \*\*Backend SQL\*\*: The \`runDynamicReport\` service uses ternary logic inside the SQL \`SELECT\` to pull from the correct DB columns.

\#\#\# 3.2 The Takings Report (Hybrid Data)  
This report merges two distinct data sources:  
1\.  \*\*Accrual Data (DB)\*\*: Total revenue, rooms sold, and capacity pulled from \`daily\_metrics\_snapshots\`.  
2\.  \*\*Cash Data (API)\*\*: Cash/Card/BACS takings and extras pulled live from Cloudbeds via \`getMonthlyFinancials\`.

\#\#\# 3.3 Flowcast & Pickup Math  
Flowcast and Pickup calculate historical velocity by joining live \`daily\_metrics\_snapshots\` against \`pacing\_snapshots\`.  
\* \*\*Formula\*\*: \`Pickup \= live.rooms\_sold \- history.rooms\_sold\`.  
\* \*\*Safety Net\*\*: If yesterday's snapshot is missing (e.g., \`sold1d\` is 0), pickup defaults to 0 to prevent massive false spikes in the UI charts.

\#\#\# 3.4 Portfolio Logic & Pacing Quadrants  
\* \*\*Pacing Risk Assessment\*\*: The system assigns a quadrant risk status (Critical Risk, Rate Strategy Risk, Fill Risk, On Pace) based on a matrix of Forward Occupancy (Threshold: 60%) and Required ADR pacing difficulty (Thresholds: \>100% Yellow, \>115% Red).  
\* \*\*Exclusions\*\*: Hotel ID \`318310\` (Aviator Bali) is strictly hardcoded to be filtered out of Portfolio Aggregates and Detailed Portfolio views to prevent data pollution.

\#\#\# 3.5 Year-on-Year Math  
\* \*\*Variance Calculation\*\*: Calculated dynamically in the router as \`((current \- past) / past) \* 100\`.  
\* \*\*Fallback\*\*: If past revenue is 0 but current is \> 0, variance defaults to 100%.

\---

\#\# 4.0 DATABASE SCHEMA (REPORTING DOMAIN)

\* \*\*\`daily\_metrics\_snapshots\`\*\*: Core table. Includes \`stay\_date\`, \`gross\_revenue\`, \`net\_revenue\`, \`gross\_adr\`, \`net\_adr\`, \`rooms\_sold\`, \`capacity\_count\`.  
\* \*\*\`pacing\_snapshots\`\*\*: Used for pickup/flowcast. Contains \`snapshot\_date\`, \`stay\_date\`, \`rooms\_sold\`.  
\* \*\*\`hotel\_budgets\`\*\*: Used for pacing goals. Contains \`budget\_year\`, \`month\`, \`target\_revenue\_gross\`.  
\* \*\*\`daily\_bookings\_record\`\*\*: Sales ledger used for the Recent Activity widget. Contains \`booking\_date\`, \`room\_nights\`, \`revenue\`.  
\* \*\*\`scheduled\_reports\`\*\*: Stores config for automated reports. Contains \`user\_id\`, \`property\_id\`, \`report\_type\`, \`frequency\`, \`day\_of\_week\` (Mapped 1=Mon...7=Sun).

\---

\#\# 5.0 API REFERENCE (METRICS ROUTER)

All endpoints are prefixed with \`/api/metrics\` and require \`requireUserApi\` or \`requireAdminApi\`.

\#\#\# 5.1 Dashboard APIs  
\* \*\*\`GET /summary\`\*\*: The master dashboard endpoint. Returns \`snapshot\`, \`marketOutlook\`, \`forwardDemandChartData\`, \`rankings\`, \`ytdTrend\`, \`budgetBenchmark\`, \`flowcast\`, and \`recentActivity\`.  
\* \*\*\`GET /chart\`\*\*: Returns granular arrays comparing \`yourHotel\` vs \`market\` occupancy, ADR, and RevPAR.  
\* \*\*\`GET /pickup\`\*\*: Returns daily live vs historical pickup data for the Rate Manager.

\#\#\# 5.2 Reporting APIs  
\* \*\*\`POST /reports/run\`\*\*: Executes the dynamic performance report, returning aggregated columns based on the \`metrics\` array.  
\* \*\*\`GET /reports/takings\`\*\*: Fetches the hybrid cash/accrual report. Accepts \`propertyId="ALL"\` to fetch portfolio data.  
\* \*\*\`POST /reports/year-on-year\`\*\*: Returns a 12-month mapped array comparing \`year1\` and \`year2\` metrics.  
\* \*\*\`GET /reports/shreeji/download\`\*\*: Triggers PDF generation and returns an \`application/pdf\` buffer.  
\* \*\*\`GET | POST | DELETE /reports/scheduled\`\*\*: CRUD operations for automated report delivery.

\#\#\# 5.3 Portfolio APIs  
\* \*\*\`GET /portfolio\`\*\*: Returns high-level global aggregates (revenue, occ, adr) and a grid of property performances.  
\* \*\*\`GET /portfolio/detailed\`\*\*: Returns a 45-day matrix array and a 24-month rolling performance array per property.  
\* \*\*\`GET /portfolio/pacing\`\*\*: Returns quadrant-based risk analysis per property.  
\* \*\*\`GET /portfolio/flowcast\`\*\*: Returns a multi-property forward pickup view.

