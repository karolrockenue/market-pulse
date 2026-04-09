# Demand Radar — Progress & Decisions

## What We Built (April 8, 2026)

### Frontend — DemandRadarView.tsx
- Next-gen market sentiment page replacing the old DemandPace view
- Accessible via Sentinel > Demand Radar in TopNav
- Uses selected hotel's city from TopNav (passed via `selectedProperty` prop through SentinelHub)
- Centrepiece: two stacked synced charts — demand bars (busy/quiet) + segment WAP line below
- Event labels above the chart (rotated -45deg, HTML overlay with flex layout)
- Multi-day events show span bars (e.g. Wimbledon 14-day bar)
- Hover tooltip on events: full name, date, category, attendance, accommodation spend, local rank, tier
- Background event columns behind demand bars
- AI Market Brief section (3 insight cards: trajectory, events, compression)
- Booking Behavior section (lead time, LOS) — wired to reservations table
- Booking Window Analysis, Day-of-Week Patterns, Divergence Scatter, 3x Pace Charts, Supply Dynamics, Date Scanner
- WAP spike colouring: subtle amber tint on P75+ and P90+ dates

### What's Live vs Mock
| Data | Source | Status |
|------|--------|--------|
| Demand score, segment WAP, supply | Booking.com scrape via `/api/market/forward-view` | LIVE |
| 7d pace deltas | `/api/market/pace` | LIVE |
| PredictHQ events | `/api/market/events` → PredictHQ API | LIVE (free tier, limited) |
| Lead time distribution | `reservations` table via `/api/market/booking-behavior` | LIVE |
| Length of stay | `reservations` table via `/api/market/booking-behavior` | LIVE |

### Segment WAP (Major Logic Change — April 8, 2026)

**Problem:** The original WAP calculation averaged ALL properties on Booking.com (hostels at £25, 5-star at £480, apartments, everything). For a 3-star hotel operator managing 40 London hotels, the WAP was consistently £20-50 higher than their actual competitive reality. The inflated number was driven by 5★ luxury properties (7-14% of rated supply) whose pricing behaviour has nothing to do with the mid-market segment.

**Solution:** Star-rating-weighted histogram trimming (Scenario A from testing).
- Query `facet_star_rating` JSONB from `market_availability_snapshots` to get per-date star distribution
- Calculate 5★ as % of total rated properties, 1★ as %
- Trim that % from the TOP of the price histogram (removing luxury) and BOTTOM (removing 1★)
- Recalculate WAP from remaining histogram buckets (2-4★ segment)
- Result: WAP drops £20-50 depending on date, with bigger drops on high-demand days when luxury properties spike harder

**Implementation:** `MarketService._calcSegmentWap()` in `market.service.js`. Called per-row in `getForwardView()`, returned as `segment_wap` alongside the original `weighted_avg_price`.

**Validation data (April 8 scrape):**
| Date | Full WAP | 2-4★ WAP | Delta |
|------|----------|----------|-------|
| Apr 8 (Wed) | £169 | £142 | -£27 |
| Apr 11 (Sat) | £204 | £175 | -£29 |
| Apr 25 (marathon) | £279 | £230 | -£50 |
| Jun 27 (peak) | £332 | £285 | -£47 |

**What the page uses:** All WAP references (KPI strip, trajectory, booking windows, day-of-week, scatter, date scanner, spike colouring) use `segmentWap`. The raw full-market `wap` is still in the data but not displayed.

### Backend
- **Migration**: `api/migration_008_predicthq_events.js` — `predicthq_events` cache table (city_slug PK, place_id, events JSONB, fetched_at). 24h TTL.
- **Service**: `MarketService.getPredictHQEvents(citySlug)` in `market.service.js` — fetches events in 3 rank tiers (88+, 80-87, 65-79), uses `within=30km@lat,lng` radius search, deduplicates, maps to lean format.
- **Service**: `MarketService._calcSegmentWap(histogram, minPrice, maxPrice, starRating)` — star-weighted histogram trimming for 2-4★ WAP.
- **Service**: `MarketService.getBookingBehavior(hotelIds)` — derives lead time + LOS buckets from `reservations` table (last 90 days).
- **Service**: `MarketService.getMarketBaseline(citySlug)` — historical P5/P25/P50/P75/P95 percentiles for WAP and supply.
- **Route**: `GET /api/market/events?citySlug=london` in `market.router.js`
- **Route**: `GET /api/market/booking-behavior?hotelIds=1,2,3`
- **Route**: `GET /api/market/market-baseline?city=london`
- **Env var**: `PREDICTHQ_ACCESS_TOKEN` in `.env`

### Timezone Fix (April 8, 2026)
All date parsing in DemandRadarView uses `Date.UTC()` and `timeZone: "UTC"` for formatting to prevent BST/timezone off-by-one errors. Event date iteration uses string comparison instead of `Date.setDate()` mutation.

## PredictHQ API

### Current State
- Free tier: 50 results per query (capped by subscription, not pagination)
- We work around it with 3 separate rank-tier queries = ~150 events per city
- Events beyond ~6 weeks out are sparse because results are consumed by nearer events
- `overflow: true` in responses confirms subscription cap
- Backend uses `e.start` (UTC) not `e.start_local` to avoid timezone date drift

### Pricing (Researched)
- **Starter**: ~$75-150/mo, up to 5 cities, self-serve
- **Premium**: ~$500+/mo, 5+ cities, contact sales
- **Karol is fine paying up to $300/mo**

### Awaiting
- Karol to sign up for Starter plan (removes 50-result cap)
- Once on paid plan: simplify backend to single query with `limit=500`, remove 3-tier workaround

## Design Decisions / Preferences

### Page Scope
- **Market sentiment only** — no hotel-specific data (OTB, your rate, rate positioning)
- Hotel vs market comparison belongs on a separate comp-set page
- Booking behavior (lead time, LOS) kept because it informs market timing, even though it's from own reservations

### Chart Style
- Demand bars: accent blue at varying opacity, amber for 70-85%, red for 85%+
- No CartesianGrid on the demand chart
- Date labels every 2 weeks on x-axis (sparse, 9px, muted)
- WAP chart: 260px tall (increased from 180px for better spike visibility), segment WAP with area fill

### Event Display
- Labels ABOVE the chart, rotated -45deg (CSS flex overlay, no gap)
- Multi-day events get horizontal span bars at bottom of label zone
- Top 10 events by attendance with local_rank >= 90 shown
- Hover tooltip with full details
- Known issue: slight alignment drift between flex overlay and Recharts bars (sub-pixel, acceptable)

## TODO — Next Steps

1. **Upgrade PredictHQ to Starter** — removes result cap, fills out full 90-day event window
2. **Simplify PredictHQ backend** — once on paid plan, single query replaces 3-tier workaround
3. **Blueprint update** — DONE (April 8, 2026)
4. **Consider applying segment WAP to other pages** — the old Demand & Pace page, Market Profile, etc. still use full-market WAP
5. **Rate positioning / comp-set page** — separate page for hotel vs market comparison (your rate vs comp-set, needs pricing waterfall for net sell rate)
