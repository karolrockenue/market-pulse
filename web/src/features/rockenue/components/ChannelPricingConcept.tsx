/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CHANNEL PRICING — CONCEPT / MOCKUP                            ║
 * ║                                                                  ║
 * ║  This is a design exploration for managing OTA discount stacks   ║
 * ║  at PORTFOLIO level (channel defaults) with PER-HOTEL overrides. ║
 * ║                                                                  ║
 * ║  The goal: one place to configure what every OTA sees,           ║
 * ║  while keeping crystal-clear visibility into what's default      ║
 * ║  vs what's been overridden per property.                         ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useMemo } from "react";
import {
  Globe,
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  Pencil,
  RotateCcw,
  Eye,
  Layers,
  Zap,
  Building2,
  Settings2,
  ArrowRight,
  Lock,
  Unlock,
  Info,
  Loader2,
} from "lucide-react";
import {
  fetchPricingChannels,
  fetchChannelPricing,
  updateChannelPricingSteps,
  setHotelPricingOverride,
  deleteHotelPricingOverride,
  createChannel,
} from "../api/distribution.api";

// ── Brand palette ──
const BLUE = "#39BDF8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";
const BG_PAGE = "#1d1d1c";
const CARD_BG = "#1a1a1a";
const INPUT_BG = "#2C2C2C";
const BORDER = "#2a2a2a";
const TEXT = "#e5e5e5";
const TEXT_MID = "#9ca3af";
const TEXT_DIM = "#6b7280";

// ══════════════════════════════════════════
// INTERFACES
// ══════════════════════════════════════════

interface WaterfallStep {
  key: string;
  label: string;
  type: "multiplier" | "discount" | "tax";
  value: number;        // multiplier value or discount %
  active: boolean;
  locked?: boolean;      // can't be turned off (e.g. multiplier)
  channelSpecific?: boolean; // only relevant for certain channels
  description?: string;
}

interface ChannelMeta {
  agreement: string;
  channelType: string;
  pricingModel: string;
  commission: number | null;
  paymentMethod: string;
  contractExpiry: string | null;
  primaryContact: string | null;
  contactEmail: string | null;
  notes: string | null;
}

interface ChannelDefaults {
  channelId: number;
  channelName: string;
  slug: string;
  meta: ChannelMeta;
  steps: WaterfallStep[];
}

interface HotelOverride {
  hotelId: number;
  hotelName: string;
  channelSlug: string;
  overrides: Record<string, { value?: number; active?: boolean }>;  // key → override
}


// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function calcWaterfall(steps: WaterfallStep[], pmsRate: number): { steps: { label: string; rate: number; discount: string; active: boolean }[]; final: number } {
  let rate = pmsRate;
  const result: { label: string; rate: number; discount: string; active: boolean }[] = [];

  for (const step of steps) {
    if (!step.active) {
      result.push({ label: step.label, rate, discount: step.type === "multiplier" ? `${step.value}x` : `${step.value}%`, active: false });
      continue;
    }
    if (step.type === "multiplier") {
      rate = rate * step.value;
      result.push({ label: step.label, rate, discount: `${step.value}x`, active: true });
    } else if (step.type === "discount") {
      rate = rate * (1 - step.value / 100);
      result.push({ label: step.label, rate, discount: `−${step.value}%`, active: true });
    }
  }

  return { steps: result, final: Math.round(rate * 100) / 100 };
}

