0.0 AI PROTOCOL
Rules the AI must follow inside this project

Derived strictly from the source files:

Analyze First

The AI must read all provided project files before acting.

AI confirms analysis with “Done” (internal protocol).

Plan Before Action

Before modifying any code, AI must output a bullet-point plan.

Code is NOT written until user approves the plan.

Clarify Ambiguity

If any function/file/logic is unclear → AI must ask before assuming.

One-File-At-A-Time Rule

The AI modifies only one file per instruction.

No full-file replacements unless explicitly asked.

Find-and-Replace Strategy

Code changes must be delivered as specific replaceable fragments.

Minimal Comments

Only comment at the start of new functions or endpoints.

Incremental Testing

After each change, the AI must give a “Test Point” with steps.

Request Missing Files

If a required file is not provided, the AI must request it.

Strict Non-Hallucination Protocol

No invented logic, endpoints, schemas, constants, or file names.

All outputs must be explicitly present in the uploaded sources.

1.0 SYSTEM OVERVIEW
1.1 High-Level Structure

The Market Pulse + Sentinel system consists of two tightly connected subsystems:

Market Pulse (Core Platform)

Acts as the Data Hub

Manages hotels, users, metrics, budgeting, market data, scraping

Hosts the UI for the Sentinel module

Sentinel (AI Pricing Engine)

Consists of:

Control Panel (UI inside Market Pulse)

Rate Manager (UI for daily pricing)

Async Engine (background queue processor)

Rate Push Engine (writes rates to PMS)

Differential Engine (calculates room price spreads)

Guardrails (min rate, max rate, freeze, LMF)

Connects to PMS via the Bridge Adapter

Powered by DGX Spark for training (future) and local inference

1.2 Key Boundaries

UI ↔ Backend: All Sentinel UI components call /api/sentinel/....

Backend ↔ PMS: All PMS write operations pass through:

cloudbedsAdapter.js (authentication + heavy lifting)

sentinel.adapter.js (pricing, overrides, batch rate pushes)

Facts vs Rules stored in sentinel_configurations (single source of truth).

Async Queue isolates user actions from PMS rate push latency.

Notification System alerts users of failed background jobs.

Property Hub integrates Rate Replicator logic (OTA discount stack).

2.0 ARCHITECTURE
2.1 Backend Architecture
Backend Stack

Node.js + Express

Serverless model deployed on Vercel

Single server entrypoint: server.js

Feature-based routers under /api/routes

Centralized utilities under /api/utils

PMS-agnostic adapter pattern

Sentinel Backend Modules

sentinel.router.js

Routes for Control Panel + Rate Manager

Write operations (e.g., POST /overrides)

Triggering background queue (“Producer” pattern)

sentinel.adapter.js

Intelligent pricing adapter

Uses main Cloudbeds authentication via imported getAccessToken()

Implements:

postRate()

postRateBatch()

Live rate lookups

Write-back to PMS

Async Queue Components

sentinel_job_queue table

Background worker:

Route: POST /api/sentinel/process-queue

Processes pending jobs FIFO

Writes success/failure to DB

Notification insertion via sentinel_notifications

Webhooks System (Receiver / Processor / Reconciler)

webhooks.router.js receives PMS events

Queue processing + reconciliations planned (hybrid sync model)

File Services

PDF generation (Playwright)

Email delivery (SendGrid)

2.2 Frontend Architecture
React SPA (Vite)

Single entrypoint: App.tsx

Sentinel UI components:

SentinelControlPanel.tsx

SentinelRateManager.tsx

NotificationBell.tsx

Property Hub Rate Replicator (drawer architecture)

Shared State

App-level data fetched in App.tsx

Child components receive props only; no Redux/MobX

Inline styles (not Tailwind scanning)

2.3 Adapters
cloudbedsAdapter.js

Official PMS adapter

Handles:

OAuth flow

Rate reads

Historical sync

Room/tax details

Exposes getAccessToken(hotelId)

sentinel.adapter.js

Specialized “intelligent” write adapter

Depends on getAccessToken() from cloudbedsAdapter

Handles only:

Price injection (rate pushes)

Batch updates (v1.3 API)

Real-time override application

Differential engine integration

mewsAdapter.js / operaAdapter.js

Exists for broader MP functionality.

Sentinel currently uses Cloudbeds only.

2.4 Routers
Sentinel Router (api/routes/sentinel.router.js)

POST /overrides

POST /process-queue

GET /notifications

POST /notifications/mark-read

Webhooks Router

Dedicated receiver for PMS events

Queues inbound data for reconciliation

2.5 Async Queue
Producer (POST /overrides)

Calculate Final Rate (Base + Differentials)

Insert into sentinel_job_queue

Trigger worker (Kick)

Return instantly to UI

Consumer (Worker)

Fetch PENDING jobs

Lock → PROCESSING

Call postRateBatch

Update status (COMPLETED or FAILED)

Insert notification if failed

2.6 Notification Bell

Polls /api/sentinel/notifications/unread

