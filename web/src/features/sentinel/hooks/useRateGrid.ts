import { useState, useCallback } from "react";
import { toast } from "sonner";
import { isWithinInterval } from "date-fns";
import {
  getConfig,
  getAssets,
  getPreviewRates,
  getDailyPickup,
  getAiPredictions,
  saveDailyMinRates,
  getRateOverrides,
  saveRateOverrides,
  deleteRateOverrides,
  applyAiRates,
} from "../api/sentinel.api";
import { RateCalendarDay, AssetConfig } from "../api/types";

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
  if (!camp.active) return false;
  // Long campaigns have no dates — always valid
  if (camp.slug === "long-campaign") return true;
  if (!testDate || !camp.startDate || !camp.endDate) return false;
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
          ["long-campaign", "early-deal", "late-escape", "getaway-deal"].includes(c.slug)
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
  // [NEW] Shadow Mode: Store AI predictions separately from live data
  const [aiPredictions, setAiPredictions] = useState<
    Record<string, { rate: number; confidence: number }>
  >({});
  // [NEW] Track which pending overrides came from AI
  const [aiApprovedPending, setAiApprovedPending] = useState<Set<string>>(
    new Set()
  );

  const [calcState, setCalcState] = useState<CalculatorState | null>(null);
  const [geniusPct, setGeniusPct] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // [OVERRIDE v1] Active PMS overrides keyed by stayDate. When present, these
  // dates are user-pinned and Sentinel won't touch them on the next cycle.
  // Empty when feature flag is off (backend returns [] on 503).
  const [rateOverrides, setRateOverrides] = useState<Record<string, number>>({});

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

        // [MODIFIED] Fetch Preview, Metrics, Assets, Pickup, AI Predictions AND PMS Overrides
        const [previewData, metricsRes, assets, pickupRes, aiRes, overridesRes] =
          await Promise.all([
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
            getDailyPickup(hotelId, startStr, endStr, pickupWindow),
            getAiPredictions(hotelId),
            // [OVERRIDE v1] Fetch active PMS overrides for this hotel+window.
            // Returns [] if feature flag is off (503 handled in API client).
            getRateOverrides(hotelId, startStr, endStr).catch(() => []),
          ]);

        // [OVERRIDE v1] Build { date -> basePrice } map for quick lookups
        const overridesMap: Record<string, number> = {};
        (overridesRes || []).forEach((ov) => {
          overridesMap[ov.stayDate] = ov.basePrice;
        });
        setRateOverrides(overridesMap);

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
            nonRefundablePercent: s.nonRef?.percent ?? 10,
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
            // [FIX] Display the Floor Limit (£90), not the Final Price (£148)
            floorRateLMF: day.isFloorActive ? day.guardrailMin || 0 : null,
            guardrailMin: day.guardrailMin || 0,
            monthlyMinDefault: day.monthlyMinDefault || day.guardrailMin || 0,
            isDailyMinOverride: day.isDailyMinOverride || false,
            // Metrics (From Merged Data)
            occupancy: stats.occupancy,
            adr: stats.adr,
            pickup: pickupVal, // [NEW]
          };
        });

        // PMS Override + Target Sell Rate rows start empty on load.
        // They only populate as the user types, and clear after submit.

        // Process Real AI Predictions
        // We must map the SQL rows (snake_case) to the UI Map (date key)
        // AND strictly filter for the current Base Room Type
        const realAiData: Record<string, { rate: number; confidence: number }> =
          {};

        if (Array.isArray(aiRes)) {
          aiRes.forEach((p: any) => {
            // Strict Type Check: Ensure we only show predictions for the loaded room type
            if (String(p.room_type_id) === String(baseRoomTypeId)) {
              // Fix Date: SQL returns full ISO string, we need YYYY-MM-DD
              const dateKey = new Date(p.stay_date).toISOString().split("T")[0];
              realAiData[dateKey] = {
                rate: Math.round(parseFloat(p.suggested_rate)), // Force Integer
                confidence: parseFloat(p.confidence_score) || 0.0,
              };
            }
          });
        }

        setSavedOverrides({});
        setAiPredictions(realAiData); // [CONNECTED]
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

  const setOverride = (date: string, value: number) => {
    setPendingOverrides((prev) => ({ ...prev, [date]: value }));
    // A typed value is a manual pin, not an AI accept. If this date had been
    // staged via Apply AI, drop it from that set so submit routes it through
    // saveRateOverrides (pin) instead of applyAiRates (engine push).
    setAiApprovedPending((prev) => {
      if (!prev.has(date)) return prev;
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
  };

  const clearOverride = (date: string) => {
    setPendingOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    // Also clear AI tag if cleared
    setAiApprovedPending((prev) => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
  };

  // [NEW] Specific handler for AI approvals
  const applyAiPrediction = (date: string, rate: number) => {
    setPendingOverrides((prev) => ({ ...prev, [date]: rate }));
    setAiApprovedPending((prev) => {
      const next = new Set(prev);
      next.add(date);
      return next;
    });
  };

  // [NEW] Bulk Apply AI for a range of dates
  const bulkApplyAi = useCallback(
    (dates: string[]) => {
      // Build a min-rate lookup from calendarData for clamping
      const minMap: Record<string, number> = {};
      calendarData.forEach((d) => { minMap[d.date] = d.guardrailMin || 0; });

      setPendingOverrides((prev) => {
        const next = { ...prev };
        dates.forEach((date) => {
          const pred = aiPredictions[date];
          if (pred && pred.rate > 0) {
            next[date] = Math.max(pred.rate, minMap[date] || 0);
          }
        });
        return next;
      });

      setAiApprovedPending((prev) => {
        const next = new Set(prev);
        dates.forEach((date) => {
          if (aiPredictions[date]) {
            next.add(date);
          }
        });
        return next;
      });
    },
    [aiPredictions, calendarData]
  ); // Re-create if predictions or calendar change

  const submitChanges = async (
    hotelId: string,
    _pmsPropertyId: string,
    _roomTypeId: string
  ) => {
    if (Object.keys(pendingOverrides).length === 0) return;

    setIsSubmitting(true);
    const snapshot = { ...pendingOverrides };
    const aiSnapshot = new Set(aiApprovedPending);

    // Partition: AI-accepted dates push through the engine without pinning;
    // typed dates pin via sentinel_rate_overrides. The AI path also releases
    // any prior pin so the recalc actually reaches PMS for those dates.
    const typedDates = Object.keys(snapshot).filter((d) => !aiSnapshot.has(d));
    const aiDates = Object.keys(snapshot).filter((d) => aiSnapshot.has(d));

    const typedPayload = typedDates.map((date) => ({
      stayDate: date,
      price: snapshot[date],
    }));

    // Optimistic UI:
    //  - typed → source "OVERRIDE", rateOverrides map updated (pinned).
    //  - AI    → source "SENTINEL", rateOverrides map cleared for that date
    //            (the engine now owns it; any prior pin is being released).
    setCalendarData((prev) =>
      prev.map((d) => {
        if (typedDates.includes(d.date)) {
          return { ...d, rate: snapshot[d.date], liveRate: snapshot[d.date], source: "OVERRIDE" };
        }
        if (aiDates.includes(d.date)) {
          return { ...d, rate: snapshot[d.date], source: "SENTINEL" };
        }
        return d;
      })
    );
    setRateOverrides((prev) => {
      const next = { ...prev };
      typedPayload.forEach((o) => { next[o.stayDate] = o.price; });
      aiDates.forEach((date) => { delete next[date]; });
      return next;
    });

    // Snapshot the prior rateOverrides so a partial failure can roll back
    // both directions of mutation (added pins / released pins).
    const priorOverrides = { ...rateOverrides };

    setPendingOverrides({});
    setSavedOverrides({});
    setAiApprovedPending(new Set());

    const totalCount = typedPayload.length + aiDates.length;
    toast.message("Syncing...", {
      description: `Queuing ${totalCount} update${totalCount === 1 ? "" : "s"}...`,
      style: {
        backgroundColor: "#0f151a",
        border: "1px solid #2a2a2a",
        color: "#e5e5e5",
      },
    });

    const tasks: Array<Promise<{ kind: "typed" | "ai"; ok: boolean; error?: any }>> = [];
    if (typedPayload.length > 0) {
      tasks.push(
        saveRateOverrides(hotelId, typedPayload)
          .then(() => ({ kind: "typed" as const, ok: true }))
          .catch((error) => ({ kind: "typed" as const, ok: false, error }))
      );
    }
    if (aiDates.length > 0) {
      tasks.push(
        applyAiRates(hotelId, aiDates)
          .then(() => ({ kind: "ai" as const, ok: true }))
          .catch((error) => ({ kind: "ai" as const, ok: false, error }))
      );
    }

    try {
      const results = await Promise.all(tasks);
      const failures = results.filter((r) => !r.ok);

      if (failures.length === 0) {
        const parts: string[] = [];
        if (typedPayload.length) parts.push(`${typedPayload.length} pinned`);
        if (aiDates.length) parts.push(`${aiDates.length} AI pushed`);
        toast.success("Updates Queued", {
          description: parts.join(" · "),
          style: {
            backgroundColor: "#0f151a",
            border: "1px solid #38C6BA",
            color: "#38C6BA",
          },
        });
        return;
      }

      // Roll back state for whichever path failed.
      const typedFailed = failures.some((f) => f.kind === "typed");
      const aiFailed = failures.some((f) => f.kind === "ai");

      setRateOverrides((prev) => {
        const next = { ...prev };
        if (typedFailed) {
          typedPayload.forEach((o) => { delete next[o.stayDate]; });
        }
        if (aiFailed) {
          // Restore any pins we optimistically released.
          aiDates.forEach((d) => {
            if (priorOverrides[d] !== undefined) next[d] = priorOverrides[d];
          });
        }
        return next;
      });
      // Re-stage the failed entries so the user can retry.
      setPendingOverrides((prev) => {
        const next = { ...prev };
        if (typedFailed) typedPayload.forEach((o) => { next[o.stayDate] = o.price; });
        if (aiFailed) aiDates.forEach((d) => { next[d] = snapshot[d]; });
        return next;
      });
      if (aiFailed) {
        setAiApprovedPending((prev) => {
          const next = new Set(prev);
          aiDates.forEach((d) => next.add(d));
          return next;
        });
      }

      const msg = failures
        .map((f) => `${f.kind === "typed" ? "Pinned saves" : "AI push"}: ${f.error?.message || "failed"}`)
        .join(" · ");
      toast.error("Save partially failed", {
        description: msg,
        style: {
          backgroundColor: "#0f151a",
          border: "1px solid #ef4444",
          color: "#ef4444",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // [OVERRIDE v1] Remove a persisted PMS override. After this resolves, the
  // date is eligible for AI management again on the next hourly cycle.
  const removeRateOverride = async (hotelId: string, date: string) => {
    const prior = rateOverrides[date];
    // Optimistic: remove from state first
    setRateOverrides((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
    try {
      await deleteRateOverrides(hotelId, [date]);
      toast.success(`Override cleared for ${date}`, {
        style: { backgroundColor: "#0f151a", border: "1px solid #38C6BA", color: "#38C6BA" },
      });
    } catch (err: any) {
      // Roll back on failure
      if (prior !== undefined) {
        setRateOverrides((prev) => ({ ...prev, [date]: prior }));
      }
      toast.error(`Failed to clear override: ${err.message}`, {
        style: { backgroundColor: "#0f151a", border: "1px solid #ef4444", color: "#ef4444" },
      });
    }
  };

  // Save a daily min rate override and update local calendar data
  const saveMinRate = async (hotelId: string, date: string, value: number) => {
    try {
      await saveDailyMinRates(hotelId, { [date]: value });
      // Update local state immediately so UI reflects the change
      setCalendarData((prev) =>
        prev.map((day) =>
          day.date === date
            ? { ...day, guardrailMin: value, isDailyMinOverride: true }
            : day
        )
      );
    } catch (err: any) {
      toast.error(`Failed to save min rate: ${err.message}`);
    }
  };

  return {
    aiPredictions, // [NEW]
    aiApprovedPending, // [NEW]
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
    applyAiPrediction, // [NEW]
    bulkApplyAi, // [NEW]
    submitChanges,
    saveMinRate,
    rateOverrides, // [OVERRIDE v1] { [date]: basePrice } — active PMS overrides
    removeRateOverride, // [OVERRIDE v1] Clear a persisted override
  };
};
