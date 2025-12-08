import React from 'react';
import { DemandPace } from '../../components/DemandPace';
import { MarketKPIGrid } from '../../components/MarketKPIGrid';
import { MarketHealthKPI } from '../../components/MarketHealthKPI';
import { HistoricalTrendsChart } from '../../components/HistoricalTrendsChart';
import { SupplyDemandChart } from '../../components/SupplyDemandChart';
import { MarketShareDonut } from '../../components/MarketShareDonut';
import { PricingDistribution } from '../../components/PricingDistribution';
import { DemandForecast } from '../../components/DemandForecast';
import { TopPerformers } from '../../components/TopPerformers';
import { QualityTierPerformance } from '../../components/QualityTierPerformance';
import { MarketSeasonality } from '../../components/MarketSeasonality';
import { AreaPerformanceTable } from '../../components/AreaPerformanceTable';

interface MarketIntelHubProps {
  activeView: string;
  propertyId: number | null;
  citySlug?: string;
  currencyCode: string;
}

export const MarketIntelHub = ({ 
  activeView, 
  propertyId, 
  citySlug, 
  currencyCode 
}: MarketIntelHubProps) => {

  if (activeView === 'demand-pace') {
    // Logic extracted from App.tsx:
    // We must wait until property details (id and city) are fetched.
    if (propertyId && citySlug) {
      return (
        <DemandPace
          propertyId={propertyId}
          currencyCode={currencyCode}
          citySlug={citySlug}
        />
      );
    } else {
      // Loading state extracted from App.tsx
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          background: '#232320',
          color: '#e5e5e5',
          padding: '24px'
        }}>
          <div className="w-8 h-8 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl">Loading Property Details...</h2>
          <p className="text-[#9ca3af]">Fetching city and room count for this property.</p>
        </div>
      );
    }
  }

  if (activeView === 'market') {
    // Logic extracted from App.tsx (Market Overview render block)
    return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-white text-xl mb-1">London Market Overview</h1>
          <p className="text-[#9ca3af] text-xs">Macro-level market analytics, trends, and competitive insights</p>
        </div>
        <div className="space-y-4">
          <MarketKPIGrid />
          <div className="grid grid-cols-4 gap-4">
            <MarketHealthKPI status="up" change={12.3} />
            <div className="col-span-3">
              <HistoricalTrendsChart />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <SupplyDemandChart />
            <MarketShareDonut />
            <PricingDistribution />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <DemandForecast />
            </div>
            <TopPerformers />
            <QualityTierPerformance />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MarketSeasonality />
            <AreaPerformanceTable />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MarketIntelHub;