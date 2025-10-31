// This one line correctly imports all the necessary hooks from React.
import { useState, useMemo, useEffect, useRef } from 'react';

import { TopNav } from './components/TopNav';
import { KPICard } from './components/KPICard';
import { DashboardControls } from './components/DashboardControls';
import { PerformanceChart } from './components/PerformanceChart';
import { DataTable } from './components/DataTable';
// Import the new, alternative Market Composition Card component.
// Import the new, alternative Market Composition Card component and its data types.
import { 
  MarketCompositionCardAlt as MarketCompositionCard,
  type MarketCompositionData, // [FIX] Import the correct type
  type CategoryBreakdown      // [FIX] Import the nested type
} from './components/MarketCompositionCardAlt';
import { MarketRankingCard } from './components/MarketRankingCard';
import { InsightsCard } from './components/InsightsCard';
import { MiniMetricCard } from './components/MiniMetricCard';
import { ReportControls } from './components/ReportControls';
import { MetricSelector } from './components/MetricSelector';
import { FormattingOptions } from './components/FormattingOptions';
import { ReportActions } from './components/ReportActions';
import { ReportTable } from './components/ReportTable';
import { ReportSelector } from './components/ReportSelector'; // Import the new component
import { YearOnYearReport } from './components/YearOnYearReport'; // [NEW] Import the new report
import { CreateScheduleModal } from './components/CreateScheduleModal';
import { ManageSchedulesModal } from './components/ManageSchedulesModal';
import { SystemHealth } from './components/SystemHealth';
import { ManualReportTrigger } from './components/ManualReportTrigger';
import { HotelManagementTable } from './components/HotelManagementTable';
import { MewsOnboarding } from './components/MewsOnboarding';
// App.tsx
import { CloudbedsAPIExplorer } from './components/CloudbedsAPIExplorer';
import { ManageCompSetModal } from './components/ManageCompSetModal';
// [NEW] Import the main SettingsPage component
import { SettingsPage } from './components/SettingsPage'; 
// [REMOVED] The imports for MyProfile, UserManagement, and ConnectedProperties are no longer needed here
import { InviteUserModal } from './components/InviteUserModal';
import { GrantAccessModal } from './components/GrantAccessModal';
import { MarketHealthKPI } from './components/MarketHealthKPI';
import { HistoricalTrendsChart } from './components/HistoricalTrendsChart';
import { MarketSeasonality } from './components/MarketSeasonality';
import { AreaPerformanceTable } from './components/AreaPerformanceTable';
import { QualityTierPerformance } from './components/QualityTierPerformance';
import { DemandForecast } from './components/DemandForecast';
import { TopPerformers } from './components/TopPerformers';
import { MarketKPIGrid } from './components/MarketKPIGrid';
import { SupplyDemandChart } from './components/SupplyDemandChart';
import { MarketShareDonut } from './components/MarketShareDonut';
import { PricingDistribution } from './components/PricingDistribution';
import { InitialSyncScreen } from './components/InitialSyncScreen';
// [REMOVED] Old setup modal
// [NEW] Import the new classification modal and its type
import { PropertyClassificationModal, type PropertyTier } from './components/PropertyClassificationModal';
import { RockenueHub } from './components/RockenueHub';
import { ShreejiReport } from './components/ShreejiReport';
import { PortfolioOverview } from './components/PortfolioOverview'; // [NEW] Import the new component
import { Budgeting } from './components/Budgeting'; // [NEW] Import the Budgeting component
import { LandingPage } from './components/LandingPage';
// [NEW] Import the legal page components
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { SupportPage } from './components/SupportPage'; // [NEW] Import the new support page
import { TermsOfService } from './components/TermsOfService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Download, RefreshCw } from 'lucide-react';
// Import both the function `toast` and the component `Toaster`
// [FIX] Removed the invalid '@2.0.3' version from the import path
import { toast } from 'sonner'; 
// [NEW] Import the local Toaster component from the correct 'ui' folder
import { Toaster } from './components/ui/sonner';
import * as XLSX from 'xlsx'; // Import the Excel library


// --- TYPE DEFINITIONS ---
interface Property {
  property_id: number;
  property_name: string;
}

interface RankingData {
  metric: string;
  rank: number;
  total: number;
}
// App.tsx
interface KpiDataSet {
  occupancy: number;
  adr: number;
  revpar: number;
  totalRevenue?: number; // [NEW] Add totalRevenue, make it optional for the 'market' object
}

// Update the state to hold both your hotel's and the market's data.
interface KpiData {
  yourHotel: KpiDataSet;
  market: KpiDataSet;
}

// [MODIFIED] Switched back to a string 'date' for the new chart
interface ChartDataPoint {
  date: string; // The new chart wants a simple string
  you: number;
  market: number;
}




