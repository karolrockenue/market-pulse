import {
  ChevronDown,
  Star,
  X,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useActionList } from "@/components/ActionListContext";
import { R } from "@/styles/tokens";

interface PortfolioFlowcastProps {
  startDate: Date;
  globalGroupFilter?: string;
  globalHotelFilter?: string;
}

export function PortfolioFlowcast({
  startDate,
  globalGroupFilter = "all",
  globalHotelFilter = "all",
}: PortfolioFlowcastProps) {
  const [pickupPeriod, setPickupPeriod] = useState<"24h" | "48h">("24h");
  const [expandedHotels, setExpandedHotels] = useState<Set<number>>(new Set());

  const {
    actionList: globalActionList,
    toggleItem,
    clearList,
    hasItem,
  } = useActionList();
  const [actionListOpen, setActionListOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [hotelsData, setHotelsData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (globalHotelFilter !== "all")
          params.append("hotelId", globalHotelFilter);
        else if (globalGroupFilter !== "all")
          params.append("group", globalGroupFilter);

        const res = await fetch(
          `/api/metrics/portfolio/flowcast?${params.toString()}`
        );
        if (!res.ok) throw new Error("Failed to load flowcast");

        const data = await res.json();
        const parsed = data.map((h: any) => ({
          ...h,
          data: h.data.map((d: any) => ({ ...d, date: new Date(d.date) })),
        }));
        setHotelsData(parsed);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load flowcast data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [globalGroupFilter, globalHotelFilter]);

  const handleToggleAction = (hotel: { id: number; name: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleItem({ id: hotel.id, name: hotel.name });
  };

  const toggleHotel = (hotelId: number) => {
    const newExpanded = new Set(expandedHotels);
    if (newExpanded.has(hotelId)) newExpanded.delete(hotelId);
    else newExpanded.add(hotelId);
    setExpandedHotels(newExpanded);
  };

  const expandAll = () => setExpandedHotels(new Set(hotelsData.map((h) => h.id)));
  const collapseAll = () => setExpandedHotels(new Set());

  const getHotelMetrics = (hotel: any) => {
    if (!hotel || !hotel.data || hotel.data.length === 0)
      return { avgOccupancy: 0, recentPickup: 0 };

    const windowDays = 30;
    const periodData = hotel.data.slice(0, windowDays);
    const totalSold = periodData.reduce((sum: number, d: any) => sum + (d.roomsSold || 0), 0);
    const totalCap = periodData.reduce((sum: number, d: any) => sum + (d.capacity || 0), 0);
    const avgOccupancy = totalCap > 0 ? Math.round((totalSold / totalCap) * 100) : 0;
    const recentPickup =
      pickupPeriod === "24h"
        ? periodData.reduce((sum: number, d: any) => sum + d.pickup24h, 0) / windowDays
        : periodData.reduce((sum: number, d: any) => sum + d.pickup48h, 0) / windowDays;
    return { avgOccupancy, recentPickup };
  };

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", justifyContent: "center", background: R.darkBand, borderRadius: 10, border: `1px solid ${R.border}` }}>
        <Loader2 className="animate-spin" style={{ color: R.warmTeal }} />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Master Controls */}
      <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: R.warmTeal }} />
          <span style={{ color: R.accent, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>FLOWCAST PORTFOLIO</span>
          <span style={{ color: R.textDim, fontSize: 12 }}>({hotelsData.length} Hotels)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Action List Button */}
          <Sheet open={actionListOpen} onOpenChange={setActionListOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                style={{
                  background: globalActionList.length > 0 ? `${R.warmTeal}15` : R.sidebar,
                  borderColor: globalActionList.length > 0 ? R.warmTeal : R.border,
                  color: globalActionList.length > 0 ? R.warmTeal : R.textMid,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Star size={14} />
                Action List
                {globalActionList.length > 0 && (
                  <span style={{ background: R.warmTeal, color: R.sidebar, borderRadius: 9999, padding: "0 6px", fontSize: 10, fontWeight: 600 }}>
                    {globalActionList.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" style={{ background: R.bg, borderLeft: `1px solid ${R.border}`, width: 400 }}>
              <SheetHeader style={{ marginBottom: 24 }}>
                <SheetTitle style={{ color: R.accent, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 14 }}>Action List</SheetTitle>
                <SheetDescription style={{ color: R.textDim, fontSize: 12 }}>Hotels flagged for follow-up</SheetDescription>
              </SheetHeader>

              {globalActionList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: R.textDim }}>
                  <Star style={{ width: 48, height: 48, margin: "0 auto 16px", opacity: 0.3 }} />
                  <p style={{ fontSize: 14, marginBottom: 8 }}>No hotels in action list</p>
                  <p style={{ fontSize: 12 }}>Click the checkbox next to hotels that need follow-up</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: R.textDim }}>{globalActionList.length} {globalActionList.length === 1 ? "hotel" : "hotels"} flagged</span>
                    <Button size="sm" variant="ghost" onClick={clearList} style={{ fontSize: 12, color: R.red, padding: "4px 8px" }}>Clear All</Button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {globalActionList.map((item) => {
                      const hotel = hotelsData.find((h) => h.id === item.id);
                      const metrics = hotel ? getHotelMetrics(hotel) : { avgOccupancy: 0, recentPickup: 0 };
                      const pickupTrend = metrics.recentPickup > 2 ? "up" : metrics.recentPickup > 1 ? "stable" : "down";
                      return (
                        <div key={item.id} style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 8, padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                            <span style={{ color: R.accent, fontSize: 14, flex: 1 }}>{item.name}</span>
                            <button
                              onClick={(e) => handleToggleAction({ id: item.id, name: item.name }, e)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: R.textDim, transition: "color 0.2s" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = R.red)}
                              onMouseLeave={(e) => (e.currentTarget.style.color = R.textDim)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                            <div>
                              <span style={{ color: R.textDim }}>Avg Occ: </span>
                              <span style={{ color: metrics.avgOccupancy >= 70 ? R.green : metrics.avgOccupancy >= 50 ? R.warmTeal : R.red, fontFamily: "monospace" }}>{metrics.avgOccupancy}%</span>
                            </div>
                            <div>
                              <span style={{ color: R.textDim }}>Pickup: </span>
                              <span style={{ color: pickupTrend === "up" ? R.green : pickupTrend === "stable" ? R.warmTeal : R.textDim, fontFamily: "monospace" }}>
                                {pickupTrend === "up" ? "↑" : pickupTrend === "stable" ? "→" : "↓"} {metrics.recentPickup.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={expandAll} size="sm" variant="outline" style={{ background: R.sidebar, borderColor: R.border, color: R.textMid, fontSize: 12 }}>Expand All</Button>
            <Button onClick={collapseAll} size="sm" variant="outline" style={{ background: R.sidebar, borderColor: R.border, color: R.textMid, fontSize: 12 }}>Collapse All</Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: R.textMid }}>Pickup Period:</span>
            <Select value={pickupPeriod} onValueChange={(value: "24h" | "48h") => setPickupPeriod(value)}>
              <SelectTrigger style={{ width: 120, background: R.sidebar, borderColor: R.border, color: R.accent }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: R.darkBand, borderColor: R.border }}>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="48h">48 Hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Hotel Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hotelsData.map((hotel) => {
          const isExpanded = expandedHotels.has(hotel.id);
          const metrics = getHotelMetrics(hotel);
          const pickupTrend = metrics.recentPickup > 2 ? "up" : metrics.recentPickup > 1 ? "stable" : "down";
          const hotelId = hotel.id;

          return (
            <Collapsible key={hotelId} open={isExpanded} onOpenChange={() => toggleHotel(hotelId)}>
              <div style={{ background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 10, overflow: "hidden" }}>
                {/* Collapsed Header */}
                <CollapsibleTrigger
                  style={{ width: "100%", padding: "12px 16px", cursor: "pointer", background: "transparent", transition: "background-color 0.2s", borderBottom: isExpanded ? `1px solid ${R.border}` : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${R.border}40`)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                      <button
                        onClick={(e) => handleToggleAction({ id: hotel.id, name: hotel.name }, e)}
                        style={{
                          background: hasItem(hotel.id) ? R.warmTeal : "transparent",
                          border: `1.5px solid ${hasItem(hotel.id) ? R.warmTeal : R.border}`,
                          borderRadius: 4,
                          width: 16,
                          height: 16,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { if (!hasItem(hotel.id)) { e.currentTarget.style.borderColor = R.warmTeal; e.currentTarget.style.backgroundColor = `${R.warmTeal}15`; } }}
                        onMouseLeave={(e) => { if (!hasItem(hotel.id)) { e.currentTarget.style.borderColor = R.border; e.currentTarget.style.backgroundColor = "transparent"; } }}
                      >
                        {hasItem(hotel.id) && <CheckSquare size={12} style={{ color: R.sidebar }} />}
                      </button>
                      <ChevronDown size={14} style={{ color: R.warmTeal, transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                      <span style={{ color: R.accent, fontSize: 14 }}>{hotel.name}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: R.textDim }}>Avg Occ:</span>
                        <span style={{ fontSize: 14, color: metrics.avgOccupancy >= 70 ? R.green : metrics.avgOccupancy >= 50 ? R.warmTeal : R.red, fontWeight: 600, fontFamily: "monospace" }}>{metrics.avgOccupancy}%</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: R.textDim }}>Pickup:</span>
                        <span style={{ fontSize: 14, color: pickupTrend === "up" ? R.green : pickupTrend === "stable" ? R.warmTeal : R.textDim, fontFamily: "monospace" }}>
                          {pickupTrend === "up" ? "↑" : pickupTrend === "stable" ? "→" : "↓"} {metrics.recentPickup.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ width: 80, height: 24, position: "relative" }}>
                        <svg width="80" height="24" style={{ display: "block" }}>
                          <path
                            d={hotel.data.slice(0, 30).map((d: any, idx: number) => {
                              const x = (idx / 29) * 80;
                              const y = 24 - (d.occupancy / 100) * 24;
                              return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                            }).join(" ")}
                            fill="none"
                            stroke={R.warmTeal}
                            strokeWidth="1.5"
                            strokeOpacity="0.6"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Expanded Content */}
                <CollapsibleContent>
                  <div style={{ padding: 24 }}>
                    <div style={{ position: "relative", height: 240, background: R.sidebar, borderRadius: 8, border: `1px solid ${R.border}`, overflow: "hidden" }}>
                      {/* Y-axis labels */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 48, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 12, paddingBottom: 12 }}>
                        {[100, 75, 50, 25].map((val, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>
                            <span style={{ fontSize: 10, color: R.textDim, fontFamily: "monospace" }}>{val}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Guide lines */}
                      <div style={{ position: "absolute", left: 48, right: 8, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 12, paddingBottom: 12 }}>
                        {[100, 75, 50, 25].map((val, idx) => (
                          <div key={idx} style={{ height: 1, background: R.border }} />
                        ))}
                      </div>

                      {/* Bars */}
                      <div style={{ position: "absolute", left: 48, right: 8, top: 12, bottom: 12, display: "flex", alignItems: "flex-end", gap: 2 }}>
                        {hotel.data.map((day: any, idx: number) => {
                          const dateStr = day.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                          const currentPickup = pickupPeriod === "24h" ? day.pickup24h : day.pickup48h;

                          return (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", position: "relative", height: "100%", justifyContent: "flex-end" }}>
                                    <div
                                      style={{ width: "100%", background: R.border, height: `${Math.min(day.occupancy, 100)}%`, position: "relative", transition: "box-shadow 0.2s" }}
                                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `inset 0 0 12px ${R.warmTeal}60`; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                                    >
                                      {currentPickup > 0.3 && (
                                        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: `${Math.min((currentPickup / day.occupancy) * 100 * 2.5, 100)}%`, background: R.warmTeal, opacity: 0.7 }} />
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent style={{ background: R.sidebar, borderColor: R.border, color: R.accent }}>
                                  <div style={{ fontSize: 12 }}>
                                    <div style={{ color: R.textMid, marginBottom: 4 }}>{dateStr}</div>
                                    <div style={{ color: R.accent, marginBottom: 8, fontWeight: 600 }}>Occupancy: {Math.round(day.occupancy)}%</div>
                                    <div style={{ color: R.warmTeal, marginBottom: 8 }}>{pickupPeriod === "24h" ? "24h" : "48h"} Pickup: +{currentPickup.toFixed(1)}%</div>
                                    <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 8, marginTop: 8 }}>
                                      <div style={{ color: R.accent }}>Rate: £{Math.round(day.sentinelRate)}</div>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>

                      {/* Rate Line */}
                      <svg style={{ position: "absolute", left: 48, right: 8, top: 12, bottom: 12, pointerEvents: "none", width: "calc(100% - 56px)", height: "calc(100% - 24px)" }}>
                        <defs>
                          <linearGradient id={`rateGradient-${hotelId}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={R.warmTeal} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={R.warmTeal} stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <path
                          d={hotel.data.map((day: any, idx: number) => {
                            const x = (idx / (hotel.data.length - 1)) * 100;
                            const minRate = Math.min(...hotel.data.map((d: any) => d.sentinelRate));
                            const maxRate = Math.max(...hotel.data.map((d: any) => d.sentinelRate));
                            const range = maxRate - minRate || 1;
                            const y = 100 - ((day.sentinelRate - minRate) / range) * 100;
                            return `${idx === 0 ? "M" : "L"} ${x}% ${y}%`;
                          }).join(" ") + " L 100% 100% L 0% 100% Z"}
                          fill={`url(#rateGradient-${hotelId})`}
                        />
                        <path
                          d={hotel.data.map((day: any, idx: number) => {
                            const x = (idx / (hotel.data.length - 1)) * 100;
                            const minRate = Math.min(...hotel.data.map((d: any) => d.sentinelRate));
                            const maxRate = Math.max(...hotel.data.map((d: any) => d.sentinelRate));
                            const range = maxRate - minRate || 1;
                            const y = 100 - ((day.sentinelRate - minRate) / range) * 100;
                            return `${idx === 0 ? "M" : "L"} ${x}% ${y}%`;
                          }).join(" ")}
                          fill="none"
                          stroke={R.warmTeal}
                          strokeOpacity="0.8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    {/* Timeline */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, paddingLeft: 16, paddingRight: 16, fontSize: 10, color: R.textDim, fontFamily: "monospace" }}>
                      <span style={{ color: R.accent }}>{hotel.data[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span>{hotel.data[19]?.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span>{hotel.data[39]?.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span style={{ color: R.accent }}>{hotel.data[59]?.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span style={{ color: R.accent }}>{hotel.data[79]?.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span style={{ color: R.accent }}>{hotel.data[hotel.data.length - 1]?.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
