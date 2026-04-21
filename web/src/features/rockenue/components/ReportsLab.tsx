import { useState } from "react";
import { REPORT, REPORT_WIDTHS } from "../../../styles/reportTokens";
import { R } from "../../../styles/tokens";
import { MonthlyPerformanceReport } from "./reports-lab/MonthlyPerformanceReport";
import { MonthlyTakingsReport } from "./reports-lab/MonthlyTakingsReport";
import { YearOnYearReport } from "./reports-lab/YearOnYearReport";
import { BookingsReport } from "./reports-lab/BookingsReport";
import { ShreejiPortfolioReport } from "./reports-lab/ShreejiPortfolioReport";
import { BudgetReport } from "./reports-lab/BudgetReport";
import { PortfolioDashboardExport } from "./reports-lab/PortfolioDashboardExport";
import { PickupReport } from "./reports-lab/PickupReport";

type Target = "a4" | "email";

interface Mockup {
  id: string;
  label: string;
  sublabel: string;
  target: Target;
  render: () => JSX.Element;
}

const A4_WIDTH = REPORT_WIDTHS.a4;
const A4_HEIGHT = 1123;

const MOCKUPS: Mockup[] = [
  { id: "monthly-performance", label: "Monthly Performance", sublabel: "Daily occupancy / ADR / RevPAR", target: "a4", render: () => <MonthlyPerformanceReport /> },
  { id: "monthly-takings", label: "Daily Takings", sublabel: "Net / VAT / Gross per day", target: "a4", render: () => <MonthlyTakingsReport /> },
  { id: "year-on-year", label: "Year-on-Year", sublabel: "Month-by-month YoY deltas", target: "a4", render: () => <YearOnYearReport /> },
  { id: "bookings", label: "Bookings", sublabel: "Daily summary + guest details", target: "a4", render: () => <BookingsReport /> },
  { id: "budget", label: "Budget vs Actual", sublabel: "Monthly variance", target: "a4", render: () => <BudgetReport /> },
  { id: "portfolio", label: "Portfolio Dashboard", sublabel: "All-properties export", target: "a4", render: () => <PortfolioDashboardExport /> },
  { id: "shreeji", label: "Shreeji Portfolio", sublabel: "Group-level performance", target: "a4", render: () => <ShreejiPortfolioReport /> },
  { id: "pickup", label: "Pickup & Pace", sublabel: "Forward 14-day pace", target: "a4", render: () => <PickupReport /> },
];

export function ReportsLab() {
  const [activeId, setActiveId] = useState(MOCKUPS[0].id);
  const active = MOCKUPS.find((m) => m.id === activeId) ?? MOCKUPS[0];
  const isA4 = active.target === "a4";
  const width = isA4 ? A4_WIDTH : REPORT_WIDTHS.email;

  return (
    <div style={{ display: "flex", height: "100vh", background: R.bg }}>
      {/* Left picker */}
      <div style={{ width: 240, borderRight: `1px solid ${R.border}`, padding: "20px 14px", flexShrink: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: R.textDim, marginBottom: 12 }}>
          Reports Lab
        </div>
        <div style={{ fontSize: 11, color: R.textDim, lineHeight: 1.5, marginBottom: 20 }}>
          Design canvas for PDF &amp; email reports. Iterate on look &amp; feel; port locked designs to Playwright / MJML templates.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {MOCKUPS.map((m) => {
            const selected = m.id === activeId;
            return (
              <div
                key={m.id}
                onClick={() => setActiveId(m.id)}
                style={{
                  padding: "10px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: selected ? `${R.warmTeal}12` : "transparent",
                  color: selected ? R.accent : R.text,
                  fontSize: 12,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{m.label}</span>
                  <span style={{ fontSize: 9, color: R.textDim, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {m.target}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{m.sublabel}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, fontSize: 10, color: R.textDim, lineHeight: 1.6 }}>
          <div style={{ letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Preview</div>
          <div>Width: {width}px</div>
          {isA4 && <div>Height: {A4_HEIGHT}px (A4 portrait)</div>}
        </div>
      </div>

      {/* Preview canvas */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "48px 24px",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#2a2a28",
        }}
      >
        <div
          style={{
            width,
            minHeight: isA4 ? A4_HEIGHT : undefined,
            background: REPORT.pageBg,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.25)",
            borderRadius: 2,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {active.render()}
        </div>
      </div>
    </div>
  );
}
