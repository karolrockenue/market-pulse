import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Trophy,
  DollarSign,
  Zap,
  Shield,
  TerminalSquare,
  Radar,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  Check,
  Building2,
  ClipboardList,
  Globe,
  Palette,
  MonitorSmartphone,
  Presentation,
} from "lucide-react";
import { R } from "../styles/tokens";

interface Property {
  property_id: number;
  property_name: string;
}

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  property: string;
  onPropertyChange: (property: string) => void;
  properties: Property[];
  userInfo: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
  cityName?: string;
  isArchanesOnly?: boolean;
}

export function AppSidebar({
  activeView,
  onViewChange,
  property,
  onPropertyChange,
  properties,
  userInfo,
  cityName,
  isArchanesOnly = false,
}: AppSidebarProps) {
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState("");
  const propertySearchRef = useRef<HTMLInputElement>(null);
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [rockenueOpen, setRockenueOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);

  const isAdmin = userInfo?.role === "super_admin" || userInfo?.role === "admin";

  const getInitials = () => {
    if (!userInfo) return "..";
    return `${(userInfo.firstName || "").charAt(0)}${(userInfo.lastName || "").charAt(0)}`.toUpperCase();
  };

  const selectedPropertyName =
    property === "ALL"
      ? "All Properties"
      : properties.find((p) => p.property_id.toString() === property)?.property_name ?? "Select property";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.reload();
    }
  };

  const handleNav = (view: string) => {
    const singlePropertyViews = [
      "reports", "settings", "hotelRates", "sentinel",
      "sentinel-group", "riskOverview", "rateManager",
      "competitive-intel", "demandRadar",
    ];
    if (property === "ALL" && singlePropertyViews.includes(view)) {
      if (properties.length > 0) {
        onPropertyChange(properties[0].property_id.toString());
        onViewChange(view);
      }
    } else {
      onViewChange(view);
    }
  };

  const navItem = (label: string, value: string, Icon: any, indent = false) => {
    const isActive = activeView === value;
    return (
      <div
        key={value}
        onClick={() => handleNav(value)}
        style={{
          padding: indent ? "8px 20px 8px 36px" : "10px 20px",
          fontSize: indent ? 12 : 13,
          cursor: "pointer",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? R.accent : R.textDim,
          background: isActive ? `${R.warmTeal}08` : "transparent",
          borderLeft: isActive ? `2px solid ${R.warmTeal}` : "2px solid transparent",
          transition: "all 0.15s",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon size={indent ? 13 : 15} style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }} />
        {label}
      </div>
    );
  };

  const sectionToggle = (label: string, Icon: any, open: boolean, setOpen: (v: boolean) => void, activeValues: string[]) => {
    const isActive = activeValues.includes(activeView);
    return (
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 20px",
          fontSize: 13,
          cursor: "pointer",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? R.accent : R.textDim,
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.15s",
          borderLeft: isActive && !open ? `2px solid ${R.warmTeal}` : "2px solid transparent",
          background: isActive && !open ? `${R.warmTeal}08` : "transparent",
        }}
      >
        <Icon size={15} style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{label}</span>
        <ChevronRight size={12} style={{ opacity: 0.4, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
      </div>
    );
  };

  const demandLabel = cityName
    ? `Demand ${cityName.charAt(0).toUpperCase() + cityName.slice(1).replace(/-/g, " ")}`
    : "Demand & Pace";

  return (
    <div
      style={{
        width: 220,
        background: R.sidebar,
        borderRight: `1px solid ${R.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 14px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ color: "#38C6BA", fontSize: 26, fontWeight: 300, lineHeight: 1 }}>(</span>
        <span style={{ color: R.accent, fontSize: 14, fontWeight: 700, letterSpacing: 1.4 }}>MARKET PULSE</span>
        <span style={{ color: "#C8A66E", fontSize: 26, fontWeight: 300, lineHeight: 1 }}>)</span>
      </div>

      {/* Property Selector */}
      <div style={{ padding: "0 14px 16px", position: "relative" }}>
        <div
          onClick={() => { setPropertyDropdownOpen(!propertyDropdownOpen); if (propertyDropdownOpen) setPropertySearch(""); }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: R.heroBg,
            border: `1px solid ${propertyDropdownOpen ? R.warmTeal + "40" : R.border}`,
            borderRadius: 8,
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: R.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selectedPropertyName}
            </div>
          </div>
          <ChevronDown
            size={14}
            color={R.textDim}
            style={{ transform: propertyDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}
          />
        </div>

        {propertyDropdownOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 14,
              right: 14,
              zIndex: 50,
              background: R.heroBg,
              border: `1px solid ${R.border}`,
              borderRadius: 8,
              marginTop: 4,
              maxHeight: 360,
              overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {/* Search input */}
            {properties.length > 5 && (
              <div style={{ padding: "8px 10px", borderBottom: `1px solid ${R.sep}`, position: "sticky", top: 0, background: R.heroBg, zIndex: 1 }}>
                <input
                  ref={propertySearchRef}
                  autoFocus
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setPropertyDropdownOpen(false); setPropertySearch(""); }
                    if (e.key === "Enter") {
                      const filtered = properties.filter((p) => p.property_name.toLowerCase().includes(propertySearch.toLowerCase()));
                      if (filtered.length === 1) { onPropertyChange(filtered[0].property_id.toString()); setPropertyDropdownOpen(false); setPropertySearch(""); }
                    }
                  }}
                  placeholder="Type to search..."
                  style={{
                    width: "100%", padding: "7px 10px", background: R.sidebar, border: `1px solid ${R.border}`,
                    borderRadius: 6, color: R.accent, fontSize: 12, outline: "none",
                  }}
                />
              </div>
            )}
            {(() => {
              const MASON_ID = "MASON_DASHBOARD";
              const realProperties = properties.filter((p) => String(p.property_id) !== MASON_ID);
              const masonEntry = properties.find((p) => String(p.property_id) === MASON_ID);
              const filterMatch = (name: string) =>
                !propertySearch || name.toLowerCase().includes(propertySearch.toLowerCase());
              const filteredReal = realProperties.filter((p) => filterMatch(p.property_name));
              const masonMatches = !!masonEntry && filterMatch(masonEntry.property_name);

              return (
                <>
                  {isAdmin && realProperties.length > 1 && !propertySearch && (
                    <div
                      onClick={() => { onPropertyChange("ALL"); setPropertyDropdownOpen(false); setPropertySearch(""); }}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: property === "ALL" ? `${R.warmTeal}08` : "transparent",
                        borderBottom: `1px solid ${R.sep}`,
                        fontWeight: 600,
                      }}
                    >
                      <div style={{ fontSize: 12, color: R.accent }}>All Properties (Portfolio)</div>
                      {property === "ALL" && <Check size={12} color={R.warmTeal} />}
                    </div>
                  )}

                  {/* Synthetic Mason Dashboard entry — fenced with dividers */}
                  {masonEntry && masonMatches && (
                    <div
                      onClick={() => { onPropertyChange(MASON_ID); setPropertyDropdownOpen(false); setPropertySearch(""); }}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: property === MASON_ID ? `${R.warmTeal}08` : "transparent",
                        borderBottom: `1px solid ${R.sep}`,
                        fontWeight: 600,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            background: R.gold,
                          }}
                        />
                        <div style={{ fontSize: 12, color: property === MASON_ID ? R.accent : R.text }}>
                          {masonEntry.property_name}
                        </div>
                      </div>
                      {property === MASON_ID && <Check size={12} color={R.warmTeal} />}
                    </div>
                  )}

                  {filteredReal.map((p) => {
                    const isSelected = property === p.property_id.toString();
                    return (
                      <div
                        key={p.property_id}
                        onClick={() => { onPropertyChange(p.property_id.toString()); setPropertyDropdownOpen(false); setPropertySearch(""); }}
                        style={{
                          padding: "10px 12px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: isSelected ? `${R.warmTeal}08` : "transparent",
                          borderBottom: `1px solid rgba(255,255,255,0.03)`,
                        }}
                      >
                        <div style={{ fontSize: 12, color: isSelected ? R.accent : R.text, fontWeight: isSelected ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.property_name}
                        </div>
                        {isSelected && <Check size={12} color={R.warmTeal} />}
                      </div>
                    );
                  })}

                  {propertySearch && filteredReal.length === 0 && !masonMatches && (
                    <div style={{ padding: "16px 12px", fontSize: 12, color: R.textDim, textAlign: "center" }}>No properties found</div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 8, flex: 1 }}>
        {isArchanesOnly ? (
          navItem("Investor View", "demand-pace", BarChart3)
        ) : (
          <>
            {navItem("Dashboard", "dashboard", LayoutDashboard)}
            {navItem("Demand Radar", "demandRadar", Radar)}
            {navItem("Compset Intel", "competitive-intel", Trophy)}
            {navItem("Reports", "reports", FileText)}
            {navItem("My Rates", "hotelRates", DollarSign)}

            {isAdmin && (
              <>
                <div style={{ borderTop: `1px solid ${R.border}`, margin: "8px 0" }} />

                {sectionToggle("Sentinel", Zap, sentinelOpen, setSentinelOpen, ["riskOverview", "sentinel", "rateManager", "marketProfile"])}
                {sentinelOpen && (
                  <>
                    {navItem("Risk Overview", "riskOverview", Shield, true)}
                    {navItem("Control Panel", "sentinel", TerminalSquare, true)}
                    {navItem("Rate Manager", "rateManager", DollarSign, true)}
                    {navItem("Market Profile", "marketProfile", BarChart3, true)}
                  </>
                )}

                {sectionToggle("Rockenue", Building2, rockenueOpen, setRockenueOpen, ["crm", "distribution", "channelPricing"])}
                {rockenueOpen && (
                  <>
                    {navItem("CRM", "crm", ClipboardList, true)}
                    {navItem("Distribution", "distribution", Globe, true)}
                    {navItem("Channel Pricing", "channelPricing", DollarSign, true)}
                  </>
                )}

                {navItem("Admin", "admin", Zap)}

                {sectionToggle("Studio", Palette, studioOpen, setStudioOpen, ["mpReportsHub", "mpDemandRadar", "mpRiskOverview", "mpLogin", "masonDashboard", "emailSignatures", "deckV2", "shreejiDeck", "canvas"])}
                {studioOpen && (
                  <>
                    {navItem("MP Reports", "mpReportsHub", MonitorSmartphone, true)}
                    {navItem("MP Demand Radar", "mpDemandRadar", MonitorSmartphone, true)}
                    {navItem("MP Risk Overview", "mpRiskOverview", MonitorSmartphone, true)}
                    {navItem("MP Login", "mpLogin", MonitorSmartphone, true)}
                    {navItem("Mason Dashboard", "masonDashboard", MonitorSmartphone, true)}
                    {navItem("Email Signatures", "emailSignatures", MonitorSmartphone, true)}
                    {navItem("Deck V2", "deckV2", Presentation, true)}
                    {navItem("Shreeji Deck", "shreejiDeck", Presentation, true)}
                    {navItem("Canvas", "canvas", Palette, true)}
                  </>
                )}
              </>
            )}

            <div style={{ borderTop: `1px solid ${R.border}`, margin: "8px 0" }} />
            {navItem("Settings", "settings", Settings)}
          </>
        )}
      </div>

      {/* User + Logout */}
      <div style={{ borderTop: `1px solid ${R.border}`, padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: R.warmTeal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: R.sidebar,
              flexShrink: 0,
            }}
          >
            {getInitials()}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 12, color: R.accent, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : "..."}
            </div>
            <div style={{ fontSize: 10, color: R.textDim }}>{userInfo?.role || ""}</div>
          </div>
        </div>
        <div
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: R.textDim,
            cursor: "pointer",
            padding: "6px 0",
          }}
        >
          <LogOut size={12} />
          Sign Out
        </div>
      </div>
    </div>
  );
}
