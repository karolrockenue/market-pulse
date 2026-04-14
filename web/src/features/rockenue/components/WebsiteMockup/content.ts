// ── Shared Rockenue content for all V1.x website mockups ──
// Sourced from rockenue.com (live site) and the Master Business Blueprint
// (claude/MASTER BUSINESS BLUEPRINT_ ROCKENUE & MARKET PULSE.md).
// Update this file once and every mockup picks it up.

export const HERO = {
  eyebrow: "Independent hotel operator — London & Dubai",
  headline: "The hotel management company for independent hotels.",
  subheadline:
    "Built as an alternative to global chains, we give independent hotels the systems, expertise, and scale they need — while preserving their identity.",
  primaryCta: "Apply for management",
  secondaryCta: "See our approach",
};

export const NAV_LINKS = ["Services", "Portfolio", "Markets", "Market Pulse", "About"];

export const STATS = [
  { value: "45", label: "Properties under management" },
  { value: "1,866", label: "Rooms across the portfolio" },
  { value: "#1", label: "Independent operator on Booking.com London" },
  { value: "£50M+", label: "Revenue under management" },
];

// Six core services. Items 1-4 verbatim from rockenue.com.
// Items 5-6 split the live site's "Additional Services" bucket so the
// 3-col / 2-col grids fill cleanly.
export const SERVICES = [
  {
    num: "01",
    title: "Full Service Franchise",
    desc:
      "Comprehensive brand and operational support for boutique hotels — tech, pricing, marketing, and guest experience delivered under the Rockenue banner.",
  },
  {
    num: "02",
    title: "Revenue Management",
    desc:
      "Dynamic pricing, distribution, and forecasting built for independent hotels. Automation and human expertise combined to drive stronger performance.",
  },
  {
    num: "03",
    title: "Leasing & Management",
    desc:
      "Turnkey solutions for asset owners. Rockenue leases or manages properties to deliver stable returns with full operational oversight.",
  },
  {
    num: "04",
    title: "Hotel Sales & Purchases",
    desc:
      "We connect buyers and sellers of boutique assets and hotel projects with valuation support, advisory, and strategic market insight.",
  },
  {
    num: "05",
    title: "Brand & Positioning",
    desc:
      "Identity, rate integrity, and competitive positioning across every market — from launch to maturity and ongoing repositioning.",
  },
  {
    num: "06",
    title: "Tech Setup & Market Launch",
    desc:
      "PMS, RMS, channel manager, and BI unified under one operating layer. Built on Market Pulse, our proprietary intelligence platform.",
  },
];

// 9 strategic markets — verbatim from rockenue.com "Strategic Markets / Global Presence".
export const MARKETS = [
  "United Kingdom",
  "United States",
  "United Arab Emirates",
  "Spain",
  "Greece",
  "Turkey",
  "Israel",
  "Poland",
  "Indonesia",
];

export const STEPS = [
  {
    num: "01",
    title: "Submit your property",
    desc: "Tell us about your hotel, location, current performance, and what you want to achieve.",
  },
  {
    num: "02",
    title: "Assessment & audit",
    desc:
      "We evaluate your property against our portfolio criteria: market position, asset quality, and growth potential.",
  },
  {
    num: "03",
    title: "Onboarding",
    desc: "Accepted properties enter a 30-day integration. We connect systems, set strategy, and go live.",
  },
];

export const QUALIFIERS = [
  "3-star or above, minimum 25 rooms",
  "Priority given to our 9 core markets — open to all locations",
  "Full operational handover, not advisory",
  "Property in operational condition or near completion",
];

export const MARKET_PULSE = {
  eyebrow: "Intelligence",
  title: "Market Pulse",
  description:
    "Our proprietary intelligence platform aggregates demand signals, competitor rates, flight search data, and event calendars into a single operational view. Every pricing and distribution decision is data-driven.",
  bullets: [
    "Real-time comp set monitoring across OTAs",
    "Demand forecasting with event-driven signals",
    "Automated rate recommendations refreshed every 15 minutes",
    "Portfolio-wide performance benchmarking 90 days forward",
  ],
  metrics: [
    { label: "Avg. RevPAR uplift Y1", value: "+18%", delta: "vs comp set" },
    { label: "Portfolio occupancy", value: "78.4%", delta: "+3.2pp YoY" },
    { label: "Direct booking share", value: "34%", delta: "+6pp YoY" },
    { label: "Comp set index", value: "112.4", delta: "Index" },
  ],
  miniMetrics: [
    { val: "12+", label: "Data sources" },
    { val: "15 min", label: "Refresh rate" },
    { val: "9", label: "Markets covered" },
  ],
};

export const CTA = {
  title: "Does your property qualify?",
  body: "We partner with hotels ready to grow. Apply today and hear back within 5 business days.",
  primary: "Start your application",
};

export const OFFICES = [
  {
    region: "United Arab Emirates",
    label: "Dubai",
    line: "Rockenue International Group\n5842+632 Grand Stand\nNad Al Sheba 1\nDubai",
  },
];

export const FOOTER = {
  tagline: "The hotel management company for independent hotels.",
  columns: [
    {
      heading: "Company",
      links: ["Approach", "Markets", "Contact"],
    },
    {
      heading: "Services",
      links: [
        "Full Service Management",
        "Leasing & Management",
        "Hotel Sales & Acquisitions",
        "Research & Intelligence",
      ],
    },
    {
      heading: "Resources",
      links: ["Market Pulse", "Apply for Management"],
    },
  ],
  copyright: "© 2026 Rockenue International Group. All rights reserved.",
  legalLinks: ["Privacy", "Terms", "Cookies"],
};
