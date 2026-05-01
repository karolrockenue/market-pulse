import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { R } from "../../../styles/tokens";
import { OwnHotelOccupancy } from "../../dashboard/components/OwnHotelOccupancy";
import { RecentBookings } from "../../dashboard/components/RecentBookings";
import { DynamicYTDTrend } from "../../dashboard/components/DynamicYTDTrend";

// ── Mock fixtures ────────────────────────────────────────────────────────────
const SNAPSHOT = {
  lastMonth: {
    label: "MAR 2026",
    revenue: 142_300,
    occupancy: 81.4,
    adr: 218,
    yoyChange: 6.2,
    lastYear: { revenue: 134_010, occupancy: 78.1, adr: 209 },
  },
  currentMonth: {
    label: "APR 2026",
    revenue: 168_900,
    occupancy: 86.7,
    adr: 232,
    yoyChange: 9.1,
    lastYear: { revenue: 154_810, occupancy: 82.4, adr: 221 },
  },
  nextMonth: {
    label: "MAY 2026",
    revenue: 188_400,
    occupancy: 88.2,
    adr: 245,
    yoyChange: 11.4,
    lastYear: { revenue: 169_120, occupancy: 84.0, adr: 230 },
  },
};

const FLOWCAST = Array.from({ length: 90 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const iso = d.toISOString().slice(0, 10);
  const dow = d.getDay();
  const isWeekend = dow === 5 || dow === 6;
  const base = 60 + Math.sin(i / 9) * 18 + (isWeekend ? 12 : 0);
  const occ = Math.max(20, Math.min(98, Math.round(base + (Math.random() * 6 - 3))));
  return {
    date: iso.slice(5),
    fullDate: iso,
    occupancy: occ,
    pickup24h: Math.round((Math.random() * 4) - 1),
    pickup3d: Math.round((Math.random() * 8) - 2),
    pickup7d: Math.round((Math.random() * 14) - 3),
    baseOccupancy24h: Math.max(0, occ - 2),
    baseOccupancy3d: Math.max(0, occ - 5),
    baseOccupancy7d: Math.max(0, occ - 9),
    isWeekend,
  };
});

const RECENT_ACTIVITY = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  const iso = d.toISOString().slice(0, 10);
  const bookings = 4 + Math.round(Math.random() * 9);
  const nights = bookings + Math.round(Math.random() * 8);
  const adr = 210 + Math.round(Math.random() * 50);
  return {
    date: iso,
    dateStr: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    bookings,
    roomNights: nights,
    adr,
    revenue: nights * adr,
    isToday: i === 6,
  };
});

const DEMAND_CHART = Array.from({ length: 90 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  const iso = d.toISOString().slice(0, 10);
  const v = 50 + Math.sin(i / 6) * 22 + (Math.random() * 10 - 5);
  return { date: iso.slice(5), fullDate: iso, marketDemand: Math.max(15, Math.min(95, Math.round(v))) };
});

const YTD_TREND = (() => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((m, i) => {
    const ty = 110_000 + i * 8_000 + Math.round(Math.random() * 12_000);
    const ly = ty * (0.88 + Math.random() * 0.06);
    const occTy = 70 + Math.round(Math.random() * 18);
    const occLy = occTy - 4 + Math.round(Math.random() * 4);
    const adrTy = 200 + Math.round(Math.random() * 40);
    const adrLy = adrTy - 8 - Math.round(Math.random() * 10);
    const isMTD = i === 3; // April mid-month
    return {
      month: m,
      monthIndex: i,
      isMTD,
      revenue: { thisYear: ty, lastYear: Math.round(ly) },
      occupancy: { thisYear: occTy, lastYear: occLy },
      adr: { thisYear: adrTy, lastYear: adrLy },
      roomsSold: { thisYear: Math.round(ty / adrTy), lastYear: Math.round(ly / adrLy) },
    };
  });
})();

// ── Booking-sources mock (the new widget) ───────────────────────────────────
const CHANNEL_COLORS: Record<string, string> = {
  "Booking.com": "#3B82F6",
  "Direct (Website)": "#34D068",
  "Expedia": "#F59E0B",
  "Walk-in / Phone": "#8B5CF6",
  "Hotels.com / Vrbo": "#EC4899",
  "Agoda": "#F97316",
  "GDS / Corporate": "#38C6BA",
  "Other OTA": "#7A8494",
};

