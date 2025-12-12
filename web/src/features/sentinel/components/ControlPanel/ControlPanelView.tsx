import { useState } from "react";
import {
  Plus,
  Globe2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useSentinelConfig } from "../../hooks/useSentinelConfig";

// --- VISUAL CONSTANTS ---

const tabTriggerStyle: React.CSSProperties = {
  color: "#9ca3af",
  padding: "0.5rem 1rem",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  border: "1px solid transparent",
  borderRadius: "0.25rem",
  width: "100%",
  justifyContent: "center",
};

const activeTabTriggerStyle: React.CSSProperties = {
  ...tabTriggerStyle,
  backgroundColor: "rgba(57, 189, 248, 0.1)",
  color: "#39BDF8",
  borderColor: "rgba(57, 189, 248, 0.5)",
};

const MONTH_ORDER = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const getAggressionColor = (level: string) => {
  switch (level) {
    case "low":
      return {
        bg: "rgba(16,185,129,0.1)",
        text: "#10b981",
        border: "rgba(16,185,129,0.3)",
      };
    case "medium":
      return {
        bg: "rgba(250,255,106,0.1)",
        text: "#faff6a",
        border: "rgba(250,255,106,0.3)",
      };
    case "high":
      return {
        bg: "rgba(239,68,68,0.1)",
        text: "#ef4444",
        border: "rgba(239,68,68,0.3)",
      };
    default:
      return {
        bg: "rgba(156,163,175,0.1)",
        text: "#9ca3af",
        border: "rgba(156,163,175,0.3)",
      };
  }
};

interface ControlPanelViewProps {
  allHotels: any[];
}

interface WebhookStatus {
  id: string;
  propertyName: string;
  status: "success" | "error";
}

