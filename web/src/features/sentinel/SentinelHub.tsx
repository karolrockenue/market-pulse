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
// PropertyHub merged into ControlPanel as PromoConfigSection
import { PortfolioRiskOverview } from "./components/RiskOverview/PortfolioRiskOverview";
import { DemandRadarView } from "./components/DemandRadar/DemandRadarView";
import { HealthView } from "./components/Health/HealthView";
import { ArchanesInvestorView } from "../market-intel/components/ArchanesInvestorView";


// Admin Hook logic (simplified here to avoid circular dependency on Admin feature)
// Demand Radar is now open to all users; /api/hotels is admin-only so a non-admin
// gets 403 and the old code would set `hotels` to the error body, causing downstream
// `.map is not a function` crashes inside DemandRadarView's useMemo. Fall back to
// /api/hotels/mine for non-admins, and always land a real array in state.
const useAllHotels = () => {
  const [hotels, setHotels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let res = await fetch("/api/hotels");
        if (!res.ok) res = await fetch("/api/hotels/mine");
        const data = res.ok ? await res.json() : [];
        setHotels(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setHotels([]);
        toast.error("Failed to load hotel list");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { hotels, loading };
};
interface SentinelHubProps {
  activeView: string;
  onNavigate: (view: string) => void;
  selectedProperty?: any;
}

export function SentinelHub({ activeView, onNavigate, selectedProperty }: SentinelHubProps) {
  const { hotels, loading } = useAllHotels();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d1d1c] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#38C6BA] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d1d1c] flex flex-col">
      {/* Content Area - Navigation is now handled by TopNav */}
      <div className="flex-1 relative">
        {activeView === "rateManager" && <RateManagerView allHotels={hotels} />}
        {activeView === "sentinel" && <ControlPanelView allHotels={hotels} />}
        {activeView === "sentinelHealth" && <HealthView />}

        {activeView === "riskOverview" && <PortfolioRiskOverview />}
        {activeView === "demandRadar" && (
          selectedProperty?.city?.toLowerCase() === "archanes"
            ? <ArchanesInvestorView citySlug="archanes" currencySymbol="€" />
            : <DemandRadarView allHotels={hotels} selectedProperty={selectedProperty} />
        )}

      </div>
    </div>
  );
}
