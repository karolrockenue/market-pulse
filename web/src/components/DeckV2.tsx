import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { ArrowLeft, Printer, ChevronLeft, ChevronRight, TrendingUp, Clock } from "lucide-react";
import {
  ComposedChart, LineChart, BarChart, Bar, Line, Area, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";

const NeighbourhoodMaps = lazy(() => import("./NeighbourhoodMaps"));

interface DeckV2Props {
  onBack: () => void;
}

export function DeckV2({ onBack }: DeckV2Props) {
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

  // ── DEMAND RADAR mock data ──
  const drCurr = "\u00A3";
  const ORANGE = "#f97316";
  const CYAN = "#06b6d4";

  const drDemandColor = (d: number) =>
    d >= 85 ? RED : d >= 70 ? ORANGE : d >= 50 ? AMBER : d >= 30 ? BLUE : "#3b82f6";

  const drDays = useMemo(() => {
    const base = new Date("2026-04-10");
    const seedRand = (s: number, lo: number, hi: number) => {
      const x = Math.sin(s * 9301 + 49297) * 49297;
      return lo + (x - Math.floor(x)) * (hi - lo);
    };
    const arr = Array.from({ length: 90 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      let dem = 44 + (i / 90) * 16;
      if (dow === 5) dem += 17;
      if (dow === 6) dem += 24;
      if (dow === 0) dem += 7;
      const demand = Math.min(99, Math.max(8, Math.round(dem + seedRand(i, -7, 7))));
      const wap = Math.round(118 + (demand - 44) * 1.9 + seedRand(i + 100, -10, 10));
      const supply = Math.round(3850 - (demand - 44) * 9 + seedRand(i + 200, -120, 120));
      return {
        i,
        xLabel: i % 14 === 0 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
        shortLabel: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" }),
        dow,
        demand,
        wap,
        segmentWap: wap,
        supply,
      };
    });
    return arr.map((day, i, all) => {
      const win = all.slice(Math.max(0, i - 6), i + 1);
      const demandMa = Math.round(win.reduce((s, d) => s + d.demand, 0) / win.length);
      return { ...day, demandMa };
    });
  }, []);

  const drStats = useMemo(() => {
    const avgDemand = Math.round(drDays.reduce((s, d) => s + d.demand, 0) / drDays.length);
    const avgWap = Math.round(drDays.reduce((s, d) => s + d.wap, 0) / drDays.length);
    const avgSupply = Math.round(drDays.reduce((s, d) => s + d.supply, 0) / drDays.length);
    const highDemand = drDays.filter((d) => d.demand >= 70).length;
    const sorted = [...drDays].sort((a, b) => b.demand - a.demand);
    const peak = sorted[0];
    const trough = sorted[sorted.length - 1];
    return { avgDemand, avgWap, avgSupply, highDemand, peak, trough };
  }, [drDays]);

  // Mock booking events with multi-day spans, like the live Demand Radar
  const drEvents = [
    { idx: 8,  span: 1, name: "London Marathon" },
    { idx: 16, span: 4, name: "Chelsea Flower Show" },
    { idx: 24, span: 1, name: "FA Cup Final" },
    { idx: 32, span: 7, name: "Wimbledon" },
    { idx: 41, span: 2, name: "Glastonbury" },
    { idx: 48, span: 1, name: "Pride London" },
    { idx: 56, span: 2, name: "Wireless Festival" },
    { idx: 63, span: 9, name: "BST Hyde Park" },
    { idx: 73, span: 3, name: "Notting Hill Carnival" },
    { idx: 82, span: 1, name: "Royal Albert Prom" },
  ];
  const isEventDay = (i: number) => drEvents.some((e) => i >= e.idx && i < e.idx + e.span);

  // WAP spike percentiles for amber tinting
  const drWapPctiles = useMemo(() => {
    const sorted = [...drDays].map((d) => d.wap).sort((a, b) => a - b);
    return {
      p75: sorted[Math.floor(sorted.length * 0.75)] || 0,
      p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
    };
  }, [drDays]);

  const drLeadTimeBuckets = [
    { label: "0–7d", value: 18, color: RED },
    { label: "8–14d", value: 22, color: ORANGE },
    { label: "15–30d", value: 28, color: AMBER },
    { label: "31–60d", value: 20, color: BLUE },
    { label: "60d+", value: 12, color: "#3b82f6" },
  ];
  const drLosBuckets = [
    { label: "1 night", value: 35, color: BLUE },
    { label: "2 nights", value: 30, color: AMBER },
    { label: "3 nights", value: 18, color: ORANGE },
    { label: "4+ nights", value: 17, color: PURPLE },
  ];
  const drZones = [
    { label: "0–14 days", tag: "Urgent", color: RED, demand: 71, wap: 168, supply: 3120 },
    { label: "15–30 days", tag: "Tactical", color: ORANGE, demand: 64, wap: 158, supply: 3460 },
    { label: "31–60 days", tag: "Strategic", color: AMBER, demand: 58, wap: 149, supply: 3720 },
    { label: "61–90 days", tag: "Horizon", color: BLUE, demand: 52, wap: 141, supply: 3890 },
  ];

  // ── MARKET PROFILE mock data ──
  const mpKpis = [
    { label: "Total Listed Properties", value: "4,329", color: WHITE },
    { label: "Hotels Only", value: "850", color: BLUE },
    { label: "Avg Market WAP", value: "\u00A3148", color: BLUE },
    { label: "Weekend Premium", value: "+18%", color: GREEN },
    { label: "Peak WAP", value: "\u00A3212", sub: "Jul Sat", color: RED },
    { label: "Cheapest WAP", value: "\u00A3108", sub: "Feb Sun", color: GREEN },
  ];
  const mpStarRatings = [
    { label: "5 Star", count: 206, pct: 4.8, color: PURPLE },
    { label: "4 Star", count: 1667, pct: 38.5, color: BLUE },
    { label: "3 Star", count: 635, pct: 14.7, color: AMBER },
    { label: "2 Star", count: 163, pct: 3.8, color: DIM },
    { label: "Unrated", count: 1658, pct: 38.3, color: "#3a3a3a" },
  ];
  const mpPriceHistogram = [
    { bucket: "\u00A30–50", count: 312 },
    { bucket: "\u00A350–75", count: 487 },
    { bucket: "\u00A375–100", count: 623 },
    { bucket: "\u00A3100–125", count: 558 },
    { bucket: "\u00A3125–150", count: 492 },
    { bucket: "\u00A3150–175", count: 401 },
    { bucket: "\u00A3175–200", count: 338 },
    { bucket: "\u00A3200–250", count: 412 },
    { bucket: "\u00A3250–300", count: 287 },
    { bucket: "\u00A3300–400", count: 219 },
    { bucket: "\u00A3400–500", count: 112 },
    { bucket: "\u00A3500+", count: 88 },
  ];
  const mpCompressionData = useMemo(() => {
    const base = new Date("2026-04-10");
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const isWeekend = dow === 5 || dow === 6;
      const wap = 145 + Math.sin(i * 0.1) * 18 + (isWeekend ? 22 : 0);
      const spread = 95 - Math.sin(i * 0.12) * 24 - (isWeekend ? 12 : 0);
      return {
        date: i % 7 === 0 ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
        wap: Math.round(wap),
        spread: Math.round(spread),
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

  const Label = ({ children }: { children: string }) => (
    <p style={{ color: DIM, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "14px", fontWeight: 500 }}>{children}</p>
  );

  const GridBG = () => (
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)`, backgroundSize: "64px 64px", pointerEvents: "none" }} />
  );

  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "24px", ...style }}>{children}</div>
  );

  // Wide slide wrapper for embedded UI showcases — vertically centered like S
  const WideS = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", padding: "0 36px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: "1360px" }}>{children}</div>
    </div>
  );

  // Demand Radar mini KPI cell
  const DRKpi = ({ label, value, sub, color, isLast }: { label: string; value: string; sub?: string; color: string; isLast?: boolean }) => (
    <div style={{ padding: "12px 14px", textAlign: "center", borderRight: isLast ? "none" : `1px solid ${BORDER}` }}>
      <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 600, color }}>{value}</div>
      {sub && <div style={{ fontSize: "9px", color: DIM, marginTop: "2px" }}>{sub}</div>}
    </div>
  );

  // Demand Radar inner card with header
  const DRCard = ({ label, title, subtitle, children, style = {} }: { label: string; title: string; subtitle: string; children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", ...style }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</div>
        <h3 style={{ color: WHITE, fontSize: "13px", fontWeight: 600, margin: 0 }}>{title}</h3>
        <p style={{ color: GRAY, fontSize: "10px", margin: "2px 0 0" }}>{subtitle}</p>
      </div>
      <div style={{ padding: "12px 16px" }}>{children}</div>
    </div>
  );

  const slides = [
    // ═══════════════════════════════════════════════
    // SLIDE 0: TITLE
    // ═══════════════════════════════════════════════
    <div key="title" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", width: "100%", height: "100%" }}>
      <GridBG />
      <div style={{ position: "relative", zIndex: 1 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
        {[
          "Pricing decisions made on last week's numbers",
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: "20px", padding: "16px 24px", backgroundColor: "rgba(57,189,248,0.04)", border: `1px solid rgba(57,189,248,0.12)`, borderRadius: "8px" }}>
        <span style={{ color: BLUE, fontSize: "20px" }}>{"\u2709"}</span>
        <div style={{ flex: 1 }}>
          <span style={{ color: WHITE, fontSize: "14px", fontWeight: 600 }}>Reports land in your inbox — automatically. </span>
          <span style={{ color: GRAY, fontSize: "13px" }}>Daily snapshots, monthly deep-dives, and custom schedules. Zero manual work.</span>
        </div>
      </div>
    </S>,

    // ═══════════════════════════════════════════════
    // SLIDE 3: LIVE DASHBOARD
    // ═══════════════════════════════════════════════
    <S key="dashboard" pad="0 48px">
      <Label>LIVE DASHBOARD</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "20px" }}>
        Your hotel's performance, <span style={{ color: BLUE }}>always current</span>
      </h2>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", marginBottom: "16px" }}>
        {[
          { period: "Last Month", sub: "March 2026", rev: "\u00A3542,800", occ: "81.2%", adr: "\u00A3148", yoy: "+11.2%", up: true },
          { period: "Current Month", sub: "April 2026", rev: "\u00A3321,900", occ: "74.6%", adr: "\u00A3142", yoy: "+8.7%", up: true },
          { period: "Next Month", sub: "May 2026", rev: "\u00A3184,000", occ: "42.3%", adr: "\u00A3155", yoy: "+14.1%", up: true },
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
    // SLIDE 3b: COMPSET INTEL
    // ═══════════════════════════════════════════════
    <S key="compset" pad="0 48px">
      <Label>COMPSET INTEL</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "6px" }}>
        You vs. your competitive set — <span style={{ color: BLUE }}>in real time</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "12px", marginBottom: "16px" }}>Compare your hotel against same-class competitors on occupancy, pricing, and revenue performance.</p>
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
        <div style={{ borderRadius: "8px", border: "1px solid rgba(57,189,248,0.3)", padding: "16px", backgroundColor: "rgba(57,189,248,0.06)" }}>
          <div style={{ color: BLUE, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "10px" }}>Insight</div>
          <div style={{ color: WHITE, fontSize: "12px", lineHeight: 1.6 }}>
            Your occupancy is <span style={{ color: GREEN, fontWeight: 600 }}>8pts above</span> the segment average. Compset ADR is <span style={{ color: BLUE, fontWeight: 600 }}>{"\u00A3"}14 lower</span> — room to hold firm on pricing.
          </div>
        </div>
      </div>
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
    // NEW SLIDE A: DEMAND RADAR — OUTLOOK + KPIs + DEMAND CHART
    // ═══════════════════════════════════════════════
    <WideS key="demand-radar-1">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "6px" }}>
        <div>
          <Label>SENTINEL · DEMAND RADAR</Label>
          <h2 style={{ color: WHITE, fontSize: "22px", fontWeight: 600, margin: 0, lineHeight: 1.25 }}>
            90-day forward market intelligence — <span style={{ color: BLUE }}>before it hits</span>
          </h2>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", backgroundColor: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: "9999px", padding: "5px 12px" }}>
          <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: GREEN, flexShrink: 0 }} />
          <span style={{ color: GRAY, fontSize: "10px" }}>Live OTA &amp; Events Data</span>
        </div>
      </div>

      {/* Outlook Banner */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px 18px", borderRadius: "8px", backgroundColor: "rgba(34,197,94,0.08)", border: `1px solid rgba(34,197,94,0.3)`, marginTop: "12px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)", border: `1px solid rgba(34,197,94,0.3)` }}>
          <TrendingUp className="w-4 h-4" style={{ color: GREEN }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#86efac", margin: 0 }}>The 90-day market demand is strengthening</h3>
          <p style={{ fontSize: "11px", color: GRAY, margin: "2px 0 0" }}>Based on 90 days of forward availability, pricing, and supply data</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#86efac", lineHeight: 1 }}>+12pp</div>
          <div style={{ fontSize: "9px", color: DIM, marginTop: "2px" }}>demand trajectory</div>
        </div>
        <div style={{ width: "1px", height: "32px", backgroundColor: BORDER }} />
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: 600, color: GREEN, lineHeight: 1 }}>+{drCurr}8</div>
          <div style={{ fontSize: "9px", color: DIM, marginTop: "2px" }}>price trajectory</div>
        </div>
      </div>

      {/* How Busy Is the Market — with event labels + background event columns */}
      <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px 8px 0 0", borderBottom: "none", marginTop: "12px" }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>90-DAY FORWARD VIEW</div>
              <h3 style={{ color: WHITE, fontSize: "13px", fontWeight: 600, margin: 0 }}>How Busy Is the Market?</h3>
            </div>
            <div style={{ display: "flex", gap: "12px", fontSize: "10px", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "14px", height: "2px", backgroundColor: BLUE }} />
                <span style={{ color: DIM }}>Demand</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "14px", height: "0", borderTop: `2px dashed ${BLUE}`, opacity: 0.6 }} />
                <span style={{ color: DIM }}>7d trend</span>
              </span>
              <div style={{ width: "1px", height: "12px", backgroundColor: BORDER }} />
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                {[0.25, 0.45, 0.6, 0.55, 0.75].map((op, i) => {
                  const c = i === 3 ? AMBER : i === 4 ? RED : BLUE;
                  return <div key={i} style={{ width: "9px", height: "9px", borderRadius: "2px", backgroundColor: c, opacity: op }} />;
                })}
                <span style={{ fontSize: "9px", color: DIM, marginLeft: "3px" }}>quiet → busy</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "8px 16px 0" }}>
          <div style={{ position: "relative" }}>
            {/* Rotated event labels strip */}
            <div style={{ position: "relative", height: "94px", marginLeft: "32px", marginRight: "10px", borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {drEvents.map((ev) => (
                <div key={`l-${ev.idx}`} style={{
                  position: "absolute",
                  left: `${(ev.idx / 90) * 100}%`,
                  bottom: "10px",
                  transform: "rotate(-45deg)",
                  transformOrigin: "bottom left",
                  whiteSpace: "nowrap",
                  fontSize: "10px",
                  fontWeight: 500,
                  color: BLUE,
                  opacity: 0.75,
                  pointerEvents: "none",
                }}>
                  {ev.name}
                </div>
              ))}
              {/* Duration span bars */}
              {drEvents.filter((e) => e.span > 1).map((ev) => (
                <div key={`b-${ev.idx}`} style={{
                  position: "absolute",
                  bottom: "0px",
                  left: `${(ev.idx / 90) * 100}%`,
                  width: `${(ev.span / 90) * 100}%`,
                  height: "3px",
                  backgroundColor: BLUE,
                  opacity: 0.4,
                  borderRadius: "2px",
                }} />
              ))}
            </div>
            {/* Chart with background event columns */}
            <div style={{ position: "relative", height: "160px" }}>
              <div style={{ position: "absolute", top: "5px", left: "32px", right: "10px", bottom: "5px", display: "flex", pointerEvents: "none", zIndex: 0 }}>
                {drDays.map((_, i) => (
                  <div key={i} style={{ flex: 1, backgroundColor: isEventDay(i) ? BLUE : "transparent", opacity: isEventDay(i) ? 0.07 : 0 }} />
                ))}
              </div>
              <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={drDays} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="0" stroke={BORDER} opacity={0.5} vertical={false} />
                    <XAxis dataKey="xLabel" stroke={BORDER} tick={{ fill: DIM, fontSize: 9 }} tickLine={false} interval={0} height={16} />
                    <YAxis stroke={BORDER} tick={{ fill: DIM, fontSize: 9 }} tickLine={false} width={32} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Bar dataKey="demand" name="Demand" radius={[2, 2, 0, 0]} maxBarSize={9}>
                      {drDays.map((d, i) => {
                        const v = d.demand;
                        if (v >= 85) return <Cell key={i} fill={RED} fillOpacity={0.75} />;
                        if (v >= 70) return <Cell key={i} fill={AMBER} fillOpacity={0.55} />;
                        return <Cell key={i} fill={BLUE} fillOpacity={0.25 + (v / 100) * 0.45} />;
                      })}
                    </Bar>
                    <Line type="monotone" dataKey="demandMa" name="7d trend" stroke={BLUE} strokeWidth={2} strokeDasharray="6 3" dot={false} strokeOpacity={0.7} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Weighted Average Price — segment WAP with subtle spike tints */}
      <div style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "0 0 8px 8px", borderTop: "none" }}>
        <div style={{ padding: "8px 16px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${BORDER}` }}>
          <div>
            <div style={{ fontSize: "9px", color: DIM, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>MARKET PRICING</div>
            <h3 style={{ color: WHITE, fontSize: "13px", fontWeight: 600, margin: 0 }}>Weighted Average Price</h3>
            <p style={{ color: GRAY, fontSize: "10px", margin: "2px 0 0" }}>2–4★ hotel segment — excludes luxury and unrated properties</p>
          </div>
          <div style={{ display: "flex", gap: "12px", fontSize: "10px", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "14px", height: "2px", backgroundColor: WHITE }} />
              <span style={{ color: DIM }}>WAP</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "14px", height: "0", borderTop: `2px dotted ${DIM}`, opacity: 0.6 }} />
              <span style={{ color: DIM }}>7d trend</span>
            </span>
          </div>
        </div>
        <div style={{ padding: "0 16px 10px" }}>
          <div style={{ position: "relative", height: "120px" }}>
            <div style={{ position: "absolute", top: "5px", left: "40px", right: "10px", bottom: "20px", display: "flex", pointerEvents: "none", zIndex: 0 }}>
              {drDays.map((d, i) => {
                const isSpike = d.wap >= drWapPctiles.p90;
                const isWarm = !isSpike && d.wap >= drWapPctiles.p75;
                return <div key={i} style={{ flex: 1, backgroundColor: isSpike || isWarm ? AMBER : "transparent", opacity: isSpike ? 0.1 : isWarm ? 0.05 : 0 }} />;
              })}
            </div>
            <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={drDays} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="dvWapFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={WHITE} stopOpacity={0.1} />
                      <stop offset="100%" stopColor={WHITE} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke={BORDER} opacity={0.5} vertical={false} />
                  <XAxis dataKey="xLabel" stroke={BORDER} tick={{ fill: DIM, fontSize: 9 }} tickLine={false} interval={6} height={16} />
                  <YAxis stroke={BORDER} tick={{ fill: DIM, fontSize: 9 }} tickLine={false} width={42} tickFormatter={(v) => `${drCurr}${v}`} domain={["dataMin - 10", "dataMax + 10"]} />
                  <Area type="monotone" dataKey="wap" name="WAP" stroke={WHITE} strokeWidth={1.8} fill="url(#dvWapFill)" fillOpacity={1} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </WideS>,

    // ═══════════════════════════════════════════════
    // NEW SLIDE B: DEMAND RADAR — BOOKING BEHAVIOUR + ZONES
    // ═══════════════════════════════════════════════
    <WideS key="demand-radar-2">
      <Label>SENTINEL · DEMAND RADAR</Label>
      <h2 style={{ color: WHITE, fontSize: "22px", fontWeight: 600, marginBottom: "4px", lineHeight: 1.25 }}>
        Read the booking window. <span style={{ color: BLUE }}>Catch revenue you're leaving behind.</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "11px", marginBottom: "14px", maxWidth: "880px", lineHeight: 1.6 }}>
        Lead time, length of stay, and per-zone demand — derived from real reservation history.
      </p>

      {/* Lead time + LOS row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
        <DRCard label="BOOKING BEHAVIOR" title="Lead Time Distribution" subtitle="How far in advance guests are booking">
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "120px", padding: "0 8px" }}>
            {drLeadTimeBuckets.map((b) => (
              <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: b.color, marginBottom: "4px" }}>{b.value}%</div>
                <div style={{ width: "100%", maxWidth: "44px", borderRadius: "4px 4px 0 0", backgroundColor: b.color, opacity: 0.6, height: `${b.value * 3}px` }} />
                <div style={{ fontSize: "10px", color: DIM, marginTop: "6px", textAlign: "center" }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", padding: "8px 0 0", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "10px", color: DIM }}>
              <Clock className="w-3 h-3" style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
              Avg lead time: <strong style={{ color: WHITE }}>19 days</strong>
            </span>
            <span style={{ fontSize: "10px", color: DIM }}>
              Last-minute (0–7d): <strong style={{ color: RED }}>18%</strong>
            </span>
          </div>
        </DRCard>

        <DRCard label="BOOKING BEHAVIOR" title="Length of Stay" subtitle="Guest stay patterns from real booking data">
          <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", height: "120px", padding: "0 8px" }}>
            {drLosBuckets.map((b) => (
              <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: b.color, marginBottom: "4px" }}>{b.value}%</div>
                <div style={{ width: "100%", maxWidth: "52px", borderRadius: "4px 4px 0 0", backgroundColor: b.color, opacity: 0.6, height: `${b.value * 3}px` }} />
                <div style={{ fontSize: "10px", color: DIM, marginTop: "6px", textAlign: "center" }}>{b.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", padding: "8px 0 0", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "10px", color: DIM }}>Avg LOS: <strong style={{ color: WHITE }}>1.9 nights</strong></span>
            <span style={{ fontSize: "10px", color: DIM }}>3+ nights: <strong style={{ color: PURPLE }}>35%</strong></span>
          </div>
        </DRCard>
      </div>

      {/* Booking window zones */}
      <DRCard label="BOOKING WINDOW" title="Demand by Lead Time" subtitle="How demand, pricing, and supply shift across the booking horizon">
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {drZones.map((z) => (
            <div key={z.label} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", borderRadius: "6px", backgroundColor: BG, border: `1px solid ${BORDER}` }}>
              <div style={{ width: "4px", height: "32px", borderRadius: "2px", backgroundColor: z.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: WHITE }}>{z.label}</span>
                  <span style={{ fontSize: "8px", color: z.color, backgroundColor: `${z.color}20`, padding: "1px 6px", borderRadius: "3px", fontWeight: 600, textTransform: "uppercase" }}>{z.tag}</span>
                </div>
                <div style={{ height: "5px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <div style={{ height: "100%", borderRadius: "3px", backgroundColor: drDemandColor(z.demand), width: `${z.demand}%` }} />
                </div>
              </div>
              <div style={{ textAlign: "right", minWidth: "55px" }}>
                <div style={{ fontSize: "16px", fontWeight: 600, color: drDemandColor(z.demand) }}>{z.demand}%</div>
                <div style={{ fontSize: "8px", color: DIM }}>demand</div>
              </div>
              <div style={{ textAlign: "right", minWidth: "50px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: WHITE }}>{drCurr}{z.wap}</div>
                <div style={{ fontSize: "8px", color: DIM }}>WAP</div>
              </div>
              <div style={{ textAlign: "right", minWidth: "55px" }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: PURPLE }}>{z.supply.toLocaleString()}</div>
                <div style={{ fontSize: "8px", color: DIM }}>supply</div>
              </div>
            </div>
          ))}
        </div>
      </DRCard>
    </WideS>,

    // ═══════════════════════════════════════════════
    // NEW SLIDE C: MARKET PROFILE — STRUCTURE
    // ═══════════════════════════════════════════════
    <WideS key="market-profile-1">
      <Label>SENTINEL · MARKET PROFILE</Label>
      <h2 style={{ color: WHITE, fontSize: "22px", fontWeight: 600, marginBottom: "4px", lineHeight: 1.25 }}>
        Know the <span style={{ color: BLUE }}>shape of your market</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "11px", marginBottom: "14px", maxWidth: "880px", lineHeight: 1.6 }}>
        City-wide market structure, pricing dynamics, and booking behaviour derived from daily OTA intelligence — London example.
      </p>

      {/* City KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px", marginBottom: "12px" }}>
        {mpKpis.map((k) => (
          <div key={k.label} style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "12px 14px", textAlign: "center" }}>
            <div style={{ color: DIM, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>{k.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: "9px", color: DIM, marginTop: "2px" }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Star ratings + Price histogram */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "12px" }}>
        <DRCard label="SUPPLY COMPOSITION" title="Star Rating Breakdown" subtitle="Current supply distribution by hotel classification">
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {mpStarRatings.map((s) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", color: WHITE }}>{s.label}</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                    <span style={{ fontSize: "11px", color: WHITE, fontWeight: 500 }}>{s.count.toLocaleString()}</span>
                    <span style={{ fontSize: "10px", color: DIM }}>{s.pct}%</span>
                  </div>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: INPUT_BG, borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${s.pct}%`, height: "100%", backgroundColor: s.color, borderRadius: "3px" }} />
                </div>
              </div>
            ))}
          </div>
        </DRCard>

        <DRCard label="PRICE DISTRIBUTION" title="Price Bracket Distribution" subtitle="Where supply concentrates and where there's pricing headroom">
          <div style={{ height: "150px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mpPriceHistogram} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="bucket" stroke={DIM} fontSize={9} tickLine={false} interval={0} angle={-30} textAnchor="end" height={36} />
                <YAxis stroke={DIM} fontSize={9} tickLine={false} />
                <Bar dataKey="count" name="Properties" radius={[3, 3, 0, 0]}>
                  {mpPriceHistogram.map((_, i) => (
                    <Cell key={i} fill={BLUE} fillOpacity={0.15 + (i < 6 ? (6 - i) * 0.12 : 0.05)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DRCard>
      </div>

      {/* Compression chart */}
      <DRCard label="MARKET COMPRESSION" title="Price Spread & WAP — 90 Day Forward" subtitle="Narrow spread = compressed market (uniform pricing). Wide = diverse/soft.">
        <div style={{ height: "140px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mpCompressionData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis dataKey="date" stroke={DIM} fontSize={9} tickLine={false} />
              <YAxis yAxisId="left" stroke={DIM} fontSize={9} tickLine={false} unit={drCurr} />
              <YAxis yAxisId="right" orientation="right" stroke={DIM} fontSize={9} tickLine={false} />
              <Area yAxisId="right" type="monotone" dataKey="spread" stroke={PURPLE} strokeWidth={1.5} fill={PURPLE} fillOpacity={0.08} name={`Price Spread (${drCurr})`} />
              <Line yAxisId="left" type="monotone" dataKey="wap" stroke={BLUE} strokeWidth={2} dot={false} name={`WAP (${drCurr})`} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </DRCard>
    </WideS>,

    // ═══════════════════════════════════════════════
    // NEW SLIDE: BESPOKE INTELLIGENCE — Map any market on demand
    // ═══════════════════════════════════════════════
    <WideS key="bespoke">
      <Label>BESPOKE INTELLIGENCE</Label>
      <h2 style={{ color: WHITE, fontSize: "26px", fontWeight: 600, marginBottom: "8px", lineHeight: 1.25 }}>
        Any market. Any competitor set. <span style={{ color: BLUE }}>Built to your timeline.</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "13px", marginBottom: "18px", maxWidth: "880px", lineHeight: 1.6 }}>
        Whatever data you need, we can collect it — and build it into the format that fits. Custom datasets, dashboards, and reports for developers, investors, sellers and buyers. <span style={{ color: DIM }}>Fees may apply for bespoke work.</span>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Live London map — uses NeighbourhoodMaps' own MapCard chrome (no outer wrapper) */}
        <div style={{ height: "340px", overflow: "hidden", borderRadius: "8px" }}>
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: GRAY, fontSize: "11px", backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>Loading map…</div>}>
            <NeighbourhoodMaps citySlug="london" />
          </Suspense>
        </div>

        {/* 3 audience cards — match the FOUR PILLARS style exactly */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "340px" }}>
          {[
            {
              color: BLUE,
              title: "Developers",
              desc: "Feasibility studies, site selection, and demand modelling for new builds and conversions.",
              tags: ["Feasibility", "Comp sizing", "Demand model"],
            },
            {
              color: GREEN,
              title: "Investors",
              desc: "Acquisition due diligence, refinance support, and portfolio stress-testing.",
              tags: ["Acquisition DD", "Refinance", "Stress-test"],
            },
            {
              color: PURPLE,
              title: "Sellers & Buyers",
              desc: "Asset positioning, acquisition due diligence, and exit preparation for hotel transactions.",
              tags: ["Asset DD", "Positioning", "Exit prep"],
            },
          ].map((a) => (
            <div key={a.title} style={{ flex: 1, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "14px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "6px", backgroundColor: `${a.color}1F`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: a.color }} />
                  </div>
                  <h3 style={{ color: WHITE, fontSize: "15px", fontWeight: 600, margin: 0 }}>{a.title}</h3>
                </div>
                <p style={{ color: GRAY, fontSize: "11px", lineHeight: 1.5, margin: 0 }}>{a.desc}</p>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {a.tags.map((t) => (
                  <span key={t} style={{ fontSize: "10px", color: a.color, padding: "2px 8px", backgroundColor: `${a.color}14`, borderRadius: "4px" }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stat row — matches INTEGRATIONS slide */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        {[
          { value: "~1 week", label: "Brief to live tracking" },
          { value: "Every property", label: "No panel gaps — the full city" },
          { value: "Daily refresh", label: "Forward view never goes stale" },
          { value: "NDA-ready", label: "Confidential delivery for DD" },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center", padding: "16px", backgroundColor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
            <div style={{ fontSize: "22px", fontWeight: 600, color: BLUE, marginBottom: "4px" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: DIM, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </WideS>,

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
    // SLIDE 8: WHY MARKET PULSE
    // ═══════════════════════════════════════════════
    <S key="why">
      <Label>WHY MARKET PULSE</Label>
      <h2 style={{ color: WHITE, fontSize: "34px", fontWeight: 600, marginBottom: "12px" }}>
        The data you need. <span style={{ color: BLUE }}>Completely free.</span>
      </h2>
      <p style={{ color: GRAY, fontSize: "15px", marginBottom: "28px", maxWidth: "750px", lineHeight: 1.6 }}>
        Traditional benchmarking providers charge thousands per year for data that's weeks old, limited to their panel, and blind to large parts of the market. Market Pulse is different.
      </p>
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
    // SLIDE 9: CTA
    // ═══════════════════════════════════════════════
    <div key="cta" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", position: "relative", width: "100%", height: "100%" }}>
      <GridBG />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "800px" }}>
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
        <div style={{ display: "inline-block", padding: "8px 28px", backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "6px", marginBottom: "48px" }}>
          <span style={{ color: GREEN, fontSize: "18px", fontWeight: 600 }}>Completely free. No credit card. No catch.</span>
        </div>
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
