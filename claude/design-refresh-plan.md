# Design Refresh Plan — MPDash3 as Target

## Target
Replicate the MPDash3/Studio mockups across the live application.
Navy color palette, sidebar navigation, band-based layouts.

## Design Tokens (`web/src/styles/tokens.ts`)

```
R.bg         = "#14181D"    // main content background
R.card       = "#1C2228"    // card surfaces
R.border     = "#1E2330"    // structural borders
R.sep        = "rgba(255,255,255,0.04)"  // subtle row separators
R.accent     = "#F3F5F7"    // primary text
R.text       = "#B0B8C4"    // secondary text
R.textMid    = "#7A8494"    // mid gray
R.textDim    = "#4E5868"    // dim labels
R.teal       = "#39BDF8"    // main accent
R.gold       = "#C8A66E"    // headings, event labels
R.heroBg     = "#111519"    // hero/dark band background
R.darkBand   = "#121519"    // sidebar, alternating bands
R.sidebar    = "#0C0E12"    // sidebar deepest
R.green      = "#34D068"    // positive
R.red        = "#ef4444"    // negative
R.cardLight  = "#1E2530"    // lighter card variant
```

Note: Compset Intel KPI cards & date pickers use `#38C6BA` (warm teal) hardcoded, matching the V2 mockup.

---

## Progress

### DONE — Infrastructure
- [x] **Step 1**: Shared tokens file (`web/src/styles/tokens.ts`)
- [x] **Step 2**: AppSidebar (`web/src/components/AppSidebar.tsx`) — logo, property selector, collapsible nav groups, user, logout
- [x] **Step 3**: AppTopBar (`web/src/components/AppTopBar.tsx`) — page title, property pill, status dot, notifications
- [x] **Step 4**: App.tsx layout — horizontal flex (sidebar + content column), navy background
- [x] **Step 9**: globals.css — CSS variables updated to navy palette
- [x] **Shared**: DatePickerNav component (`web/src/components/DatePickerNav.tsx`) — custom calendar picker with `#38C6BA` accent

### DONE — Pages Redesigned
- [x] **Dashboard** (HotelDashboard) — month cards with comparison tables, occupancy chart, bookings, demand chart, YTD
- [x] **MarketOutlookBanner** — inline metric, navy style
- [x] **OwnHotelOccupancy** — navy tokens, legend right, period toggle
- [x] **RecentBookings** — navy tokens, subtle row dividers
- [x] **DynamicYTDTrend** — navy tokens, annual performance table
- [x] **Portfolio View** (PortfolioOverview) — KPI strip, matrix, monthly tables all navy
- [x] **Reports Hub** — card grid selector (matching MPReportsHub mockup), gold eyebrow
- [x] **Performance Metrics Report** — navy container, subtle row dividers
- [x] **Year-on-Year Report** — removed fixed bg/grid, navy tokens (single + double quotes)
- [x] **Bookings Report** — removed grid overlay, navy container
- [x] **Monthly Takings Report** — removed minHeight, navy container
- [x] **Shreeji Report** — removed fixed bg/grid, navy container
- [x] **All report sub-components** — ReportTable, ReportControls, RoundedGridReportControls, MetricSelectorChips, FormattingOptions, ReportActions (both inline + Tailwind colors)
- [x] **Demand & Pace** — removed grid overlay, navy palette, chart axes/tooltips
- [x] **Market Profile** — removed grid overlay, navy palette, chart colors
- [x] **Compset Intel** — gold title, `#38C6BA` KPI values, DatePickerNav with Apply button, Sentinel insight teal/gold gradient, Market Context + Tier Distribution matching mockup, ADR chart lines in gold
- [x] **Demand Radar** — swapped local MP palette to R tokens, removed grid overlays
- [x] **Settings** — removed grid overlay, navy cards/tables, subtle row dividers
- [x] **CRM Board** — removed grid overlay, navy palette, all cards/tables
- [x] **Studio mockups** — removed MPSidebar from all (except MPChannelPricingV2), they flow inside real AppSidebar
- [x] **MPCompsetViewV2** — new mockup with date pickers
- [x] **MPControlPanel** — Studio mockup of Control Panel in navy design (V1)
- [x] **MPControlPanelV2** — refined version matching rockenue.com style: #1E2330 borders, #121519 cards, gold section labels, gradient save button, clean grid hotel rows, warmTeal (#38C6BA) accent throughout
- [x] **MPAdminHub** — Studio mockup of Admin Hub: System Health, Manual Report, Hotel Management table, Mews Onboarding with classification tiers, API Explorer with dataset cards + JSON response panel

