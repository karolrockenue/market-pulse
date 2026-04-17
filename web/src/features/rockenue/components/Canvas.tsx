// ── Canvas: Design system color reference + UX studies ──

import { ChevronDown, Check, Plus, Sparkles, X, Rocket, PartyPopper, ArrowRight } from "lucide-react";

const R = {
  bg: "#14181D",
  card: "#121519",
  cardLight: "#1C2228",
  cardRaised: "#1C2228",
  darkBand: "#0C0E12",
  border: "#1E2330",
  sep: "rgba(255,255,255,0.04)",
  sidebar: "#0C0E12",
  accent: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  teal: "#39BDF8",
  warmTeal: "#38C6BA",
  gold: "#C8A66E",
  green: "#34D068",
  red: "#ef4444",
};

const sections = [
  {
    title: "Surfaces",
    colors: [
      { hex: "#14181D", label: "Page background", token: "R.bg" },
      { hex: "#1C2228", label: "Card surfaces (general)", token: "R.card" },
      { hex: "#121519", label: "Dark band / Compset Intel cards", token: "R.darkBand" },
      { hex: "#1E2330", label: "Structural borders", token: "R.border" },
      { hex: "#0C0E12", label: "Sidebar deepest", token: "R.sidebar" },
    ],
  },
  {
    title: "Text Hierarchy",
    colors: [
      { hex: "#F3F5F7", label: "Primary text, headings", token: "R.accent" },
      { hex: "#B0B8C4", label: "Secondary text, body", token: "R.text" },
      { hex: "#7A8494", label: "Mid gray, descriptions", token: "R.textMid" },
      { hex: "#4E5868", label: "Dim labels, timestamps", token: "R.textDim" },
    ],
  },
  {
    title: "Accents",
    colors: [
      { hex: "#39BDF8", label: "Global teal — app-wide accent, CTAs", token: "R.teal" },
      { hex: "#38C6BA", label: "Warm teal — Compset Intel KPIs, charts, winning", token: "local" },
      { hex: "#C8A66E", label: "Gold — eyebrows, subtitles, trailing/attention", token: "R.gold" },
    ],
  },
  {
    title: "Status",
    colors: [
      { hex: "#34D068", label: "Positive / green (dashboard, deltas)", token: "R.green" },
      { hex: "#ef4444", label: "Negative / red (errors, losses)", token: "R.red" },
    ],
  },
  {
    title: "Key Insights Pairing",
    colors: [
      { hex: "#38C6BA", label: "Winning — warm teal", token: "—" },
      { hex: "#C8A66E", label: "Trailing — gold (soft, not alarming)", token: "—" },
    ],
  },
  {
    title: "Blue Accent Candidates",
    colors: [
      { hex: "#4A7FA8", label: "Deep steel — closest to navy family, very subtle", token: "—" },
      { hex: "#5B8DB8", label: "Mid steel — balanced, readable, recommended", token: "—" },
      { hex: "#6A9BC5", label: "Brighter steel — more visible on dark backgrounds", token: "—" },
      { hex: "#7BAFD4", label: "Light airy — good for secondary/tertiary accents", token: "—" },
    ],
  },
];

// ══════════════════════════════════════════
// MOCKUP HELPERS — shared row primitives
// ══════════════════════════════════════════

function MockupFrame({ eyebrow, title, caption, children }: { eyebrow: string; title: string; caption: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase" }}>{eyebrow}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: R.accent }}>{title}</span>
      </div>
      <p style={{ fontSize: 11, color: R.textDim, margin: "0 0 12px", lineHeight: 1.5 }}>{caption}</p>
      {children}
    </div>
  );
}


// ══════════════════════════════════════════
// OPTION D — User's proposed flow:
//   Click "Add override" → empty row appears → pick hotel →
//   horizontal waterfall boxes expand below (mirroring main pipeline) →
//   edit → save → row collapses, showing divergence vs global.
// Variants below cover (D1) empty row, (D2) horizontal expanded state, (D3) collapsed post-save state.
// ══════════════════════════════════════════

