import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { R } from "../../../styles/tokens";

// ── Mason & Fifth — Rate-by-Studio / Rate-by-Segment charts ──
// Dom's three rate charts (source: "Av Studio Table"), restyled in Market
// Pulse. Embedded in the Sales Flash right column + the Studio mockup. Live
// data comes from /api/mason/sales-flash → rateCharts (room categories +
// rates from Mews). If no `data` is passed it falls back to sample values
// (used by the Studio mockup).

type Pt = { name: string; value: number };
export interface RateChartsData {
  ssAdrByCategory: Pt[];
  amrBySegment: Pt[];
  lsAmrByCategory: Pt[];
}

const GBP = (v: number) => `£${Math.round(v).toLocaleString()}`;
const GBP_K = (v: number) => `£${(v / 1000).toFixed(1)}k`;

const SAMPLE: RateChartsData = {
  ssAdrByCategory: [
    { name: "All", value: 204 },
    { name: "Classic", value: 190 },
    { name: "Classic Plus", value: 212 },
    { name: "Classic Biggie", value: 256 },
    { name: "Accessible Plus", value: 231 },
  ],
  amrBySegment: [
    { name: "1–3 mo", value: 3145 },
    { name: "3–6 mo", value: 2944 },
    { name: "6–9 mo", value: 2576 },
    { name: "9–12 mo", value: 2521 },
    { name: "12+ mo", value: 2344 },
  ],
  lsAmrByCategory: [
    { name: "Classic", value: 2303 },
    { name: "Classic Plus", value: 2500 },
    { name: "Classic Biggie", value: 2750 },
    { name: "Accessible Plus", value: 2450 },
  ],
};

function ChartTip({ active, payload, fmt }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: "rgba(18,21,25,0.96)", border: `1px solid ${R.border}`, borderRadius: 6, padding: "8px 12px" }}>
      <div style={{ color: R.textMid, fontSize: 11 }}>{p.payload.name}</div>
      <div style={{ color: R.text, fontSize: 14, fontWeight: 600 }}>{fmt(p.value)}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, empty, children }: { title: string; subtitle: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: R.accent }}>{title}</div>
      <div style={{ fontSize: 10, color: R.textDim, marginTop: 2, marginBottom: 12 }}>{subtitle}</div>
      {empty ? (
        <div style={{ color: R.textDim, fontSize: 11, padding: "30px 0", textAlign: "center" }}>No data for this month.</div>
      ) : children}
    </div>
  );
}

function VBars({ data, color, fmt }: { data: Pt[]; color: string; fmt: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 5 }}>
        <CartesianGrid stroke={R.border} opacity={0.22} vertical={false} />
        <XAxis dataKey="name" stroke={R.border} tick={{ fill: R.textMid, fontSize: 10 }} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} interval={0} angle={data.length > 5 ? -18 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 44 : 24} />
        <YAxis stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={44} tickFormatter={fmt} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={(p) => <ChartTip {...p} fmt={fmt} />} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} fill={color} fillOpacity={0.9}>
          <LabelList dataKey="value" position="top" formatter={fmt} style={{ fill: R.textMid, fontSize: 10, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HBars({ data, color, fmt }: { data: Pt[]; color: string; fmt: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 52, left: 4, bottom: 5 }}>
        <CartesianGrid stroke={R.border} opacity={0.22} horizontal={false} />
        <XAxis type="number" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
        <YAxis type="category" dataKey="name" stroke={R.border} tick={{ fill: R.textMid, fontSize: 10 }} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} width={96} />
        <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={(p) => <ChartTip {...p} fmt={fmt} />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} fill={color} fillOpacity={0.9}>
          <LabelList dataKey="value" position="right" formatter={fmt} style={{ fill: R.textMid, fontSize: 10, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MasonRateCharts({ data }: { data?: RateChartsData }) {
  const d = data ?? SAMPLE;
  return (
    <div>
      <ChartCard title="Short Stay — ADR by Studio Category" subtitle="Avg nightly rate per room type" empty={d.ssAdrByCategory.length === 0}>
        <VBars data={d.ssAdrByCategory} color="#7BAFD4" fmt={GBP} />
      </ChartCard>
      <ChartCard title="Average Monthly Rate by Segment" subtitle="AMR across Mid & Long length-of-stay tiers" empty={d.amrBySegment.length === 0}>
        <HBars data={d.amrBySegment} color={R.warmTeal} fmt={GBP_K} />
      </ChartCard>
      <ChartCard title="Long Stay — Rate by Studio Category" subtitle="AMR per room type" empty={d.lsAmrByCategory.length === 0}>
        <HBars data={d.lsAmrByCategory} color={R.gold} fmt={GBP_K} />
      </ChartCard>
    </div>
  );
}
