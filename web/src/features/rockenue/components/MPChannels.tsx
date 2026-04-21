/**
 * MP Channels — Studio clone of Channel Pricing with a smart "Add Channel" flow.
 * Copied from ChannelPricingConcept.tsx on 2026-04-17. Wired to real API.
 */

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Info, Loader2, Plus, GripVertical, Pencil, Trash2, X } from "lucide-react";
import {
  fetchPricingChannels, fetchChannelPricing, updateChannelPricingSteps,
  setHotelPricingOverride, deleteHotelPricingOverride, createChannel,
  updateChannel, deleteChannel,
} from "../api/distribution.api";
import type {
  AgreementType, ChannelTier, IntegrationType, ChannelType, PaymentMethod,
  WaterfallStep, StepRole,
} from "../api/types";
import { explainRateFactor, type BreakdownEntry } from "../utils/waterfall";

// ── Agreed token palette ──
const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  teal: "#38C6BA", warmTeal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
};

const curr = "£";

// ══════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════

interface ChannelMeta {
  agreement: string; channelType: string; pricingModel: string;
  commission: number | null; paymentMethod: string;
  contractExpiry: string | null; primaryContact: string | null;
  contactEmail: string | null; notes: string | null;
}

interface ChannelDefaults {
  channelId: number; channelName: string; slug: string;
  meta: ChannelMeta; steps: WaterfallStep[];
}

interface HotelOverride {
  hotelId: number; hotelName: string; channelSlug: string;
  overrides: Record<string, { value?: number; active?: boolean }>;
}

