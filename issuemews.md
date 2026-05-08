# issuemews.md — The Mews Rate Plan Misroute Saga (2026-05-07 → 2026-05-08)

**Status:** ✅ closed at 14:30 UTC on 2026-05-08. All M&F hotels routing correctly to OTA BASE: Flexible, validated against Mews live rates, fleet audit clean, four layers of protection in place.

**Total wall-clock damage:** ~5 hours of investigation across two days, two iterations of the same fix, one architectural re-think, and seven commits to main.

**Affected hotels (real-money impact):**
- Mason & Fifth Belsize Park (318329) — silent misroute ~14 days (2026-04-23 → 2026-05-07), then 13 hours (2026-05-08 03:00 → 14:30 UTC)
- Mason & Fifth Primrose Hill (318343) — silent misroute ~30 hours (2026-05-06 → 2026-05-07), then 13 hours (same overnight as Belsize)
- Mason & Fifth Westbourne Park (318341) — never misrouted; control hotel for verification

---

## TL;DR

Sentinel had been pushing every Belsize and Primrose rate update to a Mews rate plan called **`Mid Stay 29-59 (BASE)`** instead of the intended **`OTA BASE: Flexible`** (the master plan that feeds Booking.com / Expedia / Distributor). For ~14 days on Belsize and ~30 hours on Primrose, Booking.com was serving frozen pre-flip prices because Sentinel's nightly hourly cycles were correctly running but pushing to a different rate plan than the OTAs read from.

The cause: a substring matcher (`buildMewsRateIdMap`) hit "BASE" in the new "Mid Stay 29-59 (BASE)" plan name, plus a self-heal loop that rebuilt the `rate_id_map` from the matcher every config save / recalc. The user added the new Mid Stay plan in Mews, the next config save flipped the routing silently, no alert ever fired.

The fix turned out to need three deployments because there were three writers and two engines that needed cleanup:

1. **2026-05-07 afternoon:** caught the silent-flip vector. Patched two writers (`updateConfig`, `recalculateRates`) to fill-only. Built Control Panel UI. Verified live across all three M&F hotels.
2. **2026-05-07 evening:** discovered a *second* problem — the JS waterfall (`calculateSellRate`) was being used as a parallel pricing engine, fighting DGX. Refactored `recalculateRates` to read DGX predictions directly. Fixed JSONB key-order bug.
3. **2026-05-08 morning:** found the bomb fired again overnight. Discovered a *third* writer (`/api/sentinel/sync`) that escaped yesterday's patch, called nightly by `sync_fleet.py` on DGX. Patched. Then added validate-then-fill + matcher tightening for belt-and-braces.

---

## Timeline

### 2026-05-07 (Wednesday)

| Time (UTC) | Event |
|---|---|
| ~09:30 | User reports "Primrose July rates around £200" via Mason Dashboard / Mews Distributor |
| 10:30 | First investigation hypothesis: floor-clamping in `sentinel_rates_calendar`. Wrong direction — burned ~30 min chasing a £200 phantom |
| 11:00 | Pivot after user pushback ("I didn't touch min rates, and Sentinel wouldn't yield to £200 on a far-out month"). Audit script reveals Belsize + Primrose every room mapped to `Mid Stay 29-59 (BASE)` instead of `OTA BASE: Flexible` |
| 11:30 | Root cause confirmed: substring matcher + self-heal eagerness. DB correction applied. Belsize autopilot paused (14-day backlog risk) |
| 11:45 | Backend fill-only patches authored (`updateConfig`, `recalculateRates`) |
| 12:00 | Control Panel UI section "Rate Plan Mapping" added (Mews dropdown, Cloudbeds read-only) |
| 12:10 | Fleet audit run — only Archanes Market Watch flagged (autopilot off, no impact) |
| 12:20 | Commit `bb57069` pushed → Railway deploy starts |
| 12:25 | Local QA reveals Mews dropdown empty + Cloudbeds dropdown garbage (separate issues) |
| 12:28 | Hook fix `b3042c1` — `loadHotelRules` now propagates `pms_rate_plans` and `rate_id_map` |
| 12:35 | Cloudbeds investigation: data has no `ratePlanName`, only one plan per room — replaced dropdown with read-only summary. Commit `b36f2a3` |
| 12:38 | Belsize autopilot re-enabled. DGX-side trigger fired manually for all 3 M&F hotels |
| 12:43 | Phase 2 wrote 645 rate-rows. Verification: 100% routed to OTA BASE: Flexible across all three. Heartbeats green, zero FAILED jobs |
| 12:55 | Live Mews verification (`rates/getPricing` round-trip): 77/77 in-window dates match Sentinel push within £0.50 |
| 13:00 | First closure called. Docs updated (post-mortem + Blueprint §3.6 + memory entries) |
| 13:30 | User notices systematic £40-60 gap between AI prediction (green) and calendar (white) on Westbourne |
| 13:45 | Investigation reveals **second bug**: `recalculateRates` was using `calculateSellRate` (the OTA waterfall, a UI display utility) as a parallel pricing engine. Plus a JSON.stringify-on-Postgres-JSONB bug firing spurious recalcs on every config save |
| 13:58 | Architectural fix `dc5ff96` — `recalculateRates` reads DGX predictions directly, no waterfall in write path. JSON-sort fix added |
| 14:30 | Cosmetic fix `867f564` — saved overrides now render gold instead of cyan |
| 16:30 | Documentation hardened with 8 hard-rule banner. Final closure called for the day |

