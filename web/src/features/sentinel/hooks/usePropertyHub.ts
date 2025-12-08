import { useState, useEffect } from "react";
import { toast } from "sonner";
import { isWithinInterval } from "date-fns";
import { getAssets, updateAsset } from "../api/sentinel.api";
import { AssetConfig } from "../api/types";

// --- Types ---
interface Campaign {
  id: string;
  slug: string;
  name: string;
  discount: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
  active: boolean;
  isEditing?: boolean;
}

export interface CalculatorState {
  multiplier: number;
  // [NEW] Tax State
  taxType: "inclusive" | "exclusive";
  taxPercent: number;
  campaigns: Campaign[];
  mobileActive: boolean;
  mobilePercent: number;
  nonRefundableActive: boolean;
  nonRefundablePercent: number;
  countryRateActive: boolean;
  countryRatePercent: number;
  targetSellRate: number;
  pmsRate: number;
  testStayDate: Date | undefined;
  editingField: "pms" | "target";
}

const DEFAULT_CALCULATOR_STATE: CalculatorState = {
  multiplier: 1.3,
  taxType: "inclusive",
  taxPercent: 0,
  campaigns: [],
  mobileActive: true,
  mobilePercent: 10,
  nonRefundableActive: true,
  nonRefundablePercent: 15,
  countryRateActive: false,
  countryRatePercent: 5,
  targetSellRate: 100,
  pmsRate: 0,
  testStayDate: new Date(),
  editingField: "target",
};

// --- Math Logic (Preserved from PropertyHubPage.tsx) ---

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

const calculateSellRate = (
  pmsRate: number,
  geniusPct: number,
  state: CalculatorState
) => {
  let currentRate = pmsRate * state.multiplier;

  if (state.nonRefundableActive) {
    currentRate = currentRate * (1 - Number(state.nonRefundablePercent) / 100);
  }

  // [NEW] Tax Injection (USA)
  if (state.taxType === "exclusive" && state.taxPercent > 0) {
    currentRate = currentRate * (1 + Number(state.taxPercent) / 100);
  }

  const deepDeal = state.campaigns.find(
    (c) =>
      ["black-friday", "limited-time"].includes(c.slug) &&
      isCampaignValidForDate(state.testStayDate, c)
  );

  if (deepDeal) {
    currentRate = currentRate * (1 - Number(deepDeal.discount) / 100);
  } else {
    if (geniusPct > 0)
      currentRate = currentRate * (1 - Number(geniusPct) / 100);

    const validStandard = state.campaigns.filter(
      (c) =>
        !["black-friday", "limited-time"].includes(c.slug) &&
        isCampaignValidForDate(state.testStayDate, c)
    );
    if (validStandard.length > 0) {
      const best = validStandard.reduce((p, c) =>
        p.discount > c.discount ? p : c
      );
      currentRate = currentRate * (1 - Number(best.discount) / 100);
    }

    const isMobileBlocked =
      !!deepDeal ||
      validStandard.some((c) =>
        ["early-deal", "late-escape", "getaway-deal"].includes(c.slug)
      );
    if (state.mobileActive && !isMobileBlocked) {
      currentRate = currentRate * (1 - Number(state.mobilePercent) / 100);
    }
    if (state.countryRateActive) {
      currentRate = currentRate * (1 - Number(state.countryRatePercent) / 100);
    }
  }
  return currentRate;
};

const calculateRequiredPMSRate = (
  targetRate: number,
  geniusPct: number,
  state: CalculatorState
) => {
  let currentRate = targetRate;
  const deepDeal = state.campaigns.find(
    (c) =>
      ["black-friday", "limited-time"].includes(c.slug) &&
      isCampaignValidForDate(state.testStayDate, c)
  );

  if (deepDeal) {
    currentRate = currentRate / (1 - Number(deepDeal.discount) / 100);
  } else {
    if (state.countryRateActive)
      currentRate = currentRate / (1 - Number(state.countryRatePercent) / 100);

    const validStandard = state.campaigns.filter(
      (c) =>
        !["black-friday", "limited-time"].includes(c.slug) &&
        isCampaignValidForDate(state.testStayDate, c)
    );
    const isMobileBlocked =
      !!deepDeal ||
      validStandard.some((c) =>
        ["early-deal", "late-escape", "getaway-deal"].includes(c.slug)
      );

    if (state.mobileActive && !isMobileBlocked)
      currentRate = currentRate / (1 - Number(state.mobilePercent) / 100);

    if (validStandard.length > 0) {
      const best = validStandard.reduce((p, c) =>
        p.discount > c.discount ? p : c
      );
      currentRate = currentRate / (1 - Number(best.discount) / 100);
    }
    if (geniusPct > 0)
      currentRate = currentRate / (1 - Number(geniusPct) / 100);
  }

  // [NEW] Reverse Tax Injection
  if (state.taxType === "exclusive" && state.taxPercent > 0) {
    currentRate = currentRate / (1 + Number(state.taxPercent) / 100);
  }

  if (state.nonRefundableActive) {
    currentRate = currentRate / (1 - Number(state.nonRefundablePercent) / 100);
  }
  return currentRate / state.multiplier;
};

