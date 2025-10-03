Project "Market Pulse" - Technical Handbook
Last Updated: October 3, 2025

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
Modular Express Routers: The backend is not a monolith. All API endpoints must be placed in a feature-based router file within the /api/routes/ directory (e.g., dashboard.router.js). The main server.js file is only for initialization and mounting routers.

Shared Utilities: Reusable logic, such as database connections (db.js) and authentication middleware (middleware.js), is centralized in the /api/utils/ directory.

PMS-Agnostic Adapter Pattern: All communication with external Property Management Systems (PMS) is abstracted into adapters located in /api/adapters/. The core application logic is decoupled from any specific vendor. The cloudbedsAdapter.js and mewsAdapter.js are the single sources of truth for all their respective API interactions.

2.2 Frontend: Declarative UI & Shared Components
Declarative, State-Driven UI: All UI interactivity must be built using self-contained Alpine.js components (x-data). Manual DOM manipulation is forbidden. All logic is encapsulated in external .mjs modules, keeping the HTML as a clean template.

Shared "Headerless" Component Architecture: The application uses a "headerless" design. A single, shared sidebar component (/public/app/\_shared/sidebar.\*) serves as the primary navigation and control center for all authenticated pages. This component is dynamically loaded into each page.

Event-Driven Communication: Components are decoupled and communicate via custom events. For example, the main dashboard listens for a property-changed event from the sidebar to refresh its data.

3.0 Authentication & Authorization
The system uses a unified authentication flow with granular, role-based authorization.

3.1 User Onboarding & Login
The application supports three distinct pathways for user access and property connection:

Magic Link (Existing Users): The primary login method for existing users is a secure, passwordless magic link system. It uses single-use, expiring tokens stored in the magic_login_tokens table and delivered via SendGrid. This method is for authentication only and does not onboard new properties.

Cloudbeds OAuth 2.0 (New Cloudbeds Users): New properties using Cloudbeds are connected exclusively via the standard Cloudbeds OAuth 2.0 flow. This is initiated from the login page. The application handles the token exchange, creates the user and hotel records, and automatically triggers the initial data sync for the new property.

Mews Manual Token (New Mews Users): New properties using Mews connect via a manual token exchange, also initiated from the login page. The user provides their name, email, and a Mews AccessToken. The backend validates the token, handles both single and multi-property portfolio accounts, creates the user and hotel records, securely encrypts the credentials, and triggers the initial sync. This flow does not use OAuth.

3.2 Role-Based Access Control (RBAC)
The system uses a role column in the users table to manage permissions.

super_admin: Internal administrators. Can view all data and access the Admin Panel.

owner: The primary client user for a hotel account. Can manage their team and properties.

user: A standard team member invited by an owner. Has view-only access.

4.0 Database Schema
The following are the key tables in the PostgreSQL database. This reflects the final schema after modifications for the Mews integration.

users

user_id (INTEGER, PK, SERIAL)

cloudbeds_user_id (VARCHAR, NULLABLE)

email (VARCHAR, UNIQUE)

role (VARCHAR)

first_name (TEXT)

last_name (TEXT)

pms_type (VARCHAR)

created_at (TIMESTAMPTZ)

updated_at (TIMESTAMPTZ)

hotels

hotel_id (INTEGER, PK, SERIAL)

pms_property_id (VARCHAR, UNIQUE)

property_name (TEXT)

city (TEXT)

go_live_date (DATE)

category (VARCHAR)

neighborhood (VARCHAR)

currency_code (TEXT)

tax_rate (NUMERIC)

tax_type (VARCHAR)

tax_name (VARCHAR)

pricing_model (VARCHAR)

latitude (NUMERIC)

longitude (NUMERIC)

user_properties

user_id (VARCHAR)

property_id (INTEGER)

pms_credentials (JSONB)

status (VARCHAR)

daily_metrics_snapshots

snapshot_id (INTEGER, PK, SERIAL)

hotel_id (INTEGER)

stay_date (DATE)

rooms_sold (INTEGER)

capacity_count (INTEGER)

net_revenue (NUMERIC)

gross_revenue (NUMERIC)

net_adr (NUMERIC)

gross_adr (NUMERIC)

net_revpar (NUMERIC)

gross_revpar (NUMERIC)

hotel_comp_sets

hotel_id (INTEGER)

competitor_hotel_id (INTEGER)

user_invitations

invitation_id (INTEGER, PK, SERIAL)

inviter_user_id (INTEGER)

invitee_email (VARCHAR)

property_id (INTEGER)

invitation_token (VARCHAR)

role (VARCHAR)

status (VARCHAR)

scheduled_reports

id (INTEGER, PK, SERIAL)

user_id (INTEGER)

property_id (VARCHAR)

report_name (VARCHAR)

frequency (VARCHAR)

metrics_hotel (ARRAY)

metrics_market (ARRAY)

magic_login_tokens

token (TEXT, PK)

user_id (INTEGER)

expires_at (TIMESTAMPTZ)

used_at (TIMESTAMPTZ)

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
│ ├── rockenue/
│ ├── index.html
│ ├── rockenue.mjs
│ ├── shreeji-report.html
│ └── shreeji-report.mjs
│ ├── favicon.png
│ ├── constants.mjs
│ ├── login.html
│ ├── privacy.html
│ ├── support.html
│ └── terms.html
├── .env
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

POST /auth/mews/validate: Validates a new user's details and Mews token, detecting token type.

POST /auth/mews/create: Creates the user/hotel records for a Mews connection and triggers sync.

GET /accept-invitation: Validates an invitation token and creates a new team member.

POST /auth/logout: Destroys the user's session.

