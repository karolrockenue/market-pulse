# **Project "Market Pulse" \- Technical Handbook 2.0**

**Last Updated:** October 30, 2025

## **0.0 AI Development Workflow**

This document is the single source of truth for the project. All future AI-assisted development must adhere to the following principles:

* **Analyze First:** The AI must analyze all provided project files at the start of a session and confirm with "Done". User wants concise responses 
* **Plan Before Action:** A bullet-point plan must be presented before any code is modified.  
* **Clarify Ambiguity:** The AI must ask clarifying questions instead of making assumptions, especially regarding files and function names. Do not provide the code until user is satisfied that a plan has been established.
* **One Step at a Time:** Provide clear, sequential instructions, modifying only one file at a time.  
* **Commenting:** We are no longer heavily commenting the code, only comments are at the start of new functions or endpoints to keep overall structure clear  
* **Test Incrementally:** Provide a "Test Point" after each step with specific verification instructions.  
* **Request Files:** If a file is needed for a change but has not been uploaded, the AI must ask for it.

---

## **1.0 Project Overview & Technology Stack**

Market Pulse is a multi-tenant SaaS application designed to provide hotel operators with competitive market intelligence. Users can compare their property's performance (Occupancy, ADR, RevPAR) against a curated or dynamically generated market competitive set, track forward-looking market pace, and set internal performance budgets.

* **Backend:** Node.js with Express.js  
* **Frontend:** React (Vite)  
* **Database:** PostgreSQL (Neon DB)  
* **Styling:** Tailwind CSS  
* **Charting:** Recharts, ECharts, Chart.js  
* **Headless Browser (Scraper):** Playwright-Core with @sparticuz/chromium  
* **Deployment:** Vercel (Monorepo: Serverless Functions & Cron Jobs)  
* **Email:** SendGrid for transactional emails (magic links, reports, support)

---

## **2.0 Core Architectural Principles**

### **2.1 Deployment: Monorepo Architecture**

The project is deployed as a single Vercel application from a monorepo structure.

* **/ (Root):** Contains the Node.js/Express backend, including the main server.js entry point, vercel.json config, and the /api directory.  
* **/web:** Contains the React (Vite) frontend application.

The Vercel build process (vercel-build) first builds the React app into /web/build. The server.js file is then deployed as the single entry point for all traffic. It serves static assets from /web/build and serves the React index.html for all non-API routes, which solves all 404 errors from the migration.

### **2.2 Backend: Fully Serverless & Adapter Pattern**

* **Fully Serverless Architecture:** The backend is a single Node.js/Express server (server.js) that mounts all API endpoints from feature-based router files within the /api/routes/ directory.  
* **Shared Utilities:** Reusable logic, such as database connections (db.js), authentication middleware (middleware.js), and the unified pacing logic (**benchmark.utils.js**), is centralized in /api/utils/.
* **PMS-Agnostic Adapter Pattern:** All communication with external Property Management Systems (PMS) is abstracted into adapters located in /api/adapters/ (e.g., cloudbedsAdapter.js, mewsAdapter.js). The core application logic is decoupled from any specific vendor.

### **2.3 Frontend: React SPA & Shared State**

* **Declarative, State-Driven UI:** The frontend is a React Single Page Application (SPA). All UI interactivity is built using React components, with state managed in the main App.tsx component and passed down via props.  
* **Figma AI Prototype:** The React prototype is generated using Figma AI. This means the AI understands all design principles, and development prompts do not need to specify styles (colors, fonts, etc.), allowing for creative freedom within the established design system.  
* **Single Entry Point:** App.tsx handles all top-level concerns, including session checking, routing, and fetching shared data (e.g., property lists, user info).  
* **Data Flow:** App.tsx performs all primary API calls inside useEffect hooks. The resulting data is passed down as props to child components (e.g., kpiData is passed to KPICard and InsightsCard).

* **Styling Workaround:**: The project's global web/src/index.css file is a static artifact and is not rebuilt to scan for new classes. Standard utility classes (e.g., p-4, grid) will not work. All new or modified layout styling must be implemented using inline style props. Styles for existing shadcn/ui components (like <Button> or <Input>) will continue to work via their className prop, as their styles are already included in the static CSS file.

---

## **3.0 Authentication & Authorization**

