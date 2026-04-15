import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const R = {
  bg: "#0C0E12",
  border: "#1E2330",
  accent: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  blue: "#39BDF8",
  gold: "#C8A66E",
};

const HOTELS = [
  { name: "The W14 Hotel", city: "London" },
  { name: "Jubilee Hotel Victoria", city: "London" },
  { name: "The Melita", city: "London" },
  { name: "Elysee Hyde Park", city: "London" },
  { name: "Camden Suites", city: "London" },
  { name: "Vilenza Hotel", city: "London" },
  { name: "The Whitechapel Hotel", city: "London" },
  { name: "Notting Hill House Hotel", city: "London" },
  { name: "Lancaster Court Hotel", city: "London" },
  { name: "The Portico Hotel", city: "London" },
];

const NAV_ITEMS = [
  { label: "Dashboard", value: "mpDash3" },
  { label: "Reports", value: "mpReportsHub" },
  { label: "Demand & Pace", value: "mpCompsetIntel" },
  { label: "Compset Intel", value: "mpCompsetView" },
  { label: "Demand Radar", value: "mpDemandRadar" },
  { label: "My Rates", value: "mpMyRates" },
  { label: "Control Panel", value: "mpControlPanel" },
  { label: "Risk Overview", value: "mpRiskOverview" },
  { label: "Channel Pricing", value: "mpChannelPricing" },
  { label: "Channel Pricing V2", value: "mpChannelPricingV2" },
  { label: "Distribution", value: "mpDistribution" },
  { label: "CRM", value: "mpCrmBoard" },
];

interface MPSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function MPSidebar({ activeView, onNavigate }: MPSidebarProps) {
  const [selectedHotel, setSelectedHotel] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div style={{ width: 200, background: R.bg, borderRight: `1px solid ${R.border}`, padding: "20px 0", display: "flex", flexDirection: "column", flexShrink: 0, position: "relative" }}>
      {/* Logo */}
      <div style={{ padding: "0 20px 20px", display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: R.blue, fontSize: 18, fontWeight: 200 }}>(</span>
        <span style={{ color: R.accent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>MARKET PULSE</span>
        <span style={{ color: R.blue, fontSize: 18, fontWeight: 200 }}>)</span>
      </div>

      {/* Property Selector */}
      <div style={{ padding: "0 14px 20px", position: "relative" }}>
        <div
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 12px", background: "#111519", border: `1px solid ${dropdownOpen ? R.blue + "40" : R.border}`,
            borderRadius: 8, cursor: "pointer", transition: "border-color 0.15s",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>{HOTELS[selectedHotel].name}</div>
            <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{HOTELS[selectedHotel].city}</div>
          </div>
          <ChevronDown size={14} color={R.textDim} style={{ transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 14, right: 14, zIndex: 50,
            background: "#111519", border: `1px solid ${R.border}`, borderRadius: 8,
            marginTop: 4, maxHeight: 320, overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            {HOTELS.map((hotel, i) => {
              const isSelected = i === selectedHotel;
              return (
                <div
                  key={hotel.name}
                  onClick={() => { setSelectedHotel(i); setDropdownOpen(false); }}
                  style={{
                    padding: "10px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: isSelected ? `${R.blue}08` : "transparent",
                    borderBottom: i < HOTELS.length - 1 ? `1px solid rgba(255,255,255,0.03)` : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: isSelected ? R.accent : R.text, fontWeight: isSelected ? 600 : 400 }}>{hotel.name}</div>
                    <div style={{ fontSize: 10, color: R.textDim, marginTop: 1 }}>{hotel.city}</div>
                  </div>
                  {isSelected && <Check size={12} color={R.blue} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Nav Items */}
      <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 8 }}>
        {NAV_ITEMS.map(item => {
          const isActive = activeView === item.value;
          return (
            <div
              key={item.value}
              onClick={() => onNavigate(item.value)}
              style={{
                padding: "10px 20px", fontSize: 13, cursor: "pointer",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? R.accent : R.textDim,
                background: isActive ? `${R.blue}08` : "transparent",
                borderLeft: isActive ? `2px solid ${R.blue}` : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {item.label}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${R.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: R.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: R.bg }}>KM</div>
        <div>
          <div style={{ fontSize: 12, color: R.accent }}>Karol Marcu</div>
          <div style={{ fontSize: 10, color: R.textDim }}>Managing Director</div>
        </div>
      </div>
    </div>
  );
}
