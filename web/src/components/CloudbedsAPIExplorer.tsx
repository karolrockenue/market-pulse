import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { useState } from 'react';
import { Code, Play, Copy, CheckCircle2, Info, Database, Calendar, BarChart3, Settings2, Building2, Users, CreditCard, DoorOpen, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// Props interface to accept the propertyId from App.tsx
interface CloudbedsAPIExplorerProps {
  propertyId: string;
}

export function CloudbedsAPIExplorer({ propertyId }: CloudbedsAPIExplorerProps) {

  const [datasetId, setDatasetId] = useState('');
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-30');
  const [groupBy, setGroupBy] = useState<string[]>(['date']);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [apiResponse, setApiResponse] = useState('');
  const [availableMetrics, setAvailableMetrics] = useState<any[]>([]);
  const [availableDimensions, setAvailableDimensions] = useState<any[]>([]);
  const [structureLoaded, setStructureLoaded] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [loadingEndpoint, setLoadingEndpoint] = useState<string | null>(null);
const [copied, setCopied] = useState(false);
const [isLoading, setIsLoading] = useState(false); // Add this missing state variable

  // --- Function to call the backend API wrapper ---
  const callApiExplorer = async (endpointSlug: string, params: Record<string, string> = {}, buttonIdentifier?: string) => {
    // Use the propertyId from props
    if (!propertyId) { 
      toast.error('Please select an API Target Property first.');
      return;
    }

    setIsLoading(true);
    setLoadingEndpoint(buttonIdentifier || endpointSlug);
    setApiResponse('Fetching data...');

    // Construct query parameters, always including propertyId from props
    const queryParams = new URLSearchParams({
      ...params,
      propertyId: propertyId, // Use the prop here
    });

    try {
      // Call the backend wrapper
      const response = await fetch(`/api/admin/explore/${endpointSlug}?${queryParams.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        // Try to get a specific error message
        const errorMessage = data?.error || data?.cloudbeds?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }
      
      setApiResponse(JSON.stringify(data, null, 2)); // Pretty print JSON

      // Special handling for dataset structure response - needed to populate selectors
      if (endpointSlug === 'dataset-structure' && data?.cdfs) {
         // --- Logic to populate selectors ---
// --- Logic to populate selectors ---
     // The raw columns from the API include name, column, kind, label, and description
     const allColumns: { name: string; column: string; kind: string; label: string; description: string }[] = data.cdfs.flatMap((category: any) => category.cdfs);
     const metricKinds = ["DynamicCurrency", "Currency", "DynamicPercentage", "Number"];
     const dimensionKinds = ["String", "Date", "Identifier", "Boolean"];

     // Map all fields required by the JSX (label, column, name, kind)
     setAvailableMetrics(allColumns
       .filter(col => metricKinds.includes(col.kind))
       .map(col => ({ 
         name: col.name, 
         column: col.column, 
         label: col.label, // Pass label to state
         type: col.kind    // Pass kind as 'type' to state
       }))
     );

     // Map all fields required by the JSX (label, column, description)
     setAvailableDimensions(allColumns
       .filter(col => dimensionKinds.includes(col.kind))
       .map(col => ({
         name: col.name,
         column: col.column,
         label: col.label,         // Pass label to state
         description: col.description // Pass description to state
       }))
     );

     setStructureLoaded(true); // Mark structure as loaded
     toast.success('Dataset structure loaded');
     // --- End logic to populate selectors ---
      } else if (endpointSlug === 'dataset-structure') {
          // Handle case where structure load succeeded but data format was unexpected
          setStructureLoaded(false);
          toast.warning('Structure loaded, but no fields found to populate selectors.');
      } else {
         toast.success('API call successful'); // General success message for other endpoints
      }

    } catch (error: any) {
      setApiResponse(`Error: ${error.message}`);
      toast.error(`API Call Failed: ${error.message}`);
      // Ensure structure-dependent UI resets on error
      if (endpointSlug === 'dataset-structure') {
          setStructureLoaded(false);
          setAvailableMetrics([]);
          setAvailableDimensions([]);
      }
    } finally {
      setIsLoading(false);
      setLoadingEndpoint(null);
    }
  };

const datasets = [
  { id: '1', name: 'Financial', description: 'Financial data and transactions' },
  { id: '2', name: 'Guests', description: 'Guest profile and stay information' },
  { id: '3', name: 'Reservations', description: 'Booking data and reservation details' },
  { id: '5', name: 'Payment', description: 'Payment processing and history' },
  { id: '6', name: 'Invoices', description: 'Guest invoices and billing' },
  { id: '7', name: 'Occupancy', description: 'Daily occupancy, ADR, RevPAR metrics' },
  { id: '8', name: 'Housekeeping', description: 'Room status and housekeeping data' },
  { id: '10', name: 'Payout', description: 'Payout and reconciliation data' },
];

const handleFetchStructure = () => {
    if (!datasetId) {
      toast.error('Please select a dataset first');
      return;
    }
    setLoadingStructure(true); // Keep this for the specific button spinner
    
    // Reset selections and clear old structure data
    setSelectedMetrics([]);
    setGroupBy([]);
    setAvailableMetrics([]);
    setAvailableDimensions([]);
    setStructureLoaded(false); // Mark as not loaded until API confirms

    // Call the real API function
    callApiExplorer('dataset-structure', { id: datasetId }, 'fetch-structure-btn')
      .finally(() => setLoadingStructure(false)); // Turn off specific spinner
  };

const handleGetInsightsData = () => {
    if (selectedMetrics.length === 0) {
      toast.error('Please select at least one metric');
      return;
    }
    
    // Prepare params for the API call
    const params: Record<string, string> = {
      id: datasetId,
      columns: selectedMetrics.join(','), // Join selected metric columns
    };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (groupBy.length > 0) params.groupBy = groupBy.join(','); // Join selected dimension columns

    // Call the real API function
    callApiExplorer('insights-data', params, 'fetch-insights-data-btn');
  };

  const handleGeneralEndpoint = (endpoint: string) => { // 'endpoint' here is the button text
    // --- Map button text back to endpoint slugs ---
    // (This mapping needs to be maintained if button text changes)
const generalEndpointsMap: Record<string, string> = {
      'Get Hotel Info': 'sample-hotel',
      'Get Sample Guest': 'sample-guest',
      'Get Taxes & Fees': 'taxes-fees',
      'Get Room Types': 'sample-room',
      'Get Rate Plans': 'sample-rate', // Placeholder, confirm if backend supports 'sample-rate' slug
      'Get Amenities': 'user-info', // Placeholder, confirm if backend supports 'user-info' or similar slug
      'Get Webhooks': 'get-webhooks',
      'Create Test Webhook': 'create-test-webhook',
      // Add other mappings as needed
    };
    const endpointSlug = generalEndpointsMap[endpoint];
    // --- End Mapping ---

    if (endpointSlug) {
      // Pass the button text as the identifier for loading state
      callApiExplorer(endpointSlug, {}, endpoint); 
    } else {
      toast.error(`Endpoint mapping not found for: ${endpoint}`);
      setApiResponse(`Error: No backend route configured for "${endpoint}"`);
    }
  };

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(apiResponse);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

const handleMetricToggle = (metricColumn: string) => { // Use column name now
  setSelectedMetrics(prev => 
    prev.includes(metricColumn) 
      ? prev.filter(m => m !== metricColumn)
      : [...prev, metricColumn]
  );
};

// Add the missing handler for 'Group By' toggles
const handleDimensionToggle = (dimensionColumn: string) => {
  setGroupBy(prev =>
    prev.includes(dimensionColumn)
      ? prev.filter(d => d !== dimensionColumn)
      : [...prev, dimensionColumn]
  );
};

  const generalEndpointCategories = [
    {
      name: 'Property',
      icon: Building2,
      endpoints: ['Get Hotel Info'],
    },
    {
      name: 'Guest Data',
      icon: Users,
      endpoints: ['Get Sample Guest'],
    },

{
      name: 'Configuration',
      icon: Settings2,
      endpoints: ['Get Taxes & Fees', 'Get Room Types', 'Get Rate Plans', 'Get Amenities', 'Get Webhooks', 'Create Test Webhook'],
    },
  ];

  return (
    <div className="bg-[#2C2C2C] rounded border border-[#3a3a35] overflow-hidden">
      {/* Header with Property Selection */}
      <div className="px-6 py-4 border-b border-[#3a3a35] bg-gradient-to-r from-[#2a2a26] to-[#2C2C2C]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-5 h-5 text-[#faff6a]" />
              <h2 className="text-[#e5e5e5]">Cloudbeds API Explorer</h2>
            </div>
            <p className="text-[#9ca3af] text-sm">
              Test and debug Cloudbeds API calls using stored property credentials
            </p>
          </div>
          <div className="w-80">
            <label className="text-[#9ca3af] text-xs mb-2 block uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              API Target Property
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-[#6b7280] cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] max-w-xs">
                    <p className="text-xs">All API calls will use the credentials stored for this property</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </label>
{/* Display the propertyId passed from App.tsx */}
            {/* We make it look like a trigger but it's not interactive here */}
            <div className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] h-10 flex items-center px-3 rounded text-sm truncate">
              {propertyId ? `Using Property ID: ${propertyId}` : 'No Target Property Selected'}
            </div>
            {/* Actual Select component removed as selection is handled in App.tsx */}
          </div>
        </div>
      </div>

      <Tabs defaultValue="insights" className="w-full">
        <div className="px-6 border-b border-[#3a3a35]">
          <TabsList className="bg-transparent h-12 p-0">
            <TabsTrigger 
              value="insights"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#faff6a] data-[state=active]:text-[#faff6a] rounded-none px-6 text-[#9ca3af] data-[state=active]:text-[#faff6a]"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Insights API
            </TabsTrigger>
            <TabsTrigger 
              value="general"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#faff6a] data-[state=active]:text-[#faff6a] rounded-none px-6 text-[#9ca3af] data-[state=active]:text-[#faff6a]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              General API
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Insights API Tab */}
        <TabsContent value="insights" className="p-6 m-0">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Panel - Configuration */}
            <div className="space-y-5">
              {/* Step 1: Select Dataset */}
              <div className="bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center text-xs">1</div>
                  <h3 className="text-[#e5e5e5]">Select Dataset</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-[#6b7280] cursor-help ml-auto" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] max-w-xs">
                        <p className="text-xs">Dataset IDs identify specific data collections in the Insights API. Common examples: 7 (Occupancy/Revenue), 12 (Reservations)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="space-y-3">
                  {datasets.map(ds => (
                    <div
                      key={ds.id}
                      onClick={() => {
                        setDatasetId(ds.id);
                        setStructureLoaded(false);
                        setAvailableMetrics([]);
                        setAvailableDimensions([]);
                        setSelectedMetrics([]);
                      }}
                      className={`p-3 rounded border cursor-pointer transition-all ${
                        datasetId === ds.id
                          ? 'border-[#faff6a] bg-[#faff6a]/10'
                          : 'border-[#3a3a35] hover:border-[#4a4a45] bg-[#2C2C2C]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#e5e5e5] text-sm">{ds.name}</span>
                            <Badge variant="outline" className="text-xs border-[#3a3a35] text-[#9ca3af]">
                              ID: {ds.id}
                            </Badge>
                          </div>
                          <p className="text-[#9ca3af] text-xs mt-1">{ds.description}</p>
                        </div>
                        {datasetId === ds.id && (
                          <CheckCircle2 className="w-4 h-4 text-[#faff6a] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button
                  onClick={handleFetchStructure}
                  disabled={!datasetId || loadingStructure}
                  className="w-full mt-4 bg-[#3a3a35] text-[#e5e5e5] hover:bg-[#4a4a45] border border-[#4a4a45]"
                  variant="outline"
                >
                  {loadingStructure ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading Structure...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Fetch Structure & Fields
                    </>
                  )}
                </Button>
              </div>

              {/* Step 2: Configure Parameters */}
              {structureLoaded && (
                <div className="bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center text-xs">2</div>
                    <h3 className="text-[#e5e5e5]">Configure Parameters</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#9ca3af] text-xs mb-1.5 block flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Start Date
                        </label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[#9ca3af] text-xs mb-1.5 block flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          End Date
                        </label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[#9ca3af] text-xs mb-1.5 block flex items-center gap-1.5">
                        Group By (Dimensions)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-[#6b7280] cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-[#1f1f1c] border-[#3a3a35] text-[#e5e5e5] max-w-xs">
                              <p className="text-xs">Select one or more dimensions to group your data by. For example, grouping by 'date' gives you daily breakdowns.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <div className="bg-[#2C2C2C] rounded p-2.5 space-y-1.5 max-h-32 overflow-y-auto border border-[#3a3a35]">
                        {availableDimensions.map(dimension => (
                      <label key={dimension.column} className="flex items-start gap-2 cursor-pointer group"> {/* Use column as key */}
                       <input
                              type="checkbox"
                         
                              checked={groupBy.includes(dimension.column)} 
                              onChange={() => handleDimensionToggle(dimension.column)} 
                              className="mt-0.5 rounded border-[#3a3a35] text-[#faff6a] focus:ring-[#faff6a]"
                            />
                            <div className="flex-1">
                              <span className="text-[#e5e5e5] text-sm group-hover:text-[#faff6a] transition-colors">{dimension.label}</span>
                              <p className="text-[#6b7280] text-xs">{dimension.description}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Select Metrics */}
              {structureLoaded && (
                <div className="bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center text-xs">3</div>
                    <h3 className="text-[#e5e5e5]">Select Metrics</h3>
                    <Badge variant="outline" className="ml-auto text-xs border-[#3a3a35] text-[#9ca3af]">
                      {selectedMetrics.length} selected
                    </Badge>
                  </div>
                  
                  <div className="bg-[#2C2C2C] rounded p-2.5 space-y-1.5 max-h-56 overflow-y-auto border border-[#3a3a35]">
                   {availableMetrics.map(metric => (
                <label key={metric.column} className="flex items-start gap-2 cursor-pointer group"> {/* Use column as key */}
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(metric.column)} 
                          onChange={() => handleMetricToggle(metric.column)} 
                          className="mt-0.5 rounded border-[#3a3a35] text-[#faff6a] focus:ring-[#faff6a]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[#e5e5e5] text-sm group-hover:text-[#faff6a] transition-colors">{metric.label}</span>
                            <Badge variant="outline" className="text-xs border-[#3a3a35] text-[#6b7280]">
                              {metric.type}
                            </Badge>
                          </div>
                          <code className="text-[#9ca3af] text-xs">{metric.name}</code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Execute */}
              {structureLoaded && (
                <div className="bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[#faff6a] text-[#1f1f1c] flex items-center justify-center text-xs">4</div>
                    <h3 className="text-[#e5e5e5]">Execute Query</h3>
                  </div>
                  
                  <Button
                    onClick={handleGetInsightsData}
                    disabled={selectedMetrics.length === 0}
                    className="w-full bg-[#faff6a] text-[#1f1f1c] hover:bg-[#e8ef5a]"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Get Insights Data
                  </Button>
                </div>
              )}
            </div>

            {/* Right Panel - API Response */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" />
                  API Response
                </label>
                {apiResponse && (
                  <Button
                    onClick={handleCopyResponse}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[#9ca3af] hover:text-[#faff6a] hover:bg-[#3a3a35]"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Textarea
                value={apiResponse}
                readOnly
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#10b981] font-mono text-xs flex-1 resize-none"
                placeholder="Select a dataset and fetch its structure to begin..."
                style={{ minHeight: '600px' }}
              />
            </div>
          </div>
        </TabsContent>

        {/* General API Tab */}
        <TabsContent value="general" className="p-6 m-0">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Panel - Endpoints */}
            <div className="space-y-4">
              <div className="bg-[#1f1f1c] rounded-lg p-4 border border-[#3a3a35]">
                <h3 className="text-[#e5e5e5] mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#faff6a]" />
                  Quick Endpoint Tests
                </h3>
                <p className="text-[#9ca3af] text-xs mb-4">
                  Click any endpoint below to make a direct API call to Cloudbeds
                </p>

                <div className="space-y-4">
                  {generalEndpointCategories.map(category => (
                    <div key={category.name}>
                      <div className="flex items-center gap-2 mb-2">
                        <category.icon className="w-4 h-4 text-[#9ca3af]" />
                        <h4 className="text-[#9ca3af] text-xs uppercase tracking-wider">{category.name}</h4>
                      </div>
                      <div className="space-y-2">
                        {category.endpoints.map(endpoint => (
                          <Button
                            key={endpoint}
                            onClick={() => handleGeneralEndpoint(endpoint)}
                            disabled={loadingEndpoint === endpoint}
                            variant="outline"
                            className="w-full bg-[#2C2C2C] border-[#3a3a35] text-[#e5e5e5] hover:bg-[#3a3a35] hover:border-[#faff6a] justify-start h-auto py-3 group"
                          >
                            {loadingEndpoint === endpoint ? (
                              <Loader2 className="w-4 h-4 mr-2.5 flex-shrink-0 animate-spin text-[#faff6a]" />
                            ) : (
                              <Play className="w-4 h-4 mr-2.5 flex-shrink-0 text-[#9ca3af] group-hover:text-[#faff6a] transition-colors" />
                            )}
                            <span className="text-sm">{endpoint}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel - API Response */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" />
                  API Response
                </label>
                {apiResponse && (
                  <Button
                    onClick={handleCopyResponse}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[#9ca3af] hover:text-[#faff6a] hover:bg-[#3a3a35]"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Textarea
                value={apiResponse}
                readOnly
                className="bg-[#1f1f1c] border-[#3a3a35] text-[#10b981] font-mono text-xs flex-1 resize-none"
                placeholder="Click any endpoint button to test the API..."
                style={{ minHeight: '600px' }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}