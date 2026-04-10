import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip as LeafletTooltip } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RegistryProperty {
  propertyId: string;
  name: string;
  type: string | null;
  beds: string | null;
  rating: number | null;
  reviews: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  timesSeen: number;
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
}

interface Props {
  registry: RegistryProperty[];
  currencySymbol: string;
}

const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

// ADR quintile palette: cheapest → most expensive
const QUINTILE_COLORS = ["#10b981", "#39BDF8", "#a855f7", "#f59e0b", "#ef4444"];
const QUINTILE_LABELS = ["Q1", "Q2", "Q3", "Q4", "Q5"];

function quintileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < 5; i++) {
    const idx = Math.floor((sorted.length * i) / 5);
    breaks.push(sorted[Math.min(idx, sorted.length - 1)]);
  }
  return breaks;
}

function quintileFor(price: number, breaks: number[]): number {
  for (let i = 0; i < breaks.length; i++) {
    if (price <= breaks[i]) return i;
  }
  return breaks.length;
}

export default function ArchanesPropertyMap({ registry, currencySymbol }: Props) {
  const mappable = useMemo(
    () => registry.filter((p) => p.lat !== null && p.lng !== null && p.avgPrice > 0),
    [registry]
  );

  const quintiles = useMemo(
    () => quintileBreaks(mappable.map((p) => p.avgPrice)),
    [mappable]
  );

  const center = useMemo(() => {
    if (mappable.length === 0) return { lat: 35.2352, lng: 25.1594 };
    const avgLat = mappable.reduce((s, p) => s + (p.lat as number), 0) / mappable.length;
    const avgLng = mappable.reduce((s, p) => s + (p.lng as number), 0) / mappable.length;
    return { lat: avgLat, lng: avgLng };
  }, [mappable]);

  if (mappable.length === 0) {
    return (
      <div
        style={{
          height: "560px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "13px",
          background: "#1d1d1c",
          borderRadius: "8px",
          border: "1px solid #2a2a2a",
        }}
      >
        No mappable properties.
      </div>
    );
  }

  return (
    <div>
      <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #2a2a2a" }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={12}
          style={{ height: "560px", width: "100%", background: "#1d1d1c" }}
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
            {mappable.map((p) => {
              const q = quintileFor(p.avgPrice, quintiles);
              return (
                <CircleMarker
                  key={p.propertyId}
                  center={[p.lat as number, p.lng as number]}
                  radius={4}
                  pathOptions={{
                    color: "transparent",
                    fillColor: QUINTILE_COLORS[q],
                    fillOpacity: 0.7,
                    weight: 0,
                  }}
                >
                  <LeafletTooltip permanent={false} direction="top">
                    <div
                      style={{
                        background: "#1a1a1a",
                        border: "1px solid #2a2a2a",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        color: "#e5e5e5",
                        fontSize: "11px",
                        lineHeight: 1.6,
                        minWidth: "180px",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                        {p.name || "—"}
                      </div>
                      <div style={{ color: "#9ca3af", textTransform: "capitalize", marginBottom: "4px" }}>
                        {p.type || "—"}
                        {p.beds ? ` · ${p.beds}` : ""}
                      </div>
                      <div>
                        <span style={{ color: "#39BDF8", fontWeight: 600 }}>
                          {currencySymbol}
                          {Math.round(p.avgPrice)}
                        </span>
                        <span style={{ color: "#6b7280" }}> avg · </span>
                        <span style={{ color: "#10b981" }}>
                          {currencySymbol}
                          {Math.round(p.minPrice)}
                        </span>
                        <span style={{ color: "#6b7280" }}> – </span>
                        <span style={{ color: "#ef4444" }}>
                          {currencySymbol}
                          {Math.round(p.maxPrice)}
                        </span>
                      </div>
                      {p.rating !== null && (
                        <div style={{ color: "#9ca3af" }}>
                          ★ {p.rating} ({p.reviews})
                        </div>
                      )}
                      {p.distanceKm !== null && (
                        <div style={{ color: "#6b7280" }}>
                          {p.distanceKm.toFixed(2)} km from centre
                        </div>
                      )}
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              );
            })}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {/* Legend strip — matches NeighbourhoodMaps style */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: "12px",
          padding: "12px 16px",
          backgroundColor: "rgb(26, 26, 26)",
          borderRadius: "8px",
          border: "1px solid #2a2a2a",
        }}
      >
        <span
          style={{
            color: "#6b7280",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "-0.025em",
            fontWeight: 600,
          }}
        >
          ADR Tier
        </span>
        {QUINTILE_COLORS.map((color, i) => {
          const lower = i === 0 ? 0 : Math.round(quintiles[i - 1] || 0);
          const upper = i < quintiles.length ? Math.round(quintiles[i]) : null;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: color,
                }}
              />
              <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                {QUINTILE_LABELS[i]}
                <span style={{ color: "#6b7280", marginLeft: "4px" }}>
                  {upper !== null
                    ? `${currencySymbol}${lower}–${currencySymbol}${upper}`
                    : `≥${currencySymbol}${lower}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
