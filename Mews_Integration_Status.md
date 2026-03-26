# Mews PMS Integration — Status Report
## Market Pulse + Sentinel | Updated March 26, 2026

---

## COMPLETION STATUS: 90%

| Phase | Status | Test Result | Date Completed |
|-------|--------|-------------|----------------|
| 1. Foundation + Onboarding | ✅ COMPLETE | Hotel 318327 created, config stored | Mar 26, 2026 |
| 2. Metrics Sync (Occupancy + Revenue) | ✅ COMPLETE | 382 days synced via daily-refresh | Mar 26, 2026 |
| 3. Sentinel Rate Reads | ✅ COMPLETE | Live Mews rates in Rate Manager (£400.45/night) | Mar 26, 2026 |
| 4. Sentinel Rate Pushes | ✅ COMPLETE | Rates pushed to Mews API, queue worker routed | Mar 26, 2026 |
| 5. Webhooks (Real-Time Events) | ✅ COMPLETE | Revenue + metrics update on reservation events | Mar 26, 2026 |

---

## FILES CREATED (5 new files)

| File | Location | Purpose |
|------|----------|---------|
| mewsAdapter.js | api/adapters/ | Core Mews API client — auth, config, metrics, onboarding |
| mews.sentinel.adapter.js | api/adapters/ | Sentinel rate reads (getPricing) + writes (updatePrice) for Mews |
| pmsRegistry.js | api/adapters/ | Routes PMS calls to correct adapter by hotels.pms_type |
| mews.onboarding.router.js | api/routes/ | Admin endpoints: POST /api/mews/onboard, POST /api/mews/test-creds |
| mews.webhooks.router.js | api/routes/ | Inbound Mews General Webhooks at POST /api/mews-webhooks |

## FILES MODIFIED (4 files, all additive)

| File | Changes | Impact |
|------|---------|--------|
| server.js | 4 lines added — import + mount for mews onboarding + webhooks routers | None to existing functionality |
| sentinel.router.js | 5 find/replaces — PMS adapter routing via _getSentinelAdapterForHotel() for process-queue, getRates, postRate, sync, and calendar hydration | Cloudbeds remains default fallback. Zero logic changes. |
| sentinel.service.js | 1 find/replace — buildRateIdMap now detects Mews hotels (UUID rate IDs) and uses buildMewsRateIdMap | Cloudbeds path unchanged. Mews hotels get correct rate_id_map on config save. |
| daily-refresh.js | 1 find/replace — Mews branch updated to use getCredentials() + getCombinedMetrics() with serviceId | Old Mews branch replaced with new adapter pattern. |

## FILES NOT CHANGED (as designed)

- sentinel.pricing.engine.js — Pure math, no PMS awareness
- sentinel.bridge.service.js — Reads from DB, not PMS directly
- sentinel.adapter.js — Cloudbeds-specific, untouched
- cloudbedsAdapter.js — Cloudbeds-specific, untouched
- webhooks.router.js — Cloudbeds webhook handler, untouched
- All frontend code — UI is PMS-agnostic

---

## ENVIRONMENT VARIABLES

| Variable | Location | Value |
|----------|----------|-------|
| MEWS_CLIENT_TOKEN | .env | Shared across all Mews properties (from Mews certification) |
| MEWS_API_URL | .env | https://api.mews-demo.com (demo) / https://api.mews.com (production) |
| CRON_SECRET | .env | Required for daily-refresh cron endpoint |

## PER-HOTEL CREDENTIALS

Stored in `hotels.pms_credentials` (JSONB column):
```json
{
  "accessToken": "property-specific-mews-access-token",
  "serviceId": "uuid-of-reservable-service",
  "timezone": "Europe/Budapest"
}
```

---

## MEWS API ENDPOINTS USED

