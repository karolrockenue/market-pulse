📄 MarketPulse_Sentinel_Archive.md
(FULL PROJECT HISTORY, NARRATIVE, CONTEXT & EVOLUTION ARCHIVE)
Pure Background — Not for AI Coding Sessions
0.0 ABOUT THIS DOCUMENT

This archive contains every piece of narrative, historical, exploratory, and deprecated information extracted from:

Sentinel Async Architecture Plan

The Sentinel – Blueprint

Project Log: Rate Replicator & Property Hub Refactor

Project Blueprint (Technical Handbook)

Archive Blueprint

Nothing here represents current logic.
Nothing here is used by File 1.
This is reference-only.

1.0 EARLY PROJECT HISTORY & CONTEXT
1.1 Original Vision for Market Pulse

Provide hotel operators with competitive intelligence.

Compare hotel KPIs (Occ, ADR, RevPAR) to a comp set.

View pacing, market demand, seasonality, neighborhood splits.

Build a long-term foundation integrating:

OTA scraping

PMS data ingestion

AI pricing heuristics

Daily refresh schedule

Entire system initially designed before Sentinel existed.

1.2 Birth of Sentinel

Sentinel was created due to:

Rate volatility in market

PMS APIs being too slow for real-time pricing

Need to separate rules from facts

Need a hybrid database

Need an async queue layer to avoid UI freezes

Desire for "AI-assisted" rate suggestions

Operational bottlenecks in manual revenue management

Growing portfolio of properties managed by Rockenue

Sentinel originally began as a prototype inside Market Pulse before becoming a structured module.

2.0 EARLY ARCHITECTURE, ATTEMPTS & ABANDONED IDEAS
2.1 Original (Deprecated) Control Panel Structure

Multiple versions of the room differential editor

Deprecated freeze-period strategies

Early versions of the padlock logic

Charts and UI tables that were later removed

A versioned approach to base rate sourcing

Early combinational logic for floors/freeze that was replaced by unified ordering

2.2 Abandoned Sync Strategies

Full webhook-driven sync was explored and abandoned temporarily

Some PMSs (Mews) required two-way reconciliation that was put on hold

A direct Cron-driven “Full Hourly Sync” was explored but archived

2.3 Deprecated Rate Manager UI Concepts

Color-coded wireframes

Split-screen advanced mode

“Sentinel AutoPilot” mode

Rate waterfall view that was not implemented

Original proposal for “AI Commentary” beside each rate

3.0 ARCHITECTURAL EVOLUTION
3.1 Transition from Multi-Service to Monorepo

Originally planned:

Dedicated rate service

Dedicated scraping service

Dedicated ML inference microservice

Eventually replaced with:

Vercel monorepo

Single server.js

Serverless routers

Unified build artifact

Static SPA served by Express

3.2 Why Tailwind Stopped Scanning

Vite build output changed

Static index.css not rebuilt

Tailwind scanning disabled

Forced shift to inline styles

Integration of shadcn/ui components

3.3 Cloudbeds Adapter v1 → v2 → v3

v1: direct rates push, no batching

v2: added token caching

v3: full batch push compatibility

Older token rotation logic is no longer used but stored historically.

4.0 SENTINEL DEVELOPMENT HISTORY
4.1 The Origin of Facts vs Rules

Originally, everything was mixed in one JSON

Caused confusion & bugs

Led to separation into:

Facts: PMS-derived

Rules: Sentinel-defined

Earlier combined model was deprecated.

5.0 RATE REPLICATOR — FULL HISTORICAL DEVELOPMENT LOG

This is the detailed “story” from the Rate Replicator project log.

5.1 The Problem (Historical Narrative)

Revenue managers could not predict actual OTA sell rates because:

Discounts stacked in non-intuitive ways

Genius, Mobile, Country Rate, Campaigns

Multiplier effects

Raw PMS rate never matched OTA final rate

Needed a transparent cascade

This motivated creation of the calculator.

5.2 Discarded Hypotheses

“Additive discounting” model → incorrect

Several proposed stacking orders → disproven

Early calcs tested against live Booking.com pull → mismatches

Confirmed true OTA flow is cascade-based

5.3 UI Evolution (Historical)

Started as inline row editor

Replaced by expand/collapse

Upgraded to side drawer

Added split view (Rules vs Simulator)

Final visual format validated via Figma

5.4 Full Work Log (From Source File)

Accordion created

Hybrid design merging real data with prototype

Temporal campaign logic added

Discount order fixed after test screenshots

Exact math engine created

Persistence connected to backend

Verified against OTA screenshots to “the penny”

Backward calculation prototype validated

6.0 SENTINEL ASYNC ENGINE HISTORY
6.1 Reasons for Creating Queue

Originally:

Rate pushes were synchronous

Cloudbeds API slow at times

UI froze while waiting for writes

Concurrency issues

Partial-failure edge cases

These led to creation of the async job queue.

6.2 Early Queue Attempts

First attempted “local memory queue”—removed

Then attempted batching inside router—caused delays

Final design moved to DB-backed queue

6.3 Notification System Backstory

Users had no visibility of failures

