# **Project "Market Pulse" - Archive & Milestones**

This document contains supplementary context, historical milestones, and detailed developer tooling guides for the Market Pulse project.

---

## **1.0 Project Overview (Context)**

Market Pulse is a multi-tenant SaaS application designed to provide hotel operators with competitive market intelligence. Users can compare their property's performance (Occupancy, ADR, RevPAR) against a curated or dynamically generated market competitive set, track forward-looking market pace, and set internal performance budgets.

---

## **7.5 Developer Scripts & Tooling (Detailed Guide)**

This section documents internal scripts used by developers for data management and maintenance. These are not part of the deployed application and are run manually from the command line.

### **scripts/import-monthly-history.js**

* **Purpose:** A high-safety, idempotent script to import historical *monthly* performance data from a CSV.
* **Methodology:**
    1.  Accepts monthly CSV totals (`total_net_revenue`, `total_rooms_sold`).
    2.  Fetches the hotel's `total_rooms` and `tax_rate` from the `hotels` table.
    3.  Uses a "Pattern Hotel" (either itself or an external hotel) to disaggregate monthly totals into realistic daily records.
    4.  Calculates gross revenue, ADR, and RevPAR using the hotel's `tax_rate`.
    5.  Atomically deletes old data, inserts new data, and updates the `hotels.locked_years` array in a single database transaction.

* **Usage:**
    ```bash
    node scripts/import-monthly-history.js \
    --hotelId=<target_hotel_id> \
    --csv="/path/to/data.csv" \
    --lockYears="<year1,year2>" \
    --patternHotelId=<optional_pattern_hotel_id>
    ```

* **Required CSV Format:**
    The script requires a CSV file with the following headers. The `month` column must be in `YYYY-MM` format.
    ```csv
    month,total_rooms_sold,total_net_revenue
    2023-01,500,75000
    2023-02,450,68000
    2023-03,510,77000
    ```

### **Tool 2: Daily Data Import Script (`import-daily-history.js`)**

* **Purpose:** Used when the hotel provides a CSV that *already contains* daily-level data. This script bypasses all "pattern" and "disaggregation" logic.
* **Usage:**
    ```bash
    node scripts/import-daily-history.js \
    --hotelId=318238 \
    --csv="/path/to/daily-data.csv" \
    --lockYears="2022,2023"
    ```
* **CSV Format:** Expects `date`, `revenue_gross`, and `occupancy`.
    > **CRITICAL:** The `occupancy` column **must** be a decimal (e.g., `0.8214`), **not** a percentage (e.g., `82.14`).
    ```csv
    date,revenue_gross,adr_gross,occupancy
    2022-01-01,1598.66,69.50,0.821429
    2022-01-02,996.50,55.36,0.642857
    ```
