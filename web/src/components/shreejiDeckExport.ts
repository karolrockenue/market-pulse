// Shreeji deck data export — one XLSX workbook with every number + every
// source block in the deck, so investors can edit in Excel / Google Sheets.
// The deck itself still reads its data from the inline useMemo constants;
// this export re-materialises them for a portable, editable file.

import * as XLSX from "xlsx";

export interface ShreejiHotelRow {
  name: string;
  adr24: number; adr25: number; adrChg: number;
  rev24: number; rev25: number; revChg: number;
  occ24: number; occ25: number;
  rooms: number;
}

export interface MarketHotelRow {
  name: string;
  cat: string;
  adr24: number; adr25: number; adrChg: number;
  occ24: number; occ25: number;
}

export interface MonthlyAdrRow {
  month: string;
  s24: number; s25: number;
  m24: number; m25: number;
}

// Per-slide narrative — distilled into plain text so it opens cleanly
// in a spreadsheet cell. Edits here must be ported back to ShreejiDeck.tsx
// by hand (or later, via a re-import round-trip — not built yet).
const NARRATIVE = [
  {
    slide: 0,
    label: "Title",
    heading: "Shreeji Hotels — Portfolio Performance Report",
    body:
      "Comparative Market Analysis: 2024 vs 2025. This report benchmarks the Shreeji portfolio of 10 London hotels against 15 comparable independent properties tracked via Market Pulse. The analysis covers the full 2024–2025 period, measuring occupancy, ADR, RevPAR, and revenue performance against a backdrop of a softening market supported by wider industry data from Booking.com, PwC, Knight Frank, and other leading sources. Note: the Shreeji group today operates a larger portfolio than the 10 properties analysed here; this report focuses on properties with at least two full years of data to enable fair year-on-year comparison.",
  },
  {
    slide: 1,
    label: "Executive Summary",
    heading: "Consistent outperformance in a softening market",
    body:
      "The London hotel market has entered a sustained period of softening. RevPAR across comparable independent hotels declined approximately 6% from 2023 to 2024, and early 2026 data from Booking.com indicates the market is tracking another ~6% decline year-on-year — a compounding pattern that shows no sign of reversing. PwC's UK Hotels Forecast projects London RevPAR growth of just 1.8% in nominal terms for 2026, which in real terms represents stagnation. Against this backdrop, the Shreeji portfolio of 10 London hotels has delivered a fundamentally different performance profile. Where the wider market is contracting and comparable hotels saw ADR fall by an average of -6.9%, Shreeji held its average ADR flat at £122 — a £24 premium over the comp set — while maintaining near-full occupancy and stable total revenue.",
  },
  {
    slide: 1,
    label: "Executive Summary — Methodology",
    heading: "Methodology",
    body:
      "This analysis compares 10 Shreeji properties with at least two full years of operating data against 15 comparable independent London hotels across Economy, Midscale, and Upper Midscale categories. The comp set is sourced from Market Pulse. Shreeji portfolio data is sourced from internal records. Comparable hotel data is derived from Market Pulse's live PMS and channel-data integrations. Wider market context draws on industry studies from Booking.com, PwC UK Hotels Forecast, Knight Frank, HVS, VisitBritain, UKHospitality, and the Deloitte Corporate Travel Survey. All comparisons are like-for-like where possible, using matched months with data available in both 2024 and 2025 to ensure fair year-on-year measurement.",
  },
  {
    slide: 2,
    label: "Section 1 — Market Context",
    heading: "A market that keeps softening, year after year",
    body:
      "The London hotel market is now in its second consecutive year of real-terms decline. RevPAR across comparable independent hotels fell approximately 6% from 2023 to 2024, and Booking.com data for early 2026 shows the market declining by a further ~6% year-on-year. This is not a one-off correction — it is a compounding trend. PwC's UK Hotels Forecast projects London RevPAR growth of just 1.8% in nominal terms for 2026; adjusted for inflation, this represents flat to negative real growth. The demand picture is mixed: inbound tourism volume has broadly recovered to pre-pandemic levels but spending in real terms remains at only 91% of 2019 (VisitBritain). Corporate travel, historically the backbone of midweek London hotel demand, remains structurally below pre-COVID volumes as remote work and hybrid meetings permanently reduce trip frequency (PwC, Deloitte). Meanwhile, 5,300+ new hotel rooms have been added to London since the start of 2024, with a further pipeline of 86 hotels and 11,155 rooms through 2026 (Knight Frank, HVS) — intensifying competition for a demand pool that is not expanding at the same rate. Operating costs have also risen materially — successive National Living Wage increases and expanded employer NICs have squeezed margins across the sector. However, the more significant story for investors is what this softening market means for relative performance: in an environment where the average London hotel is seeing occupancy, ADR, and RevPAR move backwards, any operator that can hold or grow these metrics is demonstrating genuine competitive strength.",
  },
  {
    slide: 3,
    label: "Section 2 — Shreeji vs Market",
    heading: "Shreeji's performance in context",
    body:
      "The following analysis benchmarks the Shreeji portfolio against 15 comparable London independent hotels tracked via Market Pulse, covering Economy, Midscale, and Upper Midscale categories. In a market declining ~6% year-on-year, Shreeji has not only held its ground but improved on key metrics. Across occupancy, ADR, and RevPAR — the three metrics that matter most to hotel asset performance — the portfolio demonstrates a materially stronger profile than the broader comp set. This is not a marginal edge driven by one or two outperformers; it is a portfolio-wide pattern. Portfolio revenue held stable at +0.5% YoY (£15.88M) — achieved in a market where London-wide RevPAR declined -0.4% (PwC/STR) and comparable hotels saw an average ADR decline of -6.9% per property. Five of ten Shreeji properties delivered positive revenue growth.",
  },
  {
    slide: 4,
    label: "Section 3 — Occupancy Analysis",
    heading: "Occupancy dominance: a structural advantage",
    body:
      "The single most striking finding in this analysis is the occupancy gap between Shreeji and the wider market. Derived from verified revenue and ADR data, the Shreeji portfolio operated at approximately 97% occupancy in 2024 and 94% in 2025 — compared to the market comp set average of 74% and 82% respectively. This represents a 23 percentage point advantage in 2024 and a 12 percentage point advantage in 2025. Every Shreeji property operates at or near full capacity. The portfolio's slight normalisation from ~97% to ~94% is consistent with the broader market softening, but even at the lower bound, Shreeji's occupancy materially exceeds the highest-performing individual hotels in the comp set. It is worth noting that the market comp set's occupancy improvement (+8pp year-on-year) is largely driven by hotels in ramp-up phase during 2024 — properties that were filling from low bases (e.g. 52% to 82%, 49% to 70%) rather than representing established, optimised operations achieving incremental gains.",
  },
  {
    slide: 5,
    label: "Section 4 — ADR Performance",
    heading: "Holding rate in a declining market",
    body:
      "In a market where 87% of comparable hotels experienced ADR declines — and where PwC projects full-year 2025 London ADR to fall -0.5% in nominal terms — Shreeji's average ADR held flat at £122. That may sound unremarkable in isolation, but in context it is a significant result: the average comparable hotel in the comp set saw its ADR fall by -6.9%, and the wider London market has been declining approximately 6% year-on-year. Holding rate in this environment is, in effect, outperformance — and Shreeji's £122 average represents a consistent £24 premium over the market comp set average of £98. Four Shreeji properties delivered positive ADR growth year-on-year: The W14 (+6.6%), Hyde Park Green (+5.1%), St George Victoria (+1.5%), and Maiden Oval (+0.7%). The portfolio's ability to grow rates at its best-performing assets while maintaining near-full occupancy across all properties is a fundamentally different profile to the broader market.",
  },
  {
    slide: 6,
    label: "Section 4 — ADR Performance (continued)",
    heading: "Monthly ADR: a consistent, structural premium",
    body:
      "Two patterns are immediately evident from the monthly ADR chart. First, Shreeji commands a materially higher ADR than the market in every single month — the gap is structural, not seasonal or event-driven. Second, Shreeji's 2025 curve tracks closely to its 2024 baseline, demonstrating rate stability, while the market comp set's 2025 line sits consistently below its 2024 equivalent — reflecting the broad-based rate erosion documented by PwC, Knight Frank, and Savills. Notable observations: Shreeji's strongest rate months (June, July, December) align with peak London demand periods but achieve materially higher absolute rates than the comp set during the same periods. The December 2025 uptick (£148 vs £104 market) suggests strong festive-season positioning. Conversely, low-season months (January, February) show Shreeji holding rates above £88 while the market dips below £76 — indicating resilience even during demand troughs.",
  },
  {
    slide: 7,
    label: "Section 5 — Revenue Performance",
    heading: "Portfolio revenue performance",
    body:
      "Total portfolio revenue held stable at £15.88 million (+0.5% YoY) — a result that, while modest in isolation, takes on significance against a London market where RevPAR declined -0.4% and the wider market is tracking ~6% annual declines. Five of ten properties delivered positive revenue growth, led by Hyde Park Green (+10.5%), The W14 (+8.8%), Maiden Oval (+7.5%), and St George Victoria (+6.3%). The portfolio's anchor properties — House on Warwick (£2.65M) and The W14 (£2.69M) — together account for over a third of total revenue and both grew year-on-year.",
  },
  {
    slide: 8,
    label: "Section 5 — Portfolio Detail",
    heading: "Property-level performance",
    body:
      "The Shreeji group today operates a wider portfolio than the 10 properties shown in this analysis. This report includes only hotels with at least two full years of operating data to enable fair year-on-year comparison. Portfolio total: 359 rooms across 10 properties. £15.79M revenue in 2024, £15.88M in 2025 (+0.5% YoY).",
  },
  {
    slide: 9,
    label: "Note on Technology",
    heading: "Infrastructure investment",
    body:
      "The performance documented in this report was achieved with the group's legacy technology stack. In late 2025, the Shreeji group undertook a comprehensive upgrade of its core operational technology — migrating to a modern, cloud-based Property Management System and implementing new channel connectivity tools across the portfolio. These upgrades provide real-time inventory synchronisation, improved distribution reach, and significantly more granular control over rate and availability management. Additionally, the group has deployed a proprietary, custom-built AI revenue management system designed exclusively for the portfolio.",
  },
  {
    slide: 10,
    label: "Summary",
    heading: "Summary",
    body:
      "The London hotel market has now posted two consecutive years of ~6% RevPAR decline across comparable independent hotels, with early 2026 data from Booking.com indicating the downward trend is continuing. New supply continues to enter the market, corporate travel demand remains structurally constrained, and 87% of comparable hotels are experiencing falling rates. Against this backdrop, the Shreeji portfolio tells a different story: near-full occupancy, ADR held flat at a £24 premium over the market, stable revenue, and a consistent RevPAR premium. These are not the results of a portfolio riding a rising tide — they are the results of a portfolio outperforming while the tide goes out. The combination of occupancy dominance and rate resilience across 10 properties represents a compelling demonstration of operational strength and embedded demand capture capability.",
  },
];

