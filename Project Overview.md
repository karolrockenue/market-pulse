Project "Market Pulse" - Technical Handbook
Last Updated: October 9, 2025

This document provides a complete technical overview of the Market Pulse application. It is the single source of truth for all architectural principles, database schemas, and core functionalities, designed to onboard any developer or AI assistant to the project.

1.0 Project Overview & Technology Stack
Market Pulse is a multi-tenant SaaS application designed to provide hotel operators with competitive market intelligence. Users can compare their property's performance (Occupancy, ADR, RevPAR) against a curated or dynamically generated market competitive set.

Backend: Node.js with Express.js

Frontend: Alpine.js for reactive UI components

Database: PostgreSQL (Neon DB)

Styling: Tailwind CSS

Charting: ECharts and Chart.js

Headless Browser (Scraper): Playwright-Core with @sparticuz/chromium for serverless environments

Deployment: Vercel (including Serverless Functions & Cron Jobs)

Email: SendGrid for transactional emails (magic links, reports)

2.0 Core Architectural Principles
All development must adhere to the following principles to ensure consistency and maintainability.

2.1 Backend: Fully Serverless & Adapter Pattern
Fully Serverless Architecture: The backend is structured as a collection of Vercel Serverless Functions. All API endpoints are placed in feature-based router files within the /api/routes/ directory. The main server entry point, api/index.js, is only for initialization and mounting these routers.

Shared Utilities: Reusable logic, such as database connections (db.js) and authentication middleware (middleware.js), is centralized in the /api/utils/ directory.

PMS-Agnostic Adapter Pattern: All communication with external Property Management Systems (PMS) is abstracted into adapters located in /api/adapters/. The core application logic is decoupled from any specific vendor.

2.2 Frontend: Declarative UI & Shared Components
Declarative, State-Driven UI: All UI interactivity must be built using self-contained Alpine.js components (x-data). Manual DOM manipulation is forbidden. All logic is encapsulated in external .mjs modules.

Shared "Headerless" Component Architecture: The application uses a "headerless" design. A single, shared sidebar component (/public/app/\_shared/sidebar.\*) serves as the primary navigation and control center.

Event-Driven Communication: Components are decoupled and communicate via custom events.

3.0 Authentication & Authorization
The system uses a unified authentication flow with granular, role-based authorization.

3.1 User Onboarding & Login
Magic Link (Existing Users): Primary login method for existing users via expiring tokens.

Cloudbeds OAuth 2.0 (New Cloudbeds Users): New properties using Cloudbeds are connected exclusively via the standard Cloudbeds OAuth 2.0 flow.

Mews Manual Token (New Mews Users): New properties using Mews connect via a manual token exchange.

3.2 Role-Based Access Control (RBAC)
The system uses a role column in the users table to manage permissions (super_admin, owner, user).

4.0 Database Schema
The following are the key tables in the PostgreSQL database.

users: Stores user account information, including role and pms_type.

hotels: Stores property details like pms_property_id and property_name.

user_properties: Links users to hotels and stores encrypted PMS credentials.

daily_metrics_snapshots: Stores daily performance data for each hotel (rooms_sold, revenue, etc.).

hotel_comp_sets: Defines the competitive set for each hotel.

user_invitations: Manages invitations for new team members.

scheduled_reports: Stores configuration for automated email reports.

magic_login_tokens: Stores single-use tokens for passwordless login.

market_availability_snapshots: Stores daily aggregate data from the OTA Crawler.

id (UUID, PK)

provider (TEXT)

city_slug (TEXT)

checkin_date (DATE)

total_results (INTEGER)

facet_property_type (JSONB)

facet_neighbourhood (JSONB)

facet_star_rating (JSONB)

facet_price_histogram (JSONB)

scraped_at (TIMESTAMPTZ)

