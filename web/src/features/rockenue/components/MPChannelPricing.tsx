import { useState, useMemo } from "react";
import {
  Layers, Globe, ChevronDown, ChevronRight, Check, Pencil, Lock,
  Eye, Zap, Building2, Bell, Search, Info, RotateCcw,
} from "lucide-react";

// ── MP Channel Pricing — Rockenue style mockup ──
// Mock data. Not wired. Design exercise.

interface MPChannelPricingProps { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868", teal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
  amber: "#f59e0b", orange: "#f97316", purple: "#8b5cf6", blue: "#3b82f6",
};

const curr = "£";

// ══════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════

interface WaterfallStep {
  key: string;
  label: string;
  type: "multiplier" | "discount";
  value: number;
  active: boolean;
  locked?: boolean;
  channelSpecific?: boolean;
  description?: string;
}

interface MockChannel {
  slug: string;
  name: string;
  channelType: string;
  agreement: string;
  commission: number | null;
  paymentMethod: string;
  steps: WaterfallStep[];
}

interface MockOverride {
  hotelName: string;
  channelSlug: string;
  overrides: Record<string, { value?: number; active?: boolean }>;
}

const MOCK_CHANNELS: MockChannel[] = [
  {
    slug: "booking-com", name: "Booking.com", channelType: "OTA", agreement: "Group", commission: 18, paymentMethod: "VCC",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.42, active: true, locked: true },
      { key: "nrf", label: "Non-Refundable", type: "discount", value: 10, active: true, description: "Applied to NRF rate plan" },
      { key: "genius", label: "Genius Programme", type: "discount", value: 15, active: true, channelSpecific: true, description: "Loyalty discount — Genius Level 2+" },
      { key: "campaign", label: "Long Campaign", type: "discount", value: 30, active: true, description: "Seasonal campaign discount" },
      { key: "mobile", label: "Mobile Rate", type: "discount", value: 10, active: false, description: "Overridden by Campaign when active" },
    ],
  },
  {
    slug: "expedia", name: "Expedia", channelType: "OTA", agreement: "Group", commission: 20, paymentMethod: "VCC",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.35, active: true, locked: true },
      { key: "nrf", label: "Non-Refundable", type: "discount", value: 10, active: true },
      { key: "member_deal", label: "Member Deal", type: "discount", value: 10, active: true, channelSpecific: true, description: "Expedia member pricing" },
    ],
  },
  {
    slug: "hostelworld", name: "Hostelworld", channelType: "OTA", agreement: "Individual", commission: 15, paymentMethod: "Guest Pays",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.18, active: true, locked: true },
    ],
  },
  {
    slug: "direct", name: "Direct (Distributor)", channelType: "Direct", agreement: "Direct", commission: null, paymentMethod: "Guest Pays",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.00, active: true, locked: true },
      { key: "direct_discount", label: "Best Price Guarantee", type: "discount", value: 10, active: true, description: "10% below best OTA rate" },
    ],
  },
  {
    slug: "hrs", name: "HRS", channelType: "Wholesaler", agreement: "Group", commission: 22, paymentMethod: "BACS",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.30, active: true, locked: true },
      { key: "corporate", label: "Corporate Discount", type: "discount", value: 8, active: true },
    ],
  },
];

const MOCK_HOTELS = [
  "The W14 Hotel", "Jubilee Hotel Victoria", "The Melita", "Elysee Hyde Park",
  "Camden Suites", "Vilenza Hotel", "The Whitechapel Hotel", "Notting Hill House Hotel",
];

const MOCK_OVERRIDES: MockOverride[] = [
  { hotelName: "The W14 Hotel", channelSlug: "booking-com", overrides: { genius: { value: 20 }, campaign: { value: 35 } } },
  { hotelName: "Camden Suites", channelSlug: "booking-com", overrides: { genius: { active: false } } },
  { hotelName: "The W14 Hotel", channelSlug: "expedia", overrides: { member_deal: { value: 15 } } },
  { hotelName: "The Melita", channelSlug: "booking-com", overrides: { campaign: { value: 25 } } },
];

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
    } else {
      rate = rate * (1 - step.value / 100);
      result.push({ label: step.label, rate, discount: `−${step.value}%`, active: true });
    }
  }
  return { steps: result, final: Math.round(rate * 100) / 100 };
}