export default function App() {
  // --- STATE DECLARATIONS ---
  
// [NEW] Add a state to track the initial session check
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  // [MODIFIED] Default activeView to null while we check the session
// [FIXED] Default activeView to 'landing' to prevent blank screen when no session is active
const [activeView, setActiveView] = useState<string | null>('landing');
// [NEW] Add state to remember the view before navigating to a legal page
const [previousView, setPreviousView] = useState<string | null>(null);

  
// [MODIFIED] Add the user's role to the userInfo state object
  const [userInfo, setUserInfo] = useState<{ firstName: string; lastName: string; email: string; role: string; } | null>(null);
  
  // [NEW] Add state to store the team members for the Settings page
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

// [MODIFIED] Add 'portfolio-overview' to the sub-view state types
const [rockenueSubView, setRockenueSubView] = useState<'hub' | 'shreeji-report' | 'portfolio-overview'>('hub');
  
  // [NEW] State to show the sync screen, mirroring dashboard.mjs 'isSyncing'
  const [isSyncing, setIsSyncing] = useState(false);

const [rankingData, setRankingData] = useState<RankingData[]>([]);

  // New state to store the 'last updated' timestamp from the API
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  
  // Data State
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState('');
// This initializes the state with the correct nested structure, preventing the crash on initial render.
// App.tsx
// This initializes the state with the correct nested structure, preventing the crash on initial render.
  const [kpiData, setKpiData] = useState<KpiData>({ 
    yourHotel: { occupancy: 0, adr: 0, revpar: 0, totalRevenue: 0 }, // [NEW] Initialize totalRevenue
    market: { occupancy: 0, adr: 0, revpar: 0 }
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const [tableData, setTableData] = useState<any[]>([]);

  // Dashboard Controls State
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-30');
  const [granularity, setGranularity] = useState('Daily');
  const [datePreset, setDatePreset] = useState('current-month');
  const [comparisonMetric, setComparisonMetric] = useState('occupancy');
  // Add state to manage which report is selected
const [selectedReportType, setSelectedReportType] = useState<string | null>(null);

  // Reports Page State
  const [reportStartDate, setReportStartDate] = useState('2025-09-01');
  const [reportEndDate, setReportEndDate] = useState('2025-09-15');
  const [reportDatePreset, setReportDatePreset] = useState('current-month');
  const [reportGranularity, setReportGranularity] = useState('daily');
// [MODIFIED] Added 'total-revenue' as a default metric
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['occupancy', 'adr', 'revpar', 'total-revenue']);  const [displayTotals, setDisplayTotals] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);
const [showMarketComparisons, setShowMarketComparisons] = useState(false); // Default to false
  const [tableLayout, setTableLayout] = useState('group-by-metric');
  const [reportData, setReportData] = useState<any[]>([]);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [showManageSchedules, setShowManageSchedules] = useState(false);
const [schedules, setSchedules] = useState<any[]>([]);

// This state now matches the complex interface expected by the card component.
const [marketCompositionData, setMarketCompositionData] = useState<MarketCompositionData>({
  competitorCount: 0,
  totalRooms: 0,
  breakdown: {
    // [FIX] The 'categories' object now matches the 'CategoryBreakdown' type
    categories: {} as { [key: string]: CategoryBreakdown }, 
    neighborhoods: {},
  },
});

  // Modals & Admin State
// Modals & Admin State
  const [showCompSetModal, setShowCompSetModal] = useState(false);
  const [selectedHotelForCompSet, setSelectedHotelForCompSet] = useState({ id: '', name: '' });
  // Add new state to hold the list of all hotels for the admin page
const [allHotels, setAllHotels] = useState<any[]>([]);
// New state to hold the value of the Admin Property Selector
const [adminSelectedPropertyId, setAdminSelectedPropertyId] = useState<string>('');
  // [NEW] Add state to hold the list of management groups for the combobox
const [managementGroups, setManagementGroups] = useState<string[]>([]);
// Add state to hold the list of scheduled reports
const [scheduledReports, setScheduledReports] = useState<any[]>([]);
  // Add state to hold the list of scheduled reports

  // Add a state to hold the currency symbol for the selected property.
// Store the currency CODE (e.g., 'USD', 'GBP') instead of the symbol
const [currencyCode, setCurrencyCode] = useState('USD');
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [showGrantAccess, setShowGrantAccess] = useState(false);
  // Add loading state for the report generator
const [reportIsLoading, setReportIsLoading] = useState(false);
const [showPropertySetup, setShowPropertySetup] = useState(false); // [MODIFIED] Default to false
// Refs to track initial component mount to prevent unwanted effects
const isTaxEffectMount = useRef(true);
const isMetricsEffectMount = useRef(true);
// [NEW] Ref to access the YearOnYearReport component's internal state
const yoyReportRef = useRef<any>(null);

// Effect to fetch hotel-specific details like currency when the property changes.
  useEffect(() => {

    const fetchHotelDetails = async () => {
      if (!property) return;
      try {
        const response = await fetch(`/api/hotel-details/${property}`);
        if (!response.ok) throw new Error('Failed to fetch hotel details');
        const data = await response.json();
if (data.currency_code) {
        // Directly set the currency CODE state
        setCurrencyCode(data.currency_code);
      } else {
         // Default to 'USD' if no code is returned
        setCurrencyCode('USD');
      }
    } catch (error) {
      console.error("Error fetching hotel details for currency:", error);
      setCurrencyCode('USD'); // Default to 'USD' on any error.
    }
    };
    fetchHotelDetails();
  }, [property]); // This hook runs whenever the selected 'property' changes.
  // --- DATA FETCHING EFFECTS ---
  
  // Effect to fetch the list of properties once on load.
// Effect to fetch the list of properties once on load and set the active property.

 // Effect to fetch the list of properties once session is ready & user is logged in.
useEffect(() => {
  // Don’t run until the session is checked, and only when logged in
  if (isSessionLoading || activeView === 'landing' || !userInfo) return;

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/my-properties', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch properties');
      const data: Property[] = await response.json();
      setProperties(data);

      // Support ?propertyId= in URL
      const urlParams = new URLSearchParams(window.location.search);
      const propertyIdFromUrl = urlParams.get('propertyId');

      if (propertyIdFromUrl && data.some(p => p.property_id.toString() === propertyIdFromUrl)) {
        setProperty(propertyIdFromUrl);
      } else if (data.length > 0) {
        setProperty(data[0].property_id.toString());
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  fetchProperties();
}, [isSessionLoading, activeView, userInfo]);


  // Effect to update the URL whenever the selected property changes.
  useEffect(() => {
    // Do not modify the URL if the property hasn't been set yet.
    if (!property) return;

    const url = new URL(window.location.href);
    url.searchParams.set('propertyId', property);
    // Update the URL in the browser's address bar without a page reload.
    window.history.pushState({}, '', url);
}, [property]); // This effect runs only when the 'property' state changes.

  // [NEW] Effect to handle the initial sync process, mirroring dashboard.mjs
  useEffect(() => {
    // [FIX] This check should *only* run *after* the initial session load is complete.
    // If we are still loading the session, don't do anything yet.
    if (isSessionLoading) {
      return;
    }

    // This effect runs once when the app is loaded and the session is confirmed.
    // It checks for the `newConnection=true` URL parameter.
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get("propertyId");
    const isNewConnection = urlParams.get("newConnection") === "true";

    // If it's not a new connection, do nothing.
    if (!isNewConnection || !propertyId) {
      return;
    }

    // [NEW] It's a new connection, so show the overlay and start polling.
    setIsSyncing(true); //
    let pollingInterval: number | null = null;

    // Define the async function to check the status
    const checkSyncStatus = async () => {
      try {
        // [NEW] Call the sync status endpoint
        const response = await fetch(`/api/sync-status/${propertyId}`);
        if (!response.ok) {
          throw new Error('Sync check failed');
        }
        const data = await response.json();
// [NEW] If the API says sync is complete, stop polling and hide overlay.
        //
        if (data.isSyncComplete === true) {
          setIsSyncing(false); // Hide the sync screen
          if (pollingInterval) clearInterval(pollingInterval); // Stop polling
          
          // [NEW] Trigger the Property Setup Modal
          setShowPropertySetup(true);

          // [NEW] After sync is done, clean the URL to prevent this from
          // running again on a page refresh.
          const url = new URL(window.location.href);
          url.searchParams.delete('newConnection');
          window.history.replaceState({}, '', url);
        }
        // If false, the poll continues, and the `isSyncing` overlay remains.
      } catch (error) {
        console.error("Error checking sync status:", error);
        setIsSyncing(false); // Default to not syncing on error
        if (pollingInterval) clearInterval(pollingInterval);
      }
    };

    // [NEW] Start the polling interval, matching the 15-second timer
    // from the original application.
    pollingInterval = window.setInterval(checkSyncStatus, 15000);

    // [NEW] Run the check immediately on load
    checkSyncStatus();

    // [NEW] The cleanup function for this useEffect
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  // [FIX] This hook should *only* run once when the session is loaded (when isSessionLoading flips to false).
  // It should NOT run every time activeView changes.
  }, [isSessionLoading]); // This hook now runs only when the session loading state changes.

// Effect to fetch KPI summary data when filters change.
  useEffect(() => {
    const fetchKpiSummary = async () => {
      if (!property) return;
      try {
        const response = await fetch(`/api/kpi-summary?propertyId=${property}&startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error('Failed to fetch KPI summary');
        const data = await response.json();
        
        // This corrected logic uses parseFloat to ensure ADR and RevPAR are numbers.
  // App.tsx
        const formattedKpis = {
          yourHotel: {
            occupancy: parseFloat(data.yourHotel.occupancy || 0) * 100,
            adr: parseFloat(data.yourHotel.adr || 0),
            revpar: parseFloat(data.yourHotel.revpar || 0),
            totalRevenue: parseFloat(data.yourHotel.totalRevenue || 0), // [NEW] Read totalRevenue from API
          },
          market: {
            occupancy: parseFloat(data.market.occupancy || 0) * 100,
            adr: parseFloat(data.market.adr || 0),
            revpar: parseFloat(data.market.revpar || 0),
          },
        };
        setKpiData(formattedKpis);
      } catch (error) {
        console.error("Error fetching KPI summary:", error);
        // On error, reset the state to its default structure.
        setKpiData({
          yourHotel: { occupancy: 0, adr: 0, revpar: 0 },
          market: { occupancy: 0, adr: 0, revpar: 0 },
        });
      }
    };
    fetchKpiSummary();
  }, [property, startDate, endDate]);

// Effect to fetch market composition data when filters change.
  useEffect(() => {
    const fetchCompetitorData = async () => {
      if (!property) return;
      try {
        const response = await fetch(`/api/competitor-metrics?propertyId=${property}&startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error('Failed to fetch competitor metrics');
        const data: MarketCompositionData = await response.json();

        // [DEBUG] Log the raw data from the API to the console
        console.log("--- RAW /api/competitor-metrics RESPONSE ---", data);

        setMarketCompositionData(data);
      } catch (error) {
        console.error("Error fetching competitor metrics:", error);
        // On error, reset to default empty state.
        setMarketCompositionData({
          competitorCount: 0,
          totalRooms: 0,
          breakdown: { categories: {}, neighborhoods: {} },
        });
      }
    };
    fetchCompetitorData();
  }, [property, startDate, endDate]);
  // Effect to fetch chart and table data when filters change.
  useEffect(() => {
    // [REMOVED] All the complex 'chartTicks' and 'dayDifference' logic is gone.

    const fetchTrendData = async () => {
      if (!property) return;
      
      // [FIX] Show loading spinners on chart and table
      setChartData([]);
      setTableData([]);
      
      try {
        // [FIX] Call the two "correct" endpoints in parallel, just like the Alpine app does.
        // These endpoints correctly recalculate occupancy from source columns.
        const urls = [
          `/api/metrics-from-db?propertyId=${property}&startDate=${startDate}&endDate=${endDate}&granularity=${granularity.toLowerCase()}`,
          `/api/competitor-metrics?propertyId=${property}&startDate=${startDate}&endDate=${endDate}&granularity=${granularity.toLowerCase()}`,
        ];
        
        const [yourHotelResponse, marketResponse] = await Promise.all(
          urls.map((url) => fetch(url))
        );

        if (!yourHotelResponse.ok || !marketResponse.ok) {
          throw new Error('Failed to fetch trend data from one or more endpoints');
        }

        const yourHotelData = await yourHotelResponse.json(); // Has { metrics: [...] }
        const marketData = await marketResponse.json(); // Has { metrics: [...] }

        // [FIX] Manually merge the data from the two API calls, replicating the Alpine app's logic.
        const dataMap = new Map<string, any>();

        // 1. Process data from /api/metrics-from-db
        yourHotelData.metrics.forEach((row: any) => {
          const date = (row.period).substring(0, 10); // Get YYYY-MM-DD
          if (!dataMap.has(date)) {
            // Initialize the entry with default market data
            dataMap.set(date, { 
              date, 
              yourHotel: {}, 
              market: { occupancy: 0, adr: 0, revpar: 0 } 
            });
          }
          // Populate the "yourHotel" object
          // We use the aliases from the API response: 'your_occupancy_direct' (which is the correct, calculated one), 'your_adr', and 'your_revpar'
          dataMap.get(date).yourHotel = {
            occupancy: parseFloat(row.your_occupancy_direct) || 0,
            adr: parseFloat(row.your_adr) || 0,
            revpar: parseFloat(row.your_revpar) || 0,
          };
        });

        // 2. Process data from /api/competitor-metrics
        marketData.metrics.forEach((row: any) => {
          const date = (row.period).substring(0, 10);
          if (!dataMap.has(date)) {
            // Initialize the entry with default hotel data if it doesn't exist
            dataMap.set(date, { 
              date, 
              yourHotel: { occupancy: 0, adr: 0, revpar: 0 }, 
              market: {} 
            });
          }
          // Populate the "market" object
          // We use the "gross" aliases for consistency with the Alpine app
          dataMap.get(date).market = {
            occupancy: parseFloat(row.market_occupancy) || 0,
            adr: parseFloat(row.market_gross_adr) || 0,
            revpar: parseFloat(row.market_gross_revpar) || 0,
          };
        });

        // Convert the map back to an array and sort by date
        const mergedData = Array.from(dataMap.values()).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // [FIX] Set the tableData state with the new, correctly merged data.
        // The DataTable component already expects this { date, yourHotel, market } structure.
        setTableData(mergedData);

        // [MODIFIED] This transformation logic is unchanged, but it now runs on `mergedData`
        // instead of the old `rawData`.
        const transformedForChart = mergedData.map((period: any) => {
          // Read the correct values from our newly merged objects
          const yourValue = period.yourHotel[comparisonMetric];
          const marketValue = period.market[comparisonMetric];
          
          const dateFormatOptions: Intl.DateTimeFormatOptions = {
            timeZone: 'UTC'
          };

          if (granularity.toLowerCase() === 'monthly') {
            dateFormatOptions.month = 'long';
            dateFormatOptions.year = 'numeric';
          } else {
            dateFormatOptions.month = 'short';
            dateFormatOptions.day = 'numeric';
          }

          return {
            date: new Date(period.date).toLocaleDateString('en-US', dateFormatOptions),
            // The occupancy data is now correct (e.g., 0.844) so we multiply by 100
            you: comparisonMetric === 'occupancy' ? yourValue * 100 : yourValue,
            market: comparisonMetric === 'occupancy' ? marketValue * 100 : marketValue,
          };
        });
        setChartData(transformedForChart);

      } catch (error) {
        console.error("Error fetching trend data:", error);
        setChartData([]);
        setTableData([]);
      }
    };
    fetchTrendData();
  }, [property, startDate, endDate, comparisonMetric, granularity]);
// Effect to fetch market ranking data when filters change.
  useEffect(() => {
    const fetchRankingData = async () => {
      if (!property) return;
      try {
        const response = await fetch(`/api/market-ranking?propertyId=${property}&startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error('Failed to fetch ranking data');
        
        // The API returns an object like: { occupancy: { rank, total }, adr: { rank, total } }
        const apiData = await response.json();
        
// Transform the API object into the array format required by the MarketRankingCard component.
        const formattedRankings = Object.keys(apiData).map((metric) => {
          // Store the metric name consistently as lowercase for comparison
          const metricName = metric.toLowerCase();
          let displayName;

          // Check for acronyms that should be fully uppercase
          if (metricName === 'adr' || metricName === 'revpar') {
            displayName = metricName.toUpperCase(); // e.g., 'adr' -> 'ADR'
          } else {
            // Otherwise, just capitalize the first letter
            displayName = metricName.charAt(0).toUpperCase() + metricName.slice(1); // e.g., 'occupancy' -> 'Occupancy'
          }

          return {
            metric: displayName,
            rank: apiData[metric].rank,
            total: apiData[metric].total,
          };
        });
        
        setRankingData(formattedRankings);
      } catch (error) {
        console.error("Error fetching ranking data:", error);
        setRankingData([]); // Clear data on error
      }
};
    fetchRankingData();
  }, [property, startDate, endDate]);

// Reusable function to fetch the last data refresh time
  // This is now defined in the main component scope
  const fetchLastRefreshTime = async () => {
    try {
      // Call the existing endpoint
      const response = await fetch('/api/last-refresh-time');
      if (!response.ok) throw new Error('Failed to fetch last refresh time');
      const data = await response.json();
      
      // The endpoint returns a full timestamp, e.g., "2025-10-18T05:30:00.000Z"
      if (data.last_successful_run) {
        setLastUpdatedAt(data.last_successful_run);
      }
    } catch (error) {
      console.error("Error fetching last refresh time:", error);
      setLastUpdatedAt(null); // Set to null on error
    }
  };

  // Effect to fetch the last data refresh time, runs once on load.
  useEffect(() => {
    fetchLastRefreshTime(); // Call the function
  }, []); // Empty dependency array ensures this runs only once.

  // [NEW] Function to fetch scheduled reports for the current user/property.
  const fetchSchedules = async () => {
    if (!property) return; // Don't fetch if no property is selected
    
    try {
      // The endpoint gets the user from the session, so we just need to call it.
      const response = await fetch('/api/reports/scheduled-reports');
      if (!response.ok) {
        throw new Error('Failed to fetch schedules');
}
      const data = await response.json();

// [DEBUG] Log the data from the API to check its structure
      // console.log("--- SCHEDULES FROM API ---", data);
      
      setSchedules(data);
    } catch (error: any) {
      console.error("Error fetching schedules:", error);
      toast.error('Failed to load schedules', { description: error.message });
    }
  };

  // [NEW] Effect to fetch schedules when the reports view is active.
  useEffect(() => {
    if (activeView === 'reports') {
      fetchSchedules();
    }
  }, [activeView, property]); // Re-fetch if view or property changes


// Effect to fetch admin-specific data when the admin view is active.
  useEffect(() => {
    const fetchAdminData = async () => {
try {
    // Fetch all hotels
    const hotelsResponse = await fetch('/api/admin/get-all-hotels');
    if (!hotelsResponse.ok) throw new Error('Failed to fetch all hotels');
    const hotelsData = await hotelsResponse.json();
    setAllHotels(hotelsData);

    // [NEW] Fetch the distinct list of management groups
    const groupsResponse = await fetch('/api/admin/management-groups');
    if (!groupsResponse.ok) throw new Error('Failed to fetch management groups');
    const groupsData = await groupsResponse.json();
    setManagementGroups(groupsData); // Store groups in state

    // Fetch scheduled reports
    const reportsResponse = await fetch('/api/admin/get-scheduled-reports');
    if (!reportsResponse.ok) throw new Error('Failed to fetch scheduled reports');
    const reportsData = await reportsResponse.json();
    setScheduledReports(reportsData); // Store reports in state

  } catch (error) {
    console.error("Error fetching admin data:", error);
    setAllHotels([]); // Clear hotels on error
    setScheduledReports([]); // Clear reports on error
  }
    };
    // Only run the fetch logic if the admin view is the one being shown
    if (activeView === 'admin') {
      fetchAdminData();
    }
  }, [activeView]); // This hook runs whenever activeView changes

  // New effect to set the default value for the admin property selector
  useEffect(() => {
    // When the list of all hotels loads, set the selector to the first hotel
    if (allHotels.length > 0 && !adminSelectedPropertyId) {
      setAdminSelectedPropertyId(allHotels[0].hotel_id.toString());
    }
    // This hook runs when allHotels changes
  }, [allHotels, adminSelectedPropertyId]);

// --- DATE PRESET LOGIC ---

// --- DATE PRESET LOGIC ---
  // This effect hook updates the start and end dates when a date preset is selected.
  useEffect(() => {
    // This helper function now takes a UTC timestamp and correctly formats it.
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    // We use the current date of October 17, 2025 for consistent calculations.
    const today = new Date('2025-10-17T12:00:00Z');
    // Get year, month, and day in UTC to prevent timezone skew.
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();

    let newStartDate: Date;
    let newEndDate: Date;

    switch (datePreset) {
      case 'previous-month':
        // All calculations now use Date.UTC to be timezone-proof.
        newStartDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
        newEndDate = new Date(Date.UTC(currentYear, currentMonth, 0));
        break;
      case 'current-month':
        newStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        newEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        break;
      case 'next-month':
        newStartDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
        newEndDate = new Date(Date.UTC(currentYear, currentMonth + 2, 0));
        break;
      case 'ytd':
        newStartDate = new Date(Date.UTC(currentYear, 0, 1));
        newEndDate = today;
        break;
      case 'this-year':
        newStartDate = new Date(Date.UTC(currentYear, 0, 1));
        newEndDate = new Date(Date.UTC(currentYear, 11, 31));
        break;
      default:
        return; // Do nothing if no preset is matched.
    }

setStartDate(formatDate(newStartDate));
    setEndDate(formatDate(newEndDate));
  }, [datePreset]);

  // [NEW] Effect hook to update REPORT start and end dates when the REPORT date preset is selected.
  useEffect(() => {
    // This helper function now takes a UTC timestamp and correctly formats it.
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    // We use the current date of October 17, 2025 for consistent calculations.
    const today = new Date('2025-10-17T12:00:00Z');
    // Get year, month, and day in UTC to prevent timezone skew.
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
    const currentDay = today.getUTCDate();
    // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const currentDayOfWeek = today.getUTCDay() === 0 ? 7 : today.getUTCDay(); // Adjust Sunday to 7

    let newStartDate: Date;
    let newEndDate: Date;

    // Use 'reportDatePreset' (the report state) instead of 'datePreset'
    switch (reportDatePreset) { 
      case 'last-week':
        // Start of last week (Monday)
        newStartDate = new Date(Date.UTC(currentYear, currentMonth, currentDay - currentDayOfWeek - 6));
        // End of last week (Sunday)
        newEndDate = new Date(Date.UTC(currentYear, currentMonth, currentDay - currentDayOfWeek));
        break;
      case 'current-week':
        // Start of current week (Monday)
        newStartDate = new Date(Date.UTC(currentYear, currentMonth, currentDay - currentDayOfWeek + 1));
        // End of current week (Sunday)
        newEndDate = new Date(Date.UTC(currentYear, currentMonth, currentDay - currentDayOfWeek + 7));
        break;
      case 'current-month':
        newStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        newEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        break;
      case 'next-month':
        newStartDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
        newEndDate = new Date(Date.UTC(currentYear, currentMonth + 2, 0));
        break;
      case 'year-to-date':
        newStartDate = new Date(Date.UTC(currentYear, 0, 1));
        newEndDate = today;
        break;
      case 'this-year':
        newStartDate = new Date(Date.UTC(currentYear, 0, 1));
        newEndDate = new Date(Date.UTC(currentYear, 11, 31));
        break;
      case 'last-year':
        newStartDate = new Date(Date.UTC(currentYear - 1, 0, 1));
        newEndDate = new Date(Date.UTC(currentYear - 1, 11, 31));
        break;
      default:
        return; // Do nothing if no preset is matched.
    }

    // Update the REPORT state variables
    setReportStartDate(formatDate(newStartDate));
    setReportEndDate(formatDate(newEndDate));
}, [reportDatePreset]); // This hook runs when 'reportDatePreset' changes

// App.tsx
  // [NEW] This effect hook fetches the user's editable profile info (first/last name)
  // It runs when the settings view is opened.
// [NEW] This effect hook fetches data needed for the Settings page
  // It runs when the settings view is opened.
useEffect(() => {
    console.log('[Settings Hook] Fired. activeView:', activeView); // [DEBUG] Add this log

    // Function to fetch the user's editable profile
    const fetchUserProfile = async () => {
      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) throw new Error('Failed to fetch profile');
        const profileData = await response.json();
        
// [MODIFIED] Update the userInfo state using the functional form
        // This merges the new profile data while *preserving* the existing 'role'
        setUserInfo(prev => ({
          ...prev!, // Keep existing properties (like role)
          firstName: profileData.first_name || '',
          lastName: profileData.last_name || '',
          email: profileData.email || '', 
        }));
      } catch (error) {
        console.error("Error fetching user profile:", error);
        toast.error("Could not load user profile.");
      }
    };

 // [NEW] Function to fetch the list of team members
    const fetchTeamMembers = async () => {
      console.log('[Settings Hook] fetchTeamMembers() CALLED'); // [DEBUG] Add this log
      try {
       // [MODIFIED] Call the team endpoint with cache-busting options
// [MODIFIED] Pass the currently selected 'property' state as a query parameter
        const response = await fetch(`/api/users/team?propertyId=${property}`, {
          credentials: 'include', // [NEW] Ensure cookies are sent
          cache: 'no-store', // [NEW] This is the fix for 304 Not Modified
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });
        if (!response.ok) throw new Error('Failed to fetch team members');
        const teamData = await response.json();
        setTeamMembers(teamData); // [NEW] Store team data in state
      } catch (error: any) {
        console.error("Error fetching team members:", error);
        toast.error('Could not load team members', { description: error.message });
        setTeamMembers([]); // [NEW] Clear state on error
      }
    };

// [MODIFIED] Only run these fetches if the settings view is active
    if (activeView === 'settings') {
      console.log('[Settings Hook] activeView is "settings", proceeding to fetch.'); // [DEBUG] Add this log

      // Fetch profile only if we don't have it
      if (!userInfo || userInfo.email === 'email@placeholder.com') {
        fetchUserProfile();
      }
      // Always fetch the latest team list
      fetchTeamMembers();
}
  }, [activeView, userInfo, property]); // [MODIFIED] Add 'property' so the team list updates when the property changes

// [NEW] Effect to check session on initial app load
  useEffect(() => {
    const checkUserSession = async () => {
      try { // [FIX] Added the missing 'try' keyword here
        // Fetch session info from the backend
        const response = await fetch('/api/auth/session-info', { 
          // [FIX] Add credentials: 'include' to ensure the session cookie is sent
          credentials: 'include',
          
          // [FIX] Add cache-busting headers to prevent 304 errors
          cache: 'no-store', 
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }
        });
        const session = await response.json();
        
        // [FIX] Corrected the logic. We only need to check session.isLoggedIn.
        // The user data is at the top level, not nested.
        if (session.isLoggedIn) {
          // [NEW] If logged in, store the user's info
// [NEW] If logged in, store the user's info, *including their role*
          setUserInfo({
            firstName: session.firstName || 'User', // Read from session.firstName
            lastName: session.lastName || '', // Read from session.lastName
            email: session.email || 'email@placeholder.com', // Placeholder
            role: session.role || 'user' // [NEW] Get the role from the session, default to 'user'
          });
          // If logged in, go to the dashboard
  // [MODIFIED] If logged in, restore the last view from session storage, or default to dashboard
          const lastView = sessionStorage.getItem('marketPulseActiveView');
          setActiveView(lastView || 'dashboard');
        } else {
          // If not logged in, show the landing page
          setActiveView('landing');
        }
      } catch (error) {
        console.error("Error checking session:", error);
        // On error, default to the landing page
        setActiveView('landing');
      } finally {
        // Stop the loading state
        setIsSessionLoading(false);
      }
    };

    checkUserSession();
  }, []); // The empty array ensures this runs only once on mount

  // --- HANDLER FUNCTIONS ---
// [NEW] Handler for the property classification modal
  const handlePropertySetupComplete = async (tier: PropertyTier) => {
    if (!property) {
      toast.error("No property selected. Cannot save classification.");
      return;
    }

    try {
      // [NEW] We will need a new endpoint to save this.
      // For now, we'll log it and prepare the fetch call.
      console.log(`Saving tier "${tier}" for propertyId ${property}`);
      
      // const response = await fetch(`/api/hotel-details/${property}/classify`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ tier }),
      // });

      // if (!response.ok) {
      //   throw new Error('Failed to save property classification');
      // }
      
      // const result = await response.json();
      
      // On success:
      // toast.success(`Property classified as ${tier}`);
      // setShowPropertySetup(false); // Close the modal

    } catch (error: any) {
      console.error("Error saving property classification:", error);
      toast.error('Error saving classification', { description: error.message });
    }

    // For testing, let's just close the modal and show the toast
    toast.success(`Property classified as ${tier}`);
    setShowPropertySetup(false);
  };
  // --- HANDLER FUNCTIONS ---

  // [NEW] This function handles all view changes and tracks the previous view
const handleViewChange = (newView: string) => {
    // If we are navigating TO a legal page, store the current view
    if (newView === 'privacy' || newView === 'terms') {
      setPreviousView(activeView);
    }
    // Set the new view
    setActiveView(newView);
    
    // [NEW] Persist the active view in session storage to survive refreshes
    // We don't persist legal/support pages, only main app views
    if (newView !== 'privacy' && newView !== 'terms' && newView !== 'support') {
      sessionStorage.setItem('marketPulseActiveView', newView);
    }
  };



// App.tsx
  const handleToggleMetric = (metric: string) => {
    setSelectedMetrics(prev => prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]);
  };

  // [NEW] Function to handle saving the user's profile
  const handleUpdateProfile = async (firstName: string, lastName: string) => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update profile');
      }

      // Update the local state to match
      setUserInfo(prev => ({
        ...prev!,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
      }));

      toast.success('Profile updated successfully');
      
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error('Error updating profile', { description: error.message });
    }
  };
// [FIX] This function is now refactored to call the "correct" endpoints,
// replicating the logic from the working Alpine.js app
// [FIX] This function is now refactored to call the "correct" endpoints,
// replicating the logic from the working Alpine.js app
const handleRunReport = async () => {
  setReportIsLoading(true); // Start the loader
  setReportData([]); // Clear old data

  // 1. [NEW] Determine which metrics to fetch based on state
  // We need to fetch all core metrics if any related metric is selected.
  const fetchHotelMetrics = selectedMetrics.some(m => !m.startsWith('market-'));
  const fetchMarketMetrics = selectedMetrics.some(m => m.startsWith('market-'));

  // [NEW] Use the correct tax-aware columns based on the taxInclusive toggle
  // The backend for /metrics-from-db and /competitor-metrics provides both net and gross columns
  const hotelAdrAlias = taxInclusive ? 'your_gross_adr' : 'your_net_adr';
  const hotelRevparAlias = taxInclusive ? 'your_gross_revpar' : 'your_net_revpar';
  const hotelRevenueAlias = taxInclusive ? 'your_gross_revenue' : 'your_net_revenue';
  
  const marketAdrAlias = taxInclusive ? 'market_gross_adr' : 'market_net_adr';
  const marketRevparAlias = taxInclusive ? 'market_gross_revpar' : 'market_net_revpar';
  const marketRevenueAlias = taxInclusive ? 'market_gross_revenue' : 'market_net_revenue';

  try {
    // 2. [NEW] Call the correct, trusted backend endpoints
    const yourHotelPromise = fetchHotelMetrics
      ? fetch(`/api/metrics-from-db?propertyId=${property}&startDate=${reportStartDate}&endDate=${reportEndDate}&granularity=${reportGranularity}`)
      : Promise.resolve(null);
      
    const marketPromise = fetchMarketMetrics
      ? fetch(`/api/competitor-metrics?propertyId=${property}&startDate=${reportStartDate}&endDate=${reportEndDate}&granularity=${reportGranularity}`)
      : Promise.resolve(null);

    const [yourHotelResponse, marketResponse] = await Promise.all([yourHotelPromise, marketPromise]);

    let yourHotelData = { metrics: [] };
    let marketData = { metrics: [] };

    if (yourHotelResponse) {
      if (!yourHotelResponse.ok) throw new Error('Failed to fetch hotel metrics');
      yourHotelData = await yourHotelResponse.json(); // Has { metrics: [...] }
    }
    
    if (marketResponse) {
      if (!marketResponse.ok) throw new Error('Failed to fetch market metrics');
      marketData = await marketResponse.json(); // Has { metrics: [...] }
    }

    // 3. [NEW] Manually merge the data from the two API calls, just like the dashboard chart
    const dataMap = new Map<string, any>();

    // Process "your hotel" data
    yourHotelData.metrics.forEach((row: any) => {
      const date = (row.period).substring(0, 10);
      if (!dataMap.has(date)) dataMap.set(date, { period: date });
      
      const entry = dataMap.get(date);
      // Use the correct calculated occupancy alias
      entry['occupancy'] = parseFloat(row.your_occupancy_direct) || 0;
      entry['adr'] = parseFloat(row[hotelAdrAlias]) || 0;
      entry['revpar'] = parseFloat(row[hotelRevparAlias]) || 0;
      entry['total-revenue'] = parseFloat(row[hotelRevenueAlias]) || 0;
      entry['rooms-sold'] = parseInt(row.your_rooms_sold, 10) || 0;
      // [NEW] Add capacity count needed for unsold calculation
      entry['capacity-count'] = parseInt(row.your_capacity_count, 10) || 0; 
      // Calculate unsold rooms
      entry['rooms-unsold'] = entry['capacity-count'] - entry['rooms-sold'];
    });

    // Process "market" data
    marketData.metrics.forEach((row: any) => {
      const date = (row.period).substring(0, 10);
      if (!dataMap.has(date)) dataMap.set(date, { period: date });
      
      const entry = dataMap.get(date);
      // Use the correct calculated occupancy alias
      entry['market-occupancy'] = parseFloat(row.market_occupancy) || 0;
      entry['market-adr'] = parseFloat(row[marketAdrAlias]) || 0;
      entry['market-revpar'] = parseFloat(row[marketRevparAlias]) || 0;
      entry['market-total-revenue'] = parseFloat(row[marketRevenueAlias]) || 0;
      // Note: Market data doesn't typically include rooms sold/unsold,
      // but if it did, you'd add them here similarly to the hotel data.
    });

    // 4. [NEW] Convert map to sorted array
    const mergedData = Array.from(dataMap.values()).sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
    );

    // 5. [NEW] Filter the merged data to only include columns the user selected
    const finalReportData = mergedData.map(row => {
      const filteredRow: { [key: string]: any } = { period: row.period };
      for (const metric of selectedMetrics) {
        // Handle market prefix stripping for lookup, like 'market-adr' -> 'adr'
        const baseMetricKey = metric.startsWith('market-') ? metric.substring(7) : metric;
        
        // Construct the key used in our merged data map (e.g., 'market-adr', 'occupancy', 'rooms-unsold')
        let lookupKey = metric;
        // Special case for unsold, as it was calculated without a market prefix initially
        if (metric === 'rooms-unsold') {
           lookupKey = 'rooms-unsold'; // No prefix needed for calculated value
        } else if (metric.startsWith('market-')) {
          // If it's a market metric, ensure the prefix is there
          lookupKey = metric; 
        } else {
          // If it's a hotel metric, ensure no prefix is there (except the calculated ones like 'rooms-unsold')
          lookupKey = baseMetricKey; 
        }

        filteredRow[metric] = row[lookupKey] ?? 0; // Default to 0 if data is missing for the selected metric
      }
      return filteredRow;
    });

    setReportData(finalReportData);
    toast.success('Report generated successfully');

  } catch (error: any) {
    console.error("Error running report:", error);
    toast.error('Error running report:', { description: error.message });
    setReportData([]); // Ensure data is empty on error
  } finally {
    setReportIsLoading(false); // Stop the loader
  }
};

// [NEW] Handler to export the Year-on-Year report
const handleYoyExport = (format: 'csv' | 'xlsx') => {
  // 1. Check if the ref is connected
  if (!yoyReportRef.current) {
    toast.error("Cannot export, report component is not ready.");
    return;
  }

  // 2. Get all data from the child component's ref
  const { 
    reportData, 
    year1, 
    year2, 
    summary, 
    currentPeriodSummary,
    formatCurrency, // Get the formatter from the child
    formatCurrencyDynamic // Get the formatter from the child
  } = yoyReportRef.current.getExportData();

  if (!reportData || reportData.length === 0) {
    toast.error("No report data to export.");
    return;
  }

  // 3. Create dynamic filename
  const propertyName = properties.find(p => p.property_id.toString() === property)?.property_name || 'Report';
  const fileName = `${propertyName} ${year1} vs ${year2} YoY Report.${format}`;

  // 4. Flatten and format the data
  const formattedData: any[] = [];
  
  // Get the name of the last month for YTD injection
  const lastCompleteMonthName = currentPeriodSummary?.periodLabel.split(' - ')[1].replace(')',''); // e.g. "Sep"
  
  reportData.forEach((row: any) => {
    // Add the row for the month
    formattedData.push({
      'Month': row.month,
      [`Occ % (${year1})`]: `${row.year1.occupancy.toFixed(1)}%`,
      [`ADR (${year1})`]: formatCurrency(row.year1.adr),
      [`RevPAR (${year1})`]: formatCurrency(row.year1.revpar),
      [`Revenue (${year1})`]: formatCurrencyDynamic(row.year1.revenue),
      [`Occ % (${year2})`]: `${row.year2.occupancy.toFixed(1)}%`,
      [`ADR (${year2})`]: formatCurrency(row.year2.adr),
      [`RevPAR (${year2})`]: formatCurrency(row.year2.revpar),
      [`Revenue (${year2})`]: formatCurrencyDynamic(row.year2.revenue),
    });
    
    // [NEW] Inject the YTD row right after the correct month
    if (currentPeriodSummary && row.month === lastCompleteMonthName) {
      formattedData.push({
        'Month': currentPeriodSummary.periodLabel, // e.g., "YTD (Jan - Sep)"
        [`Occ % (${year1})`]: `${currentPeriodSummary.avg1.occupancy.toFixed(1)}%`,
        [`ADR (${year1})`]: formatCurrency(currentPeriodSummary.avg1.adr),
        [`RevPAR (${year1})`]: formatCurrency(currentPeriodSummary.avg1.revpar),
        [`Revenue (${year1})`]: formatCurrencyDynamic(currentPeriodSummary.total1.revenue),
        [`Occ % (${year2})`]: `${currentPeriodSummary.avg2.occupancy.toFixed(1)}%`,
        [`ADR (${year2})`]: formatCurrency(currentPeriodSummary.avg2.adr),
        [`RevPAR (${year2})`]: formatCurrency(currentPeriodSummary.avg2.revpar),
        [`Revenue (${year2})`]: formatCurrencyDynamic(currentPeriodSummary.total2.revenue),
      });
    }
  });
  
  // [NEW] Add the Full Year totals row at the end
  formattedData.push({
    'Month': 'Full Year (Jan - Dec)',
    [`Occ % (${year1})`]: `${summary.avg1.occupancy.toFixed(1)}%`,
    [`ADR (${year1})`]: formatCurrency(summary.avg1.adr),
    [`RevPAR (${year1})`]: formatCurrency(summary.avg1.revpar),
    [`Revenue (${year1})`]: formatCurrencyDynamic(summary.total1.revenue),
    [`Occ % (${year2})`]: `${summary.avg2.occupancy.toFixed(1)}%`,
    [`ADR (${year2})`]: formatCurrency(summary.avg2.adr),
    [`RevPAR (${year2})`]: formatCurrency(summary.avg2.revpar),
    [`Revenue (${year2})`]: formatCurrencyDynamic(summary.total2.revenue),
  });

  // 5. Create and download the file
  const ws = XLSX.utils.json_to_sheet(formattedData);
  
  // Auto-size columns
  const headers = Object.keys(formattedData[0] || {});
  const colWidths = headers.map((header) => {
    let maxLen = header.length;
    formattedData.forEach(row => {
      const cellValue = row[header];
      if (cellValue != null && cellValue.toString().length > maxLen) {
        maxLen = cellValue.toString().length;
      }
    });
    return { wch: maxLen + 2 }; // +2 for padding
  });
  ws['!cols'] = colWidths;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Year-on-Year Report");
  XLSX.writeFile(wb, fileName);
};


// [NEW] This effect hook automatically re-runs the report when the tax toggle is changed.


// [NEW] This effect hook automatically re-runs the report when the tax toggle is changed.
useEffect(() => {
  if (selectedReportType === 'performance-metrics') {
    // [FIX] Use a ref to skip the very first render
    if (isTaxEffectMount.current) {
      isTaxEffectMount.current = false; // Set it to false for subsequent runs
    } else {
      // Only run the report on *changes* after the initial mount
      handleRunReport();
    }
  }
}, [taxInclusive]); // This hook watches *only* the taxInclusive state

// [NEW] This effect hook automatically re-runs the report when the metric list is changed.
useEffect(() => {
  if (selectedReportType === 'performance-metrics') {
    // [FIX] Use a ref to skip the very first render
    if (isMetricsEffectMount.current) {
      isMetricsEffectMount.current = false; // Set it to false for subsequent runs
    } else {
      // Only run the report on *changes* after the initial mount
      handleRunReport();
    }
  }
}, [selectedMetrics]); // This hook watches *only* the selectedMetrics state


  const handleSaveSchedule = async (scheduleFromModal: any) => {
    try {
      // 1. Get metrics from the current report state (for performance report)
      const metricsHotel = selectedMetrics.filter(m => !m.startsWith('market-'));
      const metricsMarket = selectedMetrics.filter(m => m.startsWith('market-'));

      // [NEW] Get parameters for YoY report, if applicable
      let yoyParams = { year1: null, year2: null };
      if (selectedReportType === 'year-on-year' && yoyReportRef.current) {
        // Call the new function exposed by the ref
        yoyParams = yoyReportRef.current.getScheduleParameters();
      }

      // 2. Get attachment formats from modal state
      const attachmentFormats = [];
      if (scheduleFromModal.formats.csv) attachmentFormats.push('csv');
      if (scheduleFromModal.formats.excel) attachmentFormats.push('xlsx');

 // [NEW] Helper object to map weekday strings to integers (ISO 8601 standard)
      const dayOfWeekMap: { [key: string]: number | null } = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 7,
      };

      // 3. Build the complete API payload
      const payload = {
        propertyId: property, // The currently selected property
        reportName: scheduleFromModal.reportName,
        recipients: scheduleFromModal.emailRecipients.split(',').map((e: string) => e.trim()),
        frequency: scheduleFromModal.frequency,
    // [MODIFIED] Use the map to send the correct integer for the day of week
        dayOfWeek: dayOfWeekMap[scheduleFromModal.dayOfWeek] || null,
        dayOfMonth: null, // Not yet supported by this modal, send null
        timeOfDay: scheduleFromModal.timeOfDay,
        reportPeriod: scheduleFromModal.reportPeriod,
        attachmentFormats: attachmentFormats,
        
        // Include the current report's settings
        metricsHotel: metricsHotel,
        metricsMarket: metricsMarket,
        addComparisons: showMarketComparisons,
        displayTotals: displayTotals,
        includeTaxes: taxInclusive,

        displayOrder: tableLayout,
        
        // [NEW] Add report type and YoY-specific parameters
        reportType: selectedReportType,
        year1: yoyParams.year1,
        year2: yoyParams.year2,
      };

      // 4. Send the API request
      const response = await fetch('/api/reports/scheduled-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create schedule');
      }

      // 5. Show success and refresh the schedule list
      toast.success('Schedule created successfully!');
      fetchSchedules(); // Re-fetch the list to include the new one
      
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error('Error saving schedule', { description: error.message });
    }
  };
// [MODIFIED] This function now calls the DELETE API endpoint.
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/reports/scheduled-reports/${scheduleId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete schedule');
      }

      // Show success and update the UI
      toast.success('Schedule deleted');
      // Update state locally to remove the item immediately
      // [FIX] Corrected the filter to use 'id' which matches the API response
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));

    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast.error('Error deleting schedule', { description: error.message });
    }
  };

  // This memoized calculation finds the RevPAR-specific ranking from the ranking data array.
  // It only re-runs when the rankingData state changes.
  const revparRank = useMemo(() => {
    return rankingData.find(r => r.metric.toLowerCase() === 'revpar');
  }, [rankingData]);

  const handleManageCompSet = (hotelId: string, hotelName: string) => {
    setSelectedHotelForCompSet({ id: hotelId, name: hotelName });
    setShowCompSetModal(true);
  };

const handleRemoveUser = (userId: string) => {
    toast.success('User removed from team');
  };

  /**
   * [NEW] Handles changes to the management status or group from the HotelManagementTable.
   */
  const handleManagementChange = async (
    hotelId: number, 
    field: 'is_rockenue_managed' | 'management_group', 
    value: string | boolean | null // [FIX] Allow null for deselecting a group
  ) => {
    const toastId = toast.loading('Updating management info...');

    try {
      const response = await fetch('/api/admin/update-hotel-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelId, field, value }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update management info');
      }
      
      toast.success(result.message || 'Management info updated.', { id: toastId });

      // --- [THE FIX] ---
      // Manually update the 'allHotels' state to reflect the change immediately.
      setAllHotels(currentHotels => 
        currentHotels.map(hotel => 
          hotel.hotel_id === hotelId 
            ? { ...hotel, [field]: value } // Update the specific hotel
            : hotel 
        )
      );

      // [NEW] If a new management group was added, update the groups list
      if (field === 'management_group' && typeof value === 'string' && value.trim() !== '' && !managementGroups.includes(value)) {
        setManagementGroups(currentGroups => [...currentGroups, value].sort());
      }

    } catch (error: any) {
      toast.error(`Update failed: ${error.message}`, { id: toastId });
    }
  };
  
// App.tsx
  // --- RENDER ---

  // [NEW] Format the total revenue using the currencyCode state
  const formattedTotalRevenue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode, // Use the state variable
    maximumFractionDigits: 0, // No decimals for the main card
  }).format(kpiData.yourHotel.totalRevenue || 0);
  
  // [NEW] Show a full-screen loader while checking the session
// [NEW] Show a full-screen loader while checking the session
if (isSessionLoading) {
  return (
    <div className="min-h-screen bg-[#1a1a18] flex items-center justify-center">
      {/* Simple loader */}
      <div className="w-12 h-12 border-4 border-[#faff6a] border-t-transparent border-solid rounded-full animate-spin"></div>
    </div>
  );
}

// [FIXED] If activeView is null or undefined, render Landing as safe fallback
if (!activeView) {
  return (
    <LandingPage
      onSignIn={() => setActiveView('dashboard')}
      onViewChange={handleViewChange}
    />
  );
}

// [NEW] If the view is 'landing', render *only* the LandingPage component.
if (activeView === 'landing') {

    return (
      <LandingPage
        onSignIn={() => setActiveView('dashboard')}
        // [NEW] Pass the view change handler to the LandingPage for its footer links
        onViewChange={handleViewChange}
      />
    );
  }

  // [NEW] Handle legal pages as full-screen overlays
  if (activeView === 'privacy') {
    return (
      <PrivacyPolicy 
        // Go back to 'dashboard' if logged in, or 'landing' if logged out
        onBack={() => setActiveView(previousView || (isSessionLoading ? 'landing' : 'dashboard'))} 
      />
    );
  }

  if (activeView === 'terms') {
    return (
      <TermsOfService 
        // Go back to 'dashboard' if logged in, or 'landing' if logged out
        onBack={() => setActiveView(previousView || (isSessionLoading ? 'landing' : 'dashboard'))} 
      />
    );
  }

// [MOVED] The 'support' view is now handled in the main app layout below.

  // [NEW] If the session is loaded and view is not 'landing', render the main app.
  // We also check that activeView is not null to satisfy TypeScript.
return (
    activeView && (
<div className="min-h-screen bg-[#252521]">
    
    {/* [NEW] Conditionally render the InitialSyncScreen as a full-screen overlay
        based on the new `isSyncing` state, which mimics the original app. 
        */}
    {isSyncing && <InitialSyncScreen />}

    <TopNav
          activeView={activeView} 
          // [MODIFIED] Pass our new, smarter handler to the TopNav
          onViewChange={handleViewChange}
          property={property}
          onPropertyChange={setProperty}
          properties={properties}
          // Pass the new state variable down to the TopNav component
          lastUpdatedAt={lastUpdatedAt}
          // [NEW] Pass the user info down to the TopNav
          userInfo={userInfo}
        />

      {/* Landing View block is now removed and handled above */}
      
      {activeView === 'dashboard' && (
        <div className="p-4">
          <div className="mb-6 bg-[#1a1a18] rounded-lg border border-[#262626] px-5 py-3.5">
            <div className="flex items-center justify-between">
  <div className="flex items-center gap-4">
                {/* Date Range Picker */}
                <div className="flex items-center gap-2">
                  <label className="text-[#e5e5e5] text-xs">Dashboard Period:</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36 h-8 bg-[#252521] border-[#262626] text-[#e5e5e5] text-xs"
                  />
                  <span className="text-[#6b7280] text-xs">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36 h-8 bg-[#252521] border-[#262626] text-[#e5e5e5] text-xs"
                  />
                </div>

                <div className="h-8 w-px bg-[#262626]" />

                {/* Preset Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-[#6b7280] text-xs">or Preset:</label>
                  <Select value={datePreset} onValueChange={setDatePreset}>
                    <SelectTrigger className="w-36 h-8 bg-[#252521] border-[#262626] text-[#e5e5e5] text-xs">
                      <SelectValue placeholder="Select preset..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a18] border-[#262626] text-[#e5e5e5]">
                      <SelectItem value="previous-month">Previous Month</SelectItem>
                      <SelectItem value="current-month">Current Month</SelectItem>
                      <SelectItem value="next-month">Next Month</SelectItem>
                      <SelectItem value="ytd">Year-to-Date</SelectItem>
                      <SelectItem value="this-year">This Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="h-8 w-px bg-[#262626]" />

                {/* Granularity Buttons */}
                <div className="flex items-center gap-2">
                  <label className="text-[#6b7280] text-xs">View:</label>
                  <div className="flex gap-1">
                    {['Daily', 'Weekly', 'Monthly'].map((option) => (
                      <button
                        key={option}
                        onClick={() => setGranularity(option)}
                        className={`px-3 py-1.5 rounded text-xs transition-colors ${
                          granularity === option
                            ? 'bg-[#262626] text-[#e5e5e5]'
                            : 'bg-transparent text-[#9ca3af] hover:text-[#e5e5e5]'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-8 w-px bg-[#262626]" />

                {/* Metric Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-[#6b7280] text-xs">Metric:</label>
                  <Select value={comparisonMetric} onValueChange={setComparisonMetric}>
                    <SelectTrigger 
                      className="h-8 bg-[#252521] border-[#262626] text-[#e5e5e5] text-xs"
                      style={{ minWidth: '6rem' }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a18] border-[#262626] text-[#e5e5e5]">
                      <SelectItem value="occupancy">Occupancy</SelectItem>
                      <SelectItem value="adr">ADR</SelectItem>
                      <SelectItem value="revpar">RevPAR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button className="h-8 bg-[#faff6a] text-[#1a1a18] hover:bg-[#e8ef5a] px-5 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Update
                </Button>
              </div>
            </div>
          </div>

<div className="grid grid-cols-6 gap-3 mb-4">
            <KPICard 
              label="Occupancy" 
              value={kpiData.yourHotel.occupancy.toFixed(1)} 
              suffix="%" 
              // Calculate and pass the comparison change and trend.
              change={((kpiData.yourHotel.occupancy - kpiData.market.occupancy) / (kpiData.market.occupancy || 1)) * 100}
              trend={kpiData.yourHotel.occupancy > kpiData.market.occupancy ? 'up' : 'down'}
              comparisonText="vs market"
            />
            <KPICard 
              label="ADR" 
       currencyCode={currencyCode} // Pass the code instead
              value={kpiData.yourHotel.adr.toFixed(0)} 
              change={((kpiData.yourHotel.adr - kpiData.market.adr) / (kpiData.market.adr || 1)) * 100}
              trend={kpiData.yourHotel.adr > kpiData.market.adr ? 'up' : 'down'}
              comparisonText="vs market"
            />
            <KPICard 
              label="RevPAR" 
         currencyCode={currencyCode} // Pass the code instead
              value={kpiData.yourHotel.revpar.toFixed(0)}
              change={((kpiData.yourHotel.revpar - kpiData.market.revpar) / (kpiData.market.revpar || 1)) * 100}
              trend={kpiData.yourHotel.revpar > kpiData.market.revpar ? 'up' : 'down'}
              comparisonText="vs market"
            />
            <KPICard 
              label="Market Rank" 
              value={revparRank ? `#${revparRank.rank}` : '-'} 
              suffix={revparRank ? `of ${revparRank.total}` : ''} 
            />

            <MiniMetricCard label="Total Revenue" value={formattedTotalRevenue} subtext="This period" />
            {/* This card is updated to show the hardcoded forecast value as requested. */}

         {/* [MODIFIED] This card now uses the 'comingSoon' prop */}
            <MiniMetricCard 
              label="Forecast" 
              value="---" // Set value to placeholder
              subtext="Next 30 days" // Keep subtext
              highlight={true} // Keep highlight for label consistency
              comingSoon={true} // Enable the 'Coming Soon' badge
            />
          </div>

          <div className="grid grid-cols-12 gap-4">
  {/* The main container is now a flexbox column. */}
<div className="col-span-8 flex flex-col gap-4">
              <PerformanceChart 
                data={chartData} 
                metric={comparisonMetric} 
                currencyCode={currencyCode} 
                
                // [NEW] Add the chartType prop.
                // We'll calculate the day difference here and pass the correct type.
                chartType={(() => {
                  const startD = new Date(startDate + 'T00:00:00Z');
                  const endD = new Date(endDate + 'T00:00:00Z');
                  const dayDifference = (endD.getTime() - startD.getTime()) / (1000 * 3600 * 24);
                  // If range is > 60 days, use 'bar'. Otherwise, use 'line'.
                  return dayDifference > 60 ? 'bar' : 'line';
                })()}
              />

              {/* This new wrapper div is crucial.
                  - 'flex-1' tells it to grow and fill the available vertical space.
                  - 'min-h-0' is the key fix: it allows the child (the DataTable) to shrink smaller than its content,
                    which is what enables the child's internal scrolling to activate. */}
        <div className="flex-1 min-h-0">
                <DataTable 
                  data={
                    // Transform the nested tableData into a flat structure for the data table component.
                    tableData.map(d => ({
                      date: new Date(d.date).toLocaleString('en-US', { month: 'short', day: 'numeric' }),
                      yourOccupancy: d.yourHotel.occupancy * 100,
                      yourADR: d.yourHotel.adr,
                      yourRevPAR: d.yourHotel.revpar,
                      marketOccupancy: d.market.occupancy * 100,
                      marketADR: d.market.adr,
                      marketRevPAR: d.market.revpar,
                    }))
                  } 
                  comparisonMetric={comparisonMetric}
                  currencyCode={currencyCode} // [NEW] Pass the currencyCode prop
                />
              </div>
            </div>

            <div className="col-span-4 space-y-4">

              <InsightsCard 
                kpiData={kpiData}
                currencyCode={currencyCode}
              />
<MarketRankingCard rankings={rankingData} />
<MarketCompositionCard 
                competitorCount={marketCompositionData.competitorCount}
                totalRooms={marketCompositionData.totalRooms}
                breakdown={marketCompositionData.breakdown}
              />
            </div>
          </div>
        </div>
      )}

    {activeView === 'reports' && (
    <div className="p-6">
      {/* Use the new state to show the ReportSelector first */}
{!selectedReportType ? (
        <ReportSelector onSelectReport={setSelectedReportType} />
      ) : (
        <>
          {/* Breadcrumb / Back to Selection */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedReportType(null)} // Add a back button
                className="text-[#9ca3af] hover:text-[#faff6a] text-sm mb-2 flex items-center gap-2 transition-colors"
              >
                <span>←</span>
                <span>Back to Report Selection</span>
              </button>
        <h1 className="text-white text-2xl mb-1">
                {/* Dynamically set the title based on the selected report */}
                {selectedReportType === 'performance-metrics' && 'Performance Metrics Report'}
                {selectedReportType === 'year-on-year' && 'Year-on-Year Comparison Report'}
                {selectedReportType === 'guest-source-countries' && 'Guest Source Countries Report'}
                {selectedReportType === 'financial-transactions' && 'Financial Transactions Report'}
              </h1>
<p className="text-[#9ca3af] text-sm">
            {/* Add dynamic descriptions */}
            {selectedReportType === 'performance-metrics' && 'Comprehensive analysis of occupancy, ADR, RevPAR, and market comparisons'}
            {selectedReportType === 'year-on-year' && 'Side-by-side performance comparison with variance analysis'}
            {selectedReportType === 'guest-source-countries' && 'Geographic breakdown of guest origins and booking patterns'}
            {selectedReportType === 'financial-transactions' && 'Detailed financial reporting and transaction analysis'}
          </p>
        </div>


        {/* [MOVED] Conditionally show ReportActions for the YoY report to align with the header */}
        {selectedReportType === 'year-on-year' && (
          <ReportActions
            // [MODIFIED] Wire up the new export handler
            onExportCSV={() => handleYoyExport('csv')}
            onExportExcel={() => handleYoyExport('xlsx')}
            // Scheduling will work because it just saves the *report settings*
            onCreateSchedule={() => setShowCreateSchedule(true)}
            onManageSchedules={() => setShowManageSchedules(true)}
          />
        )}
      </div>

          {/* Report Builder - Only show for 'performance-metrics' for now */}
          {selectedReportType === 'performance-metrics' && (
            <>
<div className="space-y-5 mb-6">
            <ReportControls
              startDate={reportStartDate}
              endDate={reportEndDate}
              setStartDate={setReportStartDate}
              setEndDate={setReportEndDate}
              datePreset={reportDatePreset}
              setDatePreset={setReportDatePreset}
              granularity={reportGranularity}
              setGranularity={setReportGranularity}
              onRunReport={handleRunReport}
              isLoading={reportIsLoading}
            />

            {/* Add the MetricSelector and FormattingOptions back in */}
            <div className="bg-[#262626] rounded border border-[#3a3a35] p-5">
              <div className="grid grid-cols-2 gap-6">
                <MetricSelector
                  selectedMetrics={selectedMetrics}
                  onToggleMetric={handleToggleMetric}
                />
                <div className="flex items-end justify-end">
                  <FormattingOptions
                    displayTotals={displayTotals}
                    setDisplayTotals={setDisplayTotals}
                    taxInclusive={taxInclusive}
                    setTaxInclusive={setTaxInclusive}
                    showMarketComparisons={showMarketComparisons}
                    setShowMarketComparisons={setShowMarketComparisons}
                    tableLayout={tableLayout}
                    setTableLayout={setTableLayout}
                  />
                </div>
              </div>
            </div>
          </div>

              {/* Report Actions */}
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-[#e5e5eS] text-lg">Report Output</h2>
<ReportActions
onExportCSV={() => {
  if (reportData.length === 0) {
    toast.error("No report data to export.");
   return;
    }

    // --- [NEW] Dynamic Filename Logic ---
    // Helper to format YYYY-MM-DD to DD-MM-YYYY
    const formatDateForFilename = (dateString: string) => {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateString; // Fallback
    };

    // Find the property's original name
    const propertyName = properties.find(p => p.property_id.toString() === property)?.property_name || 'Report';

    // Build the new filename
    const fileName = `${propertyName} ${formatDateForFilename(reportStartDate)} to ${formatDateForFilename(reportEndDate)} Performance Report.csv`;
    // --- [END] Dynamic Filename Logic ---

    // --- [NEW] Formatting Logic ---

  // 1. Create a currency formatter that matches your request

  // --- [NEW] Formatting Logic ---

  // 1. Create a currency formatter that matches your request
  const currencyFormatter = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // 2. Map the raw reportData to a new formattedData array
  const formattedData = reportData.map(row => {
    const newRow: { [key: string]: any } = {};

    // Loop over all keys in the raw data row
    for (const key in row) {
      const value = row[key];

      if (key === 'period') {
        // Format 'period' as 'Date' with 'DD-MM-YYYY'
        const date = new Date(value);
        newRow['Date'] = `${date.getUTCDate().toString().padStart(2, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCFullYear()}`;

      } else if (key.includes('occupancy')) {
        // Format occupancy as a percentage
        const num = parseFloat(value);
        newRow[key] = isNaN(num) ? '-' : `${(num * 100).toFixed(1)}%`;

      } else if (key.includes('adr') || key.includes('revpar') || key.includes('revenue')) {
        // Format all monetary values with the currency formatter
        newRow[key] = currencyFormatter(value);

      } else {
        // Include other columns as-is (like 'rooms-sold')
        newRow[key] = value;
      }
    }
    return newRow;
  });
  // --- [END] Formatting Logic ---

  // 3. Use the new formattedData to create the sheet
const ws = XLSX.utils.json_to_sheet(formattedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, fileName); // [MODIFIED] Use dynamic filename
}}
onExportExcel={() => {
  if (reportData.length === 0) {
    toast.error("No report data to export.");
return;
    }

    // --- [NEW] Dynamic Filename Logic ---
    // Helper to format YYYY-MM-DD to DD-MM-YYYY
    const formatDateForFilename = (dateString: string) => {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateString; // Fallback
    };

    // Find the property's original name
    const propertyName = properties.find(p => p.property_id.toString() === property)?.property_name || 'Report';

    // Build the new filename
    const fileName = `${propertyName} ${formatDateForFilename(reportStartDate)} to ${formatDateForFilename(reportEndDate)} Performance Report.xlsx`;
    // --- [END] Dynamic Filename Logic ---

    // --- [NEW] Formatting Logic (Repeated for Excel) ---

  // 1. Create a currency formatter
  const currencyFormatter = (value: any) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // 2. Map the raw reportData to a new formattedData array
  const formattedData = reportData.map(row => {
    const newRow: { [key: string]: any } = {};

    for (const key in row) {
      const value = row[key];

      if (key === 'period') {
        // Format 'period' as 'Date' with 'DD-MM-YYYY'
        const date = new Date(value);
        newRow['Date'] = `${date.getUTCDate().toString().padStart(2, '0')}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-${date.getUTCFullYear()}`;

      } else if (key.includes('occupancy')) {
        // Format occupancy as a percentage
        const num = parseFloat(value);
        newRow[key] = isNaN(num) ? '-' : `${(num * 100).toFixed(1)}%`;

      } else if (key.includes('adr') || key.includes('revpar') || key.includes('revenue')) {
        // Format all monetary values
        newRow[key] = currencyFormatter(value);

      } else {
        // Include other columns as-is
        newRow[key] = value;
      }
    }
    return newRow;
  });
// --- [END] Formatting Logic ---

  // 3. Use the new formattedData to create the sheet
  const ws = XLSX.utils.json_to_sheet(formattedData);

  // --- [NEW] Column Width Logic ---
  // Get the headers from the first row of formatted data
  const headers = Object.keys(formattedData[0]);
  // Calculate max width for each column
  const colWidths = headers.map((header) => {
    // Start with the header length
    let maxLen = header.length;
    // Check each row for this column's content length
    formattedData.forEach(row => {
      const cellValue = row[header];
      if (cellValue != null && cellValue.toString().length > maxLen) {
        maxLen = cellValue.toString().length;
      }
    });
    // Return width object for xlsx library (wch = "character width")
    return { wch: maxLen + 2 }; // +2 for a little padding
  });
  // Apply the calculated widths to the worksheet
  ws['!cols'] = colWidths;
  // --- [END] Column Width Logic ---

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, fileName); // [MODIFIED] Use dynamic filename
}}
onCreateSchedule={() => setShowCreateSchedule(true)}
onManageSchedules={() => setShowManageSchedules(true)}
/>
              </div>

              {/* Report Table */}
              <ReportTable
                startDate={reportStartDate}
                endDate={reportEndDate}
                granularity={reportGranularity}
                selectedMetrics={selectedMetrics}
                displayTotals={displayTotals}
                showMarketComparisons={showMarketComparisons}
                taxInclusive={taxInclusive}
                tableLayout={tableLayout}
                data={reportData}
    currencyCode={currencyCode} // Pass the code instead
              />
            </>
          )}


{/* [NEW] Render the Year-on-Year Report */}
      {selectedReportType === 'year-on-year' && (
        <>
 {/* [REMOVED] The ReportActions block was moved to the page header */}

        {/* Render the new self-contained report component. */}
              <YearOnYearReport
                ref={yoyReportRef} // [NEW] Attach the ref
                // We pass the global propertyId
                propertyId={property}
                // We pass the currencyCode for formatting
                currencyCode={currencyCode}
              />
            </>
          )}

          {/* Placeholder for 'Guest Source Countries Report' */}
          {selectedReportType === 'guest-source-countries' && (
            <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-8 text-center">
              <h3 className="text-[#e5e5e5] text-xl mb-2">Guest Source Countries Report</h3>
              <p className="text-[#9ca3af]">
                Configuration for this report is not yet implemented.
              </p>
            </div>
          )}

          {/* Placeholder for 'Financial Transactions Report' */}
          {selectedReportType === 'financial-transactions' && (
            <div className="bg-[#1a1a18] border border-[#3a3a35] rounded-lg p-8 text-center">
              <h3 className="text-[#e5e5e5] text-xl mb-2">Financial Transactions Report</h3>
              <p className="text-[#9ca3af]">
                Configuration for this report is not yet implemented.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )}

{activeView === 'admin' && (
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-white text-2xl mb-2">Admin Dashboard</h1>
            <p className="text-[#9ca3af] text-sm">System management, property onboarding, and API diagnostics</p>
          </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
              {/* Pass the new props to SystemHealth */}
              <SystemHealth
                propertyId={adminSelectedPropertyId}
                lastRefreshTime={lastUpdatedAt}
                onRefreshData={fetchLastRefreshTime}
              />
        {/* Pass the scheduled reports list as a prop */}
              <ManualReportTrigger reports={scheduledReports} />
            </div>
{/* Pass the new allHotels state as a prop to the table component */}
            <HotelManagementTable 
              hotels={allHotels} 
              onManageCompSet={handleManageCompSet} 
              // [NEW] Pass the new handler and the list of groups
              onManagementChange={handleManagementChange}
              managementGroups={managementGroups}
            />
       <MewsOnboarding />

        {/* Add the API Target Property Selector just above the API Explorer */}
        <div className="bg-[#262626] rounded border border-[#3a3a35] p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[#e5e5e5]">
              API Target Property:
            </label>
            <Select 
              value={adminSelectedPropertyId} 
              onValueChange={setAdminSelectedPropertyId}
            >
              <SelectTrigger className="w-72 h-9 bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5]">
                <SelectValue placeholder="Select a property..." />
              </SelectTrigger>
              <SelectContent className="bg-[#262626] border-[#3a3a35] text-[#e5e5e5]">
                {allHotels.map((hotel) => (
                  <SelectItem 
                    key={hotel.hotel_id} 
                    value={hotel.hotel_id.toString()}
                  >
                    {hotel.property_name} ({hotel.pms_type || 'N/A'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[#9ca3af] text-xs">
              Select the property to use for API tests and the API Explorer.
            </p>
          </div>
        </div>
{/* Pass the selected property ID to the API explorer as well */}
            <CloudbedsAPIExplorer propertyId={adminSelectedPropertyId} />
          </div>
        </div>
      )}



{activeView === 'settings' && (
        // [MODIFIED] Render the new SettingsPage component
        // and pass the new props for the profile tab
<SettingsPage
          userInfo={userInfo}
          onUpdateProfile={handleUpdateProfile}
          onInviteUser={() => setShowInviteUser(true)}
          onGrantAccess={() => setShowGrantAccess(true)}
          onRemoveUser={handleRemoveUser}
          teamMembers={teamMembers} // Pass the team members list
          properties={properties} // [NEW] Pass the user's properties list
        />
      )}

      {/* [NEW] Added the Support Page to the main app layout */}
      {activeView === 'support' && (
        <SupportPage 
          // Use the state-driven 'onBack' logic to return to the previous view
          onBack={() => setActiveView(previousView || 'dashboard')} 
        />
      )}

      {activeView === 'market' && (
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
      )}



      {activeView === 'setup' && (
        <div className="p-6">
          <div className="mb-6 text-center">
            <h1 className="text-white text-2xl mb-2">Property Setup Demo</h1>
            <p className="text-[#9ca3af] text-sm">Click the button below to open the setup modal</p>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => setShowPropertySetup(true)}
              className="bg-[#faff6a] text-[#1f1f1c] px-6 py-3 rounded hover:bg-[#e8ef5a]"
            >
              Open Property Setup Modal
            </button>
          </div>
        </div>
      )}
 {/* [NEW] Render the Budgeting page */}
      {activeView === 'budget' && (
        // [MODIFIED] Pass the selected property ID
        <Budgeting propertyId={property} />
      )}
{activeView === 'rockenue' && (
        <>
          {rockenueSubView === 'hub' && (
            <RockenueHub
              onNavigateToTool={(toolId) => {
                // [MODIFIED] Handle navigation for both tools
                if (toolId === 'shreeji-report') {
                  setRockenueSubView('shreeji-report');
                } else if (toolId === 'portfolio-overview') {
                  setRockenueSubView('portfolio-overview');
                }
              }}
            />
          )}
          {rockenueSubView === 'shreeji-report' && (
            <div>
              <div className="p-4 border-b border-[#3a3a35] bg-[#262626]">
                <button
                  onClick={() => setRockenueSubView('hub')}
                  className="text-[#9ca3af] hover:text-[#faff6a] text-sm transition-colors"
                >
                  ← Back to Rockenue Tools
                </button>
              </div>
              <ShreejiReport />
            </div>
          )}
          {/* [NEW] Add the render block for the Portfolio Overview */}
          {rockenueSubView === 'portfolio-overview' && (
            <div>
              <div className="p-4 border-b border-[#3a3a35] bg-[#262626]">
                <button
                  onClick={() => setRockenueSubView('hub')}
                  className="text-[#9ca3af] hover:text-[#faff6a] text-sm transition-colors"
                >
                  ← Back to Rockenue Tools
                </button>
              </div>
              <PortfolioOverview />
            </div>
          )}
        </>
      )}


      {/* Modals */}
      <CreateScheduleModal open={showCreateSchedule} onClose={() => setShowCreateSchedule(false)} onSave={handleSaveSchedule} />
      <ManageSchedulesModal open={showManageSchedules} onClose={() => setShowManageSchedules(false)} schedules={schedules} onDelete={handleDeleteSchedule} />
     <ManageCompSetModal 
        open={showCompSetModal} 
        onClose={() => setShowCompSetModal(false)} 
        // Pass the hotel's ID
        hotelId={selectedHotelForCompSet.id}
        hotelName={selectedHotelForCompSet.name} 
        // Pass the full list of hotels
        allHotels={allHotels}
      />
<InviteUserModal open={showInviteUser} onClose={() => setShowInviteUser(false)} />
      <GrantAccessModal open={showGrantAccess} onClose={() => setShowGrantAccess(false)} />
<PropertyClassificationModal 
        isOpen={showPropertySetup} // [MODIFIED] Prop renamed
        onClose={() => setShowPropertySetup(false)} // [NEW] Wire up onClose
        onComplete={handlePropertySetupComplete} // [NEW] Use the new handler
      />
      
      {/* Add the Toaster component here. It's invisible but necessary for toasts to appear. */}
{/* We add theme="dark" to match the application's style. */}
{/* [MODIFIED] Removed the 'richColors' prop to use the neutral styles from components/ui/sonner.tsx */}


<Toaster 
  theme="dark" 
  position="top-center" 
  toastOptions={{
    // Add an inline style to the toast itself
    style: { zIndex: 9999 } 
  }} 
/>
    </div>
    ) // [NEW] This closes the conditional render from `activeView && (`
  );
}