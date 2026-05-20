import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  X,
  MapPin,
  Globe,
  Star,
  Download,
  TrendingUp,
  Flame,
  Target,
  Activity,
  Database,
} from "lucide-react";
import { R } from "../../../styles/tokens";
import {
  fetchIcelandDashboard,
  type IcelandDashboardPayload,
  type IcelandProperty,
  type IcelandMonthlySeasonality,
  type IcelandCompressionDay,
  type IcelandSalesTargets,
  type IcelandCoverageMatrix,
} from "../api/iceland.api";

const fmtGbp = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `£${Math.round(v).toLocaleString()}`;
const fmtNum = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString();
const fmtScore = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toFixed(1);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function formatCompressionDate(iso: string): string {
  // iso is "YYYY-MM-DD". Treat as UTC so the displayed weekday matches the
  // checkin date regardless of the viewer's locale.
  const d = new Date(iso + "T12:00:00Z");
  const wd = WEEKDAYS[d.getUTCDay()];
  const day = d.getUTCDate();
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${wd} ${day} ${month}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 36) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type SortKey = "name" | "type" | "stars" | "score" | "reviewCount" | "price" | "neighborhood" | "chain";

export function IcelandDashboard() {
  const [data, setData] = useState<IcelandDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<"all" | "tier1" | "tier2" | "tier3">("all");
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

  const tierIdSet = useMemo<Set<string> | null>(() => {
    if (!data || tierFilter === "all") return null;
    return new Set(data.salesTargets[tierFilter].ids);
  }, [data, tierFilter]);

  const filteredInventory: IcelandProperty[] = useMemo(() => {
    if (!data) return [];
    let rows = data.inventory;
    if (tierIdSet) rows = rows.filter((r) => tierIdSet.has(r.bookingHotelId));
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
  }, [data, tierIdSet, typeFilter, chainFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "type" || key === "neighborhood" || key === "chain" ? "asc" : "desc");
    }
  }

  function exportCsv() {
    if (!data) return;
    const rows = filteredInventory;
    const header = [
      "Name", "Type", "Stars", "ReviewScore", "ReviewCount", "FromPrice",
      "Neighborhood", "Chain", "StreetAddress", "WebsiteURL", "BookingURL", "BookingID",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        r.name,
        r.type ?? "",
        r.stars ?? "",
        r.score ?? "",
        r.reviewCount ?? "",
        r.price ?? "",
        r.neighborhood,
        r.chain,
        r.streetAddress ?? "",
        r.websiteUrl ?? "",
        r.url ?? "",
        r.bookingHotelId,
      ];
      lines.push(cells.map((c) => {
        const s = String(c ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const tag = tierFilter === "all" ? "all" : tierFilter;
    a.download = `reykjavik-${tag}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
  const maxStarCount = Math.max(...data.starDistribution.map((b) => b.count), 1);

  return (
    <div style={{ padding: "24px 32px", color: R.accent, background: R.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Rockenue · Iceland market intelligence
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 600, color: R.accent, margin: 0 }}>
            Reykjavík <span style={{ color: R.textMid, fontWeight: 400, fontSize: 18 }}>· capital region</span>
          </h1>
          <ScrapeHealthLine
            scrapeDays={data.scrapeHealth.scrapeDays}
            lastScrape={data.scrapeHealth.lastScrape}
            totalSnapshots={data.scrapeHealth.totalSnapshots}
            inventoryRefresh={data.lastInventoryRefresh}
          />
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

      {/* OPPORTUNITY HERO */}
      <OpportunityHero opportunity={data.opportunity} />

      {/* COVERAGE HEATMAP — the "we capture everything" proof */}
      <CoverageHeatmapCard matrix={data.coverageMatrix} />

      {/* SEASONALITY + COMPRESSION */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <SeasonalityCard
          months={data.market.monthlySeasonality}
          hasData={data.market.hasData}
        />
        <CompressionDaysCard days={data.market.compressionDays} />
      </div>

      {/* SALES TARGETS MATRIX */}
      <Section title="Sales Targets · Tiered Outreach Plan">
        <div style={{ fontSize: 12, color: R.textMid, marginBottom: 12 }}>
          Every property in Reykjavík bucketed into a sales motion. Click a tier to filter the inventory table below.
        </div>
        <TargetsMatrix
          targets={data.salesTargets}
          activeTier={tierFilter}
          onSelect={(t) => setTierFilter(t)}
        />
      </Section>

      {/* THREE-COLUMN BREAKDOWN */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
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

      {/* TOP HOTELS */}
      <Section title={`Top ${Math.min(data.topHotels.length, 25)} Hotels · by Review Volume`}>
        <div style={{ fontSize: 12, color: R.textMid, marginBottom: 12 }}>
          Properties with the most reviews are the most established and visible. Sort outreach by these first: highest signal-to-effort ratio.
        </div>
        <InventoryTable
          rows={data.topHotels}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpenDetail={setDrawerHotelId}
        />
      </Section>

      {/* FULL INVENTORY with CSV export */}
      <Section title={`Full Inventory · ${filteredInventory.length} of ${data.inventory.length}`}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, fontSize: 13, color: R.text, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: R.textMid }}>Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as any)}
              style={selectStyle}
            >
              <option value="all">All ({data.inventory.length})</option>
              <option value="tier1">Tier 1 · Branded ({data.salesTargets.tier1.count})</option>
              <option value="tier2">Tier 2 · Est. Independents ({data.salesTargets.tier2.count})</option>
              <option value="tier3">Tier 3 · Long Tail ({data.salesTargets.tier3.count})</option>
            </select>
          </label>
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
          <button
            onClick={exportCsv}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              background: R.cardLight,
              border: `1px solid ${R.border}`,
              borderRadius: 6,
              color: R.teal,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="Download the filtered list as a CSV"
          >
            <Download size={13} />
            Export CSV ({filteredInventory.length} rows)
          </button>
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

// --------------------------------------------------------------------------
// Header health line
// --------------------------------------------------------------------------

function ScrapeHealthLine({
  scrapeDays,
  lastScrape,
  totalSnapshots,
  inventoryRefresh,
}: {
  scrapeDays: number;
  lastScrape: string | null;
  totalSnapshots: number;
  inventoryRefresh: string | null;
}) {
  return (
    <div style={{ fontSize: 12, color: R.textMid, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 14 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: R.green, display: "inline-block" }} />
        <span style={{ color: R.text }}>Forward demand scraped daily</span>
      </span>
      <span>
        <span style={{ color: R.textDim }}>Last scrape:</span>{" "}
        <span style={{ color: R.text }}>{timeAgo(lastScrape)}</span>
      </span>
      <span>
        <span style={{ color: R.textDim }}>30-day window:</span>{" "}
        <span style={{ color: R.text }}>{scrapeDays} consecutive days · {totalSnapshots.toLocaleString()} forward snapshots</span>
      </span>
      <span>
        <span style={{ color: R.textDim }}>Inventory last refreshed:</span>{" "}
        <span style={{ color: R.text }}>
          {inventoryRefresh
            ? new Date(inventoryRefresh).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : "never"}
        </span>
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Opportunity Hero
// --------------------------------------------------------------------------

function OpportunityHero({ opportunity }: { opportunity: IcelandDashboardPayload["opportunity"] }) {
  const stats: { label: string; value: string; sub?: string; tone?: "primary" | "wedge" | "branded" | "peak" | "neutral" }[] = [
    {
      label: "Properties tracked",
      value: opportunity.totalProperties.toString(),
      sub: `${opportunity.totalHotels} hotels`,
      tone: "primary",
    },
    {
      label: "Independent (wedge)",
      value: opportunity.independentCount.toString(),
      sub: `${Math.round((opportunity.independentCount / opportunity.totalProperties) * 100)}% of market`,
      tone: "wedge",
    },
    {
      label: "Branded targets",
      value: opportunity.brandedCount.toString(),
      sub: `${opportunity.chainCount} chains · central decision-makers`,
      tone: "branded",
    },
    {
      label: "Peak month",
      value: opportunity.peakMonth ? fmtGbp(opportunity.peakMonth.avgWap) : "—",
      sub: opportunity.peakMonth ? `${opportunity.peakMonth.label} · avg WAP` : "120-day forward",
      tone: "peak",
    },
    {
      label: "Trough month",
      value: opportunity.troughMonth ? fmtGbp(opportunity.troughMonth.avgWap) : "—",
      sub: opportunity.troughMonth ? `${opportunity.troughMonth.label} · avg WAP` : "120-day forward",
      tone: "neutral",
    },
    {
      label: "Seasonal uplift",
      value: opportunity.seasonalUpliftPct !== null ? `+${opportunity.seasonalUpliftPct}%` : "—",
      sub: "trough → peak ADR · RM headroom",
      tone: "peak",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 10,
        marginBottom: 24,
      }}
    >
      {stats.map((s) => {
        const valueColor =
          s.tone === "wedge"
            ? R.gold
            : s.tone === "branded"
            ? R.teal
            : s.tone === "peak"
            ? R.amber
            : R.accent;
        return (
          <div
            key={s.label}
            style={{
              background: R.card,
              border: `1px solid ${R.border}`,
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: valueColor, lineHeight: 1.1 }}>
              {s.value}
            </div>
            {s.sub && (
              <div style={{ fontSize: 11, color: R.textMid }}>{s.sub}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Seasonality Card
// --------------------------------------------------------------------------

function SeasonalityCard({
  months,
  hasData,
}: {
  months: IcelandMonthlySeasonality[];
  hasData: boolean;
}) {
  if (!hasData || months.length === 0) {
    return (
      <div
        style={{
          background: R.card,
          border: `1px solid ${R.border}`,
          borderRadius: 10,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: R.textMid,
          fontSize: 13,
        }}
      >
        <AlertTriangle size={16} color={R.amber} />
        Forward market data still warming up. Daily Render cron writes appear in the dashboard automatically.
      </div>
    );
  }

  const maxWap = Math.max(...months.map((m) => m.avgWap ?? 0), 1);

  return (
    <div
      style={{
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={14} color={R.teal} />
        <div style={{ fontSize: 12, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Forward demand · monthly avg WAP
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: R.textMid }}>
          {months.reduce((s, m) => s + m.samples, 0)} forward dates captured
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${months.length}, 1fr)`,
          gap: 12,
          alignItems: "end",
          minHeight: 180,
        }}
      >
        {months.map((m) => {
          const pct = m.avgWap !== null ? (m.avgWap / maxWap) * 100 : 0;
          return (
            <div key={m.ym} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 13, color: R.accent, fontWeight: 600 }}>
                {m.avgWap !== null ? fmtGbp(m.avgWap) : "—"}
              </div>
              <div
                style={{
                  width: "100%",
                  height: 140,
                  background: R.recessed,
                  borderRadius: 6,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${pct}%`,
                    background: `linear-gradient(180deg, ${R.teal} 0%, #1f8a82 100%)`,
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: R.textMid, textAlign: "center" }}>
                {m.label}
              </div>
              <div style={{ fontSize: 10, color: R.textDim }}>
                {m.avgSupply !== null ? `${m.avgSupply} props` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Compression Days Card
// --------------------------------------------------------------------------

function CompressionDaysCard({ days }: { days: IcelandCompressionDay[] }) {
  if (days.length === 0) {
    return (
      <div
        style={{
          background: R.card,
          border: `1px solid ${R.border}`,
          borderRadius: 10,
          padding: 16,
          color: R.textMid,
          fontSize: 13,
        }}
      >
        No compression signal yet.
      </div>
    );
  }

  const maxWap = Math.max(...days.map((d) => d.wap));

  return (
    <div
      style={{
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Flame size={14} color={R.amber} />
        <div style={{ fontSize: 12, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Top 10 pricing-power dates
        </div>
      </div>
      <div style={{ fontSize: 11, color: R.textMid, marginBottom: 12, lineHeight: 1.4 }}>
        Highest forward WAP in the next 120 days — these are the dates your hotels should be charging premiums on.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {days.map((d) => {
          const pct = (d.wap / maxWap) * 100;
          return (
            <div key={d.checkinDate} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <div style={{ minWidth: 80, color: R.text }}>{formatCompressionDate(d.checkinDate)}</div>
              <div style={{ flex: 1, height: 6, background: R.recessed, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: R.amber }} />
              </div>
              <div style={{ minWidth: 60, textAlign: "right", color: R.amber, fontWeight: 600 }}>
                {fmtGbp(d.wap)}
              </div>
              <div style={{ minWidth: 40, textAlign: "right", color: R.textDim, fontSize: 11 }}>
                {d.totalProperties !== null ? `${d.totalProperties}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: R.textDim, marginTop: 10, display: "flex", justifyContent: "space-between" }}>
        <span>Bar = avg WAP</span>
        <span>Right column = properties still bookable</span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Targets Matrix
// --------------------------------------------------------------------------

function TargetsMatrix({
  targets,
  activeTier,
  onSelect,
}: {
  targets: IcelandSalesTargets;
  activeTier: "all" | "tier1" | "tier2" | "tier3";
  onSelect: (t: "all" | "tier1" | "tier2" | "tier3") => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
      }}
    >
      <TierCard
        label={targets.tier1.label}
        blurb={targets.tier1.blurb}
        count={targets.tier1.count}
        active={activeTier === "tier1"}
        accentColor={R.teal}
        icon={<Target size={14} color={R.teal} />}
        onSelect={() => onSelect(activeTier === "tier1" ? "all" : "tier1")}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {targets.tier1.chains.map((c) => (
            <div
              key={c.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                padding: "4px 0",
                borderBottom: `1px solid ${R.sep}`,
              }}
            >
              <span style={{ color: R.text }}>{c.name}</span>
              <span style={{ color: R.teal, fontWeight: 600 }}>{c.count}</span>
            </div>
          ))}
        </div>
      </TierCard>

      <TierCard
        label={targets.tier2.label}
        blurb={targets.tier2.blurb}
        count={targets.tier2.count}
        active={activeTier === "tier2"}
        accentColor={R.gold}
        icon={<Activity size={14} color={R.gold} />}
        onSelect={() => onSelect(activeTier === "tier2" ? "all" : "tier2")}
      >
        <div style={{ fontSize: 12, color: R.textMid, lineHeight: 1.5 }}>
          Owner-operated, established. Strongest fit for Sentinel + revenue management. Click the tier to filter the inventory table below; export the CSV for outreach.
        </div>
      </TierCard>

      <TierCard
        label={targets.tier3.label}
        blurb={targets.tier3.blurb}
        count={targets.tier3.count}
        active={activeTier === "tier3"}
        accentColor={R.textMid}
        icon={<Activity size={14} color={R.textMid} />}
        onSelect={() => onSelect(activeTier === "tier3" ? "all" : "tier3")}
      >
        <div style={{ fontSize: 12, color: R.textMid, lineHeight: 1.5 }}>
          Smaller / newer / unrated properties. Lower per-deal value but the volume play — cold outreach, group offers, partner with property managers like Heimaleiga.
        </div>
      </TierCard>
    </div>
  );
}

function TierCard({
  label,
  blurb,
  count,
  active,
  accentColor,
  icon,
  onSelect,
  children,
}: {
  label: string;
  blurb: string;
  count: number;
  active: boolean;
  accentColor: string;
  icon: React.ReactNode;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: R.card,
        border: `1px solid ${active ? accentColor : R.border}`,
        boxShadow: active ? `0 0 0 1px ${accentColor}` : "none",
        borderRadius: 10,
        padding: 18,
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <div style={{ fontSize: 11, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 36, fontWeight: 600, color: accentColor, lineHeight: 1 }}>
          {count}
        </div>
        <div style={{ fontSize: 11, color: R.textMid }}>properties</div>
      </div>
      <div style={{ fontSize: 11, color: R.textMid, marginTop: 6, marginBottom: 12, lineHeight: 1.4 }}>
        {blurb}
      </div>
      {children}
      <div style={{ marginTop: 12, fontSize: 11, color: active ? accentColor : R.textDim, fontWeight: active ? 600 : 400 }}>
        {active ? "✓ Filtering inventory ↓" : "Click to filter inventory ↓"}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Coverage Heatmap — every scrape day × every forward checkin date
// --------------------------------------------------------------------------

const HEAT_BINS = ["#1d3a38", "#266b65", "#38C6BA", "#f59e0b", "#ef4444"];
const HEAT_LABELS = ["Cool", "Low", "Mid", "High", "Peak"];

function binFor(wap: number | null, cutoffs: number[]): number {
  if (wap === null || cutoffs.length < 4) return -1;
  if (wap < cutoffs[0]) return 0;
  if (wap < cutoffs[1]) return 1;
  if (wap < cutoffs[2]) return 2;
  if (wap < cutoffs[3]) return 3;
  return 4;
}

function scrapeDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const wd = WEEKDAYS[d.getUTCDay()];
  const day = d.getUTCDate();
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${wd} ${day} ${mo}`;
}

function CoverageHeatmapCard({ matrix }: { matrix: IcelandCoverageMatrix }) {
  if (matrix.rows.length === 0 || matrix.columns === 0) {
    return null;
  }

  const cols = matrix.columns;
  const firstRow = matrix.rows[0];

  const monthMarkers: { idx: number; label: string }[] = [];
  let prevMonth: string | null = null;
  firstRow.cells.forEach((c, idx) => {
    const month = c.checkinDate.slice(0, 7);
    if (month !== prevMonth) {
      monthMarkers.push({
        idx,
        label: scrapeDayLabel(c.checkinDate).split(" ").slice(-1)[0],
      });
      prevMonth = month;
    }
  });

  return (
    <div
      style={{
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        padding: 18,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Database size={14} color={R.teal} />
        <div style={{ fontSize: 12, color: R.textDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Market rate coverage
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: R.textMid }}>
          {matrix.scrapeDays} scrape days × {matrix.columns} forward dates ·{" "}
          <span style={{ color: R.teal, fontWeight: 600 }}>
            {matrix.totalCellsFilled.toLocaleString()}
          </span>{" "}
          full-market snapshots
        </div>
      </div>
      <div style={{ fontSize: 11, color: R.textMid, marginBottom: 14, lineHeight: 1.4 }}>
        Every cell is one full Reykjavík market scrape. Reading down a column shows how prices for that night evolved day-by-day; reading across a row shows the entire forward landscape captured on that morning.
      </div>

      {/* Heatmap grid */}
      <div style={{ display: "flex", gap: 8 }}>
        {/* Row labels */}
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${matrix.rows.length}, 1fr)`,
            gap: 2,
            minWidth: 84,
          }}
        >
          {matrix.rows.map((row, idx) => (
            <div
              key={row.scrapeDay}
              style={{
                fontSize: 10,
                color: idx === 0 ? R.teal : R.textMid,
                fontWeight: idx === 0 ? 600 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 4,
              }}
            >
              {scrapeDayLabel(row.scrapeDay)}
              {idx === 0 ? "  ←" : ""}
            </div>
          ))}
        </div>

        {/* Cell grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${matrix.rows.length}, 1fr)`,
              gap: 2,
              minHeight: matrix.rows.length * 18,
            }}
          >
            {matrix.rows.map((row) =>
              row.cells.map((cell) => {
                const b = binFor(cell.wap, matrix.wapCutoffs);
                const bg = b < 0 ? R.recessed : HEAT_BINS[b];
                return (
                  <div
                    key={`${row.scrapeDay}-${cell.checkinDate}`}
                    title={
                      cell.wap !== null
                        ? `${cell.checkinDate} · scraped ${row.scrapeDay} · £${Math.round(cell.wap)} · ${cell.totalProperties ?? "—"} props`
                        : `${cell.checkinDate} · scraped ${row.scrapeDay} · no data`
                    }
                    style={{
                      background: bg,
                      borderRadius: 1,
                    }}
                  />
                );
              }),
            )}
          </div>

          {/* Month axis */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              marginTop: 6,
              position: "relative",
              height: 14,
            }}
          >
            {monthMarkers.map((m) => (
              <div
                key={m.idx}
                style={{
                  gridColumn: `${m.idx + 1} / span 1`,
                  fontSize: 10,
                  color: R.textDim,
                  whiteSpace: "nowrap",
                  borderLeft: `1px solid ${R.sep}`,
                  paddingLeft: 3,
                }}
              >
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend + pitch */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: R.textMid }}>
          <span style={{ color: R.textDim }}>WAP intensity:</span>
          {HEAT_BINS.map((c, i) => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, background: c, borderRadius: 2, display: "inline-block" }} />
              <span>{HEAT_LABELS[i]}</span>
            </div>
          ))}
          <span style={{ color: R.textDim, marginLeft: 4 }}>
            (£{Math.round(matrix.minWap ?? 0)} – £{Math.round(matrix.maxWap ?? 0)})
          </span>
        </div>
        <div style={{ fontSize: 11, color: R.text, fontStyle: "italic" }}>
          Every priced night for the next ~4 months, captured fresh every morning.
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Layout primitives (unchanged)
// --------------------------------------------------------------------------

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
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 999,
        }}
      />
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

        <div style={{ padding: "16px 24px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: `1px solid ${R.sep}` }}>
          {hotel.url && (
            <a
              href={hotel.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...drawerButton, background: R.cardLight, color: R.teal }}
            >
              <ExternalLink size={13} />
              Open on Booking
            </a>
          )}
          {hotel.streetAddress && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.streetAddress + ", Iceland")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...drawerButton, background: R.cardLight, color: R.text }}
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
              style={{ ...drawerButton, background: R.cardLight, color: R.text }}
            >
              <Globe size={13} />
              Hotel website
            </a>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${R.sep}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <DrawerKpi label="Review score" value={hotel.score !== null ? hotel.score.toFixed(1) : "—"} />
            <DrawerKpi label="Reviews" value={fmtNum(hotel.reviewCount)} />
            <DrawerKpi label="From" value={fmtGbp(hotel.price)} accent />
          </div>
        </div>

        {hotel.streetAddress && (
          <DrawerSection title="Address" icon={<MapPin size={13} />}>
            <div style={{ color: R.text, fontSize: 13, lineHeight: 1.5 }}>{hotel.streetAddress}</div>
          </DrawerSection>
        )}

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

        {hotel.descriptionExcerpt && (
          <DrawerSection title="About this property">
            <div style={{ color: R.text, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {hotel.descriptionExcerpt}
              {hotel.descriptionExcerpt.length >= 800 && "…"}
            </div>
          </DrawerSection>
        )}

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
