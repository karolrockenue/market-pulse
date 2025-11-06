## **🚀 Feature: New Hotel Dashboard Integration**

Integrated the new Figma-based prototype (`HotelDashboard.tsx`) as the main application dashboard. This refactor moves the application's focus from a single "Us vs. Them" view to a unified summary of performance, market demand, and pacing.

* **New Components**:  
  * Added `web/src/components/HotelDashboard.tsx` as the new main dashboard view.  
  * Added support components `web/src/components/MarketOutlookBanner.tsx` and `web/src/components/DynamicYTDTrend.tsx`.  
* **View Routing (`App.tsx` & `TopNav.tsx`)**:  
  * Refactored the `activeView` state in `App.tsx`. The `'dashboard'` view now renders the new `<HotelDashboard />` component.  
  * The original dashboard (KPI cards, performance chart, etc.) was moved to a new `activeView` state named `'youVsCompSet'`.  
  * Added a "You vs. Comp Set" link to `web/src/components/TopNav.tsx` to navigate to the old dashboard.  
* **Styling Fixes (`HotelDashboard.tsx`, `DynamicYTDTrend.tsx`)**:  
  * Refactored the new components to resolve layout bugs.  
  * Replaced all Tailwind layout classes (e.g., `grid`, `grid-cols-3`, `p-6`, `gap-4`) with inline `style={{ ... }}` props. This is required by the project's static CSS build process.

---

## **🔌 Data Pipeline: Unified Dashboard Endpoint**

Wired the new dashboard to a unified backend endpoint to replace all mock data.

* **Backend (`api/routes/dashboard.router.js`)**:  
  * Created a new, unified endpoint: `GET /api/dashboard/summary`.  
  * This endpoint runs multiple SQL queries and logic blocks in parallel to fetch all data in one request:  
    1. **Performance Snapshot**: (Last/Current/Next Month).  
    2. **Market Outlook**: (Reusing logic from `planning.router.js`).  
    3. **90-Day Demand Chart**: (Reusing logic from `planning.router.js`).  
    4. **Demand Patterns**: (Busiest/Quietest Days).  
    5. **Comp Set Rank**: (Reusing logic from `/api/market-ranking`).  
    6. **Budget Benchmarks**: (Calling `getBenchmarks` from `benchmark.utils.js`).  
* **Frontend (`App.tsx` & `HotelDashboard.tsx`)**:  
  * Added a new `useEffect` hook to `App.tsx` that calls `GET /api/dashboard/summary` when the dashboard is active and property details are loaded.  
  * The resulting `data` and `isLoading` props are passed to `<HotelDashboard />`.  
  * `HotelDashboard.tsx` was fully refactored to remove all mock data objects and render the live data from the `data` prop.

---

## **🚧 Debugging: Server 500 Error (In Progress)**

We are currently blocked by a `500 Internal Server Error` when the frontend calls the new `GET /api/dashboard/summary` endpoint.

To diagnose this, we added debug logs to the backend:

* **File Modified**: `api/routes/dashboard.router.js`  
* **Logs Added**: Placed `console.log` statements inside the `GET /summary` handler:  
  * `[DEBUG] /summary START...` at the beginning of the `try` block.  
  * `[DEBUG] /summary: Running Promise.all()...` before the parallel queries.  
  * `[DEBUG] /summary: Promise.all() COMPLETED.` after the queries.  
  * `[CRASH] /api/dashboard/summary...` inside the `catch (err)` block to log the full error stack.

We then fixed several environment issues that were preventing the server from running correctly and showing these logs:

1. **Issue**: Server not auto-restarting. `npm start` (which runs `node server.js`) was not loading our new code.  
   * **Fix**: Installed `nodemon` (`npm install -g nodemon`) and now run the backend with `nodemon server.js`.  
2. **Issue**: Port conflict. Both the backend (`node`) and frontend (`vite`) were trying to run on port `3000`.  
   * **Fix**: Hardcoded `const PORT = 3001;` in `server.js` to force the backend to port 3001\.  
3. **Issue**: Auth failure. All API calls were failing (including login) because the session cookie was not being proxied.  
   * **Fix**: Modified `web/vite.config.ts` to add `cookieDomainRewrite: 'localhost'` to the `server.proxy` configuration.

### **Current Status**

The development environment is now stable. Can’t seem to be able to get console log errors to appear in backend terminal window

New entry

Successfully debugged and resolved the 500 Internal Server Error on the GET /api/dashboard/summary endpoint. The issue was a series of cascading errors in the backend, which were fixed sequentially.

Error 1: Route Mismatch

Problem: The server was listening for GET /api/summary, but the frontend was calling GET /api/dashboard/summary.

Fix: Updated the route in api/routes/dashboard.router.js from router.get("/summary", ...) to router.get("/dashboard/summary", ...).

Error 2: SQL Parameter Mismatch (code: '42P18')

Problem: Multiple SQL queries (marketOutlookSql, forwardDemandSql) copied from other files were still using $2 for the city_slug parameter, but the new endpoint only provided one parameter ($1).

Fix: Updated all city_slug parameters in the SQL strings to use $1.

Error 3: Server Crash (ERR_HTTP_HEADERS_SENT)

Problem: The catch block was trying to send two res.status(500) responses, crashing the server.

Fix: Removed the redundant res.status(500) call from the catch block.

Error 4: SQL Syntax Error (syntax error at or near "WHERE")

Problem: The forwardDemandSql and demandPatternsSql query strings were missing their FROM market_availability_snapshots clause, likely from a bad copy-paste.

Fix: Re-added the FROM clause to both SQL query variables.

Error 5: Server Crash (date-fns Format Error)

Problem: The date-fns format() function was crashing because it was trying to interpret letters in labels like "(Final)" as date tokens.

Fix: Escaped the text labels by wrapping them in single quotes (e.g., format(date, "MMMM '(Final)'")).

🎨 UI & Logic: Budget Pacing (Resolved)
The budget pacing component in the three snapshot cards (HotelDashboard.tsx) was incorrectly wired to the "Pacing Benchmark" (Occ/ADR) and did not match the Figma prototype.

Backend (dashboard.router.js):

Added a new SQL query to the Promise.all stack to fetch the target_revenue_gross from the hotel_budgets table for the last, current, and next months.

This targetRevenue (or null) is now injected into each of the three snapshot objects.

Frontend (HotelDashboard.tsx):

Removed the old BudgetPacingBar component and all logic related to budgetBenchmark.

Created a new RevenuePacingDisplay component that accepts currentRevenue and targetRevenue.

This component now correctly renders either the "Not configured" button (if targetRevenue is null) or the revenue pacing UI.

Refined the RevenuePacingDisplay component's styling to perfectly match the prototype (gray bar with #9DA3AF fill, colored delta text, correct label layout, full-width alignment, and 2px border markings).

🐞 Known Issues (To Do)
YTD Trend Chart: The <DynamicYTDTrend /> component is still using mock data. The ytdTrend object in the API response is empty and needs to be wired to a new, complex backend query.

Demand Patterns Logic: The "Top 5 Busiest/Quietest Days" tables are displaying incorrect or nonsensical data (e.g., old dates, illogical rankings). The demandPatternsSql and the sorting logic in dashboard.router.js must be reviewed and fixed.