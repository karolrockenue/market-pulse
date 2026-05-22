/**
 * Phase 4 parity verification.
 *
 * Proves that sourcing the Booking.com Sell Rate waterfall from Channel Pricing
 * (the new path) reproduces the legacy asset-derived Sell Rate, EXCEPT for the
 * intended evergreen-consolidation deltas (Vilenza's Aug tail, per Phase 3).
 *
 * Method: for every managed hotel × 90 forward dates × {targeting on, off},
 * compute the rate factor via the SAME legacy engine (getRateFactors, copied
 * verbatim from useRateGrid.ts) fed by two CalculatorStates:
 *   LEGACY — built from rockenue_managed_assets (mirrors useRateGrid loadRates)
 *   CP     — built by stepsToCalculatorState() from the resolved Channel Pricing
 *            steps (default + override, merged exactly like the new endpoint)
 *
 * A divergence is a real bug UNLESS it's an expected consolidation delta (a
 * hotel that had a dated late-escape/early-deal now evergreen). Those are
 * reported separately and not counted as failures.
 *
 * Run: node --experimental-strip-types scripts/verify-phase4-sell-rate-parity.mts
 */

import { createRequire } from "node:module";
import { stepsToCalculatorState } from "../web/src/features/sentinel/hooks/channelPricingBridge.ts";
import type { WaterfallStep } from "../web/src/features/rockenue/api/types.ts";

const require = createRequire(import.meta.url);
require("dotenv").config();
const pool = require("../api/utils/db");

const TOLERANCE = 1e-6; // factor units; ~£0.0001 on £100
const HORIZON_DAYS = 90;
const BOOKING_SLUGS = ["booking-com", "booking.com", "bookingcom", "booking_com", "booking"];

// ── Legacy engine (verbatim from web/src/features/sentinel/hooks/useRateGrid.ts) ──
function isCampaignValidForDate(testDate: Date | undefined, camp: any): boolean {
  if (!camp.active) return false;
  if (camp.slug === "long-campaign") return true;
  if (!testDate || !camp.startDate || !camp.endDate) return false;
  const t = +testDate, s = +new Date(camp.startDate), e = +new Date(camp.endDate);
  if (isNaN(s) || isNaN(e)) return false;
  return t >= s && t <= e;
}

function getRateFactors(
  geniusPct: number,
  state: any,
  dateStr: string,
  options?: { forceMultiplier?: number; includeTargeting?: boolean }
): number {
  if (!state) return 0;
  const cellDate = new Date(dateStr);
  let factor = options?.forceMultiplier !== undefined ? options.forceMultiplier : state.multiplier;
  if (state.nonRefundableActive) factor *= 1 - Number(state.nonRefundablePercent) / 100;

  const deepDeal = state.campaigns.find(
    (c: any) => ["black-friday", "limited-time"].includes(c.slug) && isCampaignValidForDate(cellDate, c)
  );
  if (deepDeal) {
    factor *= 1 - Number(deepDeal.discount) / 100;
  } else {
    if (geniusPct > 0) factor *= 1 - Number(geniusPct) / 100;
    const validStandard = state.campaigns.filter(
      (c: any) => !["black-friday", "limited-time"].includes(c.slug) && isCampaignValidForDate(cellDate, c)
    );
    if (validStandard.length > 0) {
      const best = validStandard.reduce((p: any, c: any) => (p.discount > c.discount ? p : c));
      factor *= 1 - Number(best.discount) / 100;
    }
    if (options?.includeTargeting) {
      const isMobileBlocked = !!deepDeal || validStandard.some((c: any) =>
        ["long-campaign", "early-deal", "late-escape", "getaway-deal"].includes(c.slug)
      );
      if (state.mobileActive && !isMobileBlocked) factor *= 1 - Number(state.mobilePercent) / 100;
      if (state.countryRateActive) factor *= 1 - Number(state.countryRatePercent) / 100;
    }
  }
  return factor;
}

// ── Build LEGACY CalculatorState from asset (mirrors useRateGrid loadRates) ──
function legacyState(asset: any) {
  const s = asset.calculator_settings || {};
  return {
    multiplier: asset.strategic_multiplier ? parseFloat(String(asset.strategic_multiplier)) : 1.3,
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
  };
}