// Shared: a small arrow connector between waterfall boxes
function Arrow({ active, color }: { active: boolean; color?: string }) {
  const c = color ?? (active ? R.border : `${R.border}50`);
  return (
    <div style={{ width: 24, height: 1, background: c, position: "relative", flexShrink: 0 }}>
      <div style={{
        position: "absolute", right: -3, top: -3, width: 0, height: 0,
        borderTop: "3px solid transparent", borderBottom: "3px solid transparent",
        borderLeft: `5px solid ${c}`,
      }} />
    </div>
  );
}

// D1 — Empty add-row (before a hotel is picked)
function MockupD_EmptyRow() {
  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Per-Hotel Overrides</span>
          <span style={{ color: R.textDim, fontSize: 11 }}>— Booking.com</span>
        </div>
        <button style={{
          padding: "6px 14px", borderRadius: 6, border: `1px solid ${R.border}`,
          background: R.cardRaised, color: R.textMid, fontSize: 11, fontWeight: 500, cursor: "pointer",
        }}>+ Add Override</button>
      </div>

      {/* Freshly-appended empty row — hotel picker visible, Save disabled */}
      <div style={{
        display: "grid", gridTemplateColumns: "24px 1fr auto 120px",
        padding: "12px 20px", alignItems: "center", gap: 12,
        background: `${R.gold}05`, borderBottom: `1px solid ${R.gold}15`,
      }}>
        <Plus size={14} style={{ color: R.gold }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select style={{
            padding: "6px 11px", fontSize: 12, color: R.text, minWidth: 220,
            background: R.darkBand, border: `1px solid ${R.border}`, borderRadius: 5, outline: "none",
          }}>
            <option>Pick a hotel…</option>
            <option>Elysee Hyde Park</option>
            <option>The Melita</option>
          </select>
          <span style={{ fontSize: 10, color: R.textDim }}>Box grid expands once a hotel is selected</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button disabled style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 4,
            background: R.border, border: "none", color: R.textDim, cursor: "not-allowed", fontWeight: 600,
          }}>Save</button>
          <button style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 4,
            background: "transparent", border: `1px solid ${R.border}`, color: R.textDim, cursor: "pointer",
          }}>Cancel</button>
        </div>
        <span />
      </div>

      {/* Existing row for context */}
      <div style={{
        display: "grid", gridTemplateColumns: "24px 1fr auto 120px",
        padding: "12px 20px", alignItems: "center", gap: 12,
      }}>
        <Check size={14} style={{ color: R.warmTeal, opacity: 0.4 }} />
        <span style={{ color: R.textDim, fontSize: 13 }}>The W14 Hotel</span>
        <span style={{ fontSize: 10, color: R.warmTeal }}>Global</span>
        <div style={{ textAlign: "right" }}>
          <span style={{ color: R.warmTeal, fontSize: 12, fontWeight: 500 }}>£156.31</span>
        </div>
      </div>
    </div>
  );
}

