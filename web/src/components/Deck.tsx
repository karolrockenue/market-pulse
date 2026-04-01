import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ComposedChart, LineChart, BarChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface DeckProps {
  onBack: () => void;
}

export function Deck({ onBack }: DeckProps) {
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
  const PURPLE = "#8b5cf6";
  const INPUT_BG = "#2C2C2C";

  // Sample data for the Demand London charts (frozen realistic dataset)
  const deckDemandData = useMemo(() => {
    const base = new Date("2026-04-01");
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const isWeekend = dow === 5 || dow === 6;
      const weekNum = Math.floor(i / 7);
      // Demand: weekends spike, mid-month dips, seasonal wave
      const seasonal = Math.sin((i / 90) * Math.PI * 2.5) * 15;
      const baseDemand = isWeekend ? 72 : 45;
      const demand = Math.max(10, Math.min(98, Math.round(baseDemand + seasonal + (Math.sin(i * 0.7) * 12))));
      // Supply: gradual decline with weekend dips
      const supply = Math.round(420 - i * 0.8 + (isWeekend ? -35 : 0) + Math.sin(i * 0.5) * 20);
      // Price index: correlated with demand
      const priceIndex = Math.max(5, Math.min(98, Math.round(demand * 0.85 + Math.sin(i * 0.9) * 10)));
      // Supply change: mostly negative (rooms being absorbed), some positive
      const supplyChange = parseFloat((Math.sin(i * 0.6) * 8 - 3 + (isWeekend ? -5 : 1)).toFixed(1));
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        xLabel: i % 7 === 0 ? label : "",
        fullDate: label,
        demand,
        supply,
        priceIndex,
        supplyChange,
      };
    });
  }, []);

  // Sample data for Dashboard occupancy chart
  const deckOccupancyData = useMemo(() => {
    const base = new Date("2026-04-01");
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const isWeekend = dow === 5 || dow === 6;
      const occ = Math.round(Math.max(15, Math.min(98, (isWeekend ? 78 : 55) + Math.sin(i * 0.4) * 18 + Math.sin(i * 1.1) * 8)));
      const pickup = Math.round(Math.max(0, Math.min(20, 6 + Math.sin(i * 0.7) * 5 + (isWeekend ? 4 : 0))));
      return {
        date: i % 7 === 0 ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
        occupancy: occ,
        baseOcc: Math.max(0, occ - pickup),
        pickup,
      };
    });
  }, []);

  // Sample data for Compset chart
  const deckCompsetData = useMemo(() => {
    const base = new Date("2026-04-01");
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const isWeekend = dow === 5 || dow === 6;
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        myOccupancy: Math.round(Math.max(40, Math.min(96, (isWeekend ? 86 : 72) + Math.sin(i * 0.5) * 10))),
        compsetOccupancy: Math.round(Math.max(35, Math.min(88, (isWeekend ? 78 : 65) + Math.sin(i * 0.5) * 8))),
        myADR: Math.round(Math.max(100, Math.min(195, 148 + Math.sin(i * 0.4) * 20 + (isWeekend ? 25 : 0)))),
        compsetADR: Math.round(Math.max(90, Math.min(175, 132 + Math.sin(i * 0.4) * 15 + (isWeekend ? 18 : 0)))),
      };
    });
  }, []);

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

  // Shared slide wrapper — centers content both axes
  const S = ({ children, pad = "0 80px" }: { children: React.ReactNode; pad?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: pad, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: "1200px" }}>{children}</div>
    </div>
  );

  // Label component
  const Label = ({ children }: { children: string }) => (
    <p style={{ color: DIM, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "14px", fontWeight: 500 }}>{children}</p>
  );

  // Grid overlay background
  const GridBG = () => (
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)`, backgroundSize: "64px 64px", pointerEvents: "none" }} />
  );

  // Card wrapper
  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px", ...style }}>{children}</div>
  );

  const slides = [
    // ═══════════════════════════════════════════════
    // SLIDE 0: TITLE
    // ═══════════════════════════════════════════════
    <div key="title" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", width: "100%", height: "100%" }}>
      <GridBG />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "36px" }}>
          <span style={{ color: BLUE, fontSize: "72px", fontWeight: 200, lineHeight: 1 }}>(</span>
          <span style={{ color: WHITE, fontSize: "36px", letterSpacing: "0.06em", fontWeight: 600 }}>MARKET PULSE</span>
          <span style={{ color: BLUE, fontSize: "72px", fontWeight: 200, lineHeight: 1 }}>)</span>
        </div>
        <p style={{ color: WHITE, fontSize: "24px", fontWeight: 300, maxWidth: "700px", lineHeight: 1.5, margin: "0 auto" }}>
          Revenue Intelligence for Hotels
        </p>
        <p style={{ color: GRAY, fontSize: "15px", fontWeight: 300, marginTop: "12px" }}>
          Real-time analytics. Market intelligence. Completely free.
        </p>
        <div style={{ marginTop: "56px", display: "flex", gap: "24px", justifyContent: "center" }}>
          {[
            { n: "FREE", l: "No Catch" },
            { n: "90 Day", l: "Forward View" },
            { n: "< 5 min", l: "To Go Live" },
          ].map((t) => (
            <div key={t.l} style={{ padding: "14px 28px", border: `1px solid ${BORDER}`, borderRadius: "6px", textAlign: "center" }}>
              <div style={{ color: BLUE, fontSize: "22px", fontWeight: 600, marginBottom: "4px" }}>{t.n}</div>
              <div style={{ color: DIM, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // ═══════════════════════════════════════════════
    // SLIDE 1: THE PROBLEM
    // ═══════════════════════════════════════════════
    <S key="problem">
      <Label>THE CHALLENGE</Label>
      <h2 style={{ color: WHITE, fontSize: "34px", fontWeight: 600, marginBottom: "12px", lineHeight: 1.3 }}>
        Hotels are making revenue decisions with <span style={{ color: RED }}>yesterday's data</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "15px", marginBottom: "40px", maxWidth: "680px", lineHeight: 1.6 }}>
        Most hotels still rely on spreadsheets, manual PMS exports, and gut feel. By the time they spot a trend, the opportunity has passed.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "32px" }}>
        {[
          { stat: "72%", label: "of hotels still rely on spreadsheets for revenue decisions", color: RED },
          { stat: "3-5 days", label: "average delay before operators notice a booking trend shift", color: AMBER },
          { stat: "12-18%", label: "revenue uplift achievable with real-time market intelligence", color: BLUE },
        ].map((item) => (
          <Card key={item.stat}>
            <div style={{ fontSize: "44px", fontWeight: 600, color: item.color, marginBottom: "12px" }}>{item.stat}</div>
            <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6 }}>{item.label}</p>
          </Card>
        ))}
      </div>
      {/* Pain points row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
        {[
          "Logging into your PMS just to check occupancy",
          "Manually building weekly revenue spreadsheets",
          "No visibility into what competitors are charging",
          "Finding out too late that demand spiked",
        ].map((pain, i) => (
          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "14px 16px", backgroundColor: "rgba(239,68,68,0.06)", border: `1px solid rgba(239,68,68,0.15)`, borderRadius: "6px" }}>
            <span style={{ color: RED, fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>{"\u2717"}</span>
            <span style={{ color: GRAY, fontSize: "12px", lineHeight: 1.5 }}>{pain}</span>
          </div>
        ))}
      </div>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 2: FOUR PILLARS
    // ═══════════════════════════════════════════════
    <S key="platform">
      <Label>THE PLATFORM</Label>
      <h2 style={{ color: WHITE, fontSize: "34px", fontWeight: 600, marginBottom: "8px" }}>
        One system. <span style={{ color: BLUE }}>Four pillars.</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "15px", marginBottom: "32px", maxWidth: "700px", lineHeight: 1.6 }}>
        Market Pulse connects directly to your PMS and replaces spreadsheets, manual exports, and guesswork with a single live intelligence layer.
      </p>
      {/* 4 pillars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* Pillar 1: Dashboard */}
        <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(57,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: BLUE }} />
            </div>
            <h3 style={{ color: WHITE, fontSize: "17px", fontWeight: 600 }}>Real-Time Hotel Performance</h3>
          </div>
          <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6, marginBottom: "12px" }}>
            Live hotel metrics updated continuously from your PMS. Month-on-month snapshots, year-on-year comparisons, and forward demand signals — no manual exports, no waiting for yesterday's numbers.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            {["Live metrics", "YoY trends", "Forward demand"].map((t) => (
              <span key={t} style={{ fontSize: "11px", color: BLUE, padding: "3px 10px", backgroundColor: "rgba(57,189,248,0.08)", borderRadius: "4px" }}>{t}</span>
            ))}
          </div>
        </div>
        {/* Pillar 2: Market Intel */}
        <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: GREEN }} />
            </div>
            <h3 style={{ color: WHITE, fontSize: "17px", fontWeight: 600 }}>City-Wide Market Intelligence</h3>
          </div>
          <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6, marginBottom: "12px" }}>
            See every hotel in your market on a live supply map. Track how competitor pricing shifts day by day, watch availability tighten or open up, and spot demand surges before they hit.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            {["Supply mapping", "Pricing trends", "Availability shifts"].map((t) => (
              <span key={t} style={{ fontSize: "11px", color: GREEN, padding: "3px 10px", backgroundColor: "rgba(16,185,129,0.08)", borderRadius: "4px" }}>{t}</span>
            ))}
          </div>
        </div>
        {/* Pillar 3: Compset */}
        <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: AMBER }} />
            </div>
            <h3 style={{ color: WHITE, fontSize: "17px", fontWeight: 600 }}>You vs. Your Competitive Set</h3>
          </div>
          <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6, marginBottom: "12px" }}>
            Define your compset and benchmark against them in real time. See exactly where you rank on pricing, availability, and performance — at a glance, for any date range.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            {["Compset ranking", "Rate comparison", "Performance gaps"].map((t) => (
              <span key={t} style={{ fontSize: "11px", color: AMBER, padding: "3px 10px", backgroundColor: "rgba(245,158,11,0.08)", borderRadius: "4px" }}>{t}</span>
            ))}
          </div>
        </div>
        {/* Pillar 4: Reports */}
        <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "rgba(139,92,246,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: PURPLE }} />
            </div>
            <h3 style={{ color: WHITE, fontSize: "17px", fontWeight: 600 }}>Automated & Custom Reports</h3>
          </div>
          <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6, marginBottom: "12px" }}>
            Performance reports generated automatically and delivered straight to your inbox — daily, weekly, or monthly. Need a specific layout for owners or stakeholders? We build custom report formats for you.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            {["Inbox delivery", "PDF export", "Custom formats"].map((t) => (
              <span key={t} style={{ fontSize: "11px", color: PURPLE, padding: "3px 10px", backgroundColor: "rgba(139,92,246,0.08)", borderRadius: "4px" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
      {/* Bottom callout */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "16px 24px", backgroundColor: "rgba(57,189,248,0.04)", border: `1px solid rgba(57,189,248,0.12)`, borderRadius: "8px" }}>
        <span style={{ color: BLUE, fontSize: "20px" }}>{"\u2709"}</span>
        <div style={{ flex: 1 }}>
          <span style={{ color: WHITE, fontSize: "14px", fontWeight: 600 }}>Reports land in your inbox — automatically. </span>
          <span style={{ color: GRAY, fontSize: "13px" }}>Daily snapshots, monthly deep-dives, and custom schedules. Zero manual work.</span>
        </div>
      </div>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 3: LIVE DASHBOARD — real Recharts
    // ═══════════════════════════════════════════════
    <S key="dashboard" pad="0 48px">
      <Label>LIVE DASHBOARD</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "20px" }}>
        Your hotel's performance, <span style={{ color: BLUE }}>always current</span>
      </h2>
      {/* Market outlook banner */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 20px", borderRadius: "8px 8px 0 0", backgroundColor: "rgba(34,197,94,0.1)", borderBottom: `1px solid rgba(34,197,94,0.4)`, marginBottom: "0" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: GREEN, fontSize: "14px" }}>{"\u2197"}</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ color: "#86efac", fontSize: "14px", fontWeight: 500 }}>The 30-day market demand is strengthening</span>
          <span style={{ color: GRAY, fontSize: "11px", marginLeft: "12px" }}>Calculated from thousands of live OTA data points daily</span>
        </div>
        <span style={{ color: "#86efac", fontSize: "22px", fontWeight: 600 }}>+8.4%</span>
      </div>
      {/* 3 period cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", marginBottom: "16px" }}>
        {[
          { period: "Last Month", sub: "March 2026", rev: "\u00A354,280", occ: "81.2%", adr: "\u00A3148", yoy: "+11.2%", up: true },
          { period: "Current Month", sub: "April 2026", rev: "\u00A332,190", occ: "74.6%", adr: "\u00A3142", yoy: "+8.7%", up: true },
          { period: "Next Month", sub: "May 2026", rev: "\u00A318,400", occ: "42.3%", adr: "\u00A3155", yoy: "+14.1%", up: true },
        ].map((c, i) => (
          <div key={c.period} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderLeft: i === 0 ? `1px solid ${BORDER}` : "none", borderRadius: i === 0 ? "0 0 0 8px" : i === 2 ? "0 0 8px 0" : "0", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ color: WHITE, fontSize: "16px", textTransform: "uppercase", letterSpacing: "-0.025em" }}>{c.period}</div>
                <div style={{ color: DIM, fontSize: "11px", textTransform: "uppercase" }}>{c.sub}</div>
              </div>
              <div style={{ padding: "3px 8px", borderRadius: "4px", backgroundColor: c.up ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${c.up ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: c.up ? GREEN : RED, fontSize: "11px" }}>{c.up ? "\u25B2" : "\u25BC"}</span>
                <span style={{ color: c.up ? GREEN : RED, fontSize: "11px" }}>YOY {c.yoy}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
              <span style={{ color: BLUE, fontSize: "30px", fontWeight: 600 }}>{c.rev}</span>
              <span style={{ color: DIM, fontSize: "12px", paddingBottom: "4px" }}>{c.occ} Occ</span>
            </div>
            <div style={{ color: DIM, fontSize: "11px", textTransform: "uppercase", marginTop: "4px" }}>Total Revenue</div>
          </div>
        ))}
      </div>
      {/* Occupancy & Pickup chart — real Recharts ComposedChart */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ color: WHITE, fontSize: "14px", margin: 0, marginBottom: "2px" }}>90 Day Occupancy and Pickup</h3>
              <p style={{ color: GRAY, fontSize: "11px", margin: 0 }}>Occupancy trend with booking velocity overlay</p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              {[{ c: "#6b7280", l: "Base Occupancy %" }, { c: BLUE, l: "24h Pickup %" }].map((lg) => (
                <div key={lg.l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "2px", backgroundColor: lg.c }} />
                  <span style={{ fontSize: "10px", color: DIM }}>{lg.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 20px", height: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={deckOccupancyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="0" stroke="#2a2a2a" opacity={0.5} />
              <XAxis dataKey="date" stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} interval={6} />
              <YAxis stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} width={35} domain={[0, 100]} />
              <Bar dataKey="baseOcc" stackId="occ" name="Base Occupancy" radius={[0, 0, 0, 0]} maxBarSize={12} fill="#6b7280" fillOpacity={0.7} />
              <Bar dataKey="pickup" stackId="occ" name="24h Pickup" radius={[3, 3, 0, 0]} maxBarSize={12} fill="#39BDF8" fillOpacity={0.9} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 3b: COMPSET INTEL — real Recharts
    // ═══════════════════════════════════════════════
    <S key="compset" pad="0 48px">
      <Label>COMPSET INTEL</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "6px" }}>
        You vs. your competitive set — <span style={{ color: BLUE }}>in real time</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "12px", marginBottom: "16px" }}>Compare your hotel against same-class competitors on occupancy, pricing, and revenue performance.</p>
      {/* Scorecard row — mimics real CompetitiveData scorecards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "OCCUPANCY", my: "82%", comp: "74%", rank: "#3", total: "18", winning: true },
          { label: "ADR", my: "\u00A3152", comp: "\u00A3138", rank: "#5", total: "18", winning: true },
          { label: "REVPAR", my: "\u00A3125", comp: "\u00A3102", rank: "#4", total: "18", winning: true },
        ].map((kpi) => (
          <Card key={kpi.label} style={{ padding: "16px", position: "relative" }}>
            <div style={{ position: "absolute", top: "12px", right: "12px", padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "rgba(16,185,129,0.1)", color: GREEN, border: "1px solid rgba(16,185,129,0.3)" }}>
              {kpi.rank}
            </div>
            <div style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: "8px" }}>{kpi.label}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: "26px", fontWeight: 600, color: BLUE }}>{kpi.my}</div>
                <div style={{ color: DIM, fontSize: "10px", marginTop: "4px" }}>My Hotel</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "18px", fontWeight: 600, color: GRAY }}>{kpi.comp}</div>
                <div style={{ color: DIM, fontSize: "10px", marginTop: "4px" }}>Segment Avg</div>
              </div>
            </div>
          </Card>
        ))}
        {/* Insight card */}
        <div style={{ borderRadius: "8px", border: "1px solid rgba(57,189,248,0.3)", padding: "16px", backgroundColor: "rgba(57,189,248,0.06)" }}>
          <div style={{ color: BLUE, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "10px" }}>Insight</div>
          <div style={{ color: WHITE, fontSize: "12px", lineHeight: 1.6 }}>
            Your occupancy is <span style={{ color: GREEN, fontWeight: 600 }}>8pts above</span> the segment average. Compset ADR is <span style={{ color: BLUE, fontWeight: 600 }}>{"\u00A3"}14 lower</span> — room to hold firm on pricing.
          </div>
        </div>
      </div>
      {/* Performance vs Market chart — real LineChart */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ color: WHITE, fontSize: "14px", margin: 0, marginBottom: "2px" }}>Performance vs Compset</h3>
              <p style={{ color: GRAY, fontSize: "11px", margin: 0 }}>Daily occupancy and ADR compared against your competitive segment</p>
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              {[
                { c: BLUE, l: "My Occupancy", solid: true },
                { c: AMBER, l: "Compset Occupancy", solid: false },
                { c: PURPLE, l: "My ADR", solid: true },
                { c: "#ec4899", l: "Compset ADR", solid: false },
              ].map((lg) => (
                <div key={lg.l} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "12px", height: lg.solid ? "3px" : "0", borderRadius: "2px", backgroundColor: lg.solid ? lg.c : "transparent", borderTop: lg.solid ? "none" : `2px dashed ${lg.c}` }} />
                  <span style={{ fontSize: "9px", color: DIM }}>{lg.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 20px", height: "280px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deckCompsetData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} interval={3} />
              <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
              <Line type="monotone" dataKey="myOccupancy" stroke="#39BDF8" strokeWidth={2.5} name="My Occupancy" dot={false} />
              <Line type="monotone" dataKey="compsetOccupancy" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Compset Occupancy" dot={false} />
              <Line type="monotone" dataKey="myADR" stroke="#8b5cf6" strokeWidth={2.5} name="My ADR" dot={false} />
              <Line type="monotone" dataKey="compsetADR" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 5" name="Compset ADR" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 4: MARKET DEMAND — real Recharts (2 charts)
    // ═══════════════════════════════════════════════
    <S key="market" pad="0 48px">
      {/* Page header */}
      <div style={{ marginBottom: "6px" }}>
        <Label>MARKET INTELLIGENCE</Label>
        <h2 style={{ color: WHITE, fontSize: "24px", fontWeight: 500, margin: 0 }}>City-level demand and pricing — live</h2>
      </div>
      <p style={{ color: GRAY, fontSize: "12px", marginBottom: "10px" }}>90-day forward market view with real-time data from OTAs and PMS connections. Below is a live example from the London market.</p>
      {/* Market badge */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: "9999px", padding: "6px 14px", marginBottom: "12px" }}>
        <span style={{ color: BLUE, fontSize: "12px", fontWeight: 600 }}>London Market</span>
        <span style={{ color: DIM, fontSize: "10px" }}>|</span>
        <span style={{ color: DIM, fontSize: "10px" }}>Live Channel Data</span>
      </div>
      {/* Market outlook banner */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "10px 18px", borderRadius: "8px 8px 0 0", backgroundColor: "rgba(34,197,94,0.1)", borderBottom: `1px solid rgba(34,197,94,0.4)` }}>
        <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: GREEN, fontSize: "12px" }}>{"\u2197"}</span>
        </div>
        <span style={{ color: "#86efac", fontSize: "13px", fontWeight: 500, flex: 1 }}>The 30-day market demand is strengthening</span>
        <span style={{ color: "#86efac", fontSize: "18px", fontWeight: 600 }}>+8.4%</span>
      </div>
      {/* Charts container — 2 stacked Recharts */}
      <Card style={{ padding: "0", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
        {/* Chart 1: Demand London */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
          <div style={{ marginBottom: "8px" }}>
            <h3 style={{ color: WHITE, fontSize: "14px", margin: 0, marginBottom: "2px" }}>Demand London</h3>
            <p style={{ color: GRAY, fontSize: "11px", margin: 0 }}>Available room inventory across the London competitive market</p>
          </div>
          <div style={{ height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={deckDemandData} margin={{ top: 5, right: 10, left: -20, bottom: 15 }}>
                <CartesianGrid strokeDasharray="0" stroke="#2a2a2a" opacity={0.5} />
                <XAxis dataKey="xLabel" stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} interval={6} />
                <YAxis yAxisId="left" stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} width={40} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} width={40} domain={[0, "auto"]} />
                <Area yAxisId="right" type="monotone" dataKey="supply" stroke="#3b82f6" strokeWidth={1.5} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.08} name="Market Supply" />
                <Bar yAxisId="left" dataKey="demand" name="Market Demand (%)" radius={[3, 3, 0, 0]} maxBarSize={18} fillOpacity={0.85}>
                  {deckDemandData.map((entry, index) => {
                    const d = entry.demand;
                    const fill = d >= 85 ? "#ef4444" : d >= 70 ? "#f97316" : d >= 40 ? "#f59e0b" : "#3b82f6";
                    return <Cell key={index} fill={fill} />;
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Chart 2: Price Index Analysis */}
        <div style={{ padding: "16px 20px", backgroundColor: SURFACE }}>
          <div style={{ marginBottom: "8px" }}>
            <h3 style={{ color: WHITE, fontSize: "14px", margin: 0, marginBottom: "2px" }}>Price Index Analysis</h3>
            <p style={{ color: GRAY, fontSize: "11px", margin: 0 }}>Market pricing pressure and rate positioning</p>
          </div>
          <div style={{ height: "180px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={deckDemandData} margin={{ top: 5, right: 10, left: -20, bottom: 15 }}>
                <CartesianGrid strokeDasharray="0" stroke="#2a2a2a" opacity={0.5} />
                <XAxis dataKey="xLabel" stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} interval={6} />
                <YAxis stroke="#2a2a2a" tick={{ fill: "#6b7280", fontSize: 9 }} tickLine={{ stroke: "#2a2a2a" }} axisLine={{ stroke: "#2a2a2a" }} width={40} domain={[0, 100]} />
                <Line type="monotone" dataKey="priceIndex" stroke="transparent" strokeWidth={0} dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  const v = payload.priceIndex;
                  const fill = v >= 90 ? "#ef4444" : v >= 40 ? "#f59e0b" : "#3b82f6";
                  return <circle key={index} cx={cx} cy={cy} r={2.5} fill={fill} stroke="none" />;
                }} name="Price Index" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 5: PORTFOLIO VIEW (fake American hotel names)
    // ═══════════════════════════════════════════════
    <S key="portfolio" pad="0 48px">
      <Label>PORTFOLIO VIEW</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "20px" }}>
        Every property. <span style={{ color: BLUE }}>One command centre.</span>
      </h2>
      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "PROPERTIES", value: "6", color: WHITE },
          { label: "PORTFOLIO OCC", value: "80.2%", color: GREEN },
          { label: "AVG ADR", value: "$187", color: BLUE },
          { label: "TOTAL REVENUE", value: "$412K", color: BLUE },
          { label: "YOY GROWTH", value: "+9.4%", color: GREEN },
        ].map((k) => (
          <Card key={k.label} style={{ padding: "14px 18px", textAlign: "center" }}>
            <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>{k.label}</div>
            <div style={{ fontSize: "22px", fontWeight: 600, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>
      {/* Portfolio table */}
      <Card style={{ padding: "0", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 1fr 0.8fr", padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#141414" }}>
          {["PROPERTY", "OCCUPANCY", "ADR", "REVPAR", "REVENUE", "YOY"].map((h) => (
            <span key={h} style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
          ))}
        </div>
        {[
          { name: "The Gramercy House", occ: 82, adr: "$218", revpar: "$179", rev: "$78,400", yoy: "+11.2%", up: true },
          { name: "Beacon Hill Hotel", occ: 76, adr: "$195", revpar: "$148", rev: "$52,100", yoy: "+7.8%", up: true },
          { name: "The Wicker Park Inn", occ: 88, adr: "$162", revpar: "$143", rev: "$88,200", yoy: "+14.5%", up: true },
          { name: "Pacific Heights Lodge", occ: 71, adr: "$175", revpar: "$124", rev: "$41,800", yoy: "-2.1%", up: false },
          { name: "Capitol Row Suites", occ: 79, adr: "$189", revpar: "$149", rev: "$62,700", yoy: "+9.4%", up: true },
          { name: "The Midtown Standard", occ: 85, adr: "$206", revpar: "$175", rev: "$88,900", yoy: "+16.7%", up: true },
        ].map((row, i) => {
          const occColor = row.occ >= 80 ? GREEN : row.occ >= 70 ? BLUE : row.occ >= 50 ? AMBER : RED;
          const occBg = row.occ >= 80 ? "rgba(16,185,129,0.15)" : row.occ >= 70 ? "rgba(57,189,248,0.1)" : row.occ >= 50 ? "rgba(249,115,22,0.12)" : "rgba(239,68,68,0.15)";
          return (
            <div key={row.name} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 1fr 0.8fr", padding: "12px 20px", borderBottom: i < 5 ? `1px solid ${BORDER}` : "none", alignItems: "center", backgroundColor: SURFACE }}>
              <span style={{ fontSize: "13px", color: WHITE, fontWeight: 500 }}>{row.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "52px", height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${row.occ}%`, height: "100%", backgroundColor: occColor, borderRadius: "3px" }} />
                </div>
                <span style={{ fontSize: "12px", fontWeight: 500, color: occColor, padding: "2px 8px", borderRadius: "4px", backgroundColor: occBg }}>{row.occ}%</span>
              </div>
              <span style={{ fontSize: "12px", color: WHITE }}>{row.adr}</span>
              <span style={{ fontSize: "12px", color: WHITE }}>{row.revpar}</span>
              <span style={{ fontSize: "13px", color: BLUE, fontWeight: 600 }}>{row.rev}</span>
              <span style={{ fontSize: "12px", color: row.up ? GREEN : RED, fontWeight: 500 }}>{row.up ? "\u25B2" : "\u25BC"} {row.yoy}</span>
            </div>
          );
        })}
      </Card>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 7: INTEGRATIONS
    // ═══════════════════════════════════════════════
    <S key="integrations">
      <Label>INTEGRATIONS</Label>
      <h2 style={{ color: WHITE, fontSize: "34px", fontWeight: 600, marginBottom: "12px" }}>
        Connects to your PMS <span style={{ color: BLUE }}>in minutes</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "15px", marginBottom: "36px", maxWidth: "680px", lineHeight: 1.6 }}>
        Existing PMS systems connect instantly via OAuth or API tokens. New PMS platforms can be fully integrated in as little as one week.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "40px" }}>
        {[
          { name: "Cloudbeds", status: "Live", desc: "Full OAuth integration with automated daily sync. Bookings, revenue, inventory, and room types pulled in automatically.", badge: GREEN },
          { name: "Mews", status: "Live", desc: "Real-time webhook events. Every booking, cancellation, and modification reflected instantly. Webhook-driven — no polling delays.", badge: GREEN },
          { name: "Opera PMS", status: "Coming Soon", desc: "Enterprise PMS integration for large hotel groups and chains. Contact us if you run Opera — early access available.", badge: AMBER },
        ].map((pms) => (
          <Card key={pms.name} style={{ padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: WHITE, fontSize: "20px", fontWeight: 600 }}>{pms.name}</h3>
              <span style={{ fontSize: "11px", fontWeight: 600, padding: "4px 14px", borderRadius: "4px", color: pms.badge, backgroundColor: `${pms.badge}20` }}>{pms.status}</span>
            </div>
            <p style={{ color: GRAY, fontSize: "13px", lineHeight: 1.6 }}>{pms.desc}</p>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        {[
          { value: "< 5 min", label: "Existing PMS Onboarding" },
          { value: "~1 week", label: "New PMS Integration" },
          { value: "Zero", label: "Manual Data Entry" },
          { value: "24/7", label: "Automated Sync" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center", padding: "20px", backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
            <div style={{ fontSize: "26px", fontWeight: 600, color: BLUE, marginBottom: "6px" }}>{s.value}</div>
            <div style={{ fontSize: "11px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 8: WHY MARKET PULSE — STR/COSTAR DIG + FREE
    // ═══════════════════════════════════════════════
    <S key="why">
      <Label>WHY MARKET PULSE</Label>
      <h2 style={{ color: WHITE, fontSize: "34px", fontWeight: 600, marginBottom: "12px" }}>
        The data you need. <span style={{ color: BLUE }}>Completely free.</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "15px", marginBottom: "28px", maxWidth: "750px", lineHeight: 1.6 }}>
        Traditional benchmarking providers charge thousands per year for data that's weeks old, limited to their panel, and blind to large parts of the market. Market Pulse is different.
      </p>
      {/* Comparison table */}
      <Card style={{ padding: "0", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 24px", borderBottom: `1px solid ${BORDER}`, backgroundColor: "#141414" }}>
          <span style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em" }}></span>
          <span style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>LEGACY PROVIDERS</span>
          <span style={{ fontSize: "10px", color: BLUE, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", fontWeight: 600 }}>MARKET PULSE</span>
        </div>
        {[
          { feature: "Price", legacy: "£3,000 - £12,000+ / year", mp: "Free", mpColor: GREEN },
          { feature: "Data freshness", legacy: "Weekly or monthly reports", mp: "Real-time (live PMS + OTA)", mpColor: GREEN },
          { feature: "Market coverage", legacy: "Panel-based — only participating hotels", mp: "Full city — every listed property", mpColor: GREEN },
          { feature: "Compset benchmarking", legacy: "Generic segment averages", mp: "You vs same-class hotels in your city", mpColor: GREEN },
          { feature: "Setup time", legacy: "Weeks of onboarding", mp: "Under 5 minutes", mpColor: GREEN },
          { feature: "Forward visibility", legacy: "Backward-looking snapshots", mp: "90-day forward demand + pricing", mpColor: GREEN },
          { feature: "Custom reports", legacy: "Standardised templates only", mp: "Built to your needs (on request)", mpColor: GREEN },
        ].map((row, i) => (
          <div key={row.feature} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "11px 24px", borderBottom: i < 6 ? `1px solid ${BORDER}` : "none", backgroundColor: SURFACE }}>
            <span style={{ fontSize: "13px", color: WHITE, fontWeight: 500 }}>{row.feature}</span>
            <span style={{ fontSize: "12px", color: RED, textAlign: "center", opacity: 0.8 }}>{row.legacy}</span>
            <span style={{ fontSize: "12px", color: row.mpColor, textAlign: "center", fontWeight: 600 }}>{row.mp}</span>
          </div>
        ))}
      </Card>
      {/* Bottom row — key differentiators */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        {[
          { title: "Real-time, not last month", desc: "PMS webhooks deliver booking data as it happens. Your dashboard is always current — not a stale monthly PDF.", icon: "\u23F1" },
          { title: "The whole market, not a panel", desc: "Legacy providers only see hotels that opt in. Market Pulse tracks every listed property in your city — the full picture.", icon: "\u{1F310}" },
          { title: "Reports on autopilot", desc: "Performance reports generated and delivered to your inbox. Daily, weekly, monthly — plus custom formats built for you.", icon: "\u2709" },
        ].map((item) => (
          <div key={item.title} style={{ display: "flex", gap: "14px", padding: "20px", backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "rgba(57,189,248,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "16px" }}>
              {item.icon}
            </div>
            <div>
              <h3 style={{ color: WHITE, fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>{item.title}</h3>
              <p style={{ color: GRAY, fontSize: "12px", lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 9: CTA — CLOSING
    // ═══════════════════════════════════════════════
    <div key="cta" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", width: "100%", height: "100%" }}>
      <GridBG />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "800px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "48px" }}>
          <span style={{ color: BLUE, fontSize: "56px", fontWeight: 200, lineHeight: 1 }}>(</span>
          <span style={{ color: WHITE, fontSize: "28px", letterSpacing: "0.05em", fontWeight: 600 }}>MARKET PULSE</span>
          <span style={{ color: BLUE, fontSize: "56px", fontWeight: 200, lineHeight: 1 }}>)</span>
        </div>
        <h2 style={{ color: WHITE, fontSize: "38px", fontWeight: 600, marginBottom: "16px", lineHeight: 1.3 }}>
          Stop guessing.<br />Start seeing.
        </h2>
        <p style={{ color: GRAY, fontSize: "17px", marginBottom: "20px", lineHeight: 1.6 }}>
          Connect your PMS and see your first live dashboard in under 5 minutes.
        </p>
        {/* FREE callout */}
        <div style={{ display: "inline-block", padding: "8px 28px", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "6px", marginBottom: "48px" }}>
          <span style={{ color: GREEN, fontSize: "18px", fontWeight: 600 }}>Completely free. No credit card. No catch.</span>
        </div>
        {/* Contact */}
        <div style={{ display: "flex", gap: "40px", justifyContent: "center", marginBottom: "40px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: DIM, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Web</div>
            <div style={{ color: WHITE, fontSize: "15px" }}>www.market-pulse.io</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: DIM, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>Email</div>
            <div style={{ color: WHITE, fontSize: "15px" }}>hello@market-pulse.io</div>
          </div>
        </div>
        {/* Bottom tagline */}
        <div style={{ display: "flex", gap: "20px", justifyContent: "center" }}>
          {["Real-Time Analytics", "Market Intelligence", "Automated Reports", "Portfolio View"].map((t) => (
            <span key={t} style={{ color: DIM, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t}</span>
          ))}
        </div>
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
        <button onClick={handlePrint} style={{ display: "flex", alignItems: "center", gap: "8px", color: BLUE, fontSize: "13px", background: "none", border: "none", cursor: "pointer" }}>
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