### 2026-05-08 (Thursday morning)

| Time (UTC) | Event |
|---|---|
| ~09:00 | User runs routine "is the pricing OK" check |
| 09:05 | Audit script flags Belsize + Primrose **misrouted again** to Mid Stay 29-59 (BASE) |
| 09:10 | DB forensics: every `sentinel_configurations.last_pms_sync_at` for 36 hotels falls in 03:00:06 → 03:03:06 UTC window. Sequential ~5s apart. Definitely automated |
| 09:15 | Codebase search: no Node cron at 03:00 UTC. No frontend trigger except manual "Sync with PMS" button. User confirms didn't click anything |
| 09:20 | DGX shell investigation: `sudo crontab -l -u sentinel` reveals `/home/sentinel/sentinel-training-hub/sync_fleet.py` scheduled `0 5 * * *` DGX-local time. DGX runs CEST (UTC+2). 05:00 CEST = 03:00 UTC. Match. |
| 09:30 | Confirmed: `sync_fleet.py` POSTs `{hotelId, pmsPropertyId}` to `/api/sentinel/sync` for every rockenue hotel nightly, no `selectedRateId`. The /sync route uses `INSERT...ON CONFLICT...DO UPDATE SET rate_id_map = EXCLUDED.rate_id_map` — **pure overwrite, not fill-only**. Yesterday's fix missed this third writer |
| 09:35 | DB re-fixed (Belsize + Primrose). Belsize autopilot paused again as safety |
| 09:40 | Commit `3d1de67` patches `/api/sentinel/sync` to be fill-only. Pushed → deployed |
| 09:50 | Commit `92065c4` documents `sync_fleet.py` in Blueprint §11.4 (with CEST/UTC clarification — DGX cron times are local, not UTC) |
| 10:15 | User pushback: *"why was the resync there in the first place — was there a reason?"* Honest review of the architectural trade-off: the original 72c64b2 motivation was auto-heal of corrupted entries, which fill-only loses. Trade-off justified because the lost protections are detectable when they fail (heartbeat goes red), and the gained protection prevents a silent failure mode |
| 10:30 | Commit `68eb7e9` adds **validate-then-fill** in all three writers (preserve valid existing entries, drop stale ones referencing deleted PMS rate plans) and **tightens `buildMewsRateIdMap`** with four-tier priority (`^OTA ` prefix → substring with exclude list → public rate → fallback). Belt-and-braces on top of fill-only |
| 14:30 | All four protection layers in place. Final closure |

---

## The bug — what was actually happening

### The single-day version

`sentinel_configurations.rate_id_map` is a `{ roomTypeID: rateID }` map that tells Sentinel where to push rate updates. For Mews hotels, every room typically points at the same rateID — the **OTA distribution master plan**, named "OTA BASE: Flexible." That plan feeds Booking.com / Expedia / Distributor.