### **3.1 User Onboarding & Login**

* **Magic Link (Primary):** The primary login method for all users. A POST /api/auth/login request triggers a SendGrid email with a short-lived token. The email template is generated from api/utils/emailTemplates.js.  
* **Cloudbeds OAuth 2.0:** New properties using Cloudbeds are connected exclusively via the standard Cloudbeds OAuth 2.0 flow (GET /api/auth/cloudbeds).  
* **Mews Manual Token:** New properties using Mews connect via a two-step manual token exchange (POST /api/auth/mews/validate and POST /api/auth/mews/create).  
* **User Invitations:** Existing owner or super\_admin users can invite new team members via POST /api/users/invite.  
* **Local Dev Login:** In non-production environments, a POST /api/dev-login endpoint allows developers to create a session by sending their email.

### **3.2 Role-Based Access Control (RBAC)**

The system uses a role column in the users table and in the session to manage permissions.

* **super\_admin:** Full system access. Can view all properties, access the Admin & Rockenue pages, and manage all settings.  
* **owner:** Can manage properties they are linked to via pms\_credentials in user\_properties. Can invite/manage team members for those properties.  
* **user:** Basic access. Can view data for properties they are linked to but cannot manage settings or team members.

All API routes are protected by middleware from api/utils/middleware.js (e.g., requireUserApi, requireAdminApi, requireSuperAdmin).

---

## **4.0 Database Schema**

The database schema is defined as follows. (System tables like geography\_columns are omitted for brevity).

### **daily\_metrics\_snapshots**

Stores daily performance data.

* snapshot\_id (integer, PK)  
* stay\_date (date, NOT NULL)  
* hotel\_id (integer, NOT NULL)  
* rooms\_sold (integer)  
* capacity\_count (integer)  
* net\_revenue (numeric)  
* gross\_revenue (numeric)  
* net\_adr (numeric)  
* gross\_adr (numeric)  
* net\_revpar (numeric)  
* gross\_revpar (numeric)  
* occupancy\_direct (numeric) \- **DEPRECATED**  
* ... (other legacy/raw data columns)

### **hotels**

Stores property details.

* hotel\_id (integer, PK)  
* property\_name (text)  
* pms\_type (character varying)  
* pms\_property\_id (character varying)  
* city (text)  
* country (text)  
* latitude (numeric)  
* longitude (numeric)  
* neighborhood (character varying)  
* currency\_code (text)  
* timezone (character varying)  
* tax\_rate (numeric)  
* tax\_type (character varying)  
* category (character varying)  
* go\_live\_date (date)  
* total\_rooms (integer) \- The definitive physical room count.  
* locked\_years (jsonb) \- Array of years (e.g., \["2024"\]) to protect from sync overwrites.  
* is\_rockenue\_managed (boolean)  
* management\_group (text)

### **hotel\_budgets**

Stores monthly targets for the Budgeting feature.

* id (uuid, PK)  
* hotel\_id (integer, NOT NULL)  
* budget\_year (integer, NOT NULL)  
* month (integer, NOT NULL)  
* target\_occupancy (numeric)  
* target\_adr\_net (numeric)  
* target\_adr\_gross (numeric)  
* target\_revenue\_net (numeric, NOT NULL)  
* target\_revenue\_gross (numeric, NOT NULL)

### **rockenue\_managed\_assets**

Private ledger for super\_admin financial tracking.

* id (uuid, PK)  
* asset\_name (text, NOT NULL)  
* city (text)  
* total\_rooms (integer)  
* management\_group (text)  
* monthly\_fee (numeric)  
* market\_pulse\_hotel\_id (text) \- Links to hotels.hotel\_id. NULL if "Off-Platform".

### **market\_availability\_snapshots**

Stores daily data from the "Market Codex" crawler.

* id (uuid, PK)  
* provider (text, NOT NULL)  
* city\_slug (text, NOT NULL)  
* checkin\_date (date, NOT NULL)  
* scraped\_at (timestamp with time zone)  
* total\_results (integer)  
* facet\_property\_type (jsonb)  
* facet\_neighbourhood (jsonb)  
* facet\_star\_rating (jsonb)  
* facet\_price\_histogram (jsonb)  
* min\_price\_anchor (numeric)  
* max\_price\_anchor (numeric)
* `weighted_avg_price (numeric)` - **GENERATED COLUMN**
* `hotel_count (integer)` - **GENERATED COLUMN**

