import { useState as useStateProp } from "react";
import {
  BarChart3,
  LayoutDashboard,
  FileText,
  Settings,
  Shield,
  LifeBuoy,
  LogOut,
  Zap,
  ChevronDown,
  Tag,
  TerminalSquare,
  DollarSign,
  Trophy,
  Presentation,
  Globe,
  Building2,
  ClipboardList,
  Radar,
  MonitorSmartphone,
  Palette,
  Check,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "./ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { NotificationBell } from "./NotificationBell";
import { ActionListBell } from "./ActionListBell";

interface Property {
  property_id: number;
  property_name: string;
}
interface TopNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  property: string;
  onPropertyChange: (property: string) => void;
  properties: Property[];
  lastUpdatedAt: string | null;
  cityName?: string;
  userInfo: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
  // When true, hide every nav item except the Investor View entry and
  // relabel it. Used for restricted Archanes-only users.
  isArchanesOnly?: boolean;
}

const BORDER_CLR = "#2a2a2a";

function PropertyCombobox({
  property,
  onPropertyChange,
  properties,
}: {
  property: string;
  onPropertyChange: (value: string) => void;
  properties: Property[];
}) {
  const [open, setOpen] = useStateProp(false);

  const selectedLabel =
    property === "ALL"
      ? "All Properties (Portfolio)"
      : properties.find((p) => p.property_id.toString() === property)?.property_name ?? "Select property";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          style={{
            width: 268,
            height: 36,
            backgroundColor: "#2C2C2C",
            border: `1px solid ${BORDER_CLR}`,
            borderRadius: 6,
            color: "#e5e5e5",
            paddingLeft: 12,
            paddingRight: 12,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedLabel}
          </span>
          <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        style={{
          width: 268,
          padding: 0,
          backgroundColor: "#1a1a1a",
          borderColor: BORDER_CLR,
        }}
      >
        <Command
          style={{ backgroundColor: "transparent" }}
          filter={(value, search) => {
            if (value === "all") {
              return "all properties portfolio".includes(search.toLowerCase()) ? 1 : 0;
            }
            const prop = properties.find((p) => p.property_id.toString() === value);
            return prop?.property_name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Search hotels..."
            style={{ color: "#e5e5e5", fontSize: 13 }}
          />
          <CommandList>
            <CommandEmpty style={{ color: "#6b7280" }}>No hotel found.</CommandEmpty>
            {properties.length > 1 && (
              <CommandItem
                value="all"
                onSelect={() => { onPropertyChange("ALL"); setOpen(false); }}
                style={{
                  color: "#e5e5e5",
                  fontWeight: 600,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  marginBottom: 2,
                }}
              >
                <Check size={14} style={{ opacity: property === "ALL" ? 1 : 0, marginRight: 6 }} />
                All Properties (Portfolio)
              </CommandItem>
            )}
            {properties.map((prop) => (
              <CommandItem
                key={prop.property_id}
                value={prop.property_id.toString()}
                onSelect={(val) => { onPropertyChange(val); setOpen(false); }}
                style={{ color: "#e5e5e5", borderRadius: 4 }}
              >
                <Check
                  size={14}
                  style={{
                    opacity: property === prop.property_id.toString() ? 1 : 0,
                    marginRight: 6,
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {prop.property_name}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TopNav({
  activeView,
  onViewChange,
  property,
  onPropertyChange,
  properties,
  lastUpdatedAt,
  cityName,
  userInfo,
  isArchanesOnly = false,
}: TopNavProps) {
  const getInitials = () => {
    if (userInfo) {
      const firstInitial = userInfo.firstName
        ? userInfo.firstName.charAt(0)
        : "";
      const lastInitial = userInfo.lastName ? userInfo.lastName.charAt(0) : "";
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    return "...";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      window.location.reload();
    }
  };

  const handleNavClick = (view: string) => {
    const singlePropertyViews = [
      "reports",
      "demand-pace",
      "settings",
      "hotelRates",
      "sentinel",
      "sentinel-group",
      "riskOverview",
      "rateManager",
      "competitive-intel",
      "demandRadar",
    ];

    if (property === "ALL" && singlePropertyViews.includes(view)) {
      if (properties.length > 0) {
        const firstPropId = properties[0].property_id.toString();
        onPropertyChange(firstPropId);
        onViewChange(view);
      } else {
        console.warn("Cannot switch view: No properties available.");
      }
    } else {
      onViewChange(view);
    }
  };

  const allNavItems = [
    {
      label: "Dashboard",
      value: "dashboard",
      icon: LayoutDashboard,
      isAdmin: false,
    },
    {
      label: cityName ? `Demand ${cityName.charAt(0).toUpperCase() + cityName.slice(1).replace(/-/g, " ")}` : "Demand",
      value: "demand-pace",
      icon: BarChart3,
      isAdmin: false,
    },
    {
      label: "Compset Intel",
      value: "competitive-intel",
      icon: Trophy,
      isAdmin: false,
    },
    { label: "Reports", value: "reports", icon: FileText, isAdmin: false },
    { label: "My Rates", value: "hotelRates", icon: DollarSign, isAdmin: false },
    {
      label: "Sentinel",
      value: "sentinel-group",
      icon: Zap,
      isDropdown: true,
      isAdmin: true,
      items: [
        { label: "Risk Overview", value: "riskOverview", icon: Shield },
        { label: "Control Panel", value: "sentinel", icon: TerminalSquare },
        { label: "Rate Manager", value: "rateManager", icon: DollarSign },

        { label: "Demand Radar", value: "demandRadar", icon: Radar },
        { label: "Market Profile", value: "marketProfile", icon: BarChart3 },
      ],
    },
    {
      label: "Rockenue",
      value: "rockenue-group",
      icon: Building2,
      isDropdown: true,
      isAdmin: true,
      items: [
        { label: "CRM", value: "crm", icon: ClipboardList },
        { label: "Distribution", value: "distribution", icon: Globe },
        { label: "Channel Pricing", value: "channelPricing", icon: DollarSign },
      ],
    },
    { label: "Admin", value: "admin", icon: Zap, isAdmin: true },
    {
      label: "Studio",
      value: "studio-group",
      icon: Palette,
      isDropdown: true,
      isAdmin: true,
      items: [
        { label: "MP Dashboard", value: "mpDash3", icon: MonitorSmartphone, sectionLabel: "Market Pulse" },
        { label: "MP Reports Hub", value: "mpReportsHub", icon: MonitorSmartphone },
        { label: "MP Demand Radar", value: "mpDemandRadar", icon: MonitorSmartphone },
        { label: "MP Demand & Pace", value: "mpCompsetIntel", icon: MonitorSmartphone },
        { label: "MP Compset Intel", value: "mpCompsetView", icon: MonitorSmartphone },
        { label: "MP My Rates", value: "mpMyRates", icon: MonitorSmartphone },
        { label: "MP CRM", value: "mpCrmBoard", icon: MonitorSmartphone },
        { label: "MP Risk Overview", value: "mpRiskOverview", icon: MonitorSmartphone },
        { label: "MP Control Panel", value: "mpControlPanel", icon: MonitorSmartphone },
        { label: "Email Signatures", value: "emailSignatures", icon: MonitorSmartphone },
        { label: "Deck V2", value: "deckV2", icon: Presentation, sectionLabel: "Drafts" },
        { label: "Shreeji Deck", value: "shreejiDeck", icon: Presentation },
        { label: "Canvas", value: "canvas", icon: Palette },
      ],
    },
  ];

  // Archanes-only users see exactly one item: "Investor View" → demand-pace.
  const navItems = isArchanesOnly
    ? allNavItems
        .filter((item: any) => item.value === "demand-pace")
        .map((item: any) => ({ ...item, label: "Investor View", icon: BarChart3 }))
    : allNavItems.filter((item: any) => {
        if (item.isSuperAdminOnly) {
          return userInfo?.role === "super_admin";
        }
        if (item.isAdmin) {
          return userInfo?.role === "super_admin" || userInfo?.role === "admin";
        }
        return true;
      });

  const showPropertySelector = activeView !== "landing";

  // Color Constants
  const BLUE = "#38C6BA";
  const WHITE = "#e5e5e5";
  const GRAY = "#9ca3af";
  const BG_DARK = "#1d1d1c";
  const BORDER_DARK = "#2a2a2a";

  return (
    <div
      style={{
        backgroundColor: BG_DARK,
        borderBottom: `1px solid ${BORDER_DARK}`,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        position: "relative",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px", minWidth: 0, flex: 1 }}>
        {/* LOGO */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          <span style={{ color: BLUE, fontSize: "24px" }}>(</span>
          <span
            style={{
              color: WHITE,
              fontSize: "14px",
              letterSpacing: "0.025em",
              position: "relative",
              top: "2px",
              whiteSpace: "nowrap",
            }}
          >
            MARKET PULSE
          </span>
          <span style={{ color: BLUE, fontSize: "24px" }}>)</span>
        </div>

        {/* NAV ITEMS */}
        <nav className="topnav-scroll" style={{ display: "flex", gap: "0", flexWrap: "nowrap", overflowX: "auto", minWidth: 0, alignItems: "center" }}>
          {navItems.map((item: any, idx: number) => {
            const Icon = item.icon;
            const separator = idx > 0 ? (
              <div
                key={`sep-${idx}`}
                style={{
                  width: "1px",
                  height: "14px",
                  backgroundColor: BORDER_DARK,
                  flexShrink: 0,
                  margin: "0 12px",
                  opacity: 0.6,
                }}
              />
            ) : null;
            const isActive =
              activeView === item.value ||
              (item.items &&
                item.items.some((child: any) => child.value === activeView));

            // Dynamic Styles
            const buttonStyle = {
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 4px 8px 4px",
              fontSize: "14px",
              transition: "colors 0.2s",
              position: "relative" as const,
              whiteSpace: "nowrap" as const,
              flexShrink: 0,
              outline: "none",
              border: "none",
              background: "none",
              color: item.isAdmin
                ? BLUE // Admin items always Blue text
                : isActive
                  ? WHITE // Active standard items White text
                  : GRAY, // Inactive standard items Gray text
            };

            const underlineStyle = {
              position: "absolute" as const,
              bottom: 0,
              left: 0,
              right: 0,
              height: "2px",
              backgroundColor: BLUE, // Always Blue underline when active
              display: isActive ? "block" : "none",
            };

            if (item.isDropdown && item.items) {
              return (
                <span key={item.value} style={{ display: "contents" }}>
                {separator}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0" style={buttonStyle}>
                      <span>{item.label}</span>
                      <ChevronDown
                        className="w-3 h-3 transition-transform"
                        style={{
                          color: isActive
                            ? item.isAdmin
                              ? BLUE
                              : WHITE
                            : GRAY,
                        }}
                      />
                      <div style={underlineStyle} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-52"
                    align="start"
                    style={{
                      backgroundColor: "#1a1a1a",
                      border: `1px solid ${BORDER_DARK}`,
                      color: WHITE,
                      padding: "4px",
                      maxHeight: "70vh",
                      overflowY: "auto",
                    }}
                  >
                    <DropdownMenuLabel
                      className="px-2 py-1.5"
                      style={{ color: GRAY, fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "-0.025em" }}
                    >
                      {item.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator style={{ backgroundColor: BORDER_DARK }} />
                    <DropdownMenuGroup>
                      {item.items.map((child: any) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeView === child.value;
                        return (<>
                          {child.sectionLabel && (
                            <>
                              <DropdownMenuSeparator style={{ backgroundColor: BORDER_DARK }} />
                              <DropdownMenuLabel
                                className="px-2 py-1"
                                style={{ color: GRAY, fontSize: "10px", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}
                              >
                                {child.sectionLabel}
                              </DropdownMenuLabel>
                            </>
                          )}
                          <DropdownMenuItem
                            key={child.value}
                            onSelect={() => handleNavClick(child.value)}
                            style={{
                              backgroundColor: isChildActive
                                ? "rgba(57, 189, 248, 0.15)"
                                : "transparent",
                              color: isChildActive ? BLUE : WHITE,
                              cursor: "pointer",
                              borderRadius: "4px",
                              padding: "8px 8px",
                              margin: "2px 0",
                            }}
                          >
                            <ChildIcon
                              className="w-4 h-4 mr-2"
                              style={{
                                color: isChildActive ? BLUE : GRAY,
                              }}
                            />
                            <span style={{ fontSize: "13px" }}>{child.label}</span>
                          </DropdownMenuItem>
                        </>);
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                </span>
              );
            }

            return (
              <span key={item.value} style={{ display: "contents" }}>
                {separator}
                <button
                  onClick={() => handleNavClick(item.value)}
                  style={buttonStyle}
                >
                  <span>{item.label}</span>
                {item.isAdmin && (
                  <Icon
                    className="w-3 h-3"
                    style={{ color: BLUE, marginLeft: "4px" }}
                  />
                )}
                <div style={underlineStyle} />
              </button>
              </span>
            );
          })}
        </nav>
      </div>

      {/* RIGHT SIDE ACTIONS */}
      <div className="flex items-center gap-4">
        {showPropertySelector && (
          <>
            <div
              style={{ fontSize: "12px", color: "#6b7280", marginRight: "4px" }}
            >
              Property:
            </div>
            <PropertyCombobox
              property={property}
              onPropertyChange={onPropertyChange}
              properties={properties}
            />
            <div
              style={{
                height: "24px",
                width: "1px",
                backgroundColor: BORDER_DARK,
              }}
            />
          </>
        )}

        {/* Live indicator — styled tooltip on hover */}
        {(() => {
          const isStale = lastUpdatedAt && (Date.now() - new Date(lastUpdatedAt).getTime()) > 25 * 60 * 60 * 1000;
          const dotColor = !lastUpdatedAt ? GRAY : isStale ? "#f59e0b" : "#22c55e";
          const glowColor = isStale ? "rgba(245,158,11,0.5)" : "rgba(34,197,94,0.5)";
          const tipText = lastUpdatedAt
            ? `${new Date(lastUpdatedAt).toLocaleString()}${isStale ? " — stale" : ""}`
            : "Loading...";
          return (
            <div className="topnav-live-wrap" style={{ position: "relative", display: "flex", alignItems: "center", cursor: "default" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: dotColor,
                boxShadow: lastUpdatedAt ? `0 0 6px ${glowColor}` : "none",
                animation: lastUpdatedAt ? "pulse-live 2s ease-in-out infinite" : "none",
              }} />
              <div className="topnav-live-tip" style={{
                position: "absolute", top: "calc(100% + 8px)", right: "-8px",
                backgroundColor: "#1a1a1a", border: `1px solid ${BORDER_DARK}`, borderRadius: "6px",
                padding: "6px 10px", whiteSpace: "nowrap", fontSize: "11px", color: WHITE,
                opacity: 0, pointerEvents: "none", transition: "opacity 0.15s",
                zIndex: 100,
              }}>
                {tipText}
              </div>
              <style>{`
                @keyframes pulse-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                .topnav-live-wrap:hover .topnav-live-tip { opacity: 1 !important; }
              `}</style>
            </div>
          );
        })()}

        {/* Sentinel Notification Bell (Admin Only) */}
        {(userInfo?.role === "admin" || userInfo?.role === "super_admin") && (
          <div className="flex items-center gap-1">
            <ActionListBell />
            <NotificationBell />
          </div>
        )}

        {/* Settings cog */}
        <button
          onClick={() => onViewChange("settings")}
          title="Settings"
          className="topnav-cog"
          style={{
            width: "36px", height: "36px", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: activeView === "settings" ? "rgba(57,189,248,0.15)" : "transparent",
            border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <Settings className="w-5 h-5" style={{ color: activeView === "settings" ? BLUE : GRAY }} />
          <style>{`.topnav-cog:hover { background-color: rgba(57,189,248,0.1) !important; } .topnav-cog:hover svg { color: ${WHITE} !important; }`}</style>
        </button>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9999px",
                backgroundColor: BLUE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1d1d1c",
                fontSize: "12px",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
              }}
            >
              {getInitials()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            style={{
              width: "224px",
              backgroundColor: "#1a1a1a",
              borderColor: BORDER_DARK,
              color: WHITE,
            }}
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal px-2 py-1.5">
              <div className="text-sm font-medium truncate">
                {userInfo
                  ? `${userInfo.firstName} ${userInfo.lastName}`
                  : "Loading..."}
              </div>
              <div className="text-xs text-[#9ca3af] truncate">
                {userInfo ? userInfo.email : "..."}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator style={{ backgroundColor: BORDER_DARK }} />

            <DropdownMenuItem
              style={{ cursor: "pointer" }}
              onSelect={() => onViewChange("support")}
            >
              <LifeBuoy className="w-4 h-4 mr-2" />
              <span>Support</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              style={{ cursor: "pointer" }}
              onSelect={() => onViewChange("privacy")}
            >
              <Shield className="w-4 h-4 mr-2" />
              <span>Privacy Policy</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              style={{ cursor: "pointer" }}
              onSelect={() => onViewChange("terms")}
            >
              <FileText className="w-4 h-4 mr-2" />
              <span>Terms of Service</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: BORDER_DARK }} />
            <DropdownMenuItem
              style={{ cursor: "pointer", color: "#ef4444" }}
              onSelect={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
