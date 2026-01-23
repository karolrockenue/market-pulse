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
  Home,
  TerminalSquare,
  DollarSign,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
  userInfo: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
}

export function TopNav({
  activeView,
  onViewChange,
  property,
  onPropertyChange,
  properties,
  lastUpdatedAt,
  userInfo,
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
      "sentinel",
      "sentinel-group",
      "riskOverview",
      "rateManager",
      "propertyHub",
      "shadowfax",
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
    { label: "Reports Hub", value: "reports", icon: FileText, isAdmin: false },
    {
      label: "Market Intelligence",
      value: "demand-pace",
      icon: BarChart3,
      isAdmin: false,
    },
    { label: "Settings", value: "settings", icon: Settings, isAdmin: false },
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
        { label: "Property Hub", value: "propertyHub", icon: Home },
        { label: "Shadowfax", value: "shadowfax", icon: Tag },
      ],
    },
    { label: "Admin", value: "admin", icon: Zap, isAdmin: true },
  ];

  const navItems = allNavItems.filter((item) => {
    if ((item as any).isSuperAdminOnly) {
      return userInfo?.role === "super_admin";
    }
    if (item.isAdmin) {
      return userInfo?.role === "super_admin" || userInfo?.role === "admin";
    }
    return true;
  });

  const showPropertySelector = activeView !== "landing";

  // Color Constants
  const BLUE = "#39BDF8";
  const WHITE = "#e5e5e5";
  const GRAY = "#9ca3af";
  const BG_DARK = "#1f1f1c";
  const BORDER_DARK = "#3a3a35";

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
      <div className="flex items-center gap-10">
        {/* LOGO */}
        <div className="flex items-center gap-1">
          <span style={{ color: BLUE, fontSize: "24px" }}>(</span>
          <span
            style={{
              color: WHITE,
              fontSize: "14px",
              letterSpacing: "0.025em",
              position: "relative",
              top: "2px",
            }}
          >
            MARKET PULSE
          </span>
          <span style={{ color: BLUE, fontSize: "24px" }}>)</span>
        </div>

        {/* NAV ITEMS */}
        <nav className="flex gap-6">
          {navItems.map((item) => {
            const Icon = item.icon;
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
                <DropdownMenu key={item.value}>
                  <DropdownMenuTrigger asChild>
                    <button style={buttonStyle}>
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
                      {item.isAdmin && (
                        <Icon
                          className="w-3 h-3"
                          style={{ color: BLUE, marginLeft: "4px" }}
                        />
                      )}
                      <div style={underlineStyle} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-48"
                    align="start"
                    style={{
                      backgroundColor: "#1a1a18",
                      border: `1px solid ${BORDER_DARK}`,
                      color: WHITE,
                    }}
                  >
                    <DropdownMenuGroup>
                      {item.items.map((child: any) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeView === child.value;
                        return (
                          <DropdownMenuItem
                            key={child.value}
                            onSelect={() => handleNavClick(child.value)}
                            style={{
                              backgroundColor: isChildActive
                                ? "#2C2C2C"
                                : "transparent",
                              color: isChildActive ? BLUE : WHITE,
                              cursor: "pointer",
                            }}
                          >
                            <ChildIcon
                              className="w-4 h-4 mr-2"
                              style={{
                                color: isChildActive ? BLUE : "inherit",
                              }}
                            />
                            <span>{child.label}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <button
                key={item.value}
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
            <Select value={property} onValueChange={onPropertyChange}>
              <SelectTrigger
                className="w-56 h-9"
                style={{
                  backgroundColor: "#2C2C2C",
                  borderColor: BORDER_DARK,
                  color: WHITE,
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: "#1a1a18",
                  borderColor: "#2C2C2C",
                  color: WHITE,
                }}
              >
                {properties.length > 1 && (
                  <SelectItem
                    value="ALL"
                    className="font-semibold border-b border-white/10 mb-1"
                  >
                    All Properties (Portfolio)
                  </SelectItem>
                )}
                {properties.map((prop) => (
                  <SelectItem
                    key={prop.property_id}
                    value={prop.property_id.toString()}
                  >
                    {prop.property_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div
              style={{
                height: "24px",
                width: "1px",
                backgroundColor: BORDER_DARK,
              }}
            />
          </>
        )}

        {/* Last Updated Badge */}
        <div
          style={{
            fontSize: "12px",
            color: GRAY,
            backgroundColor: "#2C2C2C",
            padding: "6px 12px",
            borderRadius: "4px",
          }}
        >
          {lastUpdatedAt
            ? `Last updated: ${new Date(lastUpdatedAt).toLocaleString()}`
            : "Loading update time..."}
        </div>

        {/* Sentinel Notification Bell (Admin Only) */}
        {(userInfo?.role === "admin" || userInfo?.role === "super_admin") && (
          <div className="flex items-center gap-1">
            <ActionListBell />
            <NotificationBell />
          </div>
        )}

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
                color: "#1f1f1c",
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
              backgroundColor: "#1a1a18",
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
