/**
 * Channel Pricing → Sell Rate resolver.
 *
 * This file is the canonical implementation of the Booking.com-shaped Sell Rate
 * waterfall. It replaces the `calculateSellRate` / `getRateFactors` functions
 * in `sentinel/hooks/useRateGrid.ts` and `sentinel/hooks/usePropertyHub.ts`
 * once Phase 4 of the Channel Pricing migration rewires the data source
 * (see claude/channel-pricing-migration.md).
 *
 * Until Phase 4 ships, this resolver is read-only (used by the Channel Pricing
 * simulator and the golden test harness). The legacy resolvers remain the
 * production path for Sell Rate rendering.
 *
 * Semantics (must match legacy exactly, ±£0.10 tolerance per golden test):
 *
 *   factor = 1
 *   factor *= product(active multiplier steps)
 *   factor *= product(1 - step.value/100) for each active non_refundable step
 *   if taxInjection is "exclusive": factor *= (1 + taxInjection.percent/100)
 *
 *   IF any active deep_deal step is valid for the date:
 *     factor *= (1 - bestDeepDeal.value/100)        // deep deal replaces standard path
 *   ELSE:
 *     factor *= (1 - genius.value/100) for each active genius step with value > 0
 *     if any active standard_campaign is valid for the date:
 *       factor *= (1 - bestStandardCampaign.value/100)
 *     if NOT any active standard_campaign (valid for date) has blocksMobile=true:
 *       factor *= (1 - mobile.value/100) for each active mobile step
 *     factor *= (1 - country.value/100) for each active country step
 *
 *   sellRate = pmsRate * factor
 *
 * Tax lives outside Channel Pricing: callers pass `taxInjection` sourced from
 * `rockenue_managed_assets.calculator_settings.tax` until tax migrates to Admin.
 */

import type { WaterfallStep, HotelPricingOverride } from "../api/types";

export interface TaxInjection {
  type: "inclusive" | "exclusive";
  percent: number;
}

export interface ResolveOptions {
  /**
   * Country-level tax injected after non_refundable, before the deep-deal fork.
   * Only "exclusive" is applied; "inclusive" is a display flag only (guest rate
   * already includes the tax, so the factor is unchanged).
   */
  taxInjection?: TaxInjection | null;
}

// ──────────────────────────────────────────────────────────
// Date validation
// ──────────────────────────────────────────────────────────

/**
 * Returns true if a date-gated step (standard_campaign or deep_deal) is valid
 * for the given stay date. Non-campaign roles should NOT be passed to this
 * function — they're date-agnostic and apply unconditionally when active.
 *
 * Rules (mirrors legacy isCampaignValidForDate):
 *   - isEvergreen=true      → always valid
 *   - missing both dates    → invalid (can't fire without a range)
 *   - date in [start, end]  → valid (inclusive on both ends)
 */
export function isCampaignValidForDate(step: WaterfallStep, dateStr: string): boolean {
  if (step.isEvergreen) return true;
  if (!step.startDate || !step.endDate) return false;
  // Lexicographic compare works for ISO YYYY-MM-DD strings.
  return dateStr >= step.startDate && dateStr <= step.endDate;
}

// ──────────────────────────────────────────────────────────
// Merge default channel steps with per-hotel override
// ──────────────────────────────────────────────────────────

/**
 * Merge channel-level default steps with a per-hotel override map.
 * Overrides can change `value` and `active` of any matching step key.
 * Role, dates, and structural flags come from the default (per Phase 1 scope —
 * revisit if hotels need to change campaign dates individually).
 */
export function mergeStepsWithOverride(
  defaults: WaterfallStep[],
  override: HotelPricingOverride | null | undefined
): WaterfallStep[] {
  if (!override) return defaults.map((s) => ({ ...s }));
  return defaults.map((step) => {
    const ov = override[step.key];
    if (!ov) return { ...step };
    return {
      ...step,
      value: ov.value !== undefined ? ov.value : step.value,
      active: ov.active !== undefined ? ov.active : step.active,
    };
  });
}

