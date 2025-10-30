# **Market Pulse: React Migration Changelog**

This document tracks the incremental migration of the Market Pulse frontend from the original Alpine.js implementation to the new React prototype (made by Figma AI). All development is taking place on the `feature/react-migration` Git branch to ensure the `main` branch remains stable.

## **Local Development Setup**

To work on this migration, a specific dual-server local environment is required. This setup allows the new React frontend to communicate with the existing, live backend API.

### **1\. Backend Server (`market-pulse` project)**

* **Purpose**: Runs the existing Node.js/Express backend API.  
* **Directory**: `/market-pulse`  
* **URL**: `http://localhost:3001`  
* **Start Command**: In the project root, run `PORT=3001 npm start`.  
* **Configuration**: Requires a local `.env` file containing all necessary secrets (database connection string, API keys, session secret).

### **2\. Frontend Server (`Market Pulse Dashboard Redesign` project)**

* **Purpose**: Runs the new React frontend application using Vite.  
* **Directory**: `/react pulse` (or the prototype folder name)  
* **URL**: `http://localhost:3000`  
* **Start Command**: In the project root, run `npm run dev`.  
* **Configuration**: The `vite.config.ts` file is configured with a proxy. All requests from the frontend to `/api` are automatically forwarded to the local backend server at `http://localhost:3001`. This prevents CORS errors.  
* **Authentication**: Local development authentication is handled by making a `POST` request to the `/api/dev-login` endpoint from the browser's console to create a session cookie.

## **Migration Log**

### **October 17, 2025**

**Task:** Begin the incremental migration of the main **Dashboard** view from mock data to live backend data.

**Progress:**

* **Local Environment Established**: Successfully configured the dual-server setup for local development.  
* **Property Selector (Live)**: The property dropdown in the top navigation is now populated by the `GET /api/my-properties` endpoint. The selected property is persisted in the URL (`?propertyId=...`) to maintain state across page refreshes.  
* **KPI Cards (Live)**: The main KPI cards (Occupancy, ADR, RevPAR) are connected to the `GET /api/kpi-summary` endpoint and update when the property or date range changes.  
* **Performance Chart & Data Table (Live)**:  
  * A new backend endpoint, `GET /api/dashboard-chart`, was created to serve data specifically for the dashboard's needs.  
  * Both the main "Performance Comparison" chart and the data table below it are fully connected to this new endpoint, replacing all mock data.  
* **Market Ranking Card (Live)**: Connected to the `GET /api/market-ranking` endpoint. The color-coding logic was refactored to be percentile-based, making it more robust and scalable for competitive sets of any size.  
* **Market Composition Card (Live)**: Connected to the `GET /api/competitor-metrics` endpoint. The component was refactored to dynamically generate colors for neighborhoods, ensuring it can handle any location data from the database.  
* **Dashboard Controls (Live)**: The date preset dropdown is now functional and updates the dashboard's date range, triggering a refresh of all connected components.

**Known Issues:**

* **Data Table Scrolling Bug**: The main data table component does not adhere to its `max-height` style. When a long date range is selected, the table expands vertically instead of becoming scrollable, which breaks the dashboard layout. This is a persistent styling issue that requires further debugging. RESOLVED

Heres' list of the filenames in that component folder in react prototype 



AreaPerformanceTable.tsx

CloudbedsAPIExplorer.tsx

CompetitorCard.tsx

ConnectedProperties.tsx

ConnectMewsModal.tsx

CreateScheduleModal.tsx

DashboardControls.tsx

DataTable.tsx

DemandForecast.tsx

FormattingOptions.tsx

GrantAccessModal.tsx

HistoricalTrendsChart.tsx

HotelManagementTable.tsx

InitialSyncScreen.tsx

InsightsCard.tsx

InviteUserModal.tsx

KPICard.tsx

LandingPage.tsx

ManageCompSetModal.tsx

ManageSchedulesModal.tsx

ManualReportTrigger.tsx

MarketCompositionCard.tsx

MarketHealthKPI.tsx

MarketKPIGrid.tsx

MarketRankingCard.tsx

MarketSeasonality.tsx

MarketShareDonut.tsx

MetricSelector.tsx

MewsOnboarding.tsx

MiniMetricCard.tsx

MyProfile.tsx

PerformanceChart.tsx

PricingDistribution.tsx

PropertySetupModal.tsx

QualityTierPerformance.tsx

ReportActions.tsx

ReportControls.tsx

ReportTable.tsx

RockenueHub.tsx

ShreejiReport.tsx

Sidebar.tsx

SupplyDemandChart.tsx

SystemHealth.tsx

TopNav.tsx

TopPerformers.tsx

UserManagement.tsx

**Next Steps:**

* Address the outstanding data table scrolling bug.  DONE
* Connect the remaining dashboard components (e.g., "Insights" card).  
* Begin migration of the next major application view, likely the "Reports" page.

October 17, 2025 (Afternoon Session)
Task: Resolve outstanding UI bugs and connect dashboard controls.

Progress:

Data Table Scrolling Bug (Fixed): The layout issue was resolved. The root cause was identified as the project using a static, pre-compiled CSS file that did not include the arbitrary max-height value. The fix was implemented by applying a direct inline style to the DataTable.tsx component, ensuring it becomes scrollable without altering the project's build configuration.

Market Composition Card (Redesigned & Live): The original card was successfully replaced with a new, more detailed component from the Figma prototype.

Backend Upgraded: The GET /api/competitor-metrics endpoint was significantly enhanced. It now calculates and returns a richer, nested data structure that includes total room counts per category and a sub-breakdown of neighborhoods within each tier.

Frontend Integrated: The new MarketCompositionCardAlt.tsx component was fully integrated with the upgraded backend endpoint, replacing all mock data. It now dynamically displays property counts, room counts, progress bars, and nested area distributions.

Robustness Improved: The component was refactored to be more resilient to asynchronous data loading, preventing crashes that were occurring during the initial render cycle.

Dashboard Granularity Controls (Live): The "Daily," "Weekly," and "Monthly" view controls are now fully functional.

The GET /api/dashboard-chart endpoint was refactored to accept a granularity parameter, leveraging the existing getPeriod helper function to correctly aggregate data by day, week, or month.

The frontend App.tsx now passes the selected granularity to the backend, causing both the chart and the data table to update in sync.

UI Polish: A minor styling bug was fixed where the "Metric" dropdown was too narrow for its content.

Known Issues:

All previously known issues for the Dashboard view have been resolved.

Next Steps:

Connect the "Insights" card to a relevant backend data source.

Begin migration of the next major application view: the "Reports" page.

October 17, 2025 (Afternoon & Evening Session)
Task: Resolve all outstanding UI bugs on the Dashboard view, connect all remaining controls, and significantly polish the user experience to match the prototype.

Progress:

Dashboard Controls Fully Connected: The "Daily," "Weekly," and "Monthly" granularity controls are now fully functional. The backend was refactored to correctly aggregate chart and table data based on the selected period, and the frontend was updated to trigger this logic seamlessly.

Market Composition Card Redesigned & Integrated: The original card was successfully replaced with a new, more detailed component from the Figma prototype. This required a significant effort:

Backend Upgraded: The GET /api/competitor-metrics endpoint was substantially enhanced to calculate and return a richer, nested data structure that now includes total room counts per category and a sub-breakdown of neighborhoods within each tier.

Frontend Integrated: The new MarketCompositionCardAlt.tsx component was fully connected to this upgraded endpoint, replacing all mock data. It now dynamically displays property counts, room counts, progress bars, and nested area distributions.

KPI Cards Enhanced: The main KPI cards were updated to provide more context:

Dynamic Currency: Cards now display the correct currency symbol (e.g., $, £, €) by fetching the selected hotel's details from the backend.

Market Comparison: The Occupancy, ADR, and RevPAR cards now show a percentage comparison against the competitive set for the selected period (e.g., ↑ 5.2% vs market).

Market Rank Corrected: The "Market Rank" card now specifically displays the hotel's RevPAR rank.

Forecast Card Restored: The "Forecast" card was restored with its yellow highlight styling to match the prototype.

UI Polish and Bug Squashing: A series of targeted fixes were implemented to address visual bugs and improve the user experience:

Data Table Alignment: Fixed a column misalignment bug in the DataTable component by refactoring it from a two-table structure to a modern, single-table implementation with a CSS sticky header, ensuring perfect alignment and a smoother scroll experience.

Chart "Jumpiness" Fixed: Resolved a major UX issue where the Performance Chart would disappear and cause the layout to "jump" when its data was refreshed. The fix involved making the component resilient so that it displays an internal loading placeholder instead of unmounting, providing a stable and smooth update experience.

