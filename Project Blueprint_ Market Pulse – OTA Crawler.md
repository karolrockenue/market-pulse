### **Project Blueprint: Market Pulse – OTA Crawler**

**Version:** 1.1 **Date:** October 8, 2025

This document outlines a new feature for the Market Pulse application. While this feature will be built and tested as part of the existing application, it **must not** negatively impact or break any current functionality. Therefore, building it in a logical silo is a critical principle of this project to ensure the stability of the core product.

#### **1.0 Purpose & Rationale**

- **Problem:** Hotels require forward-looking visibility into market supply and demand compression without depending on slow or expensive third-party data feeds.
- **Solution:** We will build a lightweight, low-load crawler that captures publicly available, aggregate search result counts from OTA websites. By sampling these counts daily for future dates, we can generate a powerful, low-friction signal for market saturation and demand.

---

#### **2.0 Final Goal & Derived KPIs**

The ultimate goal is to integrate a new set of forward-looking metrics into the Market Pulse application. The raw data collected will power a series of new KPIs for users, including:

- **Availability Index:** A measure of today’s total available properties versus a historical baseline to indicate market compression.
- **Forward Pressure Curve:** A visualization of the Availability Index for upcoming weeks and months (e.g., D+7, D+14, D+30) to identify booking windows and demand spikes.
- **Neighbourhood Tightness:** Heatmaps or tables showing which specific areas of a city are experiencing the most compression.
- **Hotel Mix %:** An analysis of the market composition, showing the share of traditional hotels versus other property types like apartments.

---

#### **3.0 Scope**

The project will start with a focused Proof of Concept (POC).

- **Provider:** Booking.com
- **Initial Destinations:** One pilot city (e.g., London).
- **Search Parameters:** Rolling 120-day horizon, for 1 night and 2 adults.

**Data Points to Collect (POC):**

- Total number of properties available
- Property Type facet counts
- Neighbourhood (District) facet counts
- Property Rating (Star Rating) facet counts

**Future Extension (v1):**

- Capture Price Histogram buckets to create a "median ADR proxy" without needing to scrape individual listings.

---

#### **4.0 Technical Specification & Architecture**

This crawler will be built as an integrated component of the existing Market Pulse application, adhering to its architectural principles and technology stack.

