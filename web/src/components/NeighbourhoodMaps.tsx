import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface NeighbourhoodMapsProps {
  citySlug: string;
  onTypeCounts?: (counts: Record<string, number>) => void;
}

interface POI {
  name: string | null;
  type: string;
  lat: number;
  lng: number;
  stars: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  hotel: "#39BDF8",
  hostel: "#f59e0b",
  guest_house: "#10b981",
  apartment: "#8b5cf6",
  motel: "#ec4899",
};

const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function MapCard({ title, subtitle, children, extra }: { title: string; subtitle: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "rgb(26, 26, 26)",
        borderRadius: "8px",
        border: "1px solid #2a2a2a",
        padding: "20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ color: "#e5e5e5", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>{title}</div>
          <div style={{ color: "#6b7280", fontSize: "11px" }}>{subtitle}</div>
        </div>
        {extra}
      </div>
      <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #2a2a2a" }}>
        {children}
      </div>
    </div>
  );
}

export default function NeighbourhoodMaps({ citySlug, onTypeCounts }: NeighbourhoodMapsProps) {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("");
  const [poiCount, setPoiCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!citySlug) return;
    setLoading(true);
    setError(null);
    fetch(`/api/market/accommodation-map?citySlug=${encodeURIComponent(citySlug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API returned ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!data || !data.pois || data.pois.length === 0) {
          setPois([]);
          setError(data?.source === "error" ? "Overpass API unavailable — try again later" : null);
          setLoading(false);
          return;
        }
        setPois(data.pois);
        setPoiCount(data.pois.length);
        setSource(data.source);
        // Pass type breakdown to parent
        if (onTypeCounts) {
          const counts: Record<string, number> = {};
          data.pois.forEach((p: POI) => { counts[p.type] = (counts[p.type] || 0) + 1; });
          onTypeCounts(counts);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Accommodation map fetch failed:", err);
        setError(err.message);
        setPois([]);
        setLoading(false);
      });
  }, [citySlug]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: "rgb(26, 26, 26)", borderRadius: "8px", border: "1px solid #2a2a2a",
        padding: "40px", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#6b7280", fontSize: "13px", gap: "8px",
      }}>
        <div className="w-4 h-4 border-2 border-[#39BDF8] border-t-transparent rounded-full animate-spin" />
        Loading accommodation map...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: "rgb(26, 26, 26)", borderRadius: "8px", border: "1px solid #2a2a2a",
        padding: "20px", color: "#ef4444", fontSize: "12px",
      }}>
        Map error: {error}
      </div>
    );
  }

  if (pois.length === 0) return null;

  // Compute center from POI data
  const avgLat = pois.reduce((s, p) => s + p.lat, 0) / pois.length;
  const avgLng = pois.reduce((s, p) => s + p.lng, 0) / pois.length;

  // Count by type for legend
  const typeCounts: Record<string, number> = {};
  pois.forEach((p) => {
    const t = p.type || "hotel";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const countBadge = (
    <div style={{ color: "#6b7280", fontSize: "10px", padding: "4px 10px", backgroundColor: "#1d1d1c", borderRadius: "4px", border: "1px solid #2a2a2a" }}>
      {poiCount.toLocaleString()} properties
    </div>
  );

  return (
    <>
      <MapCard
        title="Accommodation Supply Map"
        subtitle="Every hotel, hostel, apartment and guest house — sourced from OpenStreetMap"
        extra={countBadge}
      >
        <MapContainer
          center={[avgLat, avgLng]}
          zoom={12}
          style={{ height: "760px", width: "100%", background: "#1d1d1c" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={darkTileUrl} />
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={60}
            disableClusteringAtZoom={13}
            spiderfyOnMaxZoom={false}
            showCoverageOnHover={false}
            iconCreateFunction={(cluster: any) => {
              const count = cluster.getChildCount();
              const size = count > 100 ? 48 : count > 30 ? 40 : 32;
              return L.divIcon({
                html: `<div style="
                  width:${size}px;height:${size}px;
                  display:flex;align-items:center;justify-content:center;
                  background:rgba(57,189,248,0.2);
                  border:2px solid rgba(57,189,248,0.6);
                  border-radius:50%;
                  color:#39BDF8;font-size:12px;font-weight:600;
                ">${count}</div>`,
                className: "",
                iconSize: L.point(size, size),
              });
            }}
          >
            {pois.map((p, i) => (
              <CircleMarker
                key={i}
                center={[p.lat, p.lng]}
                radius={4}
                pathOptions={{
                  color: "transparent",
                  fillColor: TYPE_COLORS[p.type] || "#39BDF8",
                  fillOpacity: 0.6,
                  weight: 0,
                }}
              >
                {p.name && (
                  <LeafletTooltip permanent={false} direction="top">
                    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e5e5e5", fontSize: "11px", lineHeight: "1.6" }}>
                      <div style={{ fontWeight: 600, marginBottom: "2px" }}>{p.name}</div>
                      <div style={{ color: "#9ca3af", textTransform: "capitalize" }}>{p.type.replace("_", " ")}{p.stars ? ` — ${p.stars}*` : ""}</div>
                    </div>
                  </LeafletTooltip>
                )}
              </CircleMarker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </MapCard>

      {/* Legend */}
      <div style={{
        display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "12px",
        padding: "12px 16px", backgroundColor: "rgb(26, 26, 26)", borderRadius: "8px", border: "1px solid #2a2a2a",
      }}>
        {Object.entries(typeCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: TYPE_COLORS[type] || "#39BDF8" }} />
              <span style={{ color: "#9ca3af", fontSize: "10px", textTransform: "capitalize" }}>
                {type.replace("_", " ")} ({count})
              </span>
            </div>
          ))}
      </div>
    </>
  );
}
