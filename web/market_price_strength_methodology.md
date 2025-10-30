## 12) Market Price Strength Score (Final Methodology)

**Purpose:**  
To measure *relative market pricing intensity* over time — even when absolute ADR values are not required — we define the **Market Price Strength Score (MPSS)**.

---

### **Definition**
For each `checkin_date` within a single scrape batch:

1. **Weighted Average Price (WAP£)** is calculated from the 50-bar histogram:
   \[
   WAP = \frac{\sum_i (height_i \times midpoint_i)}{\sum_i height_i}
   \]
   where  
   \[
   midpoint_i = L + \frac{i}{N}(H - L)
   \]
   and `L` / `H` are the slider's min–max price anchors, and `N` = number of bars (typically 50).

2. Determine the **global min and max WAP** across all check-in dates in the same scrape batch:
   \[
   W_{min} = \min(WAP_{all}), \quad W_{max} = \max(WAP_{all})
   \]

3. Normalize each day's WAP into a **0–100 scale**:
   \[
   \text{Market Price Strength Score} = 100 \times \frac{WAP - W_{min}}{W_{max} - W_{min}}
   \]

---

### **Interpretation**
- **0** = weakest / cheapest market day.  
- **100** = strongest / most expensive / compressed day.  
- Intermediate values show *relative price strength* across the analyzed period.

This score serves as a **Market Price Index**, expressing how expensive or tight the market is without needing absolute ADR data.

---

### **Why this works**
- Leverages Booking.com’s full price distribution (50-bar histogram) for each date.  
- Anchored by the site's actual slider min/max, ensuring realistic price scaling.  
- Min–max normalization transforms absolute WAPs into an intuitive, comparable range.  
- Reflects true **market pressure** and pricing momentum over time.

---

### **Practical notes**
- Always compute MPSS **within one scrape batch** (`scraped_at::date` constant).  
- Do **not** mix different scrape dates (avoids cross-time distortions).  
- Can be paired with supply data (`total_results`) to visualize both **price intensity** and **availability compression**.  
- Optional advanced metric:  
  \[
  \text{Market Pressure Index} = MPSS \times (1 / \text{normalized availability})
  \]
  to capture both demand and price movement together.

---

### **Summary formula**
\[
MPSS = 100 \times \frac{WAP - W_{min}}{W_{max} - W_{min}}
\]
with  
\[
WAP = \frac{\sum_i (height_i \times midpoint_i)}{\sum_i height_i}
\]

---

**Outcome:**  
A scalable, currency-agnostic metric expressing *how expensive or strong the market is* on any given day, relative to others in the same data batch.

