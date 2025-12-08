0.0 AI PROTOCOL (FOR ALL AI AGENTS)

This section is binding. Ignore older docs, memories, assumptions, and “best practices” that contradict this.

Analyze First

Read all provided project files relevant to the task.

Do not start coding before you understand:

Which layer you are touching (frontend / backend / DB).

Which module owns the logic (service vs router vs adapter vs React).

Plan Before Code

Before any code change, output a short bullet-point plan.

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

Control Panel – configuration & guardrails.

Rate Manager – grid with live vs AI vs guardrails, overrides.

Property Hub (Rate Replicator) – OTA discount stack & math.

Risk Overview – portfolio risk lens inside Sentinel.

Shadowfax View – competitive pricing & scraped context for Sentinel usage.

Connects to PMS via:

cloudbedsAdapter.js (auth + generic operations).

sentinel.adapter.js (pricing-focused write/read bridge).

1.2 Key Boundaries

UI ↔ Backend

All Sentinel UI components talk to /api/sentinel/....

Market Pulse domain UIs talk to /api/metrics, /api/hotels, /api/market, /api/admin, /api/auth, /api/users, /api/webhooks.

Backend ↔ PMS

All PMS read/write operations go through adapters:

cloudbedsAdapter.js for tokens + general operations.

sentinel.adapter.js for Sentinel-specific rate reads/writes.

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

DGX Spark and “Shadowfax 2.0” are future compute/scraper layers.

Current system references them conceptually; runtime pricing logic is fully handled by Node + adapters + existing SQL.

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

Inbound events from PMS → metrics snapshots (Pulse).

api/routes/auth.router.js / api/routes/users.router.js

Authentication & user management; aligned with service architecture.

api/routes/support.router.js

Support endpoints surfaced to the UI.

api/routes/sentinel.router.js

Sentinel-only API (see §5.1).

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

api/adapters/mewsAdapter.js / api/adapters/operaAdapter.js

Present for broader Market Pulse usage.

Sentinel is currently Cloudbeds-only.

Utils

api/utils/db.js – shared PostgreSQL connection.

api/utils/benchmark.utils.js – pacing & benchmarking helpers.

api/utils/market-codex.utils.js – WAP/trend/demand logic hub.

api/utils/pacing.utils.js – pacing-specific business helpers.

api/utils/pdf.utils.js, api/utils/report-templates/... – reporting & PDFs.

api/utils/email.utils.js, api/utils/emailTemplates.js – transactional emails.

api/utils/middleware.js – auth, requireAdminApi, etc.

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

Components: HotelDashboard.tsx, DynamicYTDTrend.tsx, MarketOutlookBanner.tsx

API: dashboard/api/dashboard.api.ts

Hooks: useDashboardData.ts

reports/

ReportsHub.tsx

Components: ReportSelector.tsx, ReportTable.tsx, ReportActions.tsx, ReportControls.tsx, BudgetReport.tsx, PortfolioOverview.tsx, YearOnYearReport.tsx, ShreejiReport.tsx

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

components/PropertyHub/PropertyHubView.tsx

components/RateManager/RateManagerView.tsx

components/RateManager/OccupancyVisualizer.tsx

components/RiskOverview/PortfolioRiskOverview.tsx

components/Shadowfax/ShadowfaxView.tsx

Hooks:

hooks/usePropertyHub.ts

hooks/useRateGrid.ts

hooks/useSentinelConfig.ts

hooks/useShadowfax.ts

API layer:

api/sentinel.api.ts

api/types.ts

Rule for AI:
All Sentinel pricing math and data orchestration comes from the backend (sentinel.service.js + sentinel.pricing.engine.js + sentinel.adapter.js).
React components and hooks must not re-implement or diverge from those formulas.

Shared Components & Utilities

web/src/components/TopNav.tsx, LandingPage.tsx, InitialSyncScreen.tsx, NotificationBell.tsx, SettingsPage.tsx, SupportPage.tsx, modal components, etc.

web/src/components/ui/\* – shadcn primitives (omitted from file tree to reduce noise).

web/src/styles/globals.css – global layout & theme.

web/src/guidelines/Guidelines.md – internal UI rules.

3.0 LOGIC HUBS & FORMULAS
3.1 Rate Replicator (OTA Sell-Rate Calculator)

Used primarily inside Property Hub under Sentinel.

Sequential discount stack:

Level 0 – Base

RawBase = PMS_Rate × Multiplier

Level 1 – Rate Plan Modifier

Non-refundable etc.

AfterNonRef = RawBase × (1 − NonRef%)

Level 2 – Sequential Discounts (applied in order)

Genius

AfterGenius = AfterNonRef × (1 − Genius%)

Campaigns (Late Escape, Early Booker, etc.)

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

4.5 Other Market Pulse Tables (Relevant to Sentinel)

Sentinel reads from / relies on:

hotels

users

user_properties

daily_metrics_snapshots

market_availability_snapshots

hotel_budgets

rockenue_managed_assets (calculator settings, multipliers, Genius %, etc.)

Helpers: magic_login_tokens, user_sessions, etc.

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

6.0 ACTIVE FILE TREE (SIMPLIFIED, LOGIC-FOCUSED)

Note:
This tree is intentionally trimmed to remove noise (favicons, shadcn primitives, etc.).
UI primitives under web/src/components/ui and small static assets are not listed.

market-pulse/
├── api
│ ├── adapters
│ │ ├── cloudbedsAdapter.js
│ │ ├── mewsAdapter.js
│ │ ├── operaAdapter.js
│ │ └── sentinel.adapter.js
│ ├── routes
│ │ ├── admin.router.js
│ │ ├── auth.router.js
│ │ ├── hotels.router.js
│ │ ├── market.router.js
│ │ ├── metrics.router.js
│ │ ├── sentinel.router.js
│ │ ├── support.router.js
│ │ ├── users.router.js
│ │ └── webhooks.router.js
│ ├── services
│ │ ├── hotel.service.js
│ │ ├── market.service.js
│ │ ├── metrics.service.js
│ │ ├── sentinel.pricing.engine.js
│ │ └── sentinel.service.js
│ ├── utils
│ │ ├── benchmark.utils.js
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
│ │ │ └── MarketOutlookBanner.tsx
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
│ │ │ ├── PortfolioOverview.tsx
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
│ │ │ │ └── ControlPanelView.tsx
│ │ │ ├── PropertyHub
│ │ │ │ └── PropertyHubView.tsx
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

End of Blueprint.
Use this document as the only architectural reference when reasoning about Market Pulse + Sentinel.
