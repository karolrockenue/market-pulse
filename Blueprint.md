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

Market & pace data, including Shadowfax-sourced signals.

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

Shadowfax View – competitive pricing & scraped context for Sentinel usage.

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

Async Isolation

User actions (overrides) never block on PMS writes.

Producer enqueues jobs; worker processes them and reports via notifications.

DGX / Shadowfax

DGX Spark and "Shadowfax 2.0" are future compute/scraper layers.

Current system references them conceptually; runtime pricing logic is fully handled by Node + adapters + existing SQL.

Mews Integration (Active — March 2026)

Full Mews PMS integration across all 5 phases: onboarding, metrics sync, Sentinel rate reads, Sentinel rate writes, and real-time webhooks.

Architecture: PMS-siloed. All Mews code lives in dedicated files. Zero changes to Sentinel core services or pricing engine.

New files: mewsAdapter.js, mews.sentinel.adapter.js, pmsRegistry.js, mews.onboarding.router.js, mews.webhooks.router.js.

Modified files (additive only): server.js (4 lines), sentinel.router.js (5 PMS routing patches), sentinel.service.js (1 PMS-aware rate_id_map patch), daily-refresh.js (Mews branch updated).

Environment variables: MEWS_CLIENT_TOKEN, MEWS_API_URL (defaults to https://api.mews-demo.com, production: https://api.mews.com).

Per-hotel credentials: hotels.pms_credentials stores { accessToken, serviceId, timezone }.

Production webhook URL: https://www.market-pulse.io/api/mews-webhooks

Certification: Mews certification form submitted. Pending production ClientToken.

2.0 ARCHITECTURE
2.1 Backend Architecture

Stack & Entry

Node.js + Express.

Deployed in a serverless-friendly way (Vercel).

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

Domain Services (Logic Owners)

api/services/metrics.service.js

Single owner of all KPI / performance / YoY / portfolio / pacing logic.

api/services/market.service.js

Market data, pace, seasonality, Shadowfax-derived metrics.

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

Market & pace views, Shadowfax helpers.

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

Owns: getHotelDetails, getAccommodationServiceId, getResourceCategories, getRatePlans, buildMewsRateIdMap, getOccupancyMetrics, getRevenueMetrics, getCombinedMetrics.

API base URL controlled by MEWS_API_URL env var (defaults to demo, production is https://api.mews.com).

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

api/utils/db.js – shared PostgreSQL connection.

api/utils/benchmark.utils.js – pacing & benchmarking helpers.

api/utils/market-codex.utils.js – WAP/trend/demand logic hub.

api/utils/pacing.utils.js – pacing-specific business helpers.

api/utils/pdf.utils.js, api/utils/report-templates/... – reporting & PDFs.

api/utils/email.utils.js, api/utils/emailTemplates.js – transactional emails.

api/utils/middleware.js – auth, requireAdminApi, etc.

api/utils/bridgeAuth.js – Security middleware for AI Bridge (x-api-key).

Workers & Scripts

scripts/import-daily-history.js / scripts/import-monthly-history.js

Backfill & import helpers for metrics.

Sentinel async worker logic now lives inside sentinel.router.js as an internal background runner, not a separate worker file.

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

components/Shadowfax/ShadowfaxView.tsx

Hooks:

hooks/usePropertyHub.ts (exports math functions for OTA discount stack — used by useSentinelConfig and useRateGrid)

hooks/useRateGrid.ts

hooks/useSentinelConfig.ts (also loads rockenue_managed_assets for Promo Config)

hooks/useShadowfax.ts

API layer:

api/sentinel.api.ts

api/types.ts

Rule for AI:
All Sentinel pricing math and data orchestration comes from the backend (sentinel.service.js + sentinel.pricing.engine.js + sentinel.adapter.js).
React components and hooks must not re-implement or diverge from those formulas.

Shared Components & Utilities

web/src/components/TopNav.tsx, LandingPage.tsx, InitialSyncScreen.tsx, NotificationBell.tsx, MarketVeil.tsx, SettingsPage.tsx, SupportPage.tsx, modal components, etc.

web/src/components/ui/\* – shadcn primitives (omitted from file tree to reduce noise).

web/src/styles/globals.css – global layout & theme.

web/src/guidelines/Guidelines.md – internal UI rules.

3.0 LOGIC HUBS & FORMULAS
3.1 Rate Replicator (OTA Sell-Rate Calculator)

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

Daily min overrides can be set in two ways from the Rate Manager UI:

- Editing the Min Rate row directly for a specific date.
- Entering a PMS Override or Target Sell Rate below the current min — the system auto-lowers the daily min to match and shows a red warning toast.

When a daily min override is below the monthly default, the UI signals this clearly:

- The Min Rate cell turns red with a red bottom border.
- The entire column for that date gets an amber tint across all rows.
- A tooltip on the cell shows the monthly default for reference.

To revert a daily override, clear the min rate cell (empty input) — it reverts to the monthly default.

Max Rate

EffectiveRate = min(EffectiveRate, MaxRate)

These guardrails apply after differential calculations.

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

3.7 Padlock / Priority Logic

Priority of sources for any given date:

Manual values (locked / padlocked).

Pending (unsaved changes in the UI).

Saved overrides.

AI calculated rates.

If a day is manual in PMS or has a manual override:

System respects the manual value.

AI pushes nothing (no override) for that day.

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

4.5 sentinel_daily_max_rates

Stores granular daily price ceilings (Dynamic Rate Caps).

Source of truth for "The Ceiling" in the Sentinel pricing logic.

Fields:

hotel_id (PK, Integer)

stay_date (PK, Date)

max_price (Numeric)

is_manual_override (Boolean)

updated_at

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

hotels

users

user_properties

daily_metrics_snapshots

market_availability_snapshots

hotel_budgets

rockenue_managed_assets (calculator settings, multipliers, Genius %, etc.)

Helpers: magic_login_tokens, user_sessions, etc.

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

POST /overrides

Producer:

Validates payload { hotelId, pmsPropertyId, roomTypeId, overrides: [...] }.

Delegates to sentinel.service.buildOverridePayload(...) which calls sentinel.pricing.engine.js.

Splits into chunks; writes to sentinel_job_queue.

Kicks background worker via internal call.

Returns immediately with success/failure.

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

Saves per-day min rate overrides. Pass null for a date to revert to monthly default (deletes the row).

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

Budgets.

Compsets.

Rockenue-managed asset records.

/api/market

Market KPIs & forward view.

Neighborhood & demand segments.

Shadowfax helper calls (scraper-derived or computed market pricing).

/api/admin

Internal tools, health checks, manual triggers.

/api/auth / /api/users / /api/support

Login/session, user management, support functions.

Rule for AI:
When adding features, pick the correct domain router instead of adding ad-hoc routes elsewhere.

5.4 Bridge Endpoints (/api/bridge)

Protected by bridgeAuth (requires x-api-key header).

GET /context/:hotelId

Returns full context for AI decision making:

Inventory (sentinel_rates_calendar).

Config (Min/Max rates, Seasonality).

Pace Curves (Targets).

Pickup Velocity (Calculated 24h delta).

POST /decisions

Accepts JSON array of rate predictions.

Upserts into sentinel_ai_predictions.

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
│ │ ├── market-codex.utils.js
│ │ ├── middleware.js
│ │ ├── pacing.utils.js
│ │ ├── pdf.utils.js
│ │ ├── report-templates
│ │ │ └── shreeji.template.html
│ │ └── scraper.utils.js
│ ├── daily-refresh.js
│ ├── initial-sync.js
│ ├── migration_001_add_market_metrics.js
│ ├── migration_002_fix_market_metrics.js
│ ├── migration_004_daily_min_rates.js
│ ├── send-scheduled-reports.js
│ └── sync-rockenue-assets.js
├── scripts
│ ├── import-daily-history.js
│ └── import-monthly-history.js
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
│ │ │ ├── BudgetReport.tsx
│ │ │ ├── ReportActions.tsx
│ │ │ ├── ReportControls.tsx
│ │ │ ├── ReportSelector.tsx
│ │ │ ├── ReportTable.tsx
│ │ │ ├── ShreejiReport.tsx
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
│ │ │ ├── RiskOverview
│ │ │ │ └── PortfolioRiskOverview.tsx
│ │ │ └── Shadowfax
│ │ │ └── ShadowfaxView.tsx
│ │ ├── hooks
│ │ │ ├── usePropertyHub.ts
│ │ │ ├── useRateGrid.ts
│ │ │ ├── useSentinelConfig.ts
│ │ │ └── useShadowfax.ts
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

End of Blueprint.
Use this document as the only architectural reference when reasoning about Market Pulse + Sentinel.
