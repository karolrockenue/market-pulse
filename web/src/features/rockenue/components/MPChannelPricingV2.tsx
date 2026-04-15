import { useState } from "react";
import {
  Layers, Globe, ChevronDown, ChevronRight, Check, Pencil,
  Building2, Bell, Search, Info, Plus,
} from "lucide-react";
import { MPSidebar } from "./MPSidebar";

/**
 * ── MP Channel Pricing V2 — Rockenue style mockup ──
 * Mock data. Not wired. Design exercise.
 *
 * Same purpose as V1: set up channels, configure global waterfall,
 * manage per-hotel overrides. Different layout approach:
 *   - Horizontal channel tabs instead of sidebar list
 *   - Waterfall as horizontal pipeline (left→right flow)
 *   - Persistent PMS rate input in top bar
 *   - Overrides shown as inline table with editable cells
 *   - No view-mode switching — single scrollable page
 */

interface MPChannelPricingV2Props { activeView: string; onNavigate: (view: string) => void; }

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
  contractExpiry: string | null;
  primaryContact: string | null;
  contactEmail: string | null;
  notes: string | null;
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
    contractExpiry: "2027-03-01", primaryContact: "Sarah Jenkins", contactEmail: "sarah.j@booking.com", notes: "Genius L2 active across portfolio. Long campaign 30% runs until Aug 2026.",
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
    contractExpiry: "2026-12-01", primaryContact: "Tom Reid", contactEmail: "t.reid@expedia.com", notes: null,
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.35, active: true, locked: true },
      { key: "nrf", label: "Non-Refundable", type: "discount", value: 10, active: true },
      { key: "member_deal", label: "Member Deal", type: "discount", value: 10, active: true, channelSpecific: true, description: "Expedia member pricing" },
    ],
  },
  {
    slug: "hostelworld", name: "Hostelworld", channelType: "OTA", agreement: "Individual", commission: 15, paymentMethod: "Guest Pays",
    contractExpiry: null, primaryContact: null, contactEmail: null, notes: null,
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.18, active: true, locked: true },
    ],
  },
  {
    slug: "direct", name: "Direct (Distributor)", channelType: "Direct", agreement: "Direct", commission: null, paymentMethod: "Guest Pays",
    contractExpiry: null, primaryContact: null, contactEmail: null, notes: "Best price guarantee — always 10% below lowest OTA.",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.00, active: true, locked: true },
      { key: "direct_discount", label: "Best Price Guarantee", type: "discount", value: 10, active: true, description: "10% below best OTA rate" },
    ],
  },
  {
    slug: "hrs", name: "HRS", channelType: "Wholesaler", agreement: "Group", commission: 22, paymentMethod: "BACS",
    contractExpiry: "2026-09-15", primaryContact: "Anna Becker", contactEmail: "a.becker@hrs.com", notes: "High commission — review at renewal.",
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
  { hotelName: "Elysee Hyde Park", channelSlug: "hrs", overrides: { corporate: { value: 12 } } },
  { hotelName: "The Whitechapel Hotel", channelSlug: "expedia", overrides: { member_deal: { active: false } } },
];

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function calcWaterfall(steps: WaterfallStep[], pmsRate: number) {
  let rate = pmsRate;
  const result: { key: string; label: string; rate: number; discount: string; active: boolean; type: string }[] = [];
  for (const step of steps) {
    if (!step.active) {
      result.push({ key: step.key, label: step.label, rate, discount: step.type === "multiplier" ? `${step.value}×` : `${step.value}%`, active: false, type: step.type });
      continue;
    }
    if (step.type === "multiplier") {
      rate = rate * step.value;
      result.push({ key: step.key, label: step.label, rate, discount: `${step.value}×`, active: true, type: step.type });
    } else {
      rate = rate * (1 - step.value / 100);
      result.push({ key: step.key, label: step.label, rate, discount: `−${step.value}%`, active: true, type: step.type });
    }
  }
  return { steps: result, final: Math.round(rate * 100) / 100 };
}

