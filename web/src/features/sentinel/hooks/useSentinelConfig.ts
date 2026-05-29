import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  getConfigs,
  getPmsPropertyIds,
  getConfig,
  saveConfig,
  syncFacts,
  syncPreview,
  getDailyMaxRates,
  saveDailyMaxRates,
  getAssets,
  updateAsset,
} from "../api/sentinel.api";
import { SentinelConfig, AssetConfig, PMSRatePlan } from "../api/types";
import {
  CalculatorState,
  DEFAULT_CALCULATOR_STATE,
  calculateSellRate as calcSellRate,
  calculateRequiredPMSRate,
  isCampaignValidForDate,
} from "./usePropertyHub";

// Default "Rules" for a new hotel config (Copied from SentinelControlPanel.tsx)
const DEFAULT_RULES: Partial<SentinelConfig> = {
  sentinel_enabled: false,
  guardrail_max: "400",
  rate_freeze_period: "2",
  base_room_type_id: "",
  last_minute_floor: {
    enabled: false,
    rate: "90",
    days: "7",
    dow: ["sun", "mon"],
  },
  room_differentials: [],
  monthly_min_rates: {
    jan: "100",
    feb: "100",
    mar: "100",
    apr: "100",
    may: "100",
    jun: "100",
    jul: "100",
    aug: "100",
    sep: "100",
    oct: "100",
    nov: "100",
    dec: "100",
  },
  monthly_aggression: {
    jan: "medium",
    feb: "medium",
    mar: "medium",
    apr: "medium",
    may: "medium",
    jun: "medium",
    jul: "medium",
    aug: "medium",
    sep: "medium",
    oct: "medium",
    nov: "medium",
    dec: "medium",
  },
  seasonality_profile: {}, // <--- ADD THIS
  rules: { strategy_mode: "maintain" }, // [NEW] Yield Strategy Defaults
  weak_day_pricing: {
    enabled: false,
    days: ["sun", "mon"],
    floors: {},
    lift_margin_pts: "15",
    lift_pickup_hours: "24",
  },
  daily_max_rates: {},
  pms_room_types: { data: [] },
};

