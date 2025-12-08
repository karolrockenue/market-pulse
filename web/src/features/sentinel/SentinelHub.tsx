import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Zap,
  Wind,
  Settings,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Components
import { ControlPanelView } from "./components/ControlPanel/ControlPanelView";
import { RateManagerView } from "./components/RateManager/RateManagerView";
import { ShadowfaxView } from "./components/Shadowfax/ShadowfaxView";
import { PropertyHubView } from "./components/PropertyHub/PropertyHubView";
import { PortfolioRiskOverview } from "./components/RiskOverview/PortfolioRiskOverview";

// Admin Hook logic (simplified here to avoid circular dependency on Admin feature)
const useAllHotels = () => {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hotels")
      .then((res) => res.json())
      .then((data) => setHotels(data))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load hotel list");
      })
      .finally(() => setLoading(false));
  }, []);

  return { hotels, loading };
};
interface SentinelHubProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function SentinelHub({ activeView, onNavigate }: SentinelHubProps) {
  const { hotels, loading } = useAllHotels();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d1d1c] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#39BDF8] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d1d1c] flex flex-col">
      {/* Content Area - Navigation is now handled by TopNav */}
      <div className="flex-1 relative">
        {activeView === "rateManager" && <RateManagerView allHotels={hotels} />}
        {activeView === "sentinel" && <ControlPanelView allHotels={hotels} />}
        {activeView === "shadowfax" && <ShadowfaxView />}
        {activeView === "propertyHub" && (
          <PropertyHubView onNavigate={onNavigate} />
        )}
        {activeView === "riskOverview" && <PortfolioRiskOverview />}
      </div>
    </div>
  );
}
