import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MarketOutlookBannerProps {
  status: "strengthening" | "softening" | "stable" | "initializing";
  metric: string;
}

const statusContent = {
  strengthening: {
    title: "The 30-day market demand is strengthening",
    Icon: TrendingUp,
    style: {
      background: "rgba(52, 208, 104, 0.06)",
      borderColor: "rgba(52, 208, 104, 0.2)",
      iconColor: "#34D068",
      textColor: "#34D068",
    },
  },
  softening: {
    title: "The 30-day market demand is softening",
    Icon: TrendingDown,
    style: {
      background: "rgba(239, 68, 68, 0.06)",
      borderColor: "rgba(239, 68, 68, 0.2)",
      iconColor: "#ef4444",
      textColor: "#ef4444",
    },
  },
  stable: {
    title: "The 30-day market demand is stable",
    Icon: Minus,
    style: {
      background: "rgba(200, 166, 110, 0.06)",
      borderColor: "rgba(200, 166, 110, 0.2)",
      iconColor: "#C8A66E",
      textColor: "#C8A66E",
    },
  },
  initializing: {
    title: "System Initializing",
    Icon: TrendingUp,
    style: {
      background: "rgba(57, 189, 248, 0.06)",
      borderColor: "rgba(57, 189, 248, 0.2)",
      iconColor: "#38C6BA",
      textColor: "#38C6BA",
    },
  },
};

export function MarketOutlookBanner({
  status,
  metric,
}: MarketOutlookBannerProps) {
  const content = statusContent[status] || statusContent.stable;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px 20px",
        borderRadius: "8px",
        backgroundColor: content.style.background,
        border: `1px solid ${content.style.borderColor}`,
      }}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          width: "40px",
          height: "40px",
          borderRadius: "9999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.2)",
          border: `1px solid ${content.style.borderColor}`,
        }}
      >
        <content.Icon
          className="w-5 h-5"
          style={{ color: content.style.iconColor }}
        />
      </div>

      {/* Text — title + inline description */}
      <div style={{ flexGrow: 1, display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: content.style.textColor,
          }}
        >
          {content.title}
        </span>
        <span style={{ fontSize: "12px", color: "#7A8494" }}>
          {status === "initializing"
            ? "Full market intelligence will be available in approximately 24 hours."
            : "Calculated from thousands of live OTA data points daily"}
        </span>
      </div>

      {/* Metric */}
      <div
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: content.style.textColor,
          whiteSpace: "nowrap",
        }}
      >
        {metric}
      </div>
    </div>
  );
}
