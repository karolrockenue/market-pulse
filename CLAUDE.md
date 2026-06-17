# Market Pulse + Sentinel — Project Spine

This file is the always-loaded context for every AI session. It is intentionally lean. Deep reference lives in `claude/` and is **lazy-loaded** — see the Reference Catalog below and pull only what your task needs.

---

## 0. AI PROTOCOL (binding, applies before any code change)

### Lazy-load `/claude`

Do **NOT** auto-read every file in `/claude` at session start. Consult the Reference Catalog (§3) and load only the topical docs your task touches. Memories in `/Users/karolmarcu/.claude/projects/.../memory/MEMORY.md` are already loaded — use them.

### Analyze first

Read all project files relevant to the task. Do not start coding before you understand which layer (frontend / backend / DB) and which module owns the logic.

### Plan before code

Before any code change, output a short bullet-point plan. Wait for explicit user approval before writing code. (Exception: if user explicitly asks for "full file replacement", you may skip incremental patches for that request only.)

### Search & Replace format (DEFAULT — STRICTLY ENFORCED)

When proposing code changes you MUST output exactly **two separate fenced code blocks**:

- The first block: only the exact code to FIND.
- The second block: only the exact code to REPLACE it with.

**Forbidden:**
- Placing FIND and REPLACE in the same code block
- Labelling FIND/REPLACE inside a snippet
- Combining them under comments, headers, or separators
- Including any labels, comments, or words like "FIND" / "REPLACE" / "before" / "after" inside the code blocks

If FIND and REPLACE appear in the same code block: output is INVALID → STOP → apologize → re-output correctly.

Each code block must be directly copy-pasteable into VS Code search/replace without modification. Any explanation must be written outside the code blocks.

### Other rules

- **Clarify ambiguity** — if any function, file, or data flow is unclear, ask. Do not invent endpoints, types, or tables.
- **One logical area at a time** — modify one logical area per instruction (e.g. one React feature file, or one router + its service). Refactors that span multiple files: keep changes tightly scoped and clearly grouped.
- **Minimal comments** — structural clarity only, no chatty noise.
- **Incremental testing** — after each non-trivial change, provide a Test Checklist (what to run, what a "pass" looks like).
- **Request missing files** — if you need a file (e.g. a hook, service, component) and it's not provided, explicitly ask rather than guessing.
- **Strict non-hallucination** — never invent endpoints, tables/columns, file names/paths, types/interfaces, business rules or formulas. Everything must match existing sources. If uncertain, ask.

---

## 1. SYSTEM ONE-PAGER

**Market Pulse** = data hub + UI shell for ~39 hotels (Rockenue-managed and external). Owns hotels, users, KPIs, market data, reporting.

**Sentinel** = AI pricing engine that lives inside Market Pulse. Pushes rates to PMSes (Cloudbeds, Mews) via a PMS-siloed adapter layer (`pmsRegistry.js`). DGX home server runs the Python yield engine; Node.js handles orchestration + queue + UI.

**Stack:** Node.js + Express on Railway, React SPA (Vite + TS), Neon Postgres, Tailscale tunnel to DGX. Logging via pino, errors via Sentry, crons via in-process `node-cron`.

**Domain split:**
- `/api/sentinel/*` — Sentinel only (admin-gated, with a rate-viewer whitelist).
- `/api/metrics`, `/api/hotels`, `/api/market`, `/api/admin`, `/api/auth`, `/api/users`, `/api/webhooks`, `/api/mason`, `/api/iceland` — Market Pulse domains.
- `/api/bridge/*` — Node ↔ DGX (`x-api-key`).
- `/api/mews/*`, `/api/mews-webhooks` — Mews onboarding + webhooks.

**Two PMS adapter layers** (see `claude/architecture/backend.md`):
- Generic: `cloudbedsAdapter.js`, `mewsAdapter.js`
- Sentinel-focused: `sentinel.adapter.js`, `mews.sentinel.adapter.js`

---

