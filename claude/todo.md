# To Do

## 🚨 URGENT — Sentinel follow-ups from Durrant House incident (2026-04-10)

Context: Hotel 318344 (Durrant House, Cloudbeds) was briefly placed on autopilot during onboarding before daily max rates were populated. The hourly DGX cycle pushed Jacuzzi rates at £660 (= £400 × 1.65) instead of being clamped to the £286 daily ceiling. Root cause was a key-format mismatch in `previewCalendar` — fixed in commit `47481e6` ("Use ISO date keys for daily max rates in Sentinel engine path"), see Blueprint §4.5 for the full incident note.

The fix closes the immediate bug but the incident exposed several latent issues. **The first item below is the single biggest preventer for the next Durrant** — please prioritise it.

### 1. Operational guardrail — block autopilot until daily max rates exist (HIGH)

- **Where**: `api/services/sentinel.service.js:updateConfig` (around line 627), and the autopilot toggle in `web/src/features/sentinel/components/ControlPanel/ControlPanelView.tsx`.
- **What**: When a user tries to set `is_autopilot_enabled = true`, refuse the save unless `sentinel_daily_max_rates` for that hotel has at least N (e.g. 300) rows with `stay_date >= CURRENT_DATE AND stay_date < CURRENT_DATE + INTERVAL '365 days'`. Surface a clear error in the UI: "Autopilot requires daily max rates set for the next year. Click 'Edit Max Rates' first."
- **Why**: This is the single change that would have prevented the Durrant incident regardless of any code bugs. Code bugs come and go; the operational guardrail catches them all.

### 2. `saveDailyMaxRates` year-2025 hardcode (MED)

- **Where**: `api/services/sentinel.service.js:62` — `const year = 2025;`
- **Symptom**: Every save through the dialog → `POST /api/sentinel/max-rates/:hotelId` writes 365 rows with stay dates in year 2025 (the past). They're invisible to every consumer because every consumer filters `stay_date >= CURRENT_DATE`. The dialog appears to "save" but the data is dead-on-arrival.
- **Why nothing seemed broken**: A separate writer in `updateConfig` (line 648-691) handles `daily_max_rates` correctly for `currentYear` and `currentYear+1` whenever the full config is saved. So users who saved via the full Config save flow got working rows; users who saved only via the dialog got trash rows. Durrant's 365 rows for 2025 sitting in `sentinel_daily_max_rates` are exactly this trash.
- **Fix**: Make `saveDailyMaxRates` accept ISO date keys (`YYYY-MM-DD`) directly, drop the year=2025 translation, expand to `currentYear` AND `currentYear+1` like `updateConfig` does. Frontend dialog stays month-day internally, conversion happens at the API boundary in `web/src/features/sentinel/api/sentinel.api.ts`.
- **Cleanup**: After fix, run `DELETE FROM sentinel_daily_max_rates WHERE EXTRACT(YEAR FROM stay_date) = 2025` to clear the trash. ~365 rows × N hotels.

### 3. `POST /api/sentinel/overrides` doesn't capture `changedBy` (LOW but useful)

- **Where**: `api/routes/sentinel.router.js:1494-1559` — destructures `{hotelId, pmsPropertyId, roomTypeId, overrides, source}` from `req.body`, calls `sentinelService.buildOverridePayload(...)` with only 5 args. The function signature defaults `changedBy = null`.
- **Symptom**: Every MANUAL row in `sentinel_price_history` written by the admin Rate Manager grid has `changed_by = NULL`. No audit trail of who clicked Submit.
- **Compare with**: `POST /api/sentinel/hotel-overrides` (line 174) which passes `changedBy = req.user?.internalId || req.user?.cloudbedsId || "unknown"`.
- **Fix**: Add `changedBy = req.user?.internalId || req.user?.cloudbedsId || "unknown"` and pass as 6th arg to `buildOverridePayload`. Then we can answer "who triggered this MANUAL write?" next time something mysterious shows up.

### 4. "Apply AI" button saves predictions as `MANUAL`, not `AI_SUGGESTED` (MED)

- **Where**: `web/src/features/sentinel/hooks/useRateGrid.ts:425-429` — payload is `{date, rate, source: aiApprovedPending.has(date) ? "AI_SUGGESTED" : "MANUAL"}`. The per-item `source` is silently dropped because the router (`sentinel.router.js:1496`) reads `source` from the **top level** of `req.body`, not from each override item. The router default `source || "MANUAL"` then applies to every row.
- **Symptom**: When a user clicks "Apply AI" → "Submit", the AI predictions get saved as `source='MANUAL'` instead of `source='AI_SUGGESTED'`. This is what produced the 178 MANUAL base-room rows on Durrant 2026-04-10 at 15:54 (the previous Claude session must have clicked Apply AI → Submit while investigating, and the writes came through tagged MANUAL).
- **Fix**: Either lift `source` to top-level in the frontend payload (one source per submit batch — easy), or have the router accept per-item `source` (more flexible — harder). The first option is fine. Together with item 3 above, the audit trail then shows "who, when, what".

### 5. Phantom `Delete 1`–`5` rooms cleanup (LOW, cosmetic)

- **Where**: `sentinel_configurations.room_differentials` and `pms_room_types.data` for hotel 318344 (and possibly other freshly onboarded Cloudbeds hotels with similar phantom rooms).
- **Symptom**: Six rooms named `Delete 1`–`Delete 5` (plus a duplicate) live in the config with `+0%` differentials. They're 1 unit each, clearly flagged for deletion in Cloudbeds. Currently saved by `buildRateIdMap` not finding rate plans for them (so they're absent from `rate_id_map` and `recalculateRates` skips them), but they're noise in the calendar grid and the room differentials list.
- **Fix**: On hotel sync (`sentinel.router.js:1067-1091`), filter out room types whose name matches `/^delete\s*\d/i` before saving `pms_room_types`. Also strip any matching entries from `room_differentials` in `updateConfig`'s sanitisation step (line 695-707).

### 6. Trash data cleanup for hotel 318344 (LOW, one-shot SQL)

After items 1-5 ship:

```sql
-- 1. Drop the year-2025 trash from sentinel_daily_max_rates for ALL hotels
DELETE FROM sentinel_daily_max_rates WHERE EXTRACT(YEAR FROM stay_date) = 2025;

-- 2. Phantom Delete rooms — manual cleanup, requires looking at hotels.pms_room_types JSONB
--    Easier to just re-sync the hotel from Cloudbeds after item 5 is shipped.
```

---

## 🛡️ System Health Watchdog — Continuous QA / Automated Safety Net

### Why this section exists

The bugs that have hurt us most in production are **silently-wrong-numbers, not crashes**. The Durrant House incident (2026-04-10) is the canonical example: a one-line key-format mismatch in `getDailyMaxRates` caused `previewCalendar` to silently fall back to the global `£400` cap instead of the correct `£286` daily ceiling, and derived rooms got pushed at `£400 × 1.65 = £660` to Cloudbeds. Nothing threw. Sentry stayed green. `/health` kept returning 200. Pino logs looked clean. The bug had been live for an unknown amount of time and was only caught because Karol happened to notice a suspicious number in the Cloudbeds activity log during onboarding.

