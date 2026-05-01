import { useState, useEffect, useMemo, Fragment } from "react";
import {
  ArrowLeft,
  Printer,
  ChevronLeft,
  ChevronRight,
  Database,
  Plane,
  Calendar,
  Footprints,
  Building2,
  Map,
  Brain,
  Activity,
  Gauge,
  ArrowRight,
  Filter,
  Send,
  Layers,
  ShieldCheck,
  FileText,
  TrendingUp,
  Briefcase,
  ClipboardList,
} from "lucide-react";
import { R } from "../styles/tokens";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Area,
} from "recharts";

interface PitchDeckProps {
  onBack: () => void;
}

const FONT_STACK = "'Inter', system-ui, -apple-system, sans-serif";

function Screenshot({
  src,
  label,
  height = 260,
  fit = "contain",
  objectPosition = "center",
}: {
  src: string;
  label: string;
  height?: number;
  fit?: "contain" | "cover";
  objectPosition?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div
        style={{
          border: `1px dashed ${R.border}`,
          borderRadius: "8px",
          minHeight: `${height}px`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          background: `${R.warmTeal}06`,
        }}
      >
        <div style={{ color: R.warmTeal, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Screenshot
        </div>
        <div style={{ color: R.accent, fontSize: "14px", fontWeight: 500 }}>{label}</div>
        <div style={{ color: R.textMid, fontSize: "10px", fontFamily: "monospace" }}>{src}</div>
      </div>
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: `${height}px`,
        background: R.recessed,
        borderRadius: "8px",
        border: `1px solid ${R.border}`,
        overflow: "hidden",
      }}
    >
      <img
        src={src}
        alt={label}
        onError={() => setErrored(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: fit,
          objectPosition,
          display: "block",
        }}
      />
    </div>
  );
}

