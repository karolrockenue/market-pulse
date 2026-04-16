/**
 * Channel Pricing — V3 design with agreed token palette.
 * Wired to real API. Horizontal waterfall, channel tabs, per-hotel overrides.
 */

import { useState, useEffect } from "react";
import { ChevronDown, Info, Loader2, Plus, GripVertical, Pencil, Trash2 } from "lucide-react";
import {
  fetchPricingChannels, fetchChannelPricing, updateChannelPricingSteps,
  setHotelPricingOverride, deleteHotelPricingOverride, createChannel,
} from "../api/distribution.api";

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

interface WaterfallStep {
  key: string; label: string; type: "multiplier" | "discount" | "tax";
  value: number; active: boolean; locked?: boolean;
  channelSpecific?: boolean; description?: string;
}

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

function calcWaterfall(steps: WaterfallStep[], pmsRate: number) {
  let rate = pmsRate;
  const result: { label: string; rate: number; discount: string; active: boolean }[] = [];
  for (const step of steps) {
    if (!step.active) {
      result.push({ label: step.label, rate, discount: step.type === "multiplier" ? `${step.value}×` : `${step.value}%`, active: false });
      continue;
    }
    if (step.type === "multiplier") {
      rate = rate * step.value;
      result.push({ label: step.label, rate, discount: `${step.value}×`, active: true });
    } else if (step.type === "discount") {
      rate = rate * (1 - step.value / 100);
      result.push({ label: step.label, rate, discount: `−${step.value}%`, active: true });
    }
  }
  return { steps: result, final: Math.round(rate * 100) / 100 };
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

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export function ChannelPricingConcept() {
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [simPmsRate, setSimPmsRate] = useState(185);
  const [showChannelInfo, setShowChannelInfo] = useState(false);

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

  // Programs (channel structure editor) — visual mockup state, not persisted to backend yet
  const [showProgramsForm, setShowProgramsForm] = useState(false);
  const [newProgramLabel, setNewProgramLabel] = useState("");
  const [newProgramType, setNewProgramType] = useState<"multiplier" | "discount">("discount");
  const [newProgramValue, setNewProgramValue] = useState<number>(10);
  const [newProgramActive, setNewProgramActive] = useState(true);
  const [mockAddedPrograms, setMockAddedPrograms] = useState<WaterfallStep[]>([]);

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
        steps: ch.steps ?? [],
      }));
      setChannels(mapped);
      if (selectSlug) setSelectedChannel(selectSlug);
      else if (mapped.length > 0 && !selectedChannel) setSelectedChannel(mapped[0].slug);
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
      const detailSteps = data.channel?.steps ?? [];
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
  const activeSteps = editedSteps || channel?.steps || [];
  const selectedResult = calcWaterfall(activeSteps, simPmsRate);
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

  function handleToggleStep(key: string) {
    const steps = [...(editedSteps || channel?.steps || [])];
    const idx = steps.findIndex(s => s.key === key);
    if (idx === -1 || steps[idx].locked) return;
    steps[idx] = { ...steps[idx], active: !steps[idx].active };
    setEditedSteps(steps);
  }

  function handleChangeStepValue(key: string, value: number) {
    const steps = [...(editedSteps || channel?.steps || [])];
    const idx = steps.findIndex(s => s.key === key);
    if (idx === -1) return;
    steps[idx] = { ...steps[idx], value };
    setEditedSteps(steps);
  }

  async function handleSaveSteps() {
    if (!channel || !editedSteps || savingSteps) return;
    setSavingSteps(true);
    try {
      await updateChannelPricingSteps(channel.channelId, editedSteps);
      setChannels(prev => prev.map(c => c.channelId === channel.channelId ? { ...c, steps: editedSteps } : c));
      setEditedSteps(null);
    } catch (err) { console.error("Save steps failed:", err); }
    finally { setSavingSteps(false); }
  }

  // ── Override drafting ──────────────────────────────────────────────
  function openAddOverride() {
    if (!channel) return;
    setDraft({ mode: "new", hotelId: null, steps: channel.steps.map(s => ({ ...s })) });
  }

  function openEditOverride(hotelId: number) {
    if (!channel) return;
    const effective = getEffectiveSteps(channel, hotelId, overrides);
    setDraft({ mode: "edit", hotelId, steps: effective.map(s => ({ ...s })) });
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
                setShowProgramsForm(false);
                setMockAddedPrograms([]);
                setNewProgramLabel("");
                setNewProgramValue(10);
                setNewProgramType("discount");
                setNewProgramActive(true);
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
          <button style={{
            padding: "14px 18px", border: "none", borderBottom: "2px solid transparent",
            background: "transparent", color: R.textDim, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, marginBottom: -1,
          }}>
            <Plus size={14} /> Add
          </button>
        </div>

        {!channel || loadingDetail ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={20} style={{ color: R.warmTeal, animation: "spin 1s linear infinite" }} />
          </div>
        ) : (<>

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

              {/* ─── PROGRAMS (visual mockup) ────────────────────────────── */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${R.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Programs</span>
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${R.gold}15`, color: R.gold, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Mockup</span>
                  </div>
                  <span style={{ fontSize: 10, color: R.textDim }}>Order = stacking order (top runs first)</span>
                </div>

                {/* Programs list */}
                <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 6, overflow: "hidden" }}>
                  {[...channel.steps, ...mockAddedPrograms].map((step, i, arr) => {
                    const isMockAdded = i >= channel.steps.length;
                    const suffix = step.type === "multiplier" ? "×" : "%";
                    const display = step.active
                      ? (step.type === "multiplier" ? `${step.value}${suffix}` : `−${step.value}${suffix}`)
                      : "off";
                    return (
                      <div key={`${step.key}-${i}`} style={{
                        display: "grid", gridTemplateColumns: "28px 1fr 110px 90px 64px",
                        alignItems: "center", gap: 10,
                        padding: "10px 14px",
                        borderBottom: i < arr.length - 1 ? `1px solid ${R.sep}` : "none",
                        background: isMockAdded ? `${R.gold}06` : "transparent",
                      }}>
                        <div style={{ cursor: "grab", color: R.textDim, display: "flex", alignItems: "center" }} title="Drag to reorder (not wired yet)">
                          <GripVertical size={14} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: R.text, fontWeight: 400 }}>{step.label}</span>
                          {isMockAdded && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${R.gold}15`, color: R.gold, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>New</span>
                          )}
                          {step.locked && (
                            <span style={{ fontSize: 9, color: R.textDim, fontStyle: "italic" }}>locked</span>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: R.textDim, textTransform: "capitalize" }}>{step.type}</span>
                        <span style={{ fontSize: 12, color: step.active ? (step.type === "multiplier" ? R.warmTeal : R.accent) : R.textDim, fontVariantNumeric: "tabular-nums", textAlign: "right", fontWeight: 500 }}>
                          {display}
                        </span>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            title="Edit (not wired yet)"
                            style={{
                              width: 22, height: 22, borderRadius: 4, border: "none",
                              background: "transparent", color: R.textDim,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = R.cardRaised)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            title={isMockAdded ? "Remove (mockup)" : "Delete (not wired yet)"}
                            onClick={() => {
                              if (isMockAdded) {
                                const mockIdx = i - channel.steps.length;
                                setMockAddedPrograms(prev => prev.filter((_, idx) => idx !== mockIdx));
                              }
                            }}
                            style={{
                              width: 22, height: 22, borderRadius: 4, border: "none",
                              background: "transparent", color: isMockAdded ? R.red : R.textDim,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isMockAdded ? `${R.red}10` : R.cardRaised)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* + Add Program row OR inline form */}
                  {!showProgramsForm ? (
                    <button
                      onClick={() => setShowProgramsForm(true)}
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
                      <Plus size={14} style={{ color: R.textDim }} />
                      <span>Add program</span>
                    </button>
                  ) : (
                    <div style={{ padding: "14px 14px 12px", borderTop: `1px dashed ${R.border}`, background: `${R.gold}04` }}>
                      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 10 }}>New program</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 100px 80px auto", gap: 14, alignItems: "end" }}>
                        {/* Label */}
                        <div>
                          <label style={{ display: "block", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 4 }}>Label</label>
                          <input
                            autoFocus
                            type="text"
                            value={newProgramLabel}
                            onChange={(e) => setNewProgramLabel(e.target.value)}
                            placeholder="e.g. CUG Flights"
                            style={{
                              width: "100%", padding: "7px 10px", fontSize: 12, color: R.text,
                              background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 5, outline: "none",
                              fontFamily: "inherit",
                            }}
                          />
                        </div>
                        {/* Type */}
                        <div>
                          <label style={{ display: "block", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 4 }}>Type</label>
                          <div style={{ display: "flex", gap: 4 }}>
                            {(["multiplier", "discount"] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => setNewProgramType(t)}
                                style={{
                                  flex: 1, padding: "7px 0", fontSize: 11, fontWeight: 500,
                                  background: newProgramType === t ? `${R.warmTeal}15` : R.darkBand,
                                  border: `1px solid ${newProgramType === t ? `${R.warmTeal}40` : R.border}`,
                                  color: newProgramType === t ? R.warmTeal : R.textMid,
                                  borderRadius: 5, cursor: "pointer", textTransform: "capitalize",
                                }}
                              >{t}</button>
                            ))}
                          </div>
                        </div>
                        {/* Value */}
                        <div>
                          <label style={{ display: "block", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 4 }}>Default value</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={newProgramValue}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setNewProgramValue(isNaN(v) ? 0 : v);
                              }}
                              style={{
                                flex: 1, padding: "7px 10px", fontSize: 12, color: R.text, textAlign: "right",
                                background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 5, outline: "none",
                                fontVariantNumeric: "tabular-nums", fontFamily: "inherit",
                              }}
                            />
                            <span style={{ fontSize: 12, color: R.textDim, minWidth: 14 }}>
                              {newProgramType === "multiplier" ? "×" : "%"}
                            </span>
                          </div>
                        </div>
                        {/* Active toggle */}
                        <div>
                          <label style={{ display: "block", fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 4 }}>Active</label>
                          <button
                            onClick={() => setNewProgramActive(!newProgramActive)}
                            style={{
                              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                              background: newProgramActive ? R.warmTeal : R.border,
                              position: "relative", padding: 0, transition: "all 0.15s",
                            }}
                          >
                            <div style={{
                              position: "absolute", top: 3, left: newProgramActive ? 23 : 3,
                              width: 18, height: 18, borderRadius: "50%",
                              background: newProgramActive ? R.darkBand : R.textDim, transition: "all 0.15s",
                            }} />
                          </button>
                        </div>
                        {/* Actions */}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => {
                              setShowProgramsForm(false);
                              setNewProgramLabel("");
                              setNewProgramValue(10);
                              setNewProgramType("discount");
                              setNewProgramActive(true);
                            }}
                            style={{
                              padding: "7px 12px", fontSize: 11, fontWeight: 500, borderRadius: 5,
                              background: "transparent", border: `1px solid ${R.border}`, color: R.textDim,
                              cursor: "pointer",
                            }}
                          >Cancel</button>
                          <button
                            disabled={!newProgramLabel.trim()}
                            onClick={() => {
                              const label = newProgramLabel.trim();
                              if (!label) return;
                              const key = `mock_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now()}`;
                              setMockAddedPrograms(prev => [...prev, {
                                key,
                                label,
                                type: newProgramType,
                                value: newProgramValue,
                                active: newProgramActive,
                              }]);
                              setShowProgramsForm(false);
                              setNewProgramLabel("");
                              setNewProgramValue(10);
                              setNewProgramType("discount");
                              setNewProgramActive(true);
                            }}
                            style={{
                              padding: "7px 14px", fontSize: 11, fontWeight: 600, borderRadius: 5,
                              background: !newProgramLabel.trim() ? R.border : R.warmTeal,
                              border: "none",
                              color: !newProgramLabel.trim() ? R.textDim : R.darkBand,
                              cursor: !newProgramLabel.trim() ? "not-allowed" : "pointer",
                            }}
                          >Add</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10, fontSize: 10, color: R.textDim, lineHeight: 1.5 }}>
                  Visual mockup only — adds persist while you're on this channel but aren't saved to the backend. Edit / drag-to-reorder / delete-existing are shown as affordances but not wired yet.
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

              const globalFinal = calcWaterfall(channel.steps, simPmsRate).final;
              const draftFinal = calcWaterfall(steps, simPmsRate).final;
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
                  const finalRate = calcWaterfall(effectiveSteps, simPmsRate).final;
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
    </div>
  );
}
