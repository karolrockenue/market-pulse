import { useState } from "react";
import { RockenueDashboard } from "./components/RockenueDashboard";
import { DistributionView } from "./components/DistributionView";
import { CrmBoard } from "./components/CrmBoard";
import { ChannelPricingConcept } from "./components/ChannelPricingConcept";
import { EmailSignatures } from "./components/EmailSignatures";
import { Canvas } from "./components/Canvas";
import { MPConcept } from "./components/MPConcept";
import { MPConcept2 } from "./components/MPConcept2";
import { MPDash2 } from "./components/MPDash2";
import { MPDash3 } from "./components/MPDash3";
import { MPDash4 } from "./components/MPDash4";
import { MPReportsHub } from "./components/MPReportsHub";
import { MPDemandRadar } from "./components/MPDemandRadar";
import { MPCompsetIntel } from "./components/MPCompsetIntel";
import { MPCompsetView } from "./components/MPCompsetView";
import { MPMyRates } from "./components/MPMyRates";
import { MPCrmBoard } from "./components/MPCrmBoard";
import { MPRiskOverview } from "./components/MPRiskOverview";
import { MPControlPanel } from "./components/MPControlPanel";

interface RockenueHubProps {
  activeView: string;
  onNavigate: (view: string) => void;
  userName: string;
}

export function RockenueHub({ activeView, onNavigate, userName }: RockenueHubProps) {
  // Pipeline filter: when clicking a grid cell in Distribution, navigate to CRM with filters
  const [pipelineFilter, setPipelineFilter] = useState<{ hotel_id?: number; channel_id?: number } | null>(null);

  const handlePipelineNavigate = (hotelId: number, channelId: number) => {
    setPipelineFilter({ hotel_id: hotelId, channel_id: channelId });
    onNavigate("crm");
  };

  const handleClearPipelineFilter = () => {
    setPipelineFilter(null);
  };

  return (
    <div className="min-h-screen bg-[#1d1d1c] flex flex-col">
      <div className="flex-1 relative">
        {activeView === "rockenueDashboard" && <RockenueDashboard />}
        {activeView === "distribution" && (
          <DistributionView onPipelineNavigate={handlePipelineNavigate} />
        )}
        {activeView === "crm" && (
          <CrmBoard
            initialFilter={pipelineFilter}
            onClearFilter={handleClearPipelineFilter}
            userName={userName}
          />
        )}
        {activeView === "channelPricing" && <ChannelPricingConcept />}
        {activeView === "emailSignatures" && <EmailSignatures />}
        {activeView === "canvas" && <Canvas />}
        {activeView === "mpConcept" && <MPConcept />}
        {activeView === "mpConcept2" && <MPConcept2 />}
        {activeView === "mpDash2" && <MPDash2 />}
        {activeView === "mpDash3" && <MPDash3 activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpDash4" && <MPDash4 />}
        {activeView === "mpReportsHub" && <MPReportsHub activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpDemandRadar" && <MPDemandRadar activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpCompsetIntel" && <MPCompsetIntel activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpCompsetView" && <MPCompsetView activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpMyRates" && <MPMyRates activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpCrmBoard" && <MPCrmBoard activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpRiskOverview" && <MPRiskOverview activeView={activeView} onNavigate={onNavigate} />}
        {activeView === "mpControlPanel" && <MPControlPanel activeView={activeView} onNavigate={onNavigate} />}
      </div>
    </div>
  );
}