// ──────────────────────────────────────────────────────────
// Core resolver
// ──────────────────────────────────────────────────────────

function bestByValue(list: WaterfallStep[]): WaterfallStep | null {
  if (list.length === 0) return null;
  return list.reduce((a, b) => (a.value > b.value ? a : b));
}

/**
 * Returns the decimal factor to multiply PMS rate by. Useful when callers need
 * the factor separately from a PMS rate (e.g. reverse calculation for required
 * PMS rate given a target Sell Rate).
 */
export function getRateFactor(
  steps: WaterfallStep[],
  dateStr: string,
  options?: ResolveOptions
): number {
  const active = steps.filter((s) => s.active);

  // Phase 1: multipliers (compounded)
  let factor = 1;
  for (const s of active) {
    if (s.role === "multiplier" && s.type === "multiplier") {
      factor *= s.value;
    }
  }

  // Phase 2: non_refundable (compounded discounts)
  for (const s of active) {
    if (s.role === "non_refundable" && s.type === "discount") {
      factor *= 1 - s.value / 100;
    }
  }

  // Phase 3: tax injection (external, from rockenue_managed_assets until Admin move)
  const tax = options?.taxInjection;
  if (tax && tax.type === "exclusive" && tax.percent > 0) {
    factor *= 1 + tax.percent / 100;
  }

  // Phase 4: deep-deal fork vs standard path
  const validDeepDeals = active.filter(
    (s) => s.role === "deep_deal" && isCampaignValidForDate(s, dateStr)
  );
  if (validDeepDeals.length > 0) {
    const best = bestByValue(validDeepDeals);
    if (best) factor *= 1 - best.value / 100;
    return factor;
  }

  // Standard path: genius
  for (const s of active) {
    if (s.role === "genius" && s.type === "discount" && s.value > 0) {
      factor *= 1 - s.value / 100;
    }
  }

  // Standard path: best valid standard_campaign
  const validStandards = active.filter(
    (s) => s.role === "standard_campaign" && isCampaignValidForDate(s, dateStr)
  );
  const bestStandard = bestByValue(validStandards);
  if (bestStandard) {
    factor *= 1 - bestStandard.value / 100;
  }

  // Standard path: mobile (unless blocked by an active valid standard_campaign)
  const isMobileBlocked = validStandards.some((s) => s.blocksMobile === true);
  if (!isMobileBlocked) {
    for (const s of active) {
      if (s.role === "mobile" && s.type === "discount") {
        factor *= 1 - s.value / 100;
      }
    }
  }

  // Standard path: country
  for (const s of active) {
    if (s.role === "country" && s.type === "discount") {
      factor *= 1 - s.value / 100;
    }
  }

  return factor;
}

export function resolveSellRate(
  pmsRate: number,
  steps: WaterfallStep[],
  dateStr: string,
  options?: ResolveOptions
): number {
  if (!pmsRate || pmsRate <= 0) return 0;
  return pmsRate * getRateFactor(steps, dateStr, options);
}

// ──────────────────────────────────────────────────────────
// Breakdown — for the MPChannels simulator (Phase 2)
// ──────────────────────────────────────────────────────────

export interface BreakdownEntry {
  step: WaterfallStep;
  applied: boolean;
  skipReason: "inactive" | "date_gated_out" | "deep_deal_override" | "mobile_blocked" | null;
  factorBefore: number;
  factorAfter: number;
}

/**
 * Returns a per-step breakdown of how the resolver arrived at the final factor.
 * Used by the Channel Pricing simulator to render a live "applied vs skipped"
 * trace for a given stay date.
 */
