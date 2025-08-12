Project "Market Pulse" - Technical Handbook
This document provides a complete technical overview of the Market Pulse application. It is the single source of truth for all architectural principles, database schemas, and core functionalities, designed to onboard any developer or AI assistant to the project.

1.0 Project Overview & Technology Stack
Market Pulse is a multi-tenant SaaS application designed to provide hotel operators with competitive market intelligence. Users can compare their property's performance (Occupancy, ADR, RevPAR) against a curated or dynamically generated market competitive set.

Backend: Node.js with Express.js

Frontend: Alpine.js for reactive UI components

Database: PostgreSQL (Neon DB)

Styling: Tailwind CSS

Charting: ECharts and Chart.js

Deployment: Vercel (including Serverless Functions & Cron Jobs)

Email: SendGrid for transactional emails (magic links, reports)

2.0 Core Architectural Principles
All development must adhere to the following principles to ensure consistency and maintainability.

2.1 Backend: Modular Routers & Adapter Pattern
Modular Express Routers: The backend is not a monolith. All API endpoints must be placed in a feature-based router file within the

/api/routes/ directory (e.g., dashboard.router.js). The main

server.js file is only for initialization and mounting routers.

Shared Utilities: Reusable logic, such as database connections (db.js) and authentication middleware (middleware.js), is centralized in the /api/utils/ directory.

PMS-Agnostic Adapter Pattern: All communication with external Property Management Systems (PMS) is abstracted into adapters located in /api/adapters/. The core application logic is decoupled from any specific vendor. The

cloudbedsAdapter.js is the single source of truth for all Cloudbeds API interactions.

2.2 Frontend: Declarative UI & Shared Components

Declarative, State-Driven UI: All UI interactivity must be built using self-contained Alpine.js components (x-data). Manual DOM manipulation is forbidden. All logic is encapsulated in external

.mjs modules, keeping the HTML as a clean template.

Shared "Headerless" Component Architecture: The application uses a "headerless" design. A single, shared sidebar component (

/public/app/\_shared/sidebar.\*) serves as the primary navigation and control center for all authenticated pages. This component is dynamically loaded into each page.

Event-Driven Communication: Components are decoupled and communicate via custom events. For example, the main dashboard listens for a

property-changed event from the sidebar to refresh its data.

3.0 Authentication & Authorization
The system uses a unified authentication flow with granular, role-based authorization.

3.1 User Onboarding & Login

Magic Link: The primary login method for existing users is a secure, passwordless magic link system. It uses single-use, expiring tokens stored in the

magic_login_tokens table and delivered via SendGrid.

Cloudbeds OAuth 2.0: New properties are connected exclusively via the standard Cloudbeds OAuth 2.0 flow. The application handles the token exchange and automatically triggers the initial data sync for the new property. The "Pilot Mode" that used manual credentials has been fully abandoned.

3.2 Role-Based Access Control (RBAC)
The system uses a

role column in the users table to manage permissions, replacing a legacy is_admin boolean.

super_admin: Internal administrators. Can view all data and access the Admin Panel, including the Comp Set Manager and API Explorer.

owner: The primary client user for a hotel account. Can manage their team (invite/remove users) and disconnect properties.

user: A standard team member invited by an owner. Has view-only access to the shared property data.

4.0 Database Schema
The following are the key tables in the PostgreSQL database.

- **users**
  `user_id` (integer, PK), `cloudbeds_user_id` (varchar), `email` (varchar), `role` (varchar), `first_name` (text), `last_name` (text), `pms_type` (varchar), `created_at` (timestamptz), `updated_at` (timestamptz)

- **hotels**
  `hotel_id` (integer, PK), `property_name` (text), `city` (text), `go_live_date` (date), `category` (varchar), `neighborhood` (varchar), `currency_code` (text), `tax_rate` (numeric), `tax_type` (varchar), `tax_name` (varchar), **`pricing_model` (varchar)**, `latitude` (numeric), `longitude` (numeric)

- **user_properties**
  `user_id` (varchar), `property_id` (integer), `pms_credentials` (jsonb), `status` (varchar)

- **daily_metrics_snapshots**
  `snapshot_id` (integer, PK), `hotel_id` (integer), `stay_date` (date), `rooms_sold` (integer), `capacity_count` (integer), **`net_revenue` (numeric)**, **`gross_revenue` (numeric)**, **`net_adr` (numeric)**, **`gross_adr` (numeric)**, **`net_revpar` (numeric)**, **`gross_revpar` (numeric)**

- **hotel_comp_sets**
  `hotel_id` (integer), `competitor_hotel_id` (integer)

- **user_invitations**
  `invitation_id` (integer, PK), `inviter_user_id` (integer), `invitee_email` (varchar), `property_id` (integer), `invitation_token` (varchar), `role` (varchar), `status` (varchar)

- **scheduled_reports**
  `id` (integer, PK), `user_id` (integer), `property_id` (varchar), `report_name` (varchar), `frequency` (varchar), `metrics_hotel` (ARRAY), `metrics_market` (ARRAY)

- **magic_login_tokens**
  `token` (text, PK), `user_id` (integer), `expires_at` (timestamptz), `used_at` (timestamptz)

  5.0 Project File Structure
  market-pulse/
  ├── api/
  │ ├── adapters/
  │ │ └── cloudbedsAdapter.js
  │ ├── routes/
  │ │ ├── admin.router.js
  │ │ ├── auth.router.js
  │ │ ├── dashboard.router.js
  │ │ ├── reports.router.js
  │ │ └── users.router.js
  │ ├── utils/
  │ │ ├── cloudbeds.js
  │ │ ├── db.js
  │ │ └── middleware.js
  │ ├── daily-refresh.js
  │ ├── initial-sync.js
  │ └── send-scheduled-reports.js
  ├── node_modules/
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
  │ ├── favicon.png
  │ ├── constants.mjs
  │ ├── login.html
  │ ├── privacy.html
  │ ├── support.html
  │ └── terms.html
  ├── changelog.txt
  ├── package-lock.json
  ├── package.json
  ├── server.js
  └── vercel.json
  6.0 API Endpoints
  The API is organized into feature-based routers. All are mounted under /api.

