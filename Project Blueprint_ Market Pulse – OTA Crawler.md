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
