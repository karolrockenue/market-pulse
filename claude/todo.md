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

### ~~Remove Budget Functionality~~ DONE (April 2026)
- Removed: 3 API endpoints (GET/POST budgets, GET benchmarks) from hotels.router.js
- Removed: getBudgets() and saveBudgets() from hotel.service.js
- Removed: budget SQL query and budgetMap from metrics.router.js (pacing targetRev set to 0, targetRevenue set to null)
- Removed: BudgetReport.tsx component (deleted), import + rendering from ReportsHub.tsx
- Removed: "performance-vs-budget" from ReportSelector.tsx and reports.api.ts
- Removed: budgetExists prop from App.tsx and CompetitiveData.tsx
- Removed: budget mention from SettingsPage.tsx description
- Database table (hotel_budgets) preserved — only code removed

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

### ~~Admin — Rebuild Comp Set Management Modal~~ DONE (April 2026)
- Built ManageCompSetModal component at web/src/features/admin/components/ManageCompSetModal.tsx
- Wired into AdminHub.tsx — "Comp Set" button in HotelManagementTable now opens the modal
- Modal: loads current comp set on mount, searchable hotel list with checkboxes, save/clear/cancel
- Clearing all selections reverts to category-based fallback (existing backend behaviour)
- Uses existing backend endpoints: GET/POST /api/hotels/:hotelId/compset
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
