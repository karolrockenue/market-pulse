import { useState } from "react";
import { ArrowRight, Activity, Radar, TrendingUp, BarChart3, Globe, ChevronRight, Target, Calendar } from "lucide-react";

// ── MP Login V2: Single-scroll vertical narrative ──
// Same content as MPLogin, different structural approach:
// - Full-width stacked sections (no two-column hero)
// - Centered text blocks → full-bleed data visuals
// - Login floats as a persistent sidebar card on scroll
// - Numbers and data lead, copy follows

interface MPLoginV2Props { activeView: string; onNavigate: (view: string) => void; }

const A = {
  bg: "#14181D", card: "#1C2228", border: "#2A3240", sep: "rgba(255,255,255,0.04)",
  accent: "#F3F5F7", text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  teal: "#38C6BA", gold: "#C8A66E", heroBg: "#111519", darkBand: "#0F1215",
  green: "#34D068", red: "#ef4444", cardHover: "#222830",
};

const grad: React.CSSProperties = {
  background: `linear-gradient(135deg, ${A.teal} 0%, ${A.gold} 100%)`,
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
};

export function MPLoginV2({ activeView, onNavigate }: MPLoginV2Props) {
  const [email, setEmail] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: A.bg, color: A.accent, fontFamily: "Inter, system-ui, -apple-system, sans-serif", WebkitFontSmoothing: "antialiased" }}>

      {/* ─── NAV ─── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: A.bg, borderBottom: `1px solid ${A.border}`, padding: "20px 64px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span style={{ color: A.teal, fontSize: "26px", fontWeight: 300 }}>(</span>
          <span style={{ color: A.accent, fontSize: "14px", fontWeight: 700, letterSpacing: "1.4px" }}>MARKET PULSE</span>
          <span style={{ color: A.gold, fontSize: "26px", fontWeight: 300 }}>)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          {["Intelligence", "Markets", "About"].map(l => (
            <span key={l} style={{ fontSize: "13px", fontWeight: 500, color: A.textMid, cursor: "pointer" }}>{l}</span>
          ))}
          <button style={{ fontSize: "13px", fontWeight: 600, color: A.teal, padding: "8px 18px", border: `1px solid ${A.teal}`, borderRadius: "6px", background: "transparent", cursor: "pointer" }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ─── HERO: Centred, numbers-first ─── */}
      <section style={{ padding: "120px 64px 80px", textAlign: "center", position: "relative", borderBottom: `1px solid ${A.border}` }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 60% 40% at 50% 30%, rgba(56,198,186,0.04), transparent)` }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "24px" }}>
            HOTEL REVENUE INTELLIGENCE
          </div>
          <h1 style={{ fontSize: "56px", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-2px", color: A.accent, marginBottom: "24px" }}>
            Millions of data points.<br />One clear picture.
          </h1>
          <p style={{ fontSize: "17px", lineHeight: 1.7, color: A.text, maxWidth: "520px", margin: "0 auto 56px" }}>
            Market analytics, forward demand intelligence, and competitive benchmarking — built for operators who make decisions with data, not instinct.
          </p>

          {/* Stats bar — full width, centred */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", maxWidth: "640px", margin: "0 auto", borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}`, padding: "36px 0" }}>
            {[
              { value: "4,300+", label: "Properties tracked daily" },
              { value: "120", label: "Day forward horizon" },
              { value: "2.1M+", label: "Data points collected" },
            ].map((s, i) => (
              <div key={s.label} style={{ position: "relative" }}>
                <div style={{ fontSize: "44px", fontWeight: 700, letterSpacing: "-1.8px", lineHeight: 1, marginBottom: "8px", ...grad }}>{s.value}</div>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px", color: A.textDim, textTransform: "uppercase" }}>{s.label}</div>
                {i < 2 && <div style={{ position: "absolute", right: 0, top: "8px", width: "1px", height: "48px", background: A.border }} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LOGIN STRIP: Horizontal, not a card ─── */}
      <section style={{ background: A.heroBg, borderBottom: `1px solid ${A.border}`, padding: "40px 64px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "32px", alignItems: "center" }}>
          {/* Magic link */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="email" placeholder="your@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, height: "42px", borderRadius: "8px", border: `1px solid ${A.border}`, background: A.bg, color: A.accent, padding: "0 14px", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
            />
            <button style={{ height: "42px", padding: "0 20px", borderRadius: "8px", background: A.teal, color: A.darkBand, fontWeight: 700, fontSize: "13px", border: "none", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
              Magic Link <ArrowRight size={13} />
            </button>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "42px", background: A.border }} />

          {/* PMS connect */}
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { name: "Cloudbeds", color: A.teal },
              { name: "Mews", color: A.gold },
            ].map((pms) => (
              <button key={pms.name} style={{
                flex: 1, height: "42px", borderRadius: "8px", background: A.card, border: `1px solid ${A.border}`,
                color: A.accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                fontSize: "12px", fontWeight: 600,
              }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: pms.color }} />
                {pms.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: "14px", fontSize: "11px", color: A.textDim }}>
          Free for independent hotels. No credit card, no sales call — connect and go.
        </div>
      </section>

      {/* ─── SECTION: Data Sources — Horizontal ticker-style ─── */}
      <section style={{ background: A.bg, borderBottom: `1px solid ${A.border}`, padding: "96px 64px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.teal, textTransform: "uppercase", marginBottom: "16px" }}>LIVE MARKET DATA</div>
            <h2 style={{ fontSize: "40px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.5px", color: A.accent }}>
              Every signal. Every neighbourhood. Every day.
            </h2>
          </div>

          {/* Three source cards — bordered top accent */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            {[
              { icon: Globe, accent: A.teal, label: "OTA COVERAGE", title: "Daily Market Availability", desc: "Price distributions, supply by neighbourhood, property type composition, and star rating mix — sourced from major OTA platforms and processed every 24 hours across a 120-day forward horizon.", stat: "4,300+", statLabel: "Properties" },
              { icon: Radar, accent: A.gold, label: "DEMAND SIGNALS", title: "Forward Demand & Event Layer", desc: "Market demand scoring, weighted average pricing, supply absorption rates, and major event impact analysis — aggregated into actionable forward-looking signals.", stat: "90", statLabel: "Day horizon" },
              { icon: Activity, accent: A.teal, label: "BOOKING VELOCITY", title: "Real-Time Pace Analytics", desc: "Webhook-driven booking pace from your PMS — lead time distributions, length-of-stay patterns, channel mix, and pickup velocity by date.", stat: "< 1s", statLabel: "Latency" },
            ].map((card) => (
              <div key={card.label} style={{ background: A.card, borderRadius: "12px", border: `1px solid ${A.border}`, borderTop: `2px solid ${card.accent}`, padding: "28px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <card.icon size={14} color={card.accent} />
                  <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: A.textDim, textTransform: "uppercase" }}>{card.label}</span>
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: A.accent, marginBottom: "12px", letterSpacing: "-0.3px" }}>{card.title}</h3>
                <p style={{ fontSize: "13px", lineHeight: 1.7, color: A.textMid, marginBottom: "24px" }}>{card.desc}</p>
                <div style={{ borderTop: `1px solid ${A.border}`, paddingTop: "16px" }}>
                  <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, ...grad }}>{card.stat}</div>
                  <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "1.5px", color: A.textDim, textTransform: "uppercase", marginTop: "6px" }}>{card.statLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION: Price-Demand Divergence ─── */}
      <section style={{ background: A.heroBg, borderBottom: `1px solid ${A.border}`, padding: "96px 64px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "48px", alignItems: "start" }}>
            {/* Chart */}
            <div style={{ background: A.card, borderRadius: "12px", border: `1px solid ${A.border}`, padding: "28px 32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "2px", color: A.textDim, textTransform: "uppercase" }}>DEMAND vs PRICE — NEXT 90 DATES</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: A.accent, marginTop: "6px" }}>Each dot is a future stay date</div>
                </div>
                <div style={{ display: "flex", gap: "14px" }}>
                  {[
                    { color: A.red, label: "High demand" },
                    { color: A.teal, label: "Moderate" },
                    { color: A.gold, label: "Event date" },
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: A.textMid }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: l.color, opacity: 0.8 }} />{l.label}
                    </div>
                  ))}
                </div>
              </div>
              <svg viewBox="0 0 520 320" style={{ width: "100%", height: "300px" }}>
                <defs>
                  <linearGradient id="v2quadTR" x1="0.5" y1="0.5" x2="1" y2="0">
                    <stop offset="0%" stopColor={A.red} stopOpacity="0" />
                    <stop offset="100%" stopColor={A.red} stopOpacity="0.03" />
                  </linearGradient>
                  <linearGradient id="v2quadBR" x1="0.5" y1="0.5" x2="1" y2="1">
                    <stop offset="0%" stopColor={A.teal} stopOpacity="0" />
                    <stop offset="100%" stopColor={A.teal} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <rect x="280" y="10" width="230" height="145" fill="url(#v2quadTR)" />
                <rect x="280" y="155" width="230" height="155" fill="url(#v2quadBR)" />
                {[60, 110, 160, 210, 260].map(y => (
                  <line key={y} x1="50" y1={y} x2="510" y2={y} stroke={A.border} strokeWidth="0.4" />
                ))}
                {[120, 200, 280, 360, 440].map(x => (
                  <line key={x} x1={x} y1="10" x2={x} y2="310" stroke={A.border} strokeWidth="0.4" />
                ))}
                <line x1="280" y1="10" x2="280" y2="310" stroke={A.border} strokeWidth="0.8" strokeDasharray="6 4" />
                <line x1="50" y1="155" x2="510" y2="155" stroke={A.border} strokeWidth="0.8" strokeDasharray="6 4" />
                <text x="395" y="36" fill={A.red} fontSize="8" fontWeight="600" textAnchor="middle" opacity="0.5">COMPRESSION</text>
                <text x="395" y="286" fill={A.teal} fontSize="8" fontWeight="600" textAnchor="middle" opacity="0.5">OPPORTUNITY</text>
                {(() => {
                  const pts: JSX.Element[] = [];
                  for (let i = 0; i < 55; i++) {
                    const demand = 15 + Math.sin(i * 0.7) * 20 + Math.cos(i * 0.3) * 15 + 35;
                    const base = 90 + demand * 1.4;
                    const price = base + Math.sin(i * 1.1) * 30 + Math.cos(i * 0.5) * 20;
                    const isEvent = i === 8 || i === 19 || i === 33 || i === 47;
                    const x = 50 + (demand / 100) * 460;
                    const y = 310 - ((price - 60) / 250) * 300;
                    const color = isEvent ? A.gold : demand > 70 ? A.red : demand > 40 ? A.teal : A.textDim;
                    const r = isEvent ? 7 : 4;
                    pts.push(
                      <g key={i}>
                        {isEvent && <circle cx={x} cy={y} r="16" fill={A.gold} opacity="0.06" />}
                        <circle cx={x} cy={y} r={r} fill={color} opacity={isEvent ? 0.9 : 0.55} />
                        {isEvent && <circle cx={x} cy={y} r={r} fill="none" stroke={A.gold} strokeWidth="1" opacity="0.4" />}
                      </g>
                    );
                  }
                  return pts;
                })()}
                <text x="280" y="328" fill={A.textMid} fontSize="9" fontWeight="500" textAnchor="middle">DEMAND INTENSITY →</text>
                <text x="18" y="165" fill={A.textMid} fontSize="9" fontWeight="500" textAnchor="middle" transform="rotate(-90,18,165)">MARKET PRICE →</text>
                {[80, 120, 160, 200, 240, 280].map(v => {
                  const y = 310 - ((v - 60) / 250) * 300;
                  return <text key={v} x="44" y={y + 3} fill={A.textDim} fontSize="7" textAnchor="end">£{v}</text>;
                })}
              </svg>
            </div>

            {/* Copy */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "16px" }}>MARKET SIGNALS</div>
              <h2 style={{ fontSize: "32px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.2px", color: A.accent, marginBottom: "16px" }}>
                Find the dates the market hasn't priced yet
              </h2>
              <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid, marginBottom: "16px" }}>
                Every dot is a future date. When demand is high but prices haven't caught up, there's an asymmetry — and that's where the opportunity sits.
              </p>
              <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid }}>
                We surface these patterns daily so you can act before the rest of the market adjusts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION: Platform Capabilities — Vertical stack ─── */}
      <section style={{ background: A.bg, borderBottom: `1px solid ${A.border}`, padding: "96px 64px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.teal, textTransform: "uppercase", marginBottom: "16px" }}>PLATFORM</div>
            <h2 style={{ fontSize: "40px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.5px", color: A.accent }}>
              Built for operators who read the market
            </h2>
          </div>

          {/* Horizontal feature rows instead of columns */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { icon: BarChart3, accent: A.teal, label: "PERFORMANCE", title: "Live Dashboard & Reports", desc: "Every key revenue metric, live from your PMS. Year-on-year trend analysis with budget variance, multi-property portfolio lens, and scheduled PDF intelligence briefs." },
              { icon: Globe, accent: A.gold, label: "MARKET VIEW", title: "Competitive Intelligence", desc: "Thousands of properties tracked daily across your city. Price distribution curves, supply movement patterns, neighbourhood-level demand heatmaps, and major event impact analysis." },
              { icon: Calendar, accent: A.teal, label: "FORECASTING", title: "Forward Demand & Events", desc: "90-day demand trajectory with momentum indicators. Event-driven demand spikes surfaced automatically, pace curves by seasonality tier, and guest behaviour pattern analysis." },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: "grid", gridTemplateColumns: "200px 1fr", gap: "40px", alignItems: "center",
                padding: "32px 0", borderBottom: i < 2 ? `1px solid ${A.border}` : "none",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <row.icon size={14} color={row.accent} />
                    <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: row.accent, textTransform: "uppercase" }}>{row.label}</span>
                  </div>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: A.accent, letterSpacing: "-0.3px" }}>{row.title}</h3>
                </div>
                <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid, margin: 0 }}>{row.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION: Bespoke Research ─── */}
      <section style={{ background: A.heroBg, borderBottom: `1px solid ${A.border}`, padding: "96px 64px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ maxWidth: "560px", marginBottom: "56px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "16px" }}>BESPOKE RESEARCH</div>
            <h2 style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.2px", color: A.accent, marginBottom: "16px" }}>
              Custom market studies. Any city. Any asset class.
            </h2>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid }}>
              Our data infrastructure isn't limited to London. We spin up collection pipelines for any market globally — sourcing OTA availability, pricing dynamics, supply composition, and demand patterns for investors, developers, and operators evaluating new opportunities.
            </p>
          </div>

          {/* Project cards — horizontal row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            {[
              { market: "Mediterranean Island", type: "Investor feasibility study", scope: "Short-stay supply mapping across platforms, occupancy proxies, seasonal pricing curves, micro-market clustering by coordinates", accent: A.teal },
              { market: "Major European Capital", type: "Area demand intelligence", scope: "Neighbourhood-level absorption analysis, forward demand scoring, supply composition by property type and star rating", accent: A.gold },
              { market: "US Entertainment Hub", type: "Market entry analysis", scope: "120-day forward pricing, event-driven demand patterns, competitive set identification, supply gap analysis", accent: A.teal },
            ].map((p) => (
              <div key={p.market} style={{ background: A.card, borderRadius: "12px", border: `1px solid ${A.border}`, borderTop: `2px solid ${p.accent}`, padding: "24px" }}>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: p.accent, textTransform: "uppercase", marginBottom: "12px" }}>{p.market}</div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: A.accent, marginBottom: "10px" }}>{p.type}</div>
                <div style={{ fontSize: "12px", lineHeight: 1.6, color: A.textMid }}>{p.scope}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "40px" }}>
            <button style={{ padding: "14px 24px", borderRadius: "8px", background: "transparent", color: A.accent, fontWeight: 600, fontSize: "13px", border: `1px solid ${A.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              Discuss a project <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── SECTION: CTA ─── */}
      <section style={{ background: A.bg, borderBottom: `1px solid ${A.border}`, padding: "80px 64px", textAlign: "center" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.2px", color: A.accent, marginBottom: "16px" }}>
            Open platform. No gatekeepers.
          </h2>
          <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid, marginBottom: "36px" }}>
            Connect your PMS, get your dashboard in five minutes. No sales call, no onboarding queue, no credit card. If you run an independent hotel, this is yours.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button style={{ padding: "14px 28px", borderRadius: "8px", background: A.teal, color: A.darkBand, fontWeight: 700, fontSize: "14px", border: `1px solid ${A.teal}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              Connect Your Hotel <ArrowRight size={14} />
            </button>
            <button style={{ padding: "14px 28px", borderRadius: "8px", background: "transparent", color: A.text, fontWeight: 500, fontSize: "14px", border: `1px solid ${A.border}`, cursor: "pointer" }}>
              Contact Us
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: A.darkBand, padding: "48px 64px", borderTop: `1px solid ${A.border}` }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "48px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "3px", marginBottom: "16px" }}>
              <span style={{ color: A.teal, fontSize: "22px", fontWeight: 300 }}>(</span>
              <span style={{ color: A.accent, fontSize: "12px", fontWeight: 700, letterSpacing: "1.4px" }}>MARKET PULSE</span>
              <span style={{ color: A.gold, fontSize: "22px", fontWeight: 300 }}>)</span>
            </div>
            <p style={{ fontSize: "12px", lineHeight: 1.7, color: A.textDim, maxWidth: "280px" }}>
              Revenue intelligence platform for independent hotel operators. A Rockenue product.
            </p>
          </div>
          {[
            { title: "Platform", links: ["Dashboard", "Market Intelligence", "Demand Radar", "Reports"] },
            { title: "Connect", links: ["Cloudbeds", "Mews", "Opera (coming)"] },
            { title: "Company", links: ["Privacy Policy", "Terms of Service", "Contact", "Rockenue.com"] },
          ].map((col) => (
            <div key={col.title}>
              <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: A.textDim, textTransform: "uppercase", marginBottom: "16px" }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {col.links.map(l => (
                  <span key={l} style={{ fontSize: "13px", color: A.textMid, cursor: "pointer" }}>{l}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: "1200px", margin: "0 auto", paddingTop: "32px", marginTop: "32px", borderTop: `1px solid ${A.border}`, fontSize: "11px", color: A.textDim }}>
          2026 Rockenue Ltd. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
