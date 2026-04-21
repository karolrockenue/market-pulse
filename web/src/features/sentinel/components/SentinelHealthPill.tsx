import { useState } from "react";
import { R } from "../../../styles/tokens";
import type { HotelHealth, HealthStatus } from "../api/types";

interface Props {
  health: HotelHealth;
  onOpenHealth?: () => void;
}

function fmtAge(iso: string | null): string {
  if (!iso) return "never";
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

function statusColor(status: HealthStatus): string {
  switch (status) {
    case "green": return R.green;
    case "amber": return R.amber;
    case "red":   return R.red;
    default:      return R.textDim;
  }
}

/**
 * Admin-only. Sits next to the property name in AppTopBar.
 * Shows a coloured dot + "pushed Xm ago". Hover opens a popover with the
 * last success / last failure and a link to the full Health page.
 */
export function SentinelHealthPill({ health, onOpenHealth }: Props) {
  const [hover, setHover] = useState(false);

  // Don't render at all when Sentinel isn't applicable to this hotel.
  if (health.status === "off") return null;

  const color = statusColor(health.status);
  const label = health.last_success_at
    ? `pushed ${fmtAge(health.last_success_at)}`
    : "never pushed";

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px 5px 9px",
          background: R.card,
          border: `1px solid ${R.border}`,
          borderRadius: 999,
          cursor: onOpenHealth ? "pointer" : "default",
        }}
        onClick={onOpenHealth}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 6px ${color}80`,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: R.accent, letterSpacing: 0.2 }}>
          Sentinel
        </span>
        <span style={{ fontSize: 11, color: R.textMid }}>· {label}</span>
      </div>

      {hover && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 100,
            width: 280,
            padding: 12,
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            fontSize: 11,
            color: R.accent,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>
            Sentinel · {health.property_name}
          </div>
          <Row label="Status" value={statusText(health)} color={color} />
          <Row label="Autopilot" value={health.autopilot ? "on" : "off"} />
          <Row
            label="Last push"
            value={health.last_success_at ? `${fmtAge(health.last_success_at)} · ${health.last_success_rates_count ?? "?"} rates` : "never"}
          />
          <Row
            label="Last failure"
            value={health.last_failure_at ? fmtAge(health.last_failure_at) : "—"}
            valueColor={health.last_failure_at ? R.amber : undefined}
          />
          {health.last_failure_error && (
            <div style={{ marginTop: 6, padding: 6, background: R.bg, borderRadius: 4, color: R.textMid, fontSize: 10, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
              {health.last_failure_error}
            </div>
          )}
          {health.consecutive_failures > 0 && (
            <Row label="Streak" value={`${health.consecutive_failures} consecutive failures`} valueColor={R.red} />
          )}
          {onOpenHealth && (
            <div
              onClick={onOpenHealth}
              style={{
                marginTop: 10,
                padding: "6px 8px",
                background: `${R.warmTeal}18`,
                border: `1px solid ${R.warmTeal}40`,
                borderRadius: 4,
                textAlign: "center",
                color: R.warmTeal,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Open Sentinel Health →
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color, valueColor }: { label: string; value: string; color?: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ color: R.textMid }}>{label}</span>
      <span style={{ color: valueColor || R.accent, fontWeight: color ? 600 : 400, display: "inline-flex", alignItems: "center", gap: 6 }}>
        {color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />}
        {value}
      </span>
    </div>
  );
}

function statusText(h: HotelHealth): string {
  switch (h.status) {
    case "green": return "Healthy";
    case "amber": return "Recent failure";
    case "red":   return h.consecutive_failures >= 3 ? "Repeated failures" : "Stale";
    default:      return "Off";
  }
}