* **Core Logic:**
    1.  Fetches the hotel's `total_rooms` (as `capacityCount`) and `tax_rate` from the `hotels` table.
    2.  Ignores the `adr_gross` column in the CSV (it's considered unreliable).
    3.  Loops through each daily row in the CSV.
    4.  Calculates the definitive `rooms_sold` using the formula: `Math.round(occupancy * capacityCount)`.
    5.  Calculates all other metrics (`net_revenue`, `net_adr`, `gross_adr`, `net_revpar`, `gross_revpar`) based on this `rooms_sold` value.
    6.  Wraps the entire `DELETE` and `INSERT` operation in a single transaction and locks the years, just like the monthly script.

---

## **8.0 Architectural Milestones**

* **11.0: OTA Crawler & Vercel Deployment (Oct 2025):** Deployed a Playwright-based scraper to Vercel, requiring a switch to playwright-core and @sparticuz/chromium to resolve build errors.  

* **12.0: Reliable Room Count (Oct 2025):** Fixed unreliable room counts by adding a total\_rooms column to the hotels table. Created the GET /api/admin/backfill-room-counts endpoint to populate this column directly from the PMS source of truth.  

* **13.0: Occupancy Data Refactor (Oct 2025):** A critical bug was fixed where occupancy was being read from an unreliable occupancy\_direct column. All API endpoints (in dashboard.router.js, reports.router.js, market.router.js) were refactored to calculate occupancy on-the-fly using (SUM(rooms\_sold)::numeric / NULLIF(SUM(capacity\_count), 0)). The occupancy\_direct column is now considered deprecated.  

* **14.0: Budget Pacing Logic (Oct 2025):** Implemented the core business logic for the Budgeting feature. It provides a "Green / Yellow / Red" status for a budget month by comparing the **Required ADR** (rate needed on unsold rooms to hit the target) against a **Benchmark ADR** (a realistic rate derived from L30D/SMLY data via GET /api/budgets/benchmarks).  
* **15.0: Rockenue Management Data Model (Oct 2025):** Implemented a hybrid data model for internal tools, visible **only to super\_admin users**.  
  * hotels table was extended with is\_rockenue\_managed (BOOLEAN) and management\_group (TEXT).  
  * A private rockenue\_managed\_assets table was created to serve as a financial ledger, allowing super\_admin users to track monthly\_fee for both "Live" Market Pulse properties and **"Off-Platform" assets** that are not part of the main application.  
* **16.0: React Migration & Monorepo Deployment (Oct 2025):** The original Alpine.js /public folder was replaced with a new /web React application. The deployment architecture was pivoted to a single-server monorepo, where server.js acts as the single entry point, serving both the API and the static React index.html file.
* **17.0: Unified Pacing Benchmark Logic (Nov 2025):** Resolved a critical bug where the Portfolio Risk Overview and Budgeting pages showed different risk statuses for the same property. The discrepancy was caused by two conflicting "sources of truth" for benchmark ADR (flawed L30D/SMLY logic vs. correct full-month-average logic).
* **Solution:** Created a new shared utility file, **/api/utils/benchmark.utils.js**, to house the single source of truth for benchmark data.
  * **[EDIT]** This logic was later corrected to prioritize **Last 30 Days (L30D)** data as the primary benchmark. If L30D data is unavailable, it falls back to **Same Month Last Year (SMLY)**, and finally to a hard-coded default.
  * **Refactor:** Modified **/api/routes/portfolio.router.js** and **/api/routes/budgets.router.js** to remove all local benchmark logic and call this new shared utility, ensuring 100% consistency.

* **18.0: Market Codex & "Demand & Pace" (Nov 2025):** Deployed the new "Demand & Pace" feature, a major initiative to provide live, forward-looking market intelligence. This involved several new architectural patterns:

  Database Pre-calculation: A migration added two STORED generated columns (weighted_avg_price, hotel_count) to the market_availability_snapshots table. This moves heavy WAP and JSON parsing logic from read-time to insert-time, making all future queries extremely fast.

  "Logic Hub" Implementation: Created a new api/utils/market-codex.utils.js file. This "Logic Hub" centralizes all business-facing logic (like calculatePriceIndex and calculateMarketDemand), allowing for easy updates without changing the API or database.

  New API Router: Deployed a new api/routes/planning.router.js with resilient DISTINCT ON queries to serve the 90-day grid (/forward-view) and pace charts (/pace).

  New "Market Outlook" Logic: Defined and implemented a "Split-Half" methodology for the GET /planning/market-trend endpoint. This logic compares the average 30-day forward-looking forecast from a "Recent" period (e.g., last 11 days) against a "Past" period (e.g., first 11 days) to determine if the market is "Softening" or "Strengthening".

* **[NEW] 19.0: Historical Data Import Tool (Nov 2025):** Resolved a major business and data-integrity problem where importing historical data was a high-risk, manual SQL task.
    * **Problem:** The manual process was unscalable, error-prone, and could not handle the common client requirement of providing *monthly* totals instead of daily records.
    * **Solution:** Created a new developer-facing script, `scripts/import-monthly-history.js`.
    * **Core Logic:** The tool implements a "monthly-to-daily" disaggregation strategy. It uses a daily distribution pattern from a "Pattern Hotel" (either the hotel's own data from other years or an external hotel) to intelligently spread monthly totals across the days of the month.
    * **Data Integrity:** The script ensures data completeness by fetching the hotel's `tax_rate` to populate both `net_revenue` and `gross_revenue` columns.
    * **Safety:** The entire operation is wrapped in a single transaction and, on success, atomically adds the imported years to the `hotels.locked_years` array, protecting the new data from the `initial-sync.js` job.

* **[NEW] 20.0: Unified Hotel Dashboard & Logic Refactor (Nov 2025):** Deployed the new primary dashboard (`HotelDashboard.tsx`) to replace the original "You vs. Comp Set" view.
    * **Unified Endpoint:** Created a new `GET /api/dashboard/summary` endpoint that fetches all dashboard data (Snapshots, YTD, Market, Ranks) in a single parallelized API call.
    * **View Routing:** Refactored `App.tsx` to make the new dashboard the default `'dashboard'` view and moved the legacy chart/table view to `'youVsCompSet'`.
    * **Logic Centralization:** Refactored the "Market Outlook" (Strengthening/Softening) logic out of both `planning.router.js` and `dashboard.router.js` and into a single, new function (`getMarketOutlook`) in the `api/utils/market-codex.utils.js` "Logic Hub" to ensure 100% consistency between the two pages.

* **[NEW] 21.0: UI/Logic Consistency Fixes (Nov 2025):**
    * **Logo & Favicon Refactor:** Replaced the dynamic JavaScript-based favicon (`Favicon.tsx`) with a static, embedded SVG in `index.html` to fix scaling/squishing issues. Replaced the nav bar's image logo with the correct text-based `( MARKET PULSE )` logo from the prototype, aligning it with `items-baseline` and pixel-nudging for visual perfection.
    * **Pacing Logic Unification (Dashboard):** Centralized the "At Risk" / "On Target" logic for the Hotel Dashboard into the new `api/utils/pacing.utils.js` hub. This logic is now executed by the `GET /api/dashboard/summary` endpoint, removing all calculation responsibility from the `HotelDashboard.tsx` component and ensuring consistency.
    * **Benchmark Logic Correction:** Corrected the core business logic in `api/utils/benchmark.utils.js`. The system now correctly prioritizes L30D data over SMLY data when calculating benchmarks, fixing a major logical flaw.

* **[NEW] 22.0: "Shadowfax" On-Demand Price Checker (Nov 2025):** Deployed a new "Sentinel" tool for `super_admin` users to perform live, on-demand price checks.
    * **Leveraged Existing Stack:** Reused the existing Vercel Playwright/Chromium stack (`Milestone 11.0`) for a new purpose.
    * **New "Logic Hub":** Created `api/utils/scraper.utils.js` to contain all Playwright logic.
    * **New API & UI:** Added the `POST /api/scraper/get-price` endpoint and a new `web/src/components/ShadowfaxPage.tsx` component.
    * **Schema Update:** Added `booking_com_url` to the `hotels` table to support this feature.

---

## **9.4 Key Component Analysis**

| Component | Purpose & Key Props |
| :---- | :---- |
| **App.tsx** | **Main application container.** Holds all shared state and view-routing logic. **[MODIFIED]** Now also contains state (`shreejiScheduledReports`) and handlers (`handleSaveShreejiSchedule`) for the Shreeji scheduling UI, passing them as props. |
| **TopNav.tsx** | **Global navigation bar.** props: activeView, onViewChange, property, onPropertyChange, properties, lastUpdatedAt, userInfo. |
| **LandingPage.tsx** | **Public login/marketing page.** props: onSignIn, onViewChange. |
| **Budgeting.tsx** | **Budgeting & Pacing page.** props: propertyId, currencyCode. |
| **CreateBudgetModal.tsx** | **Modal for creating/editing budgets.** props: isOpen, onClose, year, onSaveBudget, existingBudget. |
| **YearOnYearReport.tsx** | **Self-contained YTD report.** props: propertyId, currencyCode. |
| **SettingsPage.tsx** | **Tabbed settings container.** props: userInfo, onUpdateProfile, onInviteUser, onRemoveUser, teamMembers, properties. |
| **HotelManagementTable.tsx** | **Main table on the Admin page.** props: onManageCompSet, hotels, onManagementChange, managementGroups. |
| **ManageCompSetModal.tsx** | **Modal for editing a hotel's comp set.** props: open, onClose, hotelId, hotelName, allHotels. |
| **SystemHealth.tsx** | **Admin widget for testing connections.** props: propertyId, lastRefreshTime, onRefreshData. |
| **CloudbedsAPIExplorer.tsx** | **Admin widget for raw API calls.** props: propertyId. |
| **PortfolioOverview.tsx** | **Private super\_admin page for financial tracking.** (Managed internally). |
| **PortfolioRiskOverview.tsx** | **Private super_admin diagnostic page. Combines volume and pacing risk into a portfolio-wide view. (Managed internally).** | **DemandPace.tsx** | New 'Demand & Pace' feature page. Displays 90-day grid, charts, and market highlights. | propertyId, currencyCode, city 
| **HotelDashboard.tsx** | **[NEW] The main application dashboard.** Displays performance snapshots, 90-day demand, YTD trend, and comp set rank. | onNavigate, data, isLoading 
| **DynamicYTDTrend.tsx** | **[NEW] Sub-component for the dashboard.** Displays the YTD vs. Last Year revenue table. | onNavigate, data |
| **ShadowfaxPage.tsx** | **[NEW] "Sentinel" tool for on-demand price scraping.** (Managed internally). | (None) |