// All sources cited across the deck, with a description of what each
// contributes. Edits here must be reflected in the on-slide source strings.
const SOURCES = [
  { name: "Shreeji Hotels (internal)", contribution: "Primary portfolio revenue, occupancy, ADR, and room-count data for all 10 properties covered by the analysis." },
  { name: "Market Pulse", contribution: "Live PMS + channel-data integrations providing comp-set hotel performance (15 comparable independent London hotels across Economy, Midscale, Upper Midscale)." },
  { name: "Booking.com", contribution: "Early-2026 market trend data used to identify the further ~6% YoY RevPAR decline across London independent hotels." },
  { name: "PwC UK Hotels Forecast", contribution: "London RevPAR projections (1.8% nominal growth for 2026) and full-year 2025 ADR guidance (-0.5% nominal)." },
  { name: "Knight Frank", contribution: "London hotel pipeline data (86 hotels / 11,155 rooms through 2026) and broader rate-erosion commentary." },
  { name: "HVS", contribution: "Market supply additions (5,300+ new London rooms since start of 2024) and hotel pipeline validation." },
  { name: "UKHospitality", contribution: "Sector cost and operating-margin context (National Living Wage, employer NICs)." },
  { name: "VisitBritain", contribution: "Inbound tourism volume and spending data (real-terms spend at 91% of 2019)." },
  { name: "Deloitte Corporate Travel Survey", contribution: "Structural shift in corporate travel demand — remote work and hybrid meetings permanently reducing trip frequency." },
  { name: "PwC/STR", contribution: "London-wide RevPAR YTD Nov 2025 figure (-0.4%)." },
  { name: "Savills", contribution: "Additional London rate-erosion context (referenced alongside PwC and Knight Frank in monthly-ADR commentary)." },
];

