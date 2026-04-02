import { useState } from "react";
import { ChevronDown, ChevronUp, PoundSterling } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalculatorState } from "../../hooks/usePropertyHub";
import { AssetConfig } from "../../api/types";

interface PromoConfigSectionProps {
  hotelId: string;
  asset: AssetConfig;
  calcState: CalculatorState;
  updateCalculator: (hotelId: string, updates: Partial<CalculatorState>) => void;
  savePromoConfig: (hotelId: string, geniusOverride?: number) => void;
  isCampaignValidForDate: (testDate: Date | undefined, camp: any) => boolean;
}

const inputStyle: React.CSSProperties = {
  width: "58px",
  height: "26px",
  textAlign: "right",
  fontSize: "12px",
  backgroundColor: "#1a1a1a",
  borderColor: "#2a2a2a",
  color: "#e5e5e5",
  padding: "2px 6px",
};

// 3-column grid row: checkbox | label | input + %
function PromoRow({ label, checked, onCheck, value, onChange, suffix = "%" }: {
  label: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "24px 1fr auto",
      alignItems: "center",
      gap: "10px",
      padding: "6px 0",
      borderBottom: "1px solid rgba(42, 42, 42, 0.4)",
    }}>
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onCheck(!!c)}
        style={{ borderColor: "#2a2a2a" }}
      />
      <span style={{ color: checked ? "#e5e5e5" : "#6b7280", fontSize: "12px", transition: "color 0.15s" }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, opacity: checked ? 1 : 0.4 }}
        />
        <span style={{ color: "#6b7280", fontSize: "10px", width: "10px" }}>{suffix}</span>
      </div>
    </div>
  );
}

