import { useState } from "react";
import {
  ChevronDown, ChevronRight, Check, Pencil,
  Building2, Bell, Search, Info, Plus,
} from "lucide-react";

/**
 * ── MP Channel Pricing V3 — Rockenue style mockup ──
 * Mock data. Not wired. Design exercise.
 * Same layout as V2 but with agreed token palette, subtler styling.
 */

interface MPChannelPricingV3Props { activeView: string; onNavigate: (view: string) => void; }

const R = {
  bg: "#14181D", card: "#121519", cardRaised: "#1C2228", border: "#1E2330", sep: "rgba(255,255,255,0.04)", accent: "#F3F5F7",
  text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  teal: "#39BDF8", warmTeal: "#38C6BA", gold: "#C8A66E",
  darkBand: "#0C0E12", green: "#34D068", red: "#ef4444",
};

const curr = "£";

// ══════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════

interface WaterfallStep {
  key: string; label: string; type: "multiplier" | "discount"; value: number;
  active: boolean; locked?: boolean;
}

interface MockChannel {
  slug: string; name: string; channelType: string; agreement: string;
  commission: number | null; paymentMethod: string;
  contractExpiry: string | null; primaryContact: string | null;
  contactEmail: string | null; notes: string | null;
  steps: WaterfallStep[];
}

interface MockOverride {
  hotelName: string; channelSlug: string;
  overrides: Record<string, { value?: number; active?: boolean }>;
}

const MOCK_CHANNELS: MockChannel[] = [
  {
    slug: "booking-com", name: "Booking.com", channelType: "OTA", agreement: "Group", commission: 18, paymentMethod: "VCC",
    contractExpiry: "2027-03-01", primaryContact: "Sarah Jenkins", contactEmail: "sarah.j@booking.com",
    notes: "Genius L2 active across portfolio. Long campaign 30% runs until Aug 2026.",
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.42, active: true, locked: true },
      { key: "nrf", label: "Non-Refundable", type: "discount", value: 10, active: true },
      { key: "genius", label: "Genius Programme", type: "discount", value: 15, active: true },
      { key: "campaign", label: "Long Campaign", type: "discount", value: 30, active: true },
      { key: "mobile", label: "Mobile Rate", type: "discount", value: 10, active: false },
    ],
  },
  {
    slug: "expedia", name: "Expedia", channelType: "OTA", agreement: "Group", commission: 20, paymentMethod: "VCC",
    contractExpiry: "2026-12-01", primaryContact: "Tom Reid", contactEmail: "t.reid@expedia.com", notes: null,
    steps: [
      { key: "multiplier", label: "Rate Multiplier", type: "multiplier", value: 1.35, active: true, locked: true },
      { key: "nrf", label: "Non-Refundable", type: "discount", value: 10, active: true },
      { key: "member_deal", label: "Member Deal", type: "discount", value: 10, active: true },
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
      { key: "direct_discount", label: "Best Price Guarantee", type: "discount", value: 10, active: true },
    ],
  },
  {
    slug: "hrs", name: "HRS", channelType: "Wholesaler", agreement: "Group", commission: 22, paymentMethod: "BACS",
    contractExpiry: "2026-09-15", primaryContact: "Anna Becker", contactEmail: "a.becker@hrs.com",
    notes: "High commission — review at renewal.",
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
    return { ...step, value: override.value ?? step.value, active: override.active ?? step.active };
  });
}

// ══════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════