// --- The Hook ---

export const usePropertyHub = () => {
  const [assets, setAssets] = useState<AssetConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [calculatorStates, setCalculatorStates] = useState<
    Record<string, CalculatorState>
  >({});

  // 1. Fetch Assets & Hydrate Calculator
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getAssets();
        setAssets(data);

        const initialCalc: Record<string, CalculatorState> = {};
        data.forEach((asset) => {
          const s = asset.calculator_settings || {};
          const multiplier = asset.strategic_multiplier
            ? parseFloat(String(asset.strategic_multiplier))
            : 1.3;

          initialCalc[asset.id] = {
            multiplier,
            // [NEW] Load Tax Settings
            taxType: s.tax?.type || "inclusive",
            taxPercent: s.tax?.percent || 0,
            campaigns: s.campaigns
              ? s.campaigns.map((c: any) => ({
                  ...c,
                  startDate: c.startDate ? new Date(c.startDate) : undefined,
                  endDate: c.endDate ? new Date(c.endDate) : undefined,
                  isEditing: false,
                }))
              : [],
            mobileActive: s.mobile?.active ?? true,
            mobilePercent: s.mobile?.percent ?? 10,
            nonRefundableActive: s.nonRef?.active ?? true,
            nonRefundablePercent: s.nonRef?.percent ?? 15,
            countryRateActive: s.country?.active ?? false,
            countryRatePercent: s.country?.percent ?? 5,
            targetSellRate: 100,
            pmsRate: 0,
            testStayDate: new Date(),
            editingField: "target",
          };

          // Initial Calc
          const pmsVal = calculateRequiredPMSRate(
            100,
            asset.genius_discount_pct || 0,
            initialCalc[asset.id]
          );
          initialCalc[asset.id].pmsRate = pmsVal;
        });
        setCalculatorStates(initialCalc);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load assets");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // 2. Logic: Update Calculator Local State
  const updateCalculator = (
    assetId: string,
    updates: Partial<CalculatorState>
  ) => {
    setCalculatorStates((prev) => {
      const current = prev[assetId] || DEFAULT_CALCULATOR_STATE;
      const newState = { ...current, ...updates };

      const asset = assets.find((a) => a.id === assetId);
      const genius = asset?.genius_discount_pct || 0;

      if (newState.editingField === "target") {
        newState.pmsRate = calculateRequiredPMSRate(
          newState.targetSellRate,
          genius,
          newState
        );
      } else {
        newState.targetSellRate = calculateSellRate(
          newState.pmsRate,
          genius,
          newState
        );
      }
      return { ...prev, [assetId]: newState };
    });
  };

  // 3. Logic: Persist to DB
  const saveAssetSettings = async (
    assetId: string,
    updates: Partial<AssetConfig> = {}
  ) => {
    const currentAsset = assets.find((a) => a.id === assetId);
    if (!currentAsset) return;

    const calcState = calculatorStates[assetId];
    const settingsPayload = {
      tax: { type: calcState.taxType, percent: calcState.taxPercent },
      mobile: {
        active: calcState.mobileActive,
        percent: calcState.mobilePercent,
      },
      nonRef: {
        active: calcState.nonRefundableActive,
        percent: calcState.nonRefundablePercent,
      },
      country: {
        active: calcState.countryRateActive,
        percent: calcState.countryRatePercent,
      },
      campaigns: calcState.campaigns.map(({ isEditing, ...rest }) => rest),
    };

    const payload = {
      ...currentAsset,
      ...updates,
      strategic_multiplier: calcState.multiplier,
      calculator_settings: settingsPayload,
    };

    // Optimistic UI
    setAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, ...updates } : a))
    );

    try {
      await updateAsset(assetId, payload);
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    }
  };

  return {
    assets,
    isLoading,
    calculatorStates,
    updateCalculator,
    saveAssetSettings,
    // Expose math for UI rendering if needed
    isCampaignValidForDate,
  };
};
