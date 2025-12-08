import { useState, useCallback } from "react";
import { toast } from "sonner";
import { isWithinInterval } from "date-fns";
import {
  getConfig,
  getAssets,
  getPreviewRates,
  submitOverrides,
  getDailyPickup, // [Correctly Imported]
} from "../api/sentinel.api";
import { RateCalendarDay, AssetConfig, RateOverride } from "../api/types";

// --- Calculator Logic (Unchanged) ---
interface Campaign {
  id: string;
  slug: string;
  name: string;
  discount: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
  active: boolean;
}

export interface CalculatorState {
  multiplier: number;
  campaigns: Campaign[];
  mobileActive: boolean;
  mobilePercent: number;
  nonRefundableActive: boolean;
  nonRefundablePercent: number;
  countryRateActive: boolean;
  countryRatePercent: number;
}

const isCampaignValidForDate = (testDate: Date | undefined, camp: Campaign) => {
  if (!testDate || !camp.active || !camp.startDate || !camp.endDate)
    return false;
  try {
    return isWithinInterval(testDate, {
      start: camp.startDate,
      end: camp.endDate,
    });
  } catch {
    return false;
  }
};
// [NEW] Shared Factor Logic
export const getRateFactors = (
  geniusPct: number,
  state: CalculatorState | null,
  dateStr: string,
  options?: { forceMultiplier?: number; includeTargeting?: boolean }
) => {
  if (!state) return 0;
  const cellDate = new Date(dateStr);

  // 1. Base Logic (Apply Multiplier unless forced)
  let factor =
    options?.forceMultiplier !== undefined
      ? options.forceMultiplier
      : state.multiplier;

  // 2. Rate Plan Modifier (Non-Ref)
  if (state.nonRefundableActive) {
    factor = factor * (1 - Number(state.nonRefundablePercent) / 100);
  }

  // 3. Daisy Chain
  const deepDeal = state.campaigns.find(
    (c) =>
      ["black-friday", "limited-time"].includes(c.slug) &&
      isCampaignValidForDate(cellDate, c)
  );

  if (deepDeal) {
    factor = factor * (1 - Number(deepDeal.discount) / 100);
  } else {
    // A. Genius
    if (geniusPct > 0) factor = factor * (1 - Number(geniusPct) / 100);

    // B. Standard Campaigns
    const validStandard = state.campaigns.filter(
      (c) =>
        !["black-friday", "limited-time"].includes(c.slug) &&
        isCampaignValidForDate(cellDate, c)
    );
    if (validStandard.length > 0) {
      const best = validStandard.reduce((p, c) =>
        p.discount > c.discount ? p : c
      );
      factor = factor * (1 - Number(best.discount) / 100);
    }

    // C. Targeting (Mobile/Country)
    if (options?.includeTargeting) {
      const isMobileBlocked =
        !!deepDeal ||
        validStandard.some((c) =>
          ["early-deal", "late-escape", "getaway-deal"].includes(c.slug)
        );
      if (state.mobileActive && !isMobileBlocked) {
        factor = factor * (1 - Number(state.mobilePercent) / 100);
      }
      if (state.countryRateActive) {
        factor = factor * (1 - Number(state.countryRatePercent) / 100);
      }
    }
  }
  return factor;
};

// [UPDATED] Forward Calculation
export const calculateSellRate = (
  pmsRate: number,
  geniusPct: number,
  state: CalculatorState | null,
  dateStr: string,
  options?: { forceMultiplier?: number; includeTargeting?: boolean }
) => {
  if (!pmsRate || !state) return 0;
  const factor = getRateFactors(
    pmsRate > 0 ? geniusPct : 0,
    state,
    dateStr,
    options
  );
  return pmsRate * factor;
};

// [NEW] Reverse Calculation
export const calculateRequiredOverride = (
  targetSellRate: number,
  geniusPct: number,
  state: CalculatorState | null,
  dateStr: string,
  options?: { forceMultiplier?: number; includeTargeting?: boolean }
) => {
  if (!targetSellRate || !state) return 0;
  const factor = getRateFactors(geniusPct, state, dateStr, options);
  if (factor === 0) return 0;
  // Reverse: Target / Factor = Base
  return targetSellRate / factor;
};

