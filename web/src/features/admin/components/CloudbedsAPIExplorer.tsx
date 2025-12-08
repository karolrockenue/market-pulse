import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Code,
  Play,
  Copy,
  CheckCircle2,
  Info,
  Database,
  Calendar,
  BarChart3,
  Settings2,
  Building2,
  Users,
  CreditCard,
  DoorOpen,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Props interface to accept the propertyId from App.tsx
interface CloudbedsAPIExplorerProps {
  propertyId: string;
}

export function CloudbedsAPIExplorer({
  propertyId,
}: CloudbedsAPIExplorerProps) {
  const [datasetId, setDatasetId] = useState("");
  const [startDate, setStartDate] = useState("2025-09-01");
  const [endDate, setEndDate] = useState("2025-09-30");
  const [groupBy, setGroupBy] = useState<string[]>(["date"]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [apiResponse, setApiResponse] = useState("");
  const [availableMetrics, setAvailableMetrics] = useState<any[]>([]);
  const [availableDimensions, setAvailableDimensions] = useState<any[]>([]);
  const [structureLoaded, setStructureLoaded] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [loadingEndpoint, setLoadingEndpoint] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Add this missing state variable

  // --- Function to call the backend API wrapper ---
  const callApiExplorer = async (
    endpointSlug: string,
    params: Record<string, string> = {},
    buttonIdentifier?: string
  ) => {
    // Use the propertyId from props
    if (!propertyId) {
      toast.error("Please select an API Target Property first.");
      return;
    }

    setIsLoading(true);
    setLoadingEndpoint(buttonIdentifier || endpointSlug);
    setApiResponse("Fetching data...");

    // Construct query parameters, always including propertyId from props
    const queryParams = new URLSearchParams({
      ...params,
      propertyId: propertyId, // Use the prop here
    });

    try {
      // Call the backend wrapper
      const response = await fetch(
        `/api/admin/explore/${endpointSlug}?${queryParams.toString()}`
      );
      const data = await response.json();

      if (!response.ok) {
        // Try to get a specific error message
        const errorMessage =
          data?.error ||
          data?.cloudbeds?.message ||
          `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      setApiResponse(JSON.stringify(data, null, 2)); // Pretty print JSON

      // Special handling for dataset structure response - needed to populate selectors
      if (endpointSlug === "dataset-structure" && data?.cdfs) {
        // --- Logic to populate selectors ---
        // --- Logic to populate selectors ---
        // The raw columns from the API include name, column, kind, label, and description
        const allColumns: {
          name: string;
          column: string;
          kind: string;
          label: string;
          description: string;
        }[] = data.cdfs.flatMap((category: any) => category.cdfs);
        const metricKinds = [
          "DynamicCurrency",
          "Currency",
          "DynamicPercentage",
          "Number",
        ];
        const dimensionKinds = ["String", "Date", "Identifier", "Boolean"];

        // Map all fields required by the JSX (label, column, name, kind)
        setAvailableMetrics(
          allColumns
            .filter((col) => metricKinds.includes(col.kind))
            .map((col) => ({
              name: col.name,
              column: col.column,
              label: col.label, // Pass label to state
              type: col.kind, // Pass kind as 'type' to state
            }))
        );

        // Map all fields required by the JSX (label, column, description)
        setAvailableDimensions(
          allColumns
            .filter((col) => dimensionKinds.includes(col.kind))
            .map((col) => ({
              name: col.name,
              column: col.column,
              label: col.label, // Pass label to state
              description: col.description, // Pass description to state
            }))
        );

        setStructureLoaded(true); // Mark structure as loaded
        toast.success("Dataset structure loaded");
        // --- End logic to populate selectors ---
      } else if (endpointSlug === "dataset-structure") {
        // Handle case where structure load succeeded but data format was unexpected
        setStructureLoaded(false);
        toast.warning(
          "Structure loaded, but no fields found to populate selectors."
        );
      } else {
        toast.success("API call successful"); // General success message for other endpoints
      }
    } catch (error: any) {
      setApiResponse(`Error: ${error.message}`);
      toast.error(`API Call Failed: ${error.message}`);
      // Ensure structure-dependent UI resets on error
      if (endpointSlug === "dataset-structure") {
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
    {
      id: "1",
      name: "Financial",
      description: "Financial data and transactions",
    },
    {
      id: "2",
      name: "Guests",
      description: "Guest profile and stay information",
    },
    {
      id: "3",
      name: "Reservations",
      description: "Booking data and reservation details",
    },
    { id: "5", name: "Payment", description: "Payment processing and history" },
    { id: "6", name: "Invoices", description: "Guest invoices and billing" },
    {
      id: "7",
      name: "Occupancy",
      description: "Daily occupancy, ADR, RevPAR metrics",
    },
    {
      id: "8",
      name: "Housekeeping",
      description: "Room status and housekeeping data",
    },
    { id: "10", name: "Payout", description: "Payout and reconciliation data" },
  ];

  const handleFetchStructure = () => {
    if (!datasetId) {
      toast.error("Please select a dataset first");
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
    callApiExplorer(
      "dataset-structure",
      { id: datasetId },
      "fetch-structure-btn"
    ).finally(() => setLoadingStructure(false)); // Turn off specific spinner
  };

  const handleGetInsightsData = () => {
    if (selectedMetrics.length === 0) {
      toast.error("Please select at least one metric");
      return;
    }

    // Prepare params for the API call
    const params: Record<string, string> = {
      id: datasetId,
      columns: selectedMetrics.join(","), // Join selected metric columns
    };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (groupBy.length > 0) params.groupBy = groupBy.join(","); // Join selected dimension columns

    // Call the real API function
    callApiExplorer("insights-data", params, "fetch-insights-data-btn");
  };

  const handleGeneralEndpoint = (endpoint: string) => {
    // 'endpoint' here is the button text
    // --- Map button text back to endpoint slugs ---
    // (This mapping needs to be maintained if button text changes)
    const generalEndpointsMap: Record<string, string> = {
      "Get Hotel Info": "sample-hotel",
      "Get Sample Guest": "sample-guest",
      "Get Taxes & Fees": "taxes-fees",
      "Get Room Types": "sample-room",
      "Get Rate Plans": "sample-rate", // Placeholder, confirm if backend supports 'sample-rate' slug
      "Get Amenities": "user-info", // Placeholder, confirm if backend supports 'user-info' or similar slug
      "Get Webhooks": "get-webhooks",
      "Create Test Webhook": "create-test-webhook",
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
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMetricToggle = (metricColumn: string) => {
    // Use column name now
    setSelectedMetrics((prev) =>
      prev.includes(metricColumn)
        ? prev.filter((m) => m !== metricColumn)
        : [...prev, metricColumn]
    );
  };

  // Add the missing handler for 'Group By' toggles
  const handleDimensionToggle = (dimensionColumn: string) => {
    setGroupBy((prev) =>
      prev.includes(dimensionColumn)
        ? prev.filter((d) => d !== dimensionColumn)
        : [...prev, dimensionColumn]
    );
  };

  const generalEndpointCategories = [
    {
      name: "Property",
      icon: Building2,
      endpoints: ["Get Hotel Info"],
    },
    {
      name: "Guest Data",
      icon: Users,
      endpoints: ["Get Sample Guest"],
    },

    {
      name: "Configuration",
      icon: Settings2,
      endpoints: [
        "Get Taxes & Fees",
        "Get Room Types",
        "Get Rate Plans",
        "Get Amenities",
        "Get Webhooks",
        "Create Test Webhook",
      ],
    },
  ];

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "0.5rem",
        overflow: "hidden",
      }}
    >
      {/* Header with Property Selection */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #2a2a2a" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <Code className="w-5 h-5" style={{ color: "#39BDF8" }} />
              <h2 style={{ color: "#e5e5e5", fontSize: "1.25rem", margin: 0 }}>
                Cloudbeds API Explorer
              </h2>
            </div>
            <p style={{ color: "#9ca3af", fontSize: "14px", margin: 0 }}>
              Test and debug Cloudbeds API calls using stored property
              credentials
            </p>
          </div>
          <div style={{ width: "320px" }}>
            <label
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <Database className="w-3.5 h-3.5" />
              API Target Property
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className="w-3.5 h-3.5"
                      style={{ color: "#6b7280", cursor: "help" }}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    style={{
                      backgroundColor: "#0f0f0f",
                      borderColor: "#2a2a2a",
                      color: "#e5e5e5",
                      maxWidth: "320px",
                    }}
                  >
                    <p style={{ fontSize: "12px" }}>
                      All API calls will use the credentials stored for this
                      property
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </label>
            <div
              style={{
                backgroundColor: "#1A1A1A",
                border: "1px solid #2a2a2a",
                color: "#e5e5e5",
                height: "40px",
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                borderRadius: "0.25rem",
                fontSize: "14px",
              }}
            >
              {propertyId
                ? `Using Property ID: ${propertyId}`
                : "No Target Property Selected"}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="insights" style={{ width: "100%" }}>
        <div style={{ padding: "0 24px", borderBottom: "1px solid #2a2a2a" }}>
          <TabsList
            style={{
              backgroundColor: "transparent",
              height: "48px",
              padding: 0,
            }}
          >
            <TabsTrigger
              value="insights"
              style={{ borderRadius: 0, padding: "0 24px", color: "#9ca3af" }}
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#39BDF8] data-[state=active]:text-[#39BDF8]"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Insights API
            </TabsTrigger>
            <TabsTrigger
              value="general"
              style={{ borderRadius: 0, padding: "0 24px", color: "#9ca3af" }}
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#39BDF8] data-[state=active]:text-[#39BDF8]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              General API
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Insights API Tab */}
        <TabsContent value="insights" style={{ padding: "24px", margin: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
            }}
          >
            {/* Left Panel - Configuration */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              {/* Step 1: Select Dataset */}
              <div
                style={{
                  backgroundColor: "#0f0f0f",
                  borderRadius: "0.5rem",
                  padding: "16px",
                  border: "1px solid #2a2a2a",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      backgroundColor: "#39BDF8",
                      color: "#0f0f0f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    1
                  </div>
                  <h3 style={{ color: "#e5e5e5", margin: 0 }}>
                    Select Dataset
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info
                          className="w-4 h-4"
                          style={{
                            color: "#6b7280",
                            cursor: "help",
                            marginLeft: "auto",
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        style={{
                          backgroundColor: "#1f1f1c",
                          borderColor: "#3a3a35",
                          color: "#e5e5e5",
                          maxWidth: "320px",
                        }}
                      >
                        <p style={{ fontSize: "12px" }}>
                          Dataset IDs identify specific data collections in the
                          Insights API.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {datasets.map((ds) => (
                    <div
                      key={ds.id}
                      onClick={() => {
                        setDatasetId(ds.id);
                        setStructureLoaded(false);
                        setAvailableMetrics([]);
                        setAvailableDimensions([]);
                        setSelectedMetrics([]);
                      }}
                      style={{
                        padding: "12px",
                        borderRadius: "0.25rem",
                        borderWidth: "1px",
                        borderStyle: "solid",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        borderColor:
                          datasetId === ds.id ? "#39BDF8" : "#3a3a35",
                        backgroundColor:
                          datasetId === ds.id
                            ? "rgba(57, 189, 248, 0.1)"
                            : "#1A1A1A",
                      }}
                      className="hover:border-[#4a4a45]"
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{ color: "#e5e5e5", fontSize: "14px" }}
                            >
                              {ds.name}
                            </span>
                            <Badge
                              variant="outline"
                              style={{
                                fontSize: "10px",
                                borderColor: "#3a3a35",
                                color: "#9ca3af",
                              }}
                            >
                              ID: {ds.id}
                            </Badge>
                          </div>
                          <p
                            style={{
                              color: "#9ca3af",
                              fontSize: "12px",
                              marginTop: "4px",
                              margin: 0,
                            }}
                          >
                            {ds.description}
                          </p>
                        </div>
                        {datasetId === ds.id && (
                          <CheckCircle2
                            className="w-4 h-4"
                            style={{ color: "#39BDF8", flexShrink: 0 }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleFetchStructure}
                  disabled={!datasetId || loadingStructure}
                  style={{
                    width: "100%",
                    marginTop: "16px",
                    backgroundColor: "#3a3a35",
                    color: "#e5e5e5",
                    borderColor: "#4a4a45",
                  }}
                  variant="outline"
                  className="hover:bg-[#4a4a45]"
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
                <div
                  style={{
                    backgroundColor: "#1f1f1c",
                    borderRadius: "0.5rem",
                    padding: "16px",
                    border: "1px solid #3a3a35",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#39BDF8",
                        color: "#0f0f0f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      2
                    </div>
                    <h3 style={{ color: "#e5e5e5", margin: 0 }}>
                      Configure Parameters
                    </h3>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <label
                          style={{
                            color: "#9ca3af",
                            fontSize: "12px",
                            marginBottom: "6px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Start Date
                        </label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{
                            backgroundColor: "#262626",
                            borderColor: "#3a3a35",
                            color: "#e5e5e5",
                            height: "36px",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          style={{
                            color: "#9ca3af",
                            fontSize: "12px",
                            marginBottom: "6px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          End Date
                        </label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{
                            backgroundColor: "#262626",
                            borderColor: "#3a3a35",
                            color: "#e5e5e5",
                            height: "36px",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          color: "#9ca3af",
                          fontSize: "12px",
                          marginBottom: "6px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        Group By (Dimensions)
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info
                                className="w-3.5 h-3.5"
                                style={{ color: "#6b7280", cursor: "help" }}
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              style={{
                                backgroundColor: "#1f1f1c",
                                borderColor: "#3a3a35",
                                color: "#e5e5e5",
                                maxWidth: "320px",
                              }}
                            >
                              <p style={{ fontSize: "12px" }}>
                                Select one or more dimensions to group your data
                                by.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </label>
                      <div
                        style={{
                          backgroundColor: "#262626",
                          borderRadius: "0.25rem",
                          padding: "10px",
                          maxHeight: "128px",
                          overflowY: "auto",
                          border: "1px solid #3a3a35",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        {availableDimensions.map((dimension) => (
                          <label
                            key={dimension.column}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "8px",
                              cursor: "pointer",
                            }}
                            className="group"
                          >
                            <input
                              type="checkbox"
                              checked={groupBy.includes(dimension.column)}
                              onChange={() =>
                                handleDimensionToggle(dimension.column)
                              }
                              style={{
                                marginTop: "2px",
                                accentColor: "#39BDF8",
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <span
                                style={{
                                  color: "#e5e5e5",
                                  fontSize: "14px",
                                  transition: "color 0.2s",
                                }}
                                className="group-hover:text-[#39BDF8]"
                              >
                                {dimension.label}
                              </span>
                              <p
                                style={{
                                  color: "#6b7280",
                                  fontSize: "12px",
                                  margin: 0,
                                }}
                              >
                                {dimension.description}
                              </p>
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
                <div
                  style={{
                    backgroundColor: "#1f1f1c",
                    borderRadius: "0.5rem",
                    padding: "16px",
                    border: "1px solid #3a3a35",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#39BDF8",
                        color: "#0f0f0f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      3
                    </div>
                    <h3 style={{ color: "#e5e5e5", margin: 0 }}>
                      Select Metrics
                    </h3>
                    <Badge
                      variant="outline"
                      style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        borderColor: "#3a3a35",
                        color: "#9ca3af",
                      }}
                    >
                      {selectedMetrics.length} selected
                    </Badge>
                  </div>

                  <div
                    style={{
                      backgroundColor: "#262626",
                      borderRadius: "0.25rem",
                      padding: "10px",
                      maxHeight: "224px",
                      overflowY: "auto",
                      border: "1px solid #3a3a35",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {availableMetrics.map((metric) => (
                      <label
                        key={metric.column}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "8px",
                          cursor: "pointer",
                        }}
                        className="group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(metric.column)}
                          onChange={() => handleMetricToggle(metric.column)}
                          style={{ marginTop: "2px", accentColor: "#39BDF8" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              style={{
                                color: "#e5e5e5",
                                fontSize: "14px",
                                transition: "color 0.2s",
                              }}
                              className="group-hover:text-[#39BDF8]"
                            >
                              {metric.label}
                            </span>
                            <Badge
                              variant="outline"
                              style={{
                                fontSize: "10px",
                                borderColor: "#3a3a35",
                                color: "#6b7280",
                              }}
                            >
                              {metric.type}
                            </Badge>
                          </div>
                          <code style={{ color: "#9ca3af", fontSize: "12px" }}>
                            {metric.name}
                          </code>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Execute */}
              {structureLoaded && (
                <div
                  style={{
                    backgroundColor: "#1f1f1c",
                    borderRadius: "0.5rem",
                    padding: "16px",
                    border: "1px solid #3a3a35",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        backgroundColor: "#39BDF8",
                        color: "#0f0f0f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      4
                    </div>
                    <h3 style={{ color: "#e5e5e5", margin: 0 }}>
                      Execute Query
                    </h3>
                  </div>

                  <Button
                    onClick={handleGetInsightsData}
                    disabled={selectedMetrics.length === 0}
                    style={{
                      width: "100%",
                      backgroundColor: "#39BDF8",
                      color: "#0f0f0f",
                    }}
                    className="hover:bg-[#29ADEE]"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Get Insights Data
                  </Button>
                </div>
              )}
            </div>

            {/* Right Panel - API Response */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <label
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Code className="w-3.5 h-3.5" />
                  API Response
                </label>
                {apiResponse && (
                  <Button
                    onClick={handleCopyResponse}
                    size="sm"
                    variant="ghost"
                    style={{
                      height: "28px",
                      padding: "0 8px",
                      color: "#9ca3af",
                    }}
                    className="hover:text-[#39BDF8] hover:bg-[#3a3a35]"
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
                style={{
                  backgroundColor: "#1f1f1c",
                  borderColor: "#3a3a35",
                  color: "#10b981",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  minHeight: "600px",
                  flex: 1,
                  resize: "none",
                }}
                placeholder="Select a dataset and fetch its structure to begin..."
              />
            </div>
          </div>
        </TabsContent>

        {/* General API Tab */}
        <TabsContent value="general" style={{ padding: "24px", margin: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
            }}
          >
            {/* Left Panel - Endpoints */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div
                style={{
                  backgroundColor: "#0F0F0F",
                  borderRadius: "0.5rem",
                  padding: "16px",
                  border: "1px solid #3a3a35",
                }}
              >
                <h3
                  style={{
                    color: "#e5e5e5",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: 0,
                  }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: "#39BDF8" }} />
                  Quick Endpoint Tests
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    marginBottom: "16px",
                    marginTop: "4px",
                  }}
                >
                  Click any endpoint below to make a direct API call to
                  Cloudbeds
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  {generalEndpointCategories.map((category) => (
                    <div key={category.name}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "8px",
                        }}
                      >
                        <category.icon className="w-4 h-4 text-[#9ca3af]" />
                        <h4
                          style={{
                            color: "#9ca3af",
                            fontSize: "12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            margin: 0,
                          }}
                        >
                          {category.name}
                        </h4>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {category.endpoints.map((endpoint) => (
                          <Button
                            key={endpoint}
                            onClick={() => handleGeneralEndpoint(endpoint)}
                            disabled={loadingEndpoint === endpoint}
                            variant="outline"
                            style={{
                              width: "100%",
                              backgroundColor: "#1A1A1A",
                              borderColor: "#3a3a35",
                              color: "#e5e5e5",
                              justifyContent: "flex-start",
                              height: "auto",
                              padding: "12px",
                            }}
                            className="group hover:bg-[#3a3a35] hover:border-[#39BDF8]"
                          >
                            {loadingEndpoint === endpoint ? (
                              <Loader2 className="w-4 h-4 mr-2.5 flex-shrink-0 animate-spin text-[#39BDF8]" />
                            ) : (
                              <Play className="w-4 h-4 mr-2.5 flex-shrink-0 text-[#9ca3af] group-hover:text-[#39BDF8] transition-colors" />
                            )}
                            <span style={{ fontSize: "14px" }}>{endpoint}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel - API Response */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <label
                  style={{
                    color: "#9ca3af",
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Code className="w-3.5 h-3.5" />
                  API Response
                </label>
                {apiResponse && (
                  <Button
                    onClick={handleCopyResponse}
                    size="sm"
                    variant="ghost"
                    style={{
                      height: "28px",
                      padding: "0 8px",
                      color: "#9ca3af",
                    }}
                    className="hover:text-[#39BDF8] hover:bg-[#3a3a35]"
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
                style={{
                  backgroundColor: "#1f1f1c",
                  borderColor: "#3a3a35",
                  color: "#10b981",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  minHeight: "600px",
                  flex: 1,
                  resize: "none",
                }}
                placeholder="Click any endpoint button to test the API..."
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