auth.router.js

POST /auth/login: Initiates the magic link login flow.

GET /auth/magic-link-callback: Validates the token from the magic link and creates a user session.

GET /auth/cloudbeds: Initiates the Cloudbeds OAuth 2.0 flow.

GET /auth/cloudbeds/callback: Handles the OAuth callback, creates the user/hotel, and triggers the initial sync.

GET /accept-invitation: Validates an invitation token and creates a new team member.

dashboard.router.js

GET /my-properties: Fetches the list of properties a user has access to.

GET /kpi-summary: Fetches aggregated KPI data for the dashboard.

GET /competitor-metrics: Fetches competitor set data, including the "Market Composition" breakdown.

GET /sync-status/:propertyId: Checks if the initial data sync for a property has completed.

GET /market-ranking: Calculates and returns the hotel's rank for key metrics against its comp set.

market.router.js

GET /market/trends: Provides aggregated historical data for the Market Overview chart, with data completeness validation.

GET /market/kpis: Provides the two-year lookback KPI data.

GET /market/neighborhoods: Provides the data for the neighborhood performance table.

GET /market/seasonality: Provides the data for the seasonality heatmap.

GET /market/available-seasonality-years: Returns the years for which valid seasonality data exists.

reports.router.js

(Contains endpoints for fetching data for the Advanced Reporting page).

users.router.js

POST /users/invite: Sends an invitation to a new user for a specific property.

DELETE /users/remove: Removes a user from a team.

POST /users/disconnect-property: Performs a full transactional deletion of a property and all its associated data.

GET /users/team: Fetches the list of all users on a team.

GET /user/profile, PUT /user/profile: Manages user profile data.

admin.router.js

(Contains various endpoints for the Admin Panel, including fetching all hotels, managing comp sets, triggering syncs/reports, and powering the API Explorer).

7.0 Key Features & Functionality
Main Dashboard (/app/index.html): Features a two-column, "headerless" design. It includes interactive KPI summary cards, a unified data table comparing "Your Hotel" vs. "The Market," a "Market Composition" card with visual breakdowns, and a "Market Ranking" component. The layout is responsive and allows for full-page scrolling.

Advanced Reporting (/app/reports.html): A powerful tool for creating custom reports. The UI was completely redesigned to be more intuitive, using interactive "pills" for selecting metrics and formatting options. It supports flexible grouping ("by Metric" or "by Source") and highlights market data for clarity.

Market Overview (/app/market-overview.html): A dedicated page for city-level analysis. It includes a multi-year historical trends chart with an interactive legend, a neighborhood performance heatmap, and KPI cards. All analytics are powered by robust backend queries that enforce strict data completeness rules based on a hotel's

go_live_date to ensure statistical accuracy.

Settings (/app/settings.html): A central hub for account management. Users can edit their profile, and owners can manage their team via a property-aware invitation system. It also allows authorized users to securely disconnect/delete a property.

Admin Panel (/admin/index.html): An internal tool for super_admin users. Key features include a

Competitive Set Manager for manually curating comp sets , a powerful, multi-filter

API Explorer for debugging , and manual triggers for system jobs like data syncs and scheduled reports.

Automated Jobs (Vercel Cron Jobs):

Daily Data Refresh: The /api/daily-refresh.js script runs automatically to pull the latest data for all connected properties.

Scheduled Reports: The /api/send-scheduled-reports.js job checks for due reports, generates a CSV, and emails it to recipients.

8.0 Development Workflow
This project follows a specific AI-assisted development workflow to ensure clarity and reduce risk.

Plan Before Action: The AI must always provide a concise, bullet-point plan before any code is modified.

Clarify Ambiguity: When multiple solutions exist, the AI must present the options and ask clarifying questions to agree on a path forward.

One Step at a Time: Instructions should be provided in small, sequential steps. Only provide one code block modification per step.

Clear Instructions: All code modifications must use a "find this line/block" and "replace with this" format. When putting a 'find this block' instruciton, don't list the entire block just the 'find the block that starts with ...'.

Heavy Commenting: All new or changed code must be thoroughly commented to explain its purpose.

Incremental Testing: After each step, the AI will provide a "Test Point" with specific instructions for the user (Karol) to execute to verify the change.

Instructions for AI: at the start of each session, you will get this file. Acknowledge by saying 'Done'. No need to elaborate. Always as questions to see files / screenshots / any data you need if unsure of the best course of action

9.0 Architectural Milestone: Revenue Data Model Refactor
In August 2025, the application underwent a critical architectural refactor to enhance revenue data accuracy and performance.

Problem: The original architecture calculated tax-inclusive (gross) revenue "on-the-fly" whenever a report was run. This model had severe flaws: it created incorrect historical reports if a hotel's tax rate changed, caused poor application performance, and was incompatible with newer PMS systems that provide pre-calculated values.

Solution: The data model was redesigned to pre-calculate and store final, immutable net and gross values for all key metrics (revenue, ADR, RevPAR). This logic was moved into the data ingestion layer (cloudbedsAdapter.js, initial-sync.js, daily-refresh.js). The process involved modifying the database schema, refactoring the entire data pipeline, backfilling all historical data with the new values, and migrating all backend and frontend components to use the new data structure.

Outcome: The refactor was a success. It guarantees historical data integrity, dramatically improved reporting speed, and created a consistent, scalable data model for all current and future PMS integrations.
