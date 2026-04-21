import { useState } from "react";
import { Pin, X } from "lucide-react";
import { R } from "../styles/tokens";
import { VIEW_REGISTRY, usePinnedShortcuts } from "./pinnedShortcuts";

interface PinnedPillsProps {
  activeView: string;
  onNavigate: (view: string) => void;
  userKey: string;
}

export function PinnedPills({ activeView, onNavigate, userKey }: PinnedPillsProps) {
  const { pins, unpin } = usePinnedShortcuts(userKey);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);

  if (pins.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: R.gold,
          textTransform: "uppercase",
        }}
      >
        <Pin size={10} style={{ opacity: 0.85 }} />
        Pinned
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {pins.map((view) => {
          const entry = VIEW_REGISTRY[view];
          if (!entry) return null;
          const { label, icon: Icon } = entry;
          const isActive = activeView === view;
          const isHovered = hoveredPin === view;
          return (
            <div
              key={view}
              onMouseEnter={() => setHoveredPin(view)}
              onMouseLeave={() => setHoveredPin(null)}
              style={{ position: "relative", display: "flex", alignItems: "center" }}
            >
              <button
                onClick={() => onNavigate(view)}
                title={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: isHovered ? "6px 26px 6px 11px" : "6px 11px",
                  background: isActive ? `${R.gold}22` : `${R.gold}10`,
                  border: `1px solid ${isActive ? R.gold + "99" : R.gold + "55"}`,
                  borderRadius: 999,
                  color: R.accent,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "padding 0.12s, background 0.12s, border-color 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon size={13} color={R.gold} />
                {label}
              </button>
              {isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unpin(view);
                  }}
                  title="Unpin"
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "none",
                    borderRadius: 999,
                    cursor: "pointer",
                    color: R.textMid,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = R.accent;
                    e.currentTarget.style.background = `${R.gold}33`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = R.textMid;
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
