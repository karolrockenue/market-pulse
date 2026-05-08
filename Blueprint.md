0.0 AI PROTOCOL (FOR ALL AI AGENTS)

IMPORTANT: At the start of every session, read all documents in the /claude folder in the project root. These contain active to-do items, decisions, and context that must inform your work.

This section is binding. Ignore older docs, memories, assumptions, and “best practices” that contradict this.

Analyze First

Read all provided project files relevant to the task.

Do not start coding before you understand:

Which layer you are touching (frontend / backend / DB).

Which module owns the logic (service vs router vs adapter vs React).

Plan Before Code

Before any code change, output a short bullet-point plan.

STRUCTURAL ENFORCEMENT (CRITICAL)

- FIND and REPLACE MUST be in two separate fenced code blocks
- Each fenced block MUST contain only one of:
  - the FIND snippet
  - the REPLACE snippet

- It is STRICTLY FORBIDDEN to:
  - place FIND and REPLACE in the same code block
  - label FIND and REPLACE inside a single snippet
  - combine them under comments, headers, or separators

If FIND and REPLACE appear in the same code block:
→ Output is INVALID
→ STOP
→ Apologize
→ Ask to re-output correctly

When proposing code changes, you MUST output exactly two fenced code blocks.

Rules:

The first code block must contain only the exact code to FIND.

The second code block must contain only the exact code to REPLACE it with.

Do NOT include any labels, comments, explanations, or words such as “FIND”, “REPLACE”, “before”, “after”, or similar inside the code blocks.

Do NOT include comments inside the snippets.

Do NOT combine both snippets into one block.

Each code block must be directly copy-pasteable into VS Code search/replace without modification.

Any explanation must be written outside the code blocks.

Wait for explicit user approval before writing code.

If user explicitly asks for “full file replacement”, you may skip incremental patches for that request only.

Clarify Ambiguity

If any function, file, or data flow is unclear → ask.

Do not invent new endpoints, types, or tables.

One Logical Area at a Time

Prefer modifying one logical area per instruction (e.g. one React feature file, or one router + its service).

If a refactor spans multiple files, keep the changes tightly scoped and clearly grouped.

Search & Replace Format (Default)

When updating code, prefer:

Show a find snippet.

Show a replace snippet.

Only do whole-file rewrites if the user explicitly asks for “entire file to paste”.

Minimal Comments

Comments only where they add structural clarity (e.g. top of service functions, complex sections).

Do not add commentary noise or “chatty” comments into the code.

Incremental Testing

After each non-trivial change, provide a Test Checklist:

What to run (e.g. npm test, curl call, UI path).

What a “pass” looks like.

Request Missing Files

If you need a file (e.g. a hook, service, component) and it’s not provided → explicitly ask for it rather than guessing.

Strict Non-Hallucination Protocol

Do not invent:

Endpoints

Tables / columns

File names / paths

Types / interfaces

Business rules or formulas

Everything must match existing sources and this Blueprint.

If uncertain, ask instead of guessing.

1.0 SYSTEM OVERVIEW
1.1 High-Level Structure

The system has two tightly connected subsystems:

Market Pulse (Core Platform)

Acts as the Data Hub.

Manages:

Hotels, users, ownership, Rockenue-managed flags.

Budgets, compsets, Rockenue assets.

Internal KPIs, YoY, portfolio metrics.

Market & pace data.

Hosts the entire UI (including Sentinel screens).

Sentinel (AI Pricing Engine)

Lives inside the Market Pulse backend and frontend.

Back-end responsibilities:

Central pricing engine (canonical formulas, in Node).

Async job queue for PMS rate pushes (sentinel_job_queue).

Notifications for background job outcomes.

Front-end responsibilities:

Control Panel – configuration, guardrails, and OTA discount stack (Promo Config). Property Hub functionality merged here as collapsible "OTA Discount Stack" section per hotel.

Rate Manager – grid with live vs AI vs guardrails, overrides.

Risk Overview – portfolio risk lens inside Sentinel.

Health (admin-only) – fleet freshness dashboard: per-hotel last-push status, 30-day sparklines, clustered failure feed (last 24h). Also drives an ambient pill in AppTopBar and a status dot on the Sentinel sidebar section. Backed by `sentinel_hotel_heartbeat` (§4.14) and `/api/sentinel/health/*` (§5.1).

Connects to PMS via adapters (PMS-siloed architecture):

Cloudbeds:
cloudbedsAdapter.js (OAuth auth + generic operations).
sentinel.adapter.js (Cloudbeds pricing-focused write/read bridge).

Mews:
mewsAdapter.js (static token auth + configuration, metrics, onboarding).
mews.sentinel.adapter.js (Mews pricing-focused write/read bridge).

pmsRegistry.js routes all PMS calls to the correct adapter based on hotels.pms_type.

1.2 Key Boundaries

UI ↔ Backend

All Sentinel UI components talk to /api/sentinel/....

Market Pulse domain UIs talk to /api/metrics, /api/hotels, /api/market, /api/admin, /api/auth, /api/users, /api/webhooks.

Backend ↔ PMS

All PMS read/write operations go through adapters, routed by pmsRegistry.js:

Cloudbeds: cloudbedsAdapter.js for OAuth tokens + general operations. sentinel.adapter.js for Sentinel rate reads/writes.

Mews: mewsAdapter.js for static token auth + configuration/metrics. mews.sentinel.adapter.js for Sentinel rate reads/writes (rates/getPricing, rates/updatePrice).

The process-queue worker, Rate Manager, and PMS Sync routes all use pmsRegistry.\_getSentinelAdapterForHotel(hotelId) to resolve the correct adapter at runtime. Cloudbeds remains the default fallback.

Data Ownership

Facts & rules for Sentinel live in sentinel_configurations.

Rate history & overrides live in sentinel_rates_calendar.

Queue state is in sentinel_job_queue.

User-facing issues are surfaced via sentinel_notifications.

Core hotel & metrics tables remain part of Market Pulse.

1.3 Fleet Inventory (Hotel ID Mapping)

| Hotel Name | System ID | Type |
|---|---|---|
| The Portico Hotel | fbd2965d-34d9-4134-944f-28c3b512f2ff | UUID |
| The W14 Hotel | ee9f3ef4-9a88-46a9-aaf6-83a5c17bea4a | UUID |
| House of Toby | 1fa4727c-eb1a-44ce-bf95-5bc4fe6dac7d | UUID |
| The 29 London | bb9b3c42-4d0d-4c0d-9f74-efd32aea7d52 | UUID |
| Jubilee Hotel Victoria | 230719 | Integer |
| The Cleveland Hotel | 289618 | Integer |
| The Melita | 308760 | Integer |
| Vilenza Hotel | 315428 | Integer |
| Camden Suites | 315429 | Integer |
| City Rooms | 315430 | Integer |
| London Homes (Aldgate) | 315431 | Integer |
| The Whitechapel Hotel | 315433 | Integer |
| Citygate | 315435 | Integer |
| Elysee Hyde Park | 315473 | Integer |
| Notting Hill House Hotel | 316843 | Integer |
| The Jade Hotel | 318238 | Integer |
| Whitechapel Grand | 318297 | Integer |
| London Suites | 318298 | Integer |
| Studio 169 | 318301 | Integer |
| Lancaster Court Hotel | 318302 | Integer |

Missing Data (defined but no CSV history): St George Hotel Norfolk Square (318291), G Hotel Henderson (318303), St George's Inn Victoria (318305), Maiden Oval (318307), Aviator Bali (318310), The Pack and Carriage London (318312).

Purged (external hotels removed 2026-04-20): Astor Victoria (2400, London), Brickell Apart Hotel (318318, Santo Domingo), Hotel Tano Guam (318320, Tumon). Cloudbeds OAuth went silent simultaneously on 2026-04-07; all three were confirmed external and fully removed. `daily_metrics_snapshots` rows retained (orphaned) for future market analysis; metadata archived in `deleted_hotels_archive`. See §4.13.

Async Isolation

User actions (overrides) never block on PMS writes.

Producer enqueues jobs; worker processes them and reports via notifications.

DGX

DGX Spark is the future compute layer.

Current system references it conceptually; runtime pricing logic is fully handled by Node + adapters + existing SQL.

Shadowfax (Retired — April 2026): The Shadowfax live price scraper has been fully removed. All frontend components (ShadowfaxView, useShadowfax hook), API routes (/shadowfax/properties, /shadowfax/price), backend service methods (getSentinelProperties, checkAssetPrice), scraper.utils.js, navigation items, and type definitions have been deleted. The scraping approach was superseded by Market Codex (automated daily scrapes) and Demand Radar (forward market intelligence).

Mews Integration (Active — March 2026)

Full Mews PMS integration across all 5 phases: onboarding, metrics sync, Sentinel rate reads, Sentinel rate writes, and real-time webhooks.

Architecture: PMS-siloed. All Mews code lives in dedicated files. Zero changes to Sentinel core services or pricing engine.

New files: mewsAdapter.js, mews.sentinel.adapter.js, pmsRegistry.js, mews.onboarding.router.js, mews.webhooks.router.js.

Modified files (additive only): server.js (4 lines), sentinel.router.js (5 PMS routing patches), sentinel.service.js (1 PMS-aware rate_id_map patch), daily-refresh.js (Mews branch updated).