## 2. CRITICAL GUARDRAILS (read the linked doc before touching the area)

These are the load-bearing rules. Each one has a known incident behind it. One-line summary here, full context in the linked doc.

| # | Rule | Load this before touching |
|---|---|---|
| 1 | `rate_id_map` is **fill-only** — never overwrite existing entries; three writers must all respect this | `claude/sentinel/rate-id-map.md` |
| 2 | **DGX is the only pricing engine.** `pricingEngine.calculateSellRate` / `previewCalendar` are VIEW-ONLY — never wire them as writers to `sentinel_rates_calendar` or `sentinel_job_queue` | `claude/sentinel/dgx-only-pricing.md` |
| 3 | **All rate saves go through `POST /api/sentinel/rate-overrides`** → `sentinel_rate_overrides` table. Calendar `source='MANUAL'` is NOT an override; autopilot will overwrite it. No silent fallbacks. | `claude/sentinel/override-model.md` |
| 4 | **Cloudbeds Insights `dataset_id=7`** — do not add derived columns `adr`/`occupancy`/`revpar` to `columnsToRequest`; Cloudbeds returns 400 for the whole query. Compute locally. | `claude/pms/cloudbeds.md` |
| 5 | **Mews UTC → local-date** — never slice a UTC string; use `utcToLocalDate(utcStr, timezone)`. BST off-by-one bug labelled every Mews snapshot a day early. | `claude/pms/mews.md` |
| 6 | **Cloudbeds OAuth scopes** — adding a scope requires fleet-wide re-consent. Refresh tokens cannot upgrade scopes. | `claude/pms/cloudbeds.md` |
| 7 | **pg pool timeouts in `api/utils/db.js`** are load-bearing. Without them, Neon idle-drops accumulate and the process hangs. | `claude/infra/db-pool.md` |
| 8 | **Dual-endpoint property fallback** — any UI surface admins + non-admins both reach must try `/api/hotels` then fall back to `/api/hotels/mine` on 403. Single-endpoint calls break silently for the non-admin half. | `claude/architecture/access-model.md` |
| 9 | **Daily max rates** — engine reads ISO-date keys (`'YYYY-MM-DD'`), not month-day shorthand. `sentinelService.getDailyMaxRatesIsoMap` is the engine-safe reader. | `claude/sentinel/database-schema.md` §4.5 |
| 10 | **`JSON.stringify` on Postgres JSONB is order-unstable** — config-change comparisons must sort keys first, or every config save triggers a false-positive full-year recalc. | `claude/sentinel/pricing-formulas.md` §6 |
| 11 | **Daily-refresh fleet failures** must alert, not silent `catch → continue`. Cloudbeds CDF 400 silently took down the whole fleet for 2 days in May 2026. | `claude/architecture/observability.md` |
| 12 | **Cron-scheduled reports** — `time_of_day` MUST be on 5-min boundaries or the row never fires. `<input type="time" step={300}>` enforces this now. | `claude/reporting/scheduled-reports.md` |
| 13 | **Scope = 'live'** in `/api/hotels/mine` — filter `prospect_status IS NULL OR prospect_status = 'live'`. `IS NULL` alone hides onboarded customers. | `claude/architecture/access-model.md` |
| 14 | **Channel Pricing is the live waterfall source** — Booking.com sell rate is sourced from `distribution_channel_pricing` + `distribution_hotel_pricing_overrides`. The legacy Control Panel "OTA Discount Stack" is dormant fallback only. Edit waterfalls on Rockenue → Channel Pricing. | `claude/sentinel/pricing-formulas.md` §1 + `claude/channel-pricing-migration.md` |
| 15 | **`daily_metrics_snapshots.rooms_sold` is SET, never incremented.** The Cloudbeds webhook re-reads affected stay-dates from scoped Insights and overwrites — same source as the nightly refresh. Never reintroduce the old `±1` counter (it drifted → under-reported availability; Park 11-vs-45). | `claude/availability-webhook-resync-2026-06-15.md` |

