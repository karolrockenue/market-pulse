import { Search, Bell } from "lucide-react";
import { R } from "../styles/tokens";
import { NotificationBell } from "./NotificationBell";

interface AppTopBarProps {
  activeView: string;
  propertyName: string;
  userRole?: string;
}

const viewTitles: Record<string, string> = {
  dashboard: "Dashboard",
  reports: "Reports",
  "demand-pace": "Demand & Pace",
  "competitive-intel": "Compset Intel",
  hotelRates: "My Rates",
  sentinel: "Control Panel",
  riskOverview: "Risk Overview",
  rateManager: "Rate Manager",

  demandRadar: "Demand Radar",
  marketProfile: "Market Profile",
  settings: "Settings",
  admin: "Admin",
  rockenue: "Rockenue",
  crm: "CRM",
  distribution: "Distribution",
  channelPricing: "Channel Pricing",
  support: "Support",
};

export function AppTopBar({ activeView, propertyName, userRole }: AppTopBarProps) {
  const title = viewTitles[activeView] || "Dashboard";
  const isAdmin = userRole === "super_admin" || userRole === "admin";

  return (
    <div
      style={{
        padding: "14px 28px",
        borderBottom: `1px solid ${R.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: R.darkBand,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>{title}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, color: R.accent }}>{propertyName}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: R.green, boxShadow: `0 0 6px ${R.green}50` }} />
        {isAdmin && <NotificationBell />}
      </div>
    </div>
  );
}
