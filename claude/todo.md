# To Do

## Active Tasks

### Remove Budget Functionality
- Completely remove budget functionality from the application (frontend + backend)
- Budget section already removed from Settings page UI
- Still need to remove: budget API endpoints, budget DB queries in hotel.service.js, budget-related imports/references across the codebase, budget report in ReportsHub
- Do NOT delete the database table — just remove all code that reads/writes to it

### Settings Page — PMS Disconnect Button
- The Properties section in Settings needs a working "Disconnect" button per property
- Currently shows a placeholder toast ("Disconnect feature disabled")
- Wire it to hit the PMS disconnect endpoint
- Should confirm before disconnecting (destructive action)
- After disconnect, update the property status in the UI

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