### DONE — Pages Redesigned (continued)
- [x] **My Rates** (HotelRateWindow) — full navy restyle: page bg, cards, table, inputs, scrollbar. Grid overlays removed. Table matches MPMyRates mockup: 180px labels, 96px columns, no vertical borders, R.sep row dividers, tabular-nums, section left-border accents (teal for AI, warmTeal for editable)
- [x] **Flowcast** (OccupancyVisualizer) — navy restyle: #0C0E12 chart bg, gold occupancy axis labels, R.border bars, teal pickup, 180px chart height, clean legend with R.sep separator
- [x] **Compset Intel** — KPI cards bg R.darkBand, segment value fontWeight 600, chart #38C6BA lines with solid grid, custom Leg markers, Market Context / Tier Distribution / Neighbourhoods as 3 separate R.darkBand cards, Portfolio Summary with Building2 gold icon + HTML table

### DONE — Latest Session (April 2026)
- [x] **My Rates table** (HotelRateWindow) — restyled to match MPMyRates mockup exactly: section-based label colors (textMid for info/guardrails, teal for AI, warmTeal for editable), 3px left borders per section, proper 10px divider rows between sections, removed icons from label cells, removed "Your Rate Controls" separator, occupancy colors warmTeal/text/gold, sell rate warmTeal not green, floor rate textMid not orange, column headers transparent bg
- [x] **Bookings Report** — full restyle: gold eyebrow "REPORTS", 24px bold title, warmTeal subtitle, R.darkBand card with teal dot header, R.sidebar table headers, R.sep row dividers, warmTeal left border on today's row, warmTeal revenue values, R.sidebar detail table in expandable accordion
- [x] **Dashboard → Bookings deep-link** — "View Full Report" on RecentBookings widget now navigates directly to Bookings Report (not Reports Hub). Implemented via `reports:bookings-report` deep-link pattern in handleViewChange + initialReport prop on ReportsHub with useRef guard to prevent useEffect reset
- [x] **Performance Report** — "Displaying daily data from..." accent spans changed from R.teal to R.gold
- [x] **Sidebar navigation** — "Demand & Pace" / "Demand London" replaced with "Demand Radar" under Dashboard. Demand Radar removed from Sentinel admin group
- [x] **Logo** — restyled to match rockenue.com: left bracket #38C6BA, right bracket #C8A66E, text 14px fontWeight 700 letterSpacing 1.4, brackets 26px fontWeight 300, centered with breathing space (28px top padding)
- [x] **Compset Intel heading** — title now R.accent (white), subtitle now R.gold (was reversed)
- [x] **Compset Intel Key Insights** — restyled to match MPCompsetViewV2: gold label outside cards, R.darkBand card bg, TrendingUp/Down icons with teal/gold accents, removed WIN/TIE/LOSS badge pills
- [x] **Compset Intel sidebar** — all 5 sections now have consistent gold headings outside cards: Key Insights, Market Context, Market Position, Tier Distribution, Neighbourhoods. Reordered to match mockup (Market Context moved up, before Market Position). Market Position restyled with teal progress bars on R.sidebar track, no badge pills
- [x] **Tier Distribution** — bar track bg changed from R.darkBand to R.sidebar (was invisible), tier label widened to 100px for long names like "Upper Midscale"
- [x] **Neighbourhoods** — added "Area" / "Hotels" column headers to clarify meaning
- [x] **ChannelPricingConcept.tsx** — fixed pre-existing build error (missing closing div)
- [x] **ChannelPricingConcept.tsx** — waterfall steps now editable: click value to inline-edit (text input, no spinner arrows), click elsewhere on box to toggle on/off, multiplier editable (locked flag no longer blocks value edit), pencil icon removed (clean interaction)
- [x] **Demand Radar** — removed maxWidth 1600px cap, padding matched to mockup (28px 32px), full-width layout. Archanes exception: renders ArchanesInvestorView instead of standard DemandRadarView. Source label shows "Live Airbnb data" for Archanes, currency switches to €
- [x] **Archanes Investor View** — full navy restyle using R tokens, R.darkBand (#121519) tile backgrounds, gold eyebrow, consistent chart/tooltip/axis styling
- [x] **Backend: Airbnb demand radar** — added AIRBNB_CITIES routing in market.service.js: getForwardView and getPaceData query airbnb_availability_snapshots for Archanes, normalise to same response shape as Booking.com (total_listings→total_results, avg_price→weighted_avg_price)

### NOT DONE — Remaining
- [x] **Control Panel** — full navy restyle: #14181D page bg, #121519 cards, #1E2330 borders, #38C6BA (warmTeal) primary accent replacing #39BDF8, gold (#C8A66E) section headers, gradient save button (teal→gold), hotel rows converted to clean 5-column grid (name | autopilot | strategy | status | readiness dots), removed grid overlays/gradients, gold eyebrow "SENTINEL", all badges replaced with subtle text + dots
- [x] **Risk Overview** — full navy restyle with R tokens, palette-only colors
- [x] **Rate Manager** — full navy restyle matching My Rates table, warmTeal accent
- [x] **Shadowfax** — retired and removed (April 2026)
- [x] **Admin Hub** — full navy restyle: #14181D page bg, #121519 cards, #1E2330 borders, #38C6BA accent, gold eyebrow "ADMIN", removed grid overlays/gradients. All 6 sub-components restyled (SystemHealth, ManualReportTrigger, HotelManagementTable, MewsOnboarding, CloudbedsAPIExplorer, ManageCompSetModal)
- [ ] **Landing Page** — still old background/colors (pre-auth page)
- [ ] **Support Page** — still old colors
- [ ] **Modals** (InviteUser, GrantAccess, PropertyClassification, CreateSchedule, ManageSchedules) — still old colors
- [ ] **Shared components** (NotificationBell, ActionListBell, MarketVeil, InitialSyncScreen, NoHotelConnected) — still old colors
- [ ] **Airbnb Availability** — still old colors
- [x] **Archanes Investor View** — full navy restyle: R.bg page bg, R.darkBand (#121519) card bg, R tokens throughout (text, borders, charts, tooltips), gold "Market Intelligence" eyebrow, R.warmTeal median line, PIE_COLORS palette (teal/warmTeal/gold/purple/red), Pie stroke R.darkBand, loading spinner matches global style

### DECISIONS
- `R.teal` stays `#39BDF8` in shared tokens.ts — user-facing pages (Dashboard, Reports, Demand Radar, etc.) still use it
- Control Panel + Admin Hub use `#38C6BA` (warmTeal) as their primary accent — these are admin-only pages and match rockenue.com style
- Compset Intel uses `#38C6BA` locally for KPI cards, date pickers, Apply button, chart lines (matching V2 mockup)
- `R.gold` (`#C8A66E`) used for section eyebrows (Reports Hub), subtitles (Compset Intel), event labels, Flowcast occupancy axis labels, Key Insights trailing indicator
- `#38C6BA` (warmTeal) + `#C8A66E` (gold) = agreed soft pairing for Key Insights (winning/trailing)
- Compset Intel heading white (`R.accent`), subtitle golden (`R.gold`)
- Row dividers use `R.sep` (subtle), structural borders use `R.border`
- No grid overlays anywhere — clean navy backgrounds
- TopNav.tsx kept but unused (AppSidebar replaced it) — can be deleted later
- Logo matches rockenue.com: `(` = #38C6BA, `)` = #C8A66E, text = R.accent 14px 700
- Sidebar: "Demand Radar" is a main nav item (under Dashboard), no longer in Sentinel group
- Compset Intel sidebar sections: all gold headings outside cards, consistent R.darkBand card bg
- Deep-link navigation: `reports:bookings-report` pattern for direct report access from dashboard
- ReportsHub `initialReport` prop with useRef mount guard to prevent hotelId useEffect reset
- Tile/card backgrounds use `R.darkBand` (#121519), NOT `R.card` (#1C2228) — this is the agreed style
- Control Panel hotel rows: 5-column grid (name | autopilot | strategy | status | readiness dots) — no heavy Badge components, plain text + small dots
- Control Panel seasonality: Low=teal, Mid=gold, High=red at very low opacity (0.06 bg, 0.15 border). Labels: "Low (Pressure)", "Mid (Guide)", "High (Trap)"
- Admin Hub + Control Panel: gold eyebrow pattern, no grid overlay backgrounds, gradient teal→gold save button
- Control Panel accordion items: 3px teal left border when enabled, 10px border-radius, subtle border when expanded (rgba(255,255,255,0.06))
- Archanes is an exception city: Airbnb-sourced, renders dedicated ArchanesInvestorView instead of standard Demand Radar
- Channel Pricing waterfall: value editing via single-click on the number, toggle via click on surrounding box area. No pencil icon

## Verification
- `cd web && yarn dev` — check all pages
- Sidebar navigation works
- Property selector works
- Date pickers on Compset Intel work (open/close each other)
- All charts render with correct colors
- No regressions on pages not yet redesigned (they look "old" inside new shell)

## Bug fix workflow
- Production runs from `main` branch
- Design work on `design-refresh` branch
- If bug hits untouched file: switch to main, fix, push, merge back
- If bug hits redesigned file: fix on design-refresh, cherry-pick to main if urgent
