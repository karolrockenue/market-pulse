// Shared mock data for performance-report variations.
// Same numbers across every variant so we compare design, not content.

export const MOCK_REPORT = {
  property: "Mason & Fifth, Westbourne Park",
  city: "London",
  rooms: 331,
  period: "March 2026",
  generated: "20 April 2026",

  headline: {
    revenue: 1_284_562,
    revenueYoY: 0.142,
    adr: 187.40,
    adrYoY: 0.063,
    occupancy: 0.823,
    occupancyYoY: 0.041,
    revpar: 154.20,
    revparYoY: 0.108,
  },

  bySegment: [
    { label: "Direct", revenue: 412_300, share: 0.321, adr: 194.10 },
    { label: "Booking.com", revenue: 496_840, share: 0.387, adr: 182.75 },
    { label: "Expedia", revenue: 198_720, share: 0.155, adr: 179.30 },
    { label: "Corporate", revenue: 112_400, share: 0.087, adr: 168.50 },
    { label: "Other OTA", revenue: 64_302, share: 0.050, adr: 171.80 },
  ],

  byRoomType: [
    { label: "Standard Double", sold: 1_648, adr: 172.40, revenue: 284_035 },
    { label: "Deluxe King", sold: 2_103, adr: 189.70, revenue: 399_139 },
    { label: "Junior Suite", sold: 742, adr: 241.20, revenue: 178_970 },
    { label: "Loft Suite", sold: 418, adr: 286.50, revenue: 119_757 },
  ],

  narrative:
    "March delivered the strongest performance since opening. Direct share continues to build (+4.2pp YoY), with Mobile conversions leading the lift. ADR held through mid-month softness despite wider market compression, suggesting room to test a deeper non-refundable discount in April's shoulder dates.",

  // Day-by-day breakdown for March 2026 — matches the Reports Hub
  // "Monthly Performance" output shape: Date | Occupancy | ADR | RevPAR |
  // Total Revenue, one row per day. Numbers intentionally varied by
  // day-of-week (weekend ADR premium, midweek corporate peaks).
  daily: [
    { date: "2026-03-01", dow: "Sun", occ: 0.728, adr: 172.40 }, // Sun
    { date: "2026-03-02", dow: "Mon", occ: 0.712, adr: 168.90 },
    { date: "2026-03-03", dow: "Tue", occ: 0.852, adr: 184.20 },
    { date: "2026-03-04", dow: "Wed", occ: 0.871, adr: 189.50 },
    { date: "2026-03-05", dow: "Thu", occ: 0.883, adr: 192.30 },
    { date: "2026-03-06", dow: "Fri", occ: 0.914, adr: 208.40 },
    { date: "2026-03-07", dow: "Sat", occ: 0.945, adr: 214.60 },
    { date: "2026-03-08", dow: "Sun", occ: 0.754, adr: 178.10 },
    { date: "2026-03-09", dow: "Mon", occ: 0.698, adr: 171.20 },
    { date: "2026-03-10", dow: "Tue", occ: 0.841, adr: 182.60 },
    { date: "2026-03-11", dow: "Wed", occ: 0.867, adr: 188.90 },
    { date: "2026-03-12", dow: "Thu", occ: 0.876, adr: 190.10 },
    { date: "2026-03-13", dow: "Fri", occ: 0.921, adr: 211.80 },
    { date: "2026-03-14", dow: "Sat", occ: 0.955, adr: 218.40 },
    { date: "2026-03-15", dow: "Sun", occ: 0.782, adr: 180.60 },
    { date: "2026-03-16", dow: "Mon", occ: 0.728, adr: 174.50 },
    { date: "2026-03-17", dow: "Tue", occ: 0.860, adr: 186.70 },
    { date: "2026-03-18", dow: "Wed", occ: 0.884, adr: 192.40 },
    { date: "2026-03-19", dow: "Thu", occ: 0.892, adr: 194.80 },
    { date: "2026-03-20", dow: "Fri", occ: 0.930, adr: 213.90 },
    { date: "2026-03-21", dow: "Sat", occ: 0.964, adr: 221.10 },
    { date: "2026-03-22", dow: "Sun", occ: 0.795, adr: 183.40 },
    { date: "2026-03-23", dow: "Mon", occ: 0.744, adr: 176.80 },
    { date: "2026-03-24", dow: "Tue", occ: 0.868, adr: 188.20 },
    { date: "2026-03-25", dow: "Wed", occ: 0.891, adr: 193.50 },
    { date: "2026-03-26", dow: "Thu", occ: 0.902, adr: 196.70 },
    { date: "2026-03-27", dow: "Fri", occ: 0.942, adr: 216.40 },
    { date: "2026-03-28", dow: "Sat", occ: 0.973, adr: 224.80 },
    { date: "2026-03-29", dow: "Sun", occ: 0.811, adr: 185.90 },
    { date: "2026-03-30", dow: "Mon", occ: 0.761, adr: 178.30 },
    { date: "2026-03-31", dow: "Tue", occ: 0.877, adr: 189.40 },
  ],
};