// D2c — Split row: two stacked pipelines (default on top, override below) for full-clarity comparison
function MockupD_Expanded_DualRow() {
  const steps = [
    { key: "multiplier", label: "Multiplier", type: "multiplier" as const, defaultV: 1.42, v: 1.42, active: true },
    { key: "nrf", label: "Non-Ref", type: "discount" as const, defaultV: 10, v: 10, active: true },
    { key: "genius", label: "Genius", type: "discount" as const, defaultV: 15, v: 18, active: true },
    { key: "campaign", label: "Campaign", type: "discount" as const, defaultV: 30, v: 35, active: true },
    { key: "mobile", label: "Mobile", type: "discount" as const, defaultV: 10, v: 10, active: false },
  ];
  let runD = 185; let runO = 185;
  steps.forEach(s => {
    if (s.active) {
      if (s.type === "multiplier") { runD *= s.defaultV; runO *= s.v; }
      else { runD *= (1 - s.defaultV / 100); runO *= (1 - s.v / 100); }
    }
  });

  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Per-Hotel Overrides</span>
          <span style={{ color: R.textDim, fontSize: 11 }}>— Booking.com</span>
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "24px 1fr auto 120px",
        padding: "12px 20px", alignItems: "center", gap: 12,
        background: `${R.gold}08`, borderBottom: `1px solid ${R.gold}20`,
      }}>
        <ChevronDown size={14} style={{ color: R.gold }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: R.accent, fontSize: 13, fontWeight: 500 }}>Elysee Hyde Park</span>
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: `${R.gold}15`, color: R.gold, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Drafting</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 4,
            background: R.warmTeal, border: "none", color: R.darkBand, cursor: "pointer", fontWeight: 600,
          }}>Save</button>
          <button style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 4,
            background: "transparent", border: `1px solid ${R.border}`, color: R.textDim, cursor: "pointer",
          }}>Cancel</button>
        </div>
        <span />
      </div>
      <div style={{ padding: "14px 24px 18px 44px", background: R.darkBand, borderBottom: `1px solid ${R.sep}` }}>
        {/* Global row (compact, non-editable) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.textDim, textTransform: "uppercase", width: 60 }}>Global</span>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ width: 80, textAlign: "center", fontSize: 11, color: R.textDim, fontVariantNumeric: "tabular-nums" }}>£185</div>
            {steps.map(s => (
              <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
                <Arrow active={s.active} />
                <div style={{ width: 80, textAlign: "center", opacity: s.active ? 1 : 0.35 }}>
                  <div style={{ fontSize: 11, color: R.textMid, fontVariantNumeric: "tabular-nums" }}>
                    {s.type === "multiplier" ? `${s.defaultV}×` : `−${s.defaultV}%`}
                  </div>
                </div>
              </div>
            ))}
            <Arrow active color={`${R.warmTeal}60`} />
            <div style={{ width: 80, textAlign: "center", fontSize: 11, color: R.warmTeal, fontVariantNumeric: "tabular-nums" }}>£{runD.toFixed(2)}</div>
          </div>
        </div>
        {/* Override row (editable boxes) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: R.gold, textTransform: "uppercase", width: 60 }}>Elysee</span>
          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <div style={{ width: 80, textAlign: "center", fontSize: 13, color: R.accent, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>£185</div>
            {steps.map(s => {
              const changed = s.v !== s.defaultV;
              return (
                <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
                  <Arrow active={s.active} />
                  <div style={{
                    width: 80, textAlign: "center", opacity: s.active ? 1 : 0.35,
                    padding: "4px 2px", borderRadius: 4,
                    background: changed ? `${R.gold}10` : "transparent",
                    border: `1px solid ${changed ? `${R.gold}35` : "transparent"}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                      color: changed ? R.gold : (s.type === "multiplier" ? R.warmTeal : R.text),
                    }}>
                      {s.type === "multiplier" ? `${s.v}×` : `−${s.v}%`}
                    </div>
                  </div>
                </div>
              );
            })}
            <Arrow active color={R.warmTeal} />
            <div style={{ width: 80, textAlign: "center", fontSize: 13, color: R.warmTeal, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>£{runO.toFixed(2)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: R.gold, paddingLeft: 70 }}>
          → {(runO - runD >= 0 ? "+" : "")}£{(runO - runD).toFixed(2)} vs global
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// D3 — Collapsed post-save row (minimal)
// Hotel · only the metric(s) that diverge from global · final price
// No "was", no delta, no "Custom" label, no chrome.
// ══════════════════════════════════════════
function MockupD_Collapsed_Minimal() {
  const rows = [
    { name: "Jubilee Hotel", diffs: [["Genius", "−20%"]], rate: 134.00 },
    { name: "Elysee Hyde Park", diffs: [["Genius", "−18%"], ["Campaign", "−35%"]], rate: 153.07 },
    { name: "Camden Suites", diffs: [["Genius", "−20%"]], rate: 149.07 },
  ];
  return (
    <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${R.sep}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: R.text, fontSize: 13, fontWeight: 500 }}>Per-Hotel Overrides</span>
          <span style={{ color: R.textDim, fontSize: 11 }}>— Booking.com</span>
        </div>
      </div>
      {rows.map((h, i) => (
        <div key={h.name} style={{
          display: "grid", gridTemplateColumns: "1fr auto 100px",
          padding: "14px 20px", alignItems: "center", gap: 24,
          borderBottom: i < rows.length - 1 ? `1px solid ${R.sep}` : "none",
          cursor: "pointer",
        }}>
          <span style={{ color: R.accent, fontSize: 13 }}>{h.name}</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {h.diffs.map(([label, value]) => (
              <span key={label} style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ color: R.textMid }}>{label} </span>
                <span style={{ color: R.gold, fontWeight: 500 }}>{value}</span>
              </span>
            ))}
          </div>
          <span style={{ textAlign: "right", color: R.warmTeal, fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
            £{h.rate.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════
// UPGRADE ANNOUNCEMENT POPUP — MOCKUPS
// ══════════════════════════════════════════

// Contextual frame: shows the popup against a faux app background so
// placement/scale reads correctly.
function ContextFrame({ height = 240, children, label }: { height?: number; children: React.ReactNode; label?: string }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        background: R.bg,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Faux topbar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 44,
        background: R.darkBand, borderBottom: `1px solid ${R.border}`,
        display: "flex", alignItems: "center", padding: "0 16px",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: R.textDim }}>Dashboard</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: R.green, opacity: 0.7 }} />
          <span style={{ fontSize: 9, fontWeight: 600, color: R.textDim, letterSpacing: 0.5 }}>ALL SYSTEMS LIVE</span>
        </div>
      </div>
      {/* Placeholder content */}
      <div style={{ position: "absolute", top: 64, left: 16, right: 16, bottom: 16, display: "flex", flexDirection: "column", gap: 8, opacity: 0.35 }}>
        <div style={{ width: "55%", height: 12, background: R.border, borderRadius: 3 }} />
        <div style={{ width: "40%", height: 8, background: R.border, borderRadius: 3 }} />
        <div style={{ flex: 1, marginTop: 6, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <div style={{ background: R.card, borderRadius: 6, border: `1px solid ${R.border}` }} />
          <div style={{ background: R.card, borderRadius: 6, border: `1px solid ${R.border}` }} />
          <div style={{ background: R.card, borderRadius: 6, border: `1px solid ${R.border}` }} />
        </div>
      </div>
      {children}
      {label && (
        <div style={{
          position: "absolute", bottom: 8, left: 10,
          fontSize: 9, color: R.textDim, fontFamily: "monospace",
          padding: "2px 6px", background: `${R.bg}cc`, borderRadius: 3,
        }}>{label}</div>
      )}
    </div>
  );
}

