import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ExternalLink, AlertTriangle, X, MapPin, Globe, Star } from "lucide-react";
import { R } from "../../../styles/tokens";
import {
  fetchIcelandDashboard,
  type IcelandDashboardPayload,
  type IcelandProperty,
} from "../api/iceland.api";

const fmtGbp = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `£${Math.round(v).toLocaleString()}`;
const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString();
const fmtScore = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toFixed(1);

type SortKey = "name" | "type" | "stars" | "score" | "reviewCount" | "price" | "neighborhood" | "chain";

export function IcelandDashboard() {
  const [data, setData] = useState<IcelandDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("reviewCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [drawerHotelId, setDrawerHotelId] = useState<string | null>(null);
  const drawerHotel = useMemo(
    () => data?.inventory.find((p) => p.bookingHotelId === drawerHotelId) ?? null,
    [data, drawerHotelId],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchIcelandDashboard();
      setData(payload);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredInventory: IcelandProperty[] = useMemo(() => {
    if (!data) return [];
    let rows = data.inventory;
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    if (chainFilter !== "all") rows = rows.filter((r) => r.chain === chainFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [data, typeFilter, chainFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "type" || key === "neighborhood" || key === "chain" ? "asc" : "desc");
    }
  }

  if (loading)
    return (
      <div style={{ padding: 32, color: R.textMid }}>Loading Iceland market data…</div>
    );

  if (error || !data)
    return (
      <div style={{ padding: 32, color: R.red }}>
        Error: {error || "no data"}
      </div>
    );

  const maxTypeCount = Math.max(...data.typeBreakdown.map((b) => b.count));
  const maxNeighborhoodCount = Math.max(...data.neighborhoods.map((b) => b.count));
  const maxChainCount = Math.max(...data.chainBreakdown.map((b) => b.count));
  const maxStarCount = Math.max(...data.starDistribution.map((b) => b.count), 1);

  return (
    <div style={{ padding: "24px 32px", color: R.accent, background: R.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Rockenue · Market Assessment
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: R.accent, margin: 0 }}>
            Iceland — {data.cityLabel}
          </h1>
          <div style={{ fontSize: 12, color: R.textMid, marginTop: 6 }}>
            Last inventory refresh:{" "}
            {data.lastInventoryRefresh
              ? new Date(data.lastInventoryRefresh).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "never"}
          </div>
        </div>
        <button
          onClick={load}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            background: R.cardLight,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
            color: R.text,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* KPI Banner */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {[
          { label: "Total Properties", value: fmtNum(data.kpis.totalProperties) },
          { label: "Hotels", value: fmtNum(data.kpis.totalHotels) },
          { label: "Median Hotel ADR", value: fmtGbp(data.kpis.medianHotelPrice) },
          { label: "Market Avg ADR", value: fmtGbp(data.kpis.avgPrice) },
          { label: "Avg Review Score", value: fmtScore(data.kpis.avgScore) },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: R.card,
              border: `1px solid ${R.border}`,
              borderRadius: 8,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: R.teal, marginTop: 4 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Forward demand banner */}
      <Section title="Forward Market Demand · Next 120 days">
        {data.market.hasData ? (
          <ForwardDemandChart snapshots={data.market.forwardSnapshots} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 14,
              background: R.cardLight,
              border: `1px solid ${R.border}`,
              borderRadius: 6,
              color: R.textMid,
              fontSize: 13,
            }}
          >
            <AlertTriangle size={16} color={R.amber} />
            No market_availability_snapshots for Reykjavík yet. Once the
            <code style={{ color: R.text, padding: "0 4px" }}>market-codex-reykjavik-main</code>
            Render cron completes its first run, this chart populates automatically.
          </div>
        )}
      </Section>

      {/* Three-column breakdown row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Property Type */}
        <Card title="Property Type Mix">
          {data.typeBreakdown.map((b) => (
            <BarRow
              key={b.type}
              label={b.type}
              count={b.count}
              max={maxTypeCount}
              meta={`${b.avgPrice !== null ? fmtGbp(b.avgPrice) : "—"} avg`}
              color={R.teal}
            />
          ))}
        </Card>

        {/* Star Distribution */}
        <Card title="Star Tier (rated only)">
          {data.starDistribution.length === 0 ? (
            <div style={{ color: R.textMid, fontSize: 13 }}>No rated properties.</div>
          ) : (
            data.starDistribution.map((b) => (
              <BarRow
                key={b.stars}
                label={`${b.stars}★`}
                count={b.count}
                max={maxStarCount}
                color={b.stars >= 5 ? R.gold : b.stars >= 4 ? R.teal : b.stars >= 3 ? R.blue : R.textMid}
              />
            ))
          )}
          <div style={{ marginTop: 12, fontSize: 11, color: R.textDim }}>
            {data.kpis.totalProperties - data.starDistribution.reduce((s, b) => s + b.count, 0)}{" "}
            properties unrated (hostels, apartments, guesthouses don't get Booking stars).
          </div>
        </Card>

        {/* Neighborhood */}
        <Card title="Geographic Concentration">
          {data.neighborhoods.slice(0, 10).map((b) => (
            <BarRow
              key={b.name}
              label={b.name}
              count={b.count}
              max={maxNeighborhoodCount}
              meta={b.avgPrice !== null ? `${fmtGbp(b.avgPrice)} avg` : ""}
              color={R.warmTeal}
            />
          ))}
        </Card>
      </div>

      {/* Chain density */}
      <Section title="Chain Density · Sales Targets">
        <div style={{ fontSize: 12, color: R.textMid, marginBottom: 12 }}>
          Properties grouped by detected chain affiliation. Branded properties
          are higher-value sales targets — they have central decision-makers
          and bigger contract sizes. "Independent" rows are single-property
          owners, longer-tail effort but bigger volume in aggregate.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {data.chainBreakdown.map((c) => (
            <div
              key={c.name}
              style={{
                background: R.cardLight,
                border: `1px solid ${R.border}`,
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 12, color: R.textDim }}>
                {c.name === "Independent" ? "Independents" : c.name}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: R.accent, marginTop: 2 }}>
                {c.count}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Top hotels */}
      <Section title={`Top ${Math.min(data.topHotels.length, 25)} Hotels · by Review Volume`}>
        <div style={{ fontSize: 12, color: R.textMid, marginBottom: 12 }}>
          Review count is a market-maturity proxy — properties with 1,000+
          reviews are established and visible. Sort sales outreach by these
          first: highest signal-to-effort ratio.
        </div>
        <InventoryTable
          rows={data.topHotels}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpenDetail={setDrawerHotelId}
        />
      </Section>

      {/* Full inventory */}
      <Section title={`Full Inventory · ${filteredInventory.length} of ${data.inventory.length}`}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13, color: R.text }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: R.textMid }}>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All</option>
              {data.typeBreakdown.map((b) => (
                <option key={b.type} value={b.type}>
                  {b.type} ({b.count})
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: R.textMid }}>Chain:</span>
            <select
              value={chainFilter}
              onChange={(e) => setChainFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All</option>
              {data.chainBreakdown.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
          </label>
        </div>
        <InventoryTable
          rows={filteredInventory}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpenDetail={setDrawerHotelId}
        />
      </Section>

      {/* Detail side drawer */}
      {drawerHotel && (
        <HotelDetailDrawer
          hotel={drawerHotel}
          onClose={() => setDrawerHotelId(null)}
        />
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: R.cardLight,
  border: `1px solid ${R.border}`,
  borderRadius: 4,
  color: R.text,
  padding: "4px 8px",
  fontSize: 13,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: R.accent,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: R.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  meta,
  color,
}: {
  label: string;
  count: number;
  max: number;
  meta?: string;
  color: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: R.text }}>{label}</span>
        <span style={{ color: R.textMid }}>
          {count}
          {meta ? `  ·  ${meta}` : ""}
        </span>
      </div>
      <div style={{ height: 6, background: R.recessed, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function InventoryTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  onOpenDetail,
}: {
  rows: IcelandProperty[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onOpenDetail: (id: string) => void;
}) {
  const headers: { key: SortKey; label: string; width?: string }[] = [
    { key: "name", label: "Name" },
    { key: "type", label: "Type", width: "110px" },
    { key: "stars", label: "★", width: "50px" },
    { key: "score", label: "Score", width: "70px" },
    { key: "reviewCount", label: "Reviews", width: "90px" },
    { key: "price", label: "From", width: "80px" },
    { key: "neighborhood", label: "Neighborhood", width: "160px" },
    { key: "chain", label: "Chain", width: "160px" },
  ];

  return (
    <div
      style={{
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: R.cardLight }}>
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => onSort(h.key)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    color: R.textDim,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    userSelect: "none",
                    width: h.width,
                    borderBottom: `1px solid ${R.border}`,
                  }}
                >
                  {h.label} {sortKey === h.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </th>
              ))}
              <th style={{ width: 40, borderBottom: `1px solid ${R.border}` }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.bookingHotelId}
                onClick={() => onOpenDetail(r.bookingHotelId)}
                style={{
                  borderBottom: `1px solid ${R.sep}`,
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = `${R.warmTeal}08`)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
              >
                <td style={{ padding: "8px 12px", color: R.accent }}>{r.name}</td>
                <td style={{ padding: "8px 12px", color: R.textMid }}>{r.type || "—"}</td>
                <td style={{ padding: "8px 12px", color: R.gold }}>
                  {r.stars ? `${r.stars}★` : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: R.text }}>{fmtScore(r.score)}</td>
                <td style={{ padding: "8px 12px", color: R.textMid }}>{fmtNum(r.reviewCount)}</td>
                <td style={{ padding: "8px 12px", color: R.teal }}>{fmtGbp(r.price)}</td>
                <td style={{ padding: "8px 12px", color: R.textMid }}>{r.neighborhood}</td>
                <td style={{ padding: "8px 12px", color: R.textMid }}>{r.chain}</td>
                <td style={{ padding: "8px 12px" }}>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: R.textMid, display: "inline-flex" }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HotelDetailDrawer({
  hotel,
  onClose,
}: {
  hotel: IcelandProperty;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasEnrichment =
    hotel.streetAddress || hotel.descriptionExcerpt || (hotel.amenities && hotel.amenities.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 999,
        }}
      />
      {/* Drawer */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: "92vw",
          background: R.card,
          borderLeft: `1px solid ${R.border}`,
          zIndex: 1000,
          overflowY: "auto",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${R.border}`,
            position: "sticky",
            top: 0,
            background: R.card,
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {hotel.type || "Property"} {hotel.stars ? `· ${hotel.stars}★` : ""}
              </div>
              <h2
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  color: R.accent,
                  margin: "4px 0 0 0",
                  lineHeight: 1.3,
                }}
              >
                {hotel.name}
              </h2>
              <div style={{ fontSize: 12, color: R.textMid, marginTop: 4 }}>
                {hotel.chain !== "Independent" ? (
                  <span style={{ color: R.gold }}>{hotel.chain}</span>
                ) : (
                  <span style={{ color: R.textDim }}>Independent</span>
                )}
                {" · "}
                {hotel.neighborhood}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: R.textMid,
                cursor: "pointer",
                padding: 4,
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick-action buttons */}
        <div style={{ padding: "16px 24px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${R.sep}` }}>
          {hotel.url && (
            <a
              href={hotel.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...drawerButton,
                background: R.cardLight,
                color: R.teal,
              }}
            >
              <ExternalLink size={13} />
              Open on Booking
            </a>
          )}
          {hotel.streetAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                hotel.streetAddress + ", Iceland",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...drawerButton,
                background: R.cardLight,
                color: R.text,
              }}
            >
              <MapPin size={13} />
              Google Maps
            </a>
          )}
          {hotel.websiteUrl && (
            <a
              href={hotel.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...drawerButton,
                background: R.cardLight,
                color: R.text,
              }}
            >
              <Globe size={13} />
              Hotel website
            </a>
          )}
        </div>

        {/* KPI row */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${R.sep}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <DrawerKpi label="Review score" value={hotel.score !== null ? hotel.score.toFixed(1) : "—"} />
            <DrawerKpi label="Reviews" value={fmtNum(hotel.reviewCount)} />
            <DrawerKpi label="From" value={fmtGbp(hotel.price)} accent />
          </div>
        </div>

        {/* Address */}
        {hotel.streetAddress && (
          <DrawerSection title="Address" icon={<MapPin size={13} />}>
            <div style={{ color: R.text, fontSize: 13, lineHeight: 1.5 }}>{hotel.streetAddress}</div>
          </DrawerSection>
        )}

        {/* Amenities */}
        {hotel.amenities && hotel.amenities.length > 0 && (
          <DrawerSection title={`Top facilities (${hotel.amenities.length})`} icon={<Star size={13} />}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {hotel.amenities.map((a) => (
                <span
                  key={a}
                  style={{
                    fontSize: 11,
                    color: R.text,
                    padding: "3px 8px",
                    background: R.cardLight,
                    border: `1px solid ${R.border}`,
                    borderRadius: 999,
                  }}
                >
                  {a}
                </span>
              ))}
            </div>
          </DrawerSection>
        )}

        {/* Description */}
        {hotel.descriptionExcerpt && (
          <DrawerSection title="About this property">
            <div
              style={{
                color: R.text,
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {hotel.descriptionExcerpt}
              {hotel.descriptionExcerpt.length >= 800 && "…"}
            </div>
          </DrawerSection>
        )}

        {/* No enrichment yet */}
        {!hasEnrichment && (
          <DrawerSection title="Detail not yet captured">
            <div style={{ color: R.textMid, fontSize: 13 }}>
              This property hasn't been enriched yet. Run{" "}
              <code style={{ color: R.teal }}>node enrich-inventory.js reykjavik</code>{" "}
              in <code style={{ color: R.text }}>market-codex</code> to populate
              street address, description, and amenities.
            </div>
          </DrawerSection>
        )}

        {/* Footer meta */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${R.sep}`, fontSize: 11, color: R.textDim }}>
          <div>Booking ID: <code style={{ color: R.textMid }}>{hotel.bookingHotelId}</code></div>
          {hotel.detailFetchedAt && (
            <div style={{ marginTop: 4 }}>
              Detail captured: {new Date(hotel.detailFetchedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

const drawerButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px solid ${R.border}`,
  textDecoration: "none",
};

function DrawerKpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: accent ? R.teal : R.accent, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function DrawerSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "16px 24px", borderBottom: `1px solid ${R.sep}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: R.textDim,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ForwardDemandChart({
  snapshots,
}: {
  snapshots: IcelandDashboardPayload["market"]["forwardSnapshots"];
}) {
  if (snapshots.length === 0) return null;
  const waps = snapshots.map((s) => s.wap).filter((v): v is number => v !== null);
  const maxWap = Math.max(...waps, 1);
  const minWap = Math.min(...waps);
  const W = 880;
  const H = 180;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = Math.max(1, innerW / snapshots.length - 1);

  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Weighted-avg price (£) · 120-day forward
      </div>
      <svg width={W} height={H} style={{ display: "block", maxWidth: "100%" }}>
        {/* y axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const v = Math.round(minWap + (maxWap - minWap) * (1 - p));
          const y = padT + p * innerH;
          return (
            <g key={p}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={R.sep} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill={R.textDim}>
                £{v}
              </text>
            </g>
          );
        })}
        {/* bars */}
        {snapshots.map((s, i) => {
          if (s.wap === null) return null;
          const h = ((s.wap - minWap) / (maxWap - minWap || 1)) * innerH;
          const x = padL + i * (innerW / snapshots.length);
          const y = padT + innerH - h;
          return (
            <rect
              key={s.checkinDate}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={R.teal}
              opacity={0.85}
            >
              <title>{s.checkinDate}: £{Math.round(s.wap)} / {s.totalProperties} props</title>
            </rect>
          );
        })}
        {/* x ticks every ~14 days */}
        {snapshots.map((s, i) => {
          if (i % 14 !== 0) return null;
          const x = padL + i * (innerW / snapshots.length);
          return (
            <text
              key={s.checkinDate + "x"}
              x={x}
              y={H - 10}
              fontSize="10"
              fill={R.textDim}
            >
              {s.checkinDate.slice(5)}
            </text>
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: R.textDim, marginTop: 6 }}>
        {snapshots.length} days captured · range £{Math.round(minWap)}–£{Math.round(maxWap)}
      </div>
    </div>
  );
}
