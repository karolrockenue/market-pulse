import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { R } from "../../../../styles/tokens";
import { getFleetHealth } from "../../api/sentinel.api";
import type {
  FleetHealthResponse,
  FleetHealthRow,
  HealthStatus,
  SparklineCell,
  FailureCluster,
} from "../../api/types";

const POLL_MS = 60_000;

function statusColor(status: HealthStatus): string {
  switch (status) {
    case "green": return R.green;
    case "amber": return R.amber;
    case "red":   return R.red;
    default:      return R.textDim;
  }
}

function fmtAge(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function buildLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function HealthView() {
  const [data, setData] = useState<FleetHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<HealthStatus | "all">("all");
  const [expandedSig, setExpandedSig] = useState<string | null>(null);

  const load = async () => {
    try {
      const resp = await getFleetHealth();
      setData(resp);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load fleet health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const counts = useMemo(() => {
    const c = { green: 0, amber: 0, red: 0, off: 0 };
    (data?.fleet || []).forEach(r => { c[r.status] += 1; });
    return c;
  }, [data]);

  const filteredFleet = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data.fleet;
    return data.fleet.filter(r => r.status === statusFilter);
  }, [data, statusFilter]);

  const days = useMemo(buildLast30Days, []);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, color: R.textMid }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
        Loading Sentinel Health...
      </div>
    );
  }

  if (err && !data) {
    return (
      <div style={{ padding: 40, color: R.red }}>Failed to load: {err}</div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", background: R.bg, color: R.accent, minHeight: "100%", paddingBottom: 64 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Sentinel · Operations
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Health</h1>
          <button
            onClick={load}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", background: R.card, border: `1px solid ${R.border}`,
              borderRadius: 6, color: R.textMid, fontSize: 11, cursor: "pointer",
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <p style={{ fontSize: 13, color: R.textMid, margin: "6px 0 0" }}>
          Freshness of Sentinel rate pushes across rockenue-managed hotels.
          Autopilot SLA 4h · non-autopilot SLA 24h. Polls every 60s.
        </p>
      </div>

      {/* Status chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all", "red", "amber", "green", "off"] as const).map(key => {
          const active = statusFilter === key;
          const color = key === "all" ? R.warmTeal : statusColor(key as HealthStatus);
          const count = key === "all" ? (data?.fleet.length ?? 0) : counts[key as HealthStatus];
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px",
                background: active ? `${color}18` : R.card,
                border: `1px solid ${active ? color : R.border}`,
                color: active ? color : R.textMid,
                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                textTransform: "uppercase", letterSpacing: 0.5,
              }}
            >
              {key !== "all" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />}
              {key} · {count}
            </button>
          );
        })}
      </div>

      {/* Freshness banner */}
      {counts.red > 0 && (
        <div
          onClick={() => setStatusFilter("red")}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 16px", marginBottom: 20,
            background: `${R.red}12`, border: `1px solid ${R.red}40`,
            borderRadius: 8, cursor: "pointer",
          }}
        >
          <AlertTriangle size={16} color={R.red} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: R.red }}>
              {counts.red} hotel{counts.red === 1 ? "" : "s"} exceed{counts.red === 1 ? "s" : ""} SLA
            </div>
            <div style={{ fontSize: 11, color: R.textMid, marginTop: 2 }}>
              No successful push within the freshness window, or 3+ consecutive failures.
              Click to filter the grid.
            </div>
          </div>
        </div>
      )}

      {/* Fleet grid */}
      <div style={{
        background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 28,
      }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${R.border}`, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: R.textMid }}>
          Fleet · {filteredFleet.length} {filteredFleet.length === 1 ? "hotel" : "hotels"}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: R.bg }}>
                <Th>Hotel</Th>
                <Th>PMS</Th>
                <Th>Autopilot</Th>
                <Th>Status</Th>
                <Th>Last success</Th>
                <Th>Last failure</Th>
                <Th align="right">7d fails</Th>
                <Th>30-day</Th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.map(row => (
                <FleetRow
                  key={row.hotel_id}
                  row={row}
                  days={days}
                  sparkline={data?.sparklines[String(row.hotel_id)] ?? {}}
                />
              ))}
              {filteredFleet.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: R.textMid }}>No hotels match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failure clusters */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Failures · Last 24h
        </div>
        {(data?.clusters.length ?? 0) === 0 ? (
          <div style={{ padding: 20, color: R.textMid, background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, fontSize: 12 }}>
            No failures in the last 24 hours. Nice.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data!.clusters.map(c => (
              <ClusterCard
                key={c.signature}
                cluster={c}
                expanded={expandedSig === c.signature}
                onToggle={() => setExpandedSig(expandedSig === c.signature ? null : c.signature)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      padding: "10px 12px",
      textAlign: align || "left",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: R.textMid,
      borderBottom: `1px solid ${R.border}`,
      whiteSpace: "nowrap",
    }}>
      {children}
    </th>
  );
}

function FleetRow({ row, days, sparkline }: { row: FleetHealthRow; days: string[]; sparkline: Record<string, SparklineCell> }) {
  const color = statusColor(row.status);
  const statusLabel = row.status === "red"
    ? (row.consecutive_failures >= 3 ? "Repeated failures" : "Stale")
    : row.status === "amber" ? "Recent failure"
    : row.status === "green" ? "Healthy"
    : "Off";

  return (
    <tr style={{ borderBottom: `1px solid ${R.border}` }}>
      <Td>
        <div style={{ color: R.accent, fontWeight: 500 }}>{row.property_name}</div>
        <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>ID {row.hotel_id}</div>
      </Td>
      <Td>
        <span style={{ fontSize: 11, color: R.textMid, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {row.pms_type || "—"}
        </span>
      </Td>
      <Td>
        <span style={{ fontSize: 11, color: row.autopilot ? R.warmTeal : R.textDim, fontWeight: 600 }}>
          {row.autopilot ? "ON" : "off"}
        </span>
      </Td>
      <Td>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}80` }} />
          <span style={{ fontSize: 11, color: R.accent, fontWeight: 600 }}>{statusLabel}</span>
        </div>
      </Td>
      <Td>
        <div style={{ fontSize: 11, color: R.accent }}>{fmtAge(row.last_success_at)}</div>
        {row.last_success_rates_count != null && (
          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{row.last_success_rates_count} rates</div>
        )}
      </Td>
      <Td>
        <div style={{ fontSize: 11, color: row.last_failure_at ? R.amber : R.textDim }}>{fmtAge(row.last_failure_at)}</div>
        {row.last_failure_error && (
          <div style={{ fontSize: 10, color: R.textMid, marginTop: 2, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.last_failure_error}
          </div>
        )}
      </Td>
      <Td align="right">
        <span style={{ fontSize: 12, fontWeight: 600, color: row.failures_7d > 0 ? R.amber : R.textDim }}>
          {row.failures_7d}
        </span>
        {row.consecutive_failures > 0 && (
          <div style={{ fontSize: 10, color: R.red, marginTop: 2 }}>{row.consecutive_failures} in a row</div>
        )}
      </Td>
      <Td>
        <Sparkline days={days} cells={sparkline} />
      </Td>
    </tr>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{
      padding: "10px 12px",
      verticalAlign: "top",
      textAlign: align || "left",
      whiteSpace: "nowrap",
    }}>
      {children}
    </td>
  );
}

