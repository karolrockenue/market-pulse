import React from "react";
import { Loader2 } from "lucide-react"; // Animated loader

interface DataPendingBlurProps {
  children: React.ReactNode;
  isPending: boolean;
  message?: string;
  height?: string;
}

export const DataPendingBlur: React.FC<DataPendingBlurProps> = ({
  children,
  isPending,
  message = "Collecting Data...",
  height = "100%",
}) => {
  if (!isPending) return <>{children}</>;

  return (
    <div
      style={{
        position: "relative",
        height: height,
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* The Blurred Content (Low Opacity) */}
      <div
        style={{
          filter: "blur(8px)",
          opacity: 0.3,
          pointerEvents: "none",
          height: "100%",
        }}
      >
        {children}
      </div>

      {/* The Overlay Message */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          backgroundColor: "rgba(0,0,0,0.2)", // Slight tint
        }}
      >
        <div
          style={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            padding: "12px 20px",
            borderRadius: "24px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <Loader2 className="w-4 h-4 text-[#faff6a] animate-spin" />
          <span style={{ fontSize: "12px", color: "#e5e5e5", fontWeight: 500 }}>
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};
