import { useState, useEffect } from "react";
import { Home } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AirbnbAvailabilityProps {
  citySlug: string;
  currencySymbol: string;
}

interface SnapshotRow {
  checkin_date: string;
  total_listings: number;
  avg_price: number;
  listings: string | unknown[];
}

interface Listing {
  name: string;
  type: string;
  beds: number;
  rating: number;
  price: number;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

const cardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "20px",
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};

export function AirbnbAvailability({ citySlug, currencySymbol }: AirbnbAvailabilityProps) {
  const [data, setData] = useState<SnapshotRow[]>([]);
  const [topListings, setTopListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `${API_BASE}/api/market/airbnb-availability?citySlug=${citySlug}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        const rows: SnapshotRow[] = json.snapshots || [];
        if (cancelled) return;
        setData(rows);

        // Parse listings from the first snapshot
        if (rows.length > 0) {
          const raw = rows[0].listings;
          let parsed: Listing[] = [];
          if (typeof raw === "string") {
            try { parsed = JSON.parse(raw); } catch { parsed = []; }
          } else if (Array.isArray(raw)) {
            parsed = raw as Listing[];
          }
          parsed.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
          setTopListings(parsed.slice(0, 20));
        }
      } catch (err) {
        console.error("AirbnbAvailability fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [citySlug]);

  const formatPrice = (v: number) => `${currencySymbol}${Math.round(v)}`;

  const tooltipStyle: React.CSSProperties = {
    background: "rgba(26, 26, 26, 0.95)",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#e5e5e5",
    fontSize: "12px",
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, color: "#6b7280", textAlign: "center", padding: "40px" }}>
        Loading Airbnb data...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div style={{ ...cardStyle, color: "#6b7280", textAlign: "center", padding: "40px" }}>
        No Airbnb data available.
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Home size={18} color="#39BDF8" />
        <span style={{ color: "#e5e5e5", fontSize: "16px", fontWeight: 600 }}>Airbnb Market Intelligence</span>
        <span style={{ color: "#6b7280", fontSize: "12px" }}>Archanes & Surrounding Area</span>
      </div>

      {/* Charts Row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        {/* Supply Chart */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
            Airbnb Supply
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis
                dataKey="checkin_date"
                tickFormatter={formatDate}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatDate}
              />
              <Line
                type="monotone"
                dataKey="total_listings"
                stroke="#39BDF8"
                strokeWidth={2}
                dot={false}
                name="Total Listings"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Avg Nightly Rate Chart */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
            Avg Nightly Rate
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data}>
              <CartesianGrid stroke="#2a2a2a" strokeOpacity={0.5} />
              <XAxis
                dataKey="checkin_date"
                tickFormatter={formatDate}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={{ stroke: "#2a2a2a" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatPrice(v)}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={formatDate}
                formatter={(v: number) => [formatPrice(v), "Avg Price"]}
              />
              <Line
                type="monotone"
                dataKey="avg_price"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Avg Price"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Listings Table */}
      {topListings.length > 0 && (
        <div style={cardStyle}>
          <div style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>
            Top Listings by Price
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Type", "Beds", "Rating", "Nightly Rate"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Name" ? "left" : "right",
                      color: "#9ca3af",
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "8px 12px",
                      borderBottom: "1px solid #2a2a2a",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topListings.map((l, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #2a2a2a" }}>
                  <td style={{ color: "#e5e5e5", fontSize: "12px", padding: "8px 12px", textAlign: "left" }}>
                    {l.name}
                  </td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 12px", textAlign: "right" }}>
                    {l.type}
                  </td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 12px", textAlign: "right" }}>
                    {l.beds}
                  </td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 12px", textAlign: "right" }}>
                    {l.rating ?? "—"}
                  </td>
                  <td style={{ color: "#e5e5e5", fontSize: "12px", padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>
                    {formatPrice(l.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