### **users**

Stores user account information.

* user\_id (integer, PK)  
* cloudbeds\_user\_id (character varying) \- The session ID.  
* email (character varying)  
* first\_name (text)  
* last\_name (text)  
* role (character varying, NOT NULL) \- super\_admin, owner, or user.  
* pms\_type (character varying, NOT NULL)

### **user\_properties**

Links users to hotels.

* user\_id (character varying, NOT NULL) \- Links to users.cloudbeds\_user\_id.  
* property\_id (integer, NOT NULL) \- Links to hotels.hotel\_id.  
* pms\_credentials (jsonb) \- NULL for user roles. Encrypted for Mews.  
* status (character varying)

### **Other Tables**

* **hotel\_comp\_sets:** Manages manual competitive sets.  
* **user\_invitations:** Stores pending invites.  
* **scheduled\_reports:** Configuration for email reports.  
* **magic\_login\_tokens:** Stores single-use login tokens.  
* **system\_state:** K-V store for system status (e.g., last\_successful\_refresh).  
* **user\_sessions:** Stores active connect-pg-simple user sessions.

---

## **5.0 Project File Structure (Backend)**

market-pulse/  
├── api/  
│   ├── adapters/  
│   │   ├── cloudbedsAdapter.js  \# Handles all Cloudbeds API logic  
│   │   ├── mewsAdapter.js       \# Handles all Mews API logic  
│   │   └── operaAdapter.js      \# Handles OHIP/OPERA auth flow  
│   ├── routes/  
│   │   ├── admin.router.js  
│   │   ├── auth.router.js  
│   │   ├── budgets.router.js    \# \[NEW\] Budgeting feature  
│   │   ├── dashboard.router.js  
│   │   ├── market.router.js  
│   │   ├── portfolio.router.js
│   │   ├── reports.router.js  
│   │   ├── rockenue.router.js  
│   │   ├── support.router.js    \# \[NEW\] Support form endpoint  
│   │   └── users.router.js 
│   │   ├── planning.router.js   \# \[NEW\] 
│   ├── utils/  
│   │   ├── db.js                \# PostgreSQL connection pool 
│   │   ├── benchmark.utils.js           \# Single source of truth for pacing benchmarks 
│   │   ├── market-codex.utils.js
│   │   ├── emailTemplates.js    \# \[NEW\] HTML for magic link email  
│   │   └── middleware.js        \# Auth & role-based middleware  
│   ├── daily-refresh.js         \# CRON: Syncs 365-day forecast  
│   ├── initial-sync.js          \# JOB: Syncs 5-year history  
│   ├── send-scheduled-reports.js \# CRON: Generates & emails reports  
│   └── sync-rockenue-assets.js \# \[NEW\] CRON: Syncs hotels to private ledger  
│  
├── web/                         \# \[NEW\] React Frontend (See Section 9.0)  
│  
├── .env                         \# All project secrets  
├── package.json                 \# Root (Backend) dependencies & build scripts  
├── server.js                    \# \[MODIFIED\] Main Express server entry point  
└── vercel.json                    \# Vercel deployment & cron config

---

## **6.0 API Endpoints**

All endpoints are mounted under /api in server.js.

### **auth.router.js**

* POST /auth/login: Initiates magic link login.  
* GET /auth/magic-link-callback: Validates magic link token and creates a session.  
* GET /auth/cloudbeds, GET /auth/cloudbeds/callback: Cloudbeds OAuth 2.0 flow.  
* POST /auth/mews/validate, POST /auth/mews/create: Mews two-step token connection.  
* GET /auth/opera, GET /auth/opera/callback: OPERA/OHIP OAuth 2.0 flow.  
* GET /accept-invitation: Validates an invitation token and creates a new team member.  
* POST /auth/logout: Destroys the user session.  
* GET /auth/session-info: Retrieves details for the currently logged-in user (role, name, etc.).

### **dashboard.router.js**