// ── A. Slide-in toast (bottom-right) ──
function UpgradeToastSlideIn() {
  return (
    <ContextFrame height={260} label="slides in from right · auto-dismisses after 20s">
      <div style={{
        position: "absolute", bottom: 16, right: 16,
        width: 340,
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
        display: "flex",
      }}>
        {/* Teal stripe */}
        <div style={{ width: 3, background: R.warmTeal, flexShrink: 0 }} />
        <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${R.warmTeal}18`, border: `1px solid ${R.warmTeal}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Sparkles size={13} style={{ color: R.warmTeal }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: R.accent, lineHeight: 1.3, marginBottom: 3 }}>
                Market Pulse just got a polish
              </div>
              <div style={{ fontSize: 11, color: R.textMid, lineHeight: 1.45 }}>
                Fresh design across the app. Spot anything off? <span style={{ color: R.warmTeal, fontWeight: 500 }}>Let us know</span>.
              </div>
            </div>
            <button style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: 2, color: R.textDim, flexShrink: 0, marginTop: -2,
            }}>
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    </ContextFrame>
  );
}

// ── B. Pinned bell notification ──
function UpgradePinnedNotification() {
  return (
    <ContextFrame height={360} label="first item in the existing notification dropdown">
      {/* Simulated dropdown anchored top-right near the bell */}
      <div style={{
        position: "absolute", top: 54, right: 16,
        width: 360,
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
      }}>
        {/* Dropdown header */}
        <div style={{
          padding: "11px 14px",
          borderBottom: `1px solid ${R.border}`,
          background: R.darkBand,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ color: R.accent, fontWeight: 600, fontSize: 12 }}>Notifications</span>
            <span style={{
              fontSize: 9, fontWeight: 700, color: R.warmTeal,
              padding: "1px 6px", borderRadius: 10,
              background: `${R.warmTeal}18`, border: `1px solid ${R.warmTeal}40`,
            }}>1</span>
          </div>
          <span style={{ fontSize: 10, color: R.textMid }}>Mark all read</span>
        </div>

        {/* Pinned upgrade notice */}
        <div style={{
          display: "flex", gap: 10, padding: "12px 14px",
          background: `${R.warmTeal}08`,
          borderBottom: `1px solid ${R.sep}`,
          position: "relative",
        }}>
          <div style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 8,
            background: `${R.warmTeal}18`, border: `1px solid ${R.warmTeal}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={13} style={{ color: R.warmTeal }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>Market Pulse just got a polish</span>
              <span style={{ fontSize: 10, color: R.textDim }}>Just now</span>
            </div>
            <div style={{ fontSize: 11, color: R.textMid, lineHeight: 1.45 }}>
              Fresh design across the app. See anything off? <span style={{ color: R.warmTeal, fontWeight: 500 }}>Ping us</span>.
            </div>
          </div>
          <div style={{
            position: "absolute", top: 16, right: 12,
            width: 6, height: 6, borderRadius: 3, background: R.warmTeal,
          }} />
        </div>

        {/* Dimmed placeholder rows */}
        <div style={{ padding: "12px 14px", display: "flex", gap: 10, opacity: 0.5 }}>
          <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: R.border }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ width: "60%", height: 10, background: R.border, borderRadius: 2, marginBottom: 6 }} />
            <div style={{ width: "80%", height: 8, background: R.border, borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </ContextFrame>
  );
}

// ── C. Welcome modal ──
function UpgradeWelcomeModal() {
  return (
    <ContextFrame height={340} label="centered modal with dim backdrop — first-visit only">
      {/* Dim backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(8, 12, 18, 0.55)",
        backdropFilter: "blur(2px)",
      }} />
      {/* Modal */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 420,
        background: R.card,
        border: `1px solid ${R.border}`,
        borderRadius: 12,
        padding: "28px 28px 22px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        textAlign: "center",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 26,
          background: `${R.warmTeal}18`, border: `1px solid ${R.warmTeal}35`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <PartyPopper size={22} style={{ color: R.warmTeal }} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: R.accent, margin: "0 0 8px", letterSpacing: -0.3 }}>
          Welcome to the refreshed Market Pulse
        </h2>
        <p style={{ fontSize: 12, color: R.textMid, margin: "0 0 20px", lineHeight: 1.55 }}>
          New look, same data — cleaner, faster, a bit more Rockenue.
          If anything looks off, tell us and we'll fix it fast.
        </p>
        <button style={{
          padding: "8px 20px", borderRadius: 6,
          background: R.warmTeal, color: R.sidebar,
          border: "none", fontSize: 12, fontWeight: 600,
          cursor: "pointer",
        }}>
          Got it
        </button>
      </div>
    </ContextFrame>
  );
}

// ── D. Inline banner ──
function UpgradeInlineBanner() {
  return (
    <ContextFrame height={240} label="thin strip below topbar, dismissible">
      {/* Override faux topbar position — banner sits just below it */}
      <div style={{
        position: "absolute", top: 44, left: 0, right: 0,
        padding: "9px 16px",
        background: `linear-gradient(90deg, ${R.warmTeal}18 0%, ${R.warmTeal}05 100%)`,
        borderBottom: `1px solid ${R.warmTeal}30`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 11,
          background: `${R.warmTeal}25`, border: `1px solid ${R.warmTeal}40`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Rocket size={11} style={{ color: R.warmTeal }} />
        </div>
        <div style={{ fontSize: 12, color: R.accent, flex: 1 }}>
          <span style={{ fontWeight: 600 }}>Fresh release is live.</span>
          <span style={{ color: R.textMid, fontWeight: 400 }}> Cleaner design across the app — notice anything off? </span>
          <a style={{ color: R.warmTeal, fontWeight: 500, textDecoration: "none", cursor: "pointer" }}>
            Let us know <ArrowRight size={11} style={{ display: "inline", marginLeft: 2, verticalAlign: -1 }} />
          </a>
        </div>
        <button style={{
          background: "transparent", border: "none", cursor: "pointer",
          color: R.textDim, padding: 2, flexShrink: 0,
        }}>
          <X size={14} />
        </button>
      </div>
    </ContextFrame>
  );
}

// ── Copy text options ──
function UpgradeCopyOptions() {
  const options = [
    {
      title: "Market Pulse just got a polish",
      subtitle: "Fresh design across the app. Spot anything off? Let us know.",
      tone: "Softest — small-change tone",
    },
    {
      title: "Welcome to the refreshed Market Pulse",
      subtitle: "New look, same data — cleaner, faster, a bit more Rockenue. If anything looks off, tell us and we'll fix it fast.",
      tone: "Ceremonial — best for the modal",
    },
    {
      title: "Fresh release is live",
      subtitle: "We've shipped a cleaner design across the app. Notice something unexpected? Ping us.",
      tone: "Neutral release-notes tone",
    },
    {
      title: "A little Rockenue on your Market Pulse",
      subtitle: "New palette, tighter layouts, smoother flows. Say hi to support if anything feels out of place.",
      tone: "Branded — leans into the visual refresh",
    },
    {
      title: "Hello, fresh design.",
      subtitle: "Everything's in the same place — just better dressed. Seeing something weird? Tell us, we're on it.",
      tone: "Playful — lightest touch",
    },
    {
      title: "Your platform just got an upgrade",
      subtitle: "New look, snappier bits. Anything feel off? Drop us a line — we'd rather hear from you than not.",
      tone: "Warm / direct",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
      {options.map((o, i) => (
        <div
          key={i}
          style={{
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
              color: R.warmTeal, textTransform: "uppercase",
              padding: "2px 6px", borderRadius: 3, background: `${R.warmTeal}15`,
            }}>
              Option {i + 1}
            </span>
            <span style={{ fontSize: 10, color: R.textDim }}>{o.tone}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: R.accent, lineHeight: 1.3, marginBottom: 6 }}>
            {o.title}
          </div>
          <div style={{ fontSize: 11, color: R.textMid, lineHeight: 1.5 }}>
            {o.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}


export function Canvas() {
  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 64px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ═══════════════════════════════════════ */}
        {/* UPGRADE ANNOUNCEMENT POPUP — CONCEPTS   */}
        {/* ═══════════════════════════════════════ */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold }}>Canvas · New Study</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 6px", color: R.accent }}>
          Platform Upgrade Announcement — Popup Concepts
        </h1>
        <p style={{ fontSize: 12, color: R.textDim, margin: "0 0 32px", lineHeight: 1.6, maxWidth: 720 }}>
          One-off announcement shown once per user after the design refresh lands. Subtle, happy-news tone — not apologetic.
          Four delivery surfaces below, each with its own trade-off between visibility and intrusiveness. Pick one and a text line and I'll wire it up.
        </p>

        <MockupFrame
          eyebrow="A · Slide-in toast"
          title="Bottom-right corner, 360px card, auto-shows once per user"
          caption="Least intrusive. Slides in 400ms after dashboard mounts, slides out on click/X or after 20s. Teal left stripe + sparkle icon. Fits the app's existing toast system."
        >
          <UpgradeToastSlideIn />
        </MockupFrame>

        <MockupFrame
          eyebrow="B · Pinned bell notification"
          title="First item in the notification dropdown, gently tinted"
          caption="Invisible until the user opens the bell — zero disruption to flow. Background tinted teal at 8% to signal 'this one's new/different'. Dismisses like any notification."
        >
          <UpgradePinnedNotification />
        </MockupFrame>

        <MockupFrame
          eyebrow="C · Welcome modal"
          title="Centered, ~420px wide, backdrop blur, first-visit only"
          caption="Most visible / most ceremonial. Use only if you want users to definitely see it. Single 'Got it' button closes + sets the seen flag. Good if there are material UX changes users need to be aware of."
        >
          <UpgradeWelcomeModal />
        </MockupFrame>

        <MockupFrame
          eyebrow="D · Inline banner strip"
          title="Thin strip just below the topbar, full-width of content area"
          caption="Middle ground. Always visible at the top of the dashboard until dismissed. Unobtrusive at ~36px tall. Better than the modal for casual release notes."
        >
          <UpgradeInlineBanner />
        </MockupFrame>

        {/* Text copy options */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase" }}>Copy · Text options</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: R.accent }}>Title + subtext pairs</span>
          </div>
          <p style={{ fontSize: 11, color: R.textDim, margin: "0 0 16px", lineHeight: 1.5 }}>
            All six avoid "sorry", "issue", "bug", "problem". They land as "happy news" with a soft invitation to report anything unexpected.
          </p>
          <UpgradeCopyOptions />
        </div>

        <div style={{ height: 1, background: R.border, margin: "20px 0 40px" }} />

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold }}>Canvas · Studies</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 6px", color: R.accent }}>
          Channel Pricing — Add Override UX
        </h1>
        <p style={{ fontSize: 12, color: R.textDim, margin: "0 0 40px", lineHeight: 1.6, maxWidth: 720 }}>
          Decided flow: click Add → empty row appears → pick hotel → two-row horizontal comparison expands
          (Global on top, This Hotel below) → edit → save → row collapses to a minimal line showing only
          the hotel, the metric(s) that diverge, and the final price.
        </p>

        <MockupFrame
          eyebrow="D1 · Empty row"
          title="Just appeared, waiting for hotel selection"
          caption="Clicking '+ Add Override' appends this row. Save is disabled until a hotel is picked. Nothing expands under the row until a hotel is chosen."
        >
          <MockupD_EmptyRow />
        </MockupFrame>

        <MockupFrame
          eyebrow="D2 · Expanded (two-row comparison)"
          title="Global on top, This Hotel below — cells aligned for full side-by-side comparison"
          caption="Global values are read-only on the top row; This Hotel values are editable on the bottom row. Changed cells pick up a gold border + gold text so overrides are obvious. Running total shown on both rows, with the delta vs global below. All steps are saved — toggle off or change any value to diverge."
        >
          <MockupD_Expanded_DualRow />
        </MockupFrame>

        <MockupFrame
          eyebrow="D3 · Collapsed (minimal)"
          title="Hotel · diverged metric(s) · final price. Nothing else."
          caption="After save, the row closes to a single clean line. No 'was', no delta, no 'Custom' label, no chevron — just what's different and the resulting price. Click the row to re-expand for editing."
        >
          <MockupD_Collapsed_Minimal />
        </MockupFrame>

        <div style={{ height: 60, borderTop: `1px solid ${R.border}`, margin: "40px 0 32px" }} />

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold }}>Canvas · Reference</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 6px", color: R.accent }}>
          Color System
        </h1>
        <p style={{ fontSize: 12, color: R.textDim, margin: "0 0 48px" }}>
          Every color in the design refresh palette with usage notes.
        </p>

        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 14 }}>
              {section.title}
            </div>
            <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, overflow: "hidden" }}>
              {section.colors.map((c, i) => (
                <div
                  key={c.hex + c.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 100px 1fr 100px",
                    gap: 16,
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: i < section.colors.length - 1 ? `1px solid ${R.sep}` : "none",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    backgroundColor: c.hex,
                    border: c.hex === "#14181D" || c.hex === "#121519" || c.hex === "#0C0E12"
                      ? `1px solid ${R.border}` : "none",
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: c.hex === "#14181D" || c.hex === "#121519" || c.hex === "#0C0E12" || c.hex === "#1E2330" || c.hex === "#1C2228" ? R.accent : c.hex, fontFamily: "monospace" }}>
                    {c.hex}
                  </span>
                  <span style={{ fontSize: 12, color: R.text }}>{c.label}</span>
                  <span style={{ fontSize: 11, color: R.textDim, fontFamily: "monospace" }}>{c.token}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Separator row preview */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: R.gold, textTransform: "uppercase", marginBottom: 14 }}>
            Separators
          </div>
          <div style={{ background: R.card, border: `1px solid ${R.border}`, borderRadius: 8, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: R.border }} />
              <span style={{ fontSize: 10, color: R.textDim, fontFamily: "monospace" }}>#1E2330 — R.border (structural)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
              <span style={{ fontSize: 10, color: R.textDim, fontFamily: "monospace" }}>rgba(255,255,255,0.04) — R.sep (subtle rows)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Canvas;
