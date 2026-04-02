import { Building2, Users } from "lucide-react";

interface MarketVeilProps {
  cityName?: string;
  currentCount: number;
  requiredCount?: number;
}

export function MarketVeil({
  cityName,
  currentCount,
  requiredCount = 5,
}: MarketVeilProps) {
  const remaining = requiredCount - currentCount;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "16px",
          backgroundColor: "rgba(57, 189, 248, 0.08)",
          border: "1px solid rgba(57, 189, 248, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <Building2 size={36} color="#39BDF8" strokeWidth={1.5} />
      </div>

      <h2
        style={{
          color: "#e5e5e5",
          fontSize: "20px",
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        More properties needed
        {cityName ? ` in ${cityName.charAt(0).toUpperCase() + cityName.slice(1)}` : ""}
      </h2>

      <p
        style={{
          color: "#6b7280",
          fontSize: "14px",
          maxWidth: "420px",
          lineHeight: "1.6",
          marginBottom: "32px",
        }}
      >
        Market intelligence requires at least {requiredCount} properties in a market
        to generate meaningful competitive data.
        {remaining > 0 && (
          <>
            {" "}Currently {currentCount} {currentCount === 1 ? "property" : "properties"} — {remaining} more
            {remaining === 1 ? " is" : " are"} needed.
          </>
        )}
      </p>

      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "32px",
        }}
      >
        {Array.from({ length: requiredCount }).map((_, i) => (
          <div
            key={i}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              backgroundColor:
                i < currentCount
                  ? "rgba(57, 189, 248, 0.15)"
                  : "rgba(42, 42, 42, 0.5)",
              border: `1px solid ${
                i < currentCount
                  ? "rgba(57, 189, 248, 0.3)"
                  : "#2a2a2a"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2
              size={18}
              color={i < currentCount ? "#39BDF8" : "#4a4a48"}
              strokeWidth={1.5}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          backgroundColor: "rgba(57, 189, 248, 0.05)",
          border: "1px solid rgba(57, 189, 248, 0.15)",
          borderRadius: "8px",
          padding: "16px 24px",
          maxWidth: "400px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <Users size={16} color="#39BDF8" />
          <span style={{ color: "#e5e5e5", fontSize: "13px", fontWeight: 600 }}>
            Help grow your market
          </span>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "12px", lineHeight: "1.5" }}>
          Know other hotels in this area? Invite them to Market Pulse — more properties
          means better benchmarking, sharper competitive insights, and stronger pricing
          intelligence for everyone.
        </p>
      </div>
    </div>
  );
}