* GET /my-properties: Fetches properties a user has access to (all properties for super\_admin).  
* GET /hotel-details/:propertyId: Fetches details for a single hotel (currency, tax rate, etc.).  
* GET /kpi-summary: Fetches aggregated KPI data (Occ, ADR, RevPAR) for the dashboard cards, including market comparison.  
* GET /competitor-metrics: Fetches competitor set data, including the detailed category/neighborhood breakdown.  
* GET /sync-status/:propertyId: Checks if the initial 5-year data sync for a property has completed.  
* GET /market-ranking: Calculates and returns the hotel's rank for key metrics against its comp set.  
* GET /dashboard-chart: Provides aggregated time-series data for the main dashboard chart, supporting daily, weekly, and monthly granularity.  
* GET /metrics-from-db: Provides detailed, raw metrics for a property, used by the Budgeting page.  
* GET /user/profile, PUT /user/profile: Manages user profile data (name, etc.).  
* GET /last-refresh-time: Gets the timestamp from system\_state to display "Last updated" time.

### **market.router.js**

* GET /market/trends, GET /market/kpis, GET /market/neighborhoods, GET /market/seasonality: Provides aggregated data for the "Market Overview" page.  
* GET /market/available-seasonality-years: Returns the years for which valid seasonality data exists.

### **reports.router.js**

* GET /reports/scheduled-reports, POST /reports/scheduled-reports, DELETE /reports/scheduled-reports/:id: Manages report scheduling configuration.  
* **\[NEW\]** POST /reports/run: Consolidated endpoint for the React report builder. Dynamically builds a SQL query based on selected metrics, granularity, and tax settings.  
* **\[NEW\]** GET /reports/available-years: Fetches a clean list of years with valid data for a property, respecting go\_live\_date.  
* **\[NEW\]** POST /reports/year-on-year: Provides a 12-month comparison for two selected years.

### portfolio.router.js

*All routes are protected by requireSuperAdmin middleware*.

* **\[NEW\]** GET /portfolio/occupancy-problem-list: Fetches hotels ranked by forward 30-day occupancy to power the "Problem List".
* **[NEW]** GET /portfolio/pacing-overview: Fetches data for the "Risk Quadrant Chart" and "Budget Pacing Problem List". **Refactored to use benchmark.utils.js** for its Pacing Rate Pressure calculation, aligning it with the Budgeting page.
* **\[NEW\]** GET /portfolio/occupancy-matrix: Fetches forward 45-day occupancy data for the "Occupancy Matrix" component.

### **planning.router.js**

* GET /planning/forward-view: Fetches the 90-day forward-looking data. Runs a resilient DISTINCT ON (checkin_date) query to get the latest scrape for each day. Passes data to the Logic Hub to calculate MPSS and Market Demand.

* GET /planning/pace: Fetches 90-day pace data. Uses a resilient two-query method to compare "latest" vs. "past" (N-day-ago) scrapes. Passes data to the Logic Hub to calculate deltas.

* GET /planning/history: Fetches the 30-day scrape history for a single check-in date, used for on-demand drill-downs.

* GET /planning/market-trend: Powers the "Market Outlook" banner. It performs a "Split-Half" comparison of available data (e.g., 11 days vs. 11 days) to calculate the rolling trend of the 30-day forward-looking supply and WAP.


### **users.router.js**

* POST /users/invite: Sends an invitation to a new user for a specific property.  
* DELETE /users/remove: Removes a user from a team or deletes a pending invitation.  
* POST /users/disconnect-property: Performs a full transactional deletion of a property and all its associated data.  
* GET /users/team: Fetches the list of all users and pending invites for a team.

### **admin.router.js**

*All routes are protected by requireAdminApi middleware*.

* GET /admin/get-all-hotels: Fetches all hotels, including management status.  
* POST /admin/update-hotel-category: Updates a hotel's quality tier (e.g., "Midscale").  
* POST /admin/update-hotel-management: Updates is\_rockenue\_managed or management\_group for a hotel.  
* GET /admin/management-groups: Returns a distinct list of management group names.  
* GET /admin/hotel/:hotelId/compset, POST /admin/hotel/:hotelId/compset: Manages a hotel's manual comp set.  
* POST /admin/sync-hotel-info: Manually triggers a metadata sync (name, city, rooms) for a hotel from its PMS.  
* POST /admin/initial-sync: Manually triggers the 5-year initial-sync.js job.  
* GET /admin/daily-refresh: Manually triggers the 365-day daily-refresh.js job.  
* POST /admin/run-scheduled-report: Manually triggers a single scheduled report by its ID.  
* GET /admin/backfill-room-counts: A script to populate the hotels.total\_rooms column from the PMS for all hotels.  
* GET /admin/explore/:endpoint: A wrapper endpoint to power the Cloudbeds API Explorer tool.  
* GET /admin/test-mews-connection, GET /admin/test-mews-occupancy, GET /admin/test-mews-revenue: Secure test endpoints for Mews API debugging.