function getEffectiveSteps(channel: MockChannel, hotelName: string): WaterfallStep[] {
  const ov = MOCK_OVERRIDES.find(o => o.hotelName === hotelName && o.channelSlug === channel.slug);
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

export function MPChannelPricingV2({ activeView, onNavigate }: MPChannelPricingV2Props) {
  const [selectedChannel, setSelectedChannel] = useState("booking-com");
  const [simPmsRate, setSimPmsRate] = useState(185);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);

  const channel = MOCK_CHANNELS.find(c => c.slug === selectedChannel)!;
  const channelOverrides = MOCK_OVERRIDES.filter(o => o.channelSlug === selectedChannel);
  const selectedResult = calcWaterfall(channel.steps, simPmsRate);

  return (
    <div style={{ display: "flex", height: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <MPSidebar activeView={activeView} onNavigate={onNavigate} />

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Top bar */}
        <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>Portfolio</span>
              <ChevronDown size={14} color={R.textMid} />
            </div>
            {/* Persistent PMS rate in top bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: R.textDim }}>PMS Rate</span>
              <div style={{ display: "flex", alignItems: "center", background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "4px 10px", gap: 2 }}>
                <span style={{ fontSize: 12, color: R.textDim }}>{curr}</span>
                <input type="number" value={simPmsRate} onChange={e => setSimPmsRate(Number(e.target.value) || 0)}
                  style={{ width: 50, background: "transparent", border: "none", color: R.accent, fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none" }} />
              </div>
              <span style={{ fontSize: 11, color: R.textDim }}>→</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: R.teal, fontVariantNumeric: "tabular-nums" }}>{curr}{selectedResult.final.toFixed(2)}</span>
              <span style={{ fontSize: 10, color: R.textDim }}>guest sees</span>
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
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Distribution</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Layers size={22} color={R.teal} />
              <h1 style={{ fontSize: 22, fontWeight: 700, color: R.accent, margin: 0, letterSpacing: -0.5 }}>Channel Pricing</h1>
            </div>
            <p style={{ fontSize: 13, color: R.textMid, margin: "6px 0 0" }}>Portfolio defaults & per-hotel overrides</p>
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* Channel Tabs                                        */}
          {/* ═══════════════════════════════════════════════════ */}
          <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: `2px solid ${R.border}`, paddingBottom: 0 }}>
            {MOCK_CHANNELS.map(ch => {
              const isActive = selectedChannel === ch.slug;
              const overrideCount = MOCK_OVERRIDES.filter(o => o.channelSlug === ch.slug).length;
              return (
                <button key={ch.slug} onClick={() => { setSelectedChannel(ch.slug); setExpandedHotel(null); setShowChannelInfo(false); }}
                  style={{
                    padding: "16px 28px", border: "none",
                    borderBottom: isActive ? `3px solid ${R.teal}` : "3px solid transparent",
                    background: isActive ? `${R.teal}06` : "transparent",
                    color: isActive ? R.accent : R.textDim,
                    fontSize: 14, fontWeight: isActive ? 600 : 500, cursor: "pointer",
                    transition: "all 0.15s", marginBottom: -2,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                  <span>{ch.name}</span>
                  {overrideCount > 0 && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: `${R.amber}15`, color: R.amber, fontWeight: 600 }}>
                      {overrideCount}
                    </span>
                  )}
                </button>
              );
            })}
            {/* Add channel */}
            <button style={{
              padding: "16px 20px", border: "none", borderBottom: "3px solid transparent",
              background: "transparent", color: R.textDim, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, marginBottom: -2,
            }}>
              <Plus size={14} /> Add
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* Channel Info Bar (collapsible)                      */}
          {/* ═══════════════════════════════════════════════════ */}
          <div style={{ marginBottom: 20 }}>
            <div
              onClick={() => setShowChannelInfo(!showChannelInfo)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                background: R.card, border: `1px solid ${R.border}`, cursor: "pointer",
                borderRadius: showChannelInfo ? "8px 8px 0 0" : 8,
                transition: "border-radius 0.15s",
              }}>
              <Globe size={14} color={R.teal} />
              <span style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>{channel.name}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${R.teal}12`, color: R.teal }}>{channel.channelType}</span>
              {channel.commission != null && (
                <span style={{ fontSize: 10, color: channel.commission >= 20 ? R.amber : R.textMid }}>{channel.commission}% commission</span>
              )}
              <span style={{ fontSize: 10, color: R.textDim }}>·</span>
              <span style={{ fontSize: 10, color: R.textDim }}>{channel.paymentMethod}</span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <Info size={10} color={R.textDim} />
                <ChevronDown size={12} color={R.textDim} style={{ transform: showChannelInfo ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </div>
            </div>
            {showChannelInfo && (
              <div style={{
                padding: "16px 20px", background: R.darkBand, border: `1px solid ${R.border}`, borderTop: "none",
                borderRadius: "0 0 8px 8px",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Agreement</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: R.accent }}>{channel.agreement}</div>
                    <div style={{ fontSize: 11, color: R.textMid, marginTop: 3 }}>Pricing: Net</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Financials</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: channel.commission && channel.commission >= 20 ? R.amber : R.accent }}>
                        {channel.commission != null ? `${channel.commission}%` : "—"}
                      </span>
                      <span style={{ fontSize: 10, color: R.textDim }}>commission</span>
                    </div>
                    <div style={{ fontSize: 11, color: R.textMid, marginTop: 3 }}>Payment: {channel.paymentMethod}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Contract</div>
                    <div style={{ fontSize: 12, color: R.textMid }}>
                      {channel.contractExpiry
                        ? `Expires ${new Date(channel.contractExpiry).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
                        : "No expiry set"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>Contact</div>
                    {channel.primaryContact ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 500, color: R.accent }}>{channel.primaryContact}</div>
                        {channel.contactEmail && <div style={{ fontSize: 10, color: R.textDim, marginTop: 2 }}>{channel.contactEmail}</div>}
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: R.textDim, fontStyle: "italic" }}>No contact</div>
                    )}
                  </div>
                </div>
                {channel.notes && (
                  <div style={{ marginTop: 12, padding: "8px 10px", background: `${R.amber}06`, borderRadius: 4, borderLeft: `2px solid ${R.amber}30` }}>
                    <span style={{ fontSize: 11, color: R.textMid, lineHeight: 1.5 }}>{channel.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* Horizontal Waterfall Pipeline                       */}
          {/* ═══════════════════════════════════════════════════ */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={14} color={R.teal} />
                <span style={{ fontSize: 13, fontWeight: 600, color: R.accent }}>Waterfall — Portfolio Default</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: R.textDim }}>
                  {channelOverrides.length > 0 ? `${MOCK_HOTELS.length - channelOverrides.length} using defaults` : `All ${MOCK_HOTELS.length} hotels`}
                </span>
                {channelOverrides.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: R.amber }}>{channelOverrides.length} override{channelOverrides.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>

            {/* Horizontal pipeline */}
            <div style={{ padding: "32px 24px", overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content" }}>

                {/* PMS input node */}
                <div style={{ width: 148, flexShrink: 0 }}>
                  <div style={{
                    padding: "20px 14px", borderRadius: 8, background: R.cardRaised, border: `1px solid ${R.border}`,
                    textAlign: "center", height: 96, display: "flex", flexDirection: "column", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 8 }}>PMS Rate</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: R.accent, fontVariantNumeric: "tabular-nums" }}>{curr}{simPmsRate}</div>
                  </div>
                </div>

                {/* Steps */}
                {channel.steps.map((step, i) => {
                  const result = selectedResult.steps[i];
                  return (
                    <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                      {/* Arrow connector */}
                      <div style={{ width: 48, height: 1, background: step.active ? R.border : `${R.border}50`, position: "relative", flexShrink: 0 }}>
                        <div style={{
                          position: "absolute", right: -4, top: -4, width: 0, height: 0,
                          borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                          borderLeft: `6px solid ${step.active ? R.border : `${R.border}50`}`,
                        }} />
                      </div>

                      {/* Step node */}
                      <div style={{ width: 148, flexShrink: 0, opacity: step.active ? 1 : 0.35 }}>
                        <div style={{
                          padding: "20px 14px", borderRadius: 8, textAlign: "center", height: 96,
                          display: "flex", flexDirection: "column", justifyContent: "center",
                          background: R.card, border: `1px solid ${R.border}`,
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: step.active ? R.accent : R.textDim, marginBottom: 10 }}>{step.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            color: step.active ? (step.type === "multiplier" ? R.green : R.red) : R.textDim,
                          }}>
                            {step.type === "multiplier" ? `${step.value}×` : `−${step.value}%`}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Final arrow + result */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ width: 48, height: 1, background: R.teal, position: "relative", flexShrink: 0 }}>
                    <div style={{
                      position: "absolute", right: -4, top: -4, width: 0, height: 0,
                      borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                      borderLeft: `6px solid ${R.teal}`,
                    }} />
                  </div>
                  <div style={{ width: 148, flexShrink: 0 }}>
                    <div style={{
                      padding: "20px 14px", borderRadius: 8, textAlign: "center", height: 96,
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      background: `${R.teal}06`, border: `1px solid ${R.teal}20`,
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: R.teal, textTransform: "uppercase", marginBottom: 8 }}>Guest Sees</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: R.teal, fontVariantNumeric: "tabular-nums" }}>{curr}{selectedResult.final.toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: R.textDim, marginTop: 6 }}>
                        {Math.round((selectedResult.final / simPmsRate) * 100)}% of PMS
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════ */}
          {/* Per-Hotel Overrides Table                           */}
          {/* ═══════════════════════════════════════════════════ */}
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 size={14} style={{ color: R.amber }} />
                <span style={{ color: R.accent, fontSize: 13, fontWeight: 600 }}>Per-Hotel Overrides</span>
                <span style={{ color: R.textDim, fontSize: 11 }}>— {channel.name}</span>
              </div>
              <button style={{
                padding: "6px 14px", borderRadius: 6, border: `1px solid ${R.border}`,
                background: R.cardRaised, color: R.textMid, fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
                + Add Override
              </button>
            </div>

            {/* Hotel list — V1-style rows */}
            {channelOverrides.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <Check size={20} style={{ color: R.green, margin: "0 auto 8px" }} />
                <div style={{ color: R.textDim, fontSize: 12 }}>All hotels use the portfolio default for {channel.name}</div>
              </div>
            ) : (
              <div>
                {MOCK_HOTELS.map((hotel, hi) => {
                  const override = channelOverrides.find(o => o.hotelName === hotel);
                  const hasOverride = !!override;
                  const isExpanded = expandedHotel === hotel;
                  const effectiveSteps = getEffectiveSteps(channel, hotel);
                  const waterfallResult = calcWaterfall(effectiveSteps, simPmsRate);
                  const defaultResult = selectedResult;

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

                      {/* Expanded: full waterfall comparison */}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