const BOOKING_SOURCES = [
  { name: "Booking.com",       revenue: 539_400, nights: 2180, commissionPct: 17, yoy: 4.2 },
  { name: "Direct (Website)",  revenue: 312_200, nights: 1260, commissionPct: 0,  yoy: 12.8 },
  { name: "Expedia",           revenue: 199_300, nights: 810,  commissionPct: 15, yoy: -2.1 },
  { name: "Walk-in / Phone",   revenue: 113_400, nights: 460,  commissionPct: 0,  yoy: -0.8 },
  { name: "Hotels.com / Vrbo", revenue: 85_100,  nights: 340,  commissionPct: 15, yoy: 1.4 },
  { name: "Agoda",             revenue: 71_200,  nights: 290,  commissionPct: 17, yoy: 6.0 },
  { name: "GDS / Corporate",   revenue: 71_000,  nights: 290,  commissionPct: 10, yoy: -5.3 },
  { name: "Other OTA",         revenue: 28_400,  nights: 115,  commissionPct: 15, yoy: 0.5 },
];

// ────────────────────────────────────────────────────────────────────────────
const fmt = (v: number) => `£${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `£${(v / 1_000).toFixed(1)}k`;
  return `£${v}`;
};

function BookingSourcesYTD() {
  const total = useMemo(() => BOOKING_SOURCES.reduce((s, c) => s + c.revenue, 0), []);

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>Booking Sources — YTD</div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>Revenue mix by channel, Jan 1 → today</div>
        </div>
        <div style={{ fontSize: 11, color: R.accent, fontVariantNumeric: "tabular-nums" }}>{fmtCompact(total)}</div>
      </div>

      {/* Table */}
      <div style={{ padding: "4px 20px 12px", flex: 1, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ textAlign: "left", padding: "8px 4px", fontWeight: 500 }}>Channel</th>
              <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: 500 }}>Revenue</th>
              <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: 500 }}>Mix</th>
              <th style={{ textAlign: "right", padding: "8px 4px", fontWeight: 500 }}>ADR</th>
            </tr>
          </thead>
          <tbody>
            {BOOKING_SOURCES.map((c) => {
              const mix = (c.revenue / total) * 100;
              const adr = c.revenue / c.nights;
              return (
                <tr key={c.name} style={{ borderTop: `1px solid ${R.sep}` }}>
                  <td style={{ padding: "7px 4px", color: R.text }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: CHANNEL_COLORS[c.name], flexShrink: 0 }} />
                      {c.name}
                    </div>
                  </td>
                  <td style={{ padding: "7px 4px", textAlign: "right", color: R.accent, fontVariantNumeric: "tabular-nums" }}>{fmt(c.revenue)}</td>
                  <td style={{ padding: "7px 4px", textAlign: "right", color: R.textMid, fontVariantNumeric: "tabular-nums" }}>{mix.toFixed(1)}%</td>
                  <td style={{ padding: "7px 4px", textAlign: "right", color: R.textMid, fontVariantNumeric: "tabular-nums" }}>£{Math.round(adr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketPulseHeadlines() {
  const tiles = [
    { label: "Demand Score",       value: "72",       unit: "/100",  delta: "▲ +8",     deltaTone: R.green, sub: "vs 30 days ago" },
    { label: "Forward Occupancy",  value: "78",       unit: "%",     delta: "▲ +4 pts", deltaTone: R.green, sub: "market avg, next 30d" },
    { label: "Market ADR",         value: "£214",     unit: "",      delta: "▲ +£12",   deltaTone: R.green, sub: "next 30d vs 30d ago" },
    { label: "High-Demand Days",   value: "14",       unit: " days", delta: "▲ +3",     deltaTone: R.green, sub: "next 60d (>85% score)" },
    { label: "Compset Rate Move",  value: "+£8",      unit: "",      delta: "▲ 7d avg", deltaTone: R.green, sub: "competitor rates rising" },
    { label: "Major Events",       value: "4",        unit: "",      delta: "top: F1 Brit GP", deltaTone: R.gold, sub: "next 30 days" },
  ];

  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header with inline outlook chip */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>How the Market Is Doing</div>
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>Forward 30–60 day market read for your area</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: "rgba(52,208,104,0.08)", border: "1px solid rgba(52,208,104,0.25)", color: R.green,
        }}>
          <TrendingUp size={11} /> strengthening
        </div>
      </div>

      {/* Narrative line */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${R.sep}`, fontSize: 12, color: R.text, lineHeight: 1.4 }}>
        Demand is up <span style={{ color: R.green, fontWeight: 600 }}>+8%</span> over the last 30 days, with a peak window <span style={{ color: R.accent, fontWeight: 600 }}>May 12–14</span> driven by the British Grand Prix.
      </div>

      {/* 3×2 grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
        {tiles.map((t, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          return (
            <div key={t.label} style={{
              padding: "14px 18px",
              borderRight: col < 2 ? `1px solid ${R.sep}` : "none",
              borderBottom: row === 0 ? `1px solid ${R.sep}` : "none",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ fontSize: 9, color: R.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{t.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 4 }}>
                <span style={{ fontSize: 24, fontWeight: 600, color: R.accent, lineHeight: 1 }}>{t.value}</span>
                {t.unit && <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>{t.unit}</span>}
              </div>
              <div style={{ fontSize: 11, color: t.deltaTone, marginTop: 6, fontWeight: 500 }}>{t.delta}</div>
              <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{t.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mockup page ─────────────────────────────────────────────────────────────
export function MPDashboardMockup() {
  const renderMonthCard = (
    period: { label: string; revenue: number; occupancy: number; adr: number; yoyChange: number; lastYear?: { revenue: number; occupancy: number; adr: number } },
    title: string,
  ) => {
    const up = period.yoyChange > 0;
    const ly = period.lastYear;
    const hasLY = ly && (ly.revenue > 0 || ly.occupancy > 0);
    return (
      <div style={{ border: `1px solid ${R.border}`, borderRadius: 10, padding: "18px 20px", background: R.darkBand }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, color: R.accent, textTransform: "uppercase", letterSpacing: -0.3 }}>{title}</div>
            <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase" }}>{period.label}</div>
          </div>
          {period.yoyChange !== 0 && (
            <div style={{
              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 3,
              background: up ? "rgba(52,208,104,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${up ? "rgba(52,208,104,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: up ? R.green : R.red,
            }}>
              {up ? "▲" : "▼"} YOY {up ? "+" : ""}{period.yoyChange.toFixed(1)}%
            </div>
          )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#7BAFD4", marginBottom: 2 }}>{fmt(period.revenue)}</div>
        <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", marginBottom: 14 }}>Total Revenue</div>
        <div style={{ borderTop: `1px solid ${R.sep}`, paddingTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0, fontSize: 11 }}>
            <div style={{ paddingBottom: 6 }} />
            <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>This Year</div>
            <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>Last Year</div>
            {[
              { label: "Revenue",   ty: fmt(period.revenue),                ly: hasLY ? fmt(ly!.revenue) : "—" },
              { label: "Occupancy", ty: `${period.occupancy.toFixed(1)}%`,  ly: hasLY ? `${ly!.occupancy.toFixed(1)}%` : "—" },
              { label: "ADR",       ty: fmt(period.adr),                    ly: hasLY ? fmt(ly!.adr) : "—" },
            ].map((row, ri) => (
              <div key={row.label} style={{ display: "contents" }}>
                <div style={{ color: R.textMid, padding: "5px 0", borderTop: ri === 0 ? `1px solid ${R.sep}` : "none" }}>{row.label}</div>
                <div style={{ color: R.accent, padding: "5px 0", textAlign: "right", borderTop: ri === 0 ? `1px solid ${R.sep}` : "none" }}>{row.ty}</div>
                <div style={{ color: R.textDim, padding: "5px 0", textAlign: "right", borderTop: ri === 0 ? `1px solid ${R.sep}` : "none" }}>{row.ly}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ padding: "24px 28px" }}>
        {/* Studio banner */}
        <div style={{ background: "rgba(200,166,110,0.06)", border: `1px solid rgba(200,166,110,0.2)`, borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 11, color: R.gold, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: R.gold, color: R.bg, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>STUDIO</span>
          MP Dashboard mockup — <strong style={{ color: R.accent }}>Booking Sources YTD</strong> + <strong style={{ color: R.accent }}>How Busy Is the Market?</strong> compressed and placed side-by-side as a single row.
        </div>

        {/* 3 Month Performance Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {renderMonthCard(SNAPSHOT.lastMonth, "Last Month")}
          {renderMonthCard(SNAPSHOT.currentMonth, "Current Month")}
          {renderMonthCard(SNAPSHOT.nextMonth, "Next Month")}
        </div>

        {/* Occupancy Chart (2/3) + Recent Bookings (1/3) */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 24 }}>
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <OwnHotelOccupancy data={FLOWCAST as any} />
          </div>
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <RecentBookings data={RECENT_ACTIVITY as any} currencySymbol="£" />
          </div>
        </div>

        {/* ── Combined row: Booking Sources YTD + How Busy Is the Market? ── */}
        <div style={{ display: "grid", gridTemplateColumns: "35fr 65fr", gap: 12, marginBottom: 24, alignItems: "stretch" }}>
          <BookingSourcesYTD />
          <MarketPulseHeadlines />
        </div>

        {/* YTD Performance */}
        <DynamicYTDTrend data={YTD_TREND} currencySymbol="£" />
      </div>
    </div>
  );
}