---

## 3. REFERENCE CATALOG (lazy-load index)

Pull whichever files match your task. Each file is self-contained; cross-references in the format `claude/topic/file.md`.

### Sentinel — pricing engine

| File | Read when |
|---|---|
| `claude/sentinel/pricing-formulas.md` | Touching waterfall, guardrails, Navigator, decay logic, seasonality, mapping logic. |
| `claude/sentinel/database-schema.md` | Writing SQL against `sentinel_*` / `hotels` / `daily_metrics_snapshots` / `reservations`; debugging data integrity; understanding tables. |
| `claude/sentinel/api-reference.md` | Adding/modifying any `/api/*` endpoint, debugging 4xx/5xx, wiring UI to backend. |
| `claude/sentinel/override-model.md` | Anything touching rate save paths, `sentinel_rate_overrides`, the Park Hotel 2026-04-28 incident. |
| `claude/sentinel/rate-id-map.md` | Touching `sentinel_configurations.rate_id_map`, the matcher, `/sync` route. Fill-only rule. |
| `claude/sentinel/dgx-only-pricing.md` | Anything that writes `sentinel_rates_calendar` source='SENTINEL' or `sentinel_job_queue`. View-only rule. |
| `claude/sentinel/health.md` | Sentinel Health surface (admin), `sentinel_hotel_heartbeat`, freshness SLA. |
| `claude/sentinel/dgx.md` | DGX integration, AI Bridge, manual vs cron trigger modes, cron schedule. |

### PMS adapters

| File | Read when |
|---|---|
| `claude/pms/cloudbeds.md` | Cloudbeds adapter, OAuth scopes, Data Insights, `dataset_id=7` trap, scope changes. |
| `claude/pms/mews.md` | Mews adapter, UTC trap, webhook idempotency, multi-service capture, scope limitations. |

### Architecture

| File | Read when |
|---|---|
| `claude/architecture/backend.md` | Adding/modifying a router, service, adapter; understanding Railway migration. |
| `claude/architecture/frontend.md` | Working on the React SPA, feature modules, components, hooks. |
| `claude/architecture/observability.md` | Adding logs, debugging, working on cron jobs, fleet alerting. |
| `claude/architecture/access-model.md` | Auth, roles, `user_properties`, property dropdown traps, magic-link login. |
| `claude/infra/db-pool.md` | Touching `api/utils/db.js` or debugging "site up but DB queries hang". |

### Data / Market Intelligence

| File | Read when |
|---|---|
| `claude/data/market-codex.md` | Market scraper, WAP / segment WAP / PDI formulas, `market_availability_snapshots`. |
| `claude/data/demand-radar.md` | Demand Radar page, PredictHQ, booking-behavior endpoint. |
| `claude/data/accommodation-map.md` | OpenStreetMap supply map, Overpass API, `city_accommodation_pois`. |

### Reporting

| File | Read when |
|---|---|
| `claude/reporting/scheduled-reports.md` | Cron-driven email dispatcher, `scheduled_reports`, `time_of_day` trap. |
| `claude/reporting/mason-fifth.md` | Mason & Fifth dashboards, Sales/Pacing Flash, M&F endpoints + budgets. |
| `claude/reporting/external-studies.md` | Investor study scraper for external (non-PMS) hotels (Ellen Kensington pattern). |

### Markets

| File | Read when |
|---|---|
| `claude/markets/iceland.md` | Reykjavík dashboard, `hotel_inventory`, Tier A enrichment, sales-floor surface. |

### UI

| File | Read when |
|---|---|
| `claude/ui/style-guide.md` | Any UI work — palette, deprecated colours, presentation-multiplier note. |

### Fleet

| File | Read when |
|---|---|
| `claude/fleet/inventory.md` | Need to map a hotel name to system ID, check purge/disconnect status. |

### Side projects (siloed)

| File | Read when |
|---|---|
| `claude/side-projects/airbnb-codex.md` | Working on the `airbnb-codex/` scraper. Do NOT integrate into Market Pulse UI/API. |