function Sparkline({ days, cells }: { days: string[]; cells: Record<string, SparklineCell> }) {
  return (
    <div style={{ display: "inline-flex", gap: 2 }}>
      {days.map(d => {
        const cell = cells[d] || "none";
        const bg =
          cell === "green" ? R.green
          : cell === "amber" ? R.amber
          : cell === "red" ? R.red
          : R.border;
        return (
          <div
            key={d}
            title={`${d}: ${cell === "none" ? "no activity" : cell}`}
            style={{
              width: 6, height: 18, borderRadius: 1,
              background: bg,
              opacity: cell === "none" ? 0.4 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

function ClusterCard({ cluster, expanded, onToggle }: { cluster: FailureCluster; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8 }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "12px 16px", cursor: "pointer",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>{cluster.signature}</div>
          <div style={{ fontSize: 11, color: R.textMid, marginTop: 3 }}>
            {cluster.hotel_count} hotel{cluster.hotel_count === 1 ? "" : "s"} · {cluster.count} occurrence{cluster.count === 1 ? "" : "s"} · latest {fmtAge(cluster.latest_at)}
          </div>
        </div>
        <ChevronDown size={14} color={R.textMid} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${R.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: R.textMid, marginBottom: 6 }}>
            Affected hotels
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {cluster.hotels.map(h => (
              <span key={h} style={{ fontSize: 11, padding: "3px 8px", background: R.bg, border: `1px solid ${R.border}`, borderRadius: 4, color: R.accent }}>{h}</span>
            ))}
          </div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, color: R.textMid, marginBottom: 6 }}>
            Sample error
          </div>
          <div style={{ fontSize: 11, padding: 10, background: R.bg, borderRadius: 4, color: R.textMid, fontFamily: "monospace", lineHeight: 1.5 }}>
            {cluster.sample_error || "(no error text)"}
          </div>
        </div>
      )}
    </div>
  );
}