GET /auth/session-info: Retrieves details for the currently logged-in user.

dashboard.router.js
GET /my-properties: Fetches the list of properties a user has access to.

GET /kpi-summary: Fetches aggregated KPI data for the dashboard.

GET /competitor-metrics: Fetches competitor set data, including the "Market Composition" breakdown.

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

7.0 Key Features & Functionality
Main Dashboard (/app/index.html): Features a two-column, "headerless" design. It includes interactive KPI summary cards, a unified data table comparing "Your Hotel" vs. "The Market," a "Market Composition" card with visual breakdowns, and a "Market Ranking" component.

Advanced Reporting (/app/reports.html): A powerful tool for creating custom reports. The UI uses interactive "pills" for selecting metrics and formatting options. It supports flexible grouping ("by Metric" or "by Source").

Market Overview (/app/market-overview.html): A dedicated page for city-level analysis. It includes a multi-year historical trends chart, a neighborhood performance heatmap, and KPI cards, all powered by backend queries that enforce strict data completeness rules.

Settings (/app/settings.html): A central hub for account management. Users can edit their profile, and owners can manage their team via a property-aware invitation system. It also allows authorized users to securely disconnect/delete a property.

Admin Panel (/admin/index.html): An internal tool for super_admin users. Key features include a Competitive Set Manager, a powerful, multi-filter API Explorer for debugging, and manual triggers for system jobs.

Rockenue Section (/rockenue/index.html): A secure area for internal company (Rockenue) reports and administrative tools. This section is only accessible to super_admin users and is completely separate from the client-facing parts of the application. It currently includes the "Shreeji Report" for viewing in-house guest balances.
Automated Jobs (Vercel Cron Jobs):

Daily Data Refresh: The /api/daily-refresh.js script runs automatically to pull the latest data for all connected properties.

Scheduled Reports: The /api/send-scheduled-reports.js job checks for due reports, generates a CSV, and emails it to recipients.

8.0 Development Workflow
This project follows a specific AI-assisted development workflow to ensure clarity and reduce risk.

Plan Before Action: The AI must always provide a concise, bullet-point plan before any code is modified.

Clarify Ambiguity: When multiple solutions exist, the AI must present the options and ask clarifying questions to agree on a path forward.

One Step at a Time: Instructions should be provided in small, sequential steps. Only provide one code block modification per step.

Clear Instructions: All code modifications must use a "find this line/block" and "replace with this" format.

Heavy Commenting: All new or changed code must be thoroughly commented to explain its purpose.

Incremental Testing: After each step, the AI will provide a "Test Point" with specific instructions for the user (Karol) to execute to verify the change.

9.0 Architectural Milestone: Revenue Data Model Refactor
In August 2025, the application underwent a critical architectural refactor to enhance revenue data accuracy and performance.

Problem: The original architecture calculated tax-inclusive (gross) revenue "on-the-fly" whenever a report was run. This model had severe flaws: it created incorrect historical reports if a hotel's tax rate changed, caused poor application performance, and was incompatible with newer PMS systems that provide pre-calculated values.

Solution: The data model was redesigned to pre-calculate and store final, immutable net and gross values for all key metrics (revenue, ADR, RevPAR). This logic was moved into the data ingestion layer (cloudbedsAdapter.js, mewsAdapter.js, initial-sync.js, daily-refresh.js). The process involved modifying the database schema, refactoring the entire data pipeline, backfilling all historical data with the new values, and migrating all backend and frontend components to use the new data structure.

Outcome: The refactor was a success. It guarantees historical data integrity, dramatically improved reporting speed, and created a consistent, scalable data model for all current and future PMS integrations.

10.0 Architectural Milestone: Mews PMS Integration
In August 2025, the application was successfully extended to support a second PMS, Mews, marking a significant step towards becoming a true multi-PMS platform.

Problem: The original application architecture and database schema were tightly coupled to the Cloudbeds PMS, particularly its OAuth 2.0 flow and its use of integer-based IDs. Integrating Mews, which uses a non-OAuth, manual token exchange and string-based UUIDs for property IDs, required significant architectural changes.

Solution: A comprehensive, multi-step integration was executed:

Schema Evolution: The database schema was made PMS-agnostic. Key changes included making the users.cloudbeds_user_id column optional, adding a hotels.pms_property_id column to store original string-based IDs, and converting the hotels.hotel_id into a true auto-incrementing SERIAL primary key.

New Onboarding Flow: A complete, user-facing onboarding flow was built on the login page. This includes a multi-step modal, backend validation routes, logic to handle both single and multi-property Mews accounts, and secure, encrypted storage for Mews credentials.

Adapter Implementation: The mewsAdapter.js was fully developed to handle all Mews-specific API logic, including authentication, data transformation, and pagination.

Outcome: The integration was a success. The application now has a robust, scalable, and secure system for onboarding and syncing data from Mews properties. This milestone validates the adapter-based architecture and paves the way for integrating additional PMS vendors in the future.

August 25, 2025 - Feature: Post-Sync Property Categorization

Summary: Implemented a new user-facing modal that prompts hotel owners to classify their property's quality tier (e.g., Economy, Luxury) immediately after the initial data sync is complete. This ensures more accurate market data from the outset.

New API Endpoint: Added a new PATCH /api/my-properties/:propertyId/category endpoint to dashboard.router.js to securely save the user's selection to the database.

Frontend Logic:

Added the category selection modal to public/app/index.html.

Updated public/app/dashboard.mjs to trigger the modal's appearance when the ?newConnection=true parameter is present in the URL and the initial sync finishes.

Enhancement: The /api/hotel-details/:propertyId endpoint in dashboard.router.js was updated to include the category field in its response.