function getEffectiveSteps(channel: ChannelDefaults, hotelId: number, hotelOverrides: HotelOverride[]): WaterfallStep[] {
  const overrideEntry = hotelOverrides.find(o => o.hotelId === hotelId && o.channelSlug === channel.slug);
  if (!overrideEntry) return channel.steps;

  return channel.steps.map(step => {
    const override = overrideEntry.overrides[step.key];
    if (!override) return step;
    return {
      ...step,
      value: override.value !== undefined ? override.value : step.value,
      active: override.active !== undefined ? override.active : step.active,
    };
  });
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

type ViewMode = "channels" | "matrix" | "simulator";

export function ChannelPricingConcept() {
  const [viewMode, setViewMode] = useState<ViewMode>("channels");
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [expandedHotel, setExpandedHotel] = useState<number | null>(null);
  const [simPmsRate, setSimPmsRate] = useState(100);
  const [showChannelInfo, setShowChannelInfo] = useState(false);

  // ── API data state ──
  const [channels, setChannels] = useState<ChannelDefaults[]>([]);
  const [channelDetail, setChannelDetail] = useState<any>(null);
  const [allHotels, setAllHotels] = useState<{ id: number; name: string }[]>([]);
  const [overrides, setOverrides] = useState<HotelOverride[]>([]);
  const [allOverrides, setAllOverrides] = useState<HotelOverride[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editedSteps, setEditedSteps] = useState<WaterfallStep[] | null>(null);
  const [savingSteps, setSavingSteps] = useState(false);

  // ── Fetch channels list ──
  function loadChannels(selectSlug?: string) {
    return fetchPricingChannels().then(data => {
      const mapped: ChannelDefaults[] = data.map((ch: any) => ({
        channelId: ch.channel_id,
        channelName: ch.name,
        slug: ch.slug,
        meta: {
          agreement: ch.agreement_type ?? "—",
          channelType: ch.channel_type ?? "—",
          pricingModel: ch.agreement_type === "Direct" ? "Net" : "Net",
          commission: ch.commission_pct ?? null,
          paymentMethod: ch.payment_method ?? "—",
          contractExpiry: ch.contract_expiry ?? null,
          primaryContact: ch.primary_contact ?? null,
          contactEmail: ch.contact_email ?? null,
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

  async function handleAddChannel(data: { name: string; channel_type: string; agreement_type: string; commission_pct: number | null; payment_method: string }) {
    try {
      const ch = await createChannel({
        name: data.name,
        channel_type: data.channel_type as any,
        agreement_type: data.agreement_type as any,
        commission_pct: data.commission_pct as any,
        payment_method: data.payment_method as any,
      } as any);
      // Create a default pricing waterfall for the new channel
      const defaultSteps = [
        { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.00, active: true, locked: true },
      ];
      await updateChannelPricingSteps(ch.id, defaultSteps);
      setShowAddChannel(false);
      await loadChannels(ch.slug);
    } catch (err) {
      console.error("Add channel failed:", err);
    }
  }

  // Reset edited steps when switching channels
  useEffect(() => { setEditedSteps(null); }, [selectedChannel]);

  // The steps to render — edited if dirty, otherwise from channel
  const activeSteps = editedSteps || channel?.steps || [];

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
      // Update local state
      setChannels(prev => prev.map(c => c.channelId === channel.channelId ? { ...c, steps: editedSteps } : c));
      setEditedSteps(null);
    } catch (err) {
      console.error("Save steps failed:", err);
    } finally {
      setSavingSteps(false);
    }
  }

  const hasUnsavedChanges = editedSteps !== null;

  // ── Fetch channel detail when selectedChannel changes ──
  useEffect(() => {
    const ch = channels.find(c => c.slug === selectedChannel);
    if (!ch) return;
    setLoadingDetail(true);
    fetchChannelPricing(ch.channelId).then(data => {
      // Update the channel's steps from detail response
      const detailSteps = data.channel?.steps ?? [];
      setChannelDetail(data.channel);
      // Map overrides to HotelOverride shape
      const mappedOverrides: HotelOverride[] = (data.overrides ?? []).map((o: any) => ({
        hotelId: o.hotel_id,
        hotelName: o.hotel_name,
        channelSlug: selectedChannel,
        overrides: o.overrides ?? {},
      }));
      setOverrides(mappedOverrides);
      // Update allOverrides — merge current channel overrides with others
      setAllOverrides(prev => [
        ...prev.filter(o => o.channelSlug !== selectedChannel),
        ...mappedOverrides,
      ]);
      // Map hotels
      const mappedHotels = (data.hotels ?? []).map((h: any) => ({
        id: h.hotel_id ?? h.id,
        name: h.hotel_name ?? h.name,
      }));
      setAllHotels(mappedHotels);
      // Update channel steps from detail
      setChannels(prev => prev.map(c =>
        c.slug === selectedChannel ? { ...c, steps: detailSteps } : c
      ));
      setLoadingDetail(false);
    }).catch(err => { console.error(err); setLoadingDetail(false); });
  }, [selectedChannel, channels.length]);

  // ── Derived data ──
  const channel = channels.find(c => c.slug === selectedChannel);

  const overriddenHotels = useMemo(() => {
    return overrides;
  }, [overrides]);

  const overrideCount = overriddenHotels.length;

  // ── Loading / empty guard ──
  if (loadingChannels) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: BG_PAGE, position: "relative", overflow: "hidden", paddingBottom: 64 }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom right, rgba(57,189,248,0.01), transparent, rgba(57,189,248,0.01))", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(57,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(57,189,248,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, padding: "28px 32px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(57,189,248,0.12)" }}>
                <Layers size={18} style={{ color: BLUE }} />
              </div>
              <div>
                <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 600, margin: 0 }}>Channel Pricing</h1>
                <p style={{ color: TEXT_MID, fontSize: 12, margin: 0 }}>OTA discount stacks — portfolio defaults & per-hotel overrides</p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, background: INPUT_BG, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {([
                { key: "channels" as ViewMode, label: "By Channel" },
                { key: "matrix" as ViewMode, label: "Matrix View" },
                { key: "simulator" as ViewMode, label: "Simulator" },
              ]).map((v) => (
                <button key={v.key} onClick={() => setViewMode(v.key)} style={{
                  padding: "7px 16px", border: "none",
                  background: viewMode === v.key ? `${BLUE}15` : "transparent",
                  color: viewMode === v.key ? BLUE : TEXT_DIM,
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  borderRight: `1px solid ${BORDER}`,
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════ */}
        {/* VIEW 1: BY CHANNEL — Default + Overrides   */}
        {/* ═══════════════════════════════════════════ */}
        {viewMode === "channels" && (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>

            {/* Left: Channel List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 8, padding: "0 12px" }}>Channels</div>
              {channels.map((ch) => {
                const isActive = selectedChannel === ch.slug;
                const chOverrideCount = allOverrides.filter(o => o.channelSlug === ch.slug).length;
                return (
                  <button key={ch.slug} onClick={() => { setSelectedChannel(ch.slug); setShowChannelInfo(false); }} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: 8, border: "none",
                    background: isActive ? `${BLUE}08` : "transparent",
                    color: isActive ? TEXT : TEXT_MID, cursor: "pointer",
                    transition: "all 0.12s", textAlign: "left",
                    borderLeft: isActive ? `2px solid ${BLUE}` : "2px solid transparent",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{ch.channelName}</span>
                        {chOverrideCount > 0 && (
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${AMBER}15`, color: AMBER, fontWeight: 600, flexShrink: 0 }}>
                            {chOverrideCount}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>{ch.meta.channelType}</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>·</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>{ch.meta.commission != null ? `${ch.meta.commission}%` : "—"}</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>·</span>
                        <span style={{ color: TEXT_DIM, fontSize: 10 }}>{ch.meta.paymentMethod}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              <button onClick={() => setShowAddChannel(true)} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", marginTop: 8,
                borderRadius: 8, border: `1px dashed ${BORDER}`, background: "transparent",
                color: TEXT_DIM, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${BLUE}40`; e.currentTarget.style.color = BLUE; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
              >
                + Add Channel
              </button>
            </div>

            {/* Right: Channel Detail */}
            <div>
              {!channel ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
                  <Loader2 size={20} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
                </div>
              ) : loadingDetail ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
                  <Loader2 size={20} style={{ color: BLUE, animation: "spin 1s linear infinite" }} />
                </div>
              ) : (<>
              {/* Default Waterfall Card */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Globe size={14} style={{ color: BLUE }} />
                    <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{channel.channelName}</span>
                    <span style={{ color: TEXT_DIM, fontSize: 11, padding: "2px 8px", borderRadius: 4, background: INPUT_BG }}>Portfolio Default</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: TEXT_DIM, fontSize: 11 }}>
                      {overrideCount > 0 ? `${allHotels.length - overrideCount} using defaults` : `All ${allHotels.length} hotels`}
                    </span>
                    {overrideCount > 0 && (
                      <span style={{ color: AMBER, fontSize: 11, fontWeight: 600 }}>{overrideCount} override{overrideCount !== 1 ? "s" : ""}</span>
                    )}
                    <button
                      onClick={() => setShowChannelInfo(!showChannelInfo)}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                        borderRadius: 5, border: `1px solid ${showChannelInfo ? `${BLUE}30` : BORDER}`,
                        background: showChannelInfo ? `${BLUE}08` : "transparent",
                        color: showChannelInfo ? BLUE : TEXT_DIM,
                        fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <Info size={10} /> Details
                      <ChevronDown size={10} style={{ transform: showChannelInfo ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </button>
                  </div>
                </div>

                {/* Collapsible Channel Info Strip */}
                {showChannelInfo && (
                  <div style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}`, background: `${BG_PAGE}` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: channel.meta.notes ? 12 : 0 }}>
                      {/* Col 1: Agreement & Type */}
                      <div>
                        <div style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Agreement</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{channel.meta.agreement}</span>
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${BLUE}12`, color: BLUE }}>{channel.meta.channelType}</span>
                          </div>
                          <div style={{ color: TEXT_MID, fontSize: 11 }}>Pricing: {channel.meta.pricingModel}</div>
                        </div>
                      </div>

                      {/* Col 2: Commission & Payment */}
                      <div>
                        <div style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Financials</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: channel.meta.commission && channel.meta.commission >= 20 ? AMBER : TEXT, fontSize: 13, fontWeight: 600 }}>
                              {channel.meta.commission != null ? `${channel.meta.commission}%` : "—"}
                            </span>
                            <span style={{ color: TEXT_DIM, fontSize: 10 }}>commission</span>
                          </div>
                          <div style={{ color: TEXT_MID, fontSize: 11 }}>Payment: {channel.meta.paymentMethod}</div>
                        </div>
                      </div>

                      {/* Col 3: Contract */}
                      <div>
                        <div style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Contract</div>
                        <div style={{ color: channel.meta.contractExpiry && channel.meta.contractExpiry < "2026-10-01" ? AMBER : TEXT_MID, fontSize: 12 }}>
                          {channel.meta.contractExpiry
                            ? `Expires ${new Date(channel.meta.contractExpiry).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
                            : "No expiry set"
                          }
                        </div>
                      </div>

                      {/* Col 4: Contact */}
                      <div>
                        <div style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>Contact</div>
                        {channel.meta.primaryContact ? (
                          <div>
                            <div style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{channel.meta.primaryContact}</div>
                            {channel.meta.contactEmail && (
                              <div style={{ color: TEXT_DIM, fontSize: 10, marginTop: 2 }}>{channel.meta.contactEmail}</div>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: TEXT_DIM, fontSize: 11, fontStyle: "italic" }}>No contact</div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {channel.meta.notes && (
                      <div style={{ padding: "8px 10px", background: `${AMBER}06`, borderRadius: 4, borderLeft: `2px solid ${AMBER}30` }}>
                        <span style={{ color: TEXT_MID, fontSize: 11 }}>{channel.meta.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Waterfall Steps */}
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
                    {/* Left: Settings */}
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {activeSteps.map((step: WaterfallStep, i: number) => (
                          <div key={step.key} style={{
                            display: "grid", gridTemplateColumns: "24px 1fr 90px 60px",
                            alignItems: "center", padding: "8px 0",
                            opacity: step.active ? 1 : 0.4,
                            borderBottom: i < activeSteps.length - 1 ? `1px solid ${BORDER}` : "none",
                          }}>
                            {/* Toggle */}
                            <div
                              onClick={() => handleToggleStep(step.key)}
                              style={{
                                width: 16, height: 16, borderRadius: 4,
                                border: step.locked ? "none" : `1px solid ${step.active ? BLUE : BORDER}`,
                                background: step.locked ? "transparent" : step.active ? `${BLUE}20` : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: step.locked ? "default" : "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              {step.active && !step.locked && <Check size={10} style={{ color: BLUE }} />}
                              {step.locked && <Lock size={10} style={{ color: TEXT_DIM }} />}
                            </div>

                            {/* Label */}
                            <div
                              onClick={() => !step.locked && handleToggleStep(step.key)}
                              style={{ cursor: step.locked ? "default" : "pointer" }}
                            >
                              <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{step.label}</span>
                              {step.channelSpecific && (
                                <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `${PURPLE}15`, color: PURPLE, fontWeight: 500 }}>
                                  {channel.channelName} only
                                </span>
                              )}
                              {step.description && (
                                <div style={{ color: TEXT_DIM, fontSize: 10, marginTop: 2 }}>{step.description}</div>
                              )}
                            </div>

                            {/* Value */}
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <input
                                type="number"
                                value={step.value}
                                step={step.type === "multiplier" ? 0.05 : 1}
                                min={0}
                                onChange={(e) => handleChangeStepValue(step.key, Number(e.target.value))}
                                style={{
                                  width: 60, padding: "4px 8px", background: INPUT_BG, border: `1px solid ${BORDER}`,
                                  borderRadius: 4, color: step.active ? BLUE : TEXT_DIM, fontSize: 13, fontWeight: 600,
                                  textAlign: "center", outline: "none",
                                }}
                                onFocus={(e) => (e.currentTarget.style.borderColor = `${BLUE}40`)}
                                onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
                              />
                              <span style={{ color: TEXT_DIM, fontSize: 11 }}>{step.type === "multiplier" ? "×" : "%"}</span>
                            </div>

                            {/* Impact indicator */}
                            <div style={{ textAlign: "right" }}>
                              {step.active && step.type === "discount" && (
                                <span style={{ color: RED, fontSize: 10, fontWeight: 500 }}>−{step.value}%</span>
                              )}
                              {step.active && step.type === "multiplier" && (
                                <span style={{ color: GREEN, fontSize: 10, fontWeight: 500 }}>+{Math.round((step.value - 1) * 100)}%</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Save button — only shows when dirty */}
                      {hasUnsavedChanges && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                          <button onClick={handleSaveSteps} style={{
                            padding: "8px 20px", borderRadius: 6, border: "none",
                            background: BLUE, color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>
                            {savingSteps ? "Saving..." : "Save Changes"}
                          </button>
                          <button onClick={() => setEditedSteps(null)} style={{
                            padding: "8px 16px", borderRadius: 6, border: `1px solid ${BORDER}`,
                            background: "transparent", color: TEXT_DIM, fontSize: 12, cursor: "pointer",
                          }}>
                            Discard
                          </button>
                          <span style={{ color: AMBER, fontSize: 10, fontWeight: 500 }}>Unsaved changes</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Live Simulator */}
                    <div style={{ background: BG_PAGE, borderRadius: 8, border: `1px solid ${BORDER}`, padding: 16 }}>
                      <div style={{ color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 12 }}>
                        Live Preview — £{simPmsRate} PMS Rate
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <span style={{ color: TEXT_DIM, fontSize: 11 }}>PMS Rate £</span>
                        <input
                          type="number" value={simPmsRate}
                          onChange={(e) => setSimPmsRate(Number(e.target.value) || 0)}
                          style={{
                            width: 70, padding: "4px 8px", background: INPUT_BG, border: `1px solid ${BORDER}`,
                            borderRadius: 4, color: TEXT, fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none",
                          }}
                        />
                      </div>
                      {(() => {
                        const result = calcWaterfall(activeSteps, simPmsRate);
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                            {result.steps.map((s, i) => (
                              <div key={i} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "6px 0",
                                borderBottom: i < result.steps.length - 1 ? `1px solid ${BORDER}` : "none",
                                opacity: s.active ? 1 : 0.3,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ color: s.active ? TEXT : TEXT_DIM, fontSize: 11 }}>{s.label}</span>
                                  <span style={{ color: s.active ? BLUE : TEXT_DIM, fontSize: 10, fontWeight: 600 }}>{s.discount}</span>
                                </div>
                                <span style={{
                                  color: s.active ? TEXT : TEXT_DIM,
                                  fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                                }}>
                                  £{s.rate.toFixed(2)}
                                </span>
                              </div>
                            ))}
                            <div style={{ borderTop: `2px solid ${BLUE}30`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                              <span style={{ color: BLUE, fontSize: 12, fontWeight: 700 }}>Guest Sees</span>
                              <span style={{ color: BLUE, fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>£{result.final.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Hotel Override Section */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={14} style={{ color: AMBER }} />
                    <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Per-Hotel Overrides</span>
                    <span style={{ color: TEXT_DIM, fontSize: 11 }}>— properties that deviate from the {channel.channelName} default</span>
                  </div>
                  <button style={{
                    padding: "6px 14px", borderRadius: 6, border: `1px solid ${BORDER}`,
                    background: INPUT_BG, color: TEXT_MID, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                    + Add Override
                  </button>
                </div>

                {overriddenHotels.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <Check size={20} style={{ color: GREEN, margin: "0 auto 8px" }} />
                    <div style={{ color: TEXT_DIM, fontSize: 12 }}>All hotels use the portfolio default for {channel.channelName}</div>
                  </div>
                ) : (
                  <div>
                    {allHotels.map((hotel) => {
                      const override = overriddenHotels.find(o => o.hotelId === hotel.id);
                      const hasOverride = !!override;
                      const isExpanded = expandedHotel === hotel.id;
                      const effectiveSteps = getEffectiveSteps(channel, hotel.id, overrides);
                      const waterfallResult = calcWaterfall(effectiveSteps, simPmsRate);

                      return (
                        <div key={hotel.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                          <div
                            onClick={() => hasOverride && setExpandedHotel(isExpanded ? null : hotel.id)}
                            style={{
                              display: "grid", gridTemplateColumns: "24px 1fr auto 120px",
                              padding: "10px 20px", alignItems: "center", gap: 12,
                              cursor: hasOverride ? "pointer" : "default",
                              transition: "background 0.12s",
                            }}
                            onMouseEnter={(e) => hasOverride && (e.currentTarget.style.background = "rgba(57,189,248,0.025)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {/* Icon */}
                            {hasOverride ? (
                              isExpanded ? <ChevronDown size={14} style={{ color: TEXT_DIM }} /> : <ChevronRight size={14} style={{ color: TEXT_DIM }} />
                            ) : (
                              <Check size={14} style={{ color: GREEN, opacity: 0.5 }} />
                            )}

                            {/* Hotel name + override badges */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: hasOverride ? TEXT : TEXT_DIM, fontSize: 12, fontWeight: hasOverride ? 500 : 400 }}>
                                {hotel.name}
                              </span>
                              {hasOverride && override && (
                                <div style={{ display: "flex", gap: 4 }}>
                                  {Object.entries(override.overrides).map(([key, val]) => {
                                    const stepDef = channel.steps.find(s => s.key === key);
                                    if (!stepDef) return null;
                                    const isDisabled = val.active === false;
                                    return (
                                      <span key={key} style={{
                                        fontSize: 9, padding: "2px 6px", borderRadius: 3,
                                        background: isDisabled ? `${RED}12` : `${AMBER}12`,
                                        color: isDisabled ? RED : AMBER,
                                        fontWeight: 500,
                                      }}>
                                        {isDisabled ? `✕ ${stepDef.label}` : `${stepDef.label} → ${val.value}${stepDef.type === "multiplier" ? "x" : "%"}`}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Status */}
                            <span style={{
                              fontSize: 10, fontWeight: 500,
                              color: hasOverride ? AMBER : GREEN,
                            }}>
                              {hasOverride ? "Custom" : "Default"}
                            </span>

                            {/* Effective final rate */}
                            <div style={{ textAlign: "right" }}>
                              <span style={{ color: BLUE, fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
                                £{waterfallResult.final.toFixed(2)}
                              </span>
                              <span style={{ color: TEXT_DIM, fontSize: 10, marginLeft: 4 }}>/ £{simPmsRate}</span>
                            </div>
                          </div>

                          {/* Expanded: full waterfall for this hotel */}
                          {isExpanded && hasOverride && (() => {
                            const defaultResult = calcWaterfall(channel.steps, simPmsRate);
                            let runningRate = simPmsRate;
                            return (
                            <div style={{ padding: "0 20px 16px 56px" }}>
                              <div style={{ background: BG_PAGE, borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>

                                {/* Column header */}
                                <div style={{
                                  display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                  padding: "8px 16px", gap: 8,
                                  background: "#222", borderBottom: `1px solid ${BORDER}`,
                                }}>
                                  <span />
                                  <span style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Step</span>
                                  <span style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "center" }}>Default</span>
                                  <span style={{ color: AMBER, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "center" }}>This Hotel</span>
                                  <span style={{ color: TEXT_DIM, fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "right" }}>Running Total</span>
                                </div>

                                {/* Steps */}
                                {effectiveSteps.map((step, i) => {
                                  const defaultStep = channel.steps.find(s => s.key === step.key)!;
                                  const isOverridden = step.value !== defaultStep.value || step.active !== defaultStep.active;
                                  const isDisabledOverride = isOverridden && !step.active;

                                  // Calculate running total
                                  if (step.active) {
                                    if (step.type === "multiplier") runningRate = runningRate * step.value;
                                    else runningRate = runningRate * (1 - step.value / 100);
                                  }

                                  const defaultSuffix = defaultStep.type === "multiplier" ? "×" : "%";
                                  const stepSuffix = step.type === "multiplier" ? "×" : "%";

                                  return (
                                    <div key={step.key} style={{
                                      display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                      padding: "10px 16px", gap: 8, alignItems: "center",
                                      borderBottom: i < effectiveSteps.length - 1 ? `1px solid ${BORDER}` : "none",
                                      background: isOverridden ? `${AMBER}04` : "transparent",
                                    }}>
                                      {/* Status icon */}
                                      <div>
                                        {isDisabledOverride ? (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: `${RED}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ color: RED, fontSize: 11, fontWeight: 700 }}>✕</span>
                                          </div>
                                        ) : isOverridden ? (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: `${AMBER}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Pencil size={9} style={{ color: AMBER }} />
                                          </div>
                                        ) : step.active ? (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: `${GREEN}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Check size={9} style={{ color: GREEN }} />
                                          </div>
                                        ) : (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: INPUT_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ color: TEXT_DIM, fontSize: 9 }}>—</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Label */}
                                      <div>
                                        <span style={{ color: step.active ? TEXT : TEXT_DIM, fontSize: 12, fontWeight: 500 }}>{step.label}</span>
                                        {isDisabledOverride && (
                                          <span style={{ color: RED, fontSize: 10, marginLeft: 8 }}>Disabled for this hotel</span>
                                        )}
                                      </div>

                                      {/* Default value */}
                                      <div style={{ textAlign: "center" }}>
                                        <span style={{
                                          color: isOverridden ? TEXT_DIM : TEXT_MID,
                                          fontSize: 12, fontWeight: 500,
                                          textDecoration: isOverridden ? "line-through" : "none",
                                          opacity: isOverridden ? 0.5 : 1,
                                        }}>
                                          {defaultStep.active
                                            ? `${defaultStep.value}${defaultSuffix}`
                                            : "off"
                                          }
                                        </span>
                                      </div>

                                      {/* This hotel value */}
                                      <div style={{ textAlign: "center" }}>
                                        {isOverridden ? (
                                          <span style={{
                                            color: isDisabledOverride ? RED : AMBER,
                                            fontSize: 13, fontWeight: 700,
                                            padding: "2px 8px", borderRadius: 4,
                                            background: isDisabledOverride ? `${RED}10` : `${AMBER}10`,
                                          }}>
                                            {step.active ? `${step.value}${stepSuffix}` : "off"}
                                          </span>
                                        ) : (
                                          <span style={{ color: TEXT_DIM, fontSize: 11 }}>—</span>
                                        )}
                                      </div>

                                      {/* Running total */}
                                      <div style={{ textAlign: "right" }}>
                                        {step.active ? (
                                          <span style={{ color: TEXT, fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
                                            £{runningRate.toFixed(2)}
                                          </span>
                                        ) : (
                                          <span style={{ color: TEXT_DIM, fontSize: 11 }}>—</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Footer: final rate comparison */}
                                <div style={{
                                  display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                  padding: "12px 16px", gap: 8, alignItems: "center",
                                  borderTop: `2px solid ${BORDER}`, background: `${AMBER}06`,
                                }}>
                                  <span />
                                  <span style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>Guest Sees</span>
                                  <div style={{ textAlign: "center" }}>
                                    <span style={{ color: TEXT_DIM, fontSize: 12, fontWeight: 500, fontFamily: "monospace", textDecoration: "line-through", opacity: 0.5 }}>
                                      £{defaultResult.final.toFixed(2)}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <span style={{ color: AMBER, fontSize: 14, fontWeight: 700, fontFamily: "monospace" }}>
                                      £{waterfallResult.final.toFixed(2)}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    {(() => {
                                      const diff = waterfallResult.final - defaultResult.final;
                                      return (
                                        <span style={{ color: diff > 0 ? GREEN : diff < 0 ? RED : TEXT_DIM, fontSize: 11, fontWeight: 600 }}>
                                          {diff > 0 ? "+" : ""}{diff.toFixed(2)} ({diff > 0 ? "+" : ""}{((diff / defaultResult.final) * 100).toFixed(1)}%)
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>

                              </div>
                            </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </>)}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* VIEW 2: MATRIX — All Channels × Hotels     */}
        {/* ═══════════════════════════════════════════ */}
        {viewMode === "matrix" && (
          <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Eye size={14} style={{ color: BLUE }} />
              <span style={{ color: TEXT, fontSize: 13, fontWeight: 600 }}>Sell Rate Matrix</span>
              <span style={{ color: TEXT_DIM, fontSize: 11 }}>— what the guest sees at £{simPmsRate} PMS rate</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: TEXT_DIM, fontSize: 11 }}>PMS Rate £</span>
                <input type="number" value={simPmsRate} onChange={(e) => setSimPmsRate(Number(e.target.value) || 0)}
                  style={{ width: 60, padding: "4px 8px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 4, color: TEXT, fontSize: 12, fontWeight: 600, textAlign: "center", outline: "none" }} />
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 16px", color: TEXT_DIM, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "left", position: "sticky", left: 0, background: "#222", zIndex: 1, borderBottom: `1px solid ${BORDER}`, minWidth: 180 }}>Hotel</th>
                    {channels.map(ch => (
                      <th key={ch.slug} style={{ padding: "10px 12px", color: TEXT_MID, fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "center", borderBottom: `1px solid ${BORDER}`, minWidth: 100 }}>
                        {ch.channelName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allHotels.map((hotel, ri) => (
                    <tr key={hotel.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <td style={{ padding: "8px 16px", fontSize: 12, color: TEXT, fontWeight: 500, position: "sticky", left: 0, background: ri % 2 === 1 ? "#1c1c1b" : CARD_BG, zIndex: 1, borderRight: `1px solid ${BORDER}` }}>
                        {hotel.name}
                      </td>
                      {channels.map(ch => {
                        const effectiveSteps = getEffectiveSteps(ch, hotel.id, allOverrides);
                        const result = calcWaterfall(effectiveSteps, simPmsRate);
                        const hasOverride = allOverrides.some(o => o.hotelId === hotel.id && o.channelSlug === ch.slug);
                        return (
                          <td key={ch.slug} style={{
                            padding: "8px 12px", textAlign: "center",
                            background: ri % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                              <span style={{
                                color: hasOverride ? AMBER : BLUE,
                                fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                              }}>
                                £{result.final.toFixed(0)}
                              </span>
                              {hasOverride && <Pencil size={8} style={{ color: AMBER, opacity: 0.7 }} />}
                            </div>
                            <div style={{ color: TEXT_DIM, fontSize: 9, marginTop: 2 }}>
                              {Math.round((1 - result.final / simPmsRate) * -100)}% vs PMS
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* VIEW 3: SIMULATOR — Side by side channels  */}
        {/* ═══════════════════════════════════════════ */}
        {viewMode === "simulator" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <span style={{ color: TEXT_DIM, fontSize: 12 }}>PMS Rate £</span>
              <input type="number" value={simPmsRate} onChange={(e) => setSimPmsRate(Number(e.target.value) || 0)}
                style={{ width: 80, padding: "6px 10px", background: INPUT_BG, border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT, fontSize: 14, fontWeight: 600, textAlign: "center", outline: "none" }} />
              <span style={{ color: TEXT_DIM, fontSize: 11 }}>Compare what the guest pays across all channels at this PMS rate</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${channels.length}, 1fr)`, gap: 12 }}>
              {channels.map(ch => {
                const result = calcWaterfall(ch.steps, simPmsRate);
                const effectivePct = simPmsRate > 0 ? Math.round((result.final / simPmsRate) * 100) : 0;
                return (
                  <div key={ch.slug} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                      <div style={{ color: TEXT, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ch.channelName}</div>
                      <div style={{ color: BLUE, fontSize: 24, fontWeight: 700, fontFamily: "monospace" }}>£{result.final.toFixed(2)}</div>
                      <div style={{ color: TEXT_DIM, fontSize: 10, marginTop: 4 }}>{effectivePct}% of PMS rate</div>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      {result.steps.map((s, i) => (
                        <div key={i} style={{
                          display: "flex", justifyContent: "space-between", padding: "4px 0",
                          opacity: s.active ? 1 : 0.25, fontSize: 10,
                          borderBottom: i < result.steps.length - 1 ? `1px solid ${BORDER}` : "none",
                        }}>
                          <span style={{ color: TEXT_MID }}>{s.label}</span>
                          <span style={{ color: s.active ? TEXT : TEXT_DIM, fontFamily: "monospace", fontWeight: 600 }}>£{s.rate.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Bar showing how much margin is left */}
                    <div style={{ padding: "0 14px 14px" }}>
                      <div style={{ height: 4, borderRadius: 2, background: INPUT_BG, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2, width: `${effectivePct}%`,
                          background: effectivePct > 60 ? GREEN : effectivePct > 40 ? AMBER : RED,
                          transition: "width 0.3s",
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Add Channel Modal */}
      {showAddChannel && (
        <AddChannelModal
          onClose={() => setShowAddChannel(false)}
          onSave={handleAddChannel}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// ADD CHANNEL MODAL
// ══════════════════════════════════════════

const CHANNEL_TYPES = [
  { key: "ota", label: "OTA" },
  { key: "wholesaler", label: "Wholesaler" },
  { key: "flash_sale", label: "Flash Sale" },
  { key: "direct", label: "Direct" },
  { key: "meta", label: "Meta" },
];

const AGREEMENT_TYPES = [
  { key: "group", label: "Group" },
  { key: "individual", label: "Individual" },
  { key: "direct", label: "Direct" },
];

const PAYMENT_METHODS = [
  { key: "guest_pays", label: "Guest Pays at Hotel" },
  { key: "vcc", label: "VCC" },
  { key: "bacs", label: "BACS" },
];

function AddChannelModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (data: { name: string; channel_type: string; agreement_type: string; commission_pct: number | null; payment_method: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [channelType, setChannelType] = useState("ota");
  const [agreement, setAgreement] = useState("group");
  const [payment, setPayment] = useState("vcc");
  const [commission, setCommission] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), channel_type: channelType, agreement_type: agreement, commission_pct: commission === "" ? null : commission, payment_method: payment });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const BG = "#1a1a1a";
  const BD = "#2a2a2a";
  const INP = "#2C2C2C";
  const BL = "#39BDF8";
  const TX = "#e5e5e5";
  const TM = "#9ca3af";
  const TD = "#6b7280";

  function ToggleGroup({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
    return (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {options.map(o => (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            padding: "6px 14px", borderRadius: 6,
            border: `1px solid ${value === o.key ? `${BL}40` : BD}`,
            background: value === o.key ? `${BL}12` : "transparent",
            color: value === o.key ? BL : TD,
            fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 480, background: BG, border: `1px solid ${BD}`, borderRadius: 10,
        zIndex: 61, boxShadow: "0 0 20px rgba(57,189,248,0.08), 0 12px 40px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${BL}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Globe size={16} style={{ color: BL }} />
          </div>
          <div>
            <div style={{ color: TX, fontSize: 14, fontWeight: 600 }}>Add Channel</div>
            <div style={{ color: TM, fontSize: 11, marginTop: 2 }}>New distribution partner</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <div style={{ color: TD, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 6 }}>Channel Name</div>
            <input
              autoFocus
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Secret Escapes, Miki Travel..."
              style={{
                width: "100%", padding: "10px 12px", background: INP, border: `1px solid ${BD}`,
                borderRadius: 6, color: TX, fontSize: 14, fontWeight: 600, outline: "none",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = `${BL}40`)}
              onBlur={(e) => (e.currentTarget.style.borderColor = BD)}
            />
          </div>

          {/* Channel Type */}
          <div>
            <div style={{ color: TD, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 6 }}>Channel Type</div>
            <ToggleGroup options={CHANNEL_TYPES} value={channelType} onChange={setChannelType} />
          </div>

          {/* Agreement + Payment — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ color: TD, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 6 }}>Agreement</div>
              <ToggleGroup options={AGREEMENT_TYPES} value={agreement} onChange={setAgreement} />
            </div>
            <div>
              <div style={{ color: TD, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 6 }}>Payment</div>
              <ToggleGroup options={PAYMENT_METHODS} value={payment} onChange={setPayment} />
            </div>
          </div>

          {/* Commission */}
          <div>
            <div style={{ color: TD, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "-0.025em", marginBottom: 6 }}>Commission</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number" min={0} max={50} value={commission}
                onChange={(e) => setCommission(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="—"
                style={{
                  width: 70, padding: "6px 10px", background: INP, border: `1px solid ${BD}`,
                  borderRadius: 6, color: TX, fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none",
                }}
              />
              <span style={{ color: TD, fontSize: 11 }}>%</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: `1px solid ${BD}` }}>
          <button onClick={onClose} style={{
            height: 36, padding: "0 18px", borderRadius: 6, border: `1px solid ${BD}`,
            background: INP, color: TX, fontSize: 12, cursor: "pointer",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>Cancel</button>
          <button onClick={handleSubmit} style={{
            height: 36, padding: "0 20px", borderRadius: 6, border: "none",
            background: name.trim() && !saving ? BL : `${BL}30`,
            color: name.trim() && !saving ? "#000" : TD,
            fontSize: 12, fontWeight: 600, cursor: name.trim() ? "pointer" : "default",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}>
            {saving ? "Creating..." : "Create Channel"}
          </button>
        </div>
      </div>
    </>
  );
}
