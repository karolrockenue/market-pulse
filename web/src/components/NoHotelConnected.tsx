import { Lock, ArrowRight } from "lucide-react";

interface NoHotelConnectedProps {
  onBackToInvestor: () => void;
}

export function NoHotelConnected({ onBackToInvestor }: NoHotelConnectedProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 80px)",
        padding: "48px 24px",
        textAlign: "center",
        background: "#1a1a1a",
      }}
    >
      <div
        style={{
          width: "88px",
          height: "88px",
          borderRadius: "20px",
          backgroundColor: "rgba(57, 189, 248, 0.08)",
          border: "1px solid rgba(57, 189, 248, 0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "28px",
        }}
      >
        <Lock size={36} color="#39BDF8" strokeWidth={1.5} />
      </div>

      <h2
        style={{
          color: "#e5e5e5",
          fontSize: "22px",
          fontWeight: 600,
          marginBottom: "10px",
          letterSpacing: "-0.01em",
        }}
      >
        No hotel connected
      </h2>

      <p
        style={{
          color: "#9ca3af",
          fontSize: "14px",
          maxWidth: "480px",
          lineHeight: "1.7",
          marginBottom: "8px",
        }}
      >
        Your account doesn't have a hotel connected to Market Pulse, so this
        section is unavailable.
      </p>
      <p
        style={{
          color: "#6b7280",
          fontSize: "13px",
          maxWidth: "480px",
          lineHeight: "1.7",
          marginBottom: "32px",
        }}
      >
        You currently have access to the Archanes Investor View only. To
        unlock the full platform — dashboards, reports, market intelligence,
        and Sentinel pricing — connect a property with your administrator.
      </p>

      <button
        onClick={onBackToInvestor}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 22px",
          borderRadius: "8px",
          background: "#39BDF8",
          color: "#0a0a0a",
          fontSize: "13px",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(57, 189, 248, 0.25)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
        }}
      >
        Back to Investor View
        <ArrowRight size={14} />
      </button>

      <div
        style={{
          marginTop: "40px",
          paddingTop: "24px",
          borderTop: "1px solid #2a2a2a",
          width: "100%",
          maxWidth: "480px",
          color: "#6b7280",
          fontSize: "11px",
          lineHeight: 1.6,
        }}
      >
        Need full access? Contact the administrator who invited you, or
        reach{" "}
        <a
          href="mailto:hello@market-pulse.io"
          style={{ color: "#39BDF8", textDecoration: "none" }}
        >
          hello@market-pulse.io
        </a>
        .
      </div>
    </div>
  );
}

export default NoHotelConnected;
