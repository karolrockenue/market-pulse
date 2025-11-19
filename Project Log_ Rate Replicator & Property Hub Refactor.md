Project Log: Rate Replicator & Property Hub Refactor
Date: November 18, 2025 Feature Codename: "Rate Replicator" Target Page: Property Hub (Frontend) Status: ✅ Stable & Verified

1. The Problem (Why we started)
Revenue managers struggle to predict the final "sell rate" that appears on OTAs (like Booking.com) because of complex, stacking discounts. A base rate of £100 in the PMS does not mean £100 on the channel. The strategic multiplier and various discounts (Genius, Mobile, Campaigns) distort the final price.

2. The Goal
Build a real-time "Two-Way What-If Calculator" directly inside the Property Hub.

No Scraping: Pure math based on known rules.

Two-Way Logic: Forward (PMS -> Sell) and Backward (Target Sell -> Required PMS).

Visual Trust: Show the exact "waterfall" of discounts so the user trusts the math.

3. Work Completed
Phase 1: UI Architecture
We successfully transformed the PropertyHubPage.tsx into a complex tool.

Accordion Drawer: Replaced row-level saves with a spacious "Manage" drawer for every hotel.

Hybrid Design: Merged real hotel data with a high-fidelity UI prototype.

Phase 2: The "Rate Replicator" Engine
We built the core calculator engine inside the accordion.

Split-Screen Layout: Rules (Left) vs. Simulator (Right).

Date Awareness: Integrated date-fns to ensure temporal campaigns (like "Late Escape") only apply if the "Test Stay Date" falls within the window.

Phase 3: Logic Verification & Backend Wiring
We successfully reverse-engineered the OTA pricing logic and connected it to the database.

"Daisy Chain" Math: We abandoned the initial "Additive" hypothesis after proving it false. We implemented the correct "Sequential Stacking" logic verified against live Booking.com screenshots.

Visual Cascade: The UI now correctly renders the calculation steps (Multiplier -> Non-Ref -> Genius -> Campaign -> Mobile), displaying the exact math to the penny.

Persistence: The application now correctly saves and loads all calculator settings (Multipliers, active campaigns, percentages) from the database.

4. Current Status
Frontend: ✅ 100% Complete. The UI is fully interactive, responsive, and matches the Figma prototype.

Backend: ✅ Complete. Database connections are working. The saveAssetChanges function successfully persists complex calculator configurations (JSONB) to the backend.

Math Engine: ✅ Verified. The calculator matches live OTA rates exactly.

5. The Verified Logic Model (The "Daisy Chain")
Following extensive testing against live data, we have codified the specific hierarchy of how discounts stack. This is now the single source of truth for the engine:

1. Level 0: The Base

PMS Rate × Multiplier = Raw Base.

2. Level 1: Rate Plan (Base Modifier)

The Non-Refundable discount applies first to the Raw Base.

Formula: Raw Base × (1 - NonRef%).

3. Level 2: The Sequential Stack Discounts do not sum up (e.g., 15% + 10% ≠ 25%). They cascade:

A. Genius: Applies to the Level 1 price.

B. Campaigns: (e.g., Late Escape, Early Booker) Apply to the post-Genius price.

C. Targeting: (e.g., Mobile, Country Rates) Apply to the post-Campaign price.

4. Exclusive Overrides (Deep Deals)

If a "Deep Deal" (e.g., Black Friday) is active, it triggers a "Fork."

It applies directly to the Level 1 price and blocks all Level 2 discounts (Genius, Mobile, etc.).

6. Next Steps
Production Deployment: Final code review and merge.

User Testing: Release to a small group of revenue managers to validate the "Backward Calculation" workflow in real-world scenarios.

