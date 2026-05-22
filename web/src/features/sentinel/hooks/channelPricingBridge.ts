/**
 * Phase 4 bridge — Channel Pricing → useRateGrid.
 *
 * Lets My Rates / Rate Manager source the Booking.com Sell Rate waterfall from
 * Channel Pricing (distribution_channel_pricing + overrides) instead of
 * rockenue_managed_assets, WITHOUT changing the proven calc engine.
 *
 * Strategy: fetch the resolved (default + per-hotel override) step list, then
 * map it into the existing `CalculatorState` shape that `getRateFactors` /
 * `calculateSellRate` / `calculateRequiredOverride` already consume. The engine
 * — including `forceMultiplier` / `includeTargeting` semantics — is unchanged,
 * so only the DATA SOURCE moves. Pushes nothing (display + reverse-calc only).
 *
 * Gated by VITE_USE_CHANNEL_PRICING_SELL_RATE (see useRateGrid). Any fetch
 * error falls back to the legacy asset path in the caller.
 *
 * See claude/channel-pricing-migration.md Phase 4.
 */

import type { WaterfallStep } from "../../rockenue/api/types";
import type { CalculatorState } from "./useRateGrid";

// Optional chaining keeps this safe outside Vite (e.g. the headless parity
// verification script in Node, where import.meta.env is undefined).
export const CHANNEL_PRICING_ENABLED =
  (import.meta as any)?.env?.VITE_USE_CHANNEL_PRICING_SELL_RATE === "true";

/** Fetch the merged Booking.com steps for a hotel. Throws on non-OK (caller falls back). */
export async function fetchResolvedBookingSteps(hotelId: string): Promise<WaterfallStep[]> {
  const res = await fetch(`/api/sentinel/channel-pricing/resolved/${hotelId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `channel-pricing resolve failed (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data?.steps) ? data.steps : [];
}

/**
 * Map resolved Channel Pricing steps → the legacy CalculatorState + geniusPct.
 *
 * The legacy engine keys campaign semantics off `slug`:
 *   - "long-campaign"                                  → evergreen (always valid) + mobile-blocking
 *   - "early-deal"/"late-escape"/"getaway-deal"        → dated + mobile-blocking
 *   - "black-friday"/"limited-time"                    → deep-deal fork
 * We reconstruct slugs from each step's role/flags so the unchanged engine
 * behaves identically. Post-consolidation the only standard campaign is the
 * evergreen long_campaign; the dated/deep-deal branches are kept for generality.
 */
export function stepsToCalculatorState(
  steps: WaterfallStep[]
): { calcState: CalculatorState; geniusPct: number } {
  const byRole = (role: string) => steps.find((s) => s.role === role);

  const mult = byRole("multiplier");
  const nonref = byRole("non_refundable");
  const genius = byRole("genius");
  const mobile = byRole("mobile");
  const country = byRole("country");

  const toDate = (d?: string | null) => (d ? new Date(d) : undefined);

  const campaigns = steps
    .filter((s) => s.role === "standard_campaign" || s.role === "deep_deal")
    .map((s) => {
      let slug: string;
      if (s.role === "deep_deal") {
        slug = "black-friday";
      } else if (s.isEvergreen) {
        slug = "long-campaign";
      } else if (s.blocksMobile) {
        slug = "late-escape";
      } else {
        slug = "standard-campaign";
      }
      return {
        id: s.key,
        slug,
        name: s.label,
        discount: Number(s.value) || 0,
        // Evergreen long-campaign ignores dates in the engine; others use them.
        startDate: s.isEvergreen ? undefined : toDate(s.startDate),
        endDate: s.isEvergreen ? undefined : toDate(s.endDate),
        active: !!s.active,
      };
    });

  const calcState: CalculatorState = {
    multiplier: mult && mult.active ? Number(mult.value) || 1 : 1,
    campaigns,
    mobileActive: !!mobile?.active,
    mobilePercent: mobile ? Number(mobile.value) || 0 : 0,
    nonRefundableActive: !!nonref?.active,
    nonRefundablePercent: nonref ? Number(nonref.value) || 0 : 0,
    countryRateActive: !!country?.active,
    countryRatePercent: country ? Number(country.value) || 0 : 0,
  };

  // Genius is applied via the geniusPct param in getRateFactors, not via campaigns.
  const geniusPct = genius && genius.active && Number(genius.value) > 0 ? Number(genius.value) : 0;

  return { calcState, geniusPct };
}