Shows list of system alerts

Clears via /mark-read

Uses shadcn/ui Popover

2.7 Rate Push Engine

Reads:

Guardrails

Differentials

Room mappings

Freeze windows

Last-minute floors

Manual overrides

Pushes:

Base Room

All Derived Rooms

Uses Batch API (max 30 per batch)

2.8 Control Panel

Activation Card (Surgical Activation model)

Loads/Stores:

Facts (room types, rate plans)

Rules (differentials, guardrails, floors, freeze)

UI mirrors Figma prototype

All config stored in sentinel_configurations

2.9 Rate Manager

Grid view of:

PMS Live Rates

AI Suggested Rates

Guardrails

Min/Max

LMF

Freeze days

Supports:

Manual override input

Pending vs Saved overrides

Optimistic UI updates

Submit triggers /overrides (async)

2.10 Adapter Isolation Firewall / Bridge

Certification Phase (past)

Sentinel ran isolated via dev credentials.

Current Mode (Bridge)

sentinel.adapter.js imports real PMS tokens

Full read/write access for production hotels

2.11 DGX Integration

DGX Spark is used for:

Model training

Batch inference

Future “Shadowfax 2.0” scraper engine

Market Pulse acts as the Data Hub feeding DGX

3.0 LOGIC HUBS & FORMULAS
3.1 Rate Replicator (OTA Sell-Rate Calculator)

Sequential discount stack (Daisy-Chain model):

Level 0: Base
RawBase = PMS_Rate × Multiplier

Level 1: Rate Plan Modifier
AfterNonRef = RawBase × (1 − NonRef%)

Level 2: Sequential Discounts

Applied in order:

Genius

AfterGenius = AfterNonRef × (1 − Genius%)


Campaigns (Late Escape, Early Booker, etc.)

AfterCampaign = AfterGenius × (1 − Campaign%)


Targeting Discounts (Mobile, Country Rate)

FinalSellRate = AfterCampaign × (1 − Targeting%)

Exclusive Deep Deals

If active, they override Level 2 entirely:

FinalSellRate = AfterNonRef × (1 − DeepDeal%)

3.2 Daisy-Chain Differential Engine

For each derived room type:

DerivedRate = BaseRate × (1 + Differential%)


Skips the base_room_type_id to avoid double push.

3.3 Guardrails
Min Rate
EffectiveRate = max(CalculatedRate, MinRate)

Max Rate
EffectiveRate = min(EffectiveRate, MaxRate)

3.4 Freeze Windows

If freeze_period = N:

Freeze applies to days 0 through N (inclusive)


Frozen days preserve PMS live rate.

3.5 Last-Minute Floors (LMF)

If LMF = K:

LMF applies to days 0 through K (inclusive)


Overrides calculated rate with guardrail floor unless freeze period overlaps (freeze takes priority).

3.6 Mapping Logic (room_type → rate_id)

Stored in Facts portion of sentinel_configurations:

Base Room Type

Derived Room Types

Rate Plan → Room Type mapping for base plan selection

Used to attach correct PMS rate IDs to override payloads.

3.7 Padlock Logic

If a day is MANUAL in PMS or has manually entered override:

System respects manual value

AI pushes nothing for that day

Priority:

Manual

Pending (unsaved changes)

Saved

AI calculated

4.0 DATABASE SCHEMA (FINAL STATE)
4.1 sentinel_configurations

Stores Facts + Rules.

Fields include:

hotel_id

facts: room_types, rate_plans, mappings

rules:

differentials

guardrails

monthly_min_rates

min_rate, max_rate

rate_freeze_period

last_minute_floor

base_room_type_id

activation flags

manual overrides persisted here

4.2 sentinel_rates_calendar

(If present in source — Not explicitly defined → omitted)

4.3 sentinel_job_queue

id (PK)

payload (JSON list of rates)

status: PENDING | PROCESSING | COMPLETED | FAILED

error_log (text)

timestamps

4.4 sentinel_notifications

id (PK)

type: ERROR | SUCCESS

message (text)

is_read (boolean)

timestamps

4.5 Other Market Pulse Tables

(These are part of main MP system but needed for Sentinel context)

hotels

users

user_properties

daily_metrics_snapshots

market_availability_snapshots

hotel_budgets

rockenue_managed_assets

helpers: magic_login_tokens, user_sessions, etc.

5.0 API REFERENCE (ACTIVE ENDPOINTS ONLY)
5.1 Sentinel Endpoints
POST /api/sentinel/overrides

Producer

Calculates base + differentials

Inserts into job queue

Returns instantly

POST /api/sentinel/process-queue

Worker

Protected by CRON_SECRET

Processes PENDING jobs

GET /api/sentinel/notifications

Fetch notification list

POST /api/sentinel/notifications/mark-read

Clears notifications

5.2 Webhooks
POST /api/webhooks/...

Receives PMS webhook events

Queues for future hybrid reconciliation

5.3 Property Hub
Rate Replicator

Logic processed in frontend + API

No scraping

