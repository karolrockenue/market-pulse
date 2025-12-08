import React, { useState, Fragment } from "react";
import {
  Wind,
  Calculator,
  Building2,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  PoundSterling,
  Calendar as CalendarIcon,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { usePropertyHub } from "../../hooks/usePropertyHub";
import { AssetConfig } from "../../api/types";

// --- EXACT ORIGINAL STYLES (From Backup) ---
const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#1d1d1c",
    position: "relative",
    overflow: "hidden",
    color: "#e5e5e5",
  },
  gradientBg: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundImage:
      "linear-gradient(to bottom right, rgba(57, 189, 248, 0.05), transparent, rgba(250, 255, 106, 0.05))",
    zIndex: 2,
  },
  contentWrapper: { position: "relative", zIndex: 10, padding: "3rem" },
  header: { marginBottom: "2rem" },
  h1: {
    color: "#e5e5e5",
    fontSize: "1.875rem",
    lineHeight: "2.25rem",
    letterSpacing: "-0.025em",
    marginBottom: "0.5rem",
  },
  pSub: { color: "#9ca3af", fontSize: "0.875rem", lineHeight: "1.25rem" },
  toolsSection: { marginBottom: "2rem" },
  h2: {
    color: "#e5e5e5",
    fontSize: "1.25rem",
    lineHeight: "1.75rem",
    marginBottom: "1rem",
  },
  toolsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "1.5rem",
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
    borderWidth: "1px",
    cursor: "pointer",
  },
  cardDisabled: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
    borderWidth: "1px",
    opacity: 0.6,
    cursor: "not-allowed",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardHeaderContent: { display: "flex", alignItems: "center", gap: "0.75rem" },
  toolIconWrapperBase: {
    width: "2.5rem",
    height: "2.5rem",
    borderRadius: "0.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  toolIconWrapperShadowfax: {
    backgroundImage: "linear-gradient(to bottom right, #39BDF8, #29ADEE)",
  },
  toolIconWrapperCalc: {
    backgroundImage: "linear-gradient(to bottom right, #6b7280, #4b5563)",
  },
  toolIcon: { width: "1.25rem", height: "1.25rem", color: "#0f0f0f" },
  cardTitle: { color: "#e5e5e5", fontSize: "1.125rem", lineHeight: "1.75rem" },
  cardDescShadowfax: {
    color: "#39BDF8",
    fontSize: "0.75rem",
    lineHeight: "1rem",
  },
  cardDescCalc: { color: "#6b7280", fontSize: "0.75rem", lineHeight: "1rem" },
  cardP: { color: "#9ca3af", fontSize: "0.875rem", lineHeight: "1.25rem" },
  cardPDisabled: {
    color: "#6b7280",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
  },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: "0" },
  th: {
    textAlign: "left",
    padding: "0.75rem 1rem",
    color: "#9ca3af",
    fontSize: "0.75rem",
    lineHeight: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #2a2a2a",
  },
  thCenter: {
    textAlign: "center",
    padding: "0.75rem 1rem",
    color: "#9ca3af",
    fontSize: "0.75rem",
    lineHeight: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #2a2a2a",
  },
  trBase: {
    borderBottom: "1px solid #2a2a2a",
    backgroundColor: "transparent",
    transition: "background-color 0.2s",
  },
  trActive: { backgroundColor: "#1f1f1f", borderBottom: "1px solid #2a2a2a" },
  td: {
    paddingTop: "20px",
    paddingBottom: "20px",
    paddingLeft: "1rem",
    paddingRight: "1rem",
    color: "#e5e5e5",
  },
  hotelCell: { display: "flex", alignItems: "center", gap: "0.5rem" },
  hotelIcon: { width: "1rem", height: "1rem", color: "#39BDF8", flexShrink: 0 },
  hotelName: { color: "#e5e5e5" },
  inputBase: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2a2a2a",
    color: "#e5e5e5",
    height: "2.25rem",
  },
  urlCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    minWidth: "150px",
  },
  urlStatusIconWrapper: {
    width: "1.5rem",
    height: "1.5rem",
    borderRadius: "9999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  urlStatusIconWrapperConfigured: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  urlStatusIconWrapperNotSet: { backgroundColor: "rgba(107, 114, 128, 0.2)" },
  urlStatusIconConfigured: { width: "1rem", height: "1rem", color: "#10b981" },
  urlStatusIconNotSet: { width: "1rem", height: "1rem", color: "#6b7280" },
  urlStatusTextConfigured: {
    color: "#10b981",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    marginLeft: "0.5rem",
  },
  urlStatusTextNotSet: {
    color: "#6b7280",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    marginLeft: "0.5rem",
  },
  actionCell: { display: "flex", justifyContent: "center" },
  manageButton: {
    backgroundColor: "#0f0f0f",
    borderColor: "#2a2a2a",
    color: "#9ca3af",
    height: "2.25rem",
  },
  loaderWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "16rem",
  },
  loaderIcon: {
    width: "2rem",
    height: "2rem",
    color: "#39BDF8",
    animation: "spin 1s linear infinite",
  },
  loaderText: { marginLeft: "0.75rem", color: "#9ca3af" },
  flexItemsCenter: { display: "flex", alignItems: "center" },
  accordionRow: { backgroundColor: "transparent" },
  accordionContentWrapper: {
    backgroundColor: "#141414",
    paddingLeft: "16px",
    paddingRight: "24px",
    paddingTop: "24px",
    paddingBottom: "24px",
  },
  columnTitle: {
    color: "#39BDF8",
    fontSize: "14px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  sectionLabel: {
    color: "#6b7280",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "12px",
    display: "block",
  },
  inputLabel: {
    color: "#e5e5e5",
    fontSize: "12px",
    marginBottom: "8px",
    display: "block",
  },
  cardBg: {
    backgroundColor: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "4px",
    padding: "12px",
  },
  inputSmall: {
    width: "100px",
    height: "28px",
    backgroundColor: "#0f0f0f",
    border: "1px solid #2a2a2a",
    color: "#e5e5e5",
    fontSize: "12px",
    textAlign: "right",
  },
  selectTrigger: {
    backgroundColor: "#0f0f0f",
    border: "1px solid #2a2a2a",
    color: "#e5e5e5",
    height: "36px",
    fontSize: "12px",
  },
};

