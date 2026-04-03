import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface ShreejiDeckProps {
  onBack: () => void;
}

export function ShreejiDeck({ onBack }: ShreejiDeckProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const BLUE = "#39BDF8";
  const WHITE = "#e5e5e5";
  const GRAY = "#9ca3af";
  const DIM = "#6b7280";
  const BG = "#1a1a1a";
  const SURFACE = "#1d1d1c";
  const BORDER = "#2a2a2a";
  const GREEN = "#10b981";
  const AMBER = "#f59e0b";
  const RED = "#ef4444";
  const TEAL = "#14b8a6";
  const SHREEJI_GOLD = "#d4a017";

  // ─── DATA ────────────────────────────────────────────────────────
  const shreejiHotels = useMemo(() => [
    { name: "The W14", adr24: 104, adr25: 111, adrChg: 6.6, rev24: 2474166, rev25: 2691479, revChg: 8.8, occ24: 100, occ25: 91, rooms: 65 },
    { name: "Hyde Park Green", adr24: 138, adr25: 145, adrChg: 5.1, rev24: 849533, rev25: 938915, revChg: 10.5, occ24: 84, occ25: 88, rooms: 20 },
    { name: "St George Victoria", adr24: 119, adr25: 121, adrChg: 1.5, rev24: 961470, rev25: 1021986, revChg: 6.3, occ24: 96, occ25: 88, rooms: 23 },
    { name: "Maiden Oval", adr24: 95, adr25: 95, adrChg: 0.7, rev24: 1237695, rev25: 1330807, revChg: 7.5, occ24: 94, occ25: 100, rooms: 38 },
    { name: "The 29", adr24: 117, adr25: 114, adrChg: -2.1, rev24: 1746735, rev25: 1742909, revChg: -0.2, occ24: 100, occ25: 92, rooms: 40 },
    { name: "The House on Warwick", adr24: 137, adr25: 133, adrChg: -3.0, rev24: 2635485, rev25: 2645135, revChg: 0.4, occ24: 92, occ25: 97, rooms: 56 },
    { name: "The Portico", adr24: 150, adr25: 141, adrChg: -5.6, rev24: 2309328, rev25: 2145155, revChg: -7.1, occ24: 100, occ25: 101, rooms: 41 },
    { name: "Pack & Carriage", adr24: 125, adr25: 118, adrChg: -5.8, rev24: 677327, rev25: 649651, revChg: -4.1, occ24: 106, occ25: 97, rooms: 14 },
    { name: "The House of Toby", adr24: 134, adr25: 123, adrChg: -8.6, rev24: 2333477, rev25: 2239580, revChg: -4.0, occ24: 98, occ25: 95, rooms: 48 },
    { name: "Tudor Inn", adr24: 110, adr25: 95, adrChg: -13.4, rev24: 568563, rev25: 469456, revChg: -17.4, occ24: 101, occ25: 96, rooms: 14 },
  ], []);

  const marketHotels = useMemo(() => [
    { name: "Hotel A", cat: "Hostel", adr24: 30, adr25: 30, adrChg: -1.4, occ24: 72, occ25: 63 },
    { name: "Hotel B", cat: "Economy", adr24: 119, adr25: 108, adrChg: -9.5, occ24: 52, occ25: 82 },
    { name: "Hotel C", cat: "Economy", adr24: 99, adr25: 95, adrChg: -4.1, occ24: 73, occ25: 82 },
    { name: "Hotel D", cat: "Midscale", adr24: 72, adr25: 76, adrChg: 5.5, occ24: 68, occ25: 81 },
    { name: "Hotel E", cat: "Midscale", adr24: 130, adr25: 145, adrChg: 11.1, occ24: 73, occ25: 79 },
    { name: "Hotel F", cat: "Upper Mid", adr24: 172, adr25: 171, adrChg: -0.6, occ24: 86, occ25: 85 },
    { name: "Hotel G", cat: "Economy", adr24: 106, adr25: 103, adrChg: -2.6, occ24: 83, occ25: 81 },
    { name: "Hotel H", cat: "Upper Mid", adr24: 172, adr25: 163, adrChg: -4.9, occ24: 75, occ25: 79 },
    { name: "Hotel I", cat: "Midscale", adr24: 72, adr25: 65, adrChg: -9.9, occ24: 49, occ25: 70 },
    { name: "Hotel J", cat: "Upper Mid", adr24: 205, adr25: 192, adrChg: -6.1, occ24: 82, occ25: 87 },
    { name: "Hotel K", cat: "Midscale", adr24: 122, adr25: 116, adrChg: -4.2, occ24: 93, occ25: 90 },
    { name: "Hotel L", cat: "Upper Mid", adr24: 213, adr25: 210, adrChg: -1.1, occ24: 69, occ25: 82 },
    { name: "Hotel M", cat: "Midscale", adr24: 119, adr25: 133, adrChg: 11.9, occ24: 68, occ25: 86 },
    { name: "Hotel N", cat: "Midscale", adr24: 138, adr25: 121, adrChg: -12.7, occ24: 87, occ25: 102 },
    { name: "Hotel O", cat: "Midscale", adr24: 121, adr25: 100, adrChg: -17.3, occ24: 77, occ25: 80 },
  ], []);

  const monthlyADR = useMemo(() => [
    { month: "Jan", s24: 89, s25: 88, m24: 73, m25: 71 },
    { month: "Feb", s24: 93, s25: 95, m24: 78, m25: 76 },
    { month: "Mar", s24: 111, s25: 103, m24: 88, m25: 85 },
    { month: "Apr", s24: 121, s25: 108, m24: 95, m25: 91 },
    { month: "May", s24: 134, s25: 121, m24: 102, m25: 98 },
    { month: "Jun", s24: 146, s25: 140, m24: 112, m25: 108 },
    { month: "Jul", s24: 144, s25: 147, m24: 110, m25: 106 },
    { month: "Aug", s24: 119, s25: 119, m24: 95, m25: 92 },
    { month: "Sep", s24: 124, s25: 129, m24: 100, m25: 97 },
    { month: "Oct", s24: 130, s25: 128, m24: 105, m25: 101 },
    { month: "Nov", s24: 128, s25: 125, m24: 102, m25: 99 },
    { month: "Dec", s24: 135, s25: 148, m24: 108, m25: 104 },
  ], []);

  const revenueData = useMemo(() =>
    [...shreejiHotels].sort((a, b) => b.rev25 - a.rev25).map(h => {
      const shorts: Record<string, string> = {
        "The House on Warwick": "Warwick",
        "The House of Toby": "Toby",
        "Hyde Park Green": "Hyde Pk Grn",
        "St George Victoria": "St George",
        "Pack & Carriage": "Pack & Carr",
        "Maiden Oval": "Maiden Oval",
        "The Portico": "Portico",
        "Tudor Inn": "Tudor Inn",
        "The W14": "W14",
        "The 29": "The 29",
      };
      return {
        name: shorts[h.name] || h.name,
        fullName: h.name,
        rev24: Math.round(h.rev24 / 1000),
        rev25: Math.round(h.rev25 / 1000),
        chg: h.revChg,
      };
    })
  , [shreejiHotels]);

  const adrChangeData = useMemo(() => {
    const shreejiSorted = [...shreejiHotels].sort((a, b) => b.adrChg - a.adrChg);
    const marketSorted = [...marketHotels].sort((a, b) => b.adrChg - a.adrChg);
    return { shreeji: shreejiSorted, market: marketSorted };
  }, [shreejiHotels, marketHotels]);

  const occData = useMemo(() =>
    [...shreejiHotels].map(h => ({ name: h.name, occ25: Math.min(h.occ25, 100) })).sort((a, b) => b.occ25 - a.occ25)
  , [shreejiHotels]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(slides.length - 1, s + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(0, s - 1));
      }
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const handlePrint = () => window.print();

  // ─── SHARED COMPONENTS ────────────────────────────────────────────
  const S = ({ children, pad = "0 80px" }: { children: React.ReactNode; pad?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", width: "100%", height: "100%", padding: pad, boxSizing: "border-box", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: "1100px", paddingTop: "20px", paddingBottom: "20px" }}>{children}</div>
    </div>
  );

  const Label = ({ children }: { children: string }) => (
    <p style={{ color: SHREEJI_GOLD, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "10px", fontWeight: 600 }}>{children}</p>
  );

  const GridBG = () => (
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(212,160,23,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,160,23,0.03) 1px, transparent 1px)`, backgroundSize: "64px 64px", pointerEvents: "none" }} />
  );

  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px", ...style }}>{children}</div>
  );

  // Prose paragraph style
  const prose: React.CSSProperties = { color: GRAY, fontSize: "13px", lineHeight: 1.75, marginBottom: "16px", maxWidth: "900px" };
  const proseEmphasis: React.CSSProperties = { color: WHITE, fontWeight: 600 };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div style={{ backgroundColor: "#111", border: `1px solid ${BORDER}`, borderRadius: "6px", padding: "10px 14px", fontSize: "12px" }}>
        <div style={{ color: WHITE, fontWeight: 600, marginBottom: "6px" }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color, marginBottom: "2px" }}>
            {p.name}: {typeof p.value === "number" && p.value > 500 ? `£${p.value.toLocaleString()}k` : p.value}{typeof p.value === "number" && p.value <= 500 ? "" : ""}
          </div>
        ))}
      </div>
    );
  };

  // ─── SLIDES ───────────────────────────────────────────────────────
  const slides = [
    // ═══════════════ SLIDE 0: TITLE ═══════════════
    <div key="title" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", width: "100%", height: "100%" }}>
      <GridBG />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "850px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "28px" }}>
          <span style={{ color: SHREEJI_GOLD, fontSize: "72px", fontWeight: 200, lineHeight: 1 }}>(</span>
          <span style={{ color: WHITE, fontSize: "36px", letterSpacing: "0.06em", fontWeight: 600 }}>SHREEJI HOTELS</span>
          <span style={{ color: SHREEJI_GOLD, fontSize: "72px", fontWeight: 200, lineHeight: 1 }}>)</span>
        </div>
        <p style={{ color: WHITE, fontSize: "26px", fontWeight: 300, lineHeight: 1.5, margin: "0 auto 6px" }}>
          Portfolio Performance Report
        </p>
        <p style={{ color: GRAY, fontSize: "16px", fontWeight: 300 }}>
          Comparative Market Analysis: 2024 vs 2025
        </p>
        <div style={{ margin: "40px auto 0", maxWidth: "760px" }}>
          <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.8, textAlign: "left" }}>
            This report benchmarks the Shreeji portfolio of 10 London hotels against 15 comparable independent properties tracked via Market Pulse. The analysis covers the full 2024–2025 period, measuring occupancy, ADR, RevPAR, and revenue performance against a backdrop of a softening market supported by wider industry data from Booking.com, PwC, Knight Frank, and other leading sources. Note: the Shreeji group today operates a larger portfolio than the 10 properties analysed here; this report focuses on properties with at least two full years of data to enable fair year-on-year comparison.
          </p>
        </div>
        <div style={{ marginTop: "36px", display: "flex", gap: "20px", justifyContent: "center" }}>
          {[
            { n: "10", l: "Properties" },
            { n: "£15.9M", l: "Portfolio Revenue" },
            { n: "~95%", l: "Avg Occupancy" },
            { n: "£122", l: "Avg ADR (flat YoY)" },
          ].map((t) => (
            <div key={t.l} style={{ padding: "14px 24px", border: `1px solid ${BORDER}`, borderRadius: "6px", textAlign: "center" }}>
              <div style={{ color: SHREEJI_GOLD, fontSize: "20px", fontWeight: 600, marginBottom: "4px" }}>{t.n}</div>
              <div style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.l}</div>
            </div>
          ))}
        </div>
        <p style={{ color: DIM, fontSize: "11px", marginTop: "36px" }}>
          April 2026 | Data sources: Shreeji Hotels (internal), Market Pulse, Booking.com, PwC, Knight Frank, HVS, UKHospitality, VisitBritain, Deloitte
        </p>
      </div>
    </div>,

    // ═══════════════ SLIDE 1: EXECUTIVE SUMMARY ═══════════════
    <S key="summary">
      <Label>EXECUTIVE SUMMARY</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Consistent outperformance in a softening market
      </h2>
      <p style={prose}>
        The London hotel market has entered a sustained period of softening. RevPAR across comparable independent hotels declined approximately <span style={proseEmphasis}>6% from 2023 to 2024</span>, and early 2026 data from Booking.com indicates the market is tracking <span style={proseEmphasis}>another ~6% decline</span> year-on-year — a compounding pattern that shows no sign of reversing. PwC's UK Hotels Forecast projects London RevPAR growth of just 1.8% in nominal terms for 2026, which in real terms represents stagnation.
      </p>
      <p style={prose}>
        Against this backdrop, the Shreeji portfolio of 10 London hotels has delivered a <span style={proseEmphasis}>fundamentally different performance profile</span>. Where the wider market is contracting and comparable hotels saw ADR fall by an average of -6.9%, Shreeji held its average ADR flat at £122 — a £24 premium over the comp set — while maintaining near-full occupancy and stable total revenue.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
        <Card>
          <div style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>KEY FINDINGS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { metric: "Occupancy", detail: "Shreeji operates at ~95% — more than 20 percentage points above the market average of ~74%. Every property runs at or near full capacity." },
              { metric: "ADR Resilience", detail: "Shreeji held its average ADR flat at £122 — a £24 premium over the market — while 87% of comparable hotels experienced declining rates (avg -6.9%)." },
              { metric: "RevPAR Premium", detail: "Shreeji's RevPAR of £120 exceeds the market comp set average of £95–102 — a consistent £18–25 premium." },
              { metric: "Revenue Stability", detail: "Combined portfolio revenue: £15.88M (+0.5% YoY), outperforming London's overall RevPAR decline of -0.4%." },
            ].map((f) => (
              <div key={f.metric} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: GREEN, marginTop: "6px", flexShrink: 0 }} />
                <div>
                  <span style={{ color: WHITE, fontSize: "13px", fontWeight: 600 }}>{f.metric}: </span>
                  <span style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6 }}>{f.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>METHODOLOGY</div>
          <p style={{ color: GRAY, fontSize: "12px", lineHeight: 1.7 }}>
            This analysis compares 10 Shreeji properties with at least two full years of operating data against 15 comparable independent London hotels across Economy, Midscale, and Upper Midscale categories. The comp set is sourced from Market Pulse. The Shreeji group today operates a wider portfolio; only properties with sufficient historical data are included to ensure fair comparison.
          </p>
          <p style={{ color: GRAY, fontSize: "12px", lineHeight: 1.7, marginTop: "10px" }}>
            Shreeji portfolio data is sourced from internal records. Comparable hotel data is derived from Market Pulse's live PMS and channel-data integrations. Wider market context draws on industry studies from Booking.com, PwC UK Hotels Forecast, Knight Frank, HVS, VisitBritain, UKHospitality, and the Deloitte Corporate Travel Survey.
          </p>
          <p style={{ color: GRAY, fontSize: "12px", lineHeight: 1.7, marginTop: "10px" }}>
            All comparisons are like-for-like where possible, using matched months with data available in both 2024 and 2025 to ensure fair year-on-year measurement.
          </p>
        </Card>
      </div>
    </S>,

    // ═══════════════ SLIDE 2: MARKET CONTEXT ═══════════════
    <S key="context">
      <Label>SECTION 1 — MARKET CONTEXT</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        A market that keeps softening, year after year
      </h2>
      <p style={prose}>
        The London hotel market is now in its second consecutive year of real-terms decline. RevPAR across comparable independent hotels fell approximately <span style={proseEmphasis}>6% from 2023 to 2024</span>, and Booking.com data for early 2026 shows the market declining by <span style={proseEmphasis}>a further ~6% year-on-year</span>. This is not a one-off correction — it is a compounding trend. PwC's UK Hotels Forecast projects London RevPAR growth of just 1.8% in nominal terms for 2026; adjusted for inflation, this represents flat to negative real growth.
      </p>
      <p style={prose}>
        The demand picture is mixed: inbound tourism volume has broadly recovered to pre-pandemic levels but spending in real terms remains at only 91% of 2019 (VisitBritain). Corporate travel, historically the backbone of midweek London hotel demand, remains structurally below pre-COVID volumes as remote work and hybrid meetings permanently reduce trip frequency (PwC, Deloitte). Meanwhile, 5,300+ new hotel rooms have been added to London since the start of 2024, with a further pipeline of 86 hotels and 11,155 rooms through 2026 (Knight Frank, HVS) — intensifying competition for a demand pool that is not expanding at the same rate.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "14px", marginBottom: "16px" }}>
        {[
          { stat: "~6%", label: "Market RevPAR decline", sub: "2023 → 2024", color: AMBER },
          { stat: "~6%", label: "Further decline tracked", sub: "2025 → 2026 (Booking.com)", color: AMBER },
          { stat: "-0.4%", label: "London RevPAR", sub: "YTD Nov 2025 (PwC/STR)", color: AMBER },
          { stat: "87%", label: "Comp set hotels w/ ADR decline", sub: "Market Pulse data", color: AMBER },
        ].map((item) => (
          <Card key={item.stat + item.sub} style={{ padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 600, color: item.color, marginBottom: "4px" }}>{item.stat}</div>
            <p style={{ color: GRAY, fontSize: "10px", lineHeight: 1.4, marginBottom: "2px" }}>{item.label}</p>
            <p style={{ color: DIM, fontSize: "9px" }}>{item.sub}</p>
          </Card>
        ))}
      </div>
      <p style={prose}>
        Operating costs have also risen materially — successive National Living Wage increases and expanded employer NICs have squeezed margins across the sector. However, the more significant story for investors is what this softening market means for <span style={proseEmphasis}>relative performance</span>: in an environment where the average London hotel is seeing occupancy, ADR, and RevPAR move backwards, any operator that can hold or grow these metrics is demonstrating genuine competitive strength. That is the context in which Shreeji's results should be read.
      </p>
    </S>,

    // ═══════════════ SLIDE 3: HEADLINE COMPARISON ═══════════════
    <S key="headline">
      <Label>SECTION 2 — SHREEJI VS MARKET</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Shreeji's performance in context
      </h2>
      <p style={prose}>
        The following analysis benchmarks the Shreeji portfolio against 15 comparable London independent hotels tracked via Market Pulse, covering Economy, Midscale, and Upper Midscale categories. In a market declining ~6% year-on-year, Shreeji has not only held its ground but improved on key metrics. Across occupancy, ADR, and RevPAR — the three metrics that matter most to hotel asset performance — the portfolio demonstrates a materially stronger profile than the broader comp set. This is not a marginal edge driven by one or two outperformers; it is a portfolio-wide pattern.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {[
          { label: "AVERAGE OCCUPANCY", shreeji: "~95%", market: "~74%", detail: "Shreeji operates at near-full capacity, more than 20 percentage points above the market average. Even in 2025, as the portfolio normalised marginally to ~94%, the gap to the comp set remained a decisive 12 points. In a market adding thousands of new rooms, maintaining this level of occupancy reflects deeply embedded demand.", color: GREEN },
          { label: "AVERAGE ADR", shreeji: "£122", market: "£98", detail: "Shreeji commands a £24 ADR premium over the market and held its rate flat year-on-year, while 87% of comparable hotels saw ADR decline — with the average comp set hotel falling -6.9%. In a market dropping ~6% annually, holding rate is outperformance.", color: GREEN },
          { label: "REVPAR", shreeji: "£120", market: "£95–102", detail: "Revenue per available room — the single most important measure of hotel asset productivity — shows Shreeji consistently commanding an £18–25 premium over the comp set. This gap has persisted across both years of analysis.", color: GREEN },
        ].map((kpi) => (
          <Card key={kpi.label} style={{ padding: "18px" }}>
            <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>{kpi.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "30px", fontWeight: 600, color: SHREEJI_GOLD }}>{kpi.shreeji}</div>
                <div style={{ color: DIM, fontSize: "10px", marginTop: "2px" }}>Shreeji</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: 600, color: GRAY }}>{kpi.market}</div>
                <div style={{ color: DIM, fontSize: "10px", marginTop: "2px" }}>Market</div>
              </div>
            </div>
            <p style={{ color: GRAY, fontSize: "11px", lineHeight: 1.6 }}>{kpi.detail}</p>
          </Card>
        ))}
      </div>
      <div style={{ padding: "14px 20px", backgroundColor: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.15)`, borderRadius: "8px" }}>
        <p style={{ color: GRAY, fontSize: "12px", lineHeight: 1.6, margin: 0 }}>
          <span style={{ color: WHITE, fontWeight: 600 }}>Portfolio revenue held stable at +0.5% YoY (£15.88M)</span> — achieved in a market where London-wide RevPAR declined -0.4% (PwC/STR) and comparable hotels saw an average ADR decline of -6.9% per property. Five of ten Shreeji properties delivered positive revenue growth.
        </p>
      </div>
    </S>,

    // ═══════════════ SLIDE 5: OCCUPANCY DEEP DIVE ═══════════════
    <S key="occupancy" pad="0 60px">
      <Label>SECTION 3 — OCCUPANCY ANALYSIS</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Occupancy dominance: a structural advantage
      </h2>
      <p style={prose}>
        The single most striking finding in this analysis is the occupancy gap between Shreeji and the wider market. Derived from verified revenue and ADR data, the Shreeji portfolio operated at approximately 97% occupancy in 2024 and 94% in 2025 — compared to the market comp set average of 74% and 82% respectively. This represents a <span style={proseEmphasis}>23 percentage point advantage in 2024 and a 12 percentage point advantage in 2025</span>.
      </p>
      <p style={prose}>
        Every Shreeji property operates at or near full capacity. The portfolio's slight normalisation from ~97% to ~94% is consistent with the broader market softening described above, but even at the lower bound, Shreeji's occupancy materially exceeds the highest-performing individual hotels in the comp set. This is not a temporary spike or event-driven compression — it is a sustained, portfolio-wide pattern reflecting embedded demand capture capability.
      </p>
      {/* Comparison bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <Card style={{ padding: "18px" }}>
          <div style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>SHREEJI PORTFOLIO</div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
            <div style={{ flex: 1, height: "24px", backgroundColor: "#2C2C2C", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ width: "95%", height: "100%", background: `linear-gradient(90deg, ${GREEN}, ${TEAL})`, borderRadius: "6px" }} />
            </div>
            <span style={{ fontSize: "24px", fontWeight: 700, color: GREEN, minWidth: "50px" }}>~95%</span>
          </div>
          <span style={{ fontSize: "11px", color: DIM }}>2024: ~97% | 2025: ~94%</span>
        </Card>
        <Card style={{ padding: "18px" }}>
          <div style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>MARKET COMP SET</div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
            <div style={{ flex: 1, height: "24px", backgroundColor: "#2C2C2C", borderRadius: "6px", overflow: "hidden" }}>
              <div style={{ width: "74%", height: "100%", backgroundColor: GRAY, borderRadius: "6px", opacity: 0.6 }} />
            </div>
            <span style={{ fontSize: "24px", fontWeight: 700, color: GRAY, minWidth: "50px" }}>~74%</span>
          </div>
          <span style={{ fontSize: "11px", color: DIM }}>2024: ~74% | 2025: ~82%</span>
        </Card>
      </div>
      {/* Chart */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ color: WHITE, fontSize: "13px", margin: 0, marginBottom: "2px" }}>Shreeji Portfolio — 2025 Occupancy by Property</h3>
          <p style={{ color: GRAY, fontSize: "11px", margin: 0 }}>All properties operating at or near full capacity; market average shown as reference line</p>
        </div>
        <div style={{ padding: "12px 20px", height: "280px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={occData} margin={{ top: 5, right: 30, left: 5, bottom: 5 }} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="0" stroke="#2a2a2a" opacity={0.5} horizontal={false} />
              <XAxis type="number" domain={[0, 105]} stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" stroke="#2a2a2a" tick={{ fill: "#e5e5e5", fontSize: 9 }} width={130} interval={0} />
              <Bar dataKey="occ25" name="2025 Occupancy" radius={[0, 4, 4, 0]}>
                {occData.map((_, i) => <Cell key={i} fill={GREEN} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <p style={{ ...prose, marginTop: "14px", fontSize: "12px" }}>
        It is worth noting that the market comp set's occupancy improvement (+8pp year-on-year) is largely driven by hotels in ramp-up phase during 2024 — properties that were filling from low bases (e.g. 52% to 82%, 49% to 70%) rather than representing established, optimised operations achieving incremental gains.
      </p>
    </S>,

    // ═══════════════ SLIDE 6: ADR DEEP DIVE ═══════════════
    <S key="adr" pad="0 60px">
      <Label>SECTION 4 — ADR PERFORMANCE</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Holding rate in a declining market
      </h2>
      <p style={prose}>
        In a market where 87% of comparable hotels experienced ADR declines — and where PwC projects full-year 2025 London ADR to fall -0.5% in nominal terms — Shreeji's average ADR <span style={proseEmphasis}>held flat at £122</span>. That may sound unremarkable in isolation, but in context it is a significant result: the average comparable hotel in the comp set saw its ADR fall by -6.9%, and the wider London market has been declining approximately 6% year-on-year. Holding rate in this environment is, in effect, outperformance — and Shreeji's £122 average represents a consistent <span style={proseEmphasis}>£24 premium</span> over the market comp set average of £98.
      </p>
      <p style={prose}>
        Four Shreeji properties delivered positive ADR growth year-on-year: The W14 (+6.6%), Hyde Park Green (+5.1%), St George Victoria (+1.5%), and Maiden Oval (+0.7%). These properties demonstrated genuine pricing power in a market where the wider trend has been decisively downward — London has now seen approximately 6% RevPAR declines in each of the last two years (Booking.com, PwC). The portfolio's ability to grow rates at its best-performing assets while maintaining near-full occupancy across all properties is a fundamentally different profile to the broader market.
      </p>
      {/* ADR summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "14px" }}>
        {[
          { label: "Shreeji Avg ADR", val: "£122 → £122", chg: "Flat", note: "Held rate while market declines", color: GREEN },
          { label: "Market Avg ADR", val: "£98", chg: "-6.9%", note: "Avg per-hotel ADR decline", color: RED },
          { label: "Shreeji ADR Premium", val: "£122 vs £98", chg: "+£24", note: "Consistent premium over comp set", color: GREEN },
        ].map((item) => (
          <Card key={item.label} style={{ padding: "16px" }}>
            <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>{item.label}</div>
            <div style={{ fontSize: "14px", color: WHITE, marginBottom: "4px" }}>{item.val}</div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: item.color, marginBottom: "6px" }}>{item.chg}</div>
            <div style={{ fontSize: "11px", color: DIM }}>{item.note}</div>
          </Card>
        ))}
      </div>
      <p style={prose}>
        It is important to note that the portfolio contains properties with varied ADR trajectories. However, the weighted composition means that the properties delivering rate growth are the ones generating the most revenue — a direct consequence of scale and rate discipline. The group is not uniformly raising rates, but the assets with the strongest demand fundamentals are pushing pricing while maintaining occupancy.
      </p>
    </S>,

    // ═══════════════ SLIDE 7: MONTHLY ADR TREND ═══════════════
    <S key="trend" pad="0 60px">
      <Label>SECTION 4 — ADR PERFORMANCE (CONTINUED)</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Monthly ADR: a consistent, structural premium
      </h2>
      <p style={prose}>
        The chart below plots the average ADR by month across both the Shreeji portfolio and the market comp set for 2024 and 2025. Two patterns are immediately evident. First, Shreeji commands a <span style={proseEmphasis}>materially higher ADR than the market in every single month</span> — the gap is structural, not seasonal or event-driven. Second, Shreeji's 2025 curve tracks closely to its 2024 baseline, demonstrating rate stability, while the market comp set's 2025 line sits consistently below its 2024 equivalent — reflecting the broad-based rate erosion documented by PwC, Knight Frank, and Savills.
      </p>
      <Card style={{ padding: "0", overflow: "hidden", marginBottom: "14px", maxWidth: "900px" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ color: WHITE, fontSize: "13px", margin: 0, marginBottom: "2px" }}>Average ADR by Month — Shreeji vs Market Comp Set</h3>
            <p style={{ color: GRAY, fontSize: "11px", margin: 0 }}>Portfolio average ADR per month, 2024 and 2025</p>
          </div>
          <div style={{ display: "flex", gap: "14px" }}>
            {[
              { c: SHREEJI_GOLD, l: "Shreeji 2024", solid: true },
              { c: GREEN, l: "Shreeji 2025", solid: true },
              { c: "#6b7280", l: "Market 2024", solid: false },
              { c: RED, l: "Market 2025", solid: false },
            ].map((lg) => (
              <div key={lg.l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "12px", height: lg.solid ? "3px" : "0", borderRadius: "2px", backgroundColor: lg.solid ? lg.c : "transparent", borderTop: lg.solid ? "none" : `2px dashed ${lg.c}` }} />
                <span style={{ fontSize: "9px", color: DIM }}>{lg.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "12px 20px", height: "190px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyADR} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={10} tickLine={false} tickFormatter={(v: number) => `£${v}`} domain={[50, 160]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="s24" stroke={SHREEJI_GOLD} strokeWidth={2.5} name="Shreeji 2024" dot={{ fill: SHREEJI_GOLD, r: 3 }} />
              <Line type="monotone" dataKey="s25" stroke={GREEN} strokeWidth={2.5} name="Shreeji 2025" dot={{ fill: GREEN, r: 3 }} />
              <Line type="monotone" dataKey="m24" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" name="Market 2024" dot={false} />
              <Line type="monotone" dataKey="m25" stroke={RED} strokeWidth={2} strokeDasharray="5 5" name="Market 2025" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <p style={{ ...prose, fontSize: "12px" }}>
        Notable observations: Shreeji's strongest rate months (June, July, December) align with peak London demand periods but achieve materially higher absolute rates than the comp set during the same periods. The December 2025 uptick (£148 vs £104 market) suggests strong festive-season positioning. Conversely, low-season months (January, February) show Shreeji holding rates above £88 while the market dips below £76 — indicating resilience even during demand troughs.
      </p>
    </S>,

    // ═══════════════ SLIDE 8: REVENUE PERFORMANCE ═══════════════
    <S key="revenue" pad="0 60px">
      <Label>SECTION 5 — REVENUE PERFORMANCE</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Portfolio revenue performance
      </h2>
      <p style={prose}>
        Total portfolio revenue held stable at <span style={proseEmphasis}>£15.88 million (+0.5% YoY)</span> — a result that, while modest in isolation, takes on significance against a London market where RevPAR declined -0.4% and the wider market is tracking ~6% annual declines. Five of ten properties delivered positive revenue growth, led by Hyde Park Green (+10.5%), The W14 (+8.8%), Maiden Oval (+7.5%), and St George Victoria (+6.3%). The portfolio's anchor properties — House on Warwick (£2.65M) and The W14 (£2.69M) — together account for over a third of total revenue and both grew year-on-year.
      </p>
      <Card style={{ padding: "0", overflow: "hidden", maxWidth: "900px" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <h3 style={{ color: WHITE, fontSize: "13px", margin: 0 }}>Annual Revenue by Property (£ thousands) — 2024 vs 2025</h3>
        </div>
        <div style={{ padding: "12px 20px", height: "220px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="0" stroke="#2a2a2a" opacity={0.5} />
              <XAxis dataKey="name" stroke="#2a2a2a" tick={{ fill: "#e5e5e5", fontSize: 10 }} tickLine={false} interval={0} height={30} />
              <YAxis stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickFormatter={(v: number) => `£${v}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="rev24" name="2024 Revenue" fill="#6b7280" fillOpacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="rev25" name="2025 Revenue" fill={SHREEJI_GOLD} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </S>,

    // ═══════════════ SLIDE 9: PORTFOLIO TABLE ═══════════════
    <S key="table" pad="0 60px">
      <Label>SECTION 5 — PORTFOLIO DETAIL</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Property-level performance
      </h2>
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.4fr 0.6fr 0.6fr 0.6fr 1fr 1fr 0.6fr", padding: "10px 18px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#141414" }}>
          {["Property", "Rms", "ADR '24", "ADR '25", "ADR Chg", "Rev '24", "Rev '25", "Rev Chg"].map((h) => (
            <span key={h} style={{ fontSize: "8px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
          ))}
        </div>
        {shreejiHotels.map((h, i) => (
          <div key={h.name} style={{ display: "grid", gridTemplateColumns: "1.8fr 0.4fr 0.6fr 0.6fr 0.6fr 1fr 1fr 0.6fr", padding: "7px 18px", borderBottom: i < 9 ? `1px solid ${BORDER}` : "none", backgroundColor: SURFACE }}>
            <span style={{ fontSize: "11px", color: WHITE, fontWeight: 500 }}>{h.name}</span>
            <span style={{ fontSize: "11px", color: DIM }}>{h.rooms}</span>
            <span style={{ fontSize: "11px", color: GRAY }}>£{h.adr24}</span>
            <span style={{ fontSize: "11px", color: WHITE }}>£{h.adr25}</span>
            <span style={{ fontSize: "11px", color: h.adrChg >= 0 ? GREEN : RED, fontWeight: 500 }}>{h.adrChg >= 0 ? "+" : ""}{h.adrChg.toFixed(1)}%</span>
            <span style={{ fontSize: "11px", color: GRAY }}>£{(h.rev24 / 1000000).toFixed(2)}M</span>
            <span style={{ fontSize: "11px", color: SHREEJI_GOLD, fontWeight: 500 }}>£{(h.rev25 / 1000000).toFixed(2)}M</span>
            <span style={{ fontSize: "11px", color: h.revChg >= 0 ? GREEN : RED, fontWeight: 500 }}>{h.revChg >= 0 ? "+" : ""}{h.revChg.toFixed(1)}%</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.4fr 0.6fr 0.6fr 0.6fr 1fr 1fr 0.6fr", padding: "10px 18px", backgroundColor: "#141414", borderTop: `2px solid ${BORDER}` }}>
          <span style={{ fontSize: "11px", color: WHITE, fontWeight: 700 }}>Portfolio Total</span>
          <span style={{ fontSize: "11px", color: DIM }}>359</span>
          <span /><span /><span />
          <span style={{ fontSize: "11px", color: GRAY, fontWeight: 600 }}>£15.79M</span>
          <span style={{ fontSize: "11px", color: SHREEJI_GOLD, fontWeight: 700 }}>£15.88M</span>
          <span style={{ fontSize: "11px", color: GREEN, fontWeight: 700 }}>+0.5%</span>
        </div>
      </Card>
      <p style={{ ...prose, marginTop: "14px", fontSize: "12px" }}>
        Note: the Shreeji group today operates a wider portfolio than the 10 properties shown above. This analysis includes only hotels with at least two full years of operating data to enable fair year-on-year comparison.
      </p>
    </S>,

    // ═══════════════ SLIDE 10: TECHNOLOGY NOTE ═══════════════
    <S key="tech">
      <Label>NOTE ON TECHNOLOGY</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
        Infrastructure investment
      </h2>
      <p style={prose}>
        The performance documented in this report was achieved with the group's legacy technology stack. In late 2025, the Shreeji group undertook a comprehensive upgrade of its core operational technology — migrating to a modern, cloud-based Property Management System and implementing new channel connectivity tools across the portfolio. These upgrades provide real-time inventory synchronisation, improved distribution reach, and significantly more granular control over rate and availability management. Additionally, the group has deployed a proprietary, custom-built AI revenue management system designed exclusively for the portfolio.
      </p>
    </S>,

    // ═══════════════ SLIDE 11: SUMMARY ═══════════════
    <div key="conclusion" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", width: "100%", height: "100%" }}>
      <GridBG />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "850px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
          <span style={{ color: SHREEJI_GOLD, fontSize: "56px", fontWeight: 200, lineHeight: 1 }}>(</span>
          <span style={{ color: WHITE, fontSize: "28px", letterSpacing: "0.05em", fontWeight: 600 }}>SHREEJI HOTELS</span>
          <span style={{ color: SHREEJI_GOLD, fontSize: "56px", fontWeight: 200, lineHeight: 1 }}>)</span>
        </div>
        <h2 style={{ color: WHITE, fontSize: "28px", fontWeight: 600, marginBottom: "20px", lineHeight: 1.4 }}>
          Summary
        </h2>
        <p style={{ color: GRAY, fontSize: "14px", lineHeight: 1.8, textAlign: "left", marginBottom: "20px", maxWidth: "800px", margin: "0 auto 20px" }}>
          The London hotel market has now posted two consecutive years of ~6% RevPAR decline across comparable independent hotels, with early 2026 data from Booking.com indicating the downward trend is continuing. New supply continues to enter the market, corporate travel demand remains structurally constrained, and 87% of comparable hotels are experiencing falling rates.
        </p>
        <p style={{ color: GRAY, fontSize: "14px", lineHeight: 1.8, textAlign: "left", marginBottom: "28px", maxWidth: "800px", margin: "0 auto 28px" }}>
          Against this backdrop, the Shreeji portfolio tells a different story: near-full occupancy, ADR held flat at a £24 premium over the market, stable revenue, and a consistent RevPAR premium. These are not the results of a portfolio riding a rising tide — they are the results of a portfolio outperforming while the tide goes out. The combination of occupancy dominance and rate resilience across 10 properties represents a compelling demonstration of operational strength and embedded demand capture capability.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "36px" }}>
          {[
            { val: "~95%", label: "Occupancy", sub: "vs ~74% market" },
            { val: "£122", label: "ADR (flat YoY)", sub: "vs -6.9% market" },
            { val: "£120", label: "RevPAR", sub: "£25 premium" },
            { val: "+0.5%", label: "Revenue Growth", sub: "vs -0.4% London" },
          ].map((t) => (
            <div key={t.label} style={{ padding: "14px 22px", border: `1px solid ${BORDER}`, borderRadius: "6px", textAlign: "center", backgroundColor: "rgba(26,26,26,0.8)" }}>
              <div style={{ color: SHREEJI_GOLD, fontSize: "20px", fontWeight: 600, marginBottom: "2px" }}>{t.val}</div>
              <div style={{ color: WHITE, fontSize: "11px", marginBottom: "2px" }}>{t.label}</div>
              <div style={{ color: DIM, fontSize: "9px" }}>{t.sub}</div>
            </div>
          ))}
        </div>
        <p style={{ color: DIM, fontSize: "10px", lineHeight: 1.6, maxWidth: "700px", margin: "0 auto" }}>
          Data sources: Shreeji Hotels (internal) | Market Pulse (15 comparable London hotels) | Booking.com | PwC UK Hotels Forecast | Knight Frank | HVS | UKHospitality | VisitBritain | Deloitte | Market Pulse is a product of Rockenue International Group | Report prepared April 2026
        </p>
      </div>
    </div>,
  ];

  const totalSlides = slides.length;

  return (
    <>
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #1a1a1a !important;
          }
          .deck-controls { display: none !important; }
          .slide-container { overflow: visible !important; background: #1a1a1a !important; }
          .slide {
            width: 100vw !important;
            height: 100vh !important;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex !important;
            background-color: #1a1a1a !important;
          }
          .slide:last-child { page-break-after: auto; }
        }
        @media screen {
          .slide-container { position: relative; overflow: hidden; }
          .slide {
            position: absolute;
            top: 0; left: 0;
            visibility: hidden;
            pointer-events: none;
          }
          .slide.active {
            position: relative;
            visibility: visible;
            pointer-events: auto;
          }
        }
      `}</style>

      {/* Controls */}
      <div className="deck-controls" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: "rgba(26,26,26,0.95)", backdropFilter: "blur(8px)",
        borderBottom: `1px solid ${BORDER}`, padding: "10px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "8px", color: GRAY, fontSize: "13px", background: "none", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))} disabled={currentSlide === 0}
            style={{ background: "none", border: "none", cursor: currentSlide === 0 ? "default" : "pointer", color: currentSlide === 0 ? "#333" : GRAY, padding: "4px" }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ color: WHITE, fontSize: "13px", minWidth: "60px", textAlign: "center" }}>
            {currentSlide + 1} / {totalSlides}
          </span>
          <button onClick={() => setCurrentSlide(Math.min(totalSlides - 1, currentSlide + 1))} disabled={currentSlide === totalSlides - 1}
            style={{ background: "none", border: "none", cursor: currentSlide === totalSlides - 1 ? "default" : "pointer", color: currentSlide === totalSlides - 1 ? "#333" : GRAY, padding: "4px" }}>
            <ChevronRight size={20} />
          </button>
        </div>
        <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: "8px", color: SHREEJI_GOLD, fontSize: "13px", background: "none", border: "none", cursor: "pointer" }}>
          <Printer size={16} /> Export PDF
        </button>
      </div>

      {/* Slides */}
      <div className="slide-container" style={{ backgroundColor: BG, minHeight: "100vh" }}>
        {slides.map((slide, i) => (
          <div key={i} className={`slide ${i === currentSlide ? "active" : ""}`}
            style={{ width: "100vw", height: "100vh", backgroundColor: BG, boxSizing: "border-box", paddingTop: "52px" }}>
            {slide}
          </div>
        ))}
      </div>
    </>
  );
}