// ─── Other report datasets ──────────────────────────────────────────

// Year-on-Year: 12 months Revenue / Occupancy / ADR / RevPAR 2025 vs 2026 YTD.
export const MOCK_YOY = [
  { month: "January",  rev25: 782_400,  rev26: 861_200,  occ25: 0.692, occ26: 0.748, adr25: 142.10, adr26: 151.40 },
  { month: "February", rev25: 824_100,  rev26: 918_700,  occ25: 0.715, occ26: 0.771, adr25: 146.80, adr26: 158.20 },
  { month: "March",    rev25: 1_124_320, rev26: 1_284_562, occ25: 0.782, occ26: 0.823, adr25: 176.30, adr26: 187.40 },
];

// Monthly Takings: daily breakdown with gross/net/tax (VAT) splits.
export const MOCK_TAKINGS = [
  { date: "2026-03-01", dow: "Sun", rooms: 241, gross: 41_525, vat: 6_921 },
  { date: "2026-03-02", dow: "Mon", rooms: 236, gross: 39_860, vat: 6_643 },
  { date: "2026-03-03", dow: "Tue", rooms: 282, gross: 51_945, vat: 8_658 },
  { date: "2026-03-04", dow: "Wed", rooms: 288, gross: 54_576, vat: 9_096 },
  { date: "2026-03-05", dow: "Thu", rooms: 292, gross: 56_152, vat: 9_359 },
  { date: "2026-03-06", dow: "Fri", rooms: 303, gross: 63_145, vat: 10_524 },
  { date: "2026-03-07", dow: "Sat", rooms: 313, gross: 67_170, vat: 11_195 },
  { date: "2026-03-08", dow: "Sun", rooms: 250, gross: 44_525, vat: 7_421 },
  { date: "2026-03-09", dow: "Mon", rooms: 231, gross: 39_547, vat: 6_591 },
  { date: "2026-03-10", dow: "Tue", rooms: 278, gross: 50_763, vat: 8_461 },
  { date: "2026-03-11", dow: "Wed", rooms: 287, gross: 54_214, vat: 9_036 },
  { date: "2026-03-12", dow: "Thu", rooms: 290, gross: 55_129, vat: 9_188 },
  { date: "2026-03-13", dow: "Fri", rooms: 305, gross: 64_599, vat: 10_767 },
  { date: "2026-03-14", dow: "Sat", rooms: 316, gross: 69_014, vat: 11_502 },
];

// Bookings (last 14 days) — daily summary with expandable guest rows.
export const MOCK_BOOKINGS_DAYS = [
  {
    date: "2026-04-20", bookings: 12, roomNights: 34, revenue: 6_284.50,
    details: [
      { id: "CB-20931", guest: "Rebecca Hartley",   room: "Deluxe King",    checkIn: "2026-04-22", checkOut: "2026-04-25", nights: 3, source: "Booking.com", rate: 192.40, status: "Confirmed" },
      { id: "CB-20932", guest: "Hiroshi Tanaka",    room: "Standard Double",checkIn: "2026-04-23", checkOut: "2026-04-24", nights: 1, source: "Direct",      rate: 168.00, status: "Confirmed" },
      { id: "CB-20933", guest: "Miriam Oduya",      room: "Junior Suite",   checkIn: "2026-04-26", checkOut: "2026-04-29", nights: 3, source: "Expedia",     rate: 238.00, status: "Confirmed" },
      { id: "CB-20934", guest: "Declan Byrne",      room: "Standard Double",checkIn: "2026-05-01", checkOut: "2026-05-03", nights: 2, source: "Booking.com", rate: 178.20, status: "Cancelled" },
    ],
  },
  {
    date: "2026-04-19", bookings: 9, roomNights: 21, revenue: 4_112.80,
    details: [
      { id: "CB-20918", guest: "Siobhan Crawford",  room: "Deluxe King",    checkIn: "2026-04-24", checkOut: "2026-04-26", nights: 2, source: "Direct",      rate: 189.50, status: "Confirmed" },
      { id: "CB-20919", guest: "Marcos Rivera",     room: "Loft Suite",     checkIn: "2026-04-27", checkOut: "2026-04-30", nights: 3, source: "Booking.com", rate: 284.00, status: "Confirmed" },
    ],
  },
  {
    date: "2026-04-18", bookings: 15, roomNights: 42, revenue: 7_894.60,
    details: [],
  },
];