### **rockenue.router.js**

*All routes are protected by requireSuperAdmin middleware*.

* GET /rockenue/hotels: Fetches a list of all hotels for report dropdowns.  
* GET /rockenue/shreeji-report: Generates the data for the in-house guest balance report.  
* **\[NEW\]** GET /rockenue/portfolio: Fetches all assets from the rockenue\_managed\_assets table.  
* **\[NEW\]** POST /rockenue/portfolio: Adds a new "Off-Platform" asset to the private ledger.  
* **\[NEW\]** PUT /rockenue/portfolio/:id: Updates an asset's details. Only allows monthly\_fee to be changed for "Live" assets.  
* **\[NEW\]** DELETE /rockenue/portfolio/:id: Deletes an asset *only if* it is "Off-Platform".

### **budgets.router.js**

*All routes are protected by requireUserApi middleware*.

* **\[NEW\]** GET /budgets/:hotelId/:year: Fetches the 12-month budget for a property.  
* **\[NEW\]** POST /budgets/:hotelId/:year: Saves or updates the 12-month budget in a transaction.  
* **[NEW]** GET /budgets/benchmarks/:hotelId/:month/:year: Provides dynamic benchmark ADR/Occ by calling the unified **benchmark.utils.js** utility, ensuring consistent pacing logic across the app.
### **support.router.js**

* **\[NEW\]** POST /support/submit: Handles the "Contact Us" form submission, sending a formatted email via SendGrid to the support inbox.

---

## **7.0 Automated Jobs (Vercel Cron Jobs)**

* api/daily-refresh.js: Runs daily. Fetches the next 365 days of forecast data (Occupancy, ADR, Revenue) for **all** connected properties from their respective PMS (Cloudbeds or Mews). Updates last\_successful\_refresh in system\_state on completion.  
* api/send-scheduled-reports.js: Runs every 5 minutes (\*/5 \* \* \* \*). Checks the scheduled\_reports table for jobs due at the current UTC time and emails them.  
* api/ota-crawler.js: Runs daily. Scrapes aggregate market availability data. (Note: This job is part of the Market Pulse repo, distinct from the Market Codex crawler).  
* **\[NEW\]** api/sync-rockenue-assets.js: Runs daily. Syncs any hotel with is\_rockenue\_managed \= true into the rockenue\_managed\_assets table.

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
  * **Solution:** Created a new shared utility file, **/api/utils/benchmark.utils.js**, which contains the single, correct benchmark calculation (full-month average).
  * **Refactor:** Modified **/api/routes/portfolio.router.js** and **/api/routes/budgets.router.js** to remove all local benchmark logic and call this new shared utility, ensuring 100% consistency.

* **18.0: Market Codex & "Demand & Pace" (Nov 2025):** Deployed the new "Demand & Pace" feature, a major initiative to provide live, forward-looking market intelligence. This involved several new architectural patterns:

  Database Pre-calculation: A migration added two STORED generated columns (weighted_avg_price, hotel_count) to the market_availability_snapshots table. This moves heavy WAP and JSON parsing logic from read-time to insert-time, making all future queries extremely fast.

  "Logic Hub" Implementation: Created a new api/utils/market-codex.utils.js file. This "Logic Hub" centralizes all business-facing logic (like calculatePriceIndex and calculateMarketDemand), allowing for easy updates without changing the API or database.

  New API Router: Deployed a new api/routes/planning.router.js with resilient DISTINCT ON queries to serve the 90-day grid (/forward-view) and pace charts (/pace).

  New "Market Outlook" Logic: Defined and implemented a "Split-Half" methodology for the GET /planning/market-trend endpoint. This logic compares the average 30-day forward-looking forecast from a "Recent" period (e.g., last 11 days) against a "Past" period (e.g., first 11 days) to determine if the market is "Softening" or "Strengthening".
  
