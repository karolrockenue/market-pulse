

# **📘 The Revenue Management Logic Bible (v2.0)**

### **I. THE GOLDEN RULES (Hard Constraints)**

**1\. The Floor Protection Rule (Mid/High Curves)**

**RULE:** WE NEVER drop to Minimum (Floor) Rates on **Mid** or **High** demand curves unless we are within the **last 30 days** (T-30).

* **Corrected Logic:** High demand events and peak seasons generate booking pressure *early*. Dropping to floor rates outside the T-30 window devalues inventory during the prime booking window. We hold rate because the strongest volume (velocity) naturally compresses inside 30 days.

**2\. The Ceiling Protection Rule**

**RULE:** We rarely hit Maximum Rates unless the Delta is significantly positive (we are massively ahead of curve).

* **Logic:** The Max Rate acts as a "Brake." We only apply it to stop the property from selling out too far in advance, preserving the last units for the highest possible yield.

---

### **II. THE PRICING ENGINE: DELTA & BOUNDS**

The system does not pick a random number. It operates strictly within a range \[Ratemin​,Ratemax​\]. Your actual price is a floating point within this range, determined by your **Delta**.

**The Core Formula:**

Pricefinal​=f(Δcurve​,Paceweighted​,Seasonality)

**1\. The Delta (Δ)** This represents your deviation from the ideal booking curve.

Δ=Occupancyactual​−Occupancycurve​

**2\. Positioning Logic (The Slider)** We translate the Delta into a price position.

* **If Δ≈0 (On Curve):** Price sits at the "Reference Rate" (mid-point adjusted for season).  
* **If Δ\<0 (Behind Curve):** Price slides toward Ratemin​.  
  * *Constraint:* On Mid/High curves, the slide stops before hitting Ratemin​ until T-30.  
* **If Δ\>0 (Ahead of Curve):** Price slides toward Ratemax​.

---

### **III. MATHEMATICAL PACE PROJECTIONS (The Validation)**

We do not just look at "historical" pickup. We look at **Velocity** to project where we will land. If the projection hits the target, the price is correct. If it misses, we adjust.

**1\. The Pace Vectors** The system monitors three distinct velocity vectors:

1. v24h​: Pickup in the last 24 hours (Immediate reaction).  
2. v72h​: Pickup in the last 72 hours (Trend stability).  
3. vprice​: Pickup specifically *since the last price change*.  
   * *Logic:* If we dropped rates 12h ago and vprice​ is high, the new price is validated.

**2\. The Projection Formula** We calculate where we will end up if we change nothing.

Occprojected​=Occcurrent​+(vweighted​×Daysremaining​)

*Where vweighted​ is the algorithm's preference (e.g., giving 50% weight to vprice​ to prioritize recent market feedback).*

**3\. The Decision Logic**

* **Scenario A:** Occprojected​\<Target.  
  * *Diagnosis:* Current rate is choking demand.  
  * *Action:* Slide price down toward Min (increase interval size).  
* **Scenario B:** Occprojected​≫Target.  
  * *Diagnosis:* We are selling too fast; leaving money on the table.  
  * *Action:* Slide price up toward Max (increase interval size).

---

### **IV. CURVE BEHAVIOR & INTERVAL AGGRESSION**

The "Curve Type" dictates the **Sensitivity** (how aggressive the price jumps are). We move both Up and Down based on the curve.

| Curve Type | Price Sensitivity | Rate Strategy | Aggression Factor |
| :---- | :---- | :---- | :---- |
| **LOW** | **High Sensitivity** | **Conservative.** We have no strong rate expectations. Increases are small/gentle to avoid killing the fragile demand. | Low (e.g., \+/- 2% to 5%) |
| **MID** | **Balanced** | **Reactive.** If we get pickup, we push rate. If we stall, we correct. We are protecting volume but seeking yield. | Medium (e.g., \+/- 5% to 10%) |
| **HIGH** | **Low Sensitivity** | **Aggressive.** Demand is inelastic. If pace is strong, we make large jumps upward. We resist dropping until absolutely necessary. | High (e.g., \+/- 10% to 20%+) |

Export to Sheets

**Aggression Rule:**

"The stronger the season, the harder we push." Unlike the previous logic, **Aggressive Moves (15-20%)** are not just for distress. On a High Curve, if v24h​ is exploding, we aggressively jump the rate **UP** (e.g., \+20%) immediately to capture the surge.

---

### **V. SUMMARY OF OPERATIONS**

1. **Calculate Delta:** Are we ahead or behind the curve?  
2. **Check Pace:** Is our recent velocity (vprice​) accelerating or decelerating?  
3. **Project Finish:** Will current velocity land us at 100% too early (lost yield) or \<80% (lost volume)?  
4. **Apply Seasonality:**  
   * *Is it High Season?* Apply aggressive interval multiplier.  
   * *Is it Low Season?* Apply conservative interval multiplier.  
5. **Set Price:** Move the rate within the \[Min,Max\] bounds.