export const useSentinelConfig = (allHotels: any[]) => {
  // --- Data Stores ---
  const [serverConfigs, setServerConfigs] = useState<
    Record<string, SentinelConfig>
  >({});
  const [pmsIdMap, setPmsIdMap] = useState<Record<string, string>>({});

  // --- Form State (The "Rules" being edited) ---
  const [formState, setFormState] = useState<
    Record<string, Partial<SentinelConfig>>
  >({});

  // --- Asset / Promo Config State ---
  const [assets, setAssets] = useState<AssetConfig[]>([]);
  const [calculatorStates, setCalculatorStates] = useState<Record<string, CalculatorState>>({});

  // --- UI State ---
  const [isLoading, setIsLoading] = useState(true);
  const [loadingHotelId, setLoadingHotelId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // --- Rate Plan Picker (Mews properties with multiple root rate plans) ---
  const [ratePlanPicker, setRatePlanPicker] = useState<{
    hotelId: string;
    pmsPropertyId: string;
    ratePlans: PMSRatePlan[];
    autoSelected: string | null;
  } | null>(null);

  // 1. Fetch Initial Data (Configs + PMS IDs)
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [configs, ids, assetData] = await Promise.all([
          getConfigs(),
          getPmsPropertyIds(),
          getAssets(),
        ]);
        setServerConfigs(configs);
        setPmsIdMap(ids);
        setAssets(assetData);

        // Hydrate calculator states keyed by market_pulse_hotel_id
        const initialCalc: Record<string, CalculatorState> = {};
        assetData.forEach((asset: AssetConfig) => {
          if (!asset.market_pulse_hotel_id) return;
          const hotelId = String(asset.market_pulse_hotel_id);
          const s = asset.calculator_settings || {};
          initialCalc[hotelId] = {
            multiplier: asset.strategic_multiplier ? parseFloat(String(asset.strategic_multiplier)) : 1.3,
            taxType: s.tax?.type || "inclusive",
            taxPercent: s.tax?.percent || 0,
            campaigns: s.campaigns ? s.campaigns.map((c: any) => ({
              ...c,
              startDate: c.startDate ? new Date(c.startDate) : undefined,
              endDate: c.endDate ? new Date(c.endDate) : undefined,
              isEditing: false,
            })) : [],
            mobileActive: s.mobile?.active ?? true,
            mobilePercent: s.mobile?.percent ?? 10,
            nonRefundableActive: s.nonRef?.active ?? true,
            nonRefundablePercent: s.nonRef?.percent ?? 10,
            countryRateActive: s.country?.active ?? false,
            countryRatePercent: s.country?.percent ?? 5,
            targetSellRate: 100,
            pmsRate: 0,
            testStayDate: new Date(),
            editingField: "target",
          };
          // Calculate initial PMS rate from default target
          const pmsVal = calculateRequiredPMSRate(100, asset.genius_discount_pct || 0, initialCalc[hotelId]);
          initialCalc[hotelId].pmsRate = pmsVal;
        });
        setCalculatorStates(initialCalc);
      } catch (error) {
        console.error("Failed to load Sentinel data:", error);
        toast.error("Failed to load configuration data.");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // 2. Computed Lists (Active vs Available)
  const { availableHotels, activeHotels } = useMemo(() => {
    const available = [];
    const active = [];

    if (!allHotels) return { availableHotels: [], activeHotels: [] };

    // Filter for Rockenue Managed
    const managedHotels = allHotels.filter((h) => h.is_rockenue_managed);

    for (const hotel of managedHotels) {
      // Merge ID map
      const merged = {
        ...hotel,
        pms_property_id: pmsIdMap[hotel.hotel_id] ?? hotel.pms_property_id,
      };

      const configSummary = serverConfigs[merged.hotel_id];
      const formRules = formState[merged.hotel_id];

      // Check if Synced (Must have room types)
      const isSynced =
        configSummary &&
        configSummary.pms_room_types?.data &&
        configSummary.pms_room_types.data.length > 0;

      if (isSynced) {
        // Merge Server Data + Local Form Edits
        const fullConfig = { ...configSummary, ...formRules };

        // Calculate Status Flags
        const hasFloorRate = fullConfig.last_minute_floor?.enabled === true;
        const freezeDays = parseInt(fullConfig.rate_freeze_period || "0", 10);

        active.push({
          ...merged,
          config: fullConfig,
          status: {
            hasFloorRate,
            hasRateFreeze: freezeDays > 0,
            hasDifferentials: (fullConfig.room_differentials || []).length > 0,
          },
        });
      } else {
        available.push(merged);
      }
    }

    return {
      availableHotels: available,
      activeHotels: active.sort((a, b) =>
        a.property_name.localeCompare(b.property_name),
      ),
    };
  }, [allHotels, serverConfigs, pmsIdMap, formState]);

  // 3. Load Config for a Specific Hotel (Accordion Open)
  const loadHotelRules = async (hotelId: string) => {
    if (formState[hotelId]) return; // Already loaded

    setLoadingHotelId(hotelId);
    try {
      // [MODIFIED] Fetch Config AND Daily Max Rates in parallel
      const [data, maxRates] = await Promise.all([
        getConfig(hotelId),
        getDailyMaxRates(hotelId),
      ]);

      let rulesToSet: Partial<SentinelConfig>;

      if (data) {
        // Merge DB data with defaults to ensure fields exist
        rulesToSet = {
          sentinel_enabled: data.sentinel_enabled,
          guardrail_max: String(
            data.guardrail_max ?? DEFAULT_RULES.guardrail_max,
          ),
          rate_freeze_period: String(
            data.rate_freeze_period ?? DEFAULT_RULES.rate_freeze_period,
          ),
          base_room_type_id: data.base_room_type_id || "",
          last_minute_floor: {
            enabled: data.last_minute_floor?.enabled || false,
            rate: String(
              data.last_minute_floor?.rate ??
                DEFAULT_RULES.last_minute_floor?.rate,
            ),
            days: String(
              data.last_minute_floor?.days ??
                DEFAULT_RULES.last_minute_floor?.days,
            ),
            dow:
              data.last_minute_floor?.dow ||
              DEFAULT_RULES.last_minute_floor?.dow ||
              [],
          },
          room_differentials: data.room_differentials || [],
          monthly_min_rates: {
            ...DEFAULT_RULES.monthly_min_rates,
            ...data.monthly_min_rates,
          },
          monthly_aggression: {
            ...DEFAULT_RULES.monthly_aggression,
            ...data.monthly_aggression,
          },
          // 🟢 FIX: Capture the new profile from the server
          seasonality_profile: data.seasonality_profile || {},

          // [NEW] Capture Yield Strategy Rules
          rules: data.rules || DEFAULT_RULES.rules,

          // [NEW] Capture Weak Day Pricing (merge over defaults so the shape is
          // always complete, even for hotels saved before this column existed)
          weak_day_pricing: {
            ...DEFAULT_RULES.weak_day_pricing,
            ...(data.weak_day_pricing || {}),
            floors: data.weak_day_pricing?.floors || {},
            days:
              data.weak_day_pricing?.days ||
              DEFAULT_RULES.weak_day_pricing?.days ||
              [],
          },

          daily_max_rates: maxRates || {},
          pms_room_types: data.pms_room_types || { data: [] },
          pms_rate_plans: data.pms_rate_plans || { data: [] },
          rate_id_map: data.rate_id_map || {},
        };
      } else {
        rulesToSet = DEFAULT_RULES;
      }

      setFormState((prev) => ({ ...prev, [hotelId]: rulesToSet }));
    } catch (error) {
      console.error(error);
      toast.error("Failed to load hotel rules.");
    } finally {
      setLoadingHotelId(null);
    }
  };

  // 4. Handle Field Updates (Deep Merge)
  const updateRule = (hotelId: string, path: string, value: any) => {
    setFormState((prev) => {
      const newConfig = JSON.parse(
        JSON.stringify(prev[hotelId] || DEFAULT_RULES),
      );

      // Update nested property using path string (e.g. "last_minute_floor.rate")
      let current = newConfig;
      const parts = path.split(".");
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;

      return { ...prev, [hotelId]: newConfig };
    });
  };

  // 5. Actions: Sync & Save
  const activateHotel = async (hotelId: string, pmsPropertyId: string) => {
    setIsSyncing(hotelId);
    const toastId = toast.loading("Fetching PMS data...");
    try {
      // Step 1: Preview — fetch rate plans to check if we need manual selection
      const preview = await syncPreview(hotelId, pmsPropertyId);
      const ratePlans: PMSRatePlan[] = preview.pms_rate_plans?.data || [];
      const isMews = preview.pms_type === "mews";

      if (isMews) {
        const rootRates = ratePlans.filter((r: PMSRatePlan) => !r.isDerived);
        if (rootRates.length > 1) {
          // Multiple root rate plans — show picker
          const autoName = ["base", "standard", "rack", "bar"];
          const autoMatch = rootRates.find((r: PMSRatePlan) =>
            autoName.some((kw) => (r.ratePlanName || "").toLowerCase().includes(kw))
          );
          setRatePlanPicker({
            hotelId,
            pmsPropertyId,
            ratePlans: rootRates,
            autoSelected: autoMatch?.rateID || null,
          });
          toast.info("Select a rate plan for this property.", { id: toastId });
          setIsSyncing(null);
          return; // Wait for user selection
        }
      }

      // No picker needed — proceed with auto-detection
      await completeActivation(hotelId, pmsPropertyId, undefined, toastId);
    } catch (error: any) {
      toast.error("Sync failed", { id: toastId, description: error.message });
      setIsSyncing(null);
    }
  };

  // Step 2: Complete activation (called directly or after rate plan selection)
  const completeActivation = async (
    hotelId: string,
    pmsPropertyId: string,
    selectedRateId?: string,
    existingToastId?: string | number
  ) => {
    setIsSyncing(hotelId);
    const toastId = existingToastId || toast.loading("Syncing with PMS...");
    if (!existingToastId) toast.loading("Syncing with PMS...", { id: toastId });
    try {
      const data = await syncFacts(hotelId, pmsPropertyId, selectedRateId);

      setServerConfigs((prev) => ({ ...prev, [hotelId]: data }));

      setFormState((prev) => {
        const existingRules = prev[hotelId] || DEFAULT_RULES;
        return {
          ...prev,
          [hotelId]: {
            ...existingRules,
            sentinel_enabled:
              data.sentinel_enabled ?? existingRules.sentinel_enabled,
            pms_room_types: data.pms_room_types,
            pms_rate_plans: data.pms_rate_plans || existingRules.pms_rate_plans,
            rate_id_map: data.rate_id_map || existingRules.rate_id_map,
            base_room_type_id:
              data.base_room_type_id ||
              existingRules.base_room_type_id ||
              data.pms_room_types?.data?.[0]?.roomTypeID ||
              "",
          },
        };
      });

      setRatePlanPicker(null);
      toast.success("Sync complete.", { id: toastId });
    } catch (error: any) {
      toast.error("Sync failed", { id: toastId, description: error.message });
    } finally {
      setIsSyncing(null);
    }
  };

  const dismissRatePlanPicker = () => setRatePlanPicker(null);

  const saveRules = async (hotelId: string) => {
    setIsSaving(hotelId);
    const toastId = toast.loading("Saving rules...");
    try {
      // 1. Clone the current state so we don't mutate the UI while prepping data
      let rules = { ...formState[hotelId] };
      if (!rules) throw new Error("No rules to save");

      // 2. Sanitize numeric inputs (prevent empty strings causing 500s)
      if (rules.rate_freeze_period === "") rules.rate_freeze_period = "0";
      if (rules.guardrail_max === "") rules.guardrail_max = "0";

      // [FIX] Ensure Seasonality Profile is complete (1-12)
      // If user hasn't touched a month, default it to 'low' so DB is valid.
      if (!rules.seasonality_profile) rules.seasonality_profile = {};
      for (let i = 1; i <= 12; i++) {
        const key = String(i);
        if (!rules.seasonality_profile[key]) {
          rules.seasonality_profile[key] = "low";
        }
      }

      if (rules.last_minute_floor) {
        rules.last_minute_floor = { ...rules.last_minute_floor };
        if (rules.last_minute_floor.rate === "")
          rules.last_minute_floor.rate = "0";
        if (rules.last_minute_floor.days === "")
          rules.last_minute_floor.days = "0";
      }

      // [NEW] Weak Day Pricing sanitize. Drop blank/invalid floors entirely so a
      // missing value means "fall back to the monthly min" — NEVER £0. Default
      // the lift gates if cleared.
      if (rules.weak_day_pricing) {
        const wdp = { ...rules.weak_day_pricing };
        const cleanFloors: Record<string, string> = {};
        Object.entries(wdp.floors || {}).forEach(([d, v]) => {
          const n = parseFloat(String(v));
          if (Number.isFinite(n) && n > 0) cleanFloors[d] = String(n);
        });
        wdp.floors = cleanFloors;
        if (!wdp.lift_margin_pts || wdp.lift_margin_pts === "")
          wdp.lift_margin_pts = "15";
        if (!wdp.lift_pickup_hours || wdp.lift_pickup_hours === "")
          wdp.lift_pickup_hours = "24";
        if (!Array.isArray(wdp.days)) wdp.days = [];
        rules.weak_day_pricing = wdp;
      }

      // -----------------------------------------------------------------------
      // [FIX] ENSURE ALL ROOM TYPES HAVE A DIFFERENTIAL
      // Room types without an explicit differential would be skipped entirely.
      // Auto-inject 0% for any room type not already in the list (including base).
      // -----------------------------------------------------------------------
      if (rules.pms_room_types?.data) {
        const currentDiffs = Array.isArray(rules.room_differentials)
          ? [...rules.room_differentials]
          : [];

        for (const room of rules.pms_room_types.data) {
          const exists = currentDiffs.some(
            (d) => d.roomTypeId === room.roomTypeID,
          );
          if (!exists) {
            currentDiffs.push({
              roomTypeId: room.roomTypeID,
              value: "0",
              operator: "+",
            });
          }
        }

        rules.room_differentials = currentDiffs;
      }
      // -----------------------------------------------------------------------

      const data = await saveConfig(hotelId, rules as SentinelConfig);

      setServerConfigs((prev) => ({ ...prev, [hotelId]: data }));

      // Update local form state with the sanitized/saved data to ensure consistency
      setFormState((prev) => ({ ...prev, [hotelId]: data }));

      toast.success("Configuration saved successfully.", { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to save configuration.", {
        id: toastId,
        description: error.message,
      });
    } finally {
      setIsSaving(null);
    }
  };

  // --- Promo Config: Update Calculator ---
  const updateCalculator = (hotelId: string, updates: Partial<CalculatorState>) => {
    setCalculatorStates((prev) => {
      const current = prev[hotelId] || DEFAULT_CALCULATOR_STATE;
      const newState = { ...current, ...updates };
      const asset = assets.find((a) => String(a.market_pulse_hotel_id) === hotelId);
      const genius = asset?.genius_discount_pct || 0;

      if (newState.editingField === "target") {
        newState.pmsRate = calculateRequiredPMSRate(newState.targetSellRate, genius, newState);
      } else {
        newState.targetSellRate = calcSellRate(newState.pmsRate, genius, newState);
      }
      return { ...prev, [hotelId]: newState };
    });
  };

  // --- Promo Config: Save to rockenue_managed_assets ---
  const savePromoConfig = async (hotelId: string, geniusOverride?: number) => {
    const asset = assets.find((a) => String(a.market_pulse_hotel_id) === hotelId);
    if (!asset) return;

    const calcState = calculatorStates[hotelId];
    if (!calcState) return;

    const settingsPayload = {
      tax: { type: calcState.taxType, percent: calcState.taxPercent },
      mobile: { active: calcState.mobileActive, percent: calcState.mobilePercent },
      nonRef: { active: calcState.nonRefundableActive, percent: calcState.nonRefundablePercent },
      country: { active: calcState.countryRateActive, percent: calcState.countryRatePercent },
      campaigns: calcState.campaigns.map(({ isEditing, ...rest }: any) => rest),
    };

    const payload: any = {
      ...asset,
      strategic_multiplier: calcState.multiplier,
      calculator_settings: settingsPayload,
    };
    if (geniusOverride !== undefined) {
      payload.genius_discount_pct = geniusOverride;
    }

    // Optimistic UI
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, ...payload } : a)));

    try {
      await updateAsset(asset.id, payload);
      toast.success("Promo config saved");
    } catch (e) {
      toast.error("Failed to save promo config");
    }
  };

  // Helper: get asset by hotel ID
  const getAssetForHotel = (hotelId: string) =>
    assets.find((a) => String(a.market_pulse_hotel_id) === hotelId);

  return {
    // State
    isLoading,
    loadingHotelId,
    isSaving,
    isSyncing,
    availableHotels,
    activeHotels,
    formState,

    // Rate Plan Picker (Mews)
    ratePlanPicker,
    completeActivation,
    dismissRatePlanPicker,

    // Promo Config
    assets,
    calculatorStates,
    updateCalculator,
    savePromoConfig,
    getAssetForHotel,
    isCampaignValidForDate,

    // Actions
    loadHotelRules,
    updateRule,
    activateHotel,
    saveRules,
    saveDailyMaxRates,
  };
};