// Budget Report: month-by-month budget vs actual.
export const MOCK_BUDGET = [
  { month: "January",  budgetRev: 820_000,  actualRev: 861_200,  budgetOcc: 0.72, actualOcc: 0.748, budgetAdr: 148.00, actualAdr: 151.40 },
  { month: "February", budgetRev: 880_000,  actualRev: 918_700,  budgetOcc: 0.74, actualOcc: 0.771, budgetAdr: 152.00, actualAdr: 158.20 },
  { month: "March",    budgetRev: 1_200_000, actualRev: 1_284_562, budgetOcc: 0.80, actualOcc: 0.823, budgetAdr: 182.00, actualAdr: 187.40 },
  { month: "April",    budgetRev: 1_180_000, actualRev: 618_400,  budgetOcc: 0.78, actualOcc: 0.812, budgetAdr: 184.00, actualAdr: 189.00 }, // partial month
];

// Shreeji Portfolio: multi-property aggregate.
export const MOCK_SHREEJI_PORTFOLIO = {
  period: "March 2026",
  hotels: [
    { name: "The Portico Hotel",           rooms: 41, occ: 0.941, adr: 141.00, revenue: 164_002 },
    { name: "The W14 Hotel",                rooms: 65, occ: 0.912, adr: 147.00, revenue: 271_600 },
    { name: "House of Toby",                rooms: 48, occ: 0.958, adr: 122.80, revenue: 174_160 },
    { name: "The 29 London",                rooms: 40, occ: 0.928, adr: 117.50, revenue: 134_200 },
    { name: "Hyde Park Green",              rooms: 20, occ: 0.881, adr: 144.80, revenue:  78_860 },
    { name: "Maiden Oval",                  rooms: 38, occ: 0.989, adr:  94.50, revenue: 110_000 },
    { name: "House on Warwick",             rooms: 56, occ: 0.974, adr: 132.40, revenue: 221_740 },
    { name: "St George Victoria",           rooms: 23, occ: 0.889, adr: 122.00, revenue:  84_260 },
    { name: "Pack & Carriage London",       rooms: 14, occ: 0.971, adr: 118.40, revenue:  49_880 },
    { name: "Tudor Inn Hotel",              rooms: 14, occ: 0.952, adr:  95.00, revenue:  39_520 },
  ],
};

// Portfolio dashboard export: rows for any All-Properties style sheet.
export const MOCK_PORTFOLIO_EXPORT = {
  period: "March 2026",
  group: "Mason & Fifth",
  rows: [
    { property: "Mason & Fifth, Westbourne Park", rooms: 331, occ: 0.823, adr: 187.40, revpar: 154.20, revenue: 1_284_562, yoy: 0.142 },
    { property: "Mason & Fifth, Primrose Hill",   rooms:  60, occ: 0.792, adr: 214.10, revpar: 169.60, revenue:   315_120, yoy: 0.091 },
    { property: "Mason & Fifth, Belsize Park",    rooms:  56, occ: 0.744, adr: 198.75, revpar: 147.87, revenue:   256_942, yoy: 0.058 },
  ],
};

// Pickup report: 14-day forward pace by arrival date.
// rooms_sold is current snapshot; pickup_* is delta vs N days ago.
export const MOCK_PICKUP = [
  { date: "2026-04-21", dow: "Tue", capacity: 331, sold: 268, pickup1: 4,  pickup7: 21, pickup30: 78 },
  { date: "2026-04-22", dow: "Wed", capacity: 331, sold: 276, pickup1: 6,  pickup7: 18, pickup30: 84 },
  { date: "2026-04-23", dow: "Thu", capacity: 331, sold: 284, pickup1: 7,  pickup7: 24, pickup30: 91 },
  { date: "2026-04-24", dow: "Fri", capacity: 331, sold: 296, pickup1: 9,  pickup7: 31, pickup30: 104 },
  { date: "2026-04-25", dow: "Sat", capacity: 331, sold: 312, pickup1: 11, pickup7: 38, pickup30: 118 },
  { date: "2026-04-26", dow: "Sun", capacity: 331, sold: 241, pickup1: 3,  pickup7: 14, pickup30: 62 },
  { date: "2026-04-27", dow: "Mon", capacity: 331, sold: 232, pickup1: 5,  pickup7: 12, pickup30: 55 },
  { date: "2026-04-28", dow: "Tue", capacity: 331, sold: 256, pickup1: 4,  pickup7: 16, pickup30: 68 },
  { date: "2026-04-29", dow: "Wed", capacity: 331, sold: 268, pickup1: 6,  pickup7: 19, pickup30: 74 },
  { date: "2026-04-30", dow: "Thu", capacity: 331, sold: 280, pickup1: 8,  pickup7: 25, pickup30: 82 },
  { date: "2026-05-01", dow: "Fri", capacity: 331, sold: 294, pickup1: 10, pickup7: 33, pickup30: 96 },
  { date: "2026-05-02", dow: "Sat", capacity: 331, sold: 308, pickup1: 12, pickup7: 39, pickup30: 108 },
  { date: "2026-05-03", dow: "Sun", capacity: 331, sold: 238, pickup1: 4,  pickup7: 15, pickup30: 58 },
  { date: "2026-05-04", dow: "Mon", capacity: 331, sold: 225, pickup1: 3,  pickup7: 11, pickup30: 49 },
];