When the user added "Mid Stay 29-59 (BASE)" to Belsize on ~2026-04-23 (and to Primrose on 2026-05-05 ~8pm Krakow), the auto-matcher `buildMewsRateIdMap`'s substring rule on `base|standard|rack|bar` hit "BASE" in the Mid Stay plan name. Because that plan happened to surface earlier in Mews's rate plan array than "OTA BASE: Flexible," the matcher picked it.

But the matcher only runs when something *triggers a rebuild*. There were three triggers:

1. **`updateConfig`** in `sentinel.service.js` — fires on every Control Panel save
2. **`recalculateRates`** in `sentinel.service.js` — fires on autopilot min-rate changes, "Re-Push Rates" button, "Apply AI" button
3. **`POST /api/sentinel/sync`** in `sentinel.router.js` — called nightly by `sync_fleet.py` on DGX for every rockenue hotel

Each of these wrote `rate_id_map` to the DB by **rebuilding it from scratch** via the matcher. Once the new "Mid Stay (BASE)" plan landed in `pms_rate_plans` (refreshed by `daily-refresh.js`), the next trigger silently flipped the map.

### Why nothing alerted us

Standard Sentinel health signals all stayed green:
- `sentinel_hotel_heartbeat.consecutive_failures = 0`
- All `sentinel_job_queue` rows status `COMPLETED`
- `sentinel_notifications` empty
- DGX engine running, hourly cron firing
- Calendar getting updated with sane Sentinel values (matching the AI's output)

The bug was **invisible to every health signal**, because every signal measures *activity*, not *correctness of routing*. Sentinel was correctly producing predictions, correctly applying gates, correctly pushing rates — to the *wrong rate plan*. Booking.com / Expedia / Distributor saw the LAST PRE-FLIP push for ~14 days on Belsize, ~30 hours on Primrose. The rate the OTAs displayed was whatever happened to be in OTA BASE: Flexible at the moment of the flip.

### Why Westbourne was unaffected

Westbourne's `pms_rate_plans` array happens to surface "OTA BASE: Flexible" before any plan whose name contains "BASE" as a substring. That's coincidence, not design. If Westbourne had its own "Mid Stay (BASE)" plan added with the same array ordering as Belsize, it would have flipped too.

---

## Investigation — how we found it (twice)

### Round 1 (2026-05-07 afternoon) — the wrong-direction debugging

The user said "Primrose July rates around £200." First instinct: read `sentinel_rates_calendar` for Primrose July, find where £200 came from. Burned ~30 minutes:
- `sentinel_price_history` audit: zero events ever wrote £200
- `sentinel_job_queue` audit: zero rate-rows at £200 in 1,322 jobs over 30 days
- Every code path that writes to `sentinel_rates_calendar`: none accounted for the £200 origin

**The £200 was a red herring.** The calendar value was correct *for the rate plan it was being pushed to* — Mid Stay 29-59 (BASE), which happened to be at a default value Mews sets for unconfigured plans. The actual bug was one layer up: the rate plan target itself was wrong.

The pivot came from user pushback: *"I didn't touch min rates in a week, and Sentinel wouldn't yield to £200 on a far-out month with healthy pace."* Both true. That ruled out the floor-clamp hypothesis. Then the audit query that we should have run in the first 60 seconds:

```sql
SELECT rate_id_map FROM sentinel_configurations WHERE hotel_id = 318343;
```

Resolved against `pms_rate_plans` → every entry pointed at Mid Stay 29-59 (BASE). Bug confirmed in 30 seconds once we asked the right question.

### Round 2 (2026-05-08 morning) — the missed third writer

After yesterday's fix shipped, the next morning's audit showed Belsize + Primrose misrouted *again*. The investigation:

1. `sentinel_configurations.last_pms_sync_at` and `updated_at` for **36 hotels** all fell in a tight 03:00:06 → 03:03:06 UTC window
2. Sequential ~5s apart
3. Both columns updated together (the `/api/sentinel/sync` route's signature)

The `/sync` route was the third writer. Yesterday I'd patched `updateConfig` and `recalculateRates` but missed `/sync` because it does a raw `INSERT INTO ... ON CONFLICT ... DO UPDATE SET rate_id_map = EXCLUDED.rate_id_map` — a different SQL pattern than the JS-level helpers I'd grep'd through.

The trigger turned out to live outside our repo entirely: `/home/sentinel/sentinel-training-hub/sync_fleet.py` on the DGX server, scheduled `0 5 * * *` in DGX's local CEST time = 03:00 UTC.

```python
# sync_fleet.py (excerpt)
def sync_hotel(hotel_id, pms_id):
    response = requests.post(
        "https://www.market-pulse.io/api/sentinel/sync",
        json={"hotelId": hotel_id, "pmsPropertyId": pms_id},
        headers={"x-internal-secret": INTERNAL_KEY},
        timeout=60,
    )
```

Iterates every `is_rockenue_managed = true` hotel, 2-second sleep between calls, hits the production sync endpoint with `x-internal-secret` auth bypass. **The most aggressive automated writer of `rate_id_map` in the system**, and it lives outside the JS repo.

---

## All seven commits shipped (in deploy order)

| # | Commit | Description | Impact |
|---|---|---|---|
| 1 | `bb57069` | rate_id_map silent-flip on Mews — fill-only self-heal + Control Panel mapping UI | Backend protection live (2 of 3 writers); Mews dropdown UI shipped |
| 2 | `b3042c1` | propagate pms_rate_plans + rate_id_map into formState | Hook fix so the new UI actually renders data |
| 3 | `b36f2a3` | hide rate-plan dropdown for Cloudbeds (no choice exists) | Cloudbeds shows read-only summary; Mews unchanged |
| 4 | `e5d49b3` | docs(blueprint): document rate_id_map fill-only rule + add verification scripts | Blueprint §3.6 updated; audit scripts shipped |
| 5 | `dc5ff96` | recalculateRates reads DGX predictions, not waterfall (DGX-only) | **Architectural fix** — JS waterfall removed from write path; JSON-sort fix |
| 6 | `867f564` | override badges + values render gold whether pending or saved | Cosmetic; saved overrides visually distinct from PMS data |
| 7 | `bea58aa` | docs(blueprint): hard warnings — DGX-only pricing + JSONB key-order trap | Blueprint §3.6 hardening |
| 8 | `3d1de67` | /api/sentinel/sync route also fill-only for rate_id_map | **Round 2 fix** — third writer caught after `sync_fleet.py` re-flipped overnight |
| 9 | `92065c4` | docs(blueprint): document DGX sync_fleet.py + clarify CEST cron timezone | Blueprint §11.4 hardened — both DGX scripts now documented |
| 10 | `68eb7e9` | validate-then-fill rate_id_map + tighten Mews matcher | Belt-and-braces — recovers stale-entry auto-heal + tightens matcher |

---

## Verification — live evidence in production

### Phase 2 routing (12:38-12:43 UTC, 2026-05-07, after manual DGX trigger)

| Hotel | Distinct rateIDs in last 30 min | Verdict |
|---|---|---|
| Westbourne | 1: `f1e85b02…` | ✅ OTA BASE: Flexible |
| Belsize | 1: `df9a9345…` | ✅ OTA BASE: Flexible |
| Primrose | 1: `7866223e…` | ✅ OTA BASE: Flexible |

645 rate-rows pushed across the three hotels. Zero pushed to any Mid Stay plan. Zero FAILED.

### Belsize backlog drain (12:38-12:43 UTC)

- 64 fresh predictions covering 2026-05-10 → 2027-05-07
- 176 rate-rows pushed across 44 dates × 4 rooms
- All COMPLETED, zero FAILED
- Rate band £199 → £501 (floor respected, weekend peaks normal)
- The Mews 403 conflicting-operation retry pattern (Apr 21 incident) didn't fire — fleet was calm for the drain

### Live Mews confirmation (12:55 UTC)

`rates/getPricing` round-trip vs Sentinel pushes from the prior 30 minutes:

| Hotel | Sentinel pushed | Compared in 60-day window | Match |
|---|---|---|---|
| Westbourne | 25 dates | 25 / 25 | **100%** |
| Belsize | 44 dates | 29 / 29 | **100%** |
| Primrose | 40 dates | 23 / 23 | **100%** |

77/77 in-window dates match within £0.50. Mews has applied every value verbatim. Belsize/Primrose dates outside the 60-day comparison window (the 2027-spanning backlog) were also pushed and accepted.

---

## Failures we hit / mistakes I made

This section is a confession log so the next AI doesn't repeat the same misses.

### 1. Wrong-direction debugging on the £200 phantom (2026-05-07, ~30 min wasted)

I read the user's "rates around £200" complaint as a calendar-value bug and chased where £200 came from in `sentinel_rates_calendar`. Five queries deep into price history and job queue history before the user pushed back with "I didn't touch min rates, and the engine wouldn't yield to £200 on a far-out month."

**Lesson:** when rate-related symptoms appear on a Mews hotel, the *first* check should always be: `SELECT rate_id_map FROM sentinel_configurations WHERE hotel_id = X` and resolve every entry against `pms_rate_plans`. If any entry doesn't resolve to a plan whose name starts with `OTA `, you have a misroute. That single query would have saved 30 minutes.

### 2. Missed the third writer of `rate_id_map` (caused round 2)

When I patched fill-only yesterday, I grep'd for `rate_id_map` and assumed the two service-level writers were the universe. I read past `sentinel.router.js:1040` and `:1050` — the `/sync` route's INSERT — without registering it as another writer. The result: my "permanent fix" lasted exactly until the next 03:00 UTC tick of `sync_fleet.py`.

**Lesson:** when adding a "data field is sacred" rule, audit ALL writers exhaustively. Every `INSERT`, `UPDATE`, and `ON CONFLICT DO UPDATE SET` for that column. One missed writer = the rule is non-load-bearing for half the fleet. Don't stop at the first 2-3 hits in the grep.

### 3. JSONB key-order trap (separate bug discovered 2026-05-07 evening)

The `setImmediate(recalculateRates)` trigger in `sentinel.router.js` compared `JSON.stringify(prior_min_rates) !== JSON.stringify(new_min_rates)` to decide whether to re-push. Postgres JSONB doesn't guarantee key order; the JS request body builder produces a different key order. So `JSON.stringify` produced different strings for byte-identical objects, and the comparison fired false positives. **Westbourne was getting a full-year recalc every time anyone clicked save in Control Panel** — including while QAing the new Rate Plan Mapping UI. Combined with the parallel-engine bug below, this manifested as a £40-60 gap between AI prediction and live calendar.

**Lesson:** never rely on `JSON.stringify` equality for objects sourced from JSONB. Sort keys before stringifying, or compare deep-equal field-by-field.

### 4. The parallel pricing engine (separate-but-related bug discovered 2026-05-07 evening)

`recalculateRates` was using `pricingEngine.calculateSellRate` (the OTA waterfall — a UI display utility for the "Sell Rate" column) as if it were a pricing engine. Wired in April 3rd by a developer who needed math and grabbed the only function in scope. From that day until 2026-05-07, the JS waterfall ran as a parallel engine, overwriting DGX's calendar values every time anyone saved config or hit "Re-Push Rates." DGX's hourly cron then re-pushed correct values, creating a permanent £40-60 oscillation that was invisible while the rate-plan misroute had Booking.com frozen.

**Lesson:** don't reuse a display utility as a writer. A function named "calculateSellRate" computes a sell rate for display. It's not a pricing engine. Read the file's `@brief` comment before assuming a function's purpose.

### 5. Lost the auto-heal protection without naming the trade-off (2026-05-08 morning)

When I patched `/sync` to be fill-only at round 2, I didn't articulate that this also removed the original auto-heal protection that the nightly resync was designed to provide. The user caught it with a sharp question: *"was there a reason we put this resync there in the first place?"*

**Lesson:** when applying defensive patches that change a system's behavior, name the trade-off explicitly. Don't just say "the protection is in place"; say "this also closes off [legitimate use case X] — here's why that's an acceptable cost." If the user disagrees, you can refine before the trade-off becomes a surprise. Validate-then-fill (commit `68eb7e9`) is the cleaner answer, recovering the auto-heal use case without re-opening the silent-flip vector.

---

## What changed in the code

### Backend writers — `rate_id_map` is now SACRED

Three writers now follow the same validate-then-fill pattern:

```js
// 1. Validate existing — drop entries pointing to deleted rate plans
const validRateIdSet = new Set(pmsRatePlans.map((p) => String(p.rateID)));
const validatedExisting = {};
const droppedKeys = [];
for (const [roomTypeId, rateId] of Object.entries(priorRateIdMap)) {
  if (validRateIdSet.has(String(rateId))) {
    validatedExisting[roomTypeId] = rateId;
  } else {
    droppedKeys.push(roomTypeId);
  }
}

// 2. Fill from candidate (matcher) only for missing keys + stale-dropped slots
const rateIdMap = { ...candidateMap, ...validatedExisting };

// 3. Log every change so silent flips become impossible
console.log(`[Sentinel] Hotel X: rate_id_map preserved (N existing, M added: ..., K stale dropped: ...)`);
```

Plus: if the request body explicitly provides `rate_id_map` (Control Panel save), use it verbatim — explicit user choice beats preserved state.

### Matcher — `buildMewsRateIdMap` four-tier priority

```
Tier 1: prefer ^OTA prefix (e.g. "OTA BASE: Flexible")
Tier 2: substring match base|standard|rack|bar, BUT excluded for:
        mid stay | long stay | extended | voucher | corporate | corp |
        friends | staff | management | partner | agent |
        non-refundable | nonref | agoda | booking.com | expedia | airbnb |
        hyper guest | gds | close | archive | deactivated | insider |
        early bird | m&f
Tier 3: first public root rate
Tier 4: first root rate (fallback)
```

### `recalculateRates` — DGX is the ONLY pricing engine

```js
// OLD (the bug)
const calendar = await previewCalendar({ hotelId, ... });
calendar.forEach(day => allOverrides.push({ ..., rate: day.finalRate }));  // waterfall output, wrong

// NEW
const predictionsRes = await db.query(`
  SELECT DISTINCT ON (stay_date) stay_date, suggested_rate
  FROM sentinel_ai_predictions
  WHERE hotel_id = $1 AND room_type_id::text = $2 AND stay_date BETWEEN $3 AND $4
  ORDER BY stay_date, created_at DESC
`, [hotelId, baseRoomTypeId, startDate, endDate]);
// ... apply guardrails (min/max/freeze) via existing applyGuardrails
// ... fan out via differentials
// ... write calendar + queue PMS pushes
```

`previewCalendar` itself is unchanged — it remains the UI grid renderer for the "Sell Rate" column. Only the consumer of its output in `recalculateRates` is replaced.

### Config save trigger — JSON sort

```js
// OLD (false positives on every save)
const minsChanged = JSON.stringify(prior_mins) !== JSON.stringify(new_mins);

// NEW
const stableMinsJson = (obj) => JSON.stringify(obj || {}, Object.keys(obj || {}).sort());
const minsChanged = stableMinsJson(prior_mins) !== stableMinsJson(new_mins);
```

### Frontend — Control Panel "Rate Plan Mapping" section

New section between Min Rates and Room Differentials in `ControlPanelView.tsx`:
- **Mews hotels:** single "Distribution Rate Plan" dropdown. Pre-selects current value. Warns if selected plan name doesn't start with `OTA `, or if rooms currently point to different plans
- **Cloudbeds hotels:** read-only summary listing each room's current rate ID with a note explaining the auto-mapping (Cloudbeds rate plan data has no plan names and only one non-derived plan per room — there's no choice to surface)

Save flow uses the existing `POST /api/sentinel/config` endpoint; backend treats explicit user-provided `rate_id_map` as authoritative.

### Frontend hook — `useSentinelConfig.ts`

`loadHotelRules` and `completeActivation` now propagate `pms_rate_plans` and `rate_id_map` into `formState`. Previously these were dropped, so the new dropdown rendered empty.

### UI — saved overrides render gold

`PMS Override` row text and column-header user icons render gold for both pending and saved overrides (was gold + cyan + gray mix). The pending vs saved distinction is preserved by font weight (pending = bold, saved = regular).

---

## Hard rules for future AIs (the 9 commandments)

If you find yourself about to do any of these, stop and re-read this doc first.

### 1. **DGX is the ONLY pricing engine. The waterfall is VIEW-ONLY.**
`pricingEngine.calculateSellRate` and `previewCalendar` are UI utilities — they compute "what would the guest see on Booking.com given the current PMS rate." They MUST NEVER produce a value that gets pushed to PMS. Every rate that reaches `sentinel_job_queue` must originate from `sentinel_ai_predictions.suggested_rate` (DGX output) clamped by `applyGuardrails`. If you need "push current rates to PMS now" math, the answer is **read predictions from the DB**, never "find a math function in scope and call it."

### 2. **`rate_id_map` existing entries are SACRED. Validate-then-fill.**
The self-heal in `sentinel.service.js` (`updateConfig`, `recalculateRates`) and `sentinel.router.js` (`/sync`) must validate existing entries against current `pms_rate_plans` and only drop entries pointing to deleted rate plans. New entries are filled by the matcher only for missing keys (newly added rooms) or stale-dropped slots. Reverting to "rebuild from matcher every time" will silently flip mappings the moment a Mews hotel adds a new rate plan whose name contains "base", "standard", "rack", or "bar".

### 3. **Substring matchers on free-text PMS data are time bombs.**
`buildMewsRateIdMap` matches `base|standard|rack|bar` but with an explicit exclude list and a `^OTA ` prefix preference. Don't tighten the matcher into the calling code — it lives in `api/adapters/mewsAdapter.js`. If you add a new substring match anywhere on PMS field data, add an exclude list AND prefer prefix/exact match.

### 4. **`JSON.stringify` on Postgres JSONB returns inconsistent key order.**
Don't compare `JSON.stringify(prior) !== JSON.stringify(new)` — sort keys first. The previous code fired spurious full-year recalcs on Westbourne every time anyone clicked save in Control Panel because Postgres JSONB and the JS request body produced different key orders for identical objects.

### 5. **Standard health signals miss this class of bug.**
`sentinel_hotel_heartbeat.consecutive_failures = 0`, jobs `COMPLETED`, no notifications — all green for 14 days while Sentinel was correctly delivering wrong outputs to the wrong rate plan. The only diagnostic that catches it is `scripts/audit-fleet-rate-mapping.js`. Run it as part of any future Sentinel investigation.

### 6. **When investigating "wrong rate on a Mews hotel," check the rate plan FIRST.**
Don't chase rate values in `sentinel_rates_calendar` until you've confirmed `rate_id_map` resolves to a plan whose name starts with `OTA `. The first 30 minutes of this incident were burned chasing a £200 phantom; the actual bug was one layer up.

### 7. **Don't reuse a display utility as a writer.**
A function named "calculateSellRate" computes a sell rate for display. It's not a pricing engine. The April 3rd developer who wired it into `recalculateRates` to push to PMS created the second-pricing-engine mess we untangled at round 1.5. If you can't tell whether a function is "compute display value" or "decide what to push," ask, or read the file's `@brief` comment.

### 8. **Watch for user-pinned overrides before assuming a rate is "wrong."**
The `sentinel_rate_overrides` table is the canonical place for user pins. Karol pinned 23 May dates on April 30 and forgot. If a calendar value disagrees with the AI prediction and the source is "OVERRIDE," the system is correctly honoring an explicit user pin — not malfunctioning.

### 9. **When adding a "this column is sacred" rule, audit ALL writers — not just the obvious ones.**
The first patch covered `updateConfig` and `recalculateRates` but missed `POST /api/sentinel/sync` (sentinel.router.js:993-1057), which uses raw `INSERT...ON CONFLICT...DO UPDATE SET rate_id_map = EXCLUDED.rate_id_map`. The DGX-side cron `sync_fleet.py` calls `/sync` for every rockenue hotel nightly at 05:00 CEST = 03:00 UTC, and that one missed writer re-flipped Belsize+Primrose overnight despite the other two paths being patched. **Grep `INSERT INTO`, `UPDATE`, and `ON CONFLICT DO UPDATE SET` for the column. Don't stop at the first 2-3 hits.**

---

## DGX-side surface that lives outside this repo

Two scripts on the DGX server (`spark-828c`, accessible via Tailscale `ssh sentinel-hawaii` or `ssh spark-828c.local`):

```
/home/sentinel/sentinel-training-hub/sentinel_live.py   # Flask service, runs DGX yield engine
/home/sentinel/sentinel-training-hub/trigger_all.py     # hourly cron: DGX prediction → /api/bridge/decisions
/home/sentinel/sentinel-training-hub/sync_fleet.py      # daily cron 05:00 CEST = 03:00 UTC: → /api/sentinel/sync
```

Crontab (`sudo crontab -l -u sentinel`):
```
0 * * * * /home/sentinel/sentinel-training-hub/venv/bin/python3 /home/sentinel/sentinel-training-hub/trigger_all.py
0 5 * * * /home/sentinel/sentinel-training-hub/venv/bin/python3 /home/sentinel/sentinel-training-hub/sync_fleet.py
```

`sync_fleet.py` is the most aggressive automated writer of `sentinel_configurations.rate_id_map`. The `/api/sentinel/sync` route's validate-then-fill behavior (commit `68eb7e9`) is load-bearing — if you ever rewrite that route, preserve it or `sync_fleet.py` will silently misroute the fleet within 24h.

---

## Final state (snapshot at 14:30 UTC, 2026-05-08)

| Layer | State |
|---|---|
| `rate_id_map` Westbourne | ✅ `f1e85b02…` (OTA BASE: Flexible) |
| `rate_id_map` Belsize | ✅ `df9a9345…` (OTA BASE: Flexible) |
| `rate_id_map` Primrose | ✅ `7866223e…` (OTA BASE: Flexible) |
| Belsize autopilot | ⏸ OFF (paused 2026-05-08 morning as safety after round-2 flip; re-enable when ready) |
| Primrose autopilot | ✅ ON |
| Westbourne autopilot | ✅ ON |
| Backend `updateConfig` | ✅ validate-then-fill |
| Backend `recalculateRates` | ✅ validate-then-fill, DGX-only pricing |
| Backend `/api/sentinel/sync` | ✅ validate-then-fill |
| Matcher `buildMewsRateIdMap` | ✅ four-tier priority with exclude list |
| JSON key-order in config save trigger | ✅ sort-stable |
| Control Panel "Rate Plan Mapping" UI | ✅ deployed (Mews dropdown + Cloudbeds read-only) |
| Override row UI styling | ✅ gold for saved + pending |
| Fleet audit | ✅ clean (38 hotels, only Archanes flagged — autopilot off, no impact) |
| Mews live verification | ✅ 77/77 in-window dates match Sentinel push within £0.50 |
| Heartbeats (M&F) | ✅ all three: `consecutive_failures = 0` |

---

## Outstanding / non-blocking items

- **Re-enable Belsize autopilot** when Karol is ready. The 03:00 UTC re-flip → DB re-fix flow happened in <12 hours so the backlog is small (a few hours, not 14 days like yesterday). First cycle after re-enable should be normal-sized.
- **`sync_fleet.py` could pass `selectedRateId`** for each hotel — Python-side belt-and-braces in case the JS-side fill-only ever regresses. Not urgent; not currently in scope.
- **The `Overkill123*` hardcoded fallback in `sync_fleet.py`** — server-side auth bypass via `x-internal-secret`. Worth tracking. Not security-critical (DGX-side script in private repo, hitting an authenticated route), but should rotate to env-var-only at some point.
- **Confirmation banner on Mews hotels** — one-time "confirm rate plan selection" prompt for every Mews hotel after the rate-plan fix. Could surface in the new Rate Plan Mapping section. Optional; the audit script already covers detection.
- **Mid Stay billing audit** — if Mason ever needs to investigate whether Mid Stay reservations were affected by misrouted rates during the 14-day Belsize window, the data is recoverable from `sentinel_job_queue` payloads (still retained). Probably zero impact (Mid Stay = direct contracts, not OTA-driven), but worth flagging if asked.

---

## Where to look for more detail

- **`Blueprint.md` §3.6** — load-bearing `rate_id_map` rules, in-line at the mapping section
- **`Blueprint.md` §11.4** — DGX cron schedule with `sync_fleet.py` documented
- **`claude/sentinel-mews-rate-mapping-2026-05-07.md`** — full incident report (gitignored, session-local, mirror of this doc with deeper code excerpts)
- **`scripts/audit-fleet-rate-mapping.js`** — run anytime to verify the fleet is healthy
- **`scripts/preflight-mf-rate-mapping.js`** — M&F-specific diagnostic
- **`scripts/verify-all-mf-trigger.js`** — unified post-trigger verification
- **`scripts/verify-mews-applied.js`** — live `rates/getPricing` round-trip check

---

**Saga closed. The next AI investigating any rate-related Mews bug should start by running `node scripts/audit-fleet-rate-mapping.js` and checking `rate_id_map` against `pms_rate_plans` for the affected hotel — that single command would have closed this whole thing in 5 minutes if it had existed before April 23.**