5.0 Project File Structure
market-pulse/
├── api/
│ ├── adapters/
│ │ ├── cloudbedsAdapter.js
│ │ └── mewsAdapter.js
│ ├── routes/
│ │ ├── admin.router.js
│ │ ├── auth.router.js
│ │ ├── dashboard.router.js
│ │ ├── market.router.js
│ │ ├── reports.router.js
│ │ ├── rockenue.router.js
│ │ └── users.router.js
│ ├── utils/
│ │ ├── db.js
│ │ └── middleware.js
│ ├── daily-refresh.js
│ ├── initial-sync.js
│ ├── send-scheduled-reports.js
├── public/
│ ├── admin/
│ │ ├── admin.mjs
│ │ └── index.html
│ ├── app/
│ │ ├── \_shared/
│ │ │ ├── sidebar.html
│ │ │ └── sidebar.mjs
│ │ ├── dashboard.mjs
│ │ ├── index.html
│ │ ├── market-overview.html
│ │ ├── market-overview.mjs
│ │ ├── reports.html
│ │ ├── reports.js
│ │ ├── settings.html
│ │ ├── settings.mjs
│ │ └── utils.mjs
│ ├── rockenue/
│ │ ├── index.html
│ │ ├── rockenue.mjs
│ │ ├── shreeji-report.html
│ │ └── shreeji-report.mjs
│ ├── favicon.png
│ ├── constants.mjs
│ ├── login.html
│ ├── privacy.html
│ ├── support.html
│ └── terms.html
├── .env
├── package.json
└── server.js
└── vercel.json
6.0 API Endpoints
The API is organized into feature-based routers. All are mounted under /api.

auth.router.js

POST /auth/login: Initiates the magic link login flow.

GET /auth/magic-link-callback: Validates the token from the magic link and creates a user session.

GET /auth/cloudbeds: Initiates the Cloudbeds OAuth 2.0 flow.

GET /auth/cloudbeds/callback: Handles the OAuth callback, creates the user/hotel, and triggers the initial sync.

POST /auth/mews/validate: Validates a new user's details and Mews token, detecting token type.

POST /auth/mews/create: Creates the user/hotel records for a Mews connection and triggers sync.

GET /accept-invitation: Validates an invitation token and creates a new team member.

POST /auth/logout: Destroys the user's session.

GET /auth/session-info: Retrieves details for the currently logged-in user.

dashboard.router.js

GET /my-properties: Fetches the list of properties a user has access to.

GET /kpi-summary: Fetches aggregated KPI data for the dashboard.

GET /competitor-metrics: Fetches competitor set data.

GET /sync-status/:propertyId: Checks if the initial data sync for a property has completed.

GET /market-ranking: Calculates and returns the hotel's rank for key metrics against its comp set.

market.router.js

GET /market/trends: Provides aggregated historical data for the Market Overview chart.

GET /market/kpis: Provides the two-year lookback KPI data.

GET /market/neighborhoods: Provides the data for the neighborhood performance table.

GET /market/seasonality: Provides the data for the seasonality heatmap.

GET /market/available-seasonality-years: Returns the years for which valid seasonality data exists.

reports.router.js

(Contains various endpoints for fetching and generating data for the Advanced Reporting page).

users.router.js

POST /users/invite: Sends an invitation to a new user for a specific property.

DELETE /users/remove: Removes a user from a team.

POST /users/disconnect-property: Performs a full transactional deletion of a property and all its associated data.

GET /users/team: Fetches the list of all users on a team.

GET /user/profile, PUT /user/profile: Manages user profile data.

admin.router.js

(Contains various endpoints for the Admin Panel, including fetching all hotels, managing comp sets, triggering syncs/reports, and powering the API Explorer for both Cloudbeds and Mews).

rockenue.router.js

GET /rockenue/status: A protected endpoint to verify super_admin access.

GET /rockenue/hotels: Fetches a list of all hotel properties for use in report dropdowns.

GET /rockenue/shreeji-report: Generates the data for the in-house guest balance report.

api/ota-crawler.js

GET /api/ota-crawler: A standalone serverless function that runs the OTA scraper. It is triggered automatically by a cron job but can also be invoked manually for testing.

7.0 Key Features & Functionality
Main Dashboard: Interactive KPI summaries and data tables.

Advanced Reporting: Custom report builder with flexible metrics.

Market Overview: City-level analysis with historical trends.

Settings: User profile and team management.

Admin Panel: Internal tools for super_admin users.

Rockenue Section: Secure area for internal company reports.

OTA Market Availability Crawler: A new automated service that scrapes aggregate hotel availability data from Booking.com to provide forward-looking market intelligence.

Automated Jobs (Vercel Cron Jobs):
Daily Data Refresh: The /api/daily-refresh.js script pulls the latest data for all connected properties.

Scheduled Reports: The /api/send-scheduled-reports.js job generates and emails reports.

