import React, { useEffect, useState, useMemo } from "react";

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
  Calendar as CalendarIcon,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
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
import { getDailyMaxRates as fetchDailyMaxRates } from "../../api/sentinel.api"; // [NEW] API Import
import { DailyMaxRatesDialog } from "./DailyMaxRatesDialog";
import { YearlyRatesVisualization } from "./YearlyRatesVisualization";
import { ImportCurvesDialog } from "./ImportCurvesDialog";
import { PromoConfigSection } from "./PromoConfigSection";

// --- VISUAL CONSTANTS ---

const tabTriggerStyle: React.CSSProperties = {
  color: "#7A8494",
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
  backgroundColor: "rgba(56, 198, 186, 0.1)",
  color: "#38C6BA",
  borderColor: "rgba(56, 198, 186, 0.5)",
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

// [FIX] Stable reference for empty rates to prevent re-renders
const EMPTY_RATES = {};

const getAggressionColor = (level: string) => {
  switch (level) {
    case "low":
      return {
        bg: "rgba(56,198,186,0.06)",
        text: "#38C6BA",
        border: "rgba(56,198,186,0.15)",
      };
    case "medium":
    case "mid":
      return {
        bg: "rgba(200,166,110,0.06)",
        text: "#C8A66E",
        border: "rgba(200,166,110,0.15)",
      };
    case "high":
      return {
        bg: "rgba(239,68,68,0.06)",
        text: "#ef4444",
        border: "rgba(239,68,68,0.15)",
      };
    default:
      return {
        bg: "rgba(78,88,104,0.1)",
        text: "#4E5868",
        border: "rgba(78,88,104,0.2)",
      };
  }
};

interface ControlPanelViewProps {
  allHotels: any[];
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
    // Rate Plan Picker (Mews)
    ratePlanPicker,
    completeActivation,
    dismissRatePlanPicker,
    // Promo Config
    calculatorStates,
    updateCalculator,
    savePromoConfig,
    getAssetForHotel,
    isCampaignValidForDate,
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
  // Rate Plan Picker (Mews)
  const [selectedRateId, setSelectedRateId] = useState<string>("");
  const [ratePlanSearch, setRatePlanSearch] = useState("");

  // [NEW] Max Rates badge presence map (daily ceilings present in DB)
  const [hasMaxRatesByHotelId, setHasMaxRatesByHotelId] = useState<
    Record<string, boolean>
  >({});
  // [NEW] Pace Curves presence map (Low/Mid/High curves in DB)
  const [hasCurvesByHotelId, setHasCurvesByHotelId] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    let cancelled = false;

    const loadPresenceData = async () => {
      if (!activeHotels || activeHotels.length === 0) {
        setHasMaxRatesByHotelId({});
        setHasCurvesByHotelId({});
        return;
      }

      // 1. Load Max Rates
      const maxRatesPromises = activeHotels
        .map((hotel: any) => hotel.hotel_id ?? hotel.id)
        .filter((rawId) => rawId)
        .map(async (rawId: any) => {
          const id = String(rawId);
          try {
            const res = await fetch(`/api/sentinel/max-rates/${id}`);
            const json = await res.json();
            const has =
              !!json?.success &&
              !!json?.data &&
              Object.keys(json.data).length > 0;
            return [id, has] as const;
          } catch {
            return [id, false] as const;
          }
        });

      // 2. Load Pace Curves
      const curvesPromises = activeHotels
        .map((hotel: any) => hotel.hotel_id ?? hotel.id)
        .filter((rawId) => rawId)
        .map(async (rawId: any) => {
          const id = String(rawId);
          try {
            const res = await fetch(`/api/sentinel/pace-curves/${id}`);
            const json = await res.json();
            // Check if we have at least 3 curves (Low, Mid, High)
            const has =
              !!json?.success &&
              Array.isArray(json?.data) &&
              json.data.length >= 3;
            return [id, has] as const;
          } catch {
            return [id, false] as const;
          }
        });

      const [maxRatesResults, curvesResults] = await Promise.all([
        Promise.all(maxRatesPromises),
        Promise.all(curvesPromises),
      ]);

      if (cancelled) return;
      setHasMaxRatesByHotelId(Object.fromEntries(maxRatesResults));
      setHasCurvesByHotelId(Object.fromEntries(curvesResults));
    };

    loadPresenceData();

    return () => {
      cancelled = true;
    };
  }, [activeHotels]);

  // Market Events State (DB Driven)
  const [londonEvents, setLondonEvents] = useState<any[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const groupedEvents = useMemo(() => {
    const groups: Record<string, any[]> = {};
    londonEvents.forEach((ev) => {
      if (!groups[ev.event_name]) groups[ev.event_name] = [];
      groups[ev.event_name].push(ev);
    });

    return Object.entries(groups)
      .map(([name, events]) => {
        events.sort(
          (a, b) =>
            new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
        );
        const start = new Date(events[0].event_date)
          .toISOString()
          .split("T")[0];
        const end = new Date(events[events.length - 1].event_date)
          .toISOString()
          .split("T")[0];

        const maxMult = Math.max(
          ...events.map((e) => parseFloat(e.impact_multiplier)),
        );

        return {
          name,
          start,
          end,
          events,
          isSingleDay: start === end,
          count: events.length,
          maxMult,
        };
      })
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
  }, [londonEvents]);

  // Bulk Builder State
  const [newEventStartDate, setNewEventStartDate] = useState("");
  const [newEventEndDate, setNewEventEndDate] = useState("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventImpact, setNewEventImpact] = useState("1.50"); // Default to Base
  const [generatedEvents, setGeneratedEvents] = useState<any[]>([]);

  // Magic List Generator: Rebuilds the preview list when dates change
  useEffect(() => {
    if (newEventStartDate && newEventEndDate && newEventName) {
      const start = new Date(newEventStartDate);
      const end = new Date(newEventEndDate);

      // Max 60 days to prevent browser lockup from fat-fingered dates
      if (start <= end && (end.getTime() - start.getTime()) / 86400000 <= 60) {
        setGeneratedEvents((prev) => {
          const events = [];
          let current = new Date(start);
          while (current <= end) {
            const dateStr = current.toISOString().split("T")[0];
            // Preserve user tweaks if they already modified this row
            const existing = prev.find((e) => e.date === dateStr);
            events.push({
              date: dateStr,
              name: newEventName,
              impact: existing ? existing.impact : newEventImpact,
            });
            current.setDate(current.getDate() + 1);
          }
          return events;
        });
      }
    } else {
      setGeneratedEvents([]);
    }
  }, [newEventStartDate, newEventEndDate, newEventName, newEventImpact]);

  useEffect(() => {
    fetch("/api/sentinel/market-events/london")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setLondonEvents(data.data);
      })
      .catch(console.error);
  }, []);

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

  // --- Helpers ---

  // --- Helpers ---

  // --- Helpers ---

  // [FIX] Safely retrieve daily_max_rates handling potential casing issues or nulls
  // Uses EMPTY_RATES to ensure React doesn't see "new" data on every render
  const getDailyMaxRates = (hotelId: string) => {
    const config = formState[hotelId];
    if (!config) return EMPTY_RATES;
    return (
      config.daily_max_rates || (config as any).dailyMaxRates || EMPTY_RATES
    );
  };

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
    newValue: string,
  ) => {
    const currentDiffs = formState[hotelId]?.room_differentials || [];
    const exists = currentDiffs.find((r: any) => r.roomTypeId === roomTypeId);
    let newDiffs;
    if (exists) {
      newDiffs = currentDiffs.map((r: any) =>
        r.roomTypeId === roomTypeId ? { ...r, [field]: newValue } : r,
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
          body: JSON.stringify({
            hotelId,
            startDate: new Date().toISOString().split("T")[0],
            endDate: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
          }),
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
      },
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
      },
    );
  };

  // [FIX] Missing helper function to save daily max rates
  const saveDailyMaxRates = async (
    hotelId: string,
    rates: Record<string, string>,
  ) => {
    const res = await fetch(`/api/sentinel/max-rates/${hotelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rates }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  };

  const handleAddEvent = async () => {
    if (generatedEvents.length === 0) return;
    try {
      const payloadEvents = generatedEvents.map((e) => ({
        eventDate: e.date,
        eventName: e.name,
        impactMultiplier: parseFloat(e.impact),
      }));

      const res = await fetch("/api/sentinel/market-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketSlug: "london",
          events: payloadEvents,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Refetch everything to guarantee the table is perfectly in sync
        fetch("/api/sentinel/market-events/london")
          .then((r) => r.json())
          .then((d) => {
            if (d.success) setLondonEvents(d.data);
          });

        setIsAddEventOpen(false);
        setNewEventStartDate("");
        setNewEventEndDate("");
        setNewEventName("");
        setGeneratedEvents([]);
        toast.success(`Successfully added ${payloadEvents.length} event days.`);
      } else {
        toast.error(data.error || "Failed to add events");
      }
    } catch (err) {
      toast.error("Network error adding events");
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/sentinel/market-events/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setLondonEvents(londonEvents.filter((e) => e.id !== id));
        toast.success("Market event removed.");
      }
    } catch (err) {
      toast.error("Failed to delete event");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#14181D",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
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


      <div
        style={{
          padding: "28px 32px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase", color: "#C8A66E", marginBottom: 8 }}>SENTINEL</div>
          <h1
            style={{
              color: "#F3F5F7",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.5px",
              marginBottom: "6px",
            }}
          >
            AI Control Panel
          </h1>
          <p style={{ color: "#7A8494", fontSize: "0.8125rem" }}>
            PMS Integration & AI Configuration
          </p>
        </div>

        {/* 1. ACTIVATION CARD */}
        {availableHotels.length > 0 && (
          <div style={{ marginBottom: "2rem" }}>
            <Card
              style={{
                backgroundColor: "#121519",
                borderColor: "#1E2330",
                borderRadius: "10px",
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
                        backgroundColor: "rgba(56, 198, 186, 0.1)",
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
                        <span style={{ color: "#38C6BA", fontWeight: "bold" }}>
                          {activeHotels.length + 1}
                        </span>
                      </div>
                    </div>
                    <h3
                      style={{
                        color: "#F3F5F7",
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
                              backgroundColor: "#121519",
                              border: "1px solid rgba(56, 198, 186, 0.3)",
                              color: "#F3F5F7",
                            }}
                          >
                            {hotelToActivate
                              ? availableHotels.find(
                                  (h) => String(h.hotel_id) === hotelToActivate,
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
                            backgroundColor: "#121519",
                            border: "1px solid rgba(56, 198, 186, 0.3)",
                          }}
                          align="start"
                        >
                          <Command style={{ backgroundColor: "#121519" }}>
                            <CommandInput
                              placeholder="Search..."
                              className="text-[#F3F5F7]"
                            />
                            <CommandEmpty
                              style={{
                                color: "#7A8494",
                                padding: "1.5rem 0",
                                textAlign: "center",
                                fontSize: "0.875rem",
                              }}
                            >
                              No hotel found.
                            </CommandEmpty>
                            <CommandGroup
                              style={{
                                backgroundColor: "#121519",
                                padding: "0.5rem",
                              }}
                            >
                              {availableHotels.map((hotel) => (
                                <CommandItem
                                  key={hotel.hotel_id}
                                  value={String(hotel.hotel_id)}
                                  onSelect={(val) => {
                                    setHotelToActivate(
                                      val === hotelToActivate ? "" : val,
                                    );
                                    setIsComboOpen(false);
                                  }}
                                  style={{
                                    color: "#F3F5F7",
                                    cursor: "pointer",
                                    borderRadius: "0.25rem",
                                    padding: "0.5rem",
                                  }}
                                  className="hover:bg-[#121519]"
                                >
                                  <Check
                                    style={{
                                      marginRight: "0.5rem",
                                      height: "1rem",
                                      width: "1rem",
                                      color: "#38C6BA",
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
                        backgroundColor: "#38C6BA",
                        color: "#121519",
                        fontWeight: 500,
                      }}
                      onClick={() => {
                        const h = availableHotels.find(
                          (h) => String(h.hotel_id) === hotelToActivate,
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

        {/* RATE PLAN PICKER DIALOG (Mews properties with multiple root rate plans) */}
        <Dialog
          open={!!ratePlanPicker}
          onOpenChange={(open) => {
            if (!open) {
              dismissRatePlanPicker();
              setSelectedRateId("");
              setRatePlanSearch("");
            }
          }}
        >
          <DialogContent
            style={{
              backgroundColor: "#121519",
              borderColor: "#1E2330",
              maxWidth: "600px",
              maxHeight: "80vh",
            }}
          >
            <DialogHeader>
              <DialogTitle style={{ color: "#F3F5F7" }}>
                Select Rate Plan
              </DialogTitle>
              <DialogDescription style={{ color: "#7A8494" }}>
                This property has{" "}
                <span style={{ color: "#38C6BA", fontWeight: 600 }}>
                  {ratePlanPicker?.ratePlans.length}
                </span>{" "}
                root rate plans. Select the base rate plan Sentinel should use
                for pricing.
              </DialogDescription>
            </DialogHeader>

            <div style={{ margin: "0.75rem 0" }}>
              <Input
                placeholder="Search rate plans..."
                value={ratePlanSearch}
                onChange={(e) => setRatePlanSearch(e.target.value)}
                style={{
                  backgroundColor: "#1E2330",
                  borderColor: "#1E2330",
                  color: "#F3F5F7",
                }}
              />
            </div>

            <div
              style={{
                maxHeight: "400px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {ratePlanPicker?.ratePlans
                .filter((rp) =>
                  ratePlanSearch
                    ? (rp.ratePlanName || "")
                        .toLowerCase()
                        .includes(ratePlanSearch.toLowerCase())
                    : true
                )
                .map((rp) => {
                  const isAutoSuggested =
                    rp.rateID === ratePlanPicker.autoSelected;
                  const isSelected = rp.rateID === selectedRateId;
                  return (
                    <div
                      key={rp.rateID}
                      onClick={() => setSelectedRateId(rp.rateID)}
                      style={{
                        padding: "0.75rem 1rem",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        border: isSelected
                          ? "1px solid #38C6BA"
                          : "1px solid #1E2330",
                        backgroundColor: isSelected
                          ? "rgba(56,198,186,0.08)"
                          : "#14181D",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                        <div
                          style={{
                            width: "1rem",
                            height: "1rem",
                            borderRadius: "50%",
                            border: isSelected
                              ? "5px solid #38C6BA"
                              : "2px solid #4E5868",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            color: "#F3F5F7",
                            fontSize: "0.875rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {rp.ratePlanName}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                        {isAutoSuggested && (
                          <Badge
                            style={{
                              backgroundColor: "rgba(56,198,186,0.15)",
                              color: "#38C6BA",
                              fontSize: "0.7rem",
                              padding: "0.125rem 0.5rem",
                            }}
                          >
                            Suggested
                          </Badge>
                        )}
                        {(rp as any).isPublic && (
                          <Badge
                            style={{
                              backgroundColor: "rgba(56,198,186,0.15)",
                              color: "#38C6BA",
                              fontSize: "0.7rem",
                              padding: "0.125rem 0.5rem",
                            }}
                          >
                            Public
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <DialogFooter style={{ marginTop: "1rem" }}>
              <Button
                variant="outline"
                onClick={() => {
                  dismissRatePlanPicker();
                  setSelectedRateId("");
                  setRatePlanSearch("");
                }}
                style={{
                  borderColor: "#1E2330",
                  color: "#7A8494",
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedRateId || isSyncing !== null}
                onClick={() => {
                  if (ratePlanPicker && selectedRateId) {
                    completeActivation(
                      ratePlanPicker.hotelId,
                      ratePlanPicker.pmsPropertyId,
                      selectedRateId
                    );
                    setSelectedRateId("");
                    setRatePlanSearch("");
                  }
                }}
                style={{
                  backgroundColor:
                    selectedRateId ? "#38C6BA" : "rgba(56,198,186,0.3)",
                  color: "#121519",
                  fontWeight: 500,
                }}
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Activate with Selected Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. MARKET STRATEGY CARD */}
        <div style={{ marginBottom: "2rem" }}>
          <Card
            style={{
              backgroundColor: "#121519",
              borderColor: "#1E2330",
              borderRadius: "10px",
            }}
          >
            <CardHeader
              style={{
                borderBottom: "1px solid rgba(255,255,255,0.04)",
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
                    background: "rgba(56,198,186,0.1)",
                    borderRadius: "0.5rem",
                  }}
                >
                  <Globe2
                    style={{
                      width: "1.5rem",
                      height: "1.5rem",
                      color: "#38C6BA",
                    }}
                  />
                </div>
                <div>
                  <CardTitle
                    style={{
                      color: "#F3F5F7",
                      fontSize: "1.5rem",
                      textTransform: "uppercase",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    Market Strategy & VITALS
                  </CardTitle>
                  <CardDescription
                    style={{ color: "#7A8494", marginTop: "0.25rem" }}
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
                    backgroundColor: "#121519",
                    display: "grid",
                    gridTemplateColumns: "repeat(1, 1fr)",
                    border: "1px solid #1E2330",
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
                            color: "#C8A66E",
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          Manual Events
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddEventOpen(true)}
                          style={{
                            backgroundColor: "#121519",
                            borderColor: "#1E2330",
                            color: "#F3F5F7",
                          }}
                        >
                          <Plus className="w-3 h-3 mr-2" /> Add Event
                        </Button>
                      </div>
                      <div
                        style={{
                          background: "#121519",
                          border: "1px solid #1E2330",
                          borderRadius: "0.5rem",
                          overflow: "hidden",
                        }}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow className="border-[#1E2330] hover:bg-transparent">
                              <TableHead style={{ color: "#7A8494" }}>
                                Date
                              </TableHead>
                              <TableHead style={{ color: "#7A8494" }}>
                                Event Name
                              </TableHead>
                              <TableHead style={{ color: "#7A8494" }}>
                                Impact
                              </TableHead>
                              <TableHead
                                style={{ color: "#7A8494", textAlign: "right" }}
                              >
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupedEvents.map((group) => {
                              // Determine Summary Badge style based on maxMult
                              let impactLabel = "High Demand";
                              let color = "#ef4444";
                              let bg = "rgba(239, 68, 68, 0.1)";
                              let border = "rgba(239, 68, 68, 0.3)";

                              if (group.maxMult <= 1.5) {
                                impactLabel = "Medium Demand";
                                color = "#38C6BA";
                                bg = "rgba(200, 166, 110, 0.1)";
                                border = "rgba(200, 166, 110, 0.3)";
                              } else if (group.maxMult >= 2.5) {
                                impactLabel = "Extreme Demand";
                                color = "#c084fc";
                                bg = "rgba(147, 51, 234, 0.1)";
                                border = "rgba(147, 51, 234, 0.3)";
                              }

                              return (
                                <React.Fragment key={group.name}>
                                  {/* SUMMARY ROW */}
                                  <TableRow
                                    className="hover:bg-[#121519]"
                                    style={{
                                      borderBottom: expandedGroups[group.name]
                                        ? "none"
                                        : "1px solid #1E2330",
                                      backgroundColor: expandedGroups[
                                        group.name
                                      ]
                                        ? "rgba(255,255,255,0.02)"
                                        : "transparent",
                                    }}
                                  >
                                    <TableCell
                                      style={{
                                        color: "#F3F5F7",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {group.isSingleDay
                                        ? group.start
                                        : `${group.start} to ${group.end}`}
                                    </TableCell>
                                    <TableCell
                                      style={{
                                        color: "#F3F5F7",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {group.name}{" "}
                                      {group.count > 1 && (
                                        <span
                                          style={{
                                            color: "#7A8494",
                                            fontSize: "0.75rem",
                                            marginLeft: "8px",
                                          }}
                                        >
                                          ({group.count} days)
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        style={{
                                          backgroundColor: bg,
                                          color: color,
                                          borderColor: border,
                                        }}
                                      >
                                        {group.count > 1 ? "Peak: " : ""}
                                        {impactLabel} ({group.maxMult}x)
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "flex-end",
                                          gap: "0.5rem",
                                        }}
                                      >
                                        {group.count > 1 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              toggleGroup(group.name)
                                            }
                                            style={{ color: "#7A8494" }}
                                          >
                                            {expandedGroups[group.name] ? (
                                              <ChevronUp
                                                style={{
                                                  width: "1rem",
                                                  height: "1rem",
                                                }}
                                              />
                                            ) : (
                                              <ChevronDown
                                                style={{
                                                  width: "1rem",
                                                  height: "1rem",
                                                }}
                                              />
                                            )}
                                          </Button>
                                        )}
                                        {group.count === 1 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            style={{ color: "#ef4444" }}
                                            onClick={() =>
                                              handleDeleteEvent(
                                                group.events[0].id,
                                              )
                                            }
                                          >
                                            <Trash2
                                              style={{
                                                width: "1rem",
                                                height: "1rem",
                                              }}
                                            />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>

                                  {/* EXPANDED INDIVIDUAL DAYS */}
                                  {expandedGroups[group.name] &&
                                    group.count > 1 &&
                                    group.events.map(
                                      (event: any, idx: number) => {
                                        let eLabel = "High Demand";
                                        let eColor = "#ef4444";
                                        let eBg = "rgba(239, 68, 68, 0.05)";
                                        let eBorder = "rgba(239, 68, 68, 0.2)";
                                        const eMult = parseFloat(
                                          event.impact_multiplier,
                                        );

                                        if (eMult <= 1.5) {
                                          eLabel = "Medium Demand";
                                          eColor = "#38C6BA";
                                          eBg = "rgba(200, 166, 110, 0.05)";
                                          eBorder = "rgba(200, 166, 110, 0.2)";
                                        } else if (eMult >= 2.5) {
                                          eLabel = "Extreme Demand";
                                          eColor = "#c084fc";
                                          eBg = "rgba(147, 51, 234, 0.05)";
                                          eBorder = "rgba(147, 51, 234, 0.2)";
                                        }

                                        const formattedDate = new Date(
                                          event.event_date,
                                        )
                                          .toISOString()
                                          .split("T")[0];
                                        const isLast =
                                          idx === group.events.length - 1;

                                        return (
                                          <TableRow
                                            key={event.id}
                                            className="hover:bg-[#121519]"
                                            style={{
                                              backgroundColor:
                                                "rgba(0,0,0,0.15)",
                                              borderBottom: isLast
                                                ? "1px solid #1E2330"
                                                : "none",
                                            }}
                                          >
                                            <TableCell
                                              style={{
                                                color: "#7A8494",
                                                paddingLeft: "2rem",
                                              }}
                                            >
                                              └ {formattedDate}
                                            </TableCell>
                                            <TableCell
                                              style={{ color: "#7A8494" }}
                                            ></TableCell>
                                            <TableCell>
                                              <Badge
                                                variant="outline"
                                                style={{
                                                  backgroundColor: eBg,
                                                  color: eColor,
                                                  borderColor: eBorder,
                                                  opacity: 0.8,
                                                }}
                                              >
                                                {eMult}x
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                style={{
                                                  color: "#ef4444",
                                                  opacity: 0.7,
                                                }}
                                                className="hover:opacity-100"
                                                onClick={() =>
                                                  handleDeleteEvent(event.id)
                                                }
                                              >
                                                <Trash2
                                                  style={{
                                                    width: "1rem",
                                                    height: "1rem",
                                                  }}
                                                />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      },
                                    )}
                                </React.Fragment>
                              );
                            })}
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
                          color: "#C8A66E",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        Market Vitals
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
                            background: "#121519",
                            border: "1px solid #1E2330",
                            borderRadius: "0.25rem",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#7A8494", fontSize: "10px" }}>
                            LEAD
                          </span>
                          <span
                            style={{ color: "#F3F5F7", fontSize: "0.875rem" }}
                          >
                            21d
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#121519",
                            border: "1px solid #1E2330",
                            borderRadius: "0.25rem",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#7A8494", fontSize: "10px" }}>
                            LOS
                          </span>
                          <span
                            style={{ color: "#F3F5F7", fontSize: "0.875rem" }}
                          >
                            2.8n
                          </span>
                        </div>
                        <div
                          style={{
                            background: "#121519",
                            border: "1px solid #1E2330",
                            borderRadius: "0.25rem",
                            padding: "0.5rem",
                            display: "flex",
                            alignItems: "baseline",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ color: "#7A8494", fontSize: "10px" }}>
                            PACE
                          </span>
                          <span
                            style={{ color: "#38C6BA", fontSize: "0.875rem" }}
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
                background: "#121519",
                border: "1px solid #1E2330",
                borderRadius: "0.5rem",
              }}
            >
              <Loader2
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  color: "#38C6BA",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span style={{ color: "#7A8494", marginLeft: "0.75rem" }}>
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
              {activeHotels.map((hotel) => {
                // [NEW] AI Readiness Calculation
                const hasMaxRates =
                  hasMaxRatesByHotelId[String(hotel.hotel_id)] ?? false;
                const hasCurves =
                  hasCurvesByHotelId[String(hotel.hotel_id)] ?? false;

                const config = formState[hotel.hotel_id] ?? hotel.config ?? {};

                const hasDifferentials =
                  Array.isArray(config.room_differentials) &&
                  config.room_differentials.length > 0;

                const hasSeasonality =
                  config.seasonality_profile &&
                  Object.keys(config.seasonality_profile).length === 12;

                const hasMinRates =
                  config.monthly_min_rates &&
                  Object.keys(config.monthly_min_rates).length > 0;

                const isAiReady =
                  hasMaxRates &&
                  hasCurves &&
                  hasDifferentials &&
                  hasSeasonality &&
                  hasMinRates;

                const isAutopilot =
                  formState[hotel.hotel_id]?.is_autopilot_enabled ??
                  hotel.config?.is_autopilot_enabled ??
                  false;

                const strategyMode =
                  formState[hotel.hotel_id]?.rules?.strategy_mode ??
                  hotel.config?.rules?.strategy_mode ??
                  "maintain";

                return (
                  <AccordionItem
                    key={hotel.hotel_id}
                    value={String(hotel.hotel_id)}
                    style={{
                      backgroundColor: "#121519",
                      borderLeft: `3px solid ${
                        hotel.config?.sentinel_enabled
                          ? "#38C6BA"
                          : "#1E2330"
                      }`,
                      borderRight: `1px solid ${
                        openAccordionItem === String(hotel.hotel_id)
                          ? "rgba(255,255,255,0.06)"
                          : "#1E2330"
                      }`,
                      borderTop: `1px solid ${
                        openAccordionItem === String(hotel.hotel_id)
                          ? "rgba(255,255,255,0.06)"
                          : "#1E2330"
                      }`,
                      borderBottom: `1px solid ${
                        openAccordionItem === String(hotel.hotel_id)
                          ? "rgba(255,255,255,0.06)"
                          : "#1E2330"
                      }`,
                      borderRadius: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <AccordionTrigger
                      style={{
                        padding: "13px 20px",
                        backgroundColor: "#121519",
                      }}
                      className="hover:no-underline"
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 120px 130px 80px 80px",
                          gap: "12px",
                          width: "100%",
                          paddingRight: "1rem",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ color: "#F3F5F7", fontWeight: 600, fontSize: "13px", letterSpacing: "-0.3px" }}>
                            {hotel.property_name}
                          </span>
                          <span style={{ color: "#4E5868", fontSize: "10px", fontVariantNumeric: "tabular-nums" }}>
                            #{hotel.hotel_id}
                          </span>
                        </div>

                        <div>
                          {isAutopilot
                            ? <span style={{ fontSize: 10, fontWeight: 600, color: "#38C6BA", padding: "3px 10px", borderRadius: 4, background: "rgba(56,198,186,0.10)", border: "1px solid rgba(56,198,186,0.20)" }}>AUTOPILOT</span>
                            : <span style={{ fontSize: 10, color: "#4E5868" }}>Manual</span>
                          }
                        </div>

                        <span style={{ fontSize: 11, color: strategyMode === "sell_every_room" ? "#C8A66E" : "#7A8494", fontWeight: 500 }}>
                          {strategyMode === "sell_every_room" ? "Sell Every Room" : "Maintain"}
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 5, height: 5, borderRadius: 3, background: hotel.config?.sentinel_enabled ? "#34D068" : "#4E5868" }} />
                          <span style={{ fontSize: 11, color: hotel.config?.sentinel_enabled ? "#B0B8C4" : "#4E5868" }}>
                            {hotel.config?.sentinel_enabled ? "Active" : "Paused"}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 3, alignItems: "center", justifyContent: "flex-end" }}>
                          {[hasMinRates, hasMaxRates, hasCurves, hasSeasonality, hasDifferentials].map((ok, idx) => (
                            <div key={idx} style={{ width: 5, height: 5, borderRadius: 3, background: ok ? "#38C6BA" : "rgba(78,88,104,0.5)" }} title={["MIN","MAX","Curves","Season","Diffs"][idx]} />
                          ))}
                          <span style={{ fontSize: 10, color: isAiReady ? "#38C6BA" : "#4E5868", marginLeft: 3, fontWeight: 600 }}>
                            {[hasMinRates, hasMaxRates, hasCurves, hasSeasonality, hasDifferentials].filter(Boolean).length}/5
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent
                      style={{
                        backgroundColor: "#121519",
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
                            minHeight: "500px", // Prevents layout shift/flicker
                          }}
                        >
                          <Loader2
                            style={{
                              width: "1.5rem",
                              height: "1.5rem",
                              color: "#38C6BA",
                              animation: "spin 1s linear infinite",
                            }}
                          />
                          <span
                            style={{ color: "#7A8494", marginLeft: "0.75rem" }}
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
                          {/* 1. Settings Grid - UNIFIED HEIGHTS */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(2, 1fr)",
                              gap: "1rem",
                            }}
                          >
                            {/* 1. Sentinel Toggle */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0 1rem",
                                height: "60px",
                                background: "#121519",
                                border: "1px solid #1E2330",
                                borderRadius: "0.5rem",
                              }}
                            >
                              <Label
                                htmlFor={`sentinel-status-${hotel.hotel_id}`}
                                style={{
                                  color: "#F3F5F7",
                                  fontSize: "0.875rem",
                                }}
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
                                    c,
                                  )
                                }
                              />
                            </div>

                            {/* 1.5 Sentinel Mode (Autonomy) */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0 1rem",
                                height: "60px",
                                // [FIX] Fallback to hotel.config to ensure UI shows DB state
                                background:
                                  (formState[hotel.hotel_id]
                                    ?.is_autopilot_enabled ??
                                  hotel.config?.is_autopilot_enabled)
                                    ? "rgba(56, 198, 186, 0.1)"
                                    : "#121519",
                                border:
                                  (formState[hotel.hotel_id]
                                    ?.is_autopilot_enabled ??
                                  hotel.config?.is_autopilot_enabled)
                                    ? "1px solid rgba(56, 198, 186, 0.3)"
                                    : "1px solid #1E2330",
                                borderRadius: "0.5rem",
                                transition: "all 0.3s ease",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Label
                                  htmlFor={`autopilot-status-${hotel.hotel_id}`}
                                  style={{
                                    color: "#F3F5F7",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  Sentinel Mode
                                </Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle
                                        style={{
                                          width: "14px",
                                          height: "14px",
                                          color: isAiReady
                                            ? "#ef4444"
                                            : "#C8A66E",
                                        }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      style={{
                                        backgroundColor: "#121519",
                                        borderColor: isAiReady
                                          ? "#ef4444"
                                          : "#C8A66E",
                                      }}
                                    >
                                      {isAiReady ? (
                                        <p
                                          style={{
                                            fontSize: "11px",
                                            color: "#ef4444",
                                          }}
                                        >
                                          WARNING: Enabling this allows Sentinel
                                          to update live rates in the PMS
                                          without manual approval.
                                        </p>
                                      ) : (
                                        <div
                                          style={{
                                            fontSize: "11px",
                                            color: "#C8A66E",
                                          }}
                                        >
                                          <p
                                            style={{
                                              fontWeight: 600,
                                              marginBottom: "4px",
                                            }}
                                          >
                                            Autopilot Locked. Missing:
                                          </p>
                                          <ul
                                            style={{
                                              paddingLeft: "12px",
                                              margin: 0,
                                            }}
                                          >
                                            {!hasSeasonality && (
                                              <li>Seasonality Profile</li>
                                            )}
                                            {!hasMinRates && (
                                              <li>Monthly Min Rates</li>
                                            )}
                                            {!hasMaxRates && (
                                              <li>Daily Max Rates</li>
                                            )}
                                            {!hasCurves && <li>Pace Curves</li>}
                                            {!hasDifferentials && (
                                              <li>Room Differentials</li>
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Switch
                                id={`autopilot-status-${hotel.hotel_id}`}
                                disabled={!isAiReady}
                                // [FIX] Robust check: Look at Form State -> Then Config -> Then False
                                checked={
                                  formState[hotel.hotel_id]
                                    ?.is_autopilot_enabled ??
                                  hotel.config?.is_autopilot_enabled ??
                                  false
                                }
                                onCheckedChange={(c) =>
                                  updateRule(
                                    String(hotel.hotel_id),
                                    "is_autopilot_enabled",
                                    c,
                                  )
                                }
                              />
                            </div>
                            {/* 2. Yield Strategy (NEW) */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0 1rem",
                                height: "60px",
                                background: "#121519",
                                border: "1px solid #1E2330",
                                borderRadius: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Label
                                  style={{
                                    color: "#F3F5F7",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  Yield Strategy
                                </Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle
                                        style={{
                                          width: "14px",
                                          height: "14px",
                                          color: "#4E5868",
                                        }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      style={{
                                        backgroundColor: "#121519",
                                        borderColor: "#1E2330",
                                      }}
                                    >
                                      <p
                                        style={{
                                          fontSize: "11px",
                                          color: "#F3F5F7",
                                        }}
                                      >
                                        Maintain: Optimize for ADR.
                                        <br />
                                        Sell Every Room: Aggressive occupancy
                                        push in last 7 days.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Select
                                value={
                                  formState[hotel.hotel_id]?.rules
                                    ?.strategy_mode || "maintain"
                                }
                                onValueChange={(val) =>
                                  updateRule(
                                    String(hotel.hotel_id),
                                    "rules.strategy_mode",
                                    val,
                                  )
                                }
                              >
                                <SelectTrigger
                                  style={{
                                    width: "180px",
                                    height: "32px",
                                    fontSize: "0.75rem",
                                    backgroundColor: "#121519",
                                    borderColor: "#1E2330",
                                    color: "#F3F5F7",
                                  }}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent
                                  style={{
                                    backgroundColor: "#121519",
                                    borderColor: "#1E2330",
                                  }}
                                >
                                  <SelectItem
                                    value="maintain"
                                    className="focus:bg-[#38C6BA]/20 focus:text-[#38C6BA]"
                                    style={{
                                      color: "#F3F5F7",
                                      fontSize: "0.8rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    🔶 Maintain (Profit)
                                  </SelectItem>
                                  <SelectItem
                                    value="sell_every_room"
                                    className="focus:bg-[#38C6BA]/20 focus:text-[#38C6BA]"
                                    style={{
                                      color: "#F3F5F7",
                                      fontSize: "0.8rem",
                                      cursor: "pointer",
                                    }}
                                  >
                                    🔹 Sell Every Room
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* 3. Max Rates */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0 1rem",
                                height: "60px",
                                background: "#121519",
                                border: "1px solid #1E2330",
                                borderRadius: "0.5rem",
                              }}
                            >
                              <Label
                                style={{
                                  color: "#F3F5F7",
                                  fontSize: "0.875rem",
                                }}
                              >
                                Max Rates
                              </Label>
                              <DailyMaxRatesDialog
                                propertyName={hotel.property_name}
                                propertyId={String(hotel.hotel_id)}
                                initialRates={getDailyMaxRates(
                                  String(hotel.hotel_id),
                                )}
                                // [NEW] Pass Active Hotels for Import
                                sourceHotels={activeHotels.map((h) => ({
                                  id: String(h.hotel_id),
                                  name: h.property_name,
                                }))}
                                // [NEW] Fetcher function
                                onFetchRates={async (sourceId) => {
                                  const res =
                                    await fetchDailyMaxRates(sourceId);
                                  return res || {};
                                }}
                                onSave={async (rates) => {
                                  // [NEW] Save directly to SQL Table
                                  try {
                                    await saveDailyMaxRates(
                                      String(hotel.hotel_id),
                                      rates,
                                    );
                                    toast.success("Max rates saved.");
                                    // Update local state to reflect changes instantly in the UI
                                    updateRule(
                                      String(hotel.hotel_id),
                                      "daily_max_rates",
                                      rates,
                                    );
                                  } catch (err: any) {
                                    toast.error(
                                      "Failed to save max rates: " +
                                        err.message,
                                    );
                                  }
                                }}
                                trigger={
                                  <span
                                    tabIndex={0}
                                    style={{
                                      display: "inline-block",
                                      outline: "none",
                                    }}
                                  >
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      style={{
                                        color: "#38C6BA",
                                        height: "32px",
                                        fontSize: "0.8rem",
                                        pointerEvents: "none", // Let the span handle the click from DialogTrigger
                                      }}
                                      className="hover:bg-[#38C6BA]/10"
                                    >
                                      <CalendarIcon className="w-4 h-4 mr-2" />
                                      Edit
                                    </Button>
                                  </span>
                                }
                              />
                            </div>
                            {/* 3. Freeze Period */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0 1rem",
                                height: "60px",
                                background: "#121519",
                                border: "1px solid #1E2330",
                                borderRadius: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Label
                                  style={{
                                    color: "#F3F5F7",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  Freeze Period
                                </Label>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <HelpCircle
                                        style={{
                                          width: "14px",
                                          height: "14px",
                                          color: "#4E5868",
                                        }}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      style={{
                                        backgroundColor: "#121519",
                                        borderColor: "#1E2330",
                                      }}
                                    >
                                      <p
                                        style={{
                                          fontSize: "11px",
                                          color: "#F3F5F7",
                                        }}
                                      >
                                        Stop AI from changing rates for the next
                                        X days.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>

                              <div
                                style={{ position: "relative", width: "80px" }}
                              >
                                <Input
                                  type="number"
                                  value={
                                    formState[hotel.hotel_id]
                                      ?.rate_freeze_period ?? "0"
                                  }
                                  onChange={(e) =>
                                    updateRule(
                                      String(hotel.hotel_id),
                                      "rate_freeze_period",
                                      e.target.value,
                                    )
                                  }
                                  style={{
                                    backgroundColor: "#121519",
                                    textAlign: "center",
                                    paddingRight: "20px",
                                  }}
                                  className="border-[#1E2330] text-[#F3F5F7] h-8 text-sm"
                                />
                                <span
                                  style={{
                                    position: "absolute",
                                    right: "8px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "#4E5868",
                                    fontSize: "10px",
                                    pointerEvents: "none",
                                  }}
                                ></span>
                              </div>
                            </div>
                          </div>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>
                          {/* [MOVED] Seasonality Strategy */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.75rem",
                            }}
                          >
                            <h3
                              style={{
                                color: "#C8A66E",
                                textTransform: "uppercase",
                                letterSpacing: "0.12em",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              Seasonality Strategy
                            </h3>
                            <div
                              style={{
                                background: "#121519",
                                border: "1px solid #1E2330",
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
                                {MONTH_ORDER.map((monthValue, idx) => {
                                  // Database uses "1" for Jan, "2" for Feb, etc.
                                  const monthKey = String(idx + 1);
                                  // [FIX] Fallback to hotel.config if formState is not yet dirty
                                  const profile =
                                    formState[hotel.hotel_id]
                                      ?.seasonality_profile ??
                                    hotel.config?.seasonality_profile ??
                                    {};
                                  const level = profile[monthKey] || "low";
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
                                        let next = "low";
                                        if (level === "low") next = "mid";
                                        else if (
                                          level === "mid" ||
                                          level === "medium"
                                        )
                                          next = "high";
                                        else if (level === "high") next = "low";

                                        updateRule(
                                          String(hotel.hotel_id),
                                          "seasonality_profile",
                                          {
                                            ...profile,
                                            [monthKey]: next,
                                          },
                                        );
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
                                  borderTop: "1px solid #1E2330",
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
                                      background: "#38C6BA",
                                    }}
                                  />
                                  <span
                                    style={{
                                      color: "#4E5868",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    Low (Pressure)
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
                                      background: "#C8A66E",
                                    }}
                                  />
                                  <span
                                    style={{
                                      color: "#4E5868",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    Mid (Guide)
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
                                    style={{
                                      color: "#7A8494",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    High (Trap)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>
                          {/* 2. Last-Minute Floor */}
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
                                    color: "#F3F5F7",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Last-Minute Floor Rate
                                </h3>
                                <p
                                  style={{
                                    color: "#7A8494",
                                    fontSize: "10px",
                                    marginTop: "0.125rem",
                                  }}
                                >
                                  Override min rate close to arrival if
                                  occupancy is low
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
                                    c,
                                  )
                                }
                              />
                            </div>

                            {formState[hotel.hotel_id]?.last_minute_floor
                              ?.enabled && (
                              <div
                                style={{
                                  background: "#121519",
                                  border: "1px solid rgba(56,198,186,0.3)",
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
                                        color: "#7A8494",
                                        fontSize: "0.75rem",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                      }}
                                    >
                                      Floor Rate
                                    </Label>
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
                                          e.target.value,
                                        )
                                      }
                                      style={{ backgroundColor: "#121519" }}
                                      className="border-[#1E2330] text-[#F3F5F7] h-9 text-sm"
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
                                        color: "#7A8494",
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
                                            e.target.value,
                                          )
                                        }
                                        style={{ backgroundColor: "#121519" }}
                                        className="border-[#1E2330] text-[#F3F5F7] pr-12 h-9 text-sm"
                                      />
                                      <span
                                        style={{
                                          position: "absolute",
                                          right: "0.75rem",
                                          top: "50%",
                                          transform: "translateY(-50%)",
                                          color: "#7A8494",
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
                                      color: "#7A8494",
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
                                          day.k,
                                        ) || false;
                                      return (
                                        <button
                                          key={day.k}
                                          onClick={() =>
                                            toggleDayOfWeek(
                                              String(hotel.hotel_id),
                                              day.k,
                                            )
                                          }
                                          style={{
                                            flex: 1,
                                            padding: "0.5rem",
                                            borderRadius: "0.25rem",
                                            fontSize: "0.75rem",
                                            transition: "all 0.2s",
                                            border: isActive
                                              ? "2px solid rgba(56,198,186,0.5)"
                                              : "2px solid #1E2330",
                                            background: isActive
                                              ? "rgba(56,198,186,0.2)"
                                              : "#121519",
                                            color: isActive
                                              ? "#38C6BA"
                                              : "#7A8494",
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
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>
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
                                  !roomDifferentialsExpanded,
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
                                  color: "#F3F5F7",
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
                                    color: "#7A8494",
                                  }}
                                />
                              ) : (
                                <ChevronDown
                                  style={{
                                    width: "1rem",
                                    height: "1rem",
                                    color: "#7A8494",
                                  }}
                                />
                              )}
                            </button>

                            {/* Smooth Expansion Wrapper */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateRows: roomDifferentialsExpanded
                                  ? "1fr"
                                  : "0fr",
                                transition: "grid-template-rows 0.2s ease-out",
                              }}
                            >
                              <div style={{ overflow: "hidden" }}>
                                <div
                                  style={{
                                    background: "#121519",
                                    border: "1px solid #1E2330",
                                    borderRadius: "0.5rem",
                                    padding: "0.5rem",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.25rem",
                                    marginTop: "0.5rem",
                                  }}
                                >
                                  {(
                                    formState[hotel.hotel_id]?.pms_room_types
                                      ?.data || []
                                  ).map((room: any) => {
                                    const isBase =
                                      room.roomTypeID ===
                                      formState[hotel.hotel_id]
                                        ?.base_room_type_id;

                                    const rule =
                                      formState[
                                        hotel.hotel_id
                                      ]?.room_differentials?.find(
                                        (r: any) =>
                                          r.roomTypeId === room.roomTypeID,
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
                                          background: "#121519",
                                          border: "1px solid #1E2330",
                                          borderRadius: "0.25rem",
                                          minHeight: "48px", // Fix height consistency
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
                                            onValueChange={(val) => {
                                              const hid = String(hotel.hotel_id);
                                              updateRule(hid, "base_room_type_id", val);
                                              // Strip any differential rule for the new base room
                                              const currentDiffs = formState[hid]?.room_differentials || [];
                                              const cleaned = currentDiffs.filter(
                                                (r: any) => r.roomTypeId !== val,
                                              );
                                              if (cleaned.length !== currentDiffs.length) {
                                                updateRule(hid, "room_differentials", cleaned);
                                              }
                                            }}
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
                                                  borderColor: "#38C6BA",
                                                  color: "#38C6BA",
                                                  height: "0.75rem",
                                                  width: "0.75rem",
                                                }}
                                              />
                                            </div>
                                          </RadioGroup>
                                          <Label
                                            style={{
                                              color: "#F3F5F7",
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
                                                  "rgba(56, 198, 186, 0.1)",
                                                color: "#38C6BA",
                                                borderColor:
                                                  "rgba(56, 198, 186, 0.3)",
                                                fontSize: "10px",
                                                padding: "0 0.375rem",
                                              }}
                                            >
                                              Base
                                            </Badge>
                                          )}
                                        </div>
                                        {/* Only show differential controls if NOT base room type */}
                                        {!isBase && (
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
                                                  v,
                                                )
                                              }
                                            >
                                              <SelectTrigger
                                                style={{
                                                  width: "6rem",
                                                  backgroundColor: "#121519",
                                                }}
                                                className="h-9 border-[#1E2330] text-[#F3F5F7] text-sm"
                                              >
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent
                                                style={{
                                                  backgroundColor: "#121519",
                                                  borderColor: "#1E2330",
                                                }}
                                              >
                                                <SelectItem
                                                  value="+"
                                                  className="text-[#F3F5F7]"
                                                >
                                                  +
                                                </SelectItem>
                                                <SelectItem
                                                  value="-"
                                                  className="text-[#F3F5F7]"
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
                                                value={rule.value ?? ""}
                                                placeholder="0"
                                                onChange={(e) =>
                                                  handleDifferentialChange(
                                                    String(hotel.hotel_id),
                                                    room.roomTypeID,
                                                    "value",
                                                    e.target.value,
                                                  )
                                                }
                                                style={{
                                                  backgroundColor: "#121519",
                                                }}
                                                className="border-[#1E2330] text-[#F3F5F7] pr-5 h-9 text-sm"
                                              />
                                              <span
                                                style={{
                                                  position: "absolute",
                                                  right: "0.375rem",
                                                  top: "50%",
                                                  transform: "translateY(-50%)",
                                                  color: "#7A8494",
                                                  fontSize: "10px",
                                                }}
                                              >
                                                %
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>

                          {/* Pace Curves Section */}
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
                                    color: "#F3F5F7",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                    fontSize: "0.75rem",
                                  }}
                                >
                                  Pace Curves
                                </h3>
                                <p
                                  style={{
                                    color: "#7A8494",
                                    fontSize: "10px",
                                    marginTop: "0.125rem",
                                  }}
                                >
                                  Define booking pace targets (Low/Mid/High)
                                </p>
                              </div>
                              <ImportCurvesDialog
                                targetHotelId={String(hotel.hotel_id)}
                                sourceHotels={activeHotels.map((h) => ({
                                  id: String(h.hotel_id),
                                  name: h.property_name,
                                }))}
                                onSuccess={() => {
                                  // Refresh presence map
                                  setHasCurvesByHotelId((prev) => ({
                                    ...prev,
                                    [String(hotel.hotel_id)]: true,
                                  }));
                                  toast.success("Curves updated.");
                                }}
                                trigger={
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    style={{
                                      backgroundColor: "#121519",
                                      borderColor: hasCurvesByHotelId[
                                        String(hotel.hotel_id)
                                      ]
                                        ? "#1E2330"
                                        : "rgba(239, 68, 68, 0.3)",
                                      color: hasCurvesByHotelId[
                                        String(hotel.hotel_id)
                                      ]
                                        ? "#F3F5F7"
                                        : "#ef4444",
                                    }}
                                  >
                                    {hasCurvesByHotelId[String(hotel.hotel_id)]
                                      ? "Replace Curves"
                                      : "Import Curves"}
                                  </Button>
                                }
                              />
                            </div>
                          </div>

                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>
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
                                color: "#C8A66E",
                                textTransform: "uppercase",
                                letterSpacing: "0.12em",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              Monthly Min Rates
                            </h3>
                            <div
                              style={{
                                background: "#121519",
                                border: "1px solid #1E2330",
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
                                        color: "#7A8494",
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
                                          e.target.value,
                                        )
                                      }
                                      style={{
                                        backgroundColor: "#121519",
                                        borderColor: "#1E2330",
                                        color: "#F3F5F7",
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

                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>
                          {/* 5b. Yearly Visualization (Corridor) */}
                          <div style={{ marginTop: "0.5rem" }}>
                            <YearlyRatesVisualization
                              monthlyMinRates={
                                formState[hotel.hotel_id]?.monthly_min_rates ||
                                {}
                              }
                              monthlyMaxRates={MONTH_ORDER.reduce(
                                (acc, month) => ({
                                  ...acc,
                                  [month]:
                                    formState[hotel.hotel_id]?.guardrail_max ||
                                    "500",
                                }),
                                {},
                              )}
                              dailyMaxRates={getDailyMaxRates(
                                String(hotel.hotel_id),
                              )}
                              currency={
                                hotel.currency ||
                                hotel.currency_code ||
                                (hotel.city === "London" ? "GBP" : "USD")
                              }
                            />
                          </div>
                          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}></div>
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
                                color: "#C8A66E",
                                textTransform: "uppercase",
                                letterSpacing: "0.12em",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              Admin Controls
                            </h3>
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                              <Button
                                variant="outline"
                                style={{
                                  backgroundColor: "#121519",
                                  borderColor: "rgba(56, 198, 186, 0.5)",
                                  color: "#38C6BA",
                                }}
                                onClick={() =>
                                  activateHotel(
                                    String(hotel.hotel_id),
                                    hotel.pms_property_id,
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
                                disabled={
                                  isRepushing === String(hotel.hotel_id)
                                }
                                style={{
                                  backgroundColor: "rgba(200, 166, 110, 0.1)",
                                  borderColor: "rgba(200, 166, 110, 0.5)",
                                  color: "#38C6BA",
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
                                  handleExportReservations(
                                    String(hotel.hotel_id),
                                  )
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

                          {/* Promo Config (from Property Hub) */}
                          {(() => {
                            const promoAsset = getAssetForHotel(String(hotel.hotel_id));
                            const promoCalcState = calculatorStates[String(hotel.hotel_id)];
                            if (!promoAsset || !promoCalcState) return null;
                            return (
                              <PromoConfigSection
                                hotelId={String(hotel.hotel_id)}
                                asset={promoAsset}
                                calcState={promoCalcState}
                                updateCalculator={updateCalculator}
                                savePromoConfig={savePromoConfig}
                                isCampaignValidForDate={isCampaignValidForDate}
                              />
                            );
                          })()}

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              paddingTop: "1rem",
                            }}
                          >
                            <Button
                              style={{
                                background: "linear-gradient(135deg, #38C6BA 0%, #C8A66E 100%)",
                                color: "#0F1215",
                                minWidth: "160px",
                                transition: "all 0.2s",
                                border: "none",
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                // 🛑 DEBUGGING TRAP 🛑
                                const currentData = formState[hotel.hotel_id];
                                console.group("🛑 SAVE BUTTON CLICKED");
                                console.log("1. Hotel ID:", hotel.hotel_id);
                                console.log(
                                  "2. Form State Object:",
                                  currentData,
                                );
                                console.log(
                                  "3. Seasonality to Save:",
                                  currentData?.seasonality_profile,
                                );
                                console.groupEnd();

                                saveRules(String(hotel.hotel_id));
                              }}
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
                );
              })}
            </Accordion>
          )}
        </div>

      </div>

      {/* Bulk Add Event Dialog */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent
          style={{
            backgroundColor: "#121519",
            borderColor: "#1E2330",
            maxWidth: "600px",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "#F3F5F7" }}>
              Add Event Range
            </DialogTitle>
            <DialogDescription style={{ color: "#7A8494" }}>
              Define the dates, base impact, and tweak specific peak days below.
            </DialogDescription>
          </DialogHeader>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {/* Top Row: Dates */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <Label
                  style={{
                    color: "#7A8494",
                    fontSize: "0.75rem",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Start Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-9 w-full"
                      style={{
                        backgroundColor: "#121519",
                        border: "1px solid #1E2330",
                        color: "#F3F5F7",
                        fontSize: "13px",
                      }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventStartDate
                        ? format(new Date(newEventStartDate), "dd MMM yyyy")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    style={{
                      backgroundColor: "#121519",
                      border: "1px solid #1E2330",
                    }}
                  >
                    <Calendar
                      mode="single"
                      selected={
                        newEventStartDate
                          ? new Date(newEventStartDate)
                          : undefined
                      }
                      onSelect={(d) =>
                        d && setNewEventStartDate(format(d, "yyyy-MM-dd"))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label
                  style={{
                    color: "#7A8494",
                    fontSize: "0.75rem",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  End Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-start text-left h-9 w-full"
                      style={{
                        backgroundColor: "#121519",
                        border: "1px solid #1E2330",
                        color: "#F3F5F7",
                        fontSize: "13px",
                      }}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newEventEndDate
                        ? format(new Date(newEventEndDate), "dd MMM yyyy")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    style={{
                      backgroundColor: "#121519",
                      border: "1px solid #1E2330",
                    }}
                  >
                    <Calendar
                      mode="single"
                      selected={
                        newEventEndDate
                          ? new Date(newEventEndDate)
                          : undefined
                      }
                      onSelect={(d) =>
                        d && setNewEventEndDate(format(d, "yyyy-MM-dd"))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Middle Row: Name & Base Impact */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <Label
                  style={{
                    color: "#7A8494",
                    fontSize: "0.75rem",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Event Name
                </Label>
                <Input
                  placeholder="e.g., Wimbledon"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  style={{
                    backgroundColor: "#121519",
                    borderColor: "#1E2330",
                    color: "#F3F5F7",
                  }}
                />
              </div>
              <div>
                <Label
                  style={{
                    color: "#7A8494",
                    fontSize: "0.75rem",
                    marginBottom: "4px",
                    display: "block",
                  }}
                >
                  Base Impact
                </Label>
                <Select
                  value={newEventImpact}
                  onValueChange={setNewEventImpact}
                >
                  <SelectTrigger
                    style={{
                      backgroundColor: "#121519",
                      borderColor: "#1E2330",
                      color: "#F3F5F7",
                    }}
                  >
                    <SelectValue placeholder="Select Impact" />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: "#121519",
                      borderColor: "#1E2330",
                    }}
                  >
                    <SelectItem value="1.50" style={{ color: "#38C6BA" }}>
                      Medium (1.5x)
                    </SelectItem>
                    <SelectItem value="2.00" style={{ color: "#ef4444" }}>
                      High (2.0x)
                    </SelectItem>
                    <SelectItem value="2.50" style={{ color: "#c084fc" }}>
                      Extreme (2.5x)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bottom Row: Magic Preview List */}
            {generatedEvents.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <Label
                  style={{
                    color: "#F3F5F7",
                    fontSize: "0.75rem",
                    marginBottom: "8px",
                    display: "block",
                  }}
                >
                  Day-by-Day Tuning ({generatedEvents.length} Days)
                </Label>
                <div
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid #1E2330",
                    borderRadius: "0.5rem",
                    background: "#121519",
                  }}
                >
                  {generatedEvents.map((ev, index) => (
                    <div
                      key={ev.date}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.5rem 1rem",
                        borderBottom:
                          index < generatedEvents.length - 1
                            ? "1px solid #1E2330"
                            : "none",
                      }}
                    >
                      <span style={{ color: "#7A8494", fontSize: "0.875rem" }}>
                        {ev.date}
                      </span>
                      <Select
                        value={ev.impact}
                        onValueChange={(val) => {
                          setGeneratedEvents((prev) =>
                            prev.map((p) =>
                              p.date === ev.date ? { ...p, impact: val } : p,
                            ),
                          );
                        }}
                      >
                        <SelectTrigger
                          style={{
                            width: "140px",
                            height: "28px",
                            backgroundColor: "#121519",
                            borderColor: "#1E2330",
                            color: "#F3F5F7",
                            fontSize: "0.75rem",
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          style={{
                            backgroundColor: "#121519",
                            borderColor: "#1E2330",
                          }}
                        >
                          <SelectItem
                            value="1.50"
                            style={{ color: "#38C6BA", fontSize: "0.75rem" }}
                          >
                            Medium
                          </SelectItem>
                          <SelectItem
                            value="2.00"
                            style={{ color: "#ef4444", fontSize: "0.75rem" }}
                          >
                            High
                          </SelectItem>
                          <SelectItem
                            value="2.50"
                            style={{ color: "#c084fc", fontSize: "0.75rem" }}
                          >
                            Extreme
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter style={{ marginTop: "1rem" }}>
            <Button
              onClick={handleAddEvent}
              disabled={generatedEvents.length === 0}
              style={{ backgroundColor: "#38C6BA", color: "#121519" }}
            >
              Save{" "}
              {generatedEvents.length > 0
                ? `${generatedEvents.length} Days`
                : "Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