### Long-form incident / deep-dive docs (already in `claude/`)

These are existing snapshot docs referenced by the topical files above. Pull when the topical doc points you here.

- `claude/channel-pricing-migration.md` — full 5-phase plan for Channel Pricing migration (Phases 1-4 LIVE; Phase 5 held).
- `claude/cloudbeds-insights-cdf-2026-05-20.md` — Cloudbeds dynamic-CDF 400 incident post-mortem.
- `claude/availability-webhook-resync-2026-06-15.md` — availability drift (Park 11-vs-45) → authoritative webhook resync replacing the `±1` counter.
- `claude/sentinel-decay-fix-2026-05-07.md` — sell-every-room toggle dead-code incident + 3 bugs.
- `claude/sentinel-mews-rate-mapping-2026-05-07.md` — Belsize/Primrose silent flip + 8 hard rules.
- `claude/rate-override-implementation.md` — original override-model rollout deep-dive.
- `claude/rockenue/groups/mason-and-fifth.md` — authoritative Mason & Fifth spec (heavy doc; pull only when needed).
- `claude/rockenue/groups/shreeji.md` — Shreeji / Aaryan Capital portfolio spec.
- `claude/rockenue/groups/mason-stly-plan.md` — STLY backend implementation plan.
- `claude/crm-blueprint.md` — Sales CRM design.
- `claude/todo.md`, `claude/urgendedebug.md` — active in-flight scratch.

---

## 4. RETIRED / DO NOT REINTRODUCE

- **Shadowfax** (live scraper) — removed April 2026. All components, routes, services deleted.
- **Vercel** — migrated to Railway 2026-04-05. `VERCEL_ENV=production` is a compatibility shim only; do not introduce new Vercel-specific code.
- **Legacy `POST /api/sentinel/overrides` + `POST /hotel-overrides`** — removed in `32cd8fe` (2026-04-28). They wrote calendar source='MANUAL' only, which autopilot overwrites. See `claude/sentinel/override-model.md`.
- **`SENTINEL_OVERRIDES_ENABLED` / `SENTINEL_OVERRIDES_HOTEL_ALLOWLIST` env vars** — deleted with the legacy endpoints.
- **Old routers** (dashboard/planning/reports/portfolio/rockenue/budgets/property-hub/scraper) — deleted. All new work builds on the domain routers in `claude/architecture/backend.md`.

---

## 5. PROTECTED ASSETS (do NOT delete — survive any cleanup)

These are real, client-facing deliverables that live alongside throwaway mockups. If asked to "clean up Studio" (or the repo) you MUST keep them.

| Asset | What it is | Files | Studio link |
|---|---|---|---|
| **Rockenue Company Profile** | Dark, chain-quality company profile deck for Dubai Group Commercial Director outreach (built 2026-06-09). 7 slides incl. a live Booking.com Dubai rate matrix. | Source of truth: `output/rockenue-profile.{html,pdf}`. Served copy: `web/public/studio/rockenue-profile.{html,pdf}`. | Sidebar → **Studio → Rockenue Profile** (`extItem` in `web/src/components/AppSidebar.tsx`, marked `[PROTECTED]`). Opens `/studio/rockenue-profile.html` in a new tab. |
| **Rockenue Company Profile (UK)** | UK-angled, simplified variant for a non-expert UK hotel owner — plain copy, London rate matrix (rates currently illustrative, pending real scrape), UAE registration retained. | Source of truth: `output/rockenue-profile-uk.{html,pdf}`. Served copy: `web/public/studio/rockenue-profile-uk.{html,pdf}`. | Sidebar → **Studio → Rockenue Profile (UK)** (`extItem` in `AppSidebar.tsx`, marked `[PROTECTED]`). Opens `/studio/rockenue-profile-uk.html` in a new tab. |

Rule: when regenerating the deck, update **both** the `output/` source and the `web/public/studio/` served copy so the Studio link stays current.
