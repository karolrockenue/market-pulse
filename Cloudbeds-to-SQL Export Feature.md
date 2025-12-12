# **Project Blueprint: "Cloudbeds-to-SQL" Export Feature**

## **1\. Project Objective**

**Goal:** Implement a generic "Fetch Reservations" button within the **Sentinel Market Pulse** application. **Action:** When clicked, the system must:

1. Call the **Cloudbeds API** to retrieve reservation data for a specific property.  
2. Parse and transform the JSON response.  
3. **Insert or Update** the records into a specific SQL staging table (`reservations_export_staging`).

**Purpose:** To prepare a clean, standardized dataset for downstream Revenue Management (RM) analysis on a DGX Python environment.

---

## **2\. Database Specification**

We are creating a single "flat" table. This table acts as the bridge between the raw API data and the Data Science team.

* **Table Name:** `reservations_export_staging`  
* **Database Engine:** \[Insert your DB type here, e.g., PostgreSQL / MySQL\]

### **The SQL Schema (Copy-Paste this)**

SQL  
CREATE TABLE reservations\_export\_staging (  
    \-- PRIMARY KEYS & IDs  
    reservation\_id          VARCHAR(50) PRIMARY KEY, \-- Cloudbeds unique ID  
    hotel\_id                VARCHAR(50) NOT NULL,    \-- To distinguish properties  
    third\_party\_identifier  VARCHAR(100),            \-- OTA Booking ID (e.g., Booking.com ID)

    \-- DATES (CRITICAL FOR PACING CURVES)  
    booking\_date            TIMESTAMP NOT NULL,      \-- When the button was clicked? No, when the guest booked.  
    check\_in\_date           DATE NOT NULL,           \-- Format YYYY-MM-DD  
    check\_out\_date          DATE NOT NULL,           \-- Format YYYY-MM-DD  
    cancellation\_date       TIMESTAMP NULL,          \-- NULL if active

    \-- REVENUE & METRICS  
    status                  VARCHAR(20) NOT NULL,    \-- 'confirmed', 'canceled', 'checked\_in'  
    total\_revenue           DECIMAL(10, 2\) DEFAULT 0,-- Pure numeric, no currency symbols  
    currency\_code           VARCHAR(3) DEFAULT 'USD',  
    room\_count              INT DEFAULT 1,  
      
    \-- SEGMENTATION  
    rate\_plan\_id            VARCHAR(50),             \-- Internal ID for the rate  
    room\_type\_id            VARCHAR(50),             \-- Internal ID for the room  
    channel\_source          VARCHAR(50),             \-- e.g., 'Booking.com', 'Expedia', 'Direct'  
    guest\_country           VARCHAR(5),              \-- ISO 2-char code (e.g., 'US', 'GB')

    \-- COMPLEX DATA (For advanced Python processing)  
    daily\_rates\_json        TEXT,                    \-- JSON string of daily price breakdown  
      
    \-- METADATA  
    last\_updated\_at         TIMESTAMP DEFAULT CURRENT\_TIMESTAMP  
);

---

## **3\. Field Dictionary: The "What" and "Why"**

This section explains to the developer (or AI) *why* we need each field, ensuring they map the API response correctly.

| Field Name | Description | Why we need it (The "Why") |
| :---- | :---- | :---- |
| **`reservation_id`** | The unique ID from Cloudbeds. | **De-duplication.** If we pull data twice, we use this to update the existing row instead of creating a duplicate. |
| **`booking_date`** | Timestamp of creation. | **Pacing Analysis.** We calculate "Lead Time" (Check-in minus Booking Date) to see if people are booking earlier or later than usual. |
| **`check_in_date`** | Arrival date (ISO 8601). | **Forecasting Target.** This is the primary axis for all revenue forecasts. |
| **`check_out_date`** | Departure date. | **Length of Stay (LOS).** We calculate LOS (`check_out` \- `check_in`) to filter out anomalies (e.g., 30-day stays). |
| **`status`** | Booking status. | **Filtering.** The AI model must *exclude* 'canceled' bookings when calculating committed revenue, but *include* them when calculating cancellation probability. |
| **`total_revenue`** | Total booking value. | **ADR Calculation.** Used to calculate Average Daily Rate (Revenue / Length of Stay). |
| **`channel_source`** | Where the booking came from. | **Channel Mix.** To analyze if high-value guests come from OTAs or Direct booking. |
| **`daily_rates_json`** | JSON blob (e.g., `{"2025-12-08": 100, "2025-12-09": 120}`). | **Granularity.** A reservation spans multiple days. We need the specific price *per night* to attribute revenue to the correct calendar month/day. |

Export to Sheets  
---

## **4\. Implementation Logic (Rules for the AI)**

**1\. The "Fetch" Strategy:**

* **API Endpoint:** Use the Cloudbeds `getReservations` endpoint.  
* **Parameters:**  
  * `hotel_id`: \[Dynamic based on user selection\]  
  * `status`: Fetch *all* statuses (confirmed, canceled, checked\_in). We need canceled data for ML training.

**2\. The "Upsert" Logic (Idempotency):**

* *Do not just blindly INSERT.*  
* Use an **Upsert** (Insert... ON DUPLICATE KEY UPDATE) strategy.  
* **Logic:**  
  * If `reservation_id` "12345" does not exist → **INSERT**.  
  * If `reservation_id` "12345" already exists → **UPDATE** the `status`, `total_revenue`, and `last_updated_at` fields.  
  * *Why?* If a guest modifies their booking (e.g., extends stay or cancels), the database must reflect the latest state.

**3\. Data Cleaning (Before SQL Insert):**

* **Dates:** Convert all Cloudbeds API dates (often messy strings) to strictly `YYYY-MM-DD`.  
* **Money:** Strip currency symbols (e.g., convert `"$1,200.50"` → `1200.50`).  
* **JSON:** If the API returns daily rates as an object/array, verify it is a valid JSON string before inserting into `daily_rates_json`.