OTA Crawler: The /api/ota-crawler.js script runs daily to collect market availability data.

8.0 Development Workflow
This project follows a specific AI-assisted development workflow.

Plan Before Action: The AI must always provide a concise, bullet-point plan before any code is modified.

Clarify Ambiguity: When multiple solutions exist, the AI must present the options to agree on a path.

One Step at a Time: Instructions should be provided in small, sequential steps.

Clear Instructions: All code modifications must use a "find this line/block" and "replace with this" format.

Heavy Commenting: All new or changed code must be thoroughly commented.

Incremental Testing: After each step, the AI will provide a "Test Point" with specific instructions.

Validate Local Environment First: Before committing changes, especially those affecting dependencies, always run npm install locally to ensure the project installs without errors. A broken local installation will always lead to a broken deployment.

9.0 Architectural Milestone: Revenue Data Model Refactor
(August 2025) The application's data model was refactored to pre-calculate and store immutable net and gross revenue metrics, ensuring historical data integrity and improving performance.

10.0 Architectural Milestone: Mews PMS Integration
(August 2025) The application was extended to support the Mews PMS, validating the adapter-based architecture and making the database schema PMS-agnostic.

11.0 Architectural Milestone: OTA Crawler & Vercel Deployment Refactor
(October 2025) A new OTA web scraping feature was developed and deployed, requiring a significant architectural refactor to ensure compatibility with Vercel's serverless environment.

Problem: Deploying a Playwright-based scraper to Vercel proved challenging, resulting in persistent and misleading build errors (Function Runtimes must have a valid version) and subsequent runtime errors from missing system libraries (libnss3.so).

Solution: A multi-step solution was implemented to create a robust and compatible architecture.

Dependency Upgrade: The standard playwright package was replaced with the serverless-optimized playwright-core and @sparticuz/chromium to ensure all necessary browser components were correctly bundled.

Configuration Simplification: A "UI-first" configuration model was adopted. All file-based overrides for the Node.js version (engines in package.json) were removed, making the Vercel Dashboard setting the single source of truth.



Outcome: The refactor was a success, resolving all deployment and runtime errors. This enabled the successful deployment of the automated OTA crawler and established a stable, modern architectural pattern for the entire application on Vercel.


October 22, 2025
Task: Implement Data Override & Lock for Jubilee Hotel (ID 230719).

Progress:

Problem: The 2024 data for the Jubilee Hotel (ID 230719) was found to be corrupt in the database, with inaccurate monthly totals for revenue and occupancy. We were provided with a definitive list of correct monthly gross revenue and occupancy totals for 2024.

Objective: To permanently correct the 2024 data in the database and protect it from being overwritten by future initial-sync or daily-refresh jobs.

Action 1: Modify Sync Logic:

We modified api/initial-sync.js to make the sync process "aware" of a new data lock feature.

The script now fetches a new locked_years (JSONB) column from the hotels table.

The DELETE query was replaced with a dynamic query that respects this lock, skipping the deletion of any data from a year present in the locked_years array.

We added filter logic to both the Cloudbeds and Mews data insertion paths to prevent initial-sync from writing new (corrupt) data into a locked year.

We intentionally skipped modifying api/daily-refresh.js, as its logic only fetches future-looking data and was not a threat to the historical 2024 data.

Action 2: One-Time Data Correction (SQL):

We executed a one-time "pro-rata spread" SQL script (v5) to fix the 2024 data.

Debugged DB Trigger: The script's UPDATE command initially failed due to a faulty, user-defined database trigger. We successfully bypassed this by wrapping the update logic in ALTER TABLE daily_metrics_snapshots DISABLE TRIGGER USER; and ... ENABLE TRIGGER USER;.

Pro-Rata Logic: For each month of 2024, the script:

Calculated the "Corrupt" gross_revenue and rooms_sold totals from the database.

Calculated the "Correct" totals using the gross revenue and occupancy percentages provided by the user.

Calculated correction factors (e.g., Correct_Total / Corrupt_Total) for both metrics.

Applied these factors proportionally to gross_revenue, net_revenue, and rooms_sold for every single day of that month.

Recalculated all derived metrics (adr, revpar, occupancy) for all corrected rows to ensure full data consistency.

Result: This script successfully updated the total 2024 gross revenue for hotel 230719 to the correct £1,306,291.

Action 3: Final Activation:

