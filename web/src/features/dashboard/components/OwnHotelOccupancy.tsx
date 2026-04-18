import { useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { R } from "../../../styles/tokens";
import { type FlowcastDay } from "../api/dashboard.api";

interface OwnHotelOccupancyProps {
  data: FlowcastDay[];
}

export function OwnHotelOccupancy({ data }: OwnHotelOccupancyProps) {
  const [pickupPeriod, setPickupPeriod] = useState<"24h" | "3d" | "7d">("24h");
  const occupancyData = data || [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const pickupValue = pickupPeriod === "24h" ? d.pickup24h : pickupPeriod === "3d" ? d.pickup3d : d.pickup7d;
      const pickupLabel = pickupPeriod === "24h" ? "Pickup 24h" : pickupPeriod === "3d" ? "Pickup 3d" : "Pickup 7d";
      const sign = pickupValue >= 0 ? "+" : "";
      return (
        <div style={{ backgroundColor: "rgba(18,21,25,0.95)", border: `1px solid ${R.border}`, borderRadius: 6, padding: 12, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3)" }}>
          <div style={{ color: R.accent, fontSize: 11, marginBottom: 8, fontWeight: 500 }}>{d.fullDate}</div>
          <div style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Occupancy: {d.occupancy.toFixed(1)}%</div>
          <div style={{ color: R.textDim, fontSize: 11, marginTop: 3 }}>
            {pickupLabel}: {sign}{pickupValue.toFixed(1)}%
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: R.accent }}>90 Day Occupancy & Pickup</div>
          <div style={{ fontSize: 10, color: R.textDim }}>Occupancy trend with booking velocity overlay</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 12, fontSize: 9 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, background: R.textDim, opacity: 0.5, borderRadius: 2, display: "inline-block" }} />
              <span style={{ color: R.textDim }}>Base Occupancy %</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, background: "#7BAFD4", borderRadius: 2, display: "inline-block" }} />
              <span style={{ color: R.textDim }}>{pickupPeriod === "24h" ? "24h" : pickupPeriod === "3d" ? "3 Day" : "7 Day"} Pickup %</span>
            </span>
          </div>
          {/* Period toggle */}
          <div style={{ display: "flex", gap: 2, background: R.heroBg, padding: 3, borderRadius: 6, border: `1px solid ${R.border}` }}>
            {(["24h", "3d", "7d"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPickupPeriod(p)}
                style={{
                  padding: "4px 10px", fontSize: 10, borderRadius: 4, border: "none", cursor: "pointer",
                  background: pickupPeriod === p ? "#7BAFD4" : "transparent",
                  color: pickupPeriod === p ? R.darkBand : R.textDim,
                  fontWeight: pickupPeriod === p ? 600 : 400,
                  textTransform: "uppercase", letterSpacing: -0.3,
                }}
              >
                {p === "24h" ? "24h" : p === "3d" ? "3 Days" : "7 Days"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: "20px 20px 16px", flex: 1, minHeight: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={occupancyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="0" stroke={R.border} opacity={0.25} vertical={false} />
            <XAxis dataKey="date" stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={{ stroke: R.border, strokeOpacity: 0.3 }} interval={6} />
            <YAxis stroke={R.border} tick={{ fill: R.textDim, fontSize: 9 }} tickLine={false} axisLine={false} width={30} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey={pickupPeriod === "24h" ? "baseOccupancy24h" : pickupPeriod === "3d" ? "baseOccupancy3d" : "baseOccupancy7d"}
              stackId="occupancy" name="Base Occupancy" radius={[0, 0, 0, 0]} maxBarSize={10} fill={R.textDim} fillOpacity={0.5}
            />
            <Bar
              dataKey={pickupPeriod === "24h" ? "pickup24h" : pickupPeriod === "3d" ? "pickup3d" : "pickup7d"}
              stackId="occupancy" name="Pickup" radius={[2, 2, 0, 0]} maxBarSize={10} fill={"#7BAFD4"} fillOpacity={0.85}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