---

## **9.0 Frontend Architecture**

This section details the new React-based frontend architecture, which resides in the /web directory of the monorepo.

### **9.1 Frontend Technology Stack**

* **Framework:** React 18  
* **Bundler:** Vite  
* **Language:** TypeScript  
* **Styling:** Tailwind CSS  
* **UI Components:** shadcn/ui (including lucide-react icons)  
* **State Management:** React Hooks (useState, useEffect, useMemo, useRef)  
* **Charting:** recharts  
* **Notifications:** sonner  
* **File Export:** xlsx  
* **Date Management:** date-fns and date-fns-tz

### **9.2 Core Frontend Architecture**

The frontend is a single-page application (SPA) managed entirely by the web/src/App.tsx component.

* **Centralized State:** App.tsx serves as the "God component". It holds the state for nearly all application features, including session, navigation, global data (property, currency), and page-specific data (Dashboard, Reports, Admin).  
* **View Routing:** A custom state-based router (activeView) is used. App.tsx conditionally renders the correct page component (e.g., Budgeting, SettingsPage, LandingPage) based on this state.  
* **Data Flow:** App.tsx performs all primary API calls inside useEffect hooks. The resulting data is passed down as props to child components (e.g., kpiData is passed to KPICard).  
* **Event Handling:** Child components (like ReportControls) receive handler functions (like onRunReport) as props, which call back up to App.tsx to execute API calls or update state.

### **9.3 Frontend File Structure (/web)**

web/  
├── build/                 \# (Generated by 'yarn build', served by server.js)  
├── node\_modules/  
├── public/  
└── src/  
    ├── components/  
    │   ├── ui/            \# shadcn/ui components (button, input, etc.)  
    │   ├── Budgeting.tsx  
    │   ├── CloudbedsAPIExplorer.tsx  
    │   ├── CreateBudgetModal.tsx  
    │   ├── CreateScheduleModal.tsx  
    │   ├── DashboardControls.tsx  
    │   ├── DataTable.tsx  
    │.  ├── DemandPace.tsx
    │   ├── HotelManagementTable.tsx  
    │   ├── InitialSyncScreen.tsx  
    │   ├── InsightsCard.tsx  
    │   ├── KPICard.tsx  
    │   ├── LandingPage.tsx  
    │   ├── ManageCompSetModal.tsx  
    │   ├── MarketDemandPatterns.tsx
    │   ├── ManageSchedulesModal.tsx  
    │   ├── MarketCompositionCardAlt.tsx  
    │   ├── MarketRankingCard.tsx 
    │   ├── MarketOutlookBanner.tsx  
    │   ├── MewsOnboarding.tsx  
    │   ├── MiniMetricCard.tsx  
    │   ├── MyProfile.tsx  
    │   ├── PerformanceChart.tsx  
    │   ├── PortfolioOverview.tsx
    │   ├── PortfolioRiskOverview.tsx  
    │   ├── PrivacyPolicy.tsx  
    │   ├── ReportActions.tsx  
    │   ├── ReportControls.tsx  
    │   ├── ReportSelector.tsx  
    │   ├── ReportTable.tsx  
    │   ├── SettingsPage.tsx  
    │   ├── ShreejiReport.tsx  
    │   ├── SupportPage.tsx  
    │   ├── SystemHealth.tsx  
    │   ├── TermsOfService.tsx  
    │   ├── TopNav.tsx  
    │   ├── UserManagement.tsx  
    │   └── YearOnYearReport.tsx  
    ├── App.tsx                \# (Main entry point, state, and router)  
    ├── index.css              \# (Global styles & Tailwind base)  
    └── main.tsx               \# (React DOM renderer)  
├── package.json  
├── vite.config.ts           \# (Vite config with proxy to backend)  
└── yarn.lock

### **9.4 Key Component Analysis**

| Component | Purpose & Key Props |
| :---- | :---- |
| **App.tsx** | **Main application container.** Holds all shared state and view-routing logic. |
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
| **PortfolioRiskOverview.tsx** | **Private super_admin diagnostic page. Combines volume and pacing risk into a portfolio-wide view. (Managed internally).** | **DemandPace.tsx**  | New 'Demand & Pace' feature page. Displays 90-day grid, charts, and market highlights. | propertyId, currencyCode, city |
