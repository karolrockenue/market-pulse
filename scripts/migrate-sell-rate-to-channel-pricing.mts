/**
 * Phase 3 — Channel Pricing migration backfill.
 *
 * Converts every Rockenue-managed hotel's legacy Control-Panel OTA Discount
 * Stack into the Channel Pricing model:
 *   - one Booking.com GLOBAL DEFAULT  → distribution_channel_pricing.steps
 *   - one per-hotel OVERRIDE (minimal diff) → distribution_hotel_pricing_overrides.overrides
 *
 * See claude/channel-pricing-migration.md §5 Phase 3.
 *
 * KEY DESIGN CONSTRAINT (mergeStepsWithOverride, web/.../utils/waterfall.ts):
 *   An override can only change `value` / `active` of a step that already exists
 *   in the global default, matched by `key`. Role / dates / flags come from the
 *   default. Therefore we use a FIXED canonical key set (below) so every hotel's
 *   override binds to the default. Per-hotel campaigns that aren't representable
 *   in this model are detected and reported as "residuals" (they also fail
 *   verification, by design).
 *
 * SAFETY:
 *   - Dry-run by default. Writes NOTHING. Prints a full report + a proposed
 *     write-plan JSON to claude/snapshots/ for review.
 *   - `--commit` actually writes, but ONLY if verification passes for 100% of
 *     hotels. All writes run in a single transaction.
 *   - rockenue_managed_assets / sentinel_configurations are never touched
 *     (legacy data stays as the rollback safety net).
 *
 * Run (dry-run):  node --experimental-strip-types scripts/migrate-sell-rate-to-channel-pricing.mts
 * Run (commit):   node --experimental-strip-types scripts/migrate-sell-rate-to-channel-pricing.mts --commit
 * Filters:        [--hotel <hotel_id>] [--limit <n>]
 *
 * Named .mts (not .js as the plan doc says) so it can import the REAL resolver
 * and validate against canonical code rather than a copy — same pattern as
 * scripts/run-sell-rate-golden-test.mts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { resolveSellRate, mergeStepsWithOverride } from "../web/src/features/rockenue/utils/waterfall.ts";
import type { WaterfallStep, HotelPricingOverride } from "../web/src/features/rockenue/api/types.ts";

const require = createRequire(import.meta.url);
require("dotenv").config();
const pool = require("../api/utils/db");

// ── CLI ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const HOTEL_FILTER = args.includes("--hotel") ? args[args.indexOf("--hotel") + 1] : null;
const LIMIT = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : null;

// ── Config ───────────────────────────────────────────────────
const TOLERANCE_GBP = 0.10;
const PMS_ANCHOR = 100;          // factor-only verification — independent of live PMS rate
const HORIZON_DAYS = 90;
const BOOKING_SLUG_CANDIDATES = ["booking-com", "booking.com", "bookingcom", "booking_com", "booking"];

// Canonical Booking.com global default. Confirmed values: migration doc §6 Q1.
//
// Keys MUST match the keys already present on the live Booking.com channel
// (multiplier / non_ref / genius / long_campaign / mobile / country_rate) so
// per-hotel overrides bind — there are already 2 hand-curated overrides keyed
// this way (Jubilee, Primrose). Labels follow Phase 2 UI conventions
// ("Loyalty / Member" instead of "Genius"; role string stays "genius").
//
// We write EXPLICIT roles + flags into the stored default. This is what makes
// the resolver work on this channel: the existing steps have role=null, and the
// UI's inferStepRole() actually mis-maps the "Country Rate" label to null
// (treats it as tax-like) — writing role:"country" fixes that latent bug.
//
// DEVIATION from doc §6 Q1 (country default = 0%): we keep country_rate at
// 5% / INACTIVE to match both the existing channel default and the legacy
// buildCalcState fallback (5). Country is inactive everywhere, so the value is
// cosmetic to the Sell Rate; using 5 avoids generating a pointless country
// override on nearly every hotel. Flagged in the report.
const GLOBAL_DEFAULT: WaterfallStep[] = [
  { key: "multiplier",    label: "Strategic Multiplier", type: "multiplier", value: 1.30, active: true,  role: "multiplier",        locked: true },
  { key: "non_ref",       label: "Non-refundable",       type: "discount",   value: 10,   active: true,  role: "non_refundable" },
  { key: "genius",        label: "Loyalty / Member",     type: "discount",   value: 15,   active: true,  role: "genius" },
  { key: "long_campaign", label: "Long Campaign",        type: "discount",   value: 30,   active: true,  role: "standard_campaign", isEvergreen: true, blocksMobile: true },
  { key: "mobile",        label: "Mobile",               type: "discount",   value: 10,   active: true,  role: "mobile" },
  { key: "country_rate",  label: "Country Rate",         type: "discount",   value: 5,    active: false, role: "country" },
];

const DEEP_DEAL_SLUGS = new Set(["black-friday", "limited-time"]);

// Standard (mobile-blocking) campaign slugs. Per Karol's decision (2026-05-22),
// the dated ones (late-escape / early-deal / getaway-deal) are CONSOLIDATED into
// a single evergreen long_campaign at the best discount — they're no longer
// modelled as separate dated steps. long-campaign is already evergreen.
const STANDARD_CAMPAIGN_SLUGS = new Set(["long-campaign", "late-escape", "early-deal", "getaway-deal"]);

// ── Legacy math (verbatim from scripts/capture-sell-rate-snapshot.js) ─────────
// This is the production truth we migrate against. Keep in sync with
// web/src/features/sentinel/hooks/useRateGrid.ts until Phase 4 ships.

function legacyIsCampaignValid(testDate: Date, camp: any): boolean {
  if (!camp.active) return false;
  if (camp.slug === "long-campaign") return true;
  if (!testDate || !camp.startDate || !camp.endDate) return false;
  const start = new Date(camp.startDate);
  const end = new Date(camp.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  return testDate >= start && testDate <= end;
}

function legacyFactor(geniusPct: number, state: any, dateStr: string): number {
  const testDate = new Date(dateStr);
  let factor = state.multiplier;

  if (state.nonRefundableActive) factor *= 1 - Number(state.nonRefundablePercent) / 100;
  if (state.taxType === "exclusive" && state.taxPercent > 0) factor *= 1 + Number(state.taxPercent) / 100;

  const deepDeal = state.campaigns.find(
    (c: any) => DEEP_DEAL_SLUGS.has(c.slug) && legacyIsCampaignValid(testDate, c)
  );

  if (deepDeal) {
    factor *= 1 - Number(deepDeal.discount) / 100;
  } else {
    if (geniusPct > 0) factor *= 1 - Number(geniusPct) / 100;

    const validStandard = state.campaigns.filter(
      (c: any) => !DEEP_DEAL_SLUGS.has(c.slug) && legacyIsCampaignValid(testDate, c)
    );
    if (validStandard.length > 0) {
      const best = validStandard.reduce((a: any, b: any) => (a.discount > b.discount ? a : b));
      factor *= 1 - Number(best.discount) / 100;
    }

    const isMobileBlocked = validStandard.some((c: any) =>
      ["long-campaign", "early-deal", "late-escape", "getaway-deal"].includes(c.slug)
    );
    if (state.mobileActive && !isMobileBlocked) factor *= 1 - Number(state.mobilePercent) / 100;
    if (state.countryRateActive) factor *= 1 - Number(state.countryRatePercent) / 100;
  }

  return factor;
}

function legacySellRate(geniusPct: number, state: any, dateStr: string): number {
  return PMS_ANCHOR * legacyFactor(PMS_ANCHOR > 0 ? geniusPct : 0, state, dateStr);
}

// Mirror useRateGrid.ts:222-243 — build CalculatorState from asset row.
// Production does NOT load tax → taxType undefined → tax branch never fires.
function buildLegacyState(asset: any) {
  const s = asset.calculator_settings || {};
  return {
    multiplier: asset.strategic_multiplier ? parseFloat(String(asset.strategic_multiplier)) : 1.3,
    campaigns: s.campaigns
      ? s.campaigns.map((c: any) => ({ ...c, active: c.active !== undefined ? c.active : true }))
      : [],
    mobileActive: s.mobile?.active !== undefined ? s.mobile.active : true,
    mobilePercent: s.mobile?.percent !== undefined ? s.mobile.percent : 10,
    nonRefundableActive: s.nonRef?.active !== undefined ? s.nonRef.active : true,
    nonRefundablePercent: s.nonRef?.percent !== undefined ? s.nonRef.percent : 10,
    countryRateActive: s.country?.active !== undefined ? s.country.active : false,
    countryRatePercent: s.country?.percent !== undefined ? s.country.percent : 5,
  };
}

// ── Per-hotel effective values + minimal override ────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function forwardDates(horizon: number): string[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface Residual {
  slug: string;
  name: string;
  discount: number;
  startDate?: string;
  endDate?: string;
  reason: string;
}

interface HotelEffective {
  multiplier: number;
  nonref: { value: number; active: boolean };
  genius: { value: number; active: boolean };
  longCampaign: { value: number; active: boolean };
  mobile: { value: number; active: boolean };
  country: { value: number; active: boolean };
  residuals: Residual[];
  foldedSlugs: string[];   // dated standard campaigns consolidated into long_campaign
}

function deriveEffective(asset: any, dates: string[]): HotelEffective {
  const s = asset.calculator_settings || {};
  const campaigns: any[] = Array.isArray(s.campaigns) ? s.campaigns : [];
  const geniusPct = Number(asset.genius_discount_pct) || 0;

  // Consolidate ALL active, in-window standard (mobile-blocking) campaigns
  // (long-campaign + late-escape + early-deal + getaway-deal) into a single
  // evergreen long_campaign at the best (max) discount — mirrors legacy's
  // best-of-standard pick. Fully past-dated campaigns are skipped (clean slate).
  // Deep-deals and any unknown campaign slug can't be modelled here → residuals.
  let bestStandard = -1;
  const foldedSlugs: string[] = [];
  const residuals: Residual[] = [];
  for (const c of campaigns) {
    const active = c.active !== undefined ? c.active : true;
    if (!active) continue;
    const slug = String(c.slug || "");
    const validSomewhere = dates.some((d) => legacyIsCampaignValid(new Date(d), { ...c, active: true }));
    if (!validSomewhere) continue; // expired / never valid in window → skip

    if (STANDARD_CAMPAIGN_SLUGS.has(slug)) {
      const disc = Number(c.discount) || 0;
      if (disc > bestStandard) bestStandard = disc;
      if (slug !== "long-campaign") foldedSlugs.push(slug);
    } else {
      residuals.push({
        slug,
        name: c.name || slug,
        discount: Number(c.discount) || 0,
        startDate: c.startDate ? String(c.startDate).slice(0, 10) : undefined,
        endDate: c.endDate ? String(c.endDate).slice(0, 10) : undefined,
        reason: DEEP_DEAL_SLUGS.has(slug)
          ? "active deep-deal valid in window (not modelled in this scope)"
          : "unknown campaign slug valid in window",
      });
    }
  }

  return {
    multiplier: asset.strategic_multiplier ? parseFloat(String(asset.strategic_multiplier)) : 1.3,
    nonref: {
      value: s.nonRef?.percent !== undefined ? s.nonRef.percent : 10,
      active: s.nonRef?.active !== undefined ? s.nonRef.active : true,
    },
    genius: { value: geniusPct, active: geniusPct > 0 },
    longCampaign: bestStandard >= 0 ? { value: bestStandard, active: true } : { value: 30, active: false },
    mobile: {
      value: s.mobile?.percent !== undefined ? s.mobile.percent : 10,
      active: s.mobile?.active !== undefined ? s.mobile.active : true,
    },
    country: {
      value: s.country?.percent !== undefined ? s.country.percent : 5,
      active: s.country?.active !== undefined ? s.country.active : false,
    },
    residuals,
    foldedSlugs,
  };
}

// Minimal diff vs GLOBAL_DEFAULT. Only emit fields that differ.
function buildOverride(eff: HotelEffective): HotelPricingOverride {
  const def = Object.fromEntries(GLOBAL_DEFAULT.map((s) => [s.key, s]));
  const ov: HotelPricingOverride = {};

  const diff = (key: string, value: number, active: boolean) => {
    const d = def[key];
    const entry: { value?: number; active?: boolean } = {};
    if (Math.abs(Number(d.value) - value) > 1e-9) entry.value = value;
    if (Boolean(d.active) !== Boolean(active)) entry.active = active;
    if (Object.keys(entry).length > 0) ov[key] = entry;
  };

  diff("multiplier", eff.multiplier, true);
  diff("non_ref", eff.nonref.value, eff.nonref.active);
  diff("genius", eff.genius.value, eff.genius.active);
  diff("long_campaign", eff.longCampaign.value, eff.longCampaign.active);
  diff("mobile", eff.mobile.value, eff.mobile.active);
  diff("country_rate", eff.country.value, eff.country.active);

  return ov;
}

// ── Verification ─────────────────────────────────────────────
//
// Two baselines:
//   GATE     — resolved vs "consolidated legacy" (legacy math with standard
//              campaigns folded into one evergreen long-campaign). This proves
//              the migration faithfully implements the INTENDED model. Must be
//              ±£0.10 for every hotel; a failure here is a real bug.
//   IMPACT   — resolved vs RAW current legacy. Non-zero only where evergreen
//              consolidation deliberately changes a rate (e.g. a dated campaign
//              that expires inside the window). Informational, not a gate.

// Legacy state with every active standard campaign replaced by a single
// evergreen long-campaign at eff.longCampaign — the intended post-migration shape.
function buildConsolidatedState(asset: any, eff: HotelEffective) {
  const base = buildLegacyState(asset);
  return {
    ...base,
    campaigns: eff.longCampaign.active
      ? [{ slug: "long-campaign", discount: eff.longCampaign.value, active: true }]
      : [],
  };
}

interface VerifyResult {
  pass: boolean;
  cells: number;
  failures: { date: string; legacy: number; resolved: number; diff: number }[];
  maxDiff: number;
  impactMaxDiff: number;
  impactDates: string[];   // dates where resolved diverges from RAW legacy
}

function verifyHotel(asset: any, override: HotelPricingOverride, eff: HotelEffective, dates: string[]): VerifyResult {
  const consolidated = buildConsolidatedState(asset, eff);
  const rawState = buildLegacyState(asset);
  const geniusPct = Number(asset.genius_discount_pct) || 0;
  const mergedSteps = mergeStepsWithOverride(GLOBAL_DEFAULT, override);

  const failures: VerifyResult["failures"] = [];
  const impactDates: string[] = [];
  let maxDiff = 0;
  let impactMaxDiff = 0;

  for (const date of dates) {
    const resolved = resolveSellRate(PMS_ANCHOR, mergedSteps, date);

    // GATE: vs consolidated intent
    const target = legacySellRate(geniusPct, consolidated, date);
    const diff = Math.abs(target - resolved);
    if (diff > maxDiff) maxDiff = diff;
    if (diff > TOLERANCE_GBP) {
      failures.push({
        date,
        legacy: Math.round(target * 10000) / 10000,
        resolved: Math.round(resolved * 10000) / 10000,
        diff: Math.round(diff * 10000) / 10000,
      });
    }

    // IMPACT: vs raw current production
    const raw = legacySellRate(geniusPct, rawState, date);
    const idiff = Math.abs(raw - resolved);
    if (idiff > impactMaxDiff) impactMaxDiff = idiff;
    if (idiff > TOLERANCE_GBP) impactDates.push(date);
  }

  return {
    pass: failures.length === 0,
    cells: dates.length,
    failures,
    maxDiff: Math.round(maxDiff * 10000) / 10000,
    impactMaxDiff: Math.round(impactMaxDiff * 10000) / 10000,
    impactDates,
  };
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Channel Pricing migration — Phase 3 ${COMMIT ? "[COMMIT]" : "[DRY-RUN]"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Resolve the Booking.com channel by slug (no hardcoded id).
  const { rows: channels } = await pool.query(
    `SELECT id, name, slug FROM distribution_channels WHERE LOWER(slug) = ANY($1::text[]) OR LOWER(name) LIKE '%booking%' ORDER BY id`,
    [BOOKING_SLUG_CANDIDATES]
  );
  if (channels.length === 0) {
    console.error("✗ No Booking.com channel found in distribution_channels. Cannot proceed.");
    process.exit(1);
  }
  if (channels.length > 1) {
    console.error("✗ Multiple Booking.com-like channels found — disambiguate before running:");
    channels.forEach((c: any) => console.error(`    id=${c.id} name="${c.name}" slug="${c.slug}"`));
    process.exit(1);
  }
  const channel = channels[0];
  console.log(`Channel: id=${channel.id} name="${channel.name}" slug="${channel.slug}"\n`);

  // Existing channel default we'd overwrite.
  const existing = (await pool.query(
    `SELECT steps FROM distribution_channel_pricing WHERE channel_id = $1`,
    [channel.id]
  )).rows[0];
  const existingSteps: WaterfallStep[] = existing?.steps || [];
  const canonicalKeys = new Set(GLOBAL_DEFAULT.map((s) => s.key));
  // Genuinely unknown extra steps (not one of our 6 canonical keys) are preserved
  // verbatim so we never silently drop channel config. None expected today.
  const extraSteps = existingSteps.filter((s) => !canonicalKeys.has(s.key));

  if (existingSteps.length > 0) {
    console.log(`Existing Booking.com channel default (${existingSteps.length} steps):`);
    existingSteps.forEach((s) => {
      const canon = GLOBAL_DEFAULT.find((d) => d.key === s.key);
      const valDiff = canon && Math.abs(Number(canon.value) - Number(s.value)) > 1e-9 ? ` → value→${canon.value}` : "";
      const actDiff = canon && Boolean(canon.active) !== Boolean(s.active) ? ` active→${canon.active}` : "";
      const roleAdd = canon && (s.role === null || s.role === undefined) ? ` +role:${canon.role}` : "";
      const extra = !canon ? "  [EXTRA — preserved verbatim]" : "";
      console.log(`    ${s.key.padEnd(16)} role=${String(s.role ?? "null").padEnd(16)} ${s.type} value=${s.value} active=${s.active}${valDiff}${actDiff}${roleAdd}${extra}`);
    });
    if (extraSteps.length > 0) console.log(`  → preserving ${extraSteps.length} extra step(s): ${extraSteps.map((s) => s.key).join(", ")}`);
    console.log("");
  }

  // Proposed channel default = canonical 6 (with roles/flags) + any extra steps.
  const proposedDefault: WaterfallStep[] = [...GLOBAL_DEFAULT, ...extraSteps];

  // Existing per-hotel overrides — surfaced as before/after so we don't silently
  // clobber hand-curated values (e.g. Primrose 1.42×).
  const { rows: existingOvRows } = await pool.query(
    `SELECT hotel_id, overrides FROM distribution_hotel_pricing_overrides WHERE channel_id = $1`,
    [channel.id]
  );
  const existingOverrides = new Map<string, any>(existingOvRows.map((r: any) => [String(r.hotel_id), r.overrides]));
  if (existingOverrides.size > 0) {
    console.log(`Existing per-hotel overrides on this channel: ${existingOverrides.size} (will be normalized to legacy truth — before/after shown below)\n`);
  }

  console.log("Proposed Booking.com GLOBAL DEFAULT:");
  GLOBAL_DEFAULT.forEach((s) =>
    console.log(`    ${s.key.padEnd(16)} role=${String(s.role).padEnd(18)} ${s.type} value=${s.value} active=${s.active}${s.blocksMobile ? " blocksMobile" : ""}${s.isEvergreen ? " evergreen" : ""}`)
  );
  console.log("");

  // 2. Load managed assets (same source/shape as the validated capture script).
  let assetsQuery = `
    SELECT
      rma.id AS asset_id,
      rma.market_pulse_hotel_id,
      rma.genius_discount_pct,
      sc.strategic_multiplier,
      sc.calculator_settings,
      h.hotel_id,
      h.property_name,
      h.is_rockenue_managed,
      h.is_disconnected
    FROM rockenue_managed_assets rma
    JOIN hotels h ON h.hotel_id::text = rma.market_pulse_hotel_id
    LEFT JOIN sentinel_configurations sc ON sc.hotel_id::text = rma.market_pulse_hotel_id
    WHERE (h.is_disconnected IS NULL OR h.is_disconnected = false)
  `;
  const params: any[] = [];
  if (HOTEL_FILTER) {
    params.push(HOTEL_FILTER);
    assetsQuery += ` AND h.hotel_id::text = $${params.length}`;
  }
  assetsQuery += ` ORDER BY h.property_name ASC`;
  if (LIMIT) assetsQuery += ` LIMIT ${LIMIT}`;

  let { rows: assets } = await pool.query(assetsQuery, params);
  console.log(`Hotels to migrate: ${assets.length}\n`);

  const dates = forwardDates(HORIZON_DAYS);

  // 3. Per-hotel: derive effective, build override, verify.
  const plan: any[] = [];
  let passCount = 0;
  let failCount = 0;
  let residualHotels = 0;
  let nonIntegerIds = 0;
  let noOverrideCount = 0;
  let clobberedOverrides = 0;
  let impactHotels = 0;
  let foldedHotels = 0;

  for (const asset of assets) {
    const eff = deriveEffective(asset, dates);
    const override = buildOverride(eff);
    const verify = verifyHotel(asset, override, eff, dates);

    const isIntId = /^\d+$/.test(String(asset.hotel_id));
    if (!isIntId) nonIntegerIds++;
    if (eff.residuals.length > 0) residualHotels++;
    if (eff.foldedSlugs.length > 0) foldedHotels++;
    if (verify.impactMaxDiff > TOLERANCE_GBP) impactHotels++;
    if (Object.keys(override).length === 0) noOverrideCount++;
    if (verify.pass) passCount++;
    else failCount++;

    plan.push({
      hotel_id: asset.hotel_id,
      property_name: asset.property_name,
      is_rockenue_managed: asset.is_rockenue_managed,
      hotel_id_is_integer: isIntId,
      override,
      override_summary: Object.keys(override).length === 0 ? "(none — matches default)" : override,
      consolidated_from: eff.foldedSlugs,
      residuals: eff.residuals,
      verify_pass: verify.pass,
      verify_max_diff_gbp: verify.maxDiff,
      verify_failures: verify.failures.slice(0, 5),
      consolidation_impact_gbp: verify.impactMaxDiff,
      consolidation_impact_dates: verify.impactDates,
    });

    const flag = verify.pass ? "✓" : "✗";
    const resFlag = eff.residuals.length > 0 ? ` ⚠ ${eff.residuals.length} residual(s)` : "";
    const ovKeys = Object.keys(override);
    const ovStr = ovKeys.length === 0 ? "default" : ovKeys.join(",");
    console.log(`  ${flag} ${String(asset.hotel_id).padEnd(38)} ${String(asset.property_name).slice(0, 32).padEnd(34)} maxΔ=£${verify.maxDiff.toFixed(4)}  override:[${ovStr}]${resFlag}`);

    if (!verify.pass) {
      verify.failures.slice(0, 3).forEach((f) =>
        console.log(`        ✗ ${f.date}  intended=£${f.legacy}  resolved=£${f.resolved}  Δ=£${f.diff}`)
      );
    }
    if (eff.foldedSlugs.length > 0) {
      console.log(`        ⤳ consolidated [${eff.foldedSlugs.join(", ")}] → evergreen long_campaign @ ${eff.longCampaign.value}%`);
    }
    if (verify.impactMaxDiff > TOLERANCE_GBP) {
      const d = verify.impactDates;
      console.log(`        ↗ rate change vs current production: up to £${verify.impactMaxDiff.toFixed(2)} per £100 on ${d.length} date(s) (${d[0]} → ${d[d.length - 1]})`);
    }
    eff.residuals.forEach((r) =>
      console.log(`        ⚠ residual "${r.slug}" ${r.discount}% (${r.reason})${r.startDate ? ` ${r.startDate}→${r.endDate}` : ""}`)
    );

    // Before/after for hotels that already had a hand-curated override.
    const prior = existingOverrides.get(String(asset.hotel_id));
    if (prior) {
      const before = JSON.stringify(prior);
      const after = JSON.stringify(override);
      if (before !== after) {
        clobberedOverrides++;
        console.log(`        ↻ override CHANGES — before: ${before}`);
        console.log(`                            after:  ${after}`);
      } else {
        console.log(`        ↻ override unchanged`);
      }
    }
  }

  // 4. Summary
  console.log("\n─────────────────────────────────────────────────────────");
  console.log(`  Gate (vs intended): ${passCount} pass, ${failCount} fail  (tolerance ±£${TOLERANCE_GBP})`);
  console.log(`  Overrides:    ${assets.length - noOverrideCount} hotels need an override, ${noOverrideCount} match default exactly`);
  if (foldedHotels > 0) console.log(`  ⤳ Consolidated: ${foldedHotels} hotel(s) had dated late-escape/early-deal/getaway-deal folded into evergreen long_campaign`);
  if (impactHotels > 0) console.log(`  ↗ Rate impact:  ${impactHotels} hotel(s) change vs current production (evergreen tail past original campaign end-date — intended, see above)`);
  if (clobberedOverrides > 0) console.log(`  ↻ Changing:   ${clobberedOverrides} existing hand-curated override(s) will be normalized (before/after above)`);
  if (residualHotels > 0) console.log(`  ⚠ Residuals:  ${residualHotels} hotel(s) have un-modellable campaigns (deep-deal / unknown) — BLOCKS commit`);
  if (nonIntegerIds > 0) console.log(`  ⚠ Hotel ids:  ${nonIntegerIds} non-integer hotel_id(s) — confirm distribution_hotel_pricing_overrides.hotel_id accepts them`);
  console.log("─────────────────────────────────────────────────────────\n");

  // 5. Write the proposed plan to disk for review.
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "claude", "snapshots");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `phase3-migration-plan-${todayISO()}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        channel: { id: channel.id, name: channel.name, slug: channel.slug },
        global_default: GLOBAL_DEFAULT,
        proposed_channel_steps: proposedDefault,
        preserved_extra_steps: extraSteps,
        tolerance_gbp: TOLERANCE_GBP,
        horizon_days: HORIZON_DAYS,
        summary: { hotels: assets.length, pass: passCount, fail: failCount, foldedHotels, impactHotels, residualHotels, nonIntegerIds, noOverrideCount, clobberedOverrides },
        hotels: plan,
      },
      null,
      2
    )
  );
  console.log(`Write-plan saved: ${path.relative(process.cwd(), outFile)}\n`);

  // 6. Commit gate.
  if (!COMMIT) {
    console.log("DRY-RUN — nothing written. Review the plan above, then re-run with --commit.");
    return;
  }

  if (failCount > 0) {
    console.error(`✗ ABORTING COMMIT — ${failCount} hotel(s) failed verification. Fix residuals / mapping first.`);
    process.exit(1);
  }
  if (residualHotels > 0) {
    console.error(`✗ ABORTING COMMIT — ${residualHotels} hotel(s) have un-migratable residual campaigns. Resolve before writing.`);
    process.exit(1);
  }

  console.log("All hotels verified. Writing in a single transaction…\n");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Global default (canonical 6 with roles/flags + any preserved extra steps).
    await client.query(
      `INSERT INTO distribution_channel_pricing (channel_id, steps, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (channel_id) DO UPDATE SET steps = $2, updated_at = NOW()`,
      [channel.id, JSON.stringify(proposedDefault)]
    );

    // Per-hotel overrides (only hotels that diverge from the default).
    let written = 0;
    for (const p of plan) {
      if (Object.keys(p.override).length === 0) continue;
      await client.query(
        `INSERT INTO distribution_hotel_pricing_overrides (hotel_id, channel_id, overrides, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (hotel_id, channel_id) DO UPDATE SET overrides = $3, updated_at = NOW()`,
        [p.hotel_id, channel.id, JSON.stringify(p.override)]
      );
      written++;
    }

    await client.query("COMMIT");
    console.log(`✓ COMMITTED — 1 channel default + ${written} hotel overrides written. ${noOverrideCount} hotels use the default.`);
    console.log("  rockenue_managed_assets / sentinel_configurations untouched (rollback safety net).");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Transaction rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("✗ Migration crashed:", err);
    pool.end();
    process.exit(1);
  });