export function PitchDeck({ onBack }: PitchDeckProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // ─── SHARED COMPONENTS ────────────────────────────────────────────
  const S = ({
    children,
    pad = "0 80px",
    center = false,
    topPad = 40,
  }: {
    children: React.ReactNode;
    pad?: string;
    center?: boolean;
    topPad?: number;
  }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: center ? "center" : "flex-start",
        width: "100%",
        height: "100%",
        padding: pad,
        boxSizing: "border-box",
        overflowY: "auto",
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ width: "100%", maxWidth: "1100px", paddingTop: center ? 0 : `${topPad}px`, paddingBottom: "16px" }}>
        {children}
      </div>
    </div>
  );

  const Eyebrow = ({ children }: { children: string }) => (
    <p
      style={{
        color: R.gold,
        fontSize: "11px",
        textTransform: "uppercase",
        letterSpacing: "2px",
        marginBottom: "14px",
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );

  const H1 = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ color: R.accent, fontSize: "38px", fontWeight: 600, marginBottom: "20px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
      {children}
    </h2>
  );

  const Sub = ({ children }: { children: React.ReactNode }) => (
    <p style={{ color: R.text, fontSize: "16px", lineHeight: 1.6, marginBottom: "32px", maxWidth: "780px", fontWeight: 300 }}>
      {children}
    </p>
  );

  const GridBG = () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `linear-gradient(${R.warmTeal}0a 1px, transparent 1px), linear-gradient(90deg, ${R.warmTeal}0a 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        pointerEvents: "none",
      }}
    />
  );

  const Card = ({
    children,
    style = {},
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <div
      style={{
        backgroundColor: R.darkBand,
        border: `1px solid ${R.border}`,
        borderRadius: "8px",
        padding: "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );

  const Stat = ({ value, label, color = R.warmTeal }: { value: string; label: string; color?: string }) => (
    <div style={{
      textAlign: "center",
      padding: "20px 16px",
      border: `1px solid ${R.border}`,
      borderRadius: "8px",
      backgroundColor: R.darkBand,
    }}>
      <div style={{
        color,
        fontSize: "32px",
        fontWeight: 600,
        marginBottom: "6px",
        letterSpacing: "-0.03em",
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      <div style={{ color: R.textDim, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
    </div>
  );

  const Badge = ({ children, color = R.warmTeal }: { children: React.ReactNode; color?: string }) => (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 14px",
      borderRadius: "999px",
      background: `${color}10`,
      border: `1px solid ${color}30`,
      color,
      fontSize: "11px",
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {children}
    </div>
  );

  // ─── SLIDE-NATIVE WIDGETS (real data shape, slide-scale layout) ──

  // 90-day demand chart, à la Demand Radar's hero panel.
  const demandChartData = useMemo(() => {
    const events: Record<number, string> = { 8: "Wimbledon", 22: "BST Hyde Park", 38: "Notting Hill", 50: "UEFA Final", 72: "Marathon" };
    return Array.from({ length: 90 }, (_, i) => {
      const dow = (i + 2) % 7;
      const isWknd = dow === 5 || dow === 6;
      const isEvent = events[i] != null;
      const demand = Math.min(98, Math.max(18, Math.round(46 + (isWknd ? 18 : 0) + (isEvent ? 22 : 0) + Math.sin(i * 0.25) * 12 + (i / 90) * 8)));
      const wap = Math.round(132 + (isWknd ? 28 : 0) + (isEvent ? 26 : 0) + Math.sin(i * 0.3) * 16 + (i / 90) * 12);
      return { i, demand, wap, event: events[i] || null, label: i % 14 === 0 ? `+${i}d` : "" };
    });
  }, []);

  const demandTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 11, fontFamily: FONT_STACK }}>
        <div style={{ color: R.textMid, marginBottom: 4 }}>Day +{label}</div>
        <div style={{ color: R.warmTeal }}>Demand: {d.demand}</div>
        <div style={{ color: R.gold }}>WAP£: £{d.wap}</div>
        {d.event && <div style={{ color: R.accent, marginTop: 4, fontWeight: 600 }}>● {d.event}</div>}
      </div>
    );
  };

  const DemandChart = () => {
    const eventDays = demandChartData.filter((d) => d.event);
    return (
      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div>
            <div style={{ color: R.accent, fontSize: 13, fontWeight: 600 }}>Forward Demand · 90 days</div>
            <div style={{ color: R.textMid, fontSize: 11, marginTop: 2 }}>Demand index by day, with event annotations · London</div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 10, color: R.textDim }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: R.warmTeal }} /> Demand</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 2, background: R.gold }} /> WAP£ (rhs)</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: R.red }} /> Event-driven peaks</span>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={demandChartData} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.4} vertical={false} />
              <XAxis dataKey="i" tickFormatter={(v) => (v % 14 === 0 ? `+${v}d` : "")} stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} interval={0} tickLine={false} />
              <YAxis yAxisId="d" domain={[0, 100]} stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} tickLine={false} />
              <YAxis yAxisId="w" orientation="right" domain={[80, 240]} stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} tickLine={false} tickFormatter={(v) => `£${v}`} />
              <Tooltip content={demandTooltip} cursor={{ fill: `${R.warmTeal}10` }} />
              {eventDays.map((d) => (
                <ReferenceLine key={`ev-${d.i}`} yAxisId="d" x={d.i} stroke={R.red} strokeDasharray="2 3" strokeOpacity={0.5}
                  label={{ value: d.event!, position: "top", fill: R.gold, fontSize: 9, offset: 6 }} />
              ))}
              <Bar yAxisId="d" dataKey="demand" radius={[2, 2, 0, 0]} maxBarSize={10}>
                {demandChartData.map((d, i) => (
                  <Cell key={i} fill={d.event ? R.red : d.demand >= 75 ? R.gold : d.demand >= 55 ? R.warmTeal : `${R.warmTeal}80`} />
                ))}
              </Bar>
              <Line yAxisId="w" dataKey="wap" type="monotone" stroke={R.gold} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ─── Market Profile Section · Seasonality heatmap (lifted from MarketProfile.tsx) ───
  // 12 months × 7 DOW grid showing ADR pricing pattern. Full slide width.
  const ADR_HEATMAP = [
    { month: "Jan", values: [112, 118, 121, 119, 124, 142, 148] },
    { month: "Feb", values: [108, 115, 118, 117, 122, 138, 145] },
    { month: "Mar", values: [119, 126, 131, 128, 135, 152, 159] },
    { month: "Apr", values: [128, 134, 138, 136, 143, 165, 172] },
    { month: "May", values: [135, 142, 146, 144, 151, 178, 186] },
    { month: "Jun", values: [148, 155, 159, 157, 164, 192, 201] },
    { month: "Jul", values: [156, 162, 165, 163, 171, 198, 212] },
    { month: "Aug", values: [152, 158, 161, 159, 168, 195, 208] },
    { month: "Sep", values: [138, 145, 149, 147, 155, 179, 188] },
    { month: "Oct", values: [132, 139, 143, 141, 148, 168, 176] },
    { month: "Nov", values: [122, 129, 133, 131, 138, 158, 165] },
    { month: "Dec", values: [142, 148, 152, 150, 158, 182, 195] },
  ];
  const DOW_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const heatADR = (v: number) =>
    v >= 195 ? R.red : v >= 170 ? "#f97316" : v >= 145 ? R.gold : v >= 125 ? R.warmTeal : `${R.warmTeal}66`;

  const MarketProfileSection = () => (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div>
          <div style={{ color: R.accent, fontSize: 12, fontWeight: 600 }}>Seasonality · ADR by Month × Day-of-Week</div>
          <div style={{ color: R.textMid, fontSize: 10, marginTop: 1 }}>Pricing power per weekday, every month</div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 9, color: R.textDim }}>
          <span>Soft</span>
          {[`${R.warmTeal}66`, R.warmTeal, R.gold, "#f97316", R.red].map((c, i) => (
            <span key={i} style={{ width: 12, height: 8, borderRadius: 2, background: c }} />
          ))}
          <span>Tight</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "36px repeat(7, 1fr)", gap: 2 }}>
        <div />
        {DOW_LABELS.map((d) => (
          <div key={d} style={{ color: R.textDim, fontSize: 8, fontWeight: 600, textAlign: "center", letterSpacing: 0.5, padding: "0 0 3px" }}>{d}</div>
        ))}
        {ADR_HEATMAP.map((row) => (
          <Fragment key={row.month}>
            <div style={{ color: R.textMid, fontSize: 9, fontWeight: 600, textAlign: "right", paddingRight: 5, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{row.month}</div>
            {row.values.map((v, i) => (
              <div
                key={i}
                style={{
                  background: heatADR(v),
                  borderRadius: 2,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: v >= 145 ? R.bg : R.accent,
                  fontSize: 9,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                £{v}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );

  // ─── Archanes-style Forward Occupancy section (lifted from ArchanesInvestorView) ───
  const archanesData = useMemo(() => {
    const out: { i: number; date: string; occ: number; price: number }[] = [];
    for (let i = 0; i < 90; i++) {
      const d = new Date(2026, 4, 1 + i);
      const dow = d.getDay();
      const isWknd = dow === 5 || dow === 6;
      const occ = Math.min(98, Math.max(28, Math.round(58 + (isWknd ? 22 : 0) + Math.sin(i * 0.18) * 12 + (i / 90) * 8)));
      const price = Math.round(142 + (isWknd ? 32 : 0) + Math.sin(i * 0.22) * 18);
      out.push({ i, date: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), occ, price });
    }
    return out;
  }, []);
  const occColor = (v: number) => v >= 88 ? R.red : v >= 72 ? "#f97316" : v >= 55 ? R.gold : v >= 40 ? R.warmTeal : `${R.warmTeal}66`;

  const ArchanesInvestorSection = () => (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div style={{ color: R.accent, fontSize: 13, fontWeight: 600 }}>Forward Occupancy · Next 90 Days</div>
        <div style={{ color: R.textDim, fontSize: 10 }}>Per check-in date · taller red bars = tighter dates</div>
      </div>
      <div style={{ color: R.textMid, fontSize: 10, marginBottom: 8 }}>Investor-grade view — Archanes, Crete · custom-built for portfolio acquisition diligence</div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={archanesData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.4} vertical={false} />
            <XAxis dataKey="i" tickFormatter={(v) => (v % 14 === 0 ? `+${v}d` : "")} stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} interval={0} tickLine={false} />
            <YAxis tickFormatter={(v) => `${v}%`} domain={[0, 100]} stroke={R.border} tick={{ fill: R.textDim, fontSize: 10 }} tickLine={false} />
            <Tooltip
              cursor={{ fill: `${R.warmTeal}10` }}
              contentStyle={{ background: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, fontSize: 11 }}
              labelFormatter={(v) => `Day +${v}`}
              formatter={(value, _name, props: any) => [`${value}% occ · £${props.payload.price}`, ""]}
            />
            <Bar dataKey="occ" radius={[3, 3, 0, 0]} maxBarSize={10}>
              {archanesData.map((d, i) => <Cell key={i} fill={occColor(d.occ)} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 9, color: R.textDim }}>
        <span>Loose</span>
        {[`${R.warmTeal}66`, R.warmTeal, R.gold, "#f97316", R.red].map((c, i) => (
          <div key={i} style={{ width: 18, height: 8, borderRadius: 2, background: c }} />
        ))}
        <span>Tight</span>
        <span style={{ marginLeft: "auto", color: R.textMid }}>1 − (bookable listings ÷ all properties seen)</span>
      </div>
    </div>
  );

  // ─── Sentinel Health · Fleet section (lifted from HealthView) ───
  const HEALTH_FLEET = [
    { name: "Property A", pms: "Cloudbeds", auto: "ON", status: "healthy", lastPush: "12 min", failures: 0, sparkline: "gggggggggggggggggggggggggggggg" },
    { name: "Property B", pms: "Mews", auto: "ON", status: "healthy", lastPush: "23 min", failures: 0, sparkline: "ggggggggggggggggggggggggggggga" },
    { name: "Property C", pms: "Cloudbeds", auto: "ON", status: "healthy", lastPush: "31 min", failures: 1, sparkline: "ggggggggggggggggggggggggggggag" },
    { name: "Property D", pms: "Mews", auto: "ON", status: "warning", lastPush: "1.2h", failures: 2, sparkline: "gggggggggggggggggggggggggggaag" },
    { name: "Property E", pms: "Cloudbeds", auto: "ON", status: "failing", lastPush: "7h", failures: 5, sparkline: "ggggggggggggggggggggggggggrrrr" },
  ];
  const statusMeta: Record<string, { color: string; label: string }> = {
    healthy: { color: R.green, label: "Healthy" },
    warning: { color: R.gold, label: "Recent failure" },
    failing: { color: R.red, label: "Repeated failures" },
  };
  const sparkColor = (c: string) => (c === "g" ? R.green : c === "a" ? R.gold : c === "r" ? R.red : R.textDim);

  const SentinelHealthSection = () => (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ color: R.accent, fontSize: 13, fontWeight: 600 }}>Sentinel Health · Fleet</div>
          <div style={{ color: R.textMid, fontSize: 11, marginTop: 2 }}>Per-asset heartbeat · 30-day status sparkline · last push · failure cluster</div>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
          {[
            { c: R.green, l: "Healthy" },
            { c: R.gold, l: "Warning" },
            { c: R.red, l: "Failing" },
          ].map((s) => (
            <span key={s.l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: s.c, boxShadow: `0 0 4px ${s.c}80` }} />
              {s.l}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr 0.4fr 1fr 0.7fr 0.6fr 1.5fr", gap: 0, fontSize: 10 }}>
        {/* Header row */}
        {["Property", "PMS", "Auto", "Status", "Last push", "Fails 7d", "30 days"].map((h) => (
          <div key={h} style={{ color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6, fontSize: 9, fontWeight: 600, padding: "6px 8px", borderBottom: `1px solid ${R.border}` }}>{h}</div>
        ))}
        {HEALTH_FLEET.map((r, ri) => {
          const s = statusMeta[r.status];
          return (
            <Fragment key={r.name}>
              <div style={{ color: R.accent, fontWeight: 500, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}` }}>{r.name}</div>
              <div style={{ color: R.textMid, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}` }}>{r.pms}</div>
              <div style={{ color: r.auto === "ON" ? R.warmTeal : R.textDim, fontWeight: 600, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}` }}>{r.auto}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, boxShadow: `0 0 4px ${s.color}80` }} />
                <span style={{ color: R.accent, fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ color: R.text, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}` }}>{r.lastPush}</div>
              <div style={{ color: r.failures > 0 ? R.gold : R.textDim, fontWeight: 600, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}` }}>{r.failures}</div>
              <div style={{ display: "flex", gap: 1, padding: "10px 8px", borderBottom: ri === HEALTH_FLEET.length - 1 ? "none" : `1px solid ${R.border}`, alignItems: "center" }}>
                {r.sparkline.split("").map((c, i) => (
                  <div key={i} style={{ width: 6, height: 14, borderRadius: 1, background: sparkColor(c), opacity: c === "_" ? 0.3 : 0.85 }} />
                ))}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );

  // Sentinel — Rate Manager preview (14-day calendar grid)
  const ROOM_TYPES = ["Standard Double", "King Suite", "Deluxe Twin"];
  const RATE_GRID = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const dow = d.getDay();
      const isWknd = dow === 5 || dow === 6;
      const baseAi = 168 + (isWknd ? 28 : 0) + Math.round(Math.sin(i * 0.4) * 14);
      const live = baseAi - Math.round(Math.random() * 8);
      const isEvent = i === 5 || i === 9;
      return {
        i,
        date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
        rooms: ROOM_TYPES.map((rt, j) => {
          const mult = j === 0 ? 1 : j === 1 ? 1.45 : 1.18;
          const ai = Math.round(baseAi * mult + (isEvent ? 22 : 0));
          const liveR = Math.round(live * mult);
          return { rt, ai, live: liveR, source: isEvent && j === 0 ? "manual" : i === 1 ? "frozen" : "ai" };
        }),
        isEvent,
        isWknd,
      };
    });
  }, []);

  const RateGridWidget = () => (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ color: R.accent, fontSize: 12, fontWeight: 600 }}>Rate Manager · 14 days forward</div>
          <div style={{ color: R.textMid, fontSize: 10, marginTop: 2 }}>Live rate vs AI recommendation, per room type, per day</div>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: R.warmTeal }} /> AI</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: R.gold }} /> Manual</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: R.textDim }} /> Frozen</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "112px repeat(14, 1fr)", gap: 2 }}>
        {/* Header row */}
        <div />
        {RATE_GRID.map((d) => (
          <div key={`h-${d.i}`} style={{ textAlign: "center", padding: "4px 0", background: d.isEvent ? `${R.red}18` : d.isWknd ? `${R.gold}10` : "transparent", borderRadius: 3 }}>
            <div style={{ color: R.textDim, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>{d.date.split(" ")[0]}</div>
            <div style={{ color: R.text, fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{d.date.split(" ")[1]}</div>
            {d.isEvent && <div style={{ color: R.red, fontSize: 7, fontWeight: 700, marginTop: 1 }}>EVENT</div>}
          </div>
        ))}
        {/* Body rows */}
        {ROOM_TYPES.map((rt, ri) => (
          <>
            <div key={`l-${rt}`} style={{ color: R.textMid, fontSize: 10, fontWeight: 500, padding: "8px 6px 0 0", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rt}</div>
            {RATE_GRID.map((d) => {
              const cell = d.rooms[ri];
              const dot = cell.source === "manual" ? R.gold : cell.source === "frozen" ? R.textDim : R.warmTeal;
              return (
                <div key={`${ri}-${d.i}`} style={{ background: R.recessed, border: `1px solid ${R.border}`, borderRadius: 4, padding: "6px 4px", textAlign: "center", position: "relative" }}>
                  <div style={{ color: R.accent, fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>£{cell.ai}</div>
                  <div style={{ color: R.textDim, fontSize: 8, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>£{cell.live}</div>
                  <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: 3, background: dot }} />
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );

  // ─── FORWARD DEMAND STRIP (illustrative) ──────────────────────────
  const forwardStrip = useMemo(() => {
    const days: number[] = [];
    for (let i = 0; i < 120; i++) {
      let v = 38 + Math.sin(i / 9) * 14 + Math.cos(i / 17) * 8;
      if (i % 7 === 5 || i % 7 === 6) v += 12;
      if (i === 22) v = 95;
      if (i === 23) v = 92;
      if (i === 47) v = 98;
      if (i === 48) v = 88;
      if (i === 78) v = 91;
      if (i === 102) v = 96;
      if (i === 103) v = 89;
      days.push(Math.max(18, Math.min(100, v)));
    }
    return days;
  }, []);

  const spikeMarkers = [
    { day: 22, label: "Concert · +63%" },
    { day: 47, label: "Conference + transit strike · +73%" },
    { day: 78, label: "Long weekend · +41%" },
    { day: 102, label: "Major fixture · +68%" },
  ];

  // ─── SLIDES ───────────────────────────────────────────────────────
  const slides = [
    // ═══════════════ SLIDE 0: TITLE ═══════════════
    <div
      key="title"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        width: "100%",
        height: "100%",
        fontFamily: FONT_STACK,
        WebkitFontSmoothing: "antialiased",
        background: R.bg,
      }}
    >
      {/* Soft radial backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, ${R.warmTeal}10 0%, transparent 50%), radial-gradient(ellipse at 50% 60%, ${R.gold}08 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      <GridBG />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "920px", padding: "0 40px" }}>
        {/* Brand wordmark — teal "(" + gold ")" matching landing page */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "12px" }}>
          <span style={{ color: R.warmTeal, fontSize: "44px", fontWeight: 300, lineHeight: 1 }}>(</span>
          <span style={{ color: R.accent, fontSize: "20px", fontWeight: 700, letterSpacing: "2.4px" }}>MARKET PULSE</span>
          <span style={{ color: R.gold, fontSize: "44px", fontWeight: 300, lineHeight: 1 }}>)</span>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "2.5px",
            color: R.gold,
            textTransform: "uppercase",
            marginBottom: "32px",
          }}
        >
          Forward Market Intelligence
        </div>

        {/* H1 — solid white. Gradient text-fill breaks in PDF export
            (Chromium renders -webkit-background-clip:text as a solid rect). */}
        <h1
          style={{
            fontSize: "60px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-2px",
            margin: "0 auto 28px",
            color: R.accent,
            maxWidth: "760px",
          }}
        >
          Millions of data points.
          <br />
          One clear picture.
        </h1>

        <p
          style={{
            color: R.text,
            fontSize: "16px",
            lineHeight: 1.7,
            maxWidth: "560px",
            margin: "0 auto 64px",
            fontWeight: 400,
          }}
        >
          Forward-looking market intelligence and real-time AI pricing — built for operators who make decisions with data,
          not instinct.
        </p>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", maxWidth: "780px", margin: "0 auto" }}>
          {[
            { n: "4,000+", l: "Hotels scraped daily" },
            { n: "120 days", l: "Forward visibility" },
            { n: "7M+", l: "Data points · every day" },
            { n: "Hourly", l: "AI pricing cycle" },
          ].map((t) => (
            <Stat key={t.l} value={t.n} label={t.l} />
          ))}
        </div>
      </div>
    </div>,

    // ═══════════════ SLIDE 1: DATA ENGINE ═══════════════
    <S key="engine">
      <Eyebrow>THE DATA ENGINE</Eyebrow>
      <H1>More market data than anyone else in our category.</H1>
      <Sub>
        Four streams of forward-looking demand intelligence — captured, fused, and ready for decision every single day.
      </Sub>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "18px" }}>
        {[
          {
            icon: <Building2 size={22} color={R.warmTeal} />,
            header: "HOTELS",
            sub: "4,000+ daily",
            body: "Live competitive scrape across 4,000+ properties — every price, every supply count, every histogram, for the next 120 days. Every day.",
            c: R.warmTeal,
          },
          {
            icon: <Calendar size={22} color={R.gold} />,
            header: "EVENTS",
            sub: "PredictHQ feed",
            body: "Concerts, sport, conferences, festivals, holidays, severe weather — with predicted attendance and geo radius.",
            c: R.gold,
          },
          {
            icon: <Plane size={22} color={R.green} />,
            header: "AIRLINES",
            sub: "Capacity + arrivals",
            body: "Scheduled seat capacity, route changes, delays, on-time performance — the leading indicator of inbound demand.",
            c: R.green,
          },
          {
            icon: <Footprints size={22} color={R.purple} />,
            header: "FOOT TRAFFIC",
            sub: "TfL + transit feeds",
            body: "Predicted crowding for any transit hub, by 15-minute slot of any day of the week — sourced from open transit feeds.",
            c: R.purple,
          },
        ].map((s) => (
          <Card key={s.header} style={{ padding: "18px 16px", borderTop: `3px solid ${s.c}` }}>
            <div style={{ marginBottom: "10px" }}>{s.icon}</div>
            <div style={{
              color: R.accent,
              fontSize: "22px",
              fontWeight: 700,
              marginBottom: "2px",
              letterSpacing: "-0.01em",
            }}>{s.header}</div>
            <div style={{ color: s.c, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px", fontWeight: 600 }}>{s.sub}</div>
            <div style={{ color: R.text, fontSize: "12px", lineHeight: 1.6 }}>{s.body}</div>
          </Card>
        ))}
      </div>

      <Card style={{
        padding: "22px 28px",
        textAlign: "center",
        background: `linear-gradient(135deg, ${R.warmTeal}10, ${R.gold}06)`,
        marginBottom: "16px",
      }}>
        <div style={{ color: R.accent, fontSize: "20px", fontWeight: 300, letterSpacing: "-0.01em" }}>
          <span style={{ color: R.gold, fontSize: "32px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>7M+ </span>
          data points captured · every single day · stored forever
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {[
          { v: "4,000+", l: "Hotels tracked" },
          { v: "120", l: "Days forward" },
          { v: "Daily", l: "Capture cadence" },
          { v: "2 yr+", l: "Historical depth" },
        ].map((s) => (
          <Stat key={s.l} value={s.v} label={s.l} />
        ))}
      </div>

    </S>,

    // ═══════════════ SLIDE 2: FORWARD VISIBILITY + SPIKES ═══════════════
    <S key="forward">
      <Eyebrow>120-DAY FORWARD VISIBILITY</Eyebrow>
      <H1>We see the spikes 4 months before they happen.</H1>
      <Sub>
        Where every other system is reacting to yesterday, we are pricing against tomorrow. Every spike, every soft week, every
        compression event — visible in the data, days or months in advance.
      </Sub>

      <Card style={{ padding: "18px 22px", borderLeft: `3px solid ${R.gold}`, marginBottom: "14px" }}>
        <div style={{ color: R.gold, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "10px" }}>
          SPIKE DETECTED · DAY +47
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "12px" }}>
          {[
            { v: "-32%", l: "Hotel supply 90d out", c: R.red },
            { v: "+18%", l: "Airline arrivals", c: R.gold },
            { v: "3", l: "Events in radius", c: R.gold },
            { v: "+112%", l: "Forecast foot traffic", c: R.gold },
          ].map((s) => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ color: s.c, fontSize: "20px", fontWeight: 600, marginBottom: "2px", fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              <div style={{ color: R.textDim, fontSize: "10px", lineHeight: 1.3 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: "10px", borderTop: `1px solid ${R.border}`, color: R.accent, fontSize: "13px", lineHeight: 1.6 }}>
          → Demand index <span style={{ color: R.gold, fontWeight: 700 }}>+73%</span> · Recommended rate
          <span style={{ color: R.green, fontWeight: 700 }}> +£42 vs baseline</span> · Surfaced
          <span style={{ color: R.warmTeal, fontWeight: 700 }}> 47 days before the date</span>.
        </div>
      </Card>

      <DemandChart />
    </S>,

    // ═══════════════ SLIDE 3: MARKET PROFILE ═══════════════
    <S key="profile">
      <Eyebrow>MARKET INTELLIGENCE</Eyebrow>
      <H1>The structural lens.</H1>
      <Sub>
        Where forward visibility is tactical, Market Profile is strategic — the long-horizon view of the market itself.
      </Sub>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "20px" }}>
        {[
          { icon: <Map size={22} color={R.warmTeal} />, title: "Neighbourhood Intelligence", body: "20+ areas ranked by absorption rate, supply depth, and volume." },
          { icon: <Activity size={22} color={R.gold} />, title: "Compression Analysis", body: "Detects dates where occupancy climbs and supply contracts in lockstep." },
          { icon: <Gauge size={22} color={R.green} />, title: "Seasonality + DOW", body: "Rolling per-asset pricing power index — not a static calendar." },
        ].map((s) => (
          <Card key={s.title} style={{ padding: "20px" }}>
            <div style={{ marginBottom: "10px" }}>{s.icon}</div>
            <div style={{ color: R.accent, fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>{s.title}</div>
            <div style={{ color: R.text, fontSize: "12px", lineHeight: 1.6 }}>{s.body}</div>
          </Card>
        ))}
      </div>
      <MarketProfileSection />
    </S>,

    // ═══════════════ SLIDE 4: BESPOKE STUDIES ═══════════════
    <S key="studies">
      <Eyebrow>BESPOKE MARKET STUDIES</Eyebrow>
      <H1>Need a custom view? We build it.</H1>
      <Sub>
        Investor decks. Acquisition due diligence. Board reports. Portfolio benchmarking. All built from the same data engine,
        branded for your audience, delivered in days — not weeks.
      </Sub>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { icon: <Briefcase size={20} color={R.warmTeal} />, title: "Investor Reports", body: "Portfolio performance vs market, narrated for LPs and stakeholders." },
          { icon: <ClipboardList size={20} color={R.gold} />, title: "Acquisition Diligence", body: "Independent market read on any asset, before you commit capital." },
          { icon: <TrendingUp size={20} color={R.green} />, title: "Board Updates", body: "Monthly or quarterly market briefings — auto-generated, always current." },
          { icon: <FileText size={20} color={R.purple} />, title: "Custom Dashboards", body: "White-labelled portals for your team, your operators, your investors." },
        ].map((s) => (
          <Card key={s.title} style={{ padding: "18px 16px" }}>
            <div style={{ marginBottom: "10px" }}>{s.icon}</div>
            <div style={{ color: R.accent, fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>{s.title}</div>
            <div style={{ color: R.text, fontSize: "12px", lineHeight: 1.55 }}>{s.body}</div>
          </Card>
        ))}
      </div>
      <ArchanesInvestorSection />
    </S>,

    // ═══════════════ SLIDE 5: SENTINEL — THE PRICING ENGINE ═══════════════
    <S key="sentinel-engine" pad="0 60px" topPad={20}>
      <p style={{ color: R.warmTeal, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: "6px", fontWeight: 600 }}>SENTINEL · THE PRICING ENGINE</p>
      <h2 style={{ color: R.accent, fontSize: "30px", fontWeight: 600, marginBottom: "6px", lineHeight: 1.15, letterSpacing: "-0.02em" }}>AI built for production. Not for demos.</h2>
      <p style={{ color: R.text, fontSize: "13px", lineHeight: 1.5, marginBottom: "14px", fontWeight: 300 }}>Five stages. Each one exists because we learned the cost of skipping it.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {[
          {
            n: "1",
            icon: <Database size={18} color={R.accent} />,
            title: "Context assembly",
            why: "Decisions are only as good as the inputs.",
            how: "Atomic snapshot of inventory, competitive WAP, demand signals, velocity, and operator constraints — one structured payload, no partial reads.",
            result: "Never decides on stale or inconsistent data.",
          },
          {
            n: "2",
            icon: <Brain size={14} color={R.accent} />,
            title: "AI decision · Navigator model",
            why: "A model that always optimises aggressively tanks an asset already behind target.",
            how: "Classifies state — Deficit, Momentum, or On-Target — and routes to a different policy per zone. Sub-second per-asset latency.",
            result: "Sells defensively when struggling, aggressively when winning.",
          },
          {
            n: "3",
            icon: <ShieldCheck size={14} color={R.accent} />,
            title: "Guardrail clamp",
            why: "AI is fast, not always wise. Operators need hard contracts.",
            how: "Min, max, freeze window, last-minute floor, manual padlock — applied in priority order. Never overridable by the model.",
            result: "No algorithmic decision can ever produce an unacceptable price.",
          },
          {
            n: "4",
            icon: <Filter size={14} color={R.accent} />,
            title: "Stability check",
            why: "Prices that thrash kill operator trust and penalise distribution.",
            how: "Stopwatch hold windows, velocity guard, £1 noise filter prevent micro-thrashing.",
            result: "Decisions fire only when there's a real reason.",
          },
          {
            n: "5",
            icon: <Send size={14} color={R.accent} />,
            title: "Push & observe",
            why: "A pricing engine that fails silently is worse than no engine at all.",
            how: "Queued jobs, retried with backoff, acknowledged per chunk. Heartbeat written after every job. Failures cluster by error signature.",
            result: "Silent failure is architecturally impossible.",
          },
        ].map((s) => (
          <Card key={s.n} style={{ padding: "10px 14px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, minWidth: "56px" }}>
              <div style={{
                width: "26px",
                height: "26px",
                borderRadius: "7px",
                backgroundColor: R.warmTeal,
                color: R.bg,
                fontSize: "12px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
              }}>
                {s.n}
              </div>
              <div>{s.icon}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: R.accent, fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>{s.title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: "12px" }}>
                <div>
                  <div style={{ color: R.gold, fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "2px" }}>WHY</div>
                  <div style={{ color: R.text, fontSize: "10px", lineHeight: 1.45 }}>{s.why}</div>
                </div>
                <div>
                  <div style={{ color: R.warmTeal, fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "2px" }}>HOW</div>
                  <div style={{ color: R.text, fontSize: "10px", lineHeight: 1.45 }}>{s.how}</div>
                </div>
                <div>
                  <div style={{ color: R.green, fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "2px" }}>RESULT</div>
                  <div style={{ color: R.accent, fontSize: "10px", lineHeight: 1.45, fontStyle: "italic" }}>{s.result}</div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </S>,

    // ═══════════════ SLIDE 6: SENTINEL IN ACTION ═══════════════
    <S key="rate-manager">
      <Eyebrow>SENTINEL · IN ACTION</Eyebrow>
      <H1>Live rates, AI rates, side-by-side.</H1>
      <Sub>
        What an operator sees every morning — Sentinel's recommendation against the live channel rate, every room, every future date.
      </Sub>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {[
          {
            t: "Stops underpriced peaks",
            c: R.gold,
            body: "Captures the revenue static rates leave on the table when demand spikes.",
          },
          {
            t: "Stops overpriced softness",
            c: R.warmTeal,
            body: "Protects occupancy on quiet days without eroding rate over time.",
          },
          {
            t: "Stops rate thrash",
            c: R.green,
            body: "Channels stay stable, distribution partners reward consistency, OTAs trust your inventory.",
          },
        ].map((b) => (
          <Card key={b.t} style={{ padding: "14px 16px", borderTop: `3px solid ${b.c}` }}>
            <div style={{ color: b.c, fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", marginBottom: "6px" }}>{b.t}</div>
            <div style={{ color: R.text, fontSize: "11px", lineHeight: 1.6 }}>{b.body}</div>
          </Card>
        ))}
      </div>
      <RateGridWidget />
    </S>,

    // ═══════════════ SLIDE 7: MODES + HEALTH ═══════════════
    <S key="modes">
      <Eyebrow>SENTINEL · TRUST & CONTROL</Eyebrow>
      <H1>Three modes. Built-in observability.</H1>
      <Sub>
        Operators choose the level of autonomy. The platform reports on itself — silent failure is impossible by design.
      </Sub>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <Card style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Layers size={16} color={R.warmTeal} />
            <div style={{ color: R.accent, fontSize: "12px", fontWeight: 600 }}>Three modes of operation</div>
          </div>
          {[
            { name: "Shadow", c: R.text, body: "AI suggests. Human applies." },
            { name: "Assisted", c: R.gold, body: "AI applies inside guardrails. Operator reviews exceptions." },
            { name: "Autopilot", c: R.green, body: "End-to-end automation. Operator handles strategy only." },
          ].map((m, i) => (
            <div key={m.name} style={{ display: "flex", gap: "10px", paddingBottom: "6px", marginBottom: "6px", borderBottom: i === 2 ? "none" : `1px solid ${R.sep}` }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "4px", backgroundColor: m.c, marginTop: "4px", flexShrink: 0 }} />
              <div>
                <div style={{ color: m.c, fontSize: "12px", fontWeight: 600, marginBottom: "1px" }}>{m.name}</div>
                <div style={{ color: R.text, fontSize: "10px", lineHeight: 1.45 }}>{m.body}</div>
              </div>
            </div>
          ))}
        </Card>
        <Card style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Activity size={16} color={R.warmTeal} />
            <div style={{ color: R.accent, fontSize: "12px", fontWeight: 600 }}>Sentinel Health</div>
          </div>
          <p style={{ color: R.text, fontSize: "11px", lineHeight: 1.55, marginBottom: "10px" }}>
            Every asset emits a heartbeat after every job. Fleet-wide status, 30-day sparklines, clustered failure feed.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {[
              { c: R.green, l: "Healthy" },
              { c: R.gold, l: "Warning" },
              { c: R.red, l: "Failing" },
              { c: R.textDim, l: "Off" },
            ].map((s) => (
              <div key={s.l} style={{ padding: "8px 6px", border: `1px solid ${R.border}`, borderRadius: "5px", textAlign: "center" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "5px", backgroundColor: s.c, margin: "0 auto 4px" }} />
                <div style={{ color: R.text, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <SentinelHealthSection />
    </S>,

    // ═══════════════ SLIDE 8: CONCLUSION ═══════════════
    <div
      key="conclusion"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        position: "relative",
        width: "100%",
        height: "100%",
        fontFamily: FONT_STACK,
      }}
    >
      <GridBG />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "880px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "40px" }}>
          <span style={{ color: R.warmTeal, fontSize: "44px", fontWeight: 300, lineHeight: 1 }}>(</span>
          <span style={{ color: R.accent, fontSize: "20px", letterSpacing: "2.4px", fontWeight: 700 }}>MARKET PULSE</span>
          <span style={{ color: R.gold, fontSize: "44px", fontWeight: 300, lineHeight: 1 }}>)</span>
        </div>
        <h2 style={{ color: R.accent, fontSize: "44px", fontWeight: 600, marginBottom: "20px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
          Built. Live. Ready.
        </h2>
        <p style={{ color: R.text, fontSize: "16px", lineHeight: 1.7, marginBottom: "44px", maxWidth: "720px", margin: "0 auto 44px" }}>
          The data engine, the intelligence layer, the AI pricing engine, the safety architecture, the observability —
          all of it shipping in production today.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "44px", maxWidth: "780px", margin: "0 auto 44px" }}>
          {[
            { v: "4,000+", l: "Hotels scraped daily" },
            { v: "7M+", l: "Data points · every day" },
            { v: "120 days", l: "Forward visibility" },
            { v: "Hourly", l: "AI pricing cycle" },
          ].map((t) => (
            <Stat key={t.l} value={t.v} label={t.l} />
          ))}
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px 26px",
            border: `1px solid ${R.warmTeal}`,
            borderRadius: "8px",
            color: R.warmTeal,
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Let's talk about what we can build for you
          <ArrowRight size={18} />
        </div>
      </div>
    </div>,
  ];

  const totalSlides = slides.length;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((s) => Math.max(0, s - 1));
      }
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [totalSlides, onBack]);

  const handlePrint = () => window.print();

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
            background: ${R.bg} !important;
          }
          .deck-controls { display: none !important; }
          .slide-container { overflow: visible !important; background: ${R.bg} !important; }
          .slide {
            width: 100vw !important;
            height: 100vh !important;
            page-break-after: always;
            page-break-inside: avoid;
            display: flex !important;
            background-color: ${R.bg} !important;
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

      <div
        className="deck-controls"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: `${R.sidebar}f0`,
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${R.border}`,
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: FONT_STACK,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: R.text,
            fontSize: "13px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            style={{
              background: "none",
              border: "none",
              cursor: currentSlide === 0 ? "default" : "pointer",
              color: currentSlide === 0 ? R.textDim : R.text,
              padding: "4px",
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ color: R.accent, fontSize: "13px", minWidth: "60px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
            {currentSlide + 1} / {totalSlides}
          </span>
          <button
            onClick={() => setCurrentSlide(Math.min(totalSlides - 1, currentSlide + 1))}
            disabled={currentSlide === totalSlides - 1}
            style={{
              background: "none",
              border: "none",
              cursor: currentSlide === totalSlides - 1 ? "default" : "pointer",
              color: currentSlide === totalSlides - 1 ? R.textDim : R.text,
              padding: "4px",
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={handlePrint}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: R.warmTeal,
            fontSize: "13px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <Printer size={16} /> Export PDF
        </button>
      </div>

      <div className="slide-container" style={{ backgroundColor: R.bg, minHeight: "100vh" }}>
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`slide ${i === currentSlide ? "active" : ""}`}
            style={{
              width: "100vw",
              height: "100vh",
              backgroundColor: R.bg,
              boxSizing: "border-box",
              paddingTop: "52px",
            }}
          >
            {slide}
          </div>
        ))}
      </div>
    </>
  );
}