We ran the final SQL command to officially "flip the switch" and activate the lock:

UPDATE hotels SET locked_years = '["2024"]' WHERE hotel_id = '230719';.

The 2024 data for this hotel is now considered correct, stable, and permanently protected from automated overwrites.

12.0 Architectural Milestone: Reliable Room Count Implementation

(October 22, 2025)

Problem

The GET /api/competitor-metrics endpoint, used by the Dashboard's "Comp Set Breakdown" card, was initially calculating hotel room counts by querying the daily_metrics_snapshots table for the most recent capacity_count. This approach proved unreliable due to:

Corrupt Data: Future-dated or incorrect capacity_count values existed in the snapshots table, leading to wildly inaccurate room counts (e.g., displaying "7 rooms" for a 30-room hotel).

Semantic Error: The capacity_count metric actually represents available rooms for a given day, not the total physical room count of the property.

Solution

A multi-step solution was implemented to establish a permanent and reliable "source of truth" for total room counts:

Database Schema Change:

Where: hotels table.

How: An INTEGER column named total_rooms was added using ALTER TABLE hotels ADD COLUMN total_rooms INTEGER;. This column is designed to store the definitive physical room count for each property.

Admin Backfill Endpoint:

Where: api/routes/admin.router.js.

Endpoint Added: GET /api/admin/backfill-room-counts.

How: This new, admin-protected endpoint was created. When triggered, it:

Fetches all hotels from the hotels table.

For each hotel, retrieves the necessary PMS credentials (using new helper functions getCredentialsForHotel and getRoomTypesFromPMS added within admin.router.js).

Calls the relevant PMS API (Cloudbeds getRoomTypes or Mews roomTypes/getAll) to get the list of room types.

Sums the roomTypeUnits (Cloudbeds) or RoomTypeUnits (Mews) from the API response to calculate the true total room count.

Updates the hotels.total_rooms column in the database with this correct value.

Purpose: This endpoint provides a mechanism to populate and refresh the total_rooms data directly from the PMS source of truth.

Dashboard API Update:

Where: api/routes/dashboard.router.js.

How: The competitorDetailsQuery within the GET /api/competitor-metrics endpoint was completely rewritten. Instead of querying daily_metrics_snapshots, it now performs a simple SELECT h.total_rooms FROM hotels h WHERE h.hotel_id = ANY(...).

Outcome

The Dashboard's "Comp Set Breakdown" card now displays accurate and stable room counts, directly read from the hotels.total_rooms column.

The system is no longer reliant on the volatile or potentially corrupt capacity_count from the daily snapshots for determining the total physical room inventory.

The new backfill endpoint ensures data integrity can be maintained by refreshing room counts from the PMS source of truth when needed.


13.0 Architectural Milestone: Occupancy Data Refactor

(October 25, 2025)

Problem
A critical data integrity bug was identified where Occupancy figures across the application were displaying incorrect values (e.g., 6.3% instead of 84.4%).

Root Cause
The root cause was traced to the occupancy_direct column in the daily_metrics_snapshots table. This column was found to contain unreliable, incorrect decimal values. Several key API endpoints were reading this incorrect column directly instead of calculating occupancy from the source of truth (rooms_sold and capacity_count).

Solution
A system-wide refactor of the backend API was performed to eradicate all use of the occupancy_direct column for calculations. All affected SQL queries were modified to use the correct on-the-fly calculation: (SUM(rooms_sold)::numeric / NULLIF(SUM(capacity_count), 0)).

The following API endpoints were corrected:

api/routes/dashboard.router.js

GET /api/market-ranking: The HotelPerformance CTE was updated to calculate occupancy correctly before ranking.

api/routes/reports.router.js

POST /api/reports/year-on-year: The conditional aggregation logic for y1_occupancy and y2_occupancy was replaced with the correct calculation.

api/routes/market.router.js

GET /market/trends: The query was updated to use the correct calculation.

GET /market/kpis: The HotelYoY CTE was updated to calculate current_occupancy and prior_occupancy correctly.

GET /market/neighborhoods: The NeighborhoodMetricsCurrent CTE was updated to use the correct calculation.

Outcome
All API endpoints in the application now provide correct, reliable occupancy figures. The occupancy_direct column is considered deprecated and must not be used for any future development. All occupancy calculations must be derived from rooms_sold and capacity_count.