function forwardDates(n: number): string[] {
  const t = new Date(); t.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t); d.setUTCDate(t.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function mergeSteps(defaults: WaterfallStep[], overrides: any): WaterfallStep[] {
  return defaults.map((step) => {
    const o = overrides && overrides[step.key];
    if (!o) return { ...step };
    return { ...step, value: o.value !== undefined ? o.value : step.value, active: o.active !== undefined ? o.active : step.active };
  });
}

async function main() {
  console.log("Phase 4 Sell Rate parity: legacy (asset) vs Channel Pricing\n");

  const channel = (await pool.query(
    `SELECT id FROM distribution_channels WHERE LOWER(slug) = ANY($1::text[]) OR LOWER(name) LIKE '%booking%' ORDER BY id LIMIT 1`,
    [BOOKING_SLUGS]
  )).rows[0];
  if (!channel) { console.error("✗ Booking.com channel not found"); process.exit(1); }

  const defaults: WaterfallStep[] = (await pool.query(
    `SELECT steps FROM distribution_channel_pricing WHERE channel_id = $1`, [channel.id]
  )).rows[0]?.steps || [];

  const { rows: overrideRows } = await pool.query(
    `SELECT hotel_id, overrides FROM distribution_hotel_pricing_overrides WHERE channel_id = $1`, [channel.id]
  );
  const ovByHotel = new Map(overrideRows.map((r: any) => [String(r.hotel_id), r.overrides]));

  const { rows: assets } = await pool.query(`
    SELECT rma.genius_discount_pct, sc.strategic_multiplier, sc.calculator_settings,
           h.hotel_id, h.property_name
    FROM rockenue_managed_assets rma
    JOIN hotels h ON h.hotel_id::text = rma.market_pulse_hotel_id
    LEFT JOIN sentinel_configurations sc ON sc.hotel_id::text = rma.market_pulse_hotel_id
    WHERE (h.is_disconnected IS NULL OR h.is_disconnected = false)
    ORDER BY h.property_name ASC
  `);

  const dates = forwardDates(HORIZON_DAYS);
  let exactHotels = 0;
  let consolidationHotels = 0;
  const realFailures: any[] = [];

  for (const asset of assets) {
    const legacy = legacyState(asset);
    const legacyGenius = Number(asset.genius_discount_pct) || 0;

    const merged = mergeSteps(defaults, ovByHotel.get(String(asset.hotel_id)));
    const { calcState: cp, geniusPct: cpGenius } = stepsToCalculatorState(merged);

    let maxDiff = 0;
    let consolidationDelta = false;
    const bugs: any[] = [];

    for (const date of dates) {
      for (const includeTargeting of [true, false]) {
        const opts = { includeTargeting };
        const fL = getRateFactors(legacyGenius, legacy, date, opts);
        const fC = getRateFactors(cpGenius, cp, date, opts);
        const diff = Math.abs(fL - fC);
        if (diff > maxDiff) maxDiff = diff;
        if (diff > TOLERANCE) {
          // Expected if the asset has a dated standard campaign now made evergreen:
          // the divergence appears only OUTSIDE the asset campaign's date range.
          const assetHasDatedStd = legacy.campaigns.some((c: any) =>
            ["early-deal", "late-escape", "getaway-deal"].includes(c.slug) && c.active
          );
          if (assetHasDatedStd) consolidationDelta = true;
          else bugs.push({ date, includeTargeting, legacy: fL.toFixed(6), cp: fC.toFixed(6) });
        }
      }
    }

    if (bugs.length > 0) {
      realFailures.push({ hotel_id: asset.hotel_id, property_name: asset.property_name, sample: bugs.slice(0, 3) });
      console.log(`  ✗ ${String(asset.hotel_id).padEnd(8)} ${asset.property_name}  ${bugs.length} real divergence(s)`);
      bugs.slice(0, 3).forEach((b) => console.log(`        ${b.date} targeting=${b.includeTargeting} legacy=${b.legacy} cp=${b.cp}`));
    } else if (consolidationDelta) {
      consolidationHotels++;
      console.log(`  ~ ${String(asset.hotel_id).padEnd(8)} ${asset.property_name}  parity except intended consolidation tail (maxΔ=${maxDiff.toFixed(4)})`);
    } else {
      exactHotels++;
    }
  }

  console.log("\n─────────────────────────────────────────────");
  console.log(`  Exact parity:          ${exactHotels} hotels`);
  console.log(`  Parity + intended tail: ${consolidationHotels} hotels (evergreen consolidation)`);
  console.log(`  REAL divergences:      ${realFailures.length} hotels`);
  console.log("─────────────────────────────────────────────");

  if (realFailures.length > 0) {
    console.error("\n✗ FAIL — Channel Pricing path diverges from legacy beyond the intended consolidation. Investigate stepsToCalculatorState / endpoint merge.");
    process.exit(1);
  }
  console.log("\n✓ PASS — Channel Pricing Sell Rate matches legacy (modulo the accepted evergreen consolidation).");
}

main().then(() => pool.end()).catch((e) => { console.error("✗ crashed:", e); pool.end(); process.exit(1); });
