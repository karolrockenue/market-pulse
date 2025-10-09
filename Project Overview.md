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
│ ├── ota-crawler.js
│ ├── send-scheduled-reports.js
│ └── index.js
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

Architectural Refactor: The project was converted to a fully serverless pattern by moving the main server.js entry point to api/index.js, eliminating ambiguity for Vercel's build system.

Outcome: The refactor was a success, resolving all deployment and runtime errors. This enabled the successful deployment of the automated OTA crawler and established a stable, modern architectural pattern for the entire application on Vercel.