export function ControlPanelView({ allHotels }: ControlPanelViewProps) {
  // Hook Integration
  const {
    isLoading,
    loadingHotelId,
    isSaving,
    isSyncing,
    availableHotels,
    activeHotels,
    formState,
    loadHotelRules,
    updateRule,
    activateHotel,
    saveRules,
  } = useSentinelConfig(allHotels);

  // Local UI State
  const [openAccordionItem, setOpenAccordionItem] = useState<string>("");
  const [hotelToActivate, setHotelToActivate] = useState("");
  const [isComboOpen, setIsComboOpen] = useState(false);
  const [activeMarket, setActiveMarket] = useState("london");
  const [roomDifferentialsExpanded, setRoomDifferentialsExpanded] =
    useState(false);
  // [NEW] Repush Loading State
  const [isRepushing, setIsRepushing] = useState("");

  // Manual Events State (Local UI Mock)
  const [londonEvents, setLondonEvents] = useState([
    {
      id: "1",
      date: "2024-07-15",
      name: "Wimbledon Finals",
      impact: "High Demand",
    },
  ]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventImpact, setNewEventImpact] = useState("High Demand");

  // [RESTORED] Market Strategy Seasonality State
  const [londonAggression, setLondonAggression] = useState<
    Record<string, string>
  >({
    jan: "medium",
    feb: "low",
    mar: "high",
    apr: "medium",
    may: "high",
    jun: "high",
    jul: "medium",
    aug: "medium",
    sep: "low",
    oct: "medium",
    nov: "low",
    dec: "high",
  });

  // [RESTORED] Webhook Mock State
  const [webhooks] = useState<WebhookStatus[]>([
    { id: "1", propertyName: "The Grand Hotel", status: "success" },
    { id: "2", propertyName: "Seaside Luxury Resort", status: "error" },
    { id: "3", propertyName: "Downtown Business Suites", status: "success" },
  ]);

  // --- Helpers ---

  const handleAggressionClick = (hotelId: string, monthValue: string) => {
    const current =
      formState[hotelId]?.monthly_aggression?.[monthValue] || "low";
    let next = "low";
    if (current === "low") next = "medium";
    else if (current === "medium") next = "high";
    else if (current === "high") next = "low";
    updateRule(hotelId, `monthly_aggression.${monthValue}`, next);
  };

  const toggleDayOfWeek = (hotelId: string, day: string) => {
    const currentDow = formState[hotelId]?.last_minute_floor?.dow || [];
    let newDow;
    if (currentDow.includes(day)) {
      newDow = currentDow.filter((d: string) => d !== day);
    } else {
      newDow = [...currentDow, day];
    }
    updateRule(hotelId, "last_minute_floor.dow", newDow);
  };

  const handleDifferentialChange = (
    hotelId: string,
    roomTypeId: string,
    field: "operator" | "value",
    newValue: string
  ) => {
    const currentDiffs = formState[hotelId]?.room_differentials || [];
    const exists = currentDiffs.find((r: any) => r.roomTypeId === roomTypeId);
    let newDiffs;
    if (exists) {
      newDiffs = currentDiffs.map((r: any) =>
        r.roomTypeId === roomTypeId ? { ...r, [field]: newValue } : r
      );
    } else {
      const newRule = {
        roomTypeId,
        operator: "+",
        value: "0",
        [field]: newValue,
      };
      newDiffs = [...currentDiffs, newRule];
    }
    updateRule(hotelId, "room_differentials", newDiffs);
  };

  // [NEW] Handle Re-Push (Force Recalculate & Sync)
  const handleRepushRates = async (hotelId: string) => {
    if (isRepushing) return;
    setIsRepushing(hotelId);

    toast.promise(
      async () => {
        const res = await fetch("/api/sentinel/recalculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelId }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        return data.message;
      },
      {
        loading: "Recalculating and pushing all rates...",
        success: (msg) => {
          setIsRepushing("");
          return msg;
        },
        error: (err) => {
          setIsRepushing("");
          return `Failed: ${err.message}`;
        },
      }
    );
  };

  const handleExportReservations = async (hotelId: string) => {
    toast.promise(
      async () => {
        const res = await fetch("/api/sentinel/export-reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelId }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        return data.message;
      },
      {
        loading: "Exporting reservations to SQL...",
        success: (msg) => `${msg}`,
        error: (err) => {
          console.error("Export Error:", err);
          return `Export failed: ${err.message}`;
        },
      }
    );
  };

  const handleAddEvent = () => {
    if (!newEventDate || !newEventName) return;
    setLondonEvents((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        date: newEventDate,
        name: newEventName,
        impact: newEventImpact,
      },
    ]);
    setIsAddEventOpen(false);
    setNewEventDate("");
    setNewEventName("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1d1d1c",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Background Gradients */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom right, rgba(57,189,248,0.05), transparent, rgba(250,255,106,0.05))",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      ></div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "3rem",
          maxWidth: "1800px",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <h1
            style={{
              color: "#e5e5e5",
              fontSize: "1.875rem",
              letterSpacing: "-0.025em",
              marginBottom: "0.5rem",
            }}
          >
            Sentinel AI Control Panel
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
            Super Admin • PMS Integration & AI Configuration
          </p>
        </div>

        {/* 1. ACTIVATION CARD */}
        {availableHotels.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <Card
              style={{
                backgroundColor: "#1a1a1a",
                borderColor: "rgba(57, 189, 248, 0.2)",
              }}
            >
              <CardContent style={{ padding: "1.5rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px",
                        backgroundColor: "rgba(57, 189, 248, 0.1)",
                        borderRadius: "8px",
                      }}
                    >
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ color: "#39BDF8", fontWeight: "bold" }}>
                          {activeHotels.length + 1}
                        </span>
                      </div>
                    </div>
                    <h3
                      style={{
                        color: "#e5e5e5",
                        fontSize: "24px",
                        textTransform: "uppercase",
                        letterSpacing: "-0.025em",
                        margin: 0,
                      }}
                    >
                      Activate Property
                    </h3>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div style={{ width: "400px" }}>
                      <Popover open={isComboOpen} onOpenChange={setIsComboOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isComboOpen}
                            className="w-full justify-between"
                            style={{
                              justifyContent: "space-between",
                              backgroundColor: "#0f0f0f",
                              border: "1px solid rgba(57, 189, 248, 0.3)",
                              color: "#e5e5e5",
                            }}
                          >
                            {hotelToActivate
                              ? availableHotels.find(
                                  (h) => String(h.hotel_id) === hotelToActivate
                                )?.property_name
                              : "Search hotel to activate..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[400px]"
                          style={{
                            width: "400px",
                            padding: 0,
                            backgroundColor: "#1a1a1a",
                            border: "1px solid rgba(57, 189, 248, 0.3)",
                          }}
                          align="start"
                        >
                          <Command style={{ backgroundColor: "#1a1a1a" }}>
                            <CommandInput
                              placeholder="Search..."
                              className="text-[#e5e5e5]"
                            />
                            <CommandEmpty
                              style={{
                                color: "#9ca3af",
                                padding: "1.5rem 0",
                                textAlign: "center",
                                fontSize: "0.875rem",
                              }}
                            >
                              No hotel found.
                            </CommandEmpty>
                            <CommandGroup
                              style={{
                                backgroundColor: "#1a1a1a",
                                padding: "0.5rem",
                              }}
                            >
                              {availableHotels.map((hotel) => (
                                <CommandItem
                                  key={hotel.hotel_id}
                                  value={String(hotel.hotel_id)}
                                  onSelect={(val) => {
                                    setHotelToActivate(
                                      val === hotelToActivate ? "" : val
                                    );
                                    setIsComboOpen(false);
                                  }}
                                  style={{
                                    color: "#e5e5e5",
                                    cursor: "pointer",
                                    borderRadius: "0.25rem",
                                    padding: "0.5rem",
                                  }}
                                  className="hover:bg-[#161616]"
                                >
                                  <Check
                                    style={{
                                      marginRight: "0.5rem",
                                      height: "1rem",
                                      width: "1rem",
                                      color: "#39BDF8",
                                      opacity:
                                        hotelToActivate ===
                                        String(hotel.hotel_id)
                                          ? 1
                                          : 0,
                                    }}
                                  />
                                  {hotel.property_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <Button
                      disabled={!hotelToActivate || isSyncing !== null}
                      className="disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "#39BDF8",
                        color: "#0f0f0f",
                        fontWeight: 500,
                      }}
                      onClick={() => {
                        const h = availableHotels.find(
                          (h) => String(h.hotel_id) === hotelToActivate
                        );
                        if (h) {
                          activateHotel(String(h.hotel_id), h.pms_property_id);
                          setHotelToActivate("");
                        }
                      }}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}{" "}
                      Activate & Sync
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 2. MARKET STRATEGY CARD */}
        <div style={{ marginBottom: "2rem" }}>
          <Card
            style={{
              backgroundColor: "#1a1a1a",
              borderColor: "rgba(57, 189, 248, 0.2)",
              boxShadow: "0 0 30px rgba(57,189,248,0.1)",
            }}
          >
            <CardHeader
              style={{
                borderBottom: "1px solid rgba(57,189,248,0.1)",
                paddingBottom: "1.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    padding: "0.5rem",
                    background: "rgba(57,189,248,0.1)",
                    borderRadius: "0.5rem",
                  }}
                >
                  <Globe2
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      color: "#39BDF8",
                    }}
                  />
                </div>
                <div>
                  <CardTitle
                    style={{
                      color: "#e5e5e5",
                      fontSize: "1.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    Market Strategy & VITALS
                  </CardTitle>
                  <CardDescription
                    style={{ color: "#9ca3af", marginTop: "0.25rem" }}
                  >
                    Global market defaults • Applied to all properties unless
                    overridden
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent style={{ paddingTop: "1.5rem" }}>
              <Tabs
                value={activeMarket}
                onValueChange={setActiveMarket}
                style={{ width: "100%" }}
              >
                <TabsList
                  style={{
                    backgroundColor: "#0f0f0f",
                    display: "grid",
                    gridTemplateColumns: "repeat(1, 1fr)",
                    border: "1px solid #2a2a2a",
                    height: "auto",
                    padding: "0.25rem",
                    gap: "0.25rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <TabsTrigger
                    value="london"
                    style={
                      activeMarket === "london"
                        ? activeTabTriggerStyle
                        : tabTriggerStyle
                    }
                  >
                    London
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="london" style={{ marginTop: "1.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2rem",
                    }}
                  >
                    {/* [RESTORED] Market Seasonality Grid */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <h3
                        style={{
                          color: "#e5e5e5",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontSize: "0.75rem",
                        }}
                      >
                        Market Seasonality
                      </h3>
                      <div
                        style={{
                          background: "#0f0f0f",
                          border: "1px solid #2a2a2a",
                          borderRadius: "0.5rem",
                          padding: "1rem",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(12, 1fr)",
                            gap: "0.5rem",
                            marginBottom: "1rem",
                          }}
                        >
                          {MONTH_ORDER.map((monthValue) => {
                            const level = londonAggression[monthValue] || "low";
                            const colors = getAggressionColor(level);
                            return (
                              <button
                                key={monthValue}
                                style={{
                                  position: "relative",
                                  padding: "0.75rem",
                                  borderRadius: "0.5rem",
                                  border: `2px solid ${colors.border}`,
                                  background: colors.bg,
                                  transition: "all 0.2s",
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setLondonAggression((prev) => {
                                    const current = prev[monthValue];
                                    let next = "low";
                                    if (current === "low") next = "medium";
                                    else if (current === "medium")
                                      next = "high";
                                    else if (current === "high") next = "low";
                                    return { ...prev, [monthValue]: next };
                                  });
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                      color: colors.text,
                                    }}
                                  >
                                    {monthValue.charAt(0).toUpperCase() +
                                      monthValue.slice(1, 3)}
                                  </span>
                                  <div
                                    style={{
                                      width: "0.375rem",
                                      height: "0.375rem",
                                      borderRadius: "50%",
                                      background: colors.text,
                                    }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {/* Legend */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "1.5rem",
                            paddingTop: "0.75rem",
                            borderTop: "1px solid #2a2a2a",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                width: "0.75rem",
                                height: "0.75rem",
                                borderRadius: "50%",
                                background: "#10b981",
                              }}
                            />
                            <span
                              style={{ color: "#9ca3af", fontSize: "0.75rem" }}
                            >
                              Low Aggression
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                width: "0.75rem",
                                height: "0.75rem",
                                borderRadius: "50%",
                                background: "#faff6a",
                              }}
                            />
                            <span
                              style={{ color: "#9ca3af", fontSize: "0.75rem" }}
                            >
                              Medium Aggression
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <div
                              style={{
                                width: "0.75rem",
                                height: "0.75rem",
                                borderRadius: "50%",
                                background: "#ef4444",
                              }}
                            />
                            <span
                              style={{ color: "#9ca3af", fontSize: "0.75rem" }}
                            >
                              High Aggression
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Manual Events */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h3
                          style={{
                            color: "#e5e5e5",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontSize: "0.75rem",
                          }}
                        >
                          Manual Events
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddEventOpen(true)}
                          style={{
                            backgroundColor: "#0f0f0f",
                            borderColor: "#2a2a2a",
                            color: "#e5e5e5",
                          }}
                        >
                          <Plus className="w-3 h-3 mr-2" /> Add Event
                        </Button>
                      </div>
                      <div
                        style={{
                          background: "#0f0f0f",
                          border: "1px solid #2a2a2a",
                          borderRadius: "0.5rem",
                          overflow: "hidden",
                        }}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow className="border-[#2a2a2a] hover:bg-transparent">
                              <TableHead style={{ color: "#9ca3af" }}>
                                Date
                              </TableHead>
                              <TableHead style={{ color: "#9ca3af" }}>
                                Event Name
                              </TableHead>
                              <TableHead style={{ color: "#9ca3af" }}>
                                Impact
                              </TableHead>
                              <TableHead
                                style={{ color: "#9ca3af", textAlign: "right" }}
                              >
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {londonEvents.map((event) => (
                              <TableRow
                                key={event.id}
                                className="border-[#2a2a2a] hover:bg-[#161616]"
                              >
                                <TableCell style={{ color: "#e5e5e5" }}>
                                  {event.date}
                                </TableCell>
                                <TableCell style={{ color: "#e5e5e5" }}>
                                  {event.name}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    style={{
                                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                                      color: "#ef4444",
                                      borderColor: "rgba(239, 68, 68, 0.3)",
                                    }}
                                  >
                                    {event.impact}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    style={{ color: "#ef4444" }}
                                    onClick={() =>
                                      setLondonEvents((prev) =>
                                        prev.filter((e) => e.id !== event.id)
                                      )
                                    }
                                  >
                                    <Trash2
                                      style={{ width: "1rem", height: "1rem" }}
                                    />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    {/* Vitals */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <h3
                        style={{
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontSize: "10px",
                        }}
                      >
                        Market Vitals (Read-Only)
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            background: "#0f0f0f",
                            border: "1px solid #2a2a2a",
                            borderRadius: "0.25rem",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                            LEAD
                          </span>
                          <span
                            style={{ color: "#e5e5e5", fontSize: "0.875rem" }}
                          >
                            21d
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#0f0f0f",
                            border: "1px solid #2a2a2a",
                            borderRadius: "0.25rem",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                            LOS
                          </span>
                          <span
                            style={{ color: "#e5e5e5", fontSize: "0.875rem" }}
                          >
                            2.8n
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#0f0f0f",
                            border: "1px solid #2a2a2a",
                            borderRadius: "0.25rem",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#9ca3af", fontSize: "10px" }}>
                            PACE
                          </span>
                          <span
                            style={{ color: "#10b981", fontSize: "0.875rem" }}
                          >
                            +4.2%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* 3. CONFIGURATION ACCORDIONS (The Core) */}
        <div style={{ marginBottom: "2rem" }}>
          {isLoading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "3rem",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "0.5rem",
              }}
            >
              <Loader2
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  color: "#39BDF8",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ color: "#9ca3af", marginLeft: "0.75rem" }}>
                Loading Configurations...
              </span>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={openAccordionItem}
              onValueChange={(val) => {
                if (val) loadHotelRules(val);
                setOpenAccordionItem(val);
              }}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {activeHotels.map((hotel) => (
                <AccordionItem
                  key={hotel.hotel_id}
                  value={String(hotel.hotel_id)}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderLeft: `4px solid ${
                      hotel.config?.sentinel_enabled
                        ? "rgba(16, 185, 129, 0.4)"
                        : "rgba(250, 255, 106, 0.4)"
                    }`,
                    borderRight: `1px solid ${
                      openAccordionItem === String(hotel.hotel_id)
                        ? "#39BDF8"
                        : "#2a2a2a"
                    }`,
                    borderTop: `1px solid ${
                      openAccordionItem === String(hotel.hotel_id)
                        ? "#39BDF8"
                        : "#2a2a2a"
                    }`,
                    borderBottom: `1px solid ${
                      openAccordionItem === String(hotel.hotel_id)
                        ? "#39BDF8"
                        : "#2a2a2a"
                    }`,
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                  }}
                >
                  <AccordionTrigger
                    style={{
                      padding: "1.25rem 1.5rem",
                      backgroundColor: "#141414",
                    }}
                    className="hover:no-underline"
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: "1.5rem",
                        width: "100%",
                        paddingRight: "1rem",
                        alignItems: "center",
                      }}
                    >
                      {/* Name */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                        }}
                      >
                        <span style={{ color: "#e5e5e5" }}>
                          {hotel.property_name} ({hotel.hotel_id})
                        </span>
                      </div>

                      {/* Status Badge */}
                      <Badge
                        variant="outline"
                        style={
                          hotel.config?.sentinel_enabled
                            ? {
                                backgroundColor: "rgba(16, 185, 129, 0.1)",
                                color: "#10b981",
                                borderColor: "rgba(16, 185, 129, 0.3)",
                                whiteSpace: "nowrap",
                              }
                            : {
                                backgroundColor: "rgba(250, 255, 106, 0.1)",
                                color: "#faff6a",
                                borderColor: "rgba(250, 255, 106, 0.3)",
                                whiteSpace: "nowrap",
                              }
                        }
                      >
                        Status:{" "}
                        {hotel.config?.sentinel_enabled ? "Active" : "Paused"}
                      </Badge>

                      {/* Icon Badges */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                style={
                                  hotel.status?.hasFloorRate
                                    ? {
                                        backgroundColor:
                                          "rgba(57, 189, 248, 0.1)",
                                        color: "#39BDF8",
                                        borderColor: "rgba(57, 189, 248, 0.3)",
                                      }
                                    : {
                                        backgroundColor:
                                          "rgba(239, 68, 68, 0.1)",
                                        color: "#ef4444",
                                        borderColor: "rgba(239, 68, 68, 0.3)",
                                      }
                                }
                              >
                                Floor Rate
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                              style={{
                                backgroundColor: "#1a1a1a",
                                borderColor: "#2a2a2a",
                              }}
                            >
                              <p style={{ fontSize: "12px", color: "#e5e5e5" }}>
                                {hotel.status?.hasFloorRate
                                  ? "Active"
                                  : "Missing"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                style={
                                  hotel.status?.hasRateFreeze
                                    ? {
                                        backgroundColor:
                                          "rgba(245, 158, 11, 0.1)",
                                        color: "#f59e0b",
                                        borderColor: "rgba(245, 158, 11, 0.3)",
                                      }
                                    : {
                                        backgroundColor:
                                          "rgba(74, 74, 72, 0.1)",
                                        color: "#6b7280",
                                        borderColor: "rgba(74, 74, 72, 0.3)",
                                      }
                                }
                              >
                                Freeze
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                              style={{
                                backgroundColor: "#1a1a1a",
                                borderColor: "#2a2a2a",
                              }}
                            >
                              <p style={{ fontSize: "12px", color: "#e5e5e5" }}>
                                {hotel.status?.hasRateFreeze
                                  ? "Active"
                                  : "Missing"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                style={
                                  hotel.status?.hasDifferentials
                                    ? {
                                        backgroundColor:
                                          "rgba(57, 189, 248, 0.1)",
                                        color: "#39BDF8",
                                        borderColor: "rgba(57, 189, 248, 0.3)",
                                      }
                                    : {
                                        backgroundColor:
                                          "rgba(74, 74, 72, 0.1)",
                                        color: "#6b7280",
                                        borderColor: "rgba(74, 74, 72, 0.3)",
                                      }
                                }
                              >
                                Differentials
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                              style={{
                                backgroundColor: "#1a1a1a",
                                borderColor: "#2a2a2a",
                              }}
                            >
                              <p style={{ fontSize: "12px", color: "#e5e5e5" }}>
                                {hotel.status?.hasDifferentials
                                  ? "Active"
                                  : "Missing"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent
                    style={{
                      backgroundColor: "#141414",
                      padding: "1.5rem 1rem 1rem 2rem",
                    }}
                  >
                    {loadingHotelId === String(hotel.hotel_id) ? (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          padding: "3rem",
                        }}
                      >
                        <Loader2
                          style={{
                            width: "1.5rem",
                            height: "1.5rem",
                            color: "#39BDF8",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        <span
                          style={{ color: "#9ca3af", marginLeft: "0.75rem" }}
                        >
                          Loading Configuration...
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2rem",
                        }}
                      >
                        {/* 1. Settings Grid */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "1rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0.75rem",
                              background: "#0f0f0f",
                              border: "1px solid #2a2a2a",
                              borderRadius: "0.5rem",
                            }}
                          >
                            <Label
                              htmlFor={`sentinel-status-${hotel.hotel_id}`}
                              style={{ color: "#e5e5e5", fontSize: "0.875rem" }}
                            >
                              Sentinel AI
                            </Label>
                            <Switch
                              id={`sentinel-status-${hotel.hotel_id}`}
                              checked={
                                formState[hotel.hotel_id]?.sentinel_enabled ||
                                false
                              }
                              onCheckedChange={(c) =>
                                updateRule(
                                  String(hotel.hotel_id),
                                  "sentinel_enabled",
                                  c
                                )
                              }
                            />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.375rem",
                            }}
                          >
                            <Label
                              style={{
                                color: "#9ca3af",
                                fontSize: "0.75rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Max Rate
                            </Label>
                            <div style={{ position: "relative" }}>
                              <span
                                style={{
                                  position: "absolute",
                                  left: "0.75rem",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  color: "#9ca3af",
                                  fontSize: "0.875rem",
                                }}
                              >
                                $
                              </span>
                              <Input
                                type="number"
                                value={
                                  formState[hotel.hotel_id]?.guardrail_max || ""
                                }
                                onChange={(e) =>
                                  updateRule(
                                    String(hotel.hotel_id),
                                    "guardrail_max",
                                    e.target.value
                                  )
                                }
                                style={{
                                  backgroundColor: "#0f0f0f",
                                  paddingLeft: "1.75rem",
                                }}
                                className="border-[#2a2a2a] text-[#e5e5e5] h-9 text-sm"
                              />
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.375rem",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.375rem",
                              }}
                            >
                              <Label
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "0.75rem",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Rate Freeze Period
                              </Label>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle
                                      style={{
                                        width: "0.75rem",
                                        height: "0.75rem",
                                        color: "#9ca3af",
                                      }}
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    style={{
                                      backgroundColor: "#1a1a1a",
                                      borderColor: "#2a2a2a",
                                    }}
                                  >
                                    <p
                                      style={{
                                        fontSize: "11px",
                                        color: "#e5e5e5",
                                      }}
                                    >
                                      Block updates for X days.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <div style={{ position: "relative" }}>
                              <Input
                                type="number"
                                value={
                                  formState[hotel.hotel_id]
                                    ?.rate_freeze_period || ""
                                }
                                onChange={(e) =>
                                  updateRule(
                                    String(hotel.hotel_id),
                                    "rate_freeze_period",
                                    e.target.value
                                  )
                                }
                                style={{ backgroundColor: "#0f0f0f" }}
                                className="border-[#2a2a2a] text-[#e5e5e5] pr-12 h-9 text-sm"
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  right: "0.75rem",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  color: "#9ca3af",
                                  fontSize: "0.75rem",
                                }}
                              >
                                days
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: "1px solid #2a2a2a" }}></div>

                        {/* 2. Last-Minute Floor */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <h3
                                style={{
                                  color: "#e5e5e5",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  fontSize: "0.75rem",
                                }}
                              >
                                Last-Minute Floor Rate
                              </h3>
                              <p
                                style={{
                                  color: "#9ca3af",
                                  fontSize: "10px",
                                  marginTop: "0.125rem",
                                }}
                              >
                                Override min rate close to arrival if occupancy
                                is low
                              </p>
                            </div>
                            <Switch
                              checked={
                                formState[hotel.hotel_id]?.last_minute_floor
                                  ?.enabled || false
                              }
                              onCheckedChange={(c) =>
                                updateRule(
                                  String(hotel.hotel_id),
                                  "last_minute_floor.enabled",
                                  c
                                )
                              }
                            />
                          </div>

                          {formState[hotel.hotel_id]?.last_minute_floor
                            ?.enabled && (
                            <div
                              style={{
                                background: "#0f0f0f",
                                border: "1px solid rgba(249,115,22,0.3)",
                                borderRadius: "0.5rem",
                                padding: "1rem",
                                display: "flex",
                                flexDirection: "column",
                                gap: "1rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(2, 1fr)",
                                  gap: "1rem",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <Label
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: "0.75rem",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Floor Rate
                                  </Label>
                                  <div style={{ position: "relative" }}>
                                    <span
                                      style={{
                                        position: "absolute",
                                        left: "0.75rem",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        color: "#9ca3af",
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      $
                                    </span>
                                    <Input
                                      type="number"
                                      value={
                                        formState[hotel.hotel_id]
                                          ?.last_minute_floor?.rate || ""
                                      }
                                      onChange={(e) =>
                                        updateRule(
                                          String(hotel.hotel_id),
                                          "last_minute_floor.rate",
                                          e.target.value
                                        )
                                      }
                                      style={{ backgroundColor: "#1a1a1a" }}
                                      className="border-[#2a2a2a] text-[#e5e5e5] pl-7 h-9 text-sm"
                                    />
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <Label
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: "0.75rem",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Activate Within
                                  </Label>
                                  <div style={{ position: "relative" }}>
                                    <Input
                                      type="number"
                                      value={
                                        formState[hotel.hotel_id]
                                          ?.last_minute_floor?.days || ""
                                      }
                                      onChange={(e) =>
                                        updateRule(
                                          String(hotel.hotel_id),
                                          "last_minute_floor.days",
                                          e.target.value
                                        )
                                      }
                                      style={{ backgroundColor: "#1a1a1a" }}
                                      className="border-[#2a2a2a] text-[#e5e5e5] pr-12 h-9 text-sm"
                                    />
                                    <span
                                      style={{
                                        position: "absolute",
                                        right: "0.75rem",
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        color: "#9ca3af",
                                        fontSize: "0.75rem",
                                      }}
                                    >
                                      days
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                }}
                              >
                                <Label
                                  style={{
                                    color: "#9ca3af",
                                    fontSize: "0.75rem",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Active Days of Week
                                </Label>
                                <div
                                  style={{ display: "flex", gap: "0.375rem" }}
                                >
                                  {[
                                    { k: "mon", l: "Mon" },
                                    { k: "tue", l: "Tue" },
                                    { k: "wed", l: "Wed" },
                                    { k: "thu", l: "Thu" },
                                    { k: "fri", l: "Fri" },
                                    { k: "sat", l: "Sat" },
                                    { k: "sun", l: "Sun" },
                                  ].map((day) => {
                                    const isActive =
                                      formState[
                                        hotel.hotel_id
                                      ]?.last_minute_floor?.dow.includes(
                                        day.k
                                      ) || false;
                                    return (
                                      <button
                                        key={day.k}
                                        onClick={() =>
                                          toggleDayOfWeek(
                                            String(hotel.hotel_id),
                                            day.k
                                          )
                                        }
                                        style={{
                                          flex: 1,
                                          padding: "0.5rem",
                                          borderRadius: "0.25rem",
                                          fontSize: "0.75rem",
                                          transition: "all 0.2s",
                                          border: isActive
                                            ? "2px solid rgba(249,115,22,0.5)"
                                            : "2px solid #2a2a2a",
                                          background: isActive
                                            ? "rgba(249,115,22,0.2)"
                                            : "#1a1a1a",
                                          color: isActive
                                            ? "#f97316"
                                            : "#9ca3af",
                                          cursor: "pointer",
                                        }}
                                      >
                                        {day.l}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: "1px solid #2a2a2a" }}></div>

                        {/* 3. Room Differentials */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          <button
                            onClick={() =>
                              setRoomDifferentialsExpanded(
                                !roomDifferentialsExpanded
                              )
                            }
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              background: "transparent",
                              border: "none",
                            }}
                          >
                            <h3
                              style={{
                                color: "#e5e5e5",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontSize: "0.75rem",
                              }}
                            >
                              Room Differentials
                            </h3>
                            {roomDifferentialsExpanded ? (
                              <ChevronUp
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  color: "#9ca3af",
                                }}
                              />
                            ) : (
                              <ChevronDown
                                style={{
                                  width: "1rem",
                                  height: "1rem",
                                  color: "#9ca3af",
                                }}
                              />
                            )}
                          </button>

                          <div
                            style={{
                              background: "#0f0f0f",
                              border: "1px solid #2a2a2a",
                              borderRadius: "0.5rem",
                              padding: "0.5rem",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}
                          >
                            {(
                              formState[hotel.hotel_id]?.pms_room_types?.data ||
                              []
                            ).map((room: any) => {
                              const isBase =
                                room.roomTypeID ===
                                formState[hotel.hotel_id]?.base_room_type_id;
                              if (!isBase && !roomDifferentialsExpanded)
                                return null;
                              const rule =
                                formState[
                                  hotel.hotel_id
                                ]?.room_differentials?.find(
                                  (r: any) => r.roomTypeId === room.roomTypeID
                                ) || {};

                              return (
                                <div
                                  key={room.roomTypeID}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "0.5rem",
                                    padding: "0.375rem",
                                    background: "#1a1a1a",
                                    border: "1px solid #2a2a2a",
                                    borderRadius: "0.25rem",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.5rem",
                                      flex: 1,
                                      minWidth: 0,
                                    }}
                                  >
                                    <RadioGroup
                                      value={
                                        formState[hotel.hotel_id]
                                          ?.base_room_type_id
                                      }
                                      onValueChange={(val) =>
                                        updateRule(
                                          String(hotel.hotel_id),
                                          "base_room_type_id",
                                          val
                                        )
                                      }
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                      >
                                        <RadioGroupItem
                                          value={room.roomTypeID}
                                          style={{
                                            borderColor: "#39BDF8",
                                            color: "#39BDF8",
                                            height: "0.75rem",
                                            width: "0.75rem",
                                          }}
                                        />
                                      </div>
                                    </RadioGroup>
                                    <Label
                                      style={{
                                        color: "#e5e5e5",
                                        fontSize: "0.75rem",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {room.roomTypeName}
                                    </Label>
                                    {isBase && (
                                      <Badge
                                        variant="outline"
                                        style={{
                                          backgroundColor:
                                            "rgba(57, 189, 248, 0.1)",
                                          color: "#39BDF8",
                                          borderColor:
                                            "rgba(57, 189, 248, 0.3)",
                                          fontSize: "10px",
                                          padding: "0 0.375rem",
                                        }}
                                      >
                                        Base
                                      </Badge>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    <Select
                                      value={rule.operator || "+"}
                                      onValueChange={(v) =>
                                        handleDifferentialChange(
                                          String(hotel.hotel_id),
                                          room.roomTypeID,
                                          "operator",
                                          v
                                        )
                                      }
                                    >
                                      <SelectTrigger
                                        style={{
                                          width: "6rem",
                                          backgroundColor: "#0f0f0f",
                                        }}
                                        className="h-9 border-[#2a2a2a] text-[#e5e5e5] text-sm"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent
                                        style={{
                                          backgroundColor: "#1a1a1a",
                                          borderColor: "#2a2a2a",
                                        }}
                                      >
                                        <SelectItem
                                          value="+"
                                          className="text-[#e5e5e5]"
                                        >
                                          +
                                        </SelectItem>
                                        <SelectItem
                                          value="-"
                                          className="text-[#e5e5e5]"
                                        >
                                          -
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <div
                                      style={{
                                        position: "relative",
                                        width: "5rem",
                                      }}
                                    >
                                      <Input
                                        type="number"
                                        value={rule.value || "15"}
                                        onChange={(e) =>
                                          handleDifferentialChange(
                                            String(hotel.hotel_id),
                                            room.roomTypeID,
                                            "value",
                                            e.target.value
                                          )
                                        }
                                        style={{ backgroundColor: "#0f0f0f" }}
                                        className="border-[#2a2a2a] text-[#e5e5e5] pr-5 h-9 text-sm"
                                      />
                                      <span
                                        style={{
                                          position: "absolute",
                                          right: "0.375rem",
                                          top: "50%",
                                          transform: "translateY(-50%)",
                                          color: "#9ca3af",
                                          fontSize: "10px",
                                        }}
                                      >
                                        %
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ borderTop: "1px solid #2a2a2a" }}></div>

                        {/* 4. Monthly Aggression */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          <h3
                            style={{
                              color: "#e5e5e5",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              fontSize: "0.75rem",
                            }}
                          >
                            Monthly Aggression Levels
                          </h3>
                          <div
                            style={{
                              background: "#0f0f0f",
                              border: "1px solid #2a2a2a",
                              borderRadius: "0.5rem",
                              padding: "1rem",
                              display: "grid",
                              gridTemplateColumns: "repeat(12, 1fr)",
                              gap: "0.5rem",
                            }}
                          >
                            {MONTH_ORDER.map((month) => {
                              const level =
                                formState[hotel.hotel_id]?.monthly_aggression?.[
                                  month
                                ] || "low";
                              const c = getAggressionColor(level);
                              return (
                                <button
                                  key={month}
                                  style={{
                                    border: `2px solid ${c.border}`,
                                    background: c.bg,
                                    borderRadius: "0.5rem",
                                    padding: "0.75rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                  }}
                                  onClick={() =>
                                    handleAggressionClick(
                                      String(hotel.hotel_id),
                                      month
                                    )
                                  }
                                >
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      textTransform: "uppercase",
                                      color: c.text,
                                    }}
                                  >
                                    {month.slice(0, 3)}
                                  </span>
                                  <div
                                    style={{
                                      width: "0.375rem",
                                      height: "0.375rem",
                                      borderRadius: "50%",
                                      background: c.text,
                                    }}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 5. Monthly Min Rates */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          <h3
                            style={{
                              color: "#e5e5e5",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              fontSize: "0.75rem",
                            }}
                          >
                            Monthly Min Rates
                          </h3>
                          <div
                            style={{
                              background: "#0f0f0f",
                              border: "1px solid #2a2a2a",
                              borderRadius: "0.5rem",
                              padding: "1rem",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(12, 1fr)",
                                gap: "0.5rem",
                              }}
                            >
                              {MONTH_ORDER.map((month) => (
                                <div
                                  key={month}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: "#9ca3af",
                                      fontSize: "9px",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {month.slice(0, 3)}
                                  </span>
                                  <Input
                                    type="number"
                                    value={
                                      formState[hotel.hotel_id]
                                        ?.monthly_min_rates?.[month] || ""
                                    }
                                    onChange={(e) =>
                                      updateRule(
                                        String(hotel.hotel_id),
                                        `monthly_min_rates.${month}`,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      backgroundColor: "#1a1a1a",
                                      borderColor: "#2a2a2a",
                                      color: "#e5e5e5",
                                      fontSize: "10px",
                                      textAlign: "center",
                                      height: "1.75rem",
                                      padding: "0 4px",
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={{ borderTop: "1px solid #2a2a2a" }}></div>

                        {/* 6. Admin Controls */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                            paddingTop: "1rem",
                          }}
                        >
                          <h3
                            style={{
                              color: "#9ca3af",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              fontSize: "0.75rem",
                            }}
                          >
                            Admin Controls
                          </h3>
                          <div style={{ display: "flex", gap: "0.75rem" }}>
                            <Button
                              variant="outline"
                              style={{
                                backgroundColor: "#161616",
                                borderColor: "rgba(57, 189, 248, 0.5)",
                                color: "#39BDF8",
                              }}
                              onClick={() =>
                                activateHotel(
                                  String(hotel.hotel_id),
                                  hotel.pms_property_id
                                )
                              }
                              disabled={isSyncing === String(hotel.hotel_id)}
                            >
                              {isSyncing === String(hotel.hotel_id) && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}{" "}
                              Sync with PMS
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                handleRepushRates(String(hotel.hotel_id))
                              }
                              disabled={isRepushing === String(hotel.hotel_id)}
                              style={{
                                backgroundColor: "rgba(250, 255, 106, 0.1)",
                                borderColor: "rgba(250, 255, 106, 0.5)",
                                color: "#faff6a",
                              }}
                            >
                              {isRepushing === String(hotel.hotel_id) && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              Re-Push Rates
                            </Button>
                            <Button
                              variant="outline"
                              style={{
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                borderColor: "rgba(239, 68, 68, 0.5)",
                                color: "#ef4444",
                              }}
                            >
                              Force Sync
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                handleExportReservations(String(hotel.hotel_id))
                              }
                              style={{
                                backgroundColor: "rgba(147, 51, 234, 0.1)",
                                borderColor: "rgba(147, 51, 234, 0.5)",
                                color: "#a855f7",
                              }}
                            >
                              Export Res (SQL)
                            </Button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            paddingTop: "1rem",
                          }}
                        >
                          <Button
                            style={{
                              backgroundColor: "#39BDF8",
                              color: "#0f0f0f",
                            }}
                            onClick={() => saveRules(String(hotel.hotel_id))}
                            disabled={isSaving === String(hotel.hotel_id)}
                          >
                            {isSaving === String(hotel.hotel_id) && (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            )}{" "}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {/* 4. PMS WEBHOOK MANAGEMENT (Restored Mock) */}
        <Card style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <CardHeader>
            <CardTitle style={{ color: "#e5e5e5", fontSize: "1.25rem" }}>
              PMS Webhook Management
            </CardTitle>
            <CardDescription style={{ color: "#9ca3af" }}>
              Monitor and manage PMS webhook integration status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              style={{
                border: "1px solid #2a2a2a",
                borderRadius: "0.5rem",
                overflow: "hidden",
              }}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2a2a2a] hover:bg-transparent">
                    <TableHead style={{ color: "#9ca3af" }}>
                      Property Name
                    </TableHead>
                    <TableHead style={{ color: "#9ca3af" }}>
                      Webhook Status
                    </TableHead>
                    <TableHead style={{ color: "#9ca3af", textAlign: "right" }}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow
                      key={webhook.id}
                      className="border-[#2a2a2a] hover:bg-[#161616]"
                    >
                      <TableCell style={{ color: "#e5e5e5" }}>
                        {webhook.propertyName}
                      </TableCell>
                      <TableCell>
                        {webhook.status === "success" ? (
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: "rgba(16, 185, 129, 0.1)",
                              color: "#10b981",
                              borderColor: "rgba(16, 185, 129, 0.3)",
                            }}
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: "rgba(239, 68, 68, 0.1)",
                              color: "#ef4444",
                              borderColor: "rgba(239, 68, 68, 0.3)",
                            }}
                          >
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "0.5rem",
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: "#39BDF8" }}
                            className="hover:text-[#29ADEE] hover:bg-[#39BDF8]/10"
                          >
                            Register
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: "#faff6a" }}
                            className="hover:text-[#faff6a]/80 hover:bg-[#faff6a]/10"
                          >
                            Test
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent
          style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#e5e5e5" }}>Add Event</DialogTitle>
          </DialogHeader>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <Input
              type="date"
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
            />
            <Input
              placeholder="Event Name"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              style={{
                backgroundColor: "#0f0f0f",
                borderColor: "#2a2a2a",
                color: "#e5e5e5",
              }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddEvent}
              style={{ backgroundColor: "#39BDF8", color: "#0f0f0f" }}
            >
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
