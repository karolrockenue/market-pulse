import { useState, lazy, Suspense } from "react";

// Lazy-load all studio/mockup components so editing one doesn't force a full page reload
const RockenueDashboard = lazy(() => import("./components/RockenueDashboard").then(m => ({ default: m.RockenueDashboard })));
const DistributionView = lazy(() => import("./components/DistributionView").then(m => ({ default: m.DistributionView })));
const CrmBoard = lazy(() => import("./components/CrmBoard").then(m => ({ default: m.CrmBoard })));
// Channel Pricing page — MPChannels is the current implementation (row-based
// Programs editor + smart add-channel flow). ChannelPricingConcept.tsx is the
// previous horizontal-waterfall version kept on disk for easy rollback.
const ChannelPricing = lazy(() => import("./components/MPChannels").then(m => ({ default: m.MPChannels })));
const EmailSignatures = lazy(() => import("./components/EmailSignatures").then(m => ({ default: m.EmailSignatures })));
const Canvas = lazy(() => import("./components/Canvas").then(m => ({ default: m.Canvas })));
const MPReportsHub = lazy(() => import("./components/MPReportsHub").then(m => ({ default: m.MPReportsHub })));
const MPDemandRadar = lazy(() => import("./components/MPDemandRadar").then(m => ({ default: m.MPDemandRadar })));
const MPRiskOverview = lazy(() => import("./components/MPRiskOverview").then(m => ({ default: m.MPRiskOverview })));
const MPLogin = lazy(() => import("./components/MPLogin").then(m => ({ default: m.MPLogin })));
const MPDashboardMockup = lazy(() => import("./components/MPDashboardMockup").then(m => ({ default: m.MPDashboardMockup })));
const MasonDashboard = lazy(() => import("./components/MasonDashboard").then(m => ({ default: m.MasonDashboard })));
const MasonStlyMockup = lazy(() => import("./components/MasonStlyMockup").then(m => ({ default: m.MasonStlyMockup })));
const MasonSalesFlash = lazy(() => import("./components/MasonSalesFlash").then(m => ({ default: m.MasonSalesFlash })));
const MasonPacingFlash = lazy(() => import("./components/MasonPacingFlash").then(m => ({ default: m.MasonPacingFlash })));
const MasonGOPCalculator = lazy(() => import("./components/MasonGOPCalculator").then(m => ({ default: m.MasonGOPCalculator })));
const ReportsLab = lazy(() => import("./components/ReportsLab").then(m => ({ default: m.ReportsLab })));
const TopNavPillsMockup = lazy(() => import("./components/TopNavPillsMockup").then(m => ({ default: m.TopNavPillsMockup })));
const SalesCrmMockup = lazy(() => import("./components/SalesCrmMockup").then(m => ({ default: m.SalesCrmMockup })));
const SalesHub = lazy(() => import("./components/SalesCrmMockup").then(m => ({ default: m.SalesHub })));
const IcelandDashboard = lazy(() => import("./components/IcelandDashboard").then(m => ({ default: m.IcelandDashboard })));
const ShreejiDashboard = lazy(() => import("./components/ShreejiDashboard").then(m => ({ default: m.ShreejiDashboard })));

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
          {activeView === "channelPricing" && <ChannelPricing />}
          {activeView === "emailSignatures" && <EmailSignatures />}
          {activeView === "canvas" && <Canvas />}
          {activeView === "mpReportsHub" && <MPReportsHub activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpDemandRadar" && <MPDemandRadar activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpRiskOverview" && <MPRiskOverview activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpLogin" && <MPLogin activeView={activeView} onNavigate={onNavigate} />}
          {activeView === "mpDashboard" && <MPDashboardMockup />}
          {activeView === "masonDashboard" && <MasonDashboard />}
          {activeView === "masonStlyMockup" && <MasonStlyMockup />}
          {activeView === "masonSalesFlash" && <MasonSalesFlash />}
          {activeView === "masonPacingFlash" && <MasonPacingFlash />}
          {activeView === "masonGOPCalculator" && <MasonGOPCalculator />}
          {activeView === "reportsLab" && <ReportsLab />}
          {activeView === "topnavPills" && <TopNavPillsMockup />}
          {activeView === "salesCrmMockup" && <SalesCrmMockup />}
          {activeView === "sales" && <SalesHub />}
          {activeView === "iceland" && <IcelandDashboard />}
          {activeView === "shreejiDashboard" && <ShreejiDashboard />}
        </Suspense>
      </div>
    </div>
  );
}
