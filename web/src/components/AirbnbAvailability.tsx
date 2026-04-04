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

interface RegistryProperty {
  property_id: string;
  name: string;
  type: string;
  beds: string;
  location: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  times_seen: number;
  first_seen: string;
  last_seen: string;
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
  const [registry, setRegistry] = useState<RegistryProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [availRes, regRes] = await Promise.all([
          fetch(`${API_BASE}/api/market/airbnb-availability?citySlug=${citySlug}`, { credentials: "include" }),
          fetch(`${API_BASE}/api/market/airbnb-registry?citySlug=${citySlug}`, { credentials: "include" }),
        ]);

        if (!availRes.ok) throw new Error("availability fetch failed");
        const json = await availRes.json();
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

        if (regRes.ok) {
          const regJson = await regRes.json();
          if (!cancelled) {
            // Sort by distance from Archanes center
            const props = regJson.properties || [];
            props.sort((a: RegistryProperty, b: RegistryProperty) => {
              const da = a.lat && a.lng ? Math.sqrt(Math.pow((a.lat - 35.2352) * 111, 2) + Math.pow((a.lng - 25.1594) * 111 * Math.cos(35.2352 * Math.PI / 180), 2)) : 9999;
              const db = b.lat && b.lng ? Math.sqrt(Math.pow((b.lat - 35.2352) * 111, 2) + Math.pow((b.lng - 25.1594) * 111 * Math.cos(35.2352 * Math.PI / 180), 2)) : 9999;
              return da - db;
            });
            setRegistry(props);
          }
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

  // Archanes center coordinates
  const CENTER = { lat: 35.2352, lng: 25.1594 };
  const getDistanceKm = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) return null;
    const dlat = (lat - CENTER.lat) * 111;
    const dlng = (lng - CENTER.lng) * 111 * Math.cos(CENTER.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
  };

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Home size={18} color="#39BDF8" />
          <span style={{ color: "#e5e5e5", fontSize: "16px", fontWeight: 600 }}>Airbnb Market Intelligence</span>
          <span style={{ color: "#6b7280", fontSize: "12px" }}>Archanes & Surrounding Area</span>
        </div>
        <div style={{ color: "#6b7280", fontSize: "11px", textAlign: "right", lineHeight: "1.5" }}>
          2-night stays • 90-day forward horizon • Scraped daily
        </div>
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
      {/* Property Registry */}
      {registry.length > 0 && (
        <div style={{ ...cardStyle, marginTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600 }}>
              Property Registry
            </div>
            <span style={{ color: "#6b7280", fontSize: "12px" }}>
              {registry.length} unique properties tracked
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Type", "Location", "Dist.", "Beds", "Rating", "Avg Rate", "Min", "Max", "Seen", "First Seen", "Last Seen"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === "Name" || h === "Location" || h === "Beds" ? "left" : "right",
                        color: "#6b7280",
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "-0.025em",
                        padding: "8px 10px",
                        borderBottom: "1px solid #2a2a2a",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registry.map((p, i) => (
                  <tr key={p.property_id || i} style={{ borderBottom: "1px solid rgba(42,42,42,0.5)" }}>
                    <td style={{ color: "#e5e5e5", fontSize: "12px", padding: "8px 10px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name || "—"}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 10px" }}>
                      {p.type || "—"}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 10px" }}>
                      {p.location || "—"}
                    </td>
                    <td style={{ color: "#6b7280", fontSize: "11px", padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {(() => { const d = getDistanceKm(p.lat, p.lng); return d !== null ? `${d.toFixed(1)} km` : "—"; })()}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 10px" }}>
                      {p.beds || "—"}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 10px", textAlign: "right" }}>
                      {p.rating ? `${p.rating} (${p.reviews})` : "—"}
                    </td>
                    <td style={{ color: "#39BDF8", fontSize: "12px", padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                      {formatPrice(p.avg_price)}
                    </td>
                    <td style={{ color: "#10b981", fontSize: "12px", padding: "8px 10px", textAlign: "right" }}>
                      {formatPrice(p.min_price)}
                    </td>
                    <td style={{ color: "#ef4444", fontSize: "12px", padding: "8px 10px", textAlign: "right" }}>
                      {formatPrice(p.max_price)}
                    </td>
                    <td style={{ color: "#9ca3af", fontSize: "12px", padding: "8px 10px", textAlign: "right" }}>
                      {p.times_seen}x
                    </td>
                    <td style={{ color: "#6b7280", fontSize: "11px", padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {formatDate(p.first_seen)}
                    </td>
                    <td style={{ color: "#6b7280", fontSize: "11px", padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {formatDate(p.last_seen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