// --- The Hook ---

export const useRateGrid = () => {
  const [calendarData, setCalendarData] = useState<RateCalendarDay[]>([]);
  // [NEW] State for dynamic lookback window
  const [pickupWindow, setPickupWindow] = useState<number>(1);

  const [pendingOverrides, setPendingOverrides] = useState<
    Record<string, number>
  >({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, number>>(
    {}
  );

  const [calcState, setCalcState] = useState<CalculatorState | null>(null);
  const [geniusPct, setGeniusPct] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load Data (Backend Engine + Metrics)
  const loadRates = useCallback(
    async (hotelId: string, baseRoomTypeId: string) => {
      setIsLoading(true);
      setError(null);
      setPendingOverrides({});

      try {
        const today = new Date();
        const utcToday = new Date(
          Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
        );
        const endOfWindow = new Date(utcToday);
        endOfWindow.setUTCDate(utcToday.getUTCDate() + 365);

        const startStr = utcToday.toISOString().split("T")[0];
        const endStr = endOfWindow.toISOString().split("T")[0];

        // [MODIFIED] Fetch Preview, Metrics, Assets AND Pickup in parallel
        const [previewData, metricsRes, assets, pickupRes] = await Promise.all([
          getPreviewRates(hotelId, baseRoomTypeId, startStr, 365),
          fetch("/api/metrics/reports/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              propertyId: parseInt(hotelId),
              startDate: startStr,
              endDate: endStr,
              granularity: "daily",
              metrics: { hotel: ["rooms-sold", "rooms-unsold", "adr"] },
              includeTaxes: true,
            }),
          }).then((r) => r.json()),
          getAssets(),
          // [NEW] Pass variable pickupWindow
          getDailyPickup(hotelId, startStr, endStr, pickupWindow),
        ]);

        // A. Process Assets (for Context/UI flags)
        const asset = assets.find(
          (a: AssetConfig) => String(a.market_pulse_hotel_id) === hotelId
        );
        if (asset) {
          const s = asset.calculator_settings || {};
          setCalcState({
            multiplier: asset.strategic_multiplier
              ? parseFloat(String(asset.strategic_multiplier))
              : 1.3,
            campaigns: s.campaigns
              ? s.campaigns.map((c: any) => ({
                  ...c,
                  startDate: c.startDate ? new Date(c.startDate) : undefined,
                  endDate: c.endDate ? new Date(c.endDate) : undefined,
                  active: c.active ?? true,
                }))
              : [],
            mobileActive: s.mobile?.active ?? true,
            mobilePercent: s.mobile?.percent ?? 10,
            nonRefundableActive: s.nonRef?.active ?? true,
            nonRefundablePercent: s.nonRef?.percent ?? 15,
            countryRateActive: s.country?.active ?? false,
            countryRatePercent: s.country?.percent ?? 5,
          });
          setGeniusPct(asset.genius_discount_pct || 0);
        }

        // B. Process Metrics (Occupancy Map)
        const statsMap: Record<string, { occupancy: number; adr: number }> = {};
        if (Array.isArray(metricsRes)) {
          metricsRes.forEach((row: any) => {
            const dateKey = row.period.substring(0, 10);
            const sold = parseFloat(row["rooms-sold"]) || 0;
            const total = sold + (parseFloat(row["rooms-unsold"]) || 0);
            statsMap[dateKey] = {
              occupancy: total > 0 ? (sold / total) * 100 : 0,
              adr: parseFloat(row["adr"]) || 0,
            };
          });
        }

        // [NEW] Process Pickup Map
        const pickupMap: Record<string, number> = {};
        if (Array.isArray(pickupRes)) {
          pickupRes.forEach((row: any) => {
            // Backend returns { date: "YYYY-MM-DD", pickup: number }
            pickupMap[row.date] = parseFloat(row.pickup) || 0;
          });
        }

        // C. Process Preview Data (The Canonical Source)
        const fullCalendar: RateCalendarDay[] = previewData.map((day: any) => {
          const stats = statsMap[day.date] || { occupancy: 0, adr: 0 };
          const pickupVal = pickupMap[day.date] || 0; // [NEW] Inject pickup

          const dateObj = new Date(day.date);
          const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
          const monthNames = [
            "JAN",
            "FEB",
            "MAR",
            "APR",
            "MAY",
            "JUN",
            "JUL",
            "AUG",
            "SEP",
            "OCT",
            "NOV",
            "DEC",
          ];

          return {
            date: day.date,
            // Use 'finalRate' from backend as the primary rate, unless overriden locally
            rate: day.finalRate || 0,
            suggestedRate: day.suggestedRate || 0,
            source: day.source || "AI",
            liveRate: day.liveRate || 0,

            // UI Helpers
            dayOfWeek: dayNames[dateObj.getUTCDay()],
            dayNumber: dateObj.getUTCDate(),
            month: monthNames[dateObj.getUTCMonth()],

            // Logic Flags (From Backend)
            isFrozen: day.isFrozen,
            floorRateLMF: day.isFloorActive ? day.finalRate : null, // Backend handles floor application
            guardrailMin: day.guardrailMin || 0,
            // Metrics (From Merged Data)
            occupancy: stats.occupancy,
            adr: stats.adr,
            pickup: pickupVal, // [NEW]
          };
        });

        // [FIX] Populate savedOverrides from backend data where source is 'Manual'
        const initialSavedOverrides: Record<string, number> = {};
        fullCalendar.forEach((day: any) => {
          if (day.source === "Manual" && day.rate > 0) {
            initialSavedOverrides[day.date] = parseFloat(day.rate);
          }
        });
        setSavedOverrides(initialSavedOverrides);

        setCalendarData(fullCalendar);
      } catch (err: any) {
        console.error("Load Rates Error:", err);
        setError(err.message);
        toast.error("Failed to load rates", { description: err.message });
      } finally {
        setIsLoading(false);
      }
    },
    // [MODIFIED] Re-run when pickupWindow changes
    [pickupWindow]
  );

  // ... (setOverride, clearOverride, submitChanges Unchanged) ...
  const setOverride = (date: string, value: number) => {
    setPendingOverrides((prev) => ({ ...prev, [date]: value }));
  };

  const clearOverride = (date: string) => {
    setPendingOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  };

  const submitChanges = async (
    hotelId: string,
    pmsPropertyId: string,
    roomTypeId: string
  ) => {
    if (Object.keys(pendingOverrides).length === 0) return;

    setIsSubmitting(true);
    const snapshot = { ...pendingOverrides };
    const payload = Object.keys(snapshot).map((date) => ({
      date,
      rate: snapshot[date],
    }));

    // Optimistic Update
    setSavedOverrides((prev) => ({ ...prev, ...snapshot }));
    setPendingOverrides({});

    toast.message("Syncing...", {
      description: `Queuing ${payload.length} updates...`,
      style: {
        backgroundColor: "#0f151a",
        border: "1px solid #2a2a2a",
        color: "#e5e5e5",
      },
    });

    try {
      await submitOverrides(hotelId, pmsPropertyId, roomTypeId, payload);
      toast.success("Updates Queued", {
        style: {
          backgroundColor: "#0f151a",
          border: "1px solid #39BDF8",
          color: "#39BDF8",
        },
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Queue Failed", {
        description: "Please refresh.",
        style: {
          backgroundColor: "#0f151a",
          border: "1px solid #ef4444",
          color: "#ef4444",
        },
      });
      setPendingOverrides(snapshot);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    calendarData,
    pickupWindow, // [NEW]
    setPickupWindow, // [NEW]
    pendingOverrides,
    savedOverrides,
    calcState,
    geniusPct,
    isLoading,
    isSubmitting,
    error,
    loadRates,
    setOverride,
    clearOverride,
    submitChanges,
  };
};
