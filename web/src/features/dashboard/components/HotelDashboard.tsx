import { useState, useEffect, useMemo } from "react";
import { DynamicYTDTrend } from "./DynamicYTDTrend";
import { OwnHotelOccupancy } from "./OwnHotelOccupancy";
import { RecentBookings } from "./RecentBookings";
import { DataPendingBlur } from "../../../components/ui/DataPendingBlur";
import { R } from "../../../styles/tokens";
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
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { type DashboardData } from "../api/dashboard.api";

// ── Chart colors (matching Demand Radar, mapped to agreed palette) ──
const CH = {
  accent: R.warmTeal,      // bar default + trend line
  gold: R.gold,        // busy bars (70-84%)
  red: R.red,          // very busy bars (85%+)
  text: R.accent,
  textMid: R.textMid,
  textDim: R.textDim,
  border: R.border,
  green: R.green,
};

interface HotelDashboardProps {
  onNavigate: (view: string) => void;
  data: DashboardData | null;
  isLoading: boolean;
  citySlug?: string;
}

export function HotelDashboard({
  onNavigate,
  data,
  isLoading,
  citySlug,
}: HotelDashboardProps) {
  const snapshot = data?.snapshot || {
    lastMonth: { label: "...", revenue: 0, occupancy: 0, adr: 0, yoyChange: 0, targetRevenue: null, pacingStatus: null, lastYear: { revenue: 0, occupancy: 0, adr: 0 } },
    currentMonth: { label: "...", revenue: 0, occupancy: 0, adr: 0, yoyChange: 0, targetRevenue: null, pacingStatus: null, lastYear: { revenue: 0, occupancy: 0, adr: 0 } },
    nextMonth: { label: "...", revenue: 0, occupancy: 0, adr: 0, yoyChange: 0, targetRevenue: null, pacingStatus: null, lastYear: { revenue: 0, occupancy: 0, adr: 0 } },
  };

  const marketOutlook = data?.marketOutlook || { status: "stable" as const, metric: "..." };
  const trendData = data?.forwardDemandChartData || [];
  const ytdTrendData = data?.ytdTrend || [];
  const isNewHotel = !trendData || trendData.length === 0;

  const currencySymbol = (data as any)?.currencySymbol || (data as any)?.currency || "£";
  const fmt = (v: number) => `${currencySymbol}${(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // ── Fetch events for chart overlay ──
  const [phqEvents, setPhqEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!citySlug) { setPhqEvents([]); return; }
    fetch(`/api/market/events?citySlug=${citySlug}`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then(d => setPhqEvents(d.events || []))
      .catch(() => setPhqEvents([]));
  }, [citySlug]);

  // ── Build enriched chart data with 7d MA + events ──
  const chartDays = useMemo(() => {
    if (!trendData.length) return [];

    // Compute 7d moving average
    const withMa = trendData.map((entry: any, i: number) => {
      const win = trendData.slice(Math.max(0, i - 6), i + 1);
      const demandMa = Math.round(win.reduce((s: number, d: any) => s + (d.marketDemand || 0), 0) / win.length);
      return { ...entry, demandMa };
    });

    // Build event map from PHQ events
    const seen = new Set<string>();
    const topEvents = [...phqEvents]
      .filter(ev => ev.localRank >= 90)
      .sort((a, b) => (b.attendance || 0) - (a.attendance || 0))
      .filter(ev => { if (seen.has(ev.title)) return false; seen.add(ev.title); return true; })
      .slice(0, 10);
    const topTitles = new Set(topEvents.map(e => e.title));

    const eventMap = new Map<string, any>();
    const addDays = (dateStr: string, n: number) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + n));
      return dt.toISOString().slice(0, 10);
    };
    for (const ev of phqEvents) {
      if (!topTitles.has(ev.title)) continue;
      const start = (ev.start || "").slice(0, 10);
      const end = (ev.end || ev.start || "").slice(0, 10);
      if (!start) continue;
      for (let key = start; key <= end; key = addDays(key, 1)) {
        const existing = eventMap.get(key);
        if (!existing || ev.localRank > existing.localRank) {
          eventMap.set(key, { name: ev.title, localRank: ev.localRank, attendance: ev.attendance, category: ev.category });
        }
      }
    }

    // Attach events to chart days
    return withMa.map((day: any, i: number) => {
      const dateKey = day.fullDate || day.date;
      return { ...day, i, event: eventMap.get(dateKey) || null };
    });
  }, [trendData, phqEvents]);

  // ── Event label spans for duration bars ──
  const eventSpans = useMemo(() => {
    const result: { name: string; startIdx: number; endIdx: number; localRank: number }[] = [];
    const seen = new Set<string>();
    for (const d of chartDays) {
      if (!d.event || seen.has(d.event.name)) continue;
      seen.add(d.event.name);
      const first = chartDays.findIndex((x: any) => x.event?.name === d.event.name);
      let last = first;
      for (let j = first + 1; j < chartDays.length; j++) {
        if (chartDays[j].event?.name === d.event.name) last = j;
        else if (j - last > 2) break;
      }
      if (last > first) result.push({ name: d.event.name, startIdx: first, endIdx: last, localRank: d.event.localRank });
    }
    return result;
  }, [chartDays]);

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", background: R.bg }}>
        <div style={{ textAlign: "center", color: R.textMid }}>
          <div className="w-12 h-12 border-4 border-t-transparent border-solid rounded-full animate-spin" style={{ margin: "0 auto 20px auto", borderColor: R.warmTeal, borderTopColor: "transparent" }} />
          Loading Dashboard...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", background: R.bg }}>
        <div style={{ textAlign: "center", color: R.red }}>
          <AlertCircle style={{ width: 48, height: 48, margin: "0 auto 12px auto" }} />
          <h3>Error Loading Dashboard</h3>
        </div>
      </div>
    );
  }

  const renderMonthCard = (
    period: { label: string; revenue: number; occupancy: number; adr: number; yoyChange: number; lastYear?: { revenue: number; occupancy: number; adr: number } },
    title: string
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
              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 3,
              background: up ? "rgba(52,208,104,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${up ? "rgba(52,208,104,0.25)" : "rgba(239,68,68,0.25)"}`,
              color: up ? R.green : R.red,
            }}>
              {up ? "▲" : "▼"} YOY {up ? "+" : ""}{(period.yoyChange || 0).toFixed(1)}%
            </div>
          )}
        </div>

        <div style={{ fontSize: 28, fontWeight: 600, color: "#7BAFD4", marginBottom: 2 }}>{fmt(period.revenue)}</div>
        <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", marginBottom: 14 }}>Total Revenue</div>

        <div style={{ borderTop: `1px solid ${R.sep}`, paddingTop: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0, fontSize: 11 }}>
            <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6 }} />
            <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>This Year</div>
            <div style={{ color: R.textDim, fontSize: 9, textTransform: "uppercase", paddingBottom: 6, textAlign: "right", minWidth: 60 }}>Last Year</div>
            {[
              { label: "Revenue", ty: fmt(period.revenue), ly: hasLY ? fmt(ly!.revenue) : "—" },
              { label: "Occupancy", ty: `${(period.occupancy || 0).toFixed(1)}%`, ly: hasLY ? `${(ly!.occupancy || 0).toFixed(1)}%` : "—" },
              { label: "ADR", ty: fmt(period.adr), ly: hasLY ? fmt(ly!.adr) : "—" },
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
        {/* 3 Month Performance Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          {renderMonthCard(snapshot.lastMonth, "Last Month")}
          {renderMonthCard(snapshot.currentMonth, "Current Month")}
          {renderMonthCard(snapshot.nextMonth, "Next Month")}
        </div>

        {/* Occupancy Chart (2/3) + Recent Bookings (1/3) */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 24 }}>
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <OwnHotelOccupancy data={data?.flowcast || []} />
          </div>
          <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
            <RecentBookings
              data={data?.recentActivity || []}
              currencySymbol={currencySymbol}
              onViewFullReport={() => onNavigate("reports:bookings-report")}
            />
          </div>
        </div>

        {/* Market Outlook Banner + Forward Demand Chart */}
        <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
          {/* Outlook Banner */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
            borderBottom: `1px solid ${marketOutlook.status === "strengthening" ? "rgba(52,208,104,0.08)" : marketOutlook.status === "softening" ? "rgba(239,68,68,0.08)" : "rgba(200,166,110,0.08)"}`,
            background: marketOutlook.status === "strengthening" ? "rgba(52,208,104,0.03)" : marketOutlook.status === "softening" ? "rgba(239,68,68,0.03)" : "rgba(200,166,110,0.03)",
          }}>
            {marketOutlook.status === "softening" ? (
              <TrendingDown size={16} color={R.red} />
            ) : (
              <TrendingUp size={16} color={marketOutlook.status === "strengthening" ? R.green : R.gold} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 500,
                color: marketOutlook.status === "strengthening" ? R.green : marketOutlook.status === "softening" ? R.red : R.gold,
              }}>
                {isNewHotel ? "System Initializing" : `The 30-day market demand is ${marketOutlook.status}`}
              </div>
              <div style={{ fontSize: 11, color: R.textDim, marginTop: 2 }}>
                {isNewHotel ? "Full market intelligence will be available in approximately 24 hours." : "Forward-looking 90-day outlook"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 20, fontWeight: 600, lineHeight: 1,
                color: marketOutlook.status === "strengthening" ? R.green : marketOutlook.status === "softening" ? R.red : R.gold,
              }}>
                {isNewHotel ? "..." : marketOutlook.metric}
              </div>
              <div style={{ fontSize: 10, color: R.textDim, marginTop: 3 }}>vs 30 days ago</div>
            </div>
          </div>

          {/* Demand Chart — Demand Radar style */}
          <button
            onClick={() => onNavigate("demand-pace")}
            style={{ width: "100%", background: "transparent", border: 0, padding: "20px", textAlign: "left", cursor: "pointer" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>How Busy Is the Market?</div>
                <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>Market demand score — higher means busier, stronger pricing power</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Legend */}
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 12, height: 2, background: CH.accent, borderRadius: 1 }} />
                  <span style={{ fontSize: 9, color: CH.textDim }}>Demand</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <div style={{ width: 12, height: 2, background: CH.accent, borderRadius: 1, borderBottom: "2px dashed transparent", opacity: 0.7 }} />
                  <span style={{ fontSize: 9, color: CH.textDim }}>7d trend</span>
                </div>
                <ExternalLink size={14} style={{ color: R.textDim }} />
              </div>
            </div>

            <div style={{ position: "relative" }}>
              {/* Event labels above chart */}
              {chartDays.some((d: any) => d.event) && (
                <div style={{ position: "relative", height: 100, marginLeft: 20, marginRight: 10, borderBottom: `1px solid ${R.border}`, overflow: "hidden" }}>
                  {/* Rotated event names */}
                  <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                    {chartDays.map((d: any) => {
                      if (!d.event) return <div key={d.i} style={{ flex: 1 }} />;
                      const prev = chartDays[d.i - 1];
                      if (prev?.event?.name === d.event.name) return <div key={d.i} style={{ flex: 1 }} />;
                      return (
                        <div key={d.i} style={{ flex: 1, position: "relative", overflow: "visible" }}>
                          <div style={{
                            position: "absolute", bottom: 14, left: 0,
                            transform: "rotate(-45deg)", transformOrigin: "bottom left",
                            whiteSpace: "nowrap", fontSize: 10, fontWeight: 500,
                            color: CH.accent, opacity: d.event.localRank >= 95 ? 0.8 : 0.5,
                          }}>
                            {d.event.name.length > 24 ? d.event.name.slice(0, 22) + "…" : d.event.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Duration span bars */}
                  {eventSpans.map(span => {
                    const leftPct = (span.startIdx / chartDays.length) * 100;
                    const widthPct = ((span.endIdx - span.startIdx + 1) / chartDays.length) * 100;
                    return (
                      <div key={span.name} style={{
                        position: "absolute", bottom: 0,
                        left: `${leftPct}%`, width: `${widthPct}%`,
                        height: 4, backgroundColor: CH.accent,
                        opacity: span.localRank >= 95 ? 0.4 : 0.2, borderRadius: 2,
                      }} />
                    );
                  })}
                </div>
              )}

              {/* Background event column tints */}
              {chartDays.some((d: any) => d.event) && (
                <div style={{ position: "absolute", top: chartDays.some((d: any) => d.event) ? 100 : 0, left: 20, right: 10, bottom: 0, display: "flex", pointerEvents: "none" }}>
                  {chartDays.map((d: any) => (
                    <div key={d.i} style={{ flex: 1, backgroundColor: d.event ? CH.accent : "transparent", opacity: d.event ? (d.event.localRank >= 95 ? 0.06 : 0.03) : 0 }} />
                  ))}
                </div>
              )}

              {/* Chart */}
              <div style={{ height: 260 }}>
                <DataPendingBlur isPending={isNewHotel} message="Collecting Market Data. Check back in a couple of days...">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartDays} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <XAxis dataKey="date" stroke={CH.border} tick={{ fill: CH.textDim, fontSize: 9 }} tickLine={false} axisLine={{ stroke: CH.border, strokeOpacity: 0.3 }} interval={13} />
                      <YAxis stroke={CH.border} tick={{ fill: CH.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={35} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip
                        cursor={{ stroke: CH.accent, strokeOpacity: 0.15, strokeWidth: 1 }}
                        contentStyle={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${CH.border}`, borderRadius: 6, padding: "10px 14px" }}
                        labelStyle={{ color: CH.textMid, fontSize: 11, marginBottom: 4 }}
                        itemStyle={{ fontSize: 12, color: CH.text, padding: "1px 0" }}
                        formatter={(v: number, name: string) => [`${v}%`, name]}
                      />
                      <Bar dataKey="marketDemand" name="Demand" radius={[2, 2, 0, 0]} maxBarSize={10}>
                        {chartDays.map((d: any, i: number) => {
                          const v = d.marketDemand || 0;
                          if (v >= 85) return <Cell key={i} fill={CH.red} fillOpacity={0.75} />;
                          if (v >= 70) return <Cell key={i} fill={CH.gold} fillOpacity={0.55} />;
                          return <Cell key={i} fill={CH.accent} fillOpacity={0.25 + (v / 100) * 0.45} />;
                        })}
                      </Bar>
                      <Line type="monotone" dataKey="demandMa" name="7d trend" stroke={CH.accent} strokeWidth={2} strokeDasharray="6 3" dot={false} strokeOpacity={0.7} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </DataPendingBlur>
              </div>
            </div>
          </button>
        </div>

        {/* YTD Performance */}
        <DynamicYTDTrend onNavigate={onNavigate} data={ytdTrendData} currencySymbol={currencySymbol} />
      </div>
    </div>
  );
}
