# **SENTINEL TRAINING HUB — BLUEPRINT (v5.1)**

## **0.0 PROTOCOL**

### **0.1 Behaviour Rules (AI)**

* **Analyze First:** Do not write code until the context is understood.  
* **Step by Step:** Propose single steps; wait for user confirmation.  
* **No Assumptions:** Ask if data sources or rules are missing.  
* **User is Architect:** You propose options; the user decides.

  ### **0.2 Technical Rules**

* **Granularity is King:** We train on the **Daily Grain** (individual nights).  
* **The Modern Era Rule:** Training data strictly excludes pre-2024 records to avoid "Volume-First" contamination.  
* **The "Lead Room" Proxy:** Demand signals are purified by filtering strictly for Adults \== 2\.  
* **Currency Agnostic:** The Global Model sees "Ratios" (Price relative to average), not raw currency.  
  ---

  ## **1.0 SYSTEM OVERVIEW**

  ### **1.1 The Goal**

To train a **Hybrid Intelligence System** that acts as a "Navigator" based on **Control Theory**.

The system operates within strict bounds:

1. **The Floor (Hard Constraint):** Defined by the **User-Set Base Rate** (sourced from *Market Pulse Sentinel*).  
2. **The Ceiling (Dynamic Constraint):** Defined by the **Dynamic Rate Cap** (Section 5.0).

Between these bounds, it continuously compares **Live Performance** against a **Strategic Pace Curve**.

* **Behind Curve:** The system perceives a deficit $\\rightarrow$ Drops Price (but never below the Market Pulse Floor).  
* **Ahead of Curve:** The system perceives a surplus $\\rightarrow$ Raises Price (up to the Dynamic Ceiling).

  ### **1.2 The Infrastructure**

* **Hardware:** Nvidia DGX (spark-828c).  
* **Core Libraries:** pandas (ETL), torch (Global Brain), matplotlib (Visualization).  
* **Data Flow:** Ingest $\\rightarrow$ Normalize (Daily Grain) $\\rightarrow$ Calculate Caps $\\rightarrow$ Map Strategic Curves $\\rightarrow$ Live Benchmarking.  
  ---

  ## **2.0 FILE STRUCTURE (THE MAP)**

**Root:** /home/sentinel/sentinel-training-hub/

Plaintext

├── datasets/

│ ├── raw\_exports/ \<-- Raw CSVs (Cloudbeds/Booking.com)

│ ├── processed\_training/ \<-- Clean Fuel (unified\_daily\_grain.csv)

│ └── reference/

│ ├── strategic\_pace\_curves.csv \<-- The "Control Logic" File (Pace Targets)

│ ├── dynamic\_rate\_caps.csv \<-- The "Ceiling" File (Calculated Max)

│ └── market\_pulse\_base.csv \<-- The "Floor" File (User Inputs)

│

├── strategy/

│ └── revenue\_strategy.md \<-- Philosophy & Business Rules

│

├── models/

│ └── global\_brain/ \<-- Neural Network artifacts

│

├── etl\_pipeline.py \<-- Normalization Engine

├── build\_strategic\_curves.py \<-- The Curve Generator (Inverse Logic)

├── calculate\_max\_caps.py \<-- The Ceiling Generator (95th% Logic)

└── venv/

---

## **3.0 DATA STRATEGY**

### **3.1 The Input Streams**

* **Raw Reservations:** Filtered for Modern Era (2024+) and 2 Adults. Used to reconstruct booking velocity.  
* **Market Pulse Input:** The manual Base Rate set by the user for each hotel (The Floor).

  ### **3.2 The Transformation: "The Daily Grain"**

We split every reservation into single nights to isolate price sensitivity per date.

* *Input:* Res \#123 | Jan 10-12 | £200 Total  
* *Output:* Jan 10 (£100, Lead Time 30\) \+ Jan 11 (£100, Lead Time 30).

  ### **3.3 The Unified Schema**

* hotel\_id  
* stay\_date  
* booking\_date (Derived lead\_time)  
* price\_paid (Normalized)  
* is\_cancellation (Excluded for revenue analysis)  
* adults (Filtered to 2\)  
  ---

  ## **4.0 LOGIC PILLAR 1: THE "INVERTED CURVE" (THE PACER)**

The core logic of Sentinel is built on the **Inverse Law of Lead Time**. The Strategic Curve is not a prediction of reality; it is a mechanism to manipulate the AI's pricing behavior.

### **4.1 The Core Mechanism**

The System calculates Delta \= Actual\_Occupancy \- Target\_Curve\_Occupancy.

* If Delta is Negative (Behind): **Defensive Mode** $\\rightarrow$ Revert to **Market Pulse Base Rate**.  
* If Delta is Positive (Ahead): **Yielding Mode** $\\rightarrow$ Push Rate upwards.

  ### **4.2 The Inverse Law**

We set the Target Curve to be the **opposite** of the expected market behavior to force the desired pricing outcome.

* **Low Season (Jan-Mar):** We set a **Steep/Early Target**. The AI thinks we are behind, so it holds the Market Pulse Base Rate to capture volume.  
* **High Season (Jun-Aug):** We set a **Flat/Late Target**. The AI thinks we are ahead, so it yields up from the Base Rate immediately.  
  ---

  ## **5.0 LOGIC PILLAR 2: THE DYNAMIC RATE CAP (THE CEILING)**

While the Inverted Curve protects the bottom, the Dynamic Rate Cap ensures the AI does not price itself out of the market or hallucinate unrealistic rates.

### **5.1 The Calculation Scope**

To ensure relevance, the Max Rate is calculated using **strictly clean data**:

1. **Filter 1:** Adults \== 2 (Standard Double Occupancy only).  
2. **Filter 2:** Status \== Confirmed (No Cancellations or No-Shows).

   ### **5.2 The Granularity**

A flat monthly cap is insufficient. We calculate caps based on:

* **Hotel ID** (Specific property performance).  
* **Month** (Seasonality).  
* **Day of Week** (Weekday vs. Weekend demand).

*Example:* "Hotel Alpha's Max Rate for a **Friday in June** is calculated using only historical **Fridays in June**."

### **5.3 The Formula**

We use a percentile approach to filter out outliers, plus a buffer for growth.

$$\\text{Max Rate Cap} \= (\\text{Historical 95th Percentile}) \\times 1.30$$

* **Historical 95th Percentile:** Represents the "Sane High" of the market (ignoring freak outliers).  
* **\+30% Buffer:** Allows the AI room to push prices higher than last year (inflation/demand growth) without spiraling to infinity.  
1. 