export function explainRateFactor(
  steps: WaterfallStep[],
  dateStr: string,
  options?: ResolveOptions
): { factor: number; entries: BreakdownEntry[] } {
  const entries: BreakdownEntry[] = [];
  let factor = 1;

  // Compute which standard_campaigns are valid so we can mark mobile-blocking
  const validStandards = steps.filter(
    (s) => s.active && s.role === "standard_campaign" && isCampaignValidForDate(s, dateStr)
  );
  const bestStandardKey = bestByValue(validStandards)?.key ?? null;
  const mobileBlocked = validStandards.some((s) => s.blocksMobile === true);

  const validDeepDeals = steps.filter(
    (s) => s.active && s.role === "deep_deal" && isCampaignValidForDate(s, dateStr)
  );
  const bestDeepDealKey = bestByValue(validDeepDeals)?.key ?? null;
  const deepDealActive = !!bestDeepDealKey;

  for (const step of steps) {
    const before = factor;

    if (!step.active) {
      entries.push({ step, applied: false, skipReason: "inactive", factorBefore: before, factorAfter: before });
      continue;
    }

    // Multiplier
    if (step.role === "multiplier" && step.type === "multiplier") {
      factor *= step.value;
      entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      continue;
    }

    // Non-refundable
    if (step.role === "non_refundable" && step.type === "discount") {
      factor *= 1 - step.value / 100;
      entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      continue;
    }

    // Deep deal — only best one applies
    if (step.role === "deep_deal") {
      if (!isCampaignValidForDate(step, dateStr)) {
        entries.push({ step, applied: false, skipReason: "date_gated_out", factorBefore: before, factorAfter: before });
        continue;
      }
      if (step.key === bestDeepDealKey) {
        factor *= 1 - step.value / 100;
        entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      } else {
        entries.push({ step, applied: false, skipReason: "deep_deal_override", factorBefore: before, factorAfter: before });
      }
      continue;
    }

    // If a deep deal is active, standard-path steps are all skipped
    if (deepDealActive && (step.role === "genius" || step.role === "standard_campaign" || step.role === "mobile" || step.role === "country")) {
      entries.push({ step, applied: false, skipReason: "deep_deal_override", factorBefore: before, factorAfter: before });
      continue;
    }

    // Standard path: genius
    if (step.role === "genius" && step.type === "discount") {
      if (step.value > 0) {
        factor *= 1 - step.value / 100;
        entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      } else {
        entries.push({ step, applied: false, skipReason: "inactive", factorBefore: before, factorAfter: before });
      }
      continue;
    }

    // Standard campaign — only best valid one applies
    if (step.role === "standard_campaign") {
      if (!isCampaignValidForDate(step, dateStr)) {
        entries.push({ step, applied: false, skipReason: "date_gated_out", factorBefore: before, factorAfter: before });
        continue;
      }
      if (step.key === bestStandardKey) {
        factor *= 1 - step.value / 100;
        entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      } else {
        entries.push({ step, applied: false, skipReason: "date_gated_out", factorBefore: before, factorAfter: before });
      }
      continue;
    }

    // Mobile
    if (step.role === "mobile" && step.type === "discount") {
      if (mobileBlocked) {
        entries.push({ step, applied: false, skipReason: "mobile_blocked", factorBefore: before, factorAfter: before });
      } else {
        factor *= 1 - step.value / 100;
        entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      }
      continue;
    }

    // Country
    if (step.role === "country" && step.type === "discount") {
      factor *= 1 - step.value / 100;
      entries.push({ step, applied: true, skipReason: null, factorBefore: before, factorAfter: factor });
      continue;
    }

    // Unknown role — informational, no-op
    entries.push({ step, applied: false, skipReason: "inactive", factorBefore: before, factorAfter: before });
  }

  // Note: tax injection is not rendered here (it's not a Channel Pricing step).
  // Callers that want the full picture including tax should use getRateFactor()
  // with options.taxInjection and render tax as a supplementary row.

  const tax = options?.taxInjection;
  if (tax && tax.type === "exclusive" && tax.percent > 0) {
    // Reflect in factor only — caller handles UI.
    factor *= 1 + tax.percent / 100;
  }

  return { factor, entries };
}
