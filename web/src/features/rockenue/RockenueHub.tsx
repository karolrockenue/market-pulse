import { useState, lazy, Suspense } from "react";

// Lazy-load all studio/mockup components so editing one doesn't force a full page reload
const RockenueDashboard = lazy(() => import("./components/RockenueDashboard").then(m => ({ default: m.RockenueDashboard })));
const DistributionView = lazy(() => import("./components/DistributionView").then(m => ({ default: m.DistributionView })));
const CrmBoard = lazy(() => import("./components/CrmBoard").then(m => ({ default: m.CrmBoard })));
const ChannelPricingConcept = lazy(() => import("./components/ChannelPricingConcept").then(m => ({ default: m.ChannelPricingConcept })));
const EmailSignatures = lazy(() => import("./components/EmailSignatures").then(m => ({ default: m.EmailSignatures })));
const Canvas = lazy(() => import("./components/Canvas").then(m => ({ default: m.Canvas })));
const MPConcept = lazy(() => import("./components/MPConcept").then(m => ({ default: m.MPConcept })));
const MPConcept2 = lazy(() => import("./components/MPConcept2").then(m => ({ default: m.MPConcept2 })));
const MPDash2 = lazy(() => import("./components/MPDash2").then(m => ({ default: m.MPDash2 })));
const MPDash3 = lazy(() => import("./components/MPDash3").then(m => ({ default: m.MPDash3 })));
const MPDash4 = lazy(() => import("./components/MPDash4").then(m => ({ default: m.MPDash4 })));
const MPReportsHub = lazy(() => import("./components/MPReportsHub").then(m => ({ default: m.MPReportsHub })));
const MPDemandRadar = lazy(() => import("./components/MPDemandRadar").then(m => ({ default: m.MPDemandRadar })));
const MPCompsetIntel = lazy(() => import("./components/MPCompsetIntel").then(m => ({ default: m.MPCompsetIntel })));
const MPCompsetView = lazy(() => import("./components/MPCompsetView").then(m => ({ default: m.MPCompsetView })));
const MPCompsetViewV2 = lazy(() => import("./components/MPCompsetViewV2").then(m => ({ default: m.MPCompsetViewV2 })));
const MPMyRates = lazy(() => import("./components/MPMyRates").then(m => ({ default: m.MPMyRates })));
const MPCrmBoard = lazy(() => import("./components/MPCrmBoard").then(m => ({ default: m.MPCrmBoard })));
const MPRiskOverview = lazy(() => import("./components/MPRiskOverview").then(m => ({ default: m.MPRiskOverview })));
const MPControlPanel = lazy(() => import("./components/MPControlPanel").then(m => ({ default: m.MPControlPanel })));
const MPControlPanelV2 = lazy(() => import("./components/MPControlPanelV2").then(m => ({ default: m.MPControlPanelV2 })));
const MPAdminHub = lazy(() => import("./components/MPAdminHub").then(m => ({ default: m.MPAdminHub })));
const MPChannelPricing = lazy(() => import("./components/MPChannelPricing").then(m => ({ default: m.MPChannelPricing })));
const MPChannelPricingV2 = lazy(() => import("./components/MPChannelPricingV2").then(m => ({ default: m.MPChannelPricingV2 })));
const MPChannelPricingV3 = lazy(() => import("./components/MPChannelPricingV3").then(m => ({ default: m.MPChannelPricingV3 })));
const MPDistribution = lazy(() => import("./components/MPDistribution").then(m => ({ default: m.MPDistribution })));

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
        <Suspense fallback={null}>
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
          {activeView === "mpCompsetViewV2" && <MPCompsetViewV2 activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpMyRates" && <MPMyRates activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpCrmBoard" && <MPCrmBoard activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpRiskOverview" && <MPRiskOverview activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpControlPanel" && <MPControlPanel activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpControlPanelV2" && <MPControlPanelV2 activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpAdminHub" && <MPAdminHub activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpChannelPricing" && <MPChannelPricing activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpChannelPricingV2" && <MPChannelPricingV2 activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpChannelPricingV3" && <MPChannelPricingV3 activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpDistribution" && <MPDistribution activeView={activeView} onNavigate={onNavigate} />}
        </Suspense>
      </div>
    </div>
  );
}
