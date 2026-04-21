import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Trophy,
  DollarSign,
  Zap,
  Shield,
  TerminalSquare,
  Radar,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  ClipboardList,
  Globe,
  Palette,
  LogOut,
  X,
  Plus,
  Pin,
} from "lucide-react";
import { R } from "../../../styles/tokens";

const PINNED: { label: string; icon: any; value: string }[] = [
  { label: "Control Panel", icon: TerminalSquare, value: "sentinel" },
  { label: "CRM", icon: ClipboardList, value: "crm" },
  { label: "My Rates", icon: DollarSign, value: "hotelRates" },
];

function FakeSidebar() {
  const item = (label: string, Icon: any, active = false, indent = false) => (
    <div
      style={{
        padding: indent ? "7px 20px 7px 36px" : "9px 20px",
        fontSize: indent ? 12 : 13,
        fontWeight: active ? 600 : 400,
        color: active ? R.accent : R.textDim,
        background: active ? `${R.warmTeal}08` : "transparent",
        borderLeft: active ? `2px solid ${R.warmTeal}` : "2px solid transparent",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon size={indent ? 13 : 15} style={{ opacity: active ? 1 : 0.5 }} />
      {label}
    </div>
  );

  const section = (label: string, Icon: any, open: boolean) => (
    <div
      style={{
        padding: "9px 20px",
        fontSize: 13,
        color: R.textDim,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icon size={15} style={{ opacity: 0.5 }} />
      <span style={{ flex: 1 }}>{label}</span>
      <ChevronRight size={12} style={{ opacity: 0.4, transform: open ? "rotate(90deg)" : "none" }} />
    </div>
  );

  return (
    <div
      style={{
        width: 220,
        background: R.sidebar,
        borderRight: `1px solid ${R.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 14px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ color: R.warmTeal, fontSize: 26, fontWeight: 300, lineHeight: 1 }}>(</span>
        <span style={{ color: R.accent, fontSize: 14, fontWeight: 700, letterSpacing: 1.4 }}>MARKET PULSE</span>
        <span style={{ color: R.gold, fontSize: 26, fontWeight: 300, lineHeight: 1 }}>)</span>
      </div>

      {/* Property selector */}
      <div style={{ padding: "0 14px 14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: R.heroBg,
            border: `1px solid ${R.border}`,
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: R.accent }}>The Portico Hotel</span>
          <ChevronDown size={14} color={R.textDim} />
        </div>
      </div>

      {/* Nav */}
      <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 8, flex: 1 }}>
        {item("Dashboard", LayoutDashboard, true)}
        {item("Demand Radar", Radar)}
        {item("Compset Intel", Trophy)}
        {item("Reports", FileText)}
        {item("My Rates", DollarSign)}

        <div style={{ borderTop: `1px solid ${R.border}`, margin: "8px 0" }} />

        {section("Sentinel", Zap, false)}
        {section("Rockenue", Building2, false)}
        {item("Admin", Zap)}
        {section("Studio", Palette, true)}
        {item("TopNav Pills", Pin, true, true)}

        <div style={{ borderTop: `1px solid ${R.border}`, margin: "8px 0" }} />
        {item("Settings", Settings)}
      </div>

      {/* User */}
      <div style={{ borderTop: `1px solid ${R.border}`, padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: R.warmTeal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: R.sidebar,
            }}
          >
            KM
          </div>
          <div>
            <div style={{ fontSize: 12, color: R.accent }}>Karol Marcu</div>
            <div style={{ fontSize: 10, color: R.textDim }}>super_admin</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: R.textDim }}>
          <LogOut size={12} /> Sign Out
        </div>
      </div>
    </div>
  );
}

function FakeContent() {
  return (
    <div style={{ flex: 1, padding: "32px 28px", background: R.bg }}>
      <div style={{ fontSize: 12, color: R.textDim, marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        The Portico Hotel · Today
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Occupancy", value: "78%", delta: "+4pp" },
          { label: "ADR", value: "£184", delta: "+£6" },
          { label: "RevPAR", value: "£143", delta: "+£8" },
          { label: "Rooms Sold", value: "42 / 54", delta: "+3" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: R.card,
              border: `1px solid ${R.border}`,
              borderRadius: 8,
              padding: "16px 18px",
            }}
          >
            <div style={{ fontSize: 10, color: R.textDim, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: R.warmTeal, lineHeight: 1, marginBottom: 4 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: R.green }}>{kpi.delta} vs LY</div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: R.card,
          border: `1px solid ${R.border}`,
          borderRadius: 8,
          padding: "20px 22px",
          height: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: R.textDim,
          fontSize: 12,
        }}
      >
        — 90-day pace chart —
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant A — Right-aligned labeled pills (subtle)
// ──────────────────────────────────────────────────────────────

function TopBarVariantA() {
  return (
    <div
      style={{
        padding: "12px 28px",
        borderBottom: `1px solid ${R.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: R.darkBand,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>Dashboard</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, color: R.accent }}>The Portico Hotel</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* PINNED PILLS */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: R.gold,
              textTransform: "uppercase",
            }}
          >
            <Pin size={10} style={{ opacity: 0.85 }} />
            Pinned
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {PINNED.map(({ label, icon: Icon }) => (
              <button
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 11px",
                  background: `${R.gold}10`,
                  border: `1px solid ${R.gold}55`,
                  borderRadius: 999,
                  color: R.accent,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Icon size={13} color={R.gold} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: R.border, margin: "0 4px" }} />

        {/* All Systems Live */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 9px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 999,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: R.green, boxShadow: `0 0 6px ${R.green}80` }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: R.textMid }}>
            All systems live
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant B — Segmented Dock (connected, tight unit)
// ──────────────────────────────────────────────────────────────

function TopBarVariantB() {
  return (
    <div
      style={{
        padding: "12px 28px",
        borderBottom: `1px solid ${R.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: R.darkBand,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>Dashboard</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, color: R.accent }}>The Portico Hotel</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* SEGMENTED DOCK */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {PINNED.map(({ label, icon: Icon }, idx) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 14px",
                  background: "transparent",
                  border: "none",
                  color: R.text,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Icon size={13} color={R.warmTeal} />
                {label}
              </button>
              {idx < PINNED.length - 1 && (
                <div style={{ width: 1, height: 16, background: R.border }} />
              )}
            </div>
          ))}
        </div>

        {/* All Systems Live */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 9px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 999,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: R.green, boxShadow: `0 0 6px ${R.green}80` }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: R.textMid }}>
            All systems live
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant C — Icon-only dock (minimal, tooltip on hover)
// ──────────────────────────────────────────────────────────────

function TopBarVariantC() {
  return (
    <div
      style={{
        padding: "12px 28px",
        borderBottom: `1px solid ${R.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: R.darkBand,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>Dashboard</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, color: R.accent }}>The Portico Hotel</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* ICON DOCK */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {PINNED.map(({ label, icon: Icon }, idx) => (
            <button
              key={label}
              title={label}
              style={{
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: idx === 0 ? `${R.warmTeal}15` : "transparent",
                border: `1px solid ${idx === 0 ? R.warmTeal + "40" : R.border}`,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <Icon size={15} color={R.warmTeal} />
            </button>
          ))}
          {/* Tooltip preview on first pill */}
          <div style={{ position: "relative", width: 0 }}>
            <div
              style={{
                position: "absolute",
                top: 38,
                left: -110,
                background: R.card,
                border: `1px solid ${R.border}`,
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 10,
                color: R.text,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
              }}
            >
              Control Panel
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: R.border }} />

        {/* All Systems Live */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 9px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 999,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: R.green, boxShadow: `0 0 6px ${R.green}80` }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: R.textMid }}>
            All systems live
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant D — Centered "PINNED" header + add button (explicit)
// ──────────────────────────────────────────────────────────────

function TopBarVariantD() {
  return (
    <div
      style={{
        padding: "10px 28px 12px",
        borderBottom: `1px solid ${R.border}`,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 24,
        background: R.darkBand,
        flexShrink: 0,
      }}
    >
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: R.accent }}>Dashboard</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, color: R.accent }}>The Portico Hotel</span>
        </div>
      </div>

      {/* Center: PINNED block */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: R.textDim,
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Pin size={9} style={{ opacity: 0.6 }} />
          Pinned
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {PINNED.map(({ label, icon: Icon }) => (
            <button
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 11px",
                background: R.card,
                border: `1px solid ${R.border}`,
                borderRadius: 999,
                color: R.text,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Icon size={12} color={R.warmTeal} />
              {label}
            </button>
          ))}
          <button
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px dashed ${R.border}`,
              borderRadius: 999,
              color: R.textDim,
              cursor: "pointer",
            }}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "flex-end" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 10px 5px 9px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 999,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: R.green, boxShadow: `0 0 6px ${R.green}80` }} />
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: R.textMid }}>
            All systems live
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Variant wrapper (full shell = sidebar + top bar + content)
// ──────────────────────────────────────────────────────────────

function VariantShell({
  label,
  description,
  tradeoff,
  children,
}: {
  label: string;
  description: string;
  tradeoff: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 48 }}>
      {/* Caption */}
      <div style={{ marginBottom: 12, paddingLeft: 4 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: R.gold,
              textTransform: "uppercase",
              padding: "3px 8px",
              border: `1px solid ${R.gold}40`,
              borderRadius: 4,
            }}
          >
            {label}
          </div>
        </div>
        <div style={{ fontSize: 14, color: R.accent, fontWeight: 600, marginBottom: 2 }}>
          {description}
        </div>
        <div style={{ fontSize: 12, color: R.textMid }}>
          <span style={{ color: R.textDim }}>Tradeoff:</span> {tradeoff}
        </div>
      </div>

      {/* Full app shell */}
      <div
        style={{
          display: "flex",
          border: `1px solid ${R.border}`,
          borderRadius: 10,
          overflow: "hidden",
          background: R.bg,
          height: 480,
        }}
      >
        <FakeSidebar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
          <FakeContent />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Main export
// ──────────────────────────────────────────────────────────────

export function TopNavPillsMockup() {
  return (
    <div style={{ background: R.bg, minHeight: "100vh", padding: "40px 48px", color: R.accent }}>
      {/* Header */}
      <div style={{ maxWidth: 1280, margin: "0 auto 32px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: R.warmTeal,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Studio · Concept
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
          Admin Pinned Shortcuts in the Top Bar
        </h1>
        <p style={{ fontSize: 14, color: R.text, lineHeight: 1.65, maxWidth: 780, margin: 0 }}>
          The sidebar now owns primary navigation, so the top bar has real estate to spare. For admins who live in
          2–3 specific views (Control Panel, CRM, My Rates), we could let them right-click a sidebar item to pin it
          as a one-click shortcut. Four design treatments below — same pinned set in each, so the visual language is
          the only variable.
        </p>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <VariantShell
          label="Variant A"
          description="Right-aligned labeled pills — subtle, stays out of the way"
          tradeoff="Lowest visual weight. Reads as secondary actions, not nav — but labels aid discoverability vs icons alone."
        >
          <TopBarVariantA />
        </VariantShell>

        <VariantShell
          label="Variant B"
          description="Segmented dock — a single unified control, iOS-style"
          tradeoff="Tightest footprint of the labeled options. Reads clearly as 'one thing' but can feel like a tab group (implies one-of-many)."
        >
          <TopBarVariantB />
        </VariantShell>

        <VariantShell
          label="Variant C"
          description="Icon-only dock — maximum minimalism, hover reveals label"
          tradeoff="Most compact — room for 5+ pins without crowding. Loses labels so new admins won't know what pins do until they hover."
        >
          <TopBarVariantC />
        </VariantShell>

        <VariantShell
          label="Variant D"
          description="Centered 'PINNED' header with explicit add button"
          tradeoff="Most discoverable — the [+] makes the feature self-teach. Takes the most space and puts shortcuts in the visual center of gravity."
        >
          <TopBarVariantD />
        </VariantShell>

        {/* Footer note */}
        <div
          style={{
            padding: "20px 24px",
            background: R.card,
            border: `1px solid ${R.border}`,
            borderRadius: 10,
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: R.gold, textTransform: "uppercase", marginBottom: 8 }}>
            My lean
          </div>
          <div style={{ fontSize: 13, color: R.text, lineHeight: 1.65 }}>
            <strong style={{ color: R.accent }}>Variant A</strong> for launch — lowest risk, reads as shortcuts not nav,
            doesn't compete with the sidebar. Implementation: localStorage-backed per-user pin set (max 3–4),
            right-click a sidebar item for "Pin to top bar." Zero backend. If it lands, the "+ button" affordance
            from Variant D can be added later without changing the visual style.
          </div>
        </div>
      </div>
    </div>
  );
}