function getEffectiveSteps(channel: MockChannel, hotelName: string, overrides: MockOverride[]): WaterfallStep[] {
  const ov = overrides.find(o => o.hotelName === hotelName && o.channelSlug === channel.slug);
  if (!ov) return channel.steps;
  return channel.steps.map(step => {
    const override = ov.overrides[step.key];
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

export function MPChannelPricing({ activeView, onNavigate }: MPChannelPricingProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("channels");
  const [selectedChannel, setSelectedChannel] = useState("booking-com");
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);
  const [simPmsRate, setSimPmsRate] = useState(185);
  const [showChannelInfo, setShowChannelInfo] = useState(false);

  const channel = MOCK_CHANNELS.find(c => c.slug === selectedChannel)!;
  const channelOverrides = MOCK_OVERRIDES.filter(o => o.channelSlug === selectedChannel);

  return (
    <div style={{ background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>Portfolio</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} color={R.textDim} style={{ position: "absolute", left: 10 }} />
              <input style={{ background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 10px 6px 30px", fontSize: 12, color: R.text, outline: "none", width: 180 }} placeholder="Search channels..." />
            </div>
            <Bell size={16} color={R.textMid} />
          </div>
        </div>

        <div style={{ padding: "28px 32px" }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Distribution</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <Layers size={22} color={R.teal} />
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: R.accent, margin: 0, letterSpacing: -0.5 }}>Channel Pricing</h1>
                </div>
                <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>OTA discount stacks — portfolio defaults & per-hotel overrides</p>
              </div>

              {/* View mode toggle */}
              <div style={{ display: "flex", alignItems: "center", background: R.cardRaised, borderRadius: 8, border: `1px solid ${R.border}`, overflow: "hidden" }}>
                {([
                  { key: "channels" as ViewMode, label: "By Channel", icon: Globe },
                  { key: "matrix" as ViewMode, label: "Matrix", icon: Eye },
                  { key: "simulator" as ViewMode, label: "Simulator", icon: Zap },
                ] as const).map(v => {
                  const Icon = v.icon;
                  const isActive = viewMode === v.key;
                  return (
                    <button key={v.key} onClick={() => setViewMode(v.key)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", border: "none",
                      background: isActive ? `${R.teal}12` : "transparent",
                      color: isActive ? R.teal : R.textDim,
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      borderRight: `1px solid ${R.border}`,
                      transition: "all 0.15s",
                    }}>
                      <Icon size={13} />
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════ */}
          {/* VIEW 1: BY CHANNEL                         */}
          {/* ═══════════════════════════════════════════ */}
          {viewMode === "channels" && (
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>

              {/* Left: Channel List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.textDim, textTransform: "uppercase", marginBottom: 8, padding: "0 12px" }}>Channels</div>
                {MOCK_CHANNELS.map(ch => {
                  const isActive = selectedChannel === ch.slug;
                  const chOverrideCount = MOCK_OVERRIDES.filter(o => o.channelSlug === ch.slug).length;
                  return (
                    <button key={ch.slug} onClick={() => { setSelectedChannel(ch.slug); setShowChannelInfo(false); setExpandedHotel(null); }} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: 8, border: "none",
                      background: isActive ? `${R.teal}08` : "transparent",
                      color: isActive ? R.accent : R.text, cursor: "pointer",
                      transition: "all 0.12s", textAlign: "left",
                      borderLeft: isActive ? `2px solid ${R.teal}` : "2px solid transparent",
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{ch.name}</span>
                          {chOverrideCount > 0 && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${R.amber}15`, color: R.amber, fontWeight: 600, flexShrink: 0 }}>
                              {chOverrideCount}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                          <span style={{ fontSize: 10, color: R.textDim }}>{ch.channelType}</span>
                          <span style={{ fontSize: 10, color: R.textDim }}>·</span>
                          <span style={{ fontSize: 10, color: R.textDim }}>{ch.commission != null ? `${ch.commission}%` : "—"}</span>
                          <span style={{ fontSize: 10, color: R.textDim }}>·</span>
                          <span style={{ fontSize: 10, color: R.textDim }}>{ch.paymentMethod}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", marginTop: 8,
                  borderRadius: 8, border: `1px dashed ${R.border}`, background: "transparent",
                  color: R.textDim, fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                }}>
                  + Add Channel
                </button>
              </div>

              {/* Right: Channel Detail */}
              <div>
                {/* Default Waterfall Card */}
                <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
                  {/* Header */}
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Globe size={14} style={{ color: R.teal }} />
                      <span style={{ color: R.accent, fontSize: 14, fontWeight: 600 }}>{channel.name}</span>
                      <span style={{ color: R.textDim, fontSize: 11, padding: "2px 8px", borderRadius: 4, background: R.cardRaised }}>Portfolio Default</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: R.textDim, fontSize: 11 }}>
                        {channelOverrides.length > 0 ? `${MOCK_HOTELS.length - channelOverrides.length} using defaults` : `All ${MOCK_HOTELS.length} hotels`}
                      </span>
                      {channelOverrides.length > 0 && (
                        <span style={{ color: R.amber, fontSize: 11, fontWeight: 600 }}>{channelOverrides.length} override{channelOverrides.length !== 1 ? "s" : ""}</span>
                      )}
                      <button
                        onClick={() => setShowChannelInfo(!showChannelInfo)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                          borderRadius: 5, border: `1px solid ${showChannelInfo ? `${R.teal}30` : R.border}`,
                          background: showChannelInfo ? `${R.teal}08` : "transparent",
                          color: showChannelInfo ? R.teal : R.textDim,
                          fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        <Info size={10} /> Details
                        <ChevronDown size={10} style={{ transform: showChannelInfo ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Channel Info */}
                  {showChannelInfo && (
                    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, background: R.darkBand }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Agreement</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: R.accent }}>{channel.agreement}</span>
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${R.teal}12`, color: R.teal }}>{channel.channelType}</span>
                          </div>
                          <div style={{ fontSize: 11, color: R.textMid, marginTop: 4 }}>Pricing: Net</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Financials</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: channel.commission && channel.commission >= 20 ? R.amber : R.accent }}>
                              {channel.commission != null ? `${channel.commission}%` : "—"}
                            </span>
                            <span style={{ fontSize: 10, color: R.textDim }}>commission</span>
                          </div>
                          <div style={{ fontSize: 11, color: R.textMid, marginTop: 4 }}>Payment: {channel.paymentMethod}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Contract</div>
                          <div style={{ fontSize: 12, color: R.textMid }}>Expires Dec 2026</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Contact</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: R.accent }}>Account Manager</div>
                          <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>am@{channel.slug}.com</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Waterfall Steps + Live Preview */}
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
                      {/* Left: Settings */}
                      <div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {channel.steps.map((step, i) => (
                            <div key={step.key} style={{
                              display: "grid", gridTemplateColumns: "24px 1fr 90px 60px",
                              alignItems: "center", padding: "8px 0",
                              opacity: step.active ? 1 : 0.4,
                              borderBottom: i < channel.steps.length - 1 ? `1px solid ${R.sep}` : "none",
                            }}>
                              {/* Toggle */}
                              <div style={{
                                width: 16, height: 16, borderRadius: 4,
                                border: step.locked ? "none" : `1px solid ${step.active ? R.teal : R.border}`,
                                background: step.locked ? "transparent" : step.active ? `${R.teal}20` : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: step.locked ? "default" : "pointer",
                              }}>
                                {step.active && !step.locked && <Check size={10} style={{ color: R.teal }} />}
                                {step.locked && <Lock size={10} style={{ color: R.textDim }} />}
                              </div>

                              {/* Label */}
                              <div>
                                <span style={{ color: R.accent, fontSize: 12, fontWeight: 500 }}>{step.label}</span>
                                {step.channelSpecific && (
                                  <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, background: `${R.purple}15`, color: R.purple, fontWeight: 500 }}>
                                    {channel.name} only
                                  </span>
                                )}
                                {step.description && (
                                  <div style={{ color: R.textDim, fontSize: 10, marginTop: 2 }}>{step.description}</div>
                                )}
                              </div>

                              {/* Value */}
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{
                                  width: 60, padding: "4px 8px", background: R.cardRaised, border: `1px solid ${R.border}`,
                                  borderRadius: 4, color: step.active ? R.teal : R.textDim, fontSize: 13, fontWeight: 600,
                                  textAlign: "center",
                                }}>
                                  {step.value}
                                </div>
                                <span style={{ color: R.textDim, fontSize: 11 }}>{step.type === "multiplier" ? "×" : "%"}</span>
                              </div>

                              {/* Impact */}
                              <div style={{ textAlign: "right" }}>
                                {step.active && step.type === "discount" && (
                                  <span style={{ color: R.red, fontSize: 10, fontWeight: 500 }}>−{step.value}%</span>
                                )}
                                {step.active && step.type === "multiplier" && (
                                  <span style={{ color: R.green, fontSize: 10, fontWeight: 500 }}>+{Math.round((step.value - 1) * 100)}%</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right: Live Preview */}
                      <div style={{ background: R.darkBand, borderRadius: 8, border: `1px solid ${R.border}`, padding: 16 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 12 }}>
                          Live Preview — {curr}{simPmsRate} PMS Rate
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                          <span style={{ color: R.textDim, fontSize: 11 }}>PMS Rate {curr}</span>
                          <input
                            type="number" value={simPmsRate}
                            onChange={e => setSimPmsRate(Number(e.target.value) || 0)}
                            style={{
                              width: 70, padding: "4px 8px", background: R.cardRaised, border: `1px solid ${R.border}`,
                              borderRadius: 4, color: R.accent, fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none",
                            }}
                          />
                        </div>
                        {(() => {
                          const result = calcWaterfall(channel.steps, simPmsRate);
                          return (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              {result.steps.map((s, i) => (
                                <div key={i} style={{
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  padding: "6px 0",
                                  borderBottom: i < result.steps.length - 1 ? `1px solid ${R.sep}` : "none",
                                  opacity: s.active ? 1 : 0.3,
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: s.active ? R.text : R.textDim, fontSize: 11 }}>{s.label}</span>
                                    <span style={{ color: s.active ? R.teal : R.textDim, fontSize: 10, fontWeight: 600 }}>{s.discount}</span>
                                  </div>
                                  <span style={{ color: s.active ? R.accent : R.textDim, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                    {curr}{s.rate.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              <div style={{ borderTop: `2px solid ${R.teal}30`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: R.teal, fontSize: 12, fontWeight: 700 }}>Guest Sees</span>
                                <span style={{ color: R.teal, fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{curr}{result.final.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-Hotel Overrides */}
                <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Building2 size={14} style={{ color: R.amber }} />
                      <span style={{ color: R.accent, fontSize: 13, fontWeight: 600 }}>Per-Hotel Overrides</span>
                      <span style={{ color: R.textDim, fontSize: 11 }}>— properties that deviate from the {channel.name} default</span>
                    </div>
                    <button style={{
                      padding: "6px 14px", borderRadius: 6, border: `1px solid ${R.border}`,
                      background: R.cardRaised, color: R.textMid, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    }}>
                      + Add Override
                    </button>
                  </div>

                  {MOCK_HOTELS.map((hotel, hi) => {
                    const override = channelOverrides.find(o => o.hotelName === hotel);
                    const hasOverride = !!override;
                    const isExpanded = expandedHotel === hotel;
                    const effectiveSteps = getEffectiveSteps(channel, hotel, MOCK_OVERRIDES);
                    const waterfallResult = calcWaterfall(effectiveSteps, simPmsRate);
                    const defaultResult = calcWaterfall(channel.steps, simPmsRate);

                    return (
                      <div key={hotel} style={{ borderBottom: hi < MOCK_HOTELS.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                        <div
                          onClick={() => hasOverride && setExpandedHotel(isExpanded ? null : hotel)}
                          style={{
                            display: "grid", gridTemplateColumns: "24px 1fr auto 120px",
                            padding: "10px 20px", alignItems: "center", gap: 12,
                            cursor: hasOverride ? "pointer" : "default",
                            transition: "background 0.12s",
                          }}
                        >
                          {hasOverride ? (
                            isExpanded ? <ChevronDown size={14} style={{ color: R.textDim }} /> : <ChevronRight size={14} style={{ color: R.textDim }} />
                          ) : (
                            <Check size={14} style={{ color: R.green, opacity: 0.5 }} />
                          )}

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: hasOverride ? R.accent : R.textDim, fontSize: 12, fontWeight: hasOverride ? 500 : 400 }}>
                              {hotel}
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
                                      background: isDisabled ? `${R.red}12` : `${R.amber}12`,
                                      color: isDisabled ? R.red : R.amber,
                                      fontWeight: 500,
                                    }}>
                                      {isDisabled ? `✕ ${stepDef.label}` : `${stepDef.label} → ${val.value}${stepDef.type === "multiplier" ? "×" : "%"}`}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <span style={{ fontSize: 10, fontWeight: 500, color: hasOverride ? R.amber : R.green }}>
                            {hasOverride ? "Custom" : "Default"}
                          </span>

                          <div style={{ textAlign: "right" }}>
                            <span style={{ color: R.teal, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                              {curr}{waterfallResult.final.toFixed(2)}
                            </span>
                            <span style={{ color: R.textDim, fontSize: 10, marginLeft: 4 }}>/ {curr}{simPmsRate}</span>
                          </div>
                        </div>

                        {/* Expanded waterfall comparison */}
                        {isExpanded && hasOverride && (() => {
                          let runningRate = simPmsRate;
                          return (
                            <div style={{ padding: "0 20px 16px 56px" }}>
                              <div style={{ background: R.darkBand, borderRadius: 8, border: `1px solid ${R.border}`, overflow: "hidden" }}>
                                {/* Header */}
                                <div style={{
                                  display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                  padding: "8px 16px", gap: 8,
                                  background: R.cardRaised, borderBottom: `1px solid ${R.border}`,
                                }}>
                                  <span />
                                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Step</span>
                                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", textAlign: "center" }}>Default</span>
                                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.amber, textTransform: "uppercase", textAlign: "center" }}>This Hotel</span>
                                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", textAlign: "right" }}>Running Total</span>
                                </div>

                                {effectiveSteps.map((step, i) => {
                                  const defaultStep = channel.steps.find(s => s.key === step.key)!;
                                  const isOverridden = step.value !== defaultStep.value || step.active !== defaultStep.active;
                                  const isDisabledOverride = isOverridden && !step.active;

                                  if (step.active) {
                                    if (step.type === "multiplier") runningRate = runningRate * step.value;
                                    else runningRate = runningRate * (1 - step.value / 100);
                                  }

                                  const suffix = step.type === "multiplier" ? "×" : "%";
                                  const defaultSuffix = defaultStep.type === "multiplier" ? "×" : "%";

                                  return (
                                    <div key={step.key} style={{
                                      display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                      padding: "10px 16px", gap: 8, alignItems: "center",
                                      borderBottom: i < effectiveSteps.length - 1 ? `1px solid ${R.sep}` : "none",
                                      background: isOverridden ? `${R.amber}04` : "transparent",
                                    }}>
                                      <div>
                                        {isDisabledOverride ? (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: `${R.red}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ color: R.red, fontSize: 11, fontWeight: 700 }}>✕</span>
                                          </div>
                                        ) : isOverridden ? (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: `${R.amber}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Pencil size={9} style={{ color: R.amber }} />
                                          </div>
                                        ) : step.active ? (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: `${R.green}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Check size={9} style={{ color: R.green }} />
                                          </div>
                                        ) : (
                                          <div style={{ width: 18, height: 18, borderRadius: 4, background: R.cardRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ color: R.textDim, fontSize: 9 }}>—</span>
                                          </div>
                                        )}
                                      </div>

                                      <div>
                                        <span style={{ color: step.active ? R.accent : R.textDim, fontSize: 12, fontWeight: 500 }}>{step.label}</span>
                                        {isDisabledOverride && <span style={{ color: R.red, fontSize: 10, marginLeft: 8 }}>Disabled for this hotel</span>}
                                      </div>

                                      <div style={{ textAlign: "center" }}>
                                        <span style={{
                                          color: isOverridden ? R.textDim : R.textMid, fontSize: 12, fontWeight: 500,
                                          textDecoration: isOverridden ? "line-through" : "none", opacity: isOverridden ? 0.5 : 1,
                                        }}>
                                          {defaultStep.active ? `${defaultStep.value}${defaultSuffix}` : "off"}
                                        </span>
                                      </div>

                                      <div style={{ textAlign: "center" }}>
                                        {isOverridden ? (
                                          <span style={{
                                            color: isDisabledOverride ? R.red : R.amber,
                                            fontSize: 13, fontWeight: 700,
                                            padding: "2px 8px", borderRadius: 4,
                                            background: isDisabledOverride ? `${R.red}10` : `${R.amber}10`,
                                          }}>
                                            {step.active ? `${step.value}${suffix}` : "off"}
                                          </span>
                                        ) : (
                                          <span style={{ color: R.textDim, fontSize: 11 }}>—</span>
                                        )}
                                      </div>

                                      <div style={{ textAlign: "right" }}>
                                        {step.active ? (
                                          <span style={{ color: R.accent, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{curr}{runningRate.toFixed(2)}</span>
                                        ) : (
                                          <span style={{ color: R.textDim, fontSize: 11 }}>—</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Footer: final comparison */}
                                <div style={{
                                  display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                  padding: "12px 16px", gap: 8, alignItems: "center",
                                  borderTop: `2px solid ${R.border}`, background: `${R.amber}06`,
                                }}>
                                  <span />
                                  <span style={{ color: R.accent, fontSize: 12, fontWeight: 700 }}>Guest Sees</span>
                                  <div style={{ textAlign: "center" }}>
                                    <span style={{ color: R.textDim, fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums", textDecoration: "line-through", opacity: 0.5 }}>
                                      {curr}{defaultResult.final.toFixed(2)}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <span style={{ color: R.amber, fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                      {curr}{waterfallResult.final.toFixed(2)}
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    {(() => {
                                      const diff = waterfallResult.final - defaultResult.final;
                                      return (
                                        <span style={{ color: diff > 0 ? R.green : diff < 0 ? R.red : R.textDim, fontSize: 11, fontWeight: 600 }}>
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
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* VIEW 2: MATRIX                              */}
          {/* ═══════════════════════════════════════════ */}
          {viewMode === "matrix" && (
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", gap: 8 }}>
                <Eye size={14} style={{ color: R.teal }} />
                <span style={{ color: R.accent, fontSize: 13, fontWeight: 600 }}>Sell Rate Matrix</span>
                <span style={{ color: R.textDim, fontSize: 11 }}>— what the guest sees at {curr}{simPmsRate} PMS rate</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: R.textDim, fontSize: 11 }}>PMS Rate {curr}</span>
                  <input type="number" value={simPmsRate} onChange={e => setSimPmsRate(Number(e.target.value) || 0)}
                    style={{ width: 60, padding: "4px 8px", background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 4, color: R.accent, fontSize: 12, fontWeight: 600, textAlign: "center", outline: "none" }} />
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", textAlign: "left", position: "sticky", left: 0, background: R.cardRaised, zIndex: 1, borderBottom: `1px solid ${R.border}`, minWidth: 180 }}>Hotel</th>
                      {MOCK_CHANNELS.map(ch => (
                        <th key={ch.slug} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 600, letterSpacing: 0.5, color: R.textMid, textTransform: "uppercase", textAlign: "center", borderBottom: `1px solid ${R.border}`, minWidth: 110 }}>
                          {ch.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_HOTELS.map((hotel, ri) => (
                      <tr key={hotel} style={{ borderBottom: `1px solid ${R.sep}` }}>
                        <td style={{ padding: "8px 16px", fontSize: 12, color: R.accent, fontWeight: 500, position: "sticky", left: 0, background: ri % 2 === 1 ? R.cardRaised : R.card, zIndex: 1, borderRight: `1px solid ${R.border}` }}>
                          {hotel}
                        </td>
                        {MOCK_CHANNELS.map(ch => {
                          const effectiveSteps = getEffectiveSteps(ch, hotel, MOCK_OVERRIDES);
                          const result = calcWaterfall(effectiveSteps, simPmsRate);
                          const hasOverride = MOCK_OVERRIDES.some(o => o.hotelName === hotel && o.channelSlug === ch.slug);
                          return (
                            <td key={ch.slug} style={{
                              padding: "8px 12px", textAlign: "center",
                              background: ri % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                <span style={{ color: hasOverride ? R.amber : R.teal, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  {curr}{result.final.toFixed(0)}
                                </span>
                                {hasOverride && <Pencil size={8} style={{ color: R.amber, opacity: 0.7 }} />}
                              </div>
                              <div style={{ color: R.textDim, fontSize: 9, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
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
          {/* VIEW 3: SIMULATOR                           */}
          {/* ═══════════════════════════════════════════ */}
          {viewMode === "simulator" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>PMS Rate</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: R.textDim, fontSize: 12 }}>{curr}</span>
                  <input type="number" value={simPmsRate} onChange={e => setSimPmsRate(Number(e.target.value) || 0)}
                    style={{ width: 80, padding: "6px 10px", background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, color: R.accent, fontSize: 14, fontWeight: 600, textAlign: "center", outline: "none" }} />
                </div>
                <span style={{ color: R.textDim, fontSize: 11 }}>Compare what the guest pays across all channels</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${MOCK_CHANNELS.length}, 1fr)`, gap: 12 }}>
                {MOCK_CHANNELS.map(ch => {
                  const result = calcWaterfall(ch.steps, simPmsRate);
                  const effectivePct = simPmsRate > 0 ? Math.round((result.final / simPmsRate) * 100) : 0;
                  return (
                    <div key={ch.slug} style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${R.sep}`, textAlign: "center" }}>
                        <div style={{ color: R.accent, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ch.name}</div>
                        <div style={{ color: R.teal, fontSize: 24, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{curr}{result.final.toFixed(2)}</div>
                        <div style={{ color: R.textDim, fontSize: 10, marginTop: 4 }}>{effectivePct}% of PMS rate</div>
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        {result.steps.map((s, i) => (
                          <div key={i} style={{
                            display: "flex", justifyContent: "space-between", padding: "4px 0",
                            opacity: s.active ? 1 : 0.25, fontSize: 10,
                            borderBottom: i < result.steps.length - 1 ? `1px solid ${R.sep}` : "none",
                          }}>
                            <span style={{ color: R.textMid }}>{s.label}</span>
                            <span style={{ color: s.active ? R.accent : R.textDim, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{curr}{s.rate.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {/* Margin bar */}
                      <div style={{ padding: "0 14px 14px" }}>
                        <div style={{ height: 4, borderRadius: 2, background: R.cardRaised, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 2, width: `${effectivePct}%`,
                            background: effectivePct > 60 ? R.green : effectivePct > 40 ? R.amber : R.red,
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
      </div>
    </div>
  );
}
