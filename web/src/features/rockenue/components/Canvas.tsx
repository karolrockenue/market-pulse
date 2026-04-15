// ── Canvas: Design system color reference ──

const R = {
  bg: "#14181D",
  card: "#121519",
  cardLight: "#1C2228",
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

export function Canvas() {
  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 64px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold }}>Canvas</span>
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