export function PromoConfigSection({
  hotelId,
  asset,
  calcState,
  updateCalculator,
  savePromoConfig,
  isCampaignValidForDate,
}: PromoConfigSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localGenius, setLocalGenius] = useState(asset.genius_discount_pct || 0);

  const geniusDiscount = localGenius;
  const update = (updates: Partial<CalculatorState>) => updateCalculator(hotelId, updates);

  const longCampaign = (calcState.campaigns || []).find((c) => c.slug === "long-campaign");

  const ensureLongCampaign = () => {
    if (longCampaign) return;
    update({
      campaigns: [
        ...(calcState.campaigns || []),
        { id: Math.random().toString(36).substr(2, 9), slug: "long-campaign", name: "Long Campaign", discount: 20, startDate: undefined, endDate: undefined, active: true, isEditing: false },
      ],
    });
  };

  const updateCampaign = (campId: string, updates: any) => {
    update({ campaigns: (calcState.campaigns || []).map((c) => c.id === campId ? { ...c, ...updates } : c) });
  };

  return (
    <div style={{ borderTop: "1px solid #2a2a2a" }}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          background: "transparent",
          border: "none",
          padding: "1rem 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ color: "#e5e5e5", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.75rem" }}>
            OTA Discount Stack
          </h3>
          <span style={{ color: "#6b7280", fontSize: "11px", fontWeight: 400 }}>
            {calcState.multiplier}x
            {calcState.nonRefundableActive ? ` · NR ${calcState.nonRefundablePercent}%` : ""}
            {geniusDiscount > 0 ? ` · G ${geniusDiscount}%` : ""}
            {longCampaign?.active ? ` · LC ${longCampaign.discount}%` : ""}
            {calcState.mobileActive ? ` · Mob ${calcState.mobilePercent}%` : ""}
          </span>
        </div>
        {isOpen
          ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "#6b7280" }} />
          : <ChevronDown style={{ width: "1rem", height: "1rem", color: "#6b7280" }} />
        }
      </button>

      {isOpen && (
        <div style={{ paddingBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: "0", alignItems: "start" }}>

            {/* LEFT: Promo Settings */}
            <div>
              {/* Multiplier — no checkbox, always on */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr auto",
                alignItems: "center",
                gap: "10px",
                padding: "6px 0",
                borderBottom: "1px solid rgba(42, 42, 42, 0.4)",
              }}>
                <div /> {/* empty checkbox slot */}
                <span style={{ color: "#e5e5e5", fontSize: "12px" }}>Multiplier</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Input type="number" step="0.01" value={calcState.multiplier} onChange={(e) => update({ multiplier: parseFloat(e.target.value) || 1 })} style={inputStyle} />
                  <span style={{ color: "#6b7280", fontSize: "10px", width: "10px" }}>x</span>
                </div>
              </div>

              {/* Tax — no checkbox */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr auto",
                alignItems: "center",
                gap: "10px",
                padding: "6px 0",
                borderBottom: "1px solid rgba(42, 42, 42, 0.4)",
              }}>
                <div />
                <span style={{ color: "#e5e5e5", fontSize: "12px" }}>Tax</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Select value={calcState.taxType} onValueChange={(v: "inclusive" | "exclusive") => update({ taxType: v })}>
                    <SelectTrigger style={{ width: "86px", height: "26px", fontSize: "11px", backgroundColor: "#1a1a1a", borderColor: "#2a2a2a", color: "#e5e5e5" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}>
                      <SelectItem value="inclusive" style={{ color: "#e5e5e5", cursor: "pointer" }}>Inclusive</SelectItem>
                      <SelectItem value="exclusive" style={{ color: "#e5e5e5", cursor: "pointer" }}>Exclusive</SelectItem>
                    </SelectContent>
                  </Select>
                  {calcState.taxType === "exclusive" && (
                    <>
                      <Input type="number" value={calcState.taxPercent} onChange={(e) => update({ taxPercent: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                      <span style={{ color: "#6b7280", fontSize: "10px", width: "10px" }}>%</span>
                    </>
                  )}
                </div>
              </div>

              <PromoRow label="Non-Refundable" checked={calcState.nonRefundableActive} onCheck={(c) => update({ nonRefundableActive: c })} value={calcState.nonRefundablePercent} onChange={(v) => update({ nonRefundablePercent: v })} />
              <PromoRow label="Genius" checked={!!geniusDiscount} onCheck={(checked) => setLocalGenius(checked ? (geniusDiscount || 10) : 0)} value={geniusDiscount} onChange={setLocalGenius} />
              <PromoRow
                label="Long Campaign"
                checked={!!longCampaign?.active}
                onCheck={(checked) => { if (longCampaign) updateCampaign(longCampaign.id, { active: checked }); else ensureLongCampaign(); }}
                value={longCampaign?.discount ?? 20}
                onChange={(v) => { if (longCampaign) updateCampaign(longCampaign.id, { discount: v }); else ensureLongCampaign(); }}
              />
              <PromoRow label="Mobile Rate" checked={calcState.mobileActive} onCheck={(c) => update({ mobileActive: c })} value={calcState.mobilePercent} onChange={(v) => update({ mobilePercent: v })} />
              <PromoRow label="Country Rate" checked={calcState.countryRateActive} onCheck={(c) => update({ countryRateActive: c })} value={calcState.countryRatePercent} onChange={(v) => update({ countryRatePercent: v })} />
            </div>

            {/* Vertical divider */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: "4px" }}>
              <div style={{ width: "1px", height: "100%", minHeight: "200px", backgroundColor: "#2a2a2a" }} />
            </div>

            {/* RIGHT: Simulator */}
            <div style={{ paddingLeft: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "10px" }}>
                Simulator
              </span>

              {/* Rate inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <Label style={{ color: "#6b7280", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "3px" }}>Target Sell</Label>
                  <div style={{ position: "relative" }}>
                    <PoundSterling style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "10px", height: "10px", color: "#39BDF8" }} />
                    <Input
                      type="number"
                      value={Math.round(calcState.targetSellRate)}
                      onFocus={() => update({ editingField: "target" })}
                      onChange={(e) => update({ targetSellRate: parseFloat(e.target.value) || 0 })}
                      style={{ backgroundColor: "#0f0f0f", borderColor: "#2a2a2a", color: "#e5e5e5", paddingLeft: "24px", height: "28px", fontSize: "12px" }}
                    />
                  </div>
                </div>
                <div>
                  <Label style={{ color: "#6b7280", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "3px" }}>PMS Rate</Label>
                  <div style={{ position: "relative" }}>
                    <PoundSterling style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "10px", height: "10px", color: "#39BDF8" }} />
                    <Input
                      type="number"
                      value={Math.round(calcState.pmsRate)}
                      onFocus={() => update({ editingField: "pms" })}
                      onChange={(e) => update({ pmsRate: parseFloat(e.target.value) || 0 })}
                      style={{ backgroundColor: "#0f0f0f", borderColor: "#2a2a2a", color: "#e5e5e5", paddingLeft: "24px", height: "28px", fontSize: "12px" }}
                    />
                  </div>
                </div>
              </div>

              {/* Waterfall */}
              <div style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 14px", flex: 1 }}>
                {(() => {
                  const steps: { label: string; rate: number; indent: number; isFinal?: boolean; color?: string }[] = [];
                  const pmsVal = Number(calcState.pmsRate);
                  let r = pmsVal * Number(calcState.multiplier);
                  steps.push({ label: `Base × ${calcState.multiplier}`, rate: r, indent: 0 });

                  if (calcState.nonRefundableActive) { r *= (1 - Number(calcState.nonRefundablePercent) / 100); steps.push({ label: `Non-Ref -${calcState.nonRefundablePercent}%`, rate: r, indent: 0 }); }
                  if (calcState.taxType === "exclusive" && calcState.taxPercent > 0) { r *= (1 + Number(calcState.taxPercent) / 100); steps.push({ label: `Tax +${calcState.taxPercent}%`, rate: r, indent: 0, color: "#39BDF8" }); }

                  const gPct = Number(geniusDiscount);
                  if (gPct > 0) { r *= (1 - gPct / 100); steps.push({ label: `Genius -${gPct}%`, rate: r, indent: 1 }); }

                  const validCampaigns = (calcState.campaigns || []).filter((c) => !["black-friday", "limited-time"].includes(c.slug) && isCampaignValidForDate(calcState.testStayDate, c));
                  if (validCampaigns.length > 0) { const best = validCampaigns.reduce((p, c) => (p.discount > c.discount ? p : c)); r *= (1 - Number(best.discount) / 100); steps.push({ label: `Campaign -${best.discount}%`, rate: r, indent: 1 }); }

                  const isMobileBlocked = validCampaigns.some((c) => ["long-campaign"].includes(c.slug));
                  if (calcState.mobileActive && !isMobileBlocked) { r *= (1 - Number(calcState.mobilePercent) / 100); steps.push({ label: `Mobile -${calcState.mobilePercent}%`, rate: r, indent: 1 }); }
                  if (calcState.countryRateActive) { r *= (1 - Number(calcState.countryRatePercent) / 100); steps.push({ label: `Country -${calcState.countryRatePercent}%`, rate: r, indent: 1 }); }

                  steps.push({ label: "Final Sell Rate", rate: r, indent: 0, isFinal: true });

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "monospace" }}>
                      {steps.map((step, i) => (
                        <div key={i} style={{
                          paddingLeft: `${step.indent * 12}px`,
                          fontSize: "11px",
                          display: "flex",
                          justifyContent: "space-between",
                          color: step.isFinal ? "#10b981" : step.color || "#9ca3af",
                          borderTop: step.isFinal ? "1px solid #2a2a2a" : "none",
                          marginTop: step.isFinal ? "4px" : 0,
                          paddingTop: step.isFinal ? "4px" : 0,
                          fontWeight: step.isFinal ? 600 : 400,
                        }}>
                          <span>{step.indent > 0 ? "└ " : ""}{step.label}</span>
                          <span style={{ color: step.isFinal ? "#10b981" : "#e5e5e5" }}>£{step.rate.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Save */}
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "0.75rem" }}>
            <Button onClick={() => savePromoConfig(hotelId, localGenius)} style={{ backgroundColor: "#39BDF8", color: "#0f0f0f", minWidth: "160px" }}>
              Save Promo Config
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