This failure mode is going to recur. The Sentinel pricing pipeline has too many moving parts (Node engine ↔ Python DGX engine ↔ pmsRegistry ↔ two PMS adapters ↔ queue worker ↔ bridge), the math is complex (guardrails, differentials, seasonality, freeze windows, LMF, pace curves, autonomy gates), and every refactor is a chance to silently break one of the cross-file invariants without any test going red. The existing observability stack (Sentry, pino, Railway uptime, `/health`) is useless against this class of bug because it measures *system* health, not *business correctness*. Every past incident has been invisible to all of it.

The goal of this section is to codify a **continuously-running QA layer** that watches for "things that should never be true" at the business-logic level — not at the HTTP level. Every time an incident happens and we understand its root cause, the fix should be: (a) fix the bug, (b) add a new invariant to this watchdog so the same class of bug cannot silently bite twice. The watchdog becomes an accumulating memory of everything we've learned the hard way.

Note on framing: this is a **safety / QA enhancement**, not a security enhancement in the infosec sense. Naming it "System Health Watchdog" to avoid confusion with auth/vuln work.

### What the existing stack does NOT catch

- Wrong arithmetic that still returns a number.
- Silent fallbacks when a lookup key format drifts.
- Rows written with the wrong `source` tag.
- Autopilot turned on when preconditions (daily max rates, pace curves, min rates) are missing.
- Orphan/phantom config state (e.g. `Delete 1`–`Delete 5` rooms) that survives onboarding.
- Two code paths that used to agree and now disagree (Node engine vs Python DGX engine).
- Queue jobs failing in patterns that indicate a class of bug (e.g. Mews throttling storms).
- Predictions stopping being generated for a hotel (DGX dead, or a specific hotel's config is broken).
- The `guardrail_max` being applied to base but not re-clamped post-differential.

Every single item on that list is a failure we have actually hit, or a bug the urgent.md verification notes identified as latent.

### Options — ordered by value-for-effort

#### Tier 1 — Would have caught Durrant, low effort

**Option A. Invariant probes (hourly SQL cron)** — *the single biggest ROI item on this list*

A new `api/watchdog/` module. A `node-cron` job (gated by `RAILWAY_ENVIRONMENT_NAME`, same pattern as existing crons) runs every 60 minutes and executes a list of "things that should never be true" as plain SQL. Any failure writes to `sentinel_notifications` (tier: `WATCHDOG`) and optionally fires a Slack/email alert.

Starter set of checks — each one is a single SQL query and each one maps to an actual past incident:

1. **Post-differential guardrail violation** — catches Bug B from urgent.md (the Durrant symptom).
   ```sql
   SELECT c.hotel_id, c.stay_date, c.room_type_id, c.rate, cfg.guardrail_max
   FROM sentinel_rates_calendar c
   JOIN sentinel_configurations cfg ON cfg.hotel_id = c.hotel_id
   WHERE c.stay_date >= CURRENT_DATE
     AND c.rate > (cfg.guardrail_max::numeric * 2.0)  -- beyond any sane differential
     AND c.source IN ('SENTINEL','AI_SUGGESTED');
   ```

2. **Autopilot without daily max rates** — catches the operational gap behind Durrant.
   ```sql
   SELECT hotel_id FROM sentinel_configurations cfg
   WHERE is_autopilot_enabled = true
     AND (SELECT COUNT(*) FROM sentinel_daily_max_rates d
          WHERE d.hotel_id = cfg.hotel_id
            AND d.stay_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '365 days') < 300;
   ```

3. **Year-2025 trash in daily max rates** — catches the `saveDailyMaxRates` hardcode bug.
   ```sql
   SELECT hotel_id, COUNT(*) FROM sentinel_daily_max_rates
   WHERE EXTRACT(YEAR FROM stay_date) < EXTRACT(YEAR FROM CURRENT_DATE)
   GROUP BY hotel_id HAVING COUNT(*) > 0;
   ```

4. **DGX silence per hotel** — catches a silent DGX death or a specific hotel whose config is broken enough that the engine skips it.
   ```sql
   SELECT h.hotel_id, h.property_name
   FROM hotels h
   JOIN sentinel_configurations cfg ON cfg.hotel_id = h.hotel_id
   WHERE cfg.sentinel_enabled = true AND h.is_disconnected = false
     AND NOT EXISTS (
       SELECT 1 FROM sentinel_ai_predictions p
       WHERE p.hotel_id = h.hotel_id
         AND p.created_at > NOW() - INTERVAL '3 hours'
     );
   ```

5. **Queue failure storm** — catches Mews throttling incidents like Mason & Fifth.
   ```sql
   SELECT hotel_id, COUNT(*) FROM sentinel_job_queue
   WHERE status = 'FAILED' AND updated_at > NOW() - INTERVAL '1 hour'
   GROUP BY hotel_id HAVING COUNT(*) >= 5;
   ```

6. **Phantom `Delete N` rooms in any config** — catches the onboarding cleanup miss.
   ```sql
   SELECT hotel_id, jsonb_array_elements(room_differentials) AS r
   FROM sentinel_configurations
   WHERE room_differentials::text ~* 'delete\s*\d';
   ```

7. **MANUAL writes with no `changedBy`** — catches the missing audit trail + the "Apply AI saves as MANUAL" bug.
   ```sql
   SELECT hotel_id, COUNT(*) FROM sentinel_price_history
   WHERE changed_by IS NULL AND source = 'MANUAL' AND created_at > NOW() - INTERVAL '24 hours'
   GROUP BY hotel_id;
   ```

8. **Differential multiplied a ceiling-pinned base** — the exact Durrant arithmetic check.
   ```sql
   SELECT c.hotel_id, c.stay_date, c.room_type_id, c.rate
   FROM sentinel_rates_calendar c
   JOIN sentinel_configurations cfg ON cfg.hotel_id = c.hotel_id
   WHERE c.stay_date >= CURRENT_DATE
     AND ABS(c.rate - (cfg.guardrail_max::numeric *
          (1 + COALESCE((SELECT (r->>'value')::numeric / 100
                         FROM jsonb_array_elements(cfg.room_differentials) r
                         WHERE r->>'roomTypeId' = c.room_type_id::text
                           AND r->>'operator' = '+' LIMIT 1), 0)))) < 0.01;
   ```
   (If any row matches to the penny, the engine pinned the base to the global cap — exact Durrant pattern.)

**Effort**: ~1 day to build the harness + wire to notifications, half a day to write the first 8 checks.
**Value**: every Durrant-class bug going forward gets a red light within 60 minutes of appearing in the calendar. New incident = add a new SQL file to `api/watchdog/checks/` and redeploy.
**Not a replacement for**: blocking preconditions (#1 in the URGENT section above). The probe tells you after the fact; the precondition prevents the save in the first place. Both matter.

---

**Option B. Pricing engine fixture tests** — *the permanent answer to "I refactored the engine and something silently broke"*

Create `tests/fixtures/pricing-engine/`. Pick 5–8 representative hotels that cover the important config shapes:
- Durrant House (ceiling-pinned days + big positive differentials)
- Mason & Fifth (Mews, post-onboarding)
- A hotel with large negative differentials
- A hotel with LMF active
- A low-season hotel with autopilot on
- A hotel with `rules.strategy_mode = 'sell_every_room'` (ruthless decay)
- A hotel with daily max overrides that differ from monthly

For each fixture: snapshot the full `sentinel_configurations` row, the relevant `sentinel_daily_max_rates` rows, the relevant `sentinel_pace_curves`, and the live PMS rate context. Save as JSON. Then run `previewCalendar` (and/or `buildOverridePayload`) against the fixture and compare the output to a committed `expected.json`.

Wire it two ways:
1. **In CI** on every commit touching `api/services/sentinel.*` or `api/adapters/sentinel*` → build fails if any fixture drifts.
2. **As an hourly watchdog** in prod using the same harness → tells you if the live DB state (daily max rates, differentials, etc.) has drifted away from the fixture assumptions.

**Effort**: ~1–2 days to set up with Vitest or `node --test`. Additive per incident.
**Value**: the Durrant daily_max_rates key bug (`'6-15'` vs `'2026-07-15'`) would have broken a fixture test the instant the code changed. This is the one place in the codebase where math-level correctness matters more than architecture and where snapshot testing actually pays off.
**Downside**: fixtures need to be regenerated when config shapes evolve legitimately (e.g. a new rule added to `sentinel_configurations.rules`).

---

#### Tier 2 — Catches whole classes of bugs, medium effort

**Option C. Pre-push sanity clamp in the queue worker** — *last line of defense*

Not a check — a circuit breaker. Inside `runBackgroundWorker` (`api/routes/sentinel.router.js:~1452`), before `postRateBatch` fires, compute `abs(outgoing_rate - last_pushed_rate_same_date) / last_pushed_rate` for every rate in the payload. If any single rate has moved by more than a threshold (e.g. 40%) in one cycle, freeze the job with a new `REVIEW` status and write a `sentinel_notifications` row ("Rate jump >40% detected — review before push"). The revenue manager approves or skips from the UI.

This is the "bodyguard" Karol wanted in the urgent.md incident: even when the engine has a latent bug, a 2.3× jump in Jacuzzi rates would be caught at the very last step before Cloudbeds.

**Effort**: ~30 lines in the worker + a `REVIEW` status in `sentinel_job_queue` + a minimal UI surface to list/approve/skip.
**Downside**: it also flags legitimate big moves (recovery from a long freeze, a first-time push on a newly onboarded hotel). Needs an allow-list for "first push" or a "force push" admin action.
**Value**: this is the thing that would have stopped the £660 rates from actually landing in Cloudbeds regardless of what bugs the engine had.

---

**Option D. Canary hotel / end-to-end dry run** — *integration-level confidence*

A test hotel (can be a real hotel flagged `is_canary = true`, or a synthetic one) with a known config and known expected outputs. A nightly job exercises the full pipeline:

`recalculateRates → queue → runBackgroundWorker → postRateBatch`

…in a **dry-run mode** where the adapter has a `dryRun: true` flag, logs what it would push, and does not actually call Cloudbeds/Mews. Compare the logged payload against a fixture.

**Effort**: medium. The main complexity is giving both `sentinel.adapter.js` and `mews.sentinel.adapter.js` a real dry-run mode (useful for debugging anyway).
**Value**: the only thing in this list that catches integration-level bugs — e.g. a `pmsRegistry` routing regression, or an adapter chunking change that breaks mid-year dates, or a queue worker change that silently skips the last chunk. Unit tests on the engine won't catch those.

---

**Option E. Autopilot preconditions (blocking, not alerting)**

Already listed as item #1 in the URGENT section above. Mentioned here for completeness — it belongs in the watchdog taxonomy even though it's a refusal-to-save guardrail rather than a monitor. Single most leveraged "QA" you can build: converts an operational class of bug from "silent push to PMS" to "loud UI error." See the URGENT section for scope.

---

#### Tier 3 — Ambitious, situational value

**Option F. Shadow-mode diff (DGX Python engine vs Node JS engine)**

Two pricing engines exist: Python on the DGX (`sentinel_live.py`) and Node (`api/services/sentinel.pricing.engine.js`). They are supposed to agree, but they evolve independently — the ISO-date-key fix applied to the Node engine in commit `47481e6` needs to be verified against the Python side, and nobody today knows for certain that they're in sync. A shadow-diff job runs both engines on the same context, diffs their outputs, logs any discrepancy per hotel per date.

**Effort**: high. Requires exposing the Node engine as a callable from a standalone script (or vice versa) and wiring a comparison harness.
**Value**: this is the only thing that tells you when the two engines drift apart — which is a real, standing risk given the hybrid architecture and that each engine owns different write paths (Node writes from `recalculateRates` and `/overrides`; Python writes `sentinel_ai_predictions` via the Bridge).
**When to build**: after Tier 1 is in place and there's evidence of drift between the two. Not before.

---

**Option G. Scheduled Claude Code agent ("overnight QA briefing")**

Use the `/schedule` skill (already available in this environment) to run a Claude Code agent every morning that:
- Pulls the last 24h of `sentinel_notifications`, FAILED jobs, recent deploys, and any new MANUAL writes.
- Cross-references `git log` for touched files in `api/services/sentinel.*` and `api/adapters/*`.
- Writes a short "overnight status" brief to a file or Slack channel.
- Flags anything unusual but does NOT write code.

**Cost**: Claude API credits (small, ~1 run/day at most).
**Value**: closest thing to "QA always running in the background" in the literal sense. Slower and fuzzier than invariant probes, but catches things pure SQL can't — e.g. "the pricing engine was refactored yesterday, and since then the median push delta for Durrant has tripled, worth a look."
**Caveat**: treat it as a *briefing*, not an *alerting system*. If it becomes the primary safety net, it's being misused.

---

**Option H. Rate-push audit trail + diff UI**

Not a monitor — a forensic tool. Every push to PMS gets logged with the full decision context: base rate, which differential applied, which guardrail fired, which daily max won, ISO date, `changedBy`, commit SHA of the engine that made the decision. A simple admin UI surfaces: "for hotel X, date Y, here is exactly why we pushed £Z."

**Effort**: medium — mostly a new `sentinel_push_audit` table + a single admin page.
**Value**: what would have let the previous Claude session diagnose Durrant in 5 minutes instead of generating a 400-line handoff file. Every future incident becomes 10× faster to debug. Not preventative, but strongly compounds with every other option in this section.

---

### Recommended execution order

1. **Week 1**: Option A (invariant probes) + Option E (autopilot preconditions, already in URGENT list). These two together would have prevented both Durrant symptoms. Largest ROI on this whole list for the specific failure mode we keep hitting.

2. **Week 2**: Option B (fixture tests). Permanent defense against "I refactored the engine and something silently broke."

3. **Week 3**: Option C (pre-push sanity clamp). Insurance — catches whatever A and B missed before it lands in Cloudbeds.

4. **Later, when motivated**: Options D (canary), F (engine diff), H (audit trail). Option G (scheduled agent) is optional and should only be built once A+B are already answering the routine questions reliably.

### Principles for the watchdog

- Every incident should end with a new invariant added to Option A. The file accumulates institutional memory.
- Invariants are **business rules**, not system health. Datadog/Grafana cannot do this job — it has to live in the repo.
- Probes must be **idempotent and read-only**. They never fix anything; they notify.
- A probe that fires more than once per week on the same condition should either be tuned or promoted to a blocking precondition.
- When deleting a check, write a one-line comment explaining why — probes are cheap to keep and expensive to lose.

---

## Sentinel Worker — Mews Throttling on Full-Year Pushes

When pushing a full year of rates to a Mews property (e.g. new property onboarding, 365 days × 7 room types ≈ 2,500 rates → ~170 queue jobs per room type), the worker drains at only ~20 jobs/min because of the hard-coded 2000ms delay between jobs in `runBackgroundWorker` (`api/routes/sentinel.router.js:1452`). A year push takes ~20–25 minutes and still produces ~10 Mews "Conflicting operation is being performed" errors that fail permanently (no auto-retry — `attempts` column exists but is never incremented).

Observed on Mason & Fifth Primrose Hill (318343) onboarding 2026-04-10: 435 completed, 10 failed on throttle, had to manually requeue via SQL UPDATE.

Look into:
- Larger PriceUpdate chunks per API call (currently 50 in `mews.sentinel.adapter.js`, Mews may allow more — check their API docs / rate limits).
- Auto-retry for transient Mews errors ("Conflicting operation", 429, 503) using the `attempts` column with exponential backoff before marking FAILED.
- Separate "bulk push" mode that serialises per-rateId (so the same rate plan isn't hit concurrently) but parallelises across different rate plans.
- Dedicated worker lane for onboarding/bulk pushes so they don't contend with hourly autopilot pushes for other hotels.

## New Feature — Market Profile Page

### What It Is
A city-level market intelligence page that visualises data derived from months of daily OTA scrapes (Market Codex). The page shows the full market structure, pricing dynamics, booking velocity patterns, and neighbourhood demand for any city that has scrape data. Currently hardcoded to London, will be made dynamic.

### Where It Lives
- **Frontend**: `web/src/components/MarketProfile.tsx`
- **Backend**: 7 new endpoints in `api/routes/market.router.js` under `/api/market/profile/*`, all admin-only (`requireAdminApi`)
- **Service**: 7 new methods in `api/services/market.service.js`
- **Navigation**: Accessible from Sentinel dropdown > "Market Profile" (admin only)

### Data Source
All data comes from `market_availability_snapshots` table, populated daily by the Market Codex scraper (separate repo on Render). Each row contains:
- `city_slug`, `checkin_date`, `scraped_at` — identifies what and when
- `total_results` — total supply (properties available)
- `weighted_avg_price` — WAP (market ADR proxy)
- `min_price_anchor`, `max_price_anchor` — price range
- `facet_property_type` (JSONB) — Hotels, Apartments, Hostels, etc.
- `facet_neighbourhood` (JSONB) — supply by area
- `facet_star_rating` (JSONB) — supply by star rating
- `facet_price_histogram` (JSONB) — 50-bar price distribution

Currently have data for: London (170 scrape days), Las Vegas (62 days), Mykonos (14 days), Archanes (1 day).

### What The Page Shows (7 Sections)

**Row 1 — City KPIs** (6 cards)
- Total listed properties, Hotels only, Avg WAP, Weekend premium %, Peak WAP (month + DOW), Cheapest WAP (month + DOW)
- Endpoint: `GET /api/market/profile/overview?city=london`
- SQL: Queries latest scrape snapshot, calculates weekend vs weekday WAP, extracts property type counts from JSONB

**Row 2 — Market Composition + Seasonal Pricing Heatmap**
- Left: Property type breakdown with bars (from `facet_property_type` JSONB)
- Right: Month x Day-of-Week WAP heatmap — color-coded cells showing when the city is most expensive. Uses ~30 day lead time snapshots for consistency.
- Endpoint: `GET /api/market/profile/seasonal?city=london`
- SQL: Groups by month + DOW from all scrapes where lead time was 25-35 days, averages WAP. London data shows Dec Saturday (£281) is peak, Feb Sunday (£177) is cheapest.

**Row 3 — Booking Velocity + Price Dynamics**
- Left: DOW absorption curves (7 lines, one per day of week). Shows % of original supply remaining at each lead time (60d, 45d, 30d, 21d, 14d, 7d, 3d, 1d). Saturday drops to 67% by day 1, Sunday barely moves. Proves London is a weekend leisure market.
- Endpoint: `GET /api/market/profile/absorption-dow?city=london`
- SQL: Cross-joins each check-in date's snapshots with its baseline supply (earliest scrape at 60+ days out), calculates % remaining, groups by DOW.
- Right: WAP & Supply vs Lead Time for Saturdays. Bar chart (supply declining) + line (WAP at £234 at 90d dropping to £189 at 1d). Shows expensive properties sell first.
- Endpoint: `GET /api/market/profile/price-movement?city=london`

**Row 4 — Single-Date Absorption Curve + Star Rating Shifts**
- Left: Picks a specific future Saturday, plots supply + WAP from first scrape to arrival date. Shows the full booking lifecycle for one date.
- Right: Stacked bar chart showing 5/4/3/2 star composition changing over time. Shows whether budget or luxury sells out first.
- Endpoint: `GET /api/market/profile/absorption-date?city=london&date=2026-04-19` (returns both supply data and star ratings per snapshot)

**Row 5 — Market Compression + Neighbourhood Sell-Out**
- Left: Price spread (max_price_anchor - min_price_anchor) + WAP over 90 days forward. Narrow spread = compressed market (everyone pricing similarly = high demand). Wide = diverse/soft market.
- Endpoint: `GET /api/market/profile/compression?city=london`
- Right: Table showing which neighbourhoods absorb supply fastest. Compares supply from earliest scrape vs latest scrape for overlapping check-in dates. Tower Hamlets absorbs 10.3%, Camden 7.3%, West End only 1.2%.
- Endpoint: `GET /api/market/profile/neighbourhoods?city=london`
- SQL: Compares earliest scrape dates vs latest scrape dates for each neighbourhood from `facet_neighbourhood` JSONB, calculates absorption %.

### Exploratory SQL Queries
All queries saved in `city-profile-queries.sql` in project root. CSV results from London data saved in `claude/` folder (8 CSV files from April 1 2026 run).

### Current Layout (as of April 2026)
- Row 1: City KPIs (6 cards)
- Row 2: Property Types (composition bars) + Accommodation Map (NeighbourhoodMaps, moved here from DemandPace)
- Row 3: DOW Absorption curves + WAP & Supply vs Lead Time (charts flipped so 0d is on the left)
- Row 4: Single-date Absorption curve + Star Rating Breakdown (static bars, MOCK DATA)
- Row 4b: Price Bracket Distribution (full width histogram, MOCK DATA)
- Row 5: Market Compression + Neighbourhood Demand
- Row 6: ADR Seasonality Heatmap (full width, MOCK DATA)

### Data Source Shift — daily_metrics_snapshots for Seasonality
The OTA scrape data (market_availability_snapshots) only has partial month coverage — London has 170 scrape days but only covers Dec-May + Nov. The WAP heatmap looked great for those months but had gaps for Jun-Oct. Since Market Pulse hotels have 12+ months of real performance data in `daily_metrics_snapshots` (ADR, occupancy, revenue), we're switching the seasonality heatmap to use that instead. Filter: only hotels where `go_live_date` is 365+ days ago to ensure full-year coverage. This gives a complete 12-month x 7-DOW grid from actual hotel data, not OTA estimates.

### TODO for Market Profile
- Wire up mock widgets to real data:
  - **Star Rating Breakdown**: pull from `facet_star_rating` in latest scrape snapshot
  - **Price Bracket Distribution**: pull from `facet_price_histogram` in latest scrape snapshot
  - **ADR Seasonality Heatmap**: new endpoint querying `daily_metrics_snapshots` grouped by month x DOW, filtered to hotels with `go_live_date` <= NOW() - 365 days, city matched via `hotels` table
- Add date picker for the single-date absorption curve
- Neighbourhoods query was rewritten (per-checkin-date early/late matching) — verify it returns data for London
- City selector is functional (dropdown triggers re-fetch) but available cities list is hardcoded — could query the DB for cities with scrape data
- Style polish / cosmetic pass
- Consider adding: event overlay, price histogram from scrape facets

---

## Active Tasks

### ~~Investigate Booking Source Mix Data~~ DONE (April 2026)
- Source data is captured and surfaced in the Bookings Report
- Cloudbeds: full OTA names (Booking.com, Expedia, Airbnb, Miki Travel, etc.)
- Mews: generic origin only (ChannelManager, Distributor, Commander) — actual OTA names blocked by missing `sourceAssignments/getAll` permission

---

## Bookings Report & Reservations System (Built April 2026)

### What Was Built
- **`reservations` table** — stores individual reservation details (guest name, room type, dates, source, rates, status)
- **Bookings Report** — admin-only report in Reports Hub. Daily summary table (Date, Bookings, Room Nights, ADR, Revenue) with clickable accordion expanding to individual bookings (Guest Name, Room Type, Source, Arrival, Departure, Nights, Avg Rate, Total)
- **Webhook integration** — both Cloudbeds and Mews webhooks now upsert into `reservations` on every reservation event
- **Backfill script** — `scripts/backfill-reservations.js <hotel_id> [days]` supports both PMS types
- **Dashboard fix** — Recent Bookings widget now shows newest day first

### What Works
- Cloudbeds: guest names, room types, OTA sources, rates — all populated
- Mews: room types, rates, generic source — populated. Guest names NULL (permission issue)
- Cancelled bookings excluded from ADR/revenue totals, sorted to bottom of detail view
- When guest name is unavailable, reservation ID shown as fallback

### Mews Scope Limitations (Action Required)
Two Mews API permissions need to be enabled in the Mews Marketplace integration settings:
1. **`customers/getAll`** — enables guest names for Mews hotels
2. **`sourceAssignments/getAll`** — enables resolving actual OTA names (Booking.com, Expedia) instead of generic "ChannelManager"

No code changes needed once permissions are granted — re-run the backfill script to populate.

### Future Considerations
- **90-day rolling cleanup + aggregation**: not built yet, not needed at current scale. Table grows ~500 rows/day at 50 hotels. At 1,000 hotels (~16M rows/year, ~8GB), add a cron to compress old reservations into a `daily_booking_stats` aggregate table and delete detail rows older than 90 days
- **Mews-friendly source labels**: once `sourceAssignments/getAll` is available, map ChannelManager → actual OTA. Interim option: relabel Distributor → "Direct (Mews)", Commander → "Manual", ChannelManager → "OTA"
- **Source mix chart**: data is now available to build a channel mix breakdown (pie chart / bar) on dashboard or reports

### ~~Settings Page — PMS Disconnect Button~~ DONE (April 2026)
- Two-tier disconnect implemented: soft disconnect (Settings, preserves data) + hard delete (Admin, permanent)
- Endpoints: POST /api/hotels/:hotelId/disconnect, /reconnect, POST /api/hotels/delete
- Disconnected hotels filtered from dashboards, reports, sentinel, daily-refresh, queue worker
- is_disconnected column added to hotels table

---

### Competitive Rate Shopping Engine (DGX-Powered)

**What:** Allow each Market Pulse hotel to pick up to 5 competitor hotels. The DGX server scrapes those competitors' live rates from Booking.com 2-3 times daily across a 90-day forward window. Results flow back into Market Pulse and surface in Compset Intel as real property-level rate data — actual hotel names, actual prices, actual dates — instead of segment averages.

**Why:** This is the single biggest feature gap between Market Pulse and paid benchmarking tools (STR, CoStar, OTA Insight). Those tools charge £3,000-£12,000/year for backward-looking panel data. We'd offer forward-looking, real-time competitive rates for free. It makes the "you vs competitors" story concrete — revenue managers see exactly what Hotel X is charging for next Saturday, not a blurred segment average.

**Why the DGX:** The entire scraping operation runs on the DGX, which is already always-on with a Tailscale tunnel to Market Pulse. Zero load on the Vercel app. Market Pulse just stores compset selections and receives results via API (same Bridge pattern as the existing AI pricing pipeline). Without the DGX we'd need a separate VPS ($50-200/mo), deal with serverless limitations on Vercel, and manage browser memory/crashes on a machine not built for it. The DGX has overkill compute sitting idle and the infrastructure is already wired up — the scraper is just another cron job alongside sentinel_live.py.

**Architecture:**

1. **Database (Market Pulse side):**
   - New table: `hotel_compset_picks` — stores each hotel's 5 chosen competitors
     - `hotel_id` (int, FK to hotels)
     - `competitor_name` (text) — display name
     - `competitor_ota_id` (text) — Booking.com property ID or URL slug
     - `competitor_ota_url` (text) — full URL for the scraper
     - `created_at` (timestamptz)
   - New table: `compset_rate_snapshots` — stores scraped rate data
     - `id` (serial PK)
     - `hotel_id` (int) — the MP hotel this competitor belongs to
     - `competitor_ota_id` (text)
     - `competitor_name` (text)
     - `stay_date` (date)
     - `rate` (numeric) — scraped rate
     - `room_type` (text) — cheapest available or standard double
     - `availability` (boolean) — whether the property had availability
     - `source` (text) — e.g. "booking.com"
     - `scraped_at` (timestamptz)
   - Index on (hotel_id, competitor_ota_id, stay_date) for fast lookups

2. **Settings UI (Market Pulse frontend):**
   - New "My Compset" section on Settings page (or within Compset Intel page)
   - Search/autocomplete that queries the existing accommodation POI data (city_accommodation_pois) so users can find hotels by name in their city
   - User picks up to 5 competitors, confirms selection
   - Saves to hotel_compset_picks via new API endpoint
   - Shows current selections with ability to remove/replace

3. **API Endpoints (Market Pulse backend):**
   - `GET /api/hotels/:hotelId/compset-picks` — returns the 5 chosen competitors
   - `POST /api/hotels/:hotelId/compset-picks` — saves/updates competitor selections
   - `DELETE /api/hotels/:hotelId/compset-picks/:competitorId` — removes a competitor
   - `GET /api/hotels/:hotelId/compset-rates?startDate=X&endDate=Y` — returns scraped rate data for the hotel's compset, used by Compset Intel frontend
   - `POST /api/bridge/compset-rates` — bulk upsert endpoint for DGX to push scraped data back (protected by x-api-key, same as existing Bridge auth)

4. **DGX Scraper (Python, runs on DGX):**
   - New script: `compset_scraper.py`
   - On each run:
     a. Calls Market Pulse API to get all hotels and their compset picks (new endpoint: `GET /api/bridge/compset-manifest` — returns full list of what to scrape)
     b. For each competitor, launches Playwright headless browser through rotating residential proxy
     c. Navigates to Booking.com property page, checks rates for the next 90 days (can batch by check-in date ranges)
     d. Parses rate, room type, availability from the page
     e. Pushes results back to Market Pulse via `POST /api/bridge/compset-rates`
   - Concurrency: run 5-10 browser tabs in parallel (DGX has plenty of RAM)
   - Rate limiting: random delays between requests (2-8 seconds), rotate user agents, use residential proxies
   - Error handling: retry failed scrapes, log failures, skip and continue
   - Scheduling: cron job 2-3x daily (e.g. 06:00, 14:00, 22:00)
   - Estimated runtime per cycle: 105 competitors x 90 dates ÷ parallel workers = ~30-60 minutes per run

5. **Proxy Setup:**
   - Residential rotating proxy service (Bright Data, SmartProxy, or Oxylabs)
   - At current scale (21 hotels x 5 competitors = 105 properties): ~15-30GB/month bandwidth
   - Estimated cost: $20-40/month
   - Configure proxy URL as environment variable on DGX
   - Scales linearly: 200 hotels = ~$200/month in proxy costs, still very manageable

6. **Compset Intel Frontend Enhancement:**
   - When a hotel has compset picks with scraped data, Compset Intel shows:
     - Named competitors with their actual rates (not "Segment Avg")
     - Rate comparison chart: your rate vs each competitor over time (LineChart, same style as existing Performance vs Compset chart)
     - Daily rate table: date | Your Rate | Competitor A | Competitor B | ... | Avg
     - Availability indicators: show when competitors are sold out (opportunity signal)
   - Fallback: if no compset picks configured, show existing segment average view

7. **Data Freshness & Display:**
   - Show "Last scraped: 2h ago" timestamp in the UI
   - If data is older than 24h, show a warning
   - Historical rate data retained for trend analysis (don't delete old snapshots — they show how competitors moved their rates over time)

**Scale Projections:**
- 50 hotels: 250 competitors, ~$60/month proxies, ~2h scrape cycle
- 200 hotels: 1,000 competitors, ~$200/month proxies, ~4-6h scrape cycle (may need 2 parallel workers)
- 1,000 hotels: 5,000 competitors — would need dedicated proxy plan and possibly a second scraping node, but DGX can handle the compute

**Implementation Order:**
1. Database tables + API endpoints (Market Pulse backend)
2. Settings UI for compset picks (Market Pulse frontend)
3. DGX scraper script + proxy setup (Python on DGX)
4. Bridge endpoint for receiving scraped data
5. Compset Intel frontend to display named competitor rates
6. Cron scheduling on DGX

**Risks & Mitigations:**
- Booking.com blocks scraping → residential proxies + realistic browser fingerprints + rate limiting mitigate this. If blocked, rotate proxy provider or add Google Hotels as fallback data source.
- Rate data accuracy → always scrape "cheapest available" for standard double, 2 adults. Log the room type so discrepancies are visible.
- Stale data → if a scrape fails for a competitor, keep showing last known data with timestamp. Alert after 48h of failures.
- Proxy cost growth → monitor bandwidth usage. Consider scraping only changed dates (skip dates where rate hasn't changed in 24h) to reduce page loads by ~60%.

---

## Rockenue Hub — Distribution, CRM & Channel Pricing (Built April 2026)

### What It Is
A dedicated Rockenue internal ops hub for managing distribution channels, task management (CRM), and channel pricing waterfalls. Lives under a new "Rockenue" top-level dropdown in TopNav (admin-only), separate from Sentinel.

### Why It Was Built
The original Distribution page was a UI mockup under Sentinel with hardcoded data. We needed:
- A real CRM for tracking ops tasks across the team (onboardings, rate issues, content updates)
- Persistent distribution status tracking (which hotels are live on which OTAs)
- A way to manage OTA discount stacks (price waterfalls) at portfolio level with per-hotel overrides — previously this only existed for Booking.com in the Control Panel

### Where It Lives

**Navigation**: Rockenue dropdown (admin-only) with 4 pages:
- Dashboard — ops summary (task counts, overdue, team workload, distribution health)
- Distribution — hotel×channel status grid + channel registry
- CRM — task management (kanban, by hotel, by person views)
- Channel Pricing — OTA discount waterfall config with per-hotel overrides

**Frontend**: `web/src/features/rockenue/`
```
rockenue/
├── RockenueHub.tsx                    # View switcher
├── api/
│   ├── types.ts                       # TypeScript interfaces
│   └── distribution.api.ts            # API client (all endpoints)
├── hooks/
│   ├── useCrmTasks.ts                 # Tasks CRUD + optimistic updates
│   ├── useChannels.ts                 # Channels CRUD
│   └── useDistributionGrid.ts         # Grid fetch + cell updates
├── components/
│   ├── RockenueDashboard.tsx           # Ops overview cards + tables
│   ├── DistributionView.tsx            # Hotel×channel grid + channels tab
│   ├── CrmBoard.tsx                    # Kanban/hotel/person task views
│   ├── ChannelsRegistry.tsx            # Channel management (contacts, notes, config)
│   └── ChannelPricingConcept.tsx       # OTA waterfall config + overrides + simulator
```

**Backend**: `api/routes/distribution.router.js` mounted at `/api/distribution`
- All endpoints admin-only (`requireAdminApi`)
- ~30 endpoints covering: tasks, comments, subtasks, channels, contacts, notes, grid, team, channel pricing, hotel pricing overrides

**Database tables** (9 tables):
- `distribution_channels` — OTA partner registry (name, slug, type, commission, payment method, agreement, contract expiry)
- `distribution_channel_contacts` — contacts per channel
- `distribution_channel_notes` — internal notes per channel
- `distribution_hotel_channels` — hotel×channel status matrix (live/onboarding/suspended/none) + suspension reason/date/who
- `crm_tasks` — CRM tasks (title, description, hotel, channel, assignee, priority, status, category, due date, tags)
- `crm_task_comments` — comments + auto-logged activity (status changes, assignments)
- `crm_task_subtasks` — subtask items with done/order
- `distribution_channel_pricing` — portfolio-level waterfall steps per channel (JSONB)
- `distribution_hotel_pricing_overrides` — per hotel×channel overrides on the waterfall (JSONB)

### Key Features

**CRM Board**:
- Three views: Kanban (4 status columns), By Hotel (grouped table), By Person (team workload)
- Task detail slide-out panel with comments, subtasks, activity log
- Create task with multi-hotel and multi-channel selection (pick groups from management_group, individual hotels, multiple OTAs)
- Team members pulled from real users table (admin + super_admin)
- Activity auto-logging: status changes, assignee changes, priority changes

**Distribution Grid**:
- Hotel×channel status matrix (live/onboarding/suspended/none)
- Click cell → popover to change status
- Suspending requires a reason (modal) — stored with who/when
- Suspended cells show a blue info badge → click to see reason
- Filters: search, hotel groups, status filter
- Pipeline navigation: click "Create Task" on an onboarding cell → pre-filtered CRM task

**Channel Pricing** (the OTA waterfall system):
- **By Channel view**: left sidebar lists channels, right panel shows the waterfall steps (multiplier → discounts) with live simulator
- Each channel has its own waterfall template with real program names:
  - Booking.com: Multiplier, NRF, Genius (L1-L3), Long Campaign, Mobile Rate, Country Rate
  - Expedia: Multiplier, NRF, One Key Member (10-20% by tier), Mobile, Package Rate, Same-Day Deal
  - Agoda: Multiplier, NRF, VIP Platinum, Private Sale, Mobile, International Deal, Seasonal Campaign
  - Hotelbeds: Net Rate Multiplier, Early Booking, Last Minute, Long Stay (B2B wholesaler)
  - eDreams ODIGEO: Net Rate Multiplier, Prime Member, Prime Days
  - Miki Travel: Net Rate Multiplier (pure wholesaler, no consumer promos)
  - Direct: 1.00× (no markup), Returning Guest discount
- Steps are toggleable and editable (save to DB)
- Per-hotel overrides: expand a hotel to see a 5-column diff table (Step | Default | This Hotel | Running Total) showing exactly what's different
- **Matrix view**: all hotels × all channels showing effective sell rate at a given PMS rate
- **Simulator view**: side-by-side channel comparison with margin bars
- **Channel details**: collapsible info strip in the header showing agreement, commission, payment method, contract expiry, primary contact, notes
- **Add Channel**: slide-in panel with channel type, pricing model (net/gross), agreement, tier, payment method, integration type, commission, contract expiry, notes

### Design Decisions
- **Separate from Sentinel**: Distribution/CRM is ops work, not pricing engine. Different users, different workflows. Sentinel stays focused on AI pricing.
- **Portfolio defaults + per-hotel overrides**: Set the Booking.com waterfall once for all hotels, override only where needed (e.g. "Elysee gets 20% Genius instead of 15%", "Astor Victoria doesn't qualify for Genius"). One source of truth, no duplication.
- **Channel-specific program names**: Each OTA has different promo structures. The waterfall template is per-channel, not one-size-fits-all. Research conducted on real programs for Expedia, Agoda, Hotelbeds, eDreams, Miki Travel.
- **Suspension accountability**: Changing status to "suspended" requires a reason, stored with who and when. Visible via info badge in the grid.
- **Team from DB**: CRM assignees come from the users table (admin + super_admin), not hardcoded. Avatars with initials and color assignment.

### What Still Needs Work
- **Channel Pricing → Control Panel integration**: The existing Booking.com OTA discount stack in Control Panel (PromoConfigSection) needs to either read from the new `distribution_channel_pricing` table or be replaced entirely. Currently two separate systems — the old one per-hotel in `rockenue_managed_assets.calculator_settings` and the new one per-channel in `distribution_channel_pricing`. Need to unify.
- **Editable hotel overrides in Channel Pricing UI**: The override display (diff table) is read-only. Need inline editing + save for per-hotel overrides.
- **Distribution grid → Channel Pricing link**: Clicking a grid cell could navigate to the Channel Pricing page for that channel, pre-filtered.
- **Remove old Distribution files**: The original mockup files in `web/src/features/sentinel/components/Distribution/` are still on disk (DistributionView.tsx, CrmBoard.tsx, ChannelsRegistry.tsx). They're no longer imported anywhere but should be deleted.
- **CRM notifications**: Overdue task alerts, assignment notifications (email via SendGrid). The UI has notify/reminder/escalation toggles but they're not wired to backend yet.
- **Recurring tasks**: e.g. "Review Expedia rates every Monday" — not built yet.
- **File attachments**: CRM tasks reference attachment counts but no upload/storage system exists.
- **Channels tab in Distribution**: Still renders `ChannelsRegistry` — could be removed now that all channel config lives in Channel Pricing.
- **WhatsApp → CRM integration**: Option to connect WhatsApp Business API (via Twilio or Meta Cloud API directly) so that messages from hotel WhatsApp groups automatically create CRM tasks. Flow: hotel sends message with trigger keyword (e.g. #issue) → webhook hits backend → parses sender/hotel → creates CRM task → auto-replies with confirmation. Requires: Meta Business verification (under Rockenue Ltd or via colleague's verified account), a dedicated WhatsApp Business number, new webhook endpoint, group-to-hotel mapping table. Blocked on: getting WhatsApp Business API access (previous Meta account issues).

- **Mews onboarding auto-marks hotels as Rockenue-managed**: New Mews properties come in with `is_rockenue_managed = true` hardcoded in `api/routes/mews.onboarding.router.js` (§4a), so they show up in the admin "Managed" list automatically. This should not be the default — managed status should be an explicit admin toggle, not a side effect of onboarding. Fix: set `is_rockenue_managed = false` on insert, let admins flip it in the Admin Hub when appropriate. Also revisit the auto-created `rockenue_managed_assets` row (step 4c) — currently fires for every Mews hotel regardless of managed status; may want to gate it on the flag or keep it since Promo Config needs the row either way.

- **Default monthly min rate for fresh hotels should be 500, not 100**: `web/src/features/sentinel/hooks/useSentinelConfig.ts:38-49` seeds `monthly_min_rates` with "100" for all twelve months when a hotel has no saved config. £100 is too low for the portfolio — fresh hotels should default to £500 until the revenue manager sets real floors. Risk of the current default: if autopilot is flipped on before anyone touches the Control Panel, the pricing engine can ratchet rates down to £100 as the Min Rate anchor. Fix: change all twelve month defaults from "100" to "500" in that hook.

- **Control Panel "Differentials" badge reads as active even when no differentials are configured**: In the hotel row header of the Control Panel (`web/src/features/sentinel/components/ControlPanel/ControlPanelView.tsx:1884-1902`), the Differentials badge is always rendered, with blue styling when `hasDifferentials` is true and red styling when false. For users this reads as "always on" — the badge is visually identical in shape/position regardless of state, and the colour change isn't obvious enough to signal "not configured." Fix options: (a) hide the badge entirely when `hasDifferentials` is false, (b) make the "off" state much more muted (grey/outline only, no red) so it clearly looks inactive, or (c) add explicit text like "Differentials: Off" / "Differentials: 3 set" so the state is unambiguous. Same pattern may apply to the Seasonality badge just above — worth sanity-checking.

- **Default freeze period should be 0 (off), not 2**: `web/src/features/sentinel/hooks/useSentinelConfig.ts:28` sets `rate_freeze_period: "2"` in `DEFAULT_RULES`, so every fresh hotel comes in with a 2-day freeze window by default. This silently locks the first two days of the rate grid on brand-new hotels, which is surprising behaviour for onboarding. Freeze should be opt-in, not opt-out. Fix: change the default to `"0"` in that constant.

- **Run Sentinel should warn when pace curves are missing**: `handleRunSentinel` in `web/src/features/sentinel/components/RateManager/RateManagerView.tsx:289` fires the Bridge/DGX run without any precheck. If `sentinel_pace_curves` has no rows for the hotel, the pricing engine silently runs with empty targets (see `sentinel.bridge.service.js:72` where curves are fetched — empty result is passed through as `pace_curves: []`), so decisions are made without a pace anchor and it's easy to miss. Fix: before triggering the run, call `GET /api/sentinel/pace-curves/:hotelId`, and if no Low/Mid/High curves exist, show a blocking toast/modal: *"Pace curves are not configured for this hotel. Sentinel cannot yield against targets without them. Configure them in Control Panel → Pace Curves, or copy from another hotel via 'Copy Pace Curves'."* Offer a "Run anyway" escape hatch if needed. Same check should probably also guard the hourly DGX cron path — worth a think.

- **Mason & Fifth Primrose Hill — revenue mismatch vs Mews (future debug)**: Onboarded 2026-04-10. Reported revenue in Market Pulse doesn't match what the owner sees in Mews. Suspected cause: we're currently recording **posted revenue** (what's been charged/posted to the ledger) while the Mews figure they're comparing against is **sales rate** (the nightly room rate for the stay, before taxes/adjustments/posting timing). This is a known-unknown — not urgent, but flag for a deeper dive when we have bandwidth. Where to start: `api/routes/mews.webhooks.router.js` (ServiceOrderUpdated → orderItems/getAll revenue aggregation) and the `daily_metrics_snapshots.gross_revenue` write path. Compare against Mews "Sales" vs "Accounting" reports for the same date range to isolate which number is which.

---

## Local-only files discipline (prevent accidental commits / Railway build breaks)

### Why
Karol keeps experimental files in his working tree that he never wants to commit (e.g. `web/src/components/DeckV2.tsx`, `web/src/features/rockenue/components/WebsiteMockup/`). The current `.gitignore` only excludes `.vercel`, `node_modules`, `.env`, `.DS_Store`, `web/build` — so these local-only files show up in `git status`, can be accidentally staged, and (worst case, what happened on 2026-04-10) can leak references into committed files like `App.tsx` and break the Railway build because the imported file isn't in the repo.

### Three-layer fix

**Layer 1 — `.gitignore` patterns** (the foundation)

Append to `/Users/karolmarcu/Documents/market-pulse/.gitignore`:

```gitignore
# Personal local-only files — never commit
**/_local/
**/_local/**

# Specific orphan files currently sitting in working tree
web/src/components/DeckV2.tsx
web/src/features/rockenue/components/WebsiteMockup/
"( MARKET PULSE ).pdf"
backfill.log
city-profile-queries.sql
elysee-analysis.sql
claude/
.github/
```

After this, `git status` will stop showing those files entirely. Anything inside any folder named `_local/` (anywhere in the repo) is invisible to git permanently. `git add .` will never touch them.

**Layer 2 — `import.meta.glob` for local-only components**

Layer 1 alone leaves a trap: if `App.tsx` references `./components/DeckV2`, the build still breaks because the import path is in committed code but the file isn't.

The fix is Vite's `import.meta.glob`, which discovers files at build time via a *pattern* not a specific path:

```tsx
// In App.tsx (committed)
const localComponents = import.meta.glob<{ default: React.ComponentType<any> }>(
  './_local/*.tsx'
);
// Returns {} on Railway (no _local/ dir exists), or
// { './_local/DeckV2.tsx': () => import('./_local/DeckV2'), ... } locally
```

Then render any local component dynamically:

```tsx
const localKeys = Object.keys(localComponents);
const [localView, setLocalView] = useState<string | null>(null);

{localView && localComponents[localView] && (
  <Suspense fallback={null}>
    {React.createElement(lazy(localComponents[localView] as any))}
  </Suspense>
)}
```

Add a "Sandbox" dropdown to TopNav that only renders if `localKeys.length > 0`. On Railway the dropdown is invisible. On Karol's laptop he gets a dropdown of every file in `_local/`. Drop a `.tsx` into the folder and it appears in the dropdown automatically — no edits to `App.tsx` ever needed.

**Layer 3 — Pre-commit hook (belt and braces)**

Make `git commit` refuse to go through if the build is broken. Local-only hook (lives in `.git/hooks/`, not committed):

```bash
#!/bin/sh
# .git/hooks/pre-commit
echo "Running build check..."
cd web && npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Build failed — commit rejected. Run 'cd web && npm run build' to see why."
  exit 1
fi
echo "✓ Build OK"
```

Then `chmod +x .git/hooks/pre-commit`. Adds ~2 seconds to every commit. Catches the entire class of "broken state" bugs — not just gitignore mistakes. Today's Railway failure would have been impossible with this in place.

### Open decision before implementation
For the existing orphan files (`DeckV2.tsx`, `WebsiteMockup/`, etc.) — should they be **moved into `web/src/_local/`** so they live in the convention folder, or **left where they are** with by-name exceptions in `.gitignore`? Moving is cleaner long-term but slightly disruptive. Leaving them is non-invasive but means the `.gitignore` accumulates a growing list of by-name exceptions over time.

### Effort
~5 minutes to implement all three layers. Layer 1 is the bare minimum and takes 30 seconds. Layers 2 and 3 are optional enhancements but recommended.

---

## Rockenue website — migrate from WordPress to local repo

Moving rockenue.com off Hostinger/WordPress. The site will live in this repo as a new top-level folder (`rockenue-site/`), same git, separate deployment pointing to a different domain.

- **Stack**: Vite + React (same as `web/`) with **`vite-react-ssg`** plugin for static site generation — pre-renders every page to HTML at build time so SEO + social previews + AI crawlers all work out of the box.
- **Why SSG**: a plain Vite SPA ships an empty HTML shell; crawlers (Google, LinkedIn previews, GPTBot, ClaudeBot) mostly don't run JS, so they'd see nothing. SSG bakes the full rendered HTML into static files at build time — same React code, but the output is real HTML.
- **Shared content**: `content.ts` (HERO, STATS, SERVICES, etc.) moves to a `shared/` folder so both `web/` (mockups) and `rockenue-site/` (production) import from the same source.
- **Future**: rockenue site will pull live stats (rooms, properties, countries) from the Market Pulse API via a public read-only endpoint.
- **Backup**: source files + a self-contained offline HTML snapshot already saved in `claude/rockenue-backup/`.
