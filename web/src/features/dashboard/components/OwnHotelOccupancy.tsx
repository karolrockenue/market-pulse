import { CSSProperties, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type FlowcastDay } from "../api/dashboard.api";

interface OwnHotelOccupancyProps {
  data: FlowcastDay[];
}

export function OwnHotelOccupancy({ data }: OwnHotelOccupancyProps) {
  const [pickupPeriod, setPickupPeriod] = useState<"24h" | "3d" | "7d">("24h");

  // Use passed data instead of generating it
  const occupancyData = data || [];

  const styles: Record<string, CSSProperties> = {
    container: {
      backgroundColor: "#1a1a1a",
      borderRadius: "8px",
      border: "1px solid #2a2a2a",
      overflow: "hidden",
      marginBottom: "24px",
      // Removed "height: 100%" to prevent infinite growth loop
    },
    header: {
      padding: "20px 24px",
      borderBottom: "1px solid #2a2a2a",
    },
    title: {
      color: "#e5e5e5",
      fontSize: "18px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
      marginBottom: "6px",
    },
    description: {
      color: "#6b7280",
      fontSize: "12px",
    },
    chartContainer: {
      padding: "24px",
      height: "360px", // FIXED HEIGHT ensures it doesn't grow infinitely
    },
    legendContainer: {
      display: "flex",
      gap: "16px",
      justifyContent: "center",
      paddingBottom: "12px",
    },
    legendItem: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "11px",
      color: "#9ca3af",
    },
    legendDot: {
      width: "8px",
      height: "8px",
      borderRadius: "2px",
    },
    titleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "6px",
    },
    buttonGroup: {
      display: "flex",
      gap: "4px",
      backgroundColor: "#141414",
      padding: "4px",
      borderRadius: "6px",
      border: "1px solid #2a2a2a",
    },
    periodButton: {
      padding: "6px 12px",
      fontSize: "11px",
      textTransform: "uppercase",
      letterSpacing: "-0.025em",
      backgroundColor: "transparent",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "all 0.2s",
      color: "#6b7280",
    },
    periodButtonActive: {
      backgroundColor: "#39BDF8",
      color: "#000000",
      fontWeight: 500,
    },
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pickupValue =
        pickupPeriod === "24h"
          ? data.pickup24h
          : pickupPeriod === "3d"
          ? data.pickup3d
          : data.pickup7d;
      const pickupLabel =
        pickupPeriod === "24h"
          ? "24h Pickup"
          : pickupPeriod === "3d"
          ? "3d Pickup"
          : "7d Pickup";

      return (
        <div
          style={{
            backgroundColor: "rgba(26, 26, 24, 0.98)",
            border: "1px solid #3a3a35",
            borderRadius: "6px",
            padding: "12px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div
            style={{
              color: "#e5e5e5",
              fontSize: "11px",
              marginBottom: "8px",
              fontWeight: 500,
            }}
          >
            {data.fullDate}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: "#6b7280",
                }}
              ></div>
              <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                Occupancy:
              </span>
              <span
                style={{ color: "#e5e5e5", fontSize: "11px", fontWeight: 500 }}
              >
                {data.occupancy.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: "#39BDF8",
                }}
              ></div>
              <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                {pickupLabel}:
              </span>
              <span
                style={{ color: "#39BDF8", fontSize: "11px", fontWeight: 500 }}
              >
                {pickupValue.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <div style={styles.title}>90 day occupancy and pickup</div>
          <div style={styles.buttonGroup}>
            <button
              style={{
                ...styles.periodButton,
                ...(pickupPeriod === "24h" ? styles.periodButtonActive : {}),
              }}
              onClick={() => setPickupPeriod("24h")}
            >
              24h
            </button>
            <button
              style={{
                ...styles.periodButton,
                ...(pickupPeriod === "3d" ? styles.periodButtonActive : {}),
              }}
              onClick={() => setPickupPeriod("3d")}
            >
              3 Days
            </button>
            <button
              style={{
                ...styles.periodButton,
                ...(pickupPeriod === "7d" ? styles.periodButtonActive : {}),
              }}
              onClick={() => setPickupPeriod("7d")}
            >
              7 Days
            </button>
          </div>
        </div>
        <div style={styles.description}>
          90-day occupancy trend and recent booking pickup analysis
        </div>
      </div>

      <div style={styles.chartContainer}>
        <div style={styles.legendContainer}>
          <div style={styles.legendItem}>
            <div
              style={{ ...styles.legendDot, backgroundColor: "#6b7280" }}
            ></div>
            <span>Base Occupancy %</span>
          </div>
          <div style={styles.legendItem}>
            <div
              style={{ ...styles.legendDot, backgroundColor: "#39BDF8" }}
            ></div>
            <span>
              {pickupPeriod === "24h"
                ? "24h"
                : pickupPeriod === "3d"
                ? "3 Day"
                : "7 Day"}{" "}
              Pickup %
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={occupancyData}
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="0"
              stroke="#2a2a25"
              opacity={0.5}
              vertical={true}
              horizontal={true}
            />

            <XAxis
              dataKey="date"
              stroke="#3a3a35"
              tick={{ fill: "#6b7280", fontSize: 9 }}
              tickLine={{ stroke: "#3a3a35" }}
              axisLine={{ stroke: "#3a3a35" }}
              interval={6} // Show approx weekly labels (90 days / 6 ≈ 15 labels)
            />

            <YAxis
              stroke="#3a3a35"
              tick={{ fill: "#6b7280", fontSize: 9 }}
              tickLine={{ stroke: "#3a3a35" }}
              axisLine={{ stroke: "#3a3a35" }}
              width={35}
              domain={[0, 100]}
              label={{
                value: "%",
                angle: 0,
                position: "top",
                offset: 10,
                fill: "#6b7280",
                fontSize: 9,
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Base occupancy bar (occupancy minus pickup) */}
            <Bar
              dataKey={
                pickupPeriod === "24h"
                  ? "baseOccupancy24h"
                  : pickupPeriod === "3d"
                  ? "baseOccupancy3d"
                  : "baseOccupancy7d"
              }
              stackId="occupancy"
              name="Base Occupancy"
              radius={[0, 0, 0, 0]}
              maxBarSize={12}
              fill="#6b7280"
              fillOpacity={0.5}
            />

            {/* Pickup on top (stacked) - Sentinel blue */}
            <Bar
              dataKey={
                pickupPeriod === "24h"
                  ? "pickup24h"
                  : pickupPeriod === "3d"
                  ? "pickup3d"
                  : "pickup7d"
              }
              stackId="occupancy"
              name={
                pickupPeriod === "24h"
                  ? "24h Pickup"
                  : pickupPeriod === "3d"
                  ? "3d Pickup"
                  : "7d Pickup"
              }
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
              fill="#39BDF8"
              fillOpacity={0.85}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