interface DraftOverride {
  mode: "new" | "edit";
  hotelId: number | null;          // null in "new" mode until a hotel is picked
  steps: WaterfallStep[];          // full editable step set, seeded from global or existing override
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

// Infer a StepRole for legacy steps that predate the Channel Pricing migration
// schema extension (Phase 1). New steps authored via the UI already include a
// role; this runs on load so the simulator and resolver behave correctly even
// before the data is re-saved. See claude/channel-pricing-migration.md §3.
function inferStepRole(step: WaterfallStep): StepRole | null {
  if (step.role !== undefined && step.role !== null) return step.role;
  const k = (step.key || "").toLowerCase();
  const l = (step.label || "").toLowerCase();
  if (step.type === "multiplier") return "multiplier";
  if (step.type === "tax" || /tax|vat|country rate/.test(l)) return null; // tax steps are hidden from editor; see §4.3
  if (/non[_-]?ref/.test(k) || /non[-\s]?refund/.test(l)) return "non_refundable";
  if (/genius/.test(k) || /genius/.test(l)) return "genius";
  if (/mobile/.test(k) || /mobile/.test(l)) return "mobile";
  if (/country/.test(k) || /country/.test(l)) return "country";
  if (/black[_-]?friday|limited[_-]?time|deep[_-]?deal|flash/.test(k) || /black friday|limited time|deep deal|flash/.test(l)) return "deep_deal";
  if (/campaign|long|early|late|escape|getaway|seasonal|promo/.test(k) || /campaign|long|early|late|escape|getaway|seasonal|promo/.test(l)) return "standard_campaign";
  return null;
}

function applyInferredRoles(steps: WaterfallStep[]): WaterfallStep[] {
  return steps.map(s => {
    if (s.role !== undefined && s.role !== null) return s;
    const inferred = inferStepRole(s);
    // Long-campaign-shaped legacy step: mark evergreen + blocksMobile to match legacy semantics.
    const isLegacyLongCampaign =
      inferred === "standard_campaign" &&
      (/long[_-]?campaign/.test((s.key || "").toLowerCase()) || /long campaign/.test((s.label || "").toLowerCase()));
    return {
      ...s,
      role: inferred,
      ...(isLegacyLongCampaign ? { isEvergreen: true, blocksMobile: true } : {}),
    };
  });
}

// Thin wrapper over `explainRateFactor` that preserves the legacy `{steps, final}`
// shape consumed by the existing pipeline render, while running the full
// role-aware resolver (deep-deal override, date gating, mobile blocking).
function calcWaterfall(
  steps: WaterfallStep[],
  pmsRate: number,
  dateStr: string,
): { steps: Array<{ label: string; rate: number; discount: string; active: boolean; skipReason: BreakdownEntry["skipReason"] }>; final: number; entries: BreakdownEntry[] } {
  const { factor, entries } = explainRateFactor(steps, dateStr);
  return {
    steps: entries.map(e => ({
      label: e.step.label,
      rate: pmsRate * e.factorAfter,
      discount: e.step.type === "multiplier" ? `${e.step.value}×` : `−${e.step.value}%`,
      active: e.applied,
      skipReason: e.skipReason,
    })),
    final: Math.round(pmsRate * factor * 100) / 100,
    entries,
  };
}

function getEffectiveSteps(channel: ChannelDefaults, hotelId: number, hotelOverrides: HotelOverride[]): WaterfallStep[] {
  const entry = hotelOverrides.find(o => o.hotelId === hotelId && o.channelSlug === channel.slug);
  if (!entry) return channel.steps;
  return channel.steps.map(step => {
    const ov = entry.overrides[step.key];
    if (!ov) return step;
    return { ...step, value: ov.value ?? step.value, active: ov.active ?? step.active };
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STEP_ROLE_OPTIONS: { value: StepRole | ""; label: string }[] = [
  { value: "", label: "—" },
  { value: "multiplier", label: "Multiplier" },
  { value: "non_refundable", label: "Non-refundable" },
  { value: "genius", label: "Genius" },
  { value: "standard_campaign", label: "Standard Campaign" },
  { value: "deep_deal", label: "Deep Deal" },
  { value: "mobile", label: "Mobile" },
  { value: "country", label: "Country" },
];

const SKIP_REASON_LABEL: Record<NonNullable<BreakdownEntry["skipReason"]>, string> = {
  inactive: "inactive",
  date_gated_out: "outside date range",
  deep_deal_override: "superseded by deep deal",
  mobile_blocked: "blocked by campaign",
};

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

// ══════════════════════════════════════════
// ADD-CHANNEL PRESETS
// ══════════════════════════════════════════
// Each channel_type seeds a default waterfall. User can edit before saving.
// Keys are prefixed with `seed_` to avoid collisions with any legacy step keys
// when the backend later merges/reorders.

type PresetKey = "ota" | "wholesaler" | "flash_sale" | "direct" | "meta";

// Commission is a bookkeeping step, not a Sell Rate factor — role is null so the
// resolver leaves it untouched. The multiplier seeds carry role="multiplier"
// so the resolver compounds them correctly.
const PRESETS: Record<PresetKey, { label: string; steps: WaterfallStep[] }> = {
  ota: {
    label: "OTA",
    steps: [
      { key: "seed_multiplier", label: "Multiplier", type: "multiplier", value: 1.0, active: true, role: "multiplier", locked: true },
      { key: "seed_commission", label: "Commission", type: "discount", value: 15, active: true, role: null },
      { key: "seed_non_refundable", label: "Non-refundable", type: "discount", value: 10, active: false, role: "non_refundable" },
    ],
  },
  wholesaler: {
    label: "Wholesaler",
    steps: [
      { key: "seed_multiplier", label: "Multiplier", type: "multiplier", value: 0.8, active: true, role: "multiplier", locked: true },
      { key: "seed_markup", label: "Markup", type: "multiplier", value: 1.0, active: false, role: "multiplier" },
    ],
  },
  flash_sale: {
    label: "Flash Sale",
    steps: [
      { key: "seed_multiplier", label: "Multiplier", type: "multiplier", value: 1.0, active: true, role: "multiplier", locked: true },
      { key: "seed_commission", label: "Commission", type: "discount", value: 12, active: true, role: null },
      { key: "seed_flash", label: "Flash Deal", type: "discount", value: 25, active: true, role: "deep_deal", isEvergreen: true },
    ],
  },
  direct: {
    label: "Direct Booking Engine",
    steps: [
      { key: "seed_multiplier", label: "Multiplier", type: "multiplier", value: 1.0, active: true, role: "multiplier", locked: true },
    ],
  },
  meta: {
    label: "Meta",
    steps: [
      { key: "seed_multiplier", label: "Multiplier", type: "multiplier", value: 1.0, active: true, role: "multiplier", locked: true },
      { key: "seed_ppa", label: "PPA Commission", type: "discount", value: 10, active: false, role: null },
    ],
  },
};

interface NewChannelDraft {
  name: string;
  channelType: PresetKey;
  commission: number | "";
  paymentMethod: PaymentMethod | "";
  agreement: AgreementType;
  tier: ChannelTier;
  integration: IntegrationType;
  contractExpiry: string;
  notes: string;
  steps: WaterfallStep[];
  userEditedSteps: boolean;
}

interface EditChannelDraft {
  channelId: number;
  name: string;
  channelType: PresetKey;
  commission: number | "";
  paymentMethod: PaymentMethod | "";
  agreement: AgreementType;
  tier: ChannelTier;
  integration: IntegrationType;
  contractExpiry: string;
  notes: string;
}

function blankDraft(): NewChannelDraft {
  return {
    name: "",
    channelType: "ota",
    commission: 15,
    paymentMethod: "guest_pays",
    agreement: "individual",
    tier: "experimental",
    integration: "channel_manager",
    contractExpiry: "",
    notes: "",
    steps: PRESETS.ota.steps.map(s => ({ ...s })),
    userEditedSteps: false,
  };
}

export function MPChannels() {
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [simPmsRate, setSimPmsRate] = useState(185);
  const [stayDate, setStayDate] = useState<string>(() => todayIso());
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  // Smart Add-Channel flow
  const [addOpen, setAddOpen] = useState(false);
  const [newCh, setNewCh] = useState<NewChannelDraft>(blankDraft());
  const [savingNew, setSavingNew] = useState(false);
  const [newChError, setNewChError] = useState<string | null>(null);

  // Edit-channel flow (meta only; waterfall is edited in the main view)
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<EditChannelDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete-channel confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ channelId: number; channelName: string; overrideCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // API state
  const [channels, setChannels] = useState<ChannelDefaults[]>([]);
  const [allHotels, setAllHotels] = useState<{ id: number; name: string }[]>([]);
  const [overrides, setOverrides] = useState<HotelOverride[]>([]);
  const [allOverrides, setAllOverrides] = useState<HotelOverride[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editedSteps, setEditedSteps] = useState<WaterfallStep[] | null>(null);
  const [savingSteps, setSavingSteps] = useState(false);
  const [editingStepKey, setEditingStepKey] = useState<string | null>(null);

  // Override drafting state — powers inline D1 (empty row) → D2 (expanded two-row) → D3 (collapsed minimal) flow
  const [draft, setDraft] = useState<DraftOverride | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingDraftStepKey, setEditingDraftStepKey] = useState<string | null>(null);

  // Viewport width (used to compute adaptive waterfall box sizing)
  const [vpWidth, setVpWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setVpWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Programs editor — inline label/value editing state. Live Programs rows
  // read/write editedSteps directly; this tracks which row is in edit mode.
  const [editingProgramKey, setEditingProgramKey] = useState<string | null>(null);
  const [programDetailKey, setProgramDetailKey] = useState<string | null>(null);

  // Fetch channels
  function loadChannels(selectSlug?: string) {
    return fetchPricingChannels().then(data => {
      const mapped: ChannelDefaults[] = data.map((ch: any) => ({
        channelId: ch.channel_id, channelName: ch.name, slug: ch.slug,
        meta: {
          agreement: ch.agreement_type ?? "—", channelType: ch.channel_type ?? "—",
          pricingModel: "Net", commission: ch.commission_pct ?? null,
          paymentMethod: ch.payment_method ?? "—", contractExpiry: ch.contract_expiry ?? null,
          primaryContact: ch.primary_contact ?? null, contactEmail: ch.contact_email ?? null,
          notes: ch.notes ?? null,
        },
        steps: applyInferredRoles(ch.steps ?? []),
      }));
      // Pin Booking.com as the first tab (biggest channel in our mix).
      // Backend returns alphabetical — we reorder client-side so "booking" lands at index 0.
      const bookingIdx = mapped.findIndex(c => c.slug === "booking");
      const sorted = bookingIdx > 0
        ? [mapped[bookingIdx], ...mapped.slice(0, bookingIdx), ...mapped.slice(bookingIdx + 1)]
        : mapped;
      setChannels(sorted);
      if (selectSlug) setSelectedChannel(selectSlug);
      else if (sorted.length > 0 && !selectedChannel) setSelectedChannel(sorted[0].slug);
      setLoadingChannels(false);
    }).catch(err => { console.error(err); setLoadingChannels(false); });
  }

  useEffect(() => { loadChannels(); }, []);
  useEffect(() => { setEditedSteps(null); }, [selectedChannel]);

  // Fetch channel detail
  useEffect(() => {
    const ch = channels.find(c => c.slug === selectedChannel);
    if (!ch) return;
    setLoadingDetail(true);
    fetchChannelPricing(ch.channelId).then(data => {
      const detailSteps = applyInferredRoles(data.channel?.steps ?? []);
      const mappedOverrides: HotelOverride[] = (data.overrides ?? []).map((o: any) => ({
        hotelId: o.hotel_id, hotelName: o.hotel_name, channelSlug: selectedChannel,
        overrides: o.overrides ?? {},
      }));
      setOverrides(mappedOverrides);
      setAllOverrides(prev => [...prev.filter(o => o.channelSlug !== selectedChannel), ...mappedOverrides]);
      setAllHotels((data.hotels ?? []).map((h: any) => ({ id: h.hotel_id ?? h.id, name: h.hotel_name ?? h.name })));
      setChannels(prev => prev.map(c => c.slug === selectedChannel ? { ...c, steps: detailSteps } : c));
      setLoadingDetail(false);
    }).catch(err => { console.error(err); setLoadingDetail(false); });
  }, [selectedChannel, channels.length]);

  const channel = channels.find(c => c.slug === selectedChannel);
  // Editor hides tax steps (tax stays on Control Panel per Blueprint §3.1). Tax
  // steps in existing data flow through save payloads untouched.
  const channelSteps = channel?.steps || [];
  const visibleChannelSteps = useMemo(() => channelSteps.filter(s => s.type !== "tax"), [channelSteps]);
  useEffect(() => {
    const hidden = channelSteps.filter(s => s.type === "tax");
    if (hidden.length > 0) {
      console.warn("[MPChannels] Hiding tax step(s) from editor (channel-level tax is out of scope — see claude/channel-pricing-migration.md §4.3):", hidden.map(s => s.key));
    }
  }, [channelSteps]);
  const activeSteps = editedSteps ?? visibleChannelSteps;
  const selectedResult = calcWaterfall(activeSteps, simPmsRate, stayDate);
  const channelOverrides = overrides;
  const hasUnsavedChanges = editedSteps !== null;

  // ── Adaptive waterfall sizing ────────────────────────────────────────
  // Natural box/arrow sizes. Shrink uniformly when the pipeline can't fit.
  // Enough viewport subtraction to clear sidebar + page padding on typical desktops.
  const NATURAL_BOX = 148;
  const NATURAL_ARROW = 56;
  const NATURAL_LINE = 36;
  const MIN_BOX = 100;
  const MIN_ARROW = 36;
  const MIN_LINE = 20;
  const stepCount = activeSteps.length;
  const nodeCount = stepCount + 2;        // PMS + steps + Guest Sees
  const arrowCount = stepCount + 1;
  const containerW = Math.max(640, vpWidth - 340); // rough content area minus sidebar + page padding
  const naturalW = nodeCount * NATURAL_BOX + arrowCount * NATURAL_ARROW;
  const sizeScale = naturalW > containerW ? Math.max(MIN_BOX / NATURAL_BOX, containerW / naturalW) : 1;
  const BOX_W = Math.max(MIN_BOX, Math.round(NATURAL_BOX * sizeScale));
  const ARROW_W = Math.max(MIN_ARROW, Math.round(NATURAL_ARROW * sizeScale));
  const ARROW_LINE = Math.max(MIN_LINE, Math.round(NATURAL_LINE * sizeScale));

  // Base accessor: always returns the current working copy (edited, if any,
  // otherwise the loaded channel steps). Mutations pass the full working array
  // through setEditedSteps so the "Unsaved changes" affordance fires.
  function workingSteps(): WaterfallStep[] {
    return editedSteps ?? (channel?.steps ?? []);
  }

  function patchStep(key: string, patch: Partial<WaterfallStep>) {
    const steps = workingSteps().map(s => s.key === key ? { ...s, ...patch } : s);
    setEditedSteps(steps);
  }

  function handleToggleStep(key: string) {
    const steps = [...workingSteps()];
    const idx = steps.findIndex(s => s.key === key);
    if (idx === -1 || steps[idx].locked) return;
    steps[idx] = { ...steps[idx], active: !steps[idx].active };
    setEditedSteps(steps);
  }

  function handleChangeStepValue(key: string, value: number) {
    const steps = [...workingSteps()];
    const idx = steps.findIndex(s => s.key === key);
    if (idx === -1) return;
    steps[idx] = { ...steps[idx], value };
    setEditedSteps(steps);
  }

  function handleChangeStepRole(key: string, role: StepRole | null) {
    patchStep(key, {
      role,
      // Leaving campaign roles: clear date/evergreen/blocksMobile so stale fields
      // don't confuse the resolver.
      ...(role !== "standard_campaign" && role !== "deep_deal"
        ? { startDate: null, endDate: null, isEvergreen: false }
        : {}),
      ...(role !== "standard_campaign" ? { blocksMobile: false } : {}),
    });
  }

  function handleChangeStepDate(key: string, field: "startDate" | "endDate", value: string) {
    patchStep(key, { [field]: value || null } as Partial<WaterfallStep>);
  }

  function handleToggleEvergreen(key: string) {
    const step = workingSteps().find(s => s.key === key);
    if (!step) return;
    const next = !step.isEvergreen;
    patchStep(key, {
      isEvergreen: next,
      ...(next ? { startDate: null, endDate: null } : {}),
    });
  }

  function handleRenameStep(key: string, label: string) {
    patchStep(key, { label });
  }

  function handleRemoveStep(key: string) {
    const step = workingSteps().find(s => s.key === key);
    if (!step || step.locked) return;
    setEditedSteps(workingSteps().filter(s => s.key !== key));
  }

  // Quick-add preset button: always appends a step with the fixed role.
  // Duplicates are allowed (operator can remove if unwanted).
  function handleQuickAdd(role: StepRole) {
    // Stacking rules (e.g. campaign-blocks-mobile) are OTA-level system config,
    // not a user-facing flag. New steps don't seed blocksMobile; the resolver
    // still reads existing flags on legacy data. See project_ota_stacking_rules.md.
    const presetMap: Record<string, { label: string; value: number; type: "multiplier" | "discount"; extras?: Partial<WaterfallStep> }> = {
      non_refundable:    { label: "Non-refundable", value: 10, type: "discount" },
      genius:            { label: "Genius",         value: 15, type: "discount" },
      mobile:            { label: "Mobile",         value: 10, type: "discount" },
      country:           { label: "Country Rate",   value: 10, type: "discount" },
      standard_campaign: { label: "Campaign",       value: 20, type: "discount", extras: { isEvergreen: true } },
      deep_deal:         { label: "Deep Deal",      value: 25, type: "discount" },
      multiplier:        { label: "Multiplier",     value: 1.0, type: "multiplier" },
    };
    const preset = presetMap[role];
    if (!preset) return;
    const keyBase = `${role}_${Date.now().toString(36).slice(-5)}`;
    const newStep: WaterfallStep = {
      key: keyBase,
      label: preset.label,
      type: preset.type,
      value: preset.value,
      active: true,
      role,
      ...(preset.extras ?? {}),
    };
    setEditedSteps([...workingSteps(), newStep]);
  }

  async function handleSaveSteps() {
    if (!channel || !editedSteps || savingSteps) return;
    setSavingSteps(true);
    try {
      // Preserve any tax-type steps hidden from the editor by appending them
      // back in their original positions in the channel's full step list.
      const hiddenTaxSteps = channel.steps.filter(s => s.type === "tax");
      const payload: WaterfallStep[] = hiddenTaxSteps.length === 0
        ? editedSteps
        : [...editedSteps, ...hiddenTaxSteps];
      await updateChannelPricingSteps(channel.channelId, payload);
      setChannels(prev => prev.map(c => c.channelId === channel.channelId ? { ...c, steps: payload } : c));
      setEditedSteps(null);
    } catch (err) { console.error("Save steps failed:", err); }
    finally { setSavingSteps(false); }
  }

  // ── Override drafting ──────────────────────────────────────────────
  function openAddOverride() {
    if (!channel) return;
    setDraft({ mode: "new", hotelId: null, steps: visibleChannelSteps.map(s => ({ ...s })) });
  }

  function openEditOverride(hotelId: number) {
    if (!channel) return;
    const effective = getEffectiveSteps(channel, hotelId, overrides);
    setDraft({ mode: "edit", hotelId, steps: effective.filter(s => s.type !== "tax").map(s => ({ ...s })) });
  }

  function handleCancelDraft() {
    if (savingDraft) return;
    setDraft(null);
    setEditingDraftStepKey(null);
  }

  function handleDraftHotelChange(hotelId: number) {
    setDraft(d => d ? { ...d, hotelId } : d);
  }

  function handleDraftStepToggle(key: string) {
    setDraft(d => d ? {
      ...d,
      steps: d.steps.map(s => s.key === key ? { ...s, active: !s.active } : s),
    } : d);
  }

  function handleDraftStepValue(key: string, value: number) {
    setDraft(d => d ? {
      ...d,
      steps: d.steps.map(s => s.key === key ? { ...s, value } : s),
    } : d);
  }

  async function refreshOverridesAfterMutation() {
    if (!channel) return;
    const data = await fetchChannelPricing(channel.channelId);
    const mapped: HotelOverride[] = (data.overrides ?? []).map((o: any) => ({
      hotelId: o.hotel_id, hotelName: o.hotel_name, channelSlug: selectedChannel,
      overrides: o.overrides ?? {},
    }));
    setOverrides(mapped);
    setAllOverrides(prev => [...prev.filter(o => o.channelSlug !== selectedChannel), ...mapped]);
  }

  async function handleSaveDraft() {
    if (!channel || !draft || draft.hotelId == null || savingDraft) return;
    setSavingDraft(true);
    try {
      const payload: Record<string, { value: number; active: boolean }> = {};
      for (const step of draft.steps) {
        payload[step.key] = { value: step.value, active: step.active };
      }
      await setHotelPricingOverride(channel.channelId, draft.hotelId, payload);
      await refreshOverridesAfterMutation();
      setDraft(null);
      setEditingDraftStepKey(null);
    } catch (err) { console.error("Save override failed:", err); }
    finally { setSavingDraft(false); }
  }

  async function handleDeleteDraft() {
    if (!channel || !draft || draft.hotelId == null || draft.mode !== "edit" || savingDraft) return;
    setSavingDraft(true);
    try {
      await deleteHotelPricingOverride(channel.channelId, draft.hotelId);
      await refreshOverridesAfterMutation();
      setDraft(null);
      setEditingDraftStepKey(null);
    } catch (err) { console.error("Delete override failed:", err); }
    finally { setSavingDraft(false); }
  }

  // Hotels that don't yet have an override on this channel — used for the D1 picker
  const availableHotelsForNew = allHotels.filter(h => !channelOverrides.some(o => o.hotelId === h.id));

  // ── Smart Add-Channel handlers ─────────────────────────────────────
  function openAddChannel() {
    setNewCh(blankDraft());
    setNewChError(null);
    setAddOpen(true);
    setDraft(null);
  }

  function closeAddChannel() {
    if (savingNew) return;
    setAddOpen(false);
    setNewChError(null);
  }

  function updateNewCh<K extends keyof NewChannelDraft>(key: K, value: NewChannelDraft[K]) {
    setNewCh(prev => ({ ...prev, [key]: value }));
  }

  function pickPreset(p: PresetKey) {
    setNewCh(prev => ({
      ...prev,
      channelType: p,
      // Only replace steps if the user hasn't manually edited them yet.
      steps: prev.userEditedSteps ? prev.steps : PRESETS[p].steps.map(s => ({ ...s })),
    }));
  }

  function toggleNewStep(key: string) {
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: prev.steps.map(s => s.key === key ? { ...s, active: !s.active } : s),
    }));
  }

  function changeNewStepValue(key: string, value: number) {
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: prev.steps.map(s => s.key === key ? { ...s, value } : s),
    }));
  }

  function removeNewStep(key: string) {
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: prev.steps.filter(s => s.key !== key),
    }));
  }

  function addBlankNewStep() {
    const k = `seed_custom_${Date.now().toString(36).slice(-5)}`;
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: [...prev.steps, { key: k, label: "New Step", type: "discount", value: 10, active: true }],
    }));
  }

  function renameNewStep(key: string, label: string) {
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: prev.steps.map(s => s.key === key ? { ...s, label } : s),
    }));
  }

  function changeNewStepType(key: string, type: "multiplier" | "discount") {
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: prev.steps.map(s => s.key === key ? { ...s, type, value: type === "multiplier" ? 1 : 10 } : s),
    }));
  }

  function changeNewStepRole(key: string, role: StepRole | null) {
    setNewCh(prev => ({
      ...prev,
      userEditedSteps: true,
      steps: prev.steps.map(s => {
        if (s.key !== key) return s;
        return {
          ...s,
          role,
          ...(role !== "standard_campaign" && role !== "deep_deal"
            ? { startDate: null, endDate: null, isEvergreen: false }
            : {}),
          ...(role !== "standard_campaign" ? { blocksMobile: false } : {}),
        };
      }),
    }));
  }

  async function handleSaveNewChannel() {
    if (savingNew) return;
    const name = newCh.name.trim();
    if (!name) { setNewChError("Channel name is required."); return; }
    setSavingNew(true);
    setNewChError(null);
    try {
      // 1. Create channel row
      const created: any = await createChannel({
        name,
        agreement_type: newCh.agreement,
        tier: newCh.tier,
        integration_type: newCh.integration,
        channel_type: newCh.channelType as ChannelType,
        payment_method: newCh.paymentMethod === "" ? null : (newCh.paymentMethod as PaymentMethod),
        commission_pct: newCh.commission === "" ? null : (newCh.commission as number),
        contract_expiry: newCh.contractExpiry || null,
        notes: newCh.notes || null,
      });
      const newChannelId: number = created.id;
      const newSlug: string = created.slug;

      // 2. Seed waterfall steps (backend filters channels without steps out of /pricing).
      await updateChannelPricingSteps(newChannelId, newCh.steps);

      // 3. Reload tab list and select the new channel.
      await loadChannels(newSlug);
      setAddOpen(false);
    } catch (err: any) {
      console.error("Create channel failed:", err);
      setNewChError(err?.message || "Failed to create channel.");
    } finally {
      setSavingNew(false);
    }
  }

  const newChFinal = calcWaterfall(newCh.steps, simPmsRate, stayDate).final;

  // ── Edit-channel handlers ─────────────────────────────────────────
  async function openEditChannel() {
    if (!channel) return;
    setEditError(null);
    try {
      const data = await fetchChannelPricing(channel.channelId);
      const c = data.channel ?? {};
      setEditDraft({
        channelId: channel.channelId,
        name: c.name ?? channel.channelName,
        channelType: (c.channel_type ?? "ota") as PresetKey,
        commission: c.commission_pct ?? "",
        paymentMethod: (c.payment_method ?? "") as PaymentMethod | "",
        agreement: (c.agreement_type ?? "individual") as AgreementType,
        tier: (c.tier ?? "experimental") as ChannelTier,
        integration: (c.integration_type ?? "channel_manager") as IntegrationType,
        contractExpiry: c.contract_expiry ? String(c.contract_expiry).slice(0, 10) : "",
        notes: c.notes ?? "",
      });
      setEditOpen(true);
      setAddOpen(false);
      setDraft(null);
    } catch (err: any) {
      console.error("Load channel for edit failed:", err);
      setEditError(err?.message || "Failed to load channel.");
    }
  }

  function closeEditChannel() {
    if (savingEdit) return;
    setEditOpen(false);
    setEditDraft(null);
    setEditError(null);
  }

  function updateEditDraft<K extends keyof EditChannelDraft>(key: K, value: EditChannelDraft[K]) {
    setEditDraft(prev => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSaveEditChannel() {
    if (!editDraft || savingEdit) return;
    const name = editDraft.name.trim();
    if (!name) { setEditError("Channel name is required."); return; }
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated: any = await updateChannel(editDraft.channelId, {
        name,
        agreement_type: editDraft.agreement,
        tier: editDraft.tier,
        integration_type: editDraft.integration,
        channel_type: editDraft.channelType as ChannelType,
        payment_method: editDraft.paymentMethod === "" ? null : (editDraft.paymentMethod as PaymentMethod),
        commission_pct: editDraft.commission === "" ? null : (editDraft.commission as number),
        contract_expiry: editDraft.contractExpiry || null,
        notes: editDraft.notes || null,
      } as any);
      await loadChannels(updated?.slug ?? selectedChannel);
      setEditOpen(false);
      setEditDraft(null);
    } catch (err: any) {
      console.error("Update channel failed:", err);
      setEditError(err?.message || "Failed to save channel.");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Delete-channel handlers ───────────────────────────────────────
  function openDeleteConfirm() {
    if (!channel) return;
    const overrideCount = allOverrides.filter(o => o.channelSlug === channel.slug).length;
    setDeleteError(null);
    setDeleteConfirm({ channelId: channel.channelId, channelName: channel.channelName, overrideCount });
  }

  function closeDeleteConfirm() {
    if (deleting) return;
    setDeleteConfirm(null);
    setDeleteError(null);
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteChannel(deleteConfirm.channelId);
      // Pick the next surviving tab (fall back to empty string → first tab auto-selects on reload)
      const remaining = channels.filter(c => c.channelId !== deleteConfirm.channelId);
      const nextSlug = remaining[0]?.slug ?? "";
      setAllOverrides(prev => prev.filter(o => o.channelSlug !== channel?.slug));
      setSelectedChannel(nextSlug);
      setEditedSteps(null);
      setDraft(null);
      await loadChannels(nextSlug || undefined);
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error("Delete channel failed:", err);
      setDeleteError(err?.message || "Failed to delete channel.");
    } finally {
      setDeleting(false);
    }
  }

  // Loading guard
  if (loadingChannels) {
    return (
      <div style={{ minHeight: "100vh", background: R.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} style={{ color: R.warmTeal, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      <div style={{ padding: "32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Distribution</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>Channel Pricing</h1>
          <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>Portfolio defaults & per-hotel overrides</p>
        </div>

        {/* Channel Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, borderBottom: `1px solid ${R.border}`, paddingBottom: 0 }}>
          {channels.map(ch => {
            const isActive = selectedChannel === ch.slug;
            const ovCount = allOverrides.filter(o => o.channelSlug === ch.slug).length;
            return (
              <button key={ch.slug} onClick={() => {
                setSelectedChannel(ch.slug);
                setDraft(null);
                setEditingDraftStepKey(null);
                setShowChannelInfo(false);
                setEditingProgramKey(null);
                setProgramDetailKey(null);
                setAddOpen(false);
              }}
                style={{
                  padding: "14px 24px", border: "none",
                  borderBottom: isActive ? `2px solid ${R.warmTeal}` : "2px solid transparent",
                  background: "transparent", color: isActive ? R.accent : R.textDim,
                  fontSize: 14, fontWeight: isActive ? 500 : 400, cursor: "pointer",
                  transition: "all 0.15s", marginBottom: -1,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                <span>{ch.channelName}</span>
                {ovCount > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: `${R.gold}15`, color: R.gold, fontWeight: 500 }}>{ovCount}</span>
                )}
              </button>
            );
          })}
          <button
            onClick={openAddChannel}
            style={{
              padding: "14px 18px", border: "none",
              borderBottom: addOpen ? `2px solid ${R.warmTeal}` : "2px solid transparent",
              background: "transparent",
              color: addOpen ? R.warmTeal : R.textDim,
              fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, marginBottom: -1,
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {addOpen && (
          <AddChannelPanel
            draft={newCh}
            onUpdate={updateNewCh}
            onPickPreset={pickPreset}
            onToggleStep={toggleNewStep}
            onChangeStepValue={changeNewStepValue}
            onChangeStepType={changeNewStepType}
            onChangeStepRole={changeNewStepRole}
            onRenameStep={renameNewStep}
            onRemoveStep={removeNewStep}
            onAddStep={addBlankNewStep}
            onSave={handleSaveNewChannel}
            onCancel={closeAddChannel}
            saving={savingNew}
            error={newChError}
            simPmsRate={simPmsRate}
            finalRate={newChFinal}
          />
        )}

        {editOpen && editDraft && (
          <EditChannelPanel
            draft={editDraft}
            onUpdate={updateEditDraft}
            onSave={handleSaveEditChannel}
            onCancel={closeEditChannel}
            saving={savingEdit}
            error={editError}
          />
        )}

        {!addOpen && !editOpen && (!channel || loadingDetail) ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={20} style={{ color: R.warmTeal, animation: "spin 1s linear infinite" }} />
          </div>
        ) : addOpen || editOpen ? null : (<>

        {/* Channel Info Bar */}
        <div style={{ marginBottom: 24 }}>
          <div onClick={() => setShowChannelInfo(!showChannelInfo)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
              background: R.card, border: `1px solid ${R.border}`, cursor: "pointer",
              borderRadius: showChannelInfo ? "8px 8px 0 0" : 8,
            }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>{channel.channelName}</span>
            <span style={{ fontSize: 10, color: R.textDim }}>{channel.meta.channelType}</span>
            {channel.meta.commission != null && (<>
              <span style={{ fontSize: 10, color: R.textDim }}>·</span>
              <span style={{ fontSize: 10, color: R.textMid }}>{channel.meta.commission}%</span>
            </>)}
            <span style={{ fontSize: 10, color: R.textDim }}>·</span>
            <span style={{ fontSize: 10, color: R.textDim }}>{channel.meta.paymentMethod}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); openEditChannel(); }}
                title="Edit channel"
                style={{
                  width: 24, height: 24, borderRadius: 4, border: "none", background: "transparent",
                  color: R.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = R.cardRaised; e.currentTarget.style.color = R.warmTeal; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = R.textDim; }}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteConfirm(); }}
                title="Delete channel"
                style={{
                  width: 24, height: 24, borderRadius: 4, border: "none", background: "transparent",
                  color: R.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${R.red}12`; e.currentTarget.style.color = R.red; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = R.textDim; }}
              >
                <Trash2 size={12} />
              </button>
              <Info size={10} color={R.textDim} />
              <ChevronDown size={12} color={R.textDim} style={{ transform: showChannelInfo ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </div>
          </div>
          {showChannelInfo && (
            <div style={{ padding: "16px 20px", background: R.darkBand, border: `1px solid ${R.border}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { label: "Agreement", value: channel.meta.agreement, sub: `Pricing: ${channel.meta.pricingModel}` },
                  { label: "Commission", value: channel.meta.commission != null ? `${channel.meta.commission}%` : "—", sub: `Payment: ${channel.meta.paymentMethod}` },
                  { label: "Contract", value: channel.meta.contractExpiry ? `Expires ${new Date(channel.meta.contractExpiry).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "No expiry", sub: null },
                  { label: "Contact", value: channel.meta.primaryContact ?? "—", sub: channel.meta.contactEmail },
                ].map(col => (
                  <div key={col.label}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>{col.label}</div>
                    <div style={{ fontSize: 12, color: R.text }}>{col.value}</div>
                    {col.sub && <div style={{ fontSize: 10, color: R.textDim, marginTop: 3 }}>{col.sub}</div>}
                  </div>
                ))}
              </div>
              {channel.meta.notes && (
                <div style={{ marginTop: 12, padding: "8px 10px", background: `${R.gold}06`, borderRadius: 4, borderLeft: `2px solid ${R.gold}20` }}>
                  <span style={{ fontSize: 11, color: R.textMid, lineHeight: 1.5 }}>{channel.meta.notes}</span>
                </div>
              )}

              {/* ─── PROGRAMS ─────────────────────────────────────────────
                  Single source of truth for step role / dates / evergreen.
                  Writes straight into editedSteps; the pipeline visualisation
                  above renders the same data. */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${R.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Programs</span>
                    <span style={{ fontSize: 10, color: R.textDim }}>— order = stacking order</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, color: R.textDim, marginRight: 2, textTransform: "uppercase", letterSpacing: 1 }}>Quick add</span>
                    {(["non_refundable", "genius", "mobile", "country", "standard_campaign", "deep_deal"] as StepRole[]).map(r => (
                      <button
                        key={r}
                        onClick={() => handleQuickAdd(r)}
                        style={{
                          padding: "4px 9px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                          border: `1px solid ${R.border}`, background: R.darkBand, color: R.textMid, cursor: "pointer",
                        }}
                      >+ {STEP_ROLE_OPTIONS.find(o => o.value === r)?.label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, overflow: "hidden" }}>
                  {activeSteps.length === 0 ? (
                    <div style={{ padding: "16px 14px", color: R.textDim, fontSize: 12, fontStyle: "italic" }}>
                      No programs — use a Quick Add button above.
                    </div>
                  ) : (
                    activeSteps.map((step, i) => {
                      const role: StepRole | "" = (step.role ?? "") as any;
                      const isCampaign = role === "standard_campaign" || role === "deep_deal";
                      const suffix = step.type === "multiplier" ? "×" : "%";
                      const display = step.active
                        ? (step.type === "multiplier" ? `${step.value}${suffix}` : `−${step.value}${suffix}`)
                        : "off";
                      const isEditingLabel = editingProgramKey === `${step.key}:label`;
                      const isEditingValue = editingProgramKey === `${step.key}:value`;
                      const isDetailOpen = programDetailKey === step.key;

                      return (
                        <div key={step.key}>
                          {/* Summary row */}
                          <div style={{
                            display: "grid", gridTemplateColumns: "28px 1fr 140px 90px 64px 32px 32px",
                            alignItems: "center", gap: 10,
                            padding: "10px 14px",
                            borderBottom: (i < activeSteps.length - 1 || isDetailOpen) ? `1px solid ${R.sep}` : "none",
                          }}>
                            <div style={{ cursor: "grab", color: R.textDim, display: "flex", alignItems: "center" }} title="Drag to reorder (not wired yet)">
                              <GripVertical size={14} />
                            </div>
                            {/* Label — click to edit */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {isEditingLabel ? (
                                <input
                                  autoFocus
                                  type="text"
                                  defaultValue={step.label}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleRenameStep(step.key, (e.target as HTMLInputElement).value);
                                      setEditingProgramKey(null);
                                    }
                                    if (e.key === "Escape") setEditingProgramKey(null);
                                  }}
                                  onBlur={(e) => {
                                    handleRenameStep(step.key, e.target.value);
                                    setEditingProgramKey(null);
                                  }}
                                  style={{
                                    flex: 1, padding: "4px 8px",
                                    background: R.darkBand, border: `1px solid ${R.warmTeal}40`, borderRadius: 4,
                                    color: R.text, fontSize: 12, outline: "none", fontFamily: "inherit",
                                  }}
                                />
                              ) : (
                                <span
                                  onClick={() => !step.locked && setEditingProgramKey(`${step.key}:label`)}
                                  style={{ fontSize: 12, color: R.text, fontWeight: 400, cursor: step.locked ? "default" : "text" }}
                                >{step.label}</span>
                              )}
                              {step.locked && <span style={{ fontSize: 9, color: R.textDim, fontStyle: "italic" }}>locked</span>}
                            </div>
                            {/* Role */}
                            <select
                              value={role}
                              onChange={(e) => handleChangeStepRole(step.key, (e.target.value || null) as StepRole | null)}
                              style={{
                                padding: "4px 6px", borderRadius: 4,
                                background: R.darkBand, border: `1px solid ${R.border}`,
                                color: R.textMid, fontSize: 11, fontFamily: "inherit",
                                outline: "none", cursor: "pointer",
                              }}
                            >
                              {STEP_ROLE_OPTIONS.map(o => (
                                <option key={o.value || "null"} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {/* Type (read-only chip — changes via Details) */}
                            <span style={{ fontSize: 10, color: R.textDim, textTransform: "capitalize", textAlign: "center" }}>{step.type}</span>
                            {/* Value — click to edit */}
                            {isEditingValue ? (
                              <input
                                autoFocus
                                type="text"
                                inputMode="decimal"
                                defaultValue={step.value}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const v = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(v)) handleChangeStepValue(step.key, v);
                                    setEditingProgramKey(null);
                                  }
                                  if (e.key === "Escape") setEditingProgramKey(null);
                                }}
                                onBlur={(e) => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v)) handleChangeStepValue(step.key, v);
                                  setEditingProgramKey(null);
                                }}
                                style={{
                                  width: 58, padding: "3px 6px", fontSize: 12, textAlign: "right",
                                  background: R.darkBand, border: `1px solid ${R.warmTeal}40`, borderRadius: 4,
                                  color: R.text, fontVariantNumeric: "tabular-nums", outline: "none",
                                  justifySelf: "end",
                                }}
                              />
                            ) : (
                              <span
                                onClick={() => setEditingProgramKey(`${step.key}:value`)}
                                style={{
                                  fontSize: 12,
                                  color: step.active ? (step.type === "multiplier" ? R.warmTeal : R.accent) : R.textDim,
                                  fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 500,
                                  cursor: "text",
                                }}
                              >{display}</span>
                            )}
                            {/* Active toggle */}
                            <button
                              onClick={() => handleToggleStep(step.key)}
                              disabled={step.locked}
                              title={step.active ? "Active — click to disable" : "Inactive — click to enable"}
                              style={{
                                width: 30, height: 18, borderRadius: 9, border: "none", padding: 0, position: "relative",
                                background: step.active ? R.warmTeal : R.border,
                                cursor: step.locked ? "not-allowed" : "pointer",
                                opacity: step.locked ? 0.5 : 1,
                                justifySelf: "center",
                              }}
                            >
                              <div style={{
                                position: "absolute", top: 3, left: step.active ? 15 : 3,
                                width: 12, height: 12, borderRadius: "50%",
                                background: step.active ? R.darkBand : R.textDim, transition: "all 0.15s",
                              }} />
                            </button>
                            {/* Details / remove cluster */}
                            <div style={{ display: "flex", gap: 2, justifySelf: "end" }}>
                              <button
                                title={isDetailOpen ? "Hide details" : "Details (dates, always-on)"}
                                onClick={() => setProgramDetailKey(isDetailOpen ? null : step.key)}
                                style={{
                                  width: 22, height: 22, borderRadius: 4, border: "none",
                                  background: isDetailOpen ? R.cardRaised : "transparent", color: isDetailOpen ? R.warmTeal : R.textDim,
                                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                <ChevronDown size={13} style={{ transform: isDetailOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                              </button>
                              <button
                                title={step.locked ? "Locked — cannot remove" : "Remove program"}
                                onClick={() => handleRemoveStep(step.key)}
                                disabled={step.locked}
                                style={{
                                  width: 22, height: 22, borderRadius: 4, border: "none",
                                  background: "transparent", color: step.locked ? R.textDim : R.textMid,
                                  cursor: step.locked ? "not-allowed" : "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                                onMouseEnter={(e) => { if (!step.locked) { e.currentTarget.style.background = `${R.red}10`; e.currentTarget.style.color = R.red; } }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = step.locked ? R.textDim : R.textMid; }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Expandable detail row — date range / evergreen for campaign roles */}
                          {isDetailOpen && (
                            <div style={{
                              padding: "12px 14px 14px 52px",
                              background: R.darkBand,
                              borderBottom: i < activeSteps.length - 1 ? `1px solid ${R.sep}` : "none",
                              display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18,
                            }}>
                              {/* Type switch */}
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                                Type
                                <div style={{ display: "flex", gap: 3 }}>
                                  {(["multiplier", "discount"] as const).map(t => (
                                    <button
                                      key={t}
                                      onClick={() => patchStep(step.key, { type: t, value: t === "multiplier" ? 1 : Math.max(step.value, 1) })}
                                      style={{
                                        padding: "3px 9px", fontSize: 10, fontWeight: 500, borderRadius: 4,
                                        background: step.type === t ? `${R.warmTeal}15` : "transparent",
                                        border: `1px solid ${step.type === t ? `${R.warmTeal}40` : R.border}`,
                                        color: step.type === t ? R.warmTeal : R.textMid,
                                        cursor: "pointer", textTransform: "capitalize",
                                      }}
                                    >{t}</button>
                                  ))}
                                </div>
                              </label>

                              {/* Campaign dates — only visible for campaign roles */}
                              {isCampaign ? (
                                <>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 1, cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={!!step.isEvergreen}
                                      onChange={() => handleToggleEvergreen(step.key)}
                                      style={{ accentColor: R.warmTeal }}
                                    />
                                    Always-on
                                  </label>
                                  {!step.isEvergreen && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Dates</span>
                                      <input
                                        type="date"
                                        value={step.startDate ?? ""}
                                        onChange={(e) => handleChangeStepDate(step.key, "startDate", e.target.value)}
                                        style={{
                                          padding: "4px 7px", fontSize: 11, color: R.text,
                                          background: R.card, border: `1px solid ${R.border}`, borderRadius: 4,
                                          outline: "none", fontFamily: "inherit",
                                        }}
                                      />
                                      <span style={{ fontSize: 10, color: R.textDim }}>→</span>
                                      <input
                                        type="date"
                                        value={step.endDate ?? ""}
                                        onChange={(e) => handleChangeStepDate(step.key, "endDate", e.target.value)}
                                        style={{
                                          padding: "4px 7px", fontSize: 11, color: R.text,
                                          background: R.card, border: `1px solid ${R.border}`, borderRadius: 4,
                                          outline: "none", fontFamily: "inherit",
                                        }}
                                      />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span style={{ fontSize: 10, color: R.textDim, fontStyle: "italic" }}>
                                  Date range applies to Standard Campaign and Deep Deal roles only.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Waterfall Pipeline */}
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: R.text }}>Waterfall — Portfolio Default</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: R.textDim }}>
                {channelOverrides.length > 0
                  ? `${allHotels.length - channelOverrides.length} using defaults · ${channelOverrides.length} override${channelOverrides.length !== 1 ? "s" : ""}`
                  : `All ${allHotels.length} hotels`}
              </span>
              {hasUnsavedChanges && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: R.gold }}>Unsaved changes</span>
                  <button onClick={handleSaveSteps} style={{
                    padding: "4px 12px", borderRadius: 5, border: "none",
                    background: R.warmTeal, color: R.darkBand, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                    {savingSteps ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditedSteps(null)} style={{
                    padding: "4px 10px", borderRadius: 5, border: `1px solid ${R.border}`,
                    background: "transparent", color: R.textDim, fontSize: 11, cursor: "pointer",
                  }}>
                    Discard
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "32px 24px", overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, minWidth: "min-content" }}>
              {/* PMS node */}
              <div style={{ width: BOX_W, flexShrink: 0 }}>
                <div style={{
                  padding: "20px 14px", borderRadius: 8, background: R.cardRaised, border: `1px solid ${R.border}`,
                  textAlign: "center", height: 96, display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 8 }}>PMS Rate</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: R.accent, fontVariantNumeric: "tabular-nums" }}>{curr}{simPmsRate}</div>
                </div>
              </div>

              {/* Steps */}
              {activeSteps.map((step, i) => {
                const result = selectedResult.steps[i];
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: ARROW_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: ARROW_LINE, height: 1, background: step.active ? R.border : `${R.border}50`, position: "relative" }}>
                        <div style={{ position: "absolute", right: -6, top: -4, width: 0, height: 0,
                          borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                          borderLeft: `6px solid ${step.active ? R.border : `${R.border}50`}`,
                        }} />
                      </div>
                    </div>
                    <div style={{ width: BOX_W, flexShrink: 0, opacity: step.active ? 1 : 0.3, position: "relative" }}>
                      <div style={{
                        padding: "20px 14px", borderRadius: 8, textAlign: "center", height: 96,
                        display: "flex", flexDirection: "column", justifyContent: "center",
                        background: R.card, border: `1px solid ${editingStepKey === step.key ? R.warmTeal : R.border}`,
                        cursor: step.locked ? "default" : "pointer",
                      }}
                        onClick={() => { if (!step.locked && editingStepKey !== step.key) handleToggleStep(step.key); }}>
                        <div style={{ fontSize: 11, fontWeight: 400, color: R.textMid, marginBottom: 10 }}>{step.label}</div>
                        {editingStepKey === step.key ? (
                          <input
                            autoFocus
                            type="text"
                            inputMode="decimal"
                            defaultValue={step.value}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = parseFloat((e.target as HTMLInputElement).value);
                                if (!isNaN(v)) handleChangeStepValue(step.key, v);
                                setEditingStepKey(null);
                              }
                              if (e.key === "Escape") setEditingStepKey(null);
                            }}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v)) handleChangeStepValue(step.key, v);
                              setEditingStepKey(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: 70, fontSize: 18, fontWeight: 500, textAlign: "center",
                              background: "transparent", border: "none", borderBottom: `1px solid ${R.warmTeal}40`,
                              color: step.type === "multiplier" ? R.warmTeal : R.gold,
                              outline: "none", fontVariantNumeric: "tabular-nums", margin: "0 auto",
                            }}
                          />
                        ) : (
                          <div
                            onClick={(e) => { e.stopPropagation(); setEditingStepKey(step.key); }}
                            style={{ fontSize: 18, fontWeight: 500, fontVariantNumeric: "tabular-nums",
                              color: step.active ? (step.type === "multiplier" ? R.warmTeal : R.gold) : R.textDim,
                              cursor: "text",
                            }}>
                            {step.type === "multiplier" ? `${step.value}×` : `−${step.value}%`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Final */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: ARROW_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: ARROW_LINE, height: 1, background: R.warmTeal, position: "relative" }}>
                    <div style={{ position: "absolute", right: -6, top: -4, width: 0, height: 0,
                      borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                      borderLeft: `6px solid ${R.warmTeal}`,
                    }} />
                  </div>
                </div>
                <div style={{ width: BOX_W, flexShrink: 0 }}>
                  <div style={{
                    padding: "20px 14px", borderRadius: 8, textAlign: "center", height: 96,
                    display: "flex", flexDirection: "column", justifyContent: "center",
                    background: `${R.warmTeal}06`, border: `1px solid ${R.warmTeal}15`,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1, color: R.warmTeal, textTransform: "uppercase", marginBottom: 8 }}>Guest Sees</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: R.warmTeal, fontVariantNumeric: "tabular-nums" }}>{curr}{selectedResult.final.toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: R.textDim, marginTop: 6 }}>{Math.round((selectedResult.final / simPmsRate) * 100)}% of PMS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Simulator — per-step breakdown for a specific stay date */}
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
          <div
            onClick={() => setShowSimulator(!showSimulator)}
            style={{ padding: "14px 20px", borderBottom: showSimulator ? `1px solid ${R.sep}` : "none",
              display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: R.text }}>Simulator</span>
              <span style={{ fontSize: 11, color: R.textDim }}>— applied/skipped breakdown for a stay date</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 11, color: R.textMid, fontVariantNumeric: "tabular-nums" }}>
                {curr}{simPmsRate} → <span style={{ color: R.warmTeal, fontWeight: 600 }}>{curr}{selectedResult.final.toFixed(2)}</span>
              </span>
              <ChevronDown size={14} color={R.textDim} style={{ transform: showSimulator ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </div>
          </div>

          {showSimulator && (
            <div style={{ padding: "18px 20px" }}>
              {/* Inputs row */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>PMS Rate</span>
                  <input
                    type="number"
                    value={simPmsRate}
                    onChange={(e) => setSimPmsRate(Number(e.target.value) || 0)}
                    style={{
                      width: 110, padding: "6px 9px", fontSize: 12, color: R.text,
                      background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 5,
                      outline: "none", fontVariantNumeric: "tabular-nums",
                    }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: R.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Stay Date</span>
                  <input
                    type="date"
                    value={stayDate}
                    onChange={(e) => setStayDate(e.target.value || todayIso())}
                    style={{
                      padding: "6px 9px", fontSize: 12, color: R.text,
                      background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 5,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                </label>
                <button
                  onClick={() => setStayDate(todayIso())}
                  style={{
                    padding: "6px 10px", borderRadius: 5,
                    background: "transparent", border: `1px solid ${R.border}`, color: R.textDim,
                    fontSize: 11, cursor: "pointer",
                  }}
                >Today</button>
              </div>

              {/* Breakdown list */}
              <div style={{ border: `1px solid ${R.border}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 150px 110px 130px",
                  padding: "8px 12px", background: R.darkBand,
                  fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase",
                }}>
                  <span>Step</span>
                  <span style={{ textAlign: "center" }}>Role</span>
                  <span style={{ textAlign: "right" }}>Factor After</span>
                  <span style={{ textAlign: "right" }}>Status</span>
                </div>
                {selectedResult.entries.length === 0 ? (
                  <div style={{ padding: 14, fontSize: 12, color: R.textDim, fontStyle: "italic" }}>No steps to simulate.</div>
                ) : (
                  selectedResult.entries.map((entry, i) => {
                    const isLast = i === selectedResult.entries.length - 1;
                    const roleLabel = entry.step.role
                      ? (STEP_ROLE_OPTIONS.find(o => o.value === entry.step.role)?.label ?? entry.step.role)
                      : "—";
                    const statusColor = entry.applied ? R.green : R.textDim;
                    const statusText = entry.applied
                      ? `applied ${entry.step.type === "multiplier" ? `×${entry.step.value}` : `−${entry.step.value}%`}`
                      : `skipped · ${entry.skipReason ? SKIP_REASON_LABEL[entry.skipReason] : "n/a"}`;
                    return (
                      <div key={entry.step.key} style={{
                        display: "grid", gridTemplateColumns: "1fr 150px 110px 130px",
                        padding: "9px 12px",
                        borderBottom: isLast ? "none" : `1px solid ${R.sep}`,
                        fontSize: 12, color: entry.applied ? R.text : R.textDim,
                        opacity: entry.applied ? 1 : 0.65,
                      }}>
                        <span>{entry.step.label}</span>
                        <span style={{ textAlign: "center", fontSize: 10, color: R.textMid, textTransform: "uppercase", letterSpacing: 0.5 }}>{roleLabel}</span>
                        <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: R.textMid }}>{entry.factorAfter.toFixed(4)}</span>
                        <span style={{ textAlign: "right", color: statusColor, fontSize: 11, fontWeight: 500 }}>{statusText}</span>
                      </div>
                    );
                  })
                )}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 150px 110px 130px",
                  padding: "10px 12px", background: `${R.warmTeal}06`,
                  fontSize: 12, color: R.warmTeal, fontWeight: 600,
                }}>
                  <span>Guest Sees</span>
                  <span />
                  <span />
                  <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{curr}{selectedResult.final.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Per-Hotel Overrides */}
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Per-Hotel Overrides</span>
              <span style={{ color: R.textDim, fontSize: 11 }}>— {channel.channelName}</span>
            </div>
            {(() => {
              const addDisabled = draft !== null || availableHotelsForNew.length === 0;
              const addTitle = draft !== null
                ? "Finish the current draft first"
                : (availableHotelsForNew.length === 0 ? "All hotels already have an override for this channel" : "");
              return (
                <button
                  onClick={openAddOverride}
                  disabled={addDisabled}
                  title={addTitle}
                  style={{
                    padding: "6px 14px", borderRadius: 6, border: `1px solid ${R.border}`,
                    background: R.cardRaised,
                    color: addDisabled ? R.textDim : R.textMid,
                    fontSize: 11, fontWeight: 500,
                    cursor: addDisabled ? "not-allowed" : "pointer",
                    opacity: addDisabled ? 0.5 : 1,
                  }}
                >+ Add Override</button>
              );
            })()}
          </div>

          {/* Body: D1 draft (if new) + list of overrides (D3 minimal or D2 expanded) */}
          {(() => {
            const isAdding = draft?.mode === "new";
            const editingHotelId = draft?.mode === "edit" ? draft.hotelId : null;
            const hasAnyRow = isAdding || channelOverrides.length > 0;

            if (!hasAnyRow) {
              return (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ color: R.textDim, fontSize: 12 }}>No overrides — all hotels use Global for {channel.channelName}.</div>
                </div>
              );
            }

            // Arrow connector between waterfall boxes — matches main pipeline (48px)
            const renderArrow = (active: boolean, color?: string) => {
              const c = color ?? (active ? R.border : `${R.border}50`);
              return (
                <div style={{ width: ARROW_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: ARROW_LINE, height: 1, background: c, position: "relative" }}>
                    <div style={{
                      position: "absolute", right: -6, top: -4, width: 0, height: 0,
                      borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                      borderLeft: `6px solid ${c}`,
                    }} />
                  </div>
                </div>
              );
            };

            // A full-size waterfall box (148×96) — matches the Portfolio Default pipeline exactly
            // Mode: "readonly" (Global row) or "editable" (Hotel row)
            const renderBox = (args: {
              label: string;
              value: number;
              type: "multiplier" | "discount" | "tax";
              active: boolean;
              mode: "readonly" | "editable";
              stepKey?: string;
              changed?: boolean;
              locked?: boolean;
            }) => {
              const { label, value, type, active, mode, stepKey, changed, locked } = args;
              const isEditing = mode === "editable" && stepKey != null && editingDraftStepKey === stepKey;
              const valueColor = !active
                ? R.textDim
                : (changed ? R.gold : (type === "multiplier" ? R.warmTeal : R.accent));
              const display = active
                ? (type === "multiplier" ? `${value}×` : `−${value}%`)
                : "off";

              return (
                <div style={{ width: BOX_W, flexShrink: 0, opacity: active ? 1 : 0.35, position: "relative" }}>
                  <div
                    onClick={() => {
                      if (mode !== "editable" || !stepKey || locked) return;
                      if (!isEditing) handleDraftStepToggle(stepKey);
                    }}
                    style={{
                      padding: "20px 14px", borderRadius: 8, textAlign: "center", height: 96,
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      background: changed ? `${R.gold}10` : R.card,
                      border: `1px solid ${isEditing ? R.warmTeal : (changed ? `${R.gold}40` : R.border)}`,
                      cursor: mode === "editable" && !locked ? "pointer" : "default",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 400, color: R.textMid, marginBottom: 10 }}>{label}</div>
                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        defaultValue={value}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const v = parseFloat((e.target as HTMLInputElement).value);
                            if (!isNaN(v) && stepKey) handleDraftStepValue(stepKey, v);
                            setEditingDraftStepKey(null);
                          }
                          if (e.key === "Escape") setEditingDraftStepKey(null);
                        }}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && stepKey) handleDraftStepValue(stepKey, v);
                          setEditingDraftStepKey(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: 70, fontSize: 18, fontWeight: 500, textAlign: "center",
                          background: "transparent", border: "none",
                          borderBottom: `1px solid ${R.warmTeal}40`,
                          color: changed ? R.gold : (type === "multiplier" ? R.warmTeal : R.gold),
                          outline: "none", fontVariantNumeric: "tabular-nums", margin: "0 auto",
                        }}
                      />
                    ) : (
                      <div
                        onClick={(e) => {
                          if (mode !== "editable" || !stepKey || !active) return;
                          e.stopPropagation();
                          setEditingDraftStepKey(stepKey);
                        }}
                        style={{
                          fontSize: 18, fontWeight: 500, fontVariantNumeric: "tabular-nums",
                          color: valueColor,
                          cursor: mode === "editable" && active ? "text" : "inherit",
                        }}
                      >{display}</div>
                    )}
                  </div>
                </div>
              );
            };

            // Renders a "terminal" box (PMS / Guest Sees) matching main pipeline
            const renderTerminalBox = (label: string, value: string, accent: boolean) => (
              <div style={{ width: BOX_W, flexShrink: 0 }}>
                <div style={{
                  padding: "20px 14px", borderRadius: 8,
                  background: accent ? `${R.warmTeal}06` : R.cardRaised,
                  border: `1px solid ${accent ? `${R.warmTeal}15` : R.border}`,
                  textAlign: "center", height: 96,
                  display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1, color: accent ? R.warmTeal : R.textDim, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: accent ? R.warmTeal : R.accent, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                </div>
              </div>
            );

            // Renders the drafting row — header + (two-row comparison once a hotel is selected)
            const renderDraftingRow = (isLast: boolean) => {
              if (!draft) return null;
              const { mode, hotelId, steps } = draft;
              const hotelName = hotelId != null
                ? (channelOverrides.find(o => o.hotelId === hotelId)?.hotelName
                    ?? allHotels.find(h => h.id === hotelId)?.name
                    ?? "—")
                : null;

              const globalFinal = calcWaterfall(channel.steps, simPmsRate, stayDate).final;
              const draftFinal = calcWaterfall(steps, simPmsRate, stayDate).final;
              const delta = draftFinal - globalFinal;

              return (
                <div style={{
                  borderBottom: isLast ? "none" : `1px solid ${R.sep}`,
                  background: R.card,
                }}>
                  {/* Drafting header — subtle top band, same dimensions as main pipeline header */}
                  <div style={{
                    padding: "14px 20px", borderBottom: `1px solid ${R.sep}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: R.text }}>
                        {mode === "edit"
                          ? `Override — ${hotelName}`
                          : (hotelId != null ? `New override — ${hotelName}` : "New override")}
                      </span>
                      {mode === "new" && hotelId == null && (
                        <span style={{ fontSize: 11, color: R.textDim }}>— pick a hotel to begin</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {mode === "edit" && (
                        <button
                          onClick={handleDeleteDraft}
                          disabled={savingDraft}
                          style={{
                            fontSize: 11, padding: "5px 12px", borderRadius: 5,
                            background: "transparent", border: `1px solid ${R.red}35`, color: R.red,
                            cursor: savingDraft ? "not-allowed" : "pointer", fontWeight: 500,
                          }}
                        >Remove</button>
                      )}
                      <button
                        onClick={handleSaveDraft}
                        disabled={hotelId == null || savingDraft}
                        style={{
                          fontSize: 11, padding: "5px 14px", borderRadius: 5,
                          background: (hotelId == null || savingDraft) ? R.border : R.warmTeal,
                          border: "none",
                          color: (hotelId == null || savingDraft) ? R.textDim : R.darkBand,
                          cursor: (hotelId == null || savingDraft) ? "not-allowed" : "pointer",
                          fontWeight: 600,
                        }}
                      >{savingDraft ? "Saving…" : "Save"}</button>
                      <button
                        onClick={handleCancelDraft}
                        disabled={savingDraft}
                        style={{
                          fontSize: 11, padding: "5px 12px", borderRadius: 5,
                          background: "transparent", border: `1px solid ${R.border}`, color: R.textDim,
                          cursor: savingDraft ? "not-allowed" : "pointer",
                        }}
                      >Cancel</button>
                    </div>
                  </div>

                  {/* D1: hotel picker (only when new and no hotel picked) */}
                  {mode === "new" && hotelId == null && (
                    <div style={{ padding: "28px 24px", display: "flex", justifyContent: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%", maxWidth: 420 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase" }}>Choose a hotel to override</div>
                        <div style={{ position: "relative", width: "100%" }}>
                          <select
                            autoFocus
                            value=""
                            onChange={(e) => handleDraftHotelChange(Number(e.target.value))}
                            style={{
                              width: "100%", padding: "12px 40px 12px 16px", fontSize: 14, color: R.text,
                              background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 8,
                              outline: "none", appearance: "none",
                              WebkitAppearance: "none", MozAppearance: "none",
                              fontFamily: "inherit", cursor: "pointer",
                            }}
                          >
                            <option value="" disabled>Pick a hotel…</option>
                            {availableHotelsForNew.map(h => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={16} style={{
                            position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                            color: R.textDim, pointerEvents: "none",
                          }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* D2: two-row waterfall comparison (once a hotel is selected) — full width, big boxes */}
                  {hotelId != null && (
                    <div style={{ padding: "28px 24px 24px", overflowX: "auto" }}>
                      {/* Row labels (sticky-style on the left) + pipelines */}
                      <div style={{ minWidth: "min-content" }}>
                        {/* Global row — read-only, slightly dimmed */}
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                          <div style={{
                            width: 84, flexShrink: 0,
                            fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase",
                          }}>Global</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 0, opacity: 0.75 }}>
                            {renderTerminalBox("PMS Rate", `${curr}${simPmsRate}`, false)}
                            {channel.steps.map(s => (
                              <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
                                {renderArrow(s.active)}
                                {renderBox({ label: s.label, value: s.value, type: s.type, active: s.active, mode: "readonly" })}
                              </div>
                            ))}
                            {renderArrow(true, `${R.warmTeal}60`)}
                            {renderTerminalBox("Guest Sees", `${curr}${globalFinal.toFixed(2)}`, true)}
                          </div>
                        </div>

                        {/* Hotel row — editable */}
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{
                            width: 84, flexShrink: 0,
                            fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }} title={hotelName ?? undefined}>{hotelName ?? "—"}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                            {renderTerminalBox("PMS Rate", `${curr}${simPmsRate}`, false)}
                            {steps.map(s => {
                              const globalStep = channel.steps.find(gs => gs.key === s.key);
                              const changed = !!globalStep && (s.value !== globalStep.value || s.active !== globalStep.active);
                              return (
                                <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
                                  {renderArrow(s.active)}
                                  {renderBox({
                                    label: s.label,
                                    value: s.value,
                                    type: s.type,
                                    active: s.active,
                                    mode: "editable",
                                    stepKey: s.key,
                                    changed,
                                    locked: s.locked,
                                  })}
                                </div>
                              );
                            })}
                            {renderArrow(true, R.warmTeal)}
                            {renderTerminalBox("Guest Sees", `${curr}${draftFinal.toFixed(2)}`, true)}
                          </div>
                        </div>

                        {/* Delta caption */}
                        <div style={{ marginTop: 14, paddingLeft: 100, fontSize: 11, color: delta !== 0 ? R.gold : R.textDim }}>
                          {delta !== 0
                            ? `→ ${delta > 0 ? "+" : ""}${curr}${delta.toFixed(2)} vs Global`
                            : "Matches Global"}
                        </div>

                        {/* Hint */}
                        <div style={{ marginTop: 10, paddingLeft: 100, fontSize: 10, color: R.textDim, lineHeight: 1.5 }}>
                          Click a box to toggle on/off · click a value to edit
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div>
                {/* New-draft row pinned at top */}
                {isAdding && renderDraftingRow(channelOverrides.length === 0)}

                {/* Existing overrides */}
                {channelOverrides.map((ov, i) => {
                  const isLast = i === channelOverrides.length - 1;

                  // If this override is being edited, render D2 in place
                  if (ov.hotelId === editingHotelId) {
                    return <div key={ov.hotelId}>{renderDraftingRow(isLast)}</div>;
                  }

                  // Otherwise: D3 minimal row
                  const effectiveSteps = getEffectiveSteps(channel, ov.hotelId, overrides);
                  const finalRate = calcWaterfall(effectiveSteps, simPmsRate, stayDate).final;
                  const diverged = channel.steps.reduce<Array<{ label: string; type: "multiplier" | "discount" | "tax"; value: number; active: boolean }>>((acc, step) => {
                    const ovStep = ov.overrides[step.key];
                    if (!ovStep) return acc;
                    const value = ovStep.value ?? step.value;
                    const active = ovStep.active ?? step.active;
                    if (value !== step.value || active !== step.active) {
                      acc.push({ label: step.label, type: step.type, value, active });
                    }
                    return acc;
                  }, []);

                  return (
                    <div
                      key={ov.hotelId}
                      onClick={() => openEditOverride(ov.hotelId)}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr auto 110px",
                        padding: "14px 20px", alignItems: "center", gap: 24,
                        borderBottom: isLast ? "none" : `1px solid ${R.sep}`,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = R.cardRaised; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{ color: R.accent, fontSize: 13 }}>{ov.hotelName}</span>
                      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {diverged.length === 0 ? (
                          <span style={{ fontSize: 11, color: R.textDim, fontStyle: "italic" }}>matches Global</span>
                        ) : (
                          diverged.map((d, idx) => (
                            <span key={idx} style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                              <span style={{ color: R.textMid }}>{d.label} </span>
                              <span style={{ color: R.gold, fontWeight: 500 }}>
                                {d.active ? (d.type === "multiplier" ? `${d.value}×` : `−${d.value}%`) : "off"}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                      <span style={{ textAlign: "right", color: R.warmTeal, fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                        {curr}{finalRate.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        </>)}
      </div>

      {deleteConfirm && (
        <div
          onClick={closeDeleteConfirm}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: R.card, border: `1px solid ${R.border}`, borderRadius: 10,
              padding: "24px 28px", maxWidth: 480, width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: R.accent, marginBottom: 10 }}>
              Delete {deleteConfirm.channelName}?
            </div>
            <div style={{ fontSize: 13, color: R.textMid, lineHeight: 1.55, marginBottom: 8 }}>
              This removes the channel, its waterfall defaults, and all grid connections.
            </div>
            {deleteConfirm.overrideCount > 0 && (
              <div style={{
                fontSize: 12, color: R.gold, background: `${R.gold}10`,
                border: `1px solid ${R.gold}30`, borderRadius: 6,
                padding: "8px 12px", marginBottom: 12,
              }}>
                <strong>{deleteConfirm.overrideCount}</strong> per-hotel override{deleteConfirm.overrideCount === 1 ? "" : "s"} will also be deleted.
              </div>
            )}
            <div style={{ fontSize: 11, color: R.textDim, marginBottom: 20 }}>
              This cannot be undone.
            </div>
            {deleteError && (
              <div style={{
                padding: "10px 14px", borderRadius: 6, marginBottom: 16,
                background: `${R.red}10`, border: `1px solid ${R.red}30`,
                color: R.red, fontSize: 12,
              }}>{deleteError}</div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={closeDeleteConfirm}
                disabled={deleting}
                style={{
                  fontSize: 12, padding: "8px 14px", borderRadius: 5,
                  background: "transparent", border: `1px solid ${R.border}`,
                  color: R.textMid, cursor: deleting ? "not-allowed" : "pointer",
                }}
              >Cancel</button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  fontSize: 12, padding: "8px 16px", borderRadius: 5,
                  background: deleting ? R.border : R.red, border: "none",
                  color: deleting ? R.textDim : "#fff",
                  cursor: deleting ? "not-allowed" : "pointer", fontWeight: 600,
                }}
              >{deleting ? "Deleting…" : "Delete Channel"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ADD-CHANNEL PANEL (inline, full-width)
// ══════════════════════════════════════════

interface AddChannelPanelProps {
  draft: NewChannelDraft;
  onUpdate: <K extends keyof NewChannelDraft>(key: K, value: NewChannelDraft[K]) => void;
  onPickPreset: (p: PresetKey) => void;
  onToggleStep: (key: string) => void;
  onChangeStepValue: (key: string, value: number) => void;
  onChangeStepType: (key: string, type: "multiplier" | "discount") => void;
  onChangeStepRole: (key: string, role: StepRole | null) => void;
  onRenameStep: (key: string, label: string) => void;
  onRemoveStep: (key: string) => void;
  onAddStep: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  simPmsRate: number;
  finalRate: number;
}

function AddChannelPanel(props: AddChannelPanelProps) {
  const {
    draft, onUpdate, onPickPreset, onToggleStep, onChangeStepValue, onChangeStepType, onChangeStepRole,
    onRenameStep, onRemoveStep, onAddStep, onSave, onCancel, saving, error,
    simPmsRate, finalRate,
  } = props;

  const curr = "£";
  const AGREEMENT_OPTS: { v: AgreementType; label: string }[] = [
    { v: "group", label: "Group" }, { v: "individual", label: "Individual" },
    { v: "direct", label: "Direct" }, { v: "meta", label: "Meta" },
  ];
  const INTEGRATION_OPTS: { v: IntegrationType; label: string }[] = [
    { v: "channel_manager", label: "Channel Manager" }, { v: "direct_api", label: "Direct API" },
    { v: "extranet", label: "Extranet" }, { v: "meta_search", label: "Meta Search" },
  ];
  const PAYMENT_OPTS: { v: PaymentMethod; label: string }[] = [
    { v: "guest_pays", label: "Guest Pays" }, { v: "vcc", label: "VCC" }, { v: "bacs", label: "BACS" },
  ];

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 11px", borderRadius: 5, fontSize: 11, fontWeight: 500,
    border: `1px solid ${active ? `${R.warmTeal}40` : R.border}`,
    background: active ? `${R.warmTeal}15` : R.darkBand,
    color: active ? R.warmTeal : R.textMid,
    cursor: "pointer",
  });

  const fieldLabelStyle: React.CSSProperties = {
    width: 130, flexShrink: 0,
    fontSize: 11, fontWeight: 600, letterSpacing: -0.02,
    color: R.textMid, textTransform: "uppercase",
  };

  const fieldRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 0", borderBottom: `1px solid ${R.sep}`,
  };

  const smallInputStyle: React.CSSProperties = {
    padding: "6px 10px", background: R.darkBand,
    border: `1px solid ${R.border}`, borderRadius: 5,
    color: R.text, fontSize: 12, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      background: R.card, border: `1px solid ${R.border}`, borderRadius: 8,
      marginBottom: 24, overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: `1px solid ${R.sep}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>New Channel</span>
          <span style={{ fontSize: 11, color: R.textDim }}>— preset-driven waterfall · editable before save</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            style={{
              fontSize: 11, padding: "6px 14px", borderRadius: 5,
              background: saving || !draft.name.trim() ? R.border : R.warmTeal,
              border: "none",
              color: saving || !draft.name.trim() ? R.textDim : R.darkBand,
              cursor: saving || !draft.name.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >{saving ? "Saving…" : "Create Channel"}</button>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              fontSize: 11, padding: "6px 10px", borderRadius: 5,
              background: "transparent", border: `1px solid ${R.border}`, color: R.textDim,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          ><X size={12} /> Cancel</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px" }}>

        {/* Channel name — the only prominent input at the top */}
        <input
          autoFocus
          type="text"
          value={draft.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="Channel name (e.g. Booking.com)"
          style={{
            width: "100%", padding: "10px 12px",
            background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 6,
            color: R.text, fontSize: 16, fontWeight: 500, outline: "none",
            marginBottom: 20, fontFamily: "inherit",
          }}
        />

        {/* Metadata rows — one compact row per field, matching the existing
            channel-info drawer layout the user likes. */}
        <div style={{
          background: R.card, border: `1px solid ${R.border}`, borderRadius: 6,
          padding: "0 14px", marginBottom: 24,
        }}>
          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Type</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
              {(Object.keys(PRESETS) as PresetKey[]).map(p => (
                <button key={p} onClick={() => onPickPreset(p)} style={chipStyle(draft.channelType === p)}>
                  {PRESETS[p].label}
                </button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Agreement</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
              {AGREEMENT_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("agreement", o.v)} style={chipStyle(draft.agreement === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Integration</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
              {INTEGRATION_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("integration", o.v)} style={chipStyle(draft.integration === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Payment</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
              {PAYMENT_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("paymentMethod", o.v)} style={chipStyle(draft.paymentMethod === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Commission</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <input
                type="number" min={0} max={50}
                value={draft.commission}
                onChange={(e) => onUpdate("commission", e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="—"
                style={{ ...smallInputStyle, width: 80, textAlign: "right" }}
              />
              <span style={{ color: R.textDim, fontSize: 12 }}>%</span>
            </div>
          </div>

          <div style={{ ...fieldRowStyle, borderBottom: "none" }}>
            <div style={fieldLabelStyle}>Notes</div>
            <input
              type="text"
              value={draft.notes}
              onChange={(e) => onUpdate("notes", e.target.value)}
              placeholder="Internal context — agreement terms, quirks…"
              style={{ ...smallInputStyle, flex: 1 }}
            />
          </div>
        </div>

        {/* Programs — the step list, row-per-program (matches existing drawer) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Programs</span>
            {draft.userEditedSteps && (
              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${R.gold}15`, color: R.gold, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Edited</span>
            )}
          </div>
          <span style={{ fontSize: 10, color: R.textDim }}>Order = stacking order (top runs first)</span>
        </div>

        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, overflow: "hidden" }}>
          {draft.steps.length === 0 ? (
            <div style={{ padding: "16px 14px", color: R.textDim, fontSize: 12, fontStyle: "italic" }}>
              No programs — Guest sees PMS rate 1:1. Add a program below, or pick a different preset.
            </div>
          ) : (
            draft.steps.map((step, i) => (
              <div key={step.key} style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr 130px 90px 110px 60px 32px",
                alignItems: "center", gap: 10,
                padding: "10px 14px",
                borderBottom: i < draft.steps.length - 1 ? `1px solid ${R.sep}` : "none",
                opacity: step.active ? 1 : 0.55,
              }}>
                <div style={{ color: R.textDim, display: "flex", alignItems: "center" }} title="Drag to reorder (not wired yet)">
                  <GripVertical size={13} />
                </div>
                <input
                  type="text"
                  value={step.label}
                  onChange={(e) => onRenameStep(step.key, e.target.value)}
                  placeholder="Program label"
                  style={{
                    width: "100%", padding: "5px 8px",
                    background: "transparent", border: `1px solid transparent`, borderRadius: 4,
                    color: R.text, fontSize: 12, outline: "none",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) => { e.currentTarget.style.background = R.darkBand; e.currentTarget.style.borderColor = R.border; }}
                  onBlur={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                />
                <select
                  value={(step.role ?? "") as string}
                  onChange={(e) => onChangeStepRole(step.key, (e.target.value || null) as StepRole | null)}
                  title="Waterfall role"
                  style={{
                    padding: "4px 6px", borderRadius: 4,
                    background: R.darkBand, border: `1px solid ${R.border}`,
                    color: R.textMid, fontSize: 11, fontFamily: "inherit",
                    outline: "none", cursor: "pointer",
                  }}
                >
                  {STEP_ROLE_OPTIONS.map(o => (
                    <option key={o.value || "null"} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => onChangeStepType(step.key, step.type === "multiplier" ? "discount" : "multiplier")}
                  title="Toggle between multiplier and discount"
                  style={{
                    padding: "4px 10px", borderRadius: 4,
                    background: R.darkBand, border: `1px solid ${R.border}`,
                    color: R.textMid, fontSize: 10, fontWeight: 600,
                    cursor: "pointer", textTransform: "capitalize", letterSpacing: 0.3,
                  }}
                >{step.type}</button>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="number"
                    step={step.type === "multiplier" ? 0.05 : 1}
                    value={step.value}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) onChangeStepValue(step.key, v);
                    }}
                    style={{
                      width: 72, padding: "5px 8px",
                      background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 4,
                      color: step.type === "multiplier" ? R.warmTeal : R.gold,
                      fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                      outline: "none", textAlign: "right",
                    }}
                  />
                  <span style={{ fontSize: 11, color: R.textDim, width: 12 }}>
                    {step.type === "multiplier" ? "×" : "%"}
                  </span>
                </div>
                {/* Active toggle (compact switch matching the existing Programs form) */}
                <button
                  onClick={() => onToggleStep(step.key)}
                  title={step.active ? "Active — click to disable" : "Inactive — click to enable"}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                    background: step.active ? R.warmTeal : R.border,
                    position: "relative", padding: 0, transition: "all 0.15s",
                    justifySelf: "center",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3, left: step.active ? 19 : 3,
                    width: 14, height: 14, borderRadius: "50%",
                    background: step.active ? R.darkBand : R.textDim, transition: "all 0.15s",
                  }} />
                </button>
                <button
                  onClick={() => onRemoveStep(step.key)}
                  title="Remove program"
                  style={{
                    width: 24, height: 24, borderRadius: 4, border: "none",
                    background: "transparent", color: R.textDim,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    justifySelf: "end",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = R.red; e.currentTarget.style.background = `${R.red}10`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = R.textDim; e.currentTarget.style.background = "transparent"; }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}

          {/* Add-step row at bottom */}
          <button
            onClick={onAddStep}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "10px 14px",
              background: "transparent", border: "none",
              color: R.textMid, fontSize: 12, cursor: "pointer",
              borderTop: `1px dashed ${R.border}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = R.cardRaised)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Plus size={13} style={{ color: R.textDim }} />
            <span>Add program</span>
          </button>
        </div>

        {/* Compact one-line preview */}
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ fontSize: 11, color: R.textDim }}>Example on {curr}{simPmsRate} PMS rate</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ color: R.textMid, fontSize: 13 }}>{curr}{simPmsRate}</span>
            <span style={{ color: R.textDim, fontSize: 11 }}>→</span>
            <span style={{ color: R.warmTeal, fontSize: 14, fontWeight: 600 }}>{curr}{finalRate.toFixed(2)}</span>
            <span style={{ color: R.textDim, fontSize: 11 }}>({Math.round((finalRate / simPmsRate) * 100)}% of PMS)</span>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 16, padding: "10px 14px", borderRadius: 6,
            background: `${R.red}10`, border: `1px solid ${R.red}30`,
            color: R.red, fontSize: 12,
          }}>{error}</div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// EDIT-CHANNEL PANEL (meta-only; waterfall is edited in the main view)
// ══════════════════════════════════════════

interface EditChannelPanelProps {
  draft: EditChannelDraft;
  onUpdate: <K extends keyof EditChannelDraft>(key: K, value: EditChannelDraft[K]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function EditChannelPanel({ draft, onUpdate, onSave, onCancel, saving, error }: EditChannelPanelProps) {
  const CHANNEL_TYPE_OPTS: { v: PresetKey; label: string }[] = [
    { v: "ota", label: "OTA" },
    { v: "wholesaler", label: "Wholesaler" },
    { v: "flash_sale", label: "Flash Sale" },
    { v: "direct", label: "Direct" },
    { v: "meta", label: "Meta" },
  ];
  const AGREEMENT_OPTS: { v: AgreementType; label: string }[] = [
    { v: "group", label: "Group" }, { v: "individual", label: "Individual" },
    { v: "direct", label: "Direct" }, { v: "meta", label: "Meta" },
  ];
  const TIER_OPTS: { v: ChannelTier; label: string }[] = [
    { v: "strategic", label: "Strategic" }, { v: "growth", label: "Growth" },
    { v: "tactical", label: "Tactical" }, { v: "experimental", label: "Experimental" },
  ];
  const INTEGRATION_OPTS: { v: IntegrationType; label: string }[] = [
    { v: "channel_manager", label: "Channel Manager" }, { v: "direct_api", label: "Direct API" },
    { v: "extranet", label: "Extranet" }, { v: "meta_search", label: "Meta Search" },
  ];
  const PAYMENT_OPTS: { v: PaymentMethod; label: string }[] = [
    { v: "guest_pays", label: "Guest Pays" }, { v: "vcc", label: "VCC" }, { v: "bacs", label: "BACS" },
  ];

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 11px", borderRadius: 5, fontSize: 11, fontWeight: 500,
    border: `1px solid ${active ? `${R.warmTeal}40` : R.border}`,
    background: active ? `${R.warmTeal}15` : R.darkBand,
    color: active ? R.warmTeal : R.textMid,
    cursor: "pointer",
  });

  const fieldLabelStyle: React.CSSProperties = {
    width: 130, flexShrink: 0,
    fontSize: 11, fontWeight: 600, letterSpacing: -0.02,
    color: R.textMid, textTransform: "uppercase",
  };

  const fieldRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 0", borderBottom: `1px solid ${R.sep}`,
  };

  const smallInputStyle: React.CSSProperties = {
    padding: "6px 10px", background: R.darkBand,
    border: `1px solid ${R.border}`, borderRadius: 5,
    color: R.text, fontSize: 12, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      background: R.card, border: `1px solid ${R.border}`, borderRadius: 8,
      marginBottom: 24, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px", borderBottom: `1px solid ${R.sep}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>Edit Channel</span>
          <span style={{ fontSize: 11, color: R.textDim }}>— waterfall steps are edited in the main view</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            style={{
              fontSize: 11, padding: "6px 14px", borderRadius: 5,
              background: saving || !draft.name.trim() ? R.border : R.warmTeal,
              border: "none",
              color: saving || !draft.name.trim() ? R.textDim : R.darkBand,
              cursor: saving || !draft.name.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >{saving ? "Saving…" : "Save Changes"}</button>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              fontSize: 11, padding: "6px 10px", borderRadius: 5,
              background: "transparent", border: `1px solid ${R.border}`, color: R.textDim,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          ><X size={12} /> Cancel</button>
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <input
          autoFocus
          type="text"
          value={draft.name}
          onChange={(e) => onUpdate("name", e.target.value)}
          placeholder="Channel name"
          style={{
            width: "100%", padding: "10px 12px",
            background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 6,
            color: R.text, fontSize: 16, fontWeight: 500, outline: "none",
            marginBottom: 20, fontFamily: "inherit",
          }}
        />

        <div style={{ borderTop: `1px solid ${R.sep}` }}>
          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Channel type</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CHANNEL_TYPE_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("channelType", o.v)} style={chipStyle(draft.channelType === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Agreement</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AGREEMENT_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("agreement", o.v)} style={chipStyle(draft.agreement === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Tier</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TIER_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("tier", o.v)} style={chipStyle(draft.tier === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Integration</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {INTEGRATION_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("integration", o.v)} style={chipStyle(draft.integration === o.v)}>{o.label}</button>
              ))}
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Commission %</div>
            <input
              type="number"
              value={draft.commission}
              onChange={(e) => onUpdate("commission", e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 15"
              style={{ ...smallInputStyle, width: 100 }}
            />
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Payment method</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PAYMENT_OPTS.map(o => (
                <button key={o.v} onClick={() => onUpdate("paymentMethod", o.v)} style={chipStyle(draft.paymentMethod === o.v)}>{o.label}</button>
              ))}
              <button onClick={() => onUpdate("paymentMethod", "")} style={chipStyle(draft.paymentMethod === "")}>—</button>
            </div>
          </div>

          <div style={fieldRowStyle}>
            <div style={fieldLabelStyle}>Contract expiry</div>
            <input
              type="date"
              value={draft.contractExpiry}
              onChange={(e) => onUpdate("contractExpiry", e.target.value)}
              style={{ ...smallInputStyle, width: 160 }}
            />
          </div>

          <div style={{ ...fieldRowStyle, alignItems: "flex-start", borderBottom: "none" }}>
            <div style={fieldLabelStyle}>Notes</div>
            <textarea
              value={draft.notes}
              onChange={(e) => onUpdate("notes", e.target.value)}
              placeholder="Internal notes"
              rows={3}
              style={{ ...smallInputStyle, flex: 1, resize: "vertical", fontSize: 12, lineHeight: 1.5 }}
            />
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 16, padding: "10px 14px", borderRadius: 6,
            background: `${R.red}10`, border: `1px solid ${R.red}30`,
            color: R.red, fontSize: 12,
          }}>{error}</div>
        )}
      </div>
    </div>
  );
}
