import { useState } from "react";
import { ArrowRight, Activity, Radar, TrendingUp, BarChart3, Globe, ChevronRight, Target, Map, Calendar, PieChart } from "lucide-react";

// ── MP Login v2: Research & intelligence platform landing ──
// Design language: rockenue.com (editorial, teal/gold duality, zero shadows)

interface MPLoginProps { activeView: string; onNavigate: (view: string) => void; }

const A = {
  bg: "#14181D", card: "#1C2228", border: "#2A3240", sep: "rgba(255,255,255,0.04)",
  accent: "#F3F5F7", text: "#B0B8C4", textMid: "#7A8494", textDim: "#4E5868",
  teal: "#38C6BA", gold: "#C8A66E", heroBg: "#111519", darkBand: "#0F1215",
  green: "#34D068", red: "#ef4444", cardHover: "#222830",
};

const gradientText: React.CSSProperties = {
  background: `linear-gradient(135deg, ${A.teal} 0%, ${A.gold} 100%)`,
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
};

export function MPLogin({ activeView, onNavigate }: MPLoginProps) {
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

      {/* ─── HERO ─── */}
      <section style={{ minHeight: "70vh", display: "grid", gridTemplateColumns: "1fr 1fr", maxWidth: "1280px", margin: "0 auto", position: "relative" }}>
        {/* Left: Text */}
        <div style={{ padding: "96px 48px 96px 64px", borderRight: `1px solid ${A.border}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "24px" }}>
            HOTEL REVENUE INTELLIGENCE
          </div>
          <h1 style={{ fontSize: "52px", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-2px", color: A.accent, marginBottom: "28px" }}>
            Millions of data points.<br />One clear picture.
          </h1>
          <p style={{ fontSize: "16px", lineHeight: 1.7, color: A.text, maxWidth: "440px", marginBottom: "48px" }}>
            Market analytics, forward demand intelligence, and competitive benchmarking — built for operators who make decisions with data, not instinct.
          </p>

          {/* CTA row */}
          <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "64px" }}>
            <span style={{ fontSize: "13px", color: A.textMid }}>Connect your PMS and go — no sales call, no setup fee.</span>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0" }}>
            {[
              { value: "4,300+", label: "Properties tracked daily" },
              { value: "120", label: "Day forward horizon" },
              { value: "2.1M+", label: "Data points collected" },
            ].map((s, i) => (
              <div key={s.label} style={{ position: "relative", paddingRight: "24px", paddingLeft: i > 0 ? "24px" : "0" }}>
                <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1, marginBottom: "8px", ...gradientText }}>{s.value}</div>
                <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px", color: A.textDim, textTransform: "uppercase" }}>{s.label}</div>
                {i < 2 && <div style={{ position: "absolute", right: "0", top: "4px", width: "1px", height: "44px", background: A.border }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Login + visual */}
        <div style={{ padding: "96px 64px 96px 48px", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
          {/* Decorative glows */}
          <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "280px", height: "280px", borderRadius: "50%", background: `radial-gradient(circle, ${A.teal}30 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-100px", left: "-100px", width: "280px", height: "280px", borderRadius: "50%", background: `radial-gradient(circle, ${A.gold}30 0%, transparent 70%)`, pointerEvents: "none" }} />

          {/* Login card */}
          <div style={{ background: A.card, borderRadius: "12px", border: `1px solid ${A.border}`, padding: "32px 28px", position: "relative", zIndex: 1, marginBottom: "24px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2px", color: A.teal, textTransform: "uppercase", marginBottom: "20px" }}>SIGN IN</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              <input
                type="email" placeholder="your@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ height: "44px", borderRadius: "8px", border: `1px solid ${A.border}`, background: A.bg, color: A.accent, padding: "0 14px", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <button style={{ height: "44px", borderRadius: "8px", background: A.teal, color: A.darkBand, fontWeight: 700, fontSize: "14px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%" }}>
                Send Magic Link <ArrowRight size={14} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", margin: "20px 0" }}>
              <div style={{ flex: 1, height: "1px", background: A.border }} />
              <span style={{ padding: "0 14px", fontSize: "10px", color: A.textDim, textTransform: "uppercase", letterSpacing: "1.5px" }}>or connect PMS</span>
              <div style={{ flex: 1, height: "1px", background: A.border }} />
            </div>

            {/* PMS buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              {[
                { name: "Cloudbeds", color: A.teal },
                { name: "Mews", color: A.gold },
              ].map((pms) => (
                <button key={pms.name} style={{
                  flex: 1, height: "44px", borderRadius: "8px", background: A.bg, border: `1px solid ${A.border}`,
                  color: A.accent, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  fontSize: "13px", fontWeight: 600,
                }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: pms.color }} />
                  {pms.name}
                </button>
              ))}
            </div>
          </div>

          {/* Micro trust line */}
          <div style={{ textAlign: "center", fontSize: "11px", color: A.textDim }}>
            Free for independent hotels. No credit card required.
          </div>
        </div>
      </section>

      {/* ─── SECTION: Live Intelligence Feed ─── */}
      <section style={{ background: A.heroBg, borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}` }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 64px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.teal, textTransform: "uppercase", marginBottom: "16px" }}>LIVE MARKET DATA</div>
          <h2 style={{ fontSize: "40px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.5px", color: A.accent, marginBottom: "16px" }}>
            Every signal. Every neighbourhood.<br />Every day.
          </h2>
          <p style={{ fontSize: "16px", lineHeight: 1.7, color: A.textMid, maxWidth: "560px", marginBottom: "56px" }}>
            We ingest daily OTA availability, pricing, and supply data across thousands of properties — then surface the patterns that matter for your next decision.
          </p>

          {/* Data source cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0" }}>
            {[
              { icon: Globe, label: "OTA COVERAGE", title: "Daily Market Availability", desc: "Price distributions, supply by neighbourhood, property type composition, and star rating mix — sourced from major OTA platforms and processed every 24 hours across a 120-day forward horizon.", stat: "4,300+", statLabel: "Properties" },
              { icon: Radar, label: "DEMAND SIGNALS", title: "Forward Demand & Event Layer", desc: "Market demand scoring, weighted average pricing, supply absorption rates, and major event impact analysis — aggregated into actionable forward-looking signals.", stat: "90", statLabel: "Day horizon" },
              { icon: Activity, label: "BOOKING VELOCITY", title: "Real-Time Pace Analytics", desc: "Webhook-driven booking pace from your PMS — lead time distributions, length-of-stay patterns, channel mix, and pickup velocity by date.", stat: "< 1s", statLabel: "Latency" },
            ].map((card, i) => (
              <div key={card.label} style={{
                padding: "32px 28px", borderRight: i < 2 ? `1px solid ${A.border}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <card.icon size={16} color={A.teal} />
                  <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: A.gold, textTransform: "uppercase" }}>{card.label}</span>
                </div>
                <h3 style={{ fontSize: "17px", fontWeight: 700, color: A.accent, marginBottom: "12px", letterSpacing: "-0.3px" }}>{card.title}</h3>
                <p style={{ fontSize: "13px", lineHeight: 1.7, color: A.textMid, marginBottom: "24px" }}>{card.desc}</p>
                <div>
                  <div style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, ...gradientText }}>{card.stat}</div>
                  <div style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "1.5px", color: A.textDim, textTransform: "uppercase", marginTop: "6px" }}>{card.statLabel}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION: Price-Demand Divergence ─── */}
      <section style={{ background: A.bg, borderBottom: `1px solid ${A.border}` }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 64px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "0" }}>
          {/* Chart */}
          <div style={{ paddingRight: "48px", borderRight: `1px solid ${A.border}` }}>
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
                    { color: A.textDim, label: "Quiet" },
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9px", color: A.textMid }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: l.color, opacity: 0.8 }} />{l.label}
                    </div>
                  ))}
                </div>
              </div>
              <svg viewBox="0 0 520 320" style={{ width: "100%", height: "300px" }}>
                <defs>
                  <radialGradient id="dotGlow">
                    <stop offset="0%" stopColor={A.teal} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={A.teal} stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="quadTR" x1="0.5" y1="0.5" x2="1" y2="0">
                    <stop offset="0%" stopColor={A.red} stopOpacity="0" />
                    <stop offset="100%" stopColor={A.red} stopOpacity="0.03" />
                  </linearGradient>
                  <linearGradient id="quadBR" x1="0.5" y1="0.5" x2="1" y2="1">
                    <stop offset="0%" stopColor={A.teal} stopOpacity="0" />
                    <stop offset="100%" stopColor={A.teal} stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                {/* Quadrant fills */}
                <rect x="280" y="10" width="230" height="145" fill="url(#quadTR)" />
                <rect x="280" y="155" width="230" height="155" fill="url(#quadBR)" />
                {/* Grid lines */}
                {[60, 110, 160, 210, 260].map(y => (
                  <line key={y} x1="50" y1={y} x2="510" y2={y} stroke={A.border} strokeWidth="0.4" />
                ))}
                {[120, 200, 280, 360, 440].map(x => (
                  <line key={x} x1={x} y1="10" x2={x} y2="310" stroke={A.border} strokeWidth="0.4" />
                ))}
                {/* Quadrant dividers */}
                <line x1="280" y1="10" x2="280" y2="310" stroke={A.border} strokeWidth="0.8" strokeDasharray="6 4" />
                <line x1="50" y1="155" x2="510" y2="155" stroke={A.border} strokeWidth="0.8" strokeDasharray="6 4" />
                {/* Quadrant labels */}
                <text x="395" y="36" fill={A.red} fontSize="8" fontWeight="600" textAnchor="middle" opacity="0.5">COMPRESSION</text>
                <text x="395" y="46" fill={A.textDim} fontSize="7" textAnchor="middle" opacity="0.4">high demand, high price</text>
                <text x="395" y="286" fill={A.teal} fontSize="8" fontWeight="600" textAnchor="middle" opacity="0.5">OPPORTUNITY</text>
                <text x="395" y="296" fill={A.textDim} fontSize="7" textAnchor="middle" opacity="0.4">demand building, price lagging</text>
                <text x="160" y="36" fill={A.textDim} fontSize="7" textAnchor="middle" opacity="0.35">overpriced</text>
                <text x="160" y="286" fill={A.textDim} fontSize="7" textAnchor="middle" opacity="0.35">low activity</text>
                {/* Scatter dots */}
                {(() => {
                  const pts: { x: number; y: number; demand: number; price: number; isEvent: boolean }[] = [];
                  for (let i = 0; i < 55; i++) {
                    const demand = 15 + Math.random() * 80;
                    const base = 90 + demand * 1.4;
                    const price = base + (Math.random() - 0.5) * 70;
                    const isEvent = i === 8 || i === 19 || i === 33 || i === 47;
                    const x = 50 + (demand / 100) * 460;
                    const y = 310 - ((price - 60) / 250) * 300;
                    pts.push({ x, y, demand, price, isEvent });
                  }
                  return pts.map((p, i) => {
                    const color = p.isEvent ? A.gold : p.demand > 70 ? A.red : p.demand > 40 ? A.teal : A.textDim;
                    const r = p.isEvent ? 7 : 4;
                    return <g key={i}>
                      {p.isEvent && <circle cx={p.x} cy={p.y} r="16" fill={A.gold} opacity="0.06" />}
                      <circle cx={p.x} cy={p.y} r={r} fill={color} opacity={p.isEvent ? 0.9 : 0.55} />
                      {p.isEvent && <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={A.gold} strokeWidth="1" opacity="0.4" />}
                    </g>;
                  });
                })()}
                {/* Axis labels */}
                <text x="280" y="328" fill={A.textMid} fontSize="9" fontWeight="500" textAnchor="middle">DEMAND INTENSITY →</text>
                <text x="18" y="165" fill={A.textMid} fontSize="9" fontWeight="500" textAnchor="middle" transform="rotate(-90,18,165)">MARKET PRICE →</text>
                {/* Y axis ticks */}
                {[80, 120, 160, 200, 240, 280].map(v => {
                  const y = 310 - ((v - 60) / 250) * 300;
                  return <text key={v} x="44" y={y + 3} fill={A.textDim} fontSize="7" textAnchor="end">£{v}</text>;
                })}
              </svg>
            </div>
          </div>

          {/* Copy */}
          <div style={{ paddingLeft: "48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "16px" }}>MARKET SIGNALS</div>
            <h2 style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.2px", color: A.accent, marginBottom: "16px" }}>
              Find the dates the<br />market hasn't priced yet
            </h2>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid, marginBottom: "20px" }}>
              Every dot is a future date. When demand is high but prices haven't caught up, there's an asymmetry — and that's where the opportunity sits.
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid }}>
              We surface these patterns daily so you can act before the rest of the market adjusts. Compression events, underpriced windows, and softening periods — visible at a glance.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SECTION: Platform Capabilities ─── */}
      <section style={{ background: A.bg, borderBottom: `1px solid ${A.border}` }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 64px" }}>
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "16px" }}>PLATFORM</div>
            <h2 style={{ fontSize: "40px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.5px", color: A.accent }}>
              Built for operators who read the market
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0" }}>
            {[
              { icon: BarChart3, label: "PERFORMANCE", title: "Live Dashboard & Reports", items: ["Every key revenue metric, live from your PMS — no manual entry", "Year-on-year trend analysis with budget variance tracking", "Multi-property portfolio lens for operators with scale", "Scheduled PDF intelligence briefs delivered to your inbox"] },
              { icon: Globe, label: "MARKET VIEW", title: "Competitive Intelligence", items: ["Thousands of properties tracked across your city, daily", "Price distribution curves and supply movement patterns", "Neighbourhood-level demand absorption heatmaps", "Major event impact layered onto forward demand"] },
              { icon: Calendar, label: "FORECASTING", title: "Forward Demand & Events", items: ["90-day demand trajectory with momentum indicators", "Event-driven demand spikes surfaced automatically", "Booking pace curves segmented by seasonality tier", "Guest behaviour patterns — lead time, stay length, channel mix"] },
            ].map((col, i) => (
              <div key={col.label} style={{ padding: "0 32px", borderRight: i < 2 ? `1px solid ${A.border}` : "none" }}>
                <div style={{ borderTop: `2px solid ${i % 2 === 0 ? A.teal : A.gold}`, paddingTop: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                    <col.icon size={14} color={i % 2 === 0 ? A.teal : A.gold} />
                    <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: A.textDim, textTransform: "uppercase" }}>{col.label}</span>
                  </div>
                  <h3 style={{ fontSize: "17px", fontWeight: 700, color: A.accent, marginBottom: "16px", letterSpacing: "-0.3px" }}>{col.title}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {col.items.map((item, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: i % 2 === 0 ? A.teal : A.gold, flexShrink: 0, marginTop: "6px" }} />
                        <span style={{ fontSize: "13px", lineHeight: 1.5, color: A.textMid }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION: Bespoke Research ─── */}
      <section style={{ background: A.heroBg, borderBottom: `1px solid ${A.border}` }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "96px 64px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
          <div style={{ paddingRight: "48px", borderRight: `1px solid ${A.border}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "2.5px", color: A.gold, textTransform: "uppercase", marginBottom: "16px" }}>BESPOKE RESEARCH</div>
            <h2 style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1.2px", color: A.accent, marginBottom: "16px" }}>
              Custom market studies.<br />Any city. Any asset class.
            </h2>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid, marginBottom: "32px" }}>
              Our data infrastructure isn't limited to London. We spin up collection pipelines for any market globally — sourcing OTA availability, pricing dynamics, supply composition, and demand patterns for investors, developers, and operators evaluating new opportunities.
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.7, color: A.textMid, marginBottom: "36px" }}>
              Whether you're underwriting a site acquisition, benchmarking a portfolio, or sizing a market entry — we build the dataset and deliver the analysis.
            </p>
            <button style={{ padding: "14px 24px", borderRadius: "8px", background: "transparent", color: A.accent, fontWeight: 600, fontSize: "13px", border: `1px solid ${A.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", alignSelf: "flex-start" }}>
              Discuss a project <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ paddingLeft: "48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* Past project examples */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                { market: "Mediterranean Island", type: "Investor feasibility study", scope: "Short-stay supply mapping across platforms, occupancy proxies, seasonal pricing curves, micro-market clustering by coordinates", color: A.teal },
                { market: "Major European Capital", type: "Area demand intelligence", scope: "Neighbourhood-level absorption analysis, forward demand scoring, supply composition by property type and star rating", color: A.gold },
                { market: "US Entertainment Hub", type: "Market entry analysis", scope: "120-day forward pricing, event-driven demand patterns, competitive set identification, supply gap analysis", color: A.teal },
              ].map((project, i) => (
                <div key={project.market} style={{ padding: "24px 0", borderBottom: i < 2 ? `1px solid ${A.border}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <div style={{ width: "8px", height: "2px", background: project.color, borderRadius: "1px" }} />
                    <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "2px", color: project.color, textTransform: "uppercase" }}>{project.market}</span>
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: A.accent, marginBottom: "6px" }}>{project.type}</div>
                  <div style={{ fontSize: "12px", lineHeight: 1.6, color: A.textMid }}>{project.scope}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION: CTA ─── */}
      <section style={{ background: A.heroBg, borderBottom: `1px solid ${A.border}`, padding: "80px 64px", textAlign: "center" }}>
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