Styling Bugs Resolved: Fixed multiple styling issues, including the "Metric" dropdown being too narrow, the chart lacking padding, and the chart's metric label being "squished" on refresh.

Preset Dropdown Fixed: Corrected bugs where the preset dropdown was empty on load and was causing the chart to fail when a new preset was selected.

Known Issues:

All previously known issues for the Dashboard view have been resolved. The dashboard is now considered feature-complete and stable.

Next Steps:

Connect the "Insights" card to a relevant backend data source.

Begin migration of the next major application view: the "Reports" page.

Key Learnings from Today's Session
Static CSS Limitations: We confirmed that the project's static CSS build process is a recurring challenge. It does not generate CSS for Tailwind's arbitrary values (e.g., max-h-[500px]) or classes with opacity modifiers (e.g., bg-[#faff6a]/10). Using targeted inline styles is the most effective workaround for these cases without reconfiguring the entire build system.

Component Resilience is Crucial: Asynchronous data loading is a primary source of bugs. We learned that frontend components must be made "defensive" to handle initial empty or incomplete data states. Adding simple fallbacks (e.g., || {} or || 0) and ensuring data is in the correct format (e.g., using parseFloat) prevents crashes and creates a more robust application.

Layout Stability Over Loading States: We discovered that unmounting a large component to show a loading indicator can create a disruptive, "jumpy" user experience. A better pattern is to keep the component's container mounted with a fixed size and render an internal placeholder. This maintains layout stability while still providing loading feedback.

October 18, 2025
Task: Begin connecting components on the Admin page to live backend data.

Progress:

Last Updated Timestamp (Live): Connected the "Last updated" timestamp in TopNav.tsx to the GET /api/last-refresh-time endpoint. Added necessary state and fetching logic to App.tsx.

Hotel Management Table (Live Data):

Connected HotelManagementTable.tsx to the GET /api/admin/get-all-hotels endpoint.

Refactored the table to display live hotel data from the allHotels prop passed down from App.tsx.

Corrected the "Quality Tier" dropdown to use the backend's "Category" values (e.g., "Midscale", "Luxury").

Hotel Management Table (Actions Live):

Connected the "Category" dropdown to the POST /api/admin/update-hotel-category endpoint.

Connected the "Sync Info" button to the POST /api/admin/sync-hotel-info endpoint.

Connected the "Full Sync" button to the POST /api/admin/initial-sync endpoint. Added a confirmation dialog due to the destructive nature of the action.

Added loading states and toast notifications (using sonner) for all actions.

Comp Set Modal (Live Data & Layout):

Connected the ManageCompSetModal.tsx component to fetch the current comp set using GET /api/admin/hotel/:hotelId/compset.

Connected the "Save Changes" button to POST /api/admin/hotel/:hotelId/compset.

Passed the allHotels list from App.tsx to populate the "Available Hotels" section.

Increased the modal width using Tailwind's max-w-4xl class for better visibility.

System Health Component (Live Data):

Added the "API Target Property" dropdown to the Admin view in App.tsx to replicate the original application's functionality.

Refactored SystemHealth.tsx to accept the selected propertyId as a prop.

Connected the "Test Database" button to GET /api/admin/test-database.

Connected the "Test Auth" (Cloudbeds) button to GET /api/admin/test-cloudbeds, using the selected propertyId. Added logic to handle expected failures if a Mews property is selected.

Connected the "Force Refresh" button to GET /api/admin/daily-refresh and ensured it updates the timestamp in TopNav.

UI Polish & Bug Fixes:

Added and configured the <Toaster /> component from sonner in App.tsx to enable toast notifications.

Added custom CSS to index.css to style sonner toasts according to the project's theme. (User requested to pause further CSS changes).

Fixed several syntax errors and ReferenceError issues caused during refactoring.

Known Issues:

None currently identified for the Admin components worked on today.

Next Steps:

Connect the remaining Admin page components:

ManualReportTrigger

MewsOnboarding

CloudbedsAPIExplorer

Address the styling of the sonner toast popups (paused for now).

Continue migration with the "Reports" page. 


October 19, 2025
Task: Continue connecting components on the Admin page, focusing on Mews Onboarding and the Cloudbeds API Explorer.

Progress:

Mews Onboarding Component (Live):

Connected MewsOnboarding.tsx to the backend.

Added missing "First Name" and "Last Name" input fields required by the backend.

Implemented the two-step API call process:

Call POST /api/auth/mews/validate to check the user and token.

If validation is successful for a single property, call POST /api/auth/mews/create to create the user/hotel, link them, trigger sync, and get a redirect URL.

Added logic to handle validation errors (e.g., user exists, invalid token) and portfolio tokens.

Implemented browser redirection on successful connection using window.location.href.

Replaced inline status messages with sonner toast notifications.

Cloudbeds API Explorer (Redesigned & Live):

Replaced the previous CloudbedsAPIExplorer.tsx component with a completely new design provided by the Figma AI prototype.

Integrated the "API Target Property" selection:

Removed the internal property selection state from the component.

Modified the component to accept and display the propertyId passed down from the shared dropdown in App.tsx.

Re-implemented API call logic:

Added the callApiExplorer function to handle fetch calls to the backend wrapper endpoint (GET /api/admin/explore/:endpoint).

Connected all buttons in the "General API" tab and the multi-step form in the "Insights API" tab to use callApiExplorer with the correct endpoint slugs and parameters.

Enabled dynamic field population for the Insights API based on the /dataset-structure response.

Added loading states (button spinners) and toast notifications for all API interactions.

Layout & Bug Fixes:

Fixed the ManageCompSetModal layout issue where columns were stacking instead of appearing side-by-side. Identified that Tailwind CSS wasn't processing the grid-cols-[1fr_100px_1fr] class; resolved by applying the grid-template-columns style directly via an inline style attribute.

Resolved conflicting max-width classes (sm:max-w-lg vs !max-w-[1200px]) on the ManageCompSetModal's <DialogContent> by removing the conflicting classes and applying maxWidth: '1200px' directly via inline style.

Fixed multiple SyntaxError issues in App.tsx and CloudbedsAPIExplorer.tsx caused by duplicate state declarations or misplaced comments.

Known Issues:

None currently identified for the Admin components worked on today.

Next Steps:

The Admin page components (SystemHealth, ManualReportTrigger, HotelManagementTable, MewsOnboarding, CloudbedsAPIExplorer) are now connected.

Begin migration of the next major application view: the Reports page.


October 19, 2025 (Evening Session)
Task: Begin migration of the Reports page to the new React prototype UI and connect it to live data.

Progress:

New UI Integrated:

Replaced the old React report components (MetricSelector, FormattingOptions, ReportActions, ReportControls, ReportTable) with the new versions from the Figma prototype (PROT_*.tsx files).

Implemented the new two-step UI flow: Users first see the ReportSelector component to choose a report type, then navigate to the specific report builder view.

Fixed layout issues in ReportSelector to correctly display category dividers and the 3-column tile grid.

Backend Endpoint Created:

Identified that the existing /api/reports endpoints were only for scheduling, and the old report page used dashboard endpoints.

Created a new, consolidated backend endpoint POST /api/reports/run in api/routes/reports.router.js specifically designed for the React report builder, reusing logic from dashboard.router.js.

Corrected the mounting path for reports.router.js in server.js from /api to /api/reports.

Frontend Connected:

Connected the "Run Report" button in ReportControls.tsx to the new POST /api/reports/run endpoint via the handleRunReport function in App.tsx.

Added loading state (reportIsLoading) to the "Run Report" button.

Connected the MetricSelector and FormattingOptions components to the relevant state variables in App.tsx.

Updated handleRunReport to dynamically build the metricsPayload based on selections in MetricSelector.

Bug Fixes & Polish:

Fixed a TypeError in ReportTable.tsx by adding parseFloat to handle string numbers from the API before calling .toFixed().

Corrected occupancy formatting in ReportTable.tsx to multiply by 100 (e.g., display 60.0% instead of 0.6%).

Fixed currency formatting (RangeError) by passing currency codes (e.g., "GBP") instead of symbols (£) from App.tsx down to ReportTable.tsx and KPICard.tsx, and updating those components to use Intl.NumberFormat correctly.

Implemented robust number formatting in ReportTable.tsx using Intl.NumberFormat to handle currency symbols, thousand separators, and correct decimal places for ADR, RevPAR, and Revenue.

Fixed the empty "Date" column in ReportTable.tsx by rendering the period field from the API response.

Changed the default state for the "Market Comparisons" toggle (showMarketComparisons) to false.

Updated ReportTable.tsx to conditionally render "Delta" columns (header and data) only when showMarketComparisons is true and both the hotel and market versions of a metric are selected.

Fixed the "Totals / Avg" row label and implemented correct calculation logic in ReportTable.tsx, handling averages vs. sums and string number conversion.

Installed the xlsx dependency and connected the "Export CSV/Excel" buttons in ReportActions to use the reportData state and the xlsx library.

Increased the width of the ManageSchedulesModal using inline styles to prevent content overflow.

Resolved multiple syntax errors in various components during refactoring.

Known Issues:

Delta values are not yet calculated or displayed in the "Totals / Avg" row.

Next Steps:

Calculate and display delta values in the totals row.

Connect the "Create Schedule" and "Manage Schedules" modals to the live API endpoints in reports.router.js.

Continue migration with other report types or application sections (e.g., Market Intel).


October 20, 2025
Task: Complete the full migration of the Reports page, resolve all outstanding bugs, and connect the scheduling modals to the live backend API.

Progress:

Report Controls (Fully Live):

The "Granularity" (Daily, Weekly, Monthly) and "Tax-Inclusive" toggles are now fully functional.

The backend endpoint POST /api/reports/run in reports.router.js was refactored to dynamically build its SQL query based on the metrics, granularity, and includeTaxes parameters sent from the React UI.

Report Auto-Updating (Live):

Added useEffect hooks to App.tsx to automatically re-run the report when the taxInclusive toggle or the selectedMetrics list is changed. This removes the need for the user to manually click "Run Report" for every adjustment.

Report Date Presets (Fixed):

Fixed a bug where the Report page date presets were not updating the date fields. Added the missing useEffect hook to App.tsx to watch the reportDatePreset state.

Report Table (Fixed):

Resolved the "Known Issue" from the previous session by refactoring ReportTable.tsx to correctly calculate and display delta values in the "Totals / Avg" row.

Fixed all validateDOMNesting console warnings in ReportTable.tsx by removing whitespace and comments from within the <table> and <tbody> tags.

Scheduling Modals (Fully Live):

UI Updated: Replaced the old CreateScheduleModal.tsx with the new component from the Figma prototype. Fixed its sonner import and applied an inline style to correct the "too narrow" layout bug.

Backend API Updated: Added the DELETE /api/reports/scheduled-reports/:id endpoint to reports.router.js to allow for schedule deletion.

Frontend Connected: Replaced all dummy scheduling data and handler functions in App.tsx with live API calls:

fetchSchedules now runs when the Reports page loads, populating the "Manage Schedules" modal with live data.

handleSaveSchedule now sends a POST request, including the full report configuration (metrics, taxes, layout) and the new schedule settings.

handleDeleteSchedule now sends a DELETE request to the new endpoint.

Scheduling Bug Squashing (Fixed):

Fixed a 500 API error by adding logic to App.tsx to convert day-of-week strings (e.g., "monday") into the integers (e.g., 1) required by the database.

Fixed a crash in ManageSchedulesModal.tsx by adding a check for null recipients.

Resolved a persistent "key prop" warning by identifying a mismatch between the API (id) and the frontend (schedule_id). Standardized all code in reports.router.js, App.tsx, and ManageSchedulesModal.tsx to use id as the correct primary key.




Changelog: October 20, 2025
Task: Resolve outstanding bugs on the Reports page, implement timezone-aware scheduling, and stabilize the local development environment.

Progress:

Reports Page Bugs (Fixed):

Fixed a critical bug where schedules could not be deleted. This was traced to an id vs. schedule_id mismatch between the API and the React components. The fix was applied to App.tsx, ManageSchedulesModal.tsx, and the DELETE endpoint in api/routes/reports.router.js.

Fixed a bug in the "Manage Schedules" modal where the recipients field appeared blank for older schedules. The component was updated to correctly display recipients whether the data is a string (old format) or an array (new format).

Feature: Timezone-Aware Scheduling:

Implemented a major enhancement to report scheduling. The system now accounts for the user's local timezone.

The Create Schedule modal now converts the user's selected local time (e.g., "09:30 CEST") to its UTC equivalent (e.g., "07:30 UTC") before saving to the database.

The Manage Schedules modal now does the reverse, converting the UTC time from the database back into the user's local time for display. This ensures the times shown in the UI always match the user's clock.

Infrastructure & Environment:

Local Environment Overhaul (npm -> yarn): Resolved a critical, blocking dependency conflict with npm. The date-fns-tz package required for the timezone feature conflicted with react-day-picker. After exhausting all npm troubleshooting steps (npm cache clean, --legacy-peer-deps, etc.), npm was identified as being stuck in a resolution loop.

Migrated the frontend project's package manager from npm to yarn. This immediately resolved all dependency conflicts and successfully installed the required packages (date-fns and date-fns-tz).

Vite/ESM Bug (Fixed): Resolved a subsequent Vite SyntaxError (does not provide an export named 'zonedTimeToUtc'). We debugged the module by logging it to the console, identified the correct v3 function names (fromZonedTime, toZonedTime), and updated the code, fixing the module-loading bug.

Toaster Styling (Fixed): Replaced the "aggressive" default sonner toast styles. We did this by removing the richColors prop in App.tsx and ensuring the locally customized components/ui/sonner.tsx component is used, which provides a neutral, on-brand style.

Cron Job (Enhanced): Modified vercel.json to improve report scheduling responsiveness. The cron job for /api/send-scheduled-reports.js was updated to run every 5 minutes (*/5 * * * *) instead of once per hour (0 * * * *).

Production Outage (Diagnosed): Investigated a 500 Internal Server Error on the live main branch. Confirmed it was not a code issue but was caused by a major Vercel/AWS (iad1) infrastructure outage, which was resolved externally.

UI Polish:

Fixed minor layout bugs in CreateScheduleModal.tsx where section headers were too close to the content below them, causing a slight visual overlap.

Changelog: October 20, 2025 (Afternoon Session)
Task: Integrate the new React prototype LandingPage component into the application, replacing the previous placeholder, and implement session-checking logic to show either the landing page or the dashboard.

Progress:

New LandingPage.tsx Integrated: Replaced the content of the existing src/components/LandingPage.tsx with the new version from the Figma prototype.

Dependencies Added: Copied MarketCalendarPreview.tsx, button.tsx, and input.tsx components from the prototype into the project's src/components folders.

Naming Fixed: Renamed the exported component in LandingPage.tsx from NewLandingPage to LandingPage to match the import in App.tsx.

Session Logic Implemented: Modified App.tsx to check /api/auth/session-info on load. It now conditionally renders either only the LandingPage (if not logged in) or the full application including TopNav (if logged in).

Styles Updated: Replaced the content of src/index.css with the full stylesheet (PROT_index.css) from the prototype to ensure all necessary Tailwind classes were available. Confirmed main.tsx imports index.css.

Toaster Fixed: Corrected an invalid import path (sonner@2.0.3 -> sonner) and removed an incorrect dependency (next-themes) in src/components/ui/sonner.tsx.

Magic Link API Connected: Updated the handleMagicLink function in LandingPage.tsx to make a POST request to /api/auth/login.

Status Messages Implemented: Replaced toast notifications in LandingPage.tsx with inline status messages displayed below the login button, showing success or error feedback directly on the page.

Pending Actions / Known Issues:

Persistent JSX Syntax Error: A syntax error ("Expected '</', got 'jsx text ( )'") remains in LandingPage.tsx, currently indicated around line 267. Multiple attempts to fix <div> tag nesting imbalances in this area were unsuccessful. The error prevents the component from rendering and needs further investigation in the next session to identify the exact cause of the tag mismatch.

Backend 404 Error: The /api/auth/login endpoint is returning a 404 Not Found error, preventing the magic link functionality from working correctly. This needs to be investigated by checking the backend server routing (api/index.js or server.js) and the Vite proxy configuration (vite.config.ts) in the next session.


Changelog: October 20, 2025
Task: Integrate the LandingPage component, fix local development authentication, and implement the full user navigation flow (dropdown menu, legal pages, and support page).

Progress:

Local Authentication Fixed: Diagnosed and resolved a critical local development login loop.

Implemented credentials: 'include' and cache-busting headers (cache: 'no-store') for the /api/auth/session-info request in App.tsx to force the browser to send the session cookie and prevent 304 Not Modified errors.

Corrected the session-checking logic in App.tsx to successfully parse the backend's flat JSON response (e.g., session.firstName) and log the user in.

TopNav User Menu (Live):

Replaced the static "KG" user icon in TopNav.tsx with a functional DropdownMenu component.

Connected the dropdown to App.tsx's state, displaying the logged-in user's dynamic initials, full name, and email.

Wired the "Log Out" menu item to the POST /api/auth/logout endpoint, which now correctly terminates the session and reloads the app.

New Page Routing (Live):

Implemented a new routing system in App.tsx using activeView and previousView state.

Wired the TopNav dropdown links ("Support", "Privacy Policy", "Terms of Service") to this router.

PrivacyPolicy.tsx, TermsOfService.tsx, and SupportPage.tsx now render as full-screen overlays.

The "Back" button on these pages correctly returns the user to their last location (either the 'Dashboard' or 'Landing' page).

LandingPage Integration (Live):

Fixed a persistent JSX nesting error in LandingPage.tsx that prevented it from rendering.

Connected the footer links ("Privacy Policy", "Terms of Service") to the new onViewChange routing handler.

Fixed UI/UX issues:

Removed the "100% Free" badge.

Corrected the "Average" row alignment in the mock report table using a flex-spacer.

Replaced generic feature boxes with stronger, specific value propositions (e.g., "Forward-Looking Demand").

Legal & Support Content (Live):

Merged critical legal clauses from old .html files into the new TermsOfService.tsx and PrivacyPolicy.tsx components, including the legal entity name (ROCKENUE INTERNATIONAL GROUP), commercial data rights, and jurisdiction (Dubai, UAE).

Standardized all contact links to support@market-pulse.io.

Fixed a UI bug where the headers on legal pages were transparent and allowed text to scroll underneath them.

Navigation Bugs (Fixed):

Removed the "Home" button from TopNav.tsx to resolve a navigation conflict.

Fixed an import error for lucide-react icons (FileShield) that was breaking the TopNav component.

Known Issues:

Support Page Layout Bug: The SupportPage.tsx component has a persistent layout bug. Despite multiple attempts to use standard Tailwind grid classes (e.g., md:grid-cols-3, md:col-span-2), the component renders in a single stacked column instead of the desired side-by-side layout. This is suspected to be a static CSS build issue, as the required classes are likely not present in the compiled stylesheet.

Next Steps:

Investigate the Support Page layout bug, likely requiring an inline style or a class that is already known to be in the CSS build.

Connect the SupportPage.tsx contact form to a new backend endpoint to send emails.

Implement success/failure status messages (e.g., using sonner) for the support form submission.

Connect the "Insights" card on the Dashboard view.

Changelog: October 21, 2025
Task: Connect the Support Page form, improve the magic link email template, and discuss Market Codex data utilization.

Progress:

Support Page Layout (Fixed):

Resolved JSX syntax errors in SupportPage.tsx related to comment placement and tag nesting.

Fixed the full-width layout bug by adding a max-w-7xl mx-auto wrapper to center the content, matching the prototype design.

Support Page Form (Live):


Backend: Created a new API endpoint POST /api/support/submit in api/routes/support.router.js to handle form submissions. This endpoint validates input and sends a formatted email using SendGrid.


Dependencies: Installed the @sendgrid/mail package.


Routing: Mounted the new /api/support route in server.js.


Frontend: Connected the SupportPage.tsx form to the new backend endpoint. Implemented loading state (isSubmitting) with button disabling/spinner and replaced the previous success message screen with sonner toast notifications for success/error feedback.


Debugging: Diagnosed and resolved a 500 Internal Server Error caused by missing/incorrect SENDGRID_FROM_EMAIL environment variable configuration in the backend's .env file.


Content: Updated SupportPage.tsx to remove the "Sales & Partnerships" contact details, leaving only the primary support email.


Email Correction: Fixed the target email address in both support.router.js (SendGrid to field) and SupportPage.tsx (mailto: link) from support@marketpulse.com to the correct support@market-pulse.io.

Magic Link Email Template (Enhanced):

Replaced the basic HTML in api/routes/auth.router.js with a new, robust, dark-themed HTML email template using <table> layouts and inline CSS for better email client compatibility.

Extracted the template generation function (getMagicLinkEmailHTML) into a dedicated api/utils/emailTemplates.js file for better organization.

Updated api/routes/auth.router.js to import and use the getMagicLinkEmailHTML function.

Corrected the from email address in the SendGrid configuration within auth.router.js to use the verified SendGrid domain (em4689.market-pulse.io) to improve deliverability.

Market Codex / OTA Crawler (Discussion):

Confirmed the scraper described in the documentation is the same system.


Reviewed the available data points in the market_availability_snapshots table, including total_results, price histograms, and various facets.


Discussed the value of daily scraping for future dates (up to 120 days) to enable pace analysis, pricing trend tracking, and demand identification based on historical snapshots.

Known Issues:

None currently identified from today's work.

Next Steps:

Implement the Figma AI design concepts for the "Market Pace & Pricing Trends" feature using the Market Codex data.

Connect the "Insights" card on the Dashboard view.

Changelog: October 21, 2025
Task: Debug and resolve a critical bug where scheduled reports were created in the UI but never delivered.

Progress:

Initial Bug Triage: Identified that reports scheduled from the new React UI were failing to send. The debugging process uncovered multiple, compounding issues.

Fixed: UI-Cron Mismatch: The cron job in vercel.json is set to run every 5 minutes, but the CreateScheduleModal.tsx time input allowed selection of any minute (e.g., 11:52). This was fixed by adding a step="300" (5 minutes) attribute to the <Input type="time">, forcing all saved times to align with the cron schedule.

Fixed: "Sunday" Bug: The backend script api/send-scheduled-reports.js was using JavaScript's getUTCDay() (where Sunday=0), but the frontend saved Sunday as 7 (ISO standard). The backend script was modified to normalize the day, converting 0 to 7 to match the database.

Fixed: Recipient Format Bug: The new React UI saved recipients as a PostgreSQL array literal (e.g., {"email@domain.com"}), while the backend script expected a simple comma-separated string (email@domain.com). This was fixed by updating api/routes/reports.router.js to .join(',') the recipient array before saving, ensuring all new schedules are saved in the correct, parsable format.

Fixed: Timezone Conversion Bug: This was the most critical bug. The modal was saving the user's local time (e.g., "11:55") to the database instead of the converted UTC time (e.g., "09:55"). After several attempts, this was resolved in CreateScheduleModal.tsx by replacing the faulty format function with the explicit fnsTz.formatInTimeZone(zonedDate, 'UTC', 'HH:mm') function, ensuring the correct UTC time is always saved.

Fixed: UI/UX Bugs:

Modal Layout: Fixed a bug where the CreateScheduleModal.tsx was too tall for the viewport and could not be scrolled. This was resolved by applying inline styles (maxHeight: '90vh', overflowY: 'auto') to the component.

Toast Notifications: Resolved multiple toast bugs:

Removed a duplicate toast.success() call from CreateScheduleModal.tsx to prevent double notifications.

Fixed a bug causing toasts to appear "blank" (no styling) by refactoring src/components/ui/sonner.tsx to correctly merge its default styling classes with the toastOptions (like zIndex) passed from App.tsx.

Corrected the toast styling in sonner.tsx to remove a padding bug.

Outstanding Item: Final Test Pending
A final end-to-end test of the scheduled reports feature could not be completed.

This is because the bug fixes are split across two different projects (the backend market-pulse project and the new frontend Market Pulse Dashboard Redesign project), and both have critical uncommitted files.

Backend Not Deployed: The market-pulse project has an uncommitted vercel.json file. The currently deployed version still has an hourly cron job, making it impossible to test our 5-minute fixes.

Frontend Not Deployed: The new React frontend project, which contains all the modal and timezone fixes in CreateScheduleModal.tsx, is not yet committed to Git at all.

Next Step: The full, end-to-end functionality of scheduled reports must be re-tested by creating and waiting for a scheduled report after the React migration is complete and all new files from both projects (including vercel.json and CreateScheduleModal.tsx) have been committed to Git and deployed to production.

Here is the changelog entry for this session:

Changelog: October 21, 2025
Task: Wire up remaining Dashboard components, fix UI bugs on the Reports page, and implement the new tabbed Settings page.

Progress:

Dashboard: "Total Revenue" Card (Live):

Backend: Modified GET /api/kpi-summary in dashboard.router.js to calculate and return SUM(gross_revenue) AS your_total_revenue.

Frontend: Updated App.tsx to accept the new totalRevenue value in its kpiData state and passed the live, formatted value to the MiniMetricCard.

Dashboard: "Insights" Card (Live):

Replaced the placeholder InsightsCard.tsx with the new "Your Hotel vs Comp Set" design from the prototype.

The component was fully wired up to the live kpiData and currencyCode props from App.tsx.

Updated the component's helper functions (formatValue, calculateDifference) to correctly format live currency and percentage data.

Dashboard: UI Polish & "Coming Soon":

Renamed the "Market Rank (RevPAR)" card label to "Market Rank" in App.tsx.

Renamed the "Market Composition" card title to "Comp Set Breakdown" in MarketCompositionCardAlt.tsx.

Implemented the "Coming Soon" feature for the "Forecast" card.

Updated src/components/MiniMetricCard.tsx to accept a comingSoon prop and display a badge.

Fixed a static CSS build bug by applying an inline style={{ fontSize: '9px' }} to the badge.

Updated App.tsx to use the comingSoon={true} prop on the "Forecast" MiniMetricCard.

Reports Page: UI Fix:

Fixed the alignment of the "Advanced Reporting" header in ReportSelector.tsx. Removed the centering classes (max-w-7xl, mx-auto) to align the header to the left, matching the content grid.

Settings Page: New UI Implemented:

Replaced the old, static settings layout in App.tsx with the new tabbed SettingsPage.tsx component from the prototype.

Fixed invalid import paths for sonner (changed sonner@2.0.3 to sonner) in SettingsPage.tsx, MyProfile.tsx, and ConnectedProperties.tsx.

Settings Page: "My Profile" Tab (Wired):

Identified the existing PUT /api/user/profile endpoint in dashboard.router.js.

Updated App.tsx to fetch the user's details from GET /api/user/profile when the settings page is active.

Added the handleUpdateProfile function to App.tsx to call the PUT endpoint.

Props (userInfo, onUpdateProfile) are now passed from App.tsx down to MyProfile.tsx.

Modified MyProfile.tsx to load its state from these props and call the onSave handler.

Debugged multiple JSX syntax errors (invalid comments within tags) in MyProfile.tsx.

Fixed a bug to ensure null email values from the database render as an empty string.

Known Issues:

The Settings page components are still displaying some mock data, as the live data fetching for team members and properties has not been wired up to the new tabbed components yet.


Changelog: October 21, 2025
Task: Wire up the new "Year-on-Year Comparison" (YoY) report component to live backend data and resolve data integrity issues.

Progress:

Backend API Created (reports.router.js):

Endpoint 1 (GET /api/reports/available-years): Created a new endpoint to fetch the list of valid years for a property's report dropdowns.

Data Integrity Fix: Debugged a critical issue where the endpoint returned "dirty" data (e.g., "2020", "2021") for hotels that were not live at that time. By referencing market.router.js, we confirmed the existence of a go_live_date column in the hotels table. The SQL query was refactored to join with hotels and filter out all data before the go_live_date and any snapshot rows with zero sales, ensuring only clean, valid years are returned.

Endpoint 2 (POST /api/reports/year-on-year): Created the main data endpoint for the report. It accepts a propertyId, year1, and year2, and uses SQL conditional aggregation to efficiently return a full 12-month comparison for all key metrics.

Frontend Wiring (YearOnYearReport.tsx):

Replaced the entire component's content, removing all mock data.

Live Dropdowns: The component now calls GET /api/reports/available-years on load to populate the year selection dropdowns.

Smart Defaults: Implemented logic to intelligently set the default selected years to the two most recent, consecutive years from the (now clean) API response, correctly handling the user's request for "current year vs. last year."

Live Data: The component now calls POST /api/reports/year-on-year whenever the property or selected years change. A loading overlay was added.

Currency Integration: The component now accepts the currencyCode prop from App.tsx and uses it to correctly format all monetary values (ADR, RevPAR, Revenue).

Frontend Bug Fix (App.tsx):

Resolved a bug where saving the file while on the YoY report page triggered phantom "Report generated" toasts.

The useEffect hooks for taxInclusive and selectedMetrics were updated to only auto-run the report if selectedReportType === 'performance-metrics', fixing the issue.

Changelog: October 22, 2025

Task: Complete the implementation of the "Year-on-Year Comparison" report, fix revenue formatting, and implement the new YTD summary row with prototype styling.

Progress:

Revenue Formatting Fixed:

The formatCurrencyDynamic helper function in YearOnYearReport.tsx was modified.

It no longer formats thousands with a "K" (e.g., £25K).

It now displays the full, formatted number for all values under one million (e.g., £25,000, £937,000) while still formatting millions as "M" (e.g., £1.11M).

YTD Summary Row (Live):

Implemented the "Year to Date" summary row (currentPeriodSummary) as per the prototype.

The logic correctly calculates totals/averages for the elapsed period (Jan - Sep, based on the project's current date of October 2025).

The row now correctly appears if either year1 or year2 is the current year (2025).

YTD Row Positioning (Fixed):

Debugged an issue where the YTD row was not appearing.

The problem was a mismatch between the API data's 3-letter month format (e.g., "Sep") and the component's full-name format (e.g., "September").

The monthNames array was updated to use 3-letter abbreviations, fixing the bug.

The row is now correctly rendered inside the reportData.map() loop, appearing in its proper position immediately after the "Sep" row.

YTD Row Styling (Live):

Implemented the new styling for the YTD row from the Figma prototype.

Identified that the project's static CSS build does not support Tailwind's opacity modifiers (e.g., bg-opacity-80 or bg-[#1f1f1c]/80).

As per the established workaround, the prototype's opacity-based classes were replaced with inline style attributes using rgba values (e.g., style={{ backgroundColor: 'rgba(31, 31, 28, 0.8)' }}).

The YTD row now features the correct semi-transparent dark background and the grey accent bar on the left.

Label Polish & Bug Fixes:

The YTD row label was updated to the clearer "YTD (Jan - Sep)".

The final totals row label was updated to "Full Year (Jan - Dec)" to distinguish it from the YTD summary.

Fixed a typo in the "Full Year" row that was incorrectly referencing summary.avg2.avg1 instead of summary.avg2.revpar.

Resolved multiple JSX syntax errors caused by misplaced comments within the <tbody>.

Changelog: October 22, 2025
Task: Overhaul and connect the file export functionality for all reports, implementing advanced formatting, auto-sizing, and dynamic filenames.

Progress:

Performance Metrics Exporter (Live):

Fixed the export handlers in App.tsx, which were previously dumping raw, unformatted API data.

Implemented pre-export formatting logic to process the reportData array.

The period column is now correctly renamed to Date and formatted as DD-MM-YYYY.

Occupancy values are now formatted as percentages (e.g., 85.1%).

All monetary values (adr, revpar, revenue) are now formatted with the correct currency symbol and 2 decimal places based on the live currencyCode state.

Dynamic Filenames (Live):

Replaced the static Market_Pulse_Report.xlsx filename.

All exported files are now dynamically named using the selected property's name and the report's date range, matching the requested format (e.g., The Melita London 01-10-2025 to 31-10-2025 Performance Report.xlsx).

Excel (.xlsx) Quality-of-Life:

Implemented column auto-sizing for all .xlsx exports. The handler now calculates the max content length for each column (header and data) and applies the width to the worksheet, making the file immediately readable.

Year-on-Year Exporter (Fully Live):

Connected the previously non-functional export buttons on the "Year-on-Year Comparison" report.

Refactored YearOnYearReport.tsx to use forwardRef and useImperativeHandle. This "bridge" allows App.tsx to access the component's internal data and state (reportData, year1, year2, etc.).

Created a new handleYoyExport function in App.tsx that flattens the report's nested data structure into a clean, exportable format (e.g., Occupancy (2024), Occupancy (2025)).

This handler correctly formats all values (%, $) and intelligently inserts the YTD and Full Year summary rows into the exported file.

The export uses the new dynamic filename standard (e.g., The Melita London 2024 vs 2025 YoY Report.xlsx).

Year-on-Year Scheduling (Wired):

Upgraded the handleSaveSchedule function in App.tsx to be "report-aware."

It now saves the selectedReportType to the database. When scheduling a year-on-year report, it uses the yoyReportRef to get and save the selected year1 and year2 parameters.

"Ghost Toast" Bug (Fixed):

Resolved an issue where empty toast notifications would appear when first loading the Reports page.

This was fixed by adding useRef flags (isTaxEffectMount, isMetricsEffectMount) to the useEffect hooks in App.tsx, preventing them from auto-running the report on the initial mount but allowing them to run on subsequent user interactions.

Changelog: October 22, 2025 Task: Complete the implementation of the "Year-on-Year Comparison" report, connect its actions, and resolve formatting/implementation bugs.

Progress:

YoY Actions (Live): Connected the "Export" and "Schedule" buttons on the "Year-on-Year Comparison" report page.

Ref Forwarding Implemented: Refactored YearOnYearReport.tsx to use forwardRef and useImperativeHandle. This creates a "bridge" allowing the parent App.tsx to access the report's internal state, such as reportData, year1, year2, and summary rows.



Export Handler (Live): Implemented the handleYoyExport function in App.tsx. This function reads data from the component's ref, flattens the nested data into an exportable format, and intelligently inserts both the YTD and Full Year summary rows into the file.


Export Features (Live): The export handler now generates dynamic filenames (e.g., The Melita London 2024 vs 2025 YoY Report.xlsx) and includes column auto-sizing for all .xlsx exports.


Scheduling (Upgraded): Upgraded the handleSaveSchedule function in App.tsx to be "report-aware". When scheduling a year-on-year report, it now reads the selected year1 and year2 from the ref and saves these parameters to the database.


Revenue Formatting (Fixed): Modified the formatCurrencyDynamic helper function in YearOnYearReport.tsx. It no longer formats large revenue values with "M" (e.g., £1.11M) and instead displays the full, formatted number (e.g., £1,110,000), ensuring formatting is consistent in the summary row.



Syntax Bugs (Fixed): Resolved multiple syntax errors in App.tsx (e.g., Return statement is not allowed here) and YearOnYearReport.tsx that arose during the refactoring, including missing function definitions and incorrect brace placement.

Changelog: October 22, 2025 Task: Implement the automatic "Initial Sync" overlay and correct the URL parameter race condition.

Progress:

"Initial Sync" (Re-implemented): Replaced the manual "Initial Sync" navigation button with the application's original automatic flow, which is triggered after a new property connection.

Auth Flow (Analyzed): Confirmed the correct flow by reviewing the backend code: after a new Mews or Cloudbeds connection, the user is redirected to /app/?newConnection=true&propertyId=....

Frontend Logic (Live):

Added isSyncing state to App.tsx.

Implemented a useEffect hook to detect the newConnection=true parameter on load. When found, it sets isSyncing to true (displaying the InitialSyncScreen overlay) and starts a polling interval.

The polling interval repeatedly calls the GET /api/sync-status/:propertyId endpoint, just as the original application did.

URL Race Condition (Fixed): Debugged and fixed a critical race condition. The useEffect hook in App.tsx that updates the propertyId in the URL was modified to preserve the newConnection parameter, preventing it from being removed before the sync logic could read it.

Sync Completion (Live): The polling logic in App.tsx now correctly sets isSyncing to false (hiding the overlay) and removes the newConnection parameter from the URL upon a successful API response, matching the original application's behavior.

Pending End-to-End Testing (Critical): The following items cannot be fully tested in the current local-only environment and must be validated after the full migration is committed to Git and deployed:

Pending Test (Initial Sync Flow): The full, end-to-end test of a new OAuth/Mews connection automatically triggering the InitialSyncScreen overlay cannot be performed. This test is blocked until all new frontend and backend files are committed and deployed, as it relies on a live backend redirect.

Pending Test (Scheduled Reports): Similarly, the end-to-end functionality of creating and receiving a scheduled report remains untested. This is also blocked as the updated backend (api/routes/reports.router.js, vercel.json) and frontend (CreateScheduleModal.tsx) files are not yet deployed.


Here is the changelog for our session, skipping the dashboard chart and Figma instructions.

Changelog: October 23, 2025
Task: Implement role-based admin navigation, fix a critical navigation bug, and troubleshoot local development environment failures.

Progress:

Feature: Admin/Rockenue Navigation Styling:

TopNav.tsx: Updated the navigation bar to implement the prototype's styling for super_admin links.

Added the isAdmin: true flag and Zap icon to the "Rockenue" and "Admin" nav items.

The component now uses the userInfo.role prop to filter these links, making them visible only to super_admin users.

Updated the rendering logic to apply the prototype's yellow text and underline styling to these admin-only links.

App.tsx: Refactored state management to support the TopNav changes.

The userInfo state object and checkUserSession function were updated to store the user's role on login.

Fixed a bug in fetchUserProfile where loading the settings page would wipe the user's role. The function now correctly merges profile data while preserving the role.

Bug Fix: Initial Sync Screen Flicker:

App.tsx: Resolved a bug where the InitialSyncScreen would flicker on every page navigation.

The useEffect hook that checks for the ?newConnection=true parameter was incorrectly running on every activeView change.

The hook's dependency was fixed to [isSessionLoading], ensuring it now runs only once when the app first loads, eliminating the flicker.

Dev Environment & Troubleshooting:

Backend 500 Errors: Diagnosed a series of 500 Internal Server Error messages (on /api/dev-login, /api/my-properties, etc.) as a backend server crash, not a frontend issue. The root cause was identified as a misconfigured or missing .env file in the backend market-pulse project.

Local Dev Login Script: Provided an updated browser console script to authenticate for local development. The script now correctly sends the admin email address in the POST request body to the /api/dev-login endpoint.


Changelog: October 25, 2025
Task: Implement the new "Budgeting" feature, allowing users to set and track monthly performance targets against actuals.

Progress:

Frontend UI Created (Budgeting.tsx, CreateBudgetModal.tsx):

Added a new "Planning" dropdown to the main navigation (TopNav.tsx) with a "Budget" link.

Implemented the main Budgeting.tsx component, which displays a yearly overview table comparing actual performance (Occupancy, ADR, Revenue) against user-defined targets.

Included an expandable section for each month to show detailed pacing analysis (for current/past months).

Implemented the CreateBudgetModal.tsx component for creating or editing the full 12-month budget, featuring options to start blank or copy data.

Added auto-calculation logic to the modal: filling two metrics (Occ, ADR, Rev) automatically calculates the third for faster input.

Integrated sonner toasts for user feedback on save operations.

Database Table Created (hotel_budgets):

Added a new hotel_budgets table to the PostgreSQL database to store monthly targets.

The table includes columns for hotel_id, budget_year, month, target_occupancy (nullable), target_adr_net (nullable), target_adr_gross (nullable), target_revenue_net (NOT NULL), and target_revenue_gross (NOT NULL).

A unique constraint ensures only one budget entry per hotel, year, and month.

Backend API Endpoints Created (api/routes/budgets.router.js):

Created a new router file (budgets.router.js) and mounted it at /api/budgets in server.js.

Implemented GET /api/budgets/:hotelId/:year: Fetches the 12-month budget data for a specific property and year, ensuring user access via user_properties. Returns a full 12-month structure, even if some months have no data.

Implemented POST /api/budgets/:hotelId/:year: Saves or updates the 12-month budget using an UPSERT operation (INSERT ... ON CONFLICT DO UPDATE) within a database transaction. It requires targetRevenue (assumed Gross from modal) and calculates/stores both Net and Gross values for Revenue and ADR based on the hotel's tax_rate fetched from the hotels table.

Live Data Integration (Budgeting.tsx):

The Budgeting page now fetches live budget targets using the GET /api/budgets/... endpoint.

It also fetches live actuals data (Occ, ADR, Total Revenue) using the existing POST /api/reports/run endpoint, dynamically setting the includeTaxes flag based on the Gross/Net toggle.

The component correctly parses and displays both budget targets and actuals in the main table.

The "Save Budget" functionality in the modal now successfully calls the POST /api/budgets/... endpoint to persist changes.

Known Issues:

Actuals Revenue Toggle: While the Gross/Net toggle correctly sends the includeTaxes flag to the backend when fetching actuals, confirmation is needed that the UI accurately displays the fetched Gross or Net revenue figure in the "Actuals Revenue" column when toggled.

Occupancy Display Bug: Actual Occupancy figures displayed in the table are significantly lower than expected (e.g., showing 6% instead of 65%), even though the correct decimal value seems to be received from the API. This suggests a potential miscalculation or formatting error specifically for occupancy in the frontend initializeMonthlyData function.


## **Changelog: October 25, 2025 (Afternoon Session)**

**Task:** Diagnose and identify the root cause of incorrect occupancy values displaying in the React application (e.g., 6.3% instead of 84.4%).

**Progress:**

* **Problem Identified:** Confirmed a significant discrepancy in occupancy figures between the new React prototype and the existing, correctly functioning Alpine.js application, despite both using the same backend database. The React app displayed values like 6.3%, while the Alpine app and PMS source showed ~84.4% for the same dates/hotels.
* **Database Analysis:** SQL query results revealed that the `occupancy_direct` column within the `daily_metrics_snapshots` table contained incorrect decimal values (e.g., `0.0625` instead of the expected `0.84375` based on `rooms_sold` and `capacity_count` for the test case).
* **Root Cause Determined:**
    * The **React application** was found to be using backend API endpoints (`POST /api/reports/run` in `reports.router.js` and `GET /api/dashboard-chart` in `dashboard.router.js`) that directly read the value from the unreliable `occupancy_direct` column.
    * The **working Alpine.js application** uses different backend endpoints (`GET /api/metrics-from-db` and `GET /api/competitor-metrics` in `dashboard.router.js`) which correctly *recalculate* occupancy on-the-fly using the formula `SUM(rooms_sold) / SUM(capacity_count)` before sending the data to the frontend. These endpoints alias the calculated result (e.g., as `your_occupancy_direct`).
* **Conclusion:** The `occupancy_direct` column in the database is unreliable and **should not be directly read** by API endpoints. The correct and reliable method for determining occupancy is to **calculate it using `SUM(rooms_sold) / SUM(capacity_count)`**.

**Next Steps:**

* Modify the React application's data fetching logic in `App.tsx` to stop using the problematic endpoints (`/api/reports/run`, `/api/dashboard-chart`) and instead utilize the existing, proven endpoints (`/api/metrics-from-db`, `/api/competitor-metrics`) for all occupancy-related data (Reports page, Dashboard chart/table, Market Rank card).


Changelog: October 25, 2025 (Evening Session)
Task: Eradicate the occupancy_direct bug from all remaining backend endpoints and fix a super_admin access bug on the Budgeting page.

Progress:

occupancy_direct Bug (Backend Fixes):

Completed the system-wide fix for incorrect occupancy calculations by modifying all remaining backend API endpoints that were still reading the unreliable occupancy_direct column. THIS IS NOW FIXED

api/routes/dashboard.router.js: Corrected the GET /api/market-ranking endpoint's SQL query to calculate occupancy using SUM(rooms_sold) / SUM(capacity_count).

api/routes/reports.router.js: Corrected the POST /api/reports/year-on-year endpoint's SQL query similarly.

api/routes/market.router.js: Corrected the SQL queries for GET /market/trends, GET /market/kpis, and GET /market/neighborhoods.

Documentation: Added section 13.0 Architectural Milestone: Occupancy Data Refactor to Project Overview.md to document the issue, the fix, and explicitly deprecate the use of the occupancy_direct column.

Budgeting Page Access Bug (Fixed):

Root Cause: Diagnosed a bug where super_admin users received a "Forbidden" error when accessing the Budgeting page for certain properties. This occurred because budgets.router.js failed to check the req.session.role and incorrectly performed a user_properties lookup using only the string cloudbeds_user_id, which sometimes failed if the user-property link existed via the integer user_id instead.

Fix: Modified both the GET /api/budgets/:hotelId/:year and POST /api/budgets/:hotelId/:year handlers in budgets.router.js. The logic now correctly checks if req.session.role === 'super_admin' first. For non-admins, it replicates the robust access check from dashboard.router.js, querying user_properties using both the string cloudbedsId and the integer internalId fetched by the middleware.

Result: Super admins can now access the Budgeting page for all properties, regardless of how their link is stored in user_properties.

Outcome: All known instances of the occupancy_direct bug have been resolved across the backend. The Budgeting page access control now correctly handles the super_admin role.

Changelog: October 27, 2025

Task: Implement Advanced Budget Pacing Logic and Backend Benchmarking.

Progress:

Backend Benchmarking Endpoint (Live):

Created a new, dedicated endpoint GET /api/budgets/benchmarks/:hotelId/:month/:year in api/routes/budgets.router.js.

This endpoint provides dynamic benchmarkOcc and benchmarkAdr values for any given month, which are essential for the new pacing logic.

Logic: For "near-term" months (current + 90 days), it calculates benchmarks from "Last 30 Days" (L30D) data. For "distant-future" months, it falls back to "Same Month Last Year" (SMLY) data. If no data exists, it returns hardcoded defaults (75% Occ, £120 ADR).

Bug Fix: Fixed a critical schema bug in the new endpoint's SQL queries, correcting snapshot_date to stay_date to match the daily_metrics_snapshots table.

Frontend Integration (Live):

Refactored Budgeting.tsx to call the new /api/budgets/benchmarks endpoint via a useEffect hook when a month is expanded.

The fetched benchmark data is stored in the benchmarkData state and passed directly into the calculateMonthPacing function.

New 3-Tier Pacing Logic (Live):

Completely overhauled the calculateMonthPacing function to implement the new 3-tier status logic. See the "Architectural Note" below for a full explanation.

The function now correctly calculates the "Required ADR" and compares it against the "Benchmark ADR" to determine the month's status.

UI Polish & Debugging (Fixed):

UI: Hid the "Benchmark ADR" row from the "Path to Target" card in Budgeting.tsx to reduce user confusion. The "Required ADR" and "Projected Occupancy" rows remain visible.

Debugging: Added a detailed console.log statement within calculateMonthPacing to output all key metrics (Required ADR, Benchmark ADR, Ratio) for future debugging.

Bug Fix: Resolved a ReferenceError for adrRatio by correctly scoping the variable, which was preventing the component from loading.

Architectural Note: Budget Pacing Logic
This session implements the core logic for the Budgeting feature. The goal is to provide a "Green / Yellow / Red" status for any current or future month by comparing the effort required to meet the budget against a realistic benchmark.

The status is determined by comparing two key calculated metrics:

Benchmark ADR (Our "Realistic" Rate): This is our "best guess" for the achievable ADR for the month. It's found using this fallback priority:

1. Current ADR: The actualADR already on the books for that month. This is the most relevant benchmark.

2. API Benchmark (L30D/SMLY): If no rooms are sold yet, we use the benchmarkAdr from the new API endpoint (derived from "Last 30 Days" or "Same Month Last Year" performance).

3. Default: If all else fails, we use a hardcoded default of £120.

Required ADR (Our "Target" Rate): This is the rate we must achieve on our remaining unsold rooms to hit the revenue target. It's calculated with this formula:

Required ADR = Revenue Still to Earn / Remaining Projected Rooms to Sell

To get the Remaining Projected Rooms to Sell, we first need a Benchmark Occupancy (our "best guess" for the month's final occupancy, sourced from L30D/SMLY data or a 75% default).

Remaining Projected Rooms to Sell = (Total Rooms in Month * Benchmark Occupancy %) - Rooms Already Sold

The 3-Tier Status Rules:
The final status is determined by comparing the Required ADR to the Benchmark ADR:

GREEN ("On Target"):

Required ADR is less than or equal to Benchmark ADR.

Why: The rate we need to get is lower than or equal to the rate we are realistically achieving. The budget is healthy.

This is also the default status if the target is already met or if 0 rooms have been sold (a "clean slate").

YELLOW ("Slightly Behind"):

Required ADR is 0% to 15% higher than Benchmark ADR.

Why: We need to perform slightly better than our benchmark. The goal is achievable but requires a push.

RED ("At Risk"):

Required ADR is more than 15% higher than Benchmark ADR.

Why: The rate we need to get is significantly higher than our realistic benchmark, indicating the target is at high risk of being missed.

Note: This pacing logic is a core business-intelligence component of the new application. When the React migration is complete, this explanation must be moved from the changelog and integrated into the main Project Overview.md as a permanent architectural principle.


Changelog: October 27, 2025

Task: Correct historical data for a specific hotel, debug Budget Pacing calculations, and refine backend logic for accuracy.

Progress:

Historical Data Correction (Hotel 315428):

Objective: Insert correct Gross Revenue and Occupancy monthly totals for 2023 and 2024, replacing previously missing/zeroed data, while maintaining realistic daily variation.

Method: Due to the absence of original (even corrupt) daily data for hotel 315428, a standard "pro-rata spread" was not possible. Instead, the daily variation pattern from Jubilee Hotel's (ID 230719) 2024 data was used as a template.

SQL Script: A custom SQL script was developed and executed. This script:

Fetched the daily gross_revenue and rooms_sold pattern from Jubilee Hotel (230719) for each month of 2024.

Calculated scaling factors by comparing Jubilee's 2024 monthly totals (from the pattern data) against the correct monthly totals provided for hotel 315428 (for both 2023 and 2024).

Applied these scaling factors to the Jubilee daily pattern data.

Updated the corresponding daily rows in daily_metrics_snapshots for hotel 315428 for all of 2023 and 2024 with the scaled gross_revenue and rooms_sold values.

Correctly recalculated net_revenue (based on hotel 315428's tax rate) and occupancy_direct (based on hotel 315428's total_rooms and the scaled rooms_sold) for each updated day. Derived metrics like ADR and RevPAR were intentionally not set, as they are calculated on-the-fly by the API.

Included logic to disable/re-enable triggers during the update as documented for previous data corrections.

Data Integrity Fix: Identified that hotels.total_rooms for hotel 315428 incorrectly included virtual rooms (showing 28 instead of the physical 20). This was fixed by re-running the GET /api/admin/backfill-room-counts script locally via its direct URL, which correctly recalculated and saved the physical room count (20).

Data Lock: Successfully activated the data lock for hotel 315428 by running UPDATE hotels SET locked_years = '["2023", "2024"]' WHERE hotel_id = 315428;, protecting the newly inserted data from future sync overwrites.

Budget Pacing Debugging (Current Month):

Issue: The "Path to Target" card for the current month (October) displayed an incorrect value for "Physical Rooms Remaining (Today+)" (showing the total month's unsold potential, e.g., 57) instead of the actual physical rooms left to sell from today onwards (e.g., 17). This led to a nonsensical "Required ADR" calculation.

Backend Enhancement (dashboard.router.js): Modified the GET /api/metrics-from-db endpoint:

The calculation for total monthly your_capacity_count was corrected to use hotels.total_rooms * days_in_period instead of SUM(daily_metrics_snapshots.capacity_count).

Added logic: For the current month only, the endpoint now attempts to execute an additional SQL query (SUM(capacity_count - rooms_sold) WHERE stay_date >= CURRENT_DATE...) to calculate the actual physical unsold rooms remaining and return this value in a new physical_unsold_remaining field.

Frontend Update (Budgeting.tsx):

Updated the useEffect hook to correctly map the new physical_unsold_remaining field from the API response into the component's state.

Modified the calculateMonthPacing function logic. For the current month, it now uses the physical_unsold_remaining value (if available) to calculate the Required ADR. For future months, it continues to use the benchmark occupancy projection method.

Updated the UI label to "Physical Rooms Remaining (Today+)" and modified the displayed value to show the physical_unsold_remaining number (e.g., 17) for the current month, while still showing the total month potential for future months.

Known Issue (Budget Pacing): The backend fix intended to calculate and return physical_unsold_remaining for the current month in GET /api/metrics-from-db is currently not functioning. Backend logs confirm that the specific code block containing the necessary SQL query is not being executed when processing the current month's data. As a result, the frontend receives null for this field and incorrectly falls back to displaying the total month's unsold potential (57) instead of the actual remaining physical rooms (17). This bug requires further investigation in the backend code (dashboard.router.js).


Changelog: October 29, 2025
Task: Extend the data model to support Rockenue-specific management tools.

Purpose: To create a "source of truth" in the database for identifying and grouping hotels managed by Rockenue. This will allow the "Rockenue" section to feature specialized tools and reports that filter only for these properties.

Progress:

1. Database Schema (hotels Table)
Action: Executed an ALTER TABLE command on the hotels table.

Why: To add two new columns for storing management data.

Columns Added:

is_rockenue_managed: A BOOLEAN column (defaulting to FALSE) to serve as a simple true/false flag for properties managed by Rockenue.

management_group: A TEXT column to store the name of the management group (e.g., "Shreeji"). This field can be NULL for independent properties.

2. Backend API (api/routes/admin.router.js)
Action: Modified and added several endpoints to the admin router.

Why: To allow the React admin panel to read and write this new data.

Endpoints:

GET /api/admin/get-all-hotels: Modified to SELECT and return the new is_rockenue_managed and management_group columns for every hotel.

POST /api/admin/update-hotel-management: Created as a new endpoint. It securely updates the value of either is_rockenue_managed or management_group for a specific hotelId.

GET /api/admin/management-groups: Created as a new endpoint. It returns a distinct, sorted array of all non-empty management_group names (e.g., ["Group A", "Shreeji"]). This is used to populate the new "Group" combobox on the frontend, which solves our data integrity concern by preventing typos.


Changelog: October 29, 2025 (Evening Session)
Task: Design and implement the backend architecture for the new "Rockenue Portfolio Overview" page, a private tool for super_admin users.

Objective: Create a system to track all Rockenue-managed properties (both live on Market Pulse and off-platform) and their associated monthly_fee to calculate total MRR/ARR, without affecting the main application or staff workflows.

Progress:

1. Architectural Decisions ("Hybrid" Approach):
Admin Panel Toggle Kept: The is_rockenue_managed and management_group columns remain on the main hotels table. The toggle in the Admin Panel (HotelManagementTable.tsx) continues to function as the "on switch" for staff to enable Rockenue Hub features (like alerts) for live Market Pulse properties.

New Private Ledger Table: A new, separate table named rockenue_managed_assets was created. This table serves as the primary data source for the private "Portfolio Overview" page and holds financial information.

2. Database Implementation:
rockenue_managed_assets Table Created:

Stores all managed assets (live and off-platform).

Columns include: id (PK), asset_name, city, total_rooms, management_group, monthly_fee.

Includes market_pulse_hotel_id (TEXT, Nullable) which links to the hotels.hotel_id for live properties. A NULL value indicates an "off-platform" asset managed solely within this table.

Data Migration: A one-time SQL script was executed to populate rockenue_managed_assets with existing hotels currently marked is_rockenue_managed = true in the hotels table.

3. Backend Implementation:
Daily Sync Cron Job Created:

A new Vercel Serverless Function was created at api/sync-rockenue-assets.js.

This script runs daily (scheduled via vercel.json).

It automatically finds hotels flagged with is_rockenue_managed = true in the hotels table.

If a corresponding entry doesn't exist in rockenue_managed_assets, the script inserts it with basic details and a default monthly_fee of 0. This ensures properties enabled by staff appear on the private overview page for financial data entry.

Portfolio API Endpoints Added (api/routes/rockenue.router.js):

GET /api/rockenue/portfolio: Fetches all assets from rockenue_managed_assets, dynamically adding a status ('Live' or 'Off-Platform') based on market_pulse_hotel_id. Powers the entire Portfolio Overview page.

POST /api/rockenue/portfolio: Adds a new "Off-Platform" asset directly to the rockenue_managed_assets table (sets market_pulse_hotel_id to NULL).

PUT /api/rockenue/portfolio/:id: Updates the monthly_fee for any asset in the rockenue_managed_assets table.

DELETE /api/rockenue/portfolio/:id: Deletes an asset only if it's "Off-Platform" (market_pulse_hotel_id IS NULL). Prevents accidental deletion of live, synced properties.

4. Impact & Workflow:
Main App Unaffected: The core hotels table remains the source of truth for live application data. "Off-platform" assets are invisible to the main app, Admin Panel (except the toggle), comp sets, etc.

Staff Workflow: Staff continue using the Admin Panel toggle to enable Rockenue Hub features for live hotels.

Super Admin Workflow: Uses the new private "Portfolio Overview" page to:

View combined MRR/ARR for all assets.

Set/update monthly_fee for live hotels (after they are auto-synced by the cron job).

Manually add, manage, and set fees for "off-platform" hotels.

Next Steps (Next Session):

Resolve the React hook error (TypeError: Cannot read properties of null (reading 'useState')) currently blocking the App.tsx component from rendering.

Connect the PortfolioOverview.tsx frontend component to the newly created backend API endpoints (GET, POST, PUT, DELETE /api/rockenue/portfolio).

Changelog: October 29, 2025 (Late Session)
Task: Fully integrate the "Rockenue Portfolio Overview" page, resolve all backend and frontend bugs, and implement full row-editing functionality.

Progress:

Backend 500 Error (Fixed): Resolved the critical 500 Internal Server Error that was crashing the page on load. This was traced to an inconsistent database access pattern in rockenue.router.js. All new endpoints (/api/rockenue/portfolio) were refactored to use the project's standard pool.query() method, which immediately stabilized the API.

Static CSS Build Bugs (Fixed): Fixed all styling issues where the yellow KPI boxes and the "Add New Property" button were unstyled. This was a known static CSS build limitation. The fix was implemented by replacing the failing Tailwind classes (e.g., bg-[#faff6a], font-mono) with inline style attributes, as per the established workaround.

Currency Update: The component was updated to format all monetary values (MRR, ARR, Monthly Fee) in GBP (£).

Build Error (Fixed): Corrected a JSX syntax error (</Erow>) in PortfolioOverview.tsx that was preventing the component from rendering.

Resolution of Previous Issue (Full Row Editing Implemented):

Problem: The previous implementation only allowed editing the monthlyFee for a property. Clicking "Add New Property" created a row where all other fields were static and un-editable.

Solution: This limitation is now fully resolved with a complete backend and frontend upgrade.

Backend: The PUT /api/rockenue/portfolio/:id endpoint in rockenue.router.js was upgraded to accept all asset fields (hotelName, city, totalRooms, group), not just the fee.

Business Logic: The backend now enforces the core business rule: "Live" assets can only have their monthlyFee updated, while "Off-Platform" assets are fully editable.

Frontend: PortfolioOverview.tsx was refactored with a full row-edit mode. Clicking "Edit" now correctly turns all relevant fields into inputs, respects the "Live" vs. "Off-Platform" logic, and calls the upgraded endpoint to save all changes.