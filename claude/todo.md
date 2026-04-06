# To Do

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

### Remove Budget Functionality
- Completely remove budget functionality from the application (frontend + backend)
- Budget section already removed from Settings page UI
- Still need to remove: budget API endpoints, budget DB queries in hotel.service.js, budget-related imports/references across the codebase, budget report in ReportsHub
- Do NOT delete the database table — just remove all code that reads/writes to it

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

### Admin — Rebuild Comp Set Management Modal
- The "Comp Set" button in HotelManagementTable exists but does nothing (onManageCompSet={() => {}})
- The ManageCompSetModal component was never migrated into the admin feature module
- Need to rebuild: modal that lets admin pick which hotels form the comp set for a given hotel
- Backend already exists: GET/POST /api/hotels/:hotelId/compset in hotels.router.js
- Comp set is used for benchmarking — if no manual comp set, falls back to same-category hotels
- Modal should show searchable list of all hotels, allow selecting/deselecting competitors, save via POST

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

## Distribution Manager (New Feature — Prototype Ready)

### Business Need
We manage distribution across 45+ properties with a growing number of OTA channels (Booking.com, Expedia, Agoda, Hotelbeds, Trip.com, etc.). Each OTA has its own promotional programs — Booking.com has Genius, Non-Refundable, Mobile Rate, Geo Rate; Expedia has Member Deal, Pay Now; Agoda has Private Sale, CUG Deal, Insider Deal; and so on. Today this is managed with zero tooling — not even a spreadsheet.

The day-to-day reality is chaotic:
- Properties constantly toggle programs on and off due to rate parity issues, seasonal decisions, or management calls — and there's no record of who changed what or why
- There are always 5-10 onboardings in the pipeline across different OTAs, at different stages, handled by different people — and the list changes daily ("add this hotel", "actually remove that one, add another")
- Nobody has a single view of "which hotels are live on which OTAs" or "which programs are currently active across the portfolio"
- When something goes wrong (e.g., a Genius rate undercuts direct), there's no audit trail to understand what was changed and when

### What We're Building
A Distribution section inside Market Pulse with three core workflows:

1. **Distribution Matrix** — a grid of hotels × OTA channels showing connection status (live / pipeline / paused / not connected) at a glance. Click any cell to see program details, toggle programs, and view change history for that hotel+OTA pair.

2. **Onboarding Pipeline** — a Kanban board tracking hotel onboardings by stage (Requested → Credentials → Room Mapping → Rates Loaded → Testing → Live). Cards show the hotel, OTA, assignee, days-in-stage, and notes. New onboardings are added as cards; completed ones move to Live.

3. **Program Control Panel** — per-OTA view of all promotional programs with active/paused counts across the portfolio. Toggling a program off requires a reason (parity issue, seasonal, management decision), building an automatic audit trail.

4. **Change Log** — immutable audit trail of every distribution change: program toggles, connection status changes, onboarding milestones. Shows who, what, when, and why.

### Current Status (April 2026)
- **UI prototype is live** in the Sentinel menu → "Distribution"
- Built as a fully interactive visual mockup using real managed hotel names (21 properties from the fleet) and realistic mock data for 6 OTA channels and their programs
- All four tabs are functional with mock data: Matrix, Pipeline, Programs, Change Log
- Matrix cells are clickable with a slide-out detail panel showing program toggles and recent changes
- No backend, no database tables, no API endpoints yet — purely frontend mockup

### Where It Lives
- **Frontend**: `web/src/features/sentinel/components/Distribution/DistributionView.tsx`
- **Navigation**: Sentinel dropdown → "Distribution" (admin only)
- **Routing**: Wired through `SentinelHub.tsx` and `App.tsx`

### Next Steps for Production
1. **Database schema**: tables for `distribution_channels`, `channel_connections` (hotel × OTA status), `channel_programs`, `program_enrollments` (hotel × program with status + reason), `distribution_pipeline` (onboarding tasks with stages), `distribution_changelog` (audit log)
2. **API endpoints**: CRUD for connections, programs, pipeline tasks; changelog is append-only
3. **Wire frontend to real data**: replace mock constants with API calls + hooks
4. **Permissions**: decide if all team members can toggle programs or if changes need approval
5. **Notifications**: optional Slack/email alerts when programs are paused or onboardings stall
6. **Future**: rate parity detection (compare rates across channels automatically), integration with OTA extranets to push changes directly
