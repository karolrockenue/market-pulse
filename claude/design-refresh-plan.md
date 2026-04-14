# Plan: Deploy Current + Design Refresh

## Context
The app has several minor fixes on the `shreeji-history-rescale` branch that need to go out first. After that, we want to implement the new design language from the ( MARKET PULSE ) 2026 pitch deck across the application — locally on a feature branch, deployed only when ready.

---

## Phase 1: Ship Current Fixes

1. **Commit & push current branch** — all pending changes on `shreeji-history-rescale`
2. **Merge to main** — PR or direct merge
3. **Deploy** — push main to trigger Railway deploy
4. **Verify** — confirm production is stable

## Phase 2: Create Design Branch

5. **Branch off main** — `git checkout -b design-refresh`
6. Work locally, no deploy until sign-off

## Phase 3: Design Refresh Implementation

The mockups define a consistent section pattern to apply across all pages:

**Design tokens (already in brand guide, just need consistent application):**
- Eyebrow: uppercase, `#6b7280`, 11px, `letter-spacing: 0.1em`
- Hero heading: `#e5e5e5`, 32-40px, weight 600, accent phrase in `#39BDF8`
- Subtitle: `#9ca3af`, 16px
- Cards: `#1a1a1a` bg, `#2a2a2a` border
- KPI values: large accent-colored numbers

### Shared: Create a reusable `SectionHeader` component
```
<SectionHeader
  eyebrow="LIVE DASHBOARD"
  heading="Your hotel's performance,"
  accent="always current"
  subtitle="..."
/>
```

### Pages to update (in priority order):

#### A. Landing Page (`web/src/components/LandingPage.tsx`)
- Hero section with logo + 3 value-prop boxes (FREE, 90 Day, < 5 min)
- "The Challenge" section with 3 red stat cards + 4 pain-point pills
- "Four Pillars" section — 2x2 feature cards with colored dots + tag pills
- Live Dashboard preview (static mockup or real data)
- Compset Intel preview
- Demand Radar preview
- Market Profile preview
- Market Intelligence preview
- Portfolio View preview
- Bespoke Intelligence section (supply map + Developers/Investors/Sellers cards)
- Integrations section (Cloudbeds/Mews/Opera cards)
- "Why Market Pulse" comparison table
- CTA closing section

#### B. Dashboard (`web/src/features/dashboard/`)
- Add eyebrow + hero heading ("Your hotel's performance, **always current**")
- Market outlook banner (green-tinted, demand strengthening + percentage)
- 3-month revenue strip (Last / Current / Next with YoY badges)
- 90-day occupancy + pickup chart (existing, style alignment)

#### C. Compset Intel (new section or update existing)
- Eyebrow + heading ("You vs. your competitive set — **in real time**")
- KPI cards with ranking badges (#3, #5, #4)
- Insight card (natural-language summary with highlighted values)
- Performance vs Compset line chart

#### D. Demand Radar (`web/src/features/sentinel/components/DemandRadar/`)
- Already closely matches mockup — minor style tweaks
- Ensure eyebrow label matches pattern
- Booking behavior section with colored bar charts
- Booking window horizontal bars with zone labels

#### E. Market Profile (`web/src/components/MarketProfile.tsx`)
- Eyebrow + heading ("Know the **shape of your market**")
- 6-KPI strip (Total Listed, Hotels Only, Avg WAP, Weekend Premium, Peak/Cheapest)
- Star rating breakdown (horizontal bars)
- Price bracket distribution (bar chart)
- Price spread & WAP compression chart

#### F. Market Intelligence / Demand & Pace
- Eyebrow + heading ("City-level demand and pricing — live")
- Market badge ("London Market | Live Channel Data")
- Demand chart (stacked colored bars)
- Price Index scatter

#### G. Portfolio View (`web/src/features/dashboard/components/PortfolioOverview.tsx`)
- Eyebrow + heading ("Every property. **One command centre.**")
- 5-KPI strip (Properties, Occ, ADR, Revenue, YoY Growth)
- Hotel table with occupancy progress bars + color coding

## Phase 4: Review & Deploy

7. **Local QA** — test all pages at localhost
8. **PR to main** — create PR with before/after screenshots
9. **Merge + deploy** — push to production via Railway

---

## Key Files

| File | Action |
|------|--------|
| `web/src/components/LandingPage.tsx` | Full redesign |
| `web/src/features/dashboard/components/HotelDashboard.tsx` | Add section headers + revenue strip |
| `web/src/features/dashboard/components/PortfolioOverview.tsx` | Redesign with KPI strip + table |
| `web/src/components/MarketProfile.tsx` | Add section header + KPI strip |
| `web/src/features/sentinel/components/DemandRadar/DemandRadarView.tsx` | Minor style alignment |
| `web/src/components/DemandPace.tsx` | Add section header + market badge |
| NEW: `web/src/components/SectionHeader.tsx` | Shared eyebrow/heading/subtitle component |

## Verification
- Run `cd web && npm run dev` — check every page visually
- Confirm all charts render with correct colors
- Test responsive behaviour on mobile widths
- Compare each page side-by-side with the PDF mockups