export function exportShreejiDeckWorkbook(opts: {
  shreejiHotels: ShreejiHotelRow[];
  marketHotels: MarketHotelRow[];
  monthlyAdr: MonthlyAdrRow[];
}) {
  const wb = XLSX.utils.book_new();

  // 1. Cover sheet — metadata + how to use
  const coverRows = [
    ["Shreeji Hotels — Portfolio Performance Report"],
    ["Comparative Market Analysis: 2024 vs 2025"],
    [""],
    ["Generated", new Date().toISOString().slice(0, 10)],
    ["Report period", "2024 — 2025"],
    ["Report prepared", "April 2026"],
    ["Produced by", "Market Pulse · Rockenue International Group"],
    [""],
    ["About this workbook"],
    ["This file contains every data point, narrative block, and source citation used in the Shreeji Hotels investor deck."],
    ["Sheets:"],
    ["  Shreeji Hotels     — 10 properties with at least two full years of operating data"],
    ["  Market Comp Set    — 15 comparable independent London hotels (anonymised)"],
    ["  Monthly ADR        — 12-month ADR trend for Shreeji portfolio vs market comp set"],
    ["  Narrative          — prose commentary from each slide"],
    ["  Sources            — data sources and their contribution"],
    [""],
    ["Notes"],
    ["Edit any number or text in place. All figures are GBP (£). Percentages stored as decimals (0.95 = 95%) unless otherwise noted."],
  ];
  const coverWs = XLSX.utils.aoa_to_sheet(coverRows);
  coverWs["!cols"] = [{ wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, coverWs, "Cover");

  // 2. Shreeji hotels
  const shreejiWs = XLSX.utils.json_to_sheet(
    opts.shreejiHotels.map((h) => ({
      "Property": h.name,
      "Rooms": h.rooms,
      "ADR 2024 (£)": h.adr24,
      "ADR 2025 (£)": h.adr25,
      "ADR Chg (%)": h.adrChg,
      "Revenue 2024 (£)": h.rev24,
      "Revenue 2025 (£)": h.rev25,
      "Revenue Chg (%)": h.revChg,
      "Occupancy 2024 (%)": h.occ24,
      "Occupancy 2025 (%)": h.occ25,
    })),
  );
  shreejiWs["!cols"] = [{ wch: 24 }, { wch: 8 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 18 }, { wch: 18 }, { wch: 17 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, shreejiWs, "Shreeji Hotels");

  // 3. Market comp set
  const marketWs = XLSX.utils.json_to_sheet(
    opts.marketHotels.map((h) => ({
      "Property (anonymised)": h.name,
      "Category": h.cat,
      "ADR 2024 (£)": h.adr24,
      "ADR 2025 (£)": h.adr25,
      "ADR Chg (%)": h.adrChg,
      "Occupancy 2024 (%)": h.occ24,
      "Occupancy 2025 (%)": h.occ25,
    })),
  );
  marketWs["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, marketWs, "Market Comp Set");

  // 4. Monthly ADR
  const monthlyWs = XLSX.utils.json_to_sheet(
    opts.monthlyAdr.map((m) => ({
      "Month": m.month,
      "Shreeji 2024 (£)": m.s24,
      "Shreeji 2025 (£)": m.s25,
      "Market 2024 (£)": m.m24,
      "Market 2025 (£)": m.m25,
    })),
  );
  monthlyWs["!cols"] = [{ wch: 8 }, { wch: 17 }, { wch: 17 }, { wch: 17 }, { wch: 17 }];
  XLSX.utils.book_append_sheet(wb, monthlyWs, "Monthly ADR");

  // 5. Narrative
  const narrativeWs = XLSX.utils.json_to_sheet(
    NARRATIVE.map((n) => ({
      "Slide #": n.slide,
      "Section": n.label,
      "Heading": n.heading,
      "Body": n.body,
    })),
  );
  narrativeWs["!cols"] = [{ wch: 8 }, { wch: 32 }, { wch: 48 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, narrativeWs, "Narrative");

  // 6. Sources
  const sourcesWs = XLSX.utils.json_to_sheet(
    SOURCES.map((s) => ({
      "Source": s.name,
      "Contribution": s.contribution,
    })),
  );
  sourcesWs["!cols"] = [{ wch: 32 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, sourcesWs, "Sources");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `shreeji-deck-${today}.xlsx`);
}