- **High-Level Architecture:** A Vercel Cron Job will trigger a Node.js script daily. This script, using a headless browser, will connect to a proxy service to perform the scrapes. The extracted data will be parsed and saved directly into the project's primary PostgreSQL database.
- **Technology Stack:**
  - **Language:** Node.js (as part of the main application).
  - **Headless Browser:** Playwright (for its resilience and ability to handle modern web applications).
  - **Scheduling:** Vercel Cron Jobs (for daily automated execution).
  - **Database:** PostgreSQL / Neon DB (the application's existing database).
  - **Proxies:** A residential proxy pool with geo-targeting capabilities (e.g., Smartproxy, Oxylabs).
- **Request Strategy:**
  - **Load:** One page load per city per day, with no pagination required.
  - **Throttling:** A randomized delay of 5-10 seconds between requests for a given provider, with a maximum concurrency of 2-3 workers.
  - **Anonymity:** Rotate realistic desktop User-Agents and use a residential proxy pool, aligning the proxy's IP geography with the target market (e.g., UK proxy for London queries).

---

#### **5.0 Data & Schema**

A new table will be added to the existing PostgreSQL database to store the collected data.

**Table: `market_availability_snapshots`**

- `id` (UUID, PK)
- `provider` (TEXT, e.g., 'booking')
- `city_slug` (TEXT, e.g., 'london')
- `checkin_date` (DATE)
- `total_results` (INTEGER)
- `facet_property_type` (JSONB) \- _Example: `{"Hotels": 835, "Apartments": 1090, ...}`_
- `facet_neighbourhood` (JSONB) \- _Example: `{"Westminster Borough": 591, ...}`_
- `facet_star_rating` (JSONB) \- _Example: `{"5 stars": 150, "4 stars": 400, ...}`_
- `scraped_at` (TIMESTAMPTZ)

---

#### **6.0 Implementation Plan: Major Steps**

**Phase 1: Proof of Concept (Pilot)**

1. **Scraper Development:** Build the core Node.js script using Playwright to scrape the four specified data points for a single, hardcoded city and date.
2. **Database Integration:** Create the `market_availability_snapshots` table in the database. Enhance the scraper script to successfully save its results to this table.
3. **Automation:** Create a wrapper script that orchestrates the scraping process for the full 120-day horizon. Configure a Vercel Cron Job to run this script daily.

**Phase 2: Feature Integration**

1. **API Development:** Build API endpoints within the existing Express.js application (e.g., in a new `market-pulse.router.js`) to serve the new data and the derived KPIs.
2. **Frontend Development:** Create new UI components in the Market Pulse dashboard (using Alpine.js) to visualize the Forward Pressure Curve and other metrics for the user.
3. **Monitoring & Alerting:** Implement a monitoring system to ensure a high harvest rate (≥ 95%) and to alert on job failures or a high error rate.

---

#### **7.0 Compliance & Risk Posture**

- **Data Scope:** We will only collect aggregate counts that are publicly visible to any user; no personal data will be scraped or stored.
- **Load Management:** The crawler is designed to be low-load and respectful, with approximately 120 throttled page loads per city per day.
- **ToS Risk:** We acknowledge that scraping may be against the provider's Terms of Service. This risk is mitigated by the extremely light-touch approach, use of proxies, and a commitment to cease activity for any domain upon receiving a takedown request.
- **Isolation:** The scraper service will be kept logically isolated, with all logs scrubbed of sensitive information.

#### **CHANGELOG**

v1.1 - 2025-10-08: POC Scraper Development
Initial Scraper Built: Developed the core Node.js script (api/ota-crawler.js) using Playwright for the Booking.com POC.

Database Schema Created: Successfully created the market_availability_snapshots table in the PostgreSQL database.

Data Extraction Achieved: The script can now reliably extract the primary data point: "Total number of properties available."

Anti-Bot Bypassed: Implemented robust anti-scraping countermeasures, including logic to handle cookie consent banners and the use of a custom User-Agent and viewport to disguise the headless browser.

Dynamic & Verifiable: The script was enhanced to use dynamic dates, allowing for direct, real-time verification of the scraper's accuracy.

v1.2 - 2025-10-08: Advanced Scraper Refinement
Facet Scraping Implemented: The scraper was enhanced to parse and collect two of the three required facet data points: 'Property Types' and 'Neighbourhoods'.

Refactored for Resilience: The scraping logic was significantly refactored to handle multiple, inconsistent UI patterns served by the target site, including nested accordions and dynamic "Show all" buttons.

Full Data Pipeline to Database: The script now successfully saves all collected data (total_results, facet_property_type, facet_neighbourhood) to the market_availability_snapshots table.
Outstanding Task: The 'Star rating' facet is not yet being captured reliably. The final task for the data collection phase of the POC is to fix the locator for this last remaining data point.

v1.3 - 2025-10-08: POC Data Collection Complete & Extension Added
Star Rating Scraper Fixed: The outstanding task from v1.2 was completed. [cite_start]The scraper now reliably captures the 'Star rating' facet by using the correct "Property rating" identifier. [cite: 1]

[cite_start]Price Histogram Implemented: The planned 'Future Extension (v1)' was successfully implemented ahead of schedule. [cite: 1] [cite_start]A new function was added to scrape the price distribution histogram, providing a powerful "median ADR proxy". [cite: 1]

Database Schema Extended: The `market_availability_snapshots` table was updated with a new `facet_price_histogram` column (JSONB) to store the new histogram data.

POC Complete: All data points required for the Proof of Concept—plus the future extension—are now being successfully scraped and saved to the database. The data collection phase is complete.

v1.4 - 2025-10-09: Automation, Resilience & Production Hardening
Automation Loop Implemented: The script was fully refactored to run in an automated 120-day loop, with throttling between requests, to collect the full forward-looking data set. This included centralizing browser and database resource management to ensure stability over long runs.

Historical Data Model Implemented: The data strategy was updated to store a historical record of each day's scrape. This was achieved by creating a unique, functional index on the `scraped_at` date, allowing for daily trend analysis. An upsert logic was implemented to ensure data freshness for multiple runs within the same day.

Scraper Resilience Hardened: The generic `scrapeFacetGroup` function was significantly refactored to be adaptive. It now handles inconsistent UI patterns on the target site, resolving all previously known intermittent failures for the 'Property type' and 'Neighborhood' facets.

Retry Mechanism Added: The main loop was enhanced with an automatic retry mechanism to re-attempt failed scrapes for individual dates, significantly improving the overall data harvest rate against temporary errors.

Phase 1 Complete: With a fully automated, resilient, and production-ready script, all development for Phase 1 is now complete. The crawler is ready for deployment.
Of course. Here is a new changelog entry summarizing today's work and the unresolved deployment issue, formatted to be added to your project blueprint file.

v1.5 - 2025-10-09: Production Deployment & Configuration

Proxy Integration Completed: The ota-crawler.js script was successfully integrated with a residential proxy service to meet the project's anonymity and geo-targeting requirements. This involved securely managing credentials and updating the Playwright browser configuration.

Local End-to-End Testing Successful: The full data pipeline, including the new proxy integration, was successfully tested in a local environment. The script correctly connected, scraped, and saved data to the database.

Vercel Cron Job Configured: The vercel.json file was configured to deploy and run the ota-crawler.js script as a daily scheduled cron job.

Outstanding Issue: Vercel Deployment Blocked
Attempts to deploy the production-ready scraper to Vercel are consistently failing. The deployment process is blocked by a persistent configuration error.

The symptoms are as follows:

The initial deployment attempt failed with a Conflicting functions and builds configuration error, which occurs when vercel.json contains both functions and builds properties.

To resolve this and to support the required maxDuration setting, the vercel.json file was refactored to use the modern functions property exclusively.

All subsequent deployment attempts now fail with a new, persistent error: Error: Function Runtimes must have a valid version, for example 'now-php@1.0.0'.

Multiple, meticulous revisions to the vercel.json file to make the function runtime definitions more explicit have failed to resolve this error. The same error persists regardless of the configuration changes.

The deployment is therefore blocked, preventing the automated scraper from running in the production environment. This issue remains unresolved.

v1.6 - 2025-10-09: Final Architecture Refactor & Runtime Debugging

This phase focused on resolving the persistent Vercel deployment blockers and successfully deploying the OTA crawler to the production environment.

Vercel Deployment Resolution:
The Error: Function Runtimes must have a valid version was exhaustively debugged. The process involved:

Refactoring vercel.json multiple times to conform to modern Vercel standards.

Adding an engines property to package.json to specify the Node.js version.

Adding a build script to install Playwright dependencies.

Diagnosing and ruling out conflicts with Vercel Dashboard settings and legacy now.json files.

The final breakthrough identified the root cause as a combination of an incompatible package structure and an out-of-sync package-lock.json file.

Final Architectural Refactor:
To ensure full compatibility with Vercel's modern infrastructure, a definitive architectural refactor was performed:

The project was converted to a fully serverless pattern by moving the main server.js file to api/index.js.

All configuration files (package.json, vercel.json) were updated to reflect this new structure.

The scraper's dependency stack was upgraded to the industry standard for serverless environments, replacing playwright with a combination of playwright-core and @sparticuz/chromium.

The api/ota-crawler.js script was refactored into a proper Vercel Serverless Function by wrapping its execution in an export default handler.

Current Project State:
The architectural refactor was a success. All previous build and deployment errors are resolved, and the project now deploys successfully to Vercel. The main application is live and operational.

Outstanding Issue: Scraper Runtime Crash
The deployed /api/ota-crawler function is not yet operational.

Symptom: When the function is triggered (either manually via its URL or by the scheduled Cron Job), it immediately crashes and returns a 500 FUNCTION_INVOCATION_FAILED error.

Symptom: The function logs confirm that the crash occurs during the browserType.launch call.

Symptom: The detailed browser logs show the specific cause of the crash is a missing system library: /tmp/chromium: error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory.

The project is now in a stable, deployed state, but the scraper feature remains non-functional due to this final runtime error.

Session updates:

10pm 9 oct
Session Summary
As requested, here is a detailed summary of the debugging steps we took to isolate this issue.

Initial State: The scraper function crashed on Vercel with a libnss3.so: cannot open shared object file error, indicating the Chromium executable couldn't find its system dependencies.

Step 1: Enforce Bundling: We added a build script to package.json. The goal was to force Vercel's build process to execute the @sparticuz/chromium installation script and ensure the browser was included in the final deployment. This is a standard practice for this package on Vercel.

Outcome: The error remained unchanged.

Step 2: Correct Library Path: We modified the browser launch call in ota-crawler.js to set the LD_LIBRARY_PATH environment variable, pointing it to the path supposedly provided by chromium.libraryPath.

Outcome: This produced a new error (headless: expected boolean, got string), which was a positive sign. It indicated we had likely progressed past the library loading issue.

Step 3: Fix headless Parameter: We corrected the invalid headless parameter, changing it back to the boolean true.

Outcome: The libnss3.so error unexpectedly returned, suggesting the previous step's "progress" was misleading and the root issue was more complex.

Step 4 & 5: Isolate with Logging: We added targeted console.log statements around the @sparticuz/chromium initialization calls.

Outcome: These logs provided the critical insight: the executablePath was being created successfully, but the chromium.libraryPath property was undefined. This discovery pinpointed the exact point of failure.

Step 6: Manual Path Override: Based on the undefined path, we manually set the LD_LIBRARY_PATH to /tmp/swiftshader, the known location for the shared libraries.

Outcome: The error still persisted.

Step 7: Final File System Check: Our final diagnostic step was to use Node's fs module to check for the existence of the /tmp/swiftshader directory at runtime.

Outcome: This provided the definitive answer. The log Does /tmp/swiftshader directory exist? false proved that the dependency package is failing to unpack its required libraries, explaining why all previous attempts to reference them had failed.