export function MPChannelPricingV3({ activeView, onNavigate }: MPChannelPricingV3Props) {
  const [selectedChannel, setSelectedChannel] = useState("booking-com");
  const [simPmsRate, setSimPmsRate] = useState(185);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);

  const channel = MOCK_CHANNELS.find(c => c.slug === selectedChannel)!;
  const channelOverrides = MOCK_OVERRIDES.filter(o => o.channelSlug === selectedChannel);
  const selectedResult = calcWaterfall(channel.steps, simPmsRate);

  return (
    <div style={{ height: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, -apple-system, sans-serif", overflow: "auto" }}>

      {/* Top bar */}
      <div style={{ padding: "14px 32px", borderBottom: `1px solid ${R.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>
            <span style={{ fontSize: 13, color: R.accent, fontWeight: 500 }}>Portfolio</span>
            <ChevronDown size={14} color={R.textMid} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: R.textDim }}>PMS Rate</span>
            <div style={{ display: "flex", alignItems: "center", background: R.cardRaised, border: `1px solid ${R.border}`, borderRadius: 6, padding: "4px 10px", gap: 2 }}>
              <span style={{ fontSize: 12, color: R.textDim }}>{curr}</span>
              <input type="number" value={simPmsRate} onChange={e => setSimPmsRate(Number(e.target.value) || 0)}
                style={{ width: 50, background: "transparent", border: "none", color: R.accent, fontSize: 13, fontWeight: 500, textAlign: "center", outline: "none" }} />
            </div>
            <span style={{ fontSize: 11, color: R.textDim }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: R.warmTeal, fontVariantNumeric: "tabular-nums" }}>{curr}{selectedResult.final.toFixed(2)}</span>
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

      <div style={{ padding: "32px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>Distribution</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: R.accent, margin: "0 0 6px", letterSpacing: -0.5 }}>Channel Pricing</h1>
          <p style={{ fontSize: 13, color: R.textMid, margin: 0 }}>Portfolio defaults & per-hotel overrides</p>
        </div>

        {/* Channel Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32, borderBottom: `1px solid ${R.border}`, paddingBottom: 0 }}>
          {MOCK_CHANNELS.map(ch => {
            const isActive = selectedChannel === ch.slug;
            const overrideCount = MOCK_OVERRIDES.filter(o => o.channelSlug === ch.slug).length;
            return (
              <button key={ch.slug} onClick={() => { setSelectedChannel(ch.slug); setExpandedHotel(null); setShowChannelInfo(false); }}
                style={{
                  padding: "14px 24px", border: "none",
                  borderBottom: isActive ? `2px solid ${R.warmTeal}` : "2px solid transparent",
                  background: "transparent",
                  color: isActive ? R.accent : R.textDim,
                  fontSize: 14, fontWeight: isActive ? 500 : 400, cursor: "pointer",
                  transition: "all 0.15s", marginBottom: -1,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                <span>{ch.name}</span>
                {overrideCount > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: `${R.gold}15`, color: R.gold, fontWeight: 500 }}>
                    {overrideCount}
                  </span>
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

        {/* Channel Info Bar */}
        <div style={{ marginBottom: 24 }}>
          <div
            onClick={() => setShowChannelInfo(!showChannelInfo)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
              background: R.card, border: `1px solid ${R.border}`, cursor: "pointer",
              borderRadius: showChannelInfo ? "8px 8px 0 0" : 8,
            }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: R.accent }}>{channel.name}</span>
            <span style={{ fontSize: 10, color: R.textDim }}>{channel.channelType}</span>
            {channel.commission != null && (
              <>
                <span style={{ fontSize: 10, color: R.textDim }}>·</span>
                <span style={{ fontSize: 10, color: R.textMid }}>{channel.commission}%</span>
              </>
            )}
            <span style={{ fontSize: 10, color: R.textDim }}>·</span>
            <span style={{ fontSize: 10, color: R.textDim }}>{channel.paymentMethod}</span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={10} color={R.textDim} />
              <ChevronDown size={12} color={R.textDim} style={{ transform: showChannelInfo ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </div>
          </div>
          {showChannelInfo && (
            <div style={{ padding: "16px 20px", background: R.darkBand, border: `1px solid ${R.border}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {[
                  { label: "Agreement", value: channel.agreement, sub: "Pricing: Net" },
                  { label: "Commission", value: channel.commission != null ? `${channel.commission}%` : "—", sub: `Payment: ${channel.paymentMethod}` },
                  { label: "Contract", value: channel.contractExpiry ? `Expires ${new Date(channel.contractExpiry).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : "No expiry", sub: null },
                  { label: "Contact", value: channel.primaryContact ?? "—", sub: channel.contactEmail },
                ].map(col => (
                  <div key={col.label}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 6 }}>{col.label}</div>
                    <div style={{ fontSize: 12, color: R.text }}>{col.value}</div>
                    {col.sub && <div style={{ fontSize: 10, color: R.textDim, marginTop: 3 }}>{col.sub}</div>}
                  </div>
                ))}
              </div>
              {channel.notes && (
                <div style={{ marginTop: 12, padding: "8px 10px", background: `${R.gold}06`, borderRadius: 4, borderLeft: `2px solid ${R.gold}20` }}>
                  <span style={{ fontSize: 11, color: R.textMid, lineHeight: 1.5 }}>{channel.notes}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Waterfall Pipeline */}
        <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: R.text }}>Waterfall — Portfolio Default</span>
            <span style={{ fontSize: 11, color: R.textDim }}>
              {channelOverrides.length > 0
                ? `${MOCK_HOTELS.length - channelOverrides.length} using defaults · ${channelOverrides.length} override${channelOverrides.length !== 1 ? "s" : ""}`
                : `All ${MOCK_HOTELS.length} hotels`}
            </span>
          </div>

          <div style={{ padding: "32px 24px", overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "max-content" }}>
              {/* PMS node */}
              <div style={{ width: 148, flexShrink: 0 }}>
                <div style={{
                  padding: "20px 14px", borderRadius: 8, background: R.cardRaised, border: `1px solid ${R.border}`,
                  textAlign: "center", height: 96, display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", marginBottom: 8 }}>PMS Rate</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: R.accent, fontVariantNumeric: "tabular-nums" }}>{curr}{simPmsRate}</div>
                </div>
              </div>

              {/* Steps */}
              {channel.steps.map((step, i) => {
                const result = selectedResult.steps[i];
                return (
                  <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: 48, height: 1, background: step.active ? R.border : `${R.border}50`, position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", right: -4, top: -4, width: 0, height: 0,
                        borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                        borderLeft: `6px solid ${step.active ? R.border : `${R.border}50`}`,
                      }} />
                    </div>
                    <div style={{ width: 148, flexShrink: 0, opacity: step.active ? 1 : 0.3 }}>
                      <div style={{
                        padding: "20px 14px", borderRadius: 8, textAlign: "center", height: 96,
                        display: "flex", flexDirection: "column", justifyContent: "center",
                        background: R.card, border: `1px solid ${R.border}`,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 400, color: R.textMid, marginBottom: 10 }}>{step.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 500, fontVariantNumeric: "tabular-nums",
                          color: step.active ? (step.type === "multiplier" ? R.warmTeal : R.gold) : R.textDim,
                        }}>
                          {step.type === "multiplier" ? `${step.value}×` : `−${step.value}%`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Final */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 48, height: 1, background: R.warmTeal, position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", right: -4, top: -4, width: 0, height: 0,
                    borderTop: "4px solid transparent", borderBottom: "4px solid transparent",
                    borderLeft: `6px solid ${R.warmTeal}`,
                  }} />
                </div>
                <div style={{ width: 148, flexShrink: 0 }}>
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
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Per-Hotel Overrides</span>
              <span style={{ color: R.textDim, fontSize: 11 }}>— {channel.name}</span>
            </div>
            <button style={{
              padding: "6px 14px", borderRadius: 6, border: `1px solid ${R.border}`,
              background: R.cardRaised, color: R.textMid, fontSize: 11, fontWeight: 500, cursor: "pointer",
            }}>
              + Add Override
            </button>
          </div>

          {channelOverrides.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
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

                return (
                  <div key={hotel} style={{ borderBottom: hi < MOCK_HOTELS.length - 1 ? `1px solid ${R.sep}` : "none" }}>
                    <div
                      onClick={() => hasOverride && setExpandedHotel(isExpanded ? null : hotel)}
                      style={{
                        display: "grid", gridTemplateColumns: "24px 1fr auto 120px",
                        padding: "12px 20px", alignItems: "center", gap: 12,
                        cursor: hasOverride ? "pointer" : "default",
                      }}
                    >
                      {hasOverride ? (
                        isExpanded ? <ChevronDown size={14} style={{ color: R.textDim }} /> : <ChevronRight size={14} style={{ color: R.textDim }} />
                      ) : (
                        <Check size={14} style={{ color: R.warmTeal, opacity: 0.4 }} />
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: hasOverride ? R.accent : R.textDim, fontSize: 13, fontWeight: 400 }}>{hotel}</span>
                        {hasOverride && override && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {Object.entries(override.overrides).map(([key, val]) => {
                              const stepDef = channel.steps.find(s => s.key === key);
                              if (!stepDef) return null;
                              const isDisabled = val.active === false;
                              return (
                                <span key={key} style={{
                                  fontSize: 9, padding: "2px 6px", borderRadius: 3,
                                  background: isDisabled ? `${R.red}08` : `${R.gold}10`,
                                  color: isDisabled ? R.red : R.gold,
                                  fontWeight: 500,
                                }}>
                                  {isDisabled ? `✕ ${stepDef.label}` : `${stepDef.label} → ${val.value}${stepDef.type === "multiplier" ? "×" : "%"}`}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <span style={{ fontSize: 10, color: hasOverride ? R.gold : R.warmTeal }}>
                        {hasOverride ? "Custom" : "Default"}
                      </span>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: R.warmTeal, fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                          {curr}{waterfallResult.final.toFixed(2)}
                        </span>
                        <span style={{ color: R.textDim, fontSize: 10, marginLeft: 4 }}>/ {curr}{simPmsRate}</span>
                      </div>
                    </div>

                    {/* Expanded comparison */}
                    {isExpanded && hasOverride && (() => {
                      let runningRate = simPmsRate;
                      return (
                        <div style={{ padding: "0 20px 16px 56px" }}>
                          <div style={{ background: R.darkBand, borderRadius: 8, border: `1px solid ${R.border}`, overflow: "hidden" }}>
                            <div style={{
                              display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                              padding: "8px 16px", gap: 8, background: R.cardRaised, borderBottom: `1px solid ${R.border}`,
                            }}>
                              <span />
                              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1, color: R.textDim, textTransform: "uppercase" }}>Step</span>
                              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", textAlign: "center" }}>Default</span>
                              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1, color: R.gold, textTransform: "uppercase", textAlign: "center" }}>This Hotel</span>
                              <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", textAlign: "right" }}>Running Total</span>
                            </div>

                            {effectiveSteps.map((step, i) => {
                              const defaultStep = channel.steps.find(s => s.key === step.key)!;
                              const isOverridden = step.value !== defaultStep.value || step.active !== defaultStep.active;
                              const isDisabledOverride = isOverridden && !step.active;

                              if (step.active) {
                                if (step.type === "multiplier") runningRate *= step.value;
                                else runningRate *= (1 - step.value / 100);
                              }

                              const suffix = step.type === "multiplier" ? "×" : "%";
                              const defaultSuffix = defaultStep.type === "multiplier" ? "×" : "%";

                              return (
                                <div key={step.key} style={{
                                  display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                                  padding: "10px 16px", gap: 8, alignItems: "center",
                                  borderBottom: i < effectiveSteps.length - 1 ? `1px solid ${R.sep}` : "none",
                                }}>
                                  <div>
                                    {isDisabledOverride ? (
                                      <div style={{ width: 18, height: 18, borderRadius: 4, background: `${R.red}08`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ color: R.red, fontSize: 11 }}>✕</span>
                                      </div>
                                    ) : isOverridden ? (
                                      <div style={{ width: 18, height: 18, borderRadius: 4, background: `${R.gold}08`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Pencil size={9} style={{ color: R.gold }} />
                                      </div>
                                    ) : (
                                      <div style={{ width: 18, height: 18, borderRadius: 4, background: R.cardRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ color: R.textDim, fontSize: 9 }}>—</span>
                                      </div>
                                    )}
                                  </div>

                                  <span style={{ color: step.active ? R.text : R.textDim, fontSize: 12, fontWeight: 400 }}>
                                    {step.label}
                                    {isDisabledOverride && <span style={{ color: R.red, fontSize: 10, marginLeft: 8 }}>Disabled</span>}
                                  </span>

                                  <div style={{ textAlign: "center" }}>
                                    <span style={{
                                      color: R.textDim, fontSize: 12,
                                      textDecoration: isOverridden ? "line-through" : "none", opacity: isOverridden ? 0.5 : 1,
                                    }}>
                                      {defaultStep.active ? `${defaultStep.value}${defaultSuffix}` : "off"}
                                    </span>
                                  </div>

                                  <div style={{ textAlign: "center" }}>
                                    {isOverridden ? (
                                      <span style={{ color: isDisabledOverride ? R.red : R.gold, fontSize: 12, fontWeight: 500 }}>
                                        {step.active ? `${step.value}${suffix}` : "off"}
                                      </span>
                                    ) : (
                                      <span style={{ color: R.textDim, fontSize: 11 }}>—</span>
                                    )}
                                  </div>

                                  <div style={{ textAlign: "right" }}>
                                    {step.active ? (
                                      <span style={{ color: R.text, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{curr}{runningRate.toFixed(2)}</span>
                                    ) : (
                                      <span style={{ color: R.textDim, fontSize: 11 }}>—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Footer */}
                            <div style={{
                              display: "grid", gridTemplateColumns: "28px 1fr 90px 90px 100px",
                              padding: "12px 16px", gap: 8, alignItems: "center",
                              borderTop: `1px solid ${R.border}`, background: R.darkBand,
                            }}>
                              <span />
                              <span style={{ color: R.text, fontSize: 12, fontWeight: 500 }}>Guest Sees</span>
                              <div style={{ textAlign: "center" }}>
                                <span style={{ color: R.textDim, fontSize: 12, textDecoration: "line-through", opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>
                                  {curr}{selectedResult.final.toFixed(2)}
                                </span>
                              </div>
                              <div style={{ textAlign: "center" }}>
                                <span style={{ color: R.gold, fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                                  {curr}{waterfallResult.final.toFixed(2)}
                                </span>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                {(() => {
                                  const diff = waterfallResult.final - selectedResult.final;
                                  return (
                                    <span style={{ color: diff > 0 ? R.warmTeal : diff < 0 ? R.gold : R.textDim, fontSize: 11 }}>
                                      {diff > 0 ? "+" : ""}{diff.toFixed(2)}
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
  );
}