Added NotificationBell via shadcn Popover

Added persistent notifications table

Added mark-read functionality

UI mockups went through 3 revisions

7.0 SCRAPER & MARKET CODEX EVOLUTION
7.1 Shadowfax Price Checker

History includes:

Early Playwright with full Chrome → Vercel fail

Switch to playwright-core + @sparticuz/chromium

Required patching of Vercel build

Scraper utils redesigned

Integrated into Planning features

Later integrated into dashboard & forward view

7.2 Market Codex Logic Hub

Full context:

Created due to split logic across routers

Unified MPSS calculation

Added weighted average price as generated column

Performance accelerated by shifting compute to DB

Introduced “Split-Half” trend detection

Differentiated Recent vs Past periods (11-day split)

8.0 HISTORICAL MILESTONES (All Versions)
8.1 OTA Crawler & Deployment Fixes

Playwright build issues

Switch to chromium

Deployment stability achieved

8.2 Reliable Room Counts

total_rooms added

backfill endpoint created

occupancy_direct deprecated

8.3 Budgeting Feature History

Initial “traffic light” model

Required ADR concept

Unified benchmark logic introduced

bug: mismatch between dashboard & budgeting

fixed via benchmark.utils.js

8.4 React Migration

Alpine.js removed

/public deprecated

SPA created

Monorepo unified

404s fixed by serving index.html

8.5 Market Codex

Heavy compute moved into generated columns

New routers for forward view & pace

Logic centralized into utils

Trend detection developed

8.6 Historical Import Tools

Previously performed via manual SQL

Error prone

New script built to:

Lock years

Convert monthly → daily via pattern hotel

Ensure atomicity

8.7 Unified Dashboard

Replacement of old comp set page

New /dashboard/summary endpoint

Logic unification with planning logic

New cards, metrics, rankings

Removed inconsistent logic from routers

8.8 UI Standardization

Favicon replaced

Logo standardized to ( MARKET PULSE )

Alignment / spacing fixes

shadcn components standardized

9.0 DEPRECATED ITEMS (FULL LIST)
❌ Deprecated Sync Items

occupancy_direct

early webhook-based sync

full hourly sync proposal

❌ Deprecated Sentinel Items

old padlock logic

old differential engine versions

earlier freeze logic

alternate rate order stacks

early min/max logic attempts

deprecated JSON structures

❌ Deprecated UI Components

early rate manager versions

wireframe-only views

old Favicon.tsx

old prototype icons

unused charts from early MP

❌ Deprecated Architectural Ideas

multi-microservice design

separate ML inference service

standalone rate push service

direct OTA scraping as official feature

local in-memory queues

10.0 DEBUGGING STORIES (EXTRACTED FROM SOURCES)
10.1 Playwright Build Failures

chromium mismatch

missing dependencies

cold start failures on Vercel

fixed by using @sparticuz

10.2 Occupancy Calculation Bug

Two different formulas in two routers

Caused dashboard vs budgeting mismatch

Fixed via unified logic hub

10.3 Rate Manager State Bugs

pending vs saved confusion

padlock misalignment

rate not updating after freeze

resolved through new guardrail ordering

10.4 OTA Discount Verification

mismatches reproduced with screenshots

discount application order corrected

deep deals fork discovered

11.0 FULL NARRATIVE FROM EACH SOURCE FILE

This section contains verbatim-style content filtered for narrative, not rewriting logic:

11.1 Sentinel Blueprint Narrative

Describes intent behind hybrid data model

Rationale for async model

Rationale for UI/UX decisions

Backstory behind rate manager grid

Discussion regarding padlock concept

High-level intentions of “Activation Card” concept

Notes on phase-based rollout plan

11.2 Async Architecture Plan Narrative

Describes the need for a Kick → Worker model

Backstory behind DB queue design

Reason for moving writes out of UI thread

Discussion about cloudbedsAdapter limitations

Historical notes on Feature Flagging Sentinel

11.3 Archive Blueprint Narrative

Contains Market Pulse multi-year project history

Architectural pivots

Deployment migration notes

Evolution of pacing logic

Early challenges with data accuracy

Details about switching from Alpine.js

Notes about concurrency issues

Notes about inconsistencies across routers

11.4 Rate Replicator Narrative

Full story of initial additive hypothesis

Verification cycle

UI design iterations

Backwards calculation motivation

Intended use-case (training revenue managers)

12.0 OPEN QUESTIONS, FUTURE IDEAS (NON-FINAL)

These appeared in source documents but were NOT part of final logic:

Sentinel full automation mode

Dynamic rule sets (seasonal differentials)

Two-way PMS webhooks with reconciliation engine

Automated LMF tuning

Market-driven AI pricing

DGX distributed training loop

Integration of external demand signals (PredictHQ)

Shadowfax 2.0 global scraper

13.0 ANYTHING REMOVED FROM FILE 1

Everything in this archive was specifically removed from File 1 because:

It is narrative

It is historical

It is exploratory

It is deprecated

It is not the final architecture

It is not used in current logic

It pollutes the deterministic blueprint

This archive functions as the master background that can be consulted only when needed for deep context.