interface PropertyHubViewProps {
  onNavigate: (view: string) => void;
}

export function PropertyHubView({ onNavigate }: PropertyHubViewProps) {
  const {
    assets,
    isLoading,
    calculatorStates,
    updateCalculator,
    saveAssetSettings,
    isCampaignValidForDate,
  } = usePropertyHub();

  const [editedValues, setEditedValues] = useState<
    Record<string, Partial<AssetConfig>>
  >({});
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);

  // --- [RESTORED] Helper Functions to bridge View -> Hook ---

  const handleInputChange = (
    assetId: string,
    field: keyof AssetConfig,
    value: any
  ) => {
    setEditedValues((prev) => ({
      ...prev,
      [assetId]: { ...prev[assetId], [field]: value },
    }));
  };

  const getInputValue = (
    assetId: string,
    field: keyof AssetConfig,
    defaultValue: any
  ) => {
    return editedValues[assetId]?.[field] ?? defaultValue;
  };

  const toggleAsset = (assetId: string) => {
    setExpandedAssetId((prev) => (prev === assetId ? null : assetId));
  };

  // Wrapper for updateCalculator to match original page logic
  const updateCalculatorState = (assetId: string, updates: any) => {
    updateCalculator(assetId, updates);
  };

  // Re-implement Campaign Helpers using the Hook's updateCalculator
  const addCampaign = (assetId: string, slug: string) => {
    const now = new Date();
    let name = "New Campaign";
    let discount = 10;
    let start = now;
    let end = new Date(now);
    end.setDate(now.getDate() + 14);

    if (slug === "late-escape") {
      name = "Late Escape";
      discount = 30;
      end.setDate(now.getDate() + 7);
    } else if (slug === "early-deal") {
      name = "Early Deal";
      discount = 20;
      start = new Date(now);
      start.setDate(now.getDate() + 30);
      end = new Date(start);
      end.setDate(start.getDate() + 30);
    } else if (slug === "basic-deal") {
      name = "Basic Deal";
      discount = 15;
    } else if (slug === "black-friday") {
      name = "Black Friday";
      discount = 40;
    }

    const newCampaign = {
      id: Math.random().toString(36).substr(2, 9),
      slug,
      name,
      discount,
      startDate: start,
      endDate: end,
      active: true,
      isEditing: true,
    };

    const currentCamps = calculatorStates[assetId]?.campaigns || [];
    updateCalculator(assetId, { campaigns: [...currentCamps, newCampaign] });
  };

  const updateCampaign = (assetId: string, campId: string, updates: any) => {
    const currentCamps = calculatorStates[assetId]?.campaigns || [];
    const newCamps = currentCamps.map((c) =>
      c.id === campId ? { ...c, ...updates } : c
    );
    updateCalculator(assetId, { campaigns: newCamps });
  };

  const confirmCampaignEdit = (assetId: string, campId: string) => {
    const currentCamps = calculatorStates[assetId]?.campaigns || [];
    const newCamps = currentCamps.map((c) =>
      c.id === campId ? { ...c, isEditing: false } : c
    );
    updateCalculator(assetId, { campaigns: newCamps });
    // Trigger immediate save to persist the "Edit Mode" exit and new values
    saveAssetSettings(assetId);
  };

  const removeCampaign = (assetId: string, campId: string) => {
    const currentCamps = calculatorStates[assetId]?.campaigns || [];
    const newCamps = currentCamps.filter((c) => c.id !== campId);
    updateCalculator(assetId, { campaigns: newCamps });
    saveAssetSettings(assetId); // Persist deletion immediately
  };

  const editCampaign = (assetId: string, campId: string) => {
    const currentCamps = calculatorStates[assetId]?.campaigns || [];
    const newCamps = currentCamps.map((c) =>
      c.id === campId ? { ...c, isEditing: true } : c
    );
    updateCalculator(assetId, { campaigns: newCamps });
  };

  return (
    <div style={styles.page} className="property-hub-page-wrapper">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .property-hub-page-wrapper::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background-image: linear-gradient(rgba(57,189,248,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(57,189,248,0.03)_1px,transparent_1px);
          background-size: 64px 64px; z-index: 5; 
        }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; margin: 0; 
        }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div style={styles.gradientBg}></div>

      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <h1 style={styles.h1}>Property Hub</h1>
          <p style={styles.pSub}>
            Manage all Sentinel AI tools and asset configurations
          </p>
        </div>

        {/* Tools Grid */}
        <div style={styles.toolsSection}>
          <h2 style={styles.h2}>Tools</h2>
          <div style={styles.toolsGrid}>
            <Card
              style={styles.card}
              className="hover:border-[#39BDF8]/50 transition-colors"
              onClick={() => onNavigate("shadowfax")}
            >
              <CardHeader>
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderContent}>
                    <div
                      style={{
                        ...styles.toolIconWrapperBase,
                        ...styles.toolIconWrapperShadowfax,
                      }}
                    >
                      <Wind style={styles.toolIcon} />
                    </div>
                    <div>
                      <CardTitle style={styles.cardTitle}>Shadowfax</CardTitle>
                      <CardDescription style={styles.cardDescShadowfax}>
                        Live Price Checker
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p style={styles.cardP}>Run on-demand, live price scrapes.</p>
              </CardContent>
            </Card>

            <Card style={styles.cardDisabled}>
              <CardHeader>
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderContent}>
                    <div
                      style={{
                        ...styles.toolIconWrapperBase,
                        ...styles.toolIconWrapperCalc,
                      }}
                    >
                      <Calculator style={styles.toolIcon} />
                    </div>
                    <div>
                      <CardTitle
                        style={{ ...styles.cardTitle, color: "#9ca3af" }}
                      >
                        Channel Rate Replicator
                      </CardTitle>
                      <CardDescription style={styles.cardDescCalc}>
                        Predict Final Sell Rates
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-[#faff6a]/10 text-[#faff6a] border-[#faff6a]/30"
                  >
                    Coming Soon
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p style={styles.cardPDisabled}>
                  Two-way calculator for checking discount stacks.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Master Asset Configuration Table */}
        <Card style={styles.card}>
          <CardHeader>
            <CardTitle style={styles.h2}>Master Asset Configuration</CardTitle>
            <CardDescription style={styles.pSub}>
              Configure Sentinel settings and AI boundaries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={styles.tableWrapper}>
              {isLoading ? (
                <div style={styles.loaderWrapper}>
                  <Loader2 style={styles.loaderIcon} />
                  <p style={styles.loaderText}>Loading Assets...</p>
                </div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Hotel</th>
                      <th style={styles.th}>Multiplier</th>
                      <th style={styles.thCenter}>Booking.com URL</th>
                      <th style={styles.th}>Active Deals</th>
                      <th style={styles.thCenter}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => {
                      const isExpanded = expandedAssetId === asset.id;
                      const isHovered = hoveredAssetId === asset.id;
                      const rowStyle = isExpanded
                        ? styles.trActive
                        : isHovered
                        ? styles.trActive
                        : styles.trBase;

                      // Safely access calculator state
                      const calcState = calculatorStates[asset.id];
                      if (!calcState) return null;

                      const geniusDiscount = getInputValue(
                        asset.id,
                        "genius_discount_pct",
                        asset.genius_discount_pct ?? 0
                      );

                      // Badge Logic
                      const badges = [];
                      if (calcState.multiplier !== 1.0) {
                        badges.push({
                          label: `x${calcState.multiplier} Multiplier`,
                          type: "multiplier",
                        });
                      }
                      if (geniusDiscount > 0)
                        badges.push({
                          label: `Genius (${geniusDiscount}%)`,
                          type: "genius",
                        });
                      if (calcState.mobileActive)
                        badges.push({
                          label: `Mobile (${calcState.mobilePercent}%)`,
                          type: "plan",
                        });
                      if (calcState.nonRefundableActive)
                        badges.push({
                          label: `Non-Ref (${calcState.nonRefundablePercent}%)`,
                          type: "plan",
                        });

                      (calcState.campaigns || []).forEach((c) => {
                        if (c.active)
                          badges.push({
                            label: `${c.name} (${c.discount}%)`,
                            type: "campaign",
                          });
                      });

                      return (
                        <Fragment key={asset.id}>
                          <tr
                            style={rowStyle}
                            onMouseEnter={() => setHoveredAssetId(asset.id)}
                            onMouseLeave={() => setHoveredAssetId(null)}
                          >
                            <td style={styles.td}>
                              <div style={styles.hotelCell}>
                                <Building2 style={styles.hotelIcon} />
                                <span style={styles.hotelName}>
                                  {asset.asset_name}
                                </span>
                                {asset.market_pulse_hotel_id ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30 text-xs"
                                  >
                                    Live
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30 text-xs"
                                  >
                                    Off-Platform
                                  </Badge>
                                )}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <span style={{ color: "#e5e5e5" }}>
                                x{calcState.multiplier}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "center",
                                }}
                              >
                                {editingUrlId === asset.id ? (
                                  <Input
                                    type="text"
                                    value={getInputValue(
                                      asset.id,
                                      "booking_com_url",
                                      asset.booking_com_url ?? ""
                                    )}
                                    onChange={(e) =>
                                      handleInputChange(
                                        asset.id,
                                        "booking_com_url",
                                        e.target.value
                                      )
                                    }
                                    onBlur={() => {
                                      const newValue =
                                        editedValues[asset.id]?.booking_com_url;
                                      if (
                                        newValue !== undefined &&
                                        newValue !== asset.booking_com_url
                                      ) {
                                        saveAssetSettings(asset.id, {
                                          booking_com_url: newValue,
                                        });
                                      }
                                      setEditingUrlId(null);
                                    }}
                                    autoFocus
                                    style={styles.inputBase}
                                    className="focus:border-[#39BDF8]/50"
                                    placeholder="https://booking.com/..."
                                  />
                                ) : (
                                  <div
                                    style={styles.urlCell}
                                    className="hover:opacity-80 transition-opacity"
                                    onClick={() => setEditingUrlId(asset.id)}
                                  >
                                    {asset.booking_com_url ? (
                                      <div style={styles.flexItemsCenter}>
                                        <div
                                          style={{
                                            ...styles.urlStatusIconWrapper,
                                            ...styles.urlStatusIconWrapperConfigured,
                                          }}
                                        >
                                          <Check
                                            style={
                                              styles.urlStatusIconConfigured
                                            }
                                          />
                                        </div>
                                        <span
                                          style={styles.urlStatusTextConfigured}
                                        >
                                          Configured
                                        </span>
                                      </div>
                                    ) : (
                                      <div style={styles.flexItemsCenter}>
                                        <div
                                          style={{
                                            ...styles.urlStatusIconWrapper,
                                            ...styles.urlStatusIconWrapperNotSet,
                                          }}
                                        >
                                          <X
                                            style={styles.urlStatusIconNotSet}
                                          />
                                        </div>
                                        <span
                                          style={styles.urlStatusTextNotSet}
                                        >
                                          Not Set
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {badges.map((b, idx) => {
                                  let badgeStyle = {};
                                  if (b.type === "genius")
                                    badgeStyle = {
                                      backgroundColor:
                                        "rgba(57, 189, 248, 0.1)",
                                      color: "#39BDF8",
                                      border:
                                        "1px solid rgba(57, 189, 248, 0.3)",
                                    };
                                  else if (b.type === "plan")
                                    badgeStyle = {
                                      backgroundColor:
                                        "rgba(16, 185, 129, 0.1)",
                                      color: "#10b981",
                                      border:
                                        "1px solid rgba(16, 185, 129, 0.3)",
                                    };
                                  else if (b.type === "campaign")
                                    badgeStyle = {
                                      backgroundColor:
                                        "rgba(250, 255, 106, 0.1)",
                                      color: "#faff6a",
                                      border:
                                        "1px solid rgba(250, 255, 106, 0.3)",
                                    };
                                  else if (b.type === "multiplier")
                                    badgeStyle = {
                                      backgroundColor:
                                        "rgba(249, 115, 22, 0.1)",
                                      color: "#f97316",
                                      border:
                                        "1px solid rgba(249, 115, 22, 0.3)",
                                    };

                                  return (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      style={badgeStyle}
                                    >
                                      {b.label}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div style={styles.actionCell}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleAsset(asset.id)}
                                  style={styles.manageButton}
                                  className="hover:bg-[#1a1a1a] hover:text-[#39BDF8] hover:border-[#39BDF8]"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 mr-1" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                  )}
                                  {isExpanded ? "Collapse" : "Configure"}
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Accordion Row */}
                          {isExpanded && (
                            <tr style={styles.accordionRow}>
                              <td colSpan={5} style={{ padding: 0 }}>
                                <div style={styles.accordionContentWrapper}>
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 1fr",
                                      gap: "32px",
                                    }}
                                  >
                                    {/* LEFT COLUMN: RULES */}
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "24px",
                                      }}
                                    >
                                      <h3 style={styles.columnTitle}>
                                        <span style={{ color: "#39BDF8" }}>
                                          ●
                                        </span>{" "}
                                        Rules
                                      </h3>

                                      {/* Global */}
                                      <div>
                                        <Label style={styles.sectionLabel}>
                                          Global
                                        </Label>
                                        <div style={styles.cardBg}>
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "12px",
                                            }}
                                          >
                                            {/* Multiplier */}
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                              }}
                                            >
                                              <Label
                                                style={{
                                                  ...styles.inputLabel,
                                                  marginBottom: 0,
                                                }}
                                              >
                                                Strategic Multiplier
                                              </Label>
                                              <Input
                                                type="number"
                                                step="0.1"
                                                value={calcState.multiplier}
                                                onChange={(e) =>
                                                  updateCalculatorState(
                                                    asset.id,
                                                    {
                                                      multiplier:
                                                        parseFloat(
                                                          e.target.value
                                                        ) || 0,
                                                    }
                                                  )
                                                }
                                                style={styles.inputSmall}
                                              />
                                            </div>

                                            {/* [NEW] Tax Configuration */}
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                borderTop: "1px solid #2a2a2a",
                                                paddingTop: "12px",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "4px",
                                                }}
                                              >
                                                <Label
                                                  style={{
                                                    ...styles.inputLabel,
                                                    marginBottom: 0,
                                                  }}
                                                >
                                                  Tax Handling
                                                </Label>
                                                <span
                                                  style={{
                                                    fontSize: "10px",
                                                    color: "#6b7280",
                                                  }}
                                                >
                                                  For USA/Exclusive markets
                                                </span>
                                              </div>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  gap: "8px",
                                                }}
                                              >
                                                <Select
                                                  value={calcState.taxType}
                                                  onValueChange={(val: any) =>
                                                    updateCalculatorState(
                                                      asset.id,
                                                      { taxType: val }
                                                    )
                                                  }
                                                >
                                                  <SelectTrigger
                                                    style={{
                                                      ...styles.selectTrigger,
                                                      width: "165px",
                                                    }}
                                                  >
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent
                                                    style={{
                                                      backgroundColor:
                                                        "#1a1a18",
                                                      border:
                                                        "1px solid #262626",

                                                      color: "#e5e5e5",
                                                      width: "165px",
                                                    }}
                                                  >
                                                    <SelectItem value="inclusive">
                                                      Inclusive (EU)
                                                    </SelectItem>
                                                    <SelectItem value="exclusive">
                                                      Exclusive (US)
                                                    </SelectItem>
                                                  </SelectContent>
                                                </Select>

                                                {calcState.taxType ===
                                                  "exclusive" && (
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "4px",
                                                    }}
                                                  >
                                                    <Input
                                                      type="number"
                                                      value={
                                                        calcState.taxPercent
                                                      }
                                                      onChange={(e) =>
                                                        updateCalculatorState(
                                                          asset.id,
                                                          {
                                                            taxPercent:
                                                              parseFloat(
                                                                e.target.value
                                                              ) || 0,
                                                          }
                                                        )
                                                      }
                                                      style={{
                                                        ...styles.inputSmall,
                                                        width: "60px",
                                                      }}
                                                    />
                                                    <span
                                                      style={{
                                                        color: "#6b7280",
                                                        fontSize: "12px",
                                                      }}
                                                    >
                                                      %
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Rate Plans */}
                                      <div>
                                        <Label style={styles.sectionLabel}>
                                          Rate Plans
                                        </Label>
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                          }}
                                        >
                                          <div style={styles.cardBg}>
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "12px",
                                                }}
                                              >
                                                <Checkbox
                                                  checked={
                                                    calcState.nonRefundableActive
                                                  }
                                                  onCheckedChange={(c) =>
                                                    updateCalculatorState(
                                                      asset.id,
                                                      {
                                                        nonRefundableActive:
                                                          !!c,
                                                      }
                                                    )
                                                  }
                                                  style={{
                                                    borderColor: "#2a2a2a",
                                                  }}
                                                />
                                                <Label
                                                  style={{
                                                    ...styles.inputLabel,
                                                    marginBottom: 0,
                                                  }}
                                                >
                                                  Non-Refundable
                                                </Label>
                                              </div>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "4px",
                                                }}
                                              >
                                                <Input
                                                  type="number"
                                                  value={
                                                    calcState.nonRefundablePercent
                                                  }
                                                  onChange={(e) =>
                                                    updateCalculatorState(
                                                      asset.id,
                                                      {
                                                        nonRefundablePercent:
                                                          parseFloat(
                                                            e.target.value
                                                          ) || 0,
                                                      }
                                                    )
                                                  }
                                                  style={styles.inputSmall}
                                                />
                                                <span
                                                  style={{
                                                    color: "#6b7280",
                                                    fontSize: "12px",
                                                  }}
                                                >
                                                  %
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          <div style={styles.cardBg}>
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "12px",
                                                }}
                                              >
                                                <Checkbox
                                                  checked={
                                                    calcState.mobileActive
                                                  }
                                                  onCheckedChange={(c) =>
                                                    updateCalculatorState(
                                                      asset.id,
                                                      { mobileActive: !!c }
                                                    )
                                                  }
                                                  style={{
                                                    borderColor: "#2a2a2a",
                                                  }}
                                                />
                                                <Label
                                                  style={{
                                                    ...styles.inputLabel,
                                                    marginBottom: 0,
                                                  }}
                                                >
                                                  Mobile Rate
                                                </Label>
                                              </div>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "4px",
                                                }}
                                              >
                                                <Input
                                                  type="number"
                                                  value={
                                                    calcState.mobilePercent
                                                  }
                                                  onChange={(e) =>
                                                    updateCalculatorState(
                                                      asset.id,
                                                      {
                                                        mobilePercent:
                                                          parseFloat(
                                                            e.target.value
                                                          ) || 0,
                                                      }
                                                    )
                                                  }
                                                  style={styles.inputSmall}
                                                />
                                                <span
                                                  style={{
                                                    color: "#6b7280",
                                                    fontSize: "12px",
                                                  }}
                                                >
                                                  %
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Static Discounts */}
                                      <div>
                                        <Label style={styles.sectionLabel}>
                                          Static Discounts
                                        </Label>
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                          }}
                                        >
                                          <div style={styles.cardBg}>
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "12px",
                                                }}
                                              >
                                                <Checkbox
                                                  checked={!!geniusDiscount}
                                                  onCheckedChange={(
                                                    checked
                                                  ) => {
                                                    const newVal = checked
                                                      ? geniusDiscount || 10
                                                      : 0;
                                                    handleInputChange(
                                                      asset.id,
                                                      "genius_discount_pct",
                                                      newVal
                                                    );
                                                  }}
                                                  style={{
                                                    borderColor: "#2a2a2a",
                                                  }}
                                                />
                                                <Label
                                                  style={{
                                                    ...styles.inputLabel,
                                                    marginBottom: 0,
                                                  }}
                                                >
                                                  Genius
                                                </Label>
                                              </div>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "4px",
                                                }}
                                              >
                                                <Input
                                                  type="number"
                                                  value={geniusDiscount}
                                                  onChange={(e) => {
                                                    handleInputChange(
                                                      asset.id,
                                                      "genius_discount_pct",
                                                      e.target.value
                                                        ? parseFloat(
                                                            e.target.value
                                                          )
                                                        : null
                                                    );
                                                  }}
                                                  onBlur={() => {
                                                    if (
                                                      editedValues[asset.id]
                                                        ?.genius_discount_pct !==
                                                      undefined
                                                    ) {
                                                      saveAssetSettings(
                                                        asset.id,
                                                        {
                                                          genius_discount_pct:
                                                            editedValues[
                                                              asset.id
                                                            ]
                                                              ?.genius_discount_pct,
                                                        }
                                                      );
                                                    }
                                                  }}
                                                  style={styles.inputSmall}
                                                />
                                                <span
                                                  style={{
                                                    color: "#6b7280",
                                                    fontSize: "12px",
                                                  }}
                                                >
                                                  %
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Campaigns */}
                                      <div>
                                        <Label style={styles.sectionLabel}>
                                          Campaigns
                                        </Label>
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "12px",
                                          }}
                                        >
                                          {/* Campaign List */}
                                          {(calcState.campaigns || []).map(
                                            (camp) => (
                                              <div
                                                key={camp.id}
                                                style={{
                                                  ...styles.cardBg,
                                                  ...(camp.isEditing
                                                    ? {
                                                        backgroundColor:
                                                          "rgba(57, 189, 248, 0.05)",
                                                        border:
                                                          "1px solid #39BDF8",
                                                      }
                                                    : {}),
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    flexDirection:
                                                      camp.isEditing
                                                        ? "column"
                                                        : "row",
                                                    alignItems: camp.isEditing
                                                      ? "flex-start"
                                                      : "center",
                                                    justifyContent:
                                                      "space-between",
                                                    gap: camp.isEditing
                                                      ? "16px"
                                                      : "0",
                                                  }}
                                                >
                                                  {/* Left: Toggle & Name */}
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "12px",
                                                      width: camp.isEditing
                                                        ? "100%"
                                                        : "auto",
                                                    }}
                                                  >
                                                    <Checkbox
                                                      checked={camp.active}
                                                      onCheckedChange={(c) =>
                                                        updateCampaign(
                                                          asset.id,
                                                          camp.id,
                                                          { active: !!c }
                                                        )
                                                      }
                                                      style={{
                                                        borderColor: "#2a2a2a",
                                                      }}
                                                    />
                                                    <Label
                                                      style={{
                                                        ...styles.inputLabel,
                                                        marginBottom: 0,
                                                        color: camp.isEditing
                                                          ? "#39BDF8"
                                                          : "#e5e5e5",
                                                      }}
                                                    >
                                                      {camp.name}
                                                    </Label>
                                                  </div>

                                                  {/* Right: Date Logic & Controls */}
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      alignItems: "center",
                                                      gap: "12px",
                                                      width: camp.isEditing
                                                        ? "100%"
                                                        : "auto",
                                                      justifyContent:
                                                        camp.isEditing
                                                          ? "space-between"
                                                          : "flex-end",
                                                    }}
                                                  >
                                                    {/* Mode: EDITING */}
                                                    {camp.isEditing ? (
                                                      <div
                                                        style={{
                                                          display: "flex",
                                                          gap: "16px",
                                                          width: "100%",
                                                        }}
                                                      >
                                                        <div
                                                          style={{
                                                            display: "grid",
                                                            gridTemplateColumns:
                                                              "1fr 1fr 80px",
                                                            gap: "12px",
                                                            flex: 1,
                                                          }}
                                                        >
                                                          <div>
                                                            <Label
                                                              style={{
                                                                fontSize:
                                                                  "10px",
                                                                color:
                                                                  "#9ca3af",
                                                                marginBottom:
                                                                  "4px",
                                                              }}
                                                            >
                                                              Start Date
                                                            </Label>
                                                            <Popover>
                                                              <PopoverTrigger
                                                                asChild
                                                              >
                                                                <Button
                                                                  variant="outline"
                                                                  className="w-full h-8 text-xs border-[#39BDF8]/30 bg-[#0f0f0f] text-[#e5e5e5] justify-start text-left font-normal"
                                                                >
                                                                  <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                                                                  {camp.startDate
                                                                    ? format(
                                                                        camp.startDate,
                                                                        "MMM d"
                                                                      )
                                                                    : "Pick date"}
                                                                </Button>
                                                              </PopoverTrigger>
                                                              <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                                                <Calendar
                                                                  mode="single"
                                                                  selected={
                                                                    camp.startDate
                                                                  }
                                                                  onSelect={(
                                                                    d
                                                                  ) =>
                                                                    updateCampaign(
                                                                      asset.id,
                                                                      camp.id,
                                                                      {
                                                                        startDate:
                                                                          d,
                                                                      }
                                                                    )
                                                                  }
                                                                />
                                                              </PopoverContent>
                                                            </Popover>
                                                          </div>
                                                          <div>
                                                            <Label
                                                              style={{
                                                                fontSize:
                                                                  "10px",
                                                                color:
                                                                  "#9ca3af",
                                                                marginBottom:
                                                                  "4px",
                                                              }}
                                                            >
                                                              End Date
                                                            </Label>
                                                            <Popover>
                                                              <PopoverTrigger
                                                                asChild
                                                              >
                                                                <Button
                                                                  variant="outline"
                                                                  className="w-full h-8 text-xs border-[#39BDF8]/30 bg-[#0f0f0f] text-[#e5e5e5] justify-start text-left font-normal"
                                                                >
                                                                  <CalendarIcon className="mr-2 h-3 w-3 opacity-50" />
                                                                  {camp.endDate
                                                                    ? format(
                                                                        camp.endDate,
                                                                        "MMM d"
                                                                      )
                                                                    : "Pick date"}
                                                                </Button>
                                                              </PopoverTrigger>
                                                              <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                                                <Calendar
                                                                  mode="single"
                                                                  selected={
                                                                    camp.endDate
                                                                  }
                                                                  onSelect={(
                                                                    d
                                                                  ) =>
                                                                    updateCampaign(
                                                                      asset.id,
                                                                      camp.id,
                                                                      {
                                                                        endDate:
                                                                          d,
                                                                      }
                                                                    )
                                                                  }
                                                                />
                                                              </PopoverContent>
                                                            </Popover>
                                                          </div>
                                                          <div>
                                                            <Label
                                                              style={{
                                                                fontSize:
                                                                  "10px",
                                                                color:
                                                                  "#9ca3af",
                                                                marginBottom:
                                                                  "4px",
                                                              }}
                                                            >
                                                              Discount %
                                                            </Label>
                                                            <Input
                                                              type="number"
                                                              value={
                                                                camp.discount
                                                              }
                                                              onChange={(e) =>
                                                                updateCampaign(
                                                                  asset.id,
                                                                  camp.id,
                                                                  {
                                                                    discount:
                                                                      parseFloat(
                                                                        e.target
                                                                          .value
                                                                      ) || 0,
                                                                  }
                                                                )
                                                              }
                                                              style={{
                                                                backgroundColor:
                                                                  "#0f0f0f",
                                                                height: "32px",
                                                              }}
                                                              className="border-[#39BDF8]/30 text-[#e5e5e5] focus:border-[#39BDF8]"
                                                            />
                                                          </div>
                                                        </div>
                                                        <div
                                                          style={{
                                                            display: "flex",
                                                            alignItems:
                                                              "flex-end",
                                                          }}
                                                        >
                                                          <Button
                                                            size="sm"
                                                            onClick={() =>
                                                              confirmCampaignEdit(
                                                                asset.id,
                                                                camp.id
                                                              )
                                                            }
                                                            className="h-8 bg-[#39BDF8] text-[#0f0f0f] hover:bg-[#29ADEE]"
                                                          >
                                                            <Check className="h-4 w-4" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      // Mode: VIEW
                                                      <>
                                                        <div
                                                          style={{
                                                            fontSize: "11px",
                                                            color: "#6b7280",
                                                            display: "flex",
                                                            flexDirection:
                                                              "column",
                                                            alignItems:
                                                              "flex-end",
                                                            lineHeight: "1.1",
                                                          }}
                                                        >
                                                          <span
                                                            onClick={() =>
                                                              editCampaign(
                                                                asset.id,
                                                                camp.id
                                                              )
                                                            }
                                                            style={{
                                                              cursor: "pointer",
                                                              borderBottom:
                                                                "1px dashed #2a2a2a",
                                                            }}
                                                            className="hover:text-[#39BDF8] hover:border-[#39BDF8]"
                                                          >
                                                            {camp.startDate
                                                              ? format(
                                                                  camp.startDate,
                                                                  "MMM d"
                                                                )
                                                              : "?"}{" "}
                                                            -{" "}
                                                            {camp.endDate
                                                              ? format(
                                                                  camp.endDate,
                                                                  "MMM d"
                                                                )
                                                              : "?"}
                                                          </span>
                                                        </div>
                                                        <div
                                                          style={{
                                                            display: "flex",
                                                            alignItems:
                                                              "center",
                                                            gap: "4px",
                                                          }}
                                                        >
                                                          <Input
                                                            type="number"
                                                            value={
                                                              camp.discount
                                                            }
                                                            onChange={(e) =>
                                                              updateCampaign(
                                                                asset.id,
                                                                camp.id,
                                                                {
                                                                  discount:
                                                                    parseFloat(
                                                                      e.target
                                                                        .value
                                                                    ) || 0,
                                                                }
                                                              )
                                                            }
                                                            style={
                                                              styles.inputSmall
                                                            }
                                                          />
                                                          <span
                                                            style={{
                                                              color: "#6b7280",
                                                              fontSize: "12px",
                                                            }}
                                                          >
                                                            %
                                                          </span>
                                                        </div>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() =>
                                                            removeCampaign(
                                                              asset.id,
                                                              camp.id
                                                            )
                                                          }
                                                          className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                        >
                                                          <X className="h-4 w-4" />
                                                        </Button>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            )
                                          )}

                                          {/* Add Campaign Button */}
                                          <Select
                                            onValueChange={(val) =>
                                              addCampaign(asset.id, val)
                                            }
                                          >
                                            <SelectTrigger
                                              style={styles.selectTrigger}
                                              className="border-dashed border-[#2a2a2a] text-[#9ca3af] hover:text-[#39BDF8] hover:border-[#39BDF8] transition-colors"
                                            >
                                              <SelectValue placeholder="+ Add Campaign" />
                                            </SelectTrigger>
                                            <SelectContent
                                              style={{
                                                backgroundColor: "#1a1a18",
                                                border: "1px solid #262626",
                                                color: "#e5e5e5",
                                              }}
                                            >
                                              <SelectItem value="late-escape">
                                                Late Escape
                                              </SelectItem>
                                              <SelectItem value="early-deal">
                                                Early Deal
                                              </SelectItem>
                                              <SelectItem value="basic-deal">
                                                Basic Deal
                                              </SelectItem>
                                              <SelectItem value="black-friday">
                                                Black Friday
                                              </SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                    </div>

                                    {/* RIGHT COLUMN: SIMULATOR */}
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "24px",
                                      }}
                                    >
                                      <h3 style={styles.columnTitle}>
                                        <span style={{ color: "#39BDF8" }}>
                                          ●
                                        </span>{" "}
                                        Simulator
                                      </h3>

                                      <div>
                                        <Label style={styles.sectionLabel}>
                                          Test Stay Date
                                        </Label>
                                        <div
                                          style={{
                                            ...styles.cardBg,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                          }}
                                        >
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="outline"
                                                style={{
                                                  ...styles.inputBase,
                                                  width: "100%",
                                                  justifyContent: "flex-start",
                                                  paddingLeft: "12px",
                                                }}
                                              >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {calcState.testStayDate
                                                  ? format(
                                                      calcState.testStayDate,
                                                      "PPP"
                                                    )
                                                  : "Pick a date"}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 bg-[#1a1a18] border-[#2a2a2a]">
                                              <Calendar
                                                mode="single"
                                                selected={
                                                  calcState.testStayDate
                                                }
                                                onSelect={(d) =>
                                                  updateCalculatorState(
                                                    asset.id,
                                                    { testStayDate: d }
                                                  )
                                                }
                                              />
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                      </div>

                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1fr 1fr",
                                          gap: "16px",
                                        }}
                                      >
                                        <div>
                                          <Label style={styles.inputLabel}>
                                            Target Sell Rate
                                          </Label>
                                          <div style={{ position: "relative" }}>
                                            <PoundSterling
                                              style={{
                                                position: "absolute",
                                                left: "12px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                width: "12px",
                                                height: "12px",
                                                color: "#39BDF8",
                                              }}
                                            />
                                            <Input
                                              type="number"
                                              value={Math.round(
                                                calcState.targetSellRate
                                              )}
                                              onFocus={() =>
                                                updateCalculatorState(
                                                  asset.id,
                                                  { editingField: "target" }
                                                )
                                              }
                                              onChange={(e) =>
                                                updateCalculatorState(
                                                  asset.id,
                                                  {
                                                    targetSellRate:
                                                      parseFloat(
                                                        e.target.value
                                                      ) || 0,
                                                  }
                                                )
                                              }
                                              style={{
                                                ...styles.inputBase,
                                                paddingLeft: "36px",
                                              }}
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <Label style={styles.inputLabel}>
                                            PMS Rate
                                          </Label>
                                          <div style={{ position: "relative" }}>
                                            <PoundSterling
                                              style={{
                                                position: "absolute",
                                                left: "12px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                width: "12px",
                                                height: "12px",
                                                color: "#39BDF8",
                                              }}
                                            />
                                            <Input
                                              type="number"
                                              value={Math.round(
                                                calcState.pmsRate
                                              )}
                                              onFocus={() =>
                                                updateCalculatorState(
                                                  asset.id,
                                                  { editingField: "pms" }
                                                )
                                              }
                                              onChange={(e) =>
                                                updateCalculatorState(
                                                  asset.id,
                                                  {
                                                    pmsRate:
                                                      parseFloat(
                                                        e.target.value
                                                      ) || 0,
                                                  }
                                                )
                                              }
                                              style={{
                                                ...styles.inputBase,
                                                paddingLeft: "36px",
                                              }}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Visual Waterfall - RECREATED EXACTLY */}
                                      <div>
                                        <Label style={styles.sectionLabel}>
                                          Price Waterfall (Highest → Lowest)
                                        </Label>
                                        <div
                                          style={{
                                            ...styles.cardBg,
                                            padding: "16px",
                                          }}
                                        >
                                          {(() => {
                                            const steps = [];
                                            const pmsVal = Number(
                                              calcState.pmsRate
                                            );
                                            const multiplierVal =
                                              pmsVal *
                                              Number(calcState.multiplier);

                                            let currentRate = multiplierVal;
                                            steps.push({
                                              label: `Multiplier Rate (Base £${pmsVal.toFixed(
                                                2
                                              )} × ${calcState.multiplier})`,
                                              rate: currentRate,
                                              indent: 0,
                                            });

                                            if (calcState.nonRefundableActive) {
                                              currentRate =
                                                currentRate *
                                                (1 -
                                                  Number(
                                                    calcState.nonRefundablePercent
                                                  ) /
                                                    100);
                                              steps.push({
                                                label: `Non-Refundable Rate Plan (-${calcState.nonRefundablePercent}%)`,
                                                rate: currentRate,
                                                indent: 0,
                                              });
                                            }

                                            // [NEW] Tax Step
                                            if (
                                              calcState.taxType ===
                                                "exclusive" &&
                                              calcState.taxPercent > 0
                                            ) {
                                              const taxAmt =
                                                currentRate *
                                                (Number(calcState.taxPercent) /
                                                  100);
                                              currentRate =
                                                currentRate + taxAmt;
                                              steps.push({
                                                label: `Tax / Fees (+${calcState.taxPercent}%)`,
                                                rate: currentRate,
                                                indent: 0,
                                                isBold: true,
                                                color: "#faff6a",
                                              });
                                            }

                                            const deepDeal = (
                                              calcState.campaigns || []
                                            ).find(
                                              (c) =>
                                                [
                                                  "black-friday",
                                                  "limited-time",
                                                ].includes(c.slug) &&
                                                isCampaignValidForDate(
                                                  calcState.testStayDate,
                                                  c
                                                )
                                            );

                                            if (deepDeal) {
                                              currentRate =
                                                currentRate *
                                                (1 -
                                                  Number(deepDeal.discount) /
                                                    100);
                                              steps.push({
                                                label: `⚡ ${deepDeal.name} (Exclusive -${deepDeal.discount}%)`,
                                                rate: currentRate,
                                                indent: 1,
                                                isBold: true,
                                              });
                                            } else {
                                              const gPct =
                                                Number(geniusDiscount);
                                              if (gPct > 0) {
                                                currentRate =
                                                  currentRate *
                                                  (1 - gPct / 100);
                                                steps.push({
                                                  label: `Genius (-${gPct}%)`,
                                                  rate: currentRate,
                                                  indent: 1,
                                                });
                                              }

                                              const validStandard = (
                                                calcState.campaigns || []
                                              ).filter(
                                                (c) =>
                                                  ![
                                                    "black-friday",
                                                    "limited-time",
                                                  ].includes(c.slug) &&
                                                  isCampaignValidForDate(
                                                    calcState.testStayDate,
                                                    c
                                                  )
                                              );
                                              if (validStandard.length > 0) {
                                                const best =
                                                  validStandard.reduce((p, c) =>
                                                    p.discount > c.discount
                                                      ? p
                                                      : c
                                                  );
                                                currentRate =
                                                  currentRate *
                                                  (1 -
                                                    Number(best.discount) /
                                                      100);
                                                steps.push({
                                                  label: `${best.name} (-${best.discount}%)`,
                                                  rate: currentRate,
                                                  indent: 1,
                                                });
                                              }

                                              const isMobileBlocked =
                                                !!deepDeal ||
                                                validStandard.some((c) =>
                                                  [
                                                    "early-deal",
                                                    "late-escape",
                                                    "getaway-deal",
                                                  ].includes(c.slug)
                                                );
                                              if (
                                                calcState.mobileActive &&
                                                !isMobileBlocked
                                              ) {
                                                currentRate =
                                                  currentRate *
                                                  (1 -
                                                    Number(
                                                      calcState.mobilePercent
                                                    ) /
                                                      100);
                                                steps.push({
                                                  label: `Mobile Rate (-${calcState.mobilePercent}%)`,
                                                  rate: currentRate,
                                                  indent: 1,
                                                });
                                              }

                                              if (calcState.countryRateActive) {
                                                currentRate =
                                                  currentRate *
                                                  (1 -
                                                    Number(
                                                      calcState.countryRatePercent
                                                    ) /
                                                      100);
                                                steps.push({
                                                  label: `Country Rate (-${calcState.countryRatePercent}%)`,
                                                  rate: currentRate,
                                                  indent: 1,
                                                });
                                              }
                                            }

                                            steps.push({
                                              label: "Final Sell Rate",
                                              rate: currentRate,
                                              indent: 0,
                                              isFinal: true,
                                            });

                                            return (
                                              <div
                                                style={{
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "6px",
                                                  fontFamily: "monospace",
                                                }}
                                              >
                                                {steps.map((step, i) => (
                                                  <div
                                                    key={i}
                                                    style={{
                                                      paddingLeft: `${
                                                        step.indent * 12
                                                      }px`,
                                                      fontSize: "12px",
                                                      display: "flex",
                                                      justifyContent:
                                                        "space-between",
                                                      color: step.isFinal
                                                        ? "#10b981"
                                                        : "#e5e5e5",
                                                      borderTop: step.isFinal
                                                        ? "1px solid #2a2a2a"
                                                        : "none",
                                                      marginTop: step.isFinal
                                                        ? "8px"
                                                        : 0,
                                                      paddingTop: step.isFinal
                                                        ? "8px"
                                                        : 0,
                                                      fontWeight: step.isFinal
                                                        ? "bold"
                                                        : "normal",
                                                    }}
                                                  >
                                                    <span>
                                                      {step.indent > 0
                                                        ? "└ "
                                                        : ""}
                                                      {step.label}
                                                    </span>
                                                    <span>
                                                      £{step.rate.toFixed(2)}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Footer Actions */}
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "flex-end",
                                      gap: "12px",
                                      paddingTop: "24px",
                                      marginTop: "24px",
                                      borderTop: "1px solid #2a2a2a",
                                    }}
                                  >
                                    <Button
                                      variant="outline"
                                      onClick={() => toggleAsset(asset.id)}
                                      style={{
                                        borderColor: "#2a2a2a",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        saveAssetSettings(asset.id)
                                      }
                                      style={{
                                        backgroundColor: "#39BDF8",
                                        color: "#0f0f0f",
                                      }}
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