Environment variables: MEWS_CLIENT_TOKEN, MEWS_API_URL (defaults to https://api.mews-demo.com, production: https://api.mews.com).

Per-hotel credentials: hotels.pms_credentials stores { accessToken, serviceId, timezone }.

Production webhook URL: https://www.market-pulse.io/api/mews-webhooks

Certification: Mews certification form submitted. Pending production ClientToken.

Sentinel Health (Active — April 2026)

Admin-only monitoring surface for the Sentinel rate-push engine. Solves the "Sentinel may fail for days without anyone knowing" problem — previously the only signal that a hotel had stopped pushing rates was manually inspecting `sentinel_job_queue`.

Three layers, all admin-gated:

- **L1 ambient** — hotel-header pill in AppTopBar (`SentinelHealthPill.tsx`) showing a coloured dot + "pushed Xm ago" + hover popover (last success, last failure, error excerpt, consecutive-failure streak). Plus a status dot on the Sentinel sidebar row aggregating the fleet's worst status.
- **L2 dedicated** — `Sentinel → Health` page (`components/Health/HealthView.tsx`): freshness-violations banner, fleet grid with 30-day per-day sparklines, and a clustered failure feed (last 24h, grouped by error signature: "Mews 403 Conflicting operation", "Auth failure", "Network / timeout", etc.).
- **Polling** — 60s interval via `useSentinelHealth.ts`; fetch errors degrade silently to null so a failing health endpoint hides the UI rather than crashing it.

Data layer: new `sentinel_hotel_heartbeat` table (one row per hotel) written by the worker on every job outcome. See §4.14 for the load-bearing "what counts as a success" definition (COMPLETED job with >0 rates; SKIPPED / safety-filtered jobs don't advance the heartbeat), freshness SLA (autopilot=4h, otherwise 24h), and status derivation (off / red / amber / green).

Architectural isolation: heartbeat writes go through the pg pool directly (not the worker's transaction client) and any error is caught and only logged. Observability must never break the thing it is observing.

New endpoints (all admin-only, inherit `requireAdminApi`): `/api/sentinel/health/fleet/summary`, `/api/sentinel/health/fleet`, `/api/sentinel/health/hotel/:hotelId`. See §5.1.

Frontend integration is additive: `AppTopBar`, `AppSidebar`, and `SentinelHub` each gained a single conditional render guarded by the admin role check. Non-admins see no change.

Known trap (fixed 2026-04-21): pg returns `::date` columns as `"YYYY-MM-DD"` strings, not `Date` objects. The sparkline loop originally called `.toISOString()` on `c.day` and threw `TypeError`, 500'ing the fleet endpoint. Fixed by normalizing via `typeof c.day === "string"`. Worth remembering: the SQL working in a sanity check does not prove the consuming JS is correct — always simulate full endpoint payload serialization when adding DB-backed endpoints.

2.0 ARCHITECTURE
2.1 Backend Architecture

Stack & Entry

Node.js + Express.

Deployed on Railway (persistent Node.js process). Migrated from Vercel on 2026-04-05.

IMPORTANT — RAILWAY MIGRATION (2026-04-05):
The platform moved from Vercel (serverless) to Railway (persistent process). Key differences:
- Cron jobs now run in-process via `node-cron` (gated by `RAILWAY_ENVIRONMENT_NAME`), not HTTP-triggered via vercel.json.
- PDF generation uses system-installed Playwright Chromium, not `@sparticuz/chromium` (Lambda-specific).
- `VERCEL_ENV=production` is set on Railway as a compatibility shim — many files still reference it. Phase 5 cleanup will replace with `NODE_ENV`.
- The full migration plan and status is in `claude/migration.md`.
- AI agents should be mindful of this move: some areas may not have been fully verified yet. If touching webhooks (Cloudbeds/Mews), OAuth flows, or any code that references `VERCEL_ENV`/`VERCEL_URL`, verify it works on Railway.

Observability (added 2026-04-06):

- Structured logging: pino + pino-http. All API requests logged as JSON (method, URL, status, duration). Static assets and /health excluded. Logs are auto-parsed by Railway Log Explorer.
- Health endpoint: GET /health — returns DB connectivity, uptime (seconds), memory (MB), timestamp. Can be used for Railway uptime monitoring.
- Sentry error tracking: Initialized via instrument.js (loaded before server.js via --require flag in package.json start script). Gated by SENTRY_DSN env var. Captures unhandled exceptions and Express errors via Sentry.setupExpressErrorHandler(app).
- Cron logging: All in-process cron jobs emit structured JSON with { type: "cron", job, status, durationMs }.
- Key files: instrument.js (Sentry init), api/utils/logger.js (pino instance).

Single entrypoint: server.js

Mounts domain routers:

/api/metrics

/api/hotels

/api/market

/api/admin

/api/auth

/api/users

/api/sentinel

/api/support

/api/webhooks

/api/mason   (Mason & Fifth dashboard reporting; access-gated by user_properties)

Domain Services (Logic Owners)

api/services/metrics.service.js

Single owner of all KPI / performance / YoY / portfolio / pacing logic.

api/services/market.service.js

Market data, pace, seasonality.

api/services/hotel.service.js

Hotels, budgets, compsets, Rockenue assets, safe deletion.

api/services/sentinel.service.js

Canonical Sentinel pricing orchestration:

Builds override payloads using sentinel.pricing.engine.js.

Drives preview calendars and DB writes.

recalculateRates(hotelId, startDate, endDate) — reusable function for full rate recalculation + PMS queue push. Used by POST /recalculate endpoint and autopilot triggers.

api/services/sentinel.bridge.service.js

Logic owner for Machine-to-Machine interactions (AI Bridge).

Aggregates context (Inventory, Pace, Config) for the AI.

Upserts AI predictions into sentinel_ai_predictions.

api/services/... (future)

Additional services should follow the same pattern: routers stay thin; services own SQL + business logic.

Routers (Interfaces)

api/routes/metrics.router.js

Read-only metrics domain: dashboard, reports, portfolio, pacing.

api/routes/hotels.router.js

Hotels, budgets, Rockenue assets, management flags, compsets.

api/routes/market.router.js

Market & pace views.

api/routes/admin.router.js

Internal operations: health, manual sync, maintenance.

api/routes/webhooks.router.js

Inbound events from Cloudbeds PMS → metrics snapshots (Pulse).

api/routes/mews.onboarding.router.js

Mews hotel onboarding (POST /api/mews/onboard, POST /api/mews/test-creds).

Admin-only. Creates hotel + sentinel_configurations records from Mews API data.

api/routes/mews.webhooks.router.js

Inbound events from Mews PMS → metrics snapshots + bookings ledger.

Mounted at /api/mews-webhooks. Handles ServiceOrderUpdated General Webhook events.

Fetches reservation details + revenue (orderItems/getAll) per event.

api/routes/auth.router.js / api/routes/users.router.js

Authentication & user management; aligned with service architecture.

api/routes/support.router.js

Support endpoints surfaced to the UI.

api/routes/sentinel.router.js

Sentinel-only API (see §5.1).

api/routes/bridge.router.js

Machine-to-machine AI Bridge (Node <-> DGX). Protected by x-api-key.

api/routes/mason.router.js

Mason & Fifth dashboard reporting. Mounted at /api/mason. Two endpoints:
GET /access (returns the M&F hotels the user can view) and
GET /service-revenue?hotelId=&from=&to= (returns gross+net+nights per
service per month from Mews orderItems/getAll — `nights` counts
SpaceOrder items; daily-TimeUnit services emit 1 per room-night, Long
Stay emits 1 per month-charge). All routes guarded by requireUserApi
plus a custom requireMasonAccess middleware that allows admins/super_admins
unconditionally and otherwise checks user_properties for any of the M&F
hotel IDs (318329 Belsize, 318341 Westbourne, 318343 Primrose). The
middleware compares against req.user.cloudbedsId (varchar), NOT
req.user.internalId — user_properties.user_id stores cloudbeds_user_id.
10-minute in-memory cache per (hotelId, from, to) tuple.

Rule for AI:
Never re-introduce deleted routers (dashboard/planning/reports/portfolio/rockenue/budgets/property-hub/scraper). All new work builds on the domain routers above.

Adapters

api/adapters/cloudbedsAdapter.js

Primary PMS adapter.

Owns OAuth/token exchange & generic calls.

Exposes functions like getAccessToken(hotelId) and Cloudbeds-specific helpers.

api/adapters/sentinel.adapter.js

Sentinel-focused bridge.

Uses Cloudbeds tokens.

Owns:

postRateBatch(...) for bulk pushes.

getRates(hotelId, pmsPropertyId, roomTypeId, startDate, endDate) for live rate fetches.

api/adapters/mewsAdapter.js

Full Mews PMS adapter (rewritten March 2026).

Auth: MEWS_CLIENT_TOKEN from env (shared) + per-hotel AccessToken from hotels.pms_credentials.

Owns: getHotelDetails, getAccommodationServiceId, getResourceCategories, getRatePlans, buildMewsRateIdMap, getOccupancyMetrics, getRevenueMetrics, getCombinedMetrics, getServiceRevenueByMonth (Mason Dashboard), utcToLocalDate (timezone helper, see trap below).

API base URL controlled by MEWS_API_URL env var (defaults to demo, production is https://api.mews.com).

**ADAPTER TRAP — read this before touching getOccupancyMetrics or getRevenueMetrics.**

Both functions previously labelled rows by slicing the UTC timestamp string (`new Date(utc).toISOString().split('T')[0]`). During BST (or any non-UTC timezone), Mews's local-midnight timestamps look like `2026-04-16T23:00:00Z` for the Apr 17 stay night — UTC-date slicing produced "2026-04-16". Every Mews hotel's daily_metrics_snapshots row was labelled one day earlier than its real stay date, including pacing snapshots and the 90-day occupancy chart on every dashboard.

Always use the new `utcToLocalDate(utcStr, timezone)` helper for any UTC → date conversion in the Mews path. It uses `Intl.DateTimeFormat('en-CA', { timeZone })` to extract the hotel-local date. Verified against Mews Availability Reports — every day matched within ±0–1 rooms after the fix.

Retry behaviour also extended in `_callMewsApi`: now retries on 429/408/401 + Cloudflare 502/503/504/520-524 + any network error, with exponential backoff capped at 30s, 4 attempts total. Cloudflare HTML error bodies are truncated in logs and thrown errors so they don't poison the UI.

**403 Conflicting-operation retry (added 2026-04-21).** Mews serializes writes per-rate. When `rates/updatePrice` chunks or consecutive Sentinel jobs target the same Rate ID, a prior call can still be finalizing server-side when the next lands, returning `403 {"Message":"Conflicting operation is being performed at this time. Please try again in a few seconds."}`. `_callMewsApi` now detects this specific 403 (regex match on `Message`) and retries with a dedicated 3s → 6s → 12s backoff (vs. the standard 2s/4s/8s for other transients). Generic 403s (auth/permission failures) still fail fast. The worker's 2s inter-job delay in `sentinel.router.js:runBackgroundWorker` is kept as a first line of defence; the retry is the backstop. Known incident — Westbourne / hotel 318341 2026-04-21: one job out of five in a Sentinel worker cycle failed with this error before the fix.

**Known incident — Westbourne / Primrose 2026-04-17.** Operators noticed the Mason Dashboard occupancy chart showing impossible values (e.g. Primrose 105% occupancy on multiple days). Root cause was the timezone-slice bug above plus a separate `daily_metrics_snapshots.snapshot_taken_date` always landing on `1970-01-01` (the INSERT in `api/daily-refresh.js` omitted the column entirely, so it relied on a non-existent default). Both fixed in the same commit; daily-refresh now writes `snapshot_taken_date = CURRENT_DATE` and updates it on conflict so we can audit when each row was last refreshed.

**Webhook idempotency (fixed 2026-04-18).** `mews.webhooks.router.js` no longer writes `gross_revenue` and no longer applies a blind `+1/-1` per `ServiceOrderUpdated`. A new table `mews_webhook_state` tracks `last_applied_active` and the applied stay range per reservation; the handler computes a delta vs prior state and no-ops when nothing material changed. `Optional` is treated as an active state (matches `services/getAvailability`). Revenue is sourced exclusively from the refresh job — which now runs every 2 hours for Mews hotels (`0 8,10,12,14,16,18,20,22 * * *` UTC, skipping 06:00 to preserve the morning `pacing_snapshots` row). Bootstrap script: `scripts/bootstrap-mews-webhook-state.js` (run before each future redeploy that resets the table). Pre-fix drift example on 2026-04-18 17:05 UTC: Westbourne Apr 20 `rooms_sold` was +62 vs morning truth; after 18:00 refresh with the new handler live, same date was +2 (genuine booking activity). Details: `claude/rockenue/groups/mason-and-fifth.md` §11.

api/adapters/mews.sentinel.adapter.js

Sentinel-focused Mews bridge (mirrors sentinel.adapter.js interface).

Owns: getRates (via rates/getPricing), getRoomTypes, getRatePlans, postRate, postRateBatch (via rates/updatePrice), getJobStatus.

All functions take the same parameters as sentinel.adapter.js for interface compatibility.

Rate writes are chunked at 50 PriceUpdates per Mews API call with 500ms delay between chunks to avoid API throttling.

api/adapters/pmsRegistry.js

PMS Adapter Router. Returns the correct adapter module based on hotels.pms_type.

Exports: getAdapter(pmsType), getSentinelAdapter(pmsType), getPmsType(hotelId).

Used by: sentinel.router.js (via \_getSentinelAdapterForHotel helper), daily-refresh.js, sentinel.service.js.

api/adapters/operaAdapter.js

Present for future Opera PMS integration. Not yet active.

Utils

api/utils/db.js – shared PostgreSQL connection pool (Neon). Pool is configured with `max: 10`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 10_000`, `query_timeout: 30_000`, and `keepAlive: true`. These are load-bearing — without them Neon's pooler drops idle connections silently and the pg pool serves those dead sockets on the next query, hanging every subsequent request until the Node process is restarted.

**Known incident — full site outage 2026-04-20.** Symptom: `/health` timed out (`SELECT 1` hung), `/api/*` returned 502 via Railway edge, static SPA routes served fine (`/` = HTTP 200). Neon Monitoring showed no active queries, no stuck sessions, compute healthy. Root cause was the pg pool above having no timeouts at all (`new Pool({ connectionString })` was the full config). Dead-socket connections from Neon's idle-drop accumulated in the pool after a day of heavy script activity (`bootstrap-mews-webhook-state.js` ran twice, `backfill-mews-history.js`, plus the new 2h Mews refresh cron) and wedged the process. Railway restart cleared the pool and restored service instantly. The pool-timeout config is the permanent fix; any future "Neon is up but site hangs" symptom should first check pool state via `/health`, then restart Node if still wedged.

api/utils/benchmark.utils.js – pacing & benchmarking helpers.

api/utils/market-codex.utils.js – WAP/trend/demand logic hub.

api/utils/pacing.utils.js – pacing-specific business helpers.

api/utils/pdf.utils.js, api/utils/report-templates/... – reporting & PDFs.

api/utils/email.utils.js, api/utils/emailTemplates.js – transactional emails.

api/utils/middleware.js – auth, requireAdminApi, etc.

api/utils/bridgeAuth.js – Security middleware for AI Bridge (x-api-key).

api/utils/logger.js – shared pino logger instance (structured JSON logging).

Workers & Scripts

scripts/import-daily-history.js / scripts/import-monthly-history.js

Backfill & import helpers for metrics.

Sentinel async worker logic now lives inside sentinel.router.js as an internal background runner, not a separate worker file. The worker also writes per-hotel health snapshots to `sentinel_hotel_heartbeat` on every job outcome via `writeSentinelHeartbeat` — see §4.14 for design (pool-direct writes, error swallowing, success taxonomy).

2.2 Frontend Architecture

Stack & Entry

React SPA (Vite) with TypeScript.

Entry: web/src/main.tsx + web/src/App.tsx.

Styling:

Tailwind + shadcn/ui primitives (web/src/components/ui/...).

Global styles in web/src/styles/globals.css.

Top-Level Routing / Product IA

The UI reflects the domain split:

Dashboard – primary KPIs landing page.

Reports Hub – performance, YoY, budgets, portfolio; internal-only tiles for Rockenue as needed.

Market Intelligence – external & pace views.

Sentinel – full AI pricing engine area.

Settings – configuration, budgets, advanced settings.

Admin – internal tools for Rockenue only.

This IA is implemented with feature hubs under web/src/features/....

Core Feature Modules

Under web/src/features:

admin/

AdminHub.tsx

API: admin/api/admin.api.ts, admin/api/types.ts

Hooks: useAdminData.ts, useHotelSync.ts

dashboard/

DashboardHub.tsx

Components: HotelDashboard.tsx, PortfolioOverview.tsx, DynamicYTDTrend.tsx, MarketOutlookBanner.tsx

API: dashboard/api/dashboard.api.ts

Hooks: useDashboardData.ts

reports/

ReportsHub.tsx

Components: ReportSelector.tsx, ReportTable.tsx, ReportActions.tsx, ReportControls.tsx, BudgetReport.tsx, YearOnYearReport.tsx, ShreejiReport.tsx

API: reports/api/reports.api.ts, reports/api/types.ts

Hooks: useReportData.ts, useScheduledReports.ts

market-intel/

MarketIntelHub.tsx

Uses metrics/market APIs to surface forward-demand & competitive insights.

settings/

Settings UI aligned with Figma (tabs, inline forms).

API: settings/api/settings.api.ts, settings/api/types.ts

Hooks: useSettings.ts

sentinel/

SentinelHub.tsx – main Sentinel entry in the UI.

Sub-components (structured by sub-domain):

components/ControlPanel/ControlPanelView.tsx

components/ControlPanel/PromoConfigSection.tsx

components/RateManager/RateManagerView.tsx

components/RateManager/OccupancyVisualizer.tsx

components/RiskOverview/PortfolioRiskOverview.tsx

components/Health/HealthView.tsx (admin-only — Sentinel Health page: freshness banner, fleet grid with 30-day sparklines, clustered failure feed. Wired to `/api/sentinel/health/*`. See §4.14.)

components/SentinelHealthPill.tsx (admin-only per-hotel pill rendered in AppTopBar. Polls `/api/sentinel/health/hotel/:hotelId` every 60s. Hidden for `off` status.)

Hooks:

hooks/usePropertyHub.ts (exports math functions for OTA discount stack — used by useSentinelConfig and useRateGrid)

hooks/useRateGrid.ts

hooks/useSentinelConfig.ts (also loads rockenue_managed_assets for Promo Config)

hooks/useSentinelHealth.ts — two polling hooks (`useHotelSentinelHealth`, `useFleetSentinelHealth`). 60s interval. Swallow fetch errors to null so a failing health endpoint just hides the UI rather than crashing the app.

API layer:

api/sentinel.api.ts

api/types.ts

Rule for AI:
All Sentinel pricing math and data orchestration comes from the backend (sentinel.service.js + sentinel.pricing.engine.js + sentinel.adapter.js).
React components and hooks must not re-implement or diverge from those formulas.

rockenue/components/MasonDashboard.tsx

Mason & Fifth multi-property revenue dashboard. Lives under
`web/src/features/rockenue/components/` because it was originally a Studio
mockup that promoted into a real feature; sidebar nav entry is also in
Studio for admin QA. Real users reach it via the property dropdown.

Behaviour:
- Admins (super_admin/admin) see a synthetic "Mason Dashboard" entry in
  the property dropdown (App.tsx injects via propertiesWithMason). Picking
  it opens the dashboard with an inner property-picker for the 3 M&F
  hotels.
- Regular M&F users (e.g. dph@mason-fifth.com, hh@mason-fifth.com) just
  see their individual M&F hotels in the normal dropdown. Picking any of
  them routes activeView=dashboard to MasonDashboard scoped to that
  hotel — bypasses the standard HotelDashboard.
- Routing intercept lives in App.tsx: `if (activeView === "dashboard"
  && isMasonProperty(property))` → render `<MasonDashboard scopedHotelId>`
  instead of `<DashboardHub>`.
- Pulls live revenue from `/api/mason/service-revenue` (Mews orderItems);
  pulls occupancy + market demand from the standard `useDashboardData`
  hook (same source as every other dashboard).
- Belsize Park is single-service in Mews (only "Accommodation"), mapped
  into the `short` slot server-side; Mid + Long render as £0 — by design.
- Headline Occupancy + Avg ADR are live (2026-04-20): occupancy from
  `useDashboardData` snapshot (property-wide per §10), ADR = live
  3-service total revenue ÷ property-wide room nights recovered from
  the snapshot as revenue ÷ adr.
- Per-service ADR + Occupancy are live too: ADR = service_revenue ÷
  service_nights (from `orderItems` SpaceOrder count), Occ share =
  service_nights ÷ property capacity × 100. Three services' shares
  sum to the headline occ. Long Stay is an approximation: its
  SpaceOrder items are monthly units, so the UI labels its ADR `/mo`
  and the occ share multiplies nights ×30 (accurate to ±20%).

rockenue/components/MasonSalesFlash.tsx + MasonPacingFlash.tsx
(Studio mockups, added 2026-04-30)

Static design mockups for Mason & Fifth's investor reporting pack.
Live under Studio in the sidebar — not yet a productized feature.

- **Sales Flash** mirrors the WB Sales Flash spreadsheet layout:
  Current Month Summary (Revenues + KPIs vs PM/PY/Budget), Annualised
  vs Budget grid, BOB & Business Done split, Pacing Report by service,
  Weekly Unit Pacing, Accommodation Bookings (SS weekly + LS new
  deals by booking-window tier), Ancillaries (Canal/Meadow/Grounding).
- **Pacing Flash** mirrors the Atomize-style pacing sheet: 13-month
  grid (Jun → Jun) × 5 KPIs (Revenue, Room Nights, RevPAR, ADR, Occ)
  with rows for Last Pacing Report, Current OTB, Forecast, Final Month
  LY, Same Time LY, % vs LPR, % vs STLY. Property switcher across the
  three M&F hotels. Plus a Booking Pulse block (8-week new bookings /
  cancellations / revenue picked up, attributed to a stay month).

Both pages use mock numbers seeded from the actual reports so users
recognise the structure. Both have a placeholder "Export Excel"
button (disabled, "coming soon") so the entry point exists for future
wiring. Visual style is intentionally subtle — flat tabular grid,
desaturated red/green deltas, no chips, no coloured lanes — matches
the rest of MP's monochrome reporting surfaces.

Backend wiring (live AccCat-grouped revenue + pacing snapshots +
forecast) is the next step once Mason signs off on the layout.

Shared Components & Utilities

web/src/components/TopNav.tsx, LandingPage.tsx, InitialSyncScreen.tsx, NotificationBell.tsx, MarketVeil.tsx, SettingsPage.tsx, SupportPage.tsx, modal components, etc.

web/src/components/ui/\* – shadcn primitives (omitted from file tree to reduce noise).

web/src/styles/globals.css – global layout & theme.

web/src/guidelines/Guidelines.md – internal UI rules.

3.0 LOGIC HUBS & FORMULAS
3.1 Rate Replicator (OTA Sell-Rate Calculator)

NOTE (2026-04-16): This per-hotel Booking.com-shaped waterfall is being superseded by the per-channel-with-overrides model on the Rockenue → Channel Pricing page (distribution_channel_pricing.steps JSONB + distribution_hotel_pricing_overrides). Both systems currently coexist; migration plan is documented in claude/todo.md under "Channel Pricing → Control Panel integration". My Rates (Current Sell Rate) will continue to use Booking.com's resolved stack after migration.

Configured per hotel inside the Control Panel's "OTA Discount Stack" collapsible section. Settings are stored in rockenue_managed_assets (calculator_settings JSONB + strategic_multiplier + genius_discount_pct). The simulator (price waterfall) is available inline next to the settings.

Sequential discount stack:

Level 0 – Base

RawBase = PMS_Rate × Multiplier

Level 1 – Rate Plan Modifier

Non-refundable etc.

AfterNonRef = RawBase × (1 − NonRef%)

Level 2 – Sequential Discounts (applied in order)

Genius

AfterGenius = AfterNonRef × (1 − Genius%)

Long Campaign (always-on, no date range — replaces dated campaigns like Late Escape, Early Booker)

AfterCampaign = AfterGenius × (1 − Campaign%)

Targeting Discounts (Mobile, Country Rate)

FinalSellRate = AfterCampaign × (1 − Targeting%)

Exclusive Deep Deals

If active, this fork overrides the Level 2 stack:

FinalSellRate = AfterNonRef × (1 − DeepDeal%)

3.2 Daisy-Chain Differential Engine (Room Type Hierarchy)

For derived room types:

DerivedRate = BaseRate × (1 + Differential%)

Base room type (base_room_type_id) is skipped to avoid double pushes.

Differential configuration is stored in sentinel_configurations under “rules”.

3.3 Guardrails

Min Rate

EffectiveRate = max(CalculatedRate, MinRate)

MinRate is resolved per-day with the following priority:

1. Daily min override (sentinel_daily_min_rates) — if a per-day override exists, it wins.
2. Monthly min rate (sentinel_configurations → monthly_min_rates) — fallback default.

Last-save-wins semantics: When monthly min rates are saved, all daily min overrides for the affected months are automatically deleted so the new monthly value takes effect. When per-day overrides are later set, they take precedence over the monthly default. If autopilot is enabled, saving monthly min rates triggers an immediate recalculation and PMS push.

Daily min overrides can be set in two ways from the **admin Rate Manager** UI (`RateManagerView.tsx`):

- Editing the Min Rate row directly for a specific date.
- Entering a PMS Override or Target Sell Rate below the current min — the system auto-lowers the daily min to match and shows a red warning toast.

**Editing min rates is admin-only.** As of April 2026, the My Rates page (`HotelRateWindow.tsx`) renders the Min Rate row read-only, and `POST /api/sentinel/min-rates/:hotelId` returns 403 for non-admin roles even though the path is in the rates-view whitelist. The auto-lower-min side effects on the Effective Sell Rate / PMS Override handlers were also removed from My Rates: a non-admin who types an override below the min now gets a warning toast (no save) and is told to ask an admin to adjust the min rate. The admin Rate Manager retains the full set of behaviours described above.

When a daily min override is below the monthly default, the UI signals this clearly:

- The Min Rate cell turns red with a red bottom border.
- The entire column for that date gets an amber tint across all rows.
- A tooltip on the cell shows the monthly default for reference.

To revert a daily override, clear the min rate cell (empty input) — it reverts to the monthly default.

Max Rate

EffectiveRate = min(EffectiveRate, MaxRate)

MaxRate is resolved per-day with the following priority:

1. Daily max override (sentinel_daily_max_rates) — if a per-day ceiling exists, it wins.
2. Global max (sentinel_configurations → guardrail_max) — fallback default.

**Caps apply to the BASE room only.** Once the base is set (and clamped to Min/Max), derived room rates are computed via differentials and **are allowed to exceed the daily max**. This is intentional — it preserves the price hierarchy between room types (e.g. Jacuzzi at base × 1.65 must remain meaningfully above Double). The daily ceiling is a cap on the base, not a hotel-wide ceiling on every room. The historical phrasing "guardrails apply after differential calculations" is wrong and was the source of the 2026-04-10 Durrant House incident — see §4.5.

3.4 Freeze Windows

If freeze_period = N:

Freeze applies to days 0…N (inclusive) relative to “today”.

Frozen days preserve PMS live rate.

Freeze has priority over most other adjustments.

3.5 Last-Minute Floors (LMF)

If last_minute_floor = K:

LMF applies to days 0…K (inclusive).

For those days, the calculated rate is overridden by a floor (guardrail) unless the freeze window covers that day (freeze wins).

3.6 Mapping Logic (room_type → rate_id)

Stored in the facts portion of sentinel_configurations:

Base Room Type.

Derived Room Types.

Rate Plan → Room Type mapping for base plan selection.

Mapping is used to attach correct PMS rate IDs to override payloads (bridge between config and Cloudbeds).

**rate_id_map (load-bearing — read this before touching mapping code).** `sentinel_configurations.rate_id_map` is `{ roomTypeID: rateID }`. For Mews hotels, every room typically points at the same rateID (the OTA distribution master plan, e.g. `OTA BASE: Flexible`); for Cloudbeds, one rateID per room. **Valid existing entries are sacred** — three writers (`sentinel.service.js:updateConfig`, `sentinel.service.js:recalculateRates`, `sentinel.router.js:/sync`) apply a **validate-then-fill** self-heal: each existing entry is checked against current `pms_rate_plans` and preserved if the rateID still resolves to a valid plan; stale entries (rate plan deleted in PMS) are dropped so the matcher refills them; new room keys are filled by the matcher. Never re-introduce code that overwrites the entire map from the matcher's output, or you reopen the silent-flip vector that misrouted Belsize for 14 days and Primrose for ~30 hours on 2026-04-23 / 2026-05-06, then **silently re-flipped both overnight on 2026-05-08** because the third writer (`/sync`) was missed in the first patch round. Full incident: `issuemews.md` (repo root) + `claude/sentinel-mews-rate-mapping-2026-05-07.md` (session-local mirror).

**⚠️ DGX is the ONLY pricing engine. The waterfall (`pricingEngine.calculateSellRate`) is VIEW-ONLY.** `previewCalendar` exists for the UI grid's "Sell Rate" column display ("if PMS rate is X, what does Booking.com show after multiplier × discount stack?"). It must NEVER produce values that get pushed to PMS. `recalculateRates` reads `sentinel_ai_predictions.suggested_rate` (DGX output) directly and applies guardrails — the waterfall is not in the write path. If you find yourself wiring `calculateSellRate` as a writer for a "push to PMS now" code path, stop and re-read §3.6 of this Blueprint plus `claude/sentinel-mews-rate-mapping-2026-05-07.md` — that exact misuse created a £40-60 systematic gap between AI predictions and live calendar values for ~5 weeks before it was caught.

**`JSON.stringify` on Postgres JSONB is order-unstable.** The "did this config field change?" comparison in `sentinel.router.js` (config save → setImmediate recalc trigger) sorts keys before stringifying. Don't replace it with naive `JSON.stringify(a) !== JSON.stringify(b)` — Postgres JSONB and JS request body builders return different key orders for byte-identical objects, and the naive comparison fires false-positive full-year recalcs on every config save.

**Control Panel "Rate Plan Mapping" section** (added 2026-05-07): admins can set the rate plan target deliberately. Mews hotels get a single "Distribution Rate Plan" dropdown (one master plan applies to every room); Cloudbeds gets a read-only summary because Cloudbeds rate plan data has no `ratePlanName` field and only ever exposes one non-derived plan per room. When the Control Panel sends an explicit `rate_id_map` in the request body, the backend uses it verbatim (skips the auto-fill). Console logs `[Sentinel] Hotel X: rate_id_map preserved (N existing, M added)` on every config save — any future room additions are visible.

**Audit:** `scripts/audit-fleet-rate-mapping.js` sweeps every active rockenue hotel and flags any base-room mapping whose name doesn't start with `OTA ` (Mews) or matches the Cloudbeds toxic exclude list. Run it as part of any future Sentinel health investigation — the standard health signals (`sentinel_hotel_heartbeat`, `sentinel_job_queue` status) measure activity, not routing correctness, and stayed green for 14 days during the misroute.

3.7 Padlock / Priority Logic

Priority of sources for any given date:

Manual values (locked / padlocked).

Pending (unsaved changes in the UI).

Saved overrides.

AI calculated rates.

If a day is manual in PMS or has a manual override:

System respects the manual value.

AI pushes nothing (no override) for that day.

3.8 Priority Stack (Full Conflict Resolution)

When multiple rules apply to the same date:

1. Manual Padlock / Lock State – manual values always win.
2. Freeze Window – frozen days preserve PMS live rate.
3. Dynamic Rate Cap (The Ceiling) – Max Rate = (Historical 94th Percentile) × 1.30.
4. Last-Minute Floor (LMF) – calculated rate overridden by floor unless frozen.
5. Navigator Strategic Decision – the calculated rate from the pricing engine.

3.9 Dynamic Seasonality Classification

Seasonality is per-hotel, per-month, based on Pricing Power (not hard-coded calendar):

- LOW (Pressure): Month ADR < 90% of Annual Average.
- MID (Guide): Month ADR 90%–102% of Annual Average.
- HIGH (Trap): Month ADR > 102% of Annual Average.

The UI provides a "Seasonality Override" control to force a month into a different tier.

3.10 Rate Stability (The Stopwatch)

- Low Season: Hold rate if HoursSinceLastChange < 12h.
- High Season: Hold rate if HoursSinceLastChange < 24h.
- Velocity Guard (standard mode): Only activates when delta >= 0 (on or ahead of target) AND projected fill (pickup_24h × lead_time) covers remaining rooms. When behind target (delta < 0), rate drops are always allowed regardless of pickup — catch up first, then protect.
- Pickup Brake (sell_every_room mode, added 2026-05-07): re-uses the same `velocity_sufficient` math but fires INSIDE the close-in override block (§3.12 Rule 5 sub-rule (a)) regardless of delta sign. When pickup is filling the hotel anyway, decay holds at current rate instead of dropping further. Reason tag: `Sell Every Room (Hold @ pickup=N)`.
- Noise Filter: £1.00 minimum change threshold. **Bypassed** when `strategy_mode = sell_every_room` AND `lead_time ≤ 3` AND `final_rate < current_rate` — otherwise the filter eats decay micro-drops once steps fall below £1, freezing the rate mid-glide. See `claude/sentinel-decay-fix-2026-05-07.md` §2 Bug 3 for the incident that surfaced this.

3.11 Navigator Zones (3-Zone Safety Protocol)

Zone A – Deep Deficit (Anchor): Current occupancy > 20% behind target. Hard-lock to floor. AI forbidden from raising rates.

Zone B – Momentum (Probe): Behind target but within 10% AND 48h velocity is strong (>5% of capacity). Allow conservative "probe" increase (20% of suggested hike).

Zone C – On-Target (Navigator): Current occupancy >= target. Full yielding logic applies.

3.12 Navigator v6 – Open Sky Model

The engine uses Base + Step proportional ratchet (not min/max interpolation). The Dynamic Max is demoted to a final-stage cap only.

Rule 1 – Base Anchor: Low Season base = Min Rate. Mid/High Season base = Min Rate × 1.50.

Rule 2 – Hibernate Shield: If behind target and outside booking window (>30d weekends, >40d weekdays), hold base rate and ignore negative delta.

Rule 3 – Proportional Ratchet (Up): Positive delta → percentage premium on base. High season 1.5x aggression (e.g., +20% delta → rate increases 30%).

Rule 4 – Deep Deficit Override (Down): Inside booking window and struggling → gentle decay. At −30% or worse → immediate drop to Min Rate.

Rule 5 – Sell Every Room (Close-In Override): If `sentinel_configurations.rules.strategy_mode = "sell_every_room"` AND `lead_time ≤ 3 days` AND occupancy is behind pace target (`raw_delta < 0`), this rule **REPLACES** the standard tree's output (Rules 1–4) for that date. Four sub-rules, evaluated in order:

  - **(a) Pickup Brake**: if `pickup_24h > 0` AND `pickup_24h × lead_time ≥ rooms_remaining`, hold `current_rate`. The hotel is filling itself; further drops would leak revenue. Reason tag: `Sell Every Room (Hold @ pickup=N)`.
  - **(b) Day-of slam (lead=0)**: emit `effective_min` directly. Skips the decay math entirely to prevent the lead=0 oscillation bug (§4.16 / `claude/sentinel-decay-fix-2026-05-07.md` §2 Bug 2). Reason tag: `Sell Every Room (Floor T-0)`.
  - **(c) Decay glide (lead 1/2/3, current > floor)**: exponential decay `current_rate × (effective_min / current_rate)^(1 / hours_remaining)` where `hours_remaining = lead_time × 24`. Reason tags: `Ruthless Decay (T-24h)` / `T-48h` / `T-72h`.
  - **(d) Hold at floor (current ≤ floor)**: emit `effective_min`. Reason tag: `Sell Every Room (At Floor)`.

  CRITICAL field-name note: the engine reads `strategy_mode` from the rules JSONB. The legacy field name `pricing_mode` referenced in pre-2026-05-07 Python code was a dead-end — it was never written by the UI or DB. Any new agent code that adds modes to this rule must read `strategy_mode`. See `claude/sentinel-decay-fix-2026-05-07.md` §2 Bug 1 for the failure mode (28 hotels had the toggle on for months with zero behavioral effect).

  Outside the close-in window OR in `maintain` mode: standard tree (Rules 1–4) applies — unchanged from pre-fix behavior.

4.0 DATABASE SCHEMA (SENTINEL + CONTEXT)
4.1 sentinel_configurations

Single source of truth for Sentinel facts + rules per hotel.

Key fields (conceptual):

hotel_id

facts:

room_types

rate_plans

mappings (room → rate plan, base/derived)

rules:

differentials

guardrails

monthly_min_rates

min_rate, max_rate

rate_freeze_period

last_minute_floor

base_room_type_id

activation flags

Manual inline overrides necessary for UI representation are persisted here when appropriate.

4.2 sentinel_rates_calendar

Stores day-by-day rates for each hotel & room type.

Used as the internal layer for:

Rate history.

AI decisions vs PMS.

UIs (Rate Manager, previews) via service/routers.

Details:

hotel_id

room_type_id

stay_date

rate

source (e.g., AI / MANUAL / IMPORT / SYNC)

Timestamps

4.3 sentinel_job_queue

Queue of pending rate push jobs.

Fields (conceptual):

id (PK)

hotel_id

payload (JSON; usually { pmsPropertyId, rates: [...] })

status – PENDING | PROCESSING | COMPLETED | FAILED

last_error / error_log – text

created_at, updated_at

4.4 sentinel_notifications

User-facing notification store.

Fields (conceptual):

id (PK)

type – ERROR | SUCCESS | INFO

title

message

is_read (boolean)

created_at, updated_at

Writers: (a) Sentinel job worker — inserts ERROR rows on PMS push failures (§4.3 → §4.14). (b) `notifyCommentAdded` in `api/utils/notification.service.js` — inserts an INFO row when a CRM task comment contains `@FirstName` mentions matching `admin`/`super_admin` users (one row per comment, regardless of mention count, with all mentioned names listed in the title). The bell (`web/src/components/NotificationBell.tsx`) polls `GET /api/sentinel/notifications` every 15s. The table is global (no `user_id` column); the bell is admin-only via `AppTopBar`, so this is fine for now — if a second admin needs separate inboxes later, add `user_id` and filter on read.

4.5 sentinel_daily_max_rates

Stores granular daily price ceilings (Dynamic Rate Caps).

Source of truth for "The Ceiling" in the Sentinel pricing logic.

Fields:

hotel_id (PK, Integer)

stay_date (PK, Date)

max_price (Numeric)

is_manual_override (Boolean)

updated_at

**ENGINE TRAP — read this before touching the engine path.**

The DB stores `stay_date` as a real date. The in-memory `daily_max_rates` map that flows into `sentinel.pricing.engine.applyGuardrails` MUST be keyed by ISO date string (`'YYYY-MM-DD'`) — that is what `applyGuardrails` looks up. There is a legacy reader, `sentinelService.getDailyMaxRates`, that returns a `'monthIdx-day'` shorthand (e.g. `'6-15'` for July 15) which exists for the Control Panel UI dialog only. Never feed that map to the engine — the lookup will silently miss every date and the daily cap will fall through to the global `guardrail_max`. Use `sentinelService.getDailyMaxRatesIsoMap` for the engine path.

**Known incident — Durrant House 2026-04-10.** A newly onboarded Cloudbeds property (hotel 318344) was briefly placed on autopilot during onboarding. The hourly DGX cycle suggested base rates that would have been clamped to ~£286 by the 2026-07-15 daily ceiling. Instead, `previewCalendar` was injecting the month-day map into `config.daily_max_rates` and `applyGuardrails` was looking up by ISO date — every lookup missed, every cap fell back to the global £400 `guardrail_max`. With `+65%` Jacuzzi differentials applied on top, derived rooms went out to Cloudbeds at £660 = £400 × 1.65. Fixed by introducing `getDailyMaxRatesIsoMap` and using it inside `previewCalendar`. Also exposed several latent issues to address in follow-ups: `saveDailyMaxRates` still hardcodes year=2025 (creates trash rows), `POST /api/sentinel/overrides` does not capture `changedBy`, and there is no operational guardrail blocking autopilot from being enabled before daily max rates exist for the year ahead — that is the single change that would have prevented this incident regardless of code bugs.

4.6 sentinel_daily_min_rates

Stores granular daily price floors (per-day min rate overrides).

When present, overrides the monthly min rate from sentinel_configurations for that specific date. Used when a revenue manager needs to temporarily lower the floor for a specific day (e.g. distressed inventory) without changing the monthly default.

Fields:

hotel_id (PK, Integer)

stay_date (PK, Date)

min_price (Numeric)

is_manual_override (Boolean)

updated_at

Resolution priority in sentinel.pricing.engine.js → applyGuardrails:
1. Daily min override (this table) — if exists and > 0, used as the floor.
2. Monthly min rate (sentinel_configurations → monthly_min_rates) — fallback.
3. Last-Minute Floor (LMF) — when active, replaces both of the above.

Daily min overrides are also passed to the DGX Python engine via the Bridge context (config.daily_min_rates). The DGX uses the same resolution priority: daily override > monthly default > LMF. The autonomy gates in sentinel.bridge.service.js also respect daily overrides when clamping floors.

API: GET/POST /api/sentinel/min-rates/:hotelId

Migration: api/migration_004_daily_min_rates.js

4.7 daily_bookings_record (Sales Ledger)

Stores individual booking transactions for "Recent Bookings" and granular revenue tracking.

Key fields:

id (PK) - usually Reservation ID

hotel_id

booking_date

check_in_date

room_nights

revenue

status

source

4.7b reservations (Detailed Booking Data)

Stores individual reservation details for the Bookings Report. Populated from PMS webhooks (Cloudbeds, Mews) on every reservation event, plus one-time backfill via `scripts/backfill-reservations.js`.

Key fields:

id (PK, varchar — reservation ID from PMS)

hotel_id (PK, integer — composite PK with id)

guest_name (varchar — Cloudbeds: from API. Mews: requires `customers/getAll` permission, currently blocked)

room_type (varchar — Cloudbeds: from `assigned[0].roomTypeName`. Mews: from `resourceCategories/getAll`)

check_in (date)

check_out (date)

nights (integer)

source (varchar — Cloudbeds: actual OTA name e.g. "Booking.com", "Expedia". Mews: generic origin only e.g. "ChannelManager", "Distributor", "Commander" — see §4.7c)

avg_nightly_rate (numeric)

total_rate (numeric)

status (varchar — confirmed, checked_in, checked_out, canceled)

booking_date (date — when the reservation was created)

created_at, updated_at (timestamptz)

Indexes: (hotel_id, booking_date DESC), (hotel_id, check_in).

Migration: api/migration_006_reservations.js

API: GET /api/hotels/:hotelId/bookings?days=14

UI: Reports Hub → Bookings Report (all users). Daily summary table with expandable accordion showing individual bookings per day. Cancelled bookings excluded from ADR/revenue totals, sorted to bottom. Dashboard Recent Bookings widget links to full report via "View Full Report" button.

Also consumed by: Reports Hub → **Source Report** (all users, added 2026-05-07). Aggregates `reservations` by `LOWER(TRIM(source))` over a booking-date window and surfaces Bookings, Room Nights, Revenue, % of Revenue, ADR, ALOS, Avg Lead, Cancel %. NULL/empty source bucketed as `(no source)`. Display name uses `mode() WITHIN GROUP (ORDER BY source)` so case-variant rows (`Booking.com` vs `booking.com`) collapse but keep the most-frequent original casing. Cancelled reservations counted in Bookings/Cancel% only — excluded from revenue, room nights, ADR, ALOS, Avg Lead. Endpoint: `GET /api/hotels/:hotelId/source-report?start=&end=` (see §5.3).

4.7c Mews Scope Limitations (as of April 2026)

The current Mews integration (`MEWS_CLIENT_TOKEN`) lacks permissions for:

- `customers/getAll` — needed for guest names. Without this, `reservations.guest_name` is NULL for all Mews hotels. The UI falls back to showing the reservation ID.
- `sourceAssignments/getAll` — needed to resolve OTA names. Without this, `reservations.source` shows generic Mews origin values: "ChannelManager" (= OTA booking), "Distributor" (= Mews Booking Engine / direct), "Commander" (= manual entry). The actual OTA name (Booking.com, Expedia) is not available.

To fix: enable these permissions in the Mews Marketplace integration settings. No code changes needed — the backfill script and webhook handler already handle both fields when data is available.

4.7 sentinel_pace_curves

Stores the 365-day booking pace targets for different seasonality tiers.

Key fields:

id (PK)

hotel_id

season_tier (low | mid | high)

curve_data (JSON/Array of numbers 0-100)

created_at

4.8 Other Market Pulse Tables (Relevant to Sentinel)

Sentinel reads from / relies on:

hotels (includes is_disconnected BOOLEAN — soft disconnect flag, added April 2026; locked_years JSONB — see below)

**`hotels.locked_years` is a SOFT lock.** JSONB array of year strings (e.g. `["2024","2025"]`) set by historical import scripts (`scripts/import-daily-history.js`, `scripts/import-monthly-history.js`, `scripts/rescale-shreeji-history.js`) to protect hand-imported historical `daily_metrics_snapshots` from being overwritten on re-sync. Only `initial-sync.js:50` honors it — that path will skip deletion of the listed years. **`webhooks.router.js` and `daily-refresh.js` do NOT check `locked_years`**, so a retroactive Cloudbeds/Mews webhook modification for a stay_date inside a locked year will still mutate the row via the `+= delta` pattern in `webhooks.router.js:278-283`. In practice rare (webhooks fire on new reservations, not retroactive past-date edits), but worth knowing before trusting the lock as absolute. If airtight protection is ever needed, add a `locked_years` guard to the webhook upsert.

users

user_properties

daily_metrics_snapshots

market_availability_snapshots

hotel_budgets

rockenue_managed_assets (calculator settings, multipliers, Genius %, etc.)

Helpers: magic_login_tokens, user_sessions, etc.

4.8b User Access & Permissions Model

Users Table Key Fields:

user_id (PK, integer) — internal ID.

cloudbeds_user_id (varchar) — session identifier. For invited users: "invited-{hash}". For Cloudbeds OAuth users: numeric Cloudbeds ID. For Mews manual users: "mews-{id}-{hash}" or "manual_{name}".

role — super_admin | admin | owner | user. Controls which API middleware gates pass.

can_view_rates (boolean, default false) — enables My Rates page access for non-admin users. Added April 2026.

User Properties Table (user_properties):

Links users to hotels. user_id column stores the cloudbeds_user_id string (NOT the integer user_id).

The /api/hotels/mine endpoint checks: up.user_id = cloudbeds_user_id OR up.user_id = internal_user_id::text.

CRITICAL: If a user has zero rows in user_properties, they see zero hotels on the dashboard. There is no fallback.

Access Granting Flow:

Invitation (auth.router.js /accept-invitation): Creates user + one user_properties row for the property_id on the invitation.

Grant Access (users.router.js /link-property): Inserts user_properties row using cloudbeds_user_id (not integer user_id).

When granting access to multiple hotels, each hotel needs its own user_properties row.

My Rates Access (can_view_rates):

The My Rates page (HotelRateWindow) requires both: (a) user_properties rows for each hotel, AND (b) can_view_rates = true on the users record.

Sentinel endpoints (/api/sentinel/*) are behind a blanket requireAdminApi middleware. A router.use() bypass at line 225 of sentinel.router.js intercepts specific read-only paths (preview-rate, pms-property-ids, predictions, pace-curves, min-rates, rate-overrides) and allows users with can_view_rates through via requireRatesAccess middleware. The whitelist is path-based and method-blind, so writes on whitelisted paths must enforce admin-only access inline if needed — `POST /min-rates/:hotelId` does this (admin-only despite the path being whitelisted for GET); `POST /rate-overrides/:hotelId` is intentionally available to rate-viewers because pinning a per-day rate is a user action, not an admin one.

Demand Radar (opened April 2026): accessible to all roles. The UI lives inside SentinelHub but its data comes from /api/market/* (already user-accessible), not /api/sentinel/*. SentinelHub's useAllHotels hook originally only called admin-only /api/hotels — non-admins received a 403, the error body was mistakenly stored as the hotel list, and downstream .map() calls crashed under the misleading "Update Required" boundary. The hook now tries /api/hotels first and falls back to /api/hotels/mine on 403, landing an Array in state either way. Apply the same dual-endpoint fallback if any other SentinelHub sub-view is opened to non-admins in future.

**Same trap, second occurrence (2026-05-06, commit `b829305`).** `MonthlyTakingsReport.tsx` (Reports Hub → Monthly Takings) called the admin-only `/api/hotels` directly to populate its hotel selector. For non-admin owners (e.g. Sanchit @ Shreeji, role=`owner`, 12 properties linked) this returned 403, the array guard turned the error response into `[]`, and the selector rendered empty under a "Select hotels for group audit" header — the user couldn't pick anything to audit. Fixed with the same `/api/hotels` → `/api/hotels/mine` fallback. Field mapping also extended to read `h.property_id` because `/api/hotels/mine` returns `property_id` rather than `id`/`hotel_id`. **General rule: any UI surface that admins and non-admins both reach must use the dual-endpoint pattern; a single `/api/hotels` call will silently break for the non-admin half. Audit other Reports Hub / Sentinel screens for this when convenient.**

**Property-dropdown trap, third occurrence — different root cause (2026-05-07, commit `36e869a`).** `/api/hotels/mine` filtered the dropdown with `WHERE prospect_status IS NULL` to keep Sales CRM prospect rows out of the property selector. The intent was right but the predicate was too narrow: the Sales CRM lifecycle (`api/services/sales-crm.service.js:7` — `["cold","studied","outreached","in_conversation","proposal","signed","live","lost","churned"]`) tags signed/onboarded customers as `'live'` once they go operational, so out of 65 rows in `hotels`, 39 were `'live'` (real Cloudbeds + Mews properties), 22 were `'cold'`, 1 was `'proposal'`, and only 3 were `NULL` (legacy pre-Sales-CRM rows). The `IS NULL` filter excluded all 39 live properties along with the prospects, leaving super_admin with a 2-hotel dropdown (Haringey + Willows — the only NULL-tagged real hotels not also disconnected). The fix widens the predicate in both query branches (admin and user) to `(prospect_status IS NULL OR prospect_status = 'live')`. **Lesson: when filtering against any lifecycle column whose canonical values are owned by another module, never write `IS NULL` as shorthand for "real / non-prospect" — whitelist the customer-facing states explicitly.** The Sales CRM exposes prospects through its own `/api/sales/prospects` endpoint, which is the only place the rest of the lifecycle states should surface.

/api/hotels/assets is also gated — rate-view users only see assets for their linked hotels.

To enable a user for My Rates: toggle "Rate Access" in **Admin → User Management** (admin-only table directly under Hotel Management). The toggle calls `PATCH /api/users/:id/rates-access`. SQL fallback: `UPDATE users SET can_view_rates = true WHERE user_id = {id};`. Note: granting rate access alone is not sufficient — the user also needs a `user_properties` row for each hotel they need to view. The User Management table surfaces a "Properties" column so admins can spot users with `can_view_rates = true` but `0` linked properties.

Known Issue (April 2026): Many invited users created before April 2026 had zero user_properties rows — their property links were either never created or lost. This was discovered when investigating why Ilkin (ilkin@vilenza.com) could not see hotels. The fix was manual INSERT into user_properties for affected users.

4.9 sentinel_ai_predictions

Stores "Shadow Mode" rate suggestions from the External AI.

Fields:

hotel_id, room_type_id, stay_date (Composite Unique Key)

suggested_rate (Numeric)

confidence_score, reasoning, model_version

is_applied (Boolean) – True if user accepted the suggestion.

4.10 sentinel_market_events

Stores market-level event multipliers to preemptively inflate AI base rates.

Event Tiers (UI dropdown values):
- Medium: 1.5x — moderate demand events
- High: 2.0x — strong demand events
- Extreme: 2.5x — peak events (e.g. Wimbledon)

Effect: Base Rate = Min Rate × Event Multiplier. The AI yields up from this inflated floor.

Fields:

id (PK, UUID)
market_slug (varchar)
event_date (date)
event_name (varchar)
impact_multiplier (numeric)
created_at (timestamptz)

4.13 deleted_hotels_archive

Metadata preservation table for hotels that have been purged from the platform. Allows future joins against orphaned `daily_metrics_snapshots` rows (which outlive the hotel on purpose — see note below).

Fields:

hotel_id (PK, integer)
property_name (text)
city (text)
country (text)
total_rooms (integer)
latitude (numeric)
longitude (numeric)
pms_type (text)
pms_property_id (text)
management_group (text)
deleted_at (timestamptz, default NOW())
deleted_reason (text)

Migration: api/migration_007_deleted_hotels_archive.js. This migration also drops the FK `daily_metrics_snapshots.hotel_id → hotels.hotel_id` so time-series data survives hotel offboarding by design.

Purge pattern (manual only, as of 2026-04-20): Use `scripts/purge-external-hotels.js` to fully remove an external hotel while retaining `daily_metrics_snapshots`. The script archives metadata → wipes all other hotel-scoped tables (reservations, pacing_snapshots, sentinel_*, bookings, comp sets, user links, rockenue asset, hotels row) → leaves daily_metrics_snapshots in place. Transactional; rolls back on any failure. Re-onboarding is clean because the `hotels` row is gone (no FK collision on OAuth callback).

Known divergence: `POST /api/hotels/delete` (hotel.service.js:deleteHotel) still hard-deletes `daily_metrics_snapshots` for the target hotel. The admin-triggered endpoint is intentionally destructive for "offboarding our own hotel" cases; the script is the manual pattern for "external hotel that shouldn't have been here but whose market data is worth keeping". If both flows should preserve metrics in future, remove the `DELETE FROM daily_metrics_snapshots` line in hotel.service.js:387.

4.14 sentinel_hotel_heartbeat

One row per hotel. Records the last successful rate push and the last failure so the admin Sentinel Health surface can derive status in a single lookup instead of scanning `sentinel_job_queue`.

Fields:

hotel_id (PK, integer)
last_success_at (timestamptz)
last_success_rates_count (integer) — size of the payload.rates array for the most recent successful push
last_failure_at (timestamptz)
last_failure_error (text, first 500 chars)
last_failure_job_id (uuid)
consecutive_failures (integer, default 0) — reset to 0 on every real success
updated_at (timestamptz, default NOW())

Migration: `api/migration_011_sentinel_heartbeat.js`.
Backfill: `scripts/backfill-sentinel-heartbeat.js` (idempotent; seeds from `sentinel_job_queue`).

Writer: `api/routes/sentinel.router.js → writeSentinelHeartbeat()`, called from `runBackgroundWorker` after each job completes. Two deliberate design choices:

1. Writes go through the pg pool directly (not the worker's transaction client). Heartbeat writes are isolated from the job-processing transaction so a heartbeat failure cannot poison rate pushes.
2. Any error inside `writeSentinelHeartbeat` is caught and only logged. Observability must never break the thing it is observing.

**What counts as a "success" — load-bearing.** COMPLETED job with `payload.rates.length > 0`. SKIPPED jobs (disconnected hotels, or "all rates filtered out by safety checks") are NOT a success — heartbeat does not advance on them. This is the one definition behind every colour on the Health page; changing it changes the meaning of every downstream signal.

**Freshness SLA (derived, not stored per-hotel).**
- Autopilot ON → 4h (240 min)
- Autopilot OFF but Sentinel configured → 24h
- Disconnected or not rockenue-managed → status = `off` regardless of SLA

**Status derivation (same CASE is used by all three `/health/*` endpoints):**
- `off` — disconnected, not rockenue-managed, or no heartbeat row yet
- `red` — `last_success_at` older than SLA, OR `consecutive_failures >= 3`
- `amber` — within SLA but `last_failure_at > last_success_at` (most recent event was a failure)
- `green` — within SLA, no recent failure

Not to be confused with `sentinel_notifications` (§4.4) which is a user-facing alert feed. The heartbeat table is a per-hotel state snapshot for monitoring; notifications are individual events surfaced in the UI bell.

4.15 sentinel_rate_overrides — canonical override model

Single source of truth for "the user pinned this price". One row per (hotel_id, stay_date) at the **base room only** — derived rooms are fanned out via `room_differentials` at write time and at every hourly bridge re-push.

Fields:

hotel_id (PK, integer)
stay_date (PK, date)
base_override_price (numeric, NOT NULL, > 0)
set_by (integer, nullable — internal user_id of the original saver)
set_at (timestamptz, default NOW())
updated_by (integer, nullable)
updated_at (timestamptz, default NOW())

**Rules — load-bearing.**

- A row in this table means **AI is forbidden from touching that date** until the row is deleted. No re-yielding, no decay, no autopilot writes — period. This is the only protection model. Calendar `source = 'MANUAL' / 'AI_SUGGESTED' / 'HOTEL_USER'` is **not** protected and autopilot will overwrite it (see `sentinel.bridge.service.js:596`).
- The override price is the **base** price. Derived room rates are computed via the hotel's `room_differentials` rules whenever the override is applied or re-pushed. Never store derived rates in this table.
- No guardrail clamp. A user typing £0.01 (or anything > 0) goes through verbatim — guardrails only apply to engine-computed rates, not pinned ones.
- Past dates rejected at the service layer (`saveRateOverrides` validates `stay_date >= CURRENT_DATE`).

**Write paths (single endpoint):**

`POST /api/sentinel/rate-overrides/:hotelId` → `sentinelService.saveRateOverrides()` → upserts the override row, fans out base × differentials, queues PMS push. Used by every save in the UI — both user-typed values and AI-accepted suggestions go through here. There is no other write path.

**Read paths:**

- `GET /api/sentinel/rate-overrides/:hotelId?start=&end=` — used by `useRateGrid.ts` to populate the "Override" badge column.
- Bridge Phase 2 (`sentinel.bridge.service.js:549`) loads the date set into a `Set<string>` and skips any matching prediction — no engine writes for those dates.
- `previewCalendar` in `sentinel.service.js:945-951` does the same skip in the manual `recalculateRates` path so "Re-Push Rates" never overwrites pins either.
- `sentinel.bridge.service.js:875-944` — hourly safety-net re-push: emits the pinned base price (+ derivatives) for every active override row to PMS each cron tick. Catches drift if someone edits the rate directly in Cloudbeds/Mews between cycles.

**Calendar protection (belt-and-braces):**

Every SQL path that writes `sentinel_rates_calendar` with `source = 'SENTINEL'` is wrapped in `NOT EXISTS (SELECT 1 FROM sentinel_rate_overrides ...)`. See `sentinel.bridge.service.js:856` (Phase 2 calendar update) and `sentinel.service.js:1032` (recalculate fan-out). These guards run regardless of the in-memory skip — even if a race opens between override save and the next bridge cycle, the DB-level guard prevents the calendar from being silently re-tagged as SENTINEL.

Migration: `api/migration_010_sentinel_rate_overrides.js` (table) + companion `sentinel_price_history` writes for audit.

**KNOWN INCIDENT — silent UI fallback, Park Hotel 2026-04-28.**

This is the canonical example of why "engine respects override rows" is necessary but not sufficient. Read this entire entry before touching any override code.

Two override storage layers existed in parallel by accident:

1. `sentinel_rate_overrides` — the new persistent-pin model (this section).
2. `sentinel_rates_calendar.source = 'MANUAL'` — the legacy "save a rate" path. Visible in the grid, not protected by the bridge.

Commit `5177dcf` (2026-04-26) shipped a fix titled "respect PMS overrides in recalc + debounce autopilot misfires". The fix correctly added the override skip to `previewCalendar` and `recalculateRates`, and the DB-level NOT EXISTS guard. It was tested against the engine path. **It was not tested against every UI save path.**

What 5177dcf left intact:

- A feature flag `SENTINEL_OVERRIDES_ENABLED` plus a per-hotel `SENTINEL_OVERRIDES_HOTEL_ALLOWLIST` env var, which gated whether `/api/sentinel/rate-overrides/:hotelId` was active for a given hotel. If the hotel was outside the allowlist, the new endpoint returned **HTTP 503 "Overrides not enabled for this hotel"**.
- A silent catch in the React save handler (`web/src/features/sentinel/hooks/useRateGrid.ts:504-522`) that, on any 503 from the new endpoint, **silently retried against the legacy `POST /api/sentinel/overrides`** — which writes calendar `source = 'MANUAL'` only and never inserts into `sentinel_rate_overrides`. No error toast. The user saw a normal "Updates Queued" success.

Symptom on Park Hotel (318326):

- 2026-04-24: user pinned tonight (2026-04-28) at £54 via the new model. Row landed in `sentinel_rate_overrides`. Bridge respected it for 4 days.
- 2026-04-28 11:57:26 UTC: bridge Phase 2 nonetheless pushed £69 (engine price = £54 × 1.28) to PMS for tonight. Job `99dd62bf` — single-date, 7 rates, off-cycle (between :00 cron ticks). The override-skip at `sentinel.bridge.service.js:580` is gated on `overridesEnabledForHotel`; the loader at line 549 caught the silent-fallback warning path and left `phaseOverrideDateSet` empty, so the skip didn't fire. Engine prices reached PMS for ~3 minutes until the next :00 re-push restored £54.
- 14:08:43: user re-saved £65 via the UI (thinking they were re-applying the override). The save hit the new endpoint, got 503 because Park wasn't in the allowlist, fell back to legacy `/overrides`, which wrote calendar `source = 'MANUAL'` for the base room. The override row in `sentinel_rate_overrides` was **untouched** and still said £54. The grid badge read "SENTINEL" instead of "Override" because the badge logic correctly reads from `sentinel_rate_overrides` — there was no row at £65.
- Outcome: two competing prices, two storage layers, the hourly bridge re-push would have pushed £54 (table truth) at the next 15:00 tick and overwritten the user's intended £65.

Why the previous AI's fix didn't actually fix it:

5177dcf protected **rows that exist in `sentinel_rate_overrides`** from the engine. It did nothing about **the silent fallback that prevented rows from being written in the first place** when the allowlist excluded a hotel. The protection was sound; the problem was upstream — saves were quietly downgrading to a path with no protection, and the UI lied about success. A reviewer testing override-protection on a hotel inside the allowlist saw it work; a reviewer testing on Park (outside the allowlist) saw "Updates Queued" and a MANUAL pin but no override row, and likely assumed that was correct because the allowlist was deliberately partial during the rollout.

The fix in commit `32cd8fe` (2026-04-28) — what shipped:

1. Deleted `api/utils/sentinelFlags.js`. The flag is gone, every hotel gets the override model.
2. Removed every `if (overridesEnabledForHotel)` gate in `sentinel.bridge.service.js` (overlay loader, Phase-2 skip, hourly re-push). All three paths now run unconditionally fleet-wide.
3. Removed the `503 "not enabled"` branches in `POST/GET/DELETE /api/sentinel/rate-overrides/:hotelId`.
4. Deleted the legacy endpoints `POST /api/sentinel/overrides` and `POST /api/sentinel/hotel-overrides`. Calls to them now return 404. The calendar-MANUAL path is permanently gone.
5. Deleted `sentinelService.buildOverridePayload` (only legacy callers).
6. Removed `submitOverrides` from `web/src/features/sentinel/api/sentinel.api.ts`.
7. Rewrote `useRateGrid.ts:submitChanges` as a single call to `saveRateOverrides`. No split between user-typed and AI-accepted, no fallback, no silent downgrade. Errors surface as a toast with the real message. Optimistic UI sets `source: 'OVERRIDE'` on the affected dates.
8. Dropped `SENTINEL_OVERRIDES_ENABLED` and `SENTINEL_OVERRIDES_HOTEL_ALLOWLIST` from Railway env.

Why every save now persists:

The only save path the UI exposes (`saveRateOverrides`) writes directly to `sentinel_rate_overrides`. The bridge's hourly re-push iterates that table unconditionally. The bridge's autonomy gate skips any date in that table unconditionally. The calendar's NOT EXISTS guard refuses to overwrite a SENTINEL cell when an override row exists. There is no longer an alternative path that produces a "saved rate" without a protected row.

Latent state at deploy time (intentionally not migrated):

7 hotels had stale `MANUAL` / `AI_SUGGESTED` calendar pins from the silent-fallback era — 512 dates total across Whitechapel Grand, London Suites, Lancaster Court, Maiden Oval, Hyde Park Green, The Barkston, and Mason & Fifth Westbourne (1 date). On the user's instruction these are **not promoted** to override rows. Sentinel will overwrite them on the next yielding cycle, which is the expected behaviour going forward — those dates will be re-priced by AI unless the user re-pins them through the UI. Mason & Fifth Primrose Hill (318343) had 277 such pins and is also explicitly not migrated.

Lessons for any AI editing override code:

- "The engine respects override rows" is necessary but not sufficient. Verify every UI save path produces a row before claiming the override model works.
- A 503 returned by a feature-flagged endpoint is not a benign "feature disabled" signal — if a UI catches it silently and retries against a different storage layer, you have two competing sources of truth and the user can't see the divergence.
- Calendar `source = 'MANUAL'` is **not** an override. It is a one-shot rate write that autopilot will overwrite. If you see code or docs treating MANUAL as protected, that is a bug.
- Before shipping any "fix" to override behaviour, run the full save flow on a hotel that is **not** in any allowlist and verify the row lands in `sentinel_rate_overrides`. If it doesn't, the fix isn't done.

4.11 Schema Traps

CRITICAL: hotel_id is INTEGER across all tables. room_type_id is MIXED TYPE — INTEGER in sentinel_ai_predictions but TEXT (VARCHAR) in sentinel_rates_calendar. When writing UNNEST arrays or cross-table JOINs, always cast room_type_id to text (e.g., room_type_id::text = ANY($2::text[])). Never cast to $X::int[] when touching the calendar table.

4.12 Debug Queries

"Why did the AI pick this price?"

SELECT stay_date, suggested_rate, reasoning, is_applied, created_at
FROM sentinel_ai_predictions
WHERE hotel_id = {{ID}} AND stay_date = '{{DATE}}'
ORDER BY created_at DESC LIMIT 5;

"Last 5 PMS pushes for a date:"

SELECT created_at, status, last_error,
(SELECT x.rate FROM jsonb_to_recordset(payload->'rates') AS x(date text, rate float) WHERE x.date = '{{DATE}}' LIMIT 1) as rate_sent
FROM sentinel_job_queue
WHERE hotel_id = {{ID}} AND payload->'rates' @> '[{"date": "{{DATE}}"}]'
ORDER BY created_at DESC LIMIT 5;

"Who owns this date?"

SELECT stay_date, rate, source, last_updated_at
FROM sentinel_rates_calendar
WHERE hotel_id = {{ID}} AND stay_date = '{{DATE}}';

5.0 API REFERENCE (ACTIVE ENDPOINTS ONLY)

Important:
Endpoint lists here are authoritative; do not invent new routes.
For request/response shapes, follow existing implementations.

5.1 Sentinel Endpoints (/api/sentinel)

All Sentinel routes are admin-only (protected by requireAdminApi) and interact only with Sentinel services/adapters.

POST /preview-rate

Body: { hotelId, baseRoomTypeId, startDate, days? }

Uses sentinel.service.previewCalendar(...) to generate a calendar of live vs AI vs guardrails.

GET /pms-property-ids

Returns map { [hotelId]: pms_property_id } for Rockenue-managed hotels.

GET /configs

Returns all rows from sentinel_configurations for control panel overview.

GET /config/:hotelId

Returns single config for the given hotelId.

POST /config

Creates or updates configuration (facts + rules) for a hotel.

POST /rate-overrides/:hotelId

Body: { overrides: [{ stayDate: "YYYY-MM-DD", price: number }, ...] }

The single canonical save path for any user-pinned rate (typed OR AI-accepted). Delegates to `sentinelService.saveRateOverrides()` which upserts rows into `sentinel_rate_overrides` (§4.15), fans out base × differentials, and queues the PMS push. Past dates and non-positive prices are rejected at the service layer; partial-success returns 202 with `{saved, queued, rejected}`. Access: admin or `can_view_rates` (POST is intentionally available to rate-viewers — pinning is a user action, not an admin one).

GET /rate-overrides/:hotelId?start=&end=

Returns the active override rows for the hotel in the given date range. Used by `useRateGrid.ts` to populate the "Override" badge column.

DELETE /rate-overrides/:hotelId

Body: { dates: ["YYYY-MM-DD", ...] }

Removes override rows. After delete, the next bridge cycle is free to re-yield those dates.

**Removed in commit `32cd8fe` (2026-04-28):** legacy `POST /overrides` and `POST /hotel-overrides`, plus the `SENTINEL_OVERRIDES_ENABLED` feature flag. See §4.15 incident notes — those endpoints wrote calendar `source = 'MANUAL'` only and were the silent-fallback path that broke override protection. Any caller still hitting them gets 404.

POST /process-queue

Manual/cron worker trigger.

Calls internal runBackgroundWorker():

Locks PENDING jobs.

Calls sentinel.adapter.postRateBatch(...).

Updates job statuses.

Inserts notifications on failures.

GET /rates/:hotelId/:roomTypeId

Combines:

Local sentinel_rates_calendar.

Live PMS rates from sentinel.adapter.getRates(...).

Returns 365-day calendar including:

date, rate, source, liveRate.

GET /notifications

Returns up to 20 most recent rows from sentinel_notifications.

POST /notifications/mark-read

Optionally accepts ids array.

GET /health/fleet/summary

Returns `{ green, amber, red, off, worst_status }` aggregated across all rockenue-managed hotels. Used by the admin-only sidebar Sentinel status dot. Cheap (one GROUP BY query).

GET /health/fleet

Returns `{ fleet: FleetHealthRow[], sparklines: SparklineMap, clusters: FailureCluster[] }`. One row per rockenue-managed hotel with status, heartbeat fields, 7d failure count, plus a 30-day per-day status map (`{ [hotel_id]: { [YYYY-MM-DD]: "green"|"amber"|"red"|"none" } }`) and failure clusters (last 24h, grouped by error signature — "Mews 403 Conflicting operation", "Auth failure", "Network / timeout", etc.). Used by the Sentinel → Health page.

GET /health/hotel/:hotelId

Single hotel HotelHealth payload. Used by the top-bar Sentinel pill popover.

Marks relevant notifications as read (or entire set).

GET /pace-curves/:hotelId

Returns the Low/Mid/High pace curves for the given hotel.

POST /pace-curves/copy

Body: { sourceHotelId, targetHotelId }

Copies all pace curves from the source hotel to the target hotel (overwriting existing ones).

GET /market-events/:marketSlug

Fetches future market events for a specific city.

POST /market-events

Body: { marketSlug, events: [...] }
Supports bulk inserts of events. Updates existing events on conflict.

DELETE /market-events/:id

Permanently deletes an event by its UUID.

GET /min-rates/:hotelId

Returns per-day min rate overrides from sentinel_daily_min_rates as { "YYYY-MM-DD": price }.

POST /min-rates/:hotelId

Body: { rates: { "YYYY-MM-DD": price, ... } }

Saves per-day min rate overrides. Pass null for a date to revert to monthly default (deletes the row). **Admin-only** — the path is in the rates-view whitelist (so non-admins can still GET), but the POST handler enforces an inline `admin`/`super_admin` role check and returns 403 otherwise. See §3.4.

Rule:
If you need new Sentinel functionality, extend the service and then expose a minimal API route here, instead of embedding logic in the router.
5.2 Webhooks (/api/webhooks)

Receives external PMS events (e.g., reservation/created, reservation/status_changed).

Uses cloudbedsAdapter to fetch details.

Updates daily_metrics_snapshots and related tables in near real-time.

5.3 Domain Routers (Conceptual Contracts)

The exact endpoint list is defined in code; here we keep conceptual domains only:

/api/metrics

Dashboard KPIs.

YoY comparisons.

Portfolio aggregation.

Dynamic report data.

Pacing/pickup metrics.

/api/hotels

Hotel list & details.

Soft Disconnect / Reconnect (added April 2026):

POST /api/hotels/:hotelId/disconnect — sets is_disconnected = true. Data preserved, hotel hidden from dashboards/reports/sentinel. Requires user auth + property access.

POST /api/hotels/:hotelId/reconnect — sets is_disconnected = false. Restores hotel to active state.

GET /api/hotels/mine?includeDisconnected=true — optional param to include disconnected hotels (used by Settings page).

POST /api/hotels/delete — admin only. Hard delete: removes hotel from all tables (including `daily_metrics_snapshots`), notifies Cloudbeds. Irreversible. For external hotels where the historical time-series should be retained, use `scripts/purge-external-hotels.js` instead — see §4.13.

Disconnected hotels are filtered from: /api/hotels/mine (default), daily-refresh.js, sentinel queue worker, comp set fallback queries. Admin /api/hotels (GET /) still shows all hotels with is_disconnected flag.

GET /api/hotels/:hotelId/bookings?days=14

User-accessible (requireUserApi). Returns daily booking summaries with nested individual reservation details for the Bookings Report. Groups by booking_date (when reservation was created). Cancelled bookings excluded from ADR/revenue/room night totals but included in booking count. Details sorted: confirmed first, cancelled last. Falls back to reservation ID when guest name is unavailable (Mews).

GET /api/hotels/:hotelId/source-report?start=YYYY-MM-DD&end=YYYY-MM-DD

User-accessible (requireUserApi). Returns the Source Report payload `{ start, end, sources: [...], totals }`. Each `sources[]` row has `{ source, bookings, cancelled, roomNights, revenue, sharePct, adr, alos, avgLead, cancelPct }`. Grouping is case-insensitive on `reservations.source`; NULL/empty bucket as `(no source)`. Cancelled rows (`status ILIKE '%cancel%'`) counted in `bookings`/`cancelled`/`cancelPct` only — excluded from `revenue`, `roomNights`, `adr`, `alos`, `avgLead`. Totals row weights ALOS and Avg Lead by per-source active bookings. Validation rejects non-ISO dates and `start > end` with 400. See §4.7b for table spec.

Budgets.

Compsets.

Rockenue-managed asset records.

/api/market

Market KPIs & forward view.

Neighborhood & demand segments.

Market intelligence & computed pricing metrics.

Market Profile sub-routes (all requireAdminApi):

GET /profile/overview, /profile/seasonal, /profile/absorption-dow, /profile/price-movement, /profile/compression, /profile/neighbourhoods — existing city-level market structure endpoints.

GET /profile/neighbourhood-intel?city=X — Neighbourhood demand intelligence. Same-date absorption methodology: compares identical checkin_dates at their earliest vs latest scrape observation to eliminate MLOS/manual-listing artefacts. Returns top 20 areas ranked by composite demand score (35% supply depth + 35% absorption rate + 30% rooms absorbed volume). Overlapping Booking.com zones are merged via MERGE_MAP (see below). Booking.com meta-categories (e.g. "Guests' favorite area") are excluded.

GET /profile/neighbourhood-dump?city=X — Raw diagnostic dump of every neighbourhood name Booking.com returns with average property count. Used for debugging area taxonomy and verifying merge map coverage.

Neighbourhood Zone Merge Map (in MarketService.getProfileNeighbourhoodIntel):
Booking.com returns overlapping neighbourhood facets for the same physical area. The MERGE_MAP consolidates these using MAX supply per bucket (not average — the largest count is the most complete view since the same properties appear under multiple labels):
- "hyde park" + "bayswater" → "Bayswater & Hyde Park"
- "west end" + "theatreland" + "oxford street" → "West End & Theatreland"
- "kensington" + "south kensington" + "kensington and chelsea" → "Kensington & Chelsea"
- "central london" → excluded (overlaps with everything)
- "westminster borough" → excluded (overlaps with everything)
When onboarding a new city, review the neighbourhood-dump output and extend the MERGE_MAP if overlapping zones appear.

/api/admin

Internal tools, health checks, manual triggers.

/api/auth / /api/users / /api/support

Login/session, user management, support functions.

Admin-only user management endpoints (added April 2026, see §4.8b):
- `GET /api/users/all` — lists all users with `role`, `can_view_rates`, and per-user `property_count` (count of `user_properties` rows resolved against both `cloudbeds_user_id` and `user_id::text`). Used by the Admin → User Management table.
- `PATCH /api/users/:id/rates-access` — body `{ can_view_rates: boolean }`. Updates `users.can_view_rates`. The only writer for this column; everything else is read-only.

Rule for AI:
When adding features, pick the correct domain router instead of adding ad-hoc routes elsewhere.

5.4 Bridge Endpoints (/api/bridge)

Protected by bridgeAuth (requires x-api-key header).

GET /context/:hotelId

Returns full context for AI decision making:

Inventory (sentinel_rates_calendar + live PMS overlay).

Config (Min/Max rates, Daily Min Overrides, Seasonality, LMF, Rules).

Pace Curves (Targets).

Pickup Velocity (Calculated 24h delta).

Market Events (peak date multipliers).

Price History (last change timestamp per date).

POST /decisions

Accepts JSON array of rate predictions.

Query param: ?mode=preview — shadow save only (no autopilot execution). Used by manual "Run Sentinel" button to show blue dots for user review.

Without mode param: full autopilot execution (Phase 1 shadow save + Phase 2 autonomy gates + PMS queue). Used by hourly cron.

Upserts into sentinel_ai_predictions.

POST /retry-unapplied

Sweeps all is_applied=FALSE predictions for future dates and re-processes them through autonomy gates.

5.5 Mews Onboarding Endpoints (/api/mews)

All Mews onboarding routes are admin-only (protected by requireAdminApi).

POST /test-creds

Body: { accessToken }

Tests Mews credentials by calling configuration/get, services/getAll, resourceCategories/getAll, rates/getAll.

Returns property details, room types, and rate plans without creating any records.

POST /onboard

Body: { accessToken }

Creates hotel + sentinel_configurations records from Mews API data.

Checks for duplicates by Enterprise ID. Sets sentinel_enabled = false.

Stores { accessToken, serviceId, timezone } in hotels.pms_credentials.

5.6 Mews Webhooks (/api/mews-webhooks)

POST /

Receives Mews General Webhook payloads.

Processes ServiceOrderUpdated events:

1. Looks up hotel by EnterpriseId (= hotels.pms_property_id).
2. Fetches reservation details via reservations/getAll/2023-06-06.
3. Fetches revenue via orderItems/getAll with ServiceOrderIds.
4. Updates daily_metrics_snapshots (rooms_sold + gross_revenue).
5. Updates daily_bookings_record (sales ledger).

Production webhook URL: https://www.market-pulse.io/api/mews-webhooks

6.0 ACTIVE FILE TREE (SIMPLIFIED, LOGIC-FOCUSED)

Note:
This tree is intentionally trimmed to remove noise (favicons, shadcn primitives, etc.).
UI primitives under web/src/components/ui and small static assets are not listed.

market-pulse/
├── instrument.js
├── api
│ ├── adapters
│ │ ├── cloudbedsAdapter.js
│ │ ├── mewsAdapter.js
│ │ ├── mews.sentinel.adapter.js
│ │ ├── operaAdapter.js
│ │ ├── pmsRegistry.js
│ │ └── sentinel.adapter.js
│ ├── routes
│ │ ├── admin.router.js
│ │ ├── auth.router.js
│ │ ├── bridge.router.js
│ │ ├── hotels.router.js
│ │ ├── market.router.js
│ │ ├── metrics.router.js
│ │ ├── mews.onboarding.router.js
│ │ ├── mews.webhooks.router.js
│ │ ├── sentinel.router.js
│ │ ├── support.router.js
│ │ ├── users.router.js
│ │ └── webhooks.router.js
│ ├── services
│ │ ├── hotel.service.js
│ │ ├── market.service.js
│ │ ├── metrics.service.js
│ │ ├── sentinel.bridge.service.js
│ │ ├── sentinel.pricing.engine.js
│ │ └── sentinel.service.js
│ ├── utils
│ │ ├── benchmark.utils.js
│ │ ├── bridgeAuth.js
│ │ ├── db.js
│ │ ├── email.utils.js
│ │ ├── emailTemplates.js
│ │ ├── logger.js
│ │ ├── market-codex.utils.js
│ │ ├── middleware.js
│ │ ├── pacing.utils.js
│ │ ├── pdf.utils.js
│ │ ├── report-templates
│ │ │ └── shreeji.template.html
│ ├── daily-refresh.js
│ ├── initial-sync.js
│ ├── migration_001_add_market_metrics.js
│ ├── migration_002_fix_market_metrics.js
│ ├── migration_004_daily_min_rates.js
│ ├── migration_006_reservations.js
│ ├── migration_007_deleted_hotels_archive.js
│ ├── send-scheduled-reports.js
│ └── sync-rockenue-assets.js
├── scripts
│ ├── backfill-reservations.js
│ ├── import-daily-history.js
│ ├── import-monthly-history.js
│ └── purge-external-hotels.js
├── server.js
├── package.json
├── package-lock.json
├── vercel.json
└── web
├── index.html
├── package.json
├── package-lock.json
├── public
│ └── ... (favicons and logo assets omitted)
└── src
├── App.tsx
├── main.tsx
├── index.css
├── styles
│ └── globals.css
├── components
│ ├── CreateScheduleModal.tsx
│ ├── DemandPace.tsx
│ ├── GrantAccessModal.tsx
│ ├── InitialSyncScreen.tsx
│ ├── InviteUserModal.tsx
│ ├── LandingPage.tsx
│ ├── ManageSchedulesModal.tsx
│ ├── MarketVeil.tsx (gates Demand & Compset pages when market has < 5 properties)
│ ├── NotificationBell.tsx
│ ├── PrivacyPolicy.tsx
│ ├── PropertyClassificationModal.tsx
│ ├── SettingsPage.tsx
│ ├── SupportPage.tsx
│ ├── TermsOfService.tsx
│ ├── TopNav.tsx
│ ├── figma
│ │ └── ImageWithFallback.tsx
│ ├── ui
│ │ └── ... (shadcn primitives – omitted)
│ └── sentinel-toast.tsx (and other small shared helpers)
├── features
│ ├── admin
│ │ ├── AdminHub.tsx
│ │ ├── api
│ │ │ ├── admin.api.ts
│ │ │ └── types.ts
│ │ ├── components
│ │ │ ├── CloudbedsAPIExplorer.tsx
│ │ │ ├── HotelManagementTable.tsx
│ │ │ ├── ManualReportTrigger.tsx
│ │ │ ├── MewsOnboarding.tsx
│ │ │ └── SystemHealth.tsx
│ │ └── hooks
│ │ ├── useAdminData.ts
│ │ └── useHotelSync.ts
│ ├── dashboard
│ │ ├── DashboardHub.tsx
│ │ ├── api
│ │ │ └── dashboard.api.ts
│ │ ├── components
│ │ │ ├── DynamicYTDTrend.tsx
│ │ │ ├── HotelDashboard.tsx
│ │ │ ├── MarketOutlookBanner.tsx
│ │ │ ├── OwnHotelOccupancy.tsx
│ │ │ ├── PortfolioOverview.tsx
│ │ │ └── RecentBookings.tsx
│ │ └── hooks
│ │ └── useDashboardData.ts
│ ├── market-intel
│ │ └── MarketIntelHub.tsx
│ ├── reports
│ │ ├── ReportsHub.tsx
│ │ ├── api
│ │ │ ├── reports.api.ts
│ │ │ └── types.ts
│ │ ├── components
│ │ │ ├── BookingsReport.tsx
│ │ │ ├── BudgetReport.tsx
│ │ │ ├── ReportActions.tsx
│ │ │ ├── ReportControls.tsx
│ │ │ ├── ReportSelector.tsx
│ │ │ ├── ReportTable.tsx
│ │ │ ├── ShreejiReport.tsx
│ │ │ ├── SourceReport.tsx
│ │ │ └── YearOnYearReport.tsx
│ │ └── hooks
│ │ ├── useReportData.ts
│ │ └── useScheduledReports.ts
│ ├── sentinel
│ │ ├── SentinelHub.tsx
│ │ ├── api
│ │ │ ├── sentinel.api.ts
│ │ │ └── types.ts
│ │ ├── components
│ │ │ ├── ControlPanel
│ │ │ │ ├── ControlPanelView.tsx
│ │ │ │ ├── PromoConfigSection.tsx (OTA discount stack — merged from Property Hub)
│ │ │ │ ├── DailyMaxRatesDialog.tsx
│ │ │ │ └── YearlyRatesVisualization.tsx
│ │ │ ├── RateManager
│ │ │ │ ├── OccupancyVisualizer.tsx
│ │ │ │ └── RateManagerView.tsx
│ │ │ └── RiskOverview
│ │ │ └── PortfolioRiskOverview.tsx
│ │ ├── hooks
│ │ │ ├── usePropertyHub.ts
│ │ │ ├── useRateGrid.ts
│ │ │ └── useSentinelConfig.ts
│ ├── settings
│ │ ├── api
│ │ │ ├── settings.api.ts
│ │ │ └── types.ts
│ │ ├── components
│ │ └── hooks
│ │ └── useSettings.ts
├── guidelines
│ └── Guidelines.md
└── Attributions.md

7.0 BRAND STYLE GUIDE (UI COLOR SYSTEM)

All UI surfaces must follow this palette. No other hex values should be introduced without updating this section.

7.1 Core Palette

Primary Accent: #39BDF8 (Sentinel Blue) — revenue values, active states, CTA buttons, logo brackets, progress bars, interactive highlights.

Success / Positive: #10b981 — positive trends, check marks, trust indicators.

Warning / Amber: #f59e0b — medium-demand indicators, caution states.

Danger / Negative: #ef4444 — errors, negative trends, high-demand alerts.

Purple (Informational): #8b5cf6 — overbooked indicators, supply change negative.

7.2 Text Hierarchy

White (Primary): #e5e5e5 — headings, body text, table values.

Gray (Secondary): #9ca3af — subtitles, descriptions, muted labels.

Dim (Tertiary): #6b7280 — uppercase labels, timestamps, column headers.

7.3 Surface & Border System

Page Background: #1d1d1c — main content area background.

Card Background: #1a1a1a / rgb(26, 26, 26) — all card surfaces.

Inner Surface (Table Rows): #1D1D1C — table row backgrounds, alternating sections.

Alternate Section Background: #141414 — used for alternating full-width sections (e.g., landing page).

Input / Badge Background: #2C2C2C — form inputs, tags, secondary surfaces.

Border: #2a2a2a — all card borders, table dividers, separators. (NOT #3a3a35, which is deprecated.)

7.4 Background Effects

Grid Overlay: linear-gradient at rgba(57, 189, 248, 0.03) opacity, 64px spacing.

Gradient Wash: linear-gradient to bottom right at rgba(57, 189, 248, 0.01).

7.5 Chart & Data Visualization

Chart Grid: stroke #2a2a2a, opacity 0.5.

Axis Lines / Ticks: stroke #2a2a2a (NOT #3a3a35).

Tooltip Background: rgba(26, 26, 26, 0.95), border #2a2a2a.

Tooltip Cursor: rgba(57, 189, 248, 0.08).

Accent Backgrounds (Icon Badges): rgba(57, 189, 248, 0.15) with #39BDF8 icon.

7.6 Typography Constants

Labels: 10-12px, uppercase, letter-spacing: -0.025em, color #6b7280.

Section Titles: 14-18px, color #e5e5e5, font-weight 600.

KPI Values: 24-32px, color #39BDF8, font-weight 600.

7.7 Logo

Format: ( MARKET PULSE ) — blue brackets (#39BDF8), white text (#e5e5e5).

Font size: brackets 24-32px, text 14-18px, letter-spacing 0.025em.

7.8 Deprecated Colors (Do Not Use)

#faff6a (old yellow primary) — replaced by #39BDF8.

#3a3a35 (old border) — replaced by #2a2a2a.

#262626 (old badge bg) — replaced by #2C2C2C.

#1f1f1c (old inner surface) — replaced by #1d1d1c.

#2a2a25 (old chart grid, greenish) — replaced by #2a2a2a.

#252521 (old page bg) — replaced by #1d1d1c.

8.0 PRESENTATION ADJUSTMENTS (TEMPORARY)

8.1 Market Context Multiplier

The /api/metrics/market-context endpoint applies a 2x multiplier to all returned counts (segment hotels, segment rooms, market hotels, market rooms). This is a deliberate presentation adjustment to reflect broader market maturity while the platform is in its growth phase. This multiplier will be removed once real third-party market data sources (e.g., STR, PredictHQ) are integrated. The multiplier lives in metrics.router.js — search for "Presentation multiplier" to find and remove it.

9.0 ACCOMMODATION MAP (OpenStreetMap / Overpass API)

9.1 Purpose

The Accommodation Supply Map visualises every hotel, hostel, guest house, apartment and motel in a city on an interactive Leaflet map with marker clustering. It is powered by OpenStreetMap data fetched via the Overpass API and cached locally.

9.2 Architecture

Data Source: OpenStreetMap via Overpass API (free, no API key, global coverage).

Cache Table: city_accommodation_pois (city_slug TEXT PK, pois JSONB, fetched_at TIMESTAMPTZ).

Cache TTL: 90 days. On expiry, next request triggers a fresh Overpass query.

Fallback Mirrors: Primary endpoint is overpass-api.de. Falls back to overpass.kumi.systems if primary returns non-200.

9.3 Data Flow

1. User visits Demand & Pace page for a city.
2. Frontend (NeighbourhoodMaps.tsx, lazy-loaded) calls GET /api/market/accommodation-map?citySlug=london.
3. Backend (MarketService.getAccommodationMap in market.service.js) checks city_accommodation_pois cache.
4. Cache hit (< 90 days old): returns cached JSONB array immediately.
5. Cache miss: derives bounding box from hotels table lat/lng for that city. Falls back to hardcoded bbox for London/Las Vegas if no hotel coordinates exist.
6. Queries Overpass API for all nodes/ways/relations with tourism=hotel|hostel|guest_house|apartment|motel within the bounding box.
7. Parses response into array of { name, type, lat, lng, stars }.
8. Upserts into city_accommodation_pois cache (ON CONFLICT updates).
9. Returns result to frontend.

9.4 New City Onboarding

When a hotel from a new city onboards, the map works automatically:
- First visit to Demand & Pace triggers Overpass query for that city.
- Bounding box is derived from the hotel's lat/lng (with 20% padding).
- Result is cached for 90 days.
- No manual coordinate files or per-city configuration needed.

9.5 Frontend Components

NeighbourhoodMaps.tsx (web/src/components/NeighbourhoodMaps.tsx):
- Lazy-loaded via React.lazy() in DemandPace.tsx.
- Uses react-leaflet with CartoDB dark tile layer.
- Marker clustering via react-leaflet-cluster (clusters merge when zoomed out, split when zoomed in).
- Cluster icons styled in brand palette (#39BDF8 accent, translucent backgrounds).
- Dots color-coded by property type (hotel=blue, hostel=amber, guest_house=green, apartment=purple, motel=pink).
- Hover tooltips show property name, type, and star rating.
- Passes type counts up to parent via onTypeCounts callback for the property type treemap.

Property Type Treemap (inline in DemandPace.tsx):
- Pure HTML/CSS treemap (no Recharts SVG — for crisp text rendering).
- Data sourced from the same Overpass POIs as the map (numbers match exactly).
- Monochrome blue palette with opacity scaled by size.
- Labels: uppercase type name, count in accent blue, percentage in muted gray.

9.6 API Reference

GET /api/market/accommodation-map

Query params: citySlug (required, e.g. "london", "las-vegas").

Response: { citySlug, pois: [{ name, type, lat, lng, stars }], fetchedAt, source }.

source values: "cache" (from DB), "overpass" (fresh fetch), "error" (API failed), "no-data" (no bbox available).

9.7 Dependencies

npm packages (web): leaflet, react-leaflet@4, @types/leaflet, react-leaflet-cluster.

External API: Overpass API (overpass-api.de + kumi.systems mirror). Rate-limited — cache prevents repeated hits.

9.8 Database

Table: city_accommodation_pois

- city_slug (TEXT, PK) — e.g. "london"
- pois (JSONB) — array of { name, type, lat, lng, stars }
- fetched_at (TIMESTAMPTZ) — when the Overpass data was last fetched

Migration: api/migration_003_city_accommodation_pois.js

10.0 AIRBNB CODEX (SILOED SIDE PROJECT)

10.1 Purpose

Standalone Airbnb availability scraper for small/rural markets where Booking.com has limited coverage. Currently targets Archanes, Crete. This is a side project — siloed from Market Pulse product, not exposed to end users.

10.2 Architecture

Pure HTTP scraper (no browser/Playwright). Fetches Airbnb search result pages, extracts the embedded JSON from the `data-deferred-state-0` script tag, and parses listing data. No API key or hash maintenance required — reads server-rendered data.

Deployed as a Render cron job. Runs daily at 04:00 UTC.

10.3 File Structure

```
airbnb-codex/
├── index.js          # Main scraper logic
├── utils/
│   └── db.js         # PostgreSQL connection pool (uses market-pulse .env)
├── migration.sql     # Table creation script
└── package.json      # Standalone deps (node-fetch, pg, sendgrid, dotenv)
```

10.4 How It Works

1. Fetches `https://www.airbnb.com/s/<city>/homes?checkin=...&checkout=...` with browser-like headers.
2. Extracts JSON from `<script id="data-deferred-state-0">` embedded in the HTML.
3. Parses listings from `niobeClientData[].data.presentation.staysSearch.results.searchResults`.
4. Paginates via `cursor` query param (base64-encoded offset, up to 5 pages).
5. Extracts per listing: name, type, location, beds, coordinates, rating, reviews, nightly price.
6. Calculates aggregates (avg price, median price, total count).
7. Upserts into `airbnb_availability_snapshots` table.
8. 2-night stays, 90-day forward horizon, 4s delay between dates.

10.5 City Configuration

Defined in `CITY_CONFIGS` object in `airbnb-codex/index.js`:

| City | Slug | Currency | Query |
|------|------|----------|-------|
| Archanes, Crete | archanes | EUR | Archanes--Greece |

Add new cities by adding entries to this object. Run: `node index.js <slug>`.

10.6 Database

Table: `airbnb_availability_snapshots`

- id (UUID, PK)
- city_slug (TEXT) — e.g. "archanes"
- checkin_date (DATE)
- total_listings (INTEGER)
- listings (JSONB) — array of { id, name, type, location, beds, lat, lng, rating, reviews, price }
- avg_price (NUMERIC)
- median_price (NUMERIC)
- scraped_at (TIMESTAMPTZ)
- Unique constraint: one snapshot per city per checkin date per calendar day

Migration: airbnb-codex/migration.sql

10.7 Environment

Uses the market-pulse root `.env` file (loads via `dotenv` with `path: "../.env"`). Requires `DATABASE_URL` and `SENDGRID_API_KEY`.

Render cron job: separate service pointing at market-pulse repo, build command `cd airbnb-codex && npm install`, run command `cd airbnb-codex && node index.js archanes`.

10.8 Key Differences from Market Codex (Booking.com)

| | Market Codex | Airbnb Codex |
|---|---|---|
| Target | Booking.com | Airbnb |
| Method | Playwright browser + proxy | Plain HTTP fetch (no browser) |
| Horizon | 120 days, 1-night | 90 days, 2-night |
| Data | Aggregates only (facets, histogram) | Per-listing + aggregates |
| Hosting | Render (separate repo) | Render (inside market-pulse) |
| Hash/key maintenance | None | None |

Rule for AI: This is siloed from Market Pulse. Do not integrate Airbnb data into the Market Pulse UI or API unless explicitly instructed.

11.0 DGX REMOTE COMPUTING (HYBRID INFRASTRUCTURE)

11.1 Architecture

The system uses Hybrid Execution:

- Frontend & API (Railway): Runs the UI and backend API as a persistent Node.js process.
- Heavyweight Compute (DGX Home Server): Runs the Python pricing engine (sentinel_live.py) on bare metal.
- The Tunnel (Tailscale): Bridges the two securely without port forwarding.

11.2 Connectivity

Flow A (App → DGX): Railway POST → DGX_API_URL env var → Tailscale Funnel (Public HTTPS) → DGX Localhost:5000. Requires dgx-funnel service active.

Flow B (Developer → DGX): Direct SSH via Tailscale mesh (100.x.x.x CGNAT IP). Host block: sentinel-hawaii in ~/.ssh/config, HostName 100.66.138.7, User sentinel.

11.3 DGX Services

Service A – Pricing Engine (sentinel.service): Runs python3 sentinel_live.py. Logs: journalctl -u sentinel.service -f.

Service B – Public Tunnel (dgx-funnel.service): Runs /usr/bin/tailscale funnel 5000. Auto-restarts on crash.

11.4 Cron Schedule (DGX)

DGX server timezone is **CEST (UTC+2 in summer, UTC+1 in winter)** — cron times are local, not UTC. Convert when correlating with `sentinel_*` table timestamps which are UTC.

| Cron (DGX local) | UTC equivalent (summer) | Script | Purpose |
|---|---|---|---|
| `0 * * * *` | `0 * * * *` (hourly, top of hour) | `/home/sentinel/sentinel-training-hub/trigger_all.py` | Sentinel Run — DGX yield engine, generates predictions for every rockenue hotel, uploads via `POST /api/bridge/decisions`. Fire-and-forget per hotel. |
| `0 5 * * *` | `0 3 * * *` (03:00 UTC daily) | `/home/sentinel/sentinel-training-hub/sync_fleet.py` | Fleet Sync — POSTs to `https://www.market-pulse.io/api/sentinel/sync` for every `is_rockenue_managed = true` hotel. Refreshes `pms_room_types`, `pms_rate_plans`, `rate_id_map`, hydrates `sentinel_rates_calendar` with live PMS rates as `source = 'SYNC'`. Uses `x-internal-secret` header (env var `INTERNAL_API_SECRET`) to bypass session auth. |

**`sync_fleet.py` is the most aggressive automated writer of `sentinel_configurations.rate_id_map` in the system** — it iterates 36+ hotels nightly and rebuilds the map via the matcher when no `selectedRateId` is provided. Before 2026-05-08 the `/sync` route's INSERT...ON CONFLICT...DO UPDATE was a pure overwrite, which silently re-flipped Belsize+Primrose to `Mid Stay 29-59 (BASE)` overnight despite yesterday's fill-only patches on `updateConfig` and `recalculateRates`. Commit `3d1de67` closed this third writer to fill-only as well — `priorRateIdMap` from DB is preserved, candidate from matcher fills only NEW room keys. **If you ever rewrite the `/sync` route, the fill-only behavior is load-bearing — preserve it or `sync_fleet.py` will silently misroute the fleet again.**

11.5 Trigger Modes (Manual vs Cron)

The DGX /run endpoint supports two modes:

Manual Trigger (mode=preview): Activated when a user clicks "Run Sentinel" in the UI. Node sends { hotel_id, mode: "preview" } to the DGX. The DGX runs synchronously (blocks until complete) and uploads decisions with ?mode=preview. The Bridge saves predictions to sentinel_ai_predictions (blue dots) but skips Phase 2 autonomy — no PMS push. The user reviews and approves via "Apply AI" in the Rate Manager. The Node endpoint waits for the DGX response before returning to the UI (no instant 202 toast).

Hourly Cron (no mode): Activated by the DGX cron job. No mode parameter. The DGX runs in a background thread (fire-and-forget, returns 202 instantly). Decisions are uploaded without mode param. The Bridge runs full Phase 1 + Phase 2: shadow save → autonomy gates → PMS queue push (if autopilot is enabled).

Rule for AI: Manual triggers must never auto-push to PMS. They always produce blue dots for review.

11.6 Self-Healing Authentication

Cloudbeds token refresh can fail under high concurrency (33 hotels hourly). Usually transient — self-heals next cycle. Manual re-auth only if failures persist > 3 consecutive hours.

12.0 MARKET CODEX ANALYTICS METHODOLOGY

12.1 Core Calculated Metrics

All derived from market_availability_snapshots. Always filter for a single scraped_at date.

Price Step (Δ): Δ = (max_price_anchor − min_price_anchor) / 49. The monetary width of each histogram bar.

Weighted Average Price (WAP£): Best proxy for market ADR. Calculates midpoint price per bar (min_price_anchor + i × Δ), then weighted average by bar height. Ideal for cross-date/season price comparison.

Price Distribution Index (PDI): Weighted average of bar indices (0–49) instead of prices. Shows if supply skews cheap or expensive relative to its own range. Do NOT use PDI to compare different seasons — use WAP£.

12.2 Market Codex Scraper

Standalone microservice on Render (separate repo). Playwright browser scrapes Booking.com daily for 120-day forward availability. Currently active: London (GBP), Las Vegas (USD). Each city runs as a separate Render cron job at 03:00 UTC.

Key quirks: Must handle cookie consent popup (#onetrust-accept-btn-handler) and Genius/sign-in banner (button[aria-label="Dismiss sign-in info."]). Histogram normalization needed — Booking.com sometimes returns 100-bar duplicated array instead of 50.

12.3 Known Incident: WAP Calculation Failure (Nov 2025)

The calculate_wap SQL function was overwritten with a version expecting [{count: N}] objects instead of the actual simple number array [4, 17, ...]. This broke the generated column. Fix: replaced function + "touched" a dependent column to force recalculation. If WAP goes NULL again, check the function source first.

12.4 Segment WAP (2-4★ Hotel Market WAP) — Added April 2026

The stored `weighted_avg_price` column averages ALL properties on Booking.com (hostels, apartments, 5-star luxury). This inflates WAP by £20-50 vs the actual mid-market competitive set. The Demand Radar page uses a segment-filtered WAP instead.

Method: `MarketService._calcSegmentWap(histogram, minPrice, maxPrice, starRating)` in market.service.js.

Algorithm:
1. Read `facet_star_rating` JSONB to get star distribution for the scrape date.
2. Calculate 5★ as % of total rated properties → trim that % from the TOP of the price histogram.
3. Calculate 1★ as % → trim that % from the BOTTOM.
4. Recalculate WAP from the remaining histogram buckets (effectively 2-4★ segment).

The trim is proportional and per-date — on high-demand days when luxury properties list more aggressively, a larger share gets trimmed. This adapts to market shape automatically.

Result: returned as `segment_wap` from `getForwardView()`. The Demand Radar page uses it for all pricing displays. Other pages (DemandPace, Market Profile) still use the raw `weighted_avg_price`.

Rule for AI: When building new market pricing features, prefer `segment_wap` over `weighted_avg_price` for user-facing metrics. The raw WAP is useful for full-market analysis but misleading for hotel revenue management.

12.5 WAP Fallback for Transient Scrape Gaps (April 2026)

Symptom: a checkin_date shows up empty on the Demand Radar "How busy is the market" chart even though every day around it has a bar. Root cause: that date's latest scrape row has `total_results` populated but `weighted_avg_price`, `min_price_anchor`, `max_price_anchor`, and `facet_price_histogram` all NULL. Most likely upstream cause is the malformed-histogram quirk noted in §12.3 — Booking.com occasionally returns a 100-bar duplicated array instead of 50, the WAP generator bails, and the row gets persisted with supply but no price fields.

Why a missing WAP blanks the bar: `calculateMarketDemand` (`api/utils/market-codex.utils.js`) blends 50% supply scarcity + 50% price index (`mpss`). A NULL WAP makes `mpss` NaN; the blend falls through to `null`; the chart renders nothing. The supply-only fallback branches at lines 130–137 are intentionally commented out.

Fix (2026-04-28): `MarketService.getForwardView` and `getPaceData` (`api/services/market.service.js`) now use a 2-CTE pattern: `latest` (latest snapshot per `checkin_date` for fresh `total_results` / `hotel_count`) LEFT JOIN `last_priced` (latest snapshot per `checkin_date` *with non-null `weighted_avg_price`* for the price fields and histogram). Dates with transient WAP gaps render using the last known price rather than going blank.

Edge case unaddressed: if a date has *never* had a successful priced scrape, it still renders blank. The fallback only helps when *some* prior valid snapshot exists for that exact `checkin_date`.

Known instance — 2026-04-28 scrape: London 2026-05-03 (Sun) and 2026-05-06 (Wed) had NULL WAP. After the fix, May 3 displayed using 2026-04-24's WAP (£206), May 6 using 2026-04-24's £217. Property aggregates (`getProfileOverview`, `getProfileSeasonal`) were not changed — those use SQL `AVG()` which already ignores nulls, so the impact there is just slightly less data, not blank rows.

13.0 DEMAND RADAR (Market Intelligence Page)

13.1 Purpose

90-day forward market intelligence page. Pure market sentiment — no hotel-specific data. Shows demand, pricing, events, supply dynamics, and booking behavior. Accessible via Sentinel > Demand Radar in TopNav.

13.2 Architecture

Frontend: `web/src/features/sentinel/components/DemandRadar/DemandRadarView.tsx`

Props: `allHotels` (hotel list for ID extraction), `selectedProperty` (from TopNav, used to derive city slug).

Data flow:
1. City derived from `selectedProperty.city` (falls back to "london").
2. Fetches `/api/market/forward-view?city=X` for market data (demand, WAP, segment WAP, supply).
3. Fetches `/api/market/pace?city=X&period=7` for 7-day pace deltas.
4. Fetches `/api/market/events?citySlug=X` for PredictHQ events.
5. Fetches `/api/market/booking-behavior?hotelIds=X` for lead time + LOS from reservations table.
6. All dates parsed with `Date.UTC()` and formatted with `timeZone: "UTC"` to prevent timezone drift.

Access: open to all roles (as of April 2026). The `allHotels` prop is populated by `SentinelHub`'s dual-endpoint fetch — `/api/hotels` first, `/api/hotels/mine` as fallback on 403 — so non-admin users see their linked hotels instead of crashing the view. See §4.8b for the full access-model note.

13.3 Sections

1. Outlook Banner — market trajectory (strengthening/softening/stable) with demand + price trajectory numbers.
2. KPI Strip — avg demand, avg WAP (segment), avg supply, high demand days, peak/trough dates.
3. Signals — rising demand flat price, compression events, low demand warnings.
4. Demand Chart — 300px bar chart with demand bars (color-coded by intensity), 7d trend line, event labels above, event background columns.
5. WAP Chart — 260px area chart showing segment WAP (2-4★), 7d trend, subtle spike colouring on P75+/P90+ dates.
6. AI Market Brief — 3 auto-generated insight cards (trajectory, events, compression).
7. Booking Behavior — lead time distribution + LOS from real reservation data. Falls back to mock if no bookings.
8. Booking Window Analysis — demand/WAP/supply by lead-time zone (Urgent/Tactical/Strategic/Horizon).
9. Day-of-Week Patterns — demand + WAP by DOW.
10. Divergence Scatter — demand vs segment WAP scatter plot.
11. Pace Charts (3x) — 7-day demand/price/supply change.
12. Supply Dynamics — total available properties over 90 days.
13. Date Scanner — expandable date-by-date table.

13.4 PredictHQ Integration

**Now served from a static repo file. PredictHQ trial expired April 2026** — `MarketService.getPredictHQEvents(citySlug)` no longer hits the live API. It loads `api/data/predicthq-london-2026.json` (652 events, ~140 KB, lean shape already pre-filtered to the live path's boundaries: categories ∈ {concerts, festivals, sports, conferences, expos, performing-arts}, rank ≥ 65) and returns events whose date range overlaps today → today+180d. Lazy-loaded once per process, cached in module memory. Non-London slugs throw — only London has a snapshot.

Lean event shape (unchanged from the live path so the frontend is untouched): `{ id, title, category, start, end, rank, localRank, attendance, accommodationSpend, tier }`, `tier` ∈ {Extreme ≥90, High ≥75, Medium otherwise} from `localRank`.

Route: `GET /api/market/events?citySlug=london` (returns `{ citySlug, events, fetchedAt, source: "static" }`).

To refresh annually: rerun `scripts/fetch-predicthq-london-year.js` against a working PredictHQ token (weekly chunks, `limit=50/page` free-tier cap, `within=30km@51.5074,-0.1278`, no category/rank filter), then run `scripts/build-predicthq-static.js` to apply the rank/category filter and rewrite `api/data/predicthq-london-<YEAR>.json`. Update `STATIC_EVENTS_FILES` in `market.service.js` to point at the new file.

Dormant infra (kept for the next live-API tenancy): `predicthq_events` cache table (migration_008), `PREDICTHQ_ACCESS_TOKEN` env var, the legacy 3-rank-tier fetch logic (deleted but recoverable from git). Re-enable by reverting `getPredictHQEvents` to the API-fetching version when a paid plan is provisioned.

13.5 Booking Behavior Endpoint

Service: `MarketService.getBookingBehavior(hotelIds)` — queries `reservations` table for last 90 days, computes lead time buckets (0-7d, 8-14d, 15-30d, 31-60d, 60d+) and LOS buckets (1, 2, 3, 4+ nights).

Route: `GET /api/market/booking-behavior?hotelIds=1,2,3`

14.0 EXTERNAL HOTEL INVESTOR STUDY (Booking.com Forward Scrape)

One-shot investor-facing study of an external (non-PMS-connected) hotel, built from public Booking.com data. First run April 2026 on Ellen Kensington (London, 105 keys, 5★). Use this pattern again for any prospect/competitor/acquisition-target study.

14.1 Capture pipeline

Per-rate-row scraper — one row per (date × room type × rate plan). Loops 146-180 check-in dates forward (1N stays, 2 adults, GBP/local currency), uses Playwright against the property page. Template: `scripts/study-ellen-rich.js`.

Per rate row captured:
- `room_name` (e.g. "Classic Double", "Compact Single")
- `block_group` — Booking's own internal room-type ID. `bbasic` is the authoritative signal for wholesaler/partner offers ("Room Assigned on Arrival")
- `price_displayed` / `price_baseline` — post- and pre-discount
- `rooms_left` — Booking's "N left" scarcity banner (CAPPED AT ~7 — do not treat higher as a meaningful inventory signal)
- `rate_plan_desc` (non-ref flags, breakfast, free cancel, "Partner Offer" marker)

Key extraction gotchas:
- The ONLY reliable partner-offer signal is `block_group === "bbasic"`, NOT the `room_name` field (Booking's table uses rowspan, and carry-forward logic can misattribute the name).
- Booking shows "N left" as just "N left" with no "only" prefix on newer page versions — regex must not require "only".
- Wait for `#hprt-table tr.js-rt-block-row, #no_availability_msg` + ~1.8s settle before extracting, so Genius/campaign JS has applied displayed prices.

14.2 Analytical corrections (critical)

Two mandatory corrections before projecting annual revenue from any forward-scrape of this shape:

1. Seasonal correction. The scrape window (Apr → Sep) is peak London season. Anchor against a central-London comparable from the DB (The Cleveland Hotel, hotel_id 289618, 30 rooms, Paddington upper-midscale, 2y of `daily_metrics_snapshots` history). For Ellen vs Cleveland the index was `1.151×` — scrape-period ADR ran 15.1% above the full-year average. Divide each observed ADR by the index to get annualised equivalent. See `scripts/compute-seasonal-index.js`.

   Do NOT use Shreeji portfolio for seasonal anchoring on premium/upper-tier external hotels — Shreeji's budget-tier winters dip too deep and understate the low-season ADR for a 5★ comparable.

2. B2B leakage haircut. Wholesaler partner offers (HotelBeds / WebBeds / Expedia EAN, shown as "Room Assigned on Arrival / Partner Offer") appear on ~97% of dates for Ellen. Apply a 10% haircut to displayed retail ADR to model rate-parity slippage — partner presence suppresses Ellen's realised rate on Booking.com even when some guests still convert at retail. Haircut range for sensitivity: 10% (mild) → 25% (severe).

14.3 Inventory-pool inference

We can't observe true inventory per room type — only Booking's capped "N left" banner. Two-tier model:

- Tier A (scarcity on ≥70% of dates) → trust `max_N_left` observed as the pool size. Booking's banner only fires when inventory is genuinely near the ceiling, so if the banner is present every day, the max value IS the pool. This typically captures suites + constrained rooms.
- Tier B (rare scarcity) → split remaining keys proportional to `sqrt(1 / scarcity_rate)`. Sqrt dampens extreme ratios; assumes rarer scarcity = deeper pool. Weakness: "rarely stressed" could equally mean low demand — the data can't distinguish.

Allocations normalised to the hotel's real key count (ask user for total or scrape from property page metadata). Present as a model, not authoritative.

14.4 Deliverables

- Rich CSV: `ellen-rich-<YYYYMMDD>.csv` (one row per rate plan × date)
- Meta JSON: `ellen-rich-<YYYYMMDD>.meta.json`
- Dashboard: `scripts/build-ellen-rich-dashboard.js` → `ellen-rich-dashboard.html` (single self-contained file, inline SVG charts, Market Pulse dark theme, A4 portrait print-ready)

14.5 Scenario table (what the study headlines)

- **Retail median** (observed) — baseline, overstates annual
- **Seasonally corrected** (observed ÷ index)
- **Realistic / B2B-adjusted** (after 10% haircut) — the final defensible annual figure
- **Lowest** (retail floor / worst-case)

Headline format: "Ellen makes £X.XM – £Y.YM annually at N% occupancy" — range = B2B-adjusted → retail-median after seasonal correction.

14.6 Key patterns to look for on any external-hotel study

- Partner/wholesaler coverage rate (% of dates with a `bbasic` row) — this IS the rate-parity story
- Ratio of partner-price to retail-floor per date — undercut magnitude
- Room-type sell-out pressure: for each room, count (missing dates + "1 left" + "2 left") as a near-sellout proxy
- Rate-fence discipline: per-room discount depth (baseline → displayed %). Suites should hold tighter than standards
- Forward-curve shape by lead-time: close-in vs far-out price spread tells you if they yield or hold rates

15.0 SCHEDULED REPORTS, AUTH & CLOUDBEDS OAUTH SCOPES

15.1 Scheduled Report Dispatcher

Cron-driven email reports defined in the `scheduled_reports` table. Dispatcher entry: `GET /api/send-scheduled-reports` → `api/send-scheduled-reports.js`. The Railway cron fires every 5 minutes (`server.js:413-415`) and each invocation matches due rows by exact `time_of_day` equality. Three frequencies: Daily, Weekly (matched on `day_of_week::text`), Monthly (matched on `day_of_month::text`).

Three report types are dispatched via `report_type`:
- `shreeji` — daily Shreeji chart PDF (attachment).
- `takings_audit` — multi-hotel cash/cards/BACS audit (HTML email body, no attachment). Uses `MetricsService.getGroupTakingsReport` + `generateTakingsEmailHTML`.
- (default / NULL) — original per-hotel P&L report with CSV/XLSX attachments.

**Cron-alignment trap (incident 2026-05-06).** Because the cron only fires at 5-minute boundaries (HH:00, HH:05, …) and the SQL match is `WHERE TRIM(time_of_day) = $1`, any user-picked `time_of_day` not on a 5-min boundary silently never fires. The Shreeji Monthly Takings Report (id 95) was set to `06:01` and missed every monthly trigger from creation (2026-02-26) until discovery in 2026-05-06 — three consecutive missed Mondays. Fixed at the source: `<input type="time" step={300}>` in `CreateScheduleModal.tsx:469` enforces 5-min increments going forward; existing rows audited and confirmed aligned. If you ever see "the schedule is set but nothing fired", check `time_of_day` minutes-mod-5 first.

**`previous-month` date-range trap (fixed 2026-05-06).** The original `calculateDateRange("previous-month")` used date-fns `subMonths` / `startOfMonth` / `endOfMonth`, which operate in *local* time. On a non-UTC host (e.g. a BST dev machine triggering the report manually) the start date slipped back one day, producing `2026-03-31 to 2026-04-30` instead of `2026-04-01 to 2026-04-30`. Replaced with explicit `Date.UTC(y, m - 1, 1)` / `Date.UTC(y, m, 0)` — UTC-safe regardless of host timezone, including year-boundary and leap-Feb edges. Other branches (`current-month`, `current-week`, `last-week`) already used UTC accessors and are unaffected.

**Manual trigger path.** `POST /api/admin/run-scheduled-report` with `{ reportId }` invokes the dispatcher synchronously for one row and ignores `time_of_day` / `day_of_month`. Useful for re-running a missed report or testing changes. Admin-only or internal-secret-gated.

15.2 Cloudbeds OAuth Scope Model

The Cloudbeds developer portal lists scopes the app *may* request — these are a ceiling, not auto-granted. The OAuth `scope=` parameter sent during `/api/auth/cloudbeds` (`auth.router.js:897-898`) determines what's actually issued to a property at consent time. If the code's scope string omits a portal-approved scope, every hotel that ever onboarded gets tokens without it, and refreshing those tokens cannot upgrade scopes — only a fresh consent grant can.

**Currently requested scopes (`auth.router.js:898`):**
`read:user read:hotel read:guest read:reservation read:room read:rate read:currency read:taxesAndFees read:dataInsightsGuests read:dataInsightsOccupancy read:dataInsightsReservations read:dataInsightsFinancialTransactions offline_access`

**Data Insights `dataset_id` → required scope mapping (load-bearing).**
- `dataset_id=1` (Financial Transactions: Daily Takings, Monthly Financials, payments) → requires `read:dataInsightsFinancialTransactions`.
- `dataset_id=7` (Reservations / Occupancy: `getHistoricalMetrics`, `getUpcomingMetrics`) → covered by `read:dataInsightsReservations` (or `Guests`/`Occupancy` — Cloudbeds is lenient on this dataset).

**Known incident — Shreeji Takings 403 (2026-05-06).** `getMonthlyFinancials` (dataset_id=1) was returning 403 for every Cloudbeds hotel — old (Cleveland 289618), new (Tudor Inn 318317), every era. Root cause: `read:dataInsightsFinancialTransactions` had been approved in the Cloudbeds developer portal at some earlier date, but the OAuth `scope=` string had never included it (verified by `git log -S` returning zero hits across all branches). Every hotel was issued tokens without the scope. The Shreeji Monthly Takings Report's email body landed with all-zero takings columns (cash/cards/BACS = £0, occupancy = 0%, ADR = £0) for the affected month before this was caught — only Total Revenue was correct because that comes from `daily_metrics_snapshots`, not the API. Fixed in commit `959d6fd` by adding the scope to the request string.

**Required follow-up after any scope change: fleet-wide re-consent.** After deploy, every existing hotel must go through `/api/auth/cloudbeds` again to receive an upgraded token. The OAuth callback's existing-hotel path is credentials-only (`auth.router.js:1045-1095`) — it does *not* re-sync hotel details, tax info, or room types, and the initial-sync trigger explicitly skips hotels that already have `daily_metrics_snapshots` rows. Re-consent is therefore data-safe: the only mutation is `user_properties.pms_credentials` getting a new refresh_token. The 7 Shreeji hotels (318304 / 318305 / 318307 / 318308 / 318309 / 318316 / 318317) were re-consented on 2026-05-06 and verified.

Other Cloudbeds Data Insights scopes available in the portal but **not currently requested** (add them with the same caveat — code change + fleet re-consent): `read:dataInsightsPayments`, `read:dataInsightsInvoices`. Also marketplace-approved but not requested: `read:roomblock`, `write:rate`.

15.3 Magic Link Authentication

Single source of truth for non-OAuth login. Used by invited users (no Cloudbeds account) and any user logging in by email rather than the Cloudbeds OAuth flow.

**Issuance.** `POST /api/auth/login` with `{ email }` (`auth.router.js:191`). Looks up user by email, generates a 32-byte hex token (`crypto.randomBytes(32).toString("hex")`), inserts into `magic_login_tokens (token, user_id, expires_at, used_at)` with **24-hour expiry** (bumped from 30 minutes 2026-05-06 in commit `66f99cb`). Sends email via SendGrid containing `<baseUrl>/api/auth/magic-link-callback?token=<hex>`. Table has no `created_at` / IP / UA / attempt-count columns — issuance time is inferred from `expires_at - 24h`.

**Click-through page.** `GET /api/auth/magic-link-callback` (`auth.router.js:258`). Validates `expires_at > NOW()`. **Does not consume the token.** Renders a branded HTML page with a "Log me in" button. The button is *not* a form submit — it's a `<button type="button">` whose click handler runs `fetch('/api/auth/magic-link-callback', { method: 'POST', credentials: 'same-origin', body: 'token=' + token })`. JS-only by design (commit `66f99cb`).

This protects against three scanner classes:
1. GET prefetchers (Mimecast preview, basic spam scanners) — they hit GET, the token isn't consumed, the human gets a working link.
2. Form-submitting scanners (Microsoft Defender ATP, aggressive Proofpoint) — they don't run JS, so the button click handler never fires, the POST never happens, the token isn't consumed.
3. Headless scanners that *do* run JS — they typically don't simulate UI clicks, so the click handler still doesn't fire.

**Consume.** `POST /api/auth/magic-link-callback` (`auth.router.js:341`). Re-validates `expires_at > NOW()`. Importantly does NOT gate on `used_at IS NULL` — the token is reusable within its validity window. Intentional: if a scanner somehow does land a real POST with a session cookie, that scanner's session goes nowhere and the human's later POST still creates a fresh session. Sets `used_at = NOW()` for analytics, calls `req.session.regenerate()`, populates `userId` + `role`, returns redirect HTML targeting `/app/`.

**Session.** pg-backed (table `user_sessions` via `connect-pg-simple`, `server.js:184-205`). Cookie maxAge **60 days**, httpOnly, sameSite=lax, secure on prod. Returning users almost never need a fresh magic link — long-lived sessions are the primary mitigation against magic-link-failure friction.

**Failure rate baseline.** 2026-05-06, preceding 30 days: 27 of 42 issued tokens used (64.3%). Post-fix target: > 85%. Re-measure with `SELECT COUNT(*) AS issued, COUNT(used_at) AS used FROM magic_login_tokens WHERE expires_at > NOW() - INTERVAL '30 days'`. If the rate doesn't move into the 85%+ range after 30 days of the new TTL + JS-submit, the next move is to add a 6-digit numeric code in the email body that the user can paste into the login screen as a fallback (eliminates click-link failure modes entirely).

End of Blueprint.
Use this document as the only architectural reference when reasoning about Market Pulse + Sentinel.