Pure math engine

5.4 Remaining MP Endpoints (Relevant to Sentinel)



/auth

/dashboard

/portfolio

/planning

/market

/reports

/scraper (Shadowfax)

/admin

/users

Sentinel interacts mainly with /admin/sync-hotel-info, /dashboard/summary, and PMS-facing logic.

6.0 ACTIVE FILE TREE (EXACT)

market-pulse/
├── api/
│   ├── adapters/
│   │   ├── cloudbedsAdapter.js    # Main Adapter (Auth Provider)
│   │   ├── mewsAdapter.js         # Mews Logic
│   │   ├── operaAdapter.js
│   │   └── sentinel.adapter.js    # Bridge: Uses cloudbedsAdapter tokens
│   ├── workers/
│   │   └── process-queue.js       # Sentinel Async Worker
│   ├── routes/
│   │   ├── admin.router.js
│   │   ├── auth.router.js
│   │   ├── budgets.router.js
│   │   ├── dashboard.router.js
│   │   ├── market.router.js
│   │   ├── planning.router.js
│   │   ├── portfolio.router.js
│   │   ├── reports.router.js
│   │   ├── rockenue.router.js
│   │   ├── scraper.router.js      # Shadowfax
│   │   ├── sentinel.router.js     # Sentinel API
│   │   ├── support.router.js
│   │   └── users.router.js
│   ├── utils/
│   │   ├── report-templates/      # HTML templates for PDF generation
│   │   ├── benchmark.utils.js     # Pacing Benchmark Logic
│   │   ├── db.js
│   │   ├── email.utils.js
│   │   ├── emailTemplates.js
│   │   ├── market-codex.utils.js  # WAP/Trend Logic Hub
│   │   ├── middleware.js
│   │   ├── pacing.utils.js
│   │   ├── pdf.utils.js
│   │   ├── report.generators.js
│   │   └── scraper.utils.js       # Playwright Logic
│   ├── daily-refresh.js
│   ├── initial-sync.js
│   ├── ota-crawler.js
│   ├── send-scheduled-reports.js
│   └── sync-rockenue-assets.js
├── web/
│   ├── build/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # shadcn/ui components
│   │   │   ├── App.tsx            # God Component
│   │   │   ├── Budgeting.tsx
│   │   │   ├── CloudbedsAPIExplorer.tsx
│   │   │   ├── CreateBudgetModal.tsx
│   │   │   ├── CreateScheduleModal.tsx
│   │   │   ├── DashboardControls.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── DemandPace.tsx     #
│   │   │   ├── DynamicYTDTrend.tsx
│   │   │   ├── HotelDashboard.tsx #
│   │   │   ├── HotelManagementTable.tsx
│   │   │   ├── InitialSyncScreen.tsx
│   │   │   ├── InsightsCard.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── LandingPage.tsx
│   │   │   ├── ManageCompSetModal.tsx
│   │   │   ├── ManageSchedulesModal.tsx
│   │   │   ├── MarketCompositionCardAlt.tsx
│   │   │   ├── MarketDemandPatterns.tsx
│   │   │   ├── MarketOutlookBanner.tsx
│   │   │   ├── MarketRankingCard.tsx
│   │   │   ├── MewsOnboarding.tsx
│   │   │   ├── MiniMetricCard.tsx
│   │   │   ├── MyProfile.tsx
│   │   │   ├── NotificationBell.tsx # Sentinel Async Bell
│   │   │   ├── PerformanceChart.tsx
│   │   │   ├── PortfolioOverview.tsx
│   │   │   ├── PortfolioRiskOverview.tsx
│   │   │   ├── PrivacyPolicy.tsx
│   │   │   ├── PropertyHubPage.tsx # Rate Replicator Engine
│   │   │   ├── ReportActions.tsx
│   │   │   ├── ReportControls.tsx
│   │   │   ├── ReportSelector.tsx
│   │   │   ├── ReportTable.tsx
│   │   │   ├── SentinelControlPanel.tsx
│   │   │   ├── SentinelRateManager.tsx #
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── ShadowfaxPage.tsx
│   │   │   ├── ShreejiReport.tsx
│   │   │   ├── SupportPage.tsx
│   │   │   ├── SystemHealth.tsx
│   │   │   ├── TermsOfService.tsx
│   │   │   ├── TopNav.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   └── YearOnYearReport.tsx
│   │   ├── index.css
│   │   └── main.tsx
├── scripts/
│   ├── import-monthly-history.js
│   └── import-daily-history.js
├── server.js
└── vercel.json

7.0 DEVELOPER TOOLING & CRONS
Crons

daily-refresh.js

365-day forecast refresh

send-scheduled-reports.js

Generates + emails reports

sync-rockenue-assets.js

Syncs internal ledger

Hybrid future model

Receiver → Processor → Reconciliation scripts (planned)

Jobs

initial-sync.js

5-year PMS history import

Developer Tools

import-monthly-history.js (monthly → daily engine)

import-daily-history.js (CSV straight to DB)