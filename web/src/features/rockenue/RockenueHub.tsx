import { useState } from "react";
import { Loader2 } from "lucide-react";
import { RockenueDashboard } from "./components/RockenueDashboard";
import { DistributionView } from "./components/DistributionView";
import { CrmBoard } from "./components/CrmBoard";
import { ChannelPricingConcept } from "./components/ChannelPricingConcept";

interface RockenueHubProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function RockenueHub({ activeView, onNavigate }: RockenueHubProps) {
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
          />
        )}
        {activeView === "channelPricing" && <ChannelPricingConcept />}
      </div>
    </div>
  );
}