| Endpoint | Phase | Purpose | Frequency |
|----------|-------|---------|-----------|
| configuration/get | 1 | Property details (name, city, timezone, address) | Once per onboarding |
| services/getAll | 1 | Find Reservable service ID | Once per onboarding |
| resourceCategories/getAll | 1 | Room types (names, capacity) | Onboarding + sync |
| rates/getAll | 1,3 | Rate plans (base vs derived) | Onboarding + sync |
| services/getAvailability/2024-01-22 | 2 | Daily room capacity | Daily cron, 90-day chunks |
| reservations/getAll/2023-06-06 | 2,5 | Occupancy count + webhook detail fetch | Daily cron + per webhook event |
| orderItems/getAll | 2,5 | Revenue data (SpaceOrder type) | Daily cron + per webhook event |
| rates/getPricing | 3 | Live rate prices per date per category | On-demand (Rate Manager) |
| rates/updatePrice | 4 | Push rate changes to Mews | Per override/recalculation |
| General Webhooks | 5 | ServiceOrderUpdated events | Real-time inbound |

---

## ISSUES FOUND AND RESOLVED

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Empty roomTypes from configuration/get | Mews doesn't return ResourceCategories in configuration/get | Switched to resourceCategories/getAll endpoint |
| rate_id_map wiped on Sync with PMS | Cloudbeds buildRateIdMap in sentinel.service.js returned {} for Mews data | Added PMS-aware detection in updateConfig (UUID check) |
| rate_id_map wiped on Control Panel save | Same as above — updateConfig calls buildRateIdMap on every save | Same fix — isMewsHotel check routes to buildMewsRateIdMap |
| Calendar hydration called Cloudbeds adapter | sentinel.router.js sync route hardcoded sentinelAdapter.getRates | Added _getSentinelAdapterForHotel routing |
| Webhook metrics update failed | daily_metrics_snapshots has no updated_at column | Removed updated_at from upsert SQL |
| Webhook revenue = 0 | orderItems/getAll requires ServiceOrderIds, not ReservationIds | Changed filter to ServiceOrderIds |
| Webhook revenue = 0 (initial) | Original webhook didn't fetch revenue at all | Added fetchReservationRevenue helper using orderItems/getAll |

---

## REMAINING WORK (10%)

### Production Deployment
- [ ] Connect real Mews property (not demo) and run full test sequence
- [ ] Verify rate pushes persist on real property (demo is shared/reset)
- [ ] Deploy to Vercel production
- [ ] Register production webhook URL: https://www.market-pulse.io/api/mews-webhooks

### Mews Certification
- [ ] Certification form submitted — awaiting review
- [ ] Receive production ClientToken from Mews
- [ ] Update MEWS_CLIENT_TOKEN in production .env
- [ ] Update MEWS_API_URL to https://api.mews.com in production .env

### Hardening (Nice-to-Have)
- [ ] Add exponential backoff/retry to _callMewsApi for 429 rate limit responses
- [ ] Add webhook payload validation (verify IntegrationId or shared secret)
- [ ] Add tax rate extraction during onboarding (taxations/getAll) for hotels.tax_rate
- [ ] Consider adding Mews WebSocket connection for real-time PriceUpdate events (currently not used)
- [ ] Route remaining sentinel.router.js adapter calls (getRatePlans at line 811, currently only used for Cloudbeds admin testing)

### Documentation
- [ ] Update Blueprint.md with all Mews integration details (find/replace instructions provided)
- [ ] Production webhook URL: https://www.market-pulse.io/api/mews-webhooks
- [ ] Credential rotation reminder: .env secrets were exposed during development session

---

## ARCHITECTURE DECISION LOG

| Decision | Rationale |
|----------|-----------|
| PMS-siloed (no changes to Sentinel core) | Protects 40+ live Cloudbeds hotels from regression risk |
| MEWS_CLIENT_TOKEN in .env, AccessToken in DB | ClientToken is per-app (shared), AccessToken is per-property (unique) |
| pmsRegistry pattern | Single routing point, no scattered if/else checks across codebase |
| UUID detection for rate_id_map | Avoids touching sentinel.service.js deeply — 5 chars of detection logic vs full refactor |
| Parallel webhook router (not shared) | Mews webhook format is fundamentally different from Cloudbeds — separate handlers are cleaner |
| Revenue fetch in webhooks | Extra API call per event but ensures metrics are accurate in real-time, not just on daily cron |
