// ── Canvas: "Four ways we work with hotels" — 5 card layout concepts ──

const R = {
  bg: "#14181D",
  card: "#1C2228",
  cardHover: "#222830",
  border: "#2A3240",
  accent: "#F3F5F7",
  text: "#B0B8C4",
  textMid: "#7A8494",
  textDim: "#4E5868",
  teal: "#38C6BA",
  gold: "#C8A66E",
  heroBg: "#111519",
  darkBand: "#0F1215",
};

const SERVICES = [
  {
    num: "01",
    title: "Full Service Management",
    summary: "The core of what we do. This is what happens when a hotel joins the network.",
    includes: ["Autonomous AI pricing", "OTA & channel management", "Revenue & owner reporting", "Commercial strategy", "Front desk & ops support", "Live owner dashboards"],
  },
  {
    num: "02",
    title: "Leasing & Management",
    summary: "For asset owners looking for hands-off, professionally managed returns.",
    includes: ["Fixed or revenue-share structures", "Full operational accountability", "Investor-grade reporting", "Network-level pricing & distribution", "Active leaseholder network", "Guest experience management"],
  },
  {
    num: "03",
    title: "Hotel Sales & Acquisitions",
    summary: "A deep network of buyers, sellers, and off-market opportunities.",
    includes: ["Off-market deal flow", "Buyer & seller introductions", "Asset positioning & valuation", "Operational due diligence", "Market & competitive analysis", "Transition management"],
  },
  {
    num: "04",
    title: "Research & Intelligence",
    summary: "Bespoke market intelligence that doesn't exist anywhere else.",
    includes: ["Bespoke market reports", "Forward demand modelling", "Competitive pricing analysis", "Supply & accommodation mapping", "Event impact assessment", "Investor-grade data packs"],
  },
];

/* shared header for every concept */
function SectionHeader() {
  return (
    <div style={{ marginBottom: 36 }}>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold, marginBottom: 16 }}>
        Services
      </p>
      <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1.2, color: R.accent, margin: "0 0 14px", lineHeight: 1.15 }}>
        Four ways we work with hotels.
      </h2>
      <p style={{ fontSize: 14, color: R.textMid, maxWidth: 520, lineHeight: 1.65, margin: 0 }}>
        Each function delivered by a specialist team, powered by proprietary technology, and aligned to your hotel's commercial objectives.
      </p>
    </div>
  );
}

export function Canvas() {
  return (
    <div style={{ minHeight: "100vh", background: R.bg, color: R.accent, fontFamily: "'Inter', system-ui, sans-serif", padding: "40px 64px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: R.gold }}>Canvas</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8, margin: "0 0 6px", color: R.accent }}>
          Four Ways We Work With Hotels — Layout Concepts
        </h1>
        <p style={{ fontSize: 12, color: R.textDim, margin: "0 0 48px" }}>
          5 approaches. Same content, different design. Pick one for the homepage.
        </p>

        {/* ═══════════════════════════════════════════════════════════════
            1: Numbered list — no pills, clean vertical stack
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: R.teal }}>1</span>
            <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>Numbered rows — clean, editorial</span>
          </div>
          <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 12, padding: "48px 44px" }}>
            <SectionHeader />
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {SERVICES.map((svc, i) => {
                const accent = i % 2 === 0 ? R.teal : R.gold;
                return (
                  <div
                    key={svc.num}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px 200px 1fr",
                      gap: 24,
                      padding: "28px 0",
                      borderTop: `1px solid ${R.border}`,
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: accent }}>{svc.num}</span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: R.accent, margin: 0 }}>{svc.title}</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: R.text, margin: 0 }}>{svc.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            2: Large stacked cards — full width, number + title left, body right
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: R.teal }}>2</span>
            <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>Stacked wide cards — split layout</span>
          </div>
          <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 12, padding: "48px 44px" }}>
            <SectionHeader />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {SERVICES.map((svc, i) => {
                const accent = i % 2 === 0 ? R.teal : R.gold;
                return (
                  <div
                    key={svc.num}
                    style={{
                      background: R.card,
                      border: `1px solid ${R.border}`,
                      borderRadius: 10,
                      padding: "28px 32px",
                      display: "grid",
                      gridTemplateColumns: "280px 1fr",
                      gap: 32,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: accent, display: "block", marginBottom: 8 }}>{svc.num}</span>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: R.accent, margin: 0 }}>{svc.title}</h3>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, lineHeight: 1.65, color: R.text, margin: "0 0 14px" }}>{svc.summary}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {svc.includes.map((item) => (
                          <span key={item} style={{ fontSize: 11, color: R.textMid, padding: "4px 10px", background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 5 }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            3: Four equal columns — compact, no pills
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: R.teal }}>3</span>
            <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>Four columns — minimal, no pills</span>
          </div>
          <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 12, padding: "48px 44px" }}>
            <SectionHeader />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {SERVICES.map((svc, i) => {
                const accent = i % 2 === 0 ? R.teal : R.gold;
                return (
                  <div
                    key={svc.num}
                    style={{
                      borderTop: `2px solid ${accent}`,
                      paddingTop: 20,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: accent, display: "block", marginBottom: 12 }}>{svc.num}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: R.accent, margin: "0 0 8px" }}>{svc.title}</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: R.textMid, margin: 0 }}>{svc.summary}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            4: 2×2 grid — tall cards with accent left border, includes as bullet list
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: R.teal }}>4</span>
            <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>2×2 cards — left accent border, bullet list</span>
          </div>
          <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 12, padding: "48px 44px" }}>
            <SectionHeader />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {SERVICES.map((svc, i) => {
                const accent = i % 2 === 0 ? R.teal : R.gold;
                return (
                  <div
                    key={svc.num}
                    style={{
                      background: R.card,
                      border: `1px solid ${R.border}`,
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: 10,
                      padding: "26px 28px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: accent }}>{svc.num}</span>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: R.accent, margin: 0 }}>{svc.title}</h3>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: R.text, margin: "0 0 16px", fontWeight: 500 }}>{svc.summary}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                      {svc.includes.map((item) => (
                        <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                          <div style={{ width: 4, height: 4, borderRadius: 2, background: accent, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: R.textMid }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            5: Accordion-style — number, title, summary on one row per service, includes hidden
        ═══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: R.teal }}>5</span>
            <span style={{ fontSize: 13, color: R.textMid, fontWeight: 500 }}>Feature grid — number badge, includes as two-column list</span>
          </div>
          <div style={{ background: R.heroBg, border: `1px solid ${R.border}`, borderRadius: 12, padding: "48px 44px" }}>
            <SectionHeader />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {SERVICES.map((svc, i) => {
                const accent = i % 2 === 0 ? R.teal : R.gold;
                return (
                  <div
                    key={svc.num}
                    style={{
                      background: R.card,
                      border: `1px solid ${R.border}`,
                      borderRadius: 12,
                      padding: "30px 28px",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `${accent}15`, border: `1px solid ${accent}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 16,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{svc.num}</span>
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: R.accent, margin: "0 0 6px" }}>{svc.title}</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: R.text, margin: "0 0 18px", fontWeight: 500 }}>{svc.summary}</p>
                    <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                      {svc.includes.map((item) => (
                        <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                          <span style={{ fontSize: 12, color: accent }}>+</span>
                          <span style={{ fontSize: 11, color: R.textMid, lineHeight: 1.4 }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Canvas;
